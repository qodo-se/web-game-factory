"""Authored geographic relief, rivers and water labels for Regional Maps."""

WATERS = {'mediterranean': [('Mediterranean Sea', 17, 34), ('Black Sea', 34, 44)],
 'europe': [('North Sea', 3, 57), ('Baltic Sea', 19, 58), ('Mediterranean Sea', 13, 36)],
 'americas': [('Pacific Ocean', -120, -8), ('Atlantic Ocean', -38, 17), ('Caribbean Sea', -76, 15)],
 'africa_middle_east': [('Atlantic Ocean', -10, -17), ('Indian Ocean', 48, -18), ('Red Sea', 37, 21)],
 'central_asia': [('Caspian Sea', 51, 41), ('Lake Baikal', 108, 53)],
 'balochistan_borderlands_expanded': [('Arabian Sea', 65, 23.5)],
 'india': [('Arabian Sea', 65, 14), ('Bay of Bengal', 89, 15)],
 'southeast_asia_oceania': [('Indian Ocean', 105, -24), ('Pacific Ocean', 160, 1), ('Tasman Sea', 161, -38)],
 'japan_korea': [('Sea of Japan', 135, 40), ('Pacific Ocean', 141, 32), ('Korea Strait', 130, 34)],
 'british_irish_isles': [('Irish Sea', -5, 53.7), ('North Sea', 0.8, 56.8), ('Atlantic Ocean', -9, 57)],
 'anatolia_caucasus': [('Black Sea', 33, 43), ('Caspian Sea', 50, 41.8), ('Mediterranean', 31, 35.5)],
 'nile_horn': [('Red Sea', 39, 21), ('Gulf of Aden', 47, 13), ('Indian Ocean', 49, 0)]}

RIDGES = {'mediterranean': [[(-5, 32), (0, 34), (8, 35)],
                   [(6, 45), (10, 47), (15, 46)],
                   [(30, 37), (36, 38), (42, 39)]],
 'europe': [[(6, 45), (9, 47), (13, 47), (16, 46)],
            [(7, 60), (12, 65), (18, 69)],
            [(21, 47), (24, 49), (26, 46)]],
 'americas': [[(-140, 61), (-123, 51), (-112, 41), (-105, 30)],
              [(-75, 9), (-78, -2), (-72, -14), (-69, -30), (-72, -49)]],
 'africa_middle_east': [[(-8, 31), (-1, 34), (8, 35)],
                        [(37, 13), (39, 9), (37, 5)],
                        [(43, 38), (48, 33), (54, 29)]],
 'central_asia': [[(67, 35), (71, 37), (75, 39), (81, 42)],
                  [(85, 47), (93, 49), (101, 50)],
                  [(77, 32), (87, 29), (96, 29)]],
 'balochistan_borderlands_expanded': [[(67, 34), (69, 35), (71, 36), (73, 37)],
                                      [(62, 28), (66, 29), (67, 31)]],
 'india': [[(73, 34), (78, 31), (84, 28), (90, 27), (95, 28)], [(73, 20), (74, 16), (76, 11)]],
 'southeast_asia_oceania': [[(99, 19), (101, 15), (103, 10)],
                            [(130, -12), (137, -22), (144, -31)],
                            [(145, -5), (149, -7)],
                            [(171, -43), (174, -40)]],
 'japan_korea': [[(137, 35), (138, 37), (140, 40)], [(127, 36), (128, 38), (129, 41)]],
 'british_irish_isles': [[(-5.3, 56.5), (-4.4, 57.2), (-4.2, 58.1)],
                         [(-2.5, 53.3), (-2.2, 54.7)],
                         [(-4, 52.5), (-3.8, 53.1)]],
 'anatolia_caucasus': [[(29, 37), (34, 38), (40, 39), (43, 40)], [(41, 42), (44, 43), (48, 42)]],
 'nile_horn': [[(36.5, 13), (38, 11), (39.5, 8), (38, 6)], [(34, 27), (36, 23), (37, 19)]]}

RIVERS = {'japan_korea': [('Shinano', [(138.4, 36.1), (138.1, 36.7), (138.7, 37.2), (139.05, 37.9)]),
                 ('Han', [(128.5, 37.2), (127.6, 37.4), (127, 37.55), (126.6, 37.75)])],
 'british_irish_isles': [('Thames', [(-2.1, 51.7), (-1.2, 51.75), (-0.6, 51.5), (0.1, 51.5), (1, 51.5)]),
                         ('Severn', [(-3.7, 52.5), (-2.7, 52.7), (-2.2, 52.1), (-2.4, 51.6)]),
                         ('Shannon', [(-8, 54), (-7.9, 53.4), (-8.1, 52.8), (-9, 52.6)])]}

def annotations(key, atlas):
    west, south, east, north = atlas['bounds']
    return [dict(kind='ridge', points=[[(x-west)/(east-west), (north-y)/(north-south)] for x,y in ridge])
            for ridge in RIDGES.get(key, [])]

# Context for the expanded Northeast Asia theater.
WATERS['japan_korea'] = [('Sea of Japan',136,40),('Sea of Okhotsk',150,54),('Pacific Ocean',154,35)]
RIDGES['japan_korea'] += [[(124,49),(127,47),(130,43)],[(133,44),(136,47),(138,50)],[(157,51),(159,54),(161,57)]]
RIVERS['japan_korea'] += [('Amur',[(123,53),(126,52),(128,50),(130,48),(135,49),(137,51),(140,53)])]

