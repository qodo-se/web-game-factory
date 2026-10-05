"""Authored cartographic context, not additional game mechanics.

Coordinates are geographic except original Emberfall. Relief spines and historical
landmarks are schematic interpretations; source links remain in each map briefing.
"""
WATERS = {
 'mediterranean':[('Mediterranean Sea',17,34),('Black Sea',34,44)],
 'europe':[('North Sea',3,57),('Baltic Sea',19,58),('Mediterranean Sea',13,36)],
 'americas':[('Pacific Ocean',-120,-8),('Atlantic Ocean',-38,17),('Caribbean Sea',-76,15)],
 'africa_middle_east':[('Atlantic Ocean',-10,-17),('Indian Ocean',48,-18),('Red Sea',37,21)],
 'central_asia':[('Caspian Sea',51,41),('Lake Baikal',108,53)],
 'balochistan_borderlands_expanded':[('Arabian Sea',65,23.5)],
 'india':[('Arabian Sea',65,14),('Bay of Bengal',89,15)],
 'southeast_asia_oceania':[('Indian Ocean',105,-24),('Pacific Ocean',160,1),('Tasman Sea',161,-38)],
 'japan_korea':[('Sea of Japan',135,40),('Pacific Ocean',141,32),('Korea Strait',130,34)],
 'british_irish_isles':[('Irish Sea',-5,53.7),('North Sea',.8,56.8),('Atlantic Ocean',-9,57)],
 'anatolia_caucasus':[('Black Sea',33,43),('Caspian Sea',50,41.8),('Mediterranean',31,35.5)],
 'nile_horn':[('Red Sea',39,21),('Gulf of Aden',47,13),('Indian Ocean',49,0)],
 'andes_pacific':[('Pacific Ocean',-80,-25)],
 'caribbean_central_america':[('Caribbean Sea',-77,15),('Atlantic Ocean',-66,25)],
 'crusader_states':[('Mediterranean Sea',33,34)],
 'civil_war_east':[('Chesapeake Bay',-76.1,37.7),('Atlantic Ocean',-74.8,36.8)],
 'rome_carthage':[('Mediterranean Sea',5,37),('Tyrrhenian Sea',11,40)],
 'sengoku_japan':[('Sea of Japan',135,38),('Pacific Ocean',140,33)],
 'epic_lanka':[('Gulf of Mannar',79.6,8.7),('Indian Ocean',82,7)],
 'constantinople':[('Golden Horn',28.962,41.036),('Bosphorus',29.006,41.039)],
 'malta':[('Mediterranean Sea',14.25,35.9),('Grand Harbour',14.531,35.895)],
 'troy_troad':[('Aegean Sea',26.19,39.988)],
}
# Sparse ridge spines keep regional terrain legible without mountains everywhere.
RIDGES = {
 'mediterranean':[[(-5,32),(0,34),(8,35)],[(6,45),(10,47),(15,46)],[(30,37),(36,38),(42,39)]],
 'europe':[[(6,45),(9,47),(13,47),(16,46)],[(7,60),(12,65),(18,69)],[(21,47),(24,49),(26,46)]],
 'americas':[[(-140,61),(-123,51),(-112,41),(-105,30)],[(-75,9),(-78,-2),(-72,-14),(-69,-30),(-72,-49)]],
 'africa_middle_east':[[(-8,31),(-1,34),(8,35)],[(37,13),(39,9),(37,5)],[(43,38),(48,33),(54,29)]],
 'central_asia':[[(67,35),(71,37),(75,39),(81,42)],[(85,47),(93,49),(101,50)],[(77,32),(87,29),(96,29)]],
 'balochistan_borderlands_expanded':[[(67,34),(69,35),(71,36),(73,37)],[(62,28),(66,29),(67,31)]],
 'india':[[(73,34),(78,31),(84,28),(90,27),(95,28)],[(73,20),(74,16),(76,11)]],
 'southeast_asia_oceania':[[(99,19),(101,15),(103,10)],[(130,-12),(137,-22),(144,-31)],[(145,-5),(149,-7)],[(171,-43),(174,-40)]],
 'japan_korea':[[(137,35),(138,37),(140,40)],[(127,36),(128,38),(129,41)]],
 'british_irish_isles':[[(-5.3,56.5),(-4.4,57.2),(-4.2,58.1)],[(-2.5,53.3),(-2.2,54.7)],[(-4,52.5),(-3.8,53.1)]],
 'anatolia_caucasus':[[(29,37),(34,38),(40,39),(43,40)],[(41,42),(44,43),(48,42)]],
 'nile_horn':[[(36.5,13),(38,11),(39.5,8),(38,6)],[(34,27),(36,23),(37,19)]],
 'andes_pacific':[[(-74,9),(-77,3),(-78,-3),(-75,-10),(-71,-17),(-69,-29),(-71,-42),(-72,-51)]],
 'crusader_states':[[(36.2,35.5),(35.9,34.5),(35.8,33.5)]],
 'civil_war_east':[[(-79.5,40),(-78.6,39),(-79.2,38),(-80,37)]],
 'rome_carthage':[[(6,45),(9,46),(12,46)],[(10,44),(13,42),(16,39)],[(0,43),(3,42)]],
 'sengoku_japan':[[(137,35),(138,36.5),(140,39)]],
 'epic_lanka':[[(80.55,7.7),(80.8,7.2),(80.75,6.8),(80.55,6.6)]],
}
RIVERS = {
 'japan_korea':[('Shinano',[(138.4,36.1),(138.1,36.7),(138.7,37.2),(139.05,37.9)]),('Han',[(128.5,37.2),(127.6,37.4),(127,37.55),(126.6,37.75)])],
 'british_irish_isles':[('Thames',[(-2.1,51.7),(-1.2,51.75),(-.6,51.5),(.1,51.5),(1,51.5)]),('Severn',[(-3.7,52.5),(-2.7,52.7),(-2.2,52.1),(-2.4,51.6)]),('Shannon',[(-8,54),(-7.9,53.4),(-8.1,52.8),(-9,52.6)])],
 'sengoku_japan':[('Shinano',[(138.4,36.1),(138.1,36.7),(138.7,37.2),(139.05,37.9)]),('Kiso',[(137.7,36),(137.5,35.5),(136.7,35)])],
 'epic_lanka':[('Mahaweli (setting)',[(80.65,6.95),(80.6,7.3),(81,7.7),(81.2,8.4)])],
}
# Explicit sector allegiance and force weights, authored as playable abstractions
# of opening fronts. No claim that one counter represents an exact soldier count.
DEPLOYMENTS = {
 'panipat_1526':([0]*12+[1]*12,[25,40,65,25,45,45,45,45,55,70,70,55,40,55,60,55,65,75,90,65,35,40,65,35]),
 'austerlitz_1805':([0]*12+[1]*12,[30,55,35,85,40,60,45,30,40,40,55,70,40,50,60,70,55,80,30,35,40,65,40,70]),
 'antietam_1862':([1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0],[45,50,45,85,50,60,60,55,40,35,75,50,75,35,65,60,45,45,35,35,40,40,65,30]),
 'cannae_216':([0]*12+[1]*12,[25,30,25,25,30,70,35,30,90,75,35,90,40,65,80,65,40,45,90,40,30,45,60,30]),
 'naseby_1645':([0]*12+[1]*12,[25,40,80,25,70,65,65,75,30,30,35,30,55,85,75,85,40,40,85,40,25,30,30,25]),
}


