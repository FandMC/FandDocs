# Components

Fand has two component models that are easy to confuse:

| Model | API | Use |
| --- | --- | --- |
| Persistent data components | `DataComponentMap`, `DataComponentContainer`, `DataComponentKey<T>` | Fand persistent state on live objects such as blocks and entities |
| Item data components | `ItemComponents`, `ItemComponentKeys`, `ItemStack.with*` | Modern Minecraft item component patches |

Both use Adventure `Key` and JSON under the hood, but their semantics differ. Persistent components mean "these components exist now." Item components mean "apply these patches to vanilla default components."

## Persistent Component Containers

`DataComponentContainer` is the mutable live container on an object. `Block.components()`, `Entity.components()`, and `Player.components()` use this model.

```java
var ownerKey = DataComponentKey.uuid(Key.key("example:owner"));

block.components().set(ownerKey, player.uniqueId());

block.components().get(ownerKey)
        .ifPresent(owner -> context.logger().info("owner={}", owner));
```

`snapshot()` returns an immutable `DataComponentMap`. Later container changes do not mutate that snapshot.

```java
DataComponentMap snapshot = entity.components().snapshot();

if (snapshot.has(EntityComponentKeys.OWNER)) {
    context.logger().debug("owned entity");
}
```

## DataComponentKey

`DataComponentKey<T>` binds a key to serialization rules, so plugin code can read and write domain values instead of parsing JSON everywhere.

```java
public final class MachineComponents {
    public static final DataComponentKey<Integer> LEVEL =
            DataComponentKey.integer(Key.key("example:machine_level"));

    public static final DataComponentKey<String> MODE =
            DataComponentKey.string(Key.key("example:machine_mode"));

    private MachineComponents() {
    }
}
```

Built-in helpers include:

```java
DataComponentKey.json(key);
DataComponentKey.object(key);
DataComponentKey.string(key);
DataComponentKey.bool(key);
DataComponentKey.integer(key);
DataComponentKey.longValue(key);
DataComponentKey.doubleValue(key);
DataComponentKey.key(key);
DataComponentKey.uuid(key);
```

Use `DataComponentKey.of(...)` for custom complex objects.

```java
record HeatState(int heat, boolean active) {
}

static final DataComponentKey<HeatState> HEAT = DataComponentKey.of(
        Key.key("example:heat"),
        value -> {
            var json = new JsonObject();
            json.addProperty("heat", value.heat());
            json.addProperty("active", value.active());
            return json;
        },
        json -> {
            var object = json.getAsJsonObject();
            return new HeatState(
                    object.get("heat").getAsInt(),
                    object.get("active").getAsBoolean());
        });
```

## Built-In Block and Entity Components

Fand provides a small set of common keys. Plugins can define their own keys too.

Block components:

```java
BlockComponentKeys.CUSTOM_ID;
BlockComponentKeys.OWNER;
BlockComponentKeys.TICKING;
BlockComponentKeys.CUSTOM_DATA;
```

Entity components:

```java
EntityComponentKeys.CUSTOM_ID;
EntityComponentKeys.OWNER;
EntityComponentKeys.CUSTOM_DATA;
```

These keys support common custom-content and ownership cases. Gameplay plugins should still use their own namespaced keys, such as `myplugin:machine_level`.

## DataComponentMap

`DataComponentMap` is an immutable value object, useful for batch updates, templates, and snapshots.

```java
var components = DataComponentMap.empty()
        .with(MachineComponents.LEVEL, 3)
        .with(MachineComponents.MODE, "idle");

world.fillBlocks(min, max, type, components, options);
```

`apply(...)` overlays another map's values onto the current map. Since persistent components are not patches, `without(...)` means removing the key from this map.

```java
var updated = components
        .without(MachineComponents.MODE)
        .with(MachineComponents.LEVEL, 4);
```

## Item Component Patches

Items use `ItemComponents`, which has both `values` and `removals`. This mirrors vanilla item component patches.

```java
import io.fand.api.item.ItemKey;

var patch = ItemComponents.empty()
        .withInt(ItemComponentKeys.MAX_STACK_SIZE, 16)
        .withString(ItemComponentKeys.RARITY, "rare")
        .remove(ItemComponentKeys.TOOL);

var stack = ItemTypes.of(ItemKey.STICK).stack(8, patch);
```

