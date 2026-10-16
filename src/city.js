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
  const box = (list, x, y, z, w, h, d, color, yaw = 0) =>
    list.push({ geo: new THREE.BoxGeometry(w, h, d), matrix: mat(x, y, z, 0, yaw), color });
  const ball = (list, x, y, z, r, color, sx = 1, sy = 1, sz = 1) =>
    list.push({ geo: new THREE.SphereGeometry(r, 10, 8), matrix: mat(x, y, z, 0, 0, 0, sx, sy, sz), color });
  const column = (list, x, z, h, r = 0.8, color = PEARL) => {
    list.push({ geo: new THREE.CylinderGeometry(r * 0.72, r, h, 10), matrix: mat(x, h / 2, z), color });
    ball(trim, x, h + 0.35, z, r * 0.95, GOLD, 1, 0.45, 1);
  };
  const wall = (x, z, w, d, h, color = SHELL, yaw = 0) => {
    box(parts, x, h / 2, z, w, h, d, color, yaw);
    box(trim, x, h + 0.35, z, w + 0.6, 0.7, d + 0.6, GOLD, yaw);
    colliders.push({ x: C.x + x, z: C.z + z, hw: w / 2, hd: d / 2, yaw, top: baseY + h });
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

  // The complete district sits on a round pearl-stone terrace.
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.7, 64),
    withCaustics(paintMat({ color: 0xe7d5db }), 0.7, 'plaza'));
  floor.scale.set(81, 1, 77);
  floor.position.y = -0.36;
  city.add(floor);
  // Pale radial streets and a clear processional avenue lead from the gate
  // around the central fountain to the palace steps.
  box(trim, 0, 0.09, 54, 17, 0.14, 42, PEARL);
  box(trim, 0, 0.09, 8, 17, 0.14, 22, PEARL);
  box(trim, 0, 0.09, -12, 116, 0.14, 7, PEARL);
  for (const side of [-1, 1]) {
    box(trim, side * 37, 0.08, 31, 7, 0.12, 71, AQUA);
    box(trim, side * 57, 0.08, -6, 6, 0.12, 59, PEARL);
  }

  // The concept's oval curtain wall is made of short solid chords. The front
  // arc has an actual 22-unit gap so the player can swim through the portal.
  const RX = 79, RZ = 76, GATE = 0.145, N = 38;
  const ring = (a) => new THREE.Vector2(RX * Math.sin(a), RZ * Math.cos(a));
  for (let i = 0; i < N; i++) {
    const a0 = -Math.PI + i * Math.PI * 2 / N;
    const a1 = -Math.PI + (i + 1) * Math.PI * 2 / N;
    const lo = Math.max(a0, -GATE), hi = Math.min(a1, GATE);
    const spans = lo < hi ? [[a0, lo], [hi, a1]] : [[a0, a1]];
    for (const [from, to] of spans) {
      if (to - from < 0.02) continue;
      const p = ring(from), q = ring(to), dx = q.x - p.x, dz = q.y - p.y;
      const yaw = Math.atan2(-dz, dx), mid = (from + to) / 2;
      const x = (p.x + q.x) / 2, z = (p.y + q.y) / 2;
      wall(x, z, Math.hypot(dx, dz) + 0.4, 3.2, 13, Math.abs(mid) > 1.8 ? LILAC : ROSE, yaw);
      box(trim, x, 6.6, z, Math.hypot(dx, dz) - 0.6, 7.8, 0.34,
        i % 3 === 0 ? AQUA : SHELL, yaw);
      if (i % 2 === 0) {
        const b = ring(mid);
        ball(trim, b.x, 14.4, b.y, 0.68, PEARL);
      }
    }
  }
  for (const a of [-GATE, GATE, -0.54, 0.54, -1.1, 1.1, -1.7, 1.7, -2.28, 2.28, -2.78, 2.78, Math.PI]) {
    const p = ring(a);
    tower(p.x, p.y, Math.abs(a) < 0.2 ? 25 : 22 + (Math.abs(a) > 2.5 ? 5 : 0),
      Math.abs(a) < 0.2 ? 4.6 : 4.3, Math.abs(a) < 0.2 ? ROSE : (a < 0 ? LILAC : AQUA));
  }
  // The gate is a pair of upright scallop shells and open gold-leaf doors.
  // The leaves stand to the sides, outside the swimming path.
  const fan = (x, z, side) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.08 + i * 0.084);
      const r = 11.5 + 0.5 * Math.cos(i * Math.PI);
      shape.lineTo(side * Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true,
      bevelSize: 0.35, bevelThickness: 0.28, bevelSegments: 1, curveSegments: 3 });
    parts.push({ geo: g, matrix: mat(x, 1.5, z), color: side < 0 ? ROSE : AQUA });
    for (let i = 1; i < 9; i++) {
      const a = Math.PI * (0.08 + i * 0.084);
      const end = new THREE.Vector3(x + side * Math.cos(a) * 11.6, 1.5 + Math.sin(a) * 11.6, z + 1.1);
      trim.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 1.5, z + 1.1), end]), 3, 0.16, 4), color: PEARL });
    }
  };
  fan(-12.5, 76, -1); fan(12.5, 76, 1);
  arch(0, 76.5, 10.6, 12.5, GOLD);
  ball(trim, 0, 23.5, 76.5, 1.5, PEARL);
  box(trim, -13, 5, 70.8, 1.3, 9.5, 6, GOLD, -0.38);
  box(trim, 13, 5, 70.8, 1.3, 9.5, 6, GOLD, 0.38);

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
    // Ribbed shell roofs replace the flat silhouette of the side aisles.
    parts.push({ geo: new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      matrix: mat(cx, 21, -31, 0, 0, 0, 13.2, 7.4, 22.8), color: side < 0 ? LILAC : AQUA });
    for (let j = 0; j < 7; j++) {
      const a = j * Math.PI / 6;
      const path = new THREE.CatmullRomCurve3(Array.from({ length: 7 }, (_, k) => {
        const t = k * Math.PI / 12;
        return new THREE.Vector3(cx + Math.cos(a) * 13.2 * Math.cos(t),
          21.1 + 7.4 * Math.sin(t), -31 + Math.sin(a) * 22.8 * Math.cos(t));
      }));
      trim.push({ geo: new THREE.TubeGeometry(path, 16, 0.16, 4), color: GOLD });
    }
    ball(trim, cx, 28.6, -31, 0.85, PEARL);
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

  // A round, scalloped fountain is the city landmark. Its raised clam holds
  // a pearl, with four visible streams returning to the water basin.
  parts.push({ geo: new THREE.CylinderGeometry(9.3, 10, 1.6, 32), matrix: mat(0, 0.8, 30), color: SHELL });
  trim.push({ geo: new THREE.CylinderGeometry(8.2, 8.2, 0.12, 32), matrix: mat(0, 1.65, 30), color: AQUA });
  trim.push({ geo: new THREE.TorusGeometry(9.35, 0.6, 7, 36), matrix: mat(0, 1.7, 30, Math.PI / 2), color: GOLD });
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    ball(trim, Math.cos(a) * 9, 1.9, 30 + Math.sin(a) * 9, 1.1,
      i % 2 ? ROSE : PEARL, 1, 0.38, 1);
  }
  // Both clam halves have radiating ribs; the front half is low so its pearl
  // is readable from the gate and from the overview camera.
  for (const side of [-1, 1]) {
    const shellZ = 30 + side * 1.4;
    parts.push({ geo: new THREE.SphereGeometry(5.3, 16, 10, 0, Math.PI, 0, Math.PI / 2),
      matrix: mat(0, 2.2, shellZ, side * 0.45, 0, 0, 1, 0.85, 0.5), color: side < 0 ? ROSE : LILAC });
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (i + 1) / 10;
      trim.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 2.3, shellZ + side * 0.4),
        new THREE.Vector3(Math.cos(a) * 2.5, 4.9, shellZ - side * 0.8),
        new THREE.Vector3(Math.cos(a) * 5.1, 2.7 + Math.sin(a), shellZ - side * 1.8),
      ]), 8, 0.13, 4), color: PEARL });
    }
  }
  ball(trim, 0, 7.2, 30, 2.15, PEARL);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const tip = new THREE.Vector3(Math.cos(a) * 7, 2.5, 30 + Math.sin(a) * 7);
    trim.push({ geo: new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 8.5, 30),
      new THREE.Vector3(Math.cos(a) * 4, 12.5, 30 + Math.sin(a) * 4), tip),
      12, 0.19, 5), color: AQUA });
  }
  colliders.push({ x: C.x, z: C.z + 30, r: 9.3, top: baseY + 8 });

  // Small shell houses follow the oval wall. Every front door faces a lane,
  // so the silhouette reads as a lived-in miniature city from above.
  const homeSites = [[-56, -43], [-66, -21], [-69, 2], [-65, 29], [-49, 52],
    [56, -43], [66, -21], [69, 2], [65, 29], [49, 52], [-28, 56], [28, 56]];
  homeSites.forEach(([x, z], i) => {
    const r = i % 3 === 0 ? 6.8 : 5.7;
    const h = i % 3 === 0 ? 9 : 7.5;
    const cap = [ROSE, AQUA, LILAC][i % 3];
    parts.push({ geo: new THREE.CylinderGeometry(r * 0.87, r, h, 12),
      matrix: mat(x, h / 2, z), color: SHELL });
    parts.push({ geo: new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      matrix: mat(x, h, z, 0, 0, 0, 1, 0.95, 1), color: cap });
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4;
      trim.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, h + r * 0.95, z),
        new THREE.Vector3(x + Math.cos(a) * r * 0.6, h + r * 0.65, z + Math.sin(a) * r * 0.6),
        new THREE.Vector3(x + Math.cos(a) * r * 0.97, h + 0.3, z + Math.sin(a) * r * 0.97),
      ]), 6, 0.13, 4), color: GOLD });
    }
    const dir = x < 0 ? 1 : -1;
    ball(trim, x + dir * r * 0.9, 3.4, z, 1.2, GOLD, 0.28, 1.5, 0.85);
    ball(trim, x, h + r * 0.99, z, 0.65, PEARL);
    colliders.push({ x: C.x + x, z: C.z + z, r: r * 0.87, top: baseY + h + r });
  });

  // Open-front boutiques form two market lanes. Striped cloth panels, hanging
  // shell signs and individual wares make them legible as shops at street level.
  const shops = [[-27, 46], [27, 46], [-38, 59], [38, 59],
    [-47, 22], [47, 22], [-48, 39], [48, 39], [-32, 15], [32, 15]];
  shops.forEach(([x, z], i) => {
    const side = x < 0 ? 1 : -1, front = x + side * 3.8;
    box(parts, x, 0.8, z, 8.2, 1.6, 6.5, SHELL);
    box(trim, x - 3.6, 3.3, z - 2.9, 0.38, 5, 0.38, GOLD);
    box(trim, x + 3.6, 3.3, z - 2.9, 0.38, 5, 0.38, GOLD);
    box(trim, x - 3.6, 3.3, z + 2.9, 0.38, 5, 0.38, GOLD);
    box(trim, x + 3.6, 3.3, z + 2.9, 0.38, 5, 0.38, GOLD);
    for (let stripe = 0; stripe < 6; stripe++) {
      box(parts, x - 3.75 + stripe * 1.5, 6.05, z, 1.5, 0.35, 8,
        stripe % 2 ? PEARL : [ROSE, AQUA, GOLD][i % 3]);
    }
    box(trim, front, 2.3, z, 1.3, 1.8, 5, GOLD);
    for (let k = -1; k <= 1; k++) ball(trim, front + side * 0.8, 3.4, z + k * 1.5,
      0.52, [AQUA, ROSE, PEARL][(i + k + 3) % 3]);
    ball(trim, front, 5.0, z + 3.0, 1.0, i % 2 ? PEARL : AQUA, 1, 0.45, 0.28);
  });
  // Two raised promenade bridges link the palace galleries to the inside of
  // the wall. The arches below stay open at normal swimming height.
  for (const side of [-1, 1]) {
    const bx = side * 61, bz = -32;
    box(parts, bx, 10.4, bz, 22, 1.0, 5.4, SHELL);
    colliders.push({ x: C.x + bx, z: C.z + bz, hw: 11, hd: 2.7,
      bottom: baseY + 9.9, top: baseY + 10.9 });
    box(trim, bx, 11.2, bz - 2.6, 22, 0.5, 0.45, GOLD);
    box(trim, bx, 11.2, bz + 2.6, 22, 0.5, 0.45, GOLD);
    trim.push({ geo: new THREE.TorusGeometry(8, 0.55, 6, 20, Math.PI),
      matrix: mat(bx, 9.6, bz, 0, 0, Math.PI), color: PEARL });
    for (const x of [bx - 8, bx + 8]) {
      column(parts, x, bz, 9.6, 0.55, SHELL);
      colliders.push({ x: C.x + x, z: C.z + bz, r: 0.55, top: baseY + 9.6 });
    }
    for (let j = 0; j < 8; j++) {
      const x = bx + (j - 3.5) * 2.8;
      for (const z of [bz - 2.6, bz + 2.6]) {
        box(trim, x, 12.2, z, 0.36, 2, 0.36, PEARL);
        ball(trim, x, 13.4, z, 0.36, AQUA);
      }
    }
    // A smaller matching pearl fountain marks each side of the palace steps.
    const fx = side * 55, fz = -3;
    parts.push({ geo: new THREE.CylinderGeometry(3.2, 3.5, 1.1, 16),
      matrix: mat(fx, 0.55, fz), color: SHELL });
    trim.push({ geo: new THREE.CylinderGeometry(2.6, 2.6, 0.1, 16),
      matrix: mat(fx, 1.18, fz), color: AQUA });
    trim.push({ geo: new THREE.TorusGeometry(3.2, 0.25, 5, 16),
      matrix: mat(fx, 1.2, fz, Math.PI / 2), color: GOLD });
    ball(trim, fx, 3.3, fz, 1.2, PEARL);
    for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      trim.push({ geo: new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(fx, 4.3, fz),
        new THREE.Vector3(fx + Math.cos(a) * 2.0, 5.2, fz + Math.sin(a) * 2.0),
        new THREE.Vector3(fx + Math.cos(a) * 2.6, 1.3, fz + Math.sin(a) * 2.6)),
        8, 0.11, 4), color: AQUA });
    }
  }
  for (const [x, z] of [[-22, 23], [22, 23], [-22, 52], [22, 52], [-10, -8], [10, -8], [-55, -31], [55, -31], [-4, 63], [4, 63]]) {
    column(trim, x, z, 4.3, 0.2, GOLD);
    ball(trim, x, 4.8, z, 0.7, PEARL);
    lamps.push([x, z]);
  }
  for (let i = 0; i < 64; i++) {
    const x = 53 + (i % 4) * 3.4, z = -48 + Math.floor(i / 4) * 6;
    column(parts, x, z, 1.2 + (i % 3) * 0.35, 0.13, AQUA);
    ball(trim, x, 1.6 + (i % 3) * 0.35, z, 0.35, i % 3 === 0 ? GOLD : ROSE);
  }
  // Curved bridges and arches frame the central court and side passages.
  for (const side of [-1, 1]) {
    for (const z of [-3, 11, 25]) arch(side * 56, z, 5.1, 9.5, GOLD, Math.PI / 2);
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
  for (const [x, z] of [[-11.4, 75.2], [11.4, 75.2], [-24, -4], [24, -4], [-24, -58], [24, -58]]) {
    const flag = new THREE.Mesh(ribbon, ribMat);
    flag.position.set(x, z > 0 ? 27 : 36, z);
    city.add(flag);
  }

  return {
    group: city,
    spots: {
      queen: local(0, 5, -48),
      gate: local(0, 4, 67),
      garden: local(56, 3, -32),
      guards: [local(-17, 4, 57), local(17, 4, 57)],
      citizens: [local(-39, 5, 24), local(39, 6, 25), local(-36, 5, -29), local(36, 5, -29)],
      activities: [
        { kind: 'market', pos: local(-39, 5, 40), color: 'coral' },
        { kind: 'market', pos: local(39, 5, 40), color: 'pearl' },
        { kind: 'market', pos: local(-30, 5, 58), color: 'marina' },
        { kind: 'market', pos: local(31, 5, 58), color: 'coral' },
        { kind: 'market', pos: local(-46, 5, 17), color: 'pearl' },
        { kind: 'market', pos: local(46, 5, 17), color: 'marina' },
        { kind: 'garden', pos: local(56, 4, -32), color: 'marina' },
        { kind: 'court', pos: local(-22, 6, -7), color: 'coral' },
        { kind: 'library', pos: local(-36, 5, -39), color: 'pearl' },
        { kind: 'music', pos: local(36, 5, -34), color: 'coral' },
        { kind: 'court', pos: local(-14, 6, 29), color: 'marina' },
        { kind: 'court', pos: local(16, 7, 27), color: 'pearl' },
      ],
      seahorses: [local(57, 5, -18), local(55, 6, -52)],
    },
  };
}
