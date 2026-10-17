import * as THREE from 'three';
import { WORLD, groundHeight } from './util.js';
import { shared } from './geom.js';
import { buildWorld } from './world.js';
import { buildCity } from './city.js';
import { spawnCreatures, thumbModel } from './creatures.js';
import { MerModel, PALETTES } from './mermaid.js';
import { Player } from './player.js';
import { Controls } from './controls.js';
import { Story, ALBUM } from './quests.js';
import { Follower } from './follower.js';
import { buildBay } from './bay.js';
import { buildSurface } from './surface.js';
import { buildPirateIsland } from './pirateisland.js';
import { buildParadiseIsland } from './paradiseisland.js';
import { LAND_KINDS } from './landfolk.js';
import { UI, Save } from './ui.js';
import { Post } from './post.js';
import { PaintProjection } from './projection.js';
import { Brushwork } from './brushwork.js';
import { PAINT_VIEWS } from './paintviews.js';
import { setLang, getLang, t } from './i18n.js';
import { initAudio, setSound, setVoiceMode, sfx } from './audio.js';
import { VoiceInput } from './voice-input.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const COMPARE = params.get('compare') === '1';
if (SHOT) document.body.classList.add('shot');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!SHOT });
renderer.outputColorSpace = THREE.SRGBColorSpace;

const save = new Save();
const settings = save.settings;
setLang(settings.lang);
setVoiceMode(settings.voiceMode);

// Pick a starting quality from the device; it can still drop at runtime.
if (!['high', 'medium', 'low'].includes(settings.quality)) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
  settings.quality = mobile ? 'medium' : 'high';
}
if (SHOT) settings.quality = params.get('q') || 'high';
const QUALITY = {
  // Beautiful = sharpest picture (more pixels, only a soft blur far away); Smooth trades pixels for speed.
  high: { ratio: 2, scale: 1, dof: 1.2, paint: 1 },
  medium: { ratio: 1.25, scale: 1, dof: 1.2, paint: 1 },
  low: { ratio: 1, scale: 1, dof: 0, paint: 0 },
};

const scene = new THREE.Scene();
const FOG_SHALLOW = new THREE.Color(0x2a8fbf), FOG_DEEP = new THREE.Color(0x0c3566);
scene.fog = new THREE.FogExp2(FOG_SHALLOW.clone(), 0.0045);
scene.background = FOG_SHALLOW.clone();

const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1200);

const hemi = new THREE.HemisphereLight(0xc8f6ff, 0x5a6aa8, 2.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.15);
sun.position.set(30, 100, 20);
scene.add(sun);

