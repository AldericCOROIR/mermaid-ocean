// Procedural chibi mermaid / merman built from soft primitives.
// The model is authored upright (head +Y, face +Z). `swim` (0..1) blends it
// to a horizontal swimming pose; the tail is a chain of segments with a
// travelling wave.
import * as THREE from 'three';
import { canvasTexture } from './util.js';
import { paintMat } from './geom.js';
import { pirateHat } from './seafolk.js';

const scaleTexCache = new Map();
function scaleTexture(c1, c2) {
  const key = c1 + c2;
  if (scaleTexCache.has(key)) return scaleTexCache.get(key);
  const t = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, h);
    const r = 14;
    for (let y = -1; y < 10; y++) {
      for (let x = -1; x < 6; x++) {
        const cx = x * r * 2 + (y % 2 ? r : 0), cy = y * r * 1.2;
        const grd = g.createRadialGradient(cx, cy + r * 0.4, 2, cx, cy, r * 1.1);
        grd.addColorStop(0, c2); grd.addColorStop(0.8, c1); grd.addColorStop(1, 'rgba(255,255,255,0.85)');
        g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI); g.fill();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  scaleTexCache.set(key, t);
  return t;
}

function eyeTexture(iris) {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#1b1640'; g.beginPath(); g.ellipse(32, 34, 22, 28, 0, 0, Math.PI * 2); g.fill();
    const grd = g.createLinearGradient(0, 10, 0, 60);
    grd.addColorStop(0, '#1b1640'); grd.addColorStop(1, iris);
    g.fillStyle = grd; g.beginPath(); g.ellipse(32, 38, 17, 21, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(24, 22, 8, 10, -0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(40, 46, 4, 0, Math.PI * 2); g.fill();
  });
}

export const PALETTES = {
  player: { skin: 0xffe1cf, hair: 0xff9fd2, hair2: 0xffc6e6, tail: '#3fd1c7', tail2: '#a8fff2', fin: 0x8ff5ff, top: 0xb98cff, eyes: '#4fb3ff' },
  marina: { skin: 0xf3c6a5, hair: 0x5a3b8c, hair2: 0x8a6bc4, tail: '#ff8a5c', tail2: '#ffd2a1', fin: 0xffc27a, top: 0xffd36b, eyes: '#7a4cc4' },
  queen: { skin: 0xffe8da, hair: 0xfff3b0, hair2: 0xffffff, tail: '#b98cff', tail2: '#f2dcff', fin: 0xe6c7ff, top: 0xff8fcf, eyes: '#9b5cff', crown: true },
  coral: { skin: 0x9c6b4e, hair: 0x1f1a3a, hair2: 0x3d3470, tail: '#ff6f91', tail2: '#ffc1d0', fin: 0xff9fb8, top: 0x7fe7ff, eyes: '#3a2a1a' },
  pearl: { skin: 0xffd9c2, hair: 0x5fd0ff, hair2: 0xb8ecff, tail: '#7c8cff', tail2: '#d0d6ff', fin: 0xa8b4ff, top: 0xfff2a8, eyes: '#2f7fff' },
  guard: { skin: 0xe0b08a, hair: 0x2b4a7a, hair2: 0x3f6aa8, tail: '#2a7fb8', tail2: '#7fd0ff', fin: 0x4fb0e0, top: 0xd8c27a, eyes: '#203050', merman: true },
};

