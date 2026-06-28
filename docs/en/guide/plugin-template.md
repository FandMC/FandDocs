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

## Recommended Layout

```text
FandPluginTemplate/
  build.gradle.kts
  settings.gradle.kts
  src/main/java/com/example/ExamplePlugin.java
  src/main/resources/config.yml
```

`fand-plugin.json` can be generated from Gradle configuration, or kept as a template file with placeholders replaced during the build. Optional fields that are not declared in Gradle are not forced into the descriptor, which keeps manual descriptor edits possible.

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

Build it with:

```powershell
./gradlew.bat build
```

The produced jar includes `fand-plugin.json`, the plugin classes, bundled
resources, and the direct-run guard main class.

## Run Locally

Template projects can use `runFandServer` to start a local development server. This is useful for verifying plugin loading, command registration, and event behavior.

`runFandServer` builds the plugin jar and copies it into `run/plugins`. It must be able to find a Fand server jar: the default path is `run/fand-server.jar`; if that file is missing, configure `fandPlugin.serverJar` or `fandPlugin.serverDownloadUrl`.

```powershell
./gradlew.bat runFandServer
```

To initialize only the descriptor, run:

```powershell
./gradlew.bat initFandPlugin
```

## Build Output Checklist

After building, check that:

- The jar contains `fand-plugin.json`.
- `mainClass` points to a class implementing `io.fand.api.plugin.Plugin`.
- `apiVersion` matches the target Fand API version; the official Gradle plugin requires this field when validating a new descriptor.
- Opening the jar directly explains that it is a Fand plugin instead of trying to run as a normal application.
