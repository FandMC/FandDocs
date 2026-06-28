# 事件

事件通过 `EventBus` 派发。事件总线是线程安全的，但不会自动切换线程：监听器运行在触发事件的线程上。玩家、实体、世界、背包和容器等主线程状态只能在主线程安全访问；如果监听器来自异步事件，需要用调度器跳回主线程。

```java
context.events().subscribe(PlayerJoinEvent.class, event -> {
    event.player().sendMessage(Component.text("Welcome to Fand"));
});
```

## 直接订阅

直接订阅适合简单监听器，返回的 `EventSubscription` 可以手动关闭。

```java
import io.fand.api.event.EventSubscription;
import io.fand.api.event.player.PlayerJoinEvent;
import net.kyori.adventure.text.Component;

EventSubscription subscription = context.events().subscribe(PlayerJoinEvent.class, event -> {
    event.player().sendMessage(Component.text("Welcome to Fand"));
});

subscription.close();
```

插件作用域事件注册通常会随插件禁用清理。只有你把 subscription 交给自己的生命周期管理时，才需要手动关闭。

## 注解监听器

注解监听器适合把一组相关事件放在同一个类里。`registerListener` 会注册该对象上所有 `@Subscribe` 方法，返回的 subscription 会一次性注销全部方法。

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

## 优先级

优先级从低到高执行：

```text
LOWEST -> LOW -> NORMAL -> HIGH -> HIGHEST -> OBSERVER
```

`OBSERVER` 适合记录日志、同步状态、统计数据等“观察最终结果”的逻辑，不应该再修改事件。会修改事件结果的插件，应使用 `LOWEST` 到 `HIGHEST`。

```java
@Subscribe(priority = EventPriority.HIGH)
void onInteract(PlayerInteractEvent event) {
    if (event.player().hasPermission("example.bypass")) {
        event.setCancelled(false);
    }
}
```

## 可取消事件

实现 `Cancellable` 的事件可以被取消。取消语义由事件本身定义：有些事件会阻止动作发生，有些事件只影响后续处理。

```java
import io.fand.api.event.Cancellable;

if (event instanceof Cancellable cancellable && !cancellable.cancelled()) {
    cancellable.setCancelled(true);
}
```

已取消事件仍会继续派发给后续监听器，后续监听器也可以再次修改取消状态。最终如何处理取消结果由事件来源决定。

## 异步事件与主线程

事件总线不会替你切线程。处理登录、网络、外部服务回调等异步事件时，不要直接修改世界、实体、背包或容器。

```java
context.events().subscribe(AsyncPlayerPreLoginEvent.class, event -> {
    context.scheduler().runMain(() -> {
        context.logger().info("Back on the server thread");
    });
});
```

## 触发自定义事件

插件可以通过 `fire` 同步派发自己的事件。`fireAsync` 会在指定 executor 上按派发顺序执行监听器，并在所有监听器完成后完成 `CompletableFuture`。

```java
var result = context.events().fire(new ExampleEvent(player));

context.events()
        .fireAsync(new ExampleEvent(player), executor)
        .thenAccept(event -> context.logger().info("Async event completed"));
```

热点路径可以先调用 `hasListeners`，避免在没有监听器时构造昂贵事件对象。

## 为什么这样设计

Fand 的事件总线只负责“按顺序派发事件”，不负责替插件猜线程模型。事件来源可能是服务端 tick、网络线程、外部服务回调或插件自己的 executor；如果事件总线自动切线程，监听器反而很难判断当前代码和事件来源之间的顺序关系。

优先级从 `LOWEST` 到 `OBSERVER` 也是为了让插件之间形成可预测协作：前面的监听器可以准备默认值或提前拦截，中间的监听器处理主要逻辑，后面的监听器覆盖或修正，`OBSERVER` 只观察最终状态。

`hasListeners` 存在是为了热路径性能。服务端内部或大型插件在构造事件对象前可以先判断是否有人监听，避免每 tick 分配复杂 payload。

## 最佳实践

- 监听器保持短小；耗时 I/O、数据库和网络请求放到 scheduler 异步阶段。
- 修改世界、实体、背包或容器等状态前确认监听器运行在主线程；不确定时用 `context.scheduler().runMain(...)` 应用结果。
- 会修改事件结果的监听器使用 `LOWEST` 到 `HIGHEST`，日志、统计和同步状态使用 `OBSERVER`。
- 临时监听器保存 `EventSubscription`，业务结束时主动 `close()`。
- 自定义事件如果在高频路径触发，先用 `hasListeners` 判断是否需要构造。
- 监听器异常会被收集并通过 `EventDispatchException` 抛出；不要依赖“抛异常中断后续监听器”的行为。

## 常见坑

- 已取消的事件仍会派发给后续监听器，后续监听器也可以修改取消状态。
- `OBSERVER` 只是约定上的最终观察阶段，不是强制只读；在这里改事件会让其它插件很难预测结果。
- `fireAsync` 会在你传入的 executor 上顺序执行监听器，但监听器里的世界状态访问仍然要遵守线程边界。
- `registerListener` 返回的是一组方法的整体 subscription，不能单独注销某一个 `@Subscribe` 方法。
- 在事件对象里长期保存可变 `Player`、`Entity` 或事件 payload，容易跨线程或跨生命周期使用到过期状态。

## 综合示例：加入/退出提示和异步审计

下面的例子把玩家加入/退出提示放在主线程事件里处理，把审计日志丢到异步任务。审计阶段只保存 UUID 和名称字符串，不把事件对象带到后台线程。

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
