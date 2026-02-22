import { TEAMS } from '../../core/constants.js';
import { clearActiveSaveId, createWorld, deleteAllSaves, deleteSave, exportSave, importSaveFromFile, listSaves, loadSave, setActiveSaveId } from '../../core/storage.js';
import { clearWorld, setWorld } from '../../core/state.js';

function showInlineError(root, message) {
  const createError = root.querySelector('#createError');
  if (createError) createError.textContent = message;
}

function showBanner(root, message = '') {
  const banner = root.querySelector('#storageBanner');
  if (banner) banner.textContent = message;
}

function attachStorageErrorListener(root) {
  const handler = (e) => {
    const msg = e?.detail || 'Storage error.';
    showInlineError(root, msg);
    showBanner(root, msg);
  };
  window.addEventListener('storage-error', handler);
  return () => window.removeEventListener('storage-error', handler);
}

export async function renderStartPage(root) {
  const listed = await listSaves();
  const saves = Array.isArray(listed) ? listed : [];
  root.innerHTML = `
    <div class="start-screen">
      <h1>Valorant eSports Simulator</h1>
      <p id="storageBanner" class="error"></p>
      <section class="card">
        <h2>Create Career</h2>
        <label>Mode
          <select id="mode"><option>GM</option><option>Coach</option></select>
        </label>
        <label>Team
          <select id="team">${TEAMS.map((t) => `<option value="${t.tid}">${t.name} (${t.region})</option>`).join('')}</select>
        </label>
        <label>Manager/Coach Name<input id="userName" /></label>
        <label>Save Name<input id="saveName" /></label>
        <button id="createCareer">Create Career</button>
        <p id="createStatus"></p>
        <p id="createError" class="error"></p>
      </section>
      <section class="card">
        <h2>Load Career</h2>
        <div class="top-actions">
          <button id="importSaveBtn">Import Save</button>
          <input type="file" id="importSaveFile" accept="application/json,.json" style="display:none" />
          <button id="deleteAll">Delete All Saves</button>
        </div>
        <div id="saveList"></div>
      </section>
    </div>
  `;

  const detach = attachStorageErrorListener(root);
  const createError = root.querySelector('#createError');
  const createStatus = root.querySelector('#createStatus');
  root.querySelector('#createCareer').onclick = async () => {
    const mode = root.querySelector('#mode').value;
    const userTid = Number(root.querySelector('#team').value);
    const userName = root.querySelector('#userName').value.trim();
    const saveName = root.querySelector('#saveName').value.trim();

    createError.textContent = '';
    if (!userName || !saveName) {
      createError.textContent = 'Name and save name cannot be blank.';
      return;
    }

    createStatus.textContent = 'Saving...';
    try {
      const world = await createWorld({ userTid, mode, saveName, userName });
      setWorld(world);
      detach();
      window.location.hash = '#/home';
    } catch (error) {
      console.error(error);
      const msg = 'Could not save due to storage limits. Use Export Save/Import Save if needed.';
      createError.textContent = msg;
      showBanner(root, msg);
    } finally {
      createStatus.textContent = '';
    }
  };

  const importFile = root.querySelector('#importSaveFile');
  root.querySelector('#importSaveBtn').onclick = () => importFile.click();
  importFile.onchange = async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      await importSaveFromFile(file);
      showBanner(root, 'Save imported successfully.');
      detach();
      await renderStartPage(root);
    } catch (error) {
      console.error(error);
      showBanner(root, 'Import failed. Invalid or corrupted save file.');
    }
    importFile.value = '';
  };

  root.querySelector('#deleteAll').onclick = async () => {
    if (!confirm('Delete all saves?')) return;
    await deleteAllSaves();
    clearActiveSaveId();
    clearWorld();
    detach();
    renderStartPage(root);
  };

  const saveList = root.querySelector('#saveList');
  if (!Array.isArray(saves) || saves.length === 0) {
    saveList.textContent = 'No saves yet.';
    return;
  }

  for (const s of saves) {
    const item = document.createElement('div');
    item.className = 'save-row';
    const teamLabel = TEAMS.find((t) => t.tid === s.teamId)?.name || `Team ${s.teamId ?? '-'}`;
    item.innerHTML = `<strong>${s.saveName}</strong> — ${teamLabel} — ${s.year} — ${s.mode}`;

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.onclick = async () => {
      const world = await loadSave(s.id);
      if (!world) return;
      setActiveSaveId(s.id);
      setWorld(world);
      detach();
      window.location.hash = '#/home';
    };

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.onclick = async () => {
      const world = await loadSave(s.id);
      if (!world) return;
      exportSave(world, `${(s.saveName || 'valorant-save').replace(/\s+/g, '-')}.json`);
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      if (!confirm(`Delete ${s.saveName}?`)) return;
      await deleteSave(s.id);
      clearWorld();
      window.location.hash = '#/start';
      detach();
      renderStartPage(root);
    };

    item.append(loadBtn, exportBtn, delBtn);
    saveList.append(item);
  }
}
