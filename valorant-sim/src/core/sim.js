import { PRACTICE_FOCUS } from './constants.js';
import { clamp } from './utils.js';
import { computePlayerOverall } from './generator.js';

function teamStrength(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  const coach = state.coaches.find((c) => c.tid === tid);
  const roster = state.players.filter((p) => p.tid === tid);
  const starters = roster.slice(0, 5);
  const avg = starters.reduce((sum, p) => sum + computePlayerOverall(p) + (p.roleSkills[p.role] ?? 0) * 0.15, 0) / Math.max(1, starters.length);
  const coachBoost = coach ? (coach.attrs.tactics + coach.attrs.discipline) * 0.08 : 0;
  const facilityBoost = 100 * (team?.facilities.bonus ?? 0);
  return avg + coachBoost + facilityBoost;
}

function calcScore(base, rng) {
  return Math.round(clamp(base / 8 + rng * 10, 5, 18));
}

function applyPracticeAndFacilities(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  if (!team) return;

  const roster = state.players.filter((p) => p.tid === tid);
  const focus = team.practicePlan.focus;
  const intensity = team.practicePlan.intensity;
  const iMult = intensity === 'hard' ? 1.8 : intensity === 'light' ? 0.8 : 1.2;

  for (const player of roster) {
    const facilityBonus = team.facilities.bonus * 100;
    if (PRACTICE_FOCUS.includes(focus)) {
      player.attrs[focus] = clamp(player.attrs[focus] + Math.random() * iMult + facilityBonus * 0.05, 30, 99);
    }
    player.roleSkills[player.role] = clamp(player.roleSkills[player.role] + 0.5 * iMult, 20, 99);
    player.ovr = computePlayerOverall(player);
    player.history.push(`Week ${state.meta.week}: practice ${focus}/${intensity}`);
  }

  const cost = intensity === 'hard' ? 30_000 : intensity === 'light' ? 10_000 : 20_000;
  team.expenses += cost;
  team.cash -= cost;
}

function selectLineupForAI(state, tid) {
  const teamPlayers = state.players.filter((p) => p.tid === tid);
  teamPlayers.sort((a, b) => (b.ovr + (b.roleSkills[b.role] ?? 0) * 0.2) - (a.ovr + (a.roleSkills[a.role] ?? 0) * 0.2));
}

export function simulateMatch(state, match) {
  selectLineupForAI(state, match.homeTid);
  selectLineupForAI(state, match.awayTid);
  const hs = teamStrength(state, match.homeTid);
  const as = teamStrength(state, match.awayTid);
  const delta = hs - as;
  const homeWinChance = 1 / (1 + Math.exp(-delta / 12));

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
  if (homeWins) {
    homeTeam.wins++;
    awayTeam.losses++;
  } else {
    awayTeam.wins++;
    homeTeam.losses++;
  }

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
  return next;
}

export function simulateWeek(state) {
  const week = state.meta.week;
  const weekMatches = state.schedule.filter((m) => m.week === week && !m.played);
  for (const m of weekMatches) {
    simulateMatch(state, m);
  }
  state.meta.week += 1;
  return weekMatches.length;
}
