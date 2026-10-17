// Paradise Island: a jungle island out on the open sea, east of the undersea map.
// White and pink beaches, a pink lagoon, a green peak with a rainbow waterfall
// falling into a lily pond, a flower meadow, mango and banana groves, and in the
// middle Treetop Town: a whole chibi city living in seven giant trees, with ring
// platforms, spiral stairs, rope bridges, a bakery, a building site, a sky garden
// and the town hall on top of the biggest tree.
// Everything is in local coordinates around C (the group sits at C.x, 0, C.z).
import * as THREE from 'three';
import { WORLD, fbm, noise2, mulberry32, glowTexture } from './util.js';
import { merge, mat, segment, lumpify, paintMat, inject } from './geom.js';
import { colliders } from './world.js';

const SEA = WORLD.surfaceY;
const C = new THREE.Vector3(560, SEA, 60);
const RADIUS = 172;
const rnd = mulberry32(5602026); // own stream: does not shift the rest of the world's layout
const rr = (a, b) => a + (b - a) * rnd();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = THREE.MathUtils.lerp;
const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const U = { uTime: { value: 0 } }; // island clock, driven by update()

// ---------- island layout (local x, z) ----------
const PEAK = { x: 30, z: -118 };
const POND = { x: 35, z: -78, r: 12, y: SEA + 8 };
const LAGOON = { x: 104, z: 98, r: 18, y: SEA + 1.1 };
const MEADOW = { x: -100, z: 55, r: 28 };
const MANGO = { x: -96, z: -76 };
const BANANA = { x: 118, z: 12 };
const GARDEN = { x: 6, z: -66 }; // Pavo's flower garden by the waterfall
const LAG_TH = Math.atan2(LAGOON.z, LAGOON.x), PEAK_TH = Math.atan2(PEAK.z, PEAK.x);
const RIVER = [[46, -76], [64, -71], [86, -66], [108, -62], [130, -58], [152, -55], [172, -52]];
const PATHS = [
  [[-128, 0], [-95, 8], [-50, 14], [0, 4]], [[0, 4], [18, -40], [30, -62]], [[0, 4], [48, 40], [86, 80]],
  [[40, -12], [80, 4], [112, 12]], [[-30, -20], [-70, -55], [-94, -72]], [[-50, 14], [-92, 48]], [[0, 4], [-4, 60]],
];

function bump(a, c, w) { const d = Math.atan2(Math.sin(a - c), Math.cos(a - c)); return Math.exp(-((d / w) ** 2)); }
function coastR(th) { return 148 + 9 * Math.sin(3 * th + 0.7) + 6 * Math.sin(5 * th + 2.1) + 3 * Math.sin(9 * th + 1) + 34 * bump(th, LAG_TH, 0.3) + 10 * bump(th, PEAK_TH, 0.25); }
function segDist(x, z, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return [Math.hypot(x - ax - vx * t, z - az - vz * t), t];
}
function pathDist(x, z, pts) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, z, ...pts[i], ...pts[i + 1])[0]); return d; }

// Terrain before the river is cut in: beaches, hills, flat city floor, meadow, peak, pond, lagoon.
function baseHeight(x, z) {
  const d = Math.hypot(x, z);
  if (d > 290) return SEA - 20;
  const s = d / coastR(Math.atan2(z, x));
  let h;
  if (s >= 1.15) h = lerp(SEA - 12, SEA - 20, ss(1.15, 1.4, s));
  else if (s >= 1) h = lerp(SEA + 0.3, SEA - 12, ss(1, 1.15, s));
  else if (s >= 0.88) h = lerp(SEA + 2.8, SEA + 0.3, (s - 0.88) / 0.12);
  else h = SEA + 2.8 + 4 * ss(0.88, 0.62, s);
  const inland = ss(0.92, 0.7, s);
  if (inland > 0) {
    h += inland * Math.max(0, fbm(x * 0.011 + 3, z * 0.011 - 7, 4) - 0.42) * 62;
    const dc = Math.hypot(x, (z - 6) / 1.08); // the giant trees stand on gently rolling ground
    h = lerp(h, SEA + 6.5 + (fbm(x * 0.03, z * 0.03, 2) - 0.5) * 2.5, ss(124, 96, dc) * 0.92 * inland);
    const dm = Math.hypot(x - MEADOW.x, z - MEADOW.z);
    h = lerp(h, SEA + 5.2 + Math.sin(x * 0.08) * Math.cos(z * 0.07) * 0.8, ss(MEADOW.r + 16, MEADOW.r - 6, dm) * 0.9 * inland);
  }
  // the green peak: steeper on its pond side, falls into the sea on the north
  const dz = z - PEAK.z;
  const dp = Math.hypot(x - PEAK.x, dz * (1 + 0.45 * ss(-10, 25, dz)));
  h += (64 * Math.pow(Math.max(0, 1 - dp / 52), 1.45) + 6 * Math.max(0, 1 - dp / 60) * fbm(x * 0.06, z * 0.06, 2)) * ss(1.08, 0.9, s);
  const dpo = Math.hypot(x - POND.x, z - POND.z);
  if (dpo < 30) { h = lerp(h, POND.y + 0.7, ss(24, 15, dpo)); h = lerp(h, POND.y - 1.8, ss(POND.r + 1.5, POND.r - 4, dpo)); }
  const dl = Math.hypot(x - LAGOON.x, z - LAGOON.z);
  if (dl < 50) { h = lerp(h, SEA + 2.1, ss(46, 28, dl)); h = lerp(h, SEA + 0.3, ss(LAGOON.r + 4, LAGOON.r - 4, dl)); }
  return h;
}
// River water level at each river point: falls from the pond to the sea, never uphill.
const RIVER_WL = RIVER.map(([x, z]) => baseHeight(x, z) - 0.8);
RIVER_WL[0] = POND.y - 0.2;
for (let i = 1; i < RIVER_WL.length; i++) RIVER_WL[i] = Math.max(SEA + 0.25, Math.min(RIVER_WL[i - 1] - 0.3, RIVER_WL[i]));
function riverAt(x, z) {
  if (x < 32 || x > 186 || z < -92 || z > -36) return null;
  let best = 1e9, wl = 0;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [d, t] = segDist(x, z, ...RIVER[i], ...RIVER[i + 1]);
    if (d < best) { best = d; wl = lerp(RIVER_WL[i], RIVER_WL[i + 1], t); }
  }
  return { d: best, wl };
}
function localHeight(x, z) {
  let h = baseHeight(x, z);
  const rv = riverAt(x, z);
  if (rv && rv.d < 8) h = Math.min(h, lerp(h, rv.wl - 1.1, ss(7.5, 2.5, rv.d)));
  return h;
}
// Walkable ground including the flat pond and lagoon water (the bubble floats on them).
function groundLocal(x, z) {
  let h = localHeight(x, z);
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2) h = Math.max(h, POND.y);
  if (Math.hypot(x - LAGOON.x, z - LAGOON.z) < LAGOON.r + 3) h = Math.max(h, LAGOON.y);
  return h;
}

// ---------- the giant trees of Treetop Town ----------
// rings: [height above ground, walkway width]; top: [height, radius] platform over the canopy;
// crown: [canopy centre height, canopy radius]; lift: angle of the basket lift to the top platform.
const TREES = [
  { name: 'hall', x: 0, z: 4, r: 10, h: 136, rings: [[20, 13], [44, 12], [68, 11], [90, 10]], top: [132, 16], crown: [116, 30], lift: Math.PI * 0.75 },
  { name: 'west', x: -78, z: -22, r: 7, h: 100, rings: [[17, 12], [40, 11], [62, 10]], crown: [84, 25] },
  { name: 'garden', x: 72, z: -30, r: 7.5, h: 100, rings: [[18, 12], [42, 11], [64, 10]], top: [98, 15], crown: [86, 26], lift: -Math.PI * 0.62 },
  { name: 'bakery', x: -55, z: 68, r: 6.5, h: 92, rings: [[14, 13], [36, 11], [57, 10]], crown: [78, 24] },
  { name: 'builders', x: 64, z: 62, r: 7, h: 95, rings: [[11, 14], [33, 11], [55, 10]], crown: [80, 25] },
  { name: 'south', x: -4, z: 92, r: 6, h: 86, rings: [[16, 12], [39, 11]], crown: [63, 23] },
  { name: 'north', x: -28, z: -78, r: 6, h: 88, rings: [[18, 12], [41, 11]], crown: [65, 23] },
];
const BRIDGES = [[0, 1, 1, 1], [0, 1, 2, 1], [0, 0, 3, 0], [0, 0, 4, 0], [0, 2, 1, 2], [0, 2, 2, 2], [0, 0, 5, 0],
  [0, 1, 6, 1], [1, 0, 6, 0], [3, 1, 5, 1], [2, 0, 4, 0], [1, 1, 3, 1], [4, 1, 5, 1, 'new']];
const trunkR = (t, y) => t.r * (1 + 0.55 * Math.exp(-Math.max(0, y) / 4)) * (1 - 0.3 * Math.max(0, y) / t.h);

const WOOD = 0xc4895a, WOOD2 = 0xa9724a, WOODL = 0xe2b47e, ROPE = 0xe9d4a2, BARK = 0x9a6a48;
const WALLS = [0xfff1d6, 0xffd9e6, 0xd9f0ff, 0xe4ffd6, 0xfff5b0, 0xefdcff, 0xffe2c4];
const MUSH = [0xff5a6a, 0xff8a3d, 0xc86bff, 0x3fbfff, 0xff6fae];
const LEAFROOF = [0x4fcf5a, 0x8ee04a, 0x2fbf8a, 0x6ad66a];
const PETAL = [0xff7ab8, 0xffb35c, 0xb58cff, 0xff6f91, 0x6fd8ff, 0xffe066];
const RAINBOW = [0xff5d73, 0xff9d4d, 0xffe066, 0x7ee06a, 0x5cc8ff, 0xa98bff, 0xff8fd8];
const FLOWERS = [0xff7ab8, 0xffb35c, 0xffe66b, 0xb58cff, 0x6fe8ff, 0xff8f8f, 0xffffff, 0xf7a1ff];

// ---------- small geometry helpers ----------
const _v = new THREE.Vector3();
// Bright sunlit material with a soft self-glow (about colour * k), painted by the brushwork.
function pmat(opts = {}, k = 0.15, tile) {
  const m = paintMat(opts);
  inject(m, { key: 'pglow' + k, emissive: `totalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(2)};` });
  if (tile) m.userData.paintTile = tile;
  return m;
}
// Gentle wind on plants: displacement grows with height above each instance's base.
function sway(m, amp, freq, key) {
  return inject(m, {
    key: 'isway' + key, uniforms: { uTime: U.uTime },
    vertex: `{ vec3 b = vec3(0.0);
      #ifdef USE_INSTANCING
        b = instanceMatrix[3].xyz;
      #endif
      float k = max(position.y, 0.0); float ph = b.x * 0.31 + b.z * 0.23;
      transformed.x += sin(uTime * ${freq.toFixed(2)} + ph) * k * k * ${amp.toFixed(4)};
      transformed.z += cos(uTime * ${(freq * 0.8).toFixed(2)} + ph * 1.3) * k * k * ${(amp * 0.6).toFixed(4)}; }`,
  });
}
const _blobs = {};
// Lumpy sphere with smooth round normals (canopies, bushes, tree crowns).
function blobGeo(detail = 1, seed = 0) {
  const key = detail + ':' + seed;
  if (!_blobs[key]) {
    const g = lumpify(new THREE.IcosahedronGeometry(1, detail), 0.13, 2.1, seed);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i).normalize(); n.setXYZ(i, _v.x, _v.y, _v.z); }
    _blobs[key] = g;
  }
  return _blobs[key];
}
// A leaf/frond strip along +z with a V crease, drooping towards the tip.
function leafStrip(len, w, droop = 0.3, lift = 0.3, segs = 4) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, z = len * t, y = len * (lift * t - droop * t * t);
    const half = w * 0.5 * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * t)), 0.8);
    pos.push(-half, y - half * 0.25, z, 0, y, z, half, y - half * 0.25, z);
  }
  for (let i = 0; i < segs; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Translate, then yaw about Y, then tilt about X (positive tilts +z downwards), then scale.
function yt(x, y, z, yaw = 0, tilt = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(yaw))
    .multiply(new THREE.Matrix4().makeRotationX(tilt)).multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
}
// Matrix for a unit box whose z axis follows `along`, x stays horizontal.
function boxM(center, along, sx, sy, sz) {
  const z = along.clone().normalize(), x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize(), y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Matrix4().makeBasis(x.multiplyScalar(sx), y.multiplyScalar(sy), z.multiplyScalar(sz)).setPosition(center);
}
// Multiply the baked vertex colours of a merged geometry by fn(x, y, z, ny).
function shade(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal, c = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const k = fn(p.getX(i), p.getY(i), p.getZ(i), n.getY(i));
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return geo;
}
// Open-ended (capless) cylinder between two points, cheaper than segment() for thin parts.
function stick(a, b, r0, r1, radial = 4) {
  const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  return g.translate(a.x, a.y, a.z);
}
const post = (r, h, radial = 4) => new THREE.CylinderGeometry(r * 0.85, r, h, radial, 1, true);
const ringTop = (r0, r1, seg = 40) => new THREE.RingGeometry(r0, r1, seg, 1).rotateX(-Math.PI / 2);
const ringBot = (r0, r1, seg = 40) => new THREE.RingGeometry(r0, r1, seg, 1).rotateX(Math.PI / 2);
const tubeOpen = (r, h, seg = 40) => new THREE.CylinderGeometry(r, r, h, seg, 1, true);
const catenary = (a, b, sag, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return a.clone().lerp(b, t).add(v3(0, -sag * 4 * t * (1 - t), 0)); });

