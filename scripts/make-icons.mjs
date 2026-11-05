// Renders the pixel kitty (shared/sprite.js) onto a pink tile and writes icons/icon{16,32,48,128}.png.
// Usage: node scripts/make-icons.mjs   (needs the `playwright` package)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kittyMarkup } from '../shared/sprite.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// The sprite is 39 x 29 pixels. 128px icons use 3x, 48px icons 1x, smaller ones scale down.
const tile = (size) => {
  const scale = size >= 128 ? 3 : size >= 48 ? 1 : size / 48;
  const w = 39 * scale;
  const h = 29 * scale;
  const n = Math.max(1, Math.round(size / 16)); // pixel-notched corners
  const pts = [[n, 0], [size - n, 0], [size - n, n], [size, n], [size, size - n], [size - n, size - n], [size - n, size], [n, size], [n, size - n], [0, size - n], [0, n], [n, n]]
    .map((p) => p.join(',')).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
  <style>.k-eyes-blink,.k-eyes-happy,.k-eyes-sleepy,.k-fx{display:none}</style>
  <polygon points="${pts}" fill="#ffe6ee"/>
  <svg x="${(size - w) / 2}" y="${(size - h) / 2 + size * 0.03}" width="${w}" height="${h}" viewBox="0 0 39 29">${kittyMarkup()}</svg>
</svg>`;
};

const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:transparent">${tile(size)}</body>`);
  await page.screenshot({ path: path.join(root, 'icons', `icon${size}.png`), omitBackground: true });
  await page.close();
}
await browser.close();
console.log('icons written');
