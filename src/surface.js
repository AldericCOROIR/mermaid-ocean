// Above the waves: the open sea seen from the air, a sunny sky with clouds, and the
// islands. The game switches between this and the underwater look as the camera
// crosses the surface.
import * as THREE from 'three';
import { WORLD, BAY, groundHeight } from './util.js';
import { shared } from './geom.js';

const SEA = WORLD.surfaceY;
export const SKY_LIMIT = SEA + 170; // how high the bubble can float
export const WORLD_EDGE = 820;      // the sea goes on, but the bubble stays near the islands

// Where you can dive: the main undersea world and Shipwreck Bay.
export function canDive(x, z) {
  if (z <= WORLD.size / 2) return Math.abs(x) < WORLD.size / 2 - 15 && Math.abs(z) < WORLD.size / 2 - 15;
  return Math.hypot(x - BAY.center.x, z - BAY.center.z) < BAY.radius - 4;
}
// Seabed that pokes out of the water (rim peaks, the bay cliffs), inside the seabed meshes only.
function seabedTop(x, z) {
  const inMain = Math.abs(x) <= WORLD.size / 2 && Math.abs(z) <= WORLD.size / 2;
  const half = BAY.size / 2;
  const inBay = Math.abs(x - BAY.center.x) <= half && Math.abs(z - BAY.center.z) <= half && z > WORLD.size / 2;
  return inMain || inBay ? groundHeight(x, z) : -Infinity;
}

export function buildSurface(scene) {
  const group = new THREE.Group();
  group.name = 'surface';
  scene.add(group);
  const islands = [];

  // The sea from above: opaque, so the undersea world stays a secret until you dive.
  const seaGeo = new THREE.PlaneGeometry(4000, 4000, 1, 1);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uTime: shared.uTime, uHaze: { value: new THREE.Color(0xcfeeff) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; uniform float uTime; uniform vec3 uHaze;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float wave(vec2 p){ return sin(p.x * 0.11 + uTime * 0.9) * 0.5 + sin(p.y * 0.09 - uTime * 0.7) * 0.5 + sin((p.x + p.y) * 0.05 + uTime * 0.5); }
      void main(){
        vec2 p = vW.xz;
        float w = wave(p) * 0.2 + wave(p * 2.7 + 13.0) * 0.08 + (n(p * 0.04 + uTime * 0.05) - 0.5) * 0.35;
        vec3 deep = vec3(0.07, 0.42, 0.72), light = vec3(0.25, 0.78, 0.92);
        vec3 c = mix(deep, light, 0.45 + w);
        // little sparkles of sun on the waves
        float s = smoothstep(0.82, 0.95, n(p * 0.45 + vec2(uTime * 0.6, -uTime * 0.4)) * n(p * 0.31 - vec2(uTime * 0.3, uTime * 0.5)) * 1.6);
        c += vec3(1.0, 0.97, 0.85) * s * 0.8;
        float d = length(vW.xz - cameraPosition.xz);
        c = mix(c, uHaze, smoothstep(250.0, 1500.0, d));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = SEA + 0.02;
  sea.userData.surface = true;
  seaMat.userData.noPaint = 'animated sea shader';
  sea.onBeforeRender = (r, s, cam) => { sea.position.x = Math.round(cam.position.x / 50) * 50; sea.position.z = Math.round(cam.position.z / 50) * 50; };
  group.add(sea);

  // Sunny sky with soft drifting clouds.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: shared.uTime },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vDir; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        vec3 c = mix(vec3(0.80, 0.93, 1.0), vec3(0.33, 0.62, 0.95), pow(y, 0.55));
        float sun = max(dot(d, normalize(vec3(0.35, 0.75, 0.25))), 0.0);
        c += vec3(1.0, 0.92, 0.7) * (pow(sun, 300.0) * 2.0 + pow(sun, 12.0) * 0.25);
        // clouds painted on the dome above the horizon
        vec2 q = d.xz / (d.y + 0.25) * 2.2 + vec2(uTime * 0.01, 0.0);
        float cl = n(q) * 0.55 + n(q * 2.1) * 0.3 + n(q * 4.3) * 0.15;
        cl = smoothstep(0.55, 0.78, cl) * smoothstep(0.02, 0.2, d.y);
        c = mix(c, vec3(1.0, 0.98, 0.98), cl * 0.9);
        c = mix(c, vec3(0.85, 0.94, 1.0), smoothstep(0.12, -0.05, d.y));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  skyMat.userData.noPaint = 'sky dome';
  const sky = new THREE.Mesh(new THREE.SphereGeometry(950, 32, 16), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10; sky.userData.sky = true;
  sky.onBeforeRender = (r, s, cam) => sky.position.copy(cam.position);
  group.add(sky);

  return {
    group, islands, sea, sky,
    add(island) { islands.push(island); },
    // Highest thing the bubble rests on: island ground, decks, platforms, the waves, seabed peaks.
    floor(x, z, y) {
      let f = Math.max(SEA + 0.9, seabedTop(x, z));
      for (const is of islands) if (Math.hypot(x - is.center.x, z - is.center.z) < is.radius + 40) f = Math.max(f, is.floor(x, z, y));
      return f;
    },
    land(x, z) {
      let f = -Infinity;
      for (const is of islands) if (Math.hypot(x - is.center.x, z - is.center.z) < is.radius + 40) f = Math.max(f, is.height(x, z));
      return f;
    },
    limit(p, r) { let inside = false; for (const is of islands) if (Math.hypot(p.x - is.center.x, p.z - is.center.z) < is.radius + 60) inside = is.limit(p, r) || inside; return inside; },
    camLimit(d, tgt) { for (const is of islands) if (Math.hypot(tgt.x - is.center.x, tgt.z - is.center.z) < is.radius + 60) is.camLimit(d, tgt); },
    // show the right world for where the camera is
    setAbove(above) {
      group.visible = above;
      for (const is of islands) is.group.visible = above;
    },
    update(dt, t) { for (const is of islands) if (is.group.visible) is.update(dt, t); },
  };
}

// The magic bubble around the mermaid while she flies.
export function bubbleModel() {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: shared.uTime, uPop: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uTime;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 2.2);
        vec3 rainbow = 0.6 + 0.4 * cos(6.2831 * (f * 1.3 + vP.y * 0.25 + uTime * 0.15 + vec3(0.0, 0.33, 0.67)));
        float shine = smoothstep(0.92, 1.0, dot(normalize(vN), normalize(vec3(-0.4, 0.6, 0.7))));
        gl_FragColor = vec4(mix(vec3(0.9, 0.97, 1.0), rainbow, 0.7), rim * 0.75 + 0.06 + shine * 0.6);
        #include <colorspace_fragment>
      }`,
  });
  m.userData.noPaint = 'see-through bubble';
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.35, 32, 20), m);
  mesh.renderOrder = 5;
  return mesh;
}