const world = buildWorld(scene, settings.quality);
const city = buildCity(scene);
// Paintings projected back onto the world from the cameras they were painted from.
const brush = new Brushwork();
brush.applyTo(world.group);
brush.applyTo(city.group);
const projection = new PaintProjection(renderer, scene, PAINT_VIEWS);
projection.applyTo(world.group, 'world');
projection.applyTo(city.group, 'castle');
projection.load();
const creatures = spawnCreatures(scene);
// the secret tunnel, Shipwreck Bay and the shell houses
const bay = buildBay(scene, creatures);
brush.applyTo(bay.group);
// above the waves: the open sea, the sky and the islands
const surface = buildSurface(scene);
const player = new Player(scene, camera);
player.houses = bay.houses;
player.surface = surface;
const islands = { pirate: buildPirateIsland(scene), paradise: buildParadiseIsland(scene) };
for (const is of Object.values(islands)) { surface.add(is); brush.applyTo(is.group); }
surface.setAbove(false);
const underwaterOnly = world.group.children.filter((o) => o.userData.sky || o.userData.surface || o.isPoints);
const controls = new Controls(canvas);
const ui = new UI();
ui.settings = settings;
ui.getFriends = () => save.state.friends;
const story = new Story(scene, { player, city, creatures, ui, save, bay, islands });
const voiceInput = new VoiceInput(story, ui);
const follower = new Follower(scene, player);
if (save.state.follower && save.state.friends.includes(save.state.follower)) follower.set(save.state.follower);
ui.getFollower = () => follower.kind;
ui.onFollow = (kind) => {
  const off = follower.kind === kind;
  follower.set(off ? null : kind);
  save.state.follower = follower.kind; save.write();
  ui.toast(t(off ? 'unfollow' : 'follow', { name: t('names.' + kind) }));
};
ui.onBubbleOk = () => story.dialog ? story.advanceDialog() : ui.bubble(null);
ui.onTrack = (id) => story.track(id);
ui.onFindGiver = () => story.findGiver();
ui.getWardrobe = () => ({ unlocked: save.state.unlocked, outfit: save.state.outfit });
ui.onWardrobeSelect = (category, item) => {
  if (!['tail', 'top', 'head', 'hair', 'hairColor'].includes(category) || !save.state.unlocked.includes(item)) return;
  save.state.outfit[category] = item;
  player.model.setOutfit(save.state.outfit);
  save.write(); ui.renderWardrobe();
};
let wardrobeReturn = null;
ui.onWardrobeOpen = () => {
  wardrobeReturn = player.position.clone();
  player.velocity.set(0, 0, 0);
  player.position.set(0, 24, 105);
};
ui.onWardrobeClose = () => {
  if (wardrobeReturn) player.position.copy(wardrobeReturn);
  wardrobeReturn = null;
  player.snapCamera();
};
player.flyCb = (on) => { if (on && !save.state.flown) { save.state.flown = true; save.write(); ui.toast(t('flyStart')); } };
player.splashCb = (p) => { sfx('splash'); story.bursts.emit(new THREE.Vector3(p.x, WORLD.surfaceY, p.z), 20, 'spark', 0xffffff, 6); };

const post = new Post(renderer);
function applyQuality() {
  const q = QUALITY[settings.quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio));
  post.scale = q.scale;
  post.mat.uniforms.uDof.value = q.dof;
  post.mat.uniforms.uPaint.value = settings.paint ? q.paint * 0.5 : 0;
  if (COMPARE) { post.mat.uniforms.uDof.value = 0; post.mat.uniforms.uPaint.value = 0; }
  brush.amount.value = settings.paint && params.get('brush') !== '0' && params.get('clean') !== '1' ? 1 : 0;
  projection.amount.value = settings.paint && params.get('proj') !== '0' && params.get('clean') !== '1' ? 1 : 0;
  post.enabled = settings.quality !== 'low' || settings.paint;
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 88 : 66; // portrait phones see a little more
  camera.updateProjectionMatrix();
  post.setSize(w, h, renderer.getPixelRatio());
}
window.addEventListener('resize', resize);
applyQuality();

// ---------- album thumbnails: render each friend once, offscreen ----------
function makeThumbs() {
  const size = 128;
  const rt = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace });
  const ts = new THREE.Scene();
  ts.add(new THREE.HemisphereLight(0xffffff, 0x6080c0, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(2, 3, 4); ts.add(dl);
  const tc = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const buf = new Uint8Array(size * size * 4);
  const c2 = document.createElement('canvas'); c2.width = c2.height = size;
  const g2 = c2.getContext('2d');
  const img = g2.createImageData(size, size);
  for (const kind of ALBUM) {
    let obj;
    if (kind === 'mermaid' || kind === 'guard') { const m = new MerModel(kind === 'guard' ? PALETTES.guard : PALETTES.player); m.update(0.016, 0, 0); obj = m.root; }
    else obj = LAND_KINDS[kind]?.() ?? thumbModel(kind);
    ts.add(obj);
    obj.rotation.y = kind === 'mermaid' || kind === 'guard' ? 0.35 : -0.9;
    if (kind === 'starfish' || kind === 'otter') obj.rotation.x = 0.9;
    const box = new THREE.Box3().setFromObject(obj);
    const sph = box.getBoundingSphere(new THREE.Sphere());
    tc.position.copy(sph.center).add(new THREE.Vector3(0, sph.radius * 0.25, sph.radius * 3.0));
    tc.lookAt(sph.center);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(ts, tc);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    g2.putImageData(img, 0, 0);
    ui.thumbs[kind] = c2.toDataURL();
    ts.remove(obj);
  }
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, 1);
  rt.dispose();
}

