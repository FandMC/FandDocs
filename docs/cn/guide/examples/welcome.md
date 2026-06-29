# 进服欢迎插件

这个示例监听玩家加入事件，修改全服广播的加入消息，并在 2 秒后给玩家单独发送欢迎提示。

它演示事件订阅、事件对象修改、延迟主线程任务，以及为什么不要把复杂逻辑直接塞进事件监听器。

## 完整代码

```java
package com.example.welcome;

import io.fand.api.event.player.PlayerJoinEvent;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.time.Duration;
import net.kyori.adventure.text.Component;

public final class WelcomePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.events().subscribe(PlayerJoinEvent.class, event -> {
            var player = event.player();

            event.setMessage(Component.text("+ " + player.name()));

            context.scheduler().runMainAfter(() -> {
                if (!player.online()) {
                    return;
                }
                player.sendMessage(Component.text("欢迎来到 Fand 服务器，" + player.name()));
                player.sendMessage(Component.text("输入 /help 查看可用命令"));
            }, Duration.ofSeconds(2));
        });
    }
}
```

`PlayerJoinEvent#setMessage(...)` 改的是全服看到的加入广播。`player.sendMessage(...)` 只发给当前玩家。两个入口语义不同，不要混用。

## 可以继续改进

- 从配置文件读取欢迎语。
- 首次进服和普通进服显示不同内容。
- 用 MiniMessage 做彩色文本和占位符。
- 把审计日志、数据库记录等慢操作放到 `context.scheduler().runAsync(...)`。
