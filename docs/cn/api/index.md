# API 概览

Fand 插件只依赖 `fand-api`。`fand-api` 是面向插件作者的稳定编译期 API，运行时实现由 Fand Server 提供。

> [!IMPORTANT]
> 不要根据 `fand-api` 源码里的 Java `default` 方法体、兜底返回值或占位异常判断运行时行为。它们主要用于源码/二进制兼容，让插件可以在 API 演进时继续编译；真实行为由当前 Fand Server 运行时、插件作用域包装层或已注册 provider 提供。

建议优先从 `PluginContext` 获取服务。它代表“当前插件”的生命周期作用域，命令、监听器、任务、服务 provider、GUI、BossBar、TabList 等资源都可以跟随插件禁用自动清理。只有在需要全服视图时，再使用 `Fand.server()`。

## 为什么这样设计

Fand API 有意采用和 Bukkit/Paper 不完全相同的风格。它更像现代 Java record/接口风格的领域 API：读取状态时优先使用 `player.location()`、`entity.uniqueId()`、`world.key()` 这类属性式方法；会修改状态、发送数据包或改变生命周期的操作才使用动词，例如 `teleport(...)`、`setVelocity(...)`、`register(...)`、`close()`。

这样设计主要为了几件事：

- **更少模板代码**：`location()` 比 `getLocation()` 更接近 Java record accessor，也和 `PluginDescriptor.id()`、`MapView.id()` 等 API 保持一致。
- **区分读取和动作**：无前缀方法通常表示读取一个值或句柄，`set*` / 动词方法表示有副作用的操作。
- **编译期 API 与运行时解耦**：插件只依赖 `fand-api`；具体行为由当前 Fand Server runtime 提供。API 里的兼容默认方法不是功能说明。
- **插件作用域优先**：`context.xxx()` 返回的服务通常会帮插件追踪注册资源，降低卸载后残留命令、任务、BossBar、TabList 行等问题。
- **明确线程边界**：异步阶段适合做 I/O 和计算；需要按 tick 顺序应用结果时，用 scheduler 切回服务端线程。

从 Paper 迁移时，不要机械寻找 `getXxx()` 对应物。先判断自己是在读取状态、注册资源、修改世界，还是发送给某个 viewer 的表现效果，再选择对应的 Fand 服务。

## 两个核心入口

| 入口 | 作用 | 使用场景 |
| --- | --- | --- |
| `PluginContext` | 插件作用域服务集合 | 注册命令、事件、任务、权限、GUI、数据包、跨插件服务 |
| `Fand.server()` | 全局服务端视图 | 查询在线玩家、世界、性能、全局注册表、广播消息 |

```java
public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.logger().info("{} enabled", context.descriptor().id());
        context.commands();
        context.events();
        context.scheduler();
    }
}
```

```java
Fand.server().players();
Fand.server().worlds();
Fand.server().performance();
Fand.server().itemType(Key.key("minecraft:diamond"));
```

## API 分层

Fand API 可以按开发任务分成几层：

| 分层 | 代表 API | 说明 |
| --- | --- | --- |
| 插件基础 | `plugin`、`lifecycle`、`config`、`storage` | 插件加载、配置、数据目录和持久化 |
| 交互入口 | `command`、`event`、`scheduler`、`permission` | 玩家输入、监听服务端行为、异步/主线程任务、权限控制 |
| 玩家体验 | `text`、`placeholder`、`bossbar`、`tablist`、`scoreboard`、`gui`、`map` | 文本、占位符、界面、BossBar、玩家列表、记分板和地图渲染 |
| 世界与实体 | `world`、`block`、`entity`、`inventory`、`player`、`tag` | 世界、方块、实体、玩家、库存和 vanilla tag 查询 |
| 内容扩展 | `customitem`、`customblock`、`recipe`、`loot`、`advancement`、`enchantment`、`datapack`、`structure` | 自定义内容、数据包内容、结构模板和生成相关能力 |
| 生态互通 | `service`、`integration`、`messaging`、`region` | 跨插件 provider、外部资源策略、插件消息和区域保护 |
| 底层表现 | `packet`、`component`、`registry`、`performance`、`gamerule`、`nbs` | 数据包、组件、注册表、性能快照、自定义规则和 NBS 解析 |

