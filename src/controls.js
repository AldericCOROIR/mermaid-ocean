// Touch controls: a floating joystick on the left, drag anywhere else to
// look around, big up/down/action buttons. Keyboard + mouse on desktop.
export class Controls {
  constructor(canvas) {
    this.move = { x: 0, y: 0 };   // joystick, y = forward
    this.look = { dx: 0, dy: 0 }; // accumulated look delta (pixels)
    this.vertical = 0;            // -1 down .. +1 up
    this.actionPressed = false;
    this.dragging = false;        // user is actively looking around
    this.lastInput = 0;
    this.keys = new Set();
    this.enabled = true;

    const zone = document.getElementById('joyZone');
    const joy = document.getElementById('joy');
    const knob = document.getElementById('joyKnob');
    let joyId = null, joyX = 0, joyY = 0;
    const R = 60;

    zone.addEventListener('pointerdown', (e) => {
      if (joyId !== null) return;
      joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY;
      zone.setPointerCapture(e.pointerId);
      joy.style.left = joyX + 'px'; joy.style.top = joyY + 'px';
      joy.classList.remove('hidden');
      knob.style.transform = '';
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - joyX, dy = e.clientY - joyY;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.move.x = dx / R; this.move.y = -dy / R;
      this.lastInput = performance.now();
    });
    const endJoy = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; this.move.x = 0; this.move.y = 0;
      joy.classList.add('hidden');
    };
    zone.addEventListener('pointerup', endJoy);
    zone.addEventListener('pointercancel', endJoy);

    // look: drag on the canvas (anything not a button / joystick)
    const lookers = new Map();
    canvas.addEventListener('pointerdown', (e) => {
      lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      this.dragging = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      const l = lookers.get(e.pointerId);
      if (!l) return;
      this.look.dx += e.clientX - l.x; this.look.dy += e.clientY - l.y;
      l.x = e.clientX; l.y = e.clientY;
      this.lastInput = performance.now();
    });
    const endLook = (e) => { lookers.delete(e.pointerId); this.dragging = lookers.size > 0; };
    canvas.addEventListener('pointerup', endLook);
    canvas.addEventListener('pointercancel', endLook);

    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('on'); on(); });
      const up = () => { el.classList.remove('on'); off(); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };
    hold('btnUp', () => { this.vertical = 1; }, () => { if (this.vertical > 0) this.vertical = 0; });
    hold('btnDown', () => { this.vertical = -1; }, () => { if (this.vertical < 0) this.vertical = 0; });
    hold('btnAct', () => { this.actionPressed = true; }, () => {});

    window.addEventListener('keydown', (e) => { this.keys.add(e.code); if (e.code === 'Space' || e.code === 'Enter') this.actionPressed = true; });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // Merge keyboard into the joystick values; call once per frame.
  poll() {
    const k = this.keys;
    if (k.size) {
      const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      if (x || y) { this.move.x = x; this.move.y = y; this._kb = true; this.lastInput = performance.now(); }
      else if (this._kb) { this.move.x = 0; this.move.y = 0; this._kb = false; }
      const v = (k.has('KeyE') || k.has('PageUp') ? 1 : 0) - (k.has('KeyQ') || k.has('PageDown') || k.has('ShiftLeft') ? 1 : 0);
      if (v) { this.vertical = v; this._kbv = true; } else if (this._kbv) { this.vertical = 0; this._kbv = false; }
    } else if (this._kb || this._kbv) { this.move.x = 0; this.move.y = 0; this.vertical = 0; this._kb = this._kbv = false; }
  }

  consumeLook() { const l = { ...this.look }; this.look.dx = 0; this.look.dy = 0; return l; }
  consumeAction() { const a = this.actionPressed; this.actionPressed = false; return a; }
}
