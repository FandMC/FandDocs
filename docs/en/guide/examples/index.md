# Example Plugins

This section contains small plugins you can copy and adapt. Each example solves one concrete problem and keeps the code complete enough to compile.

The examples assume your project was created with the official Gradle plugin and that `fand-plugin.json` points `mainClass` at the example class.

## Examples

| Example | What it teaches |
| --- | --- |
| [Random Teleport](/en/guide/examples/rtp) | Commands, player senders, world height lookup, teleporting |
| [Join Welcome](/en/guide/examples/welcome) | Events, join messages, delayed tasks |
| [Daily Kit](/en/guide/examples/daily-kit) | Commands, inventory rewards, plugin storage, cooldowns |
| [Player Homes](/en/guide/examples/home) | Multiple commands, saving player locations, world lookup, teleporting |
| [Mining Stats](/en/guide/examples/mining-stats) | Block events, block keys, player storage, stat commands |

## Reading the Examples

- Prefer scoped services from `context.*`.
- Use generated `ItemKey` constants for vanilla items instead of hard-coded item ids.
- Keep player, inventory, entity, and world mutations on the server-side execution path.
- The examples skip some production details, such as full permissions, config hot reload, and localization.

## What Real Plugins Usually Add

- Permission declarations for public commands.
- Configurable radius, cooldowns, rewards, and messages.
- Full validation for player input.
- Async scheduling for database, network, or expensive computation.
