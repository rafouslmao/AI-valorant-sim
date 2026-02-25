import { AGENT_ROLES, MAP_POOL, PRACTICE_FOCUS } from './constants.js';
import { clamp, uid } from './utils.js';
import { computePlayerOverall, createCoach, generateValorantIgn } from './generator.js';
import { applyWeeklyTraining } from './training.js';
import { aiResolveFreeAgency } from './contracts.js';
import { initializeLiveSeries, playLiveRound, playLiveRounds, requestTimeoutForTeam, simLiveMap, simLiveSeries, simLiveToHalf, simulateBo3Series } from './matchSimBo3.js';
import { addMessage } from './messages.js';

const REGION_MAP = ['Americas', 'EMEA', 'Pacific', 'China'];

function upgradeCost(facility) {
  return Math.round(facility.baseCost * ((facility.level + 1) ** 1.5));
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

function ensureNamePools(state) {
  if (!state.meta.handlePool) state.meta.handlePool = [];
  if (!state.meta.coachNamePool) state.meta.coachNamePool = [];
}

function buildEventMatches(state, event) {
  if (event.matches?.length) return;
  event.matches = [];
  state.schedule = state.schedule || [];

  const addMatch = (homeTid, awayTid, stage, dayOffset = 0) => {
    const m = {
      id: uid('m'),
      season: state.meta.year,
      eventId: event.id,
      eventName: event.name,
      stage,
      day: event.startDay + dayOffset,
      homeTid,
      awayTid,
      bestOf: 3,
      status: 'scheduled',
      played: false,
      live: null,
      result: null
    };
    state.schedule.push(m);
    event.matches.push(m.id);
  };

  const qual = (event.qualifierParticipants || []).slice(0, Math.floor((event.qualifierParticipants || []).length / 2) * 2);
  for (let i = 0; i < qual.length; i += 2) addMatch(qual[i], qual[i + 1], 'Qualifier', 0);

  const mainCandidates = [...new Set([...(event.invitedAccepted || []), ...(event.qualifiedTeams || []), ...(event.qualifierParticipants || []).slice(0, event.qualSlots || 0)])].slice(0, event.mainSlots || 16);
  for (let i = 0; i < mainCandidates.length; i += 2) {
    if (mainCandidates[i + 1] == null) break;
    addMatch(mainCandidates[i], mainCandidates[i + 1], 'Main Event', 2 + Math.floor(i / 2));
  }
}

function teamEligibleForEvent(team, event) {
  if (event.eligibilityTier === 'T1_ONLY') return team.tier === 'Tier 1';
  if (event.eligibilityTier === 'T2_ONLY') return team.tier === 'Tier 2';
  return true;
}


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

function createTier2Player(team, role = 'Flex', state) {
  const seed = uid('t2p');
  const p = {
    pid: uid('p'),
    tid: team.tid,
    name: generateValorantIgn(new Set(state.players.map((x) => String(x.name).toLowerCase()))),
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
    trainingPlan: { primaryFocus: 'Mechanics', secondaryFocus: 'Role mastery', intensity: 'normal', roleFocus: role },
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
    const used = new Set(state.coaches.map((c) => c.profile?.name));
    for (let i = 0; i < 40; i++) state.coaches.push(createCoach(null, 'Head Coach', null, used));
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
      const player = freeByRole || createTier2Player(team, role, state);
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
    openQualifierBracket: [],
    closedQualifierBracket: [],
    qualifiersBracket: [],
    invitedAccepted: [],
    invitedDeclined: [],
    qualifiedTeams: [],
    mainTeams: [],
    matches: [],
    placements: [],
    payouts: [],
    pointsAwarded: [],
    eligibilityTier: 'ALL',
    invitesCount: 4,
    ...ev
  });

  const sTypes = [
    ['VALORANT Masters', 'Riot'], ['BLAST Open', 'BLAST'], ['IEM Global', 'IEM'],
    ['EWC', 'EWC'], ['PGL Finals', 'PGL'], ['Champions', 'Riot']
  ];
  let cursor = 35 + rand(0, 10);
  for (let i = 0; i < 6; i++) {
    const [name, org] = sTypes[i % sTypes.length];
    const len = rand(11, 15);
    pushEvent({
      name: `${name} ${i + 1}`,
      organizer: org,
      tier: 'S',
      regionScope: 'INTERNATIONAL',
      region: 'All',
      startDay: cursor,
      endDay: cursor + len,
      prizePool: rand(900000, 2400000),
      pointsMultiplier: 1.8 + Math.random() * 1.6,
      travelCostFactor: 1.4 + Math.random() * 0.6,
      inviteSlots: 4,
      qualSlots: 12,
      mainSlots: 16,
      prestige: rand(84, 100),
      invitesCount: 4
    });
    cursor += rand(34, 52);
  }

  const aOrgs = ['FISSURE', 'PGL Challengers', 'BLAST Rising', 'Open Circuit'];
  for (const region of REGION_MAP) {
    let rd = 18 + rand(0, 10);
    for (let i = 0; i < 3; i++) {
      const len = rand(8, 12);
      pushEvent({
        name: `${region} ${aOrgs[(i + region.length) % aOrgs.length]} ${i + 1}`,
        organizer: aOrgs[(i + region.length) % aOrgs.length],
        tier: 'A',
        eligibilityTier: 'ALL',
        regionScope: rand(0, 100) < 30 ? 'INTERNATIONAL' : 'REGIONAL',
        region,
        startDay: rd,
        endDay: rd + len,
        prizePool: rand(120000, 550000),
        pointsMultiplier: 0.9 + Math.random() * 0.6,
        travelCostFactor: 0.85 + Math.random() * 0.35,
        inviteSlots: 2,
        qualSlots: 14,
        mainSlots: 16,
        prestige: rand(48, 76),
        invitesCount: 2
      });
      rd += rand(38, 62);
    }
  }

  events.sort((a, b) => a.startDay - b.startDay);
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const cur = events[i];
    if (cur.startDay <= prev.endDay + 2) {
      const shift = (prev.endDay + 3) - cur.startDay;
      cur.startDay += shift;
      cur.endDay += shift;
    }
  }
  return events;
}

