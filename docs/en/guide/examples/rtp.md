# Random Teleport Plugin

This example registers `/rtp` and teleports a player to a random surface location near their current position. It shows command registration, player sender checks, world height lookup, and `Player.teleport(...)`.

Production RTP plugins should also validate the destination, avoid lava and void space, respect region protection, and obey the world border. This page keeps the first version intentionally small.

## RtpPlugin.java

The plugin entry point only registers the command. Command behavior lives in its own class.

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

The command class handles only `/rtp`. That keeps cooldowns, destination checks, and feedback out of the entry point.

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
            sender.sendMessage(Component.text("Only players can use this command"));
            return;
        }

        var radius = command.intValue("radius");
        var target = randomLocation(player, radius);

        player.sendMessage(Component.text("Finding a random location..."));
        player.teleport(target).thenAccept(success -> {
            if (success) {
                player.sendMessage(Component.text("Teleported to "
                        + target.blockX() + ", "
                        + target.blockY() + ", "
                        + target.blockZ()));
            } else {
                player.sendMessage(Component.text("Teleport failed; you may have gone offline"));
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

`context.commands()` owns the command under the current plugin namespace. The radius argument is parsed, bounded, and
defaulted by `Arguments.integer(100, 20_000).optional(RtpCommand.RADIUS)`, so the command logic can read the parsed value directly.

## Next Improvements

- Read the default and maximum radius from config.
- Check the block below the destination, headroom, and dangerous fluids.
- Add a cooldown to `/rtp`.
- Use the region API to avoid protected areas.
