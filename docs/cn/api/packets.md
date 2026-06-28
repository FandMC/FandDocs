# 数据包

`PacketRegistry` 提供 vanilla packet 拦截、公开 packet view、直接发送、custom payload 和 per-viewer illusion。packet 类型和 view 接口由数据生成器生成，位于 API jar 中；源码仓库里对应生成源在 `fand-api/build/generated/sources/fandData/main/java`。

> [!IMPORTANT]
> 不要根据 `fand-api` 接口中的兼容默认方法判断运行时是否支持某项 packet 能力。插件代码应以目标 Fand Server 运行时提供的 `PacketRegistry`、`PacketSender` 和 view 实现为准。

## 查找 PacketType

生成的 `PacketType` 枚举包含协议阶段、方向、Minecraft packet key、view 类型和底层类名。

```java
import io.fand.api.packet.PacketDirection;
import io.fand.api.packet.PacketProtocol;
import net.kyori.adventure.key.Key;

var type = context.packets().type(
        PacketProtocol.PLAY,
        PacketDirection.CLIENTBOUND,
        Key.key("minecraft:system_chat"));
```

常用情况下可以直接使用生成常量：

```java
import io.fand.api.packet.PacketType;

var type = PacketType.PLAY_CLIENTBOUND_SYSTEM_CHAT;
```

## 拦截数据包

拦截器会拿到 `PacketController`。可以读取 view、替换 view 或取消数据包。

```java
import io.fand.api.packet.PacketType;

context.packets().intercept(PacketType.PLAY_CLIENTBOUND_SYSTEM_CHAT, controller -> {
    var view = controller.view();
    if (view.has("content")) {
        context.logger().debug("system chat packet fields={}", view.fields());
    }
});
```

如果使用生成 view 类型，可以让 API 做类型转换：

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

字段名来自生成 view 和运行时 packet metadata。写底层数据包逻辑时，先用 `fields()` 打印可用字段，再决定读取或替换哪个字段。

## 构造和发送

可以使用通用 builder 设置字段并构造 `PacketView`：

```java
var packet = context.packets()
        .builder(PacketType.PLAY_CLIENTBOUND_SET_ACTION_BAR_TEXT)
        .field("text", Component.text("Hello"))
        .build();

context.packets().sender().send(player, packet);
```

`PacketBuilder.send(player)` 是便捷写法：

```java
context.packets()
        .builder(PacketType.PLAY_CLIENTBOUND_SET_ACTION_BAR_TEXT)
        .field("text", Component.text("Saved"))
        .send(player);
```

## Illusion

`ViewerIllusionService` 面向“只让某个玩家看到”的表现效果。

```java
var illusions = context.packets().illusions();

illusions.fakeBlock(player, block.location(), previewType);
illusions.hideEntity(player, entity);
illusions.showEntity(player, entity);
```

`fakeBlock`、`fakeEntity`、`removeFakeEntity` 和 `sendPacket` 都是 per-viewer 操作，不改变真实世界状态。运行时会拒绝发送给已断开连接的玩家；`fakeBlock` 还要求目标位置和 viewer 在同一个世界，`fakeEntity` 只接受 clientbound packet view。

## Helper Builder

`PacketHelpers` 提供一些常见 clientbound packet 的 builder：

```java
var spawn = context.packets().helpers()
        .displayEntity(entityId, uniqueId, entityType, location)
        .build();

context.packets().illusions().fakeEntity(player, spawn);
```

helper 只负责填充常用字段。更复杂的 metadata、display entity、nameplate 或 fake screen 仍然可以在 builder 上继续补字段。

当前 helper 覆盖：

```text
entityMetadata
displayEntity / hologramEntity
scoreboardTeam / nameplateTeam
openScreen
```

从零构造 packet 时，需要提供该 packet 在运行时转换所需的字段；修改已拦截 packet 时，优先从原 view 复制字段后只替换你关心的值。

## 使用建议

- 优先用高层 API，例如 GUI、BossBar、TabList、Scoreboard；只有高层 API 不够时再直接操作 packet。
- 拦截器里不要做长耗时 I/O。
- 替换 packet 时尽量保留原 view 中你不关心的字段。
- packet view 和字段随 Minecraft 协议演进，升级服务端前要重新测试依赖底层字段的插件。
