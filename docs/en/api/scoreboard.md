# Scoreboards

`ScoreboardService` operates the persistent vanilla scoreboard: objectives, scores, display slots, and teams. Player objects also expose `PlayerScoreboard` for per-player objective/team/display overrides.

> [!IMPORTANT]
> `PlayerScoreboard` is a per-player display override, not a separate persistent vanilla scoreboard. Use `context.scoreboard()` for server-wide objectives and teams; use `player.scoreboard()` when different players should see different sidebar/list/below-name displays.

## Registering Objectives

```java
import io.fand.api.scoreboard.ScoreDisplaySlot;
import net.kyori.adventure.text.Component;

var registration = context.scoreboard().registerObjective(
        "example_points",
        Component.text("Points"));

var objective = context.scoreboard()
        .objective("example_points")
        .orElseThrow();

objective.score(player.name()).setValue(10);
context.scoreboard().setDisplayedObjective(ScoreDisplaySlot.SIDEBAR, objective);
```

`ScoreboardRegistration.close()` removes only the objective/team it installed. If the same name was registered again later, closing the older handle must not remove the newer object.

## Scores

```java
var score = objective.score(player.name());
score.setValue(score.value() + 1);
score.setDisplayName(Component.text("Player " + player.name()));

objective.resetScore(player.name());
```

`score(owner)` returns the score entry for that owner within the objective. `existingScore(owner)` only queries an already existing score.

## Display Slots

```java
context.scoreboard().setDisplayedObjective(ScoreDisplaySlot.SIDEBAR, objective);
context.scoreboard().clearDisplayedObjective(ScoreDisplaySlot.SIDEBAR);
```

Common slots:

```text
LIST
SIDEBAR
BELOW_NAME
TEAM_RED / TEAM_BLUE / ...
```

## Teams and Nameplates

Teams are useful for nameplate prefix/suffix, color, collision, and visibility.

```java
import net.kyori.adventure.text.format.NamedTextColor;

context.scoreboard().registerTeam("example_admin");
var team = context.scoreboard().team("example_admin").orElseThrow();

team.setPrefix(Component.text("[Admin] "));
team.setColor(NamedTextColor.RED);
team.addPlayer(player);
```

Members can be player names or entity UUID strings. `addPlayer` and `addEntity` are convenience methods.

## Per-Player Scoreboards

`PlayerScoreboard` can register objectives/teams displayed only to one player and override display slots.

```java
var personal = player.scoreboard();
personal.registerObjective("quest", Component.text("Quest"));

var quest = personal.objective("quest").orElseThrow();
quest.score("progress").setValue(3);
personal.setDisplayedObjective(ScoreDisplaySlot.SIDEBAR, quest);
```

To return to global display:

```java
personal.resetDisplayedObjective(ScoreDisplaySlot.SIDEBAR);
personal.resetDisplayedObjectives();
```

`clearDisplayedObjective(slot)` / `clearDisplayedObjectives()` clear the per-player display slot and keep overriding the global display. `resetDisplayedObjective(slot)` / `resetDisplayedObjectives()` remove the per-player override and restore the global display.

## Design Philosophy

Fand separates `ScoreboardService` from `PlayerScoreboard` to make real vanilla scoreboard state distinct from what one player currently sees. Global objectives and teams fit rankings, teams, and nameplates. Per-player overrides fit quest progress, personal HUDs, and spectator views.

The difference between `clearDisplayedObjective` and `resetDisplayedObjective` is intentional. Clear means "this player's slot is empty and still overrides global display"; reset means "remove the per-player override and show the global display again." This prevents closing a personal HUD from accidentally clearing a server-wide sidebar.

Registration handles use identity semantics so an old handle cannot remove a newer object registered later with the same name. Plugin reloads and module rebuilds are less likely to delete fresh state by accident.

## Best Practices

- Keep objective/team names short and stable to avoid conflicts.
- Prefix plugin-owned objectives and teams with the plugin id, such as `example_points`.
- For frequently updated sidebars, update only changed scores instead of rebuilding every tick.
- Per-player display fits quest progress, personal HUDs, and spectator information; global rankings fit persistent objectives.
- Use teams for nameplate prefix, suffix, color, collision, and visibility instead of hand-written packets for normal team behavior.
- Reset personal display overrides when a player leaves an arena, closes a HUD, or exits a session.

## Common Pitfalls

- `clearDisplayedObjective(slot)` keeps overriding global display with an empty slot. Use `resetDisplayedObjective(slot)` to restore global display.
- `score(owner)` creates or returns a score entry; use `existingScore(owner)` when you only want to query.
- The global scoreboard is shared state; changing a global display slot affects all players who are not overriding that slot.
- Team members are strings. Player convenience methods use player names; entity convenience methods use UUID strings.
- Rebuilding objectives or teams every tick causes unnecessary client refreshes and server work.

## Complete Example: Personal Quest Sidebar and Team Prefix

This example shows a personal quest sidebar for one player and uses a global team to add an admin nameplate prefix.

```java
package com.example;

import io.fand.api.entity.Player;
import io.fand.api.plugin.Plugin;
import io.fand.api.plugin.PluginContext;
import io.fand.api.scoreboard.ScoreDisplaySlot;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;

public final class ExamplePlugin implements Plugin {
    @Override
    public void onEnable(PluginContext context) {
        context.scoreboard().registerTeam("example_admin");
        var team = context.scoreboard().team("example_admin").orElseThrow();
        team.setPrefix(Component.text("[Admin] "));
        team.setColor(NamedTextColor.RED);
    }

    public void showQuest(Player player, int progress, int total) {
        var board = player.scoreboard();
        board.registerObjective("example_quest", Component.text("Quest"));

        var objective = board.objective("example_quest").orElseThrow();
        objective.score("Progress").setValue(progress);
        objective.score("Total").setValue(total);
        board.setDisplayedObjective(ScoreDisplaySlot.SIDEBAR, objective);
    }

    public void hideQuest(Player player) {
        player.scoreboard().resetDisplayedObjective(ScoreDisplaySlot.SIDEBAR);
    }
}
```