// ---------- settings menu ----------
const $ = (id) => document.getElementById(id);
$('optPaint').onclick = () => { settings.paint = !settings.paint; applyQuality(); save.write(); ui.renderMenu(); };
$('optSound').onclick = () => { settings.sound = !settings.sound; setSound(settings.sound); save.write(); ui.renderMenu(); };
$('optVoiceMode').onclick = () => {
  settings.voiceMode = settings.voiceMode === 'characters' ? 'device' : 'characters';
  setVoiceMode(settings.voiceMode);
  save.write(); ui.renderMenu();
  ui.toast(t(settings.voiceMode === 'characters' ? 'voiceCharacters' : 'voiceDevice'));
};
$('optLang').onclick = () => { settings.lang = getLang() === 'en' ? 'fr' : 'en'; setLang(settings.lang); save.write(); ui.renderMenu(); ui.applyTitle(); story.refreshQuest(); };
$('optQuality').onclick = () => { settings.quality = { high: 'medium', medium: 'low', low: 'high' }[settings.quality]; settings.qualityManual = true; applyQuality(); save.write(); ui.renderMenu(); };
$('optReset').onclick = () => save.reset();
ui.applyTitle();
setSound(settings.sound);

let playing = false;
$('btnStart').addEventListener('click', () => {
  initAudio();
  void voiceInput.init();
  setSound(settings.sound);
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  playing = true;
  try { if (screen.orientation?.lock && /Android/i.test(navigator.userAgent)) document.documentElement.requestFullscreen?.().then(() => screen.orientation.lock('landscape')).catch(() => {}); } catch { /* not supported */ }
});

