"""Deterministic, connected starting kingdoms and honest strength previews."""
from collections import deque
from ..models import TERRAIN_POP_RATE, TerrainType


def kingdom_layout(raw, adjacency, capital):
    if capital not in range(len(raw)):
        raise ValueError("Choose a starting region from this map.")
    def expand(seat, excluded):
        owned = {seat}
        while len(owned) < 3:
            frontier = {n for r in owned for n in adjacency[r]} - owned - excluded
            if not frontier:
                break
            owned.add(max(frontier, key=lambda r: (TERRAIN_POP_RATE[TerrainType(raw[r][1])], -r)))
        return owned
    friendly = expand(capital, set())
    distance = {capital: 0}
    queue = deque([capital])
    while queue:
        current = queue.popleft()
        for neighbor in adjacency[current]:
            if neighbor not in distance:
                distance[neighbor] = distance[current] + 1
                queue.append(neighbor)
    candidates = set(range(len(raw))) - friendly
    rival = max(candidates, key=lambda r: (distance.get(r, len(raw)), raw[r][1] == 'city', -r))
    return friendly, expand(rival, friendly), rival


def starting_choices(preset):
    from .loader import load_preset
    from ..strategy import growth, supplied_regions
    choices = []
    capitals = preset['battle']['capitals'] if 'battle' in preset else [None, *range(len(preset['regions']))]
    for capital in capitals:
        state = load_preset(preset, start_region_id=capital)
        friendly = state.owned_regions('player_1')
        rival = state.owned_regions('player_2')
        strength = sum(r.army for r in friendly)
        opposition = sum(r.army for r in rival)
        ratio = strength / max(1, opposition)
        seat = state.get_player('player_1').capital_region_id
        label = state.battle['factions']['player_1'] if state.battle else state.regions[seat].name
        choices.append(dict(id=capital, name=label,
            regions=[r.name for r in friendly], army=strength,
            growth=sum(growth(r, supplied_regions(state)) for r in friendly),
            rival=state.regions[state.get_player('player_2').capital_region_id].name,
            difficulty='Favorable' if ratio > 1.2 else 'Challenging' if ratio < .8 else 'Balanced'))
    return choices