const ball = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
  b.position.set(x, y, z); b.scale.set(sx, sy, sz);
  return b;
};
const HAIR_COLORS = {
  pink: [0xff9fd2, 0xffc6e6], golden: [0xffd35e, 0xfff0a8], chestnut: [0x9a5a3a, 0xc98a5e], midnight: [0x2e3a8c, 0x5a6ad0],
  seafoam: [0x4fd8b8, 0xb0fff0], lilac: [0xb88cff, 0xe4d0ff], starlight: [0xe6f0ff, 0xffd0f0],
  mango: [0xffa53a, 0xffe08a], coconut: [0x6a4028, 0xb88a60], jungle: [0x3fae5a, 0xa8f0a0], sky: [0x6ac8ff, 0xd8f2ff],
};
const ribbon = () => paintMat({ color: 0xff7fb8, emissive: 0x5a1838 });
const HAIR_STYLES = {
  // short rounded bob that stops at the chin
  bob(g, m, m2) {
    g.add(ball(0.5, m, 0, -0.08, -0.2, 1.12, 0.88, 0.8));
    for (const sx of [-1, 1]) g.add(ball(0.16, m2, 0.38 * sx, -0.36, 0.06, 1, 0.8, 1));
    const flick = new THREE.Group(); flick.position.set(0, -0.35, -0.3); g.add(flick);
    flick.add(ball(0.3, m, 0, -0.08, 0, 1.3, 0.6, 0.7));
    return [flick];
  },
  // two space buns on top with ribbons
  buns(g, m, m2) {
    g.add(ball(0.47, m, 0, -0.05, -0.15, 1.04, 0.95, 0.9));
    const r = ribbon();
    for (const sx of [-1, 1]) {
      const bun = new THREE.Group(); bun.position.set(0.3 * sx, 0.38, -0.05); g.add(bun);
      bun.add(ball(0.2, m, 0, 0, 0));
      bun.add(ball(0.08, m2, 0.05 * sx, 0.1, 0.12));
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 5, 14), r);
      bow.rotation.x = Math.PI / 2; bow.position.y = -0.1; bun.add(bow);
    }
    return [];
  },
  // two long braids over the shoulders
  braids(g, m, m2) {
    g.add(ball(0.47, m, 0, -0.05, -0.15, 1.04, 0.95, 0.9));
    const r = ribbon(), sway = [];
    for (const sx of [-1, 1]) {
      const braid = new THREE.Group(); braid.position.set(0.37 * sx, -0.2, 0.16); g.add(braid);
      for (let i = 0; i < 6; i++) braid.add(ball(0.13 - i * 0.008, i % 2 ? m2 : m, sx * 0.03 * (i % 2 ? 1 : -1), -i * 0.17, i * 0.03, 1, 0.85, 1));
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.03, 5, 10), r);
      bow.position.set(0, -1.02, 0.18); braid.add(bow);
      braid.add(ball(0.08, m2, 0, -1.16, 0.2, 1, 1.3, 1));
      sway.push(braid);
    }
    return sway;
  },
  // high ponytail that swishes
  ponytail(g, m, m2) {
    g.add(ball(0.47, m, 0, -0.03, -0.14, 1.04, 0.97, 0.92));
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 5, 12), ribbon());
    tie.position.set(0, 0.38, -0.42); tie.rotation.x = 0.9; g.add(tie);
    const upper = new THREE.Group(); upper.position.set(0, 0.36, -0.46); g.add(upper);
    upper.add(ball(0.24, m, 0, -0.18, -0.12, 1.1, 1.5, 0.9));
    const lower = new THREE.Group(); lower.position.set(0, -0.5, -0.1); upper.add(lower);
    lower.add(ball(0.17, m, 0, -0.2, 0, 1, 1.5, 0.9));
    lower.add(ball(0.11, m2, 0, -0.5, 0.02, 1, 1.3, 0.9));
    return [upper, lower];
  },
  // two bouncy pigtails tied with bows, from Old Shelldon
  pigtails(g, m, m2) {
    g.add(ball(0.47, m, 0, -0.05, -0.15, 1.04, 0.95, 0.9));
    const r = ribbon(), sway = [];
    for (const sx of [-1, 1]) {
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.035, 5, 10), r);
      tie.position.set(0.42 * sx, 0.12, -0.12); tie.rotation.y = Math.PI / 2; g.add(tie);
      const tail = new THREE.Group(); tail.position.set(0.48 * sx, 0.1, -0.12); g.add(tail);
      tail.add(ball(0.17, m, 0.08 * sx, -0.18, 0, 0.9, 1.4, 0.9));
      tail.add(ball(0.12, m2, 0.12 * sx, -0.46, 0.02, 0.9, 1.3, 0.9));
      sway.push(tail);
    }
    return sway;
  },
  // a big bun on top wrapped in little tropical flowers, from Bolt the Builder
  flowerBun(g, m, m2) {
    g.add(ball(0.47, m, 0, -0.03, -0.14, 1.04, 0.97, 0.92));
    g.add(ball(0.27, m, 0, 0.42, -0.12));
    g.add(ball(0.12, m2, 0.06, 0.55, -0.02));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), paintMat({ color: [0xff6fa8, 0xfff07a, 0xffffff][i % 3], emissive: 0x402030 }));
      f.position.set(Math.cos(a) * 0.27, 0.32, -0.12 + Math.sin(a) * 0.27); f.scale.set(1, 0.6, 1);
      g.add(f);
    }
    return [];
  },
};

