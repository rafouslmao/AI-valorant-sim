import { ALL_AGENTS, FACILITY_CONFIG, INTENSITIES, MAP_POOL, ROLES, ROSTER_LIMIT, SECONDARY_ROLE_TAGS, TRAINING_PRIMARY, TRAINING_SECONDARY } from '../../core/constants.js';
import { mutateWorld } from '../../core/state.js';
import { advanceTimeToNextPhase, getFacilityUpgradeCost, getTournamentsForYear, openMatch, playMatchMap, playMatchRounds, playMatchSeries, playMatchToHalf, requestMatchTimeout, simulateCurrentTournament, simulateToNextTournament } from '../../core/sim.js';
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


function derivedSummary(p) {
  const d = p.derived || {};
  return { ovr: p.ovr || 0, rifleImpact: d.rifleImpact || 0, entryPower: d.entryPower || 0, utilityValue: d.utilityValue || 0, clutchImpact: d.clutchImpact || 0, consistency: d.consistency || 0 };
}

function roleLearningNote(p) {
  if (!p.roleLearning || p.roleLearning.remaining <= 0) return '';
  return `<small class="error">learning role: -${Math.round((p.roleLearning.penalty || 0.12) * 100)}% effectiveness (${p.roleLearning.remaining}w)</small>`;
}
function teamDisplayAbbrev(team) {
  if (!team) return '-';
  if (/^Team\s+/i.test(team.name)) {
    const second = team.name.trim().split(/\s+/)[1] || team.name;
    return second.slice(0, 4).toUpperCase();
  }
  return team.abbrev;
}

function recordFromSchedule(state, tid) {
  let w = 0; let l = 0;
  for (const m of state.schedule) {
    if (m.status !== 'final' || !m.result || (m.homeTid !== tid && m.awayTid !== tid)) continue;
    if (m.result.winnerTid === tid) w++; else l++;
  }
  return `${w}-${l}`;
}

function recordFromMatchList(matches, tid) {
  let w = 0; let l = 0;
  for (const m of matches) {
    const winnerTid = m.result?.winnerTid;
    if (winnerTid == null || (m.homeTid !== tid && m.awayTid !== tid)) continue;
    if (winnerTid === tid) w++; else l++;
  }
  return `${w}-${l}`;
}

function currentSeasonMatches(state) {
  return state.schedule.filter((m) => m.season === state.meta.year);
}

export function getLayoutBadges(state) { return { messages: getUnreadCount(state) || undefined }; }
export function simulateNextAction() { mutateWorld((w) => advanceTimeToNextPhase(w)); window.dispatchEvent(new HashChangeEvent('hashchange')); }
export function simulateWeekAction() { mutateWorld((w) => simulateToNextTournament(w)); window.dispatchEvent(new HashChangeEvent('hashchange')); }
export function simulateTournamentAction() { mutateWorld((w) => simulateCurrentTournament(w)); window.dispatchEvent(new HashChangeEvent('hashchange')); }

export function renderHome(main, state) {
  const team = getUserTeam(state);
  const coachText = isCoachMode(state) ? '<p><strong>You are the Head Coach</strong></p>' : '';
  main.innerHTML = `<h1>Career Home</h1>${coachText}<p><strong>${state.meta.userName}</strong> (${state.meta.mode}) • ${team.name}</p><p>Season ${state.meta.year}, Week ${state.meta.week}</p><p>Record: ${recordFromSchedule(state, team.tid)}</p>`;
}

