"""Rebuild Regional Maps into immutable atlas_v3 assets after the map review.

python -m games.borderstrife.tools.build_reviewed_maps /path/to/provinces.zip [map_id]
Sources: bundled compact/expansion definitions, Natural Earth coastlines.
Older assets are never overwritten. This builder deliberately does not import the
active registry, so repeated builds always start from the same reviewed baseline.
"""
import copy
import json
import math
from pathlib import Path
import sys
import numpy as np
import shapefile
from shapely.geometry import Polygon, Point, shape, box, MultiPoint
from shapely import voronoi_polygons
from shapely.ops import unary_union, transform, nearest_points
from .map_partition import partition, balanced_starts, pieces, repair_fragments
from .map_details import WATERS, RIVERS, annotations
from .build_collections import routes_for

ROOT=Path(__file__).resolve().parents[1]
VERSION='atlas_v3'


def normalized_land(atlas):
    aspect=atlas['aspect']
    return unary_union([transform(lambda x,y:(np.asarray(x)*aspect,y),Polygon(p[0],p[1:]).buffer(0)) for r in atlas['regions'] for p in r['polygons']]).buffer(0)


def regional_cells_full(key,preset,atlas,points,compactness=.03):
    land=normalized_land(atlas);aspect=atlas['aspect']
    # Preserve the approved former Jammu & Kashmir outline exactly.
    locked=next((i for i,r in enumerate(preset['regions']) if key=='india' and r[0]=='Kashyap Meer'),None)
    if locked is not None:
        reserved=unary_union([transform(lambda x,y:(np.asarray(x)*aspect,y),Polygon(p[0],p[1:])) for p in atlas['regions'][locked]['polygons']])
        rest=partition(land.difference(reserved),[p for i,p in enumerate(points) if i!=locked],aspect,compactness=compactness)
        rest.insert(locked,reserved);return rest
    if key=='balochistan_borderlands_expanded':
        # Maintain the approved international boundaries and territory coverage.
        cells=[None]*len(points)
        for country in sorted(set(preset['anchor_countries'])):
            ids=[i for i,c in enumerate(preset['anchor_countries']) if c==country]
            subset=copy.deepcopy(atlas);subset['regions']=[atlas['regions'][i] for i in ids]
            split=partition(normalized_land(subset),[points[i] for i in ids],aspect,compactness=compactness)
            for i,c in zip(ids,split):cells[i]=c
        return cells
    return partition(land,points,aspect,compactness=compactness)


def regional_cells(key,preset,atlas,points,compactness=.03):
    aspect=atlas['aspect']
    original=[unary_union([transform(lambda x,y:(np.asarray(x)*aspect,y),Polygon(q[0],q[1:]).buffer(0)) for q in r['polygons']]) for r in atlas['regions']]
    protected=[i for i,r in enumerate(preset['regions']) if key=='india' and r[0]=='Kashyap Meer']
    cells=repair_fragments(original,points,protected)
    config=dict(bounds=atlas['bounds'],kind='regional',sites=preset['regions'],sea_routes=preset.get('sea_routes',[]))
    # Enlarge the three administrative micro-enclaves by repartitioning only
    # nearby territory. All outer geographic boundaries remain unchanged.
    tiny={'nile_horn':'Harar'}
    forced=next((i for i,r in enumerate(preset['regions']) if r[0]==tiny.get(key)),None)
    def graph(cs):return routes_for(config,cs,points,atlas.get('rivers',[]))['neighbors']
    def score(cs):
        ns=graph(cs);return (max(map(len,ns.values())),sum(max(0,len(v)-6) for v in ns.values()))
    for step in range(10):
        ns=graph(cells);hub=forced if step==0 and forced is not None else max(range(len(cells)),key=lambda i:len(ns[str(i)]))
        if hub in protected or (len(ns[str(hub)])<=7 and not (step==0 and forced is not None)):break
        neighbors=sorted(ns[str(hub)],key=lambda i:points[i].distance(points[hub]))
        if preset.get('anchor_countries'):
            neighbors=[i for i in neighbors if preset['anchor_countries'][i]==preset['anchor_countries'][hub]]
        neighbors=[i for i in neighbors if i not in protected]
        best=score(cells);chosen=None
        from itertools import combinations
        for pair in list(combinations(neighbors,2))[:18]:
            ids=[hub,*pair];land=unary_union([cells[i] for i in ids]);seeds=[points[i] for i in ids]
            parts=[g.intersection(land).buffer(0) for g in voronoi_polygons(MultiPoint(seeds),extend_to=land.envelope,ordered=True).geoms]
            if not all(c.covers(point) for c,point in zip(parts,seeds)):continue
            candidate=list(cells)
            for i,c in zip(ids,parts):candidate[i]=c
            candidate=repair_fragments(candidate,points,protected)
            value=score(candidate)
            if step==0 and forced is not None:
                # Require a real improvement to the tiny selectable footprint.
                if candidate[hub].area>cells[hub].area*3 and (chosen is None or value<best):chosen,best=candidate,value
            elif value<best:chosen,best=candidate,value
        if chosen is None:break
        cells=chosen
        if best[0]<=7 and (forced is None or step>0):break
    # If local patches cannot remove a hub, the connected land-growth fallback
    # is limited to that map; it still preserves its exact outer coastline.
    if score(cells)[0]>7 and compactness!=.03:return regional_cells_full(key,preset,atlas,points,compactness)
    return cells


