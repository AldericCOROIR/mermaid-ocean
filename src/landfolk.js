// Land folk of the surface islands: the birds, beasts and chibi townsfolk of
// Paradise Island (jungle + tree city) and Skull Island (pirate cove), plus the
// little behaviour classes that bring them to life (Flyer, Hopper, Walker,
// Percher, Floater). Same chunky, round, big-eyed style as seafolk.js.
import * as THREE from 'three';
import { segment, paintMat } from './geom.js';
import { mulberry32, glowTexture } from './util.js';
import { pirateHat } from './seafolk.js';
import { crabModel } from './creatures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const rnd = mulberry32(7310); // own stream: never disturbs the world's seeded layout

// ---------- shared materials & geometry ----------
const MATS = new Map();
// Painted lambert with a soft emissive so the shadow side stays bright and friendly.
function pm(color, k = 0.28, extra) {
  const key = extra ? null : `${color}|${k}`;
  if (key && MATS.has(key)) return MATS.get(key);
  const m = paintMat({ color, emissive: new THREE.Color(color).multiplyScalar(k), ...(extra || {}) });
  if (key) MATS.set(key, m);
  return m;
}
function basic(color) {
  const key = 'b' + color;
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshBasicMaterial({ color }));
  return MATS.get(key);
}
const lt = (c, k) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), k).getHex();
const dk = (c, k) => new THREE.Color(c).multiplyScalar(1 - k).getHex();

const SPH = new Map();
function unitSphere(w, h) {
  const key = w * 100 + h;
  if (!SPH.has(key)) SPH.set(key, new THREE.SphereGeometry(1, w, h));
  return SPH.get(key);
}
// A (possibly squashed) sphere. Detail follows the size so tiny bits stay cheap.
function ball(parent, r, m, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, detail = null) {
  const big = r * Math.max(sx, sy, sz);
  const geo = detail ? unitSphere(detail[0], detail[1]) : big >= 0.32 ? unitSphere(13, 9) : big >= 0.15 ? unitSphere(10, 7) : big >= 0.075 ? unitSphere(7, 5) : unitSphere(6, 4);
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z); me.scale.set(r * sx, r * sy, r * sz);
  parent.add(me);
  return me;
}
function cone(parent, r, h, m, x, y, z, rx = 0, ry = 0, rz = 0, seg = 8) {
  const me = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
  me.position.set(x, y, z); me.rotation.set(rx, ry, rz);
  parent.add(me);
  return me;
}
function limb(parent, a, b, r0, r1, m, radial = 6) {
  const me = new THREE.Mesh(segment(a, b, r0, r1, radial), m);
  parent.add(me);
  return me;
}
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
// A smooth tube through points whose radius tapers from r0 to r1 (tails, necks).
function taperTube(points, r0, r1, seg = 14, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const p = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    curve.getPointAt(u, c);
    const r = r0 + (r1 - r0) * u;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeBoundingSphere();
  return geo;
}
function tube(parent, points, r0, r1, m, seg, radial) {
  const me = new THREE.Mesh(taperTube(points, r0, r1, seg, radial), m);
  parent.add(me);
  return me;
}

// ---------- faces ----------
// Big shiny cartoon eye: white, a large pupil (optionally with a coloured iris) and two highlights.
function eyeball(r = 0.08, iris = null) {
  const g = new THREE.Group();
  ball(g, r, basic(0xffffff), 0, 0, 0, 1, 1, 1, [10, 8]);
  if (iris !== null) ball(g, r * 0.74, basic(iris), 0, 0, r * 0.36, 1, 1, 1, [9, 6]);
  ball(g, r * (iris !== null ? 0.48 : 0.66), basic(0x1b1640), 0, 0, r * (iris !== null ? 0.62 : 0.44), 1, 1, 1, [8, 6]);
  const h = new THREE.Mesh(unitSphere(5, 4), basic(0xffffff));
  h.scale.setScalar(r * 0.24); h.position.set(-r * 0.22, r * 0.26, r * 0.96); g.add(h);
  const h2 = new THREE.Mesh(unitSphere(4, 3), basic(0xffffff));
  h2.scale.setScalar(r * 0.11); h2.position.set(r * 0.2, -r * 0.2, r * 0.98); g.add(h2);
  return g;
}
function eyes(parent, r, x, y, z, ry = 0.35, iris = null, rx = 0) {
  const out = [];
  for (const s of [-1, 1]) {
    const e = eyeball(r, iris); e.position.set(x * s, y, z); e.rotation.set(rx, ry * s, 0);
    parent.add(e); out.push(e);
  }
  return out;
}
function smile(parent, r, x, y, z, rx = 0, color = 0x6a1828, thick = Math.min(0.26 * r, 0.016)) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, Math.max(thick, 0.008), 4, 10, PI), basic(color));
  m.rotation.set(rx, 0, PI); m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const BLUSH = new THREE.MeshBasicMaterial({ color: 0xff8fb0, transparent: true, opacity: 0.75, depthWrite: false });
function cheeks(parent, r, x, y, z, ry = 0.5) {
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(unitSphere(7, 5), BLUSH);
    c.scale.set(r, r * 0.6, r * 0.25); c.position.set(x * s, y, z); c.rotation.y = ry * s;
    parent.add(c);
  }
}
function finish(g, ud) { g.userData = { ...g.userData, ...ud }; return g; }

// ---------- birds ----------
// Shared round upright bird: feet at y=0, head at about y=1. Wings hang at the
// sides (rotation.z = side * angle opens them), the tail points down & back.
function birdBase(o) {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const A = pm(o.body), W = pm(o.wing), T = pm(o.tail ?? o.wing);
  const bs = o.bodyScale ?? 1;
  ball(body, 0.36 * bs, A, 0, 0.55 * bs, 0, 1, 1.22, 1);
  if (o.belly !== undefined) ball(body, 0.27 * bs, pm(o.belly, 0.35), 0, 0.5 * bs, 0.17, 1, 1.15, 0.8);
  const head = pivot(body, 0, 0.55 * bs + 0.45, 0.04);
  ball(head, 0.3, pm(o.head ?? o.body), 0, 0, 0);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, 0.32 * bs * s, 0.78 * bs, -0.02);
    ball(w, 0.24, W, 0.02 * s, -0.24, -0.04, 0.36, 1.25, 0.95);
    if (o.wingTip !== undefined) ball(w, 0.14, pm(o.wingTip), 0.03 * s, -0.48, -0.1, 0.4, 1.0, 0.9);
    wings.push(w);
  }
  const tail = pivot(body, 0, 0.3 * bs, -0.26 * bs);
  const tl = o.tailLen ?? 1;
  for (let i = -1; i <= 1; i++) {
    const f = ball(tail, 0.1, i === 0 ? T : pm(o.tail2 ?? o.tail ?? o.wing), i * 0.07, -0.18 * tl, -0.1 * tl, 0.8, 2.6 * tl, 0.45);
    f.rotation.set(-0.55, 0, i * 0.25);
  }
  const fm = pm(o.feet ?? 0xffa040, 0.3);
  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, 0.12 * s, 0.14, 0.04);
    limb(l, V(0, 0.06, 0), V(0, -0.1, 0.02), 0.035, 0.03, fm, 5);
    ball(l, 0.075, fm, 0, -0.1, 0.07, 1.2, 0.5, 1.6);
    legs.push(l);
  }
  return finish(g, { body, head, wings, tail, legs, flyPitch: 0.9, wingOpen: 1.45 });
}

// Parrot (green & yellow by default); { hat: true } gives the pirate captain's hat,
// { macaw: true } white cheeks, wing bands and a long tail.
export function parrotModel(colorA = 0x3fd14f, colorB = 0xffd23f, opts = {}) {
  const g = birdBase({
    body: colorA, wing: colorB, wingTip: opts.macaw ? 0x2f5bff : dk(colorB, 0.25), tail: colorB, tail2: opts.macaw ? 0x2f5bff : colorA,
    belly: opts.macaw ? undefined : lt(colorA, 0.45), tailLen: opts.macaw ? 1.8 : 1.15, feet: 0x8a8aa8,
    head: opts.head,
  });
  const { head, wings } = g.userData;
  const beak = pm(0xfff0c0, 0.4);
  ball(head, 0.12, beak, 0, -0.01, 0.27, 0.9, 1, 1.05);
  cone(head, 0.075, 0.2, beak, 0, -0.1, 0.33, PI * 0.82);
  if (opts.macaw) {
    ball(head, 0.07, basic(0x222233), 0, -0.13, 0.27, 1, 0.8, 1);
    for (const s of [-1, 1]) ball(head, 0.14, pm(0xffffff, 0.5), 0.15 * s, 0.03, 0.17, 0.5, 0.95, 0.8).rotation.y = 0.5 * s;
    wings.forEach((w, i) => ball(w, 0.16, pm(0xffd23f, 0.35), 0.035 * (i ? 1 : -1), -0.14, 0.02, 0.32, 0.7, 0.9));
  } else {
    ball(head, 0.13, pm(0xff6a3d), 0, 0.17, 0.12, 1, 0.6, 1); // orange forehead
  }
  eyes(head, 0.1, 0.15, 0.07, 0.2, 0.5);
  cheeks(head, 0.06, 0.19, -0.06, 0.2);
  if (opts.hat) { const hat = pirateHat(0.52); hat.position.set(0, 0.23, -0.01); head.add(hat); }
  return g;
}
export function macawModel() { return parrotModel(0xff2d3a, 0x2f8bff, { macaw: true }); }

export function toucanModel() {
  const g = birdBase({ body: 0x343048, wing: 0x2a2640, tail: 0x2a2640, belly: 0xfff0a0, feet: 0x4aa0ff });
  const { head } = g.userData;
  ball(head, 0.2, pm(0xfff6c8, 0.45), 0, -0.04, 0.16, 1.2, 1, 0.8);
  // the famous big rainbow beak
  const bk = pivot(head, 0, 0, 0.24); bk.rotation.x = 0.18;
  ball(bk, 0.16, pm(0xff9a1f, 0.35), 0, 0.02, 0.26, 0.85, 0.9, 2.1);
  ball(bk, 0.1, pm(0xffe23a, 0.35), 0, 0.12, 0.12, 0.9, 0.55, 1.4);
  ball(bk, 0.08, pm(0xff3b3b, 0.35), 0, -0.02, 0.56, 1, 1, 1.2);
  ball(bk, 0.11, pm(0x60d860, 0.35), 0, -0.07, 0.2, 0.75, 0.5, 1.4);
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 5, 12), pm(0x3fd0ff, 0.45));
    ring.position.set(0.17 * s, 0.09, 0.19); ring.rotation.y = 0.55 * s; head.add(ring);
  }
  eyes(head, 0.09, 0.17, 0.09, 0.2, 0.55);
  cheeks(head, 0.05, 0.2, -0.05, 0.16);
  return g;
}

