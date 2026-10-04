import random
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from .combat import resolve_combat
from .strategy import supplied_regions, growth, attack_factor, defense_factor, CROSSING_BONUS, route_kind
from .models import (
    CombatResult,
    GameState,
    Move,
    Owner,
    ROGUE_MILITIA_RATIO,
    TurnActions,
    TurnSummary,
)


class ValidationError(Exception):
    pass


def validate_actions(state: GameState, actions: TurnActions) -> None:
    """
    Validate that all declared moves are legal for the given player.
    Raises ValidationError on any violation.
    """
    player_id = actions.player_id
    owner = Owner(player_id)
    moved_from: set = set()

    for move in actions.moves:
        region = state.regions.get(move.from_region_id)
        if region is None:
            raise ValidationError(f"Region {move.from_region_id} does not exist.")
        if region.owner != owner:
            raise ValidationError(
                f"Region {move.from_region_id} does not belong to {player_id}."
            )
        if move.from_region_id in moved_from:
            raise ValidationError(
                f"Region {move.from_region_id} used as source in two moves."
            )
        if move.to_region_id not in region.neighbors:
            raise ValidationError(
                f"Region {move.to_region_id} is not adjacent to {move.from_region_id}."
            )
        moved_from.add(move.from_region_id)


def resolve_turn(
    state: GameState,
    player1_actions: TurnActions,
    player2_actions: TurnActions,
    seed: Optional[int] = None,
) -> TurnSummary:
    """
    Execute one full game turn in three phases:

    Phase 1 — Population generation
        Every region generates population. Player regions add 100% to army.
        Rogue regions add 70% as militia.

    Phase 2 — Movement
        Snapshot all armies. Apply moves simultaneously:
        - Move into own region → consolidation (armies merge)
        - Move into rogue/enemy region → attack queued

    Phase 3 — Combat resolution
        All queued attacks resolved simultaneously (random order for ties).
        Attacker armies from the same player attacking the same target combine.
        Win probability uses squared effective strengths, including supply and crossings.

    Win condition check follows combat.
    """
    rng = random.Random(seed)

    # ── Phase 1: Population generation ───────────────────────────────────────
    supplied = supplied_regions(state)
    events = []
    retreats = []
    pop_generated: Dict[int, int] = {}
    for region in state.regions.values():
        generated = growth(region, supplied)
        region.army += generated
        pop_generated[region.id] = generated

    # ── Phase 2: Movement ─────────────────────────────────────────────────────
    # Snapshot armies AFTER population generation so movers take new pop with them
    army_snapshot: Dict[int, int] = {rid: r.army for rid, r in state.regions.items()}
    owner_snapshot: Dict[int, Owner] = {rid: r.owner for rid, r in state.regions.items()}

    all_moves: List[Move] = list(player1_actions.moves) + list(player2_actions.moves)

    # Track pending attacks: target_id → [(src_id, army, attacker_owner)]
    pending_attacks: Dict[int, List[Tuple[int, int, Owner]]] = defaultdict(list)
    movements: List[Tuple[int, int, int]] = []

    # Zero out source armies for all moves (troops have departed)
    moved_sources: set = set()
    for move in all_moves:
        if move.from_region_id not in moved_sources:
            state.regions[move.from_region_id].army = 0
            moved_sources.add(move.from_region_id)

    for move in all_moves:
        src_id = move.from_region_id
        tgt_id = move.to_region_id
        army_size = army_snapshot[src_id]
        src_owner = owner_snapshot[src_id]
        tgt_owner = owner_snapshot[tgt_id]

        if army_size == 0:
            continue

        movements.append((src_id, tgt_id, army_size))
        events.append({'type': 'movement', 'from': src_id, 'to': tgt_id,
                       'army': army_size, 'owner': src_owner.value,
                       'route': route_kind(state, src_id, tgt_id)})

        if tgt_owner == src_owner:
            # Consolidation: troops merge into friendly region
            state.regions[tgt_id].army += army_size
        else:
            # Attack: queue for combat resolution
            pending_attacks[tgt_id].append((src_id, army_size, src_owner))

    # ── Phase 3: Combat resolution ────────────────────────────────────────────
    combat_results: List[CombatResult] = []

    for target_id, attackers in pending_attacks.items():
        target_region = state.regions[target_id]

        # Combine armies from same player attacking the same target
        player_armies: Dict[Owner, int] = defaultdict(int)
        player_strength = defaultdict(float)
        player_origins = defaultdict(list)
        player_source: Dict[Owner, int] = {}  # first source region for logging
        for src_id, army, attacker_owner in attackers:
            player_armies[attacker_owner] += army
            player_strength[attacker_owner] += army * attack_factor(state.regions[src_id], supplied) / CROSSING_BONUS[route_kind(state, src_id, target_id)]
            player_origins[attacker_owner].append(src_id)
            if attacker_owner not in player_source:
                player_source[attacker_owner] = src_id

        # If two players attack same region simultaneously, resolve in random order
        attacker_list = list(player_armies.items())
        rng.shuffle(attacker_list)

        for attacker_owner, total_attack_army in attacker_list:
            src_region = state.regions[player_source[attacker_owner]]
            defending_owner = target_region.owner
            result = resolve_combat(
                attacker_region=src_region,
                defender_region=target_region,
                attacking_army=total_attack_army,
                rng=rng,
                effective_attack=player_strength[attacker_owner],
                defense_multiplier=defense_factor(target_region, supplied),
            )
            result.battle_details.update({
                'terrain': target_region.terrain.value,
                'terrain_multiplier': target_region.defense_bonus,
                'defender_supplied': target_id in supplied,
                'defense_multiplier': defense_factor(target_region, supplied),
                'sources': [{'region_id': src_id, 'army': army_snapshot[src_id],
                             'supplied': src_id in supplied,
                             'attack_multiplier': attack_factor(state.regions[src_id], supplied),
                             'crossing': route_kind(state, src_id, target_id),
                             'crossing_multiplier': CROSSING_BONUS[route_kind(state, src_id, target_id)]}
                            for src_id in player_origins[attacker_owner]],
            })
            result.attacker_owner = attacker_owner.value
            result.defender_owner = defending_owner.value
            combat_results.append(result)

            if result.attacker_won:
                target_region.owner = attacker_owner
                target_region.army = result.survivors
            else:
                target_region.army = result.survivors
            events.append({'type': 'battle', 'from': src_region.id, 'to': target_id,
                           'owner': attacker_owner.value, 'previous_owner': defending_owner.value,
                           'won': result.attacker_won, 'army': result.survivors,
                           'attacker_losses': result.attacker_army-result.attacker_survivors,
                           'defender_losses': result.defender_army-result.defender_survivors})
            if result.attacker_won:
                retreats.append((result, defending_owner, result.defender_survivors,
                                 list(target_region.neighbors), target_id))
            else:
                retreats.append((result, attacker_owner, result.attacker_survivors,
                                 player_origins[attacker_owner] + list(target_region.neighbors), target_id))

    # Retreats happen after every battle. A captured origin cannot receive troops,
    # and routed armies cannot reinforce a battle that already resolved this turn.
    for result, owner, survivors, candidates, origin in retreats:
        destination = next((rid for rid in candidates if rid != origin and
                            state.regions[rid].owner == owner), None)
        if survivors > 0 and destination is not None:
            state.regions[destination].army += survivors
            result.retreat_region_id = destination
            result.retreated = survivors
            events.append({'type': 'retreat', 'from': origin, 'to': destination,
                           'army': survivors, 'owner': owner.value})
        elif result.attacker_won:
            result.defender_survivors = 0
        else:
            result.attacker_survivors = 0

    # Final losses include routed troops that found no safe retreat.
    for event, result in zip((e for e in events if e['type'] == 'battle'), combat_results):
        event['attacker_losses'] = result.attacker_army-result.attacker_survivors
        event['defender_losses'] = result.defender_army-result.defender_survivors

    # ── Win condition check ───────────────────────────────────────────────────
    n_total = len(state.regions)
    p1_count = state.region_count("player_1")
    p2_count = state.region_count("player_2")

    winner: Optional[str] = None
    game_over = False

    if p1_count == n_total:
        winner, game_over = "player_1", True
    elif p2_count == n_total:
        winner, game_over = "player_2", True
    elif p1_count == 0:
        winner, game_over = "player_2", True
    elif p2_count == 0:
        winner, game_over = "player_1", True

    if state.battle and not game_over:
        strengths = {p.id: state.total_army(p.id) for p in state.players}
        if any(strength == 0 for strength in strengths.values()) or state.turn >= state.battle['turn_limit']:
            # With no recruitment, a side without troops cannot recover.
            # At the limit: objective control, then surviving army, then defender.
            def battle_score(player):
                return (strengths[player.id] > 0,
                        sum(state.regions[r].owner.value == player.id for r in state.battle['objectives']),
                        strengths[player.id], player.id == state.battle['defender'])
            winner = max(state.players, key=battle_score).id
            game_over = True

    state.turn += 1
    state.winner = winner
    state.game_over = game_over

    return TurnSummary(
        turn=state.turn - 1,
        population_generated=pop_generated,
        movements=movements,
        combat_results=combat_results,
        game_over=game_over,
        winner=winner,
        events=events,
    )
