"""In-memory game session store. Keyed by short UUID game_id."""
import uuid
from typing import Dict, Optional

from games.imperium.engine.game_engine import GameEngine

_sessions: Dict[str, GameEngine] = {}


def create(engine: GameEngine) -> str:
    game_id = uuid.uuid4().hex[:8]
    _sessions[game_id] = engine
    return game_id


def get(game_id: str) -> Optional[GameEngine]:
    return _sessions.get(game_id)


def delete(game_id: str) -> None:
    _sessions.pop(game_id, None)
