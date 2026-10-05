import unittest
import json
from games.borderstrife.api import routes
from unittest.mock import patch
from games.borderstrife.tests import test_long_campaign
from games.borderstrife.api import store
from games.borderstrife.api.routes import get_game, get_history, get_campaign_replay
from games.borderstrife.engine.replay import campaign_states, snapshot


class LazyHistoryTests(unittest.TestCase):
    setUp = test_long_campaign.LongCampaignTests.setUp
    tearDown = test_long_campaign.LongCampaignTests.tearDown
    engine = test_long_campaign.LongCampaignTests.engine
    def test_recent_reports_and_history_pages(self):
        engine=self.engine(1000);gid=store.create(engine)
        data=get_game(gid,20)
        self.assertEqual([e['turn'] for e in data['history']],list(range(981,1001)))
        self.assertTrue(data['history_more'])
        self.assertTrue(all('replay_before' not in e for e in data['history']))
        page=get_history(gid,981,50)
        self.assertEqual([e['turn'] for e in page['history']],list(range(931,981)))
        self.assertTrue(page['more'])
        self.assertFalse(get_history(gid,20,50)['more'])
        self.assertEqual(data['valid_moves'],engine.get_valid_moves('player_1'))

    def test_indexed_replay_reads_bounded_history_and_matches_full_replay(self):
        engine=self.engine(120);engine.state.game_over=True;engine.state.winner='player_1'
        gid=store.create(engine)
        full=get_campaign_replay(gid)['frames']
        before=store._encode(store.get(gid))
        for offset in (0,50,100,120):
            with patch.object(store,'history_page',wraps=store.history_page) as read:
                page=get_campaign_replay(gid,offset,50)
            self.assertEqual(page['frames'],full[offset:offset+50])
            self.assertEqual(page['total'],121)
            self.assertEqual(read.call_args.args[-1],51)
        self.assertEqual(store._encode(store.get(gid)),before)

    def test_missing_snapshot_keeps_legacy_suffix(self):
        engine=self.engine(120);engine.state.game_over=True
        engine.history[70]={'turn':71}
        gid=store.create(engine)
        full=get_campaign_replay(gid)
        page=get_campaign_replay(gid,0,20)
        self.assertFalse(page['complete'])
        self.assertEqual(page['frames'],full['frames'][:20])
        self.assertEqual(page['total'],len(full['frames']))

    def test_restoring_snapshot_does_not_mutate_original(self):
        engine=self.engine(2);original=snapshot(engine.state)
        frames=campaign_states(engine);frames[0].regions[0].army+=100
        self.assertEqual(snapshot(engine.state),original)

    def test_legacy_pages_reuse_reconstruction_and_do_not_modify_save(self):
        engine=self.engine(120);engine.state.game_over=True
        store._execute('INSERT INTO imperium_campaigns (id, revision, payload, updated_at) VALUES (?, ?, ?, ?)',
                       ('completed-legacy',121,store._encode(engine),'now'))
        before=store._encode(store.get('completed-legacy'))
        with patch.object(routes,'_legacy_replays',routes.OrderedDict()), patch.object(routes,'campaign_states',wraps=campaign_states) as rebuild:
            first=get_campaign_replay('completed-legacy',0,50)
            second=get_campaign_replay('completed-legacy',50,50)
            last=get_campaign_replay('completed-legacy',100,50)
            self.assertEqual(rebuild.call_count,1)
        self.assertEqual(first['total'],121)
        self.assertEqual(second['frames'][0]['turn'],51)
        self.assertEqual(last['frames'][-1]['turn'],121)
        self.assertEqual(store._encode(store.get('completed-legacy')),before)

    def test_legacy_cache_is_bounded_and_invalidates_changed_state(self):
        engine=self.engine(2);engine.state.game_over=True
        store._execute('INSERT INTO imperium_campaigns (id, revision, payload, updated_at) VALUES (?, ?, ?, ?)',('cached',3,store._encode(engine),'now'))
        with patch.object(routes,'_legacy_replays',routes.OrderedDict()) as cache, patch.object(routes,'_LEGACY_CACHE_BYTES',1):
            get_campaign_replay('cached',0,1)
            self.assertFalse(cache)
        with patch.object(routes,'_legacy_replays',routes.OrderedDict()), patch.object(routes,'campaign_states',wraps=campaign_states) as rebuild:
            get_campaign_replay('cached',0,1)
            engine.campaign_name='Changed title'
            store._execute('UPDATE imperium_campaigns SET payload = ? WHERE id = ?', (store._encode(engine),'cached'))
            get_campaign_replay('cached',0,1)
            self.assertEqual(rebuild.call_count,2)

    def test_journal_save_has_version_boundary_and_reads_old_inline_format(self):
        engine=self.engine(2)
        legacy=store._encode(engine)
        self.assertEqual(json.loads(legacy)['schema'],1)
        self.assertEqual(store._decode(legacy).history,engine.history)
        gid=store.create(engine)
        payload=store._execute('SELECT payload FROM imperium_campaigns WHERE id = ?', (gid,),True)[0][0]
        # The previous reader accepts only schema 1: it must reject this payload
        # before interpreting the empty inline history or attempting a write.
        self.assertEqual(json.loads(payload)['schema'],2)
        self.assertEqual(store.get(gid).history,engine.history)
        self.assertEqual(store._decode(payload).state,engine.state)
