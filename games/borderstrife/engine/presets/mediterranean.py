"""
Mediterranean — 36 regions
Player 1 (west): Hispalis    Player 2 (east): Antioch
Spans Iberia → Mesopotamia, Gaul → Sahara.
Coordinates: x = west→east, y = north→south (normalised 0–1).
"""

# (name, terrain, x, y)
_REGIONS = [
    # Iberian Peninsula
    ("Hispalis",                  "city",   0.07, 0.60),  # 0  P1 capital
    ("Lusitania",                 "hills",  0.02, 0.50),  # 1
    ("Hispania Tarraconensis",    "hills",  0.18, 0.47),  # 2
    ("Carthago Nova",             "coast",  0.15, 0.58),  # 3
    # Southern France / NW Italy
    ("Gallia Narbonensis",        "plains", 0.23, 0.40),  # 4
    ("Gallia",                    "forest", 0.25, 0.28),  # 5
    ("Liguria",                   "coast",  0.32, 0.37),  # 6
    # Italian Peninsula
    ("Rome",                      "city",   0.37, 0.43),  # 7
    ("Campania",                  "plains", 0.42, 0.48),  # 8
    ("Calabria",                  "coast",  0.43, 0.58),  # 9
    # Islands
    ("Corsica & Sardinia",        "coast",  0.31, 0.52),  # 10
    ("Sicily",                    "coast",  0.40, 0.63),  # 11
    # North Africa West
    ("Mauretania",                "desert", 0.08, 0.72),  # 12
    ("Numidia",                   "desert", 0.27, 0.68),  # 13
    ("Carthage",                  "city",   0.33, 0.63),  # 14
    ("Libya",                     "desert", 0.42, 0.80),  # 15
    ("Cyrenaica",                 "desert", 0.54, 0.80),  # 16
    # Northern Italy / Balkans
    ("Cisalpine Gaul",            "plains", 0.36, 0.32),  # 17
    ("Illyria",                   "hills",  0.48, 0.40),  # 18
    ("Macedonia",                 "hills",  0.54, 0.47),  # 19
    ("Athens",                    "city",   0.56, 0.58),  # 20
    ("Crete",                     "coast",  0.59, 0.70),  # 21
    ("Thrace",                    "plains", 0.63, 0.42),  # 22
    # Egypt
    ("Alexandria",                "city",   0.68, 0.82),  # 23
    ("Egypt",                     "desert", 0.72, 0.92),  # 24
    # Asia Minor
    ("Bithynia",                  "coast",  0.68, 0.50),  # 25
    ("Pontus",                    "hills",  0.78, 0.45),  # 26
    ("Lydia",                     "hills",  0.64, 0.58),  # 27
    ("Cappadocia",                "hills",  0.76, 0.58),  # 28
    ("Armenia",                   "hills",  0.90, 0.50),  # 29
    # Levant
    ("Cyprus",                    "coast",  0.73, 0.68),  # 30
    ("Phoenicia",                 "coast",  0.76, 0.72),  # 31
    ("Judea",                     "hills",  0.76, 0.82),  # 32
    ("Syria",                     "plains", 0.83, 0.65),  # 33
    ("Antioch",                   "city",   0.78, 0.55),  # 34  P2 capital
    ("Mesopotamia",               "plains", 0.92, 0.72),  # 35
]

PRESET = {
    "id": "mediterranean",
    "name": "Mediterranean",
    "description": (
        "From Iberia to Mesopotamia, Gaul to the Sahara. "
        "Rome and Carthage fight for the Inner Sea."
    ),
    "regions": _REGIONS,
    "player1_capital": 0,           # Hispalis
    "player2_capital": 34,          # Antioch
    "player1_extra_starts": [1, 3], # Lusitania, Carthago Nova
    "player2_extra_starts": [28, 33], # Cappadocia, Syria
    "max_edge_distance": 0.22,
    # Islands need explicit sea-lane edges
    "extra_edges": [
        (10, 7),   # Corsica/Sardinia — Rome
        (10, 14),  # Corsica/Sardinia — Carthage
        (11, 14),  # Sicily — Carthage
        (11, 15),  # Sicily — Libya
        (21, 16),  # Crete — Cyrenaica
        (21, 30),  # Crete — Cyprus
        (30, 23),  # Cyprus — Alexandria
    ],
    "removed_edges": [],
}
