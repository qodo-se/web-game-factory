"""Geographic regression checks; run with Python + Shapely 2.1.2."""
import json
from pathlib import Path
import unittest

from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]


class KashyapMeerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas = json.loads((ROOT / 'ui/maps/india.json').read_text())
        cls.regions = [unary_union([Polygon(p[0], p[1:]) for p in r['polygons']])
                       for r in cls.atlas['regions']]
        cls.territory = cls.regions[36]

    def point(self, lon, lat):
        west, south, east, north = self.atlas['bounds']
        return Point((lon-west)/(east-west), (north-lat)/(north-south))

    def test_historical_components(self):
        for name, lon, lat in [
            ('Srinagar', 74.8, 34.08), ('Jammu', 74.86, 32.73),
            ('Leh', 77.58, 34.15), ('Gilgit', 74.3, 35.92),
            ('Muzaffarabad', 73.47, 34.37), ('Aksai Chin', 79.2, 35.1),
            ('Shaksgam', 76.44, 35.96), ('Siachen', 77.15, 35.4),
        ]:
            with self.subTest(name=name):
                self.assertTrue(self.territory.covers(self.point(lon, lat)))

    def test_neighbors_retained_and_no_overlaps(self):
        self.assertEqual(self.atlas['regions'][36]['name'], 'Kashyap Meer')
        self.assertTrue(self.territory.is_valid)
        self.assertTrue(self.regions[0].covers(self.point(72.84, 33.74)))
        self.assertTrue(self.regions[1].covers(self.point(74.8, 31.3)))
        for lon, lat in [(72.84, 33.74), (74.8, 31.3), (77.1, 31.1), (69.2, 34.55)]:
            self.assertFalse(self.territory.covers(self.point(lon, lat)))
        for i, neighbor in enumerate(self.regions[:36]):
            with self.subTest(region=i):
                # Six-decimal asset rounding allows <0.01 pixel² at 1000×1000.
                self.assertLess(self.territory.intersection(neighbor).area, 1e-8)

    def test_outline_preserved_without_clipping_or_extra_provinces(self):
        source = json.loads((ROOT / 'tools/boundaries/kashyap_meer.geojson').read_text())
        west, south, east, north = self.atlas['bounds']
        boundary = transform(lambda x, y: ((x-west)/(east-west), (north-y)/(north-south)),
                             shape(source['geometry']))
        # Only map-scale simplification may change the source footprint.
        self.assertLess(self.territory.symmetric_difference(boundary).area / boundary.area, .01)


if __name__ == '__main__':
    unittest.main()
