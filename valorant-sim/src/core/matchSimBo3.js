import { AGENT_ROLES, ALL_AGENTS, MAP_POOL } from './constants.js';
import { clamp } from './utils.js';

const ROUND_TYPES = ['elim', 'spike', 'defuse', 'time'];
const BUY_LABELS = ['ECO', 'HALF', 'FORCE', 'FULL'];
const SIDE_SWITCH_ROUND = 12;

function roleFromLower(role) {
  const key = String(role || '').toLowerCase();
  if (key === 'duelist') return 'Duelist';
  if (key === 'initiator') return 'Initiator';
  if (key === 'controller') return 'Controller';
  if (key === 'sentinel') return 'Sentinel';
  return 'Flex';
}

function teamStarters(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  const ids = team?.starters || [];
  const players = ids.map((pid) => state.players.find((p) => p.pid === pid)).filter(Boolean);
  if (players.length >= 5) return players.slice(0, 5);
  return state.players.filter((p) => p.tid === tid).slice(0, 5);
}

function getMapPref(team, mapId) {
  const pref = team.strategy?.mapPreferences?.[mapId] ?? 'Neutral';
  if (pref === 'PermaPick') return 24;
  if (pref === 'Like') return 10;
  if (pref === 'Dislike') return -10;
  if (pref === 'PermaBan') return -24;
  return 0;
}

function mapChoice(team, pool, type) {
  const sorted = [...pool].sort((a, b) => ((team.mapRatings?.[b.id] ?? 50) + getMapPref(team, b.id)) - ((team.mapRatings?.[a.id] ?? 50) + getMapPref(team, a.id)));
  return type === 'pick' ? sorted[0] : sorted[sorted.length - 1];
}

function bestAgentByRole(player, role, blocked = new Set()) {
  const affinities = Object.entries(player.agentPool?.affinities || {}).filter(([agent]) => !blocked.has(agent));
  const roleAgents = role && role !== 'Flex' ? AGENT_ROLES[role] || [] : ALL_AGENTS;
  const forRole = affinities.filter(([agent]) => roleAgents.includes(agent));
  const pool = forRole.length ? forRole : affinities;
  if (!pool.length) return roleAgents[0] || ALL_AGENTS[0];
  pool.sort((a, b) => b[1] - a[1]);
  return pool[0][0];
}

function buildAutoComp(team, starters, allowDupes) {
  const used = new Set();
  const comp = { assignments: {}, agents: [] };
  for (const p of starters) {
    const role = roleFromLower(p.agentPool?.primaryRole || p.currentRole);
    const agent = bestAgentByRole(p, role, allowDupes ? new Set() : used);
    comp.assignments[p.pid] = agent;
    comp.agents.push(agent);
    used.add(agent);
  }
  return comp;
}

function resolveCompAssignments(state, team, starters, mapId) {
  const allowDupes = Boolean(state.rules?.allowDuplicateAgentsSameTeam);
  const assignment = {};
  const used = new Set();
  const strategyRoot = team.tid === state.userTid ? (state.strategy || {}) : (team.strategy || {});
  const mapTemplate = strategyRoot.maps?.[mapId]?.comps?.find((c) => c.id === strategyRoot.maps?.[mapId]?.defaultCompId)
    || strategyRoot.global?.comps?.find((c) => c.id === strategyRoot.global?.defaultCompId)
    || null;

  if (mapTemplate) {
    for (const p of starters) {
      const preset = mapTemplate.assignments?.[p.pid] || '';
      if (preset && (allowDupes || !used.has(preset))) {
        assignment[p.pid] = preset;
        used.add(preset);
        continue;
      }
      const slot = (mapTemplate.slots || []).map((slot) => slot?.agent || '').find((agent) => agent && (allowDupes || !used.has(agent)));
      if (slot) {
        assignment[p.pid] = slot;
        used.add(slot);
      }
    }
  }

  for (const p of starters) {
    if (assignment[p.pid]) continue;
    const role = roleFromLower(p.agentPool?.primaryRole || p.currentRole);
    const pick = bestAgentByRole(p, role, allowDupes ? new Set() : used);
    assignment[p.pid] = pick;
    used.add(pick);
  }

  return assignment;
}

