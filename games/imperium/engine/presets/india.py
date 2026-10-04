"""
Indian Subcontinent — 37 regions
Player 1 (north): Pataliputra    Player 2 (south): Kishkindha
Spans Indus → Bengal, Himalayas → Sri Lanka.
"""

# (name, terrain, x, y)
_REGIONS = [
    # Northwest / Indus
    ("Takshashila",          "city",    0.08, 0.10),  # 0
    ("Madra",                "plains",  0.18, 0.15),  # 1
    ("Sindhu",               "plains",  0.10, 0.28),  # 2
    ("Maru",                 "desert",  0.22, 0.28),  # 3
    ("Dwarka",               "coast",   0.12, 0.42),  # 4
    # Gangetic Plain (heartland)
    ("Pataliputra",          "city",    0.42, 0.22),  # 5  P1 capital
    ("Kashi",                "plains",  0.38, 0.28),  # 6
    ("Magadha",              "plains",  0.48, 0.25),  # 7
    ("Kosala",               "forest",  0.35, 0.20),  # 8
    ("Shurasena",            "plains",  0.28, 0.22),  # 9
    # Nepal / Himalayan Foothills
    ("Kirata",               "hills",   0.45, 0.10),  # 10
    ("Ahom",                 "forest",  0.65, 0.15),  # 11
    # Bengal
    ("Vanga",                "coast",   0.60, 0.25),  # 12
    ("Utkala",               "coast",   0.55, 0.38),  # 13
    # Central India
    ("Avanti",               "hills",   0.28, 0.38),  # 14
    ("Chedi",                "forest",  0.35, 0.45),  # 15
    ("Vidarbha",             "forest",  0.45, 0.48),  # 16
    ("Dakshina Kosala",      "forest",  0.52, 0.48),  # 17
    # Deccan Plateau
    ("Pratishthana",         "hills",   0.28, 0.58),  # 18
    ("Konkana",              "coast",   0.20, 0.65),  # 19
    ("Ashmaka",              "hills",   0.42, 0.62),  # 20
    ("Andhra",               "coast",   0.48, 0.68),  # 21
    ("Dakshinapatha",        "hills",   0.38, 0.68),  # 22
    # South India
    ("Kishkindha",           "city",    0.35, 0.80),  # 23  P2 capital
    ("Mahishamandala",       "hills",   0.30, 0.88),  # 24
    ("Chera",                "coast",   0.22, 0.90),  # 25
    ("Chola",                "coast",   0.45, 0.82),  # 26
    ("Pandya",               "plains",  0.38, 0.92),  # 27
    # Sri Lanka
    ("Lanka",                "coast",   0.42, 0.98),  # 28
    # Eastern Coast
    ("Kalinga",              "coast",   0.55, 0.55),  # 29
    # Afghanistan border
    ("Gandhara",             "hills",   0.05, 0.05),  # 30
    ("Balochistan",          "desert",  0.02, 0.22),  # 31
    # Far East
    ("Dhanyawadi",           "hills",   0.68, 0.32),  # 32
    ("Manipur",              "hills",   0.70, 0.22),  # 33
    ("Lauhitya",             "forest",  0.62, 0.08),  # 34
    ("Tripura",              "forest",  0.65, 0.28),  # 35
    # Former princely state of Jammu and Kashmir (fixed geographic outline).
    ("Kashyap Meer",         "hills",   0.18, 0.04),  # 36
]

PRESET = {
    "id": "india",
    "name": "Indian Subcontinent",
    "description": (
        "From Gandhara to Vanga, the Himalayas to Lanka. "
        "Ancient kingdoms, epic traditions and regional heritage shape this campaign."
    ),
    "regions": _REGIONS,
    "player1_capital": 5,            # Pataliputra
    "player2_capital": 23,           # Kishkindha
    "player1_extra_starts": [6, 7],  # Kashi, Magadha
    "player2_extra_starts": [22, 24], # Dakshinapatha, Mahishamandala
    "max_edge_distance": 0.20,
    "extra_edges": [
        (28, 27),  # Lanka — Pandya (Palk Strait)
        (28, 26),  # Lanka — Chola
        (36, 0),   # Kashyap Meer — Takshashila
        (36, 1),   # Kashyap Meer — Madra
    ],
    "removed_edges": [(36, 30)],  # Access through Takshashila/Madra, not directly to Gandhara.
}

# Previous display names, keyed by stable region ID, for compatible saved games.
LEGACY_REGION_NAMES = {0: 'Taxila',
 1: 'Punjab',
 2: 'Sindh',
 3: 'Rajputana',
 4: 'Gujarat',
 8: 'Koshala',
 9: 'Mathura',
 10: 'Nepal',
 11: 'Assam',
 12: 'Bengal',
 13: 'Orissa',
 14: 'Malwa',
 15: 'Vindhya',
 16: 'Gondwana',
 17: 'Chhattisgarh',
 18: 'Maharashtra',
 19: 'Konkan',
 20: 'Telangana',
 22: 'Golconda',
 23: 'Vijayanagara',
 24: 'Mysore',
 25: 'Kerala',
 26: 'Coromandel',
 27: 'Madurai',
 28: 'Sri Lanka',
 30: 'Kabul Pass',
 32: 'Arakan',
 34: 'Brahmaputra'}
