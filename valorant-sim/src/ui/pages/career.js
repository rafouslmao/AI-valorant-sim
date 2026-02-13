import { FACILITY_CONFIG, INTENSITIES, PRACTICE_FOCUS, ROLES, ROSTER_LIMIT, SECONDARY_ROLE_TAGS, TRAINING_PRIMARY, TRAINING_SECONDARY } from '../../core/constants.js';
import { mutateWorld } from '../../core/state.js';
import { getFacilityUpgradeCost, simulateNextMatchForUserTeam, simulateWeek } from '../../core/sim.js';
import { evaluateOffer, marketValue, startNegotiation, submitOffer } from '../../core/contracts.js';
import { projectedTrainingImpact } from '../../core/training.js';
import { formatMoney } from '../../core/utils.js';

function getUserTeam(state) { return state.teams.find((t) => t.tid === state.userTid); }
function isCoachMode(state) { return state.meta.mode === 'Coach'; }
function userCoach(state) { return state.coaches.find((c) => c.tid === state.userTid && c.staffRole === 'Head Coach'); }

export function simulateNextAction() { mutateWorld((w) => simulateNextMatchForUserTeam(w)); window.dispatchEvent(new HashChangeEvent('hashchange')); }
export function simulateWeekAction() { mutateWorld((w) => simulateWeek(w)); window.dispatchEvent(new HashChangeEvent('hashchange')); }

export function renderHome(main, state) {
  const team = getUserTeam(state);
  main.innerHTML = `<h1>Career Home</h1><p><strong>${state.meta.userName}</strong> (${state.meta.mode}) • ${team.name}</p><p>Season ${state.meta.year}, Week ${state.meta.week}</p><p>Record: ${team.wins}-${team.losses}</p>`;
}

function roleOptions(player) { return player.roles.map((r) => `<option ${player.currentRole === r ? 'selected' : ''}>${r}</option>`).join(''); }
function secondaryTagOptions(player) { return SECONDARY_ROLE_TAGS.map((r) => `<option ${player.secondaryRoleTag === r ? 'selected' : ''}>${r}</option>`).join(''); }

