"""Ensure the curated collection is playable and retired campaigns remain readable."""
import json
from pathlib import Path
import runpy
import unittest
from pydantic import ValidationError
from games.imperium.api.routes import NewGameRequest
from games.imperium.api.store import _encode, _decode
from games.imperium.engine.game_engine import GameEngine
from games.imperium.engine.models import TurnActions
from games.imperium.engine.presets import PRESETS
from games.imperium.engine.presets.loader import load_preset

ROOT = Path(__file__).resolve().parents[1]


class CollectionTests(unittest.TestCase):
    def test_collection_and_random_rejection(self):
        self.assertEqual(set(PRESETS), {'mediterranean', 'europe', 'india', 'central_asia',
            'americas', 'africa_middle_east', 'southeast_asia_oceania'})
        with self.assertRaises(ValidationError):
            NewGameRequest(mode='random')
        for key in ['eastern_europe', 'western_europe', 'middle_east', 'southeast_asia']:
            with self.assertRaises(ValueError):
                GameEngine.from_preset(key)

    def test_geometry_routes_and_turns(self):
        for key, preset in PRESETS.items():
            with self.subTest(map=key):
                engine = GameEngine.from_preset(key)
                state = engine.state
                atlas = json.loads((ROOT / f'ui/maps/{key}.json').read_text())
                self.assertEqual([r['name'] for r in atlas['regions']], [r[0] for r in preset['regions']])
                seen, todo = set(), [0]
                while todo:
                    current = todo.pop()
                    if current in seen: continue
                    seen.add(current)
                    todo.extend(state.regions[current].neighbors)
                self.assertEqual(seen, set(state.regions))
                for rid, region in state.regions.items():
                    for neighbor in region.neighbors:
                        self.assertIn(rid, state.regions[neighbor].neighbors)
                        self.assertIn(f'{min(rid,neighbor)}:{max(rid,neighbor)}', state.routes)
                for player in state.players:
                    owned = {r.id for r in state.owned_regions(player.id)}
                    reached, queue = set(), [player.capital_region_id]
                    while queue:
                        r = queue.pop()
                        if r in reached: continue
                        reached.add(r)
                        queue.extend(set(state.regions[r].neighbors) & owned - reached)
                    self.assertEqual(reached, owned, 'Recommended starts must be connected')
                engine.submit_actions('player_1', TurnActions('player_1', []))
                engine.resolve_turn(seed=1)
                self.assertEqual(engine.state.turn, 2)

    def test_expanded_land_coverage(self):
        # Test actual inland locations, including territories with non-ISO source codes.
        samples = {
            'africa_middle_east': [(31.6, 4.85), (-1.5, 12.4), (47, -20), (53, 29)],
            'americas': [(-53, 4), (-150, 64), (-68, -54), (-99, 19)],
            'southeast_asia_oceania': [(121, 16), (117, 6), (135, -4), (149, -33), (176, -38), (171, -44)],
        }
        def inside_ring(x, y, ring):
            inside = False
            for (ax, ay), (bx, by) in zip(ring, ring[1:]):
                if (ay > y) != (by > y) and x < (bx-ax)*(y-ay)/(by-ay)+ax:
                    inside = not inside
            return inside
        for key, locations in samples.items():
            data = json.loads((ROOT / f'ui/maps/{key}.json').read_text())
            west, south, east, north = data['bounds']
            for lon, lat in locations:
                x, y = (lon-west)/(east-west), (north-lat)/(north-south)
                covered = any(inside_ring(x, y, polygon[0]) and not any(
                    inside_ring(x, y, hole) for hole in polygon[1:])
                    for region in data['regions'] for polygon in region['polygons'])
                self.assertTrue(covered, (key, lon, lat))

    def test_old_campaigns_remain_readable(self):
        for key in ['eastern_europe', 'western_europe', 'middle_east', 'southeast_asia']:
            preset = runpy.run_path(str(ROOT / f'engine/presets/{key}.py'))['PRESET']
            restored = _decode(_encode(GameEngine(load_preset(preset))))
            self.assertEqual(restored.state.preset_id, key)
            atlas = json.loads((ROOT / f'ui/maps/{key}.json').read_text())
            self.assertEqual(len(restored.state.regions), len(atlas['regions']))
