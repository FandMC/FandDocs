# Commands

Commands are usually registered in `onEnable` through `context.commands()`. Plugin-scoped commands are cleaned up when the plugin is disabled. Command senders implement Adventure `Audience`, so they can receive `Component` messages directly.

## Annotated Commands

Annotated commands are good for declaring label, subcommand path, argument names, aliases, and permission quickly.

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

Register it:

```java
context.commands().register(new HelloCommand());
```

## Descriptor Registration

For dynamic commands, register a `CommandDescriptor`, `CommandExecutor`, and `CommandCompleter` directly. When registering through plugin-scoped `context.commands()`, the final namespace is the current plugin id; `"ignored"` in the example is only a placeholder and will not become the final namespace.

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

## Permissions

`CommandSender` exposes `hasPermission(String permission)`. Command permission nodes should be declared in `fand-plugin.json` or registered through `PermissionService` so management tools can discover defaults.

```java
if (!sender.hasPermission("example.admin")) {
    sender.sendMessage(Component.text("No permission"));
    return;
}
```

## Completion and Resolution

`CommandRegistry` can also be used for visible-command lookup, completions, and command resolution.

```java
var visible = context.commands().visibleCommands(sender);
var suggestions = context.commands().suggestions(sender, List.of("example", ""));
var resolved = context.commands().resolve(sender, List.of("example", "reload"));
```

These methods are useful for custom help pages, GUI command panels, and debugging tools.

Local root commands resolve only when the root is unambiguous. If multiple plugins register the same root, users can target a command explicitly with `namespace:label`.

## Design Philosophy

Fand separates static command description (`CommandDescriptor` / `CommandSpec`) from execution logic (`CommandExecutor`). The static description is used for command tree construction, permission visibility, completion, and management tooling. The executor only handles the sender, actual label, and argument tokens.

`CommandSpec` is concise and works well for simple commands. `CommandDescriptor` is better for dynamic commands, typed argument metadata, or command trees generated from configuration or other plugins.

Plugin-scoped `context.commands()` scopes command namespaces to the current plugin id. Multiple plugins can register the same root label, while users can still call a specific command with `namespace:label`.

## Best Practices

- Use short, stable, lowercase labels.
- Prefix permission nodes with the plugin id, such as `example.reload`.
- `CommandSpec` has no description field; command help text should be shown by your own help command or documentation.
- Administrative commands should return clear feedback instead of failing silently.
- For complex subcommands, parse the first argument yourself or introduce a small command router.
- Move slow work to async tasks, then return to the main thread before sending final state changes or mutating the world.
- Declare public command permissions in `fand-plugin.json` or register them through `PermissionService`.
- Keep completion logic lightweight; do not query a database on every tab completion.

## Common Pitfalls

- When registering `CommandDescriptor` through plugin scope, the descriptor namespace is not the final namespace; the current plugin id is used.
- If multiple plugins register the same local root, the root may be ambiguous. Tell users to call `namespace:label`.
- `CommandExecutor` receives string tokens, not automatically converted objects. Typed arguments describe command metadata and completion; business logic still validates input.
- Checking permission only inside `execute` but not declaring the permission makes management tools unable to discover the default policy.
- Blocking I/O or heavy computation inside a command can stall ticks; split it into scheduler async and main-thread apply phases.

## Complete Example: Full Command Plugin

This example registers `/example reload` with annotation metadata, permission registration, explicit permission checks, completion, and feedback.

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
