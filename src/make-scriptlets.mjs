#!/usr/bin/env node
// Builds the two Kindle "book" scriptlets in kindle/documents/, each with its own cover.
//   node src/make-scriptlets.mjs
import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { avatarSVG } from './avatar.mjs';
import { decideOutfit } from './outfit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'kindle', 'documents');
const TMP = join(ROOT, 'dist', 'covers');
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
const CHROME = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(existsSync);

const base = { tmin: 0, tmax: 0, rainProb: 0, rainMm: 0, rainFrom: null, snow: false, wind: 10, sunny: false, uv: 1, isDay: 1 };
const books = [
  {
    file: 'weatherboard-start.sh', name: 'Start Weatherboard', label: 'START', sub: 'dashboard',
    outfit: decideOutfit({ ...base, feels: 7, rainProb: 80, rainMm: 2, rainFrom: '14:00' }, 0),
    body: `# Takes over the screen and refreshes the forecast every 30 minutes.
# Tap once: fresh forecast now. Double-tap or plug in USB: the Kindle restarts to its home screen (~1 min).
/bin/sh /mnt/us/weatherboard/bin/start.sh`,
  },
  {
    file: 'weatherboard-once.sh', name: 'Weather once', label: 'ONCE', sub: 'quick look',
    outfit: decideOutfit({ ...base, feels: 21, sunny: true, uv: 3 }, 1),
    body: `# Draws the latest forecast over the normal Kindle UI, once.
/bin/sh /mnt/us/weatherboard/bin/once.sh`,
  },
];

for (const b of books) {
  const html = `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&display=block" rel="stylesheet"></head>
<body style="margin:0;width:300px;height:400px;background:#fff;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;align-items:center;overflow:hidden">
<div style="width:300px;height:300px">${avatarSVG(b.outfit).replace('<svg ', '<svg width="300" height="300" ')}</div>
<div style="margin-top:4px;background:#000;color:#fff;font-size:54px;font-weight:700;letter-spacing:6px;padding:2px 22px;border-radius:12px">${b.label}</div>
</body></html>`;
  const h = join(TMP, `${b.label}.html`), png = join(TMP, `${b.label}.png`), small = join(TMP, `${b.label}-small.png`);
  writeFileSync(h, html);
  execFileSync(CHROME, ['--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=300,400', '--virtual-time-budget=5000', `--screenshot=${png}`, `file://${h}`], { stdio: 'ignore' });
  execFileSync('sips', ['-Z', '200', '-s', 'format', 'png', png, '--out', small], { stdio: 'ignore' });
  const icon = readFileSync(small).toString('base64');
  writeFileSync(join(OUT, b.file), `#!/bin/sh\n# Name: ${b.name}\n# Author: Weatherboard\n# Icon: data:image/png;base64,${icon}\n${b.body}\n`);
  console.log(`${b.file}: "${b.name}" (${Math.round(icon.length / 1024)} KB icon) -> ${small}`);
}
