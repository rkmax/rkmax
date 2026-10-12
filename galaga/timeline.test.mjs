import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTimeline, toCells } from "./timeline.mjs";

const TIMING = { fire: 0.1, colsPerSecond: 10, travel: (row) => 0.3 - row * 0.02, endPause: 1, respawn: 1 };

const day = (weekday, level) => ({
  date: `2026-01-0${weekday + 1}`,
  weekday,
  contributionCount: level * 3,
  contributionLevel: ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"][level],
});

const calendar = {
  weeks: [
    { contributionDays: [day(0, 4), day(1, 0), day(2, 2), day(3, 1), day(4, 0), day(5, 3), day(6, 1)] },
    { contributionDays: [day(0, 0), day(1, 0), day(2, 0), day(3, 0), day(4, 0), day(5, 0), day(6, 0)] },
    { contributionDays: [day(0, 1), day(1, 0), day(2, 0)] },
  ],
};

test("every day with contributions is destroyed after as many hits as its level", () => {
  const cells = toCells(calendar);
  const { hits, kills, duration } = buildTimeline(cells, TIMING);

  for (const cell of cells) {
    const received = hits.get(cell);
    assert.equal(received.length, cell.level, `hits on ${cell.date} col ${cell.col}`);
    if (cell.level > 0) assert.equal(received.at(-1).level, 0);
  }
  assert.equal(kills.length, cells.filter((cell) => cell.level > 0).length);
  assert.ok(kills.every((kill) => kill.t < duration));
});

test("a bullet never reaches an enemy while a lower one in its column is alive", () => {
  const cells = toCells(calendar);
  const { hits } = buildTimeline(cells, TIMING);

  for (const cell of cells.filter((c) => c.level > 0)) {
    const firstHit = hits.get(cell)[0].t;
    const below = cells.filter((c) => c.col === cell.col && c.row > cell.row && c.level > 0);
    for (const lower of below) assert.ok(hits.get(lower).at(-1).t < firstHit);
  }
});
