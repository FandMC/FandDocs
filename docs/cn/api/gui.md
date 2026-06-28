# GUI

`GuiService` 提供轻量容器菜单。`Gui` 是不可变模板，定义容器类型、标题、槽位物品、槽位点击处理器、保护槽和关闭回调；`GuiView` 是某个玩家当前打开的菜单实例，保存玩家、底层容器、视图状态和刷新/关闭能力。

GUI 点击处理器由容器点击事件路由而来，在服务端线程执行，可以安全读取和修改世界、实体、背包等服务端状态。耗时 I/O 仍然应该放到异步任务里做，完成后再回服务端线程打开或刷新菜单。

## 基本结构

```java
import io.fand.api.gui.Gui;
import net.kyori.adventure.text.Component;

var gui = Gui.chest(3, Component.text("Example Menu"))
        .button(10, confirmItem, click -> {
            click.player().sendMessage(Component.text("Confirmed"));
            click.view().close();
        })
        .button(16, cancelItem, click -> click.view().close())
        .onClose(close -> {
            context.logger().debug("{} closed menu", close.player().name());
        })
        .build();

context.guis().open(player, gui);
```

`button(slot, item, handler)` 会同时设置物品、点击处理器，并把这个槽位标记为受保护。受保护槽会取消玩家点击，避免按钮物品被拿走。只设置 `handler(slot, ...)` 也会触发点击处理并取消该槽位；只设置 `protectedSlot(slot)` 则只保护物品，不执行业务逻辑。

## 容器类型和尺寸

`Gui` 提供常用 vanilla 容器入口：

```java
Gui.chest(6, title);
Gui.anvil(title);
Gui.furnace(title);
Gui.blastFurnace(title);
Gui.smoker(title);
Gui.enchanting(title);
Gui.brewing(title);
```

也可以使用通用 builder：

```java
var gui = Gui.builder(inventoryType, size, title)
        .item(0, item)
        .protectedSlot(0)
        .handler(0, click -> click.player().sendMessage(Component.text("Clicked")))
        .build();
```

`chest(rows, title)` 的实际 size 是 `rows * 9`。其它容器的 size 由 API 入口固定，例如 anvil/furnace 是 3，brewing 是 5。所有 slot 都必须在 `0 <= slot < size` 范围内，否则构建时会抛出越界错误。

## 物品、按钮和保护槽

`item(slot, item)` 只设置展示物品，不会自动取消点击。适合展示玩家可以正常交互的槽位。

`protectedSlot(slot)` 只保护槽位，不执行 handler。适合边框、背景、占位物品。

`handler(slot, handler)` 安装点击处理器。当前运行时会取消注册了点击处理器的 GUI 槽位点击，避免原版移动物品和插件逻辑同时发生。

`button(slot, item, handler)` 是最常用的组合：展示物品、安装 handler、保护槽位。

## 点击上下文

点击处理器会收到 `GuiClick`，里面包含当前菜单视图、玩家、GUI 容器、槽位、点击类型、动作、当前槽位物品和鼠标上拿着的物品。

```java
.button(13, rewardItem, click -> {
    if (click.cursorItem().isEmpty()) {
        click.player().sendMessage(Component.text("Reward selected"));
    }
})
```

`GuiClick.currentItem()` 和 `GuiClick.cursorItem()` 是点击发生时的快照。需要修改玩家鼠标上拿着的物品时，用 `click.view().setCursorItem(item)`。

## 分页

`page(startSlot, pageSize, page, items, renderer)` 会把集合中的一页渲染到连续槽位，并保护这些槽位。renderer 收到的是集合中的绝对下标，不是当前页内的局部下标。

```java
var gui = Gui.chest(6, Component.text("Rewards"))
        .page(0, 45, page, rewards, index -> rewards.get(index).icon())
        .button(45, previousItem, click -> openPage(click.player(), page - 1))
        .button(53, nextItem, click -> openPage(click.player(), page + 1))
        .build();
```

如果 `page` 超出数据范围，未填满的槽位会自动放 `ItemStack.EMPTY` 并保持受保护状态，适合固定布局。

## GuiView 状态

`GuiView` 可以保存视图级状态，适合记录当前页、过滤条件或临时选择。状态是每个打开视图独立的，不会影响同一个 `Gui` 模板被其它玩家打开的实例。

```java
var view = context.guis().open(player, gui);
view.state("page", 0);

view.state("page")
        .map(Integer.class::cast)
        .ifPresent(page -> context.logger().debug("page={}", page));
```

刷新同一个 GUI 时，可以更新状态后调用 `reopen()`：

```java
view.state("page", nextPage);
view.reopen();
```

`reopen()` 会重新打开当前视图使用的容器，并重新应用 GUI 内容和属性。需要完全重建页面布局时，更常见的方式是用新的 `Gui` 模板再次 `open(player, gui)`。

## 容器属性

`property(id, value)` 和 `GuiView.setProperty(id, value)` 用于 vanilla 容器属性，例如炉子进度、附魔台状态等。属性 id 的含义取决于容器类型；Fand 只负责把整数属性发送给当前打开的 menu。

```java
var gui = Gui.furnace(Component.text("Progress"))
        .property(0, 40)
        .property(1, 200)
        .build();

var view = context.guis().open(player, gui);
view.setProperty(0, 80);
```

