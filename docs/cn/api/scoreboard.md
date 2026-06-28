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

## 为什么这样设计

Fand 把 `ScoreboardService` 和 `PlayerScoreboard` 分开，是为了明确“真实 vanilla scoreboard 状态”和“某个玩家看到的覆盖显示”。全局 objective/team 适合排行榜、队伍、nameplate 这类共享状态；per-player override 适合任务进度、个人 HUD 和观战视角。

`clearDisplayedObjective` 和 `resetDisplayedObjective` 的区别故意保留：clear 表示“这个玩家这里就是空”，继续覆盖全局；reset 表示“取消覆盖，回到全局显示”。这能避免个人 HUD 关闭后误把全服 sidebar 也清掉。

registration close 带 token 语义，旧句柄不会删掉后来同名注册的新对象。这样插件重载、模块重建时更不容易误删别人的新状态。

## 最佳实践

- objective/team 名称短小、稳定，并带插件前缀，例如 `example_points`。
- 更新 sidebar 时复用 objective，只更新变化的 score 和 display name。
- 使用 team 控制 nameplate 前缀、颜色、碰撞和可见性，不要用 packet 手写常规队伍效果。
- 给个人 HUD 使用 `player.scoreboard()`，给全服排行使用 `context.scoreboard()`。
- 玩家离开、小游戏结束或 UI 关闭时，主动 reset 个人 display override。
- 不要把高频变化的长文本塞进大量 score owner；owner 名称仍然是 vanilla scoreboard 的一部分。

## 常见坑

- `clearDisplayedObjective(slot)` 会继续覆盖全局显示为空；想恢复全局要用 `resetDisplayedObjective(slot)`。
- `score(owner)` 会创建或返回 score 入口；只想判断是否存在用 `existingScore(owner)`。
- 全局 scoreboard 是共享状态，一个插件改 display slot 会影响所有看到全局显示的玩家。
- team member 是字符串；玩家便捷方法使用玩家名，实体便捷方法使用 UUID 字符串。
- 每 tick 重建 objective/team 会造成不必要的客户端刷新和服务端开销。

## 综合示例：个人任务 Sidebar 和队伍前缀

下面的例子给单个玩家显示个人任务进度，同时用全局 team 给管理员加 nameplate 前缀。

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