export function renderRoster(main, state) {
  const roster = state.players.filter((p) => p.tid === state.userTid);
  const drawRows = (players, isStarter) => players.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${p.ovr}</td><td><select data-role="${p.pid}">${roleOptions(p)}</select></td><td><select data-secondary-tag="${p.pid}">${secondaryTagOptions(p)}</select></td><td><button data-swap="${p.pid}" data-target="${isStarter ? 'bench' : 'start'}">${isStarter ? 'Bench' : 'Start'}</button></td></tr>`).join('');
  main.innerHTML = `<h1>Roster</h1><h3>Starters</h3><table><tr><th>Player</th><th>OVR</th><th>Current Role</th><th>Secondary Tag</th><th>Move</th></tr>${drawRows(roster.slice(0, 5), true)}</table><h3>Bench</h3><table><tr><th>Player</th><th>OVR</th><th>Current Role</th><th>Secondary Tag</th><th>Move</th></tr>${drawRows(roster.slice(5), false)}</table>`;

  main.querySelectorAll('[data-role]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const p = w.players.find((x) => x.pid === sel.dataset.role); if (!p) return;
    p.currentRole = sel.value;
  }));

  main.querySelectorAll('[data-secondary-tag]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const p = w.players.find((x) => x.pid === sel.dataset.secondaryTag); if (p) p.secondaryRoleTag = sel.value;
  }));

  main.querySelectorAll('[data-swap]').forEach((btn) => btn.onclick = () => {
    mutateWorld((w) => {
      const userRoster = w.players.filter((p) => p.tid === w.userTid);
      const player = userRoster.find((p) => p.pid === btn.dataset.swap); if (!player) return;
      const target = userRoster[btn.dataset.target === 'bench' ? 5 : 4];
      if (!target) return;
      [w.players[w.players.indexOf(player)], w.players[w.players.indexOf(target)]] = [target, player];
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function matchStatusLine(state, m) {
  if (!m.played || !m.result) return 'Unplayed';
  const t = (tid) => state.teams.find((x) => x.tid === tid)?.abbrev;
  const maps = m.result.maps?.map((map) => `${map.mapName} ${map.finalScore[m.homeTid]}-${map.finalScore[m.awayTid]}`).join(' | ') ?? '';
  return `${m.result.summary} • ${maps}`;
}

export function renderMatches(main, state) {
  const matches = state.schedule.filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
  const abbr = (tid) => state.teams.find((t) => t.tid === tid)?.abbrev ?? '?';
  main.innerHTML = `<h1>Matches</h1><table><tr><th>Week</th><th>Match</th><th>Result</th></tr>${matches.map((m) => `<tr><td>${m.week}</td><td>${abbr(m.homeTid)} vs ${abbr(m.awayTid)}</td><td>${matchStatusLine(state, m)}</td></tr>`).join('')}</table>`;
}

export function renderPlayers(main, state) {
  const players = [...state.players].sort((a, b) => b.ovr - a.ovr);
  const teamName = (tid) => tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === tid)?.abbrev;
  main.innerHTML = `<h1>Players</h1><table><tr><th>Name</th><th>Team</th><th>OVR</th><th>Roles</th><th>Tag</th></tr>${players.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${teamName(p.tid)}</td><td>${p.ovr}</td><td>${p.roles.join(', ')}</td><td>${p.secondaryRoleTag}</td></tr>`).join('')}</table>`;
}

function recommendationPayload(state, p) {
  const roster = state.players.filter((x) => x.tid === state.userTid).slice(0, 5);
  const roleNeed = roster.filter((x) => x.currentRole === p.currentRole).length === 0 ? 84 : 60;
  const projected = Math.round(p.ovr * 0.6 + p.roleSkills[p.currentRole] * 0.4);
  const costToValue = Math.round((projected / Math.max(1, p.currentContract?.salaryPerYear || p.salary)) * 100000);
  return {
    projectedPerformance: projected,
    fitScore: Math.round((roleNeed + projected) / 2),
    costToValue,
    riskLevel: p.age > 27 ? 'Medium' : 'Low',
    reasoningScore: Math.round((projected + roleNeed) / 2),
    priorityLevel: projected > 80 ? 'High' : projected > 68 ? 'Medium' : 'Low'
  };
}

function negotiationPanel(state, player) {
  const val = marketValue(player);
  return `
  <details>
    <summary>Open Negotiation</summary>
    <div class="card">
      <label>Salary per year<input id="neg-salary" type="number" value="${val}" /></label>
      <label>Years<select id="neg-years"><option>1</option><option selected>2</option><option>3</option></select></label>
      <label>Role Promise<select id="neg-role"><option>starter</option><option>bench</option></select></label>
      <label>Signing Bonus<input id="neg-bonus" type="number" value="${Math.round(val * 0.2)}" /></label>
      <button id="start-neg">Start/Submit</button>
      <div id="neg-out"></div>
    </div>
  </details>`;
}

export function renderFreeAgents(main, state) {
  const coachMode = isCoachMode(state);
  const rosterCount = state.players.filter((p) => p.tid === state.userTid).length;
  const freeAgents = state.players.filter((p) => p.tid === null).slice(0, 30);
  main.innerHTML = `<h1>Free Agents</h1><p>Roster spots: ${rosterCount}/${ROSTER_LIMIT}</p>
  <h3>${coachMode ? 'Coach Recommendations' : 'Negotiation Market'}</h3>
  <table><tr><th>Name</th><th>OVR</th><th>Expected Salary</th><th>Rep</th><th>Traits</th><th>Expected Role</th><th>Action</th></tr>
  ${freeAgents.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${p.ovr}</td><td>${formatMoney(marketValue(p))}</td><td>${p.reputation}</td><td>A:${p.ambition} L:${p.loyalty} G:${p.greed}</td><td>${p.preferredRole}</td><td>${coachMode ? `<button data-recommend="${p.pid}">Recommend to GM</button>` : `<button data-negotiate="${p.pid}">Negotiate</button>`}</td></tr>`).join('')}
  </table>
  <div id="fa-extra"></div>
  ${!coachMode ? `<h3>GM Recommendations Inbox</h3><div id="gm-recs"></div>` : ''}`;

  if (coachMode) {
    main.querySelectorAll('[data-recommend]').forEach((btn) => btn.onclick = () => {
      mutateWorld((w) => {
        const p = w.players.find((x) => x.pid === btn.dataset.recommend); if (!p) return;
        const coach = userCoach(w);
        const calc = recommendationPayload(w, p);
        w.recommendations.push({
          id: `${p.pid}_${Date.now()}`,
          playerId: p.pid,
          recommendedByCoachId: coach?.cid,
          timestamp: Date.now(),
          ...calc
        });
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  } else {
    main.querySelectorAll('[data-negotiate]').forEach((btn) => btn.onclick = () => {
      const p = state.players.find((x) => x.pid === btn.dataset.negotiate);
      const extra = main.querySelector('#fa-extra');
      extra.innerHTML = `<h3>Negotiation: ${p.name}</h3>${negotiationPanel(state, p)}`;
      extra.querySelector('#start-neg').onclick = () => {
        mutateWorld((w) => {
          const player = w.players.find((x) => x.pid === p.pid);
          const team = getUserTeam(w);
          let neg = Object.values(w.negotiations).find((n) => n.playerId === p.pid && n.teamId === w.userTid);
          if (!neg) neg = startNegotiation(w, p.pid, w.userTid);
          const offer = {
            salary: Number(extra.querySelector('#neg-salary').value),
            years: Number(extra.querySelector('#neg-years').value),
            rolePromise: extra.querySelector('#neg-role').value,
            signingBonus: Number(extra.querySelector('#neg-bonus').value)
          };
          const result = submitOffer(w, neg.id, offer);
          const context = { team, teamReputation: team.teamReputation, rosterStrength: team.rosterStrength, facilitiesLevel: team.facilitiesLevel, financialStability: team.financialStability, coachQuality: team.coachQuality };
          const scoreNow = evaluateOffer(player, context, offer, player.tid);
          extra.querySelector('#neg-out').innerHTML = `<p>Interest: <strong>${scoreNow.interest}</strong>/100</p><p>${result?.accepted ? 'Accepted ✅' : 'Rejected/Counter ❌'}</p><p>${(result?.reasons || scoreNow.reasons || []).join(', ')}</p><p>${result?.counter ? `Counter: ${formatMoney(result.counter.salary)} • ${result.counter.years}y • ${result.counter.rolePromise}` : ''}</p>`;
        });
      };
    });

    const recWrap = main.querySelector('#gm-recs');
    recWrap.innerHTML = state.recommendations.map((r) => {
      const p = state.players.find((x) => x.pid === r.playerId);
      if (!p) return '';
      return `<div class="save-row"><div><strong>${p.name}</strong> Fit ${r.fitScore} • C2V ${r.costToValue} • Risk ${r.riskLevel} • Priority ${r.priorityLevel}</div><div><button data-accept-rec="${r.id}">Accept</button> <button data-reject-rec="${r.id}">Reject</button></div></div>`;
    }).join('') || '<p>No recommendations.</p>';

    recWrap.querySelectorAll('[data-accept-rec]').forEach((btn) => btn.onclick = () => {
      mutateWorld((w) => {
        const rec = w.recommendations.find((x) => x.id === btn.dataset.acceptRec);
        if (!rec) return;
        const p = w.players.find((x) => x.pid === rec.playerId);
        if (!p) return;
        const neg = startNegotiation(w, p.pid, w.userTid);
        submitOffer(w, neg.id, { salary: marketValue(p), years: 2, rolePromise: 'starter', signingBonus: Math.round(marketValue(p) * 0.2) });
        w.recommendations = w.recommendations.filter((x) => x.id !== rec.id);
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    recWrap.querySelectorAll('[data-reject-rec]').forEach((btn) => btn.onclick = () => {
      mutateWorld((w) => { w.recommendations = w.recommendations.filter((x) => x.id !== btn.dataset.rejectRec); });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }
}

export function renderStaff(main, state) {
  const staff = state.coaches.filter((c) => c.tid === state.userTid);
  const market = state.coaches.filter((c) => c.tid === null);
  main.innerHTML = `<h1>Staff</h1><h3>My Staff</h3><ul>${staff.map((c) => `<li><a href="#/coach?id=${c.cid}">${c.profile.name}</a> — ${c.staffRole} — Salary ${formatMoney(c.salary)}</li>`).join('') || '<li>No staff</li>'}</ul><h3>Coach Market</h3><table><tr><th>Name</th><th>Style</th><th>Prep</th><th>Leadership</th><th></th></tr>${market.slice(0, 25).map((c) => `<tr><td><a href="#/coach?id=${c.cid}">${c.profile.name}</a></td><td>${c.profile.styleTag}</td><td>${c.ratings.prep}</td><td>${c.ratings.leadership}</td><td><button data-sign-coach="${c.cid}" ${isCoachMode(state) ? 'disabled' : ''}>Sign Head Coach</button></td></tr>`).join('')}</table>`;
  main.querySelectorAll('[data-sign-coach]').forEach((btn) => btn.onclick = () => {
    if (isCoachMode(state)) return;
    mutateWorld((w) => {
      const old = w.coaches.find((c) => c.tid === w.userTid && c.staffRole === 'Head Coach'); if (old) old.tid = null;
      const coach = w.coaches.find((c) => c.cid === btn.dataset.signCoach); if (!coach) return;
      coach.tid = w.userTid; coach.staffRole = 'Head Coach'; coach.history.push(`Hired by ${getUserTeam(w).name}`);
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

export function renderFinances(main, state) {
  const t = getUserTeam(state);
  const latest = t.monthlyLedger[t.monthlyLedger.length - 1];
  main.innerHTML = `<h1>Finances</h1><p>Budget: ${formatMoney(t.budget)}</p><p>Cash: ${formatMoney(t.cash)}</p><p>Revenue: ${formatMoney(t.revenue)}</p><p>Expenses: ${formatMoney(t.expenses)}</p>${latest ? `<h3>Latest Monthly Expense</h3><p>Players: ${formatMoney(latest.playerSalaries)} | Staff: ${formatMoney(latest.staffSalaries)} | Facilities: ${formatMoney(latest.facilityMaintenance)} | Total: ${formatMoney(latest.total)}</p>` : '<p>No monthly ledger yet.</p>'}`;
}

export function renderPractice(main, state) {
  const team = getUserTeam(state);
  const roster = state.players.filter((p) => p.tid === state.userTid);
  main.innerHTML = `<h1>Practice</h1><p>Per-player structured training plans.</p><table><tr><th>Player</th><th>Primary Role Focus</th><th>Secondary Focus</th><th>Intensity</th><th>Projected Growth</th><th>Fatigue +</th></tr>${roster.map((p) => {
    const proj = projectedTrainingImpact(p, team);
    return `<tr><td>${p.name}</td><td><select data-pf="${p.pid}">${TRAINING_PRIMARY.map((f) => `<option ${p.trainingPlan.primaryFocus === f ? 'selected' : ''}>${f}</option>`).join('')}</select></td><td><select data-sf="${p.pid}">${TRAINING_SECONDARY.map((f) => `<option ${p.trainingPlan.secondaryFocus === f ? 'selected' : ''}>${f}</option>`).join('')}</select></td><td><select data-int="${p.pid}">${INTENSITIES.map((i) => `<option ${p.trainingPlan.intensity === i ? 'selected' : ''}>${i}</option>`).join('')}</select></td><td>${proj.growthEstimate}</td><td>${proj.fatigueDelta}</td></tr>`;
  }).join('')}</table>`;

  main.querySelectorAll('[data-pf]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const p = w.players.find((x) => x.pid === sel.dataset.pf); if (p) p.trainingPlan.primaryFocus = sel.value;
  }));
  main.querySelectorAll('[data-sf]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const p = w.players.find((x) => x.pid === sel.dataset.sf); if (p) p.trainingPlan.secondaryFocus = sel.value;
  }));
  main.querySelectorAll('[data-int]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const p = w.players.find((x) => x.pid === sel.dataset.int); if (p) p.trainingPlan.intensity = sel.value;
  }));
}

export function renderFacilities(main, state) {
  const t = getUserTeam(state);
  const coachMode = isCoachMode(state);
  const rows = Object.entries(FACILITY_CONFIG).map(([key, cfg]) => {
    const f = t.facilities[key]; const cost = getFacilityUpgradeCost(t, key);
    return `<tr><td>${cfg.label}</td><td>${f.level}/${f.maxLevel}</td><td>${formatMoney(f.baseMaintenance * f.level)}</td><td>${formatMoney(cost)}</td><td><button data-up="${key}" ${coachMode || f.level >= f.maxLevel ? 'disabled' : ''}>Upgrade</button></td></tr>`;
  }).join('');
  main.innerHTML = `<h1>Facilities</h1>${coachMode ? '<p>Coach mode: spending disabled.</p>' : ''}<table><tr><th>Facility</th><th>Level</th><th>Maintenance</th><th>Upgrade Cost</th><th></th></tr>${rows}</table><p>Upgrade formula: <code>baseCost * (level + 1)^1.5</code></p>`;
  main.querySelectorAll('[data-up]').forEach((btn) => btn.onclick = () => {
    if (coachMode) return;
    mutateWorld((w) => {
      const team = getUserTeam(w); const key = btn.dataset.up; const fac = team.facilities[key]; const cost = getFacilityUpgradeCost(team, key);
      if (team.cash < cost || fac.level >= fac.maxLevel) return;
      team.cash -= cost; team.expenses += cost; fac.level += 1;
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

export function renderPlayerDetail(main, state, id) {
  const p = state.players.find((x) => x.pid === id);
  if (!p) return (main.innerHTML = '<p>Player not found.</p>');
  const attrs = Object.entries(p.attrs).map(([k, v]) => `${k}: ${Math.round(v)}`).join(', ');
  main.innerHTML = `<h1>${p.name}</h1><p>Team: ${p.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === p.tid)?.name}</p><p>OVR: ${p.ovr}</p><p>Roles: ${p.roles.join(', ')} | Current: ${p.currentRole} | Secondary Tag: ${p.secondaryRoleTag}</p><p>Contract: ${formatMoney(p.currentContract.salaryPerYear)} / ${p.currentContract.yearsRemaining}y (${p.currentContract.rolePromise})</p><p>Traits: rep ${p.reputation}, ambition ${p.ambition}, loyalty ${p.loyalty}, greed ${p.greed}, playtime ${p.playtimeDesire}</p><p>${attrs}</p><h3>History</h3><ul>${p.history.map((h) => `<li>${h}</li>`).join('') || '<li>No history</li>'}</ul>`;
}

export function renderCoachDetail(main, state, id) {
  const c = state.coaches.find((x) => x.cid === id);
  if (!c) return (main.innerHTML = '<p>Coach not found.</p>');
  const r = c.ratings; const s = c.styleSliders;
  main.innerHTML = `<h1>${c.profile.name}</h1><p>${c.staffRole} • ${c.profile.age} • ${c.profile.nationality} • ${c.profile.styleTag}</p><p>Team: ${c.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === c.tid)?.name}</p><h3>Prep & Strategy</h3><p>prep ${r.prep}, mapPool ${r.mapPool}, vetoSkill ${r.vetoSkill}, compCrafting ${r.compCrafting}, midSeriesAdapt ${r.midSeriesAdapt}</p><h3>Player Development</h3><p>practiceDesign ${r.practiceDesign}, skillDevelopment ${r.skillDevelopment}, roleDevelopment ${r.roleDevelopment}, talentID ${r.talentID}</p><h3>Leadership & Management</h3><p>leadership ${r.leadership}, discipline ${r.discipline}, cultureFit ${r.cultureFit}, conflictMgmt ${r.conflictMgmt}</p><h3>Pressure & Match Handling</h3><p>timeoutValue ${r.timeoutValue}, clutchControl ${r.clutchControl}, composure ${r.composure}, riskBalance ${r.riskBalance}</p><h3>Style Sliders</h3><p>aggressionBias ${s.aggressionBias}, structureBias ${s.structureBias}, innovationBias ${s.innovationBias}, rookieTrust ${s.rookieTrust}, egoManagementBias ${s.egoManagementBias}</p>`;
}
