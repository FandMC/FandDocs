# Players

`Player` is a live handle for an online player. It is also a `LivingEntity`, `CommandSender`, and `PermissionSubject`. After disconnect, the handle can still exist as a reference, but `online()` becomes `false` and reads may return last-known values.

> [!IMPORTANT]
> Default method bodies in `fand-api` are not runtime capability documentation. Skin changes, per-player scoreboards, fake blocks, book opening, cooldown groups, and similar features depend on the target Fand Server runtime.

## Looking Up Players

```java
Fand.server().players();
Fand.server().player(uuid);
Fand.server().player("Steve");
```

`players()` returns a snapshot of online players. `player(String)` is exact-name lookup; use `playerAccess()` for case-insensitive or offline identity workflows.

```java
context.scheduler().runAsync(() -> {
    var future = Fand.server().playerAccess().profile("Steve");

    future.thenAccept(profile -> context.scheduler().runMain(() -> {
        profile.ifPresent(value -> context.logger().info("uuid={}", value.uniqueId()));
    }));
});
```

`PlayerAccessService.profile(...)` and `offlinePlayer(...)` may use session-service or disk I/O. Do not mutate worlds or inventories directly from their future callbacks; marshal back to the server thread first.

## Connection and Client State

```java
player.online();
player.ping();
player.clientSettings().locale();
player.clientSettings().viewDistance();

player.kick(Component.text("Restarting"));
```

`ClientSettings` comes from the client's latest settings packet. It is useful for locale, main hand, skin parts, chat visibility, and similar preferences, but the client controls these values; do not treat them as a permission or security boundary.

## Location, Movement, and State

Players inherit `Entity` and `LivingEntity`:

```java
player.location();
player.eyeLocation();
player.teleport(targetLocation);
player.setVelocity(new Vector3(0.0, 0.6, 0.0));
player.damage(2.0);
```

Player-specific state:

```java
player.gameMode();
player.setGameMode(GameMode.ADVENTURE);
player.setFoodLevel(20);
player.setSaturation(5.0F);
player.giveExperience(30);
player.setAllowFlight(true);
player.setFlying(true);
```

For real clients, `input()` reflects the most recent movement input. `setInput(...)` is mainly useful for simulated players or special control logic.

## Inventory and Cursor Item

```java
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemStack;
import io.fand.api.item.ItemTypes;

var inventory = player.inventory();
var held = inventory.heldItem();

inventory.setHeldItem(held.withCustomName(Component.text("Bound")));
inventory.setOffhandItem(ItemTypes.of(ItemKey.SHIELD).one());

var leftover = inventory.add(ItemTypes.of(ItemKey.DIAMOND).stack(3));
if (!leftover.isEmpty()) {
    player.world().dropItem(player.location(), leftover);
}

player.setCursorItem(ItemStack.EMPTY);
```

Empty slots use `ItemStack.EMPTY`, not `null`. Inventory writes are live player state; build item values asynchronously if needed, then return to the main thread to write them.

## Opening Containers

Prefer [`GuiService`](/en/api/gui) for normal menus. Use `openInventory(...)` when you specifically need a raw transient vanilla container.

```java
import io.fand.api.inventory.InventoryType;

player.openInventory(InventoryType.CHEST, 27)
        .thenAccept(opened -> opened.ifPresent(inventory -> {
            inventory.set(13, rewardItem);
        }));

player.openInventory().ifPresent(inventory -> {
    context.logger().debug("open type={}", inventory.type());
});

player.closeInventory();
```

`InventoryOpenEvent` may cancel the open, so futures can complete with `Optional.empty()` or `false`.

## Presentation and Client Effects

```java
import io.fand.api.world.sound.SoundCategory;
import io.fand.api.world.sound.SoundEffect;
import io.fand.api.world.sound.SoundKey;

player.sendMessage(Component.text("Saved"));
player.playSound(SoundEffect.of(SoundKey.NOTE_BLOCK_PLING, SoundCategory.PLAYER));
player.sendTabList(Component.text("Fand"), Component.text("Have fun"));
player.setTabListDisplayName(Component.text("VIP " + player.name()));
player.setTabListOrder(10);
```

