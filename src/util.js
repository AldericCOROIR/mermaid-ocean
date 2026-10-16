// Small helpers: seeded random, value noise, terrain height.
import * as THREE from 'three';

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(20261016);
export const rr = (a, b) => a + (b - a) * rand();
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t) { return t * t * (3 - 2 * t); }
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, fx), THREE.MathUtils.lerp(c, d, fx), fy);
}
export function fbm(x, y, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return v;
}

// World layout constants shared across modules.
export const WORLD = {
  size: 520,          // seabed width/depth
  surfaceY: 60,       // water surface height
  cityPos: new THREE.Vector3(0, 0, -150),
  kelpPos: new THREE.Vector3(-130, 0, 20),
  reefPos: new THREE.Vector3(110, 0, 40),
  trenchPos: new THREE.Vector3(60, 0, 170),
  whalePath: { center: new THREE.Vector3(30, 34, 60), radius: 120 },
  start: new THREE.Vector3(0, 30, 70),
};

// Seabed height. Flat-ish plaza around the city, dunes elsewhere,
// a deep glowing trench in the south-east, rim mountains at the edge.
export function groundHeight(x, z) {
  let h = fbm(x * 0.012, z * 0.012, 5) * 22 - 8;
  h += Math.sin(x * 0.05) * Math.cos(z * 0.043) * 2.5;
  const r = Math.hypot(x, z);
  h += THREE.MathUtils.smoothstep(r, 170, 260) * 55; // rim mountains
  const dc = Math.hypot(x - WORLD.cityPos.x, z - WORLD.cityPos.z);
  const plaza = 1 - THREE.MathUtils.smoothstep(dc, 110, 130);
  h = THREE.MathUtils.lerp(h, -2, plaza);
  const dt = Math.hypot((x - WORLD.trenchPos.x) * 0.7, z - WORLD.trenchPos.z);
  h -= (1 - THREE.MathUtils.smoothstep(dt, 10, 55)) * 26;
  return h;
}

export function damp(a, b, lambda, dt) { return THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt)); }

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft round sprite used for bubbles, glows, sparkles.
let _glow;
export function glowTexture() {
  if (_glow) return _glow;
  _glow = canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  return _glow;
}

let _bubble;
export function bubbleTexture() {
  if (_bubble) return _bubble;
  _bubble = canvasTexture(64, 64, (g, w) => {
    const c = w / 2;
    const grd = g.createRadialGradient(c, c, c * 0.55, c, c, c * 0.95);
    grd.addColorStop(0, 'rgba(255,255,255,0.05)');
    grd.addColorStop(0.8, 'rgba(220,250,255,0.7)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(c - 10, c - 11, 7, 4, -0.7, 0, Math.PI * 2); g.fill();
  });
  return _bubble;
}
