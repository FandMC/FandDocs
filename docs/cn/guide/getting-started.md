# 快速开始

Fand 通过官方 Maven 仓库发布：

```kotlin
repositories {
    maven("https://repo.fandmc.cn/repository/maven-public/")
}
```

开发插件时推荐使用官方 Gradle 插件：

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

Gradle 插件会自动配置 Fand API 依赖，生成或校验 `fand-plugin.json`，并给插件 jar 注入直接运行保护入口。

## 最小插件

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

构建插件 jar：

```bash
./gradlew build
```
