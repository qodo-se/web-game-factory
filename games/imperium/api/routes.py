import threading
from dataclasses import asdict
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from games.imperium.engine.game_engine import GameEngine
from games.imperium.engine.models import MapSize, Move, TurnActions
from games.imperium.engine.presets import list_presets
from games.imperium.engine.strategy import supplied_regions, growth, defense_factor, forecast
from games.imperium.engine.turn_resolver import validate_actions, ValidationError
from games.imperium.api import store

router = APIRouter(prefix="/api/imperium", tags=["imperium"])

# Bounded locks prevent duplicate work within one process; database CAS also
# protects against simultaneous requests handled by different Cloud Run instances.
_game_locks = [threading.Lock() for _ in range(64)]


def _get_game_lock(game_id):
    return _game_locks[hash(game_id) % len(_game_locks)]


# ── Request / Response models ─────────────────────────────────────────────────

class NewGameRequest(BaseModel):
    player_name: str = Field(default="Player", max_length=40)
    campaign_name: str = Field(default="", max_length=80)
    mode: str = "preset"          # "preset" | "random"
    preset_id: Optional[str] = "mediterranean"
    map_size: Optional[str] = "small"
    start_region_id: Optional[int] = Field(default=None, ge=0, strict=True)


class MoveIn(BaseModel):
    from_region_id: int
    to_region_id: int


class TurnRequest(BaseModel):
    moves: List[MoveIn] = Field(max_length=100)
    expected_turn: Optional[int] = Field(default=None, ge=1)


# ── Serialisation helpers ─────────────────────────────────────────────────────

def _serialize_state(engine: GameEngine) -> dict:
    s = engine.state
    supplied = supplied_regions(s)
    regions = {
        rid: {
            "id": r.id,
            "name": r.name,
            "terrain": r.terrain.value,
            "owner": r.owner.value,
            "army": r.army,
            "is_capital": r.is_capital,
            "neighbors": r.neighbors,
            "pop_rate": growth(r, supplied),
            "base_pop_rate": r.pop_rate,
            "supplied": r.id in supplied,
            "port": r.id in s.ports,
            "defense_bonus": defense_factor(r, supplied),
            "x": r.x,
            "y": r.y,
        }
        for rid, r in s.regions.items()
    }
    p1 = s.get_player("player_1")
    p2 = s.get_player("player_2")
    return {
        "turn": s.turn,
        "preset_id": s.preset_id,
        "routes": s.routes,
        "campaign_name": engine.campaign_name,
        "game_over": s.game_over,
        "winner": s.winner,
        "regions": regions,
        "player_1": {
            "name": p1.name,
            "regions": s.region_count("player_1"),
            "total_army": s.total_army("player_1"),
            "capital": p1.capital_region_id,
        },
        "player_2": {
            "name": p2.name,
            "regions": s.region_count("player_2"),
            "total_army": s.total_army("player_2"),
            "capital": p2.capital_region_id,
        },
        "rogue_regions": len(s.rogue_regions()),
    }


def _serialize_summary(summary, state_after: dict) -> dict:
    combat = [asdict(c) for c in summary.combat_results]
    return {
        "turn": summary.turn,
        "combat_results": combat,
        "events": summary.events,
        "movements": [
            {"from": m[0], "to": m[1], "army": m[2]}
            for m in summary.movements
        ],
        "game_over": summary.game_over,
        "winner": summary.winner,
        "state": state_after,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/presets")
def get_presets():
    return list_presets()


@router.get("/presets/{preset_id}/starts")
def get_starts(preset_id: str):
    from games.imperium.engine.presets import PRESETS
    from games.imperium.engine.presets.starts import starting_choices
    if preset_id not in PRESETS:
        raise HTTPException(status_code=404, detail="Map not found.")
    return starting_choices(PRESETS[preset_id])


@router.post("/games")
def new_game(req: NewGameRequest):
    try:
        if req.mode == "preset":
            engine = GameEngine.from_preset(
                preset_id=req.preset_id,
                start_region_id=req.start_region_id,
                player1_name=req.player_name,
                player2_name="AI",
                player1_is_ai=False,
                player2_is_ai=True,
            )
        else:
            if req.start_region_id is not None:
                raise ValueError("Starting kingdoms are available on preset maps.")
            size_map = {"small": MapSize.SMALL, "medium": MapSize.MEDIUM, "large": MapSize.LARGE}
            engine = GameEngine.new_game(
                map_size=size_map.get(req.map_size, MapSize.SMALL),
                player1_name=req.player_name,
                player2_name="AI",
                player1_is_ai=False,
                player2_is_ai=True,
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    engine.campaign_name = req.campaign_name.strip() or f"{req.player_name} — {(req.preset_id or 'Random map').replace('_', ' ').title() if req.mode == 'preset' else 'Random map'}"
    game_id = store.create(engine)
    return {"game_id": game_id, "state": _serialize_state(engine), "history": engine.history}


@router.get("/games/{game_id}")
def get_game(game_id: str):
    engine = store.get(game_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found.")
    return {"game_id": game_id, "state": _serialize_state(engine), "history": engine.history}


@router.get("/games/{game_id}/valid-moves")
def get_valid_moves(game_id: str):
    engine = store.get(game_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found.")
    return engine.get_valid_moves("player_1")


@router.post("/games/{game_id}/forecast")
def get_forecast(game_id: str, req: TurnRequest):
    engine = store.get(game_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found.")
    moves = [Move(m.from_region_id, m.to_region_id) for m in req.moves]
    try:
        validate_actions(engine.state, TurnActions('player_1', moves))
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return {'turn': engine.state.turn, 'forecasts': forecast(engine.state, moves)}


@router.post("/games/{game_id}/threats")
def get_threats(game_id: str, req: TurnRequest):
    from games.imperium.engine.strategy import threats
    engine = store.get(game_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found.")
    moves = [Move(m.from_region_id, m.to_region_id) for m in req.moves]
    try:
        validate_actions(engine.state, TurnActions('player_1', moves))
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return threats(engine.state, moves)


@router.post("/games/{game_id}/turn")
def submit_turn(game_id: str, req: TurnRequest):
    with _get_game_lock(game_id):
        engine = store.get(game_id)
        if not engine:
            raise HTTPException(status_code=404, detail="Game not found.")
        if engine.state.game_over:
            raise HTTPException(status_code=400, detail="Game is already over.")
        if req.expected_turn is None:
            raise HTTPException(status_code=400, detail="Refresh the game page before submitting a turn.")
        if req.expected_turn != engine.state.turn:
            raise HTTPException(status_code=409, detail="This turn was already resolved. Reload to continue from the saved turn.")
        actions = TurnActions('player_1', [Move(m.from_region_id, m.to_region_id) for m in req.moves])
        try:
            engine.submit_actions('player_1', actions)
        except (ValueError, ValidationError) as error:
            raise HTTPException(status_code=400, detail=str(error))
        summary = engine.resolve_turn()
        result = _serialize_summary(summary, _serialize_state(engine))
        # Persist the state and journal together; only return success after commit.
        engine.history.append({key: value for key, value in result.items() if key != 'state'})
        try:
            store.save(game_id, engine, req.expected_turn)
        except store.ConflictError as error:
            raise HTTPException(status_code=409, detail=str(error))
        return result
