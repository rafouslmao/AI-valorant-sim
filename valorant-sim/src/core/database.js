import { buildSeedDatabaseFromText } from './importer.js';

const ATTRIBUTE_TEMPLATE = {
  mechanics: ['rawAim', 'tracking', 'firstBulletAccuracy', 'recoilControl', 'movement', 'crosshairDiscipline', 'operatorAim'],
  utilitySkill: ['utilityTiming', 'utilityPrecision', 'comboSync', 'roleMastery'],
  decisionMaking: ['positioning', 'spacing', 'infoProcessing', 'riskControl', 'midRoundAdaptation', 'macroUnderstanding'],
  mental: ['clutch', 'composure', 'confidence', 'consistency', 'pressureHandling'],
  teamplay: ['communication', 'initiative', 'trustFollow', 'supportiveness'],
  physical: ['stamina', 'workEthic', 'adaptability']
};

function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRange(seed, min, max) {
  return min + (seed % (max - min + 1));
}

function roleBias(primaryRole, key) {
  const role = String(primaryRole || '').toLowerCase();
  if (role === 'duelist') {
    if (['rawAim', 'tracking', 'movement', 'firstBulletAccuracy', 'confidence'].includes(key)) return 8;
    if (['supportiveness', 'trustFollow', 'communication'].includes(key)) return -4;
  }
  if (role === 'initiator') {
    if (['infoProcessing', 'utilityTiming', 'utilityPrecision', 'communication'].includes(key)) return 7;
  }
  if (role === 'controller') {
    if (['macroUnderstanding', 'riskControl', 'utilityTiming', 'positioning'].includes(key)) return 7;
  }
  if (role === 'sentinel') {
    if (['positioning', 'consistency', 'clutch', 'supportiveness'].includes(key)) return 7;
  }
  return 0;
}

function buildRatingOverrideForPlayer(player) {
  const key = `${player.teamName || 'FA'}::${player.name}`;
  const baseSeed = hashSeed(key);
  const tags = new Set((player.tags || []).map((t) => String(t).toUpperCase()));
  const rolesRaw = Array.isArray(player.roles) ? player.roles : [];
  const rolesSet = new Set(rolesRaw.map((r) => String(r).toLowerCase()));
  const isOper = tags.has('OPER') || rolesSet.has('oper');

  const attributes = {};
  for (const [group, keys] of Object.entries(ATTRIBUTE_TEMPLATE)) {
    attributes[group] = {};
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const seed = hashSeed(`${key}:${group}:${k}:${baseSeed + i * 13}`);
      let v = seededRange(seed, 45, 92);
      v += roleBias(player.primaryRole, k);
      if (k === 'operatorAim') v += isOper ? 10 : -5;
      if (k === 'rawAim' && isOper) v += 3;
      if (k === 'clutch' && player.starter) v += 2;
      v = Math.max(20, Math.min(99, v));
      attributes[group][k] = v;
    }
  }

  const mech = attributes.mechanics;
  const util = attributes.utilitySkill;
  const dm = attributes.decisionMaking;
  const mental = attributes.mental;
  const team = attributes.teamplay;

  const attrs = {
    aim: Math.round((mech.rawAim + mech.tracking + mech.firstBulletAccuracy + mech.operatorAim) / 4),
    utility: Math.round((util.utilityTiming + util.utilityPrecision + util.comboSync) / 3),
    clutch: mental.clutch,
    mental: Math.round((mental.composure + mental.confidence + mental.pressureHandling) / 3),
    teamwork: Math.round((team.communication + team.trustFollow + team.supportiveness) / 3),
    decisionMaking: Math.round((dm.positioning + dm.infoProcessing + dm.macroUnderstanding) / 3)
  };

  const traitHints = [];
  if (isOper || mech.operatorAim >= 85) traitHints.push('Oper Specialist');
  if (mental.clutch >= 86) traitHints.push('Ice Cold');
  if (dm.positioning >= 84) traitHints.push('Anchor Rock');

  return {
    attrs,
    attributes,
    operatorAim: mech.operatorAim,
    traitHints
  };
}

function buildRatingsOverridesForAllPlayers(players) {
  const out = {};
  for (const p of players) {
    out[p.name] = buildRatingOverrideForPlayer(p);
  }
  return out;
}

