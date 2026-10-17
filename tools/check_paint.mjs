// Paint coverage check: loads the game in headless Chromium, visits several spots
// and fails if any visible surface is missing the painted look.
// Usage: node tools/check_paint.mjs   (needs a static server on :8123)
// What it checks:
//  1. every visible mesh material is painted (src/brushwork.js) or carries a
//     documented userData.noPaint exemption;
//  2. every painted tile in src/swatches.js has stroke contrast information;
//  3. no page errors.
import { chromium } from 'playwright';
const SPOTS = (process.env.SPOTS || 'start,city,market,walk1,walk2,fountain,palace,hall,library,music,westbridge,eastbridge,reef,kelp,trench,tunnel,bay,shipwreck,shellhouse,castlehouse,pirate,skull,grotto,paradise,treecity,sky').split(',');
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let failed = false;
await page.goto(`http://127.0.0.1:8123/index.html?shot=${SPOTS[0]}&q=low`, { timeout: 180000 });
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
const tiles = await page.evaluate(async () => {
  const { SWATCHES } = await import('./src/swatches.js');
  return Object.entries(SWATCHES).map(([k, v]) => ({ k, ok: Array.isArray(v.avg) && typeof v.std === 'number' }));
});
for (const t of tiles) if (!t.ok) { failed = true; console.log(`✗ tile ${t.k}: missing avg/std, rerun tools/make_swatches.py`); }
for (const spot of SPOTS) {
  await page.goto(`http://127.0.0.1:8123/index.html?shot=${spot}&q=low`, { timeout: 180000 });
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const bad = await page.evaluate(() => window.__game.Brushwork.unpainted(window.__game.scene));
  if (bad.length) {
    failed = true;
    console.log(`✗ ${spot}: ${bad.length} unpainted material(s)`);
    for (const b of bad.slice(0, 20)) console.log(`    ${b.material} at ${b.path}`);
  } else console.log(`✓ ${spot}: every visible surface painted`);
}
if (errors.length) { failed = true; console.log('✗ page errors:\n  ' + errors.join('\n  ')); }
await browser.close();
console.log(failed ? '\nPAINT CHECK FAILED' : '\nPAINT CHECK PASSED');
process.exit(failed ? 1 : 0);
