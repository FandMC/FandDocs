# 随机传送插件

这个示例注册 `/rtp` 命令，把玩家随机传送到当前世界的一块地表附近。它演示命令注册、判断命令发送者是否为玩家、查询世界高度，以及调用 `Player.teleport(...)`。

生产环境里的 RTP 通常还要做更多落点检查，比如避开岩浆、虚空、保护区和世界边界。这里先保留最小可读版本。

## RtpPlugin.java

插件入口只做注册，不把命令业务塞进 `onEnable`。

```java
package com.example.rtp;

import io.fand.api.command.CommandDescriptor;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.util.List;

public final class RtpPlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        var descriptor = new CommandDescriptor(
                "ignored",
                "rtp",
                List.of(),
                List.of("radius"),
                List.of(),
                "rtp.use");

        context.commands().register(descriptor, new RtpCommand());
    }
}
```

## RtpCommand.java

命令类只处理 `/rtp` 的执行逻辑。这样后面加冷却、落点检查、权限反馈时，不会把入口类写乱。

```java
package com.example.rtp;

import io.fand.api.command.CommandExecutor;
import io.fand.api.command.CommandSender;
import io.fand.api.entity.Player;
import io.fand.api.world.HeightmapType;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import net.kyori.adventure.text.Component;

final class RtpCommand implements CommandExecutor {
    private static final int RADIUS = 5_000;

    @Override
    public void execute(CommandSender sender, String label, List<String> args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("只有玩家可以使用这个命令"));
            return;
        }

        var radius = parseRadius(args);
        var target = randomLocation(player, radius);

        player.sendMessage(Component.text("正在随机传送..."));
        player.teleport(target).thenAccept(success -> {
            if (success) {
                player.sendMessage(Component.text("已传送到 "
                        + target.blockX() + ", "
                        + target.blockY() + ", "
                        + target.blockZ()));
            } else {
                player.sendMessage(Component.text("传送失败，你可能已经离线"));
            }
        });
    }

    private static int parseRadius(List<String> args) {
        if (args.isEmpty()) {
            return RADIUS;
        }
        try {
            return Math.max(100, Math.min(20_000, Integer.parseInt(args.getFirst())));
        } catch (NumberFormatException ignored) {
            return RADIUS;
        }
    }

    private static io.fand.api.world.Location randomLocation(Player player, int radius) {
        var random = ThreadLocalRandom.current();
        var current = player.location();
        var world = current.world();

        int x = current.blockX() + random.nextInt(-radius, radius + 1);
        int z = current.blockZ() + random.nextInt(-radius, radius + 1);
        int y = world.highestBlockYAt(x, z, HeightmapType.MOTION_BLOCKING) + 1;

        return world.at(x + 0.5, y, z + 0.5, current.yaw(), current.pitch());
    }
}
```

`CommandDescriptor` 里的 namespace 在插件作用域里会被替换成当前插件 id，所以示例写 `"ignored"` 只是占位。命令最终会注册到你的插件命名空间下。

## 可以继续改进

- 从配置文件读取默认半径和最大半径。
- 在传送前检查落点脚下方块、头顶空间和危险流体。
- 给 `/rtp` 增加冷却，避免玩家连续刷传送。
- 结合区域 API，禁止传送进受保护区域。
