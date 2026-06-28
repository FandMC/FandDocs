# Worlds

`World` represents a loaded server dimension. It is identified by a `Key`. For fixed vanilla dimensions, use generated `DimensionTypeKey` constants such as `DimensionTypeKey.OVERWORLD`, `DimensionTypeKey.NETHER`, and `DimensionTypeKey.END`; dynamically created worlds still use their own keys. `World` is also an Adventure `Audience` that forwards messages to players currently in that world.

```java
Fand.server().defaultWorld().ifPresent(world -> {
    world.sendMessage(Component.text("Hello overworld"));
});
```

## Looking Up Worlds

Global world access lives on `Fand.server()`:

```java
import io.fand.api.world.generation.DimensionTypeKey;

var worlds = Fand.server().worlds();
var overworld = Fand.server().world(DimensionTypeKey.OVERWORLD.key());
var defaultWorld = Fand.server().defaultWorld();
```

Plugin-owned registrations should still prefer `PluginContext`. World lookup is a global view, useful for broadcasts, locating players, creating/unloading dynamic worlds, or resolving world keys from configuration.

## Coordinates and Locations

`world.at(...)` creates an immutable `Location`. `world.blockAt(...)` returns a lazy `Block` position handle; real reads or writes happen when calling `block.type()`, `block.setType(...)`, and similar methods.

```java
import io.fand.api.block.BlockKey;

var spawn = world.at(0.5, 80.0, 0.5, 0.0f, 0.0f);
var block = world.blockAt(0, 79, 0);

if (block.air()) {
    block.setType(BlockTypes.of(BlockKey.STONE));
}
```

`Location.blockX()`, `blockY()`, and `blockZ()` floor coordinates, matching Minecraft block-coordinate behavior.

## Time, Weather, and Difficulty

World time, weather, and difficulty mutation methods return `CompletableFuture`. The runtime schedules the actual state mutation onto the server thread.

```java
world.setTime(6000);
world.setStorm(false);
world.setThundering(false);
world.setDifficulty(Difficulty.NORMAL);
```

These futures usually complete on the server thread. Keep callbacks that continue mutating world state short.

## World Border

`world.worldBorder()` returns live world border controls.

```java
var border = world.worldBorder();
border.setCenter(0.0, 0.0);
border.setSize(500.0, Duration.ofSeconds(30));
border.setWarningDistance(16);
```

Border changes affect real world state; they are not per-player temporary effects.

## Entity Queries

`World` can query loaded entities, entities of a type, nearby entities, entities in an axis-aligned box, nearest entities, and ray-traced entity hits.

```java
var center = player.location();

var nearby = world.nearbyEntities(center, 16.0);
var nearest = world.nearestEntity(center, 32.0);
var hit = world.rayTraceEntity(center, new Vector3(0.0, 0.0, 1.0), 16.0);
```

Returned collections are snapshots, not live collections. Entity queries only cover loaded entities; entities in unloaded chunks are not included.

## Chunks

Chunk coordinates are block coordinates shifted right by 4. `chunkAt(...)` returns a lazy handle. `loadChunk(...)`, `setChunkForceLoaded(...)`, and related methods marshal to the server thread.

```java
int chunkX = player.location().blockX() >> 4;
int chunkZ = player.location().blockZ() >> 4;

if (!world.chunkLoaded(chunkX, chunkZ)) {
    world.loadChunk(chunkX, chunkZ).thenAccept(loaded -> {
        context.logger().info("chunk loaded={}", loaded);
    });
}

var snapshot = world.chunkSnapshot(chunkX, chunkZ);
```

`unloadChunk(...)` clears forced-load state and requests that the chunk may unload. Players, tickets, or pending server work can still keep it loaded.

## Batch Block Changes

Large block changes should use batch APIs instead of loops around `Block.setType(...)`. `BlockBatchOptions` controls max changes per tick, update behavior, and skipping unchanged blocks.

```java
var min = world.at(-16, 64, -16);
var max = world.at(16, 70, 16);

world.fillBlocks(
        min,
        max,
        BlockTypes.of(BlockKey.GLASS),
        DataComponentMap.EMPTY,
        BlockBatchOptions.defaults().withMaxBlocksPerTick(2048))
        .thenAccept(result -> context.logger().info(
                "changed={} skipped={} failed={}",
                result.changed(),
                result.skipped(),
                result.failed()));
```

`BlockUpdateMode.NORMAL` notifies neighbors and clients. `CLIENTS_ONLY` fits structure pastes. `SILENT` suppresses notifications, making the caller responsible for follow-up refresh semantics.

## Scanning and Replacement

`scanBlocks(...)` can scan a `BlockRegion` over multiple ticks and apply changes returned by a `BlockTransform`. `replaceBlocks(...)` and `replaceConnectedBlocks(...)` are common shortcuts.

