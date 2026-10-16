// Verify that the rebuilt castle can be reached through its real openings.
// Run with the static server on :8123; CHROME_PATH may point to system Chrome.
import { chromium } from 'playwright';

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:8123/index.html?fresh=1', { timeout: 180000 });
await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
const routes = await page.evaluate(async () => {
  const THREE = await import('three');
  const { collide } = await import('./src/world.js');
  const { WORLD, groundHeight } = await import('./src/util.js');
  const { city } = window.__game;
  const C = WORLD.cityPos;
  const y = groundHeight(C.x, C.z) + 4.5;
  const minX = -90, minZ = -86, step = 2, nx = 91, nz = 91;
  const key = (ix, iz) => iz * nx + ix;
  const pass = (ix, iz) => {
    const x = minX + ix * step, z = minZ + iz * step;
    const p = new THREE.Vector3(C.x + x, y, C.z + z);
    collide(p, 1);
    return Math.hypot(p.x - C.x - x, p.z - C.z - z) < 0.05;
  };
  const visited = new Int32Array(nx * nz).fill(-1);
  const sx = Math.round((0 - minX) / step), sz = Math.round((88 - minZ) / step);
  const queue = [key(sx, sz)];
  visited[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head], x = u % nx, z = Math.floor(u / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || xx >= nx || zz < 0 || zz >= nz) continue;
      const v = key(xx, zz);
      if (visited[v] !== -1 || !pass(xx, zz)) continue;
      visited[v] = visited[u] + 1;
      queue.push(v);
    }
  }
  const targets = {
    courtyard: [0, 48], fountain: [13, 30], queen: [0, -48], library: [-36, -31],
    music: [36, -31], garden: [56, -32], westMarket: [-39, 40],
  };
  const result = {};
  for (const [name, [x, z]] of Object.entries(targets)) {
    const ix = Math.round((x - minX) / step), iz = Math.round((z - minZ) / step);
    result[name] = visited[key(ix, iz)] < 0 ? null : visited[key(ix, iz)] * step;
  }
  result.queenPosition = city?.spots?.queen?.toArray();
  return result;
});
console.log(JSON.stringify({ routes, errors }, null, 2));
await browser.close();
if (errors.length || Object.entries(routes).some(([k, v]) => k !== 'queenPosition' && v === null)) {
  process.exitCode = 1;
}
