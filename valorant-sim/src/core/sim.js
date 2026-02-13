import { PRACTICE_FOCUS } from './constants.js';
import { clamp } from './utils.js';
import { computePlayerOverall } from './generator.js';

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

function teamStrength(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  const coach = state.coaches.find((c) => c.tid === tid && c.staffRole === 'Head Coach');
  const roster = state.players.filter((p) => p.tid === tid);
  const starters = roster.slice(0, 5);
  const fx = computeFacilityEffects(team);
  const avg = starters.reduce((sum, p) => sum + computePlayerOverall(p) + (p.roleSkills[p.currentRole] ?? 0) * 0.15, 0) / Math.max(1, starters.length);
  const coachBoost = coach ? (coach.ratings.prep + coach.ratings.vetoSkill + coach.ratings.midSeriesAdapt) * 0.05 : 0;
  const consistency = 1 - fx.mechanicalVarianceReduction * Math.random();
  return (avg + coachBoost + fx.vetoBonus * 0.5) * consistency;
}

function calcScore(base, rng) {
  return Math.round(clamp(base / 8 + rng * 10, 5, 18));
}

function applyPracticeAndFacilities(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  const coach = state.coaches.find((c) => c.tid === tid && c.staffRole === 'Head Coach');
  if (!team) return;

  const roster = state.players.filter((p) => p.tid === tid);
  const focus = team.practicePlan.focus;
  const intensity = team.practicePlan.intensity;
  const fx = computeFacilityEffects(team);
  const coachDev = coach ? (coach.ratings.skillDevelopment + coach.ratings.roleDevelopment + coach.ratings.practiceDesign) / 300 : 0.45;
  const iMult = intensity === 'hard' ? 1.8 : intensity === 'light' ? 0.8 : 1.2;

  for (const player of roster) {
    if (PRACTICE_FOCUS.includes(focus)) {
      const bump = (Math.random() * iMult + fx.aimGrowthBonus + coachDev) * fx.practiceMultiplier;
      player.attrs[focus] = clamp(player.attrs[focus] + bump, 30, 99);
    }
    player.roles.forEach((role) => {
      const roleDelta = role === player.currentRole ? 0.55 : 0.2;
      player.roleSkills[role] = clamp((player.roleSkills[role] ?? 30) + roleDelta * iMult + coachDev * 0.35, 20, 99);
    });
    player.ovr = computePlayerOverall(player);
    player.history.push(`Week ${state.meta.week}: practice ${focus}/${intensity}`);
  }

  const cost = intensity === 'hard' ? 30_000 : intensity === 'light' ? 10_000 : 20_000;
  team.expenses += cost;
  team.cash -= cost;
}

function applyMonthlyExpenses(state) {
  if (state.meta.week % 4 !== 0) return;
  for (const team of state.teams) {
    const playerSalaries = state.players.filter((p) => p.tid === team.tid).reduce((sum, p) => sum + p.salary, 0);
    const staffSalaries = state.coaches.filter((c) => c.tid === team.tid).reduce((sum, c) => sum + c.salary, 0);
    const facilityMaintenance = totalFacilityMaintenance(team);
    const total = playerSalaries + staffSalaries + facilityMaintenance;
    team.cash -= total;
    team.expenses += total;
    team.monthlyLedger.push({ week: state.meta.week, playerSalaries, staffSalaries, facilityMaintenance, total });
  }
}

function selectLineupForAI(state, tid) {
  const teamPlayers = state.players.filter((p) => p.tid === tid);
  teamPlayers.sort((a, b) => (b.ovr + (b.roleSkills[b.currentRole] ?? 0) * 0.2) - (a.ovr + (a.roleSkills[a.currentRole] ?? 0) * 0.2));
}

export function simulateMatch(state, match) {
  selectLineupForAI(state, match.homeTid);
  selectLineupForAI(state, match.awayTid);
  const hs = teamStrength(state, match.homeTid);
  const as = teamStrength(state, match.awayTid);
  const homeWinChance = 1 / (1 + Math.exp(-(hs - as) / 12));

  const homeWins = Math.random() < homeWinChance;
  const homeScore = calcScore(hs, Math.random());
  const awayScore = calcScore(as, Math.random());

  match.played = true;
  match.result = {
    homeScore: homeWins ? Math.max(homeScore, awayScore + 2) : Math.min(homeScore, awayScore - 1),
    awayScore: homeWins ? Math.min(awayScore, homeScore - 1) : Math.max(awayScore, homeScore + 2),
    winnerTid: homeWins ? match.homeTid : match.awayTid
  };

  const homeTeam = state.teams.find((t) => t.tid === match.homeTid);
  const awayTeam = state.teams.find((t) => t.tid === match.awayTid);
  if (homeWins) { homeTeam.wins++; awayTeam.losses++; } else { awayTeam.wins++; homeTeam.losses++; }

  homeTeam.revenue += 45_000;
  awayTeam.revenue += 35_000;
  homeTeam.cash += 45_000;
  awayTeam.cash += 35_000;

  applyPracticeAndFacilities(state, match.homeTid);
  applyPracticeAndFacilities(state, match.awayTid);
}

export function simulateNextMatchForUserTeam(state) {
  const next = state.schedule.find((m) => !m.played && (m.homeTid === state.userTid || m.awayTid === state.userTid));
  if (!next) return null;
  simulateMatch(state, next);
  state.meta.week = Math.max(state.meta.week, next.week);
  applyMonthlyExpenses(state);
  return next;
}

export function simulateWeek(state) {
  const weekMatches = state.schedule.filter((m) => m.week === state.meta.week && !m.played);
  for (const m of weekMatches) simulateMatch(state, m);
  state.meta.week += 1;
  applyMonthlyExpenses(state);
  return weekMatches.length;
}

export function getFacilityUpgradeCost(team, key) {
  return upgradeCost(team.facilities[key]);
}
