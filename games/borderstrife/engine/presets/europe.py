"""
Europe — 48 regions
Player 1 (west): Paris    Player 2 (east): Moscow
Spans Atlantic → Urals, Scandinavia → Mediterranean.
"""

# (name, terrain, x, y)
_REGIONS = [
    # Iberian Peninsula
    ("Lisbon",          "city",   0.04, 0.72),  # 0
    ("Castile",         "plains", 0.12, 0.65),  # 1
    ("Aragon",          "hills",  0.18, 0.58),  # 2
    ("Andalusia",       "plains", 0.10, 0.78),  # 3
    # France
    ("Paris",           "city",   0.25, 0.42),  # 4  P1 capital
    ("Brittany",        "coast",  0.14, 0.38),  # 5
    ("Normandy",        "plains", 0.20, 0.33),  # 6
    ("Burgundy",        "forest", 0.28, 0.50),  # 7
    ("Provence",        "coast",  0.32, 0.62),  # 8
    # British Isles
    ("England",         "plains", 0.18, 0.25),  # 9
    ("Scotland",        "hills",  0.17, 0.15),  # 10
    ("Ireland",         "forest", 0.08, 0.22),  # 11
    # Benelux & Rhine
    ("Flanders",        "plains", 0.30, 0.30),  # 12
    ("Rhine",           "plains", 0.36, 0.35),  # 13
    # Germany
    ("Bavaria",         "forest", 0.40, 0.48),  # 14
    ("Saxony",          "plains", 0.42, 0.35),  # 15
    ("Prussia",         "plains", 0.50, 0.28),  # 16
    # Scandinavia
    ("Denmark",         "coast",  0.40, 0.20),  # 17
    ("Sweden",          "forest", 0.48, 0.10),  # 18
    ("Norway",          "hills",  0.37, 0.08),  # 19
    ("Finland",         "forest", 0.58, 0.08),  # 20
    # Italy
    ("Lombardy",        "plains", 0.37, 0.55),  # 21
    ("Rome",            "city",   0.40, 0.68),  # 22
    ("Naples",          "coast",  0.44, 0.75),  # 23
    ("Sicily",          "coast",  0.44, 0.85),  # 24
    # Balkans
    ("Croatia",         "hills",  0.48, 0.58),  # 25
    ("Serbia",          "plains", 0.52, 0.65),  # 26
    ("Bulgaria",        "plains", 0.58, 0.65),  # 27
    ("Greece",          "coast",  0.55, 0.78),  # 28
    # Central Europe
    ("Bohemia",         "hills",  0.44, 0.42),  # 29
    ("Hungary",         "plains", 0.52, 0.52),  # 30
    ("Transylvania",    "hills",  0.57, 0.55),  # 31
    # Poland & Baltic
    ("Pomerania",       "coast",  0.48, 0.22),  # 32
    ("Mazovia",         "plains", 0.55, 0.30),  # 33
    ("Silesia",         "plains", 0.48, 0.38),  # 34
    ("Lithuania",       "forest", 0.60, 0.22),  # 35
    ("Latvia",          "coast",  0.62, 0.14),  # 36
    # Russia / Eastern Europe
    ("Novgorod",        "forest", 0.70, 0.10),  # 37
    ("Moscow",          "city",   0.72, 0.22),  # 38  P2 capital
    ("Smolensk",        "forest", 0.64, 0.28),  # 39
    ("Kiev",            "plains", 0.65, 0.42),  # 40
    ("Galicia",         "hills",  0.58, 0.45),  # 41
    ("Volga",           "plains", 0.82, 0.32),  # 42
    ("Don Steppe",      "plains", 0.76, 0.50),  # 43
    ("Crimea",          "coast",  0.70, 0.62),  # 44
    ("Wallachia",       "plains", 0.60, 0.58),  # 45
    ("Constantinople",  "city",   0.62, 0.75),  # 46
    ("Anatolia",        "hills",  0.70, 0.78),  # 47
]

PRESET = {
    "id": "europe",
    "name": "Europe",
    "description": (
        "From the Atlantic to the Urals, Scandinavia to the Mediterranean. "
        "Western Europe faces the Russian heartland."
    ),
    "regions": _REGIONS,
    "player1_capital": 4,            # Paris
    "player2_capital": 38,           # Moscow
    "player1_extra_starts": [6, 7],  # Normandy, Burgundy
    "player2_extra_starts": [39, 42], # Smolensk, Volga
    "max_edge_distance": 0.18,
    "extra_edges": [
        (9, 6),   # England — Normandy (Channel crossing)
        (9, 12),  # England — Flanders
        (11, 5),  # Ireland — Brittany
        (10, 9),  # Scotland — England
        (11, 9),  # Ireland — England
        (17, 16), # Denmark — Prussia
        (17, 18), # Denmark — Sweden
        (24, 23), # Sicily — Naples
    ],
    "removed_edges": [],
}