// Treasures from the chain quests: a bow, a star clip, a shell crown and a flower crown.
function extraHeadwear(head) {
  const out = {};
  const pm = (color, k = 0.3) => paintMat({ color, emissive: new THREE.Color(color).multiplyScalar(k) });
  const bow = new THREE.Group();
  const pink = pm(0xff3a8a);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), pink);
    loop.rotation.z = s * 0.45; loop.position.x = s * 0.11; loop.scale.set(1.3, 0.8, 0.5);
    bow.add(loop);
  }
  bow.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), pink));
  bow.position.set(0.26, 0.4, 0.14); bow.rotation.set(0, 0.5, -0.35); bow.scale.setScalar(1.5);
  head.add(bow); out.bow = bow;
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.075 : 0.18; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
  const star = new THREE.Mesh(starGeo, pm(0xffe066, 0.45));
  star.position.set(-0.36, 0.34, 0.2); star.rotation.set(0, -0.7, 0.3);
  head.add(star); out.starClip = star;
  const shells = new THREE.Group();
  const shellGeo = new THREE.ConeGeometry(0.09, 0.3, 10, 3);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const c = new THREE.Mesh(shellGeo, pm([0xffc8e0, 0xfff4e8, 0xc8e8ff][i % 3], 0.35));
    c.position.set(Math.cos(a) * 0.32, 0.12, Math.sin(a) * 0.32); c.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    shells.add(c);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 6, 24), pm(0xfff0f6, 0.35)); band.rotation.x = Math.PI / 2;
  shells.add(band);
  shells.position.set(0, 0.46, -0.02); shells.rotation.x = -0.2;
  head.add(shells); out.shellCrown = shells;
  const flowers = new THREE.Group();
  const vine = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 26), pm(0x5fcf6a, 0.25)); vine.rotation.x = Math.PI / 2;
  flowers.add(vine);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), pm([0xff8fcf, 0xfff07a, 0xb08cff, 0xffffff][i % 4], 0.4));
    f.position.set(Math.cos(a) * 0.4, 0.03, Math.sin(a) * 0.4); f.scale.set(1, 0.7, 1);
    flowers.add(f);
  }
  flowers.position.set(0, 0.36, -0.02); flowers.rotation.x = -0.3;
  head.add(flowers); out.flowerCrown = flowers;
  Object.assign(out, islandHeadwear(head, pm));
  return out;
}

