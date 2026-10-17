// Shipwreck Bay and the secret flower tunnel that leads there from the trench.
// Also the two shell houses (one in the bay, one in the castle) joined by a magic portal.
import * as THREE from 'three';
import { WORLD, BAY, TUNNEL, groundHeight, fbm, rand, rr, pick, glowTexture, canvasTexture } from './util.js';
import { merge, mat, segment, lumpify, paintMat, withCaustics, withSway, inject, shared } from './geom.js';
import { colliders, spiralShellGeo } from './world.js';
import { jellyModel } from './creatures.js';
import { lobsterModel, snailModel, hermitCrabModel, sealModel, oysterModel, anglerfishModel, seaDragonModel } from './seafolk.js';

const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const gh = (x, z, up = 0) => v3(x, groundHeight(x, z) + up, z);
const FLOWER_COLORS = [0xff7ab8, 0xffb35c, 0xffe66b, 0xb58cff, 0x6fe8ff, 0xff8f8f, 0x9dff9a, 0xf7a1ff];

// The seabed (main and bay) is cut away inside the straight ends of the tunnel.
const HOLE_GLSL = (() => {
  const [[a0, a1], [b0, b1]] = TUNNEL.ends;
  const f = (v) => `vec3(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
  return `
    float capDist(vec3 p, vec3 a, vec3 b) { vec3 ab = b - a; float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); return length(p - a - ab * h); }
    bool inTunnelHole(vec3 p) {
      return capDist(p, ${f(a0)}, ${f(a1)}) < ${(TUNNEL.radius - 0.15).toFixed(2)} || capDist(p, ${f(b0)}, ${f(b1)}) < ${(TUNNEL.radius - 0.15).toFixed(2)};
    }`;
})();
export function cutTunnelHole(material) {
  return inject(material, { key: 'hole', fragmentHead: HOLE_GLSL, fragment: `if (inTunnelHole(vWPos)) discard;` });
}

// ---------- creatures of the tunnel and the bay ----------
class Folk {
  constructor(scene, kind, model, scale = 1) {
    this.kind = kind; this.model = model;
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ';
    this.root.add(model); this.root.scale.setScalar(scale);
    scene.add(this.root);
    this.pos = this.root.position;
    this.t = rand() * 100; this.happy = 0; this.friendRadius = 5;
  }
  cheer() { this.happy = 1.5; }
  bounce(dt) {
    if (this.happy > 0) { this.happy -= dt; this.model.position.y = Math.abs(Math.sin(this.happy * 8)) * 0.5; }
  }
  face(dir, dt, rate = 3) {
    if (dir.lengthSq() < 1e-6) return;
    let d = Math.atan2(dir.x, dir.z) - this.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, rate * dt);
  }
}
// Swims a loop around a centre (or along the tunnel when given a curve range).
class Swimmer extends Folk {
  constructor(scene, kind, model, scale, path) { super(scene, kind, model, scale); this.path = path; this.speed = path.speed || 0.08; this.t = path.phase ?? rand() * 6; }
  update(dt) {
    this.t += dt * this.speed;
    const P = this.path;
    let p;
    if (P.curve) {
      const u = P.from + (P.to - P.from) * (0.5 + 0.5 * Math.sin(this.t));
      p = P.curve.getPointAt(u).add(v3(Math.sin(this.t * 3) * 1.5, Math.cos(this.t * 2) * 1.2, Math.cos(this.t * 3) * 1.5));
    } else p = v3(P.c.x + Math.cos(this.t) * P.r, P.h + Math.sin(this.t * 2.3) * (P.bob ?? 2), P.c.z + Math.sin(this.t) * P.r);
    const dir = p.clone().sub(this.root.position);
    this.root.position.copy(p);
    this.face(dir, dt, 3);
    const ud = this.model.userData;
    if (ud.tail) ud.tail.rotation.y = Math.sin(this.t * 60) * 0.4;
    ud.flippers?.forEach((f, i) => { f.rotation.z = Math.sin(this.t * 40 + i) * 0.4 * (i ? -1 : 1); });
    ud.leaves?.forEach((l, i) => { l.rotation.z = Math.sin(this.t * 20 + i) * 0.3 + (i % 2 ? 0.7 : -0.7); });
    if (ud.bell) { const k = Math.max(0, Math.sin(this.t * 25)); ud.bell.scale.set(1 - k * 0.15, 1 + k * 0.1, 1 - k * 0.15); }
    this.bounce(dt);
  }
}
// Walks slowly back and forth on the sand.
class Walker extends Folk {
  constructor(scene, kind, model, scale, home, range = 3, speed = 0.3) { super(scene, kind, model, scale); this.home = home.clone(); this.range = range; this.speed = speed; }
  update(dt) {
    this.t += dt * this.speed;
    const x = this.home.x + Math.sin(this.t) * this.range, z = this.home.z + Math.sin(this.t * 0.37) * this.range * 0.5;
    const prev = this.root.position.clone();
    this.root.position.set(x, groundHeight(x, z) + 0.05, z);
    this.face(this.root.position.clone().sub(prev), dt, 4);
    const ud = this.model.userData;
    ud.legs?.forEach((l, i) => { l.rotation.z = Math.sin(this.t * 30 + i) * 0.3; });
    ud.tail?.forEach?.((s, i) => { s.rotation.x = Math.sin(this.t * 6 + i) * 0.12; });
    this.bounce(dt);
  }
}
class Sitter extends Folk {
  constructor(scene, kind, model, scale, pos) { super(scene, kind, model, scale); this.root.position.copy(pos); this.root.rotation.y = rand() * 6; }
  update(dt) {
    this.t += dt;
    const ud = this.model.userData;
    if (ud.lid) ud.lid.rotation.x = -0.35 - Math.max(0, Math.sin(this.t * 0.8)) * 0.5;
    this.bounce(dt);
  }
}

// ---------- the tunnel ----------
function flowerGeo() {
  const parts = [{ geo: segment(v3(0, 0, 0), v3(0, 0.9, 0), 0.05, 0.04, 4), color: 0x5fcf6a }];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push({ geo: new THREE.SphereGeometry(0.22, 7, 5), matrix: mat(Math.cos(a) * 0.24, 0.95, Math.sin(a) * 0.24, 0, 0, 0, 1, 0.45, 1), color: 0xffffff });
  }
  parts.push({ geo: new THREE.SphereGeometry(0.13, 7, 5), matrix: mat(0, 1.0, 0), color: 0xfff2a0 });
  return merge(parts);
}
function mushroomGeo() {
  return merge([
    { geo: segment(v3(0, 0, 0), v3(0, 0.8, 0), 0.12, 0.1, 6), color: 0xfff4e6 },
    { geo: new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat(0, 0.75, 0, 0, 0, 0, 1, 0.6, 1), color: 0xffffff },
  ]);
}
function anemoneGeo() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.3, 0.38, 0.4, 8), matrix: mat(0, 0.2, 0), color: 0xffffff }];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = 0.22;
    parts.push({ geo: segment(v3(Math.cos(a) * r, 0.35, Math.sin(a) * r), v3(Math.cos(a) * r * 2.3, 1.0 + (i % 3) * 0.15, Math.sin(a) * r * 2.3), 0.06, 0.03, 4), color: 0xffffff });
  }
  return merge(parts);
}
function coralGeo() {
  const parts = [];
  const grow = (a, dir, len, r, depth) => {
    const b = a.clone().addScaledVector(dir, len);
    parts.push({ geo: segment(a, b, r, r * 0.7, 5), color: 0xffffff });
    if (depth > 0) for (const s of [-1, 1]) grow(b, dir.clone().applyAxisAngle(v3(0, 0, 1), s * 0.55).applyAxisAngle(UP, rand() * 3).normalize(), len * 0.75, r * 0.7, depth - 1);
    else parts.push({ geo: new THREE.SphereGeometry(r * 1.2, 6, 4), matrix: mat(b.x, b.y, b.z), color: 0xffffff });
  };
  grow(v3(0, 0, 0), UP.clone(), 0.7, 0.12, 3);
  return merge(parts);
}
function crystalGeo() { const g = new THREE.OctahedronGeometry(0.5, 0); g.scale(0.6, 1.8, 0.6); g.translate(0, 0.7, 0); return merge([{ geo: g, color: 0xffffff }]); }
function vineGeo() {
  const parts = [];
  let p = v3(0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const n = p.clone().add(v3(Math.sin(i * 1.7) * 0.25, 0.55, Math.cos(i * 1.3) * 0.25));
    parts.push({ geo: segment(p, n, 0.05, 0.045, 4), color: 0x7fe08a });
    if (i % 2) parts.push({ geo: new THREE.SphereGeometry(0.14, 6, 4), matrix: mat(n.x, n.y, n.z), color: 0xffe0ff });
    p = n;
  }
  return merge(parts);
}

function buildTunnel(group, tunnelCreatures) {
  const R = TUNNEL.radius;
  const tube = new THREE.TubeGeometry(TUNNEL.curve, 260, R, 28, false);
  const p = tube.attributes.position, col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const segs = 261, rad = 29;
  for (let i = 0; i < p.count; i++) {
    const s = Math.floor(i / rad) / segs, a = (i % rad) / (rad - 1);
    // a slow rainbow along the tunnel, with mossy floors and glowing pastel walls
    c.setHSL((s * 1.6 + 0.85) % 1, 0.75, 0.62 + 0.08 * Math.sin(a * Math.PI * 6 + s * 40));
    const floor = Math.max(0, Math.cos(a * Math.PI * 2 - Math.PI)); // 1 at the bottom of the tube
    c.lerp(new THREE.Color(0x6fc98a), floor * floor * 0.5);
    c.multiplyScalar(0.92 + 0.16 * fbm(p.getX(i) * 0.2, p.getY(i) * 0.2 + p.getZ(i) * 0.2, 2));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  tube.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const wallM = paintMat({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x1a1020 });
  inject(wallM, { key: 'tunnelGlow', fragment: `gl_FragColor.rgb += vColor * (0.22 + 0.08 * sin(uTime * 0.8 + vWPos.z * 0.15));` });
  const wall = new THREE.Mesh(tube, wallM);
  wall.name = 'tunnel';
  group.add(wall);

  // decorations fixed to the walls, pointing inward
  const frames = TUNNEL.curve.computeFrenetFrames(400, false);
  const place = (u, ang, inset = 0.25) => {
    const i = Math.round(u * 400);
    const center = TUNNEL.curve.getPointAt(u);
    const n = frames.normals[i], b = frames.binormals[i];
    const out = n.clone().multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang)).normalize();
    // keep the downward side of the tube as the "floor" by aiming angles at world-down
    const pos = center.clone().addScaledVector(out, R - inset);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, out.clone().negate());
    return { pos, q, out };
  };
  const down = (u) => {
    // angle on the ring that points closest to world-down
    const i = Math.round(u * 400), n = frames.normals[i], b = frames.binormals[i];
    return Math.atan2(-b.y, -n.y);
  };
  const addSet = (geo, material, count, scaleRange, colors, angleFn, inset) => {
    const im = new THREE.InstancedMesh(geo, material, count);
    const m4 = new THREE.Matrix4(), s = new THREE.Vector3();
    for (let k = 0; k < count; k++) {
      const u = rr(0.02, 0.98);
      const { pos, q } = place(u, angleFn(u), inset);
      const sc = rr(...scaleRange); s.set(sc, sc, sc);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand() * 6));
      im.setMatrixAt(k, m4.compose(pos, q, s));
      im.setColorAt(k, new THREE.Color(pick(colors)));
    }
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    group.add(im);
    return im;
  };
  const floorish = (u) => down(u) + rr(-1.3, 1.3);
  const anywhere = () => rand() * Math.PI * 2;
  const ceiling = (u) => down(u) + Math.PI + rr(-0.9, 0.9);
  const glowM = (k = 0.45) => paintMat({ vertexColors: true, emissive: new THREE.Color(0xffffff).multiplyScalar(k) });
  addSet(flowerGeo(), withSway(glowM(0.35), { amp: 0.25, freq: 1.4, heightScale: 0.6, key: 'tflower' }), 260, [0.9, 1.8], FLOWER_COLORS, floorish, 0.2);
  addSet(mushroomGeo(), glowM(0.55), 60, [0.8, 1.7], [0xff9ad5, 0x9ae8ff, 0xc8a4ff, 0xfff08a], floorish, 0.2);
  addSet(anemoneGeo(), withSway(glowM(0.3), { amp: 0.3, freq: 1.8, heightScale: 0.8, key: 'tanem' }), 90, [0.8, 1.6], [0xff6fa8, 0xffa04d, 0x9b7bff, 0x4fe0c8], anywhere, 0.25);
  addSet(coralGeo(), glowM(0.3), 70, [1.2, 2.2], [0xff7aa8, 0xffd25e, 0x63e0d0, 0xb48cff], floorish, 0.2);
  addSet(crystalGeo(), paintMat({ vertexColors: true, emissive: 0x6080a0, flatShading: true }), 50, [0.8, 1.8], [0xa8e8ff, 0xffb8f0, 0xd8c0ff], anywhere, 0.3);
  addSet(vineGeo(), withSway(glowM(0.3), { amp: 0.35, freq: 1.0, heightScale: 0.5, key: 'tvine' }), 80, [0.9, 1.5], [0x9be8a0, 0xc0f0a0], ceiling, 0.15);

  // drifting fairy lights
  const N = 420, pos = new Float32Array(N * 3), cols = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const u = rand(), cc = TUNNEL.curve.getPointAt(u);
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (R - 1);
    pos.set([cc.x + Math.cos(a) * r, cc.y + Math.sin(a) * r, cc.z + rr(-1, 1)], k * 3);
    c.set(pick(FLOWER_COLORS)); cols.set([c.r, c.g, c.b], k * 3);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const lights = new THREE.Points(lg, new THREE.PointsMaterial({ map: glowTexture(), size: 0.9, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(lights);

  // flowery stone arches at both mouths
  const archM = paintMat({ vertexColors: true, emissive: 0x302838 });
  for (const u of [0, 1]) {
    const center = TUNNEL.curve.getPointAt(u), tan = TUNNEL.curve.getTangentAt(u);
    const geo = lumpify(new THREE.TorusGeometry(R + 0.9, 1.7, 16, 48), 0.22, 1.1, u * 7);
    const pc = geo.attributes.position, cc2 = new Float32Array(pc.count * 3);
    for (let i = 0; i < pc.count; i++) { c.set(0x9a8cc8).lerp(new THREE.Color(0xd8c0f0), fbm(pc.getX(i) * 0.5, pc.getY(i) * 0.5, 2)); cc2.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(cc2, 3));
    const arch = new THREE.Mesh(geo, archM);
    arch.position.copy(center);
    arch.lookAt(center.clone().add(tan));
    group.add(arch);
    arch.updateMatrixWorld();
    // a crown of flowers on each arch
    const fl = new THREE.InstancedMesh(flowerGeo(), glowM(0.4), 22);
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2;
      const local = v3(Math.cos(a) * (R + 1.4), Math.sin(a) * (R + 1.4), 0.8 * (u ? -1 : 1));
      const wp = arch.localToWorld(local.clone());
      const outDir = arch.localToWorld(v3(Math.cos(a) * 9, Math.sin(a) * 9, 0)).sub(arch.position).normalize();
      m4.compose(wp, new THREE.Quaternion().setFromUnitVectors(UP, outDir), new THREE.Vector3(1.3, 1.3, 1.3));
      fl.setMatrixAt(k, m4); fl.setColorAt(k, new THREE.Color(pick(FLOWER_COLORS)));
    }
    fl.instanceMatrix.needsUpdate = true; fl.computeBoundingSphere();
    group.add(fl);
    // a soft guiding glow just outside each mouth
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd0f8, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(16); halo.position.copy(center).addScaledVector(tan, u ? 3 : -3);
    group.add(halo);
  }

  // tunnel creatures
  const T = TUNNEL.curve;
  const S = group.parent;
  [[0xff9fe0, 0.15, 0.35], [0x9fe8ff, 0.4, 0.6], [0xd0a6ff, 0.62, 0.8], [0xffd0a6, 0.8, 0.95]].forEach(([colr, a, b]) =>
    tunnelCreatures.push(new Swimmer(S, 'jellyfish', jellyModel(colr), 0.8, { curve: T, from: a, to: b, speed: 0.05 })));
  tunnelCreatures.push(new Swimmer(S, 'anglerfish', anglerfishModel(0x6a4fb8), 1.1, { curve: T, from: 0.25, to: 0.55, speed: 0.06 }));
  tunnelCreatures.push(new Swimmer(S, 'anglerfish', anglerfishModel(0x4f7ab8), 1.0, { curve: T, from: 0.55, to: 0.85, speed: 0.07 }));
  tunnelCreatures.push(new Swimmer(S, 'seaDragon', seaDragonModel(0xffb35c), 1.1, { curve: T, from: 0.1, to: 0.3, speed: 0.05 }));
  tunnelCreatures.push(new Swimmer(S, 'seaDragon', seaDragonModel(0xff8fb8), 1.0, { curve: T, from: 0.7, to: 0.9, speed: 0.05 }));
  return wall;
}

// ---------- bay terrain & decor ----------
function buildBayBed(group) {
  const S = BAY.size, N = 150;
  const geo = new THREE.PlaneGeometry(S, S, N, N);
  geo.rotateX(-Math.PI / 2);
  geo.translate(BAY.center.x, 0, WORLD.size / 2 + 2 + S / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const sand = new THREE.Color(0xf0d6a8), peach = new THREE.Color(0xf5b9a8), lilac = new THREE.Color(0xa58cd8), cliff = new THREE.Color(0x7a74b8), moss = new THREE.Color(0x9fd8a0);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = groundHeight(x, z);
    p.setY(i, h);
    c.copy(sand).lerp(peach, THREE.MathUtils.smoothstep(fbm(x * 0.03, z * 0.03 + 9, 3), 0.45, 0.7));
    c.lerp(moss, THREE.MathUtils.smoothstep(fbm(x * 0.02 + 5, z * 0.02, 2), 0.58, 0.75) * 0.45);
    c.lerp(lilac, THREE.MathUtils.smoothstep(h, 4, 22));
    c.lerp(cliff, THREE.MathUtils.smoothstep(h, 30, 70) * 0.7);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = withCaustics(paintMat({ vertexColors: true }), 0.75, 'bed');
  inject(m, { key: 'ripple', fragment: `gl_FragColor.rgb *= 0.94 + 0.06 * sin(vWPos.x * 1.3 + sin(vWPos.z * 0.4) * 2.0);` });
  cutTunnelHole(m);
  const mesh = new THREE.Mesh(geo, m);
  mesh.name = 'bayBed';
  group.add(mesh);
}

function scatterBay(count, minR = 0, maxR = BAY.radius - 8, avoid = []) {
  const pts = [];
  let guard = 0;
  while (pts.length < count && guard++ < count * 30) {
    const a = rand() * Math.PI * 2, r = minR + Math.sqrt(rand()) * (maxR - minR);
    const x = BAY.center.x + Math.cos(a) * r, z = BAY.center.z + Math.sin(a) * r;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    pts.push(gh(x, z));
  }
  return pts;
}
function instanced(geo, material, mats, colors) {
  const im = new THREE.InstancedMesh(geo, material, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  colors.forEach((c, i) => im.setColorAt(i, new THREE.Color(c)));
  im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  return im;
}
function buildBayDecor(group, avoid) {
  const glow = (k) => paintMat({ vertexColors: true, emissive: new THREE.Color(0xffffff).multiplyScalar(k) });
  const pts = scatterBay(110, 5, BAY.radius - 6, avoid);
  group.add(instanced(coralGeo(), withCaustics(glow(0.25), 0.5, 'coral'), pts.map((p) => mat(p.x, p.y - 0.1, p.z, 0, rr(0, 6), 0, rr(2, 4))), pts.map(() => pick([0xff7aa8, 0xff9d5c, 0xffd25e, 0xb48cff, 0x63e0d0]))));
  const a = scatterBay(60, 5, BAY.radius - 6, avoid);
  group.add(instanced(anemoneGeo(), withSway(glow(0.25), { amp: 0.3, freq: 1.6, heightScale: 0.8, key: 'banem' }), a.map((p) => mat(p.x, p.y - 0.1, p.z, 0, rr(0, 6), 0, rr(1, 2))), a.map(() => pick([0xff6fa8, 0xffa04d, 0x9b7bff, 0x4fe0c8]))));
  const f = scatterBay(160, 4, BAY.radius - 4, avoid);
  group.add(instanced(flowerGeo(), withSway(glow(0.3), { amp: 0.25, freq: 1.3, heightScale: 0.6, key: 'bflower' }), f.map((p) => mat(p.x, p.y - 0.05, p.z, 0, rr(0, 6), 0, rr(0.9, 1.6))), f.map(() => pick(FLOWER_COLORS))));
  // kelp groves near the cliffs
  // (same wavy, tapered blades as the kelp forest)
  const blade = new THREE.PlaneGeometry(0.9, 1, 1, 16);
  blade.translate(0, 0.5, 0);
  const bp = blade.attributes.position, bc = new Float32Array(bp.count * 3);
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i);
    bp.setX(i, bp.getX(i) * (1 - y * 0.55) * (0.8 + 0.25 * Math.sin(y * 30)) + Math.sin(y * 6) * 0.25);
    const cc = new THREE.Color(0x3f9a4a).lerp(new THREE.Color(0xe6e070), Math.pow(y, 0.8));
    bc.set([cc.r, cc.g, cc.b], i * 3);
  }
  blade.computeVertexNormals();
  blade.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const kelpM = withSway(paintMat({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x15301a }), { amp: 2.2, freq: 0.7, heightScale: 1.0, key: 'bkelp' });
  const kp = [], kc = [];
  scatterBay(60, BAY.radius - 40, BAY.radius - 6, avoid).forEach((pt) => {
    const h = rr(12, 28);
    for (let j = 0; j < 3; j++) { kp.push(mat(pt.x + rr(-1, 1), pt.y - 0.5, pt.z + rr(-1, 1), 0, rr(0, Math.PI), 0, rr(0.8, 1.4), h * rr(0.7, 1), 1)); kc.push(new THREE.Color().setHSL(rr(0.22, 0.33), 0.6, rr(0.45, 0.62))); }
  });
  const kelp = instanced(blade, kelpM, kp, kc);
  kelp.frustumCulled = false;
  group.add(kelp);
  // rocks
  const rockGeo = lumpify(new THREE.IcosahedronGeometry(1, 2), 0.35, 1.2, 3);
  const r = scatterBay(40, 10, BAY.radius - 5, avoid);
  group.add(instanced(rockGeo, withCaustics(paintMat({ color: 0xffffff, emissive: 0x101020, flatShading: true }), 0.5, 'rock'), r.map((p) => mat(p.x, p.y, p.z, rr(0, 3), rr(0, 6), 0, rr(1.5, 4), rr(1, 2.5), rr(1.5, 4))), r.map(() => pick([0x8d86c4, 0x9fa0c8, 0x7f9cc0]))));
  // shells & starfish on the sand
  const sh = spiralShellGeo(); sh.rotateZ(Math.PI / 2.4);
  const s = scatterBay(60, 0, BAY.radius - 8, avoid);
  group.add(instanced(sh, withCaustics(paintMat({ color: 0xffffff, emissive: 0x201018 }), 0.5, 'shell'), s.map((p) => mat(p.x, p.y + 0.2, p.z, 0, rr(0, 6), 0, rr(0.4, 0.9))), s.map(() => pick([0xfff0e0, 0xffd6e8, 0xf6e1c3, 0xe7d4ff]))));
}

// ---------- shipwrecks ----------
function hullGeo(len, w, depth) {
  const g = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const bow = Math.max(0, z);
    x *= w * (1 - bow * bow * 0.75); z *= len; y *= depth;
    p.setXYZ(i, x, y, z);
    const plank = Math.floor((y / depth + 1) * 9);
    c.set(plank % 2 ? 0x8a5a3c : 0x9c6a48).lerp(new THREE.Color(0x5a8a7a), THREE.MathUtils.smoothstep(-y / depth, 0.4, 1) * 0.5);
    c.multiplyScalar(0.85 + 0.25 * fbm(x * 0.4, z * 0.4, 2));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function sailGeo(w, h, seed) {
  const g = new THREE.PlaneGeometry(w, h, 8, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sin(x * 0.8 + seed) * 0.4 + Math.sin(y * 0.6) * 0.3);
    // ragged bottom edge
    if (y < -h / 2 + 0.1) p.setY(i, y + Math.abs(Math.sin(x * 3 + seed)) * h * 0.25);
  }
  g.computeVertexNormals();
  return g;
}
function shipwreck({ len = 12, w = 4, depth = 3.5, masts = 2, broken = false, seed = 0 }) {
  const g = new THREE.Group();
  const wood = paintMat({ color: 0x9a6a48, emissive: 0x24140a });
  const hullM = paintMat({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x1a0e08 });
  const hull = new THREE.Mesh(hullGeo(len, w, depth), hullM);
  g.add(hull);
  // broken deck planks
  for (let i = -4; i <= 4; i++) {
    if (broken && Math.abs(i) < 2) continue;
    if ((i + seed) % 3 === 0) continue;
    const zz = i * len * 0.2;
    const ww = w * (1 - Math.max(0, zz / len) ** 2 * 0.75) * 1.9;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.25, len * 0.17), wood);
    plank.position.set(0, -0.1, zz); plank.rotation.z = Math.sin(i * 2.3 + seed) * 0.06;
    g.add(plank);
  }
  // stern cabin with windows
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 1.5, 2.6, len * 0.28), wood);
  cabin.position.set(0, 1.2, -len * 0.62); g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.7, 0.3, len * 0.32), paintMat({ color: 0x7a4a30, emissive: 0x1a0c06 }));
  roof.position.set(0, 2.6, -len * 0.62); roof.rotation.z = 0.08; g.add(roof);
  const glass = paintMat({ color: 0xffe9a0, emissive: 0x8a6a20 });
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), glass);
    win.position.set(s * (w * 0.75 + 0.02), 1.4, -len * 0.62); win.rotation.y = s * Math.PI / 2; g.add(win);
    for (let i = -2; i <= 2; i++) {
      const hole = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 5, 12), paintMat({ color: 0xc9a050, emissive: 0x3a2808 }));
      const zz = i * len * 0.25;
      hole.position.set(s * w * (1 - Math.max(0, zz / len) ** 2 * 0.75) * 0.93, -depth * 0.35, zz); hole.rotation.y = Math.PI / 2;
      g.add(hole);
    }
  }
  // masts (some snapped), tattered sails
  const sailM = paintMat({ color: 0xf2e6cc, emissive: 0x3a3428, side: THREE.DoubleSide });
  for (let m = 0; m < masts; m++) {
    const zz = len * (0.35 - m * 0.55);
    const snapped = (m + seed) % 2 === 1;
    const h = snapped ? rr(3, 5) : len * 0.9;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 8), wood);
    mast.position.set(0, h / 2, zz); mast.rotation.z = snapped ? 0.1 : Math.sin(seed + m) * 0.08;
    g.add(mast);
    if (!snapped) {
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, w * 2.4, 6), wood);
      yard.rotation.z = Math.PI / 2; yard.position.set(0, h * 0.75, zz); g.add(yard);
      const sail = new THREE.Mesh(sailGeo(w * 2.2, h * 0.45, seed + m), sailM);
      sail.position.set(0, h * 0.5, zz + 0.3); g.add(sail);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), paintMat({ color: 0xff6f91, emissive: 0x401020, side: THREE.DoubleSide }));
      flag.position.set(0.7, h + 0.2, zz); g.add(flag);
    }
  }
  // seaweed and barnacles growing on the hull
  const weedM = withSway(paintMat({ color: 0x5fbf6a, emissive: 0x0a2a10 }), { amp: 0.5, freq: 1.2, heightScale: 0.4, key: 'weed' });
  for (let i = 0; i < 14; i++) {
    const zz = rr(-len * 0.8, len * 0.7), s = rand() < 0.5 ? -1 : 1;
    const x = s * w * (1 - Math.max(0, zz / len) ** 2 * 0.75) * 0.9;
    const weed = new THREE.Mesh(segment(v3(x, -0.2, zz), v3(x * 1.05, -0.2 + rr(1.5, 3), zz + rr(-0.5, 0.5)), 0.12, 0.04, 4), weedM);
    g.add(weed);
  }
  const barn = paintMat({ color: 0xe8d8f0, emissive: 0x302838 });
  for (let i = 0; i < 20; i++) {
    const zz = rr(-len * 0.8, len * 0.6), s = rand() < 0.5 ? -1 : 1, yy = rr(-depth * 0.8, -0.5);
    const k = 1 - (yy / depth) ** 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(rr(0.12, 0.25), 6, 4), barn);
    b.position.set(s * w * Math.sqrt(Math.max(0.05, k)) * (1 - Math.max(0, zz / len) ** 2 * 0.75), yy, zz); g.add(b);
  }
  return g;
}
function treasureChest() {
  const g = new THREE.Group();
  const wood = paintMat({ color: 0xa0683c, emissive: 0x2a160a });
  const gold = paintMat({ color: 0xffd25e, emissive: 0x6a4a10 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1), wood); box.position.y = 0.45; g.add(box);
  const lid = new THREE.Group(); lid.position.set(0, 0.9, -0.5); g.add(lid);
  const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 12, 1, false, 0, Math.PI), wood);
  lm.rotation.z = Math.PI / 2; lm.position.z = 0.5; lid.add(lm);
  lid.rotation.x = -1.1;
  for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10), gold); c.position.set(rr(-0.6, 0.6), 0.92 + rand() * 0.1, rr(-0.35, 0.35)); c.rotation.set(rr(-0.4, 0.4), 0, rr(-0.4, 0.4)); g.add(c); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe08a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(3.5); glow.position.y = 1.1; g.add(glow);
  return g;
}

// ---------- shell houses & portals ----------
function portalMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { uTime: shared.uTime, uOn: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uOn;
      void main(){
        vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
        float swirl = sin(a * 5.0 + r * 10.0 - uTime * 3.0) * 0.5 + 0.5;
        vec3 rainbow = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + a / 6.2831 + r * 0.6 - uTime * 0.2));
        vec3 sleep = vec3(0.35, 0.42, 0.6) * (0.6 + 0.2 * swirl);
        vec3 c = mix(sleep, mix(rainbow, vec3(1.0), (1.0 - r) * 0.5) * (0.75 + 0.35 * swirl), uOn);
        float alpha = (1.0 - smoothstep(0.85, 1.0, r)) * mix(0.55, 0.92, uOn);
        gl_FragColor = vec4(c, alpha);
        #include <colorspace_fragment>
      }`,
  });
}
export const HOUSE_R = 7.5, HOUSE_WALL = 6.5, HOUSE_ROOF = 15;
// A big spiral shell you can swim into: round walls with a door, a cone roof, cosy furniture and a portal.
function shellHouse(base, yaw, tint) {
  const g = new THREE.Group();
  g.position.copy(base); g.rotation.y = yaw;
  const R = HOUSE_R, H = HOUSE_WALL, door = 0.34; // door half-angle (radians), facing local +z
  // walls: a lathe with a gap for the door, ribbed like a shell
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(R * (1.04 - 0.06 * t) + 0.25 * Math.sin(t * Math.PI), t * H)); }
  const wallG = new THREE.LatheGeometry(prof, 40, door, Math.PI * 2 - door * 2);
  const wp = wallG.attributes.position, wc = new Float32Array(wp.count * 3), c = new THREE.Color();
  for (let i = 0; i < wp.count; i++) {
    const a = Math.atan2(wp.getZ(i), wp.getX(i)), y = wp.getY(i);
    const rib = 0.5 + 0.5 * Math.sin(a * 14 + y * 0.6);
    const k = 1 + 0.035 * rib; wp.setX(i, wp.getX(i) * k); wp.setZ(i, wp.getZ(i) * k);
    c.set(tint).lerp(new THREE.Color(0xfff4ec), rib * 0.55 + (y / H) * 0.2);
    wc.set([c.r, c.g, c.b], i * 3);
  }
  wallG.setAttribute('color', new THREE.BufferAttribute(wc, 3));
  wallG.computeVertexNormals();
  const shellM = paintMat({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x5a4048 });
  g.add(new THREE.Mesh(wallG, shellM));
  // spiral cone roof
  const roofProf = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; roofProf.push(new THREE.Vector2(Math.max(0.05, (R + 0.6) * Math.pow(1 - t, 1.15) * (0.9 + 0.1 * Math.cos(t * Math.PI * 10))), H + t * (HOUSE_ROOF - H))); }
  const roofG = new THREE.LatheGeometry(roofProf, 36);
  const rp = roofG.attributes.position, rc = new Float32Array(rp.count * 3);
  for (let i = 0; i < rp.count; i++) {
    const a = Math.atan2(rp.getZ(i), rp.getX(i)), y = rp.getY(i);
    const band = 0.5 + 0.5 * Math.sin(a + y * 1.6);
    c.set(tint).lerp(new THREE.Color(0xffffff), band * 0.5).multiplyScalar(0.92 + band * 0.1);
    rc.set([c.r, c.g, c.b], i * 3);
  }
  roofG.setAttribute('color', new THREE.BufferAttribute(rc, 3));
  roofG.computeVertexNormals();
  g.add(new THREE.Mesh(roofG, shellM));
  // pearly door arch
  const arch = new THREE.Mesh(new THREE.TorusGeometry(R * Math.sin(door), 0.35, 8, 20, Math.PI), paintMat({ color: 0xfff0f6, emissive: 0x5a4a50 }));
  arch.position.set(0, H * 0.45, R * Math.cos(door)); g.add(arch);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, H * 0.45, 8), arch.material);
    post.position.set(s * R * Math.sin(door), H * 0.225, R * Math.cos(door)); g.add(post);
  }
  // floor, rug and cosy furniture
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 32), paintMat({ color: 0xf6d8c8, emissive: 0x3a2a24 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.35; g.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3, 24), paintMat({ color: 0x9ad8e8, emissive: 0x1a3a40 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.4, 1); g.add(rug);
  const bed = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 2.2, 6, 12), paintMat({ color: 0xffe066, emissive: 0x4a3a10 }));
  bed.rotation.z = Math.PI / 2; bed.scale.set(0.6, 1, 1); bed.position.set(-4.4, 0.6, -1.5); bed.rotation.y = 0.5; g.add(bed);
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), paintMat({ color: 0xffb3d1, emissive: 0x4a2030 }));
  pillow.scale.set(1, 0.6, 0.8); pillow.position.set(-5.2, 1.1, -2.3); g.add(pillow);
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.25, 16), paintMat({ color: 0xff9fc0, emissive: 0x401828 }));
  tableTop.position.set(3.6, 1.5, 0.5); g.add(tableTop);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.5, 8), paintMat({ color: 0xfff4e6, emissive: 0x3a3428 }));
  stem.position.set(3.6, 0.75, 0.5); g.add(stem);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), paintMat({ color: 0xfff6ff, emissive: 0xc0a8d0 }));
  lamp.position.set(3.6, 2, 0.5); g.add(lamp);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe8c0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  lampGlow.scale.setScalar(5); lampGlow.position.copy(lamp.position); g.add(lampGlow);
  // shelf of little shells
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 0.8), paintMat({ color: 0xd8b088, emissive: 0x2a1a0a }));
  shelf.position.set(4.5, 3.5, -3.6); shelf.rotation.y = -0.9; g.add(shelf);
  const sg = spiralShellGeo(4, 0.6, 0.25);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(sg, paintMat({ color: pick([0xffd6e8, 0xe7d4ff, 0xfff0e0, 0xb8f0ff]), emissive: 0x302028 }));
    s.position.set(3.6 + i * 0.55, 3.62, -2.6 - i * 0.75); s.rotation.z = 1.2; g.add(s);
  }
  // portholes
  for (const a of [-1.2, 1.2, Math.PI]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.15, 6, 16), paintMat({ color: 0xffe0a0, emissive: 0x4a3a10 }));
    ring.position.set(Math.sin(a) * (R + 0.25), H * 0.6, Math.cos(a) * (R + 0.25)); ring.rotation.y = a; g.add(ring);
  }
  // portal at the back wall
  const pz = -R + 1.3;
  const frame = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.3, 10, 32), paintMat({ color: 0xffd8f0, emissive: 0x5a3a50 }));
  frame.position.set(0, 3.1, pz); g.add(frame);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), paintMat({ color: 0xffffff, emissive: 0x8a80a0 }));
    pearl.position.set(Math.cos(a) * 2.3, 3.1 + Math.sin(a) * 2.3, pz + 0.25); g.add(pearl);
  }
  const discM = portalMaterial();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), discM);
  disc.position.set(0, 3.1, pz); g.add(disc);
  const pglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xe8c8ff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
  pglow.scale.setScalar(9); pglow.position.set(0, 3.1, pz + 0.5); g.add(pglow);

  g.updateMatrixWorld(true);
  const toWorld = (x, y, z) => g.localToWorld(v3(x, y, z));
  // walls block swimming except at the door
  const segs = 18;
  for (let i = 0; i < segs; i++) {
    const a = (i + 0.5) / segs * Math.PI * 2; // local angle from +z
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < door) continue;
    const lp = toWorld(Math.sin(a) * R, 0, Math.cos(a) * R);
    const wa = a + yaw; // world angle from +z
    colliders.push({ x: lp.x, z: lp.z, hw: R * Math.sin(Math.PI / segs) + 0.3, hd: 0.5, yaw: wa, top: base.y + H });
  }
  return {
    group: g, base: base.clone(), center: toWorld(0, 0, 0),
    portal: { pos: toWorld(0, 3.1, pz), exit: toWorld(0, 2.5, pz + 4.5), facing: yaw, disc: discM, glow: pglow },
    door: toWorld(0, 2, R + 3),
  };
}

