// Chain quests: two three-step stories in every area. Each step is
//   collect (pick up N things), visit (swim to a glowing beacon) or deliver (talk to someone).
// Finish a step, swim back to the giver for the next one; the last step wins a wardrobe treasure.
import * as THREE from 'three';
import { WORLD, groundHeight, glowTexture } from './util.js';
import { paintMat, segment } from './geom.js';
import { SURFACE_CHAINS } from './chains_surface.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// W: helpers handed in by the story { city(x,y,z), gh(x,z,up), around(cx,cz,r,n,up,seed), bay }
export const CHAINS = {
  // ---------- castle ----------
  bakery: { giver: 'baker', area: 'castle', reward: ['bow', 'head'], color: 0xffb0d8, steps: [
    { type: 'collect', item: 'sugar', where: (W) => [W.city(-40, 7, 72), W.city(40, 7, 72), W.city(-37, 7, 48), W.city(46, 7, 52)] },
    { type: 'deliver', to: 'queen' },
    { type: 'collect', item: 'lantern', where: (W) => [W.city(-61, 15, -32), W.city(61, 15, -32), W.city(7, 13, 15)] },
  ] },
  library: { giver: 'librarian', area: 'castle', reward: ['galaxy', 'tail'], color: 0x9ab0ff, steps: [
    { type: 'collect', item: 'book', where: (W) => [W.city(-50, 6, 30), W.city(60, 8, -8), W.city(-22, 11, -44)] },
    { type: 'deliver', to: 'fairy' },
    { type: 'visit', where: (W) => W.city(0, 44, -73) },
  ] },
  // ---------- kelp forest ----------
  granny: { giver: 'granny', area: 'kelp', reward: ['mint', 'tail'], color: 0xd0a8ff, steps: [
    { type: 'collect', item: 'yarn', where: (W) => W.around(-130, 20, 24, 4, 3, 1) },
    { type: 'deliver', to: 'shelly' },
    { type: 'collect', item: 'kelpFlower', where: (W) => W.around(-130, 20, 40, 3, 2, 2) },
  ] },
  inky: { giver: 'inky', area: 'kelp', reward: ['starClip', 'head'], color: 0x4fd0c0, steps: [
    { type: 'collect', item: 'inkPearl', where: (W) => W.around(-150, 0, 16, 3, 2, 3) },
    { type: 'visit', where: () => v3(-130, 46, 20) },
    { type: 'collect', item: 'note', where: (W) => W.around(-125, 25, 30, 4, 9, 4) },
  ] },
  // ---------- coral reef ----------
  sandy: { giver: 'sandy', area: 'reef', reward: ['berry', 'top'], color: 0xffa040, steps: [
    { type: 'collect', item: 'sandDollar', where: (W) => W.around(110, 40, 20, 4, 1.6, 5) },
    { type: 'visit', where: (W) => W.gh(118, 48, 9) },
    { type: 'deliver', to: 'pip' },
  ] },
  puffy: { giver: 'puffy', area: 'reef', reward: ['candy', 'tail'], color: 0xffe14d, steps: [
    { type: 'collect', item: 'gem', where: (W) => W.around(110, 40, 28, 3, 3, 6) },
    { type: 'deliver', to: 'sandy' },
    { type: 'collect', item: 'starfish', where: (W) => W.around(112, 38, 36, 4, 1.6, 7) },
  ] },
  // ---------- deep trench ----------
  glim: { giver: 'glim', area: 'trench', reward: ['ocean', 'top'], color: 0xfff07a, steps: [
    { type: 'collect', item: 'bulb', where: (W) => W.around(60, 170, 20, 3, 3, 8) },
    { type: 'visit', where: (W) => W.gh(60, 170, 4) },
    { type: 'deliver', to: 'shelly' },
  ] },
  luna: { giver: 'luna', area: 'trench', reward: ['shellCrown', 'head'], color: 0xc8b0ff, steps: [
    { type: 'collect', item: 'moonDrop', where: (W) => W.around(60, 170, 30, 4, 10, 9) },
    { type: 'deliver', to: 'momo' },
    { type: 'deliver', to: 'whelk' },
  ] },
  // ---------- open sea ----------
  bubbles: { giver: 'bubbles', area: 'sea', reward: ['sunset', 'tail'], color: 0x7fd8ff, steps: [
    { type: 'visit', where: () => v3(25, WORLD.surfaceY - 2, 30) },
    { type: 'collect', item: 'bubble', where: () => [v3(-20, 22, 40), v3(10, 38, 20), v3(30, 18, 55), v3(-5, 30, 5)] },
    { type: 'deliver', to: 'marina' },
  ] },
  ottie: { giver: 'ottie', area: 'sea', reward: ['mintTop', 'top'], color: 0xc89a6a, steps: [
    { type: 'collect', item: 'clam', where: (W) => W.around(-10, 60, 25, 3, 1.6, 10) },
    { type: 'deliver', to: 'splash' },
    { type: 'collect', item: 'pebble', where: (W) => W.around(20, 95, 22, 4, 1.6, 11) },
  ] },
  // ---------- shipwreck bay ----------
  armor: { giver: 'clawsworth', area: 'bay', reward: ['sunny', 'top'], color: 0xb8c8e8, steps: [
    { type: 'collect', item: 'shield', where: (W) => { const w = W.bay.wrecks; return [w[1].deck.clone().add(v3(0, 1, 0)), w[2].deck.clone().add(v3(0, 1, 0)), w[3].deck.clone().add(v3(2, 0.5, 0)), W.gh(w[0].pos.x + 9, w[0].pos.z + 9, 2)]; } },
    { type: 'visit', where: (W) => W.bay.wrecks[0].deck.clone().add(v3(0, 12, 0)) },
    { type: 'deliver', to: 'pinch' },
  ] },
  song: { giver: 'selkie', area: 'bay', reward: ['flowerCrown', 'head'], color: 0x6fb8ff, steps: [
    { type: 'collect', item: 'songShell', where: (W) => W.around(60, 450, 60, 4, 3, 12) },
    { type: 'deliver', to: 'madamePearl' },
    { type: 'collect', item: 'orb', where: (W) => W.around(60, 450, 92, 3, 3, 13) },
  ] },
};
Object.assign(CHAINS, SURFACE_CHAINS);
export const CHAIN_BY_GIVER = Object.fromEntries(Object.entries(CHAINS).map(([id, c]) => [c.giver, id]));

