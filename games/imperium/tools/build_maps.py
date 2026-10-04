"""Build bundled atlas geometry. Dev dependencies: shapely, pyshp.

Usage: python build_maps.py /path/to/ne_10m_admin_1_states_provinces.zip
Natural Earth 5.1.1, public domain. No network or GIS dependency at runtime.
"""
import json
import math
from pathlib import Path
import runpy
import sys

import shapefile
from shapely import coverage_simplify
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
ANCHORS = json.loads(Path(__file__).with_name('anchors.json').read_text())
# West, south, east, north: deliberately retain surrounding land for context.
BOUNDS = {
    'europe': [-12, 33, 55, 71], 'western_europe': [-12, 35, 24, 66],
    'eastern_europe': [10, 40, 55, 62], 'mediterranean': [-12, 24, 49, 52],
    'middle_east': [18, 12, 72, 45], 'central_asia': [44, 25, 136, 61],
    'india': [62, 5, 98, 37.5], 'southeast_asia': [90, -11, 133, 25],
}


def polygons(g):
    if g.geom_type == 'Polygon':
        yield g
    elif hasattr(g, 'geoms'):
        for child in g.geoms:
            yield from polygons(child)


def half_plane(a, b):
    dx, dy = b.x-a.x, b.y-a.y
    length = math.hypot(dx, dy)
    nx, ny = dx/length, dy/length
    mx, my = (a.x+b.x)/2, (a.y+b.y)/2
    extent = 1000
    return Polygon([(mx-ny*extent, my+nx*extent),
                    (mx+ny*extent, my-nx*extent),
                    (mx+ny*extent-nx*extent, my-nx*extent-ny*extent),
                    (mx-ny*extent-nx*extent, my+nx*extent-ny*extent)])


def build(source, only=None):
    reader = shapefile.Reader(str(source), encoding='utf-8')
    provinces = [shape(s.__geo_interface__).buffer(0) for s in reader.shapes()]
    for key, coords in ANCHORS.items():
        if only and key != only:
            continue
        preset = runpy.run_path(str(ROOT / 'engine' / 'presets' / f'{key}.py'))['PRESET']
        assert len(coords) == len(preset['regions'])
        west, south, east, north = BOUNDS[key]
        cosine = math.cos(math.radians((south+north)/2))
        project = lambda x, y, z=None: (x*cosine, -y)
        frame = box(west, south, east, north)
        points = [Point(*project(*c)) for c in coords]
        fixed = {}
        for file in sorted(Path(__file__).with_name('boundaries').glob('*.geojson')):
            feature = json.loads(file.read_text())
            if feature['properties']['preset'] == key:
                region_id = feature['properties']['region_id']
                assert preset['regions'][region_id][0] == feature['properties']['name']
                fixed[region_id] = transform(project, shape(feature['geometry']))
        generated_ids = [i for i in range(len(points)) if i not in fixed]
        pieces = []
        for province in provinces:
            if province.intersects(frame):
                # Keep original topology until after dissolving province boundaries.
                g = transform(project, province.intersection(frame))
                pieces.extend(p for p in polygons(g) if p.area > .0001)
        # Assign each anchor its nearest province, including tiny offshore/costal offsets.
        homes = [min(range(len(pieces)), key=lambda j: pieces[j].distance(p)) for p in points]
        assigned = [[] for _ in points]
        for j, piece in enumerate(pieces):
            residents = [i for i in generated_ids if homes[i] == j]
            if not residents:
                center = piece.representative_point()
                residents = [min(generated_ids, key=lambda i: center.distance(points[i]))]
            for i in residents:
                part = piece
                # Cities sharing a modern province need a synthetic gameplay division.
                for other in residents:
                    if other != i:
                        part = part.intersection(half_plane(points[i], points[other]))
                assigned[i].append(part)
        xmin, ymax = west*cosine, -south
        width, height = (east-west)*cosine, north-south
        def xy(x, y):
            return [round((x-xmin)/width, 6), round((y+north)/height, 6)]
        def rings(g):
            return [[ [xy(x,y) for x,y in ring.coords]
                       for ring in [p.exterior, *p.interiors]] for p in polygons(g)]
        territories = [unary_union(parts) for parts in assigned]
        for region_id, boundary in fixed.items():
            # Carve the exact footprint before simplifying the shared edges.
            territories = [g.difference(boundary) if i != region_id else boundary
                           for i, g in enumerate(territories)]
        territories = coverage_simplify(territories, .025)
        regions = []
        for i, territory in enumerate(territories):
            assert not territory.is_empty, (key, i)
            marker = points[i]
            if not territory.covers(marker):
                marker = max(polygons(territory), key=lambda p: p.area).representative_point()
            regions.append({'id': i, 'name': preset['regions'][i][0],
                            'center': xy(marker.x, marker.y), 'polygons': rings(territory)})
        data = {'id': key, 'aspect': width/height, 'bounds': BOUNDS[key],
                'source': 'Natural Earth 1:10m admin-1, 5.1.1 (public domain)',
                'regions': regions}
        target = ROOT / 'ui' / 'maps' / f'{key}.json'
        target.write_text(json.dumps(data, separators=(',', ':')) + '\n')
        print(key, target.stat().st_size)


if __name__ == '__main__':
    build(Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else None)
