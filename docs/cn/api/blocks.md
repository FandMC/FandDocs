# 方块

`Block` 是某个 `World` 中一个整数坐标位置的轻量句柄。它不是方块状态快照：`type()`、`fluidState()`、`stateProperties()`、`blockEntity()` 等读取的是当前位置的实时状态，`setType(...)`、`setStateProperty(...)`、`setFluid(...)`、`breakNaturally(...)` 会修改世界。

```java
import io.fand.api.block.BlockKey;
import io.fand.api.block.BlockTypes;

var block = player.world().blockAt(
        player.location().blockX(),
        player.location().blockY() - 1,
        player.location().blockZ());

if (block.type().key().equals(BlockKey.GRASS_BLOCK.key())) {
    block.setType(BlockTypes.of(BlockKey.GOLD_BLOCK));
}
```

## Block 和 BlockType

`BlockType` 是注册表里的方块类型。固定 vanilla 方块应优先使用数据生成出来的 `BlockKey`，例如 `BlockKey.STONE`、`BlockKey.GRASS_BLOCK`。只有配置文件、玩家输入、外部数据这类运行时字符串，才需要先解析成 `Key` 再查询。

```java
import io.fand.api.block.BlockKey;
import io.fand.api.block.BlockTypes;

var stone = BlockTypes.of(BlockKey.STONE);
var block = world.blockAt(0, 64, 0);

block.setType(stone);
```

如果只是查询类型是否存在，可以使用 `BlockTypes.find(...)`：

```java
BlockTypes.find(BlockKey.DEEPSLATE)
        .ifPresent(type -> context.logger().info("found {}", type.key()));
```

## 坐标和相邻方块

`Block` 暴露整数坐标，`relative(...)` 可以沿 `BlockFace` 或偏移量取得相邻位置。

```java
var clicked = event.block();
var above = clicked.relative(BlockFace.UP);

if (above.air()) {
    above.setType(BlockTypes.of(BlockKey.TORCH));
}
```

`relative(int dx, int dy, int dz)` 使用 `Math.addExact`，极端坐标溢出会抛异常。这比静默绕回更安全。

## 物理属性

`BlockType.physics()` 描述类型默认状态，`Block.physics()` 描述当前位置的实时状态。对有状态方块来说，两者可能不同。

```java
var physics = block.physics();

if (physics.solid() && !physics.air()) {
    context.logger().debug(
            "hardness={} light={}",
            physics.hardness(),
            physics.lightEmission());
}
```

常用便捷方法包括：

```java
block.air();
block.solid();
block.replaceable();
block.flammable();
block.requiresTool();
block.hasBlockEntity();
block.lightEmission();
```

## Block State 属性

vanilla block-state 属性会以 `propertyName -> valueName` 形式暴露，例如楼梯方向、门的半边、作物年龄、水含水状态等。

```java
var facing = block.stateProperty("facing").orElse("unknown");

if (block.setStateProperty("facing", "north")) {
    context.logger().debug("rotated block");
}
```

`setStateProperty(name, value)` 在属性不存在或值不合法时返回 `false`。它不会替你判断这个修改是否符合游戏玩法，只负责尝试设置当前 block state 的属性。

## 流体

`fluidState()` 返回当前位置的流体状态。便捷方法可以判断水、岩浆、源流体、流动流体和完整流体。

```java
if (block.water() && block.sourceFluid()) {
    block.clearFluid();
}

block.setFluid(FluidTypes.water(true));
```

流体和方块状态的关系由运行时按 vanilla 语义应用。对可含水方块、空气、岩浆等不同状态，结果可能不同。

## Block Entity

`blockEntity()` 返回当前位置的 live block entity，例如箱子、熔炉、告示牌、刷怪笼等。

```java
block.blockEntity().ifPresent(entity -> {
    context.logger().info("block entity type={}", entity.type());
});
```

更具体的 block entity 接口在 `io.fand.api.block` 包中，例如 `ContainerBlockEntity`、`FurnaceBlockEntity`、`SignBlockEntity`。使用前先按类型判断。

## 掉落和自然破坏

`drops()` 可以查询破坏掉落，`breakNaturally(...)` 会按 vanilla 破坏流程处理并可选生成掉落。

