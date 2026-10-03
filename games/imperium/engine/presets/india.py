"""
Indian Subcontinent — 36 regions
Player 1 (north): Pataliputra    Player 2 (south): Vijayanagara
Spans Indus → Bengal, Himalayas → Sri Lanka.
"""

# (name, terrain, x, y)
_REGIONS = [
    # Northwest / Indus
    ("Taxila",          "city",   0.08, 0.10),  # 0
    ("Punjab",          "plains", 0.18, 0.15),  # 1
    ("Sindh",           "plains", 0.10, 0.28),  # 2
    ("Rajputana",       "desert", 0.22, 0.28),  # 3
    ("Gujarat",         "coast",  0.12, 0.42),  # 4
    # Gangetic Plain (heartland)
    ("Pataliputra",     "city",   0.42, 0.22),  # 5  P1 capital
    ("Kashi",           "plains", 0.38, 0.28),  # 6
    ("Magadha",         "plains", 0.48, 0.25),  # 7
    ("Koshala",         "forest", 0.35, 0.20),  # 8
    ("Mathura",         "plains", 0.28, 0.22),  # 9
    # Nepal / Himalayan Foothills
    ("Nepal",           "hills",  0.45, 0.10),  # 10
    ("Assam",           "forest", 0.65, 0.15),  # 11
    # Bengal
    ("Bengal",          "coast",  0.60, 0.25),  # 12
    ("Orissa",          "coast",  0.55, 0.38),  # 13
    # Central India
    ("Malwa",           "hills",  0.28, 0.38),  # 14
    ("Vindhya",         "forest", 0.35, 0.45),  # 15
    ("Gondwana",        "forest", 0.45, 0.48),  # 16
    ("Chhattisgarh",    "forest", 0.52, 0.48),  # 17
    # Deccan Plateau
    ("Maharashtra",     "hills",  0.28, 0.58),  # 18
    ("Konkan",          "coast",  0.20, 0.65),  # 19
    ("Telangana",       "hills",  0.42, 0.62),  # 20
    ("Andhra",          "coast",  0.48, 0.68),  # 21
    ("Golconda",        "hills",  0.38, 0.68),  # 22
    # South India
    ("Vijayanagara",    "city",   0.35, 0.80),  # 23  P2 capital
    ("Mysore",          "hills",  0.30, 0.88),  # 24
    ("Kerala",          "coast",  0.22, 0.90),  # 25
    ("Coromandel",      "coast",  0.45, 0.82),  # 26
    ("Madurai",         "plains", 0.38, 0.92),  # 27
    # Sri Lanka
    ("Sri Lanka",       "coast",  0.42, 0.98),  # 28
    # Eastern Coast
    ("Kalinga",         "coast",  0.55, 0.55),  # 29
    # Afghanistan border
    ("Kabul Pass",      "hills",  0.05, 0.05),  # 30
    ("Balochistan",     "desert", 0.02, 0.22),  # 31
    # Far East
    ("Arakan",          "hills",  0.68, 0.32),  # 32
    ("Manipur",         "hills",  0.70, 0.22),  # 33
    ("Brahmaputra",     "forest", 0.62, 0.08),  # 34
    ("Tripura",         "forest", 0.65, 0.28),  # 35
]

PRESET = {
    "id": "india",
    "name": "Indian Subcontinent",
    "description": (
        "From the Khyber Pass to Bengal, the Himalayas to Sri Lanka. "
        "The great Gangetic empires face the kingdoms of the Deccan."
    ),
    "regions": _REGIONS,
    "player1_capital": 5,            # Pataliputra
    "player2_capital": 23,           # Vijayanagara
    "player1_extra_starts": [6, 7],  # Kashi, Magadha
    "player2_extra_starts": [22, 24], # Golconda, Mysore
    "max_edge_distance": 0.20,
    "extra_edges": [
        (28, 27),  # Sri Lanka — Madurai (Palk Strait)
        (28, 26),  # Sri Lanka — Coromandel
    ],
    "removed_edges": [],
}
