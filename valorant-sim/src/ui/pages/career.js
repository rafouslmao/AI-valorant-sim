import { ALL_AGENTS, FACILITY_CONFIG, INTENSITIES, MAP_POOL, ROSTER_LIMIT, SECONDARY_ROLE_TAGS, TRAINING_PRIMARY, TRAINING_SECONDARY } from '../../core/constants.js';
import { mutateWorld } from '../../core/state.js';
import { getFacilityUpgradeCost, openMatch, playMatchMap, playMatchRounds, playMatchSeries, playMatchToHalf, simulateNextMatchForUserTeam, simulateWeek } from '../../core/sim.js';
import { evaluateOffer, marketValue, startNegotiation, submitOffer } from '../../core/contracts.js';
import { projectedTrainingImpact } from '../../core/training.js';
import { acceptSponsorOffer, declineSponsorOffer } from '../../core/sponsors.js';
import { addMessage, getUnreadCount } from '../../core/messages.js';
import { formatMoney, uid } from '../../core/utils.js';

const MAP_PREFS = ['PermaBan', 'Dislike', 'Neutral', 'Like', 'PermaPick'];

function getUserTeam(state) { return state.teams.find((t) => t.tid === state.userTid); }
function isCoachMode(state) { return state.meta.mode === 'Coach'; }
function userCoach(state) { return state.coaches.find((c) => c.tid === state.userTid && c.staffRole === 'Head Coach'); }
function starters(state, tid) { const t = state.teams.find((x) => x.tid === tid); return (t?.starters || []).map((pid) => state.players.find((p) => p.pid === pid && p.tid === tid)).filter(Boolean); }
function bench(state, tid) { const sids = new Set((state.teams.find((x) => x.tid === tid)?.starters || [])); return state.players.filter((p) => p.tid === tid && !sids.has(p.pid)); }

function recordFromSchedule(state, tid) {
  let w = 0; let l = 0;
  for (const m of state.schedule) {
    if (m.status !== 'final' || !m.result || (m.homeTid !== tid && m.awayTid !== tid)) continue;
    if (m.result.winnerTid === tid) w++; else l++;
  }
  return `${w}-${l}`;
}

export function getLayoutBadges(state) { return { messages: getUnreadCount(state) || undefined }; }
export function simulateNextAction() { mutateWorld((w) => simulateNextMatchForUserTeam(w)); window.dispatchEvent(new HashChangeEvent('hashchange')); }
export function simulateWeekAction() { mutateWorld((w) => simulateWeek(w)); window.dispatchEvent(new HashChangeEvent('hashchange')); }

export function renderHome(main, state) {
  const team = getUserTeam(state);
  const coachText = isCoachMode(state) ? '<p><strong>You are the Head Coach</strong></p>' : '';
  main.innerHTML = `<h1>Career Home</h1>${coachText}<p><strong>${state.meta.userName}</strong> (${state.meta.mode}) • ${team.name}</p><p>Season ${state.meta.year}, Week ${state.meta.week}</p><p>Record: ${recordFromSchedule(state, team.tid)}</p>`;
}

