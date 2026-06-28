# API Overview

Fand plugins should depend only on `fand-api`.

Core entry points:

- `PluginContext` for lifecycle-scoped services
- `EventBus` for events
- `CommandRegistry` for commands
- `Scheduler` for main-thread and async tasks
- `PermissionService` for permission nodes, groups, metadata, and context
- `RegionService` for region protection and flag resolution
- `PacketRegistry` for packet interception and helper builders
- `ServiceRegistry` for cross-plugin Java providers

## Maven Coordinates

```kotlin
dependencies {
    compileOnly("io.fand:fand-api:latest.release")
}
```

Prefer the official Gradle plugin for real plugin projects because it wires this
dependency automatically.
