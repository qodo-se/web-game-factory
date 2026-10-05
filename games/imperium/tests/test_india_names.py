import json
import unittest
from dataclasses import asdict
from games.imperium.api.store import _encode, _decode
from games.imperium.engine.game_engine import GameEngine
from games.imperium.engine.presets.india import PRESET, LEGACY_REGION_NAMES
from games.imperium.engine.replay import snapshot, campaign_states
from games.imperium.engine.presets.loader import load_preset


class IndiaRenameTests(unittest.TestCase):
    def test_legacy_save_names_upgrade_without_changing_gameplay(self):
        engine = GameEngine(load_preset(PRESET))
        expected = asdict(engine.state)
        for rid, old_name in LEGACY_REGION_NAMES.items():
            engine.state.regions[rid].name = old_name
        engine.state.turn = 2
        before = snapshot(engine.state)
        before['turn'] = 1
        engine.history = [{'turn': 1, 'replay_before': before}]
        restored = _decode(_encode(engine))
        expected['turn'] = 2
        self.assertEqual(asdict(restored.state), expected)
        self.assertEqual(restored.history, engine.history)
        self.assertEqual([s.turn for s in campaign_states(restored)], [1, 2])
        for frame in campaign_states(restored):
            self.assertEqual(frame.regions[4].name, 'Dwarka')
            self.assertEqual(frame.regions[11].name, 'Ahom')
        self.assertEqual(restored.state.regions[31].name, 'Balochistan')
        self.assertEqual(restored.state.regions[36].name, 'Kashyap Meer')

    def test_current_names_roundtrip_and_unknown_names_are_not_overwritten(self):
        engine = GameEngine.from_preset('india')
        self.assertEqual(_encode(_decode(_encode(engine))), _encode(engine))
        engine.state.regions[4].name = 'Custom territory'
        self.assertEqual(_decode(_encode(engine)).state.regions[4].name, 'Custom territory')