function affinityScore(player, agent) {
  return player.agentPool?.affinities?.[agent] ?? 40;
}

function buyDecision(avgCreditsBeforeBuy, lossStreak, riskTolerance = 0.5) {
  if (avgCreditsBeforeBuy >= 4300) return 'FULL';
  if (avgCreditsBeforeBuy >= 3000) return Math.random() < (0.35 + riskTolerance * 0.45) ? 'FORCE' : 'HALF';
  if (avgCreditsBeforeBuy >= 2300 || lossStreak >= 2) return 'HALF';
  return Math.random() < 0.2 + (riskTolerance * 0.2) ? 'FORCE' : 'ECO';
}

function buyProfile(avgCreditsBeforeBuy, lossStreak, riskTolerance) {
  const buyType = buyDecision(avgCreditsBeforeBuy, lossStreak, riskTolerance);
  const armorTier = buyType === 'FULL' ? 'heavy' : buyType === 'FORCE' ? 'light' : buyType === 'HALF' ? 'light' : 'none';
  const primaryTier = buyType === 'FULL' ? (Math.random() < 0.18 ? 'sniper' : 'rifle') : buyType === 'FORCE' ? 'mixed' : buyType === 'HALF' ? 'smg' : 'pistol';
  const utilSpendLevel = Number((buyType === 'FULL' ? 0.8 : buyType === 'FORCE' ? 0.65 : buyType === 'HALF' ? 0.45 : 0.2).toFixed(2));
  return { avgCreditsBeforeBuy, buyType, armorTier, primaryTier, utilSpendLevel };
}

function buyPower(profile) {
  if (profile.buyType === 'FULL') return 1;
  if (profile.buyType === 'FORCE') return 0.87;
  if (profile.buyType === 'HALF') return 0.75;
  return 0.61;
}

function makeStatsRows(players, agents) {
  return players.map((p) => ({
    pid: p.pid,
    name: p.name,
    role: p.currentRole,
    agent: agents[p.pid],
    kills: 0,
    deaths: 0,
    assists: 0,
    firstKills: 0,
    firstDeaths: 0,
    clutches: 0,
    rating: 0
  }));
}

function initMapLive(state, match, mapId, mapMeta) {
  const homeTeam = state.teams.find((t) => t.tid === match.homeTid);
  const awayTeam = state.teams.find((t) => t.tid === match.awayTid);
  const homePlayers = teamStarters(state, match.homeTid);
  const awayPlayers = teamStarters(state, match.awayTid);
  const homeAgents = resolveCompAssignments(state, homeTeam, homePlayers, mapId);
  const awayAgents = resolveCompAssignments(state, awayTeam, awayPlayers, mapId);

  return {
    mapId,
    mapName: MAP_POOL.find((m) => m.id === mapId)?.name ?? mapId,
    pickedByTid: mapMeta?.pickedByTid ?? null,
    startSideByTid: mapMeta?.sideByTid ?? {},
    rounds: [],
    keyMoments: [],
    score: { [match.homeTid]: 0, [match.awayTid]: 0 },
    credits: { [match.homeTid]: 800, [match.awayTid]: 800 },
    lossStreak: { [match.homeTid]: 0, [match.awayTid]: 0 },
    ecoSummary: {
      [match.homeTid]: { FULL: 0, HALF: 0, ECO: 0, FORCE: 0, creditsByRound: [] },
      [match.awayTid]: { FULL: 0, HALF: 0, ECO: 0, FORCE: 0, creditsByRound: [] }
    },
    playerStats: {
      [match.homeTid]: makeStatsRows(homePlayers, homeAgents),
      [match.awayTid]: makeStatsRows(awayPlayers, awayAgents)
    },
    timeouts: { [match.homeTid]: 2, [match.awayTid]: 2 },
    finished: false,
    winnerTid: null
  };
}

