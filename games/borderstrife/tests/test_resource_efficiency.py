"""Behavioral equivalence and bounded-work checks for resource optimizations."""
import copy
import json
import tempfile
import unittest
from dataclasses import asdict
from pathlib import Path
from unittest.mock import patch

from games.borderstrife.api import backups, store
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.presets import PRESETS
from games.borderstrife.engine.presets import loader, starts
from games.borderstrife.tools.immutable_assets import write_immutable


class ResourceEfficiencyTests(unittest.TestCase):
    def test_start_choices_cached_equivalent_and_isolated_for_every_map(self):
        starts._starting_choices.cache_clear()
        loader._geography.cache_clear()
        for preset in PRESETS.values():
            expected = starts._starting_choices.__wrapped__(json.dumps(preset, sort_keys=True))
            first = starts.starting_choices(preset)
            self.assertEqual(first, expected)
            with patch.object(loader, 'load_preset', side_effect=AssertionError('Cache miss')):
                second = starts.starting_choices(preset)
            first[0]['regions'].clear()
            self.assertEqual(second, expected)
            for choice in second:
                state = loader.load_preset(preset, start_region_id=choice['id'])
                self.assertEqual(state.total_army('player_1'), choice['army'])
                self.assertEqual([r.name for r in state.owned_regions('player_1')], choice['regions'])
        self.assertLessEqual(starts._starting_choices.cache_info().currsize, 64)

    def test_geography_read_once_and_campaigns_do_not_share_mutable_data(self):
        loader._geography.cache_clear()
        starts._starting_choices.cache_clear()
        read = Path.read_text
        paths = []
        def tracked(path, *args, **kwargs):
            paths.append(path)
            return read(path, *args, **kwargs)
        with patch.object(Path, 'read_text', tracked):
            starts.starting_choices(PRESETS['india'])
        self.assertEqual(len(paths), 1)
        a = GameEngine.from_preset('india').state
        b = GameEngine.from_preset('india').state
        a.routes.clear(); a.ports.clear(); a.regions[0].neighbors.clear(); a.regions[0].army = -1
        self.assertEqual(asdict(b), asdict(GameEngine.from_preset('india').state))

    def test_changed_preset_invalidates_choices(self):
        original = PRESETS['india']
        altered = copy.deepcopy(original)
        altered['regions'][0][0] = 'Changed label'
        self.assertNotEqual(starts.starting_choices(original), starts.starting_choices(altered))

    def test_single_pass_exports_match_previous_format(self):
        for outcome in (None, 'player_1', 'player_2', 'draw'):
            engine = GameEngine.from_preset('india', player1_name='राजा 🏰')
            engine.campaign_name = 'Café — 雪'
            engine.state.game_over = outcome is not None
            engine.state.winner = outcome
            engine.state.resigned = outcome == 'player_2'
            if outcome == 'draw':
                engine.state.turn = 30
                engine.state.draw_offer_turn = 30
                engine.state.draw_offer_message = 'Draw accepted.'
                engine.state.draw_offers = [dict(turn=30, accepted=True, message='Draw accepted.')]
            expected = {'format': backups.FORMAT, 'version': 1, 'campaign': json.loads(store._encode(engine))}
            payload = backups.encode(engine)
            self.assertEqual(json.loads(payload), expected)
            self.assertEqual(asdict(backups.decode(payload).state), asdict(engine.state))
            with patch.object(backups, 'MAX_BYTES', len(payload)-1):
                with self.assertRaises(ValueError): backups.encode(engine)

    def test_new_versions_preserve_old_map_assets_and_rules(self):
        root = Path(__file__).resolve().parents[1]
        for key in ('greco_persian', 'viking_conquests', 'japan_korea'):
            old, new = key+'_atlas_v5', key+'_atlas_v6'
            self.assertEqual(PRESETS[key]['map_asset_id'], new)
            atlas = lambda asset: json.loads((root/f'ui/maps/{asset}.json').read_text())
            before, after = atlas(old), atlas(new)
            before['id'] = new
            self.assertEqual(before, after)
            for folder, suffix in [('engine/presets/geography', '.json'), ('ui/maps/thumbnails', '.svg')]:
                self.assertEqual((root/f'{folder}/{old}{suffix}').read_bytes(), (root/f'{folder}/{new}{suffix}').read_bytes())

    def test_published_assets_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'example_v1.json'
            write_immutable(path, 'first')
            write_immutable(path, 'first')
            with self.assertRaisesRegex(ValueError, 'new asset version'): write_immutable(path, 'second')
            self.assertEqual(path.read_text(), 'first')
            write_immutable(Path(directory)/'example_v2.json', 'second')

    def test_restore_constructs_from_validated_data_without_store_decode(self):
        engine = GameEngine(GameEngine.from_preset('india', player1_name='राजा').state, seed=123)
        engine.state.standing_orders = []
        payload = backups.encode(engine)
        with patch.object(store, '_decode', side_effect=AssertionError('Redundant JSON decoding')):
            restored = backups.decode(payload)
        self.assertEqual(asdict(engine.state), asdict(restored.state))
        self.assertEqual(engine._base_seed, restored._base_seed)
        self.assertEqual(engine.campaign_name, restored.campaign_name)
        self.assertFalse(restored._journal)
        self.assertFalse(restored._replay_indexed)
        self.assertIsNone(restored._replay_start)
        from games.borderstrife.engine.models import TurnActions
        for candidate in (engine, restored):
            candidate.submit_actions("player_1", TurnActions("player_1", []))
        self.assertEqual(asdict(engine.resolve_turn(seed=456)), asdict(restored.resolve_turn(seed=456)))
        self.assertEqual(asdict(engine.state), asdict(restored.state))

    def test_preset_api_imports_do_not_load_generation_dependencies(self):
        import subprocess
        import sys
        subprocess.run([sys.executable, '-c', '''
import sys
import api.main
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.presets import PRESETS
from games.borderstrife.api import backups
for name in PRESETS:
    engine = GameEngine.from_preset(name)
    backups.decode(backups.encode(engine))
assert 'numpy' not in sys.modules
assert 'scipy' not in sys.modules
assert 'games.borderstrife.engine.map_generator' not in sys.modules
# The fallback still works when explicitly requested.
from games.borderstrife.engine.presets.loader import _build_adjacency
adj = _build_adjacency([(0,0),(1,0),(0,1),(1,1)],2,[],[])
assert all(adj) and all(i in adj[j] for i,ns in enumerate(adj) for j in ns)
from dataclasses import asdict
assert asdict(GameEngine.new_game(seed=42).state) == asdict(GameEngine.new_game(seed=42).state)
'''], check=True)
