import { AGENT_ROLES, FACILITY_CONFIG, MAP_POOL, PRACTICE_FOCUS, ROLES } from './constants.js';
import { REAL_IMPORTED_PLAYERS, REAL_TEAM_DATABASE } from './database.js';
import { computeDerivedRatings, createPlayerAttributes, ensureCoachAttributes, ensurePlayerSystems, mapFamiliarityTemplate } from './ratings.js';
import { randInt, uid, weightedPick } from './utils.js';

const nationalities = ['US', 'BR', 'AR', 'SE', 'DE', 'PL', 'JP', 'CN', 'FR', 'ES', 'KR'];
const coachStyles = ['Structured', 'Loose', 'Reactive', 'Prep-heavy'];
const T2_REGIONS = ['Americas', 'EMEA', 'Pacific', 'China'];

function hashNum(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function seededRange(seed, min, max) {
  return min + (seed % (max - min + 1));
}

function genAttributes(seedKey) {
  const seed = hashNum(seedKey);
  return {
    aim: seededRange(seed * 3, 55, 93),
    utility: seededRange(seed * 5, 50, 92),
    clutch: seededRange(seed * 7, 45, 90),
    mental: seededRange(seed * 11, 50, 92),
    teamwork: seededRange(seed * 13, 48, 90),
    decisionMaking: seededRange(seed * 17, 45, 89)
  };
}

export function computePlayerOverall(player) {
  if (!player.derived) computeDerivedRatings(player, {});
  return player.ovr || 55;
}

function initAgentPool(primaryRole, seedKey) {
  const affinities = {};
  const seed = hashNum(seedKey);
  const normalizedRole = primaryRole === 'Flex' ? 'flex' : primaryRole.toLowerCase();
  if (primaryRole === 'Flex') {
    for (const roleName of ['Duelist', 'Initiator', 'Controller', 'Sentinel']) {
      const agents = AGENT_ROLES[roleName];
      affinities[agents[seed % agents.length]] = seededRange(seed * agents.length, 60, 94);
      affinities[agents[(seed + 2) % agents.length]] = seededRange(seed * (agents.length + 1), 55, 90);
    }
  } else {
    const agents = AGENT_ROLES[primaryRole] || AGENT_ROLES.Initiator;
    const a1 = agents[seed % agents.length];
    const a2 = agents[(seed + 3) % agents.length];
    affinities[a1] = seededRange(seed * 2, 65, 96);
    affinities[a2] = seededRange(seed * 4, 58, 90);
    affinities[agents[(seed + 5) % agents.length]] = seededRange(seed * 6, 50, 86);
  }
  return { primaryRole: normalizedRole, affinities };
}

function cleanRole(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'duelist') return 'Duelist';
  if (v === 'initiator') return 'Initiator';
  if (v === 'controller') return 'Controller';
  if (v === 'sentinel') return 'Sentinel';
  return 'Flex';
}

function createImportedPlayer(seedPlayer) {
  const roles = Array.from(new Set((seedPlayer.roles || []).map((r) => cleanRole(r))));
  const primaryRole = cleanRole(seedPlayer.primaryRole || roles[0]);
  const seedKey = `${seedPlayer.name}-${seedPlayer.teamName || 'FA'}`;
  const attrs = genAttributes(seedKey);
  const attributes = createPlayerAttributes(Math.round((attrs.aim + attrs.utility + attrs.mental) / 3));
  const salary = seededRange(hashNum(`${seedPlayer.name}-salary`), 38000, 115000);

  const player = {
    pid: uid('p'),
    tid: seedPlayer.freeAgent ? null : seedPlayer.teamId,
    name: seedPlayer.name,
    age: seedPlayer.age,
    nationality: seedPlayer.nationality,
    imageURL: seedPlayer.imageURL,
    salary,
    reputation: seededRange(hashNum(`${seedPlayer.name}-rep`), 45, 92),
    ambition: seededRange(hashNum(`${seedPlayer.name}-amb`), 25, 95),
    loyalty: seededRange(hashNum(`${seedPlayer.name}-loy`), 20, 95),
    greed: seededRange(hashNum(`${seedPlayer.name}-greed`), 20, 95),
    playtimeDesire: seededRange(hashNum(`${seedPlayer.name}-pt`), 35, 95),
    preferredRole: primaryRole,
    attrs,
    attributes,
    roles,
    currentRole: primaryRole,
    secondaryRoleTag: (seedPlayer.tags || [])[0] || 'None',
    roleSkills: Object.fromEntries(ROLES.map((r) => [r, seededRange(hashNum(`${seedPlayer.name}-${r}`), r === primaryRole ? 60 : 35, r === primaryRole ? 90 : 75)])),
    agentPool: initAgentPool(primaryRole, seedKey),
    trainingPlan: { primaryFocus: 'Mechanics', secondaryFocus: 'Role mastery', intensity: 'normal' },
    currentContract: {
      salaryPerYear: salary,
      yearsRemaining: seedPlayer.freeAgent ? 0 : seededRange(hashNum(`${seedPlayer.name}-years`), 1, 3),
      signedWithTid: seedPlayer.freeAgent ? null : seedPlayer.teamId,
      buyoutClause: Math.round(salary * 3),
      rolePromise: seedPlayer.starter ? 'starter' : 'bench',
      signingBonus: Math.round(salary * 0.2)
    },
    isStarter: Boolean(seedPlayer.starter && !seedPlayer.freeAgent),
    roleLearning: null,
    history: [],
    seasonStats: {}
  };
  ensurePlayerSystems(player, {});
  return player;
}

