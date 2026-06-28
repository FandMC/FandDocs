# Services

`ServiceRegistry` registers and discovers cross-plugin Java providers. It solves the "how do plugins find each other's capabilities" problem and is useful for economy, chat, permission bridges, region protection, chat channels, party systems, and similar ecosystem APIs.

It is not a general dependency-injection container. Internal plugin objects should still use constructors or your own component management. `ServiceRegistry` is for public providers that other plugins may consume.

## Define a Public Interface

A provider plugin usually starts with a small, stable Java interface.

```java
public interface Economy {
    boolean withdraw(String playerName, long amount);

    long balance(String playerName);
}
```

Keep provider interfaces narrow and stable. Do not expose configuration, database connections, or internal models directly.

## Register a Service

Registration takes a key, interface type, service instance, and optional priority.

```java
import io.fand.api.service.ServicePriority;
import net.kyori.adventure.key.Key;

context.services().register(
        Key.key("example:economy"),
        Economy.class,
        new SimpleEconomy(),
        ServicePriority.NORMAL);
```

Plugin-scoped registrations are cleaned up when the plugin is disabled. Other plugins naturally fall back to the next active provider on their next lookup.

Registering the same `key` and `type` again replaces the previous registration, making the old registration inactive.

## Query a Service

Most consumers only need the current best provider:

```java
context.services().service(Economy.class).ifPresent(economy -> {
    economy.withdraw("Steve", 100);
});
```

Query by key when you need a specific implementation source:

```java
context.services()
        .service(Key.key("example:economy"), Economy.class)
        .ifPresent(economy -> economy.withdraw("Steve", 100));
```

Query `ServiceProvider` when you need provider metadata:

```java
context.services().provider(Economy.class).ifPresent(provider -> {
    context.logger().info("Using economy provider {}", provider.key());
});
```

## Ordering

`providers(type)` has stable ordering semantics:

1. Higher `ServicePriority` providers come first.
2. At the same priority, the most recently registered provider comes first.
3. `provider(type)` returns the first item from `providers(type)`.
4. When the current provider unregisters, is replaced by a new registration with the same key/type, or its plugin disables, the next lookup falls back to the next active provider.

Priority from low to high:

```text
LOWEST -> LOW -> NORMAL -> HIGH -> HIGHEST
```

This lets compatibility layers, bridge plugins, or administrator-selected providers override default implementations.

## Registration Handles

`register` returns a `ServiceRegistration`. If a service is available only in a temporary mode, keep the handle and close it explicitly.

```java
var registration = context.services().register(
        Key.key("example:economy"),
        Economy.class,
        economy);

registration.close();
```

## Design Guidelines

- Put public interfaces in an API package or a separate jar so consumers do not depend on implementation internals.
- Keep interfaces small and stable; prefer simple types or stable DTOs.
- Provider methods should not block the main thread for long. Use async APIs or internal caching for I/O-heavy work.
- Consumers must handle the provider being absent.
- In multi-provider scenarios, use `service(type)` for the current best provider unless you need a specific source.

## Design Philosophy

Fand's `ServiceRegistry` is an ecosystem discovery layer, not an internal component container. Internal plugin dependencies are clearer and easier to test with constructors. Register only capabilities that other plugins need to discover.

Registration uses both `Key` and Java `Class<T>` so multiple sources of the same interface, and multiple interfaces from the same plugin, can be expressed clearly. `ServicePriority` gives override semantics for administrator-selected providers, compatibility bridges, or default implementations.

Fallback happens at lookup time. Consumers should not permanently cache a provider and assume it remains active forever. If the provider plugin disables, the same key/type is replaced, or a higher-priority provider unregisters, the next lookup may return another provider.

## Best Practices

- Keep cross-plugin interfaces small, such as economy, chat, or region guard.
- Avoid blocking I/O on the main thread from provider methods; expose async methods or cache results.
- Query again before important operations, or otherwise handle provider lifecycle explicitly.
- Use plugin namespaces for provider keys, such as `example:economy`.
- Use `NORMAL` for default implementations and higher priorities for selected overrides or bridges.
- Provide graceful behavior when no provider is available.

## Common Pitfalls

- Treating `ServiceRegistry` as a global object store for internal DAOs, config objects, or thread pools.
- Exposing implementation plugin internal classes in the public interface.
- Caching `service(type)` forever without considering provider unload or replacement.
- Registering the same `key` and `type` again replaces the old registration and makes it inactive.
- At equal priority, the most recent provider comes first. Use explicit priority if order matters.

## Complete Example: Economy Provider and Consumer

Put the shared interface in a small API jar. The provider plugin registers an implementation, and the consumer plugin queries the current best provider by type.

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