def local_landscape(key, base, bounds):
    """Reference-led feature placement, with exact survey claims deliberately avoided."""
    import copy, math
    import numpy as np
    from shapely.geometry import Polygon, box
    from scipy.interpolate import splprep, splev
    out=copy.deepcopy(base)
    # Round broad reconstructions and add restrained edge detail instead of blobs.
    woods=[]
    for ring in out['woods']:
        poly=Polygon(ring).buffer(.007).buffer(-.007)
        if poly.is_empty:continue
        pts=np.asarray(poly.exterior.coords)
        sampled=[poly.exterior.interpolate(t,normalized=True).coords[0] for t in np.linspace(0,1,100)]
        center=poly.centroid
        textured=[]
        for i,(x,y) in enumerate(sampled):
            factor=1+.025*math.sin(i*2.1)+.018*math.sin(i*.71)
            textured.append((center.x+(x-center.x)*factor,center.y+(y-center.y)*factor))
        p=Polygon(textured).buffer(0).intersection(box(0,0,1,1))
        if p.geom_type=='Polygon':woods.append(list(p.exterior.coords))
    out['woods']=woods
    west,south,east,north=bounds
    norm=lambda pts:[((x-west)/(east-west),(north-y)/(north-south)) for x,y in pts]
    if key=='antietam_1862':
        # Anchor all three crossings to the named locations; intermediate bends
        # follow the NPS battlefield map at gameplay scale, not a hydrology survey.
        creek=[(-77.715,39.507),(-77.719,39.495),(-77.720,39.490),(-77.725,39.486),(-77.720,39.479),(-77.724,39.471),(-77.721,39.464),(-77.729,39.458),(-77.732,39.450),(-77.728,39.445),(-77.733,39.438),(-77.731,39.429),(-77.739,39.425)]
        out['streams']=[('Antietam Creek · NPS map interpretation',norm(creek))]
    elif key=='austerlitz_1805':
        out['streams']=[('Goldbach · interpreted',norm([(16.735,49.23),(16.742,49.204),(16.733,49.185),(16.728,49.169),(16.733,49.154),(16.733,49.141),(16.744,49.129),(16.754,49.116),(16.755,49.10)]))]
    elif key=='cannae_216':
        out['streams']=[('Aufidus · interpreted ancient course',[(0,.15),(.09,.18),(.19,.22),(.28,.19),(.36,.14),(.47,.15),(.57,.21),(.68,.24),(.78,.20),(.89,.14),(1,.12)])]
    elif key=='kurukshetra':
        out['streams']=[('Saraswati · literary memory',[(0,.08),(.14,.10),(.29,.09),(.40,.12),(.57,.08),(.7,.11),(.85,.08),(1,.13)])]
        out['woods']=[[(.02,.21),(.13,.17),(.18,.25),(.14,.40),(.20,.55),(.13,.64),(.03,.61)],[(.83,.28),(.91,.21),(1,.24),(1,.59),(.89,.64),(.83,.51)],[(.66,.81),(.83,.77),(.94,.85),(.96,.98),(.78,.99),(.70,.90)]]
    elif key=='naseby_1645':
        out['woods']=[[(.03,.35),(.10,.34),(.13,.43),(.12,.54),(.08,.66),(.03,.63)]]
        out['paths']=[[(.15,0),(.24,.20),(.39,.42),(.46,.66),(.41,.88),(.44,1)],[(.44,.87),(.25,.90),(0,.91)]]
    # Camp grids and historic frontages get authored approaches, not settlement MSTs.
    if key=='panipat_1526':out['paths']=[[(.11,0),(.14,.22),(.15,.48),(.12,.68),(.17,1)],[(.15,.48),(.34,.46),(.64,.46),(.85,.50)]]
    if key=='chittorgarh':out['paths']=[norm([(74.647,24.897),(74.650,24.889),(74.655,24.888),(74.660,24.890),(74.663,24.888),(74.666,24.891),(74.672,24.893),(74.674,24.888),(74.678,24.881)])]
    return out


