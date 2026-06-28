# 世界

`World` 表示服务端已加载的维度。它由 `Key` 标识，固定 vanilla 维度可以使用数据生成的 `DimensionTypeKey`，例如 `DimensionTypeKey.OVERWORLD`、`DimensionTypeKey.NETHER`、`DimensionTypeKey.END`；动态创建的世界仍然使用自己的 key。`World` 同时是 Adventure `Audience`，会把消息转发给当前在该世界里的玩家。

```java
Fand.server().defaultWorld().ifPresent(world -> {
    world.sendMessage(Component.text("Hello overworld"));
});
```

## 查找世界

全局世界入口在 `Fand.server()` 上：

```java
import io.fand.api.world.generation.DimensionTypeKey;

var worlds = Fand.server().worlds();
var overworld = Fand.server().world(DimensionTypeKey.OVERWORLD.key());
var defaultWorld = Fand.server().defaultWorld();
```

插件自己的注册行为仍然应该优先走 `PluginContext`。世界查询是全局视图，适合广播、定位玩家、创建/卸载动态世界、或把配置里的世界 key 解析成 `World`。

## 坐标和位置

`world.at(...)` 创建不可变 `Location`。`world.blockAt(...)` 返回一个懒加载 `Block` 位置句柄，真正读写发生在 `block.type()`、`block.setType(...)` 等调用时。

```java
import io.fand.api.block.BlockKey;

var spawn = world.at(0.5, 80.0, 0.5, 0.0f, 0.0f);
var block = world.blockAt(0, 79, 0);

if (block.air()) {
    block.setType(BlockTypes.of(BlockKey.STONE));
}
```

`Location.blockX()`、`blockY()`、`blockZ()` 使用向下取整，符合 Minecraft 方块坐标习惯。

## 时间、天气和难度

世界时间、天气、难度等修改方法返回 `CompletableFuture`。运行时会把实际状态修改编排到服务端线程。

```java
world.setTime(6000);
world.setStorm(false);
world.setThundering(false);
world.setDifficulty(Difficulty.NORMAL);
```

这些 future 通常在服务端线程完成。后续需要修改世界状态的回调，不要假设它在后台线程。

## 世界边界

`world.worldBorder()` 返回 live world border 控制器。

```java
var border = world.worldBorder();
border.setCenter(0.0, 0.0);
border.setSize(500.0, Duration.ofSeconds(30));
border.setWarningDistance(16);
```

边界修改会影响真实世界状态，不是 per-player 临时效果。

## 实体查询

`World` 可以查询当前加载实体、指定类型实体、范围内实体、盒选实体、最近实体和射线命中实体。

```java
var center = player.location();

var nearby = world.nearbyEntities(center, 16.0);
var nearest = world.nearestEntity(center, 32.0);
var hit = world.rayTraceEntity(center, new Vector3(0.0, 0.0, 1.0), 16.0);
```

返回值是快照，不是 live 集合。实体只覆盖已加载实体；未加载 chunk 中的实体不会出现在查询结果里。

## Chunk

chunk 坐标是方块坐标右移 4 位后的坐标。`chunkAt(...)` 返回懒句柄，`loadChunk(...)`、`setChunkForceLoaded(...)` 等方法会编排到服务端线程。

```java
int chunkX = player.location().blockX() >> 4;
int chunkZ = player.location().blockZ() >> 4;

if (!world.chunkLoaded(chunkX, chunkZ)) {
    world.loadChunk(chunkX, chunkZ).thenAccept(loaded -> {
        context.logger().info("chunk loaded={}", loaded);
    });
}

var snapshot = world.chunkSnapshot(chunkX, chunkZ);
```

`unloadChunk(...)` 只是清除强加载状态并请求 chunk 可卸载。玩家、ticket 或服务端任务仍可能让 chunk 保持加载。

## 批量方块修改

大范围方块修改应该使用批量 API，而不是循环调用 `Block.setType(...)`。`BlockBatchOptions` 控制每 tick 修改数量、更新模式和是否跳过未变化方块。

```java
var min = world.at(-16, 64, -16);
var max = world.at(16, 70, 16);

world.fillBlocks(
        min,
        max,
        BlockTypes.of(BlockKey.GLASS),
        DataComponentMap.EMPTY,
        BlockBatchOptions.defaults().withMaxBlocksPerTick(2048))
        .thenAccept(result -> context.logger().info(
                "changed={} skipped={} failed={}",
                result.changed(),
                result.skipped(),
                result.failed()));
```

`BlockUpdateMode.NORMAL` 会通知邻居和客户端；`CLIENTS_ONLY` 更适合结构粘贴；`SILENT` 抑制通知，调用方需要自己承担刷新和后续更新语义。

## 扫描和替换

`scanBlocks(...)` 可以跨 tick 扫描一个 `BlockRegion`，并把 `BlockTransform` 返回的变化分批应用。`replaceBlocks(...)` 和 `replaceConnectedBlocks(...)` 是常用便捷入口。

