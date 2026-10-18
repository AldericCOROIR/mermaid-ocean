import { chromium } from 'playwright';

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, locale: 'fr-FR' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 250)); });
await page.goto('http://127.0.0.1:8123/index.html', { timeout: 180000 });
console.log('online page loaded');
await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
console.log('game initialized');
await page.locator('#btnStart').click({ force: true });
console.log('game started');
await page.locator('#btnMenu').click({ force: true });
await page.locator('#optOffline').click({ force: true });
await page.waitForFunction(() => document.getElementById('offlineStatus').textContent.includes('sans internet'), null, { timeout: 300000 });
console.log('offline download button confirmed complete');
const offlineCache = await page.evaluate(async () => {
  const key = (await caches.keys()).find(k => k.startsWith('mermaid-'));
  return key ? (await (await caches.open(key)).keys()).length : 0;
});
if (offlineCache < 1600) throw new Error(`Only ${offlineCache} offline files cached`);
const micHidden = await page.locator('#btnMic').isHidden();
await context.setOffline(true);
console.log('network disabled');
await page.reload({ timeout: 180000 });
console.log('offline page loaded');
await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
await page.locator('#btnStart').click({ force: true });
await page.locator('#btnMenu').click({ force: true });
await page.locator('#optOffline').click({ force: true });
await page.waitForFunction(() => !document.getElementById('optOffline').disabled && document.getElementById('offlineStatus').textContent.includes('sans internet'), null, { timeout: 300000 });
console.log('offline cache verified again without network');
const offlineClip = await page.evaluate(async () => {
  const { VOICE_INDEX } = await import('./src/voice-index.js');
  const paths = Object.values(VOICE_INDEX);
  const path = paths.find(p => p.includes('/queen/'));
  const islandPath = paths.find(p => p.includes('/polly/'));
  const r = await fetch(path);
  const island = await fetch(islandPath);
  return { ok: r.ok && island.ok, size: (await r.arrayBuffer()).byteLength,
    islandSize: (await island.arrayBuffer()).byteLength, voices: new Set(paths.map(p => p.split('/')[4])).size };
});
const { stageBefore, stageAfter } = await page.evaluate(() => {
  const { story } = window.__game;
  const stageBefore = story.stage;
  story.talk(story.npcs.find(n => n.id === 'queen'));
  return { stageBefore, stageAfter: story.stage };
});
const fallback = await page.evaluate(async () => {
  const { initAudio, say } = await import('./src/audio.js');
  const original = window.Audio;
  window.Audio = class { constructor() { throw new Error('MP3 unavailable'); } };
  try { initAudio(); say('Bonjour, petite sirène.', 'queen'); return true; }
  finally { window.Audio = original; }
});
console.log(JSON.stringify({ micHidden, offlineCache, offlineClip, stageBefore, stageAfter, fallback, errors }));
await browser.close();
if (!micHidden || !offlineClip.ok || offlineClip.size < 1000 || offlineClip.islandSize < 1000 || offlineClip.voices < 60 || stageAfter !== 'pearls' || !fallback || errors.length) process.exit(1);
