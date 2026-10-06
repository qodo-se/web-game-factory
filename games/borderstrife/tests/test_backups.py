import json
import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from games.borderstrife.api import backups, routes, store
from games.borderstrife.engine.game_engine import GameEngine


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = self.temp.name + '/games.sqlite'
        self.env = patch.dict(os.environ, {'IMPERIUM_DB_PATH': self.path, 'DATABASE_URL': ''})
        self.env.start()
        app = FastAPI()
        app.include_router(routes.router)
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.env.stop()
        self.temp.cleanup()

    def campaign(self, turns=3, completed=False):
        game = routes.new_game(routes.NewGameRequest(preset_id='india'))
        gid = game['game_id']
        for turn in range(1, turns+1):
            engine = store.get(gid)
            source, targets = next(iter(engine.get_valid_moves('player_1').items()))
            routes.submit_turn(gid, routes.TurnRequest(moves=[routes.MoveIn(from_region_id=source, to_region_id=targets[0])], expected_turn=turn))
        if completed:
            engine = store.get(gid)
            engine.state.game_over = True
            engine.state.winner = 'player_1'
            store.save(gid, engine, engine.state.turn)
        return gid

    def download(self, gid):
        response = self.client.get(f'/api/imperium/games/{gid}/download')
        self.assertEqual(response.status_code, 200, response.text[:500])
        self.assertEqual(response.headers['cache-control'], 'no-store')
        return response.content

    def restore(self, payload):
        return self.client.post('/api/imperium/games/restore', content=payload, headers={'Content-Type':'application/json'})

    def test_resume_roundtrip_and_independent_turns(self):
        gid = self.campaign()
        before = store.get(gid)
        payload = self.download(gid)
        response = self.restore(payload)
        self.assertEqual(response.status_code, 200, response.text[:1000])
        restored = response.json()['game_id']
        self.assertNotEqual(gid, restored)
        self.assertEqual(store._encode(before), store._encode(store.get(restored)))
        self.assertGreater(store.get(restored).expires_at, before.expires_at)
        result = routes.submit_turn(restored, routes.TurnRequest(moves=[], expected_turn=4))
        self.assertEqual(result['state']['turn'], 5)
        self.assertEqual(store.get(gid).state.turn, 4)

    def test_completed_roundtrip_replay_and_after_original_deletion(self):
        gid = self.campaign(completed=True)
        before = routes.get_campaign_replay(gid)
        payload = self.download(gid)
        store.delete(gid)
        response = self.restore(payload)
        self.assertEqual(response.status_code, 200, response.text[:1000])
        restored = response.json()['game_id']
        self.assertTrue(response.json()['state']['game_over'])
        self.assertEqual(routes.get_campaign_replay(restored), before)

    def test_all_current_maps_and_standing_orders(self):
        from games.borderstrife.engine.presets import PRESETS
        for preset in PRESETS:
            engine = GameEngine.from_preset(preset)
            source = next(iter(engine.state.regions.values()))
            engine.state.standing_orders = [{'id':'repeat-1', 'kind':'reinforce', 'path':[source.id,source.neighbors[0]], 'paused':True, 'reason':'Waiting for a friendly region.'}]
            decoded = backups.decode(backups.encode(engine))
            self.assertEqual(store._encode(decoded), store._encode(engine), preset)

    def test_long_campaign_preserves_every_turn(self):
        from games.borderstrife.engine.models import TurnActions
        from games.borderstrife.engine.replay import snapshot
        engine = GameEngine.from_preset('india')
        for _ in range(350):
            before = snapshot(engine.state)
            for player in engine.state.players:
                engine.submit_actions(player.id, TurnActions(player_id=player.id))
            summary = engine.resolve_turn(seed=42)
            entry = routes._serialize_summary(summary, {})
            entry.pop('state')
            engine.history.append(dict(entry, replay_before=before))
        gid = store.create(engine)
        payload = self.download(gid)
        response = self.restore(payload)
        self.assertEqual(response.status_code, 200, response.text[:500])
        restored = store.get(response.json()['game_id'])
        self.assertEqual(len(restored.history), 350)
        self.assertEqual(restored.history, engine.history)
        self.assertEqual(restored.state, engine.state)

    def test_invalid_files_never_create_campaign(self):
        gid = self.campaign()
        raw = json.loads(self.download(gid))
        mutations = [
            lambda d: d.update(version=999),
            lambda d: d['campaign']['state'].update(map_asset_id='../../api/store'),
            lambda d: d['campaign']['state']['regions']['0'].update(army='<img src=x onerror=alert(1)>'),
            lambda d: d['campaign']['state']['regions']['0'].update(neighbors=[99999]),
            lambda d: d['campaign']['history'][0]['movements'][0].update(army='<script>'),
            lambda d: d['campaign']['history'][0]['replay_before']['regions'].pop('0'),
            lambda d: d['campaign'].update(history=[{'turn':1}]),
            lambda d: d['campaign']['state'].update(turn=1.5),
            lambda d: d['campaign']['state'].update(battle={}),
            lambda d: d['campaign']['state']['players'][1].update(is_ai=False),
            lambda d: d['campaign']['state']['regions']['0'].update(name='Wrong map'),
            lambda d: d['campaign']['state']['regions']['0'].update(x=float('nan')),
        ]
        for mutate in mutations:
            data = json.loads(json.dumps(raw))
            mutate(data)
            self.assertEqual(self.restore(json.dumps(data)).status_code, 400)
        for payload in (b'not json', b'{}', b'[]', b'\xff'):
            self.assertEqual(self.restore(payload).status_code, 400)
        self.assertEqual(store._execute('SELECT COUNT(*) FROM imperium_campaigns', fetch=True)[0][0], 1)

    def test_retired_maps_are_rejected_before_restore_or_load(self):
        engine = GameEngine.from_preset('india')
        engine.state.preset_id = 'waterloo'
        engine.state.map_asset_id = 'waterloo_atlas_v4'
        response = self.restore(backups.encode(engine))
        self.assertEqual(response.status_code, 400)
        self.assertIn('no longer available', response.json()['detail'])
        # Model an existing server save created before the collection retired.
        gid = store.create(engine)
        for suffix in ('', '/replay', '/download', '/valid-moves'):
            response = self.client.get(f'/api/imperium/games/{gid}{suffix}')
            self.assertEqual(response.status_code, 410)
            self.assertIn('retired', response.json()['detail'])

    def test_streamed_body_size_limit(self):
        with patch.object(backups, 'MAX_BYTES', 100):
            response = self.restore(iter([b'x' * 60, b'x' * 60]))
        self.assertEqual(response.status_code, 413)

    def test_expiry_blocks_read_download_replay_and_stale_turn_commit(self):
        gid = self.campaign(completed=True)
        engine = store.get(gid)
        expiry = engine.expires_at
        with patch.object(store, 'now', return_value=expiry):
            self.assertIsNone(store.get(gid))
            for suffix in ('', '/download', '/replay', '/valid-moves', '/history?before_turn=4'):
                self.assertEqual(self.client.get(f'/api/imperium/games/{gid}{suffix}').status_code, 404)
            with self.assertRaises(store.ConflictError):
                store.save(gid, engine, engine.state.turn)
            self.assertEqual(store.purge_expired(batch_size=1), 1)
        self.assertEqual(store._execute('SELECT COUNT(*) FROM imperium_campaign_turns', fetch=True)[0][0], 0)

    def test_expiry_between_snapshot_and_journal_cannot_export_partial_save(self):
        gid = self.campaign()
        expiry = store.get(gid).expires_at
        just_before = (datetime.fromisoformat(expiry) - timedelta(seconds=1)).isoformat()
        with patch.object(store, 'now', side_effect=[just_before, expiry]):
            self.assertIsNone(store.get(gid))

    def test_read_and_turn_do_not_extend_deadline_and_cleanup_keeps_live_games(self):
        gid = self.campaign()
        expiry = store.get(gid).expires_at
        routes.submit_turn(gid, routes.TurnRequest(moves=[], expected_turn=4))
        self.assertEqual(store.get(gid).expires_at, expiry)
        expired = self.campaign()
        store._execute('UPDATE imperium_campaigns SET expires_at = ? WHERE id = ?', ('2000-01-01T00:00:00+00:00', expired))
        self.assertEqual(store.purge_expired(batch_size=1), 1)
        self.assertIsNotNone(store.get(gid))
        self.assertEqual(store.purge_expired(), 0)

    def test_legacy_schema_gets_seven_day_grace_once(self):
        engine = GameEngine.from_preset('india')
        with sqlite3.connect(self.path) as connection:
            connection.execute(store.SCHEMA)
            connection.execute('INSERT INTO imperium_campaigns VALUES (?, ?, ?, ?)', ('legacy',1,store._encode(engine),'2000-01-01'))
        first = store.get('legacy')
        expiry = datetime.fromisoformat(first.expires_at)
        self.assertGreater(expiry, datetime.now(timezone.utc) + timedelta(days=6, hours=23))
        self.assertEqual(store.get('legacy').expires_at, first.expires_at)
        self.assertEqual(store.purge_expired(), 0)

    def test_incremental_history_validation_rejects_without_writes(self):
        import copy
        from games.borderstrife.engine.replay import snapshot
        engine=GameEngine.from_preset('india')
        engine.state.turn=4
        engine.history=[dict(turn=i,events=[],movements=[],combat_results=[],game_over=False,winner=None,
                             replay_before=dict(snapshot(engine.state),turn=i)) for i in range(1,4)]
        valid=json.loads(backups.encode(engine))
        invalid=[]
        for value in ('', {}, None, False, 1):
            data=copy.deepcopy(valid);data['campaign']['history']=value;invalid.append(data)
        for index in range(3):
            for field,value in [('turn',False),('movements',[[0,999,10]]),('events',[{'type':'unknown'}]),('extra','unexpected')]:
                data=copy.deepcopy(valid);data['campaign']['history'][index][field]=value;invalid.append(data)
        for data in invalid:
            with self.subTest(history=data['campaign']['history']), patch.object(store,'create') as create:
                response=self.client.post('/api/imperium/games/restore',content=json.dumps(data),headers={'Content-Type':'application/json'})
                self.assertEqual(response.status_code,400)
                create.assert_not_called()
        self.assertEqual(backups.decode(json.dumps(valid).encode()).history,engine.history)


if __name__ == '__main__':
    unittest.main()