function buildVeto(homeTeam, awayTeam) {
  const maps = MAP_POOL.map((m) => m.id);
  const score = (team, mapId) => (team?.mapRatings?.[mapId] || 50) + rand(-5, 5);
  const banA = [...maps].sort((a, b) => score(homeTeam, a) - score(homeTeam, b))[0];
  const banB = [...maps].filter((m) => m !== banA).sort((a, b) => score(awayTeam, a) - score(awayTeam, b))[0];
  const pickA = [...maps].filter((m) => m !== banA && m !== banB).sort((a, b) => score(homeTeam, b) - score(homeTeam, a))[0];
  const pickB = [...maps].filter((m) => m !== banA && m !== banB && m !== pickA).sort((a, b) => score(awayTeam, b) - score(awayTeam, a))[0];
  const rem = maps.filter((m) => ![banA, banB, pickA, pickB].includes(m));
  const banA2 = rem.sort((a, b) => score(homeTeam, a) - score(homeTeam, b))[0];
  const banB2 = rem.filter((m) => m !== banA2).sort((a, b) => score(awayTeam, a) - score(awayTeam, b))[0];
  const deciderMap = rem.find((m) => m !== banA2 && m !== banB2) || rem[0];
  return { bansTeamA: [banA, banA2].filter(Boolean), bansTeamB: [banB, banB2].filter(Boolean), picksTeamA: [pickA].filter(Boolean), picksTeamB: [pickB].filter(Boolean), deciderMap };
}

