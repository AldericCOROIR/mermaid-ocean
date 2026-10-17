// Sea folk of Shipwreck Bay: crabs in costume, a lobster chef, a wise snail,
// a hermit crab, a seal, an oyster fortune teller, anglerfish and leafy sea dragons.
import * as THREE from 'three';
import { segment, paintMat } from './geom.js';
import { glowTexture } from './util.js';
import { crabModel } from './creatures.js';

function eyeball(r = 0.08) {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1b1640 }));
  p.position.z = r * 0.5;
  const h = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  h.position.set(-r * 0.2, r * 0.25, r * 0.95);
  g.add(w, p, h);
  return g;
}
const pm = (color, k = 0.25, extra = {}) => paintMat({ color, emissive: new THREE.Color(color).multiplyScalar(k), ...extra });
const smile = (r = 0.08) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.25, 4, 10, Math.PI), new THREE.MeshBasicMaterial({ color: 0x6a1828 }));
  m.rotation.z = Math.PI;
  return m;
};

// ---------- costumes ----------
export function pirateHat(scale = 1) {
  const g = new THREE.Group();
  const black = pm(0x2a2238, 0.3);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 18), black);
  brim.scale.set(1.25, 1, 0.75); g.add(brim);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), black);
  crown.scale.set(1.15, 0.9, 0.8); g.add(crown);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), pm(0xfff6e0, 0.5));
  skull.position.set(0, 0.18, 0.27); g.add(skull);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 5, 18), pm(0xffc94d, 0.4));
  band.rotation.x = Math.PI / 2; band.position.y = 0.05; band.scale.set(1.15, 0.8, 1); g.add(band);
  g.scale.setScalar(scale);
  return g;
}
export function chefHat(scale = 1) {
  const g = new THREE.Group();
  const white = pm(0xffffff, 0.45);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.22, 14), white); g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), white);
    puff.position.set(Math.cos(a) * 0.16, 0.3, Math.sin(a) * 0.16); g.add(puff);
  }
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), white); top.position.y = 0.42; g.add(top);
  g.scale.setScalar(scale);
  return g;
}
function knightHelmet() {
  const g = new THREE.Group();
  const steel = pm(0xc8d4e8, 0.35);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel); g.add(dome);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 6), pm(0xff5a8a, 0.4));
  plume.position.set(0, 0.45, -0.05); plume.rotation.x = -0.4; g.add(plume);
  return g;
}
function glasses() {
  const g = new THREE.Group();
  const gold = new THREE.MeshBasicMaterial({ color: 0xd9a63a });
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 5, 14), gold); r.position.x = 0.13 * s; g.add(r); }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 4), gold); bridge.rotation.z = Math.PI / 2; g.add(bridge);
  return g;
}

// ---------- characters ----------
// A crab in costume: 'pirate' (eye patch & hat) or 'knight' (helmet & tiny sword).
export function costumeCrab(color, kind) {
  const g = crabModel(color);
  const body = g.userData.body;
  if (kind === 'pirate') {
    const hat = pirateHat(0.9); hat.position.set(0, 1.2, 0.2); body.add(hat);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), new THREE.MeshBasicMaterial({ color: 0x1a1420 }));
    patch.position.set(-0.18, 1.02, 0.49); body.add(patch);
  } else {
    const helm = knightHelmet(); helm.position.set(0, 0.72, 0.05); body.add(helm);
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.02), pm(0xe8eef8, 0.5));
    sword.position.set(1.05, 0.95, 0.85); sword.rotation.z = -0.3; body.add(sword);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.05), pm(0xffc94d, 0.4));
    hilt.position.set(0.95, 0.62, 0.85); hilt.rotation.z = -0.3; body.add(hilt);
  }
  return g;
}

export function lobsterModel(color = 0xff5a3c, chef = false) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const m = pm(color);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), m);
  head.scale.set(0.9, 0.8, 1.2); head.position.set(0, 0.5, 0.4); body.add(head);
  const tail = [];
  let parent = body;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group(); seg.position.set(0, i ? 0 : 0.45, i ? -0.32 : -0.1);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.32 - i * 0.04, 10, 8), m);
    s.scale.set(1.1, 0.75, 0.8); s.position.z = -0.15; seg.add(s);
    parent.add(seg); parent = seg; tail.push(seg);
  }
  const fan = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), m);
  fan.scale.set(1.4, 0.2, 0.8); fan.position.z = -0.35; parent.add(fan);
  const claws = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.35 * s, 0.5, 0.65);
    arm.add(new THREE.Mesh(segment(new THREE.Vector3(), new THREE.Vector3(0.35 * s, 0.15, 0.35), 0.07, 0.06, 5), m));
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), m);
    claw.scale.set(0.8, 0.55, 1.5); claw.position.set(0.42 * s, 0.2, 0.7); arm.add(claw);
    body.add(arm); claws.push(arm);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(segment(new THREE.Vector3(0.3 * s, 0.35, 0.3 - i * 0.2), new THREE.Vector3(0.65 * s, 0, 0.3 - i * 0.2), 0.04, 0.025, 4), m);
      body.add(leg);
    }
    const ant = new THREE.Mesh(segment(new THREE.Vector3(0.1 * s, 0.7, 0.85), new THREE.Vector3(0.6 * s, 1.5, 1.2), 0.02, 0.01, 4), m);
    body.add(ant);
    const e = eyeball(0.1); e.position.set(0.17 * s, 0.85, 0.75); body.add(e);
  }
  const mouth = smile(0.07); mouth.position.set(0, 0.45, 0.92); body.add(mouth);
  if (chef) { const hat = chefHat(1); hat.position.set(0, 0.95, 0.4); body.add(hat); }
  g.userData = { body, tail, claws };
  return g;
}

