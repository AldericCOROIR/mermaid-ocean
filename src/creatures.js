// Sea creatures: fish schools, whale, dolphins, seahorses, crabs, jellyfish,
// turtles, manta rays, pufferfish and octopus. All procedural & animated.
import * as THREE from 'three';
import { WORLD, groundHeight, rand, rr, pick, glowTexture } from './util.js';
import { merge, mat, segment, paintMat, inject, shared } from './geom.js';
import { lobsterModel, snailModel, hermitCrabModel, sealModel, oysterModel, anglerfishModel, seaDragonModel } from './seafolk.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

function faceDir(obj, dir, dt, rate = 4) {
  if (dir.lengthSq() < 1e-6) return;
  const yaw = Math.atan2(dir.x, dir.z);
  let d = yaw - obj.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  obj.rotation.y += d * Math.min(1, rate * dt);
  const pitch = -Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
  obj.rotation.x += (pitch - obj.rotation.x) * Math.min(1, rate * dt);
}

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

// ---------- Fish schools (instanced + vertex wiggle) ----------
const FISH_TYPES = {
  clown: { body: 0xff8a3d, stripe: 0xffffff, fin: 0xff6a1a, kind: 'clownfish', stripes: true },
  tang: { body: 0x3d7dff, stripe: 0xffd84d, fin: 0x1d3dbf, kind: 'tang', tailStripe: true },
  yellow: { body: 0xffe14d, stripe: 0xffffff, fin: 0xffb84d, kind: 'yellowfish' },
  angel: { body: 0xd6a6ff, stripe: 0x7fe7ff, fin: 0xb07fff, kind: 'angelfish', tall: true },
};

function fishGeo(t) {
  const body = new THREE.SphereGeometry(0.5, 12, 8);
  body.scale(0.35, t.tall ? 0.75 : 0.5, 1);
  const p = body.attributes.position;
  const col = [];
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), y = p.getY(i);
    c.set(t.body);
    if (t.stripes && (Math.abs(z - 0.2) < 0.07 || Math.abs(z + 0.12) < 0.06)) c.set(t.stripe);
    if (t.tailStripe && z < -0.25) c.set(t.stripe);
    if (y < -0.12) c.lerp(new THREE.Color(0xffffff), 0.35);
    col.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const tail = new THREE.ConeGeometry(0.28, 0.4, 4);
  tail.rotateX(Math.PI / 2); tail.scale(0.15, 1, 1);
  const dorsal = new THREE.ConeGeometry(0.15, 0.35, 3);
  dorsal.scale(0.12, 1, 1);
  const parts = [
    { geo: tail, matrix: mat(0, 0, -0.55), color: t.fin },
    { geo: dorsal, matrix: mat(0, t.tall ? 0.42 : 0.28, -0.05, -0.5), color: t.fin },
    { geo: new THREE.SphereGeometry(0.07, 6, 4), matrix: mat(0.13, 0.08, 0.3), color: 0x1b1640 },
    { geo: new THREE.SphereGeometry(0.07, 6, 4), matrix: mat(-0.13, 0.08, 0.3), color: 0x1b1640 },
  ];
  const m = merge(parts);
  // splice the vertex coloured body in
  const b2 = body.toNonIndexed();
  return mergeRaw([b2, m]);
}
function mergeRaw(geos) {
  const attrs = ['position', 'normal', 'color'];
  const out = new THREE.BufferGeometry();
  attrs.forEach((a) => {
    const arrs = geos.map((g) => g.attributes[a].array);
    const total = arrs.reduce((s, x) => s + x.length, 0);
    const f = new Float32Array(total);
    let o = 0; arrs.forEach((x) => { f.set(x, o); o += x.length; });
    out.setAttribute(a, new THREE.BufferAttribute(f, 3));
  });
  return out;
}