export const MASTER_PLAYERS_TEXT = `Team | Name | Role(s) | Age | Nationality | ImageURL | Starter | FreeAgent
FNATIC | Boaster | controller | 30 | United_Kingdom | https://i.imgur.com/siilXfI.png | true | false
Natus Vincere | hiro | duelist/initiator/flex/sentinel | 19 | Netherlands | https://owcdn.net/img/67925026116a0.png | true | false
Team Vitality | Chronicle | flex/sentinel/initiator | 23 | Russia | https://owcdn.net/img/6977a6d8e354a.png | true | false
FNATIC | Alfajer | sentinel/duelist | 20 | Turkey | https://i.imgur.com/cR0rI0v.png | true | false
Free Agents | Leo | initiator/sentinel | 22 | Sweden | https://i.imgur.com/wYx6yFC.png | false | true
Free Agents | FNS | sentinel/controller/initiator/flex | 33 | Canada | https://i.imgur.com/1lcuwbo.png | false | true
Free Agents | s0m | controller | 23 | United_States | https://i.imgur.com/nm4dczG.png | false | true
FNATIC | crashies | initiator/flex | 28 | United_States | https://i.imgur.com/48vczkH.png | true | false
NRG Esports | Ethan | controller/initiator | 25 | United_States | https://owcdn.net/img/6974068bad561.png | true | false
ENVY | Demon1 | sentinel/duelist/controller | 23 | United_States | https://i.imgur.com/epk5dQO.png | false | false
Sentinels | johnqt | controller/initiator | 27 | Morocco | https://owcdn.net/img/69741441b9923.png | true | false
Free Agents | TenZ | controller/initiator/duelist/sentinel/flex | 24 | Canada | https://i.imgur.com/fbAdOVa.png | false | true
Cloud9 | Zellsis | sentinel/initiator/controller/duelist/flex | 27 | United_States | https://i.imgur.com/80KIl95.png | true | false
MIBR | zekken | controller/duelist | 20 | United_States | https://owcdn.net/img/69742b2cdd6c3.png | true | false
Free Agents | Sacy | initiator/controller/sentinel/flex | 28 | Brazil | https://i.imgur.com/msuzI4u.png | false | true
Free Agents | curry | flex | 21 | United_States | https://i.imgur.com/w1jdUix.png | false | true
Free Agents | Boostio | initiator/sentinel/controller/duelist/flex | 25 | United_States | https://i.imgur.com/coqaLnL.png | false | true
100 Thieves | bang | controller | 21 | United_States | https://owcdn.net/img/69704e67e3e2b.png | true | false
100 Thieves | Cryo | sentinel/controller/oper | 23 | United_States | https://owcdn.net/img/69704e38872a4.png | true | false
FURIA | eeiu | initiator | 24 | Canada | https://i.imgur.com/8mgBuWY.png | true | false
100 Thieves | Asuna | initiator/flex | 22 | United_States | https://owcdn.net/img/69704e530cfac.png | true | false
Free Agents | Elite | sentinel | 20 | Turkey | https://i.imgur.com/T2M4Je9.png | false | true
Free Agents | pAura | initiator/sentinel/controller/flex | 28 | Turkey | https://owcdn.net/img/655dc7bd6cee1.png | false | true
Free Agents | Brave | controller | 22 | Turkey | https://owcdn.net/img/655dc72b3aea0.png | false | true
Free Agents | reazy | initiator | 26 | Turkey | https://owcdn.net/img/65a54cd021173.png | false | true
Free Agents | QutionerX | duelist | 24 | Turkey | https://owcdn.net/img/655dc7f490c8c.png | false | true
Free Agents | runi | initiator/controller/sentinel/flex | 26 | United_States | https://owcdn.net/img/66193fc89a20b.png | false | true
Cloud9 | Xeppaa | initiator/duelist/flex | 25 | United_States | https://owcdn.net/img/679c223b5ed99.png | true | false
Cloud9 | OXY | duelist | 20 | United_States | https://owcdn.net/img/679c2222b0181.png | true | false
Free Agents | vanity | initiator/controller | 27 | United_States | https://owcdn.net/img/66193fd86424a.png | false | true
Free Agents | Medusa | sentinel/controller/initiator/flex | 24 | South_Korea | https://i.imgur.com/9IuFaNf.png | false | true
DetonatioN FocusMe | Meiy | duelist | 22 | Japan | https://i.imgur.com/0YPSrSP.png | true | false
DetonatioN FocusMe | SSeeS | controller/initiator | 29 | Japan | https://i.imgur.com/exm6CGo.png | true | false
Free Agents | NaturE | flex/initiator/controller | 24 | United_States | https://owcdn.net/img/67b55597715e8.png | false | true
Free Agents | Derrek | initiator | 28 | United_States | https://owcdn.net/img/67b555baa3969.png | false | true
Evil Geniuses | supamen | controller | 28 | United_States | https://owcdn.net/img/67b5554423542.png | true | false
Free Agents | Apoth | sentinel/controller | 22 | Canada | https://i.imgur.com/R2C5ZBg.png | false | true
G2 Esports | jawgemo | duelist/controller | 26 | Cambodia | https://i.imgur.com/Im9X48I.png | true | false
Free Agents | nzr | initiator | 27 | Argentina | https://i.imgur.com/9GaBpEl.png | false | true
Free Agents | xand | sentinel/initiator/duelist/flex | 30 | Brazil | https://i.imgur.com/wno9z1e.png | false | true
Free Agents | Khalil | controller/sentinel | 400 | Brazil | https://i.imgur.com/KoDXQMj.png | false | true
FUT Esports | MrFaliN | initiator/controller/sentinel/flex | 25 | Turkey | https://owcdn.net/img/697aba35e69bd.png | true | false
FUT Esports | yetujey | sentinel | 20 | Turkey | https://owcdn.net/img/697ab948ca75e.png | true | false
Free Agents | AtaKaptan | controller/initiator/sentinel/flex | 24 | Turkey | https://i.imgur.com/30Cuwsa.png | false | true
PCIFIC Esports | cNed | controller/duelist | 23 | Turkey | https://owcdn.net/img/696fd4808fcf3.png | true | false
Free Agents | qRaxs | duelist/initiator/flex | 25 | Turkey | https://i.imgur.com/hqHjFoA.png | false | true
T1 | Munchkin | sentinel/flex/controller | 27 | South_Korea | https://owcdn.net/img/696cbebe97d8d.png | true | false
Gen.G | t3xture | duelist/controller/sentinel/flex | 26 | South_Korea | https://i.imgur.com/Ho3cCI3.png | true | false
T1 | Meteor | sentinel/duelist/controller | 26 | South_Korea | https://owcdn.net/img/696cbecabc2af.png | true | false
Gen.G | Lakia | initiator | 25 | South_Korea | https://i.imgur.com/ENoreMB.png | true | false
Gen.G | Karon | controller | 23 | South_Korea | https://i.imgur.com/FILsAho.png | true | false
Free Agents | MAGNUM | controller/sentinel/initiator/flex | 24 | Czech Republic | https://owcdn.net/img/680a92afb8b70.png | false | true
Free Agents | tomaszy | duelist/controller/flex | 20 | Portugal | https://i.imgur.com/2SeVT7s.png | false | true
Sentinels | N4RRATE | duelist/flex | 22 | United_States | https://owcdn.net/img/6974146682328.png | true | false
Gentle Mates | marteen | duelist/controller | 21 | Czech Republic | https://owcdn.net/img/6977651551705.png | true | false
Free Agents | sh1n | sentinel/controller/initiator/duelist/flex | 23 | France | https://i.imgur.com/pobW4Zo.png | false | true
Free Agents | Melser | sentinel/controller | 30 | Chile | https://owcdn.net/img/687bf97be0429.png | false | true
ENVY | keznit | duelist/controller | 24 | Chile | https://owcdn.net/img/687bfb08ac062.png | true | false
Free Agents | mta | initiator/sentinel/duelist/flex | 20 | Chile | https://owcdn.net/img/66403a3a6c828.png | false | true
Free Agents | Shyy | sentinel/initiator/flex | 21 | Chile | https://owcdn.net/img/687bfb9a9e913.png | false | true
Free Agents | heat | sentinel/initiator/duelist/flex | 22 | Brazil | https://i.imgur.com/ydkZLzu.png | false | true
LEVIATÁN | kiNgg | controller/initiator/duelist | 24 | Chile | https://owcdn.net/img/69234b213a609.png | true | false
MIBR | tex | sentinel/duelist/flex | 26 | United_States | https://owcdn.net/img/69742b4f94c53.png | true | false
MIBR | Mazino | controller/flex/initiator | 24 | Chile | https://owcdn.net/img/69742ba0b7d17.png | true | false
MIBR | aspas | duelist | 22 | Brazil | https://owcdn.net/img/69742b6a2a2e8.png | true | false
Evil Geniuses | C0M | initiator | 25 | United_States | https://i.imgur.com/nmWSOmF.png | true | false
KRÜ Esports | saadhak | sentinel/initiator/flex | 28 | Argentina | https://i.imgur.com/3V8klPR.png | true | false
LOUD | pANcada | controller/sentinel | 26 | Brazil | https://owcdn.net/img/6889ddd3735b1.png | false | false
KRÜ Esports | Less | controller/sentinel | 20 | Brazil | https://owcdn.net/img/677d651a8a520.png | true | false
Free Agents | tuyZ | controller/sentinel | 22 | Brazil | https://i.imgur.com/rvLdo0L.png | false | true
LOUD | cauanzin | initiator | 20 | Brazil | https://owcdn.net/img/6889def2c0ea9.png | true | false
Free Agents | ANGE1 | initiator/controller/flex | 36 | Ukraine | https://owcdn.net/img/6792500c3f0df.png | false | true
Natus Vincere | Shao | controller/initiator/flex | 25 | Russia | https://owcdn.net/img/6792501581f4f.png | true | false
Karmine Corp | SUYGETSU | sentinel/controller | 23 | Russia | https://i.imgur.com/xrBWELp.png | true | false
Free Agents | ardiis | initiator/duelist/sentinel/flex | 27 | Latvia | https://i.imgur.com/McUVbkp.png | false | true
Free Agents | Zyppan | initiator/flex | 23 | Sweden | https://i.imgur.com/YFxRRju.png | false | true
Free Agents | mindfreak | controller | 26 | Indonesia | https://owcdn.net/img/67c70182b6186.png | false | true
Paper Rex | Jinggg | sentinel/duelist | 22 | Singapore | https://owcdn.net/img/69735f0889a6b.png | true | false
Paper Rex | f0rsakeN | duelist/initiator/sentinel/flex/controller | 21 | Indonesia | https://owcdn.net/img/69735f135cf21.png | true | false
Paper Rex | d4v41 | sentinel/initiator/controller/flex | 27 | Malaysia | https://owcdn.net/img/69735f207c9bf.png | true | false
Paper Rex | something | initiator/duelist/flex | 23 | Russia | https://owcdn.net/img/69735f396861f.png | true | false
Rex Regum Qeon | xffero | controller/sentinel | 24 | Indonesia | https://owcdn.net/img/6821f77c54827.png | true | false
Rex Regum Qeon | Monyet | controller/duelist | 20 | Indonesia | https://owcdn.net/img/6821f747b910a.png | true | false
Rex Regum Qeon | Jemkin | duelist/initiator/flex | 21 | Russia | https://owcdn.net/img/6821f75962425.png | true | false
Free Agents | Estrella | initiator/controller/sentinel | 26 | South_Korea | https://i.imgur.com/7yi3qM8.png | false | true
Free Agents | Lmemore | sentinel | 23 | Indonesia | https://owcdn.net/img/65a8fcde5ed6a.png | false | true
Team Heretics | Boo | controller | 28 | Lithuania | https://owcdn.net/img/69778b1c2192b.png | true | false
Team Liquid | MiniBoo | duelist | 20 | Lithuania | https://owcdn.net/img/697356d4e6f01.png | true | false
Team Heretics | Wo0t | duelist/initiator/flex | 19 | Turkey | https://owcdn.net/img/69778b5885054.png | true | false
Team Heretics | RieNs | initiator | 20 | Turkey | https://owcdn.net/img/69778b71c9366.png | true | false
Team Heretics | benjyfishy | sentinel | 21 | United_Kingdom | https://owcdn.net/img/69778b2bf3e20.png | true | false
Team Vitality | Jamppi | initiator/flex/duelist | 24 | Finland | https://owcdn.net/img/6977a6f130128.png | true | false
Team Liquid | nAts | sentinel/controller | 23 | Russia | https://owcdn.net/img/69735612b9b30.png | true | false
NRG Esports | Keiko | duelist/controller | 22 | United_Kingdom | https://owcdn.net/img/697406c5ecbcd.png | true | false
Free Agents | Harmii | flex | 21 | UNKWOWN | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Crws | controller/initiator | 29 | Thailand | https://i.imgur.com/OMp1Wrx.png | false | true
Full Sense | JitBoyS | sentinel/controller | 20 | Thailand | https://owcdn.net/img/694404f04f64d.png | true | false
Full Sense | primmie | duelist/flex/sentinel | 21 | Thailand | https://owcdn.net/img/6944047b31bc9.png | true | false
Free Agents | ban | controller/duelist/initiator/sentinel/flex | 25 | South_Korea | https://i.imgur.com/nqcSCEA.png | false | true
Free Agents | Surf | controller/sentinel | 21 | Thailand | https://i.imgur.com/yB8ReJx.png | false | true
Team Secret | JessieVash | initiator/sentinel | 35 | Philippines | https://owcdn.net/img/65a8f7396035a.png | true | false
Paper Rex | invy | controller/initiator/sentinel/flex | 21 | Philippines | https://owcdn.net/img/69735f4a21e3b.png | true | false
Free Agents | Wild0reoo | sentinel/duelist/flex | 22 | Philippines | https://i.imgur.com/rIeJLO2.png | false | true
Free Agents | 2ge | controller | 21 | Philippines | https://i.imgur.com/Lw3kFGq.png | false | true
Free Agents | Jremy | duelist | 20 | Philippines | https://owcdn.net/img/65a8f7423ad9f.png | false | true
Free Agents | ceNder | controller/sentinel | 24 | Lithuania | https://i.imgur.com/jCDfpmE.png | false | true
Free Agents | trexx | initiator/duelist/flex | 21 | Russia | https://i.imgur.com/7l4TwpG.png | false | true
Team Liquid | Kicks | sentinel/controller/flex | 20 | Estonia | https://owcdn.net/img/677d6506baa65.png | false | false
Free Agents | runneR | controller/flex/duelist | 22 | North_Macedonia | https://i.imgur.com/QGglc79.png | false | true
Free Agents | Sayf | controller/sentinel/duelist/flex | 25 | Sweden | https://owcdn.net/img/677d65100cdd7.png | false | true
Free Agents | yuran | initiator/controller | 20 | Japan | https://owcdn.net/img/65dc4f104710e.png | false | true
Free Agents | hiroronn | initiator/sentinel/controller/flex | 20 | Japan | https://owcdn.net/img/65dc4f188894f.png | false | true
Free Agents | Dep | sentinel/duelist | 25 | Japan | https://owcdn.net/img/678a91bae6ff9.png | false | true
ZETA DIVISION | SugarZ3ro | controller | 22 | Japan | https://owcdn.net/img/678a91caf34dd.png | true | false
Free Agents | Laz | sentinel/initiator | 30 | Japan | https://owcdn.net/img/65dc4f086de87.png | false | true
T1 | stax | initiator | 25 | South_Korea | https://owcdn.net/img/696cbe19de8ff.png | true | false
T1 | carpe | initiator/controller | 27 | South_Korea | https://owcdn.net/img/696cbea3e5601.png | false | false
T1 | iZu | controller/duelist/flex | 21 | South_Korea | https://owcdn.net/img/696cbeb2ce31f.png | true | false
Free Agents | xccurate | controller/sentinel | 27 | Indonesia | https://i.imgur.com/0AwTsMN.png | false | true
Free Agents | Sayaplayer | duelist/sentinel | 27 | South_Korea | https://i.imgur.com/ZWXzKRH.png | false | true
Free Agents | mazin | initiator/controller | 26 | Brazil | https://owcdn.net/img/65a4933f9b56c.png | false | true
FURIA | artzin | initiator/duelist/flex | 21 | Brazil | https://i.imgur.com/3vA2Grf.png | true | false
Free Agents | Palla | duelist | 20 | Brazil | https://i.imgur.com/NmcIoS8.png | false | true
Free Agents | rich | initiator | 400 | Brazil | https://i.imgur.com/OFGla5A.png | false | true
Free Agents | liazzi | controller/flex/sentinel | 20 | Brazil | https://i.imgur.com/GiOdTjL.png | false | true
Free Agents | Flashback | initiator/sentinel/controller | 20 | South_Korea | https://i.imgur.com/Xout69R.png | false | true
T1 | BuZz | duelist/sentinel | 22 | South_Korea | https://owcdn.net/img/696cbe96ec066.png | true | false
DRX | MaKo | controller | 23 | South_Korea | https://i.imgur.com/2eBE7SX.png | true | false
Free Agents | Foxy9 | sentinel/controller/duelist/initiator/flex | 21 | South_Korea | https://i.imgur.com/shKCFoA.png | false | true
DRX | BeYN | duelist/controller/initiator/flex | 22 | South_Korea | https://i.imgur.com/9HffGNt.png | true | false
EDward Gaming | nobody | initiator | 23 | China | https://i.imgur.com/SY3bMTz.png | true | false
Free Agents | S1Mon | sentinel/initiator | 21 | Taiwan | https://i.imgur.com/4qf8gFe.png | false | true
EDward Gaming | ZmjjKK | duelist/initiator/flex | 21 | China | https://i.imgur.com/NiZGuLo.png | true | false
EDward Gaming | CHICHOO | sentinel/controller | 22 | China | https://i.imgur.com/OxbjBQr.png | true | false
EDward Gaming | Smoggy | controller/initiator/duelist/flex | 23 | China | https://i.imgur.com/qHYZlCK.png | true | false
Free Agents | WoodAy1 | flex | 21 | China | https://owcdn.net/img/66af5600708f8.png | false | true
Titan Esports Club | Haodong | controller | 23 | China | https://i.imgur.com/QkUcFqJ.png | true | false
FunPlus Phoenix | BerLIN | controller/flex | 21 | Taiwan | https://owcdn.net/img/6780cc73ecfb7.png | true | false
Global Esports | Autumn | sentinel/duelist/flex | 24 | Australia | https://owcdn.net/img/6780cc5e726c5.png | true | false
FunPlus Phoenix | Life | duelist | 23 | China | https://owcdn.net/img/6780cc893eb8f.png | true | false
FunPlus Phoenix | AAAAY | initiator/flex | 23 | China | https://owcdn.net/img/6780cc68aef3a.png | true | false
Xi Lai Gaming | Lysoar | controller/sentinel | 20 | China | https://owcdn.net/img/677d1df2d375a.png | true | false
Free Agents | B3ar | controller | 23 | China | https://owcdn.net/img/65bb6b45df3fb.png | false | true
Bilibili Gaming | whzy | duelist | 22 | China | https://i.imgur.com/BZQzY0F.png | true | false
Free Agents | Levius | initiator/sentinel | 21 | China | https://i.imgur.com/JbagSiO.png | false | true
Bilibili Gaming | nephh | initiator/duelist/flex | 22 | Singapore | https://i.imgur.com/2d1ygUx.png | true | false
Dragon Ranger Gaming | Flex1n | controller | 24 | China | https://i.imgur.com/7v6Fy6U.png | true | false
Bilibili Gaming | Knight | sentinel/initiator/controller/flex | 22 | China | https://i.imgur.com/w9BQFfw.png | true | false
Wolves Esports | Yosemite | controller/sentinel | 23 | China | https://owcdn.net/img/6780cc7ef001a.png | true | false
Free Agents | bunt | controller | 21 | China | https://owcdn.net/img/677fbe7d536d6.png | false | true
Nova Esports | monk | initiator/flex | 23 | China | https://i.imgur.com/24KGify.png | false | false
Trace Esports | deLb | duelist/sentinel | 21 | Indonesia | https://owcdn.net/img/677fbe994eb91.png | true | false
Free Agents | Spitfires | duelist | 22 | China | https://owcdn.net/img/661971c10b083.png | false | true
TYLOO | sword9 | controller/initiator | 30 | China | https://owcdn.net/img/6848f52264464.png | true | false
Team Secret | BerserX | sentinel | 22 | Indonesia | https://owcdn.net/img/67fe138f478b7.png | true | false
Free Agents | NcSlasher | initiator | 21 | Indonesia | https://owcdn.net/img/67fe1388348ff.png | false | true
Free Agents | Shiro | controller/initiator/sentinel/flex | 21 | Indonesia | https://owcdn.net/img/67fe1380672b6.png | false | true
Free Agents | ZesBeeW | controller/duelist/sentinel/initiator/flex | 26 | Singapore | https://i.imgur.com/x7zqwv1.png | false | true
Free Agents | Famouz | duelist | 27 | Indonesia | https://owcdn.net/img/67fe1378b7193.png | false | true
Free Agents | nizhaoTZH | controller | 26 | China | https://owcdn.net/img/677fbe61a3c45.png | false | true
Dragon Ranger Gaming | vo0kashu | sentinel/controller | 23 | Russia | https://owcdn.net/img/67826114df9ea.png | true | false
Free Agents | Shion7 | controller/initiator | 20 | China | https://i.imgur.com/E727uv1.png | false | true
Dragon Ranger Gaming | Nicc | controller/initiator | 23 | Taiwan | https://i.imgur.com/AJ7cmtK.png | true | false
Free Agents | TvirusLuke | duelist | 26 | Taiwan | https://i.imgur.com/rAXiKRx.png | false | true
Free Agents | Dingwei | initiator/controller | 20 | Taiwan | https://owcdn.net/img/65d4b12288fae.png | false | true
G2 Esports | valyn | controller | 22 | United_States | https://i.imgur.com/GQBSgcn.png | true | false
Free Agents | icy | sentinel/duelist/flex | 22 | United_States | https://owcdn.net/img/67b555d0c8564.png | false | true
G2 Esports | trent | initiator/flex | 21 | United_States | https://i.imgur.com/oC66XB8.png | true | false
Free Agents | JonahP | initiator | 25 | Canada | https://i.imgur.com/2xrixRA.png | false | true
G2 Esports | leaf | duelist/sentinel/controller/flex | 22 | United_States | https://i.imgur.com/Y0VOqn1.png | true | false
Free Agents | Lightningfast | controller/sentinel | 25 | India | https://owcdn.net/img/65e1abe992df2.png | false | true
Free Agents | Polvi | duelist/initiator/flex | 25 | Finland | https://owcdn.net/img/65e1abf0ba6cb.png | false | true
Free Agents | Benkai | controller/sentinel | 29 | Singapore | https://owcdn.net/img/643f88553ede3.png | false | true
Free Agents | blaZek1ng | initiator/controller | 29 | Indonesia | https://owcdn.net/img/65e1abd656a2e.png | false | true
Free Agents | Russ | initiator | 27 | United_Kingdom | https://owcdn.net/img/65e1abfccd3c4.png | false | true
Team Liquid | purp0 | controller/flex | 22 | Russia | https://owcdn.net/img/6973563baf5bc.png | true | false
Free Agents | Fit1nho | initiator/duelist/flex | 25 | Spain | https://i.imgur.com/5Z7KP4k.png | false | true
Free Agents | hoody | initiator/controller/sentinel/flex | 27 | Finland | https://i.imgur.com/IB59FHN.png | false | true
GIANTX | Cloud | initiator/flex | 22 | Russia | https://i.imgur.com/saNseUQ.png | true | false
Free Agents | YHchen | initiator | 25 | Taiwan | https://i.imgur.com/WrVgkzt.png | false | true
JDG Esports | stew | duelist | 20 | South_Korea | https://owcdn.net/img/6780d408e3835.png | true | false
Trace Esports | Viva | controller/initiator | 25 | China | https://i.imgur.com/grM2v3k.png | true | false
JDG Esports | jkuro | controller | 20 | Hong_Kong | https://owcdn.net/img/6780d3d43a117.png | true | false
Free Agents | Z1yan | sentinel/controller | 24 | China | https://owcdn.net/img/6780d3f6d3f99.png | false | true
Free Agents | beyAz | initiator | 29 | France | https://i.imgur.com/P0VVdWC.png | false | true
Free Agents | Kada | controller | 25 | France | https://i.imgur.com/AUQmBy5.png | false | true
Free Agents | nataNk | duelist/sentinel/initiator/flex | 26 | France | https://i.imgur.com/qAEKdhl.png | false | true
Free Agents | Wailers | controller/sentinel | 28 | France | https://i.imgur.com/lqkMWRd.png | false | true
Free Agents | logaN | sentinel/controller | 27 | France | https://i.imgur.com/sp0nT1r.png | false | true
Gentle Mates | starxo | controller/initiator | 24 | Poland | https://owcdn.net/img/697767895bac5.png | true | false
Team Liquid | kamo | duelist/flex/initiator | 20 | Poland | https://owcdn.net/img/697355a36ffa7.png | true | false
Free Agents | ShadoW | initiator/sentinel | 30 | Sweden | https://owcdn.net/img/65e74c712b036.png | false | true
GIANTX | grubinho | controller/initiator | 22 | Poland | https://i.imgur.com/apclQnh.png | true | false
Karmine Corp | sheydos | initiator/sentinel/controller/flex | 24 | Russia | https://i.imgur.com/R7gy0uW.png | true | false
Free Agents | o0o0o | initiator/flex | 28 | China | https://i.imgur.com/2COzZfW.png | false | true
Nova Esports | OBONE | controller/flex | 24 | China | https://i.imgur.com/LYoknS6.png | true | false
Free Agents | SWERL | duelist/sentinel | 21 | Australia | https://i.imgur.com/qzeGrvg.png | false | true
EDward Gaming | cb | initiator/flex/duelist | 22 | China | https://i.imgur.com/1U9jlnf.png | true | false
Nova Esports | Ezeir | controller | 23 | China | https://i.imgur.com/C73yIFZ.png | true | false
Nova Esports | GuanG | sentinel | 21 | China | https://i.imgur.com/5aA28zd.png | true | false
Trace Esports | LuoK1ng | controller | 23 | China | https://owcdn.net/img/67f0f3ba506f5.png | true | false
Trace Esports | Kai | duelist/sentinel | 22 | China | https://owcdn.net/img/67f0f409bdfc4.png | true | false
Free Agents | FengF | initiator/duelist/sentinel/flex | 22 | China | https://owcdn.net/img/67f0f41260680.png | false | true
Nova Esports | heybay | duelist/initiator/controller/sentinel/flex | 27 | Hong_Kong | https://owcdn.net/img/67f0f41c3f3b5.png | true | false
Free Agents | Biank | initiator | 25 | China | https://owcdn.net/img/67f0f4250394a.png | false | true
Free Agents | AC | controller/sentinel | 23 | China | https://i.imgur.com/vHm89RQ.png | false | true
Free Agents | LockM | controller/initiator | 23 | China | https://owcdn.net/img/65c9f735b2036.png | false | true
Free Agents | York | controller/flex | 21 | China | https://owcdn.net/img/6780cc9560c9d.png | false | true
Titan Esports Club | Abo | sentinel | 21 | China | https://i.imgur.com/0KymIIm.png | true | false
Free Agents | kawaii | sentinel | 21 | China | https://i.imgur.com/VCnmLB4.png | false | true
Nongshim RedForce | Rb | initiator/flex/duelist/controller | 24 | South_Korea | https://owcdn.net/img/6975bb594fa06.png | true | false
Free Agents | B1ack | initiator/flex | 23 | China | https://owcdn.net/img/678247e77ff42.png | false | true
TYLOO | Scales | initiator | 21 | China | https://owcdn.net/img/6848f4745a824.png | true | false
Free Agents | Ninebody | sentinel/duelist | 23 | China | https://i.imgur.com/0K3CxwT.png | false | true
Free Agents | coldfish | controller/initiator/sentinel/flex | 28 | China | https://i.imgur.com/8zyIZTP.png | false | true
Free Agents | AAK | duelist/sentinel | 24 | China | https://i.imgur.com/PBBt5BI.png | false | true
Free Agents | zjc | flex/initiator/duelist | 24 | China | https://i.imgur.com/eEEGium.png | false | true
Free Agents | Eren | duelist | 21 | China | https://owcdn.net/img/67824c72eeb11.png | false | true
Wolves Esports | SiuFatBB | initiator | 26 | Hong_Kong | https://owcdn.net/img/677d1d70cab8d.png | true | false
Free Agents | V1ya | flex | 21 | Taiwan | https://i.imgur.com/F0WzCtd.png | false | true
JDG Esports | Yuicaw | initiator/sentinel/duelist/flex | 21 | Taiwan | https://owcdn.net/img/677d1d79e76fc.png | true | false
Wolves Esports | Spring | duelist/controller | 22 | Taiwan | https://owcdn.net/img/677d1dbded193.png | true | false
Free Agents | aluba | controller/sentinel/initiator/flex | 25 | China | https://owcdn.net/img/65dd9eae52a03.png | false | true
Free Agents | Persia | controller/flex | 27 | South_Korea | https://owcdn.net/img/679066f3851eb.png | false | true
Free Agents | margaret | sentinel | 19 | South_Korea | https://owcdn.net/img/6790670449e9a.png | false | true
Nongshim RedForce | Dambi | duelist | 19 | South_Korea | https://owcdn.net/img/6975bb6f4e8cd.png | true | false
Nongshim RedForce | Francis | flex/duelist | 21 | South_Korea | https://owcdn.net/img/6975bb61c1335.png | true | false
Nongshim RedForce | Ivy | sentinel/controller | 20 | South_Korea | https://owcdn.net/img/6975bb77ecc2b.png | true | false
Free Agents | Jerry | flex | 21 | UNKWOWN | https://www.vlr.gg/img/base/ph/sil.png | false | true
Global Esports | Kr1stal | initiator/flex/sentinel | 22 | Russia | https://i.imgur.com/9ndIiNQ.png | true | false
Xi Lai Gaming | Rarga | duelist | 24 | Russia | https://i.imgur.com/NF0OOXU.png | true | false
Xi Lai Gaming | happywei | flex | 21 | Taiwan | https://i.imgur.com/OlmKKWd.png | true | false
Wolves Esports | Satoshi | duelist/sentinel | 20 | China | https://owcdn.net/img/6739e1ee74231.png | false | false
Free Agents | MrCANI | flex | 29 | Taiwan | https://owcdn.net/img/6780d3dfbf118.png | false | true
Free Agents | Zap | initiator | 21 | Brazil | https://i.imgur.com/oGGC9hM.png | false | true
Free Agents | pryze | sentinel/flex/initiator | 26 | Brazil | https://i.imgur.com/v9JDMDa.png | false | true
Free Agents | lz | controller | 22 | Brazil | https://i.imgur.com/qajnBgj.png | false | true
LEVIATÁN | spikeziN | sentinel/flex/duelist | 19 | Brazil | https://owcdn.net/img/69234b7d30781.png | true | false
KRÜ Esports | silentzz | controller/duelist/sentinel/flex | 21 | Brazil | https://i.imgur.com/zAU42t1.png | true | false
Free Agents | hype | sentinel/controller | 26 | Lithuania | https://i.imgur.com/k15Qiay.png | false | true
FNATIC | kaajak | duelist | 21 | Poland | https://i.imgur.com/EUmR6G3.png | true | false
Free Agents | MOLSI | initiator/controller | 28 | Poland | https://i.imgur.com/wqQNjpX.png | false | true
Free Agents | soulcas | duelist/initiator/controller/sentinel/flex | 25 | United_Kingdom | https://i.imgur.com/OUWUn4Y.png | false | true
Free Agents | AvovA | controller | 27 | Denmark | https://i.imgur.com/Oc2ziPD.png | false | true
Team Vitality | Derke | duelist | 22 | Finland | https://owcdn.net/img/6977a70c4ff1b.png | true | false
ENVY | Rossy | controller/initiator/sentinel | 22 | United_States | https://i.imgur.com/4JiZZp1.png | true | false
Free Agents | neT | sentinel | 23 | United_States | https://owcdn.net/img/679c2200b60f3.png | false | true
Free Agents | nukkye | sentinel/initiator/duelist | 28 | Lithuania | https://owcdn.net/img/646bd0481fdfd.png | false | true
Free Agents | BORKUM | controller | 29 | Philippines | https://owcdn.net/img/65a8f72fc3081.png | false | true
Free Agents | frz | duelist/controller/sentinel/initiator/flex | 25 | Brazil | https://owcdn.net/img/64408d3024970.png | false | true
Free Agents | wippie | controller/sentinel | 26 | Russia | https://owcdn.net/img/6409c881b5fdb.png | false | true
Free Agents | Victor | initiator/sentinel/duelist/flex | 29 | United_States | https://i.imgur.com/EjJzZ7O.png | false | true
Free Agents | jakee | controller/duelist | 22 | United_States | https://www.thespike.gg/_next/image?url=https:%2F%2Fcdn.thespike.gg%2FFranchise%252520Teams%252FCloud9_jakee_1682536787432.png&w=3840&q=75 | false | true
Free Agents | jzz | initiator/duelist/flex | 21 | Brazil | https://owcdn.net/img/64408cff206c4.png | false | true
Free Agents | RgLMeister | controller | 24 | Brazil | https://owcdn.net/img/64408cf1d1d0c.png | false | true
Free Agents | NDG | sentinel/controller/initiator/flex | 21 | Philippines | https://owcdn.net/img/65a8f74a6111f.png | false | true
Free Agents | Marved | controller/sentinel/initiator | 25 | Canada | https://i.imgur.com/aplarYz.png | false | true
Free Agents | TakaS | duelist/initiator/flex | 24 | France | https://owcdn.net/img/645a8b770b8ae.png | false | true
Free Agents | lenne | initiator | 26 | Singapore | https://owcdn.net/img/668220af43de7.png | false | true
Free Agents | a perereca da vizinha | duelist/initiator/controller/sentinel/flex | 28 | Spain |  | false | true
Free Agents | paTiTek | controller/initiator/flex | 26 | Poland | https://i.imgur.com/S0YAmkw.png | false | true
Free Agents | Destrian | sentinel/controller/flex | 26 | Lithuania | https://owcdn.net/img/6525185f7cc67.png | false | true
Free Agents | fl1pzjder | initiator/controller | 26 | Indonesia | https://owcdn.net/img/65a8fcf33e282.png | false | true
Free Agents | yay | sentinel/flex | 27 | United_States | https://owcdn.net/img/67b5552720305.png | false | true
Free Agents | Klaus | initiator/sentinel | 24 | Argentina | https://owcdn.net/img/63828f6495831.png | false | true
Free Agents | Redgar | controller/sentinel/initiator/flex | 28 | Russia | https://owcdn.net/img/60a0cf0e69630.png | false | true
Free Agents | YOU | controller/sentinel/initiator | 26 | Hong_Kong | https://owcdn.net/img/67825275a6e39.png | false | true
Free Agents | ICEKING | sentinel/initiator/controller/flex | 24 | China | https://owcdn.net/img/65d4b4483d7f1.png | false | true
Free Agents | YiHao | controller | 25 | China | https://owcdn.net/img/66372d08ad146.png | false | true
Trace Esports | MarT1n | sentinel/controller | 25 | China | https://i.imgur.com/renGSmm.png | true | false
Free Agents | QiuYe | sentinel/initiator/controller/flex | 23 | China | https://owcdn.net/img/65c9f73ddf812.png | false | true
Free Agents | pl1xx | initiator/controller/duelist/flex | 28 | Australia | https://owcdn.net/img/65dd9eee06700.png | false | true
NRG Esports | mada | duelist/entry | 22 | Canada | https://i.imgur.com/jHxfOaY.png | true | false
Free Agents | Papi | controller | 28 | Philippines | https://owcdn.net/img/677901d0bac2c.png | false | true
Free Agents | car | sentinel/duelist | 21 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | xenom | controller/flex | 23 | Brazil | https://i.imgur.com/hmkCCAx.png | false | true
Free Agents | LOB | initiator/controller | 25 | South_Korea | https://cdn.thespike.gg/Player%2520Images%25206%2FLOB_PNG_1691500492575.png | false | true
Natus Vincere | Filu | duelist/initiator | 21 | Poland | https://i.imgur.com/OmkB0k5.png | true | false
Free Agents | alyaL | initiator/sentinel/controller/flex | 22 | Vietnam | https://i.ibb.co/mSRqMFV/alyal.png | false | true
Free Agents | Akai | duelist | 18 | United_Arab_Emirates | https://i.ibb.co/mChVpth/akai.png | false | true
Natus Vincere | Ruxic | sentinel/controller/initiator/flex | 21 | Turkey | https://owcdn.net/img/6792501d68dfb.png | true | false
Free Agents | Izzy | duelist/controller/initiator/flex/sentinel | 24 | Turkey | https://owcdn.net/img/65c7f7c6cb1eb.png | false | true
Team Vitality | Sayonara | sentinel/duelist/initiator/flex | 18 | Moldova | https://owcdn.net/img/6977a7018811e.png | true | false
Free Agents | harambe | duelist/controller | 23 | Latvia | https://owcdn.net/img/65605f89b1f52.png | false | true
Free Agents | c4Lypso | controller/sentinel/duelist | 31 | Canada | https://owcdn.net/img/641a3ebaa8328.png | false | true
TYLOO | splash | sentinel/duelist | 18 | Indonesia | https://owcdn.net/img/6583cc067d94b.png | true | false
Cloud9 | v1c | controller/flex | 21 | United_States | https://owcdn.net/img/679c222ec2d14.png | true | false
MIBR | Verno | initiator/flex | 19 | United_States | https://owcdn.net/img/69742b3c25b7c.png | true | false
Team Secret | kellyS | duelist/controller/sentinel | 25 | Philippines | https://i.imgur.com/A2bb6Ay.png | true | false
BBL Esports | Lar0k | duelist/initiator/flex | 18 | Turkey | https://owcdn.net/img/697974e4d16d5.png | true | false
Free Agents | Moh | controller/sentinel/duelist/flex | 25 | Saudi_Arabia | https://i.ibb.co/kKTBMSc/moh.png | false | true
Sentinels | cortezia | sentinel/controller | 21 | Brazil | https://owcdn.net/img/69741432dd5e2.png | true | false
Free Agents | NagZ | sentinel/controller/duelist/flex | 29 | Chile | https://owcdn.net/img/63828f5c39782.png | false | true
Free Agents | XXiF | controller/sentinel/flex | 21 | Canada | https://owcdn.net/img/65a83fa8a4646.png | false | true
Team Vitality | PROFEK | controller | 21 | Poland | https://owcdn.net/img/6977a6e4ea727.png | true | false
Free Agents | Vitie | controller/duelist | 20 | Russia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Karmine Corp | dos9 | controller | 21 | Kazakhstan | https://owcdn.net/img/67fe136f21560.png | true | false
Free Agents | sh0twell | controller | 23 | Chile | https://i.ibb.co/KrP0yr2/shotwell.png | false | true
NRG Esports | brawk | initiator/flex | 25 | United_States | https://i.imgur.com/Mw4fbDD.png | true | false
Free Agents | Spaz | controller | 22 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | marky | duelist/controller/initiator/flex/sentinel | 22 | United_Kingdom | https://owcdn.net/img/65dd4fa9b67ec.png | false | true
Free Agents | Kiuuuu | controller/sentinel | 21 | Hong_Kong | https://owcdn.net/img/65533308a6c4a.png | false | true
Free Agents | Click | duelist | 19 | Germany | https://i.imgur.com/pHUcLw1.png | false | true
Free Agents | kamyk | initiator/flex/duelist | 22 | Poland | https://i.imgur.com/o68AS2Y.png | false | true
Free Agents | Gwangboong | duelist | 22 | South_Korea | https://owcdn.net/img/6540c9b79890b.png | false | true
Sentinels | Kyu | initiator/flex | 22 | Canada | https://owcdn.net/img/688c62cf8c6b1.png | true | false
FUT Esports | xeus | duelist/controller | 21 | Turkey | https://owcdn.net/img/697ab97a4855f.png | true | false
Free Agents | krejzzs | duelist/sentinel | 21 | Poland | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | B1SK | duelist | 25 | Russia | https://owcdn.net/img/6653afe63a997.png | false | true
Free Agents | zeldris | duelist | 20 | United_States | https://owcdn.net/img/65a83f8ec619e.png | false | true
Global Esports | xavi8k | controller | 24 | Philippines | https://owcdn.net/img/667589a57c005.png | true | false
Free Agents | murza | sentinel/duelist | 21 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | woody | duelist/sentinel/initiator/flex | 21 | Indonesia | https://owcdn.net/img/66343f4227dc2.png | false | true
LEVIATÁN | Sato | duelist/entry | 19 | Brazil | https://owcdn.net/img/69234b72ce3db.png | true | false
Free Agents | dzii | duelist/sentinel | 21 | Singapore | https://owcdn.net/img/65de0e7fbf136.png | false | true
Global Esports | Deryeon | sentinel/duelist/flex | 25 | Singapore | https://i.imgur.com/K2PmNfu.png | false | false
Gentle Mates | Minny | sentinel/controller | 20 | Czech Republic | https://owcdn.net/img/697765bb6904c.png | true | false
Free Agents | zander | controller/flex | 24 | Canada | https://i.imgur.com/11k5qwS.png | false | true
Cloud9 | penny | sentinel/duelist/initiator/flex/oper/entry | 23 | Canada | https://i.imgur.com/YGQp9U9.png | true | false
GIANTX | Flickless | initiator/flex | 23 | Belgium | https://i.imgur.com/sFh0wCj.png | true | false
Free Agents | Notexxd | controller/initiator | 22 | Bermuda | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Zest | initiator/sentinel/duelist | 25 | South_Korea | https://owcdn.net/img/63eba27ae8542.png | false | true
Free Agents | 7ssk7 | initiator/duelist/flex | 26 | Belarus | https://owcdn.net/img/61131b4bd6dbd.png | false | true
Global Esports | PatMen | duelist/controller/sentinel | 21 | Philippines | https://i.imgur.com/zbhBkMh.png | true | false
Free Agents | rubkkoide | initiator | 28 | Argentina | https://owcdn.net/img/6468f670d55ec.png | false | true
FURIA | koalanoob | flex/duelist | 22 | Canada | https://owcdn.net/img/6792502f0fc09.png | true | false
Natus Vincere | sociablEE | initiator/flex/duelist | 29 | Turkey | https://owcdn.net/img/680a926893d7b.png | true | false
Free Agents | PTC | controller/initiator/sentinel/flex | 27 | Thailand | https://owcdn.net/img/65ef1266d5370.png | false | true
Free Agents | Jlerst | sentinel/controller | 23 | Turkey | https://owcdn.net/img/65f086d9a7db7.png | false | true
Team Liquid | wayne | initiator/controller/duelist | 19 | Singapore | https://owcdn.net/img/697356c2b2189.png | true | false
Free Agents | grumble | initiator/duelist | 21 | Singapore | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Eso177 | sentinel/controller | 24 | Bulgaria | https://owcdn.net/img/6435e42e328c9.png | false | true
Free Agents | Jinboong | sentinel/flex/duelist | 22 | South_Korea | https://i.imgur.com/B0kfMVe.png | false | true
Rex Regum Qeon | crazyguy | initiator/controller | 29 | Vietnam | https://owcdn.net/img/6821f7746590a.png | true | false
Team Heretics | ComeBack | sentinel/duelist | 19 | Turkey | https://owcdn.net/img/69778b427222d.png | true | false
Free Agents | k1Ng | initiator/controller/sentinel/flex/duelist | 25 | South_Korea | https://owcdn.net/img/64393296771bd.png | false | true
Free Agents | mikeE | sentinel/duelist | 21 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
GIANTX | westside | sentinel | 20 | Poland | https://i.imgur.com/T96OkyI.png | true | false
PCIFIC Esports | al0rante | sentinel/controller | 23 | Germany | https://owcdn.net/img/696fd45ed51dd.png | true | false
Free Agents | Vera | duelist/sentinel | 21 | Singapore | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Anima | initiator | 20 | Turkey | https://owcdn.net/img/659e7f3a1a7db.png | false | true
Free Agents | Retla | controller/sentinel/initiator/flex | 24 | Singapore | https://i.ibb.co/dDmXGDq/retla.png | false | true
Free Agents | eXampL | sentinel/initiator/flex | 24 | Greece | https://owcdn.net/img/6436230616651.png | false | true
Free Agents | K1LLERS | duelist/initiator/flex | 22 | Vietnam | https://owcdn.net/img/621c9dd24c1b7.png | false | true
Karmine Corp | Avez | initiator/flex | 21 | Egypt | https://i.imgur.com/kCQqgoh.png | true | false
Free Agents | corey | duelist/initiator/flex | 26 | United_States | https://owcdn.net/img/635488a12c767.png | false | true
FNATIC | Veqaj | controller/initiator | 22 | France | https://i.imgur.com/aMAfn5C.png | true | false
Free Agents | IKANA | initiator/duelist | 25 | Vietnam | https://owcdn.net/img/66f639be340d1.png | false | true
Free Agents | brk | duelist | 23 | Portugal | https://owcdn.net/img/63c305dc710aa.png | false | true
DRX | free1ng | sentinel/initiator | 21 | South_Korea | https://i.imgur.com/uqqwpC9.png | true | false
Free Agents | Jesse | controller/sentinel | 22 | Czech Republic | https://owcdn.net/img/623ba4cc3b804.png | false | true
Free Agents | KovaQ | controller/initiator | 22 | Switzerland | https://i.imgur.com/PSrCbjF.png | false | true
Free Agents | Yoshiii | sentinel/duelist/flex | 22 | Philippines | https://owcdn.net/img/6639d03c599b4.png | false | true
Free Agents | Bunny | duelist/controller | 27 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | aNguiSt | controller/sentinel | 24 | United_Kingdom | https://owcdn.net/img/65e2a69b4a5a8.png | false | true
Free Agents | Addicted | initiator/sentinel | 29 | Portugal | https://owcdn.net/img/63bc7e8a372c5.png | false | true
Gen.G | Ash | duelist/flex | 21 | South_Korea | https://i.imgur.com/li64mkx.png | true | false
DetonatioN FocusMe | Akame | initiator/duelist/flex | 22 | South_Korea | https://i.imgur.com/G5bUJnN.png | true | false
Free Agents | Techno | controller/initiator/sentinel | 20 | India | https://owcdn.net/img/650b781088465.png | false | true
JDG Esports | coconut | controller/sentinel | 22 | Hong_Kong | https://i.imgur.com/6hNVD5p.png | false | false
Free Agents | Turko | sentinel/initiator | 26 | Turkey | https://owcdn.net/img/655c3248e5caa.png | false | true
Free Agents | velis | controller/sentinel | 25 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | YanLi | controller/initiator | 26 | Taiwan | https://owcdn.net/img/66ab0dd3954de.png | false | true
Free Agents | ANDY | duelist/sentinel | 21 | UNKWOWN | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | signed | initiator/controller | 21 | New_Zealand | https://www.vlr.gg/img/base/ph/sil.png | false | true
NRG Esports | skuba | sentinel/controller | 23 | United_States | https://owcdn.net/img/6974067806f34.png | true | false
Free Agents | azys | duelist/initiator/flex | 23 | Philippines | https://owcdn.net/img/65bf2394bfb67.png | false | true
Free Agents | Mojer | duelist/initiator | 25 | Philippines | https://owcdn.net/img/65cca6e0a556a.png | false | true
Free Agents | AKUMAAAAA | duelist/initiator/flex | 24 | France | https://owcdn.net/img/62a85d01e55c9.png | false | true
Free Agents | gobera | duelist/sentinel/flex | 24 | Brazil | https://i.imgur.com/qbSCY6i.png | false | true
Free Agents | Mabuchi | duelist/sentinel/initiator/flex | 20 | Qatar | https://www.vlr.gg/img/base/ph/sil.png | false | true
PCIFIC Esports | NINJA | initiator/duelist | 19 | Poland | https://owcdn.net/img/696fd44184f92.png | true | false
Free Agents | Lumo | controller/initiator/flex | 23 | Russia | https://owcdn.net/img/6639d01773669.png | false | true
Free Agents | AloNeFillz | initiator/controller/sentinel/duelist/flex | 23 | Thailand | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Pa1nt | duelist | 21 | United_States | https://i.ibb.co/HFf8YwX/pa1nt.png | false | true
Free Agents | kiss | duelist/controller/flex | 21 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Sushiboys | sentinel/initiator/controller/duelist/flex | 25 | Thailand | https://owcdn.net/img/65ef125d7a9b9.png | false | true
Free Agents | Ale | duelist/initiator/sentinel/flex | 23 | Sweden | https://owcdn.net/img/61d5d6a3afc50.png | false | true
Free Agents | Avvix | controller/initiator/flex | 25 | Saudi_Arabia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Uta | sentinel/duelist/controller/flex | 21 | UNKWOWN | https://owcdn.net/img/652435a30355e.png | false | true
Rex Regum Qeon | Kushy | sentinel/initiator/flex | 21 | Indonesia | https://owcdn.net/img/6821f764bd20a.png | true | false
Free Agents | cheK | controller | 21 | Kuwait | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | kumi | duelist/controller/flex | 21 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Fizzy | sentinel/controller/flex | 25 | Portugal | https://owcdn.net/img/6610cbce26eb0.png | false | true
Free Agents | zery | duelist/sentinel | 21 | UNKWOWN | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | aimDLL | sentinel/controller | 24 | Turkey | https://owcdn.net/img/644f700234eaa.png | false | true
Free Agents | Tag | sentinel | 21 | Italy | https://owcdn.net/img/65bfd5310a4c0.png | false | true
Free Agents | delz1k | controller/initiator | 25 | Chile | https://owcdn.net/img/60b6c9224021c.png | false | true
Free Agents | Nozz | initiator/controller | 24 | Australia | https://owcdn.net/img/60b6c9224021c.png | false | true
Free Agents | M1kE | sentinel | 23 | Australia | https://owcdn.net/img/64071da6c871e.png | false | true
Free Agents | d1srupt | duelist/initiator/sentinel/flex | 25 | Philippines | https://owcdn.net/img/64255552a502d.png | false | true
LOUD | lukxo | sentinel | 19 | Brazil | https://owcdn.net/img/6889de1f09b08.png | true | false
Free Agents | Crazy NY | initiator/controller/sentinel/flex | 21 | Chile | https://owcdn.net/img/65d8e30d4b5fa.png | false | true
ZETA DIVISION | SyouTa | sentinel/duelist/controller/flex | 22 | Japan | https://owcdn.net/img/678a91dbae974.png | true | false
BBL Esports | Loita | controller/flex | 18 | Turkey | https://owcdn.net/img/6979752e8d3fa.png | true | false
Free Agents | Suka | controller/sentinel | 24 | Vietnam | https://owcdn.net/img/66adbb4968162.png | false | true
Free Agents | Meddo | controller/sentinel/flex | 26 | Sweden | https://owcdn.net/img/65ddf96113bfa.png | false | true
Free Agents | theDoctorr | sentinel/controller/initiator/flex | 30 | Malaysia | https://owcdn.net/img/663a306a247b9.png | false | true
Free Agents | Kssar | duelist/controller | 25 | Saudi_Arabia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | roompa | initiator/controller | 24 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Nanners | sentinel/controller | 23 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | ianto | controller/sentinel/duelist/flex | 20 | Wales | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | T0BA | initiator | 21 | United_Kingdom | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | adverso | initiator/controller/sentinel/flex | 27 | Chile | https://i.imgur.com/F4tLlHa.png | false | true
Free Agents | Br1ckzl | controller | 21 | Syria | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Cunha20 | controller | 19 | Portugal | https://www.vlr.gg/img/base/ph/sil.png | false | true
Evil Geniuses | Okeanos | duelist/flex/initiator/controller | 22 | Vietnam | https://owcdn.net/img/696ef74e20c0e.png | true | false
Free Agents | VYX | controller/sentinel/initiator/flex | 25 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | xiTsha | controller/initiator/duelist/sentinel/flex | 22 | Poland | https://owcdn.net/img/66253df6ac756.png | false | true
Free Agents | Creamydreamy | flex/initiator | 23 | Sweden | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | baddyG | controller | 24 | Poland | https://i.imgur.com/ikEhQTM.png | false | true
Free Agents | PxS | initiator/flex/duelist | 24 | United_States | https://owcdn.net/img/69720304c50e4.png | false | true
Free Agents | ALIVE | duelist/sentinel | 26 | Israel | https://owcdn.net/img/6435e5eaa1c21.png | false | true
Free Agents | Dark3st | controller/initiator/duelist/flex | 25 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Nongshim RedForce | Xross | controller/initiator | 18 | South_Korea | https://owcdn.net/img/6975bb8b4a97c.png | true | false
Free Agents | skylen | initiator/sentinel/controller/flex | 21 | Turkey | https://owcdn.net/img/65c7fd43edb5d.png | false | true
Free Agents | Blessed | initiator/controller | 21 | Iran | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Shazeon | controller/sentinel/initiator/flex | 21 | Germany | https://owcdn.net/img/6664b742185b6.png | false | true
Free Agents | Kntz | controller | 28 | Thailand | https://owcdn.net/img/65c4b3d2c6462.png | false | true
Free Agents | Tonbo | initiator/sentinel | 28 | Japan | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | mitch | initiator/controller | 29 | United_States | https://owcdn.net/img/679c221555b21.png | false | true
Free Agents | ArPoom | controller/sentinel/initiator/flex | 21 | Thailand | https://owcdn.net/img/6565dc2bba800.png | false | true
Free Agents | MAGiK | controller/sentinel | 22 | Netherlands | https://game-tournaments.com/media/logo/p75408.png?81 | false | true
Free Agents | Yotaa | duelist/sentinel | 23 | Japan | https://owcdn.net/img/6639d02dc7d8e.png | false | true
Free Agents | chloric | initiator | 24 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | foxz | initiator/duelist/flex | 26 | Thailand | https://owcdn.net/img/65ef124ea1673.png | false | true
Free Agents | ALL3Y | duelist | 22 | Turkey | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | alexiiik | initiator/duelist/sentinel | 20 | Czech Republic | https://i.imgur.com/l9IIOgg.png | false | true
Free Agents | HANLING | sentinel/initiator | 28 | Argentina | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | seph1roth | controller/sentinel/duelist/flex | 22 | Thailand | https://owcdn.net/img/65c4b62955ee4.png | false | true
Free Agents | Juicy | duelist/controller/flex | 19 | Singapore | https://owcdn.net/img/677d1e0000b8e.png | false | true
Full Sense | Leviathan | controller/initiator | 22 | Thailand | https://owcdn.net/img/6944046a70e0c.png | true | false
Free Agents | luckyMrJ | sentinel/controller | 22 | Ukraine | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Jady | initiator/duelist | 22 | Russia | https://owcdn.net/img/6035208cec644.png | false | true
Free Agents | cgrs | sentinel/initiator | 29 | Thailand | https://owcdn.net/img/65c4b1942127d.png | false | true
Free Agents | SimonD4rk | duelist/controller | 24 | Belarus | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | STYRON | initiator/duelist | 24 | Singapore | https://owcdn.net/img/63e0aacfdf6f9.png | false | true
Free Agents | Hals | controller/sentinel | 19 | Japan | https://www.vlr.gg/img/base/ph/sil.png | false | true`;



