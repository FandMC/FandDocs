# 插件模板

本地最小插件模板位于：

```text
C:/Users/winme/Desktop/FandPluginTemplate
```

模板包含：

- Gradle Wrapper
- `io.fand.plugin` 配置
- 最小插件主类
- 默认 `config.yml`

## 推荐的工程结构

```text
FandPluginTemplate/
  build.gradle.kts
  settings.gradle.kts
  src/main/java/com/example/ExamplePlugin.java
  src/main/resources/config.yml
```

`fand-plugin.json` 可以由 Gradle 插件从配置生成，也可以保留模板文件并在构建时替换占位符。未在 Gradle 配置中声明的可选字段不会被强行覆盖，适合后续手动维护。

```kotlin
fandPlugin {
    id.set("example-plugin")
    version.set(project.version.toString())
    mainClass.set("com.example.ExamplePlugin")
    apiVersion.set("0.1.1")

    description.set("Example Fand plugin")
    authors.add("FandMC")
    depends.add("some-required-plugin")
    loadAfter.add("some-soft-plugin")
}
```

构建方式：

```powershell
./gradlew.bat build
```

生成的 jar 会包含 `fand-plugin.json`、插件类、资源文件和直接运行保护入口。

## 本地运行

模板工程可以使用 `runFandServer` 启动本地开发服务端。这个任务适合快速验证插件是否能加载、命令是否注册、事件是否触发。

`runFandServer` 会先构建插件 jar，再复制到 `run/plugins`。它需要能找到 Fand 服务端 jar：默认路径是 `run/fand-server.jar`；如果文件不存在，需要配置 `fandPlugin.serverJar` 或 `fandPlugin.serverDownloadUrl`。

```powershell
./gradlew.bat runFandServer
```

如果只想初始化描述文件，可以运行：

```powershell
./gradlew.bat initFandPlugin
```

## 构建产物检查

构建完成后，重点检查：

- jar 内存在 `fand-plugin.json`。
- `mainClass` 指向实现 `io.fand.api.plugin.Plugin` 的类。
- `apiVersion` 与目标 Fand API 版本一致；官方 Gradle 插件校验新 descriptor 时要求声明该字段。
- 直接双击 jar 时提示这是 Fand 插件，而不是尝试当作普通应用运行。
