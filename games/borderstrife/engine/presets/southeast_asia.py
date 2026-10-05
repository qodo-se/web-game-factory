"""
Southeast Asia — 36 regions
Player 1 (mainland): Ayutthaya    Player 2 (maritime): Majapahit
Spans Burma → Philippines, Thailand → Java/Bali.
"""

# (name, terrain, x, y)
_REGIONS = [
    # Burma / Myanmar
    ("Pagan",           "city",   0.08, 0.08),  # 0
    ("Irrawaddy Delta", "coast",  0.10, 0.22),  # 1
    ("Arakan",          "hills",  0.02, 0.15),  # 2
    ("Shan Hills",      "hills",  0.18, 0.10),  # 3
    # Thailand / Mainland
    ("Ayutthaya",       "city",   0.22, 0.25),  # 4  P1 capital
    ("Chiang Mai",      "hills",  0.20, 0.12),  # 5
    ("Sukhothai",       "plains", 0.18, 0.20),  # 6
    ("Gulf of Siam",    "coast",  0.28, 0.35),  # 7
    # Laos / Cambodia
    ("Vientiane",       "forest", 0.30, 0.18),  # 8
    ("Angkor",          "city",   0.32, 0.28),  # 9
    ("Mekong Delta",    "plains", 0.36, 0.35),  # 10
    # Vietnam
    ("Hanoi",           "city",   0.38, 0.12),  # 11
    ("Hue",             "coast",  0.40, 0.22),  # 12
    ("Saigon",          "coast",  0.38, 0.30),  # 13
    # Malay Peninsula
    ("Kedah",           "coast",  0.22, 0.45),  # 14
    ("Malacca",         "city",   0.26, 0.55),  # 15
    ("Johor",           "forest", 0.28, 0.62),  # 16
    # Sumatra
    ("Srivijaya",       "city",   0.22, 0.70),  # 17
    ("Palembang",       "coast",  0.30, 0.72),  # 18
    ("Aceh",            "coast",  0.12, 0.68),  # 19
    ("Jambi",           "forest", 0.25, 0.78),  # 20
    # Java
    ("Majapahit",       "city",   0.38, 0.85),  # 21  P2 capital
    ("Sunda",           "hills",  0.32, 0.88),  # 22
    ("East Java",       "plains", 0.44, 0.88),  # 23
    # Bali & Lesser Sundas
    ("Bali",            "hills",  0.50, 0.90),  # 24
    ("Lombok",          "hills",  0.54, 0.92),  # 25
    # Borneo
    ("Brunei",          "forest", 0.48, 0.68),  # 26
    ("Kalimantan",      "forest", 0.48, 0.78),  # 27
    ("Sarawak",         "forest", 0.44, 0.62),  # 28
    # Philippines
    ("Luzon",           "hills",  0.60, 0.25),  # 29
    ("Visayas",         "coast",  0.62, 0.38),  # 30
    ("Mindanao",        "hills",  0.65, 0.48),  # 31
    # Sulawesi & Maluku
    ("Sulawesi",        "hills",  0.58, 0.62),  # 32
    ("Maluku",          "coast",  0.68, 0.65),  # 33
    # Indochina coast
    ("Champa",          "coast",  0.44, 0.18),  # 34
    ("Patani",          "coast",  0.24, 0.40),  # 35
]

PRESET = {
    "id": "southeast_asia",
    "name": "Southeast Asia",
    "description": (
        "From the Irrawaddy to the Philippines, the mainland kingdoms "
        "face the maritime empire of the archipelago."
    ),
    "regions": _REGIONS,
    "player1_capital": 4,             # Ayutthaya
    "player2_capital": 21,            # Majapahit
    "player1_extra_starts": [5, 9],   # Chiang Mai, Angkor
    "player2_extra_starts": [22, 23], # Sunda, East Java
    "max_edge_distance": 0.20,
    "extra_edges": [
        (16, 17),  # Johor — Srivijaya (Malacca Strait)
        (16, 19),  # Johor — Aceh
        (17, 19),  # Srivijaya — Aceh
        (17, 22),  # Srivijaya — Sunda
        (21, 27),  # Majapahit — Kalimantan
        (21, 22),  # Majapahit — Sunda
        (26, 28),  # Brunei — Sarawak
        (26, 32),  # Brunei — Sulawesi
        (30, 32),  # Visayas — Sulawesi
        (30, 28),  # Visayas — Sarawak
        (32, 33),  # Sulawesi — Maluku
        (24, 27),  # Bali — Kalimantan
    ],
    "removed_edges": [],
}
