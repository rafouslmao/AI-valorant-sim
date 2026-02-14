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
  const seasonParam = new URLSearchParams(window.location.hash.split('?')[1] || '').get('season');
  const selectedSeason = Number(seasonParam || state.meta.year);
  const teamByTid = (tid) => state.teams.find((t) => t.tid === tid);
  const historySeasons = Object.keys(state.history?.seasons || {}).map(Number).sort((a, b) => b - a);
  const seasonOptions = [state.meta.year, ...historySeasons.filter((y) => y !== state.meta.year)].sort((a, b) => b - a);

  if (selectedSeason === state.meta.year) {
    const matches = currentSeasonMatches(state).filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
    main.innerHTML = `<h1>Matches</h1><label>Season <select id="season-select">${seasonOptions.map((y) => `<option value="${y}" ${y === selectedSeason ? 'selected' : ''}>${y}</option>`).join('')}</select></label><table><tr><th>Week</th><th>Match</th><th>User W-L</th><th>Opp W-L</th><th>Status</th><th></th></tr>${matches.map((m) => {
      const oppTid = m.homeTid === state.userTid ? m.awayTid : m.homeTid;
      const home = teamByTid(m.homeTid); const away = teamByTid(m.awayTid);
      return `<tr><td>${m.week}</td><td>${home.abbrev} vs ${away.abbrev}</td><td>${recordFromMatchList(matches, state.userTid)}</td><td>${recordFromMatchList(matches, oppTid)}</td><td>${matchResultText(state, m)}</td><td>${m.status === 'final' ? `<a href="#/match?id=${m.mid}">View Result</a>` : `<a href="#/match?id=${m.mid}">Open Match</a>`}</td></tr>`;
    }).join('')}</table>`;
  } else {
    const archive = state.history?.seasons?.[selectedSeason];
    const matches = (archive?.schedule || []).filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
    main.innerHTML = `<h1>Matches</h1><label>Season <select id="season-select">${seasonOptions.map((y) => `<option value="${y}" ${y === selectedSeason ? 'selected' : ''}>${y}</option>`).join('')}</select></label><p>Past season (read-only)</p><table><tr><th>Week</th><th>Match</th><th>User W-L</th><th>Opp W-L</th><th>Status</th><th></th></tr>${matches.map((m) => {
      const oppTid = m.homeTid === state.userTid ? m.awayTid : m.homeTid;
      const home = teamByTid(m.homeTid); const away = teamByTid(m.awayTid);
      return `<tr><td>${m.week}</td><td>${home.abbrev} vs ${away.abbrev}</td><td>${recordFromMatchList(matches, state.userTid)}</td><td>${recordFromMatchList(matches, oppTid)}</td><td>${m.status || 'Final'}</td><td><a href="#/match?id=${m.matchId}&season=${selectedSeason}">View Result</a></td></tr>`;
    }).join('') || '<tr><td colspan="6">No archived matches.</td></tr>'}</table>`;
  }

  const sel = main.querySelector('#season-select');
  if (sel) sel.onchange = (e) => { window.location.hash = `#/matches?season=${e.target.value}`; };
}

