// Pixel-art sprites, built from code. Every "pixel" is one unit in an SVG viewBox,
// drawn with crisp edges, so the art stays sharp at any scale.

export const PALETTE = {
  K: '#ae937a', // soft taupe outline
  W: '#ffffff',
  P: '#ffd3e0', // inner ear
  B: '#ffbdd1', // blush
  N: '#9b7557', // eyes
  n: '#dcc6b1', // eye shine
  Y: '#ffdc52', // nose
  R: '#ffc3da', // bow (light pink)
  r: '#ff9fc3', // bow knot
  E: '#ff9db9', // heart
  L: '#ffd96a', // star
  Z: '#a99be0', // zzz
};

/* ---------- tiny grid toolkit ---------- */

const newGrid = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Boolean mask from a test run at every pixel centre. */
function mask(w, h, test) {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => test(x + 0.5, y + 0.5)));
}

const union = (...ms) => ms[0].map((row, y) => row.map((_, x) => ms.some((m) => m[y][x])));

/** Fill a mask and draw a one-pixel outline just outside it. */
function stamp(grid, m, fill, outline) {
  const h = m.length;
  const w = m[0].length;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y][x] && fill) grid[y][x] = fill;
  if (!outline) return;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (m[y][x]) continue;
      if (m[y - 1]?.[x] || m[y + 1]?.[x] || m[y][x - 1] || m[y][x + 1]) grid[y][x] = outline;
    }
  }
}

function put(grid, color, pts) {
  for (const [x, y] of pts) if (grid[y]?.[x] !== undefined) grid[y][x] = color;
}

const mirrorX = (w) => (x) => w - 1 - x;

/** Turn a grid into SVG <path> markup, merging horizontal runs per colour. */
export function gridToSvg(grid, { dx = 0, dy = 0, palette = PALETTE, fillOverride } = {}) {
  const paths = {};
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (!c) { x++; continue; }
      let n = 1;
      while (row[x + n] === c) n++;
      (paths[c] ??= []).push(`M${x + dx} ${y + dy}h${n}v1h-${n}z`);
      x += n;
    }
  });
  return Object.entries(paths)
    .map(([c, d]) => `<path fill="${fillOverride ?? palette[c] ?? c}" d="${d.join('')}"/>`)
    .join('');
}

/** Parse a picture drawn with characters. '.' is empty. */
export function fromRows(rows) {
  return rows.map((r) => [...r].map((c) => (c === '.' ? null : c)));
}

/* ---------- the kitty ---------- */

export const KITTY = { w: 40, h: 30, viewBox: '-1 -7 42 37' };

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

