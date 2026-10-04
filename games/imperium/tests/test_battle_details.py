import unittest
from games.imperium.engine.models import Move, TurnActions
from games.imperium.engine.strategy import win_probability
from games.imperium.engine.turn_resolver import resolve_turn
from test_campaign import scenario


class BattleDetailsTests(unittest.TestCase):
    def test_combined_attack_records_actual_modifiers_and_roll(self):
        state = scenario()
        state.routes = {'0:2': 'river', '1:2': 'pass'}
        result = resolve_turn(state, TurnActions('player_1', [Move(0,2),Move(1,2)]),
                              TurnActions('player_2', []), seed=42).combat_results[0]
        details = result.battle_details
        self.assertEqual({s['region_id'] for s in details['sources']}, {0,1})
        self.assertAlmostEqual(details['effective_attack'],112/1.2+24/1.15)
        self.assertEqual(details['terrain'], 'hills')
        self.assertEqual(details['terrain_multiplier'],1.75)
        self.assertAlmostEqual(details['effective_defense'],102*1.75)
        self.assertAlmostEqual(details['win_probability'],win_probability(details['effective_attack'],details['effective_defense']))
        self.assertEqual(result.attacker_won,details['roll']<details['win_probability'])

    def test_departed_defenders_record_unopposed_capture(self):
        state = scenario()
        result = resolve_turn(state, TurnActions('player_1',[Move(0,2)]),
                              TurnActions('player_2',[Move(2,3)]),seed=4).combat_results[0]
        self.assertEqual(result.defender_army,0)
        self.assertEqual(result.battle_details['effective_defense'],0)
        self.assertEqual(result.battle_details['win_probability'],1)
        self.assertTrue(result.attacker_won)
