const TEAM_SEED = [
  // Americas VCT
  ['Sentinels', 'SEN', 'Americas'],
  ['NRG', 'NRG', 'Americas'],
  ['G2 Esports', 'G2', 'Americas'],
  ['Cloud9', 'C9', 'Americas'],
  ['100 Thieves', '100T', 'Americas'],
  ['Evil Geniuses', 'EG', 'Americas'],
  ['LOUD', 'LOUD', 'Americas'],
  ['Leviatán', 'LEV', 'Americas'],
  ['KRÜ Esports', 'KRU', 'Americas'],
  ['MIBR', 'MIBR', 'Americas'],
  ['FURIA', 'FUR', 'Americas'],

  // EMEA VCT
  ['Fnatic', 'FNC', 'EMEA'],
  ['Team Heretics', 'TH', 'EMEA'],
  ['Natus Vincere', 'NAVI', 'EMEA'],
  ['FUT Esports', 'FUT', 'EMEA'],
  ['Team Vitality', 'VIT', 'EMEA'],
  ['Karmine Corp', 'KC', 'EMEA'],
  ['BBL Esports', 'BBL', 'EMEA'],
  ['GIANTX', 'GX', 'EMEA'],
  ['KOI', 'KOI', 'EMEA'],
  ['Gentle Mates', 'M8', 'EMEA'],
  ['Apeks', 'APK', 'EMEA'],

  // Pacific VCT
  ['Paper Rex', 'PRX', 'Pacific'],
  ['DRX', 'DRX', 'Pacific'],
  ['Gen.G', 'GEN', 'Pacific'],
  ['T1', 'T1', 'Pacific'],
  ['Talon Esports', 'TLN', 'Pacific'],
  ['ZETA DIVISION', 'ZETA', 'Pacific'],
  ['DetonatioN FocusMe', 'DFM', 'Pacific'],
  ['Global Esports', 'GE', 'Pacific'],
  ['Rex Regum Qeon', 'RRQ', 'Pacific'],
  ['Team Secret', 'TS', 'Pacific'],

  // China VCT
  ['EDward Gaming', 'EDG', 'China'],
  ['FunPlus Phoenix', 'FPX', 'China'],
  ['Trace Esports', 'TE', 'China'],
  ['Bilibili Gaming', 'BLG', 'China'],
  ['JD Gaming', 'JDG', 'China'],
  ['Nova Esports', 'NOVA', 'China'],
  ['TYLOO', 'TYL', 'China'],
  ['Wolves Esports', 'WOL', 'China'],
  ['Dragon Ranger Gaming', 'DRG', 'China'],
  ['All Gamers', 'AG', 'China']
];

export const TEAMS = TEAM_SEED.map(([name, abbrev, region], tid) => ({
  tid,
  name,
  abbrev,
  region,
  tier: 'Tier 1'
}));

export const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'];
export const PRACTICE_FOCUS = ['aim', 'utility', 'clutch', 'mental'];
export const INTENSITIES = ['light', 'normal', 'hard'];
export const ROSTER_LIMIT = 10;