class FishSchool {
  constructor(scene, type, count, center, radius, height) {
    this.type = FISH_TYPES[type];
    this.kind = this.type.kind;
    const m = inject(paintMat({ vertexColors: true, emissive: 0x201010 }), {
      key: 'fishwig',
      vertex: `{ float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
        #endif
        float w = smoothstep(0.3, -0.7, position.z);
        transformed.x += sin(uTime * 9.0 + ph + position.z * 4.0) * w * 0.18; }`,
    });
    this.mesh = new THREE.InstancedMesh(fishGeo(this.type), m, count);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.center = center.clone();
    this.radius = radius; this.height = height;
    this.t = rand() * 100;
    this.fish = Array.from({ length: count }, () => ({
      p: center.clone().add(new THREE.Vector3(rr(-4, 4), rr(-2, 2), rr(-4, 4))),
      v: new THREE.Vector3(rr(-1, 1), 0, rr(-1, 1)),
      o: new THREE.Vector3(rr(-3, 3), rr(-1.5, 1.5), rr(-3, 3)),
      s: rr(0.7, 1.3),
    }));
    this.leader = new THREE.Vector3();
    this.dummy = new THREE.Object3D();
    this.pos = this.leader;
  }
  update(dt, t, player) {
    this.t += dt * 0.12;
    const a = this.t;
    this.leader.set(
      this.center.x + Math.cos(a) * this.radius + Math.sin(a * 2.3) * 6,
      this.height + Math.sin(a * 1.7) * 4,
      this.center.z + Math.sin(a) * this.radius * 0.8,
    );
    const g = groundHeight(this.leader.x, this.leader.z);
    this.leader.y = Math.max(this.leader.y, g + 4);
    const pp = player.position;
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      tmp.copy(this.leader).add(f.o).sub(f.p);
      const steer = tmp.multiplyScalar(0.9);
      // scatter from the mermaid, then regroup
      tmp2.subVectors(f.p, pp);
      const d = tmp2.length();
      if (d < 5) steer.addScaledVector(tmp2.normalize(), (5 - d) * 6);
      f.v.addScaledVector(steer, dt);
      const sp = f.v.length(), max = 7 * f.s;
      if (sp > max) f.v.multiplyScalar(max / sp);
      f.v.multiplyScalar(1 - dt * 0.6);
      f.p.addScaledVector(f.v, dt);
      this.dummy.position.copy(f.p);
      tmp.copy(f.p).add(f.v);
      this.dummy.lookAt(tmp);
      this.dummy.scale.setScalar(f.s * 2.2);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Base creature with a simple path ----------
class Creature {
  constructor(scene, kind) {
    this.kind = kind;
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    scene.add(this.root);
    this.pos = this.root.position;
    this.t = rand() * 100;
    this.happy = 0;
  }
  cheer() { this.happy = 1.5; }
  bounce(dt) {
    if (this.happy > 0) {
      this.happy -= dt;
      this.root.children[0] && (this.root.children[0].position.y = Math.abs(Math.sin(this.happy * 8)) * 0.5);
      this.root.children[0] && (this.root.children[0].rotation.z = Math.sin(this.happy * 10) * 0.2 * this.happy);
    }
  }
}

// ---------- Whale ----------
export function whaleModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const geo = new THREE.SphereGeometry(1, 28, 18);
  const p = geo.attributes.position, col = [];
  const top = new THREE.Color(0x5b7fc9), belly = new THREE.Color(0xdfe9ff);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const taper = z < 0 ? 1 - Math.pow(-z, 1.6) * 0.75 : 1 - Math.pow(z, 3) * 0.25;
    p.setXYZ(i, x * 2.2 * taper, y * 1.9 * taper + (z > 0 ? -z * 0.2 : 0), z * 7);
    const c = top.clone().lerp(belly, THREE.MathUtils.smoothstep(-y, 0.0, 0.5));
    if (y < -0.3 && Math.sin(x * 22) > 0.6 && z > -0.2) c.lerp(new THREE.Color(0xb7c8f0), 0.5); // throat grooves
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const bm = paintMat({ vertexColors: true, emissive: 0x101830 });
  body.add(new THREE.Mesh(geo, bm));
  const finM = paintMat({ color: 0x5272b8, emissive: 0x101830, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), finM);
    fin.scale.set(2.4, 0.2, 0.8);
    fin.position.set(2.2 * s, -1, 2.2); fin.rotation.set(0, -0.5 * s, -0.5 * s);
    body.add(fin);
    const e = eyeball(0.28);
    e.position.set(1.9 * s, -0.2, 3.6); e.rotation.y = 1.2 * s;
    body.add(e);
  }
  const tail = new THREE.Group();
  tail.position.z = -6.2;
  body.add(tail);
  const fluke = new THREE.Shape();
  fluke.moveTo(0, 0.6); fluke.bezierCurveTo(1.5, 0.2, 3, 0.4, 3.6, 1.6); fluke.bezierCurveTo(2.5, -0.6, 1, -1.2, 0, -0.6);
  fluke.bezierCurveTo(-1, -1.2, -2.5, -0.6, -3.6, 1.6); fluke.bezierCurveTo(-3, 0.4, -1.5, 0.2, 0, 0.6);
  const fg = new THREE.ShapeGeometry(fluke, 10);
  fg.rotateX(Math.PI / 2); fg.translate(0, 0, -0.6);
  tail.add(new THREE.Mesh(fg, finM));
  g.userData = { body, tail };
  return g;
}
class Whale extends Creature {
  constructor(scene) {
    super(scene, 'whale');
    this.model = whaleModel();
    this.root.add(this.model);
    this.root.scale.setScalar(1.6);
    this.c = WORLD.whalePath.center; this.r = WORLD.whalePath.radius;
    this.friendRadius = 16;
  }
  update(dt) {
    this.t += dt * 0.035;
    const a = this.t;
    const p = new THREE.Vector3(this.c.x + Math.cos(a) * this.r, this.c.y + Math.sin(a * 2) * 6, this.c.z + Math.sin(a) * this.r * 0.7);
    const dir = p.clone().sub(this.root.position);
    this.root.position.copy(p);
    faceDir(this.root, dir, dt, 1.5);
    const { tail, body } = this.model.userData;
    tail.rotation.x = Math.sin(this.t * 40) * 0.35;
    body.rotation.x = Math.sin(this.t * 40 + 1) * 0.04;
    this.bounce(dt);
  }
}

