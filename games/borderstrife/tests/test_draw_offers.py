import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from games.borderstrife.api import routes, store
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import Owner
from games.borderstrife.engine.replay import snapshot
from games.borderstrife.engine.draw_offers import assess


class DrawTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, IMPERIUM_DB_PATH=self.temp.name+'/games.db', DATABASE_URL='')
        self.env.start()
        app = FastAPI()
        app.include_router(routes.router)
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.env.stop()
        self.temp.cleanup()

    def fixture(self):
        engine = GameEngine.from_preset('india')
        for region in engine.state.regions.values():
            region.owner = Owner.ROGUE
            region.army = 1000000
        # Two equally strong enclaves with no viable attack on surrounding militias.
        regions = list(engine.state.regions.values())
        a = regions[0]
        b = next(r for r in regions if r.id != a.id and r.id not in a.neighbors)
        for player, region in zip(engine.state.players, (a,b)):
            region.owner = Owner(player.id)
            region.army = 100
            region.reinforcement_rate = 4
            player.capital_region_id = region.id
        for turn in range(1,30):
            engine.state.turn = turn
            engine.history.append(dict(turn=turn, movements=[], combat_results=[],
                                       events=[], game_over=False, winner=None, replay_before=snapshot(engine.state)))
        engine.state.turn = 30
        return engine

    def offer(self, gid, turn=30):
        return self.client.post(f'/api/imperium/games/{gid}/draw', json={'expected_turn':turn})

    def test_accept_download_restore_replay(self):
        gid = store.create(self.fixture())
        response = self.offer(gid)
        self.assertEqual(response.status_code,200,response.text)
        self.assertTrue(response.json()['accepted'])
        saved = store.get(gid)
        self.assertEqual((saved.state.turn,saved.state.winner,len(saved.history)),(30,'draw',29))
        replay = self.client.get(f'/api/imperium/games/{gid}/replay').json()
        self.assertIn('draw', str(replay))
        payload = self.client.get(f'/api/imperium/games/{gid}/download').content
        restored = self.client.post('/api/imperium/games/restore',content=payload,headers={'Content-Type':'application/json'})
        self.assertEqual(restored.status_code,200,restored.text)
        restored_state = store.get(restored.json()['game_id']).state
        self.assertEqual(restored_state.winner,'draw')
        self.assertEqual(restored_state.draw_offers, saved.state.draw_offers)
        self.assertTrue(restored_state.draw_offers[0]['accepted'])
        self.assertEqual(self.offer(gid).status_code,400)
        self.assertEqual(self.client.post(f'/api/imperium/games/{gid}/turn',json={'expected_turn':30,'moves':[]}).status_code,400)

    def test_decline_cooldown_and_no_consumed_turn(self):
        engine = self.fixture()
        engine.state.owned_regions('player_2')[0].army = 1000
        gid = store.create(engine)
        response = self.offer(gid)
        self.assertFalse(response.json()['accepted'])
        self.assertEqual(store.get(gid).state.turn,30)
        self.assertEqual(self.offer(gid).status_code,400)
        payload = self.client.get(f'/api/imperium/games/{gid}/download').content
        restored = self.client.post('/api/imperium/games/restore',content=payload,headers={'Content-Type':'application/json'})
        self.assertEqual(restored.status_code,200,restored.text)
        self.assertEqual(self.offer(restored.json()['game_id']).status_code,400)
        loaded = store.get(gid)
        loaded.state.turn = 35
        store.save(gid, loaded,30)
        self.assertEqual(self.offer(gid,35).status_code,200)
        self.assertEqual([o['turn'] for o in store.get(gid).state.draw_offers], [30,35])

    def test_unlock_stale_turn_and_assessment(self):
        gid = store.create(GameEngine.from_preset('india'))
        self.assertEqual(self.offer(gid,1).status_code,400)
        engine = self.fixture()
        gid = store.create(engine)
        self.assertEqual(self.offer(gid,29).status_code,409)
        self.assertTrue(assess(engine.state,engine.history)[0])
        engine.history[-1]['replay_before']['regions'][str(next(iter(engine.state.regions)))][0] = 'rogue'
        self.assertFalse(assess(engine.state,engine.history)[0])
        engine = self.fixture()
        engine.state.owned_regions('player_2')[0].reinforcement_rate = 10
        self.assertIn('recruitment', assess(engine.state,engine.history)[1])
        engine = self.fixture()
        ai = engine.state.owned_regions('player_2')[0]
        engine.state.regions[ai.neighbors[0]].army = 0
        self.assertIn('attack', assess(engine.state,engine.history)[1])

    def test_same_turn_mutation_conflicts_with_turn_in_both_orders(self):
        for offer_first in (True,False):
            gid = store.create(self.fixture())
            offer = store.get(gid)
            turn = store.get(gid)
            offer.state.draw_offer_turn = 30
            turn.state.turn = 31
            first, second = (offer,turn) if offer_first else (turn,offer)
            store.save(gid,first,30)
            with self.assertRaises(store.ConflictError):
                store.save(gid,second,30)

    def test_resignation_roundtrip_replay_and_stale_requests(self):
        gid = store.create(self.fixture())
        url = f'/api/imperium/games/{gid}/resign'
        self.assertEqual(self.client.post(url,json={'expected_turn':29}).status_code,409)
        self.assertFalse(store.get(gid).state.game_over)
        result = self.client.post(url,json={'expected_turn':30})
        self.assertEqual(result.status_code,200,result.text)
        state = result.json()['state']
        self.assertEqual((state['winner'],state['turn'],state['resigned']),('player_2',30,True))
        self.assertEqual(len(store.get(gid).history),29)
        self.assertEqual(self.client.post(url,json={'expected_turn':30}).status_code,400)
        self.assertEqual(self.offer(gid).status_code,400)
        self.assertEqual(self.client.post(f'/api/imperium/games/{gid}/turn',json={'expected_turn':30,'moves':[]}).status_code,400)
        replay = self.client.get(f'/api/imperium/games/{gid}/replay?offset=0').json()
        self.assertEqual(replay['frames'][-1]['winner'],'player_2')
        self.assertFalse(replay['frames'][0]['game_over'])
        payload = self.client.get(f'/api/imperium/games/{gid}/download').content
        restored = self.client.post('/api/imperium/games/restore',content=payload,headers={'Content-Type':'application/json'})
        self.assertEqual(restored.status_code,200,restored.text)
        self.assertTrue(store.get(restored.json()['game_id']).state.resigned)

    def test_can_resign_on_first_turn(self):
        gid = store.create(GameEngine.from_preset('india'))
        result = self.client.post(f'/api/imperium/games/{gid}/resign',json={'expected_turn':1})
        self.assertEqual(result.status_code,200,result.text)
        self.assertTrue(result.json()['state']['resigned'])
        self.assertEqual(self.client.get(f'/api/imperium/games/{gid}/replay').status_code,200)