export function seagullModel() {
  const g = birdBase({ body: 0xfafcff, wing: 0xb4bed0, wingTip: 0x3a3a4a, tail: 0xe8eef8, tail2: 0x9aa4b8, belly: 0xffffff, feet: 0xff9a3a });
  const { head } = g.userData;
  const bm = pm(0xffd23a, 0.35);
  ball(head, 0.07, bm, 0, -0.04, 0.3, 0.9, 0.8, 1);
  cone(head, 0.07, 0.26, bm, 0, -0.04, 0.42, PI / 2);
  ball(head, 0.035, basic(0xff4040), 0, -0.08, 0.42);
  eyes(head, 0.085, 0.15, 0.07, 0.21, 0.5);
  cheeks(head, 0.05, 0.19, -0.05, 0.18);
  // a little sailor's scarf
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 14), pm(0x3f7bff, 0.35));
  sc.rotation.x = PI / 2 + 0.3; sc.position.set(0, 0.83, 0.03); g.userData.body.add(sc);
  cone(g.userData.body, 0.08, 0.16, pm(0xff5a5a, 0.35), 0, 0.74, 0.24, 0.3, 0, PI);
  return g;
}

export function pelicanModel() {
  const g = birdBase({ body: 0xfdfbf6, wing: 0xe6e2da, wingTip: 0x5a5a68, tail: 0xdedad2, belly: 0xffffff, feet: 0xffa63a, bodyScale: 1.12 });
  const { head } = g.userData;
  head.position.y += 0.08;
  ball(head, 0.14, pm(0xffe08a, 0.4), 0, 0.2, -0.02, 1, 0.6, 1.2); // yellow crown
  const top = pm(0xffb43a, 0.35);
  // long top beak and a big squishy pouch under it
  ball(head, 0.1, top, 0, 0.0, 0.55, 0.9, 0.45, 4.2);
  ball(head, 0.06, pm(0xff6a2a, 0.35), 0, -0.01, 0.95, 1, 0.8, 1.2);
  const pouch = ball(head, 0.17, pm(0xffd06a, 0.4), 0, -0.14, 0.5, 0.7, 0.85, 2.3);
  eyes(head, 0.085, 0.15, 0.1, 0.2, 0.5);
  cheeks(head, 0.05, 0.2, 0.0, 0.16);
  return finish(g, { pouch });
}

export function flamingoModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const pink = pm(0xff8fbf, 0.32), deep = pm(0xff6aa8, 0.3), legM = pm(0xff7aa8, 0.3);
  ball(body, 0.36, pink, 0, 0.95, -0.05, 0.95, 0.8, 1.3);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, 0.3 * s, 1.05, -0.05);
    ball(w, 0.28, deep, 0.02 * s, -0.1, -0.08, 0.3, 0.75, 1.2);
    ball(w, 0.12, pm(0x2a2238, 0.25), 0.02 * s, -0.14, -0.38, 0.3, 0.6, 1.1);
    wings.push(w);
  }
  const tail = pivot(body, 0, 1.0, -0.45);
  ball(tail, 0.13, deep, 0, 0.04, -0.06, 0.8, 0.6, 1.3);
  tube(body, [V(0, 1.1, 0.32), V(0, 1.4, 0.45), V(0, 1.62, 0.26), V(0, 1.85, 0.22), V(0, 2.0, 0.3)], 0.085, 0.075, pink, 14, 7);
  const head = pivot(body, 0, 2.03, 0.33);
  ball(head, 0.17, pink, 0, 0, 0, 1, 0.95, 1.05);
  limb(head, V(0, 0.0, 0.12), V(0, -0.05, 0.28), 0.065, 0.05, pm(0xfff4f0, 0.45), 6);
  limb(head, V(0, -0.05, 0.28), V(0, -0.16, 0.31), 0.05, 0.02, pm(0x2a2238, 0.25), 6);
  eyes(head, 0.07, 0.11, 0.05, 0.11, 0.6);
  cheeks(head, 0.04, 0.13, -0.04, 0.09);
  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, 0.1 * s, 0.82, 0);
    limb(l, V(0, 0, 0), V(0, -0.42, 0.02), 0.035, 0.03, legM, 5);
    ball(l, 0.045, legM, 0, -0.42, 0.02);
    limb(l, V(0, -0.42, 0.02), V(0, -0.8, 0), 0.03, 0.028, legM, 5);
    ball(l, 0.08, legM, 0, -0.8, 0.06, 1, 0.35, 1.5);
    legs.push(l);
  }
  return finish(g, { body, head, wings, tail, legs, flyPitch: 1.2, wingOpen: 1.45 });
}

export function hummingbirdModel(color = 0x2fe0b0) {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const m = pm(color, 0.3);
  ball(body, 0.24, m, 0, 0, 0, 0.9, 0.85, 1.35);
  ball(body, 0.18, pm(0xffffff, 0.45), 0, -0.07, 0.08, 0.9, 0.7, 1.2);
  const head = pivot(body, 0, 0.13, 0.27);
  ball(head, 0.2, m, 0, 0, 0);
  ball(head, 0.12, pm(0xff3a7a, 0.35), 0, -0.1, 0.07, 1.1, 0.7, 0.9); // ruby throat
  limb(head, V(0, -0.02, 0.17), V(0, -0.07, 0.62), 0.03, 0.01, basic(0x2a2238), 5);
  eyes(head, 0.085, 0.11, 0.05, 0.12, 0.6);
  cheeks(head, 0.04, 0.14, -0.04, 0.1);
  const wm = pm(lt(color, 0.6), 0.45, { transparent: true, opacity: 0.85 });
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, 0.13 * s, 0.1, 0.05);
    ball(w, 0.3, wm, 0, -0.3, -0.04, 0.08, 1, 0.35);
    w.rotation.z = 2.2 * s;
    wings.push(w);
  }
  const tail = pivot(body, 0, 0, -0.3);
  for (let i = -1; i <= 1; i++) ball(tail, 0.1, pm(dk(color, 0.25)), i * 0.06, 0, -0.12, 0.6, 0.2, 1.6).rotation.y = i * 0.35;
  return finish(g, { body, head, wings, tail, flyPitch: 0.15, wingOpen: 1.5, flapRate: 60 });
}

export function peacockModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const blue = pm(0x2f6bff, 0.32), teal = pm(0x2fc0d0, 0.3);
  // the fan tail first, so it sits behind everything
  const tail = pivot(body, 0, 0.55, -0.3);
  tail.rotation.x = -0.28;
  const fG = pm(0x38c060, 0.3), fGold = pm(0xffcf3a, 0.4), fBlue = pm(0x2a4aff, 0.35);
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = -1.3 + (2.6 * i) / (N - 1);
    const dx = Math.sin(a), dy = Math.cos(a);
    const f = ball(tail, 0.34, fG, dx * 0.62, dy * 0.62, -0.04, 0.32, 1.25, 0.1, [8, 4]); f.rotation.z = -a;
    ball(tail, 0.15, fGold, dx * 1.0, dy * 1.0, 0.0, 1, 1.15, 0.25, [7, 3]).rotation.z = -a;
    ball(tail, 0.08, fBlue, dx * 1.0, dy * 1.0, 0.035, 1, 1.15, 0.3, [6, 3]).rotation.z = -a;
  }
  ball(body, 0.33, blue, 0, 0.55, 0, 0.9, 1, 1.15);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, 0.27 * s, 0.68, -0.05);
    ball(w, 0.22, pm(0x8a6a4a, 0.3), 0.02 * s, -0.12, -0.05, 0.35, 0.9, 1.2);
    wings.push(w);
  }
  limb(body, V(0, 0.72, 0.15), V(0, 1.12, 0.26), 0.13, 0.1, blue, 8);
  const head = pivot(body, 0, 1.2, 0.28);
  ball(head, 0.17, blue, 0, 0, 0);
  for (const s of [-1, 1]) ball(head, 0.07, pm(0xffffff, 0.5), 0.11 * s, 0.02, 0.09, 0.6, 1, 0.6).rotation.y = 0.5 * s;
  cone(head, 0.045, 0.12, pm(0xd8c8a0, 0.35), 0, -0.02, 0.2, PI / 2);
  for (let i = -1; i <= 1; i++) {
    limb(head, V(0, 0.12, 0), V(i * 0.07, 0.34, -0.03 - Math.abs(i) * 0.02), 0.012, 0.012, teal, 4);
    ball(head, 0.04, teal, i * 0.07, 0.36, -0.03 - Math.abs(i) * 0.02);
  }
  eyes(head, 0.075, 0.1, 0.04, 0.12, 0.6);
  cheeks(head, 0.04, 0.13, -0.05, 0.09);
  const legs = [];
  const lm = pm(0x9a9aa8, 0.3);
  for (const s of [-1, 1]) {
    const l = pivot(body, 0.12 * s, 0.32, 0.02);
    limb(l, V(0, 0, 0), V(0, -0.3, 0.02), 0.035, 0.03, lm, 5);
    ball(l, 0.07, lm, 0, -0.3, 0.07, 1.1, 0.4, 1.5);
    legs.push(l);
  }
  return finish(g, { body, head, wings, tail, legs, flyPitch: 0.9, wingOpen: 1.45 });
}

export function butterflyModel(color = 0xff6ad5) {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const dark = pm(0x3a2a5a, 0.3);
  limb(body, V(0, 0, -0.28), V(0, 0, 0.18), 0.05, 0.06, dark, 6);
  ball(body, 0.06, dark, 0, 0, -0.28);
  const head = pivot(body, 0, 0.02, 0.27);
  ball(head, 0.11, pm(0x5a4a8a, 0.35), 0, 0, 0);
  eyes(head, 0.05, 0.055, 0.02, 0.07, 0.5);
  for (const s of [-1, 1]) {
    limb(head, V(0.03 * s, 0.07, 0), V(0.14 * s, 0.3, 0.12), 0.01, 0.01, dark, 4);
    ball(head, 0.035, pm(color), 0.14 * s, 0.3, 0.12);
  }
  const A = pm(color, 0.35), B = pm(lt(color, 0.35), 0.35), dot = pm(0xffffff, 0.5), edge = pm(dk(color, 0.35), 0.3);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, 0.03 * s, 0.02, 0);
    ball(w, 0.36, edge, 0.36 * s, 0, 0.1, 1, 0.05, 0.78).rotation.y = -0.35 * s;
    ball(w, 0.31, A, 0.35 * s, 0.01, 0.1, 1, 0.06, 0.74).rotation.y = -0.35 * s;
    ball(w, 0.25, B, 0.26 * s, 0, -0.2, 1, 0.05, 0.8).rotation.y = 0.45 * s;
    ball(w, 0.08, dot, 0.48 * s, 0.025, 0.16, 1, 0.3, 1);
    ball(w, 0.06, dot, 0.3 * s, 0.02, -0.26, 1, 0.3, 1);
    w.rotation.z = 0.6 * s;
    wings.push(w);
  }
  return finish(g, { body, head, wings, flyPitch: 0, wingOpen: 0.35, flapRate: 14 });
}