// ---------- Dolphin ----------
export function dolphinModel() {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 18, 12);
  const p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const taper = z < 0 ? 1 - Math.pow(-z, 1.4) * 0.8 : 1;
    p.setXYZ(i, x * 0.45 * taper, y * 0.5 * taper, z * 1.8);
    const c = new THREE.Color(0x7fa6d9).lerp(new THREE.Color(0xf2f6ff), THREE.MathUtils.smoothstep(-y, 0, 0.5));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = paintMat({ vertexColors: true, emissive: 0x101830 });
  g.add(new THREE.Mesh(geo, m));
  const fm = paintMat({ color: 0x6f96cc, side: THREE.DoubleSide });
  const beak = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.4, 3, 8), m);
  beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.12, 1.85);
  g.add(beak);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), fm);
  dorsal.scale.set(0.2, 1, 1); dorsal.position.set(0, 0.6, -0.1); dorsal.rotation.x = -0.6;
  g.add(dorsal);
  const tail = new THREE.Group(); tail.position.z = -1.7; g.add(tail);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.6, 3), fm);
  fl.scale.set(1.2, 0.15, 1); fl.rotation.x = -Math.PI / 2; fl.position.z = -0.2;
  tail.add(fl);
  for (const s of [-1, 1]) { const e = eyeball(0.09); e.position.set(0.32 * s, 0.05, 1.2); e.rotation.y = 1.1 * s; g.add(e); }
  g.userData.tail = tail;
  return g;
}
class Dolphin extends Creature {
  constructor(scene, phase) {
    super(scene, 'dolphin');
    this.model = dolphinModel();
    this.root.add(this.model);
    this.t = phase;
    this.friendRadius = 6;
  }
  update(dt) {
    this.t += dt * 0.25;
    const a = this.t;
    const y = WORLD.surfaceY - 6 + Math.sin(a * 6) * 7; // leaps out of the water
    const p = new THREE.Vector3(-40 + Math.cos(a) * 70, y, 40 + Math.sin(a) * 50);
    const dir = p.clone().sub(this.root.position);
    this.root.position.copy(p);
    faceDir(this.root, dir, dt, 5);
    this.model.userData.tail.rotation.x = Math.sin(this.t * 60) * 0.5;
    this.bounce(dt);
  }
}

// ---------- Seahorse ----------
export function seahorseModel(color = 0xffc94d, scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const m = paintMat({ color, emissive: new THREE.Color(color).multiplyScalar(0.25) });
  const belly = paintMat({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5), emissive: 0x302010 });
  // S-curve body as a chain of spheres
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.1, 0.1), new THREE.Vector3(0, 0.75, 0.25), new THREE.Vector3(0, 0.3, 0.15),
    new THREE.Vector3(0, -0.1, -0.05), new THREE.Vector3(0, -0.45, 0.05), new THREE.Vector3(0, -0.65, 0.25), new THREE.Vector3(0, -0.55, 0.4),
  ]);
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, pt = curve.getPoint(t);
    const r = t < 0.15 ? 0.2 : 0.26 * (1 - t) + 0.04;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), i % 3 === 0 ? belly : m);
    s.position.copy(pt);
    body.add(s);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), m);
  head.position.set(0, 1.18, 0.15); body.add(head);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.4, 8), m);
  snout.rotation.x = Math.PI / 2 - 0.3; snout.position.set(0, 1.12, 0.42); body.add(snout);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 5), belly);
  crest.position.set(0, 1.42, 0.05); crest.rotation.x = -0.4; body.add(crest);
  for (const s of [-1, 1]) { const e = eyeball(0.08); e.position.set(0.17 * s, 1.22, 0.24); e.rotation.y = 0.9 * s; body.add(e); }
  const fin = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8, 0, Math.PI), paintMat({ color: 0xfff3c0, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
  fin.position.set(0, 0.35, -0.12); fin.rotation.y = Math.PI / 2; body.add(fin);
  g.userData = { body, fin };
  g.scale.setScalar(scale);
  return g;
}
class Seahorse extends Creature {
  constructor(scene, pos, color, scale = 1.3) {
    super(scene, 'seahorse');
    this.model = seahorseModel(color, scale);
    this.root.add(this.model);
    this.home = pos.clone();
    this.root.position.copy(pos);
    this.friendRadius = 5;
  }
  update(dt, t) {
    this.t += dt;
    this.root.position.set(this.home.x + Math.sin(this.t * 0.3) * 2, this.home.y + Math.sin(this.t * 1.2) * 0.4, this.home.z + Math.cos(this.t * 0.25) * 2);
    this.root.rotation.y = this.t * 0.3 + Math.PI / 2;
    this.model.userData.fin.rotation.z = Math.sin(this.t * 25) * 0.4;
    this.model.userData.body.rotation.z = Math.sin(this.t * 1.2) * 0.08;
    this.bounce(dt);
  }
}

// ---------- Crab ----------
export function crabModel(color = 0xff5a4d) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const m = paintMat({ color, emissive: new THREE.Color(color).multiplyScalar(0.25) });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), m);
  shell.scale.set(1.2, 0.55, 0.9); shell.position.y = 0.45; body.add(shell);
  const legs = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Group();
      leg.position.set(0.55 * s, 0.4, -0.25 + i * 0.25);
      leg.add(new THREE.Mesh(segment(new THREE.Vector3(), new THREE.Vector3(0.45 * s, -0.4, 0), 0.06, 0.03, 5), m));
      body.add(leg); legs.push(leg);
    }
    const claw = new THREE.Group();
    claw.position.set(0.6 * s, 0.5, 0.45);
    claw.add(new THREE.Mesh(segment(new THREE.Vector3(), new THREE.Vector3(0.25 * s, 0.1, 0.25), 0.07, 0.06, 5), m));
    const pincer = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), m);
    pincer.scale.set(1, 0.7, 1.3); pincer.position.set(0.3 * s, 0.15, 0.4);
    claw.add(pincer);
    body.add(claw); legs.push(claw);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), m);
    stalk.position.set(0.18 * s, 0.85, 0.35); body.add(stalk);
    const e = eyeball(0.1); e.position.set(0.18 * s, 1.02, 0.38); body.add(e);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 4, 8, Math.PI), new THREE.MeshBasicMaterial({ color: 0x5a1020 }));
  mouth.position.set(0, 0.42, 0.53); mouth.rotation.z = Math.PI; body.add(mouth);
  g.userData = { body, legs };
  return g;
}
class Crab extends Creature {
  constructor(scene, pos, color) {
    super(scene, 'crab');
    this.model = crabModel(color);
    this.root.add(this.model);
    this.home = pos.clone();
    this.friendRadius = 4;
  }
  update(dt) {
    this.t += dt;
    const x = this.home.x + Math.sin(this.t * 0.4) * 4, z = this.home.z + Math.sin(this.t * 0.13) * 1.5;
    this.root.position.set(x, groundHeight(x, z), z);
    const walking = Math.abs(Math.cos(this.t * 0.4));
    this.model.userData.legs.forEach((l, i) => {
      if (i % 4 === 3) l.rotation.x = Math.sin(this.t * 3) * 0.3; // claws wave
      else l.rotation.z = Math.sin(this.t * 12 + i) * 0.35 * walking;
    });
    this.bounce(dt);
  }
}

