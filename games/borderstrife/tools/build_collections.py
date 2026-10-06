"""Build the additional regional theaters from Natural Earth province and river archives.

python -m games.borderstrife.tools.build_collections /path/to/provinces.zip /path/to/rivers.zip
"""
import json
import math
from pathlib import Path
import sys
import numpy as np
import shapefile
from shapely import coverage_simplify
from shapely.geometry import Polygon, Point, LineString, MultiPoint, box, shape
from shapely.ops import transform, unary_union, nearest_points
from .collection_sources import MAPS as REGIONAL_MAPS
from .historical_sources import MAPS as HISTORICAL_MAPS
MAPS = [*REGIONAL_MAPS, *HISTORICAL_MAPS]
from .build_maps import half_plane, polygons
from .build_compact_maps import connected
from .build_strategy_maps import lines
from games.borderstrife.engine.presets.starts import kingdom_layout
ROOT=Path(__file__).resolve().parents[1]

def frame_for(m):
    w, s, e, n = m['bounds']
    cos = math.cos(math.radians((s + n) / 2))
    return (e - w) * cos / (n - s)

def normalize(m, x, y):
    w, s, e, n = m['bounds']
    return ((x - w) / (e - w), (n - y) / (n - s))

def geography(m, provinces):
    """Assign real administrative pieces to anchors; split only shared home provinces."""
    w, s, e, n = m['bounds']
    frame = box(w, s, e, n)
    aspect = frame_for(m)
    project = lambda x, y, z=None: ((x - w) / (e - w) * aspect, (n - y) / (n - s))
    points = [Point(*project(site[2], site[3])) for site in m['sites']]
    pieces = []
    piece_countries = []
    countries = set(m['countries'])
    for country, geom in provinces:
        if country not in countries or not geom.intersects(frame):
            continue
        fragments=[p for p in polygons(transform(project, geom.intersection(frame))) if p.area > 1e-08]
        pieces.extend(fragments)
        piece_countries.extend([country]*len(fragments))
    assert pieces, m['id']
    if m.get('historical_sectors'):
        from .map_partition import partition
        land = unary_union(pieces).buffer(0)
        for i, point in enumerate(points):
            if land.distance(point) > .004:
                raise ValueError((m['id'], m['sites'][i][0], 'anchor outside theater'))
        return partition(land, points, aspect, compactness=.15), points
    anchors=m.get('anchor_countries')
    homes = [min((j for j in range(len(pieces)) if not anchors or piece_countries[j]==anchors[i]), key=lambda j: pieces[j].distance(p)) for i,p in enumerate(points)]
    assigned = [[] for _ in points]
    for j, piece in enumerate(pieces):
        residents = [i for i, h in enumerate(homes) if h == j]
        if not residents:
            residents = [min((i for i in range(len(points)) if not anchors or anchors[i]==piece_countries[j]), key=lambda i: piece.representative_point().distance(points[i]))]
        for i in residents:
            cell = piece
            for other in residents:
                if i != other:
                    cell = cell.intersection(half_plane(points[i], points[other]))
            assigned[i].append(cell)
    cells = [unary_union(p).buffer(0) for p in assigned]
    cells = list(coverage_simplify(cells, min(0.0015, aspect * 0.001)))
    for i, cell in enumerate(cells):
        assert not cell.is_empty, (m['id'], i)
        if not cell.covers(points[i]):
            points[i] = max(polygons(cell), key=lambda p: p.area).representative_point()
    return (cells, points)

def routes_for(m, cells, points, rivers):
    aspect = frame_for(m)
    routes = {}
    edges = set()
    n = len(cells)
    water = unary_union([LineString([(x * aspect, y) for x, y in r['points']]) for r in rivers if len(r['points']) > 1])
    for a in range(n):
        for b in range(a + 1, n):
            first, second = (cells[a], cells[b])
            shared = first.boundary.intersection(second.boundary).length
            near = first.distance(second) <= 1e-06 and first.buffer(1e-06).intersection(second).length > 1e-05
            if shared <= 1e-07 and (not near):
                continue
            edge = (a, b)
            edges.add(edge)
            routes[f'{a}:{b}'] = 'river' if LineString([points[a], points[b]]).intersects(water) else 'pass' if any((m['sites'][i][1] == 'hills' for i in edge)) else 'road'
    ports = set()
    names = {site[0]: i for i, site in enumerate(m['sites'])}
    for first, second in m.get('sea_routes', []):
        a, b = sorted((names[first], names[second]))
        if (a, b) not in edges:
            edges.add((a, b))
            routes[f'{a}:{b}'] = 'sea'
            ports.update((a, b))
    while not connected(n, edges):
        reached = {0}
        todo = [0]
        while todo:
            a = todo.pop()
            for x, y in edges:
                b = y if x == a else x if y == a else None
                if b is not None and b not in reached:
                    reached.add(b)
                    todo.append(b)
        a, b = min(((a, b) for a in reached for b in range(n) if b not in reached), key=lambda ab: cells[ab[0]].distance(cells[ab[1]]))
        a, b = sorted((a, b))
        edges.add((a, b))
        routes[f'{a}:{b}'] = 'sea'
        ports.update((a, b))
    neighbors = {str(i): sorted((b if a == i else a for a, b in edges if i in (a, b))) for i in range(n)}
    return dict(neighbors=neighbors, routes=routes, ports=sorted(ports))

