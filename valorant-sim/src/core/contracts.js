import { clamp, randInt, uid } from './utils.js';
import { addMessage } from './messages.js';

function teamSnapshot(state, tid) {
  const team = state.teams.find((t) => t.tid === tid);
  const coach = state.coaches.find((c) => c.tid === tid && c.staffRole === 'Head Coach');
  return {
    team,
    teamReputation: team.teamReputation ?? 55,
    rosterStrength: team.rosterStrength ?? 55,
    facilitiesLevel: team.facilitiesLevel ?? 50,
    financialStability: team.financialStability ?? 55,
    coachQuality: coach ? Math.round((coach.ratings.prep + coach.ratings.leadership + coach.ratings.skillDevelopment) / 3) : 55
  };
}

export function marketValue(player) {
  const primeFactor = player.age <= 24 ? 1.08 : player.age <= 28 ? 1 : 0.9;
  const perf = (player.ovr + player.reputation) / 2;
  return Math.round((18000 + perf * 650) * primeFactor);
}

function rolePromiseMatch(player, rolePromise) {
  if (rolePromise === 'starter') return 1;
  return 1 - clamp(player.playtimeDesire / 110, 0, 0.8);
}

export function evaluateOffer(player, teamContext, offer, currentTid) {
  const minValue = marketValue(player);
  const salaryFactor = clamp(offer.salary / minValue, 0.5, 1.8);
  const yearsFactor = clamp(offer.years / 3, 0.5, 1.2);
  const bonusFactor = clamp(offer.signingBonus / Math.max(1, minValue * 0.3), 0, 1.5);
  const roleScore = rolePromiseMatch(player, offer.rolePromise);
  const loyaltyBonus = currentTid === teamContext.team.tid ? player.loyalty / 100 : 0;
  const financePenalty = teamContext.financialStability < 40 ? -0.2 : 0;

  const moneyW = 0.25 + player.greed / 220;
  const prestigeW = 0.15 + player.ambition / 260;
  const winningW = 0.15 + player.ambition / 240;
  const devW = 0.10 + (100 - player.age * 3) / 500;
  const coachW = 0.08;
  const playtimeW = 0.12 + player.playtimeDesire / 260;
  const loyaltyW = player.loyalty / 600;

  const score = (
    moneyW * salaryFactor +
    0.05 * yearsFactor +
    0.05 * bonusFactor +
    prestigeW * (teamContext.teamReputation / 100) +
    winningW * (teamContext.rosterStrength / 100) +
    devW * (teamContext.facilitiesLevel / 100) +
    coachW * (teamContext.coachQuality / 100) +
    playtimeW * roleScore +
    loyaltyW * loyaltyBonus +
    financePenalty +
    (Math.random() - 0.5) * 0.15
  );

  const reasons = [];
  if (offer.salary < minValue * 0.9) reasons.push('salary too low');
  if (teamContext.teamReputation > 75) reasons.push('high team prestige');
  if (roleScore < 0.5) reasons.push('role promise mismatch');
  if (teamContext.financialStability < 40) reasons.push('team finances are weak');

  return {
    accepted: score >= 0.92,
    score: Number(score.toFixed(3)),
    interest: Math.round(clamp(score * 100, 0, 100)),
    reasons,
    minValue,
    counter: score >= 0.75 && score < 0.92 ? {
      salary: Math.round(Math.max(minValue, offer.salary * 1.12)),
      years: player.reputation > 80 ? Math.min(2, offer.years) : Math.max(2, offer.years),
      rolePromise: player.playtimeDesire > 65 ? 'starter' : offer.rolePromise,
      signingBonus: Math.round(Math.max(minValue * 0.2, offer.signingBonus * 1.1))
    } : null
  };
}

export function startNegotiation(state, playerId, teamId) {
  const player = state.players.find((p) => p.pid === playerId);
  if (!player) return null;
  const key = uid('neg');
  state.negotiations[key] = { id: key, playerId, teamId, startedAt: Date.now(), rounds: [], aiOffers: generateAIOffers(state, playerId) };
  addMessage(state, {
    from: { type: 'gm', name: 'GM Office' },
    subject: `Offer Prep Started — ${player.name}`,
    body: `Negotiation started with ${player.name}.`,
    category: 'contract',
    related: { playerId }
  });
  return state.negotiations[key];
}

