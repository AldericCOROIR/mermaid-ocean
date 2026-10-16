// Render screenshots of the game with headless Chromium.
// Usage: node tools/shoot.mjs [outDir] [shot names...]
// Needs a static server on :8123 (python3 -m http.server 8123).
import { chromium } from 'playwright';
const out = process.argv[2] || 'shots';
const names = process.argv.slice(3).length ? process.argv.slice(3) : ['city', 'reef', 'kelp', 'trench', 'mermaid', 'palace'];
const extra = process.env.SHOT_QS || '';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const n of names) {
  await page.goto(`http://127.0.0.1:8123/index.html?shot=${n}${extra}`);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
  await page.screenshot({ path: `${out}/${n}.png` });
  console.log('saved', n);
}
await browser.close();
