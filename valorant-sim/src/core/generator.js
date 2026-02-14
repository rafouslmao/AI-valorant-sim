import { AGENT_ROLES, FACILITY_CONFIG, MAP_POOL, PRACTICE_FOCUS, ROLES } from './constants.js';
import { REAL_TEAM_DATABASE } from './database.js';
import { randInt, uid, weightedPick } from './utils.js';

const nationalities = ['US', 'BR', 'AR', 'SE', 'DE', 'PL', 'JP', 'CN', 'FR', 'ES', 'KR'];
const coachStyles = ['Structured', 'Loose', 'Reactive', 'Prep-heavy'];

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
  const a = player.attrs;
  return Math.round(a.aim * 0.28 + a.utility * 0.2 + a.clutch * 0.17 + a.mental * 0.15 + a.teamwork * 0.1 + a.decisionMaking * 0.1);
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
    const agents = AGENT_ROLES[primaryRole] || [];
    const a1 = agents[seed % agents.length];
    const a2 = agents[(seed + 3) % agents.length];
    affinities[a1] = seededRange(seed * 2, 65, 96);
    affinities[a2] = seededRange(seed * 4, 58, 90);
    affinities[agents[(seed + 5) % agents.length]] = seededRange(seed * 6, 50, 86);
  }
  return { primaryRole: normalizedRole, affinities };
}

function parseRole(roleRaw) {
  if (!roleRaw) return ['Flex'];
  return roleRaw.split('/').map((r) => r.trim()).filter(Boolean).map((r) => {
    const lower = r.toLowerCase();
    if (lower === 'duelist') return 'Duelist';
    if (lower === 'initiator') return 'Initiator';
    if (lower === 'controller') return 'Controller';
    if (lower === 'sentinel') return 'Sentinel';
    return 'Flex';
  });
}

function createRealPlayer(spec, tid) {
  const [ign, roleRaw = 'Flex', tagsRaw = ''] = spec.split('|');
  const roles = parseRole(roleRaw);
  const primaryRole = roles[0] || 'Flex';
  const seedKey = `${ign}-${tid}`;
  const attrs = genAttributes(seedKey);
  const salary = seededRange(hashNum(`${ign}-salary`), 38000, 115000);
  const tags = tagsRaw ? tagsRaw.split('/').map((t) => t.trim()) : [];

  const player = {
    pid: uid('p'),
    tid,
    name: ign,
    age: seededRange(hashNum(`${ign}-age`), 17, 30),
    salary,
    reputation: seededRange(hashNum(`${ign}-rep`), 45, 92),
    ambition: seededRange(hashNum(`${ign}-amb`), 25, 95),
    loyalty: seededRange(hashNum(`${ign}-loy`), 20, 95),
    greed: seededRange(hashNum(`${ign}-greed`), 20, 95),
    playtimeDesire: seededRange(hashNum(`${ign}-pt`), 35, 95),
    preferredRole: primaryRole,
    attrs,
    roles,
    currentRole: primaryRole,
    secondaryRoleTag: tags.find((t) => ['IGL', 'Entry', 'Oper'].includes(t)) || 'None',
    roleSkills: Object.fromEntries(ROLES.map((r) => [r, seededRange(hashNum(`${ign}-${r}`), r === primaryRole ? 60 : 35, r === primaryRole ? 90 : 75)])),
    agentPool: initAgentPool(primaryRole, seedKey),
    trainingPlan: { primaryFocus: primaryRole === 'Flex' ? 'Initiator' : primaryRole, secondaryFocus: 'None', intensity: 'normal' },
    currentContract: { salaryPerYear: salary, yearsRemaining: seededRange(hashNum(`${ign}-years`), 1, 3), signedWithTid: tid, buyoutClause: Math.round(salary * 3), rolePromise: tags.includes('Bench') ? 'bench' : 'starter', signingBonus: Math.round(salary * 0.2) },
    isStarter: !tags.includes('Bench'),
    history: [],
    seasonStats: {}
  };
  player.ovr = computePlayerOverall(player);
  return player;
}