// ---------- Jellyfish ----------
export function jellyModel(color = 0xff9fe0) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.55), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
  body.add(bell);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  inner.position.y = 0.2; body.add(inner);
  const tm = withTentacleSway(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const rib = new THREE.PlaneGeometry(0.1, 2.4, 1, 10);
    rib.translate(0, -1.2, 0);
    const t = new THREE.Mesh(rib, tm);
    t.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45); t.rotation.y = -a;
    body.add(t);
  }
  for (const s of [-1, 1]) { const e = eyeball(0.09); e.position.set(0.25 * s, 0.25, 0.68); body.add(e); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(4); glow.position.y = 0.1; body.add(glow);
  g.userData = { body, bell };
  return g;
}
function withTentacleSway(m) {
  return inject(m, { key: 'tent', vertex: `transformed.x += sin(uTime * 2.0 + position.y * 2.0 + modelMatrix[3].x) * position.y * position.y * 0.06;` });
}
class Jelly extends Creature {
  constructor(scene, pos, color) {
    super(scene, 'jellyfish');
    this.model = jellyModel(color);
    this.root.add(this.model);
    this.home = pos.clone();
    this.friendRadius = 4;
  }
  update(dt) {
    this.t += dt;
    const pulse = Math.max(0, Math.sin(this.t * 2));
    this.model.userData.bell.scale.set(1 - pulse * 0.15, 1 + pulse * 0.1, 1 - pulse * 0.15);
    this.root.position.set(this.home.x + Math.sin(this.t * 0.2) * 3, this.home.y + Math.sin(this.t * 0.5) * 3 + pulse * 0.3, this.home.z + Math.cos(this.t * 0.17) * 3);
    this.bounce(dt);
  }
}

// ---------- Turtle ----------
export function turtleModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const shellG = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const p = shellG.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const hex = Math.sin(x * 6) * Math.sin(z * 6) > 0.2;
    const c = new THREE.Color(hex ? 0x6fbf73 : 0x3f8f5a);
    col.push(c.r, c.g, c.b);
  }
  shellG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const shell = new THREE.Mesh(shellG, paintMat({ vertexColors: true, emissive: 0x0a2010 }));
  shell.scale.set(1.1, 0.6, 1.4); body.add(shell);
  const skin = paintMat({ color: 0xb8e08a, emissive: 0x203010 });
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.15, 16), paintMat({ color: 0xf2e3a0 }));
  belly.scale.z = 1.3; body.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), skin);
  head.position.set(0, 0.15, 1.7); head.scale.set(1, 0.9, 1.2); body.add(head);
  for (const s of [-1, 1]) { const e = eyeball(0.1); e.position.set(0.25 * s, 0.32, 1.98); e.rotation.y = 0.5 * s; body.add(e); }
  const flippers = [];
  for (const [x, z, sc] of [[1, 0.8, 1.2], [-1, 0.8, 1.2], [0.9, -1.1, 0.7], [-0.9, -1.1, 0.7]]) {
    const f = new THREE.Group(); f.position.set(x, 0, z);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6), skin);
    m.scale.set(1.6 * sc, 0.15, 0.6 * sc); m.position.x = Math.sign(x) * 0.6 * sc;
    f.add(m); body.add(f); flippers.push(f);
  }
  g.userData = { body, flippers };
  return g;
}
class Turtle extends Creature {
  constructor(scene, center, radius, height) {
    super(scene, 'turtle');
    this.model = turtleModel();
    this.root.add(this.model);
    this.root.scale.setScalar(1.3);
    this.c = center; this.r = radius; this.h = height;
    this.friendRadius = 6;
  }
  update(dt) {
    this.t += dt * 0.06;
    const p = new THREE.Vector3(this.c.x + Math.cos(this.t) * this.r, this.h + Math.sin(this.t * 3) * 3, this.c.z + Math.sin(this.t) * this.r);
    const dir = p.clone().sub(this.root.position);
    this.root.position.copy(p);
    faceDir(this.root, dir, dt, 2);
    this.model.userData.flippers.forEach((f, i) => { f.rotation.z = Math.sin(this.t * 40 + (i > 1 ? 1 : 0)) * 0.5 * (i % 2 ? -1 : 1); });
    this.bounce(dt);
  }
}

