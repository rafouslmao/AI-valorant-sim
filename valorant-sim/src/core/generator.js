import { AGENT_ROLES, FACILITY_CONFIG, MAP_POOL, PRACTICE_FOCUS, ROLES, SECONDARY_ROLE_TAGS, TEAMS } from './constants.js';
import { randInt, uid, weightedPick } from './utils.js';

const firstNames = ['Alex', 'Mina', 'Sora', 'Jett', 'Kai', 'Leo', 'Yuna', 'Noah', 'Ari', 'Iris', 'Mako', 'Rin'];
const lastNames = ['Park', 'Smith', 'Kim', 'Garcia', 'Brown', 'Khan', 'Rossi', 'Tan', 'Dubois', 'Silva'];
const nationalities = ['KR', 'US', 'BR', 'SE', 'DE', 'PL', 'JP', 'CN', 'FR', 'ES'];
const coachStyles = ['Structured', 'Loose', 'Reactive', 'Prep-heavy'];

function genName() { return `${firstNames[randInt(0, firstNames.length - 1)]} ${lastNames[randInt(0, lastNames.length - 1)]}`; }
function genAttributes() { return { aim: randInt(50, 95), utility: randInt(45, 95), clutch: randInt(40, 95), mental: randInt(50, 95), teamwork: randInt(45, 95), decisionMaking: randInt(40, 90) }; }

export function computePlayerOverall(player) {
  const a = player.attrs;
  return Math.round(a.aim * 0.28 + a.utility * 0.2 + a.clutch * 0.17 + a.mental * 0.15 + a.teamwork * 0.1 + a.decisionMaking * 0.1);
}

function pickSecondaryTag() { return SECONDARY_ROLE_TAGS[randInt(1, SECONDARY_ROLE_TAGS.length - 1)]; }

function initAgentPool(primaryRole) {
  const affinities = {};
  const normalizedRole = primaryRole === 'Flex' ? 'flex' : primaryRole.toLowerCase();
  if (primaryRole === 'Flex') {
    for (const roleName of ['Duelist', 'Initiator', 'Controller', 'Sentinel']) {
      for (const agent of [...AGENT_ROLES[roleName]].sort(() => Math.random() - 0.5).slice(0, 2)) affinities[agent] = randInt(48, 90);
    }
  } else {
    const pool = [...(AGENT_ROLES[primaryRole] || [])].sort(() => Math.random() - 0.5);
    for (const a of pool.slice(0, 3)) affinities[a] = randInt(58, 95);
    while (Object.keys(affinities).length < 2 && pool.length) affinities[pool[randInt(0, pool.length - 1)]] = randInt(55, 88);
  }
  return { primaryRole: normalizedRole, affinities };
}

export function createPlayer(tid) {
  const primaryRole = weightedPick(ROLES.map((role) => ({ value: role, weight: role === 'Flex' ? 0.7 : 1 })));
  const secondaryRole = weightedPick(ROLES.map((role) => ({ value: role, weight: role !== primaryRole ? 1 : 0.2 })));
  const roleSkills = Object.fromEntries(ROLES.map((r) => [r, randInt(r === primaryRole ? 52 : 22, r === primaryRole ? 90 : 72)]));
  const salary = randInt(20_000, 60_000);
  const player = {
    pid: uid('p'), tid, name: genName(), age: randInt(17, 29), salary,
    reputation: randInt(35, 90), ambition: randInt(20, 95), loyalty: randInt(20, 95), greed: randInt(20, 95), playtimeDesire: randInt(30, 95), preferredRole: primaryRole,
    attrs: genAttributes(),
    roles: [...new Set([primaryRole, secondaryRole])], currentRole: primaryRole,
    secondaryRoleTag: pickSecondaryTag(), roleSkills,
    agentPool: initAgentPool(primaryRole),
    trainingPlan: { primaryFocus: primaryRole === 'Flex' ? 'Initiator' : primaryRole, secondaryFocus: 'None', intensity: 'normal' },
    currentContract: { salaryPerYear: salary, yearsRemaining: randInt(1, 3), signedWithTid: tid, buyoutClause: Math.round(salary * randInt(2, 5)), rolePromise: randInt(0, 100) > 35 ? 'starter' : 'bench', signingBonus: Math.round(salary * 0.15) },
    history: []
  };
  player.ovr = computePlayerOverall(player);
  return player;
}

function coreCoachRatings() {
  return { prep: randInt(40, 95), mapPool: randInt(40, 95), vetoSkill: randInt(40, 95), compCrafting: randInt(40, 95), midSeriesAdapt: randInt(40, 95), practiceDesign: randInt(40, 95), skillDevelopment: randInt(40, 95), roleDevelopment: randInt(40, 95), talentID: randInt(40, 95), leadership: randInt(40, 95), discipline: randInt(40, 95), cultureFit: randInt(40, 95), conflictMgmt: randInt(40, 95), timeoutValue: randInt(40, 95), clutchControl: randInt(40, 95), composure: randInt(40, 95), riskBalance: randInt(40, 95) };
}

