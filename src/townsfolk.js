// Townsfolk of the surface islands: chibi fairy-tale inhabitants (gnomes, fairies,
// elves, mushroom and acorn kids, bunny folk, an owl sage, flower sprites, friendly
// pirates, a monkey sailor and a mole digger) and the Townie class that gives each
// one a looping, readable activity (shopkeeping, sweeping, fishing, cooking...).
// Same chunky, round, big-eyed, rosy-cheeked style as landfolk.js.
//
//   const t = new Townie(group, 'gnome', { p, yaw, activity: 'shop', color, hue2, seed, scale, path, floor, props });
//   t.update(dt, t, playerPos); t.cheer();
//
// Models face +z with feet at y=0, ~1.7-2.2 units tall. userData parts: body, head,
// arms [l,r] (shoulder pivots), legs [l,r] (hip pivots), hands/hand [l,r] anchors,
// wings (if any), ears (if any).
import * as THREE from 'three';
import { segment, paintMat } from './geom.js';
import { mulberry32, glowTexture, canvasTexture } from './util.js';
import { pirateHat } from './seafolk.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const rnd = mulberry32(51023); // own stream: never disturbs the world's seeded layout

// ---------- shared materials & geometry ----------
const MATS = new Map();
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

const GEO = new Map();
function geo(key, make) { if (!GEO.has(key)) GEO.set(key, make()); return GEO.get(key); }
const unitSphere = (w, h) => geo(`s${w},${h}`, () => new THREE.SphereGeometry(1, w, h));
function ball(parent, r, m, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, detail = null) {
  const big = r * Math.max(sx, sy, sz);
  const g = detail ? unitSphere(detail[0], detail[1]) : big >= 0.32 ? unitSphere(13, 9) : big >= 0.15 ? unitSphere(10, 7) : big >= 0.075 ? unitSphere(7, 5) : unitSphere(6, 4);
  const me = new THREE.Mesh(g, m);
  me.position.set(x, y, z); me.scale.set(r * sx, r * sy, r * sz);
  parent.add(me);
  return me;
}
function cone(parent, r, h, m, x, y, z, rx = 0, ry = 0, rz = 0, seg = 8, open = false) {
  const me = new THREE.Mesh(geo(`c${r},${h},${seg},${open}`, () => new THREE.ConeGeometry(r, h, seg, 1, open)), m);
  me.position.set(x, y, z); me.rotation.set(rx, ry, rz);
  parent.add(me);
  return me;
}
function cyl(parent, r0, r1, h, m, x, y, z, rx = 0, ry = 0, rz = 0, seg = 8) {
  const me = new THREE.Mesh(geo(`y${r0},${r1},${h},${seg}`, () => new THREE.CylinderGeometry(r0, r1, h, seg)), m);
  me.position.set(x, y, z); me.rotation.set(rx, ry, rz);
  parent.add(me);
  return me;
}
function box(parent, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  const me = new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m);
  me.position.set(x, y, z); me.rotation.set(rx, ry, rz);
  parent.add(me);
  return me;
}
function torus(parent, r, t, m, x, y, z, rx = 0, ry = 0, rz = 0, rad = 5, tub = 14, arc = PI * 2) {
  const me = new THREE.Mesh(geo(`t${r},${t},${rad},${tub},${arc}`, () => new THREE.TorusGeometry(r, t, rad, tub, arc)), m);
  me.position.set(x, y, z); me.rotation.set(rx, ry, rz);
  parent.add(me);
  return me;
}
function limb(parent, a, b, r0, r1, m, radial = 6) {
  const me = new THREE.Mesh(segment(a, b, r0, r1, radial), m);
  parent.add(me);
  return me;
}
// A partial sphere cap (hair, hats): thetaLen of PI/2 is a half dome.
function cap(parent, r, m, x, y, z, thetaLen = PI / 2, sx = 1, sy = 1, sz = 1, rx = 0) {
  const me = new THREE.Mesh(geo(`cap${thetaLen.toFixed(3)}`, () => new THREE.SphereGeometry(1, 14, 6, 0, PI * 2, 0, thetaLen)), m);
  me.position.set(x, y, z); me.scale.set(r * sx, r * sy, r * sz); me.rotation.x = rx;
  parent.add(me);
  return me;
}
function pivot(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function anchor(parent, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; }
function starGeo() {
  return geo('star', () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = PI / 2 + (i / 10) * PI * 2, r = i % 2 ? 0.45 : 1;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }).translate(0, 0, -0.15);
  });
}

// ---------- faces ----------
function eyeball(r, iris) {
  const g = new THREE.Group();
  ball(g, r, basic(0xffffff), 0, 0, 0, 1, 1, 1, [8, 6]);
  if (iris != null) ball(g, r * 0.74, basic(iris), 0, 0, r * 0.36, 1, 1, 1, [7, 4]);
  ball(g, r * (iris != null ? 0.48 : 0.66), basic(0x1b1640), 0, 0, r * (iris != null ? 0.62 : 0.44), 1, 1, 1, [6, 4]);
  ball(g, r * 0.25, basic(0xffffff), -r * 0.22, r * 0.26, r * 0.96, 1, 1, 1, [5, 3]);
  ball(g, r * 0.12, basic(0xffffff), r * 0.2, -r * 0.2, r * 0.98, 1, 1, 1, [4, 3]);
  return g;
}
const BLUSH = new THREE.MeshBasicMaterial({ color: 0xff8fb0, transparent: true, opacity: 0.75, depthWrite: false });
const zOn = (R, x, dy) => Math.sqrt(Math.max(0.0001, R * R - x * x - dy * dy));
// Eyes, smile and blush on a head sphere of radius R centred at (0, cy, 0).
function face(head, cy, R, o = {}) {
  const er = o.eyeR ?? 0.115, ex = o.eyeX ?? 0.17, dy = o.eyeY ?? -0.02;
  const eyesOut = [];
  for (const s of [-1, 1]) {
    const e = eyeball(er, o.iris ?? null);
    e.position.set(ex * s, cy + dy, zOn(R, ex, dy) - er * 0.45 + (o.eyeZ ?? 0)); e.rotation.set(0, 0.38 * s, 0);
    head.add(e); eyesOut.push(e);
  }
  if (!o.noSmile) {
    const sy = o.smileY ?? -0.18;
    const m = new THREE.Mesh(geo('smile', () => new THREE.TorusGeometry(0.06, 0.016, 4, 10, PI)), basic(0x6a1828));
    m.rotation.set(-0.35, 0, PI); m.position.set(0, cy + sy, zOn(R, 0, sy) - 0.005 + (o.smileZ ?? 0)); head.add(m);
  }
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(unitSphere(7, 5), BLUSH);
    c.scale.set(0.08, 0.05, 0.02); c.position.set(0.27 * s, cy - 0.12, zOn(R, 0.27, -0.12) - 0.015 + (o.eyeZ ?? 0)); c.rotation.y = 0.55 * s;
    head.add(c);
  }
  return eyesOut;
}
function finish(g, ud) { g.userData = { ...g.userData, ...ud }; return g; }

// ---------- the chibi base ----------
// o: { skin, shirt, sleeve, pants, shoe, hair, R (head radius), bw (body width),
//      ears: 'round'|'none', wingArms, eye options for face(), noFace, legs: false }
const HIP = 0.4, SEAT = 0.27, NECK = 0.92;
function chibi(o) {
  const g = new THREE.Group();
  const body = pivot(g);
  const skin = pm(o.skin, 0.36), shirt = pm(o.shirt), sleeve = pm(o.sleeve ?? o.shirt), pants = pm(o.pants ?? dk(o.shirt, 0.35)), shoe = pm(o.shoe ?? 0x6a4430, 0.25);
  const bw = o.bw ?? 1;
  const torso = ball(body, 0.3, shirt, 0, 0.62, 0, bw, 1.08, 0.92);
  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, 0.12 * s, HIP, 0);
    if (o.pegRight && s === 1) {
      limb(l, V(0, 0.02, 0), V(0, -0.37, 0.02), 0.06, 0.04, pm(0xa87a4a, 0.3), 6);
      ball(l, 0.045, pm(0x7a5434, 0.3), 0, -0.37, 0.02);
    } else {
      limb(l, V(0, 0.02, 0), V(0, -0.3, 0), 0.085, 0.075, o.legSkin ? skin : pants, 6);
      ball(l, 0.1, shoe, 0, -0.335, 0.05, 1, 0.65, 1.4);
    }
    legs.push(l);
  }
  const arms = [], hands = [];
  for (const s of [-1, 1]) {
    const a = pivot(body, 0.26 * bw * s, 0.8, 0);
    if (o.wingArms) {
      const w = ball(a, 0.2, sleeve, 0.04 * s, -0.2, 0, 0.35, 1.05, 0.75); w.rotation.z = 0.15 * s;
      ball(a, 0.12, pm(lt(o.sleeve ?? o.shirt, 0.25)), 0.05 * s, -0.33, 0.02, 0.4, 0.8, 0.8);
    } else {
      limb(a, V(0, 0.02, 0), V(0.03 * s, -0.33, 0), 0.075, 0.062, sleeve, 6);
      ball(a, 0.078, o.handMat ?? skin, 0.03 * s, -0.37, 0);
    }
    hands.push(anchor(a, 0.03 * s, -0.38, 0));
    a.rotation.z = 0.12 * s;
    arms.push(a);
  }
  const R = o.R ?? 0.46, cy = R - 0.06;
  const head = pivot(body, 0, NECK, 0);
  const skull = ball(head, R, o.headMat ?? skin, 0, cy, 0, 1.04, 0.97, 1);
  if (!o.noFace) face(head, cy, R, o);
  if ((o.ears ?? 'round') === 'round') for (const s of [-1, 1]) ball(head, 0.075, skin, (R + 0.01) * s, cy - 0.04, 0, 0.5, 1, 0.8);
  if (o.hair != null) {
    const hm = pm(o.hair, 0.3);
    cap(head, R * 1.05, hm, 0, cy + 0.01, -0.02, PI * 0.56, 1.05, 1, 1, -0.42);
    for (const s of [-1, 0, 1]) ball(head, 0.1, hm, s * 0.15, cy + R * 0.72, R * 0.55 - Math.abs(s) * 0.05, 1.3, 0.7, 0.8); // bangs
  }
  return finish(g, { body, torso, head, skull, arms, legs, hands, hand: hands, cy, R, top: NECK + cy + R, hipY: HIP, seatDrop: SEAT, wings: null, handItems: [null, null], hover: 0 });
}
const topY = (ud) => ud.cy + ud.R; // head-local y of the crown

// small seeded helpers for variations
function vary(seed) {
  const r = mulberry32((seed ?? Math.floor(rnd() * 1e9)) >>> 0);
  return { r, pick: (a) => a[Math.floor(r() * a.length)] };
}
const SKINS = [0xffdcc4, 0xf6c8a0, 0xe0a878, 0xb07a52, 0x8a5a3a];
const HAIRS = [0x5a3420, 0x8a5a30, 0xffcf6a, 0x2a2030, 0xd8603a, 0xb0a0a0];

