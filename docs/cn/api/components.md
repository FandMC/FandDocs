# 组件

Fand 里有两类容易混淆的组件：

| 模型 | API | 用途 |
| --- | --- | --- |
| 持久数据组件 | `DataComponentMap`、`DataComponentContainer`、`DataComponentKey<T>` | 方块、实体等 live 对象上的 Fand 持久状态 |
| 物品数据组件 | `ItemComponents`、`ItemComponentKeys`、`ItemStack.with*` | 现代 Minecraft 物品组件补丁 |

它们都使用 Adventure `Key` 和 JSON 作为底层表达，但语义不同。持久组件是“当前有哪些组件”；物品组件是“对 vanilla 默认组件应用哪些补丁”。

## 持久组件容器

`DataComponentContainer` 是 live 对象上的可变容器。`Block.components()`、`Entity.components()`、`Player.components()` 都返回这个模型。

```java
var ownerKey = DataComponentKey.uuid(Key.key("example:owner"));

block.components().set(ownerKey, player.uniqueId());

block.components().get(ownerKey)
        .ifPresent(owner -> context.logger().info("owner={}", owner));
```

`snapshot()` 返回不可变 `DataComponentMap`。之后容器变化不会反向修改这个 snapshot。

```java
DataComponentMap snapshot = entity.components().snapshot();

if (snapshot.has(EntityComponentKeys.OWNER)) {
    context.logger().debug("owned entity");
}
```

## DataComponentKey

`DataComponentKey<T>` 把 key 和序列化规则绑定在一起，插件代码可以读写领域类型，而不是到处手写 JSON 解析。

```java
public final class MachineComponents {
    public static final DataComponentKey<Integer> LEVEL =
            DataComponentKey.integer(Key.key("example:machine_level"));

    public static final DataComponentKey<String> MODE =
            DataComponentKey.string(Key.key("example:machine_mode"));

    private MachineComponents() {
    }
}
```

内置便捷类型包括：

```java
DataComponentKey.json(key);
DataComponentKey.object(key);
DataComponentKey.string(key);
DataComponentKey.bool(key);
DataComponentKey.integer(key);
DataComponentKey.longValue(key);
DataComponentKey.doubleValue(key);
DataComponentKey.key(key);
DataComponentKey.uuid(key);
```

复杂对象可以用 `DataComponentKey.of(...)` 自定义 encoder/decoder。

```java
record HeatState(int heat, boolean active) {
}

static final DataComponentKey<HeatState> HEAT = DataComponentKey.of(
        Key.key("example:heat"),
        value -> {
            var json = new JsonObject();
            json.addProperty("heat", value.heat());
            json.addProperty("active", value.active());
            return json;
        },
        json -> {
            var object = json.getAsJsonObject();
            return new HeatState(
                    object.get("heat").getAsInt(),
                    object.get("active").getAsBoolean());
        });
```

## 内置方块和实体组件

Fand 提供了少量通用 key，插件也可以定义自己的 key。

方块组件：

```java
BlockComponentKeys.CUSTOM_ID;
BlockComponentKeys.OWNER;
BlockComponentKeys.TICKING;
BlockComponentKeys.CUSTOM_DATA;
```

实体组件：

```java
EntityComponentKeys.CUSTOM_ID;
EntityComponentKeys.OWNER;
EntityComponentKeys.CUSTOM_DATA;
```

这些 key 用于常见自定义内容和归属关系。业务插件仍建议使用自己命名空间下的 key，例如 `myplugin:machine_level`。

## DataComponentMap

`DataComponentMap` 是不可变值对象，适合批量设置、传递模板或保存 snapshot。

```java
var components = DataComponentMap.empty()
        .with(MachineComponents.LEVEL, 3)
        .with(MachineComponents.MODE, "idle");

world.fillBlocks(min, max, type, components, options);
```

`apply(...)` 会把另一个 map 的值覆盖到当前 map。因为持久组件不是补丁模型，`without(...)` 表示删除这个 map 里的 key。

```java
var updated = components
        .without(MachineComponents.MODE)
        .with(MachineComponents.LEVEL, 4);
```

## 物品组件补丁

物品使用 `ItemComponents`，它有 `values` 和 `removals` 两部分。这个设计对应 vanilla item component patch。

```java
import io.fand.api.item.ItemKey;

var patch = ItemComponents.empty()
        .withInt(ItemComponentKeys.MAX_STACK_SIZE, 16)
        .withString(ItemComponentKeys.RARITY, "rare")
        .remove(ItemComponentKeys.TOOL);

var stack = ItemTypes.of(ItemKey.STICK).stack(8, patch);
```

