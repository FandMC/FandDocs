# Scheduler

`Scheduler` submits work to the server thread or background workers. Main-thread tasks observe tick boundaries. Async tasks have no implicit ordering guarantee relative to the main thread.

## Main-Thread Tasks

`runMain` runs on the next server tick.

```java
context.scheduler().runMain(() -> {
    context.logger().info("Runs on the next server tick");
});
```

Delayed tasks can use wall-clock time or ticks.

```java
import java.time.Duration;

context.scheduler().runMainAfter(
        () -> context.logger().info("Delayed by wall-clock time"),
        Duration.ofSeconds(5));

context.scheduler().runMainAfterTicks(
        () -> context.logger().info("Delayed by ticks"),
        100);
```

Repeating tasks also have Duration and tick-based variants.

```java
context.scheduler().runMainRepeating(
        () -> context.logger().debug("Heartbeat"),
        Duration.ofSeconds(30),
        Duration.ofSeconds(60));

context.scheduler().runMainRepeatingTicks(
        () -> context.logger().debug("Tick heartbeat"),
        20,
        1200);
```

## Async Tasks

Async tasks are for file I/O, network requests, database queries, compression, statistics, and other work that should not block ticks.

```java
context.scheduler().runAsync(() -> {
    var value = loadFromDatabase();

    context.scheduler().runMain(() -> {
        applyResultOnServerThread(value);
    });
});
```

Async delay:

```java
context.scheduler().runAsyncAfter(
        () -> context.logger().info("Async delay finished"),
        Duration.ofSeconds(10));
```

## Task Handles

Scheduling methods return `Task`, which can cancel work that is still waiting or repeating.

```java
var task = context.scheduler().runMainRepeatingTicks(
        () -> context.logger().debug("Repeating"),
        20,
        20);

task.cancel();
```

Plugin-scoped tasks are normally cleaned up when the plugin is disabled. Temporary tasks, player-session tasks, and custom lifecycle tasks should still keep handles and cancel them according to your own logic.

## Thread Boundaries

`runAsync` tasks run on background workers and do not have implicit ordering with the server tick thread. Many high-level Fand Server APIs marshal the actual Minecraft state access back to the server thread internally, including parts of world/entity access, scoreboards, boss bars, tab lists, maps, and packet sending.

So "currently on an async thread" does not mean every Fand API call is invalid. A safer boundary is:

- Use async tasks for file I/O, network requests, database queries, compression, and pure computation.
- Do not directly touch unwrapped NMS/vanilla objects, mutable event payloads, or objects whose threading semantics you have not verified.
- If a group of mutations must happen in tick order, or must remain predictably ordered with other main-thread logic, put the apply phase inside `runMain`.
- Avoid high-frequency calls from many async tasks into APIs that synchronously wait for a server-thread result, because that can leave workers blocked behind the main-thread queue.

## Design Philosophy

Fand splits main-thread work, wall-clock delays, tick delays, and async work into separate methods so the call site clearly states whether the logic depends on game ticks or external time. `Duration` fits cooldowns, cache refreshes, and external timeouts. Tick methods fit game mechanics, animations, and scoreboard refreshes.

`Task.cancel()` is best-effort. A task already running may finish; waiting or repeating tasks are stopped as soon as the runtime can do so. Do not treat cancellation as thread interruption or transaction rollback.

## Best Practices

- Tick-based scheduling fits game logic; Duration scheduling fits wall-clock semantics.
- Repeating tasks should have a clear stop condition.
- Split slow operations into an async phase and a main-thread apply phase.
- If an event listener is unsure which thread it is on, apply world-state changes through `runMain`.
- Keep handles for player-session, arena, or temporary tasks and cancel them when the session ends.
- Keep only immutable data in async work, such as player UUIDs, config values, and query parameters.

## Common Pitfalls

- Directly touching unwrapped NMS/vanilla objects from `runAsync` can break thread safety.
- Chaining many `runMainAfterTicks(..., 1)` calls is harder to cancel and debug than one repeating task.
- Calling APIs that synchronously wait for the server thread from many async workers can block the worker pool.
- Forgetting to cancel repeating player-session tasks leaves unnecessary work running after the session ends.
- Mixing wall-clock and tick delays can produce surprising behavior when TPS changes.

## Complete Example: Load Async, Apply on the Server Thread

This example loads player data in the background, then returns to the server thread to send a message and teleport. The slow phase only uses the player UUID and immutable fallback data.

```java
public void loadProfileAndTeleport(io.fand.api.entity.Player player) {
    var playerId = player.uniqueId();
    var fallback = player.location();

    context.scheduler().runAsync(() -> {
        var profile = profileStore.load(playerId);

        context.scheduler().runMain(() -> {
            if (!player.online()) {
                return;
            }
            player.sendMessage(Component.text("Loaded profile " + profile.name()));
            player.teleport(profile.lastLocation().orElse(fallback));
        });
    });
}
```
