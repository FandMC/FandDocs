# GUI

`GuiService` 提供轻量库存 GUI。`Gui` 是模板，`GuiView` 是某个玩家当前打开的实例。slot handler 和 close handler 会随 GUI 视图处理玩家交互。

## 创建 GUI

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

`button(slot, item, handler)` 会同时设置物品、handler，并把该 slot 标记为 protected。protected slot 用于阻止玩家把 GUI 按钮拿走。

## 常用 Builder

`Gui` 提供多种 vanilla 容器入口：

```java
Gui.chest(6, title);
Gui.anvil(title);
Gui.furnace(title);
Gui.blastFurnace(title);
Gui.smoker(title);
Gui.enchanting(title);
Gui.brewing(title);
```

也可以用通用 builder：

```java
var gui = Gui.builder(inventoryType, size, title)
        .item(0, item)
        .protectedSlot(0)
        .handler(0, click -> click.player().sendMessage(Component.text("Clicked")))
        .build();
```

## 分页

`page` 会把集合渲染到连续 slot，并保护这些 slot。

```java
var gui = Gui.chest(6, Component.text("Rewards"))
        .page(0, 45, page, rewards, index -> rewards.get(index).icon())
        .button(45, previousItem, click -> openPage(click.player(), page - 1))
        .button(53, nextItem, click -> openPage(click.player(), page + 1))
        .build();
```

## GuiView 状态

`GuiView` 可以保存视图级状态，适合记录当前页、过滤条件或临时选择。

```java
var view = context.guis().open(player, gui);
view.state("page", 0);

view.state("page")
        .map(Integer.class::cast)
        .ifPresent(page -> context.logger().debug("page={}", page));
```

如果需要刷新同一个 GUI，可以修改状态后调用 `reopen()`。

```java
view.state("page", nextPage);
view.reopen();
```

## 查询打开的视图

```java
context.guis().openView(player).ifPresent(GuiView::close);

for (var view : context.guis().openViews(gui)) {
    view.close();
}
```

## 使用建议

- GUI handler 中只做轻量逻辑；耗时加载放到异步任务，完成后回主线程打开或刷新 GUI。
- 按钮 slot 使用 `button` 或 `protectedSlot`，避免玩家取走占位物品。
- 每个玩家的临时状态放在 `GuiView.state`，不要塞进全局静态变量。
- 插件禁用时，插件作用域 GUI 资源会被清理；外部资源仍由插件自己关闭。
