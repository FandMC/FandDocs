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