// ---------- Paradise Island folk ----------
function gnome(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0x3f7bff, 0x4fc060, 0x9a6aff]), hat = o.hue2 ?? v.pick([0xff4a4a, 0xff6ab4, 0xff8a2a]);
  const g = chibi({ skin: 0xffd8bc, shirt: color, pants: 0x7a5434, shoe: 0x5a3a2a, eyeR: 0.1, eyeY: 0.04, noSmile: true, bw: 1.08 });
  const { head, body, cy, R } = g.userData;
  torus(body, 0.27, 0.035, pm(0x6a4430, 0.25), 0, 0.52, 0, PI / 2, 0, 0, 5, 16);
  box(body, 0.1, 0.08, 0.04, pm(0xffcf3a, 0.45), 0, 0.52, 0.28);
  const white = pm(0xfaf6f0, 0.5), beardC = v.r() < 0.3 ? pm(0xe8e0d8, 0.45) : white;
  ball(head, 0.32, beardC, 0, cy - 0.26, 0.2, 1.05, 1.0, 0.72);
  cone(head, 0.22, 0.38, beardC, 0, cy - 0.58, 0.24, PI - 0.25, 0, 0, 9);
  for (const s of [-1, 1]) ball(head, 0.12, white, 0.1 * s, cy - 0.15, R * 0.86, 1.2, 0.6, 0.7).rotation.z = 0.35 * s;
  ball(head, 0.1, pm(0xff9a8a, 0.4), 0, cy - 0.07, R * 0.97);
  const hm = pm(hat, 0.3);
  const h = pivot(head, 0, cy + R * 0.5, -0.02); h.rotation.x = -0.18;
  torus(h, R * 0.92, 0.06, pm(dk(hat, 0.2)), 0, 0, 0, PI / 2, 0, 0, 5, 16);
  cone(h, R * 0.95, 0.75, hm, 0, 0.37, 0, 0, 0, 0, 12);
  const tip = pivot(h, 0, 0.7, 0); tip.rotation.x = -0.6;
  cone(tip, 0.13, 0.32, hm, 0, 0.12, 0, 0, 0, 0, 8);
  ball(tip, 0.06, pm(0xffe04a, 0.45), 0, 0.27, 0);
  return finish(g, { hat: h, height: 2.05 });
}

function fairy(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0xff8fd0, 0xb08aff, 0x7ad8ff]), hair = o.hue2 ?? v.pick([0xffd84a, 0xff9ac8, 0x9a6aff, 0x5a3420]);
  const g = chibi({ skin: 0xffe6d8, shirt: color, legSkin: true, shoe: dk(color, 0.2), hair, eyeR: 0.125, iris: v.pick([0x3a8aff, 0x6a4ac8, 0x3ab07a]), bw: 0.88 });
  const { head, body, cy, R, hands } = g.userData;
  cone(body, 0.44, 0.52, pm(color), 0, 0.5, 0, 0, 0, 0, 12, true);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; ball(body, 0.1, pm(lt(color, 0.35)), Math.sin(a) * 0.42, 0.25, Math.cos(a) * 0.42, 1, 0.5, 1, [6, 4]); }
  const hm = pm(hair, 0.3);
  ball(head, 0.17, hm, 0, cy + R + 0.04, -0.08);
  ball(head, 0.07, pm(0xff6ab4, 0.4), 0.12, cy + R * 0.85, 0.12); // flower clip
  const wm = pm(lt(color, 0.7), 0.5, { transparent: true, opacity: 0.72, depthWrite: false });
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, 0.06 * s, 0.78, -0.2);
    ball(w, 0.36, wm, 0.3 * s, 0.24, 0, 1, 0.62, 0.05, [10, 6]).rotation.z = 0.55 * s;
    ball(w, 0.24, wm, 0.22 * s, -0.12, 0, 1, 0.62, 0.05, [10, 6]).rotation.z = -0.5 * s;
    w.rotation.y = 0.35 * s;
    wings.push(w);
  }
  const wand = pivot(hands[0], 0, -0.02, 0.02);
  cyl(wand, 0.015, 0.015, 0.42, pm(0xffffff, 0.5), 0, -0.12, 0.12, -PI / 2 + 0.6);
  const st = new THREE.Mesh(starGeo(), pm(0xffe04a, 0.6)); st.scale.setScalar(0.1); st.position.set(0, -0.26, 0.3); wand.add(st);
  return finish(g, { wings, wingStyle: 'fairy', hover: 0.16, handItems: [wand, null], height: 1.95 });
}

function elf(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0x4fc860, 0x6ad8a0, 0x9ad84a]), hair = o.hue2 ?? v.pick([0xffcf6a, 0x8a5a30, 0xffe8a8, 0xd8603a]);
  const g = chibi({ skin: v.pick([0xffe0c8, 0xf6c8a0]), shirt: color, pants: 0x8a6a4a, shoe: 0x5a8a3a, hair, ears: 'none', iris: 0x3ab07a, bw: 0.92 });
  const { head, body, cy, R, legs } = g.userData;
  const skin = g.userData.skull.material;
  for (const s of [-1, 1]) cone(head, 0.08, 0.34, skin, (R + 0.08) * s, cy + 0.06, -0.02, 0, 0, -s * (PI / 2 - 0.45), 6);
  const leaf = pm(dk(color, 0.15), 0.3);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; cone(body, 0.07, 0.2, leaf, Math.sin(a) * 0.27, 0.36, Math.cos(a) * 0.25, PI, 0, 0, 4).rotation.set(PI - Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.3; ball(body, 0.1, pm(lt(color, 0.3)), Math.sin(a) * 0.2, 0.9, Math.cos(a) * 0.17, 1, 0.35, 0.6).rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); }
  for (const l of legs) cone(l, 0.05, 0.16, pm(0x5a8a3a, 0.25), 0, -0.3, 0.2, PI / 2 - 0.5, 0, 0, 5);
  // a little leaf hat with a red feather
  const h = pivot(head, 0.02, cy + R * 0.72, -0.04); h.rotation.set(-0.25, 0, -0.15);
  cone(h, R * 0.72, 0.5, pm(color), 0, 0.15, 0, 0, 0, 0, 10);
  torus(h, R * 0.68, 0.04, leaf, 0, -0.08, 0, PI / 2, 0, 0, 4, 14);
  ball(h, 0.16, pm(0xff4a4a, 0.35), 0.24, 0.15, -0.05, 0.25, 1, 0.12).rotation.z = -0.6;
  return finish(g, { hat: h, height: 2.0 });
}

function mushroomKid(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0x6fa8ff, 0xffb84a, 0xb08aff]), capC = o.hue2 ?? v.pick([0xff4848, 0xff8a2a, 0xc86ad8, 0x9a6034]);
  const g = chibi({ skin: 0xfff2e0, shirt: color, pants: 0xfff2e0, shoe: 0x9a6a4a, R: 0.42, eyeR: 0.11, eyeY: -0.06, smileY: -0.22, ears: 'none' });
  const { head, cy, R } = g.userData;
  const top = pivot(head, 0, cy + R * 0.42, 0);
  cap(top, 0.66, pm(capC, 0.32), 0, -0.04, 0, PI / 2, 1, 0.68, 1);
  const under = new THREE.Mesh(geo('circ', () => new THREE.CircleGeometry(1, 16)), pm(0xfff0dc, 0.45));
  under.rotation.x = PI / 2; under.position.y = -0.04; under.scale.setScalar(0.66); top.add(under);
  const dots = [[0, 0], [0.75, 0.6], [0.75, 2.2], [0.75, 4.0], [0.75, 5.3], [1.15, 1.6], [1.2, 3.1], [1.15, 4.7], [1.2, 0.2]];
  for (const [th, ph] of dots) {
    const n = V(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    const x = n.x * 0.66, y = n.y * 0.45 - 0.04, z = n.z * 0.66;
    const d = ball(top, 0.085, pm(0xffffff, 0.5), x, y, z, 1, 1, 0.35);
    d.lookAt(V(x + n.x / 0.66, y + n.y / 0.45, z + n.z / 0.66));
  }
  return finish(g, { hat: top, height: 1.9 });
}

function acornKid(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0xffa040, 0x6fd860, 0xff6a6a]), capC = o.hue2 ?? v.pick([0x8a5a30, 0x6a4424, 0xa8743a]);
  const g = chibi({ skin: 0xe8b878, shirt: color, pants: 0x7a5434, shoe: 0x5a3a2a, R: 0.44, eyeY: -0.06, smileY: -0.2, ears: 'none' });
  const { head, body, cy, R } = g.userData;
  cone(head, 0.16, 0.2, g.userData.skull.material, 0, cy - R - 0.02, 0, PI, 0, 0, 10); // pointy acorn chin
  const top = pivot(head, 0, cy + R * 0.3, 0);
  const cm = pm(capC, 0.3);
  cap(top, R * 1.12, cm, 0, -0.02, 0, PI / 2, 1, 0.62, 1);
  torus(top, R * 1.06, 0.06, pm(dk(capC, 0.25)), 0, -0.02, 0, PI / 2, 0, 0, 5, 16);
  for (let i = 0; i < 10; i++) { const a = i * 0.63, rr = i < 6 ? 0.36 : 0.18; ball(top, 0.055, pm(lt(capC, 0.2)), Math.cos(a) * rr, i < 6 ? 0.14 : 0.26, Math.sin(a) * rr, 1, 0.55, 1); }
  limb(top, V(0, 0.27, 0), V(0.07, 0.48, -0.02), 0.045, 0.035, pm(dk(capC, 0.3)), 5);
  // leaf scarf
  const lf = pm(0x5fd860, 0.32);
  torus(body, 0.2, 0.06, lf, 0, 0.9, 0.02, PI / 2, 0, 0, 5, 12);
  ball(body, 0.12, lf, 0.12, 0.8, 0.22, 0.6, 1.2, 0.25).rotation.z = 0.5;
  return finish(g, { hat: top, height: 1.95 });
}

function bunnyFolk(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0x7fb8ff, 0xff9ac8, 0xffd04a, 0x9ad86a]), accent = o.hue2 ?? v.pick([0xff6ab4, 0xff8a4a, 0x8a6aff]);
  const fur = v.pick([0xfff8f2, 0xf0e0d0, 0xc8a888, 0xd0d0dc]);
  const g = chibi({ skin: fur, shirt: color, legSkin: true, shoe: fur, ears: 'none', eyeY: 0.0, iris: 0x6a4030 });
  const { head, body, cy, R } = g.userData;
  const fm = g.userData.skull.material, pink = pm(0xffa8c0, 0.4);
  ball(head, 0.05, pink, 0, cy - 0.1, R * 0.97, 1.2, 0.8, 0.8);
  box(head, 0.07, 0.07, 0.02, pm(0xffffff, 0.5), 0, cy - 0.25, zOn(R, 0, -0.25) - 0.02);
  const ears = [];
  for (const s of [-1, 1]) {
    const e = pivot(head, 0.16 * s, cy + R * 0.82, -0.04);
    ball(e, 0.12, fm, 0, 0.36, 0, 0.75, 3.2, 0.5);
    ball(e, 0.08, pink, 0, 0.36, 0.04, 0.6, 3.6, 0.3);
    e.rotation.z = -0.18 * s;
    ears.push(e);
  }
  cone(body, 0.42, 0.5, pm(color), 0, 0.5, 0, 0, 0, 0, 12, true);
  const ap = pm(0xffffff, 0.5);
  ball(body, 0.24, ap, 0, 0.42, 0.24, 1, 1.3, 0.35);
  ball(body, 0.1, pm(accent, 0.35), 0, 0.36, 0.33, 1, 0.75, 0.3);
  torus(body, 0.22, 0.025, ap, 0, 0.66, 0, PI / 2, 0, 0, 4, 14);
  for (const s of [-1, 1]) ball(body, 0.08, pm(accent, 0.35), 0.08 * s, 0.66, -0.28, 1.2, 0.8, 0.5);
  ball(body, 0.12, fm, 0, 0.3, -0.38); // fluffy tail
  return finish(g, { ears, height: 2.2 });
}

