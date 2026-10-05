"""Authored map collection specifications. Coordinates are approximate anchors.

Real-world coastlines/province geometry: Natural Earth. Period borders, control
sectors and strengths are gameplay interpretations, not surveyed historical lines.
Legend settings are literary interpretations; Emberfall is an original world.
"""

def sites(text):
    return [(name,terrain,float(lon),float(lat)) for row in text.strip().split('\n')
            for name,terrain,lon,lat in [row.strip().split('|')]]


def region(key,name,category,bounds,countries,description,anchors,**extra):
    return dict(id=key,name=name,category=category,kind='regional',bounds=bounds,
                countries=countries.split(),description=description,sites=sites(anchors),**extra)

MAPS = [
region('japan_korea','Japan & Korea','world',[125,30,146,46],'JPN KOR PRK',
       'Mountain provinces, coastal corridors and a small network of sea crossings around the Sea of Japan.', '''
Hokkaido|forest|142.0|43.5
Aomori|forest|140.7|40.8
Iwate|hills|141.2|39.5
Akita|forest|140.1|39.7
Sendai|city|140.9|38.3
Fukushima|hills|140.4|37.7
Niigata|coast|139.0|37.9
Edo Plain|city|139.7|35.7
Nagano|hills|138.2|36.6
Kanazawa|coast|136.7|36.6
Owari|plains|136.9|35.2
Kyoto|city|135.8|35.0
Kii|forest|135.7|33.9
Sanin|coast|133.1|35.5
Hiroshima|city|132.5|34.4
Shikoku|hills|133.5|33.6
Northern Kyushu|city|130.4|33.6
Southern Kyushu|hills|130.6|31.6
Pyongyang|city|125.8|39.0
Hamhung|hills|127.5|39.9
Northern Korea|forest|129.0|41.6
Seoul|city|127.0|37.6
Jeolla|plains|127.1|35.2
Gyeongsang|coast|128.6|35.9
'''),
region('british_irish_isles','British & Irish Isles','world',[-11,49.7,2,60.9],'GBR IRL',
       'Highland passes, river valleys and island approaches across Britain and Ireland.', '''
Northern Highlands|hills|-4.8|58.1
Western Highlands|hills|-5.2|56.8
Grampians|hills|-3.5|57.1
Lowlands|city|-3.2|55.9
Borders|plains|-2.7|55.4
Northumbria|coast|-1.7|55.1
Cumbria|hills|-3.0|54.5
Yorkshire|plains|-1.2|53.9
Lancashire|city|-2.7|53.8
East Midlands|plains|-1.1|52.9
West Midlands|city|-2.0|52.5
East Anglia|plains|0.8|52.3
London|city|-0.1|51.5
Kent|coast|0.8|51.2
Wessex|plains|-1.9|51.1
Devon|hills|-3.8|50.7
Cornwall|coast|-4.9|50.3
Gwynedd|hills|-4.1|53.0
Powys|hills|-3.4|52.4
South Wales|coast|-3.5|51.6
Ulster|hills|-6.7|54.7
Connacht|plains|-8.6|53.8
Leinster|city|-6.8|53.1
Munster|plains|-8.4|52.1
'''),
region('anatolia_caucasus','Anatolia & the Caucasus','world',[25,35,51,44.5],'TUR GEO ARM AZE',
       'Contest the plateaus and mountain passages between the Black Sea, Aegean and Caspian.', '''
Thrace|plains|27.5|41.4
Bosphorus|city|29.0|41.0
Bithynia|forest|30.4|40.7
Mysia|coast|27.8|39.6
Ionia|coast|27.2|38.4
Caria|hills|28.4|37.2
Lydia|plains|28.9|38.7
Phrygia|plains|30.5|38.8
Lycia|coast|30.0|36.7
Pisidia|hills|31.2|37.6
Galatia|city|32.9|39.9
Paphlagonia|forest|33.8|41.4
Lycaonia|plains|32.5|37.9
Cappadocia|hills|34.8|38.6
Cilicia|coast|35.3|37.0
Pontus|forest|36.3|41.2
Upper Euphrates|hills|38.3|38.4
Armenian Highlands|hills|41.3|39.9
Lake Van|hills|43.3|38.5
Colchis|forest|42.0|42.2
Kartli|city|44.8|41.7
Greater Caucasus|hills|43.5|42.7
Ararat Plain|plains|44.5|40.2
Caspian Gates|coast|48.9|40.5
'''),
region('nile_horn','Nile Valley & the Horn','world',[27,-1,52,32],'EGY SDN SDS ETH ERI DJI SOM SOL KEN UGA',
       'Follow the Nile through desert approaches into the Ethiopian highlands and the Horn of Africa.', '''
Nile Delta|plains|31.0|30.8
Cairo|city|31.2|30.0
Western Oases|desert|28.8|28.3
Middle Egypt|plains|30.8|28.1
Thebaid|city|32.6|25.7
Aswan|coast|32.9|24.1
Nubia|desert|31.2|21.8
Dongola|plains|30.5|19.2
Red Sea Hills|hills|36.0|20.0
Khartoum|city|32.6|15.6
Kordofan|desert|29.7|13.2
White Nile|plains|32.6|11.8
Blue Nile|forest|34.4|11.3
Sudd|forest|30.7|8.0
Equatoria|forest|31.6|4.9
Eritrean Highlands|hills|38.9|15.3
Tigray|hills|39.5|13.5
Lake Tana|hills|37.4|11.6
Shewa|city|38.7|9.0
Afar|desert|41.0|12.0
Harar|city|42.1|9.3
Somali Plateau|desert|46.0|8.0
Somali Coast|coast|48.5|10.0
Jubba Valley|plains|43.5|1.0
'''),
region('andes_pacific','Andes & Pacific Coast','world',[-83,-56,-64,13],'COL ECU PER BOL CHL ARG',
       'A long mountain theater: Pacific lowlands, Andean valleys and a handful of passes between them.', '''
Caribbean Andes|coast|-74.1|10.4
Antioquia|hills|-75.6|6.3
Bogota Plateau|city|-74.1|4.7
Cauca Valley|plains|-76.5|3.4
Narino|hills|-77.3|1.2
Quito|city|-78.5|-0.2
Guayas|coast|-79.9|-2.2
Azuay|hills|-79.0|-2.9
Piura|desert|-80.6|-5.2
Cajamarca|hills|-78.5|-7.2
Trujillo|coast|-79.0|-8.1
Huanuco|forest|-76.2|-9.9
Lima|city|-77.0|-12.0
Ayacucho|hills|-74.2|-13.2
Cusco|city|-72.0|-13.5
Arequipa|hills|-71.5|-16.4
Titicaca|hills|-69.1|-16.0
Altiplano|hills|-68.1|-17.8
Atacama|desert|-69.8|-23.7
Norte Chico|desert|-71.2|-29.9
Central Chile|city|-70.7|-33.5
Araucania|forest|-72.6|-38.7
Patagonia|hills|-71.6|-46.0
Magellan Strait|coast|-70.9|-53.2
'''),
region('caribbean_central_america','Caribbean & Central America','world',[-94,7,-59,28],'MEX BLZ GTM HND SLV NIC CRI PAN CUB HTI DOM JAM BHS PRI TTO BRB ATG DMA GRD KNA LCA VCT',
       'Island chains meet a continental corridor. Limited sea lanes keep the archipelago readable.', '''
Yucatan|plains|-89.0|20.7
Chiapas|forest|-92.0|16.4
Guatemala Highlands|hills|-90.7|14.8
Peten|forest|-90.0|16.8
Belize|coast|-88.7|17.2
Western Honduras|hills|-88.0|14.8
Eastern Honduras|forest|-85.0|15.0
El Salvador|city|-89.2|13.7
Western Nicaragua|plains|-86.3|12.3
Mosquito Coast|forest|-84.2|13.0
Costa Rica|hills|-84.1|9.9
Western Panama|hills|-82.4|8.5
Panama Canal Lands|coast|-79.5|9.0
Darien|forest|-77.8|8.3
Western Cuba|city|-82.4|23.0
Central Cuba|plains|-79.5|21.7
Eastern Cuba|hills|-76.3|20.3
Jamaica|hills|-77.3|18.1
Haiti|hills|-72.6|19.0
Hispaniola East|plains|-70.5|18.9
Puerto Rico|coast|-66.4|18.2
Bahamas|coast|-77.4|25.0
Leeward Islands|coast|-61.8|17.1
Windward Islands|coast|-61.0|13.8
'''),
region('crusader_states','The Crusader States · 1187','campaigns',[33,29,39,37.5],'TUR SYR LBN ISR PSX JOR',
       'A Levant campaign inspired by 1187: coastal strongholds, inland cities and the approaches between them.', '''
Antioch|city|36.2|36.2
Cilician Gates|hills|35.2|37.1
Latakia|coast|35.8|35.5
Orontes Valley|plains|36.5|35.3
Aleppo|city|37.2|36.2
Hama|city|36.8|35.1
Tortosa|coast|35.9|34.9
Krak Highlands|hills|36.3|34.8
Tripoli|city|35.8|34.4
Homs|city|36.7|34.7
Baalbek|hills|36.2|34.0
Beirut|coast|35.5|33.9
Sidon|coast|35.4|33.6
Damascus|city|36.3|33.5
Tyre|city|35.2|33.3
Banias|hills|35.7|33.2
Acre|city|35.1|32.9
Galilee|hills|35.5|32.7
Hauran|plains|36.3|32.6
Caesarea|coast|34.9|32.5
Jerusalem|city|35.2|31.8
Jaffa|coast|34.8|32.0
Kerak|hills|35.7|31.2
Transjordan|desert|36.2|30.4
''',era='1187',source=['Fordham: Hattin and the Levant','https://sourcebooks.web.fordham.edu/source/1187hattin.asp']),
region('civil_war_east','Civil War: Eastern Theater · 1863','campaigns',[-82,35.5,-74.5,41],'USA',
       'A summer 1863-inspired campaign across Virginia, Maryland and Pennsylvania. Historical locations, open conquest rules.', '''
Pittsburgh|city|-80.0|40.4
Allegheny Mountains|hills|-78.7|40.1
Harrisburg|city|-76.9|40.3
Gettysburg|plains|-77.2|39.8
Philadelphia|city|-75.2|40.0
Cumberland|hills|-78.8|39.7
Sharpsburg|plains|-77.7|39.5
Frederick|city|-77.4|39.4
Baltimore|city|-76.6|39.3
Washington|city|-77.0|38.9
Eastern Shore|coast|-76.0|38.7
Harpers Ferry|hills|-77.7|39.3
Winchester|plains|-78.2|39.2
Manassas|plains|-77.5|38.8
Fredericksburg|city|-77.5|38.3
Shenandoah Valley|plains|-78.9|38.4
Charlottesville|city|-78.5|38.0
Richmond|city|-77.4|37.5
Virginia Peninsula|coast|-76.6|37.2
Lynchburg|city|-79.1|37.4
Appomattox|plains|-78.8|37.4
Petersburg|city|-77.4|37.2
Norfolk|coast|-76.3|36.9
Southside|plains|-79.4|36.7
''',era='Summer 1863',source=['National Park Service: Civil War','https://www.nps.gov/civilwar/index.htm']),
region('rome_carthage','Rome vs Carthage · 218 BCE','campaigns',[-10,29,19,46],'ESP PRT FRA ITA MAR DZA TUN',
       'A western Mediterranean theater inspired by the opening of the Second Punic War. Sea crossings connect its competing shores.', '''
Lusitania|plains|-8|39
Gallaecia|hills|-8|43
Baetica|plains|-5|37
Carthago Nova|city|-1|37.6
Tarraco|city|1.2|41.1
Ebro Valley|plains|-1|42
Pyrenees|hills|1|42.7
Massalia|coast|5.4|43.3
Narbonensis|plains|3|43.2
Western Alps|hills|7|44.5
Po Valley|plains|10|45
Liguria|coast|8.9|44.4
Etruria|plains|11|43
Rome|city|12.5|41.9
Campania|city|14.3|40.9
Apulia|plains|16.5|41.1
Bruttium|hills|16.2|39.2
Sicily West|coast|13.4|38.1
Syracuse|city|15.3|37.1
Sardinia|hills|9|40
Corsica|forest|9|42
Mauretania|hills|-4|34
Numidia|plains|6|35
Carthage|city|10.3|36.9
''',era='218 BCE',source=['World History Encyclopedia: Second Punic War','https://www.worldhistory.org/Second_Punic_War/']),
region('sengoku_japan','Sengoku Japan · 1560','campaigns',[129,30,142,41.6],'JPN',
       'An interpretation of Japan in 1560, divided into provincial theaters. Domain alliances and diplomacy are not simulated.', '''
Mutsu|forest|140.7|40.2
Dewa|hills|140.3|38.8
Echigo|plains|139|37.9
Etchu|hills|137.2|36.7
Kaga|coast|136.6|36.6
Echizen|plains|136.2|36.1
Shinano|hills|138.2|36.5
Kai|hills|138.6|35.7
Musashi|city|139.6|35.8
Sagami|coast|139.2|35.3
Suruga|coast|138.4|35.0
Mikawa|plains|137.2|34.9
Owari|city|136.9|35.2
Mino|hills|136.8|35.6
Omi|plains|136.1|35.2
Yamashiro|city|135.8|35.0
Settsu|city|135.5|34.7
Kii|forest|135.7|33.9
Harima|plains|134.7|34.9
Izumo|coast|132.8|35.4
Aki|hills|132.5|34.5
Tosa|hills|133.5|33.6
Bungo|coast|131.6|33.2
Satsuma|hills|130.6|31.6
''',era='1560',source=['Japan National Tourism Organization: Sengoku period','https://www.japan.travel/en/guide/japanese-history/']),
region('epic_lanka','Lanka: The Epic Campaign','legends',[79.3,5.7,82.1,10.1],'LKA',
       'A Ramayana-inspired island campaign. Real island geography supports imagined epic kingdoms, forests and mountain strongholds.', '''
Northern Landing|coast|80.0|9.7
Bridgeward Coast|coast|79.9|9.1
Pearl Shore|coast|79.8|8.5
Palmyra Country|plains|80.4|9.3
Elephant Forest|forest|80.5|8.9
Moonwater Port|coast|81.1|8.6
Northern Watch|hills|80.5|8.4
Lotus Lakes|plains|80.4|8.1
Western March|coast|79.9|7.8
Lion Plateau|hills|80.7|7.9
Eastern Groves|forest|81.3|8.0
Thunder Coast|coast|81.7|7.7
River Kingdom|plains|80.2|7.6
Cloud Citadel|city|80.6|7.3
Ashoka Grove|forest|80.8|7.1
Emerald Highlands|hills|80.8|6.9
Western Gate|city|79.9|7.0
Ravana's Court|city|80.3|6.9
Mountain Sanctum|hills|80.5|6.8
Eastern Wilds|forest|81.3|7.0
Sunrise Haven|coast|81.8|6.9
Southern Forest|forest|81.2|6.5
Cinnamon Coast|coast|80.2|6.2
Southern Bastion|city|80.8|6.1
''',era='Epic interpretation',source=['The Ramayana','https://www.britannica.com/topic/Ramayana-Indian-epic']),
]


