// localStorage save / best-stats. Fail-soft: private windows just don't persist.
import { SAVE_KEY, BEST_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    return s;
  } catch { return null; }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function loadBest() {
  try { return JSON.parse(window.localStorage.getItem(BEST_KEY) ?? 'null') || null; } catch { return null; }
}

export function writeBest(best) {
  try { window.localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* ignore */ }
}
