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
    apiVersion.set("0.1.1")
}
```

Minimal descriptor:

```json
{
  "id": "example-plugin",
  "version": "1.0.0",
  "mainClass": "com.example.ExamplePlugin",
  "apiVersion": "0.1.1"
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

## Lifecycle Guidelines

- Do not access `Fand.server()` or runtime services from the constructor.
- Keep `onLoad` light, and avoid assuming other plugin services are available.
- Register Fand-managed resources in `onEnable`.
- Release external resources in `onDisable`, and return promptly.
- Keeping a `PluginContext` reference can work, but passing explicit services into your own components is usually clearer.