在物品上更常用的是 `ItemStack` 的类型化方法：

```java
var item = ItemTypes.of(ItemKey.PAPER)
        .one()
        .withItemName(Component.text("Notice"))
        .withLore(Component.text("Line one"))
        .withCustomModelData(10);
```

`ItemComponentKeys.all()` 可以枚举当前 API 暴露的 vanilla item component key。

## without 和 remove 的区别

这是物品组件最容易写错的地方。

```java
stack.withoutComponent(ItemComponentKeys.RARITY);
stack.removeComponent(ItemComponentKeys.RARITY);
```

`withoutComponent(...)` 删除当前 stack 上的显式覆盖，让物品类型的 vanilla 默认组件重新生效。

`removeComponent(...)` 写入一个 removal，表示即使物品类型有默认组件，也强制让它不存在。

持久组件没有这一区别。`DataComponentContainer.remove(...)` 和 `DataComponentMap.without(...)` 都表示删除 Fand 持久组件。

## JSON 边界

底层值使用 Gson `JsonElement`。简单类型建议通过 `DataComponentKey` 或 `ItemStack` helper 写，不要手写字符串 JSON。

```java
var customData = new JsonObject();
customData.addProperty("tier", 2);

var stack = ItemTypes.of(ItemKey.EMERALD)
        .one()
        .withCustomData(customData);
```

如果需要从配置加载物品组件补丁，可以用 `ItemComponents.fromJsonPatch(...)`：

```java
var components = ItemComponents.fromJsonPatch("""
        {
          "minecraft:custom_model_data": { "floats": [12] },
          "!minecraft:tool": {}
        }
        """);
```

## 为什么这样设计

Fand 没有把所有插件数据塞进一个通用 NBT 字符串接口，而是用 key + codec 表示组件。这让插件之间可以按命名空间隔离，也能让公开组件被其它插件安全读取。

方块和实体组件是 Fand 的持久数据模型，适合表达“这个对象属于谁”“这个机器处于什么状态”。物品组件则必须贴近 vanilla，因为客户端、配方、战斗、展示和数据包都理解 vanilla item components。

`DataComponentKey<T>` 的设计是为了把序列化错误集中到 key 定义处，而不是让每个读取位置都重复解析 JSON。

## 最佳实践

- 自定义 key 使用插件 id 命名空间，例如 `example:machine_level`。
- 简单值优先使用 `DataComponentKey.integer/string/bool/uuid`。
- 复杂值只在一个地方定义 codec，业务代码只读写领域类型。
- 物品展示、附魔、耐久、食物等优先使用 `ItemStack.with*` 类型化方法。
- 只有需要通用补丁、配置导入或未封装的新组件时，才直接操作 `ItemComponents`。
- 不要把持久组件当作大型数据库；保存 id、状态和小型 JSON 即可。

## 常见坑

- 把 Adventure `Component` 文本组件和 Fand data component 混为一谈。它们不是同一个概念。
- 把 `DataComponentMap` 当作 live 容器。它只是 snapshot 或值对象。
- 忘记 `ItemComponents` 是补丁模型，误用 `without` / `remove`。
- 使用 `minecraft` 命名空间保存插件私有数据，导致和 vanilla 或其它插件语义冲突。
- 在异步线程直接读写 live `DataComponentContainer`。构造数据可以异步，写回 live 对象要回服务端线程。

## 综合示例：给机器方块保存等级和所有者

下面的例子定义两个组件 key，把机器状态写到方块上，并在玩家交互时读取。

```java
package com.example;

import io.fand.api.block.Block;
import io.fand.api.component.DataComponentKey;
import io.fand.api.entity.Player;
import java.util.UUID;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;

public final class MachineState {
    private static final DataComponentKey<Integer> LEVEL =
            DataComponentKey.integer(Key.key("example:machine_level"));
    private static final DataComponentKey<UUID> OWNER =
            DataComponentKey.uuid(Key.key("example:machine_owner"));

    public void create(Block block, Player owner) {
        block.components().set(LEVEL, 1);
        block.components().set(OWNER, owner.uniqueId());
    }

    public void inspect(Block block, Player viewer) {
        var components = block.components();
        int level = components.get(LEVEL).orElse(0);
        boolean ownedByViewer = components.get(OWNER)
                .filter(owner -> owner.equals(viewer.uniqueId()))
                .isPresent();

        viewer.sendMessage(Component.text(
                "Machine level " + level + (ownedByViewer ? " (yours)" : "")));
    }

    public void upgrade(Block block) {
        int nextLevel = block.components().get(LEVEL).orElse(0) + 1;
        block.components().set(LEVEL, nextLevel);
    }
}
```
