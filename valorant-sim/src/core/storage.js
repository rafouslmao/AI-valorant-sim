import { generateWorld } from './generator.js';
import { idbDelete, idbListSlots, idbLoad, idbSave } from './idb.js';
import { uid } from './utils.js';

const LEGACY_SAVES_KEY = 'valorantSim.saves';
const ACTIVE_KEY = 'valorantSim.activeSlot';
const ACTIVE_KEY_LEGACY = 'valorantSim.activeSaveId';
const UI_PREFS_KEY = 'valorantSim.uiPrefs';
const LOCAL_INDEX_KEY = 'valorantSim.localSlots';
const LOCAL_SLOT_PREFIX = 'valorantSim.local.slot.';
const LOCAL_LOG_PREFIX = 'valorantSim.local.logs.';

let migrationPromise = null;
let idbUsable = null;

function emitStorageError(message) {
  window.dispatchEvent(new CustomEvent('storage-error', { detail: message }));
}

function safeParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function estimateSize(raw) {
  return typeof raw === 'string' ? raw.length : 0;
}

function getLocalIndex() {
  const parsed = safeParse(localStorage.getItem(LOCAL_INDEX_KEY), []);
  return asArray(parsed).filter((s) => s && typeof s === 'object' && typeof s.id === 'string');
}

function setLocalIndex(index) {
  localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(asArray(index)));
}

function splitWorldForLocalStorage(world) {
  const copy = structuredClone(world || {});
  const matchLogs = {};
  copy.schedule = (copy.schedule || []).map((m) => {
    if (!m?.result?.maps?.length) return m;
    const lightMaps = [];
    const heavyMaps = [];
    for (const map of m.result.maps) {
      const { rounds, playerStats, keyMoments, ecoSummary, ...rest } = map || {};
      lightMaps.push({ ...rest, roundsCount: Array.isArray(rounds) ? rounds.length : 0 });
      heavyMaps.push({ rounds: rounds || [], playerStats: playerStats || {}, keyMoments: keyMoments || [], ecoSummary: ecoSummary || {} });
    }
    matchLogs[m.id] = { maps: heavyMaps };
    return { ...m, live: null, result: { ...m.result, maps: lightMaps } };
  });
  return { slim: copy, matchLogs };
}

function mergeWorldFromLocalStorage(world, matchLogs) {
  if (!world?.schedule || !matchLogs) return world;
  world.schedule = world.schedule.map((m) => {
    const log = matchLogs[m.id];
    if (!log?.maps?.length || !m?.result?.maps?.length) return m;
    const maps = m.result.maps.map((map, i) => ({ ...map, ...(log.maps[i] || {}) }));
    return { ...m, result: { ...m.result, maps } };
  });
  return world;
}

function updateLocalIndex(world, slotId, sizeEstimate = 0) {
  const index = getLocalIndex().filter((s) => s.id !== slotId);
  index.push({
    id: slotId,
    saveName: world?.meta?.saveName || 'Unnamed Save',
    year: world?.meta?.year || '-',
    mode: world?.meta?.mode || '-',
    userName: world?.meta?.userName || '',
    teamId: world?.userTid ?? null,
    createdAt: world?.meta?.createdAt || Date.now(),
    updatedAt: Date.now(),
    sizeEstimate,
    backend: 'localStorage-minimal'
  });
  index.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  setLocalIndex(index);
}

function saveLocalSlot(slotId, world) {
  const { slim, matchLogs } = splitWorldForLocalStorage(world);
  const slimKey = `${LOCAL_SLOT_PREFIX}${slotId}`;
  const logsKey = `${LOCAL_LOG_PREFIX}${slotId}`;
  const slimRaw = JSON.stringify(slim);
  const logsRaw = JSON.stringify(matchLogs);

  try {
    localStorage.setItem(slimKey, slimRaw);
    localStorage.setItem(logsKey, logsRaw);
  } catch (error) {
    try {
      localStorage.setItem(slimKey, slimRaw);
      localStorage.removeItem(logsKey);
    } catch (error2) {
      throw error2;
    }
  }

  updateLocalIndex(world, slotId, estimateSize(slimRaw) + estimateSize(logsRaw));
}