# Historical theaters use the same illustrative relief layer as regional maps.
WATERS.update({
 'crusader_levant': [('Mediterranean Sea',34.6,34.6)],
 'civil_war_eastern_theater': [('Chesapeake Bay',-76.2,38.3),('Atlantic Ocean',-75.2,37.1)],
 'greco_persian': [('Aegean Sea',24.7,38.3),('Ionian Sea',20.4,37.3),('Sea of Marmara',28.2,40.6)],
 'viking_conquests': [('Irish Sea',-5.2,53.5),('North Sea',1.2,55.5),('Atlantic Ocean',-9.8,56)],
 'napoleon_1805': [('Lake Constance',9.4,47.6)],
 'norman_england_1066': [('North Sea',1.3,54),('English Channel',-1.5,50.1),('Irish Sea',-4.5,54.5)],
})
RIDGES.update({
 'crusader_levant': [[(36.1,35.8),(36.1,35),(35.9,34.3),(35.7,33.7)],[(36.6,34),(36.3,33.6),(35.9,33.1)],[(35.2,32.2),(35.1,31.7),(35,31.2)]],
 'civil_war_eastern_theater': [[(-77.4,39.7),(-78.2,38.8),(-78.8,38.1),(-79.7,37.1)], [(-78.5,40.6),(-79,39.7),(-79.6,38.5),(-80.4,37.6)]],
 'greco_persian': [[(20.8,40.1),(21.3,39.5),(21.6,38.8)],[(22.2,37.9),(22.3,37.4),(22.4,36.8)],[(27.8,38.3),(28.4,38.4),(29.1,38.1)]],
 'viking_conquests': RIDGES['british_irish_isles'],
 'napoleon_1805': [[(8.6,46.5),(10,47),(11.4,47.2),(12.7,47.2),(14.3,47.4),(15.7,47.6)],[(12.8,49.3),(13.3,49.1),(13.8,48.8)],[(8.2,48.5),(8.3,48.1),(8.1,47.8)]],
 'norman_england_1066': [[(-2.2,54.8),(-2.2,54.2),(-1.9,53.6),(-1.8,53.1)],[(-3.3,54.6),(-3.1,54.4)],[(-4,50.6),(-3.8,50.5)]],
})
RIVERS.update({
 'crusader_levant': [('Jordan',[(35.65,33.2),(35.62,32.9),(35.56,32.7),(35.57,32.2),(35.55,31.8)]),('Orontes',[(36.4,34.1),(36.7,34.7),(36.75,35.1),(36.35,35.9),(36.16,36.2),(35.97,36.04)])],
 'civil_war_eastern_theater': [('Potomac',[(-79.45,39.2),(-78.75,39.6),(-77.75,39.33),(-77.1,38.9),(-77,38.4),(-76.25,38)]),('James',[(-79.8,37.7),(-79.15,37.4),(-78.4,37.6),(-77.45,37.5),(-76.6,37.1),(-76.3,36.95)]),('Rappahannock',[(-78.15,38.6),(-77.46,38.3),(-76.7,37.9),(-76.3,37.6)])],
 'viking_conquests': RIVERS['british_irish_isles'],
 'norman_england_1066': RIVERS['british_irish_isles'][:2],
})
RIVERS['greco_persian'] = [
 ('Peneios',[(21.5,39.7),(22,39.55),(22.45,39.65),(22.63,39.88),(22.72,39.94)]),
 ('Strymon',[(23.35,41.4),(23.4,41.1),(23.7,40.9),(23.85,40.78)]),
 ('Hermus',[(29.2,38.9),(28.7,38.7),(28,38.55),(27.4,38.6),(26.9,38.6)]),
 ('Maeander',[(29.1,38),(28.8,37.8),(28.1,37.75),(27.5,37.6),(27.2,37.55)]),
]

WATERS['viking_conquests'] = [('North Atlantic',-15,58),('Norwegian Sea',0,66),('North Sea',3,56.5),('Baltic Sea',19,56.8),('Gulf of Bothnia',20,63)]
RIDGES['viking_conquests'] = RIDGES['british_irish_isles'] + [[(6,59),(8,62),(12,65),(17,68),(22,69)], [(-21,64),(-19,65),(-16,65)]]
RIVERS['viking_conquests'] = RIVERS['british_irish_isles'] + [('Seine',[(3,48.5),(2.35,48.86),(1.5,49.1),(1.1,49.44),(0.3,49.45)]),('Volkhov',[(31.28,58.52),(31.5,59.1),(32.3,60.0),(32.33,60.13)])]

# Expanded Greek–Persian composite: eastern Mediterranean, Nile and Iranian plateau.
WATERS['greco_persian'] = [('Aegean Sea',25,38),('Mediterranean Sea',28,33),('Black Sea',33,42),('Caspian Sea',51,39),('Persian Gulf',51,27),('Red Sea',35,25)]
RIDGES['greco_persian'] += [[(29,36.8),(32,37.3),(35,37.7),(38,38.2)],[(44,37),(46,35),(49,32),(52,29),(55,27)],[(48.5,37.5),(51,36.5),(54.5,36.6)],[(42,40),(44,40.2),(46,39.7)]]
RIVERS['greco_persian'] += [
 ('Nile',[(32.9,24.1),(32.65,25.72),(32.7,26.2),(31.5,27.2),(30.75,28.1),(31.25,29.85),(31.1,30.2),(30.4,31.4)]),
 ('Euphrates',[(39,39.5),(38.5,38.5),(37.9,37),(38,36),(39,35.9),(40.4,35.3),(41.5,34.5),(43.3,33.4),(44.4,32.5),(45.4,31.3),(47.4,31)]),
 ('Tigris',[(39.8,38.2),(41.2,37.8),(42.2,37.2),(43.15,36.36),(43.5,35),(44.4,33.3),(45.8,32.5),(47.4,31)]),
]