export function snailModel(shell = 0xd9a3ff, specs = false) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const skin = pm(0xffe0a8, 0.35);
  const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 4, 10), skin);
  foot.rotation.x = Math.PI / 2; foot.scale.set(1, 1, 0.5); foot.position.y = 0.15; body.add(foot);
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5, 4, 10), skin);
  neck.position.set(0, 0.55, 0.7); neck.rotation.x = 0.3; body.add(neck);
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(segment(new THREE.Vector3(0.1 * s, 0.95, 0.85), new THREE.Vector3(0.25 * s, 1.4, 0.95), 0.04, 0.03, 4), skin); body.add(st);
    const e = eyeball(0.09); e.position.set(0.25 * s, 1.45, 0.97); body.add(e);
  }
  const mouth = smile(0.07); mouth.position.set(0, 0.62, 0.98); body.add(mouth);
  // spiral shell built from shrinking tori
  const sm = pm(shell, 0.28);
  const sm2 = pm(new THREE.Color(shell).lerp(new THREE.Color(0xffffff), 0.45).getHex(), 0.3);
  const coil = new THREE.Group(); coil.position.set(0, 0.85, -0.15); coil.rotation.y = Math.PI / 2; body.add(coil);
  for (let i = 0; i < 4; i++) {
    const r = 0.55 * Math.pow(0.68, i);
    const tor = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.55, 10, 18), i % 2 ? sm2 : sm);
    tor.position.set(0, i * 0.08, i * 0.12); coil.add(tor);
  }
  if (specs) { const gl = glasses(); gl.position.set(0, 1.45, 1.06); body.add(gl); }
  g.userData = { body };
  return g;
}

export function hermitCrabModel(shell = 0xffb3d1) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const m = pm(0xff8a5c);
  const coil = new THREE.Group(); coil.position.set(0, 0.75, -0.2); body.add(coil);
  const sm = pm(shell, 0.3), sm2 = pm(0xfff4e8, 0.35);
  for (let i = 0; i < 5; i++) {
    const r = 0.6 * Math.pow(0.72, i);
    const ring = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), i % 2 ? sm2 : sm);
    ring.position.set(0, i * 0.22, -i * 0.12); coil.add(ring);
  }
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), m);
  face.position.set(0, 0.45, 0.35); face.scale.set(1.1, 0.8, 0.9); body.add(face);
  const legs = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const leg = new THREE.Group(); leg.position.set(0.25 * s, 0.35, 0.3 - i * 0.25);
      leg.add(new THREE.Mesh(segment(new THREE.Vector3(), new THREE.Vector3(0.35 * s, -0.35, 0.05), 0.05, 0.03, 4), m));
      body.add(leg); legs.push(leg);
    }
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m);
    claw.scale.set(1, 0.7, 1.3); claw.position.set(0.3 * s, 0.35, 0.6); body.add(claw);
    const e = eyeball(0.08); e.position.set(0.12 * s, 0.78, 0.48); body.add(e);
  }
  const mouth = smile(0.05); mouth.position.set(0, 0.4, 0.62); body.add(mouth);
  g.userData = { body, legs };
  return g;
}

export function sealModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const geo = new THREE.SphereGeometry(1, 18, 12);
  const p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const taper = z < 0 ? 1 - Math.pow(-z, 1.3) * 0.75 : 1;
    p.setXYZ(i, x * 0.6 * taper, y * 0.55 * taper, z * 1.4);
    const c = new THREE.Color(0x9aa8bc).lerp(new THREE.Color(0xe8eef6), THREE.MathUtils.smoothstep(-y, 0, 0.6));
    if (y > 0.2 && Math.sin(x * 15) * Math.sin(z * 11) > 0.75) c.lerp(new THREE.Color(0x6f7c94), 0.5);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  body.add(new THREE.Mesh(geo, paintMat({ vertexColors: true, emissive: 0x1a2030 })));
  const fur = pm(0xb4c0d2, 0.3);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), fur);
  head.position.set(0, 0.25, 1.35); body.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), pm(0xe8eef6, 0.4));
  snout.scale.set(1.3, 0.8, 1); snout.position.set(0, 0.12, 1.78); body.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2a2030 }));
  nose.position.set(0, 0.2, 1.97); body.add(nose);
  const flippers = [];
  for (const s of [-1, 1]) {
    const e = eyeball(0.12); e.position.set(0.2 * s, 0.4, 1.75); body.add(e);
    const f = new THREE.Group(); f.position.set(0.5 * s, -0.25, 0.6);
    const fm = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), fur); fm.scale.set(1.4, 0.2, 0.6); fm.position.x = 0.3 * s; f.add(fm);
    body.add(f); flippers.push(f);
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(segment(new THREE.Vector3(0.12 * s, 0.1, 1.95), new THREE.Vector3(0.45 * s, 0.12 + (i - 1) * 0.06, 2.0), 0.01, 0.005, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      body.add(w);
    }
  }
  const tail = new THREE.Group(); tail.position.z = -1.35; body.add(tail);
  const tm = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), fur); tm.scale.set(1.6, 0.18, 0.7); tm.position.z = -0.2; tail.add(tm);
  g.userData = { body, tail, flippers };
  return g;
}

