# 战利品表

`LootTableService` 用来查询、生成和替换战利品表。通过 `context.lootTables()` 替换的表会使用当前插件命名空间，并在插件卸载时清理替换关系。

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

插件作用域会把 key 收敛到插件命名空间。全局查询或生成原版表时使用 `Fand.server().lootTables()`。

## 查询和生成

```java
var table = Fand.server().lootTables().table(Key.key("minecraft:chests/simple_dungeon"));

var items = Fand.server().lootTables().generate(
        Key.key("minecraft:chests/simple_dungeon"),
        new LootContext(player.location(), player, 1.0F));
```

`LootContext` 目前包含：

| 字段 | 说明 |
| --- | --- |
| `location` | 生成位置；缺省时使用主世界零点附近上下文 |
| `killer` | 来源实体；当前运行时会把玩家来源映射成原版玩家伤害参数 |
| `luck` | luck 加成 |

如果原版战利品表的参数集要求当前上下文无法提供的参数，生成结果会是空列表。这比伪造错误上下文更安全。

## 替换战利品表

```java
var registration = context.lootTables().replace(
        Key.key("example:daily_box"),
        loot -> List.of(
                ItemTypes.of(ItemKey.DIAMOND).stack(1),
                ItemTypes.of(ItemKey.EMERALD).stack(Math.max(1, (int) loot.luck() + 1))));

registration.close();
```

`replace(...)` 是运行时替换：当原版生成同 key 战利品表时，Fand 会调用你的 `LootGenerator`。如果你只是想写静态 JSON 文件，后续更适合使用 `context.dataPacks()` 管理数据包文件树。

## 为什么这样设计

战利品表有两种需求：一种是“像原版一样从数据包读取 JSON”，另一种是“插件根据玩家、活动、经济系统实时算奖励”。`LootTableService.replace(...)` 服务第二种需求，它让插件可以用 Java 代码接管指定表，同时仍然能被原版生成流程调用。

插件作用域限制命名空间，是为了避免一个插件无意替换另一个插件的奖励表。确实要读原版表时，使用全局 `Fand.server().lootTables()`。

## 最佳实践

- 静态掉落优先考虑数据包文件；动态奖励才使用 `replace(...)`。
- `LootGenerator` 不要执行慢 I/O，它可能在原版生成流程中被调用。
- 返回列表里不要放空物品堆；直接调用 `generate(...)` 会返回生成器给出的结果。
- 用 `LootContext.locationOptional()` 和 `killerOptional()` 处理缺省上下文。
- 奖励 key 保持稳定，活动期变化放在生成器逻辑里，不要频繁换 key。

## 常见坑

- 用 `context.lootTables()` 生成原版 `minecraft:*` 表；插件作用域会改写命名空间，应使用 `Fand.server().lootTables()`。
- 以为 `replace(...)` 会写入数据包 JSON；它是运行时代码替换。
- 在 generator 里访问数据库或网络，导致开箱、杀怪、容器生成时卡住。
- 忽略 luck、killer、location，导致所有玩家拿到完全一样的结果。
- 生成需要特殊上下文的原版表时传 `LootContext.empty()`，最后得到空列表。

## 综合示例：每日奖励箱

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
