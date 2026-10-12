export const LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

// One cell per day: column is the week, row is the weekday (0 = Sunday, top).
export function toCells(calendar) {
  return calendar.weeks.flatMap((week, col) =>
    week.contributionDays.map((day) => ({
      col,
      row: day.weekday,
      level: LEVELS[day.contributionLevel] ?? 0,
      count: day.contributionCount,
      date: day.date,
    })),
  );
}

// Plays the stage: the ship sweeps left to right and, in each column, shoots the
// lowest enemy still alive until the column is clear. Each contribution level is
// one hit point. Times are in seconds from the start of a loop.
export function buildTimeline(cells, { fire, colsPerSecond, travel, endPause, respawn }) {
  const columns = new Map();
  for (const cell of cells) {
    if (cell.level === 0) continue;
    if (!columns.has(cell.col)) columns.set(cell.col, []);
    columns.get(cell.col).push(cell);
  }
  const order = [...columns.keys()].sort((a, b) => a - b);
  const start = order[0] ?? 0;

  const ship = [{ t: 0, col: start }];
  const shots = [];
  const hits = new Map(cells.map((cell) => [cell, []]));
  const kills = [];
  let t = 0.6;
  let col = start;
  let lastHit = 0;

  for (const target of order) {
    const dt = Math.abs(target - col) / colsPerSecond;
    if (dt > 0) {
      ship.push({ t, col });
      t += dt;
      ship.push({ t, col: target });
    }
    col = target;

    const enemies = columns.get(target).sort((a, b) => b.row - a.row);
    for (const enemy of enemies) {
      for (let hp = enemy.level; hp > 0; hp--) {
        const hitAt = t + travel(enemy.row);
        shots.push({ t, col: target, row: enemy.row });
        hits.get(enemy).push({ t: hitAt, level: hp - 1 });
        if (hp === 1) kills.push({ t: hitAt, col: target, row: enemy.row });
        lastHit = Math.max(lastHit, hitAt);
        t += fire;
      }
    }
  }

  const end = Math.max(t, lastHit) + endPause;
  const duration = end + respawn;
  ship.push({ t: end, col }, { t: duration, col: start });

  return { duration, ship, shots, hits, kills, respawnAt: end };
}