如果你只是做普通菜单，不需要使用属性。

## 查询和关闭视图

```java
context.guis().openView(player).ifPresent(GuiView::close);

for (var view : context.guis().openViews(gui)) {
    view.close();
}
```

在插件作用域里，`openView(player)` 和 `openViews(gui)` 只返回当前插件追踪到的 GUI 视图。玩家手动关闭容器菜单、插件调用 `view.close()`、或打开新的 GUI 替换旧 GUI 时，关闭回调都会按视图生命周期触发。

## 为什么这样设计

Fand 把 `Gui` 和 `GuiView` 分开，是为了区分“可复用的界面模板”和“某个玩家当前打开的实例”。同一个菜单结构可以被多个玩家打开，每个玩家的页码、临时状态、鼠标物品和关闭行为都应互不影响。

槽位点击处理器绑定在槽位上，而不是让插件直接监听底层容器数据包，是为了把常见 GUI 交互留在稳定 API 层。插件只需要处理 `GuiClick`，运行时负责把底层容器点击转成玩家、槽位、按钮、鼠标物品、当前槽位物品等上下文。

分页和 `state` 是轻量工具，不是完整 UI 框架。它们解决最常见的菜单问题：一组物品怎么铺到多个槽位、玩家当前查看哪一页、点击后怎样刷新当前视图。复杂应用仍然可以在插件自己的模型里维护状态。

## 最佳实践

- GUI 模板尽量保持不可变，把每个玩家的页码、过滤器、选择项放进 `GuiView.state` 或你的会话对象。
- 点击处理器里只做短逻辑。数据库、HTTP、文件读取放到 `runAsync`，拿到结果后用 `runMain` 打开或刷新 GUI。
- 对按钮、边框和分页区域使用 `button` 或 `protectedSlot`，避免玩家取走占位物品。
- 重建页面时优先写一个 `openXxxMenu(player, page)` 方法，点击上一页/下一页时重新调用它。
- 关闭回调中避免无条件立刻重新打开同一个 GUI，否则玩家可能无法正常退出菜单。

## 常见坑

- `item(slot, item)` 不会保护 slot；只展示不保护时，玩家可以把物品拿走。
- `page` 的 renderer 参数是集合绝对下标。不要再加 `page * pageSize`。
- `GuiView.state(String)` 返回 `Optional<Object>`，读取时需要自己 cast 到目标类型。
- `Gui` 是模板，不是玩家会话。不要把玩家状态写进共享字段后复用同一个模板。
- `close()` 会触发关闭回调。若关闭回调内又调用 `open`，要确保这是你真正想要的流程。

## 综合示例：分页传送菜单

下面的例子把命令、异步加载、分页、按钮、状态和传送组合在一起。真实项目里 `loadWarps()` 可以替换成数据库或文件读取。

```java
package com.example;

import io.fand.api.item.ItemStack;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.plugin.PluginContext;
import io.fand.api.entity.Player;
import io.fand.api.world.Location;
import io.fand.api.gui.Gui;
import java.util.List;
import net.kyori.adventure.text.Component;

public final class WarpMenu {
    private static final int PAGE_SIZE = 45;

    private final PluginContext context;

    public WarpMenu(PluginContext context) {
        this.context = context;
    }

    public void open(Player player, int page) {
        var fallback = player.location();

        context.scheduler().runAsync(() -> {
            var warps = loadWarps(fallback);

            context.scheduler().runMain(() -> {
                var maxPage = Math.max(0, (warps.size() - 1) / PAGE_SIZE);
                var currentPage = Math.max(0, Math.min(page, maxPage));

                var builder = Gui.chest(6, Component.text("Warps"))
                        .page(0, PAGE_SIZE, currentPage, warps, index -> icon(warps.get(index)))
                        .button(45, named(ItemKey.ARROW, "Previous"), click -> open(click.player(), currentPage - 1))
                        .button(49, named(ItemKey.BARRIER, "Close"), click -> click.view().close())
                        .button(53, named(ItemKey.ARROW, "Next"), click -> open(click.player(), currentPage + 1))
                        .onClose(close -> context.logger().debug("{} closed warp menu", close.player().name()));

                for (int slot = 0; slot < PAGE_SIZE; slot++) {
                    int warpIndex = currentPage * PAGE_SIZE + slot;
                    if (warpIndex >= warps.size()) {
                        break;
                    }
                    var warp = warps.get(warpIndex);
                    builder.handler(slot, click -> {
                        click.view().close();
                        click.player().teleport(warp.location());
                    });
                }

                var gui = builder.build();
                var view = context.guis().open(player, gui);
                view.state("page", currentPage);
            });
        });
    }

    private List<Warp> loadWarps(Location fallback) {
        return List.of(
                new Warp("Spawn", fallback),
                new Warp("Market", fallback));
    }

    private ItemStack icon(Warp warp) {
        return named(ItemKey.ENDER_PEARL, warp.name());
    }

    private ItemStack named(ItemKey item, String name) {
        return ItemTypes.of(item).one().withCustomName(Component.text(name));
    }

    private record Warp(String name, Location location) {
    }
}
```