// ---------- jungle plant models (unit size, instanced) ----------
function broadleafParts() {
  const trunk = merge([
    { geo: stick(v3(0, -0.6, 0), v3(0.35, 4.6, 0.2), 0.5, 0.32, 6), color: 0xffffff },
    { geo: stick(v3(0.35, 4.6, 0.2), v3(0, 6.6, 0), 0.32, 0.22, 6), color: 0xffffff },
    { geo: stick(v3(0.3, 4.2, 0.1), v3(1.6, 6.2, 0.5), 0.2, 0.12, 4), color: 0xffffff },
  ]);
  const crown = shade(merge([
    { geo: blobGeo(1, 1), matrix: mat(0, 7.3, 0, 0, 0, 0, 2.7, 2.3, 2.7) },
    { geo: blobGeo(0, 2), matrix: mat(1.9, 6.5, 0.6, 0, 0, 0, 2.0, 1.7, 2.0) },
    { geo: blobGeo(0, 3), matrix: mat(-1.7, 6.6, -0.8, 0, 0, 0, 2.1, 1.8, 2.1) },
  ]), (x, y, z, ny) => 0.72 + 0.38 * (ny * 0.5 + 0.5));
  return { trunk, crown };
}
function emergentParts() {
  const trunk = merge([
    { geo: stick(v3(0, -0.8, 0), v3(0.3, 15, 0), 0.75, 0.42, 7), color: 0xffffff },
    { geo: stick(v3(0.3, 13, 0), v3(3.2, 16.2, 1), 0.3, 0.18, 4), color: 0xffffff },
    { geo: stick(v3(0.2, 12.5, 0), v3(-2.8, 16.4, -1.4), 0.3, 0.18, 4), color: 0xffffff },
  ]);
  const crown = shade(merge([
    { geo: blobGeo(1, 4), matrix: mat(0.3, 17.2, 0, 0, 0, 0, 4.2, 2.2, 4.2) },
    { geo: blobGeo(1, 5), matrix: mat(3.6, 16.6, 1.0, 0, 0, 0, 3.0, 1.7, 3.0) },
    { geo: blobGeo(0, 6), matrix: mat(-3.0, 16.8, -1.5, 0, 0, 0, 3.2, 1.8, 3.2) },
    { geo: blobGeo(0, 7), matrix: mat(0.6, 17.4, 3.0, 0, 0, 0, 2.8, 1.6, 2.8) },
  ]), (x, y, z, ny) => 0.72 + 0.38 * (ny * 0.5 + 0.5));
  return { trunk, crown };
}
function palmParts() {
  const tr = [], fr = [];
  let p = v3(0, -0.5, 0);
  for (let i = 1; i <= 6; i++) {
    const n = v3(1.6 * (i / 6) ** 2, i * 1.55, 0);
    tr.push({ geo: stick(p, n, 0.42 - i * 0.025, 0.4 - i * 0.03, 5), color: i % 2 ? 0xd9b07a : 0xc79c66 });
    p = n;
  }
  for (let i = 0; i < 3; i++) tr.push({ geo: new THREE.OctahedronGeometry(0.34, 0), matrix: mat(p.x + Math.cos(i * 2.1) * 0.35, p.y - 0.35, Math.sin(i * 2.1) * 0.35), color: 0x7a5232 });
  for (let i = 0; i < 8; i++) fr.push({ geo: leafStrip(5.2, 1.3, 0.5, 0.35, 3), matrix: yt(p.x, p.y + 0.1, 0, i * TAU / 8 + 0.2, -0.15 + (i % 2) * 0.15) });
  return { trunk: merge(tr), fronds: merge(fr), top: p };
}
function fernGeo() {
  return merge(Array.from({ length: 6 }, (_, i) => ({ geo: leafStrip(2.6, 0.8, 0.55, 0.95, 3), matrix: yt(0, 0, 0, i * TAU / 6 + (i % 2) * 0.3, -0.05) })));
}
function monsteraGeo() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5, len = 1.2 + (i % 2) * 0.4;
    const tip = v3(Math.sin(a) * len * 0.6, len, Math.cos(a) * len * 0.6);
    parts.push({ geo: stick(v3(0, 0, 0), tip, 0.06, 0.05, 3), color: 0x8fd06a });
    parts.push({ geo: leafStrip(1.9, 1.9, 0.35, 0.25, 3), matrix: yt(tip.x, tip.y, tip.z, a, 0.2), color: 0xffffff });
  }
  return merge(parts);
}
function flowerParts() {
  const stem = merge([
    { geo: stick(v3(0, 0, 0), v3(0.1, 2.3, 0), 0.08, 0.06, 3) },
    { geo: leafStrip(1.2, 0.5, 0.3, 0.6, 3), matrix: yt(0.05, 0.7, 0, 0.5, 0) },
    { geo: leafStrip(1.1, 0.5, 0.3, 0.6, 3), matrix: yt(0.05, 1.2, 0, 3.4, 0) },
  ]);
  const head = merge([
    ...Array.from({ length: 5 }, (_, i) => ({ geo: leafStrip(1.1, 0.95, -0.05, 0.55, 2), matrix: yt(0.1, 2.3, 0, i * TAU / 5, -0.15), color: 0xffffff })),
    { geo: new THREE.IcosahedronGeometry(0.22, 0), matrix: mat(0.1, 2.45, 0), color: 0xfff07a },
  ]);
  return { stem, head };
}
function mushroomParts() {
  const stem = merge([
    { geo: new THREE.CylinderGeometry(0.2, 0.28, 1.6, 6, 1, true), matrix: mat(0, 0.8, 0), color: 0xffffff },
    ...Array.from({ length: 5 }, (_, i) => { const a = i * 1.3, e = 0.5 + (i % 2) * 0.3; return { geo: new THREE.OctahedronGeometry(0.15, 0), matrix: mat(Math.cos(a) * Math.cos(e) * 0.98, 1.55 + Math.sin(e) * 0.62, Math.sin(a) * Math.cos(e) * 0.98, 0, 0, 0, 1, 0.6, 1), color: 0xffffff }; }),
  ]);
  const cap = merge([{ geo: new THREE.SphereGeometry(1, 10, 4, 0, TAU, 0, Math.PI / 2), matrix: mat(0, 1.5, 0, 0, 0, 0, 1, 0.62, 1) }]);
  return { stem, cap };
}
function bushParts() {
  const bush = shade(merge([
    { geo: blobGeo(1, 8), matrix: mat(0, 0.9, 0, 0, 0, 0, 1.5, 1.1, 1.5) },
    { geo: blobGeo(0, 9), matrix: mat(1.0, 0.7, 0.4, 0, 0, 0, 1.0, 0.85, 1.0) },
    { geo: blobGeo(0, 10), matrix: mat(-0.9, 0.7, -0.5, 0, 0, 0, 1.1, 0.9, 1.1) },
  ]), (x, y, z, ny) => 0.75 + 0.35 * (ny * 0.5 + 0.5));
  const berries = merge(Array.from({ length: 10 }, (_, i) => {
    const a = i * 2.4, e = 0.2 + (i % 3) * 0.3;
    return { geo: new THREE.OctahedronGeometry(0.24, 0), matrix: mat(Math.cos(a) * Math.cos(e) * 1.5, 0.9 + Math.sin(e) * 1.1, Math.sin(a) * Math.cos(e) * 1.5) };
  }));
  return { bush, berries };
}
function bananaParts() {
  const plant = merge([
    { geo: stick(v3(0, -0.3, 0), v3(0, 3, 0), 0.32, 0.22, 5), color: 0x9ad06a },
    ...Array.from({ length: 6 }, (_, i) => ({ geo: leafStrip(3.6, 1.4, 0.4, 0.75, 3), matrix: yt(0, 2.9, 0, i * TAU / 6 + 0.3, -0.1), color: 0xffffff })),
  ]);
  const bunch = [{ geo: segment(v3(0.3, 2.6, 0), v3(0.6, 1.4, 0), 0.06, 0.05, 3), color: 0x7a9a4a }];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.1, y = 1.7 + (i % 3) * 0.3;
    bunch.push({ geo: new THREE.CylinderGeometry(0.1, 0.07, 0.6, 4, 1, true), matrix: mat(0.6 + Math.cos(a) * 0.2, y, Math.sin(a) * 0.2, 0, a, 0.5), color: 0xffe14a });
  }
  return { plant, bunch: merge(bunch) };
}
function smallFlowerGeo() {
  const pos = [], cols = [], G = [0.45, 0.8, 0.35], Wt = [1, 1, 1], Y = [1, 0.9, 0.4];
  for (let i = 0; i < 3; i++) {
    const x = Math.cos(i * 2.1) * 0.45, z = Math.sin(i * 2.1) * 0.45, h = 0.5 + i * 0.18;
    pos.push(x * 0.3 - 0.04, 0, z * 0.3, x * 0.3 + 0.04, 0, z * 0.3, x, h, z); cols.push(...G, ...G, ...G);
    for (let k = 0; k < 5; k++) {
      const a0 = k * TAU / 5, a1 = (k + 1) * TAU / 5, r = 0.3;
      pos.push(x, h + 0.03, z, x + Math.cos(a1) * r, h, z + Math.sin(a1) * r, x + Math.cos(a0) * r, h, z + Math.sin(a0) * r);
      cols.push(...Y, ...Wt, ...Wt);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
function grassGeo() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.12, 0, 0, 0.12, 0, 0, 0.05, 1, 0.1], 3));
    g.computeVertexNormals();
    parts.push({ geo: g, matrix: mat(Math.cos(i * 1.7) * 0.2, 0, Math.sin(i * 1.7) * 0.2, 0, i * 1.9, rr(-0.3, 0.3), 1, rr(0.7, 1.2), 1) });
  }
  return merge(parts);
}

