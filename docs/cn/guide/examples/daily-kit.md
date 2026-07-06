# 每日礼包插件

这个示例注册 `/dailykit` 命令。玩家每天可以领取一次简单礼包，冷却时间保存在插件自己的玩家存储里。

它演示命令、背包添加物品、`PluginStorage` 玩家作用域，以及使用数据生成的 `ItemKey` 创建原版物品。

## DailyKitPlugin.java

```java
package com.example.dailykit;

import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;

public final class DailyKitPlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        var command = new DailyKitCommand(context);
        context.commands().register("dailykit", root -> root
                .permission("dailykit.claim")
                .executes(command::execute));
    }
}
```

## DailyKitCommand.java

```java
package com.example.dailykit;

import io.fand.api.command.CommandContext;
import io.fand.api.entity.Player;
import io.fand.api.item.ItemKey;
import io.fand.api.item.ItemTypes;
import io.fand.api.plugin.PluginContext;
import java.time.Duration;
import net.kyori.adventure.text.Component;

final class DailyKitCommand {
    private static final String LAST_CLAIM_KEY = "lastClaimMillis";
    private static final long COOLDOWN_MILLIS = Duration.ofHours(24).toMillis();

    private final PluginContext context;

    DailyKitCommand(PluginContext context) {
        this.context = context;
    }

    void execute(CommandContext command) {
        var sender = command.sender();
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("只有玩家可以领取礼包"));
            return;
        }

        var storage = context.storage().player(player.uniqueId());
        long now = System.currentTimeMillis();
        long lastClaim = storage.get(LAST_CLAIM_KEY)
                .map(element -> element.getAsJsonPrimitive().getAsLong())
                .orElse(0L);

        long remaining = COOLDOWN_MILLIS - (now - lastClaim);
        if (remaining > 0) {
            player.sendMessage(Component.text("还要等待 " + formatTime(remaining) + " 才能再次领取"));
            return;
        }

        giveKit(player);
        storage.set(LAST_CLAIM_KEY, new com.google.gson.JsonPrimitive(now));
        storage.flush();

        player.sendMessage(Component.text("每日礼包已发放"));
    }

    private static void giveKit(Player player) {
        addOrDrop(player, ItemTypes.of(ItemKey.BREAD).stack(16));
        addOrDrop(player, ItemTypes.of(ItemKey.TORCH).stack(16));
        addOrDrop(player, ItemTypes.of(ItemKey.IRON_PICKAXE).one());
    }

    private static void addOrDrop(Player player, io.fand.api.item.ItemStack stack) {
        var leftover = player.inventory().add(stack);
        if (!leftover.isEmpty()) {
            player.location().world().dropItem(player.location(), leftover);
        }
    }

    private static String formatTime(long millis) {
        long minutes = Math.max(1, Duration.ofMillis(millis).toMinutes());
        long hours = minutes / 60;
        long restMinutes = minutes % 60;
        return hours > 0 ? hours + " 小时 " + restMinutes + " 分钟" : restMinutes + " 分钟";
    }
}
```

这里使用 `context.storage().player(player.uniqueId())`，所以每个玩家有自己的冷却数据。`set(...)` 只改内存中的作用域数据，`flush()` 才把这个作用域写回磁盘。

## 可以继续改进

- 把礼包内容和冷却时间放进配置文件。
- 给命令补全和权限默认值。
- 用异步任务批量持久化，避免在高频命令里频繁刷盘。
- 发物品前检查背包剩余空间，并给玩家更明确的提示。