function sideForTeam(match, map, tid, roundIndex) {
  const firstHalfDefault = tid === match.homeTid ? 'atk' : 'def';
  const firstSideRaw = map.startSideByTid?.[tid];
  const firstSide = firstSideRaw ? firstSideRaw.toLowerCase() : firstHalfDefault;
  const switched = roundIndex >= SIDE_SWITCH_ROUND;
  if (!switched) return firstSide === 'atk' ? 'atk' : 'def';
  return firstSide === 'atk' ? 'def' : 'atk';
}

function playerContribution(statsRow, affinity, side) {
  const role = String(statsRow.role || '').toLowerCase();
  const duelBonus = role === 'duelist' ? affinity * 0.008 : 0;
  const utilBonus = (role === 'initiator' || role === 'controller') ? affinity * 0.006 : 0;
  const clutchBonus = role === 'sentinel' ? affinity * 0.006 : 0;
  const sideBias = side === 'atk' ? duelBonus + utilBonus * 0.4 : clutchBonus + utilBonus * 0.6;
  return statsRow.kills * 0.2 + statsRow.assists * 0.1 + sideBias;
}

function lineupStrength(state, match, map, tid, side, buyProfileData) {
  const team = state.teams.find((t) => t.tid === tid);
  const mapDef = MAP_POOL.find((m) => m.id === map.mapId) || { atkBias: 0, defBias: 0 };
  const rows = map.playerStats[tid] || [];
  const playerImpact = rows.reduce((sum, row) => {
    const player = state.players.find((p) => p.pid === row.pid);
    const affinity = affinityScore(player, row.agent);
    const base = (player?.ovr || 55) + ((player?.roleSkills?.[player?.currentRole] || 45) * 0.2);
    return sum + base + playerContribution(row, affinity, side);
  }, 0) / Math.max(rows.length, 1);
  const utilMod = rows.reduce((sum, row) => {
    const player = state.players.find((p) => p.pid === row.pid);
    const affinity = affinityScore(player, row.agent);
    const role = String(row.role || '').toLowerCase();
    if (role === 'initiator' || role === 'controller') return sum + affinity * 0.0015;
    return sum;
  }, 0);
  const mapMod = 1 + (team.mapRatings?.[map.mapId] ?? 50) / 950;
  const sideMod = 1 + (side === 'atk' ? mapDef.atkBias : mapDef.defBias) * 0.5;
  return (playerImpact + utilMod) * mapMod * sideMod * buyPower(buyProfileData);
}

function maybeTimeout(match, map, tid, roundIndex) {
  if (map.timeouts[tid] <= 0) return null;
  const oppTid = tid === match.homeTid ? match.awayTid : match.homeTid;
  const scoreDiff = map.score[oppTid] - map.score[tid];
  const atMatchPoint = map.score[oppTid] >= 12;
  const lowEcon = map.credits[tid] < 2200;
  const shouldCall = scoreDiff >= 4 || atMatchPoint || (lowEcon && Math.random() < 0.35);
  if (!shouldCall) return null;
  map.timeouts[tid] -= 1;
  const reason = atMatchPoint ? 'matchPoint' : scoreDiff >= 4 ? 'losingStreak' : 'econ';
  const timeout = { type: 'timeout', byTid: tid, roundIndex, reason, effect: 'focusBuff' };
  map.keyMoments.push(timeout);
  return timeout;
}

