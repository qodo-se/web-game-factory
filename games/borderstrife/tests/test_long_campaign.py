"""Long-history persistence stays bounded; journal and snapshot commit atomically."""
import json
import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi import Response
from games.borderstrife.api import store
from games.borderstrife.api.routes import submit_turn, TurnRequest
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.replay import snapshot


class LongCampaignTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'IMPERIUM_DB_PATH': self.temp.name+'/test.db', 'DATABASE_URL': ''})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def engine(self, turns=350):
        engine = GameEngine.from_preset('india')
        engine.history = [{'turn': turn, 'events': [], 'replay_before': dict(snapshot(engine.state), turn=turn)}
                          for turn in range(1, turns+1)]
        engine.state.turn = turns+1
        return engine

    def test_old_history_migrates_once_and_response_includes_moves(self):
        engine = self.engine()
        store._execute('INSERT INTO imperium_campaigns VALUES (?, ?, ?, ?)',
                       ('legacy', engine.state.turn, store._encode(engine), 'now'))
        original = engine.history[:]
        response = Response()
        result = submit_turn('legacy', TurnRequest(moves=[], expected_turn=351), response)
        loaded = store.get('legacy')
        self.assertEqual(loaded.history[:350], original)
        self.assertEqual(len(loaded.history), 351)
        self.assertEqual(result['valid_moves'], loaded.get_valid_moves('player_1'))
        self.assertIn('save;dur=', response.headers['server-timing'])
        lightweight = store.get('legacy', include_history=False)
        self.assertEqual(lightweight.history, [])
        self.assertEqual(lightweight.state, loaded.state)
        submit_turn('legacy', TurnRequest(moves=[], expected_turn=352))
        self.assertEqual(len(store.get('legacy').history), 352)
        payload = store._execute('SELECT payload FROM imperium_campaigns WHERE id = ?', ('legacy',), True)[0][0]
        self.assertLess(len(payload), 15000)
        self.assertEqual(json.loads(payload)['history'], [])

    def test_failed_append_rolls_back_snapshot(self):
        engine = self.engine(1)
        gid = store.create(engine)
        candidate = store.get(gid, include_history=False)
        candidate.state.turn += 1
        # Duplicate entries force a journal constraint failure after the CAS.
        candidate.history = [{'turn': 2}, {'turn': 2}]
        with self.assertRaises(Exception):
            store.save(gid, candidate, 2)
        loaded = store.get(gid)
        self.assertEqual(loaded.state.turn, 2)
        self.assertEqual(loaded.history, engine.history)

    def test_stale_migration_cannot_duplicate_or_replace_history(self):
        engine = self.engine(1)
        store._execute('INSERT INTO imperium_campaigns VALUES (?, ?, ?, ?)', ('old', 2, store._encode(engine), 'now'))
        a, b = store.get('old', False), store.get('old', False)
        a.state.turn = b.state.turn = 3
        a.history.append({'turn': 2, 'events': ['winner']})
        b.history.append({'turn': 2, 'events': ['loser']})
        store.save('old', a, 2)
        with self.assertRaises(store.ConflictError):
            store.save('old', b, 2)
        self.assertEqual(store.get('old').history, a.history)
        store.delete('old')
        self.assertEqual(store._execute('SELECT payload FROM imperium_campaign_turns WHERE game_id = ?', ('old',), True), [])
