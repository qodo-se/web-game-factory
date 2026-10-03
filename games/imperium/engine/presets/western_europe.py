"""
Western Europe — 36 regions
Player 1 (south): Rome    Player 2 (north): Jorvik (York)
Spans Iberia, France, British Isles, Low Countries, Italy, Scandinavia.
"""

# (name, terrain, x, y)
_REGIONS = [
    # Iberian Peninsula
    ("Lisbon",          "city",   0.06, 0.88),  # 0
    ("Castile",         "plains", 0.16, 0.80),  # 1
    ("Aragon",          "hills",  0.24, 0.72),  # 2
    ("Andalusia",       "coast",  0.12, 0.92),  # 3
    ("Navarre",         "hills",  0.22, 0.64),  # 4
    # France
    ("Paris",           "city",   0.34, 0.50),  # 5
    ("Brittany",        "coast",  0.20, 0.48),  # 6
    ("Normandy",        "coast",  0.28, 0.42),  # 7
    ("Aquitaine",       "plains", 0.26, 0.62),  # 8
    ("Burgundy",        "forest", 0.38, 0.58),  # 9
    ("Provence",        "coast",  0.40, 0.72),  # 10
    # British Isles
    ("Ireland",         "forest", 0.12, 0.30),  # 11
    ("Wales & Cornwall","hills",  0.20, 0.32),  # 12
    ("England",         "plains", 0.28, 0.25),  # 13
    ("Jorvik",          "city",   0.28, 0.15),  # 14  P2 capital
    ("Scotland",        "hills",  0.25, 0.05),  # 15
    # Low Countries & Rhine
    ("Flanders",        "plains", 0.38, 0.38),  # 16
    ("Holland",         "coast",  0.40, 0.30),  # 17
    ("Rhine",           "plains", 0.46, 0.40),  # 18
    # Scandinavia
    ("Denmark",         "coast",  0.46, 0.20),  # 19
    ("Norway",          "hills",  0.42, 0.08),  # 20
    ("Sweden",          "forest", 0.54, 0.10),  # 21
    # Germany & Alpine
    ("Bavaria",         "forest", 0.52, 0.48),  # 22
    ("Swabia",          "hills",  0.46, 0.54),  # 23
    ("Saxony",          "plains", 0.52, 0.34),  # 24
    # Italian Peninsula
    ("Lombardy",        "plains", 0.48, 0.62),  # 25
    ("Tuscany",         "hills",  0.46, 0.70),  # 26
    ("Rome",            "city",   0.48, 0.80),  # 27  P1 capital
    ("Naples",          "coast",  0.52, 0.88),  # 28
    ("Sicily",          "coast",  0.50, 0.96),  # 29
    # Adriatic / Balkans fringe
    ("Venice",          "coast",  0.54, 0.62),  # 30
    ("Croatia",         "hills",  0.58, 0.68),  # 31
    # Bohemia & Western Poland
    ("Bohemia",         "hills",  0.58, 0.44),  # 32
    ("Silesia",         "plains", 0.60, 0.34),  # 33
    ("Austria",         "hills",  0.56, 0.56),  # 34
    ("Pomerania",       "coast",  0.58, 0.22),  # 35
]

PRESET = {
    "id": "western_europe",
    "name": "Western Europe",
    "description": (
        "The kingdoms of the west: from Iberia and Italy in the south "
        "to the British Isles and Scandinavia in the north."
    ),
    "regions": _REGIONS,
    "player1_capital": 27,           # Rome
    "player2_capital": 14,           # Jorvik
    "player1_extra_starts": [26, 28], # Tuscany, Naples
    "player2_extra_starts": [13, 15], # England, Scotland
    "max_edge_distance": 0.20,
    "extra_edges": [
        (11, 6),  # Ireland — Brittany
        (11, 12), # Ireland — Wales
        (12, 13), # Wales — England
        (13, 16), # England — Flanders (Dover crossing)
        (13, 14), # England — Jorvik
        (14, 15), # Jorvik — Scotland
        (19, 17), # Denmark — Holland
        (19, 24), # Denmark — Saxony
        (29, 28), # Sicily — Naples
    ],
    "removed_edges": [],
}
