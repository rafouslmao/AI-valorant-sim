import { TEAMS } from '../../core/constants.js';
import { createWorld, listSaves, loadSave, setActiveSaveId } from '../../core/storage.js';
import { setWorld } from '../../core/state.js';

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

  const saveList = root.querySelector('#saveList');
  if (saves.length === 0) {
    saveList.textContent = 'No saves yet.';
    return;
  }
  for (const s of saves) {
    const item = document.createElement('div');
    item.className = 'save-row';
    item.innerHTML = `<strong>${s.saveName}</strong> — ${s.team} — ${s.year} — ${s.mode}`;
    const btn = document.createElement('button');
    btn.textContent = 'Load Career';
    btn.onclick = () => {
      const world = loadSave(s.id);
      if (!world) return;
      setActiveSaveId(s.id);
      setWorld(world);
      window.location.hash = '#/home';
    };
    item.append(btn);
    saveList.append(item);
  }
}