// ---------- jungle animals ----------
export function frogModel(color = 0x6fe05a) {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const m = pm(color, 0.3), belly = pm(lt(color, 0.6), 0.4);
  ball(body, 0.45, m, 0, 0.36, 0, 1.12, 0.78, 1);
  ball(body, 0.33, belly, 0, 0.3, 0.2, 1.05, 0.75, 0.85);
  const head = pivot(body, 0, 0, 0);
  for (const s of [-1, 1]) ball(head, 0.17, m, 0.22 * s, 0.66, 0.12);
  eyes(head, 0.14, 0.22, 0.72, 0.21, 0.25);
  smile(head, 0.15, 0, 0.44, 0.42, -0.35, 0x5a1828, 0.022);
  cheeks(head, 0.08, 0.32, 0.43, 0.32, 0.6);
  const spot = pm(dk(color, 0.3), 0.3);
  ball(body, 0.08, spot, 0.18, 0.62, -0.18, 1, 0.4, 1); ball(body, 0.06, spot, -0.1, 0.65, -0.25, 1, 0.4, 1);
  const legs = [];
  for (const s of [-1, 1]) {
    const back = pivot(body, 0.38 * s, 0.22, -0.12);
    ball(back, 0.2, m, 0, 0, 0, 0.75, 0.6, 1.2);
    ball(back, 0.12, m, 0.04 * s, -0.18, 0.18, 1.1, 0.35, 1.6);
    legs.push(back);
  }
  for (const s of [-1, 1]) {
    limb(body, V(0.22 * s, 0.25, 0.3), V(0.26 * s, 0.02, 0.38), 0.06, 0.05, m, 5);
    ball(body, 0.08, m, 0.27 * s, 0.03, 0.42, 1.2, 0.4, 1.1);
  }
  return finish(g, { body, head, legs });
}

// Hangs by its arms: the origin is the grip point on the branch, the body dangles below.
export function slothModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const fur = pm(0xb08a66, 0.3), face = pm(0xf4e4c8, 0.45), mask = pm(0x6a4a34, 0.25), claw = pm(0xfff0d8, 0.4);
  ball(body, 0.4, fur, 0, -1.02, 0, 1, 1.2, 0.9);
  ball(body, 0.27, pm(0xd0b08c, 0.35), 0, -1.06, 0.23, 1, 1.2, 0.6);
  const head = pivot(body, 0, -0.5, 0.06);
  ball(head, 0.32, fur, 0, 0, 0);
  ball(head, 0.27, face, 0, -0.02, 0.1, 1.05, 0.85, 0.85);
  for (const s of [-1, 1]) {
    const p = ball(head, 0.1, mask, 0.12 * s, 0.0, 0.29, 1.3, 0.75, 0.4); p.rotation.z = -0.4 * s;
  }
  eyes(head, 0.07, 0.12, 0.01, 0.31, 0.3);
  ball(head, 0.06, basic(0x3a2418), 0, -0.07, 0.35, 1.2, 0.8, 0.8);
  smile(head, 0.06, 0, -0.14, 0.33, -0.2);
  cheeks(head, 0.05, 0.2, -0.1, 0.25);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = pivot(body, 0.3 * s, -0.78, 0.02);
    limb(a, V(0, 0, 0), V(-0.06 * s, 0.74, 0), 0.1, 0.085, fur, 7);
    ball(a, 0.1, fur, -0.06 * s, 0.76, 0);
    for (let i = -1; i <= 1; i++) cone(a, 0.025, 0.12, claw, -0.06 * s + i * 0.04, 0.84, 0.08, -2.2);
    arms.push(a);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, 0.22 * s, -1.35, 0.05);
    limb(l, V(0, 0, 0), V(0.05 * s, -0.25, 0.08), 0.1, 0.09, fur, 7);
    ball(l, 0.1, fur, 0.05 * s, -0.27, 0.1);
    legs.push(l);
  }
  // a little leaf to munch
  const leaf = ball(head, 0.09, pm(0x6fdc5a, 0.35), 0.06, -0.17, 0.36, 1.2, 0.2, 0.6); leaf.rotation.z = 0.5;
  return finish(g, { body, head, arms, legs, hangs: true });
}

export function monkeyModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const fur = pm(0x9a6440, 0.3), face = pm(0xf6d8b4, 0.42), pink = pm(0xffb0b8, 0.4);
  ball(body, 0.3, fur, 0, 0.45, 0, 1, 1.1, 0.9);
  ball(body, 0.2, face, 0, 0.43, 0.2, 1, 1.15, 0.6);
  const head = pivot(body, 0, 0.98, 0.02);
  ball(head, 0.36, fur, 0, 0, 0);
  ball(head, 0.19, face, -0.1, 0.04, 0.22, 1, 1.05, 0.6);
  ball(head, 0.19, face, 0.1, 0.04, 0.22, 1, 1.05, 0.6);
  ball(head, 0.17, face, 0, -0.1, 0.25, 1.35, 0.85, 0.75);
  eyes(head, 0.095, 0.1, 0.06, 0.31, 0.25);
  ball(head, 0.035, basic(0x3a2418), -0.03, -0.06, 0.39); ball(head, 0.035, basic(0x3a2418), 0.03, -0.06, 0.39);
  smile(head, 0.08, 0, -0.14, 0.37, -0.2);
  cheeks(head, 0.05, 0.2, -0.07, 0.29);
  ball(head, 0.06, fur, 0, 0.32, 0.12, 1, 1.4, 1); // tuft
  const ears = [];
  for (const s of [-1, 1]) {
    const e = pivot(head, 0.36 * s, 0.03, 0);
    ball(e, 0.14, fur, 0, 0, 0, 0.6, 1, 1);
    ball(e, 0.09, pink, 0.04 * s, 0, 0.03, 0.4, 1, 1);
    ears.push(e);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const a = pivot(body, 0.26 * s, 0.62, 0.03);
    limb(a, V(0, 0, 0), V(0.12 * s, -0.28, 0.12), 0.07, 0.06, fur, 6);
    ball(a, 0.08, face, 0.13 * s, -0.3, 0.13);
    arms.push(a);
  }
  // banana!
  tube(arms[1], [V(0.05, -0.3, 0.1), V(0.13, -0.24, 0.24), V(0.15, -0.1, 0.32), V(0.13, 0.04, 0.34)], 0.045, 0.03, pm(0xffe04a, 0.4), 8, 6);
  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, 0.15 * s, 0.26, 0.03);
    limb(l, V(0, 0, 0), V(0.03 * s, -0.2, 0.04), 0.08, 0.07, fur, 6);
    ball(l, 0.09, face, 0.03 * s, -0.21, 0.09, 1, 0.6, 1.4);
    legs.push(l);
  }
  const tail = pivot(body, 0, 0.3, -0.24);
  const tp = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    if (u < 0.55) tp.push(V(0, -0.05 + u * 0.6, -u * 0.9));
    else { const a = (u - 0.55) / 0.45 * PI * 1.6; tp.push(V(0, 0.28 + Math.sin(a) * 0.18, -0.5 - Math.cos(a) * 0.18 + 0.18)); }
  }
  tube(tail, tp, 0.05, 0.035, fur, 18, 6);
  return finish(g, { body, head, ears, arms, legs, tail });
}

export function lemurModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const grey = pm(0xa8a8bc, 0.3), white = pm(0xffffff, 0.5), black = pm(0x2e2a3a, 0.25);
  ball(body, 0.3, grey, 0, 0.45, 0, 0.95, 1.1, 0.9);
  ball(body, 0.21, white, 0, 0.42, 0.19, 1, 1.15, 0.6);
  const head = pivot(body, 0, 0.98, 0.02);
  ball(head, 0.32, grey, 0, 0, 0);
  ball(head, 0.24, white, 0, -0.04, 0.12, 1.1, 0.95, 0.85);
  for (const s of [-1, 1]) { const p = ball(head, 0.1, black, 0.11 * s, 0.03, 0.27, 1.1, 1.1, 0.4); p.rotation.z = 0.5 * s; }
  cone(head, 0.1, 0.22, black, 0, -0.1, 0.33, PI / 2);
  ball(head, 0.04, basic(0x1a1420), 0, -0.1, 0.44);
  eyes(head, 0.085, 0.11, 0.04, 0.3, 0.3, 0xffa020);
  smile(head, 0.05, 0, -0.17, 0.31, -0.3);
  const ears = [];
  for (const s of [-1, 1]) {
    const e = pivot(head, 0.24 * s, 0.22, -0.02);
    cone(e, 0.09, 0.2, grey, 0, 0.06, 0, 0, 0, -0.5 * s);
    ears.push(e);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const a = pivot(body, 0.25 * s, 0.6, 0.03);
    limb(a, V(0, 0, 0), V(0.08 * s, -0.3, 0.1), 0.065, 0.055, grey, 6);
    ball(a, 0.07, black, 0.08 * s, -0.31, 0.11);
    arms.push(a);
    const l = pivot(body, 0.15 * s, 0.26, 0.03);
    limb(l, V(0, 0, 0), V(0.03 * s, -0.2, 0.04), 0.08, 0.07, grey, 6);
    ball(l, 0.08, black, 0.03 * s, -0.21, 0.09, 1, 0.6, 1.4);
  }
  // the big ringed tail curling up behind like a question mark
  const tail = pivot(body, 0, 0.3, -0.24);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    pts.push(V(0, -0.1 + Math.sin(u * PI * 0.9) * 0.3 + u * 1.25, -0.1 - Math.sin(u * PI) * 0.55 + u * 0.15));
  }
  for (let i = 0; i < 12; i++) {
    const r = 0.085 - i * 0.003;
    limb(tail, pts[i], pts[i + 1], r, r - 0.003, i % 2 ? black : white, 7);
    if (i % 2 === 0) ball(tail, r, white, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z, 1, 1, 1, [7, 4]);
  }
  return finish(g, { body, head, ears, arms, tail });
}

