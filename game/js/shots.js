// Deterministic ?shot= scenes. Each one starts from a fresh world, plays
// the real rules through a simple autopilot, and sets window.__shotReady
// after two paints so the screenshot tool knows the frame is settled.
//   ?shot=title   — the title screen
//   ?shot=drive   — driving down the main avenue with traffic + HUD
//   ?shot=wanted  — a 3-star chase with interceptors and lightbars
//   ?shot=mission — the Mission Complete panel with payout + stats
import { CFG } from './config.js';

export function setupShot(game, shot) {
  const S = game.S;
  const VB = game.VB;
  if (shot === 'title') {
    S.setScreen('title');
    window.__shotReady = true;
    return;
  }
  // Every other scene plays from a started run.
  VB.start(true);
  if (shot === 'drive') {
    // Put Kai in the mission car and cruise down the avenue.
    VB.teleport(S.city.locations.garage.x + 40, S.city.locations.garage.y);
    VB.enterNearestCar();
    VB.goTo(2600, 640);
    const check = setInterval(() => {
      if (VB.carSpeed > 120 || S.time > 14) {
        window.__shotReady = true;
        clearInterval(check);
      }
    }, 150);
    return;
  }
  if (shot === 'wanted') {
    VB.teleport(S.city.locations.garage.x + 40, S.city.locations.garage.y);
    VB.enterNearestCar();
    VB.setWanted(3);
    VB.goTo(1800, 1040);
    const check = setInterval(() => {
      // Wait until at least two interceptors exist AND one is close enough
      // to actually be seen in frame, lights flashing.
      const pl = VB.player;
      const near = VB.police.some((c) => Math.hypot(c.x - pl.x, c.y - pl.y) < 380);
      if ((VB.policeCount >= 2 && near) || S.time > 25) {
        window.__shotReady = true;
        clearInterval(check);
      }
    }, 150);
    return;
  }
  if (shot === 'mission') {
    // Finish mission 1 for real: walk to the garage, take the car.
    S.money = 200;
    S.missionsDone = 0;
    VB.jumpToMission(0);
    VB.teleport(S.city.locations.garage.x, S.city.locations.garage.y + 30);
    // The update loop completes step 1 on proximity; then enter the car.
    const check = setInterval(() => {
      if (S.screen === 'mission') {
        window.__shotReady = true;
        clearInterval(check);
      } else if (S.screen !== 'play') {
        return;
      } else {
        const st = S.missions.currentStep();
        if (st && st.type === 'enterCar') {
          VB.teleport(S.missionCar.x, S.missionCar.y);
          VB.enterNearestCar();
        } else if (st && st.type === 'goto') {
          VB.goTo(st.x, st.y);
        }
      }
      if (S.time > 30) {
        window.__shotReady = true;
        clearInterval(check);
      }
    }, 120);
    return;
  }
  // Unknown shot: fall back to the title screen.
  S.setScreen('title');
}
