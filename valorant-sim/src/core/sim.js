import { PRACTICE_FOCUS } from './constants.js';
import { clamp, uid } from './utils.js';
import { computePlayerOverall } from './generator.js';
import { initializeLiveSeries, playLiveRounds, simLiveMap, simLiveSeries, simLiveToHalf, simulateBo3Series } from './matchSimBo3.js';
import { applyWeeklyTraining } from './training.js';
import { aiResolveFreeAgency } from './contracts.js';
import { addMessage } from './messages.js';
import { maybeGenerateSponsorOffers, settleSponsorDeadlines, updateSponsorProgress } from './sponsors.js';

function upgradeCost(facility) {
  return Math.round(facility.baseCost * ((facility.level + 1) ** 1.5));
}

export function computeFacilityEffects(team) {
  const f = team.facilities;
  const officeLevel = f.officeQuality.level;
  const pcLevel = f.pcEquipment.level;
  const analystLevel = f.analystDept.level;
  const psychLevel = f.sportsPsych.level;
  const healthLevel = f.performanceHealth.level;
  const academyLevel = f.academy.level;
  return {
    moraleBonus: [-5, 0, 2, 5, 8, 12][officeLevel] ?? 0,
    chemistryStability: officeLevel * 2,
    burnoutReduction: officeLevel * 0.03,
    practiceMultiplier: 1 + pcLevel * 0.05,
    aimGrowthBonus: pcLevel * 0.03,
    mechanicalVarianceReduction: pcLevel * 0.02,
    vetoBonus: analystLevel * 3,
    antiStratBonus: analystLevel * 0.04,
    midSeriesAdaptBonus: analystLevel * 0.03,
    tiltResistance: psychLevel * 0.04,
    clutchStability: psychLevel * 0.03,
    comebackChance: psychLevel * 0.03,
    fatigueReduction: healthLevel * 0.05,
    seasonBurnoutReduction: healthLevel * 0.03,
    regenPotentialBonus: academyLevel * 5,
    hiddenGemChance: academyLevel * 0.03
  };
}

function totalFacilityMaintenance(team) {
  return Object.values(team.facilities).reduce((sum, item) => sum + item.baseMaintenance * item.level, 0);
}

function computeTeamMeta(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  const coach = state.coaches.find((c) => c.tid === tid && c.staffRole === 'Head Coach');
  const roster = state.players.filter((p) => p.tid === tid).slice(0, 8);
  const avgOvr = roster.reduce((s, p) => s + computePlayerOverall(p), 0) / Math.max(roster.length, 1);
  team.coachQuality = coach ? Math.round((coach.ratings.prep + coach.ratings.leadership + coach.ratings.skillDevelopment) / 3) : 50;
  team.rosterStrength = Math.round(avgOvr);
  team.financialStability = clamp(Math.round((team.cash / Math.max(1, team.wageBudget)) * 40), 5, 95);
  team.facilitiesLevel = Math.round(Object.values(team.facilities).reduce((s, f) => s + f.level, 0) / 30 * 100);
}

function applyPracticeAndFacilities(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  if (!team) return;
  const roster = state.players.filter((p) => p.tid === tid);
  const focus = team.practicePlan.focus;
  const intensity = team.practicePlan.intensity;
  const fx = computeFacilityEffects(team);
  const iMult = intensity === 'hard' ? 1.8 : intensity === 'light' ? 0.8 : 1.2;

  for (const player of roster) {
    if (PRACTICE_FOCUS.includes(focus)) {
      player.attrs[focus] = clamp(player.attrs[focus] + (Math.random() * iMult + fx.aimGrowthBonus) * fx.practiceMultiplier, 30, 99);
    }
    player.roleSkills[player.currentRole] = clamp((player.roleSkills[player.currentRole] ?? 35) + 0.35 * iMult, 20, 99);
    player.ovr = computePlayerOverall(player);
  }

  const cost = intensity === 'hard' ? 30_000 : intensity === 'light' ? 10_000 : 20_000;
  team.expenses += cost;
  team.cash -= cost;

  applyWeeklyTraining(state, tid, fx.practiceMultiplier, 1 + fx.chemistryStability / 100);
  computeTeamMeta(state, tid);
}

function teamRosterSize(state, tid) {
  return state.players.filter((p) => p.tid === tid).length;
}