For block or entity effects visible to only one player, prefer player-presentation APIs or packet illusions; do not mutate real world state for a visual-only effect.

Resource-pack request:

```java
import io.fand.api.player.ResourcePackRequest;

player.sendResourcePack(ResourcePackRequest.of(
        "https://cdn.example.com/pack.zip",
        "0123456789abcdef0123456789abcdef01234567")
        .required(true)
        .prompt(Component.text("This server uses a resource pack")));
```

The hash length must be at most 40 characters, and the URL cannot be blank.

## Statistics, Recipes, and Cooldowns

```java
import io.fand.api.player.StatisticKey;

var jumps = player.statistic(StatisticKey.JUMP);
player.incrementStatistic(StatisticKey.JUMP, 1);

player.hasCooldown(ItemTypes.of(ItemKey.ENDER_PEARL));
player.setCooldown(ItemTypes.of(ItemKey.ENDER_PEARL), 20 * 5);
player.clearCooldown(ItemTypes.of(ItemKey.ENDER_PEARL));
```

Use `StatisticKey` for fixed vanilla statistics. Use raw `Key` only for custom keys or config-driven values.

## Design Philosophy

Fand models a player as "online connection + entity + command sender + permission subject." Messages, permissions, entity state, inventory, and presentation APIs all center on the same `Player` handle.

Player APIs use property-style accessors such as `player.location()`, `player.inventory()`, and `player.gameMode()`. This follows Java record style and separates reads from side effects: nouns read state, while `set*` methods and verbs mutate state.

Offline identity, bans, whitelist, and operators live on `PlayerAccessService` instead of `Player` because those workflows do not require an online player handle.

## Best Practices

- A player may disconnect before a future completes; check `online()` in callbacks.
- Return to the server thread before mutating worlds, inventories, entities, or GUIs.
- Use `PlayerAccessService` for offline players, bans, whitelist, and operators.
- Use generated keys for fixed vanilla items, sounds, and statistics.
- Use `GuiService` for ordinary menus; use direct `openInventory(...)` only when you need raw containers.
- Decide whether an effect changes real state or only one viewer's presentation; prefer packet illusions for the latter.

## Common Pitfalls

- Caching `Player` and not checking `online()`.
- Mutating inventory or world state directly from a `profile(...)` future callback.
- Confusing `ping()` with `setDisplayedPing(...)`; the former is real keep-alive latency, the latter is tab-list presentation.
- Ignoring leftovers returned by `Inventory.add(...)`.
- Using `player(String)` for offline or case-uncertain name lookup.
- Treating client-controlled settings such as locale or skin parts as trusted security data.

## Complete Example: Enter Training Mode

```java
package com.example;

import io.fand.api.entity.GameMode;
import io.fand.api.entity.Player;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.plugin.PluginContext;
import io.fand.api.world.sound.SoundCategory;
import io.fand.api.world.sound.SoundEffect;
import io.fand.api.world.sound.SoundKey;
import net.kyori.adventure.text.Component;

public final class TrainingMode {
    private final PluginContext context;

    public TrainingMode(PluginContext context) {
        this.context = context;
    }

    public void enter(Player player) {
        context.scheduler().runMain(() -> {
            if (!player.online()) {
                return;
            }

            player.setGameMode(GameMode.ADVENTURE);
            player.setFoodLevel(20);
            player.setSaturation(5.0F);
            player.setAllowFlight(false);

            var inventory = player.inventory();
            inventory.clear();
            inventory.setHeldItem(ItemTypes.of(ItemKey.IRON_SWORD)
                    .one()
                    .withItemName(Component.text("Training Sword")));
            inventory.setOffhandItem(ItemTypes.of(ItemKey.SHIELD).one());

            player.playSound(SoundEffect.of(SoundKey.NOTE_BLOCK_PLING, SoundCategory.PLAYER));
            player.sendMessage(Component.text("Training mode enabled"));
        });
    }
}
```
