# Plugin Lifecycle

Every Fand plugin starts with a class implementing `io.fand.api.plugin.Plugin`. The server reads `fand-plugin.json`, creates the main class with a no-arg constructor, then calls the plugin lifecycle methods.

```text
construct -> onLoad -> onEnable -> onDisable
```

## Lifecycle Methods

| Method | When It Runs | Recommended Work |
| --- | --- | --- |
| `onLoad(PluginContext context)` | After construction, before enable | Read light metadata, prepare internal objects; do not assume other plugins are enabled |
| `onEnable(PluginContext context)` | When the plugin is enabled | Register commands, events, tasks, GUIs, service providers, permission nodes |
| `onDisable(PluginContext context)` | During unload or server shutdown | Close external connections, flush caches, cancel resources not managed by Fand |

`onEnable` is the only required method. `onLoad` and `onDisable` have default empty implementations.

## Plugin Descriptor

The main class is declared in `fand-plugin.json` through `mainClass`. With the official Gradle plugin, this is usually configured in `build.gradle.kts`:

```kotlin
fandPlugin {
    id.set("example-plugin")
    version.set(project.version.toString())
    mainClass.set("com.example.ExamplePlugin")
    apiVersion.set("0.1.2")
}
```

Minimal descriptor:

```json
{
  "id": "example-plugin",
  "version": "1.0.0",
  "mainClass": "com.example.ExamplePlugin",
  "apiVersion": "0.1.2"
}
```

`depends` is a hard dependency. `loadAfter` and `loadBefore` are soft ordering hints. Description, website, license, authors, and permission declarations are optional.

## Minimal Main Class

```java
package com.example;

import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onLoad(PluginContext context) {
        context.logger().info("{} loaded", context.descriptor().id());
    }

    @Override
    public void onEnable(PluginContext context) {
        context.logger().info("{} enabled", context.descriptor().id());
    }

    @Override
    public void onDisable(PluginContext context) {
        context.logger().info("{} disabled", context.descriptor().id());
    }
}
```

## Scoped Services

`PluginContext` is the main entry point for plugin work. Prefer services on `context` instead of global static references.

```java
context.logger();
context.commands();
context.events();
context.scheduler();
context.permissions();
context.config();
context.storage();
context.services();
```

Plugin-scoped registrations are normally cleaned up when the plugin is disabled, including commands, event listeners, tasks, boss bars, tab-list entries, and service providers. External resources you create yourself, such as database connections, thread pools, and file handles, should still be closed in `onDisable`.

## Design Philosophy

Fand splits plugin startup into construction, `onLoad`, `onEnable`, and `onDisable` so "the class can be created", "metadata is available", "runtime services can be registered", and "resources must be released" are separate stages. The simpler the constructor, the easier plugin load failures are to diagnose.

`PluginContext` is the main entry point instead of scattered global static access because it makes plugin-scoped cleanup controllable. Commands, events, tasks, service providers, boss bars, and tab-list entries registered through context can be cleaned up when the plugin disables.

Descriptor `depends`, `loadAfter`, and `loadBefore` express load relationships, not runtime guarantees. A soft dependency may be absent, and a cross-plugin service may unregister later; check plugin state or service presence at the point of use.

## Best Practices

- Do not access `Fand.server()` or runtime services from the constructor.
- Keep `onLoad` light, and avoid assuming other plugin services are available.
- Register Fand-managed resources in `onEnable`.
- Release external resources in `onDisable`, and return promptly.
- Keeping a `PluginContext` reference can work, but passing explicit services into your own components is usually clearer.
- Use `ServiceRegistry` for cross-plugin capabilities instead of depending directly on another plugin's implementation classes.
- Put only real descriptor fields in `fand-plugin.json`; optional metadata should not be assumed present by code.

## Common Pitfalls

- Accessing players, worlds, or other plugin services in the constructor or `onLoad` may hit runtime state that is not ready yet.
- Relying only on `loadAfter` without handling the target plugin being absent.
- Thread pools, database connections, and external clients you create yourself are not automatically closed by plugin scope.
- Storing `PluginContext` in a public static field makes tests and unload behavior harder to control.
- Long blocking saves or network requests in `onDisable` slow down server shutdown or reload.

## Complete Example: Clean Lifecycle Entry Point

This example registers Fand-managed resources in `onEnable` and closes a plugin-owned external client in `onDisable`.

```java
package com.example;

import io.fand.api.event.player.PlayerJoinEvent;
import io.fand.api.permission.PermissionDefault;
import io.fand.api.permission.PermissionDescriptor;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.io.Closeable;
import java.io.IOException;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    private Closeable externalClient;

    @Override
    public void onLoad(PluginContext context) {
        context.logger().info("Loading {}", context.descriptor().id());
    }

    @Override
    public void onEnable(PluginContext context) {
        externalClient = new ExampleExternalClient();

        context.permissions().register(new PermissionDescriptor(
                "example.reload",
                PermissionDefault.OPERATOR));

        context.events().subscribe(PlayerJoinEvent.class, event ->
                event.player().sendMessage(Component.text("Welcome to Fand")));
    }

    @Override
    public void onDisable(PluginContext context) {
        if (externalClient != null) {
            try {
                externalClient.close();
            } catch (IOException failure) {
                context.logger().warn("Failed to close external client", failure);
            }
        }
    }

    private static final class ExampleExternalClient implements Closeable {
        @Override
        public void close() throws IOException {
        }
    }
}
```
