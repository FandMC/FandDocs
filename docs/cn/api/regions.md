# 区域

`RegionService` 提供轻量区域保护模型：注册 cuboid 区域、注册 typed flag、查询位置命中的区域，并解析最终 flag 值。区域数据按 `Key` 命名，区域自身绑定一个世界 `Key` 和一个 `BlockRegion`。

## 定义 Flag

flag 是强类型的。常用类型可以直接使用内置 codec：

```java
import io.fand.api.region.RegionFlag;
import net.kyori.adventure.key.Key;

var buildFlag = RegionFlag.bool(Key.key("example-plugin:build"), true);
var priorityFlag = RegionFlag.integer(Key.key("example-plugin:priority"), 0);
var greetingFlag = RegionFlag.string(Key.key("example-plugin:greeting"), "");

context.regions().registerFlag(buildFlag);
context.regions().registerFlag(priorityFlag);
context.regions().registerFlag(greetingFlag);
```

插件作用域注册的 flag 会随插件禁用清理。

通过插件上下文访问 `RegionService` 时，region key、flag key 和 parent key 会自动收敛到当前插件的 namespace；world key 保持原样。

## 注册区域

`RegionDefinition` 是不可变定义。通过 builder 可以设置范围、flag、priority、parent、owner 和 member。

```java
import io.fand.api.region.RegionDefinition;
import io.fand.api.world.BlockRegion;
import net.kyori.adventure.key.Key;

var region = RegionDefinition.builder(
        Key.key("example-plugin:spawn"),
        player.world().key(),
        new BlockRegion(-32, 0, -32, 32, 255, 32))
        .priority(100)
        .owner(player.uniqueId().toString())
        .flag(buildFlag, false)
        .build();

var registration = context.regions().register(region);
```

`RegionRegistration.close()` 会移除对应区域。直接调用 `remove(key)` 也可以删除区域。

## 查询区域

```java
var regions = context.regions().applicableRegions(player.location());
var top = context.regions().applicableRegion(player.location());
```

`applicableRegions(location)` 的顺序是 API 语义的一部分：

1. protection priority 高的区域在前。
2. 同 priority 时，体积更小的区域在前。
3. 仍然相同时，较新注册的区域在前。

## 解析 Flag

```java
var resolution = context.regions().resolveFlag(player.location(), buildFlag);
boolean canBuild = resolution.orElse(true);

if (!canBuild) {
    for (var step : resolution.trace()) {
        context.logger().debug(
                "checked region={} inherited={} value={}",
                step.region().key(),
                step.inherited(),
                step.value());
    }
}
```

解析顺序和 `applicableRegions(location)` 一致。每个区域先检查自己的显式 flag，再沿 parent 链检查。第一个显式值获胜，包括从 parent 继承到的值；一旦命中，后续更低优先级的重叠区域不会再参与解析。没有区域提供显式值时，返回 flag 的默认值。

## Owner 和 Member

`RegionProtection` 会把 owner/member 字符串标准化成小写。`member(subject)` 会把 owner 也视作 member。

```java
var protection = region.protection();
boolean owner = protection.owner(player.uniqueId().toString());
boolean member = protection.member(player.uniqueId().toString());
```

owner/member 本身不自动授予或拒绝某个 flag；它们是区域保护插件实现策略时可以读取的元数据。

## 使用建议

- 区域 key 使用插件命名空间，例如 `example-plugin:spawn`。
- 高 priority 留给更具体、更重要的保护区域。
- parent 适合表达“子区域继承主区域策略，再覆盖少量 flag”。
- 调试保护冲突时优先打印 `RegionFlagResolution.trace()`。