// ---------- screenshot presets (used by tools/shoot.mjs) ----------
const SHOTS = {
  city: { p: [0, 14, -39], yaw: Math.PI, pitch: -0.08, dist: 8 },
  market: { p: [0, 12, -55], yaw: Math.PI, pitch: -0.17, dist: 7 },
  fountain: { p: [0, 13, -122], yaw: Math.PI, pitch: -0.08, dist: 7 },
  westbridge: { p: [-54, 18, -109], yaw: Math.PI * 1.18, pitch: -0.12, dist: 7 },
  eastbridge: { p: [54, 18, -109], yaw: Math.PI * 0.82, pitch: -0.12, dist: 7 },
  reef: { p: [WORLD.reefPos.x - 6, groundHeight(WORLD.reefPos.x - 6, WORLD.reefPos.z + 10) + 4, WORLD.reefPos.z + 10], yaw: Math.PI * 0.85, pitch: -0.18, dist: 7 },
  kelp: { p: [WORLD.kelpPos.x + 8, 10, WORLD.kelpPos.z + 5], yaw: -Math.PI * 0.6, pitch: 0.15, dist: 7 },
  trench: { p: [WORLD.trenchPos.x - 10, groundHeight(WORLD.trenchPos.x - 10, WORLD.trenchPos.z - 30) + 6, WORLD.trenchPos.z - 30], yaw: 0.2, pitch: -0.35, dist: 8 },
  mermaid: { p: [10, 18, 40], yaw: Math.PI * 0.75, pitch: 0.0, dist: 4.2, swim: true },
  palace: { p: [0, 16, -147], yaw: Math.PI, pitch: 0.08, dist: 7 },
  court: { p: [0, 9, -115], yaw: Math.PI, pitch: 0.05, dist: 7 },
  hall: { p: [0, 14, -205], yaw: Math.PI, pitch: 0.04, dist: 6 },
  library: { p: [-36, 14, -206], yaw: Math.PI, pitch: 0.03, dist: 5 },
  music: { p: [36, 14, -206], yaw: Math.PI, pitch: 0.03, dist: 5 },
  face: { p: [10, 18, 40], yaw: Math.PI * 0.75, pitch: 0.05, dist: 3.6, face: true },
  city2: { p: [-10, 11, -72], yaw: Math.PI - 0.35, pitch: 0.1, dist: 9 },
  reef2: { p: [WORLD.reefPos.x + 4, groundHeight(WORLD.reefPos.x + 4, WORLD.reefPos.z + 16) + 5, WORLD.reefPos.z + 16], yaw: Math.PI * 1.0, pitch: -0.15, dist: 7 },
  citytop: { p: [12, 26, -112], yaw: Math.PI + 0.2, pitch: -0.3, dist: 9 },
  walk1: { p: [-14, 6, -62], yaw: Math.PI * 0.72, pitch: -0.05, dist: 6 },
  walk2: { p: [18, 7, -95], yaw: Math.PI * 1.35, pitch: -0.05, dist: 6 },
  overview: { p: [0, 8, -75], yaw: Math.PI, pitch: -0.25, dist: 8 },
  start: { p: [WORLD.start.x, WORLD.start.y, WORLD.start.z], yaw: Math.PI, pitch: -0.12, dist: 7 },
  tunnelmouth: { p: [60, 2, 160], yaw: 0, pitch: -0.05, dist: 8 },
  tunnel: { p: [56, -8, 232], yaw: -0.25, pitch: 0, dist: 5 },
  bay: { p: [62, 6, 362], yaw: 0.2, pitch: -0.12, dist: 8 },
  shipwreck: { p: [70, 6, 405], yaw: 0.9, pitch: -0.15, dist: 9 },
  shellhouse: { p: [36, 4, 422], yaw: -2.24, pitch: -0.08, dist: 8 },
  castlehouse: { p: [-24, 4, -156], yaw: -Math.PI / 2, pitch: -0.08, dist: 8 },
  // above the waves, in the bubble
  pirate: { p: islands.pirate.spots.landing.toArray(), yaw: -Math.PI / 2, pitch: -0.1, dist: 9, fly: true },
  skull: { p: [-555, 95, -70], yaw: Math.PI, pitch: 0.12, dist: 12, fly: true },
  grotto: { p: [-562, 80, -148], yaw: Math.PI, pitch: -0.1, dist: 7, fly: true },
  paradise: { p: islands.paradise.spots.landing.toArray(), yaw: Math.PI / 2, pitch: -0.1, dist: 9, fly: true },
  treecity: { p: [465, 115, 60], yaw: Math.PI / 2, pitch: 0.05, dist: 10, fly: true },
  sky: { p: [-330, 150, -60], yaw: -Math.PI / 2, pitch: -0.3, dist: 12, fly: true },
};
let shotFrames = 0, shotReadyFrames = 0, paintSweep = 0;
// clean=1 hides everything that moves: the 'plain blocks' plate that gets painted over
const CLEAN = params.get('clean') === '1';
if (SHOT) {
  const s = SHOTS[SHOT] || SHOTS.city;
  player.position.set(...s.p);
  if (s.fly) player.flying = true;
  player.yaw = s.yaw; player.pitch = s.pitch; player.dist = s.dist;
  player.facing = s.yaw + (s.face ? Math.PI - 0.35 : s.swim ? 1.2 : 0.4);
  player.snapCamera();
  if (params.get('paint') === '0') post.mat.uniforms.uPaint.value = 0;
  if (params.get('dof') === '0') post.mat.uniforms.uDof.value = 0;
  if (params.get('raw') === '1') post.enabled = false; // plain render, no grade or blur
}

