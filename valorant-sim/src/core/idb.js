const DB_NAME = 'valorantSim';
const DB_VERSION = 2;
const STORE_SAVES = 'saves';
const STORE_LOGS = 'matchLogs';

let dbPromise = null;

function splitWorldForStorage(saveObj) {
  const world = structuredClone(saveObj || {});
  const logsByMatch = {};
  world.schedule = (world.schedule || []).map((m) => {
    if (!m?.result?.maps?.length) return m;
    const clone = { ...m, result: { ...m.result, maps: [] } };
    const heavyMaps = [];
    for (const map of m.result.maps) {
      const { rounds, playerStats, keyMoments, ecoSummary, ...lightMap } = map || {};
      clone.result.maps.push({ ...lightMap, roundsCount: Array.isArray(rounds) ? rounds.length : 0 });
      heavyMaps.push({ rounds: rounds || [], playerStats: playerStats || {}, keyMoments: keyMoments || [], ecoSummary: ecoSummary || {} });
    }
    logsByMatch[m.id] = { maps: heavyMaps };
    return clone;
  });
  return { world, logsByMatch };
}

function mergeWorldFromStorage(world, logsByMatch) {
  if (!world?.schedule || !logsByMatch) return world;
  world.schedule = world.schedule.map((m) => {
    const log = logsByMatch[m.id];
    if (!log?.maps?.length || !m?.result?.maps?.length) return m;
    const mergedMaps = m.result.maps.map((map, idx) => ({ ...map, ...(log.maps[idx] || {}) }));
    return { ...m, result: { ...m.result, maps: mergedMaps } };
  });
  return world;
}

export function openDB(dbName = DB_NAME, version = DB_VERSION) {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SAVES)) {
        db.createObjectStore(STORE_SAVES, { keyPath: 'slotId' });
      }
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, { keyPath: 'slotId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export async function idbSave(slotId, saveObj) {
  const db = await openDB();
  const { world, logsByMatch } = splitWorldForStorage(saveObj);
  const tx = db.transaction([STORE_SAVES, STORE_LOGS], 'readwrite');
  const saveStore = tx.objectStore(STORE_SAVES);
  const logStore = tx.objectStore(STORE_LOGS);
  const meta = {
    name: world?.meta?.saveName || 'Unnamed Save',
    teamId: world?.userTid ?? null,
    mode: world?.meta?.mode || 'GM',
    season: world?.meta?.year || 0,
    createdAt: world?.meta?.createdAt || Date.now(),
    userName: world?.meta?.userName || ''
  };
  saveStore.put({ slotId, updatedAt: Date.now(), meta, data: world });
  logStore.put({ slotId, logsByMatch });
  await txDone(tx);
}

export async function idbLoad(slotId) {
  const db = await openDB();
  const tx = db.transaction([STORE_SAVES, STORE_LOGS], 'readonly');
  const saveReq = tx.objectStore(STORE_SAVES).get(slotId);
  const logReq = tx.objectStore(STORE_LOGS).get(slotId);
  const [saveRow, logRow] = await Promise.all([
    new Promise((resolve, reject) => {
      saveReq.onsuccess = () => resolve(saveReq.result || null);
      saveReq.onerror = () => reject(saveReq.error || new Error('IndexedDB read failed'));
    }),
    new Promise((resolve) => {
      logReq.onsuccess = () => resolve(logReq.result || null);
      logReq.onerror = () => resolve(null);
    })
  ]);
  await txDone(tx);
  const world = saveRow?.data || null;
  if (!world) return null;
  return mergeWorldFromStorage(world, logRow?.logsByMatch || {});
}

export async function idbListSlots() {
  const db = await openDB();
  const tx = db.transaction(STORE_SAVES, 'readonly');
  const store = tx.objectStore(STORE_SAVES);
  const req = store.getAll();
  const rows = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('IndexedDB list failed'));
  });
  await txDone(tx);
  return rows.map((r) => ({ slotId: r.slotId, updatedAt: r.updatedAt, meta: r.meta || {} }));
}

export async function idbDelete(slotId) {
  const db = await openDB();
  const tx = db.transaction([STORE_SAVES, STORE_LOGS], 'readwrite');
  tx.objectStore(STORE_SAVES).delete(slotId);
  tx.objectStore(STORE_LOGS).delete(slotId);
  await txDone(tx);
}
