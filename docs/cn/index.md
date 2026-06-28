---
layout: home

hero:
  name: Fand
  text: 现代化 Minecraft 插件服务端
  tagline: 类型安全的插件 API、稳定可预期的运行时行为，以及围绕官方工具链构建的插件生态。
  actions:
    - theme: brand
      text: 快速开始
      link: /cn/guide/getting-started
    - theme: alt
      text: API 概览
      link: /cn/api/

features:
  - title: 现代化服务端运行时
    details: Fand 面向插件、性能和长期 API 稳定性设计，提供清晰、可维护的服务端平台。
  - title: 插件 API
    details: 公共 API 独立在 fand-api 中，覆盖命令、事件、区域、数据包、权限、占位符、结构、地图、GUI、记分板和跨插件服务发现。
  - title: 官方工具链
    details: Fand Gradle 插件可以生成插件描述文件、构建插件 jar，并辅助运行本地开发服务端。
---

## 适合构建什么

Fand 的目标是让插件开发者直接面向稳定 API 编写功能，而不是把精力消耗在服务端内部细节上。一个插件可以从 `PluginContext` 获取自己的生命周期作用域服务，也可以通过 `Fand.server()` 访问全局服务端视图。

- 玩法插件：命令、事件、调度器、配置、权限、GUI、BossBar、记分板。
- 内容插件：自定义物品、自定义方块、配方、战利品表、进度、附魔、数据包。
- 管理插件：区域保护、玩家访问控制、跨插件服务注册、外部集成策略。
- 表现插件：TabList、地图渲染、MiniMessage、占位符、数据包拦截和 per-viewer illusion。
- 世界插件：动态世界、结构模板、世界查询、方块和实体访问。

## 开发入口

新插件推荐从官方 Gradle 插件开始，它会自动配置 `fand-api`、处理 `fand-plugin.json`，并在 jar 中加入直接运行保护入口。

```kotlin
plugins {
    id("io.fand.plugin") version "latest.release"
}

fandPlugin {
    id.set("example-plugin")
    mainClass.set("com.example.ExamplePlugin")
    apiVersion.set("0.1.1")
}
```

继续阅读：

- [快速开始](/cn/guide/getting-started)
- [插件模板](/cn/guide/plugin-template)
- [API 概览](/cn/api/)
