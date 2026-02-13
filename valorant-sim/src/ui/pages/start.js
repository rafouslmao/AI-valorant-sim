import { TEAMS } from '../../core/constants.js';
import { clearActiveSaveId, createWorld, deleteAllSaves, deleteSave, listSaves, loadSave, setActiveSaveId } from '../../core/storage.js';
import { clearWorld, setWorld } from '../../core/state.js';

export function renderStartPage(root) {
  const saves = listSaves();
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
        <p id="createError" class="error"></p>
      </section>
      <section class="card">
        <h2>Load Career</h2>
        <button id="deleteAll">Delete All Saves</button>
        <div id="saveList"></div>
      </section>
    </div>
  `;

  const createError = root.querySelector('#createError');
  root.querySelector('#createCareer').onclick = () => {
    const mode = root.querySelector('#mode').value;
    const userTid = Number(root.querySelector('#team').value);
    const userName = root.querySelector('#userName').value.trim();
    const saveName = root.querySelector('#saveName').value.trim();

    if (!userName || !saveName) {
      createError.textContent = 'Name and save name cannot be blank.';
      return;
    }

    const world = createWorld({ userTid, mode, saveName, userName });
    setWorld(world);
    window.location.hash = '#/home';
  };

  root.querySelector('#deleteAll').onclick = () => {
    if (!confirm('Delete all saves?')) return;
    deleteAllSaves();
    clearActiveSaveId();
    clearWorld();
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
    item.innerHTML = `<strong>${s.saveName}</strong> — ${s.team} — ${s.year} — ${s.mode}`;
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => {
      const world = loadSave(s.id);
      if (!world) return;
      setActiveSaveId(s.id);
      setWorld(world);
      window.location.hash = '#/home';
    };
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => {
      if (!confirm(`Delete ${s.saveName}?`)) return;
      deleteSave(s.id);
      clearWorld();
      window.location.hash = '#/start';
      renderStartPage(root);
    };
    item.append(loadBtn, delBtn);
    saveList.append(item);
  }
}