## PluginContext 服务矩阵

| 服务 | 入口 | 典型用途 |
| --- | --- | --- |
| 日志 | `context.logger()` | 使用插件 id 命名的 SLF4J logger |
| 描述文件 | `context.descriptor()` | 读取 `id`、`version`、`mainClass`、依赖和权限声明 |
| 生命周期事件 | `context.events()` | 注册玩家、实体、世界、插件和服务端事件监听器 |
| 命令 | `context.commands()` | 注解命令、描述符命令、补全、可见命令查询 |
| 调度器 | `context.scheduler()` | 主线程、异步、延迟、周期、tick-based 任务 |
| 权限 | `context.permissions()` | 权限节点、权限树、附件、组、prefix/suffix/meta、上下文查询 |
| 配置 | `context.config()` | 插件默认 `config.yml`，支持重载和保存 |
| 配置加载器 | `context.configurations()` | YAML、JSON、TOML、properties 等通用配置文件 |
| 存储 | `context.storage()` | 插件作用域 JSON/KV 持久化数据 |
| 服务注册 | `context.services()` | 注册和发现经济、聊天、权限桥、区域保护等 Java provider |
| 区域 | `context.regions()` | 区域定义、flag 注册、优先级排序、解析 trace |
| 数据包 | `context.packets()` | 拦截、构造、发送、custom payload、fake block/entity |
| 占位符 | `context.placeholders()` | 注册和解析 `%namespace_value%` 风格占位符 |
| MiniMessage | `context.miniMessages()` | Adventure MiniMessage 与 Fand 占位符整合 |
| GUI | `context.guis()` | 库存界面、slot handler、close handler |
| 记分板 | `context.scoreboard()` | objective、display slot、team、nameplate |
| BossBar | `context.bossBars()` | 创建和更新 BossBar，按插件生命周期清理 |
| TabList | `context.tabLists()` | per-viewer 玩家列表显示、隐藏、排序和条目管理 |
| 地图 | `context.maps()` | 地图 renderer、cursor、玩家相关渲染 |
| 插件消息 | `context.pluginMessaging()` | 标准 plugin message channel |
| 自定义物品 | `context.customItems()` | 注册自定义物品类型和基础物品绑定 |
| 自定义方块 | `context.customBlocks()` | 注册自定义方块类型、监听器和物品绑定 |
| 配方 | `context.recipes()` | 注册和移除配方 |
| 战利品表 | `context.lootTables()` | 插件命名空间下的 loot table |
| 进度 | `context.advancements()` | 插件命名空间下的 advancement |
| 附魔 | `context.enchantments()` | 插件命名空间下的 enchantment |
| 数据包文件树 | `context.dataPacks()` | 插件作用域 vanilla data pack 文件树 |
| 结构 | `context.structures()` | 模板保存、导入、导出、放置和定位 |
| 游戏规则 | `context.gameRules()` | 插件命名空间自定义 game rule |
| 模拟玩家 | `context.simulatedPlayers()` | 服务端侧模拟玩家 |
| 外部集成 | `context.integrations()` | SQL、Redis、MQ 等外部资源策略描述 |

## 全局 Server 视图

`Server` 是 Adventure `ForwardingAudience`，会把消息转发给当前在线玩家。它适合做全局查询和广播，但插件自己的注册行为仍建议走 `PluginContext`。

