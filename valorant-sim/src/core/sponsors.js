import { uid, weightedPick } from './utils.js';
import { addMessage } from './messages.js';

function offerSuccessEstimate(team, objective) {
  if (objective.type === 'wins') return Math.max(20, Math.min(85, team.wins * 4 + team.rosterStrength * 0.6));
  if (objective.type === 'reputation') return Math.max(25, Math.min(90, team.teamReputation + 12));
  return Math.max(18, Math.min(80, team.rosterStrength));
}

export function maybeGenerateSponsorOffers(state) {
  if (state.meta.week % 6 !== 0) return;
  const team = state.teams.find((t) => t.tid === state.userTid);
  const objective = weightedPick([
    { value: { type: 'wins', target: 12, label: 'Win 12 series this season' }, weight: 2 },
    { value: { type: 'reputation', target: 70, label: 'Reach team reputation 70' }, weight: 1 },
    { value: { type: 'topPlayer', target: 85, label: 'Have a player with OVR 85+' }, weight: 1 }
  ]);
  const offer = {
    id: uid('spOffer'),
    teamId: team.tid,
    sponsorName: weightedPick([{ value: 'Apex Hardware', weight: 1 }, { value: 'Pulse Energy', weight: 1 }, { value: 'Nimbus Telecom', weight: 1 }]),
    basePayout: Math.round(100000 + team.teamReputation * 1800),
    bonusPayout: Math.round(50000 + team.teamReputation * 900),
    objective,
    deadlineWeek: Math.max(state.meta.week + 8, 24),
    createdAt: Date.now()
  };
  offer.successEstimate = offerSuccessEstimate(team, objective);
  state.sponsors.offers.push(offer);
  addMessage(state, {
    from: { type: 'system', name: 'Sponsor Desk' },
    subject: `Sponsor Proposal: ${offer.sponsorName} (${offer.successEstimate}% est.)`,
    body: `${offer.sponsorName} submitted a commercial proposal. Objective difficulty, payout profile, and risk note are listed below for decision support.`,
    category: 'sponsors',
    related: { teamId: team.tid },
    actions: [{ label: 'Open Sponsors', route: '#/sponsors' }],
    details: {
      bullets: [`Objective: ${offer.objective.label}`, `Risk note: Missing objective still pays base, but bonus is void.`, `Estimated success probability: ${offer.successEstimate}%`],
      stats: [{ label: 'Base Payout', value: `${offer.basePayout}` }, { label: 'Bonus Payout', value: `${offer.bonusPayout}` }, { label: 'Deadline Week', value: `${offer.deadlineWeek}` }],
      links: [{ label: 'Review Offer', route: '#/sponsors' }],
      tags: ['sponsors']
    }
  });
}

function objectiveProgress(state, sponsor) {
  const team = state.teams.find((t) => t.tid === sponsor.teamId);
  if (!team) return 0;
  if (sponsor.objective.type === 'wins') return team.wins;
  if (sponsor.objective.type === 'reputation') return team.teamReputation;
  if (sponsor.objective.type === 'topPlayer') return state.players.filter((p) => p.tid === team.tid).sort((a, b) => b.ovr - a.ovr)[0]?.ovr || 0;
  return 0;
}

export function updateSponsorProgress(state) {
  for (const s of state.sponsors.active) {
    const value = objectiveProgress(state, s);
    s.progress = value;
    if (!s.milestoneSent && value >= s.objective.target * 0.6) {
      s.milestoneSent = true;
      addMessage(state, {
        from: { type: 'system', name: 'Sponsor Desk' },
        subject: `Sponsor Milestone Hit — ${s.sponsorName}`,
        body: 'Milestone reached. You are in range to secure full bonus if pace is maintained.',
        category: 'sponsors',
        details: {
          bullets: [`Progress reached ${value}/${s.objective.target}.`, `Remaining target: ${Math.max(0, s.objective.target - value)}.`],
          stats: [{ label: 'Current Progress', value: `${value}` }, { label: 'Target', value: `${s.objective.target}` }],
          tags: ['sponsors', 'progress']
        }
      });
    }
  }
}

export function settleSponsorDeadlines(state) {
  const team = state.teams.find((t) => t.tid === state.userTid);
  const remain = [];
  for (const s of state.sponsors.active) {
    if (state.meta.week < s.deadlineWeek) { remain.push(s); continue; }
    const value = objectiveProgress(state, s);
    const success = value >= s.objective.target;
    if (success) {
      team.cash += s.basePayout + s.bonusPayout;
      team.revenue += s.basePayout + s.bonusPayout;
      addMessage(state, {
        from: { type: 'system', name: 'Sponsor Desk' },
        subject: `Sponsor Settled: ${s.sponsorName} (Success)`,
        body: 'Sponsor objective was completed before deadline. Finance posted full payout.',
        category: 'sponsors',
        details: {
          bullets: [`Objective complete: ${s.objective.label}`],
          stats: [{ label: 'Payout', value: `${s.basePayout + s.bonusPayout}` }, { label: 'Final Progress', value: `${value}/${s.objective.target}` }],
          tags: ['sponsors', 'settlement']
        }
      });
    } else {
      team.cash += s.basePayout;
      team.revenue += s.basePayout;
      addMessage(state, {
        from: { type: 'system', name: 'Sponsor Desk' },
        subject: `Sponsor Settled: ${s.sponsorName} (Base Only)`,
        body: 'Objective was missed. Base payout transferred; bonus voided.',
        category: 'sponsors',
        details: {
          bullets: [`Missed target by ${Math.max(0, s.objective.target - value)}.`],
          stats: [{ label: 'Base Paid', value: `${s.basePayout}` }, { label: 'Bonus Lost', value: `${s.bonusPayout}` }],
          tags: ['sponsors', 'settlement']
        }
      });
    }
    state.sponsors.history.push({ ...s, finalProgress: value, success, resolvedAtWeek: state.meta.week });
  }
  state.sponsors.active = remain;
}

export function acceptSponsorOffer(state, offerId) {
  const idx = state.sponsors.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) return;
  const offer = state.sponsors.offers[idx];
  state.sponsors.offers.splice(idx, 1);
  state.sponsors.active.push({ ...offer, progress: 0, acceptedAt: Date.now(), milestoneSent: false });
  addMessage(state, {
    from: { type: 'system', name: 'Sponsor Desk' },
    subject: `Sponsor Accepted — ${offer.sponsorName}`,
    body: 'Commercial agreement executed and objective tracking started immediately.',
    category: 'sponsors',
    details: {
      bullets: [`Objective: ${offer.objective.label}`, `Deadline week ${offer.deadlineWeek}.`],
      stats: [{ label: 'Base', value: `${offer.basePayout}` }, { label: 'Bonus', value: `${offer.bonusPayout}` }],
      links: [{ label: 'View Sponsors', route: '#/sponsors' }],
      tags: ['sponsors']
    }
  });
}

export function declineSponsorOffer(state, offerId) {
  state.sponsors.offers = state.sponsors.offers.filter((o) => o.id !== offerId);
}
