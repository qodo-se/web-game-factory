"""
Eastern Europe — 36 regions
Player 1 (west): Krakow    Player 2 (east): Moscow
Spans Germany/Poland → Urals, Baltic → Black Sea.
"""

# (name, terrain, x, y)
_REGIONS = [
    # Western fringe
    ("Prussia",         "plains", 0.05, 0.22),  # 0
    ("Pomerania",       "coast",  0.12, 0.15),  # 1
    ("Saxony",          "plains", 0.08, 0.38),  # 2
    ("Bohemia",         "hills",  0.12, 0.50),  # 3
    ("Silesia",         "plains", 0.16, 0.42),  # 4
    # Poland
    ("Krakow",          "city",   0.22, 0.52),  # 5  P1 capital
    ("Mazovia",         "plains", 0.24, 0.38),  # 6
    ("Greater Poland",  "plains", 0.16, 0.32),  # 7
    # Baltic states
    ("Latvia",          "coast",  0.28, 0.12),  # 8
    ("Lithuania",       "forest", 0.32, 0.22),  # 9
    ("Estonia",         "coast",  0.30, 0.05),  # 10
    # Hungary & Balkans
    ("Hungary",         "plains", 0.20, 0.62),  # 11
    ("Transylvania",    "hills",  0.28, 0.68),  # 12
    ("Wallachia",       "plains", 0.35, 0.75),  # 13
    ("Moldavia",        "plains", 0.38, 0.65),  # 14
    ("Bulgaria",        "plains", 0.38, 0.82),  # 15
    # Belarus / Western Russia
    ("Minsk",           "forest", 0.40, 0.28),  # 16
    ("Smolensk",        "forest", 0.48, 0.32),  # 17
    ("Galicia",         "hills",  0.32, 0.50),  # 18
    ("Volhynia",        "forest", 0.38, 0.45),  # 19
    ("Podolia",         "plains", 0.40, 0.58),  # 20
    # Ukraine
    ("Kiev",            "city",   0.48, 0.52),  # 21
    ("Poltava",         "plains", 0.55, 0.62),  # 22
    ("Crimea",          "coast",  0.52, 0.80),  # 23
    ("Don Steppe",      "plains", 0.62, 0.72),  # 24
    # Russia
    ("Novgorod",        "city",   0.52, 0.12),  # 25
    ("Pskov",           "forest", 0.44, 0.15),  # 26
    ("Tver",            "forest", 0.58, 0.22),  # 27
    ("Moscow",          "city",   0.62, 0.32),  # 28  P2 capital
    ("Vladimir",        "forest", 0.68, 0.28),  # 29
    ("Ryazan",          "plains", 0.68, 0.42),  # 30
    ("Nizhny Novgorod", "forest", 0.75, 0.30),  # 31
    ("Kazan",           "plains", 0.82, 0.32),  # 32
    ("Volga",           "plains", 0.80, 0.52),  # 33
    ("Saratov",         "plains", 0.82, 0.65),  # 34
    ("Astrakhan",       "coast",  0.82, 0.82),  # 35
]

PRESET = {
    "id": "eastern_europe",
    "name": "Eastern Europe",
    "description": (
        "From the German border to the Ural foothills, the Baltic to the Black Sea. "
        "Poland and Russia vie for dominance of the eastern plains."
    ),
    "regions": _REGIONS,
    "player1_capital": 5,            # Krakow
    "player2_capital": 28,           # Moscow
    "player1_extra_starts": [6, 18], # Mazovia, Galicia
    "player2_extra_starts": [17, 29], # Smolensk, Vladimir
    "max_edge_distance": 0.22,
    "extra_edges": [],
    "removed_edges": [],
}
