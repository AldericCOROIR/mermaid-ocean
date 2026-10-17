// Story, characters, collectibles, the sparkle guide, friends & rewards.
import * as THREE from 'three';
import { WORLD, groundHeight, glowTexture, canvasTexture, rr } from './util.js';
import { MerModel, PALETTES } from './mermaid.js';
import { seahorseModel, turtleModel } from './creatures.js';
import { paintMat } from './geom.js';
import { t } from './i18n.js';
import { sfx } from './audio.js';

export const STAGES = ['meet', 'pearls', 'backQueen', 'baby', 'bringBaby', 'whale', 'shelly', 'crystals', 'finale', 'free'];
export const ALBUM = ['clownfish', 'tang', 'yellowfish', 'angelfish', 'seahorse', 'crab', 'puffer', 'octopus', 'jellyfish', 'turtle', 'manta', 'dolphin', 'whale', 'mermaid', 'guard'];
const SIDE_IDS = ['tailor', 'keeper', 'bard'];
const TRAIL_COLORS = { main: 0xfff3a0, tailor: 0xff8fd0, keeper: 0x7ff0ff, bard: 0xc49bff };
const FACES = { marina: '🧜‍♀️', queen: '👸', guard: '🔱', coral: '🧜🏾‍♀️', pearl: '🧜‍♀️', mama: '💛', baby: '🍼', shelly: '🐢', whale: '🐋', tailor: '🧵', baker: '🧁', keeper: '⛲', bard: '🎶', librarian: '📚', fairy: '🧚' };

