// Story, characters, collectibles, the sparkle guide, friends & rewards.
import * as THREE from 'three';
import { WORLD, groundHeight, glowTexture, canvasTexture, rr } from './util.js';
import { MerModel, PALETTES } from './mermaid.js';
import { seahorseModel, turtleModel, octopusModel, dolphinModel, whaleModel, crabModel, pufferModel, jellyModel, otterModel } from './creatures.js';
import { costumeCrab, lobsterModel, hermitCrabModel, snailModel, sealModel, oysterModel, anglerfishModel } from './seafolk.js';
import { CHAINS, CHAIN_BY_GIVER, chainItemModel, beaconModel } from './chains.js';
import { LAND_KINDS, LAND_SCALE, Flyer, Hopper, Walker, Percher, Floater, parrotModel, leafkinModel } from './landfolk.js';
import { tunnelInfo, TUNNEL } from './util.js';
import { paintMat } from './geom.js';
import { collide } from './world.js';
import { t } from './i18n.js';
import { sfx } from './audio.js';

export const STAGES = ['meet', 'pearls', 'backQueen', 'baby', 'bringBaby', 'whale', 'shelly', 'crystals', 'finale', 'free'];
export const ALBUM = ['clownfish', 'tang', 'yellowfish', 'angelfish', 'seahorse', 'crab', 'puffer', 'octopus', 'jellyfish', 'turtle', 'manta', 'dolphin', 'whale', 'narwhal', 'seaBunny', 'starfish', 'otter', 'seal', 'lobster', 'hermitCrab', 'snail', 'oyster', 'anglerfish', 'seaDragon', 'mermaid', 'guard',
  ...Object.keys(LAND_KINDS)];
// Baby animals who need help: collect their things, bring them back, win a hairstyle.
// Collect missions: find the things a friend asks for, bring them back, win something for the wardrobe.
const BABIES = {
  tico: { kind: 'turtle', count: 3, item: 'grape', rewards: [['braids', 'hair']], radius: 2.8 },
  pip: { kind: 'octopus', count: 4, item: 'toy', rewards: [['buns', 'hair']], radius: 2.8 },
  splash: { kind: 'dolphin', count: 4, item: 'ring', rewards: [['ponytail', 'hair']], radius: 3.2 },
  momo: { kind: 'whale', count: 3, item: 'star', rewards: [['bob', 'hair']], radius: 3 },
  // Shipwreck Bay
  pinch: { kind: 'crab', count: 5, item: 'coin', rewards: [['pirateHat', 'head']], radius: 3 },
  rosa: { kind: 'lobster', count: 3, item: 'pepper', rewards: [['shellTop', 'top'], ['lilac', 'hairColor']], radius: 2.8 },
  shellby: { kind: 'hermitCrab', count: 3, item: 'shell', rewards: [['pearl', 'tail'], ['starlight', 'hairColor']], radius: 3 },
};
const SIDE_IDS = ['tailor', 'keeper', 'bard', ...Object.keys(BABIES), 'whelk'];
// Characters of the bay who just love to chat (lines rotate each visit).
const CHATTERS = { madamePearl: 2, snappy: 2, zaza: 2 };
const TRAIL_COLORS = { main: 0xfff3a0, tailor: 0xff8fd0, keeper: 0x7ff0ff, bard: 0xc49bff,
  tico: 0x9dff8a, pip: 0xffa860, splash: 0x5fa8ff, momo: 0xff7a8a,
  pinch: 0xffd23f, rosa: 0xff6a4a, shellby: 0xff9fe8, whelk: 0x8affd8, giver: 0x5fb4ff,
  ...Object.fromEntries(Object.entries(CHAINS).map(([id, c]) => [id, c.color])) };
export const FACES = { marina: '🧜‍♀️', queen: '👸', guard: '🔱', coral: '🧜🏾‍♀️', pearl: '🧜‍♀️', mama: '💛', baby: '🍼', shelly: '🐢', whale: '🐋', tailor: '🧵', baker: '🧁', keeper: '⛲', bard: '🎶', librarian: '📚', fairy: '🧚', tico: '🐢', pip: '🐙', splash: '🐬', momo: '🐳', citizen: '🧜‍♀️', activity: '🧜🏼‍♀️', ambientSeahorse: '🌊',
  pinch: '🦀', rosa: '🦞', shellby: '🐚', whelk: '🐌', clawsworth: '🛡️', selkie: '🦭', madamePearl: '🔮',
  granny: '👵', inky: '🐙', sandy: '🦀', puffy: '🐡', glim: '💡', luna: '🪼', bubbles: '🐬', ottie: '🦦',
  polly: '🦜', coco: '🦀', gully: '🐦', pelly: '🦢', billy: '🐐', batty: '🦇', boo: '👻', shelldon: '🐢', zip: '🦎', piggy: '🐷', leo: '🦭', kitty: '🐱', snappy: '🐊',
  mayor: '🍃', bun: '🧁', bolt: '🔨', rio: '🦜', tuki: '🐦', flora: '🦩', hum: '🐦', pavo: '🦚', banjo: '🐒', slo: '🦥', ribbit: '🐸', kami: '🦎', zaza: '🐒' };
// Island friends above the waves: [island, spot name, kind, model maker, how they move].
const ISLANDERS = {
  polly: ['pirate', 'captain', 'parrot', () => parrotModel(0x3fd14f, 0xffd23f, { hat: true })],
  kitty: ['pirate', 'kitty', 'kitten'], coco: ['pirate', 'coco', 'coconutCrab'], gully: ['pirate', 'gully', 'seagull'],
  pelly: ['pirate', 'pelly', 'pelican'], billy: ['pirate', 'billy', 'goat'], batty: ['pirate', 'batty', 'bat', null, 'hang'],
  boo: ['pirate', 'boo', 'ghost', null, 'float'], shelldon: ['pirate', 'shelldon', 'tortoise'], zip: ['pirate', 'zip', 'gecko'],
  piggy: ['pirate', 'piggy', 'piglet'], leo: ['pirate', 'leo', 'seaLion'], snappy: ['pirate', 'snappy', 'crocodile'],
  mayor: ['paradise', 'mayor', 'leafkin', () => leafkinModel(0xffe08a, 'flower')],
  bun: ['paradise', 'baker', 'leafkin', () => leafkinModel(0xffb8d0, 'mushroom')],
  bolt: ['paradise', 'builder', 'leafkin', () => leafkinModel(0xd8b080, 'acorn')],
  rio: ['paradise', 'rio', 'macaw'], tuki: ['paradise', 'tuki', 'toucan'], flora: ['paradise', 'flora', 'flamingo'],
  hum: ['paradise', 'hum', 'hummingbird', null, 'float'], pavo: ['paradise', 'pavo', 'peacock'], banjo: ['paradise', 'banjo', 'monkey'],
  slo: ['paradise', 'slo', 'sloth'], ribbit: ['paradise', 'ribbit', 'frog'], kami: ['paradise', 'kami', 'chameleon'], zaza: ['paradise', 'zaza', 'lemur'],
};
// Animals wandering each part of the islands (kinds cycle over the spots).
const WILD = {
  pirate: { beach: ['coconutCrab', 'seagull', 'tortoise', 'pelican'], forest: ['gecko', 'butterfly', 'piglet', 'parrot', 'firefly'],
    cliffs: ['goat', 'seagull'], grotto: ['bat', 'firefly'], river: ['frog', 'crocodile'] },
  paradise: { beach: ['flamingo', 'coconutCrab', 'seagull'], jungle: ['monkey', 'lemur', 'chameleon', 'frog', 'butterfly'],
    canopy: ['macaw', 'toucan', 'parrot', 'hummingbird'], meadow: ['butterfly', 'hummingbird', 'peacock'], city: ['leafkin'] },
};
const FLYERS = ['seagull', 'pelican', 'parrot', 'macaw', 'toucan'], FLOATERS = ['butterfly', 'firefly', 'hummingbird', 'ghost', 'bat'],
  HOPPERS = ['frog', 'piglet', 'kitten', 'leafkin'];