function coreCoachRatings(seedKey) {
  const s = hashNum(seedKey);
  const make = (k, a = 45, b = 90) => seededRange(s * k, a, b);
  return { prep: make(2), mapPool: make(3), vetoSkill: make(5), compCrafting: make(7), midSeriesAdapt: make(11), practiceDesign: make(13), skillDevelopment: make(17), roleDevelopment: make(19), talentID: make(23), leadership: make(29), discipline: make(31), cultureFit: make(37), conflictMgmt: make(41), timeoutValue: make(43), clutchControl: make(47), composure: make(53), riskBalance: make(59) };
}

function slider(seed) { return Number((((seed % 201) - 100) / 100).toFixed(2)); }

function randomCoachIgn() {
  const p1 = ['Ace', 'Veto', 'Nova', 'Raven', 'Echo', 'Luma', 'Ghost', 'Hex', 'Pulse', 'Cipher'];
  const p2 = ['Mind', 'Craft', 'Prep', 'Call', 'Book', 'Core', 'Shift', 'Flow', 'Forge', 'Zen'];
  return `${p1[randInt(0, p1.length - 1)]}${p2[randInt(0, p2.length - 1)]}${randInt(10, 99)}`;
}

export function createCoach(tid = null, role = 'Head Coach', forcedName) {
  const base = forcedName || randomCoachIgn();
  const h = hashNum(base + tid + role);
  const coach = {
    cid: uid('c'), tid, staffRole: role, salary: seededRange(h * 3, 30000, 100000),
    profile: { name: base, age: seededRange(h * 5, 29, 58), nationality: nationalities[h % nationalities.length], styleTag: coachStyles[h % coachStyles.length] },
    ratings: coreCoachRatings(base),
    styleSliders: { aggressionBias: slider(h * 2), structureBias: slider(h * 3), innovationBias: slider(h * 5), rookieTrust: slider(h * 7), egoManagementBias: slider(h * 11) },
    history: []
  };
  ensureCoachAttributes(coach);
  return coach;
}

function initFacilities() {
  const facilities = {};
  for (const [key, cfg] of Object.entries(FACILITY_CONFIG)) facilities[key] = { level: 1, baseCost: cfg.baseCost, baseMaintenance: cfg.baseMaintenance, maxLevel: cfg.maxLevel };
  return facilities;
}
function mapRatings(seed) { return Object.fromEntries(MAP_POOL.map((m) => [m.id, seededRange(hashNum(seed + m.id), 45, 85)])); }

function defaultStrategy() {
  return {
    mapPreferences: Object.fromEntries(MAP_POOL.map((m) => [m.id, 'Neutral'])),
    economyRisk: 0.5,
    aggression: 0.5,
    compComfort: 0.5,
    delegateToCoach: true,
    maps: Object.fromEntries(MAP_POOL.map((m) => [m.id, { defaultCompId: '', comps: [] }])),
    global: { defaultCompId: '', comps: [] }
  };
}

