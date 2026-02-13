import { FACILITY_CONFIG, INTENSITIES, PRACTICE_FOCUS, ROLES, ROSTER_LIMIT, SECONDARY_ROLE_TAGS } from '../../core/constants.js';
import { mutateWorld } from '../../core/state.js';
import { getFacilityUpgradeCost, simulateNextMatchForUserTeam, simulateWeek } from '../../core/sim.js';
import { formatMoney } from '../../core/utils.js';

function getUserTeam(state) {
  return state.teams.find((t) => t.tid === state.userTid);
}

export function simulateNextAction() {
  mutateWorld((w) => simulateNextMatchForUserTeam(w));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function simulateWeekAction() {
  mutateWorld((w) => simulateWeek(w));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function renderHome(main, state) {
  const team = getUserTeam(state);
  main.innerHTML = `<h1>Career Home</h1>
  <p><strong>${state.meta.userName}</strong> (${state.meta.mode}) • ${team.name}</p>
  <p>Season ${state.meta.year}, Week ${state.meta.week}</p>
  <p>Record: ${team.wins}-${team.losses}</p>`;
}

function roleOptions(player) {
  return player.roles.map((r) => `<option ${player.currentRole === r ? 'selected' : ''}>${r}</option>`).join('');
}

export function renderRoster(main, state) {
  const roster = state.players.filter((p) => p.tid === state.userTid);
  const drawRows = (players, isStarter) => players.map((p) => `
  <tr>
    <td><a href="#/player?id=${p.pid}">${p.name}</a></td>
    <td>${p.ovr}</td>
    <td><select data-role="${p.pid}">${roleOptions(p)}</select></td>
    <td><input data-tags="${p.pid}" value="${p.secondaryRoles.join(', ')}"/></td>
    <td><button data-swap="${p.pid}" data-target="${isStarter ? 'bench' : 'start'}">${isStarter ? 'Bench' : 'Start'}</button></td>
  </tr>`).join('');

  main.innerHTML = `<h1>Roster</h1>
  <h3>Starters</h3><table><tr><th>Player</th><th>OVR</th><th>Current Role</th><th>Secondary Tags</th><th>Move</th></tr>${drawRows(roster.slice(0, 5), true)}</table>
  <h3>Bench</h3><table><tr><th>Player</th><th>OVR</th><th>Current Role</th><th>Secondary Tags</th><th>Move</th></tr>${drawRows(roster.slice(5), false)}</table>`;

  main.querySelectorAll('[data-role]').forEach((sel) => {
    sel.onchange = () => mutateWorld((w) => {
      const p = w.players.find((x) => x.pid === sel.dataset.role);
      if (p) p.currentRole = sel.value;
    });
  });

  main.querySelectorAll('[data-tags]').forEach((input) => {
    input.onchange = () => mutateWorld((w) => {
      const p = w.players.find((x) => x.pid === input.dataset.tags);
      if (!p) return;
      p.secondaryRoles = input.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
    });
  });

  main.querySelectorAll('[data-swap]').forEach((btn) => {
    btn.onclick = () => {
      mutateWorld((w) => {
        const rosterPlayers = w.players.filter((p) => p.tid === w.userTid);
        const player = rosterPlayers.find((p) => p.pid === btn.dataset.swap);
        if (!player) return;
        const idx = rosterPlayers.indexOf(player);
        const targetIndex = btn.dataset.target === 'bench' ? 5 : 4;
        const swap = rosterPlayers[targetIndex];
        if (swap) [w.players[w.players.indexOf(player)], w.players[w.players.indexOf(swap)]] = [swap, player];
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
  });
}

export function renderMatches(main, state) {
  const matches = state.schedule.filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
  const abbr = (tid) => state.teams.find((t) => t.tid === tid)?.abbrev ?? '?';
  main.innerHTML = `<h1>Matches</h1><table><tr><th>Week</th><th>Match</th><th>Status</th></tr>
  ${matches.map((m) => `<tr><td>${m.week}</td><td>${abbr(m.homeTid)} vs ${abbr(m.awayTid)}</td><td>${m.played ? `${m.result.homeScore}-${m.result.awayScore}` : 'Unplayed'}</td></tr>`).join('')}
  </table>`;
}

export function renderPlayers(main, state) {
  const players = state.players.sort((a, b) => b.ovr - a.ovr);
  const teamName = (tid) => tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === tid)?.abbrev;
  main.innerHTML = `<h1>Players</h1><table><tr><th>Name</th><th>Team</th><th>OVR</th><th>Roles</th><th>Secondary</th></tr>
  ${players.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${teamName(p.tid)}</td><td>${p.ovr}</td><td>${p.roles.join(', ')}</td><td>${p.secondaryRoles.join(', ')}</td></tr>`).join('')}
  </table>`;
}

export function renderFreeAgents(main, state) {
  const rosterCount = state.players.filter((p) => p.tid === state.userTid).length;
  const freeAgents = state.players.filter((p) => p.tid === null).slice(0, 40);
  main.innerHTML = `<h1>Free Agents</h1><p>Roster spots: ${rosterCount}/${ROSTER_LIMIT}</p>
  <table><tr><th>Name</th><th>OVR</th><th>Roles</th><th>Secondary</th><th></th></tr>
  ${freeAgents.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${p.ovr}</td><td>${p.roles.join(', ')}</td><td>${p.secondaryRoles.join(', ')}</td><td><button data-sign="${p.pid}">Sign</button></td></tr>`).join('')}
  </table>`;

  main.querySelectorAll('[data-sign]').forEach((btn) => {
    btn.onclick = () => {
      mutateWorld((w) => {
        if (w.players.filter((p) => p.tid === w.userTid).length >= ROSTER_LIMIT) return;
        const p = w.players.find((x) => x.pid === btn.dataset.sign);
        if (!p) return;
        p.tid = w.userTid;
        p.history.push(`Signed by ${getUserTeam(w).name}`);
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
  });
}

export function renderStaff(main, state) {
  const staff = state.coaches.filter((c) => c.tid === state.userTid);
  const market = state.coaches.filter((c) => c.tid === null);
  main.innerHTML = `<h1>Staff</h1><h3>My Staff</h3><ul>
    ${staff.map((c) => `<li><a href="#/coach?id=${c.cid}">${c.profile.name}</a> — ${c.staffRole} — Salary ${formatMoney(c.salary)}</li>`).join('') || '<li>No staff</li>'}
  </ul>
  <h3>Coach Market</h3>
  <table><tr><th>Name</th><th>Style</th><th>Prep</th><th>Leadership</th><th></th></tr>
  ${market.slice(0, 30).map((c) => `<tr><td><a href="#/coach?id=${c.cid}">${c.profile.name}</a></td><td>${c.profile.styleTag}</td><td>${c.ratings.prep}</td><td>${c.ratings.leadership}</td><td><button data-sign-coach="${c.cid}">Sign Head Coach</button></td></tr>`).join('')}
  </table>`;

  main.querySelectorAll('[data-sign-coach]').forEach((btn) => {
    btn.onclick = () => {
      mutateWorld((w) => {
        const old = w.coaches.find((c) => c.tid === w.userTid && c.staffRole === 'Head Coach');
        if (old) old.tid = null;
        const coach = w.coaches.find((c) => c.cid === btn.dataset.signCoach);
        if (coach) {
          coach.tid = w.userTid;
          coach.staffRole = 'Head Coach';
          coach.history.push(`Hired by ${getUserTeam(w).name}`);
        }
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
  });
}

export function renderFinances(main, state) {
  const t = getUserTeam(state);
  const latest = t.monthlyLedger[t.monthlyLedger.length - 1];
  main.innerHTML = `<h1>Finances</h1><p>Budget: ${formatMoney(t.budget)}</p><p>Cash: ${formatMoney(t.cash)}</p><p>Revenue: ${formatMoney(t.revenue)}</p><p>Expenses: ${formatMoney(t.expenses)}</p>
  ${latest ? `<h3>Latest Monthly Expense</h3><p>Players: ${formatMoney(latest.playerSalaries)} | Staff: ${formatMoney(latest.staffSalaries)} | Facilities: ${formatMoney(latest.facilityMaintenance)} | Total: ${formatMoney(latest.total)}</p>` : '<p>No monthly ledger yet.</p>'}`;
}

export function renderPractice(main, state) {
  if (state.meta.mode !== 'Coach') {
    main.innerHTML = '<h1>Practice</h1><p>Available in Coach mode only.</p>';
    return;
  }
  const t = getUserTeam(state);
  main.innerHTML = `<h1>Practice</h1>
  <label>Focus <select id="focus">${PRACTICE_FOCUS.map((f) => `<option ${t.practicePlan.focus === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
  <label>Intensity <select id="intensity">${INTENSITIES.map((i) => `<option ${t.practicePlan.intensity === i ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
  <p>Secondary role tags available: ${SECONDARY_ROLE_TAGS.join(', ')}</p>
  <button id="save-practice">Save Plan</button>`;
  main.querySelector('#save-practice').onclick = () => mutateWorld((w) => {
    const ut = getUserTeam(w);
    ut.practicePlan.focus = main.querySelector('#focus').value;
    ut.practicePlan.intensity = main.querySelector('#intensity').value;
  });
}

export function renderFacilities(main, state) {
  const t = getUserTeam(state);
  const rows = Object.entries(FACILITY_CONFIG).map(([key, cfg]) => {
    const f = t.facilities[key];
    const nextCost = getFacilityUpgradeCost(t, key);
    return `<tr><td>${cfg.label}</td><td>${f.level}/${f.maxLevel}</td><td>${formatMoney(f.baseMaintenance * f.level)}</td><td>${formatMoney(nextCost)}</td><td><button data-up="${key}" ${f.level >= f.maxLevel ? 'disabled' : ''}>Upgrade</button></td></tr>`;
  }).join('');

  main.innerHTML = `<h1>Facilities</h1>
  <p>Office quality affects morale/chemistry/burnout. PC quality boosts practice and mechanics. Analyst dept improves veto/anti-strat/adaptation. Sports psychology improves tilt/clutch/comeback. Performance staff reduces fatigue/burnout. Academy boosts regen potential and hidden gems.</p>
  <table><tr><th>Facility</th><th>Level</th><th>Maintenance</th><th>Upgrade Cost</th><th></th></tr>${rows}</table>
  <p>Upgrade formula: <code>baseCost * (level + 1)^1.5</code></p>`;

  main.querySelectorAll('[data-up]').forEach((btn) => {
    btn.onclick = () => {
      mutateWorld((w) => {
        const team = getUserTeam(w);
        const key = btn.dataset.up;
        const fac = team.facilities[key];
        const cost = getFacilityUpgradeCost(team, key);
        if (team.cash < cost || fac.level >= fac.maxLevel) return;
        team.cash -= cost;
        team.expenses += cost;
        fac.level += 1;
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
  });
}

export function renderPlayerDetail(main, state, id) {
  const p = state.players.find((x) => x.pid === id);
  if (!p) return (main.innerHTML = '<p>Player not found.</p>');
  const attrs = Object.entries(p.attrs).map(([k, v]) => `${k}: ${Math.round(v)}`).join(', ');
  main.innerHTML = `<h1>${p.name}</h1><p>Team: ${p.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === p.tid)?.name}</p><p>OVR: ${p.ovr}</p><p>Roles: ${p.roles.join(', ')} | Current: ${p.currentRole}</p><p>Secondary: ${p.secondaryRoles.join(', ')}</p><p>${attrs}</p><h3>History</h3><ul>${p.history.map((h) => `<li>${h}</li>`).join('') || '<li>No history</li>'}</ul>`;
}

export function renderCoachDetail(main, state, id) {
  const c = state.coaches.find((x) => x.cid === id);
  if (!c) return (main.innerHTML = '<p>Coach not found.</p>');
  const r = c.ratings;
  const s = c.styleSliders;
  main.innerHTML = `<h1>${c.profile.name}</h1><p>${c.staffRole} • ${c.profile.age} • ${c.profile.nationality} • ${c.profile.styleTag}</p>
  <p>Team: ${c.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === c.tid)?.name}</p>
  <h3>Prep & Strategy</h3><p>prep ${r.prep}, mapPool ${r.mapPool}, vetoSkill ${r.vetoSkill}, compCrafting ${r.compCrafting}, midSeriesAdapt ${r.midSeriesAdapt}</p>
  <h3>Player Development</h3><p>practiceDesign ${r.practiceDesign}, skillDevelopment ${r.skillDevelopment}, roleDevelopment ${r.roleDevelopment}, talentID ${r.talentID}</p>
  <h3>Leadership & Management</h3><p>leadership ${r.leadership}, discipline ${r.discipline}, cultureFit ${r.cultureFit}, conflictMgmt ${r.conflictMgmt}</p>
  <h3>Pressure & Match Handling</h3><p>timeoutValue ${r.timeoutValue}, clutchControl ${r.clutchControl}, composure ${r.composure}, riskBalance ${r.riskBalance}</p>
  <h3>Style Sliders</h3><p>aggressionBias ${s.aggressionBias}, structureBias ${s.structureBias}, innovationBias ${s.innovationBias}, rookieTrust ${s.rookieTrust}, egoManagementBias ${s.egoManagementBias}</p>
  <h3>History</h3><ul>${c.history.map((h) => `<li>${h}</li>`).join('') || '<li>No history</li>'}</ul>`;
}
