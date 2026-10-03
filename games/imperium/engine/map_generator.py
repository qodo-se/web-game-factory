import math
import random
from typing import Dict, List, Optional, Set, Tuple

import numpy as np
from scipy.spatial import Delaunay

from .models import (
    BASE_STARTING_POP,
    MAP_REGION_COUNT,
    ROGUE_MILITIA_RATIO,
    TERRAIN_POP_RATE,
    GameState,
    MapSize,
    Owner,
    Player,
    Region,
    TerrainType,
)

# Pool of ancient/medieval-sounding region names (needs 60+ for large map)
_REGION_NAMES = [
    "Aldenmoor", "Ashenvale", "Blackfen", "Brimstone", "Cairnhollow",
    "Cresthold", "Dawnmere", "Dunwall", "Dusthaven", "Eldenmere",
    "Emberveil", "Frostholm", "Galehurst", "Greystone", "Grimfell",
    "Havenport", "Highcrest", "Ironford", "Jadehollow", "Kestrelfall",
    "Lakeshire", "Mirefall", "Mistpeak", "Moonshard", "Northveil",
    "Oakenvale", "Obsidian", "Oldwatch", "Peakholm", "Pinehurst",
    "Ravenholm", "Redmoor", "Rimstone", "Saltmere", "Sandveil",
    "Shadowfen", "Silverkeep", "Skyhaven", "Slatehollow", "Stonebridge",
    "Stormveil", "Sunhaven", "Swiftmere", "Thornwall", "Tidehaven",
    "Twilightmere", "Veilstone", "Verdanthold", "Wardenfall", "Westmarch",
    "Whitefell", "Wildmere", "Windholm", "Winterveil", "Wolfmoor",
    "Wyrmstone", "Yarrowfen", "Yellowstone", "Zealholm", "Zenithvale",
    "Ashridge", "Brightwater", "Coldmere", "Darkhaven", "Emberstoke",
]

# Rural terrain distribution weights
_RURAL_WEIGHTS = [
    (TerrainType.PLAINS, 4),
    (TerrainType.HILLS, 3),
    (TerrainType.DESERT, 2),
    (TerrainType.FOREST, 3),
    (TerrainType.COAST, 3),
]


def _min_point_distance(n_half: int) -> float:
    """Adaptive minimum distance between region nodes based on map density."""
    return max(0.07, 0.16 - n_half * 0.003)


