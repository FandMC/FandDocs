# Daily Kit Plugin

This example registers `/dailykit`. Each player can claim a small kit once every 24 hours, and the cooldown is stored in plugin player storage.

It shows commands, adding items to a player's inventory, player-scoped `PluginStorage`, and generated `ItemKey` constants.

## DailyKitPlugin.java

```java
package com.example.dailykit;

import io.fand.api.command.CommandDescriptor;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.util.List;

public final class DailyKitPlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        var descriptor = new CommandDescriptor(
                "ignored",
                "dailykit",
                List.of(),
                List.of(),
                "dailykit.claim");

        context.commands().register(descriptor, new DailyKitCommand(context));
    }
}
```

## DailyKitCommand.java

```java
package com.example.dailykit;

import io.fand.api.command.CommandExecutor;
import io.fand.api.command.CommandSender;
import io.fand.api.entity.Player;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.plugin.PluginContext;
import java.time.Duration;
import java.util.List;
import net.kyori.adventure.text.Component;

final class DailyKitCommand implements CommandExecutor {
    private static final String LAST_CLAIM_KEY = "lastClaimMillis";
    private static final long COOLDOWN_MILLIS = Duration.ofHours(24).toMillis();

    private final PluginContext context;

    DailyKitCommand(PluginContext context) {
        this.context = context;
    }

    @Override
    public void execute(CommandSender sender, String label, List<String> args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("Only players can claim kits"));
            return;
        }

        var storage = context.storage().player(player.uniqueId());
        long now = System.currentTimeMillis();
        long lastClaim = storage.get(LAST_CLAIM_KEY)
                .map(element -> element.getAsJsonPrimitive().getAsLong())
                .orElse(0L);

        long remaining = COOLDOWN_MILLIS - (now - lastClaim);
        if (remaining > 0) {
            player.sendMessage(Component.text("Wait " + formatTime(remaining) + " before claiming again"));
            return;
        }

        giveKit(player);
        storage.set(LAST_CLAIM_KEY, new com.google.gson.JsonPrimitive(now));
        storage.flush();

        player.sendMessage(Component.text("Daily kit claimed"));
    }

    private static void giveKit(Player player) {
        addOrDrop(player, ItemTypes.of(ItemKey.BREAD).stack(16));
        addOrDrop(player, ItemTypes.of(ItemKey.TORCH).stack(16));
        addOrDrop(player, ItemTypes.of(ItemKey.IRON_PICKAXE).one());
    }

    private static void addOrDrop(Player player, io.fand.api.item.ItemStack stack) {
        var leftover = player.inventory().add(stack);
        if (!leftover.isEmpty()) {
            player.location().world().dropItem(player.location(), leftover);
        }
    }

    private static String formatTime(long millis) {
        long minutes = Math.max(1, Duration.ofMillis(millis).toMinutes());
        long hours = minutes / 60;
        long restMinutes = minutes % 60;
        return hours > 0 ? hours + "h " + restMinutes + "m" : restMinutes + "m";
    }
}
```

`context.storage().player(player.uniqueId())` gives each player their own cooldown state. `set(...)` mutates the in-memory scope, and `flush()` persists that scope to disk.

## Next Improvements

- Move kit contents and cooldown duration into config.
- Add command completion and permission defaults.
- Batch persistence asynchronously if the command becomes high traffic.
- Check inventory space before giving rewards and send clearer feedback.
