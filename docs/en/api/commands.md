# Commands

Commands are usually registered in `onEnable` through `context.commands()`. Plugin-scoped commands are automatically
owned by the current plugin namespace and cleaned up when the plugin is disabled. Command senders implement Adventure
`Audience`, so they can receive `Component` messages directly.

Since Fand 0.6, commands use a structured command tree. The older `CommandDescriptor`, `CommandSpec`,
`CommandExecutor`, and `CommandCompleter` style is no longer recommended; new plugins should use the Builder API or
annotated command classes.

## Builder Commands

Builder commands are useful when declaring simple commands in your plugin entry point or a command service. A root
command can declare aliases, permissions, a default executor, subcommands, and typed arguments:

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

This registers `/hello`, `/hello to <target>`, and the `/hi` alias. `literal(...)` adds a fixed subcommand segment,
while `argument(...)` adds a typed argument node. Only nodes with `executes(...)` are executable.

Permissions can be attached to the root or to a specific subcommand:

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

Common factories live in `Arguments`:

- `word()`: a single non-space word.
- `string()`: one Brigadier string argument.
- `greedyString()`: consumes the rest of the input, useful for messages, reasons, and config values.
- `bool()`: `true` or `false`.
- `integer()` / `integer(min, max)`: integer arguments with optional bounds.
- `longValue(min, max)`, `floatValue()`, `doubleValue()`: numeric arguments.
- `player()`: an online player.
- `item()`: an item registry key.
- `enumValue(...)`: a finite string set.

Arguments can be optional, have defaults, or use the sender as the default when the sender type matches:

```java
context.commands().register("giveitem", root -> root
        .argument("item", Arguments.item(), item -> item
                .argument("amount", Arguments.integer(1, 2304).optional(1), amount -> amount
                        .executes(command -> giveItem(
                                command.sender(),
                                command.item("item"),
                                command.intValue("amount"))))));
```

Completion can be attached to an argument definition or the current command node. The runtime filters returned candidates
by the prefix the player is typing, so suggestion callbacks only need to return the candidate list:

```java
context.commands().register("mode", root -> root
        .argument("value", Arguments.enumValue("fast", "safe", "debug"), value -> value
                .executes(command -> setMode(command.string("value")))));

context.commands().register("warp", root -> root
        .argument("name", Arguments.word(), name -> name
                .suggests(command -> knownWarpsFor(command.sender()))
                .executes(command -> warp(command.sender(), command.string("name")))));
```

## Annotated Commands

Annotated command classes are useful for larger commands that deserve their own class. Use `@Command`, `@Aliases`, and
`@Permission` on the class; use `@Default` or `@Subcommand` on executable methods:

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

`@Subcommand` can contain multiple path segments, such as `@Subcommand("config reload")`. Method parameters can be a
`CommandContext` or typed parameters annotated with `@Arg`. When `type` is omitted, the runtime infers it from the Java
parameter type:

- `String` defaults to `WORD`; use `CommandArgumentType.GREEDY_STRING` when the argument should include spaces.
- `int` / `Integer`, `long` / `Long`, `boolean` / `Boolean`, `float` / `Float`, and `double` / `Double` map to matching numeric or boolean arguments.
- `Player` maps to a player argument.
- `ItemType` maps to an item registry key.

Annotated arguments also support suggestions, ranges, and default values:

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

`CommandContext` exposes structured invocation data:

- `sender()` / `sender(SomeSender.class)`: the command sender.
- `label()`: the actual root label the user typed, possibly an alias.
- `args()`: raw argument tokens.
- `arguments()`: parsed argument map.
- `has(name)`, `argument(name, type)`, `optionalArgument(name, type)`: generic accessors.
- `string(name)`, `intValue(name)`, `booleanValue(name)`, `player(name)`, `item(name)`, and similar typed accessors.

`CommandSender` exposes `hasPermission(String permission)`. Command permission nodes should be declared in
`fand-plugin.json` or registered through `PermissionService` so management tools can discover defaults.

## Lookup and Completion

`CommandRegistry` can be used for visible-command lookup, completions, and ownership checks:

```java
var visible = context.commands().visibleCommands(sender);
var suggestions = context.commands().suggestions(sender, List.of("example", "r"));
var info = context.commands().lookup("example:example");
var claimed = context.commands().claims(List.of("example", "reload"));
```

These methods are useful for custom help pages, GUI command panels, and debugging tools. Local root commands resolve
only when the root is unambiguous. If multiple plugins register the same root, users can target a command explicitly
with `namespace:label`.

## Design Philosophy

Fand models each command as a tree: root command, literal nodes, argument nodes, and executable nodes are all declared
at registration time. The runtime can use the same structure for permission visibility, completions, help display, and
plugin lifecycle cleanup.

Plugin-scoped `context.commands()` scopes command namespaces to the current plugin id. Multiple plugins can register the same root label, while users can still call a specific command with `namespace:label`.

## Best Practices

- Use short, stable, lowercase labels.
- Prefix permission nodes with the plugin id, such as `example.reload`.
- Prefer typed `Arguments` instead of repeatedly parsing strings in business code.
- Administrative commands should return clear feedback instead of failing silently.
- Use `literal(...)` or `@Subcommand("a b")` to model complex subcommand paths.
- Move slow work to async tasks, then return to the main thread before sending final state changes or mutating the world.
- Declare public command permissions in `fand-plugin.json` or register them through `PermissionService`.
- Keep completion logic lightweight; do not query a database on every tab completion.

## Common Pitfalls

- A namespace written in plugin scope is not the final namespace; the current plugin id is used.
- If multiple plugins register the same local root, the root may be ambiguous. Tell users to call `namespace:label`.
- `String` parameters in annotated commands default to `WORD`; use `GREEDY_STRING` for full text.
- `suggests(...)` returns candidates; the runtime filters by the current input prefix.
- Checking permission only in business code but not declaring the permission makes management tools unable to discover the default policy.
- Blocking I/O or heavy computation inside a command can stall ticks; split it into scheduler async and main-thread apply phases.

## Complete Example: Full Command Plugin

This example registers `/example reload [target]` with annotation metadata, permission registration, completion, and feedback.

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