def build(province_archive, river_archive, only=None):
    provinces = [(r.record['adm0_a3'], r.record['adm1_code'], r.record['geonunit'], shape(r.shape.__geo_interface__).buffer(0)) for r in shapefile.Reader(str(province_archive)).iterShapeRecords()]
    river_source = [(r.record['name_en'] or r.record['name'] or 'River', shape(r.shape.__geo_interface__)) for r in shapefile.Reader(str(river_archive)).iterShapeRecords() if r.record['scalerank'] <= 5]
    target = ROOT / 'engine/presets/expansion.json'
    presets = json.loads(target.read_text()) if target.exists() else {}
    for m in MAPS:
        if only and m['id'] != only:
            continue
        aspect = frame_for(m)
        extras = {}
        rivers = []
        scope=m.get('province_ids',{})
        scoped=[(country,g) for country,code,unit,g in provinces if (country not in scope or code in scope[country]) and (not m.get('geounits') or unit in m['geounits'])]
        cells, points = geography(m, scoped)
        w, s, e, n = m['bounds']
        frame = box(w, s, e, n)
        for name, g in river_source:
            if not g.intersects(frame):
                continue
            for segment in lines(transform(lambda x, y: normalize(m, x, y), g.intersection(frame)).simplify(0.0007)):
                rivers.append(dict(name=name, points=[[round(x, 6), round(y, 6)] for x, y in segment.coords]))
        cells = [transform(lambda x, y: (np.round(np.asarray(x) / aspect, 6) * aspect, np.round(y, 6)), c).buffer(0) for c in cells]
        features = []
        raw = []
        for i, (cell, point, site) in enumerate(zip(cells, points, m['sites'])):
            assert cell.is_valid and (not cell.is_empty), (m['id'], i)
            if not cell.covers(point):
                if m.get('historical_sectors'):
                    interior = cell.buffer(-.00005)
                    point = nearest_points(interior if not interior.is_empty else cell, point)[0]
                else:
                    point = max(polygons(cell), key=lambda g: g.area).representative_point()
                points[i] = point
            center = [round(point.x / aspect, 6), round(point.y, 6)]
            rings = [[[[round(x / aspect, 6), round(y, 6)] for x, y in ring.coords] for ring in [poly.exterior, *poly.interiors]] for poly in polygons(cell)]
            features.append(dict(id=i, name=site[0], center=center, polygons=rings))
            raw.append([site[0], site[1], *center])
        rules = routes_for(m, cells, points, rivers)
        adjacency = [set(rules['neighbors'][str(i)]) for i in range(len(raw))]
        seat, rival, friendly, enemy = recommended_layout(m, raw, adjacency)
        asset = m['id'] + ('_v2' if m['id'] in {'japan_korea','viking_conquests','greco_persian'} else '_v1')
        note = 'Modern coastlines and administrative geometry define gameplay regions; these are not exact historical political borders.'
        if m.get('historical_sectors'):
            note = 'Modern coastlines; interpreted gameplay sectors around historical places, not exact period borders. Starting territories are balanced for open-ended conquest, not historical deployments. Terrain symbols are illustrative.'
        description = m['description'] + f' {len(raw)} regions.'
        preset = dict(id=m['id'], name=m['name'], category=m['category'], description=description, map_asset_id=asset, regions=raw, player1_capital=seat, player2_capital=rival, player1_extra_starts=sorted(friendly - {seat}), player2_extra_starts=sorted(enemy - {rival}), setting=dict(era=m.get('era', m.get('date', '')), note=note, sources=[m['source']] if 'source' in m else [], terrain_note=note))
        if m.get('historical_sectors'):
            preset['historical_sectors'] = True
            preset['sea_routes'] = m.get('sea_routes', [])
        if m.get('anchor_countries'):preset['anchor_countries']=m['anchor_countries']
        attribution = 'Natural Earth · Gameplay borders approximated'
        atlas = dict(id=asset, category=m['category'], aspect=aspect, bounds=m['bounds'], regions=features, rivers=rivers, water_labels=[], attribution=attribution, **{k: v for k, v in extras.items() if k not in ('rivers', 'water_labels')})
        atlas['water_labels'] = extras.get('water_labels', [])
        atlas['setting'] = preset['setting']
        for path, data in [(ROOT / f'ui/maps/{asset}.json', atlas), (ROOT / f'engine/presets/geography/{asset}.json', rules)]:
            path.write_text(json.dumps(data, separators=(',', ':')) + '\n')
        presets[m['id']] = preset
        print(m['id'], len(raw), 'regions', len(rules['routes']), 'routes', flush=True)
    target.write_text(json.dumps(presets, indent=2) + '\n')

def recommended_layout(m, raw, adjacency):
    seat = next((i for i, r in enumerate(raw) if r[1] == 'city'), 0)
    if m.get('capital'):
        seat = next(i for i, r in enumerate(raw) if r[0] == m['capital'])
    friendly, enemy, rival = kingdom_layout(raw, adjacency, seat)
    return (seat, rival, friendly, enemy)

if __name__=='__main__':build(Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3] if len(sys.argv)>3 else None)
