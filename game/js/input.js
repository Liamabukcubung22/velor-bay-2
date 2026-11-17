// Keyboard + mouse input. Actions are edge-triggered bit flags consumed once per frame.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RESTART = 8;
export const ACTION_EXITCAR = 16;

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    mouseX: 0, mouseY: 0, mouseDown: false, mouseClicked: false,
    actions: 0,
  };
  let codeToAction = {
    Enter: ACTION_CONFIRM, Space: ACTION_CONFIRM,
    KeyP: ACTION_PAUSE, Escape: ACTION_PAUSE,
    KeyE: ACTION_INTERACT, KeyR: ACTION_RESTART, KeyF: ACTION_EXITCAR,
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    const a = codeToAction[e.code];
    if (a) state.actions |= a;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouseX = e.clientX - r.left;
    state.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { state.mouseDown = true; state.mouseClicked = true; }
  });
  window.addEventListener('mouseup', () => { state.mouseDown = false; });

  function dir() {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    return { x, y, run: keys.has('ShiftLeft') || keys.has('ShiftRight'), brake: keys.has('Space') };
  }

  return {
    state,
    dir,
    takeActions() { const a = state.actions; state.actions = 0; return a; },
    takeClick() { const c = state.mouseClicked; state.mouseClicked = false; return c; },
    isDown(code) { return keys.has(code); },
    // Test/debug helpers: the playtest drives the game through these.
    press(code) { keys.add(code); const a = codeToAction[code]; if (a) state.actions |= a; },
    release(code) { keys.delete(code); },
    setMouse(x, y) { state.mouseX = x; state.mouseY = y; },
    click() { state.mouseDown = true; state.mouseClicked = true; },
    releaseMouse() { state.mouseDown = false; },
  };
}
