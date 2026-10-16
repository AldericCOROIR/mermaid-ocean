// Post-processing in one full-screen pass:
//  * depth of field focused on the mermaid (background & foreground melt away)
//  * a painterly Kuwahara filter (flat brush-stroke regions, soft edges)
//  * soft ink outlines from depth edges, paper grain, underwater grade, vignette
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uFocus, uTime;
uniform float uPaint;   // 0..1 painterly strength
uniform float uDof;     // max blur radius in px
uniform float uDepthY;  // camera depth below surface, 0..1

float linDepth(vec2 uv){
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 kuwahara(vec2 uv, vec2 px){
  // 4 overlapping 3x3 quadrants (radius 2): pick the mean with lowest variance
  vec3 m[4]; vec3 s[4];
  for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec3 c = texture2D(tColor, uv + vec2(float(i), float(j)) * px).rgb;
      vec3 c2 = c * c;
      if (i <= 0 && j <= 0) { m[0] += c; s[0] += c2; }
      if (i >= 0 && j <= 0) { m[1] += c; s[1] += c2; }
      if (i <= 0 && j >= 0) { m[2] += c; s[2] += c2; }
      if (i >= 0 && j >= 0) { m[3] += c; s[3] += c2; }
    }
  }
  vec3 best = m[0] / 9.0; float bestV = 1e9;
  for (int k = 0; k < 4; k++) {
    vec3 mean = m[k] / 9.0;
    vec3 v = abs(s[k] / 9.0 - mean * mean);
    float vv = v.r + v.g + v.b;
    if (vv < bestV) { bestV = vv; best = mean; }
  }
  return best;
}

void main(){
  vec2 px = 1.0 / uRes;
  float d = linDepth(vUv);

  // circle of confusion: far blur grows slowly, near blur quickly
  float far = smoothstep(uFocus * 1.8, uFocus * 14.0, d);
  float near = 1.0 - smoothstep(uFocus * 0.25, uFocus * 0.6, d);
  float coc = clamp(max(far, near * 0.9), 0.0, 1.0);

  vec3 sharp = uPaint > 0.01 ? kuwahara(vUv, px * (1.0 + uPaint * 1.6)) : texture2D(tColor, vUv).rgb;

  vec3 col = sharp;
  if (uDof > 0.0 && coc > 0.02) {
    vec3 acc = vec3(0.0); float wsum = 0.0;
    float r = coc * uDof;
    for (int i = 0; i < 16; i++) {
      float fi = float(i);
      float a = fi * 2.39996;
      float rr = sqrt((fi + 0.5) / 16.0) * r;
      vec2 o = vec2(cos(a), sin(a)) * rr * px;
      vec3 c = texture2D(tColor, vUv + o).rgb;
      float w = 1.0 + dot(c, vec3(0.6)) * 0.6; // brighter samples bloom a little
      acc += c * w; wsum += w;
    }
    col = mix(sharp, acc / wsum, smoothstep(0.0, 0.5, coc));
  }

  // ink outline where depth jumps (only in the in-focus zone)
  if (uPaint > 0.01) {
    float dl = linDepth(vUv - vec2(px.x, 0.0)), dr = linDepth(vUv + vec2(px.x, 0.0));
    float du = linDepth(vUv + vec2(0.0, px.y)), dd = linDepth(vUv - vec2(0.0, px.y));
    float edge = abs(dl + dr + du + dd - 4.0 * d) / max(d, 0.001);
    float ink = smoothstep(0.05, 0.25, edge) * (1.0 - coc) * smoothstep(60.0, 8.0, d);
    col = mix(col, col * vec3(0.35, 0.4, 0.6), ink * 0.55 * uPaint);
  }

  // underwater grade: lift shadows to blue, warm the highlights, deeper = moodier
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), -0.18);               // saturate
  col += vec3(0.0, 0.03, 0.06) * (1.0 - lum);
  col *= mix(vec3(1.0), vec3(0.75, 0.85, 1.05), uDepthY);

  // paper / canvas grain
  if (uPaint > 0.01) {
    vec2 g = vUv * uRes;
    float grain = hash(floor(g * 0.5)) * 0.5 + hash(floor(g * 0.125)) * 0.5;
    float canvas = sin(g.x * 1.1) * sin(g.y * 1.1);
    col *= 1.0 + (grain - 0.5) * 0.05 * uPaint + canvas * 0.012 * uPaint;
  }

  // vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.55;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.scale = 1;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 0, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace });
    this.rt.depthTexture = new THREE.DepthTexture(4, 4);
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uRes: { value: new THREE.Vector2() },
        uNear: { value: 0.1 }, uFar: { value: 1000 }, uFocus: { value: 7 }, uTime: { value: 0 },
        uPaint: { value: 1 }, uDof: { value: 7 }, uDepthY: { value: 0 },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(w, h, pixelRatio) {
    const W = Math.max(1, Math.floor(w * pixelRatio * this.scale)), H = Math.max(1, Math.floor(h * pixelRatio * this.scale));
    this.rt.setSize(W, H);
    this.mat.uniforms.uRes.value.set(W, H);
  }

  render(scene, camera, focus, depthY, t) {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, camera); return; }
    const u = this.mat.uniforms;
    u.uNear.value = camera.near; u.uFar.value = camera.far; u.uFocus.value = focus; u.uTime.value = t; u.uDepthY.value = depthY;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}
