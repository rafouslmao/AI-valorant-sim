const TEAM_SEED = [
  ['Sentinels', 'SEN', 'Americas'], ['NRG', 'NRG', 'Americas'], ['G2 Esports', 'G2', 'Americas'], ['Cloud9', 'C9', 'Americas'], ['100 Thieves', '100T', 'Americas'], ['Evil Geniuses', 'EG', 'Americas'], ['LOUD', 'LOUD', 'Americas'], ['Leviatán', 'LEV', 'Americas'], ['KRÜ Esports', 'KRU', 'Americas'], ['MIBR', 'MIBR', 'Americas'], ['FURIA', 'FUR', 'Americas'],
  ['Fnatic', 'FNC', 'EMEA'], ['Team Heretics', 'TH', 'EMEA'], ['Natus Vincere', 'NAVI', 'EMEA'], ['FUT Esports', 'FUT', 'EMEA'], ['Team Vitality', 'VIT', 'EMEA'], ['Karmine Corp', 'KC', 'EMEA'], ['BBL Esports', 'BBL', 'EMEA'], ['GIANTX', 'GX', 'EMEA'], ['KOI', 'KOI', 'EMEA'], ['Gentle Mates', 'M8', 'EMEA'], ['Apeks', 'APK', 'EMEA'],
  ['Paper Rex', 'PRX', 'Pacific'], ['DRX', 'DRX', 'Pacific'], ['Gen.G', 'GEN', 'Pacific'], ['T1', 'T1', 'Pacific'], ['Talon Esports', 'TLN', 'Pacific'], ['ZETA DIVISION', 'ZETA', 'Pacific'], ['DetonatioN FocusMe', 'DFM', 'Pacific'], ['Global Esports', 'GE', 'Pacific'], ['Rex Regum Qeon', 'RRQ', 'Pacific'], ['Team Secret', 'TS', 'Pacific'],
  ['EDward Gaming', 'EDG', 'China'], ['FunPlus Phoenix', 'FPX', 'China'], ['Trace Esports', 'TE', 'China'], ['Bilibili Gaming', 'BLG', 'China'], ['JD Gaming', 'JDG', 'China'], ['Nova Esports', 'NOVA', 'China'], ['TYLOO', 'TYL', 'China'], ['Wolves Esports', 'WOL', 'China'], ['Dragon Ranger Gaming', 'DRG', 'China'], ['All Gamers', 'AG', 'China']
];

export const TEAMS = TEAM_SEED.map(([name, abbrev, region], tid) => ({ tid, name, abbrev, region, tier: 'Tier 1' }));

export const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'];
export const SECONDARY_ROLE_TAGS = ['None', 'IGL', 'Second Caller', 'Oper', 'Entry', 'Lurker', 'Anchor', 'Support'];
export const PRACTICE_FOCUS = ['aim', 'utility', 'clutch', 'mental'];
export const TRAINING_PRIMARY = ['Duelist', 'Initiator', 'Controller', 'Sentinel'];
export const TRAINING_SECONDARY = ['None', 'Aim', 'Clutch', 'Utility usage', 'Mental resilience', 'Decision making', 'Duelist', 'Initiator', 'Controller', 'Sentinel'];
export const INTENSITIES = ['light', 'normal', 'hard'];
export const ROSTER_LIMIT = 10;

export const MAP_POOL = [
  { id: 'ascent', name: 'Ascent', atkBias: 0.00, defBias: 0.03 },
  { id: 'bind', name: 'Bind', atkBias: 0.02, defBias: 0.01 },
  { id: 'haven', name: 'Haven', atkBias: 0.01, defBias: 0.01 },
  { id: 'lotus', name: 'Lotus', atkBias: 0.03, defBias: -0.01 },
  { id: 'sunset', name: 'Sunset', atkBias: 0.02, defBias: 0.00 },
  { id: 'icebox', name: 'Icebox', atkBias: 0.01, defBias: 0.02 },
  { id: 'split', name: 'Split', atkBias: -0.02, defBias: 0.04 }
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
