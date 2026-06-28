# API Overview

Fand plugins depend only on `fand-api`. `fand-api` is the stable compile-time surface for plugin authors, while runtime implementations are provided by Fand Server.

> [!IMPORTANT]
> Do not infer runtime behavior from Java `default` method bodies, fallback return values, or placeholder exceptions in the `fand-api` source. They primarily exist for source/binary compatibility while the API evolves; real behavior is provided by the active Fand Server runtime, plugin-scoped wrapper, or registered provider.

Prefer `PluginContext` for plugin-owned work. It represents the lifecycle scope of the current plugin, so commands, listeners, tasks, service providers, GUIs, boss bars, tab-list entries, and similar resources can be cleaned up when the plugin is disabled. Use `Fand.server()` when you need the global server view.

## Two Core Entry Points

| Entry Point | Role | Use For |
| --- | --- | --- |
| `PluginContext` | Plugin-scoped services | Commands, events, tasks, permissions, GUIs, packets, cross-plugin services |
| `Fand.server()` | Global server view | Online players, worlds, performance, global registries, broadcasts |

```java
public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.logger().info("{} enabled", context.descriptor().id());
        context.commands();
        context.events();
        context.scheduler();
    }
}
```

```java
Fand.server().players();
Fand.server().worlds();
Fand.server().performance();
Fand.server().itemType(Key.key("minecraft:diamond"));
```

## API Layers

Fand API can be read in layers:

| Layer | Representative APIs | Description |
| --- | --- | --- |
| Plugin basics | `plugin`, `lifecycle`, `config`, `storage` | Loading, configuration, data directories, persistence |
| Interaction | `command`, `event`, `scheduler`, `permission` | Player input, server behavior hooks, async/main-thread work, access control |
| Player experience | `text`, `placeholder`, `bossbar`, `tablist`, `scoreboard`, `gui`, `map` | Text, placeholders, screens, boss bars, player lists, scoreboards, map rendering |
| World and entities | `world`, `block`, `entity`, `inventory`, `player`, `tag` | Worlds, blocks, entities, players, inventories, vanilla tag lookup |
| Content extension | `customitem`, `customblock`, `recipe`, `loot`, `advancement`, `enchantment`, `datapack`, `structure` | Custom content, data-pack content, structures, generation-facing features |
| Ecosystem integration | `service`, `integration`, `messaging`, `region` | Cross-plugin providers, external resources, plugin messaging, region protection |
| Low-level presentation | `packet`, `component`, `registry`, `performance`, `gamerule`, `nbs` | Packets, components, registries, performance snapshots, game rules, NBS parsing |

## PluginContext Service Matrix

| Service | Entry Point | Typical Use |
| --- | --- | --- |
| Logging | `context.logger()` | SLF4J logger named after the plugin id |
| Descriptor | `context.descriptor()` | Read `id`, `version`, `mainClass`, dependencies, permission declarations |
| Events | `context.events()` | Register player, entity, world, plugin, and server listeners |
| Commands | `context.commands()` | Annotated commands, descriptor commands, completions, visible command lookup |
| Scheduler | `context.scheduler()` | Main-thread, async, delayed, repeating, tick-based tasks |
| Permissions | `context.permissions()` | Nodes, trees, attachments, groups, prefix/suffix/meta, context lookup |
| Configuration | `context.config()` | Default plugin `config.yml`, reload, save |
| Config Loader | `context.configurations()` | YAML, JSON, TOML, properties, and other config files |
| Storage | `context.storage()` | Plugin-scoped JSON/KV persistence |
| Services | `context.services()` | Economy, chat, permission bridge, region protection, and other Java providers |
| Regions | `context.regions()` | Region definitions, flag registration, priority ordering, resolution traces |
| Packets | `context.packets()` | Interception, construction, sending, custom payloads, fake blocks/entities |
| Placeholders | `context.placeholders()` | Register and resolve `%namespace_value%` style placeholders |
| MiniMessage | `context.miniMessages()` | Adventure MiniMessage with Fand placeholder replacement |
| GUIs | `context.guis()` | Inventory screens, slot handlers, close handlers |
| Scoreboards | `context.scoreboard()` | Objectives, display slots, teams, nameplates |
| Boss Bars | `context.bossBars()` | Create and update boss bars with lifecycle cleanup |
| Tab Lists | `context.tabLists()` | Per-viewer player-list visibility, sorting, and entries |
| Maps | `context.maps()` | Map renderers, cursors, per-player rendering |
| Plugin Messaging | `context.pluginMessaging()` | Standard plugin message channels |
| Custom Items | `context.customItems()` | Register custom item types and base-item bindings |
| Custom Blocks | `context.customBlocks()` | Register custom block types, listeners, item bindings |
| Recipes | `context.recipes()` | Register and remove recipes |
| Loot Tables | `context.lootTables()` | Loot tables in the plugin namespace |
| Advancements | `context.advancements()` | Advancements in the plugin namespace |
| Enchantments | `context.enchantments()` | Enchantments in the plugin namespace |
| Data Packs | `context.dataPacks()` | Plugin-scoped data-pack file trees |
| Structures | `context.structures()` | Template save, import, export, placement, locate |
| Game Rules | `context.gameRules()` | Plugin-namespaced custom game rules |
| Simulated Players | `context.simulatedPlayers()` | Server-side simulated players |
| Integrations | `context.integrations()` | External resource strategies for SQL, Redis, MQ, and similar systems |

## Global Server View

`Server` is an Adventure `ForwardingAudience` that forwards messages to current online players. It is useful for global lookup and broadcast, but plugin-owned registrations should still prefer `PluginContext`.

| Capability | Entry Point |
| --- | --- |
| Server info | `brand()`、`version()`、`minecraftVersion()`、`phase()` |
| Players | `players()`、`player(UUID)`、`player(String)`、`playerAccess()` |
| Worlds | `worlds()`、`world(Key)`、`defaultWorld()`、`createWorld(...)`、`unloadWorld(...)` |
| Registry lookup | `blockType(...)`、`itemType(...)`、`entityType(...)`、`blockTags()`、`itemTags()` |
| Global services | `events()`、`commands()`、`permissions()`、`scheduler()`、`scoreboard()`、`packets()` |
| Performance | `performance()`、`currentTick()` |
| Broadcast | `sendMessage(...)`、`broadcast(...)` |

## Usage Guidelines

- Register lifecycle-owned resources in `onEnable`; release external resources in `onDisable`.
- Prefer `context.xxx()` unless you explicitly need global lookup or broadcast.
- Event listeners run on the thread that fired the event. Hop to the main thread before mutating world, entity, or inventory state.
- Async tasks should not touch main-thread state directly. Use `context.scheduler().runMain(...)` to return to the server thread.
- `ServiceRegistry` is for ecosystem interop, not a replacement for ordinary Java dependency injection.
- Permission nodes, commands, and configuration keys should use the plugin id as a prefix.

## Maven Coordinates

```kotlin
repositories {
    maven("https://repo.fandmc.cn/repository/maven-public/")
}

dependencies {
    compileOnly("io.fand:fand-api:latest.release")
}
```

Real plugin projects should prefer the official Gradle plugin because it wires the API dependency and processes `fand-plugin.json`.
