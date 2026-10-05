"""Expansion catalog, rule separation, immutable assets and campaign persistence."""
import json
from collections import Counter
from pathlib import Path
import unittest

from games.borderstrife.engine.presets import PRESETS, list_presets
from games.borderstrife.engine.presets.starts import starting_choices
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import TurnActions
from games.borderstrife.engine.replay import snapshot, campaign_states
from games.borderstrife.api.store import _encode, _decode
from games.borderstrife.engine.ai import decide_actions
from games.borderstrife.engine.turn_resolver import resolve_turn

ROOT=Path(__file__).resolve().parents[1]
EXPANSION={key:PRESETS[key] for key in json.loads((ROOT/'engine/presets/expansion.json').read_text())}

class ExpandedCollectionTests(unittest.TestCase):
    def test_catalog_and_assets(self):
        self.assertEqual(Counter(p['category'] for p in list_presets()),dict(world=14,historical=10,campaigns=4,sieges=3,legends=4))
        self.assertEqual(len(EXPANSION),22)
        for key,preset in EXPANSION.items():
            with self.subTest(map=key):
                self.assertTrue(24<=len(preset['regions'])<=30)
                self.assertEqual(len({r[0] for r in preset['regions']}),len(preset['regions']))
                asset=preset['map_asset_id']
                atlas=json.loads((ROOT/f'ui/maps/{asset}.json').read_text())
                self.assertEqual(atlas['id'],asset)
                self.assertEqual(atlas['category'],preset['category'])
                self.assertEqual([r['name'] for r in atlas['regions']],[r[0] for r in preset['regions']])
                self.assertTrue((ROOT/f'ui/maps/thumbnails/{asset}.svg').exists())
                if 'terrain' in atlas:self.assertTrue((ROOT/'ui/maps'/atlas['terrain']['image']).exists())
                self.assertEqual('battle' in preset,preset['category']=='historical')
                self.assertTrue(preset['setting']['note'])
        fantasy=json.loads((ROOT/f"ui/maps/{PRESETS['emberfall']['map_asset_id']}.json").read_text())
        self.assertTrue(fantasy['terrain']['illustrated'])
        self.assertNotIn('elevations',fantasy['terrain'])
        self.assertNotIn('width_m',fantasy['terrain'])

    def test_new_campaigns_all_start_choices_and_persistence(self):
        for key,preset in EXPANSION.items():
            with self.subTest(map=key):
                choices=starting_choices(preset)
                self.assertEqual(len(choices),2 if 'battle' in preset else len(preset['regions'])+1)
                for choice in choices:
                    state=GameEngine.from_preset(key,start_region_id=choice['id']).state
                    for player in state.players:
                        owned={r.id for r in state.owned_regions(player.id)}
                        reached={player.capital_region_id};todo=list(reached)
                        while todo:
                            for neighbor in state.regions[todo.pop()].neighbors:
                                if neighbor in owned and neighbor not in reached:reached.add(neighbor);todo.append(neighbor)
                        self.assertEqual(reached,owned)
                engine=GameEngine.from_preset(key)
                before=snapshot(engine.state)
                engine.submit_actions('player_1',TurnActions('player_1',[]))
                report=engine.resolve_turn(seed=1)
                engine.history=[dict(turn=1,replay_before=before)]
                restored=_decode(_encode(engine))
                self.assertEqual(restored.state.map_asset_id,preset['map_asset_id'])
                self.assertEqual(restored.state.routes,engine.state.routes)
                self.assertEqual([f.turn for f in campaign_states(restored)],[1,2])
                if 'battle' in preset:
                    self.assertEqual(set(report.population_generated.values()),{0})
                else:self.assertTrue(any(n>0 for n in report.population_generated.values()))

    def test_each_new_battle_finishes_for_either_side(self):
        for key,preset in EXPANSION.items():
            if 'battle' not in preset:continue
            for capital in preset['battle']['capitals']:
                with self.subTest(map=key,side=capital):
                    state=GameEngine.from_preset(key,start_region_id=capital).state
                    for turn in range(20):
                        resolve_turn(state,decide_actions(state,'player_1',seed=turn),decide_actions(state,'player_2',seed=turn+1),seed=turn)
                        if state.game_over:break
                    self.assertTrue(state.game_over)
                    self.assertIn(state.winner,['player_1','player_2'])
