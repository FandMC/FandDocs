# fand-plugin.json

`fand-plugin.json` 是 Fand 插件 jar 根目录下的描述文件。服务端通过它识别插件 id、版本、主类、依赖顺序和静态权限声明。

如果 jar 中没有 `fand-plugin.json`，Fand 不会把它当作 Fand 插件加载。只包含 `plugin.yml`、`paper-plugin.yml`、`fabric.mod.json`、`META-INF/mods.toml` 等其它加载器描述文件的 jar，会被识别为其它平台插件或 Mod，并给出警告。

## 最小示例

```json
{
  "id": "example-plugin",
  "version": "1.0.0",
  "mainClass": "com.example.ExamplePlugin",
  "apiVersion": "0.1.2"
}
```

## 完整示例

```json
{
  "id": "example-plugin",
  "version": "1.0.0",
  "mainClass": "com.example.ExamplePlugin",
  "description": "Example plugin for Fand",
  "website": "https://example.com",
  "license": "MIT",
  "apiVersion": "0.1.2",
  "authors": ["FandMC"],
  "depends": ["required-plugin"],
  "loadAfter": ["soft-provider"],
  "loadBefore": ["consumer-plugin"],
  "permissions": [
    {
      "node": "example-plugin.reload",
      "defaultAccess": "OPERATOR",
      "children": {
        "example-plugin.status": true,
        "example-plugin.danger": false
      }
    }
  ]
}
```

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 插件唯一 id。必须匹配 `[a-z0-9]+(?:-[a-z0-9]+)*`，例如 `example-plugin`。 |
| `version` | string | 是 | 插件版本。推荐使用语义化版本，例如 `1.0.0`。 |
| `mainClass` | string | 是 | 插件主类全限定名，必须实现 `io.fand.api.plugin.Plugin`，并提供无参构造器。 |
| `apiVersion` | string | 建议 | 插件面向的 Fand API 版本。服务端为旧 descriptor 兼容允许缺失，并按运行时的兼容默认版本处理；官方 Gradle 插件校验新 descriptor 时要求声明。显式空字符串会被拒绝。 |
| `description` | string | 否 | 插件简介。 |
| `website` | string | 否 | 插件网站或文档地址。填写时必须是 `http` 或 `https`。 |
| `license` | string | 否 | 插件许可证标识或名称，例如 `MIT`、`GPL-3.0`。 |
| `authors` | string[] | 否 | 作者列表。缺失时视为空列表。 |
| `depends` | string[] | 否 | 硬依赖。目标插件必须存在并先加载。每个 id 必须符合插件 id 规则。 |
| `loadAfter` | string[] | 否 | 软顺序。目标插件存在时，本插件在它之后加载；目标缺失时忽略。每个 id 必须符合插件 id 规则。 |
| `loadBefore` | string[] | 否 | 软顺序。目标插件存在时，本插件在它之前加载；目标缺失时忽略。每个 id 必须符合插件 id 规则。 |
| `permissions` | object[] | 否 | 插件静态权限声明。缺失时视为空列表。 |

## 依赖与加载顺序

`depends` 会影响可用性和 classloader 依赖。依赖缺失时，插件无法正常加载。

```json
{
  "depends": ["economy-core"]
}
```

`loadAfter` 和 `loadBefore` 只表达加载顺序，不要求目标插件必须存在。

```json
{
  "loadAfter": ["luckperms"],
  "loadBefore": ["example-addon"]
}
```

如果软顺序之间形成循环，相关插件可能被跳过或记录加载错误，具体取决于服务端加载策略。

## 权限声明

权限项包含：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `node` | string | 是 | 权限节点。必须属于插件命名空间。 |
| `defaultAccess` | string | 否 | 默认权限，缺失时为 `FALSE`。 |
| `children` | object | 否 | 子权限映射，key 是权限节点，value 是布尔值。 |

`defaultAccess` 可选值：

```text
TRUE
FALSE
OPERATOR
NOT_OPERATOR
```

权限节点必须属于插件命名空间。插件 id 为 `example-plugin` 时，服务端接受以下命名空间形式：

```text
example-plugin.reload
example.plugin.reload
exampleplugin.reload
```

推荐直接使用插件 id 前缀，保持最直观：

```json
{
  "permissions": [
    {
      "node": "example-plugin.reload",
      "defaultAccess": "OPERATOR"
    }
  ]
}
```

## Gradle 插件生成

使用官方 Gradle 插件时，可以从 `build.gradle.kts` 生成或处理 `fand-plugin.json`：

```kotlin
fandPlugin {
    id.set("example-plugin")
    version.set(project.version.toString())
    mainClass.set("com.example.ExamplePlugin")
    apiVersion.set("0.1.2")

    description.set("Example plugin for Fand")
    website.set("https://example.com")
    license.set("MIT")
    authors.add("FandMC")
    depends.add("required-plugin")
    loadAfter.add("soft-provider")
    loadBefore.add("consumer-plugin")
}
```

可选字段没有配置时，不需要强行写进 descriptor。更复杂的权限声明可以直接维护 `fand-plugin.json` 模板。

官方 Gradle 插件生成 descriptor 时不会自动生成 `permissions` 字段；需要静态权限声明时，直接维护 descriptor 模板更合适。

## 常见错误

- jar 根目录没有 `fand-plugin.json`。
- `mainClass` 不存在、没有无参构造器，或没有实现 `Plugin`。
- `website` 不是 `http` / `https`。
- `depends` 中的插件不存在。
- 权限节点不属于插件命名空间。
- 把 Bukkit、Paper、Fabric、Forge、NeoForge 等其它加载器的 jar 放进 Fand 插件目录。
