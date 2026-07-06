# 命令

命令通常在 `onEnable` 中注册到 `context.commands()`。插件作用域命令会自动归属到当前插件命名空间，
并在插件禁用时清理。命令发送者实现 Adventure `Audience`，所以可以直接发送 `Component` 消息。

Fand 0.6 起，命令 API 使用结构化命令树。旧的 `CommandDescriptor`、`CommandSpec`、
`CommandExecutor` 和 `CommandCompleter` 写法已经不再推荐；新插件应该使用 Builder 或注解命令。

## Builder 命令

Builder 适合在插件入口或命令服务类中声明简单命令。根命令可以继续挂别名、权限、默认执行器、子命令
和类型化参数：

```java
import io.fand.api.command.Arguments;
import net.kyori.adventure.text.Component;

context.commands().register("hello", root -> root
        .aliases("hi")
        .permission("example.hello")
        .executes(command -> command.sender().sendMessage(Component.text("Hello, " + command.sender().name())))
        .literal("to", to -> to
                .argument("target", Arguments.greedyString(), target -> target
                        .executes(command -> command.sender().sendMessage(
                                Component.text("Hello, " + command.string("target")))))));
```

上面的命令提供 `/hello`、`/hello to <target>` 和别名 `/hi`。`literal(...)` 表示固定子命令，
`argument(...)` 表示参数节点；只有设置了 `executes(...)` 的节点才是可执行路径。

权限可以放在根节点，也可以放在某个子命令节点：

```java
context.commands().register("example", root -> root
        .permission("example.use")
        .executes(command -> showHelp(command.sender()))
        .literal("reload", reload -> reload
                .permission("example.reload")
                .executes(command -> {
                    context.reloadConfig();
                    command.sender().sendMessage(Component.text("Example config reloaded"));
                }))
        .literal("set", set -> set
                .argument("key", Arguments.word(), key -> key
                        .argument("value", Arguments.greedyString(), value -> value
                                .executes(command -> setConfig(
                                        command.sender(),
                                        command.string("key"),
                                        command.string("value")))))));
```

常用参数工厂在 `Arguments` 中：

- `word()`：单个无空格词。
- `string()`：一个 Brigadier 字符串参数。
- `greedyString()`：吞掉剩余输入，适合消息、理由和配置值。
- `bool()`：`true` 或 `false`。
- `integer()` / `integer(min, max)`：整数，可限制范围。
- `longValue(min, max)`、`floatValue()`、`doubleValue()`：数字参数。
- `player()`：在线玩家。
- `item()`：物品注册表 key。
- `enumValue(...)`：有限字符串集合。

参数可以声明为可选、带默认值，或在发送者类型匹配时默认使用发送者：

```java
context.commands().register("giveitem", root -> root
        .argument("item", Arguments.item(), item -> item
                .argument("amount", Arguments.integer(1, 2304).optional(1), amount -> amount
                        .executes(command -> giveItem(
                                command.sender(),
                                command.item("item"),
                                command.intValue("amount"))))));
```

补全可以直接挂在参数定义上，也可以挂在当前命令节点上。运行时会按玩家正在输入的前缀过滤结果，
补全回调只需要返回候选列表：

```java
context.commands().register("mode", root -> root
        .argument("value", Arguments.enumValue("fast", "safe", "debug"), value -> value
                .executes(command -> setMode(command.string("value")))));

context.commands().register("warp", root -> root
        .argument("name", Arguments.word(), name -> name
                .suggests(command -> knownWarpsFor(command.sender()))
                .executes(command -> warp(command.sender(), command.string("name")))));
```

## 注解命令

注解命令适合把较大的命令拆到独立类中维护。类上使用 `@Command`、`@Aliases` 和 `@Permission`，
方法上使用 `@Default` 或 `@Subcommand`：

```java
import io.fand.api.command.Aliases;
import io.fand.api.command.Arg;
import io.fand.api.command.Command;
import io.fand.api.command.CommandArgumentType;
import io.fand.api.command.CommandContext;
import io.fand.api.command.Default;
import io.fand.api.command.Permission;
import io.fand.api.command.Subcommand;
import net.kyori.adventure.text.Component;

@Command("hello")
@Aliases({"hi", "hey"})
@Permission("example.hello")
public final class HelloCommand {
    @Default
    public void self(CommandContext command) {
        command.sender().sendMessage(Component.text("Hello, " + command.sender().name()));
    }

    @Subcommand("to")
    public void target(
            CommandContext command,
            @Arg(value = "name", type = CommandArgumentType.GREEDY_STRING) String name
    ) {
        command.sender().sendMessage(Component.text("Hello, " + name));
    }
}

context.commands().register(new HelloCommand());
```

`@Subcommand` 可以包含多段路径，例如 `@Subcommand("config reload")`。方法参数可以是
`CommandContext`，也可以是带 `@Arg` 的类型化参数。未显式指定 `type` 时，运行时会按 Java 参数类型推断：

- `String` 默认是 `WORD`，需要空格内容时指定 `CommandArgumentType.GREEDY_STRING`。
- `int` / `Integer`、`long` / `Long`、`boolean` / `Boolean`、`float` / `Float`、`double` / `Double`
  会映射到对应数字或布尔参数。
