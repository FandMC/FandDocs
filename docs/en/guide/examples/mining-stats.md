# Mining Stats Plugin

This example listens for block breaks, counts diamond ore broken by each player, and registers `/minediamonds` to show the player's count.

It shows block events, generated `BlockKey` constants, player-scoped storage, and a small stats command.

## MiningStatsPlugin.java

The entry point registers the listener and command. The storage key is shared by both classes.

```java
package com.example.mining;

import io.fand.api.event.block.BlockBreakEvent;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;

public final class MiningStatsPlugin implements Plugin {
    static final String DIAMONDS_MINED = "diamondsMined";

    @Override
    public void onEnable(PluginContext context) {
        context.events().subscribe(BlockBreakEvent.class, new MiningListener(context));

        var command = new MiningStatsCommand(context);
        context.commands().register("minediamonds", root -> root
                .permission("mining.stats")
                .executes(command::execute));
    }

    @Override
    public void onDisable(PluginContext context) {
        context.storage().flush();
    }
}
```

## MiningListener.java

```java
package com.example.mining;

import io.fand.api.block.BlockKey;
import io.fand.api.event.EventListener;
import io.fand.api.event.block.BlockBreakEvent;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

final class MiningListener implements EventListener<BlockBreakEvent> {
    private final PluginContext context;

    MiningListener(PluginContext context) {
        this.context = context;
    }

    @Override
    public void on(BlockBreakEvent event) {
        if (!diamondOre(event)) {
            return;
        }

        var storage = context.storage().player(event.player().uniqueId());
        int mined = storage.getInt(MiningStatsPlugin.DIAMONDS_MINED).orElse(0) + 1;
        storage.setInt(MiningStatsPlugin.DIAMONDS_MINED, mined);

        if (mined % 10 == 0) {
            event.player().sendMessage(Component.text("You have mined " + mined + " diamond ores"));
            storage.flush();
        }
    }

    private static boolean diamondOre(BlockBreakEvent event) {
        var key = event.blockType().key();
        return key.equals(BlockKey.DIAMOND_ORE.key())
                || key.equals(BlockKey.DEEPSLATE_DIAMOND_ORE.key());
    }
}
```

## MiningStatsCommand.java

```java
package com.example.mining;

import io.fand.api.command.CommandContext;
import io.fand.api.entity.Player;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

final class MiningStatsCommand {
    private final PluginContext context;

    MiningStatsCommand(PluginContext context) {
        this.context = context;
    }

    void execute(CommandContext command) {
        var sender = command.sender();
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("Only players can check their own stats"));
            return;
        }

        int mined = context.storage()
                .player(player.uniqueId())
                .getInt(MiningStatsPlugin.DIAMONDS_MINED)
                .orElse(0);
        player.sendMessage(Component.text("You have mined " + mined + " diamond ores"));
    }
}
```

The example uses generated `BlockKey.DIAMOND_ORE` and `BlockKey.DEEPSLATE_DIAMOND_ORE` instead of hard-coded block ids. That lets the compiler catch missing generated constants.

## Next Improvements

- Count more ores with a `Map<Key, Integer>` or JSON object.
- Flush on player quit or on a repeating task instead of frequent disk writes.
- Add a leaderboard command.
- Decide whether cancelled block breaks should count for your plugin.