def local(key,name,category,bounds,description,anchors,source,**extra):
    return dict(id=key,name=name,category=category,kind='local',bounds=bounds,
                description=description,sites=sites(anchors),source=source,**extra)

MAPS += [
local('panipat_1526','First Panipat · 1526','historical',[76.91,29.33,77.03,29.46],
      'An interpretation of Babur’s defensive position and the Lodi approach. Artillery, wagons and elephants are abstracted into fixed forces.', '''
Northern track|plains|76.925|29.448
Timurid rear|plains|76.955|29.449
Babur's reserve|city|76.98|29.447
Northeast fields|plains|77.014|29.447
Western screen|plains|76.924|29.425
Left reserve|plains|76.954|29.427
Central reserve|plains|76.983|29.428
Eastern screen|plains|77.014|29.426
Western earthworks|hills|76.925|29.406
Wagon line west|city|76.954|29.407
Wagon line east|city|76.983|29.408
Eastern ditch|hills|77.014|29.406
Panipat outskirts|city|76.925|29.385
Western battle plain|plains|76.954|29.386
Central battle plain|plains|76.983|29.387
Eastern battle plain|plains|77.014|29.385
Lodi left|plains|76.925|29.365
Lodi centre|plains|76.954|29.366
Ibrahim's position|city|76.983|29.365
Lodi right|plains|77.014|29.366
Southwest approach|plains|76.925|29.344
Southern road|plains|76.954|29.344
Lodi reserve|plains|76.983|29.344
Southeast approach|plains|77.014|29.344
''',['Panipat district: First Battle','https://panipat.gov.in/first-battle/'],
      date='21 April 1526',sides=['Timurid army','Lodi army'],commanders=['Babur','Ibrahim Lodi'],axis='y',capitals=[2,18],objectives=[9,10,14],defender=0),
local('austerlitz_1805','Austerlitz · 1805','historical',[16.70,49.10,16.87,49.23],
      'Contest the Pratzen Heights and village approaches. Fog, timed arrivals and artillery are abstracted; no scripted historical maneuvers.', '''
Bosenitz approach|plains|16.744|49.220
Santon Hill|hills|16.762|49.203
Bellowitz|city|16.757|49.185
Zuran Hill|hills|16.738|49.179
Schlapanitz|city|16.728|49.169
Jirzikowitz|city|16.758|49.166
Western reserve|plains|16.715|49.198
Goldbach north|plains|16.746|49.150
Kobelnitz|city|16.733|49.141
Sokolnitz|city|16.754|49.116
French southern approach|plains|16.714|49.116
French centre|plains|16.718|49.153
Holubitz|city|16.814|49.176
Blasowitz|city|16.786|49.165
Pratzen village|city|16.765|49.141
Pratzen Heights|hills|16.779|49.130
Stare Vinohrady|hills|16.802|49.149
Krenowitz|city|16.829|49.143
Austerlitz|city|16.867|49.153
Allied northern reserve|plains|16.843|49.211
Eastern plateau|hills|16.847|49.181
Augezd approach|plains|16.770|49.108
Eastern ponds approach|plains|16.809|49.109
Allied southern reserve|plains|16.852|49.118
''',['Fondation Napoléon: Austerlitz','https://www.napoleon.org/en/history-of-the-two-empires/articles/the-battle-of-austerlitz-and-the-principles-of-war/'],
      date='2 December 1805',sides=['French army','Allied army'],commanders=['Napoleon','Kutuzov'],axis='x',capitals=[3,17],objectives=[9,14,15],defender=1),
local('antietam_1862','Antietam · 1862','historical',[-77.782,39.425,-77.707,39.507],
      'The Cornfield, Sunken Road and creek crossings form a compact interpretation of the battlefield. Fixed forces abstract the day’s arrivals.', '''
North Woods|forest|-77.749|39.500
Poffenberger fields|plains|-77.741|39.497
East Woods|forest|-77.733|39.491
Upper bridge approach|coast|-77.720|39.490
Northwestern reserve|plains|-77.772|39.498
The Cornfield|plains|-77.746|39.488
West Woods|forest|-77.755|39.480
Dunker Church|city|-77.746|39.478
Mumma Farm|city|-77.738|39.479
Roulette Farm|city|-77.732|39.472
Sunken Road|hills|-77.737|39.467
Piper Farm|city|-77.746|39.461
Sharpsburg|city|-77.750|39.458
Western town approach|plains|-77.774|39.461
Middle bridge approach|coast|-77.721|39.464
Eastern heights|hills|-77.713|39.450
Cemetery heights|hills|-77.739|39.455
Burnside Bridge|coast|-77.732|39.450
Sherrick Farm|city|-77.742|39.448
Otto Farm|city|-77.746|39.440
Southern heights|hills|-77.758|39.439
Snavely approach|coast|-77.731|39.429
Southeastern reserve|plains|-77.714|39.432
Southwestern road|plains|-77.773|39.432
''',['American Battlefield Trust: historical map','https://www.battlefields.org/learn/maps/map-battlefield-antietam'],
      date='17 September 1862',sides=['Confederate army','Union army'],commanders=['Robert E. Lee','George B. McClellan'],axis='x',capitals=[12,3],objectives=[5,10,17],defender=0),
local('cannae_216','Cannae · 216 BCE','historical',[16.025,41.275,16.155,41.365],
      'A battlefield interpretation around Cannae and the lower Aufidus. The precise ancient deployment and river course are disputed; encirclement is not scripted.', '''
Northern ford|coast|16.038|41.353
Aufidus west bank|coast|16.069|41.351
Aufidus east bank|coast|16.103|41.354
Northeastern track|plains|16.141|41.353
Western plain|plains|16.038|41.337
Carthaginian left|plains|16.069|41.337
Carthaginian centre|plains|16.103|41.337
Eastern plain|plains|16.141|41.338
Western cavalry ground|plains|16.038|41.322
Hannibal's position|city|16.069|41.322
Forward battle plain|plains|16.103|41.322
Eastern cavalry ground|plains|16.141|41.322
Southwest flank|plains|16.038|41.308
Roman left|plains|16.069|41.308
Roman centre|plains|16.103|41.308
Roman right|plains|16.141|41.308
Western ridge|hills|16.038|41.294
Cannae heights|hills|16.067|41.294
Roman reserve|city|16.103|41.294
Eastern rise|hills|16.141|41.294
Southwest track|plains|16.038|41.281
Southern camp approach|plains|16.069|41.281
Southern reserve|plains|16.103|41.281
Southeast track|plains|16.141|41.281
''',['World History Encyclopedia: Cannae','https://www.worldhistory.org/Battle_of_Cannae/'],
      date='2 August 216 BCE',sides=['Carthaginian army','Roman army'],commanders=['Hannibal','Paullus and Varro'],axis='y',capitals=[9,18],objectives=[5,10,17],defender=0),
local('naseby_1645','Naseby · 1645','historical',[-1.025,52.387,-.93,52.445],
      'Ridges and open fields around Naseby. Sector positions interpret the registered battlefield; cavalry and baggage capture use normal control rules.', '''
Clipston approach|plains|-1.012|52.439
Northern ridge|hills|-.988|52.438
Royalist reserve|city|-.965|52.438
Northeast approach|plains|-.941|52.438
Western Royalist flank|plains|-1.012|52.429
Dust Hill west|hills|-.988|52.429
Dust Hill east|hills|-.965|52.429
Eastern Royalist flank|plains|-.941|52.429
Western hedge|forest|-1.012|52.420
Broad Moor west|plains|-.988|52.420
Broad Moor centre|plains|-.965|52.420
Broad Moor east|plains|-.941|52.420
Sulby hedge approach|forest|-1.012|52.411
Parliamentary left|plains|-.988|52.411
Parliamentary centre|hills|-.965|52.411
Parliamentary right|plains|-.941|52.411
Western rear|plains|-1.012|52.402
Naseby ridge|hills|-.988|52.402
Fairfax's reserve|city|-.965|52.402
Eastern rear|plains|-.941|52.402
Baggage road|plains|-1.012|52.393
Naseby outskirts|city|-.988|52.393
Southern fields|plains|-.965|52.393
Southeast track|plains|-.941|52.393
''',['Historic England: registered battlefield','https://historicengland.org.uk/listing/the-list/list-entry/1000023'],
      date='14 June 1645',sides=['Royalist army','Parliamentarian army'],commanders=['Charles I','Thomas Fairfax'],axis='y',capitals=[2,18],objectives=[9,10,17],defender=1),
local('constantinople','Constantinople: The Walled City','sieges',[28.895,40.995,29.04,41.057],
      'A siege-inspired district map around the land walls and Golden Horn. Walls are landmarks, not a separate breach mechanic.', '''
Western camps|plains|28.907|41.044
Northern camps|plains|28.930|41.050
Blachernae|city|28.941|41.038
Golden Horn head|coast|28.947|41.048
Mesoteichion|city|28.927|41.024
Northern wall|hills|28.937|41.031
Western approach|plains|28.907|41.027
Southern approach|plains|28.910|41.012
Golden Gate|city|28.923|40.999
Studion|city|28.931|41.003
Xerolophos|hills|28.940|41.008
Lycus Valley|plains|28.940|41.021
Holy Apostles|city|28.950|41.020
Northern quarter|city|28.953|41.029
Aetius quarter|city|28.944|41.027
Forum of the Ox|plains|28.953|41.010
Forum of Theodosius|city|28.965|41.010
Central quarter|city|28.962|41.020
Forum of Constantine|city|28.972|41.008
Hippodrome|city|28.975|41.005
Hagia Sophia quarter|city|28.980|41.009
Acropolis|hills|28.985|41.014
Galata|city|28.974|41.027
Eastern shore|coast|29.016|41.026
''',['UNESCO: Historic Areas of Istanbul','https://whc.unesco.org/en/list/356/'],countries=['TUR'],era='Medieval city interpretation'),
local('chittorgarh','Chittorgarh: The Hill Fort','sieges',[74.615,24.85,74.725,24.925],
      'A hill-fort campaign across plateau strongpoints and surrounding approaches. Gates and walls use existing terrain and movement rules.', '''
Northern approach|plains|74.631|24.917
Northern town|city|74.649|24.914
North plateau|hills|74.674|24.914
Northeastern fields|plains|74.708|24.914
Western riverbank|coast|74.628|24.900
Lower town|city|74.647|24.897
Fort approach|hills|74.665|24.895
Eastern valley|plains|74.704|24.898
Western fields|plains|74.630|24.881
Padan Pol approach|city|74.655|24.888
Ram Pol|city|74.672|24.893
Upper plateau|hills|74.680|24.897
Rana Kumbha precinct|city|74.674|24.888
Vijay Stambha precinct|city|74.675|24.887
Gaumukh precinct|coast|74.674|24.883
Eastern escarpment|hills|74.689|24.887
Padmini precinct|city|74.678|24.881
Southern plateau|hills|74.683|24.875
Southern gate approach|hills|74.674|24.869
Southeastern fields|plains|74.711|24.874
Southwestern road|plains|74.636|24.862
Southern camps|plains|74.658|24.859
Southern foothills|forest|74.684|24.858
Eastern camps|plains|74.713|24.857
''',['UNESCO: Hill Forts of Rajasthan','https://whc.unesco.org/en/list/247/'],era='Fort landscape interpretation'),
local('malta','Malta: Harbors & Forts','sieges',[14.16,35.79,14.58,36.09],
      'A 1565-inspired island theater around fortified harbors and inland approaches. Naval combat, bombardment and breaches are not separate mechanics.', '''
Gozo West|hills|14.205|36.044
Gozo Citadel|city|14.240|36.046
Gozo East|coast|14.283|36.028
Comino|coast|14.334|36.012
Mellieha|hills|14.363|35.956
St Paul's Bay|coast|14.405|35.947
Mgarr|plains|14.367|35.919
Mosta|city|14.426|35.908
Naxxar|hills|14.444|35.914
Mdina|city|14.402|35.886
Rabat|city|14.397|35.882
Dingli|hills|14.382|35.858
Siggiewi|plains|14.438|35.854
Zebbug|city|14.442|35.871
Birkirkara|city|14.465|35.895
Marsa|plains|14.494|35.877
Sciberras Peninsula|hills|14.513|35.900
Fort St Elmo|city|14.519|35.903
Birgu|city|14.523|35.888
Senglea|city|14.516|35.887
Cospicua|city|14.523|35.881
Zejtun|city|14.533|35.856
Marsaxlokk|coast|14.545|35.842
Zurrieq|plains|14.475|35.831
''',['Heritage Malta: National War Museum','https://heritagemalta.mt/explore/national-war-museum/'],countries=['MLT'],era='1565-inspired theater'),
local('kurukshetra','Kurukshetra: The Epic Battlefield','legends',[76.70,29.85,76.94,30.08],
      'A Mahabharata-inspired interpretation of the Kurukshetra landscape. Camp positions and named sectors are imaginative, not archaeological claims.', '''
Northern Pilgrim Road|plains|76.725|30.052
Saraswati Memory|coast|76.778|30.052
Kaurava Rear|plains|76.839|30.052
Northern Grove|forest|76.913|30.052
Western Watch|hills|76.725|30.018
Bhishma's Camp|city|76.778|30.018
Kaurava Standard|city|76.839|30.018
Eastern Watch|plains|76.913|30.018
Chariot Ground West|plains|76.725|29.979
Drona's Field|plains|76.778|29.979
Field of Vows|plains|76.839|29.979
Chariot Ground East|plains|76.913|29.979
Western Sacred Grove|forest|76.725|29.941
Dharma Field|plains|76.778|29.941
Arjuna's Ground|plains|76.839|29.941
Eastern Sacred Grove|forest|76.913|29.941
Pandava Left|plains|76.725|29.905
Pandava Standard|city|76.778|29.905
Yudhishthira's Camp|city|76.839|29.905
Pandava Right|plains|76.913|29.905
Southern Pilgrim Road|plains|76.725|29.868
Lotus Water|coast|76.778|29.868
Southern Reserve|plains|76.839|29.868
Southern Grove|forest|76.913|29.868
''',['Kurukshetra district: cultural setting','https://kurukshetra.gov.in/history/'],era='Mahabharata-inspired'),
local('troy_troad','Troy & the Troad','legends',[26.18,39.90,26.31,40.015],
      'An Iliad-inspired landscape around Troy. The ancient coast, camps and battle sectors are interpretive; no supernatural or scripted siege rules.', '''
Northern Cape|coast|26.205|40.003
Northern Plain|plains|26.240|40.002
Dardanelles Watch|hills|26.271|40.002
Eastern Gate Country|plains|26.294|39.996
Achaean Landing|coast|26.205|39.980
Ship Camp West|city|26.227|39.982
Ship Camp East|city|26.249|39.982
Northern Ridge|hills|26.287|39.978
Achilles' Camp|city|26.206|39.958
Patroclus' Field|plains|26.228|39.956
Scamander Plain|plains|26.249|39.962
Trojan Northern Road|plains|26.286|39.960
Western Dunes|coast|26.199|39.937
Battle Plain West|plains|26.226|39.938
Battle Plain East|plains|26.251|39.941
Troy Citadel|city|26.239|39.957
Southern Ford|coast|26.228|39.920
Scaean Gate Approach|city|26.247|39.952
Trojan Orchard|forest|26.272|39.938
Eastern Foothills|hills|26.295|39.940
Southern Coast|coast|26.199|39.916
Southern Pastures|plains|26.250|39.911
Ida Road|hills|26.273|39.917
Eastern Woodland|forest|26.295|39.917
''',['UNESCO: Archaeological Site of Troy','https://whc.unesco.org/en/list/849/'],countries=['TUR'],era='Iliad-inspired'),
]