// =================================================================
export function buildParadiseIsland(scene) {
  const group = new THREE.Group();
  group.name = 'paradiseIsland';
  group.position.set(C.x, 0, C.z);
  scene.add(group);

  // Walkable surfaces for floor(), all in local coordinates.
  const F = { rings: [], discs: [], roofs: [], boxes: [], helices: [], bridges: [] };
  const solids = [];  // canopy cores {x, y, z, r} for limit()
  const houses = [];  // {x, z, r, bottom, top} for camLimit()
  const col = (o) => { o.x += C.x; o.z += C.z; colliders.push(o); };
  const colStart = colliders.length;

  const city = [], bark = [], leaves = [];
  const planks = [], windows = [], lanterns = [], buntingLines = [], ropeLines = [];
  const blossoms = [], vines = [], flowerBedFlowers = [], skyBlooms = [];
  const anim = { swings: [], lifts: [], crates: [], smoke: null };

  // ---------------- terrain ----------------
  {
    const S = 400, N = 140;
    const geo = new THREE.PlaneGeometry(S, S, N, N);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, colr = new Float32Array(p.count * 3), c = new THREE.Color();
    const sandW = new THREE.Color(0xfff4e8), sandP = new THREE.Color(0xffd2de), wet = new THREE.Color(0xe8c8b8), shelf = new THREE.Color(0x9ee8e0);
    const g1 = new THREE.Color(0x52c45a), g2 = new THREE.Color(0x86da5e), g3 = new THREE.Color(0x35a865), lime = new THREE.Color(0xb8e86a);
    const deep = new THREE.Color(0x3c9c58), rock = new THREE.Color(0xa69cc0), dirt = new THREE.Color(0xe6c994), moss = new THREE.Color(0x4fae6a);
    const meadowT = [0xff9ccc, 0xffe680, 0xd2b0ff, 0xffffff, 0xffb880].map((h) => new THREE.Color(h));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = localHeight(x, z);
      p.setY(i, h);
      const slope = Math.hypot(localHeight(x + 1.2, z) - h, localHeight(x, z + 1.2) - h) / 1.2;
      c.copy(sandW).lerp(sandP, ss(0.42, 0.68, fbm(x * 0.035, z * 0.035 + 4, 3)));
      if (h < SEA + 0.8) c.lerp(wet, ss(SEA + 0.8, SEA + 0.2, h) * 0.6);
      if (h < SEA) c.lerp(shelf, ss(SEA, SEA - 6, h) * 0.6);
      const dl = Math.hypot(x - LAGOON.x, z - LAGOON.z), dpo = Math.hypot(x - POND.x, z - POND.z);
      const rv = riverAt(x, z);
      let grass = ss(SEA + 2.5, SEA + 3.6, h) * ss(LAGOON.r + 16, LAGOON.r + 26, dl);
      if (grass > 0) {
        const n = fbm(x * 0.02 + 11, z * 0.02, 3);
        const gc = g1.clone().lerp(g2, ss(0.4, 0.65, n)).lerp(g3, ss(0.55, 0.3, n) * 0.7).lerp(lime, ss(0.66, 0.8, fbm(x * 0.05, z * 0.05 + 9, 2)) * 0.6);
        gc.lerp(deep, ss(SEA + 18, SEA + 50, h) * 0.45);
        gc.lerp(rock, ss(1.3, 2.4, slope) * 0.45);
        const dm = Math.hypot(x - MEADOW.x, z - MEADOW.z);
        if (dm < MEADOW.r + 8) {
          const f = noise2(x * 0.45, z * 0.45);
          gc.lerp(meadowT[Math.floor(noise2(x * 0.21 + 5, z * 0.21) * 5)], ss(0.5, 0.75, f) * ss(MEADOW.r + 8, MEADOW.r - 4, dm) * 0.85);
        }
        if (Math.hypot(x, (z - 6) / 1.08) < 110) gc.lerp(moss, 0.25 * fbm(x * 0.06, z * 0.06, 2));
        let pd = 1e9; for (const P of PATHS) pd = Math.min(pd, pathDist(x, z, P));
        gc.lerp(dirt, ss(3.2, 1.2, pd + (noise2(x * 0.3, z * 0.3) - 0.5) * 1.5) * 0.85);
        if (dpo < POND.r + 6) gc.lerp(sandW, ss(POND.r + 6, POND.r + 1, dpo) * 0.7);
        if (rv && rv.d < 8) gc.lerp(sandW, ss(8, 4, rv.d) * 0.6);
        c.lerp(gc, grass);
      }
      colr.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    geo.computeVertexNormals();
    const ix = geo.index.array, keep = [];
    for (let i = 0; i < ix.length; i += 3) if (Math.max(p.getY(ix[i]), p.getY(ix[i + 1]), p.getY(ix[i + 2])) > SEA - 2.5) keep.push(ix[i], ix[i + 1], ix[i + 2]);
    geo.setIndex(keep);
    const tm = pmat({ vertexColors: true }, 0.15, 'sand');
    const terrain = new THREE.Mesh(geo, tm);
    terrain.name = 'paradiseTerrain';
    group.add(terrain);
  }

  // ---------------- giant trees: trunks, roots, canopies ----------------
  const reserveClear = []; // points canopy blobs must leave free {x, y, z, r}
  for (const t of TREES) {
    t.g = localHeight(t.x, t.z);
    t.h = t.top ? t.top[0] - 0.6 : t.crown[0] + t.crown[1] * 0.35; // the trunk ends under the top platform or inside the canopy
    t.R = t.rings.map(([y, w]) => trunkR(t, y) + 4.8 + w);
  }
  // lifts and special branches keep the canopy open around them
  const branchSpec = { garden: { a: 0.25, y: 74, len: 31 }, west: { a: -1.87, y: 10, len: 30 } }; // Rio's high branch, Slo's low branch
  for (const t of TREES) {
    if (t.lift !== undefined) {
      const rl = t.top[1] + 1.6;
      for (let y = t.rings.at(-1)[0]; y < t.top[0] + 4; y += 4) reserveClear.push({ x: t.x + Math.cos(t.lift) * rl, y: t.g + y, z: t.z + Math.sin(t.lift) * rl, r: 4 });
    }
    const b = branchSpec[t.name];
    if (b) for (let k = 0.55; k <= 1.05; k += 0.1) reserveClear.push({ x: t.x + Math.cos(b.a) * b.len * k, y: t.g + b.y + 4 * k, z: t.z + Math.sin(b.a) * b.len * k, r: 5 });
  }
  for (const t of TREES) {
    const g = t.g;
    // trunk with flared foot
    const prof = [];
    for (let i = 0; i <= 20; i++) { const y = -3 + (t.h + 3) * (i / 20); prof.push(new THREE.Vector2(trunkR(t, y), y)); }
    prof.push(new THREE.Vector2(0.01, t.h + 0.6));
    bark.push({ geo: new THREE.LatheGeometry(prof, 16), matrix: mat(t.x, g, t.z), color: BARK });
    for (let i = 0; i < 7; i++) { // buttress roots
      const a = i * TAU / 7 + 0.3, r0 = trunkR(t, 6) * 0.8;
      bark.push({ geo: segment(v3(t.x + Math.cos(a) * r0, g + 7, t.z + Math.sin(a) * r0), v3(t.x + Math.cos(a) * t.r * 2.3, g - 1.5, t.z + Math.sin(a) * t.r * 2.3), t.r * 0.42, t.r * 0.14, 6), color: 0x8e6040 });
    }
    // three stacked trunk colliders follow the taper
    for (const [y0, y1] of [[-2, t.h * 0.3], [t.h * 0.3, t.h * 0.62], [t.h * 0.62, t.h]]) col({ r: trunkR(t, Math.max(4, y0)), bottom: g + y0, top: g + y1 });
    // canopy: a ring of big leaf blobs, a lower outer ring, and a crown (unless a platform sits on top)
    const [cyRel, cr] = t.crown, cy = g + cyRel;
    const list = [];
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + rr(-0.15, 0.15); list.push({ a, rad: cr * 0.66, y: cy + rr(-3, 3), r: cr * 0.4 * rr(0.9, 1.1), big: true }); }
    for (let i = 0; i < 7; i++) { const a = (i + 0.5) * TAU / 7; list.push({ a, rad: cr * 0.93, y: cy - cr * 0.25, r: cr * 0.3 * rr(0.9, 1.1) }); }
    if (!t.top) {
      list.push({ a: 0, rad: 0, y: cy + cr * 0.3, r: cr * 0.52, big: true });
      for (let i = 0; i < 3; i++) list.push({ a: i * 2.1, rad: cr * 0.32, y: cy + cr * 0.42, r: cr * 0.34 });
    }
    t.blobs = [];
    for (const bl of list) {
      const bx = t.x + Math.cos(bl.a) * bl.rad, bz = t.z + Math.sin(bl.a) * bl.rad;
      let by = bl.y;
      if (t.top) by = Math.min(by, g + t.top[0] - 1 - bl.r * 0.85);
      if (reserveClear.some((q) => Math.hypot(q.x - bx, q.z - bz) < bl.r + q.r && Math.abs(q.y - by) < bl.r + q.r)) continue;
      t.blobs.push({ x: bx, y: by, z: bz, r: bl.r });
      solids.push({ x: bx, y: by, z: bz, r: bl.r * 0.78 });
      const tint = pick([0x5ccf5f, 0x4cc06a, 0x72d85a, 0x3fb873]);
      leaves.push({ geo: blobGeo(bl.big ? 2 : 1, (bl.a * 10) | 0), matrix: mat(bx, by, bz, 0, bl.a, 0, bl.r, bl.r * 0.82, bl.r), color: tint });
      if (bl.rad > 0) { // a branch into each blob
        const tr = trunkR(t, by - g - cr * 0.5);
        bark.push({ geo: stick(v3(t.x + Math.cos(bl.a) * tr * 0.6, by - cr * 0.45, t.z + Math.sin(bl.a) * tr * 0.6), v3(bx - Math.cos(bl.a) * bl.r * 0.3, by - bl.r * 0.2, bz - Math.sin(bl.a) * bl.r * 0.3), t.r * 0.22, t.r * 0.08, 5), color: BARK });
      }
      for (let k = 0; k < (bl.big ? 6 : 3); k++) { // blossoms on the leaves
        const a = rr(0, TAU), e = rr(-0.1, 1.2);
        blossoms.push({ m: mat(bx + Math.cos(a) * Math.cos(e) * bl.r * 0.98, by + Math.sin(e) * bl.r * 0.8, bz + Math.sin(a) * Math.cos(e) * bl.r * 0.98, 0, a, 0, rr(1.6, 2.6)), c: pick([0xff8ac4, 0xffffff, 0xffb35c, 0xffe066, 0xd59bff]) });
      }
      for (let k = 0; k < (bl.big ? 1 : 2); k++) { // hanging vines
        const a = rr(0, TAU), d = bl.r * rr(0.4, 0.8);
        vines.push({ m: mat(bx + Math.cos(a) * d, by - bl.r * 0.55, bz + Math.sin(a) * d, 0, rr(0, TAU), 0, 1, rr(7, 15), 1), c: pick([0x6fd06a, 0x8fe07a, 0x5ab868]) });
      }
    }
  }

  // ---------------- platforms, stairs, houses ----------------
  const wallsC = () => pick(WALLS);
  function house(cx, y, cz, hr, yaw, style) {
    const H = yt(cx, y, cz, yaw);
    const add = (geo, color, m) => city.push({ geo, color, matrix: m ? H.clone().multiply(m) : H.clone() });
    const wallH = hr * 1.2 + 1.3, wc = wallsC();
    add(new THREE.CylinderGeometry(hr * 0.93, hr, wallH, 14, 1, true), wc, mat(0, wallH / 2, 0));
    add(new THREE.CylinderGeometry(hr + 0.15, hr + 0.25, 0.5, 12, 1, true), WOOD2, mat(0, 0.25, 0));
    let top;
    if (style === 'mushroom') {
      const rr2 = hr * 1.32, rc = pick(MUSH);
      add(new THREE.SphereGeometry(rr2, 12, 4, 0, TAU, 0, Math.PI / 2), rc, mat(0, wallH - 0.3, 0, 0, 0, 0, 1, 0.8, 1));
      add(new THREE.CircleGeometry(rr2, 12).rotateX(Math.PI / 2), 0xfff0dc, mat(0, wallH - 0.3, 0));
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4, e = 0.45 + (i % 2) * 0.4; add(new THREE.OctahedronGeometry(hr * 0.18, 0), 0xffffff, mat(Math.cos(a) * Math.cos(e) * rr2, wallH - 0.3 + Math.sin(e) * rr2 * 0.8, Math.sin(a) * Math.cos(e) * rr2, 0, 0, 0, 1, 0.5, 1)); }
      top = wallH - 0.3 + rr2 * 0.8;
    } else if (style === 'leaf') {
      const lc = pick(LEAFROOF);
      add(new THREE.ConeGeometry(hr * 1.3, hr * 1.7, 10, 1, true), lc, mat(0, wallH - 0.2 + hr * 0.85, 0));
      for (let i = 0; i < 8; i++) add(leafStrip(hr * 0.9, hr * 0.7, 0.4, 0.2, 2), lc, yt(0, wallH + 0.2, 0, i * TAU / 9, 0.6).multiply(new THREE.Matrix4().makeTranslation(0, 0, hr * 0.7)));
      add(new THREE.OctahedronGeometry(hr * 0.22, 0), 0xffe066, mat(0, wallH - 0.2 + hr * 1.7, 0));
      top = wallH - 0.2 + hr * 1.7;
    } else {
      const pc = pick(PETAL);
      add(new THREE.CircleGeometry(hr * 1.02, 12).rotateX(Math.PI / 2), 0x5ccf5f, mat(0, wallH, 0));
      for (let i = 0; i < 8; i++) add(leafStrip(hr * 1.25, hr * 0.85, 0.35, 0.05, 2), pc, yt(0, wallH + hr * 0.3, 0, i * TAU / 8, 0.25));
      add(new THREE.SphereGeometry(hr * 0.6, 10, 4, 0, TAU, 0, Math.PI / 2), 0xffd84a, mat(0, wallH + hr * 0.2, 0, 0, 0, 0, 1, 0.7, 1));
      top = wallH + hr * 0.62;
    }
    // round door, doorstep, windows, flower box, chimney
    add(new THREE.BoxGeometry(1.4, 1.6, 0.3), pick([0x9a5a3a, 0xff7a8a, 0x5aa8e8, 0x7ac86a]), mat(0, 1.3, hr * 0.97));
    add(new THREE.CircleGeometry(0.7, 8, 0, Math.PI), 0x9a5a3a, mat(0, 2.1, hr * 0.97 + 0.16));
    add(new THREE.BoxGeometry(1.8, 0.25, 0.9), WOODL, mat(0, 0.6, hr + 0.3));
    for (const a of [0.95, -0.95]) {
      windows.push(H.clone().multiply(yt(Math.sin(a) * (hr * 0.97 + 0.04), wallH * 0.58, Math.cos(a) * (hr * 0.97 + 0.04), a, 0, 0.55)));
    }
    add(new THREE.BoxGeometry(1.3, 0.35, 0.45), WOOD, yt(Math.sin(0.95) * (hr + 0.2), wallH * 0.58 - 0.8, Math.cos(0.95) * (hr + 0.2), 0.95));
    for (let i = -1; i <= 1; i += 2) add(new THREE.OctahedronGeometry(0.24, 0), pick(FLOWERS), yt(Math.sin(0.95) * (hr + 0.25), wallH * 0.58 - 0.5, Math.cos(0.95) * (hr + 0.25), 0.95).multiply(mat(i * 0.4, 0, 0)));
    if (rnd() < 0.45) add(new THREE.CylinderGeometry(0.3, 0.38, 1.8, 6, 1, true), 0xd8846a, mat(-hr * 0.45, top - 0.6, -hr * 0.3));
    col({ x: cx, z: cz, r: hr + 0.1, bottom: y - 0.5, top: y + top });
    F.roofs.push({ x: cx, z: cz, r: hr * 0.7, top: y + top - 0.2 });
    houses.push({ x: cx, z: cz, r: hr + 0.2, bottom: y - 0.5, top: y + top });
    return { top: y + top, wallH };
  }
  function flowerBed(cx, y, cz, r, rim = WOOD2, density = 3, size = 1) {
    city.push({ geo: new THREE.CylinderGeometry(r, r * 1.05, 0.7, 10, 1, true), matrix: mat(cx, y + 0.35, cz), color: rim });
    city.push({ geo: new THREE.CircleGeometry(r * 0.98, 10).rotateX(-Math.PI / 2), matrix: mat(cx, y + 0.62, cz), color: 0x6fbf5a });
    for (let i = 0; i < Math.round(r * density); i++) { const a = rr(0, TAU), d = Math.sqrt(rnd()) * r * 0.8; flowerBedFlowers.push({ m: mat(cx + Math.cos(a) * d, y + 0.6, cz + Math.sin(a) * d, 0, rr(0, TAU), 0, rr(0.9, 1.4) * size), c: pick(FLOWERS) }); }
  }
  function stall(cx, y, cz, yaw) {
    const H = yt(cx, y, cz, yaw);
    const add = (geo, color, m) => city.push({ geo, color, matrix: H.clone().multiply(m) });
    add(new THREE.BoxGeometry(3.4, 1.2, 1.6), WOODL, mat(0, 0.6, 0));
    for (const sx of [-1.6, 1.6]) add(post(0.1, 3, 3), WOOD2, mat(sx, 1.5, -0.6));
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.72, 0.12, 2.3), i % 2 ? 0xffffff : pick([0xff7a9a, 0x6fc8ff, 0xffc04a]), mat(-1.44 + i * 0.72, 3, 0.2, 0.25));
    for (let i = 0; i < 5; i++) add(new THREE.OctahedronGeometry(0.3, 0), pick([0xff6a5a, 0xffe14a, 0xff9a3a, 0x8ae05a, 0xc86bff]), mat(-1.2 + i * 0.6, 1.4, 0.2));
  }

  // pointer helpers on a tree
  const at = (t, a, rad, y) => v3(t.x + Math.cos(a) * rad, y, t.z + Math.sin(a) * rad);
  const yawOut = (a) => Math.atan2(Math.cos(a), Math.sin(a)); // local +z faces outward from the trunk
  // reserved angles on rings: { treeIndex: { ringIndex: [[angle, halfWidth], ...] } }
  const aB = Math.atan2(TREES[0].z - TREES[3].z, TREES[0].x - TREES[3].x) + 0.65; // bakery
  const aC = Math.atan2(TREES[0].z - TREES[4].z, TREES[0].x - TREES[4].x) - 0.75; // building site
  const reserved = { 3: { 0: [[aB, 0.75]] }, 4: { 0: [[aC, 0.8]] } };
  for (const [ti, ri] of [[0, 3], [2, 2]]) { (reserved[ti] ||= {})[ri] = [[TREES[ti].lift, 0.42]]; }
  for (let ti = 0; ti < TREES.length; ti++) {
    const t = TREES[ti], g = t.g;
    t.ringInfo = [];
    t.rings.forEach(([yr, w], ri) => {
      const y = g + yr, inner = trunkR(t, yr) + 4.8, R = t.R[ri];
      t.ringInfo.push({ y, inner, R });
      // deck, rim, underside, inner edge, plank seams
      city.push({ geo: ringTop(inner, R, 32), matrix: mat(t.x, y, t.z), color: WOOD });
      city.push({ geo: ringBot(inner, R, 32), matrix: mat(t.x, y - 1.1, t.z), color: WOOD2 });
      city.push({ geo: tubeOpen(R, 1.1, 32), matrix: mat(t.x, y - 0.55, t.z), color: pick(RAINBOW) });
      city.push({ geo: tubeOpen(inner, 1.1, 24), matrix: mat(t.x, y - 0.55, t.z), color: WOOD2 });
      // struts under the deck
      for (let k = 0; k < 7; k++) { const a = k * TAU / 7 + 0.2; city.push({ geo: stick(at(t, a, trunkR(t, yr - 8), y - 8), at(t, a, R * 0.78, y - 1), 0.35, 0.28, 4), color: WOOD2 }); }
      // rim rail: posts, rope, tall bunting posts every 30 degrees, and a rail round the stair well
      const nPost = Math.round(TAU * R / 6);
      for (let k = 0; k < nPost; k++) { const a = (k + 0.5) * TAU / nPost; city.push({ geo: post(0.15, 1.5, 3), matrix: mat(...at(t, a, R - 0.3, y + 0.75).toArray()), color: WOOD2 }); }
      city.push({ geo: new THREE.TorusGeometry(R - 0.3, 0.09, 3, 26), matrix: mat(t.x, y + 1.4, t.z, Math.PI / 2), color: ROPE });
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6; city.push({ geo: post(0.14, 1.3, 3), matrix: mat(...at(t, a, inner + 0.2, y + 0.65).toArray()), color: WOOD2 }); }
      ropeLines.push(Array.from({ length: 19 }, (_, k) => at(t, k * TAU / 18, inner + 0.2, y + 1.2)));
      const tallPts = [];
      for (let k = 0; k < 12; k++) {
        const a = k * TAU / 12 + 0.13, p = at(t, a, R - 0.3, y);
        city.push({ geo: post(0.18, 3.6, 4), matrix: mat(p.x, y + 1.8, p.z), color: WOODL });
        city.push({ geo: new THREE.OctahedronGeometry(0.34, 0), matrix: mat(p.x, y + 3.7, p.z), color: pick(RAINBOW) });
        tallPts.push(v3(p.x, y + 3.5, p.z));
      }
      for (let k = 0; k < 12; k++) buntingLines.push([tallPts[k], tallPts[(k + 1) % 12], 0.8]);
      // lantern strings from the trunk to the rim
      for (let k = 0; k < 4; k++) {
        const a = k * TAU / 4 + 0.5 + ri;
        const pts = catenary(at(t, a, trunkR(t, yr + 8) + 0.2, y + 8), at(t, a, R - 0.3, y + 3.5), 0.9, 10);
        ropeLines.push(pts);
        for (let j = 2; j < 10; j += 2) lanterns.push({ p: pts[j].clone().add(v3(0, -0.5, 0)), c: pick([0xffd27a, 0xff9ac8, 0x9ae0ff, 0xffb35c, 0xc8a8ff]) });
      }
      F.rings.push({ x: t.x, z: t.z, inner, outer: R, top: y });
      // houses and decorations wrap the stair well; the walkway runs round the rim
      const hr = Math.min(4.2, Math.max(1.8, (w - 3.4) / 2)), rc = inner + hr + 0.4;
      const n = Math.max(3, Math.floor(TAU * rc / (2 * hr + 7.5)));
      const a0 = rr(0, TAU), res = reserved[ti]?.[ri] || [];
      for (let k = 0; k < n; k++) {
        const a = a0 + k * TAU / n;
        if (res.some(([ra, hw]) => angDiff(a, ra) < hw)) continue;
        const p = at(t, a, rc, y), u = rnd();
        if (u < 0.7) house(p.x, y, p.z, hr * rr(0.85, 1), yawOut(a), pick(['mushroom', 'leaf', 'flower']));
        else if (u < 0.86) flowerBed(p.x, y, p.z, hr * 0.8);
        else stall(p.x, y, p.z, yawOut(a));
      }
    });
    // spiral stairs in the stair well, from the ground up to the highest ring
    const yMax = t.rings.at(-1)[0], phase = rr(0, TAU);
    const rise = 0.75, stepA = 1.75 / (trunkR(t, 0) + 2.6);
    const risePerRad = rise / stepA;
    F.helices.push({ x: t.x, z: t.z, t, g, phase, risePerRad, yMax: g + yMax });
    const railPts = [];
    for (let k = 0; ; k++) {
      const yRel = k * rise; if (yRel > yMax + 0.01) break;
      const a = phase + k * stepA, rad = trunkR(t, yRel) + 2.6;
      const cpos = at(t, a, rad, g + yRel - 0.18), tan = v3(-Math.sin(a), 0, Math.cos(a));
      planks.push({ m: boxM(cpos, tan, 4.2, 0.36, 1.9), c: k % 7 === 0 ? pick(RAINBOW) : pick([WOOD, WOODL, WOOD2]) });
      if (k % 3 === 0) railPts.push(at(t, a, trunkR(t, yRel) + 4.6, g + yRel + 1.2));
    }
    if (railPts.length > 3) city.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), railPts.length * 2, 0.11, 3), color: ROPE });
  }

  // ---------------- top platforms: town hall and sky garden ----------------
  function topPlatform(t) {
    const y = t.g + t.top[0], R = t.top[1];
    city.push({ geo: new THREE.CircleGeometry(R, 40).rotateX(-Math.PI / 2), matrix: mat(t.x, y, t.z), color: WOODL });
    city.push({ geo: new THREE.CircleGeometry(R, 40).rotateX(Math.PI / 2), matrix: mat(t.x, y - 1.2, t.z), color: WOOD2 });
    city.push({ geo: tubeOpen(R, 1.2), matrix: mat(t.x, y - 0.6, t.z), color: 0xffd36b });
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16; city.push({ geo: post(0.16, 1.5, 3), matrix: mat(...at(t, a, R - 0.3, y + 0.75).toArray()), color: WOODL }); }
    city.push({ geo: new THREE.TorusGeometry(R - 0.3, 0.1, 3, 48), matrix: mat(t.x, y + 1.4, t.z, Math.PI / 2), color: ROPE });
    F.discs.push({ x: t.x, z: t.z, r: R, top: y });
    // basket lift from the highest ring: gantry, ropes and a moving basket
    const ri = t.ringInfo.at(-1), rl = R + 1.6, a = t.lift;
    const lp = at(t, a, rl, 0);
    const jp = at(t, a, R + 1.2, y);
    city.push({ geo: new THREE.BoxGeometry(3.6, 0.5, 4.4), matrix: mat(jp.x, y - 0.25, jp.z, 0, -a, 0), color: WOODL });
    F.boxes.push({ x: jp.x, z: jp.z, hw: 1.8, hd: 2.2, yaw: a, top: y });
    for (const s of [-1, 1]) { const q = at(t, a + s * 0.17, rl, y); city.push({ geo: new THREE.CylinderGeometry(0.22, 0.25, 7, 6), matrix: mat(q.x, y + 3.5, q.z), color: WOOD2 }); }
    city.push({ geo: new THREE.BoxGeometry(0.4, 0.4, 2 * rl * Math.sin(0.17) + 1), matrix: mat(lp.x, y + 7, lp.z, 0, -a + Math.PI / 2, 0), color: WOOD2 });
    city.push({ geo: new THREE.TorusGeometry(0.8, 0.2, 5, 14), matrix: mat(lp.x, y + 6.3, lp.z, 0, -a, 0), color: 0xffd36b });
    for (const s of [-0.6, 0.6]) ropeLines.push([v3(lp.x + Math.sin(a) * s, y + 6.3, lp.z - Math.cos(a) * s), v3(lp.x + Math.sin(a) * s, ri.y + 0.2, lp.z - Math.cos(a) * s)]);
    const basket = new THREE.Mesh(merge([
      { geo: new THREE.CylinderGeometry(1.7, 1.4, 1.6, 12, 1, true), matrix: mat(0, 0.8, 0), color: 0xd8a060 },
      { geo: new THREE.CircleGeometry(1.4, 12).rotateX(-Math.PI / 2), matrix: mat(0, 0.1, 0), color: WOOD2 },
      { geo: new THREE.TorusGeometry(1.7, 0.14, 4, 16), matrix: mat(0, 1.6, 0, Math.PI / 2), color: 0xff7a9a },
      { geo: segment(v3(-1.5, 1.6, 0), v3(0, 4.2, 0), 0.06, 0.06, 3), color: ROPE },
      { geo: segment(v3(1.5, 1.6, 0), v3(0, 4.2, 0), 0.06, 0.06, 3), color: ROPE },
    ]), cityM);
    basket.position.set(lp.x, ri.y, lp.z);
    group.add(basket);
    anim.lifts.push({ mesh: basket, y0: ri.y + 0.05, y1: y + 0.05, phase: rr(0, 10) });
    return y;
  }
  const cityM = pmat({ vertexColors: true, side: THREE.DoubleSide }, 0.16, 'shell');
  const hallT = TREES[0], hallY = topPlatform(hallT);
  {
    // Town hall: round hall with pillars, a giant flower dome, clock, bell spire and flags
    const t = hallT, y = hallY, aM = Math.PI; // faces west, towards the landing beach
    const H = yt(t.x, y, t.z, yawOut(aM));
    const add = (geo, color, m) => city.push({ geo, color, matrix: H.clone().multiply(m) });
    add(new THREE.CylinderGeometry(9.6, 10, 1, 24), 0xfff0f6, mat(0, 0.5, 0));
    add(new THREE.CylinderGeometry(7.6, 8, 9, 20, 1, true), 0xffe6c8, mat(0, 5.5, 0));
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + 0.31; add(new THREE.CylinderGeometry(0.42, 0.5, 9, 8), 0xffffff, mat(Math.sin(a) * 9, 5.5, Math.cos(a) * 9)); add(new THREE.SphereGeometry(0.7, 8, 5), 0xffd36b, mat(Math.sin(a) * 9, 10.2, Math.cos(a) * 9)); }
    add(new THREE.TorusGeometry(9.2, 0.5, 5, 36), 0xffd36b, mat(0, 10.4, 0, Math.PI / 2));
    add(new THREE.CylinderGeometry(9.8, 9.8, 0.6, 28), 0xff9ac8, mat(0, 10.8, 0));
    add(new THREE.SphereGeometry(7.4, 18, 8, 0, TAU, 0, Math.PI / 2), 0xffb3dc, mat(0, 10.8, 0, 0, 0, 0, 1, 0.9, 1));
    for (let i = 0; i < 8; i++) add(new THREE.SphereGeometry(3.6, 10, 6), pick([0xff6fae, 0xff8ac4, 0xffa8d4]), yt(0, 12, 0, i * TAU / 8, -0.5).multiply(mat(0, 0, 7.2, 0, 0, 0, 0.8, 0.3, 1.3)));
    add(new THREE.CylinderGeometry(1.4, 1.8, 6, 10), 0xfff0f6, mat(0, 19, 0));
    add(new THREE.ConeGeometry(2.3, 5, 10), 0x8a6bff, mat(0, 24.5, 0));
    add(new THREE.SphereGeometry(0.8, 10, 8), 0xffd36b, mat(0, 27.4, 0));
    add(new THREE.CylinderGeometry(0.1, 0.1, 4, 4), WOOD2, mat(0, 29, 0));
    add(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 20), 0xffffff, mat(0, 17.3, 2.7, Math.PI / 2 - 0.35)); // clock face
    add(new THREE.TorusGeometry(2.4, 0.25, 5, 20), 0xffd36b, mat(0, 17.3, 2.7, -0.35));
    add(new THREE.BoxGeometry(0.2, 1.8, 0.1), 0x553344, mat(0, 17.9, 2.95, -0.35));
    add(new THREE.BoxGeometry(1.4, 0.2, 0.1), 0x553344, mat(0.6, 17.3, 2.95, -0.35));
    add(new THREE.BoxGeometry(3, 4, 0.4), 0x9a5a3a, mat(0, 3, 7.7));
    add(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 14), 0x9a5a3a, mat(0, 5, 7.7, Math.PI / 2));
    add(new THREE.TorusGeometry(1.75, 0.22, 5, 16, Math.PI), 0xffd36b, mat(0, 5, 7.9));
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(5 - i * 0.6, 0.35, 1.1), 0xfff0f6, mat(0, 0.18 + i * 0.35, 10.3 - i * 0.7));
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.4; windows.push(H.clone().multiply(yt(Math.sin(a) * 7.85, 6.5, Math.cos(a) * 7.85, a, 0, 1.0))); }
    // flag poles round the edge with big pennants
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + 0.25, p = at(t, a, t.top[1] - 1.2, y);
      city.push({ geo: new THREE.CylinderGeometry(0.12, 0.14, 8, 5), matrix: mat(p.x, y + 4, p.z), color: 0xffffff });
      city.push({ geo: new THREE.IcosahedronGeometry(0.3, 0), matrix: mat(p.x, y + 8.1, p.z), color: 0xffd36b });
      buntingLines.push({ flag: true, p: v3(p.x, y + 7.6, p.z), dir: v3(Math.cos(a + 1.2), 0, Math.sin(a + 1.2)), color: RAINBOW[i % RAINBOW.length] });
    }
    col({ x: t.x, z: t.z, r: 9.6, bottom: y - 1, top: y + 22 });
    F.roofs.push({ x: t.x, z: t.z, r: 7, top: y + 17 });
    houses.push({ x: t.x, z: t.z, r: 10, bottom: y - 1, top: y + 22 });
    // flower boxes round the platform
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.5; flowerBed(t.x + Math.cos(a) * 12.4, y, t.z + Math.sin(a) * 12.4, 1.3); }
  }
  const gardenT = TREES[2], gardenY = topPlatform(gardenT);
  {
    // Sky garden: flower beds, little fruit trees, a fountain, a rose arbour and benches
    const t = gardenT, y = gardenY;
    city.push({ geo: new THREE.CylinderGeometry(2.6, 3, 1.2, 16), matrix: mat(t.x, y + 0.6, t.z), color: 0xfff0f6 });
    city.push({ geo: new THREE.CylinderGeometry(0.5, 0.7, 2.6, 8), matrix: mat(t.x, y + 2.1, t.z), color: 0xfff0f6 });
    city.push({ geo: new THREE.CylinderGeometry(1.4, 0.6, 0.6, 12), matrix: mat(t.x, y + 3.5, t.z), color: 0xfff0f6 });
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + 0.3;
      flowerBed(t.x + Math.cos(a) * 8.5, y, t.z + Math.sin(a) * 8.5, 2.3, pick(WALLS), 9, 1.5);
      for (let k = 0; k < 3; k++) skyBlooms.push(at(t, a + 0.3 + k * 0.17, 13.2, y));
      if (i % 2 === 0) {
        const q = at(t, a + 0.62, 9.5, y);
        city.push({ geo: segment(q, q.clone().add(v3(0, 3.2, 0)), 0.25, 0.18, 5), color: BARK });
        leaves.push({ geo: blobGeo(1, 20 + i), matrix: mat(q.x, y + 4.4, q.z, 0, 0, 0, 1.9, 1.6, 1.9), color: 0x6ad86a });
        for (let k = 0; k < 5; k++) blossoms.push({ m: mat(q.x + Math.cos(k * 1.3) * 1.7, y + 4.1 + (k % 2) * 0.6, q.z + Math.sin(k * 1.3) * 1.7, 0, 0, 0, 2.2), c: pick([0xff9a3a, 0xff5a6a, 0xffe14a]) });
        col({ x: q.x, z: q.z, r: 0.4, bottom: y - 0.5, top: y + 4 });
      }
    }
    // rose arbour over the walk to the lift
    const ab = at(t, t.lift + Math.PI, 11.5, y);
    city.push({ geo: new THREE.TorusGeometry(2.4, 0.2, 5, 14, Math.PI), matrix: mat(ab.x, y + 2.6, ab.z, 0, -t.lift - Math.PI + Math.PI / 2, 0), color: 0xffffff });
    for (let k = 0; k < 9; k++) blossoms.push({ m: yt(ab.x, y + 2.6, ab.z, -t.lift - Math.PI + Math.PI / 2).multiply(mat(Math.cos(k * Math.PI / 8) * 2.4, Math.sin(k * Math.PI / 8) * 2.4, 0, 0, 0, 0, 2.4)), c: pick([0xff5a7a, 0xff9ac8, 0xffffff]) });
    for (let i = 0; i < 3; i++) { const q = at(t, i * 2.1 + 1.2, 12.6, y); city.push({ geo: new THREE.BoxGeometry(2.6, 0.3, 0.9), matrix: mat(q.x, y + 0.9, q.z, 0, -(i * 2.1 + 1.2) + Math.PI / 2, 0), color: 0xffb3dc }); }
  }

  // ---------------- branches: Rio's high branch and Slo's low branch ----------------
  const perches = {};
  for (const t of TREES) {
    const b = branchSpec[t.name];
    if (!b) continue;
    const y = t.g + b.y, base = at(t, b.a, trunkR(t, b.y) * 0.7, y), tip = at(t, b.a, b.len, y + 4);
    bark.push({ geo: segment(base, tip, t.r * 0.28, t.r * 0.1, 7), color: BARK });
    const pr = at(t, b.a, b.len - 3.5, 0); pr.y = lerp(y, y + 4, (b.len - 3.5 - trunkR(t, b.y) * 0.7) / (b.len - trunkR(t, b.y) * 0.7)) + t.r * 0.14;
    city.push({ geo: new THREE.CylinderGeometry(2.4, 2.2, 0.5, 12), matrix: mat(pr.x, pr.y, pr.z), color: WOODL });
    F.discs.push({ x: pr.x, z: pr.z, r: 2.4, top: pr.y + 0.25 });
    perches[t.name] = v3(pr.x, pr.y + 0.25, pr.z);
    for (let k = 0; k < 3; k++) {
      const q = at(t, b.a + (k - 1) * 0.12, b.len + 1 + k, y + 5 + k);
      leaves.push({ geo: blobGeo(1, 30 + k), matrix: mat(q.x, q.y, q.z, 0, 0, 0, 3.2, 2.6, 3.2), color: 0x5ccf5f });
      solids.push({ x: q.x, y: q.y, z: q.z, r: 2.4 });
      vines.push({ m: mat(q.x, q.y - 2, q.z, 0, k, 0, 1, rr(5, 9), 1), c: 0x7ad86a });
    }
  }

  // ---------------- rope bridges ----------------
  const newBridge = { planks: [], from: 0, to: 1, built: false };
  for (const [ta, ra, tb, rb, kind] of BRIDGES) {
    const A = TREES[ta], B = TREES[tb];
    const dir = v3(B.x - A.x, 0, B.z - A.z).normalize();
    const ya = A.ringInfo[ra].y, yb = B.ringInfo[rb].y;
    const pa = v3(A.x, ya, A.z).addScaledVector(dir, A.R[ra] - 0.8), pb = v3(B.x, yb, B.z).addScaledVector(dir, -(B.R[rb] - 0.8));
    const span = Math.hypot(pb.x - pa.x, pb.z - pa.z), sag = span * 0.05;
    const yAt = (u) => lerp(ya, yb, u) - sag * 4 * u * (1 - u);
    const ptAt = (u) => v3(lerp(pa.x, pb.x, u), yAt(u), lerp(pa.z, pb.z, u));
    const side = v3(-dir.z, 0, dir.x), hw = 1.7;
    const isNew = kind === 'new';
    const gap = isNew ? [0.3, 0.7] : null;
    F.bridges.push({ ax: pa.x, az: pa.z, bx: pb.x, bz: pb.z, ya, yb, sag, hw, gap });
    const n = Math.ceil(span / 1.2);
    for (let i = 0; i <= n; i++) {
      const u = i / n, p = ptAt(u).add(v3(0, -0.12, 0)), tan = ptAt(Math.min(1, u + 0.01)).sub(ptAt(Math.max(0, u - 0.01)));
      const it = { m: boxM(p, tan, hw * 2, 0.24, 0.78), c: pick([WOOD, WOODL, WOOD2]) };
      if (gap && u > gap[0] && u < gap[1]) newBridge.planks.push(it); else planks.push(it);
    }
    if (isNew) { newBridge.mid = ptAt(0.5); newBridge.ends = [ptAt(gap[0]), ptAt(gap[1])]; }
    // posts, handrail ropes, lanterns, and bunting between the tall end posts
    const nP = Math.max(3, Math.round(span / 4));
    for (const s of [-1, 1]) {
      const rail = [];
      for (let i = 0; i <= nP; i++) {
        const u = i / nP, p = ptAt(u).addScaledVector(side, s * (hw - 0.1));
        const end = i === 0 || i === nP, hgt = end ? 4.2 : 1.5;
        city.push({ geo: post(0.15, hgt, end ? 4 : 3), matrix: mat(p.x, p.y + hgt / 2 - 0.1, p.z), color: end ? WOODL : WOOD2 });
        rail.push(p.clone().add(v3(0, 1.35, 0)));
        if (!end && i % 2 === 0) lanterns.push({ p: p.clone().add(v3(0, 1.0, 0)), c: pick([0xffd27a, 0xff9ac8, 0x9ae0ff]) });
      }
      if (isNew) { // only the two finished ends have rails; the middle hangs as loose ropes
        city.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail.slice(0, 2)), 2, 0.1, 3), color: ROPE });
        city.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail.slice(-2)), 2, 0.1, 3), color: ROPE });
        ropeLines.push(catenary(rail[0], rail.at(-1), sag * 0.6 + 1.5, 12));
      } else city.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), nP * 3, 0.1, 3), color: ROPE });
      if (s > 0) buntingLines.push([ptAt(0).addScaledVector(side, hw - 0.1).add(v3(0, 3.9, 0)), ptAt(1).addScaledVector(side, hw - 0.1).add(v3(0, 3.9, 0)), sag + 1.2]);
    }
    if (isNew) { // a pile of planks waiting on the builders' side
      for (let i = 0; i < 6; i++) city.push({ geo: new THREE.BoxGeometry(3.2, 0.24, 0.8), matrix: mat(...pa.clone().addScaledVector(dir, -2.6).addScaledVector(side, 2.6).add(v3(0, 0.12 + i * 0.25, 0)).toArray(), 0, rr(-0.2, 0.2) - Math.atan2(dir.z, dir.x) + Math.PI / 2, 0), color: WOODL });
    }
  }

  // ---------------- bakery, building site, swings, slides ----------------
  {
    const t = TREES[3], ri = t.ringInfo[0], y = ri.y;
    const hr = 4.4, rc = ri.inner + hr + 0.3, p = at(t, aB, rc, y);
    const hb = house(p.x, y, p.z, hr, yawOut(aB), 'mushroom');
    const H = yt(p.x, y, p.z, yawOut(aB));
    const add = (geo, color, m) => city.push({ geo, color, matrix: H.clone().multiply(m) });
    // a giant cake on the roof as the bakery sign
    for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(1.8 - i * 0.5, 1.8 - i * 0.5, 0.9, 14), [0xffd9e6, 0xfff5b0, 0xffb3dc][i], mat(0, hb.top - y + 0.45 + i * 0.9, 0));
    add(new THREE.SphereGeometry(0.35, 8, 6), 0xff3a5a, mat(0, hb.top - y + 3.1, 0));
    // striped awning and the counter with cakes and bread
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.7, 0.12, 2.8), i % 2 ? 0xffffff : 0xff7a9a, mat(-1.75 + i * 0.7, 3.3, hr + 1.2, 0.3));
    add(new THREE.BoxGeometry(4.4, 1.1, 1.2), WOODL, mat(0, 0.55, hr + 2.1));
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.42, 0.42, 0.45, 10), pick([0xffb3dc, 0xfff0a0, 0xc8a8ff, 0xffd0a0]), mat(-1.5 + i, 1.33, hr + 2.1));
    for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.1, 5, 4), 0xff3a5a, mat(-1.5 + i, 1.62, hr + 2.1));
    for (let i = 0; i < 3; i++) add(new THREE.CapsuleGeometry(0.25, 0.7, 3, 6), 0xd8964a, mat(-1.6 + i * 0.6, 1.3, hr + 1.75, 0, 0, Math.PI / 2));
    // the big round oven next door, with smoke from its chimney
    const op = at(t, aB + 0.62, ri.inner + 3.3, y);
    city.push({ geo: new THREE.SphereGeometry(3, 14, 7, 0, TAU, 0, Math.PI / 2), matrix: mat(op.x, y, op.z), color: 0xff8a5a });
    city.push({ geo: new THREE.CircleGeometry(1.1, 12), matrix: yt(op.x, y + 1.1, op.z, yawOut(aB + 0.62)).multiply(mat(0, 0, 2.75)), color: 0x40201a });
    city.push({ geo: new THREE.CylinderGeometry(0.45, 0.55, 3, 8), matrix: mat(op.x, y + 3.6, op.z), color: 0xd86a4a });
    col({ x: op.x, z: op.z, r: 3, bottom: y - 0.5, top: y + 5 });
    anim.smoke = v3(op.x, y + 5.2, op.z);
    t.bakerAt = at(t, aB, ri.R - 2.2, y);
  }
  {
    const t = TREES[4], ri = t.ringInfo[0], y = ri.y;
    const rc = ri.inner + 4.2, p = at(t, aC, rc, y), yaw = yawOut(aC);
    const H = yt(p.x, y, p.z, yaw);
    const add = (geo, color, m) => city.push({ geo, color, matrix: H.clone().multiply(m) });
    // half-built round house: a ring of posts, a few wall planks, no roof yet
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10; add(new THREE.CylinderGeometry(0.16, 0.18, 5, 5), WOOD2, mat(Math.sin(a) * 3.6, 2.5, Math.cos(a) * 3.6)); }
    for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(3.65, 3.65, 0.45, 16, 1, true, Math.PI * 0.25, Math.PI * (1 - i * 0.12)), WOODL, mat(0, 0.3 + i * 0.5, 0));
    add(new THREE.TorusGeometry(3.6, 0.15, 3, 20), WOOD2, mat(0, 5, 0, Math.PI / 2));
    // scaffolding: a cage of poles and boards
    for (const sx of [-4.8, 4.8]) for (const sz of [-4.8, 4.8]) add(new THREE.CylinderGeometry(0.12, 0.12, 8, 4), 0xd8c08a, mat(sx, 4, sz));
    for (const yy of [2.5, 5.2, 7.8]) for (const [sx, sz, ry] of [[0, -4.8, 0], [0, 4.8, 0], [-4.8, 0, Math.PI / 2], [4.8, 0, Math.PI / 2]]) add(new THREE.BoxGeometry(9.8, 0.14, 0.14), 0xd8c08a, mat(sx, yy, sz, 0, ry, 0));
    add(new THREE.BoxGeometry(9.6, 0.2, 1.4), WOODL, mat(0, 5.3, 4.2));
    add(new THREE.BoxGeometry(1.4, 0.2, 9.6), WOODL, mat(-4.2, 5.3, 0));
    for (const [sx, sz, ry] of [[-4.8, 4.8, 0.5], [4.8, -4.8, 2.2]]) add(new THREE.BoxGeometry(0.14, 9.2, 0.14), 0xd8c08a, mat(sx * 0.5, 4, sz, 0, ry, 0.8));
    // a little crane with a crate on a rope, plank stacks, barrels, a toolbox
    add(new THREE.CylinderGeometry(0.3, 0.35, 13, 6), 0xffc04a, mat(5.4, 6.5, 5.4));
    add(new THREE.BoxGeometry(0.35, 0.35, 9), 0xffc04a, mat(5.4, 12.8, 9.4));
    add(new THREE.BoxGeometry(1.2, 1.2, 1.2), 0x7a7a8a, mat(5.4, 12.6, 4.6));
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(3.4, 0.24, 0.7), WOODL, mat(-5, 0.12 + i * 0.25, 7.5, 0, rr(-0.15, 0.15), 0));
    for (let i = 0; i < 2; i++) add(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 10), 0xb07a4a, mat(-6.4 + i * 1.3, 0.65, 4.6));
    add(new THREE.BoxGeometry(1.2, 0.6, 0.6), 0xff5a5a, mat(2.5, 0.3, 7.5));
    const crate = new THREE.Group();
    const hook = H.clone().multiply(mat(5.4, 12.6, 13.4));
    crate.position.setFromMatrixPosition(hook);
    crate.add(new THREE.Mesh(merge([{ geo: segment(v3(0, 0, 0), v3(0, -6, 0), 0.05, 0.05, 3), color: ROPE }, { geo: new THREE.BoxGeometry(1.6, 1.6, 1.6), matrix: mat(0, -6.8, 0), color: WOODL }]), cityM));
    group.add(crate);
    anim.crates.push(crate);
    col({ x: p.x, z: p.z, r: 5.2, bottom: y - 0.5, top: y + 8 });
    t.builderAt = at(t, aC + 0.42, ri.R - 2.2, y);
    t.zazaAt = at(t, aC + Math.PI, ri.R - 2.2, y);
  }
  const swingGeo = merge([
    { geo: segment(v3(-0.8, 0, 0), v3(-0.8, -5.5, 0), 0.05, 0.05, 3), color: ROPE },
    { geo: segment(v3(0.8, 0, 0), v3(0.8, -5.5, 0), 0.05, 0.05, 3), color: ROPE },
    { geo: new THREE.BoxGeometry(2, 0.22, 0.8), matrix: mat(0, -5.6, 0), color: 0xff7a9a },
  ]);
  for (const [ti, ri, a] of [[0, 0, 2.2], [1, 0, 0.9], [3, 1, -2.3], [5, 0, 0.4], [6, 0, 2.6]]) {
    const t = TREES[ti], r = t.ringInfo[ri], p = at(t, a, r.R - 2.2, r.y - 1.1);
    const sw = new THREE.Mesh(swingGeo, cityM);
    sw.position.copy(p); sw.rotation.order = 'YXZ'; sw.rotation.y = -a;
    group.add(sw);
    anim.swings.push({ mesh: sw, phase: rr(0, TAU), amp: rr(0.25, 0.45) });
  }
  // slides: a twisting rainbow chute from a ring down to the ground
  function slide(t, ri, a0, turn) {
    const r = t.ringInfo[ri], pts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, a = a0 + u * turn, rad = r.R + 1.2 + u * 9;
      const x = t.x + Math.cos(a) * rad, z = t.z + Math.sin(a) * rad;
      const gy = localHeight(x, z) + 0.9;
      pts.push(v3(x, lerp(r.y + 0.5, gy, Math.min(1, u * 1.08) ** 1.15), z));
    }
    const curve = new THREE.CatmullRomCurve3(pts), N = 60, M = 7, pos = [], idx = [], cols = [], cc = new THREE.Color();
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPointAt(u), tan = curve.getTangentAt(u);
      const sd = new THREE.Vector3().crossVectors(tan, v3(0, 1, 0)).normalize(), dn = new THREE.Vector3().crossVectors(sd, tan).normalize();
      cc.set(RAINBOW[Math.floor(u * 14) % RAINBOW.length]);
      for (let j = 0; j <= M; j++) { const th = Math.PI * j / M; const q = p.clone().addScaledVector(sd, Math.cos(th) * 1.3).addScaledVector(dn, Math.sin(th) * 1.0 - 0.3); pos.push(q.x, q.y, q.z); cols.push(cc.r, cc.g, cc.b); }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, cityM); m.name = 'slide'; group.add(m);
    for (let i = 4; i < 24; i += 5) city.push({ geo: segment(v3(pts[i].x, localHeight(pts[i].x, pts[i].z) - 1, pts[i].z), pts[i].clone().add(v3(0, -0.8, 0)), 0.22, 0.18, 5), color: WOOD2 });
  }
  slide(TREES[0], 0, 0.9, 1.9);
  slide(TREES[4], 1, 0.9, 2.6);

  // ---------------- landing beach: pier, welcome arch, sandcastle, hammock ----------------
  const landingDir = Math.PI;
  let coastD = 100; while (localHeight(Math.cos(landingDir) * coastD, 0) > SEA + 0.4) coastD += 0.5;
  const pierA = coastD - 12, pierB = coastD + 26, pierY = SEA + 2.0;
  for (let d = pierA; d <= pierB; d += 0.95) planks.push({ m: boxM(v3(-d, pierY - 0.13, 0), v3(1, 0, 0), 4.4, 0.26, 0.82), c: pick([WOOD, WOODL, WOOD2]) });
  for (let d = pierA + 2; d <= pierB; d += 5) for (const s of [-2, 2]) city.push({ geo: new THREE.CylinderGeometry(0.3, 0.3, 14, 6), matrix: mat(-d, pierY - 7.3, s), color: WOOD2 });
  for (let d = pierA + 2; d <= pierB; d += 5) for (const s of [-2.1, 2.1]) city.push({ geo: new THREE.CylinderGeometry(0.14, 0.14, 1.4, 4), matrix: mat(-d, pierY + 0.6, s), color: WOOD2 });
  for (const s of [-2.1, 2.1]) city.push({ geo: new THREE.BoxGeometry(pierB - pierA - 2, 0.14, 0.14), matrix: mat(-(pierA + pierB + 2) / 2, pierY + 1.3, s), color: ROPE });
  F.boxes.push({ x: -(pierA + pierB) / 2, z: 0, hw: (pierB - pierA) / 2 + 0.4, hd: 2.3, yaw: 0, top: pierY });
  {
    // welcome arch of flowers where the pier meets the sand
    const ax = -(pierA + 1);
    city.push({ geo: new THREE.TorusGeometry(3.2, 0.3, 6, 18, Math.PI), matrix: mat(ax, pierY + 3, 0, 0, Math.PI / 2, 0), color: 0x7ad06a });
    for (const s of [-3.2, 3.2]) city.push({ geo: new THREE.CylinderGeometry(0.3, 0.35, 3.2, 6), matrix: mat(ax, pierY + 1.4, s), color: 0x7ad06a });
    for (let k = 0; k < 13; k++) blossoms.push({ m: mat(ax, pierY + 3 + Math.sin(k * Math.PI / 12) * 3.2, Math.cos(k * Math.PI / 12) * 3.2, 0, 0, 0, 3), c: pick(FLOWERS) });
    // a chibi sandcastle and a hammock between two palms
    const sc = v3(-coastD + 8, 0, 16); sc.y = localHeight(sc.x, sc.z);
    city.push({ geo: new THREE.CylinderGeometry(2.4, 2.8, 1.6, 10), matrix: mat(sc.x, sc.y + 0.6, sc.z), color: 0xf6dcae });
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4; city.push({ geo: new THREE.CylinderGeometry(0.7, 0.8, 2.6, 8), matrix: mat(sc.x + Math.cos(a) * 2.1, sc.y + 1.3, sc.z + Math.sin(a) * 2.1), color: 0xf6dcae }); city.push({ geo: new THREE.ConeGeometry(0.85, 1.2, 8), matrix: mat(sc.x + Math.cos(a) * 2.1, sc.y + 3.2, sc.z + Math.sin(a) * 2.1), color: 0xffb3c8 }); }
    city.push({ geo: new THREE.CylinderGeometry(1.1, 1.2, 3.2, 8), matrix: mat(sc.x, sc.y + 2.6, sc.z), color: 0xf6dcae });
    city.push({ geo: new THREE.CylinderGeometry(0.04, 0.04, 2, 3), matrix: mat(sc.x, sc.y + 5, sc.z), color: WOOD2 });
    buntingLines.push({ flag: true, p: v3(sc.x, sc.y + 5.8, sc.z), dir: v3(0, 0, 1), color: 0xff5d73, size: 0.5 });
    col({ x: sc.x, z: sc.z, r: 3, top: sc.y + 4 });
  }

  // ---------------- water: pond, lagoon, river, rainbow waterfall, rainbow arch ----------------
  function water(color, opacity, key) {
    const m = new THREE.MeshLambertMaterial({ color, transparent: true, opacity, emissive: new THREE.Color(color).multiplyScalar(0.25) });
    m.userData.noPaint = 'flat animated water surface';
    inject(m, { key: 'iwater' + key, uniforms: { uTime: U.uTime }, fragment: `{ float w = sin(vWPos.x * 0.45 + sin(vWPos.z * 0.37 + uTime * 0.7) * 2.0 + uTime * 1.2) + sin(vWPos.z * 0.52 + sin(vWPos.x * 0.29 - uTime * 0.6) * 2.0 - uTime);
      gl_FragColor.rgb += vec3(1.0) * smoothstep(1.55, 1.95, w) * 0.35; }` });
    return m;
  }
  {
    const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 2.2, 40).rotateX(-Math.PI / 2), water(0x4fd8e0, 0.85, 'p'));
    pond.position.set(POND.x, POND.y, POND.z); pond.name = 'lilyPond'; group.add(pond);
    const lagM = water(0xff9cc8, 0.82, 'l');
    inject(lagM, { key: 'ilagoon', fragment: `gl_FragColor.rgb *= mix(vec3(0.88, 0.62, 0.92), vec3(1.08, 1.0, 1.04), smoothstep(4.0, ${(LAGOON.r - 1).toFixed(1)}, length(vWPos.xz - vec2(${(C.x + LAGOON.x).toFixed(1)}, ${(C.z + LAGOON.z).toFixed(1)}))));` });
    const lag = new THREE.Mesh(new THREE.CircleGeometry(LAGOON.r + 4, 48).rotateX(-Math.PI / 2), lagM);
    lag.position.set(LAGOON.x, LAGOON.y, LAGOON.z); lag.name = 'pinkLagoon'; group.add(lag);
    // river ribbon following the carved channel
    const dense = new THREE.CatmullRomCurve3(RIVER.map(([x, z], i) => v3(x, RIVER_WL[i], z))).getSpacedPoints(80).filter((p) => baseHeight(p.x, p.z) > SEA - 1);
    const pos = [], idx = [];
    dense.forEach((p, i) => {
      const q = dense[Math.min(i + 1, dense.length - 1)], o = dense[Math.max(i - 1, 0)];
      const sd = v3(-(q.z - o.z), 0, q.x - o.x).normalize().multiplyScalar(6);
      const wl = riverAt(p.x, p.z)?.wl ?? p.y;
      pos.push(p.x - sd.x, wl, p.z - sd.z, p.x + sd.x, wl, p.z + sd.z);
    });
    for (let i = 0; i < dense.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
    const rm = water(0x5ad8e8, 0.85, 'r'); rm.side = THREE.DoubleSide;
    const river = new THREE.Mesh(rg, rm); river.name = 'river'; group.add(river);
  }
  // find the waterfall lip: walk from the pond up towards the peak
  const toPeak = v3(PEAK.x - POND.x, 0, PEAK.z - POND.z).normalize();
  let lipD = POND.r; while (localHeight(POND.x + toPeak.x * lipD, POND.z + toPeak.z * lipD) < POND.y + 30 && lipD < 45) lipD += 0.5;
  const lip = v3(POND.x + toPeak.x * lipD, 0, POND.z + toPeak.z * lipD); lip.y = localHeight(lip.x, lip.z) + 0.6;
  const fallPts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, d = lerp(lipD, POND.r - 4, u);
    const x = POND.x + toPeak.x * d, z = POND.z + toPeak.z * d;
    const ballistic = lerp(lip.y, POND.y, u * u * 0.6 + u * 0.4);
    fallPts.push(v3(x, Math.max(ballistic, localHeight(x, z) + 1.6, POND.y), z));
  }
  {
    const W = 9, N = fallPts.length - 1, M = 10, pos = [], uv = [], idx = [];
    const sd = v3(-toPeak.z, 0, toPeak.x);
    fallPts.forEach((p, i) => {
      for (let j = 0; j <= M; j++) {
        const s = j / M - 0.5, out = (1 - (2 * s) ** 2) * 1.2; // bowed outwards
        pos.push(p.x + sd.x * s * W - toPeak.x * out, p.y, p.z + sd.z * s * W - toPeak.z * out);
        uv.push(j / M, i / N);
      }
    });
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const fm = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { uTime: U.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          vec3 rainbow = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + vUv.x * 0.95));
          float streak = n(vec2(vUv.x * 18.0, vUv.y * 6.0 - uTime * 2.4)) * 0.6 + n(vec2(vUv.x * 40.0, vUv.y * 14.0 - uTime * 4.0)) * 0.4;
          vec3 c = mix(rainbow, vec3(1.0), smoothstep(0.62, 0.9, streak) * 0.8 + smoothstep(0.85, 1.0, vUv.y) * 0.6);
          float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          gl_FragColor = vec4(c * 1.05, (0.72 + 0.25 * streak) * edge);
          #include <colorspace_fragment>
        }`,
    });
    const fall = new THREE.Mesh(g, fm); fall.name = 'rainbowFalls'; fall.renderOrder = 2; group.add(fall);
    // a soft rainbow arch over the pond
    const am = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uTime: U.uTime },
      vertexShader: `varying float vR; void main(){ vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vR; uniform float uTime;
        void main(){ float b = clamp((vR - 22.0) / 4.0, 0.0, 1.0);
          vec3 c = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + b * 0.85 + 0.05));
          gl_FragColor = vec4(c * (0.35 + 0.08 * sin(uTime * 0.7)), 1.0); }`,
    });
    const arch = new THREE.Mesh(new THREE.RingGeometry(22, 26, 64, 1, 0, Math.PI), am);
    arch.position.set(POND.x - toPeak.x * 4, POND.y - 1, POND.z - toPeak.z * 4);
    arch.rotation.y = Math.atan2(toPeak.x, toPeak.z); arch.name = 'rainbowArch';
    group.add(arch);
  }
  // waterfall mist and bakery smoke (one points cloud, animated)
  const MIST = 60, SMOKE = 16, mistPos = new Float32Array((MIST + SMOKE) * 3), mistCol = new Float32Array((MIST + SMOKE) * 3);
  const mistSeed = Array.from({ length: MIST + SMOKE }, () => [rnd(), rnd(), rnd()]);
  for (let i = 0; i < MIST + SMOKE; i++) mistCol.set(i < MIST ? [0.9, 0.95, 1] : [0.85, 0.82, 0.8], i * 3);
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3).setUsage(THREE.DynamicDrawUsage));
  mistGeo.setAttribute('color', new THREE.BufferAttribute(mistCol, 3));
  const mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({ map: glowTexture(), size: 4, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }));
  mist.frustumCulled = false; group.add(mist);
  const fallBase = fallPts.at(-1);

  // ---------------- nature: scatter helpers ----------------
  const pondRim = (x, z) => Math.hypot(x - POND.x, z - POND.z);
  const nearTree = (x, z, extra) => TREES.some((t) => Math.hypot(x - t.x, z - t.z) < (extra === 'ring' ? Math.max(...t.R) + 3 : trunkR(t, 0) + extra));
  const nearBridge = (x, z, w) => F.bridges.some((b) => segDist(x, z, b.ax, b.az, b.bx, b.bz)[0] < w);
  const nearPath = (x, z, w) => PATHS.some((P) => pathDist(x, z, P) < w);
  const avoidPts = []; // spots and landmarks that must stay clear of trees
  const isWet = (x, z) => pondRim(x, z) < POND.r + 3 || Math.hypot(x - LAGOON.x, z - LAGOON.z) < LAGOON.r + 4 || (riverAt(x, z)?.d ?? 99) < 7.5 || segDist(x, z, lip.x, lip.z, fallBase.x, fallBase.z)[0] < 7;
  function scatter(n, ok, region = () => { const a = rr(0, TAU), d = Math.sqrt(rnd()) * 175; return [Math.cos(a) * d, Math.sin(a) * d]; }) {
    const out = []; let guard = 0;
    while (out.length < n && guard++ < n * 60) {
      const [x, z] = region(); const h = localHeight(x, z);
      if (!ok(x, z, h)) continue;
      if (avoidPts.some((p) => Math.hypot(p.x - x, p.z - z) < p.r)) continue;
      out.push(v3(x, h, z));
    }
    return out;
  }
  const around = (cx, cz, r) => () => { const a = rr(0, TAU), d = Math.sqrt(rnd()) * r; return [cx + Math.cos(a) * d, cz + Math.sin(a) * d]; };
  const slopeAt = (x, z) => Math.hypot(localHeight(x + 1, z) - localHeight(x - 1, z), localHeight(x, z + 1) - localHeight(x, z - 1)) / 2;
  const onGround = (x, z, up = 1.7) => v3(x, localHeight(x, z) + up, z);
  const W = (p) => p.clone().add(v3(C.x, 0, C.z)); // local -> world

  // ---------------- spots (chosen before scattering, so plants keep clear of them) ----------------
  const ringSpot = (ti, ri, a, up = 1.7) => { const t = TREES[ti], r = t.ringInfo[ri]; return at(t, a, r.R - 1.8, r.y + up); };
  const L = {}; // local positions
  L.landing = onGround(-(coastD - 9), -7);
  L.npc = {
    mayor: at(hallT, Math.PI, 12.6, hallY + 1.8),
    baker: TREES[3].bakerAt.clone().add(v3(0, 1.8, 0)),
    builder: TREES[4].builderAt.clone().add(v3(0, 1.8, 0)),
    rio: perches.garden.clone().add(v3(0, 1.8, 0)),
    tuki: onGround(MANGO.x, MANGO.z, 1.8),
    flora: null, hum: onGround(MEADOW.x, MEADOW.z, 1.8),
    pavo: onGround(GARDEN.x, GARDEN.z, 1.8),
    banjo: onGround(BANANA.x, BANANA.z, 1.8),
    slo: perches.west.clone().add(v3(0, 1.8, 0)),
    ribbit: null,
    kami: onGround(-52, -50, 1.8),
    zaza: TREES[4].zazaAt.clone().add(v3(0, 1.8, 0)),
  };
  const toLag = v3(-LAGOON.x, 0, -LAGOON.z).normalize();
  L.npc.flora = onGround(LAGOON.x + toLag.x * (LAGOON.r + 7), LAGOON.z + toLag.z * (LAGOON.r + 7), 1.8);
  L.npc.ribbit = v3(POND.x - toPeak.x * 3 + 6, POND.y + 1.8, POND.z - toPeak.z * 3);
  const ringA = (ti, ri, k) => (k * 2.4 + ti + ri * 1.7) % TAU;
  const lagShore = (a, d) => onGround(LAGOON.x + Math.cos(a) * (LAGOON.r + d), LAGOON.z + Math.sin(a) * (LAGOON.r + d), 1.5);
  const toLagA = Math.atan2(toLag.z, toLag.x);
  L.items = {
    seeds: [ringSpot(1, 1, 0.4), ringSpot(3, 2, 2.0), ringSpot(5, 0, -1.2), ringSpot(6, 1, 1.1)],
    skyGarden: at(gardenT, gardenT.lift + Math.PI * 0.5, 5.2, gardenY + 1.6),
    berries: [], planks: [onGround(-40, -105), onGround(-118, -30), onGround(92, -32), onGround(-20, 130)],
    newBridge: newBridge.mid.clone().add(v3(0, 1.7, 0)),
    feathers: [], mangoes: [],
    pinkLagoon: v3(LAGOON.x, LAGOON.y + 2, LAGOON.z),
    shells: [lagShore(toLagA + 0.9, 6), lagShore(toLagA - 1.0, 8), lagShore(toLagA + Math.PI, 5), lagShore(toLagA + 2.2, 7)],
    flowers: [0, 1, 2, 3, 4].map((k) => onGround(MEADOW.x + Math.cos(k * 1.26 + 0.3) * MEADOW.r * 0.6, MEADOW.z + Math.sin(k * 1.26 + 0.3) * MEADOW.r * 0.6, 1.5)),
    jewels: [],
    rainbowFalls: fallBase.clone().addScaledVector(toPeak, -3.5).setY(POND.y + 2.5),
    bananas: [], lilyPads: [0, 1, 2, 3].map((k) => { const a = k * 1.4 + 2.2; return v3(POND.x + Math.cos(a) * 7, POND.y + 1.5, POND.z + Math.sin(a) * 7); }),
    glimmers: [onGround(-62, -100), onGround(118, -20), onGround(40, 118)],
    pond: v3(POND.x, POND.y + 2, POND.z),
  };
  L.wild = { beach: [], jungle: [], canopy: [], meadow: [], city: [] };
  // beach ring (not the lagoon, river mouth or pier)
  for (let k = 0; L.wild.beach.length < 12 && k < 200; k++) {
    const a = k * 0.53 + 0.2, R = coastR(a) * 0.94, x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (angDiff(a, LAG_TH) < 0.35 || angDiff(a, Math.PI) < 0.12 || angDiff(a, Math.atan2(-55, 152)) < 0.12 || angDiff(a, PEAK_TH) < 0.3) continue;
    if (L.wild.beach.some((p) => Math.hypot(p.x - x, p.z - z) < 20)) continue;
    L.wild.beach.push(onGround(x, z, 1.5));
  }
  L.wild.meadow = [0, 1, 2, 3, 4, 5].map((k) => onGround(MEADOW.x + Math.cos(k + 0.7) * MEADOW.r * 0.35, MEADOW.z + Math.sin(k + 0.7) * MEADOW.r * 0.35, 1.5));
  L.wild.city = [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0], [2, 1], [3, 1], [4, 2], [5, 1], [6, 0]].map(([ti, ri], k) => ringSpot(ti, ri, ringA(ti, ri, k) + 1, 1.5));
  for (const p of [L.landing, ...Object.values(L.npc), ...L.items.planks, ...L.items.glimmers]) avoidPts.push({ x: p.x, z: p.z, r: 5 });
  avoidPts.push({ x: GARDEN.x, z: GARDEN.z, r: 14 }, { x: -coastD + 8, z: 16, r: 6 });

  // ---------------- nature ----------------
  const jungleOk = (x, z, h) => h > SEA + 3.4 && slopeAt(x, z) < 1.5 && !isWet(x, z) && !nearTree(x, z, 'ring') && !nearBridge(x, z, 6) && !nearPath(x, z, 3.5) && Math.hypot(x - MEADOW.x, z - MEADOW.z) > MEADOW.r + 2 && Math.hypot(x - MANGO.x, z - MANGO.z) > 16 && Math.hypot(x - BANANA.x, z - BANANA.z) > 16 && pondRim(x, z) > POND.r + 6;
  const groundOk = (x, z, h) => h > SEA + 3 && !isWet(x, z) && !nearTree(x, z, 3) && !nearPath(x, z, 2);
  L.wild.jungle = scatter(12, (x, z, h) => jungleOk(x, z, h) && !nearPath(x, z, 5)).map((p) => p.add(v3(0, 1.5, 0)));
  for (const p of [...L.wild.jungle, ...L.wild.beach, ...L.wild.meadow]) avoidPts.push({ x: p.x, z: p.z, r: 3.5 });
  const trunkMat = pmat({ vertexColors: true }, 0.14);
  trunkMat.color.set(0xa07450);
  const leafMat = sway(pmat({ vertexColors: true }, 0.16, 'kelp'), 0.0012, 0.9, 'crown');
  const frondMat = sway(pmat({ vertexColors: true, side: THREE.DoubleSide }, 0.16, 'kelp'), 0.006, 1.3, 'frond');
  const plantMat = sway(pmat({ vertexColors: true, side: THREE.DoubleSide }, 0.18, 'kelp'), 0.02, 1.5, 'plant');
  const bloomMat = sway(pmat({ vertexColors: true, side: THREE.DoubleSide }, 0.3), 0.02, 1.5, 'bloom');
  const solidMat = pmat({ vertexColors: true }, 0.18);
  const rockMat = pmat({ vertexColors: true, flat: true }, 0.12, 'rock');
  function inst(geo, material, list, name) {
    if (!list.length) return null;
    if (material.vertexColors && !geo.attributes.color) geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
    const im = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, new THREE.Color(it.c ?? 0xffffff)); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.name = name;
    group.add(im); return im;
  }
  const treeCol = (p, r, top) => col({ x: p.x, z: p.z, r, bottom: p.y - 2, top });
  // jungle broadleaf trees, some with pink or purple blossom crowns
  const bl = broadleafParts(), em = emergentParts();
  const blT = [], blC = [], emT = [], emC = [];
  let nCol = 0;
  for (const p of scatter(85, jungleOk)) {
    const s = rr(1.0, 2.0), yaw = rr(0, TAU);
    blT.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s), c: pick([0xffffff, 0xf0e0d0, 0xe0d0c0]) });
    blC.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s), c: rnd() < 0.14 ? pick([0xff9ad0, 0xd8a0ff, 0xffc070]) : pick([0x5ccf5f, 0x48b85a, 0x78d85a, 0x3fae6a, 0x92dc4a]) });
    if (nCol++ < 45) treeCol(p, 0.45 * s, p.y + 6 * s);
  }
  for (const p of scatter(24, (x, z, h) => jungleOk(x, z, h) && Math.hypot(x, (z - 6) / 1.08) > 112)) {
    const s = rr(0.9, 1.3), yaw = rr(0, TAU);
    emT.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s), c: 0xffffff });
    emC.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s), c: pick([0x4cc06a, 0x6ad65a, 0x3fb873]) });
    treeCol(p, 0.75 * s, p.y + 16 * s);
  }
  // mango grove: round dark trees full of fruit
  const mangoFruit = [], mangoTrees = [];
  for (const p of scatter(8, groundOk, around(MANGO.x, MANGO.z, 15))) {
    if (mangoTrees.some((q) => q.distanceTo(p) < 7)) continue;
    const s = rr(1.1, 1.4), yaw = rr(0, TAU);
    mangoTrees.push(p);
    blT.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s), c: 0xffffff });
    blC.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s, s * 0.9, s), c: 0x2f9a4a });
    treeCol(p, 0.45 * s, p.y + 6 * s);
    for (let k = 0; k < 9; k++) { const a = k * 0.7 + rr(-0.2, 0.2); mangoFruit.push({ m: mat(p.x + Math.cos(a) * 2.6 * s, p.y + (5.4 + (k % 3) * 0.6) * s, p.z + Math.sin(a) * 2.6 * s, 0, 0, 0.3, 0.5, 0.7, 0.5), c: pick([0xffa020, 0xff7a20, 0xffd030, 0xff5a3a]) }); }
  }
  L.items.mangoes = mangoTrees.slice(0, 3).map((p) => onGround(p.x + 3.2, p.z + 1.5, 1.5));
  inst(bl.trunk, trunkMat, blT, 'jungleTrunks');
  inst(bl.crown, leafMat, blC, 'jungleCrowns');
  inst(em.trunk, trunkMat, emT, 'tallTrunks');
  inst(em.crown, leafMat, emC, 'tallCrowns');
  inst(new THREE.SphereGeometry(1, 7, 5), solidMat, mangoFruit, 'mangoes');
  // palms on the beaches
  const pa = palmParts(), palmT = [], palmF = [];
  const palmSpots = scatter(50, (x, z, h) => h > SEA + 0.9 && h < SEA + 4.5 && !isWet(x, z) && Math.hypot(x + coastD, z) > 9, () => { const a = rr(0, TAU); return [Math.cos(a) * coastR(a) * rr(0.8, 0.95), Math.sin(a) * coastR(a) * rr(0.8, 0.95)]; });
  palmSpots.forEach((p, i) => {
    const s = rr(0.9, 1.4), yaw = Math.atan2(-p.z, p.x) + rr(-0.5, 0.5) + Math.PI; // lean towards the sea
    palmT.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s), c: 0xffffff });
    palmF.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s), c: pick([0x5ccf5f, 0x78d85a, 0x48b85a]) });
    if (i < 16) treeCol(p, 0.35 * s, p.y + 9 * s);
  });
  // the pink lagoon: palms leaning over the water, pink flowers and big conch shells round the shore
  for (let k = 0; k < 5; k++) {
    const a = toLagA + 0.5 + k * 1.15, x = LAGOON.x + Math.cos(a) * (LAGOON.r + 3.5), z = LAGOON.z + Math.sin(a) * (LAGOON.r + 3.5), y = localHeight(x, z), s = rr(1.1, 1.4);
    const m = new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(-a + Math.PI)).multiply(new THREE.Matrix4().makeScale(s, s, s));
    palmT.push({ m, c: 0xffffff }); palmF.push({ m, c: pick([0x5ccf5f, 0x78d85a]) });
  }
  inst(pa.trunk, trunkMat, palmT, 'palmTrunks');
  inst(pa.fronds, frondMat, palmF, 'palmFronds');
  // hammock between the two palms nearest the landing
  {
    const byDist = palmSpots.slice().sort((a, b) => Math.hypot(a.x - L.landing.x, a.z - L.landing.z) - Math.hypot(b.x - L.landing.x, b.z - L.landing.z));
    const mate = byDist.slice(1).find((q) => { const d = Math.hypot(q.x - byDist[0].x, q.z - byDist[0].z); return d > 7 && d < 16 && Math.abs(q.y - byDist[0].y) < 1.5; });
    const near = mate ? [byDist[0], mate] : [];
    if (near.length === 2) {
      const a = near[0].clone().add(v3(0, 3, 0)), b = near[1].clone().add(v3(0, 3, 0));
      const pts = catenary(a, b, 1.8, 10), dir = b.clone().sub(a).setY(0).normalize();
      pts.slice(2, 9).forEach((p) => city.push({ geo: new THREE.BoxGeometry(1.6, 0.1, a.distanceTo(b) / 10 + 0.1), matrix: boxM(p, dir, 1, 1, 1).multiply(new THREE.Matrix4()), color: pick([0xff7a9a, 0xffe066, 0x6fc8ff]) }));
      ropeLines.push(pts);
    }
  }
  // undergrowth: ferns, monstera, giant flowers, mushrooms, grass
  const fernL = scatter(95, (x, z, h) => groundOk(x, z, h) && Math.hypot(x - MEADOW.x, z - MEADOW.z) > MEADOW.r - 4 && h > SEA + 3.5).map((p) => ({ m: mat(p.x, p.y - 0.1, p.z, 0, rr(0, TAU), 0, rr(1.0, 2.2)), c: pick([0x5ccf5f, 0x7ad65a, 0x3fb873, 0x9ae06a]) }));
  inst(fernGeo(), plantMat, fernL, 'ferns');
  const monL = scatter(64, (x, z, h) => groundOk(x, z, h) && h > SEA + 3.5 && Math.hypot(x - MEADOW.x, z - MEADOW.z) > MEADOW.r).map((p) => ({ m: mat(p.x, p.y - 0.1, p.z, 0, rr(0, TAU), 0, rr(1.2, 2.4)), c: pick([0x2f9a4a, 0x3fae5a, 0x4cc06a]) }));
  inst(monsteraGeo(), plantMat, monL, 'monstera');
  const fl = flowerParts(), flS = [], flH = [];
  for (const p of scatter(100, (x, z, h) => groundOk(x, z, h) && h > SEA + 3.2)) {
    const s = rr(1.0, 2.0), yaw = rr(0, TAU);
    flS.push({ m: mat(p.x, p.y - 0.1, p.z, 0, yaw, 0, s), c: pick([0x6fcf5a, 0x8fe06a]) });
    flH.push({ m: mat(p.x, p.y - 0.1, p.z, 0, yaw, 0, s), c: pick([0xff5a8a, 0xff8a3d, 0xffd84a, 0xc86bff, 0xff6fd8, 0x5ad0ff, 0xffffff]) });
  }
  for (const p of skyBlooms) { const s = rr(0.9, 1.3), yaw = rr(0, TAU); flS.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s), c: 0x7ad65a }); flH.push({ m: mat(p.x, p.y, p.z, 0, yaw, 0, s), c: pick([0xff5a8a, 0xffd84a, 0xc86bff, 0x5ad0ff]) }); }
  inst(fl.stem, plantMat, flS, 'flowerStems');
  inst(fl.head, bloomMat, flH, 'flowerHeads');
  const mu = mushroomParts(), muS = [], muC = [];
  for (const p of scatter(50, (x, z, h) => groundOk(x, z, h) && (nearTree(x, z, 26) || fbm(x * 0.05, z * 0.05, 2) > 0.55))) {
    const s = rr(0.6, 2.2), yaw = rr(0, TAU);
    muS.push({ m: mat(p.x, p.y - 0.1, p.z, 0, yaw, 0, s), c: 0xfff6e8 });
    muC.push({ m: mat(p.x, p.y - 0.1, p.z, 0, yaw, 0, s), c: pick([0xff4a5a, 0xff8a3d, 0xc86bff, 0x4ab8ff, 0xff7ab8]) });
  }
  inst(mu.stem, solidMat, muS, 'mushroomStems');
  inst(mu.cap, solidMat, muC, 'mushroomCaps');
  const grassL = scatter(500, (x, z, h) => h > SEA + 3.3 && !isWet(x, z) && !nearPath(x, z, 1.5) && !nearTree(x, z, 1)).map((p) => ({ m: mat(p.x, p.y - 0.05, p.z, 0, rr(0, TAU), 0, rr(1, 2.4)), c: new THREE.Color().setHSL(rr(0.24, 0.36), 0.6, rr(0.42, 0.6)) }));
  inst(grassGeo(), plantMat, grassL, 'grass');
  // flower meadow
  const meadowL = [];
  for (const p of scatter(200, (x, z, h) => h > SEA + 3 && !nearPath(x, z, 1.5), around(MEADOW.x, MEADOW.z, MEADOW.r))) meadowL.push({ m: mat(p.x, p.y - 0.05, p.z, 0, rr(0, TAU), 0, rr(1.4, 2.4)), c: pick(FLOWERS) });
  for (const it of flowerBedFlowers) meadowL.push(it);
  // Pavo's garden by the waterfall: round flower beds and a ring of tall flowers
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6, x = GARDEN.x + Math.cos(a) * 7, z = GARDEN.z + Math.sin(a) * 7, y = localHeight(x, z);
    city.push({ geo: new THREE.CylinderGeometry(2.4, 2.6, 0.6, 12), matrix: mat(x, y + 0.1, z), color: 0xfff0f6 });
    for (let j = 0; j < 12; j++) { const b = rr(0, TAU), d = Math.sqrt(rnd()) * 2; meadowL.push({ m: mat(x + Math.cos(b) * d, y + 0.4, z + Math.sin(b) * d, 0, rr(0, TAU), 0, rr(1.2, 1.8)), c: pick([0x5ad0ff, 0x3a8aff, 0x8a5aff, 0x3ad8a0, 0xffd84a]) }); }
  }
  city.push({ geo: new THREE.TorusGeometry(3.2, 0.25, 5, 16, Math.PI), matrix: mat(GARDEN.x, localHeight(GARDEN.x, GARDEN.z) + 0.1, GARDEN.z - 10, 0, 0.3, 0), color: 0xffffff });
  for (let k = 0; k < 60; k++) {
    const a = rr(0, TAU), d = LAGOON.r + rr(2.5, 9), x = LAGOON.x + Math.cos(a) * d, z = LAGOON.z + Math.sin(a) * d;
    if (avoidPts.some((p) => Math.hypot(p.x - x, p.z - z) < 2.5)) continue;
    meadowL.push({ m: mat(x, localHeight(x, z) - 0.05, z, 0, rr(0, TAU), 0, rr(1.4, 2.2)), c: pick([0xff7ab8, 0xffffff, 0xff9ad0, 0xffb8e0]) });
  }
  inst(smallFlowerGeo(), bloomMat, meadowL, 'meadowFlowers');
  // berry bushes (five special ones for the quest), banana grove, rocks
  const bu = bushParts(), buB = [], buR = [];
  const berrySites = [[-70, 18], [-112, 8], [30, 40], [-30, 110], [96, -8]];
  const bushSpots = berrySites.map(([x, z]) => onGround(x, z, 0)).concat(scatter(20, groundOk));
  bushSpots.forEach((p, i) => {
    const s = i < 5 ? 1.6 : rr(0.9, 1.6), yaw = rr(0, TAU);
    buB.push({ m: mat(p.x, p.y - 0.1, p.z, 0, yaw, 0, s), c: pick([0x4cc06a, 0x5ccf5f, 0x3fae5a]) });
    buR.push({ m: mat(p.x, p.y - 0.1, p.z, 0, yaw, 0, s), c: i < 5 ? [0xff3a5a, 0x5a6aff, 0xc84aff, 0xff3a5a, 0x5a6aff][i] : pick([0xff3a5a, 0x5a6aff, 0xc84aff, 0xffffff]) });
  });
  L.items.berries = bushSpots.slice(0, 5).map((p) => onGround(p.x + 3, p.z, 1.5));
  inst(bu.bush, leafMat, buB, 'bushes');
  inst(bu.berries, solidMat, buR, 'berries');
  const ba = bananaParts(), baP = [], baB = [];
  const bananaSpots = scatter(14, groundOk, around(BANANA.x, BANANA.z, 15));
  bananaSpots.forEach((p) => { const s = rr(1.1, 1.6), yaw = rr(0, TAU); baP.push({ m: mat(p.x, p.y - 0.1, p.z, 0, yaw, 0, s), c: pick([0x78d85a, 0x5ccf5f, 0x9ae06a]) }); baB.push({ m: mat(p.x, p.y - 0.1, p.z, 0, yaw, 0, s), c: 0xffffff }); });
  L.items.bananas = bananaSpots.slice(0, 4).map((p) => onGround(p.x + 2.5, p.z - 1.5, 1.5));
  inst(ba.plant, frondMat, baP, 'bananaPlants');
  inst(ba.bunch, solidMat, baB, 'bananaBunches');
  const rockL = [];
  const rockSpots = scatter(14, (x, z, h) => h > SEA + 4 && !isWet(x, z), around(PEAK.x, PEAK.z + 25, 30))
    .concat(scatter(16, (x, z, h) => h > SEA + 0.5 && h < SEA + 3 && !isWet(x, z) && Math.hypot(x + coastD, z) > 12, () => { const a = rr(0, TAU); return [Math.cos(a) * coastR(a) * 0.97, Math.sin(a) * coastR(a) * 0.97]; }))
    .concat(scatter(8, (x, z, h) => groundOk(x, z, h)));
  // boulders round the pond, where the jewels hide
  const pondRocks = [-1.6, -1.0, 1.0, 1.6, 2.4].map((da) => { const a = Math.atan2(toPeak.z, toPeak.x) + da, d = POND.r + 4.5; return onGround(POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d, 0); });
  const lipSide = v3(-toPeak.z, 0, toPeak.x);
  const lipRocks = [-6.5, 6.5, -4.5, 4.5].map((o, i) => onGround(lip.x + lipSide.x * o + toPeak.x * (i < 2 ? 1 : 3.5), lip.z + lipSide.z * o + toPeak.z * (i < 2 ? 1 : 3.5), -0.8));
  for (const p of [...pondRocks, ...lipRocks, ...rockSpots]) {
    const s = rr(1.4, 3.6);
    rockL.push({ m: mat(p.x, p.y + s * 0.3, p.z, rr(0, 3), rr(0, 6), 0, s, s * rr(0.6, 1), s), c: pick([0xb0a8d0, 0xc8bcd8, 0xa8b8c8, 0xd8c8b0]) });
    if (s > 2.6) col({ x: p.x, z: p.z, r: s * 0.9, top: p.y + s * 1.2 });
  }
  L.items.jewels = [pondRocks[0], pondRocks[2], pondRocks[4]].map((p) => { const d = v3(p.x - POND.x, 0, p.z - POND.z).normalize(); return onGround(p.x + d.z * 4.5, p.z - d.x * 4.5, 1.6); });
  inst(lumpify(new THREE.IcosahedronGeometry(1, 1), 0.25, 1.4, 5), rockMat, rockL, 'rocks');
  // lily pads and lotus flowers on the pond
  const padL = [], lotusL = [];
  for (let k = 0; k < 22; k++) {
    const a = rr(0, TAU), d = rr(2, POND.r - 0.5), x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d;
    if (Math.hypot(x - fallBase.x, z - fallBase.z) < 5) continue;
    padL.push({ m: mat(x, POND.y + 0.06, z, 0, rr(0, TAU), 0, rr(1, 1.9)), c: pick([0x5ccf5f, 0x7ad65a, 0x48b85a]) });
    if (k % 3 === 0) lotusL.push({ m: mat(x, POND.y + 0.1, z, 0, rr(0, TAU), 0, rr(0.6, 0.9)), c: pick([0xff9ac8, 0xffffff, 0xffb8e0]) });
  }
  for (const p of L.items.lilyPads) padL.push({ m: mat(p.x, POND.y + 0.07, p.z, 0, rr(0, TAU), 0, 2.4), c: 0x6ad65a });
  padL.push({ m: mat(L.npc.ribbit.x, POND.y + 0.07, L.npc.ribbit.z, 0, 1, 0, 3), c: 0x5ccf5f });
  inst(new THREE.CircleGeometry(1, 12, 0.3, TAU - 0.6).rotateX(-Math.PI / 2), pmat({ side: THREE.DoubleSide }, 0.15), padL, 'lilyPads');
  inst(merge(Array.from({ length: 7 }, (_, i) => ({ geo: leafStrip(1.1, 0.7, -0.2, 0.9, 3), matrix: yt(0, 0, 0, i * TAU / 7, -0.2) }))), bloomMat, lotusL, 'lotus');
  // shells and starfish on the beaches
  const shellL = scatter(55, (x, z, h) => h > SEA + 0.4 && h < SEA + 2.8 && !isWet(x, z), () => { const a = rr(0, TAU); return [Math.cos(a) * coastR(a) * rr(0.88, 0.99), Math.sin(a) * coastR(a) * rr(0.88, 0.99)]; })
    .concat(scatter(20, (x, z, h) => h > LAGOON.y + 0.2 && h < SEA + 2.5, around(LAGOON.x, LAGOON.z, LAGOON.r + 14)))
    .map((p) => ({ m: mat(p.x, p.y + 0.05, p.z, 0, rr(0, TAU), 0, rr(0.6, 1.1)), c: pick([0xff8a6a, 0xffb3c8, 0xffe08a, 0xfff6ee, 0xc8a8ff]) }));
  const star = merge(Array.from({ length: 5 }, (_, i) => ({ geo: new THREE.ConeGeometry(0.22, 0.9, 4).rotateZ(-Math.PI / 2).translate(0.45, 0, 0), matrix: mat(0, 0.08, 0, 0, i * TAU / 5, 0, 1, 0.4, 1) })));
  inst(star, solidMat, shellL, 'starfish');

  // ---------------- merge the city and the giant trees ----------------
  const cityMesh = new THREE.Mesh(shade(merge(city), (x, y, z) => 0.93 + 0.12 * noise2(x * 0.4, z * 0.4 + y * 0.2)), cityM);
  cityMesh.name = 'treetopTown'; group.add(cityMesh);
  const barkMesh = new THREE.Mesh(shade(merge(bark), (x, y, z) => 0.78 + 0.35 * noise2((x + z) * 0.35, y * 0.04)), pmat({ vertexColors: true }, 0.13));
  barkMesh.name = 'giantTrunks'; group.add(barkMesh);
  const leafMesh = new THREE.Mesh(shade(merge(leaves), (x, y, z, ny) => 0.7 + 0.4 * (ny * 0.5 + 0.5)), pmat({ vertexColors: true }, 0.16, 'kelp'));
  leafMesh.name = 'giantCanopies'; group.add(leafMesh);
  inst(new THREE.BoxGeometry(1, 1, 1), pmat({}, 0.15), planks, 'planks');
  const newPlanks = inst(new THREE.BoxGeometry(1, 1, 1), pmat({}, 0.15), newBridge.planks, 'newBridgePlanks');
  if (newPlanks) newPlanks.visible = false;
  inst(new THREE.OctahedronGeometry(1, 0), bloomMat, blossoms.map((b) => ({ m: b.m.clone().multiply(new THREE.Matrix4().makeScale(0.35, 0.22, 0.35)), c: b.c })), 'blossoms');
  {
    const vg = new THREE.PlaneGeometry(0.5, 1, 1, 6).translate(0, -0.5, 0);
    const vineMat = pmat({ side: THREE.DoubleSide }, 0.18, 'kelp');
    inject(vineMat, { key: 'ivine', uniforms: { uTime: U.uTime }, vertex: `{ vec3 b = instanceMatrix[3].xyz; float k = -position.y; transformed.x += sin(uTime * 1.1 + b.x * 0.3 + b.z * 0.2) * k * k * 0.35; }` });
    inst(vg, vineMat, vines, 'vines');
  }
  // windows (warm glass) with wooden frames
  const winList = windows.map((m) => ({ m, c: 0xffffff }));
  inst(new THREE.CircleGeometry(1, 10), pmat({ color: 0xfff0b0, emissive: 0xc08a30 }, 0.1), winList, 'windows');
  inst(new THREE.RingGeometry(1, 1.28, 8).translate(0, 0, 0.02), pmat({ color: WOOD2 }, 0.12), winList, 'windowFrames');
  // lanterns with soft glows
  inst(new THREE.OctahedronGeometry(0.5, 0), pmat({}, 0.65), lanterns.map((l) => ({ m: mat(l.p.x, l.p.y, l.p.z, 0, 0, 0, 0.9, 1.2, 0.9), c: l.c })), 'lanterns');
  const glowPos = new Float32Array(lanterns.length * 3), glowCol = new Float32Array(lanterns.length * 3), cc = new THREE.Color();
  lanterns.forEach((l, i) => { glowPos.set([l.p.x, l.p.y, l.p.z], i * 3); cc.set(l.c); glowCol.set([cc.r, cc.g, cc.b], i * 3); });
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3)); glowGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
  const glowMat = new THREE.PointsMaterial({ map: glowTexture(), size: 2.6, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  const glows = new THREE.Points(glowGeo, glowMat); glows.name = 'lanternGlows'; group.add(glows);
  // ropes and lantern strings (thin lines)
  {
    const seg = [];
    for (const pts of ropeLines) for (let i = 0; i < pts.length - 1; i++) seg.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x8a6a4a })));
  }
  // bunting flags: little triangles along strings, fluttering in the wind
  {
    const pos = [], cols = [], flap = [], seg = [];
    let ci = 0;
    const tri = (a, b, tip, color) => { cc.set(color); pos.push(...a.toArray(), ...b.toArray(), ...tip.toArray()); for (let i = 0; i < 3; i++) cols.push(cc.r, cc.g, cc.b); flap.push(0, 0, 1); };
    for (const ln of buntingLines) {
      if (ln.flag) { const s = ln.size || 1; tri(ln.p, ln.p.clone().add(v3(0, -1.6 * s, 0)), ln.p.clone().addScaledVector(ln.dir, 3 * s).add(v3(0, -0.8 * s, 0)), ln.color); continue; }
      const [a, b, sag] = ln, n = Math.max(2, Math.round(a.distanceTo(b) / 1.1));
      const pts = catenary(a, b, sag, n);
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[i + 1];
        seg.push(p.x, p.y, p.z, q.x, q.y, q.z);
        const m0 = p.clone().lerp(q, 0.15), m1 = p.clone().lerp(q, 0.85), tip = p.clone().lerp(q, 0.5).add(v3(0, -0.85, 0));
        tri(m0, m1, tip, RAINBOW[ci++ % RAINBOW.length]);
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); bg.setAttribute('flap', new THREE.Float32BufferAttribute(flap, 1));
    bg.computeVertexNormals();
    const bm = pmat({ vertexColors: true, side: THREE.DoubleSide }, 0.22);
    inject(bm, { key: 'ibunting', uniforms: { uTime: U.uTime }, vertexHead: 'attribute float flap;', vertex: `transformed += vec3(sin(uTime * 4.0 + position.x * 0.9 + position.z * 0.6), 0.2 * sin(uTime * 3.0 + position.z), cos(uTime * 3.5 + position.x * 0.5)) * 0.3 * flap;` });
    const bunt = new THREE.Mesh(bg, bm); bunt.name = 'bunting'; group.add(bunt);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    group.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xffffff })));
  }

  // ---------------- remaining spots ----------------
  // feathers and birds' perches out on the canopy edges, clear of every leaf core
  const freeAir = (p, r = 1.6) => !solids.some((s) => Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) < s.r + r);
  // a point on the top of a leaf blob, `out` of the way from its centre towards the outside of the tree
  const blobTop = (t, b, out, up) => { const d = v3(b.x - t.x, 0, b.z - t.z).normalize().multiplyScalar(b.r * 0.78 * out); const p = v3(b.x + d.x, 0, b.z + d.z); p.y = floorLocal(p.x, p.z, 1e4) + up; return p; };
  for (const ti of [1, 3, 4, 6, 5]) {
    const t = TREES[ti];
    for (const b of t.blobs) { const p = blobTop(t, b, 0.45, 1.6); if (freeAir(p, 1.3) && L.items.feathers.length < 4 && !L.items.feathers.some((q) => q.distanceTo(p) < 30)) { L.items.feathers.push(p); break; } }
  }
  for (const t of TREES) for (const b of t.blobs.filter((b) => b.r > 7).slice(1, 3)) { const p = blobTop(t, b, 0.6, 1.6); if (L.wild.canopy.length < 10 && freeAir(p, 1.3) && !L.wild.canopy.some((q) => q.distanceTo(p) < 8)) L.wild.canopy.push(p); }

  colliders.length - colStart > 250 && console.warn('paradise island: many colliders', colliders.length - colStart);

  // settle: nudge any spot out of this island's colliders, keeping its height above the floor
  const mine = colliders.slice(colStart);
  const settle = (p) => {
    const up = p.y - floorLocal(p.x, p.z, p.y), w = W(p);
    for (let it = 0; it < 4; it++) for (const c of mine) {
      if (w.y > c.top + 1.4 || (c.bottom !== undefined && w.y < c.bottom - 1.4)) continue;
      if (c.hw !== undefined) continue;
      const dx = w.x - c.x, dz = w.z - c.z, d = Math.hypot(dx, dz), min = c.r + 1.5;
      if (d < min) { const k = d > 1e-4 ? min / d : 1; w.x = c.x + (d > 1e-4 ? dx * k : min); w.z = c.z + dz * k; }
    }
    p.x = w.x - C.x; p.z = w.z - C.z; p.y = floorLocal(p.x, p.z, p.y + 3) + up;
  };
  const settleAll = (o) => { if (o instanceof THREE.Vector3) settle(o); else Object.values(o).forEach(settleAll); };
  settleAll([L.landing, L.npc, L.items, L.wild]);

  // ---------------- API ----------------
  const toW = (o) => (Array.isArray(o) ? o.map(toW) : o instanceof THREE.Vector3 ? W(o) : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toW(v)])));
  const spots = { landing: W(L.landing), npc: toW(L.npc), items: toW(L.items), wild: toW(L.wild) };

  function floorLocal(x, z, y) {
    let f = groundLocal(x, z);
    const yq = y + 0.5;
    for (const p of F.rings) { if (p.top > yq || p.top <= f) continue; const d = Math.hypot(x - p.x, z - p.z); if (d >= p.inner && d <= p.outer) f = p.top; }
    for (const p of F.discs) { if (p.top > yq || p.top <= f) continue; if (Math.hypot(x - p.x, z - p.z) <= p.r) f = p.top; }
    for (const p of F.roofs) { if (p.top > yq || p.top <= f) continue; if (Math.hypot(x - p.x, z - p.z) <= p.r) f = p.top; }
    for (const p of F.boxes) {
      if (p.top > yq || p.top <= f) continue;
      const dx = x - p.x, dz = z - p.z, cs = Math.cos(p.yaw), sn = Math.sin(p.yaw);
      if (Math.abs(dx * cs + dz * sn) <= p.hw && Math.abs(-dx * sn + dz * cs) <= p.hd) f = p.top;
    }
    for (const h of F.helices) {
      const dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz);
      if (d > trunkR(h.t, 0) + 5 || yq < h.g) continue;
      const base = ((Math.atan2(dz, dx) - h.phase) % TAU + TAU) % TAU;
      const lim = Math.min(yq, h.yMax) - h.g;
      const th = base + TAU * Math.floor((lim / h.risePerRad - base) / TAU);
      if (th < 0) continue;
      const ys = h.g + th * h.risePerRad, tr = trunkR(h.t, ys - h.g);
      if (d >= tr + 0.3 && d <= tr + 4.8 && ys > f) f = ys;
    }
    for (const s of solids) {
      const dx = x - s.x, dz = z - s.z, d2 = s.r * s.r - dx * dx - dz * dz;
      if (d2 <= 0) continue;
      const top = s.y + Math.sqrt(d2);
      if (top <= yq && top > f) f = top;
    }
    for (const b of F.bridges) {
      const [d, t] = segDist(x, z, b.ax, b.az, b.bx, b.bz);
      if (d > b.hw) continue;
      if (b.gap && !newBridge.built && t > b.gap[0] && t < b.gap[1]) continue;
      const yb = lerp(b.ya, b.yb, t) - b.sag * 4 * t * (1 - t);
      if (yb <= yq && yb > f) f = yb;
    }
    return f;
  }
  const far = (lx, lz) => Math.abs(lx) > 205 || Math.abs(lz) > 205;
  return {
    group, center: C.clone(), radius: RADIUS, spots,
    height(x, z) { const lx = x - C.x, lz = z - C.z; return far(lx, lz) ? SEA - 20 : localHeight(lx, lz); },
    floor(x, z, y) { const lx = x - C.x, lz = z - C.z; return far(lx, lz) ? SEA - 20 : floorLocal(lx, lz, y); },
    limit(p, r = 1) {
      const lx = p.x - C.x, lz = p.z - C.z;
      if (far(lx, lz) || p.y < SEA + 8) return false;
      for (const s of solids) {
        const dx = lx - s.x, dy = p.y - s.y, dz = lz - s.z, d = Math.hypot(dx, dy, dz), min = s.r + r;
        if (d < min && d > 1e-4) { const k = min / d; p.x = C.x + s.x + dx * k; p.y = s.y + dy * k; p.z = C.z + s.z + dz * k; }
      }
      return false;
    },
    camLimit(desired, target) {
      const lx = desired.x - C.x, lz = desired.z - C.z;
      if (far(lx, lz)) return desired;
      for (const t of TREES) {
        const yr = desired.y - t.g; if (yr < -2 || yr > t.h) continue;
        const dx = lx - t.x, dz = lz - t.z, d = Math.hypot(dx, dz), min = trunkR(t, yr) + 0.8;
        if (d < min && d > 1e-4) { desired.x = C.x + t.x + dx / d * min; desired.z = C.z + t.z + dz / d * min; }
      }
      for (const h of houses) {
        if (desired.y < h.bottom || desired.y > h.top) continue;
        const dx = desired.x - C.x - h.x, dz = desired.z - C.z - h.z, d = Math.hypot(dx, dz), min = h.r + 0.5;
        if (d < min && d > 1e-4) { desired.x = C.x + h.x + dx / d * min; desired.z = C.z + h.z + dz / d * min; }
      }
      desired.y = Math.max(desired.y, localHeight(desired.x - C.x, desired.z - C.z) + 0.8);
      return desired;
    },
    // The builders' bridge starts with a gap in the middle; call this when its planks are brought.
    finishBridge() { newBridge.built = true; if (newPlanks) newPlanks.visible = true; },
    update(dt, t) {
      U.uTime.value = t;
      for (const s of anim.swings) s.mesh.rotation.x = Math.sin(t * 1.6 + s.phase) * s.amp;
      for (const l of anim.lifts) { const u = 0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, Math.sin((t + l.phase) * 0.12) * 1.4 + 0.5)) * Math.PI); l.mesh.position.y = lerp(l.y0, l.y1, u); }
      for (const c of anim.crates) { c.rotation.z = Math.sin(t * 0.9) * 0.08; c.rotation.x = Math.cos(t * 0.7) * 0.06; }
      glowMat.opacity = 0.62 + 0.1 * Math.sin(t * 2.3);
      for (let i = 0; i < MIST + SMOKE; i++) {
        const [a, b, c] = mistSeed[i];
        const u = (t * (i < MIST ? 0.35 : 0.12) + a) % 1;
        let x, y, z;
        if (i < MIST) { const ang = b * TAU, r = 1 + u * 7; x = fallBase.x + Math.cos(ang) * r; z = fallBase.z + Math.sin(ang) * r; y = POND.y + 0.5 + u * 5 * c; }
        else { x = anim.smoke.x + Math.sin(u * 6 + b * 6) * u * 1.5; z = anim.smoke.z + Math.cos(u * 5 + c * 6) * u * 1.5; y = anim.smoke.y + u * 9; }
        mistPos[i * 3] = x; mistPos[i * 3 + 1] = y; mistPos[i * 3 + 2] = z;
      }
      mistGeo.attributes.position.needsUpdate = true;
    },
  };
}
