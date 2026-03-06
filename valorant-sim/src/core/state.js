import { ALL_AGENTS, MAP_POOL, ROLES } from './constants.js';
import { computeDerivedRatings, ensureCoachAttributes, ensurePlayerSystems, mapFamiliarityTemplate } from './ratings.js';
import { loadFromSlot, saveToSlot } from './storage.js';

function normalizePlayerOvrFields(player) {
  if (player.ovrAttack == null && player.ovrs?.attack != null) player.ovrAttack = player.ovrs.attack;
  if (player.ovrDefense == null && player.ovrs?.defense != null) player.ovrDefense = player.ovrs.defense;
  if (player.ovr == null && player.ovrs?.overall != null) player.ovr = player.ovrs.overall;
  if (player.ovr == null && player.ovrAttack != null && player.ovrDefense != null) {
    player.ovr = Math.round(player.ovrAttack * 0.52 + player.ovrDefense * 0.48);
  }
}

function ensurePlayerShape(player) {
  if (!player.roles) player.roles = player.role ? [player.role] : [ROLES[0]];
  if (!player.currentRole) player.currentRole = player.roles[0];
  if (!player.secondaryRoleTag) player.secondaryRoleTag = 'None';
  if (!player.salary) player.salary = 25000;
  if (!player.age) player.age = 20;
  if (!player.nationality) player.nationality = 'UNKNOWN';
  if (!player.imageURL) player.imageURL = '';
  if (!player.reputation) player.reputation = 50;
  if (!player.ambition) player.ambition = 50;
  if (!player.loyalty) player.loyalty = 50;
  if (!player.greed) player.greed = 50;
  if (!player.playtimeDesire) player.playtimeDesire = 50;
  if (!player.preferredRole) player.preferredRole = player.currentRole;
  if (!player.trainingPlan) player.trainingPlan = { primaryFocus: 'Mechanics', secondaryFocus: 'Role mastery', intensity: 'normal', roleFocus: player.currentRole || 'Flex' };
  if (!player.trainingPlan.roleFocus) player.trainingPlan.roleFocus = player.currentRole || 'Flex';
  if (!player.seasonStats) player.seasonStats = {};
  if (!player.currentContract) player.currentContract = { salaryPerYear: player.salary, yearsRemaining: 2, signedWithTid: player.tid, buyoutClause: player.salary * 3, rolePromise: 'starter', signingBonus: Math.round(player.salary * 0.15) };
  if (!player.agentPool) {
    const affinities = {};
    for (let i = 0; i < 2; i++) affinities[ALL_AGENTS[(i + Math.floor(Math.random() * ALL_AGENTS.length)) % ALL_AGENTS.length]] = 60;
    player.agentPool = { primaryRole: (player.currentRole || 'flex').toLowerCase(), affinities };
  }
  if (!player.roleFamiliarity) player.roleFamiliarity = Object.fromEntries(ROLES.map((r) => [r, Math.max(20, Math.round(player.roleSkills?.[r] ?? 45))]));
  for (const r of ROLES) if (player.roleFamiliarity[r] == null) player.roleFamiliarity[r] = Math.max(20, Math.round(player.roleSkills?.[r] ?? 45));
  normalizePlayerOvrFields(player);
  ensurePlayerSystems(player, {});
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
  ensureCoachAttributes(coach);
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
  if (!team.yearlyBudget) team.yearlyBudget = team.budget || 300000;
  if (!team.elo) team.elo = team.tier === 'Tier 2' ? 1250 : 1500;
  if (!team.circuitPoints) team.circuitPoints = 0;
  if (!team.eventsPlayedThisYear) team.eventsPlayedThisYear = 0;
  if (!team.winnings) team.winnings = 0;
  if (!team.expensesTravel) team.expensesTravel = 0;
  if (!team.expensesSalaries) team.expensesSalaries = 0;
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
  if (team.teamCohesion == null) team.teamCohesion = 55;
  if (!team.compFamiliarity) team.compFamiliarity = mapFamiliarityTemplate();
  if (!Array.isArray(team.starters)) team.starters = [];
  if (team.starters.length < 5 && worldPlayers) {
    const firstFive = worldPlayers.filter((p) => p.tid === team.tid).slice(0, 5).map((p) => p.pid);
    team.starters = [...new Set([...team.starters, ...firstFive])].slice(0, 5);
  }
}

export function normalizeWorld(world) {
  if (!world) return world;
  world.players?.forEach(ensurePlayerShape);
  const teamByTid = new Map((world.teams || []).map((t) => [t.tid, t]));
  world.players?.forEach((p) => computeDerivedRatings(p, { fatigue: teamByTid.get(p.tid)?.fatigue || 0 }));
  world.coaches?.forEach(ensureCoachShape);
  world.teams?.forEach((team) => ensureTeamShape(team, world.players));
  world.schedule?.forEach((m) => {
    if (!m.status) m.status = m.played ? 'final' : 'scheduled';
    if (!('live' in m)) m.live = null;
    if (!m.day) m.day = world.meta?.day || 1;
  });
  if (!world.recommendations) world.recommendations = [];
  if (!world.negotiations) world.negotiations = {};
  if (!world.messages) world.messages = [];
  if (!world.facilityRequests) world.facilityRequests = [];
  if (!world.sponsors) world.sponsors = { active: [], offers: [], history: [] };
  if (!world.rules) world.rules = { allowDuplicateAgentsSameTeam: true };
  if (!world.history) world.history = { seasons: {}, matches: {} };
  if (!world.history.seasons) world.history.seasons = {};
  if (!world.history.matches) world.history.matches = {};
  if (!world.eventsByYear) world.eventsByYear = {};
  if (!world.eventLog) world.eventLog = [];
  if (!('currentEventId' in world)) world.currentEventId = null;
  if (!world.meta.day) world.meta.day = 1;
  if (!world.meta.currentDay) world.meta.currentDay = world.meta.day;
  if (!('godMode' in world.meta)) world.meta.godMode = false;
  if (!('tierANoT1Streak' in world.meta)) world.meta.tierANoT1Streak = 0;
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

let world = null;

export async function hydrateWorldFromStorage() {
  const loaded = await loadFromSlot();
  world = normalizeWorld(loaded);
  return world;
}

export function getWorld() { return world; }

export function setWorld(next) {
  world = normalizeWorld(next);
}

export function persistWorld() {
  if (world) saveToSlot(world).catch(() => {});
}

export function mutateWorld(mutator) {
  if (!world) return;
  mutator(world);
  normalizeWorld(world);
  saveToSlot(world).catch(() => {});
}

export function clearWorld() { world = null; }