function assignRoundKills(winners, losers, firstKillTid, clutchInfo, roundIndex) {
  const winnerRows = [...winners];
  const loserRows = [...losers];
  const winnerKillsTarget = 5;
  const loserKillsTarget = Math.floor(Math.random() * 4);
  const roundKills = {};

  for (let i = 0; i < winnerKillsTarget; i++) {
    const row = winnerRows[Math.floor(Math.random() * winnerRows.length)];
    row.kills += 1; roundKills[row.pid] = (roundKills[row.pid] || 0) + 1;
  }
  for (let i = 0; i < loserKillsTarget; i++) {
    const row = loserRows[Math.floor(Math.random() * loserRows.length)];
    row.kills += 1; roundKills[row.pid] = (roundKills[row.pid] || 0) + 1;
  }

  winners.forEach((r) => { if (Math.random() < 0.42) r.assists += 1; });
  losers.forEach((r) => { if (Math.random() < 0.25) r.assists += 1; });

  const deadLosers = loserRows.slice(0, Math.min(5, loserRows.length));
  deadLosers.forEach((r) => { r.deaths += 1; });
  if (loserKillsTarget > 2) winners[Math.floor(Math.random() * winners.length)].deaths += 1;

  const fkTeam = firstKillTid === winners[0]?.tid ? winners : losers;
  const fdTeam = firstKillTid === winners[0]?.tid ? losers : winners;
  if (fkTeam.length && fdTeam.length) {
    fkTeam[0].firstKills += 1;
    fdTeam[0].firstDeaths += 1;
  }
  if (clutchInfo?.row) clutchInfo.row.clutches += 1;
  const multikills = Object.entries(roundKills).filter(([, c]) => c >= 2).map(([pid, count]) => ({ pid, count, roundIndex, importance: count >= 4 ? 100 + count : count === 3 ? 80 : 60 }));
  return { roundKills, multikills };
}

function updateEconomy(map, winnerTid, loserTid, loserPlant, ecoInfo) {
  const lossInc = [1900, 2400, 2900, 3400, 3400];
  map.lossStreak[winnerTid] = 0;
  map.lossStreak[loserTid] = Math.min(4, map.lossStreak[loserTid] + 1);

  const winnerSpend = ecoInfo[winnerTid].buyType === 'FULL' ? 4300 : ecoInfo[winnerTid].buyType === 'FORCE' ? 3400 : ecoInfo[winnerTid].buyType === 'HALF' ? 2700 : 1100;
  const loserSpend = ecoInfo[loserTid].buyType === 'FULL' ? 4300 : ecoInfo[loserTid].buyType === 'FORCE' ? 3200 : ecoInfo[loserTid].buyType === 'HALF' ? 2400 : 1000;

  map.credits[winnerTid] = clamp(map.credits[winnerTid] - winnerSpend + 3000, 0, 9000);
  map.credits[loserTid] = clamp(map.credits[loserTid] - loserSpend + lossInc[map.lossStreak[loserTid]] + (loserPlant ? 300 : 0), 0, 9000);
}

function computeRatings(rows) {
  rows.forEach((p) => {
    const kdr = p.deaths ? p.kills / p.deaths : p.kills;
    p.rating = Number((0.42 * kdr + 0.15 * p.assists + 0.3 * p.firstKills + 0.45 * p.clutches + p.kills * 0.03).toFixed(2));
  });
}

function isMapFinished(score) {
  const a = Object.values(score)[0];
  const b = Object.values(score)[1];
  return (a >= 13 || b >= 13) && Math.abs(a - b) >= 2;
}

function topPlayersFromMaps(maps) {
  const totals = {};
  for (const m of maps) {
    for (const arr of Object.values(m.playerStats || {})) {
      for (const p of arr) {
        if (!totals[p.pid]) totals[p.pid] = { name: p.name, kills: 0, assists: 0, deaths: 0, rating: 0, maps: 0 };
        totals[p.pid].kills += p.kills;
        totals[p.pid].assists += p.assists;
        totals[p.pid].deaths += p.deaths;
        totals[p.pid].rating += p.rating || 0;
        totals[p.pid].maps += 1;
      }
    }
  }
  return Object.values(totals).map((p) => ({ ...p, rating: Number((p.rating / Math.max(1, p.maps)).toFixed(2)) })).sort((a, b) => (b.rating - a.rating) || (b.kills - a.kills)).slice(0, 3);
}

