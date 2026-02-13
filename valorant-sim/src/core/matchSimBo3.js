import { AGENT_POOL, MAP_POOL } from './constants.js';
import { clamp, weightedPick } from './utils.js';

const BUY_TYPES = ['ECO', 'HALF', 'FORCE', 'FULL'];

function teamPlayers(state, tid) {
  return state.players.filter((p) => p.tid === tid).slice(0, 5);
}

function coach(state, tid) {
  return state.coaches.find((c) => c.tid === tid && c.staffRole === 'Head Coach');
}

function pickAgent(player) {
  const role = player.currentRole || player.roles?.[0] || 'Flex';
  const agents = AGENT_POOL[role] || AGENT_POOL.Flex;
  return agents[Math.floor(Math.random() * agents.length)];
}

function agentMods(role) {
  if (role === 'Duelist') return { firstKill: 0.04, round: 0.015 };
  if (role === 'Controller') return { firstKill: -0.01, round: 0.012 };
  if (role === 'Initiator') return { firstKill: 0.01, round: 0.01 };
  if (role === 'Sentinel') return { firstKill: -0.02, round: 0.014 };
  return { firstKill: 0, round: 0.01 };
}

function lineupStrength(players) {
  return players.reduce((s, p) => s + p.ovr + (p.roleSkills[p.currentRole] ?? 40) * 0.2, 0) / Math.max(players.length, 1);
}

function pickMapByTeam(team, pool, best = true) {
  const sorted = [...pool].sort((a, b) => (team.mapRatings[b.id] ?? 50) - (team.mapRatings[a.id] ?? 50));
  return best ? sorted[0] : sorted[sorted.length - 1];
}

function runVeto(teamA, teamB) {
  let pool = [...MAP_POOL];
  const actions = [];

  const banA1 = pickMapByTeam(teamA, pool, false); pool = pool.filter((m) => m.id !== banA1.id); actions.push({ type: 'ban', tid: teamA.tid, mapId: banA1.id });
  const banB1 = pickMapByTeam(teamB, pool, false); pool = pool.filter((m) => m.id !== banB1.id); actions.push({ type: 'ban', tid: teamB.tid, mapId: banB1.id });

  const pickA = pickMapByTeam(teamA, pool, true); pool = pool.filter((m) => m.id !== pickA.id); actions.push({ type: 'pick', tid: teamA.tid, mapId: pickA.id });
  const side1 = Math.random() > 0.5 ? 'ATK' : 'DEF'; actions.push({ type: 'side', tid: teamB.tid, mapId: pickA.id, side: side1 });

  const pickB = pickMapByTeam(teamB, pool, true); pool = pool.filter((m) => m.id !== pickB.id); actions.push({ type: 'pick', tid: teamB.tid, mapId: pickB.id });
  const side2 = Math.random() > 0.5 ? 'ATK' : 'DEF'; actions.push({ type: 'side', tid: teamA.tid, mapId: pickB.id, side: side2 });

  const banA2 = pickMapByTeam(teamA, pool, false); pool = pool.filter((m) => m.id !== banA2.id); actions.push({ type: 'ban', tid: teamA.tid, mapId: banA2.id });
  const banB2 = pickMapByTeam(teamB, pool, false); pool = pool.filter((m) => m.id !== banB2.id); actions.push({ type: 'ban', tid: teamB.tid, mapId: banB2.id });

  const decider = pool[0];
  const side3 = Math.random() > 0.5 ? 'ATK' : 'DEF'; actions.push({ type: 'side', tid: teamA.tid, mapId: decider.id, side: side3 });

  return {
    teamA: teamA.tid,
    teamB: teamB.tid,
    actions,
    maps: [pickA, pickB, decider],
    sideByMap: { [pickA.id]: side1, [pickB.id]: side2, [decider.id]: side3 }
  };
}

function buyType(credits, lossStreak, risk = 0.5) {
  if (credits >= 4300) return 'FULL';
  if (credits >= 3000 && Math.random() < risk + 0.2) return 'FORCE';
  if (credits >= 2000) return 'HALF';
  return lossStreak >= 2 ? 'HALF' : 'ECO';
}

function buyPower(type) {
  if (type === 'FULL') return 1;
  if (type === 'FORCE') return 0.86;
  if (type === 'HALF') return 0.73;
  return 0.6;
}

function winByTwo(a, b) {
  if (a < 13 && b < 13) return false;
  return Math.abs(a - b) >= 2;
}