export function chameleonModel(color = 0x5fe07a) {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const m = pm(color, 0.3), stripe = pm(lt(color, 0.55), 0.4), dark = pm(dk(color, 0.3), 0.3);
  ball(body, 0.3, m, 0, 0.5, 0, 0.72, 1, 1.3);
  ball(body, 0.2, stripe, 0, 0.4, 0.02, 0.76, 0.5, 1.6);
  for (let i = 0; i < 5; i++) cone(body, 0.04, 0.1, dark, 0, 0.8 - Math.abs(i - 2) * 0.02, -0.25 + i * 0.12, 0, 0, 0, 4);
  const head = pivot(body, 0, 0.58, 0.4);
  ball(head, 0.22, m, 0, 0, 0, 0.95, 1, 1.15);
  cone(head, 0.16, 0.3, m, 0, 0.16, -0.08, -0.6, 0, 0, 7); // casque
  for (const s of [-1, 1]) {
    ball(head, 0.12, m, 0.17 * s, 0.04, 0.07);
    const e = eyeball(0.09); e.position.set(0.21 * s, 0.05, 0.12); e.rotation.y = 0.75 * s; head.add(e);
  }
  smile(head, 0.09, 0, -0.07, 0.24, -0.1);
  cheeks(head, 0.04, 0.16, -0.08, 0.15);
  const legs = [];
  const sp = [[-1, 0.25], [1, 0.25], [-1, -0.25], [1, -0.25]];
  for (const [s, z] of sp) {
    const l = pivot(body, 0.16 * s, 0.36, z);
    limb(l, V(0, 0, 0), V(0.1 * s, -0.08, 0), 0.06, 0.055, m, 5);
    limb(l, V(0.1 * s, -0.08, 0), V(0.1 * s, -0.31, 0.02), 0.055, 0.05, m, 5);
    ball(l, 0.075, m, 0.1 * s, -0.31, 0.04, 1.2, 0.6, 1.3);
    legs.push(l);
  }
  const tail = pivot(body, 0, 0.45, -0.36);
  const pts = [V(0, 0, 0), V(0, -0.02, -0.2)];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * PI * 1.8, r = 0.24 * (1 - (i / 14) * 0.65);
    pts.push(V(0, -0.24 + Math.cos(a) * r, -0.3 - Math.sin(a) * r));
  }
  tube(tail, pts, 0.11, 0.035, m, 24, 7);
  return finish(g, { body, head, legs, tail });
}

// ---------- chibi townsfolk of the tree city ----------
// A round little being: huge head, tiny body, big eyes, rosy cheeks and a hat
// that grew on a plant: 'leaf' | 'flower' | 'acorn' | 'mushroom'.
const HAT_COLORS = { leaf: 0x5fd860, flower: 0xff6ab4, acorn: 0x9a6034, mushroom: 0xff4848 };
export function leafkinModel(color = 0x8fe08a, hat = 'leaf') {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const skin = pm(new THREE.Color(0xffe2cc).lerp(new THREE.Color(color), 0.28).getHex(), 0.38), suit = pm(color, 0.32), shoe = pm(dk(color, 0.45), 0.3);
  ball(body, 0.22, suit, 0, 0.3, 0, 1, 1.05, 0.95);
  ball(body, 0.1, pm(lt(color, 0.3), 0.35), 0, 0.27, 0.17, 1, 1, 0.5); // pocket/tummy
  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, 0.09 * s, 0.13, 0);
    ball(l, 0.08, shoe, 0, -0.07, 0.04, 1, 0.75, 1.3);
    legs.push(l);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const a = pivot(body, 0.19 * s, 0.38, 0.02);
    limb(a, V(0, 0, 0), V(0.1 * s, -0.13, 0.04), 0.05, 0.045, suit, 5);
    ball(a, 0.06, skin, 0.11 * s, -0.15, 0.05);
    a.rotation.z = 0.2 * s;
    arms.push(a);
  }
  const head = pivot(body, 0, 0.82, 0);
  ball(head, 0.44, skin, 0, 0, 0, 1.05, 0.95, 1);
  eyes(head, 0.13, 0.17, -0.04, 0.35, 0.38);
  smile(head, 0.06, 0, -0.19, 0.4, -0.3);
  cheeks(head, 0.08, 0.29, -0.13, 0.31, 0.6);
  for (const s of [-1, 1]) ball(head, 0.07, skin, 0.45 * s, -0.03, 0, 0.5, 1, 0.8); // little ears
  const hatG = pivot(head, 0, 0.3, -0.02);
  const hc = HAT_COLORS[hat] ?? HAT_COLORS.leaf;
  if (hat === 'flower') {
    const pet = pm(hc, 0.4);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      const p = ball(hatG, 0.22, pet, Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3, 1, 0.36, 0.72);
      p.rotation.y = -a; p.rotation.z = 0.25;
    }
    ball(hatG, 0.17, pm(0xffe04a, 0.45), 0, 0.09, 0, 1, 0.6, 1);
    limb(hatG, V(0, 0.12, 0), V(0.04, 0.32, -0.02), 0.025, 0.02, pm(0x5fd860), 4);
    ball(hatG, 0.07, pm(0x5fd860), 0.1, 0.3, -0.02, 1, 0.3, 0.6).rotation.z = -0.5;
  } else if (hat === 'acorn') {
    const cap = pm(hc, 0.32);
    const c = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 7, 0, PI * 2, 0, PI / 2), cap);
    c.scale.set(0.47, 0.3, 0.47); c.position.y = -0.04; hatG.add(c);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.05, 5, 16), pm(dk(hc, 0.25), 0.3));
    rim.rotation.x = PI / 2; rim.position.y = -0.03; hatG.add(rim);
    for (let i = 0; i < 6; i++) { const a = i * 1.05; ball(hatG, 0.05, pm(lt(hc, 0.25), 0.3), Math.cos(a) * 0.28, 0.12, Math.sin(a) * 0.28, 1, 0.5, 1); }
    limb(hatG, V(0, 0.22, 0), V(0.05, 0.38, 0), 0.04, 0.03, pm(dk(hc, 0.3), 0.3), 5);
  } else if (hat === 'mushroom') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, PI * 2, 0, PI / 2), pm(hc, 0.32));
    cap.scale.set(0.62, 0.42, 0.62); cap.position.y = -0.06; hatG.add(cap);
    const under = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), pm(0xfff0dc, 0.45));
    under.rotation.x = PI / 2; under.position.y = -0.06; hatG.add(under);
    const dots = [[0, 0], [0.75, 0.6], [0.75, 2.2], [0.75, 4.0], [0.75, 5.3], [1.15, 1.4], [1.15, 3.1], [1.15, 4.7]];
    for (const [th, ph] of dots) {
      const n = V(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      const x = n.x * 0.62, y = n.y * 0.42 - 0.06, z = n.z * 0.62;
      const d = ball(hatG, 0.08, pm(0xffffff, 0.5), x, y, z, 1, 1, 0.35);
      d.lookAt(V(x + n.x / 0.62, y + n.y / 0.42, z + n.z / 0.62));
    }
  } else {
    // one big glossy leaf worn like a cap, with its stalk sticking up
    const leaf = pm(hc, 0.32), vein = pm(lt(hc, 0.45), 0.4);
    const l = ball(hatG, 0.5, leaf, 0, 0.0, 0.02, 0.95, 0.18, 1.1); l.rotation.x = -0.25;
    ball(hatG, 0.5, vein, 0, 0.065, 0.02, 0.08, 0.06, 1.05).rotation.x = -0.25;
    const l2 = ball(hatG, 0.3, pm(dk(hc, 0.15), 0.32), 0.12, 0.1, -0.15, 0.7, 0.14, 1.0); l2.rotation.set(-0.4, 0.8, 0.3);
    limb(hatG, V(0, 0.05, -0.1), V(-0.08, 0.3, -0.2), 0.03, 0.02, vein, 4);
  }
  return finish(g, { body, head, arms, legs, hat: hatG });
}

// ---------- Skull Island folk ----------
export function coconutCrabModel() {
  const g = crabModel(0x8f6bff);
  const { body } = g.userData;
  const nut = pm(0x8a5a34, 0.3);
  const c = ball(body, 0.42, nut, 0, 0.9, -0.15, 1, 0.85, 1);
  ball(body, 0.3, pm(0xfff6e8, 0.5), 0, 1.15, -0.1, 1, 0.3, 1); // opened top: coconut flesh
  for (const [x, z] of [[-0.1, 0.32], [0.1, 0.32], [0, 0.4]]) ball(body, 0.05, basic(0x3a2418), x, 0.95, z - 0.1 + 0.05, 1, 1, 0.5);
  limb(body, V(0.05, 1.18, -0.1), V(0.22, 1.6, -0.15), 0.025, 0.02, pm(0xff6ab4, 0.35), 4); // a little straw
  cheeks(body, 0.07, 0.26, 0.52, 0.48, 0.3);
  return finish(g, { coconut: c, legStyle: 'crab' });
}

