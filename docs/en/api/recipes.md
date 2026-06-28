# Recipes

`RecipeRegistry` manages the recipes currently visible to the server. Recipes registered through `context.recipes()` are scoped to the current plugin namespace and are cleaned up when the plugin unloads. Use `Fand.server().recipes()` when you need the global recipe view.

```java
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.recipe.RecipeIngredient;
import io.fand.api.recipe.ShapedRecipe;
import java.util.List;
import java.util.Map;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

var result = ItemTypes.of(ItemKey.DIAMOND_SWORD)
        .one()
        .withItemName(Component.text("Training Sword"));

context.recipes().register(new ShapedRecipe(
        Key.key("example:training_sword"),
        List.of(" D ", " D ", " S "),
        Map.of(
                'D', RecipeIngredient.of(ItemKey.DIAMOND),
                'S', RecipeIngredient.of(ItemKey.STICK)),
        result));
```

When registered through the plugin context, the final key uses the plugin id as the namespace. If the plugin id is `arena`, the example above registers `arena:training_sword`.

## Recipe Types

| Type | Java Type | Notes |
| --- | --- | --- |
| Shaped crafting | `ShapedRecipe` | 1 to 3 rows, each 1 to 3 columns; spaces are empty slots |
| Shapeless crafting | `ShapelessRecipe` | 1 to 9 ingredients |
| Cooking | `CookingRecipe` | Smelting, blasting, smoking, and campfire cooking |
| Stonecutting | `StonecuttingRecipe` | Single input to single output |
| Smithing transform | `SmithingTransformRecipe` | Template, base, addition, result |
| Smithing trim | `SmithingTrimRecipe` | Result is computed by vanilla from trim inputs |
| Complex recipes | `ComplexRecipe` | Read-only view; cannot be registered |
| Unknown recipes | `UnknownRecipe` | Read-only view; cannot be registered |

`RecipeRegistry.register(...)` accepts only registerable types. `COMPLEX` and `UNKNOWN` represent existing vanilla recipes that Fand does not expose for runtime registration.

## Ingredients

`RecipeIngredient` can reference one item, several items, an item tag, or a runtime predicate.

```java
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTagKey;
import io.fand.api.recipe.RecipeIngredient;
import java.util.List;

var diamond = RecipeIngredient.of(ItemKey.DIAMOND);
var planks = RecipeIngredient.tag(ItemTagKey.PLANKS.key());
var metal = RecipeIngredient.ofKeys(List.of(
        ItemKey.IRON_INGOT.key(),
        ItemKey.GOLD_INGOT.key()));
```

Use generated `ItemKey` and `ItemTagKey` constants for fixed vanilla content. Parse raw `Key` values only for config files, player input, or external data.

Runtime predicates are useful for component or persistent-data checks:

```java
var fallback = RecipeIngredient.of(ItemKey.PAPER);
var ticket = RecipeIngredient.matching(fallback, stack ->
        stack.persistentData()
                .getString(Key.key("example:ticket"))
                .isPresent());
```

The fallback is still used for vanilla recipe book and recipe-viewer display. The predicate is Java code, so it is not serialized to data-pack JSON and only works while the recipe is registered at runtime.

## Lookup and Removal

```java
var localRecipes = context.recipes().all();
var localCrafting = context.recipes().byType(RecipeType.SHAPED);
var maybeRecipe = context.recipes().find(Key.key("example:training_sword"));

context.recipes().remove(Key.key("example:training_sword"));
```

The plugin-scoped `all()`, `find(...)`, and `byType(...)` methods only see the current plugin namespace. Use the global view for vanilla and other plugins:

```java
var allRecipes = Fand.server().recipes().all();
```

The returned `RecipeRegistration` can be closed manually. Closing removes only the recipe installed by that handle; if the same key was registered again later, the old handle will not remove the newer recipe.

## Design Rationale

Fand treats recipes as a runtime registry instead of forcing plugins to write data-pack files for every case. A plugin can decide in `onEnable` which recipes to expose based on configuration, permissions, or other plugin state, while still updating the live vanilla recipe manager.

Plugin-scoped namespace rewriting prevents accidental cross-plugin replacement. Inside a plugin, the key mostly expresses the local id; ownership is supplied by `PluginContext`.

## Best Practices

- Register stable recipes in `onEnable`.
- Use `ItemKey` and `ItemTagKey` for fixed vanilla items and tags.
- Keep recipe keys stable and readable; do not put player names or temporary state in keys.
- Use `context.recipes()` for plugin-owned recipes and `Fand.server().recipes()` for global lookup.
- Give runtime-matched ingredients a useful display fallback.

## Common Pitfalls

- Treating `context.recipes().all()` as a global recipe list; it only sees the plugin namespace.
- Leaving unused ingredient symbols in a shaped recipe, or referencing symbols that are not defined.
- Using an empty stack as a recipe result.
- Expecting a runtime predicate to be written into data-pack JSON.
- Trying to register `ComplexRecipe` or `UnknownRecipe`.

## Complete Example: Training Recipes

```java
package com.example;

import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTagKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import io.fand.api.recipe.CookingRecipe;
import io.fand.api.recipe.RecipeIngredient;
import io.fand.api.recipe.RecipeType;
import io.fand.api.recipe.ShapedRecipe;
import io.fand.api.recipe.ShapelessRecipe;
import java.util.List;
import java.util.Map;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class TrainingRecipesPlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        var sword = ItemTypes.of(ItemKey.DIAMOND_SWORD)
                .one()
                .withItemName(Component.text("Training Sword"));

        context.recipes().register(new ShapedRecipe(
                Key.key("example:training_sword"),
                List.of(" D ", " D ", " S "),
                Map.of(
                        'D', RecipeIngredient.of(ItemKey.DIAMOND),
                        'S', RecipeIngredient.of(ItemKey.STICK)),
                sword));

        var token = ItemTypes.of(ItemKey.PAPER)
                .one()
                .withItemName(Component.text("Training Token"));

        context.recipes().register(new ShapelessRecipe(
                Key.key("example:training_token"),
                List.of(
                        RecipeIngredient.tag(ItemTagKey.PLANKS.key()),
                        RecipeIngredient.of(ItemKey.EMERALD)),
                token));

        context.recipes().register(new CookingRecipe(
                Key.key("example:charged_token"),
                RecipeType.SMELTING,
                RecipeIngredient.of(ItemKey.PAPER),
                token.withEnchantmentGlintOverride(true),
                0.2F,
                100,
                "training",
                io.fand.api.recipe.CookingRecipeCategory.MISC,
                true));
    }
}
```
