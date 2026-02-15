import { clearActiveSaveId } from '../../core/storage.js';
import { clearWorld } from '../../core/state.js';

const tabs = [
  ['home', 'Career Home'],
  ['roster', 'Roster'],
  ['matches', 'Tournaments'],
  ['match', 'Match View'],
  ['strategy', 'Strategy'],
  ['sponsors', 'Sponsors'],
  ['messages', 'Messages'],
  ['teams', 'Teams'],
  ['players', 'Players'],
  ['stats', 'Stats'],
  ['free-agents', 'Free Agents'],
  ['staff', 'Staff'],
  ['finances', 'Finances'],
  ['practice', 'Practice'],
  ['facilities', 'Facilities'],
  ['god-mode', 'God Mode']
];

export function renderCareerLayout(root, activeTab, contentBuilder, actions = {}, badges = {}) {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'career-layout';
  const side = document.createElement('aside');
  side.className = 'sidebar';
  side.innerHTML = `<h2>Valorant Sim</h2>`;

  const nav = document.createElement('nav');
  for (const [route, label] of tabs) {
    const a = document.createElement('a');
    a.href = route === 'match' ? '#/matches' : route === 'team' ? '#/teams' : `#/` + route;
    a.textContent = badges[route] ? `${label} (${badges[route]})` : label;
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
  topBar.innerHTML = `<div></div><div class="top-actions"><button id="sim-next-global">Advance Time</button><button id="sim-week-global">Sim to Next Tournament</button><button id="sim-tournament-global">Sim This Tournament</button></div>`;
  main.append(topBar);

  const content = document.createElement('div');
  contentBuilder(content);
  main.append(content);

  topBar.querySelector('#sim-next-global').onclick = () => actions.onSimNext?.();
  topBar.querySelector('#sim-week-global').onclick = () => actions.onSimWeek?.();
  topBar.querySelector('#sim-tournament-global').onclick = () => actions.onSimTournament?.();

  wrap.append(side, main);
  root.append(wrap);
}
