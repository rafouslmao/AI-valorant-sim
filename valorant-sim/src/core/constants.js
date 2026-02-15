import { REAL_TEAM_DATABASE } from './database.js';

export const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'];
export const SECONDARY_ROLE_TAGS = ['None', 'IGL', 'Second Caller', 'Oper', 'Entry', 'Lurker', 'Anchor', 'Support'];
export const PRACTICE_FOCUS = ['Mechanics', 'Utility', 'Decision', 'Mental', 'Role mastery', 'Agent mastery', 'Teamwork'];
export const TRAINING_PRIMARY = ['Mechanics', 'Utility', 'Decision', 'Mental', 'Role mastery', 'Agent mastery', 'Teamwork'];
export const TRAINING_SECONDARY = ['None', 'Mechanics', 'Utility', 'Decision', 'Mental', 'Role mastery', 'Agent mastery', 'Teamwork', 'Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'];
export const INTENSITIES = ['light', 'normal', 'hard'];
export const ROSTER_LIMIT = 12;

// Keep this array as a canonical update point if Riot rotates map pools.
export const MAP_POOL = [
  { id: 'ascent', name: 'Ascent', atkBias: 0.00, defBias: 0.03 },
  { id: 'bind', name: 'Bind', atkBias: 0.02, defBias: 0.01 },
  { id: 'haven', name: 'Haven', atkBias: 0.01, defBias: 0.01 },
  { id: 'split', name: 'Split', atkBias: -0.02, defBias: 0.04 },
  { id: 'lotus', name: 'Lotus', atkBias: 0.03, defBias: -0.01 },
  { id: 'sunset', name: 'Sunset', atkBias: 0.02, defBias: 0.00 },
  { id: 'icebox', name: 'Icebox', atkBias: 0.01, defBias: 0.02 },
  { id: 'pearl', name: 'Pearl', atkBias: 0.01, defBias: 0.02 },
  { id: 'fracture', name: 'Fracture', atkBias: 0.03, defBias: -0.02 },
  { id: 'breeze', name: 'Breeze', atkBias: 0.02, defBias: -0.01 },
  { id: 'abyss', name: 'Abyss', atkBias: 0.00, defBias: 0.02 }
];

export const AGENT_ROLES = {
  Duelist: ['Reyna', 'Jett', 'Waylay', 'Yoru', 'Raze', 'Iso', 'Neon', 'Pheonix'],
  Initiator: ['Sova', 'Skye', 'Fade', 'KAY/O', 'Tejo', 'Gekko', 'Breach'],
  Controller: ['Astra', 'Brimstone', 'Clove', 'Omen', 'Viper', 'Harbor'],
  Sentinel: ['Chamber', 'Veto', 'Cypher', 'Killjoy', 'Sage', 'Deadlock']
};

export const ALL_AGENTS = [...AGENT_ROLES.Duelist, ...AGENT_ROLES.Initiator, ...AGENT_ROLES.Controller, ...AGENT_ROLES.Sentinel];

export const FACILITY_CONFIG = {
  officeQuality: { label: 'Office Quality', baseCost: 70000, baseMaintenance: 7000, maxLevel: 5 },
  pcEquipment: { label: 'PC / Equipment Quality', baseCost: 90000, baseMaintenance: 9000, maxLevel: 5 },
  analystDept: { label: 'Analyst Department', baseCost: 110000, baseMaintenance: 11000, maxLevel: 5 },
  sportsPsych: { label: 'Sports Psychology', baseCost: 100000, baseMaintenance: 10000, maxLevel: 5 },
  performanceHealth: { label: 'Performance & Health Staff', baseCost: 95000, baseMaintenance: 9500, maxLevel: 5 },
  academy: { label: 'Youth / Academy Investment', baseCost: 130000, baseMaintenance: 12000, maxLevel: 5 }
};

export const TEAMS = REAL_TEAM_DATABASE.map((t, tid) => ({ tid, name: t.name, abbrev: t.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase(), region: t.region, tier: 'Tier 1' }));