// ---------- Manta ray ----------
export function mantaModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const geo = new THREE.PlaneGeometry(6, 3.2, 16, 6);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const w = 1 - Math.abs(x) / 3;
    const zz = z * w + (1 - w) * -0.4;
    p.setXYZ(i, x, Math.sqrt(Math.max(w, 0)) * 0.35 - 0.1, zz);
    const c = new THREE.Color(0x3d4f8f).lerp(new THREE.Color(0x8fa6e8), w * 0.5);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = inject(paintMat({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x101830 }), {
    key: 'manta',
    vertex: `transformed.y += sin(uTime * 2.2 - abs(position.x) * 0.6) * pow(abs(position.x) / 3.0, 1.5) * 1.1;`,
  });
  body.add(new THREE.Mesh(geo, m));
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.08, 3, 4), paintMat({ color: 0x3d4f8f }));
  tail.rotation.x = Math.PI / 2; tail.position.z = -2.4; body.add(tail);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 3, 6), paintMat({ color: 0x3d4f8f }));
    horn.rotation.x = Math.PI / 2; horn.position.set(0.45 * s, 0.1, 1.5); body.add(horn);
    const e = eyeball(0.12); e.position.set(0.55 * s, 0.3, 1.2); e.rotation.y = 0.8 * s; body.add(e);
  }
  g.userData = { body };
  return g;
}
class Manta extends Creature {
  constructor(scene, center, radius, height, phase) {
    super(scene, 'manta');
    this.model = mantaModel();
    this.root.add(this.model);
    this.root.scale.setScalar(1.5);
    this.c = center; this.r = radius; this.h = height; this.t = phase;
    this.friendRadius = 7;
  }
  update(dt) {
    this.t += dt * 0.07;
    const p = new THREE.Vector3(this.c.x + Math.sin(this.t) * this.r, this.h + Math.sin(this.t * 2) * 4, this.c.z + Math.sin(this.t * 2) * this.r * 0.5);
    const dir = p.clone().sub(this.root.position);
    this.root.position.copy(p);
    faceDir(this.root, dir, dt, 2);
    this.root.rotation.z = Math.sin(this.t * 2) * 0.2;
    this.bounce(dt);
  }
}

// ---------- Pufferfish (puffs up when you come close!) ----------
export function pufferModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const m = paintMat({ color: 0xffd36b, emissive: 0x403010 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), m);
  body.add(b);
  const spikes = [];
  for (let i = 0; i < 40; i++) {
    const v = new THREE.Vector3().randomDirection();
    if (v.z > 0.7) continue;
    spikes.push({ geo: new THREE.ConeGeometry(0.05, 0.22, 4), matrix: new THREE.Matrix4().compose(v.clone().multiplyScalar(0.62), new THREE.Quaternion().setFromUnitVectors(UP, v), new THREE.Vector3(1, 1, 1)), color: 0xfff3c0 });
  }
  body.add(new THREE.Mesh(merge(spikes), paintMat({ vertexColors: true })));
  for (const s of [-1, 1]) { const e = eyeball(0.15); e.position.set(0.28 * s, 0.15, 0.45); e.rotation.y = 0.5 * s; body.add(e); }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 4), paintMat({ color: 0xffa64d }));
  tail.scale.x = 0.2; tail.rotation.x = -Math.PI / 2; tail.position.z = -0.7; body.add(tail);
  g.userData = { body, tail };
  return g;
}
class Puffer extends Creature {
  constructor(scene, pos) {
    super(scene, 'puffer');
    this.model = pufferModel();
    this.root.add(this.model);
    this.home = pos.clone();
    this.puff = 0;
    this.friendRadius = 4;
  }
  update(dt, t, player) {
    this.t += dt;
    this.root.position.set(this.home.x + Math.sin(this.t * 0.3) * 3, this.home.y + Math.sin(this.t * 0.9) * 0.5, this.home.z + Math.cos(this.t * 0.3) * 3);
    this.root.rotation.y = this.t * 0.3 + Math.PI / 2;
    const near = player.position.distanceTo(this.root.position) < 5 ? 1 : 0;
    this.puff += (near - this.puff) * Math.min(1, dt * 4);
    const s = 0.7 + this.puff * 0.8;
    this.model.userData.body.scale.setScalar(s);
    this.model.userData.tail.rotation.y = Math.sin(this.t * 12) * 0.5;
    this.bounce(dt);
  }
}

