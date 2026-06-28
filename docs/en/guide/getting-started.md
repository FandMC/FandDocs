# Getting Started

Fand is distributed through the official Maven repository:

```kotlin
repositories {
    maven("https://repo.fandmc.cn/repository/maven-public/")
}
```

For plugin development, use the official Gradle plugin:

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

Build the plugin jar:

```bash
./gradlew build
```