const CHIBI = [[0xffb8d0, 'mushroom'], [0x9fe0ff, 'flower'], [0xffe08a, 'leaf'], [0xc8a0ff, 'acorn'], [0xa8f0a0, 'flower'], [0xffc890, 'mushroom']];
const CHAIN_IDS = Object.keys(CHAINS);

function starTexture(fill = '#ffe066', halo = ['rgba(255,250,200,0.9)', 'rgba(255,220,120,0)']) {
  return canvasTexture(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, halo[0]); grd.addColorStop(1, halo[1]);
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    g.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 18 : 44;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.fillStyle = fill; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#fff'; g.stroke();
  });
}
function heartTexture() {
  return canvasTexture(64, 64, (g) => {
    g.font = '48px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('💖', 32, 36);
  });
}

class Bursts {
  constructor(scene) {
    this.pool = [];
    this.mats = {
      spark: new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
      heart: new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false, fog: false }),
    };
    for (let i = 0; i < 80; i++) {
      const s = new THREE.Sprite(this.mats.spark.clone());
      s.visible = false; s.userData = { v: new THREE.Vector3(), life: 0, max: 1 };
      scene.add(s); this.pool.push(s);
    }
  }
  emit(pos, n = 16, kind = 'spark', color = 0xfff0a0, speed = 4) {
    for (let k = 0; k < n; k++) {
      const s = this.pool.find((p) => !p.visible);
      if (!s) return;
      s.material.map = this.mats[kind].map;
      s.material.blending = kind === 'heart' ? THREE.NormalBlending : THREE.AdditiveBlending;
      s.material.color.set(kind === 'heart' ? 0xffffff : color);
      s.visible = true; s.position.copy(pos);
      s.userData.v.randomDirection().multiplyScalar(rr(0.4, 1) * speed); s.userData.v.y = Math.abs(s.userData.v.y) + 1;
      s.userData.life = s.userData.max = rr(0.9, 1.6);
      s.scale.setScalar(kind === 'heart' ? 0.9 : 1.2);
    }
  }
  update(dt) {
    for (const s of this.pool) {
      if (!s.visible) continue;
      const u = s.userData;
      u.life -= dt;
      if (u.life <= 0) { s.visible = false; continue; }
      s.position.addScaledVector(u.v, dt);
      u.v.multiplyScalar(1 - dt * 1.5);
      s.material.opacity = Math.min(1, u.life / u.max * 2);
    }
  }
}

function clamModel() {
  const g = new THREE.Group();
  const m = paintMat({ color: 0xf2c6ff, emissive: 0x302040, side: THREE.DoubleSide });
  const shellGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = shellGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.08 * Math.cos(a * 9); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  shellGeo.computeVertexNormals();
  const bottom = new THREE.Mesh(shellGeo, m); bottom.scale.set(1, 0.4, 1); bottom.rotation.x = Math.PI;
  const lid = new THREE.Group(); lid.position.z = -1;
  const top = new THREE.Mesh(shellGeo, m); top.scale.set(1, 0.4, 1); top.position.z = 1;
  lid.add(top);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xc8c0ff }));
  pearl.position.y = 0.3;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xe8e0ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(3.5); glow.position.y = 0.3;
  g.add(bottom, lid, pearl, glow);
  g.userData = { lid, pearl, glow };
  return g;
}

function babyItemModel(item) {
  const g = new THREE.Group();
  const glowCol = { grape: 0xd59bff, toy: 0xffc0a0, ring: 0xbff0ff, star: 0xffe680, coin: 0xffe066, pepper: 0xff9a4a, shell: 0xffc8f8 }[item];
  if (item === 'grape') {
    const m = paintMat({ color: 0x9a5bdc, emissive: 0x3a1a60 });
    [[0, 0.5, 0], [-0.25, 0.25, 0.1], [0.25, 0.25, 0.1], [0, 0.25, -0.2], [-0.12, 0, 0], [0.12, 0, 0.05], [0, -0.22, 0]]
      .forEach(([x, y, z]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), m); b.position.set(x, y, z); g.add(b); });
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), paintMat({ color: 0x5fcf6a, emissive: 0x103010 }));
    leaf.scale.set(1.4, 0.3, 0.7); leaf.position.set(0.15, 0.75, 0); g.add(leaf);
  } else if (item === 'toy') {
    const shellGeo = new THREE.ConeGeometry(0.35, 0.9, 12, 6);
    const sp = shellGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) { const y = sp.getY(i); const k = 1 + 0.15 * Math.sin(y * 18); sp.setX(i, sp.getX(i) * k); sp.setZ(i, sp.getZ(i) * k); }
    shellGeo.computeVertexNormals();
    const shell = new THREE.Mesh(shellGeo, paintMat({ color: 0xffa0b8, emissive: 0x502030 }));
    shell.rotation.z = 0.5; g.add(shell);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), paintMat({ color: 0xfff08a, emissive: 0x504010 }));
    ball.position.set(0.35, -0.3, 0.1); g.add(ball);
  } else if (item === 'ring') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 8, 24), paintMat({ color: 0xc8f4ff, emissive: 0x4a90b0 }));
    g.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), paintMat({ color: 0xffffff, emissive: 0x6090b0 }));
      b.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0.15); g.add(b);
    }
  } else if (item === 'coin') {
    const gold = paintMat({ color: 0xffd23f, emissive: 0x7a5410 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20), gold);
    coin.rotation.x = Math.PI / 2; g.add(coin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 6, 20), gold); g.add(rim);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), paintMat({ color: 0xfff4b0, emissive: 0x8a7020 }));
    star.scale.set(1, 1, 0.4); g.add(star);
  } else if (item === 'pepper') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1, 6), paintMat({ color: 0x5fcf6a, emissive: 0x104010 }));
    stem.position.y = -0.4; g.add(stem);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), paintMat({ color: 0xff8a3a, emissive: 0x7a3010 }));
      petal.scale.set(1, 0.4, 0.6); petal.position.set(Math.cos(a) * 0.32, 0.15, Math.sin(a) * 0.32); petal.rotation.y = -a; g.add(petal);
    }
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), paintMat({ color: 0xffe066, emissive: 0x8a6a10 }));
    heart.position.y = 0.2; g.add(heart);
  } else if (item === 'shell') {
    const geo = new THREE.LatheGeometry(Array.from({ length: 21 }, (_, i) => { const t = i / 20; return new THREE.Vector2(Math.max(0.02, 0.6 * Math.pow(1 - t, 0.9) * (0.85 + 0.15 * Math.cos(t * 26))), t * 1.4); }), 14);
    const p = geo.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) { const c = new THREE.Color().setHSL((p.getY(i) * 0.5 + 0.8) % 1, 0.7, 0.75); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const sh = new THREE.Mesh(geo, paintMat({ vertexColors: true, emissive: 0x403040 }));
    sh.rotation.z = 1.1; sh.position.set(-0.4, -0.3, 0); g.add(sh);
  } else {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.25 : 0.6; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    geo.center();
    g.add(new THREE.Mesh(geo, paintMat({ color: 0xffe066, emissive: 0x806010 })));
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: glowCol, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(item === 'ring' ? 6 : 3); g.add(glow);
  g.userData.glow = glow;
  return g;
}

export class Story {
  constructor(scene, ctx) {
    this.scene = scene;
    this.ctx = ctx; // { player, city, creatures, ui, save }
    this.state = ctx.save.state;
    this.tracked = 'main'; // which quest the sparkle trail follows
    this.sideShown = null; // which side quest the side panel shows
    this.npcs = [];
    this.bursts = new Bursts(scene);
    this.dialog = null;
    this.near = null;
    this.greeted = new Set();
    this.buildNPCs();
    this.buildPearls();
    this.buildCrystals();
    this.buildBabies();
    this.buildChains();
    if (this.state.portal) ctx.bay?.setPortal(true);
    this.buildGuide();
    this.applyRewards();
    this.refreshQuest();
  }

