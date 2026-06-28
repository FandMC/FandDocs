# 进度

`AdvancementRegistry` 用来查询和注册自定义进度。通过 `context.advancements()` 注册的进度会收敛到插件命名空间，并在插件卸载时清理注册关系。

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

插件作用域会把进度 key 改成当前插件命名空间。父进度 key 如果是 `minecraft:*` 会保持原样；其它非当前命名空间会被收敛到插件命名空间。

## 查询和注册

```java
var local = context.advancements().advancement(Key.key("example:first_diamond"));
var global = Fand.server().advancements().advancement(Key.key("minecraft:story/root"));
```

`CustomAdvancement` 是对原版进度 JSON 的类型化包装。它包含：

| 字段 | 说明 |
| --- | --- |
| `key` | 进度注册 key |
| `parent` | 父进度，可为空 |
| `display` | 标题、描述、图标、frame、toast、聊天公告、隐藏状态 |
| `rewards` | 经验、战利品表、解锁配方、函数 |
| `criteria` | 触发条件 |
| `requirements` | 条件组合关系；为空时每个 criterion 单独成组 |
| `sendsTelemetryEvent` | 是否发送遥测事件 |

## 触发条件

简单条件可以使用 `AdvancementTriggers` 里的 helper：

```java
var criterion = AdvancementCriterion.trigger(
        "crafted_token",
        AdvancementTriggers.recipeCrafted(Key.key("example:training_token")));
```

复杂条件可以直接用 `AdvancementCriterion.vanilla(...)` 或 `AdvancementTrigger.raw(...)` 接入原版 JSON。这样 Fand 不需要为每个 Minecraft 触发器都包装一层 API，仍能跟上新版本扩展。

## 玩家进度

玩家侧提供查询和授予/撤销入口：

```java
var registration = context.advancements().register(advancement);
var key = registration.key();

player.advancementProgress(key).ifPresent(progress -> {
    context.logger().debug("done={}", progress.done());
});

player.grantAdvancement(key);
player.grantAdvancementCriterion(key, "has_diamond");
```

玩家方法不会经过 `PluginContext` 包装，传入的必须是最终注册 key。通过 `context.advancements()` 注册时，保存 `AdvancementRegistration.key()` 最稳。

`advancementData(...)` 是 Fand 附加在某个玩家某个进度上的插件数据，不等于原版进度完成状态。适合保存进度相关的额外 JSON 数据。

## 为什么这样设计

进度本质上仍是原版进度系统。Fand 提供类型化 builder 和常见触发器 helper，是为了让插件不用整页手写 JSON；同时保留原始 JSON 入口，是为了不阻断 Minecraft 新版本新增的触发器或条件。

注册后服务端会把自定义进度同步进原版进度管理器，并刷新玩家资源。插件禁用时，`context.advancements()` 注册的进度会清理注册关系。

## 最佳实践

- 进度 key 保持稳定，别把玩家名、日期或随机数塞进 key。
- 公开进度建议提供 display；隐藏内部逻辑进度可以省略 display 或设为 hidden。
- 条件名用小写蛇形命名，方便后续授予单个 criterion。
- 需要手动控制完成状态时，优先操作 criterion，而不是反复 grant/revoke 整个进度。
- 用 `AdvancementItemPredicate.item(ItemTypes.of(ItemKey.X))` 表达固定物品，避免手写注册表字符串。

## 常见坑

- 把 `fand-api` 里的 default 返回值当作真实行为；Fand Server 运行时会提供实际进度注册和玩家进度操作。
- 在插件作用域查询 `minecraft:*` 进度；要查原版进度用 `Fand.server().advancements()`。
- requirements 引用了不存在的 criterion 名称，构造器会拒绝。
- 注册后又改同一个 `CustomAdvancement` 对象里的外部 JSON；API 构造时会拷贝必要数据，不要依赖共享可变对象。
- 把 `advancementData(...)` 当作原版完成状态；它只是 Fand 附加数据。

## 综合示例：任务进度和手动完成

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
