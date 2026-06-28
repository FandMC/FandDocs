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

## Guidelines

- Keep objective/team names short and stable to avoid conflicts.
- Prefix plugin-owned objectives and teams with the plugin id, such as `example_points`.
- For frequently updated sidebars, update only changed scores instead of rebuilding every tick.
- Per-player display fits quest progress, personal HUDs, and spectator information; global rankings fit persistent objectives.