function pickQualifierPool(state, event, ranked, invitedTids) {
  const inRegion = (t) => event.regionScope === 'INTERNATIONAL' || t.region === event.region;
  const nonInvited = ranked.filter((t) => !invitedTids.includes(t.tid) && inRegion(t));
  const targetPoolSize = Math.min(nonInvited.length, Math.max(event.qualSlots * 2, 12));
  const lowerT1 = nonInvited.filter((t) => t.tier === 'Tier 1').slice(0, Math.max(6, event.qualSlots)).map((t) => t.tid);
  const t2 = nonInvited.filter((t) => t.tier === 'Tier 2').map((t) => t.tid);
  const pool = [...new Set([...lowerT1, ...t2])].slice(0, targetPoolSize);
  while (pool.length < targetPoolSize) {
    const fb = ranked.find((t) => !invitedTids.includes(t.tid) && !pool.includes(t.tid));
    if (!fb) break;
    pool.push(fb.tid);
  }
  while (pool.length < targetPoolSize) {
    const fbGlobal = state.teams.find((t) => !invitedTids.includes(t.tid) && !pool.includes(t.tid));
    if (!fbGlobal) break;
    pool.push(fbGlobal.tid);
  }
  return pool;
}

function runQualifierBrackets(event, state) {
  const entrants = [...new Set(event.qualifierParticipants || [])];
  let day = Math.max(1, event.startDay - 6);
  event.openQualifierBracket = [];
  event.closedQualifierBracket = [];
  event.matches = event.matches || [];
  state.schedule = state.schedule || [];

  const addMatch = (homeTid, awayTid, stage) => {
    const homeTeam = state.teams.find((t) => t.tid === homeTid);
    const awayTeam = state.teams.find((t) => t.tid === awayTid);
    const match = { id: uid('m'), season: state.meta.year, eventId: event.id, eventName: event.name, stage, day, homeTid, awayTid, bestOf: 3, status: 'scheduled', played: false, live: null, result: null, veto: buildVeto(homeTeam, awayTeam) };
    state.schedule.push(match); event.matches.push(match.id); simulateBo3Series(state, match); match.result = match.result || {}; match.result.veto = match.veto; return match;
  };

  let openRound = entrants.slice();
  let round = 1;
  while (openRound.length > 16) {
    const winners = [];
    for (let i = 0; i + 1 < openRound.length; i += 2) {
      const m = addMatch(openRound[i], openRound[i + 1], `Open Qual R${round}`);
      winners.push(m.result.winnerTid);
      event.openQualifierBracket.push({ round, homeTid: openRound[i], awayTid: openRound[i + 1], winnerTid: m.result.winnerTid, matchId: m.id });
    }
    openRound = winners;
    round += 1;
    day += 1;
  }

  const closedSeeds = [...openRound];
  while (closedSeeds.length < 16) {
    const fb = state.teams.filter((t) => !event.invitedAccepted.includes(t.tid) && !closedSeeds.includes(t.tid)).sort((a, b) => rankingScore(b) - rankingScore(a))[0];
    if (!fb) break;
    closedSeeds.push(fb.tid);
  }

  const closedRound = closedSeeds.slice(0, 16);
  const winners = [];
  const losers = [];
  round = 1;
  for (let i = 0; i + 1 < closedRound.length; i += 2) {
    const m = addMatch(closedRound[i], closedRound[i + 1], `Closed Qual R${round}`);
    winners.push(m.result.winnerTid);
    losers.push(m.result.winnerTid === closedRound[i] ? closedRound[i + 1] : closedRound[i]);
    event.closedQualifierBracket.push({ round, homeTid: closedRound[i], awayTid: closedRound[i + 1], winnerTid: m.result.winnerTid, matchId: m.id });
  }
  day += 1;

  const topLosers = losers.sort((a, b) => rankingScore(state.teams.find((t) => t.tid === b)) - rankingScore(state.teams.find((t) => t.tid === a)));
  event.qualifiedTeams = [...winners, ...topLosers].slice(0, event.qualSlots);
  event.qualifiersBracket = event.closedQualifierBracket.slice();
  event.phase = 'qualifiers_done';
  event.status = 'Qualifiers';
}

