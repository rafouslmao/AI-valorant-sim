export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function weightedPick(items) {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

export function formatMoney(value) {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return `${Math.round(value)}`;
}
