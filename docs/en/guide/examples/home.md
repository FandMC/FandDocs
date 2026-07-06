# Player Homes Plugin

This example registers `/sethome` and `/home`. Players can save their current position and teleport back to it later.

It shows multiple commands, player-scoped storage, serializing a `Location` into simple fields, and resolving the world again when loading.

## HomePlugin.java

The entry point wires dependencies and registers commands.

```java
package com.example.home;

import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;

public final class HomePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        var homes = new HomeStore(context);
        var setHome = new SetHomeCommand(homes);
        var home = new HomeCommand(homes);

        context.commands().register("sethome", command -> command
                .permission("home.set")
                .executes(setHome::execute));
        context.commands().register("home", command -> command
                .permission("home.use")
                .executes(home::execute));
    }
}
```

## HomeStore.java

Location persistence is shared by both commands.

```java
package com.example.home;

import io.fand.api.Fand;
import io.fand.api.entity.Player;
import io.fand.api.plugin.PluginContext;
import io.fand.api.world.Location;
import net.kyori.adventure.key.Key;

final class HomeStore {
    private final PluginContext context;

    HomeStore(PluginContext context) {
        this.context = context;
    }

    void save(Player player) {
        var location = player.location();
        var storage = context.storage().player(player.uniqueId());
        storage.setString("home.world", location.world().key().asString());
        storage.setString("home.x", Double.toString(location.x()));
        storage.setString("home.y", Double.toString(location.y()));
        storage.setString("home.z", Double.toString(location.z()));
        storage.setString("home.yaw", Float.toString(location.yaw()));
        storage.setString("home.pitch", Float.toString(location.pitch()));
        storage.flush();
    }

    Location load(Player player) {
        var storage = context.storage().player(player.uniqueId());
        var worldKey = storage.getString("home.world").map(Key::key).orElse(null);
        if (worldKey == null) {
            return null;
        }

        var world = Fand.server().world(worldKey).orElse(null);
        if (world == null) {
            return null;
        }

        var x = Double.parseDouble(storage.getString("home.x").orElse("0"));
        var y = Double.parseDouble(storage.getString("home.y").orElse("0"));
        var z = Double.parseDouble(storage.getString("home.z").orElse("0"));
        var yaw = Float.parseFloat(storage.getString("home.yaw").orElse("0"));
        var pitch = Float.parseFloat(storage.getString("home.pitch").orElse("0"));
        return world.at(x, y, z, yaw, pitch);
    }
}
```

## SetHomeCommand.java

```java
package com.example.home;

import io.fand.api.command.CommandContext;
import io.fand.api.entity.Player;
import net.kyori.adventure.text.Component;

final class SetHomeCommand {
    private final HomeStore homes;

    SetHomeCommand(HomeStore homes) {
        this.homes = homes;
    }

    void execute(CommandContext command) {
        var sender = command.sender();
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("Only players can set homes"));
            return;
        }

        homes.save(player);
        player.sendMessage(Component.text("Home saved"));
    }
}
```

## HomeCommand.java

```java
package com.example.home;

import io.fand.api.command.CommandContext;
import io.fand.api.entity.Player;
import net.kyori.adventure.text.Component;

final class HomeCommand {
    private final HomeStore homes;

    HomeCommand(HomeStore homes) {
        this.homes = homes;
    }

    void execute(CommandContext command) {
        var sender = command.sender();
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("Only players can teleport home"));
            return;
        }

        var home = homes.load(player);
        if (home == null) {
            player.sendMessage(Component.text("You do not have a home yet. Use /sethome first"));
            return;
        }

        player.teleport(home).thenAccept(success -> {
            if (success) {
                player.sendMessage(Component.text("Teleported home"));
            }
        });
    }
}
```

`Location` contains a `World` handle, so it is not just a plain string. The example stores the world key and coordinates separately, then resolves the loaded world through `Fand.server().world(key)`.

## Next Improvements

- Support multiple homes, such as `/sethome mine` and `/home mine`.
- Show a clear message when the saved world is not loaded.
- Add cooldowns and a teleport warmup.
- Store the location as one JSON object instead of several string fields.
