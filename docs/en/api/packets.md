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

## Guidelines

- Prefer higher-level APIs such as GUI, BossBar, TabList, and Scoreboard when they fit.
- Do not perform slow I/O inside interceptors.
- When replacing a packet, preserve fields you do not care about.
- Packet views and fields follow the Minecraft protocol, so test low-level field-dependent plugins when upgrading the server.
