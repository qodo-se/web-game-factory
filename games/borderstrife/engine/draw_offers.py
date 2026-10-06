"""Deterministic, bounded assessment of a negotiated stalemate."""
from .models import Move, Owner
from .strategy import forecast, growth, supplied_regions


def assess(state, history):
    supplied = supplied_regions(state)
    ai = state.owned_regions('player_2')
    human = state.owned_regions('player_1')
    if not ai or not human:
        return False, 'The campaign must still have two active sides.'
    if state.total_army('player_2') > state.total_army('player_1') * 1.2:
        return False, 'Draw declined: the opponent believes its troop advantage can win the campaign.'
    if sum(growth(r, supplied) for r in ai) > sum(growth(r, supplied) for r in human) * 1.2:
        return False, 'Draw declined: the opponent expects its stronger recruitment to break the deadlock.'
    # Include combined attacks and neutral expansion, with terrain, supply and crossings.
    moves = [Move(n, r.id) for r in state.regions.values() if r.owner != Owner.PLAYER_2
             for n in r.neighbors if state.regions[n].owner == Owner.PLAYER_2]
    if any(result['win_probability'] >= .65 for result in forecast(state, moves)):
        return False, 'Draw declined: the opponent sees a promising attack or expansion opportunity.'
    recent = {entry['turn']: entry.get('replay_before') for entry in history}
    for turn in range(state.turn - 10, state.turn):
        position = recent.get(turn)
        if not position:
            return False, 'Draw declined: ten turns of recorded stable borders are needed to establish a stalemate.'
        owners = {int(rid): values[0] for rid, values in position['regions'].items()}
        if any(owners.get(r.id) != r.owner.value for r in state.regions.values()):
            return False, 'Draw declined: borders have changed in the last ten turns. The opponent wants to keep fighting.'
    return True, 'Draw accepted: ten turns of stable borders and no clear breakthrough. Both sides agree to end the campaign.'
