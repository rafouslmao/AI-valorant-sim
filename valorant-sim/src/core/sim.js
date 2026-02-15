import { AGENT_ROLES, PRACTICE_FOCUS } from './constants.js';
import { clamp, uid } from './utils.js';
import { computePlayerOverall, createCoach } from './generator.js';
import { applyWeeklyTraining } from './training.js';
import { aiResolveFreeAgency } from './contracts.js';
import { initializeLiveSeries, playLiveRound, playLiveRounds, simLiveMap, simLiveSeries, simLiveToHalf } from './matchSimBo3.js';
import { addMessage } from './messages.js';

const REGION_MAP = ['Americas', 'EMEA', 'Pacific', 'China'];

function upgradeCost(facility) {
  return Math.round(facility.baseCost * ((facility.level + 1) ** 1.5));
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

function regionForNationality(teamRegion) {
  const pools = {
    Americas: ['United_States', 'Canada', 'Brazil', 'Argentina', 'Mexico', 'Chile'],
    EMEA: ['Turkey', 'France', 'Germany', 'Poland', 'Spain', 'United_Kingdom'],
    Pacific: ['South_Korea', 'Japan', 'Thailand', 'Indonesia', 'Philippines', 'Singapore'],
    China: ['China', 'Taiwan', 'Hong_Kong']
  };
  return pick(pools[teamRegion] || pools.Americas);
}

function buildRoleSkills(primaryRole) {
  return { Duelist: rand(35, 65), Initiator: rand(35, 65), Controller: rand(35, 65), Sentinel: rand(35, 65), Flex: rand(35, 65), [primaryRole]: rand(65, 90) };
}

function buildAgentPool(role) {
  const affinities = {};
  const slots = role === 'Flex' ? ['Duelist', 'Initiator', 'Controller', 'Sentinel'] : [role];
  for (const r of slots) {
    const agents = AGENT_ROLES[r] || AGENT_ROLES.Initiator;
    affinities[pick(agents)] = rand(62, 93);
    affinities[pick(agents)] = rand(55, 88);
  }
  return { primaryRole: role.toLowerCase(), affinities };
}

function createTier2Player(team, role = 'Flex') {
  const seed = uid('t2p');
  const p = {
    pid: uid('p'),
    tid: team.tid,
    name: `IGN_${seed.slice(-6)}`,
    age: rand(17, 24),
    nationality: regionForNationality(team.region),
    imageURL: '',
    salary: rand(18000, 52000),
    reputation: rand(25, 58),
    ambition: rand(25, 90), loyalty: rand(25, 90), greed: rand(20, 95), playtimeDesire: rand(30, 95),
    preferredRole: role,
    roles: role === 'Flex' ? ['Flex', 'Initiator'] : [role, 'Flex'],
    currentRole: role,
    secondaryRoleTag: 'None',
    attrs: {
      aim: rand(45, 78), utility: rand(45, 78), clutch: rand(40, 74), mental: rand(45, 76), teamwork: rand(48, 78), decisionMaking: rand(42, 75)
    },
    roleSkills: buildRoleSkills(role),
    agentPool: buildAgentPool(role),
    trainingPlan: { primaryFocus: role, secondaryFocus: 'None', intensity: 'normal' },
    currentContract: { salaryPerYear: rand(18000, 52000), yearsRemaining: rand(1, 2), signedWithTid: team.tid, buyoutClause: rand(45000, 110000), rolePromise: 'starter', signingBonus: rand(2000, 10000) },
    isStarter: true,
    history: [],
    seasonStats: {}
  };
  p.ovr = computePlayerOverall(p);
  return p;
}

function ensureCoachCoverage(state) {
  const freeCoaches = state.coaches.filter((c) => c.tid == null);
  if (freeCoaches.length < 24) {
    for (let i = 0; i < 40; i++) state.coaches.push(createCoach(null, 'Head Coach'));
  }
}

function assignCoachIfMissing(state, team) {
  if (team.headCoachId) return;
  ensureCoachCoverage(state);
  const coach = state.coaches.find((c) => c.tid == null);
  if (!coach) return;
  coach.tid = team.tid;
  team.headCoachId = coach.cid;
}

function fillTier2Rosters(state) {
  const signLog = [];
  for (const team of state.teams.filter((t) => t.tier === 'Tier 2')) {
    assignCoachIfMissing(state, team);
    const roster = state.players.filter((p) => p.tid === team.tid);
    const needs = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex', 'Flex'];
    for (const role of needs.slice(roster.length)) {
      const freeByRole = state.players.find((p) => p.tid == null && (p.currentRole === role || p.roles?.includes(role) || role === 'Flex'));
      const player = freeByRole || createTier2Player(team, role);
      if (!freeByRole) state.players.push(player);
      player.tid = team.tid;
      player.currentRole = role;
      player.isStarter = true;
      player.currentContract = { ...(player.currentContract || {}), signedWithTid: team.tid, yearsRemaining: rand(1, 2), salaryPerYear: player.salary || rand(18000, 52000) };
      player.history = player.history || [];
      player.history.push(`Signed by ${team.name} (Tier 2 autofill)`);
      signLog.push({ team: team.name, player: player.name, role });
    }
    const teamPlayers = state.players.filter((p) => p.tid === team.tid).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    team.starters = teamPlayers.slice(0, 5).map((p) => p.pid);
  }
  if (signLog.length) {
    state.eventLog = state.eventLog || [];
    state.eventLog.push({ id: uid('elog'), type: 'tier2_roster_fill', year: state.meta.year, day: state.meta.day || 1, details: signLog });
  }
}

function rankingScore(team) {
  return (team.elo || 1200) * 0.6 + (team.circuitPoints || 0) * 4 + (team.teamReputation || 40) * 2;
}

function makePoints(mult = 1) {
  return [100, 70, 50, 35, 24, 16, 10, 6].map((v) => Math.round(v * mult));
}

function generateYearCalendar(state, year) {
  const events = [];
  const pushEvent = (ev) => events.push({
    id: uid('ev'),
    year,
    status: 'Upcoming',
    phase: 'pending',
    qualifierParticipants: [],
    qualifiersBracket: [],
    invitedAccepted: [],
    invitedDeclined: [],
    qualifiedTeams: [],
    mainTeams: [],
    matches: [],
    placements: [],
    payouts: [],
    pointsAwarded: [],
    ...ev
  });

  pushEvent({ name: 'VALORANT Masters 1', organizer: 'Riot', tier: 'S', regionScope: 'INTERNATIONAL', region: 'All', startDay: 70, endDay: 85, prizePool: 1200000, pointsMultiplier: 2.2, travelCostFactor: 1.6, inviteSlots: 12, qualSlots: 4, mainSlots: 16, prestige: 97 });
  pushEvent({ name: 'BLAST Open', organizer: 'BLAST', tier: 'S', regionScope: 'INTERNATIONAL', region: 'All', startDay: 108, endDay: 120, prizePool: 1150000, pointsMultiplier: 1.8, travelCostFactor: 1.4, inviteSlots: 10, qualSlots: 6, mainSlots: 16, prestige: 88 });
  pushEvent({ name: 'IEM Global', organizer: 'IEM', tier: 'S', regionScope: 'INTERNATIONAL', region: 'All', startDay: 145, endDay: 160, prizePool: 1050000, pointsMultiplier: 1.8, travelCostFactor: 1.5, inviteSlots: 11, qualSlots: 5, mainSlots: 16, prestige: 86 });
  pushEvent({ name: 'EWC', organizer: 'EWC', tier: 'S', regionScope: 'INTERNATIONAL', region: 'All', startDay: 188, endDay: 203, prizePool: 1800000, pointsMultiplier: 2.4, travelCostFactor: 1.7, inviteSlots: 12, qualSlots: 4, mainSlots: 16, prestige: 99 });
  pushEvent({ name: 'VALORANT Masters 2', organizer: 'Riot', tier: 'S', regionScope: 'INTERNATIONAL', region: 'All', startDay: 230, endDay: 245, prizePool: 1300000, pointsMultiplier: 2.4, travelCostFactor: 1.6, inviteSlots: 12, qualSlots: 4, mainSlots: 16, prestige: 99 });
  pushEvent({ name: 'PGL Finals', organizer: 'PGL', tier: 'S', regionScope: 'INTERNATIONAL', region: 'All', startDay: 266, endDay: 279, prizePool: 1100000, pointsMultiplier: 1.9, travelCostFactor: 1.5, inviteSlots: 10, qualSlots: 6, mainSlots: 16, prestige: 87 });
  pushEvent({ name: 'VALORANT Champions', organizer: 'Riot', tier: 'S', regionScope: 'INTERNATIONAL', region: 'All', startDay: 320, endDay: 343, prizePool: 2400000, pointsMultiplier: 3.2, travelCostFactor: 1.9, inviteSlots: 12, qualSlots: 4, mainSlots: 16, prestige: 100 });

  const orgs = ['FISSURE', 'PGL Challengers', 'BLAST Rising', 'Open Circuit'];
  let d = 20;
  for (const r of REGION_MAP) {
    for (let i = 0; i < 4; i++) {
      pushEvent({
        name: `${r} ${orgs[(i + r.length) % orgs.length]} ${i + 1}`,
        organizer: orgs[(i + r.length) % orgs.length],
        tier: 'A',
        regionScope: 'REGIONAL',
        region: r,
        startDay: d,
        endDay: d + 8,
        prizePool: rand(90000, 420000),
        pointsMultiplier: 1,
        travelCostFactor: 0.9,
        inviteSlots: rand(3, 8),
        qualSlots: rand(5, 10),
        mainSlots: 8,
        prestige: rand(45, 72)
      });
      d += rand(16, 30);
    }
  }

  return events.sort((a, b) => a.startDay - b.startDay);
}

function attendanceScore(team, event, state) {
  const prestige = event.prestige;
  const prize = Math.log10(event.prizePool) * 12;
  const qualValue = event.tier === 'S' ? 20 : 6;
  const needPoints = Math.max(0, 140 - (team.circuitPoints || 0)) / 4;
  const orgRep = team.teamReputation || 50;
  const travel = event.regionScope === 'INTERNATIONAL' && team.region !== event.region ? 16 * event.travelCostFactor : 4 * event.travelCostFactor;
  const fatigue = team.fatigue || 0;
  const conflict = state.eventsByYear[state.meta.year].some((e) => e.id !== event.id && (e.status === 'Qualifiers' || e.status === 'Main Event') && e.mainTeams.includes(team.tid)) ? 45 : 0;
  return prestige * 0.55 + prize + qualValue + needPoints + orgRep * 0.22 - travel - fatigue * 0.25 - conflict;
}

function setupEventParticipation(state, event) {
  const eligible = state.teams.filter((t) => event.regionScope === 'INTERNATIONAL' || t.region === event.region);
  const ranked = [...eligible].sort((a, b) => rankingScore(b) - rankingScore(a));
  const invited = ranked.slice(0, event.inviteSlots);

  for (const team of invited) {
    const score = attendanceScore(team, event, state);
    const threshold = event.tier === 'S' ? 35 : 55;
    if (score > threshold) event.invitedAccepted.push(team.tid); else event.invitedDeclined.push(team.tid);
  }

  let inviteCursor = event.inviteSlots;
  while (event.invitedAccepted.length < event.inviteSlots && inviteCursor < ranked.length) {
    const replacement = ranked[inviteCursor++];
    event.invitedAccepted.push(replacement.tid);
  }

  const optInPool = ranked.filter((t) => !event.invitedAccepted.includes(t.tid));
  for (const team of optInPool) {
    if (attendanceScore(team, event, state) > (event.tier === 'S' ? 25 : 45)) event.qualifierParticipants.push(team.tid);
  }

  const maxQual = Math.max(event.qualSlots * 3, event.qualSlots + 2);
  event.qualifierParticipants = event.qualifierParticipants.slice(0, maxQual);
  event.status = 'Upcoming';
}

function runQualifier(event, state) {
  const entrants = [...event.qualifierParticipants];
  const scored = entrants.map((tid) => {
    const t = state.teams.find((x) => x.tid === tid);
    return { tid, score: rankingScore(t) + rand(-80, 80) };
  }).sort((a, b) => b.score - a.score);
  event.qualifiedTeams = scored.slice(0, event.qualSlots).map((x) => x.tid);
  event.qualifiersBracket = scored.map((x, idx) => ({ seed: idx + 1, tid: x.tid, status: idx < event.qualSlots ? 'Qualified' : 'Eliminated' }));
  event.status = 'Qualifiers';
  event.phase = 'qualifiers_done';
}

function runMainEvent(event, state) {
  const teams = [...event.invitedAccepted, ...event.qualifiedTeams].slice(0, event.mainSlots);
  event.mainTeams = teams;
  const ranked = teams.map((tid) => {
    const t = state.teams.find((x) => x.tid === tid);
    return { tid, score: rankingScore(t) + rand(-110, 110) };
  }).sort((a, b) => b.score - a.score);

  const points = makePoints(event.pointsMultiplier);
  let remainingPrize = event.prizePool;
  const payoutCurve = [0.34, 0.2, 0.12, 0.08, 0.06, 0.05, 0.04, 0.03];
  event.placements = [];
  event.payouts = [];
  event.pointsAwarded = [];

  ranked.forEach((r, i) => {
    const team = state.teams.find((t) => t.tid === r.tid);
    const place = i + 1;
    const payout = i < payoutCurve.length ? Math.round(event.prizePool * payoutCurve[i]) : 0;
    remainingPrize -= payout;
    const pts = points[i] || 2;
    team.circuitPoints = (team.circuitPoints || 0) + pts;
    team.cash += payout;
    team.winnings = (team.winnings || 0) + payout;
    team.eventsPlayedThisYear = (team.eventsPlayedThisYear || 0) + 1;
    team.lastEventPlayed = event.name;
    team.elo = clamp(Math.round((team.elo || 1200) + (i < 4 ? 20 : -8) + rand(-6, 8)), 900, 2400);
    event.placements.push({ place, tid: r.tid });
    event.payouts.push({ tid: r.tid, amount: payout });
    event.pointsAwarded.push({ tid: r.tid, points: pts });
  });

  if (remainingPrize > 0 && ranked[0]) {
    const winner = state.teams.find((t) => t.tid === ranked[0].tid);
    winner.cash += remainingPrize;
    winner.winnings += remainingPrize;
    const p = event.payouts.find((x) => x.tid === winner.tid);
    p.amount += remainingPrize;
  }

  event.status = 'Finished';
  event.phase = 'finished';
  event.endDay = Math.max(event.endDay, state.meta.day);
  state.eventLog.push({ id: uid('elog'), year: state.meta.year, day: state.meta.day, type: 'event_finished', eventId: event.id, name: event.name });
}

function chargeTravel(state, event) {
  const tids = [...new Set([...event.invitedAccepted, ...event.qualifierParticipants])];
  for (const tid of tids) {
    const team = state.teams.find((t) => t.tid === tid);
    if (!team) continue;
    const travel = Math.round((event.regionScope === 'INTERNATIONAL' ? 18000 : 7000) * event.travelCostFactor * (team.tier === 'Tier 2' ? 0.7 : 1));
    team.cash -= travel;
    team.expensesTravel = (team.expensesTravel || 0) + travel;
  }
}

function ensureYearSetup(state) {
  const year = state.meta.year;
  if (state.meta.initializedYear === year && state.eventsByYear?.[year]?.length) return;
  fillTier2Rosters(state);
  aiResolveFreeAgency(state);
  state.eventsByYear = state.eventsByYear || {};
  state.eventsByYear[year] = generateYearCalendar(state, year);
  for (const e of state.eventsByYear[year]) setupEventParticipation(state, e);
  state.meta.initializedYear = year;
  state.meta.day = 1;
  state.currentEventId = null;
}

function getYearEvents(state) {
  ensureYearSetup(state);
  return state.eventsByYear[state.meta.year] || [];
}

function activeEvent(state) {
  const events = getYearEvents(state);
  return events.find((e) => e.id === state.currentEventId) || events.find((e) => e.status === 'Qualifiers' || e.status === 'Main Event');
}

function advanceYearIfDone(state) {
  const events = getYearEvents(state);
  if (events.some((e) => e.status !== 'Finished')) return false;
  state.meta.year += 1;
  state.meta.week = 1;
  state.meta.day = 1;
  state.meta.initializedYear = null;
  state.currentEventId = null;
  for (const t of state.teams) {
    t.eventsPlayedThisYear = 0;
    t.winnings = 0;
    t.expensesTravel = 0;
    t.expensesSalaries = 0;
    t.yearlyBudget = Math.round(t.yearlyBudget * (0.95 + Math.random() * 0.2));
  }
  ensureYearSetup(state);
  return true;
}

export function advanceTimeToNextPhase(state) {
  ensureYearSetup(state);
  const current = activeEvent(state);
  if (current) {
    if (current.phase === 'pending') {
      state.meta.day = Math.max(state.meta.day, current.startDay);
      chargeTravel(state, current);
      runQualifier(current, state);
      current.status = 'Qualifiers';
      return current;
    }
    if (current.phase === 'qualifiers_done') {
      current.phase = 'main_running';
      current.status = 'Main Event';
      state.meta.day = Math.max(state.meta.day, current.startDay + 3);
      runMainEvent(current, state);
      state.currentEventId = null;
      advanceYearIfDone(state);
      return current;
    }
  }

  const events = getYearEvents(state);
  const next = events.find((e) => e.status === 'Upcoming' && e.startDay >= state.meta.day) || events.find((e) => e.status === 'Upcoming');
  if (!next) {
    advanceYearIfDone(state);
    return null;
  }
  state.meta.day = next.startDay;
  state.currentEventId = next.id;
  next.phase = 'pending';
  next.status = 'Upcoming';
  return next;
}

export function simulateToNextTournament(state) {
  ensureYearSetup(state);
  const active = activeEvent(state);
  if (active) return active;
  const events = getYearEvents(state);
  const next = events.find((e) => e.status === 'Upcoming');
  if (!next) {
    advanceYearIfDone(state);
    return null;
  }
  state.meta.day = next.startDay;
  state.currentEventId = next.id;
  return next;
}

export function simulateCurrentTournament(state) {
  ensureYearSetup(state);
  const ev = activeEvent(state) || simulateToNextTournament(state);
  if (!ev) return null;
  while (ev.status !== 'Finished') advanceTimeToNextPhase(state);
  return ev;
}

export function getTournamentsForYear(state, year) {
  ensureYearSetup(state);
  return (state.eventsByYear[year] || []).slice().sort((a, b) => a.startDay - b.startDay);
}

// legacy exports kept for compatibility
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

export function openMatch(state) {
  const match = state.schedule.find((m) => m.status !== 'final' && (m.homeTid === state.userTid || m.awayTid === state.userTid));
  if (!match) return null;
  initializeLiveSeries(state, match);
  return match;
}
export function playMatchRounds(state, n = 6) {
  const match = state.schedule.find((m) => m.live && m.status === 'inProgress');
  if (!match) return null;
  playLiveRounds(state, match, n);
  return match;
}
export function playMatchToHalf(state) {
  const match = state.schedule.find((m) => m.live && m.status === 'inProgress');
  if (!match) return null;
  simLiveToHalf(state, match);
  return match;
}
export function playMatchMap(state) {
  const match = state.schedule.find((m) => m.live && m.status === 'inProgress');
  if (!match) return null;
  simLiveMap(state, match);
  return match;
}
export function playMatchSeries(state) {
  const match = state.schedule.find((m) => m.live && m.status === 'inProgress');
  if (!match) return null;
  simLiveSeries(state, match);
  return match;
}
export function simulateNextMatchForUserTeam(state) { return advanceTimeToNextPhase(state); }
export function simulateWeek(state) { return advanceTimeToNextPhase(state); }

export function getFacilityUpgradeCost(team, key) { return upgradeCost(team.facilities[key]); }

export function applyPracticeAndFacilities(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  if (!team) return;
  applyWeeklyTraining(state, tid, 1 + (team.facilities?.pcEquipment?.level || 1) * 0.08, 1 + (team.chemistry || 50) / 300);
  team.teamCohesion = clamp((team.teamCohesion || 50) + 0.4, 0, 100);
}

export function postInitEnsure(state) {
  ensureYearSetup(state);
}
