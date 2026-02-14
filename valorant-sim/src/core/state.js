import { ALL_AGENTS, MAP_POOL, ROLES } from './constants.js';
import { loadFromSlot, saveToSlot } from './storage.js';

function ensurePlayerShape(player) {
  if (!player.roles) player.roles = player.role ? [player.role] : [ROLES[0]];
  if (!player.currentRole) player.currentRole = player.roles[0];
  if (!player.secondaryRoleTag) player.secondaryRoleTag = 'None';
  if (!player.salary) player.salary = 25000;
  if (!player.reputation) player.reputation = 50;
  if (!player.ambition) player.ambition = 50;
  if (!player.loyalty) player.loyalty = 50;
  if (!player.greed) player.greed = 50;
  if (!player.playtimeDesire) player.playtimeDesire = 50;
  if (!player.preferredRole) player.preferredRole = player.currentRole;
  if (!player.trainingPlan) player.trainingPlan = { primaryFocus: player.currentRole, secondaryFocus: 'None', intensity: 'normal' };
  if (!player.seasonStats) player.seasonStats = {};
  if (!player.currentContract) player.currentContract = { salaryPerYear: player.salary, yearsRemaining: 2, signedWithTid: player.tid, buyoutClause: player.salary * 3, rolePromise: 'starter', signingBonus: Math.round(player.salary * 0.15) };
  if (!player.agentPool) {
    const affinities = {};
    for (let i = 0; i < 2; i++) affinities[ALL_AGENTS[(i + Math.floor(Math.random() * ALL_AGENTS.length)) % ALL_AGENTS.length]] = 60;
    player.agentPool = { primaryRole: (player.currentRole || 'flex').toLowerCase(), affinities };
  }
}

function ensureCoachShape(coach) {
  if (!coach.profile) {
    coach.profile = { name: coach.name || 'Unknown Coach', age: 35, nationality: 'INT', styleTag: 'Structured' };
    delete coach.name;
  }
  if (!coach.ratings) coach.ratings = { prep: 60, mapPool: 60, vetoSkill: 60, compCrafting: 60, midSeriesAdapt: 60, practiceDesign: 60, skillDevelopment: 60, roleDevelopment: 60, talentID: 60, leadership: 60, discipline: 60, cultureFit: 60, conflictMgmt: 60, timeoutValue: 60, clutchControl: 60, composure: 60, riskBalance: 60 };
  if (!coach.styleSliders) coach.styleSliders = { aggressionBias: 0, structureBias: 0, innovationBias: 0, rookieTrust: 0, egoManagementBias: 0 };
  if (!coach.staffRole) coach.staffRole = 'Head Coach';
  if (!coach.salary) coach.salary = 35000;
}


function ensureWorldStrategy(world) {
  if (!world.strategy) world.strategy = { maps: {}, global: { defaultCompId: '', comps: [] } };
  if (!world.strategy.maps) world.strategy.maps = {};
  for (const map of MAP_POOL) {
    if (!world.strategy.maps[map.id]) world.strategy.maps[map.id] = { defaultCompId: '', comps: [] };
  }
  if (!world.strategy.global) world.strategy.global = { defaultCompId: '', comps: [] };
}

function ensureTeamShape(team, worldPlayers) {
  if (!team.monthlyLedger) team.monthlyLedger = [];
  if (!team.chemistry) team.chemistry = 50;
  if (!team.morale) team.morale = 50;
  if (!team.fatigue) team.fatigue = 0;
  if (!team.teamReputation) team.teamReputation = 55;
  if (!team.recentPerformanceScore) team.recentPerformanceScore = 55;
  if (!team.facilitiesLevel) team.facilitiesLevel = 50;
  if (!team.financialStability) team.financialStability = 55;
  if (!team.coachQuality) team.coachQuality = 55;
  if (!team.rosterStrength) team.rosterStrength = 55;
  if (!team.wageBudget) team.wageBudget = 320000;
  if (!team.mapRatings) team.mapRatings = {};
  if (!team.strategy) {
    team.strategy = {
      mapPreferences: Object.fromEntries(MAP_POOL.map((m) => [m.id, 'Neutral'])),
      economyRisk: 0.5,
      aggression: 0.5,
      compComfort: 0.5,
      delegateToCoach: true,
      comps: [],
      defaultCompByMap: { global: 'global' }
    };
  }

  if (!team.strategy.defaultCompByMap) team.strategy.defaultCompByMap = { global: 'global' };
  if (!Array.isArray(team.starters)) team.starters = [];
  if (team.starters.length < 5 && worldPlayers) {
    const firstFive = worldPlayers.filter((p) => p.tid === team.tid).slice(0, 5).map((p) => p.pid);
    team.starters = [...new Set([...team.starters, ...firstFive])].slice(0, 5);
  }
}

export function normalizeWorld(world) {
  if (!world) return world;
  world.players?.forEach(ensurePlayerShape);
  world.coaches?.forEach(ensureCoachShape);
  world.teams?.forEach((team) => ensureTeamShape(team, world.players));
  world.schedule?.forEach((m) => {
    if (!m.status) m.status = m.played ? 'final' : 'scheduled';
    if (!('live' in m)) m.live = null;
  });
  if (!world.recommendations) world.recommendations = [];
  if (!world.negotiations) world.negotiations = {};
  if (!world.messages) world.messages = [];
  if (!world.facilityRequests) world.facilityRequests = [];
  if (!world.sponsors) world.sponsors = { active: [], offers: [], history: [] };
  if (!world.rules) world.rules = { allowDuplicateAgentsSameTeam: false };
  ensureWorldStrategy(world);
  world.messages?.forEach((m) => {
    if (!m.details) m.details = { bullets: [], stats: [], links: [], tags: [] };
    m.details.bullets = Array.isArray(m.details.bullets) ? m.details.bullets : [];
    m.details.stats = Array.isArray(m.details.stats) ? m.details.stats : [];
    m.details.links = Array.isArray(m.details.links) ? m.details.links : [];
    m.details.tags = Array.isArray(m.details.tags) ? m.details.tags : [];
  });
  return world;
}

let world = normalizeWorld(loadFromSlot());

export function getWorld() { return world; }

export function setWorld(next) {
  world = normalizeWorld(next);
}

export function persistWorld() {
  if (world) saveToSlot(world);
}

export function mutateWorld(mutator) {
  if (!world) return;
  mutator(world);
  normalizeWorld(world);
  saveToSlot(world);
}

export function clearWorld() { world = null; }
