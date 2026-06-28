# 占位符与 MiniMessage

`PlaceholderService` 用于注册 `%namespace_value%` 风格占位符，`MiniMessageService` 用于把带 Adventure MiniMessage 标签的字符串解析成 `Component`。Fand Server 的 MiniMessage 解析会先执行占位符替换，再交给 Adventure MiniMessage parser。

## 注册占位符

插件作用域的 `context.placeholders()` 只允许注册当前插件 id 对应的 namespace。

```java
context.placeholders().register("example-plugin", (viewer, identifier) -> switch (identifier) {
    case "example-plugin_online" -> String.valueOf(Fand.server().players().size());
    case "example-plugin_viewer" -> viewer == null ? "console" : viewer.name();
    default -> null;
});
```

解析 `%example-plugin_online%` 时，服务端会把 `example-plugin_online` 分派给 `example-plugin` provider。provider 返回 `null` 表示无法解析，原始占位符会保留在文本中。

## 上下文占位符

如果占位符需要 viewer、target、world、entity 或额外上下文值，可以使用 `PlaceholderProvider.contextual`。

```java
import io.fand.api.placeholder.PlaceholderContext;
import io.fand.api.placeholder.PlaceholderProvider;

context.placeholders().register("example-plugin", PlaceholderProvider.contextual((placeholderContext, identifier) -> {
    if (identifier.equals("example-plugin_target")) {
        return placeholderContext.targetOptional()
                .map(target -> target.name())
                .orElse("none");
    }
    if (identifier.equals("example-plugin_mode")) {
        return placeholderContext.value("mode", String.class).orElse(null);
    }
    return null;
}));

var placeholderContext = PlaceholderContext.builder()
        .viewer(viewer)
        .target(target)
        .world(viewer.world())
        .value("mode", "arena")
        .build();

var text = context.placeholders().replace(
        "Target: %example-plugin_target%, mode: %example-plugin_mode%",
        placeholderContext);
```

context value 的 key 会标准化为小写。

## 解析文本

```java
var plain = context.placeholders().replace(player, "Online: %example-plugin_online%");
var component = context.miniMessages().parse(player, "<green>%example-plugin_viewer%</green>");
```

`parse(viewer, input)` 会先替换占位符，再解析 MiniMessage 标签。需要自定义 `TagResolver` 时，可以使用重载：

```java
var component = context.miniMessages().parse(
        player,
        "<green><name></green>",
        Placeholder.component("name", Component.text(player.name())));
```

## 转义与清理

`MiniMessageService` 暴露 Adventure parser，可以序列化组件、转义标签或移除标签。

```java
var safe = context.miniMessages().escapeTags(userInput);
var stripped = context.miniMessages().stripTags(userInput);
var serialized = context.miniMessages().serialize(component);
```

## 使用建议

- namespace 使用插件 id，和 descriptor 保持一致。
- provider 应该快速返回，不要在解析时做数据库查询。
- 对玩家输入先 `escapeTags`，再拼进 MiniMessage 模板。
- 无法解析时返回 `null`，让原始 `%placeholder%` 留在输出中，便于排查。