function loadLocalSlot(slotId) {
  const slimRaw = localStorage.getItem(`${LOCAL_SLOT_PREFIX}${slotId}`);
  if (!slimRaw) return null;
  const slim = safeParse(slimRaw, null);
  if (!slim || typeof slim !== 'object') return null;
  const logs = safeParse(localStorage.getItem(`${LOCAL_LOG_PREFIX}${slotId}`), {});
  return mergeWorldFromLocalStorage(slim, logs);
}

function deleteLocalSlot(slotId) {
  localStorage.removeItem(`${LOCAL_SLOT_PREFIX}${slotId}`);
  localStorage.removeItem(`${LOCAL_LOG_PREFIX}${slotId}`);
  const next = getLocalIndex().filter((s) => s.id !== slotId);
  setLocalIndex(next);
}

async function detectIdbUsable() {
  if (idbUsable != null) return idbUsable;
  try {
    await idbListSlots();
    idbUsable = true;
  } catch {
    idbUsable = false;
  }
  return idbUsable;
}

async function migrateLegacyLocalStorageIfNeeded() {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const raw = localStorage.getItem(LEGACY_SAVES_KEY);
    if (!raw) return;
    const legacy = asArray(safeParse(raw, []));
    if (!legacy.length) {
      localStorage.removeItem(LEGACY_SAVES_KEY);
      return;
    }

    const useIdb = await detectIdbUsable();
    for (const save of legacy) {
      const slotId = save?.id || uid('save');
      if (!save || typeof save !== 'object') continue;
      save.id = slotId;
      if (useIdb) {
        try { await idbSave(slotId, save); } catch { saveLocalSlot(slotId, save); }
      } else {
        saveLocalSlot(slotId, save);
      }
    }
    localStorage.removeItem(LEGACY_SAVES_KEY);
  })();
  return migrationPromise;
}

export function getActiveSaveId() {
  return localStorage.getItem(ACTIVE_KEY) || localStorage.getItem(ACTIVE_KEY_LEGACY);
}

export function setActiveSaveId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
  localStorage.setItem(ACTIVE_KEY_LEGACY, id);
}

export function clearActiveSaveId() {
  localStorage.removeItem(ACTIVE_KEY);
  localStorage.removeItem(ACTIVE_KEY_LEGACY);
}

export function getUiPrefs() {
  return safeParse(localStorage.getItem(UI_PREFS_KEY), {});
}

export function setUiPrefs(next) {
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(next || {}));
}