- `Player` 会映射为玩家参数。
- `ItemType` 会映射为物品注册表 key。

注解参数同样支持补全、范围和默认值：

```java
@Command("demo")
@Permission("example.demo")
public final class DemoCommand {
    @Subcommand("repeat")
    public void repeat(
            CommandContext command,
            @Arg(value = "times", min = 1, max = 10, optional = true, defaultInt = 1) int times,
            @Arg(value = "message", type = CommandArgumentType.GREEDY_STRING) String message
    ) {
        for (var i = 0; i < times; i++) {
            command.sender().sendMessage(Component.text(message));
        }
    }

    @Subcommand("mode")
    public void mode(@Arg(value = "value", type = CommandArgumentType.ENUM, suggestions = {"fast", "safe"}) String value) {
        setMode(value);
    }
}
```

## CommandContext

`CommandContext` 是一次命令调用的结构化数据：

- `sender()` / `sender(SomeSender.class)`：命令发送者。
- `label()`：玩家实际使用的根命令名，可能是别名。
- `args()`：原始参数列表。
- `arguments()`：已解析参数 map。
- `has(name)`、`argument(name, type)`、`optionalArgument(name, type)`：通用访问。
- `string(name)`、`intValue(name)`、`booleanValue(name)`、`player(name)`、`item(name)` 等：常用类型访问。

`CommandSender` 提供 `hasPermission(String permission)`。命令权限节点建议在 `fand-plugin.json` 或
`PermissionService` 中声明，方便管理插件发现和默认值。

## 查询与补全

`CommandRegistry` 可以用于命令可见性、补全和命令归属查询：

```java
var visible = context.commands().visibleCommands(sender);
var suggestions = context.commands().suggestions(sender, List.of("example", "r"));
var info = context.commands().lookup("example:example");
var claimed = context.commands().claims(List.of("example", "reload"));
```

这些能力适合做自定义命令帮助页、GUI 命令面板或调试工具。本地根命令只有在该 root 没有歧义时才会被解析；
多个插件注册同名 root 时，用户可以使用 `namespace:label` 形式指定命名空间。

## 为什么这样设计

Fand 命令 API 把命令建模成一棵树：根命令、字面量节点、参数节点和执行节点都在注册时声明清楚。
运行时可以基于同一份结构处理权限可见性、补全、帮助展示和命令生命周期清理。

插件作用域的 `context.commands()` 会把命令 namespace 收敛到当前插件 id。这样多个插件可以注册同名 root，用户仍然能通过 `namespace:label` 明确调用。

## 最佳实践

- label 使用短小、稳定、全小写名称。
- 权限节点使用插件 id 作为前缀，例如 `example.reload`。
- 优先使用 `Arguments` 的类型化参数，不要在业务代码里重复手写解析。
- 管理命令要给出明确反馈，不要静默失败。
- 复杂子命令使用 `literal(...)` 或 `@Subcommand("a b")` 拆清路径。
- 耗时逻辑放到异步任务，完成后再回主线程发送结果或修改世界状态。
- 对公开命令声明权限节点，并在 `fand-plugin.json` 或 `PermissionService` 中注册默认值。
- 补全里只做轻量逻辑；不要在每次 tab completion 时查询数据库。

## 常见坑

- 在插件作用域里手写 namespace 没有最终效果；最终 namespace 会使用当前插件 id。
- 多个插件注册同名 root 时，本地 root 可能有歧义。提示用户使用 `namespace:label`。
- 注解命令里的 `String` 参数默认是 `WORD`；需要整段文本时要显式使用 `GREEDY_STRING`。
- `suggests(...)` 返回候选列表即可，运行时会按当前输入前缀过滤。
- 只在业务代码里检查权限，但没有声明 permission，会让管理工具无法发现这个命令的默认权限。
- 命令里执行 I/O 或复杂计算会卡 tick，应拆到 scheduler 异步阶段。

## 综合示例：完整命令插件

下面的例子注册一个 `/example reload [target]` 子命令，包含注解声明、权限、补全和反馈。

```java
package com.example;

import io.fand.api.command.Arg;
import io.fand.api.command.Command;
import io.fand.api.command.CommandContext;
import io.fand.api.command.Default;
import io.fand.api.command.Permission;
import io.fand.api.command.Subcommand;
import io.fand.api.permission.PermissionDefault;
import io.fand.api.permission.PermissionDescriptor;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.permissions().register(new PermissionDescriptor(
                "example.reload",
                PermissionDefault.OPERATOR));
        context.commands().register(new ReloadCommand(context));
    }

    @Command("example")
    @Permission("example.reload")
    private static final class ReloadCommand {
        private final PluginContext context;

        private ReloadCommand(PluginContext context) {
            this.context = context;
        }

        @Default
        public void help(CommandContext command) {
            command.sender().sendMessage(Component.text("Usage: /example reload [config|messages]"));
        }

        @Subcommand("reload")
        public void reload(
                CommandContext command,
                @Arg(value = "target", optional = true, defaultValue = "config", suggestions = {"config", "messages"}) String target
        ) {
            context.reloadConfig();
            command.sender().sendMessage(Component.text("Example " + target + " reloaded"));
        }
    }
}
```