// Treasures from the island friends above the waves.
function islandHeadwear(head, pm) {
  const out = {};
  const put = (name, g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.position.set(x, y, z); g.rotation.set(rx, ry, rz); head.add(g); out[name] = g; };
  const sph = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); return b; };
  // red pirate bandana with white dots and a knot at the back
  const bandana = new THREE.Group();
  const red = pm(0xe8364a, 0.25), dot = pm(0xffffff, 0.4);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), red);
  bandana.add(cap);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; bandana.add(sph(0.04, dot, Math.cos(a) * 0.3, 0.38, Math.sin(a) * 0.3, 1, 0.4, 1)); }
  bandana.add(sph(0.09, red, 0, 0.12, -0.5), sph(0.08, red, 0.08, -0.05, -0.55, 0.7, 1.6, 0.5), sph(0.08, red, -0.08, -0.05, -0.55, 0.7, 1.6, 0.5));
  put('bandana', bandana, 0, 0.06, -0.08, -0.15);
  // wide straw sun hat with a pink ribbon
  const sunHat = new THREE.Group();
  const straw = pm(0xf2d48a, 0.3);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.04, 28), straw);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.32, 20), straw); crown.position.y = 0.17;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.425, 0.09, 20), pm(0xff7fb8, 0.3)); band.position.y = 0.06;
  sunHat.add(brim, crown, band, sph(0.1, pm(0xff4f9a, 0.35), 0.4, 0.1, 0.1));
  put('sunHat', sunHat, 0, 0.42, -0.04, -0.12);
  // flower necklace around the neck
  const lei = new THREE.Group();
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; lei.add(sph(0.08, pm([0xff5f9a, 0xffd23f, 0xffffff, 0xff8f4a][i % 4], 0.4), Math.cos(a) * 0.36, 0, Math.sin(a) * 0.32, 1, 0.7, 1)); }
  put('lei', lei, 0, -0.55, 0.02, 0.15);
  // crown of big green leaves
  const leafCrown = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = sph(0.13, pm(i % 2 ? 0x4fc860 : 0x7fe07a, 0.3), Math.cos(a) * 0.38, 0.08, Math.sin(a) * 0.38, 0.55, 1.4, 0.22);
    leaf.rotation.set(Math.sin(a) * 0.4, -a + Math.PI / 2, -Math.cos(a) * 0.4); leafCrown.add(leaf);
  }
  put('leafCrown', leafCrown, 0, 0.36, -0.02, -0.25);
  // headband with three tall colourful feathers
  const featherBand = new THREE.Group();
  const fb = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 6, 26), pm(0x3f8fe0, 0.3)); fb.rotation.x = Math.PI / 2; featherBand.add(fb);
  [0xff4a4a, 0xffd23f, 0x3fd0ff].forEach((c, i) => {
    const f = sph(0.09, pm(c, 0.35), (i - 1) * 0.16, 0.42, -0.3, 0.5, 2.4, 0.25); f.rotation.z = (i - 1) * -0.35; featherBand.add(f);
  });
  put('featherBand', featherBand, 0, 0.16, 0, -0.1);
  // heart-shaped pink sunglasses
  const sunnies = new THREE.Group();
  const lens = pm(0xff5fa8, 0.35), frame = pm(0xffffff, 0.4);
  for (const sx of [-1, 1]) { sunnies.add(sph(0.12, lens, sx * 0.17, 0, 0, 1, 0.85, 0.35)); }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), frame); bridge.rotation.z = Math.PI / 2; bridge.position.y = 0.04; sunnies.add(bridge);
  put('sunnies', sunnies, 0, 0.04, 0.44);
  // a little parrot friend sitting on top of the head
  const parrot = new THREE.Group();
  const pr = pm(0xff3b3b, 0.3), py = pm(0xffd23f, 0.35), pb = pm(0x3f8fff, 0.3);
  parrot.add(sph(0.14, pr, 0, 0.12, 0, 0.9, 1.15, 1), sph(0.11, pr, 0, 0.32, 0.04));
  parrot.add(sph(0.05, py, 0, 0.3, 0.15, 0.8, 0.8, 1.4));
  for (const sx of [-1, 1]) { parrot.add(sph(0.1, pb, sx * 0.12, 0.1, -0.02, 0.4, 1, 0.9)); parrot.add(sph(0.025, pm(0x101018, 0.1), sx * 0.07, 0.36, 0.11)); }
  parrot.add(sph(0.06, py, 0, 0.0, -0.16, 0.6, 0.5, 1.8));
  put('parrotPal', parrot, 0.08, 0.48, -0.05, 0, 0.3);
  return out;
}

export class MerModel {
  constructor(pal = PALETTES.player) {
    this.pal = pal;
    this.root = new THREE.Group();      // world transform (yaw)
    this.body = new THREE.Group();      // pitched for swim pose
    this.root.add(this.body);
    this.t = Math.random() * 10;
    this.swim = 0;
    this.speed = 0;
    this.build();
  }

