import json
from pathlib import Path
import unittest

from games.borderstrife.api.routes import _serialize_state
from games.borderstrife.api.store import _encode, _decode
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import Owner, TurnActions
from games.borderstrife.engine.presets import PRESETS, list_presets
from games.borderstrife.engine.presets.battles import BATTLES
from games.borderstrife.engine.presets.starts import starting_choices
from games.borderstrife.engine.strategy import growth, supplied_regions, forecast
from games.borderstrife.engine.turn_resolver import resolve_turn
from games.borderstrife.engine.replay import snapshot, campaign_states
from games.borderstrife.engine.ai import decide_actions

ROOT = Path(__file__).resolve().parents[1]


def quiet_turn(state):
    return resolve_turn(state, TurnActions('player_1'), TurnActions('player_2'), seed=1)


class HistoricalBattleTests(unittest.TestCase):
    def test_categories_and_two_fixed_sides(self):
        catalog = list_presets()
        self.assertEqual(sum(p['category'] == 'world' for p in catalog), 14)
        self.assertEqual(sum(p['category'] == 'historical' for p in catalog), 10)
        for battle in BATTLES:
            with self.subTest(battle=battle['id']):
                preset = PRESETS[battle['id']]
                choices = starting_choices(preset)
                self.assertEqual([c['id'] for c in choices], battle['capitals'])
                self.assertEqual([c['name'] for c in choices], battle['sides'])
                self.assertTrue(all(c['growth'] == 0 for c in choices))
                first = GameEngine.from_preset(battle['id']).state
                other = GameEngine.from_preset(battle['id'], start_region_id=battle['capitals'][1]).state
                self.assertEqual(first.battle['factions']['player_1'], other.battle['factions']['player_2'])
                for rid, region in first.regions.items():
                    self.assertNotEqual(region.owner, other.regions[rid].owner)
                    self.assertEqual(region.army, other.regions[rid].army)
                    self.assertEqual(growth(region, set()), 0, 'Even isolated units cannot recruit')
                invalid = next(i for i in first.regions if i not in battle['capitals'])
                with self.assertRaisesRegex(ValueError, 'historical sides'):
                    GameEngine.from_preset(battle['id'], start_region_id=invalid)

    def test_no_growth_and_forecast_consistency(self):
        from games.borderstrife.engine.models import Move
        for battle in BATTLES:
            state = GameEngine.from_preset(battle['id']).state
            before = {i:r.army for i,r in state.regions.items()}
            result = quiet_turn(state)
            self.assertFalse(result.game_over)
            self.assertEqual(before, {i:r.army for i,r in state.regions.items()})
            self.assertEqual(set(result.population_generated.values()), {0})
            source = state.owned_regions('player_1')[0]
            preview = forecast(state, [Move(source.id, source.neighbors[0])])[0]
            self.assertEqual(preview['army'], source.army)
            self.assertTrue(all(r['pop_rate'] == 0 for r in _serialize_state(GameEngine(state))['regions'].values()))

    def test_turn_limit_and_objective_priority(self):
        state = GameEngine.from_preset('waterloo').state
        for _ in range(19):
            self.assertFalse(quiet_turn(state).game_over)
        # A smaller force controlling more objectives beats a larger one.
        for region in state.regions.values():
            region.army = 1 if region.owner == Owner.PLAYER_1 else 100
        result = quiet_turn(state)
        self.assertTrue(result.game_over)
        self.assertEqual(result.turn, 20)
        self.assertEqual(result.winner, 'player_1')

    def test_tiebreak_and_elimination_are_side_independent(self):
        for side in PRESETS['hattin']['battle']['capitals']:
            state = GameEngine.from_preset('hattin', start_region_id=side).state
            a,b,c = state.battle['objectives']
            state.regions[a].owner = Owner.PLAYER_1
            state.regions[b].owner = Owner.PLAYER_2
            state.regions[c].owner = Owner.ROGUE
            for r in state.regions.values(): r.army = 0
            p1 = state.owned_regions('player_1')[0]
            p2 = state.owned_regions('player_2')[0]
            p1.army = p2.army = 100
            state.turn = 20
            self.assertEqual(quiet_turn(state).winner, state.battle['defender'])
            state.game_over=False;state.winner=None;state.turn=20;p1.army=101
            self.assertEqual(quiet_turn(state).winner,'player_1')
            # Defeat is final with no remaining troops, even if objectives remain owned.
            state.game_over=False;state.winner=None;state.turn=1;p1.army=0
            self.assertEqual(quiet_turn(state).winner,'player_2')

    def test_battle_save_and_replay(self):
        engine = GameEngine.from_preset('hastings', start_region_id=15)
        before = snapshot(engine.state)
        summary = quiet_turn(engine.state)
        engine.history.append({'turn': summary.turn, 'replay_before': before})
        restored = _decode(_encode(engine))
        self.assertEqual(restored.state.battle, engine.state.battle)
        frames = campaign_states(restored)
        self.assertEqual([f.turn for f in frames], [1,2])
        self.assertEqual(frames[0].battle['factions']['player_1'], 'Norman army')
        self.assertTrue(all(r.pop_rate == 0 for f in frames for r in f.regions.values()))
        legacy = json.loads(_encode(GameEngine.from_preset('india')))
        legacy['state'].pop('battle')
        for r in legacy['state']['regions'].values(): r.pop('reinforcement_rate')
        self.assertIsNone(_decode(json.dumps(legacy)).state.battle)

    def test_ai_uses_reserves_and_battles_finish(self):
        for battle in BATTLES:
            for capital in battle['capitals']:
                state = GameEngine.from_preset(battle['id'], start_region_id=capital).state
                self.assertTrue(decide_actions(state, 'player_2', seed=7).moves)
                for turn in range(20):
                    result = resolve_turn(state, decide_actions(state,'player_1',seed=turn),
                                          decide_actions(state,'player_2',seed=turn+1),seed=turn)
                    if result.game_over: break
                self.assertTrue(state.game_over)
                self.assertIn(state.winner, ['player_1','player_2'])
                self.assertTrue(all(r.army >= 0 for r in state.regions.values()))

    def test_bundled_geometry_and_objective_anchors(self):
        def inside(x,y,ring):
            result=False
            for (ax,ay),(bx,by) in zip(ring,ring[1:]):
                if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax: result=not result
            return result
        for battle in BATTLES:
            data=json.loads((ROOT/f'ui/maps/{battle["id"]}.json').read_text())
            self.assertEqual(data['category'],'historical')
            self.assertTrue((ROOT/f'ui/maps/thumbnails/{battle["id"]}.svg').exists())
            for feature in data['regions']:
                self.assertTrue(inside(*feature['center'],feature['polygons'][0][0]),feature['name'])
            self.assertEqual(len(set(battle['objectives'])),3)