function owlSage(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0x6a5acd, 0x3a7ad8, 0x2fa08a]), feather = o.hue2 ?? v.pick([0xb08a5a, 0x9a7a6a, 0xd8c8b0]);
  const g = chibi({ skin: feather, shirt: color, sleeve: feather, pants: 0xffa040, shoe: 0xffa040, wingArms: true, R: 0.5, noFace: true, ears: 'none', bw: 1.2 });
  const { head, body, cy, R } = g.userData;
  const disc = pm(lt(feather, 0.55), 0.4);
  for (const s of [-1, 1]) ball(head, 0.2, disc, 0.17 * s, cy + 0.02, 0.33, 1, 1, 0.45);
  face(head, cy, R, { eyeR: 0.13, eyeX: 0.17, eyeY: 0.02, eyeZ: 0.06, iris: 0xffa020, noSmile: true });
  const gold = pm(0xffcf3a, 0.45);
  for (const s of [-1, 1]) torus(head, 0.15, 0.022, gold, 0.17 * s, cy + 0.02, zOn(R, 0.17, 0.02) + 0.05, 0, 0.35 * s, 0, 5, 16);
  limb(head, V(-0.04, cy + 0.04, R + 0.05), V(0.04, cy + 0.04, R + 0.05), 0.015, 0.015, gold, 4);
  cone(head, 0.07, 0.16, pm(0xffa040, 0.35), 0, cy - 0.13, R * 0.98, PI + 0.3, 0, 0, 6);
  for (const s of [-1, 1]) cone(head, 0.1, 0.24, pm(dk(feather, 0.2)), 0.28 * s, cy + R * 0.86, -0.04, 0, 0, -0.35 * s, 6);
  // long wizard robe with stars
  cone(body, 0.46, 0.7, pm(color), 0, 0.42, 0, 0, 0, 0, 12, true);
  for (const [x, y, z] of [[0.2, 0.3, 0.28], [-0.15, 0.5, 0.25], [0.05, 0.18, 0.4]]) {
    const st = new THREE.Mesh(starGeo(), pm(0xffe04a, 0.6)); st.scale.setScalar(0.06); st.position.set(x, y, z); body.add(st);
  }
  const hat = pivot(head, 0, cy + R * 0.8, -0.05); hat.rotation.set(-0.25, 0, 0.12);
  cone(hat, 0.24, 0.42, pm(color), 0, 0.18, 0, 0, 0, 0, 10);
  const st = new THREE.Mesh(starGeo(), pm(0xffe04a, 0.6)); st.scale.setScalar(0.06); st.position.set(0, 0.42, 0); hat.add(st);
  return finish(g, { height: 1.95 });
}

function flowerSprite(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0xff7ab8, 0xff9a4a, 0xb08aff, 0xff5a6a]), petal = o.hue2 ?? v.pick([0xffe04a, 0xffffff, 0xffb0d8]);
  const g = chibi({ skin: 0xe0f8cc, shirt: 0x6fd860, sleeve: 0x6fd860, legSkin: true, shoe: 0x5fb850, iris: 0x3ab07a, ears: 'none', bw: 0.9 });
  const { head, body, cy } = g.userData;
  const pm1 = pm(color, 0.35), pm2 = pm(lt(color, 0.3), 0.38);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    const p = ball(body, 0.2, i % 2 ? pm1 : pm2, Math.sin(a) * 0.28, 0.36, Math.cos(a) * 0.26, 0.6, 0.3, 1, [7, 4]);
    p.rotation.set(0, a, 0); p.rotateX(0.55);
  }
  const halo = pivot(head, 0, cy, -0.22), hm = pm(petal, 0.4);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2;
    const p = ball(halo, 0.2, hm, Math.sin(a) * 0.52, Math.cos(a) * 0.52, 0, 0.55, 1, 0.18, [7, 4]);
    p.rotation.z = -a;
  }
  ball(head, 0.07, pm(0xff6ab4, 0.4), 0, cy + 0.44, 0.1);
  limb(head, V(0, cy + 0.42, 0), V(0.05, cy + 0.66, -0.04), 0.022, 0.018, pm(0x4fc040), 4);
  ball(head, 0.09, pm(0x5fd860), 0.12, cy + 0.64, -0.04, 1, 0.3, 0.55).rotation.z = -0.4;
  return finish(g, { height: 1.95 });
}

// ---------- Skull Island folk ----------
function stripes(body, color, bw = 1) {
  const m = pm(color);
  for (const dy of [-0.16, -0.04, 0.08, 0.2]) {
    const r = 0.3 * Math.sqrt(1 - (dy / 0.324) ** 2);
    const t = torus(body, r * bw + 0.004, 0.028, m, 0, 0.62 + dy, 0, PI / 2, 0, 0, 3, 14);
    t.scale.set(1, 0.92 / bw, 1);
  }
}
function pirateKid(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0x3f6bff, 0xff4a4a, 0x2fb0a0]), band = o.hue2 ?? v.pick([0xff3a3a, 0xffcf3a, 0x8a5aff, 0x3a9aff]);
  const g = chibi({ skin: v.pick(SKINS), shirt: 0xfaf6ee, sleeve: 0xfaf6ee, pants: v.pick([0x8a6a4a, 0x4a5a8a]), shoe: 0x4a3428, hair: v.pick(HAIRS) });
  const { head, body, cy, R } = g.userData;
  stripes(body, color);
  const bm = pm(band, 0.3);
  cap(head, R * 1.08, bm, 0, cy + 0.04, -0.03, PI * 0.42, 1.03, 1, 1, -0.25);
  ball(head, 0.09, bm, 0, cy + 0.12, -R - 0.02);
  for (const s of [-1, 1]) cone(head, 0.06, 0.22, bm, 0.06 * s, cy + 0.02, -R - 0.08, 0.5, 0, 0.4 * s, 5);
  const dots = pm(0xffffff, 0.5);
  for (const [a, b] of [[0.5, 0.6], [-0.4, 0.75], [0.1, 0.95]]) ball(head, 0.035, dots, Math.sin(a) * R * 0.9, cy + R * Math.cos(b) * 0.98, Math.cos(a) * R * Math.sin(b) * 0.98, 1, 1, 0.4);
  if (v.r() < 0.6) torus(head, 0.04, 0.012, pm(0xffcf3a, 0.5), R + 0.02, cy - 0.12, 0.02, 0, PI / 2, 0, 4, 10);
  return finish(g, { height: 1.85 });
}

function pirateCook(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0x5fb0ff, 0xff8a4a, 0x8ad86a]), scarf = o.hue2 ?? v.pick([0xff3a3a, 0x3a6aff]);
  const g = chibi({ skin: v.pick(SKINS), shirt: color, pants: 0x4a4a6a, shoe: 0x3a2a24, bw: 1.25, eyeR: 0.11 });
  const { head, body, cy, R, legs } = g.userData;
  ball(body, 0.27, pm(0xffffff, 0.5), 0, 0.55, 0.13, 1.1, 1.05, 0.7); // apron
  torus(body, 0.17, 0.05, pm(scarf, 0.3), 0, 0.9, 0.03, PI / 2, 0, 0, 5, 12);
  ball(body, 0.08, pm(scarf, 0.3), 0.1, 0.84, 0.18);
  const hat = pivot(head, 0, cy + R * 0.82, -0.02); hat.rotation.x = -0.12;
  const wh = pm(0xffffff, 0.45);
  cyl(hat, 0.27, 0.29, 0.21, wh, 0, 0, 0, 0, 0, 0, 12);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; ball(hat, 0.19, wh, Math.cos(a) * 0.15, 0.28, Math.sin(a) * 0.15, 1, 1, 1, [8, 6]); }
  ball(hat, 0.21, wh, 0, 0.4, 0, 1, 1, 1, [9, 6]);
  const blk = pm(0x2a2238, 0.2);
  const ex = 0.17, ez = zOn(R, ex, -0.02);
  cyl(head, 0.11, 0.11, 0.03, blk, -ex, cy - 0.02, ez + 0.03, PI / 2, -0.38, 0, 10); // eyepatch over the left eye
  const strap = torus(head, R * 1.01, 0.016, blk, 0, cy, 0, 0, 0, 0, 3, 22);
  strap.quaternion.setFromUnitVectors(V(0, 0, 1), V(-0.37, -0.02, 0.93).normalize().cross(V(0.45, 0.89, 0)).normalize());
  const mu = pm(v.pick([0x4a2a1a, 0x8a5a30, 0xb0a0a0]), 0.3);
  for (const s of [-1, 1]) { const m = ball(head, 0.1, mu, 0.08 * s, cy - 0.13, R * 0.88, 1.3, 0.55, 0.6); m.rotation.z = -0.35 * s; ball(head, 0.045, mu, 0.19 * s, cy - 0.08, R * 0.8); }
  ball(head, 0.07, pm(0xffa890, 0.4), 0, cy - 0.06, R * 0.98);
  return finish(g, { hat, height: 2.1 });
}

function pirateCaptain(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0xd03040, 0x3a4ac8, 0x2a8a5a]), trim = o.hue2 ?? 0xffcf3a;
  const g = chibi({ skin: v.pick(SKINS), shirt: color, pants: 0x3a3048, shoe: 0x2a2024, pegRight: true, bw: 1.1 });
  const { head, body, cy, R } = g.userData;
  const gold = pm(trim, 0.45);
  cone(body, 0.42, 0.5, pm(color), 0, 0.44, -0.02, 0, 0, 0, 12, true);
  ball(body, 0.13, pm(0xffffff, 0.5), 0, 0.82, 0.22, 1, 1.1, 0.6); // cravat
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) ball(body, 0.03, gold, 0.1 * s, 0.68 - i * 0.12, 0.27 - i * 0.005);
  for (const s of [-1, 1]) { const e = ball(body, 0.1, gold, 0.27 * s, 0.86, 0, 1.2, 0.45, 1); e.rotation.z = -0.4 * s; }
  torus(body, 0.3, 0.04, pm(0x2a2024, 0.25), 0, 0.5, 0, PI / 2, 0, 0, 4, 16);
  const hat = pirateHat(0.98); hat.position.set(0, cy + R * 0.66, -0.02); head.add(hat);
  const mu = pm(v.pick([0x2a2030, 0x8a3a1a, 0xd8d0c8]), 0.3);
  for (const s of [-1, 1]) {
    ball(head, 0.1, mu, 0.09 * s, cy - 0.13, R * 0.88, 1.4, 0.5, 0.6).rotation.z = -0.25 * s;
    ball(head, 0.05, mu, 0.21 * s, cy - 0.06, R * 0.8).scale.set(0.05, 0.06, 0.05);
  }
  ball(head, 0.075, pm(0xffa890, 0.4), 0, cy - 0.06, R * 0.98);
  return finish(g, { hat, height: 2.15 });
}

function monkeySailor(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0x3f6bff, 0x2a4ab0, 0x3ab0d0]), scarf = o.hue2 ?? v.pick([0xff4a4a, 0xffcf3a]);
  const fur = v.pick([0x9a6440, 0x7a5034, 0xb07a4a]);
  const g = chibi({ skin: fur, shirt: 0xfaf6ee, sleeve: 0xfaf6ee, pants: color, shoe: 0x3a2a24, handMat: pm(0xf6d8b4, 0.42), noFace: true, ears: 'none' });
  const { head, body, cy, R } = g.userData;
  stripes(body, color);
  const fc = pm(0xf6d8b4, 0.42);
  for (const s of [-1, 1]) ball(head, 0.19, fc, 0.11 * s, cy + 0.02, R * 0.6, 1, 1.1, 0.6);
  ball(head, 0.2, fc, 0, cy - 0.15, R * 0.65, 1.3, 0.8, 0.7);
  face(head, cy, R, { eyeZ: 0.04, smileZ: 0.05, eyeY: 0.02, smileY: -0.22 });
  for (const s of [-1, 1]) ball(head, 0.025, basic(0x3a2418), 0.035 * s, cy - 0.1, R + 0.04);
  for (const s of [-1, 1]) { ball(head, 0.15, g.userData.skull.material, (R + 0.02) * s, cy, 0, 0.55, 1, 1); ball(head, 0.09, pm(0xffb0b8, 0.4), (R + 0.06) * s, cy, 0.02, 0.35, 0.9, 0.9); }
  // white sailor cap
  const hat = pivot(head, 0, cy + R * 0.78, -0.02); hat.rotation.set(-0.15, 0, 0.2);
  cyl(hat, 0.3, 0.26, 0.16, pm(0xffffff, 0.5), 0, 0.05, 0, 0, 0, 0, 14);
  torus(hat, 0.28, 0.035, pm(color), 0, -0.02, 0, PI / 2, 0, 0, 4, 16);
  torus(body, 0.18, 0.05, pm(scarf, 0.3), 0, 0.9, 0.03, PI / 2, 0, 0, 5, 12);
  cone(body, 0.09, 0.18, pm(scarf, 0.3), 0, 0.8, 0.24, 0.3, 0, PI, 4);
  const tail = pivot(body, 0, 0.38, -0.25);
  const pts = [];
  for (let i = 0; i <= 6; i++) { const u = i / 6, a = u * PI * 1.7; pts.push(V(0, -0.05 + u * 0.55 + Math.sin(a) * 0.12, -0.1 - u * 0.25 - Math.cos(a) * 0.1 + 0.1)); }
  for (let i = 0; i < 6; i++) limb(tail, pts[i], pts[i + 1], 0.045, 0.04, g.userData.skull.material, 5);
  return finish(g, { hat, tail, height: 1.95 });
}

