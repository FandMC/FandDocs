# Advancements

`AdvancementRegistry` looks up and registers custom advancements. Advancements registered through `context.advancements()` are scoped to the current plugin namespace and cleaned up when the plugin unloads.

```java
import io.fand.api.advancement.AdvancementCriterion;
import io.fand.api.advancement.AdvancementDisplay;
import io.fand.api.advancement.AdvancementItemPredicate;
import io.fand.api.advancement.AdvancementTriggers;
import io.fand.api.advancement.CustomAdvancement;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import java.util.List;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

var advancement = CustomAdvancement.builder(Key.key("example:first_diamond"))
        .display(AdvancementDisplay.task(
                Component.text("First Diamond"),
                Component.text("Pick up a diamond")))
        .criteria(List.of(AdvancementCriterion.trigger(
                "has_diamond",
                AdvancementTriggers.inventoryChanged(
                        AdvancementItemPredicate.item(ItemTypes.of(ItemKey.DIAMOND))))))
        .build();

context.advancements().register(advancement);
```

Plugin scope rewrites advancement keys to the plugin namespace. Parent keys in the `minecraft` namespace are kept as-is; other external namespaces are scoped to the plugin.

## Lookup and Registration

```java
var local = context.advancements().advancement(Key.key("example:first_diamond"));
var global = Fand.server().advancements().advancement(Key.key("minecraft:story/root"));
```

`CustomAdvancement` is a typed wrapper around vanilla advancement JSON:

| Field | Meaning |
| --- | --- |
| `key` | Advancement registry key |
| `parent` | Optional parent advancement |
| `display` | Title, description, icon, frame, toast, chat announcement, hidden state |
| `rewards` | Experience, loot tables, recipes, function |
| `criteria` | Trigger criteria |
| `requirements` | Criterion grouping; defaults to one group per criterion |
| `sendsTelemetryEvent` | Whether the advancement sends a telemetry event |

## Criteria

Common criteria can use `AdvancementTriggers` helpers:

```java
var criterion = AdvancementCriterion.trigger(
        "crafted_token",
        AdvancementTriggers.recipeCrafted(Key.key("example:training_token")));
```

For advanced vanilla conditions, use `AdvancementCriterion.vanilla(...)` or `AdvancementTrigger.raw(...)`. This keeps the API usable even when Minecraft adds new trigger details.

## Player Progress

Players expose advancement progress and grant/revoke operations:

```java
var registration = context.advancements().register(advancement);
var key = registration.key();

player.advancementProgress(key).ifPresent(progress -> {
    context.logger().debug("done={}", progress.done());
});

player.grantAdvancement(key);
player.grantAdvancementCriterion(key, "has_diamond");
```

Player methods are not wrapped by `PluginContext`, so pass the final registered key. When registering through `context.advancements()`, save `AdvancementRegistration.key()`.

`advancementData(...)` stores Fand plugin data attached to a player's progress for one advancement. It is separate from vanilla advancement completion.

## Design Rationale

Advancements are still vanilla advancements. Fand provides typed builders and trigger helpers so plugins do not need to hand-write large JSON objects, while raw JSON remains available for new or uncommon vanilla trigger details.

At runtime, Fand installs custom advancements into the vanilla advancement manager and refreshes players. Plugin-scoped registrations are removed when the plugin unloads.

## Best Practices

- Keep advancement keys stable.
- Provide display metadata for visible advancements.
- Use simple lowercase criterion names so manual grant/revoke calls stay readable.
- Grant or revoke individual criteria when you need controlled progress.
- Use generated `ItemKey` constants through `ItemTypes` for fixed item predicates.

## Common Pitfalls

- Inferring behavior from default methods in `fand-api`; Fand Server provides the runtime implementation.
- Looking up `minecraft:*` through `context.advancements()` instead of the global server registry.
- Referencing unknown criterion names in `requirements`.
- Mutating shared JSON objects after building an advancement and expecting registration to track those changes.
- Treating `advancementData(...)` as vanilla completion state.

## Complete Example: Quest Advancement

```java
package com.example;

import io.fand.api.advancement.AdvancementCriterion;
import io.fand.api.advancement.AdvancementDisplay;
import io.fand.api.advancement.AdvancementItemPredicate;
import io.fand.api.advancement.AdvancementTriggers;
import io.fand.api.advancement.CustomAdvancement;
import io.fand.api.entity.Player;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.util.List;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class QuestAdvancementPlugin implements Plugin {
    private static final Key QUEST = Key.key("example:first_diamond");
    private Key registeredQuest = QUEST;

    @Override
    public void onEnable(PluginContext context) {
        var advancement = CustomAdvancement.builder(QUEST)
                .display(AdvancementDisplay.task(
                        Component.text("First Diamond"),
                        Component.text("Pick up a diamond")))
                .criteria(List.of(AdvancementCriterion.trigger(
                        "has_diamond",
                        AdvancementTriggers.inventoryChanged(
                                AdvancementItemPredicate.item(ItemTypes.of(ItemKey.DIAMOND))))))
                .build();

        registeredQuest = context.advancements().register(advancement).key();
    }

    public void completeByCommand(Player player) {
        player.grantAdvancementCriterion(registeredQuest, "has_diamond");
    }
}
```
