// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens:
// title, play, paused, busted, wasted, victory.
//
// ?seed=N fixes the city. ?shot=drive|title|wanted|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createGame } from './game.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_RESTART, ACTION_EXITCAR } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_VICTORY } from './render.js';
import { stageShot, makePilot } from './shots.js';
import { startMission } from './missions.js';
import { exitCar } from './player.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Max fixed steps per frame — the loop runs game time slower than wall time on a loaded VM. */
const MAX_STEPS = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
const S = game.S;
const renderer = createRenderer(canvas);
const viewW = () => window.innerWidth;
const viewH = () => window.innerHeight;

// Debug / playtest hook (drives the real game through the real loop).
window.__VB = {
  game, S, makePilot,
  debugStartMission: (i) => startMission(S.missions, i, S),
};

function runShot(name) {
  const scene = stageShot(name, game, viewW(), viewH());
  let painted = 0;
  function paint() {
    renderer.draw(S, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  window.__VB.input = input;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) { status.textContent = message; }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (S.screen === SCREEN_TITLE) { game.newGame(); announce('Playing. Mission 1: Back in the Bay.'); }
    }
    if (actions & ACTION_PAUSE) {
      if (S.screen === SCREEN_PLAY) { S.screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (S.screen === SCREEN_PAUSED) { S.screen = SCREEN_PLAY; announce('Playing.'); }
    }
    if (actions & ACTION_INTERACT && S.screen === SCREEN_PLAY) game.handleInteract();
    if (actions & ACTION_EXITCAR && S.screen === SCREEN_PLAY && S.player.inCar) exitCar(S);
    if (actions & ACTION_RESTART) {
      if (S.screen === SCREEN_BUSTED || S.screen === SCREEN_WASTED) { game.newGame(); announce('New run.'); }
      else if (S.screen === SCREEN_VICTORY) { S.screen = SCREEN_PLAY; announce('Free roam.'); }
      else if (S.screen === SCREEN_PAUSED) { game.newGame(); announce('New run.'); }
    }
    if (input.isDown('KeyM')) {
      // Mute toggle is edge-triggered via keydown below; see key handler.
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) {
      S.muted = !S.muted;
      S.audio.setEnabled(!S.muted);
      announce(S.muted ? 'Muted.' : 'Sound on.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (input.takeClick()) {
      S.audio.resume();
      game.handleClick(input.state.mouseX, input.state.mouseY);
    }
    let steps = 0;
    if (S.screen === SCREEN_TITLE) {
      while (accumulator >= STEP && steps < MAX_STEPS) {
        game.stepTitle(STEP, viewW(), viewH());
        accumulator -= STEP; steps += 1;
      }
    } else if (S.screen === SCREEN_PLAY) {
      while (accumulator >= STEP && steps < MAX_STEPS && S.screen === SCREEN_PLAY) {
        game.stepPlay(STEP, input, viewW(), viewH());
        accumulator -= STEP; steps += 1;
      }
      if (steps >= MAX_STEPS) accumulator = 0;
    } else {
      accumulator = 0;
    }
    renderer.draw(S, S.screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.screen === SCREEN_PLAY) {
      S.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Velor Bay. Press Enter or click New Game to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
