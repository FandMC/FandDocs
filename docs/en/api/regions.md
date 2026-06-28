# Regions

`RegionService` provides a lightweight region-protection model: register cuboid regions, register typed flags, query regions applicable to a location, and resolve the final flag value. Regions are named by `Key` and bind a world `Key` to a `BlockRegion`.

## Defining Flags

Flags are typed. Common types can use built-in codecs:

```java
import io.fand.api.region.RegionFlag;
import net.kyori.adventure.key.Key;

var buildFlag = RegionFlag.bool(Key.key("example-plugin:build"), true);
var priorityFlag = RegionFlag.integer(Key.key("example-plugin:priority"), 0);
var greetingFlag = RegionFlag.string(Key.key("example-plugin:greeting"), "");

context.regions().registerFlag(buildFlag);
context.regions().registerFlag(priorityFlag);
context.regions().registerFlag(greetingFlag);
```

Plugin-scoped flag registrations are cleaned up when the plugin is disabled.

When accessed through a plugin context, region keys, flag keys, and parent keys are scoped to the current plugin namespace automatically; world keys are left unchanged.

## Registering Regions

`RegionDefinition` is immutable. The builder can set bounds, flags, priority, parent, owners, and members.

```java
import io.fand.api.region.RegionDefinition;
import io.fand.api.world.BlockRegion;
import net.kyori.adventure.key.Key;

var region = RegionDefinition.builder(
        Key.key("example-plugin:spawn"),
        player.world().key(),
        new BlockRegion(-32, 0, -32, 32, 255, 32))
        .priority(100)
        .owner(player.uniqueId().toString())
        .flag(buildFlag, false)
        .build();

var registration = context.regions().register(region);
```

`RegionRegistration.close()` removes the region. You can also call `remove(key)` directly.

## Querying Regions

```java
var regions = context.regions().applicableRegions(player.location());
var top = context.regions().applicableRegion(player.location());
```

`applicableRegions(location)` has API-defined ordering:

1. Higher protection priority first.
2. At the same priority, smaller volume first.
3. If still tied, the most recent registration first.

## Resolving Flags

```java
var resolution = context.regions().resolveFlag(player.location(), buildFlag);
boolean canBuild = resolution.orElse(true);

if (!canBuild) {
    for (var step : resolution.trace()) {
        context.logger().debug(
                "checked region={} inherited={} value={}",
                step.region().key(),
                step.inherited(),
                step.value());
    }
}
```

Resolution walks `applicableRegions(location)` in order. Each region checks its explicit flag first, then its parent chain. The first explicit value wins, including a value inherited from a parent; once a match is found, lower-priority overlapping regions are not consulted. If no region provides an explicit value, the flag default is returned.

## Owners and Members

`RegionProtection` normalizes owner/member strings to lowercase. `member(subject)` treats owners as members too.

```java
var protection = region.protection();
boolean owner = protection.owner(player.uniqueId().toString());
boolean member = protection.member(player.uniqueId().toString());
```

Owners and members do not automatically grant or deny a flag. They are metadata that protection plugins can use when implementing policy.

## Guidelines

- Use your plugin namespace for region keys, such as `example-plugin:spawn`.
- Reserve high priorities for more specific or more important protection regions.
- Use parents for child regions that inherit broad policy and override a few flags.
- Print `RegionFlagResolution.trace()` when debugging protection conflicts.
