// Coralia, the mermaid city: a pearl palace with spiral shell towers,
// shell houses with glowing windows, a coral gate and pearl lanterns.
import * as THREE from 'three';
import { WORLD, groundHeight, rand, rr, pick, glowTexture } from './util.js';
import { merge, mat, paintMat, withCaustics, withSway } from './geom.js';
import { colliders } from './world.js';

function shellTower(h, r, turns) {
  const pts = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let rad = r * (1 - t * 0.92) * (0.82 + 0.18 * Math.abs(Math.cos(t * turns * Math.PI)));
    if (t < 0.05) rad = r * (1.15 - t);
    pts.push(new THREE.Vector2(Math.max(rad, 0.05), t * h));
  }
  return new THREE.LatheGeometry(pts, 20);
}

function domeHouse(r) {
  const parts = [];
  parts.push({ geo: new THREE.CylinderGeometry(r, r * 1.08, r * 0.9, 16), matrix: mat(0, r * 0.45, 0), color: 0xfff1f6 });
  // ribbed scallop dome
  const dome = new THREE.SphereGeometry(r * 1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = dome.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.06 * Math.cos(a * 8);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  dome.computeVertexNormals();
  parts.push({ geo: dome, matrix: mat(0, r * 0.9, 0), color: pick([0xffb6d9, 0xc6b3ff, 0x9ee6ff, 0xffd59e]) });
  parts.push({ geo: new THREE.SphereGeometry(r * 0.18, 8, 6), matrix: mat(0, r * 2, 0), color: 0xffe08a });
  return merge(parts);
}

export function buildCity(scene) {
  const city = new THREE.Group();
  const C = WORLD.cityPos;
  city.position.set(C.x, groundHeight(C.x, C.z), C.z);
  scene.add(city);
  const baseY = city.position.y;

  const pearl = withCaustics(paintMat({ vertexColors: true, emissive: 0x2a1a30 }), 0.45, 'city');
  const glowWin = new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: true });
  const windows = [];

  // Plaza: a big round mosaic floor
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(42, 44, 1.2, 48), withCaustics(paintMat({ color: 0xe6c9dc }), 0.7, 'plaza'));
  plaza.position.y = -0.2;
  city.add(plaza);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(30, 0.6, 6, 64), paintMat({ color: 0xffc7e4, emissive: 0x401838 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.45;
  city.add(ring);

  // Palace: tiered base, grand dome, four spiral towers.
  const palace = [];
  palace.push({ geo: new THREE.CylinderGeometry(14, 16, 6, 24), matrix: mat(0, 3, 0), color: 0xfff3f8 });
  palace.push({ geo: new THREE.CylinderGeometry(10, 12, 8, 24), matrix: mat(0, 10, 0), color: 0xffe3f1 });
  const dome = new THREE.SphereGeometry(10.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  palace.push({ geo: dome, matrix: mat(0, 14, 0, 0, 0, 0, 1, 1.25, 1), color: 0xffa9d4 });
  palace.push({ geo: new THREE.SphereGeometry(2.2, 12, 8), matrix: mat(0, 27.5, 0), color: 0xfff7d1 });
  palace.push({ geo: new THREE.ConeGeometry(0.6, 5, 8), matrix: mat(0, 31, 0), color: 0xffd36b });
  // grand arch doorway facing the start (+z)
  palace.push({ geo: new THREE.TorusGeometry(4, 0.8, 8, 16, Math.PI), matrix: mat(0, 6, 15.2), color: 0xffd36b });
  palace.push({ geo: new THREE.CylinderGeometry(0.8, 0.9, 6, 10), matrix: mat(-4, 3, 15.2), color: 0xffd36b });
  palace.push({ geo: new THREE.CylinderGeometry(0.8, 0.9, 6, 10), matrix: mat(4, 3, 15.2), color: 0xffd36b });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 15, z = Math.sin(a) * 15;
    palace.push({ geo: shellTower(30, 3.2, 7), matrix: mat(x, 0, z), color: pick([0xfff0f7, 0xf1e4ff]) });
    palace.push({ geo: new THREE.SphereGeometry(0.9, 10, 8), matrix: mat(x, 30.5, z), color: 0xffe08a });
    for (let k = 0; k < 4; k++) windows.push(mat(x + Math.cos(a) * 2.4, 6 + k * 5, z + Math.sin(a) * 2.4, 0, -a + Math.PI / 2, 0, 0.6, 0.9, 1));
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    windows.push(mat(Math.cos(a) * 12.1, 10.5, Math.sin(a) * 12.1, 0, -a + Math.PI / 2, 0, 0.9, 1.4, 1));
  }
  const palaceMesh = new THREE.Mesh(merge(palace), pearl);
  city.add(palaceMesh);
  colliders.push({ x: C.x, z: C.z, r: 15.5, top: baseY + 34 });

  // Shell houses around the plaza, with round glowing windows & doors.
  const houseGeos = [domeHouse(1), domeHouse(1)];
  const houses = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.17;
    if (Math.abs(Math.sin(a) - 1) < 0.08) continue; // keep the front path open
    const rad = 34 + (i % 2) * 7;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const s = rr(3, 5);
    houses.push({ g: i % 2, m: mat(x, 0, z, 0, rr(0, 6), 0, s) });
    // door + windows face the palace
    const fx = -Math.cos(a), fz = -Math.sin(a), yaw = Math.atan2(fx, fz);
    windows.push(mat(x + fx * s * 1.02, s * 0.35, z + fz * s * 1.02, 0, yaw, 0, s * 0.35, s * 0.5, 1));
    windows.push(mat(x + fx * s * 0.9 + fz * s * 0.55, s * 0.62, z + fz * s * 0.9 - fx * s * 0.55, 0, yaw, 0, s * 0.18));
    colliders.push({ x: C.x + x, z: C.z + z, r: s * 1.05, top: baseY + s * 2 });
  }
  [0, 1].forEach((g) => {
    const list = houses.filter((h) => h.g === g);
    const im = new THREE.InstancedMesh(houseGeos[g], pearl, list.length);
    list.forEach((h, i) => im.setMatrixAt(i, h.m));
    im.computeBoundingSphere();
    city.add(im);
  });

  // Small free-standing spiral towers further out
  const tGeo = shellTower(14, 1.6, 6);
  const towerMat = withCaustics(paintMat({ color: 0xffffff, emissive: 0x2a1a30 }), 0.4, 'tower');
  const towers = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    if (Math.abs(Math.sin(a) - 1) < 0.15) continue;
    const r = 52 + rr(-3, 3);
    const x = Math.cos(a) * r, z = Math.sin(a) * r, s = rr(0.8, 1.6);
    towers.push({ m: mat(x, 0, z, 0, rr(0, 6), 0, s), c: new THREE.Color(pick([0xffd1e8, 0xd9ccff, 0xbff0ff, 0xfff0c2])) });
    colliders.push({ x: C.x + x, z: C.z + z, r: 1.9 * s, top: baseY + 14 * s });
  }
  const tim = new THREE.InstancedMesh(tGeo, towerMat, towers.length);
  towers.forEach((t, i) => { tim.setMatrixAt(i, t.m); tim.setColorAt(i, t.c); });
  tim.computeBoundingSphere();
  city.add(tim);

  // Glowing windows: one instanced draw.
  const winGeo = new THREE.CircleGeometry(1, 16);
  const wim = new THREE.InstancedMesh(winGeo, glowWin, windows.length);
  windows.forEach((m, i) => wim.setMatrixAt(i, m));
  wim.computeBoundingSphere();
  city.add(wim);

  // The coral gate on the path from the start, with two pearl lanterns.
  const gate = [];
  gate.push({ geo: new THREE.TorusGeometry(9, 1.3, 8, 20, Math.PI), matrix: mat(0, 0, 0), color: 0xff8fb8 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    gate.push({ geo: new THREE.ConeGeometry(0.6, 2.4, 6), matrix: mat(Math.cos(a) * 9, Math.sin(a) * 9 + 1, 0, 0, 0, a - Math.PI / 2), color: 0xffc2dc });
  }
  const gateMesh = new THREE.Mesh(merge(gate), pearl);
  gateMesh.position.set(0, 0, 62);
  city.add(gateMesh);

  // Lanterns: pearls on poles with glow sprites, along the path & plaza.
  const lanternSpots = [];
  for (let k = 0; k < 6; k++) { lanternSpots.push(new THREE.Vector3(-6, 0, 22 + k * 8)); lanternSpots.push(new THREE.Vector3(6, 0, 22 + k * 8)); }
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + 0.3; lanternSpots.push(new THREE.Vector3(Math.cos(a) * 24, 0, Math.sin(a) * 24)); }
  const poleParts = [];
  lanternSpots.forEach((p) => {
    poleParts.push({ geo: new THREE.CylinderGeometry(0.12, 0.18, 4, 6), matrix: mat(p.x, 2, p.z), color: 0xffd36b });
    poleParts.push({ geo: new THREE.SphereGeometry(0.5, 10, 8), matrix: mat(p.x, 4.4, p.z), color: 0xfffbe8 });
  });
  city.add(new THREE.Mesh(merge(poleParts), paintMat({ vertexColors: true, emissive: 0x806030 })));
  const glow = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0b0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
  lanternSpots.forEach((p) => { const s = new THREE.Sprite(glow); s.position.set(p.x, 4.4, p.z); s.scale.setScalar(3.2); city.add(s); });

  // Floating banners of sea silk on the towers (swaying ribbons)
  const ribbon = new THREE.PlaneGeometry(1.2, 6, 1, 10);
  ribbon.translate(0, -3, 0);
  const ribMat = withSway(paintMat({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x301028 }), { amp: 1.2, freq: 1.4, heightScale: 0.35, key: 'rib' });
  const ribs = new THREE.InstancedMesh(ribbon, ribMat, 4);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    ribs.setMatrixAt(i, mat(Math.cos(a) * 15.5, 28, Math.sin(a) * 15.5, 0, -a, 0));
    ribs.setColorAt(i, new THREE.Color(pick([0xff8fcf, 0x8fe3ff, 0xffd36b, 0xc7a6ff])));
  }
  ribs.frustumCulled = false;
  city.add(ribs);

  // Garden beds of glowing flowers near the palace (seahorse mama lives here)
  const flower = merge([
    { geo: new THREE.CylinderGeometry(0.05, 0.07, 1.2, 4), matrix: mat(0, 0.6, 0), color: 0x5fbf6a },
    { geo: new THREE.SphereGeometry(0.35, 8, 6), matrix: mat(0, 1.3, 0, 0, 0, 0, 1, 0.5, 1), color: 0xffffff },
  ]);
  const fMat = withSway(paintMat({ vertexColors: true, emissive: 0x402030 }), { amp: 0.4, freq: 1.8, heightScale: 0.8, key: 'flw' });
  const fl = [], fc = [];
  for (let i = 0; i < 160; i++) {
    const a = rr(-0.9, 0.9) + Math.PI * 0.5 + (i % 2 ? 0.0 : Math.PI), r = rr(18, 27);
    fl.push(mat(Math.cos(a) * r + rr(-1, 1), 0.2, Math.sin(a) * r, 0, 0, 0, rr(0.7, 1.4)));
    fc.push(new THREE.Color(pick([0xff8fcf, 0xffd36b, 0x8fe3ff, 0xd0a6ff, 0xffffff])));
  }
  const fim = new THREE.InstancedMesh(flower, fMat, fl.length);
  fl.forEach((m, i) => { fim.setMatrixAt(i, m); fim.setColorAt(i, fc[i]); });
  fim.computeBoundingSphere();
  city.add(fim);

  const toWorld = (x, y, z) => new THREE.Vector3(C.x + x, baseY + y, C.z + z);
  return {
    group: city,
    spots: {
      queen: toWorld(0, 4.5, 20),
      gate: toWorld(0, 4, 62),
      garden: toWorld(-20, 3, -2),
      guards: [toWorld(-10, 3.5, 64), toWorld(10, 3.5, 64)],
      citizens: [toWorld(-25, 5, 10), toWorld(22, 6, -18), toWorld(-12, 9, -28), toWorld(28, 4, 16)],
    },
  };
}
