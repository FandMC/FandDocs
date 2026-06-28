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

## 命令设计建议

- label 使用短小、稳定、全小写名称。
- 权限节点使用插件 id 作为前缀，例如 `example.reload`。
- `CommandSpec` 没有描述文本字段；命令说明应由插件自己的帮助命令或文档展示。
- 管理命令要给出明确反馈，不要静默失败。
- 复杂子命令建议自己解析第一段参数，或封装成小型 command router。
- 耗时逻辑放到异步任务，完成后再回主线程发送结果或修改世界状态。