const MASTER_PLAYERS_TEXT_EXTRA = `Team | Name | Role(s) | Age | Nationality | ImageURL | Starter | FreeAgent
Free Agents | Paincakes | controller/initiator/sentinel/flex | 23 | United_States | https://owcdn.net/img/630564bd5cb85.png | false | true
Free Agents | Reverie | initiator | 23 | Singapore | https://owcdn.net/img/661780ec2e8ff.png | false | true
Free Agents | JaebiN | duelist | 21 | South_Korea | https://owcdn.net/img/65ffe0dcc6ce0.png | false | true
Free Agents | XyuS | duelist/initiator/flex | 20 | Taiwan | https://owcdn.net/img/66ab0deb6baae.png | false | true
Free Agents | aduka | duelist/initiator/sentinel/flex | 22 | Malaysia | https://owcdn.net/img/65c93e1b21125.png | false | true
Free Agents | JohnOlsen | duelist/sentinel | 27 | Thailand | https://owcdn.net/img/65ef123f66a9f.png | false | true
Free Agents | DVDOV | sentinel/initiator/duelist | 26 | United_Arab_Emirates | https://www.vlr.gg/img/base/ph/sil.png | false | true
ZETA DIVISION | Xdll | initiator/flex | 20 | Japan | https://owcdn.net/img/678a91e7bd2a2.png | true | false
Free Agents | WanZeru | duelist | 18 | Czech Republic | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | lux9 | duelist/initiator | 21 | France | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Nexi | sentinel/controller | 24 | Philippines | https://owcdn.net/img/65cca6eb39eb2.png | false | true
Free Agents | prince | sentinel/controller/duelist | 27 | Brazil | https://owcdn.net/img/63b463a44b109.png | false | true
Free Agents | Magnus | sentinel/duelist | 23 | Germany | https://owcdn.net/img/6657f64a48443.png | false | true
Free Agents | Reformed | duelist/sentinel | 22 | Canada | https://owcdn.net/img/641693ee7965c.png | false | true
Free Agents | niffy | duelist/initiator/sentinel/flex | 24 | Thailand | https://owcdn.net/img/6410217bbd7e5.png | false | true
Free Agents | McKinley | initiator/sentinel | 23 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Potter | duelist/sentinel | 21 | Thailand | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Bard0lf | controller | 23 | Turkey | https://owcdn.net/img/66526d1707b0e.png | false | true
Free Agents | Mot1on | sentinel/initiator | 23 | Slovenia | https://owcdn.net/img/650b5459a2267.png | false | true
Free Agents | ting2k5 | sentinel/duelist/flex | 21 | Vietnam | https://www.vlr.gg/img/base/ph/sil.png | false | true
FunPlus Phoenix | sScary | sentinel/controller | 26 | Thailand | https://owcdn.net/img/651eec4e16bdd.png | true | false
Free Agents | adrnking | initiator/sentinel/controller | 27 | Indonesia | https://owcdn.net/img/6669ced098261.png | false | true
Free Agents | SkRossi | initiator/sentinel | 28 | India | https://owcdn.net/img/65bdc76814d4f.png | false | true
Free Agents | RobbieBk | initiator/sentinel | 24 | Netherlands | https://owcdn.net/img/6889de8ba5e02.png | false | true
Free Agents | szoren | duelist/initiator/flex | 27 | Denmark | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | SemberN | controller/sentinel/initiator | 21 | Norway | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | vAgue | duelist | 21 | United_Arab_Emirates | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | CLZ | flex/initiator | 23 | Japan | https://owcdn.net/img/678a91d34f18a.png | false | true
Free Agents | cavern | initiator | 21 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Felix | initiator/controller | 22 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | luckeRRR | initiator/duelist | 29 | Germany | https://owcdn.net/img/6664b736368ca.png | false | true
Free Agents | d3ffo | duelist | 24 | Russia | https://owcdn.net/img/60a0cf20e6b13.png | false | true
Free Agents | Nythan | initiator/sentinel | 21 | Indonesia | https://owcdn.net/img/66343fd327590.png | false | true
Free Agents | smiley | controller/initiator | 21 | Canada | https://owcdn.net/img/650227fc774b1.png | false | true
Free Agents | Momiji | controller/initiator | 22 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | swagzor | duelist | 17 | Russia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | furbsa | duelist/flex | 23 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | ValdyN | duelist/initiator/flex | 21 | Indonesia | https://owcdn.net/img/66711853d46ff.png | false | true
Free Agents | andrew | duelist/controller | 21 | United_States | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | jvhz | duelist/sentinel | 24 | Chile | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | riyabtw | initiator/duelist/flex | 21 | UNKWOWN | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | wedid | controller | 26 | Canada | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | SecondLove | sentinel/controller/initiator | 21 | Philippines | https://owcdn.net/img/65cd5ba51c92d.png | false | true
Free Agents | kugio | initiator/duelist/flex | 24 | Qatar | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | N0NGLAZ | sentinel/initiator | 21 | Thailand | https://owcdn.net/img/6565dc3c7bb57.png | false | true
Free Agents | snw | duelist/flex | 23 | Brazil | https://owcdn.net/img/67abe1974f0eb.png | false | true
DetonatioN FocusMe | yatsuka | sentinel/duelist | 18 | Japan | https://owcdn.net/img/682d95bed801b.png | true | false
Free Agents | Goaster | duelist/initiator/flex | 24 | France | https://owcdn.net/img/643931fcc0ef6.png | false | true
Free Agents | ZYND | duelist/controller | 21 | Philippines | https://owcdn.net/img/655c244314137.png | false | true
Free Agents | memset | controller/sentinel | 21 | France | https://owcdn.net/img/6693943fd0e6c.png | false | true
Free Agents | Kevzii | controller/initiator | 21 | Philippines | https://owcdn.net/img/655c300708259.png | false | true
Free Agents | lg1c | duelist | 23 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Freyy | controller | 21 | Poland | https://owcdn.net/img/667c4816ccd98.png | false | true
Free Agents | zeek | initiator/flex | 24 | Poland | https://owcdn.net/img/637dfcc50c1d7.png | false | true
Free Agents | yoman | initiator/flex | 29 | South_Korea | https://i.imgur.com/gHmhSja.png | false | true
Free Agents | Myth | controller/sentinel | 25 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | ip0TT | duelist/controller/flex | 26 | Turkey | https://owcdn.net/img/65f086cd062ca.png | false | true
Free Agents | mika | duelist/sentinel/controller/flex | 22 | Indonesia | https://owcdn.net/img/663e3b53d06ee.png | false | true
Free Agents | MaiShiu | initiator/controller | 21 | New_Zealand | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Feeqn | sentinel/controller | 25 | Finland | https://owcdn.net/img/61e74e914e0df.png | false | true
Free Agents | Snowi | initiator/sentinel | 19 | Finland | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Kalkkuna | duelist/sentinel | 21 | Finland | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | stellar | initiator/controller/sentinel/flex/duelist | 29 | United_States | https://owcdn.net/img/6416922568477.png | false | true
Free Agents | sym | duelist/initiator/flex | 20 | United_States | https://i.ibb.co/XzVj5KC/symtsm.png | false | true
Free Agents | frostmind | sentinel/controller/initiator/flex | 21 | Indonesia | https://owcdn.net/img/663e3b426ef76.png | false | true
Free Agents | Andersin | controller | 28 | United_States | https://owcdn.net/img/63058448f28f3.png | false | true
Free Agents | pudj | controller/sentinel/initiator | 21 | Singapur | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | SHINSEI | duelist/sentinel | 21 | Singapore | https://owcdn.net/img/64106311d997b.png | false | true
Free Agents | hellff | initiator | 27 | India | https://owcdn.net/img/64d92c9f91ecf.png | false | true
Free Agents | Virtyy | duelist/flex | 23 | Dominican_Republic | https://owcdn.net/img/687b3fba0ad89.png | false | true
Free Agents | SID | duelist/controller/initiator | 20 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Pkm | controller/sentinel/duelist/flex | 19 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | prozin | initiator/controller/sentinel/flex | 24 | Brazil | https://owcdn.net/img/60a1c0cbc1751.png | false | true
Free Agents | thief | sentinel/controller | 27 | United_States | https://i.ibb.co/GTZ7FQh/thiefmxs.png | false | true
Free Agents | shion | initiator/sentinel | 30 | Brazil | https://owcdn.net/img/64328a904b653.png | false | true
Free Agents | Kibojn | initiator/sentinel | 21 | India | https://owcdn.net/img/65c7b83871246.png | false | true
Free Agents | NiSMO | flex/duelist/initiator | 31 | Canada | https://i.imgur.com/5NrPYmW.png | false | true
LOUD | erde | flex/controller/sentinel/duelist | 18 | Chile | https://www.vlr.gg/img/base/ph/sil.png | true | false
Free Agents | bones | controller | 18 | Vietnam | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | neptune | initiator/controller | 23 | United_States | https://owcdn.net/img/6296947b3168a.png | false | true
Free Agents | Rainy | controller/sentinel | 30 | Taiwan | https://owcdn.net/img/66ab0de44e06f.png | false | true
Free Agents | khz | sentinel/duelist/initiator/flex | 21 | Chile | https://owcdn.net/img/65d8e3271d125.png | false | true
Free Agents | Madelyn | controller/initiator | 21 | Indonesia | https://owcdn.net/img/645ce9e29fd43.png | false | true
Free Agents | Trash | controller/sentinel/flex | 5914031408731904 | Brazil | https://owcdn.net/img/6678de139711d.png | false | true
Free Agents | RizoN | initiator/sentinel | 21 | Saudi_Arabia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | H1ber | initiator/controller/duelist/flex | 27 | Finland | https://owcdn.net/img/63b7a4264bfc0.png | false | true
Free Agents | RedLight | initiator/controller | 22 | South_Korea | https://owcdn.net/img/65ffe1038887d.png | false | true
Free Agents | silenttt | initiator/controller/sentinel/flex | 24 | Portugal | https://owcdn.net/img/6282a5e050f6e.png | false | true
Free Agents | chanformer | controller/sentinel | 25 | United_Kingdom | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Dev0 | duelist/controller | 23 | United_Kingdom | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | muto | initiator/sentinel/controller | 22 | Japan | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | lurzy0y0 | initiator/controller | 29 | Turkey | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Nasty | duelist/sentinel | 21 | Taiwan | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | ShawateRR | controller/sentinel | 30 | Jordan | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | par scofield | duelist | 21 | Philippines | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | globeX | controller/duelist | 19 | Russia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Patrui | controller/sentinel/initiator | 21 | Turkey | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | d0rf | initiator/sentinel | 25 | Vietnam | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Divine | controller/sentinel/initiator/flex | 25 | Singapore | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | alvar | initiator/sentinel/duelist/flex | 27 | Jordan | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Akira | initiator/controller/sentinel/flex | 23 | Portugal | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Instxnct | duelist/initiator/flex | 21 | Canada | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | JustnatioNN | controller/sentinel/initiator | 27 | Kuwait | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | BRIAN | sentinel/duelist | 20 | Japan | https://www.vlr.gg/img/base/ph/sil.png | false | true`;



