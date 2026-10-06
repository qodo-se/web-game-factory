"""Regional map specifications using Natural Earth geographic anchors."""

def sites(text):
    return [(name,terrain,float(lon),float(lat)) for row in text.strip().split('\n')
            for name,terrain,lon,lat in [row.strip().split('|')]]

def region(key,name,category,bounds,countries,description,anchors,**extra):
    return dict(id=key,name=name,category=category,kind='regional',bounds=bounds,
                countries=countries.split(),description=description,sites=sites(anchors),**extra)

MAPS = [
region('japan_korea','Northeast Asia','world',[118,24,175,67],'JPN KOR PRK CHN RUS',
       'Japan, Korea, Manchuria and the Russian Pacific frontier, from the Amur basin to Sakhalin, the Kurils and Kamchatka.', '''
Hokkaido|forest|142.0|43.5
Tohoku|city|140.87|38.26
Hokuriku|coast|136.65|36.56
Kanto|city|139.70|35.68
Chubu|hills|138.18|36.65
Kansai|city|135.50|34.69
Chugoku|hills|132.46|34.39
Shikoku|forest|133.55|33.56
Northern Kyushu|city|130.40|33.59
Southern Kyushu|coast|130.56|31.59
Pyongyang|city|125.75|39.03
Hamhung|hills|127.53|39.91
Seoul|city|126.98|37.57
Jeolla|plains|127.14|35.82
Gyeongsang|coast|129.07|35.18
Dalian|coast|121.62|38.92
Shenyang|city|123.43|41.80
Changchun|plains|125.32|43.82
Yanbian|forest|129.51|42.90
Harbin|city|126.64|45.76
Qiqihar|plains|123.96|47.35
Jiamusi|forest|130.37|46.80
Amur|forest|127.53|50.29
Primorye|city|131.89|43.12
Khabarovsk|city|135.07|48.48
Okhotsk|coast|143.21|59.36
Magadan|hills|150.80|59.56
Sakhalin|forest|142.73|50.40
Kuril Islands|hills|147.88|45.25
Kamchatka|hills|158.65|53.02
''',
       anchor_countries=['JPN']*10+['PRK']*2+['KOR']*3+['CHN']*7+['RUS']*8,
       province_ids={'CHN':['CHN-1839','CHN-1828','CHN-1813'],
                     'RUS':['RUS-2609','RUS-2613','RUS-2614','RUS-2611','RUS-2615','RUS-2616','RUS-3468']},
       source=['Natural Earth admin-1 boundaries','https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/']),
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
]