function mole(o = {}) {
  const v = vary(o.seed);
  const color = o.color ?? v.pick([0x4f8fff, 0xff8a4a, 0x6ac860]), hatC = o.hue2 ?? 0xffd23a;
  const fur = v.pick([0x6a5a6a, 0x5a4a44, 0x7a6a7a]);
  const pink = pm(0xffa8c0, 0.42);
  const g = chibi({ skin: fur, shirt: color, sleeve: fur, pants: color, shoe: 0xffa8c0, handMat: pink, eyeR: 0.09, eyeY: 0.04, smileY: -0.24, ears: 'none', bw: 1.12 });
  const { head, body, cy, R, hands } = g.userData;
  ball(head, 0.22, pm(0xf0c8b8, 0.4), 0, cy - 0.14, R * 0.72, 1.1, 0.8, 0.7);
  ball(head, 0.07, pink, 0, cy - 0.08, R + 0.05);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; ball(head, 0.03, pink, Math.cos(a) * 0.08, cy - 0.08 + Math.sin(a) * 0.08, R + 0.03); }
  for (const s of [-1, 1]) {
    box(body, 0.06, 0.32, 0.03, pm(color), 0.12 * s, 0.82, 0.22, 0.25, 0, 0);
    ball(body, 0.035, pm(0xffcf3a, 0.45), 0.12 * s, 0.72, 0.27);
  }
  for (const h of hands) for (let i = -1; i <= 1; i++) cone(h, 0.022, 0.08, pm(0xfff6e0, 0.45), i * 0.04, -0.07, 0.03, PI, 0, 0, 4);
  const hat = pivot(head, 0, cy + R * 0.42, 0); hat.rotation.x = -0.12;
  cap(hat, R * 1.02, pm(hatC, 0.35), 0, 0, 0, PI / 2, 1, 0.75, 1);
  torus(hat, R * 1.02, 0.05, pm(dk(hatC, 0.15), 0.35), 0, 0.01, 0, PI / 2, 0, 0, 4, 16);
  cyl(hat, 0.08, 0.08, 0.08, pm(0x7a7a8a, 0.3), 0, 0.22, R * 0.82, PI / 2 - 0.4, 0, 0, 10);
  cyl(hat, 0.065, 0.065, 0.02, pm(0xfff6a0, 0.9), 0, 0.235, R * 0.87, PI / 2 - 0.4, 0, 0, 10);
  return finish(g, { hat, height: 1.9 });
}

export const TOWN_TYPES = {
  gnome, fairy, elf, mushroomKid, acornKid, bunnyFolk, owlSage, flowerSprite,
  pirateKid, pirateCook, pirateCaptain, monkeySailor, mole,
};

// ---------- sprites ----------
const TEX = {};
function texFor(kind) {
  if (TEX[kind]) return TEX[kind];
  const draw = {
    z: (g, w) => { g.strokeStyle = '#5a6aff'; g.lineWidth = 9; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 16); g.lineTo(w - 14, 16); g.lineTo(14, w - 16); g.lineTo(w - 14, w - 16); g.stroke(); },
    note: (g) => { g.fillStyle = '#ff4fa8'; g.beginPath(); g.ellipse(22, 46, 11, 8, -0.4, 0, PI * 2); g.fill(); g.fillRect(29, 10, 6, 37); g.beginPath(); g.moveTo(35, 10); g.quadraticCurveTo(54, 18, 48, 34); g.quadraticCurveTo(48, 22, 35, 22); g.fill(); },
    bubble: (g, w) => { g.fillStyle = '#ffffff'; g.strokeStyle = '#5a6a9a'; g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2, 26, 28, 20, 0, 0, PI * 2); g.fill(); g.stroke(); g.beginPath(); g.moveTo(20, 40); g.lineTo(14, 58); g.lineTo(32, 44); g.fill(); g.fillStyle = '#5a6a9a'; for (const x of [20, 32, 44]) { g.beginPath(); g.arc(x, 26, 4.5, 0, PI * 2); g.fill(); } },
    heart: (g) => { g.fillStyle = '#ff4f8a'; g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(4, 34, 10, 8, 32, 22); g.bezierCurveTo(54, 8, 60, 34, 32, 54); g.fill(); },
    star: (g) => { g.fillStyle = '#ffe24a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? 12 : 28; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); },
  }[kind];
  TEX[kind] = canvasTexture(64, 64, draw);
  return TEX[kind];
}
function sprite(parent, kind, size, color = 0xffffff) {
  const m = new THREE.SpriteMaterial({ map: kind === 'glow' ? glowTexture() : texFor(kind), color, transparent: true, depthWrite: false });
  m.userData.noPaint = 'activity sprite (zzz, notes, steam)';
  const s = new THREE.Sprite(m); s.scale.setScalar(size); s.userData.size = size;
  parent.add(s);
  return s;
}

// ---------- props ----------
const WOOD = 0xb07a4a, WOOD_D = 0x7a5434;
function itemModel(kind) {
  const g = new THREE.Group();
  if (kind === 'apple') { ball(g, 0.11, pm(0xff3a3a, 0.35)); limb(g, V(0, 0.09, 0), V(0.02, 0.16, 0), 0.012, 0.01, pm(WOOD_D), 4); ball(g, 0.05, pm(0x5fd860), 0.05, 0.14, 0, 1, 0.3, 0.6); }
  else if (kind === 'cake') { cyl(g, 0.13, 0.13, 0.12, pm(0xffd8a8, 0.4), 0, 0, 0, 0, 0, 0, 12); cyl(g, 0.135, 0.135, 0.04, pm(0xff9ac8, 0.45), 0, 0.07, 0, 0, 0, 0, 12); ball(g, 0.04, pm(0xff3a3a, 0.4), 0, 0.11, 0); }
  else if (kind === 'fish') { ball(g, 0.1, pm(0x7ac8ff, 0.4), 0, 0, 0, 0.5, 1, 1.8); cone(g, 0.09, 0.12, pm(0x5aa8ff, 0.4), 0, 0, -0.22, -PI / 2, 0, 0, 4); }
  else if (kind === 'bread') { ball(g, 0.12, pm(0xe0a050, 0.35), 0, 0, 0, 1.6, 0.8, 0.9); }
  else { cyl(g, 0.08, 0.06, 0.12, pm(0xd87a4a, 0.3), 0, -0.04, 0, 0, 0, 0, 8); ball(g, 0.09, pm(0xff6ab4, 0.4), 0, 0.08, 0); ball(g, 0.04, pm(0xffe04a, 0.5), 0, 0.12, 0.05); }
  return g;
}
function stump(parent, h = 0.42) {
  cyl(parent, 0.28, 0.32, h, pm(WOOD), 0, h / 2, -0.04, 0, 0, 0, 10);
  cyl(parent, 0.27, 0.27, 0.02, pm(0xe8c890, 0.4), 0, h + 0.005, -0.04, 0, 0, 0, 10);
}
function crate(parent, s, x, y, z, ry = 0) {
  const g = pivot(parent, x, y, z); g.rotation.y = ry;
  box(g, s, s, s, pm(WOOD), 0, s / 2, 0);
  const d = pm(WOOD_D);
  for (const a of [-1, 1]) { box(g, s * 1.02, s * 0.12, s * 1.02, d, 0, s / 2 + a * s * 0.38, 0); }
  return g;
}

// ---------- the Townie ----------
export const ACTIVITIES = ['shop', 'sweep', 'garden', 'fish', 'cook', 'read', 'music', 'dance', 'chat', 'wave', 'sit', 'swing',
  'sleep', 'carry', 'walk', 'paint', 'build', 'dig', 'play', 'lookout', 'scrub', 'juggle'];
const SITTERS = new Set(['fish', 'read', 'sit']);
const wrap = (a) => a - Math.round(a / (PI * 2)) * PI * 2;
const frac = (x) => x - Math.floor(x);
const clamp = THREE.MathUtils.clamp;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

// new Townie(parent, type, { p, yaw, activity, path, floor, color, hue2, seed, scale=1,
//   props=true (false: no counter/stump/easel/... — for sitters p is then the seat top),
//   seat (fish/read/sit: bottom height above p in world units — 0 floor/pier edge, 0.4 bench; no stump then),
//   swing ({ pivot, length, mesh? }: p is the seat at rest; with mesh the townie rides that Object3D),
//   item ('apple'|'cake'|'flower'|'fish'|'bread', shop), waterY (fish: world y of the water), instrument ('flute'|'drum') })
export class Townie {
  constructor(parent, type, opts = {}) {
    this.type = TOWN_TYPES[type] ? type : 'gnome';
    this.opts = opts;
    this.activity = ACTIVITIES.includes(opts.activity) ? opts.activity : 'wave';
    const seed = (opts.seed ?? Math.floor(rnd() * 1e9)) >>> 0;
    this.r = mulberry32(seed ^ 0x9e3779b9);
    this.model = TOWN_TYPES[this.type]({ color: opts.color, hue2: opts.hue2, seed });
    this.ud = this.model.userData;
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.mover = pivot(this.root);
    this.mover.add(this.model);
    this.scale = opts.scale ?? 1;
    this.root.scale.setScalar(this.scale);
    this.pos = this.root.position;
    this.home = (opts.p ?? new THREE.Vector3()).clone();
    this.pos.copy(this.home);
    this.yaw = opts.yaw ?? 0;
    this.root.rotation.y = this.yaw;
    this.floor = opts.floor ?? null;
    this.withProps = opts.props !== false;
    this.ph = this.r() * 100; this.rate = 0.88 + this.r() * 0.24; this.time = 0;
    this.happy = 0; this.greet = 0; this.greeted = false; this.cheered = false; this.look = 0;
    this.waveArm = 1; this.headYaw = 0; this.bodyYaw = 0;
    this.P = {};
    const setup = this['_set_' + this.activity];
    if (setup) setup.call(this);
    this.act = this['_' + this.activity];
    parent.add(this.root);
    this.update(0, 0, null);
  }

  cheer() { this.happy = 1.5; }

  // ----- pose helpers -----
  arm(i, out, fwd, twist = 0) { const s = i ? 1 : -1; this.ud.arms[i].rotation.set(-fwd, twist, s * out); }
  _rest() {
    const u = this.ud;
    for (let i = 0; i < 2; i++) this.arm(i, 0.12, 0);
    for (const l of u.legs) l.rotation.set(0, 0, 0);
    u.head.rotation.set(0, 0, 0);
    u.body.rotation.set(0, 0, 0); u.body.position.set(0, 0, 0);
    this.model.position.set(0, 0, 0); this.model.rotation.set(0, 0, 0);
    this.model.scale.set(1, 1, 1);
  }
  _hide(i) { const it = this.ud.handItems[i]; if (it) it.visible = false; }
  _sitPose(T, swing = 0.35) {
    const u = this.ud;
    this.model.position.y = this.seatH - u.seatDrop;
    const low = this.seatH < 0.15; // on the floor / a pier edge: legs stick out in front
    u.legs.forEach((l, i) => { l.rotation.x = (low ? -1.4 : -1.15) + Math.sin(T * 3 + i * PI) * swing * (low ? 0.4 : 1); });
  }
  // opts.seat (bottom height above p, world units) wins; else a stump to sit on; with
  // props:false and no seat, p itself is the seat top and the legs dangle below it.
  _seat() {
    if (this.opts.seat != null) { this.seatH = this.opts.seat / this.scale; return; }
    this.seatH = this.withProps ? 0.44 : 0.3;
    if (this.withProps) stump(this.root, 0.44);
    else this.mover.position.y = -0.3;
  }
  _steps(T, w, amp = 0.6) {
    const u = this.ud, k = Math.sin(T);
    u.legs[0].rotation.x = k * amp * w; u.legs[1].rotation.x = -k * amp * w;
    this.model.position.y += Math.abs(Math.cos(T)) * 0.05 * w;
    this.model.rotation.z = Math.sin(T) * 0.05 * w;
  }
  _lookAround(T, amt = 0.7) {
    const h = this.ud.head;
    h.rotation.y = Math.sin(T * 0.9) * amt * (Math.sin(T * 0.37) > -0.2 ? 1 : 0.2);
    h.rotation.z = Math.sin(T * 0.6) * 0.1;
  }
  _cycleFx(list, T, rate, fn) { for (let k = 0; k < list.length; k++) fn(list[k], frac(T * rate + k / list.length)); }

