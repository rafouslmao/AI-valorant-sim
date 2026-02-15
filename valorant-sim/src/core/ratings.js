import { AGENT_ROLES, MAP_POOL, ROLES } from './constants.js';
import { clamp } from './utils.js';

const TRAIT_POOL = ['Oper Specialist', 'Entry Fearless', 'Lurker Instinct', 'Anchor Rock', 'AntiEco Farmer', 'Streaky', 'Ice Cold', 'Overheats'];

function avg(values) { return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length); }
function r(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

function baseCluster(seed = 60) {
  const span = Math.max(6, Math.round(seed * 0.22));
  return clamp(r(seed - span, seed + span), 20, 99);
}

export function createPlayerAttributes(seed = 62) {
  return {
    mechanics: {
      rawAim: baseCluster(seed + 5), tracking: baseCluster(seed + 1), firstBulletAccuracy: baseCluster(seed + 3), recoilControl: baseCluster(seed - 2), movement: baseCluster(seed), crosshairDiscipline: baseCluster(seed + 2)
    },
    utilitySkill: {
      utilityTiming: baseCluster(seed), utilityPrecision: baseCluster(seed + 1), comboSync: baseCluster(seed - 1), roleMastery: baseCluster(seed + 2),
      agentMastery: {}
    },
    decisionMaking: {
      positioning: baseCluster(seed), spacing: baseCluster(seed - 1), infoProcessing: baseCluster(seed + 2), riskControl: baseCluster(seed - 2), midRoundAdaptation: baseCluster(seed), macroUnderstanding: baseCluster(seed - 1)
    },
    mental: {
      clutch: baseCluster(seed), composure: baseCluster(seed - 2), confidence: baseCluster(seed), consistency: baseCluster(seed - 1), pressureHandling: baseCluster(seed)
    },
    teamplay: {
      communication: baseCluster(seed), initiative: baseCluster(seed), trustFollow: baseCluster(seed), supportiveness: baseCluster(seed)
    },
    physical: {
      stamina: baseCluster(seed), workEthic: baseCluster(seed + 1), adaptability: baseCluster(seed)
    }
  };
}

export function ensureRoleMastery(player) {
  if (!player.roleMastery) {
    player.roleMastery = Object.fromEntries(ROLES.map((role) => [role, clamp(player.roleSkills?.[role] ?? (role === player.currentRole ? 65 : 42), 0, 100)]));
  }
  for (const role of ROLES) {
    if (player.roleMastery[role] == null) player.roleMastery[role] = clamp(player.roleSkills?.[role] ?? 42, 0, 100);
  }
}

export function deriveCoachSummary(coach) {
  const a = coach.attributes;
  const cluster = (obj) => Math.round(avg(Object.values(obj)));
  coach.summary = {
    prep: cluster(a.prep),
    veto: cluster(a.veto),
    leadership: cluster(a.leadership),
    development: cluster(a.development),
    pauseImpact: cluster(a.pauseImpact)
  };
  return coach.summary;
}

export function ensureCoachAttributes(coach) {
  if (!coach.attributes) {
    const legacy = coach.ratings || {};
    const v = (k, fb = 60) => clamp(legacy[k] ?? fb, 0, 100);
    coach.attributes = {
      prep: { opponentResearch: v('prep'), antiStratQuality: v('mapPool'), gameplanClarity: v('compCrafting'), setPlayDepth: v('midSeriesAdapt') },
      veto: { mapPoolRead: v('mapPool'), opponentMapRead: v('vetoSkill'), compTheory: v('compCrafting'), riskAppetite: v('riskBalance') },
      leadership: { motivation: v('leadership'), discipline: v('discipline'), conflictManagement: v('conflictMgmt'), cultureBuilding: v('cultureFit') },
      development: { mechanicsTraining: v('practiceDesign'), roleCoaching: v('roleDevelopment'), vodReviewQuality: v('skillDevelopment'), scouting: v('talentID') },
      pauseImpact: { pauseTiming: v('timeoutValue'), calmRestore: v('composure'), adjustmentQuality: v('clutchControl') }
    };
  }
  deriveCoachSummary(coach);
}

function normalizeLegacyAttributes(player) {
  if (player.attributes) return;
  const a = player.attrs || { aim: 55, utility: 55, clutch: 55, mental: 55, teamwork: 55, decisionMaking: 55 };
  const created = createPlayerAttributes(Math.round(avg(Object.values(a))));
  created.mechanics.rawAim = clamp(a.aim + 4, 0, 100);
  created.mechanics.firstBulletAccuracy = clamp(a.aim + 2, 0, 100);
  created.utilitySkill.utilityTiming = clamp(a.utility, 0, 100);
  created.utilitySkill.utilityPrecision = clamp(a.utility, 0, 100);
  created.mental.clutch = clamp(a.clutch, 0, 100);
  created.mental.composure = clamp(a.mental, 0, 100);
  created.decisionMaking.infoProcessing = clamp(a.decisionMaking, 0, 100);
  created.teamplay.communication = clamp(a.teamwork, 0, 100);
  player.attributes = created;
}

function ensureTraits(player) {
  if (!Array.isArray(player.traits) || !player.traits.length) {
    const count = r(2, 4);
    player.traits = [...TRAIT_POOL].sort(() => Math.random() - 0.5).slice(0, count);
  }
}

function applyTraitModifier(base, traits, key) {
  let v = base;
  const has = (t) => traits.includes(t);
  if (key === 'opImpact' && has('Oper Specialist')) v += 7;
  if (key === 'entryPower' && has('Entry Fearless')) v += 6;
  if (key === 'infoValue' && has('Lurker Instinct')) v += 5;
  if (key === 'anchorValue' && has('Anchor Rock')) v += 6;
  if (key === 'rifleImpact' && has('AntiEco Farmer')) v += 3;
  if (key === 'clutchImpact' && has('Ice Cold')) v += 8;
  if (key === 'consistency' && has('Streaky')) v -= 8;
  if (key === 'consistency' && has('Overheats')) v -= 5;
  return v;
}

export function computeDerivedRatings(player, context = {}) {
  normalizeLegacyAttributes(player);
  ensureRoleMastery(player);
  ensureTraits(player);
  const at = player.attributes;
  const role = player.currentRole || player.preferredRole || 'Flex';
  const roleMastery = clamp((player.roleMastery?.[role] ?? 50), 0, 100) / 100;
  const affinityValues = Object.values(player.agentPool?.affinities || {});
  const agentAffinity = affinityValues.length ? avg(affinityValues) / 100 : 0.55;
  const fatigue = clamp(context.fatigue ?? 0, 0, 100);
  const stamina = at.physical.stamina / 100;
  const fatigueMult = clamp(1 - (fatigue / 180) * (1.15 - stamina * 0.4), 0.72, 1.05);
  const pressureMult = context.isPlayoffs ? clamp(0.88 + at.mental.pressureHandling / 220, 0.86, 1.2) : 1;
  const consistency = clamp(applyTraitModifier(at.mental.consistency, player.traits, 'consistency'), 0, 100);
  const confidenceMult = clamp(0.92 + at.mental.confidence / 240 + consistency / 420, 0.85, 1.3);
  const rolePenalty = player.roleLearning?.remaining > 0 && player.roleLearning?.role === role ? (1 - (player.roleLearning.penalty || 0.12)) : 1;

  const mech = avg(Object.values(at.mechanics));
  const util = avg([at.utilitySkill.utilityTiming, at.utilitySkill.utilityPrecision, at.utilitySkill.comboSync, at.utilitySkill.roleMastery]);
  const decision = avg(Object.values(at.decisionMaking));
  const mentalCore = avg([at.mental.clutch, at.mental.composure, at.mental.pressureHandling]);
  const teamplay = avg(Object.values(at.teamplay));

  const raw = {
    rifleImpact: mech * 0.58 + decision * 0.2 + at.mechanics.recoilControl * 0.22,
    opImpact: at.mechanics.firstBulletAccuracy * 0.38 + at.mechanics.crosshairDiscipline * 0.32 + at.mental.composure * 0.3,
    entryPower: at.mechanics.movement * 0.33 + at.mental.confidence * 0.22 + at.decisionMaking.positioning * 0.25 + at.teamplay.initiative * 0.2,
    tradeReliability: at.teamplay.communication * 0.35 + at.teamplay.trustFollow * 0.3 + at.decisionMaking.spacing * 0.35,
    clutchImpact: at.mental.clutch * 0.48 + at.mental.composure * 0.3 + at.decisionMaking.riskControl * 0.22,
    utilityValue: util * 0.62 + at.decisionMaking.infoProcessing * 0.22 + at.teamplay.supportiveness * 0.16,
    infoValue: at.decisionMaking.infoProcessing * 0.45 + at.teamplay.communication * 0.3 + at.decisionMaking.macroUnderstanding * 0.25,
    anchorValue: at.decisionMaking.positioning * 0.35 + at.mental.consistency * 0.25 + at.teamplay.supportiveness * 0.2 + at.utilitySkill.utilityTiming * 0.2,
    iglValue: at.decisionMaking.macroUnderstanding * 0.34 + at.teamplay.communication * 0.28 + at.decisionMaking.midRoundAdaptation * 0.22 + at.mental.composure * 0.16,
    adaptationScore: at.decisionMaking.midRoundAdaptation * 0.5 + at.physical.adaptability * 0.25 + at.utilitySkill.comboSync * 0.25,
    consistency
  };

  const derived = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'consistency') continue;
    let score = v;
    score = applyTraitModifier(score, player.traits, k);
    score *= (0.86 + roleMastery * 0.14) * (0.84 + agentAffinity * 0.16) * fatigueMult * pressureMult * confidenceMult * rolePenalty;
    derived[k] = clamp(Math.round(score), 0, 100);
  }
  derived.consistency = clamp(Math.round(raw.consistency), 0, 100);
  player.derived = derived;
  const ovr = avg([derived.rifleImpact, derived.entryPower, derived.utilityValue, derived.clutchImpact, derived.adaptationScore]);
  player.ovr = clamp(Math.round(ovr), 0, 100);
  player.attrs = player.attrs || {
    aim: Math.round(avg([at.mechanics.rawAim, at.mechanics.tracking, at.mechanics.firstBulletAccuracy])),
    utility: Math.round(avg([at.utilitySkill.utilityTiming, at.utilitySkill.utilityPrecision])),
    clutch: at.mental.clutch,
    mental: Math.round(avg([at.mental.composure, at.mental.confidence, at.mental.pressureHandling])),
    teamwork: Math.round(avg(Object.values(at.teamplay))),
    decisionMaking: Math.round(avg(Object.values(at.decisionMaking)))
  };
  return player.derived;
}

export function ensurePlayerSystems(player, teamContext = {}) {
  normalizeLegacyAttributes(player);
  ensureTraits(player);
  ensureRoleMastery(player);
  if (!player.primaryRole) player.primaryRole = player.preferredRole || player.currentRole || 'Flex';
  if (!player.preferredRole) player.preferredRole = player.primaryRole;
  if (!player.currentRole) player.currentRole = player.primaryRole;
  if (!player.attributes.utilitySkill.agentMastery) player.attributes.utilitySkill.agentMastery = {};
  for (const role of ROLES) {
    const agents = AGENT_ROLES[role] || [];
    for (const agent of agents) {
      if (player.attributes.utilitySkill.agentMastery[agent] == null) {
        player.attributes.utilitySkill.agentMastery[agent] = clamp((player.agentPool?.affinities?.[agent] ?? 45), 0, 100);
      }
    }
  }
  if (!player.roleLearning) player.roleLearning = null;
  computeDerivedRatings(player, teamContext);
}

export function mapFamiliarityTemplate() {
  return Object.fromEntries(MAP_POOL.map((m) => [m.id, 35]));
}

export function getTraitPool() { return TRAIT_POOL.slice(); }
