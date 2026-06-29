# 个人传送点插件

这个示例注册 `/sethome` 和 `/home`。玩家可以保存当前坐标，再用 `/home` 回到保存的位置。

它演示多个命令、玩家作用域存储、把 `Location` 拆成可保存的字段，以及从服务器重新查找世界。

## HomePlugin.java

入口类只负责组装依赖和注册命令。

```java
package com.example.home;

import io.fand.api.command.CommandDescriptor;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.util.List;

public final class HomePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        var homes = new HomeStore(context);

        context.commands().register(
                command("sethome", "home.set"),
                new SetHomeCommand(homes));

        context.commands().register(
                command("home", "home.use"),
                new HomeCommand(homes));
    }

    private static CommandDescriptor command(String label, String permission) {
        return new CommandDescriptor("ignored", label, List.of(), List.of(), permission);
    }
}
```

## HomeStore.java

保存和读取位置的逻辑独立出来，两个命令共用它。

```java
package com.example.home;

import io.fand.api.Fand;
import io.fand.api.entity.Player;
import io.fand.api.plugin.PluginContext;
import io.fand.api.world.Location;
import net.kyori.adventure.key.Key;

final class HomeStore {
    private final PluginContext context;

    HomeStore(PluginContext context) {
        this.context = context;
    }

    void save(Player player) {
        var location = player.location();
        var storage = context.storage().player(player.uniqueId());
        storage.setString("home.world", location.world().key().asString());
        storage.setString("home.x", Double.toString(location.x()));
        storage.setString("home.y", Double.toString(location.y()));
        storage.setString("home.z", Double.toString(location.z()));
        storage.setString("home.yaw", Float.toString(location.yaw()));
        storage.setString("home.pitch", Float.toString(location.pitch()));
        storage.flush();
    }

    Location load(Player player) {
        var storage = context.storage().player(player.uniqueId());
        var worldKey = storage.getString("home.world").map(Key::key).orElse(null);
        if (worldKey == null) {
            return null;
        }

        var world = Fand.server().world(worldKey).orElse(null);
        if (world == null) {
            return null;
        }

        var x = Double.parseDouble(storage.getString("home.x").orElse("0"));
        var y = Double.parseDouble(storage.getString("home.y").orElse("0"));
        var z = Double.parseDouble(storage.getString("home.z").orElse("0"));
        var yaw = Float.parseFloat(storage.getString("home.yaw").orElse("0"));
        var pitch = Float.parseFloat(storage.getString("home.pitch").orElse("0"));
        return world.at(x, y, z, yaw, pitch);
    }
}
```

## SetHomeCommand.java

```java
package com.example.home;

import io.fand.api.command.CommandExecutor;
import io.fand.api.command.CommandSender;
import io.fand.api.entity.Player;
import java.util.List;
import net.kyori.adventure.text.Component;

final class SetHomeCommand implements CommandExecutor {
    private final HomeStore homes;

    SetHomeCommand(HomeStore homes) {
        this.homes = homes;
    }

    @Override
    public void execute(CommandSender sender, String label, List<String> args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("只有玩家可以设置家"));
            return;
        }

        homes.save(player);
        player.sendMessage(Component.text("已保存当前位置"));
    }
}
```

## HomeCommand.java

```java
package com.example.home;

import io.fand.api.command.CommandExecutor;
import io.fand.api.command.CommandSender;
import io.fand.api.entity.Player;
import java.util.List;
import net.kyori.adventure.text.Component;

final class HomeCommand implements CommandExecutor {
    private final HomeStore homes;

    HomeCommand(HomeStore homes) {
        this.homes = homes;
    }

    @Override
    public void execute(CommandSender sender, String label, List<String> args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("只有玩家可以传送回家"));
            return;
        }

        var home = homes.load(player);
        if (home == null) {
            player.sendMessage(Component.text("你还没有设置家，先输入 /sethome"));
            return;
        }

        player.teleport(home).thenAccept(success -> {
            if (success) {
                player.sendMessage(Component.text("已传送回家"));
            }
        });
    }
}
```

`Location` 里包含 `World` 对象，不能直接当成简单字符串保存。示例把世界 key 和坐标拆开存，读取时再用 `Fand.server().world(key)` 找回已加载世界。

## 可以继续改进

- 支持多个家，例如 `/sethome mine` 和 `/home mine`。
- 在传送前检查世界是否已加载，没加载时给出明确提示。
- 增加冷却和传送前倒计时。
- 把数据写成一个 JSON 对象，而不是多个字符串字段。
