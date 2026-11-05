// Renders icons/kitty.svg onto a pink tile and exports the toolbar / store PNG sizes.
// Usage: node scripts/make-icons.js   (needs the `playwright` package available)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const kitty = fs.readFileSync(path.join(root, 'icons', 'kitty.svg'), 'utf8')
  .replace(/<svg[^>]*>/, '<svg x="6" y="30" width="116" height="85" viewBox="-6 0 232 170" fill="none">');

const tile = (size, thick) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe3ec"/><stop offset="1" stop-color="#ffb3c8"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="34" fill="url(#bg)"/>
  ${thick ? kitty.replace(/stroke-width="4"/g, 'stroke-width="6"') : kitty}
</svg>`;

(async () => {
  const browser = await chromium.launch();
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<body style="margin:0;background:transparent">${tile(size, size <= 32)}</body>`);
    await page.screenshot({ path: path.join(root, 'icons', `icon${size}.png`), omitBackground: true });
    await page.close();
  }
  await browser.close();
  console.log('icons written');
})();
