import { clearActiveSaveId } from '../../core/storage.js';
import { clearWorld } from '../../core/state.js';

const tabs = [
  ['home', 'Career Home'],
  ['roster', 'Roster'],
  ['matches', 'Matches'],
  ['players', 'Players'],
  ['free-agents', 'Free Agents'],
  ['staff', 'Staff'],
  ['finances', 'Finances'],
  ['practice', 'Practice'],
  ['facilities', 'Facilities']
];

export function renderCareerLayout(root, activeTab, contentBuilder, actions = {}) {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'career-layout';
  const side = document.createElement('aside');
  side.className = 'sidebar';
  side.innerHTML = `<h2>Valorant Sim</h2>`;

  const nav = document.createElement('nav');
  for (const [route, label] of tabs) {
    const a = document.createElement('a');
    a.href = `#/` + route;
    a.textContent = label;
    if (activeTab === route) a.className = 'active';
    nav.append(a);
  }
  side.append(nav);

  const logout = document.createElement('button');
  logout.textContent = 'Exit Career';
  logout.onclick = () => {
    clearActiveSaveId();
    clearWorld();
    window.location.hash = '#/start';
  };
  side.append(logout);

  const main = document.createElement('main');
  const topBar = document.createElement('div');
  topBar.className = 'main-topbar';
  topBar.innerHTML = `<div></div><div class="top-actions"><button id="sim-next-global">Sim Next Match</button><button id="sim-week-global">Sim Week</button></div>`;
  main.append(topBar);

  const content = document.createElement('div');
  contentBuilder(content);
  main.append(content);

  topBar.querySelector('#sim-next-global').onclick = () => actions.onSimNext?.();
  topBar.querySelector('#sim-week-global').onclick = () => actions.onSimWeek?.();

  wrap.append(side, main);
  root.append(wrap);
}