// ---------- quest items ----------
const glowSprite = (color, size) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
};
const pm = (color, k = 0.35, extra = {}) => paintMat({ color, emissive: new THREE.Color(color).multiplyScalar(k), ...extra });
const ITEMS = {
  sugar: [0xfff0f8, (g, m) => { for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), m); b.position.set(Math.cos(i) * 0.25, (i % 3) * 0.2, Math.sin(i) * 0.25); g.add(b); } }],
  lantern: [0xffb070, (g, m) => {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), m); body.scale.set(1, 1.25, 1); g.add(body);
    for (const y of [-0.6, 0.6]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 10), pm(0xc84040, 0.3)); cap.position.y = y; g.add(cap); }
  }],
  book: [0x7a8cff, (g, m) => {
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.25), m); g.add(cover);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.27), pm(0xfff8e8, 0.4)); pages.position.x = 0.06; g.add(pages);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), pm(0xffe066, 0.5)); star.position.set(-0.02, 0.1, 0.16); star.scale.z = 0.3; g.add(star);
  }],
  yarn: [0xff9fd0, (g, m) => {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), m));
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 4, 18), pm(0xffffff, 0.4)); r.rotation.set(i, i * 0.7, 0); g.add(r); }
  }],
  kelpFlower: [0xb8ff6a, (g, m) => {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const p = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), m); p.scale.set(1, 0.4, 0.6); p.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); p.rotation.y = -a; g.add(p); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), pm(0xfff6a0, 0.6)); c.position.y = 0.05; g.add(c);
  }],
  inkPearl: [0xa06bff, (g, m) => { g.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), m)); }],
  note: [0x6fe8ff, (g, m) => {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), m); head.scale.set(1.2, 0.85, 0.7); g.add(head);
    g.add(new THREE.Mesh(segment(v3(0.28, 0, 0), v3(0.28, 1.0, 0), 0.05, 0.05, 5), m));
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), m); flag.position.set(0.44, 0.92, 0); flag.rotation.z = -0.5; g.add(flag);
  }],
  sandDollar: [0xf6e2b8, (g, m) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 18), m); d.rotation.x = Math.PI / 2; g.add(d);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), pm(0xc8a070, 0.3)); p.position.set(Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.06); g.add(p); }
  }],
  gem: [0xff5aa0, (g, m) => { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), m); o.scale.set(0.8, 1.2, 0.8); g.add(o); }],
  starfish: [0xff8a5c, (g, m) => {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.25 : 0.6; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }); geo.center();
    g.add(new THREE.Mesh(geo, m));
  }],
  bulb: [0xfff07a, (g, m) => {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), m));
    g.add(new THREE.Mesh(segment(v3(0, 0.35, 0), v3(0.2, 0.9, 0), 0.04, 0.03, 4), pm(0x6a5ab8, 0.3)));
  }],
  moonDrop: [0xd8c8ff, (g, m) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), m); g.add(d);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 12), m); tip.position.y = 0.42; g.add(tip);
  }],
  bubble: [0xbff4ff, (g) => {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 14), paintMat({ color: 0xd8f8ff, emissive: 0x4a90b0, transparent: true, opacity: 0.45, depthWrite: false })));
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), pm(0xffffff, 0.8)); shine.position.set(-0.3, 0.3, 0.45); g.add(shine);
  }],
  clam: [0xffc8a0, (g, m) => {
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m); h.scale.set(1, 0.4, 0.9); h.rotation.x = s > 0 ? 0 : Math.PI; h.position.y = s * 0.04; g.add(h); }
  }],
  pebble: [0x9ad0e8, (g, m) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), m); p.scale.set(1.2, 0.6, 1); g.add(p); }],
  shield: [0xc8d4ec, (g, m) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18), m); s.rotation.x = Math.PI / 2; g.add(s);
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.05), pm(0xff5a8a, 0.4)); c1.position.z = 0.08; g.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.05), pm(0xff5a8a, 0.4)); c2.position.z = 0.08; g.add(c2);
  }],
  songShell: [0x6fb8ff, (g, m) => {
    const geo = new THREE.LatheGeometry(Array.from({ length: 17 }, (_, i) => { const t = i / 16; return new THREE.Vector2(Math.max(0.02, 0.5 * Math.pow(1 - t, 0.9) * (0.85 + 0.15 * Math.cos(t * 22))), t * 1.1); }), 12);
    const s = new THREE.Mesh(geo, m); s.rotation.z = 1.1; s.position.set(-0.35, -0.25, 0); g.add(s);
  }],
  orb: [0xfff8ff, (g, m) => { g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), m)); }],
  // ---------- island things ----------
  mapPiece: [0xf2dca0, (g, m) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.05), m); p.rotation.z = 0.15; g.add(p);
    const x = pm(0xd83a3a, 0.4);
    for (const r of [0.8, -0.8]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.07), x); b.rotation.z = r; b.position.z = 0.04; g.add(b); }
  }],
  coconut: [0x8a5a34, (g, m) => {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), m));
    for (const [x, y] of [[-0.12, 0.1], [0.12, 0.1], [0, -0.08]]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), pm(0x3a2414, 0.1)); d.position.set(x, y, 0.38); g.add(d); }
  }],
  fish: [0x7fd0ff, (g, m) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), m); b.scale.set(1.3, 0.8, 0.5); g.add(b);
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 4), m); t.rotation.z = Math.PI / 2; t.position.x = -0.55; g.add(t);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), pm(0x202040, 0.1)); e.position.set(0.28, 0.08, 0.15); g.add(e);
  }],
  hibiscus: [0xff5a9a, (g, m) => {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const p = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), m); p.scale.set(1, 0.3, 0.7); p.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); p.rotation.y = -a; g.add(p); }
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5), pm(0xfff070, 0.5)); c.position.y = 0.2; g.add(c);
    g.rotation.x = 0.5;
  }],
  crystal: [0xc8a0ff, (g, m) => { for (const [x, s] of [[0, 1], [0.3, 0.6], [-0.28, 0.7]]) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), m); c.scale.set(0.7 * s, 1.6 * s, 0.7 * s); c.position.x = x; g.add(c); } }],
  berry: [0xff3a6a, (g, m) => {
    for (const [x, y, z] of [[0, 0.15, 0], [-0.2, -0.08, 0.05], [0.2, -0.08, 0.05], [0, -0.1, -0.18]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), m); b.position.set(x, y, z); g.add(b); }
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), pm(0x4fbf5a, 0.25)); l.scale.set(1.4, 0.3, 0.7); l.position.y = 0.36; g.add(l);
  }],
  truffle: [0xc87a50, (g, m) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); cap.position.y = 0.1; g.add(cap);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.4, 8), pm(0xfff4e0, 0.35)));
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), pm(0xffffff, 0.5)); d.position.set(Math.cos(i * 1.6) * 0.25, 0.38, Math.sin(i * 1.6) * 0.25); g.add(d); }
  }],
  ball: [0xff5a5a, (g) => {
    const cols = [0xff5a5a, 0xffffff, 0x4aa8ff, 0xffffff, 0xffd23f, 0xffffff];
    cols.forEach((c, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 10, (i / 6) * Math.PI * 2, Math.PI / 3), pm(c, 0.3)); g.add(s); });
  }],
  button: [0xff8fc8, (g, m) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 18), m); b.rotation.x = Math.PI / 2; g.add(b);
    for (const [x, y] of [[-0.1, 0.1], [0.1, 0.1], [-0.1, -0.1], [0.1, -0.1]]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6), pm(0x7a3a5a, 0.2)); h.rotation.x = Math.PI / 2; h.position.set(x, y, 0.01); g.add(h); }
  }],
  seed: [0xb8ff6a, (g, m) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), pm(0xc8925a, 0.3)); s.scale.set(1, 1.3, 1); g.add(s);
    for (const r of [-0.6, 0.6]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), m); l.scale.set(1.3, 0.3, 0.7); l.position.set(r * 0.25, 0.45, 0); l.rotation.z = -r; g.add(l); }
  }],
  plank: [0xd8a060, (g, m) => { for (const y of [-0.15, 0.15]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.12), m); p.position.y = y; p.rotation.z = y; g.add(p); } }],
  feather: [0xff4a4a, (g) => {
    ['#ff4a4a', '#ffd23f', '#3f8fff'].forEach((c, i) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), pm(new THREE.Color(c).getHex(), 0.35)); f.scale.set(0.6, 2.2, 0.15); f.position.set((i - 1) * 0.15, 0, 0); f.rotation.z = (i - 1) * 0.35; g.add(f); });
  }],
  mango: [0xffa030, (g, m) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), m); b.scale.set(1, 1.25, 0.9); g.add(b);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), pm(0x4fbf5a, 0.25)); l.scale.set(1.5, 0.3, 0.7); l.position.set(0.12, 0.5, 0); g.add(l);
  }],
  shell: [0xffc8e0, (g, m) => {
    for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5), m); r.position.y = 0.0; r.rotation.z = (i - 3) * 0.22; r.position.x = (i - 3) * 0.06; g.add(r); }
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m); base.scale.set(1, 0.4, 0.5); base.rotation.x = Math.PI / 2; g.add(base);
  }],
  banana: [0xfff04a, (g, m) => {
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.09, 6, 12, Math.PI * 0.6), m); b.rotation.z = 0.6 + i * 0.2; b.position.z = (i - 1) * 0.12; g.add(b); }
  }],
  lilyPad: [0x6fd86f, (g, m) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 18, 1, false, 0.3, Math.PI * 2 - 0.6), m); g.add(p);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), pm(0xffb8e0, 0.45)); f.position.set(0.15, 0.12, 0.1); g.add(f);
  }],
  glimmer: [0xd8b0ff, (g, m) => { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), m); g.add(o); }],
};
export function chainItemModel(type) {
  const [color, build] = ITEMS[type];
  const g = new THREE.Group();
  build(g, pm(color, 0.45));
  const glow = glowSprite(color, 3.2);
  g.add(glow); g.userData.glow = glow;
  return g;
}
// A glowing ring and light column marking a place to visit.
export function beaconModel(color) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 8, 32), pm(color, 0.6));
  ring.rotation.x = Math.PI / 2; g.add(ring);
  const glow = glowSprite(color, 9); g.add(glow);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 14, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  col.position.y = 7; g.add(col);
  g.userData = { glow, ring };
  return g;
}
export const groundAt = (x, z, up) => v3(x, groundHeight(x, z) + up, z);