export function renderMatchView(main, state, id) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const requestedSeason = Number(params.get('season') || state.meta.year);
  const isHistory = requestedSeason !== state.meta.year;

  const currentUserMatches = currentSeasonMatches(state).filter((m) => m.homeTid === state.userTid || m.awayTid === state.userTid);
  let match = null;
  if (isHistory) {
    match = state.history?.matches?.[id] || null;
  } else {
    match = currentUserMatches.find((m) => m.mid === id) || currentUserMatches.find((m) => m.status !== 'final') || currentUserMatches[0];
    if (match) mutateWorld((w) => openMatch(w, match.mid));
  }
  if (!match) return (main.innerHTML = '<p>No user matches.</p>');

  const team = getUserTeam(state);
  const start = starters(state, team.tid);
  const lineupWarning = start.length < 5 ? '<p class="error">Need 5 starters before match can begin.</p>' : '';
  const live = match.live;
  const map = live?.maps?.[live.mapIndex];
  const scoreLine = map ? `${map.score[match.homeTid]} - ${map.score[match.awayTid]}` : (match.result?.summary || '-');
  const playerName = (pid) => state.players.find((p) => p.pid === pid)?.name || pid;

  const timeline = (map?.rounds || []).slice(-12).map((r) => {
    const fk = r.firstKill ? `FK:${playerName(r.firstKill.pid)}` : '';
    const clutch = r.clutches?.length ? `Clutch x${r.clutches.length}` : '';
    return `<div>R${r.roundIndex} ${r.winType.toUpperCase()} ${r.plant ? '🌱' : ''}${r.defuse ? '🧰' : ''} | ${r.eco[match.homeTid].buyType}/${r.eco[match.awayTid].buyType} | ${fk} ${clutch}</div>`;
  }).join('') || '<p>No rounds yet.</p>';

  const keyMoments = (map?.keyMoments || []).slice(0, 12).map((m) => {
    if (m.type === 'timeout') return `<li>R${m.roundIndex}: Timeout by ${state.teams.find((t) => t.tid === m.byTid)?.abbrev || m.byTid} (${m.reason})</li>`;
    if (m.type === 'firstKill') return `<li>R${m.roundIndex}: First kill by ${playerName(m.pid)}</li>`;
    if (m.type === 'clutch') return `<li>R${m.roundIndex}: ${playerName(m.pid)} won 1v${m.vs}</li>`;
    if (m.type === 'multikill') return `<li>R${m.roundIndex}: ${playerName(m.pid)} posted ${m.count}K</li>`;
    return `<li>${m.type}</li>`;
  }).join('') || '<li>No key moments yet.</li>';

  const econRows = (map?.rounds || []).slice(-8).map((r) => `<tr><td>R${r.roundIndex}</td><td>${r.eco[match.homeTid].avgCreditsBeforeBuy} (${r.eco[match.homeTid].buyType})</td><td>${r.eco[match.awayTid].avgCreditsBeforeBuy} (${r.eco[match.awayTid].buyType})</td></tr>`).join('');
  const mapOptions = ['series'].concat((match.result?.maps || []).map((_, i) => String(i)));
  const selected = new URLSearchParams(window.location.hash.split('?')[1] || '').get('box') || 'series';
  const selectedMap = selected === 'series' ? null : (match.result?.maps || [])[Number(selected)];

  const aggregateByTeam = (maps, tid) => {
    const rows = {};
    for (const m of maps) {
      for (const p of m.playerStats?.[tid] || []) {
        if (!rows[p.pid]) rows[p.pid] = { name: p.name, agent: p.agent, kills: 0, deaths: 0, assists: 0, fk: 0, fd: 0, multi: { 2: 0, 3: 0, 4: 0, 5: 0 }, rating: 0, maps: 0 };
        rows[p.pid].kills += p.kills; rows[p.pid].deaths += p.deaths; rows[p.pid].assists += p.assists;
        rows[p.pid].fk += p.firstKills || 0; rows[p.pid].fd += p.firstDeaths || 0;
        rows[p.pid].rating += p.rating || 0; rows[p.pid].maps += 1;
        for (const r of m.rounds || []) {
          const cnt = r.killsByPlayer?.[p.pid] || 0;
          if (cnt >= 2) rows[p.pid].multi[Math.min(5, cnt)] += 1;
        }
      }
    }
    return Object.values(rows).map((r) => ({ ...r, rating: (r.rating / Math.max(1, r.maps)).toFixed(2) })).sort((a, b) => b.kills - a.kills);
  };
  const boxMaps = selectedMap ? [selectedMap] : (match.result?.maps || []);
  const homeBoxRows = aggregateByTeam(boxMaps, match.homeTid);
  const awayBoxRows = aggregateByTeam(boxMaps, match.awayTid);
  const homeName = state.teams.find((t) => t.tid === match.homeTid)?.name || 'Home';
  const awayName = state.teams.find((t) => t.tid === match.awayTid)?.name || 'Away';

  main.innerHTML = `<h1>Match View</h1>${lineupWarning}
  <p>Status: ${match.status}</p>
  <p>Current map: ${map?.mapName || 'Completed'}</p>
  <p>Series: ${live ? `${live.seriesScore[match.homeTid]}-${live.seriesScore[match.awayTid]}` : match.result?.summary || '-'}</p>
  <p>Round score: ${scoreLine}</p>
  <p>Starters: ${start.map((p) => `${p.name} (${p.currentRole})`).join(', ') || 'None'}</p>
  ${isHistory ? '<p><em>Archived match (read-only)</em></p>' : '<div class="top-actions"><button id="r1">Play Next Round</button><button id="r3">Play Next 3 Rounds</button><button id="half">Sim to Half</button><button id="map">Sim Map</button><button id="series">Sim Series</button></div>'}
  <h3>Round Timeline</h3><div class="card">${timeline}</div>
  <h3>Key Moments</h3><ul>${keyMoments}</ul>
  <h3>Economy Panel</h3><table><tr><th>Round</th><th>Home</th><th>Away</th></tr>${econRows || '<tr><td colspan="3">No data</td></tr>'}</table>
  <h3>Box Score</h3><label>View <select id="box-select">${mapOptions.map((o, i) => `<option value="${o}" ${selected===o?'selected':''}>${o==='series'?'Series':`Map ${i}`}</option>`).join('')}</select></label>
  <h4>${homeName} ${selectedMap ? `${selectedMap.finalScore?.[match.homeTid] ?? 0}` : `${match.result?.seriesScore?.[match.homeTid] ?? 0}`}</h4>
  <table><tr><th>Player</th><th>Agent</th><th>K</th><th>D</th><th>A</th><th>FK</th><th>FD</th><th>2K/3K/4K/Ace</th><th>Rating</th></tr>${homeBoxRows.map((r)=>`<tr><td>${r.name}</td><td>${r.agent||'-'}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.assists}</td><td>${r.fk}</td><td>${r.fd}</td><td>${r.multi[2]}/${r.multi[3]}/${r.multi[4]}/${r.multi[5]}</td><td>${r.rating}</td></tr>`).join('') || '<tr><td colspan="9">No final stats yet.</td></tr>'}</table>
  <h4>${awayName} ${selectedMap ? `${selectedMap.finalScore?.[match.awayTid] ?? 0}` : `${match.result?.seriesScore?.[match.awayTid] ?? 0}`}</h4>
  <table><tr><th>Player</th><th>Agent</th><th>K</th><th>D</th><th>A</th><th>FK</th><th>FD</th><th>2K/3K/4K/Ace</th><th>Rating</th></tr>${awayBoxRows.map((r)=>`<tr><td>${r.name}</td><td>${r.agent||'-'}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.assists}</td><td>${r.fk}</td><td>${r.fd}</td><td>${r.multi[2]}/${r.multi[3]}/${r.multi[4]}/${r.multi[5]}</td><td>${r.rating}</td></tr>`).join('') || '<tr><td colspan="9">No final stats yet.</td></tr>'}</table>
  <pre>${(live?.log || []).slice(-16).join('\n')}</pre>`;

  const canPlay = !isHistory && start.length >= 5;
  ['#r1', '#r3', '#half', '#map', '#series'].forEach((idBtn) => { const el = main.querySelector(idBtn); if (el && !canPlay) el.disabled = true; });
  const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  main.querySelector('#box-select').onchange = (e) => { const base = `#/match?id=${match.mid}&box=${e.target.value}${isHistory ? `&season=${requestedSeason}` : ''}`; window.location.hash = base; };
  if (!isHistory) {
    main.querySelector('#r1').onclick = () => { mutateWorld((w) => playMatchRounds(w, match.mid, 1)); refresh(); };
    main.querySelector('#r3').onclick = () => { mutateWorld((w) => playMatchRounds(w, match.mid, 3)); refresh(); };
    main.querySelector('#half').onclick = () => { mutateWorld((w) => playMatchToHalf(w, match.mid)); refresh(); };
    main.querySelector('#map').onclick = () => { mutateWorld((w) => playMatchMap(w, match.mid)); refresh(); };
    main.querySelector('#series').onclick = () => { mutateWorld((w) => playMatchSeries(w, match.mid)); refresh(); };
  }
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
  const rows = state.teams.map((team) => `<tr><td><a href="#/team?id=${team.tid}">${team.name}</a></td><td>${team.region}</td><td>${recordFromSchedule(state, team.tid)}</td></tr>`).join('');
  main.innerHTML = `<h1>Teams</h1><table><tr><th>Team</th><th>Region</th><th>W-L</th></tr>${rows}</table>`;
}