function ensureTeamStarters(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  const roster = state.players.filter((p) => p.tid === tid);
  if (!team || !roster.length) return;
  const validStarters = (team.starters || []).filter((pid) => roster.some((p) => p.pid === pid));
  const needed = 5 - validStarters.length;
  if (needed > 0) {
    const candidates = roster.filter((p) => !validStarters.includes(p.pid)).sort((a, b) => b.ovr - a.ovr);
    validStarters.push(...candidates.slice(0, needed).map((p) => p.pid));
  }
  team.starters = validStarters.slice(0, Math.min(5, roster.length));
}

function roleNeedBonus(teamPlayers, candidate) {
  const roleCounts = {};
  for (const p of teamPlayers) roleCounts[p.currentRole] = (roleCounts[p.currentRole] || 0) + 1;
  const need = Math.max(0, 2 - (roleCounts[candidate.currentRole] || 0));
  return need * 6;
}

function signFreeAgentToTeam(state, player, team) {
  player.tid = team.tid;
  player.currentContract = {
    salaryPerYear: Math.max(25_000, Math.round((player.salary || 35_000) * (0.9 + Math.random() * 0.3))),
    yearsRemaining: 1 + Math.floor(Math.random() * 3),
    signedWithTid: team.tid,
    buyoutClause: Math.round((player.salary || 35_000) * 3),
    rolePromise: 'starter',
    signingBonus: Math.round((player.salary || 35_000) * 0.15)
  };
  player.history.push(`Signed by ${team.name}`);
  state.transactions = state.transactions || [];
  state.transactions.push({ id: uid('txn'), ts: Date.now(), type: 'aiSign', tid: team.tid, pid: player.pid, note: `${team.name} signed ${player.name}` });
}

function ensureAiRosterMinimum(state) {
  const freeAgents = () => state.players.filter((p) => p.tid === null);
  for (const team of state.teams) {
    if (team.tid === state.userTid) continue;
    let missingCount = Math.max(0, 5 - teamRosterSize(state, team.tid));
    while (missingCount > 0) {
      const roster = state.players.filter((p) => p.tid === team.tid);
      const candidates = freeAgents()
        .map((p) => {
          const affordabilityBonus = (team.cash >= (p.salary || 35_000)) ? 8 : -30;
          const repBonus = Math.round((p.reputation || 50) * 0.12);
          const fitScore = p.ovr + roleNeedBonus(roster, p) + affordabilityBonus + repBonus;
          return { p, fitScore };
        })
        .sort((a, b) => b.fitScore - a.fitScore);
      const pick = candidates.find((c) => team.cash >= ((c.p.salary || 35_000) * 0.6));
      if (!pick) break;
      signFreeAgentToTeam(state, pick.p, team);
      missingCount -= 1;
    }
    ensureTeamStarters(state, team.tid);
  }
}

function archiveSeason(state, seasonYear) {
  if (!state.history) state.history = { seasons: {}, matches: {} };
  if (!state.history.seasons) state.history.seasons = {};
  if (!state.history.matches) state.history.matches = {};
  if (state.history.seasons[seasonYear]) return;

  const seasonSchedule = state.schedule.filter((m) => m.season === seasonYear).map((m) => {
    const copy = JSON.parse(JSON.stringify(m));
    state.history.matches[copy.mid] = copy;
    return {
      matchId: copy.mid,
      week: copy.week,
      homeTid: copy.homeTid,
      awayTid: copy.awayTid,
      status: copy.status,
      result: copy.result,
      seriesScore: copy.result?.seriesScore || null,
      maps: copy.result?.maps || []
    };
  });

  const standings = state.teams.map((t) => ({ tid: t.tid, wins: t.wins || 0, losses: t.losses || 0 })).sort((a, b) => b.wins - a.wins);
  state.history.seasons[seasonYear] = { schedule: seasonSchedule, standings };
}

function buildSeasonSchedule(teams, season) {
  const matches = [];
  let week = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({ mid: uid('m'), week, season, homeTid: teams[i].tid, awayTid: teams[j].tid, status: 'scheduled', played: false, result: null, live: null });
      week = week >= 16 ? 1 : week + 1;
    }
  }
  return matches.sort((a, b) => a.week - b.week);
}

function maybeRolloverSeason(state) {
  const currentSeason = state.meta.year;
  const currentSeasonMatches = state.schedule.filter((m) => m.season === currentSeason);
  const seasonDone = currentSeasonMatches.length > 0 && currentSeasonMatches.every((m) => m.status === 'final');
  if (!seasonDone) return;

  archiveSeason(state, currentSeason);
  state.meta.year += 1;
  state.meta.week = 1;
  for (const t of state.teams) {
    t.wins = 0;
    t.losses = 0;
  }
  const newSeasonMatches = buildSeasonSchedule(state.teams, state.meta.year);
  state.schedule.push(...newSeasonMatches);
}

