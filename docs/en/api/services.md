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
