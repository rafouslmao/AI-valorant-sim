import { ROLES } from './constants.js';
import { loadFromSlot, saveToSlot } from './storage.js';

function ensurePlayerShape(player) {
  if (!player.roles) player.roles = player.role ? [player.role] : [ROLES[0]];
  if (!player.currentRole) player.currentRole = player.roles[0];
  if (!player.secondaryRoles) player.secondaryRoles = [];
  if (!player.salary) player.salary = 25000;
}

function ensureCoachShape(coach) {
  if (!coach.profile) {
    coach.profile = { name: coach.name || 'Unknown Coach', age: 35, nationality: 'INT', styleTag: 'Structured' };
    delete coach.name;
  }
  if (!coach.ratings) {
    coach.ratings = { prep: 60, mapPool: 60, vetoSkill: 60, compCrafting: 60, midSeriesAdapt: 60, practiceDesign: 60, skillDevelopment: 60, roleDevelopment: 60, talentID: 60, leadership: 60, discipline: 60, cultureFit: 60, conflictMgmt: 60, timeoutValue: 60, clutchControl: 60, composure: 60, riskBalance: 60 };
  }
  if (!coach.styleSliders) {
    coach.styleSliders = { aggressionBias: 0, structureBias: 0, innovationBias: 0, rookieTrust: 0, egoManagementBias: 0 };
  }
  if (!coach.staffRole) coach.staffRole = 'Head Coach';
  if (!coach.salary) coach.salary = 35000;
}

function ensureTeamShape(team) {
  if (!team.monthlyLedger) team.monthlyLedger = [];
  if (!team.chemistry) team.chemistry = 50;
  if (!team.morale) team.morale = 50;
  if (!team.fatigue) team.fatigue = 0;
}

export function normalizeWorld(world) {
  if (!world) return world;
  world.players?.forEach(ensurePlayerShape);
  world.coaches?.forEach(ensureCoachShape);
  world.teams?.forEach(ensureTeamShape);
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