export function buildVeto(match, state) {
  const home = state.teams.find((t) => t.tid === match.homeTid);
  const away = state.teams.find((t) => t.tid === match.awayTid);
  const teamA = Math.random() > 0.5 ? home : away;
  const teamB = teamA.tid === home.tid ? away : home;
  let pool = [...MAP_POOL];
  const actions = [];

  const ban1 = mapChoice(teamA, pool, 'ban'); pool = pool.filter((m) => m.id !== ban1.id); actions.push({ step: 'A ban', tid: teamA.tid, mapId: ban1.id });
  const ban2 = mapChoice(teamB, pool, 'ban'); pool = pool.filter((m) => m.id !== ban2.id); actions.push({ step: 'B ban', tid: teamB.tid, mapId: ban2.id });
  const pick1 = mapChoice(teamA, pool, 'pick'); pool = pool.filter((m) => m.id !== pick1.id); actions.push({ step: 'A pick', tid: teamA.tid, mapId: pick1.id });
  const side1 = Math.random() > 0.5 ? 'ATK' : 'DEF'; actions.push({ step: 'B side', tid: teamB.tid, mapId: pick1.id, side: side1 });
  const pick2 = mapChoice(teamB, pool, 'pick'); pool = pool.filter((m) => m.id !== pick2.id); actions.push({ step: 'B pick', tid: teamB.tid, mapId: pick2.id });
  const side2 = Math.random() > 0.5 ? 'ATK' : 'DEF'; actions.push({ step: 'A side', tid: teamA.tid, mapId: pick2.id, side: side2 });
  const ban3 = mapChoice(teamA, pool, 'ban'); pool = pool.filter((m) => m.id !== ban3.id); actions.push({ step: 'A ban', tid: teamA.tid, mapId: ban3.id });
  const ban4 = mapChoice(teamB, pool, 'ban'); pool = pool.filter((m) => m.id !== ban4.id); actions.push({ step: 'B ban', tid: teamB.tid, mapId: ban4.id });
  const decider = pool[0];
  const side3 = Math.random() > 0.5 ? 'ATK' : 'DEF'; actions.push({ step: 'A side', tid: teamA.tid, mapId: decider.id, side: side3 });

  return {
    teamA: teamA.tid,
    teamB: teamB.tid,
    actions,
    order: [pick1.id, pick2.id, decider.id],
    mapMeta: {
      [pick1.id]: { pickedByTid: teamA.tid, sideByTid: { [teamB.tid]: side1 } },
      [pick2.id]: { pickedByTid: teamB.tid, sideByTid: { [teamA.tid]: side2 } },
      [decider.id]: { pickedByTid: null, sideByTid: { [teamA.tid]: side3 } }
    }
  };
}

export function initializeLiveSeries(state, match) {
  const veto = buildVeto(match, state);
  match.status = 'inProgress';
  match.live = {
    mapIndex: 0,
    roundIndex: 0,
    seriesScore: { [match.homeTid]: 0, [match.awayTid]: 0 },
    veto,
    maps: veto.order.map((id) => initMapLive(state, match, id, veto.mapMeta[id])),
    finished: false,
    winnerTid: null,
    log: []
  };
  return match.live;
}

