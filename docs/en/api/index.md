# API Overview

Fand plugins depend only on `fand-api`. `fand-api` is the stable compile-time surface for plugin authors, while runtime implementations are provided by Fand Server.

> [!IMPORTANT]
> Do not infer runtime behavior from Java `default` method bodies, fallback return values, or placeholder exceptions in the `fand-api` source. They primarily exist for source/binary compatibility while the API evolves; real behavior is provided by the active Fand Server runtime, plugin-scoped wrapper, or registered provider.

Prefer `PluginContext` for plugin-owned work. It represents the lifecycle scope of the current plugin, so commands, listeners, tasks, service providers, GUIs, boss bars, tab-list entries, and similar resources can be cleaned up when the plugin is disabled. Use `Fand.server()` when you need the global server view.

## Design Philosophy

Fand API intentionally does not mirror Bukkit/Paper naming everywhere. It follows a more modern Java record/interface style: read accessors use names such as `player.location()`, `entity.uniqueId()`, and `world.key()`, while operations that mutate state, send packets, or change lifecycle use verbs such as `teleport(...)`, `setVelocity(...)`, `register(...)`, and `close()`.

The goal is:

- **Less boilerplate**: `location()` matches Java record accessors and stays consistent with APIs such as `PluginDescriptor.id()` and `MapView.id()`.
- **Clear reads vs actions**: bare names usually read a value or handle; `set*` methods and verbs perform side effects.
- **Compile-time API separated from runtime behavior**: plugins depend on `fand-api`; the active Fand Server runtime provides behavior. Compatibility default methods in the API source are not feature documentation.
- **Plugin scope first**: services from `context.xxx()` usually track plugin-owned registrations so unload can clean up commands, tasks, boss bars, tab-list rows, and similar resources.
- **Explicit thread boundaries**: async phases are for I/O and computation; use the scheduler when applying results in tick order.

When migrating from Paper, do not mechanically search for `getXxx()` equivalents. First decide whether you are reading state, registering a resource, mutating the world, or creating a per-viewer presentation effect, then choose the matching Fand service.

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
import io.fand.api.item.ItemKey;

Fand.server().players();
Fand.server().worlds();
Fand.server().performance();
Fand.server().itemType(ItemKey.DIAMOND.key());
```

## API Layers

Fand API can be read in layers:

| Layer | Representative APIs | Description |
| --- | --- | --- |
| Plugin basics | `plugin`, `lifecycle`, `config`, `storage` | Loading, configuration, data directories, persistence |
| Interaction | `command`, `event`, `scheduler`, `permission` | Player input, server behavior hooks, async/main-thread work, access control |
| Player experience | `text`, `placeholder`, `bossbar`, `tablist`, `scoreboard`, `gui`, `map` | Text, placeholders, screens, boss bars, player lists, scoreboards, map rendering |
| World and entities | [`world`](/en/api/worlds), [`entity`](/en/api/entities), [`player`](/en/api/players), [`block`](/en/api/blocks), [`item`](/en/api/items), [`component`](/en/api/components), `inventory`, `tag` | Worlds, entities, players, blocks, items, components, inventories, vanilla tag lookup |
| Content extension | `customitem`, `customblock`, [`recipe`](/en/api/recipes), [`loot`](/en/api/loot), [`advancement`](/en/api/advancements), [`enchantment`](/en/api/enchantments), `datapack`, `structure` | Custom content, recipes, loot tables, advancements, enchantments, data-pack files, structures, generation-facing features |
| Ecosystem integration | `service`, `integration`, `messaging`, `region` | Cross-plugin providers, external resources, plugin messaging, region protection |
| Low-level presentation | `packet`, [`component`](/en/api/components), `registry`, `performance`, `gamerule`, `nbs` | Network packets, components, registries, performance snapshots, game rules, NBS parsing |

## PluginContext Service Matrix

| Service | Entry Point | Typical Use |
| --- | --- | --- |
| Logging | `context.logger()` | SLF4J logger named after the plugin id |
| Descriptor | `context.descriptor()` | Read `id`, `version`, `mainClass`, `apiVersion`, load relations, metadata, and permission declarations |
| Events | `context.events()` | Register player, entity, world, plugin, and server listeners |
| Commands | `context.commands()` | Builder commands, annotated commands, completions, visible command lookup |
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
| Custom Items | `context.customItems()` | Register custom item types, item templates, and base-item bindings |
| Custom Blocks | `context.customBlocks()` | Register custom block types, listeners, item bindings |
| Recipes | `context.recipes()` | Register, look up, and remove recipes in the plugin namespace |
| Loot Tables | `context.lootTables()` | Look up, generate, and replace loot tables in the plugin namespace |
| Advancements | `context.advancements()` | Register and look up advancements in the plugin namespace |
| Enchantments | `context.enchantments()` | Register and look up enchantments in the plugin namespace |
| Data Packs | `context.dataPacks()` | Plugin-scoped data-pack file trees |
| Structures | `context.structures()` | Template save, import, export, placement, locate |
| Game Rules | `context.gameRules()` | Plugin-namespaced custom game rules |
| Simulated Players | `context.simulatedPlayers()` | Server-side simulated players |
| Integrations | `context.integrations()` | External resource strategies for SQL, Redis, MQ, and similar systems |

## Global Server View

`Server` is an Adventure `ForwardingAudience` that forwards messages to current online players. It is useful for global lookup and broadcast, but plugin-owned registrations should still prefer `PluginContext`.

| Capability | Entry Point |
| --- | --- |
| Server info | `brand()`, `version()`, `minecraftVersion()`, `phase()` |
| Players | `players()`, `player(UUID)`, `player(String)`, `playerAccess()` |
| Worlds | `worlds()`, `world(Key)`, `defaultWorld()`, `createWorld(...)`, `unloadWorld(...)` |
| Registry lookup | `blockType(...)`, `itemType(...)`, `entityType(...)`, `blockTags()`, `itemTags()` |
| Global services | `events()`, `commands()`, `permissions()`, `scheduler()`, `scoreboard()`, `packets()` |
| Performance | `performance()`, `currentTick()` |
| Broadcast | `sendMessage(...)`, `broadcast(...)` |

## Best Practices

- Register lifecycle-owned resources in `onEnable`; release external resources in `onDisable`.
- Prefer `context.xxx()` unless you explicitly need global lookup or broadcast.
- Event listeners run on the thread that fired the event. Hop to the main thread before mutating world, entity, or inventory state.
- Async tasks should not touch main-thread state directly. Use `context.scheduler().runMain(...)` to return to the server thread.
- `ServiceRegistry` is for ecosystem interop, not a replacement for ordinary Java dependency injection.
- Permission nodes, commands, and configuration keys should use the plugin id as a prefix.

## Common Pitfalls

- Inferring runtime support from default return values or placeholder exceptions in `fand-api`; the active Fand Server runtime provides real behavior.
- Migrating from Paper by mechanically searching for `getXxx()` methods instead of using Fand's accessor style.
- Pulling everything from `Fand.server()` and losing plugin-scoped cleanup or ownership clarity.
- Mutating unwrapped world, entity, or inventory objects from async tasks or async events.
- Treating `ServiceRegistry` as an internal object container for DAOs, config objects, or thread pools.
- Not declaring public permission nodes in the descriptor or `PermissionService`, making defaults invisible to management tools.

## Complete Example: Minimal Plugin Skeleton

This example shows one plugin entry point combining descriptor access, configuration, permissions, commands, events, and the scheduler-ready `PluginContext` style. Larger GUI, region, packet, or scoreboard features can be split into components that receive the services they need.

```java
package com.example;

