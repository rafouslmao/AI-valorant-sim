import { AGENT_POOL, MAP_POOL } from './constants.js';
import { clamp } from './utils.js';

function teamPlayers(state, tid) {
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

function pickAgent(player) {
  const role = player.currentRole || player.roles?.[0] || 'Flex';
  const list = AGENT_POOL[role] || AGENT_POOL.Flex;
  return list[Math.floor(Math.random() * list.length)];
}

function mapChoice(team, pool, type) {
  const sorted = [...pool].sort((a, b) => ((team.mapRatings?.[b.id] ?? 50) + getMapPref(team, b.id)) - ((team.mapRatings?.[a.id] ?? 50) + getMapPref(team, a.id)));
  return type === 'pick' ? sorted[0] : sorted[sorted.length - 1];
}

function coinToss(homeTid, awayTid) {
  return Math.random() > 0.5 ? homeTid : awayTid;
}

export function buildVeto(match, state) {
  const home = state.teams.find((t) => t.tid === match.homeTid);
  const away = state.teams.find((t) => t.tid === match.awayTid);
  const teamA = coinToss(home.tid, away.tid) === home.tid ? home : away;
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

function initMapLive(state, match, mapId, mapMeta) {
  const homePlayers = teamPlayers(state, match.homeTid);
  const awayPlayers = teamPlayers(state, match.awayTid);
  const stats = {
    [match.homeTid]: homePlayers.map((p) => ({ pid: p.pid, name: p.name, agent: pickAgent(p), kills: 0, deaths: 0, assists: 0, firstKills: 0 })),
    [match.awayTid]: awayPlayers.map((p) => ({ pid: p.pid, name: p.name, agent: pickAgent(p), kills: 0, deaths: 0, assists: 0, firstKills: 0 }))
  };
  return {
    mapId,
    mapName: MAP_POOL.find((m) => m.id === mapId)?.name ?? mapId,
    pickedByTid: mapMeta?.pickedByTid ?? null,
    startSideByTid: mapMeta?.sideByTid ?? {},
    rounds: [],
    score: { [match.homeTid]: 0, [match.awayTid]: 0 },
    credits: { [match.homeTid]: 800, [match.awayTid]: 800 },
    lossStreak: { [match.homeTid]: 0, [match.awayTid]: 0 },
    ecoSummary: {
      [match.homeTid]: { FULL: 0, HALF: 0, ECO: 0, FORCE: 0, creditsByRound: [] },
      [match.awayTid]: { FULL: 0, HALF: 0, ECO: 0, FORCE: 0, creditsByRound: [] }
    },
    playerStats: stats,
    finished: false,
    winnerTid: null
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

function buyType(credits, lossStreak, riskTolerance = 0.5) {
  if (credits >= 4300) return 'FULL';
  if (credits >= 3000 && Math.random() < (0.5 + riskTolerance * 0.4)) return 'FORCE';
  if (credits >= 2000 || lossStreak >= 2) return 'HALF';
  return 'ECO';
}

function buyPower(buy) {
  if (buy === 'FULL') return 1;
  if (buy === 'FORCE') return 0.86;
  if (buy === 'HALF') return 0.74;
  return 0.6;
}

function lineupStrength(state, tid) {
  const players = teamPlayers(state, tid);
  return players.reduce((s, p) => s + p.ovr + (p.roleSkills[p.currentRole] ?? 40) * 0.16, 0) / Math.max(players.length, 1);
}

function isMapFinished(score) {
  const a = Object.values(score)[0];
  const b = Object.values(score)[1];
  return (a >= 13 || b >= 13) && Math.abs(a - b) >= 2;
}

function applyRoundStats(map, winnerTid, loserTid) {
  const ws = map.playerStats[winnerTid];
  const ls = map.playerStats[loserTid];
  for (let i = 0; i < 5; i++) ws[i % ws.length].kills += 1;
  for (let i = 0; i < 3; i++) ls[i % ls.length].kills += 1;
  ws[Math.floor(Math.random() * ws.length)].firstKills += 1;
  ws.forEach((p) => { p.assists += Math.random() > 0.55 ? 1 : 0; p.deaths += Math.random() > 0.78 ? 1 : 0; });
  ls.forEach((p) => { p.deaths += Math.random() > 0.12 ? 1 : 0; p.assists += Math.random() > 0.82 ? 1 : 0; });
}

function economyUpdate(map, winnerTid, loserTid, loserPlanted = false) {
  const lossInc = [1900, 2400, 2900, 3400, 3400];
  map.lossStreak[winnerTid] = 0;
  map.lossStreak[loserTid] = Math.min(4, map.lossStreak[loserTid] + 1);
  map.credits[winnerTid] = clamp(map.credits[winnerTid] - 2600 + 3000, 0, 9000);
  map.credits[loserTid] = clamp(map.credits[loserTid] - 2000 + lossInc[map.lossStreak[loserTid]] + (loserPlanted ? 300 : 0), 0, 9000);
}

function concludeIfNeeded(match) {
  const live = match.live;
  const currentMap = live.maps[live.mapIndex];
  if (isMapFinished(currentMap.score)) {
    currentMap.finished = true;
    currentMap.winnerTid = currentMap.score[match.homeTid] > currentMap.score[match.awayTid] ? match.homeTid : match.awayTid;
    live.seriesScore[currentMap.winnerTid] += 1;
    const h = live.seriesScore[match.homeTid];
    const a = live.seriesScore[match.awayTid];
    if (h >= 2 || a >= 2) {
      live.finished = true;
      live.winnerTid = h > a ? match.homeTid : match.awayTid;
      match.status = 'final';
      match.played = true;
      match.result = {
        format: 'BO3',
        winnerTid: live.winnerTid,
        seriesScore: live.seriesScore,
        maps: live.maps.filter((m) => m.rounds.length > 0).map((m) => ({
          mapId: m.mapId,
          mapName: m.mapName,
          pickedByTid: m.pickedByTid,
          startSideByTid: m.startSideByTid,
          rounds: m.rounds,
          finalScore: { [match.homeTid]: m.score[match.homeTid], [match.awayTid]: m.score[match.awayTid] },
          winnerTid: m.winnerTid,
          playerStats: m.playerStats,
          ecoSummary: m.ecoSummary
        })),
        veto: live.veto,
        summary: `${live.seriesScore[match.homeTid]}-${live.seriesScore[match.awayTid]}`,
        topPlayers: []
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

  const home = state.teams.find((t) => t.tid === match.homeTid);
  const away = state.teams.find((t) => t.tid === match.awayTid);
  const riskHome = home.strategy?.economyRisk ?? 0.5;
  const riskAway = away.strategy?.economyRisk ?? 0.5;

  const homeBuy = buyType(map.credits[match.homeTid], map.lossStreak[match.homeTid], riskHome);
  const awayBuy = buyType(map.credits[match.awayTid], map.lossStreak[match.awayTid], riskAway);
  map.ecoSummary[match.homeTid][homeBuy] += 1;
  map.ecoSummary[match.awayTid][awayBuy] += 1;
  map.ecoSummary[match.homeTid].creditsByRound.push(map.credits[match.homeTid]);
  map.ecoSummary[match.awayTid].creditsByRound.push(map.credits[match.awayTid]);

  const mDef = MAP_POOL.find((m) => m.id === map.mapId) || { atkBias: 0, defBias: 0 };
  const homePower = lineupStrength(state, match.homeTid) * buyPower(homeBuy) * (1 + (home.mapRatings?.[map.mapId] ?? 50) / 900) * (1 + mDef.atkBias * 0.5);
  const awayPower = lineupStrength(state, match.awayTid) * buyPower(awayBuy) * (1 + (away.mapRatings?.[map.mapId] ?? 50) / 900) * (1 + mDef.defBias * 0.5);
  const pHome = 1 / (1 + Math.exp(-(homePower - awayPower) / 8));
  const homeWin = Math.random() < pHome;
  const winnerTid = homeWin ? match.homeTid : match.awayTid;
  const loserTid = homeWin ? match.awayTid : match.homeTid;

  map.score[winnerTid] += 1;
  economyUpdate(map, winnerTid, loserTid, Math.random() > 0.7);
  applyRoundStats(map, winnerTid, loserTid);

  live.roundIndex += 1;
  map.rounds.push({ round: live.roundIndex, winnerTid, score: { ...map.score }, buy: { [match.homeTid]: homeBuy, [match.awayTid]: awayBuy }, credits: { ...map.credits } });
  live.log.push(`Map ${live.mapIndex + 1} R${live.roundIndex}: ${winnerTid === match.homeTid ? home.abbrev : away.abbrev} won`);
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
  while (!match.live.finished && map && (map.score[match.homeTid] + map.score[match.awayTid] < 12)) {
    playLiveRound(state, match);
  }
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
