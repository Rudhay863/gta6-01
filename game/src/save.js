// save.js — localStorage persistence for Solmar Bay: cash, mission progress,
// position and stats. A save is written after every completed mission and from
// the pause menu; Continue on the title screen restores it.

const KEY = 'solmar-bay-save-v1';

export function saveGame(G) {
  try {
    const data = {
      cash: Math.floor(G.player.cash),
      health: G.player.health,
      ammo: G.player.ammo,
      missionIdx: G.missionIdx,
      px: G.player.x,
      py: G.player.y,
      carsStolen: G.stats.carsStolen,
      missionsDone: G.stats.missionsDone,
      stashes: G.city.stashes.map((s) => s.taken),
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIdx !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}

export function hasSave() {
  return loadSave() !== null;
}