function buildLayers() {
  const { w, h } = KITTY;
  const mxe = (c) => 36 - c; // mirror the face features
  const mxw = (c) => 38 - c; // mirror the whiskers

  // right ear: a tall triangle that continues the side of the head
  const earPoly = [[25.4, 8], [30.6, 1.4], [33, 1.4], [35.4, 6], [35.4, 9]];
  const ear = newGrid(w, h);
  stamp(ear, mask(w, h, (x, y) => inPoly(x, y, earPoly)), 'W', 'K');

  // left ear: the same shape mirrored; the bow sits on top of it
  const earL = newGrid(w, h);
  const flipped = earPoly.map(([x, y]) => [38.9 - x, y]);
  stamp(earL, mask(w, h, (x, y) => inPoly(x, y, flipped)), 'W', 'K');

  // wide head with soft rounded corners
  const head = newGrid(w, h);
  stamp(head, mask(w, h, (x, y) => inRoundRect(x, y, 3.5, 5.6, 35.4, 27.6, 7)), 'W', 'K');

  // whiskers, cheeks and a tiny nose
  const face = newGrid(w, h);
  const whisk = [[0, 18], [1, 18], [1, 21], [2, 21], [2, 24], [3, 24]];
  put(face, 'K', whisk);
  put(face, 'K', whisk.map(([x, y]) => [mxw(x), y]));
  for (const x of [8, 9, 10]) for (const y of [22, 23]) { face[y][x] = 'B'; face[y][mxe(x)] = 'B'; }
  for (const x of [17, 18, 19]) face[21][x] = 'Y';

  // eyes
  const eyeShapes = {
    open: [[9, 17], [10, 17], [11, 17], [9, 18], [10, 18], [11, 18], [9, 19], [10, 19], [11, 19], [9, 20], [10, 20], [11, 20]],
    blink: [[8, 20], [9, 20], [10, 20], [11, 20], [12, 20]],
    happy: [[10, 18], [9, 19], [11, 19], [8, 20], [12, 20]],
    sleepy: [[8, 18], [12, 18], [9, 19], [11, 19], [10, 20]],
  };
  const eyes = {};
  for (const [name, pts] of Object.entries(eyeShapes)) {
    const l = newGrid(w, h);
    const r = newGrid(w, h);
    put(l, 'N', pts);
    put(r, 'N', pts.map(([x, y]) => [mxe(x), y]));
    if (name === 'open') {
      put(l, 'n', [[9, 17]]);
      put(r, 'n', [[mxe(11), 17]]);
    }
    eyes[name] = { l, r };
  }

  // a big diagonal bow over the left ear
  const bow = newGrid(w, h);
  const loops = union(
    mask(w, h, (x, y) => inPoly(x, y, [[10, 8.2], [2.8, 7.2], [2.2, 14.4], [8.8, 15.6]])),
    mask(w, h, (x, y) => inPoly(x, y, [[11, 6.4], [12.2, 1.2], [20.4, 1.2], [21, 6.2]])),
  );
  stamp(bow, loops, 'R', 'K');
  const knot = mask(w, h, (x, y) => x > 8.6 && x < 12.4 && y > 5.8 && y < 9.6);
  stamp(bow, knot, 'r', 'K');
  put(bow, 'W', [[4, 9], [5, 9], [4, 10], [14, 3], [15, 3], [14, 4]]);

  return { ear, earL, head, face, eyes, bow };
}

const HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
const STAR = ['..X..', '..X..', 'XXXXX', '..X..', '..X..'];
const Z = ['XXX', '..X', '.X.', 'X..', 'XXX'];

function sprite(rows, color, dx, dy) {
  const g = rows.map((r) => [...r].map((c) => (c === 'X' ? color : null)));
  return gridToSvg(g, { dx, dy });
}

/** Full kitty markup (the caller puts it inside an <svg viewBox=KITTY.viewBox>). */
export function kittyMarkup() {
  const { ear, earL, head, face, eyes, bow } = buildLayers();
  const eyeGroup = (name) =>
    `<g class="k-eyes k-eyes-${name}"><g class="k-look">${gridToSvg(eyes[name].l)}${gridToSvg(eyes[name].r)}</g></g>`;

  return `
<g class="k-wrap">
  <g class="k-body">
    <g class="k-ear k-ear-l">${gridToSvg(earL)}</g>
    <g class="k-ear k-ear-r">${gridToSvg(ear)}</g>
    <g class="k-head">${gridToSvg(head)}</g>
    <g class="k-face">${gridToSvg(face)}</g>
    ${['open', 'blink', 'happy', 'sleepy'].map(eyeGroup).join('')}
    <g class="k-bow">${gridToSvg(bow)}</g>
  </g>
  <g class="k-fx">
    <g class="k-heart k-heart-1">${sprite(HEART, PALETTE.E, 8, -3)}</g>
    <g class="k-heart k-heart-2">${sprite(HEART, PALETTE.E, 17, -3)}</g>
    <g class="k-heart k-heart-3">${sprite(HEART, PALETTE.E, 26, -3)}</g>
    <g class="k-z k-z-1">${sprite(Z, PALETTE.Z, 37, -1)}</g>
    <g class="k-z k-z-2">${sprite(Z, PALETTE.Z, 38, -6)}</g>
    <g class="k-spark k-spark-1">${sprite(STAR, PALETTE.L, -1, 4)}</g>
    <g class="k-spark k-spark-2">${sprite(STAR, PALETTE.L, 36, 11)}</g>
    <g class="k-spark k-spark-3">${sprite(STAR, PALETTE.L, 0, 25)}</g>
  </g>
</g>`;
}