function renderStarterRows(state, tid) {
  return starters(state, tid).map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${p.ovr}</td><td>${p.currentRole}</td><td><select data-secondary-tag="${p.pid}">${SECONDARY_ROLE_TAGS.map((r) => `<option ${p.secondaryRoleTag === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td><button data-to-bench="${p.pid}">Move to Bench</button></td></tr>`).join('');
}
function renderBenchRows(state, tid) {
  return bench(state, tid).map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${p.ovr}</td><td>${p.currentRole}</td><td><button data-to-start="${p.pid}">Move to Starting Lineup</button></td></tr>`).join('');
}

export function renderRoster(main, state) {
  const team = getUserTeam(state);
  const start = starters(state, team.tid);
  const benchList = bench(state, team.tid);
  const warn = start.length < 5 ? '<p class="error">Starting lineup must have 5 players to start/play a match.</p>' : '';
  main.innerHTML = `<h1>Roster</h1>${warn}
  <h3>Starting Lineup (${start.length}/5)</h3>
  <table><tr><th>Player</th><th>OVR</th><th>Role</th><th>Secondary Tag</th><th></th></tr>${renderStarterRows(state, team.tid)}</table>
  <h3>Bench (${benchList.length})</h3>
  <table><tr><th>Player</th><th>OVR</th><th>Role</th><th></th></tr>${renderBenchRows(state, team.tid)}</table>`;

  main.querySelectorAll('[data-secondary-tag]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const p = w.players.find((x) => x.pid === sel.dataset.secondaryTag); if (p) p.secondaryRoleTag = sel.value;
  }));

  main.querySelectorAll('[data-to-bench]').forEach((btn) => btn.onclick = () => {
    mutateWorld((w) => {
      const t = getUserTeam(w);
      t.starters = t.starters.filter((pid) => pid !== btn.dataset.toBench);
      addMessage(w, { from: { type: 'system', name: 'Roster Ops' }, subject: 'Starter moved to bench', body: 'Roster change applied.', category: 'roster' });
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  main.querySelectorAll('[data-to-start]').forEach((btn) => btn.onclick = () => {
    mutateWorld((w) => {
      const t = getUserTeam(w);
      const pid = btn.dataset.toStart;
      if (t.starters.includes(pid)) return;
      if (t.starters.length >= 5) t.starters.shift();
      t.starters.push(pid);
      addMessage(w, { from: { type: 'system', name: 'Roster Ops' }, subject: 'Bench player promoted', body: 'Starting lineup updated.', category: 'roster' });
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function matchResultText(state, m) {
  if (m.status !== 'final') return m.status === 'inProgress' ? 'In Progress' : 'Scheduled';
  return m.result?.maps?.map((map) => `${map.mapName} ${map.finalScore[m.homeTid]}-${map.finalScore[m.awayTid]}`).join(' | ') || m.result?.summary || 'Final';
}

export function renderMatches(main, state) {
  const matches = state.schedule.filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
  const teamByTid = (tid) => state.teams.find((t) => t.tid === tid);
  main.innerHTML = `<h1>Matches</h1><table><tr><th>Week</th><th>Match</th><th>User W-L</th><th>Opp W-L</th><th>Status</th><th></th></tr>${matches.map((m) => {
    const oppTid = m.homeTid === state.userTid ? m.awayTid : m.homeTid;
    const home = teamByTid(m.homeTid); const away = teamByTid(m.awayTid);
    return `<tr><td>${m.week}</td><td>${home.abbrev} vs ${away.abbrev}</td><td>${recordFromSchedule(state, state.userTid)}</td><td>${recordFromSchedule(state, oppTid)}</td><td>${matchResultText(state, m)}</td><td>${m.status === 'final' ? `<a href="#/match?id=${m.mid}">View Result</a>` : `<a href="#/match?id=${m.mid}">Open Match</a>`}</td></tr>`;
  }).join('')}</table>`;
}

export function renderMatchView(main, state, id) {
  const userMatches = state.schedule.filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
  const match = userMatches.find((m) => m.mid === id) || userMatches.find((m) => m.status !== 'final') || userMatches[0];
  if (!match) return (main.innerHTML = '<p>No user matches.</p>');

  mutateWorld((w) => openMatch(w, match.mid));
  const team = getUserTeam(state);
  const start = starters(state, team.tid);
  const lineupWarning = start.length < 5 ? '<p class="error">Need 5 starters before match can begin.</p>' : '';
  const live = match.live;
  const map = live?.maps?.[live.mapIndex];
  const scoreLine = map ? `${map.score[match.homeTid]} - ${map.score[match.awayTid]}` : (match.result?.summary || '-');

  const timeline = (map?.rounds || []).slice(-12).map((r) => {
    const fk = r.firstKill ? `FK:${r.firstKill.pid}` : '';
    const clutch = r.clutches?.length ? `Clutch x${r.clutches.length}` : '';
    return `<div>R${r.roundIndex} ${r.winType.toUpperCase()} ${r.plant ? '🌱' : ''}${r.defuse ? '🧰' : ''} | ${r.eco[match.homeTid].buyType}/${r.eco[match.awayTid].buyType} | ${fk} ${clutch}</div>`;
  }).join('') || '<p>No rounds yet.</p>';

  const keyMoments = (map?.keyMoments || []).slice(-10).map((m) => {
    if (m.type === 'timeout') return `<li>R${m.roundIndex}: Timeout by ${m.byTid} (${m.reason})</li>`;
    if (m.type === 'firstKill') return `<li>R${m.roundIndex}: First kill by ${m.pid}</li>`;
    if (m.type === 'clutch') return `<li>R${m.roundIndex}: ${m.pid} won 1v${m.vs}</li>`;
    return `<li>${m.type}</li>`;
  }).join('') || '<li>No key moments yet.</li>';

  const econRows = (map?.rounds || []).slice(-8).map((r) => `<tr><td>R${r.roundIndex}</td><td>${r.eco[match.homeTid].avgCreditsBeforeBuy} (${r.eco[match.homeTid].buyType})</td><td>${r.eco[match.awayTid].avgCreditsBeforeBuy} (${r.eco[match.awayTid].buyType})</td></tr>`).join('');

  main.innerHTML = `<h1>Match View</h1>${lineupWarning}
  <p>Status: ${match.status}</p>
  <p>Current map: ${map?.mapName || 'Completed'}</p>
  <p>Series: ${live ? `${live.seriesScore[match.homeTid]}-${live.seriesScore[match.awayTid]}` : match.result?.summary || '-'}</p>
  <p>Round score: ${scoreLine}</p>
  <p>Starters: ${start.map((p) => `${p.name} (${p.currentRole})`).join(', ') || 'None'}</p>
  <div class="top-actions"><button id="r1">Play Next Round</button><button id="r3">Play Next 3 Rounds</button><button id="half">Sim to Half</button><button id="map">Sim Map</button><button id="series">Sim Series</button></div>
  <h3>Round Timeline</h3><div class="card">${timeline}</div>
  <h3>Key Moments</h3><ul>${keyMoments}</ul>
  <h3>Economy Panel</h3><table><tr><th>Round</th><th>Home</th><th>Away</th></tr>${econRows || '<tr><td colspan="3">No data</td></tr>'}</table>
  <pre>${(live?.log || []).slice(-16).join('\n')}</pre>`;

  const canPlay = start.length >= 5;
  ['#r1', '#r3', '#half', '#map', '#series'].forEach((idBtn) => { const el = main.querySelector(idBtn); if (el && !canPlay) el.disabled = true; });
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
  const starterList = starters(state, team.tid);
  if (!state.rules) state.rules = { allowDuplicateAgentsSameTeam: false };

  const globalComp = team.strategy.comps.find((c) => c.mapId === 'global') || { id: 'global', mapId: 'global', agents: ['', '', '', '', ''], assignments: {} };
  if (!team.strategy.comps.find((c) => c.mapId === 'global')) team.strategy.comps.push(globalComp);

  main.innerHTML = `<h1>Strategy</h1>
  <label>Delegate to Coach <select id="delegate"><option value="true" ${team.strategy.delegateToCoach ? 'selected' : ''}>true</option><option value="false" ${!team.strategy.delegateToCoach ? 'selected' : ''}>false</option></select></label>
  <label>Allow Duplicate Agents (same team) <select id="dupes"><option value="false" ${!state.rules.allowDuplicateAgentsSameTeam ? 'selected' : ''}>false</option><option value="true" ${state.rules.allowDuplicateAgentsSameTeam ? 'selected' : ''}>true</option></select></label>
  <label>Economy Risk <input id="econRisk" type="range" min="0" max="1" step="0.05" value="${team.strategy.economyRisk}" ${readOnly ? 'disabled' : ''}/></label>
  <table><tr><th>Map</th><th>Preference</th></tr>${MAP_POOL.map((m) => `<tr><td>${m.name}</td><td><select data-map="${m.id}" ${readOnly ? 'disabled' : ''}>${MAP_PREFS.map((p) => `<option ${team.strategy.mapPreferences[m.id] === p ? 'selected' : ''}>${p}</option>`).join('')}</select></td></tr>`).join('')}</table>

  <h3>Default Comp Template (Global)</h3>
  <div>${[0,1,2,3,4].map((i) => `<label>Slot ${i+1}<select data-comp-slot="${i}">${[''].concat(ALL_AGENTS).map((a) => `<option value="${a}" ${globalComp.agents[i] === a ? 'selected' : ''}>${a || 'Auto'}</option>`).join('')}</select></label>`).join('')}</div>

  <h3>Starter Assignment</h3>
  <table><tr><th>Starter</th><th>Role</th><th>Agent</th><th>Top affinity</th></tr>${starterList.map((p) => {
    const top = Object.entries(p.agentPool.affinities || {}).sort((a,b)=>b[1]-a[1])[0];
    return `<tr><td>${p.name}</td><td>${p.currentRole}</td><td><select data-assign="${p.pid}">${[''].concat(ALL_AGENTS).map((a) => `<option value="${a}" ${(globalComp.assignments?.[p.pid] || '') === a ? 'selected' : ''}>${a || 'Auto'}</option>`).join('')}</select></td><td>${top ? `${top[0]} (${top[1]})` : 'N/A'}</td></tr>`;
  }).join('')}</table><p>Mirror comps across teams are always allowed.</p>`;

  main.querySelector('#delegate').onchange = (e) => mutateWorld((w) => { getUserTeam(w).strategy.delegateToCoach = e.target.value === 'true'; });
  main.querySelector('#dupes').onchange = (e) => mutateWorld((w) => { if (!w.rules) w.rules = { allowDuplicateAgentsSameTeam: false }; w.rules.allowDuplicateAgentsSameTeam = e.target.value === 'true'; });
  const riskEl = main.querySelector('#econRisk');
  if (riskEl) riskEl.onchange = () => mutateWorld((w) => { getUserTeam(w).strategy.economyRisk = Number(riskEl.value); });
  main.querySelectorAll('[data-map]').forEach((sel) => sel.onchange = () => mutateWorld((w) => { getUserTeam(w).strategy.mapPreferences[sel.dataset.map] = sel.value; }));
  main.querySelectorAll('[data-comp-slot]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const t = getUserTeam(w); let comp = t.strategy.comps.find((c) => c.mapId === 'global'); if (!comp) { comp = { id: uid('comp'), mapId: 'global', agents: ['', '', '', '', ''], assignments: {} }; t.strategy.comps.push(comp); }
    comp.agents[Number(sel.dataset.compSlot)] = sel.value;
  }));
  main.querySelectorAll('[data-assign]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const t = getUserTeam(w); let comp = t.strategy.comps.find((c) => c.mapId === 'global'); if (!comp) { comp = { id: uid('comp'), mapId: 'global', agents: ['', '', '', '', ''], assignments: {} }; t.strategy.comps.push(comp); }
    comp.assignments[sel.dataset.assign] = sel.value;
  }));
}

export function renderPlayers(main, state) {
  const players = [...state.players].sort((a, b) => b.ovr - a.ovr);
  const teamName = (tid) => tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === tid)?.abbrev;
  main.innerHTML = `<h1>Players</h1><table><tr><th>Name</th><th>Team</th><th>OVR</th><th>Roles</th><th>Agent Pool Size</th></tr>${players.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${teamName(p.tid)}</td><td>${p.ovr}</td><td>${p.roles.join(', ')}</td><td>${Object.keys(p.agentPool.affinities || {}).length}</td></tr>`).join('')}</table>`;
}

function recommendationPayload(state, p) {
  const roster = starters(state, state.userTid);
  const roleNeed = roster.filter((x) => x.currentRole === p.currentRole).length === 0 ? 84 : 60;
  const projected = Math.round(p.ovr * 0.6 + p.roleSkills[p.currentRole] * 0.4);
  const costToValue = Math.round((projected / Math.max(1, p.currentContract?.salaryPerYear || p.salary)) * 100000);
  return { projectedPerformance: projected, fitScore: Math.round((roleNeed + projected) / 2), costToValue, riskLevel: p.age > 27 ? 'Medium' : 'Low', reasoningScore: Math.round((projected + roleNeed) / 2), priorityLevel: projected > 80 ? 'High' : projected > 68 ? 'Medium' : 'Low' };
}

export function renderFreeAgents(main, state) {
  const coachMode = isCoachMode(state);
  const rosterCount = state.players.filter((p) => p.tid === state.userTid).length;
  const freeAgents = state.players.filter((p) => p.tid === null).slice(0, 30);
  main.innerHTML = `<h1>Free Agents</h1><p>Roster spots: ${rosterCount}/${ROSTER_LIMIT}</p><table><tr><th>Name</th><th>OVR</th><th>Expected Salary</th><th>Traits</th><th>Expected Role</th><th>Action</th></tr>${freeAgents.map((p) => `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${p.ovr}</td><td>${formatMoney(marketValue(p))}</td><td>A:${p.ambition} L:${p.loyalty} G:${p.greed}</td><td>${p.preferredRole}</td><td>${coachMode ? `<button data-recommend="${p.pid}">Recommend to GM</button>` : `<button data-negotiate="${p.pid}">Negotiate</button>`}</td></tr>`).join('')}</table><div id="fa-extra"></div>`;

  if (coachMode) {
    main.querySelectorAll('[data-recommend]').forEach((btn) => btn.onclick = () => {
      mutateWorld((w) => {
        const p = w.players.find((x) => x.pid === btn.dataset.recommend); if (!p) return;
        const coach = userCoach(w);
        const calc = recommendationPayload(w, p);
        const rec = { id: uid('rec'), playerId: p.pid, recommendedByCoachId: coach?.cid, timestamp: Date.now(), ...calc, status: 'pending' };
        w.recommendations.push(rec);
        addMessage(w, { from: { type: 'coach', name: coach?.profile.name || 'Coach' }, subject: `Scouting Recommendation: ${p.name} (${p.currentRole})`, body: `I recommend we pursue ${p.name}. The profile fits our role needs and offers controllable contract risk.`, category: 'team', related: { playerId: p.pid, recommendationId: rec.id }, details: { bullets: [`Top strengths: Aim ${Math.round(p.attrs.aim)}, Utility ${Math.round(p.attrs.utility)}, Clutch ${Math.round(p.attrs.clutch)}`, `Risk notes: ${calc.riskLevel} risk due to age/market leverage.`], stats: [{ label: 'Fit Score', value: String(calc.fitScore) }, { label: 'Projected Performance', value: String(calc.projectedPerformance) }, { label: 'Estimated Salary', value: String(marketValue(p)) }], links: [{ label: 'View Player', route: `#/player?id=${p.pid}` }, { label: 'Open Free Agents', route: '#/free-agents' }], tags: ['team', 'scouting'] } });
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  } else {
    main.querySelectorAll('[data-negotiate]').forEach((btn) => btn.onclick = () => {
      const p = state.players.find((x) => x.pid === btn.dataset.negotiate);
      const extra = main.querySelector('#fa-extra');
      const val = marketValue(p);
      extra.innerHTML = `<h3>Negotiation: ${p.name}</h3><div class="card"><label>Salary<input id="neg-salary" type="number" value="${val}" /></label><label>Years<select id="neg-years"><option>1</option><option selected>2</option><option>3</option></select></label><label>Role Promise<select id="neg-role"><option>starter</option><option>bench</option></select></label><label>Signing Bonus<input id="neg-bonus" type="number" value="${Math.round(val * 0.2)}" /></label><button id="submit-neg">Submit Offer</button><div id="neg-out"></div></div>`;
      extra.querySelector('#submit-neg').onclick = () => mutateWorld((w) => {
        let neg = Object.values(w.negotiations).find((n) => n.playerId === p.pid && n.teamId === w.userTid);
        if (!neg) neg = startNegotiation(w, p.pid, w.userTid);
        const offer = { salary: Number(extra.querySelector('#neg-salary').value), years: Number(extra.querySelector('#neg-years').value), rolePromise: extra.querySelector('#neg-role').value, signingBonus: Number(extra.querySelector('#neg-bonus').value) };
        const res = submitOffer(w, neg.id, offer);
        const t = getUserTeam(w);
        const evalNow = evaluateOffer(w.players.find((x) => x.pid === p.pid), { team: t, teamReputation: t.teamReputation, rosterStrength: t.rosterStrength, facilitiesLevel: t.facilitiesLevel, financialStability: t.financialStability, coachQuality: t.coachQuality }, offer, p.tid);
        extra.querySelector('#neg-out').innerHTML = `<p>Interest: ${evalNow.interest}/100</p><p>${res?.accepted ? 'Accepted' : res?.counter ? 'Countered' : 'Rejected'}</p><p>${(res?.reasons || evalNow.reasons || []).join(', ')}</p>`;
      });
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
  const reqs = state.facilityRequests.filter((r) => r.teamId === state.userTid);
  const rows = Object.entries(FACILITY_CONFIG).map(([key, cfg]) => {
    const f = t.facilities[key]; const cost = getFacilityUpgradeCost(t, key);
    const btn = coachMode ? `<button data-request="${key}" ${f.level >= f.maxLevel ? 'disabled' : ''}>Request Upgrade</button>` : `<button data-up="${key}" ${f.level >= f.maxLevel ? 'disabled' : ''}>Upgrade</button>`;
    return `<tr><td>${cfg.label}</td><td>${f.level}/${f.maxLevel}</td><td>${formatMoney(f.baseMaintenance * f.level)}</td><td>${formatMoney(cost)}</td><td>${btn}</td></tr>`;
  }).join('');
  main.innerHTML = `<h1>Facilities</h1>${coachMode ? '<p>Coach mode: direct spending disabled. Use requests.</p>' : ''}<table><tr><th>Facility</th><th>Level</th><th>Maintenance</th><th>Upgrade Cost</th><th></th></tr>${rows}</table><h3>Requests</h3><div>${reqs.map((r) => `<div class="save-row"><span>${r.facilityKey} -> ${r.requestedLevelOrSpend} (${r.status})</span>${!coachMode && r.status === 'pending' ? `<span><button data-approve="${r.id}">Approve</button> <button data-reject="${r.id}">Reject</button></span>` : ''}</div>`).join('') || '<p>No requests.</p>'}</div>`;

  main.querySelectorAll('[data-up]').forEach((btn) => btn.onclick = () => {
    mutateWorld((w) => {
      const team = getUserTeam(w); const key = btn.dataset.up; const fac = team.facilities[key]; const cost = getFacilityUpgradeCost(team, key);
      if (team.cash < cost || fac.level >= fac.maxLevel) return;
      team.cash -= cost; team.expenses += cost; fac.level += 1;
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  main.querySelectorAll('[data-request]').forEach((btn) => btn.onclick = () => {
    mutateWorld((w) => {
      const team = getUserTeam(w);
      const fac = team.facilities[btn.dataset.request];
      const req = { id: uid('req'), ts: Date.now(), teamId: w.userTid, facilityKey: btn.dataset.request, requestedLevelOrSpend: fac.level + 1, reasonText: 'Development and consistency upgrade', status: 'pending' };
      w.facilityRequests.push(req);
      addMessage(w, { from: { type: 'coach', name: w.meta.userName }, subject: `Facility Request: ${btn.dataset.request} -> L${fac.level + 1}`, body: 'Request filed to GM with expected development outcomes and urgency rating.', category: 'finance', related: { teamId: w.userTid }, details: { bullets: ['Expected development gain: +2 to +4 weekly progression in aligned training focus.', 'Urgency: Medium (practice consistency at risk without upgrade).'], stats: [{ label: 'Requested Facility', value: btn.dataset.request }, { label: 'Target Level', value: String(fac.level + 1) }, { label: 'Cost Estimate', value: String(getFacilityUpgradeCost(team, btn.dataset.request)) }], links: [{ label: 'Open Facilities', route: '#/facilities' }], tags: ['facilities'] } });
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  main.querySelectorAll('[data-approve]').forEach((btn) => btn.onclick = () => {
    mutateWorld((w) => {
      const req = w.facilityRequests.find((r) => r.id === btn.dataset.approve); if (!req || req.status !== 'pending') return;
      const team = getUserTeam(w); const fac = team.facilities[req.facilityKey]; const cost = getFacilityUpgradeCost(team, req.facilityKey);
      if (team.cash < cost || fac.level >= fac.maxLevel) { req.status = 'rejected'; return; }
      team.cash -= cost; team.expenses += cost; fac.level += 1; req.status = 'approved';
      addMessage(w, { from: { type: 'gm', name: 'GM Office' }, subject: `Facility request approved: ${req.facilityKey}`, body: `Upgrade approved and applied.`, category: 'finance' });
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  main.querySelectorAll('[data-reject]').forEach((btn) => btn.onclick = () => {
    mutateWorld((w) => {
      const req = w.facilityRequests.find((r) => r.id === btn.dataset.reject); if (!req) return;
      req.status = 'rejected';
      addMessage(w, { from: { type: 'gm', name: 'GM Office' }, subject: `Facility request rejected: ${req.facilityKey}`, body: `Request was rejected.`, category: 'finance' });
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

export function renderSponsors(main, state) {
  const team = getUserTeam(state);
  const active = state.sponsors.active.filter((s) => s.teamId === team.tid);
  const offers = state.sponsors.offers.filter((s) => s.teamId === team.tid);
  const history = state.sponsors.history.filter((s) => s.teamId === team.tid).slice(-20);
  main.innerHTML = `<h1>Sponsors</h1>
  <h3>Active Sponsors</h3>${active.map((s) => `<div class="card"><strong>${s.sponsorName}</strong><p>Objective: ${s.objective.label}</p><p>Progress: ${s.progress || 0}/${s.objective.target}</p><p>Base ${formatMoney(s.basePayout)} + Bonus ${formatMoney(s.bonusPayout)} deadline week ${s.deadlineWeek}</p></div>`).join('') || '<p>No active sponsors.</p>'}
  <h3>Offers</h3>${offers.map((s) => `<div class="save-row"><span><strong>${s.sponsorName}</strong> • ${s.objective.label} • ${formatMoney(s.basePayout)} + ${formatMoney(s.bonusPayout)}</span><span><button data-accept="${s.id}">Accept</button><button data-decline="${s.id}">Decline</button></span></div>`).join('') || '<p>No offers right now.</p>'}
  <h3>History</h3>${history.map((s) => `<div>${s.sponsorName}: ${s.success ? 'Success' : 'Failed'} (progress ${s.finalProgress}/${s.objective.target})</div>`).join('') || '<p>No history yet.</p>'}`;

  main.querySelectorAll('[data-accept]').forEach((btn) => btn.onclick = () => {
    mutateWorld((w) => acceptSponsorOffer(w, btn.dataset.accept));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  main.querySelectorAll('[data-decline]').forEach((btn) => btn.onclick = () => {
    mutateWorld((w) => declineSponsorOffer(w, btn.dataset.decline));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

export function renderPlayerDetail(main, state, id) {
  const p = state.players.find((x) => x.pid === id);
  if (!p) return (main.innerHTML = '<p>Player not found.</p>');
  const attrs = Object.entries(p.attrs).map(([k, v]) => `${k}: ${Math.round(v)}`).join(', ');
  const affinityTop = Object.entries(p.agentPool.affinities || {}).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([a,v])=>`${a}(${v})`).join(', ');
  main.innerHTML = `<h1>${p.name}</h1><p>Team: ${p.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === p.tid)?.name}</p><p>OVR: ${p.ovr}</p><p>Roles: ${p.roles.join(', ')} | Current: ${p.currentRole} | Secondary Tag: ${p.secondaryRoleTag}</p><p>Contract: ${formatMoney(p.currentContract.salaryPerYear)} / ${p.currentContract.yearsRemaining}y (${p.currentContract.rolePromise})</p><p>Agent Affinity: ${affinityTop}</p><p>${attrs}</p>`;
}

export function renderCoachDetail(main, state, id) {
  const c = state.coaches.find((x) => x.cid === id);
  if (!c) return (main.innerHTML = '<p>Coach not found.</p>');
  const r = c.ratings;
  main.innerHTML = `<h1>${c.profile.name}</h1><p>${c.staffRole} • ${c.profile.age} • ${c.profile.nationality} • ${c.profile.styleTag}</p><p>Team: ${c.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === c.tid)?.name}</p><p>prep ${r.prep}, veto ${r.vetoSkill}, leadership ${r.leadership}, dev ${r.skillDevelopment}</p>`;
}
