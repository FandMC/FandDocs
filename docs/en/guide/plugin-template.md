# Plugin Template

A minimal local template is available at:

```text
C:/Users/winme/Desktop/FandPluginTemplate
```

It contains:

- Gradle wrapper
- `io.fand.plugin` configuration
- A minimal plugin main class
- A default `config.yml`

Build it with:

```powershell
./gradlew.bat build
```

The produced jar includes `fand-plugin.json`, the plugin classes, bundled
resources, and the direct-run guard main class.