function applyEconomy(eco, winner, loser, plantLoser = false) {
  const winBonus = 3000;
  const lossTable = [1900, 2400, 2900, 3400, 3400];
  eco[winner].lossStreak = 0;
  eco[loser].lossStreak = Math.min(4, eco[loser].lossStreak + 1);
  eco[winner].credits = clamp(eco[winner].credits - 2600 + winBonus, 0, 9000);
  eco[loser].credits = clamp(eco[loser].credits - 2000 + lossTable[eco[loser].lossStreak] + (plantLoser ? 300 : 0), 0, 9000);
}

function maybeTimeout(t, scoreFor, scoreAgainst, credits) {
  if (t.timeouts <= 0) return false;
  if (t.streakAgainst >= 3) return true;
  if (scoreAgainst >= 12 && scoreFor <= 10) return true;
  if (credits < 1900) return Math.random() > 0.5;
  return false;
}

function playerStatsTemplate(players) {
  return Object.fromEntries(players.map((p) => [p.pid, { pid: p.pid, name: p.name, agent: pickAgent(p), kills: 0, deaths: 0, assists: 0, firstKills: 0 }]));
}

function distributeRoundStats(winnerPlayers, loserPlayers, ws, ls) {
  const wKillTotal = 5;
  const lKillTotal = Math.max(2, Math.floor(Math.random() * 5));
  for (let i = 0; i < wKillTotal; i++) ws[winnerPlayers[i % winnerPlayers.length].pid].kills += 1;
  for (let i = 0; i < lKillTotal; i++) ls[loserPlayers[i % loserPlayers.length].pid].kills += 1;
  for (const p of winnerPlayers) ws[p.pid].assists += Math.random() > 0.55 ? 1 : 0;
  for (const p of loserPlayers) ls[p.pid].deaths += Math.random() > 0.15 ? 1 : 0;
  for (const p of winnerPlayers) ws[p.pid].deaths += Math.random() > 0.8 ? 1 : 0;
  const fkPool = winnerPlayers[Math.floor(Math.random() * winnerPlayers.length)];
  ws[fkPool.pid].firstKills += 1;
}

