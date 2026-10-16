// Coralia: a walled mermaid castle district with an open courtyard, palace,
// side galleries and rooms. All passages are real openings the player can use.
import * as THREE from 'three';
import { WORLD, groundHeight, glowTexture } from './util.js';
import { merge, mat, paintMat, withCaustics, withSway } from './geom.js';
import { colliders } from './world.js';

const SHELL = 0xffecf2, ROSE = 0xffb8d9, LILAC = 0xd5bded;
const AQUA = 0xa4e7e6, GOLD = 0xffd988, PEARL = 0xfffbeb;

function shellSpire(h, r) {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    pts.push(new THREE.Vector2(Math.max(0.06, r * (1 - t) * (1 + 0.12 * Math.cos(t * Math.PI * 12))), h * t));
  }
  return new THREE.LatheGeometry(pts, 12);
}

export function buildCity(scene) {
  const city = new THREE.Group();
  const C = WORLD.cityPos;
  const baseY = groundHeight(C.x, C.z);
  city.position.set(C.x, baseY, C.z);
  scene.add(city);
  const parts = [], trim = [], lamps = [], windows = [];
  const bodyMat = withCaustics(paintMat({ vertexColors: true, emissive: 0x241323 }), 0.38, 'city');
  const trimMat = withCaustics(paintMat({ vertexColors: true, emissive: 0x30201a }), 0.3, 'city');
  const local = (x, y, z) => new THREE.Vector3(C.x + x, baseY + y, C.z + z);
  const box = (list, x, y, z, w, h, d, color) => list.push({ geo: new THREE.BoxGeometry(w, h, d), matrix: mat(x, y, z), color });
  const ball = (list, x, y, z, r, color, sx = 1, sy = 1, sz = 1) =>
    list.push({ geo: new THREE.SphereGeometry(r, 10, 8), matrix: mat(x, y, z, 0, 0, 0, sx, sy, sz), color });
  const column = (list, x, z, h, r = 0.8, color = PEARL) => {
    list.push({ geo: new THREE.CylinderGeometry(r * 0.72, r, h, 10), matrix: mat(x, h / 2, z), color });
    ball(trim, x, h + 0.35, z, r * 0.95, GOLD, 1, 0.45, 1);
  };
  const wall = (x, z, w, d, h, color = SHELL) => {
    box(parts, x, h / 2, z, w, h, d, color);
    box(trim, x, h + 0.35, z, w + 0.6, 0.7, d + 0.6, GOLD);
    colliders.push({ x: C.x + x, z: C.z + z, hw: w / 2, hd: d / 2, top: baseY + h });
  };
  const arch = (x, z, r, y, color = GOLD, yaw = 0) => {
    trim.push({ geo: new THREE.TorusGeometry(r, 0.55, 6, 20, Math.PI), matrix: mat(x, y, z, 0, yaw, 0), color });
    for (const side of [-1, 1]) {
      const dx = Math.cos(yaw) * r * side, dz = -Math.sin(yaw) * r * side;
      column(trim, x + dx, z + dz, y, 0.6, color);
    }
  };
  const tower = (x, z, h, r, color = LILAC) => {
    parts.push({ geo: new THREE.CylinderGeometry(r * 0.86, r, h, 12), matrix: mat(x, h / 2, z), color: SHELL });
    parts.push({ geo: shellSpire(h * 0.46, r * 1.25), matrix: mat(x, h, z), color });
    trim.push({ geo: new THREE.TorusGeometry(r * 1.03, 0.65, 5, 18), matrix: mat(x, h - 0.2, z, Math.PI / 2), color: GOLD });
    ball(trim, x, h * 1.46, z, 0.9, PEARL);
    for (let level = 0; level < 2; level++) {
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const wx = x + Math.sin(a) * r * 0.9, wz = z + Math.cos(a) * r * 0.9;
        windows.push(mat(wx, 8 + level * 7, wz, 0, a, 0, 0.7, 1.3, 1));
      }
    }
    colliders.push({ x: C.x + x, z: C.z + z, r, top: baseY + h });
  };

  // A broad shell terrace replaces the old tiny round plaza.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(160, 1, 136),
    withCaustics(paintMat({ color: 0xe7d5db }), 0.7, 'plaza'));
  floor.position.y = -0.5;
  city.add(floor);
  for (const x of [-54, -30, 0, 30, 54]) {
    box(trim, x, 0.08, 31, x === 0 ? 15 : 9, 0.12, 57, x === 0 ? PEARL : AQUA);
  }
  box(trim, 0, 0.1, -20, 98, 0.14, 8, PEARL);

  // First ring: a real outer wall, nine watchtowers, and a 22-unit entrance.
  wall(-45, 67, 66, 3, 12, ROSE);
  wall(45, 67, 66, 3, 12, ROSE);
  wall(0, -67, 156, 3, 13, LILAC);
  wall(-79, 0, 3, 134, 13, LILAC);
  wall(79, 0, 3, 134, 13, LILAC);
  for (let x = -73; x <= 73; x += 8) {
    if (Math.abs(x) > 13) box(trim, x, 13.2, 67, 3, 2.2, 4, PEARL);
    box(trim, x, 14, -67, 3, 2.4, 4, PEARL);
  }
  for (let z = -59; z <= 59; z += 10) {
    for (const x of [-79, 79]) box(trim, x, 14, z, 4, 2.4, 3, PEARL);
  }
  for (const [x, z, h, r, color] of [
    [-79, 67, 28, 6, ROSE], [79, 67, 28, 6, ROSE],
    [-79, -67, 31, 6, AQUA], [79, -67, 31, 6, AQUA],
    [-79, 0, 24, 5, LILAC], [79, 0, 24, 5, LILAC],
    [-14, 67, 29, 5, LILAC], [14, 67, 29, 5, LILAC],
    [0, -67, 36, 7, ROSE],
  ]) tower(x, z, h, r, color);
  arch(0, 67.5, 9, 12, GOLD);
  // The doors are permanently open and sit clear of the passage.
  box(trim, -12.5, 5, 62, 1.5, 10, 7, AQUA);
  box(trim, 12.5, 5, 62, 1.5, 10, 7, AQUA);

  // Great hall: central nave and connected side aisles. The wall gaps are
  // physical doorways, including the broad front entrance.
  wall(-16, -3, 15, 3, 23);
  wall(16, -3, 15, 3, 23);
  wall(0, -59, 48, 3, 24);
  for (const x of [-24, 24]) {
    wall(x, -49, 3, 20, 22);
    wall(x, -18, 3, 27, 22);
  }
  arch(0, -0.9, 7.4, 14, GOLD);
  for (const x of [-18, -12, 12, 18]) {
    windows.push(mat(x, 12, -1.38, 0, 0, 0, 0.8, 1.8, 1));
    trim.push({ geo: new THREE.TorusGeometry(1.45, 0.22, 5, 12, Math.PI),
      matrix: mat(x, 14.1, -1.2), color: GOLD });
  }
  for (const x of [-16, 16]) {
    for (const z of [-12, -24, -36, -48]) column(parts, x, z, 21, 1, PEARL);
  }
  // High vault leaves ample headroom for swimming through the interior.
  parts.push({ geo: new THREE.SphereGeometry(24, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    matrix: mat(0, 23, -31, 0, 0, 0, 1, 0.82, 1.25), color: ROSE });
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, j) => {
      const t = j * Math.PI / 16;
      return new THREE.Vector3(24 * Math.cos(a) * Math.cos(t),
        23 + 19.7 * Math.sin(t),
        -31 + 30 * Math.sin(a) * Math.cos(t));
    }));
    trim.push({ geo: new THREE.TubeGeometry(curve, 24, 0.22, 5, false), color: PEARL });
  }
  for (const x of [-24, 24]) {
    tower(x, -4, 35, 5.5, x < 0 ? AQUA : LILAC);
    tower(x, -58, 39, 5.5, x < 0 ? LILAC : AQUA);
  }
  tower(0, -58, 40, 6.5, ROSE);

  // Library to the left and music gallery to the right. Both can be entered
  // from the courtyard or through the open arches in the great hall.
  for (const side of [-1, 1]) {
    const cx = side * 36;
    wall(side * 49, -31, 3, 48, 18, side < 0 ? LILAC : AQUA);
    wall(cx, -54, 26, 3, 18);
    wall(side * 44, -8, 10, 3, 18);
    wall(side * 27, -8, 7, 3, 18);
    arch(side * 34, -6.5, 5, 11, GOLD);
    arch(side * 24, -32, 5, 11, AQUA, Math.PI / 2);
    box(parts, cx, 20, -31, 27, 2.2, 48, side < 0 ? 0xd8c3ec : 0xb0e8e4);
    for (const x of [side * 27, side * 44]) {
      windows.push(mat(x, 10, -6.38, 0, 0, 0, 0.75, 1.45, 1));
    }
    for (const z of [-46, -32, -18]) {
      ball(trim, side * 43, 3, z, 2.3, side < 0 ? 0xffdba7 : 0xffb8d9, 1, 0.4, 1);
    }
  }
  // Throne, shell shelves, and pearl instruments make the rooms readable.
  box(parts, 0, 1.1, -51, 14, 2.2, 9, GOLD);
  ball(trim, 0, 5, -54, 5, LILAC, 1, 1.2, 0.35);
  ball(trim, 0, 8.4, -55, 2.1, PEARL);
  for (const z of [-45, -33, -21]) {
    box(parts, -46, 3.5, z, 1.8, 7, 7, ROSE);
    for (const y of [2, 4.5]) box(trim, -44.9, y, z, 0.7, 0.55, 6.5, GOLD);
    for (const j of [-2, 0, 2]) ball(trim, -44.2, 3, z + j, 0.75, [AQUA, LILAC, ROSE][j + 2]);
  }
  for (const z of [-44, -28, -16]) {
    ball(parts, 36, 2.2, z, 3.1, PEARL, 1, 0.35, 1);
    for (const dx of [-1.5, 0, 1.5]) column(trim, 36 + dx, z, 4.5 + Math.abs(dx), 0.16, GOLD);
  }

  // Inner court: fountain, coral market, garden, lantern-lined lanes, small
  // shell homes and an open colonnade along both sides.
  const basin = new THREE.Mesh(new THREE.TorusGeometry(7, 1.2, 7, 32),
    paintMat({ color: AQUA, emissive: 0x244c63 }));
  basin.rotation.x = Math.PI / 2; basin.position.set(0, 0.5, 31); city.add(basin);
  ball(parts, 0, 2.2, 31, 2.4, PEARL);
  for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
    ball(trim, Math.sin(a) * 5, 1, 31 + Math.cos(a) * 5, 1.3, AQUA);
  }
  for (const x of [-59, 59]) {
    for (const z of [-31, 12, 45]) {
      parts.push({ geo: new THREE.CylinderGeometry(5.2, 5.7, 7, 12), matrix: mat(x, 3.5, z), color: SHELL });
      parts.push({ geo: new THREE.SphereGeometry(5.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        matrix: mat(x, 7, z, 0, 0, 0, 1, 0.9, 1), color: z === 12 ? AQUA : ROSE });
      ball(trim, x + (x < 0 ? 4.9 : -4.9), 4, z, 1.1, GOLD, 0.25, 1.5, 0.7);
      colliders.push({ x: C.x + x, z: C.z + z, r: 5.5, top: baseY + 13 });
    }
  }
  for (const z of [7, 24, 41]) {
    for (const x of [-46, 46]) {
      box(parts, x, 1.1, z, 9, 2.2, 5, GOLD);
      column(trim, x - 4, z, 6, 0.35, PEARL);
      column(trim, x + 4, z, 6, 0.35, PEARL);
      box(parts, x, 6.2, z, 11, 1, 7, z === 24 ? AQUA : ROSE);
    }
  }
  for (const [x, z] of [[-27, 25], [27, 25], [-25, 51], [25, 51], [-10, -8], [10, -8], [-38, -22], [38, -22]]) {
    column(trim, x, z, 4.3, 0.2, GOLD);
    ball(trim, x, 4.8, z, 0.7, PEARL);
    lamps.push([x, z]);
  }
  for (let i = 0; i < 64; i++) {
    const x = 53 + (i % 4) * 3.4, z = -48 + Math.floor(i / 4) * 6;
    column(parts, x, z, 1.2 + (i % 3) * 0.35, 0.13, AQUA);
    ball(trim, x, 1.6 + (i % 3) * 0.35, z, 0.35, i % 3 === 0 ? GOLD : ROSE);
  }
  for (const x of [-53, 53]) {
    for (const z of [-45, -25, -5, 15, 35, 55]) column(parts, x, z, 12, 0.65, PEARL);
    box(trim, x, 12.8, 5, 2, 1.2, 106, GOLD);
  }

  city.add(new THREE.Mesh(merge(parts), bodyMat));
  city.add(new THREE.Mesh(merge(trim), trimMat));
  const windowMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12),
    new THREE.MeshBasicMaterial({ color: GOLD, fog: true, side: THREE.DoubleSide }), windows.length);
  windows.forEach((m, i) => windowMesh.setMatrixAt(i, m));
  windowMesh.computeBoundingSphere();
  city.add(windowMesh);
  const glow = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe9b0,
    transparent: true, opacity: 0.47, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [x, z] of lamps) {
    const s = new THREE.Sprite(glow); s.position.set(x, 4.8, z); s.scale.setScalar(3); city.add(s);
  }
  const ribbon = new THREE.PlaneGeometry(1.4, 6, 1, 8);
  ribbon.translate(0, -3, 0);
  const ribMat = withSway(paintMat({ color: ROSE, side: THREE.DoubleSide, emissive: 0x301028 }),
    { amp: 1.2, freq: 1.4, heightScale: 0.35, key: 'rib' });
  for (const [x, z] of [[-79, 67], [79, 67], [-24, -4], [24, -4], [-24, -58], [24, -58]]) {
    const flag = new THREE.Mesh(ribbon, ribMat);
    flag.position.set(x, z > 0 ? 27 : 36, z);
    city.add(flag);
  }

  return {
    group: city,
    spots: {
      queen: local(0, 5, -48),
      gate: local(0, 4, 67),
      garden: local(62, 3, -48),
      guards: [local(-17, 4, 57), local(17, 4, 57)],
      citizens: [local(-44, 5, 24), local(43, 6, 25), local(-36, 5, -29), local(36, 5, -29)],
      activities: [
        { kind: 'market', pos: local(-43, 5, 41), color: 'coral' },
        { kind: 'market', pos: local(43, 5, 41), color: 'pearl' },
        { kind: 'garden', pos: local(58, 4, -42), color: 'marina' },
        { kind: 'library', pos: local(-36, 5, -39), color: 'pearl' },
        { kind: 'music', pos: local(36, 5, -34), color: 'coral' },
        { kind: 'court', pos: local(-14, 6, 29), color: 'marina' },
        { kind: 'court', pos: local(16, 7, 27), color: 'pearl' },
      ],
      seahorses: [local(67, 5, -21), local(62, 6, -51)],
    },
  };
}
