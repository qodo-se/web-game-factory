"""Shared supply, crossing and forecast rules used by UI, combat and AI."""
from .models import Owner, TerrainType

CROSSING_BONUS = {'road': 1.0, 'river': 1.2, 'pass': 1.15, 'sea': 1.25}


def route_key(a, b):
    return f'{min(a,b)}:{max(a,b)}'


def route_kind(state, a, b):
    return state.routes.get(route_key(a, b), 'road')


def supplied_regions(state):
    supplied = {r.id for r in state.regions.values() if r.owner == Owner.ROGUE}
    for player in state.players:
        owner = Owner(player.id)
        queue = [r.id for r in state.regions.values() if r.owner == owner and
                 (r.terrain == TerrainType.CITY or r.id == player.capital_region_id)]
        seen = set(queue)
        while queue:
            for neighbor in state.regions[queue.pop()].neighbors:
                if neighbor not in seen and state.regions[neighbor].owner == owner:
                    seen.add(neighbor)
                    queue.append(neighbor)
        supplied.update(seen)
    return supplied


def growth(region, supplied):
    if region.owner == Owner.ROGUE:
        return int(region.pop_rate * .7)
    return region.pop_rate if region.id in supplied else max(1, region.pop_rate // 2)


def attack_factor(region, supplied):
    return 1.0 if region.id in supplied else .75


def defense_factor(region, supplied):
    return region.defense_bonus * (1.0 if region.id in supplied else .85)


def win_probability(attack, defense):
    if attack <= 0:
        return 0.0
    if defense <= 0:
        return 1.0
    return attack**2 / (attack**2 + defense**2)


def forecast(state, moves):
    """Forecast combined friendly attacks, before unknown simultaneous enemy orders."""
    supplied = supplied_regions(state)
    groups = {}
    for move in moves:
        groups.setdefault(move.to_region_id, []).append(state.regions[move.from_region_id])
    results = []
    for target_id, sources in groups.items():
        target = state.regions[target_id]
        army = sum(r.army + growth(r, supplied) for r in sources)
        if target.owner == sources[0].owner:
            results.append({'target': target_id, 'friendly': True, 'army': army})
            continue
        effective_attack = sum((r.army + growth(r, supplied)) * attack_factor(r, supplied)
                               / CROSSING_BONUS[route_kind(state, r.id, target_id)] for r in sources)
        defense = (target.army + growth(target, supplied)) * defense_factor(target, supplied)
        hardness = min(defense / max(effective_attack, 1), 1)
        results.append({'target': target_id, 'friendly': False, 'army': army,
                        'effective_attack': round(effective_attack, 1),
                        'effective_defense': round(defense, 1),
                        'win_probability': round(win_probability(effective_attack, defense), 3),
                        'losses_on_win': [int(army*hardness*.25), int(army*hardness*.55)],
                        'retreat_survivors_on_loss': [int(army*.35), int(army*.6)],
                        'crossings': sorted({route_kind(state, r.id, target_id) for r in sources}),
                        'isolated_sources': [r.id for r in sources if r.id not in supplied]})
    return results


def threats(state, moves):
    """Potential combined adjacent enemy attacks, not predictions of enemy orders."""
    supplied = supplied_regions(state)
    snapshot = {r.id: r.army + growth(r, supplied) for r in state.regions.values()}
    garrisons = dict(snapshot)
    for move in moves:
        garrisons[move.from_region_id] = 0
    for move in moves:
        if state.regions[move.to_region_id].owner == Owner.PLAYER_1:
            garrisons[move.to_region_id] += snapshot[move.from_region_id]
    entries, warnings = [], []
    for region in state.owned_regions('player_1'):
        enemies = [state.regions[n] for n in region.neighbors
                   if state.regions[n].owner == Owner.PLAYER_2]
        if not enemies:
            continue
        attack = sum(snapshot[r.id] * attack_factor(r, supplied) /
                     CROSSING_BONUS[route_kind(state, r.id, region.id)] for r in enemies)
        defense = garrisons[region.id] * defense_factor(region, supplied)
        risk = win_probability(attack, defense)
        baseline = win_probability(attack, snapshot[region.id] * defense_factor(region, supplied))
        entry = dict(region_id=region.id, risk=round(risk, 3),
                     garrison=garrisons[region.id], enemy_sources=[r.id for r in enemies],
                     level='high' if risk >= .65 else 'medium' if risk >= .35 else 'low')
        entries.append(entry)
        if garrisons[region.id] < snapshot[region.id] and (garrisons[region.id] == 0 or (risk >= .65 and risk > baseline + .1)):
            warnings.append(dict(**entry, name=region.name, important=region.is_capital or region.terrain == TerrainType.CITY))
    return dict(turn=state.turn, entries=entries, warnings=warnings)