```java
var region = BlockRegion.cube(player.location(), 8);

world.replaceBlocks(
        region,
        type -> type.key().equals(BlockKey.STONE.key()),
        BlockTypes.of(BlockKey.DEEPSLATE),
        BlockScanOptions.defaults().withLoadedChunksOnly(true));
```

Default scans only process loaded chunks, avoiding accidental large-scale chunk loading.

## Effects and Spawning

Worlds can play sounds, spawn particles, drop items, spawn entities, strike lightning, and create explosions.

```java
import io.fand.api.item.ItemKey;
import io.fand.api.world.sound.SoundKey;

world.playSound(
        player.location(),
        SoundEffect.of(SoundKey.NOTE_BLOCK_PLING, SoundCategory.PLAYER));

world.dropItem(player.location(), ItemTypes.of(ItemKey.DIAMOND), 1);
world.strikeLightning(player.location(), true);
```

Methods that change world or entity state usually return `CompletableFuture` because the runtime must execute the operation on the server thread.

## Dynamic Worlds

`Fand.server().createWorld(...)` can create dynamic worlds from `WorldTemplate` or `WorldCreateOptions`. `unloadWorld(...)` unloads a world.

```java
Fand.server()
        .createWorld(Key.key("example:arena"), WorldTemplate.OVERWORLD)
        .thenAccept(world -> context.logger().info("created {}", world.key()));

Fand.server().unloadWorld(Key.key("example:arena"));
```

Dynamic worlds are global server state. Disabling a plugin does not automatically delete or unload worlds it created unless the plugin explicitly does that.

## Design Philosophy

`World` is a live handle to a loaded dimension, not a world configuration object. Player, entity, block, chunk, border, time, and weather operations all center on that domain object.

Many world-mutating operations return `CompletableFuture` to make thread boundaries explicit. Calls may originate from plugin logic, events, or async phases, while the actual Minecraft state mutation is scheduled by the runtime.

Batch block and scan APIs exist so plugins do not push large region edits into a single tick through simple loops. Fand exposes per-tick limits and update modes as options so plugins can choose a performance/consistency tradeoff.

## Best Practices

- Store world keys in configuration and resolve them with `Fand.server().world(key)` when needed.
- Use `world.blockAt(...)` for small immediate operations and batch/scan APIs for large edits.
- Keep large scans on `loadedChunksOnly(true)` unless you explicitly want to load or generate chunks.
- Keep future callbacks short when they continue mutating world state.
- Dynamic worlds, force-loaded chunks, and world unloads are global state; give them explicit cleanup policy.
- For effects only one player should see, prefer per-viewer APIs such as packet illusions, BossBars, or Map renderers.

## Common Pitfalls

- `World` only represents loaded worlds. A configured key may not resolve to a loaded world.
- `unloadChunk(...)` does not guarantee immediate unload; it only allows the chunk to unload.
- Entity queries only cover loaded entities.
- `fillBlocks(...)` uses an inclusive cuboid.
- `BlockBatchOptions.immediate()` can change many blocks in one tick; use it only when the size is known and acceptable.
- Dynamic worlds are not plugin-scoped temporary resources. Decide when your plugin should unload them.

## Complete Example: Create an Arena and Place a Floor

This example creates a void world, loads the center chunk, places a glass platform, and teleports the player there.

```java
package com.example;

import io.fand.api.Fand;
import io.fand.api.block.BlockKey;
import io.fand.api.block.BlockTypes;
import io.fand.api.component.DataComponentMap;
import io.fand.api.entity.Player;
import io.fand.api.plugin.PluginContext;
import io.fand.api.world.BlockBatchOptions;
import io.fand.api.world.WorldCreateOptions;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class ArenaWorlds {
    private final PluginContext context;

    public ArenaWorlds(PluginContext context) {
        this.context = context;
    }

    public void createAndEnter(Player player) {
        var key = Key.key("example:arena");

        Fand.server().createWorld(key, WorldCreateOptions.voidWorld())
                .thenCompose(world -> world.loadChunk(0, 0).thenApply(loaded -> world))
                .thenCompose(world -> {
                    var min = world.at(-8, 64, -8);
                    var max = world.at(8, 64, 8);
                    return world.fillBlocks(
                            min,
                            max,
                            BlockTypes.of(BlockKey.GLASS),
                            DataComponentMap.EMPTY,
                            BlockBatchOptions.defaults())
                            .thenApply(result -> world);
                })
                .thenAccept(world -> {
                    player.teleport(world.at(0.5, 65.0, 0.5));
                    player.sendMessage(Component.text("Arena ready"));
                })
                .exceptionally(failure -> {
                    context.logger().warn("Failed to create arena", failure);
                    player.sendMessage(Component.text("Arena creation failed"));
                    return null;
                });
    }
}
```
