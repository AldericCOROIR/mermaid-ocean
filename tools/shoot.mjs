// Render screenshots of the game with headless Chromium.
// Usage: node tools/shoot.mjs [outDir] [shot names...]
// Needs a static server on :8123 (python3 -m http.server 8123).
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const out = process.argv[2] || 'shots';
const names = process.argv.slice(3).length ? process.argv.slice(3) : ['city', 'reef', 'kelp', 'trench', 'mermaid', 'palace'];
const extra = process.env.SHOT_QS || '';
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const [vw, vh] = (process.env.VIEW || '1280,720').split(',').map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const cams = {};
for (const n of names) {
  await page.goto(`http://127.0.0.1:8123/index.html?shot=${n}${extra}`, { timeout: 180000 });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
  await page.screenshot({ path: `${out}/${n}.png`, timeout: 240000 });
  cams[n] = await page.evaluate(() => { const c = window.__game.camera; return { p: c.position.toArray(), q: c.quaternion.toArray(), fov: c.fov, aspect: c.aspect }; });
  if (n === 'overview') console.log('active projection', await page.evaluate(() => window.__game.projection.projectors.filter(p => p.uniforms.on.value).map(p => p.name)));
  console.log('saved', n);
}
writeFileSync(`${out}/cams.json`, JSON.stringify(cams, null, 1));
await browser.close();
