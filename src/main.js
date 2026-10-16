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
import { UI, Save } from './ui.js';
import { Post } from './post.js';
import { PaintProjection } from './projection.js';
import { Brushwork } from './brushwork.js';
import { PAINT_VIEWS } from './paintviews.js';
import { setLang, getLang } from './i18n.js';
import { initAudio, setSound, sfx } from './audio.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
if (SHOT) document.body.classList.add('shot');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!SHOT });
renderer.outputColorSpace = THREE.SRGBColorSpace;

const save = new Save();
const settings = save.settings;
setLang(settings.lang);

// Pick a starting quality from the device; it can still drop at runtime.
if (!['high', 'medium', 'low'].includes(settings.quality)) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
  settings.quality = mobile ? 'medium' : 'high';
}
if (SHOT) settings.quality = params.get('q') || 'high';
const QUALITY = {
  high: { ratio: 1.5, scale: 1, dof: 4, paint: 1 },
  medium: { ratio: 1.5, scale: 1, dof: 3, paint: 1 },
  low: { ratio: 1, scale: 1, dof: 0, paint: 0 },
};

const scene = new THREE.Scene();
const FOG_SHALLOW = new THREE.Color(0x2a8fbf), FOG_DEEP = new THREE.Color(0x0c3566);
scene.fog = new THREE.FogExp2(FOG_SHALLOW.clone(), 0.0045);
scene.background = FOG_SHALLOW.clone();

const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1200);

const hemi = new THREE.HemisphereLight(0xc8f6ff, 0x5a6aa8, 3.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 3.2);
sun.position.set(30, 100, 20);
scene.add(sun);

const world = buildWorld(scene, settings.quality);
const city = buildCity(scene);
// Paintings projected back onto the world from the cameras they were painted from.
const brush = new Brushwork();
brush.applyTo(world.group);
brush.applyTo(city.group);
const projection = new PaintProjection(renderer, scene, PAINT_VIEWS);
projection.applyTo(world.group);
projection.applyTo(city.group);
projection.load();
const creatures = spawnCreatures(scene);
const player = new Player(scene, camera);
const controls = new Controls(canvas);
const ui = new UI();
ui.settings = settings;
ui.getFriends = () => save.state.friends;
const story = new Story(scene, { player, city, creatures, ui, save });
ui.onBubbleOk = () => story.advanceDialog();
player.splashCb = (p) => { sfx('splash'); story.bursts.emit(new THREE.Vector3(p.x, WORLD.surfaceY, p.z), 20, 'spark', 0xffffff, 6); };

const post = new Post(renderer);
function applyQuality() {
  const q = QUALITY[settings.quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio));
  post.scale = q.scale;
  post.mat.uniforms.uDof.value = q.dof;
  post.mat.uniforms.uPaint.value = settings.paint ? q.paint * 0.5 : 0;
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
    else obj = thumbModel(kind);
    ts.add(obj);
    obj.rotation.y = kind === 'mermaid' || kind === 'guard' ? 0.35 : -0.9;
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
$('optLang').onclick = () => { settings.lang = getLang() === 'en' ? 'fr' : 'en'; setLang(settings.lang); save.write(); ui.renderMenu(); ui.applyTitle(); story.refreshQuest(); };
$('optQuality').onclick = () => { settings.quality = { high: 'medium', medium: 'low', low: 'high' }[settings.quality]; settings.qualityManual = true; applyQuality(); save.write(); ui.renderMenu(); };
$('optReset').onclick = () => save.reset();
ui.applyTitle();
setSound(settings.sound);

let playing = false;
$('btnStart').addEventListener('click', () => {
  initAudio();
  setSound(settings.sound);
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  playing = true;
  try { if (screen.orientation?.lock && /Android/i.test(navigator.userAgent)) document.documentElement.requestFullscreen?.().then(() => screen.orientation.lock('landscape')).catch(() => {}); } catch { /* not supported */ }
});