export function renderTeamDetail(main, state, id) {
  const tid = Number(id);
  const team = state.teams.find((t) => t.tid === tid);
  if (!team) return (main.innerHTML = '<p>Team not found.</p>');
  const coach = state.coaches.find((c) => c.cid === team.headCoachId || (c.tid === team.tid && c.staffRole === 'Head Coach'));
  const startersRows = starters(state, team.tid).map((p) => `<li><a href="#/player?id=${p.pid}">${p.name}</a> (${p.currentRole})</li>`).join('');
  const benchRows = bench(state, team.tid).map((p) => `<li><a href="#/player?id=${p.pid}">${p.name}</a> (${p.currentRole})</li>`).join('');
  const gmLinks = state.meta.mode === 'GM' && state.userTid === team.tid ? '<a href="#/finances">View Finances</a> • ' : '';
  main.innerHTML = `<h1>${team.name}</h1><p>${team.region} • Record ${recordFromSchedule(state, team.tid)}</p>
  <p>Head Coach: ${coach ? `<a href="#/coach?id=${coach.cid}">${coach.profile.name}</a>` : 'None'}</p>
  <h3>Starters</h3><ul>${startersRows || '<li>None</li>'}</ul>
  <h3>Bench</h3><ul>${benchRows || '<li>None</li>'}</ul>
  <p>Quick links: <a href="#/players">View Players</a> • ${gmLinks}<a href="#/matches">View Schedule</a></p>`;
}

