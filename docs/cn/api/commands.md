# 命令

命令通常在 `onEnable` 中注册到 `context.commands()`。插件作用域命令会随插件禁用清理。命令发送者实现 Adventure `Audience`，所以可以直接发送 `Component` 消息。

## 注解命令

注解命令适合快速声明 label、子命令路径、参数名、别名和权限。

```java
import io.fand.api.command.CommandExecutor;
import io.fand.api.command.CommandSender;
import io.fand.api.command.CommandSpec;
import java.util.List;
import net.kyori.adventure.text.Component;

@CommandSpec(
        label = "hello",
        aliases = {"hi"},
        permission = "example.hello"
)
public final class HelloCommand implements CommandExecutor {
    @Override
    public void execute(CommandSender sender, String label, List<String> args) {
        var target = args.isEmpty() ? sender.name() : String.join(" ", args);
        sender.sendMessage(Component.text("Hello, " + target));
    }
}
```

注册：

```java
context.commands().register(new HelloCommand());
```

## 描述符注册

需要动态创建命令时，可以直接使用 `CommandDescriptor`、`CommandExecutor` 和 `CommandCompleter`。在插件作用域的 `context.commands()` 中注册时，最终 namespace 会使用当前插件 id；示例里的 `"ignored"` 只是占位，不会成为最终命名空间。

```java
import io.fand.api.command.CommandDescriptor;
import java.util.List;

var descriptor = new CommandDescriptor(
        "ignored",
        "reloadexample",
        List.of(),
        List.of("args"),
        List.of(),
        "example.reload");

context.commands().register(
        descriptor,
        (sender, label, args) -> {
            context.reloadConfig();
            sender.sendMessage(Component.text("Example config reloaded"));
        },
        (sender, label, args) -> List.of());
```

## 权限

`CommandSender` 提供 `hasPermission(String permission)`。命令权限节点建议在 `fand-plugin.json` 或 `PermissionService` 中声明，方便管理插件发现和默认值。

```java
if (!sender.hasPermission("example.admin")) {
    sender.sendMessage(Component.text("No permission"));
    return;
}
```

## 补全与解析

`CommandRegistry` 也可以用于查询命令可见性、补全和解析。

```java
var visible = context.commands().visibleCommands(sender);
var suggestions = context.commands().suggestions(sender, List.of("example", ""));
var resolved = context.commands().resolve(sender, List.of("example", "reload"));
```

这些能力适合做自定义命令帮助页、GUI 命令面板或调试工具。

本地根命令只有在该 root 没有歧义时才会被解析。多个插件注册同名 root 时，用户可以使用 `namespace:label` 形式指定命名空间。

## 为什么这样设计

Fand 命令 API 把命令的静态描述 (`CommandDescriptor` / `CommandSpec`) 和执行逻辑 (`CommandExecutor`) 分开。静态描述用于服务端构建命令树、权限可见性、补全和管理工具展示；执行逻辑只关心 sender、实际 label 和参数 token。

`CommandSpec` 适合简单命令，代码少、声明直观。`CommandDescriptor` 适合动态命令、需要 typed argument metadata、或命令树由配置/其它插件生成的场景。

插件作用域的 `context.commands()` 会把命令 namespace 收敛到当前插件 id。这样多个插件可以注册同名 root，用户仍然能通过 `namespace:label` 明确调用。

## 最佳实践

- label 使用短小、稳定、全小写名称。
- 权限节点使用插件 id 作为前缀，例如 `example.reload`。
- `CommandSpec` 没有描述文本字段；命令说明应由插件自己的帮助命令或文档展示。
- 管理命令要给出明确反馈，不要静默失败。
- 复杂子命令建议自己解析第一段参数，或封装成小型 command router。
- 耗时逻辑放到异步任务，完成后再回主线程发送结果或修改世界状态。
- 对公开命令声明权限节点，并在 `fand-plugin.json` 或 `PermissionService` 中注册默认值。
- 补全里只做轻量逻辑；不要在每次 tab completion 时查询数据库。

## 常见坑

- 在插件作用域注册 `CommandDescriptor` 时手写 namespace 没有最终效果；最终 namespace 会使用当前插件 id。
- 多个插件注册同名 root 时，本地 root 可能有歧义。提示用户使用 `namespace:label`。
- `CommandExecutor` 收到的是字符串 token，不是自动转换后的对象。typed arguments 用于命令树和补全元数据，业务仍要校验参数。
- 只在 `execute` 里检查权限，但没有声明 permission，会让管理工具无法发现这个命令的默认权限。
- 命令里执行 I/O 或复杂计算会卡 tick，应拆到 scheduler 异步阶段。

## 综合示例：完整命令插件

下面的例子注册一个 `/example reload` 子命令，包含注解声明、权限检查、补全和反馈。

```java
package com.example;

import io.fand.api.command.CommandCompleter;
import io.fand.api.command.CommandExecutor;
import io.fand.api.command.CommandSender;
import io.fand.api.command.CommandSpec;
import io.fand.api.permission.PermissionDefault;
import io.fand.api.permission.PermissionDescriptor;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.util.List;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.permissions().register(new PermissionDescriptor(
                "example.reload",
                PermissionDefault.OPERATOR));
        context.commands().register(new ReloadCommand(context));
    }

    @CommandSpec(
            label = "example",
            subcommands = {"reload"},
            arguments = {"target"},
            permission = "example.reload"
    )
    private static final class ReloadCommand implements CommandExecutor, CommandCompleter {
        private final PluginContext context;

        private ReloadCommand(PluginContext context) {
            this.context = context;
        }

        @Override
        public void execute(CommandSender sender, String label, List<String> args) {
            if (!sender.hasPermission("example.reload")) {
                sender.sendMessage(Component.text("No permission"));
                return;
            }

            context.reloadConfig();
            sender.sendMessage(Component.text("Example config reloaded"));
        }

        @Override
        public List<String> complete(CommandSender sender, String label, List<String> args) {
            if (!sender.hasPermission("example.reload")) {
                return List.of();
            }
            return args.size() <= 1 ? List.of("config", "messages") : List.of();
        }
    }
}
```
