import threading
import logging
import hashlib
import json
from collections import OrderedDict
from time import perf_counter
from pathlib import Path
import re
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
from games.borderstrife.engine.replay import snapshot, campaign_states, reverse_campaign_states, _restore
from games.borderstrife.engine import standing_orders

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/imperium", tags=["imperium"])

# Bounded locks prevent duplicate work within one process; database CAS also
# protects against simultaneous requests handled by different Cloud Run instances.
_game_locks = [threading.Lock() for _ in range(64)]


def _get_game_lock(game_id):
    return _game_locks[hash(game_id) % len(_game_locks)]


def _load_game(game_id, include_history=True):
    engine = store.get(game_id, include_history=include_history)
    if engine is not None:
        asset = engine.state.map_asset_id or engine.state.preset_id
        if asset and (not re.fullmatch(r'[a-z0-9_]+', asset) or
                      not (Path(__file__).parents[1] / 'ui/maps' / f'{asset}.json').is_file()):
            raise HTTPException(status_code=410, detail="This map has been retired. Please start a new game on a Regional Map.")
    return engine


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

def _draw_offer_history(state):
    if state.draw_offers:
        return state.draw_offers
    # Preserve the latest offer from saves written before offer history existed.
    if state.draw_offer_turn is not None:
        return [{'turn': state.draw_offer_turn, 'accepted': state.winner == 'draw',
                 'message': state.draw_offer_message}]
    return []


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
        "resigned": s.resigned,
        "draw_offers": _draw_offer_history(s),
        "draw_offer_turn": s.draw_offer_turn,
        "draw_offer_message": s.draw_offer_message,
        "draw_available_turn": max(30, (s.draw_offer_turn + 5) if s.draw_offer_turn is not None else 30),
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
        except backups.UnavailableMapError:
            raise HTTPException(status_code=400, detail="This save uses a map that is no longer available. Only Regional Maps are supported.")
        except (ValueError, TypeError, KeyError, AttributeError, RecursionError, OverflowError):
            raise HTTPException(status_code=400, detail="This is not a valid supported BorderStrife save. Choose an unmodified downloaded .borderstrife.json file.")
        game_id = store.create(engine)
        return {"game_id": game_id, "state": _serialize_state(engine)}

    return await run_in_threadpool(restore)


@router.get("/games/{game_id}/download")
def download_game(game_id: str):
    engine = _load_game(game_id)
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
    engine = _load_game(game_id, include_history=history_limit is None)
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
    engine = _load_game(game_id, include_history=False)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
    entries = store.history_page(game_id, engine, before_turn, limit+1)
    return {'history': [_public_report(entry) for entry in entries[-limit:]], 'more': len(entries)>limit}





@router.get("/games/{game_id}/valid-moves")
def get_valid_moves(game_id: str):
    engine = _load_game(game_id, include_history=False)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
    return engine.get_valid_moves("player_1")


@router.post("/games/{game_id}/forecast")
def get_forecast(game_id: str, req: TurnRequest):
    engine = _load_game(game_id, include_history=False)
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
    engine = _load_game(game_id, include_history=False)
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
        engine = _load_game(game_id, include_history=False)
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
_legacy_rebuild_locks = [threading.Lock() for _ in range(64)]
_LEGACY_CACHE_BYTES = 16 * 1024 * 1024


def _legacy_replay_page(game_id, engine, offset, limit):
    # Replay cache fills must never contend with live turn/draw/resign locks.
    with _legacy_rebuild_locks[hash(game_id) % len(_legacy_rebuild_locks)]:
        return _legacy_replay_page_locked(game_id, engine, offset, limit)


