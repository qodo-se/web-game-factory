"""
GameEngine — the main public interface for an Imperium game session.

Typical flow:
    engine = GameEngine.new_game(map_size=MapSize.SMALL)

    # Human submits moves; AI resolves automatically
    actions = TurnActions(player_id="player_1", moves=[
        Move(from_region_id=0, to_region_id=5),
    ])
    engine.submit_actions("player_1", actions)
    summary = engine.resolve_turn()
    print(engine.summary())
"""
import random
from typing import Dict, List, Optional

from .ai import decide_actions
from .models import (
    GameState,
    MapSize,
    Move,
    Owner,
    TurnActions,
    TurnSummary,
)
from .turn_resolver import ValidationError, resolve_turn, validate_actions


class GameEngine:
    def __init__(self, state: GameState, seed: Optional[int] = None):
        self.state = state
        self.campaign_name = "Campaign"
        self.history = []
        self._base_seed = seed
        self._pending: Dict[str, TurnActions] = {}

    # ── Construction ──────────────────────────────────────────────────────────

    @classmethod
    def from_preset(
        cls,
        preset_id: str,
        player1_name: str = "Player 1",
        player2_name: str = "Player 2",
        player1_is_ai: bool = False,
        player2_is_ai: bool = True,
        start_region_id: Optional[int] = None,
    ) -> "GameEngine":
        """Load a named real-world map preset (e.g. 'mediterranean', 'europe')."""
        from .presets import PRESETS
        from .presets.loader import load_preset

        if preset_id not in PRESETS:
            available = ", ".join(PRESETS.keys())
            raise ValueError(f"Unknown preset '{preset_id}'. Available: {available}")

        state = load_preset(
            PRESETS[preset_id],
            start_region_id=start_region_id,
            player1_name=player1_name,
            player2_name=player2_name,
            player1_is_ai=player1_is_ai,
            player2_is_ai=player2_is_ai,
        )
        return cls(state=state)

    @classmethod
    def new_game(
        cls,
        map_size: MapSize = MapSize.SMALL,
        player1_name: str = "Player 1",
        player2_name: str = "Player 2",
        player1_is_ai: bool = False,
        player2_is_ai: bool = True,
        seed: Optional[int] = None,
    ) -> "GameEngine":
        """Create a new Imperium game with a freshly generated map."""
        from .map_generator import generate_map

        state = generate_map(
            map_size=map_size,
            seed=seed,
            player1_name=player1_name,
            player2_name=player2_name,
            player1_is_ai=player1_is_ai,
            player2_is_ai=player2_is_ai,
        )
        from .strategy import route_key
        for region in state.regions.values():
            for neighbor in region.neighbors:
                state.routes[route_key(region.id, neighbor)] = 'pass' if 'hills' in (
                    region.terrain.value, state.regions[neighbor].terrain.value) else 'road'
        return cls(state=state, seed=seed)

    # ── Player interaction ────────────────────────────────────────────────────

    def get_valid_moves(self, player_id: str) -> Dict[int, List[int]]:
        """
        Return all valid move destinations for each region the player can move from.
        {region_id: [adjacent_region_id, ...]}
        """
        from .strategy import growth, supplied_regions
        owner = Owner(player_id)
        supplied = supplied_regions(self.state)
        return {
            r.id: r.neighbors
            for r in self.state.regions.values()
            if r.owner == owner and r.army + growth(r, supplied) > 0
        }

    def submit_actions(self, player_id: str, actions: TurnActions) -> None:
        """
        Submit a human player's actions for this turn.
        Validates immediately; raises ValidationError on illegal moves.
        """
        if self.state.game_over:
            raise ValueError("Game is already over.")
        if actions.player_id != player_id:
            raise ValueError("actions.player_id does not match player_id.")
        validate_actions(self.state, actions)
        self._pending[player_id] = actions

    def resolve_turn(self, seed: Optional[int] = None) -> TurnSummary:
        """
        Resolve the current turn. AI players have their actions auto-generated.
        Human players must have called submit_actions() first.

        Returns a TurnSummary with full detail of what happened.
        """
        if self.state.game_over:
            raise ValueError("Game is already over.")

        # Auto-generate actions for AI players
        for player in self.state.players:
            if player.is_ai and player.id not in self._pending:
                ai_seed = self._ai_seed()
                self._pending[player.id] = decide_actions(
                    self.state, player.id, seed=ai_seed
                )

        # Ensure all players have submitted
        missing = [p.id for p in self.state.players if p.id not in self._pending]
        if missing:
            raise ValueError(f"Waiting for actions from: {missing}")

        p1_actions = self._pending.get("player_1", TurnActions(player_id="player_1"))
        p2_actions = self._pending.get("player_2", TurnActions(player_id="player_2"))

        combat_seed = seed if seed is not None else random.randint(0, 10**9)
        summary = resolve_turn(
            state=self.state,
            player1_actions=p1_actions,
            player2_actions=p2_actions,
            seed=combat_seed,
        )
        self._pending.clear()
        return summary

    # ── State queries ─────────────────────────────────────────────────────────

    def get_state(self) -> GameState:
        return self.state

    def summary(self) -> dict:
        """Human-readable game state summary."""
        s = self.state
        return {
            "turn": s.turn,
            "map_size": s.map_size.value,
            "game_over": s.game_over,
            "winner": s.winner,
            "player_1": {
                "name": s.get_player("player_1").name,
                "regions": s.region_count("player_1"),
                "total_army": s.total_army("player_1"),
                "capital": s.get_player("player_1").capital_region_id,
            },
            "player_2": {
                "name": s.get_player("player_2").name,
                "regions": s.region_count("player_2"),
                "total_army": s.total_army("player_2"),
                "capital": s.get_player("player_2").capital_region_id,
            },
            "rogue_regions": len(s.rogue_regions()),
        }

    def region_detail(self, region_id: int) -> dict:
        """Serialisable detail for a single region (for UI consumption)."""
        r = self.state.regions[region_id]
        return {
            "id": r.id,
            "name": r.name,
            "terrain": r.terrain.value,
            "owner": r.owner.value,
            "army": r.army,
            "is_capital": r.is_capital,
            "pop_rate": r.pop_rate,
            "defense_bonus": r.defense_bonus,
            "neighbors": r.neighbors,
            "x": r.x,
            "y": r.y,
        }

    def full_map(self) -> List[dict]:
        """All regions serialised — useful for initial UI render."""
        return [self.region_detail(rid) for rid in sorted(self.state.regions)]

    # ── Internals ─────────────────────────────────────────────────────────────

    def _ai_seed(self) -> int:
        if self._base_seed is not None:
            return self._base_seed + self.state.turn * 997
        return random.randint(0, 10**9)
