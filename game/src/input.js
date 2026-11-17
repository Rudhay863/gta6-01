// input.js — keyboard and mouse state, read fresh every frame by the game loop.
// Keys are tracked by e.code so WASD and arrows both work; mouse position is
// kept in canvas pixels for aiming and for menu clicks.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since the last frame was consumed
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  // WASD or arrow keys as a -1..1 pair.
  moveAxes() {
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) -
      (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const y = (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0) -
      (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  // Clear the per-frame "pressed" set; called once per frame by the loop.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