function createTeam(seedTeam, tid, tier = 'Tier 1') {
  const h = hashNum(seedTeam.name + tier);
  const yearlyBudget = tier === 'Tier 1' ? 700_000 + seededRange(h * 2, 0, 400_000) : 180_000 + seededRange(h * 2, 0, 90_000);
  const cash = tier === 'Tier 1' ? 650_000 + seededRange(h * 3, 0, 300_000) : 120_000 + seededRange(h * 3, 0, 70_000);
  const elo = tier === 'Tier 1' ? seededRange(h * 17, 1450, 1750) : seededRange(h * 17, 1150, 1400);
  return {
    tid,
    name: seedTeam.name,
    abbrev: seedTeam.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase(),
    region: seedTeam.region,
    tier,
    yearlyBudget,
    budget: yearlyBudget,
    cash,
    revenue: 0,
    expenses: 0,
    expensesTravel: 0,
    expensesSalaries: 0,
    winnings: 0,
    teamReputation: seededRange(h * 5, tier === 'Tier 1' ? 45 : 25, tier === 'Tier 1' ? 92 : 58),
    recentPerformanceScore: seededRange(h * 7, 40, 80),
    facilitiesLevel: 50,
    financialStability: 60,
    coachQuality: 60,
    rosterStrength: 60,
    wageBudget: seededRange(h * 11, tier === 'Tier 1' ? 280_000 : 90_000, tier === 'Tier 1' ? 420_000 : 180_000),
    monthlyLedger: [], facilities: initFacilities(), mapRatings: mapRatings(seedTeam.name), strategy: defaultStrategy(),
    practicePlan: { focus: PRACTICE_FOCUS[0], intensity: 'normal' },
    wins: 0, losses: 0, chemistry: 50, morale: 50, fatigue: 0,
    headCoachId: null,
    starters: [],
    elo,
    circuitPoints: 0,
    eventsPlayedThisYear: 0,
    lastEventPlayed: null
    ,teamCohesion: seededRange(h * 23, 42, 68)
    ,compFamiliarity: mapFamiliarityTemplate()
  };
}

function createTier2Teams(startTid) {
  const teams = [];
  let tid = startTid;
  for (const region of T2_REGIONS) {
    for (let i = 1; i <= 24; i++) {
      teams.push(createTeam({ name: `${region} Contenders ${i}`, region }, tid++, 'Tier 2'));
    }
  }
  return teams;
}

function initialSponsorOffers(teams) {
  return teams.slice(0, 8).map((t) => ({
    id: uid('spOffer'),
    teamId: t.tid,
    sponsorName: `${t.abbrev} Prime Sponsor`,
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
  const tier1Teams = REAL_TEAM_DATABASE.map((t, tid) => createTeam(t, tid, 'Tier 1'));
  const tier2Teams = createTier2Teams(tier1Teams.length);
  const teams = [...tier1Teams, ...tier2Teams];
  const players = REAL_IMPORTED_PLAYERS.map((p) => createImportedPlayer(p));
  const coaches = [];

  for (const team of teams) {
    const assignCoach = team.tier === 'Tier 1' || Math.random() < 0.55;
    if (!assignCoach) continue;
    if (mode === 'Coach' && team.tid === userTid) {
      const userCoach = createCoach(team.tid, 'Head Coach', userName || randomCoachIgn());
      coaches.push(userCoach);
      team.headCoachId = userCoach.cid;
    } else {
      const hc = createCoach(team.tid, 'Head Coach');
      coaches.push(hc);
      team.headCoachId = hc.cid;
    }
  }

  // coach market pool to prevent shortages
  for (let i = 0; i < 180; i++) coaches.push(createCoach(null, 'Head Coach'));

  for (const team of tier1Teams) {
    const teamPlayers = players.filter((p) => p.tid === team.tid);
    team.starters = teamPlayers.filter((p) => p.isStarter).slice(0, 5).map((p) => p.pid);
  }

  return {
    rules: { allowDuplicateAgentsSameTeam: true },
    meta: { leagueName: 'Valorant Global Circuit', year, week: 1, day: 1, mode, saveName, userName, godMode: false, createdAt: Date.now(), initializedYear: null },
    userTid,
    teams,
    players,
    coaches,
    strategy: { maps: Object.fromEntries(MAP_POOL.map((m) => [m.id, { defaultCompId: '', comps: [] }])), global: { defaultCompId: '', comps: [] } },
    schedule: [],
    eventsByYear: {},
    eventLog: [],
    currentEventId: null,
    transactions: [],
    recommendations: [],
    negotiations: {},
    messages: [],
    facilityRequests: [],
    sponsors: { active: [], offers: initialSponsorOffers(tier1Teams), history: [] }
  };
}