  build() {
    const p = this.pal, B = this.body;
    const skin = paintMat({ color: p.skin, emissive: new THREE.Color(p.skin).multiplyScalar(0.42) });
    const hairM = paintMat({ color: p.hair, emissive: new THREE.Color(p.hair).multiplyScalar(0.18) });
    const hair2M = paintMat({ color: p.hair2, emissive: new THREE.Color(p.hair2).multiplyScalar(0.18) });
    const topM = paintMat({ color: p.top, emissive: new THREE.Color(p.top).multiplyScalar(0.2) });
    this.topMat = topM;
    this.hairM = hairM; this.hair2M = hair2M;
    const big = p.merman ? 1.15 : 1;

    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26 * big, 0.42, 4, 10), skin);
    torso.position.y = 0.38; torso.scale.set(1, 1, 0.8);
    B.add(torso);
    if (p.merman) {
      const plate = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), topM);
      plate.position.set(0, 0.55, 0.02); plate.scale.set(1, 0.9, 0.85); plate.rotation.x = -0.15;
      B.add(plate);
    } else {
      for (const s of [-1, 1]) {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), topM);
        shell.position.set(0.11 * s, 0.56, 0.17); shell.rotation.x = Math.PI / 2.3; shell.scale.set(1, 0.6, 1);
        B.add(shell);
      }
    }
    // shimmering waist band where the tail starts
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.25 * big, 0.06, 6, 16), paintMat({ color: p.fin, emissive: new THREE.Color(p.fin).multiplyScalar(0.35) }));
    band.rotation.x = Math.PI / 2; band.position.y = 0.1;
    B.add(band);

    // head
    this.head = new THREE.Group();
    this.head.position.y = 0.98;
    B.add(this.head);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), skin);
    headM.scale.set(1, 0.95, 0.92);
    this.head.add(headM);
    const eyeMat = new THREE.MeshBasicMaterial({ map: eyeTexture(p.eyes), transparent: true });
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), eyeMat);
      e.position.set(0.15 * s, -0.02, 0.385); e.rotation.y = 0.32 * s; e.scale.set(0.9, 1.15, 1);
      this.head.add(e);
      this.eyes.push(e);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), new THREE.MeshBasicMaterial({ color: 0xff8fb0, transparent: true, opacity: 0.55 }));
      blush.position.set(0.25 * s, -0.15, 0.32); blush.rotation.y = 0.6 * s; blush.scale.set(1.3, 0.7, 1);
      this.head.add(blush);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 4, 10, Math.PI), new THREE.MeshBasicMaterial({ color: 0xc2405d }));
    mouth.position.set(0, -0.17, 0.39); mouth.rotation.z = Math.PI;
    this.head.add(mouth);

    // hair: a full cap that frames the face, side locks and soft bangs
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.47, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hairM);
    cap.position.set(0, 0.03, -0.05); cap.rotation.x = -0.55; cap.scale.set(1.04, 1, 1.02);
    this.head.add(cap);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), hairM);
    back.position.set(0, -0.02, -0.12); back.scale.set(1.04, 1.02, 0.9);
    this.head.add(back);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.13;
      const bang = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), i % 2 ? hair2M : hairM);
      bang.position.set(x, 0.24 - Math.abs(i - 2) * 0.035, 0.29 - Math.abs(i - 2) * 0.05);
      bang.scale.set(0.95, 0.6, 0.55); bang.rotation.z = (i - 2) * -0.25;
      this.head.add(bang);
    }
    // long flowing hair (default style): side locks, curls and two smooth locks that trail & sway
    this.hair = [];
    this.hairStyles = {};
    if (!p.merman) {
      const long = new THREE.Group();
      this.head.add(long);
      for (const sx of [-1, 1]) {
        const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 4, 8), hairM);
        lock.position.set(0.36 * sx, -0.22, 0.08); lock.rotation.z = 0.12 * sx; lock.scale.set(1, 1, 0.8);
        long.add(lock);
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), hair2M);
        curl.position.set(0.39 * sx, -0.5, 0.1);
        long.add(curl);
      }
      const upper = new THREE.Group();
      upper.position.set(0, -0.05, -0.22);
      long.add(upper);
      const u = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), hairM);
      u.scale.set(0.95, 1.1, 0.42); u.position.y = -0.38;
      upper.add(u);
      const lower = new THREE.Group();
      lower.position.y = -0.75;
      upper.add(lower);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), hairM);
      l.scale.set(0.95, 1.25, 0.38); l.position.y = -0.3;
      lower.add(l);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), hair2M);
      tip.scale.set(1.3, 1, 0.6); tip.position.y = -0.72;
      lower.add(tip);
      this.hairStyles.long = { group: long, sway: [upper, lower] };
      this.hair = [upper, lower];
      // starfish hair clip
      const clip = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), paintMat({ color: 0xffd36b, emissive: 0x806020 }));
      clip.position.set(0.3, 0.22, 0.12); clip.scale.set(1, 1, 0.4);
      this.head.add(clip);
    } else {
      // helmet with a fin crest for the guards
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.47, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), topM);
      helm.position.y = 0.05;
      this.head.add(helm);
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 4), paintMat({ color: p.fin, emissive: 0x103040 }));
      crest.position.set(0, 0.5, -0.05); crest.rotation.x = -0.4; crest.scale.set(0.4, 1, 2.5);
      this.head.add(crest);
    }
    if (p.crown) this.addCrown();

    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.29 * s * big, 0.6, 0);
      B.add(sh);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.38, 3, 8), skin);
      arm.position.y = -0.22;
      sh.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), skin);
      hand.position.y = -0.46;
      sh.add(hand);
      sh.rotation.z = 0.5 * s;
      this.arms.push(sh);
    }
    if (p.merman) {
      // trident
      const tri = new THREE.Group();
      const gold = paintMat({ color: 0xffd36b, emissive: 0x604010 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), gold);
      tri.add(shaft);
      for (const x of [-0.14, 0, 0.14]) {
        const prong = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.35, 6), gold);
        prong.position.set(x, 1.25 + (x === 0 ? 0.06 : 0), 0);
        tri.add(prong);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 6), gold);
      bar.rotation.z = Math.PI / 2; bar.position.y = 1.08;
      tri.add(bar);
      tri.position.set(0, -0.46, 0.05);
      tri.rotation.x = Math.PI / 2;
      this.arms[1].add(tri);
    }

    // tail chain
    const tailM = paintMat({ map: scaleTexture(p.tail, p.tail2), emissive: new THREE.Color(p.tail).multiplyScalar(0.25) });
    this.tailMat = tailM;
    this.tail = [];
    let parent = B;
    const N = 7;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const r0 = 0.26 * big * (1 - t0 * 0.78), r1 = 0.26 * big * (1 - t1 * 0.78);
      const len = 0.26;
      const seg = new THREE.Group();
      seg.position.y = i === 0 ? 0.12 : -len;
      parent.add(seg);
      const geo = new THREE.CylinderGeometry(r0, r1, len + 0.02, 12, 1);
      geo.translate(0, -len / 2, 0);
      const m = new THREE.Mesh(geo, tailM);
      m.scale.z = 0.85;
      seg.add(m);
      this.tail.push(seg);
      parent = seg;
    }
    // tail fin: two translucent leaf shapes
    const finM = paintMat({ color: p.fin, emissive: new THREE.Color(p.fin).multiplyScalar(0.35), side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    this.finM = finM;
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0);
    leaf.bezierCurveTo(0.25, -0.1, 0.55, -0.35, 0.62, -0.72);
    leaf.bezierCurveTo(0.45, -0.6, 0.25, -0.6, 0.05, -0.42);
    leaf.lineTo(0, 0);
    const leafGeo = new THREE.ShapeGeometry(leaf, 8);
    this.fin = new THREE.Group();
    this.fin.position.y = -0.26;
    parent.add(this.fin);
    // the fluke lies in the body's X/Y plane: spread left/right like a dolphin's
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(leafGeo, finM);
      f.scale.x = s;
      this.fin.add(f);
    }
  }

  addCrown() {
    if (this.crown) return;
    const g = new THREE.Group();
    const gold = paintMat({ color: 0xffd36b, emissive: 0x806020 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 14, 1, true), gold);
    base.material.side = THREE.DoubleSide;
    g.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), gold);
      spike.position.set(Math.cos(a) * 0.22, 0.1, Math.sin(a) * 0.22);
      g.add(spike);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: [0xff8fcf, 0x8fe3ff, 0xfff1a8][i % 3] }));
      gem.position.set(Math.cos(a) * 0.23, 0.2, Math.sin(a) * 0.23);
      g.add(gem);
    }
    g.position.set(0, 0.4, -0.02); g.rotation.x = -0.25;
    this.head.add(g);
    this.crown = g;
  }

  setTailColors(c1, c2) {
    this.tailMat.map = scaleTexture(c1, c2);
    this.tailMat.emissive.set(c1).multiplyScalar(0.25);
    this.tailMat.needsUpdate = true;
  }

  setOutfit(outfit = {}) {
    const tails = {
      teal: ['#3fd1c7', '#a8fff2'], rose: ['#ff7fac', '#ffe0ef'],
      sapphire: ['#448fe8', '#b9e7ff'], rainbow: ['#ff8fcf', '#9ff3ff'], pearl: ['#efe6ff', '#ffd6f0'],
      galaxy: ['#5a3ec8', '#f0c8ff'], mint: ['#5fe0b0', '#eafff6'], candy: ['#ff8fc8', '#fff09a'], sunset: ['#ff7a4a', '#ffd88a'],
      lagoon: ['#18b8d8', '#c8fbff'], treasure: ['#e8a820', '#fff2a0'], sunshine: ['#ffd23f', '#ffffff'], tropic: ['#2fc870', '#ffc84a'], flamingo: ['#ff6fa8', '#ffd0e4'],
    };
    const tops = { lavender: 0xb98cff, seaGlass: 0x69e5d2, coral: 0xff8eab, gold: 0xffd36b, shellTop: 0xffb8dc,
      berry: 0xd8407a, ocean: 0x3f7fe0, mintTop: 0x8af0c8, sunny: 0xffe14d,
      palmTop: 0x6fd060, sailor: 0x2f5fc8, pirateStripe: 0x2a2a3a, hibiscus: 0xff4f7a, peacockTop: 0x1fa8b8, leafTop: 0x9ae05a };
    const [c1, c2] = tails[outfit.tail] || tails.teal;
    this.setTailColors(c1, c2);
    const top = tops[outfit.top] || tops.lavender;
    this.topMat.color.setHex(top);
    this.topMat.emissive.setHex(top).multiplyScalar(0.2);
    this.setHeadwear(outfit.head || 'none');
    this.setHair(outfit.hair || 'long');
    this.setHairColor(outfit.hairColor);
  }

  // Hair colours from the wardrobe (the player's own palette is the default).
  setHairColor(name) {
    if (!this.hairM) return;
    const c = HAIR_COLORS[name] || [this.pal.hair, this.pal.hair2];
    this.hairM.color.setHex(c[0]); this.hairM.emissive.setHex(c[0]).multiplyScalar(0.18);
    this.hair2M.color.setHex(c[1]); this.hair2M.emissive.setHex(c[1]).multiplyScalar(0.18);
  }

  // hairstyles from the wardrobe; built lazily, each with its own swaying parts
  setHair(kind) {
    if (!this.hairStyles?.long) return;
    if (!this.hairStyles[kind]) {
      const build = HAIR_STYLES[kind];
      if (!build) kind = 'long';
      else {
        const group = new THREE.Group();
        const sway = build(group, this.hairM, this.hair2M);
        this.head.add(group);
        this.hairStyles[kind] = { group, sway };
      }
    }
    for (const [name, st] of Object.entries(this.hairStyles)) st.group.visible = name === kind;
    this.hair = this.hairStyles[kind].sway;
    this.hairStyle = kind;
  }

  setHeadwear(kind) {
    if (!this.headwear) {
      this.headwear = {};
      const coral = new THREE.Group();
      const cm = paintMat({ color: 0xff8fae, emissive: 0x52202e });
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.1 + i * 0.025, 3, 5), cm);
        b.position.set(0.30 + i * 0.035, 0.27 + i * 0.02, 0.1);
        b.rotation.z = -0.25 + i * 0.2;
        coral.add(b);
      }
      coral.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), paintMat({ color: 0xffe6a1, emissive: 0x584023 })));
      coral.children.at(-1).position.set(0.32, 0.24, 0.14);
      this.head.add(coral); this.headwear.coralClip = coral;
      const tiara = new THREE.Group();
      const gold = paintMat({ color: 0xffd991, emissive: 0x463014 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.028, 5, 18, Math.PI), gold);
      band.rotation.x = -0.45; band.rotation.z = Math.PI;
      tiara.add(band);
      for (const x of [-0.16, 0, 0.16]) {
        const pearl = new THREE.Mesh(new THREE.SphereGeometry(x === 0 ? 0.085 : 0.055, 10, 8),
          paintMat({ color: 0xfffaeb, emissive: 0x88809b }));
        pearl.position.set(x, x === 0 ? 0.16 : 0.09, 0.03);
        tiara.add(pearl);
      }
      tiara.position.set(0, 0.34, 0.03);
      this.head.add(tiara); this.headwear.pearlTiara = tiara;
      const hat = pirateHat(0.95);
      hat.position.set(0, 0.5, -0.02); hat.rotation.x = -0.15;
      this.head.add(hat); this.headwear.pirateHat = hat;
      Object.assign(this.headwear, extraHeadwear(this.head));
    }
    if (kind === 'crown' && !this.crown) this.addCrown();
    if (this.crown) this.crown.visible = kind === 'crown';
    for (const [name, piece] of Object.entries(this.headwear)) piece.visible = name === kind;
  }

  // speed: 0..1 normalised; swim: target pose blend; dt seconds
  update(dt, speed = 0, targetSwim = 0, turn = 0) {
    this.speed = speed;
    this.swim += (targetSwim - this.swim) * (1 - Math.exp(-4 * dt));
    const freq = 2.2 + speed * 5.5;
    this.t += dt * freq;
    const t = this.t, sw = this.swim;
    // body pose: upright (0) -> horizontal (1), slight bob
    this.body.rotation.x = sw * Math.PI * 0.5 + Math.sin(t * 0.5) * 0.04;
    this.body.rotation.z = -turn * 0.5 * sw;
    this.body.position.y = Math.sin(t * 0.5) * 0.06 * (1 - sw);
    // head looks forward when swimming
    this.head.rotation.x = -sw * 1.15 + Math.sin(t * 0.5 + 1) * 0.04;
    // tail wave: dolphin-kick in the body's local X axis
    const amp = 0.12 + speed * 0.22;
    this.tail.forEach((s, i) => {
      s.rotation.x = Math.sin(t - i * 0.65) * amp * (0.4 + i * 0.18) - (1 - sw) * 0.06;
      s.rotation.z = Math.sin(t * 0.5 - i * 0.5) * 0.05 * (1 - sw);
    });
    this.fin.rotation.x = Math.sin(t - 7 * 0.65) * amp * 1.6;
    // arms: paddle when idle, stream back when swimming fast
    this.arms.forEach((a, i) => {
      const s = i ? 1 : -1;
      const idle = Math.sin(t * 0.7 + i * Math.PI) * 0.35;
      a.rotation.z = THREE.MathUtils.lerp(0.55 + idle * 0.4, 0.25, sw * Math.min(1, speed * 1.5)) * -s;
      a.rotation.x = THREE.MathUtils.lerp(idle, 0.4 + Math.sin(t) * 0.15, sw);
    });
    // hair trails behind
    this.hair.forEach((h, i) => {
      h.rotation.x = 0.25 + sw * 0.55 + Math.sin(t * 0.6 - i * 0.7) * (0.12 + speed * 0.1);
      h.rotation.z = Math.sin(t * 0.4 - i * 0.6) * 0.12;
    });
    // blink
    const blink = (Math.sin(t * 0.37) > 0.995) ? 0.15 : 1.15;
    this.eyes.forEach((e) => { e.scale.y = blink; });
  }
}
