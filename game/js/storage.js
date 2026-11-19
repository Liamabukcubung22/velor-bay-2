// Save / best-stats persistence in localStorage. A save holds money,
// missions finished, totals and the player's position so Continue can
// drop the player back where they left off.
const SAVE_KEY = 'velorbay-save-v1';

export function defaultSave() {
  return {
    money: 200,
    missionsDone: 0,
    stats: { stolen: 0, kills: 0, busted: 0, wasted: 0, earned: 0, distance: 0 },
    pos: null,
    version: 1,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const base = defaultSave();
    return {
      money: typeof data.money === 'number' ? data.money : base.money,
      missionsDone: typeof data.missionsDone === 'number' ? data.missionsDone : 0,
      stats: { ...base.stats, ...(data.stats || {}) },
      pos: data.pos && typeof data.pos.x === 'number' ? data.pos : null,
      version: 1,
    };
  } catch (err) {
    return null;
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    /* storage unavailable: the game still runs, just without saves */
  }
}
