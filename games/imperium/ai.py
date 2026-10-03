"""
Imperium AI — heuristic-based strategic decision engine.

Strategy profile: challenging but beatable.
- Prioritises high-value targets (cities, coastal regions)
- Attacks when odds are favourable; consolidates when at a disadvantage
- Defends threatened regions intelligently
- Applies a small imperfection factor so skilled humans can outmanoeuvre it
"""
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Set

from .models import (
    GameState,
    Move,
    Owner,
    Region,
    TerrainType,
    TurnActions,
)

# Base strategic value of each terrain type
TERRAIN_VALUE: Dict[TerrainType, float] = {
    TerrainType.CITY: 120.0,
    TerrainType.COAST: 55.0,
    TerrainType.PLAINS: 40.0,
    TerrainType.FOREST: 30.0,
    TerrainType.HILLS: 25.0,
    TerrainType.DESERT: 15.0,
}

# Scoring weights
W_REGION_VALUE = 1.0
W_WIN_PROB = 2.0
W_STRATEGIC = 0.6
W_THREAT = 1.5

# Minimum win probability to attempt an attack
MIN_ATTACK_WIN_PROB = 0.38

# Probability of the AI skipping its best move for a region (imperfection)
IMPERFECTION_RATE = 0.12


@dataclass
class _Candidate:
    from_id: int
    to_id: int
    score: float
    is_attack: bool


def _win_prob(attacker: int, defender: int, defense_mult: float) -> float:
    effective = defender * defense_mult
    total = attacker + effective
    return attacker / total if total > 0 else 0.5


def _threat_level(region: Region, state: GameState, enemy_owner: Owner) -> float:
    """Sum of enemy army in adjacent enemy regions."""
    return sum(
        state.regions[nb].army
        for nb in region.neighbors
        if state.regions[nb].owner == enemy_owner
    )


def _strategic_connectivity(region: Region, state: GameState, ai_owner: Owner) -> float:
    """Bonus for regions with many unowned neighbours (expansion potential)."""
    non_owned = sum(
        1 for nb in region.neighbors
        if state.regions[nb].owner != ai_owner
    )
    capital_bonus = 50.0 if region.is_capital else 0.0
    return non_owned * 5.0 + capital_bonus


def _score_attack(
    attacker: Region,
    target: Region,
    state: GameState,
    ai_owner: Owner,
) -> float:
    """Score for attacking target from attacker. Returns -inf if not worth it."""
    prob = _win_prob(attacker.army, target.army, target.defense_bonus)
    if prob < MIN_ATTACK_WIN_PROB:
        return float("-inf")

    value = TERRAIN_VALUE.get(target.terrain, 30.0)
    if target.is_capital:
        value += 180.0  # strong incentive to go for the capital

    strat = _strategic_connectivity(target, state, ai_owner)

    return (
        W_REGION_VALUE * value
        + W_WIN_PROB * (prob * 100.0)
        + W_STRATEGIC * strat
    )


def _score_consolidate(
    from_region: Region,
    to_region: Region,
    state: GameState,
    ai_owner: Owner,
    enemy_owner: Owner,
) -> float:
    """
    Score for moving troops from from_region to to_region (friendly).
    Good when to_region is threatened or when consolidated force enables a winning attack.
    """
    threat = _threat_level(to_region, state, enemy_owner)
    combined = from_region.army + to_region.army

    # What can we attack from to_region after consolidation?
    best_attack = max(
        (
            TERRAIN_VALUE.get(state.regions[nb].terrain, 30.0)
            * _win_prob(combined, state.regions[nb].army, state.regions[nb].defense_bonus)
            for nb in to_region.neighbors
            if state.regions[nb].owner != ai_owner
            and _win_prob(combined, state.regions[nb].army, state.regions[nb].defense_bonus) > 0.55
        ),
        default=0.0,
    )

    return W_THREAT * threat + W_STRATEGIC * best_attack


def decide_actions(
    state: GameState,
    player_id: str,
    seed: Optional[int] = None,
) -> TurnActions:
    """
    Decide the AI's moves for this turn.

    For each owned region (sorted by army size + threat level):
      1. Score all possible attacks on adjacent non-owned regions
      2. Score consolidation into adjacent owned regions
      3. Pick the best non-conflicting move
      4. Apply imperfection: occasionally skip a move

    Overall posture:
      - army_ratio >= 0.9  → aggressive, prefer attacking
      - army_ratio < 0.9   → cautious, consolidate before attacking
    """
    rng = random.Random(seed)
    ai_owner = Owner(player_id)
    enemy_id = "player_2" if player_id == "player_1" else "player_1"
    enemy_owner = Owner(enemy_id)

    owned = state.owned_regions(player_id)
    if not owned:
        return TurnActions(player_id=player_id, moves=[])

    my_army = state.total_army(player_id)
    enemy_army = state.total_army(enemy_id)
    army_ratio = my_army / max(1, enemy_army)
    is_aggressive = army_ratio >= 0.9

    # Sort regions: highest army + most threatened first
    owned_sorted = sorted(
        owned,
        key=lambda r: r.army + _threat_level(r, state, enemy_owner) * 2.0,
        reverse=True,
    )

    candidates: List[_Candidate] = []

    for region in owned_sorted:
        if region.army == 0:
            continue

        best_score = float("-inf")
        best: Optional[_Candidate] = None

        for nb_id in region.neighbors:
            nb = state.regions[nb_id]

            if nb.owner == ai_owner:
                # Consolidation — only when cautious or region is threatened
                if not is_aggressive or _threat_level(nb, state, enemy_owner) > 0:
                    score = _score_consolidate(region, nb, state, ai_owner, enemy_owner)
                    # Discount consolidation vs attack to keep the AI active
                    score *= 0.65
                    if score > best_score:
                        best_score = score
                        best = _Candidate(region.id, nb_id, score, is_attack=False)
            else:
                score = _score_attack(region, nb, state, ai_owner)
                if score > best_score:
                    best_score = score
                    best = _Candidate(region.id, nb_id, score, is_attack=True)

        if best is not None and best_score > float("-inf"):
            candidates.append(best)

    # Sort by score descending, then build non-conflicting move list
    candidates.sort(key=lambda c: c.score, reverse=True)

    final_moves: List[Move] = []
    used_from: Set[int] = set()
    used_attack_targets: Set[int] = set()

    for c in candidates:
        if c.from_id in used_from:
            continue
        if c.is_attack and c.to_id in used_attack_targets:
            continue
        # Imperfection: occasionally skip this move
        if rng.random() < IMPERFECTION_RATE:
            continue

        final_moves.append(Move(from_region_id=c.from_id, to_region_id=c.to_id))
        used_from.add(c.from_id)
        if c.is_attack:
            used_attack_targets.add(c.to_id)

    return TurnActions(player_id=player_id, moves=final_moves)
