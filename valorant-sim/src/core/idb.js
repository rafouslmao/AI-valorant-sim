const DB_NAME = 'valorantSim';
const DB_VERSION = 1;
const STORE_SAVES = 'saves';

let dbPromise = null;

export function openDB(dbName = DB_NAME, version = DB_VERSION) {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SAVES)) {
        db.createObjectStore(STORE_SAVES, { keyPath: 'slotId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
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
  const tx = db.transaction(STORE_SAVES, 'readwrite');
  const store = tx.objectStore(STORE_SAVES);
  const meta = {
    name: saveObj?.meta?.saveName || 'Unnamed Save',
    teamId: saveObj?.userTid ?? null,
    mode: saveObj?.meta?.mode || 'GM',
    season: saveObj?.meta?.year || 0,
    createdAt: saveObj?.meta?.createdAt || Date.now(),
    userName: saveObj?.meta?.userName || ''
  };
  store.put({ slotId, updatedAt: Date.now(), meta, data: saveObj });
  await txDone(tx);
}

export async function idbLoad(slotId) {
  const db = await openDB();
  const tx = db.transaction(STORE_SAVES, 'readonly');
  const store = tx.objectStore(STORE_SAVES);
  const req = store.get(slotId);
  const row = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('IndexedDB read failed'));
  });
  await txDone(tx);
  return row?.data || null;
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
  const tx = db.transaction(STORE_SAVES, 'readwrite');
  tx.objectStore(STORE_SAVES).delete(slotId);
  await txDone(tx);
}