function slider() { return Number((Math.random() * 2 - 1).toFixed(2)); }

export function createCoach(tid = null, role = 'Head Coach', forcedName) {
  return {
    cid: uid('c'), tid, staffRole: role, salary: randInt(22_000, 90_000),
    profile: { name: forcedName || genName(), age: randInt(28, 58), nationality: nationalities[randInt(0, nationalities.length - 1)], styleTag: coachStyles[randInt(0, coachStyles.length - 1)] },
    ratings: coreCoachRatings(),
    styleSliders: { aggressionBias: slider(), structureBias: slider(), innovationBias: slider(), rookieTrust: slider(), egoManagementBias: slider() },
    history: []
  };
}

function initFacilities() {
  const facilities = {};
  for (const [key, cfg] of Object.entries(FACILITY_CONFIG)) facilities[key] = { level: 1, baseCost: cfg.baseCost, baseMaintenance: cfg.baseMaintenance, maxLevel: cfg.maxLevel };
  return facilities;
}

function mapRatings() { return Object.fromEntries(MAP_POOL.map((m) => [m.id, randInt(45, 85)])); }

function defaultStrategy() {
  return {
    mapPreferences: Object.fromEntries(MAP_POOL.map((m) => [m.id, 'Neutral'])),
    economyRisk: 0.5,
    aggression: 0.5,
    compComfort: 0.5,
    delegateToCoach: true,
    comps: [],
    defaultCompByMap: { global: 'global' }
  };
}

function createTeam(teamInfo) {
  return {
    ...teamInfo,
    budget: 600_000 + randInt(0, 300_000), cash: 600_000 + randInt(0, 250_000), revenue: 0, expenses: 0,
    teamReputation: randInt(45, 92), recentPerformanceScore: randInt(40, 80), facilitiesLevel: 50, financialStability: 60, coachQuality: 60, rosterStrength: 60,
    wageBudget: randInt(280_000, 420_000),
    monthlyLedger: [], facilities: initFacilities(), mapRatings: mapRatings(), strategy: defaultStrategy(),
    practicePlan: { focus: PRACTICE_FOCUS[0], intensity: 'normal' },
    wins: 0, losses: 0, chemistry: 50, morale: 50, fatigue: 0,
    headCoachId: null,
    starters: []
  };
}

function createSchedule(teams, year) {
  const matches = [];
  let week = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({ mid: uid('m'), week, season: year, homeTid: teams[i].tid, awayTid: teams[j].tid, status: 'scheduled', played: false, result: null, live: null });
      week = week >= 12 ? 1 : week + 1;
    }
  }
  return matches.sort((a, b) => a.week - b.week);
}

function initTeamStarters(teams, players) {
  for (const t of teams) t.starters = players.filter((p) => p.tid === t.tid).slice(0, 5).map((p) => p.pid);
}

function initialSponsorOffers(teams) {
  return teams.slice(0, 6).map((t) => ({
    id: uid('spOffer'),
    teamId: t.tid,
    sponsorName: `${t.abbrev} Tech Partners`,
    basePayout: randInt(120_000, 260_000),
    bonusPayout: randInt(60_000, 140_000),
    objective: weightedPick([
      { value: { type: 'wins', target: 12, label: 'Win 12 series this season' }, weight: 2 },
      { value: { type: 'reputation', target: 70, label: 'Reach team reputation 70' }, weight: 1 },
      { value: { type: 'topPlayer', target: 85, label: 'Have a player with OVR 85+' }, weight: 1 }
    ]),
    deadlineWeek: 24,
    createdAt: Date.now()
  }));
}

export function generateWorld({ userTid, mode, saveName, userName }) {
  const year = 2027;
  const teams = TEAMS.map(createTeam);
  const players = [];
  const coaches = [];

  for (const t of teams) {
    const isUserTeam = t.tid === userTid;
    if (mode === 'Coach' && isUserTeam) {
      const userCoach = createCoach(t.tid, 'Head Coach', userName);
      coaches.push(userCoach);
      t.headCoachId = userCoach.cid;
    } else {
      const hc = createCoach(t.tid, 'Head Coach');
      coaches.push(hc);
      t.headCoachId = hc.cid;
    }
  }

  for (const t of teams) for (let i = 0; i < 8; i++) players.push(createPlayer(t.tid));
  for (let i = 0; i < 35; i++) players.push(createPlayer(null));
  for (let i = 0; i < 24; i++) coaches.push(createCoach(null, 'Head Coach'));

  initTeamStarters(teams, players);

  return {
    rules: { allowDuplicateAgentsSameTeam: false },
    meta: { leagueName: 'Valorant Global Circuit', year, week: 1, mode, saveName, userName, godMode: true, createdAt: Date.now() },
    userTid,
    teams,
    players,
    coaches,
    schedule: createSchedule(teams, year),
    transactions: [],
    recommendations: [],
    negotiations: {},
    messages: [],
    facilityRequests: [],
    sponsors: { active: [], offers: initialSponsorOffers(teams), history: [] }
  };
}
