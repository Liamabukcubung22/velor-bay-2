// The six-mission chain. Each mission is a list of steps; a step completes
// when the player reaches its marker, enters the right car, or finishes its
// fight. Completing a mission pays out, flashes the jingle, and opens the
// next one. After mission 6 the victory screen appears.
import { CFG } from './config.js';
import { dist } from './random.js';
import { spawnGang } from './combat.js';
import { spawnParkedCar } from './vehicles.js';

export const MISSION_NAMES = [
  'Back in the Bay',
  'Fare Dodger',
  'Repo Run',
  'Hot Cargo',
  'The Debt Collector',
  'The Last Score',
];

export const MISSION_BRIEFS = [
  'Kai is back in Velor Bay. Walk to the garage and take the car waiting for you.',
  'The cab needs a driver. Pick up 3 passengers and drop each one off.',
  'A repo job: steal the target car and deliver it to the garage in one piece.',
  'Hot cargo, cold nerves. Grab the package and deliver it before the timer runs out.',
  'The debt collector is waiting in the alley with friends. Deal with them, then run.',
  'One last score: steal the getaway car, hit the bank, and vanish to the safehouse.',
];

function loc(S, key) {
  return S.city.locations[key];
}

function gotoStep(S, x, y, label, radius) {
  return { type: 'goto', x, y, label, radius: radius || 46, done: false };
}

