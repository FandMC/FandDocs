# 物品

Fand 的物品模型由三层组成：`ItemType` 表示注册表里的物品类型，`ItemStack` 表示一个不可变物品堆，`ItemComponents` 表示现代 Minecraft 物品数据组件补丁。

```java
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import net.kyori.adventure.text.Component;

var diamond = ItemTypes.of(ItemKey.DIAMOND)
        .stack(3)
        .withCustomName(Component.text("Prize Diamond"));
```

`ItemStack` 不会原地修改。所有 `with*`、`without*`、`remove*` 方法都会返回新的 `ItemStack`。把物品写回背包、容器、事件或实体前，记得使用返回值。

## ItemType 和 ItemStack

`ItemType` 是注册表类型。固定 vanilla 物品应优先使用数据生成出来的 `ItemKey`，例如 `ItemKey.STONE`、`ItemKey.DIAMOND_SWORD`。只有配置文件、玩家输入、外部数据这类运行时字符串，才需要先解析成 `Key` 再查询。

```java
var type = ItemTypes.of(ItemKey.DIAMOND_SWORD);
var stack = type.one();
var maybeApple = ItemTypes.find(ItemKey.APPLE);
```

`ItemTypes.of(...)` 找不到类型时会抛出 `NoSuchElementException`。配置文件、玩家输入或跨版本数据应优先使用 `find(Key.key(rawId))`，内部固定 vanilla 常量使用 `ItemKey`。

`ItemStack.EMPTY` 是空物品堆哨兵。Fand API 的背包、容器和事件不会用 `null` 表示空槽。

```java
if (stack.isEmpty()) {
    return;
}

var amount = stack.amount();
var max = stack.maxStackSize();
```

非空 `ItemStack` 的数量必须在 `1..maxStackSize()` 范围内。`withMaxStackSize(...)` 可以通过数据组件覆盖最大堆叠数，但值必须在 `1..99`。

## 名称、Lore 和模型

显示文本使用 Adventure `Component`。这和 Fand 其它消息、BossBar、GUI 标题保持一致。

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

常用显示组件：

| 能力 | 方法 |
| --- | --- |
| 自定义名称 | `customName()`、`withCustomName(...)`、`withoutCustomName()` |
| 物品名称 | `itemName()`、`withItemName(...)`、`withoutItemName()` |
| Lore | `lore()`、`withLore(...)`、`addLoreLine(...)`、`withoutLore()` |
| 物品模型 | `itemModel()`、`withItemModel(Key)`、`withoutItemModel()` |
| 自定义模型数据 | `customModelData()`、`withCustomModelData(...)`、`withoutCustomModelData()` |
| 发光覆盖 | `enchantmentGlintOverride()`、`withEnchantmentGlintOverride(...)` |
| Tooltip 显示 | `withTooltipHidden(...)`、`withHiddenTooltipComponent(...)` |

`withCustomModelData(int)` 会写入现代 `minecraft:custom_model_data` 的 `floats` 列表。需要 flags、strings、colors 时使用 `CustomModelData`。

## 附魔、耐久和稀有度

附魔由 `ItemEnchantments` 表示，普通附魔写入 `minecraft:enchantments`，附魔书存储附魔写入 `minecraft:stored_enchantments`。

```java
import io.fand.api.item.component.EnchantmentKey;

var sword = ItemTypes.of(ItemKey.DIAMOND_SWORD)
        .one()
        .withEnchantment(EnchantmentKey.SHARPNESS, 5)
        .withUnbreakable(true)
        .withRarity(ItemRarity.RARE);
```

`withEnchantment(...)` 会设置指定等级，`upgradeEnchantment(...)` 只会在新等级更高时更新。等级范围是 `1..255`。

耐久相关方法：

```java
stack.damage();
stack.withDamage(12);
stack.maxDamage();
stack.withMaxDamage(250);
stack.withUnbreakable(true);
stack.withRepairCost(3);
```

`damage` 和 `repairCost` 不能为负数，`maxDamage` 必须大于等于 `1`。

## 食物、使用和装备行为

Fand 为大量 vanilla 组件提供了类型化值对象，例如 `ItemFood`、`ItemConsumable`、`ItemUseCooldown`、`ItemTool`、`ItemWeapon`、`ItemEquippable`、`ItemAttributeModifiers`。

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

这类方法只是描述物品组件。实际客户端表现、服务端消耗和属性结算仍按当前 Minecraft 运行时规则处理。

## 持久数据和自定义物品

插件自己的物品标记优先使用 `PersistentDataContainer` 或 `CustomItemRegistry`，不要随意占用别的插件命名空间。