// ---------- Octopus ----------
export function octopusModel(color = 0xb06bff) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const m = paintMat({ color, emissive: new THREE.Color(color).multiplyScalar(0.25) });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), m);
  head.scale.set(1, 1.15, 1); head.position.y = 1.2; body.add(head);
  for (const s of [-1, 1]) { const e = eyeball(0.17); e.position.set(0.32 * s, 1.0, 0.68); body.add(e); }
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    let parent = body;
    const chain = [];
    for (let k = 0; k < 5; k++) {
      const seg = new THREE.Group();
      if (k === 0) { seg.position.set(Math.cos(a) * 0.45, 0.55, Math.sin(a) * 0.45); seg.rotation.y = -a; }
      else seg.position.x = 0.32;
      const r = 0.16 * (1 - k * 0.16);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
      mesh.scale.set(1.6, 1, 1); mesh.position.x = 0.16;
      seg.add(mesh);
      parent.add(seg); chain.push(seg); parent = seg;
    }
    arms.push(chain);
  }
  g.userData = { body, arms };
  return g;
}
class Octopus extends Creature {
  constructor(scene, pos) {
    super(scene, 'octopus');
    this.model = octopusModel();
    this.root.add(this.model);
    this.root.position.copy(pos);
    this.root.scale.setScalar(1.3);
    this.friendRadius = 5;
  }
  update(dt) {
    this.t += dt;
    this.model.userData.arms.forEach((chain, i) => chain.forEach((s, k) => {
      s.rotation.z = (k === 0 ? -0.5 : 0) + Math.sin(this.t * 1.5 + i + k * 0.8) * 0.25;
    }));
    this.model.userData.body.position.y = Math.sin(this.t) * 0.15;
    this.bounce(dt);
  }
}

// ---------- Narwhal: a small speckled whale with a spiral horn ----------
export function narwhalModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const geo = new THREE.SphereGeometry(1, 20, 14);
  const p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const taper = z < 0 ? 1 - Math.pow(-z, 1.5) * 0.7 : 1;
    p.setXYZ(i, x * 0.75 * taper, y * 0.7 * taper, z * 2);
    const c = new THREE.Color(0x9fb4d8).lerp(new THREE.Color(0xf4f7ff), THREE.MathUtils.smoothstep(-y, 0, 0.6));
    if (y > 0.1 && Math.sin(x * 19) * Math.sin(z * 13) > 0.7) c.lerp(new THREE.Color(0x6d82b0), 0.6); // speckles
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  body.add(new THREE.Mesh(geo, paintMat({ vertexColors: true, emissive: 0x141c30 })));
  const hornGeo = new THREE.ConeGeometry(0.09, 2, 8, 12);
  const hp = hornGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) { const a = hp.getY(i) * 9; const k = 1 + 0.18 * Math.sin(Math.atan2(hp.getZ(i), hp.getX(i)) * 2 + a); hp.setX(i, hp.getX(i) * k); hp.setZ(i, hp.getZ(i) * k); }
  hornGeo.computeVertexNormals();
  const horn = new THREE.Mesh(hornGeo, paintMat({ color: 0xfff1c8, emissive: 0x5a4a28 }));
  horn.rotation.x = Math.PI / 2; horn.position.set(0, 0.15, 2.9);
  body.add(horn);
  const fm = paintMat({ color: 0x8aa0c8, side: THREE.DoubleSide, emissive: 0x101830 });
  for (const s of [-1, 1]) {
    const e = eyeball(0.12); e.position.set(0.55 * s, 0.05, 1.3); e.rotation.y = 1.1 * s; body.add(e);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), fm);
    fin.scale.set(1.2, 0.15, 0.5); fin.position.set(0.8 * s, -0.35, 0.6); fin.rotation.z = -0.4 * s; body.add(fin);
  }
  const tail = new THREE.Group(); tail.position.z = -1.9; body.add(tail);
  const fl = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 6), fm);
  fl.scale.set(1.5, 0.12, 0.6); fl.position.z = -0.3; tail.add(fl);
  g.userData = { body, tail };
  return g;
}
class Narwhal extends Creature {
  constructor(scene, center, radius, height, phase) {
    super(scene, 'narwhal');
    this.model = narwhalModel();
    this.root.add(this.model);
    this.root.scale.setScalar(1.3);
    this.c = center; this.r = radius; this.h = height; this.t = phase;
    this.friendRadius = 7;
  }
  update(dt) {
    this.t += dt * 0.08;
    const p = new THREE.Vector3(this.c.x + Math.cos(this.t) * this.r, this.h + Math.sin(this.t * 2.5) * 4, this.c.z + Math.sin(this.t) * this.r);
    const dir = p.clone().sub(this.root.position);
    this.root.position.copy(p);
    faceDir(this.root, dir, dt, 2);
    this.model.userData.tail.rotation.x = Math.sin(this.t * 50) * 0.4;
    this.bounce(dt);
  }
}

