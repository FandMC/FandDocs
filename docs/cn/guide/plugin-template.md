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

构建方式：

```powershell
./gradlew.bat build
```

生成的 jar 会包含 `fand-plugin.json`、插件类、资源文件和直接运行保护入口。
