import { generateWorld } from './generator.js';
import { uid } from './utils.js';

const SAVES_KEY = 'valorantSim.saves';
const ACTIVE_KEY = 'valorantSim.activeSaveId';

function readSaves() {
  return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]');
}

function compactWorldForStorage(world, level = 1) {
  const clone = JSON.parse(JSON.stringify(world));

  // Level 1: trim heavy match logs
  for (const m of clone.schedule || []) {
    if (m.live) {
      // in-progress data can explode quickly; keep only recent context
      m.live.log = (m.live.log || []).slice(-60);
      if (Array.isArray(m.live.maps)) {
        m.live.maps = m.live.maps.map((map) => ({
          ...map,
          rounds: (map.rounds || []).slice(-40),
          ecoSummary: Object.fromEntries(
            Object.entries(map.ecoSummary || {}).map(([k, v]) => [
              k,
              { ...v, creditsByRound: (v.creditsByRound || []).slice(-40) }
            ])
          )
        }));
      }
    }

    if (m.status === 'final' && m.result?.maps) {
      m.result.maps = m.result.maps.map((map) => ({
        ...map,
        rounds: (map.rounds || []).slice(-24),
        ecoSummary: Object.fromEntries(
          Object.entries(map.ecoSummary || {}).map(([k, v]) => [
            k,
            { ...v, creditsByRound: (v.creditsByRound || []).slice(-24) }
          ])
        )
      }));
    }
  }

  if ((clone.messages || []).length > 350) clone.messages = clone.messages.slice(-350);

  if (level >= 2) {
    // Level 2: keep only latest slice of schedule history and message history
    if ((clone.schedule || []).length > 240) clone.schedule = clone.schedule.slice(-240);
    if ((clone.messages || []).length > 180) clone.messages = clone.messages.slice(-180);
    for (const m of clone.schedule || []) {
      if (m.live) {
        m.live.log = (m.live.log || []).slice(-25);
        if (Array.isArray(m.live.maps)) {
          m.live.maps = m.live.maps.map((map) => ({
            ...map,
            rounds: (map.rounds || []).slice(-16)
          }));
        }
      }
    }
  }

  if (level >= 3) {
    // Level 3 emergency: remove heavy round-by-round payloads, keep summaries
    for (const m of clone.schedule || []) {
      if (m.live) {
        m.live.log = (m.live.log || []).slice(-10);
        if (Array.isArray(m.live.maps)) {
          m.live.maps = m.live.maps.map((map) => ({
            ...map,
            rounds: [],
            ecoSummary: {},
            playerStats: map.playerStats || {}
          }));
        }
      }
      if (m.result?.maps) {
        m.result.maps = m.result.maps.map((map) => ({
          ...map,
          rounds: [],
          ecoSummary: {},
          playerStats: map.playerStats || {}
        }));
      }
    }
    if ((clone.messages || []).length > 120) clone.messages = clone.messages.slice(-120);
  }

  return clone;
}

function trySetSerialized(saves) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

function writeSaves(saves) {
  try {
    trySetSerialized(saves);
    return;
  } catch (error) {
    if (error?.name !== 'QuotaExceededError') throw error;
  }

  // Progressive fallback compaction across all saves.
  for (const level of [1, 2, 3]) {
    try {
      const compacted = saves.map((s) => compactWorldForStorage(s, level));
      trySetSerialized(compacted);
      return;
    } catch (error) {
      if (error?.name !== 'QuotaExceededError') throw error;
    }
  }

  // Final emergency fallback: keep only active save (or most recent) at highest compaction.
  const activeId = getActiveSaveId();
  const keep = saves.find((s) => s.id === activeId) || saves[saves.length - 1];
  if (!keep) {
    localStorage.removeItem(SAVES_KEY);
    return;
  }
  const emergency = [compactWorldForStorage(keep, 3)];
  trySetSerialized(emergency);
  setActiveSaveId(keep.id);
}

export function listSaves() {
  return readSaves().map((save) => ({
    id: save.id,
    saveName: save.meta.saveName,
    team: save.teams.find((t) => t.tid === save.userTid)?.name,
    year: save.meta.year,
    mode: save.meta.mode,
    userName: save.meta.userName,
    updatedAt: save.meta.updatedAt || save.meta.createdAt
  }));
}

export function createWorld({ userTid, mode, saveName, userName }) {
  const world = generateWorld({ userTid, mode, saveName, userName });
  const id = uid('save');
  world.id = id;
  world.meta.updatedAt = Date.now();
  const saves = readSaves();
  saves.push(world);
  writeSaves(saves);
  setActiveSaveId(id);
  return world;
}

export function loadSave(id) {
  return readSaves().find((s) => s.id === id) || null;
}

export function saveToSlot(world) {
  const saves = readSaves();
  const idx = saves.findIndex((s) => s.id === world.id);
  world.meta.updatedAt = Date.now();
  if (idx >= 0) saves[idx] = world;
  else saves.push(world);
  writeSaves(saves);
}

export function deleteSave(id) {
  const saves = readSaves().filter((s) => s.id !== id);
  writeSaves(saves);
  if (getActiveSaveId() === id) clearActiveSaveId();
}

export function deleteAllSaves() {
  localStorage.removeItem(SAVES_KEY);
  clearActiveSaveId();
}

export function loadFromSlot() {
  const id = getActiveSaveId();
  if (!id) return null;
  return loadSave(id);
}

export function getActiveSaveId() {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveSaveId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function clearActiveSaveId() {
  localStorage.removeItem(ACTIVE_KEY);
}
