// The player's mermaid: swimming physics, surface leaps, and the follow camera.
import * as THREE from 'three';
import { WORLD, groundHeight, damp, bubbleTexture } from './util.js';
import { MerModel, PALETTES } from './mermaid.js';
import { collide } from './world.js';
import { castleFloorHeight } from './city.js';

const SPEED = 9, DASH = 22;

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
    const top = (this.dash > 0 ? DASH : SPEED);

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
    const g = castleFloorHeight(this.position.x, this.position.z, this.position.y);
    if (this.position.y < g + 1.0) { this.position.y = g + 1.0; this.velocity.y = Math.max(0, this.velocity.y); }
    const surf = WORLD.surfaceY - 0.6;
    if (!this.airborne && this.position.y > surf) {
      if (this.velocity.y > 6) { this.airborne = true; this.velocity.y *= 1.35; this.splashCb?.(this.position); }
      else { this.position.y = surf; this.velocity.y = Math.min(0, this.velocity.y); }
    } else if (this.airborne && this.position.y < surf && this.velocity.y < 0) {
      this.airborne = false; this.velocity.y *= 0.4; this.splashCb?.(this.position);
    }
    const lim = WORLD.size / 2 - 15;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -lim, lim);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -lim, lim);
    collide(this.position, 1.0);

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

  dirFacing() { return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); }

  doDash() { this.dash = 0.6; }

  updateCamera(dt) {
    const f = this.forward();
    const target = new THREE.Vector3(this.position.x, this.position.y + 0.9, this.position.z);
    const desired = target.clone().addScaledVector(f, -this.dist);
    desired.y += 0.6;
    // keep the camera above the seabed and below the surface
    const g = groundHeight(desired.x, desired.z) + 0.8;
    if (desired.y < g) desired.y = g;
    if (desired.y > WORLD.surfaceY + (this.airborne ? 8 : -0.3)) desired.y = WORLD.surfaceY + (this.airborne ? 8 : -0.3);
    this.camPos.x = damp(this.camPos.x, desired.x, 8, dt);
    this.camPos.y = damp(this.camPos.y, desired.y, 8, dt);
    this.camPos.z = damp(this.camPos.z, desired.z, 8, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target);
    this.focusDist = this.camPos.distanceTo(target);
  }
}