def annotations(key, atlas):
    west,south,east,north=atlas['bounds']
    norm=lambda pts:[[(x-west)/(east-west),(north-y)/(north-south)] for x,y in pts]
    result=[]
    for pts in RIDGES.get(key,[]):result.append(dict(kind='ridge',points=norm(pts)))
    positions={r['name']:r['center'] for r in atlas['regions']}
    def line(kind,names,title=''):
        pts=[positions[n] for n in names if n in positions]
        if len(pts)>1:result.append(dict(kind=kind,points=pts,name=title))
    def mark(kind,names):
        for name in names:
            if name in positions:result.append(dict(kind=kind,center=positions[name],name=name))
    if key=='waterloo':mark('farm',['Hougoumont','La Haye Sainte','La Belle Alliance']);line('ridge',['Western ridge','Central ridge','Eastern slope'])
    elif key=='sekigahara':line('ridge',['Mount Sasao','Central foothills','Northern foothills']);line('trail',['Western valley','Sekigahara village','Eastern woodland'])
    elif key=='hastings':line('ridge',['Western ridge','Harold’s ridge','Eastern ridge']);mark('banner',['Harold’s ridge','William’s reserve'])
    elif key=='hattin':mark('spring',['Hattin springs']);mark('peaks',['Horns of Hattin']);line('trail',['Crusader camp','Horns of Hattin','Tabgha approach'])
    elif key=='gettysburg':line('ridge',['Cemetery Hill','Cemetery Ridge','Little Round Top','Round Top']);mark('farm',['Meade’s headquarters','Peach Orchard'])
    elif key=='panipat_1526':line('wagons',['Western earthworks','Wagon line west','Wagon line east','Eastern ditch']);mark('banner',["Babur's reserve","Ibrahim's position"])
    elif key=='austerlitz_1805':line('ridge',['Pratzen village','Pratzen Heights','Stare Vinohrady']);mark('bridge',['Kobelnitz','Sokolnitz'])
    elif key=='antietam_1862':mark('bridge',['Upper bridge approach','Middle bridge approach','Burnside Bridge']);line('earthwork',['Roulette Farm','Sunken Road','Piper Farm']);mark('farm',['Dunker Church','Mumma Farm'])
    elif key=='cannae_216':line('front',['Carthaginian left','Carthaginian centre','Eastern plain']);line('front',['Roman left','Roman centre','Roman right']);mark('banner',["Hannibal's position",'Roman reserve'])
    elif key=='naseby_1645':line('hedge',['Western hedge','Sulby hedge approach']);line('ridge',['Dust Hill west','Dust Hill east']);line('ridge',['Naseby ridge','Parliamentary centre']);mark('banner',['Royalist reserve',"Fairfax's reserve"])
    elif key=='constantinople':
        result.append(dict(kind='wall',name='Land walls · interpreted',points=norm([(28.941,41.038),(28.936,41.030),(28.928,41.023),(28.925,41.014),(28.923,40.999)])))
        line('wall',['Golden Gate','Studion','Hippodrome','Acropolis','Northern quarter','Blachernae']);mark('gate',['Golden Gate','Mesoteichion','Blachernae'])
    elif key=='chittorgarh':
        result.append(dict(kind='wall',name='Fort perimeter · interpreted',points=norm([(74.672,24.902),(74.681,24.901),(74.688,24.890),(74.691,24.875),(74.683,24.865),(74.674,24.869),(74.668,24.881),(74.667,24.893),(74.672,24.902)])))
        mark('gate',['Padan Pol approach','Ram Pol','Southern gate approach']);mark('fort',['Rana Kumbha precinct','Padmini precinct'])
    elif key=='malta':mark('fort',['Fort St Elmo','Birgu','Senglea','Mdina']);mark('port',['Comino','Marsaxlokk'])
    elif key=='kurukshetra':
        mark('banner',['Kaurava Standard','Pandava Standard',"Bhishma's Camp","Yudhishthira's Camp"])
        line('front',['Chariot Ground West',"Drona's Field",'Field of Vows','Chariot Ground East']);line('front',['Pandava Left','Pandava Standard',"Yudhishthira's Camp",'Pandava Right'])
    elif key=='troy_troad':mark('fort',['Troy Citadel']);mark('gate',['Scaean Gate Approach']);mark('ships',['Ship Camp West','Ship Camp East','Achaean Landing']);line('wall',['Troy Citadel','Scaean Gate Approach'])
    elif key=='epic_lanka':mark('fort',["Ravana's Court",'Cloud Citadel']);mark('ships',['Northern Landing']);mark('grove',['Ashoka Grove','Elephant Forest'])
    elif key=='emberfall':
        result.extend([dict(kind='ridge',points=[[.49,.10],[.55,.23],[.59,.32],[.55,.41],[.56,.55],[.61,.67],[.70,.76]]),dict(kind='volcano',center=[.84,.34]),dict(kind='grove',center=[.29,.32]),dict(kind='grove',center=[.85,.79])])
    return result

# Named, connected defaults selected after the opening smoke playtests. These
# change only scenario setup, never recruitment/combat rules or custom starts.
START_GROUPS = {
 'crusader_states': (['Banias','Galilee','Jerusalem'],['Krak Highlands','Baalbek','Damascus']),
 'chittorgarh': (['Fort approach','Padan Pol approach','Rana Kumbha precinct'],['Northern town','North plateau','Lower town']),
}
