"""Presentation revisions preserve game rules and all earlier map assets."""
import json
from pathlib import Path
import unittest
from games.borderstrife.engine.presets import PRESETS

ROOT=Path(__file__).resolve().parents[1]


class PolishedCollectionTests(unittest.TestCase):
    def test_rules_and_scenarios_unchanged(self):
        baseline=json.loads((ROOT/'engine/presets/reviewed.json').read_text())
        self.assertEqual(set(baseline),set(PRESETS))
        for key,old in baseline.items():
            with self.subTest(map=key):
                new=PRESETS[key]
                self.assertEqual(new['map_asset_id'],key+('_atlas_v6' if key in {'japan_korea','viking_conquests','greco_persian'} else '_atlas_v4'))
                for field in ['regions','player1_capital','player2_capital','player1_extra_starts','player2_extra_starts','battle']:
                    self.assertEqual(old.get(field),new.get(field))
                rules=lambda p:json.loads((ROOT/f"engine/presets/geography/{p['map_asset_id']}.json").read_text())
                self.assertEqual(rules(old),rules(new))
                old_atlas=json.loads((ROOT/f"ui/maps/{old['map_asset_id']}.json").read_text())
                new_atlas=json.loads((ROOT/f"ui/maps/{new['map_asset_id']}.json").read_text())
                self.assertEqual(new_atlas['presentation_version'],4)
                self.assertTrue(new_atlas['context_land'])
                if 'terrain' in old_atlas:
                    self.assertNotEqual(old_atlas['terrain']['image'],new_atlas['terrain']['image'])
                    for atlas in [old_atlas,new_atlas]:self.assertTrue((ROOT/'ui/maps'/atlas['terrain']['image']).exists())
