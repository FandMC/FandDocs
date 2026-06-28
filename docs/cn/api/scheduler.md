# 调度器

`Scheduler` 用于把任务提交到服务端主线程或后台 worker。主线程任务遵守 tick 边界；异步任务和主线程任务之间没有隐式顺序保证。

## 主线程任务

`runMain` 会在下一个服务端 tick 执行。

```java
context.scheduler().runMain(() -> {
    context.logger().info("Runs on the next server tick");
});
```

延迟任务可以用真实时间，也可以用 tick。

```java
import java.time.Duration;

context.scheduler().runMainAfter(
        () -> context.logger().info("Delayed by wall-clock time"),
        Duration.ofSeconds(5));

context.scheduler().runMainAfterTicks(
        () -> context.logger().info("Delayed by ticks"),
        100);
```

周期任务同样提供 Duration 和 tick 两种形式。

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

## 异步任务

异步任务适合文件 I/O、网络请求、数据库查询、压缩、统计计算等不应该阻塞 tick 的工作。

```java
context.scheduler().runAsync(() -> {
    var value = loadFromDatabase();

    context.scheduler().runMain(() -> {
        applyResultOnServerThread(value);
    });
});
```

异步延迟：

```java
context.scheduler().runAsyncAfter(
        () -> context.logger().info("Async delay finished"),
        Duration.ofSeconds(10));
```

## Task 句柄

调度方法返回 `Task`，可用于取消仍在等待或重复执行的任务。

```java
var task = context.scheduler().runMainRepeatingTicks(
        () -> context.logger().debug("Repeating"),
        20,
        20);

task.cancel();
```

插件作用域任务通常会随插件禁用清理。临时任务、用户会话任务和自定义生命周期任务仍建议保存句柄，按业务主动取消。

## 线程边界

不要在异步任务里直接操作：

- 世界、区块、方块、实体
- 玩家对象和库存
- 大多数服务端注册表状态
- GUI、BossBar、TabList、Scoreboard 这类面向玩家的状态

正确做法是异步阶段只做耗时计算或 I/O，完成后把结果切回主线程应用。

## 使用建议

- tick-based 调度适合游戏逻辑，Duration 调度适合外部时间语义。
- 重复任务要有明确停止条件。
- 长耗时任务拆成异步阶段和主线程应用阶段。
- 事件监听器里如果不确定当前线程，保守地通过 `runMain` 应用世界状态变更。
