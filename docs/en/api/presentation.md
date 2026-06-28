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

## Guidelines

- Boss bars fit progress, short notices, and combat state; use Scoreboard or packet helpers for richer HUDs.
- TabList is per-viewer; the same target can appear differently to different viewers.
- Do not perform expensive lookups in map render loops; cache the data you need to draw.
- Document APIs that persistently mutate world or map state for server owners.
