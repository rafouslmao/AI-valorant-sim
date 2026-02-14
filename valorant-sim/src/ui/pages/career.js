import { FACILITY_CONFIG, INTENSITIES, MAP_POOL, PRACTICE_FOCUS, ROSTER_LIMIT, SECONDARY_ROLE_TAGS, TRAINING_PRIMARY, TRAINING_SECONDARY } from '../../core/constants.js';
import { mutateWorld } from '../../core/state.js';
import { getFacilityUpgradeCost, openMatch, playMatchMap, playMatchRounds, playMatchSeries, playMatchToHalf, simulateNextMatchForUserTeam, simulateWeek } from '../../core/sim.js';
import { evaluateOffer, marketValue, startNegotiation, submitOffer } from '../../core/contracts.js';
import { projectedTrainingImpact } from '../../core/training.js';
import { addMessage, getUnreadCount } from '../../core/messages.js';
import { formatMoney } from '../../core/utils.js';

const MAP_PREFS = ['PermaBan', 'Dislike', 'Neutral', 'Like', 'PermaPick'];

function getUserTeam(state) { return state.teams.find((t) => t.tid === state.userTid); }
function isCoachMode(state) { return state.meta.mode === 'Coach'; }
function userCoach(state) { return state.coaches.find((c) => c.tid === state.userTid && c.staffRole === 'Head Coach'); }

export function getLayoutBadges(state) {
  return { messages: getUnreadCount(state) || undefined };
}

export function simulateNextAction() { mutateWorld((w) => simulateNextMatchForUserTeam(w)); window.dispatchEvent(new HashChangeEvent('hashchange')); }
export function simulateWeekAction() { mutateWorld((w) => simulateWeek(w)); window.dispatchEvent(new HashChangeEvent('hashchange')); }

export function renderHome(main, state) {
  const team = getUserTeam(state);
  const coachText = isCoachMode(state) ? '<p><strong>You are the Head Coach</strong></p>' : '';
  main.innerHTML = `<h1>Career Home</h1>${coachText}<p><strong>${state.meta.userName}</strong> (${state.meta.mode}) • ${team.name}</p><p>Season ${state.meta.year}, Week ${state.meta.week}</p><p>Record: ${team.wins}-${team.losses}</p>`;
}

export function renderRoster(main, state) {
  const roster = state.players.filter((p) => p.tid === state.userTid);
  main.innerHTML = `<h1>Roster</h1><table><tr><th>Player</th><th>OVR</th><th>Current Role</th><th>Secondary Tag</th></tr>${roster.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${p.ovr}</td><td>${p.currentRole}</td><td><select data-secondary-tag="${p.pid}">${SECONDARY_ROLE_TAGS.map((r) => `<option ${p.secondaryRoleTag === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td></tr>`).join('')}</table>`;
  main.querySelectorAll('[data-secondary-tag]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const p = w.players.find((x) => x.pid === sel.dataset.secondaryTag);
    if (p) {
      p.secondaryRoleTag = sel.value;
      addMessage(w, { from: { type: 'system', name: 'Staff' }, subject: `Role update: ${p.name}`, body: `${p.name} secondary tag changed to ${sel.value}.`, category: 'roster', related: { playerId: p.pid } });
    }
  }));
}

function matchResultText(state, m) {
  if (m.status !== 'final') return m.status === 'inProgress' ? 'In Progress' : 'Scheduled';
  return m.result?.maps?.map((map) => `${map.mapName} ${map.finalScore[m.homeTid]}-${map.finalScore[m.awayTid]}`).join(' | ') || m.result?.summary || 'Final';
}

export function renderMatches(main, state) {
  const matches = state.schedule.filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
  const abbr = (tid) => state.teams.find((t) => t.tid === tid)?.abbrev ?? '?';
  main.innerHTML = `<h1>Matches</h1><table><tr><th>Week</th><th>Match</th><th>Status</th><th></th></tr>${matches.map((m) => `<tr><td>${m.week}</td><td>${abbr(m.homeTid)} vs ${abbr(m.awayTid)}</td><td>${matchResultText(state, m)}</td><td>${m.status === 'final' ? `<a href="#/match?id=${m.mid}">View Result</a>` : `<a href="#/match?id=${m.mid}">Open Match</a>`}</td></tr>`).join('')}</table>`;
}

