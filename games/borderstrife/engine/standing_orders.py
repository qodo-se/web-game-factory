"""Standing plans expand into ordinary, simultaneous whole-region moves.

Plans are committed atomically with a turn by the API. They never resolve turns
or move armies themselves. Reinforcements always repeat between friendly neighbors.
"""
from copy import deepcopy

from .models import Move, Owner
from .turn_resolver import ValidationError


def normalize(orders):
    """Retire superseded source orders from saves made by the early prototype."""
    by_source = {}
    for order in orders:
        if order.get('kind') != 'reinforce':
            continue
        source = order['path'][0]
        previous = by_source.get(source)
        if previous is None or previous['paused'] or not order['paused']:
            by_source[source] = order
    return list(by_source.values())


def prepare(state, manual_moves, plans=None):
    orders = deepcopy(normalize(state.standing_orders) if plans is None else plans)
    previous = {o["id"]: o for o in state.standing_orders}
    seen = set()
    seen_sources = set()
    for order in orders:
        path = order['path']
        old = previous.get(order['id'], {})
        if order['paused'] and old.get('paused') and old.get('path') == path and old.get('reason'):
            order['reason'] = old['reason']
        if order['id'] in seen:
            raise ValidationError('Standing orders must have unique IDs.')
        seen.add(order['id'])
        if len(set(path)) != len(path) or any(r not in state.regions for r in path):
            raise ValidationError('A standing route must use distinct, existing regions.')
        if any(b not in state.regions[a].neighbors for a, b in zip(path, path[1:])):
            raise ValidationError('Every step of a standing route must connect on the map.')
        if order['kind'] != 'reinforce' or len(path) != 2:
            raise ValidationError('Repeat reinforcements require two neighboring regions and cannot attack.')
        if path[0] in seen_sources:
            raise ValidationError('Only one repeat reinforcement order is allowed per source.')
        seen_sources.add(path[0])

    moves = list(manual_moves)
    sources = {m.from_region_id for m in moves}
    running = []
    events = []
    for order in orders:
        if order['paused']:
            continue
        source, target = order['path'][:2]
        reason = None
        if source in sources:
            reason = 'Another move takes priority at the source.'
        elif state.regions[source].owner != Owner.PLAYER_1:
            reason = 'The source is no longer yours.'
        elif state.regions[target].owner != Owner.PLAYER_1:
            reason = 'The next region is no longer friendly.'
        if reason:
            pause(order, reason, events)
            continue
        order.pop('reason', None)
        moves.append(Move(source, target))
        sources.add(source)
        running.append(order['id'])
    return orders, moves, running, events


def pause(order, reason, events):
    order['paused'] = True
    order['reason'] = reason
    events.append({'type': 'standing_order', 'order_id': order['id'],
                   'region_id': order['path'][-1], 'status': 'paused', 'message': reason})


def finish(state, orders, running, summary, events):
    remaining = []
    for order in orders:
        if order['id'] in running:
            source, target = order['path'][:2]
            # Empty sources wait for recruits/arrivals; ownership changes alone
            # interrupt a repeating route. Movement is simultaneous.
            if state.regions[target].owner != Owner.PLAYER_1:
                pause(order, 'The army did not hold its destination. Review the battle before resuming.', events)
            if not order['paused'] and state.regions[order['path'][0]].owner != Owner.PLAYER_1:
                pause(order, 'The source is no longer yours.', events)
        remaining.append(order)
    state.standing_orders = remaining
    summary.events.extend(events)
