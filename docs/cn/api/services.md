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

## 为什么这样设计

Fand 的 `ServiceRegistry` 是生态插件之间的能力发现层，不是插件内部组件容器。插件内部依赖仍然推荐构造器传参，因为那样更清晰、更容易测试；只有需要被其它插件发现的能力才注册成 service provider。

注册时同时使用 `Key` 和 Java `Class<T>`，是为了让“同一种接口的多个来源”和“同一个插件暴露多种接口”都能明确表达。`ServicePriority` 提供覆盖语义，例如管理员选择的经济插件或兼容桥接插件可以排在默认实现前面。

注销后的 fallback 是查询时发生的。使用方不应该永久缓存 provider 并假设它永远 active；服务插件被禁用、同 key/type 被替换、或高优先级 provider 注销后，下次查询可能得到另一个 provider。

## 最佳实践

- 把跨插件接口保持很小，例如 economy、chat、region-guard 这种单一职责接口。
- provider 方法避免在主线程做阻塞 I/O；需要外部资源时优先提供异步方法或缓存结果。
- consumer 每次关键操作前重新查询，或至少检查 `ServiceRegistration.active()` / `ServiceProvider` 生命周期约定。
- provider key 使用插件命名空间，例如 `example:economy`。
- 默认实现用 `NORMAL`，兼容层或管理员指定实现可以用更高优先级。
- 查询不到 provider 时给出降级行为，不要让插件整体崩掉。

## 常见坑

- 把 `ServiceRegistry` 当成全局变量仓库，注册插件内部 DAO、配置对象或线程池。
- 接口暴露实现插件内部类，导致 consumer 必须依赖 provider 的实现 jar。
- 长期缓存 `service(type)` 返回的对象，却不处理 provider 被卸载或替换。
- 同一个 `key` 和 `type` 重复注册会替换旧注册，旧 registration 会变成 inactive。
- 同优先级时后注册 provider 排在前面；如果你依赖固定顺序，应使用明确的 priority。

## 综合示例：经济服务 provider 与 consumer

公共接口可以放在一个小 API jar 中，provider 插件注册实现，consumer 插件按类型查询当前最佳 provider。

```java
// Economy.java, placed in a small shared API jar.
package com.example.economy;

import io.fand.api.entity.Player;

public interface Economy {
    long balance(Player player);

    boolean withdraw(Player player, long amount);
}
```

```java
// EconomyProviderPlugin.java
package com.example.economy;

import io.fand.api.entity.Player;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import io.fand.api.service.ServicePriority;
import net.kyori.adventure.key.Key;

public final class EconomyProviderPlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.services().register(
                Key.key("example:economy"),
                Economy.class,
                new MemoryEconomy(),
                ServicePriority.NORMAL);
    }

    private static final class MemoryEconomy implements Economy {
        @Override
        public long balance(Player player) {
            return 1000;
        }

        @Override
        public boolean withdraw(Player player, long amount) {
            return amount <= balance(player);
        }
    }
}
```

```java
// ShopPlugin.java
package com.example.shop;

import com.example.economy.Economy;
import io.fand.api.entity.Player;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

public final class ShopPlugin implements Plugin {
    public void buy(PluginContext context, Player player, long price) {
        var economy = context.services().service(Economy.class);
        if (economy.isEmpty()) {
            player.sendMessage(Component.text("No economy provider is available"));
            return;
        }

        if (economy.get().withdraw(player, price)) {
            player.sendMessage(Component.text("Purchased"));
        } else {
            player.sendMessage(Component.text("Not enough balance"));
        }
    }
}
```