function concludeIfNeeded(match) {
  const live = match.live;
  const currentMap = live.maps[live.mapIndex];
  if (!currentMap) return;
  if (isMapFinished(currentMap.score)) {
    currentMap.finished = true;
    currentMap.winnerTid = currentMap.score[match.homeTid] > currentMap.score[match.awayTid] ? match.homeTid : match.awayTid;
    computeRatings(currentMap.playerStats[match.homeTid]);
    computeRatings(currentMap.playerStats[match.awayTid]);
    live.seriesScore[currentMap.winnerTid] += 1;

    const h = live.seriesScore[match.homeTid];
    const a = live.seriesScore[match.awayTid];
    if (h >= 2 || a >= 2) {
      live.finished = true;
      live.winnerTid = h > a ? match.homeTid : match.awayTid;
      match.status = 'final';
      match.played = true;
      const finalMaps = live.maps.filter((m) => m.rounds.length > 0).map((m) => ({
        mapId: m.mapId,
        mapName: m.mapName,
        pickedByTid: m.pickedByTid,
        startSideByTid: m.startSideByTid,
        rounds: m.rounds,
        keyMoments: m.keyMoments,
        finalScore: { [match.homeTid]: m.score[match.homeTid], [match.awayTid]: m.score[match.awayTid] },
        winnerTid: m.winnerTid,
        playerStats: m.playerStats,
        ecoSummary: m.ecoSummary
      }));
      match.result = {
        format: 'BO3',
        winnerTid: live.winnerTid,
        seriesScore: live.seriesScore,
        maps: finalMaps,
        veto: live.veto,
        summary: `${live.seriesScore[match.homeTid]}-${live.seriesScore[match.awayTid]}`,
        topPlayers: topPlayersFromMaps(finalMaps)
      };
    } else {
      live.mapIndex += 1;
      live.roundIndex = 0;
    }
  }
}