function simMap(state, map, teamA, teamB, sideSelectorTid) {
  const aPlayers = teamPlayers(state, teamA.tid);
  const bPlayers = teamPlayers(state, teamB.tid);
  const aStats = playerStatsTemplate(aPlayers);
  const bStats = playerStatsTemplate(bPlayers);
  const eco = {
    [teamA.tid]: { credits: 800, lossStreak: 0, counts: { FULL: 0, HALF: 0, ECO: 0, FORCE: 0 }, creditsByRound: [], timeouts: 2, timeoutBuff: 0, streakAgainst: 0 },
    [teamB.tid]: { credits: 800, lossStreak: 0, counts: { FULL: 0, HALF: 0, ECO: 0, FORCE: 0 }, creditsByRound: [], timeouts: 2, timeoutBuff: 0, streakAgainst: 0 }
  };

  let aScore = 0;
  let bScore = 0;
  let round = 1;
  const rounds = [];
  const aBase = lineupStrength(aPlayers);
  const bBase = lineupStrength(bPlayers);
  const mapFavA = (teamA.mapRatings[map.id] ?? 50) / 100;
  const mapFavB = (teamB.mapRatings[map.id] ?? 50) / 100;

  while (!winByTwo(aScore, bScore) || (aScore < 13 && bScore < 13)) {
    const aBuy = buyType(eco[teamA.tid].credits, eco[teamA.tid].lossStreak, 0.5);
    const bBuy = buyType(eco[teamB.tid].credits, eco[teamB.tid].lossStreak, 0.5);
    eco[teamA.tid].counts[aBuy] += 1;
    eco[teamB.tid].counts[bBuy] += 1;
    eco[teamA.tid].creditsByRound.push(eco[teamA.tid].credits);
    eco[teamB.tid].creditsByRound.push(eco[teamB.tid].credits);

    const aTimeout = maybeTimeout(eco[teamA.tid], aScore, bScore, eco[teamA.tid].credits);
    const bTimeout = maybeTimeout(eco[teamB.tid], bScore, aScore, eco[teamB.tid].credits);
    if (aTimeout) { eco[teamA.tid].timeouts -= 1; eco[teamA.tid].timeoutBuff = 2; }
    if (bTimeout) { eco[teamB.tid].timeouts -= 1; eco[teamB.tid].timeoutBuff = 2; }

    const aAgentBonus = aPlayers.reduce((s, p) => s + agentMods(p.currentRole).round, 0) / 5;
    const bAgentBonus = bPlayers.reduce((s, p) => s + agentMods(p.currentRole).round, 0) / 5;

    const sideFav = sideSelectorTid === teamA.tid ? map.atkBias : map.defBias;
    const powerA = aBase * buyPower(aBuy) * (1 + aAgentBonus) * (1 + mapFavA * 0.08) * (1 + sideFav) * (1 + (eco[teamA.tid].timeoutBuff > 0 ? 0.03 : 0));
    const powerB = bBase * buyPower(bBuy) * (1 + bAgentBonus) * (1 + mapFavB * 0.08) * (1 - sideFav) * (1 + (eco[teamB.tid].timeoutBuff > 0 ? 0.03 : 0));

    const pA = 1 / (1 + Math.exp(-(powerA - powerB) / 7));
    const aWin = Math.random() < pA;
    const winnerTid = aWin ? teamA.tid : teamB.tid;
    const loserTid = aWin ? teamB.tid : teamA.tid;

    if (aWin) { aScore++; eco[teamA.tid].streakAgainst = 0; eco[teamB.tid].streakAgainst += 1; distributeRoundStats(aPlayers, bPlayers, aStats, bStats); }
    else { bScore++; eco[teamB.tid].streakAgainst = 0; eco[teamA.tid].streakAgainst += 1; distributeRoundStats(bPlayers, aPlayers, bStats, aStats); }

    applyEconomy(eco, winnerTid, loserTid, Math.random() > 0.7);
    eco[teamA.tid].timeoutBuff = Math.max(0, eco[teamA.tid].timeoutBuff - 1);
    eco[teamB.tid].timeoutBuff = Math.max(0, eco[teamB.tid].timeoutBuff - 1);

    rounds.push({ round, winnerTid, aScore, bScore, aBuy, bBuy });
    round++;
    if (round > 40 && Math.abs(aScore - bScore) >= 2) break;
  }

  return {
    mapId: map.id,
    mapName: map.name,
    pickedByTid: null,
    startSideByTid: { [sideSelectorTid]: 'ATK' },
    rounds,
    finalScore: { [teamA.tid]: aScore, [teamB.tid]: bScore },
    winnerTid: aScore > bScore ? teamA.tid : teamB.tid,
    playerStats: { [teamA.tid]: Object.values(aStats), [teamB.tid]: Object.values(bStats) },
    ecoSummary: {
      [teamA.tid]: { ...eco[teamA.tid].counts, creditsByRound: eco[teamA.tid].creditsByRound },
      [teamB.tid]: { ...eco[teamB.tid].counts, creditsByRound: eco[teamB.tid].creditsByRound }
    }
  };
}

function topPlayers(seriesMaps) {
  const totals = {};
  for (const m of seriesMaps) {
    for (const list of Object.values(m.playerStats)) {
      for (const p of list) {
        totals[p.pid] = totals[p.pid] || { name: p.name, kills: 0, assists: 0, deaths: 0 };
        totals[p.pid].kills += p.kills;
        totals[p.pid].assists += p.assists;
        totals[p.pid].deaths += p.deaths;
      }
    }
  }
  return Object.values(totals).sort((a, b) => b.kills - a.kills).slice(0, 3);
}

export function simulateBo3Series(state, match) {
  const homeTeam = state.teams.find((t) => t.tid === match.homeTid);
  const awayTeam = state.teams.find((t) => t.tid === match.awayTid);
  const coinTeam = Math.random() > 0.5 ? homeTeam : awayTeam;
  const otherTeam = coinTeam.tid === homeTeam.tid ? awayTeam : homeTeam;
  const veto = runVeto(coinTeam, otherTeam);

  let homeWins = 0;
  let awayWins = 0;
  const maps = [];

  for (let i = 0; i < veto.maps.length && homeWins < 2 && awayWins < 2; i++) {
    const map = veto.maps[i];
    const sideSelector = i === 0 ? otherTeam.tid : i === 1 ? coinTeam.tid : coinTeam.tid;
    const res = simMap(state, map, homeTeam, awayTeam, sideSelector);
    maps.push(res);
    if (res.winnerTid === homeTeam.tid) homeWins++; else awayWins++;
  }

  const winnerTid = homeWins > awayWins ? homeTeam.tid : awayTeam.tid;
  return {
    format: 'BO3',
    winnerTid,
    seriesScore: { [homeTeam.tid]: homeWins, [awayTeam.tid]: awayWins },
    veto,
    maps,
    topPlayers: topPlayers(maps),
    summary: `${homeTeam.abbrev} ${homeWins}-${awayWins} ${awayTeam.abbrev}`
  };
}