function renderStarterRows(state, tid) {
  return starters(state, tid).map((p) => {
    const sm = derivedSummary(p);
    return `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a><br/>${roleLearningNote(p)}</td><td>${sm.ovr}</td><td>${sm.rifleImpact}</td><td>${sm.entryPower}</td><td>${sm.utilityValue}</td><td>${sm.clutchImpact}</td><td>${sm.consistency}</td><td><select data-primary-role="${p.pid}">${ROLES.map((r) => `<option ${p.primaryRole === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td><select data-secondary-tag="${p.pid}">${SECONDARY_ROLE_TAGS.map((r) => `<option ${p.secondaryRoleTag === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td><button data-to-bench="${p.pid}">Move to Bench</button></td></tr>`;
  }).join('');
}
function renderBenchRows(state, tid) {
  return bench(state, tid).map((p) => {
    const sm = derivedSummary(p);
    return `<tr><td><a href="#/player?id=${p.pid}">${p.name}</a><br/>${roleLearningNote(p)}</td><td>${sm.ovr}</td><td>${sm.rifleImpact}</td><td>${sm.utilityValue}</td><td><select data-primary-role="${p.pid}">${ROLES.map((r) => `<option ${p.primaryRole === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td><button data-to-start="${p.pid}">Move to Starting Lineup</button></td></tr>`;
  }).join('');
}

export function renderRoster(main, state) {
  const team = getUserTeam(state);
  const start = starters(state, team.tid);
  const benchList = bench(state, team.tid);
  const warn = start.length < 5 ? '<p class="error">Starting lineup must have 5 players to start/play a match.</p>' : '';
  main.innerHTML = `<h1>Roster</h1>${warn}<p>Cohesion: <strong>${Math.round(team.teamCohesion || 0)}</strong> • Familiarity grows after maps played.</p>
  <h3>Starting Lineup (${start.length}/5)</h3>
  <table><tr><th>Player</th><th>OVR</th><th>Rifle</th><th>Entry</th><th>Utility</th><th>Clutch</th><th>Consistency</th><th>Primary Role</th><th>Secondary Tag</th><th></th></tr>${renderStarterRows(state, team.tid)}</table>
  <h3>Bench (${benchList.length})</h3>
  <table><tr><th>Player</th><th>OVR</th><th>Rifle</th><th>Utility</th><th>Primary Role</th><th></th></tr>${renderBenchRows(state, team.tid)}</table>`;

  main.querySelectorAll('[data-secondary-tag]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const p = w.players.find((x) => x.pid === sel.dataset.secondaryTag); if (p) p.secondaryRoleTag = sel.value;
  }));
  main.querySelectorAll('[data-primary-role]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const p = w.players.find((x) => x.pid === sel.dataset.primaryRole); if (!p) return;
    const oldRole = p.primaryRole || p.currentRole;
    p.primaryRole = sel.value;
    p.currentRole = sel.value;
    p.preferredRole = sel.value;
    p.roleMastery[sel.value] = Math.max(p.roleMastery[sel.value] || 40, 45);
    if (oldRole !== sel.value) p.roleLearning = { role: sel.value, remaining: 6, penalty: 0.12 };
    const team = w.teams.find((t) => t.tid === p.tid);
    if (team) team.teamCohesion = Math.max(0, (team.teamCohesion || 50) - 2);
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


export function renderSchedule(main, state) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const selectedYear = Number(params.get('year') || state.meta.year);
  const scope = params.get('scope') || 'my';
  const eventFilter = params.get('event') || 'all';
  const events = getTournamentsForYear(state, selectedYear);
  const eventName = (id) => events.find((e) => e.id === id)?.name || '-';
  let list = (state.schedule || []).filter((m) => m.season === selectedYear);
  if (eventFilter !== 'all') list = list.filter((m) => m.eventId === eventFilter);
  if (scope === 'my') list = list.filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
  list = list.sort((a, b) => (a.day - b.day));
  const teamName = (tid) => state.teams.find((t) => t.tid === tid)?.name || tid;
  const rows = list.map((m) => {
    const isMy = m.homeTid === state.userTid || m.awayTid === state.userTid;
    const oppTid = m.homeTid === state.userTid ? m.awayTid : m.homeTid;
    const opp = isMy ? teamName(oppTid) : `${teamName(m.homeTid)} vs ${teamName(m.awayTid)}`;
    const status = m.status === 'final' ? 'finished' : m.status === 'inProgress' ? 'live' : 'upcoming';
    return `<tr><td>${eventName(m.eventId)}</td><td>${m.stage}</td><td>D${m.day}</td><td>${opp}</td><td>${status}</td><td><a href="#/match?id=${m.id}">Open</a></td></tr>`;
  }).join('') || '<tr><td colspan="6">No matches.</td></tr>';
  main.innerHTML = `<h1>Schedule</h1><div class="top-actions"><label>Year <input id="sc-year" type="number" value="${selectedYear}"/></label><label>Scope <select id="sc-scope"><option value="my" ${scope === 'my' ? 'selected' : ''}>My team only</option><option value="all" ${scope === 'all' ? 'selected' : ''}>All matches in selected tournament</option></select></label><label>Tournament <select id="sc-event"><option value="all">All</option>${events.map((e) => `<option value="${e.id}" ${eventFilter === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}</select></label></div><table><tr><th>Event</th><th>Stage</th><th>Date</th><th>Opponent</th><th>Status</th><th></th></tr>${rows}</table>`;
  const push = () => {
    const q = new URLSearchParams({ year: main.querySelector('#sc-year').value, scope: main.querySelector('#sc-scope').value, event: main.querySelector('#sc-event').value });
    window.location.hash = `#/schedule?${q.toString()}`;
  };
  ['#sc-year', '#sc-scope', '#sc-event'].forEach((sel) => main.querySelector(sel).onchange = push);
}

export function renderMatches(main, state) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const selectedYear = Number(params.get('year') || state.meta.year);
  const statusFilter = params.get('status') || 'all';
  const tierFilter = params.get('tier') || 'all';
  const orgFilter = params.get('org') || 'all';
  const regionFilter = params.get('region') || 'all';
  const yearOptions = Object.keys(state.eventsByYear || {}).map(Number).concat([state.meta.year]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a);
  const events = getTournamentsForYear(state, selectedYear);
  const today = selectedYear === state.meta.year ? (state.meta.day || 1) : 999;

  const decorate = (e) => {
    const ongoing = e.startDay <= today && e.endDay >= today && e.status !== 'Finished';
    const past = e.endDay < today || e.status === 'Finished';
    const status = past ? 'Finished' : ongoing ? (e.status === 'Main Event' ? 'Main Event' : 'Qualifiers') : 'Upcoming';
    const bucket = ongoing ? 'ongoing' : past ? 'past' : 'upcoming';
    return { ...e, statusText: status, bucket };
  };

  const filtered = events.map(decorate).filter((e) => {
    if (statusFilter !== 'all' && e.bucket !== statusFilter) return false;
    if (tierFilter !== 'all' && e.tier !== tierFilter) return false;
    if (orgFilter !== 'all' && e.organizer !== orgFilter) return false;
    if (regionFilter !== 'all' && e.region !== regionFilter && !(regionFilter === 'international' && e.regionScope === 'INTERNATIONAL')) return false;
    return true;
  });

  const section = (title, key) => {
    const list = filtered.filter((e) => e.bucket === key);
    return `<h3>${title}</h3><table><tr><th>Event</th><th>Tier</th><th>Scope</th><th>Dates</th><th>Status</th><th>Invites</th><th>Qualifier</th><th></th></tr>${list.map((e) => `<tr><td>${e.name}<br/><small>${e.organizer}</small></td><td>${e.tier}</td><td>${e.regionScope === 'INTERNATIONAL' ? 'International' : e.region}</td><td>D${e.startDay}-D${e.endDay}</td><td><span>${e.statusText}</span></td><td>${e.invitedAccepted.length}/${e.inviteSlots} accepted, ${e.invitedDeclined.length} declined</td><td>${e.qualifierParticipants.length}</td><td><a href="#/match?id=${e.id}&event=1&year=${selectedYear}">Open</a></td></tr>`).join('') || '<tr><td colspan="8">None</td></tr>'}</table>`;
  };

  const orgs = ['all', ...Array.from(new Set(events.map((e) => e.organizer)))];
  main.innerHTML = `<h1>Tournaments</h1>
  <div class="top-actions">
    <label>Year <select id="yr">${yearOptions.map((y) => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
    <label>Tier <select id="tier"><option value="all">All</option><option value="S" ${tierFilter === 'S' ? 'selected' : ''}>S</option><option value="A" ${tierFilter === 'A' ? 'selected' : ''}>A</option></select></label>
    <label>Organizer <select id="org">${orgs.map((o) => `<option value="${o}" ${o === orgFilter ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
    <label>Region <select id="region"><option value="all">All</option><option value="Americas">Americas</option><option value="EMEA">EMEA</option><option value="Pacific">Pacific</option><option value="China">China</option><option value="international">International</option></select></label>
    <label>Status <select id="status"><option value="all">All</option><option value="ongoing" ${statusFilter === 'ongoing' ? 'selected' : ''}>Ongoing</option><option value="upcoming" ${statusFilter === 'upcoming' ? 'selected' : ''}>Upcoming</option><option value="past" ${statusFilter === 'past' ? 'selected' : ''}>Past</option></select></label>
  </div>
  ${section('ONGOING', 'ongoing')}
  ${section('UPCOMING', 'upcoming')}
  ${section('PAST', 'past')}`;

  main.querySelector('#region').value = regionFilter;
  const push = () => {
    const q = new URLSearchParams({
      year: main.querySelector('#yr').value,
      tier: main.querySelector('#tier').value,
      org: main.querySelector('#org').value,
      region: main.querySelector('#region').value,
      status: main.querySelector('#status').value
    });
    window.location.hash = `#/matches?${q.toString()}`;
  };
  ['#yr', '#tier', '#org', '#region', '#status'].forEach((sel) => main.querySelector(sel).onchange = push);
}

export function renderMatchView(main, state, id) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const teamName = (tid) => state.teams.find((t) => t.tid === tid)?.name || tid;
  if (params.get('event') === '1') {
    const year = Number(params.get('year') || state.meta.year);
    const event = (state.eventsByYear?.[year] || []).find((e) => e.id === id);
    if (!event) return (main.innerHTML = '<p>Event not found.</p>');
    const linkedMatches = (state.schedule || []).filter((m) => m.eventId === event.id).sort((a, b) => a.day - b.day);
    main.innerHTML = `<h1>${event.name}</h1>
    <p>${event.organizer} • Tier ${event.tier} • ${event.regionScope === 'INTERNATIONAL' ? 'International' : event.region}</p>
    <p>Status: ${event.status}</p><p>Date: D${event.startDay} - D${event.endDay}</p>
    <h3>Invited Teams</h3>
    <p><strong>Accepted:</strong> ${(event.invitedAccepted || []).map(teamName).join(', ') || 'None'}</p>
    <p><strong>Declined:</strong> ${(event.invitedDeclined || []).map(teamName).join(', ') || 'None'}</p>
    <h3>Matches</h3>
    <table><tr><th>Stage</th><th>Day</th><th>Match</th><th>Status</th><th></th></tr>${linkedMatches.map((m) => `<tr><td>${m.stage}</td><td>D${m.day}</td><td>${teamName(m.homeTid)} vs ${teamName(m.awayTid)}</td><td>${m.status === 'final' ? 'finished' : m.status === 'inProgress' ? 'live' : 'upcoming'}</td><td><a href="#/match?id=${m.id}">Open</a></td></tr>`).join('') || '<tr><td colspan="5">No matches generated.</td></tr>'}</table>
    <h3>Main Event Placements</h3>
    <ol>${(event.placements || []).map((pl) => {
      const pts = (event.pointsAwarded || []).find((z) => z.tid === pl.tid)?.points || 0;
      const prize = (event.payouts || []).find((z) => z.tid === pl.tid)?.amount || 0;
      return `<li>${teamName(pl.tid)} (${pts} pts, ${formatMoney(prize)})</li>`;
    }).join('') || '<li>Not started</li>'}</ol>
    <p><a href="#/matches?year=${year}">Back to Tournaments</a></p>`;
    return;
  }

  const match = (state.schedule || []).find((m) => m.id === id);
  if (!match) return (main.innerHTML = '<h1>Match</h1><p>Match not found.</p>');

  const scoreText = match.result ? `${match.result.seriesScore[match.homeTid] || 0}-${match.result.seriesScore[match.awayTid] || 0}` : '-';
  const live = match.live;
  const map = live?.maps?.[live.mapIndex];
  const roundRows = (map?.rounds || []).slice(-8).map((r) => `<tr><td>${r.roundIndex}</td><td>${teamName(r.winnerTid)}</td><td>${r.winType}</td><td>${r.firstKill ? teamName(r.firstKill.tid) : '-'}</td><td>${r.plant ? 'Plant' : '-'}</td><td>${r.defuse ? 'Defuse' : '-'}</td></tr>`).join('') || '<tr><td colspan="6">No rounds yet.</td></tr>';

  main.innerHTML = `<h1>${teamName(match.homeTid)} vs ${teamName(match.awayTid)}</h1>
  <p>${match.eventName} • ${match.stage} • Day D${match.day}</p>
  <p>Status: ${match.status} • Series: ${scoreText}</p>
  <div class="top-actions">
    ${match.status !== 'final' ? '<button id="play-open">Play Match</button><button id="play-sim">Sim Match</button>' : ''}
    ${live && !live.finished ? '<button id="play-round">Next Round</button><button id="play-6">+6 Rounds</button><button id="play-half">To Half</button><button id="play-map">To Map End</button><button id="play-series">To Series End</button>' : ''}
    ${live && !live.finished && state.meta.mode === 'Coach' && (match.homeTid === state.userTid || match.awayTid === state.userTid) ? '<button id="coach-timeout">Call Timeout</button>' : ''}
  </div>
  <h3>Live Map</h3>
  <p>${map ? `${map.mapName} • Score ${map.score[match.homeTid]}-${map.score[match.awayTid]}` : 'Not started'}</p>
  <table><tr><th>Round</th><th>Winner</th><th>Type</th><th>First Kill</th><th>Plant</th><th>Defuse</th></tr>${roundRows}</table>
  ${match.result?.maps?.length ? `<h3>Completed Maps</h3><ul>${match.result.maps.map((m) => `<li>${m.mapName}: ${m.finalScore[match.homeTid]}-${m.finalScore[match.awayTid]}</li>`).join('')}</ul>` : ''}
  <p><a href="#/schedule">Back to Schedule</a></p>`;

  const reload = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  if (main.querySelector('#play-open')) main.querySelector('#play-open').onclick = () => { mutateWorld((w) => openMatch(w, match.id)); reload(); };
  if (main.querySelector('#play-sim')) main.querySelector('#play-sim').onclick = () => { mutateWorld((w) => { openMatch(w, match.id); playMatchSeries(w, match.id); }); reload(); };
  if (main.querySelector('#play-round')) main.querySelector('#play-round').onclick = () => { mutateWorld((w) => playMatchRounds(w, 1, match.id)); reload(); };
  if (main.querySelector('#play-6')) main.querySelector('#play-6').onclick = () => { mutateWorld((w) => playMatchRounds(w, 6, match.id)); reload(); };
  if (main.querySelector('#play-half')) main.querySelector('#play-half').onclick = () => { mutateWorld((w) => playMatchToHalf(w, match.id)); reload(); };
  if (main.querySelector('#play-map')) main.querySelector('#play-map').onclick = () => { mutateWorld((w) => playMatchMap(w, match.id)); reload(); };
  if (main.querySelector('#play-series')) main.querySelector('#play-series').onclick = () => { mutateWorld((w) => playMatchSeries(w, match.id)); reload(); };
  if (main.querySelector('#coach-timeout')) main.querySelector('#coach-timeout').onclick = () => {
    mutateWorld((w) => requestMatchTimeout(w, match.id, w.userTid));
    reload();
  };
}

export function renderStrategy(main, state) {
  const team = getUserTeam(state);
  if (!state.strategy) state.strategy = { maps: {}, global: { defaultCompId: '', comps: [] } };
  const mapCards = MAP_POOL.map((m) => `<button data-map-card="${m.id}">${m.name}</button>`).join('');
  const selectedMap = new URLSearchParams(window.location.hash.split('?')[1] || '').get('map') || MAP_POOL[0].id;
  if (!state.strategy.maps[selectedMap]) state.strategy.maps[selectedMap] = { defaultCompId: '', comps: [] };
  const mapState = state.strategy.maps[selectedMap];
  if (!mapState.comps.length) mapState.comps.push({ id: uid('comp'), name: `${MAP_POOL.find((m)=>m.id===selectedMap)?.name} Default`, slots: [{agent:''},{agent:''},{agent:''},{agent:''},{agent:''}], assignments: {} });
  if (!mapState.defaultCompId) mapState.defaultCompId = mapState.comps[0].id;
  const comp = mapState.comps.find((c) => c.id === mapState.defaultCompId) || mapState.comps[0];
  const starterList = starters(state, team.tid);

  main.innerHTML = `<h1>Strategy</h1>
  <p>Mirror comps across teams are always allowed.</p>
  <label>Allow Duplicate Agents (same team) <select id="dupes"><option value="false" ${!state.rules.allowDuplicateAgentsSameTeam ? 'selected' : ''}>false</option><option value="true" ${state.rules.allowDuplicateAgentsSameTeam ? 'selected' : ''}>true</option></select></label>
  <h3>Map Comp Planner</h3><div class="top-actions">${mapCards}</div>
  <h4>${MAP_POOL.find((m) => m.id === selectedMap)?.name}</h4>
  <label>Comp Name <input id="comp-name" value="${comp.name}" /></label>
  <table><tr><th>Slot</th><th>Agent</th></tr>${comp.slots.map((slot, i) => `<tr><td>${i + 1}</td><td><select data-comp-slot="${i}">${[''].concat(ALL_AGENTS).map((a)=>`<option value="${a}" ${slot.agent===a?'selected':''}>${a || 'Auto'}</option>`).join('')}</select></td></tr>`).join('')}</table>
  <h3>Starter Assignment (${MAP_POOL.find((m)=>m.id===selectedMap)?.name})</h3>
  <table><tr><th>Starter</th><th>Role</th><th>Agent</th><th>Top affinity</th></tr>${starterList.map((p) => {
    const top = Object.entries(p.agentPool.affinities || {}).sort((a,b)=>b[1]-a[1])[0];
    return `<tr><td>${p.name}</td><td>${p.currentRole}</td><td><select data-assign="${p.pid}">${[''].concat(ALL_AGENTS).map((a) => `<option value="${a}" ${(comp.assignments?.[p.pid] || '') === a ? 'selected' : ''}>${a || 'Auto'}</option>`).join('')}</select></td><td>${top ? `${top[0]} (${top[1]})` : 'N/A'}</td></tr>`;
  }).join('')}</table>`;

  main.querySelector('#dupes').onchange = (e) => mutateWorld((w) => { w.rules.allowDuplicateAgentsSameTeam = e.target.value === 'true'; });
  main.querySelectorAll('[data-map-card]').forEach((btn) => btn.onclick = () => { window.location.hash = `#/strategy?map=${btn.dataset.mapCard}`; });
  main.querySelector('#comp-name').onchange = (e) => mutateWorld((w) => {
    const mapNode = w.strategy.maps[selectedMap];
    const c = mapNode.comps.find((x) => x.id === mapNode.defaultCompId);
    if (c) c.name = e.target.value;
  });
  main.querySelectorAll('[data-comp-slot]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const mapNode = w.strategy.maps[selectedMap];
    const c = mapNode.comps.find((x) => x.id === mapNode.defaultCompId);
    if (c) c.slots[Number(sel.dataset.compSlot)] = { agent: sel.value };
  }));
  main.querySelectorAll('[data-assign]').forEach((sel) => sel.onchange = () => mutateWorld((w) => {
    const mapNode = w.strategy.maps[selectedMap];
    const c = mapNode.comps.find((x) => x.id === mapNode.defaultCompId);
    if (c) c.assignments[sel.dataset.assign] = sel.value;
  }));
}

export function renderPlayers(main, state) {
  const players = [...state.players].sort((a, b) => b.ovr - a.ovr);
  const teamName = (tid) => {
    if (tid === null) return 'Free Agent';
    const team = state.teams.find((t) => t.tid === tid);
    return teamDisplayAbbrev(team);
  };
  main.innerHTML = `<h1>Players</h1><table><tr><th>Image</th><th>Name</th><th>Team</th><th>Roles</th><th>Age</th><th>Nationality</th><th>OVR</th></tr>${players.map((p) => `<tr><td>${p.imageURL ? `<img src="${p.imageURL}" alt="${p.name}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;"/>` : '-'}</td><td><a href="#/player?id=${p.pid}">${p.name}</a></td><td>${teamName(p.tid)}</td><td>${p.roles.join(', ')}</td><td>${p.age ?? '-'}</td><td>${String(p.nationality || '-').replaceAll('_', ' ')}</td><td>${p.ovr}</td></tr>`).join('')}</table>`;
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
  const freeAgents = state.players.filter((p) => p.tid === null).sort((a, b) => b.ovr - a.ovr).slice(0, 30);
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


export function renderTeams(main, state) {
  const rows = state.teams.map((team) => `<tr><td><a href="#/team?id=${team.tid}">${team.name}</a></td><td>${team.region}</td><td>${team.tier}</td><td>${Math.round(team.elo || 0)}</td><td>${team.circuitPoints || 0}</td><td>${formatMoney(team.cash || 0)}</td><td>${team.wins || 0}-${team.losses || 0}</td></tr>`).join('');
  main.innerHTML = `<h1>Teams</h1><table><tr><th>Team</th><th>Region</th><th>Tier</th><th>ELO</th><th>Points</th><th>Cash</th><th>W-L</th></tr>${rows}</table>`;
}

export function renderTeamDetail(main, state, id) {
  const tid = Number(id);
  const team = state.teams.find((t) => t.tid === tid);
  if (!team) return (main.innerHTML = '<p>Team not found.</p>');
  const coach = state.coaches.find((c) => c.cid === team.headCoachId || (c.tid === team.tid && c.staffRole === 'Head Coach'));
  const startersRows = starters(state, team.tid).map((p) => `<li><a href="#/player?id=${p.pid}">${p.name}</a> (${p.currentRole})</li>`).join('');
  const benchRows = bench(state, team.tid).map((p) => `<li><a href="#/player?id=${p.pid}">${p.name}</a> (${p.currentRole})</li>`).join('');
  const gmLinks = state.meta.mode === 'GM' && state.userTid === team.tid ? '<a href="#/finances">View Finances</a> • ' : '';
  const events = (state.eventsByYear?.[state.meta.year] || []).filter((e) => (e.mainTeams || []).includes(team.tid) || (e.qualifierParticipants || []).includes(team.tid));
  const famRows = Object.entries(team.compFamiliarity || {}).map(([map, v]) => `<li>${map}: ${Math.round(v)}</li>`).join('');
  main.innerHTML = `<h1>${team.name}</h1><p>${team.region} • ${team.tier} • Record ${team.wins || 0}-${team.losses || 0}</p><p>ELO ${Math.round(team.elo || 0)} • Circuit Points ${team.circuitPoints || 0} • Cash ${formatMoney(team.cash || 0)}</p><p>Cohesion: <strong>${Math.round(team.teamCohesion || 0)}</strong></p>
  <p>Head Coach: ${coach ? `<a href="#/coach?id=${coach.cid}">${coach.profile.name}</a>` : 'None'}</p>
  <h3>Starters</h3><ul>${startersRows || '<li>None</li>'}</ul>
  <h3>Bench</h3><ul>${benchRows || '<li>None</li>'}</ul>
  <h3>Map Familiarity</h3><ul>${famRows || '<li>None</li>'}</ul><h3>Events This Year</h3><ul>${events.map((e) => `<li>${e.name} - ${e.status}</li>`).join('') || '<li>No events played yet.</li>'}</ul>
  <p>Quick links: <a href="#/players">View Players</a> • ${gmLinks}<a href="#/matches">View Tournaments</a></p>`;
}

export function renderStats(main, state) {
  const season = String(state.meta.year);
  const teamRows = state.teams.slice().sort((a, b) => (b.circuitPoints || 0) - (a.circuitPoints || 0) || (b.elo || 0) - (a.elo || 0));
  const rows = state.players.map((p) => {
    const st = p.seasonStats?.[season] || { kills: 0, deaths: 0, assists: 0, mapsPlayed: 0 };
    const team = p.tid === null ? null : state.teams.find((t) => t.tid === p.tid);
    return {
      pid: p.pid,
      name: p.name,
      team: p.tid === null ? 'FA' : teamDisplayAbbrev(team),
      kills: st.kills || 0,
      deaths: st.deaths || 0,
      assists: st.assists || 0,
      mapsPlayed: st.mapsPlayed || 0,
      kd: st.deaths ? (st.kills / st.deaths) : st.kills
    };
  }).sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths));

  main.innerHTML = `<h1>Stats</h1><h3>Rankings</h3><table><tr><th>#</th><th>Team</th><th>Region</th><th>ELO</th><th>Circuit Points</th><th>InviteScore</th><th>Last Event</th></tr>${teamRows.map((t, idx) => `<tr><td>${idx + 1}</td><td><a href="#/team?id=${t.tid}">${t.name}</a></td><td>${t.region}</td><td>${Math.round(t.elo || 0)}</td><td>${t.circuitPoints || 0}</td><td>${Math.round((t.elo || 0) * 0.6 + (t.circuitPoints || 0) * 0.4)}</td><td>${t.lastEventPlayed || '-'}</td></tr>`).join('')}</table><h3>Season ${season} - Kills Leaderboard</h3><table><tr><th>Rank</th><th>Player</th><th>Team</th><th>Kills</th><th>Deaths</th><th>Assists</th><th>K/D</th><th>Maps Played</th></tr>${rows.map((r, idx) => `<tr><td>${idx + 1}</td><td><a href="#/player?id=${r.pid}">${r.name}</a></td><td>${r.team}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.assists}</td><td>${Number(r.kd).toFixed(2)}</td><td>${r.mapsPlayed}</td></tr>`).join('')}</table>`;
}

export function renderPlayerDetail(main, state, id) {
  const p = state.players.find((x) => x.pid === id);
  if (!p) return (main.innerHTML = '<p>Player not found.</p>');
  const attrs = Object.entries(p.attrs).map(([k, v]) => `${k}: ${Math.round(v)}`).join(', ');
  const d = p.derived || {};
  const adv = p.attributes || {};
  const traitChips = (p.traits || []).map((t) => `<span class="pill">${t}</span>`).join(' ');
  const affinityTop = Object.entries(p.agentPool.affinities || {}).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([a,v])=>`${a}(${v})`).join(', ');
  const seasonRows = Object.entries(p.seasonStats || {}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([season, st]) => {
    const kd = st.deaths ? (st.kills / st.deaths).toFixed(2) : st.kills.toFixed(2);
    const kpm = (st.kills / Math.max(1, st.mapsPlayed)).toFixed(2);
    const dpm = (st.deaths / Math.max(1, st.mapsPlayed)).toFixed(2);
    return `<tr><td>${season}</td><td>${st.kills}</td><td>${st.deaths}</td><td>${st.assists}</td><td>${kd}</td><td>${kpm}</td><td>${dpm}</td><td>${st.mapsPlayed}</td><td>${st.mostKillsInMap || 0}</td></tr>`;
  }).join('');
  main.innerHTML = `${p.imageURL ? `<img src="${p.imageURL}" alt="${p.name}" style="width:120px;height:120px;object-fit:cover;border-radius:10px;margin-bottom:8px;"/>` : ''}<h1>${p.name}</h1><p>Team: ${p.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === p.tid)?.name}</p><p>Age: ${p.age ?? '-'} • Nationality: ${String(p.nationality || '-').replaceAll('_', ' ')}</p><p>Traits: ${traitChips || '-'}</p><h3>Summary</h3><p>OVR ${p.ovr} • Rifle ${d.rifleImpact || 0} • Entry ${d.entryPower || 0} • Utility ${d.utilityValue || 0} • Clutch ${d.clutchImpact || 0} • Adaptation ${d.adaptationScore || 0}</p><p>Roles: ${p.roles.join(', ')} | Primary: ${p.primaryRole} | Current: ${p.currentRole}</p><p>Contract: ${formatMoney(p.currentContract.salaryPerYear)} / ${p.currentContract.yearsRemaining}y (${p.currentContract.rolePromise})</p><p>Agent Affinity: ${affinityTop}</p><details><summary>Advanced Stats</summary><pre>${JSON.stringify(adv, null, 2)}</pre></details><p>${attrs}</p>
  <h3>Career Stats by Season</h3><table><tr><th>Season</th><th>Kills</th><th>Deaths</th><th>Assists</th><th>K/D</th><th>Kills/Map</th><th>Deaths/Map</th><th>Maps Played</th><th>Most Ks in a Map</th></tr>${seasonRows || '<tr><td colspan="9">No completed maps yet.</td></tr>'}</table>`;
}

export function renderCoachDetail(main, state, id) {
  const c = state.coaches.find((x) => x.cid === id);
  if (!c) return (main.innerHTML = '<p>Coach not found.</p>');
  const s = c.summary || { prep: 0, veto: 0, leadership: 0, development: 0 };
  main.innerHTML = `<h1>${c.profile.name}</h1><p>${c.staffRole} • ${c.profile.age} • ${c.profile.nationality} • ${c.profile.styleTag}</p><p>Team: ${c.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === c.tid)?.name}</p><p>Prep ${s.prep} • Veto ${s.veto} • Leadership ${s.leadership} • Dev ${s.development}</p><details><summary>Detailed Coaching Attributes</summary><pre>${JSON.stringify(c.attributes || {}, null, 2)}</pre></details>`;
}


export function renderGodMode(main, state) {
  if (!state.meta.godMode) {
    main.innerHTML = `<h1>God Mode</h1><p>God Mode is currently disabled for this save.</p><button id="enable-gm">Enable God Mode</button>`;
    main.querySelector('#enable-gm').onclick = () => { mutateWorld((w) => { w.meta.godMode = true; }); window.dispatchEvent(new HashChangeEvent('hashchange')); };
    return;
  }
  const teams = state.teams.map((t) => `<option value="${t.tid}">${t.name}</option>`).join('');
  main.innerHTML = `<h1>God Mode</h1><p>Edits save immediately.</p>
  <h3>Players</h3><input id="gm-search" placeholder="Search player"/><button id="gm-find">Find</button><div id="gm-player"></div>
  <h3>Rosters</h3><p>Move player to team/free agency.</p><input id="gm-move-pid" placeholder="Player ID"/> <select id="gm-move-team"><option value="">Free Agent</option>${teams}</select> <button id="gm-move">Apply</button>`;

  main.querySelector('#gm-find').onclick = () => {
    const q = main.querySelector('#gm-search').value.toLowerCase().trim();
    const p = state.players.find((x) => x.name.toLowerCase().includes(q));
    const box = main.querySelector('#gm-player');
    if (!p) { box.innerHTML = '<p>No player found.</p>'; return; }
    box.innerHTML = `<div class="card"><p><strong>${p.name}</strong> (${p.pid})</p><label>Age <input id="gm-age" value="${p.age}"/></label><label>Nationality <input id="gm-nat" value="${p.nationality}"/></label><label>Primary Role <select id="gm-role">${ROLES.map((r)=>`<option ${p.primaryRole===r?'selected':''}>${r}</option>`).join('')}</select></label><label>Traits CSV <input id="gm-traits" value="${(p.traits||[]).join(', ')}"/></label><button id="gm-apply-player">Apply</button></div>`;
    box.querySelector('#gm-apply-player').onclick = () => {
      mutateWorld((w) => {
        const wp = w.players.find((x) => x.pid === p.pid); if (!wp) return;
        wp.age = Number(box.querySelector('#gm-age').value) || wp.age;
        wp.nationality = box.querySelector('#gm-nat').value || wp.nationality;
        wp.primaryRole = box.querySelector('#gm-role').value;
        wp.currentRole = wp.primaryRole;
        wp.preferredRole = wp.primaryRole;
        wp.traits = box.querySelector('#gm-traits').value.split(',').map((x)=>x.trim()).filter(Boolean).slice(0,4);
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
  };

  main.querySelector('#gm-move').onclick = () => {
    mutateWorld((w) => {
      const pid = main.querySelector('#gm-move-pid').value.trim();
      const p = w.players.find((x) => x.pid === pid);
      if (!p) return;
      const tidRaw = main.querySelector('#gm-move-team').value;
      p.tid = tidRaw === '' ? null : Number(tidRaw);
      for (const t of w.teams) {
        t.starters = (t.starters || []).filter((id) => id !== p.pid);
      }
      if (p.tid != null) {
        const team = w.teams.find((t) => t.tid === p.tid);
        const rosterIds = w.players.filter((pl) => pl.tid === p.tid).map((pl) => pl.pid);
        team.starters = [...new Set([...(team.starters || []), ...rosterIds])].slice(0, 5);
      }
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}
