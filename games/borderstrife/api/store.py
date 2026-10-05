"""Durable campaign snapshots with optimistic turn concurrency.

SQLite for local development; DATABASE_URL selects PostgreSQL via asyncpg.
No mutable engine cache: failed or competing turns cannot leak unsaved changes.
"""
import asyncio
from contextlib import closing
from dataclasses import asdict
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import uuid

from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import GameState, Region, Player, TerrainType, Owner, MapSize

_postgres_ready = set()

SCHEMA = '''CREATE TABLE IF NOT EXISTS imperium_campaigns
(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)'''


class ConflictError(Exception):
    pass


def _execute(sql, args=(), fetch=False):
    url = os.environ.get('DATABASE_URL')
    if url:
        async def query():
            import asyncpg
            connection = await asyncpg.connect(url, timeout=10, command_timeout=20)
            try:
                if url not in _postgres_ready:
                    # Different workers may create their first campaign together.
                    async with connection.transaction():
                        await connection.execute('SELECT pg_advisory_xact_lock(721503)')
                        await connection.execute(SCHEMA)
                    _postgres_ready.add(url)
                parts = sql.split('?')
                pg_sql = ''.join(part + (f'${i+1}' if i < len(parts)-1 else '') for i, part in enumerate(parts))
                if fetch:
                    return [tuple(row) for row in await connection.fetch(pg_sql, *args)]
                result = await connection.execute(pg_sql, *args)
                return int(result.split()[-1])
            finally:
                await connection.close()
        return asyncio.run(query())
    if os.environ.get('K_SERVICE'):
        raise RuntimeError('DATABASE_URL is required on Cloud Run for durable campaign saves.')
    path = Path(os.environ.get('IMPERIUM_DB_PATH', str(Path(__file__).resolve().parents[3] / '.local/imperium.sqlite3')))
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path, timeout=20)) as connection:
        with connection:
            connection.execute(SCHEMA)
            cursor = connection.execute(sql, args)
            return cursor.fetchall() if fetch else cursor.rowcount


def _encode(engine):
    return json.dumps({'schema': 1, 'state': asdict(engine.state),
                       'name': engine.campaign_name, 'history': engine.history,
                       'seed': engine._base_seed}, separators=(',', ':'), default=lambda value: value.value)


def _decode(payload):
    data = json.loads(payload)
    if data.get('schema') != 1:
        raise ValueError('Unsupported campaign save version')
    raw = data['state']
    # India was renamed without changing IDs, borders or rules. Upgrade only
    # known old labels so existing campaigns still match the bundled atlas.
    if raw.get('preset_id') == 'india':
        from games.borderstrife.engine.presets.india import PRESET, LEGACY_REGION_NAMES
        if len(raw['regions']) == len(PRESET['regions']):
            for rid, old_name in LEGACY_REGION_NAMES.items():
                region = raw['regions'].get(str(rid))
                if region and region['name'] == old_name:
                    region['name'] = PRESET['regions'][rid][0]
    raw['regions'] = {int(key): Region(**{**region, 'terrain': TerrainType(region['terrain']),
                                         'owner': Owner(region['owner'])}) for key, region in raw['regions'].items()}
    raw['players'] = [Player(**player) for player in raw['players']]
    raw['map_size'] = MapSize(raw['map_size'])
    engine = GameEngine(GameState(**raw), seed=data.get('seed'))
    engine.campaign_name = data['name']
    engine.history = data.get('history', [])
    return engine


def create(engine):
    game_id = uuid.uuid4().hex
    _execute('INSERT INTO imperium_campaigns (id, revision, payload, updated_at) VALUES (?, ?, ?, ?)',
             (game_id, engine.state.turn, _encode(engine), datetime.now(timezone.utc).isoformat()))
    return game_id


def get(game_id):
    rows = _execute('SELECT payload FROM imperium_campaigns WHERE id = ?', (game_id,), fetch=True)
    return _decode(rows[0][0]) if rows else None


def save(game_id, engine, expected_turn):
    changed = _execute('UPDATE imperium_campaigns SET revision = ?, payload = ?, updated_at = ? WHERE id = ? AND revision = ?',
                       (engine.state.turn, _encode(engine), datetime.now(timezone.utc).isoformat(), game_id, expected_turn))
    if changed != 1:
        raise ConflictError('This turn was already resolved in another request. Reload the campaign to continue.')


def delete(game_id):
    _execute('DELETE FROM imperium_campaigns WHERE id = ?', (game_id,))