export function renderStats(main, state) {
  const season = String(state.meta.year);
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

  main.innerHTML = `<h1>Stats</h1><h3>Season ${season} - Kills Leaderboard</h3><table><tr><th>Rank</th><th>Player</th><th>Team</th><th>Kills</th><th>Deaths</th><th>Assists</th><th>K/D</th><th>Maps Played</th></tr>${rows.map((r, idx) => `<tr><td>${idx + 1}</td><td><a href="#/player?id=${r.pid}">${r.name}</a></td><td>${r.team}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.assists}</td><td>${Number(r.kd).toFixed(2)}</td><td>${r.mapsPlayed}</td></tr>`).join('')}</table>`;
}

export function renderPlayerDetail(main, state, id) {
  const p = state.players.find((x) => x.pid === id);
  if (!p) return (main.innerHTML = '<p>Player not found.</p>');
  const attrs = Object.entries(p.attrs).map(([k, v]) => `${k}: ${Math.round(v)}`).join(', ');
  const affinityTop = Object.entries(p.agentPool.affinities || {}).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([a,v])=>`${a}(${v})`).join(', ');
  const seasonRows = Object.entries(p.seasonStats || {}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([season, st]) => {
    const kd = st.deaths ? (st.kills / st.deaths).toFixed(2) : st.kills.toFixed(2);
    const kpm = (st.kills / Math.max(1, st.mapsPlayed)).toFixed(2);
    const dpm = (st.deaths / Math.max(1, st.mapsPlayed)).toFixed(2);
    return `<tr><td>${season}</td><td>${st.kills}</td><td>${st.deaths}</td><td>${st.assists}</td><td>${kd}</td><td>${kpm}</td><td>${dpm}</td><td>${st.mapsPlayed}</td><td>${st.mostKillsInMap || 0}</td></tr>`;
  }).join('');
  main.innerHTML = `${p.imageURL ? `<img src="${p.imageURL}" alt="${p.name}" style="width:120px;height:120px;object-fit:cover;border-radius:10px;margin-bottom:8px;"/>` : ''}<h1>${p.name}</h1><p>Team: ${p.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === p.tid)?.name}</p><p>Age: ${p.age ?? '-'} • Nationality: ${String(p.nationality || '-').replaceAll('_', ' ')}</p><p>OVR: ${p.ovr}</p><p>Roles: ${p.roles.join(', ')} | Current: ${p.currentRole} | Secondary Tag: ${p.secondaryRoleTag}</p><p>Contract: ${formatMoney(p.currentContract.salaryPerYear)} / ${p.currentContract.yearsRemaining}y (${p.currentContract.rolePromise})</p><p>Agent Affinity: ${affinityTop}</p><p>${attrs}</p>
  <h3>Career Stats by Season</h3><table><tr><th>Season</th><th>Kills</th><th>Deaths</th><th>Assists</th><th>K/D</th><th>Kills/Map</th><th>Deaths/Map</th><th>Maps Played</th><th>Most Ks in a Map</th></tr>${seasonRows || '<tr><td colspan="9">No completed maps yet.</td></tr>'}</table>`;
}

export function renderCoachDetail(main, state, id) {
  const c = state.coaches.find((x) => x.cid === id);
  if (!c) return (main.innerHTML = '<p>Coach not found.</p>');
  const r = c.ratings;
  main.innerHTML = `<h1>${c.profile.name}</h1><p>${c.staffRole} • ${c.profile.age} • ${c.profile.nationality} • ${c.profile.styleTag}</p><p>Team: ${c.tid === null ? 'Free Agent' : state.teams.find((t) => t.tid === c.tid)?.name}</p><p>prep ${r.prep}, veto ${r.vetoSkill}, leadership ${r.leadership}, dev ${r.skillDevelopment}</p>`;
}