// ---------- Sea bunny: a tiny fluffy sea slug with bunny ears ----------
export function seaBunnyModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const fluff = paintMat({ color: 0xfffbf0, emissive: 0x5a564a });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), fluff);
  b.scale.set(0.85, 0.7, 1.2); b.position.y = 0.4; body.add(b);
  const dots = new THREE.MeshBasicMaterial({ color: 0x2b2238 });
  for (let i = 0; i < 9; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), dots);
    const a = i * 2.4, h = 0.3 + (i % 3) * 0.12;
    d.position.set(Math.cos(a) * 0.45, 0.4 + h * 0.6, Math.sin(a) * 0.6); body.add(d);
  }
  const earM = paintMat({ color: 0xfffbf0, emissive: 0x5a564a });
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), earM);
    ear.position.set(0.16 * s, 0.95, 0.45); ear.rotation.z = -0.25 * s; ear.rotation.x = -0.2; body.add(ear);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), dots);
    tip.position.set(0.21 * s, 1.15, 0.42); body.add(tip);
    const e = eyeball(0.07); e.position.set(0.2 * s, 0.6, 0.68); e.rotation.y = 0.3 * s; body.add(e);
  }
  const gill = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), paintMat({ color: 0xffb35c, emissive: 0x603010 }));
  gill.position.set(0, 0.75, -0.5); gill.scale.set(1, 0.6, 1); body.add(gill);
  g.userData = { body };
  return g;
}
class SeaBunny extends Creature {
  constructor(scene, pos) {
    super(scene, 'seaBunny');
    this.model = seaBunnyModel();
    this.root.add(this.model);
    this.home = pos.clone();
    this.root.position.copy(pos);
    this.root.scale.setScalar(1.6);
    this.friendRadius = 5;
  }
  update(dt) {
    this.t += dt * 0.15;
    const x = this.home.x + Math.cos(this.t) * 3, z = this.home.z + Math.sin(this.t) * 3;
    this.root.position.set(x, groundHeight(x, z) + 0.1, z);
    this.root.rotation.y = -this.t + Math.PI;
    this.model.userData.body.scale.set(1, 1 + Math.sin(this.t * 25) * 0.05, 1 - Math.sin(this.t * 25) * 0.04);
    this.bounce(dt);
  }
}

// ---------- Starfish: a smiling five-armed friend on the sand ----------
export function starfishModel(color = 0xff8a7a) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const shape = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.42 : 1;
    i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 3 });
  geo.rotateX(-Math.PI / 2);
  body.add(new THREE.Mesh(geo, paintMat({ color, emissive: new THREE.Color(color).multiplyScalar(0.25) })));
  const bumps = paintMat({ color: 0xfff0c0, emissive: 0x504020 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    for (const r of [0.45, 0.7]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), bumps);
      d.position.set(Math.cos(a) * r, 0.27, -Math.sin(a) * r); body.add(d);
    }
  }
  for (const s of [-1, 1]) { const e = eyeball(0.1); e.position.set(0.14 * s, 0.32, 0.05); e.rotation.x = -1.2; body.add(e); }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 4, 10, Math.PI), new THREE.MeshBasicMaterial({ color: 0x8a2030 }));
  smile.rotation.x = -Math.PI / 2; smile.rotation.z = Math.PI; smile.position.set(0, 0.3, 0.2); body.add(smile);
  g.userData = { body };
  return g;
}
class Starfish extends Creature {
  constructor(scene, pos, color) {
    super(scene, 'starfish');
    this.model = starfishModel(color);
    this.root.add(this.model);
    this.root.position.copy(pos);
    this.root.scale.setScalar(1.4);
    this.root.rotation.y = rand() * 6;
    this.friendRadius = 4;
  }
  update(dt) {
    this.t += dt;
    this.model.userData.body.rotation.z = Math.sin(this.t * 1.2) * 0.06;
    this.bounce(dt);
  }
}

// ---------- Sea otter: floats on its back at the surface, holding a shell ----------
export function otterModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const fur = paintMat({ color: 0x9a6a48, emissive: 0x2a1a10 });
  const cream = paintMat({ color: 0xf2dcc0, emissive: 0x4a3a2a });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.1, 6, 12), fur);
  torso.rotation.x = Math.PI / 2; body.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), cream);
  belly.scale.set(0.9, 0.5, 1.4); belly.position.y = 0.2; body.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), cream);
  head.position.set(0, 0.25, 0.95); body.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), fur); ear.position.set(0.28 * s, 0.45, 0.9); body.add(ear);
    const e = eyeball(0.07); e.position.set(0.15 * s, 0.52, 1.12); e.rotation.x = -0.9; body.add(e);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), fur); paw.position.set(0.15 * s, 0.55, 0.45); body.add(paw);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3a2418 }));
  nose.position.set(0, 0.52, 1.3); body.add(nose);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), paintMat({ color: 0xffc0d8, emissive: 0x502030, side: THREE.DoubleSide }));
  shell.position.set(0, 0.62, 0.35); shell.scale.set(1, 0.4, 1); body.add(shell);
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.6, 4, 8), fur);
  tail.rotation.x = Math.PI / 2; tail.position.set(0, 0, -1.2); body.add(tail);
  g.userData = { body };
  return g;
}
class Otter extends Creature {
  constructor(scene, center, phase) {
    super(scene, 'otter');
    this.model = otterModel();
    this.root.add(this.model);
    this.root.scale.setScalar(1.4);
    this.c = center; this.t = phase;
    this.friendRadius = 6;
  }
  update(dt) {
    this.t += dt * 0.12;
    this.root.position.set(this.c.x + Math.cos(this.t) * 6, WORLD.surfaceY - 0.6 + Math.sin(this.t * 12) * 0.2, this.c.z + Math.sin(this.t) * 6);
    this.root.rotation.y = -this.t;
    this.model.userData.body.rotation.z = Math.sin(this.t * 9) * 0.15;
    this.bounce(dt);
  }
}

