// Six chained missions: briefing, objective steps, payout, victory.
// Step engine: goto / enterCar / stealCar / pickup / deliver / deliverTimed /
// killAll / escape. Each step is checked against the real world state.
import { MISSION_DEFS, PLACES } from './config.js';
import { createCar } from './vehicles.js';
import { addWanted } from './police.js';
import { spawnEnemies } from './combat.js';

export function createMissions() {
  return {
    index: 0, stepIdx: 0, active: false,
    timer: 0, timerMax: 0, halfFlag: false,
    message: '', messageT: 0,
    completeFlash: 0, lastPayout: 0, lastTitle: '',
    failed: null, failedT: 0,
    victory: false,
  };
}

export function currentDef(m) {
  return m.index >= 0 && m.index < MISSION_DEFS.length ? MISSION_DEFS[m.index] : null;
}

export function currentStep(m) {
  const def = currentDef(m);
  return def ? def.steps[m.stepIdx] : null;
}

export function objectiveText(m) {
  if (m.victory) return 'Free roam — Velor Bay is yours';
  const step = currentStep(m);
  if (!step) return '';
  let text = step.text;
  if (step.type === 'killAll') {
    const left = m.enemiesLeft ?? step.count;
    text = `Deal with the collectors (${step.count - left}/${step.count})`;
  }
  if (m.timer > 0 && (step.type === 'deliverTimed' || step.type === 'pickup')) {
    text += ` — ${Math.ceil(m.timer)}s`;
  }
  return text;
}

export function missionMarker(m, S) {
  const step = currentStep(m);
  if (!step || !step.at) return null;
  if (step.type === 'killAll') return { x: PLACES.debtSpot.x, y: PLACES.debtSpot.y };
  if (step.type === 'escape') {
    return m.index === 5 ? { x: PLACES.safehouse.x, y: PLACES.safehouse.y } : null;
  }
  return step.at;
}

function spawnMissionCar(S, type, x, y, tag) {
  const car = createCar(type, x, y, -Math.PI / 2, { owner: 'mission', missionCar: true });
  car.missionTag = tag;
  car.wasCivilian = false;
  S.cars.push(car);
  return car;
}

function setupStep(m, S) {
  const step = currentStep(m);
  if (!step) return;
  const def = currentDef(m);
  if (step.type === 'enterCar' && step.car === 'mission') {
    if (!S.cars.some((c) => c.missionTag === 'mission')) {
      spawnMissionCar(S, 'sedan', PLACES.garage.x + 40, PLACES.garage.y, 'mission');
    }
  } else if (step.type === 'enterCar' && step.car === 'taxi') {
    if (!S.cars.some((c) => c.missionTag === 'taxi')) {
      spawnMissionCar(S, 'taxi', PLACES.taxiStand.x + 40, PLACES.taxiStand.y, 'taxi');
    }
  } else if (step.type === 'stealCar' && step.car === 'sports') {
    if (!S.cars.some((c) => c.missionTag === 'sports')) {
      const car = createCar('sports', PLACES.repoSpot.x + 40, PLACES.repoSpot.y, 0, { owner: 'civilian' });
      car.missionTag = 'sports';
      car.wasCivilian = true; // stealing the repo target raises wanted, like any theft
      S.cars.push(car);
    }
  } else if (step.type === 'killAll') {
    if (S.combat.enemies.length === 0) {
      spawnEnemies(S.combat, S.rng, PLACES.debtSpot.x, PLACES.debtSpot.y, step.count);
    }
    m.enemiesLeft = step.count;
  } else if (step.type === 'pickup' && step.timed) {
    m.timer = step.timed; m.timerMax = step.timed;
  } else if (step.type === 'deliverTimed') {
    if (m.timer <= 0) { m.timer = step.time; m.timerMax = step.time; }
  }
  m.message = `${def.title} — ${step.text}`;
  m.messageT = 4;
}

export function startMission(m, idx, S) {
  m.index = idx;
  m.stepIdx = 0;
  m.active = true;
  m.timer = 0; m.halfFlag = false;
  m.failed = null;
  setupStep(m, S);
}

