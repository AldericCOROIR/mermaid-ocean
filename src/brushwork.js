// Painted surfaces everywhere: every object gets a seamless painted tile laid on
// with triplanar mapping (no UVs needed), tinted by the object's own colour.
// Static world objects use world space; moving creatures use their own local
// space so the strokes stay stuck to them.
import * as THREE from 'three';
import { inject } from './geom.js';
import { SWATCHES } from './swatches.js';

// Which tile each material gets, by the key of its existing shader effect.
// scale = tiles per world unit, k = strength.
const KINDS = {
  bed: { tile: 'sand', scale: 0.06, k: 0.9 },
  rock: { tile: 'rock', scale: 0.1, k: 0.9 },
  arch: { tile: 'rock', scale: 0.1, k: 0.9 },
  kelp: { tile: 'kelp', scale: 0.12, k: 0.8 },
  coral: { tile: 'coral', scale: 0.9, k: 1.0 },
  fan: { tile: 'coral', scale: 0.5, k: 0.5 },
  anem: { tile: 'coral', scale: 1.2, k: 0.9 },
  star: { tile: 'coral', scale: 1.4, k: 0.9 },
  grass: { tile: 'kelp', scale: 0.5, k: 0.6 },
  flw: { tile: 'coral', scale: 0.8, k: 0.6 },
  city: { tile: 'shell', scale: 0.12, k: 0.85 },
  plaza: { tile: 'shell', scale: 0.06, k: 0.85 },
  tower: { tile: 'shell', scale: 0.12, k: 0.85 },
  rib: { tile: 'shell', scale: 0.3, k: 0.6 },
};
const DEFAULT = { tile: 'brush', scale: 0.6, k: 1.0 };
const TARGET_STD = 0.14; // every tile is pushed to at least this much stroke contrast
const LOCAL = { tile: 'brush', scale: 1.6, k: 0.8 };

export class Brushwork {
  constructor() {
    this.amount = { value: 1 };
    this.tiles = {};
    const loader = new THREE.TextureLoader();
    for (const [name, s] of Object.entries(SWATCHES)) {
      const tex = loader.load(s.url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      this.tiles[name] = { T: { value: tex }, A: { value: new THREE.Vector3(...s.avg) } };
    }
  }

  tile(name) { return this.tiles[name] || this.tiles.brush; }

  // Every surface gets two layers: its own painted tile (colour and texture) and
  // the shared brush-stroke tile, so even pale or plain tiles always show strokes.
  // Tiles with weak contrast are boosted to a common stroke strength.
  apply(material, cfg, local = false) {
    const t = this.tile(cfg.tile), b = this.tiles.brush;
    const std = SWATCHES[cfg.tile in this.tiles ? cfg.tile : 'brush'].std || TARGET_STD;
    const boost = Math.min(2.2, Math.max(1, TARGET_STD / std));
    const P = local ? 'vLPos' : 'vWPos', N = local ? 'vLNormal' : 'vWNormal';
    inject(material, {
      key: `brush-${cfg.tile in this.tiles ? cfg.tile : 'brush'}-${local ? 'l' : 'w'}`,
      uniforms: {
        uSwT: t.T, uSwA: t.A, uSwB: b.T, uSwBA: b.A, uSwS: { value: cfg.scale }, uSwK: { value: cfg.k },
        uSwC: { value: boost }, uSwBS: { value: local ? 2.2 : 0.45 }, uBrushAmt: this.amount,
      },
      fragmentHead: /* glsl */`
        uniform sampler2D uSwT; uniform sampler2D uSwB; uniform vec3 uSwA; uniform vec3 uSwBA;
        uniform float uSwS; uniform float uSwK; uniform float uSwC; uniform float uSwBS; uniform float uBrushAmt;
        vec3 swTri(sampler2D t, vec3 p, vec3 n) {
          vec3 b = pow(abs(n), vec3(4.0)); b /= b.x + b.y + b.z;
          return texture2D(t, p.zy).rgb * b.x + texture2D(t, p.xz).rgb * b.y + texture2D(t, p.xy).rgb * b.z;
        }`,
      color: `{ vec3 sn = normalize(${N});
        vec3 sw = 1.0 + (swTri(uSwT, ${P} * uSwS, sn) / uSwA - 1.0) * uSwC;
        vec3 sb = swTri(uSwB, ${P} * uSwBS + 17.0, sn) / uSwBA;
        vec3 paint = clamp(sw * mix(vec3(1.0), sb, 0.4), 0.15, 2.2);
        diffuseColor.rgb *= mix(vec3(1.0), paint, uSwK * uBrushAmt); }`,
    });
  }

  static paintable(m) {
    if (m.userData.noPaint) return false; // explicit, documented exemption
    if (m.isShaderMaterial || m.isPointsMaterial || m.isSpriteMaterial || m.isLineBasicMaterial) return false;
    if (m.blending === THREE.AdditiveBlending) return false; // glows and light shafts
    return !!(m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial || m.isMeshBasicMaterial);
  }

  // Paint every material under root. local=true for things that move.
  applyTo(root, local = false) {
    const seen = new Set();
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (seen.has(m) || m.userData.brushed || !Brushwork.paintable(m)) continue;
        seen.add(m); m.userData.brushed = true;
        const keys = (m.userData.hooks || []).map((h) => (/^(?:caustic|sway)([a-z]+)/.exec(h.key || '') || [])[1]);
        let cfg = local ? LOCAL : (m.userData.paintTile ? { ...DEFAULT, tile: m.userData.paintTile } : (keys.map((k) => KINDS[k]).find(Boolean) || DEFAULT));
        if (!(cfg.tile in this.tiles)) cfg = local ? LOCAL : DEFAULT; // that tile isn't painted yet
        this.apply(m, cfg, local);
        m.needsUpdate = true;
      }
    });
  }

  // Safety net: paint anything added to the scene later (new buildings, spawned friends...).
  sweep(scene, staticRoots) {
    for (const o of scene.children) this.applyTo(o, !staticRoots.includes(o));
  }

  // Everything visible that is still unpainted (used by tools/check_paint.mjs).
  static unpainted(scene) {
    const out = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (Brushwork.paintable(m) && !m.userData.brushed) out.push({ mesh: o.name || o.type, material: m.type, path: pathOf(o) });
      }
    });
    return out;
  }
}

function pathOf(o) { const p = []; for (let x = o; x; x = x.parent) p.unshift(x.name || x.type); return p.join(' > '); }