On item stacks, prefer the typed `ItemStack` helpers:

```java
var item = ItemTypes.of(ItemKey.PAPER)
        .one()
        .withItemName(Component.text("Notice"))
        .withLore(Component.text("Line one"))
        .withCustomModelData(10);
```

`ItemComponentKeys.all()` enumerates the vanilla item component keys exposed by the current API.

## without vs remove

This is the easiest item-component mistake.

```java
stack.withoutComponent(ItemComponentKeys.RARITY);
stack.removeComponent(ItemComponentKeys.RARITY);
```

`withoutComponent(...)` removes the explicit override from this stack, allowing the item type's vanilla default component to show through again.

`removeComponent(...)` writes a removal, forcing the component to be absent even when the item type has a default.

Persistent components do not have this distinction. `DataComponentContainer.remove(...)` and `DataComponentMap.without(...)` both remove a Fand persistent component.

## JSON Boundaries

Values use Gson `JsonElement` underneath. Prefer `DataComponentKey` or `ItemStack` helpers for simple values instead of hand-written JSON strings.

```java
var customData = new JsonObject();
customData.addProperty("tier", 2);

var stack = ItemTypes.of(ItemKey.EMERALD)
        .one()
        .withCustomData(customData);
```

For config-loaded item component patches, use `ItemComponents.fromJsonPatch(...)`:

```java
var components = ItemComponents.fromJsonPatch("""
        {
          "minecraft:custom_model_data": { "floats": [12] },
          "!minecraft:tool": {}
        }
        """);
```

## Design Philosophy

Fand does not put every plugin value into one generic NBT string API. Components use key + codec so plugins can isolate data by namespace and expose readable public state to other plugins when needed.

Block and entity components are Fand's persistent data model, suited for "who owns this object" or "what state is this machine in." Item components stay close to vanilla because clients, recipes, combat, rendering, and packets understand vanilla item components.

`DataComponentKey<T>` keeps serialization errors near the key definition instead of repeating JSON parsing at every read site.

## Best Practices

- Use your plugin id as the namespace for custom keys, such as `example:machine_level`.
- Prefer `DataComponentKey.integer/string/bool/uuid` for simple values.
- Define complex codecs in one place; business code should read and write domain types.
- Prefer typed `ItemStack.with*` methods for display, enchantments, durability, food, and common item behavior.
- Touch `ItemComponents` directly only for generic patches, config imports, or newly exposed components without helpers.
- Do not use components as a large database; store ids, state, and small JSON payloads.

## Common Pitfalls

- Confusing Adventure text `Component` with Fand data components. They are different concepts.
- Treating `DataComponentMap` as a live container. It is a snapshot or value object.
- Forgetting that `ItemComponents` is a patch model and mixing up `without` and `remove`.
- Storing plugin-private data in the `minecraft` namespace, colliding with vanilla or other plugin semantics.
- Reading or writing live `DataComponentContainer` from async threads. Build data asynchronously, then write to live objects on the server thread.

## Complete Example: Store Machine Level and Owner on a Block

This example defines two component keys, writes machine state to a block, and reads it when a player inspects the block.

```java
package com.example;

import io.fand.api.block.Block;
import io.fand.api.component.DataComponentKey;
import io.fand.api.entity.Player;
import java.util.UUID;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class MachineState {
    private static final DataComponentKey<Integer> LEVEL =
            DataComponentKey.integer(Key.key("example:machine_level"));
    private static final DataComponentKey<UUID> OWNER =
            DataComponentKey.uuid(Key.key("example:machine_owner"));

    public void create(Block block, Player owner) {
        block.components().set(LEVEL, 1);
        block.components().set(OWNER, owner.uniqueId());
    }

    public void inspect(Block block, Player viewer) {
        var components = block.components();
        int level = components.get(LEVEL).orElse(0);
        boolean ownedByViewer = components.get(OWNER)
                .filter(owner -> owner.equals(viewer.uniqueId()))
                .isPresent();

        viewer.sendMessage(Component.text(
                "Machine level " + level + (ownedByViewer ? " (yours)" : "")));
    }

    public void upgrade(Block block) {
        int nextLevel = block.components().get(LEVEL).orElse(0) + 1;
        block.components().set(LEVEL, nextLevel);
    }
}
```
