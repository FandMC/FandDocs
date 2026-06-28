# 记分板

`ScoreboardService` 操作持久 vanilla scoreboard：objective、score、display slot 和 team。玩家对象还提供 `PlayerScoreboard`，用于控制单个玩家看到的 objective/team/display override。

> [!IMPORTANT]
> `PlayerScoreboard` 是 per-player 展示覆盖，不是另一个持久 vanilla scoreboard。需要全服共享的 objective/team 放在 `context.scoreboard()`；需要不同玩家看到不同 sidebar/list/below-name 时使用 `player.scoreboard()`。

## 注册 Objective

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

`ScoreboardRegistration.close()` 只移除它安装的 objective/team；如果同名对象后来被重新注册，旧句柄关闭时不能删除新对象。

## 分数

```java
var score = objective.score(player.name());
score.setValue(score.value() + 1);
score.setDisplayName(Component.text("Player " + player.name()));

objective.resetScore(player.name());
```

`score(owner)` 会返回该 owner 在 objective 下的 score 入口；`existingScore(owner)` 只查询已经存在的分数。

## Display Slot

```java
context.scoreboard().setDisplayedObjective(ScoreDisplaySlot.SIDEBAR, objective);
context.scoreboard().clearDisplayedObjective(ScoreDisplaySlot.SIDEBAR);
```

常用 slot：

```text
LIST
SIDEBAR
BELOW_NAME
TEAM_RED / TEAM_BLUE / ...
```

## Team 和 Nameplate

Team 适合控制 nameplate 前后缀、颜色、碰撞和可见性。

```java
import net.kyori.adventure.text.format.NamedTextColor;

context.scoreboard().registerTeam("example_admin");
var team = context.scoreboard().team("example_admin").orElseThrow();

team.setPrefix(Component.text("[Admin] "));
team.setColor(NamedTextColor.RED);
team.addPlayer(player);
```

成员可以是玩家名，也可以是实体 UUID 字符串。`addPlayer` 和 `addEntity` 是便捷方法。

## Per-Player Scoreboard

`PlayerScoreboard` 可以给某个玩家注册只对他展示的 objective/team，并覆盖 display slot。

```java
var personal = player.scoreboard();
personal.registerObjective("quest", Component.text("Quest"));

var quest = personal.objective("quest").orElseThrow();
quest.score("progress").setValue(3);
personal.setDisplayedObjective(ScoreDisplaySlot.SIDEBAR, quest);
```

需要回到全局显示时：

```java
personal.resetDisplayedObjective(ScoreDisplaySlot.SIDEBAR);
personal.resetDisplayedObjectives();
```

`clearDisplayedObjective(slot)` / `clearDisplayedObjectives()` 会把对应个人显示槽清空，并继续覆盖全局显示；`resetDisplayedObjective(slot)` / `resetDisplayedObjectives()` 才会取消个人覆盖并恢复全局显示。

## 使用建议

- objective/team 名称保持短小稳定，避免和其它插件冲突。
- 插件自己的 objective/team 用插件 id 前缀，例如 `example_points`。
- 频繁更新 sidebar 时只更新变化的 score，避免每 tick 重建整块记分板。
- per-player 展示适合任务进度、个人 HUD、观战信息；全服排行适合持久 objective。
