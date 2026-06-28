# 附魔

`EnchantmentRegistry` 用来查询和注册自定义附魔。通过 `context.enchantments()` 注册的附魔会收敛到插件命名空间，并在插件卸载时清理注册关系。

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

插件作用域会把 key 改成当前插件命名空间。全局读取原版或其它插件附魔时，使用 `Fand.server().enchantments()`。

## 查询和视图

```java
var local = context.enchantments().enchantment(Key.key("example:training_edge"));
var sharpness = Fand.server().enchantments()
        .enchantment(io.fand.api.item.component.EnchantmentKey.SHARPNESS.key());
```

`EnchantmentView` 提供 key、描述、最大等级、定义、效果和互斥集合。原版附魔也可以通过全局注册表读取成视图。

## Definition

`EnchantmentDefinition` 描述附魔能出现在哪里，以及附魔台/铁砧相关数值：

| 字段 | 说明 |
| --- | --- |
| `supportedItems` | 可被此附魔支持的物品或标签，不能为空 |
| `primaryItems` | 附魔台优先展示的物品集合，可为空 |
| `weight` | 权重，范围 `1..1024` |
| `maxLevel` | 最大等级，范围 `1..255` |
| `minCost` / `maxCost` | 附魔消耗范围 |
| `anvilCost` | 铁砧消耗 |
| `slots` | 生效装备槽位 |

`RegistryReference.key(...)` 表示具体注册表项，`RegistryReference.tag(...)` 表示标签。固定原版标签优先使用生成的 `ItemTagKey`。

## Effects

`EnchantmentEffects` 是对现代 Minecraft 附魔效果组件的包装。简单效果可以用 builder，复杂或新版本还没包装的效果可以用原始 JSON。

```java
import io.fand.api.enchantment.EnchantmentEffects;
import io.fand.api.enchantment.EnchantmentLevelValue;
import io.fand.api.enchantment.EnchantmentValueEffect;

var effects = EnchantmentEffects.builder()
        .damage(EnchantmentValueEffect.add(EnchantmentLevelValue.perLevel(1.0F)))
        .build();
```

如果你直接维护原版效果 JSON，可以：

```java
var effects = EnchantmentEffects.raw(rawJsonObject);
```

这不是绕过 API，而是给 Minecraft 数据驱动模型保留完整表达能力。

## 物品上的附魔

注册附魔和给物品写附魔是两件事。物品页里的 `ItemStack.withEnchantment(...)` 会把附魔写到物品组件里：

```java
var registration = context.enchantments().register(customEnchantment);
var enchantmentKey = registration.key();

var sword = io.fand.api.item.ItemTypes.of(io.fand.api.item.ItemKey.DIAMOND_SWORD)
        .one()
        .withEnchantment(enchantmentKey, 2);
```

如果附魔还没有注册，客户端和服务端可能无法正确解释它。通常先在 `onEnable` 注册附魔，再发放带该附魔的物品。通过 `context.enchantments()` 注册时，物品上也应该写入 `EnchantmentRegistration.key()` 返回的最终 key。

## 为什么这样设计

现代 Minecraft 附魔已经是数据驱动系统，包含 definition、exclusive set、effect components、condition 等多层结构。Fand 没有把它简化成一个“伤害 + 等级”的旧式模型，而是尽量贴近原版数据结构，同时用 Java builder 包住常用部分。

这样做的好处是：插件可以使用新版本原版能力，也可以在 API 还没覆盖所有 JSON 细节时通过 raw 入口继续表达完整数据。

## 最佳实践

- 在 `onEnable` 注册自定义附魔，再创建或发放带附魔的物品。
- 固定物品集合用 `ItemTagKey`，例如 `ItemTagKey.SWORDS`、`ItemTagKey.ARMOR_ENCHANTABLE`。
- `supportedItems` 不要写成 `RegistryReference.all()`，除非你真的希望所有物品都支持。
- 简单数值效果优先用 `EnchantmentEffects.builder()`；复杂原版效果用原始 JSON，并在代码里集中维护。
- 自定义附魔 key 一旦发布就尽量不要改，否则已有物品上的附魔引用会失效。

## 常见坑

- 把“注册附魔”和“给物品添加附魔”混为一谈；前者进注册表，后者改 `ItemStack` 组件。
- 用 `context.enchantments()` 查询原版附魔；插件作用域只看当前插件命名空间。
- `supportedItems` 或 `slots` 为空，构造器会拒绝。
- `maxLevel`、`weight`、`anvilCost` 超出范围，构造器会拒绝。
- 为了省事使用 `RegistryReference.all()`，导致附魔出现在不该出现的物品上。

## 综合示例：注册并发放训练附魔剑

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
