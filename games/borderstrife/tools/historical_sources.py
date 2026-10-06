"""Historical theaters: named gameplay sectors, never claimed as surveyed borders.

Coordinates are longitude/latitude. Sources establish setting and campaign scope;
Natural Earth supplies modern coastlines. Starting ownership remains game-balanced.
"""
from .collection_sources import region

ATLAS = ['West Point campaign atlases', 'https://dhc.westpoint.edu/atlases/']
MAPS = [
region('crusader_levant', 'Crusader Levant · 1187', 'historical', [34,30.5,37.8,36.8], 'TUR SYR LBN ISR PSX JOR',
       'Coastal strongholds, the Lebanon mountains and the Jordan Valley in the age of Saladin. A geographic conquest sandbox inspired by 1187.', '''
Antioch|city|36.16|36.20
Latakia|coast|35.79|35.53
Jabala|coast|35.93|35.36
Shaizar|plains|36.57|35.27
Hama|city|36.75|35.13
Tortosa|coast|35.89|34.89
Krak des Chevaliers|hills|36.29|34.76
Homs|city|36.71|34.73
Tripoli|city|35.84|34.44
Baalbek|hills|36.20|34.01
Byblos|coast|35.65|34.12
Beirut|coast|35.51|33.89
Damascus|city|36.30|33.51
Sidon|coast|35.37|33.56
Tyre|coast|35.20|33.27
Banyas|hills|35.69|33.25
Acre|city|35.08|32.93
Tiberias|plains|35.53|32.79
Hauran|plains|36.57|32.70
Caesarea|coast|34.91|32.50
Nablus|hills|35.26|32.22
Jaffa|coast|34.76|32.05
Jerusalem|city|35.23|31.78
Jericho|plains|35.46|31.86
Ascalon|coast|34.55|31.67
Gaza|coast|34.46|31.50
Kerak|hills|35.70|31.18
Montreal|hills|35.56|30.53
''', era='Levant · 1187 setting', source=ATLAS, capital='Jerusalem'),
region('civil_war_eastern_theater', 'Civil War · Eastern Theater', 'historical', [-80.7,36.4,-75,41.2], 'USA',
       'The Blue Ridge, Shenandoah Valley and Chesapeake approaches from Pennsylvania to Virginia. Campaign geography inspired by 1861–1865.', '''
Pittsburgh|city|-79.996|40.44
Johnstown|hills|-78.92|40.33
Bedford|hills|-78.50|40.02
Harrisburg|city|-76.88|40.27
Lancaster|plains|-76.30|40.04
York|plains|-76.73|39.96
Gettysburg|plains|-77.23|39.83
Cumberland|hills|-78.76|39.65
Hagerstown|plains|-77.72|39.64
Frederick|plains|-77.41|39.41
Baltimore|city|-76.61|39.29
Annapolis|coast|-76.49|38.98
Washington|city|-77.04|38.91
Winchester|plains|-78.16|39.19
Harpers Ferry|hills|-77.74|39.33
Manassas|plains|-77.48|38.75
Culpeper|plains|-78.00|38.47
Fredericksburg|city|-77.46|38.30
Harrisonburg|plains|-78.87|38.45
Staunton|hills|-79.07|38.15
Charlottesville|plains|-78.48|38.03
Lynchburg|city|-79.14|37.41
Richmond|city|-77.44|37.54
Petersburg|city|-77.40|37.23
Yorktown|coast|-76.51|37.24
Norfolk|coast|-76.29|36.85
Danville|plains|-79.40|36.59
Eastern Shore|coast|-75.66|37.71
''', era='Eastern Theater · 1861–1865', source=['Library of Congress Civil War Maps','https://www.loc.gov/collections/civil-war-maps/about-this-collection/'], capital='Washington', sea_routes=[('Eastern Shore','Norfolk')]),
region('greco_persian', 'Greece, Persia & Egypt', 'historical', [19,22,64,42.5], 'GRC TUR ALB MKD BGR CYP CYN SYR LBN ISR PSX JOR IRQ IRN EGY ARM AZE',
       'An ancient-war composite from Greece across Anatolia and Mesopotamia to the Persian heartland, with Phoenician ports, Cyprus and the Nile. Historical places anchor 30 gameplay sectors; control does not represent one date or a single empire.', '''
Macedonia|plains|22.52|40.75
Thessaly|plains|22.42|39.64
Athens|city|23.73|37.98
Sparta|city|22.43|37.07
Crete|hills|25.16|35.29
Thrace|plains|26.3|41.3
Ionia|coast|27.34|37.94
Lydia|city|28.04|38.49
Phrygia|plains|30.53|38.76
Cappadocia|hills|35.49|38.73
Cilicia|coast|35.33|37.00
Rhodes|coast|28.10|36.20
Cyprus|coast|33.2|35.0
Phoenicia|city|35.20|33.27
Damascus|city|36.30|33.51
Nile Delta|plains|31.0|30.8
Memphis|city|31.25|29.85
Thebes|city|32.65|25.72
Sinai|desert|33.8|29.1
Upper Mesopotamia|plains|39.03|37.16
Assyria|plains|43.15|36.36
Babylon|city|44.42|32.54
Armenia|hills|43.3|39.5
Susa|city|48.25|32.19
Media|hills|48.52|34.80
Persepolis|city|52.89|29.93
Parthia|plains|58.50|36.10
Hyrcania|forest|54.44|36.84
Carmania|desert|57.07|30.28
Drangiana|desert|61.50|31.03
''', era='Composite · Greek–Persian conflicts, 499–330 BC',
       source=['The Metropolitan Museum of Art: The Achaemenid Persian Empire','https://www.metmuseum.org/essays/the-achaemenid-persian-empire-550-330-b-c'],
       capital='Athens',
       sea_routes=[('Athens','Ionia'),('Athens','Crete'),('Crete','Rhodes'),('Rhodes','Ionia'),
                   ('Rhodes','Cyprus'),('Cyprus','Cilicia'),('Cyprus','Phoenicia'),('Crete','Nile Delta')]),
region('viking_conquests', 'Viking World · Northern Europe', 'historical', [-25,47.5,34,71.5], 'GBR IRL IMN NOR SWE FIN DNK ISL FRO FRA BEL NLD DEU EST LVA LTU RUS',
       'A 30-region composite linking the Nordic homelands with Iceland, Britain, Ireland, Frankish river approaches and the Baltic routes to Ladoga and Novgorod. Raiding, settlement and trading contacts across 793–1066; not a single Viking empire.', '''
Iceland|hills|-18.6|64.8
Faroe Islands|coast|-6.85|62.1
Orkney|coast|-3.04|58.98
Hebrides|coast|-6.55|58.20
Halogaland|hills|16.5|68.8
Trondelag|hills|10.4|63.43
Vestland|coast|5.33|60.39
Viken|city|10.41|59.27
Jutland|plains|9.42|55.76
Hedeby|city|9.57|54.49
Zealand|city|12.08|55.64
Scania|plains|13.19|55.70
Gotland|coast|18.45|57.50
Birka|city|17.54|59.34
Finland|forest|24.0|62.0
Ladoga|city|32.30|60.00
Novgorod|city|31.28|58.52
Baltic Coast|forest|24.1|56.95
Estonia|coast|24.75|59.44
Northumbria|city|-1.08|53.96
Mercia|plains|-1.15|52.95
Wessex|city|-1.32|51.06
Scotland|hills|-4.22|57.48
Dublin|city|-6.26|53.35
Munster|coast|-8.47|51.90
Normandy|coast|1.10|49.44
Brittany|coast|-3.0|48.2
Paris|city|2.35|48.86
Frisia|coast|5.45|53.0
Rhineland|city|6.96|50.94
''', era='Composite · North Atlantic, Nordic and Baltic routes, 793–1066',
       source=['National Museum of Denmark: The Viking Age','https://en.natmus.dk/historical-knowledge/denmark/prehistoric-period-until-1050-ad/the-Viking-age/'],
       capital='Viken',
       province_ids={
           'DEU':['DEU-1579','DEU-1576','DEU-1572','DEU-1575','DEU-1578','DEU-3488'],
           'RUS':['RUS-2335','RUS-2336','RUS-2337','RUS-2334','RUS-2353'],
           'FRA':['FRA-5330','FRA-5263','FRA-5327','FRA-5292','FRA-5283','FRA-5308','FRA-5322','FRA-5275','FRA-5290','FRA-5343','FRA-5345','FRA-5334','FRA-5333','FRA-5306','FRA-5344','FRA-5349','FRA-5357','FRA-5331','FRA-5332','FRA-5289','FRA-5342','FRA-5350'],
       },
       sea_routes=[('Iceland','Faroe Islands'),('Faroe Islands','Vestland'),('Faroe Islands','Orkney'),
                   ('Vestland','Orkney'),('Orkney','Scotland'),('Hebrides','Dublin'),('Dublin','Mercia'),
                   ('Jutland','Northumbria'),('Jutland','Frisia'),('Zealand','Scania'),('Hedeby','Zealand'),
                   ('Scania','Gotland'),('Gotland','Birka'),('Gotland','Baltic Coast'),('Birka','Finland'),
                   ('Finland','Estonia'),('Wessex','Normandy')]),
region('norman_england_1066', 'Norman England · 1066', 'historical', [-5.8,49.8,2,55.9], 'GBR',
       'England in the year of the Norman invasion: Sussex landing grounds, London, the shires and the road north to York. Balanced conquest starts, not a reconstruction of army deployments.', '''
Bamburgh|coast|-1.72|55.61
Durham|hills|-1.58|54.78
Carlisle|hills|-2.94|54.89
York|city|-1.08|53.96
Lancaster|coast|-2.80|54.05
Chester|city|-2.89|53.19
Lincoln|city|-0.54|53.23
Nottingham|forest|-1.15|52.95
Stafford|plains|-2.12|52.81
Shrewsbury|hills|-2.75|52.71
Hereford|hills|-2.72|52.06
Worcester|plains|-2.22|52.19
Leicester|plains|-1.13|52.64
Northampton|plains|-0.90|52.24
Norwich|city|1.30|52.63
Ipswich|coast|1.15|52.06
Cambridge|plains|0.12|52.20
Colchester|city|0.90|51.89
London|city|-0.13|51.51
Oxford|plains|-1.26|51.75
Gloucester|city|-2.24|51.87
Bath|hills|-2.36|51.38
Winchester|city|-1.32|51.06
Canterbury|city|1.08|51.28
Hastings|coast|0.57|50.86
Dorchester|plains|-2.44|50.71
Exeter|city|-3.53|50.72
Cornwall|coast|-4.76|50.45
''', era='England · 1066', source=['English Heritage: Battle of Hastings and the Norman Conquest','https://www.english-heritage.org.uk/visit/places/1066-battle-of-hastings-abbey-and-battlefield/history-and-stories/history/'], capital='Hastings', geounits=['England']),
]
for spec in MAPS:
    spec['historical_sectors'] = True