// ---------- spawn everything ----------
export function spawnCreatures(scene) {
  const list = [];
  const schools = [];
  const gh = (x, z, up) => new THREE.Vector3(x, groundHeight(x, z) + up, z);
  schools.push(new FishSchool(scene, 'clown', 26, WORLD.reefPos, 25, 10));
  schools.push(new FishSchool(scene, 'tang', 30, new THREE.Vector3(20, 0, 40), 40, 16));
  schools.push(new FishSchool(scene, 'yellow', 40, new THREE.Vector3(-80, 0, -20), 45, 14));
  schools.push(new FishSchool(scene, 'angel', 18, WORLD.cityPos, 55, 12));
  schools.push(new FishSchool(scene, 'yellow', 12,
    new THREE.Vector3(WORLD.cityPos.x, 0, WORLD.cityPos.z + 31), 10, 8));
  schools.push(new FishSchool(scene, 'angel', 10,
    new THREE.Vector3(WORLD.cityPos.x, 0, WORLD.cityPos.z - 30), 6, 8));
  schools.push(new FishSchool(scene, 'clown', 20, new THREE.Vector3(-20, 0, 60), 18, 8));
  list.push(new Whale(scene));
  list.push(new Dolphin(scene, 0), new Dolphin(scene, 0.25));
  list.push(new Seahorse(scene, gh(-125, 30, 6), 0xffc94d), new Seahorse(scene, gh(-100, 0, 8), 0xff8fcf), new Seahorse(scene, gh(95, 60, 5), 0x8fe3ff));
  list.push(new Crab(scene, gh(15, 50, 0), 0xff5a4d), new Crab(scene, gh(120, 30, 0), 0xff8a3d), new Crab(scene, gh(-60, 90, 0), 0xff5a8a), new Crab(scene, gh(-10, -60, 0), 0xff5a4d));
  const T = WORLD.trenchPos;
  list.push(new Jelly(scene, gh(T.x, T.z, 12), 0xff9fe0), new Jelly(scene, gh(T.x + 15, T.z - 10, 16), 0x9fe8ff), new Jelly(scene, gh(T.x - 18, T.z + 8, 10), 0xd0a6ff), new Jelly(scene, gh(-150, -40, 20), 0xffd0a6));
  list.push(new Turtle(scene, new THREE.Vector3(0, 0, 0), 90, 26));
  list.push(new Manta(scene, new THREE.Vector3(-40, 0, 110), 60, 22, 0), new Manta(scene, new THREE.Vector3(120, 0, -40), 50, 25, 2));
  list.push(new Puffer(scene, gh(100, 25, 5)), new Puffer(scene, gh(-30, 40, 4)));
  list.push(new Octopus(scene, gh(75, 75, 0.5)));
  list.push(new Narwhal(scene, new THREE.Vector3(-60, 0, -40), 35, 24, 0), new Narwhal(scene, new THREE.Vector3(-60, 0, -40), 35, 28, 3));
  list.push(new SeaBunny(scene, gh(-115, 40, 0)), new SeaBunny(scene, gh(-140, 5, 0)), new SeaBunny(scene, gh(20, 58, 0)));
  list.push(new Starfish(scene, gh(-8, 62, 0.1), 0xff8a7a), new Starfish(scene, gh(104, 52, 0.1), 0xffb04d), new Starfish(scene, gh(55, 150, 0.1), 0xc89bff));
  list.push(new Otter(scene, new THREE.Vector3(10, 0, 55), 0), new Otter(scene, new THREE.Vector3(-50, 0, 30), 2));
  return {
    schools, list,
    all: [...schools, ...list],
    update(dt, t, player) { for (const s of schools) s.update(dt, t, player); for (const c of list) c.update(dt, t, player); },
  };
}

// Single model per album kind, used for thumbnails.
export function thumbModel(kind) {
  switch (kind) {
    case 'whale': return whaleModel();
    case 'dolphin': return dolphinModel();
    case 'seahorse': return seahorseModel(0xffc94d);
    case 'crab': return crabModel();
    case 'jellyfish': return jellyModel();
    case 'turtle': return turtleModel();
    case 'manta': return mantaModel();
    case 'puffer': return pufferModel();
    case 'octopus': return octopusModel();
    case 'narwhal': return narwhalModel();
    case 'seaBunny': return seaBunnyModel();
    case 'starfish': return starfishModel();
    case 'otter': return otterModel();
    case 'seal': return sealModel();
    case 'lobster': return lobsterModel();
    case 'hermitCrab': return hermitCrabModel();
    case 'snail': return snailModel();
    case 'oyster': return oysterModel();
    case 'anglerfish': return anglerfishModel();
    case 'seaDragon': return seaDragonModel();
    default: {
      const t = Object.values(FISH_TYPES).find((f) => f.kind === kind);
      return new THREE.Mesh(fishGeo(t), paintMat({ vertexColors: true }));
    }
  }
}