def _euclidean(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def _generate_half_points(
    n: int, rng: random.Random, min_dist: float
) -> List[Tuple[float, float]]:
    """
    Generate n well-spaced points in x=[0.05, 0.44], y=[0.05, 0.95]
    using Poisson disk sampling with adaptive fallback.
    """
    points: List[Tuple[float, float]] = []
    for attempt_dist in [min_dist, min_dist * 0.85, min_dist * 0.70]:
        points = []
        for _ in range(50000):
            if len(points) >= n:
                break
            x = rng.uniform(0.05, 0.44)
            y = rng.uniform(0.05, 0.95)
            if all(_euclidean((x, y), p) >= attempt_dist for p in points):
                points.append((x, y))
        if len(points) >= n:
            break
    return points[:n]


def _build_adjacency(points: List[Tuple[float, float]]) -> List[Set[int]]:
    """Freeform graph adjacency via Delaunay triangulation."""
    arr = np.array(points)
    tri = Delaunay(arr)
    n = len(points)
    adj: List[Set[int]] = [set() for _ in range(n)]
    for simplex in tri.simplices:
        a, b, c = int(simplex[0]), int(simplex[1]), int(simplex[2])
        adj[a].add(b); adj[b].add(a)
        adj[a].add(c); adj[c].add(a)
        adj[b].add(c); adj[c].add(b)
    return adj


def _is_fully_connected(adj: List[Set[int]]) -> bool:
    """BFS connectivity check."""
    if not adj:
        return True
    visited: Set[int] = set()
    queue = [0]
    while queue:
        node = queue.pop()
        if node in visited:
            continue
        visited.add(node)
        queue.extend(adj[node] - visited)
    return len(visited) == len(adj)


def _cities_per_half(n_half: int) -> int:
    """Number of city regions on each side of the map."""
    if n_half <= 18:
        return 2   # 1 capital + 1 extra
    elif n_half <= 24:
        return 3
    else:
        return 4


def _assign_rural_terrains(n: int, rng: random.Random) -> List[TerrainType]:
    """Generate n rural terrain types proportionally."""
    total_weight = sum(w for _, w in _RURAL_WEIGHTS)
    pool: List[TerrainType] = []
    for terrain, weight in _RURAL_WEIGHTS:
        count = max(1, round(n * weight / total_weight))
        pool.extend([terrain] * count)
    # Trim or pad to exactly n
    while len(pool) > n:
        pool.pop()
    while len(pool) < n:
        pool.append(TerrainType.PLAINS)
    rng.shuffle(pool)
    return pool


def generate_map(
    map_size: MapSize = MapSize.SMALL,
    seed: Optional[int] = None,
    player1_name: str = "Player 1",
    player2_name: str = "Player 2",
    player1_is_ai: bool = False,
    player2_is_ai: bool = True,
) -> GameState:
    """
    Generate a balanced freeform map for Imperium.

    Algorithm:
    1. Place N/2 random points (left half) with Poisson disk spacing
    2. Mirror them to the right half (structural balance guarantee)
    3. Delaunay triangulation over all N points → freeform adjacency graph
    4. Assign terrain symmetrically (same terrain on mirrored pairs)
    5. High-connectivity nodes become cities; leftmost city = Player 1 capital
    6. Each player starts with capital + 2 adjacent rural regions
    7. All other regions start as rogue
    """
    rng = random.Random(seed)
    if seed is not None:
        np.random.seed(seed)

    n_total = MAP_REGION_COUNT[map_size]
    n_half = n_total // 2
    min_dist = _min_point_distance(n_half)

    # --- 1. Generate left-half points, mirror to right ---
    left_pts = _generate_half_points(n_half, rng, min_dist)
    right_pts = [(1.0 - x, y) for x, y in left_pts]
    all_pts = left_pts + right_pts
    # Indices: left = 0..n_half-1, right = n_half..n_total-1
    # Mirrors: region i (left) <-> region i+n_half (right)

    # --- 2. Build adjacency graph ---
    adj = _build_adjacency(all_pts)
    assert _is_fully_connected(adj), "Generated map is not fully connected."

    # --- 3. Identify city positions (highest-degree left nodes) ---
    n_cities = _cities_per_half(n_half)
    left_by_degree = sorted(range(n_half), key=lambda i: len(adj[i]), reverse=True)
    city_left: Set[int] = set(left_by_degree[:n_cities])
    city_right: Set[int] = {i + n_half for i in city_left}

    # --- 4. Assign terrain symmetrically ---
    rural_terrains = _assign_rural_terrains(n_half - n_cities, rng)
    terrain_map: Dict[int, TerrainType] = {}
    rural_iter = iter(rural_terrains)
    for i in range(n_half):
        t = TerrainType.CITY if i in city_left else next(rural_iter)
        terrain_map[i] = t
        terrain_map[i + n_half] = t  # mirror gets same terrain

    # --- 5. Identify capitals (leftmost / rightmost city) ---
    p1_capital = min(city_left, key=lambda i: all_pts[i][0])
    p2_capital = p1_capital + n_half  # mirrored

    # --- 6. Assign player starting regions ---
    def pick_rurals(capital_idx: int, excluded: Set[int]) -> List[int]:
        rural_neighbors = [
            nb for nb in adj[capital_idx]
            if nb not in excluded and terrain_map[nb] != TerrainType.CITY
        ]
        rng.shuffle(rural_neighbors)
        return rural_neighbors[:2]

    p1_owned: Set[int] = {p1_capital}
    p1_owned.update(pick_rurals(p1_capital, p1_owned))

    p2_owned: Set[int] = {p2_capital}
    p2_owned.update(pick_rurals(p2_capital, p2_owned))

    # --- 7. Assign names ---
    names = list(_REGION_NAMES)
    rng.shuffle(names)
    # Pad if needed
    while len(names) < n_total:
        names.append(f"Region {len(names)}")
    name_map = {i: names[i] for i in range(n_total)}

    # --- 8. Build Region objects ---
    regions: Dict[int, Region] = {}
    for i in range(n_total):
        terrain = terrain_map[i]
        is_capital = i in (p1_capital, p2_capital)

        if i in p1_owned:
            owner = Owner.PLAYER_1
            army = TERRAIN_POP_RATE[terrain] * BASE_STARTING_POP
        elif i in p2_owned:
            owner = Owner.PLAYER_2
            army = TERRAIN_POP_RATE[terrain] * BASE_STARTING_POP
        else:
            owner = Owner.ROGUE
            army = int(TERRAIN_POP_RATE[terrain] * BASE_STARTING_POP * ROGUE_MILITIA_RATIO)

        x, y = all_pts[i]
        regions[i] = Region(
            id=i,
            name=name_map[i],
            terrain=terrain,
            owner=owner,
            army=max(1, army),
            neighbors=sorted(adj[i]),
            is_capital=is_capital,
            x=round(x, 4),
            y=round(y, 4),
        )

    # --- 9. Build Players ---
    players = [
        Player(
            id="player_1",
            name=player1_name,
            is_ai=player1_is_ai,
            capital_region_id=p1_capital,
        ),
        Player(
            id="player_2",
            name=player2_name,
            is_ai=player2_is_ai,
            capital_region_id=p2_capital,
        ),
    ]

    return GameState(
        regions=regions,
        players=players,
        turn=1,
        map_size=map_size,
    )
