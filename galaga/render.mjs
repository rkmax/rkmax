import { buildTimeline, toCells } from "./timeline.mjs";

export const PALETTES = {
  light: {
    cells: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
    flash: "#ffffff",
    text: "#24292f",
    label: "#cf222e",
    star: "#8c959f",
    ship: { W: "#24292f", R: "#cf222e", B: "#0969da" },
    bullet: "#cf222e",
    boom: "#bf8700",
  },
  dark: {
    cells: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
    flash: "#ffffff",
    text: "#e6edf3",
    label: "#f85149",
    star: "#8b949e",
    ship: { W: "#e6edf3", R: "#f85149", B: "#58a6ff" },
    bullet: "#f2cc60",
    boom: "#f0883e",
  },
};

const CELL = 10;
const PITCH = 13;
const PAD = 16;
const GRID_TOP = 44;
const SHIP_GAP = 48;
const PIXEL = 1.6;
const BULLET = { w: 2, h: 6, speed: 420 };
const TIMING = { fire: 0.085, colsPerSecond: 14, endPause: 1.2, respawn: 1.8 };

// Galaga-style fighter; W body, R cockpit and wings, B wing tips.
const SHIP = [
  "......W......",
  "......W......",
  ".....WWW.....",
  ".....WWW.....",
  "..R..WWW..R..",
  "..R.WWWWW.R..",
  "B.W.WWRWW.W.B",
  "B.WWWRRRWWW.B",
  "WWWWWRWRWWWWW",
  "WWW.WWWWW.WWW",
  "WW...WWW...WW",
  "W.....W.....W",
];

const num = (n) => Number(n.toFixed(2));

