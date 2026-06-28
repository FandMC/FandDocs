# 配置

Fand 提供两层配置入口：

- `context.config()`：插件默认配置，位于插件数据目录的 `config.yml`。
- `context.configurations()`：通用配置加载器，可读取 YAML、JSON、TOML、properties 等文件。

## 默认配置

第一次访问 `context.config()` 时，如果数据目录里还没有 `config.yml`，运行时会尝试从插件 jar 根目录复制默认 `config.yml`。如果 jar 中也没有默认文件，则创建空文档。

```java
var config = context.config();
var enabled = config.getBoolean("features.enabled", true);
var message = config.getString("messages.welcome", "Welcome");
```

示例 `src/main/resources/config.yml`：

```yaml
features:
  enabled: true
messages:
  welcome: "Welcome to Fand"
```

## 读写值

配置路径使用点分隔。类型不匹配时，typed getter 会返回默认值，而不是抛异常。

```java
var host = config.getString("database.host", "localhost");
var port = config.getInt("database.port", 3306);
var debug = config.getBoolean("debug", false);
var worlds = config.getStringList("enabled-worlds");
```

修改配置后，需要在根 `Configuration` 上调用 `save()` 才会持久化。

```java
var config = context.config();
config.set("features.enabled", true);
config.set("messages.welcome", "Hello");
config.save();
```

传入 `null` 会删除路径：

```java
config.set("temporary.value", null);
config.save();
```

## Section

`getSection` 会返回子 section；如果不存在，会创建空 section。对子 section 的修改会影响根配置，但仍然需要根配置 `save()`。

```java
var database = config.getSection("database");
database.set("host", "127.0.0.1");
database.set("port", 3306);
config.save();
```

## 重新加载

`reloadConfig()` 会从磁盘重新读取 `config.yml`，丢弃未保存的内存修改。

```java
context.reloadConfig();
```

## 加载其它文件

`ConfigurationService` 适合读取插件数据目录里的其它配置文件。

```java
var file = context.dataDirectory().resolve("messages.json");
var messages = context.configurations().load(file);
```

也可以显式指定格式：

```java
var config = context.configurations().load(file, ConfigurationFormat.JSON);
```

## 使用建议

- 配置 key 使用小写和点分隔，例如 `database.host`。
- typed getter 总是提供合理默认值，降低用户配置错误导致的启动失败。
- 只在需要持久化用户修改时调用 `save()`。
- `Configuration` 不是线程安全对象；多线程访问同一个配置实例时，插件需要自行同步。

## 为什么这样设计

Fand 的配置 API 把“默认插件配置”和“任意配置文件加载”分开，是为了让常见插件保持简单，同时不限制大型插件拆分 `messages.yml`、`database.json` 或其它数据文件。

typed getter 遇到类型不匹配时返回默认值，而不是直接抛异常，目的是让配置读取点显式说明 fallback 策略。真正关键的配置仍然应该由插件自己校验，并给服主清晰错误信息。

`ConfigurationSection` 是对同一份内存文档的视图，不是独立副本。这样修改 section 能自然反映到根配置上，但也意味着持久化仍然由根 `Configuration.save()` 控制。

## 最佳实践

- 把默认 `config.yml` 放在插件 jar 根目录，让首次启动自动生成可读配置。
- 配置 key 保持稳定；重命名 key 时保留迁移逻辑或兼容读取。
- 普通开关、消息文本、数值阈值使用 typed getter；数据库地址、外部 token 等关键项额外做校验。
- 只在用户命令、初始化迁移或状态确实变化时 `save()`，不要每 tick 保存。
- 重新加载配置前，先保存你确实想保留的内存修改。
- 配置用于“服主可编辑设置”；玩家数据、缓存、运行时统计放到 storage 或自己的数据文件。

## 常见坑

- `getSection("path")` 在不存在时会创建空 section；只想判断是否存在时先用 `contains("path")`。
- 修改子 section 后忘记在根配置上 `save()`，重启后修改会丢失。
- `reloadConfig()` 会丢弃未保存的内存修改。
- typed getter 返回默认值不代表配置文件正确；关键字段仍需要主动校验。
- 多线程同时读写同一个 `Configuration` 没有内建同步。

## 综合示例：配置驱动的欢迎消息

下面的例子读取默认配置、处理 `/welcome reload` 这类命令时重新加载，并在玩家加入时使用配置消息。示例里的字符串模板是插件自己的逻辑，Fand 不会替你规定配置格式。

```java
package com.example;

import io.fand.api.event.player.PlayerJoinEvent;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import net.kyori.adventure.text.Component;

public final class ExamplePlugin implements Plugin {
    private String welcomeMessage = "Welcome, {player}";
    private boolean enabled = true;

    @Override
    public void onEnable(PluginContext context) {
        loadSettings(context);

        context.events().subscribe(PlayerJoinEvent.class, event -> {
            if (!enabled) {
                return;
            }
            var text = welcomeMessage.replace("{player}", event.player().name());
            event.player().sendMessage(Component.text(text));
        });
    }

    private void loadSettings(PluginContext context) {
        var config = context.config();
        enabled = config.getBoolean("welcome.enabled", true);
        welcomeMessage = config.getString("welcome.message", "Welcome, {player}");

        if (!config.contains("welcome.enabled")) {
            config.set("welcome.enabled", enabled);
            config.set("welcome.message", welcomeMessage);
            config.save();
        }
    }
}
```
