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

Do not directly mutate these from async tasks:

- Worlds, chunks, blocks, entities.
- Player objects and inventories.
- Most server registry state.
- GUI, boss bar, tab-list, and scoreboard state.

The usual pattern is to do expensive calculation or I/O asynchronously, then return to the main thread to apply the result.

## Guidelines

- Tick-based scheduling fits game logic; Duration scheduling fits wall-clock semantics.
- Repeating tasks should have a clear stop condition.
- Split slow operations into an async phase and a main-thread apply phase.
- If an event listener is unsure which thread it is on, apply world-state changes through `runMain`.