function starTexture() {
  return canvasTexture(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,250,200,0.9)'); grd.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    g.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 18 : 44;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.fillStyle = '#ffe066'; g.fill();
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

export class Story {
  constructor(scene, ctx) {
    this.scene = scene;
    this.ctx = ctx; // { player, city, creatures, ui, save }
    this.state = ctx.save.state;
    this.tracked = 'main'; // which quest the sparkle trail follows
    this.npcs = [];
    this.bursts = new Bursts(scene);
    this.dialog = null;
    this.near = null;
    this.greeted = new Set();
    this.buildNPCs();
    this.buildPearls();
    this.buildCrystals();
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
    this.addNPC('citizen', new MerModel(PALETTES.pearl), S.citizens[1]);
    this.addNPC('citizen', new MerModel(PALETTES.marina), S.citizens[2]);
    for (const r of S.residents) {
      const m = new MerModel(PALETTES[r.color]);
      if (r.id === 'fairy') m.setHeadwear('pearlTiara');
      if (r.id === 'bard') m.setHeadwear('coralClip');
      this.addNPC(r.id, m, r.pos);
    }
    for (const a of S.activities) {
      const n = this.addNPC('activity', new MerModel(PALETTES[a.color]), a.pos, false);
      n.activity = a.kind;
    }
    S.seahorses.forEach((p, i) =>
      this.addNPC('ambientSeahorse', { root: seahorseModel(i ? 0xffc784 : 0x9be6ff, 1.6) }, p, false));
    const mamaPos = S.garden;
    this.mama = this.addNPC('mama', { root: seahorseModel(0xff9fcf, 2.2) }, mamaPos);
    const kp = WORLD.kelpPos;
    this.baby = this.addNPC('baby', { root: seahorseModel(0xffd0ea, 0.9) }, new THREE.Vector3(kp.x + 10, groundHeight(kp.x + 10, kp.z - 15) + 4, kp.z - 15));
    const T = WORLD.trenchPos;
    const sx = T.x - 25, sz = T.z - 55;
    const shellyModel = turtleModel(); shellyModel.scale.setScalar(1.6);
    this.shelly = this.addNPC('shelly', { root: shellyModel }, new THREE.Vector3(sx, groundHeight(sx, sz) + 5, sz));
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
    this.ctx.ui.setCounts(this.state.pearls.length, this.state.friends.length);
    this.refreshSideQuest();
  }

  // Side quests in progress, each with its own goal text and trail colour.
  sideList() {
    const q = this.state.sideQuests || {};
    return SIDE_IDS.filter((id) => q[id] === 'active' || q[id] === 'ready')
      .map((id) => ({ id, text: t('side.' + id + (q[id] === 'ready' ? 'Return' : 'Goal')), color: TRAIL_COLORS[id], icon: FACES[id] }));
  }

  refreshSideQuest() {
    const list = this.sideList();
    if (this.tracked !== 'main' && !list.some((x) => x.id === this.tracked)) this.tracked = 'main';
    if (this.tracked === 'main' && !this.target() && list.length) this.tracked = list[0].id; // main story done: follow a side quest
    this.ctx.ui.setSideQuests(list, this.tracked);
  }

  // Which quest the sparkle trail follows: 'main' or a side quest id (tap a quest to switch).
  track(id) {
    this.tracked = id === 'main' || this.sideList().some((x) => x.id === id) ? id : 'main';
    this.refreshSideQuest();
  }

  sideTarget(id) {
    const q = this.state.sideQuests, S = this.ctx.city.spots;
    if (q[id] === 'active') return { tailor: S.fountain, keeper: S.bridgeWest, bard: S.bridgeEast }[id] || null;
    if (q[id] === 'ready') return this.npcs.find((n) => n.id === id)?.root.position || null;
    return null;
  }

  sideQuest(id) {
    const q = this.state.sideQuests;
    if (!q[id]) {
      q[id] = 'active'; this.ctx.save.write(); this.tracked = id; this.refreshSideQuest();
      return [[id, id + 'Quest']];
    }
    if (q[id] === 'ready') {
      q[id] = 'done';
      const reward = { tailor: ['coralClip', 'head'], keeper: ['seaGlass', 'top'], bard: ['sapphire', 'tail'] }[id];
      this.unlockCosmetic(...reward);
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
    if (id === 'marina') return s === 'meet' ? L('marina1', 'marina2') : L('marina2');
    if (id === 'guard') return L('guard');
    if (id === 'coral') return L('coral');
    if (id === 'pearl') return L('pearl');
    if (['tailor', 'keeper', 'bard'].includes(id)) return this.sideQuest(id);
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
      return null;
    }
    if (id === 'baby' && s === 'baby') { this.setStage('bringBaby'); this.babyFollow = true; return L('baby'); }
    if (id === 'mama') {
      if (s === 'bringBaby') { this.babyFollow = false; this.babyHome = true; this.celebrate(npc.root.position); this.setStage('whale'); return L('mama', 'mamaNext'); }
      return null;
    }
    if (id === 'shelly') {
      if (s === 'shelly') { this.setStage('crystals'); return L('shelly'); }
      if (s === 'crystals') return L('shelly');
      return null;
    }
    if (id === 'whale' && s === 'whale') { sfx('whale'); this.setStage('shelly'); return [['whale', 'whale'], ['whale', 'whaleNext']]; }
    return null;
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
    const [who, key] = this.dialog[0];
    this.ctx.ui.bubble(FACES[who] || '🧜‍♀️', who === 'whale' ? t('names.whale') : t('npc.' + who), t('talk.' + key), who);
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
    const ready = (id) => { if (sq[id] === 'active') { sq[id] = 'ready'; this.ctx.save.write(); this.refreshSideQuest(); this.ctx.ui.toast(t('side.ready')); } };
    if (sq.tailor === 'active' && P.distanceTo(S.fountain) < 11) ready('tailor');
    if (sq.keeper === 'active' && P.distanceTo(S.bridgeWest) < 11) ready('keeper');
    if (sq.bard === 'active' && P.distanceTo(S.bridgeEast) < 11) ready('bard');

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
      const r = n.id === 'queen' ? 7 : n.id === 'mama' || n.id === 'shelly' ? 6 : 4.5;
      if (!['citizen', 'activity', 'ambientSeahorse'].includes(n.id) && d < r && d < nd) { nearest = n; nd = d; }
      if (d > r + 3) this.greeted.delete(n);
      if (d < 10 && n.model instanceof MerModel) this.befriend(n.id === 'guard' ? 'guard' : 'mermaid', n.root.position);
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
      const dir = tgt.clone().sub(P);
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
