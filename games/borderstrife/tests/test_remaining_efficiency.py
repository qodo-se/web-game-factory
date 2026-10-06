import copy
import json
import tracemalloc
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from games.borderstrife.engine import ai
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.presets import PRESETS
from games.borderstrife.engine.models import Owner
from games.borderstrife.engine.replay import snapshot, campaign_states, reverse_campaign_states
from games.borderstrife.api import routes


class RemainingEfficiencyTests(unittest.TestCase):
    def test_ai_supply_reuse_preserves_exact_orders(self):
        score = ai._score_attack
        def uncached(attacker, target, state, owner, supplied=None):
            return score(attacker, target, state, owner)
        for name in PRESETS:
            state = GameEngine.from_preset(name).state
            for variant in range(3):
                if variant:
                    for r in state.regions.values():
                        r.owner = list(Owner)[(r.id+variant)%3]
                        r.army = (r.id*31+variant)%180
                if variant == 2:
                    state.battle = {'objectives':[0,1]}
                for side in ('player_1','player_2'):
                    for seed in range(8):
                        with patch.object(ai, '_score_attack', side_effect=uncached):
                            expected = ai.decide_actions(state, side, seed)
                        with patch.object(ai, 'supplied_regions', wraps=ai.supplied_regions) as supply:
                            actual = ai.decide_actions(state, side, seed)
                        self.assertEqual(actual, expected)
                        self.assertLessEqual(supply.call_count, 1)

    def engine(self, turns=120):
        engine = GameEngine.from_preset('india')
        engine.history = [{'turn':i, 'events':[], 'movements':[], 'combat_results':[],
                           'replay_before':dict(snapshot(engine.state), turn=i)} for i in range(1,turns+1)]
        engine.state.turn = turns+1
        engine.state.game_over = True
        engine.state.winner = 'draw'
        engine._journal = False
        return engine

    def test_legacy_pages_cache_concurrency_and_oversize(self):
        engine = self.engine()
        original = copy.deepcopy(engine.state)
        expected = [routes._replay_frame(s) for s in campaign_states(engine)]
        routes._legacy_replays.clear()
        with patch.object(routes, 'reverse_campaign_states', wraps=reverse_campaign_states) as walk:
            with ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(lambda _:routes._legacy_replay_page('shared',engine,0,50),range(4)))
            self.assertEqual(walk.call_count, 1)
        for result in results:
            self.assertEqual(result['frames'],expected[:50])
        cached = [routes._legacy_replay_page('shared',engine,offset,50) for offset in (0,50,100)]
        routes._legacy_replays.clear()
        with patch.object(routes, '_LEGACY_CACHE_BYTES', 256):
            for index, offset in enumerate((0,50,100)):
                self.assertEqual(routes._legacy_replay_page('large',engine,offset,50),cached[index])
            self.assertFalse(routes._legacy_replays)
        self.assertEqual(engine.state, original)
        # A broken journal advertises only the recoverable suffix.
        engine.history[50]['turn'] = 1
        routes._legacy_replays.clear()
        page = routes._legacy_replay_page('partial',engine,0,50)
        self.assertFalse(page['complete'])
        self.assertEqual(page['frames'][0]['turn'],52)

    def test_legacy_memory_does_not_retain_all_state_objects(self):
        engine = self.engine(1000)
        routes._legacy_replays.clear()
        def measure(fn):
            tracemalloc.start()
            try:
                result=fn()
                return result,tracemalloc.get_traced_memory()[1]
            finally:
                tracemalloc.stop()
        def previous():
            positions=campaign_states(engine)
            return [json.dumps(routes._replay_frame(p)) for p in positions]
        _, baseline = measure(previous)
        result, optimized = measure(lambda:routes._legacy_replay_page('memory',engine,0,50))
        self.assertEqual(len(result['frames']),50)
        self.assertLess(optimized,baseline*.7)

    def test_failed_reconstruction_retries_and_expired_cache_is_rejected(self):
        from fastapi import HTTPException
        engine=self.engine(2)
        routes._legacy_replays.clear()
        with patch.object(routes,'reverse_campaign_states',side_effect=RuntimeError('Test failure')):
            with self.assertRaises(RuntimeError):
                routes._legacy_replay_page('retry',engine,0,50)
        self.assertFalse(routes._legacy_replays)
        self.assertEqual(routes._legacy_replay_page('retry',engine,0,50)['total'],3)
        engine.expires_at='2000-01-01T00:00:00+00:00'
        with self.assertRaises(HTTPException) as error:
            routes._legacy_replay_page('retry',engine,0,50)
        self.assertEqual(error.exception.status_code,404)

    def test_replay_reconstruction_never_holds_a_gameplay_lock(self):
        import threading
        engine=self.engine(2)
        first='replay-concurrency'
        other=next(str(i) for i in range(10000) if routes._get_game_lock(str(i)) is routes._get_game_lock(first))
        entered,release=threading.Event(),threading.Event()
        def delayed(engine):
            entered.set()
            if not release.wait(3):
                raise RuntimeError('Test reconstruction timed out')
            yield from reverse_campaign_states(engine)
        routes._legacy_replays.clear()
        with patch.object(routes,'reverse_campaign_states',delayed),ThreadPoolExecutor(max_workers=1) as pool:
            future=pool.submit(routes._legacy_replay_page,first,engine,0,50)
            try:
                self.assertTrue(entered.wait(2))
                lock=routes._get_game_lock(other)
                acquired=lock.acquire(timeout=.2)
                if acquired: lock.release()
                self.assertTrue(acquired,'Legacy replay blocked an unrelated gameplay lock')
            finally:
                release.set()
            self.assertEqual(future.result()['total'],3)
