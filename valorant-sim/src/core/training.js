import { clamp } from './utils.js';

function attrKeyFromSecondary(secondary) {
  if (secondary === 'Aim') return 'aim';
  if (secondary === 'Clutch') return 'clutch';
  if (secondary === 'Utility usage') return 'utility';
  if (secondary === 'Mental resilience') return 'mental';
  if (secondary === 'Decision making') return 'decisionMaking';
  return null;
}

export function applyWeeklyTraining(state, tid, facilitiesModifier = 1, coachSkillModifier = 1) {
  const team = state.teams.find((t) => t.tid === tid);
  const roster = state.players.filter((p) => p.tid === tid);
  for (const player of roster) {
    const plan = player.trainingPlan || { primaryFocus: player.currentRole, secondaryFocus: 'None', intensity: 'normal' };
    const intensityModifier = plan.intensity === 'hard' ? 1.3 : plan.intensity === 'light' ? 0.85 : 1;
    const moraleModifier = clamp((team.morale || 50) / 50, 0.75, 1.25);
    const growth = 0.45 * facilitiesModifier * coachSkillModifier * intensityModifier * moraleModifier;

    if (player.roleSkills[plan.primaryFocus] !== undefined) {
      player.roleSkills[plan.primaryFocus] = clamp(player.roleSkills[plan.primaryFocus] + growth * 1.6, 20, 99);
      if (!player.roles.includes(plan.primaryFocus)) {
        player.roles.push(plan.primaryFocus);
        player.roleSkills[plan.primaryFocus] = clamp(25 + growth * 2, 20, 99);
      }
    }

    const attrKey = attrKeyFromSecondary(plan.secondaryFocus);
    if (attrKey) {
      player.attrs[attrKey] = clamp(player.attrs[attrKey] + growth * 0.8, 20, 99);
    } else if (player.roleSkills[plan.secondaryFocus] !== undefined) {
      player.roleSkills[plan.secondaryFocus] = clamp(player.roleSkills[plan.secondaryFocus] + growth * 0.8, 20, 99);
    }

    team.fatigue = clamp((team.fatigue || 0) + (plan.intensity === 'hard' ? 4 : plan.intensity === 'normal' ? 2 : 1), 0, 100);
    player.history.push(`Week ${state.meta.week}: training ${plan.primaryFocus}/${plan.secondaryFocus}/${plan.intensity}`);
  }
}

export function projectedTrainingImpact(player, team) {
  const plan = player.trainingPlan || { primaryFocus: player.currentRole, secondaryFocus: 'None', intensity: 'normal' };
  const fatigueDelta = plan.intensity === 'hard' ? 4 : plan.intensity === 'normal' ? 2 : 1;
  const base = plan.intensity === 'hard' ? 1.2 : plan.intensity === 'light' ? 0.7 : 1;
  return {
    growthEstimate: Number((base * (team.morale / 50)).toFixed(2)),
    fatigueDelta
  };
}