export function playLiveRound(state, match) {
  if (!match.live) initializeLiveSeries(state, match);
  if (match.live.finished) return;
  const live = match.live;
  const map = live.maps[live.mapIndex];
  if (!map || map.finished) return concludeIfNeeded(match);

  const homeTeam = state.teams.find((t) => t.tid === match.homeTid);
  const awayTeam = state.teams.find((t) => t.tid === match.awayTid);

  const roundIndex = live.roundIndex;
  const homeEco = buyProfile(map.credits[match.homeTid], map.lossStreak[match.homeTid], homeTeam.strategy?.economyRisk ?? 0.5);
  const awayEco = buyProfile(map.credits[match.awayTid], map.lossStreak[match.awayTid], awayTeam.strategy?.economyRisk ?? 0.5);

  map.ecoSummary[match.homeTid][homeEco.buyType] += 1;
  map.ecoSummary[match.awayTid][awayEco.buyType] += 1;
  map.ecoSummary[match.homeTid].creditsByRound.push(homeEco.avgCreditsBeforeBuy);
  map.ecoSummary[match.awayTid].creditsByRound.push(awayEco.avgCreditsBeforeBuy);

  const homeSide = sideForTeam(match, map, match.homeTid, roundIndex);
  const awaySide = sideForTeam(match, map, match.awayTid, roundIndex);

  const timeoutA = maybeTimeout(match, map, match.homeTid, roundIndex + 1);
  const timeoutB = maybeTimeout(match, map, match.awayTid, roundIndex + 1);

  const buffA = timeoutA ? 1.03 : 1;
  const buffB = timeoutB ? 1.03 : 1;
  const homePower = lineupStrength(state, match, map, match.homeTid, homeSide, homeEco) * buffA;
  const awayPower = lineupStrength(state, match, map, match.awayTid, awaySide, awayEco) * buffB;

  const pHome = 1 / (1 + Math.exp(-(homePower - awayPower) / 10));
  const homeWin = Math.random() < pHome;
  const winnerTid = homeWin ? match.homeTid : match.awayTid;
  const loserTid = homeWin ? match.awayTid : match.homeTid;
  const sideWon = winnerTid === match.homeTid ? homeSide : awaySide;

  const winType = ROUND_TYPES[Math.floor(Math.random() * ROUND_TYPES.length)];
  const plant = winType === 'spike' || (winType === 'defuse' ? true : Math.random() < 0.28);
  const defuse = winType === 'defuse';

  const winnerRows = map.playerStats[winnerTid];
  const loserRows = map.playerStats[loserTid];
  winnerRows.forEach((r) => { r.tid = winnerTid; });
  loserRows.forEach((r) => { r.tid = loserTid; });

  const allRows = [...winnerRows, ...loserRows];
  const sortedByDuel = [...allRows].sort((a, b) => {
    const pa = state.players.find((p) => p.pid === a.pid);
    const pb = state.players.find((p) => p.pid === b.pid);
    const aa = affinityScore(pa, a.agent) + (String(a.role).toLowerCase() === 'duelist' ? 14 : 0);
    const ab = affinityScore(pb, b.agent) + (String(b.role).toLowerCase() === 'duelist' ? 14 : 0);
    return ab - aa;
  });
  const fkRow = sortedByDuel[0];
  const firstKill = fkRow ? { pid: fkRow.pid, tid: allRows.find((r) => r.pid === fkRow.pid)?.tid ?? winnerTid } : null;

  let clutches = [];
  if (Math.random() < 0.18) {
    const clutchRow = winnerRows[Math.floor(Math.random() * winnerRows.length)];
    const vs = [1, 2, 3][Math.floor(Math.random() * 3)];
    clutches = [{ pid: clutchRow.pid, tid: winnerTid, vs }];
  }

  const roundImpact = assignRoundKills(winnerRows, loserRows, firstKill?.tid ?? winnerTid, clutches[0] ? { row: winnerRows.find((x) => x.pid === clutches[0].pid) } : null, live.roundIndex + 1);

  map.score[winnerTid] += 1;
  updateEconomy(map, winnerTid, loserTid, plant && sideWon === 'atk', { [match.homeTid]: homeEco, [match.awayTid]: awayEco });

  live.roundIndex += 1;
  const roundLog = {
    roundIndex: live.roundIndex,
    winnerTid,
    sideWon,
    winType,
    plant,
    defuse,
    firstKill,
    clutches,
    killsByPlayer: roundImpact.roundKills,
    eco: { [match.homeTid]: homeEco, [match.awayTid]: awayEco },
    score: { ...map.score }
  };
  map.rounds.push(roundLog);
  for (const mk of roundImpact.multikills) {
    const count = mk.count;
    map.keyMoments.push({ type: 'multikill', roundIndex: mk.roundIndex, pid: mk.pid, tid: state.players.find((p) => p.pid === mk.pid)?.tid, count, importance: mk.importance });
  }
  const winnerAbbrev = winnerTid === match.homeTid ? homeTeam.abbrev : awayTeam.abbrev;
  live.log.push(`Map ${live.mapIndex + 1} R${live.roundIndex}: ${winnerAbbrev} ${winType.toUpperCase()} (${BUY_LABELS.indexOf(homeEco.buyType) >= 0 ? homeEco.buyType : 'BUY'}/${awayEco.buyType})`);

  if (firstKill) map.keyMoments.push({ type: 'firstKill', roundIndex: live.roundIndex, importance: 30, ...firstKill });
  if (clutches.length) map.keyMoments.push({ type: 'clutch', roundIndex: live.roundIndex, pid: clutches[0].pid, tid: clutches[0].tid, vs: clutches[0].vs, importance: 50 + clutches[0].vs * 5 });
  map.keyMoments.sort((a, b) => (b.importance || 0) - (a.importance || 0));

  concludeIfNeeded(match);
}

export function playLiveRounds(state, match, n = 1) {
  for (let i = 0; i < n; i++) {
    if (match.live?.finished) break;
    playLiveRound(state, match);
  }
}

export function simLiveToHalf(state, match) {
  if (!match.live) initializeLiveSeries(state, match);
  const map = match.live.maps[match.live.mapIndex];
  while (!match.live.finished && map && (map.score[match.homeTid] + map.score[match.awayTid] < 12)) playLiveRound(state, match);
}

export function simLiveMap(state, match) {
  if (!match.live) initializeLiveSeries(state, match);
  const idx = match.live.mapIndex;
  while (!match.live.finished && match.live.mapIndex === idx) playLiveRound(state, match);
}

export function simLiveSeries(state, match) {
  if (!match.live) initializeLiveSeries(state, match);
  while (!match.live.finished) playLiveRound(state, match);
}

export function simulateBo3Series(state, match) {
  initializeLiveSeries(state, match);
  simLiveSeries(state, match);
  return match.result;
}
