// Boot + fixed-step loop. The loop runs update() at a steady 1/60s and
// renders every animation frame; a slow frame never fast-forwards the
// simulation, it just runs more steps. ?shot= scenes are set up by shots.js
// before the first frame.
import { createGame } from './game.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const game = createGame(canvas, { seed });
const S = game.S;

// Deterministic screenshot scenes (?shot=drive|title|wanted|mission).
if (params.get('shot')) {
  setupShot(game, params.get('shot'));
}

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
let paints = 0;

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    game.update(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 5) acc = 0;
  game.render();
  game.input.endFrame();
  paints++;
  // Without a ?shot= scene the frame is settled after two paints; shot
  // scenes signal readiness themselves once their staging is done.
  if (paints === 2 && !params.get('shot')) window.__shotReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