function contractCycle(state) {
  if (state.meta.week % 12 !== 0) return;
  for (const p of state.players) {
    if (!p.currentContract || p.tid === null) continue;
    p.currentContract.yearsRemaining -= 1;
    if (p.currentContract.yearsRemaining <= 0) {
      p.tid = null;
      p.history.push('Entered free agency');
    }
  }
  aiResolveFreeAgency(state);
  ensureAiRosterMinimum(state);
}

function applyMonthlyExpenses(state) {
  if (state.meta.week % 4 !== 0) return;
  for (const team of state.teams) {
    const playerSalaries = state.players.filter((p) => p.tid === team.tid).reduce((sum, p) => sum + (p.currentContract?.salaryPerYear ?? p.salary), 0);
    const staffSalaries = state.coaches.filter((c) => c.tid === team.tid).reduce((sum, c) => sum + c.salary, 0);
    const facilityMaintenance = totalFacilityMaintenance(team);
    const total = playerSalaries + staffSalaries + facilityMaintenance;
    team.cash -= total;
    team.expenses += total;
    team.monthlyLedger.push({ week: state.meta.week, playerSalaries, staffSalaries, facilityMaintenance, total });
    computeTeamMeta(state, team.tid);
  }
}

function updatePlayerSeasonStats(state, match) {
  const season = String(match.season || state.meta.year);
  for (const map of match.result?.maps || []) {
    for (const teamStats of Object.values(map.playerStats || {})) {
      for (const row of teamStats) {
        const p = state.players.find((x) => x.pid === row.pid);
        if (!p) continue;
        if (!p.seasonStats) p.seasonStats = {};
        if (!p.seasonStats[season]) p.seasonStats[season] = { kills: 0, deaths: 0, assists: 0, mapsPlayed: 0, mostKillsInMap: 0 };
        const ss = p.seasonStats[season];
        ss.kills += row.kills || 0;
        ss.deaths += row.deaths || 0;
        ss.assists += row.assists || 0;
        ss.mapsPlayed += 1;
        ss.mostKillsInMap = Math.max(ss.mostKillsInMap, row.kills || 0);
      }
    }
  }
}

function finalizeResultEffects(state, match) {
  const homeTeam = state.teams.find((t) => t.tid === match.homeTid);
  const awayTeam = state.teams.find((t) => t.tid === match.awayTid);
  if (match.result.winnerTid === match.homeTid) { homeTeam.wins++; awayTeam.losses++; } else { awayTeam.wins++; homeTeam.losses++; }
  homeTeam.revenue += 45_000;
  awayTeam.revenue += 35_000;
  homeTeam.cash += 45_000;
  awayTeam.cash += 35_000;
  applyPracticeAndFacilities(state, match.homeTid);
  applyPracticeAndFacilities(state, match.awayTid);

  updateSponsorProgress(state);
  updatePlayerSeasonStats(state, match);

  const userInvolved = match.homeTid === state.userTid || match.awayTid === state.userTid;
  if (userInvolved) {
    const ecoHome = (match.result.maps || []).reduce((acc, m) => ({ ECO: acc.ECO + (m.ecoSummary?.[match.homeTid]?.ECO || 0), FORCE: acc.FORCE + (m.ecoSummary?.[match.homeTid]?.FORCE || 0) }), { ECO: 0, FORCE: 0 });
    const ecoAway = (match.result.maps || []).reduce((acc, m) => ({ ECO: acc.ECO + (m.ecoSummary?.[match.awayTid]?.ECO || 0), FORCE: acc.FORCE + (m.ecoSummary?.[match.awayTid]?.FORCE || 0) }), { ECO: 0, FORCE: 0 });
    const clutchRounds = (match.result.maps || []).reduce((sum, m) => sum + (m.rounds || []).reduce((s, r) => s + ((r.clutches || []).length), 0), 0);
    const mapScores = (match.result.maps || []).map((m) => `${m.mapName} ${m.finalScore[match.homeTid]}-${m.finalScore[match.awayTid]}`).join(' | ');
    addMessage(state, {
      from: { type: 'system', name: 'Match Center' },
      subject: `Match Report: ${mapScores || match.result.summary}`,
      body: 'Series complete. Detailed map scores, economy profile, and clutch moments are now available.',
      category: 'matches',
      related: { matchId: match.mid },
      details: {
        bullets: [`Top performers: ${(match.result.topPlayers || []).map((p) => `${p.name} (${p.kills}/${p.deaths}/${p.assists})`).join(', ') || 'N/A'}`, `Key rounds with clutches: ${clutchRounds}`],
        stats: [
          { label: 'Series Score', value: match.result.summary },
          { label: 'Home ECO/FORCE', value: `${ecoHome.ECO}/${ecoHome.FORCE}` },
          { label: 'Away ECO/FORCE', value: `${ecoAway.ECO}/${ecoAway.FORCE}` }
        ],
        links: [{ label: 'Open Match View', route: `#/match?id=${match.mid}` }],
        tags: ['matches']
      }
    });
  }
}

