# Entities

`Entity` is a lightweight handle for anything in a server world. `uniqueId()` is the stable identity, while `entityId()` is the numeric id used by the current network session; do not persist it. `LivingEntity` adds health, damage, effects, attributes, and equipment.

> [!IMPORTANT]
> Do not infer entity capability from `default` method bodies in `fand-api`. Those defaults exist mainly for compile-time compatibility; real behavior is provided by the target Fand Server runtime.

## Lookup and Spawning

World entity queries only cover loaded entities. Returned collections are snapshots, not live collections.

```java
import io.fand.api.entity.EntityKey;

var zombies = world.entities(EntityKey.ZOMBIE);
var nearby = world.nearbyEntities(player.location(), 16.0);
var nearestZombie = world.nearestEntity(player.location(), 32.0, EntityKey.ZOMBIE);
```

Spawn fixed vanilla entities with generated `EntityKey` constants. Spawning is marshalled to the server thread, and the returned future usually completes there.

```java
import io.fand.api.entity.EntityKey;
import io.fand.api.entity.EntitySpawnOptions;
import io.fand.api.world.Vector3;
import net.kyori.adventure.text.Component;

var options = EntitySpawnOptions.builder()
        .customName(Component.text("Arena Guard"))
        .customNameVisible(true)
        .glowing(true)
        .velocity(new Vector3(0.0, 0.2, 0.0))
        .build();

world.spawnEntity(location, EntityKey.ZOMBIE, options)
        .thenAccept(spawned -> spawned.ifPresent(entity -> {
            entity.addScoreboardTag("arena_guard");
        }));
```

Fields in `EntitySpawnOptions` that do not apply to the spawned type are ignored. For example, `pickupDelay` applies to item entities, while projectile fields apply to projectile entities.

## Common State

```java
entity.uniqueId();
entity.type();
entity.alive();
entity.location();
entity.velocity();

entity.setVelocity(new Vector3(0.0, 0.5, 0.0));
entity.teleport(destination);
entity.remove();
```

After `alive()` becomes `false`, the handle may still exist as a reference, but it should not be treated as live world state. When storing an entity across ticks, store its `UUID` and resolve it again with `Fand.server().entity(uuid)` or `world.entity(uuid)`.

## Presentation and Tags

```java
entity.setCustomName(Component.text("Quest Target"));
entity.setCustomNameVisible(true);
entity.setGlowing(true);
entity.setSilent(true);
entity.setGravity(false);
entity.addScoreboardTag("quest_target");
```

Scoreboard tags are vanilla entity tags and work well for lightweight filtering. Prefer `persistentData()` or `components()` for plugin-private structured data.

```java
import net.kyori.adventure.key.Key;

var dataKey = Key.key("example:owner");
entity.setPersistentData(entity.persistentData().withString(dataKey, player.uniqueId().toString()));
```

## Riding

```java
entity.vehicle();
entity.passengers();

entity.mount(vehicle);
vehicle.addPassenger(entity);
entity.dismount();
vehicle.ejectPassengers();
```

Riding operations follow vanilla rules and may be rejected because of entity type, distance, state, or events. Handle failed futures or false results.

## LivingEntity

`LivingEntity` covers players, mobs, armor stands, and other entities with health or equipment semantics.

```java
import io.fand.api.entity.AttributeKey;
import io.fand.api.entity.EntityEffect;
import io.fand.api.item.component.EffectKey;

living.health();
living.maxHealth();
living.damage(4.0);
living.heal(2.0);
living.addEffect(new EntityEffect(EffectKey.GLOWING, 20 * 5));

living.attribute(AttributeKey.MOVEMENT_SPEED)
        .ifPresent(attribute -> attribute.setBaseValue(attribute.defaultValue() * 1.2));
```

Equipment slots use `ItemEquipmentSlot`. Empty slots return `ItemStack.EMPTY`; clearing equipment also uses `ItemStack.EMPTY`.

## Design Philosophy

Fand exposes entities as handles instead of handing plugins NMS/Paper internals. Plugins get stable public operations, and the runtime maps those operations onto the active Minecraft version.

Generated keys such as `EntityKey`, `AttributeKey`, and `EffectKey` replace hand-written registry strings. Fixed vanilla types get compile-time checks; config files, player input, and cross-version data are where raw `Key` parsing belongs.

Many mutations marshal to the server thread so events, async tasks, and plugin components can submit actions safely while real world state is still applied in tick order.

## Best Practices

- Use generated keys for fixed vanilla entities, attributes, and effects: `EntityKey.ZOMBIE`, `AttributeKey.MAX_HEALTH`, `EffectKey.SPEED`.
- Store `UUID`s across ticks, then resolve the entity again and check `alive()`.
- Narrow world, radius, or bounding boxes before querying entities every tick.
- Keep entity, equipment, health, target, and riding mutations short; compute asynchronously first when needed, then apply on the main thread.
- Use `persistentData()` for plugin-private markers; use scoreboard tags for temporary filtering.
- For per-viewer hiding, fake entities, or visual-only glow behavior, prefer packet illusions or player-presentation APIs instead of mutating real entity state.

## Common Pitfalls

- Persisting `entityId()`; it is only a session-local network id.
- Caching an entity handle without checking `alive()` after death, unload, or dimension changes.
- Reading or writing lots of live entity state directly from async tasks.
- Hard-coding fixed vanilla ids as strings instead of generated keys.
- Treating `remove()` as plugin-owned cleanup. Spawned real entities are world state, so the plugin needs its own lifecycle policy.

## Complete Example: Spawn a Guard and Protect It

```java
package com.example;

import io.fand.api.entity.EntityKey;
import io.fand.api.entity.EntitySpawnOptions;
import io.fand.api.event.entity.EntityDamageByEntityEvent;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import io.fand.api.world.Location;
import net.kyori.adventure.text.Component;

public final class GuardPlugin implements Plugin {
    private static final String GUARD_TAG = "example_guard";

    @Override
    public void onEnable(PluginContext context) {
        context.events().subscribe(EntityDamageByEntityEvent.class, event -> {
            if (event.entity().scoreboardTags().contains(GUARD_TAG)
                    && !event.damager().scoreboardTags().contains("admin_tool")) {
                event.setCancelled(true);
            }
        });
    }

    public void spawnGuard(Location location) {
        var options = EntitySpawnOptions.builder()
                .customName(Component.text("Guard"))
                .customNameVisible(true)
                .persistent(true)
                .noAi(true)
                .build();

        location.world().spawnEntity(location, EntityKey.ZOMBIE, options)
                .thenAccept(spawned -> spawned.ifPresent(entity -> {
                    entity.addScoreboardTag(GUARD_TAG);
                    entity.setGlowing(true);
                }));
    }
}
```
