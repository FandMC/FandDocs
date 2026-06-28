# API 概览

Fand 插件应该只依赖 `fand-api`。

核心入口：

- `PluginContext`：插件生命周期作用域服务
- `EventBus`：事件系统
- `CommandRegistry`：命令注册
- `Scheduler`：主线程和异步任务
- `PermissionService`：权限节点、组、元数据和上下文
- `RegionService`：区域保护和 flag 解析
- `PacketRegistry`：数据包拦截和辅助构建
- `ServiceRegistry`：跨插件 Java provider 注册与发现

## Maven 坐标

```kotlin
dependencies {
    compileOnly("io.fand:fand-api:latest.release")
}
```

实际插件工程建议优先使用官方 Gradle 插件，因为它会自动配置该依赖。
