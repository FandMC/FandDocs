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

## 为什么这样设计

Fand 的占位符 API 采用 `%namespace_value%`，并按 namespace 分派 provider，是为了让不同插件可以共享一个占位符服务，而不互相抢名字。插件作用域的 `context.placeholders()` 只允许注册自己的 namespace，避免插件意外覆盖别人的占位符。

MiniMessage 解析前先做占位符替换，是为了让配置文件里能直接写 `<green>%example_name%</green>` 这样的文本。占位符负责提供纯文本值，MiniMessage 负责颜色、hover、click 等组件语义。

`PlaceholderContext` 把 viewer 和 target 分开，是为了支持关系型占位符：例如“viewer 正在查看 target 的资料”、“某个实体的状态”、“某个世界里的排行榜模式”。

## 最佳实践

- namespace 和插件 id 保持一致，例如插件 id 是 `example-plugin`，占位符使用 `%example-plugin_xxx%`。
- provider 只做内存读取或轻量计算；数据库、网络和复杂统计提前缓存。
- 需要关系型数据时使用 `PlaceholderProvider.contextual(...)`，不要把 target 硬塞进全局变量。
- 用户输入进入 MiniMessage 模板前先 `escapeTags`，避免用户控制标签。
- 占位符无法解析时返回 `null`，让原始文本保留，便于服主发现拼写错误。
- context value 的 key 会小写标准化，写入和读取时使用稳定 key。

## 常见坑

- placeholder namespace 不能包含 `_`，因为 `_` 用于把 namespace 和后续 identifier 分开。
- identifier 会 trim 并转成小写，provider 里不要依赖大小写区分。
- 插件作用域只能注册自己的 namespace；跨插件解析可以调用 `replace` 或 `resolve`，但不能抢注别人的 namespace。
- 占位符替换不是模板引擎；它只扫描 `%...%`，复杂条件逻辑应在插件代码里完成。
- MiniMessage 的 `parse(viewer, input)` 会先替换占位符再解析标签，玩家输入需要转义。

## 综合示例：在线人数和目标玩家占位符

下面的例子注册两个占位符：`%example-plugin_viewer%` 和 `%example-plugin_target%`。第二个占位符依赖 `PlaceholderContext.target(...)`。

```java
package com.example;

import io.fand.api.placeholder.PlaceholderContext;
import io.fand.api.placeholder.PlaceholderProvider;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.placeholders().register(
                context.descriptor().id(),
                PlaceholderProvider.contextual((placeholderContext, identifier) -> {
                    return switch (identifier) {
                        case "example-plugin_viewer" -> placeholderContext.viewerOptional()
                                .map(viewer -> viewer.name())
                                .orElse("console");
                        case "example-plugin_target" -> placeholderContext.targetOptional()
                                .map(target -> target.name())
                                .orElse("none");
                        case "example-plugin_mode" -> placeholderContext
                                .value("mode", String.class)
                                .orElse("default");
                        default -> null;
                    };
                }));
    }

    public void sendInspectLine(PluginContext context, io.fand.api.entity.Player viewer, io.fand.api.entity.Player target) {
        var placeholderContext = PlaceholderContext.builder()
                .viewer(viewer)
                .target(target)
                .value("mode", "inspect")
                .build();

        var line = context.placeholders().replace(
                "Viewer=%example-plugin_viewer%, target=%example-plugin_target%, mode=%example-plugin_mode%",
                placeholderContext);
        viewer.sendMessage(Component.text(line));
    }
}
```
