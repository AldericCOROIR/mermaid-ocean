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

  apply(material, cfg, local = false) {
    const t = this.tile(cfg.tile);
    inject(material, {
      key: `brush-${cfg.tile in this.tiles ? cfg.tile : 'brush'}-${local ? 'l' : 'w'}`,
      uniforms: { uSwT: t.T, uSwA: t.A, uSwS: { value: cfg.scale }, uSwK: { value: cfg.k }, uBrushAmt: this.amount },
      fragmentHead: /* glsl */`
        uniform sampler2D uSwT; uniform vec3 uSwA; uniform float uSwS; uniform float uSwK; uniform float uBrushAmt;
        vec3 swTri(vec3 p, vec3 n) {
          vec3 b = pow(abs(n), vec3(4.0)); b /= b.x + b.y + b.z;
          return texture2D(uSwT, p.zy).rgb * b.x + texture2D(uSwT, p.xz).rgb * b.y + texture2D(uSwT, p.xy).rgb * b.z;
        }`,
      color: `{ vec3 sw = swTri(${local ? 'vLPos' : 'vWPos'} * uSwS, normalize(${local ? 'vLNormal' : 'vWNormal'})) / uSwA;
        diffuseColor.rgb *= mix(vec3(1.0), clamp(sw, 0.0, 2.5), uSwK * uBrushAmt); }`,
    });
  }

  // Paint every lit material under root. local=true for things that move.
  applyTo(root, local = false) {
    const seen = new Set();
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (seen.has(m) || !m.isMeshLambertMaterial || m.userData.brushed) continue;
        seen.add(m); m.userData.brushed = true;
        const keys = (m.userData.hooks || []).map((h) => (/^(?:caustic|sway)([a-z]+)/.exec(h.key || '') || [])[1]);
        let cfg = local ? LOCAL : (keys.map((k) => KINDS[k]).find(Boolean) || DEFAULT);
        if (!(cfg.tile in this.tiles)) cfg = local ? LOCAL : DEFAULT; // that tile isn't painted yet
        this.apply(m, cfg, local);
        m.needsUpdate = true;
      }
    });
  }
}
