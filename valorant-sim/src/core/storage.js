import { generateWorld } from './generator.js';
import { uid } from './utils.js';

const SAVES_KEY = 'valorantSim.saves';
const ACTIVE_KEY = 'valorantSim.activeSaveId';

function readSaves() {
  return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]');
}

function writeSaves(saves) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
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
  if (idx >= 0) {
    saves[idx] = world;
  } else {
    saves.push(world);
  }
  writeSaves(saves);
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