const MASTER_PLAYERS_TEXT_EXTRA_2 = `Team | Name | Role(s) | Age | Nationality | ImageURL | Starter | FreeAgent
Free Agents | Maka | flex/sentinel/duelist/controller/initiator | 23 | Mexico | https://owcdn.net/img/63e0cc941304f.png | false | true
Free Agents | clutchz | flex/sentinel/duelist/controller/initiator | 19 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Ju4nn | flex/sentinel/duelist/controller/initiator | 22 | Venezuela | https://owcdn.net/img/685084df0e61a.png | false | true
Free Agents | E13 | flex/sentinel/duelist/controller/initiator | 20 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | RAINMAKER | flex/sentinel/duelist/controller/initiator | 21 | Guatemala | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Hada | flex/sentinel/duelist/controller/initiator | 19 | Mexico | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Yarwiz | flex/sentinel/duelist/controller/initiator | 23 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Xhowi | flex/sentinel/duelist/controller/initiator | 23 | Dominican_Republic | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Fotzy | flex/sentinel/duelist/controller/initiator | 21 | Mexico | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Danielesflo | flex/sentinel/duelist/controller/initiator | 22 | Colombia | https://owcdn.net/img/6275b85c4bc27.png | false | true
Free Agents | vApes | flex/sentinel/duelist/controller/initiator | 23 | Colombia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
LEVIATÁN | Neon | duelist/sentinel/flex/oper | 18 | Argentina | https://owcdn.net/img/69234b3d0a58d.png | true | false
KRÜ Esports | Dantedeu5 | duelist | 18 | Argentina | https://owcdn.net/img/687bfa8d54924.png | true | false
Free Agents | ghoul33 | duelist/sentinel | 19 | Brazil | https://www.vlr.gg/img/base/ph/sil.png | false | true
LEVIATÁN | blowz | initiator/flex | 18 | Brazil | https://owcdn.net/img/69234aef86f4b.png | true | false
Free Agents | david | flex/sentinel/duelist/controller/initiator | 21 | Chile | https://owcdn.net/img/67abe1e07b7a0.png | false | true
Free Agents | phc | controller/sentinel | 19 | Brazil | https://owcdn.net/img/67b7709229c18.png | false | true
Free Agents | suther | flex/sentinel/duelist/controller/initiator | 23 | Chile | https://owcdn.net/img/609f0798e6de3.png | false | true
Free Agents | Mystizip | flex/sentinel/duelist/controller/initiator | 19 | Chile | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ganter | flex/sentinel/duelist/controller/initiator | 22 | Chile | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | benG | flex/sentinel/duelist/controller/initiator | 22 | Chile | https://owcdn.net/img/65d8e2f1e011b.png | false | true
Free Agents | Mikey Tap | sentinel/duelist/initiator | 18 | Argentina | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | jotinha | flex/sentinel/duelist/controller/initiator | 21 | Argentina | https://owcdn.net/img/672c03fc9d63a.png | false | true
Free Agents | vaiZ | flex/sentinel/duelist/controller/initiator | 22 | Chile | https://owcdn.net/img/67ca0a43a1fa8.png | false | true
Free Agents | alca | flex/sentinel/duelist/controller/initiator | 22 | Chile | https://owcdn.net/img/639aa344f0379.png | false | true
Free Agents | NicoMachine | flex/sentinel/duelist/controller/initiator | 20 | Chile | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | bnj | flex/sentinel/duelist/controller/initiator | 22 | Argentina | https://owcdn.net/img/672c03e2b0cef.png | false | true
Free Agents | MiradaNinja | sentinel/controller/flex | 18 | Chile | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Tio | flex/sentinel/duelist/controller/initiator | 20 | Chile | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
TYLOO | Erv | controller/sentinel | 18 | China | https://www.vlr.gg/img/base/ph/sil.png | false | false
Free Agents | tinchoff | flex/sentinel/duelist/controller/initiator | 25 | Argentina | https://owcdn.net/img/692da72926318.png | false | true
Free Agents | ruso | flex/sentinel/duelist/controller/initiator | 23 | Argentina | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Miyeon | flex/sentinel/duelist/controller/initiator | 22 | Chile | https://owcdn.net/img/6861a24b8e1c8.png | false | true
Free Agents | lucasvade | flex/sentinel/duelist/controller/initiator | 19 | Chile | https://owcdn.net/img/609f0174379cc.png | false | true
Free Agents | 21 | flex/sentinel/duelist/controller/initiator | 21 | Chile | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | 1kuzohh | flex/sentinel/duelist/controller/initiator | 22 | Chile | https://owcdn.net/img/6532d1d5affb4.png | false | true
Free Agents | KNZY | flex/sentinel/duelist/controller/initiator | 20 | Chile | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Mathi | flex/sentinel/duelist/controller/initiator | 19 | Uruguay | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ego1st | flex/sentinel/duelist/controller/initiator | 21 | Uruguay | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | FETA | flex/sentinel/duelist/controller/initiator | 20 | New_Zealand | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | FalleN | flex/sentinel/duelist/controller/initiator | 21 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | NOVAE | flex/sentinel/duelist/controller/initiator | 20 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | ACE | flex/sentinel/duelist/controller/initiator | 21 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | genk | flex/sentinel/duelist/controller/initiator | 22 | Indonesia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | OvO | flex/sentinel/duelist/controller/initiator | 23 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | devid | flex/sentinel/duelist/controller/initiator | 20 | Cambodia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Minimise | flex/sentinel/duelist/controller/initiator | 20 | Australia | https://owcdn.net/img/6537a3472bff3.png | false | true
Free Agents | joms | flex/sentinel/duelist/controller/initiator | 21 | China | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | LEW | flex/sentinel/duelist/controller/initiator | 21 | United_Kingdom | https://owcdn.net/img/68453d486dff1.png | false | true
Free Agents | iBrocky | flex/sentinel/duelist/controller/initiator | 21 | Australia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Smylie | flex/sentinel/duelist/controller/initiator | 19 | Australia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Jawsy | flex/sentinel/duelist/controller/initiator | 20 | Australia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | WATER | flex/sentinel/duelist/controller/initiator | 20 | Australia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ANDY | flex/sentinel/duelist/controller/initiator | 21 | Australia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | LOATHE | flex/sentinel/duelist/controller/initiator | 19 | Australia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | KADIRI | flex/sentinel/duelist/controller/initiator | 21 | Australia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true`;