function coreCoachRatings(seedKey) {
  const s = hashNum(seedKey);
  const make = (k, a = 45, b = 90) => seededRange(s * k, a, b);
  return { prep: make(2), mapPool: make(3), vetoSkill: make(5), compCrafting: make(7), midSeriesAdapt: make(11), practiceDesign: make(13), skillDevelopment: make(17), roleDevelopment: make(19), talentID: make(23), leadership: make(29), discipline: make(31), cultureFit: make(37), conflictMgmt: make(41), timeoutValue: make(43), clutchControl: make(47), composure: make(53), riskBalance: make(59) };
}

function slider(seed) { return Number((((seed % 201) - 100) / 100).toFixed(2)); }

export function createCoach(tid = null, role = 'Head Coach', forcedName) {
  const base = forcedName || `Coach ${uid('n')}`;
  const h = hashNum(base + tid);
  return {
    cid: uid('c'), tid, staffRole: role, salary: seededRange(h * 3, 30000, 100000),
    profile: { name: base, age: seededRange(h * 5, 29, 58), nationality: nationalities[h % nationalities.length], styleTag: coachStyles[h % coachStyles.length] },
    ratings: coreCoachRatings(base),
    styleSliders: { aggressionBias: slider(h * 2), structureBias: slider(h * 3), innovationBias: slider(h * 5), rookieTrust: slider(h * 7), egoManagementBias: slider(h * 11) },
    history: []
  };
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

function createTeam(seedTeam, tid) {
  const h = hashNum(seedTeam.name);
  return {
    tid,
    name: seedTeam.name,
    abbrev: seedTeam.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase(),
    region: seedTeam.region,
    tier: 'Tier 1',
    budget: 600_000 + seededRange(h * 2, 0, 300_000), cash: 600_000 + seededRange(h * 3, 0, 250_000), revenue: 0, expenses: 0,
    teamReputation: seededRange(h * 5, 45, 92), recentPerformanceScore: seededRange(h * 7, 40, 80), facilitiesLevel: 50, financialStability: 60, coachQuality: 60, rosterStrength: 60,
    wageBudget: seededRange(h * 11, 280_000, 420_000),
    monthlyLedger: [], facilities: initFacilities(), mapRatings: mapRatings(seedTeam.name), strategy: defaultStrategy(),
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
      week = week >= 16 ? 1 : week + 1;
    }
  }
  return matches.sort((a, b) => a.week - b.week);
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
  const teams = REAL_TEAM_DATABASE.map((t, tid) => createTeam(t, tid));
  const players = [];
  const coaches = [];

  REAL_TEAM_DATABASE.forEach((teamSeed, idx) => {
    const team = teams[idx];
    if (mode === 'Coach' && idx === userTid) {
      const userCoach = createCoach(team.tid, 'Head Coach', userName);
      coaches.push(userCoach);
      team.headCoachId = userCoach.cid;
    } else {
      const hc = createCoach(team.tid, 'Head Coach', teamSeed.coach);
      coaches.push(hc);
      team.headCoachId = hc.cid;
    }

    const teamPlayers = teamSeed.roster.map((spec) => createRealPlayer(spec, team.tid));
    players.push(...teamPlayers);
    team.starters = teamPlayers.filter((p) => p.isStarter).slice(0, 5).map((p) => p.pid);
  });

  return {
    rules: { allowDuplicateAgentsSameTeam: false },
    meta: { leagueName: 'Valorant Global Circuit', year, week: 1, mode, saveName, userName, godMode: true, createdAt: Date.now() },
    userTid,
    teams,
    players,
    coaches,
    strategy: { maps: Object.fromEntries(MAP_POOL.map((m) => [m.id, { defaultCompId: '', comps: [] }])), global: { defaultCompId: '', comps: [] } },
    schedule: createSchedule(teams, year),
    transactions: [],
    recommendations: [],
    negotiations: {},
    messages: [],
    facilityRequests: [],
    sponsors: { active: [], offers: initialSponsorOffers(teams), history: [] }
  };
}