```java
var key = Key.key("example:token_owner");

var tagged = ItemTypes.of(ItemKey.EMERALD)
        .one()
        .withPersistentData(key, new JsonPrimitive(player.uniqueId().toString()));

tagged.persistentData().getString(key)
        .ifPresent(owner -> context.logger().info("owner={}", owner));
```

`PersistentDataContainer` 存在于物品的 `minecraft:custom_data` 组件内。它是不可变值对象，修改后仍要把新的 `ItemStack` 写回去。

自定义物品注册会把自定义 id 存进物品的 custom data，物品在网络层仍然是 vanilla stack。

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

`customItems().customId(stack)` 可以识别一个 stack 是否带有已注册的自定义物品 id。插件禁用时，通过 `PluginContext` 注册的自定义物品会由运行时跟踪清理注册关系；已经存在于玩家背包或世界里的物品数据不会被自动删除。

## 背包、掉落和实体

玩家背包通过 `Player.inventory()` 访问。槽位从 `0` 开始，空槽返回 `ItemStack.EMPTY`。

```java
var inventory = player.inventory();
var leftover = inventory.add(reward);

if (!leftover.isEmpty()) {
    player.world().dropItem(player.location(), leftover);
}
```

主手、副手和装备槽有专门方法：

```java
var held = player.inventory().heldItem();
player.inventory().setHeldItem(held.withCustomName(Component.text("Bound Tool")));
player.inventory().setOffhandItem(ItemStack.EMPTY);
```

世界掉落使用 `World.dropItem(...)`：

```java
world.dropItem(location, ItemTypes.of(ItemKey.DIAMOND), 1);
world.dropItem(location, stack);
```

这些方法会由运行时安排到服务端线程并返回 `CompletableFuture`。

## 物品事件

物品会出现在玩家交互、背包/容器、掉落、拾取、消耗、耐久、合成、熔炼、交易等事件里。

```java
context.events().subscribe(PlayerDropItemEvent.class, event -> {
    if (context.customItems().customId(event.item())
            .filter(id -> id.equals(Key.key("example:vote_token")))
            .isPresent()) {
        event.setCancelled(true);
    }
});
```

有些事件允许替换物品，例如 `PlayerDropItemEvent#setItem(...)`、`EntityPickupItemEvent#setItem(...)`、`InventoryMoveItemEvent#setItem(...)`。有些事件只暴露只读 item，需要取消事件后自行应用后续逻辑。

## 为什么这样设计

Minecraft 1.20.5 之后物品数据已经从旧 NBT/meta 模型转向 data components。Fand 直接以组件模型暴露物品，避免把新语义重新包成旧的 `ItemMeta` 风格。

`ItemStack` 是不可变值对象，是为了减少“读出来后被别处悄悄改掉”的问题。背包、容器、事件和实体是实时状态；物品堆本身则适合作为可安全传递的值。

`ItemComponents` 使用补丁模型，是因为 vanilla 物品序列化本身区分“设置一个组件”“移除默认组件”“不触碰默认组件”。`withoutComponent(...)` 和 `removeComponent(...)` 的区别就来自这里。

## 最佳实践

- 固定 vanilla 物品使用数据生成的 `ItemKey`，不要在示例和业务代码里手写 `"minecraft:..."` 物品 id。
- 配置、玩家输入和跨版本数据用 `ItemTypes.find(Key.key(rawId))`，不要直接 `of(...)`。
- 修改物品后一定使用返回的新 `ItemStack`，再写回背包、容器、事件或实体。
- 空槽用 `ItemStack.EMPTY` 或 `isEmpty()`，不要用 `null`。
- 插件私有数据使用 `PersistentDataContainer`，生态可识别的自定义物品使用 `CustomItemRegistry`。
- 需要 resource pack 模型时，把 `item_model`、`custom_model_data` 和插件资源包约定写清楚。
- 批量发物品时先尝试 `Inventory.add(...)`，再处理 leftover。

## 常见坑

- 调了 `stack.withCustomName(...)` 但没有接住返回值，实际没有任何物品被修改。
- 把 `withoutComponent(...)` 当成“强制删除默认组件”。强制删除默认组件应使用 `removeComponent(...)`。
- 固定物品直接写 `"minecraft:<id>"` 这类字符串，绕过了 Fand 的数据生成 key，也失去编译期检查。
- 在异步任务里直接修改玩家背包。物品构造可以异步，写回背包要回到服务端线程。
- 把自定义物品注册当成删除策略。注册关系卸载会清理，但已经流通的物品数据仍在。
- 假设 `Inventory.add(...)` 一定全放进去；它会返回 leftover。

## 综合示例：注册并发放一个绑定奖励

下面的例子注册一个自定义物品，命令或事件里可以调用 `giveReward(...)` 发给玩家。如果背包放不下，剩余物品会掉落在玩家位置。

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