const MASTER_PLAYERS_TEXT_EXTRA_3 = `Team | Name | Role(s) | Age | Nationality | ImageURL | Starter | FreeAgent
Free Agents | vurtex | flex/sentinel/duelist/controller/initiator | 20 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Pax | flex/sentinel/duelist/controller/initiator | 19 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | siJk | flex/sentinel/duelist/controller/initiator | 21 | Russia | https://owcdn.net/img/63f4b03ebb657.png | false | true
Free Agents | TopLuciano | flex/sentinel/duelist/controller/initiator | 20 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Viks | flex/sentinel/duelist/controller/initiator | 22 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Yujii | flex/sentinel/duelist/controller/initiator | 23 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Manager | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Titan | flex/sentinel/duelist/controller/initiator | 19 | Italy | https://owcdn.net/img/65c2a52a764b9.png | false | true
Free Agents | Morphiw0w | flex/sentinel/duelist/controller/initiator | 20 | Italy | https://owcdn.net/img/63c15ce0c2348.png | false | true
Free Agents | roxas | flex/sentinel/duelist/controller/initiator | 22 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | dede | flex/sentinel/duelist/controller/initiator | 23 | Italy | https://owcdn.net/img/68725fa3a5fca.png | false | true
Free Agents | suin0 | flex/sentinel/duelist/controller/initiator | 23 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | xen | flex/sentinel/duelist/controller/initiator | 19 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Sarky | flex/sentinel/duelist/controller/initiator | 21 | Armenia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | zeta | flex/sentinel/duelist/controller/initiator | 22 | Nigeria | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | PluckyPiva | flex/sentinel/duelist/controller/initiator | 21 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Nino | flex/sentinel/duelist/controller/initiator | 20 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | esc | flex/sentinel/duelist/controller/initiator | 19 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | p1ngwu | flex/sentinel/duelist/controller/initiator | 21 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | lovers RU | flex/sentinel/duelist/controller/initiator | 19 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | HEXHEXHEX | flex/sentinel/duelist/controller/initiator | 21 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Nix | flex/sentinel/duelist/controller/initiator | 22 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Julba | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | snowzera | flex/sentinel/duelist/controller/initiator | 21 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | adilzera | flex/sentinel/duelist/controller/initiator | 21 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Kentrax | flex/sentinel/duelist/controller/initiator | 20 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | mEgA | flex/sentinel/duelist/controller/initiator | 22 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | highh | flex/sentinel/duelist/controller/initiator | 23 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | mrteo | flex/sentinel/duelist/controller/initiator | 22 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Perc | flex/sentinel/duelist/controller/initiator | 20 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | RqGa | flex/sentinel/duelist/controller/initiator | 21 | Belgium | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | uryuu | flex/sentinel/duelist/controller/initiator | 19 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Infamous | flex/sentinel/duelist/controller/initiator | 22 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | marA | flex/sentinel/duelist/controller/initiator | 22 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | blue | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | RikiLeNoir | flex/sentinel/duelist/controller/initiator | 23 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | paduz | flex/sentinel/duelist/controller/initiator | 23 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | LUCIF | flex/sentinel/duelist/controller/initiator | 19 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | jiaa | flex/sentinel/duelist/controller/initiator | 19 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Blad3r | flex/sentinel/duelist/controller/initiator | 23 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | kniflex | flex/sentinel/duelist/controller/initiator | 21 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Seoldam | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://owcdn.net/img/682d95b7398ab.png | false | true
Free Agents | KEN | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Aace | flex/sentinel/duelist/controller/initiator | 23 | Japan | https://owcdn.net/img/67963672ba35b.png | false | true
ZETA DIVISION | eKo | duelist/controller/initiator | 22 | South_Korea | https://owcdn.net/img/65534235d6705.png | true | false
Free Agents | JoXJo | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://owcdn.net/img/682d9595bfeda.png | false | true
Free Agents | Only1 | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://owcdn.net/img/65b438be3360d.png | false | true
Free Agents | Anthem | flex/sentinel/duelist/controller/initiator | 23 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | MrTenzouEz | flex/sentinel/duelist/controller/initiator | 22 | Japan | https://owcdn.net/img/6796368c67bdb.png | false | true
Free Agents | NOBITA | flex/sentinel/duelist/controller/initiator | 20 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
DetonatioN FocusMe | Caedye | sentinel/duelist | 21 | Japan | https://owcdn.net/img/682d95ad8a7a4.png | true | false
Free Agents | RILM | flex/sentinel/duelist/controller/initiator | 20 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Jinbey | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | GON | flex/sentinel/duelist/controller/initiator | 23 | Japan | https://owcdn.net/img/679636694594b.png | false | true
Free Agents | BlackWiz | flex/sentinel/duelist/controller/initiator | 20 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Luca | flex/sentinel/duelist/controller/initiator | 19 | Japan | https://owcdn.net/img/686ce92f9dc30.png | false | true
Free Agents | Allen | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://owcdn.net/img/6547ec75ef3d1.png | false | true
Free Agents | g4ll | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Esperanza | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://owcdn.net/img/6138daf52b406.png | false | true
Free Agents | yutaro | flex/sentinel/duelist/controller/initiator | 22 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | hatto | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | HoneyBunny | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Minty | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://owcdn.net/img/682d95a293246.png | false | true
Free Agents | bazz | flex/sentinel/duelist/controller/initiator | 22 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Jan | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | flora | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | fukukeN | flex/sentinel/duelist/controller/initiator | 19 | Japan | https://owcdn.net/img/686cdf419110c.png | false | true
Free Agents | YoWamu | flex/sentinel/duelist/controller/initiator | 19 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | kaua | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Rize | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Neal X | flex/sentinel/duelist/controller/initiator | 20 | South_Korea | https://owcdn.net/img/60ee0a15a5b85.png | false | true
Free Agents | Xiaonuo | flex/sentinel/duelist/controller/initiator | 19 | China | https://owcdn.net/img/6537a33d64412.png | false | true
Free Agents | KillAA | flex/sentinel/duelist/controller/initiator | 22 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Kippei | flex/sentinel/duelist/controller/initiator | 19 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Misaya | flex/sentinel/duelist/controller/initiator | 23 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Chay | flex/sentinel/duelist/controller/initiator | 22 | Japan | https://owcdn.net/img/686cdf2f468ad.png | false | true
Free Agents | mimi | flex/sentinel/duelist/controller/initiator | 22 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | foumy | flex/sentinel/duelist/controller/initiator | 22 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | taru | flex/sentinel/duelist/controller/initiator | 20 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Hands | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | MeatPieN | flex/sentinel/duelist/controller/initiator | 22 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Falk | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Ask | flex/sentinel/duelist/controller/initiator | 19 | Japan | https://owcdn.net/img/67934b31030a2.png | false | true
Free Agents | x4sioy | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Lucky | flex/sentinel/duelist/controller/initiator | 22 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Noa | flex/sentinel/duelist/controller/initiator | 21 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | zerurun | flex/sentinel/duelist/controller/initiator | 23 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Tenma | flex/sentinel/duelist/controller/initiator | 19 | Japan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Evil Geniuses | dgzin | duelist | 26 | Brazil | https://i.imgur.com/lyP3z5K.png | true | false
Free Agents | QCK | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://owcdn.net/img/66306e155f66d.png | false | true
Free Agents | forbanz | duelist | 20 | Brazil | https://owcdn.net/img/67ae72fd1cc85.png | false | true
Free Agents | Brinks | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://owcdn.net/img/67ae7336643a1.png | false | true
Free Agents | Askia | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://owcdn.net/img/67ae72e40500b.png | false | true
Free Agents | Tisora | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://owcdn.net/img/67b76eb25f66a.png | false | true
Free Agents | guuih | flex/sentinel/duelist/controller/initiator | 26 | Brazil | https://owcdn.net/img/67b7729e6026c.png | false | true
Free Agents | pollo | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://owcdn.net/img/63cff8ea88111.png | false | true
Free Agents | Kring | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://owcdn.net/img/6680b0bf11f27.png | false | true
KRÜ Esports | mwzera | initiator/duelist | 24 | Brazil | https://i.imgur.com/jMtZVGd.png | true | false
Free Agents | tkzin | duelist | 17 | Brazil | https://owcdn.net/img/67ad15cbeddca.png | false | true
Free Agents | maestr0 | duelist/controller | 20 | Brazil | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | sanoj | sentinel/controller | 17 | Brazil | https://owcdn.net/img/68372067e6a27.png | false | true
Free Agents | RND | flex/sentinel/duelist/controller/initiator | 19 | Brazil | https://owcdn.net/img/65f09387896fe.png | false | true
Free Agents | kramarick | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/67afd5af776fa.png | false | true
Free Agents | lucks | sentinel | 17 | Brazil | https://owcdn.net/img/67ae7353e89f7.png | false | true
Free Agents | Bruxo | duelist/sentinel/flex | 18 | Brazil | https://owcdn.net/img/68372056cb65e.png | false | true
Free Agents | havoc | sentinel/duelist | 19 | Brazil | https://owcdn.net/img/689e186fb11bd.png | false | true
Free Agents | v1nny | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://i.imgur.com/h5gLbfC.png | false | true
Free Agents | kon4n | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://owcdn.net/img/668e3af50a8d6.png | false | true
Free Agents | Zanatsu | duelist | 19 | Brazil | https://owcdn.net/img/65e0a6b77f994.png | false | true
Free Agents | duhT | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/62d073b704d80.png | false | true
Free Agents | dth | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://owcdn.net/img/68786400cd2d6.png | false | true
Free Agents | Natale | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://owcdn.net/img/6680b198478cf.png | false | true
Free Agents | Siduzord | initiator/flex | 26 | Brazil | https://owcdn.net/img/67b76ff50d0e5.png | false | true
Free Agents | Yeah | duelist | 21 | Brazil | https://owcdn.net/img/67afda7583f80.png | false | true
Free Agents | GuhRVN | controller | 25 | Brazil | https://owcdn.net/img/6678de84a1b04.png | false | true
Free Agents | gbz | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Loweed | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/68372083f1ef2.png | false | true
Free Agents | above | flex/sentinel/duelist/controller/initiator | 21 | Brazil | https://owcdn.net/img/67a2564633f83.png | false | true
Free Agents | pedropacoca | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | gaabxx | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://owcdn.net/img/65e0a6e6c899f.png | false | true
Free Agents | sw | controller/sentinel | 22 | Brazil | https://owcdn.net/img/67ad16125a4e1.png | false | true
Free Agents | skz | flex/sentinel/duelist/controller/initiator | 19 | Brazil | https://owcdn.net/img/6526362ed8176.png | false | true
Free Agents | taka | flex/sentinel/duelist/controller/initiator | 19 | Brazil | https://owcdn.net/img/687863e24b28b.png | false | true
Free Agents | deNaro | flex/sentinel/duelist/controller/initiator | 19 | Brazil | https://owcdn.net/img/67ae737308a19.png | false | true
Free Agents | mixyce | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/6837204c37408.png | false | true
Free Agents | txddy | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://owcdn.net/img/61ee012853bea.png | false | true
Free Agents | Luid | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | aztex | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | chase | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://owcdn.net/img/6230e853015e4.png | false | true
Free Agents | Tiezzi | flex/sentinel/duelist/controller/initiator | 21 | Italy | https://owcdn.net/img/68371dcb6576d.png | false | true
Free Agents | raafa | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://owcdn.net/img/6678dcef2af43.png | false | true
Free Agents | PKX | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/67afdb231235f.png | false | true
Free Agents | Loss | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Champzera | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | lowz | sentinel/duelist | 17 | Brazil | https://owcdn.net/img/68371dd98f8d5.png | false | true
Free Agents | peixeh | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/687865f80bee1.png | false | true
Free Agents | Myssen | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | nicksz | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/66f9fda38b748.png | false | true
Free Agents | glym | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Campos | flex/sentinel/duelist/controller/initiator | 19 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | swag | sentinel | 21 | Brazil | https://owcdn.net/img/68016157b593b.png | false | true
Free Agents | Novi | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | saalped | flex/sentinel/duelist/controller/initiator | 19 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | hunterx | flex/sentinel/duelist/controller/initiator | 19 | Brazil | https://owcdn.net/img/6820eb5a9e910.png | false | true
Free Agents | Renna | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/67afd634ce831.png | false | true
Free Agents | Stwz1 | flex/sentinel/duelist/controller/initiator | 19 | Brazil | https://owcdn.net/img/67afda3fc9263.png | false | true
Free Agents | desire | initiator | 21 | Brazil | https://owcdn.net/img/68377b933617b.png | false | true
Free Agents | vit9ine | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Teco | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Kenkayyy | flex/sentinel/duelist/controller/initiator | 21 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Nilo | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/68786598d0986.png | false | true
Free Agents | bruninej | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Tokky | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | injaguar | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Ginilson | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/653d6c22178cd.png | false | true
Free Agents | Frozenn | flex/sentinel/duelist/controller/initiator | 20 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | lugn | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | vinizin | flex/sentinel/duelist/controller/initiator | 23 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Biscoit1n | flex/sentinel/duelist/controller/initiator | 20 | Brazil | https://owcdn.net/img/65e0acf5436e1.png | false | true
Free Agents | wackie | flex/sentinel/duelist/controller/initiator | 21 | Estonia | https://owcdn.net/img/686ce23103889.png | false | true
Free Agents | Anq | flex/sentinel/duelist/controller/initiator | 20 | Russia | https://owcdn.net/img/686ce260cfbca.png | false | true
Free Agents | Enzo | initiator/flex | 29 | France | https://owcdn.net/img/65a3e4c4873fc.png | false | true
All Gamers | f4ngeer | duelist/sentinel | 18 | Russia | https://www.vlr.gg/img/base/ph/sil.png | true | false
Free Agents | Sp1ke | flex/sentinel/duelist/controller/initiator | 19 | Russia | https://owcdn.net/img/678091d83751a.png | false | true
Free Agents | Kozok | flex/sentinel/duelist/controller/initiator | 19 | Poland | https://owcdn.net/img/67e88d9bd0673.png | false | true
Free Agents | poeth | flex/sentinel/duelist/controller/initiator | 20 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Cleeann | flex/sentinel/duelist/controller/initiator | 21 | France | https://owcdn.net/img/661b6bd842fbe.png | false | true
Free Agents | Ao | flex/sentinel/duelist/controller/initiator | 20 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Sevire | flex/sentinel/duelist/controller/initiator | 23 | United_Kingdom | https://owcdn.net/img/67e0d9aa9daa6.png | false | true
Free Agents | Lucio | flex/sentinel/duelist/controller/initiator | 22 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | chiwa | flex/sentinel/duelist/controller/initiator | 19 | Russia | https://owcdn.net/img/680a933bb42b3.png | false | true
Free Agents | nysHAA | flex/sentinel/duelist/controller/initiator | 19 | France | https://owcdn.net/img/663968ac1f8de.png | false | true
Free Agents | Kipperman | flex/sentinel/duelist/controller/initiator | 19 | Turkey | https://owcdn.net/img/65e0134156f37.png | false | true
Free Agents | Vbbooy | flex/sentinel/duelist/controller/initiator | 21 | Belgium | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | hAwksinho | flex/sentinel/duelist/controller/initiator | 22 | Morocco | https://owcdn.net/img/6594c2b03712c.png | false | true
Free Agents | TITOUNE | flex/sentinel/duelist/controller/initiator | 20 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | HyP | sentinel | 20 | France | https://owcdn.net/img/62a07bbd9d203.png | false | true
Free Agents | Killu | flex/sentinel/duelist/controller/initiator | 19 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | mikee | controller | 21 | France | https://owcdn.net/img/639a9ab8487bb.png | false | true
Free Agents | Babax | flex/sentinel/duelist/controller/initiator | 22 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | DGR | flex/sentinel/duelist/controller/initiator | 23 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Yohpa | flex/sentinel/duelist/controller/initiator | 22 | France | https://owcdn.net/img/67e2175cace88.png | false | true
Free Agents | Ktori | flex/sentinel/duelist/controller/initiator | 21 | France | https://owcdn.net/img/6618917805a63.png | false | true
Free Agents | izana | flex/sentinel/duelist/controller/initiator | 22 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Wissite1 | flex/sentinel/duelist/controller/initiator | 22 | France | https://owcdn.net/img/643aa9d8e0b6b.png | false | true
Free Agents | soren | flex/sentinel/duelist/controller/initiator | 23 | France | https://owcdn.net/img/67e0d9cae6971.png | false | true
Free Agents | NowaXxZang | flex/sentinel/duelist/controller/initiator | 23 | France | https://owcdn.net/img/678091c08a98a.png | false | true
Free Agents | NRK | flex/sentinel/duelist/controller/initiator | 23 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | poegii | flex/sentinel/duelist/controller/initiator | 19 | Belgium | https://owcdn.net/img/653b1bd881949.png | false | true
Free Agents | roxie | flex/sentinel/duelist/controller/initiator | 20 | Lithuania | https://owcdn.net/img/686ce258db2da.png | false | true
Free Agents | Yuta | flex/sentinel/duelist/controller/initiator | 19 | France | https://owcdn.net/img/678091e9d5a0a.png | false | true
Free Agents | LunaTiK | flex/sentinel/duelist/controller/initiator | 19 | Vietnam | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Lazare | flex/sentinel/duelist/controller/initiator | 22 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Akio | flex/sentinel/duelist/controller/initiator | 21 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Jetix | flex/sentinel/duelist/controller/initiator | 21 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Tenshi | flex/sentinel/duelist/controller/initiator | 22 | Netherlands | https://owcdn.net/img/653b1a32e7ff8.png | false | true
Free Agents | ease | flex/sentinel/duelist/controller/initiator | 23 | Spain | https://owcdn.net/img/67e0d99973b8c.png | false | true
Free Agents | askoo | flex/sentinel/duelist/controller/initiator | 23 | France | https://owcdn.net/img/6594c179d6c72.png | false | true
Free Agents | khe0ps | flex/sentinel/duelist/controller/initiator | 20 | France | https://owcdn.net/img/64353080ac617.png | false | true
Free Agents | Juskay | flex/sentinel/duelist/controller/initiator | 19 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | kurotchi | flex/sentinel/duelist/controller/initiator | 19 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Tr0mA | flex/sentinel/duelist/controller/initiator | 19 | Morocco | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Rouss | flex/sentinel/duelist/controller/initiator | 19 | Turkey | https://owcdn.net/img/678732f47880e.png | false | true
Free Agents | ORI4K | flex/sentinel/duelist/controller/initiator | 19 | France | https://owcdn.net/img/668772b3aa055.png | false | true
Free Agents | k9lyos | flex/sentinel/duelist/controller/initiator | 23 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | azume | flex/sentinel/duelist/controller/initiator | 21 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | JohnieBoy | flex/sentinel/duelist/controller/initiator | 19 | Syria | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | iDex | flex/sentinel/duelist/controller/initiator | 23 | Belgium | https://owcdn.net/img/6753a65844b25.png | false | true
Free Agents | Nuevo | flex/sentinel/duelist/controller/initiator | 22 | France | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Spear | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | sterben | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://owcdn.net/img/6700104fc2291.png | false | true
Free Agents | VenTT | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://owcdn.net/img/6783b0b4205b0.png | false | true
Free Agents | JN3v1cE | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://owcdn.net/img/679eb18ea428d.png | false | true
BBL Esports | lovers rock | duelist | 19 | Turkey | https://owcdn.net/img/697975c71d41b.png | true | false
ULF Esports | Favian | sentinel/flex/initiator/duelist | 22 | Turkey | https://owcdn.net/img/686b1241c8e2f.png | true | false
ULF Esports | s0pp | duelist/sentinel | 18 | Turkey | https://i.imgur.com/VvK0tlW.png | true | false
Free Agents | dRKY | flex/sentinel/duelist/controller/initiator | 19 | Turkey | https://owcdn.net/img/679a1c265b2d3.png | false | true
ULF Esports | nekky | initiator/flex | 21 | Turkey | https://owcdn.net/img/67e3a9dae92b3.png | true | false
FUT Esports | baha | controller/initiator | 20 | Turkey | https://owcdn.net/img/697aba5dec2dc.png | true | false
Free Agents | deminatiX | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://owcdn.net/img/679a1da151882.png | false | true
Free Agents | Lusadris | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/655c44cf98d65.png | false | true
ULF Esports | audaz | controller/sentinel | 20 | Turkey | https://owcdn.net/img/68019eb946c9f.png | true | false
Free Agents | Touven | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://owcdn.net/img/668e53e41b9c5.png | false | true
Free Agents | oroni | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | JrayN | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://owcdn.net/img/680a950d66891.png | false | true
Free Agents | Burzzy | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://owcdn.net/img/63e10270ba399.png | false | true
Free Agents | Archfiend | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Antsy | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/6428b421af999.png | false | true
ULF Esports | echo | sentinel/controller | 18 | Turkey | https://owcdn.net/img/67e3aa1120d97.png | false | false
Free Agents | Fel1x | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | sh1va | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/65d647e76815b.png | false | true
Free Agents | WerlasS | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/680a946074f95.png | false | true
Free Agents | Padisah | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://owcdn.net/img/680a9479637d5.png | false | true
Free Agents | MerSa | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://owcdn.net/img/680a9492a1ab9.png | false | true
Free Agents | Whiteslow | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | musz3kk | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://owcdn.net/img/679eb16c86d0e.png | false | true
Free Agents | Celasun | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://owcdn.net/img/66b0bcfa1d13e.png | false | true
Free Agents | Toronto | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://owcdn.net/img/61db03713d1ec.png | false | true
Free Agents | glovee | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/65f086a4571b4.png | false | true
Free Agents | Rensz | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | OXMANN | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/67dd80eac666b.png | false | true
Free Agents | Flexxin | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://owcdn.net/img/6358cca3ba60b.png | false | true
Free Agents | MERZ | flex/sentinel/duelist/controller/initiator | 19 | Turkey | https://owcdn.net/img/65d6478c426af.png | false | true
Free Agents | Shalz | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://owcdn.net/img/68532fb654d9f.png | false | true
Free Agents | Lava | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | CyderX | flex/sentinel/duelist/controller/initiator | 19 | Turkey | https://owcdn.net/img/67ca20469e2ad.png | false | true
Free Agents | Gloomy | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/659cd48778862.png | false | true
Free Agents | kabzi | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/679eb17e82dc7.png | false | true
Free Agents | spectra | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Gentle Mates | bipo | duelist/flex/initiator/sentinel/controller | 23 | Italy | https://owcdn.net/img/697767f365fc0.png | true | false
Free Agents | Lime | flex/sentinel/duelist/controller/initiator | 19 | United_Kingdom | https://owcdn.net/img/6798ea37377d0.png | false | true
Free Agents | prayy | flex/sentinel/duelist/controller/initiator | 22 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Mistic | flex/sentinel/duelist/controller/initiator | 19 | United_Kingdom | https://owcdn.net/img/6748a748c53cd.png | false | true
Free Agents | Unfair | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://owcdn.net/img/674fc51a077db.png | false | true
Free Agents | Terrox | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | tobseN | flex/sentinel/duelist/controller/initiator | 22 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | r1zvaN | flex/sentinel/duelist/controller/initiator | 20 | Bosnia_And_Herzegovina | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | DaviH | flex/sentinel/duelist/controller/initiator | 21 | Portugal | https://owcdn.net/img/6828e56e2629e.png | false | true
Free Agents | Bluey | flex/sentinel/duelist/controller/initiator | 23 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Euii | flex/sentinel/duelist/controller/initiator | 22 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ScelzeR | flex/sentinel/duelist/controller/initiator | 23 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Felix | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://owcdn.net/img/65ddf94745c0a.png | false | true
Free Agents | azury | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://owcdn.net/img/679c76234d45f.png | false | true
Free Agents | disisjohn | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://owcdn.net/img/679c762eab22f.png | false | true
Free Agents | Leosen | flex/sentinel/duelist/controller/initiator | 20 | Germany | https://owcdn.net/img/679c7638999b8.png | false | true
Free Agents | elllement | flex/sentinel/duelist/controller/initiator | 22 | Serbia | https://owcdn.net/img/6828e581c5b2f.png | false | true
Free Agents | Kongi | flex/sentinel/duelist/controller/initiator | 19 | Austria | https://owcdn.net/img/647b169daeb27.png | false | true
Free Agents | Obnoks | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://owcdn.net/img/6798ea24a89fb.png | false | true
Free Agents | iluri | flex/sentinel/duelist/controller/initiator | 22 | Finland | https://owcdn.net/img/6798ea2d2cbb5.png | false | true
Free Agents | musashi | flex/sentinel/duelist/controller/initiator | 21 | Germany | https://owcdn.net/img/679c76198afeb.png | false | true
Free Agents | Movi | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://owcdn.net/img/665d480492049.png | false | true
Free Agents | Ben | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | xuss | flex/sentinel/duelist/controller/initiator | 22 | Poland | https://owcdn.net/img/6748a700c0dad.png | false | true
Free Agents | Kyas | flex/sentinel/duelist/controller/initiator | 21 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | allthewayPat | flex/sentinel/duelist/controller/initiator | 21 | Germany | https://owcdn.net/img/663d7233ca9d8.png | false | true
Free Agents | Emiel | flex/sentinel/duelist/controller/initiator | 19 | Belgium | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Ziad | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | eearslan | flex/sentinel/duelist/controller/initiator | 21 | Germany | https://owcdn.net/img/686496bc53af0.png | false | true
Free Agents | YaBoiLewis | flex/sentinel/duelist/controller/initiator | 19 | Wales | https://owcdn.net/img/6748a6b01e3f6.png | false | true
Free Agents | zery | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | nikolaslos | flex/sentinel/duelist/controller/initiator | 21 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | reos | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Shiro | flex/sentinel/duelist/controller/initiator | 22 | Serbia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Vince | flex/sentinel/duelist/controller/initiator | 23 | Germany | https://owcdn.net/img/6828e55b2d695.png | false | true
Free Agents | GENETICZZ | flex/sentinel/duelist/controller/initiator | 22 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | kiiro | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | oteN | flex/sentinel/duelist/controller/initiator | 22 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Miyamura | flex/sentinel/duelist/controller/initiator | 19 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Sloov | flex/sentinel/duelist/controller/initiator | 20 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | quo | flex/sentinel/duelist/controller/initiator | 21 | Vietnam | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | sinxn7 | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Spocki | flex/sentinel/duelist/controller/initiator | 23 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | RxYaL | flex/sentinel/duelist/controller/initiator | 23 | Germany | https://owcdn.net/img/665d48ce0e453.png | false | true
Free Agents | Slayzz | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Lele | flex/sentinel/duelist/controller/initiator | 19 | Italy | https://owcdn.net/img/647c5574a7faf.png | false | true
Free Agents | Heizzy | flex/sentinel/duelist/controller/initiator | 22 | Bulgaria | https://owcdn.net/img/6827f1dd67d9d.png | false | true
Free Agents | chay | flex/sentinel/duelist/controller/initiator | 23 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Pat | flex/sentinel/duelist/controller/initiator | 22 | Brazil | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Leon | flex/sentinel/duelist/controller/initiator | 20 | Germany | https://owcdn.net/img/65e4b8a8bd7f3.png | false | true
Free Agents | Mumble | flex/sentinel/duelist/controller/initiator | 21 | Germany | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Stix | flex/sentinel/duelist/controller/initiator | 20 | Poland | https://owcdn.net/img/6435e710b62ae.png | false | true
Free Agents | Kajuks | flex/sentinel/duelist/controller/initiator | 20 | Lithuania | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | shinnok | flex/sentinel/duelist/controller/initiator | 19 | Hungary | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | troizyyy | flex/sentinel/duelist/controller/initiator | 19 | Ukraine | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | doma | flex/sentinel/initiator | 23 | Croatia | https://owcdn.net/img/68644d64be9a2.png | false | true
Free Agents | msh | flex/sentinel/duelist/controller/initiator | 19 | Poland | https://owcdn.net/img/678ddfa215913.png | false | true
Free Agents | sunfloweR | flex/sentinel/duelist/controller/initiator | 22 | Ukraine | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | gurbby | flex/sentinel/duelist/controller/initiator | 22 | United_Kingdom | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | thooOOM | flex/sentinel/duelist/controller/initiator | 22 | Netherlands | https://owcdn.net/img/6344204a081c2.png | false | true
Free Agents | WanZeru | flex/sentinel/duelist/controller/initiator | 23 | Czech_Republic | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Fezisss | flex/sentinel/duelist/controller/initiator | 21 | Ukraine | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
ULF Esports | d3mur | duelist | 22 | Turkey | https://www.vlr.gg/img/base/ph/sil.png | true | false
Free Agents | jas | duelist | 23 | Poland | https://owcdn.net/img/68644d7092d1b.png | false | true
PCIFIC Esports | qpert | initiator/controller/flex | 23 | Serbia | https://owcdn.net/img/696fd48d8390b.png | true | false
Free Agents | Kolosha | flex/sentinel/duelist/controller/initiator | 20 | Ukraine | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | samed | flex/sentinel/duelist/controller/initiator | 20 | Austria | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | juseu | flex/sentinel/duelist/controller/initiator | 21 | Ireland | https://owcdn.net/img/65a9a096a5538.png | false | true
Free Agents | rexxtoned | flex/sentinel/duelist/controller/initiator | 22 | Russia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | GSR | flex/sentinel/duelist/controller/initiator | 21 | Serbia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | nvrfear | flex/sentinel/duelist/controller/initiator | 19 | Ukraine | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | SEIDER | flex/sentinel/duelist/controller/initiator | 19 | Denmark | https://owcdn.net/img/61f966892b6de.png | false | true
Free Agents | Eagle | flex/sentinel/duelist/controller/initiator | 22 | Finland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Luca | flex/sentinel/duelist/controller/initiator | 22 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | kendo | flex/sentinel/duelist/controller/initiator | 19 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Nun | flex/sentinel/duelist/controller/initiator | 20 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | 999kvmil | flex/sentinel/duelist/controller/initiator | 23 | Poland | https://owcdn.net/img/68759148d84d4.png | false | true
Free Agents | 1ce2k | flex/sentinel/duelist/controller/initiator | 19 | Estonia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Hassan | flex/sentinel/duelist/controller/initiator | 21 | Morocco | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ANXiOS | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | NeFi | flex/sentinel/duelist/controller/initiator | 20 | Poland | https://owcdn.net/img/67e88dadbb69e.png | false | true
Free Agents | Corsa | flex/sentinel/duelist/controller/initiator | 20 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Vuubit | flex/sentinel/duelist/controller/initiator | 19 | Finland | https://owcdn.net/img/661ecd25a9382.png | false | true
Free Agents | Czester | flex/sentinel/duelist/controller/initiator | 23 | Poland | https://owcdn.net/img/67e88dfd7d0fb.png | false | true
Free Agents | lukyololo | flex/sentinel/duelist/controller/initiator | 21 | Czech Republic | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | basya | flex/sentinel/duelist/controller/initiator | 19 | Russia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | MaximN | flex/sentinel/duelist/controller/initiator | 23 | Belgium | https://owcdn.net/img/6430096abefc6.png | false | true
Free Agents | pyrolll | flex/initiator | 22 | Estonia | https://i.imgur.com/ye74fRD.png | false | true
Free Agents | W1LL | flex/sentinel/duelist/controller/initiator | 20 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Raz | flex/sentinel/duelist/controller/initiator | 23 | Russia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | DonatelloOO | flex/sentinel/duelist/controller/initiator | 22 | Czech_Republic | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | 919jewwy | flex/sentinel/duelist/controller/initiator | 20 | Russia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Deqadz | flex/sentinel/duelist/controller/initiator | 23 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | starki | controller | 19 | Poland | https://owcdn.net/img/68644d98918d7.png | false | true
Free Agents | merix | flex/sentinel/duelist/controller/initiator | 21 | Ireland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Aramejs | flex/sentinel/duelist/controller/initiator | 19 | Czech_Republic | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | kryo | flex/sentinel/duelist/controller/initiator | 19 | Poland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Szalony | flex/sentinel/duelist/controller/initiator | 21 | Poland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Fractioned | flex/sentinel/duelist/controller/initiator | 23 | Ireland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Kiles | sentinel | 22 | Ukraine | https://owcdn.net/img/68644d88dad09.png | false | true
Free Agents | eleo | flex/sentinel/duelist/controller/initiator | 21 | Israel | https://owcdn.net/img/678e3cd07abf4.png | false | true
Free Agents | Shaimon | flex/sentinel/duelist/controller/initiator | 23 | Slovakia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | RARE | flex/sentinel/duelist/controller/initiator | 21 | Ukraine | https://owcdn.net/img/65a2f0b84b65d.png | false | true
Free Agents | ReQz | flex/sentinel/duelist/controller/initiator | 19 | United_Kingdom | https://owcdn.net/img/62d17f6f265b9.png | false | true
Free Agents | fvrioza | flex/sentinel/duelist/controller/initiator | 19 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | nosby | flex/sentinel/duelist/controller/initiator | 19 | Poland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | BarcK | flex/sentinel/duelist/controller/initiator | 21 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | tweethy | flex/sentinel/duelist/controller/initiator | 20 | Poland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Javelin | flex/sentinel/duelist/controller/initiator | 20 | Ukraine | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Rawn3n | flex/sentinel/duelist/controller/initiator | 23 | Denmark | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Kubfu | flex/sentinel/duelist/controller/initiator | 23 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Bjorn | flex/sentinel/duelist/controller/initiator | 22 | Denmark | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | SPMAK | flex/sentinel/duelist/controller/initiator | 19 | Finland | https://owcdn.net/img/66158bb872126.png | false | true
Free Agents | Marky | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Cawwyy | flex/sentinel/duelist/controller/initiator | 22 | Latvia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Prti | flex/sentinel/duelist/controller/initiator | 20 | Serbia | https://owcdn.net/img/678ddfb454d1a.png | false | true
Free Agents | sulunist | flex/sentinel/duelist/controller/initiator | 19 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Neyes | flex/sentinel/duelist/controller/initiator | 20 | Croatia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | BALLI | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://owcdn.net/img/678092187a27a.png | false | true
Free Agents | golack | flex/sentinel/duelist/controller/initiator | 20 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | bravo | flex/sentinel/duelist/controller/initiator | 19 | Hungary | https://owcdn.net/img/683667ba8662f.png | false | true
Free Agents | kya | flex/sentinel/duelist/controller/initiator | 20 | Netherlands | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | neveR | flex/sentinel/duelist/controller/initiator | 19 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true`;



