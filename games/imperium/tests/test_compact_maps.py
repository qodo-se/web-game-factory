"""Compact map limits, geography conservation, and original-save compatibility."""
import json
import unittest
from pathlib import Path
from games.imperium.engine.presets import PRESETS, SOURCE_PRESETS
from games.imperium.engine.presets.loader import load_preset
from games.imperium.engine.game_engine import GameEngine
from games.imperium.api.store import _encode, _decode
from games.imperium.api.routes import _serialize_state
from games.imperium.engine.replay import snapshot, campaign_states

ROOT=Path(__file__).resolve().parents[1]

class CompactMapsTests(unittest.TestCase):
    def test_size_routes_and_protected_names(self):
        for key,preset in PRESETS.items():
            with self.subTest(map=key):
                n=len(preset['regions'])
                if 'battle' in preset:self.assertEqual(n,len(SOURCE_PRESETS[key]['regions']))
                else:self.assertTrue(24<=n<=30)
                state=load_preset(preset)
                old=load_preset(SOURCE_PRESETS[key])
                if 'battle' not in preset:self.assertLess(len(state.routes),len(old.routes))
                self.assertEqual(state.preset_id,key)
                self.assertEqual(state.map_asset_id,key+'_compact')
        self.assertTrue({'Kashyap Meer','Dwarka','Ahom','Balochistan','Lanka'}<=set(r[0] for r in PRESETS['india']['regions']))

    def test_every_original_region_is_represented_once(self):
        for key,preset in PRESETS.items():
            atlas=json.loads((ROOT/f'ui/maps/{preset["map_asset_id"]}.json').read_text())
            ids=[rid for r in atlas['regions'] for rid in r['source_region_ids']]
            self.assertEqual(sorted(ids),list(range(len(SOURCE_PRESETS[key]['regions']))))
            self.assertEqual([r['name'] for r in atlas['regions']],[r[0] for r in preset['regions']])
            if key=='india':
                kashyap=next(r for r in atlas['regions'] if r['name']=='Kashyap Meer')
                self.assertEqual(kashyap['source_region_ids'],[36])

    def test_saved_original_and_compact_campaigns_and_replays(self):
        for collection in [SOURCE_PRESETS,PRESETS]:
            for key,preset in collection.items():
                engine=GameEngine(load_preset(preset));before=snapshot(engine.state)
                engine.state.turn=2;engine.history=[dict(turn=1,replay_before=before)]
                payload=json.loads(_encode(engine))
                if collection is SOURCE_PRESETS:payload['state'].pop('map_asset_id')
                restored=_decode(json.dumps(payload))
                asset=_serialize_state(restored)['map_asset_id']
                atlas=json.loads((ROOT/f'ui/maps/{asset}.json').read_text())
                self.assertEqual([r.name for r in restored.state.regions.values()],[r['name'] for r in atlas['regions']])
                self.assertEqual(restored.state.routes,engine.state.routes)
                self.assertEqual([s.turn for s in campaign_states(restored)],[1,2])
                self.assertEqual(asset,preset.get('map_asset_id',key))