// ---------- screenshot presets (used by tools/shoot.mjs) ----------
const SHOTS = {
  city: { p: [6, 14, -60], yaw: Math.PI + 0.1, pitch: 0.05, dist: 9 },
  reef: { p: [WORLD.reefPos.x - 6, groundHeight(WORLD.reefPos.x - 6, WORLD.reefPos.z + 10) + 4, WORLD.reefPos.z + 10], yaw: Math.PI * 0.85, pitch: -0.18, dist: 7 },
  kelp: { p: [WORLD.kelpPos.x + 8, 10, WORLD.kelpPos.z + 5], yaw: -Math.PI * 0.6, pitch: 0.15, dist: 7 },
  trench: { p: [WORLD.trenchPos.x - 10, groundHeight(WORLD.trenchPos.x - 10, WORLD.trenchPos.z - 30) + 6, WORLD.trenchPos.z - 30], yaw: 0.2, pitch: -0.35, dist: 8 },
  mermaid: { p: [10, 18, 40], yaw: Math.PI * 0.75, pitch: 0.0, dist: 4.2, swim: true },
  palace: { p: [0, 7, -110], yaw: Math.PI, pitch: 0.18, dist: 7 },
  face: { p: [10, 18, 40], yaw: Math.PI * 0.75, pitch: 0.05, dist: 3.6, face: true },
  city2: { p: [-10, 11, -72], yaw: Math.PI - 0.35, pitch: 0.1, dist: 9 },
  reef2: { p: [WORLD.reefPos.x + 4, groundHeight(WORLD.reefPos.x + 4, WORLD.reefPos.z + 16) + 5, WORLD.reefPos.z + 16], yaw: Math.PI * 1.0, pitch: -0.15, dist: 7 },
  citytop: { p: [12, 26, -112], yaw: Math.PI + 0.2, pitch: -0.3, dist: 9 },
  start: { p: [WORLD.start.x, WORLD.start.y, WORLD.start.z], yaw: Math.PI, pitch: -0.12, dist: 7 },
};
let shotFrames = 0;
// clean=1 hides everything that moves: the 'plain blocks' plate that gets painted over
const CLEAN = params.get('clean') === '1';
if (SHOT) {
  const s = SHOTS[SHOT] || SHOTS.city;
  player.position.set(...s.p);
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
const shotControls = { consumeLook: () => ({ dx: 0, dy: 0 }), move: { x: 0, y: 0 }, vertical: 0, dragging: false, consumeAction: () => false, poll() {} };

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  elapsed += dt;
  shared.uTime.value = elapsed;

  const ctl = SHOT ? shotControls : controls;
  ctl.poll();
  if (SHOT && SHOTS[SHOT]?.swim) { player.velocity.set(Math.sin(player.facing) * 6, 0.5, Math.cos(player.facing) * 6); }
  player.update(dt, playing || SHOT ? ctl : shotControls, !playing && !SHOT);
  if (SHOT && SHOTS[SHOT]?.swim) player.position.set(...SHOTS[SHOT].p);
  world.update(dt, elapsed, camera);
  creatures.update(dt, elapsed, player);
  if (playing) story.update(dt, elapsed, controls);
  else story.update(dt, elapsed, shotControls);

  // deeper = darker, bluer water
  const depthY = THREE.MathUtils.clamp((WORLD.surfaceY - camera.position.y) / 85, 0, 1);
  fogC.copy(FOG_SHALLOW).lerp(FOG_DEEP, depthY);
  scene.fog.color.copy(fogC);
  scene.fog.density = 0.004 + depthY * 0.004;
  hemi.intensity = 3.5 - depthY * 1.4;

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
  if (SHOT && ++shotFrames === 40) window.__shotReady = true;
  requestAnimationFrame(frame);
}

makeThumbs();
projection.bakeDepth([world.group, city.group]);
// creatures, mermaids and friends: painted strokes that travel with them
scene.children.forEach((o) => { if (o !== world.group && o !== city.group) brush.applyTo(o, true); });
document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(frame);
window.__game = { player, story, camera, settings };
