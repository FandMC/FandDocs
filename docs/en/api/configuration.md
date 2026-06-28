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

## Guidelines

- Use lowercase dot-separated keys, such as `database.host`.
- Give typed getters reasonable defaults to avoid startup failures from user mistakes.
- Call `save()` only when persisting user-facing changes.
- `Configuration` is not thread-safe; synchronize access yourself if multiple threads touch the same instance.