| 能力 | 入口 |
| --- | --- |
| 服务端信息 | `brand()`、`version()`、`minecraftVersion()`、`phase()` |
| 玩家 | `players()`、`player(UUID)`、`player(String)`、`playerAccess()` |
| 世界 | `worlds()`、`world(Key)`、`defaultWorld()`、`createWorld(...)`、`unloadWorld(...)` |
| 注册表查询 | `blockType(...)`、`itemType(...)`、`entityType(...)`、`blockTags()`、`itemTags()` |
| 全局服务 | `events()`、`commands()`、`permissions()`、`scheduler()`、`scoreboard()`、`packets()` |
| 性能 | `performance()`、`currentTick()` |
| 广播 | `sendMessage(...)`、`broadcast(...)` |

## 最佳实践

- 生命周期相关注册放在 `onEnable`，释放外部资源放在 `onDisable`。
- 优先使用 `context.xxx()`，除非明确需要全服查询或全局广播。
- 事件监听器运行在触发事件的线程上，需要修改世界、实体、库存时跳回主线程。
- 异步任务不要直接操作主线程状态；用 `context.scheduler().runMain(...)` 回到服务端线程。
- `ServiceRegistry` 适合做生态互通，不适合替代普通 Java 依赖注入。
- 权限节点、命令、配置 key 建议统一使用插件 id 作为前缀。

## 常见坑

- 看到 `fand-api` 接口里的 default 返回值或占位异常，就误以为运行时没有实现；真实行为由 Fand Server 运行时提供。
- 从 Paper 迁移时机械寻找 `getXxx()` 方法，忽略了 Fand 的属性式 accessor。
- 把所有服务都从 `Fand.server()` 获取，导致插件作用域清理失效或资源归属不清。
- 在异步任务或异步事件里直接操作未封装的世界/实体/库存对象。
- 把 `ServiceRegistry` 当作插件内部对象容器，注册 DAO、配置对象或线程池。
- 没有在 descriptor 或 `PermissionService` 注册公开权限节点，管理工具无法发现默认策略。

## 综合示例：最小但完整的插件骨架

下面的例子展示一个插件入口如何组合 descriptor、配置、权限、命令、事件和调度器。更复杂的 GUI、区域、packet、scoreboard 等能力可以按同样方式从 `PluginContext` 拆到独立组件。

```java
package com.example;

import io.fand.api.command.CommandExecutor;
import io.fand.api.command.CommandSender;
import io.fand.api.command.CommandSpec;
import io.fand.api.event.player.PlayerJoinEvent;
import io.fand.api.permission.PermissionDefault;
import io.fand.api.permission.PermissionDescriptor;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.util.List;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.logger().info("{} {}", context.descriptor().id(), context.descriptor().version());

        var enabled = context.config().getBoolean("welcome.enabled", true);
        var message = context.config().getString("welcome.message", "Welcome, {player}");

        context.permissions().register(new PermissionDescriptor(
                "example.reload",
                PermissionDefault.OPERATOR));

        context.commands().register(new ReloadCommand(context));

        context.events().subscribe(PlayerJoinEvent.class, event -> {
            if (enabled) {
                event.player().sendMessage(Component.text(
                        message.replace("{player}", event.player().name())));
            }
        });
    }

    @CommandSpec(label = "example", subcommands = {"reload"}, permission = "example.reload")
    private static final class ReloadCommand implements CommandExecutor {
        private final PluginContext context;

        private ReloadCommand(PluginContext context) {
            this.context = context;
        }

        @Override
        public void execute(CommandSender sender, String label, List<String> args) {
            context.reloadConfig();
            sender.sendMessage(Component.text("Example config reloaded"));
        }
    }
}
```

## Maven 坐标

```kotlin
repositories {
    maven("https://repo.fandmc.cn/repository/maven-public/")
}

dependencies {
    compileOnly("io.fand:fand-api:latest.release")
}
```

实际插件工程建议优先使用官方 Gradle 插件，它会自动配置 API 依赖并处理 `fand-plugin.json`。
