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

## Guidelines

- Tick-based scheduling fits game logic; Duration scheduling fits wall-clock semantics.
- Repeating tasks should have a clear stop condition.
- Split slow operations into an async phase and a main-thread apply phase.
- If an event listener is unsure which thread it is on, apply world-state changes through `runMain`.
