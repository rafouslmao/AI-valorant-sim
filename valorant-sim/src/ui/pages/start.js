import { TEAMS } from '../../core/constants.js';
import { clearActiveSaveId, createWorld, deleteAllSaves, deleteSave, listSaves, loadSave, setActiveSaveId } from '../../core/storage.js';
import { clearWorld, setWorld } from '../../core/state.js';

function showInlineError(root, message) {
  const createError = root.querySelector('#createError');
  if (createError) createError.textContent = message;
}

function attachStorageErrorListener(root) {
  const handler = (e) => showInlineError(root, e.detail || 'Storage error.');
  window.addEventListener('storage-error', handler);
  return () => window.removeEventListener('storage-error', handler);
}

export async function renderStartPage(root) {
  const saves = await listSaves();
  root.innerHTML = `
    <div class="start-screen">
      <h1>Valorant eSports Simulator</h1>
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
        <button id="deleteAll">Delete All Saves</button>
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
      createError.textContent = 'Could not save. IndexedDB is unavailable (private mode or blocked storage).';
    } finally {
      createStatus.textContent = '';
    }
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
  if (saves.length === 0) {
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
    item.append(loadBtn, delBtn);
    saveList.append(item);
  }
}
