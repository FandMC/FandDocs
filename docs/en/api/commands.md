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

## Command Design Guidelines

- Use short, stable, lowercase labels.
- Prefix permission nodes with the plugin id, such as `example.reload`.
- `CommandSpec` has no description field; command help text should be shown by your own help command or documentation.
- Administrative commands should return clear feedback instead of failing silently.
- For complex subcommands, parse the first argument yourself or introduce a small command router.
- Move slow work to async tasks, then return to the main thread before sending final state changes or mutating the world.
