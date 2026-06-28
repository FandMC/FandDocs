# 权限

`PermissionService` 用于注册权限节点、检查主体权限，以及提供权限生态常用的 group、prefix、suffix、meta 和 context 查询入口。节点、children、attachment、`PermissionDefault` 和检查事件属于基础权限语义；group/meta/context 是面向生态 provider 和兼容层的扩展查询面。

## 权限节点

权限节点建议使用插件 id 或插件命名空间作为前缀：

```text
example.use
example.reload
example.admin
```

注册节点：

```java
import io.fand.api.permission.PermissionDefault;
import io.fand.api.permission.PermissionDescriptor;

context.permissions().register(
        new PermissionDescriptor("example.hello", PermissionDefault.TRUE));
```

`PermissionDefault` 常用值：

| 值 | 语义 |
| --- | --- |
| `TRUE` | 默认允许 |
| `FALSE` | 默认拒绝 |
| `OPERATOR` | OP 默认允许 |
| `NOT_OPERATOR` | 非 OP 默认允许 |

## 权限树

父权限可以声明子节点。授予父权限时，子节点会获得对应值。

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

## 检查权限

玩家、命令发送者和其它实现 `PermissionSubject` 的对象都可以作为权限主体。

```java
if (!sender.hasPermission("example.reload")) {
    sender.sendMessage(Component.text("No permission"));
    return;
}
```

也可以直接使用服务：

```java
boolean allowed = context.permissions().hasPermission(player, "example.reload");
```

## Attachment

`PermissionAttachment` 适合临时授予或撤销权限，例如一个限时活动、调试模式或会话状态。

```java
var attachment = context.permissions().attach(player);
attachment.setPermission("example.temp", true);

// Later
attachment.close();
```

如果只设置一个节点，可以使用便捷方法：

```java
var attachment = context.permissions().attach(player, "example.temp", true);
```

## 组与 Meta

Fand 的权限查询面包含生态常用的 group 和 meta：

```java
var primaryGroup = context.permissions().primaryGroup(player);
var groups = context.permissions().groups(player);
var prefix = context.permissions().prefix(player);
var suffix = context.permissions().suffix(player);
var rank = context.permissions().metaValue(player, "rank");
```

这些方法用于读取当前运行时权限实现提供的结果。不同权限插件可能有不同的存储模型，插件通常应该把它们当作只读查询结果。

不要根据 `fand-api` 接口里的 `default` 方法体推断这些查询会返回什么；最终结果取决于当前 Fand Server 绑定的权限实现、桥接插件或已注册 provider。

## Context

`PermissionContext` 用于表达世界、服务器、区域、玩法模式等上下文条件。key 会被标准化为小写。

```java
var contextValues = PermissionContext.empty()
        .with("world", player.world().key().asString())
        .with("server", "survival");

var prefix = context.permissions().prefix(player, contextValues);
var group = context.permissions().primaryGroup(player, contextValues);
```

`PermissionContext` 会传给当前权限实现。是否基于 context 改变节点检查、group 或 meta 解析结果，取决于运行时权限 provider 的语义。

## 插件描述文件声明

如果权限是插件静态能力的一部分，推荐放到 `fand-plugin.json` 的 `permissions` 中，方便服务端和管理插件在加载时发现。

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

## 使用建议

- 静态权限写入 descriptor 或启动时注册。
- 临时权限使用 attachment，并在不需要时关闭。
- meta/context 查询适合展示和兼容，不建议把它当作唯一业务状态来源。
- 管理命令和危险操作默认使用 `OPERATOR` 或 `FALSE`。
