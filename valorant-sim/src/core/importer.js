import { ROLES } from './constants.js';

const ROLE_SET = new Set(ROLES.map((r) => r.toLowerCase()));

function normalizeRoleToken(token) {
  const t = token.trim().toLowerCase();
  if (t === 'intiator') return 'initiator';
  if (t === 'entry') return 'entry';
  if (t === 'oper') return 'oper';
  return t;
}

export function parseMasterPlayersText(text) {
  const normalized = String(text || '').replaceAll('\\n', '\n');
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const rows = [];
  for (const line of lines) {
    if (/^Team\s*\|\s*Name\s*\|/i.test(line)) continue;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 8) continue;

    const [teamNameRaw, name, rolesRaw, ageRaw, nationalityRaw, imageURLRaw, starterRaw, freeRaw] = parts;
    const teamName = teamNameRaw || 'Free Agents';
    const tokens = rolesRaw.split('/').map(normalizeRoleToken).filter(Boolean);
    const canonicalRole = tokens.find((t) => ROLE_SET.has(t));
    const primaryRole = canonicalRole ? canonicalRole[0].toUpperCase() + canonicalRole.slice(1) : 'Flex';
    const roles = Array.from(new Set(tokens.map((t) => {
      if (ROLE_SET.has(t)) return t[0].toUpperCase() + t.slice(1);
      return t;
    })));
    const tags = roles.filter((r) => !ROLES.includes(r)).map((r) => r.toUpperCase());

    rows.push({
      teamName,
      name,
      roles,
      primaryRole,
      tags,
      age: Number(ageRaw) || 20,
      nationality: nationalityRaw || 'UNKNOWN',
      imageURL: imageURLRaw || '',
      starter: String(starterRaw).toLowerCase() === 'true',
      freeAgent: String(freeRaw).toLowerCase() === 'true' || /^free agents$/i.test(teamName)
    });
  }
  return rows;
}

export function buildSeedDatabaseFromText(text) {
  const parsed = parseMasterPlayersText(text);
  const teamsByName = new Map();
  const players = [];
  const seen = new Set();

  for (const row of parsed) {
    const key = row.freeAgent ? `FA::${row.name.toLowerCase()}` : `${row.teamName.toLowerCase()}::${row.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let teamId = null;
    if (!row.freeAgent) {
      if (!teamsByName.has(row.teamName)) {
        teamsByName.set(row.teamName, {
          id: teamsByName.size,
          name: row.teamName,
          region: 'International'
        });
      }
      teamId = teamsByName.get(row.teamName).id;
    }

    players.push({
      _key: key,
      name: row.name,
      teamName: row.freeAgent ? 'Free Agents' : row.teamName,
      teamId,
      roles: row.roles,
      primaryRole: row.primaryRole,
      tags: row.tags,
      age: row.age,
      nationality: row.nationality,
      imageURL: row.imageURL,
      starter: row.starter && !row.freeAgent,
      freeAgent: row.freeAgent
    });
  }

  return {
    teams: Array.from(teamsByName.values()).sort((a, b) => a.id - b.id),
    players: players.map(({ _key, ...rest }) => rest)
  };
}