// ---------- build everything ----------
export function buildBay(scene, creatures) {
  const group = new THREE.Group();
  scene.add(group);
  // cut the main seabed open at the tunnel mouth
  const seabed = scene.getObjectByName('seabed');
  if (seabed) cutTunnelHole(seabed.material);

  const extra = [];
  buildTunnel(group, extra);
  buildBayBed(group);

  const C = BAY.center;
  // landmarks in the bay
  const houseBase = gh(C.x - 38, C.z - 40);
  const wrecks = [
    { at: [C.x + 38, C.z - 18], yaw: 0.6, roll: 0.22, o: { len: 19, w: 6, depth: 5, masts: 2, seed: 1 } },
    { at: [C.x - 22, C.z + 42], yaw: -1.1, roll: -0.3, o: { len: 15, w: 5.2, depth: 4.5, masts: 2, broken: true, seed: 2 } },
    { at: [C.x + 52, C.z + 48], yaw: 2.4, roll: 0.12, o: { len: 11, w: 4, depth: 3.5, masts: 1, seed: 3 } },
    { at: [C.x - 62, C.z + 2], yaw: 1.6, roll: -0.5, o: { len: 16, w: 5.4, depth: 4.8, masts: 2, seed: 4 } },
  ];
  const avoid = [[houseBase.x, houseBase.z, 14], ...wrecks.map((w) => [w.at[0], w.at[1], w.o.len + 6]), [62, 350, 14]];
  buildBayDecor(group, avoid);
  const wreckInfo = wrecks.map((w) => {
    const [x, z] = w.at;
    const y = groundHeight(x, z);
    const ship = shipwreck(w.o);
    ship.position.set(x, y + w.o.depth * 0.45, z);
    ship.rotation.set(0, w.yaw, w.roll);
    group.add(ship);
    colliders.push({ x, z, hw: w.o.w * 0.95, hd: w.o.len * 0.95, yaw: w.yaw, top: y + w.o.depth * 0.45 + 0.3 });
    const chest = treasureChest();
    const side = v3(Math.cos(w.yaw), 0, -Math.sin(w.yaw)).multiplyScalar(w.o.w + 3);
    const cp = gh(x + side.x, z + side.z);
    chest.position.copy(cp); chest.rotation.y = w.yaw + 1.2; group.add(chest);
    // a spot on deck and a spot by the chest
    const deck = v3(x, y + w.o.depth * 0.45 + 2.2, z);
    return { pos: v3(x, y, z), deck, chest: cp.clone().add(v3(0, 2.2, 0)), yaw: w.yaw, len: w.o.len, w: w.o.w };
  });

  // shell houses: one here, one in the castle
  const bayHouse = shellHouse(houseBase, 0.9, 0xffc8dc);
  group.add(bayHouse.group);
  const CP = WORLD.cityPos;
  const castleBase = v3(CP.x - 40, 0, CP.z - 6);
  castleBase.y = groundHeight(castleBase.x, castleBase.z);
  const castleHouse = shellHouse(castleBase, Math.PI / 2, 0xc8e0ff);
  group.add(castleHouse.group);

  // wild friends of the bay
  extra.push(new Swimmer(scene, 'seal', sealModel(), 1.3, { c: C, r: 45, h: 14, bob: 4, speed: 0.12 }));
  extra.push(new Swimmer(scene, 'seal', sealModel(), 1.1, { c: v3(C.x + 20, 0, C.z + 30), r: 25, h: 9, bob: 3, speed: -0.15, phase: 2 }));
  extra.push(new Swimmer(scene, 'seaDragon', seaDragonModel(0xffd36b), 1.3, { c: v3(C.x - 30, 0, C.z + 10), r: 12, h: 4, bob: 1, speed: 0.05 }));
  extra.push(new Swimmer(scene, 'anglerfish', anglerfishModel(0x8a5fd0), 1.2, { c: v3(C.x + 50, 0, C.z + 45), r: 8, h: 3, bob: 1, speed: 0.07 }));
  [[C.x + 10, C.z - 20, 0xff5a3c], [C.x - 45, C.z + 30, 0xff7a5c]].forEach(([x, z, col]) =>
    extra.push(new Walker(scene, 'lobster', lobsterModel(col), 1.3, gh(x, z), 4, 0.25)));
  [[C.x + 25, C.z + 10, 0xffb3d1], [C.x - 10, C.z + 60, 0xb8e8ff], [C.x + 65, C.z + 5, 0xffe08a]].forEach(([x, z, col]) =>
    extra.push(new Walker(scene, 'hermitCrab', hermitCrabModel(col), 1.4, gh(x, z), 2.5, 0.35)));
  [[C.x - 5, C.z - 50, 0xd9a3ff], [C.x + 40, C.z + 70, 0x9ae8c8]].forEach(([x, z, col]) =>
    extra.push(new Walker(scene, 'snail', snailModel(col), 1.4, gh(x, z), 1.5, 0.08)));
  [[C.x + 15, C.z + 35], [C.x - 50, C.z - 20]].forEach(([x, z]) => extra.push(new Sitter(scene, 'oyster', oysterModel(), 1.6, gh(x, z, 0.1))));
  for (const c of extra) { creatures.list.push(c); creatures.all.push(c); }

  // where the story puts things
  const T = TUNNEL.curve;
  const spots = {
    tunnelMouth: T.getPointAt(0).add(v3(0, 0, -6)),
    tunnelExit: T.getPointAt(1).add(v3(0, 0, 6)),
    whelk: gh(52, 186, 0.5),
    pinch: wreckInfo[0].chest.clone().add(v3(2, -1.6, 2)),
    clawsworth: wreckInfo[1].chest.clone().add(v3(-2, -1.6, 1)),
    rosa: gh(houseBase.x + 12, houseBase.z + 6),
    shellby: gh(wreckInfo[2].chest.x + 3, wreckInfo[2].chest.z - 2),
    selkie: wreckInfo[3].deck.clone().add(v3(0, 1, 0)),
    madamePearl: castleHouse.group.localToWorld(v3(-3.5, 0.2, -2)),
    coins: [wreckInfo[0].deck, wreckInfo[0].chest, wreckInfo[1].deck, wreckInfo[2].chest, wreckInfo[3].chest],
    pepper: [0.3, 0.55, 0.8].map((u) => { const p = T.getPointAt(u); return p.add(v3(0, -TUNNEL.radius + 2.2, 0)); }),
    shells: [gh(C.x + 70, C.z - 40, 2), gh(C.x - 70, C.z + 50, 2), gh(C.x + 10, C.z + 85, 2)],
    rosaPot: gh(houseBase.x + 14, houseBase.z + 9),
  };
  // Chef Rosa's bubbling soup pot
  const pot = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), paintMat({ color: 0x5a5a7a, emissive: 0x14141e, side: THREE.DoubleSide }));
  pot.position.copy(spots.rosaPot).add(v3(0, 1.1, 0)); group.add(pot);
  const soup = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16), paintMat({ color: 0xffa04d, emissive: 0x6a3010 }));
  soup.rotation.x = -Math.PI / 2; soup.position.copy(pot.position).add(v3(0, 0.55, 0)); group.add(soup);

  const houses = [bayHouse, castleHouse].map((h) => ({ x: h.center.x, z: h.center.z, y: h.base.y }));
  return {
    group, spots, wrecks: wreckInfo, houses,
    bayHouse, castleHouse,
    setPortal(on) { for (const h of [bayHouse, castleHouse]) { h.portal.disc.uniforms.uOn.value = on ? 1 : 0; h.portal.glow.material.opacity = on ? 0.55 : 0.15; } },
    update(dt, t) { /* creatures update with the rest; the portal shader animates on shared time */ },
  };
}