export async function listSaves() {
  await migrateLegacyLocalStorageIfNeeded();
  const local = getLocalIndex();
  try {
    if (await detectIdbUsable()) {
      const slots = asArray(await idbListSlots());
      const mapped = slots.map((s) => ({
        id: s.slotId,
        saveName: s.meta?.name || 'Unnamed Save',
        year: s.meta?.season || '-',
        mode: s.meta?.mode || '-',
        userName: s.meta?.userName || '',
        createdAt: s.meta?.createdAt || 0,
        updatedAt: s.updatedAt,
        teamId: s.meta?.teamId ?? null,
        sizeEstimate: 0,
        backend: 'indexedDB'
      })).filter((s) => typeof s.id === 'string');
      return [...mapped, ...local.filter((l) => !mapped.find((m) => m.id === l.id))].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
  } catch {
    idbUsable = false;
  }
  if (!local.length) emitStorageError('IndexedDB unavailable. Using localStorage minimal mode for saves.');
  return asArray(local);
}

export async function loadSave(id) {
  if (!id) return null;
  await migrateLegacyLocalStorageIfNeeded();
  if (await detectIdbUsable()) {
    try {
      const save = await idbLoad(id);
      if (save && typeof save === 'object') return save;
    } catch {
      idbUsable = false;
    }
  }
  const local = loadLocalSlot(id);
  if (!local) emitStorageError('Could not load save from storage.');
  return local;
}

export function exportSave(worldOrId, suggestedName = 'valorant-save.json') {
  let world = worldOrId;
  if (typeof worldOrId === 'string') world = loadLocalSlot(worldOrId);
  if (!world || typeof world !== 'object') throw new Error('Save not found for export.');
  const blob = new Blob([JSON.stringify(world)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSaveFromFile(file) {
  const text = await file.text();
  const world = safeParse(text, null);
  if (!world || typeof world !== 'object') throw new Error('Invalid save file.');
  const slotId = world.id || uid('save');
  world.id = slotId;
  world.meta = world.meta || {};
  world.meta.updatedAt = Date.now();
  if (!world.meta.saveName) world.meta.saveName = file.name.replace(/\.json$/i, '') || 'Imported Save';
  await saveToSlot(world);
  return slotId;
}

export async function createWorld({ userTid, mode, saveName, userName }) {
  await migrateLegacyLocalStorageIfNeeded();
  const world = generateWorld({ userTid, mode, saveName, userName });
  const id = uid('save');
  world.id = id;
  world.meta.updatedAt = Date.now();
  try {
    if (await detectIdbUsable()) await idbSave(id, world);
    else {
      saveLocalSlot(id, world);
      emitStorageError('IndexedDB unavailable. Save stored in localStorage minimal mode.');
    }
    setActiveSaveId(id);
    return world;
  } catch (error) {
    try {
      saveLocalSlot(id, world);
      emitStorageError('IndexedDB blocked. Save stored in localStorage minimal mode.');
      setActiveSaveId(id);
      return world;
    } catch {
      emitStorageError('Could not save due to storage limits. Use Export Save and Import Save to continue playing.');
      throw error;
    }
  }
}

export async function saveToSlot(world) {
  if (!world) return;
  await migrateLegacyLocalStorageIfNeeded();
  world.meta = world.meta || {};
  world.meta.updatedAt = Date.now();
  const slotId = world.id || getActiveSaveId() || uid('save');
  world.id = slotId;
  try {
    if (await detectIdbUsable()) await idbSave(slotId, world);
    else saveLocalSlot(slotId, world);
  } catch (error) {
    try {
      saveLocalSlot(slotId, world);
      emitStorageError('IndexedDB unavailable. Save persisted in localStorage minimal mode.');
    } catch {
      emitStorageError('Could not save due to storage limits. Use Export Save and Import Save to continue playing.');
      throw error;
    }
  }
}

export async function saveSave(id, data) {
  if (!data) return;
  data.id = id || data.id;
  await saveToSlot(data);
}

export async function deleteSave(id) {
  await migrateLegacyLocalStorageIfNeeded();
  try { if (await detectIdbUsable()) await idbDelete(id); } catch { idbUsable = false; }
  deleteLocalSlot(id);
  if (getActiveSaveId() === id) clearActiveSaveId();
}

export async function deleteAllSaves() {
  const saves = asArray(await listSaves());
  for (const s of saves) {
    try { if (s.backend === 'indexedDB') await idbDelete(s.id); } catch { idbUsable = false; }
    deleteLocalSlot(s.id);
  }
  clearActiveSaveId();
}

export async function loadFromSlot() {
  const id = getActiveSaveId();
  if (!id) return null;
  return loadSave(id);
}

// compatibility aliases
export const getActiveSlot = getActiveSaveId;
export const setActiveSlot = setActiveSaveId;
export const clearActiveSlot = clearActiveSaveId;
export const listSlots = listSaves;
export const deleteSlot = deleteSave;
export function newSlotId() { return uid('save'); }
