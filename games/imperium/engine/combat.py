import random
from .models import CombatResult, Region


def resolve_combat(
    attacker_region: Region,
    defender_region: Region,
    attacking_army: int,
    rng: random.Random,
) -> CombatResult:
    """
    Resolve a battle between an attacking army and a defending region.

    Win probability = attacking_army / (attacking_army + effective_defenders)
    where effective_defenders = defender.army * terrain_defense_bonus.

    Overwhelming force almost always wins. Close fights have real uncertainty.
    Casualties scale with how hard the fight was — a pyrrhic victory is possible.
    """
    defender_army = defender_region.army
    effective_defense = defender_army * defender_region.defense_bonus

    # Edge case: empty region (no defenders)
    if defender_army <= 0:
        return CombatResult(
            attacker_region_id=attacker_region.id,
            defender_region_id=defender_region.id,
            attacker_army=attacking_army,
            defender_army=0,
            effective_defender_army=0.0,
            attacker_won=True,
            survivors=attacking_army,
        )

    if attacking_army <= 0:
        return CombatResult(
            attacker_region_id=attacker_region.id,
            defender_region_id=defender_region.id,
            attacker_army=0,
            defender_army=defender_army,
            effective_defender_army=effective_defense,
            attacker_won=False,
            survivors=defender_army,
        )

    win_prob = attacking_army / (attacking_army + effective_defense)
    attacker_won = rng.random() < win_prob

    if attacker_won:
        # Casualties proportional to how fierce the fight was
        hardness = min(effective_defense / attacking_army, 1.0)
        loss_pct = hardness * rng.uniform(0.25, 0.55)
        losses = int(attacking_army * loss_pct)
        survivors = max(1, attacking_army - losses)
    else:
        # Defender holds with moderate casualties
        loss_pct = (attacking_army / effective_defense) * rng.uniform(0.2, 0.5)
        losses = int(defender_army * min(loss_pct, 0.7))
        survivors = max(1, defender_army - losses)

    return CombatResult(
        attacker_region_id=attacker_region.id,
        defender_region_id=defender_region.id,
        attacker_army=attacking_army,
        defender_army=defender_army,
        effective_defender_army=round(effective_defense, 2),
        attacker_won=attacker_won,
        survivors=survivors,
    )
