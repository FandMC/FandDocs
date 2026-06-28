# GUI

`GuiService` provides lightweight inventory GUIs. `Gui` is an immutable template that defines the container type, title, slot items, slot handlers, protected slots, and close callback. `GuiView` is the live view opened for one player; it stores the player, backing inventory, view state, and refresh/close operations.

GUI handlers are routed from inventory click events and run on the server thread. It is safe to read or mutate server state inside them. Slow I/O should still run asynchronously, then return to the main thread before opening or refreshing a GUI.

## Basic Shape

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

`button(slot, item, handler)` sets the item, installs the handler, and marks the slot as protected. Protected slots cancel player clicks so menu items cannot be taken. A slot with only `handler(slot, ...)` is still handled and cancelled by the current runtime. A slot with only `protectedSlot(slot)` is protected but has no business logic.

## Container Types and Sizes

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

`chest(rows, title)` uses `rows * 9` slots. Other convenience entries use fixed sizes, such as 3 for anvil/furnace and 5 for brewing. Every slot must satisfy `0 <= slot < size`; invalid slots fail during construction.

## Items, Buttons, and Protected Slots

`item(slot, item)` only sets the display item. It does not protect the slot, so players may interact with it normally.

`protectedSlot(slot)` protects a slot without running a handler. Use it for borders, backgrounds, and placeholder items.

`handler(slot, handler)` installs click logic. The current runtime cancels clicks for handled GUI slots so vanilla item movement does not race plugin logic.

`button(slot, item, handler)` is the usual combination: display item, handler, and protection.

## Click Context

Handlers receive `GuiClick`, which contains the view, player, GUI inventory, slot, click type, inventory action, current item, and cursor item.

```java
.button(13, rewardItem, click -> {
    if (click.cursorItem().isEmpty()) {
        click.player().sendMessage(Component.text("Reward selected"));
    }
})
```

`GuiClick.currentItem()` and `GuiClick.cursorItem()` are snapshots from the click. Use `click.view().setCursorItem(item)` when you need to change the cursor item.

## Pagination

`page(startSlot, pageSize, page, items, renderer)` renders one page of a list into consecutive slots and protects those slots. The renderer receives the absolute item index in the list, not an index local to the current page.

```java
var gui = Gui.chest(6, Component.text("Rewards"))
        .page(0, 45, page, rewards, index -> rewards.get(index).icon())
        .button(45, previousItem, click -> openPage(click.player(), page - 1))
        .button(53, nextItem, click -> openPage(click.player(), page + 1))
        .build();
```

If the page runs past the end of the list, empty slots are filled with `ItemStack.EMPTY` and remain protected. This works well for fixed layouts.

## View State

`GuiView` stores view-scoped state such as page number, filters, or temporary selections. Each opened view has its own state; another player opening the same `Gui` template gets a separate view.

```java
var view = context.guis().open(player, gui);
view.state("page", 0);

view.state("page")
        .map(Integer.class::cast)
        .ifPresent(page -> context.logger().debug("page={}", page));
```

To refresh the same GUI, update state and call `reopen()`:

```java
view.state("page", nextPage);
view.reopen();
```

`reopen()` reopens the current view's inventory, then reapplies GUI contents and properties. If you need a different layout, it is usually clearer to build a new `Gui` template and call `open(player, gui)` again.

## Container Properties

`property(id, value)` and `GuiView.setProperty(id, value)` send vanilla container properties such as furnace progress or enchanting state. Property ids are container-specific; Fand only sends integer properties to the currently opened menu.

```java
var gui = Gui.furnace(Component.text("Progress"))
        .property(0, 40)
        .property(1, 200)
        .build();

var view = context.guis().open(player, gui);
view.setProperty(0, 80);
```

Most plain menus do not need properties.

## Querying and Closing Views

```java
context.guis().openView(player).ifPresent(GuiView::close);

for (var view : context.guis().openViews(gui)) {
    view.close();
}
```

Inside plugin scope, `openView(player)` and `openViews(gui)` return only GUI views tracked for the current plugin. The close handler runs when the player closes the inventory, a plugin calls `view.close()`, or a new GUI replaces the old one.

## Design Philosophy

Fand separates `Gui` from `GuiView` so reusable UI templates are not mixed with one player's live session. The same menu can be opened by multiple players, while each player keeps independent page state, temporary choices, cursor item, and close behavior.

Slot handlers are attached to GUI slots instead of requiring plugins to listen to low-level inventory packets. Plugins handle `GuiClick`; the runtime translates container clicks into viewer, slot, button, cursor, current item, and action context.

Pagination and `state` are lightweight helpers, not a full UI framework. They solve the common menu problems: render a list into slots, remember which page the viewer is on, and refresh the current view after a click. Complex applications should still keep their own domain state.

## Best Practices

- Keep `Gui` templates immutable; store player-specific page numbers, filters, and selections in `GuiView.state` or your own session object.
- Keep handlers short. Run database, HTTP, and file work with `runAsync`, then return with `runMain` before opening or refreshing the GUI.
- Use `button` or `protectedSlot` for buttons, borders, and paged areas so players cannot take placeholder items.
- Put page construction in a method such as `openXxxMenu(player, page)`, then call it again from next/previous buttons.
- Avoid unconditionally reopening the same GUI from a close handler, or players may be unable to exit the menu.

## Common Pitfalls

- `item(slot, item)` does not protect the slot; it only displays an item.
- The `page` renderer receives an absolute list index. Do not add `page * pageSize` again.
- `GuiView.state(String)` returns `Optional<Object>`, so callers must cast to the expected type.
- `Gui` is a template, not a player session. Do not store player state in shared fields and reuse the same template.
- `close()` triggers the close handler. Reopening from that handler should be deliberate.

## Complete Example: Paged Warp Menu

This example combines commands, async loading, pagination, buttons, state, and teleporting. In a real plugin, `loadWarps()` can read from a database or file.

```java
package com.example;

import io.fand.api.entity.Player;
import io.fand.api.gui.Gui;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemStack;
import io.fand.api.item.ItemTypes;
import io.fand.api.plugin.PluginContext;
import io.fand.api.world.Location;
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
