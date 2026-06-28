# Permissions

`PermissionService` registers permission nodes, checks subject permissions, and exposes ecosystem-facing group, prefix, suffix, meta, and context query entry points. Nodes, children, attachments, `PermissionDefault`, and permission-check events are the baseline permission semantics. Group/meta/context queries are extension points for ecosystem providers and compatibility layers.

## Permission Nodes

Prefix permission nodes with the plugin id or plugin namespace:

```text
example.use
example.reload
example.admin
```

Register a node:

```java
import io.fand.api.permission.PermissionDefault;
import io.fand.api.permission.PermissionDescriptor;

context.permissions().register(
        new PermissionDescriptor("example.hello", PermissionDefault.TRUE));
```

Common `PermissionDefault` values:

| Value | Meaning |
| --- | --- |
| `TRUE` | Allowed by default |
| `FALSE` | Denied by default |
| `OPERATOR` | Operators are allowed by default |
| `NOT_OPERATOR` | Non-operators are allowed by default |

## Permission Trees

Parent permissions can declare child nodes. Granting the parent applies the child values.

```java
import java.util.Map;

context.permissions().register(new PermissionDescriptor(
        "example.admin",
        PermissionDefault.OPERATOR,
        Map.of(
                "example.reload", true,
                "example.debug", true,
                "example.unsafe", false)));
```

## Checking Permissions

Players, command senders, and other objects implementing `PermissionSubject` can be checked.

```java
if (!sender.hasPermission("example.reload")) {
    sender.sendMessage(Component.text("No permission"));
    return;
}
```

Or use the service directly:

```java
boolean allowed = context.permissions().hasPermission(player, "example.reload");
```

## Attachments

`PermissionAttachment` is for temporary grants or revocations, such as events, debugging modes, or session state.

```java
var attachment = context.permissions().attach(player);
attachment.setPermission("example.temp", true);

// Later
attachment.close();
```

For one node, use the convenience method:

```java
var attachment = context.permissions().attach(player, "example.temp", true);
```

## Groups and Metadata

Fand exposes ecosystem-style group and metadata lookups:

```java
var primaryGroup = context.permissions().primaryGroup(player);
var groups = context.permissions().groups(player);
var prefix = context.permissions().prefix(player);
var suffix = context.permissions().suffix(player);
var rank = context.permissions().metaValue(player, "rank");
```

These methods read values from the active runtime permission implementation. Different permission plugins may store data differently, so callers should treat these values as read-only query results.

Do not infer the result of these queries from `default` method bodies in the `fand-api` interfaces. The final values depend on the Fand Server permission implementation, bridge plugin, or registered provider active at runtime.

## Context

`PermissionContext` represents world, server, region, game mode, or similar conditional values. Keys are normalized to lowercase.

```java
var contextValues = PermissionContext.empty()
        .with("world", player.world().key().asString())
        .with("server", "survival");

var prefix = context.permissions().prefix(player, contextValues);
var group = context.permissions().primaryGroup(player, contextValues);
```

`PermissionContext` is passed to the active permission implementation. Whether it changes node checks, groups, or metadata resolution depends on the runtime permission provider semantics.

## Descriptor Declarations

If permissions are a static part of your plugin, declare them in `fand-plugin.json` so the server and management plugins can discover them at load time.

```json
{
  "permissions": [
    {
      "node": "example.reload",
      "defaultAccess": "OPERATOR"
    }
  ]
}
```

## Design Philosophy

Fand keeps baseline permission checks and ecosystem metadata queries in one `PermissionService` so it can cover both plugin feature gates and Vault/LuckPerms-style chat prefixes, groups, inheritance, and contextual metadata.

Permission nodes remain the most stable way to make gameplay decisions. Group, prefix, suffix, and metadata values are better for display, compatibility, or cross-plugin reads because they may come from different providers with different inheritance models.

`PermissionContext` uses normalized key/value pairs instead of hardcoding world, region, or server fields. Permission bridges can support more context dimensions, and ordinary plugins can express their own scenarios through the same API.

## Best Practices

- Put static permissions in the descriptor or register them during startup.
- Use attachments for temporary permissions, and close them when no longer needed.
- Meta/context lookups are best for display and compatibility, not as the only source of gameplay state.
- Management commands and dangerous operations should default to `OPERATOR` or `FALSE`.
- Prefix every public permission node with your plugin id, such as `example.reload` or `example.admin`.
- For context-aware meta queries, explicitly put world, server, region, or other dimensions into `PermissionContext`.
- Use prefix/suffix/group for UI display; check concrete permission nodes for dangerous operations.

## Common Pitfalls

- Checking permissions inside commands without registering nodes makes default policy invisible to management tools.
- Treating primary group as a permanent identity source is fragile; it may vary by context or provider.
- Forgetting to close attachments leaves temporary permissions active.
- Wildcard, children, and attachment priority are resolved by the runtime permission implementation; plugins should not guess the full inheritance tree.
- Meta/context values depend on the active provider and may be empty when no provider is installed.

## Complete Example: Admin Tree and Temporary Debug Permission

This example registers an admin permission tree and grants `example.debug.session` temporarily while a player is in a debug session.

```java
package com.example;

import io.fand.api.entity.Player;
import io.fand.api.permission.PermissionAttachment;
import io.fand.api.permission.PermissionContext;
import io.fand.api.permission.PermissionDefault;
import io.fand.api.permission.PermissionDescriptor;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    private final Map<UUID, PermissionAttachment> debugSessions = new HashMap<>();

    @Override
    public void onEnable(PluginContext context) {
        context.permissions().register(new PermissionDescriptor(
                "example.admin",
                PermissionDefault.OPERATOR,
                Map.of(
                        "example.reload", true,
                        "example.debug.session", true)));
    }

    @Override
    public void onDisable(PluginContext context) {
        debugSessions.values().forEach(PermissionAttachment::close);
        debugSessions.clear();
    }

    public void startDebugSession(PluginContext context, Player player) {
        debugSessions.computeIfAbsent(player.uniqueId(), ignored ->
                context.permissions().attach(player, "example.debug.session", true));

        var permissionContext = PermissionContext.empty()
                .with("world", player.world().key().asString());
        var prefix = context.permissions()
                .prefix(player, permissionContext)
                .orElse("");

        player.sendMessage(Component.text(prefix + "Debug session enabled"));
    }

    public void stopDebugSession(Player player) {
        var attachment = debugSessions.remove(player.uniqueId());
        if (attachment != null) {
            attachment.close();
        }
    }
}
```