import io.fand.api.event.player.PlayerJoinEvent;
import io.fand.api.permission.PermissionDefault;
import io.fand.api.permission.PermissionDescriptor;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.logger().info("{} {}", context.descriptor().id(), context.descriptor().version());

        var enabled = context.config().getBoolean("welcome.enabled", true);
        var message = context.config().getString("welcome.message", "Welcome, {player}");

        context.permissions().register(new PermissionDescriptor(
                "example.reload",
                PermissionDefault.OPERATOR));

        context.commands().register("example", command -> command
                .permission("example.reload")
                .literal("reload", reload -> reload.executes(reloadCommand -> {
                    context.reloadConfig();
                    reloadCommand.sender().sendMessage(Component.text("Example config reloaded"));
                })));

        context.events().subscribe(PlayerJoinEvent.class, event -> {
            if (enabled) {
                event.player().sendMessage(Component.text(
                        message.replace("{player}", event.player().name())));
            }
        });
    }

}
```

## Dependency Configuration

The official Gradle plugin version is `0.1.2`. It wires the API dependency and processes `fand-plugin.json`, so new plugin projects should prefer this setup.

```kotlin
plugins {
    id("io.fand.plugin") version "0.1.2"
}
```

For ordinary Java, Gradle, or Maven projects, depend on `fand-api` directly. The examples below show Gradle Kotlin DSL, Gradle Groovy DSL, and Maven POM syntax.

### Gradle Kotlin DSL

```kotlin
repositories {
    maven("https://repo.fandmc.cn/repository/maven-public/")
}

dependencies {
    compileOnly("io.fand:fand-api:0.1.2")
}
```

### Gradle Groovy DSL

```groovy
repositories {
    maven {
        url = uri("https://repo.fandmc.cn/repository/maven-public/")
    }
}

dependencies {
    compileOnly "io.fand:fand-api:0.1.2"
}
```

### Maven POM

Maven projects should use a fixed version so builds do not silently resolve a different API. This example uses `0.1.2`.

```xml
<repositories>
    <repository>
        <id>fandmc</id>
        <url>https://repo.fandmc.cn/repository/maven-public/</url>
    </repository>
</repositories>

<dependencies>
    <dependency>
        <groupId>io.fand</groupId>
        <artifactId>fand-api</artifactId>
        <version>0.1.2</version>
        <scope>provided</scope>
    </dependency>
</dependencies>
```
