# Blocks

`Block` is a lightweight handle to an integer block position inside a `World`. It is not a block-state snapshot: `type()`, `fluidState()`, `stateProperties()`, and `blockEntity()` read live state at that position, while `setType(...)`, `setStateProperty(...)`, `setFluid(...)`, and `breakNaturally(...)` mutate the world.

```java
var block = player.world().blockAt(
        player.location().blockX(),
        player.location().blockY() - 1,
        player.location().blockZ());

if (block.type().key().asString().equals("minecraft:grass_block")) {
    block.setType(BlockTypes.of("minecraft:gold_block"));
}
```

## Block and BlockType

`BlockType` is a registry type such as `minecraft:stone`. `Block` is a position in a world. Multiple `Block` handles may point at the same position; the world is read when you access live state.

```java
import io.fand.api.block.BlockTypes;

var stone = BlockTypes.of("minecraft:stone");
var block = world.blockAt(0, 64, 0);

block.setType(stone);
```

Use `BlockTypes.find(...)` when you only want to query whether a type exists:

```java
BlockTypes.find(Key.key("minecraft:deepslate"))
        .ifPresent(type -> context.logger().info("found {}", type.key()));
```

## Coordinates and Neighbors

`Block` exposes integer coordinates. `relative(...)` returns neighboring positions by `BlockFace` or by offset.

```java
var clicked = event.block();
var above = clicked.relative(BlockFace.UP);

if (above.air()) {
    above.setType(BlockTypes.of("minecraft:torch"));
}
```

`relative(int dx, int dy, int dz)` uses `Math.addExact`; extreme coordinate overflow throws instead of silently wrapping.

## Physics

`BlockType.physics()` describes the default state for a type. `Block.physics()` describes the live state at this world position. For stateful blocks, those can differ.

```java
var physics = block.physics();

if (physics.solid() && !physics.air()) {
    context.logger().debug(
            "hardness={} light={}",
            physics.hardness(),
            physics.lightEmission());
}
```

Common helpers include:

```java
block.air();
block.solid();
block.replaceable();
block.flammable();
block.requiresTool();
block.hasBlockEntity();
block.lightEmission();
```

## Block State Properties

Vanilla block-state properties are exposed as `propertyName -> valueName`, such as stair facing, door half, crop age, or waterlogged state.

```java
var facing = block.stateProperty("facing").orElse("unknown");

if (block.setStateProperty("facing", "north")) {
    context.logger().debug("rotated block");
}
```

`setStateProperty(name, value)` returns `false` when the property or value does not exist for the current block state. It does not decide whether the change makes gameplay sense; it only attempts to update the current block state.

## Fluids

`fluidState()` returns the fluid occupying this position. Helpers detect water, lava, source fluids, flowing fluids, and full fluids.

```java
if (block.water() && block.sourceFluid()) {
    block.clearFluid();
}

block.setFluid(FluidTypes.water(true));
```

The runtime applies fluid and block-state interactions according to vanilla semantics. Results can differ between waterloggable blocks, air, lava, and other states.

## Block Entities

`blockEntity()` returns the live block entity at this position, such as a chest, furnace, sign, or spawner.

```java
block.blockEntity().ifPresent(entity -> {
    context.logger().info("block entity type={}", entity.type());
});
```

More specific block entity interfaces live in `io.fand.api.block`, such as `ContainerBlockEntity`, `FurnaceBlockEntity`, and `SignBlockEntity`. Check the type before using a specialized interface.

## Drops and Natural Breaking

`drops()` queries block drops. `breakNaturally(...)` uses the vanilla break flow and can optionally spawn drops.

```java
var drops = block.drops(tool);

if (block.breakNaturally(false)) {
    drops.forEach(item -> block.world().dropItem(
            block.world().at(block.x() + 0.5, block.y() + 0.5, block.z() + 0.5),
            item));
}
```

For many block changes, do not loop over `setType`. Prefer world batch APIs; see [Worlds](/en/api/worlds).

## Block Components

`components()` is Fand's persistent component container attached to a block position. It fits custom blocks, machine state, and block-level plugin markers.

```java
var components = block.components();
// components.set(MyKeys.MACHINE_LEVEL, 3);
```

Component data is stored with world data. When a block is replaced or broken through Fand APIs or player actions, related components are cleaned up by runtime rules.

## Design Philosophy

Fand models `Block` as a position handle, not a one-time snapshot, so plugin code clearly expresses "read or mutate the current state at this position." That fits dynamic worlds better than long-lived state objects that may become stale.

Separating `BlockType` from `Block` distinguishes "a registry type" from "a world position." Types are reusable; position handles read the current world.

Block-state properties use strings to expose vanilla's generic state system without generating a dedicated Java API for every block. Plugins that need stricter gameplay rules can wrap this with their own small helpers.

## Best Practices

- Use `block.setType(...)` for one position and `world.setBlocks(...)`, `fillBlocks(...)`, or `replaceBlocks(...)` for large regions.
- Store world key and coordinates instead of keeping a long-lived `Block` handle.
- Check `stateProperties()` or handle `false` before relying on state-property changes.
- Use block components for your own persistent block state, not as a replacement for every vanilla block entity.
- When you need controlled drops, call `drops(tool)` first, then decide whether to `breakNaturally(...)` or drop items yourself.

## Common Pitfalls

- `Block` is not a snapshot. If you keep it for a long time, the position may now contain another block.
- `BlockType.physics()` is for the default state; `Block.physics()` is for the live state.
- GUI item-slot behavior has nothing to do with real block mutation; use `Block` or `World` APIs.
- `setStateProperty` returning `false` is not an exception. It usually means the property name or value is not valid for the current block.
- Looping over many `setType` calls can pressure ticks. Use batch APIs and limit changes per tick.

## Complete Example: Replace a Block and Preserve Drops

This example replaces the block below a player with glass. If the original block is not air, it computes drops with a tool and spawns them at the block center.

```java
package com.example;

import io.fand.api.block.Block;
import io.fand.api.block.BlockTypes;
import io.fand.api.entity.Player;
import io.fand.api.item.ItemStack;
import io.fand.api.plugin.PluginContext;

public final class BlockTools {
    private final PluginContext context;

    public BlockTools(PluginContext context) {
        this.context = context;
    }

    public void replaceBelow(Player player, ItemStack tool) {
        var location = player.location();
        Block block = player.world().blockAt(
                location.blockX(),
                location.blockY() - 1,
                location.blockZ());

        if (block.air()) {
            player.sendMessage(net.kyori.adventure.text.Component.text("Nothing to replace"));
            return;
        }

        var drops = block.drops(tool);
        if (!block.setType(BlockTypes.of("minecraft:glass"))) {
            player.sendMessage(net.kyori.adventure.text.Component.text("Block change failed"));
            return;
        }

        var dropLocation = block.world().at(block.x() + 0.5, block.y() + 0.5, block.z() + 0.5);
        drops.forEach(item -> block.world().dropItem(dropLocation, item));
        context.logger().debug("Replaced block at {},{},{}", block.x(), block.y(), block.z());
    }
}
```
