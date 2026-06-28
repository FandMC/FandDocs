# Configuration

Fand provides two configuration entry points:

- `context.config()`: the default plugin configuration at `config.yml` in the plugin data directory.
- `context.configurations()`: a generic loader for YAML, JSON, TOML, properties, and other supported files.

## Default Configuration

On first access to `context.config()`, if the data directory does not contain `config.yml`, the runtime tries to copy the default `config.yml` from the plugin jar root. If the jar does not contain one either, an empty document is created.

```java
var config = context.config();
var enabled = config.getBoolean("features.enabled", true);
var message = config.getString("messages.welcome", "Welcome");
```

Example `src/main/resources/config.yml`:

```yaml
features:
  enabled: true
messages:
  welcome: "Welcome to Fand"
```

## Reading and Writing Values

Configuration paths are dot-separated. Typed getters return their default value on type mismatch instead of throwing.

```java
var host = config.getString("database.host", "localhost");
var port = config.getInt("database.port", 3306);
var debug = config.getBoolean("debug", false);
var worlds = config.getStringList("enabled-worlds");
```

After changing values, call `save()` on the root `Configuration` to persist them.

```java
var config = context.config();
config.set("features.enabled", true);
config.set("messages.welcome", "Hello");
config.save();
```

Passing `null` removes a path:

```java
config.set("temporary.value", null);
config.save();
```

## Sections

`getSection` returns a sub-section. If it does not exist, an empty section is created. Mutating a sub-section changes the root configuration, but the root still needs `save()`.

```java
var database = config.getSection("database");
database.set("host", "127.0.0.1");
database.set("port", 3306);
config.save();
```

## Reloading

`reloadConfig()` reads `config.yml` from disk again and discards unsaved in-memory changes.

```java
context.reloadConfig();
```

## Loading Other Files

`ConfigurationService` is useful for extra files in the plugin data directory.

```java
var file = context.dataDirectory().resolve("messages.json");
var messages = context.configurations().load(file);
```

You can also specify a format explicitly:

```java
var config = context.configurations().load(file, ConfigurationFormat.JSON);
```

## Design Philosophy

Fand separates the default plugin configuration from arbitrary configuration file loading so common plugins stay simple, while larger plugins can split `messages.yml`, `database.json`, or other data files when needed.

Typed getters return defaults on type mismatch so each read site declares a fallback strategy. Critical configuration should still be validated by plugin code with clear feedback for server owners.

`ConfigurationSection` is a view over the same in-memory document, not an independent copy. Mutating a section affects the root document, while persistence is still controlled by root `Configuration.save()`.

## Best Practices

- Use lowercase dot-separated keys, such as `database.host`.
- Give typed getters reasonable defaults to avoid startup failures from user mistakes.
- Call `save()` only when persisting user-facing changes.
- `Configuration` is not thread-safe; synchronize access yourself if multiple threads touch the same instance.
- Put a default `config.yml` at the plugin jar root so first startup generates readable configuration.
- Keep keys stable. When renaming keys, include migration or compatibility reads.
- Use typed getters for normal toggles, messages, and numeric thresholds; validate critical values such as database endpoints and external tokens.
- Store editable server-owner settings in configuration; store player data, caches, and runtime statistics elsewhere.

## Common Pitfalls

- `getSection("path")` creates an empty section when missing. Use `contains("path")` if you only want to check existence.
- Mutating a child section without calling `save()` on the root loses changes after restart.
- `reloadConfig()` discards unsaved in-memory changes.
- A typed getter returning the default does not prove the file is valid; critical fields still need validation.
- Concurrent reads and writes to the same `Configuration` are not synchronized by the API.

## Complete Example: Config-Driven Welcome Message

This example loads the default configuration and sends a configured welcome message on join. The string template is plugin logic; Fand does not prescribe a message format.

```java
package com.example;

import io.fand.api.event.player.PlayerJoinEvent;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    private String welcomeMessage = "Welcome, {player}";
    private boolean enabled = true;

    @Override
    public void onEnable(PluginContext context) {
        loadSettings(context);

        context.events().subscribe(PlayerJoinEvent.class, event -> {
            if (!enabled) {
                return;
            }
            var text = welcomeMessage.replace("{player}", event.player().name());
            event.player().sendMessage(Component.text(text));
        });
    }

    private void loadSettings(PluginContext context) {
        var config = context.config();
        enabled = config.getBoolean("welcome.enabled", true);
        welcomeMessage = config.getString("welcome.message", "Welcome, {player}");

        if (!config.contains("welcome.enabled")) {
            config.set("welcome.enabled", enabled);
            config.set("welcome.message", welcomeMessage);
            config.save();
        }
    }
}
```
