import { generateWorld } from './generator.js';
import { idbDelete, idbListSlots, idbLoad, idbSave } from './idb.js';
import { uid } from './utils.js';

const LEGACY_SAVES_KEY = 'valorantSim.saves';
const ACTIVE_KEY = 'valorantSim.activeSlot';
const ACTIVE_KEY_LEGACY = 'valorantSim.activeSaveId';
const UI_PREFS_KEY = 'valorantSim.uiPrefs';

let migrationPromise = null;

function emitStorageError(message) {
  window.dispatchEvent(new CustomEvent('storage-error', { detail: message }));
}

function safeParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function migrateLegacyLocalStorageIfNeeded() {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const raw = localStorage.getItem(LEGACY_SAVES_KEY);
    if (!raw) return;
    const legacy = safeParse(raw, []);
    if (!Array.isArray(legacy) || !legacy.length) {
      localStorage.removeItem(LEGACY_SAVES_KEY);
      return;
    }
    try {
      for (const save of legacy) {
        const slotId = save.id || uid('save');
        save.id = slotId;
        await idbSave(slotId, save);
      }
      localStorage.removeItem(LEGACY_SAVES_KEY);
    } catch (error) {
      console.error(error);
      emitStorageError('Legacy saves could not be fully migrated to IndexedDB.');
    }
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
  try {
    await migrateLegacyLocalStorageIfNeeded();
    const slots = await idbListSlots();
    return slots
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((s) => ({
        id: s.slotId,
        saveName: s.meta?.name || 'Unnamed Save',
        year: s.meta?.season || '-',
        mode: s.meta?.mode || '-',
        userName: s.meta?.userName || '',
        updatedAt: s.updatedAt,
        teamId: s.meta?.teamId ?? null
      }));
  } catch (error) {
    console.error(error);
    emitStorageError('Could not access save list. IndexedDB is unavailable.');
    return [];
  }
}

export async function loadSave(id) {
  try {
    await migrateLegacyLocalStorageIfNeeded();
    return await idbLoad(id);
  } catch (error) {
    console.error(error);
    emitStorageError('Could not load save. IndexedDB is unavailable.');
    return null;
  }
}

export async function createWorld({ userTid, mode, saveName, userName }) {
  await migrateLegacyLocalStorageIfNeeded();
  const world = generateWorld({ userTid, mode, saveName, userName });
  const id = uid('save');
  world.id = id;
  world.meta.updatedAt = Date.now();
  try {
    await idbSave(id, world);
    setActiveSaveId(id);
    return world;
  } catch (error) {
    console.error(error);
    emitStorageError('Could not save. IndexedDB is unavailable (private mode or blocked storage).');
    throw error;
  }
}

export async function saveToSlot(world) {
  if (!world) return;
  await migrateLegacyLocalStorageIfNeeded();
  world.meta.updatedAt = Date.now();
  const slotId = world.id || getActiveSaveId() || uid('save');
  world.id = slotId;
  try {
    await idbSave(slotId, world);
  } catch (error) {
    console.error(error);
    emitStorageError('Could not save. IndexedDB is unavailable (private mode or blocked storage).');
    throw error;
  }
}

export async function deleteSave(id) {
  try {
    await migrateLegacyLocalStorageIfNeeded();
    await idbDelete(id);
    if (getActiveSaveId() === id) clearActiveSaveId();
  } catch (error) {
    console.error(error);
    emitStorageError('Could not delete save. IndexedDB is unavailable.');
  }
}

export async function deleteAllSaves() {
  try {
    const saves = await listSaves();
    await Promise.all(saves.map((s) => idbDelete(s.id)));
    clearActiveSaveId();
  } catch (error) {
    console.error(error);
    emitStorageError('Could not delete saves. IndexedDB is unavailable.');
  }
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
