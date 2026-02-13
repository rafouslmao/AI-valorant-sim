import { FACILITY_CONFIG, PRACTICE_FOCUS, ROLES, SECONDARY_ROLE_TAGS, TEAMS } from './constants.js';
import { randInt, uid, weightedPick } from './utils.js';

const firstNames = ['Alex', 'Mina', 'Sora', 'Jett', 'Kai', 'Leo', 'Yuna', 'Noah', 'Ari', 'Iris', 'Mako', 'Rin'];
const lastNames = ['Park', 'Smith', 'Kim', 'Garcia', 'Brown', 'Khan', 'Rossi', 'Tan', 'Dubois', 'Silva'];
const nationalities = ['KR', 'US', 'BR', 'SE', 'DE', 'PL', 'JP', 'CN', 'FR', 'ES'];
const coachStyles = ['Structured', 'Loose', 'Reactive', 'Prep-heavy'];

function genName() {
  return `${firstNames[randInt(0, firstNames.length - 1)]} ${lastNames[randInt(0, lastNames.length - 1)]}`;
}

function genAttributes() {
  return {
    aim: randInt(50, 95),
    utility: randInt(45, 95),
    clutch: randInt(40, 95),
    mental: randInt(50, 95),
    teamwork: randInt(45, 95)
  };
}

export function computePlayerOverall(player) {
  const attrs = player.attrs;
  return Math.round(attrs.aim * 0.3 + attrs.utility * 0.2 + attrs.clutch * 0.2 + attrs.mental * 0.15 + attrs.teamwork * 0.15);
}

function pickSecondaryRoles() {
  const tags = [...SECONDARY_ROLE_TAGS].sort(() => Math.random() - 0.5);
  return tags.slice(0, randInt(1, 3));
}

export function createPlayer(tid) {
  const primaryRole = weightedPick(ROLES.map((role) => ({ value: role, weight: role === 'Flex' ? 0.7 : 1 })));
  const secondaryRole = weightedPick(ROLES.map((role) => ({ value: role, weight: role !== primaryRole ? 1 : 0.2 })));
  const roleSkills = Object.fromEntries(ROLES.map((r) => [r, randInt(r === primaryRole ? 50 : 25, r === primaryRole ? 90 : 72)]));
  const player = {
    pid: uid('p'),
    tid,
    name: genName(),
    age: randInt(17, 29),
    salary: randInt(18_000, 55_000),
    attrs: genAttributes(),
    roles: [...new Set([primaryRole, secondaryRole])],
    currentRole: primaryRole,
    secondaryRoles: pickSecondaryRoles(),
    roleSkills,
    history: []
  };
  player.ovr = computePlayerOverall(player);
  return player;
}

function coreCoachRatings() {
  return {
    prep: randInt(40, 95),
    mapPool: randInt(40, 95),
    vetoSkill: randInt(40, 95),
    compCrafting: randInt(40, 95),
    midSeriesAdapt: randInt(40, 95),
    practiceDesign: randInt(40, 95),
    skillDevelopment: randInt(40, 95),
    roleDevelopment: randInt(40, 95),
    talentID: randInt(40, 95),
    leadership: randInt(40, 95),
    discipline: randInt(40, 95),
    cultureFit: randInt(40, 95),
    conflictMgmt: randInt(40, 95),
    timeoutValue: randInt(40, 95),
    clutchControl: randInt(40, 95),
    composure: randInt(40, 95),
    riskBalance: randInt(40, 95)
  };
}

function slider() {
  return Number((Math.random() * 2 - 1).toFixed(2));
}

export function createCoach(tid = null, role = 'Head Coach') {
  return {
    cid: uid('c'),
    tid,
    staffRole: role,
    salary: randInt(22_000, 90_000),
    profile: {
      name: genName(),
      age: randInt(28, 58),
      nationality: nationalities[randInt(0, nationalities.length - 1)],
      styleTag: coachStyles[randInt(0, coachStyles.length - 1)]
    },
    ratings: coreCoachRatings(),
    styleSliders: {
      aggressionBias: slider(),
      structureBias: slider(),
      innovationBias: slider(),
      rookieTrust: slider(),
      egoManagementBias: slider()
    },
    history: []
  };
}

function initFacilities() {
  const facilities = {};
  for (const [key, cfg] of Object.entries(FACILITY_CONFIG)) {
    facilities[key] = { level: 1, baseCost: cfg.baseCost, baseMaintenance: cfg.baseMaintenance, maxLevel: cfg.maxLevel };
  }
  return facilities;
}

function createTeam(teamInfo) {
  return {
    ...teamInfo,
    budget: 600_000 + randInt(0, 300_000),
    cash: 600_000 + randInt(0, 250_000),
    revenue: 0,
    expenses: 0,
    monthlyLedger: [],
    facilities: initFacilities(),
    practicePlan: { focus: PRACTICE_FOCUS[0], intensity: 'normal' },
    wins: 0,
    losses: 0,
    chemistry: 50,
    morale: 50,
    fatigue: 0
  };
}

function createSchedule(teams, year) {
  const matches = [];
  let week = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({ mid: uid('m'), week, season: year, homeTid: teams[i].tid, awayTid: teams[j].tid, played: false, result: null });
      week = week >= 12 ? 1 : week + 1;
    }
  }
  return matches.sort((a, b) => a.week - b.week);
}

export function generateWorld({ userTid, mode, saveName, userName }) {
  const year = 2027;
  const teams = TEAMS.map(createTeam);
  const players = [];
  const coaches = teams.map((t) => createCoach(t.tid, 'Head Coach'));

  for (const t of teams) {
    for (let i = 0; i < 8; i++) players.push(createPlayer(t.tid));
  }
  for (let i = 0; i < 30; i++) players.push(createPlayer(null));
  for (let i = 0; i < 25; i++) coaches.push(createCoach(null, 'Head Coach'));

  return {
    meta: {
      leagueName: 'Valorant Global Circuit',
      year,
      week: 1,
      mode,
      saveName,
      userName,
      godMode: true,
      createdAt: Date.now()
    },
    userTid,
    teams,
    players,
    coaches,
    schedule: createSchedule(teams, year),
    transactions: []
  };
}
