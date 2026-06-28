# Loot Tables

`LootTableService` looks up, generates, and replaces loot tables. Replacements registered through `context.lootTables()` use the current plugin namespace and are cleaned up when the plugin unloads.

```java
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.loot.LootContext;
import java.util.List;
import net.kyori.adventure.key.Key;

context.lootTables().replace(Key.key("example:training_reward"), loot -> List.of(
        ItemTypes.of(ItemKey.EMERALD).stack(loot.luck() > 0 ? 3 : 1)));

var drops = context.lootTables().generate(
        Key.key("example:training_reward"),
        LootContext.empty());
```

Plugin scope rewrites keys to the plugin namespace. Use `Fand.server().lootTables()` for vanilla tables or global lookup.

## Lookup and Generation

```java
var table = Fand.server().lootTables().table(Key.key("minecraft:chests/simple_dungeon"));

var items = Fand.server().lootTables().generate(
        Key.key("minecraft:chests/simple_dungeon"),
        new LootContext(player.location(), player, 1.0F));
```

`LootContext` currently contains:

| Field | Meaning |
| --- | --- |
| `location` | Generation location; absent contexts fall back to a safe default |
| `killer` | Source entity; the current runtime maps player sources to vanilla damage parameters |
| `luck` | Luck bonus |

If a vanilla table requires parameters the context cannot provide, generation returns an empty list.

## Replacing a Table

```java
var registration = context.lootTables().replace(
        Key.key("example:daily_box"),
        loot -> List.of(
                ItemTypes.of(ItemKey.DIAMOND).stack(1),
                ItemTypes.of(ItemKey.EMERALD).stack(Math.max(1, (int) loot.luck() + 1))));

registration.close();
```

`replace(...)` is a runtime replacement. When vanilla generation asks for the same table key, Fand calls your `LootGenerator`. Static JSON loot is better handled through data-pack files.

## Design Rationale

Loot tables serve two different needs: static vanilla-style data and dynamic plugin-calculated rewards. `LootTableService.replace(...)` targets the dynamic case, where rewards depend on players, events, economy state, or other runtime data.

Plugin-scoped namespace rewriting keeps one plugin from accidentally replacing another plugin's rewards. Use the global server service when you intentionally want vanilla tables.

## Best Practices

- Use data-pack files for static loot and `replace(...)` for dynamic rewards.
- Keep `LootGenerator` fast; it can run during vanilla loot generation.
- Do not return empty stacks from generators; direct `generate(...)` calls return what the generator produced.
- Use `locationOptional()` and `killerOptional()` for missing context.
- Keep loot keys stable and put event logic in the generator.

## Common Pitfalls

- Generating `minecraft:*` tables through `context.lootTables()`; plugin scope rewrites the namespace.
- Expecting `replace(...)` to write JSON files.
- Doing database or network I/O inside a generator.
- Ignoring luck, killer, and location, making every player receive identical results.
- Passing `LootContext.empty()` to a vanilla table that requires specific parameters.

## Complete Example: Daily Reward Box

```java
package com.example;

import io.fand.api.entity.Player;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.loot.LootContext;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.util.List;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class DailyLootPlugin implements Plugin {
    private static final Key DAILY_BOX = Key.key("example:daily_box");

    @Override
    public void onEnable(PluginContext context) {
        context.lootTables().replace(DAILY_BOX, loot -> {
            var bonus = Math.max(0, (int) loot.luck());
            var reward = ItemTypes.of(ItemKey.EMERALD)
                    .stack(3 + bonus)
                    .withItemName(Component.text("Daily Reward"));
            return List.of(reward);
        });
    }

    public void giveDailyReward(PluginContext context, Player player) {
        var items = context.lootTables().generate(
                DAILY_BOX,
                new LootContext(player.location(), player, 1.0F));

        for (var item : items) {
            player.inventory().add(item);
        }
    }
}
```
