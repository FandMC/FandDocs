# GUI

`GuiService` provides lightweight inventory GUIs. `Gui` is the template, while `GuiView` is the live view opened for one player. Slot handlers and close handlers route player interaction for that view.

## Creating a GUI

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

`button(slot, item, handler)` sets the item, installs the handler, and marks the slot as protected. Protected slots prevent players from taking GUI button items.

## Common Builders

`Gui` provides entries for common vanilla containers:

```java
Gui.chest(6, title);
Gui.anvil(title);
Gui.furnace(title);
Gui.blastFurnace(title);
Gui.smoker(title);
Gui.enchanting(title);
Gui.brewing(title);
```

Use the generic builder for other inventory types:

```java
var gui = Gui.builder(inventoryType, size, title)
        .item(0, item)
        .protectedSlot(0)
        .handler(0, click -> click.player().sendMessage(Component.text("Clicked")))
        .build();
```

## Pagination

`page` renders a collection into consecutive slots and protects those slots.

```java
var gui = Gui.chest(6, Component.text("Rewards"))
        .page(0, 45, page, rewards, index -> rewards.get(index).icon())
        .button(45, previousItem, click -> openPage(click.player(), page - 1))
        .button(53, nextItem, click -> openPage(click.player(), page + 1))
        .build();
```

## View State

`GuiView` can store view-scoped state such as page number, filters, or temporary selections.

```java
var view = context.guis().open(player, gui);
view.state("page", 0);

view.state("page")
        .map(Integer.class::cast)
        .ifPresent(page -> context.logger().debug("page={}", page));
```

To refresh the same GUI, update state and call `reopen()`.

```java
view.state("page", nextPage);
view.reopen();
```

## Querying Open Views

```java
context.guis().openView(player).ifPresent(GuiView::close);

for (var view : context.guis().openViews(gui)) {
    view.close();
}
```

## Guidelines

- Keep GUI handlers lightweight; run slow loading asynchronously, then return to the main thread before opening or refreshing.
- Use `button` or `protectedSlot` for button slots so players cannot take placeholder items.
- Put per-player temporary state in `GuiView.state`, not global static variables.
- Plugin-scoped GUI resources are cleaned up when the plugin disables; external resources are still your responsibility.
