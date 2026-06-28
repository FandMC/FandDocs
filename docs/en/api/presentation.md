# Player Presentation

This page covers BossBar, TabList, and Map APIs. They all control what players see: boss bars at the top of the screen, per-viewer player lists, and map pixels/cursors.

## Boss Bars

There are two common forms: register a keyed boss bar, or send a temporary boss bar for a duration.

```java
import java.time.Duration;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

var bar = context.bossBars().register(
        Key.key("example-plugin:countdown"),
        Component.text("Starting"),
        1.0f,
        BossBar.Color.GREEN,
        BossBar.Overlay.PROGRESS);

bar.show(player);
bar.setProgress(0.5f);
bar.setTitle(Component.text("Half way"));
```

Temporary send:

```java
context.bossBars().send(
        player,
        Component.text("Saved"),
        1.0f,
        BossBar.Color.BLUE,
        BossBar.Overlay.PROGRESS,
        Duration.ofSeconds(3));
```

`BossBarRegistration.close()` hides and removes the keyed bar. Plugin-scoped registrations are cleaned up when the plugin is disabled.

## TabList Visibility

The basic `TabListService` operation controls which target one viewer sees.

```java
context.tabLists().setVisible(viewer, target, false);
context.tabLists().setVisible(viewer, target, true);

context.tabLists().showOnly(viewer, List.of(viewer, teammate));
```

`showOnly` updates the viewer's player-list visibility according to the active runtime implementation. On plugin unload, the plugin-scoped wrapper cleans up tracked entries and recoverable state.

## Virtual TabList Rows

`TabListEntry` can describe real players, virtual rows, or remote players mirrored from another server.

```java
import io.fand.api.entity.GameMode;
import io.fand.api.tablist.TabListEntry;
import java.util.UUID;

var entry = TabListEntry.builder(UUID.randomUUID(), "Lobby-1")
        .displayName(Component.text("Lobby-1: 42 players"))
        .latency(20)
        .gameMode(GameMode.SURVIVAL)
        .order(100)
        .build();

context.tabLists().add(viewer, entry);
context.tabLists().update(viewer, entry.withLatency(10));
context.tabLists().remove(viewer, entry.profile().uniqueId());
```

`TabListGroup` and `TabListLayout` can convert a set of players into sorted entries:

```java
var group = TabListGroup.of(player -> player.hasPermission("example.staff"))
        .withOrder(Comparator.comparing(Player::name))
        .withOrderBase(0);

context.tabLists().apply(viewer, TabListLayout.from(group, Fand.server().players()));
```

`TabListSyncStrategy` is for proxies or clusters that publish remote player-list rows for one viewer.

## Map Rendering

Maps are 128x128 pixel canvases. `MapRenderer` writes color indices; `PlayerMapRenderer` can render different output per viewer.

```java
var map = context.maps().create((view, canvas) -> {
    canvas.clear((byte) 0);
    for (int x = 0; x < MapCanvas.WIDTH; x++) {
        canvas.pixel(x, 64, (byte) 34);
    }
});

map.render();
map.sendUpdate(player);
```

Existing maps can be queried by id:

```java
context.maps().map(mapId).ifPresent(view -> {
    view.renderer(renderer);
    view.render(player);
});
```

## Persistent Map State

Renderers are plugin-scoped resources. Map center, scale, tracking, locked state, and cursors are underlying map state; changing them is not a temporary UI operation automatically reverted on plugin unload.

```java
view.setCenter(player.location().blockX(), player.location().blockZ());
view.setScale(MapScale.NORMAL);
view.setLocked(true);
```

For temporary presentation, prefer renderer output and per-player render/update. Use state methods when you intentionally want to modify the real map data.

## Design Philosophy

BossBar, TabList, and Map APIs all control what players see, but their lifecycles are different. A boss bar is a keyed UI resource shown to one or more players. TabList is per-viewer player-list state. A map renderer controls pixel output while underlying map state remains separate.

TabList takes `viewer` first to make "who sees what" explicit. The same real player, remote player, or virtual row can have different latency, ordering, display name, and visibility for different viewers.

Map APIs separate renderer output from center, scale, tracking, locked state, and cursors because renderer output is closer to temporary presentation, while the latter are underlying map state. Plugin unload can clean up renderers, but it cannot pretend persistent map state was never changed.

## Best Practices

- Boss bars fit progress, short notices, and combat state; use Scoreboard or packet helpers for richer HUDs.
- TabList is per-viewer; the same target can appear differently to different viewers.
- Do not perform expensive lookups in map render loops; cache the data you need to draw.
- Document APIs that persistently mutate world or map state for server owners.
- Use keyed BossBars for long-lived state and `send(..., duration)` for short notices.
- Use stable UUIDs for virtual TabList rows and update the same row with `update`.
- Prefer renderer output and per-player render/update for temporary map presentation.

## Common Pitfalls

- BossBar progress should stay within the range Adventure accepts; business code usually clamps it to `0.0f` through `1.0f`.
- TabList operations are per-viewer. Adding a virtual row for one viewer does not show it to everyone.
- `showOnly` changes real player-list visibility and should be restored when the arena or session ends.
- Map center, scale, tracking, locked state, and cursors are underlying map state and are not automatically rolled back on plugin unload.
- Maps are 128x128 canvases; out-of-bounds or expensive per-pixel work can make rendering slow.

## Complete Example: Countdown BossBar and Lobby Tab Row

This example shows a countdown boss bar and adds a virtual lobby-status row to one viewer's tab list.

```java
package com.example;

import io.fand.api.entity.GameMode;
import io.fand.api.entity.Player;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import io.fand.api.tablist.TabListEntry;
import java.util.UUID;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    private static final UUID LOBBY_ROW_ID = UUID.fromString("00000000-0000-0000-0000-000000000101");

    @Override
    public void onEnable(PluginContext context) {
        context.bossBars().register(
                Key.key("example:countdown"),
                Component.text("Starting soon"),
                1.0f,
                BossBar.Color.GREEN,
                BossBar.Overlay.PROGRESS);
    }

    public void showLobbyState(PluginContext context, Player viewer, int secondsLeft, int online) {
        context.bossBars().bar(Key.key("example:countdown")).ifPresent(bar -> {
            bar.show(viewer);
            bar.setTitle(Component.text("Starting in " + secondsLeft + "s"));
            bar.setProgress(Math.max(0.0f, Math.min(1.0f, secondsLeft / 30.0f)));
        });

        var entry = TabListEntry.builder(LOBBY_ROW_ID, "Lobby")
                .displayName(Component.text("Lobby online: " + online))
                .gameMode(GameMode.SURVIVAL)
                .latency(0)
                .order(100)
                .build();

        context.tabLists().update(viewer, entry);
    }
}
```
