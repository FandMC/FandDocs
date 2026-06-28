# 事件

事件通过 `EventBus` 派发。事件总线是线程安全的，但不会自动切换线程：监听器运行在触发事件的线程上。玩家、实体、世界、库存等主线程状态只能在主线程安全访问；如果监听器来自异步事件，需要用调度器跳回主线程。

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

事件总线不会替你切线程。处理登录、网络、外部服务回调等异步事件时，不要直接修改世界、实体或库存。

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
