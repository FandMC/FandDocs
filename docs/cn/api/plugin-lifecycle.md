# 插件生命周期

每个 Fand 插件都从一个实现 `io.fand.api.plugin.Plugin` 的类开始。服务端会读取 `fand-plugin.json`，通过无参构造器创建主类实例，然后按生命周期调用插件方法。

```text
construct -> onLoad -> onEnable -> onDisable
```

## 生命周期方法

| 方法 | 什么时候调用 | 推荐做什么 |
| --- | --- | --- |
| `onLoad(PluginContext context)` | 插件构造后，启用前 | 读取轻量元数据、准备内部对象；不要依赖其它插件已启用 |
| `onEnable(PluginContext context)` | 插件启用时 | 注册命令、事件、任务、GUI、服务 provider、权限节点 |
| `onDisable(PluginContext context)` | 插件卸载或服务端关闭时 | 关闭外部连接、flush 缓存、取消非 Fand 托管资源 |

`onEnable` 是唯一必须实现的方法。`onLoad` 和 `onDisable` 有默认空实现。

## 插件描述文件

主类需要在 `fand-plugin.json` 的 `mainClass` 字段中声明。使用官方 Gradle 插件时，通常在 `build.gradle.kts` 中配置：

```kotlin
fandPlugin {
    id.set("example-plugin")
    version.set(project.version.toString())
    mainClass.set("com.example.ExamplePlugin")
    apiVersion.set("0.1.1")
}
```

最小 descriptor：

```json
{
  "id": "example-plugin",
  "version": "1.0.0",
  "mainClass": "com.example.ExamplePlugin",
  "apiVersion": "0.1.1"
}
```

`depends` 是硬依赖；`loadAfter` 和 `loadBefore` 是软加载顺序。描述、网站、许可证、作者和权限声明都是可选字段。

## 最小主类

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

## 作用域服务

`PluginContext` 是插件的主要入口。优先使用 `context` 上的服务，而不是保存全局静态引用。

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

插件作用域注册通常会随插件禁用清理，例如命令、事件监听器、任务、BossBar、TabList 条目和服务 provider。数据库连接、线程池、文件句柄等你自己创建的外部资源，仍然应该在 `onDisable` 主动关闭。

## 生命周期建议

- 不要在构造器里访问 `Fand.server()` 或其它运行时服务。
- 在 `onLoad` 中保持轻量，避免依赖其它插件服务已经可用。
- 在 `onEnable` 注册 Fand 托管资源。
- 在 `onDisable` 释放外部资源，并让方法尽快返回。
- 保存 `PluginContext` 引用可以工作，但通常更推荐把需要的服务显式传入自己的组件。