  get stage() { return this.state.stage; }
  setStage(s) { this.state.stage = s; this.ctx.save.write(); this.refreshQuest(true); }

  addNPC(id, model, pos, face = true) {
    const root = model.root || model;
    root.position.copy(pos);
    this.scene.add(root);
    const npc = { id, model, root, home: pos.clone(), face, t: Math.random() * 10 };
    this.npcs.push(npc);
    return npc;
  }

  buildNPCs() {
    const S = this.ctx.city.spots;
    const st = WORLD.start;
    this.addNPC('marina', new MerModel(PALETTES.marina), new THREE.Vector3(st.x + 4, st.y - 1, st.z - 9));
    const queen = this.addNPC('queen', new MerModel(PALETTES.queen), S.queen);
    queen.root.scale.setScalar(1.3);
    S.guards.forEach((p) => this.addNPC('guard', new MerModel(PALETTES.guard), p));
    this.addNPC('coral', new MerModel(PALETTES.coral), S.citizens[0]);
    this.addNPC('pearl', new MerModel(PALETTES.pearl), S.citizens[3]);
    // swimming citizens without dialogue
    this.addNPC('citizen', new MerModel(PALETTES.pearl), S.citizens[1]).line = 'citizen1';
    this.addNPC('citizen', new MerModel(PALETTES.marina), S.citizens[2]).line = 'citizen2';
    for (const r of S.residents) {
      const m = new MerModel(PALETTES[r.color]);
      if (r.id === 'fairy') m.setHeadwear('pearlTiara');
      if (r.id === 'bard') m.setHeadwear('coralClip');
      this.addNPC(r.id, m, r.pos);
    }
    const seen = {};
    for (const a of S.activities) {
      // the reading mermaid sits beside the Shell Librarian, not on top of her
      const n = this.addNPC('activity', new MerModel(PALETTES[a.color]), a.kind === 'library' ? a.pos.clone().add(new THREE.Vector3(7, 0, 3)) : a.pos, false);
      n.activity = a.kind;
      const k = seen[a.kind] = (seen[a.kind] || 0) + 1; // each one says something different
      n.line = a.kind + (a.kind === 'market' ? ((k - 1) % 3) + 1 : a.kind === 'court' ? ((k - 1) % 2) + 1 : '');
    }
    S.seahorses.forEach((p, i) => {
      const n = this.addNPC('ambientSeahorse', { root: seahorseModel(i ? 0xffc784 : 0x9be6ff, 1.6) }, p, false);
      n.friendKind = 'seahorse'; n.line = 'seahorse' + ((i % 2) + 1);
    });
    const mamaPos = S.garden;
    this.mama = this.addNPC('mama', { root: seahorseModel(0xff9fcf, 2.2) }, mamaPos);
    const kp = WORLD.kelpPos;
    this.baby = this.addNPC('baby', { root: seahorseModel(0xffd0ea, 0.9) }, new THREE.Vector3(kp.x + 10, groundHeight(kp.x + 10, kp.z - 15) + 4, kp.z - 15));
    const T = WORLD.trenchPos;
    const sx = T.x - 25, sz = T.z - 55;
    const shellyModel = turtleModel(); shellyModel.scale.setScalar(1.6);
    this.shelly = this.addNPC('shelly', { root: shellyModel }, new THREE.Vector3(sx, groundHeight(sx, sz) + 5, sz));
    // every animal counts for the album, wherever it lives
    this.mama.friendKind = this.baby.friendKind = 'seahorse';
    this.shelly.friendKind = 'turtle';
  }

  // Baby animals with their own little missions, and the things they ask for.
  buildBabies() {
    const gh = (x, z, up) => new THREE.Vector3(x, groundHeight(x, z) + up, z);
    const K = WORLD.kelpPos, R = WORLD.reefPos, T = WORLD.trenchPos, st = WORLD.start;
    const tico = turtleModel(); tico.scale.setScalar(0.55);
    const pip = octopusModel(0xff9fd0); pip.scale.setScalar(0.6);
    const splash = dolphinModel(); splash.scale.setScalar(0.7);
    const momo = whaleModel(); momo.scale.setScalar(0.22);
    const where = {
      tico: [tico, gh(K.x + 22, K.z + 12, 3), [gh(K.x - 8, K.z + 2, 2.6), gh(K.x + 6, K.z - 22, 2.6), gh(K.x - 25, K.z - 10, 2.6)]],
      pip: [pip, gh(R.x - 12, R.z + 14, 0.6), [gh(R.x + 8, R.z + 4, 2.4), gh(R.x - 4, R.z - 14, 2.4), gh(R.x + 18, R.z - 6, 2.4), gh(R.x - 20, R.z + 2, 2.4)]],
      splash: [splash, new THREE.Vector3(st.x - 10, st.y - 4, st.z - 4), [0, 1, 2, 3].map((i) => new THREE.Vector3(st.x - 20 - i * 9, st.y - 6 + Math.sin(i) * 3, st.z - 18 - i * 6))],
      momo: [momo, gh(T.x - 35, T.z - 30, 8), [gh(T.x - 5, T.z + 5, 2), gh(T.x + 20, T.z - 15, 2), gh(T.x - 22, T.z + 18, 2)]],
    };
    // the sea folk of Shipwreck Bay
    const B = this.ctx.bay?.spots;
    if (B) {
      const big = (m, s) => { m.scale.setScalar(s); return m; };
      where.pinch = [big(costumeCrab(0xff5a4d, 'pirate'), 1.8), B.pinch, B.coins];
      where.rosa = [big(lobsterModel(0xff5a3c, true), 1.7), B.rosa, B.pepper];
      where.shellby = [big(hermitCrabModel(0xffb3d1), 1.9), B.shellby, B.shells];
      this.addNPC('whelk', { root: big(snailModel(0xb88cff, true), 1.8) }, B.whelk).friendKind = 'snail';
      this.addNPC('clawsworth', { root: big(costumeCrab(0x6fa8ff, 'knight'), 1.7) }, B.clawsworth).friendKind = 'crab';
      this.addNPC('selkie', { root: big(sealModel(), 1.4) }, B.selkie).friendKind = 'seal';
      this.addNPC('madamePearl', { root: big(oysterModel(), 1.3) }, B.madamePearl).friendKind = 'oyster';
      for (const id of ['madamePearl', 'clawsworth', 'selkie']) this.npcs.find((n) => n.id === id).noSpin = true;
    }
    this.state.sideItems ||= {};
    this.babyItems = {};
    for (const [id, [model, pos, spots]] of Object.entries(where)) {
      const n = this.addNPC(id, { root: model }, pos);
      n.friendKind = BABIES[id].kind;
      const got = this.state.sideItems[id] || [];
      this.babyItems[id] = spots.map((p, i) => {
        const g = babyItemModel(BABIES[id].item);
        collide(p, 1.6); // never inside a rock or coral, so it can always be reached
        g.position.copy(p);
        if (BABIES[id].item === 'ring') g.lookAt(p.clone().add(new THREE.Vector3(1, 0, 0.6)));
        this.scene.add(g);
        return { i, g, got: got.includes(i) };
      });
    }
  }