export function renderMatchView(main, state, id) {
  const matches = state.schedule.filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
  const match = matches.find((m) => m.mid === id) || matches.find((m) => m.status !== 'final') || matches[0];
  if (!match) return (main.innerHTML = '<p>No user matches.</p>');

  mutateWorld((w) => openMatch(w, match.mid));
  const live = match.live;

  const map = live?.maps?.[live.mapIndex];
  const ecoLine = map ? `${map.credits[match.homeTid]} / ${map.credits[match.awayTid]}` : '-';
  const scoreLine = map ? `${map.score[match.homeTid]} - ${map.score[match.awayTid]}` : (match.result?.summary || '-');
  const lineup = state.players.filter((p) => p.tid === state.userTid).slice(0, 5).map((p) => `${p.name} (${p.currentRole})`).join(', ');

  main.innerHTML = `<h1>Match View</h1>
  <p><strong>Status:</strong> ${match.status}</p>
  <p><strong>Current map:</strong> ${map?.mapName || 'Completed'}</p>
  <p><strong>Series:</strong> ${live ? `${live.seriesScore[match.homeTid]}-${live.seriesScore[match.awayTid]}` : match.result?.summary}</p>
  <p><strong>Round score:</strong> ${scoreLine}</p>
  <p><strong>Credits:</strong> ${ecoLine}</p>
  <p><strong>Lineup:</strong> ${lineup}</p>
  <div class="top-actions">
    <button id="r1">Play Next Round</button>
    <button id="r3">Play Next 3 Rounds</button>
    <button id="half">Sim to Half</button>
    <button id="map">Sim Map</button>
    <button id="series">Sim Series</button>
  </div>
  <pre>${(live?.log || []).slice(-18).join('\n')}</pre>`;

  const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  main.querySelector('#r1').onclick = () => { mutateWorld((w) => playMatchRounds(w, match.mid, 1)); refresh(); };
  main.querySelector('#r3').onclick = () => { mutateWorld((w) => playMatchRounds(w, match.mid, 3)); refresh(); };
  main.querySelector('#half').onclick = () => { mutateWorld((w) => playMatchToHalf(w, match.mid)); refresh(); };
  main.querySelector('#map').onclick = () => { mutateWorld((w) => playMatchMap(w, match.mid)); refresh(); };
  main.querySelector('#series').onclick = () => { mutateWorld((w) => playMatchSeries(w, match.mid)); refresh(); };
}

export function renderStrategy(main, state) {
  const team = getUserTeam(state);
  const readOnly = !isCoachMode(state) && team.strategy.delegateToCoach;
  main.innerHTML = `<h1>Strategy</h1><p>${isCoachMode(state) ? 'Coach mode: strategy drives veto and economy choices.' : 'GM mode: toggle delegation to coach.'}</p>
  <label>Delegate to Coach <select id="delegate"><option value="true" ${team.strategy.delegateToCoach ? 'selected' : ''}>true</option><option value="false" ${!team.strategy.delegateToCoach ? 'selected' : ''}>false</option></select></label>
  <label>Economy Risk <input id="econRisk" type="range" min="0" max="1" step="0.05" value="${team.strategy.economyRisk}" ${readOnly ? 'disabled' : ''}/></label>
  <label>Aggression <input id="aggr" type="range" min="0" max="1" step="0.05" value="${team.strategy.aggression}" ${readOnly ? 'disabled' : ''}/></label>
  <label>Comp Comfort <input id="comp" type="range" min="0" max="1" step="0.05" value="${team.strategy.compComfort}" ${readOnly ? 'disabled' : ''}/></label>
  <table><tr><th>Map</th><th>Preference</th></tr>${MAP_POOL.map((m) => `<tr><td>${m.name}</td><td><select data-map="${m.id}" ${readOnly ? 'disabled' : ''}>${MAP_PREFS.map((p) => `<option ${team.strategy.mapPreferences[m.id] === p ? 'selected' : ''}>${p}</option>`).join('')}</select></td></tr>`).join('')}</table>`;

  main.querySelector('#delegate').onchange = (e) => mutateWorld((w) => { getUserTeam(w).strategy.delegateToCoach = e.target.value === 'true'; });
  ['#econRisk', '#aggr', '#comp'].forEach((id) => {
    const el = main.querySelector(id);
    if (!el) return;
    el.onchange = () => mutateWorld((w) => {
      const t = getUserTeam(w);
      t.strategy.economyRisk = Number(main.querySelector('#econRisk').value);
      t.strategy.aggression = Number(main.querySelector('#aggr').value);
      t.strategy.compComfort = Number(main.querySelector('#comp').value);
    });
  });
  main.querySelectorAll('[data-map]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    getUserTeam(w).strategy.mapPreferences[sel.dataset.map] = sel.value;
  }));
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
  return { projectedPerformance: projected, fitScore: Math.round((roleNeed + projected) / 2), costToValue, riskLevel: p.age > 27 ? 'Medium' : 'Low', reasoningScore: Math.round((projected + roleNeed) / 2), priorityLevel: projected > 80 ? 'High' : projected > 68 ? 'Medium' : 'Low' };
}

