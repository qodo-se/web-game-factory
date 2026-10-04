import unittest
from games.imperium.engine.game_engine import GameEngine
from games.imperium.engine.presets import PRESETS
from games.imperium.engine.presets.starts import starting_choices
from games.imperium.engine.models import Move, Owner
from games.imperium.engine.strategy import threats, supplied_regions
from test_campaign import scenario


class KingdomTests(unittest.TestCase):
    def test_every_start_matches_preview_and_has_connected_disjoint_kingdoms(self):
        for preset in PRESETS.values():
            for choice in starting_choices(preset):
                state = GameEngine.from_preset(preset['id'], start_region_id=choice['id']).state
                self.assertEqual(sum(r.army for r in state.owned_regions('player_1')), choice['army'])
                self.assertEqual([r.name for r in state.owned_regions('player_1')], choice['regions'])
                if choice['id'] is None:
                    self.assertEqual(state.get_player('player_1').capital_region_id, preset['player1_capital'])
                    continue
                self.assertEqual(state.get_player('player_1').capital_region_id, choice['id'])
                for player in state.players:
                    owned = {r.id for r in state.owned_regions(player.id)}
                    self.assertEqual(len(owned), 3, (preset['id'], choice['id'], player.id))
                    seen = {player.capital_region_id}
                    while True:
                        more = seen | {n for r in seen for n in state.regions[r].neighbors if n in owned}
                        if more == seen: break
                        seen = more
                    self.assertEqual(seen, owned)
                    self.assertTrue(owned <= supplied_regions(state))
                self.assertEqual(sum(r.is_capital for r in state.regions.values()), 2)

    def test_kashyap_and_invalid_start(self):
        state = GameEngine.from_preset('india', start_region_id=36).state
        self.assertEqual(state.regions[36].name, 'Kashyap Meer')
        self.assertEqual(state.regions[36].owner, Owner.PLAYER_1)
        with self.assertRaises(ValueError): GameEngine.from_preset('india', start_region_id=999)


class ThreatTests(unittest.TestCase):
    def test_departures_warn_and_incoming_reinforcements_are_counted(self):
        state = scenario()
        self.assertEqual(threats(state, [])['warnings'], [])
        result = threats(state, [Move(0,2)])
        warning = next(w for w in result['warnings'] if w['region_id']==0)
        self.assertEqual(warning['garrison'], 0)
        self.assertTrue(warning['important'])
        state.regions[1].army = 300
        result = threats(state, [Move(0,2), Move(1,0)])
        home = next(w for w in result['entries'] if w['region_id']==0)
        self.assertEqual(home['garrison'],304)
        self.assertNotIn(0, [w['region_id'] for w in result['warnings']])
        self.assertEqual(state.regions[0].army,100)  # forecasts never mutate saves

    def test_neutral_neighbors_do_not_attack(self):
        state = scenario(); state.regions[2].owner = Owner.ROGUE
        self.assertEqual(threats(state, [Move(0,1)])['entries'], [])

    def test_crossings_reduce_risk(self):
        state = scenario()
        before = threats(state, [])['entries'][0]['risk']
        state.routes = {'0:2':'sea'}
        self.assertLess(threats(state, [])['entries'][0]['risk'], before)