  // Chain quests: new friends in every area, each with three little jobs in a row.
  buildChains() {
    const gh = (x, z, up) => new THREE.Vector3(x, groundHeight(x, z) + up, z);
    const C = WORLD.cityPos, cityY = groundHeight(C.x, C.z);
    const W = {
      gh, bay: this.ctx.bay,
      city: (x, y, z) => new THREE.Vector3(C.x + x, cityY + y, C.z + z),
      around: (cx, cz, r, n, up, seed) => Array.from({ length: n }, (_, i) => {
        const a = seed * 1.7 + (i / n) * Math.PI * 2, rad = r * (0.75 + 0.25 * Math.sin(seed + i * 2.3));
        return gh(cx + Math.cos(a) * rad, cz + Math.sin(a) * rad, up);
      }),
    };
    const I = this.ctx.islands || {};
    if (I.pirate) W.pi = I.pirate.spots;
    if (I.paradise) W.pa = I.paradise.spots;
    this.buildIslanders();
    this.islandProgress();
    const big = (m, sc) => { m.scale.setScalar(sc); return m; };
    const givers = [
      ['granny', seahorseModel(0xc8a0ff, 2.4), gh(-115, 35, 4), 'seahorse'],
      ['inky', big(octopusModel(0x4fd0c0), 1.0), gh(-150, 0, 3), 'octopus'],
      ['sandy', big(crabModel(0xff9a3c), 1.6), gh(122, 60, 0.8), 'crab'],
      ['puffy', big(pufferModel(), 1.4), gh(125, 30, 4), 'puffer'],
      ['glim', big(anglerfishModel(0x5f8fd0), 1.5), gh(40, 160, 6), 'anglerfish'],
      ['luna', big(jellyModel(0xbfa8ff), 1.6), gh(80, 185, 10), 'jellyfish'],
      ['bubbles', big(dolphinModel(), 1.0), new THREE.Vector3(15, 24, 50), 'dolphin'],
      ['ottie', big(otterModel(), 1.2), new THREE.Vector3(-15, WORLD.surfaceY - 1.2, 55), 'otter'],
    ];
    for (const [id, model, pos, kind] of givers) {
      const n = this.addNPC(id, { root: model }, pos);
      n.friendKind = kind; n.noSpin = true;
    }
    this.state.chainStep ||= {};
    this.chainItems = {}; // "chain:step" -> [{ i, g, got }]
    this.chainBeacons = {}; // "chain:step" -> beacon
    for (const [id, c] of Object.entries(CHAINS)) {
      if (!this.chainOn(id)) continue;
      const parent = this.ctx.islands?.[c.area]?.group || this.scene;
      c.steps.forEach((st, k) => {
        const key = `${id}:${k}`;
        if (st.type === 'collect') {
          const got = this.state.sideItems[key] || [];
          this.chainItems[key] = st.where(W).map((p, i) => {
            collide(p, 1.6);
            const g = chainItemModel(st.item);
            g.position.copy(p); g.visible = false;
            parent.add(g);
            return { i, g, got: got.includes(i) };
          });
          st.count = this.chainItems[key].length;
        } else if (st.type === 'visit') {
          const b = beaconModel(c.color);
          b.position.copy(st.where(W)); b.visible = false;
          parent.add(b);
          this.chainBeacons[key] = b;
        }
      });
    }
  }

  chainOn(id) {
    const a = CHAINS[id].area;
    return a === 'bay' ? !!this.ctx.bay : a === 'pirate' || a === 'paradise' ? !!this.ctx.islands?.[a] : true;
  }

  // Things the islanders build as you help: Bolt's bridge gets its planks.
  islandProgress() {
    const q = this.state.sideQuests || {};
    if (q.bridge === 'done' || (this.state.chainStep?.bridge || 0) >= 1) this.ctx.islands?.paradise?.finishBridge?.();
  }

  // The island friends (quest givers and chatters) and the wild animals around them.
  buildIslanders() {
    const I = this.ctx.islands;
    this.landFolk = [];
    if (!I) return;
    for (const [id, [isl, spot, kind, make, how]] of Object.entries(ISLANDERS)) {
      const island = I[isl], at = island?.spots.npc[spot];
      if (!at) continue;
      const model = make ? make() : LAND_KINDS[kind](), sc = LAND_SCALE[kind] * 1.5;
      const folk = how === 'float' ? new Floater(island.group, kind, model, sc, { c: at, r: 0.5, speed: 0.6 })
        : new Percher(island.group, kind, model, sc, { at: how === 'hang' ? at.clone() : at.clone().setY(island.floor(at.x, at.z, at.y + 1)), hang: how === 'hang' });
      const n = this.addNPC(id, { root: folk.root, update: (dt) => folk.update(dt) }, folk.root.position.clone());
      island.group.add(folk.root);
      n.friendKind = kind; n.folk = folk;
    }
    for (const [isl, places] of Object.entries(WILD)) {
      const island = I[isl];
      if (!island) continue;
      for (const [place, kinds] of Object.entries(places)) {
        (island.spots.wild[place] || []).forEach((p, i) => {
          const kind = kinds[i % kinds.length];
          let model = LAND_KINDS[kind]();
          if (kind === 'leafkin') { const [c, hat] = CHIBI[i % CHIBI.length]; model = leafkinModel(c, hat); }
          const sc = LAND_SCALE[kind];
          const floor = (x, z) => island.floor(x, z, p.y + 1);
          const ground = p.clone().setY(floor(p.x, p.z));
          const folk = FLYERS.includes(kind) ? new Flyer(island.group, kind, model, sc, { c: p, r: 6 + (i % 3) * 3, h: p.y + 6 + (i % 4) * 2, dir: i % 2 ? 1 : -1, friendRadius: 9 })
            : FLOATERS.includes(kind) ? new Floater(island.group, kind, model, sc, { c: p, r: 2, h: p.y + 0.5 })
              : HOPPERS.includes(kind) ? new Hopper(island.group, kind, model, sc, { home: ground, range: place === 'city' ? 1.2 : 3, floor })
                : new Walker(island.group, kind, model, sc, { home: ground, range: 3, floor });
          folk.island = island;
          this.landFolk.push(folk);
          this.ctx.creatures.all.push(folk);
        });
      }
    }
  }
  chainStepOf(id) { return CHAINS[id].steps[this.state.chainStep[id] || 0]; }

  // Talking to a chain giver: start, hint, next step, or the final treasure.
  chainTalk(id) {
    const q = this.state.sideQuests, c = CHAINS[id], g = c.giver;
    const k = this.state.chainStep[id] || 0;
    if (!q[id]) {
      q[id] = 'active'; this.state.chainStep[id] = 0; this.state.sideItems[`${id}:0`] = [];
      this.ctx.save.write(); this.tracked = this.sideShown = id; this.refreshSideQuest();
      return [[g, `${id}1Quest`]];
    }
    if (q[id] === 'ready') {
      if (k < c.steps.length - 1) {
        this.state.chainStep[id] = k + 1; q[id] = 'active';
        this.islandProgress();
        this.ctx.save.write(); this.tracked = this.sideShown = id; this.refreshSideQuest();
        this.bursts.emit(this.ctx.player.position.clone(), 14, 'spark', c.color, 4);
        const done = `${id}${k + 1}Done`; // a delivery already had its thank-you
        return [...(t('talk.' + done) !== 'talk.' + done ? [[g, done]] : []), [g, `${id}${k + 2}Quest`]];
      }
      q[id] = 'done';
      this.unlockCosmetic(...c.reward);
      this.celebrate(this.ctx.player.position);
      this.refreshQuest();
      return [[g, `${id}${k + 1}Done`]];
    }
    if (q[id] === 'done') return [[g, `${id}After`]];
    return [[g, 'chainHint', { goal: this.sideText(id) }]];
  }

  // Someone a chain quest asked you to visit: they answer, and the step is done.
  chainDeliveries(npcId) {
    const lines = [];
    const q = this.state.sideQuests || {};
    for (const id of CHAIN_IDS) {
      if (q[id] !== 'active' || !this.chainOn(id)) continue;
      const st = this.chainStepOf(id);
      if (st.type !== 'deliver' || st.to !== npcId) continue;
      const k = this.state.chainStep[id] || 0;
      lines.push([npcId, `${id}${k + 1}Deliver`]);
      this.chainReady(id);
    }
    return lines.length ? lines : null;
  }
  chainReady(id) {
    const sq = this.state.sideQuests;
    if (sq[id] !== 'active') return;
    sq[id] = 'ready'; this.ctx.save.write(); this.refreshSideQuest();
    this.ctx.ui.toast(t('side.chainReturn', { name: t('npc.' + CHAINS[id].giver) }));
  }

