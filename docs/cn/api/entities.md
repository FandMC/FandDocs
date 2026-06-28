# 实体

`Entity` 是服务端世界里任意实体的轻量句柄。它用 `uniqueId()` 表示稳定身份，用 `entityId()` 表示当前网络连接里的数字 id；后者不稳定，不要持久化。`LivingEntity` 在 `Entity` 基础上增加生命值、伤害、效果、属性和装备。

> [!IMPORTANT]
> 不要根据 `fand-api` 接口里的 `default` 方法体判断实体能力是否可用。默认实现主要为了编译兼容，真实行为由目标 Fand Server 运行时提供。

## 查找和生成

世界实体查询只覆盖已加载实体。返回集合是当时的快照，不是会自动更新的实时集合。

```java
import io.fand.api.entity.EntityKey;

var zombies = world.entities(EntityKey.ZOMBIE);
var nearby = world.nearbyEntities(player.location(), 16.0);
var nearestZombie = world.nearestEntity(player.location(), 32.0, EntityKey.ZOMBIE);
```

生成实体使用数据生成的 `EntityKey`。生成操作会切到服务端线程执行，异步结果通常也会在服务端线程完成。

```java
import io.fand.api.entity.EntityKey;
import io.fand.api.entity.EntitySpawnOptions;
import io.fand.api.world.Vector3;
import net.kyori.adventure.text.Component;

var options = EntitySpawnOptions.builder()
        .customName(Component.text("Arena Guard"))
        .customNameVisible(true)
        .glowing(true)
        .velocity(new Vector3(0.0, 0.2, 0.0))
        .build();

world.spawnEntity(location, EntityKey.ZOMBIE, options)
        .thenAccept(spawned -> spawned.ifPresent(entity -> {
            entity.addScoreboardTag("arena_guard");
        }));
```

`EntitySpawnOptions` 里不适用于该实体类型的字段会被忽略。例如 `pickupDelay` 只对物品实体有意义，投射物字段只对 projectile 有意义。

## 基础状态

```java
entity.uniqueId();
entity.type();
entity.alive();
entity.location();
entity.velocity();

entity.setVelocity(new Vector3(0.0, 0.5, 0.0));
entity.teleport(destination);
entity.remove();
```

`alive()` 为 `false` 后，句柄仍可作为引用存在，但不应继续当成真实世界里的活实体来操作。需要跨 tick 保存实体时，保存 `UUID`，用 `Fand.server().entity(uuid)` 或 `world.entity(uuid)` 重新解析。

## 展示和标记

```java
entity.setCustomName(Component.text("Quest Target"));
entity.setCustomNameVisible(true);
entity.setGlowing(true);
entity.setSilent(true);
entity.setGravity(false);
entity.addScoreboardTag("quest_target");
```

scoreboard tag 是原版实体 tag，适合做轻量筛选。插件私有、结构化数据优先用 `persistentData()` 或 `components()`。

```java
import net.kyori.adventure.key.Key;

var dataKey = Key.key("example:owner");
entity.setPersistentData(entity.persistentData().withString(dataKey, player.uniqueId().toString()));
```

## 乘骑关系

```java
entity.vehicle();
entity.passengers();

entity.mount(vehicle);
vehicle.addPassenger(entity);
entity.dismount();
vehicle.ejectPassengers();
```

乘骑操作会走原版规则，可能因为实体类型、距离、状态或事件被拒绝，所以返回异步结果或布尔结果时要处理失败情况。

## LivingEntity

`LivingEntity` 覆盖玩家、生物、盔甲架等有生命/装备语义的实体。

```java
import io.fand.api.entity.AttributeKey;
import io.fand.api.entity.EntityEffect;
import io.fand.api.item.component.EffectKey;

living.health();
living.maxHealth();
living.damage(4.0);
living.heal(2.0);
living.addEffect(new EntityEffect(EffectKey.GLOWING, 20 * 5));

living.attribute(AttributeKey.MOVEMENT_SPEED)
        .ifPresent(attribute -> attribute.setBaseValue(attribute.defaultValue() * 1.2));
```

装备槽使用 `ItemEquipmentSlot`。空槽返回 `ItemStack.EMPTY`，清空装备也传入 `ItemStack.EMPTY`。

## 为什么这样设计

Fand 把实体暴露成句柄，而不是把底层 NMS/Paper 对象交给插件。这样插件可以用稳定的公开接口读取、修改和追踪实体，而运行时负责把操作映射到当前 Minecraft 版本。

`EntityKey`、`AttributeKey`、`EffectKey` 等生成 key 用来替代手写注册表字符串。固定的原版类型有编译期检查；配置文件、玩家输入和跨版本数据才需要解析 `Key`。

大量修改方法会编排到服务端线程，是为了让事件、异步任务和插件逻辑可以安全提交动作，但真实世界状态仍按 tick 顺序应用。

## 最佳实践

- 固定 vanilla 实体、属性和效果使用生成 key，例如 `EntityKey.ZOMBIE`、`AttributeKey.MAX_HEALTH`、`EffectKey.SPEED`。
- 跨 tick 保存实体时保存 `UUID`，使用前重新解析并检查 `alive()`。
- 大范围查找优先缩小世界、半径或 box，不要每 tick 扫全服实体。
- 修改实体、装备、生命、目标和乘骑关系时保持逻辑短小，必要时先异步计算，再回主线程应用。
- 插件私有标记用 `persistentData()`；临时筛选可以用 scoreboard tag。
- 只给某个玩家看的隐藏、假实体、发光效果优先看数据包幻象或玩家表现 API，不要修改真实实体状态。

## 常见坑

- 把 `entityId()` 当成持久 id。它只是当前会话的网络 id。
- 缓存实体句柄后不检查 `alive()`，实体死亡、卸载或换维度后继续操作。
- 在异步任务里直接读写大量实体的实时状态。
- 用字符串写固定 vanilla id，绕开生成 key。
- 以为 `remove()` 会触发“插件拥有实体”的自动清理策略；生成出的真实实体属于世界状态，需要插件自己设计生命周期。

## 综合示例：生成守卫并阻止普通玩家伤害

```java
package com.example;

import io.fand.api.entity.EntityKey;
import io.fand.api.entity.EntitySpawnOptions;
import io.fand.api.event.entity.EntityDamageByEntityEvent;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import io.fand.api.world.Location;
import net.kyori.adventure.text.Component;

public final class GuardPlugin implements Plugin {
    private static final String GUARD_TAG = "example_guard";

    @Override
    public void onEnable(PluginContext context) {
        context.events().subscribe(EntityDamageByEntityEvent.class, event -> {
            if (event.entity().scoreboardTags().contains(GUARD_TAG)
                    && !event.damager().scoreboardTags().contains("admin_tool")) {
                event.setCancelled(true);
            }
        });
    }

    public void spawnGuard(Location location) {
        var options = EntitySpawnOptions.builder()
                .customName(Component.text("Guard"))
                .customNameVisible(true)
                .persistent(true)
                .noAi(true)
                .build();

        location.world().spawnEntity(location, EntityKey.ZOMBIE, options)
                .thenAccept(spawned -> spawned.ifPresent(entity -> {
                    entity.addScoreboardTag(GUARD_TAG);
                    entity.setGlowing(true);
                }));
    }
}
```
