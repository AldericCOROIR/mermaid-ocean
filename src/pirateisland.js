// Skull Island: the pirate island on the surface, far west of the undersea map.
// Golden beaches ring a jungle with a lagoon and a river ravine; a beached pirate
// ship lies on the south-east sand, a dock on the east shore greets the mermaid,
// and in the north a huge, smiling skull mountain (with a red polka-dot bandana)
// opens its mouth onto a glowing grotto.
// The skull is one signed-distance function meshed once with surface nets, so its
// looks, its collisions (limit), its floor and the camera all use the same shape.
import * as THREE from 'three';
import { WORLD, fbm, noise2, mulberry32, glowTexture, canvasTexture } from './util.js';
import { mat, lumpify, paintMat, withSway, inject } from './geom.js';
import { colliders } from './world.js';

const SY = WORLD.surfaceY;
const C = new THREE.Vector3(-560, SY, -60); // island centre
const RADIUS = 170;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const K = (hex) => new THREE.Color(hex);
const rnd = mulberry32(73019); // own seed: the island looks the same whatever was built before
const rr = (a, b) => a + (b - a) * rnd();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ss = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }; // edges may be reversed
const lerp = (a, b, t) => a + (b - a) * t;
const bump = (a, c, w) => { const d = Math.atan2(Math.sin(a - c), Math.cos(a - c)) / w; return Math.exp(-d * d); };
function segD(x, z, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az, t = clamp01(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez));
  return Math.hypot(x - ax - ex * t, z - az - ez * t);
}

// Materials: painted Lambert, lit a little from within (≈ colour × k) so shade is never muddy.
const selfLit = (m, k = 0.15) => inject(m, { key: 'lit' + Math.round(k * 100), emissive: `totalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(3)};` });
// Brushwork picks a painted tile (and its scale) from a hook key 'caustic<kind>' (see KINDS); this hook only names it.
const tileAs = (m, kind) => inject(m, { key: 'caustic' + kind });

// ---------- layout (world x,z) ----------
const SK = { x: C.x, z: C.z - 88, a: 0.35 };          // skull base; its face looks along (sin a, cos a): south, a bit east
const LAGOON = { x: C.x - 25, z: C.z + 15, y: 66 };   // fresh-water lagoon, the river's head
const RIVER = [[-25, 15], [5, 32], [40, 30], [75, 42], [110, 55], [165, 70]].map(([x, z]) => [C.x + x, C.z + z]);
const MUD = { x: C.x - 60, z: C.z + 55, r: 5 };
const XSPOT = { x: C.x - 72, z: C.z - 36, r: 10 };   // X-marks-the-spot clearing
const CAMP = { x: C.x + 100, z: C.z - 32, r: 10 };
const SANDBAR = [[-34, 166], [-8, 174], [18, 173], [38, 165]].map(([x, z]) => [C.x + x, C.z + z]);
const DZ = C.z - 15;                                  // the dock runs east along z = DZ
const MARKET = { x: C.x + 132, z: C.z + 10, r: 7 };  // the village market square on the east beach
const BAR = { x: C.x + 130.5, z: C.z - 4.5, r: 4.5 }; // the juice bar beside it
const FLAT = [XSPOT, CAMP, MARKET, BAR];
let flatReady = false;

function coastR(th) {
  const c = Math.cos(th), s = Math.sin(th);
  return 146 + (fbm(c * 1.3 + 11, s * 1.3 + 4, 3) - 0.5) * 36
    - 26 * bump(th, Math.PI, 0.17) - 20 * bump(th, 2.3, 0.12) - 16 * bump(th, -2.4, 0.1) // west, south-west, north-west coves
    + 8 * bump(th, -Math.PI / 2, 0.6);
}

// The river: a polyline from the lagoon to the sea; riverInfo sets distance and progress (0..1).
const RIV_ACC = [0];
for (let i = 1; i < RIVER.length; i++) RIV_ACC.push(RIV_ACC[i - 1] + Math.hypot(RIVER[i][0] - RIVER[i - 1][0], RIVER[i][1] - RIVER[i - 1][1]));
const RIV_LEN = RIV_ACC[RIV_ACC.length - 1];
let _rd = 0, _rs = 0;
function riverInfo(x, z) {
  let bd = Infinity, bs = 0;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1], ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
    const t = clamp01(((x - ax) * ex + (z - az) * ez) / l2), d = Math.hypot(x - ax - ex * t, z - az - ez * t);
    if (d < bd) { bd = d; bs = (RIV_ACC[i] + t * Math.sqrt(l2)) / RIV_LEN; }
  }
  _rd = bd; _rs = bs;
}
const riverLevel = (s) => 66 - 5.75 * Math.pow(s, 0.85);

// Terrain height (world y). Underwater shelf → beach ring 60–63 → jungle hills 76–93,
// a flat courtyard round the skull, the lagoon basin, the river ravine and a sandbar.
function height(x, z) {
  const dx = x - C.x, dz = z - C.z, r = Math.hypot(dx, dz);
  if (r > 215) return SY - 20;
  const R = coastR(Math.atan2(dz, dx)), t = r / R;
  let h;
  if (t >= 1) h = Math.max(SY - 12, SY - (r - R) * 0.45);
  else {
    h = lerp(SY + Math.min(1, (1 - t) / 0.16) * 3.2, 68 + fbm(x * 0.016 + 5, z * 0.016 - 3, 3) * 34, ss(0.86, 0.58, t));
    h = lerp(h, 70 + noise2(x * 0.1, z * 0.1) * 0.8, ss(100, 62, Math.hypot(x - SK.x, z - SK.z)) * ss(0.95, 0.8, t));
    h = lerp(h, 63.5, ss(30, 15, Math.hypot(x - LAGOON.x, z - LAGOON.z)));
    if (flatReady) for (const f of FLAT) h = lerp(h, f.y, ss(f.r + 9, f.r, Math.hypot(x - f.x, z - f.z)));
    h -= 1.3 * ss(MUD.r + 1.5, MUD.r - 3, Math.hypot(x - MUD.x, z - MUD.z));
  }
  riverInfo(x, z);
  if (_rd < 15) { const bed = riverLevel(_rs) - 1.6; if (bed < h) h = lerp(h, bed, ss(14, 4, _rd)); }
  let sb = Infinity;
  for (let i = 0; i < SANDBAR.length - 1; i++) sb = Math.min(sb, segD(x, z, SANDBAR[i][0], SANDBAR[i][1], SANDBAR[i + 1][0], SANDBAR[i + 1][1]));
  if (sb < 12) h = Math.max(h, 61 + noise2(x * 0.2, z * 0.2) * 0.3 - sb * sb * (0.07 + 0.03 * Math.sin(x * 0.09)));
  if (r > 192) h = lerp(h, SY - 20, ss(192, 215, r));
  return h;
}
for (const f of FLAT) f.y = height(f.x, f.z);
flatReady = true;

// ---------- the skull: a signed distance field in skull space (u east-ish, y up, w toward the face) ----------
const SKC = Math.cos(SK.a), SKS = Math.sin(SK.a);
let _lu = 0, _lw = 0;
const toLocal = (x, z) => { const dx = x - SK.x, dz = z - SK.z; _lu = dx * SKC - dz * SKS; _lw = dx * SKS + dz * SKC; };
const skullWorld = (u, y, w) => v3(SK.x + SKC * u + SKS * w, y, SK.z - SKS * u + SKC * w);
const HALL_FLOOR = 77, MOUTH_Y = 83, MOUTH_H = 7.5;
const lipTop = (u) => MOUTH_Y + 0.0095 * u * u + (MOUTH_H - 0.004 * u * u);
const lipBot = (u) => MOUTH_Y + 0.0095 * u * u - (MOUTH_H - 0.004 * u * u);

function ell(x, y, z, rx, ry, rz) { // ellipsoid bound (x,y,z relative to the centre)
  const a = x / rx, b = y / ry, c = z / rz, k0 = Math.sqrt(a * a + b * b + c * c);
  const a2 = a / rx, b2 = b / ry, c2 = c / rz, k1 = Math.sqrt(a2 * a2 + b2 * b2 + c2 * c2);
  return k0 * (k0 - 1) / (k1 || 1e-6);
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

function skullBlobs(u, y, w) {
  let d = ell(u, y - 112, w + 4, 55, 50, 50);                       // cranium
  d = smin(d, ell(u, y - 86, w - 6, 46, 24, 40), 10);                // face
  d = smin(d, ell(Math.abs(u) - 30, y - 94, w - 28, 15, 13, 14), 6); // chubby cheekbones
  d = smin(d, ell(u, y - 72, w - 8, 38, 12, 36), 8);                 // jaw
  d = smin(d, ell(u, y - 50, w + 6, 66, 34, 62), 14);                // rocky skirt into the ground
  return d + 1.4 * Math.sin(u * 0.13 + 1) * Math.sin(y * 0.11 + 2) * Math.sin(w * 0.12 + 3) + 0.6 * Math.sin(u * 0.29 + w * 0.23 + y * 0.07);
}
const LEDGES = []; // flat rock shelves stuck to the skull: {u, y (disc centre), w, r, top}
function ledgeSDF(u, y, w) {
  let d = 1e9;
  for (const l of LEDGES) {
    const q = Math.hypot(u - l.u, w - l.w) - l.r, qy = Math.abs(y - l.y) - 1.4;
    d = Math.min(d, Math.min(Math.max(q, qy), 0) + Math.hypot(Math.max(q, 0), Math.max(qy, 0)) - 0.6);
  }
  return d;
}
function mouthSDF(u, y, w) { // a wide smile, corners turned up, tunnelling back into the hall
  const qx = Math.abs(u) - 20, qy = Math.abs(y - MOUTH_Y - 0.0095 * u * u) - (MOUTH_H - 0.004 * u * u - 3), qz = Math.abs(w - 33) - 24;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - 3;
}
const hallSDF = (u, y, w) => smax(ell(u, y - 84, w + 5, 27, 19, 25), HALL_FLOOR - y, 3); // ~54 wide, 26 tall, flat floor
const eyeSDF = (u, y, w) => ell(Math.abs(u) - 20, y - 114, w - 44, 13, 14, 12);
const noseSDF = (u, y, w) => ell(Math.abs(u) - 3.4, y - 95, w - 45, 3.6, 5.5, 6);
const caveSDF = (u, y, w) => smin(mouthSDF(u, y, w), hallSDF(u, y, w), 5);
function skullShape(u, y, w) {
  const d = LEDGES.length ? smin(skullBlobs(u, y, w), ledgeSDF(u, y, w), 3) : skullBlobs(u, y, w);
  return smax(d, -Math.min(eyeSDF(u, y, w), noseSDF(u, y, w), caveSDF(u, y, w)), 2.5);
}
const TEETH = []; // [u, y, w, rx, ry, rz] — a gap in the middle so the bubble fits through
for (const u of [-18, -11.5, -5, 5, 11.5, 18]) TEETH.push([u, lipTop(u) - 1.6, 43.5, 2.4, 3.4, 2.2]);
for (const u of [-14.5, -7.5, 7.5, 14.5]) TEETH.push([u, lipBot(u) + 1.2, 42.2, 2.2, 2.8, 2.2]);
function skullSolid(u, y, w) { // what the bubble and the camera bump into
  const r2 = u * u + (w + 4) * (w + 4);
  if (r2 > 8100) return Math.sqrt(r2) - 80;
  if (y > 182) return y - 172;
  let d = skullShape(u, y, w);
  if (w > 36 && y < 95) for (const t of TEETH) d = Math.min(d, ell(u - t[0], y - t[1], w - t[2], t[3], t[4], t[5]));
  return d;
}
function placeLedge(ang, top, r) { // march in from outside to the skull, then hang a shelf there
  const du = Math.cos(ang), dw = Math.sin(ang);
  let s = 90;
  while (s > 0 && skullBlobs(du * s, top - 1, -4 + dw * s) > 0) s -= 0.5;
  const l = { u: du * (s + r - 2), y: top - 2, w: -4 + dw * (s + r - 2), r, top, du, dw };
  LEDGES.push(l);
  return l;
}
const LEDGE = {
  billy: placeLedge(0.15, 106, 5),
  f1: placeLedge(2.95, 128, 4.5),
  f2: placeLedge(-1.1, 136, 4.5),
  f3: placeLedge(-2.45, 118, 4.5),
  cliff: placeLedge(3.6, 98, 5),
};
const _g = [0, 0, 0];
function grad(f, u, y, w, e = 0.3) {
  const gx = f(u + e, y, w) - f(u - e, y, w), gy = f(u, y + e, w) - f(u, y - e, w), gz = f(u, y, w + e) - f(u, y, w - e);
  const l = Math.hypot(gx, gy, gz) || 1;
  _g[0] = gx / l; _g[1] = gy / l; _g[2] = gz / l;
  return _g;
}
function traceDown(u, w, y, f = skullSolid) { // first rock surface below y (sphere tracing), or -Infinity
  let d = f(u, y, w);
  if (d < 0) return -Infinity;
  for (let i = 0; i < 60 && y > 40; i++) {
    if (d < 0.05) return y;
    y -= Math.max(d * 0.6, 0.05);
    d = f(u, y, w);
  }
  return -Infinity;
}
function traceUp(u, w, y) { let d = skullSolid(u, y, w); for (let i = 0; i < 60 && d > 0.05; i++) { y += Math.max(d * 0.6, 0.05); d = skullSolid(u, y, w); } return y; }

// Surface nets: one vertex per sign-changing cell, one quad per sign-changing edge.
function surfaceNets(f, x0, y0, z0, step, nx, ny, nz) {
  const sy = nx, sz = nx * ny, val = new Float32Array(nx * ny * nz);
  for (let k = 0, o = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, o++) val[o] = f(x0 + i * step, y0 + j * step, z0 + k * step);
  const CORNER = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const EDGE = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cell = new Int32Array(nx * ny * nz).fill(-1), pos = [], cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const o = i + j * sy + k * sz;
    let neg = 0;
    for (let c = 0; c < 8; c++) { const q = CORNER[c]; cv[c] = val[o + q[0] + q[1] * sy + q[2] * sz]; if (cv[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let ax = 0, ay = 0, az = 0, n = 0;
    for (const [e0, e1] of EDGE) {
      const a = cv[e0], b = cv[e1];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b), A = CORNER[e0], B = CORNER[e1];
      ax += A[0] + (B[0] - A[0]) * t; ay += A[1] + (B[1] - A[1]) * t; az += A[2] + (B[2] - A[2]) * t; n++;
    }
    cell[o] = pos.length / 3;
    pos.push(x0 + (i + ax / n) * step, y0 + (j + ay / n) * step, z0 + (k + az / n) * step);
  }
  const idx = [];
  // The cells round an edge are listed in a fixed order whose winding faces +x, -y, +z;
  // flip it when the solid is on the far end of the edge.
  const quad = (a, b, c, d, axis, out) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (out === (axis !== 1)) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const o = i + j * sy + k * sz, a = val[o] < 0;
    if (a !== (val[o + 1] < 0)) quad(cell[o - sy - sz], cell[o - sz], cell[o], cell[o - sy], 0, a);
    if (a !== (val[o + sy] < 0)) quad(cell[o - 1 - sz], cell[o - sz], cell[o], cell[o - 1], 1, a);
    if (a !== (val[o + sz] < 0)) quad(cell[o - 1 - sy], cell[o - sy], cell[o], cell[o - 1], 2, a);
  }
  return { pos, idx };
}

// ---------- geometry helpers ----------
const UPV = v3(0, 1, 0), _q = new THREE.Quaternion(), _d = v3(0, 0, 0);
function tube(a, b, r0, r1, radial = 6) { // open-ended cylinder between two points
  const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(UPV, _d.subVectors(b, a).normalize());
  return g.applyMatrix4(new THREE.Matrix4().compose(a, _q, v3(1, 1, 1)));
}
function boxBetween(a, b, w, t) { // a plank from a to b
  const g = new THREE.BoxGeometry(w, t, a.distanceTo(b));
  const m = new THREE.Matrix4().lookAt(a, b, UPV);
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  return g.applyMatrix4(m);
}
// Merge pieces into one geometry; keeps a piece's own vertex colours (times its colour).
function mergeParts(list) {
  let count = 0;
  const gs = list.map(({ geo, color, matrix }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    count += g.attributes.position.count;
    return { g, c: K(color ?? 0xffffff) };
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const { g, c } of gs) {
    const n = g.attributes.position.count, vc = g.attributes.color;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < n; i++) {
      const k = (o + i) * 3;
      col[k] = c.r * (vc ? vc.getX(i) : 1); col[k + 1] = c.g * (vc ? vc.getY(i) : 1); col[k + 2] = c.b * (vc ? vc.getZ(i) : 1);
    }
    o += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
function instanced(geo, material, items) {
  const im = new THREE.InstancedMesh(geo, material, items.length);
  items.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, K(it.c ?? 0xffffff)); });
  im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  return im;
}