function hideMovers() {
  const keep = new Set([world.group, city.group]);
  scene.children.forEach((o) => { if (!keep.has(o) && !o.isLight) o.visible = false; });
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let elapsed = 0, perfAcc = 0, perfN = 0, perfT = 0;
const fogC = new THREE.Color();
const FOG_TUNNEL = new THREE.Color(0x6a4a9a), FOG_AIR = new THREE.Color(0xcfeeff);
let tunnelMix = 0;
const shotControls = { consumeLook: () => ({ dx: 0, dy: 0 }), move: { x: 0, y: 0 }, vertical: 0, dragging: false, consumeAction: () => false, poll() {} };

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  elapsed += dt;
  shared.uTime.value = elapsed;

  const ctl = SHOT || ui.wardrobeOpen ? shotControls : controls;
  ctl.poll();
  if (SHOT && SHOTS[SHOT]?.swim) { player.velocity.set(Math.sin(player.facing) * 6, 0.5, Math.cos(player.facing) * 6); }
  player.update(dt, playing || SHOT ? ctl : shotControls, ui.wardrobeOpen || (!playing && !SHOT));
  if (ui.wardrobeOpen) {
    player.model.root.rotation.x = 0;
    player.model.root.rotation.y = 0;
    player.model.update(dt, 0, 0);
    const portrait = innerWidth < innerHeight;
    const distance = portrait ? 5.2 : 3.2;
    camera.position.copy(player.position).add(new THREE.Vector3(0, portrait ? 0 : 0.8, distance));
    camera.lookAt(player.position.x, player.position.y + (portrait ? -1.8 : 0.45), player.position.z);
    player.focusDist = distance;
  }
  if (SHOT && SHOTS[SHOT]?.swim) player.position.set(...SHOTS[SHOT].p);
  if (SHOT === 'overview') {
    camera.position.set(0, 155, -7);
    camera.lookAt(WORLD.cityPos.x, 8, WORLD.cityPos.z);
    camera.fov = 61;
    camera.updateProjectionMatrix();
    world.group.traverse((o) => { if (o.userData.surface) o.visible = false; });
  }
  world.update(dt, elapsed, camera);
  city.update(dt, elapsed);
  creatures.update(dt, elapsed, player);
  if (!ui.wardrobeOpen) story.update(dt, elapsed, playing ? controls : shotControls);
  if (playing) voiceInput.update();
  follower.update(dt);

  // deeper = darker, bluer water; above the waves: sunshine and sky
  const above = camera.position.y > WORLD.surfaceY;
  surface.setAbove(above);
  for (const o of underwaterOnly) o.visible = !above;
  surface.update(dt, elapsed);
  const depthY = THREE.MathUtils.clamp((WORLD.surfaceY - camera.position.y) / 85, 0, 1);
  fogC.copy(above ? FOG_AIR : FOG_SHALLOW).lerp(FOG_DEEP, depthY);
  scene.fog.color.copy(fogC);
  scene.fog.density = above ? 0.0011 : 0.002 + depthY * 0.0025;
  sun.intensity = above ? 2.7 : 2.15;
  if (SHOT === 'overview') scene.fog.density = 0.001;
  if (COMPARE) scene.fog.density = 0.0008;
  hemi.intensity = above ? 2.3 : 2.15 - depthY * 0.55;
  // the flower tunnel glows a soft magical violet
  tunnelMix = THREE.MathUtils.damp(tunnelMix, player.inTunnel ? 1 : 0, 3, dt);
  if (tunnelMix > 0.001) {
    scene.fog.color.lerp(FOG_TUNNEL, tunnelMix);
    scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, 0.012, tunnelMix);
    hemi.intensity = THREE.MathUtils.lerp(hemi.intensity, 2.3, tunnelMix);
  }

  projection.updateActive(camera.position);
  if (performance.now() - paintSweep > 1000) { paintSweep = performance.now(); brush.sweep(scene, [world.group, city.group]); } // paint anything new
  post.render(scene, camera, player.focusDist, depthY, elapsed);

  // adaptive quality: step down if the phone struggles
  if (playing && !settings.qualityManual) {
    perfAcc += dt; perfN++; perfT += dt;
    if (perfT > 4) {
      const avg = perfAcc / perfN;
      if (avg > 1 / 38 && settings.quality !== 'low') { settings.quality = settings.quality === 'high' ? 'medium' : 'low'; applyQuality(); }
      perfAcc = perfN = perfT = 0;
    }
  }

  if (CLEAN) hideMovers();
  if (SHOT) {
    shotFrames++;
    shotReadyFrames = projection.projectors.every((pr) => pr.ready.tex && pr.ready.depth) ? shotReadyFrames + 1 : 0;
    if (shotFrames >= 40 && shotReadyFrames >= 5) window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

makeThumbs();
projection.bakeDepth([world.group, city.group]);
// creatures, mermaids and friends: painted strokes that travel with them
scene.children.forEach((o) => { if (o !== world.group && o !== city.group) brush.applyTo(o, true); });
document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(frame);
window.__game = { bay, surface, islands, player, story, follower, ui, camera, settings, city, projection, scene, Brushwork };
