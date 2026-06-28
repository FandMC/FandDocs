# 玩家

`Player` 是在线玩家的实时句柄，同时也是 `LivingEntity`、`CommandSender` 和 `PermissionSubject`。玩家断开连接后，这个句柄仍然可以作为引用存在，但 `online()` 会变成 `false`，读取到的状态也可能只是最后一次已知值。

> [!IMPORTANT]
> `fand-api` 中的默认方法体不是运行时能力说明。玩家皮肤、计分板、假方块、打开书、冷却组等能力以目标 Fand Server 运行时为准。

## 查找玩家

```java
Fand.server().players();
Fand.server().player(uuid);
Fand.server().player("Steve");
```

`players()` 返回当前在线玩家列表的快照。`player(String)` 按精确名称查询；需要处理大小写不确定、离线玩家资料、封禁或白名单时，用 `playerAccess()`。

```java
context.scheduler().runAsync(() -> {
    var future = Fand.server().playerAccess().profile("Steve");

    future.thenAccept(profile -> context.scheduler().runMain(() -> {
        profile.ifPresent(value -> context.logger().info("uuid={}", value.uniqueId()));
    }));
});
```

`PlayerAccessService.profile(...)` 和 `offlinePlayer(...)` 可能访问 Mojang 会话服务或读取磁盘。异步回调里不要直接修改世界或玩家背包，先切回服务端线程。

## 连接和客户端状态

```java
player.online();
player.ping();
player.clientSettings().locale();
player.clientSettings().viewDistance();

player.kick(Component.text("Restarting"));
```

`ClientSettings` 来自客户端最近一次设置数据包。它适合用来判断语言、主副手、皮肤部件、聊天可见性等偏好，但这些值由客户端上报，不要把它当成权限或安全边界。

## 位置、移动和状态

玩家继承 `Entity` 和 `LivingEntity`：

```java
player.location();
player.eyeLocation();
player.teleport(targetLocation);
player.setVelocity(new Vector3(0.0, 0.6, 0.0));
player.damage(2.0);
```

玩家专属状态：

```java
player.gameMode();
player.setGameMode(GameMode.ADVENTURE);
player.setFoodLevel(20);
player.setSaturation(5.0F);
player.giveExperience(30);
player.setAllowFlight(true);
player.setFlying(true);
```

真实客户端的 `input()` 反映最近一次移动按键。`setInput(...)` 主要给模拟玩家或特殊控制逻辑使用。

## 背包和鼠标物品

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

空槽使用 `ItemStack.EMPTY`，不是 `null`。写入背包会修改在线玩家状态；异步任务里可以先构造物品，真正写回背包时要回到服务端线程。

## 打开容器菜单

普通菜单优先使用 [`GuiService`](/cn/api/gui)。只有确实需要打开一个临时原版容器菜单时，才直接使用 `openInventory(...)`。

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

`InventoryOpenEvent` 可能取消打开流程，所以异步结果可能是 `Optional.empty()` 或 `false`。

## 只给玩家看到的效果

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

只给单个玩家看的方块或实体效果，优先使用玩家表现 API 或数据包幻象；不要为了一个视觉效果去修改真实世界。

资源包请求：

```java
import io.fand.api.player.ResourcePackRequest;

player.sendResourcePack(ResourcePackRequest.of(
        "https://cdn.example.com/pack.zip",
        "0123456789abcdef0123456789abcdef01234567")
        .required(true)
        .prompt(Component.text("This server uses a resource pack")));
```

资源包 hash 最长 40 个字符，URL 不能为空。

## 统计、配方和冷却

```java
import io.fand.api.player.StatisticKey;

var jumps = player.statistic(StatisticKey.JUMP);
player.incrementStatistic(StatisticKey.JUMP, 1);

player.hasCooldown(ItemTypes.of(ItemKey.ENDER_PEARL));
player.setCooldown(ItemTypes.of(ItemKey.ENDER_PEARL), 20 * 5);
player.clearCooldown(ItemTypes.of(ItemKey.ENDER_PEARL));
```

固定的原版统计项使用 `StatisticKey`。只有自定义统计项或配置里读出来的 key，才需要使用 `Key`。

## 为什么这样设计

Fand 把玩家建模成“在线连接 + 实体 + 命令发送者 + 权限主体”。这样消息、权限、实体状态、背包和玩家可见效果都能围绕同一个 `Player` 句柄工作。

玩家 API 使用属性式读取方法，例如 `player.location()`、`player.inventory()`、`player.gameMode()`。这和 Java record 风格一致，也能把读取和副作用操作区分开：读取像名词，修改使用 `set*` 或动词。

离线身份、封禁、白名单和 OP 不挂在 `Player` 上，而是放在 `PlayerAccessService`，因为这些能力并不要求玩家在线。

## 最佳实践

- 玩家可能在异步操作完成前下线；回调里先检查 `online()`。
- 修改世界、背包、实体和 GUI 前回到服务端线程。
- 用 `PlayerAccessService` 处理离线玩家、封禁、白名单和 OP。
- 固定 vanilla 物品、声音、统计使用生成 key。
- 普通菜单用 `GuiService`，只有需要原始容器时才直接 `openInventory(...)`。
- 做视觉效果时先判断它是不是真实世界状态；如果只是单个玩家看到的效果，优先用数据包幻象。

## 常见坑

- 缓存 `Player` 后不检查 `online()`。
- 在 `profile(...)` 异步回调里直接修改玩家背包或世界。
- 把 `ping()` 和 `setDisplayedPing(...)` 混为一谈；前者是真实 keep-alive 延迟，后者是 tab 展示值。
- 忘记处理 `Inventory.add(...)` 返回的剩余物品。
- 用 `player(String)` 查离线玩家或大小写不确定的名称。
- 把客户端 `locale`、skin part 等设置当成可信安全数据。

## 综合示例：进入训练模式

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