// ---------- plant & prop models ----------
function frondGeo(L, W, droop, segs = 5, fold = true) { // a leaf lying along +x, arching up then drooping
  const g = new THREE.PlaneGeometry(W, L, fold ? 2 : 1, segs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = p.getY(i) / L + 0.5, along = a * L, x = p.getX(i) * (Math.sin(a * Math.PI) * 0.9 + 0.1);
    p.setXYZ(i, along, along * 0.5 - along * along * droop / L - (fold ? Math.abs(x) * 0.4 : 0), x);
  }
  g.computeVertexNormals();
  return g;
}
function palmGeo() {
  const P = [], H = 11, N = 5, at = (t) => v3(t * t * 2.8, t * H, 0);
  for (let i = 0; i < N; i++) P.push({ geo: tube(at(i / N), at((i + 1) / N), 0.55 - i * 0.05, 0.5 - i * 0.05, 6), color: i % 2 ? 0xa8764a : 0xc79358 });
  const top = at(1);
  for (let f = 0; f < 7; f++) P.push({ geo: frondGeo(6.5, 1.7, 0.85, 4), color: f % 2 ? 0x5cc24c : 0x43a842, matrix: mat(top.x, top.y - 0.2, top.z, 0, f * 0.9 + 0.3, 0) });
  for (let k = 0; k < 3; k++) P.push({ geo: new THREE.IcosahedronGeometry(0.42, 0), color: 0x8a5a30, matrix: mat(top.x + Math.cos(k * 2.1) * 0.5, top.y - 0.6, top.z + Math.sin(k * 2.1) * 0.5) });
  return mergeParts(P);
}
function treeGeo(seed) { // broadleaf jungle tree: buttress roots, leaning trunk, three leafy blobs, hanging vines
  const R = mulberry32(seed), P = [];
  const H = 9 + R() * 3, lean = (R() - 0.5) * 1.6, at = (t) => v3(Math.sin(t * 2.2) * lean, t * H, Math.sin(t * 1.4) * lean * 0.5);
  for (let i = 0; i < 3; i++) P.push({ geo: tube(at(i / 3), at((i + 1) / 3), 0.9 - i * 0.18, 0.72 - i * 0.18, 7), color: i % 2 ? 0x7d5636 : 0x8f6440 });
  for (let k = 0; k < 4; k++) { const a = k * 1.57 + R(); P.push({ geo: tube(v3(0, 1.8, 0), v3(Math.cos(a) * 2, -0.3, Math.sin(a) * 2), 0.42, 0.15, 4), color: 0x7d5636 }); }
  const top = at(1);
  const blob = (s, x, y, z, sx, sy, sz, col) => P.push({ geo: lumpify(new THREE.IcosahedronGeometry(1, 1), 0.22, 1.9, s), color: col, matrix: mat(top.x + x, top.y + y, top.z + z, 0, R() * 6, 0, sx, sy, sz) });
  blob(seed, 0, 0.6, 0, 4.8, 2.8, 4.6, 0x3f9a3a);
  blob(seed + 1, R() * 3 - 1.5, 2.6, R() * 3 - 1.5, 3.3, 2.3, 3.3, 0x5cb846);
  blob(seed + 2, R() * 2 + 1.5, -0.3, R() * 2 - 3, 2.7, 1.8, 2.7, 0x4aa63e);
  for (let k = 0; k < 3; k++) {
    const a = R() * 6, d = 2.4 + R() * 1.2, x = top.x + Math.cos(a) * d, z = top.z + Math.sin(a) * d;
    P.push({ geo: tube(v3(x, top.y - 0.6, z), v3(x + 0.3, top.y - 5 - R() * 3, z), 0.09, 0.06, 3), color: 0x4f9a3a });
  }
  return mergeParts(P);
}
function fernGeo() { const P = []; for (let f = 0; f < 6; f++) P.push({ geo: frondGeo(2.6, 0.9, 0.75, 3, false), color: f % 2 ? 0x4caa44 : 0x6cc455, matrix: mat(0, 0.1, 0, 0, f * 1.05 + rnd() * 0.3, 0) }); return mergeParts(P); }
function bushGeo(berries) {
  const P = [{ geo: lumpify(new THREE.IcosahedronGeometry(1, 1), 0.28, 2.2, 4), color: 0x4c9e3e, matrix: mat(0, 0.7, 0, 0, 0, 0, 1.6, 1.1, 1.6) }];
  if (berries) for (let k = 0; k < 9; k++) { const a = k * 2.4, e = 0.2 + (k % 3) * 0.35; P.push({ geo: new THREE.IcosahedronGeometry(0.2, 0), color: 0xe8304a, matrix: mat(Math.cos(a) * 1.55 * Math.cos(e), 0.75 + Math.sin(e) * 1.05, Math.sin(a) * 1.55 * Math.cos(e)) }); }
  return mergeParts(P);
}
function bloomGeo() { // a big hibiscus head, tinted per instance
  const P = [];
  for (let k = 0; k < 5; k++) P.push({ geo: new THREE.CircleGeometry(0.55, 6).translate(0.5, 0, 0).scale(1, 0.62, 1), color: 0xffffff, matrix: mat(0, 1.15, 0, 0, k * 1.2566, 0).multiply(mat(0, 0, 0, -Math.PI / 2 + 0.45, 0, 0)) });
  P.push({ geo: new THREE.IcosahedronGeometry(0.2, 0), color: 0xffe066, matrix: mat(0, 1.25, 0) });
  return mergeParts(P);
}
function stemGeo() {
  return mergeParts([{ geo: tube(v3(0, 0, 0), v3(0.1, 1.15, 0), 0.06, 0.05, 4), color: 0x5aa83e },
    { geo: frondGeo(0.9, 0.4, 0.4, 2, false), color: 0x5aa83e, matrix: mat(0, 0.3, 0, 0, 0.5, 0) }, { geo: frondGeo(0.8, 0.35, 0.4, 2, false), color: 0x6cbf4c, matrix: mat(0, 0.5, 0, 0, 3.3, 0) }]);
}
function grassGeo() {
  const P = [];
  for (let k = 0; k < 5; k++) {
    const g = new THREE.PlaneGeometry(0.22, 1.3, 1, 2).translate(0, 0.65, 0), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y / 1.4)); p.setZ(i, y * y * 0.18); }
    g.computeVertexNormals();
    P.push({ geo: g, color: k % 2 ? 0x8ccf55 : 0x6fbf48, matrix: mat(rnd() * 0.3, 0, rnd() * 0.3, 0, k * 1.25, 0) });
  }
  return mergeParts(P);
}
function rockGeo(seed) { return lumpify(new THREE.IcosahedronGeometry(1, 1), 0.3, 1.3, seed); }

