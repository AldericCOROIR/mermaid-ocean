// The player's mermaid: swimming physics, bubble flight above the waves, and the follow camera.
import * as THREE from 'three';
import { WORLD, BAY, TUNNEL, tunnelInfo, groundHeight, damp, bubbleTexture } from './util.js';
import { houseLimit, houseCamera } from './bay.js';
import { MerModel, PALETTES } from './mermaid.js';
import { collide } from './world.js';
import { castleFloorHeight } from './city.js';
import { canDive, bubbleModel, SKY_LIMIT, WORLD_EDGE } from './surface.js';

const SPEED = 9, DASH = 22, FLY = 13, FLY_DASH = 26;

export class Player {
  constructor(scene, camera) {
    this.model = new MerModel(PALETTES.player);
    this.model.root.rotation.order = 'YXZ';
    scene.add(this.model.root);
    this.position = this.model.root.position;
    this.position.copy(WORLD.start);
    this.velocity = new THREE.Vector3();
    this.camera = camera;
    this.yaw = Math.PI; // camera yaw: looking toward -z (the city)
    this.pitch = -0.12;
    this.dist = 7;
    this.facing = Math.PI;
    this.dash = 0;
    this.airborne = false;
    this.flying = false; // in her magic bubble, above the waves
    this.bubble = bubbleModel(); this.bubble.visible = false;
    scene.add(this.bubble);
    this.surface = null; // set by main: islands, floors and walls above the sea
    this.camPos = new THREE.Vector3();
    this.focusDist = 7;
    this.trail = this.makeTrail(scene);
    this.splashCb = null;
    this.snapCamera();
  }

