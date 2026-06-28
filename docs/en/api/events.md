# Events

Events are dispatched through `EventBus`. The bus is thread-safe, but it does not switch threads automatically: listeners run on the thread that fired the event. Player, entity, world, and inventory state should be accessed from the main thread; if a listener runs for an async event, hop back through the scheduler first.

```java
context.events().subscribe(PlayerJoinEvent.class, event -> {
    event.player().sendMessage(Component.text("Welcome to Fand"));
});
```

## Direct Subscription

Direct subscription is useful for simple listeners. The returned `EventSubscription` can be closed manually.

```java
import io.fand.api.event.EventSubscription;
import io.fand.api.event.player.PlayerJoinEvent;
import net.kyori.adventure.text.Component;

EventSubscription subscription = context.events().subscribe(PlayerJoinEvent.class, event -> {
    event.player().sendMessage(Component.text("Welcome to Fand"));
});

subscription.close();
```

Plugin-scoped event registrations are normally cleaned up when the plugin is disabled. Manual closing is mostly needed when you manage a temporary subscription yourself.

## Annotated Listeners

Annotated listeners are useful when related event handlers belong in one class. `registerListener` registers every `@Subscribe` method on the object, and the returned subscription unregisters all of them together.

```java
import io.fand.api.event.Listener;
import io.fand.api.event.Subscribe;
import io.fand.api.event.player.PlayerQuitEvent;
import net.kyori.adventure.text.Component;

final class PlayerListener implements Listener {
    @Subscribe
    void onQuit(PlayerQuitEvent event) {
        event.player().sendMessage(Component.text("Goodbye"));
    }
}

context.events().registerListener(new PlayerListener());
```

## Priority

Priorities run from low to high:

```text
LOWEST -> LOW -> NORMAL -> HIGH -> HIGHEST -> OBSERVER
```

`OBSERVER` is for logging, state synchronization, metrics, and other "observe the final result" logic. It should not mutate the event. Plugins that change event results should use `LOWEST` through `HIGHEST`.

```java
@Subscribe(priority = EventPriority.HIGH)
void onInteract(PlayerInteractEvent event) {
    if (event.player().hasPermission("example.bypass")) {
        event.setCancelled(false);
    }
}
```

## Cancellable Events

Events implementing `Cancellable` can be cancelled. The meaning is event-specific: some cancellations prevent an action, while others only affect later handling.

```java
import io.fand.api.event.Cancellable;

if (event instanceof Cancellable cancellable && !cancellable.cancelled()) {
    cancellable.setCancelled(true);
}
```

Cancelled events are still delivered to later listeners, and later listeners may change the cancellation state again. The event source decides what the final cancellation result means.

## Async Events and the Main Thread

The event bus does not hop threads for you. When handling async login, network, or external-service callbacks, do not mutate world, entity, or inventory state directly.

```java
context.events().subscribe(AsyncPlayerPreLoginEvent.class, event -> {
    context.scheduler().runMain(() -> {
        context.logger().info("Back on the server thread");
    });
});
```

## Firing Custom Events

Plugins can dispatch their own events with `fire`. `fireAsync` runs listeners in dispatch order on the supplied executor and completes a `CompletableFuture` after all listeners finish.

```java
var result = context.events().fire(new ExampleEvent(player));

context.events()
        .fireAsync(new ExampleEvent(player), executor)
        .thenAccept(event -> context.logger().info("Async event completed"));
```

Hot paths can call `hasListeners` before building expensive event payloads.

## Design Philosophy

Fand's event bus only dispatches events in order. It does not guess the thread model for plugins. Events may come from the server tick, network threads, external service callbacks, or a plugin executor; if the bus switched threads automatically, listeners would lose a clear ordering relationship with the event source.

Priority order from `LOWEST` to `OBSERVER` gives plugins predictable cooperation. Early listeners can prepare defaults or block early, middle listeners do the main work, later listeners override or fix results, and `OBSERVER` should only inspect the final state.

`hasListeners` exists for hot-path performance. Server internals and large plugins can skip building expensive event payloads when nobody is listening.

## Best Practices

- Keep listeners short; put I/O, database, and network work into scheduler async phases.
- Confirm the listener is on the main thread before mutating world, entity, or inventory state. If unsure, apply through `context.scheduler().runMain(...)`.
- Use `LOWEST` through `HIGHEST` for listeners that change results; use `OBSERVER` for logging, metrics, and final-state synchronization.
- Keep `EventSubscription` handles for temporary listeners and close them when the business flow ends.
- For custom events fired on hot paths, check `hasListeners` before building the event object.
- Listener failures are collected and thrown as `EventDispatchException`; do not rely on an exception stopping later listeners.

## Common Pitfalls

- Cancelled events are still delivered to later listeners, and later listeners may change the cancellation state again.
- `OBSERVER` is a convention for final observation, not an enforced read-only mode. Mutating there makes results harder for other plugins to reason about.
- `fireAsync` runs listeners sequentially on the executor you supply, but world-state access still follows normal thread boundaries.
- `registerListener` returns one grouped subscription; individual `@Subscribe` methods cannot be unregistered separately.
- Keeping mutable `Player`, `Entity`, or event payloads beyond the event lifecycle can cross threads or outlive valid state.

## Complete Example: Join/Quit Messages and Async Audit

This example handles join/quit messages on event threads and sends audit logging to an async task. The async phase stores only UUID and name strings, not the event object.

```java
package com.example;

import io.fand.api.event.EventPriority;
import io.fand.api.event.Listener;
import io.fand.api.event.Subscribe;
import io.fand.api.event.player.PlayerJoinEvent;
import io.fand.api.event.player.PlayerQuitEvent;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.events().registerListener(new JoinQuitListener(context));
    }

    private static final class JoinQuitListener implements Listener {
        private final PluginContext context;

        private JoinQuitListener(PluginContext context) {
            this.context = context;
        }

        @Subscribe(priority = EventPriority.HIGH)
        void onJoin(PlayerJoinEvent event) {
            var player = event.player();
            event.setMessage(Component.text("+ " + player.name()));
            player.sendMessage(Component.text("Welcome, " + player.name()));

            var playerId = player.uniqueId();
            var name = player.name();
            context.scheduler().runAsync(() ->
                    context.logger().info("Audit join {} ({})", name, playerId));
        }

        @Subscribe(priority = EventPriority.OBSERVER)
        void onQuit(PlayerQuitEvent event) {
            var player = event.player();
            context.logger().info("Quit reason for {}: {}", player.name(), event.reason());
        }
    }
}
```
