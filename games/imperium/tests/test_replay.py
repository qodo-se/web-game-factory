from copy import deepcopy
from dataclasses import asdict
import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from games.imperium.api import store
from games.imperium.api.routes import get_campaign_replay, submit_turn, TurnRequest
from games.imperium.engine.game_engine import GameEngine
from games.imperium.engine.replay import snapshot, campaign_states


class ReplayTests(unittest.TestCase):
    def test_legacy_journal_reconstructs_every_position_exactly(self):
        for seed in range(5):
            engine = GameEngine.from_preset('india', player1_is_ai=True)
            engine._base_seed = seed
            expected = [snapshot(engine.state)]
            for _ in range(20):
                if engine.state.game_over: break
                summary = engine.resolve_turn()
                engine.history.append(asdict(summary))
                expected.append(snapshot(engine.state))
            original = deepcopy(engine.state)
            self.assertEqual([snapshot(s) for s in campaign_states(engine)], expected)
            self.assertEqual(engine.state, original)

    def test_snapshot_supports_old_journal_suffix_without_guessing(self):
        engine = GameEngine.from_preset('india', player1_is_ai=True)
        before = snapshot(engine.state)
        engine.resolve_turn()
        engine.history = [{'turn':1, 'replay_before':before}]
        self.assertEqual(snapshot(campaign_states(engine)[0]), before)
        engine.history = [{'turn':1}]
        self.assertEqual(len(campaign_states(engine)),1)

    def test_persisted_snapshots_and_read_only_endpoint(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'IMPERIUM_DB_PATH':directory+'/replay.sqlite'}):
            engine = GameEngine.from_preset('india')
            start = snapshot(engine.state)
            game_id = store.create(engine)
            with self.assertRaises(HTTPException) as error: get_campaign_replay(game_id)
            self.assertEqual(error.exception.status_code,400)
            submit_turn(game_id,TurnRequest(moves=[],expected_turn=1))
            saved = store.get(game_id)
            self.assertEqual(saved.history[0]['replay_before'],start)
            saved.state.game_over = True
            saved.state.winner = 'player_1'
            store.save(game_id,saved,2)
            payload_before = store._encode(store.get(game_id))
            replay = get_campaign_replay(game_id)
            self.assertTrue(replay['complete'])
            self.assertEqual([frame['turn'] for frame in replay['frames']],[1,2])
            self.assertNotIn('neighbors',replay['frames'][0]['regions'][0])
            self.assertEqual(store._encode(store.get(game_id)),payload_before)
            with self.assertRaises(HTTPException) as error: get_campaign_replay('missing-replay')
            self.assertEqual(error.exception.status_code,404)
