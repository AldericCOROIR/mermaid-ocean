// The ocean: seabed, kelp forest, coral reef, rocks, light shafts, surface,
// floating particles and the glowing crystal trench.
import * as THREE from 'three';
import { WORLD, groundHeight, rand, rr, pick, glowTexture, bubbleTexture, fbm, canvasTexture } from './util.js';
import { merge, mat, segment, lumpify, paintMat, withCaustics, withSway, inject, shared, CAUSTIC_GLSL } from './geom.js';

export const colliders = []; // vertical cylinders or wall boxes, optionally rotated

export function buildWorld(scene, quality) {
  const world = new THREE.Group();
  scene.add(world);

  world.add(buildSky());
  world.add(buildSeabed());
  world.add(buildSurface());
  world.add(buildLightShafts());
  buildRocks(world);
  buildKelpForest(world);
  buildReef(world);
  buildTrench(world);
  buildDecor(world);
  const snow = buildMarineSnow(quality);
  world.add(snow.points);
  const vents = buildBubbleVents(world);

  return {
    group: world,
    update(dt, t, camera) { snow.update(camera); vents.update(dt); },
  };
}

// Gradient dome: bright turquoise above, deep blue below. Ignores fog.
function buildSky() {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: shared.uTime },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vDir; uniform float uTime;
      void main(){
        float y = vDir.y;
        vec3 deep = vec3(0.03, 0.13, 0.30);
        vec3 mid = vec3(0.10, 0.42, 0.62);
        vec3 top = vec3(0.55, 0.92, 0.98);
        vec3 c = mix(deep, mid, smoothstep(-0.6, 0.05, y));
        c = mix(c, top, smoothstep(0.15, 0.95, y));
        // soft sun glow seen from below
        float sun = pow(max(dot(normalize(vDir), normalize(vec3(0.25, 1.0, 0.15))), 0.0), 12.0);
        c += vec3(1.0, 0.95, 0.8) * sun * 0.6;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.sky = true;
  mesh.onBeforeRender = (r, s, cam) => mesh.position.copy(cam.position);
  return mesh;
}

function buildSeabed() {
  const S = WORLD.size, N = 180;
  const geo = new THREE.PlaneGeometry(S, S, N, N);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const sand = new THREE.Color(0xe6c99a), pinkSand = new THREE.Color(0xeaa9bd), violet = new THREE.Color(0x7d6bb8), deep = new THREE.Color(0x2b3f7a), moss = new THREE.Color(0x8fcf9a);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = groundHeight(x, z);
    p.setY(i, h);
    const n = fbm(x * 0.03 + 7, z * 0.03, 3);
    c.copy(sand).lerp(pinkSand, THREE.MathUtils.smoothstep(n, 0.45, 0.7));
    c.lerp(moss, THREE.MathUtils.smoothstep(fbm(x * 0.02, z * 0.02 + 30, 2), 0.55, 0.75) * 0.5);
    c.lerp(violet, THREE.MathUtils.smoothstep(h, 12, 40));
    c.lerp(deep, THREE.MathUtils.smoothstep(-h, 14, 30));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = withCaustics(paintMat({ vertexColors: true }), 0.75, 'bed');
  // sand ripples
  inject(m, { key: 'ripple', fragment: `gl_FragColor.rgb *= 0.94 + 0.06 * sin(vWPos.x * 1.3 + sin(vWPos.z * 0.4) * 2.0);` });
  const mesh = new THREE.Mesh(geo, m);
  mesh.name = 'seabed';
  return mesh;
}