export function submitOffer(state, negotiationId, offer) {
  const neg = state.negotiations[negotiationId];
  if (!neg) return null;
  const player = state.players.find((p) => p.pid === neg.playerId);
  const context = teamSnapshot(state, neg.teamId);
  const evalResult = evaluateOffer(player, context, offer, player.tid);
  neg.rounds.push({ offer, evalResult, ts: Date.now() });

  addMessage(state, {
    from: { type: 'gm', name: 'GM Office' },
    subject: `Offer sent to ${player.name}`,
    body: `Salary ${offer.salary}, ${offer.years} year(s), ${offer.rolePromise}. Awaiting response.`,
    category: 'contract',
    related: { playerId: player.pid, contractId: neg.id }
  });

  if (evalResult.accepted) {
    player.tid = neg.teamId;
    player.salary = offer.salary;
    player.currentContract = { salaryPerYear: offer.salary, yearsRemaining: offer.years, signedWithTid: neg.teamId, buyoutClause: Math.round(offer.salary * 3), rolePromise: offer.rolePromise, signingBonus: offer.signingBonus };
    const team = context.team;
    team.cash -= offer.signingBonus;
    team.expenses += offer.signingBonus;
    player.history.push(`Signed contract with ${team.name} (${offer.years}y)`);
    addMessage(state, {
      from: { type: 'player', name: player.name },
      subject: `Offer Accepted — ${player.name}`,
      body: `${player.name} accepted the offer.`,
      category: 'contract',
      related: { playerId: player.pid, contractId: neg.id }
    });
    delete state.negotiations[negotiationId];
  } else if (evalResult.counter) {
    addMessage(state, {
      from: { type: 'agent', name: `${player.name}'s Agent` },
      subject: `Counter Offer — ${player.name}`,
      body: `Counter terms: salary ${evalResult.counter.salary}, ${evalResult.counter.years}y, ${evalResult.counter.rolePromise}. Reasons: ${evalResult.reasons.slice(0, 3).join(', ') || 'market leverage'}.`,
      category: 'contract',
      related: { playerId: player.pid, contractId: neg.id }
    });
  } else {
    addMessage(state, {
      from: { type: 'player', name: player.name },
      subject: `Offer Rejected — ${player.name}`,
      body: `Rejected. Reasons: ${evalResult.reasons.slice(0, 4).join(', ') || 'insufficient fit'}.`,
      category: 'contract',
      related: { playerId: player.pid, contractId: neg.id }
    });
  }

  return evalResult;
}

export function generateAIOffers(state, playerId) {
  const player = state.players.find((p) => p.pid === playerId);
  if (!player) return [];
  const pool = state.teams.map((t) => {
    const context = teamSnapshot(state, t.tid);
    const min = marketValue(player);
    const offer = { teamId: t.tid, salary: Math.round(min * (0.85 + Math.random() * 0.5)), years: randInt(1, 3), rolePromise: Math.random() > 0.45 ? 'starter' : 'bench', signingBonus: Math.round(min * (0.08 + Math.random() * 0.25)) };
    const evalRes = evaluateOffer(player, context, offer, player.tid);
    return { ...offer, score: evalRes.score };
  });
  return pool.sort((a, b) => b.score - a.score).slice(0, 4);
}

export function aiResolveFreeAgency(state) {
  const freeAgents = state.players.filter((p) => p.tid === null);
  for (const player of freeAgents) {
    const offers = generateAIOffers(state, player.pid);
    const best = offers[0];
    if (!best || best.score < 0.95) continue;
    player.tid = best.teamId;
    player.salary = best.salary;
    player.currentContract = { salaryPerYear: best.salary, yearsRemaining: best.years, signedWithTid: best.teamId, buyoutClause: Math.round(best.salary * 3), rolePromise: best.rolePromise, signingBonus: best.signingBonus };
  }
}
