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

## Guidelines

- Put static permissions in the descriptor or register them during startup.
- Use attachments for temporary permissions, and close them when no longer needed.
- Meta/context lookups are best for display and compatibility, not as the only source of gameplay state.
- Management commands and dangerous operations should default to `OPERATOR` or `FALSE`.
