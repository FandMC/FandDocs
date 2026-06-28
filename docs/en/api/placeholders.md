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

## Guidelines

- Use the plugin id as the namespace, matching the descriptor.
- Providers should return quickly; do not query databases during placeholder resolution.
- Escape user input before inserting it into MiniMessage templates.
- Return `null` for unresolved placeholders so the original `%placeholder%` remains visible for debugging.