  // ----- shop -----
  _set_shop() {
    const r = this.r;
    const pirate = /pirate|monkey|mole/.test(this.type);
    const kinds = pirate ? ['fish', 'bread', 'apple'] : ['apple', 'cake', 'flower'];
    const kind = this.opts.item ?? kinds[Math.floor(r() * kinds.length)];
    this._hide(0);
    const it = itemModel(kind); it.position.set(0, -0.14, 0); this.ud.hands[0].add(it); it.visible = false;
    this.P.item = it;
    if (this.withProps) {
      const c = pivot(this.root, 0, 0, 0.66);
      box(c, 1.6, 0.72, 0.4, pm(WOOD), 0, 0.36, 0);
      box(c, 1.75, 0.06, 0.52, pm(0xe8c890, 0.4), 0, 0.75, 0);
      const cloth = pm(this.opts.hue2 ?? (pirate ? 0xff4a4a : 0xff8ac8), 0.35);
      for (let i = 0; i < 4; i++) box(c, 0.36, 0.22, 0.02, i % 2 ? pm(0xffffff, 0.5) : cloth, -0.6 + i * 0.4, 0.6, 0.21);
      for (let i = 0; i < 5; i++) { const m = itemModel(kind); m.position.set(-0.65 + i * 0.32, 0.86, 0.05 + (i % 2) * 0.08); m.scale.setScalar(0.9); c.add(m); }
    }
  }
  _shop(T) {
    const u = this.ud;
    u.body.rotation.z = Math.sin(T * 1.6) * 0.06;
    this.model.position.y = Math.abs(Math.sin(T * 3.2)) * 0.04;
    const c = (T * 0.85) % 7;
    this.arm(0, 0.05, 1.35); this.arm(1, 0.05, 1.35);
    this.P.item.visible = false;
    if (c < 2) { // call the customers with a big wave
      const k = smooth(0, 0.3, c) * (1 - smooth(1.7, 2, c));
      this.arm(1, 0.05 + k * 2.45 + Math.sin(T * 11) * 0.35 * k, 1.35 * (1 - k));
      u.head.rotation.z = 0.15 * k; u.head.rotation.x = -0.1 * k;
    } else if (c > 3.3 && c < 5.6) { // hold up an item
      const k = smooth(3.3, 3.7, c) * (1 - smooth(5.2, 5.6, c));
      this.arm(0, 0.05 + 0.1 * k, 1.35 + k * 1.4 + Math.sin(T * 6) * 0.08 * k);
      this.P.item.visible = k > 0.4;
      this.P.item.rotation.x = 1.35 + 1.4 * k; this.P.item.rotation.y = T * 2;
      u.head.rotation.y = -0.25 * k; u.head.rotation.x = -0.15 * k;
    } else u.head.rotation.y = Math.sin(T * 0.8) * 0.4;
  }

  // ----- sweep -----
  _set_sweep() {
    this._hide(0); this._hide(1);
    const b = pivot(this.ud.body, 0, 0.62, 0.22);
    limb(b, V(0, 0.28, -0.25), V(0, -0.58, 0.62), 0.025, 0.025, pm(WOOD), 5);
    const head = pivot(b, 0, -0.58, 0.62); head.rotation.x = 0.75;
    cyl(head, 0.05, 0.16, 0.22, pm(0xe8c860, 0.4), 0, -0.04, 0, 0, 0, 0, 8);
    torus(head, 0.06, 0.02, pm(0xff4a4a, 0.35), 0, 0.06, 0, PI / 2, 0, 0, 4, 10);
    this.P.broom = b;
    this.P.dust = [0, 1, 2].map(() => sprite(this.mover, 'glow', 0.3, 0xe8d8b0));
    this.waveArm = 0;
  }
  _sweep(T, dt) {
    const u = this.ud, w = Math.sin(T * 3.2);
    this.P.broom.rotation.y = w * 0.55;
    u.body.rotation.y = w * 0.18;
    this.arm(1, 0.05, 0.55, 0); this.arm(0, -0.25, 1.05, 0);
    u.head.rotation.x = 0.15; u.head.rotation.y = -w * 0.15;
    const wx = Math.sin(T * 0.22) * 1.5, wz = Math.sin(T * 0.13) * 0.4;
    const mv = Math.abs(Math.cos(T * 0.22)) * 0.33;
    this.mover.position.set(wx, 0, wz);
    if (this.floor) {
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const x = this.home.x + (wx * c + wz * s) * this.scale, z = this.home.z + (-wx * s + wz * c) * this.scale;
      this.mover.position.y = (this.floor(x, z, this.home.y) - this.home.y) / this.scale;
    }
    this._steps(T * 2.2, mv * 3, 0.35);
    this._cycleFx(this.P.dust, T, 0.9, (s, f) => {
      s.position.set(Math.sin(T * 3.2 - f) * 0.5, 0.08 + f * 0.35, 0.8 + f * 0.2);
      s.material.opacity = Math.sin(f * PI) * 0.55 * Math.abs(w); s.scale.setScalar(0.2 + f * 0.35);
    });
  }

