# 随机传送插件

这个示例注册 `/rtp` 命令，把玩家随机传送到当前世界的一块地表附近。它演示命令注册、判断命令发送者是否为玩家、查询世界高度，以及调用 `Player.teleport(...)`。

生产环境里的 RTP 通常还要做更多落点检查，比如避开岩浆、虚空、保护区和世界边界。这里先保留最小可读版本。

## RtpPlugin.java

插件入口只做注册，不把命令业务塞进 `onEnable`。

```java
package com.example.rtp;

import io.fand.api.command.Arguments;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;

public final class RtpPlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        var command = new RtpCommand();
        context.commands().register("rtp", root -> root
                .permission("rtp.use")
                .argument("radius", Arguments.integer(100, 20_000).optional(RtpCommand.RADIUS), radius -> radius
                        .executes(command::execute)));
    }
}
```

## RtpCommand.java

命令类只处理 `/rtp` 的执行逻辑。这样后面加冷却、落点检查、权限反馈时，不会把入口类写乱。

```java
package com.example.rtp;

import io.fand.api.command.CommandContext;
import io.fand.api.entity.Player;
import io.fand.api.world.HeightmapType;
import java.util.concurrent.ThreadLocalRandom;
import net.kyori.adventure.text.Component;

final class RtpCommand {
    static final int RADIUS = 5_000;

    void execute(CommandContext command) {
        var sender = command.sender();
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("只有玩家可以使用这个命令"));
            return;
        }

        var radius = command.intValue("radius");
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

`context.commands()` 会把命令归属到当前插件命名空间下。半径参数由 `Arguments.integer(100, 20_000).optional(RtpCommand.RADIUS)` 负责解析、限制范围和提供默认值，业务代码只读取已经解析好的值。

## 可以继续改进

- 从配置文件读取默认半径和最大半径。
- 在传送前检查落点脚下方块、头顶空间和危险流体。
- 给 `/rtp` 增加冷却，避免玩家连续刷传送。
- 结合区域 API，禁止传送进受保护区域。