def _legacy_replay_page_locked(game_id, engine, offset, limit):
    if getattr(engine, 'expires_at', None) is not None and engine.expires_at <= store.now():
        raise HTTPException(status_code=404, detail="Game not found or expired.")
    signature = hashlib.sha256(store._encode(engine, journal=True).encode()).digest()
    key = (game_id, signature)
    with _legacy_replay_lock:
        cached = _legacy_replays.get(key)
        if cached is not None:
            _legacy_replays.move_to_end(key)
    if cached is None:
        if engine._journal:
            engine = _load_game(game_id)
            if engine is None:
                raise HTTPException(status_code=404, detail="Game not found or expired. Games are kept for 7 days. Restore a downloaded save from Resume game.")
        reports = {entry['turn']: entry for entry in engine.history}
        def encode_position(position):
            report = reports.get(position.turn-1)
            return json.dumps({'frame': _replay_frame(position),
                               'report': _public_report(report) if report is not None else None},
                              separators=(',', ':')).encode()
        entries, size, oversized, total = [], 0, False, 0
        for position in reverse_campaign_states(engine):
            total += 1
            if not oversized:
                encoded = encode_position(position)
                size += len(encoded)
                if size > _LEGACY_CACHE_BYTES:
                    oversized = True
                    entries.clear()
                else:
                    entries.append(encoded)
        complete = position.turn == 1
        if offset >= total:
            raise HTTPException(status_code=400, detail="Replay position out of range.")
        if oversized:
            # Count the recoverable suffix first, then retain only the requested
            # page. Very large old saves trade another traversal for bounded RAM.
            page = []
            for reverse_index, position in enumerate(reverse_campaign_states(engine)):
                index = total - reverse_index - 1
                if index < offset:
                    break
                if index < offset + limit:
                    page.append(json.loads(encode_position(position)))
            page.reverse()
            return _legacy_page_response(page, offset, total, complete)
        entries.reverse()
        cached = (complete, tuple(entries), size)
        with _legacy_replay_lock:
            _legacy_replays[key] = cached
            _legacy_replays.move_to_end(key)
            while len(_legacy_replays) > 4 or sum(item[2] for item in _legacy_replays.values()) > _LEGACY_CACHE_BYTES:
                _legacy_replays.popitem(last=False)
    complete, entries, _ = cached
    if offset >= len(entries):
        raise HTTPException(status_code=400, detail="Replay position out of range.")
    page = [json.loads(entry) for entry in entries[offset:offset+limit]]
    return _legacy_page_response(page, offset, len(entries), complete)


def _legacy_page_response(page, offset, total, complete):
    for entry in page:
        entry['frame']['regions'] = {int(rid): region for rid, region in entry['frame']['regions'].items()}
    return {'frames': [entry['frame'] for entry in page],
            'history': [entry['report'] for entry in page if entry['report'] is not None],
            'offset': offset, 'total': total, 'complete': complete}


@router.get("/games/{game_id}/replay")
def get_campaign_replay(game_id: str, offset: Annotated[Optional[int], Query(ge=0)] = None,
                        limit: Annotated[int, Query(ge=1, le=100)] = 50):
    engine = _load_game(game_id, include_history=offset is None)
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


class DrawRequest(BaseModel):
    expected_turn: int = Field(ge=1, strict=True)


@router.post('/games/{game_id}/draw')
def offer_draw(game_id: str, req: DrawRequest):
    from games.borderstrife.engine.draw_offers import assess
    with _get_game_lock(game_id):
        engine = _load_game(game_id, include_history=False)
        if engine is None:
            raise HTTPException(404, 'Game not found or expired.')
        state = engine.state
        if state.game_over:
            raise HTTPException(400, 'Game is already over.')
        if state.turn != req.expected_turn:
            raise HTTPException(409, 'This campaign changed. Reload before offering a draw.')
        available = max(30, state.draw_offer_turn + 5 if state.draw_offer_turn is not None else 30)
        if state.turn < available:
            raise HTTPException(400, f'You can offer a draw on turn {available}.')
        accepted, message = assess(state, store.history_page(game_id, engine, state.turn, 10))
        state.draw_offers = [*_draw_offer_history(state),
                             {"turn": state.turn, "accepted": accepted, "message": message}]
        state.draw_offer_turn = state.turn
        state.draw_offer_message = message
        if accepted:
            state.game_over = True
            state.winner = 'draw'
        try:
            store.save(game_id, engine, req.expected_turn)
        except store.ConflictError as error:
            raise HTTPException(409, str(error))
        return {'accepted': accepted, 'message': message, 'state': _serialize_state(engine)}


@router.post('/games/{game_id}/resign')
def resign_game(game_id: str, req: DrawRequest):
    with _get_game_lock(game_id):
        engine = _load_game(game_id, include_history=False)
        if engine is None:
            raise HTTPException(404, 'Game not found or expired.')
        state = engine.state
        if state.game_over:
            raise HTTPException(400, 'Game is already over.')
        if state.turn != req.expected_turn:
            raise HTTPException(409, 'This campaign changed. Reload before resigning.')
        state.game_over = True
        state.winner = 'player_2'
        state.resigned = True
        try:
            store.save(game_id, engine, req.expected_turn)
        except store.ConflictError as error:
            raise HTTPException(409, str(error))
        return {'state': _serialize_state(engine)}
