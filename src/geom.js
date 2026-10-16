// Geometry & material helpers shared by every procedural model.
import * as THREE from 'three';

// Shared animated uniforms (time) for all custom shader injections.
export const shared = { uTime: { value: 0 } };

// Merge geometries into one non-indexed BufferGeometry, baking an optional
// per-piece vertex colour so one draw call can carry several colours.
export function merge(parts) {
  let count = 0;
  const list = parts.map(({ geo, color, matrix }) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    count += g.attributes.position.count;
    return { g, color: new THREE.Color(color ?? 0xffffff) };
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), col = new Float32Array(count * 3);
  let o = 0;
  for (const { g, color } of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
    for (let i = 0; i < n; i++) { col[(o + i) * 3] = color.r; col[(o + i) * 3 + 1] = color.g; col[(o + i) * 3 + 2] = color.b; }
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

// A cylinder between two points (used for coral branches, legs, tentacles).
export function segment(a, b, r0, r1, radial = 6) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false);
  g.translate(0, len / 2, 0);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  _m.compose(a, _q, _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  return g;
}

// Displace vertices of a geometry by smooth noise (rocks, brain coral).
export function lumpify(geo, amount, freq = 1.7, seed = 0) {
  const g = geo.index ? geo : geo;
  const p = g.attributes.position, v = new THREE.Vector3();
  const cache = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let k = cache.get(key);
    if (k === undefined) {
      k = 1 + amount * (Math.sin(v.x * freq + seed) * Math.sin(v.y * freq * 1.3 + seed * 2) * Math.sin(v.z * freq * 0.9 + seed * 3) + 0.5 * Math.sin(v.x * freq * 3.1 + v.z * freq * 2.3));
      cache.set(key, k);
    }
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Toon-ish lambert material. `soft` brightens the shadow side so things
// read clearly underwater and look painted rather than dark.
export function paintMat(opts = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: opts.vertexColors ?? false, color: opts.color ?? 0xffffff, emissive: opts.emissive ?? 0x000000, side: opts.side ?? THREE.FrontSide, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, map: opts.map ?? null, flatShading: !!opts.flat });
  if (opts.depthWrite === false) m.depthWrite = false;
  return m;
}

// Inject GLSL into a built-in material. Several injections can stack on one
// material; they are combined into a single onBeforeCompile.
// hooks: { key, uniforms, vertexHead, vertex (after begin_vertex), worldVertex,
//          fragmentHead, emissive (after emissivemap), fragment (before dithering) }
export function inject(material, hooks) {
  const list = material.userData.hooks || (material.userData.hooks = []);
  list.push(hooks);
  const join = (k) => list.map((h) => h[k] || '').join('\n');
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, ...list.map((h) => h.uniforms || {}));
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\n${join('vertexHead')}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${join('vertex')}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n{ vec4 wp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n wp = instanceMatrix * wp;\n#endif\n wp = modelMatrix * wp; vWPos = wp.xyz;\n vec3 wn = normal;\n#ifdef USE_INSTANCING\n wn = mat3(instanceMatrix) * wn;\n#endif\n vWNormal = normalize(mat3(modelMatrix) * wn); }\n${join('worldVertex')}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\n${CAUSTIC_GLSL}\n${join('fragmentHead')}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${join('emissive')}`)
      .replace('#include <dithering_fragment>', `${join('fragment')}\n#include <dithering_fragment>`);
  };
  const key = list.map((h) => h.key || '?').join('|');
  material.customProgramCacheKey = () => key;
  return material;
}

export const CAUSTIC_GLSL = /* glsl */`
float causticPattern(vec2 p, float t) {
  p = mod(p, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 3; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 3.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.5);
}
`;

// Adds dancing light caustics on surfaces facing up.
export function withCaustics(material, strength = 0.55, key = 'c') {
  return inject(material, {
    key: 'caustic' + key + strength,
    emissive: `{ float up = smoothstep(0.1, 0.9, vWNormal.y);
      float cs = causticPattern(vWPos.xz * 0.11, uTime * 0.45);
      float depthFade = smoothstep(-40.0, 40.0, vWPos.y) * 0.7 + 0.3;
      totalEmissiveRadiance += vec3(0.75, 0.95, 1.0) * cs * up * ${strength.toFixed(3)} * depthFade * diffuseColor.rgb * 1.6; }`,
  });
}

// Vertex sway for plants: amount grows with height above the object's base.
export function withSway(material, { amp = 0.6, freq = 1.2, heightScale = 0.25, key = 's' } = {}) {
  return inject(material, {
    key: 'sway' + key,
    vertex: `{ vec3 base = vec3(0.0);
      #ifdef USE_INSTANCING
        base = instanceMatrix[3].xyz;
      #endif
      base += modelMatrix[3].xyz;
      float h = max(position.y, 0.0) * ${heightScale.toFixed(3)};
      float ph = base.x * 0.37 + base.z * 0.21;
      transformed.x += sin(uTime * ${freq.toFixed(3)} + ph + position.y * 0.35) * h * h * ${amp.toFixed(3)};
      transformed.z += cos(uTime * ${(freq * 0.8).toFixed(3)} + ph * 1.3 + position.y * 0.27) * h * h * ${(amp * 0.6).toFixed(3)}; }`,
  });
}