function attendanceScore(team, event, state) {
  const prestige = event.prestige;
  const prize = Math.log10(event.prizePool) * 12;
  const qualValue = event.tier === 'S' ? 20 : 8;
  const needPoints = Math.max(0, 160 - (team.circuitPoints || 0)) / 4;
  const orgRep = team.teamReputation || 50;
  const travel = event.regionScope === 'INTERNATIONAL' ? 14 * event.travelCostFactor : (team.region === event.region ? 4 : 10) * event.travelCostFactor;
  const fatigue = team.fatigue || 0;
  const conflict = state.eventsByYear[state.meta.year].some((e) => e.id !== event.id && (e.status === 'Qualifiers' || e.status === 'Main Event') && e.mainTeams.includes(team.tid)) ? 45 : 0;

  let t1Penalty = 0;
  if (event.tier === 'A' && team.tier === 'Tier 1') {
    const elo = team.elo || 1500;
    const scheduleLoad = state.schedule.filter((m) => m.season === state.meta.year && (m.homeTid === team.tid || m.awayTid === team.tid) && m.status !== 'final').length;
    const lowNeed = Math.max(0, ((team.circuitPoints || 0) - 100) / 25);
    const warmup = (team.teamCohesion || 50) < 52 ? -8 : 0;
    t1Penalty = (elo > 1675 ? 18 : elo > 1575 ? 10 : 4) + scheduleLoad * 1.8 + travel * 0.45 + lowNeed * 4 + warmup;
  }
  if (event.tier === 'A' && team.tier === 'Tier 2') t1Penalty -= 10;
  if (event.tier === 'A' && state.meta.tierANoT1Streak >= 2 && team.tier === 'Tier 1') t1Penalty -= 12;
  return prestige * 0.55 + prize + qualValue + needPoints + orgRep * 0.22 - travel - fatigue * 0.25 - conflict - t1Penalty;
}

function setupEventParticipation(state, event) {
  const eligible = state.teams.filter((t) => (event.regionScope === 'INTERNATIONAL' || t.region === event.region) && teamEligibleForEvent(t, event));
  const ranked = [...eligible].sort((a, b) => rankingScore(b) - rankingScore(a));
  event.mainSlots = 16;
  const desiredInvites = event.tier === 'S' ? 4 : 2;
  event.inviteSlots = Math.min(6, Math.max(1, event.invitesCount || desiredInvites));
  event.qualSlots = Math.max(0, event.mainSlots - event.inviteSlots);

  const invited = ranked.slice(0, event.inviteSlots);
  event.invitedAccepted = invited.map((t) => t.tid);
  event.invitedDeclined = [];

  const qualifierPool = pickQualifierPool(state, event, ranked, event.invitedAccepted);
  event.qualifierParticipants = qualifierPool;
  event.status = 'Upcoming';

  if (event.tier === 'A') {
    const t1Count = event.invitedAccepted.filter((tid) => state.teams.find((t) => t.tid === tid)?.tier === 'Tier 1').length;
    if (t1Count === 0) state.meta.tierANoT1Streak = (state.meta.tierANoT1Streak || 0) + 1;
    else state.meta.tierANoT1Streak = 0;
  }
}

function runQualifier(event, state) {
  runQualifierBrackets(event, state);
}