// Underside of the water surface: shimmering bright ripples.
function buildSurface() {
  const geo = new THREE.PlaneGeometry(WORLD.size * 2.5, WORLD.size * 2.5, 1, 1);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { uTime: shared.uTime },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; uniform float uTime;
      ${CAUSTIC_GLSL}
      void main(){
        float c = causticPattern(vW.xz * 0.035, uTime * 0.35);
        float c2 = causticPattern(vW.xz * 0.012 + 3.0, uTime * 0.2);
        float bright = clamp(c * 0.7 + c2 * 0.5, 0.0, 1.0);
        float d = length(vW.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(60.0, 420.0, d);
        // Snell's window: brighter straight above the viewer
        float window = 1.0 - smoothstep(20.0, 140.0, d);
        vec3 c3 = mix(vec3(0.42, 0.82, 0.93), vec3(0.97, 1.0, 0.98), bright);
        c3 += vec3(0.25, 0.22, 0.12) * window;
        gl_FragColor = vec4(c3, (0.45 + bright * 0.45) * fade);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.y = WORLD.surfaceY;
  mesh.renderOrder = 2;
  mesh.userData.surface = true;
  return mesh;
}

// Soft god rays slanting down from the surface.
function buildLightShafts() {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(3, 7, 70, 12, 1, true);
  geo.translate(0, -35, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: shared.uTime },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; varying float vSeed;
      void main(){ vY = uv.y; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); vSeed = modelMatrix[3].x*0.13 + modelMatrix[3].z*0.07; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying float vY; varying vec3 vN; varying vec3 vV; varying float vSeed; uniform float uTime;
      void main(){
        float rim = pow(abs(dot(vN, vV)), 1.5);
        float flick = 0.6 + 0.4 * sin(uTime * 0.6 + vSeed * 10.0);
        float a = rim * smoothstep(0.0, 0.7, vY) * flick * 0.11;
        gl_FragColor = vec4(vec3(0.85, 0.97, 1.0) * a, 1.0);
      }`,
  });
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Mesh(geo, m);
    const a = rand() * Math.PI * 2, r = rr(0, 200);
    s.position.set(Math.cos(a) * r, WORLD.surfaceY + 2, Math.sin(a) * r);
    s.rotation.set(0.25 + rr(-0.05, 0.05), 0, 0.18 + rr(-0.05, 0.05));
    s.scale.setScalar(rr(0.7, 1.6));
    s.renderOrder = 3;
    g.add(s);
  }
  return g;
}

function scatter(count, center, radius, minDist = 0, avoidCity = true) {
  const pts = [];
  let guard = 0;
  while (pts.length < count && guard++ < count * 20) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius;
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (Math.abs(x) > WORLD.size / 2 - 10 || Math.abs(z) > WORLD.size / 2 - 10) continue;
    if (avoidCity && Math.hypot(x - WORLD.cityPos.x, z - WORLD.cityPos.z) < 110) continue;
    if (Math.hypot(x - WORLD.start.x, z - WORLD.start.z) < minDist) continue;
    pts.push(new THREE.Vector3(x, groundHeight(x, z), z));
  }
  return pts;
}

function instanced(geo, material, placements, colors) {
  const im = new THREE.InstancedMesh(geo, material, placements.length);
  placements.forEach((m, i) => im.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => im.setColorAt(i, c));
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

function buildRocks(world) {
  const protos = [0, 1, 2].map((k) => {
    const g = lumpify(new THREE.IcosahedronGeometry(1, 2), 0.28, 1.6, k * 3.1);
    g.scale(1, 0.7, 1);
    return g;
  });
  const m = withCaustics(paintMat({ color: 0xffffff, flat: false }), 0.6, 'rock');
  const tints = [0x8f86b8, 0x7a90b5, 0xa58fb0, 0x6f7fa8, 0xb09aa0].map((c) => new THREE.Color(c));
  protos.forEach((g, k) => {
    const pts = scatter(40, new THREE.Vector3(), 240, 15);
    const mats = [], cols = [];
    pts.forEach((p) => {
      const s = rr(1.5, 6) * (rand() < 0.12 ? 2.6 : 1);
      mats.push(mat(p.x, p.y + s * 0.2, p.z, rr(0, 1), rr(0, 6), rr(0, 1), s, s * rr(0.6, 1.1), s));
      cols.push(pick(tints));
      if (s > 6) colliders.push({ x: p.x, z: p.z, r: s * 0.85, top: p.y + s * 0.7 });
    });
    world.add(instanced(g, m, mats, cols));
  });
  // Big arch, a landmark between start and reef.
  const arch = new THREE.TorusGeometry(14, 3.4, 10, 24, Math.PI);
  lumpify(arch, 0.08, 0.4, 2);
  const am = new THREE.Mesh(arch, withCaustics(paintMat({ color: 0x9a8cc4 }), 0.6, 'arch'));
  const ax = 70, az = 55;
  am.position.set(ax, groundHeight(ax, az) - 2, az);
  am.rotation.y = 0.6;
  world.add(am);
}

function buildKelpForest(world) {
  const blade = new THREE.PlaneGeometry(0.9, 1, 1, 16);
  blade.translate(0, 0.5, 0);
  // taper + wavy edge, baked into the prototype
  const p = blade.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const w = (1 - y * 0.55) * (0.8 + 0.25 * Math.sin(y * 30));
    p.setX(i, p.getX(i) * w + Math.sin(y * 6) * 0.25);
  }
  blade.computeVertexNormals();
  const cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const c = new THREE.Color(0x3f9a4a).lerp(new THREE.Color(0xe6e070), Math.pow(y, 0.8));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  blade.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = withSway(paintMat({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x15301a }), { amp: 2.2, freq: 0.7, heightScale: 1.0, key: 'kelp' });
  const placements = [], tints = [];
  const pts = [...scatter(260, WORLD.kelpPos, 75, 20), ...scatter(120, new THREE.Vector3(-60, 0, 150), 60, 20), ...scatter(90, new THREE.Vector3(150, 0, -110), 50, 20)];
  pts.forEach((pt) => {
    const h = rr(14, 34);
    for (let k = 0; k < 3; k++) {
      placements.push(mat(pt.x + rr(-1, 1), pt.y - 0.5, pt.z + rr(-1, 1), 0, rr(0, Math.PI), 0, rr(0.8, 1.4), h * rr(0.7, 1), 1));
      tints.push(new THREE.Color().setHSL(rr(0.22, 0.33), 0.6, rr(0.45, 0.62)));
    }
  });
  const im = instanced(blade, m, placements, tints);
  im.frustumCulled = false;
  world.add(im);
}

// Coral prototypes are merged meshes with baked vertex colours.
function branchCoral(color, tip) {
  const parts = [];
  const grow = (a, dir, len, r, depth) => {
    const b = a.clone().addScaledVector(dir, len);
    parts.push({ geo: segment(a, b, r, r * 0.72, 6), color: depth > 2 ? tip : color });
    if (depth > 3) { parts.push({ geo: new THREE.SphereGeometry(r * 0.9, 6, 4), matrix: mat(b.x, b.y, b.z), color: tip }); return; }
    const n = depth < 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new THREE.Vector3(rr(-0.8, 0.8), rr(0.1, 0.5), rr(-0.8, 0.8))).normalize();
      grow(b, d, len * 0.75, r * 0.72, depth + 1);
    }
  };
  grow(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 1.2, 0.28, 0);
  return merge(parts);
}
function brainCoral(color) {
  const g = lumpify(new THREE.IcosahedronGeometry(1, 3), 0.12, 6, 1);
  g.scale(1, 0.65, 1);
  return merge([{ geo: g, color }]);
}
let _fanTex;
function fanTexture() {
  if (_fanTex) return _fanTex;
  _fanTex = canvasTexture(256, 128, (g, w, h) => {
    g.strokeStyle = '#fff'; g.lineCap = 'round';
    const branch = (x, y, a, len, wdt, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y - Math.sin(a) * len;
      g.lineWidth = wdt; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      if (d < 6) { branch(x2, y2, a + 0.28, len * 0.8, wdt * 0.75, d + 1); branch(x2, y2, a - 0.28, len * 0.8, wdt * 0.75, d + 1); }
    };
    branch(w / 2, h, Math.PI / 2, 30, 7, 0);
    branch(w / 2, h, Math.PI / 2 + 0.6, 26, 6, 1);
    branch(w / 2, h, Math.PI / 2 - 0.6, 26, 6, 1);
    // cross-links make the lace
    g.lineWidth = 1.5; g.globalAlpha = 0.8;
    for (let r = 20; r < h; r += 11) { g.beginPath(); g.arc(w / 2, h, r, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
  });
  return _fanTex;
}
function fanCoral(color) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (0.15 + 0.7 * i / 12);
    const r = 2 + Math.sin(i * 1.7) * 0.25;
    shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(shape, 4);
  // ShapeGeometry uv = xy; remap into 0..1 for the lattice texture
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4.4 + 0.5, uv.getY(i) / 2.2);
  const stem = segment(new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0, 0.5, 0), 0.12, 0.08);
  const su = stem.attributes.uv;
  for (let i = 0; i < su.count; i++) su.setXY(i, 0.5, 0.03);
  return merge([{ geo: g, color }, { geo: stem, color }]);
}
function tubeCoral(color, tip) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const h = rr(0.8, 2.4), x = rr(-0.6, 0.6), z = rr(-0.6, 0.6), r = rr(0.14, 0.26);
    const g = new THREE.CylinderGeometry(r, r * 0.8, h, 8, 1, true);
    parts.push({ geo: g, matrix: mat(x, h / 2, z, rr(-0.2, 0.2), 0, rr(-0.2, 0.2)), color });
    parts.push({ geo: new THREE.TorusGeometry(r, 0.05, 4, 8), matrix: mat(x, h, z, Math.PI / 2), color: tip });
  }
  return merge(parts);
}
function tableCoral(color) {
  const parts = [{ geo: segment(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.25, 0.18), color }];
  parts.push({ geo: new THREE.CylinderGeometry(1.6, 0.4, 0.35, 12), matrix: mat(0, 1.1, 0), color });
  parts.push({ geo: new THREE.CylinderGeometry(1.0, 0.3, 0.3, 10), matrix: mat(0.3, 1.6, -0.2), color });
  return merge(parts);
}
function anemone(color, tip) {
  const parts = [{ geo: new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), color }];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, r = rr(0.15, 0.45);
    const base = new THREE.Vector3(Math.cos(a) * r, 0.35, Math.sin(a) * r);
    const top = base.clone().add(new THREE.Vector3(Math.cos(a) * 0.4, rr(0.9, 1.5), Math.sin(a) * 0.4));
    parts.push({ geo: segment(base, top, 0.07, 0.04, 4), color: tip });
  }
  return merge(parts);
}

const CORAL_COLORS = [0xff7aa8, 0xff9d5c, 0xffd25e, 0xb48cff, 0x63e0d0, 0xff6f91, 0x8fd3ff, 0xf7a1ff];

function buildReef(world) {
  const coralMat = withCaustics(paintMat({ vertexColors: true, emissive: 0x1a0a20 }), 0.5, 'coral');
  const fanMat = withSway(withCaustics(paintMat({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a1030, map: fanTexture() }), 0.5, 'fan'), { amp: 0.2, freq: 1.0, heightScale: 0.6, key: 'fan' });
  fanMat.alphaTest = 0.4; fanMat.transparent = false;
  const anemoneMat = withSway(paintMat({ vertexColors: true, emissive: 0x401030 }), { amp: 0.5, freq: 2.0, heightScale: 0.9, key: 'anem' });

  const kinds = [
    { make: () => branchCoral(0xffffff, 0xffe0f0), mat: coralMat, n: 80, s: [1.2, 3.2] },
    { make: () => brainCoral(0xffffff), mat: coralMat, n: 50, s: [0.8, 2.4] },
    { make: () => fanCoral(0xffffff), mat: fanMat, n: 60, s: [0.5, 1.2] },
    { make: () => tubeCoral(0xffffff, 0xfff6c0), mat: coralMat, n: 50, s: [0.8, 1.8] },
    { make: () => tableCoral(0xffffff), mat: coralMat, n: 30, s: [1.2, 2.5] },
    { make: () => anemone(0xff8fb8, 0xffd0ec), mat: anemoneMat, n: 60, s: [0.8, 1.6] },
  ];
  const zones = [
    { c: WORLD.reefPos, r: 70, w: 1 },
    { c: new THREE.Vector3(-20, 0, 60), r: 50, w: 0.5 },
    { c: new THREE.Vector3(-110, 0, -90), r: 60, w: 0.5 },
    { c: WORLD.cityPos, r: 95, w: 0.4, ring: true },
  ];
  kinds.forEach((k, ki) => {
    for (let v = 0; v < 2; v++) {
      const geo = k.make();
      const placements = [], cols = [];
      zones.forEach((z) => {
        const n = Math.round(k.n * z.w / 2);
        const pts = z.ring ? scatter(n * 3, z.c, z.r, 12, false).filter((p) => Math.hypot(p.x - z.c.x, p.z - z.c.z) > 55).slice(0, n) : scatter(n, z.c, z.r, 12);
        pts.forEach((p) => {
          const s = rr(k.s[0], k.s[1]);
          placements.push(mat(p.x, p.y - 0.2, p.z, 0, rr(0, Math.PI * 2), 0, s));
          cols.push(new THREE.Color(pick(CORAL_COLORS)));
        });
      });
      const im = instanced(geo, k.mat, placements, cols);
      world.add(im);
    }
  });
}

// Deep trench: dark, with glowing crystals and luminous plants.
export const crystalSpots = [];
function buildTrench(world) {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(0.6, 2.2, 0.6);
  g.translate(0, 1.6, 0);
  const m = paintMat({ color: 0x9fe8ff, emissive: 0x3a7fd0, flat: true });
  const placements = [], cols = [];
  const pal = [0x9fe8ff, 0xd9a6ff, 0xa6ffd9, 0xffb3e6].map((c) => new THREE.Color(c));
  const pts = scatter(70, WORLD.trenchPos, 48, 0, false);
  pts.forEach((p) => {
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const s = rr(0.6, 1.8);
      placements.push(mat(p.x + rr(-1.5, 1.5), p.y - 0.3, p.z + rr(-1.5, 1.5), rr(-0.5, 0.5), rr(0, 3), rr(-0.5, 0.5), s));
      cols.push(pick(pal));
    }
  });
  world.add(instanced(g, m, placements, cols));
  // glow sprites around the crystals
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x7fdcff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  pts.filter((_, i) => i % 3 === 0).forEach((p) => {
    const s = new THREE.Sprite(glowMat);
    s.position.set(p.x, p.y + 2, p.z);
    s.scale.setScalar(rr(5, 9));
    world.add(s);
  });
}

function starfishGeo() {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? 1 : 0.42;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  return g;
}
export function spiralShellGeo(turns = 4, len = 2.2, r0 = 0.9) {
  const pts = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = r0 * Math.pow(1 - t, 0.9) * (0.85 + 0.15 * Math.cos(t * turns * Math.PI * 2));
    pts.push(new THREE.Vector2(Math.max(r, 0.01), t * len));
  }
  return new THREE.LatheGeometry(pts, 14);
}

function buildDecor(world) {
  const sm = withCaustics(paintMat({ color: 0xffffff, emissive: 0x200810 }), 0.5, 'star');
  const star = starfishGeo();
  const placements = [], cols = [];
  scatter(90, new THREE.Vector3(), 220, 8).forEach((p) => {
    const s = rr(0.35, 0.8);
    placements.push(mat(p.x, p.y + 0.1, p.z, rr(-0.2, 0.2), rr(0, 6), rr(-0.2, 0.2), s));
    cols.push(new THREE.Color(pick([0xff7e5f, 0xffb347, 0xff6fa8, 0xb39dff, 0xffe066])));
  });
  world.add(instanced(star, sm, placements, cols));
  // spiral shells lying on the sand
  const shell = spiralShellGeo();
  shell.rotateZ(Math.PI / 2.4);
  const p2 = [], c2 = [];
  scatter(70, new THREE.Vector3(), 220, 8).forEach((p) => {
    const s = rr(0.3, 0.7);
    p2.push(mat(p.x, p.y + 0.3 * s, p.z, 0, rr(0, 6), 0, s));
    c2.push(new THREE.Color(pick([0xfff0e0, 0xffd6e8, 0xf6e1c3, 0xe7d4ff])));
  });
  world.add(instanced(shell, sm, p2, c2));
  // sea grass tufts
  const tuft = merge(Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2;
    const base = new THREE.Vector3(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2);
    return { geo: segment(base, base.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, 1.6 + (i % 3) * 0.4, Math.sin(a) * 0.3)), 0.06, 0.01, 3), color: 0xffffff };
  }));
  const gm = withSway(paintMat({ vertexColors: true, emissive: 0x0a2010 }), { amp: 0.4, freq: 1.6, heightScale: 0.7, key: 'grass' });
  const p3 = [], c3 = [];
  scatter(500, new THREE.Vector3(), 240, 6).forEach((p) => {
    p3.push(mat(p.x, p.y - 0.1, p.z, 0, rr(0, 6), 0, rr(0.6, 1.3)));
    c3.push(new THREE.Color().setHSL(rr(0.2, 0.4), 0.55, rr(0.4, 0.6)));
  });
  world.add(instanced(tuft, gm, p3, c3));
}

// Drifting "marine snow" specks that wrap around the camera: sells depth & motion.
function buildMarineSnow(quality) {
  const N = quality === 'low' ? 500 : 1200, R = 40;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = rr(-R, R); pos[i * 3 + 1] = rr(-R, R); pos[i * 3 + 2] = rr(-R, R); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: shared.uTime, uCam: { value: new THREE.Vector3() }, uTex: { value: glowTexture() }, uR: { value: R } },
    vertexShader: `uniform float uTime; uniform vec3 uCam; uniform float uR; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime*0.2+position.y)*1.5, -uTime*0.6, cos(uTime*0.15+position.x)*1.5);
        p = mod(p - uCam + uR, 2.0*uR) - uR + uCam;
        vec4 mv = viewMatrix * vec4(p,1.0);
        float d = -mv.z;
        vA = smoothstep(uR, uR*0.4, d) * smoothstep(0.5, 3.0, d);
        gl_PointSize = clamp(90.0 / d, 1.0, 9.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uTex; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vec3(0.85,0.95,1.0) * t.a * vA * 0.55, 1.0); }`,
  });
  const points = new THREE.Points(geo, m);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return { points, update(camera) { m.uniforms.uCam.value.copy(camera.position); } };
}

// Bubble columns rising from vents in the sand.
function buildBubbleVents(world) {
  const vents = scatter(14, new THREE.Vector3(), 200, 20).concat(scatter(4, WORLD.trenchPos, 30, 0, false));
  const PER = 24, N = vents.length * PER;
  const pos = new Float32Array(N * 3), speed = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  vents.forEach((v, vi) => {
    for (let k = 0; k < PER; k++) {
      const i = vi * PER + k;
      pos.set([v.x + rr(-0.4, 0.4), v.y + rand() * 40, v.z + rr(-0.4, 0.4)], i * 3);
      speed[i] = rr(2, 4.5);
    }
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: bubbleTexture(), size: 0.7, transparent: true, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  world.add(pts);
  return {
    update(dt) {
      for (let i = 0; i < N; i++) {
        const v = vents[Math.floor(i / PER)];
        let y = pos[i * 3 + 1] + speed[i] * dt;
        if (y > WORLD.surfaceY) y = v.y;
        pos[i * 3 + 1] = y;
        pos[i * 3] = v.x + Math.sin(y * 0.8 + i) * 0.5;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

export function collide(pos, radius = 1) {
  for (const c of colliders) {
    if (pos.y > c.top + radius) continue;
    if (c.hw !== undefined) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0);
      let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      const px = c.hw + radius - Math.abs(lx);
      const pz = c.hd + radius - Math.abs(lz);
      if (px > 0 && pz > 0) {
        if (px < pz) lx += (lx < 0 ? -1 : 1) * px;
        else lz += (lz < 0 ? -1 : 1) * pz;
        pos.x = c.x + lx * cs + lz * sn;
        pos.z = c.z - lx * sn + lz * cs;
      }
      continue;
    }
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const d = Math.hypot(dx, dz), min = c.r + radius;
    if (d < min && d > 0.0001) { pos.x = c.x + (dx / d) * min; pos.z = c.z + (dz / d) * min; }
  }
}
