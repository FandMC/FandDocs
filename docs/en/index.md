---
layout: home

hero:
  name: Fand
  text: A modern Minecraft plugin server.
  tagline: Type-safe plugin APIs, predictable runtime behavior, and an ecosystem built around clean tooling.
  actions:
    - theme: brand
      text: Get Started
      link: /en/guide/getting-started
    - theme: alt
      text: API Overview
      link: /en/api/

features:
  - title: Modern Server Runtime
    details: Fand provides a focused server platform designed for plugins, performance, and long-term API stability.
  - title: Plugin API
    details: The public API is isolated in fand-api, with modern services for commands, events, regions, packets, permissions, placeholders, structures, maps, GUIs, scoreboards, and cross-plugin providers.
  - title: Tooling
    details: Official Gradle tooling can generate plugin descriptors, build plugin jars, and run a local Fand server for development.
---

## What You Can Build

Fand lets plugin developers target a stable API instead of depending on server internals. A plugin gets lifecycle-scoped services from `PluginContext`, and can use `Fand.server()` when it needs the global server view.

- Gameplay plugins: commands, events, scheduler, configuration, permissions, GUIs, boss bars, and scoreboards.
- Content plugins: custom items, custom blocks, recipes, loot tables, advancements, enchantments, and data packs.
- Administration plugins: region protection, player access control, cross-plugin service discovery, and external integration strategy.
- Presentation plugins: tab lists, map rendering, MiniMessage, placeholders, packet interception, and per-viewer illusions.
- World plugins: dynamic worlds, structure templates, world lookup, block access, and entity access.

## Development Entry Point

New plugins should start with the official Gradle plugin. It configures `fand-api`, processes `fand-plugin.json`, and adds a direct-run guard to the built jar.

```kotlin
plugins {
    id("io.fand.plugin") version "latest.release"
}

fandPlugin {
    id.set("example-plugin")
    mainClass.set("com.example.ExamplePlugin")
    apiVersion.set("0.1.2")
}
```

Continue with:

- [Getting Started](/en/guide/getting-started)
- [Plugin Template](/en/guide/plugin-template)
- [API Overview](/en/api/)
