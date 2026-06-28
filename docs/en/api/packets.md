# Packets

`PacketRegistry` exposes vanilla packet interception, public packet views, direct sends, custom payloads, and per-viewer illusions. Packet types and view interfaces are generated into the API jar; in the source repository, the generated sources live under `fand-api/build/generated/sources/fandData/main/java`.

> [!IMPORTANT]
> Do not infer packet capability from compatibility default methods in `fand-api` interfaces. Plugin code should rely on the `PacketRegistry`, `PacketSender`, and view implementation provided by the target Fand Server runtime.

## Finding Packet Types

The generated `PacketType` enum includes protocol phase, direction, Minecraft packet key, view type, and backing class name.

```java
import io.fand.api.packet.PacketDirection;
import io.fand.api.packet.PacketProtocol;
import net.kyori.adventure.key.Key;

var type = context.packets().type(
        PacketProtocol.PLAY,
        PacketDirection.CLIENTBOUND,
        Key.key("minecraft:system_chat"));
```

In common cases, use generated constants directly:

```java
import io.fand.api.packet.PacketType;

var type = PacketType.PLAY_CLIENTBOUND_SYSTEM_CHAT;
```

## Intercepting Packets

Interceptors receive a `PacketController`. You can inspect the view, replace it, or cancel the packet.

```java
import io.fand.api.packet.PacketType;

context.packets().intercept(PacketType.PLAY_CLIENTBOUND_SYSTEM_CHAT, controller -> {
    var view = controller.view();
    if (view.has("content")) {
        context.logger().debug("system chat packet fields={}", view.fields());
    }
});
```

With a generated view type, the API can cast the packet view for you:

```java
import io.fand.api.packet.view.ClientboundSystemChatPacketView;

context.packets().intercept(
        PacketType.PLAY_CLIENTBOUND_SYSTEM_CHAT,
        ClientboundSystemChatPacketView.class,
        controller -> {
            var view = controller.view();
            context.logger().debug("packet type={}", view.packetType());
        });
```

Field names come from generated views and runtime packet metadata. When writing low-level packet logic, print `fields()` first, then decide which fields to read or replace.

## Building and Sending

Use the generic builder to set fields and create a `PacketView`:

```java
var packet = context.packets()
        .builder(PacketType.PLAY_CLIENTBOUND_SET_ACTION_BAR_TEXT)
        .field("text", Component.text("Hello"))
        .build();

context.packets().sender().send(player, packet);
```

`PacketBuilder.send(player)` is the convenience form:

```java
context.packets()
        .builder(PacketType.PLAY_CLIENTBOUND_SET_ACTION_BAR_TEXT)
        .field("text", Component.text("Saved"))
        .send(player);
```

## Illusions

`ViewerIllusionService` is for effects visible to one viewer only.

```java
var illusions = context.packets().illusions();

illusions.fakeBlock(player, block.location(), previewType);
illusions.hideEntity(player, entity);
illusions.showEntity(player, entity);
```

`fakeBlock`, `fakeEntity`, `removeFakeEntity`, and `sendPacket` are per-viewer operations. They do not mutate the real world state. The runtime refuses sends to disconnected players; `fakeBlock` also requires the target location to be in the viewer's world, and `fakeEntity` accepts only clientbound packet views.

## Helper Builders

`PacketHelpers` provides builders for common clientbound packets:

```java
var spawn = context.packets().helpers()
        .displayEntity(entityId, uniqueId, entityType, location)
        .build();

context.packets().illusions().fakeEntity(player, spawn);
```

Helpers only fill common fields. More advanced metadata, display entities, nameplates, or fake screens can still add fields through the builder.

Current helpers cover:

```text
entityMetadata
displayEntity / hologramEntity
scoreboardTeam / nameplateTeam
openScreen
```

When building a packet from scratch, provide the fields required by the runtime conversion for that packet. When modifying an intercepted packet, prefer copying fields from the original view and replacing only the values you care about.

## Design Philosophy

Packet APIs are Fand's low-level escape hatch. Higher-level APIs such as GUI, BossBar, TabList, Scoreboard, Map, and Placeholder are more stable and should be preferred. Use direct packets when you need protocol-level presentation, client compatibility behavior, or per-viewer illusions.

`PacketView` exposes generated metadata so plugins do not depend directly on obfuscated internal packet classes. Plugin code can work with public field names and view types while the runtime converts views to the current server version's packet objects.

The builder does not understand the complete vanilla protocol for you. It collects fields and asks the runtime to create a view. Missing fields required by runtime conversion can fail during build or send.

## Best Practices

- Prefer higher-level APIs such as GUI, BossBar, TabList, and Scoreboard when they fit.
- Do not perform slow I/O inside interceptors.
- When replacing a packet, preserve fields you do not care about.
- Packet views and fields follow the Minecraft protocol, so test low-level field-dependent plugins when upgrading the server.
- Print `fields()` first before reading or replacing low-level packet fields.
- Prefer `PacketHelpers` when building packets from scratch, then add only the fields you need.
- Treat fake blocks/entities as viewer-only presentation, not as real world state.

## Common Pitfalls

- Building a packet without required fields may leave the runtime unable to convert it.
- Fake blocks do not change the server world; resync or interaction may reveal the real state.
- `fakeEntity` expects a clientbound spawn packet view. Serverbound or unrelated packets are not suitable fake-entity spawn packets.
- Packet fields are not stable business models and may change with protocol upgrades.
- Exceptions in interceptors affect packet dispatch paths; catch and log expected failures yourself.

## Complete Example: Action Bar Hint and System Chat Audit

This example sends an action-bar text packet and intercepts system chat packets to print available fields. Real plugins can inspect fields first, then decide whether to replace or cancel.

```java
package com.example;

import io.fand.api.entity.Player;
import io.fand.api.packet.PacketType;
import io.fand.api.packet.view.ClientboundSystemChatPacketView;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.packets().intercept(
                PacketType.PLAY_CLIENTBOUND_SYSTEM_CHAT,
                ClientboundSystemChatPacketView.class,
                controller -> context.logger().debug(
                        "system chat fields={}",
                        controller.view().fields()));
    }

    public void sendSavedHint(PluginContext context, Player player) {
        context.packets()
                .builder(PacketType.PLAY_CLIENTBOUND_SET_ACTION_BAR_TEXT)
                .field("text", Component.text("Saved"))
                .send(player);
    }
}
```