```java
var drops = block.drops(tool);

if (block.breakNaturally(false)) {
    drops.forEach(item -> block.world().dropItem(
            block.world().at(block.x() + 0.5, block.y() + 0.5, block.z() + 0.5),
            item));
}
```

如果你要修改很多方块，不要循环调用 `setType`。优先使用世界批量方块 API，见 [世界](/cn/api/worlds)。

## 方块组件

`components()` 是 Fand 挂在方块位置上的持久组件容器。它适合自定义方块、机器状态、方块级标记等插件数据。

```java
var components = block.components();
// components.set(MyKeys.MACHINE_LEVEL, 3);
```

组件数据由世界存档承载。通过 Fand API 或玩家行为替换/破坏方块时，相关组件会按运行时规则清理。

## 为什么这样设计

Fand 把 `Block` 设计成位置句柄，而不是一次性快照，是为了让插件代码表达清楚“我要读/改这个位置当前的状态”。这比长期保存一份可能过期的状态对象更符合动态世界的语义。

`BlockType` 和 `Block` 分离，是为了区分“注册表里的类型”和“世界里的位置”。类型可以安全复用；位置句柄会读取当前世界。

方块 state 属性使用字符串，是为了暴露 vanilla block-state 的通用结构，而不为每一种方块生成一套专用 Java API。需要强约束的自定义玩法可以在插件侧封装自己的小工具。

## 最佳实践

- 单点修改用 `block.setType(...)`，大范围修改用 `world.setBlocks(...)`、`fillBlocks(...)` 或 `replaceBlocks(...)`。
- 固定 vanilla 方块使用数据生成的 `BlockKey`，不要在示例和业务代码里手写 `"minecraft:..."` 方块 id。
- 保存方块引用时只保存 world key 和坐标；需要时重新 `world.blockAt(...)`。
- 修改 block-state 属性前先检查 `stateProperties()` 或处理 `false` 返回值。
- 方块组件只保存插件自己的持久状态，不要把它当作替代 vanilla block entity 的通用数据库。
- 破坏或掉落逻辑需要可控时，先查 `drops(tool)`，再决定是否 `breakNaturally(...)` 或自己 `dropItem(...)`。

## 常见坑

- `Block` 不是快照；保存很久后再读，可能已经变成别的方块。
- `BlockType.physics()` 是默认状态，`Block.physics()` 才是当前位置实时状态。
- `item(slot, item)` 那种 GUI 语义和方块无关；真实方块修改要走 `Block` 或 `World` API。
- `setStateProperty` 返回 `false` 不是异常，通常表示属性名或值不适用于当前方块。
- 固定方块直接写 `"minecraft:<id>"` 这类字符串，绕过了 Fand 的数据生成 key，也失去编译期检查。
- 大范围循环 `setType` 会造成 tick 压力，应该使用批量 API 并限制每 tick 修改数量。

## 综合示例：保护区域内替换方块并保留掉落

下面的例子把玩家脚下方块替换成玻璃。如果原方块不是空气，会先按工具计算掉落，再把掉落物生成到方块中心。

```java
package com.example;

import io.fand.api.block.Block;
import io.fand.api.block.BlockKey;
import io.fand.api.block.BlockTypes;
import io.fand.api.entity.Player;
import io.fand.api.item.ItemStack;
import io.fand.api.plugin.PluginContext;

public final class BlockTools {
    private final PluginContext context;

    public BlockTools(PluginContext context) {
        this.context = context;
    }

    public void replaceBelow(Player player, ItemStack tool) {
        var location = player.location();
        Block block = player.world().blockAt(
                location.blockX(),
                location.blockY() - 1,
                location.blockZ());

        if (block.air()) {
            player.sendMessage(net.kyori.adventure.text.Component.text("Nothing to replace"));
            return;
        }

        var drops = block.drops(tool);
        if (!block.setType(BlockTypes.of(BlockKey.GLASS))) {
            player.sendMessage(net.kyori.adventure.text.Component.text("Block change failed"));
            return;
        }

        var dropLocation = block.world().at(block.x() + 0.5, block.y() + 0.5, block.z() + 0.5);
        drops.forEach(item -> block.world().dropItem(dropLocation, item));
        context.logger().debug("Replaced block at {},{},{}", block.x(), block.y(), block.z());
    }
}
```
