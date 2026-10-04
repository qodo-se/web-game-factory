"""
Central Asia — 36 regions
Player 1 (west): Samarkand    Player 2 (east): Karakorum
Spans Caspian Sea → Gobi, Siberian steppe → Hindu Kush.
"""

# (name, terrain, x, y)
_REGIONS = [
    # Western Caspian / Caucasus fringe
    ("Astrakhan",       "plains", 0.04, 0.22),  # 0
    ("Caspian Steppe",  "plains", 0.08, 0.38),  # 1
    ("Khwarazm",        "desert", 0.12, 0.52),  # 2
    # Transoxiana / Sogdia
    ("Samarkand",       "city",   0.20, 0.55),  # 3  P1 capital
    ("Bukhara",         "city",   0.16, 0.62),  # 4
    ("Ferghana",        "plains", 0.26, 0.55),  # 5
    ("Merv",            "desert", 0.15, 0.72),  # 6
    # Kazakh Steppe
    ("Western Steppe",  "plains", 0.12, 0.20),  # 7
    ("Aral Shore",      "coast",  0.12, 0.35),  # 8
    ("Central Steppe",  "plains", 0.28, 0.20),  # 9
    ("Eastern Steppe",  "plains", 0.48, 0.15),  # 10
    # Siberia fringe
    ("Western Siberia", "forest", 0.22, 0.05),  # 11
    ("Central Siberia", "forest", 0.50, 0.05),  # 12
    ("Lake Baikal",     "forest", 0.72, 0.08),  # 13
    # Afghanistan / Hindu Kush
    ("Herat",           "hills",  0.25, 0.72),  # 14
    ("Kandahar",        "hills",  0.28, 0.85),  # 15
    ("Kabul",           "hills",  0.35, 0.82),  # 16
    ("Balkh",           "plains", 0.30, 0.68),  # 17
    # Tian Shan / Dzungaria
    ("Tashkent",        "plains", 0.28, 0.45),  # 18
    ("Kashgar",         "city",   0.40, 0.58),  # 19
    ("Dzungaria",       "plains", 0.52, 0.38),  # 20
    ("Tarim Basin",     "desert", 0.55, 0.55),  # 21
    # Mongolia
    ("Western Mongolia","hills",  0.60, 0.28),  # 22
    ("Karakorum",       "city",   0.72, 0.28),  # 23  P2 capital
    ("Eastern Mongolia","plains", 0.82, 0.22),  # 24
    ("Gobi Desert",     "desert", 0.70, 0.45),  # 25
    # Manchuria / NE fringe
    ("Manchuria",       "forest", 0.88, 0.18),  # 26
    ("Amur",            "forest", 0.92, 0.10),  # 27
    # Tibet / Plateau
    ("Tibet",           "hills",  0.48, 0.72),  # 28
    ("Qinghai",         "hills",  0.60, 0.65),  # 29
    # China border
    ("Gansu",           "desert", 0.68, 0.58),  # 30
    ("Ordos",           "plains", 0.75, 0.48),  # 31
    ("Shanxi",          "hills",  0.82, 0.48),  # 32
    ("Hebei",           "plains", 0.88, 0.38),  # 33
    ("Liaoning",        "coast",  0.90, 0.28),  # 34
    ("Shaanxi",         "plains", 0.78, 0.60),  # 35
]

PRESET = {
    "id": "central_asia",
    "name": "Central Asia",
    "description": (
        "From the Caspian to the Gobi, the great steppe heartland. "
        "The Silk Road empires clash across the roof of the world."
    ),
    "regions": _REGIONS,
    "player1_capital": 3,            # Samarkand
    "player2_capital": 23,           # Karakorum
    "player1_extra_starts": [4, 5],  # Bukhara, Ferghana
    "player2_extra_starts": [22, 25], # Western Mongolia, Gobi
    "max_edge_distance": 0.22,
    "extra_edges": [],
    "removed_edges": [],
}
