# Placeholders and MiniMessage

`PlaceholderService` registers `%namespace_value%` style placeholders. `MiniMessageService` parses Adventure MiniMessage strings into `Component`s. Fand Server's MiniMessage implementation replaces Fand placeholders before handing the string to the Adventure MiniMessage parser.

## Registering Placeholders

Plugin-scoped `context.placeholders()` only allows registering the current plugin id as the namespace.

```java
context.placeholders().register("example-plugin", (viewer, identifier) -> switch (identifier) {
    case "example-plugin_online" -> String.valueOf(Fand.server().players().size());
    case "example-plugin_viewer" -> viewer == null ? "console" : viewer.name();
    default -> null;
});
```

Resolving `%example-plugin_online%` dispatches `example-plugin_online` to the `example-plugin` provider. Returning `null` means unresolved, and the original placeholder remains in the output.

## Contextual Placeholders

Use `PlaceholderProvider.contextual` when the placeholder needs a viewer, target, world, entity, or extra context values.

```java
import io.fand.api.placeholder.PlaceholderContext;
import io.fand.api.placeholder.PlaceholderProvider;

context.placeholders().register("example-plugin", PlaceholderProvider.contextual((placeholderContext, identifier) -> {
    if (identifier.equals("example-plugin_target")) {
        return placeholderContext.targetOptional()
                .map(target -> target.name())
                .orElse("none");
    }
    if (identifier.equals("example-plugin_mode")) {
        return placeholderContext.value("mode", String.class).orElse(null);
    }
    return null;
}));

var placeholderContext = PlaceholderContext.builder()
        .viewer(viewer)
        .target(target)
        .world(viewer.world())
        .value("mode", "arena")
        .build();

var text = context.placeholders().replace(
        "Target: %example-plugin_target%, mode: %example-plugin_mode%",
        placeholderContext);
```

Context value keys are normalized to lowercase.

## Parsing Text

```java
var plain = context.placeholders().replace(player, "Online: %example-plugin_online%");
var component = context.miniMessages().parse(player, "<green>%example-plugin_viewer%</green>");
```

`parse(viewer, input)` replaces placeholders first, then parses MiniMessage tags. Use the overload with `TagResolver`s for custom tags:

```java
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;

var component = context.miniMessages().parse(
        player,
        "<green><name></green>",
        Placeholder.component("name", Component.text(player.name())));
```

## Escaping and Stripping

`MiniMessageService` exposes the Adventure parser for serialization, escaping tags, and stripping tags.

```java
var safe = context.miniMessages().escapeTags(userInput);
var stripped = context.miniMessages().stripTags(userInput);
var serialized = context.miniMessages().serialize(component);
```

## Design Philosophy

Fand uses `%namespace_value%` placeholders and dispatches providers by namespace so plugins can share one placeholder service without stealing each other's names. Plugin-scoped `context.placeholders()` only allows registering the plugin's own namespace.

MiniMessage parsing replaces placeholders first so configuration can contain text such as `<green>%example_name%</green>`. Placeholders provide text values; MiniMessage provides color, hover, click, and component semantics.

`PlaceholderContext` separates viewer from target for relationship-aware placeholders: for example, a viewer inspecting a target profile, an entity status line, or a leaderboard mode in a specific world.

## Best Practices

- Use the plugin id as the namespace, matching the descriptor.
- Providers should return quickly; do not query databases during placeholder resolution.
- Escape user input before inserting it into MiniMessage templates.
- Return `null` for unresolved placeholders so the original `%placeholder%` remains visible for debugging.
- Use `PlaceholderProvider.contextual(...)` for relationship-aware placeholders instead of global mutable state.
- Keep context value keys stable; they are normalized to lowercase.

## Common Pitfalls

- Placeholder namespaces cannot contain `_`, because `_` separates the namespace from the rest of the identifier.
- Identifiers are trimmed and lowercased; provider logic should not depend on case.
- Plugin-scoped access can resolve any namespace but can only register the plugin's own namespace.
- Placeholder replacement is not a full template engine; complex conditions belong in plugin code.
- `parse(viewer, input)` replaces placeholders before MiniMessage parsing, so user input should be escaped first.

## Complete Example: Viewer and Target Placeholders

This example registers `%example-plugin_viewer%`, `%example-plugin_target%`, and `%example-plugin_mode%`. The target placeholder reads from `PlaceholderContext.target(...)`.

```java
package com.example;

import io.fand.api.placeholder.PlaceholderContext;
import io.fand.api.placeholder.PlaceholderProvider;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.placeholders().register(
                context.descriptor().id(),
                PlaceholderProvider.contextual((placeholderContext, identifier) -> {
                    return switch (identifier) {
                        case "example-plugin_viewer" -> placeholderContext.viewerOptional()
                                .map(viewer -> viewer.name())
                                .orElse("console");
                        case "example-plugin_target" -> placeholderContext.targetOptional()
                                .map(target -> target.name())
                                .orElse("none");
                        case "example-plugin_mode" -> placeholderContext
                                .value("mode", String.class)
                                .orElse("default");
                        default -> null;
                    };
                }));
    }

    public void sendInspectLine(PluginContext context, io.fand.api.entity.Player viewer, io.fand.api.entity.Player target) {
        var placeholderContext = PlaceholderContext.builder()
                .viewer(viewer)
                .target(target)
                .value("mode", "inspect")
                .build();

        var line = context.placeholders().replace(
                "Viewer=%example-plugin_viewer%, target=%example-plugin_target%, mode=%example-plugin_mode%",
                placeholderContext);
        viewer.sendMessage(Component.text(line));
    }
}
```
