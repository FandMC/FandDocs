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

## 为什么这样设计

Fand 把插件生命周期拆成构造器、`onLoad`、`onEnable` 和 `onDisable`，是为了把“类能被创建”“插件元数据已可用”“运行时服务可注册”“资源需要释放”这几个阶段分开。构造器越简单，插件加载失败时越容易定位问题。

`PluginContext` 是主要入口，而不是到处调用全局静态对象，是为了让插件作用域清理可控。命令、事件、任务、服务 provider、BossBar、TabList 条目等通过 context 注册时，运行时可以在插件禁用时清理对应资源。

描述文件里的 `depends`、`loadAfter`、`loadBefore` 只表达加载关系，不替代运行时检查。软依赖插件可能不存在，跨插件服务也可能稍后注销；真正使用时仍然要检查服务或插件状态。

## 最佳实践

- 构造器只初始化纯 Java 字段，不访问 server、world、player、config 或其它插件。
- `onLoad` 做轻量准备，例如读取 descriptor、创建内部组件对象。
- `onEnable` 注册命令、监听器、权限、任务、GUI、服务 provider 和其它 Fand 托管资源。
- `onDisable` 关闭数据库连接、HTTP client、线程池、文件句柄和插件自己创建的外部资源。
- 对跨插件能力优先使用 `ServiceRegistry`，而不是直接依赖对方实现类。
- descriptor 中只写真实需要的字段；可选元数据缺失时，不要在代码里假设它一定存在。

## 常见坑

- 在构造器或 `onLoad` 里访问玩家、世界或其它插件服务，可能遇到运行时尚未准备好的状态。
- 只依赖 `loadAfter`，却没有处理目标插件没安装的情况。
- 自己创建的线程池、数据库连接和外部 client 不会由插件作用域自动关闭。
- 把 `PluginContext` 存成 public static 并让其它类随意访问，会让测试和卸载更难控。
- `onDisable` 里执行长时间阻塞保存或网络请求，会拖慢服务端关闭/重载。

## 综合示例：清晰生命周期的插件入口

下面的例子把 Fand 托管资源放在 `onEnable` 注册，把插件自己创建的外部 client 放在 `onDisable` 关闭。

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
