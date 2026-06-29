# Join Welcome Plugin

This example listens for player joins, changes the public join message, and sends a private welcome message two seconds later.

It shows event subscription, event mutation, delayed main-thread scheduling, and why event listeners should stay short.

## Complete Code

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
                player.sendMessage(Component.text("Welcome to the Fand server, " + player.name()));
                player.sendMessage(Component.text("Use /help to see available commands"));
            }, Duration.ofSeconds(2));
        });
    }
}
```

`PlayerJoinEvent#setMessage(...)` changes the broadcast join message. `player.sendMessage(...)` sends only to the joining player.

## Next Improvements

- Read welcome messages from config.
- Show different text for first-time players.
- Use MiniMessage for colors and placeholders.
- Move audit logs, database writes, or network calls into `context.scheduler().runAsync(...)`.
