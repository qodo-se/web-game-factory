"""Durable campaign snapshots with optimistic turn concurrency.

SQLite for local development; DATABASE_URL selects PostgreSQL via asyncpg.
No mutable engine cache: failed or competing turns cannot leak unsaved changes.
"""
import asyncio
import atexit
import threading
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
_pools = {}
_pool_lock = None
_loop = None
_loop_guard = threading.Lock()


def _database_loop():
    global _loop
    with _loop_guard:
        if _loop is None:
            _loop = asyncio.new_event_loop()
            threading.Thread(target=_loop.run_forever, name='campaign-database', daemon=True).start()
    return _loop


async def _get_pool(url):
    global _pool_lock
    import asyncpg
    if _pool_lock is None:
        _pool_lock = asyncio.Lock()
    async with _pool_lock:
        if url not in _pools:
            _pools[url] = await asyncpg.create_pool(url, min_size=1, max_size=5,
                                                  timeout=10, command_timeout=20)
        return _pools[url]


def close_pools():
    if _loop is None or not _loop.is_running():
        return
    async def close():
        for pool in _pools.values():
            try:
                await asyncio.wait_for(pool.close(), timeout=3)
            except asyncio.TimeoutError:
                pool.terminate()
        _pools.clear()
        _postgres_ready.clear()
    asyncio.run_coroutine_threadsafe(close(), _loop).result(timeout=5)


atexit.register(close_pools)

SCHEMA = '''CREATE TABLE IF NOT EXISTS imperium_campaigns
(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)'''


JOURNAL_SCHEMA = '''CREATE TABLE IF NOT EXISTS imperium_campaign_turns
(game_id TEXT NOT NULL REFERENCES imperium_campaigns(id) ON DELETE CASCADE,
 turn INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (game_id, turn))'''


class ConflictError(Exception):
    pass


def _transaction(statements, check_revision=False):
    """Execute the snapshot CAS and journal inserts in one atomic transaction."""
    url = os.environ.get('DATABASE_URL')
    if url:
        async def query():
            pool = await _get_pool(url)
            async with pool.acquire(timeout=10) as connection:
                async with connection.transaction():
                    if url not in _postgres_ready:
                        await connection.execute('SELECT pg_advisory_xact_lock(721503)')
                        await connection.execute(SCHEMA)
                        await connection.execute(JOURNAL_SCHEMA)
                    results = []
                    for sql, args, fetch in statements:
                        parts = sql.split('?')
                        pg_sql = ''.join(part + (f'${i+1}' if i < len(parts)-1 else '') for i, part in enumerate(parts))
                        if fetch == 'many':
                            await connection.executemany(pg_sql, args)
                            result = len(args)
                        elif fetch:
                            result = [tuple(row) for row in await connection.fetch(pg_sql, *args)]
                        else:
                            result = int((await connection.execute(pg_sql, *args)).split()[-1])
                        if check_revision and not results and result != 1:
                            raise ConflictError('This turn was already resolved in another request. Reload the campaign to continue.')
                        results.append(result)
                _postgres_ready.add(url)
                return results
        return asyncio.run_coroutine_threadsafe(query(), _database_loop()).result()
    if os.environ.get('K_SERVICE'):
        raise RuntimeError('DATABASE_URL is required on Cloud Run for durable campaign saves.')
    path = Path(os.environ.get('IMPERIUM_DB_PATH', str(Path(__file__).resolve().parents[3] / '.local/imperium.sqlite3')))
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path, timeout=20)) as connection:
        connection.execute('PRAGMA foreign_keys = ON')
        with connection:
            connection.execute(SCHEMA)
            connection.execute(JOURNAL_SCHEMA)
            results = []
            for sql, args, fetch in statements:
                cursor = connection.executemany(sql, args) if fetch == 'many' else connection.execute(sql, args)
                result = cursor.fetchall() if fetch is True else cursor.rowcount
                if check_revision and not results and result != 1:
                    raise ConflictError('This turn was already resolved in another request. Reload the campaign to continue.')
                results.append(result)
            return results


def _execute(sql, args=(), fetch=False):
    return _transaction([(sql, args, fetch)])[0]