// When the player is inside a shell house, keep the camera inside too.
export function houseCamera(cam, pos, houses) {
  for (const h of houses) {
    if (Math.hypot(pos.x - h.x, pos.z - h.z) > HOUSE_R - 0.3 || pos.y > h.y + HOUSE_WALL) continue;
    const dx = cam.x - h.x, dz = cam.z - h.z, r = Math.hypot(dx, dz), lim = HOUSE_R - 1.2;
    if (r > lim) { cam.x = h.x + dx * lim / r; cam.z = h.z + dz * lim / r; }
    cam.y = Math.min(cam.y, h.y + HOUSE_WALL - 0.4);
  }
}

// Keep the player inside shell houses (no swimming out through the roof) — used by the player.
export function houseLimit(pos, houses) {
  for (const h of houses) {
    const r = Math.hypot(pos.x - h.x, pos.z - h.z);
    if (r > HOUSE_R + 0.8) continue;
    if (pos.y < h.y + HOUSE_WALL + 0.5) { if (r < HOUSE_R - 0.3) pos.y = Math.min(pos.y, h.y + HOUSE_WALL - 0.8); }
    else {
      const roofH = h.y + HOUSE_WALL + (HOUSE_ROOF - HOUSE_WALL) * Math.max(0, 1 - r / (HOUSE_R + 0.6));
      pos.y = Math.max(pos.y, roofH + 1.2);
    }
  }
}
