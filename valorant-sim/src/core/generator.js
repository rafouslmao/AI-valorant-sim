import { PRACTICE_FOCUS, ROLES, TEAMS } from './constants.js';
import { randInt, uid, weightedPick } from './utils.js';

const firstNames = ['Alex', 'Mina', 'Sora', 'Jett', 'Kai', 'Leo', 'Yuna', 'Noah', 'Ari', 'Iris', 'Mako', 'Rin'];
const lastNames = ['Park', 'Smith', 'Kim', 'Garcia', 'Brown', 'Khan', 'Rossi', 'Tan', 'Dubois', 'Silva'];

function genName() {
  return `${firstNames[randInt(0, firstNames.length - 1)]} ${lastNames[randInt(0, lastNames.length - 1)]}`;
}

function genAttributes() {
  return {
    aim: randInt(50, 95),
    utility: randInt(45, 95),
    clutch: randInt(40, 95),
    mental: randInt(50, 95),
    teamwork: randInt(45, 95),
  };
}

export function computePlayerOverall(player) {
  const attrs = player.attrs;
  return Math.round((attrs.aim * 0.3 + attrs.utility * 0.2 + attrs.clutch * 0.2 + attrs.mental * 0.15 + attrs.teamwork * 0.15));
}

export function createPlayer(tid) {
  const primaryRole = weightedPick(ROLES.map((role) => ({ value: role, weight: role === 'Flex' ? 0.7 : 1 })));
  const roleSkills = Object.fromEntries(ROLES.map((r) => [r, randInt(r === primaryRole ? 50 : 25, r === primaryRole ? 90 : 70)]));
  const player = {
    pid: uid('p'),
    tid,
    name: genName(),
    age: randInt(17, 29),
    attrs: genAttributes(),
    role: primaryRole,
    roleSkills,
    history: []
  };
  player.ovr = computePlayerOverall(player);
  return player;
}

function createCoach(tid) {
  return {
    cid: uid('c'),
    tid,
    name: genName(),
    attrs: {
      tactics: randInt(45, 95),
      discipline: randInt(45, 95),
      scouting: randInt(45, 95)
    },
    history: []
  };
}

function createTeam(teamInfo) {
  return {
    ...teamInfo,
    budget: 600_000 + randInt(0, 300_000),
    cash: 600_000 + randInt(0, 250_000),
    revenue: 0,
    expenses: 0,
    facilities: {
      level: 1,
      nextCost: 150_000,
      bonus: 0.02
    },
    practicePlan: {
      focus: PRACTICE_FOCUS[0],
      intensity: 'normal'
    },
    wins: 0,
    losses: 0
  };
}

function createSchedule(teams, year) {
  const matches = [];
  let week = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        mid: uid('m'),
        week,
        season: year,
        homeTid: teams[i].tid,
        awayTid: teams[j].tid,
        played: false,
        result: null
      });
      week = week >= 12 ? 1 : week + 1;
    }
  }
  return matches.sort((a, b) => a.week - b.week);
}

export function generateWorld({ userTid, mode, saveName, userName }) {
  const year = 2027;
  const teams = TEAMS.map(createTeam);
  const players = [];
  const coaches = teams.map((t) => createCoach(t.tid));

  for (const t of teams) {
    for (let i = 0; i < 8; i++) {
      players.push(createPlayer(t.tid));
    }
  }
  for (let i = 0; i < 20; i++) {
    players.push(createPlayer(null));
  }

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