def new_start(preset, rules):
    raw = preset['regions']
    adj = [set(rules['neighbors'][str(i)]) for i in range(len(raw))]
    a, b = (preset['player1_capital'], preset['player2_capital'])
    left, right = balanced_starts(raw, adj, (a, b))
    preset.update(player1_extra_starts=sorted(left - {a}), player2_extra_starts=sorted(right - {b}))
    from games.borderstrife.engine.models import TERRAIN_POP_RATE, TerrainType
    power = lambda group: sum((TERRAIN_POP_RATE[TerrainType(raw[i][1])] for i in group))
    ratio = power(left) / power(right)
    if not 0.8 <= ratio <= 1.25:
        options = []
        for rival in range(len(raw)):
            if rival == a or rival in adj[a]:
                continue
            try:
                l, r = balanced_starts(raw, adj, (a, rival))
            except ValueError:
                continue
            score = abs(math.log(power(l) / power(r)))
            options.append((score, -Point(raw[a][2:]).distance(Point(raw[rival][2:])), rival, l, r))
        if options:
            _, _, b, left, right = min(options, key=lambda x: x[:3])
            preset.update(player2_capital=b, player1_extra_starts=sorted(left - {a}), player2_extra_starts=sorted(right - {b}))
    return (power(left) * 8, power(right) * 8)


