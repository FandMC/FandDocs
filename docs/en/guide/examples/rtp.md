# Random Teleport Plugin

This example registers `/rtp` and teleports a player to a random surface location near their current position. It shows command registration, player sender checks, world height lookup, and `Player.teleport(...)`.

Production RTP plugins should also validate the destination, avoid lava and void space, respect region protection, and obey the world border. This page keeps the first version intentionally small.

## RtpPlugin.java

The plugin entry point only registers the command. Command behavior lives in its own class.

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

The command class handles only `/rtp`. That keeps cooldowns, destination checks, and feedback out of the entry point.

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
            sender.sendMessage(Component.text("Only players can use this command"));
            return;
        }

        var radius = parseRadius(args);
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

The namespace in `CommandDescriptor` is replaced by the current plugin id when registered through `context.commands()`, so `"ignored"` is only a placeholder.

## Next Improvements

- Read the default and maximum radius from config.
- Check the block below the destination, headroom, and dangerous fluids.
- Add a cooldown to `/rtp`.
- Use the region API to avoid protected areas.
