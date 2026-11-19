// Keyboard + mouse state. The game reads keys by name ('KeyW', 'ShiftLeft',
// 'Space', 'ArrowUp' ...) through isDown(); shots and tests can also inject
// keys through the same object, which keeps one input path for everyone.
export function makeInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: consumed by takePressed()
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKey(e, isDown) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (isDown) {
      if (!keys.has(e.code)) pressed.add(e.code);
      keys.add(e.code);
    } else {
      keys.delete(e.code);
    }
  }

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    if (e.button === 0) e.preventDefault();
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  // Keep focus so keyboard works after a click on the canvas.
  canvas.addEventListener('click', () => canvas.focus());

  return {
    keys,
    mouse,
    isDown(code) {
      return keys.has(code);
    },
    anyDown(codes) {
      return codes.some((c) => keys.has(c));
    },
    // Returns true once per physical press.
    takePressed(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    takeClick() {
      if (mouse.clicked) {
        mouse.clicked = false;
        return true;
      }
      return false;
    },
    // Test/debug injection: behaves exactly like a real key.
    injectDown(code) {
      if (!keys.has(code)) pressed.add(code);
      keys.add(code);
    },
    injectUp(code) {
      keys.delete(code);
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
