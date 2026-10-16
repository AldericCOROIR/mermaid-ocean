// Dump the exact camera of each screenshot preset (used to project paintings back).
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const names = ['city', 'reef', 'kelp', 'trench', 'palace'];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const out = {};
for (const n of names) {
  await page.goto(`http://127.0.0.1:8123/index.html?shot=${n}`);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
  out[n] = await page.evaluate(() => { const c = window.__game.camera; return { p: c.position.toArray(), q: c.quaternion.toArray(), fov: c.fov, aspect: c.aspect }; });
  console.log(n, JSON.stringify(out[n]));
}
writeFileSync('tools/cams.json', JSON.stringify(out, null, 1));
await browser.close();
