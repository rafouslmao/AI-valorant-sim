import { clamp } from './utils.js';
import { computeDerivedRatings } from './ratings.js';

function decay(value) {
  return clamp((100 - value) / 100, 0.05, 1);
}

function coachDevelopmentBoost(state, tid) {
  const coach = state.coaches.find((c) => c.tid === tid && c.staffRole === 'Head Coach');
  const dev = coach?.summary?.development ?? 55;
  return 0.8 + dev / 180;
}

function facilityBoost(team) {
  const lvl = Object.values(team.facilities || {}).reduce((sum, f) => sum + (f.level || 1), 0) / Math.max(1, Object.keys(team.facilities || {}).length);
  return 0.85 + lvl / 10;
}

function agePotentialFactor(player) {
  const age = player.age || 21;
  const youth = age <= 20 ? 1.2 : age <= 24 ? 1.05 : age <= 28 ? 0.95 : 0.82;
  return youth;
}

function applyFocus(player, focus, gain) {
  const at = player.attributes;
  if (focus === 'Mechanics') {
    for (const k of Object.keys(at.mechanics)) at.mechanics[k] = clamp(at.mechanics[k] + gain * decay(at.mechanics[k]), 0, 100);
  } else if (focus === 'Utility') {
    for (const k of ['utilityTiming', 'utilityPrecision', 'comboSync']) at.utilitySkill[k] = clamp(at.utilitySkill[k] + gain * decay(at.utilitySkill[k]), 0, 100);
  } else if (focus === 'Decision') {
    for (const k of Object.keys(at.decisionMaking)) at.decisionMaking[k] = clamp(at.decisionMaking[k] + gain * decay(at.decisionMaking[k]), 0, 100);
  } else if (focus === 'Mental') {
    for (const k of Object.keys(at.mental)) at.mental[k] = clamp(at.mental[k] + gain * decay(at.mental[k]), 0, 100);
  } else if (focus === 'Role mastery') {
    const role = player.primaryRole || player.currentRole;
    player.roleMastery[role] = clamp(player.roleMastery[role] + gain * 1.35 * decay(player.roleMastery[role]), 0, 100);
    at.utilitySkill.roleMastery = clamp(at.utilitySkill.roleMastery + gain * 0.8 * decay(at.utilitySkill.roleMastery), 0, 100);
  } else if (focus === 'Agent mastery') {
    for (const agent of Object.keys(player.attributes.utilitySkill.agentMastery).slice(0, 3)) {
      const v = player.attributes.utilitySkill.agentMastery[agent];
      player.attributes.utilitySkill.agentMastery[agent] = clamp(v + gain * 1.1 * decay(v), 0, 100);
    }
  } else if (focus === 'Teamwork') {
    for (const k of Object.keys(at.teamplay)) at.teamplay[k] = clamp(at.teamplay[k] + gain * decay(at.teamplay[k]), 0, 100);
  }
}

export function applyWeeklyTraining(state, tid, facilitiesModifier = 1, coachSkillModifier = 1) {
  const team = state.teams.find((t) => t.tid === tid);
  const roster = state.players.filter((p) => p.tid === tid);
  const coachBoost = coachDevelopmentBoost(state, tid) * coachSkillModifier;
  const fac = facilityBoost(team) * facilitiesModifier;
  for (const player of roster) {
    const plan = player.trainingPlan || { primaryFocus: player.currentRole, secondaryFocus: 'None', intensity: 'normal' };
    const intensityModifier = plan.intensity === 'hard' ? 1.3 : plan.intensity === 'light' ? 0.8 : 1;
    const physical = player.attributes?.physical || { workEthic: 55, adaptability: 55, stamina: 55 };
    const worker = 0.85 + (physical.workEthic / 220) + (physical.adaptability / 280);
    const baseGain = 1.45 * intensityModifier * coachBoost * fac * worker * agePotentialFactor(player);

    applyFocus(player, plan.primaryFocus, baseGain);
    if (plan.secondaryFocus && plan.secondaryFocus !== 'None') applyFocus(player, plan.secondaryFocus, baseGain * 0.55);

    if (player.roleLearning?.remaining > 0) {
      player.roleLearning.remaining -= 1;
      player.roleMastery[player.roleLearning.role] = clamp((player.roleMastery[player.roleLearning.role] || 45) + 1.6 * intensityModifier, 0, 100);
      if (player.roleLearning.remaining <= 0) player.roleLearning = null;
    }

    team.fatigue = clamp((team.fatigue || 0) + (plan.intensity === 'hard' ? 4 : plan.intensity === 'normal' ? 2 : 1), 0, 100);
    if (plan.primaryFocus === 'Teamwork') team.teamCohesion = clamp((team.teamCohesion || 50) + 1.4, 0, 100);
    computeDerivedRatings(player, { fatigue: team.fatigue, isPlayoffs: false });
    player.history.push(`Week ${state.meta.week}: training ${plan.primaryFocus}/${plan.secondaryFocus}/${plan.intensity}`);
  }
}

export function projectedTrainingImpact(player, team) {
  const plan = player.trainingPlan || { primaryFocus: player.currentRole, secondaryFocus: 'None', intensity: 'normal' };
  const fatigueDelta = plan.intensity === 'hard' ? 4 : plan.intensity === 'normal' ? 2 : 1;
  const base = plan.intensity === 'hard' ? 1.25 : plan.intensity === 'light' ? 0.75 : 1;
  return {
    growthEstimate: Number((base * ((team.morale || 50) / 50)).toFixed(2)),
    fatigueDelta
  };
}
