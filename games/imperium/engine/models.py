from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple


class MapSize(Enum):
    SMALL = "small"    # 36 regions
    MEDIUM = "medium"  # 48 regions
    LARGE = "large"    # 60 regions


MAP_REGION_COUNT: Dict[str, int] = {
    MapSize.SMALL: 36,
    MapSize.MEDIUM: 48,
    MapSize.LARGE: 60,
}


class TerrainType(Enum):
    CITY = "city"
    PLAINS = "plains"
    HILLS = "hills"
    DESERT = "desert"
    FOREST = "forest"
    COAST = "coast"


class Owner(Enum):
    ROGUE = "rogue"
    PLAYER_1 = "player_1"
    PLAYER_2 = "player_2"


# Population units generated per turn (player regions: 100%, rogue: 70%)
TERRAIN_POP_RATE: Dict[TerrainType, int] = {
    TerrainType.CITY: 12,
    TerrainType.COAST: 5,
    TerrainType.PLAINS: 4,
    TerrainType.FOREST: 3,
    TerrainType.HILLS: 2,
    TerrainType.DESERT: 1,
}

# Multiplier applied to defender army during combat
TERRAIN_DEFENSE_BONUS: Dict[TerrainType, float] = {
    TerrainType.CITY: 1.8,
    TerrainType.HILLS: 1.75,
    TerrainType.FOREST: 1.5,
    TerrainType.DESERT: 1.25,
    TerrainType.PLAINS: 1.0,
    TerrainType.COAST: 1.0,
}

# Starting army = pop_rate * BASE_STARTING_POP
BASE_STARTING_POP = 8
# Rogue militia = 70% of full army
ROGUE_MILITIA_RATIO = 0.7


@dataclass
class Region:
    id: int
    name: str
    terrain: TerrainType
    owner: Owner
    army: int
    neighbors: List[int] = field(default_factory=list)
    is_capital: bool = False
    x: float = 0.0
    y: float = 0.0

    reinforcement_rate: Optional[int] = None

    @property
    def pop_rate(self) -> int:
        return self.reinforcement_rate if self.reinforcement_rate is not None else TERRAIN_POP_RATE[self.terrain]

    @property
    def defense_bonus(self) -> float:
        return TERRAIN_DEFENSE_BONUS[self.terrain]

    def __repr__(self) -> str:
        capital = " [CAPITAL]" if self.is_capital else ""
        return (
            f"Region({self.id}, {self.name!r}, {self.terrain.value}, "
            f"owner={self.owner.value}, army={self.army}{capital})"
        )


@dataclass
class Move:
    """Send all troops from from_region to to_region."""
    from_region_id: int
    to_region_id: int


@dataclass
class TurnActions:
    player_id: str
    moves: List[Move] = field(default_factory=list)


@dataclass
class CombatResult:
    attacker_region_id: int
    defender_region_id: int
    attacker_army: int        # troops committed to attack
    defender_army: int        # troops defending before combat
    effective_defender_army: float  # after terrain multiplier
    attacker_won: bool
    survivors: int            # troops that occupy the region after battle
    attacker_survivors: int = 0
    defender_survivors: int = 0
    attacker_owner: str = ''
    defender_owner: str = ''
    retreat_region_id: Optional[int] = None
    retreated: int = 0
    battle_details: dict = field(default_factory=dict)


@dataclass
class TurnSummary:
    turn: int
    population_generated: Dict[int, int]              # region_id -> pop added
    movements: List[Tuple[int, int, int]]              # (from, to, army_size)
    combat_results: List[CombatResult]
    game_over: bool
    winner: Optional[str]
    events: List[dict] = field(default_factory=list)


@dataclass
class Player:
    id: str
    name: str
    is_ai: bool
    capital_region_id: int


@dataclass
class GameState:
    regions: Dict[int, Region]
    players: List[Player]
    turn: int
    map_size: MapSize
    winner: Optional[str] = None
    game_over: bool = False
    preset_id: Optional[str] = None
    routes: Dict[str, str] = field(default_factory=dict)
    ports: List[int] = field(default_factory=list)
    rules_version: int = 2
    battle: Optional[dict] = None
    map_asset_id: Optional[str] = None

    def get_player(self, player_id: str) -> Optional[Player]:
        for p in self.players:
            if p.id == player_id:
                return p
        return None

    def owned_regions(self, player_id: str) -> List[Region]:
        owner = Owner(player_id)
        return [r for r in self.regions.values() if r.owner == owner]

    def rogue_regions(self) -> List[Region]:
        return [r for r in self.regions.values() if r.owner == Owner.ROGUE]

    def total_army(self, player_id: str) -> int:
        return sum(r.army for r in self.owned_regions(player_id))

    def region_count(self, player_id: str) -> int:
        return len(self.owned_regions(player_id))

    def is_adjacent(self, region_a_id: int, region_b_id: int) -> bool:
        return region_b_id in self.regions[region_a_id].neighbors
