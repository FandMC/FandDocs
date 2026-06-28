# 快速开始

Fand 插件只需要依赖公共 API。运行时实现由 Fand Server 提供，插件工程不应该引用服务端内部模块。

Fand 通过官方 Maven 仓库发布：

```kotlin
repositories {
    maven("https://repo.fandmc.cn/repository/maven-public/")
}
```

## 使用官方 Gradle 插件

开发插件时推荐使用官方 Gradle 插件。它会自动添加 `fand-api`，处理 `fand-plugin.json`，并把插件构建成 Fand 可加载的 jar。

```kotlin
plugins {
    id("io.fand.plugin") version "0.1.2"
}

fandPlugin {
    id.set("example-plugin")
    mainClass.set("com.example.ExamplePlugin")
    apiVersion.set("0.1.2")
}
```

Gradle 插件会自动配置 Fand API 依赖，生成或校验 `fand-plugin.json`，并给插件 jar 注入直接运行保护入口。

## 插件描述文件

最小插件必须声明 `id`、`version`、`mainClass` 和 `apiVersion`。`authors`、`depends`、`loadAfter`、`loadBefore`、`description`、`website`、`license`、`permissions` 都是按需声明。

```json
{
  "id": "example-plugin",
  "version": "1.0.0",
  "mainClass": "com.example.ExamplePlugin",
  "apiVersion": "0.1.2"
}
```

依赖字段的语义：

- `depends`：硬依赖，目标插件必须存在并先加载。
- `loadAfter`：软顺序，目标插件存在时尽量在它之后加载。
- `loadBefore`：软顺序，目标插件存在时尽量在它之前加载。

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

`PluginContext` 是插件最常用的入口。优先使用它提供的作用域服务，这样注册的命令、监听器、任务、服务 provider 等资源可以随插件生命周期自动清理。

```java
context.commands();
context.events();
context.scheduler();
context.permissions();
context.config();
context.storage();
```

需要全服视图时可以使用：

```java
import io.fand.api.Fand;

Fand.server().players();
Fand.server().worlds();
Fand.server().performance();
```

构建插件 jar：

```bash
./gradlew build
```

## 下一步

- 用 [插件模板](/cn/guide/plugin-template) 快速创建可运行工程。
- 阅读 [API 概览](/cn/api/) 了解服务入口。
- 从 [事件](/cn/api/events)、[命令](/cn/api/commands)、[调度器](/cn/api/scheduler) 开始写实际逻辑。
