import { ROSTER_LIMIT, ROLES, PRACTICE_FOCUS, INTENSITIES } from '../../core/constants.js';
import { mutateWorld } from '../../core/state.js';
import { simulateNextMatchForUserTeam, simulateWeek } from '../../core/sim.js';
import { formatMoney } from '../../core/utils.js';

function getUserTeam(state) {
  return state.teams.find((t) => t.tid === state.userTid);
}

export function renderHome(main, state) {
  const team = getUserTeam(state);
  main.innerHTML = `<h1>Career Home</h1>
    <p><strong>${state.meta.userName}</strong> (${state.meta.mode}) • ${team.name}</p>
    <p>Season ${state.meta.year}, Week ${state.meta.week}</p>
    <p>Record: ${team.wins}-${team.losses}</p>`;
}

export function renderRoster(main, state) {
  const roster = state.players.filter((p) => p.tid === state.userTid);
  const starters = roster.slice(0, 5);
  const bench = roster.slice(5);

  const drawRows = (players, isStarter) => players.map((p) => `
    <tr>
      <td><a href="#/player?id=${p.pid}">${p.name}</a></td>
      <td>${p.ovr}</td>
      <td>
        <select data-role="${p.pid}">${ROLES.map((r) => `<option ${p.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
      </td>
      <td><button data-swap="${p.pid}" data-target="${isStarter ? 'bench' : 'start'}">${isStarter ? 'Bench' : 'Start'}</button></td>
    </tr>`).join('');

  main.innerHTML = `<h1>Roster</h1>
    <h3>Starters</h3>
    <table><tr><th>Player</th><th>OVR</th><th>Role</th><th>Move</th></tr>${drawRows(starters, true)}</table>
    <h3>Bench</h3>
    <table><tr><th>Player</th><th>OVR</th><th>Role</th><th>Move</th></tr>${drawRows(bench, false)}</table>
  `;

  main.querySelectorAll('[data-swap]').forEach((btn) => {
    btn.onclick = () => {
      mutateWorld((w) => {
        const userRoster = w.players.filter((p) => p.tid === w.userTid);
        const pid = btn.dataset.swap;
        const player = userRoster.find((p) => p.pid === pid);
        if (!player) return;
        const idx = userRoster.indexOf(player);
        if (btn.dataset.target === 'bench' && idx < 5) {
          const swap = userRoster[5];
          if (swap) [w.players[w.players.indexOf(player)], w.players[w.players.indexOf(swap)]] = [swap, player];
        }
        if (btn.dataset.target === 'start' && idx >= 5) {
          const swap = userRoster[4];
          if (swap) [w.players[w.players.indexOf(player)], w.players[w.players.indexOf(swap)]] = [swap, player];
        }
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
  });

  main.querySelectorAll('[data-role]').forEach((sel) => {
    sel.onchange = () => {
      mutateWorld((w) => {
        const p = w.players.find((x) => x.pid === sel.dataset.role);
        if (p) p.role = sel.value;
      });
    };
  });
}

export function renderMatches(main, state) {
  const matches = state.schedule.filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
  const teamByTid = (tid) => state.teams.find((t) => t.tid === tid)?.abbrev ?? '?';
  main.innerHTML = `<h1>Matches</h1>
    <button id="sim-next">Sim Next Match</button>
    <button id="sim-week">Sim Week</button>
    <table><tr><th>Week</th><th>Match</th><th>Status</th></tr>
    ${matches.map((m) => `<tr><td>${m.week}</td><td>${teamByTid(m.homeTid)} vs ${teamByTid(m.awayTid)}</td><td>${m.played ? `${m.result.homeScore}-${m.result.awayScore}` : 'Unplayed'}</td></tr>`).join('')}
    </table>`;

  main.querySelector('#sim-next').onclick = () => {
    mutateWorld((w) => simulateNextMatchForUserTeam(w));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  main.querySelector('#sim-week').onclick = () => {
    mutateWorld((w) => simulateWeek(w));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}

export function renderPlayers(main, state) {
  const players = state.players.filter((p) => p.tid !== null).sort((a, b) => b.ovr - a.ovr);
  main.innerHTML = `<h1>Players</h1><table><tr><th>Name</th><th>Team</th><th>OVR</th></tr>
    ${players.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${state.teams.find((t) => t.tid === p.tid)?.abbrev}</td><td>${p.ovr}</td></tr>`).join('')}
  </table><h2>Coaches</h2>
  <ul>${state.coaches.map((c) => `<li><a href="#/coach?id=${c.cid}">${c.name}</a> (${state.teams.find((t) => t.tid === c.tid)?.abbrev})</li>`).join('')}</ul>`;
}

export function renderFreeAgents(main, state) {
  const teamCount = state.players.filter((p) => p.tid === state.userTid).length;
  const freeAgents = state.players.filter((p) => p.tid === null).slice(0, 30);
  main.innerHTML = `<h1>Free Agents</h1><p>Roster spots: ${teamCount}/${ROSTER_LIMIT}</p>
    <table><tr><th>Name</th><th>OVR</th><th>Role</th><th></th></tr>
    ${freeAgents.map((p) => `<tr><td>${p.name}</td><td>${p.ovr}</td><td>${p.role}</td><td><button data-sign="${p.pid}">Sign</button></td></tr>`).join('')}
    </table>`;

  main.querySelectorAll('[data-sign]').forEach((btn) => {
    btn.onclick = () => {
      mutateWorld((w) => {
        const rosterSize = w.players.filter((p) => p.tid === w.userTid).length;
        if (rosterSize >= ROSTER_LIMIT) return;
        const p = w.players.find((x) => x.pid === btn.dataset.sign);
        if (p) {
          p.tid = w.userTid;
          p.history.push(`Signed by ${getUserTeam(w).name}`);
        }
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
  });
}

export function renderFinances(main, state) {
  const t = getUserTeam(state);
  main.innerHTML = `<h1>Finances</h1>
    <p>Budget: ${formatMoney(t.budget)}</p>
    <p>Cash: ${formatMoney(t.cash)}</p>
    <p>Revenue: ${formatMoney(t.revenue)}</p>
    <p>Expenses: ${formatMoney(t.expenses)}</p>`;
}

export function renderPractice(main, state) {
  const t = getUserTeam(state);
  if (state.meta.mode !== 'Coach') {
    main.innerHTML = '<h1>Practice</h1><p>Available in Coach mode only.</p>';
    return;
  }
  main.innerHTML = `<h1>Practice</h1>
    <label>Focus <select id="focus">${PRACTICE_FOCUS.map((f) => `<option ${t.practicePlan.focus === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
    <label>Intensity <select id="intensity">${INTENSITIES.map((i) => `<option ${t.practicePlan.intensity === i ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
    <button id="save-practice">Save Plan</button>`;
  main.querySelector('#save-practice').onclick = () => {
    mutateWorld((w) => {
      const ut = getUserTeam(w);
      ut.practicePlan.focus = main.querySelector('#focus').value;
      ut.practicePlan.intensity = main.querySelector('#intensity').value;
    });
  };
}

export function renderFacilities(main, state) {
  const t = getUserTeam(state);
  if (state.meta.mode !== 'GM') {
    main.innerHTML = '<h1>Facilities</h1><p>Available in GM mode only.</p>';
    return;
  }
  main.innerHTML = `<h1>Facilities</h1>
    <p>Level: ${t.facilities.level}</p>
    <p>Development Bonus: ${(t.facilities.bonus * 100).toFixed(1)}%</p>
    <p>Upgrade Cost: ${formatMoney(t.facilities.nextCost)}</p>
    <button id="upgrade">Upgrade Facility</button>`;

  main.querySelector('#upgrade').onclick = () => {
    mutateWorld((w) => {
      const team = getUserTeam(w);
      if (team.cash < team.facilities.nextCost) return;
      team.cash -= team.facilities.nextCost;
      team.expenses += team.facilities.nextCost;
      team.facilities.level += 1;
      team.facilities.bonus += 0.01;
      team.facilities.nextCost = Math.round(team.facilities.nextCost * 1.4);
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}

export function renderPlayerDetail(main, state, id) {
  const p = state.players.find((x) => x.pid === id);
  if (!p) {
    main.innerHTML = '<p>Player not found.</p>';
    return;
  }
  const attrs = Object.entries(p.attrs).map(([k, v]) => `${k}: ${Math.round(v)}`).join(', ');
  main.innerHTML = `<h1>${p.name}</h1><p>Role: ${p.role}</p><p>OVR: ${p.ovr}</p><p>${attrs}</p>
    <h3>History</h3><ul>${p.history.map((h) => `<li>${h}</li>`).join('') || '<li>No history</li>'}</ul>`;

  if (state.meta.godMode) {
    const editor = document.createElement('div');
    editor.innerHTML = ['aim', 'utility', 'clutch', 'mental', 'teamwork'].map((a) => `<label>${a}<input type="number" data-attr="${a}" value="${Math.round(p.attrs[a])}" min="1" max="99"/></label>`).join('') + '<button id="save-attrs">Apply</button>';
    main.append(editor);
    editor.querySelector('#save-attrs').onclick = () => {
      mutateWorld((w) => {
        const target = w.players.find((x) => x.pid === id);
        if (!target) return;
        editor.querySelectorAll('[data-attr]').forEach((input) => {
          target.attrs[input.dataset.attr] = Number(input.value);
        });
      });
    };
  }
}

export function renderCoachDetail(main, state, id) {
  const c = state.coaches.find((x) => x.cid === id);
  if (!c) {
    main.innerHTML = '<p>Coach not found.</p>';
    return;
  }
  const attrs = Object.entries(c.attrs).map(([k, v]) => `${k}: ${v}`).join(', ');
  main.innerHTML = `<h1>${c.name}</h1><p>Team: ${state.teams.find((t) => t.tid === c.tid)?.name}</p><p>${attrs}</p>
  <h3>History</h3><ul>${c.history.map((h) => `<li>${h}</li>`).join('') || '<li>No history</li>'}</ul>`;
}