export function goatModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const wool = pm(0xf8f4ec, 0.42), patch = pm(0xc89a6a, 0.3), hoof = pm(0x5a4a44, 0.25), horn = pm(0xd8c098, 0.35);
  ball(body, 0.4, wool, 0, 0.72, 0, 0.9, 0.85, 1.25);
  ball(body, 0.2, patch, 0.24, 0.8, -0.15, 0.6, 0.9, 1.2);
  const legs = [];
  for (const [s, z] of [[-1, 0.3], [1, 0.3], [-1, -0.3], [1, -0.3]]) {
    const l = pivot(body, 0.19 * s, 0.5, z);
    limb(l, V(0, 0, 0), V(0, -0.42, 0), 0.075, 0.065, wool, 6);
    ball(l, 0.075, hoof, 0, -0.44, 0.01, 1, 0.7, 1.1);
    legs.push(l);
  }
  const tail = pivot(body, 0, 0.92, -0.48);
  ball(tail, 0.08, wool, 0, 0.04, -0.03, 0.8, 1.3, 0.8);
  const head = pivot(body, 0, 1.08, 0.48);
  ball(head, 0.28, wool, 0, 0, 0, 0.92, 1, 1.05);
  ball(head, 0.16, pm(0xffe4e0, 0.42), 0, -0.1, 0.22, 1.1, 0.85, 0.9);
  ball(head, 0.025, basic(0x5a3030), -0.04, -0.06, 0.37); ball(head, 0.025, basic(0x5a3030), 0.04, -0.06, 0.37);
  smile(head, 0.05, 0, -0.15, 0.35, -0.3);
  eyes(head, 0.085, 0.12, 0.06, 0.21, 0.4);
  cheeks(head, 0.05, 0.19, -0.05, 0.2);
  for (const s of [-1, 1]) {
    const hn = cone(head, 0.06, 0.26, horn, 0.1 * s, 0.3, -0.07, -0.55, 0, -0.15 * s, 6);
    hn.scale.set(1, 1, 0.8);
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const e = pivot(head, 0.24 * s, 0.06, -0.02);
    const em = ball(e, 0.12, wool, 0.08 * s, -0.02, 0, 1, 0.42, 0.6); em.rotation.z = -0.35 * s;
    ball(e, 0.08, pm(0xffc0c8, 0.4), 0.09 * s, -0.01, 0.03, 1, 0.3, 0.45).rotation.z = -0.35 * s;
    ears.push(e);
  }
  cone(head, 0.06, 0.16, wool, 0, -0.3, 0.12, PI); // beard
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 5, 14), pm(0xff4a5a, 0.35));
  collar.position.set(0, 0.92, 0.4); collar.rotation.x = PI / 2 - 0.6; body.add(collar);
  ball(body, 0.07, pm(0xffcf3a, 0.45), 0, 0.8, 0.53);
  return finish(g, { body, head, legs, ears, tail });
}

export function batModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const fur = pm(0x9a6648, 0.3), face = pm(0xd8a070, 0.38), wingM = pm(0x7a4ab0, 0.32), pink = pm(0xffa8c0, 0.4);
  ball(body, 0.27, fur, 0, -0.08, 0, 0.95, 1.1, 0.9);
  ball(body, 0.18, face, 0, -0.1, 0.19, 1, 1.1, 0.6);
  const head = pivot(body, 0, 0.25, 0.04);
  ball(head, 0.26, fur, 0, 0, 0);
  ball(head, 0.12, face, 0, -0.06, 0.2, 1.1, 0.85, 1.1);
  ball(head, 0.035, basic(0x2a1a18), 0, -0.02, 0.33);
  eyes(head, 0.085, 0.1, 0.06, 0.2, 0.35);
  smile(head, 0.04, 0, -0.1, 0.31, -0.3);
  cone(head, 0.015, 0.04, basic(0xffffff), 0.025, -0.13, 0.3, PI, 0, 0, 4);
  cheeks(head, 0.045, 0.16, -0.06, 0.2);
  const ears = [];
  for (const s of [-1, 1]) {
    const e = pivot(head, 0.14 * s, 0.18, 0);
    cone(e, 0.1, 0.3, fur, 0.03 * s, 0.1, 0, 0, 0, -0.35 * s, 7);
    cone(e, 0.06, 0.2, pink, 0.035 * s, 0.08, 0.04, 0, 0, -0.35 * s, 6);
    ears.push(e);
  }
  const wings = [];
  const bone = pm(0x5a3a7a, 0.3);
  for (const s of [-1, 1]) {
    const w = pivot(body, 0.2 * s, 0.05, 0);
    ball(w, 0.5, wingM, 0.0, -0.42, -0.02, 0.09, 1, 0.62);
    ball(w, 0.3, wingM, 0.0, -0.52, -0.3, 0.09, 0.8, 0.62);
    limb(w, V(0, 0, 0), V(0, -0.9, 0.12), 0.022, 0.015, bone, 4);
    limb(w, V(0, -0.35, 0.05), V(0, -0.75, -0.45), 0.018, 0.012, bone, 4);
    wings.push(w);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, 0.1 * s, -0.33, 0);
    ball(l, 0.06, fur, 0, -0.04, 0.02, 1, 1.2, 1);
    legs.push(l);
  }
  return finish(g, { body, head, ears, wings, legs, flyPitch: 1.1, wingOpen: 1.5, flapRate: 11 });
}

export function geckoModel(color = 0x9be84a) {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const m = pm(color, 0.32), spot = pm(0xff9a3a, 0.35), pad = pm(lt(color, 0.4), 0.4);
  ball(body, 0.25, m, 0, 0.22, 0, 0.82, 0.55, 1.45);
  ball(body, 0.2, pm(lt(color, 0.6), 0.45), 0, 0.17, 0.02, 0.8, 0.4, 1.4);
  for (const [x, z] of [[0.08, 0.15], [-0.1, -0.05], [0.06, -0.22], [-0.05, 0.25]]) ball(body, 0.05, spot, x, 0.34, z, 1, 0.4, 1);
  const head = pivot(body, 0, 0.28, 0.42);
  ball(head, 0.22, m, 0, 0, 0, 1.1, 0.78, 1.05);
  for (const s of [-1, 1]) ball(head, 0.11, m, 0.13 * s, 0.07, 0.04);
  eyes(head, 0.11, 0.15, 0.09, 0.07, 0.75, 0xffd040);
  smile(head, 0.1, 0, -0.05, 0.21, -1.1);
  cheeks(head, 0.04, 0.18, -0.02, 0.12);
  const legs = [];
  for (const [s, z] of [[-1, 0.22], [1, 0.22], [-1, -0.22], [1, -0.22]]) {
    const l = pivot(body, 0.17 * s, 0.2, z);
    limb(l, V(0, 0, 0), V(0.14 * s, -0.04, 0.04 * Math.sign(z)), 0.045, 0.04, m, 5);
    limb(l, V(0.14 * s, -0.04, 0.04 * Math.sign(z)), V(0.17 * s, -0.17, 0.06 * Math.sign(z)), 0.04, 0.035, m, 5);
    for (let i = -1; i <= 1; i++) ball(l, 0.035, pad, 0.17 * s + i * 0.05, -0.18, 0.06 * Math.sign(z) + 0.05 - Math.abs(i) * 0.02);
    legs.push(l);
  }
  const tail = pivot(body, 0, 0.2, -0.32);
  tube(tail, [V(0, 0, 0), V(0.06, -0.04, -0.25), V(-0.06, -0.08, -0.5), V(0.05, -0.1, -0.72), V(0.12, -0.08, -0.85)], 0.11, 0.02, m, 16, 7);
  return finish(g, { body, head, legs, tail });
}

export function tortoiseModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const skin = pm(0xb4d878, 0.35), shellM = pm(0x4f9a46, 0.3), plate = pm(0x7cc858, 0.35), rimM = pm(0xe0c078, 0.4);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 9, 0, PI * 2, 0, PI / 2), shellM);
  dome.scale.set(0.6, 0.5, 0.7); dome.position.y = 0.26; body.add(dome);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 6, 20), rimM);
  rim.scale.set(0.6, 0.7, 1); rim.rotation.x = PI / 2; rim.position.y = 0.27; body.add(rim);
  // raised hexagon plates on the shell
  const hex = new THREE.CylinderGeometry(1, 1, 1, 6);
  const plates = [[0, 0], [0.55, 0], [0.55, 1.05], [0.55, 2.1], [0.55, 3.15], [0.55, 4.2], [0.55, 5.25]];
  for (const [r, a] of plates) {
    const theta = r * 1.15; // angle from the dome top
    const n = V(Math.sin(theta) * Math.cos(a), Math.cos(theta), Math.sin(theta) * Math.sin(a));
    const p = V(n.x * 0.6, n.y * 0.5 + 0.26, n.z * 0.7);
    const nn = V(n.x / 0.6, n.y / 0.5, n.z / 0.7).normalize();
    const me = new THREE.Mesh(hex, plate);
    me.scale.set(r ? 0.15 : 0.19, 0.04, r ? 0.15 : 0.19);
    me.position.copy(p);
    me.quaternion.setFromUnitVectors(V(0, 1, 0), nn);
    body.add(me);
  }
  ball(body, 0.5, pm(0xe8d898, 0.4), 0, 0.24, 0, 1.1, 0.12, 1.3); // belly plate
  const legs = [];
  for (const [s, z] of [[-1, 0.38], [1, 0.38], [-1, -0.38], [1, -0.38]]) {
    const l = pivot(body, 0.42 * s, 0.22, z);
    ball(l, 0.13, skin, 0, -0.08, 0, 1, 1.15, 1);
    legs.push(l);
  }
  limb(body, V(0, 0.32, 0.55), V(0, 0.5, 0.78), 0.12, 0.11, skin, 7);
  const head = pivot(body, 0, 0.56, 0.84);
  ball(head, 0.22, skin, 0, 0, 0, 1, 0.95, 1.05);
  eyes(head, 0.08, 0.1, 0.06, 0.16, 0.4);
  smile(head, 0.08, 0, -0.06, 0.2, -0.3);
  cheeks(head, 0.045, 0.15, -0.04, 0.15);
  const tail = pivot(body, 0, 0.22, -0.72);
  cone(tail, 0.06, 0.15, skin, 0, 0, -0.04, -PI / 2 - 0.3);
  return finish(g, { body, head, legs, tail });
}

export function pigletModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const pink = pm(0xffb4c8, 0.38), deep = pm(0xff8aa8, 0.35), hoof = pm(0xa05a6a, 0.3);
  ball(body, 0.38, pink, 0, 0.42, -0.05, 1, 0.9, 1.15);
  const legs = [];
  for (const [s, z] of [[-1, 0.18], [1, 0.18], [-1, -0.28], [1, -0.28]]) {
    const l = pivot(body, 0.18 * s, 0.2, z);
    limb(l, V(0, 0, 0), V(0, -0.15, 0), 0.075, 0.07, pink, 6);
    ball(l, 0.075, hoof, 0, -0.17, 0.01, 1, 0.6, 1.1);
    legs.push(l);
  }
  const head = pivot(body, 0, 0.72, 0.32);
  ball(head, 0.34, pink, 0, 0, 0);
  const sn = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.12, 12), deep);
  sn.rotation.x = PI / 2; sn.position.set(0, -0.08, 0.34); head.add(sn);
  for (const s of [-1, 1]) ball(head, 0.035, basic(0x8a3a50), 0.05 * s, -0.08, 0.4, 0.8, 1.1, 0.5);
  eyes(head, 0.085, 0.13, 0.08, 0.28, 0.35);
  smile(head, 0.05, 0, -0.21, 0.29, -0.3);
  cheeks(head, 0.06, 0.22, -0.08, 0.25);
  const ears = [];
  for (const s of [-1, 1]) {
    const e = pivot(head, 0.2 * s, 0.24, 0.02);
    const c = cone(e, 0.11, 0.2, deep, 0, 0.06, 0.04, 0.6, 0, -0.35 * s, 6); c.scale.set(1, 1, 0.55);
    ears.push(e);
  }
  const tail = pivot(body, 0, 0.5, -0.47);
  const tc = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 5, 10, PI * 1.6), deep);
  tc.position.set(0, 0.02, -0.05); tc.rotation.y = PI / 2; tail.add(tc);
  return finish(g, { body, head, legs, ears, tail });
}