const MASTER_PLAYERS_TEXT_EXTRA_4 = `Team | Name | Role(s) | Age | Nationality | ImageURL | Starter | FreeAgent
Free Agents | mezoky | flex/sentinel/duelist/controller/initiator | 19 | Russia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | aidan | flex/sentinel/duelist/controller/initiator | 20 | England | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | xad | flex/sentinel/duelist/controller/initiator | 20 | Poland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | adm1k | flex/sentinel/duelist/controller/initiator | 23 | Poland | https://owcdn.net/img/62a9f0c1a544f.png | false | true
Free Agents | Enrik | flex/sentinel/duelist/controller/initiator | 22 | Czech_Republic | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ScT | flex/sentinel/duelist/controller/initiator | 21 | Ireland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | FuriouzMeow | flex/sentinel/duelist/controller/initiator | 20 | Denmark | https://owcdn.net/img/653b1c1d14521.png | false | true
Free Agents | Sferon | flex/sentinel/duelist/controller/initiator | 19 | Poland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Wizzing | flex/sentinel/duelist/controller/initiator | 22 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | falltw | flex/sentinel/duelist/controller/initiator | 22 | Russia | https://owcdn.net/img/61f7cb6837b25.png | false | true
Free Agents | flank | flex/sentinel/duelist/controller/initiator | 22 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | K1kana | flex/sentinel/duelist/controller/initiator | 22 | Serbia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | MIKE | flex/sentinel/duelist/controller/initiator | 19 | Serbia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | benzki | flex/sentinel/duelist/controller/initiator | 20 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | deyten | flex/sentinel/duelist/controller/initiator | 19 | Serbia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ALMO | flex/sentinel/duelist/controller/initiator | 22 | Poland | https://owcdn.net/img/667c4807409d6.png | false | true
Free Agents | Hazard | flex/sentinel/duelist/controller/initiator | 20 | Slovakia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | yasiek | flex/sentinel/duelist/controller/initiator | 20 | Poland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Heni | flex/sentinel/duelist/controller/initiator | 22 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | MR J | flex/sentinel/duelist/controller/initiator | 22 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Inst1nct | flex/sentinel/duelist/controller/initiator | 23 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Ross | flex/sentinel/duelist/controller/initiator | 22 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
DRX | Hermes | initiator/sentinel/duelist/controller/flex | 20 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | true | false
Free Agents | apeX | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | exa | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://owcdn.net/img/67a4c0b5a9704.png | false | true
Free Agents | yong | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Athan | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://owcdn.net/img/676b9d0f6b127.png | false | true
Free Agents | shu | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | SungJin | flex/sentinel/duelist/controller/initiator | 20 | South_Korea | https://owcdn.net/img/6540c847c0c70.png | false | true
Free Agents | Ramgi | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | BENECIA | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://owcdn.net/img/65ffe0cbd975b.png | false | true
Free Agents | ANNYEON | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
VARREL Esports | oonzmlp | sentinel/controller/flex | 19 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | true | false
VARREL Esports | Klaus | sentinel/flex | 18 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | true | false
Free Agents | cristo | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Kally | flex/sentinel/duelist/controller/initiator | 20 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Cloy | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Gen.G | ZynX | sentinel/duelist/controller | 18 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | true | false
VARREL Esports | XuNa | initiator/flex | 17 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | true | false
Free Agents | GangPin | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://owcdn.net/img/67a4c0c66c9b8.png | false | true
Free Agents | CabezA | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Leg1t | flex/sentinel/duelist/controller/initiator | 20 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
VARREL Esports | Zexy | duelist | 19 | South_Korea | https://www.vlr.gg/img/base/ph/sil.png | true | false
Free Agents | Moves | flex/sentinel/duelist/controller/initiator | 20 | South_Korea | https://owcdn.net/img/62cfddaf52075.png | false | true
Free Agents | Exy0 | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Moothie | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://owcdn.net/img/67a4c0a495cb5.png | false | true
VARREL Esports | C1ndeR | controller/flex | 26 | South_Korea | https://owcdn.net/img/6540cb0ba90ed.png | true | false
Free Agents | Raxcal | flex/sentinel/duelist/controller/initiator | 20 | South_Korea | https://owcdn.net/img/679f5c04d71bf.png | false | true
Free Agents | Rico | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Raon | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Kyra | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | HANN | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | kobra | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Banger | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://owcdn.net/img/6655b79bb9486.png | false | true
Free Agents | Zayce | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | tenac1ous | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | froz | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://owcdn.net/img/679f5cca50abe.png | false | true
Free Agents | NEFFEX | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Gnadel | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | BBiyong | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Cloudy | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://owcdn.net/img/65ffe0d46fa14.png | false | true
Free Agents | Arduino | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Melon | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Efina | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://owcdn.net/img/670020c9da004.png | false | true
Free Agents | seokJ | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | wonderful | flex/sentinel/duelist/controller/initiator | 19 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | hyun | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | YESicaN | flex/sentinel/duelist/controller/initiator | 20 | Vietnam | https://owcdn.net/img/629f1027a9137.png | false | true
Free Agents | JA | flex/sentinel/duelist/controller/initiator | 23 | Philippines | https://owcdn.net/img/67978335851f0.png | false | true
Free Agents | Fixy | flex/sentinel/duelist/controller/initiator | 22 | Malaysia | https://owcdn.net/img/663a30824c3c7.png | false | true
Free Agents | fausTao | flex/sentinel/duelist/controller/initiator | 20 | Indonesia | https://owcdn.net/img/6868236883e22.png | false | true
Free Agents | EJAY | flex/sentinel/duelist/controller/initiator | 22 | Philippines | https://owcdn.net/img/63ca2c8c16016.png | false | true
Free Agents | Kylee | flex/sentinel/duelist/controller/initiator | 19 | Indonesia | https://owcdn.net/img/66343f0506708.png | false | true
Free Agents | socools0da | flex/sentinel/duelist/controller/initiator | 23 | Thailand | https://owcdn.net/img/6828eb59e424b.png | false | true
Free Agents | Azami | flex/sentinel/duelist/controller/initiator | 22 | Singapore | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Mihlog | flex/sentinel/duelist/controller/initiator | 19 | Vietnam | https://owcdn.net/img/6577d689a5aae.png | false | true
Free Agents | ZRIP | flex/sentinel/duelist/controller/initiator | 19 | Thailand | https://owcdn.net/img/6543104fdbfd9.png | false | true
Free Agents | Hotsauz | flex/sentinel/duelist/controller/initiator | 20 | Philippines | https://owcdn.net/img/67750be61f7f4.png | false | true
Free Agents | twilight | flex/sentinel/duelist/controller/initiator | 22 | Vietnam | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | SCar | flex/sentinel/duelist/controller/initiator | 23 | Indonesia | https://owcdn.net/img/6868235e4c9bd.png | false | true
Free Agents | ZuoKew | flex/sentinel/duelist/controller/initiator | 22 | Thailand | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Emman | flex/sentinel/duelist/controller/initiator | 21 | Philippines | https://owcdn.net/img/67750bf63ce1e.png | false | true
Free Agents | Fivm | flex/sentinel/duelist/controller/initiator | 21 | Singapore | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | f1cio | flex/sentinel/duelist/controller/initiator | 21 | Vietnam | https://owcdn.net/img/629f12043459d.png | false | true
Free Agents | Riza | flex/sentinel/duelist/controller/initiator | 23 | Malaysia | https://owcdn.net/img/63dcdc1e5822b.png | false | true
Free Agents | bucute | flex/sentinel/duelist/controller/initiator | 21 | Vietnam | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | capeesha | flex/sentinel/duelist/controller/initiator | 21 | Indonesia | https://owcdn.net/img/686823a577517.png | false | true
Free Agents | NIZ | flex/sentinel/duelist/controller/initiator | 20 | Thailand | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | PoomOneLove | flex/sentinel/duelist/controller/initiator | 23 | Thailand | https://owcdn.net/img/6828eb4a4003b.png | false | true
Free Agents | D4rf | flex/sentinel/duelist/controller/initiator | 23 | Thailand | https://owcdn.net/img/6828eb6730572.png | false | true
Free Agents | aLerT | flex/sentinel/duelist/controller/initiator | 21 | Thailand | https://owcdn.net/img/6828eb7502dd5.png | false | true
Free Agents | artaa | flex/sentinel/duelist/controller/initiator | 23 | Indonesia | https://owcdn.net/img/686823717d4e2.png | false | true
Free Agents | endoist | flex/sentinel/duelist/controller/initiator | 21 | Thailand | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | R4ve | flex/sentinel/duelist/controller/initiator | 22 | Thailand | https://owcdn.net/img/66458d34d9535.png | false | true
Free Agents | Miyu | flex/sentinel/duelist/controller/initiator | 21 | Indonesia | https://owcdn.net/img/6868239a618e0.png | false | true
Free Agents | twelve | flex/sentinel/duelist/controller/initiator | 19 | Singapore | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ITaoEartH | flex/sentinel/duelist/controller/initiator | 20 | Thailand | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | sayoo | flex/sentinel/duelist/controller/initiator | 23 | Indonesia | https://owcdn.net/img/6745f9d6bdaa7.png | false | true
Free Agents | reagzYY | flex/sentinel/duelist/controller/initiator | 22 | Singapore | https://owcdn.net/img/62dbfa7d0589a.png | false | true
Free Agents | Akame | flex/sentinel/duelist/controller/initiator | 21 | Singapore | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Fluky | flex/sentinel/duelist/controller/initiator | 21 | Thailand | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ALLR1GHTT | flex/sentinel/duelist/controller/initiator | 19 | Thailand | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Anyzex | flex/sentinel/duelist/controller/initiator | 20 | Thailand | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | stonezy | flex/sentinel/duelist/controller/initiator | 21 | Ukraine | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Katu | flex/sentinel/duelist/controller/initiator | 21 | Poland | https://owcdn.net/img/679b372f4c563.png | false | true
Free Agents | waddle | initiator/controller/flex | 21 | United_Kingdom | https://owcdn.net/img/65bfd4a975322.png | false | true
Free Agents | Famsii | duelist | 23 | Finland | https://owcdn.net/img/664295080bd44.png | false | true
Free Agents | lowel | flex/sentinel/duelist/controller/initiator | 20 | Spain | https://owcdn.net/img/63b7a43e546e7.png | false | true
Free Agents | aster | flex/sentinel/duelist/controller/initiator | 19 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | yaggert | flex/sentinel/duelist/controller/initiator | 21 | Spain | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | krejz | flex/sentinel/duelist/controller/initiator | 22 | Poland | https://owcdn.net/img/6774c7e4e3a9b.png | false | true
Free Agents | YuNo | flex/sentinel/duelist/controller/initiator | 20 | Spain | https://owcdn.net/img/67809420de8df.png | false | true
Free Agents | globeX | flex/sentinel/duelist/controller/initiator | 21 | Poland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Guardy | flex/sentinel/duelist/controller/initiator | 20 | Spain | https://owcdn.net/img/66321722efafd.png | false | true
Free Agents | Chadi | flex/sentinel/duelist/controller/initiator | 19 | Hungary | https://owcdn.net/img/66526586f11ff.png | false | true
Free Agents | jannyXD | flex/sentinel/duelist/controller/initiator | 22 | Portugal | https://owcdn.net/img/627a9c68bd205.png | false | true
Free Agents | starkk | flex/sentinel/duelist/controller/initiator | 22 | Portugal | https://owcdn.net/img/63b984ed85f2f.png | false | true
Free Agents | GrTw | flex/sentinel/duelist/controller/initiator | 20 | Portugal | https://owcdn.net/img/65a92da45c942.png | false | true
Free Agents | Ticey | controller/flex | 22 | United_Kingdom | https://owcdn.net/img/679eace1221a0.png | false | true
Free Agents | Krizz | flex/sentinel/duelist/controller/initiator | 22 | Poland | https://owcdn.net/img/67e88d6be72d8.png | false | true
Free Agents | pa1ka | flex/sentinel/duelist/controller/initiator | 23 | Russia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Bia | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ZachKappa | flex/sentinel/duelist/controller/initiator | 20 | United_Kingdom | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | mober | flex/sentinel/duelist/controller/initiator | 20 | Spain | https://owcdn.net/img/637814da8b4bd.png | false | true
Free Agents | tomatte | flex/sentinel/duelist/controller/initiator | 23 | Spain | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Bati | flex/sentinel/duelist/controller/initiator | 22 | Portugal | https://owcdn.net/img/65ddf94eae3a2.png | false | true
Free Agents | Saiz | flex/sentinel/duelist/controller/initiator | 22 | Spain | https://owcdn.net/img/6632170b6125d.png | false | true
Free Agents | drepeex | flex/sentinel/duelist/controller/initiator | 19 | Russia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Tenker | flex/sentinel/duelist/controller/initiator | 22 | Russia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Kamisseq | flex/sentinel/duelist/controller/initiator | 22 | Poland | https://owcdn.net/img/679b3720bbd53.png | false | true
Free Agents | Thander | flex/sentinel/duelist/controller/initiator | 19 | Serbia | https://owcdn.net/img/681c7a333fb45.png | false | true
Free Agents | mrcarrito | flex/sentinel/duelist/controller/initiator | 19 | Spain | https://owcdn.net/img/63d885c993811.png | false | true
Free Agents | pika | flex/sentinel/duelist/controller/initiator | 22 | Argentina | https://owcdn.net/img/686ef3df59c5f.png | false | true
Free Agents | Rexs | flex/sentinel/duelist/controller/initiator | 22 | Spain | https://owcdn.net/img/664c85b7e2ad3.png | false | true
Free Agents | Negradas | flex/sentinel/duelist/controller/initiator | 23 | Spain | https://owcdn.net/img/66636b1bb8da4.png | false | true
Free Agents | Davia | flex/sentinel/duelist/controller/initiator | 20 | Italy | https://owcdn.net/img/6864950db57d3.png | false | true
Free Agents | l0udly | flex/sentinel/duelist/controller/initiator | 22 | Lithuania | https://owcdn.net/img/627ea5a9da6eb.png | false | true
Free Agents | Bosh | flex/sentinel/duelist/controller/initiator | 21 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | archiw0w | flex/sentinel/duelist/controller/initiator | 22 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Buld | flex/sentinel/duelist/controller/initiator | 19 | Poland | https://owcdn.net/img/679b37035e058.png | false | true
Free Agents | demek | flex/sentinel/duelist/controller/initiator | 20 | Poland | https://owcdn.net/img/67e88d7a0703b.png | false | true
Free Agents | avey | flex/sentinel/duelist/controller/initiator | 19 | Latvia | https://owcdn.net/img/6864953e67fd0.png | false | true
Free Agents | zeddy | flex/sentinel/duelist/controller/initiator | 19 | Belarus | https://owcdn.net/img/6653af0be894f.png | false | true
Free Agents | Mally | flex/sentinel/duelist/controller/initiator | 22 | United_Kingdom | https://owcdn.net/img/686494db1ddc4.png | false | true
Free Agents | azaziN | flex/sentinel/duelist/controller/initiator | 20 | Spain | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Z3RO | flex/sentinel/duelist/controller/initiator | 23 | Italy | https://owcdn.net/img/686495a21d227.png | false | true
Free Agents | KenzmPs | flex/sentinel/duelist/controller/initiator | 22 | Portugal | https://owcdn.net/img/63c305e939c35.png | false | true
Free Agents | Michel | flex/sentinel/duelist/controller/initiator | 21 | Spain | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | rYn | flex/sentinel/duelist/controller/initiator | 21 | Netherlands | https://owcdn.net/img/67d932380cff7.png | false | true
Free Agents | loll9 | flex/sentinel/duelist/controller/initiator | 22 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ASTERR | flex/sentinel/duelist/controller/initiator | 20 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | fraNdina | flex/sentinel/duelist/controller/initiator | 23 | Italy | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | StarBound | flex/sentinel/duelist/controller/initiator | 21 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | colby | flex/sentinel/duelist/controller/initiator | 20 | Albania | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | Bob | flex/sentinel/duelist/controller/initiator | 19 | Australia | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | edith | flex/sentinel/duelist/controller/initiator | 20 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | PowerPixele | flex/sentinel/duelist/controller/initiator | 19 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | SUPERKAT | flex/sentinel/duelist/controller/initiator | 21 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Logic | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Bahzar | flex/sentinel/duelist/controller/initiator | 20 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | panini | flex/sentinel/duelist/controller/initiator | 21 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | melya | flex/sentinel/duelist/controller/initiator | 21 | Pakistan | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | miyara | flex/sentinel/duelist/controller/initiator | 21 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | maryna | flex/sentinel/duelist/controller/initiator | 20 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | marceline | flex/sentinel/duelist/controller/initiator | 21 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | lover | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | cia | flex/sentinel/duelist/controller/initiator | 19 | China | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | qrthur | flex/sentinel/duelist/controller/initiator | 19 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | icee | flex/sentinel/duelist/controller/initiator | 22 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | leah | flex/sentinel/duelist/controller/initiator | 22 | Vietnam | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Jazzyk1ns | flex/sentinel/duelist/controller/initiator | 21 | Canada | https://owcdn.net/img/6399a6a120aad.png | false | true
Free Agents | vanitas | flex/sentinel/duelist/controller/initiator | 20 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | zev | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | awpi | flex/sentinel/duelist/controller/initiator | 20 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ennui | flex/sentinel/duelist/controller/initiator | 20 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | calsushi | flex/sentinel/duelist/controller/initiator | 19 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Australis | flex/sentinel/duelist/controller/initiator | 23 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | aluvily | flex/sentinel/duelist/controller/initiator | 23 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | lidyuh | flex/sentinel/duelist/controller/initiator | 23 | United_States | https://owcdn.net/img/624602a6273c6.png | false | true
Free Agents | caya1 | flex/sentinel/duelist/controller/initiator | 20 | Sweden | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Nora | flex/sentinel/duelist/controller/initiator | 21 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | aeri | flex/sentinel/duelist/controller/initiator | 23 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | gabby | flex/sentinel/duelist/controller/initiator | 20 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Aniemal | flex/sentinel/duelist/controller/initiator | 20 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Slandy | flex/sentinel/duelist/controller/initiator | 21 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | bunnybee | flex/sentinel/duelist/controller/initiator | 22 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | panday | flex/sentinel/duelist/controller/initiator | 22 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Sliicyy | flex/sentinel/duelist/controller/initiator | 23 | France | https://owcdn.net/img/6159c8016843b.png | false | true
Free Agents | misu | flex/sentinel/duelist/controller/initiator | 22 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | avery | flex/sentinel/duelist/controller/initiator | 19 | Sweden | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ariel | flex/sentinel/duelist/controller/initiator | 22 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Ballooncat | flex/sentinel/duelist/controller/initiator | 22 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | sonder | flex/sentinel/duelist/controller/initiator | 21 | China | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | cyn | flex/sentinel/duelist/controller/initiator | 22 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | SleepyAria | flex/sentinel/duelist/controller/initiator | 20 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Angle | flex/sentinel/duelist/controller/initiator | 22 | Vietnam | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Luna1 | flex/sentinel/duelist/controller/initiator | 23 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ira | flex/sentinel/duelist/controller/initiator | 22 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | maddie | flex/sentinel/duelist/controller/initiator | 23 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Zoue | flex/sentinel/duelist/controller/initiator | 22 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | rover | flex/sentinel/duelist/controller/initiator | 22 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | evv | flex/sentinel/duelist/controller/initiator | 19 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Angel | flex/sentinel/duelist/controller/initiator | 22 | Mexico | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | LunaFox | flex/sentinel/duelist/controller/initiator | 22 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Battison | flex/sentinel/duelist/controller/initiator | 21 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | cloudzzy | flex/sentinel/duelist/controller/initiator | 20 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | irene | flex/sentinel/duelist/controller/initiator | 20 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | nmutuA | flex/sentinel/duelist/controller/initiator | 23 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | korosu | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Kestrel | flex/sentinel/duelist/controller/initiator | 20 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | mizubabe | flex/sentinel/duelist/controller/initiator | 21 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | ketarys | flex/sentinel/duelist/controller/initiator | 21 | Vietnam | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | aria | flex/sentinel/duelist/controller/initiator | 19 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | nova | flex/sentinel/duelist/controller/initiator | 22 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | lylac | flex/sentinel/duelist/controller/initiator | 22 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | riv | flex/sentinel/duelist/controller/initiator | 20 | Australia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | joona | flex/sentinel/duelist/controller/initiator | 21 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | norabora | flex/sentinel/duelist/controller/initiator | 23 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Spooky | flex/sentinel/duelist/controller/initiator | 22 | Puerto_Rico | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | kora | flex/sentinel/duelist/controller/initiator | 21 | Vietnam | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | liv | flex/sentinel/duelist/controller/initiator | 21 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Sekkya | flex/sentinel/duelist/controller/initiator | 23 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | elora | flex/sentinel/duelist/controller/initiator | 23 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | L4CE | flex/sentinel/duelist/controller/initiator | 21 | United_States | https://owcdn.net/img/65586b6617fed.png | false | true
Free Agents | Kyedae | flex/sentinel/duelist/controller/initiator | 19 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | theia | flex/sentinel/duelist/controller/initiator | 22 | United_States | https://owcdn.net/img/605dde9c61c6c.png | false | true
Free Agents | sal | flex/sentinel/duelist/controller/initiator | 19 | China | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | oranges | flex/sentinel/duelist/controller/initiator | 21 | International | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Biffy | flex/sentinel/duelist/controller/initiator | 19 | Mexico | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | gracious | flex/sentinel/duelist/controller/initiator | 23 | Thailand | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | zoriental | flex/sentinel/duelist/controller/initiator | 23 | South_Korea | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | saiyje | flex/sentinel/duelist/controller/initiator | 19 | Bangladesh | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Tailo | flex/sentinel/duelist/controller/initiator | 20 | United_States | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Myneko | flex/sentinel/duelist/controller/initiator | 19 | Canada | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | aus | flex/sentinel/duelist/controller/initiator | 20 | Philippines | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | berryx | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://owcdn.net/img/6802c192eb6d5.png | false | true
Free Agents | Sucette | flex/sentinel/duelist/controller/initiator | 23 | Switzerland | https://owcdn.net/img/68406c9f1408a.png | false | true
Free Agents | Vania | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://owcdn.net/img/679af4e3d388c.png | false | true
Free Agents | Joliinaa | flex/sentinel/duelist/controller/initiator | 20 | Sweden | https://owcdn.net/img/6832ece97be49.png | false | true
Free Agents | LizA | flex/sentinel/duelist/controller/initiator | 20 | International | https://owcdn.net/img/68333e4ebc178.png | false | true
Free Agents | ness | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://owcdn.net/img/665c78286a7fc.png | false | true
Free Agents | anesilia | flex/sentinel/duelist/controller/initiator | 21 | Russia | https://owcdn.net/img/67dab8a07a2b3.png | false | true
Free Agents | Leen | flex/sentinel/duelist/controller/initiator | 23 | Saudi_Arabia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Glance | flex/sentinel/duelist/controller/initiator | 22 | Russia | https://owcdn.net/img/67dab6487967e.png | false | true
Free Agents | Akita | flex/sentinel/duelist/controller/initiator | 23 | France | https://owcdn.net/img/681307c664f8f.png | false | true
Free Agents | eva | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://owcdn.net/img/65e38a19459a3.png | false | true
Free Agents | Lyda | flex/sentinel/duelist/controller/initiator | 19 | Turkey | https://owcdn.net/img/645cd8cddfe5f.png | false | true
Free Agents | safiaa | flex/sentinel/duelist/controller/initiator | 19 | France | https://owcdn.net/img/67dab80e2ecfe.png | false | true
Free Agents | jduh | flex/sentinel/duelist/controller/initiator | 19 | Turkey | https://owcdn.net/img/65a420d325fa8.png | false | true
Free Agents | PuriTy | flex/sentinel/duelist/controller/initiator | 20 | United_States | https://owcdn.net/img/6832ec9d8cb2c.png | false | true
Free Agents | mimi | flex/sentinel/duelist/controller/initiator | 23 | Denmark | https://owcdn.net/img/679af4dc02623.png | false | true
Free Agents | rezq | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://owcdn.net/img/679c753d8c5e6.png | false | true
Free Agents | fluxxy | flex/sentinel/duelist/controller/initiator | 22 | Scotland | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | alkyia | flex/sentinel/duelist/controller/initiator | 19 | Turkey | https://owcdn.net/img/67dab78c197b2.png | false | true
Free Agents | tokameite | flex/sentinel/duelist/controller/initiator | 20 | Russia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Annie | flex/sentinel/duelist/controller/initiator | 19 | Spain | https://owcdn.net/img/679c7551de1d0.png | false | true
Free Agents | Wens | flex/sentinel/duelist/controller/initiator | 22 | Turkey | https://owcdn.net/img/6553e450dc293.png | false | true
Free Agents | sarah | flex/sentinel/duelist/controller/initiator | 22 | United_Kingdom | https://owcdn.net/img/665c783097c1b.png | false | true
Free Agents | amy | flex/sentinel/duelist/controller/initiator | 19 | Netherlands | https://owcdn.net/img/679af4c15f7f9.png | false | true
Free Agents | Nami | flex/sentinel/duelist/controller/initiator | 20 | France | https://owcdn.net/img/643001997efc4.png | false | true
Free Agents | DREAM | flex/sentinel/duelist/controller/initiator | 20 | China | https://owcdn.net/img/67b1e4a230fd2.png | false | true
Free Agents | Anva | flex/sentinel/duelist/controller/initiator | 19 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | proxima | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/6802c1e4b1e3b.png | false | true
Free Agents | lexa | flex/sentinel/duelist/controller/initiator | 23 | Sweden | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Toki | flex/sentinel/duelist/controller/initiator | 23 | Spain | https://owcdn.net/img/679c754811f35.png | false | true
Free Agents | adora | flex/sentinel/duelist/controller/initiator | 20 | Lithuania | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Jiex | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/67dab7022b643.png | false | true
Free Agents | devilasxa | flex/sentinel/duelist/controller/initiator | 22 | Spain | https://owcdn.net/img/6832ecad30aac.png | false | true
Free Agents | Marti | flex/sentinel/duelist/controller/initiator | 22 | Poland | https://owcdn.net/img/679c751736f44.png | false | true
Free Agents | Sandra | flex/sentinel/duelist/controller/initiator | 21 | Egypt | https://owcdn.net/img/65da7d3d72265.png | false | true
Free Agents | Thuy | flex/sentinel/duelist/controller/initiator | 23 | France | https://owcdn.net/img/67b1e214ba2cc.png | false | true
Free Agents | Felipa | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://owcdn.net/img/6553e44003151.png | false | true
Free Agents | Loupiote | flex/sentinel/duelist/controller/initiator | 23 | France | https://owcdn.net/img/67b1e54c104a1.png | false | true
Free Agents | BySmall | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | jademwah | flex/sentinel/duelist/controller/initiator | 23 | Scotland | https://owcdn.net/img/68333e6203b0d.png | false | true
Free Agents | Pinkalie | flex/sentinel/duelist/controller/initiator | 19 | France | https://owcdn.net/img/67b1e40591889.png | false | true
Free Agents | Nelo | flex/sentinel/duelist/controller/initiator | 23 | France | https://owcdn.net/img/679af4c9cbc1a.png | false | true
Free Agents | Smurfette | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://owcdn.net/img/665c7836647e2.png | false | true
Free Agents | mimier | flex/sentinel/duelist/controller/initiator | 23 | Turkey | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | yelz | flex/sentinel/duelist/controller/initiator | 22 | Saudi_Arabia | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | htm | flex/sentinel/duelist/controller/initiator | 22 | International | https://owcdn.net/img/633432479cca5.png | false | true
Free Agents | Lateu | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://owcdn.net/img/626a5eac13be1.png | false | true
Free Agents | Looxie | flex/sentinel/duelist/controller/initiator | 21 | France | https://owcdn.net/img/679c7532007a6.png | false | true
Free Agents | schnellÆ | flex/sentinel/duelist/controller/initiator | 21 | Turkey | https://owcdn.net/img/65ec65d69f4e7.png | false | true
Free Agents | mimi | flex/sentinel/duelist/controller/initiator | 22 | Spain | https://images.vexels.com/media/users/3/258727/isolated/preview/52384117691bc668437dd96d33da85bf-hard-boiled-egg-food.png | false | true
Free Agents | Miyori | flex/sentinel/duelist/controller/initiator | 20 | Turkey | https://owcdn.net/img/665c781f7e0c0.png | false | true
Free Agents | Nora | flex/sentinel/duelist/controller/initiator | 22 | France | https://owcdn.net/img/6835d4340187d.png | false | true
Free Agents | kyracujoh | flex/sentinel/duelist/controller/initiator | 19 | France | https://owcdn.net/img/6835d416e2d5f.png | false | true
Free Agents | Cille | flex/sentinel/duelist/controller/initiator | 19 | Denmark | https://owcdn.net/img/642e980e5e231.png | false | true
Free Agents | Proxh | controller | 23 | Germany | https://i.imgur.com/H4FqU4X.png | false | true
FURIA | basic | initiator/flex | 20 | Brazil | https://i.imgur.com/IDr6Mor.png | false | false
GIANTX | ara | duelist | 21 | Romania | https://i.imgur.com/FCuZU3y.png | true | false
Free Agents | batujnax | flex | 21 | Turkey | https://i.imgur.com/nocUWMz.png | false | true
Full Sense | thyy | duelist | 19 | Thailand | https://owcdn.net/img/69440472837f1.png | true | false
Free Agents | DH | controller | 20 | South_Korea | https://i.imgur.com/orf89Hy.png | false | true
DRX | Flicker | flex | 19 | South_Korea | https://i.imgur.com/XtuBsuU.png | false | false
EDward Gaming | Jieni7 | controller/flex | 20 | China | https://i.imgur.com/ar5VUQR.png | false | false
All Gamers | Shr1mp | initiator/flex | 23 | China | https://i.imgur.com/noLp070.png | true | false
Free Agents | HanChe | sentinel | 19 | Taiwan | https://owcdn.net/img/67d41ea73c850.png | false | true
Free Agents | Lsn | flex/initiator | 33 | China | https://owcdn.net/img/677fbe6c1b155.png | false | true
Free Agents | cxyy | flex | 25 | China | https://owcdn.net/img/67d41ec47157d.png | false | true
Free Agents | Bai | duelist | 19 | China | https://owcdn.net/img/67d41e9ad9fef.png | false | true
Dragon Ranger Gaming | SpiritZ1 | duelist | 19 | Taiwan | https://i.imgur.com/qecANUZ.png | true | false
Free Agents | Cangshu | initiator/flex | 21 | Taiwan | https://owcdn.net/img/678261493520a.png | false | true
Dragon Ranger Gaming | Akeman | flex | 23 | China | https://i.imgur.com/DeSjNCK.png | true | false
Free Agents | Babyblue | initiator/flex | 23 | China | https://owcdn.net/img/6780d3ed5ecbc.png | false | true
JDG Esports | kklin | sentinel | 20 | China | https://i.imgur.com/grWAqqO.png | true | false
Titan Esports Club | CoCo | initiator/flex | 19 | China | https://i.imgur.com/F6tu9oT.png | true | false
Titan Esports Club | lucas | initiator | 19 | China | https://i.imgur.com/G2WBwON.png | true | false
Titan Esports Club | dynamite | duelist | 21 | China | https://i.imgur.com/Ca16AO5.png | true | false
TYLOO | Yoyo | initiator/flex | 22 | Taiwan | https://i.imgur.com/r4MHCgN.png | true | false
TYLOO | slowly | duelist | 24 | China | https://owcdn.net/img/6848f4fd4ff85.png | true | false
Free Agents | mithyowl | controller | 19 | India | https://www.vlr.gg/img/base/ph/sil.png | false | true
Free Agents | waituu | sentinel | 23 | China | https://owcdn.net/img/6848f49f8ae47.png | false | true
Xi Lai Gaming | NoMan | sentinel | 21 | Hong_Kong | https://i.imgur.com/rlqjpmh.png | true | false
Free Agents | XII | duelist/flex | 23 | Taiwan | https://owcdn.net/img/67f0e8a3bece3.png | false | true
Free Agents | Ying | sentinel/controller | 19 | China | https://i.imgur.com/cOuv154.png | false | true
Free Agents | Xlele | initiator/flex | 19 | China | https://i.imgur.com/NOfXFUO.png | false | true
Free Agents | XiYIJI | controller/duelist | 19 | China | https://owcdn.net/img/677fb85286e76.png | false | true
Free Agents | florescent | duelist | 19 | Canada | https://i.imgur.com/t6W3Zc0.png | false | true
Free Agents | thetrappeur | flex/sentinel | 18 | United_States | 0 | false | true
Free Agents | temp0 | duelist/initiator | 18 | Venezuela | 0 | false | true
Free Agents | boubou91 | initiator | 18 | United_States | 0 | false | true
Free Agents | shandori4rd | initiator/sentinel | 18 | Argentina | 0 | false | true
Free Agents | foundheart40 | duelist/sentinel | 18 | United_States | 0 | false | true
Free Agents | nicolasbeste | flex/sentinel | 18 | Argentina | 0 | false | true
Free Agents | erwan213 | sentinel/initiator | 18 | Chile | 0 | false | true
Free Agents | dancer4life2009 | sentinel | 18 | Peru | 0 | false | true
Free Agents | zirt0x | flex/duelist | 18 | Costa_Rica | 0 | false | true
Free Agents | kurten | flex | 18 | United_States | 0 | false | true
Free Agents | griezen | flex | 18 | Russia | 0 | false | true
Free Agents | jerryv419 | duelist | 18 | Lithuania | 0 | false | true
Free Agents | corleone001 | flex/controller | 18 | Finland | 0 | false | true
Free Agents | swarla | initiator | 18 | Denmark | 0 | false | true
Free Agents | hgame | initiator/sentinel | 18 | France | 0 | false | true
Free Agents | sixela27 | controller/duelist | 18 | Czechia | 0 | false | true
Free Agents | noenany | initiator/controller | 18 | Portugal | 0 | false | true
Free Agents | godjuanelo | sentinel | 18 | Turkey | 0 | false | true
Free Agents | guigui68160 | initiator/sentinel | 18 | Belgium | 0 | false | true
Free Agents | alkio67 | controller/duelist | 18 | Latvia | 0 | false | true
Free Agents | amoureux | duelist/controller | 18 | Japan | 0 | false | true
Free Agents | onlypower | controller | 18 | South_Korea | 0 | false | true
Free Agents | ghost458 | sentinel | 18 | Indonesia | 0 | false | true
Free Agents | thepunicher1 | flex | 18 | South_Korea | 0 | false | true
Free Agents | redxxx25 | sentinel | 18 | Cambodia | 0 | false | true
Free Agents | heector | sentinel/duelist | 18 | Indonesia | 0 | false | true
Free Agents | warland13 | initiator/controller | 18 | Philippines | 0 | false | true
Free Agents | xx8comimixx | sentinel/initiator | 18 | South_Korea | 0 | false | true
Free Agents | manurv | flex/initiator | 18 | Singapore | 0 | false | true
Free Agents | wqsd | controller/sentinel | 18 | Australia | 0 | false | true
Free Agents | k3rozen | flex | 18 | Hong_Kong | 0 | false | true
Free Agents | evzou | duelist | 18 | China | 0 | false | true
Free Agents | suicidalrabbit | controller/flex | 18 | China | 0 | false | true
Free Agents | ellrey | duelist/sentinel | 18 | China | 0 | false | true
Free Agents | shinoishi | sentinel | 18 | China | 0 | false | true
Free Agents | laniode | initiator | 18 | Taiwan | 0 | false | true
Free Agents | jovito2014 | sentinel/duelist | 18 | China | 0 | false | true
Free Agents | wistai | duelist/sentinel | 18 | Taiwan | 0 | false | true
Free Agents | noskilljustcheat | controller | 18 | China | 0 | false | true
Free Agents | eliasg4meryt | flex/initiator | 18 | Hong_Kong | 0 | false | true
Free Agents | xruablack11 | controller | 18 | Taiwan | 0 | false | true
Free Agents | kayzai | controller | 18 | Taiwan | 0 | false | true
Free Agents | apocacraft | duelist/initiator | 18 | China | 0 | false | true
Free Agents | rigolo14 | initiator | 18 | China | 0 | false | true
Free Agents | ch4pi3 | controller | 18 | Hong_Kong | 0 | false | true
Free Agents | phiie | duelist | 18 | China | 0 | false | true
Free Agents | leapool | sentinel | 18 | China | 0 | false | true
Free Agents | bryandragon28 | duelist | 18 | Hong_Kong | 0 | false | true
Free Agents | guillaume2003 | initiator | 18 | China | 0 | false | true
Free Agents | girlpiggy | sentinel | 18 | Hong_Kong | 0 | false | true
Free Agents | mrsneacky | sentinel | 18 | China | 0 | false | true
Free Agents | mrludark | flex | 18 | Taiwan | 0 | false | true
Free Agents | monsterbuff | flex/duelist | 18 | Taiwan | 0 | false | true
Free Agents | ciathegeek | flex | 18 | China | 0 | false | true
Free Agents | blevio | controller | 18 | China | 0 | false | true
Free Agents | voltwix | flex | 18 | China | 0 | false | true
Free Agents | maxmidle | initiator | 18 | Hong_Kong | 0 | false | true
Free Agents | xxfelimlgxx | flex/initiator | 18 | China | 0 | false | true
Free Agents | noobjacky08 | sentinel | 18 | Hong_Kong | 0 | false | true
Free Agents | xiabodepvpx | duelist/controller | 18 | China | 0 | false | true
Free Agents | crunchbite82 | duelist | 18 | China | 0 | false | true
Free Agents | raphal29 | flex/initiator | 18 | China | 0 | false | true
Free Agents | lea57520 | sentinel | 18 | Hong_Kong | 0 | false | true
Free Agents | isoka08 | initiator/controller | 18 | China | 0 | false | true
Free Agents | seyhart | sentinel | 18 | China | 0 | false | true
Free Agents | diaze62 | duelist | 18 | Taiwan | 0 | false | true
Free Agents | phaxytv | duelist/sentinel | 18 | China | 0 | false | true
Free Agents | mgarcia12 | controller/initiator | 18 | China | 0 | false | true
Free Agents | theeliot06 | duelist | 18 | China | 0 | false | true
Free Agents | bigcreeper01 | duelist | 18 | China | 0 | false | true
Free Agents | amaxy | initiator/duelist | 18 | China | 0 | false | true
Free Agents | haricotsama | duelist | 18 | China | 0 | false | true
Free Agents | skunder33 | initiator/controller | 18 | Hong_Kong | 0 | false | true
Free Agents | iceniko | duelist/flex | 18 | China | 0 | false | true
Free Agents | aerovern | initiator/duelist | 18 | Hong_Kong | 0 | false | true
Free Agents | trinitex | initiator/duelist | 18 | China | 0 | false | true
Free Agents | takabent | duelist | 18 | Taiwan | 0 | false | true
Free Agents | salega | controller/flex | 18 | China | 0 | false | true
Free Agents | misterstrike | duelist/controller | 18 | Taiwan | 0 | false | true
Free Agents | nicol4 | duelist/flex | 18 | Hong_Kong | 0 | false | true
Free Agents | killleur07 | controller | 18 | Hong_Kong | 0 | false | true
Free Agents | thelightedge | controller | 18 | China | 0 | false | true
Free Agents | xskyzzo | flex | 18 | Taiwan | 0 | false | true
Free Agents | starclair666 | sentinel | 18 | Hong_Kong | 0 | false | true
Free Agents | rtsy | controller | 18 | Hong_Kong | 0 | false | true
Free Agents | ateengo | duelist | 18 | China | 0 | false | true
Free Agents | azeohdprod | sentinel/controller | 18 | China | 0 | false | true
Free Agents | azog1401 | controller/sentinel | 18 | China | 0 | false | true
Free Agents | banalian49 | sentinel | 18 | China | 0 | false | true
Free Agents | killyboss | duelist/initiator | 18 | Hong_Kong | 0 | false | true
Free Agents | diouf2 | sentinel | 18 | China | 0 | false | true
Free Agents | gremaro78 | initiator | 18 | China | 0 | false | true
Free Agents | pehaty | duelist/sentinel | 18 | China | 0 | false | true
Free Agents | ziltoided | duelist | 18 | China | 0 | false | true
Free Agents | mickasky | duelist | 18 | Hong_Kong | 0 | false | true
Free Agents | mehdijan | duelist/controller | 18 | China | 0 | false | true
Free Agents | star1207 | initiator | 18 | Hong_Kong | 0 | false | true
Free Agents | bycecrox | sentinel/controller | 18 | China | 0 | false | true
Free Agents | krunch34 | flex/controller | 18 | China | 0 | false | true
Free Agents | mastertheofun | sentinel/duelist | 18 | China | 0 | false | true
Free Agents | siriux81 | sentinel | 18 | Hong_Kong | 0 | false | true
Free Agents | paco2015 | duelist | 18 | China | 0 | false | true
Free Agents | mrthomas85 | flex | 18 | China | 0 | false | true
Free Agents | criptide2b | flex | 18 | China | 0 | false | true
Free Agents | tuthur11 | flex | 18 | China | 0 | false | true
Free Agents | frzyrox | sentinel/controller | 18 | China | 0 | false | true
Free Agents | valtair711 | sentinel/initiator | 18 | China | 0 | false | true
JDG Esports | zhe | duelist | 21 | China | https://owcdn.net/img/6739e1d4086dd.png | true | false
Nova Esports | GREEN | initiator | 21 | Taiwan | https://owcdn.net/img/658658c275a25.png | true | false
FunPlus Phoenix | Setrod | initiator/controller/duelist | 21 | Taiwan | https://www.vlr.gg/img/base/ph/sil.png | true | false
Xi Lai Gaming | WsLeo | sentinel/initiator | 18 | Taiwan | https://owcdn.net/img/6585b7ad2cb28.png | true | false
All Gamers | iamgrq | controller/duelist | 18 | China | https://www.vlr.gg/img/base/ph/sil.png | true | false
All Gamers | Au1 | sentinel/controller | 18 | China | https://www.vlr.gg/img/base/ph/sil.png | true | false
Wolves Esports | qiutiaN | sentinel/duelist | 18 | Taiwan | https://www.vlr.gg/img/base/ph/sil.png | true | false
Wolves Esports | autumN | initiator/duelist/sentinel | 18 | Taiwan | https://www.vlr.gg/img/base/ph/sil.png | false | false`;



function normalizeNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

function applyPlayerRatingOverrides(players, ratingsConfig = {}) {
  const byName = new Map(Object.entries(ratingsConfig || {}).map(([k, v]) => [normalizeNameKey(k), v]));
  return players.map((p) => {
    const override = byName.get(normalizeNameKey(p.name));
    if (!override) return p;
    return {
      ...p,
      ratingOverride: {
        attrs: override.attrs || null,
        attributes: override.attributes || null,
        operatorAim: override.operatorAim,
        traitHints: Array.isArray(override.traitHints) ? override.traitHints : undefined
      }
    };
  });
}
export const IMPORTED_SEED_DB = buildSeedDatabaseFromText(`${MASTER_PLAYERS_TEXT}
${MASTER_PLAYERS_TEXT_EXTRA}
${MASTER_PLAYERS_TEXT_EXTRA_2}
${MASTER_PLAYERS_TEXT_EXTRA_3}
${MASTER_PLAYERS_TEXT_EXTRA_4}`);

const PLAYER_RATINGS_OVERRIDES = buildRatingsOverridesForAllPlayers(IMPORTED_SEED_DB.players);

export const REAL_TEAM_DATABASE = IMPORTED_SEED_DB.teams;
export const REAL_IMPORTED_PLAYERS = applyPlayerRatingOverrides(IMPORTED_SEED_DB.players, PLAYER_RATINGS_OVERRIDES);