def build(archive, only=None):
    provinces = [(r.record['adm0_a3'], shape(r.shape.__geo_interface__).buffer(0)) for r in shapefile.Reader(str(archive)).iterShapeRecords()]
    base = json.loads((ROOT / 'engine/presets/compact.json').read_text())
    base.update(json.loads((ROOT / 'engine/presets/expansion.json').read_text()))
    target = ROOT / 'engine/presets/reviewed.json'
    out = json.loads(target.read_text()) if only and target.exists() else {}
    report_path = ROOT / 'tools/reviewed-map-report.json'
    report = json.loads(report_path.read_text()) if only and report_path.exists() else []
    report = [row for row in report if row['id'] != only]
    for key, original in base.items():
        if only and key != only:
            continue
        p = copy.deepcopy(original)
        a = json.loads((ROOT / f'ui/maps/{p['map_asset_id']}.json').read_text())
        aspect = a['aspect']
        asset = f'{key}_reviewed_v5' if key in {'japan_korea','viking_conquests','greco_persian'} else f'{key}_{VERSION}'
        points = [Point(r['center'][0] * aspect, r['center'][1]) for r in a['regions']]
        cells = regional_cells(key, p, a, points)
        config = dict(bounds=a['bounds'], kind='regional', sites=p['regions'],sea_routes=p.get('sea_routes',[]))

        def complexity(shapes):
            degrees = [len(v) for v in routes_for(config, shapes, points, a.get('rivers', []))['neighbors'].values()]
            return (max(degrees), sum((max(0, d - 6) for d in degrees)))
        best = complexity(cells)
        if best[0] > 7:
            for weight in [0.15, 0.8, 3]:
                candidate = regional_cells(key, p, a, points, weight)
                score = complexity(candidate)
                if score < best:
                    cells, best = (candidate, score)
                if best[0] <= 7:
                    break
        if best[0] > 7:
            for attempt in range(32):
                graph = routes_for(config, cells, points, a.get('rivers', []))['neighbors']
                hub = max(range(len(points)), key=lambda i: len(graph[str(i)]))
                radius = min((points[hub].distance(q) for i, q in enumerate(points) if i != hub))
                angle = attempt * math.pi / 4
                shift = radius * (0.22 + 0.1 * (attempt // 8))
                seeds = list(points)
                seeds[hub] = Point(points[hub].x + math.cos(angle) * shift, points[hub].y + math.sin(angle) * shift)
                candidate = regional_cells(key, p, a, seeds, 0.8)
                if not all((c.buffer(1e-06).covers(point) for c, point in zip(candidate, points))):
                    continue
                score = complexity(candidate)
                if score < best:
                    cells, best = (candidate, score)
                if best[0] <= 7:
                    break
        if key != 'india':
            cells = repair_fragments(cells, points)
        for i, c in enumerate(cells):
            if c is None or c.is_empty:
                raise ValueError((key, i, 'empty region'))
            if not c.covers(points[i]):
                main = max(pieces(c), key=lambda g: g.area)
                points[i] = main.representative_point()
        cells = [transform(lambda x, y: (np.round(np.asarray(x) / aspect, 6) * aspect, np.round(y, 6)), c).buffer(0) for c in cells]
        for i, (cell, point) in enumerate(zip(cells, points)):
            center = [round(point.x / aspect, 6), round(point.y, 6)]
            a['regions'][i].update(center=center, polygons=[[[[round(x / aspect, 6), round(y, 6)] for x, y in ring.coords] for ring in [poly.exterior, *poly.interiors]] for poly in pieces(cell)])
            p['regions'][i][2:] = center
        west, south, east, north = a['bounds']
        norm = lambda pts: [[(x - west) / (east - west), (north - y) / (north - south)] for x, y in pts]
        for name, line in RIVERS.get(key, []):
            a.setdefault('rivers', []).append(dict(name=name + ' · interpreted', points=norm(line)))
        if key in WATERS:
            a['water_labels'] = [dict(name=name, center=norm([(x, y)])[0]) for name, x, y in WATERS[key] if west <= x <= east and south <= y <= north]
        sea = box(0, 0, aspect, 1).difference(unary_union(cells)).buffer(-0.004)
        for label in a.get('water_labels', []):
            point = Point(label['center'][0] * aspect, label['center'][1])
            if not sea.is_empty and (not sea.covers(point)):
                point = nearest_points(sea, point)[0]
                label['center'] = [point.x / aspect, point.y]
        a['annotations'] = annotations(key, a)
        config = dict(bounds=a['bounds'], kind='regional', sites=p['regions'],sea_routes=p.get('sea_routes',[]))
        rules = routes_for(config, cells, points, a.get('rivers', []))
        p['map_asset_id'] = asset
        a['id'] = asset
        strength = new_start(p, rules)
        setting = p.setdefault('setting', {})
        setting.setdefault('note', 'Real coastlines; named gameplay territories use simplified geographic boundaries, not surveyed political borders.')
        setting['opening_note'] = f'Recommended opening: {strength[0]} vs {strength[1]} troops. Territory growth and access also affect difficulty.'
        if not 0.8 <= strength[0] / strength[1] <= 1.25:
            setting['opening_note'] += ' This is an intentionally asymmetric starting position; other starting regions are available.'
        if not p.get('historical_sectors'):
            p.setdefault('setting', {})['note'] = 'Natural Earth coastlines and geographic boundaries, with connected gameplay sectors around named locations. Internal lines are simplified interpretations, not surveyed historical political borders.'
        a['setting'] = p.get('setting', a.get('setting', {}))
        a['review_version'] = 3
        for path, data in [(ROOT / f'ui/maps/{asset}.json', a), (ROOT / f'engine/presets/geography/{asset}.json', rules)]:
            path.write_text(json.dumps(data, separators=(',', ':')) + '\n')
        out[key] = p
        row = dict(id=key, regions=len(cells), routes=len(rules['routes']), max_neighbors=max(map(len, rules['neighbors'].values())))
        report.append(row)
        print(row, flush=True)
    target.write_text(json.dumps(out, indent=2) + '\n')
    (ROOT / 'tools/reviewed-map-report.json').write_text(json.dumps(report, indent=2) + '\n')

if __name__=='__main__':build(Path(sys.argv[1]),sys.argv[2] if len(sys.argv)>2 else None)
