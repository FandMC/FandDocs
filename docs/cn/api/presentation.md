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
