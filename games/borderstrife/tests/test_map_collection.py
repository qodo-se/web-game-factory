"""Ensure the curated collection is playable and retired campaigns remain readable."""
import json
from pathlib import Path
import runpy
import unittest
from pydantic import ValidationError
from games.borderstrife.api.routes import NewGameRequest
from games.borderstrife.api.store import _encode, _decode
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import TurnActions
from games.borderstrife.engine.presets import PRESETS
from games.borderstrife.engine.presets.loader import load_preset

ROOT = Path(__file__).resolve().parents[1]


class CollectionTests(unittest.TestCase):
    def test_collection_and_random_rejection(self):
        self.assertEqual(set(PRESETS), {'mediterranean', 'europe', 'india', 'central_asia',
            'americas', 'africa_middle_east', 'southeast_asia_oceania', 'balochistan_borderlands_expanded',
            'japan_korea','british_irish_isles','anatolia_caucasus',
            'crusader_levant','civil_war_eastern_theater','greco_persian','viking_conquests','norman_england_1066'})
        with self.assertRaises(ValidationError):
            NewGameRequest(mode='random')
        for key in ['nile_horn', 'napoleon_1805', 'eastern_europe', 'western_europe', 'middle_east', 'southeast_asia', 'pakistan_afghanistan', 'balochistan_borderlands', 'waterloo', 'crusader_states', 'malta', 'emberfall', 'andes_pacific', 'caribbean_central_america']:
            with self.assertRaises(ValueError):
                GameEngine.from_preset(key)

    def test_geometry_routes_and_turns(self):
        for key, preset in PRESETS.items():
            with self.subTest(map=key):
                engine = GameEngine.from_preset(key)
                state = engine.state
                atlas = json.loads((ROOT / f'ui/maps/{PRESETS[key].get("map_asset_id",key)}.json').read_text())
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
            'japan_korea': [(142,43.5),(139.7,35.68),(126.98,37.57),(123.43,41.8),(125.32,43.82),(126.64,45.76),(131.89,43.12),(135.07,48.48),(127.53,50.29),(142.73,50.4),(158.65,53.02),(150.8,59.56),(161.5,60.0)],
            'balochistan_borderlands_expanded': [(62.20,34.35),(69.18,34.53),(66.99,30.18),(63.05,26.00),(60.86,29.50),(60.64,25.29),(62.33,27.37),(61.50,31.03)],
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
            data = json.loads((ROOT / f'ui/maps/{PRESETS[key].get("map_asset_id",key)}.json').read_text())
            west, south, east, north = data['bounds']
            for lon, lat in locations:
                x, y = (lon-west)/(east-west), (north-lat)/(north-south)
                covered = any(inside_ring(x, y, polygon[0]) and not any(
                    inside_ring(x, y, hole) for hole in polygon[1:])
                    for region in data['regions'] for polygon in region['polygons'])
                self.assertTrue(covered, (key, lon, lat))

    def test_borderlands_scope_and_cross_border_routes(self):
        preset = PRESETS['balochistan_borderlands_expanded']
        data = json.loads((ROOT / f'ui/maps/{preset.get("map_asset_id",preset["id"])}.json').read_text())
        west, south, east, north = data['bounds']

        def contains(lon, lat):
            x, y = (lon-west)/(east-west), (north-lat)/(north-south)
            def ring_contains(ring):
                inside = False
                for (ax, ay), (bx, by) in zip(ring, ring[1:]):
                    if (ay > y) != (by > y) and x < (bx-ax)*(y-ay)/(by-ay)+ax:
                        inside = not inside
                return inside
            return any(ring_contains(p[0]) and not any(ring_contains(h) for h in p[1:])
                       for region in data['regions'] for p in region['polygons'])

        # Exclusion must remove land, not just rename or reassign its sectors.
        for lon, lat in [(74.30,35.92), (75.64,35.30), (73.47,34.37),
                         (57.08,30.28)]:
            self.assertFalse(contains(lon, lat), (lon, lat))
        for lon, lat in [(60.86,29.50), (62.33,27.37), (60.68,27.20),
                         (60.64,25.29), (66.99,30.18), (65.72,31.63), (71.58,34.02),
                         (74.35,31.55), (67.01,24.86), (68.37,25.40), (71.47,30.20),
                         (69.80,24.75), (73.04,33.60), (66.90,36.75), (68.86,36.73),
                         (70.58,37.12), (73.20,37.02), (74.70,37.32), (64.77,35.92)]:
            self.assertTrue(contains(lon, lat), (lon, lat))
        self.assertTrue({'Gilgit', 'Baltistan'}.isdisjoint(r[0] for r in preset['regions']))
        state = GameEngine.from_preset('balochistan_borderlands_expanded').state
        countries = preset['anchor_countries']
        crossings = {frozenset((countries[a], countries[b]))
                     for a, region in state.regions.items() for b in region.neighbors
                     if countries[a] != countries[b]}
        for pair in [('IRN','PAK'), ('IRN','AFG'), ('PAK','AFG')]:
            self.assertIn(frozenset(pair), crossings)

    def test_northeast_asia_and_older_japan_save(self):
        from games.borderstrife.api import backups
        current = PRESETS['japan_korea']
        self.assertEqual(current['name'], 'Northeast Asia')
        self.assertEqual(len(current['regions']), 30)
        self.assertEqual(current['map_asset_id'], 'japan_korea_atlas_v5')
        self.assertEqual(set(current['anchor_countries']), {'JPN','KOR','PRK','CHN','RUS'})
        previous=json.loads((Path(__file__).parent/'fixtures/previous_japan_korea.json').read_text())
        engine=GameEngine(load_preset(previous))
        restored=backups.decode(backups.encode(engine))
        self.assertEqual(restored.state,engine.state)
        self.assertEqual(len(restored.state.regions),24)
        self.assertEqual(restored.state.map_asset_id,'japan_korea_atlas_v4')

    def test_old_campaigns_remain_readable(self):
        for key in ['eastern_europe', 'western_europe', 'middle_east', 'southeast_asia', 'pakistan_afghanistan', 'balochistan_borderlands']:
            preset = runpy.run_path(str(ROOT / f'engine/presets/{key}.py'))['PRESET']
            restored = _decode(_encode(GameEngine(load_preset(preset))))
            self.assertEqual(restored.state.preset_id, key)
            atlas = json.loads((ROOT / f'ui/maps/{key}.json').read_text())
            self.assertEqual(len(restored.state.regions), len(atlas['regions']))

    def test_retired_theaters_restore(self):
        from games.borderstrife.api import backups
        retired=json.loads((Path(__file__).parent/'fixtures/retired_theaters.json').read_text())
        for key,preset in retired.items():
            with self.subTest(map=key):
                self.assertNotIn(key,PRESETS)
                engine=GameEngine(load_preset(preset))
                restored=backups.decode(backups.encode(engine))
                self.assertEqual(restored.state,engine.state)