MAPS.append(dict(id='emberfall',name='Emberfall: Kingdoms of Ash',category='legends',kind='fantasy',
 bounds=[0,0,100,75],era='Original high fantasy',
 description='An original high-fantasy world: rival mountain halls, ancient forests, river kingdoms and the volcanic Ashen Crown. No borrowed characters or geography.',
 sites=sites('''
Frostwatch|hills|18|63
Wintermere|coast|34|65
Stonewake Halls|city|49|61
Thunder Peaks|hills|65|63
Dawnspire|city|82|61
Greenhollow|plains|14|48
Elderbough|forest|30|50
Deepwood Court|city|43|47
Silver March|plains|59|48
Obsidian Pass|hills|73|49
Ashen Crown|city|87|46
Westhaven|coast|12|32
Alder Vale|plains|27|35
Rivermeet|city|42|32
Copper Downs|hills|57|34
Ember Waste|desert|73|34
Cinder Gate|city|87|30
Saltwind Coast|coast|19|19
Harvest Reach|plains|34|20
Sunward Keep|city|49|18
Glasswater Bay|coast|61|17
Redstone Hills|hills|74|20
Nightwood|forest|85|15
Far Lantern|coast|40|7
''')))

assert len(MAPS)==22
assert all(24<=len(m['sites'])<=30 for m in MAPS)
assert len({m['id'] for m in MAPS})==len(MAPS)