export function seaLionModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const fur = pm(0x9a6a4c, 0.32), light = pm(0xd8aa80, 0.4);
  ball(body, 0.45, fur, 0, 0.32, -0.25, 0.9, 0.7, 1.3);
  ball(body, 0.38, fur, 0, 0.76, 0.12, 0.85, 1.15, 0.85);
  ball(body, 0.28, light, 0, 0.72, 0.31, 0.85, 1.15, 0.6);
  const head = pivot(body, 0, 1.27, 0.26);
  ball(head, 0.27, fur, 0, 0, 0);
  ball(head, 0.14, light, 0, -0.06, 0.22, 1.25, 0.85, 1);
  ball(head, 0.05, basic(0x2a1a18), 0, -0.01, 0.35, 1.3, 0.8, 0.8);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) limb(head, V(0.08 * s, -0.06, 0.32), V(0.26 * s, -0.04 + (i - 1) * 0.05, 0.33), 0.008, 0.005, basic(0x5a4040), 3);
  eyes(head, 0.09, 0.12, 0.08, 0.2, 0.35);
  smile(head, 0.05, 0, -0.14, 0.3, -0.3);
  cheeks(head, 0.05, 0.18, -0.07, 0.2);
  const flippers = [];
  for (const s of [-1, 1]) {
    const f = pivot(body, 0.3 * s, 0.45, 0.3);
    const fm = ball(f, 0.3, fur, 0.12 * s, -0.22, 0.08, 0.32, 0.95, 0.6); fm.rotation.set(0.5, 0, 0.35 * s);
    ball(f, 0.22, fur, 0.2 * s, -0.4, 0.18, 0.7, 0.18, 1.1);
    flippers.push(f);
  }
  const tail = pivot(body, 0, 0.08, -0.78);
  for (const s of [-1, 1]) ball(tail, 0.2, fur, 0.14 * s, 0, -0.08, 0.6, 0.15, 1).rotation.y = 0.5 * s;
  // a striped beach ball balanced on the nose
  const bg = new THREE.SphereGeometry(0.22, 12, 9).toNonIndexed();
  const p = bg.attributes.position, col = [];
  const cs = [0xff4a5a, 0xffffff, 0x3f8bff, 0xffffff, 0xffd23a, 0xffffff].map((c) => new THREE.Color(c));
  for (let i = 0; i < p.count; i += 3) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += p.getX(i + k); y += p.getY(i + k); z += p.getZ(i + k); }
    const a = Math.atan2(z, x) + PI;
    const c = Math.abs(y / 3) > 0.18 ? new THREE.Color(0xffffff) : cs[Math.floor(a / (PI * 2) * 6) % 6];
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const beachBall = new THREE.Mesh(bg, paintMat({ vertexColors: true, emissive: 0x333333 }));
  beachBall.position.set(0, 1.55, 0.5); body.add(beachBall);
  return finish(g, { body, head, flippers, tail, ball: beachBall });
}

export function fireflyModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const shell = pm(0x5a4ac8, 0.35), head = pivot(body, 0, 0.1, 0.24);
  ball(body, 0.17, shell, 0, 0.02, 0, 0.95, 0.85, 1.3);
  ball(head, 0.19, pm(0xffb05a, 0.4), 0, 0, 0);
  eyes(head, 0.09, 0.09, 0.03, 0.12, 0.45);
  smile(head, 0.04, 0, -0.08, 0.17, -0.3);
  cheeks(head, 0.035, 0.13, -0.05, 0.12);
  for (const s of [-1, 1]) {
    limb(head, V(0.05 * s, 0.14, 0), V(0.15 * s, 0.36, 0.08), 0.012, 0.01, basic(0x2a2238), 4);
    ball(head, 0.04, pm(0xffe04a, 0.5), 0.15 * s, 0.37, 0.08);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff27a });
  lampMat.userData.noPaint = 'glowing firefly lamp';
  const lamp = ball(body, 0.18, lampMat, 0, -0.03, -0.26, 1, 0.95, 1.1);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff080, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.material.userData.noPaint = 'glow sprite';
  glow.scale.setScalar(1.3); glow.position.copy(lamp.position); body.add(glow);
  const wm = pm(0xe8f4ff, 0.5, { transparent: true, opacity: 0.7 });
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, 0.06 * s, 0.14, 0.02);
    ball(w, 0.22, wm, 0.2 * s, 0, -0.08, 1, 0.07, 0.5).rotation.y = 0.5 * s;
    w.rotation.z = 0.5 * s;
    wings.push(w);
  }
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) legs.push(limb(body, V(0.08 * s, -0.08, 0.08 - i * 0.12), V(0.16 * s, -0.2, 0.1 - i * 0.12), 0.015, 0.012, basic(0x2a2238), 3));
  return finish(g, { body, head, wings, glow, lamp, flyPitch: 0, wingOpen: 0.4, flapRate: 30 });
}

export function crocodileModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const m = pm(0x5ccc5a, 0.32), belly = pm(0xf4f0b0, 0.42), bump = pm(0x3fa848, 0.3);
  ball(body, 0.45, m, 0, 0.36, -0.05, 0.95, 0.62, 1.35);
  ball(body, 0.38, belly, 0, 0.27, 0, 0.92, 0.45, 1.25);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) ball(body, 0.06, bump, 0.13 * s, 0.62, -0.35 + i * 0.2, 1, 0.6, 1.2);
  const head = pivot(body, 0, 0.42, 0.52);
  ball(head, 0.3, m, 0, 0.06, 0.18, 0.95, 0.55, 1.35); // upper jaw
  ball(head, 0.27, belly, 0, -0.06, 0.16, 0.9, 0.35, 1.3); // lower jaw
  ball(head, 0.24, m, 0, 0.12, -0.02, 1.1, 0.8, 0.9);
  for (const s of [-1, 1]) ball(head, 0.05, bump, 0.07 * s, 0.17, 0.52, 1, 0.7, 1);
  for (const s of [-1, 1]) ball(head, 0.13, m, 0.14 * s, 0.25, 0.04);
  eyes(head, 0.11, 0.14, 0.3, 0.1, 0.3);
  // a wide happy grin with a few rounded teeth
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 4, 14, PI), basic(0x6a1828));
  grin.rotation.set(-PI / 2 + 0.15, 0, PI); grin.position.set(0, 0.0, 0.18); grin.scale.set(1, 1.55, 1); head.add(grin);
  const tooth = pm(0xffffff, 0.6);
  for (const [x, z] of [[-0.18, 0.4], [0.18, 0.4], [-0.25, 0.2], [0.25, 0.2]]) cone(head, 0.03, 0.06, tooth, x, -0.03, z, PI, 0, 0, 5);
  cheeks(head, 0.07, 0.24, 0.05, 0.08, 1.2);
  const legs = [];
  for (const [s, z] of [[-1, 0.3], [1, 0.3], [-1, -0.35], [1, -0.35]]) {
    const l = pivot(body, 0.36 * s, 0.25, z);
    limb(l, V(0, 0, 0), V(0.08 * s, -0.2, 0.02), 0.1, 0.09, m, 6);
    ball(l, 0.1, m, 0.08 * s, -0.21, 0.07, 1.1, 0.5, 1.3);
    legs.push(l);
  }
  const tail = pivot(body, 0, 0.32, -0.55);
  tube(tail, [V(0, 0, 0), V(0, -0.05, -0.3), V(0.06, -0.12, -0.6), V(0.15, -0.18, -0.85)], 0.24, 0.05, m, 12, 8);
  for (let i = 0; i < 3; i++) cone(tail, 0.05, 0.1, bump, 0.04 * i, 0.12 - i * 0.07, -0.18 - i * 0.24, 0, 0, 0, 4);
  return finish(g, { body, head, legs, tail });
}

export function kittenModel(opts = { pirate: true }) {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0, 0);
  const fur = pm(0xffa64d, 0.35), cream = pm(0xfff0dc, 0.45), stripe = pm(0xe0762a, 0.3), pink = pm(0xffa0b4, 0.4);
  ball(body, 0.29, fur, 0, 0.36, -0.02, 0.92, 0.95, 1.1);
  ball(body, 0.18, cream, 0, 0.34, 0.2, 1, 1.1, 0.6);
  const legs = [];
  for (const [s, z] of [[-1, 0.14], [1, 0.14], [-1, -0.16], [1, -0.16]]) {
    const l = pivot(body, 0.13 * s, 0.18, z);
    limb(l, V(0, 0, 0), V(0, -0.13, 0.01), 0.065, 0.06, fur, 6);
    ball(l, 0.07, cream, 0, -0.14, 0.03, 1, 0.7, 1.2);
    legs.push(l);
  }
  const head = pivot(body, 0, 0.88, 0.08);
  ball(head, 0.38, fur, 0, 0, 0, 1.08, 0.95, 1);
  ball(head, 0.15, cream, 0, -0.12, 0.29, 1.4, 0.85, 0.65);
  ball(head, 0.035, pink, 0, -0.06, 0.38, 1.3, 0.8, 0.8);
  // "w" mouth
  for (const s of [-1, 1]) smile(head, 0.035, 0.035 * s, -0.12, 0.37, -0.3);
  const wh = basic(0x6a4a3a);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) limb(head, V(0.14 * s, -0.1, 0.33), V(0.36 * s, -0.06 + (i - 1) * 0.06, 0.3), 0.007, 0.005, wh, 3);
  eyes(head, 0.11, 0.15, 0.02, 0.3, 0.38, 0x5ad070);
  cheeks(head, 0.06, 0.25, -0.1, 0.27);
  ball(head, 0.06, stripe, 0, 0.27, 0.25, 0.45, 0.25, 1);
  ball(head, 0.05, stripe, 0.11, 0.25, 0.24, 0.4, 0.22, 1).rotation.z = -0.4;
  ball(head, 0.05, stripe, -0.11, 0.25, 0.24, 0.4, 0.22, 1).rotation.z = 0.4;
  const ears = [];
  for (const s of [-1, 1]) {
    const e = pivot(head, 0.24 * s, 0.27, -0.02);
    cone(e, 0.13, 0.25, fur, 0, 0.08, 0, 0, 0, -0.35 * s, 7);
    cone(e, 0.08, 0.16, pink, 0.005 * s, 0.06, 0.06, 0, 0, -0.35 * s, 6);
    ears.push(e);
  }
  if (opts.pirate) {
    // red polka-dot bandana tied at the back, and a gold earring
    const red = pm(0xff3a4a, 0.35);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 6, 0, PI * 2, 0, PI * 0.42), red);
    cap.scale.set(0.41, 0.38, 0.4); cap.position.y = 0.02; cap.rotation.x = -0.25; head.add(cap);
    const dot = pm(0xffffff, 0.5);
    for (const [x, y, z] of [[0, 0.38, 0.06], [0.2, 0.31, 0.14], [-0.2, 0.31, 0.14], [0.1, 0.33, -0.2], [-0.13, 0.35, -0.12]]) {
      const d = ball(head, 0.04, dot, x, y, z, 1, 1, 0.35);
      d.lookAt(head.localToWorld(V(x * 2, y * 2, z * 2)));
    }
    const knot = pivot(head, 0, 0.12, -0.38);
    ball(knot, 0.07, red, 0, 0, 0);
    for (const s of [-1, 1]) { const t = cone(knot, 0.06, 0.2, red, 0.06 * s, -0.08, -0.04, -0.4, 0, PI + 0.4 * s, 5); t.scale.set(1, 1, 0.4); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 4, 10), pm(0xffcf3a, 0.5));
    ring.position.set(-0.3, 0.2, 0.02); ring.rotation.y = PI / 2; head.add(ring);
  }
  const tail = pivot(body, 0, 0.3, -0.3);
  tube(tail, [V(0, 0, 0), V(0, 0.08, -0.18), V(0, 0.3, -0.25), V(0, 0.5, -0.18), V(0.05, 0.6, -0.05)], 0.06, 0.05, fur, 12, 6);
  return finish(g, { body, head, ears, legs, tail });
}