def _encode(engine, journal=False):
    return json.dumps({'schema': 2 if journal else 1, 'state': asdict(engine.state),
                       'name': engine.campaign_name, 'history': [] if journal else engine.history,
                       'journal': journal, 'replay_start': getattr(engine, '_replay_start', None),
                       'replay_indexed': getattr(engine, '_replay_indexed', False),
                       'seed': engine._base_seed}, separators=(',', ':'), default=lambda value: value.value)


def _decode(payload):
    data = json.loads(payload)
    if data.get('schema') not in (1, 2):
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
    engine._journal = data.get('journal', False)
    engine._replay_start = data.get('replay_start')
    engine._replay_indexed = data.get('replay_indexed', False)
    return engine


def _journal_inserts(game_id, entries):
    rows = [(game_id, entry['turn'], json.dumps(entry, separators=(',', ':'))) for entry in entries]
    return [('INSERT INTO imperium_campaign_turns (game_id, turn, payload) VALUES (?, ?, ?)', rows, 'many')] if rows else []


def _index_replay(engine):
    # Only advertise direct snapshot access for a verified, contiguous journal.
    from games.borderstrife.engine.replay import _restore
    start = engine.state.turn
    for entry in reversed(engine.history):
        if entry.get('turn') != start-1 or 'replay_before' not in entry:
            return None
        try:
            restored = _restore(engine.state, entry['replay_before'])
            if restored.turn != entry['turn']:
                return None
        except (KeyError, ValueError, TypeError):
            return None
        start -= 1
    return start


def history_page(game_id, engine, before_turn, limit):
    before_turn = min(before_turn, engine.state.turn)
    if engine._journal:
        rows = _execute('SELECT payload FROM imperium_campaign_turns WHERE game_id = ? AND turn < ? ORDER BY turn DESC LIMIT ?',
                        (game_id, before_turn, limit), True)
        return [json.loads(row[0]) for row in reversed(rows)]
    return [entry for entry in engine.history if entry['turn'] < before_turn][-limit:]


def create(engine):
    engine._replay_start = _index_replay(engine)
    engine._replay_indexed = True
    game_id = uuid.uuid4().hex
    _transaction([('INSERT INTO imperium_campaigns (id, revision, payload, updated_at) VALUES (?, ?, ?, ?)',
                  (game_id, engine.state.turn, _encode(engine, journal=True), datetime.now(timezone.utc).isoformat()), False)]
                 + _journal_inserts(game_id, engine.history))
    engine._journal = True
    return game_id


def get(game_id, include_history=True):
    rows = _execute('SELECT payload FROM imperium_campaigns WHERE id = ?', (game_id,), fetch=True)
    if not rows:
        return None
    engine = _decode(rows[0][0])
    if engine._journal and include_history:
        # A concurrent turn may commit between reads. Its entry belongs to a
        # newer snapshot and must not appear in this response's history.
        entries = _execute('SELECT payload FROM imperium_campaign_turns WHERE game_id = ? AND turn < ? ORDER BY turn',
                           (game_id, engine.state.turn), fetch=True)
        engine.history = [json.loads(row[0]) for row in entries]
    return engine


def save(game_id, engine, expected_turn):
    # Old inline histories migrate once, in the same transaction as the turn.
    # Subsequent turns append only their new entry, independent of campaign age.
    if not getattr(engine, '_replay_indexed', False):
        from copy import copy
        index_engine = copy(engine)
        if getattr(engine, '_journal', False):
            previous = get(game_id)
            if previous is None:
                raise ConflictError('This campaign no longer exists. Reload to continue.')
            index_engine.history = previous.history + [entry for entry in engine.history if entry['turn'] >= expected_turn]
        engine._replay_start = _index_replay(index_engine)
        engine._replay_indexed = True
    entries = ([entry for entry in engine.history if entry['turn'] >= expected_turn]
               if getattr(engine, '_journal', False) else engine.history)
    _transaction([('UPDATE imperium_campaigns SET revision = ?, payload = ?, updated_at = ? WHERE id = ? AND revision = ?',
                   (engine.state.turn, _encode(engine, journal=True), datetime.now(timezone.utc).isoformat(), game_id, expected_turn), False)]
                 + _journal_inserts(game_id, entries), check_revision=True)
    engine._journal = True


def delete(game_id):
    _execute('DELETE FROM imperium_campaigns WHERE id = ?', (game_id,))
