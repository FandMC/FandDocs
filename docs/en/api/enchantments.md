# Enchantments

`EnchantmentRegistry` looks up and registers custom enchantments. Enchantments registered through `context.enchantments()` are scoped to the current plugin namespace and cleaned up when the plugin unloads.

```java
import io.fand.api.enchantment.CustomEnchantment;
import io.fand.api.enchantment.EnchantmentCost;
import io.fand.api.enchantment.EnchantmentDefinition;
import io.fand.api.enchantment.EnchantmentSlotGroup;
import io.fand.api.item.ItemTagKey;
import io.fand.api.registry.RegistryReference;
import java.util.List;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

var definition = EnchantmentDefinition.builder()
        .supportedItems(List.of(RegistryReference.tag(ItemTagKey.SWORDS.key())))
        .primaryItems(List.of(RegistryReference.tag(ItemTagKey.SWORDS.key())))
        .weight(5)
        .maxLevel(3)
        .minCost(EnchantmentCost.dynamic(5, 8))
        .maxCost(EnchantmentCost.dynamic(25, 8))
        .anvilCost(4)
        .slots(List.of(EnchantmentSlotGroup.MAINHAND))
        .build();

context.enchantments().register(new CustomEnchantment(
        Key.key("example:training_edge"),
        Component.text("Training Edge"),
        definition,
        io.fand.api.enchantment.EnchantmentEffects.empty(),
        List.of()));
```

Plugin scope rewrites the key to the plugin namespace. Use `Fand.server().enchantments()` to read vanilla or other plugin enchantments.

## Lookup

```java
var local = context.enchantments().enchantment(Key.key("example:training_edge"));
var sharpness = Fand.server().enchantments()
        .enchantment(io.fand.api.item.component.EnchantmentKey.SHARPNESS.key());
```

`EnchantmentView` exposes the key, description, max level, definition, effects, and exclusive set. Vanilla enchantments can also be read through the global registry.

## Definition

`EnchantmentDefinition` describes supported items and enchantment-table/anvil behavior:

| Field | Meaning |
| --- | --- |
| `supportedItems` | Supported items or tags; required |
| `primaryItems` | Preferred enchantment table item set |
| `weight` | Weight, `1..1024` |
| `maxLevel` | Max level, `1..255` |
| `minCost` / `maxCost` | Enchantment cost range |
| `anvilCost` | Anvil cost |
| `slots` | Equipment slot groups where the enchantment applies |

`RegistryReference.key(...)` references one registry entry, while `RegistryReference.tag(...)` references a tag. Prefer generated `ItemTagKey` constants for fixed vanilla tags.

## Effects

`EnchantmentEffects` wraps modern Minecraft enchantment effect components. Simple effects can use the builder; uncommon or newly-added vanilla effects can use raw JSON.

```java
import io.fand.api.enchantment.EnchantmentEffects;
import io.fand.api.enchantment.EnchantmentLevelValue;
import io.fand.api.enchantment.EnchantmentValueEffect;

var effects = EnchantmentEffects.builder()
        .damage(EnchantmentValueEffect.add(EnchantmentLevelValue.perLevel(1.0F)))
        .build();
```

For existing vanilla JSON:

```java
var effects = EnchantmentEffects.raw(rawJsonObject);
```

That escape hatch is intentional; Minecraft's enchantment model is data-driven and not every detail needs a bespoke Java wrapper.

## Enchanting Items

Registering an enchantment and writing an enchantment onto an item are separate operations:

```java
var registration = context.enchantments().register(customEnchantment);
var enchantmentKey = registration.key();

var sword = io.fand.api.item.ItemTypes.of(io.fand.api.item.ItemKey.DIAMOND_SWORD)
        .one()
        .withEnchantment(enchantmentKey, 2);
```

Usually you register the enchantment in `onEnable` before handing out items that reference it. When registering through `context.enchantments()`, write the final key returned by `EnchantmentRegistration.key()` onto the item.

## Design Rationale

Modern Minecraft enchantments are data-driven: definition, exclusive sets, effect components, conditions, and slot groups all matter. Fand keeps that structure visible instead of reducing enchantments to a legacy "damage plus level" model.

Typed builders cover common cases, and raw JSON keeps the API ready for newer vanilla behavior.

## Best Practices

- Register custom enchantments in `onEnable` before creating items that use them.
- Use `ItemTagKey` for fixed item groups such as swords or armor.
- Avoid `RegistryReference.all()` unless every item really should support the enchantment.
- Use the effects builder for simple numeric effects; centralize raw JSON for advanced effects.
- Keep custom enchantment keys stable once released.

## Common Pitfalls

- Confusing registry registration with item component mutation.
- Looking up vanilla enchantments through `context.enchantments()` instead of the global server registry.
- Creating a definition with empty supported items or empty slots.
- Using out-of-range max level, weight, or anvil cost values.
- Making an enchantment apply to all items by accident.

## Complete Example: Training Sword Enchantment

```java
package com.example;

import io.fand.api.enchantment.CustomEnchantment;
import io.fand.api.enchantment.EnchantmentCost;
import io.fand.api.enchantment.EnchantmentDefinition;
import io.fand.api.enchantment.EnchantmentEffects;
import io.fand.api.enchantment.EnchantmentLevelValue;
import io.fand.api.enchantment.EnchantmentSlotGroup;
import io.fand.api.enchantment.EnchantmentValueEffect;
import io.fand.api.entity.Player;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTagKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import io.fand.api.registry.RegistryReference;
import java.util.List;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class TrainingEnchantPlugin implements Plugin {
    private static final Key TRAINING_EDGE = Key.key("example:training_edge");
    private Key registeredTrainingEdge = TRAINING_EDGE;

    @Override
    public void onEnable(PluginContext context) {
        var definition = EnchantmentDefinition.builder()
                .supportedItems(List.of(RegistryReference.tag(ItemTagKey.SWORDS.key())))
                .primaryItems(List.of(RegistryReference.tag(ItemTagKey.SWORDS.key())))
                .weight(5)
                .maxLevel(3)
                .minCost(EnchantmentCost.dynamic(5, 8))
                .maxCost(EnchantmentCost.dynamic(25, 8))
                .anvilCost(4)
                .slots(List.of(EnchantmentSlotGroup.MAINHAND))
                .build();

        var effects = EnchantmentEffects.builder()
                .damage(EnchantmentValueEffect.add(EnchantmentLevelValue.perLevel(1.0F)))
                .build();

        registeredTrainingEdge = context.enchantments().register(new CustomEnchantment(
                TRAINING_EDGE,
                Component.text("Training Edge"),
                definition,
                effects,
                List.of())).key();
    }

    public void giveSword(Player player) {
        var sword = ItemTypes.of(ItemKey.DIAMOND_SWORD)
                .one()
                .withItemName(Component.text("Training Sword"))
                .withEnchantment(registeredTrainingEdge, 2);

        player.inventory().add(sword);
    }
}
```