```java
var region = BlockRegion.cube(player.location(), 8);

world.replaceBlocks(
        region,
        type -> type.key().equals(BlockKey.STONE.key()),
        BlockTypes.of(BlockKey.DEEPSLATE),
        BlockScanOptions.defaults().withLoadedChunksOnly(true));
```

默认扫描只处理已加载 chunk，避免无意触发大范围加载。

## 效果和生成

世界可以播放声音、生成粒子、掉落物品、生成实体、闪电和爆炸。

```java
import io.fand.api.item.ItemKey;
import io.fand.api.world.sound.SoundKey;

world.playSound(
        player.location(),
        SoundEffect.of(SoundKey.NOTE_BLOCK_PLING, SoundCategory.PLAYER));

world.dropItem(player.location(), ItemTypes.of(ItemKey.DIAMOND), 1);
world.strikeLightning(player.location(), true);
```

会改变世界或实体状态的方法通常返回 `CompletableFuture`，因为运行时需要把操作放回服务端线程。

## 动态世界

`Fand.server().createWorld(...)` 可以基于 `WorldTemplate` 或 `WorldCreateOptions` 创建动态世界。`unloadWorld(...)` 卸载世界。

```java
Fand.server()
        .createWorld(Key.key("example:arena"), WorldTemplate.OVERWORLD)
        .thenAccept(world -> context.logger().info("created {}", world.key()));

Fand.server().unloadWorld(Key.key("example:arena"));
```

动态世界是全局服务端状态。插件禁用不会自动删除或卸载你创建的世界，除非你的插件明确这么做。

## 为什么这样设计

`World` 是 loaded dimension 的 live 句柄，而不是“世界配置对象”。这让查询玩家、实体、方块、chunk、边界、时间和天气都围绕同一个领域对象展开。

会修改世界的操作大量返回 `CompletableFuture`，是为了明确线程边界。调用可以来自插件逻辑、事件或异步阶段，但真实 Minecraft 状态修改要由运行时安排到服务端线程。

批量方块和扫描 API 单独存在，是为了避免插件用简单循环把一个大区域修改塞进同一个 tick。Fand 把每 tick 上限和更新模式放进 options，让插件能表达性能与一致性的取舍。

## 最佳实践

- 配置里保存 world key，使用时通过 `Fand.server().world(key)` 解析。
- 小范围即时操作用 `world.blockAt(...)`，大范围修改用 batch/scan API。
- 对大区域扫描默认保持 `loadedChunksOnly(true)`，除非你明确希望加载或生成 chunk。
- future 回调里如果继续修改世界，按“可能在服务端线程完成”的语义写短逻辑。
- 动态世界创建、卸载、force-loaded chunk 都属于全局状态，插件要有明确清理策略。
- 只需要给某个玩家看的效果，优先考虑 packet illusion、BossBar、Map renderer 等 per-viewer API。

## 常见坑

- `World` 只代表已加载世界。配置里的 key 不一定能解析到一个 loaded world。
- `unloadChunk(...)` 不保证 chunk 立刻卸载；它只是允许卸载。
- 实体查询只覆盖 loaded entities，不会扫描离线或未加载区域。
- `fillBlocks(...)` 的区域是包含边界的 inclusive cuboid。
- `BlockBatchOptions.immediate()` 可能一次性修改大量方块，只适合你确定规模很小或可承受的场景。
- 动态世界不是插件作用域临时资源；创建后需要你自己决定何时卸载。

## 综合示例：创建竞技场并铺设地板

下面的例子创建一个虚空世界，加载中心 chunk，铺设玻璃平台，然后把玩家传送过去。

```java
package com.example;

import io.fand.api.Fand;
import io.fand.api.block.BlockKey;
import io.fand.api.block.BlockTypes;
import io.fand.api.component.DataComponentMap;
import io.fand.api.entity.Player;
import io.fand.api.plugin.PluginContext;
import io.fand.api.world.BlockBatchOptions;
import io.fand.api.world.WorldCreateOptions;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class ArenaWorlds {
    private final PluginContext context;

    public ArenaWorlds(PluginContext context) {
        this.context = context;
    }

    public void createAndEnter(Player player) {
        var key = Key.key("example:arena");

        Fand.server().createWorld(key, WorldCreateOptions.voidWorld())
                .thenCompose(world -> world.loadChunk(0, 0).thenApply(loaded -> world))
                .thenCompose(world -> {
                    var min = world.at(-8, 64, -8);
                    var max = world.at(8, 64, 8);
                    return world.fillBlocks(
                            min,
                            max,
                            BlockTypes.of(BlockKey.GLASS),
                            DataComponentMap.EMPTY,
                            BlockBatchOptions.defaults())
                            .thenApply(result -> world);
                })
                .thenAccept(world -> {
                    player.teleport(world.at(0.5, 65.0, 0.5));
                    player.sendMessage(Component.text("Arena ready"));
                })
                .exceptionally(failure -> {
                    context.logger().warn("Failed to create arena", failure);
                    player.sendMessage(Component.text("Arena creation failed"));
                    return null;
                });
    }
}
```
