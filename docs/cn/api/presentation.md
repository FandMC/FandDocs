# 玩家表现

这一页覆盖 BossBar、TabList 和 Map。它们都属于“玩家看见什么”的 API：BossBar 管理屏幕顶部进度条，TabList 管理 per-viewer 玩家列表，Map 管理地图像素和 cursor。

## BossBar

有两种常用方式：注册一个 keyed boss bar，或临时发送一个持续一段时间的 boss bar。

```java
import java.time.Duration;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

var bar = context.bossBars().register(
        Key.key("example-plugin:countdown"),
        Component.text("Starting"),
        1.0f,
        BossBar.Color.GREEN,
        BossBar.Overlay.PROGRESS);

bar.show(player);
bar.setProgress(0.5f);
bar.setTitle(Component.text("Half way"));
```

临时发送：

```java
context.bossBars().send(
        player,
        Component.text("Saved"),
        1.0f,
        BossBar.Color.BLUE,
        BossBar.Overlay.PROGRESS,
        Duration.ofSeconds(3));
```

`BossBarRegistration.close()` 会隐藏并移除 keyed bar。插件作用域注册的 bar 会随插件禁用清理。

## TabList 可见性

`TabListService` 的基本操作是控制一个 viewer 看到哪些 target。

```java
context.tabLists().setVisible(viewer, target, false);
context.tabLists().setVisible(viewer, target, true);

context.tabLists().showOnly(viewer, List.of(viewer, teammate));
```

`showOnly` 会按当前运行时服务的实现修改 viewer 的玩家列表可见性。插件卸载时，插件作用域包装层会清理它追踪到的条目和可恢复状态。

## TabList 虚拟行

`TabListEntry` 可以描述真实玩家、虚拟行或来自其它服务器的远程玩家。

```java
import io.fand.api.entity.GameMode;
import io.fand.api.tablist.TabListEntry;
import java.util.UUID;

var entry = TabListEntry.builder(UUID.randomUUID(), "Lobby-1")
        .displayName(Component.text("Lobby-1: 42 players"))
        .latency(20)
        .gameMode(GameMode.SURVIVAL)
        .order(100)
        .build();

context.tabLists().add(viewer, entry);
context.tabLists().update(viewer, entry.withLatency(10));
context.tabLists().remove(viewer, entry.profile().uniqueId());
```

`TabListGroup` 和 `TabListLayout` 可以把一组玩家转换成排序后的条目：

```java
var group = TabListGroup.of(player -> player.hasPermission("example.staff"))
        .withOrder(Comparator.comparing(Player::name))
        .withOrderBase(0);

context.tabLists().apply(viewer, TabListLayout.from(group, Fand.server().players()));
```

`TabListSyncStrategy` 用于 proxy/cluster 把远端玩家行同步给某个 viewer。

## Map 渲染

地图是 128x128 像素 canvas。`MapRenderer` 写入颜色索引；`PlayerMapRenderer` 可以按 viewer 输出不同内容。

```java
var map = context.maps().create((view, canvas) -> {
    canvas.clear((byte) 0);
    for (int x = 0; x < MapCanvas.WIDTH; x++) {
        canvas.pixel(x, 64, (byte) 34);
    }
});

map.render();
map.sendUpdate(player);
```

已有地图可以按 id 查询：

```java
context.maps().map(mapId).ifPresent(view -> {
    view.renderer(renderer);
    view.render(player);
});
```

## 地图持久状态

renderer 是插件作用域资源；但 map center、scale、tracking、locked、cursors 属于底层地图状态，修改后不是“插件卸载自动恢复”的临时 UI。

```java
view.setCenter(player.location().blockX(), player.location().blockZ());
view.setScale(MapScale.NORMAL);
view.setLocked(true);
```

只想做临时表现时，优先使用 renderer 输出和 per-player render/update；需要修改真实地图数据时，再调用这些状态方法。

## 使用建议

- BossBar 适合任务进度、短提示、战斗状态；复杂 HUD 用 Scoreboard 或 packet helper。
- TabList 是 per-viewer API；同一个 target 可以对不同 viewer 有不同展示。
- 地图渲染循环里不要做昂贵查询，提前缓存需要绘制的数据。
- 会持久修改世界或地图数据的 API，要在插件文档里向服主说明。

## 为什么这样设计

BossBar、TabList 和 Map 都是“玩家看到什么”的 API，但它们的生命周期完全不同。BossBar 是 keyed UI 资源，可以展示给一个或多个玩家；TabList 是 per-viewer 玩家列表行；Map renderer 是地图像素输出，和底层地图状态有边界。

TabList 使用 `viewer` 作为第一个参数，是为了明确“谁看见了什么”。同一个真实玩家、远端玩家或虚拟行，可以在不同 viewer 的玩家列表里有不同延迟、排序、显示名和可见性。

Map API 把 renderer 和 center/scale/tracking/locked/cursors 分开，是因为 renderer 更像临时展示层，而后者属于底层地图状态。插件卸载可以清理 renderer，但不能假装世界里的地图状态没有被改过。

## 最佳实践

- BossBar 用 key 注册长期状态，用 `send(..., duration)` 发送短提示。
- 更新 BossBar 时复用 handle，只改 title/progress/color，不要反复注册同一个 key。
- TabList 虚拟行使用稳定 UUID；更新同一行时调用 `update`。
- `showOnly` 适合小游戏、观战、分服视图等明确隔离场景。
- 地图 renderer 中只读缓存好的数据；复杂计算放到渲染前完成。
- 只想临时展示地图内容时使用 renderer 和 per-player render/update，避免修改 center/scale/locked 等持久状态。

## 常见坑

- BossBar progress 应保持在 Adventure BossBar 接受的范围内，业务上通常用 `0.0f` 到 `1.0f`。
- TabList 操作是 per-viewer 的；给一个 viewer 添加虚拟行，不代表所有玩家都能看到。
- `showOnly` 会修改真实玩家列表可见性，小游戏结束后要恢复。
- 地图 center、scale、tracking、locked、cursors 是底层地图状态，不会因为插件卸载自动回滚。
- 地图是 128x128 canvas，坐标越界或每像素昂贵计算都会让渲染变慢。

## 综合示例：倒计时 BossBar 和大厅 Tab 行

下面的例子为玩家显示一个倒计时 BossBar，同时给他的 TabList 添加一个虚拟大厅状态行。

```java
package com.example;

import io.fand.api.entity.GameMode;
import io.fand.api.entity.Player;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import io.fand.api.tablist.TabListEntry;
import java.util.UUID;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    private static final UUID LOBBY_ROW_ID = UUID.fromString("00000000-0000-0000-0000-000000000101");

    @Override
    public void onEnable(PluginContext context) {
        context.bossBars().register(
                Key.key("example:countdown"),
                Component.text("Starting soon"),
                1.0f,
                BossBar.Color.GREEN,
                BossBar.Overlay.PROGRESS);
    }

    public void showLobbyState(PluginContext context, Player viewer, int secondsLeft, int online) {
        context.bossBars().bar(Key.key("example:countdown")).ifPresent(bar -> {
            bar.show(viewer);
            bar.setTitle(Component.text("Starting in " + secondsLeft + "s"));
            bar.setProgress(Math.max(0.0f, Math.min(1.0f, secondsLeft / 30.0f)));
        });

        var entry = TabListEntry.builder(LOBBY_ROW_ID, "Lobby")
                .displayName(Component.text("Lobby online: " + online))
                .gameMode(GameMode.SURVIVAL)
                .latency(0)
                .order(100)
                .build();

        context.tabLists().update(viewer, entry);
    }
}
```
