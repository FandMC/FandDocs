# 配方

`RecipeRegistry` 管理服务端当前可见的配方。通过 `context.recipes()` 注册的配方会被收敛到当前插件命名空间，并在插件卸载时清理注册关系；需要查看全服所有配方时使用 `Fand.server().recipes()`。

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

在插件作用域里注册时，最终 key 会使用插件 id 作为命名空间。上面示例如果插件 id 是 `arena`，实际注册为 `arena:training_sword`。这让插件内部示例、配置和代码可以保持短 key，同时避免覆盖其它插件。

## 配方类型

| 类型 | Java 类型 | 说明 |
| --- | --- | --- |
| 有序合成 | `ShapedRecipe` | 1 到 3 行，每行 1 到 3 列，空格表示空槽 |
| 无序合成 | `ShapelessRecipe` | 1 到 9 个材料 |
| 烧炼类 | `CookingRecipe` | 支持 smelting、blasting、smoking、campfire cooking |
| 切石机 | `StonecuttingRecipe` | 单输入转单输出 |
| 锻造转换 | `SmithingTransformRecipe` | 模板、基础物品、追加材料、结果 |
| 盔甲纹饰 | `SmithingTrimRecipe` | 结果由原版根据纹饰动态计算 |
| 特殊配方 | `ComplexRecipe` | 只读视图，不能注册 |
| 未知形状 | `UnknownRecipe` | 只读视图，不能注册 |

`RecipeRegistry.register(...)` 只接受可注册类型。`COMPLEX` 和 `UNKNOWN` 是服务端已有配方的只读表示，不适合插件直接创建。

## 材料

`RecipeIngredient` 可以引用单个物品、多个物品、物品标签，或者运行时 predicate。

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

固定 vanilla 物品和标签优先使用数据生成出来的 `ItemKey` / `ItemTagKey`。只有配置文件、玩家输入、外部数据这种运行时字符串，才需要手动解析 `Key`。

运行时 predicate 适合识别带组件或持久数据的物品：

```java
var fallback = RecipeIngredient.of(ItemKey.PAPER);
var ticket = RecipeIngredient.matching(fallback, stack ->
        stack.persistentData()
                .getString(Key.key("example:ticket"))
                .isPresent());
```

`displayFallback` 仍用于原版配方书和配方查看器显示；predicate 本身是 Java 代码，不能序列化为数据包 JSON，只在运行时注册期间生效。

## 查询和移除

```java
var localRecipes = context.recipes().all();
var localCrafting = context.recipes().byType(RecipeType.SHAPED);
var maybeRecipe = context.recipes().find(Key.key("example:training_sword"));

context.recipes().remove(Key.key("example:training_sword"));
```

插件作用域的 `all()`、`find(...)`、`byType(...)` 只返回当前插件命名空间下的配方。要看原版配方和其它插件配方，使用全局视图：

```java
var allRecipes = Fand.server().recipes().all();
```

注册返回的 `RecipeRegistration` 可以手动关闭。关闭时只会移除同一个 handle 安装的配方；如果同 key 后来被重新注册，旧 handle 不会误删新配方。

## 为什么这样设计

Fand 把配方作为“运行时注册表”处理，而不是要求插件手写数据包文件。这样插件可以在 `onEnable` 里根据配置、权限或其它插件状态决定注册哪些配方，同时仍然同步到服务端的原版配方管理器。

插件作用域会自动改写命名空间，是为了减少跨插件覆盖。你在插件里写 `Key.key("example:foo")`，重点是表达本插件的本地 id；最终归属由 `PluginContext` 决定。

## 最佳实践

- 在 `onEnable` 注册稳定配方，在 `onDisable` 释放你自己保存的外部资源。
- 固定 vanilla 物品和标签使用 `ItemKey`、`ItemTagKey`，不要手写注册表字符串。
- 配方 key 用短、稳定、可读的名字，不要包含玩家名或临时状态。
- 需要全服配方视图时用 `Fand.server().recipes()`，插件自己的配方管理用 `context.recipes()`。
- 带 predicate 的材料要提供合理的 `displayFallback`，否则配方书和配方查看器显示会很奇怪。

## 常见坑

- 把 `context.recipes().all()` 当成全服配方列表；它只看当前插件命名空间。
- 给有序配方 pattern 写了没用到的材料符号，或者 pattern 里引用了未定义符号，构造器会直接拒绝。
- 用空物品堆作为配方结果；配方结果必须是非空 `ItemStack`。
- 以为运行时 predicate 会被写进数据包 JSON；它只在当前运行时注册有效。
- 注册 `ComplexRecipe` 或 `UnknownRecipe`；这两类是只读视图。

## 综合示例：注册一组训练配方

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
