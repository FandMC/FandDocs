# fand-plugin.json

`fand-plugin.json` is the descriptor file at the root of a Fand plugin jar. The server uses it to identify the plugin id, version, main class, dependency ordering, and static permission declarations.

If a jar does not contain `fand-plugin.json`, Fand does not load it as a Fand plugin. Jars containing only descriptors such as `plugin.yml`, `paper-plugin.yml`, `fabric.mod.json`, or `META-INF/mods.toml` are recognized as plugins or mods for other loaders and reported with a warning.

## Minimal Example

```json
{
  "id": "example-plugin",
  "version": "1.0.0",
  "mainClass": "com.example.ExamplePlugin",
  "apiVersion": "0.1.2"
}
```

## Full Example

```json
{
  "id": "example-plugin",
  "version": "1.0.0",
  "mainClass": "com.example.ExamplePlugin",
  "description": "Example plugin for Fand",
  "website": "https://example.com",
  "license": "MIT",
  "apiVersion": "0.1.2",
  "authors": ["FandMC"],
  "depends": ["required-plugin"],
  "loadAfter": ["soft-provider"],
  "loadBefore": ["consumer-plugin"],
  "permissions": [
    {
      "node": "example-plugin.reload",
      "defaultAccess": "OPERATOR",
      "children": {
        "example-plugin.status": true,
        "example-plugin.danger": false
      }
    }
  ]
}
```

## Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique plugin id. Must match `[a-z0-9]+(?:-[a-z0-9]+)*`, such as `example-plugin`. |
| `version` | string | Yes | Plugin version. Semantic versions such as `1.0.0` are recommended. |
| `mainClass` | string | Yes | Fully qualified main class. It must implement `io.fand.api.plugin.Plugin` and provide a no-arg constructor. |
| `apiVersion` | string | Recommended | Fand API version targeted by the plugin. The server accepts missing legacy descriptors and applies the runtime compatibility default version; the official Gradle plugin requires this field when validating a new descriptor. An explicit blank string is rejected. |
| `description` | string | No | Short plugin description. |
| `website` | string | No | Plugin website or documentation URL. When present, it must use `http` or `https`. |
| `license` | string | No | License identifier or name, such as `MIT` or `GPL-3.0`. |
| `authors` | string[] | No | Author list. Missing means an empty list. |
| `depends` | string[] | No | Hard dependencies. Target plugins must exist and load first. Each id must follow the plugin id rule. |
| `loadAfter` | string[] | No | Soft ordering. Load after the target plugin when it is present; ignore when missing. Each id must follow the plugin id rule. |
| `loadBefore` | string[] | No | Soft ordering. Load before the target plugin when it is present; ignore when missing. Each id must follow the plugin id rule. |
| `permissions` | object[] | No | Static permission declarations. Missing means an empty list. |

## Dependencies and Load Order

`depends` affects availability and classloader dependencies. If a dependency is missing, the plugin cannot load normally.

```json
{
  "depends": ["economy-core"]
}
```

`loadAfter` and `loadBefore` only express ordering. They do not require the target plugin to exist.

```json
{
  "loadAfter": ["luckperms"],
  "loadBefore": ["example-addon"]
}
```

If soft ordering forms a cycle, affected plugins may be skipped or recorded with a load error depending on server load policy.

## Permission Declarations

A permission item contains:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `node` | string | Yes | Permission node. It must belong to the plugin namespace. |
| `defaultAccess` | string | No | Default access. Missing means `FALSE`. |
| `children` | object | No | Child permission map. Keys are permission nodes and values are booleans. |

Allowed `defaultAccess` values:

```text
TRUE
FALSE
OPERATOR
NOT_OPERATOR
```

Permission nodes must belong to the plugin namespace. For plugin id `example-plugin`, the server accepts these namespace forms:

```text
example-plugin.reload
example.plugin.reload
exampleplugin.reload
```

The clearest form is to use the plugin id as the prefix:

```json
{
  "permissions": [
    {
      "node": "example-plugin.reload",
      "defaultAccess": "OPERATOR"
    }
  ]
}
```

## Gradle Plugin Generation

With the official Gradle plugin, `fand-plugin.json` can be generated or processed from `build.gradle.kts`:

```kotlin
fandPlugin {
    id.set("example-plugin")
    version.set(project.version.toString())
    mainClass.set("com.example.ExamplePlugin")
    apiVersion.set("0.1.2")

    description.set("Example plugin for Fand")
    website.set("https://example.com")
    license.set("MIT")
    authors.add("FandMC")
    depends.add("required-plugin")
    loadAfter.add("soft-provider")
    loadBefore.add("consumer-plugin")
}
```

Optional fields do not need to be forced into the descriptor when they are not configured. More complex permission declarations can be maintained directly in a `fand-plugin.json` template.

The official Gradle plugin does not generate a `permissions` field automatically. For static permission declarations, maintaining a descriptor template is usually clearer.

## Common Mistakes

- The jar root does not contain `fand-plugin.json`.
- `mainClass` does not exist, has no no-arg constructor, or does not implement `Plugin`.
- `website` does not use `http` or `https`.
- A plugin listed in `depends` is missing.
- A permission node is outside the plugin namespace.
- A Bukkit, Paper, Fabric, Forge, NeoForge, or other-loader jar is placed in the Fand plugin directory.