export function buildMissions(S) {
  const L = S.city.locations;
  const missions = [
    {
      name: MISSION_NAMES[0],
      steps: [
        gotoStep(S, L.garage.x, L.garage.y, 'Walk to the garage'),
        { type: 'enterCar', label: 'Take the mission car', done: false },
      ],
    },
    {
      name: MISSION_NAMES[1],
      steps: [
        gotoStep(S, 1040, 240, 'Pick up passenger 1'),
        gotoStep(S, 2240, 640, 'Drop off passenger 1'),
        gotoStep(S, 640, 1440, 'Pick up passenger 2'),
        gotoStep(S, 2640, 1440, 'Drop off passenger 2'),
        gotoStep(S, 1840, 2240, 'Pick up passenger 3'),
        gotoStep(S, 640, 2240, 'Drop off passenger 3'),
      ],
    },
    {
      name: MISSION_NAMES[2],
      steps: [
        { type: 'stealTarget', label: 'Steal the target car', done: false },
        gotoStep(S, L.garage.x, L.garage.y, 'Deliver it to the garage, undamaged', 60),
      ],
    },
    {
      name: MISSION_NAMES[3],
      steps: [
        gotoStep(S, L.cargo.x, L.cargo.y, 'Pick up the cargo at the docks'),
        { type: 'timed', label: 'Deliver before the timer runs out', x: 640, y: 1840, radius: 60, seconds: 95, done: false },
      ],
    },
    {
      name: MISSION_NAMES[4],
      steps: [
        gotoStep(S, L.alley.x, L.alley.y, 'Meet the collector in the alley'),
        { type: 'fight', label: 'Deal with the gang (3)', need: 3, got: 0, done: false },
        { type: 'escape', label: 'Escape to the safehouse', x: L.safehouse.x, y: L.safehouse.y, radius: 60, done: false },
      ],
    },
    {
      name: MISSION_NAMES[5],
      steps: [
        { type: 'stealTarget', label: 'Steal the getaway car', done: false },
        gotoStep(S, L.bank.x, L.bank.y, 'Drive to Velor Bank'),
        { type: 'grabCash', label: 'Grab the cash on foot', x: L.bank.x, y: L.bank.y, radius: 40, done: false },
        { type: 'escape', label: 'Escape to the safehouse — wanted 4', x: L.safehouse.x, y: L.safehouse.y, radius: 60, done: false },
      ],
    },
  ];
  return {
    list: missions,
    index: 0,
    step: 0,
    timer: 0,
    targetCar: null,
    cashTaken: false,

    current() {
      return this.list[this.index] || null;
    },
    currentStep() {
      const m = this.current();
      return m ? m.steps[this.step] || null : null;
    },
    marker() {
      const st = this.currentStep();
      if (!st) return null;
      if (st.type === 'stealTarget') return this.targetCar ? { x: this.targetCar.x, y: this.targetCar.y } : null;
      if (st.type === 'enterCar') return { x: S.missionCar.x, y: S.missionCar.y };
      if (st.x !== undefined) return { x: st.x, y: st.y };
      return null;
    },
    label() {
      const m = this.current();
      if (!m) return 'Free roam — enjoy Velor Bay';
      const st = this.currentStep();
      return (this.index + 1) + '. ' + m.name + ' — ' + (st ? st.label : 'done');
    },

    startMission(S2, i) {
      this.index = i;
      this.step = 0;
      this.timer = 0;
      this.cashTaken = false;
      const m = this.list[i];
      S2.hudFlash('MISSION ' + (i + 1) + ': ' + m.name);
      S2.audio.jingle();
      if (i === 2 || i === 5) {
        // Repo / getaway target car, parked near the docks.
        const car = spawnParkedCar(S2.rng, S2.city, false);
        car.x = 2600;
        car.y = 600;
        car.target = true;
        car.color = '#d8d8d8';
        this.targetCar = car;
        S2.parkedCars.push(car);
      }
      if (i === 3) this.timer = 95;
    },

    completeStep(S2) {
      const st = this.currentStep();
      if (!st) return;
      st.done = true;
      this.step += 1;
      S2.audio.pickup();
      const m = this.current();
      if (m && this.step >= m.steps.length) this.completeMission(S2);
    },

    completeMission(S2) {
      const m = this.current();
      const pay = CFG.payouts[this.index] || 500;
      S2.money += pay;
      S2.stats.earned = (S2.stats.earned || 0) + pay;
      S2.missionsDone = this.index + 1;
      S2.showMissionComplete(m.name, pay);
      S2.audio.jingle();
      S2.saveNow();
      if (this.index >= this.list.length - 1) {
        S2.victoryPending = true;
        return;
      }
      this.startMission(S2, this.index + 1);
    },

    onEnterCar(S2, car) {
      const st = this.currentStep();
      if (!st) return;
      if (st.type === 'enterCar' && car.mission) this.completeStep(S2);
      if (st.type === 'stealTarget' && car.target) {
        this.completeStep(S2);
        if (this.index === 5) S2.addWanted(1, 'getaway car');
      }
    },
    onExitCar(S2, car) {
      const st = this.currentStep();
      if (!st) return;
      if (st.type === 'grabCash' && !S2.player.inCar) {
        // Cash grab happens on foot at the bank (handled in update).
      }
    },
    onKill(S2, e) {
      const st = this.currentStep();
      if (st && st.type === 'fight') {
        st.got = (st.got || 0) + 1;
        if (st.got >= st.need) this.completeStep(S2);
      }
    },

    update(S2, dt) {
      const m = this.current();
      if (!m) return;
      const st = this.currentStep();
      if (!st) return;
      const px = S2.playerCar ? S2.playerCar.x : S2.player.x;
      const py = S2.playerCar ? S2.playerCar.y : S2.player.y;
      if (st.type === 'goto' || st.type === 'escape') {
        if (dist(px, py, st.x, st.y) < st.radius) {
          if (st.type === 'escape' && this.index === 5) {
            // Last escape ends the chain.
          }
          this.completeStep(S2);
        }
      } else if (st.type === 'timed') {
        this.timer -= dt;
        if (this.timer <= 0) {
          S2.hudFlash('TOO SLOW — MISSION FAILED, TRY AGAIN');
          S2.audio.fail();
          this.startMission(S2, this.index);
          return;
        }
        if (dist(px, py, st.x, st.y) < st.radius) this.completeStep(S2);
      } else if (st.type === 'grabCash') {
        if (!S2.player.inCar && dist(S2.player.x, S2.player.y, st.x, st.y) < st.radius) {
          this.cashTaken = true;
          S2.wanted = 4;
          S2.policeCars.length = 0;
          S2.hudFlash('CASH GRABBED — WANTED 4★ — RUN!');
          S2.audio.jingle();
          this.completeStep(S2);
        }
      } else if (st.type === 'fight') {
        if (!st.spawned) {
          st.spawned = true;
          S2.addWanted(2, 'alley fight');
          spawnGang(S2, S2.city.locations.alley.x, S2.city.locations.alley.y, 3, 60);
        }
      }
      // Mid-mission heat for Hot Cargo.
      if (this.index === 3 && this.step === 1 && !st.heatSet) {
        st.heatSet = true;
        S2.addWanted(2, 'hot cargo');
        S2.hudFlash('HEAT IS ON — WANTED 2★');
      }
      // Mission 5 escape sets wanted 3 when the fight ends.
      if (this.index === 4 && this.step === 2 && !st.heatSet) {
        st.heatSet = true;
        S2.addWanted(1, 'escape');
      }
    },
  };
}
