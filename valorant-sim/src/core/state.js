import { ROLES } from './constants.js';
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
  if (!player.currentContract) {
    player.currentContract = { salaryPerYear: player.salary, yearsRemaining: 2, signedWithTid: player.tid, buyoutClause: player.salary * 3, rolePromise: 'starter', signingBonus: Math.round(player.salary * 0.15) };
  }
}

function ensureCoachShape(coach) {
  if (!coach.profile) {
    coach.profile = { name: coach.name || 'Unknown Coach', age: 35, nationality: 'INT', styleTag: 'Structured' };
    delete coach.name;
  }
  if (!coach.ratings) {
    coach.ratings = { prep: 60, mapPool: 60, vetoSkill: 60, compCrafting: 60, midSeriesAdapt: 60, practiceDesign: 60, skillDevelopment: 60, roleDevelopment: 60, talentID: 60, leadership: 60, discipline: 60, cultureFit: 60, conflictMgmt: 60, timeoutValue: 60, clutchControl: 60, composure: 60, riskBalance: 60 };
  }
  if (!coach.styleSliders) coach.styleSliders = { aggressionBias: 0, structureBias: 0, innovationBias: 0, rookieTrust: 0, egoManagementBias: 0 };
  if (!coach.staffRole) coach.staffRole = 'Head Coach';
  if (!coach.salary) coach.salary = 35000;
}

function ensureTeamShape(team) {
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
}

export function normalizeWorld(world) {
  if (!world) return world;
  world.players?.forEach(ensurePlayerShape);
  world.coaches?.forEach(ensureCoachShape);
  world.teams?.forEach(ensureTeamShape);
  if (!world.recommendations) world.recommendations = [];
  if (!world.negotiations) world.negotiations = {};
  return world;
}

let world = normalizeWorld(loadFromSlot());

export function getWorld() {
  return world;
}

export function setWorld(next) {
  world = normalizeWorld(next);
  if (world) saveToSlot(world);
}

export function mutateWorld(mutator) {
  if (!world) return;
  mutator(world);
  normalizeWorld(world);
  saveToSlot(world);
}

export function clearWorld() {
  world = null;
}
