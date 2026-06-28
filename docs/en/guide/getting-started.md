# Getting Started

Fand plugins depend on the public API only. Runtime implementations are provided by Fand Server, and plugin projects should not reference internal server modules.

Fand is distributed through the official Maven repository:

```kotlin
repositories {
    maven("https://repo.fandmc.cn/repository/maven-public/")
}
```

## Use the Official Gradle Plugin

For plugin development, use the official Gradle plugin. It adds `fand-api`, processes `fand-plugin.json`, and builds a jar that Fand can load.

```kotlin
plugins {
    id("io.fand.plugin") version "latest.release"
}

fandPlugin {
    id.set("example-plugin")
    mainClass.set("com.example.ExamplePlugin")
    apiVersion.set("0.1.1")
}
```

The Gradle plugin configures the Fand API dependency, generates or validates
`fand-plugin.json`, and adds a direct-run guard to plugin jars.

## Plugin Descriptor

A minimal plugin declares `id`, `version`, `mainClass`, and `apiVersion`.
`authors`, `depends`, `loadAfter`, `loadBefore`, `description`, `website`,
`license`, and `permissions` are declared only when needed.

```json
{
  "id": "example-plugin",
  "version": "1.0.0",
  "mainClass": "com.example.ExamplePlugin",
  "apiVersion": "0.1.1"
}
```

Dependency fields:

- `depends`: hard dependency; the target plugin must exist and load first.
- `loadAfter`: soft ordering; load after the target plugin when it is present.
- `loadBefore`: soft ordering; load before the target plugin when it is present.

## Minimal Plugin

```java
package com.example;

import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.logger().info("{} enabled", context.descriptor().id());
    }
}
```

`PluginContext` is the main plugin entry point. Prefer its scoped services so commands, listeners, tasks, service providers, and other resources are cleaned up with the plugin lifecycle.

```java
context.commands();
context.events();
context.scheduler();
context.permissions();
context.config();
context.storage();
```

Use the global server view when needed:

```java
import io.fand.api.Fand;

Fand.server().players();
Fand.server().worlds();
Fand.server().performance();
```

Build the plugin jar:

```bash
./gradlew build
```

## Next Steps

- Use the [Plugin Template](/en/guide/plugin-template) to create a runnable project.
- Read the [API Overview](/en/api/) for service entry points.
- Start real logic with [Events](/en/api/events), [Commands](/en/api/commands), and [Scheduler](/en/api/scheduler).