function negotiationPanel(player) {
  const val = marketValue(player);
  return `<div class="card"><label>Salary<input id="neg-salary" type="number" value="${val}" /></label><label>Years<select id="neg-years"><option>1</option><option selected>2</option><option>3</option></select></label><label>Role Promise<select id="neg-role"><option>starter</option><option>bench</option></select></label><label>Signing Bonus<input id="neg-bonus" type="number" value="${Math.round(val * 0.2)}" /></label><button id="submit-neg">Submit Offer</button><div id="neg-out"></div></div>`;
}

export function renderFreeAgents(main, state) {
  const coachMode = isCoachMode(state);
  const rosterCount = state.players.filter((p) => p.tid === state.userTid).length;
  const freeAgents = state.players.filter((p) => p.tid === null).slice(0, 30);
  main.innerHTML = `<h1>Free Agents</h1><p>Roster spots: ${rosterCount}/${ROSTER_LIMIT}</p><table><tr><th>Name</th><th>OVR</th><th>Expected Salary</th><th>Traits</th><th>Expected Role</th><th>Action</th></tr>${freeAgents.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${p.ovr}</td><td>${formatMoney(marketValue(p))}</td><td>A:${p.ambition} L:${p.loyalty} G:${p.greed}</td><td>${p.preferredRole}</td><td>${coachMode ? `<button data-recommend="${p.pid}">Recommend to GM</button>` : `<button data-negotiate="${p.pid}">Negotiate</button>`}</td></tr>`).join('')}</table><div id="fa-extra"></div>${!coachMode ? '<h3>Recommendations</h3><div id="gm-recs"></div>' : ''}`;

  if (coachMode) {
    main.querySelectorAll('[data-recommend]').forEach((btn) => btn.onclick = () => {
      mutateWorld((w) => {
        const p = w.players.find((x) => x.pid === btn.dataset.recommend); if (!p) return;
        const coach = userCoach(w);
        const calc = recommendationPayload(w, p);
        const rec = { id: `${p.pid}_${Date.now()}`, playerId: p.pid, recommendedByCoachId: coach?.cid, timestamp: Date.now(), ...calc };
        w.recommendations.push(rec);
        addMessage(w, { from: { type: 'coach', name: coach?.profile.name || 'Coach' }, subject: `Recommendation sent: ${p.name}`, body: `Fit ${calc.fitScore}, projected ${calc.projectedPerformance}, C2V ${calc.costToValue}, risk ${calc.riskLevel}.`, category: 'recommendation', related: { playerId: p.pid, recommendationId: rec.id } });
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  } else {
    main.querySelectorAll('[data-negotiate]').forEach((btn) => btn.onclick = () => {
      const p = state.players.find((x) => x.pid === btn.dataset.negotiate);
      const extra = main.querySelector('#fa-extra');
      extra.innerHTML = `<h3>Negotiation: ${p.name}</h3>${negotiationPanel(p)}`;
      extra.querySelector('#submit-neg').onclick = () => {
        mutateWorld((w) => {
          let neg = Object.values(w.negotiations).find((n) => n.playerId === p.pid && n.teamId === w.userTid);
          if (!neg) neg = startNegotiation(w, p.pid, w.userTid);
          const offer = { salary: Number(extra.querySelector('#neg-salary').value), years: Number(extra.querySelector('#neg-years').value), rolePromise: extra.querySelector('#neg-role').value, signingBonus: Number(extra.querySelector('#neg-bonus').value) };
          const res = submitOffer(w, neg.id, offer);
          const context = { team: getUserTeam(w), teamReputation: getUserTeam(w).teamReputation, rosterStrength: getUserTeam(w).rosterStrength, facilitiesLevel: getUserTeam(w).facilitiesLevel, financialStability: getUserTeam(w).financialStability, coachQuality: getUserTeam(w).coachQuality };
          const evalNow = evaluateOffer(w.players.find((x) => x.pid === p.pid), context, offer, p.tid);
          extra.querySelector('#neg-out').innerHTML = `<p>Interest: ${evalNow.interest}/100</p><p>${res?.accepted ? 'Accepted' : res?.counter ? 'Countered' : 'Rejected'}</p><p>${(res?.reasons || evalNow.reasons || []).join(', ')}</p>`;
        });
      };
    });

    const recWrap = main.querySelector('#gm-recs');
    recWrap.innerHTML = state.recommendations.map((r) => {
      const p = state.players.find((x) => x.pid === r.playerId); if (!p) return '';
      return `<div class="save-row"><div><strong>${p.name}</strong> Fit ${r.fitScore} • C2V ${r.costToValue} • Risk ${r.riskLevel}</div><div><button data-accept-rec="${r.id}">Accept</button><button data-reject-rec="${r.id}">Reject</button></div></div>`;
    }).join('') || '<p>No recommendations.</p>';

    recWrap.querySelectorAll('[data-accept-rec]').forEach((btn) => btn.onclick = () => {
      mutateWorld((w) => {
        const rec = w.recommendations.find((x) => x.id === btn.dataset.acceptRec); if (!rec) return;
        const p = w.players.find((x) => x.pid === rec.playerId); if (!p) return;
        const neg = startNegotiation(w, p.pid, w.userTid);
        submitOffer(w, neg.id, { salary: marketValue(p), years: 2, rolePromise: 'starter', signingBonus: Math.round(marketValue(p) * 0.2) });
        addMessage(w, { from: { type: 'gm', name: 'GM Office' }, subject: `Acted on recommendation: ${p.name}`, body: `GM opened negotiation for ${p.name}.`, category: 'recommendation', related: { playerId: p.pid, recommendationId: rec.id } });
        w.recommendations = w.recommendations.filter((x) => x.id !== rec.id);
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    recWrap.querySelectorAll('[data-reject-rec]').forEach((btn) => btn.onclick = () => {
      mutateWorld((w) => {
        const rec = w.recommendations.find((x) => x.id === btn.dataset.rejectRec);
        if (rec) addMessage(w, { from: { type: 'gm', name: 'GM Office' }, subject: 'Recommendation dismissed', body: `A recommendation was dismissed by GM.`, category: 'recommendation', related: { recommendationId: rec.id } });
        w.recommendations = w.recommendations.filter((x) => x.id !== btn.dataset.rejectRec);
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }
}

export function renderStaff(main, state) {
  const staff = state.coaches.filter((c) => c.tid === state.userTid);
  const market = state.coaches.filter((c) => c.tid === null);
  const coachMode = isCoachMode(state);
  main.innerHTML = `<h1>Staff</h1>${coachMode ? '<p>You are the Head Coach.</p>' : ''}<h3>My Staff</h3><ul>${staff.map((c) => `<li><a href="#/coach?id=${c.cid}">${c.profile.name}</a> — ${c.staffRole} — Salary ${formatMoney(c.salary)}</li>`).join('') || '<li>No staff</li>'}</ul><h3>Coach Market</h3><table><tr><th>Name</th><th>Style</th><th>Prep</th><th>Leadership</th><th></th></tr>${market.slice(0, 25).map((c) => `<tr><td><a href="#/coach?id=${c.cid}">${c.profile.name}</a></td><td>${c.profile.styleTag}</td><td>${c.ratings.prep}</td><td>${c.ratings.leadership}</td><td><button data-sign-coach="${c.cid}" ${coachMode ? 'disabled' : ''}>Sign Head Coach</button></td></tr>`).join('')}</table>`;
  main.querySelectorAll('[data-sign-coach]').forEach((btn) => btn.onclick = () => {
    if (coachMode) return;
    mutateWorld((w) => {
      const old = w.coaches.find((c) => c.tid === w.userTid && c.staffRole === 'Head Coach'); if (old) old.tid = null;
      const coach = w.coaches.find((c) => c.cid === btn.dataset.signCoach); if (!coach) return;
      coach.tid = w.userTid; coach.staffRole = 'Head Coach';
      getUserTeam(w).headCoachId = coach.cid;
      addMessage(w, { from: { type: 'gm', name: 'GM Office' }, subject: `New Head Coach: ${coach.profile.name}`, body: `${coach.profile.name} was hired as Head Coach.`, category: 'roster', related: { teamId: w.userTid } });
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
  main.innerHTML = `<h1>Practice</h1><table><tr><th>Player</th><th>Primary Focus</th><th>Secondary Focus</th><th>Intensity</th><th>Growth</th><th>Fatigue</th></tr>${roster.map((p) => { const proj = projectedTrainingImpact(p, team); return `<tr><td>${p.name}</td><td><select data-pf="${p.pid}">${TRAINING_PRIMARY.map((f) => `<option ${p.trainingPlan.primaryFocus === f ? 'selected' : ''}>${f}</option>`).join('')}</select></td><td><select data-sf="${p.pid}">${TRAINING_SECONDARY.map((f) => `<option ${p.trainingPlan.secondaryFocus === f ? 'selected' : ''}>${f}</option>`).join('')}</select></td><td><select data-int="${p.pid}">${INTENSITIES.map((i) => `<option ${p.trainingPlan.intensity === i ? 'selected' : ''}>${i}</option>`).join('')}</select></td><td>${proj.growthEstimate}</td><td>${proj.fatigueDelta}</td></tr>`; }).join('')}</table>`;
  main.querySelectorAll('[data-pf]').forEach((sel) => sel.onchange = () => mutateWorld((w) => { const p = w.players.find((x) => x.pid === sel.dataset.pf); if (p) p.trainingPlan.primaryFocus = sel.value; }));
  main.querySelectorAll('[data-sf]').forEach((sel) => sel.onchange = () => mutateWorld((w) => { const p = w.players.find((x) => x.pid === sel.dataset.sf); if (p) p.trainingPlan.secondaryFocus = sel.value; }));
  main.querySelectorAll('[data-int]').forEach((sel) => sel.onchange = () => mutateWorld((w) => { const p = w.players.find((x) => x.pid === sel.dataset.int); if (p) p.trainingPlan.intensity = sel.value; }));
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
  main.innerHTML = `<h1>${p.name}</h1><p>Team: ${p.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === p.tid)?.name}</p><p>OVR: ${p.ovr}</p><p>Roles: ${p.roles.join(', ')} | Current: ${p.currentRole} | Secondary Tag: ${p.secondaryRoleTag}</p><p>Contract: ${formatMoney(p.currentContract.salaryPerYear)} / ${p.currentContract.yearsRemaining}y (${p.currentContract.rolePromise})</p><p>${attrs}</p>`;
}

export function renderCoachDetail(main, state, id) {
  const c = state.coaches.find((x) => x.cid === id);
  if (!c) return (main.innerHTML = '<p>Coach not found.</p>');
  const r = c.ratings;
  main.innerHTML = `<h1>${c.profile.name}</h1><p>${c.staffRole} • ${c.profile.age} • ${c.profile.nationality} • ${c.profile.styleTag}</p><p>Team: ${c.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === c.tid)?.name}</p><p>prep ${r.prep}, veto ${r.vetoSkill}, leadership ${r.leadership}, dev ${r.skillDevelopment}</p>`;
}
