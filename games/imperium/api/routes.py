import threading
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from games.imperium.engine.game_engine import GameEngine
from games.imperium.engine.models import MapSize, Move, TurnActions
from games.imperium.engine.presets import list_presets
from games.imperium.api import store

router = APIRouter(prefix="/api/imperium", tags=["imperium"])

_game_locks: Dict[str, threading.Lock] = {}
_locks_lock = threading.Lock()


def _get_game_lock(game_id: str) -> threading.Lock:
    with _locks_lock:
        if game_id not in _game_locks:
            _game_locks[game_id] = threading.Lock()
        return _game_locks[game_id]


# ── Request / Response models ─────────────────────────────────────────────────

class NewGameRequest(BaseModel):
    player_name: str = "Player"
    mode: str = "preset"          # "preset" | "random"
    preset_id: Optional[str] = "mediterranean"
    map_size: Optional[str] = "small"


class MoveIn(BaseModel):
    from_region_id: int
    to_region_id: int


class TurnRequest(BaseModel):
    moves: List[MoveIn]


# ── Serialisation helpers ─────────────────────────────────────────────────────

def _serialize_state(engine: GameEngine) -> dict:
    s = engine.state
    regions = {
        rid: {
            "id": r.id,
            "name": r.name,
            "terrain": r.terrain.value,
            "owner": r.owner.value,
            "army": r.army,
            "is_capital": r.is_capital,
            "neighbors": r.neighbors,
            "pop_rate": r.pop_rate,
            "defense_bonus": r.defense_bonus,
            "x": r.x,
            "y": r.y,
        }
        for rid, r in s.regions.items()
    }
    p1 = s.get_player("player_1")
    p2 = s.get_player("player_2")
    return {
        "turn": s.turn,
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
    combat = [
        {
            "attacker_region_id": c.attacker_region_id,
            "defender_region_id": c.defender_region_id,
            "attacker_army": c.attacker_army,
            "defender_army": c.defender_army,
            "effective_defender_army": c.effective_defender_army,
            "attacker_won": c.attacker_won,
            "survivors": c.survivors,
        }
        for c in summary.combat_results
    ]
    return {
        "turn": summary.turn,
        "combat_results": combat,
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


@router.post("/games")
def new_game(req: NewGameRequest):
    try:
        if req.mode == "preset":
            engine = GameEngine.from_preset(
                preset_id=req.preset_id,
                player1_name=req.player_name,
                player2_name="AI",
                player1_is_ai=False,
                player2_is_ai=True,
            )
        else:
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

    game_id = store.create(engine)
    return {"game_id": game_id, "state": _serialize_state(engine)}


@router.get("/games/{game_id}")
def get_game(game_id: str):
    engine = store.get(game_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found.")
    return {"game_id": game_id, "state": _serialize_state(engine)}


@router.get("/games/{game_id}/valid-moves")
def get_valid_moves(game_id: str):
    engine = store.get(game_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found.")
    return engine.get_valid_moves("player_1")


@router.post("/games/{game_id}/turn")
def submit_turn(game_id: str, req: TurnRequest):
    engine = store.get(game_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found.")
    if engine.state.game_over:
        raise HTTPException(status_code=400, detail="Game is already over.")

    actions = TurnActions(
        player_id="player_1",
        moves=[Move(from_region_id=m.from_region_id, to_region_id=m.to_region_id) for m in req.moves],
    )

    lock = _get_game_lock(game_id)
    if not lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A turn is already being processed for this game.")
    try:
        try:
            engine.submit_actions("player_1", actions)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        summary = engine.resolve_turn()
    finally:
        lock.release()

    return _serialize_summary(summary, _serialize_state(engine))
