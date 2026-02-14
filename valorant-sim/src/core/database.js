import { buildSeedDatabaseFromText } from './importer.js';

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

export const IMPORTED_SEED_DB = buildSeedDatabaseFromText(MASTER_PLAYERS_TEXT);

export const REAL_TEAM_DATABASE = IMPORTED_SEED_DB.teams;
export const REAL_IMPORTED_PLAYERS = IMPORTED_SEED_DB.players;
