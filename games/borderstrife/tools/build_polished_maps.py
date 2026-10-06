"""Build atlas_v4 Regional Map presentation assets without changing routes.

python -m games.borderstrife.tools.build_polished_maps /path/to/provinces.zip
Older regional assets are retained for saved games and replay.
"""
import copy
import json
from pathlib import Path
import sys
import numpy as np
import shapefile
from shapely import set_precision
from shapely.geometry import Polygon, Point, box, shape
from shapely.ops import unary_union, transform, nearest_points
from .map_partition import pieces
from .map_details import WATERS
ROOT=Path(__file__).resolve().parents[1]

def rings(geometry):
    geometry = set_precision(geometry, 1e-06, mode='valid_output')
    return [[[[round(x, 6), round(y, 6)] for x, y in ring.coords] for ring in [p.exterior, *p.interiors]] for p in pieces(geometry) if p.area > 1e-10]

def geometry(feature):
    return unary_union([Polygon(p[0], p[1:]) for p in feature['polygons']])

def build(archive, only=None):
    source = json.loads((ROOT / 'engine/presets/reviewed.json').read_text())
    provinces = [shape(r.shape.__geo_interface__).buffer(0) for r in shapefile.Reader(str(archive)).iterShapeRecords()]
    target = ROOT / 'engine/presets/polished.json'
    out = json.loads(target.read_text()) if only and target.exists() else {}
    for key, preset in source.items():
        if only and key != only:
            continue
        p = copy.deepcopy(preset)
        old = p['map_asset_id']
        asset = key + ('_atlas_v5' if key in {'japan_korea','viking_conquests','greco_persian'} else '_atlas_v4')
        a = json.loads((ROOT / f'ui/maps/{old}.json').read_text())
        cells = [geometry(r) for r in a['regions']]
        old_land = unary_union(cells)
        for r, c in zip(a['regions'], cells):
            assert c.is_valid and c.buffer(1e-06).covers(Point(r['center'])), (key, r['name'])
            r['polygons'] = rings(c)
        cells = [geometry(r) for r in a['regions']]
        land = unary_union(cells)
        rules = json.loads((ROOT / f'engine/presets/geography/{old}.json').read_text())
        old_cells = [geometry(r) for r in json.loads((ROOT / f'ui/maps/{old}.json').read_text())['regions']]
        for i in range(len(cells)):
            for j in range(i):
                assert (cells[i].distance(cells[j]) < 1e-05) == (old_cells[i].distance(old_cells[j]) < 1e-05), (key, i, j, 'adjacency changed')
        west, south, east, north = a['bounds']
        dx = east - west
        dy = north - south
        pad = max(0.4, 1 / a['aspect'])
        frame = box(max(-180, west - pad * dx), max(-90, south - 0.7 * dy), min(180, east + pad * dx), min(90, north + 0.7 * dy))
        surrounding = unary_union([g.intersection(frame) for g in provinces if g.intersects(frame)])
        surrounding = transform(lambda x, y: ((np.asarray(x) - west) / dx, (north - np.asarray(y)) / dy), surrounding).simplify(0.0007, preserve_topology=True)
        context = surrounding
        a['context_land'] = rings(context)
        a['inland_frame'] = surrounding.intersection(box(0, 0, 1, 1)).area > 0.995
        if key in WATERS:
            water = box(0, 0, 1, 1).difference(surrounding)
            labels = []
            for name, x, y in WATERS[key]:
                if not west <= x <= east or not south <= y <= north:
                    continue
                point = Point((x - west) / dx, (north - y) / dy)
                if water.is_empty or point.distance(water) > 0.04:
                    continue
                if not water.covers(point):
                    point = nearest_points(water, point)[0]
                labels.append(dict(name=name, center=list(point.coords[0])))
            a['water_labels'] = labels
        a['presentation_version'] = 4
        a['label_columns'] = key == 'andes_pacific'
        a['cartography_note'] = 'Land outside the outlined theater is context only. Landmarks and vegetation are illustrative.'
        a['id'] = asset
        p['map_asset_id'] = asset
        a['setting'] = p.get('setting', {})
        for path, data in [(ROOT / f'ui/maps/{asset}.json', a), (ROOT / f'engine/presets/geography/{asset}.json', rules)]:
            path.write_text(json.dumps(data, separators=(',', ':')) + '\n')
        out[key] = p
        print(key, flush=True)
    target.write_text(json.dumps(out, indent=2) + '\n')

if __name__=='__main__':build(Path(sys.argv[1]),sys.argv[2] if len(sys.argv)>2 else None)