// Boo the friendly sheet ghost: soft, a little see-through, blushing.
export function ghostModel() {
  const g = new THREE.Group();
  const body = pivot(g, 0, -0.55, 0);
  const prof = [[0.001, 1.12], [0.22, 1.1], [0.4, 1.02], [0.52, 0.86], [0.57, 0.66], [0.58, 0.45], [0.62, 0.22], [0.7, 0.04], [0.66, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 22);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < 0.3) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + Math.sin(a * 6) * 0.07 * (1 - y / 0.3)); }
  }
  geo.computeVertexNormals();
  const sheetM = pm(0xffffff, 0.55, { transparent: true, opacity: 0.84, side: THREE.DoubleSide, depthWrite: false });
  const sheet = new THREE.Mesh(geo, sheetM); body.add(sheet);
  const face = pivot(body, 0, 0.7, 0);
  for (const s of [-1, 1]) {
    const e = ball(face, 0.1, basic(0x2a2440), 0.17 * s, 0.02, 0.5, 0.8, 1.15, 0.4);
    e.rotation.y = 0.3 * s;
    ball(face, 0.035, basic(0xffffff), 0.17 * s - 0.03, 0.07, 0.535);
    ball(face, 0.015, basic(0xffffff), 0.17 * s + 0.025, -0.03, 0.54);
  }
  cheeks(face, 0.07, 0.3, -0.11, 0.44, 0.55);
  const mouth = ball(face, 0.045, basic(0x8a3050), 0, -0.14, 0.53, 1, 1.1, 0.4);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = pivot(body, 0.55 * s, 0.5, 0.02);
    ball(a, 0.13, sheetM, 0.07 * s, 0, 0, 1.2, 0.65, 0.7);
    arms.push(a);
  }
  return finish(g, { body, head: face, arms, mouth, sheet });
}

// ---------- behaviours ----------
const _d = new THREE.Vector3(), _p = new THREE.Vector3();
const flatFloor = (y) => () => y;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class LandFolk {
  constructor(scene, kind, model, scale = 1, opts = {}) {
    this.kind = kind; this.model = model; this.opts = opts;
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.root.add(model); this.root.scale.setScalar(scale);
    scene.add(this.root);
    this.pos = this.root.position;
    this.scale = scale;
    this.ud = model.userData || {};
    this.t = opts.phase ?? rnd() * 100;
    this.seed = rnd() * 10;
    this.happy = 0; this.lift = 0;
    this.friendRadius = opts.friendRadius ?? 5;
  }
  cheer() { this.happy = 1.5; }
  // Applies the behaviour's lift plus the happy bounce (wings & arms go wild while happy).
  bounce(dt) {
    let y = this.lift;
    if (this.happy > 0) {
      this.happy -= dt;
      y += Math.abs(Math.sin(this.happy * 8)) * 0.5;
      const ud = this.ud, k = Math.sin(this.happy * 30);
      ud.wings?.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * ((ud.wingOpen ?? 1.4) * 0.8 + k * 0.5); });
      ud.arms?.forEach((a, i) => { if (!ud.hangs) a.rotation.z = (i ? 1 : -1) * (2.2 + k * 0.4); });
    }
    this.model.position.y = y;
  }
  // Turn towards dir; returns the yaw change applied this frame.
  face(dir, dt, rate = 3) {
    if (dir.x * dir.x + dir.z * dir.z < 1e-8) return 0;
    const d = wrap(Math.atan2(dir.x, dir.z) - this.root.rotation.y) * Math.min(1, rate * dt);
    this.root.rotation.y += d;
    return d;
  }
  lookAround(t, amt = 0.6) {
    const h = this.ud.head; if (!h) return;
    const k = Math.sin(t * 0.35 + this.seed);
    h.rotation.y = Math.sin(t * 0.9 + this.seed) * amt * (k > 0 ? 1 : 0.25);
    h.rotation.z = Math.sin(t * 0.6 + this.seed * 2) * 0.12;
  }
  wag(t, amt = 0.3, rate = 3) {
    const tl = this.ud.tail; if (tl && tl.isObject3D) tl.rotation.y = Math.sin(t * rate + this.seed) * amt;
  }
}

// Circles (or flies figure-eights) around c at height h. opts: { c, r=8, h=c.y, speed=0.35 (rad/s),
// bob=1, eight=false, dir=1|-1, flap=model's flapRate|9 }
export class Flyer extends LandFolk {
  constructor(scene, kind, model, scale = 1, opts = {}) {
    super(scene, kind, model, scale, opts);
    this.c = (opts.c ?? new THREE.Vector3()).clone();
    this.r = opts.r ?? 8; this.h = opts.h ?? this.c.y; this.speed = opts.speed ?? 0.35;
    this.bob = opts.bob ?? 1; this.eight = !!opts.eight; this.dir = opts.dir ?? 1;
    this.flapRate = opts.flap ?? this.ud.flapRate ?? 9;
    this.bank = 0; this.ft = rnd() * 10;
    this.place(); this.root.rotation.y = Math.atan2(_d.x, _d.z);
    this.friendRadius = opts.friendRadius ?? 6;
  }
  place() {
    const a = this.t * this.dir, r = this.r;
    const x = this.eight ? Math.sin(a) * r : Math.cos(a) * r;
    const z = this.eight ? Math.sin(a) * Math.cos(a) * r : Math.sin(a) * r;
    _p.set(this.c.x + x, this.h + Math.sin(a * 2.3 + this.seed) * this.bob, this.c.z + z);
    _d.subVectors(_p, this.pos);
    this.pos.copy(_p);
  }
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt * this.speed;
    this.place();
    const turn = this.face(_d, dt, 5);
    const want = THREE.MathUtils.clamp(-turn / Math.max(dt, 1e-3) * 0.35, -0.6, 0.6);
    this.bank += (want - this.bank) * Math.min(1, 3 * dt);
    this.root.rotation.z = this.bank;
    const ud = this.ud;
    this.model.rotation.x = ud.flyPitch ?? 0.6;
    // flap, with a little glide now and then (tiny fast flappers never glide)
    const glide = this.flapRate < 20 && Math.sin(this.t * 1.7 + this.seed) > 0.55;
    this.ft += dt * this.flapRate * (glide ? 0.15 : 1);
    const open = ud.wingOpen ?? 1.4, amp = glide ? 0.08 : 0.6;
    ud.wings?.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (open + Math.sin(this.ft) * amp); });
    if (ud.tail?.isObject3D) ud.tail.rotation.x = Math.sin(this.ft * 0.5) * 0.08;
    ud.legs?.forEach((l) => { l.rotation.x = -0.8; });
    this.lift = Math.sin(this.ft) * -0.04;
    this.bounce(dt);
  }
}

// Hops around a home point. opts: { home, range=3, floor=(x,z)=>y, hop=0.9*scale (world units
// per hop), hopH=0.45 (model units), hopTime=0.42 s, rest=[1, 3.5] s }
export class Hopper extends LandFolk {
  constructor(scene, kind, model, scale = 1, opts = {}) {
    super(scene, kind, model, scale, opts);
    this.home = (opts.home ?? new THREE.Vector3()).clone();
    this.range = opts.range ?? 3;
    this.floor = opts.floor ?? flatFloor(this.home.y);
    this.hopLen = opts.hop ?? 0.9 * scale; this.hopH = opts.hopH ?? 0.45; this.hopTime = opts.hopTime ?? 0.42;
    this.rest = opts.rest ?? [1, 3.5];
    this.from = new THREE.Vector3(); this.to = new THREE.Vector3(); this.target = new THREE.Vector3();
    this.u = -1; this.wait = rnd() * 2; this.heading = new THREE.Vector3(0, 0, 1);
    const a = rnd() * PI * 2, r = Math.sqrt(rnd()) * this.range;
    this.pos.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
    this.pos.y = this.floor(this.pos.x, this.pos.z);
    this.target.copy(this.pos);
    this.root.rotation.y = rnd() * PI * 2;
    this.friendRadius = opts.friendRadius ?? 4;
  }
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const ud = this.ud;
    if (this.u >= 0) {
      this.u = Math.min(1, this.u + dt / this.hopTime);
      const u = this.u, s = Math.sin(PI * u);
      this.pos.x = this.from.x + (this.to.x - this.from.x) * u;
      this.pos.z = this.from.z + (this.to.z - this.from.z) * u;
      this.pos.y = this.floor(this.pos.x, this.pos.z);
      this.lift = s * this.hopH;
      this.model.scale.set(1 - s * 0.06, 1 + s * 0.12, 1 - s * 0.06);
      ud.legs?.forEach((l) => { l.rotation.x = s * 0.7; });
      ud.arms?.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.2 + s * 1.2); });
      if (ud.ears) ud.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * s * 0.3; });
      this.face(this.heading, dt, 10);
      if (this.u >= 1) {
        this.u = -1; this.lift = 0;
        const arrived = this.pos.distanceToSquared(this.target) < 0.04;
        this.wait = arrived ? this.rest[0] + rnd() * (this.rest[1] - this.rest[0]) : 0.12;
        this.squash = 0.15;
      }
    } else {
      this.wait -= dt;
      if (this.squash > 0) { this.squash -= dt; const k = Math.max(0, this.squash) / 0.15; this.model.scale.set(1 + k * 0.1, 1 - k * 0.15, 1 + k * 0.1); }
      else this.model.scale.set(1, 1, 1);
      ud.legs?.forEach((l) => { l.rotation.x *= 0.8; });
      ud.arms?.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.2 + Math.max(0, Math.sin(this.t * 2 + this.seed)) * 0.25); });
      this.lookAround(this.t);
      if (this.wait <= 0) {
        if (this.pos.distanceToSquared(this.target) < 0.04) {
          const a = rnd() * PI * 2, r = Math.sqrt(rnd()) * this.range;
          this.target.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
        }
        this.heading.subVectors(this.target, this.pos).setY(0);
        const dist = this.heading.length();
        this.from.copy(this.pos);
        this.to.copy(this.pos).addScaledVector(this.heading, Math.min(1, this.hopLen / Math.max(dist, 1e-4)));
        this.u = 0;
      }
    }
    this.wag(this.t, 0.4, 4);
    this.bounce(dt);
  }
}

