"""Read-only historical positions, with exact reversal of legacy v2 journals."""
from copy import deepcopy, copy
from .models import Owner
from .strategy import growth, supplied_regions


def snapshot(state):
    return {'turn': state.turn, 'game_over': state.game_over, 'winner': state.winner,
            'regions': {str(r.id): [r.owner.value, r.army] for r in state.regions.values()}}


def _restore(template, saved):
    state = copy(template)
    state.regions = {rid: copy(region) for rid, region in template.regions.items()}
    if set(map(int, saved['regions'])) != set(state.regions):
        raise ValueError('Replay region mismatch')
    for key, (owner, army) in saved['regions'].items():
        if not isinstance(army, int) or army < 0:
            raise ValueError('Invalid historical army')
        state.regions[int(key)].owner = Owner(owner)
        state.regions[int(key)].army = army
    state.turn = saved['turn']
    state.game_over = saved['game_over']
    state.winner = saved['winner']
    return state


def _rewind(after, entry):
    if after.rules_version != 2 or 'events' not in entry:
        raise ValueError('This older turn has no complete replay journal')
    before = deepcopy(after)
    events = entry['events']
    moves = [event for event in events if event['type'] == 'movement']
    if len(moves) != len(entry.get('movements', [])):
        raise ValueError('Incomplete movement journal')
    battles = entry.get('combat_results', [])
    if len(battles) != sum(event['type'] == 'battle' for event in events):
        raise ValueError('Incomplete battle journal')
    # Reverse the resolver phases: retreats, battles, simultaneous movement,
    # then recruitment. Source armies are restored only after arrivals are removed.
    for event in events:
        if event['type'] == 'retreat':
            before.regions[event['to']].army -= event['army']
    for battle in reversed(battles):
        target = before.regions[battle['defender_region_id']]
        target.owner = Owner(battle['defender_owner'])
        target.army = battle['defender_army']
    for event in moves:
        source, target = before.regions[event['from']], before.regions[event['to']]
        if source.owner.value != event['owner']:
            raise ValueError('Incomplete ownership journal')
        if source.owner == target.owner:
            target.army -= event['army']
    for event in moves:
        source = before.regions[event['from']]
        if source.army != 0:
            raise ValueError('Inconsistent movement journal')
        source.army = event['army']
    supplied = supplied_regions(before)
    for region in before.regions.values():
        region.army -= growth(region, supplied)
        if region.army < 0:
            raise ValueError('Inconsistent recruitment journal')
    before.turn = entry['turn']
    before.game_over = False
    before.winner = None
    return before


def campaign_states(engine):
    """Return the contiguous recoverable suffix, earliest position first."""
    frames = [deepcopy(engine.state)]
    for entry in reversed(engine.history):
        if entry.get('turn') != frames[-1].turn - 1:
            break
        try:
            before = (_restore(frames[-1], entry['replay_before']) if 'replay_before' in entry
                      else _rewind(frames[-1], entry))
            if before.turn != entry['turn']:
                break
        except (KeyError, ValueError, TypeError):
            break
        frames.append(before)
    return list(reversed(frames))