  // ----- garden -----
  _set_garden() {
    this._hide(1);
    const hue = this.opts.hue2 ?? 0x5ab0ff;
    const can = pivot(this.ud.hands[1], 0, -0.02, 0); can.scale.setScalar(1.35);
    const cm = pm(hue, 0.35);
    cyl(can, 0.12, 0.13, 0.2, cm, 0, -0.1, 0.06, 0, 0, 0, 10);
    torus(can, 0.08, 0.02, cm, 0, 0.02, 0.0, 0, PI / 2, 0, 4, 10, PI);
    limb(can, V(0, -0.14, 0.16), V(0, 0.02, 0.36), 0.025, 0.018, cm, 5);
    cyl(can, 0.04, 0.025, 0.04, pm(dk(hue, 0.2)), 0, 0.03, 0.38, 0.9, 0, 0, 6);
    this.P.can = can; this.P.spout = anchor(can, 0, 0.04, 0.42);
    const N = 10, pos = new Float32Array(N * 3);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x7ad0ff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false });
    mat.userData.noPaint = 'water droplets';
    this.P.drops = new THREE.Points(pg, mat); this.P.drops.frustumCulled = false; this.root.add(this.P.drops);
    if (this.withProps) {
      const bed = pivot(this.root, 0, 0, 0.95);
      ball(bed, 0.5, pm(0x8a5a3a, 0.25), 0, 0, 0, 1.4, 0.25, 0.7);
      const fc = [0xff6ab4, 0xffe04a, 0xff7a4a, 0xb08aff];
      for (let i = 0; i < 4; i++) {
        const x = -0.45 + i * 0.3, h = 0.25 + (i % 2) * 0.1;
        limb(bed, V(x, 0.05, 0), V(x, h, 0), 0.02, 0.02, pm(0x4fc040), 4);
        ball(bed, 0.07, pm(0x5fd860), x + 0.05, h * 0.5, 0, 1, 0.3, 0.6).rotation.z = -0.5;
        for (let k = 0; k < 5; k++) { const a = k * 1.256; ball(bed, 0.06, pm(fc[i], 0.4), x + Math.cos(a) * 0.06, h + 0.02, Math.sin(a) * 0.06, 1, 0.5, 1, [5, 3]); }
        ball(bed, 0.04, pm(0xffe04a, 0.5), x, h + 0.05, 0);
      }
    }
  }
  _garden(T) {
    const u = this.ud, c = (T * 0.8) % 4.5, pour = smooth(0.4, 0.9, c) * (1 - smooth(3.0, 3.5, c));
    const fwd = 1.15;
    this.arm(1, 0.1, fwd); this.arm(0, 0.35, 0.2);
    this.P.can.rotation.x = fwd + pour * 0.75;
    u.head.rotation.x = 0.25 * pour; u.body.rotation.x = 0.06 * pour;
    u.body.rotation.z = Math.sin(T * 1.3) * 0.04;
    if (pour < 0.2) this._lookAround(T, 0.4);
    this.model.position.y = Math.abs(Math.sin(T * 2)) * 0.02;
    const pts = this.P.drops, arr = pts.geometry.attributes.position.array;
    pts.visible = pour > 0.5;
    if (pts.visible) {
      this.root.updateMatrixWorld(true);
      this.P.spout.getWorldPosition(_v); this.root.worldToLocal(_v);
      const n = arr.length / 3;
      for (let i = 0; i < n; i++) {
        const f = frac(T * 1.6 + i / n);
        arr[i * 3] = _v.x + Math.sin(i * 7.3) * 0.03; arr[i * 3 + 1] = _v.y - f * f * 1.1; arr[i * 3 + 2] = _v.z + f * 0.22;
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ----- fish -----
  _set_fish() {
    this._seat(); this._hide(0); this._hide(1);
    const rod = pivot(this.ud.hands[1], 0, -0.02, 0);
    limb(rod, V(0, 0.15, -0.1), V(0, -0.15, 1.65), 0.03, 0.012, pm(WOOD_D), 5);
    torus(rod, 0.05, 0.015, pm(0x9a9aa8, 0.35), 0.05, 0.05, 0.05, 0, PI / 2, 0, 4, 8);
    this.P.rod = rod; this.P.tip = anchor(rod, 0, -0.15, 1.65);
    const lineM = pm(0xffffff, 0.6);
    this.P.line = new THREE.Mesh(geo('line', () => new THREE.CylinderGeometry(0.008, 0.008, 1, 3).translate(0, 0.5, 0)), lineM);
    this.root.add(this.P.line);
    const wy = this.opts.waterY != null ? (this.opts.waterY - this.home.y) / this.scale : 0.03;
    const bob = pivot(this.root, 0, wy, 2.5);
    ball(bob, 0.07, pm(0xff3a3a, 0.4), 0, 0.02, 0, 1, 1, 1);
    ball(bob, 0.071, pm(0xffffff, 0.5), 0, 0.05, 0, 1, 0.5, 1);
    this.P.bob = bob; this.P.bobY = wy;
    if (this.opts.waterY == null && this.withProps) {
      const pond = new THREE.Mesh(geo('circ', () => new THREE.CircleGeometry(1, 16)), pm(0x4ab0e8, 0.45));
      pond.rotation.x = -PI / 2; pond.scale.set(0.8, 0.6, 1); pond.position.set(0, 0.015, 2.5); this.root.add(pond);
    }
    this.waveArm = 0;
  }
  _fish(T) {
    const u = this.ud;
    this._sitPose(T, 0.25);
    const c = (T * 0.7) % 5.5, bite = c > 4.4 ? Math.sin((c - 4.4) / 1.1 * PI) : 0;
    this.arm(1, 0.05, 1.05 + bite * 0.35); this.arm(0, -0.3, 1.15 + bite * 0.35);
    this.P.rod.rotation.x = 1.05 - 0.55 + bite * 0.3 + Math.sin(T * 1.7) * 0.03;
    u.head.rotation.x = 0.15 - bite * 0.2; u.body.rotation.x = -bite * 0.08;
    this.P.bob.position.y = this.P.bobY + Math.sin(T * 2.4) * 0.025 - (c > 3.9 && c < 4.6 ? 0.12 * Math.abs(Math.sin(T * 14)) : 0);
    this.root.updateMatrixWorld(true);
    this.P.tip.getWorldPosition(_v); this.root.worldToLocal(_v);
    _w.copy(this.P.bob.position).setY(this.P.bob.position.y + 0.07).sub(_v);
    const L = _w.length();
    this.P.line.position.copy(_v); this.P.line.scale.set(1, L, 1);
    this.P.line.quaternion.setFromUnitVectors(_up, _w.multiplyScalar(1 / Math.max(L, 1e-4)));
  }

  // ----- cook -----
  _set_cook() {
    this._hide(1);
    const lad = pivot(this.ud.hands[1], 0, 0, 0);
    limb(lad, V(0, 0.05, 0), V(0, -0.55, 0), 0.018, 0.018, pm(0xb0b8c8, 0.4), 5);
    ball(lad, 0.07, pm(0xb0b8c8, 0.4), 0, -0.58, 0.02, 1, 0.6, 1);
    const k = pivot(this.root, 0.12, 0, 0.74);
    for (let i = 0; i < 5; i++) { const a = i * 1.256; ball(k, 0.1, pm(0x9a9aa8, 0.3), Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3, 1, 0.7, 1); }
    this.P.flames = [];
    for (let i = 0; i < 3; i++) this.P.flames.push(cone(k, 0.09, 0.25, pm(i === 1 ? 0xffd23a : 0xff7a2a, 0.9), (i - 1) * 0.1, 0.14, 0, 0, 0, 0, 6));
    cyl(k, 0.3, 0.24, 0.32, pm(0x4a4a5a, 0.3), 0, 0.38, 0, 0, 0, 0, 12);
    torus(k, 0.3, 0.03, pm(0x6a6a7a, 0.3), 0, 0.54, 0, PI / 2, 0, 0, 4, 14);
    cyl(k, 0.28, 0.28, 0.02, pm(0xffa84a, 0.6), 0, 0.5, 0, 0, 0, 0, 12);
    this.P.steam = [0, 1, 2, 3].map(() => sprite(k, 'glow', 0.4, 0xffffff));
    this.P.kettle = k;
    this.waveArm = 0;
  }
  _cook(T) {
    const u = this.ud, w = T * 4;
    this.arm(1, -0.12 + Math.sin(w) * 0.2, 1.0 + Math.cos(w) * 0.18);
    this.arm(0, 0.7, -0.35, 0.8); // hand on hip
    u.body.rotation.x = 0.1; u.head.rotation.x = 0.2 + Math.sin(T * 1.3) * 0.05; u.head.rotation.z = Math.sin(T * 0.9) * 0.12;
    u.body.rotation.z = Math.sin(w) * 0.04;
    this.P.flames.forEach((f, i) => f.scale.set(1, 0.8 + 0.35 * Math.abs(Math.sin(T * 9 + i * 2)), 1));
    this._cycleFx(this.P.steam, T, 0.45, (s, f) => {
      s.position.set(Math.sin(f * 6 + T) * 0.12, 0.6 + f * 1.1, 0);
      s.material.opacity = Math.sin(f * PI) * 0.95; s.scale.setScalar(0.35 + f * 0.6);
    });
  }

  // ----- read -----
  _set_read() {
    this._seat(); this._hide(0);
    const b = pivot(this.ud.body, 0, 0.66, 0.42); b.rotation.x = 0.75;
    const cm = pm(this.opts.hue2 ?? 0xd04a5a, 0.35), pg = pm(0xfffaf0, 0.55);
    for (const s of [-1, 1]) {
      const p = pivot(b); p.rotation.y = -0.35 * s;
      box(p, 0.27, 0.34, 0.02, cm, 0.135 * s, 0, 0.012);
      box(p, 0.24, 0.31, 0.03, pg, 0.125 * s, 0, -0.012);
    }
    const page = pivot(b, 0, 0, -0.03);
    box(page, 0.23, 0.3, 0.006, pg, 0.115, 0, 0);
    this.P.page = page;
    this.waveArm = 1;
  }
  _read(T) {
    const u = this.ud;
    this._sitPose(T, 0.15);
    this.arm(0, -0.2, 1.2); this.arm(1, -0.2, 1.2);
    const c = (T * 0.8) % 3.2, f = smooth(2.3, 3.0, c);
    this.P.page.rotation.y = 0.35 + f * (PI - 0.7);
    if (c > 2.2) this.arm(1, -0.35, 1.3 + Math.sin(f * PI) * 0.2);
    u.head.rotation.x = 0.35 + Math.sin(T * 1.1) * 0.04; u.head.rotation.y = Math.sin(T * 0.8) * 0.12 - f * 0.1;
    u.head.rotation.z = Math.sin(T * 0.5) * 0.1;
  }

  // ----- music -----
  _set_music() {
    const r = this.r;
    this.P.inst = this.opts.instrument ?? (r() < 0.5 ? 'flute' : 'drum');
    const u = this.ud;
    this._hide(0);
    if (this.P.inst === 'flute') {
      const f = pivot(u.head, 0.03, u.cy - 0.2, zOn(u.R, 0, -0.2) + 0.02);
      f.rotation.set(0, 0, 0);
      const fm = pm(0xd8a84a, 0.4);
      limb(f, V(-0.05, 0, 0), V(0.5, -0.12, 0.2), 0.025, 0.025, fm, 6);
      for (let i = 1; i <= 3; i++) ball(f, 0.012, basic(0x3a2418), -0.05 + 0.55 * (i / 4.2), -0.12 * (i / 4.2) + 0.025, 0.2 * (i / 4.2));
    } else {
      this._hide(1);
      const d = pivot(u.body, 0, 0.42, 0.42);
      cyl(d, 0.22, 0.22, 0.22, pm(0xff4a5a, 0.35), 0, 0, 0, 0, 0, 0, 12);
      cyl(d, 0.225, 0.225, 0.015, pm(0xfff6e0, 0.5), 0, 0.11, 0, 0, 0, 0, 12);
      for (const y of [-0.1, 0.1]) torus(d, 0.225, 0.02, pm(0xffcf3a, 0.45), 0, y, 0, PI / 2, 0, 0, 4, 14);
      torus(u.body, 0.3, 0.015, pm(0xffffff, 0.5), 0, 0.68, 0.1, 0.9, 0, 0.7, 3, 16);
      for (const h of u.hands) { limb(h, V(0, 0, 0), V(0, -0.3, 0), 0.015, 0.015, pm(WOOD), 4); ball(h, 0.03, pm(0xffffff, 0.5), 0, -0.3, 0); }
    }
    this.P.notes = [0, 1, 2].map((_, i) => sprite(this.mover, 'note', 0.32, [0xffffff, 0xd8f0ff, 0xffe0f0][i]));
    this.waveArm = 1;
  }
  _music(T) {
    const u = this.ud;
    u.body.rotation.z = Math.sin(T * 2.2) * 0.1;
    this.model.position.y = Math.abs(Math.sin(T * 4.4)) * 0.05;
    u.legs[0].rotation.x = Math.max(0, Math.sin(T * 2.2)) * -0.3;
    if (this.P.inst === 'flute') {
      this.arm(1, -0.2, 1.75 + Math.sin(T * 9) * 0.05, 0.2); this.arm(0, -0.4, 1.6 + Math.sin(T * 7) * 0.05, -0.2);
      u.head.rotation.z = -0.15 + Math.sin(T * 2.2) * 0.12; u.head.rotation.x = -0.05;
    } else {
      const k = Math.sin(T * 8);
      this.arm(0, 0.05, 0.85 + Math.max(0, k) * 0.7); this.arm(1, 0.05, 0.85 + Math.max(0, -k) * 0.7);
      u.head.rotation.x = 0.1 + Math.abs(k) * 0.08; u.head.rotation.z = Math.sin(T * 2.2) * 0.12;
    }
    this._cycleFx(this.P.notes, T, 0.4, (s, f) => {
      s.position.set(0.3 + Math.sin(f * 7 + s.id) * 0.25, 1.4 + f * 1.4, 0.2);
      s.material.opacity = Math.sin(f * PI); s.scale.setScalar(0.22 + f * 0.15);
    });
  }

  // ----- dance -----
  _dance(T) {
    const u = this.ud, c = (T * 0.9) % 4;
    if (c < 2) {
      const k = smooth(0, 2, c);
      this.model.rotation.y = k * PI * 2;
      this.arm(0, 2.6 + Math.sin(T * 8) * 0.2, 0); this.arm(1, 2.6 + Math.sin(T * 8 + 1) * 0.2, 0);
      this.model.position.y = Math.abs(Math.sin(c * PI * 2)) * 0.2;
      u.legs[1].rotation.x = -0.3;
    } else {
      const h = Math.sin((c - 2) * PI * 2);
      this.model.position.y = Math.abs(h) * 0.3;
      this.model.position.x = Math.sin((c - 2) * PI) * 0.25;
      this.arm(0, 1.4 + h * 1.0, 0.4); this.arm(1, 1.4 - h * 1.0, 0.4);
      u.legs[0].rotation.z = -Math.max(0, h) * 0.5; u.legs[1].rotation.z = Math.max(0, -h) * 0.5;
      u.body.rotation.z = h * 0.15; u.head.rotation.z = -h * 0.2;
    }
  }

  // ----- chat -----
  _set_chat() {
    this.P.bubble = sprite(this.mover, this.r() < 0.7 ? 'bubble' : 'heart', 0.6);
    this.P.bubble.position.set(0.55, 2.35, 0);
  }
  _chat(T) {
    const u = this.ud, c = (T * 0.7) % 6, talking = c < 3.5;
    u.head.rotation.x = talking ? Math.sin(T * 7) * 0.08 : 0.05;
    u.head.rotation.z = Math.sin(T * 1.1) * 0.12;
    u.body.rotation.z = Math.sin(T * 0.9) * 0.05;
    if (talking) {
      this.arm(1, 0.35 + Math.sin(T * 3.1) * 0.35, 0.9 + Math.sin(T * 2.3) * 0.5, -0.4);
      this.arm(0, 0.3 + Math.max(0, Math.sin(T * 2.1 + 1)) * 0.6, 0.6 + Math.max(0, Math.sin(T * 2.1 + 1)) * 0.6);
    } else { // listening: hands on the tummy, nodding
      this.arm(0, -0.15, 0.7); this.arm(1, -0.15, 0.7);
      u.head.rotation.x = 0.12 + Math.max(0, Math.sin(T * 4)) * 0.15;
    }
    const b = this.P.bubble, k = smooth(0.2, 0.5, c) * (1 - smooth(2.9, 3.3, c));
    b.visible = k > 0.01; b.scale.setScalar(0.6 * k); b.position.y = 2.3 + Math.sin(T * 3) * 0.05;
  }

  // ----- wave -----
  _wave(T) {
    const u = this.ud, c = (T * 0.8) % 4, k = smooth(0, 0.3, c) * (1 - smooth(2.6, 3, c));
    this.arm(1, 0.12 + k * 2.5 + Math.sin(T * 10) * 0.4 * k, 0);
    this.arm(0, 0.7, -0.35, 0.8);
    u.head.rotation.z = 0.15 * k; u.head.rotation.x = -0.1;
    u.body.rotation.z = -0.05 * k;
    this.model.position.y = c > 3.2 ? Math.abs(Math.sin((c - 3.2) * PI * 2.5)) * 0.18 : 0;
    if (k < 0.3) this._lookAround(T, 0.5);
  }

  // ----- sit -----
  _set_sit() { this._seat(); }
  _sit(T) {
    const u = this.ud;
    this._sitPose(T, 0.4);
    this.arm(0, 0.35, 0.25); this.arm(1, 0.35, 0.25);
    u.body.rotation.z = Math.sin(T * 1.5) * 0.06;
    this._lookAround(T, 0.6);
    u.head.rotation.z = Math.sin(T * 1.5) * 0.15;
  }

  // ----- swing -----
  // opts.swing: { pivot: Vector3, length, mesh? }. With a mesh (the island's own swing),
  // the townie rides along with its world transform; otherwise it swings its own pendulum.
  _set_swing() {
    const sw0 = this.opts.swing;
    this.seatH = 0;
    if (sw0?.mesh) {
      const m = sw0.mesh;
      m.updateWorldMatrix(true, false);
      this.P.swMesh = m;
      this.P.swOff = m.worldToLocal(this.home.clone());
      this.P.swQ0 = m.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.P.swYaw = new THREE.Quaternion().setFromAxisAngle(_up, this.yaw);
      this.P.swQ = new THREE.Quaternion();
      return;
    }
    const top = (sw0 ? (sw0.length ?? (sw0.pivot ? sw0.pivot.y - this.home.y : 3)) : 3) / this.scale;
    const sw = pivot(this.root, 0, top, 0);
    const rope = pm(0xd8b878, 0.35);
    for (const s of [-1, 1]) cyl(sw, 0.02, 0.02, top, rope, 0.36 * s, -top / 2, 0, 0, 0, 0, 4);
    box(sw, 0.9, 0.06, 0.34, pm(WOOD), 0, -top, 0);
    this.mover.removeFromParent(); sw.add(this.mover); this.mover.position.y = -top + 0.03;
    if (this.withProps && !sw0) {
      cyl(this.root, 0.07, 0.07, 1.6, pm(WOOD_D), 0, top, 0, 0, 0, PI / 2, 8);
      ball(this.root, 0.25, pm(0x5fd860, 0.3), -0.8, top + 0.1, 0, 1, 0.7, 1);
      ball(this.root, 0.3, pm(0x4fc050, 0.3), 0.8, top + 0.1, 0, 1, 0.7, 1);
    }
    this.P.swing = sw;
  }
  _swing(T) {
    const u = this.ud;
    let a = Math.sin(T * 1.9);
    if (this.P.swMesh) {
      const m = this.P.swMesh, P = this.P;
      m.updateWorldMatrix(true, false);
      _v.copy(P.swOff); m.localToWorld(_v);
      if (this.root.parent) this.root.parent.worldToLocal(_v);
      this.pos.copy(_v);
      m.getWorldQuaternion(P.swQ).multiply(P.swQ0);
      // swing phase from the seat's pitch, so the legs pump in time with the island's swing
      _w.set(0, 0, 1).applyQuaternion(P.swQ); a = clamp(-_w.y * 2.2, -1, 1);
      this.root.quaternion.copy(P.swQ).multiply(P.swYaw);
    } else this.P.swing.rotation.x = a * 0.5;
    this.model.position.y = -u.seatDrop + 0.02;
    u.legs.forEach((l) => { l.rotation.x = -0.75 - a * 0.65; });
    this.arm(0, 0.18, 2.95); this.arm(1, 0.18, 2.95);
    u.body.rotation.x = a * 0.2;
    u.head.rotation.x = -a * 0.15;
  }

  // ----- sleep -----
  _set_sleep() {
    this.P.zz = [0, 1, 2].map(() => sprite(this.root, 'z', 0.35));
    this.mover.rotation.y = PI / 2; // lies across, head to the left, so passers-by see the sleepy face
    if (this.withProps) {
      ball(this.root, 0.3, pm(0xfff6ee, 0.5), -0.8, 0.1, -0.05, 0.9, 0.4, 1.4);
      this.P.blanket = ball(this.root, 0.5, pm(this.opts.hue2 ?? 0x8ab8ff, 0.4), 0.15, 0.3, 0, 1.3, 0.5, 0.95);
      for (let i = 0; i < 5; i++) ball(this.root, 0.07, pm(0xffffff, 0.5), -0.25 + i * 0.22, 0.52, 0.18 - (i % 2) * 0.2, 1, 0.4, 1);
    }
  }
  _sleep(T) {
    const u = this.ud, br = Math.sin(T * 1.4);
    this.model.rotation.x = -PI / 2;
    this.model.position.set(0, 0.36, 0.55);
    u.head.rotation.x = -0.1; u.head.rotation.y = -0.55 + br * 0.03;
    this.arm(0, 0.4, 0.4); this.arm(1, 0.4, 0.4);
    if (this.P.blanket) this.P.blanket.scale.set(0.65, 0.25 + br * 0.015, 0.475);
    this._cycleFx(this.P.zz, T, 0.35, (s, f) => {
      s.position.set(-0.75 + f * 0.5 + Math.sin(f * 8) * 0.1, 0.8 + f * 1.3, 0);
      s.material.opacity = Math.sin(f * PI); s.scale.setScalar(0.2 + f * 0.35);
    });
  }

  // ----- walking along a path -----
  _setPath() {
    let pts = this.opts.path;
    if (!pts || pts.length < 2) {
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      pts = [this.home.clone().add(V(-2.5 * c, 0, 2.5 * s)), this.home.clone().add(V(2.5 * c, 0, -2.5 * s))];
    }
    this.path = pts.map((p) => p.clone());
    this.cum = [0];
    for (let i = 1; i < this.path.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].z - this.path[i - 1].z));
    this.L = Math.max(0.01, this.cum[this.cum.length - 1]);
    this.s = this.r() * this.L; this.dir = this.r() < 0.5 ? 1 : -1; this.pause = 0; this.walkW = 1; this.st = 0;
    this.speed = 0.85 * this.scale;
    this._place(0, true);
  }
  _place(dt, snap = false) {
    const s = this.s, p = this.path;
    let i = 0;
    while (i < p.length - 2 && this.cum[i + 1] < s) i++;
    const seg = Math.max(1e-4, this.cum[i + 1] - this.cum[i]), u = clamp((s - this.cum[i]) / seg, 0, 1);
    const a = p[i], b = p[i + 1];
    const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u, y = a.y + (b.y - a.y) * u;
    this.pos.set(x, this.floor ? this.floor(x, z, y) : y, z);
    const want = Math.atan2((b.x - a.x) * this.dir, (b.z - a.z) * this.dir);
    this.root.rotation.y += wrap(want - this.root.rotation.y) * (snap ? 1 : Math.min(1, 5 * dt));
  }
  _walkStep(T, dt) {
    let moving = 1;
    if (this.pause > 0) { this.pause -= dt; moving = 0; if (this.pause <= 0) this.dir = -this.dir; }
    else {
      this.s += this.dir * this.speed * dt;
      if (this.s >= this.L || this.s <= 0) { this.s = clamp(this.s, 0, this.L); this.pause = 1.8 + this.r() * 1.5; }
    }
    this.walkW += (moving - this.walkW) * Math.min(1, 4 * dt);
    if (dt > 0) this._place(dt);
    this.st += dt * 7.5 * this.walkW;
    this._steps(this.st, this.walkW, 0.6);
    if (this.walkW < 0.5) this._lookAround(T, 0.9);
    return this.walkW;
  }
  _set_walk() { this._setPath(); }
  _walk(T, dt) {
    const w = this._walkStep(T, dt), k = Math.sin(this.st);
    this.arm(0, 0.15, k * 0.6 * w); this.arm(1, 0.15, -k * 0.6 * w);
  }
  _set_carry() {
    this._setPath(); this._hide(0); this._hide(1);
    const c = pivot(this.ud.body, 0, 0.66, 0.46);
    const pirate = /pirate|monkey|mole/.test(this.type);
    if (pirate) {
      crate(c, 0.42, 0, -0.21, 0);
    } else {
      const bm = pm(0xd8a860, 0.35);
      cyl(c, 0.26, 0.2, 0.26, bm, 0, -0.05, 0, 0, 0, 0, 12);
      torus(c, 0.26, 0.03, pm(0xb08040, 0.35), 0, 0.08, 0, PI / 2, 0, 0, 4, 14);
      const fc = [0xff3a3a, 0xffa030, 0xffe04a, 0x7ad84a, 0xff6ab4];
      for (let i = 0; i < 6; i++) { const a = i * 1.05; ball(c, 0.09, pm(fc[i % 5], 0.4), Math.cos(a) * 0.14, 0.1 + (i % 2) * 0.04, Math.sin(a) * 0.14); }
    }
    this.P.load = c;
  }
  _carry(T, dt) {
    this._walkStep(T, dt);
    this.arm(0, -0.25, 1.35); this.arm(1, -0.25, 1.35);
    this.P.load.position.y = 0.66 + Math.abs(Math.cos(this.st)) * 0.02;
    this.ud.body.rotation.x = -0.06;
  }

  // ----- paint -----
  _set_paint() {
    this._hide(0); this._hide(1);
    const u = this.ud;
    const br = pivot(u.hands[1]);
    limb(br, V(0, 0.04, 0), V(0, -0.3, 0), 0.015, 0.012, pm(WOOD), 4);
    this.P.tipM = ball(br, 0.03, pm(0xff4a8a, 0.45), 0, -0.32, 0, 1, 1.6, 1);
    const pal = pivot(u.hands[0], 0, -0.06, 0.1); pal.rotation.x = 1.1;
    ball(pal, 0.2, pm(0xe8c890, 0.4), 0, 0, 0, 1, 0.12, 0.8);
    [0xff3a3a, 0x3a8aff, 0xffe04a, 0x5fd860].forEach((c, i) => ball(pal, 0.035, pm(c, 0.45), -0.1 + i * 0.065, 0.025, 0.05 * Math.sin(i * 2)));
    if (this.withProps) {
      const e = pivot(this.root, 0.62, 0, 0.62); e.rotation.y = PI + 0.75;
      const w = pm(WOOD);
      limb(e, V(-0.35, 0, -0.15), V(0, 1.55, 0.02), 0.025, 0.02, w, 5);
      limb(e, V(0.35, 0, -0.15), V(0, 1.55, 0.02), 0.025, 0.02, w, 5);
      limb(e, V(0, 0, 0.35), V(0, 1.45, 0.02), 0.025, 0.02, w, 5);
      box(e, 0.8, 0.04, 0.08, w, 0, 0.62, -0.08);
      const art = canvasTexture(64, 64, (g) => {
        g.fillStyle = '#bfe8ff'; g.fillRect(0, 0, 64, 64);
        g.fillStyle = '#4ab0e8'; g.fillRect(0, 40, 64, 24);
        ['#ff4a4a', '#ffa030', '#ffe04a', '#5fd860', '#4a8aff', '#a06aff'].forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.arc(32, 44, 26 - i * 3, PI, 0); g.stroke(); });
        g.fillStyle = '#ffe24a'; g.beginPath(); g.arc(52, 12, 7, 0, PI * 2); g.fill();
      });
      const front = paintMat({ color: 0xffffff, map: art, emissive: 0x404040 });
      const cv = box(e, 0.7, 0.56, 0.03, pm(0xfffaf0, 0.5), 0, 0.95, -0.12, -0.12, 0, 0);
      const pic = new THREE.Mesh(geo('plane', () => new THREE.PlaneGeometry(1, 1)), front);
      pic.scale.set(0.64, 0.5, 1); pic.position.set(0, 0, -0.017); pic.rotation.y = PI; cv.add(pic);
      const pic2 = pic.clone(); pic2.position.z = 0.017; pic2.rotation.y = 0; cv.add(pic2);
    }
    this.waveArm = 1;
  }
  _paint(T) {
    const u = this.ud, c = (T * 0.8) % 6;
    if (c < 4.6) {
      this.arm(1, 0.25 + Math.sin(T * 3) * 0.2, 1.45 + Math.sin(T * 6.5) * 0.2, 0);
      u.head.rotation.x = Math.sin(T * 1.2) * 0.05; u.head.rotation.y = 0.6; u.body.rotation.y = 0.35;
      u.body.rotation.x = 0.06;
    } else { // step back and admire
      const k = Math.sin((c - 4.6) / 1.4 * PI);
      this.arm(1, 0.3, 0.6 + k * 0.4);
      u.body.rotation.x = -0.12 * k; u.head.rotation.z = 0.25 * k; this.model.position.z = -0.15 * k;
    }
    this.arm(0, 0.15, 1.1);
  }

  // ----- build -----
  _set_build() {
    this._hide(1);
    const hm = pivot(this.ud.hands[1]);
    limb(hm, V(0, 0.03, 0), V(0, -0.32, 0), 0.022, 0.022, pm(WOOD), 5);
    box(hm, 0.08, 0.08, 0.2, pm(0x8a8aa0, 0.35), 0, -0.32, -0.03);
    if (this.withProps) {
      const b = pivot(this.root, 0, 0, 0.62);
      for (const s of [-1, 1]) { limb(b, V(0.38 * s, 0, -0.12), V(0.38 * s, 0.42, 0), 0.03, 0.03, pm(WOOD_D), 5); limb(b, V(0.38 * s, 0, 0.12), V(0.38 * s, 0.42, 0), 0.03, 0.03, pm(WOOD_D), 5); }
      this.P.plank = box(b, 1.0, 0.07, 0.3, pm(0xe0b070, 0.4), 0, 0.46, 0);
    }
    this.P.spark = sprite(this.mover, 'star', 0.35);
    this.P.spark.position.set(0.1, 0.62, 0.62);
    this.waveArm = 0;
  }
  _build(T) {
    const u = this.ud, c = frac(T * 1.3);
    const up = c < 0.6 ? smooth(0, 0.6, c) : 1 - smooth(0.6, 0.72, c);
    this.arm(1, 0.1, 0.85 + up * 1.6);
    this.arm(0, -0.1, 1.1);
    u.body.rotation.x = 0.12 + (1 - up) * 0.05; u.head.rotation.x = 0.3;
    const hit = c > 0.72 ? 1 - smooth(0.72, 0.95, c) : 0;
    if (this.P.plank) this.P.plank.position.y = 0.46 + hit * 0.03;
    this.P.spark.visible = hit > 0.05; this.P.spark.material.opacity = hit; this.P.spark.scale.setScalar(0.2 + (1 - hit) * 0.3);
    this.model.position.y = hit * 0.03;
  }

  // ----- dig -----
  _set_dig() {
    this._hide(0); this._hide(1);
    const sh = pivot(this.ud.hands[1]);
    limb(sh, V(0, 0.15, 0), V(0, -0.62, 0), 0.022, 0.022, pm(WOOD), 5);
    box(sh, 0.16, 0.2, 0.02, pm(0x9a9ab0, 0.4), 0, -0.7, 0.02, 0.25, 0, 0);
    this.P.shovel = sh;
    if (this.withProps) ball(this.root, 0.45, pm(0x9a6a40, 0.3), 0.5, 0, -0.2, 1.1, 0.45, 0.9);
    this.P.clod = ball(this.mover, 0.08, pm(0x8a5a34, 0.3), 0, 0, 0);
    this.waveArm = 0;
  }
  _dig(T) {
    const u = this.ud, c = (T * 0.75) % 2.4;
    let fwd, lean;
    if (c < 0.9) { const k = smooth(0, 0.9, c); fwd = 0.9 - k * 0.35; lean = 0.15 + k * 0.25; u.legs[1].rotation.x = -0.3 * Math.sin(k * PI); }
    else if (c < 1.5) { const k = smooth(0.9, 1.5, c); fwd = 0.55 + k * 1.0; lean = 0.4 - k * 0.5; }
    else { const k = smooth(1.5, 2.4, c); fwd = 1.55 - k * 0.65; lean = -0.1 + k * 0.25; }
    this.arm(1, 0.05, fwd); this.arm(0, -0.25, fwd + 0.25);
    this.P.shovel.rotation.x = 0.1;
    u.body.rotation.x = lean * 0.6; u.head.rotation.x = 0.15;
    const cl = this.P.clod;
    cl.visible = c > 1.4 && c < 2.3;
    if (cl.visible) { const f = (c - 1.4) / 0.9; cl.position.set(0.3 + f * 0.25, 1.2 + f * 0.5 - f * f * 1.6, 0.4 - f * 0.9); }
  }

  // ----- play -----
  _set_play() {
    const b = pivot(this.mover);
    const cs = [0xff4a4a, 0xffffff, 0x3a8aff, 0xffe04a];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(geo('ballq' + i, () => new THREE.SphereGeometry(0.2, 8, 7, (i / 4) * PI * 2, PI / 2)), pm(cs[i], 0.4));
      b.add(s);
    }
    this.P.ball = b;
    this._hide(0);
  }
  _play(T) {
    const u = this.ud, c = frac(T * 0.6);
    const air = c < 0.75 ? c / 0.75 : 0;
    const by = 1.25 + Math.sin(air * PI) * 1.4;
    this.P.ball.position.set(0, by, 0.55);
    this.P.ball.rotation.x = T * 4; this.P.ball.rotation.z = T * 2;
    const catchK = c >= 0.75 ? Math.sin((c - 0.75) / 0.25 * PI) : 0;
    this.arm(0, 0.15, 2.1 + catchK * 0.3); this.arm(1, 0.15, 2.1 + catchK * 0.3);
    u.head.rotation.x = -0.25 - Math.sin(air * PI) * 0.35;
    this.model.position.y = catchK * 0.12;
  }

  // ----- lookout -----
  _set_lookout() {
    this._hide(1);
    const u = this.ud;
    const g = pivot(u.head, 0.17, u.cy - 0.02, zOn(u.R, 0.17, -0.02) - 0.02);
    cyl(g, 0.06, 0.05, 0.2, pm(0xffcf3a, 0.45), 0, 0, 0.12, PI / 2, 0, 0, 8);
    cyl(g, 0.07, 0.065, 0.22, pm(0xa86a3a, 0.35), 0, 0, 0.32, PI / 2, 0, 0, 8);
    cyl(g, 0.08, 0.08, 0.04, pm(0xffcf3a, 0.45), 0, 0, 0.44, PI / 2, 0, 0, 8);
    this.P.glass = g;
    this.waveArm = 0;
  }
  _lookout(T) {
    const u = this.ud;
    this.model.rotation.y = Math.sin(T * 0.35) * 0.9;
    this.arm(1, -0.35, 1.95); this.arm(0, 0.7, -0.35, 0.8);
    u.head.rotation.x = -0.1 + Math.sin(T * 0.7) * 0.05;
    u.body.rotation.z = Math.sin(T * 0.35 + 1) * 0.04;
    this._steps(T * 2, Math.abs(Math.cos(T * 0.35)) * 0.4, 0.3);
  }

  // ----- scrub -----
  _set_scrub() {
    this._hide(1);
    const br = pivot(this.ud.hands[1]);
    box(br, 0.28, 0.07, 0.16, pm(WOOD), 0, -0.06, 0.04);
    box(br, 0.27, 0.05, 0.15, pm(0xffe08a, 0.4), 0, -0.12, 0.04);
    if (this.withProps) {
      const b = pivot(this.root, 0.62, 0, 0.3);
      cyl(b, 0.16, 0.13, 0.28, pm(0x9a9ab0, 0.35), 0, 0.14, 0, 0, 0, 0, 10);
      cyl(b, 0.15, 0.15, 0.01, pm(0x8ad0ff, 0.6), 0, 0.27, 0, 0, 0, 0, 10);
      torus(b, 0.15, 0.012, pm(0x6a6a7a, 0.3), 0, 0.3, 0, 0, 0, 0, 3, 10, PI);
    }
    this.P.suds = [0, 1, 2, 3].map(() => sprite(this.mover, 'glow', 0.18, 0xe8f6ff));
    this.waveArm = 0;
  }
  _scrub(T) {
    const u = this.ud, k = Math.sin(T * 7);
    this.model.position.y = -0.28;
    u.legs.forEach((l) => { l.rotation.x = 1.4; });
    u.body.rotation.x = 0.45;
    this.arm(1, 0.1 + Math.cos(T * 3.5) * 0.25, 1.0 + k * 0.45); this.arm(0, 0.2, 0.8);
    u.head.rotation.x = -0.15; u.head.rotation.z = Math.sin(T * 1.2) * 0.12;
    u.body.rotation.z = k * 0.04;
    this._cycleFx(this.P.suds, T, 0.6, (s, f) => {
      s.position.set(0.05 + Math.sin(f * 9) * 0.25, 0.05 + f * 0.6, 0.7 + Math.cos(f * 7) * 0.12);
      s.material.opacity = Math.sin(f * PI) * 0.8; s.scale.setScalar(0.1 + f * 0.12);
    });
  }

  // ----- juggle -----
  _set_juggle() {
    this._hide(0); this._hide(1);
    const cs = [0xff4a4a, 0xffe04a, 0x3a8aff];
    this.P.balls = cs.map((c) => ball(this.ud.body, 0.11, pm(c, 0.45), 0, 0, 0));
  }
  _juggle(T) {
    const u = this.ud, R = T * 1.5;
    for (let i = 0; i < 3; i++) {
      const q = R + i / 3, n = Math.floor(q), f = q - n, d = n % 2 ? 1 : -1;
      this.P.balls[i].position.set(d * (-0.42 + 0.84 * f), 0.62 + Math.sin(f * PI) * 1.75, 0.55);
    }
    this.arm(0, 0.0 + Math.sin(R * PI * 2) * 0.12, 1.15 + Math.cos(R * PI * 2) * 0.15);
    this.arm(1, 0.0 - Math.sin(R * PI * 2) * 0.12, 1.15 - Math.cos(R * PI * 2) * 0.15);
    u.head.rotation.x = -0.35 + Math.sin(R * PI * 2) * 0.06;
    u.head.rotation.y = Math.sin(R * PI) * 0.15;
    this.model.position.y = Math.abs(Math.sin(R * PI * 2)) * 0.02;
  }

  // ----- the frame -----
  update(dt, t, playerPos) {
    dt = Math.min(dt || 0, 0.1);
    this.time += dt * this.rate;
    const T = this.time + this.ph, u = this.ud;
    this._rest();
    this.act(T, dt);
    const grounded = SITTERS.has(this.activity) || this.activity === 'swing' || this.activity === 'sleep' || this.activity === 'scrub';
    if (u.hover && !grounded) this.model.position.y += u.hover + Math.sin(T * 2.2) * 0.06;
    if (u.wings) u.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.35 + Math.sin(T * 22) * 0.35); });
    if (u.ears) u.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (0.18 + Math.max(0, Math.sin(T * 1.3 + i)) * 0.15); });
    if (u.tail) u.tail.rotation.y = Math.sin(T * 2) * 0.3;

    // the mermaid swims by: look at her, wave, cheer when she's close
    const sleeper = this.activity === 'sleep';
    if (playerPos && !sleeper) {
      const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z, dy = playerPos.y - this.pos.y;
      const d2 = dx * dx + dz * dz + dy * dy * 0.25;
      if (d2 < 64 && !this.greeted) { this.greeted = true; this.greet = 2.4; }
      else if (d2 > 110) this.greeted = false;
      if (d2 < 16 && !this.cheered) { this.cheered = true; this.cheer(); }
      else if (d2 > 36) this.cheered = false;
      if (this.greet > 0) {
        this.greet -= dt;
        const k = smooth(0, 0.35, 2.4 - this.greet) * smooth(0, 0.4, this.greet);
        const ang = clamp(wrap(Math.atan2(dx, dz) - this.root.rotation.y - this.model.rotation.y - this.mover.rotation.y), -1.3, 1.3);
        u.head.rotation.y += (ang - u.head.rotation.y) * k;
        u.head.rotation.x *= 1 - k * 0.7;
        const s = this.waveArm ? 1 : -1, arm = u.arms[this.waveArm];
        arm.rotation.z += (s * (2.5 + Math.sin(T * 11) * 0.4) - arm.rotation.z) * k;
        arm.rotation.x *= 1 - k;
      }
    }
    if (this.happy > 0) {
      this.happy -= dt;
      const h = Math.max(0, this.happy), k = Math.min(1, h * 4, (1.5 - h) * 6);
      if (sleeper) { if (this.P.blanket) this.P.blanket.position.y = 0.3 + Math.abs(Math.sin(h * 10)) * 0.08 * k; }
      else {
        this.model.position.y += Math.abs(Math.sin(h * 8)) * 0.35 * k;
        u.arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.z += (s * (2.6 + Math.sin(h * 30) * 0.3) - a.rotation.z) * k; a.rotation.x *= 1 - k; });
        u.head.rotation.x += (-0.2 - u.head.rotation.x) * k;
      }
    }
  }
}