let _flagTex;
function jollyRoger() { // a friendly pirate flag: smiling skull with pink cheeks over crossed bones
  if (_flagTex) return _flagTex;
  _flagTex = canvasTexture(128, 80, (g, w, h) => {
    g.fillStyle = '#231d36'; g.fillRect(0, 0, w, h);
    const bone = '#fff4e2';
    g.strokeStyle = bone; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(36, 20); g.lineTo(92, 66); g.moveTo(92, 20); g.lineTo(36, 66); g.stroke();
    g.fillStyle = bone;
    for (const [x, y] of [[33, 17], [39, 15], [95, 17], [89, 15], [33, 69], [39, 71], [95, 69], [89, 71]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    g.beginPath(); g.arc(64, 36, 20, 0, 7); g.fill(); g.fillRect(52, 44, 24, 13);
    g.fillStyle = '#231d36';
    g.beginPath(); g.arc(56, 35, 5.5, 0, 7); g.arc(72, 35, 5.5, 0, 7); g.fill();
    g.beginPath(); g.moveTo(64, 40); g.lineTo(61, 45); g.lineTo(67, 45); g.fill();
    g.lineWidth = 2.5; g.strokeStyle = '#231d36'; g.beginPath(); g.arc(64, 45, 8, 0.25, Math.PI - 0.25); g.stroke();
    g.fillStyle = '#ff9ab8'; g.beginPath(); g.arc(50, 43, 3, 0, 7); g.arc(78, 43, 3, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(57.5, 33.5, 1.6, 0, 7); g.arc(73.5, 33.5, 1.6, 0, 7); g.fill();
  });
  return _flagTex;
}

// ---------- build ----------
export function buildPirateIsland(scene) {
  const group = new THREE.Group();
  group.name = 'pirateIsland';
  scene.add(group);
  const parts = { solid: [], cloth: [], glow: [] };
  const put = (bucket, geo, color, m) => parts[bucket].push({ geo, color, matrix: m });
  const cols = [];             // colliders (pushed into the shared list at the end)
  const decks = [];            // walkable things the heightfield can't express: (x, z, top) → y or -Infinity
  const glows = [], flags = [], avoid = [];
  const fires = [];
  const VIL = {};              // village anchors that the life spots use
  const L = (base, ...a) => base.clone().multiply(mat(...a));
  const W = (base, x, y, z) => v3(x, y, z).applyMatrix4(base);
  const glow = (pos, color, size, opacity = 0.6, flicker = 0) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(pos); s.scale.setScalar(size); group.add(s);
    glows.push({ s, opacity, size, flicker, ph: rnd() * 6 });
    return s;
  };
  const flag = (pos, yaw, w = 4, h = 2.5) => {
    const g = new THREE.PlaneGeometry(w, h, 10, 4).translate(w / 2, 0, 0);
    const m = new THREE.Mesh(g, selfLit(paintMat({ map: jollyRoger(), side: THREE.DoubleSide }), 0.2));
    m.position.copy(pos); m.rotation.y = yaw; group.add(m);
    flags.push({ g, base: Float32Array.from(g.attributes.position.array), w, ph: rnd() * 6 });
  };
  const rectDeck = (x, z, yaw, hw, hd, y) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    decks.push((px, pz) => { const dx = px - x, dz = pz - z; return Math.abs(dx * c - dz * s) <= hw && Math.abs(dx * s + dz * c) <= hd ? y : -Infinity; });
  };
  const discDeck = (x, z, r, y) => decks.push((px, pz) => (Math.hypot(px - x, pz - z) <= r ? y : -Infinity));
  const barrel = (M) => {
    put('solid', new THREE.LatheGeometry([[0.45, 0], [0.56, 0.35], [0.59, 0.65], [0.56, 0.95], [0.45, 1.3]].map(([a, b]) => new THREE.Vector2(a, b)), 10), 0xa8703f, M);
    put('solid', new THREE.CircleGeometry(0.45, 10).rotateX(-Math.PI / 2).translate(0, 1.3, 0), 0x8a5a32, M);
    for (const y of [0.3, 1.0]) put('solid', new THREE.CylinderGeometry(0.6, 0.6, 0.09, 10, 1, true).translate(0, y, 0), 0x5a5a66, M);
  };
  const crate = (M, s = 1.2) => {
    put('solid', new THREE.BoxGeometry(s, s, s).translate(0, s / 2, 0), 0xc89a5c, M);
    for (const r of [0.78, -0.78]) put('solid', new THREE.BoxGeometry(0.16, s * 1.3, 0.04).rotateZ(r).translate(0, s / 2, s / 2 + 0.02), 0x8a6238, M);
  };
  const chest = (M, open = true) => {
    put('solid', new THREE.BoxGeometry(1.6, 0.9, 1).translate(0, 0.45, 0), 0xa0683c, M);
    for (const x of [-0.6, 0.6]) put('glow', new THREE.BoxGeometry(0.12, 0.94, 1.04).translate(x, 0.45, 0), 0xffc84a, M);
    const lid = new THREE.CylinderGeometry(0.5, 0.5, 1.6, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
    put('solid', open ? lid.translate(0, 0, 0.5).rotateX(-1.15).translate(0, 0.9, -0.5) : lid.translate(0, 0.9, 0), 0x8f5a32, M);
    if (open) {
      put('glow', lumpify(new THREE.IcosahedronGeometry(1, 1), 0.15, 3, 9).scale(0.72, 0.28, 0.42).translate(0, 0.92, 0), 0xffd24a, M);
      for (let k = 0; k < 3; k++) put('glow', new THREE.OctahedronGeometry(0.16, 0).translate(rr(-0.5, 0.5), 1.1, rr(-0.25, 0.25)), pick([0xff5a8a, 0x5ae0ff, 0x8aff7a]), M);
    }
    glow(W(M, 0, 1.3, 0), 0xffe08a, 3.5, 0.5);
  };
  const stoneRing = (x, z, y, r, n, size = 0.5, color = 0x9a9488) => {
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; put('solid', rockGeo(k + 3), color, mat(x + Math.cos(a) * r, y, z + Math.sin(a) * r, rnd(), rnd() * 6, 0, size * rr(0.8, 1.3), size * rr(0.6, 0.9), size * rr(0.8, 1.3))); }
  };

  // ---- placements that the terrain colours and paths depend on ----
  // the ship: on the south-east beach, its long side along the shore, leaning toward the sea
  const shipTh = 0.8, shipR = coastR(shipTh) * 0.9;
  const shipX = C.x + Math.cos(shipTh) * shipR, shipZ = C.z + Math.sin(shipTh) * shipR, shipYaw = -shipTh;
  const SHIP = { LEN: 14, W: 5, D: 5.5 };
  const shipO = v3(shipX, height(shipX, shipZ) + 2.0, shipZ);
  const shipQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, shipYaw, -0.15, 'YXZ'));
  const shipM = new THREE.Matrix4().compose(shipO, shipQ, v3(1, 1, 1));
  const shipHalfW = (lz) => { if (lz >= 0) { const z = Math.min(1, lz / SHIP.LEN); return Math.sqrt(1 - z * z) * SHIP.W * (1 - z * z * 0.7); } const z = Math.pow(Math.min(1, -lz / SHIP.LEN), 1 / 0.6); return Math.sqrt(Math.max(0, 1 - z * z)) * SHIP.W; };
  const plankTop = W(shipM, -SHIP.W * 0.95, 0.3, 1.5), plankDir = v3(-Math.cos(shipTh), 0, -Math.sin(shipTh));
  const plankFoot = plankTop.clone().addScaledVector(plankDir, 5.5); plankFoot.y = height(plankFoot.x, plankFoot.z) + 0.1;
  // the dock: from the beach out east into the sea
  let dockXC = C.x + 100; while (height(dockXC, DZ) > SY) dockXC += 0.5;
  let dockX0 = dockXC - 18; while (height(dockX0, DZ) > 62.2) dockX0 += 0.5;
  const dockX1 = dockXC + 36, DOCK_Y = 62.6;
  // the rope bridge across the ravine
  const [ra, rb] = [RIVER[2], RIVER[3]];
  const bMid = v3((ra[0] + rb[0]) / 2, 0, (ra[1] + rb[1]) / 2), rDir = v3(rb[0] - ra[0], 0, rb[1] - ra[1]).normalize();
  const bAx = v3(-rDir.z, 0, rDir.x); // across the river (north → south when negative z first)
  const bN = bMid.clone().addScaledVector(bAx, -13), bS = bMid.clone().addScaledVector(bAx, 13);
  bN.y = height(bN.x, bN.z); bS.y = height(bS.x, bS.z);
  const mouthFront = skullWorld(0, 0, 62);
  // footpaths (sandy colour, kept clear of plants) — they lead a child from the dock to everything
  const PATHS = [
    [[dockX0 + 2, DZ], [C.x + 112, C.z - 24], [CAMP.x, CAMP.z], [C.x + 72, C.z - 30], [C.x + 45, C.z - 40], [mouthFront.x, mouthFront.z]],
    [[CAMP.x, CAMP.z], [C.x + 80, C.z - 2], [bN.x, bN.z], [bS.x, bS.z], [C.x + 84, C.z + 66], [plankFoot.x, plankFoot.z]],
    [[C.x + 45, C.z - 40], [C.x + 10, C.z - 26], [C.x - 25, C.z - 8], [C.x - 50, C.z - 22], [XSPOT.x, XSPOT.z]],
    [[C.x - 25, C.z - 8], [C.x - 48, C.z + 8], [C.x - 52, C.z + 35], [MUD.x, MUD.z]],
  ];
  const pathDist = (x, z) => { let d = Infinity; for (const P of PATHS) for (let i = 0; i < P.length - 1; i++) d = Math.min(d, segD(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1])); return d; };

  // ---- terrain ----
  {
    const S = 400, N = 128, geo = new THREE.PlaneGeometry(S, S, N, N);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    const T = { wet: K(0xd9b46c), sand: K(0xf7da8f), grass: K(0x93d35a), jungle: K(0x4c9a3e), rock: K(0xae9a80), dirt: K(0xd8ae6c), mud: K(0x7a5232), path: K(0xead08f), bank: K(0xe2cd95), court: K(0xb9b28e) };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + C.x, z = p.getZ(i) + C.z, h = height(x, z);
      p.setXYZ(i, x, h, z);
      const e = 1.5, slope = Math.hypot(height(x + e, z) - height(x - e, z), height(x, z + e) - height(x, z - e)) / (2 * e);
      riverInfo(x, z);
      const dx = x - C.x, dz = z - C.z, t = Math.hypot(dx, dz) / coastR(Math.atan2(dz, dx)), n = fbm(x * 0.05 + 3, z * 0.05 - 7, 3);
      c.copy(T.jungle).lerp(T.grass, ss(0.5, 0.8, t + (n - 0.5) * 0.2));
      c.lerp(T.court, ss(90, 66, Math.hypot(x - SK.x, z - SK.z)) * 0.6);
      c.lerp(T.sand, ss(0.77, 0.85, t + (n - 0.5) * 0.06));
      c.lerp(T.bank, ss(9, 5.5, Math.min(_rd, Math.hypot(x - LAGOON.x, z - LAGOON.z) - 15)) * (h < 70 ? 1 : 0.4));
      c.lerp(T.rock, ss(0.55, 1.05, slope) * (h > 61.5 ? 1 : 0));
      c.lerp(T.path, ss(3.2, 1.6, pathDist(x, z)) * 0.85);
      c.lerp(T.sand, ss(XSPOT.r + 3, XSPOT.r - 1, Math.hypot(x - XSPOT.x, z - XSPOT.z)));
      c.lerp(T.dirt, ss(CAMP.r + 3, CAMP.r - 2, Math.hypot(x - CAMP.x, z - CAMP.z)));
      c.lerp(T.mud, ss(MUD.r + 2, MUD.r, Math.hypot(x - MUD.x, z - MUD.z)));
      c.lerp(T.wet, ss(60.6, 59.9, h));
      c.multiplyScalar(0.92 + n * 0.16);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, selfLit(tileAs(paintMat({ vertexColors: true }), 'bed'), 0.15));
    mesh.name = 'pirateTerrain';
    group.add(mesh);
  }

  // ---- the skull mountain ----
  {
    const { pos, idx } = surfaceNets(skullShape, -74.4, 34, -72, 2.4, 63, 57, 57);
    const nV = pos.length / 3, P = new Float32Array(nV * 3), Nn = new Float32Array(nV * 3), Cc = new Float32Array(nV * 3), c = new THREE.Color(), _c2 = new THREE.Color();
    const SC = { rock: K(0xe6d8bd), rock2: K(0xc2b39b), moss: K(0x78b44c), red: K(0xe8473c), dot: K(0xfff3dc), cave: K(0x8a76b0), cave2: K(0x6a8ab4), floor: K(0xcaa87e), deep: K(0x2e2a4c), root: K(0x93a66c) };
    for (let v = 0; v < nV; v++) {
      const u = pos[v * 3], y = pos[v * 3 + 1], w = pos[v * 3 + 2];
      const [gu, gy, gw] = grad(skullShape, u, y, w, 0.5);
      const wp = skullWorld(u, y, w);
      P.set([wp.x, wp.y, wp.z], v * 3);
      Nn.set([SKC * gu + SKS * gw, gy, -SKS * gu + SKC * gw], v * 3);
      const n = fbm(u * 0.06 + 2, y * 0.06 + w * 0.04, 3);
      c.copy(SC.rock).lerp(SC.rock2, ss(0.35, 0.7, n));
      const lo = 123 + 0.16 * w + 2 * Math.sin(u * 0.15), band = ss(lo - 0.8, lo + 0.8, y) * ss(lo + 15.8, lo + 14.2, y);
      const depth = ss(-0.5, -4, skullBlobs(u, y, w)); // 0 on the outer skin, 1 on carved surfaces deep inside
      if (gy > 0.3) c.lerp(SC.moss, ss(0.5, 0.62, fbm(u * 0.05 + 9, w * 0.05 - 3, 2) + gy * 0.15));
      c.lerp(SC.root, ss(78, 64, y));
      _c2.copy(SC.red); if (Math.sin(u * 0.45) * Math.sin(y * 0.45 + 1) * Math.sin(w * 0.45 + 2) > 0.5) _c2.copy(SC.dot);
      c.lerp(_c2, band);
      if (caveSDF(u, y, w) < 3) { // grotto and mouth tunnel
        _c2.copy(SC.cave).lerp(SC.cave2, n);
        if (gy > 0.6 && y < HALL_FLOOR + 2) _c2.copy(SC.floor).multiplyScalar(0.9 + n * 0.2);
        c.lerp(_c2, depth);
      } else if (eyeSDF(u, y, w) < 3 || noseSDF(u, y, w) < 3) c.lerp(_c2.copy(SC.deep).lerp(SC.cave, 0.25 * n), depth);
      Cc.set([c.r, c.g, c.b], v * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, selfLit(tileAs(paintMat({ vertexColors: true }), 'rock'), 0.17));
    mesh.name = 'skullMountain';
    group.add(mesh);
    // teeth stones
    const SKM = new THREE.Matrix4().compose(v3(SK.x, 0, SK.z), new THREE.Quaternion().setFromAxisAngle(UPV, SK.a), v3(1, 1, 1));
    TEETH.forEach((t) => put('solid', new THREE.CapsuleGeometry(1, 1.2, 3, 8), 0xfff4dc, L(SKM, t[0], t[1] + (t[1] > MOUTH_Y ? 0.6 : -0.4), t[2], 0, 0, 0, t[3] * 0.9, t[4] / 2.1, t[5] * 0.7)));
    // the bandana's knot and tails on the east side at the back
    let s = 80; const ka = -0.75, ku = Math.cos(ka), kw = Math.sin(ka);
    while (s > 0 && skullBlobs(ku * s, 124, -4 + kw * s) > 0) s -= 0.5;
    const knot = (du, dy, sx, sy, sz, rz) => put('cloth', lumpify(new THREE.IcosahedronGeometry(1, 1), 0.12, 2, 5), 0xe8473c, L(SKM, ku * (s + 2), 124 + dy, -4 + kw * (s + 2) + du, 0, ka, rz, sx, sy, sz));
    knot(0, 0, 3, 3.2, 3, 0); knot(3, 1.5, 2.2, 4.5, 1.6, 0.6); knot(-3.5, 1, 2.2, 4.5, 1.6, -0.6);
    for (const [o, r] of [[1.5, 0.25], [-1.5, -0.3]]) put('cloth', new THREE.BoxGeometry(0.4, 14, 3).translate(0, -7, 0), 0xe8473c, L(SKM, ku * (s + 2.5), 122, -4 + kw * (s + 2.5) + o, r, ka, 0.15));
    // wild flowers growing on the high ledges
    for (const l of [LEDGE.f1, LEDGE.f2, LEDGE.f3, LEDGE.cliff]) for (let k = 0; k < 5; k++) {
      const a = rnd() * 6.28, d = rr(1.5, 3.8), p = skullWorld(l.u + Math.cos(a) * d, l.top - 0.1, l.w + Math.sin(a) * d);
      put('cloth', bloomGeo(), pick([0xff5a8a, 0xffb03a, 0xc77dff, 0xffe14a]), mat(p.x, p.y, p.z, 0, rnd() * 6, 0, rr(0.8, 1.2)));
      put('cloth', stemGeo(), 0xffffff, mat(p.x, p.y, p.z, 0, rnd() * 6, 0, rr(0.8, 1.2)));
    }
    // soft glow deep inside the eye sockets and the nose
    for (const u of [-20, 20]) glow(skullWorld(u, 114, 37), 0x9feaff, 12, 0.45, 0.15);
    // vines hanging down the cheeks and brow
    const vineGeo = [];
    for (let k = 0; k < 16; k++) {
      const ang = rr(-0.2, Math.PI + 0.2), y0 = rr(108, 130);
      let a = null;
      let r0 = 70; while (r0 > 0 && skullShape(Math.cos(ang) * r0, y0, -4 + Math.sin(ang) * r0) > 0.4) r0 -= 0.5;
      let p = v3(Math.cos(ang) * r0, y0, -4 + Math.sin(ang) * r0);
      if (eyeSDF(p.x, p.y, p.z) < 4 || caveSDF(p.x, p.y, p.z) < 4) continue;
      const len = rr(8, 18);
      for (let y = 0; y < len; y += 2) {
        const q = v3(p.x, p.y - 2, p.z);
        for (let it = 0; it < 3; it++) { const d = skullShape(q.x, q.y, q.z) - 0.4, g = grad(skullShape, q.x, q.y, q.z); q.x -= g[0] * d; q.y -= g[1] * d; q.z -= g[2] * d; }
        if (q.y > p.y - 0.5 || eyeSDF(q.x, q.y, q.z) < 3 || caveSDF(q.x, q.y, q.z) < 3 || noseSDF(q.x, q.y, q.z) < 3) break;
        a = skullWorld(p.x, p.y, p.z); const b = skullWorld(q.x, q.y, q.z);
        vineGeo.push({ geo: tube(a, b, 0.14, 0.12, 3), color: 0x4f9a3a });
        vineGeo.push({ geo: frondGeo(1.6, 0.9, 0.3, 2, false), color: pick([0x4ca83e, 0x5cb846]), matrix: mat(b.x, b.y, b.z, 0, rnd() * 6, -0.5) });
        p = q;
      }
    }
    vineGeo.forEach((v) => parts.cloth.push(v));
  }

  // ---- lookout on top of the skull ----
  const topY = traceDown(0, -6, 200, skullShape), topP = skullWorld(0, topY + 0.85, -6);
  {
    const M = new THREE.Matrix4().compose(v3(topP.x, topY, topP.z), new THREE.Quaternion().setFromAxisAngle(UPV, SK.a), v3(1, 1, 1));
    put('solid', new THREE.CylinderGeometry(4.6, 4.4, 0.5, 14).translate(0, 0.6, 0), 0xb07a48, M);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; put('solid', new THREE.CylinderGeometry(0.12, 0.12, 1.2, 5).translate(Math.cos(a) * 4.4, 1.4, Math.sin(a) * 4.4), 0x8a5a32, M); }
    put('solid', new THREE.TorusGeometry(4.4, 0.1, 4, 24).rotateX(Math.PI / 2).translate(0, 2, 0), 0x8a5a32, M);
    for (const [x, z] of [[2.5, 2.5], [-2.5, 2.5], [2.5, -2.5], [-2.5, -2.5]]) put('solid', new THREE.CylinderGeometry(0.25, 0.3, 4, 6).translate(x, -1.2, z), 0x8a5a32, M);
    put('solid', new THREE.CylinderGeometry(0.22, 0.3, 14, 7).translate(3.4, 7.5, 0), 0x9a6a3e, M);
    put('solid', new THREE.CylinderGeometry(0.15, 0.25, 1.8, 8).rotateZ(1.2).translate(-1.6, 2.4, -1.5), 0xffc84a, M); // telescope
    put('solid', new THREE.CylinderGeometry(0.06, 0.06, 1.6, 4).translate(-1.4, 1.6, -1.5), 0x5a3a20, M);
    flag(W(M, 3.4, 12, 0), SK.a + Math.PI / 2, 7, 4.4);
    cols.push({ ...xz(W(M, 3.4, 0, 0)), r: 0.6, bottom: topY, top: topY + 15 });
    discDeck(topP.x, topP.z, 4.5, topY + 0.85);
    VIL.topM = M;
  }
  function xz(p) { return { x: p.x, z: p.z }; }

  // ---- inside the grotto ----
  const G = (u, w, y = HALL_FLOOR) => skullWorld(u, y, w);
  const SKM = new THREE.Matrix4().compose(v3(SK.x, 0, SK.z), new THREE.Quaternion().setFromAxisAngle(UPV, SK.a), v3(1, 1, 1));
  const POOL = [-12, -4], HOARD = [13, -12];
  const CRYSTALS = [[-21, 4], [21, 2], [-4, -24], [9, -22]], LANTERNS = [[-16, -15], [2, 11], [19, -2]];
  {
    stoneRing(G(...POOL).x, G(...POOL).z, HALL_FLOOR + 0.1, 6, 12, 0.7, 0x8a82a8);
    put('solid', new THREE.CircleGeometry(5.7, 24).rotateX(-Math.PI / 2), 0x55c4e0, L(SKM, POOL[0], HALL_FLOOR + 0.35, POOL[1]));
    glow(G(POOL[0], POOL[1], 78.5), 0x7ff0ff, 10, 0.35, 0.2);
    // the hoard: a heap of gold, an open chest, a crown and gems
    put('glow', lumpify(new THREE.IcosahedronGeometry(1, 2), 0.12, 2.5, 3), 0xffcf45, L(SKM, HOARD[0], HALL_FLOOR, HOARD[1], 0, 0, 0, 4, 1.7, 3.4));
    for (let k = 0; k < 26; k++) { const a = rnd() * 6.28, d = rr(3.5, 6); put('glow', new THREE.CylinderGeometry(0.25, 0.25, 0.06, 8), 0xffd24a, L(SKM, HOARD[0] + Math.cos(a) * d, HALL_FLOOR + 0.1, HOARD[1] + Math.sin(a) * d * 0.9, rr(-0.3, 0.3), 0, rr(-0.3, 0.3))); }
    for (let k = 0; k < 8; k++) put('glow', new THREE.OctahedronGeometry(0.4, 0), pick([0xff5a8a, 0x5ae0ff, 0x8aff7a, 0xc77dff]), L(SKM, HOARD[0] + rr(-3, 3), HALL_FLOOR + rr(0.8, 1.6), HOARD[1] + rr(-2.5, 2.5), rnd(), rnd(), 0));
    const crown = L(SKM, HOARD[0] - 0.5, HALL_FLOOR + 1.75, HOARD[1], 0.15, 0, 0.1);
    put('glow', new THREE.CylinderGeometry(0.75, 0.7, 0.45, 10, 1, true), 0xffd24a, crown);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28; put('glow', new THREE.ConeGeometry(0.18, 0.5, 4).translate(Math.cos(a) * 0.72, 0.45, Math.sin(a) * 0.72), 0xffd24a, crown); }
    chest(L(SKM, HOARD[0] + 4.5, HALL_FLOOR, HOARD[1] + 3.5, 0, -0.6, 0));
    glow(G(HOARD[0], HOARD[1], 79.5), 0xffd27a, 12, 0.45, 0.1);
    // crystal clusters along the walls
    CRYSTALS.concat([[-12, 12], [22, -12], [-19, -16]]).forEach(([u, w], i) => {
      const col = [0xff8ad8, 0x7ae8ff, 0xb68aff, 0x8affc8, 0x7ae8ff, 0xff8ad8, 0xffe07a][i], out = Math.atan2(w + 5, u);
      for (let k = 0; k < 8; k++) {
        const s = rr(1.3, 2.8) * (i > 3 ? 0.7 : 1), a = out + rr(-0.9, 0.9);
        put('glow', new THREE.OctahedronGeometry(0.5, 0).scale(0.55, 2, 0.55).translate(0, 0.9, 0), col, L(SKM, u + Math.cos(out) * 1.5 + rr(-1.5, 1.5), HALL_FLOOR - 0.2, w + Math.sin(out) * 1.5 + rr(-1.5, 1.5), Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, s, s, s));
      }
      glow(G(u, w, 79), col, 9, 0.5, 0.25);
    });
    // lanterns on posts (to light) and a few hanging from the ceiling
    LANTERNS.forEach(([u, w]) => {
      const M = L(SKM, u, HALL_FLOOR, w);
      put('solid', new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6).translate(0, 0.8, 0), 0x6a4a2a, M);
      put('glow', new THREE.BoxGeometry(0.6, 0.75, 0.6).translate(0, 1.95, 0), 0xffd27a, M);
      put('solid', new THREE.ConeGeometry(0.55, 0.45, 4).rotateY(Math.PI / 4).translate(0, 2.55, 0), 0x3a3a48, M);
      glow(G(u, w, HALL_FLOOR + 2), 0xffc070, 5, 0.6, 0.35);
    });
    for (const [u, w] of [[-6, 0], [8, -8], [-14, -10]]) {
      const top = traceUp(u, w, 92), M = L(SKM, u, 0, w);
      put('solid', new THREE.CylinderGeometry(0.05, 0.05, top - 95, 4).translate(0, (top + 95) / 2, 0), 0x3a3a48, M);
      put('glow', new THREE.BoxGeometry(0.7, 0.9, 0.7).translate(0, 94.5, 0), 0xffd27a, M);
      glow(G(u, w, 94.5), 0xffc070, 6, 0.55, 0.35);
    }
    // stalactites and glowing mushrooms
    for (let k = 0; k < 18; k++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * 0.8, u = Math.cos(a) * d * 25, w = -5 + Math.sin(a) * d * 23;
      if (Math.hypot(u, w - 10) < 6) continue; // keep the way in clear
      const top = traceUp(u, w, 90), len = rr(1.5, 4.5);
      put('solid', new THREE.ConeGeometry(rr(0.4, 0.9), len, 6).rotateX(Math.PI).translate(0, top - len / 2 + 0.4, 0), 0x8f80b8, L(SKM, u, 0, w));
    }
    for (let k = 0; k < 10; k++) {
      const a = rnd() * 6.28, u = Math.cos(a) * 21, w = -5 + Math.sin(a) * 19, M = L(SKM, u, HALL_FLOOR - 0.1, w), s = rr(0.6, 1.2);
      put('solid', new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.7 * s, 5).translate(0, 0.35 * s, 0), 0xf0e6ff, M);
      put('glow', new THREE.SphereGeometry(0.4 * s, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.7 * s, 0), pick([0x7ae8ff, 0xff8ad8, 0xb6ff8a]), M);
    }
  }

  // ---- the pirate ship ----
  {
    const M = shipM, { LEN, W: SW, D } = SHIP;
    // hull: a stretched half-sphere with a blunt stern and a rising bow; bulwarks rise above the deck
    const hull = new THREE.SphereGeometry(1, 26, 10, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6);
    const hp = hull.attributes.position, hc = new Float32Array(hp.count * 3), c = new THREE.Color();
    for (let i = 0; i < hp.count; i++) {
      let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
      z = z < 0 ? -Math.pow(-z, 0.6) : z;
      const bow = Math.max(0, z);
      x *= SW * (1 - bow * bow * 0.7); y = y * D + bow * bow * bow * 1.6; z *= LEN;
      hp.setXYZ(i, x, y, z);
      if (y > 1.25) c.set(0xf2c14e); else if (y > 0) c.set(0xd04a3c); else c.set(Math.floor(y * 1.6) % 2 ? 0x8a5a3a : 0x9e6c46);
      if (y < -D * 0.6) c.set(0x5e3a28);
      hc.set([c.r, c.g, c.b], i * 3);
    }
    hull.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    hull.computeVertexNormals();
    put('cloth', hull, 0xffffff, M);
    const outline = [];
    for (let k = 0; k <= 32; k++) { const a = (k / 32) * Math.PI * 2, z = Math.sin(a), lz = (z < 0 ? -Math.pow(-z, 0.6) : z) * LEN * 0.97; outline.push(new THREE.Vector2(Math.cos(a) >= 0 ? shipHalfW(lz) * 0.96 : -shipHalfW(lz) * 0.96, -lz)); }
    put('solid', new THREE.ShapeGeometry(new THREE.Shape(outline)).rotateX(-Math.PI / 2).translate(0, 0.05, 0), 0xc89a68, M);
    // stern cabin (its roof is a quarterdeck) with windows and a door
    put('solid', new THREE.BoxGeometry(7.2, 3.2, 5.7).translate(0, 1.6, -9.35), 0xa8703f, M);
    put('solid', new THREE.BoxGeometry(7.8, 0.35, 6.2).translate(0, 3.3, -9.35), 0x7a4a2a, M);
    put('solid', new THREE.BoxGeometry(1.3, 2.1, 0.1).translate(0, 1.05, -6.45), 0x5a3a22, M);
    for (const x of [-2.4, 2.4]) put('glow', new THREE.CircleGeometry(0.45, 10).translate(x, 1.9, -6.44), 0xffe9a0, M);
    for (const s of [-1, 1]) for (const z of [-8.2, -10.6]) put('glow', new THREE.CircleGeometry(0.4, 10).rotateY(s * Math.PI / 2).translate(s * 3.62, 1.9, z), 0xffe9a0, M);
    for (let k = 0; k < 9; k++) put('solid', new THREE.CylinderGeometry(0.07, 0.07, 0.9, 4).translate(-3.6 + k * 0.9, 3.9, -6.6), 0x7a4a2a, M);
    // ship's wheel
    put('solid', new THREE.TorusGeometry(0.8, 0.08, 4, 14).translate(0, 2, -5.6), 0x7a4a2a, M);
    for (let k = 0; k < 4; k++) put('solid', new THREE.BoxGeometry(2.1, 0.08, 0.08).rotateZ(k * 0.785).translate(0, 2, -5.6), 0x7a4a2a, M);
    put('solid', new THREE.CylinderGeometry(0.15, 0.2, 2, 6).translate(0, 1, -5.8), 0x7a4a2a, M);
    // masts, striped sails, crow's nest, flag
    const stripes = (w, h, seed) => { // a billowing sail of crisp red and cream stripes
      const list = [];
      for (let k = 0; k < 6; k++) {
        const g = new THREE.PlaneGeometry(w / 6, h, 1, 5).translate(-w / 2 + (k + 0.5) * w / 6, 0, 0), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, (1 - (x / w * 2) ** 2) * 0.9 + Math.sin(y * 0.8 + seed) * 0.15); }
        g.computeVertexNormals();
        list.push({ geo: g, color: k % 2 ? 0xe8473c : 0xfff4e4 });
      }
      return mergeParts(list);
    };
    for (const [z, h] of [[0, 21], [7.5, 16]]) {
      put('solid', new THREE.CylinderGeometry(0.25, 0.38, h, 8).translate(0, h / 2, z), 0x9a6a3e, M);
      for (const [y, w] of [[h * 0.42, 10], [h * 0.75, 7.5]]) {
        put('solid', new THREE.CylinderGeometry(0.12, 0.12, w + 1, 5).rotateZ(Math.PI / 2).translate(0, y + h * 0.13, z), 0x9a6a3e, M);
        put('cloth', stripes(w, h * 0.26, z + y), 0xffffff, L(M, 0, y, z + 0.3));
      }
      for (const s of [-1, 1]) for (const dz of [-1.2, 1.2]) put('solid', tube(v3(0, h * 0.85, z), v3(s * shipHalfW(z + dz) * 0.95, 1.3, z + dz), 0.05, 0.05, 3), 0x5a4030, M);
      cols.push({ ...xz(W(M, 0, 0, z)), r: 0.6, bottom: shipO.y - 1, top: shipO.y + h });
    }
    put('cloth', new THREE.CylinderGeometry(1.2, 1.0, 1.1, 10, 1, true).translate(0, 16, 0), 0xa8703f, M);
    put('solid', new THREE.CircleGeometry(1.0, 10).rotateX(-Math.PI / 2).translate(0, 15.5, 0), 0x8a5a32, M); // the crow's nest floor
    const nest = W(M, 0, 15.5, 0);
    discDeck(nest.x, nest.z, 0.95, nest.y);
    flag(W(M, 0, 21.4, 0), shipYaw + Math.PI / 2, 4, 2.5);
    // bowsprit and its rope, cannons, anchor, plank down to the sand
    put('solid', tube(v3(0, 1.5, 13), v3(0, 4.8, 20), 0.3, 0.15, 6), 0x9a6a3e, M);
    put('solid', tube(v3(0, 4.8, 20), v3(0, 15.5, 7.5), 0.05, 0.05, 3), 0x5a4030, M);
    put('glow', new THREE.IcosahedronGeometry(0.6, 0).translate(0, 2.6, 14.4), 0xffd24a, M);
    for (const s of [-1, 1]) for (const z of [-3, 2, 6]) put('solid', new THREE.CylinderGeometry(0.3, 0.38, 2, 8).rotateZ(Math.PI / 2).translate(s * (shipHalfW(z) + 0.2), 0.9, z), 0x3a3a48, M);
    put('solid', boxBetween(plankTop, plankFoot, 1.1, 0.18), 0xb08050);
    // a treasure chest and barrels on deck
    chest(L(M, 1.8, 0.05, -3.2, 0, 0.4, 0));
    barrel(L(M, -2.6, 0.05, 2.5)); barrel(L(M, -3.0, 0.05, 3.6, 0, 1, 0, 0.9));
    crate(L(M, 2.8, 0.05, 4, 0, 0.3, 0));
    // floor: the deck plane (and the cabin roof)
    const nrm = v3(0, 1, 0).applyQuaternion(shipQ), cy = Math.cos(shipYaw), sy = Math.sin(shipYaw);
    decks.push((px, pz, top) => {
      const dx = px - shipO.x, dz = pz - shipO.z, lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
      if (Math.abs(lz) > LEN * 0.92 || Math.abs(lx) > shipHalfW(lz) * 0.95) return -Infinity;
      const y = shipO.y - (nrm.x * dx + nrm.z * dz) / nrm.y + 0.1;
      return lz > -12.2 && lz < -6.5 && Math.abs(lx) < 3.9 && y + 3.4 <= top ? y + 3.4 : y;
    });
    cols.push({ x: shipO.x, z: shipO.z, hw: SW * 0.95, hd: LEN * 0.95, yaw: shipYaw, top: shipO.y - 1.6 });
    cols.push({ ...xz(W(M, 0, 0, -9.35)), hw: 3.6, hd: 2.85, yaw: shipYaw, bottom: shipO.y + 0.3, top: shipO.y + 3.3 });
    avoid.push([shipO.x, shipO.z, 18]);
  }

  // ---- the dock (arrival point) with a rowboat and a lamp ----
  {
    for (let x = dockX0; x < dockX1 - 6; x += 1.05) put('solid', new THREE.BoxGeometry(0.95, 0.25, 5), rnd() < 0.5 ? 0xb88a58 : 0xa77a4a, mat(x + 0.5, DOCK_Y - 0.12, DZ, rr(-0.02, 0.02), rr(-0.03, 0.03), 0));
    for (let z = DZ - 10; z < DZ + 10; z += 1.05) put('solid', new THREE.BoxGeometry(6, 0.25, 0.95), rnd() < 0.5 ? 0xb88a58 : 0xa77a4a, mat(dockX1 - 3, DOCK_Y - 0.12, z + 0.5));
    const posts = [];
    for (let x = dockX0 + 1; x < dockX1 - 6; x += 4.5) posts.push([x, DZ - 2.6], [x, DZ + 2.6]);
    for (const z of [-10, -5, 5, 10]) posts.push([dockX1 - 6, DZ + z], [dockX1, DZ + z]);
    for (const [x, z] of posts) put('solid', new THREE.CylinderGeometry(0.28, 0.32, DOCK_Y + 1 - 52, 7).translate(0, (DOCK_Y + 1 + 52) / 2, 0), 0x8a6238, mat(x, 0, z));
    for (const s of [-1, 1]) put('solid', tube(v3(dockX0 + 1, DOCK_Y + 0.8, DZ + s * 2.6), v3(dockX1 - 6, DOCK_Y + 0.8, DZ + s * 2.6), 0.07, 0.07, 4), 0xd8c08a);
    put('solid', new THREE.CylinderGeometry(0.15, 0.2, 4, 6).translate(dockX1 - 0.6, DOCK_Y + 2, DZ - 9.4), 0x3a3a48);
    put('glow', new THREE.BoxGeometry(0.6, 0.8, 0.6).translate(dockX1 - 0.6, DOCK_Y + 4.3, DZ - 9.4), 0xffd27a);
    glow(v3(dockX1 - 0.6, DOCK_Y + 4.3, DZ - 9.4), 0xffd27a, 5, 0.6, 0.3);
    cols.push({ x: dockX1 - 0.6, z: DZ - 9.4, r: 0.4, top: DOCK_Y + 4.8 });
    barrel(mat(dockX1 - 4.5, DOCK_Y, DZ - 8.5)); barrel(mat(dockX1 - 1.4, DOCK_Y, DZ + 8.8)); crate(mat(dockX0 + 6, DOCK_Y, DZ + 1.4, 0, 0.3, 0), 1.1);
    cols.push({ x: dockX1 - 4.5, z: DZ - 8.5, r: 0.7, top: DOCK_Y + 1.3 }, { x: dockX1 - 1.4, z: DZ + 8.8, r: 0.7, top: DOCK_Y + 1.3 }, { x: dockX0 + 6, z: DZ + 1.4, hw: 0.6, hd: 0.6, yaw: 0.3, top: DOCK_Y + 1.1 });
    // rowboat
    const rb = new THREE.SphereGeometry(1, 14, 5, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55).scale(1.3, 0.8, 2.8);
    put('cloth', rb, 0x6fb6e0, mat(dockXC + 20, SY + 0.75, DZ + 5.6, 0, 0.15, 0.04));
    put('solid', new THREE.BoxGeometry(2.3, 0.12, 0.5).translate(0, SY + 0.85, 0), 0xc8a070, mat(dockXC + 20, 0, DZ + 5.6, 0, 0.15, 0));
    put('solid', tube(v3(dockXC + 19.8, SY + 0.6, DZ + 3.6), v3(dockXC + 20, DOCK_Y, DZ + 2.6), 0.04, 0.04, 3), 0xd8c08a);
    rectDeck((dockX0 + dockX1 - 6) / 2, DZ, 0, (dockX1 - 6 - dockX0) / 2, 2.5, DOCK_Y);
    rectDeck(dockX1 - 3, DZ, 0, 3, 10, DOCK_Y);
    avoid.push([dockX0, DZ, 6]);
  }
  // sea rocks: beside the dock (Pelly) and off the south beach (Leo), plus a few more
  const seaRock = (x, z, s, top, flat = true) => {
    const y = top - s * 0.55;
    put('solid', rockGeo(Math.floor(x)), pick([0x9a948c, 0xa89e90, 0x8f8a86]), mat(x, y, z, 0, rnd() * 6, 0, s, s * 0.6, s));
    if (flat) discDeck(x, z, s * 0.55, top);
    cols.push({ x, z, r: s * 0.85, top: top - 0.4 });
  };
  const pellyRock = v3(dockXC + 13, 62.4, DZ - 13);
  seaRock(pellyRock.x, pellyRock.z, 4, 62.4); seaRock(pellyRock.x + 5, pellyRock.z - 3, 2.6, 61.6); seaRock(pellyRock.x - 4, pellyRock.z - 4, 2.2, 61.2);
  const leoTh = 1.45, leoR = coastR(leoTh) + 12, leoRock = v3(C.x + Math.cos(leoTh) * leoR, 61.6, C.z + Math.sin(leoTh) * leoR);
  seaRock(leoRock.x, leoRock.z, 3.6, 61.6); seaRock(leoRock.x + 5, leoRock.z + 2, 2.4, 61.1); seaRock(leoRock.x - 4, leoRock.z + 3, 2, 60.9);
  for (const th of [-0.9, -2.0, 2.7, 3.4]) { const r = coastR(th) + rr(6, 14); seaRock(C.x + Math.cos(th) * r, C.z + Math.sin(th) * r, rr(2, 3.5), rr(61, 62.5), false); }

  // ---- camp: campfire, logs, a striped tent, chest, barrels and a flag ----
  {
    const y = CAMP.y;
    stoneRing(CAMP.x, CAMP.z, y + 0.1, 1.6, 9, 0.45);
    for (let k = 0; k < 4; k++) put('solid', new THREE.CylinderGeometry(0.18, 0.18, 2.4, 6).rotateZ(Math.PI / 2 - 0.5).rotateY(k * 1.57), 0x6a4a2a, mat(CAMP.x, y + 0.5, CAMP.z));
    const fire = new THREE.Group();
    fire.position.set(CAMP.x, y + 0.3, CAMP.z);
    const fm = selfLit(paintMat({ vertexColors: true, emissive: 0xff7a20 }), 0.6);
    fire.add(new THREE.Mesh(mergeParts([{ geo: new THREE.ConeGeometry(0.9, 2.4, 7).translate(0, 1.2, 0), color: 0xff7a2a }, { geo: new THREE.ConeGeometry(0.55, 1.7, 7).translate(0.2, 0.9, 0.1), color: 0xffd23a }, { geo: new THREE.ConeGeometry(0.45, 1.3, 6).translate(-0.3, 0.7, -0.2), color: 0xffb02a }]), fm));
    group.add(fire);
    fires.push(fire);
    glow(v3(CAMP.x, y + 1.6, CAMP.z), 0xffa040, 9, 0.7, 0.5);
    cols.push({ x: CAMP.x, z: CAMP.z, r: 1.8, top: y + 2.5 });
    for (let k = 0; k < 4; k++) {
      const a = k * 1.57 + 0.4, x = CAMP.x + Math.cos(a) * 4.2, z = CAMP.z + Math.sin(a) * 4.2;
      put('solid', new THREE.CylinderGeometry(0.45, 0.45, 2.6, 8).rotateZ(Math.PI / 2), 0x8a5a32, mat(x, y + 0.42, z, 0, -a + Math.PI / 2, 0));
    }
    // cooking pot on a tripod
    for (let k = 0; k < 3; k++) { const a = k * 2.094; put('solid', tube(v3(CAMP.x + Math.cos(a) * 1.5, y, CAMP.z + Math.sin(a) * 1.5), v3(CAMP.x, y + 3, CAMP.z), 0.08, 0.06, 4), 0x5a3a22); }
    put('solid', new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), 0x3a3a48, mat(CAMP.x, y + 2.3, CAMP.z));
    // tent (open toward the fire)
    const tx = CAMP.x + 8, tz = CAMP.z - 6, toFire = Math.atan2(CAMP.z - tz, CAMP.x - tx);
    for (let i = 1; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2, g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.8, 0, Math.cos(a1) * 3, 0, Math.sin(a1) * 3, Math.cos(a0) * 3, 0, Math.sin(a0) * 3], 3));
      g.computeVertexNormals();
      put('cloth', g, i % 2 ? 0xe8473c : 0xfff4e4, mat(tx, y, tz, 0, -toFire - Math.PI / 6, 0));
    }
    put('solid', new THREE.CylinderGeometry(0.08, 0.08, 4.6, 4).translate(0, 2.3, 0), 0x6a4a2a, mat(tx, y, tz));
    cols.push({ x: tx, z: tz, r: 2.7, top: y + 3.6 });
    chest(mat(CAMP.x - 5, y, CAMP.z - 4, 0, 0.8, 0), false);
    barrel(mat(CAMP.x + 3, y, CAMP.z + 6)); barrel(mat(CAMP.x + 4.2, y, CAMP.z + 6.6)); crate(mat(CAMP.x + 3.6, y, CAMP.z + 7.8, 0, 0.5, 0));
    cols.push({ x: CAMP.x + 3.7, z: CAMP.z + 6.8, r: 1.6, top: y + 1.6 }, { x: CAMP.x - 5, z: CAMP.z - 4, hw: 0.9, hd: 0.6, yaw: 0.8, top: y + 1.4 });
    put('solid', new THREE.CylinderGeometry(0.15, 0.2, 8, 6).translate(0, 4, 0), 0x9a6a3e, mat(CAMP.x - 7, y, CAMP.z + 5));
    flag(v3(CAMP.x - 7, y + 7.2, CAMP.z + 5), 0.4, 3, 1.9);
    cols.push({ x: CAMP.x - 7, z: CAMP.z + 5, r: 0.4, top: y + 8 });
    avoid.push([CAMP.x, CAMP.z, CAMP.r + 6]);
  }

  // ---- X marks the spot ----
  {
    const y = XSPOT.y + 0.06;
    for (const r of [0.785, -0.785]) put('solid', new THREE.BoxGeometry(8, 0.14, 1.5), 0xd8342c, mat(XSPOT.x, y, XSPOT.z, 0, r, 0));
    stoneRing(XSPOT.x, XSPOT.z, y, 8.5, 14, 0.55, 0xc8bca8);
    const sp = mat(XSPOT.x + 5.5, y, XSPOT.z + 2.5, 0.2, 0.5, 0.15);
    put('solid', new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5).translate(0, 1.9, 0), 0x8a5a32, sp);
    put('solid', new THREE.BoxGeometry(0.8, 1, 0.08).translate(0, 0.4, 0), 0x9aa0b0, sp);
    put('solid', new THREE.CylinderGeometry(0.12, 0.15, 2.6, 6).translate(0, 1.3, 0), 0x8a5a32, mat(XSPOT.x - 7, y, XSPOT.z - 4));
    put('solid', new THREE.BoxGeometry(2.2, 0.9, 0.12).translate(0, 2.3, 0), 0xc89a5c, mat(XSPOT.x - 7, y, XSPOT.z - 4, 0, 0.6, 0.1));
    avoid.push([XSPOT.x, XSPOT.z, XSPOT.r + 4]);
  }

  // ---- fresh water: lagoon, river ribbon, lily pads, mud pool ----
  {
    const water = [{ geo: new THREE.CircleGeometry(27, 40).rotateX(-Math.PI / 2).translate(LAGOON.x, LAGOON.y, LAGOON.z) }];
    const pts = [];
    for (let i = 0; i < RIVER.length - 1; i++) for (let k = 0; k < 12; k++) { const t = k / 12; pts.push(v3(lerp(RIVER[i][0], RIVER[i + 1][0], t), 0, lerp(RIVER[i][1], RIVER[i + 1][1], t))); }
    pts.push(v3(RIVER[RIVER.length - 1][0], 0, RIVER[RIVER.length - 1][1]));
    const offshore = (p) => Math.hypot(p.x - C.x, p.z - C.z) > coastR(Math.atan2(p.z - C.z, p.x - C.x)) + 1;
    while (pts.length > 2 && offshore(pts[pts.length - 2])) pts.pop();
    const rp = [], ri = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], d = v3(b.x - a.x, 0, b.z - a.z).normalize();
      riverInfo(p.x, p.z);
      const y = riverLevel(_rs) - 0.02;
      rp.push(p.x - d.z * 6.5, y, p.z + d.x * 6.5, p.x + d.z * 6.5, y, p.z - d.x * 6.5);
      if (i) { const o = (i - 1) * 2; ri.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    });
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    rg.setIndex(ri);
    rg.computeVertexNormals();
    water.push({ geo: rg });
    const wm = selfLit(paintMat({ color: 0x7fd3f2, vertexColors: true, transparent: true, opacity: 0.86 }), 0.22);
    const wmesh = new THREE.Mesh(mergeParts(water), wm);
    wmesh.name = 'freshWater';
    group.add(wmesh);
    for (let k = 0; k < 9; k++) {
      const a = rnd() * 6.28, d = rr(4, 16), x = LAGOON.x + Math.cos(a) * d, z = LAGOON.z + Math.sin(a) * d;
      put('solid', new THREE.CircleGeometry(rr(0.9, 1.6), 10, 0.4, Math.PI * 2 - 0.5).rotateX(-Math.PI / 2), 0x5cbf4a, mat(x, LAGOON.y + 0.06, z, 0, rnd() * 6, 0));
      if (k % 3 === 0) put('solid', bloomGeo().scale(0.6, 0.6, 0.6), 0xff9ad0, mat(x, LAGOON.y - 0.5, z));
    }
    const my = height(MUD.x, MUD.z) + 0.75;
    put('solid', new THREE.CircleGeometry(MUD.r + 0.8, 18).rotateX(-Math.PI / 2), 0x6e4a2c, mat(MUD.x, my, MUD.z));
    for (let k = 0; k < 5; k++) put('solid', new THREE.SphereGeometry(rr(0.25, 0.5), 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a5e3a, mat(MUD.x + rr(-3, 3), my, MUD.z + rr(-3, 3)));
    avoid.push([MUD.x, MUD.z, MUD.r + 4], [LAGOON.x, LAGOON.z, 24]);
  }

  // ---- rope bridge over the ravine ----
  const bridgeY = (s) => Math.max(lerp(bN.y, bS.y, s) + 0.4 - Math.sin(s * Math.PI) * 1.6, height(lerp(bN.x, bS.x, s), lerp(bN.z, bS.z, s)) + 0.4);
  {
    const yaw = Math.atan2(bAx.x, bAx.z), len = bN.distanceTo(v3(bS.x, bN.y, bS.z));
    for (let k = 0; k <= 30; k++) { const s = k / 30, x = lerp(bN.x, bS.x, s), z = lerp(bN.z, bS.z, s); put('solid', new THREE.BoxGeometry(2.6, 0.18, 0.6), rnd() < 0.5 ? 0xb88a58 : 0x9e7046, mat(x, bridgeY(s), z, 0, yaw + rr(-0.05, 0.05), 0)); }
    for (const side of [-1.35, 1.35]) {
      const off = v3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(side);
      for (let k = 0; k < 10; k++) {
        const s0 = k / 10, s1 = (k + 1) / 10;
        const a = v3(lerp(bN.x, bS.x, s0), bridgeY(s0) + 1.2, lerp(bN.z, bS.z, s0)).add(off), b = v3(lerp(bN.x, bS.x, s1), bridgeY(s1) + 1.2, lerp(bN.z, bS.z, s1)).add(off);
        put('solid', tube(a, b, 0.07, 0.07, 3), 0xd8c08a);
        put('solid', tube(a, v3(a.x, bridgeY(s0), a.z), 0.04, 0.04, 3), 0xd8c08a);
      }
      for (const e of [bN, bS]) { put('solid', new THREE.CylinderGeometry(0.22, 0.26, 2.2, 6).translate(0, 1, 0), 0x8a6238, mat(e.x + off.x, e.y, e.z + off.z)); cols.push({ x: e.x + off.x, z: e.z + off.z, r: 0.35, top: e.y + 2.1 }); }
    }
    decks.push((px, pz) => {
      const dx = px - bN.x, dz = pz - bN.z, s = (dx * bAx.x + dz * bAx.z) / len, lat = Math.abs(dx * rDir.x + dz * rDir.z);
      return s >= 0 && s <= 1 && lat < 1.4 ? bridgeY(s) + 0.1 : -Infinity;
    });
  }

  // ---- the pirate village on the east beach: shacks on stilts, a market, a juice bar, a washing line,
  // a little shipyard, a swing, a garden and a sandcastle. Its own random stream, so the rest looks the same.
  {
    const vr = mulberry32(4471), vrr = (a, b) => a + (b - a) * vr(), vpick = (arr) => arr[Math.floor(vr() * arr.length)];
    const gnd = (x, z) => height(x, z);
    const box = (M, w, h, d, x, y, z, color, bucket = 'solid') => put(bucket, new THREE.BoxGeometry(w, h, d).translate(x, y, z), color, M);
    const cyl = (M, r0, r1, h, x, y, z, color, seg = 6, bucket = 'solid') => put(bucket, new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y + h / 2, z), color, M);
    const stilt = (x, z, y1, r = 0.16) => { const y0 = gnd(x, z) - 0.6; if (y1 - y0 > 0.2) put('solid', new THREE.CylinderGeometry(r, r * 1.15, y1 - y0, 6).translate(0, (y0 + y1) / 2, 0), 0x8a6238, mat(x, 0, z)); };
    const roofGeo = (halfW, len, h) => { const r = halfW / 0.866; return new THREE.CylinderGeometry(r, r, len, 3, 1).rotateX(-Math.PI / 2).translate(0, r / 2, 0).scale(1, h / (1.5 * r), 1); };
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.45, 0], 3));
    tri.computeVertexNormals();
    const PENN = [0xe8473c, 0xffd23a, 0x3ab0e8, 0x5cc24c, 0xff8ad0, 0xffffff, 0xc77dff];
    const bunting = (a, b, sag = 0.6) => { // a rope of little pennants from a to b
      const n = Math.max(4, Math.round(a.distanceTo(b) / 0.8)), yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
      let prev = a;
      for (let k = 1; k <= n; k++) {
        const t = k / n, p = v3(lerp(a.x, b.x, t), lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * sag, lerp(a.z, b.z, t));
        put('solid', tube(prev, p, 0.03, 0.03, 3), 0xfff4e2);
        if (k < n) put('cloth', tri, PENN[(k + Math.abs(Math.floor(a.x))) % PENN.length], mat(p.x, p.y, p.z, 0, yaw, 0));
        prev = p;
      }
    };
    const pennant = (M, x, y, z, color) => { cyl(M, 0.05, 0.05, 2.2, x, y, z, 0x6a4a2a, 4); put('cloth', tri, color, L(M, x + 0.25, y + 2.1, z, 0, 0, Math.PI / 2).scale(v3(1.6, 1.6, 1.6))); };

    // shacks: a room on stilts with a porch toward the sea, a pointy roof and a ladder down to the sand
    VIL.shacks = [];
    const shack = (x, z, yaw, wall, roof, trim) => {
      const fl = gnd(x, z) + 0.8, M = mat(x, fl, z, 0, yaw, 0);
      box(M, 5.4, 0.3, 6.8, 0, -0.15, 0.6, 0xb88a58);
      for (const [px, pz] of [[-2.5, -2.6], [2.5, -2.6], [-2.5, 0.6], [2.5, 0.6], [-2.5, 3.8], [2.5, 3.8]]) { const p = W(M, px, 0, pz); stilt(p.x, p.z, fl - 0.2); }
      box(M, 4.6, 3.1, 4.4, 0, 1.55, -0.4, wall);
      for (const s of [-1, 1]) box(M, 0.24, 3.1, 0.24, s * 2.3, 1.55, 1.8, trim);
      box(M, 1.1, 2.0, 0.1, 0, 1.0, 1.85, 0x6a4026);
      put('glow', new THREE.SphereGeometry(0.08, 5, 3).translate(0.38, 1.0, 1.92), 0xffd24a, M);
      for (const s of [-1, 1]) { box(M, 0.95, 0.95, 0.1, s * 1.5, 1.9, 1.85, trim); box(M, 0.7, 0.7, 0.12, s * 1.5, 1.9, 1.86, 0xbfeeff, 'glow'); }
      box(M, 0.1, 0.8, 0.8, 2.32, 1.9, -0.6, trim); box(M, 0.12, 0.6, 0.6, 2.33, 1.9, -0.6, 0xbfeeff, 'glow');
      put('solid', roofGeo(3.1, 7.2, 2.3), roof, L(M, 0, 3.05, 0.45));
      for (const s of [-1, 1]) { box(M, 0.12, 1.0, 0.12, s * 2.55, 0.5, 3.9, trim); box(M, 0.08, 0.08, 2.2, s * 2.55, 0.95, 2.8, trim); box(M, 1.7, 0.08, 0.08, s * 1.7, 0.95, 3.9, trim); }
      const gf = gnd(W(M, 0, 0, 4.4).x, W(M, 0, 0, 4.4).z) - fl; // the ladder down to the sand
      for (const s of [-1, 1]) put('solid', boxBetween(v3(s * 0.45, 0, 3.95), v3(s * 0.45, gf, 4.6), 0.1, 0.1), 0x8a6238, M);
      for (let k = 1; k < 8; k++) { const t = k / 8, y = gf * t; if (y > gf + 0.2) box(M, 0.9, 0.07, 0.16, 0, y, 3.95 + 0.65 * t, 0x8a6238); }
      pennant(M, -1.6, 3.8, -2.2, roof === 0xffd23a ? 0xe8473c : 0xffd23a);
      cols.push({ ...xz(W(M, 0, 0, -0.4)), hw: 2.45, hd: 2.35, yaw, top: fl + 5.4 });
      cols.push({ ...xz(W(M, 0, 0, 2.9)), hw: 2.7, hd: 1.1, yaw, top: fl - 1.0 });
      const pc = W(M, 0, 0, 2.9);
      rectDeck(pc.x, pc.z, yaw, 2.6, 1.05, fl);
      avoid.push([x, z, 7]);
      const sh = { M, fl, yaw };
      VIL.shacks.push(sh);
      return sh;
    };
    const A = shack(C.x + 116.5, C.z + 1, Math.PI / 2, 0xffc2d4, 0xe8473c, 0xfff4e2);
    const B = shack(C.x + 116.5, C.z + 12, Math.PI / 2, 0xbfe8ff, 0xffd23a, 0xffffff);
    const Cs = shack(C.x + 116.5, C.z + 23, Math.PI / 2, 0xd8f5b0, 0x8a5ae0, 0xfff4e2);
    const D = shack(C.x + 123, C.z - 33, Math.PI / 2 + 0.25, 0xffe0a8, 0x3ab0a0, 0xffffff);
    const E = shack(C.x + 127, C.z - 46, Math.PI / 2 + 0.45, 0xe8d0ff, 0xff7a3a, 0xfff4e2);
    const F = shack(C.x + 121, C.z + 35, Math.PI / 2 - 0.3, 0xfff0a0, 0xe8473c, 0xffffff);
    VIL.A = A; VIL.B = B; VIL.C = Cs; VIL.D = D; VIL.E = E; VIL.F = F;
    bunting(W(A.M, 2.4, 3.6, 1.9), W(B.M, -2.4, 3.6, 1.9), 0.5);
    bunting(W(B.M, 2.4, 3.6, 1.9), W(Cs.M, -2.4, 3.6, 1.9), 0.5);

    // market stalls: a counter under a striped awning, goods on top, the stall keeper stands behind
    VIL.stalls = [];
    const stall = (x, z, yaw, awn, kind) => {
      const y = gnd(x, z), M = mat(x, y, z, 0, yaw, 0);
      box(M, 3.2, 1.0, 1.1, 0, 0.5, 0, 0xc89a5c); box(M, 3.4, 0.12, 1.3, 0, 1.06, 0, 0x9a6a3e);
      box(M, 3.22, 0.32, 0.05, 0, 0.75, 0.56, awn);
      for (const s of [-1, 1]) { cyl(M, 0.08, 0.08, 2.45, s * 1.62, 0, 0.6, 0x8a6238, 5); cyl(M, 0.08, 0.08, 3.0, s * 1.62, 0, -2.0, 0x8a6238, 5); }
      for (let k = 0; k < 6; k++) { const sx = -1.7 + (k + 0.5) * (3.4 / 6); put('cloth', boxBetween(v3(sx, 3.0, -2.2), v3(sx, 2.4, 1.0), 3.4 / 6 + 0.01, 0.05), k % 2 ? 0xfff4e4 : awn, M); }
      for (let k = 0; k < 7; k++) put('cloth', new THREE.ConeGeometry(0.25, 0.3, 4).rotateX(Math.PI).translate(-1.45 + k * 0.48, 2.25, 1.05), k % 2 ? 0xfff4e4 : awn, M);
      box(M, 2.0, 0.55, 0.08, 0, 3.35, -2.05, 0xfff4e2); box(M, 1.7, 0.3, 0.1, 0, 3.35, -2.05, awn);
      const top = 1.12;
      if (kind === 'fruit') {
        for (let k = 0; k < 14; k++) put('solid', new THREE.IcosahedronGeometry(vrr(0.15, 0.22), 1), vpick([0xff8a2a, 0xe8304a, 0xffd23a, 0x8ad84a, 0xff6a8a]), L(M, vrr(-1.35, 1.35), top + 0.16, vrr(-0.4, 0.4)));
        put('solid', new THREE.IcosahedronGeometry(0.38, 1), 0x5cb846, L(M, -1.1, top + 0.3, -0.1, 0, 0, 0, 1.2, 0.9, 1));
        for (const px of [0.6, 1.1]) { put('solid', new THREE.IcosahedronGeometry(0.24, 1).scale(1, 1.4, 1), 0xe8a838, L(M, px, top + 0.3, -0.15)); put('solid', new THREE.ConeGeometry(0.16, 0.4, 5), 0x4caa44, L(M, px, top + 0.8, -0.15)); }
        for (let k = 0; k < 3; k++) put('solid', new THREE.CylinderGeometry(0.06, 0.06, 0.5, 5).rotateZ(Math.PI / 2 + 0.3), 0xffe066, L(M, -0.3 + k * 0.1, 2.0, 0.6 + k * 0.05, 0.8, 0, 0)); // hanging bananas
      } else if (kind === 'fish') {
        box(M, 2.8, 0.18, 0.9, 0, top + 0.09, 0, 0x3ab0e8);
        for (let k = 0; k < 6; k++) put('solid', new THREE.OctahedronGeometry(0.5, 0).scale(0.75, 0.2, 0.28), vpick([0xb8c8d8, 0x6ab6e8, 0xff9ab0, 0xffb03a]), L(M, -1.1 + k * 0.44, top + 0.24, vrr(-0.2, 0.2), 0, vrr(-0.4, 0.4), 0));
        put('solid', new THREE.OctahedronGeometry(0.5, 0).scale(0.3, 0.9, 0.12), 0x6ab6e8, L(M, 1.1, 1.85, 0.6));
        put('solid', new THREE.OctahedronGeometry(0.5, 0).scale(0.3, 0.8, 0.12), 0xff9ab0, L(M, -1.1, 1.9, 0.6));
      } else if (kind === 'trinkets') {
        box(M, 1.0, 0.35, 0.6, -0.9, top + 0.18, 0, 0xa0683c);
        put('glow', lumpify(new THREE.IcosahedronGeometry(1, 1), 0.15, 3, 4).scale(0.42, 0.18, 0.26).translate(-0.9, top + 0.38, 0), 0xffd24a, M);
        for (let k = 0; k < 9; k++) put('glow', new THREE.OctahedronGeometry(vrr(0.1, 0.16), 0), vpick([0xff5a8a, 0x5ae0ff, 0x8aff7a, 0xc77dff, 0xffd24a]), L(M, vrr(-0.2, 1.4), top + 0.14, vrr(-0.4, 0.4)));
        for (let k = 0; k < 6; k++) put('glow', new THREE.CylinderGeometry(0.13, 0.13, 0.04, 8), 0xffd24a, L(M, vrr(0, 1.4), top + 0.03, vrr(-0.4, 0.4)));
        put('glow', new THREE.TorusGeometry(0.35, 0.03, 4, 12), 0xfff4e2, L(M, 0.6, 1.9, 0.62)); // a pearl necklace hanging
      } else { // hats
        for (let k = 0; k < 3; k++) {
          const hx = -1.0 + k, col = [0x231d36, 0xe8473c, 0x3a5ae0][k];
          cyl(M, 0.05, 0.05, 0.35, hx, top, 0, 0x6a4a2a, 4); put('solid', new THREE.SphereGeometry(0.2, 7, 5), 0xf0d8b8, L(M, hx, top + 0.5, 0));
          put('solid', new THREE.CylinderGeometry(0.5, 0.5, 0.08, 3).rotateY(Math.PI), col, L(M, hx, top + 0.62, 0));
          put('solid', new THREE.CylinderGeometry(0.2, 0.26, 0.3, 8), col, L(M, hx, top + 0.78, 0));
          put('glow', new THREE.CylinderGeometry(0.5, 0.5, 0.03, 3).rotateY(Math.PI), 0xffd24a, L(M, hx, top + 0.67, 0));
          put('cloth', new THREE.ConeGeometry(0.06, 0.6, 4), vpick([0xff8ad0, 0xffffff, 0x5cc24c]), L(M, hx + 0.15, top + 1.05, -0.05, 0, 0, -0.5));
        }
      }
      cols.push({ ...xz(W(M, 0, 0, 0)), hw: 1.7, hd: 0.65, yaw, top: y + 3.2 });
      VIL.stalls.push({ M, yaw, kind });
      avoid.push([x, z, 4]);
    };
    const my = Math.PI / 2;
    stall(MARKET.x - 5.6, MARKET.z - 4, my, 0xff8a2a, 'fruit');
    stall(MARKET.x - 5.6, MARKET.z + 4.5, my, 0x3ab0e8, 'fish');
    stall(MARKET.x + 5.6, MARKET.z - 4, -my, 0xc77dff, 'trinkets');
    stall(MARKET.x + 5.6, MARKET.z + 4.5, -my, 0xe8473c, 'hats');
    for (const z of [-4, 4.5]) bunting(v3(MARKET.x - 4.9, MARKET.y + 3.4, MARKET.z + z - 1.6), v3(MARKET.x + 4.9, MARKET.y + 3.4, MARKET.z + z + 1.6), 0.5);
    put('solid', new THREE.CylinderGeometry(0.15, 0.2, 7, 6).translate(0, 3.5, 0), 0x9a6a3e, mat(MARKET.x, MARKET.y, MARKET.z - 7.6));
    flag(v3(MARKET.x, MARKET.y + 6.5, MARKET.z - 7.6), 0.3, 2.6, 1.6);
    cols.push({ x: MARKET.x, z: MARKET.z - 7.6, r: 0.35, top: MARKET.y + 7 });
    avoid.push([MARKET.x, MARKET.z, 11]);

    // the juice bar: a stripy counter under a straw roof, a shelf of glowing juices, three stools in front
    {
      const x = BAR.x, z = BAR.z, yaw = Math.PI / 2, y = gnd(x, z), M = mat(x, y, z, 0, yaw, 0);
      box(M, 5.2, 1.1, 1.0, 0, 0.55, 0, 0xffb84a);
      for (let k = 0; k < 7; k++) box(M, 0.36, 1.1, 0.04, -2.2 + k * 0.73, 0.55, 0.51, [0xff6a8a, 0x5ad0c8, 0xfff4e2][k % 3]);
      box(M, 5.7, 0.14, 1.35, 0, 1.17, 0, 0xb88a58);
      box(M, 5.0, 0.12, 0.5, 0, 1.0, -2.4, 0x9a6a3e); box(M, 5.0, 0.12, 0.5, 0, 1.8, -2.4, 0x9a6a3e); box(M, 5.0, 2.4, 0.1, 0, 1.2, -2.7, 0xa8703f);
      for (let k = 0; k < 14; k++) put('glow', new THREE.CylinderGeometry(0.12, 0.1, 0.42, 6).translate(0, 0.21, 0), vpick([0xff8a2a, 0xff5a8a, 0x8aff7a, 0xffe14a, 0xc77dff]), L(M, -2.2 + (k % 7) * 0.72, k < 7 ? 1.06 : 1.86, -2.4));
      for (const [cx, col] of [[-1.7, 0xff8a2a], [0, 0xff5a8a], [1.7, 0x8aff7a]]) { // coconut cups with straws, one for each stool
        put('solid', new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), 0x8a5a30, L(M, cx, 1.42, 0.25));
        put('glow', new THREE.CircleGeometry(0.19, 8).rotateX(-Math.PI / 2), col, L(M, cx, 1.55, 0.25));
        put('solid', new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4).rotateZ(0.3), 0xffffff, L(M, cx + 0.05, 1.75, 0.25));
      }
      for (const [px, pz] of [[-2.75, 0.8], [2.75, 0.8], [-2.75, -2.75], [2.75, -2.75]]) cyl(M, 0.13, 0.13, 3.3, px, 0, pz, 0x8a6238, 6);
      put('solid', new THREE.ConeGeometry(4.3, 1.9, 9).translate(0, 4.15, -1.0), 0xe8c66a, L(M, 0, 0, 0, 0, 0, 0, 1, 1, 0.82));
      for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; put('cloth', new THREE.ConeGeometry(0.3, 0.6, 3).rotateX(Math.PI).translate(Math.cos(a) * 4.05, 3.0, -1.0 + Math.sin(a) * 3.3), k % 2 ? 0xd8b058 : 0xf0d27a, M); }
      put('solid', new THREE.IcosahedronGeometry(0.75, 1), 0xff8a2a, L(M, -0.9, 5.3, -1.0)); put('solid', new THREE.ConeGeometry(0.25, 0.4, 5), 0x4caa44, L(M, -0.9, 6.1, -1.0));
      put('solid', new THREE.IcosahedronGeometry(0.6, 1).scale(1, 1.4, 1), 0xe8a838, L(M, 0.9, 5.4, -1.0));
      for (let k = 0; k < 4; k++) put('solid', frondGeo(0.9, 0.3, 0.3, 2, false), 0x4caa44, L(M, 0.9, 6.1, -1.0, 0, k * 1.57, 0));
      for (const sx of [-1.7, 0, 1.7]) { cyl(M, 0.07, 0.07, 0.72, sx, 0, 1.45, 0x6a4a2a, 5); put('solid', new THREE.CylinderGeometry(0.34, 0.34, 0.14, 10).translate(0, 0.79, 0), [0xff6a8a, 0x5ad0c8, 0xffd23a][Math.round(sx / 1.7) + 1], L(M, sx, 0, 1.45)); }
      cols.push({ ...xz(W(M, 0, 0, 0)), hw: 2.85, hd: 0.68, yaw, top: y + 4 }, { ...xz(W(M, 0, 0, -2.5)), hw: 2.6, hd: 0.3, yaw, top: y + 4 });
      VIL.bar = { M, yaw };
      avoid.push([x, z, 7]);
    }

    // the washing line, between shacks B and C
    {
      const a = v3(C.x + 123.2, 0, C.z + 18), b = v3(C.x + 123.2, 0, C.z + 27);
      a.y = gnd(a.x, a.z); b.y = gnd(b.x, b.z);
      for (const p of [a, b]) { put('solid', new THREE.CylinderGeometry(0.1, 0.13, 2.8, 6).translate(0, 1.4, 0), 0x8a6238, mat(p.x, p.y, p.z)); cols.push({ x: p.x, z: p.z, r: 0.25, top: p.y + 2.8 }); }
      const yaw = Math.atan2(-(b.z - a.z), b.x - a.x), n = 8;
      const ropeAt = (t) => v3(lerp(a.x, b.x, t), lerp(a.y, b.y, t) + 2.65 - Math.sin(t * Math.PI) * 0.35, lerp(a.z, b.z, t));
      for (let k = 0; k < n; k++) put('solid', tube(ropeAt(k / n), ropeAt((k + 1) / n), 0.025, 0.025, 3), 0xfff4e2);
      const CL = [0xff6a8a, 0x5ad0c8, 0xffd23a, 0xffffff, 0x8a5ae0, 0xe8473c];
      for (let k = 0; k < 6; k++) {
        const t = 0.12 + k * 0.152, p = ropeAt(t), c = CL[k];
        if (k % 3 === 0) { put('cloth', new THREE.PlaneGeometry(1.0, 0.8).translate(0, -0.45, 0), c, mat(p.x, p.y, p.z, 0, yaw, 0)); for (const s of [-1, 1]) put('cloth', new THREE.PlaneGeometry(0.3, 0.45).translate(s * 0.6, -0.25, 0), c, mat(p.x, p.y, p.z, 0, yaw, 0)); }
        else if (k % 3 === 1) { for (const s of [-1, 1]) put('cloth', new THREE.PlaneGeometry(0.35, 0.95).translate(s * 0.22, -0.5, 0), c, mat(p.x, p.y, p.z, 0, yaw, 0)); put('cloth', new THREE.PlaneGeometry(0.8, 0.25).translate(0, -0.12, 0), c, mat(p.x, p.y, p.z, 0, yaw, 0)); }
        else for (const s of [-0.18, 0.18]) put('cloth', new THREE.PlaneGeometry(0.16, 0.6).translate(s, -0.3, 0), k === 2 ? 0xffd23a : 0xe8473c, mat(p.x, p.y, p.z, 0, yaw, 0));
      }
      const bk = v3(a.x + 1.0, 0, a.z + 0.6); bk.y = gnd(bk.x, bk.z); // the laundry basket
      put('solid', new THREE.CylinderGeometry(0.5, 0.4, 0.5, 10, 1, true).translate(0, 0.25, 0), 0xd8b070, mat(bk.x, bk.y, bk.z));
      put('cloth', new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1).translate(0, 0.42, 0), 0xffffff, mat(bk.x, bk.y, bk.z));
      VIL.wash = { a, b, basket: bk };
      avoid.push([a.x, (a.z + b.z) / 2, 6]);
    }

    // the shipyard: a little boat half built on a cradle, ribs still showing, planks and a saw horse
    {
      const x = C.x + 139, z = C.z + 29, yaw = Math.PI / 2, y = gnd(x, z), M = mat(x, y, z, 0, yaw, 0);
      const hy = 1.75;
      put('cloth', new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, Math.PI * 0.57, Math.PI * 0.43), 0xd88a4a, L(M, 0, hy, 0, 0, 0, 0, 1.7, 1.25, 3.7));
      for (let k = 0; k < 7; k++) {
        const lz = -2.7 + k * 0.9, f = Math.sqrt(Math.max(0.05, 1 - (lz / 3.7) ** 2));
        put('solid', new THREE.TorusGeometry(1.7 * f, 0.07, 4, 10, Math.PI).rotateZ(Math.PI), 0xb07a48, L(M, 0, hy, lz, 0, 0, 0, 1, 1.25 / 1.7, 1));
      }
      put('solid', new THREE.BoxGeometry(0.22, 0.25, 7.6).translate(0, hy - 1.25, 0), 0x8a5a32, M);
      put('solid', tube(v3(0, hy - 1.2, 3.6), v3(0, hy + 0.6, 4.1), 0.14, 0.1, 5), 0x8a5a32, M); // stem post
      for (const s of [-1, 1]) put('solid', new THREE.BoxGeometry(0.12, 0.12, 7.0).translate(s * 1.6, hy - 0.35, 0), 0xffd23a, M);
      for (const lz of [-2.4, 0, 2.4]) { const p = W(M, 0, 0, lz), gy = gnd(p.x, p.z); put('solid', new THREE.BoxGeometry(2.0, hy - 1.1 - (gy - y) + 0.4, 0.5).translate(0, (hy - 1.1 + (gy - y) - 0.4) / 2, lz), 0x8a6238, M); }
      for (const s of [-1, 1]) { const p0 = W(M, s * 0.8, 0, 3.6), p1 = W(M, s * 0.8, 0, 11); p0.y = gnd(p0.x, p0.z) + 0.1; p1.y = Math.max(gnd(p1.x, p1.z), SY - 0.6) + 0.1; put('solid', boxBetween(p0, p1, 0.3, 0.15), 0xa77a4a); }
      for (let k = 0; k < 5; k++) put('solid', new THREE.BoxGeometry(0.5, 0.14, 3.6).translate(0, 0.07 + k * 0.15, 0), k % 2 ? 0xc89a5c : 0xb88a58, L(M, -2.4, 0, -4.6 + k * 0.02, 0, 1.4 + k * 0.05, 0));
      for (const lz of [-1.0, 1.0]) for (const s of [-1, 1]) put('solid', new THREE.BoxGeometry(0.1, 1.0, 0.1).translate(0, 0.45, 0), 0x8a6238, L(M, -3.3 + s * 0.3, 0, -1.6 + lz * 0.6, 0, 0, s * 0.3));
      put('solid', new THREE.BoxGeometry(0.15, 0.12, 1.8).translate(-3.3, 0.9, -1.6), 0x8a6238, M);
      put('solid', new THREE.BoxGeometry(0.3, 0.08, 2.4).translate(-3.3, 1.0, -1.6), 0xd8b070, M);
      put('solid', new THREE.CylinderGeometry(0.16, 0.2, 6.5, 6).rotateX(Math.PI / 2).translate(2.8, 0.2, -0.5), 0x9a6a3e, M); // the mast, waiting
      cyl(M, 0.3, 0.26, 0.45, -1.4, 0, -4.6, 0xffffff, 8); put('solid', new THREE.CircleGeometry(0.27, 8).rotateX(-Math.PI / 2), 0xffd23a, L(M, -1.4, 0.46, -4.6)); // paint pot
      put('solid', new THREE.CylinderGeometry(0.15, 0.2, 6, 6).translate(0, 3, 0), 0x9a6a3e, L(M, -3.2, 0, -4.2));
      flag(W(M, -3.2, 5.6, -4.2), yaw + 0.2, 2.4, 1.5);
      cols.push({ ...xz(W(M, 0, 0, 0.2)), hw: 1.9, hd: 4.1, yaw, top: y + 3 }, { ...xz(W(M, -3.2, 0, -4.2)), r: 0.3, top: y + 6 },
        { ...xz(W(M, -2.4, 0, -4.6)), hw: 0.6, hd: 1.9, yaw: yaw + 1.4, top: y + 0.8 });
      VIL.yard = { M, yaw };
      avoid.push([x, z, 8]);
    }

    // a rope swing near shack F, a sandcastle, a beach umbrella and a vegetable garden
    {
      const x = C.x + 128, z = C.z + 37, yaw = Math.PI / 2, y = gnd(x, z), M = mat(x, y, z, 0, yaw, 0);
      for (const s of [-1, 1]) for (const d of [-1, 1]) put('solid', boxBetween(v3(s * 1.6, 3.2, 0), v3(s * 1.9, -0.2, d * 1.1), 0.16, 0.16), 0x8a6238, M);
      put('solid', new THREE.CylinderGeometry(0.12, 0.12, 3.6, 6).rotateZ(Math.PI / 2).translate(0, 3.2, 0), 0x8a6238, M);
      for (const s of [-1, 1]) put('solid', new THREE.CylinderGeometry(0.025, 0.025, 2.45, 3).translate(s * 0.45, 1.97, 0), 0xfff4e2, M);
      put('solid', new THREE.BoxGeometry(1.1, 0.1, 0.4).translate(0, 0.72, 0), 0xe8473c, M);
      for (const s of [-1, 1]) cols.push({ ...xz(W(M, s * 1.8, 0, 0)), r: 0.35, top: y + 3.3 });
      VIL.swing = { M, yaw };
    }
    {
      const x = C.x + 138.5, z = C.z - 40, y = gnd(x, z), M = mat(x, y, z);
      cyl(M, 1.3, 1.1, 0.5, 0, -0.1, 0, 0xf2d48a, 10); cyl(M, 0.75, 0.65, 0.6, 0, 0.4, 0, 0xf2d48a, 8);
      for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.4; cyl(M, 0.3, 0.25, 0.75, Math.cos(a) * 1.05, 0.2, Math.sin(a) * 1.05, 0xf2d48a, 6); put('solid', new THREE.ConeGeometry(0.3, 0.4, 6).translate(0, 1.15, 0), 0xe8c070, L(M, Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05)); }
      put('solid', new THREE.ConeGeometry(0.6, 0.7, 7).translate(0, 1.35, 0), 0xe8c070, M);
      cyl(M, 0.02, 0.02, 0.8, 0, 1.6, 0, 0x6a4a2a, 3); put('cloth', tri, 0xe8473c, L(M, 0.22, 2.35, 0, 0, 0, Math.PI / 2));
      cyl(M, 0.25, 0.32, 0.4, 1.9, 0, 0.9, 0x3ab0e8, 8); cyl(M, 0.2, 0.26, 0.35, -1.7, 0, -1.1, 0xff6a8a, 8); // buckets
      put('solid', boxBetween(v3(-1.5, 0.05, 1.4), v3(-2.3, 0.05, 2.1), 0.25, 0.05), 0xffd23a, M); // spade
      VIL.castle = v3(x, y, z);
      avoid.push([x, z, 4]);
    }
    {
      const x = C.x + 134.5, z = C.z - 52, y = gnd(x, z), M = mat(x, y, z, 0, 0.6, 0);
      put('solid', new THREE.BoxGeometry(1.2, 0.04, 2.4).translate(0, 0.03, 0), 0x3ab0e8, M);
      for (let k = 0; k < 4; k++) put('solid', new THREE.BoxGeometry(1.21, 0.05, 0.25).translate(0, 0.04, -0.9 + k * 0.6), 0xfff4e2, M);
      put('solid', new THREE.CylinderGeometry(0.05, 0.05, 2.8, 4).translate(0.9, 1.3, -0.6), 0xfff4e2, L(M, 0, 0, 0, 0, 0, -0.15));
      for (let k = 0; k < 8; k++) { const g = new THREE.ConeGeometry(1.7, 0.7, 8, 1, true, k * Math.PI / 4, Math.PI / 4).translate(0, 2.7, 0); put('cloth', g, k % 2 ? 0xfff4e2 : 0xff6a8a, L(M, 1.3, 0, -0.6, 0, 0, -0.15)); }
      VIL.towel = { M, yaw: 0.6 };
      avoid.push([x, z, 4]);
    }
    {
      const x = C.x + 131, z = C.z - 38, yaw = 0.25, y = gnd(x, z), M = mat(x, y, z, 0, yaw, 0);
      box(M, 3.2, 0.3, 1.4, 0, 0.15, 0, 0x7a5232);
      for (const s of [-1, 1]) box(M, 3.3, 0.35, 0.1, 0, 0.17, s * 0.72, 0xb88a58);
      for (let k = 0; k < 5; k++) { put('solid', new THREE.ConeGeometry(0.1, 0.4, 5).rotateX(Math.PI).translate(0, 0.35, 0), 0xff8a2a, L(M, -1.3 + k * 0.6, 0, -0.3)); put('solid', fernGeo().scale(0.25, 0.25, 0.25), 0xffffff, L(M, -1.3 + k * 0.6, 0.3, -0.3)); }
      for (let k = 0; k < 4; k++) { put('cloth', bloomGeo(), vpick([0xff5a8a, 0xffd23a, 0xc77dff]), L(M, -1.1 + k * 0.7, 0.2, 0.35, 0, k, 0, 0.6)); put('cloth', stemGeo(), 0xffffff, L(M, -1.1 + k * 0.7, 0.2, 0.35, 0, k, 0, 0.6)); }
      put('solid', new THREE.CylinderGeometry(0.25, 0.18, 0.35, 8, 1, true).translate(0, 0.17, 0), 0x3ab0e8, L(M, 2.1, 0, 0.6)); // watering can
      put('solid', tube(v3(2.3, 0.25, 0.6), v3(2.7, 0.45, 0.6), 0.04, 0.03, 4), 0x3ab0e8, M);
      cols.push({ ...xz(W(M, 0, 0, 0)), hw: 1.7, hd: 0.75, yaw, top: y + 0.6 });
      VIL.garden = { M, yaw };
      avoid.push([x, z, 4]);
    }
    // a hammock at the camp, between two posts
    {
      const a = v3(CAMP.x - 6.5, CAMP.y, CAMP.z - 7.5), b = v3(CAMP.x - 2, CAMP.y, CAMP.z - 11.5);
      for (const p of [a, b]) { put('solid', new THREE.CylinderGeometry(0.14, 0.17, 2.4, 6).translate(0, 1.2, 0), 0x8a6238, mat(p.x, p.y, p.z)); cols.push({ x: p.x, z: p.z, r: 0.3, top: p.y + 2.4 }); }
      const len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
      const g = new THREE.PlaneGeometry(len - 0.6, 1.1, 8, 2).rotateX(-Math.PI / 2), p = g.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (len - 0.6) + 0.5, w = p.getZ(i); p.setY(i, 2.1 - Math.sin(u * Math.PI) * 1.1 + w * w * 0.6); const c = K(Math.floor(u * 8) % 2 ? 0xffd23a : 0x3ab0e8); col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
      put('cloth', g, 0xffffff, mat((a.x + b.x) / 2, CAMP.y, (a.z + b.z) / 2, 0, yaw, 0));
      for (const [p, s] of [[a, 1], [b, -1]]) put('solid', tube(v3(p.x, p.y + 2.2, p.z), v3(p.x + (b.x - a.x) / len * 0.3 * s, p.y + 2.1, p.z + (b.z - a.z) / len * 0.3 * s), 0.03, 0.03, 3), 0xfff4e2);
      VIL.hammock = { p: v3((a.x + b.x) / 2, CAMP.y, (a.z + b.z) / 2), yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    // a map table in the grotto, a stool and a gem basket for the juggler
    {
      const M = L(SKM, -19, HALL_FLOOR, -7, 0, 0.6, 0);
      crate(M, 1.0);
      put('solid', new THREE.PlaneGeometry(0.9, 0.7).rotateX(-Math.PI / 2).translate(0, 1.02, 0), 0xf2e2b8, L(M, 0, 0, 0, 0, 0.3, 0));
      put('solid', new THREE.BoxGeometry(0.08, 0.12, 0.08).translate(0.2, 1.06, 0.1), 0xd8342c, M);
      put('glow', new THREE.CylinderGeometry(0.12, 0.14, 0.3, 6).translate(-0.3, 1.15, -0.2), 0xffd27a, M);
      VIL.mapTable = W(M, 0, 0, 0);
      const J = L(SKM, 5, HALL_FLOOR, 1);
      put('solid', new THREE.CylinderGeometry(0.4, 0.32, 0.4, 10, 1, true).translate(0, 0.2, 0), 0xd8b070, J);
      for (let k = 0; k < 5; k++) put('glow', new THREE.OctahedronGeometry(0.13, 0), [0xff5a8a, 0x5ae0ff, 0x8aff7a, 0xc77dff, 0xffd24a][k], L(J, vrr(-0.2, 0.2), 0.42, vrr(-0.2, 0.2)));
    }
  }

  // ---- story spots (x,z first, so plants keep clear of them) ----
  const beachAt = (th, t = 0.9) => { const r = coastR(th) * t; return v3(C.x + Math.cos(th) * r, 0, C.z + Math.sin(th) * r); };
  const npcXZ = {
    captain: W(shipM, 0, 0, -3.6), kitty: W(shipM, 0, 0, 10.5),
    coco: beachAt(1.15, 0.88), gully: v3(dockX1 - 3, 0, DZ + 8.5), pelly: pellyRock.clone(),
    billy: skullWorld(LEDGE.billy.u + LEDGE.billy.du * 2, 0, LEDGE.billy.w + LEDGE.billy.dw * 2),
    batty: G(0, -10), boo: G(-6, -17), shelldon: v3(C.x + 78, 0, C.z - 29),
    zip: v3(C.x - 82, 0, C.z + 12), piggy: v3(MUD.x + 8.5, 0, MUD.z + 1), leo: leoRock.clone(),
    snappy: v3(LAGOON.x - 19.5, 0, LAGOON.z - 2),
  };
  for (const p of Object.values(npcXZ)) avoid.push([p.x, p.z, 4]);

  // ---- jungle, palms and beach plants ----
  const vegM = (key, opts) => selfLit(tileAs(withSway(paintMat({ vertexColors: true, ...opts }), { key, ...SWAY[key] }), 'kelp'), 0.15);
  const SWAY = { palm: { amp: 0.35, freq: 1.1, heightScale: 0.08 }, tree: { amp: 0.12, freq: 0.8, heightScale: 0.08 }, fern: { amp: 0.25, freq: 1.6, heightScale: 0.6 }, bush: { amp: 0.06, freq: 1.2, heightScale: 0.5 }, bloom: { amp: 0.15, freq: 1.4, heightScale: 0.7 }, grs: { amp: 0.3, freq: 1.8, heightScale: 0.8 } };
  const info = (x, z) => {
    const dx = x - C.x, dz = z - C.z, r = Math.hypot(dx, dz), th = Math.atan2(dz, dx);
    riverInfo(x, z);
    const dS = Math.hypot(x - SK.x, z - SK.z);
    toLocal(x, z);
    const court = dS < 66 || (_lw > 20 && Math.abs(_lu) < 50 + (_lw - 20) * 0.4 && dS < 125); // the skull and the open ground before its face
    return { t: r / coastR(th), th, h: height(x, z), dS, river: _rd, path: pathDist(x, z), court, free: dS > 60 && !avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar) };
  };
  const scatter = (n, test, tries = 40) => {
    const out = [];
    for (let g = 0; out.length < n && g < n * tries; g++) {
      const x = C.x + rr(-175, 175), z = C.z + rr(-175, 175), I = info(x, z);
      if (I.t < 1 && test(I, x, z)) out.push({ x, z, y: I.h, th: I.th, I });
    }
    return out;
  };
  const inForest = (I) => I.free && !I.court && I.t < 0.78 && I.river > 14 && I.path > 4.5;
  const trees = [];
  {
    const spread = (pts, gap) => pts.filter((p, i) => pts.slice(0, i).every((q) => Math.hypot(p.x - q.x, p.z - q.z) > gap));
    const tp = spread(scatter(150, (I) => inForest(I)), 7).slice(0, 105);
    const ta = [], tb = [];
    tp.forEach((p, i) => {
      const s = rr(0.85, 1.35), m = mat(p.x, p.y - 0.3, p.z, 0, rnd() * 6, 0, s), c = new THREE.Color().setHSL(rr(0.22, 0.32), 0.35, rr(0.75, 0.95));
      (i % 2 ? tb : ta).push({ m, c });
      trees.push({ x: p.x, z: p.z, y: p.y, s });
      if (i < 95) cols.push({ x: p.x, z: p.z, r: 0.9 * s, top: p.y + 7 * s });
    });
    group.add(instanced(treeGeo(11), vegM('tree'), ta), instanced(treeGeo(23), vegM('tree'), tb));
    // palms: along the beaches and the sandy edge of the jungle, leaning out to sea
    const pp = spread(scatter(140, (I) => I.free && !I.court && I.t > 0.72 && I.t < 0.93 && I.path > 3 && I.river > 9), 6).slice(0, 62);
    for (let k = 0; k < 3; k++) { const ang = k * 2.1 + 0.5, x = npcXZ.coco.x + Math.cos(ang) * 5.5, z = npcXZ.coco.z + Math.sin(ang) * 5.5; pp.unshift({ x, z, y: height(x, z), th: Math.atan2(z - C.z, x - C.x), I: info(x, z) }); } // Coco's palms
    group.add(instanced(palmGeo(), vegM('palm', { side: THREE.DoubleSide }), pp.map((p) => ({ m: mat(p.x, p.y - 0.2, p.z, 0, -p.th + rr(-0.5, 0.5), 0, rr(0.85, 1.25)), c: new THREE.Color().setHSL(rr(0.2, 0.3), 0.3, rr(0.8, 0.95)) }))));
    for (const p of pp.slice(0, 40)) cols.push({ x: p.x, z: p.z, r: 0.55, top: p.y + 9 });
    trees.palms = pp;
    // undergrowth
    const fp = scatter(200, (I) => I.free && I.t < 0.82 && I.dS > 60 && I.path > 2.5 && I.river > 7);
    group.add(instanced(fernGeo(), vegM('fern', { side: THREE.DoubleSide }), fp.map((p) => ({ m: mat(p.x, p.y - 0.1, p.z, 0, rnd() * 6, 0, rr(0.8, 1.6)), c: new THREE.Color().setHSL(rr(0.2, 0.33), 0.4, rr(0.75, 0.95)) }))));
    const bp = scatter(110, (I) => I.free && !I.court && I.t < 0.8 && I.dS > 62 && I.path > 3 && I.river > 9);
    group.add(instanced(bushGeo(false), vegM('bush'), bp.map((p) => ({ m: mat(p.x, p.y - 0.3, p.z, 0, rnd() * 6, 0, rr(0.8, 1.7)), c: new THREE.Color().setHSL(rr(0.2, 0.35), 0.4, rr(0.7, 0.95)) }))));
    const berry = spread(scatter(40, (I) => inForest(I) && I.path < 9), 10).slice(0, 12);
    group.add(instanced(bushGeo(true), vegM('bush'), berry.map((p) => ({ m: mat(p.x, p.y - 0.2, p.z, 0, rnd() * 6, 0, 1.2), c: 0xffffff }))));
    trees.berry = berry;
    const fl = scatter(130, (I) => I.free && I.t < 0.84 && I.dS > 62 && I.path > 2 && I.river > 8);
    const flM = fl.map((p) => mat(p.x, p.y - 0.1, p.z, 0, rnd() * 6, 0, rr(0.9, 1.5)));
    group.add(instanced(stemGeo(), vegM('bloom', { side: THREE.DoubleSide }), flM.map((m) => ({ m }))));
    group.add(instanced(bloomGeo(), vegM('bloom', { side: THREE.DoubleSide }), flM.map((m) => ({ m, c: pick([0xff5a8a, 0xff8ad0, 0xffb03a, 0xffe14a, 0xc77dff, 0xff6a4a, 0x6ae0ff]) }))));
    const gp = scatter(250, (I) => I.free && I.t > 0.45 && I.t < 0.86 && I.path > 1.5 && I.river > 6);
    group.add(instanced(grassGeo(), vegM('grs', { side: THREE.DoubleSide }), gp.map((p) => ({ m: mat(p.x, p.y - 0.1, p.z, 0, rnd() * 6, 0, rr(0.8, 1.5)), c: new THREE.Color().setHSL(rr(0.18, 0.3), 0.45, rr(0.75, 1)) }))));
    // rocks: big boulders in the jungle and round the skull courtyard, pebbles on the beach
    const rk = scatter(46, (I) => I.free && !I.court && I.path > 4 && I.river > 10 && (I.t < 0.8 || rnd() < 0.3));
    group.add(instanced(rockGeo(7), selfLit(tileAs(paintMat({ vertexColors: false, flat: true }), 'rock'), 0.15), rk.map((p, i) => {
      const s = i < 14 ? rr(2.2, 3.6) : rr(0.6, 1.6);
      if (i < 14) cols.push({ x: p.x, z: p.z, r: s * 0.9, top: p.y + s * 0.7 });
      return { m: mat(p.x, p.y, p.z, rnd(), rnd() * 6, 0, s, s * 0.7, s), c: pick([0xb0a690, 0x9a948c, 0xc2b49a]) };
    })));
  }

  // ---- merged props: one draw call per bucket ----
  const solidM = selfLit(paintMat({ vertexColors: true }), 0.15);
  const clothM = selfLit(paintMat({ vertexColors: true, side: THREE.DoubleSide }), 0.18);
  const glowM = selfLit(paintMat({ vertexColors: true, emissive: 0x404040 }), 0.55);
  for (const [k, m] of [['solid', solidM], ['cloth', clothM], ['glow', glowM]]) { const mesh = new THREE.Mesh(mergeParts(parts[k]), m); mesh.name = 'pirate_' + k; group.add(mesh); }

  // ---- surf: a foam ribbon lapping at the coastline ----
  let foamTex;
  {
    foamTex = canvasTexture(8, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let y = 0; y < h; y++) { const a = Math.pow(Math.max(0, Math.sin((y / h) * Math.PI * 3)), 6); g.fillStyle = `rgba(255,255,255,${(0.25 + 0.75 * a).toFixed(3)})`; g.fillRect(0, y, w, 1); }
    });
    foamTex.wrapS = foamTex.wrapT = THREE.RepeatWrapping;
    const n = 300, pos = [], uv = [], col = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2, R = coastR(th), c = Math.cos(th), s = Math.sin(th);
      for (const [r, v, a] of [[R - 3, 0, 0], [R - 0.5, 0.25, 0.9], [R + 6, 1, 0]]) { pos.push(C.x + c * r, SY + 0.15, C.z + s * r); uv.push(i / 6, v); col.push(1, 1, 1, a); }
      if (i) for (let k = 0; k < 2; k++) { const o = (i - 1) * 3 + k; idx.push(o, o + 1, o + 3, o + 1, o + 4, o + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ map: foamTex, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.85 });
    m.userData.noPaint = 'surf foam (transparent sprite-like ribbon)';
    const foam = new THREE.Mesh(g, m);
    foam.renderOrder = 2;
    foam.name = 'pirateFoam';
    group.add(foam);
  }

  // ---- public functions ----
  function floor(x, z, y) {
    const top = y + 0.5;
    let f = height(x, z);
    toLocal(x, z);
    if (_lu * _lu + (_lw + 4) * (_lw + 4) < 6400) { const s = traceDown(_lu, _lw, top); if (s > f && s <= top) f = s; }
    for (const d of decks) { const fy = d(x, z, top); if (fy > f && fy <= top) f = fy; }
    return f;
  }
  function limit(p, r = 1) {
    toLocal(p.x, p.z);
    let u = _lu, y = p.y, w = _lw;
    if (u * u + (w + 4) * (w + 4) > 8100 || y > 185) return false;
    for (let i = 0; i < 5; i++) {
      const d = skullSolid(u, y, w);
      if (d >= r) break;
      const g = grad(skullSolid, u, y, w, 0.25), m = r - d + 0.01;
      u += g[0] * m; y += g[1] * m; w += g[2] * m;
    }
    p.set(SK.x + SKC * u + SKS * w, y, SK.z - SKS * u + SKC * w);
    return hallSDF(u, y, w) < 0 || (mouthSDF(u, y, w) < 0 && w < 38);
  }
  const _dir = new THREE.Vector3();
  function camLimit(desired, target) {
    _dir.subVectors(desired, target);
    const len = _dir.length();
    if (len < 1e-4) return desired;
    toLocal(target.x, target.z); const tu = _lu, tw = _lw;
    toLocal(desired.x, desired.z);
    if (Math.min(tu * tu + (tw + 4) ** 2, _lu * _lu + (_lw + 4) ** 2) > 9500 && Math.hypot(tu - _lu, tw - _lw) < 20) return desired;
    _dir.divideScalar(len);
    let t = 0.4;
    while (t < len) {
      const px = target.x + _dir.x * t, py = target.y + _dir.y * t, pz = target.z + _dir.z * t;
      toLocal(px, pz);
      const d = skullSolid(_lu, py, _lw);
      if (d < 0.7) { desired.copy(target).addScaledVector(_dir, Math.max(0.3, t - 0.5)); return desired; }
      t += Math.max(d * 0.6, 0.2);
    }
    return desired;
  }

  // ---- spots ----
  const at = (p, up = 1.7, hint = 300) => v3(p.x, floor(p.x, p.z, hint) + up, p.z);
  const deckY = shipO.y + 2;
  const npc = {
    captain: at(npcXZ.captain, 1.7, deckY), kitty: at(npcXZ.kitty, 1.7, deckY + 1),
    coco: at(npcXZ.coco), gully: at(npcXZ.gully, 1.8, 64), pelly: at(npcXZ.pelly, 1.6, 64),
    billy: at(npcXZ.billy, 1.7, LEDGE.billy.top + 1), batty: G(0, -10, 99), boo: at(npcXZ.boo, 1.8, 85),
    shelldon: at(npcXZ.shelldon), zip: at(npcXZ.zip), piggy: at(npcXZ.piggy), leo: at(npcXZ.leo, 1.5, 63),
    snappy: v3(npcXZ.snappy.x, Math.max(height(npcXZ.snappy.x, npcXZ.snappy.z), LAGOON.y) + 1.6, npcXZ.snappy.z),
  };
  const clear = (x, z, r = 1.3) => cols.every((c) => (c.hw !== undefined ? Math.hypot(x - c.x, z - c.z) > Math.hypot(c.hw, c.hd) + r : Math.hypot(x - c.x, z - c.z) > c.r + r));
  const around = (x, z, d) => { for (let k = 0; k < 24; k++) { const a = k * 0.785 + Math.floor(k / 8) * 0.39, dd = d + Math.floor(k / 8) * 1.5, px = x + Math.cos(a) * dd, pz = z + Math.sin(a) * dd; if (clear(px, pz)) return v3(px, 0, pz); } return v3(x + d, 0, z); };
  const palmBase = (p) => at(around(p.x, p.z, 2), 1.5);
  const ledgeSpot = (l) => at(skullWorld(l.u + l.du * 1.5 - l.dw * 2, 0, l.w + l.dw * 1.5 + l.du * 2), 1.6, l.top + 1);
  const grottoAt = (u, w, up = 1.8) => at(G(u, w), up, 86);
  const toCentre = ([u, w], k) => { const d = Math.hypot(u, w + 5); return [u - (u / d) * k, w - ((w + 5) / d) * k]; };
  const forestPts = scatter(40, (I, x, z) => inForest(I) && trees.every((t) => Math.hypot(x - t.x, z - t.z) > 3) && clear(x, z, 1.2)).slice(0, 12);
  const items = {
    mapPieces: [at(W(shipM, -2.5, 0, 5), 1.7, deckY), at(v3((dockX0 + dockXC) / 2 + 4, 0, DZ), 1.7, 64), at(v3(C.x + 10, 0, C.z - 26)), at(beachAt(Math.PI, 0.92))],
    xMark: at(XSPOT, 1.6),
    coconuts: trees.palms.slice(0, 2).concat(trees.palms.slice(3).filter((p) => p.I.t > 0.8).filter((p, i, a) => a.slice(0, i).every((q) => Math.hypot(p.x - q.x, p.z - q.z) > 40) && Math.hypot(p.x - npcXZ.coco.x, p.z - npcXZ.coco.z) > 40).slice(0, 3)).map(palmBase),
    fish: [v3(dockXC + 6, 61, DZ + 4.4), v3(dockXC + 18, 61, DZ - 4.4), v3(dockXC + 30, 61, DZ + 4.4)],
    flowers: [ledgeSpot(LEDGE.f1), ledgeSpot(LEDGE.f2), ledgeSpot(LEDGE.f3)],
    skullTop: v3(topP.x, topY + 0.85 + 1.8, topP.z),
    crystals: CRYSTALS.map((c) => grottoAt(...toCentre(c, 3.5))),
    grottoPool: grottoAt(POOL[0], POOL[1], 2),
    lanterns: LANTERNS.map((c) => grottoAt(...toCentre(c, 1.6))),
    berries: trees.berry.slice(0, 4).map((p) => at(around(p.x, p.z, 2.2), 1.5)),
    truffles: trees.slice(3, 6).map((t) => at(around(t.x, t.z, 1.2 * t.s + 1.6), 1.5)),
    balls: [1.5, 1.66, 1.82, 1.98].map((th) => at(beachAt(th, 0.9), 1.6)),
    sandbar: at(v3((SANDBAR[1][0] + SANDBAR[2][0]) / 2, 0, (SANDBAR[1][1] + SANDBAR[2][1]) / 2), 1.6, 70),
    buttons: [at(W(shipM, -9, 0, -3), 1.5), at(W(shipM, -7.5, 0, 11), 1.5), at(v3(CAMP.x - 2.5, 0, CAMP.z + 4.5), 1.5)],
  };
  const near = (th, c, w) => Math.abs(Math.atan2(Math.sin(th - c), Math.cos(th - c))) < w;
  const skipTh = (th) => near(th, -0.1, 0.12) || near(th, shipTh, 0.16) || near(th, -Math.PI / 2 + 0.15, 0.45); // dock, ship, behind the skull
  const settle = (p, up = 1.6) => { for (let i = 0; i < 4; i++) { limit(p, 1.4); p.y = Math.max(p.y, floor(p.x, p.z, p.y + 1) + up); } return p; }; // slide off skull slopes
  const beachTh = []; for (let k = 0; beachTh.length < 12; k++) { const th = -2.9 + k * 0.43; if (!skipTh(th)) beachTh.push(th); }
  const wild = {
    beach: beachTh.map((th) => at(beachAt(th, 0.9), 1.6)),
    forest: forestPts.map((p) => at(p, 1.6)),
    cliffs: [LEDGE.f1, LEDGE.f2, LEDGE.f3, LEDGE.cliff].map((l) => settle(at(skullWorld(l.u + l.du * 1.5 + l.dw * 2.2, 0, l.w + l.dw * 1.5 - l.du * 2.2), 1.6, l.top + 1)))
      .concat([[-36, -24], [36, -28]].map(([u, w]) => settle(at(skullWorld(u, 0, w), 1.6, 200)))),
    grotto: [[-14, 8], [10, 4], [0, -21], [17, -15]].map(([u, w]) => grottoAt(u, w, 1.6)),
    river: [0.3, 0.55, 0.8].map((s) => {
      let k = 0; while (k < RIVER.length - 2 && RIV_ACC[k + 1] / RIV_LEN < s) k++;
      const t = (s * RIV_LEN - RIV_ACC[k]) / (RIV_ACC[k + 1] - RIV_ACC[k]), x = lerp(RIVER[k][0], RIVER[k + 1][0], t), z = lerp(RIVER[k][1], RIVER[k + 1][1], t);
      const ex = RIVER[k + 1][0] - RIVER[k][0], ez = RIVER[k + 1][1] - RIVER[k][1], el = Math.hypot(ex, ez), side = s > 0.5 ? 1 : -1;
      let d = 4; while (d < 14 && height(x - ez / el * d * side, z + ex / el * d * side) < riverLevel(s) + 0.4) d += 0.5; // walk out to the bank
      return at(v3(x - ez / el * (d + 1) * side, 0, z + ex / el * (d + 1) * side), 1.6);
    }),
  };
  // ---- life: where the islanders are and what they do. p = feet on the floor, yaw 0 faces +z (atan2(dx, dz));
  // seat = how high they sit above p (stools, logs, a hammock); path = where walkers and carriers go back and forth.
  const life = [];
  const onF = (x, z, hint = 300) => v3(x, floor(x, z, hint), z);
  const lw = (M, lx, lz, up = 1) => { const q = W(M, lx, 0, lz); return onF(q.x, q.z, q.y + up); };
  const face = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
  const add = (activity, type, p, yaw, extra) => life.push({ p, yaw, activity, type, ...extra });
  const walk = (activity, type, pts, extra) => { const path = pts.map((q) => (q.isVector3 ? q : onF(q[0], q[1], q[2]))); add(activity, type, path[0].clone(), face(path[0], path[1]), { path, ...extra }); };
  {
    const PI = Math.PI;
    // the market: a keeper behind every stall, customers in front, a juggler in the square
    const keeper = { fruit: 'pirateCook', fish: 'pirateCaptain', trinkets: 'monkeySailor', hats: 'pirateKid' };
    for (const s of VIL.stalls) add('shop', keeper[s.kind], lw(s.M, 0, -1.6), s.yaw, { stall: s.kind });
    const [sFruit, , , sHats] = VIL.stalls;
    add('chat', 'pirateKid', lw(sFruit.M, 0.5, 2.0), sFruit.yaw + PI);
    add('chat', 'elf', lw(sHats.M, -0.4, 2.0), sHats.yaw + PI);
    add('juggle', 'monkeySailor', onF(MARKET.x + 2, MARKET.z + 0.3), -PI / 2);
    add('dance', 'pirateKid', onF(MARKET.x - 1.4, MARKET.z + 0.5), PI / 2);
    // the juice bar: the keeper behind the counter, three customers on the stools
    const bar = VIL.bar;
    add('shop', 'pirateCook', lw(bar.M, 0, -1.3), bar.yaw, { stall: 'juice' });
    [['pirateKid', -1.7], ['pirateCaptain', 0], ['gnome', 1.7]].forEach(([type, sx]) => add('sit', type, lw(bar.M, sx, 1.45), bar.yaw + PI, { seat: 0.8 }));
    // the shacks: porch life, a painter, a garden, a swing, the washing line, neighbours chatting
    const { A, B, C: Cs, D, E, F } = VIL;
    add('sweep', 'pirateCook', lw(A.M, -1.2, 2.9), A.yaw + PI / 2);
    add('wave', 'pirateKid', lw(B.M, 0.9, 3.4), B.yaw);
    add('read', 'pirateCaptain', lw(Cs.M, 1.4, 2.7), Cs.yaw);
    add('paint', 'pirateKid', lw(D.M, 3.4, -0.4, -0.2), D.yaw - PI / 2);
    add('sit', 'elf', lw(E.M, 1.0, 3.7), E.yaw, { seat: 0 });
    add('sit', 'pirateCaptain', lw(F.M, -1.0, 3.7), F.yaw, { seat: 0 });
    add('swing', 'pirateKid', lw(VIL.swing.M, 0, 0), VIL.swing.yaw, { seat: 0.72 });
    add('garden', 'gnome', lw(VIL.garden.M, 0.3, 1.45), VIL.garden.yaw + PI);
    { const { a, b } = VIL.wash; walk('carry', 'pirateCook', [[a.x + 1.2, a.z + 0.6], [a.x + 1.2, (a.z + b.z) / 2], [b.x + 1.2, b.z - 0.6]], { item: 'laundry' }); }
    { const p = onF(C.x + 125.5, C.z - 12.5), q = onF(C.x + 127, C.z - 11.2); add('chat', 'pirateCook', p, face(p, q)); add('chat', 'pirateKid', q, face(q, p)); }
    // the shipyard
    const Y = VIL.yard;
    add('build', 'pirateCaptain', lw(Y.M, 2.9, 0.8), Y.yaw - PI / 2);
    add('build', 'monkeySailor', lw(Y.M, -2.6, 1.6), Y.yaw + PI / 2);
    add('paint', 'pirateKid', lw(Y.M, 0.6, -4.7), Y.yaw);
    walk('carry', 'pirateKid', [W(Y.M, -4.6, 0, -3.0), W(Y.M, -4.6, 0, 0.6), W(Y.M, -2.6, 0, -0.3)].map((q) => onF(q.x, q.z)), { item: 'plank' });
    // the dock: fishers sitting on the edge, legs over the water
    add('fish', 'pirateKid', onF(dockX0 + 16.8, DZ + 2.3, DOCK_Y + 1), 0, { seat: 0 });
    add('fish', 'monkeySailor', onF(dockX0 + 30, DZ + 2.3, DOCK_Y + 1), 0, { seat: 0 });
    add('fish', 'pirateCaptain', onF(dockX0 + 26, DZ - 2.3, DOCK_Y + 1), PI, { seat: 0 });
    // the beach north of the dock: a ball game, a sandcastle, a nap in the sun, a stroll
    { const p = onF(C.x + 130, C.z - 27), q = onF(C.x + 135, C.z - 23.5); add('play', 'pirateKid', p, face(p, q), { partner: life.length + 1 }); add('play', 'pirateKid', q, face(q, p), { partner: life.length - 1 }); }
    { const c = VIL.castle, p = onF(c.x - 2.1, c.z - 1.2), q = onF(c.x + 1.9, c.z + 1.4); add('dig', 'pirateKid', p, face(p, c)); add('dig', 'mole', q, face(q, c)); }
    add('sleep', 'elf', lw(VIL.towel.M, 0, 0), VIL.towel.yaw);
    walk('walk', 'pirateCaptain', [[C.x + 142, C.z - 32], [C.x + 140, C.z - 24], [C.x + 137, C.z - 19]]);
    // walkers: through the village, and from the dock up to the camp
    walk('walk', 'pirateKid', [[C.x + 135.5, C.z - 10], [C.x + 139, C.z - 1], [C.x + 141.5, C.z + 8], [C.x + 141.5, C.z + 17], [C.x + 138, C.z + 22.5]]);
    walk('walk', 'pirateCook', [[C.x + 123.5, C.z - 9], [C.x + 124, C.z - 1]], { item: 'basket' });
    // the ship: scrubbing the deck and the hull, a lookout in the crow's nest, a sea shanty on the quarterdeck
    const shipF = shipYaw + PI / 2; // facing the sea side
    add('scrub', 'pirateKid', lw(shipM, 3.0, 2.0), shipYaw - PI / 2);
    add('scrub', 'monkeySailor', lw(shipM, -6.3, 5.5), shipF);
    { const q = W(shipM, 0.6, 15.5, 0.2); add('lookout', 'monkeySailor', onF(q.x, q.z, q.y + 1), shipF); }
    { const m = lw(shipM, -2.6, -11.2, 5), d = lw(shipM, -0.6, -9.6, 5); add('music', 'pirateCaptain', m, face(m, d)); add('dance', 'pirateKid', d, face(d, m)); }
    // the camp: a cook at the pot, friends on the logs, someone asleep in the hammock
    { const p = onF(CAMP.x + 0.4, CAMP.z - 2.7); add('cook', 'pirateCook', p, face(p, CAMP)); }
    [[0.4, 'sit', 'pirateKid'], [3.54, 'sit', 'monkeySailor'], [5.11, 'music', 'pirateKid']].forEach(([a, act, type]) => {
      const p = onF(CAMP.x + Math.cos(a) * 3.6, CAMP.z + Math.sin(a) * 3.6); add(act, type, p, face(p, CAMP), { seat: 0.85 });
    });
    add('sleep', 'pirateCaptain', onF(VIL.hammock.p.x, VIL.hammock.p.z), VIL.hammock.yaw, { seat: 1.0 });
    // the skull: a lookout with the spyglass on the top, another on the cliff ledge
    add('lookout', 'pirateCaptain', lw(VIL.topM, -2.4, -2.2, 2), SK.a + Math.atan2(-2.4, -2.2));
    { const l = LEDGE.cliff, q = skullWorld(l.u + l.du * 1.6 - l.dw * 2.0, 0, l.w + l.dw * 1.6 + l.du * 2.0); add('lookout', 'pirateKid', onF(q.x, q.z, l.top + 1), Math.atan2(SKC * l.du + SKS * l.dw, -SKS * l.du + SKC * l.dw)); }
    // the grotto (far from Batty and Boo): a map reader at the table, a gem juggler, a monkey fishing in the glowing pool
    { const p = onF(G(-17.4, -6.3).x, G(-17.4, -6.3).z, 86); add('read', 'pirateCaptain', p, face(p, VIL.mapTable), { item: 'map' }); }
    { const p = onF(G(5.9, 2.5).x, G(5.9, 2.5).z, 86); add('juggle', 'monkeySailor', p, face(p, G(0, 20)), { item: 'gems' }); }
    { const p = onF(G(-5.4, -2.6).x, G(-5.4, -2.6).z, 86); add('fish', 'monkeySailor', p, face(p, G(...POOL)), { seat: 0 }); }
    // wanderers: across the rope bridge, along the jungle path, a mole digging near the X
    walk('walk', 'pirateKid', [bN.clone().addScaledVector(bAx, -4), bN.clone().addScaledVector(bAx, 1), bMid.clone(), bS.clone().addScaledVector(bAx, -1), bS.clone().addScaledVector(bAx, 4)].map((q) => onF(q.x, q.z, 90)));
    walk('walk', 'gnome', [[C.x - 28, C.z - 10], [C.x - 38, C.z - 16], [C.x - 47, C.z - 20.5]]);
    { const p = onF(XSPOT.x + 5, XSPOT.z - 4); add('dig', 'mole', p, face(p, XSPOT)); }
  }

  const spots = { landing: v3(dockX1 - 3, DOCK_Y + 1.8, DZ), npc, items, wild, life };

  for (const c of cols) colliders.push(c);

  // ---- animation ----
  function update(dt, t) {
    for (const f of flags) {
      const p = f.g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = f.base[i * 3], y = f.base[i * 3 + 1], k = x / f.w;
        p.setZ(i, (Math.sin(x * 1.5 - t * 4.5 + f.ph) * 0.35 + Math.sin(y * 2 + t * 3) * 0.06) * k);
      }
      p.needsUpdate = true;
      f.g.computeVertexNormals();
    }
    for (const g of glows) {
      const k = 1 + g.flicker * (Math.sin(t * 7.3 + g.ph) * 0.5 + Math.sin(t * 13.1 + g.ph * 2) * 0.3);
      g.s.material.opacity = g.opacity * k;
      g.s.scale.setScalar(g.size * (1 + (k - 1) * 0.3));
    }
    for (const f of fires) { f.scale.set(1 + Math.sin(t * 9) * 0.06, 1 + Math.sin(t * 11.7) * 0.15 + Math.sin(t * 5.3) * 0.08, 1 + Math.cos(t * 8.1) * 0.06); f.rotation.y = t * 0.8; }
    glowM.emissiveIntensity = 0.8 + Math.sin(t * 1.7) * 0.35;
    foamTex.offset.y = Math.sin(t * 0.7) * 0.12 + t * 0.02;
  }

  return { group, center: C.clone(), radius: RADIUS, height, floor, limit, camLimit, spots, update };
}
