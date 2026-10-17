// A friend from the album who swims along behind the player.
import * as THREE from 'three';
import { MerModel, PALETTES } from './mermaid.js';
import { thumbModel } from './creatures.js';

export class Follower {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.kind = null;
    this.root = null;
    this.t = 0;
  }

  set(kind) {
    if (this.root) { this.scene.remove(this.root); this.root = null; this.mer = null; }
    this.kind = kind || null;
    if (!kind) return;
    let model;
    if (kind === 'mermaid' || kind === 'guard') { this.mer = new MerModel(kind === 'guard' ? PALETTES.guard : PALETTES.coral); model = this.mer.root; }
    else model = thumbModel(kind);
    // every friend becomes a cute companion-sized copy
    const sph = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
    const want = this.mer ? 1.6 : kind === 'whale' ? 2.4 : 1.3;
    const k = want / Math.max(0.2, sph.radius);
    model.scale.multiplyScalar(k);
    model.position.sub(sph.center.multiplyScalar(k));
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    this.inner = model;
    this.root.add(model);
    this.root.position.copy(this.player.position).add(new THREE.Vector3(0, 1, -3));
    this.root.userData.follower = true;
    this.scene.add(this.root);
  }

  update(dt) {
    if (!this.root) return;
    this.t += dt;
    const P = this.player.position;
    const f = this.player.dirFacing();
    const side = new THREE.Vector3(f.z, 0, -f.x);
    const want = P.clone().addScaledVector(f, -3.2).addScaledVector(side, 1.8).add(new THREE.Vector3(0, 0.8 + Math.sin(this.t * 1.6) * 0.3, 0));
    if (this.root.position.distanceTo(P) > 40) this.root.position.copy(want); // left far behind: pop back
    const prev = this.root.position.clone();
    this.root.position.lerp(want, 1 - Math.exp(-2.5 * dt));
    const v = this.root.position.clone().sub(prev);
    const speed = v.length() / Math.max(dt, 1e-3);
    const dir = speed > 0.4 ? v : P.clone().sub(this.root.position);
    let d = Math.atan2(dir.x, dir.z) - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 4);
    if (this.mer) { this.mer.update(dt, Math.min(1, speed / 8), speed > 1 ? 1 : 0); return; }
    const ud = this.inner.userData || {};
    const w = this.t * (4 + Math.min(speed, 10));
    if (ud.tail) ud.tail.rotation.x = Math.sin(w) * 0.4;
    ud.flippers?.forEach((fl, i) => { fl.rotation.z = Math.sin(w + (i > 1 ? 1 : 0)) * 0.5 * (i % 2 ? -1 : 1); });
    ud.arms?.forEach((chain, i) => chain.forEach((s, j) => { s.rotation.z = (j === 0 ? -0.5 : 0) + Math.sin(this.t * 1.5 + i + j * 0.8) * 0.25; }));
    this.inner.rotation.z = Math.sin(this.t * 2) * 0.08;
  }
}
