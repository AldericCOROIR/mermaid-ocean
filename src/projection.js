// Painted-world projection.
// Each painting was made over a screenshot of the plain 3D world taken from a
// known camera. We put a "projector" at that same camera and project the
// painting back onto the static geometry, so the world looks like the art but
// stays a real 3D space you can swim around in.
//
// Per projector: the painting, a depth map rendered from its camera (so the
// painting only lands on surfaces that camera actually saw), and its matrix.
import * as THREE from 'three';
import { inject } from './geom.js';

const DEPTH_SIZE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 768 : 1024;

export class PaintProjection {
  constructor(renderer, scene, views) {
    this.renderer = renderer;
    this.scene = scene;
    this.views = views; // [{ name, cam: {p, q, fov, aspect}, url }]
    this.amount = { value: 1 };
    this.near = { value: 0.3 };
    this.far = { value: 1200 };
    this.projectors = views.map((v) => {
      const cam = new THREE.PerspectiveCamera(v.cam.fov, v.cam.aspect, this.near.value, this.far.value);
      cam.position.fromArray(v.cam.p);
      cam.quaternion.fromArray(v.cam.q);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      const rt = new THREE.WebGLRenderTarget(DEPTH_SIZE, Math.round(DEPTH_SIZE / v.cam.aspect));
      rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height);
      rt.depthTexture.type = THREE.UnsignedIntType;
      return {
        name: v.name, cam, rt,
        uniforms: {
          M: { value: vp }, P: { value: cam.position.clone() },
          T: { value: null }, D: { value: rt.depthTexture }, on: { value: 0 },
        },
        ready: { tex: false, depth: false },
        url: v.url,
      };
    });
  }

  // Load the paintings; a projector switches on once both its painting and depth exist.
  load() {
    const loader = new THREE.TextureLoader();
    this.projectors.forEach((pr) => {
      loader.load(pr.url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.anisotropy = 4;
        pr.uniforms.T.value = tex;
        pr.ready.tex = true;
        this.update(pr);
      });
    });
  }
  update(pr) { pr.uniforms.on.value = pr.ready.tex && pr.ready.depth ? 1 : 0; }
  updateActive(cameraPos) {
    for (const pr of this.projectors) {
      const range = pr.name.startsWith('castle_') ? 65 : 115;
      pr.uniforms.on.value = pr.ready.tex && pr.ready.depth &&
        cameraPos.distanceToSquared(pr.cam.position) < range * range ? 1 : 0;
    }
  }

  // Render each projector's depth from only the static world (no fish, no mermaids).
  bakeDepth(staticRoots) {
    const r = this.renderer, keep = new Set(staticRoots);
    const hidden = [];
    this.scene.children.forEach((o) => { if (!keep.has(o) && o.visible && !o.isLight) { o.visible = false; hidden.push(o); } });
    // the open-water dome must not count as geometry the painter saw
    const skies = [];
    staticRoots.forEach((root) => root.traverse((o) => { if ((o.userData.sky || o.userData.surface) && o.visible) { o.visible = false; skies.push(o); } }));
    const prevTarget = r.getRenderTarget();
    // a plain depth material, so no projected material samples the depth map it is writing
    const prevOverride = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.depthMat || (this.depthMat = new THREE.MeshDepthMaterial());
    for (const pr of this.projectors) {
      r.setRenderTarget(pr.rt);
      r.clear();
      r.render(this.scene, pr.cam);
      pr.ready.depth = true;
      this.update(pr);
    }
    this.scene.overrideMaterial = prevOverride;
    r.setRenderTarget(prevTarget);
    hidden.forEach((o) => { o.visible = true; });
    skies.forEach((o) => { o.visible = true; });
  }

  // Add the projection to a static-world material.
  apply(material, projectors = this.projectors) {
    const N = projectors.length;
    const uniforms = { uPaintAmt: this.amount, uPNear: this.near, uPFar: this.far };
    let head = 'uniform float uPaintAmt; uniform float uPNear; uniform float uPFar;\n';
    let body = '';
    projectors.forEach((pr, i) => {
      uniforms[`uPM${i}`] = pr.uniforms.M; uniforms[`uPP${i}`] = pr.uniforms.P;
      uniforms[`uPT${i}`] = pr.uniforms.T; uniforms[`uPD${i}`] = pr.uniforms.D; uniforms[`uPOn${i}`] = pr.uniforms.on;
      head += `uniform mat4 uPM${i}; uniform vec3 uPP${i}; uniform sampler2D uPT${i}; uniform sampler2D uPD${i}; uniform float uPOn${i};\n`;
      body += `if (uPOn${i} > 0.5) projSample(uPM${i}, uPP${i}, uPT${i}, uPD${i}, pAcc, pW, pMax, pD);\n`;
    });
    head += /* glsl */`
      float pLin(float d) { float z = d * 2.0 - 1.0; return (2.0 * uPNear * uPFar) / (uPFar + uPNear - z * (uPFar - uPNear)); }
      void projSample(mat4 M, vec3 P, sampler2D T, sampler2D D, inout vec3 acc, inout float wsum, inout float wmax, inout float dsum) {
        vec4 c = M * vec4(vWPos, 1.0);
        if (c.w <= 0.0) return;
        vec3 n = c.xyz / c.w;
        vec2 uv = n.xy * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return;
        float ld = pLin(n.z * 0.5 + 0.5);
        float ls = pLin(texture2D(D, uv).r);
        if (ld > ls * 1.015 + 0.25) return; // hidden from the painting's camera
        vec3 toP = normalize(P - vWPos);
        float facing = abs(dot(normalize(vWNormal), toP));
        float w = smoothstep(0.05, 0.4, facing);
        vec2 e = min(uv, 1.0 - uv);
        w *= smoothstep(0.0, 0.05, e.x) * smoothstep(0.0, 0.05, e.y);
        w *= 1.0 - smoothstep(55.0, 110.0, ld); // far backgrounds rarely match the painting
        // stretch guard: fade when we look at the surface from far off the painter's axis
        float off = dot(normalize(cameraPosition - vWPos), toP);
        w *= smoothstep(0.45, 0.85, off);
        // only near where the painting was made: elsewhere the painted textures carry the look
        w *= 1.0 - smoothstep(15.0, 50.0, distance(cameraPosition, P));
        if (w <= 0.0) return;
        wmax = max(wmax, w);
        w *= exp(-distance(cameraPosition, P) / 40.0); // prefer the painting made nearest to us
        acc += texture2D(T, uv).rgb * w; wsum += w; dsum += ld * w;
      }
    `;
    inject(material, {
      key: 'proj' + N,
      uniforms,
      fragmentHead: head,
      // After fog: the painting already holds the haze seen from its camera, so we only
      // add the extra haze for being farther away than the painter was.
      fragment: `{ vec3 pAcc = vec3(0.0); float pW = 0.0; float pMax = 0.0; float pD = 0.0;
        ${body}
        if (pW > 0.0) {
          vec3 pc = linearToOutputTexel(vec4(pAcc / pW, 1.0)).rgb;
          #ifdef USE_FOG
          #ifdef FOG_EXP2
          float dNow = length(vWPos - cameraPosition), dPaint = pD / pW;
          float fNow = 1.0 - exp(-fogDensity * fogDensity * dNow * dNow);
          float fPaint = 1.0 - exp(-fogDensity * fogDensity * dPaint * dPaint);
          pc = mix(pc, fogColor, clamp((fNow - fPaint) / max(1.0 - fPaint, 1e-3), 0.0, 1.0));
          #endif
          #endif
          gl_FragColor.rgb = mix(gl_FragColor.rgb, pc, clamp(pMax, 0.0, 1.0) * uPaintAmt);
        } }`,
    });
  }

  // Open water behind everything: look the painting up by view direction, only where
  // the painting's camera saw open water too, and only near where it was painted.
  applySky(material, dirExpr = 'vDir', surface = false) {
    const u = material.uniforms;
    u.uPaintAmt = this.amount; u.uPNear = this.near; u.uPFar = this.far;
    let head = 'uniform float uPaintAmt; uniform float uPNear; uniform float uPFar;\n';
    let body = '';
    this.projectors.forEach((pr, i) => {
      // Castle plates paint masonry and floor. Their bright painted water is
      // viewpoint-specific and would form a rectangle on the open-water dome.
      if (pr.name === 'city' || pr.name === 'palace' || pr.name.startsWith('castle_')) return;
      u[`uPM${i}`] = pr.uniforms.M; u[`uPP${i}`] = pr.uniforms.P; u[`uPT${i}`] = pr.uniforms.T;
      u[`uPD${i}`] = pr.uniforms.D; u[`uPOn${i}`] = pr.uniforms.on;
      head += `uniform mat4 uPM${i}; uniform vec3 uPP${i}; uniform sampler2D uPT${i}; uniform sampler2D uPD${i}; uniform float uPOn${i};\n`;
      body += `if (uPOn${i} > 0.5) skySample(uPM${i}, uPP${i}, uPT${i}, uPD${i}, pAcc, pW, pMax);\n`;
    });
    head += /* glsl */`
      void skySample(mat4 M, vec3 P, sampler2D T, sampler2D D, inout vec3 acc, inout float wsum, inout float wmax) {
        vec4 c = M * vec4(P + normalize(${dirExpr}) * 1000.0, 1.0);
        if (c.w <= 0.0) return;
        vec2 uv = c.xy / c.w * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return;
        // soft mask of where the painter saw open water (no geometry in its depth map)
        float open = 0.0;
        for (int k = 0; k < 9; k++) {
          vec2 o = vec2(float(k - (k / 3) * 3) - 1.0, float(k / 3) - 1.0) * 0.04;
          open += step(0.9999, texture2D(D, clamp(uv + o, 0.0, 1.0)).r);
        }
        float w = smoothstep(6.0, 9.0, open);
        vec2 e = min(uv, 1.0 - uv);
        w *= smoothstep(0.0, 0.22, e.x) * smoothstep(0.0, 0.22, e.y);
        float dc = distance(cameraPosition, P);
        w *= 1.0 - smoothstep(30.0, 100.0, dc);
        if (w <= 0.0) return;
        wmax = max(wmax, w);
        w *= exp(-dc / 25.0); // the nearest painting wins where several overlap
        acc += texture2D(T, uv).rgb * w; wsum += w; wmax = max(wmax, w);
      }
    `;
    const sample = `vec3 pAcc = vec3(0.0); float pW = 0.0; float pMax = 0.0;\n${body}`;
    const fs = material.fragmentShader.replace('void main(){', head + '\nvoid main(){');
    material.fragmentShader = surface
      // the rippling surface thins out where the painting's open water shows through
      ? fs.replace('#include <colorspace_fragment>', `{ ${sample} gl_FragColor.a *= 1.0 - clamp(pMax, 0.0, 1.0) * uPaintAmt * 0.85; }\n#include <colorspace_fragment>`)
      : fs.replace('gl_FragColor = vec4(c, 1.0);', `${sample}
        if (pW > 0.0) c = mix(c, pAcc / pW, clamp(pMax, 0.0, 1.0) * uPaintAmt);
        gl_FragColor = vec4(c, 1.0);`);
    material.needsUpdate = true;
  }

  applyTo(root, zone = null) {
    // Keep mobile shader sampler counts below WebGL's common 16-unit limit.
    const views = zone === 'castle'
      ? this.projectors.filter((pr) => pr.name === 'city' || pr.name === 'palace' || pr.name.startsWith('castle_'))
      : zone === 'world'
        ? this.projectors.filter((pr) => !['city', 'palace'].includes(pr.name) && !pr.name.startsWith('castle_'))
        : this.projectors;
    const seen = new Set();
    root.traverse((o) => {
      if (!o.isMesh || !o.material || seen.has(o.material)) return;
      const m = o.material;
      if (o.userData.sky) { seen.add(m); this.applySky(m); return; }
      if (o.userData.surface) { seen.add(m); this.applySky(m, 'vW - cameraPosition', true); return; }
      if (m.isShaderMaterial || m.isMeshBasicMaterial || m.blending === THREE.AdditiveBlending) return;
      seen.add(m);
      this.apply(m, views);
    });
  }
}
