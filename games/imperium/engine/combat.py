import random
from .models import CombatResult, Region
from .strategy import win_probability


def resolve_combat(attacker_region: Region, defender_region: Region,
                   attacking_army: int, rng: random.Random,
                   effective_attack=None, defense_multiplier=None) -> CombatResult:
    """Strength-squared odds; defeated survivors may retreat after all battles.

    A 3:1 effective advantage wins 90% of battles. Terrain, supply and route
    modifiers are supplied by the resolver and shared with the forecast.
    """
    defender_army = defender_region.army
    attack = attacking_army if effective_attack is None else effective_attack
    defense = defender_army * (defender_region.defense_bonus if defense_multiplier is None else defense_multiplier)
    probability = win_probability(attack, defense)
    roll = rng.random()
    won = roll < probability
    if defender_army == 0 and attacking_army > 0:
        won = True
    if won:
        hardness = min(defense / max(attack, 1), 1)
        attacker_left = max(1, attacking_army - int(attacking_army * hardness * rng.uniform(.25, .55)))
        defender_left = int(defender_army * rng.uniform(.35, .6))
    else:
        attacker_left = int(attacking_army * rng.uniform(.35, .6))
        losses = int(defender_army * min(attack / max(defense, 1), 1) * rng.uniform(.2, .5))
        defender_left = max(0, defender_army - losses)
    return CombatResult(attacker_region_id=attacker_region.id,
                        defender_region_id=defender_region.id,
                        attacker_army=attacking_army, defender_army=defender_army,
                        effective_defender_army=round(defense, 2), attacker_won=won,
                        survivors=attacker_left if won else defender_left,
                        attacker_survivors=attacker_left, defender_survivors=defender_left,
                        battle_details={'effective_attack': attack, 'effective_defense': defense,
                                        'win_probability': probability, 'roll': roll})
