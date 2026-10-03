"""
Middle East — 36 regions
Player 1 (west): Alexandria    Player 2 (east): Ctesiphon
Spans Egypt → Persia, Anatolia → Arabia.
"""

# (name, terrain, x, y)
_REGIONS = [
    # Egypt & North Africa
    ("Alexandria",      "city",   0.05, 0.55),  # 0  P1 capital
    ("Nile Delta",      "plains", 0.08, 0.65),  # 1
    ("Upper Egypt",     "desert", 0.10, 0.78),  # 2
    ("Cyrenaica",       "desert", 0.05, 0.40),  # 3
    # Sinai & Levant
    ("Sinai",           "desert", 0.18, 0.62),  # 4
    ("Judea",           "hills",  0.22, 0.52),  # 5
    ("Phoenicia",       "coast",  0.22, 0.42),  # 6
    ("Syria",           "plains", 0.28, 0.38),  # 7
    # Anatolia
    ("Cilicia",         "coast",  0.30, 0.28),  # 8
    ("Cappadocia",      "hills",  0.35, 0.22),  # 9
    ("Lydia",           "coast",  0.22, 0.18),  # 10
    ("Pontus",          "hills",  0.40, 0.12),  # 11
    ("Constantinople",  "city",   0.18, 0.10),  # 12
    # Caucasus
    ("Armenia",         "hills",  0.48, 0.15),  # 13
    ("Georgia",         "hills",  0.52, 0.08),  # 14
    ("Azerbaijan",      "hills",  0.58, 0.15),  # 15
    # Mesopotamia / Iraq
    ("Antioch",         "city",   0.33, 0.32),  # 16
    ("Upper Mesopotamia","plains",0.40, 0.32),  # 17
    ("Ctesiphon",       "city",   0.52, 0.42),  # 18  P2 capital
    ("Babylonia",       "plains", 0.52, 0.52),  # 19
    ("Basra",           "coast",  0.56, 0.62),  # 20
    # Persia
    ("Media",           "hills",  0.60, 0.28),  # 21
    ("Khuzestan",       "plains", 0.62, 0.45),  # 22
    ("Fars",            "hills",  0.68, 0.55),  # 23
    ("Khorasan",        "plains", 0.75, 0.28),  # 24
    ("Sogdia",          "plains", 0.85, 0.20),  # 25
    # Arabia
    ("Hejaz",           "desert", 0.28, 0.72),  # 26
    ("Yemen",           "coast",  0.30, 0.90),  # 27
    ("Oman",            "coast",  0.48, 0.80),  # 28
    ("Najd",            "desert", 0.38, 0.80),  # 29
    ("Gulf Coast",      "coast",  0.52, 0.72),  # 30
    # Caspian & Central fringe
    ("Caspian Shore",   "coast",  0.65, 0.18),  # 31
    ("Hyrcania",        "forest", 0.68, 0.22),  # 32
    ("Parthia",         "desert", 0.72, 0.38),  # 33
    ("Balochistan",     "desert", 0.80, 0.55),  # 34
    ("Kandahar",        "hills",  0.88, 0.45),  # 35
]

PRESET = {
    "id": "middle_east",
    "name": "Middle East",
    "description": (
        "From Egypt to Persia, Anatolia to Arabia. "
        "Ancient empires clash across the cradle of civilisation."
    ),
    "regions": _REGIONS,
    "player1_capital": 0,            # Alexandria
    "player2_capital": 18,           # Ctesiphon
    "player1_extra_starts": [1, 5],  # Nile Delta, Judea
    "player2_extra_starts": [17, 22], # Upper Mesopotamia, Khuzestan
    "max_edge_distance": 0.22,
    "extra_edges": [],
    "removed_edges": [],
}
