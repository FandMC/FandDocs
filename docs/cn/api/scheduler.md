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

`runAsync` 的任务运行在后台 worker；它不会和服务端 tick 线程建立隐式顺序。Fand Server 的不少高层 API 会在运行时内部把实际 Minecraft 状态读写编排到服务端线程，例如世界/实体查询与修改、Scoreboard、BossBar、TabList、Map 和 packet 发送中的一部分实现。

所以不要把“当前在异步线程”简单理解成“所有 Fand API 都不能调用”。更稳妥的边界是：

- 异步阶段适合做文件 I/O、网络请求、数据库查询、压缩和纯计算。
- 不要在异步任务里直接访问未经过 Fand API 封装的 NMS/vanilla 对象、事件里的可变对象，或你无法确认线程语义的对象。
- 如果一组修改必须按 tick 顺序发生，或者需要和其它主线程逻辑保持可预测顺序，把“应用结果”的阶段放进 `runMain`。
- 会同步等待服务端线程结果的 API 不适合在大量异步任务中高频调用，否则可能把 worker 卡在等待主线程队列上。

## 使用建议

- tick-based 调度适合游戏逻辑，Duration 调度适合外部时间语义。
- 重复任务要有明确停止条件。
- 长耗时任务拆成异步阶段和主线程应用阶段。
- 事件监听器里如果不确定当前线程，保守地通过 `runMain` 应用世界状态变更。