  buildPearls() {
    const spots = [
      [WORLD.reefPos.x + 12, WORLD.reefPos.z - 8], [WORLD.kelpPos.x - 20, WORLD.kelpPos.z + 25], [72, 42],
      [-40, -60], [30, 110],
    ];
    this.pearls = spots.map(([x, z], i) => {
      const g = clamModel();
      g.position.set(x, groundHeight(x, z) + 0.4, z);
      g.rotation.y = rr(0, 6);
      g.scale.setScalar(1.3);
      this.scene.add(g);
      const got = this.state.pearls.includes(i);
      if (got) { g.userData.pearl.visible = false; g.userData.glow.visible = false; }
      return { i, g, got };
    });
  }

  buildCrystals() {
    const T = WORLD.trenchPos;
    const spots = [[T.x - 15, T.z - 5], [T.x + 12, T.z + 14], [T.x + 4, T.z - 22]];
    const geo = new THREE.OctahedronGeometry(1.6, 0); geo.scale(1, 2.4, 1);
    this.crystals = spots.map(([x, z], i) => {
      const lit = this.state.crystals.includes(i);
      const m = new THREE.MeshLambertMaterial({ color: 0x8fa0c8, emissive: lit ? 0x6fd8ff : 0x1a2340, flatShading: true });
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, groundHeight(x, z) + 3.5, z);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x8fe3ff, transparent: true, opacity: lit ? 0.9 : 0.15, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      glow.scale.setScalar(14); mesh.add(glow);
      this.scene.add(mesh);
      return { i, mesh, glow, lit };
    });
  }

  buildGuide() {
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthTest: false, depthWrite: false, fog: false }));
    this.marker.renderOrder = 20;
    this.scene.add(this.marker);
    this.trail = [];
    const m = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff3a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(m.clone()); s.scale.setScalar(0.7); this.scene.add(s); this.trail.push(s); }
    // a blue star floats over everyone who has a quest to give (or a reward waiting)
    const blue = new THREE.SpriteMaterial({ map: starTexture('#5fb4ff', ['rgba(200,235,255,0.9)', 'rgba(120,190,255,0)']), transparent: true, depthWrite: false, fog: false });
    this.giverStars = this.npcs.filter((n) => SIDE_IDS.includes(n.id) || CHAIN_BY_GIVER[n.id]).map((n) => {
      const s = new THREE.Sprite(blue);
      s.renderOrder = 19; s.scale.setScalar(2.2);
      const box = new THREE.Box3().setFromObject(n.root);
      this.scene.add(s);
      return { n, s, qid: SIDE_IDS.includes(n.id) ? n.id : CHAIN_BY_GIVER[n.id], h: box.max.y - n.root.position.y + 1.1 };
    });
  }

  updateGiverStars() {
    const q = this.state.sideQuests || {};
    for (const g of this.giverStars || []) g.s.visible = !q[g.qid] || q[g.qid] === 'ready';
  }

  applyRewards() {
    const pm = this.ctx.player.model;
    if (this.state.crown && !this.state.unlocked.includes('crown')) {
      this.state.unlocked.push('crown'); this.state.outfit.head = 'crown';
    }
    if (this.state.rainbow && !this.state.unlocked.includes('rainbow')) {
      this.state.unlocked.push('rainbow'); this.state.outfit.tail = 'rainbow';
    }
    pm.setOutfit(this.state.outfit);
  }

  unlockCosmetic(item, category) {
    if (!this.state.unlocked.includes(item)) this.state.unlocked.push(item);
    this.state.outfit[category] = item;
    this.ctx.player.model.setOutfit(this.state.outfit);
    this.ctx.save.write();
    this.ctx.ui.toast(`${t('wardrobe.' + item)} ✨`);
  }

  target() {
    const p = this.ctx.player.position;
    const nearestOf = (arr) => arr.reduce((b, x) => (!b || x.d < b.d ? x : b), null);
    switch (this.stage) {
      case 'meet': case 'backQueen': case 'finale': return this.npcs.find((n) => n.id === 'queen').root.position;
      case 'pearls': {
        const left = this.pearls.filter((x) => !x.got).map((x) => ({ x, d: x.g.position.distanceTo(p) }));
        const n = nearestOf(left); return n ? n.x.g.position : null;
      }
      case 'baby': return this.baby.root.position;
      case 'bringBaby': return this.mama.root.position;
      case 'whale': return this.ctx.creatures.list.find((c) => c.kind === 'whale').root.position;
      case 'shelly': return this.shelly.root.position;
      case 'crystals': {
        const left = this.crystals.filter((x) => !x.lit).map((x) => ({ x, d: x.mesh.position.distanceTo(p) }));
        const n = nearestOf(left); return n ? n.x.mesh.position : null;
      }
      default: return null;
    }
  }

  refreshQuest(pulse = false) {
    const s = this.stage;
    const txt = s === 'pearls' ? t('q.pearls', { n: this.state.pearls.length }) : s === 'crystals' ? t('q.crystals', { n: this.state.crystals.length }) : s === 'shelly' ? t('q.crystals', { n: 0 }) : t('q.' + s);
    this.ctx.ui.setQuest(txt, pulse);
    this.ctx.ui.setCounts(this.state.pearls.length, this.state.friends.length, Object.values(this.state.sideQuests || {}).filter((v) => v === 'done').length);
    this.refreshSideQuest();
  }

  // Side quests in progress, each with its own goal text and trail colour.
  sideList() {
    const q = this.state.sideQuests || {};
    return [...SIDE_IDS, ...CHAIN_IDS.filter((id) => this.chainOn(id))].filter((id) => q[id] === 'active' || q[id] === 'ready')
      .map((id) => ({ id, text: this.sideText(id), color: TRAIL_COLORS[id], icon: FACES[CHAINS[id]?.giver || id] }))
      .concat(this.giverTarget ? [{ id: 'giver', text: this.sideText('giver'), color: TRAIL_COLORS.giver, icon: FACES[this.giverTarget.n.id] || '🧭' }] : []);
  }
  // The compass button: lead the way to the nearest friend whose quest has not started yet
  // (tap again for the next nearest one).
  findGiver() {
    const q = this.state.sideQuests || {}, P = this.ctx.player.position;
    const todo = (this.giverStars || []).filter((g) => !q[g.qid] && (!CHAINS[g.qid] || this.chainOn(g.qid)))
      .sort((a, b) => a.n.root.position.distanceTo(P) - b.n.root.position.distanceTo(P));
    if (!todo.length) { this.giverTarget = null; this.refreshSideQuest(); this.ctx.ui.toast(t('side.allMet')); return; }
    const next = this.tracked === 'giver' && this.giverTarget ? (todo.indexOf(this.giverTarget) + 1) % todo.length : 0;
    this.giverTarget = todo[next];
    this.tracked = 'giver';
    this.refreshSideQuest();
    this.ctx.ui.toast(this.sideText('giver'));
  }
  sideText(id) {
    const q = this.state.sideQuests || {};
    if (id === 'giver') return t('side.goMeet', { name: t('npc.' + this.giverTarget.n.id) });
    if (CHAINS[id]) {
      if (q[id] === 'ready') return t('side.chainReturn', { name: t('npc.' + CHAINS[id].giver) });
      const k = this.state.chainStep[id] || 0, st = CHAINS[id].steps[k];
      const goal = t(`side.${id}${k + 1}`);
      return st.type === 'collect' ? `${goal} ${(this.state.sideItems[`${id}:${k}`] || []).length}/${st.count}` : goal;
    }
    return t('side.' + id + (q[id] === 'ready' ? 'Return' : 'Goal'), { n: (this.state.sideItems?.[id] || []).length });
  }

  refreshSideQuest() {
    if (this.giverTarget && this.state.sideQuests?.[this.giverTarget.qid]) this.giverTarget = null; // met them: their quest is on
    const list = this.sideList();
    if (this.tracked !== 'main' && !list.some((x) => x.id === this.tracked)) this.tracked = 'main';
    if (!list.some((x) => x.id === this.sideShown)) this.sideShown = list[0]?.id || null;
    if (this.tracked === 'main' && !this.target() && list.length) this.tracked = this.sideShown; // main story done: follow a side quest
    this.ctx.ui.setSideQuests(list, this.tracked, this.sideShown);
    this.updateGiverStars?.();
  }

  // Which quest the sparkle trail follows: 'main' or a side quest id (tap a quest to switch).
  track(id) {
    this.tracked = id === 'main' || this.sideList().some((x) => x.id === id) ? id : 'main';
    if (this.tracked !== 'main') this.sideShown = this.tracked;
    this.refreshSideQuest();
  }

  sideTarget(id) {
    const q = this.state.sideQuests, S = this.ctx.city.spots;
    if (q[id] === 'active' && BABIES[id]) {
      const P = this.ctx.player.position;
      const left = this.babyItems[id].filter((x) => !x.got).sort((a, b) => a.g.position.distanceTo(P) - b.g.position.distanceTo(P));
      return left[0]?.g.position || null;
    }
    if (id === 'giver') return this.giverTarget?.n.root.position || null;
    if (CHAINS[id]) {
      const npcPos = (nid) => this.npcs.find((n) => n.id === nid)?.root.position || null;
      if (q[id] === 'ready') return npcPos(CHAINS[id].giver);
      if (q[id] !== 'active') return null;
      const k = this.state.chainStep[id] || 0, st = CHAINS[id].steps[k];
      if (st.type === 'deliver') return npcPos(st.to);
      if (st.type === 'visit') return this.chainBeacons[`${id}:${k}`].position;
      const P = this.ctx.player.position;
      const left = this.chainItems[`${id}:${k}`].filter((x) => !x.got).sort((a, b) => a.g.position.distanceTo(P) - b.g.position.distanceTo(P));
      return left[0]?.g.position || null;
    }
    if (q[id] === 'active' && id === 'whelk') return this.ctx.bay.bayHouse.center.clone().add(new THREE.Vector3(0, 3, 0));
    if (q[id] === 'active') return { tailor: S.fountain, keeper: S.bridgeWest, bard: S.bridgeEast }[id] || null;
    if (q[id] === 'ready') return this.npcs.find((n) => n.id === id)?.root.position || null;
    return null;
  }

  sideQuest(id) {
    const q = this.state.sideQuests;
    if (!q[id]) {
      q[id] = 'active'; this.ctx.save.write(); this.tracked = this.sideShown = id; this.refreshSideQuest();
      return [[id, id + 'Quest']];
    }
    if (q[id] === 'ready') {
      q[id] = 'done';
      const rewards = BABIES[id]?.rewards || [{ tailor: ['coralClip', 'head'], keeper: ['seaGlass', 'top'], bard: ['sapphire', 'tail'] }[id]];
      for (const r of rewards) this.unlockCosmetic(...r);
      this.celebrate(this.ctx.player.position);
      this.refreshSideQuest();
      return [[id, id + 'Gift']];
    }
    return [[id, id + (q[id] === 'done' ? 'After' : 'Hint')]];
  }

  // Lines an NPC says right now (array of [speakerId, key]); may advance the story.
  talk(npc) {
    const s = this.stage, id = npc.id;
    const L = (...keys) => keys.map((k) => [id, k]);
    const delivered = this.chainDeliveries(id);
    if (delivered) return delivered;
    if (CHAIN_BY_GIVER[id] && this.chainOn(CHAIN_BY_GIVER[id])) return this.chainTalk(CHAIN_BY_GIVER[id]);
    if (id === 'marina') return s === 'meet' ? L('marina1', 'marina2') : L('marina2');
    if (id === 'guard') return L('guard');
    if (npc.line) return [[id, npc.line]];
    if (id === 'coral') return L('coral');
    if (id === 'pearl') return L('pearl');
    if (['tailor', 'keeper', 'bard'].includes(id) || BABIES[id]) return this.sideQuest(id);
    if (id === 'whelk') return this.whelkTalk();
    if (CHATTERS[id]) {
      npc.chat = ((npc.chat ?? -1) + 1) % CHATTERS[id];
      if (id === 'madamePearl') return L(this.state.portal ? 'madamePearlOn' : 'madamePearlOff', 'madamePearl' + (npc.chat + 1));
      return L(id + (npc.chat + 1));
    }
    if (['baker', 'librarian', 'fairy'].includes(id)) return L(id);
    if (id === 'queen') {
      if (s === 'meet') { this.setStage('pearls'); return L('queen1', 'queen2'); }
      if (s === 'backQueen') {
        this.state.crown = true; this.unlockCosmetic('crown', 'head');
        this.celebrate(this.ctx.player.position);
        this.setStage('baby');
        return L('queenPearls', 'queenBaby');
      }
      if (s === 'finale') {
        this.state.rainbow = true; this.unlockCosmetic('rainbow', 'tail');
        this.celebrate(this.ctx.player.position, true);
        this.setStage('free');
        return L('queenFinal', 'tailGift', 'free');
      }
      if (s === 'pearls') return L('queen2');
      if (s === 'free') return L('free');
      return L('queenWait');
    }
    if (id === 'baby' && s === 'baby') { this.setStage('bringBaby'); this.babyFollow = true; return L('baby'); }
    if (id === 'baby') return L(s === 'bringBaby' ? 'babyFollow' : STAGES.indexOf(s) > STAGES.indexOf('bringBaby') ? 'babyHome' : 'babyHide');
    if (id === 'mama') {
      if (s === 'bringBaby') { this.babyFollow = false; this.babyHome = true; this.celebrate(npc.root.position); this.setStage('whale'); return L('mama', 'mamaNext'); }
      return L(STAGES.indexOf(s) > STAGES.indexOf('bringBaby') ? 'mamaHappy' : 'mamaWorried');
    }
    if (id === 'shelly') {
      if (s === 'shelly') { this.setStage('crystals'); return L('shelly'); }
      if (s === 'crystals') return L('shelly');
      return L(STAGES.indexOf(s) > STAGES.indexOf('crystals') ? 'shellyDone' : 'shellyHello');
    }
    if (id === 'whale' && s === 'whale') { sfx('whale'); this.setStage('shelly'); return [['whale', 'whale'], ['whale', 'whaleNext']]; }
    return null;
  }

  // Old Whelk sends you through the secret tunnel to find the shell house (which wakes the portal).
  whelkTalk() {
    const q = this.state.sideQuests;
    if (q.whelk === 'done') return [['whelk', 'whelkAfter']];
    if (this.state.portal) { this.finishWhelk(); return [['whelk', 'whelkGift']]; }
    if (!q.whelk) { q.whelk = 'active'; this.ctx.save.write(); this.tracked = this.sideShown = 'whelk'; this.refreshSideQuest(); return [['whelk', 'whelkQuest'], ['whelk', 'whelkQuest2']]; }
    return [['whelk', 'whelkHint']];
  }
  finishWhelk() {
    const q = this.state.sideQuests;
    if (q.whelk === 'done') return;
    q.whelk = 'done';
    this.unlockCosmetic('seafoam', 'hairColor');
    this.refreshSideQuest();
  }

  // Shell house portals: found in the bay first, then they link the bay and the castle.
  updatePortals(dt, P) {
    const bay = this.ctx.bay;
    if (!bay) return;
    const bp = bay.bayHouse.portal, cp = bay.castleHouse.portal;
    if (!this.state.portal && P.distanceTo(bp.pos) < 8) {
      this.state.portal = true; bay.setPortal(true);
      this.celebrate(bp.pos, true);
      if (this.state.sideQuests.whelk === 'active') this.finishWhelk();
      this.ctx.save.write();
      this.ctx.ui.toast(t('portalAwake'));
    }
    this.portalCool = Math.max(0, (this.portalCool || 0) - dt);
    if (!this.state.portal || this.portalCool > 0) return;
    for (const [from, to] of [[bp, cp], [cp, bp]]) {
      if (P.distanceTo(from.pos) < 2.4) {
        const pl = this.ctx.player;
        pl.position.copy(to.exit); pl.velocity.set(0, 0, 0);
        pl.yaw = pl.facing = to.facing; pl.snapCamera();
        this.portalCool = 2.5;
        this.bursts.emit(to.exit.clone(), 30, 'spark', 0xe8c8ff, 7);
        this.ctx.ui.toast(t(to === cp ? 'portalCastle' : 'portalBay'));
        break;
      }
    }
  }

  // The sparkle trail can't go through rock: lead the way through the tunnel (or a portal).
  route(tgt) {
    const pl = this.ctx.player, P = pl.position;
    // up in the sky or down in the sea: lead to the surface first
    const tgtSky = tgt.y > WORLD.surfaceY - 0.5;
    if (tgtSky && !pl.flying) return new THREE.Vector3(P.x, WORLD.surfaceY + 4, P.z);
    if (!tgtSky && pl.flying) {
      const flat = Math.hypot(tgt.x - P.x, tgt.z - P.z);
      return flat < 12 ? tgt : new THREE.Vector3(tgt.x, WORLD.surfaceY + 3, tgt.z);
    }
    if (pl.flying) return tgt;
    const tgtBay = tgt.z > WORLD.size / 2 - 10;
    if (pl.inTunnel) {
      const ti = tunnelInfo(P);
      if (tgtBay === !!pl.inBay && tgt.distanceTo(P) < 30) return tgt;
      return TUNNEL.curve.getPointAt(THREE.MathUtils.clamp(ti.t + (tgtBay ? 0.12 : -0.12), 0, 1));
    }
    if (tgtBay === !!pl.inBay) return tgt;
    const bay = this.ctx.bay;
    if (this.state.portal && bay) return (pl.inBay ? bay.bayHouse : bay.castleHouse).portal.pos;
    return pl.inBay ? bay.spots.tunnelExit : bay.spots.tunnelMouth;
  }

  celebrate(pos, big = false) {
    sfx('fanfare');
    this.bursts.emit(pos.clone().add(new THREE.Vector3(0, 1, 0)), big ? 40 : 24, 'spark', 0xfff0a0, big ? 9 : 6);
    this.bursts.emit(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 12, 'heart', 0xffffff, 4);
  }

  openDialog(lines) {
    if (!lines || !lines.length) return;
    this.dialog = lines.slice();
    this.showLine();
  }
  showLine() {
    const [who, key, vars] = this.dialog[0];
    this.ctx.ui.bubble(FACES[who] || '🧜‍♀️', who === 'whale' ? t('names.whale') : t('npc.' + who), t('talk.' + key, vars), who);
    sfx('talk');
  }
  advanceDialog() {
    if (!this.dialog) return;
    this.dialog.shift();
    if (this.dialog.length) this.showLine();
    else { this.dialog = null; this.ctx.ui.bubble(null); }
  }

  befriend(kind, pos, creature) {
    if (this.state.friends.includes(kind)) return;
    this.state.friends.push(kind);
    this.ctx.save.write();
    creature?.cheer?.();
    sfx('friend');
    this.bursts.emit(pos.clone().add(new THREE.Vector3(0, 1, 0)), 10, 'heart', 0xffffff, 3);
    this.ctx.ui.friendPop(kind);
    this.refreshQuest();
  }

  update(dt, time, controls) {
    const P = this.ctx.player.position;
    const camera = this.ctx.player.camera;
    const sq = this.state.sideQuests;
    const S = this.ctx.city.spots;
    this.updatePortals(dt, P);
    const ready = (id) => { if (sq[id] === 'active') { sq[id] = 'ready'; this.ctx.save.write(); this.refreshSideQuest(); this.ctx.ui.toast(t('side.ready')); } };
    if (sq.tailor === 'active' && P.distanceTo(S.fountain) < 11) ready('tailor');
    if (sq.keeper === 'active' && P.distanceTo(S.bridgeWest) < 11) ready('keeper');
    if (sq.bard === 'active' && P.distanceTo(S.bridgeEast) < 11) ready('bard');
    for (const g of this.giverStars) if (g.s.visible) {
      g.s.position.copy(g.n.root.position); g.s.position.y += g.h + Math.sin(time * 2.5 + g.h) * 0.25;
    }
    // baby missions: things to pick up (or bubble rings to swim through)
    for (const [id, items] of Object.entries(this.babyItems)) {
      const on = sq[id] === 'active';
      for (const it of items) {
        it.g.visible = on && !it.got;
        if (!it.g.visible) continue;
        if (BABIES[id].item !== 'ring') { it.g.rotation.y += dt * 1.2; it.g.position.y += Math.sin(time * 2 + it.i) * 0.004; }
        it.g.userData.glow.material.opacity = 0.55 + Math.sin(time * 3 + it.i) * 0.2;
        if (it.g.position.distanceTo(P) < BABIES[id].radius) {
          it.got = true; it.g.visible = false;
          (this.state.sideItems[id] ||= []).push(it.i);
          this.bursts.emit(it.g.position.clone(), 16, 'spark', TRAIL_COLORS[id], 5);
          const n = this.state.sideItems[id].length;
          if (n >= BABIES[id].count) ready(id);
          else { this.ctx.save.write(); this.refreshSideQuest(); this.ctx.ui.toast(`${t('side.' + id + 'Goal', { n })}`); }
        }
      }
    }

    // chain quests: things to collect and places to visit for the current step
    for (const [key, items] of Object.entries(this.chainItems)) {
      const [id, ks] = key.split(':'), k = +ks;
      const on = sq[id] === 'active' && (this.state.chainStep[id] || 0) === k;
      for (const it of items) {
        it.g.visible = on && !it.got;
        if (!it.g.visible) continue;
        it.g.rotation.y += dt * 1.2; it.g.position.y += Math.sin(time * 2 + it.i) * 0.004;
        it.g.userData.glow.material.opacity = 0.55 + Math.sin(time * 3 + it.i) * 0.2;
        if (it.g.position.distanceTo(P) < 3) {
          it.got = true; it.g.visible = false;
          const got = (this.state.sideItems[key] ||= []);
          got.push(it.i);
          this.bursts.emit(it.g.position.clone(), 16, 'spark', CHAINS[id].color, 5);
          if (got.length >= items.length) this.chainReady(id);
          else { this.ctx.save.write(); this.refreshSideQuest(); this.ctx.ui.toast(this.sideText(id)); }
        }
      }
    }
    for (const [key, b] of Object.entries(this.chainBeacons)) {
      const [id, ks] = key.split(':');
      b.visible = sq[id] === 'active' && (this.state.chainStep[id] || 0) === +ks;
      if (!b.visible) continue;
      b.userData.ring.rotation.z += dt * 0.8;
      b.userData.ring.position.y = Math.sin(time * 2) * 0.3;
      b.userData.glow.material.opacity = 0.5 + Math.sin(time * 3) * 0.2;
      if (b.position.distanceTo(P) < 6) this.chainReady(id);
    }

    // NPC idle animation, face the player when near
    let nearest = null, nd = 1e9;
    for (const n of this.npcs) {
      n.t += dt;
      const d = n.root.position.distanceTo(P);
      if (n.id === 'citizen') {
        n.root.position.set(n.home.x + Math.cos(n.t * 0.2) * 8, n.home.y + Math.sin(n.t * 0.5) * 1.5, n.home.z + Math.sin(n.t * 0.2) * 8);
        n.root.rotation.y = -n.t * 0.2;
        n.model.update(dt, 0.4, 1);
      } else if (n.id === 'activity') {
        const r = n.activity === 'court' ? 4 : n.activity === 'garden' ? 2.5 : 0.8;
        n.root.position.set(n.home.x + Math.cos(n.t * 0.65) * r,
          n.home.y + Math.sin(n.t * 1.4) * 0.5,
          n.home.z + Math.sin(n.t * 0.65) * r);
        n.root.rotation.y = n.activity === 'court' ? -n.t * 0.65 : Math.sin(n.t * 0.7) * 0.6;
        n.model.update(dt, n.activity === 'court' ? 0.35 : 0.1, n.activity === 'court' ? 0.8 : 0.25);
      } else if (n.noSpin) {
        n.root.position.y = n.home.y + Math.sin(n.t * 1.3) * 0.15;
      } else if (n.model.update) {
        n.model.update(dt, 0, 0);
      } else {
        n.root.position.y = n.home.y + Math.sin(n.t * 1.3) * 0.3;
        n.root.rotation.y += dt * 0.3;
      }
      if (d < 12 && n.face && n.id !== 'citizen') {
        const want = Math.atan2(P.x - n.root.position.x, P.z - n.root.position.z);
        let dd = want - n.root.rotation.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
        n.root.rotation.y += dd * Math.min(1, dt * 3);
      }
      const r = n.id === 'queen' ? 7 : ['mama', 'shelly', 'momo', 'pinch', 'rosa', 'shellby', 'whelk', 'clawsworth', 'selkie', 'madamePearl'].includes(n.id) || CHAIN_BY_GIVER[n.id] || n.folk ? 6 : 4.5;
      const rr2 = ['citizen', 'activity', 'ambientSeahorse'].includes(n.id) ? 3.5 : r;
      if (d < rr2 && d < nd) { nearest = n; nd = d; }
      if (d > rr2 + 3) this.greeted.delete(n);
      if (d < 10 && n.model instanceof MerModel) this.befriend(n.id === 'guard' ? 'guard' : 'mermaid', n.root.position);
      if (d < 8 && n.friendKind) this.befriend(n.friendKind, n.root.position);
    }

    // the whale counts as a talker during its quest step
    const whale = this.ctx.creatures.list.find((c) => c.kind === 'whale');
    if (this.stage === 'whale' && whale.root.position.distanceTo(P) < 18) nearest = { id: 'whale', root: whale.root };

    // baby seahorse follows the player
    if (this.babyFollow) {
      const b = this.baby.root.position;
      const want = P.clone().add(this.ctx.player.dirFacing().multiplyScalar(-2.5)).add(new THREE.Vector3(1.2, 0.8, 0));
      b.lerp(want, Math.min(1, dt * 2.5));
      this.baby.home.copy(b);
    } else if (this.babyHome) {
      const want = this.mama.root.position.clone().add(new THREE.Vector3(1.8, -0.5, 0.5));
      this.baby.root.position.lerp(want, Math.min(1, dt * 2));
      this.baby.home.copy(this.baby.root.position);
    }

    // auto-talk once when arriving, action button replays
    this.near = nearest;
    const act = controls.consumeAction();
    if (this.dialog) {
      if (act) this.advanceDialog();
      if (this.dialogFor && this.dialogFor.root.position.distanceTo(P) > 16) { this.dialog = null; this.ctx.ui.bubble(null); }
    } else if (nearest && (!this.greeted.has(nearest) || act)) {
      this.greeted.add(nearest);
      const lines = this.talk(nearest);
      if (lines) { this.dialogFor = nearest; this.openDialog(lines); }
    } else if (act) {
      this.ctx.player.doDash(); sfx('bubble');
    }
    this.ctx.ui.actionReady(!!nearest || !!this.dialog);

    // pearls
    for (const pr of this.pearls) {
      const ud = pr.g.userData;
      const d = pr.g.position.distanceTo(P);
      const open = pr.got ? 0.15 : THREE.MathUtils.clamp((20 - d) / 12, 0.15, 1);
      ud.lid.rotation.x = -open * 1.1 - Math.sin(time * 2 + pr.i) * 0.05;
      if (!pr.got) {
        ud.pearl.position.y = 0.35 + Math.sin(time * 2 + pr.i) * 0.1;
        ud.glow.material.opacity = 0.6 + Math.sin(time * 3 + pr.i) * 0.25;
        if (d < 3 && this.stage === 'pearls') {
          pr.got = true; ud.pearl.visible = false; ud.glow.visible = false;
          this.state.pearls.push(pr.i);
          sfx('pearl'); this.ctx.ui.toast(t('pearl'));
          this.bursts.emit(pr.g.position.clone().add(new THREE.Vector3(0, 1, 0)), 18, 'spark', 0xe8e0ff, 5);
          if (this.state.pearls.length >= 5 && this.stage === 'pearls') this.setStage('backQueen');
          else { this.ctx.save.write(); this.refreshQuest(true); }
        }
      }
    }
    // crystals
    for (const c of this.crystals) {
      c.mesh.rotation.y += dt * (c.lit ? 0.8 : 0.1);
      if (c.lit) c.glow.material.opacity = 0.75 + Math.sin(time * 2 + c.i) * 0.2;
      if (!c.lit && this.stage === 'crystals' && c.mesh.position.distanceTo(P) < 5) {
        c.lit = true; this.state.crystals.push(c.i);
        c.mesh.material.emissive.set(0x6fd8ff); c.mesh.material.color.set(0xd0f6ff);
        sfx('chime'); this.ctx.ui.toast(t('crystal'));
        this.bursts.emit(c.mesh.position, 30, 'spark', 0x8fe3ff, 8);
        if (this.state.crystals.length >= 3) { this.celebrate(P); this.ctx.ui.bubble(FACES.shelly, t('npc.shelly'), t('talk.shellyDone'), 'shelly'); this.dialog = [['shelly', 'shellyDone']]; this.dialogFor = null; this.setStage('finale'); }
        else { this.ctx.save.write(); this.refreshQuest(true); }
      }
    }

    // island animals move only while the islands are shown and near
    for (const f of this.landFolk) if (f.island.group.visible && f.pos.distanceToSquared(P) < 200 * 200) f.update(dt);

    // friends: creatures you swim close to
    for (const c of this.ctx.creatures.all) {
      if (this.state.friends.includes(c.kind)) continue;
      const r = c.friendRadius || 9;
      if (c.pos.distanceTo(P) < r) this.befriend(c.kind, c.pos.clone(), c);
    }

    // guide: star above the target + a flowing sparkle path from the player,
    // for whichever quest is tracked (gold = main story, own colour per side quest)
    const tgt = this.tracked === 'main' ? this.target() : this.sideTarget(this.tracked);
    const trailColor = this.tracked === 'main' ? TRAIL_COLORS.main : TRAIL_COLORS[this.tracked];
    this.trail.forEach((s) => s.material.color.setHex(trailColor));
    this.marker.material.color.setHex(this.tracked === 'main' ? 0xffffff : trailColor);
    this.marker.visible = !!tgt;
    this.trail.forEach((s) => (s.visible = !!tgt));
    if (tgt) {
      const above = tgt.clone().add(new THREE.Vector3(0, 4 + Math.sin(time * 3) * 0.4, 0));
      this.marker.position.copy(above);
      const dc = camera.position.distanceTo(above);
      this.marker.scale.setScalar(THREE.MathUtils.clamp(dc * 0.06, 1.6, 9));
      this.marker.material.rotation = Math.sin(time * 2) * 0.2;
      const dir = this.route(tgt).clone().sub(P);
      const dist = dir.length();
      dir.normalize();
      const len = Math.min(dist - 2, 22);
      this.trail.forEach((s, i) => {
        const f = ((i / this.trail.length) + time * 0.35) % 1;
        const along = 1.5 + f * len;
        s.position.copy(P).addScaledVector(dir, along);
        s.position.y += Math.sin(f * Math.PI * 4 + time * 3) * 0.3;
        s.material.opacity = Math.sin(f * Math.PI) * (len > 0 ? 1 : 0);
        s.scale.setScalar(0.35 + Math.sin(f * Math.PI) * 0.5);
        s.visible = len > 0;
      });
    }

    this.bursts.update(dt);
  }
}