function hasFiveStarters(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  const starters = team?.starters || [];
  return starters.filter((pid) => state.players.some((p) => p.pid === pid && p.tid === tid)).length >= 5;
}

export function simulateMatch(state, match) {
  const series = simulateBo3Series(state, match);
  match.status = 'final';
  match.played = true;
  match.result = series;
  finalizeResultEffects(state, match);
}

export function openMatch(state, matchId) {
  ensureAiRosterMinimum(state);
  const match = state.schedule.find((m) => m.mid === matchId);
  if (!match || match.status === 'final') return match;
  if (!hasFiveStarters(state, match.homeTid) || !hasFiveStarters(state, match.awayTid)) return match;
  if (!match.live) initializeLiveSeries(state, match);
  match.status = 'inProgress';
  return match;
}

export function playMatchRounds(state, matchId, n = 1) {
  const match = openMatch(state, matchId);
  if (!match || match.status !== 'inProgress') return null;
  playLiveRounds(state, match, n);
  if (match.status === 'final') finalizeResultEffects(state, match);
  return match;
}

export function playMatchToHalf(state, matchId) {
  const match = openMatch(state, matchId);
  if (!match || match.status !== 'inProgress') return null;
  simLiveToHalf(state, match);
  if (match.status === 'final') finalizeResultEffects(state, match);
  return match;
}

export function playMatchMap(state, matchId) {
  const match = openMatch(state, matchId);
  if (!match || match.status !== 'inProgress') return null;
  simLiveMap(state, match);
  if (match.status === 'final') finalizeResultEffects(state, match);
  return match;
}

export function playMatchSeries(state, matchId) {
  const match = openMatch(state, matchId);
  if (!match || (match.status !== 'inProgress' && match.status !== 'final')) return null;
  simLiveSeries(state, match);
  if (match.status === 'final') finalizeResultEffects(state, match);
  return match;
}

export function simulateNextMatchForUserTeam(state) {
  ensureAiRosterMinimum(state);
  const next = state.schedule.find((m) => m.season === state.meta.year && m.status !== 'final' && (m.homeTid === state.userTid || m.awayTid === state.userTid));
  if (!next) return null;
  if (!hasFiveStarters(state, state.userTid)) {
    addMessage(state, {
      from: { type: 'system', name: 'Match Center' },
      subject: 'Cannot start match: set 5 starters',
      body: 'Your starting lineup must have 5 players before playing matches.',
      category: 'team',
      related: { matchId: next.mid },
      actions: [{ label: 'Open Roster', route: '#/roster' }]
    });
    return null;
  }
  playMatchSeries(state, next.mid);
  state.meta.week = Math.max(state.meta.week, next.week);
  contractCycle(state);
  maybeGenerateSponsorOffers(state);
  settleSponsorDeadlines(state);
  applyMonthlyExpenses(state);
  maybeRolloverSeason(state);
  return next;
}

export function simulateWeek(state) {
  ensureAiRosterMinimum(state);
  const weekMatches = state.schedule.filter((m) => m.season === state.meta.year && m.week === state.meta.week && m.status !== 'final');
  for (const m of weekMatches) {
    ensureAiRosterMinimum(state);
    if (!hasFiveStarters(state, m.homeTid) || !hasFiveStarters(state, m.awayTid)) continue;
    playMatchSeries(state, m.mid);
  }
  state.meta.week += 1;
  contractCycle(state);
  maybeGenerateSponsorOffers(state);
  settleSponsorDeadlines(state);
  applyMonthlyExpenses(state);
  maybeRolloverSeason(state);
  return weekMatches.length;
}

export function getFacilityUpgradeCost(team, key) {
  return upgradeCost(team.facilities[key]);
}