  makeTrail(scene) {
    const N = 40;
    const pos = new Float32Array(N * 3).fill(-9999);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ map: bubbleTexture(), size: 0.35, transparent: true, depthWrite: false });
    const pts = new THREE.Points(geo, m);
    pts.frustumCulled = false;
    scene.add(pts);
    return { pos, geo, i: 0, acc: 0, life: new Float32Array(N) };
  }

  forward() {
    return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  snapCamera() {
    const f = this.forward();
    this.camPos.copy(this.position).addScaledVector(f, -this.dist).add(new THREE.Vector3(0, 1.2, 0));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.position.x, this.position.y + 0.8, this.position.z);
  }

  update(dt, controls, frozen = false) {
    // ---- look ----
    const look = controls.consumeLook();
    const lookSpeed = 0.0055;
    this.yaw -= look.dx * lookSpeed;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.dy * lookSpeed * 0.8, -1.25, 1.1);

    const mv = frozen ? { x: 0, y: 0 } : controls.move;
    const vert = frozen ? 0 : controls.vertical;
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));

    // auto-follow: when swimming and not dragging, ease the camera behind her
    if (mag > 0.1 && !controls.dragging && Math.abs(mv.x) > 0.25) {
      let d = this.facing - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 0.9 * Math.abs(mv.x));
    }

    // ---- swim ----
    const camF = this.forward();
    const camR = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const wish = new THREE.Vector3()
      .addScaledVector(camF, mv.y)
      .addScaledVector(camR, mv.x);
    // joystick back means turn around, not moonwalk: keep the pitch of forward only
    wish.y = camF.y * Math.max(mv.y, 0) * 0.9 + vert;
    if (wish.lengthSq() > 1) wish.normalize();
    if (this.dash > 0) this.dash -= dt;
    const top = this.flying ? (this.dash > 0 ? FLY_DASH : FLY) : (this.dash > 0 ? DASH : SPEED);

    if (!this.airborne) {
      const target = wish.multiplyScalar(top);
      if (this.dash > 0 && wish.lengthSq() < 0.01) target.copy(this.dirFacing()).multiplyScalar(DASH);
      this.velocity.x = damp(this.velocity.x, target.x, 3, dt);
      this.velocity.y = damp(this.velocity.y, target.y, 3, dt);
      this.velocity.z = damp(this.velocity.z, target.z, 3, dt);
    } else {
      this.velocity.y -= 22 * dt; // gravity in the air
    }
    this.position.addScaledVector(this.velocity, dt);

    // ---- world limits ----
    const tin = tunnelInfo(this.position);
    this.inTunnel = tin.inside;
    if (tin.inside) {
      // inside the secret tunnel: the round walls are the only limit
      const lim = TUNNEL.radius - 1.1;
      if (tin.dist > lim) this.position.sub(tin.center).multiplyScalar(lim / tin.dist).add(tin.center);
      this.airborne = false;
    } else if (this.flying) this.limitSky();
    else this.limitOpenWater();
    this.inBay = !this.flying && this.position.z > WORLD.size / 2;
    this.bubble.visible = this.flying;
    if (this.flying) { this.bubble.position.copy(this.position); this.bubble.position.y += 0.15; }

    // ---- model orientation & animation ----
    const hv = Math.hypot(this.velocity.x, this.velocity.z);
    const sp = this.velocity.length();
    if (hv > 0.6) {
      const want = Math.atan2(this.velocity.x, this.velocity.z);
      let d = want - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 5);
      this.turn = THREE.MathUtils.clamp(d, -1, 1);
    } else this.turn = 0;
    const root = this.model.root;
    root.rotation.y = this.facing;
    // pitch the whole body up/down while diving or rising
    const pitch = sp > 1 ? -Math.atan2(this.velocity.y, Math.max(hv, 0.001)) * 0.8 * Math.min(1, sp / 4) : 0;
    root.rotation.x = damp(root.rotation.x, this.airborne ? -Math.atan2(this.velocity.y, hv + 0.01) : THREE.MathUtils.clamp(pitch, -1.2, 1.2), 5, dt);
    const swimPose = THREE.MathUtils.clamp(sp / 4, 0, 1);
    this.model.update(dt, Math.min(1, sp / DASH), swimPose, this.turn);

    // ---- bubble trail ----
    const tr = this.trail;
    tr.acc += dt * (2 + sp * 1.5);
    while (tr.acc > 1) {
      tr.acc -= 1;
      const i = tr.i++ % tr.life.length;
      tr.pos[i * 3] = this.position.x + (Math.random() - 0.5) * 0.4;
      tr.pos[i * 3 + 1] = this.position.y + (Math.random() - 0.5) * 0.4;
      tr.pos[i * 3 + 2] = this.position.z + (Math.random() - 0.5) * 0.4;
      tr.life[i] = 2.5;
    }
    for (let i = 0; i < tr.life.length; i++) {
      if (tr.life[i] <= 0) continue;
      tr.life[i] -= dt;
      tr.pos[i * 3 + 1] += dt * 1.6;
      if (tr.life[i] <= 0 || tr.pos[i * 3 + 1] > WORLD.surfaceY) tr.pos[i * 3 + 1] = -9999;
    }
    tr.geo.attributes.position.needsUpdate = true;

    this.updateCamera(dt);
  }

  // Seabed, water surface, map edges, walls and shell-house ceilings (everywhere but the tunnel).
  limitOpenWater() {
    const g = castleFloorHeight(this.position.x, this.position.z, this.position.y);
    if (this.position.y < g + 1.0) { this.position.y = g + 1.0; this.velocity.y = Math.max(0, this.velocity.y); }
    const surf = WORLD.surfaceY - 0.6;
    if (this.position.y > surf) {
      // swim up through the surface: a bubble forms and she flies!
      if (this.velocity.y > 4 && this.surface) { this.startFlying(); return; }
      this.position.y = surf; this.velocity.y = Math.min(0, this.velocity.y);
    }
    if (this.position.z > WORLD.size / 2) {
      // Shipwreck Bay is round, ringed by tall cliffs
      const C = BAY.center, d = Math.hypot(this.position.x - C.x, this.position.z - C.z), lim = BAY.radius - 4;
      if (d > lim) { this.position.x = C.x + (this.position.x - C.x) * lim / d; this.position.z = C.z + (this.position.z - C.z) * lim / d; }
    } else {
      const lim = WORLD.size / 2 - 15;
      this.position.x = THREE.MathUtils.clamp(this.position.x, -lim, lim);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -lim, lim);
    }
    collide(this.position, 1.0);
    if (this.houses) houseLimit(this.position, this.houses);
  }

  startFlying() {
    this.flying = true;
    this.velocity.y = Math.max(this.velocity.y, 8);
    this.splashCb?.(this.position);
    this.flyCb?.(true);
  }

  // In the bubble: the waves, island ground and decks are floors; the sky has a ceiling.
  limitSky() {
    const P = this.position, S = this.surface;
    const lim = WORLD_EDGE;
    P.x = THREE.MathUtils.clamp(P.x, -lim, lim);
    P.z = THREE.MathUtils.clamp(P.z, -lim, lim);
    if (P.y > SKY_LIMIT) { P.y = SKY_LIMIT; this.velocity.y = Math.min(0, this.velocity.y); }
    // dive back into the sea where there is sea to dive into: the bubble pops
    if (P.y < WORLD.surfaceY + 2.6 && this.velocity.y < -1 && canDive(P.x, P.z) && S.land(P.x, P.z) < WORLD.surfaceY - 1) {
      this.flying = false;
      P.y = WORLD.surfaceY - 1.2;
      this.velocity.y = Math.min(this.velocity.y, -4);
      this.splashCb?.(P);
      this.flyCb?.(false);
      return;
    }
    const f = S.floor(P.x, P.z, P.y) + 1.25;
    if (P.y < f) { P.y = f; this.velocity.y = Math.max(0, this.velocity.y); }
    this.indoors = S.limit(P, 1.2);
    collide(P, 1.2);
  }

  dirFacing() { return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); }

  doDash() { this.dash = 0.6; }

  updateCamera(dt) {
    const f = this.forward();
    const target = new THREE.Vector3(this.position.x, this.position.y + 0.9, this.position.z);
    const desired = target.clone().addScaledVector(f, -this.dist);
    desired.y += 0.6;
    if (this.flying && this.surface) {
      const f = this.surface.floor(desired.x, desired.z, desired.y) + 0.8;
      if (desired.y < f) desired.y = f;
      this.surface.camLimit(desired, target);
    } else if (this.inTunnel) {
      // stay inside the tunnel walls
      const ti = tunnelInfo(desired), lim = TUNNEL.radius - 0.9;
      if (ti.dist > lim) desired.sub(ti.center).multiplyScalar(lim / ti.dist).add(ti.center);
    } else {
      // keep the camera above the seabed and below the surface
      const g = groundHeight(desired.x, desired.z) + 0.8;
      if (desired.y < g) desired.y = g;
      if (this.houses) houseCamera(desired, this.position, this.houses);
    }
    if (!this.flying && desired.y > WORLD.surfaceY - 0.3) desired.y = WORLD.surfaceY - 0.3;
    this.camPos.x = damp(this.camPos.x, desired.x, 8, dt);
    this.camPos.y = damp(this.camPos.y, desired.y, 8, dt);
    this.camPos.z = damp(this.camPos.z, desired.z, 8, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target);
    this.focusDist = this.camPos.distanceTo(target);
  }
}
