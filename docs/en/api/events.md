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