// Strolls around a home point with stepping legs and a waddle, pausing now and then.
// opts: { home, range=3, speed=0.5*scale (world units/s), floor=(x,z)=>y, waddle=1 }
export class Walker extends LandFolk {
  constructor(scene, kind, model, scale = 1, opts = {}) {
    super(scene, kind, model, scale, opts);
    this.home = (opts.home ?? new THREE.Vector3()).clone();
    this.range = Math.max(0.5, opts.range ?? 3);
    this.speed = opts.speed ?? 0.5 * scale;
    this.floor = opts.floor ?? flatFloor(this.home.y);
    this.waddle = opts.waddle ?? 1;
    this.ph = rnd() * PI * 2; this.st = 0; this.w = 1;
    this.stepRate = 7 / Math.max(0.3, scale);
    this.place(); this.root.rotation.y = rnd() * PI * 2;
    this.friendRadius = opts.friendRadius ?? 5;
  }
  place() {
    const x = this.home.x + Math.sin(this.ph) * this.range;
    const z = this.home.z + Math.sin(this.ph * 0.61 + this.seed) * this.range * 0.75;
    _d.set(x - this.pos.x, 0, z - this.pos.z);
    this.pos.set(x, this.floor(x, z), z);
  }
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const on = Math.sin(this.t * 0.17 + this.seed) > -0.35 ? 1 : 0;
    this.w += (on - this.w) * Math.min(1, 1.5 * dt);
    const w = this.w;
    this.ph += dt * this.speed * w / this.range;
    this.place();
    if (w > 0.05) this.face(_d, dt, 4);
    this.st += dt * this.stepRate * w;
    const ud = this.ud;
    if (ud.legStyle === 'crab') {
      ud.legs?.forEach((l, i) => { if (i % 4 === 3) l.rotation.x = Math.sin(this.t * 3) * 0.3; else l.rotation.z = Math.sin(this.st * 1.6 + i) * 0.35 * w; });
    } else {
      ud.legs?.forEach((l, i) => { l.rotation.x = Math.sin(this.st + (((i & 1) ^ ((i >> 1) & 1)) ? PI : 0)) * 0.5 * w; });
      ud.flippers?.forEach((f, i) => { f.rotation.x = Math.sin(this.st + i * PI) * 0.3 * w; });
    }
    this.model.rotation.z = Math.sin(this.st) * 0.07 * w * this.waddle;
    this.lift = Math.abs(Math.sin(this.st)) * 0.04 * w;
    this.lookAround(this.t, 0.6 * (1 - w) + 0.15);
    this.wag(this.t, 0.25, 2.5);
    if (ud.ball) ud.ball.rotation.y += dt * 3;
    if (this.kind === 'peacock' && ud.tail) ud.tail.rotation.z = Math.sin(this.t * 25) * 0.02 * (1 - w);
    this.bounce(dt);
  }
}

// Sits at a point (a branch, a rock, a ceiling), looks around and now and then flaps
// or waves. opts: { at, yaw=random, hang=false (upside down, e.g. bats) }. Sloth models
// (userData.hangs) dangle from `at` and sway slowly.
export class Percher extends LandFolk {
  constructor(scene, kind, model, scale = 1, opts = {}) {
    super(scene, kind, model, scale, opts);
    this.pos.copy(opts.at ?? new THREE.Vector3());
    this.root.rotation.y = opts.yaw ?? rnd() * PI * 2;
    this.hang = !!opts.hang;
    if (this.hang) model.rotation.z = PI;
    this.period = 4 + rnd() * 4;
    this.friendRadius = opts.friendRadius ?? 5;
  }
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const ud = this.ud;
    this.lookAround(this.t, 0.8);
    const ph = (this.t + this.seed) % this.period;
    const flapping = ph < 0.9;
    ud.wings?.forEach((w, i) => {
      w.rotation.z = (i ? 1 : -1) * (flapping ? 0.6 + Math.sin(ph * 28) * 0.45 : this.hang ? 0.12 : 0.04);
    });
    if (ud.hangs) {
      this.model.rotation.z = Math.sin(this.t * 0.6 + this.seed) * 0.12;
      ud.legs?.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 0.8 + i * 1.5) * 0.25; });
    } else if (this.hang) {
      this.model.rotation.x = Math.sin(this.t * 0.7 + this.seed) * 0.08;
    } else {
      ud.arms?.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (flapping && i ? 1.8 + Math.sin(ph * 12) * 0.4 : 0.15); });
    }
    if (ud.tail?.isObject3D) ud.tail.rotation.x = Math.sin(this.t * 1.3) * 0.08;
    this.wag(this.t, 0.15, 1.5);
    this.lift = this.hang || ud.hangs ? 0 : Math.max(0, Math.sin(this.t * 2)) * 0.015;
    this.bounce(dt);
  }
}

// Drifts gently around a point: ghosts, fireflies, butterflies. opts: { c, r=2, h=c.y, speed=0.4 }
export class Floater extends LandFolk {
  constructor(scene, kind, model, scale = 1, opts = {}) {
    super(scene, kind, model, scale, opts);
    this.c = (opts.c ?? new THREE.Vector3()).clone();
    this.r = opts.r ?? 2; this.h = opts.h ?? this.c.y; this.speed = opts.speed ?? 0.4;
    this.flapRate = this.ud.flapRate ?? 10; this.ft = rnd() * 10;
    this.place();
    this.friendRadius = opts.friendRadius ?? 4;
  }
  place() {
    const a = this.t * this.speed;
    _p.set(this.c.x + Math.sin(a + this.seed) * this.r, this.h + Math.sin(a * 2.7 + this.seed) * 0.4 * Math.max(0.5, this.r * 0.3),
      this.c.z + Math.sin(a * 0.71 + this.seed * 2) * this.r);
    _d.subVectors(_p, this.pos);
    this.pos.copy(_p);
  }
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.place();
    this.face(_d, dt, 2);
    const ud = this.ud;
    this.ft += dt * this.flapRate;
    const open = ud.wingOpen ?? 0.4;
    ud.wings?.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (open + Math.sin(this.ft) * 0.7); });
    if (ud.glow) {
      const k = 0.6 + 0.4 * Math.sin(this.t * 2.2 + this.seed);
      ud.glow.material.opacity = 0.35 + 0.6 * k; ud.glow.scale.setScalar(0.9 + 0.6 * k);
    }
    if (ud.sheet) {
      this.model.rotation.z = Math.sin(this.t * 1.1) * 0.1;
      this.model.rotation.x = Math.sin(this.t * 0.8) * 0.06;
      ud.sheet.scale.set(1 + Math.sin(this.t * 2.4) * 0.03, 1 - Math.sin(this.t * 2.4) * 0.03, 1 + Math.sin(this.t * 2.4) * 0.03);
      ud.arms?.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.2 + Math.sin(this.t * 2 + i * 0.7) * 0.35); });
    }
    this.lift = ud.sheet ? Math.sin(this.t * 1.6) * 0.08 : 0;
    this.bounce(dt);
  }
}

// ---------- album thumbnails ----------
// kind -> () => model; each function also carries a sensible default world `scale`
// (also in LAND_SCALE and on model.userData.scale).
const K = (fn, scale) => Object.assign(() => { const m = fn(); m.userData.scale = scale; return m; }, { scale });
export const LAND_KINDS = {
  parrot: K(() => parrotModel(), 1.2),
  macaw: K(macawModel, 1.3),
  toucan: K(toucanModel, 1.2),
  flamingo: K(flamingoModel, 1.4),
  hummingbird: K(() => hummingbirdModel(), 0.6),
  peacock: K(peacockModel, 1.4),
  butterfly: K(() => butterflyModel(), 0.8),
  frog: K(() => frogModel(), 0.9),
  sloth: K(slothModel, 1.3),
  monkey: K(monkeyModel, 1.2),
  lemur: K(lemurModel, 1.2),
  chameleon: K(() => chameleonModel(), 1.0),
  leafkin: K(() => leafkinModel(0x8fe08a, 'leaf'), 1.1),
  seagull: K(seagullModel, 1.1),
  pelican: K(pelicanModel, 1.4),
  coconutCrab: K(coconutCrabModel, 0.9),
  goat: K(goatModel, 1.3),
  bat: K(() => { const m = batModel(); m.userData.wings.forEach((w, i) => { w.rotation.set(0.9, 0, (i ? 1 : -1) * 1.25); }); return m; }, 0.9),
  gecko: K(() => geckoModel(), 0.9),
  tortoise: K(tortoiseModel, 1.3),
  piglet: K(pigletModel, 1.1),
  seaLion: K(seaLionModel, 1.4),
  firefly: K(fireflyModel, 0.6),
  crocodile: K(crocodileModel, 1.5),
  kitten: K(() => kittenModel({ pirate: true }), 1.1),
  ghost: K(ghostModel, 1.4),
};
export const LAND_SCALE = Object.fromEntries(Object.entries(LAND_KINDS).map(([k, f]) => [k, f.scale]));
