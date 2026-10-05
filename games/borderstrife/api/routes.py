import threading
import logging
import hashlib
import json
from collections import OrderedDict
from time import perf_counter
from dataclasses import asdict
from typing import Dict, List, Optional, Literal, Annotated
from fastapi import APIRouter, HTTPException, Response, Query, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from games.borderstrife.api import backups

from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import Move, TurnActions
from games.borderstrife.engine.presets import list_presets
from games.borderstrife.engine.strategy import supplied_regions, growth, defense_factor, forecast
from games.borderstrife.engine.turn_resolver import validate_actions, ValidationError
from games.borderstrife.api import store
from games.borderstrife.engine.replay import snapshot, campaign_states, _restore
from games.borderstrife.engine import standing_orders

logger = logging.getLogger(__name__)

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
    mode: Literal["preset"] = "preset"
    preset_id: str = "mediterranean"
    start_region_id: Optional[int] = Field(default=None, ge=0, strict=True)


class MoveIn(BaseModel):
    from_region_id: int
    to_region_id: int


class StandingOrderIn(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    kind: Literal["reinforce"]
    path: List[int] = Field(min_length=2, max_length=2)
    paused: bool = False


class TurnRequest(BaseModel):
    moves: List[MoveIn] = Field(max_length=100)
    standing_orders: Optional[List[StandingOrderIn]] = Field(default=None, max_length=100)
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
        "expires_at": getattr(engine, "expires_at", None),
        "battle": s.battle,
        "preset_id": s.preset_id,
        "map_asset_id": s.map_asset_id or s.preset_id,
        "routes": s.routes,
        "standing_orders": standing_orders.normalize(s.standing_orders),
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
    from games.borderstrife.engine.presets import PRESETS
    from games.borderstrife.engine.presets.starts import starting_choices
    if preset_id not in PRESETS:
        raise HTTPException(status_code=404, detail="Map not found.")
    return starting_choices(PRESETS[preset_id])


@router.post("/games")
def new_game(req: NewGameRequest):
    try:
        engine = GameEngine.from_preset(
            preset_id=req.preset_id,
            start_region_id=req.start_region_id,
            player1_name=req.player_name,
            player2_name="AI",
            player1_is_ai=False,
            player2_is_ai=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    engine.campaign_name = req.campaign_name.strip() or f"{req.player_name} — {req.preset_id.replace('_', ' ').title()}"
    game_id = store.create(engine)
    return {"game_id": game_id, "state": _serialize_state(engine), "history": engine.history}


@router.post("/games/restore")
async def restore_game(request: Request):
    # Bound streamed bodies too; Content-Length can be absent or untrusted.
    payload = bytearray()
    async for chunk in request.stream():
        payload.extend(chunk)
        if len(payload) > backups.MAX_BYTES:
            raise HTTPException(status_code=413, detail="Save files must be 16 MB or smaller.")

    def restore():
        try:
            engine = backups.decode(payload)
        except (ValueError, TypeError, KeyError, AttributeError, RecursionError, OverflowError):
            raise HTTPException(status_code=400, detail="This is not a valid supported BorderStrife save. Choose an unmodified downloaded .borderstrife.json file.")
        game_id = store.create(engine)
        return {"game_id": game_id, "state": _serialize_state(engine)}

    return await run_in_threadpool(restore)


@router.get("/games/{game_id}/download")
def download_game(game_id: str):
    engine = store.get(game_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Game not found or expired. Restore an earlier downloaded save from Resume game.")
    try:
        payload = backups.encode(engine)
    except ValueError as error:
        raise HTTPException(status_code=413, detail=str(error))
    return Response(content=payload, media_type="application/json", headers={
        "Content-Disposition": 'attachment; filename="campaign.borderstrife.json"',
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    })


@router.get("/games/{game_id}")
def get_game(game_id: str, history_limit: Annotated[Optional[int], Query(ge=1, le=100)] = None):
    engine = store.get(game_id, include_history=history_limit is None)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
    entries = engine.history if history_limit is None else store.history_page(game_id, engine, engine.state.turn, history_limit+1)
    more = history_limit is not None and len(entries) > history_limit
    if history_limit is not None:
        entries = entries[-history_limit:]
    return {"game_id": game_id, "state": _serialize_state(engine),
            "valid_moves": engine.get_valid_moves('player_1'),
            "history": [_public_report(entry) for entry in entries], "history_more": more}


def _public_report(entry):
    return {key: value for key, value in entry.items() if key != 'replay_before'}


@router.get("/games/{game_id}/history")
def get_history(game_id: str, before_turn: Annotated[int, Query(ge=1)],
                limit: Annotated[int, Query(ge=1, le=100)] = 50):
    engine = store.get(game_id, include_history=False)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
    entries = store.history_page(game_id, engine, before_turn, limit+1)
    return {'history': [_public_report(entry) for entry in entries[-limit:]], 'more': len(entries)>limit}





@router.get("/games/{game_id}/valid-moves")
def get_valid_moves(game_id: str):
    engine = store.get(game_id, include_history=False)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
    return engine.get_valid_moves("player_1")


@router.post("/games/{game_id}/forecast")
def get_forecast(game_id: str, req: TurnRequest):
    engine = store.get(game_id, include_history=False)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
    moves = [Move(m.from_region_id, m.to_region_id) for m in req.moves]
    try:
        validate_actions(engine.state, TurnActions('player_1', moves))
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return {'turn': engine.state.turn, 'forecasts': forecast(engine.state, moves)}


@router.post("/games/{game_id}/threats")
def get_threats(game_id: str, req: TurnRequest):
    from games.borderstrife.engine.strategy import threats
    engine = store.get(game_id, include_history=False)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
    moves = [Move(m.from_region_id, m.to_region_id) for m in req.moves]
    try:
        validate_actions(engine.state, TurnActions('player_1', moves))
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return threats(engine.state, moves)


@router.post("/games/{game_id}/turn")
def submit_turn(game_id: str, req: TurnRequest, response: Response = None):
    started = perf_counter()
    with _get_game_lock(game_id):
        locked = perf_counter()
        engine = store.get(game_id, include_history=False)
        loaded = perf_counter()
        if not engine:
            raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
        if engine.state.game_over:
            raise HTTPException(status_code=400, detail="Game is already over.")
        if req.expected_turn is None:
            raise HTTPException(status_code=400, detail="Refresh the game page before submitting a turn.")
        if req.expected_turn != engine.state.turn:
            raise HTTPException(status_code=409, detail="This turn was already resolved. Reload to continue from the saved turn.")
        try:
            orders, moves, running, events = standing_orders.prepare(
                engine.state, [Move(m.from_region_id, m.to_region_id) for m in req.moves],
                None if req.standing_orders is None else [o.model_dump() for o in req.standing_orders])
            engine.submit_actions('player_1', TurnActions('player_1', moves))
        except (ValueError, ValidationError) as error:
            raise HTTPException(status_code=400, detail=str(error))
        replay_before = snapshot(engine.state)
        summary = engine.resolve_turn()
        standing_orders.finish(engine.state, orders, running, summary, events)
        result = _serialize_summary(summary, _serialize_state(engine))
        # Persist the state and journal together; only return success after commit.
        engine.history.append({**{key: value for key, value in result.items() if key != 'state'},
                               'replay_before': replay_before})
        resolved = perf_counter()
        try:
            store.save(game_id, engine, req.expected_turn)
        except store.ConflictError as error:
            raise HTTPException(status_code=409, detail=str(error))
        saved = perf_counter()
        result['valid_moves'] = engine.get_valid_moves('player_1')
        timings = {'lock': (locked-started)*1000, 'load': (loaded-locked)*1000,
                   'resolve': (resolved-loaded)*1000, 'save': (saved-resolved)*1000,
                   'total': (perf_counter()-started)*1000}
        if response is not None:
            response.headers['Server-Timing'] = ', '.join(f'{key};dur={value:.2f}' for key, value in timings.items())
        logger.info('campaign_turn turn=%s timings_ms=%s', req.expected_turn,
                    {key: round(value, 2) for key, value in timings.items()})
        return result


def _replay_frame(position):
    supplied = supplied_regions(position)
    return {'turn': position.turn, 'game_over': position.game_over, 'winner': position.winner,
            **{pid: {'name': position.get_player(pid).name, 'regions': position.region_count(pid),
                      'total_army': position.total_army(pid), 'capital': position.get_player(pid).capital_region_id}
               for pid in ('player_1', 'player_2')},
            'rogue_regions': len(position.rogue_regions()),
            'regions': {rid: {'owner': r.owner.value, 'army': r.army, 'pop_rate': growth(r, supplied),
                              'supplied': rid in supplied, 'defense_bonus': defense_factor(r, supplied)}
                        for rid, r in position.regions.items()}}


# Completed legacy saves do not get another turn on which to build an index.
# Cache serialized frame/report pairs so later pages decode only what they need.
# The byte and entry limits bound resident data independently of campaign length.
_legacy_replays = OrderedDict()
_legacy_replay_lock = threading.Lock()
_LEGACY_CACHE_BYTES = 16 * 1024 * 1024


def _legacy_replay_page(game_id, engine, offset, limit):
    signature = hashlib.sha256(store._encode(engine, journal=True).encode()).digest()
    key = (game_id, signature)
    with _legacy_replay_lock:
        cached = _legacy_replays.get(key)
        if cached is not None:
            _legacy_replays.move_to_end(key)
    if cached is None:
        if engine._journal:
            engine = store.get(game_id)
            if engine is None:
                raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
        reports = {entry['turn']: _public_report(entry) for entry in engine.history}
        positions = campaign_states(engine)
        entries = tuple(json.dumps({'frame': _replay_frame(position),
                                    'report': reports.get(position.turn-1)},
                                   separators=(',', ':')).encode() for position in positions)
        cached = (positions[0].turn == 1, entries, sum(map(len, entries)))
        if cached[2] <= _LEGACY_CACHE_BYTES:
            with _legacy_replay_lock:
                _legacy_replays[key] = cached
                _legacy_replays.move_to_end(key)
                while len(_legacy_replays) > 4 or sum(item[2] for item in _legacy_replays.values()) > _LEGACY_CACHE_BYTES:
                    _legacy_replays.popitem(last=False)
    complete, entries, _ = cached
    if offset >= len(entries):
        raise HTTPException(status_code=400, detail="Replay position out of range.")
    page = [json.loads(entry) for entry in entries[offset:offset+limit]]
    for entry in page:
        entry['frame']['regions'] = {int(rid): region for rid, region in entry['frame']['regions'].items()}
    return {'frames': [entry['frame'] for entry in page],
            'history': [entry['report'] for entry in page if entry['report'] is not None],
            'offset': offset, 'total': len(entries), 'complete': complete}


@router.get("/games/{game_id}/replay")
def get_campaign_replay(game_id: str, offset: Annotated[Optional[int], Query(ge=0)] = None,
                        limit: Annotated[int, Query(ge=1, le=100)] = 50):
    engine = store.get(game_id, include_history=offset is None)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
    if not engine.state.game_over:
        raise HTTPException(status_code=400, detail="Campaign replay is available after the game ends.")
    start = getattr(engine, '_replay_start', None)
    if offset is not None and start is None:
        return _legacy_replay_page(game_id, engine, offset, limit)
    if offset is not None and start is not None:
        total = engine.state.turn-start+1
        first = start+offset
        stop = min(first+limit, engine.state.turn+1)
        if offset >= total:
            raise HTTPException(status_code=400, detail="Replay position out of range.")
        entries = store.history_page(game_id, engine, min(stop, engine.state.turn), limit+1)
        indexed = {entry['turn']: entry for entry in entries}
        positions = [engine.state if turn == engine.state.turn else _restore(engine.state, indexed[turn]['replay_before'])
                     for turn in range(first, stop)]
        reports = [_public_report(entry) for entry in entries if first-1 <= entry['turn'] < stop-1]
    else:
        # Preserve the unpaged API for older clients.
        positions = campaign_states(engine)
        start, total = positions[0].turn, len(positions)
        if offset is not None:
            if offset >= total:
                raise HTTPException(status_code=400, detail="Replay position out of range.")
            positions = positions[offset:offset+limit]
        first, stop = positions[0].turn, positions[-1].turn+1
        reports = [_public_report(entry) for entry in engine.history if first-1 <= entry['turn'] < stop-1]
    return {'frames': [_replay_frame(position) for position in positions], 'complete': start == 1,
            'offset': offset or 0, 'total': total, 'history': reports}