export function renderSvg(calendar, { user, theme }) {
  const palette = PALETTES[theme];
  const cells = toCells(calendar);
  const cols = calendar.weeks.length;
  const width = PAD * 2 + cols * PITCH - (PITCH - CELL);
  const gridBottom = GRID_TOP + 7 * PITCH - (PITCH - CELL);
  const shipTop = gridBottom + SHIP_GAP;
  const shipW = SHIP[0].length * PIXEL;
  const shipH = SHIP.length * PIXEL;
  const height = num(shipTop + shipH + 12);

  const cx = (col) => PAD + col * PITCH + CELL / 2;
  const cellY = (row) => GRID_TOP + row * PITCH;
  const bulletTop = shipTop - BULLET.h;
  const distance = (row) => bulletTop - (cellY(row) + CELL);

  const timeline = buildTimeline(cells, {
    ...TIMING,
    travel: (row) => distance(row) / BULLET.speed,
  });
  const D = timeline.duration;
  const pct = (t) => `${Math.min(100, Math.max(0, (t / D) * 100)).toFixed(3)}%`;
  const delay = (t) => `${num(t - D)}s`;
  const anim = (name) => `${name} ${num(D)}s linear infinite`;

  const css = [];
  const body = [];

  css.push(
    `text{font-family:'Courier New',monospace;font-weight:700;font-size:11px;letter-spacing:1px}`,
    `.b,.x{opacity:0}`,
    `.x{transform-box:fill-box;transform-origin:center;animation:${anim("boom")}}`,
    `@keyframes boom{0%{opacity:1;transform:scale(.4)}${pct(0.35)}{opacity:0;transform:scale(1.9)}100%{opacity:0}}`,
    `.s{animation:twinkle 3s ease-in-out infinite}`,
    `@keyframes twinkle{0%,100%{opacity:.15}50%{opacity:.8}}`,
  );

  for (const star of stars(user, width, height, 46)) {
    body.push(
      `<rect class="s" x="${star.x}" y="${star.y}" width="1.5" height="1.5" fill="${palette.star}" style="animation-delay:-${star.delay}s;animation-duration:${star.period}s"/>`,
    );
  }

  const total = cells.reduce((sum, cell) => sum + cell.count, 0);
  const best = cells.reduce((max, cell) => Math.max(max, cell.count), 0);
  const year = cells.at(-1)?.date.slice(0, 4) ?? "";
  body.push(
    hud(PAD, "start", "1UP", total, palette),
    hud(width / 2, "middle", "HIGH SCORE", best, palette),
    hud(width - PAD, "end", "STAGE", year, palette),
  );

  for (const [i, cell] of cells.entries()) {
    const x = PAD + cell.col * PITCH;
    const y = cellY(cell.row);
    const base = palette.cells[cell.level];
    if (cell.level === 0) {
      body.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${base}"/>`);
      continue;
    }
    const stops = [`0%{fill:${base}}`];
    let color = base;
    for (const hit of timeline.hits.get(cell)) {
      const next = palette.cells[hit.level];
      stops.push(
        `${pct(hit.t - 0.01)}{fill:${color}}`,
        `${pct(hit.t)}{fill:${palette.flash}}`,
        `${pct(hit.t + 0.06)}{fill:${next}}`,
      );
      color = next;
    }
    const back = timeline.respawnAt + (cell.col / cols) * TIMING.respawn * 0.6;
    stops.push(`${pct(back)}{fill:${color}}`, `${pct(back + 0.3)}{fill:${base}}`, `100%{fill:${base}}`);
    css.push(`.c${i}{animation:${anim(`c${i}`)}}@keyframes c${i}{${stops.join("")}}`);
    body.push(`<rect class="c${i}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${base}"/>`);
  }

  for (let row = 0; row < 7; row++) {
    const fly = pct(distance(row) / BULLET.speed);
    css.push(
      `.b${row}{animation:${anim(`b${row}`)}}`,
      `@keyframes b${row}{0%{opacity:1;transform:translateY(0)}${fly}{opacity:1;transform:translateY(-${num(distance(row))}px)}${pct(distance(row) / BULLET.speed + 0.001)}{opacity:0}100%{opacity:0}}`,
    );
  }
  for (const shot of timeline.shots) {
    body.push(
      `<rect class="b b${shot.row}" x="${num(cx(shot.col) - BULLET.w / 2)}" y="${num(bulletTop)}" width="${BULLET.w}" height="${BULLET.h}" fill="${palette.bullet}" style="animation-delay:${delay(shot.t)}"/>`,
    );
  }

  for (const kill of timeline.kills) {
    const x = cx(kill.col);
    const y = cellY(kill.row) + CELL / 2;
    body.push(
      `<g class="x" fill="${palette.boom}" style="animation-delay:${delay(kill.t)}">` +
        `<rect x="${x - 7}" y="${y - 1}" width="3" height="2"/><rect x="${x + 4}" y="${y - 1}" width="3" height="2"/>` +
        `<rect x="${x - 1}" y="${y - 7}" width="2" height="3"/><rect x="${x - 1}" y="${y + 4}" width="2" height="3"/>` +
        `<rect x="${x - 5}" y="${y - 5}" width="2" height="2"/><rect x="${x + 3}" y="${y + 3}" width="2" height="2"/>` +
        `<rect x="${x + 3}" y="${y - 5}" width="2" height="2"/><rect x="${x - 5}" y="${y + 3}" width="2" height="2"/>` +
        `</g>`,
    );
  }

  const shipX = (col) => num(cx(col) - shipW / 2);
  const shipStops = timeline.ship.map((stop) => `${pct(stop.t)}{transform:translateX(${shipX(stop.col)}px)}`);
  css.push(`.ship{animation:${anim("ship")}}@keyframes ship{${shipStops.join("")}}`);
  body.push(
    `<g class="ship" style="transform:translateX(${shipX(timeline.ship[0].col)}px)"><g transform="translate(0 ${num(shipTop)})">${shipPixels(palette.ship)}</g></g>`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${user}'s contributions in the last year, played as Galaga">`,
    `<style>${css.join("")}</style>`,
    ...body,
    `</svg>`,
    "",
  ].join("\n");
}

function hud(x, anchor, label, value, palette) {
  return (
    `<text x="${x}" y="14" text-anchor="${anchor}" fill="${palette.label}">${label}</text>` +
    `<text x="${x}" y="28" text-anchor="${anchor}" fill="${palette.text}">${value}</text>`
  );
}

function shipPixels(colors) {
  const rects = [];
  SHIP.forEach((line, y) => {
    for (const match of line.matchAll(/([A-Z])\1*/g)) {
      rects.push(
        `<rect x="${num(match.index * PIXEL)}" y="${num(y * PIXEL)}" width="${num(match[0].length * PIXEL)}" height="${PIXEL}" fill="${colors[match[1]]}"/>`,
      );
    }
  });
  return rects.join("");
}

// Deterministic per user, so regenerating with the same data yields the same file.
function stars(seed, width, height, count) {
  let state = [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  return Array.from({ length: count }, () => ({
    x: num(random() * width),
    y: num(random() * height),
    period: num(2 + random() * 4),
    delay: num(random() * 6),
  }));
}