/** Two front paws that rest on the top edge of the card. */
export const PAWS = { w: 40, h: 5, viewBox: '0 0 40 5' };
export function pawsMarkup() {
  const paw = fromRows(['..KKKK..', '.KWWWWK.', 'KWWKWKWK', 'KWWWWWWK', '.KKKKKK.']);
  return `<g class="paw paw-l">${gridToSvg(paw, { dx: 6 })}</g><g class="paw paw-r">${gridToSvg(paw, { dx: 26 })}</g>`;
}

/* ---------- small icons (use currentColor) ---------- */

export const ICONS = {
  gear: ['....X....', '.X..X..X.', '..XXXXX..', '.XX...XX.', 'XXX...XXX', '.XX...XX.', '..XXXXX..', '.X..X..X.', '....X....'],
  back: ['...XX', '..XX.', '.XX..', 'XX...', '.XX..', '..XX.', '...XX'],
  reset: ['X...X', 'X..XX', 'X.XXX', 'XXXXX', 'X.XXX', 'X..XX', 'X...X'],
  play: ['XX.....', 'XXXX...', 'XXXXXX.', 'XXXXXXX', 'XXXXXX.', 'XXXX...', 'XX.....'],
  pause: ['XXX..XXX', 'XXX..XXX', 'XXX..XXX', 'XXX..XXX', 'XXX..XXX', 'XXX..XXX', 'XXX..XXX'],
  heart: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
};

/** An icon as an SVG string drawn in currentColor. */
export function iconSvg(name, cls = '', scale = 2) {
  const rows = ICONS[name];
  const g = rows.map((r) => [...r].map((c) => (c === 'X' ? 'X' : null)));
  const body = gridToSvg(g, { fillOverride: 'currentColor' });
  return `<svg class="${cls}" width="${rows[0].length * scale}" height="${rows.length * scale}" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}

export function brandBowSvg(cls = '') {
  const rows = fromRows([
    '..KKKK..KKKK..',
    '.KRRRRKKRRRRK.',
    'KRRERRrrRRERRK',
    'KRRRRRrrRRRRRK',
    '.KRRRRKKRRRRK.',
    '..KKKK..KKKK..',
  ]);
  return `<svg class="${cls}" width="42" height="18" viewBox="0 0 14 6" shape-rendering="crispEdges" aria-hidden="true">${gridToSvg(rows)}</svg>`;
}

/* ---------- pixel digits (a 5x7 font, so numbers stay crisp and readable) ---------- */

const DIGITS = {
  0: ['.XXX.', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', '.XXX.'],
  1: ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
  2: ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  3: ['.XXX.', 'X...X', '....X', '..XX.', '....X', 'X...X', '.XXX.'],
  4: ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  5: ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  6: ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  7: ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  8: ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  9: ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XX..'],
  ':': ['..', 'XX', 'XX', '..', 'XX', 'XX', '..'],
};

/** Digits and colons as crisp pixel art, drawn in currentColor. */
export function digitsSvg(text, scale = 2, cls = '') {
  let x = 0;
  let body = '';
  for (const ch of String(text)) {
    const rows = DIGITS[ch];
    if (!rows) continue;
    const g = rows.map((r) => [...r].map((c) => (c === 'X' ? 'X' : null)));
    body += gridToSvg(g, { dx: x, fillOverride: 'currentColor' });
    x += rows[0].length + 1;
  }
  const w = Math.max(1, x - 1);
  return `<svg class="${cls}" width="${w * scale}" height="${7 * scale}" viewBox="0 0 ${w} 7" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}
