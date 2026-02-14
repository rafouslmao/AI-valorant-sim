import { PRACTICE_FOCUS } from './constants.js';
import { clamp } from './utils.js';
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

function contractCycle(state) {
  if (state.meta.week % 12 !== 0) return;
  for (const p of state.players) {
    if (!p.currentContract || p.tid === null) continue;
    p.currentContract.yearsRemaining -= 1;
    if (p.currentContract.yearsRemaining <= 0) {
      p.tid = null;
      p.history.push('Entered free agency');
      addMessage(state, {
        from: { type: 'system', name: 'League Office' },
        subject: `${p.name} became a free agent`,
        body: `${p.name}'s contract expired and they entered free agency.`,
        category: 'contract',
        related: { playerId: p.pid }
      });
    }
  }
  aiResolveFreeAgency(state);
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

  const userInvolved = match.homeTid === state.userTid || match.awayTid === state.userTid;
  if (userInvolved) {
    const ecoHome = (match.result.maps || []).reduce((acc, m) => ({
      ECO: acc.ECO + (m.ecoSummary?.[match.homeTid]?.ECO || 0),
      FORCE: acc.FORCE + (m.ecoSummary?.[match.homeTid]?.FORCE || 0)
    }), { ECO: 0, FORCE: 0 });
    const ecoAway = (match.result.maps || []).reduce((acc, m) => ({
      ECO: acc.ECO + (m.ecoSummary?.[match.awayTid]?.ECO || 0),
      FORCE: acc.FORCE + (m.ecoSummary?.[match.awayTid]?.FORCE || 0)
    }), { ECO: 0, FORCE: 0 });
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
  const next = state.schedule.find((m) => m.status !== 'final' && (m.homeTid === state.userTid || m.awayTid === state.userTid));
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
  return next;
}

export function simulateWeek(state) {
  const weekMatches = state.schedule.filter((m) => m.week === state.meta.week && m.status !== 'final');
  for (const m of weekMatches) {
    if (!hasFiveStarters(state, m.homeTid) || !hasFiveStarters(state, m.awayTid)) continue;
    playMatchSeries(state, m.mid);
  }
  state.meta.week += 1;
  contractCycle(state);
  maybeGenerateSponsorOffers(state);
  settleSponsorDeadlines(state);
  applyMonthlyExpenses(state);
  return weekMatches.length;
}

export function getFacilityUpgradeCost(team, key) {
  return upgradeCost(team.facilities[key]);
}
