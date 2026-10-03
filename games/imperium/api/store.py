"""In-memory game session store. Keyed by full UUID game_id."""
import time
import uuid
from typing import Dict, Optional

from games.imperium.engine.game_engine import GameEngine

_MAX_SESSIONS = 100
_SESSION_TTL  = 3600  # seconds — evict idle/stale sessions after 1 hour

_sessions: Dict[str, dict] = {}  # game_id -> {"engine": ..., "ts": monotonic}


def _evict() -> None:
    cutoff = time.monotonic() - _SESSION_TTL
    stale = [gid for gid, v in _sessions.items() if v["ts"] < cutoff or v["engine"].state.game_over]
    for gid in stale:
        del _sessions[gid]


def create(engine: GameEngine) -> str:
    _evict()
    if len(_sessions) >= _MAX_SESSIONS:
        raise RuntimeError("Server is at capacity. Please try again later.")
    game_id = uuid.uuid4().hex  # full 128-bit ID
    _sessions[game_id] = {"engine": engine, "ts": time.monotonic()}
    return game_id


def get(game_id: str) -> Optional[GameEngine]:
    entry = _sessions.get(game_id)
    if entry is None:
        return None
    entry["ts"] = time.monotonic()  # refresh TTL on access
    return entry["engine"]


def delete(game_id: str) -> None:
    _sessions.pop(game_id, None)
