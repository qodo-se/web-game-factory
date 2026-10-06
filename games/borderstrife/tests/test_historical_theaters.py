"""Historical campaign assets preserve scope, navigation and portable saves."""
import json
from pathlib import Path
import unittest

from games.borderstrife.api import backups
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import TurnActions
from games.borderstrife.engine.presets import PRESETS
from games.borderstrife.tools.historical_sources import MAPS

ROOT = Path(__file__).resolve().parents[1]


class HistoricalTheaterTests(unittest.TestCase):
    def test_historical_settings_and_authored_crossings(self):
        self.assertEqual(len(MAPS), 5)
        for spec in MAPS:
            with self.subTest(map=spec['id']):
                preset = PRESETS[spec['id']]
                self.assertEqual(preset['category'], 'historical')
                self.assertTrue(24 <= len(preset['regions']) <= 30)
                self.assertEqual([r[0] for r in preset['regions']], [r[0] for r in spec['sites']])
                self.assertIn('not historical deployments', preset['setting']['note'])
                self.assertTrue(preset['setting']['era'])
                self.assertTrue(preset['setting']['sources'])
                atlas = json.loads((ROOT / f"ui/maps/{preset['map_asset_id']}.json").read_text())
                self.assertTrue(atlas['annotations'])
                self.assertTrue(atlas['rivers'])
                self.assertTrue(atlas['context_land'])
                self.assertTrue((ROOT / f"ui/maps/thumbnails/{preset['map_asset_id']}.svg").exists())
                # Named regions remain near their authored locations after geometry repair.
                west, south, east, north = atlas['bounds']
                for region, site in zip(atlas['regions'], spec['sites']):
                    expected = ((site[2]-west)/(east-west), (north-site[3])/(north-south))
                    self.assertLess(abs(region['center'][0]-expected[0]), .025, site[0])
                    self.assertLess(abs(region['center'][1]-expected[1]), .025, site[0])
                state = GameEngine.from_preset(spec['id']).state
                names = {r.name: i for i, r in state.regions.items()}
                for a, b in spec.get('sea_routes', []):
                    x, y = sorted((names[a], names[b]))
                    self.assertEqual(state.routes[f'{x}:{y}'], 'sea')

    def test_new_theaters_play_and_export_without_external_assets(self):
        for spec in MAPS:
            with self.subTest(map=spec['id']):
                engine = GameEngine.from_preset(spec['id'])
                for turn in range(3):
                    engine.submit_actions('player_1', TurnActions('player_1', []))
                    engine.resolve_turn(seed=turn)
                restored = backups.decode(backups.encode(engine))
                self.assertEqual(restored.state, engine.state)
                self.assertEqual(restored.history, engine.history)

    def test_expanded_viking_scope_and_previous_save(self):
        from games.borderstrife.engine.presets.loader import load_preset
        preset=PRESETS['viking_conquests']
        self.assertEqual(preset['map_asset_id'],'viking_conquests_atlas_v5')
        self.assertEqual(len(preset['regions']),30)
        names={r[0] for r in preset['regions']}
        self.assertTrue({'Iceland','Faroe Islands','Halogaland','Viken','Zealand','Birka','Gotland','Finland','Ladoga','Novgorod','Normandy','Paris','Frisia','Rhineland','Dublin','Wessex'} <= names)
        old=json.loads((Path(__file__).parent/'fixtures/previous_viking_conquests.json').read_text())
        engine=GameEngine(load_preset(old))
        restored=backups.decode(backups.encode(engine))
        self.assertEqual(restored.state,engine.state)
        self.assertEqual(len(restored.state.regions),28)
        self.assertEqual(restored.state.map_asset_id,'viking_conquests_atlas_v4')

    def test_expanded_greek_persian_scope_and_previous_save(self):
        from games.borderstrife.engine.presets.loader import load_preset
        preset=PRESETS['greco_persian']
        self.assertEqual(preset['map_asset_id'],'greco_persian_atlas_v5')
        self.assertEqual(len(preset['regions']),30)
        names={r[0] for r in preset['regions']}
        self.assertTrue({'Athens','Sparta','Cyprus','Phoenicia','Nile Delta','Memphis','Thebes','Sinai','Upper Mesopotamia','Assyria','Babylon','Susa','Media','Persepolis','Parthia','Hyrcania','Carmania','Drangiana'} <= names)
        atlas=json.loads((ROOT/f"ui/maps/{preset['map_asset_id']}.json").read_text())
        w,s,e,n=atlas['bounds']
        def inside(x,y,ring):
            result=False
            for (ax,ay),(bx,by) in zip(ring,ring[1:]):
                if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax: result=not result
            return result
        for lon,lat in [(23.73,37.98),(32.65,25.72),(44.42,32.54),(52.89,29.93),(61.5,31.03)]:
            x,y=(lon-w)/(e-w),(n-lat)/(n-s)
            self.assertTrue(any(inside(x,y,q[0]) and not any(inside(x,y,h) for h in q[1:]) for r in atlas['regions'] for q in r['polygons']),(lon,lat))
        old=json.loads((Path(__file__).parent/'fixtures/previous_greco_persian.json').read_text())
        engine=GameEngine(load_preset(old))
        restored=backups.decode(backups.encode(engine))
        self.assertEqual(restored.state,engine.state)
        self.assertEqual(restored.state.map_asset_id,'greco_persian_atlas_v4')
