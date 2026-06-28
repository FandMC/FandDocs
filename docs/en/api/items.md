# Items

Fand's item model has three layers: `ItemType` is the registry item type, `ItemStack` is an immutable item stack, and `ItemComponents` is a modern Minecraft item data-component patch.

```java
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import net.kyori.adventure.text.Component;

var diamond = ItemTypes.of(ItemKey.DIAMOND)
        .stack(3)
        .withCustomName(Component.text("Prize Diamond"));
```

`ItemStack` never mutates in place. Every `with*`, `without*`, and `remove*` method returns a new `ItemStack`. Use the returned value before writing the item back to an inventory, event, or entity.

## ItemType and ItemStack

`ItemType` is a registry type. For fixed vanilla items, prefer generated `ItemKey` constants such as `ItemKey.STONE` and `ItemKey.DIAMOND_SWORD`. Use raw string ids only for runtime data such as config files, player input, or external storage.

```java
var type = ItemTypes.of(ItemKey.DIAMOND_SWORD);
var stack = type.one();
var maybeApple = ItemTypes.find(ItemKey.APPLE);
```

`ItemTypes.of(...)` throws `NoSuchElementException` when the type is unknown. Prefer `find(Key.key(rawId))` for config files, player input, or cross-version data. Use `ItemKey` for internal fixed vanilla constants.

`ItemStack.EMPTY` is the empty-stack sentinel. Fand inventories and events do not use `null` for empty slots.

```java
if (stack.isEmpty()) {
    return;
}

var amount = stack.amount();
var max = stack.maxStackSize();
```

Non-empty stack amounts must be in `1..maxStackSize()`. `withMaxStackSize(...)` can override the max stack size through a data component, but the value must be in `1..99`.

## Names, Lore, and Models

Display text uses Adventure `Component`, matching messages, boss bars, GUI titles, and other Fand presentation APIs.

```java
var reward = ItemTypes.of(ItemKey.PAPER)
        .one()
        .withItemName(Component.text("Arena Ticket"))
        .withLore(
                Component.text("Right click to join"),
                Component.text("Season 1"))
        .withCustomModelData(1001)
        .withEnchantmentGlintOverride(true);
```

Common display components:

| Capability | Methods |
| --- | --- |
| Custom name | `customName()`, `withCustomName(...)`, `withoutCustomName()` |
| Item name | `itemName()`, `withItemName(...)`, `withoutItemName()` |
| Lore | `lore()`, `withLore(...)`, `addLoreLine(...)`, `withoutLore()` |
| Item model | `itemModel()`, `withItemModel(Key)`, `withoutItemModel()` |
| Custom model data | `customModelData()`, `withCustomModelData(...)`, `withoutCustomModelData()` |
| Glint override | `enchantmentGlintOverride()`, `withEnchantmentGlintOverride(...)` |
| Tooltip display | `withTooltipHidden(...)`, `withHiddenTooltipComponent(...)` |

`withCustomModelData(int)` writes the modern `minecraft:custom_model_data` `floats` list. Use `CustomModelData` when you need flags, strings, or colors.

## Enchantments, Durability, and Rarity

Enchantments use `ItemEnchantments`. Regular enchantments go into `minecraft:enchantments`; enchanted-book storage goes into `minecraft:stored_enchantments`.

```java
import io.fand.api.item.component.EnchantmentKey;

var sword = ItemTypes.of(ItemKey.DIAMOND_SWORD)
        .one()
        .withEnchantment(EnchantmentKey.SHARPNESS, 5)
        .withUnbreakable(true)
        .withRarity(ItemRarity.RARE);
```

`withEnchantment(...)` sets the level. `upgradeEnchantment(...)` only updates when the new level is higher. Levels must be in `1..255`.

Durability-related methods:

```java
stack.damage();
stack.withDamage(12);
stack.maxDamage();
stack.withMaxDamage(250);
stack.withUnbreakable(true);
stack.withRepairCost(3);
```

`damage` and `repairCost` cannot be negative, and `maxDamage` must be at least `1`.

## Food, Use, and Equipment Behavior

Fand provides typed value objects for many vanilla components, including `ItemFood`, `ItemConsumable`, `ItemUseCooldown`, `ItemTool`, `ItemWeapon`, `ItemEquippable`, and `ItemAttributeModifiers`.

```java
import io.fand.api.item.component.ItemConsumable;
import io.fand.api.item.component.ItemFood;
import io.fand.api.item.component.ItemUseAnimation;
import io.fand.api.world.sound.SoundKey;

var snack = ItemTypes.of(ItemKey.COOKIE)
        .one()
        .withFood(new ItemFood(6, 0.8F, true))
        .withConsumable(new ItemConsumable(
                1.0F,
                ItemUseAnimation.EAT,
                SoundKey.GENERIC_EAT,
                true,
                List.of()));
```

These methods describe item components. Client presentation, server consumption, and attribute resolution still follow the active Minecraft runtime rules.

## Persistent Data and Custom Items

Use `PersistentDataContainer` or `CustomItemRegistry` for plugin-owned item identity. Do not write into another plugin's namespace.

```java
var key = Key.key("example:token_owner");

var tagged = ItemTypes.of(ItemKey.EMERALD)
        .one()
        .withPersistentData(key, new JsonPrimitive(player.uniqueId().toString()));

tagged.persistentData().getString(key)
        .ifPresent(owner -> context.logger().info("owner={}", owner));
```