function advance(m, S) {
  m.stepIdx += 1;
  const def = currentDef(m);
  if (m.stepIdx >= def.steps.length) {
    completeMission(m, S);
    return;
  }
  setupStep(m, S);
}

function completeMission(m, S) {
  const def = currentDef(m);
  let payout = def.payout;
  if (def.id === 3 && S.player.inCar && S.player.inCar.hp < 50) payout = Math.floor(payout / 2);
  S.player.money += payout;
  S.stats.moneyEarned += payout;
  S.stats.missionsDone += 1;
  m.lastPayout = payout;
  m.lastTitle = def.title;
  m.completeFlash = 5;
  m.active = false;
  if (m.index >= MISSION_DEFS.length - 1) {
    m.victory = true;
    m.index = -1;
  } else {
    m.index += 1;
    m.stepIdx = 0;
    setupStep(m, S);
    m.active = true;
  }
}

function failMission(m, S, reason) {
  m.failed = reason;
  m.failedT = 4;
  m.timer = 0;
  // Restart the same mission fresh.
  m.stepIdx = 0;
  setupStep(m, S);
}

function distTo(p, at) { return Math.hypot(p.x - at.x, p.y - at.y); }

export function updateMissions(m, dt, S, audio) {
  const events = [];
  if (m.messageT > 0) m.messageT -= dt;
  if (m.failedT > 0) m.failedT -= dt;
  if (m.completeFlash > 0) m.completeFlash -= dt;
  if (!m.active || m.victory) return events;
  const step = currentStep(m);
  if (!step) return events;
  const p = S.player;

  // Timed steps count down.
  if ((step.type === 'deliverTimed' || (step.type === 'pickup' && step.timed)) && m.timer > 0) {
    m.timer -= dt;
    if (step.type === 'deliverTimed' && !m.halfFlag && m.timer < m.timerMax / 2) {
      m.halfFlag = true;
      addWanted(S.police, 2, 'hot-cargo-tip');
      m.message = 'Tipped off! Police are on you — keep driving!';
      m.messageT = 4;
      audio.jingle(false);
    }
    if (m.timer <= 0) {
      failMission(m, S, 'Time ran out — the cargo went cold.');
      events.push({ type: 'failed', reason: m.failed });
      return events;
    }
  }

  let done = false;
  switch (step.type) {
    case 'goto':
      done = distTo(p, step.at) < 70;
      break;
    case 'enterCar':
      if (p.inCar) {
        if (step.car === 'any') done = true;
        else done = p.inCar.missionTag === step.car;
      }
      break;
    case 'stealCar':
      if (p.inCar) {
        if (step.car === 'any') done = !!p.inCar.wasCivilian;
        else done = p.inCar.missionTag === step.car;
      }
      break;
    case 'pickup':
      if (step.onFoot) done = !p.inCar && distTo(p, step.at) < 70;
      else done = distTo(p, step.at) < 80;
      if (done && m.index === 5) addWanted(S.police, 4, 'bank-score'); // grab the cash, trip the alarm
      break;
    case 'deliver':
      done = !!p.inCar && distTo(p, step.at) < 100;
      break;
    case 'deliverTimed':
      done = !!p.inCar && distTo(p, step.at) < 100;
      if (done) m.timer = 0;
      break;
    case 'killAll': {
      const left = S.combat.enemies.filter((e) => e.hp > 0).length;
      m.enemiesLeft = left;
      if (left === 0) {
        done = true;
        if (m.index === 4) addWanted(S.police, 3, 'debt-collector');
      }
      break;
    }
    case 'escape':
      if (m.index === 4) {
        done = !!p.inCar && distTo(p, PLACES.debtSpot) > 600;
      } else {
        done = distTo(p, PLACES.safehouse) < 100;
      }
      break;
    default:
      break;
  }
  if (done) {
    audio.blip();
    const wasLast = m.stepIdx >= currentDef(m).steps.length - 1;
    advance(m, S);
    events.push({ type: 'step' });
    if (wasLast) {
      audio.jingle(true);
      events.push({ type: 'missionComplete', title: m.lastTitle, payout: m.lastPayout });
      if (m.victory) events.push({ type: 'victory' });
    }
  }
  return events;
}