function runMainEvent(event, state) {
  const teams = [...new Set([...(event.invitedAccepted || []), ...(event.qualifiedTeams || [])])].slice(0, 16);
  while (teams.length < 16) {
    const fallback = state.teams.filter((t) => !teams.includes(t.tid)).sort((a, b) => rankingScore(b) - rankingScore(a))[0];
    if (!fallback) break;
    teams.push(fallback.tid);
  }
  event.mainTeams = teams.slice(0, 16);
  event.matches = event.matches || [];
  state.schedule = state.schedule || [];

  const swissRecords = new Map(event.mainTeams.map((tid) => [tid, { w: 0, l: 0 }]));
  let day = Math.max(event.startDay + 2, state.meta.currentDay || state.meta.day || 1);

  const addAndSim = (homeTid, awayTid, stage) => {
    const homeTeam = state.teams.find((t) => t.tid === homeTid);
    const awayTeam = state.teams.find((t) => t.tid === awayTid);
    const match = {
      id: uid('m'), season: state.meta.year, eventId: event.id, eventName: event.name, stage, day,
      homeTid, awayTid, bestOf: 3, status: 'scheduled', played: false, live: null, result: null,
      veto: buildVeto(homeTeam, awayTeam)
    };
    state.schedule.push(match);
    event.matches.push(match.id);
    simulateBo3Series(state, match);
    match.result = match.result || {};
    match.result.veto = match.veto;
    return match;
  };

  for (let round = 1; round <= 5; round++) {
    const active = event.mainTeams.filter((tid) => {
      const r = swissRecords.get(tid);
      return r.w < 3 && r.l < 3;
    });
    active.sort((a, b) => (swissRecords.get(b).w - swissRecords.get(a).w) || (rankingScore(state.teams.find((t) => t.tid === b)) - rankingScore(state.teams.find((t) => t.tid === a))));
    for (let i = 0; i < active.length - 1; i += 2) {
      const homeTid = active[i];
      const awayTid = active[i + 1];
      const m = addAndSim(homeTid, awayTid, `Swiss R${round}`);
      const winnerTid = m.result?.winnerTid;
      const loserTid = winnerTid === homeTid ? awayTid : homeTid;
      swissRecords.get(winnerTid).w += 1;
      swissRecords.get(loserTid).l += 1;
    }
    day += 1;
  }

  const swissRanked = [...event.mainTeams].sort((a, b) => {
    const ar = swissRecords.get(a); const br = swissRecords.get(b);
    return (br.w - ar.w) || (ar.l - br.l) || (rankingScore(state.teams.find((t) => t.tid === b)) - rankingScore(state.teams.find((t) => t.tid === a)));
  });
  const playoff = swissRanked.slice(0, 8);

  const qfPairs = [[0, 7], [3, 4], [1, 6], [2, 5]].map(([a, b]) => [playoff[a], playoff[b]]);
  const sfTeams = [];
  for (const [h, a] of qfPairs) { const m = addAndSim(h, a, 'Playoffs QF'); sfTeams.push(m.result.winnerTid); }
  day += 1;
  const sfWinners = [];
  sfWinners.push(addAndSim(sfTeams[0], sfTeams[1], 'Playoffs SF').result.winnerTid);
  sfWinners.push(addAndSim(sfTeams[2], sfTeams[3], 'Playoffs SF').result.winnerTid);
  day += 1;
  const final = addAndSim(sfWinners[0], sfWinners[1], 'Playoffs Final');

  const points = makePoints(event.pointsMultiplier);
  const payoutCurve = [0.34, 0.2, 0.12, 0.08, 0.06, 0.05, 0.04, 0.03];
  let remainingPrize = event.prizePool;
  event.placements = [];
  event.payouts = [];
  event.pointsAwarded = [];

  const ordered = [final.result.winnerTid, final.result.winnerTid === sfWinners[0] ? sfWinners[1] : sfWinners[0], ...swissRanked.filter((tid) => tid !== sfWinners[0] && tid !== sfWinners[1])];
  ordered.forEach((tid, i) => {
    const team = state.teams.find((t) => t.tid === tid);
    if (!team) return;
    const payout = i < payoutCurve.length ? Math.round(event.prizePool * payoutCurve[i]) : 0;
    remainingPrize -= payout;
    const pts = points[i] || 2;
    team.circuitPoints = (team.circuitPoints || 0) + pts;
    team.cash += payout;
    team.winnings = (team.winnings || 0) + payout;
    team.eventsPlayedThisYear = (team.eventsPlayedThisYear || 0) + 1;
    team.lastEventPlayed = event.name;
    team.elo = clamp(Math.round((team.elo || 1200) + (i < 4 ? 20 : -8) + rand(-6, 8)), 900, 2400);
    event.placements.push({ place: i + 1, tid });
    event.payouts.push({ tid, amount: payout });
    event.pointsAwarded.push({ tid, points: pts });
  });

  if (remainingPrize > 0 && event.payouts[0]) event.payouts[0].amount += remainingPrize;
  event.status = 'Finished';
  event.phase = 'finished';
  state.meta.currentDay = day;
  state.meta.day = day;
  event.endDay = Math.max(event.endDay, day);
  state.eventLog.push({ id: uid('elog'), year: state.meta.year, day, type: 'event_finished', eventId: event.id, name: event.name });
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
  state.schedule = (state.schedule || []).filter((m) => m.season !== year);
  state.eventsByYear[year] = generateYearCalendar(state, year);
  for (const e of state.eventsByYear[year]) setupEventParticipation(state, e);
  state.meta.initializedYear = year;
  state.meta.day = 1;
  state.meta.currentDay = 1;
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
  state.meta.currentDay = 1;
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
  state.meta.currentDay = state.meta.day;
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
  state.meta.currentDay = state.meta.day;
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

export function openMatch(state, matchId = null) {
  const match = matchId ? state.schedule.find((m) => m.id === matchId) : state.schedule.find((m) => m.status !== 'final' && (m.homeTid === state.userTid || m.awayTid === state.userTid));
  if (!match) return null;
  const currentDay = state.meta.currentDay || state.meta.day || 1;
  if ((match.day || 1) > currentDay) return null;
  initializeLiveSeries(state, match);
  return match;
}
export function playMatchRounds(state, n = 6, matchId = null) {
  const match = matchId ? state.schedule.find((m) => m.id === matchId) : state.schedule.find((m) => m.live && m.status === 'inProgress');
  if (!match) return null;
  const currentDay = state.meta.currentDay || state.meta.day || 1;
  if ((match.day || 1) > currentDay) return null;
  playLiveRounds(state, match, n);
  return match;
}
export function playMatchToHalf(state, matchId = null) {
  const match = matchId ? state.schedule.find((m) => m.id === matchId) : state.schedule.find((m) => m.live && m.status === 'inProgress');
  if (!match) return null;
  const currentDay = state.meta.currentDay || state.meta.day || 1;
  if ((match.day || 1) > currentDay) return null;
  simLiveToHalf(state, match);
  return match;
}
export function playMatchMap(state, matchId = null) {
  const match = matchId ? state.schedule.find((m) => m.id === matchId) : state.schedule.find((m) => m.live && m.status === 'inProgress');
  if (!match) return null;
  const currentDay = state.meta.currentDay || state.meta.day || 1;
  if ((match.day || 1) > currentDay) return null;
  simLiveMap(state, match);
  return match;
}
export function playMatchSeries(state, matchId = null) {
  const match = matchId ? state.schedule.find((m) => m.id === matchId) : state.schedule.find((m) => m.live && m.status === 'inProgress');
  if (!match) return null;
  const currentDay = state.meta.currentDay || state.meta.day || 1;
  if ((match.day || 1) > currentDay) return null;
  simLiveSeries(state, match);
  return match;
}
export function requestMatchTimeout(state, matchId, tid) {
  const match = state.schedule.find((m) => m.id === matchId);
  if (!match?.live) return false;
  return requestTimeoutForTeam(match, tid);
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

// MANUAL TEST CHECKLIST
// 1) New world: only 5 tier-2 teams per region are created.
// 2) Start year: calendar shows multiple Tier S and Tier A events with dynamic dates.
// 3) For a Tier S event: 4 top teams are invited, rest qualify through open+closed qualifiers, main event has 16 teams.
// 4) Schedule tab: "My Matches" lists upcoming qualifiers and main event matches in chronological order.
// 5) Match view: shows map veto, 2-0/2-1 series score, and per-map results.
// 6) Advancing days cannot skip future matches; matches are simulated in date order.
