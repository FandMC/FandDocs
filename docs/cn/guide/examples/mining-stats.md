# 挖矿统计插件

这个示例监听方块破坏事件，统计玩家挖掉的钻石矿数量，并注册 `/minediamonds` 查询自己的统计。

它演示方块事件、`BlockKey` 数据生成常量、玩家作用域存储，以及统计命令。

## MiningStatsPlugin.java

入口类负责注册监听器和命令。统计字段放成常量，监听器和命令共用同一个 key。

```java
package com.example.mining;

import io.fand.api.command.CommandDescriptor;
import io.fand.api.event.block.BlockBreakEvent;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.util.List;

public final class MiningStatsPlugin implements Plugin {
    static final String DIAMONDS_MINED = "diamondsMined";

    @Override
    public void onEnable(PluginContext context) {
        context.events().subscribe(BlockBreakEvent.class, new MiningListener(context));

        context.commands().register(
                new CommandDescriptor("ignored", "minediamonds", List.of(), List.of(), "mining.stats"),
                new MiningStatsCommand(context));
    }

    @Override
    public void onDisable(PluginContext context) {
        context.storage().flush();
    }
}
```

## MiningListener.java

```java
package com.example.mining;

import io.fand.api.block.BlockKey;
import io.fand.api.event.EventListener;
import io.fand.api.event.block.BlockBreakEvent;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

final class MiningListener implements EventListener<BlockBreakEvent> {
    private final PluginContext context;

    MiningListener(PluginContext context) {
        this.context = context;
    }

    @Override
    public void on(BlockBreakEvent event) {
        if (!diamondOre(event)) {
            return;
        }

        var storage = context.storage().player(event.player().uniqueId());
        int mined = storage.getInt(MiningStatsPlugin.DIAMONDS_MINED).orElse(0) + 1;
        storage.setInt(MiningStatsPlugin.DIAMONDS_MINED, mined);

        if (mined % 10 == 0) {
            event.player().sendMessage(Component.text("你已经挖了 " + mined + " 个钻石矿"));
            storage.flush();
        }
    }

    private static boolean diamondOre(BlockBreakEvent event) {
        var key = event.blockType().key();
        return key.equals(BlockKey.DIAMOND_ORE.key())
                || key.equals(BlockKey.DEEPSLATE_DIAMOND_ORE.key());
    }
}
```

## MiningStatsCommand.java

```java
package com.example.mining;

import io.fand.api.command.CommandExecutor;
import io.fand.api.command.CommandSender;
import io.fand.api.entity.Player;
import io.fand.api.plugin.PluginContext;
import java.util.List;
import net.kyori.adventure.text.Component;

final class MiningStatsCommand implements CommandExecutor {
    private final PluginContext context;

    MiningStatsCommand(PluginContext context) {
        this.context = context;
    }

    @Override
    public void execute(CommandSender sender, String label, List<String> args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("只有玩家可以查询自己的统计"));
            return;
        }

        int mined = context.storage()
                .player(player.uniqueId())
                .getInt(MiningStatsPlugin.DIAMONDS_MINED)
                .orElse(0);
        player.sendMessage(Component.text("你已经挖了 " + mined + " 个钻石矿"));
    }
}
```

这里用的是生成出来的 `BlockKey.DIAMOND_ORE` 和 `BlockKey.DEEPSLATE_DIAMOND_ORE`，不要手写原版方块 id。这样编译时就能发现字段是否存在，也更容易跟随数据生成更新。

## 可以继续改进

- 统计更多矿物，使用 `Map<Key, Integer>` 或 JSON 对象存储。
- 在玩家退出或定时任务里批量 `flush()`，避免高频写盘。
- 增加排行榜命令。
- 如果事件被其它插件取消，需要根据业务决定是否统计取消的破坏。
