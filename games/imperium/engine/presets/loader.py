"""
Converts a preset definition dict into a GameState.

Preset format:
    {
        "id": str,
        "name": str,
        "description": str,
        "regions": [(name, terrain, x, y), ...],   # terrain = city/plains/hills/desert/forest/coast
        "player1_capital": int,                      # index into regions list
        "player2_capital": int,
        "player1_extra_starts": [int, int],          # 2 extra region indices
        "player2_extra_starts": [int, int],
        "max_edge_distance": float,                  # Delaunay edge filter (default 0.22)
        "extra_edges": [(int, int), ...],            # manually added adjacencies (islands etc.)
        "removed_edges": [(int, int), ...],          # manually removed adjacencies
    }
"""
import json
from pathlib import Path

from typing import Dict, List, Optional, Set, Tuple

import numpy as np
from scipy.spatial import Delaunay

from ..models import (
    BASE_STARTING_POP,
    ROGUE_MILITIA_RATIO,
    TERRAIN_POP_RATE,
    GameState,
    MapSize,
    Owner,
    Player,
    Region,
    TerrainType,
)


def _build_adjacency(
    coords: List[Tuple[float, float]],
    max_dist: float,
    extra_edges: List[Tuple[int, int]],
    removed_edges: List[Tuple[int, int]],
) -> List[Set[int]]:
    n = len(coords)
    adj: List[Set[int]] = [set() for _ in range(n)]
    pts = np.array(coords)
    tri = Delaunay(pts)

    for simplex in tri.simplices:
        for i in range(3):
            for j in range(i + 1, 3):
                a, b = int(simplex[i]), int(simplex[j])
                dist = float(np.linalg.norm(pts[a] - pts[b]))
                if dist <= max_dist:
                    adj[a].add(b)
                    adj[b].add(a)

    for a, b in extra_edges:
        adj[a].add(b)
        adj[b].add(a)

    for a, b in removed_edges:
        adj[a].discard(b)
        adj[b].discard(a)

    return adj


def _map_size(n: int) -> MapSize:
    if n <= 36:
        return MapSize.SMALL
    elif n <= 48:
        return MapSize.MEDIUM
    return MapSize.LARGE


def load_preset(
    preset: dict,
    player1_name: str = "Player 1",
    player2_name: str = "Player 2",
    player1_is_ai: bool = False,
    player2_is_ai: bool = True,
    start_region_id: Optional[int] = None,
) -> GameState:
    raw = preset["regions"]          # [(name, terrain, x, y), ...]
    coords = [(r[2], r[3]) for r in raw]

    adj = _build_adjacency(
        coords,
        max_dist=preset.get("max_edge_distance", 0.22),
        extra_edges=preset.get("extra_edges", []),
        removed_edges=preset.get("removed_edges", []),
    )

    geography_file = Path(__file__).with_name('geography') / f"{preset['id']}.json"
    geography = json.loads(geography_file.read_text()) if geography_file.exists() else {}
    if geography:
        adj = [set(geography['neighbors'][str(i)]) for i in range(len(raw))]

    p1_start: Set[int] = {preset["player1_capital"]} | set(preset["player1_extra_starts"])
    p2_start: Set[int] = {preset["player2_capital"]} | set(preset["player2_extra_starts"])

    p1_capital, p2_capital = preset["player1_capital"], preset["player2_capital"]
    battle = preset.get('battle')
    side = 0
    if battle:
        if start_region_id not in (None, *battle['capitals']):
            raise ValueError('Choose one of the two historical sides.')
        side = 1 if start_region_id == battle['capitals'][1] else 0
        if side:
            p1_start, p2_start = p2_start, p1_start
            p1_capital, p2_capital = p2_capital, p1_capital
        player2_name = battle['sides'][1-side]
    elif start_region_id is not None:
        from .starts import kingdom_layout
        p1_start, p2_start, p2_capital = kingdom_layout(raw, adj, start_region_id)
        p1_capital = start_region_id

    regions: Dict[int, Region] = {}
    for idx, (name, terrain_str, x, y) in enumerate(raw):
        terrain = TerrainType(terrain_str)
        is_capital = idx in (p1_capital, p2_capital)

        if idx in p1_start:
            owner = Owner.PLAYER_1
            army = TERRAIN_POP_RATE[terrain] * BASE_STARTING_POP
        elif idx in p2_start:
            owner = Owner.PLAYER_2
            army = TERRAIN_POP_RATE[terrain] * BASE_STARTING_POP
        else:
            owner = Owner.ROGUE
            army = int(TERRAIN_POP_RATE[terrain] * BASE_STARTING_POP * ROGUE_MILITIA_RATIO)

        regions[idx] = Region(
            id=idx,
            name=name,
            terrain=terrain,
            owner=owner,
            army=battle['sites'][idx][5] if battle else max(1, army),
            reinforcement_rate=0 if battle else None,
            neighbors=sorted(adj[idx]),
            is_capital=is_capital,
            x=round(x, 4),
            y=round(y, 4),
        )

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
        map_size=_map_size(len(regions)),
        preset_id=preset['id'],
        routes=geography.get('routes', {}),
        ports=geography.get('ports', []),
        battle={
            'name': preset['name'], 'date': battle['date'],
            'factions': {'player_1': battle['sides'][side], 'player_2': battle['sides'][1-side]},
            'commanders': {'player_1': battle['commanders'][side], 'player_2': battle['commanders'][1-side]},
            'objectives': list(battle['objectives']), 'turn_limit': 20,
            'defender': 'player_1' if side == battle['defender'] else 'player_2',
            'context': battle['context'],
        } if battle else None,
    )
