import { chromium } from 'playwright';

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:8123/index.html', { timeout: 180000 });
await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
await page.locator('#btnStart').click({ force: true });
const beforeWardrobe = await page.evaluate(() => window.__game.player.position.toArray());
await page.locator('#btnWardrobe').click();
const wardrobeOpen = await page.locator('#wardrobe').isVisible();
await page.waitForFunction(() => window.__game.camera.position.distanceTo(window.__game.player.position) < 4, null, { timeout: 15000 });
const cameraToPlayer = await page.evaluate(() => window.__game.camera.position.distanceTo(window.__game.player.position));
await page.screenshot({ path: 'shots/revision/wardrobe-mobile.png' });
const locked = await page.locator('button[data-item="sapphire"]').isDisabled();
await page.locator('#wardrobeClose').click();
const wardrobeClosed = !await page.locator('#wardrobe').isVisible();
const returned = await page.evaluate((before) => window.__game.player.position.distanceTo({ x: before[0], y: before[1], z: before[2] }) < 0.1, beforeWardrobe);
const quest = await page.evaluate(() => {
  const { story, player, city } = window.__game;
  const t = story.npcs.find(n => n.id === 'tailor');
  player.position.copy(t.root.position);
  const first = story.talk(t);
  player.position.copy(city.spots.fountain);
  story.update(0.016, 1, { consumeAction: () => false });
  player.position.copy(t.root.position);
  const second = story.talk(t);
  return { first, second, status: story.state.sideQuests.tailor,
    unlocked: story.state.unlocked.includes('coralClip'), equipped: story.state.outfit.head };
});
await page.locator('#btnWardrobe').click();
const rewardEnabled = await page.locator('button[data-item="coralClip"]').isEnabled();
const projectors = await page.evaluate(() => window.__game.projection.projectors.map(p => ({ name: p.name, ready: p.ready, on: p.uniforms.on.value })));
const terrain = await page.evaluate(async () => {
  const { castleFloorHeight } = await import('./src/city.js');
  const { WORLD, groundHeight } = await import('./src/util.js');
  const C = WORLD.cityPos, base = groundHeight(C.x, C.z);
  return [castleFloorHeight(C.x, C.z + 36, base + 1),
    castleFloorHeight(C.x, C.z + 25, base + 4),
    castleFloorHeight(C.x, C.z + 8, base + 5),
    castleFloorHeight(C.x, C.z - 27.5, base + 8),
    castleFloorHeight(C.x, C.z - 48, base + 9)].map(v => Math.round((v - base) * 10) / 10);
});
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForFunction(() => window.__game.camera.position.distanceTo(window.__game.player.position) > 5);
await page.screenshot({ path: 'shots/revision/wardrobe-portrait.png' });
await page.reload({ timeout: 180000 });
await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
const persisted = await page.evaluate(() => ({
  status: window.__game.story.state.sideQuests.tailor,
  unlocked: window.__game.story.state.unlocked.includes('coralClip'),
  equipped: window.__game.story.state.outfit.head,
}));
console.log(JSON.stringify({ wardrobeOpen, cameraToPlayer, locked, wardrobeClosed, returned, quest, persisted,
  terrain,
  rewardEnabled, projectors, errors }, null, 2));
await browser.close();
if (!wardrobeOpen || !wardrobeClosed || !returned || !locked || !rewardEnabled || cameraToPlayer > 4 ||
  terrain[2] !== 4 || terrain[4] !== 8 || quest.status !== 'done' || persisted.status !== 'done' ||
  !persisted.unlocked || persisted.equipped !== 'coralClip' ||
  quest.equipped !== 'coralClip' || errors.length) process.exitCode = 1;
