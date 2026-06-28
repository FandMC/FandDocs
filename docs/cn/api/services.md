# 服务注册

`ServiceRegistry` 用于跨插件注册和发现 Java provider。它解决的是“插件之间如何找到对方的能力”这个问题，适合经济、聊天、权限桥接、区域保护、聊天频道、队伍系统等生态型接口。

它不是普通依赖注入容器。插件内部对象仍建议用构造器传参或自己的组件管理；`ServiceRegistry` 只用于暴露给其它插件使用的公共 provider。

## 定义公共接口

提供服务的插件通常先定义一个小而稳定的 Java 接口。

```java
public interface Economy {
    boolean withdraw(String playerName, long amount);

    long balance(String playerName);
}
```

接口应保持窄而稳定。不要把配置、数据库连接、内部模型直接暴露给其它插件。

## 注册服务

注册时需要 key、接口类型、实现对象和可选优先级。

```java
import io.fand.api.service.ServicePriority;
import net.kyori.adventure.key.Key;

context.services().register(
        Key.key("example:economy"),
        Economy.class,
        new SimpleEconomy(),
        ServicePriority.NORMAL);
```

插件作用域注册会在插件禁用时清理。其它插件下一次查询时会自然 fallback 到仍然 active 的 provider。

同一个 `key` 和 `type` 再次注册时，新注册会替换旧注册，旧 registration 会变为 inactive。

## 查询服务

多数使用方只关心“当前最佳 provider”：

```java
context.services().service(Economy.class).ifPresent(economy -> {
    economy.withdraw("Steve", 100);
});
```

需要指定实现来源时，可以按 key 查询：

```java
context.services()
        .service(Key.key("example:economy"), Economy.class)
        .ifPresent(economy -> economy.withdraw("Steve", 100));
```

需要查看 provider 元信息时，查询 `ServiceProvider`：

```java
context.services().provider(Economy.class).ifPresent(provider -> {
    context.logger().info("Using economy provider {}", provider.key());
});
```

## 排序语义

`providers(type)` 的排序是稳定 API 语义：

1. `ServicePriority` 高的 provider 排在前面。
2. 同优先级时，后注册的 provider 排在前面。
3. `provider(type)` 返回 `providers(type)` 的第一个。
4. 当前 provider 注销、被同 key/type 新注册替换，或插件禁用后，下次查询会 fallback 到下一个 active provider。

优先级从低到高：

```text
LOWEST -> LOW -> NORMAL -> HIGH -> HIGHEST
```

这个语义适合让兼容层、桥接插件或管理员选择的 provider 覆盖默认实现。

## 注册句柄

`register` 返回 `ServiceRegistration`。如果服务只在某个模式下临时可用，可以保存句柄并主动关闭。

```java
var registration = context.services().register(
        Key.key("example:economy"),
        Economy.class,
        economy);

registration.close();
```

## 设计建议

- 公共接口单独放在 API 包或独立 jar，避免使用方依赖实现插件内部类。
- 接口保持小而稳定，优先返回简单类型或你自己的稳定 DTO。
- provider 方法不要长时间阻塞主线程；需要 I/O 时提供异步 API 或内部缓存。
- 查询方要处理 provider 不存在的情况。
- 多 provider 场景下，除非有明确理由，否则用 `service(type)` 获取当前最佳 provider。