`PersistentDataContainer` lives inside the `minecraft:custom_data` component. It is immutable, so you still need to write the new `ItemStack` back after modifying it.

Custom item registration stores a custom id in item custom data. On the wire, the item is still a vanilla stack.

```java
var template = ItemTypes.of(ItemKey.PAPER)
        .one()
        .withItemName(Component.text("Vote Token"))
        .withCustomModelData(2001);

context.customItems().register(CustomItemType.of(
        Key.key("example:vote_token"),
        template));

var token = context.customItems().create(Key.key("example:vote_token"), 1);
```

`customItems().customId(stack)` identifies whether a stack carries a registered custom item id. Custom item registrations made through `PluginContext` are tracked for cleanup when the plugin is disabled; item data already in inventories or the world is not automatically removed.

## Inventories, Drops, and Entities

Access player inventories through `Player.inventory()`. Slot indices are zero-based, and empty slots return `ItemStack.EMPTY`.

```java
var inventory = player.inventory();
var leftover = inventory.add(reward);

if (!leftover.isEmpty()) {
    player.world().dropItem(player.location(), leftover);
}
```

Main hand, off hand, and armor slots have dedicated helpers:

```java
var held = player.inventory().heldItem();
player.inventory().setHeldItem(held.withCustomName(Component.text("Bound Tool")));
player.inventory().setOffhandItem(ItemStack.EMPTY);
```

Use `World.dropItem(...)` for world drops:

```java
world.dropItem(location, ItemTypes.of(ItemKey.DIAMOND), 1);
world.dropItem(location, stack);
```

The runtime marshals these operations to the server thread and returns a `CompletableFuture`.

## Item Events

Items appear in player interaction, inventory, drop, pickup, consume, durability, crafting, smelting, and trading events.

```java
context.events().subscribe(PlayerDropItemEvent.class, event -> {
    if (context.customItems().customId(event.item())
            .filter(id -> id.equals(Key.key("example:vote_token")))
            .isPresent()) {
        event.setCancelled(true);
    }
});
```

Some events allow replacing the item, such as `PlayerDropItemEvent#setItem(...)`, `EntityPickupItemEvent#setItem(...)`, and `InventoryMoveItemEvent#setItem(...)`. Other events expose a read-only item; cancel the event and apply your own follow-up logic when you need replacement behavior.

## Design Philosophy

Since Minecraft 1.20.5, item data has moved from the old NBT/meta model to data components. Fand exposes that model directly instead of rebuilding it as an old `ItemMeta` style API.

`ItemStack` is immutable to avoid "I read this item and something else mutated it" surprises. Inventories, events, and entities are live state; item stacks themselves are safe values to pass around.

`ItemComponents` uses a patch model because vanilla item serialization distinguishes "set this component", "remove this default component", and "do not touch this default component." That is why `withoutComponent(...)` and `removeComponent(...)` have different meanings.

## Best Practices

- Use generated `ItemKey` constants for fixed vanilla items instead of hard-coded `"minecraft:..."` item ids.
- Use `ItemTypes.find(Key.key(rawId))` for config, player input, and cross-version data.
- Always keep the returned `ItemStack` after calling a `with*` method.
- Use `ItemStack.EMPTY` or `isEmpty()` for empty slots, not `null`.
- Use `PersistentDataContainer` for plugin-private data and `CustomItemRegistry` for ecosystem-visible custom identity.
- Document resource-pack expectations when using `item_model` or `custom_model_data`.
- When giving many items, call `Inventory.add(...)` first and handle the leftover stack.

## Common Pitfalls

- Calling `stack.withCustomName(...)` without assigning the returned value; no item changes.
- Treating `withoutComponent(...)` as forced removal of a default component. Use `removeComponent(...)` for that.
- Hard-coding fixed item ids such as `"minecraft:<id>"`, bypassing Fand's generated keys and compile-time checks.
- Mutating player inventories directly from async tasks. Build item values asynchronously, then return to the server thread to write them.
- Treating custom item registration as item deletion. Registration cleanup does not remove item data already in circulation.
- Assuming `Inventory.add(...)` always fits the whole stack; it returns leftovers.

## Complete Example: Register and Give a Bound Reward

This example registers a custom item and exposes `giveReward(...)` for commands or events. If the inventory is full, the leftover item drops at the player's location.

```java
package com.example;

import com.google.gson.JsonPrimitive;
import io.fand.api.customitem.CustomItemType;
import io.fand.api.entity.Player;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemStack;
import io.fand.api.item.ItemTypes;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class RewardItems {
    private static final Key REWARD_ID = Key.key("example:arena_reward");
    private static final Key OWNER_KEY = Key.key("example:owner");

    private final PluginContext context;

    public RewardItems(PluginContext context) {
        this.context = context;
        context.customItems().register(CustomItemType.of(REWARD_ID, template()));
    }

    public void giveReward(Player player) {
        ItemStack reward = context.customItems()
                .create(REWARD_ID, 1)
                .withPersistentData(OWNER_KEY, new JsonPrimitive(player.uniqueId().toString()));

        var leftover = player.inventory().add(reward);
        if (!leftover.isEmpty()) {
            player.world().dropItem(player.location(), leftover);
        }

        player.sendMessage(Component.text("Reward received"));
    }

    private static ItemStack template() {
        return ItemTypes.of(ItemKey.PAPER)
                .one()
                .withItemName(Component.text("Arena Reward"))
                .withLore(Component.text("Bound when claimed"))
                .withCustomModelData(3001)
                .withEnchantmentGlintOverride(true);
    }
}
```