export function oysterModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const m = pm(0xd8c8f0, 0.3, { side: THREE.DoubleSide });
  const shellGeo = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = shellGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.07 * Math.cos(a * 11); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  shellGeo.computeVertexNormals();
  const bottom = new THREE.Mesh(shellGeo, m); bottom.scale.set(1, 0.35, 1); bottom.rotation.x = Math.PI; bottom.position.y = 0.35; body.add(bottom);
  const lid = new THREE.Group(); lid.position.set(0, 0.35, -1); body.add(lid);
  const top = new THREE.Mesh(shellGeo, m); top.scale.set(1, 0.35, 1); top.position.z = 1; lid.add(top);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), pm(0xfff6ff, 0.6));
  pearl.position.set(0, 0.6, 0.1); body.add(pearl);
  for (const s of [-1, 1]) { const e = eyeball(0.1); e.position.set(0.14 * s, 0.68, 0.4); pearl.parent.add(e); }
  const mouth = smile(0.06); mouth.position.set(0, 0.5, 0.44); body.add(mouth);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xf0d8ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(2.5); glow.position.set(0, 0.6, 0.1); body.add(glow);
  g.userData = { body, lid };
  return g;
}

export function anglerfishModel(color = 0x6a4fb8) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const m = pm(color, 0.3);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), m);
  b.scale.set(0.9, 0.85, 1); body.add(b);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m);
  jaw.position.set(0, -0.12, 0.35); jaw.scale.set(1, 0.6, 0.9); body.add(jaw);
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    tooth.position.set(-0.25 + i * 0.1, -0.08, 0.72); body.add(tooth);
  }
  for (const s of [-1, 1]) {
    const e = eyeball(0.14); e.position.set(0.3 * s, 0.25, 0.5); e.rotation.y = 0.4 * s; body.add(e);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), m); fin.scale.set(1.2, 0.15, 0.6); fin.position.set(0.65 * s, -0.1, 0); body.add(fin);
  }
  const rod = new THREE.Mesh(segment(new THREE.Vector3(0, 0.55, 0.3), new THREE.Vector3(0, 1.15, 0.9), 0.03, 0.02, 4), m); body.add(rod);
  const lure = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6a0 }));
  lure.position.set(0, 1.15, 0.95); body.add(lure);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0a0, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(2.2); glow.position.copy(lure.position); body.add(glow);
  const tail = new THREE.Group(); tail.position.z = -0.65; body.add(tail);
  const tf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 4), m); tf.scale.set(0.2, 1, 1); tf.rotation.x = Math.PI / 2; tf.position.z = -0.2; tail.add(tf);
  g.userData = { body, tail, glow };
  return g;
}

export function seaDragonModel(color = 0xffb35c) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const m = pm(color, 0.3);
  const leaf = pm(0x8fe07a, 0.3, { side: THREE.DoubleSide });
  const segs = [];
  let prev = new THREE.Vector3(0, 0.6, 0.6);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const p = new THREE.Vector3(0, 0.6 - t * 0.9 + Math.sin(t * 5) * 0.15, 0.6 - t * 2.2);
    body.add(new THREE.Mesh(segment(prev, p, 0.16 * (1 - t * 0.7), 0.15 * (1 - t * 0.75), 6), m));
    if (i % 2 === 0) {
      for (const s of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.22, 6), leaf);
        l.scale.set(0.5, 1.4, 1); l.position.copy(p).add(new THREE.Vector3(0.15 * s, 0.25, 0));
        l.rotation.set(0.3, s * 0.6, s * 0.7); body.add(l); segs.push(l);
      }
    }
    prev = p;
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), m);
  head.position.set(0, 0.75, 0.8); head.scale.set(0.9, 1, 1.2); body.add(head);
  const snout = new THREE.Mesh(segment(new THREE.Vector3(0, 0.78, 0.95), new THREE.Vector3(0, 0.74, 1.45), 0.06, 0.04, 6), m); body.add(snout);
  for (const s of [-1, 1]) { const e = eyeball(0.08); e.position.set(0.14 * s, 0.85, 0.88); e.rotation.y = 0.6 * s; body.add(e); }
  g.userData = { body, leaves: segs };
  return g;
}
