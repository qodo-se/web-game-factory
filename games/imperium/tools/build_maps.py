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
    'balochistan_borderlands_expanded': [58.3, 23.2, 75.5, 39.0],
    'balochistan_borderlands': [58.3, 24.5, 73.4, 37.2],
    'pakistan_afghanistan': [60, 23, 78, 39],
    'europe': [-12, 33, 55, 71], 'western_europe': [-12, 35, 24, 66],
    'eastern_europe': [10, 40, 55, 62], 'mediterranean': [-12, 24, 49, 52],
    'middle_east': [18, 12, 72, 45], 'central_asia': [44, 25, 136, 61],
    'india': [62, 5, 98, 37.5], 'southeast_asia': [90, -11, 133, 25],
    'americas': [-170, -57, -30, 78],
    'africa_middle_east': [-19, -36, 64, 43],
    'southeast_asia_oceania': [90, -48, 180, 26],
}


# Restrict expanded theaters to their continents, rather than assigning nearby
# European/Asian land to the closest gameplay region across an ocean.
COUNTRIES = {
    'balochistan_borderlands_expanded': {'PAK', 'AFG', 'IRN'},
    'balochistan_borderlands': {'PAK', 'AFG', 'IRN'},
    'pakistan_afghanistan': {'PAK', 'AFG'},
    'americas': set('CAN USA MEX GRL BLZ GTM HND SLV NIC CRI PAN CUB HTI DOM JAM BHS TTO BRB ATG DMA GRD KNA LCA VCT COL VEN GUY SUR ECU PER BRA BOL PRY URY ARG CHL PRI FLK FRA NLD MAF SXM CUW ABW TCA SPM MSR VIR BLM AIA VGB CYM BMU USG'.split()),
    'africa_middle_east': set('MAR SAH DZA TUN LBY EGY MRT MLI NER TCD SDN SDS BFA SEN GMB GNB GIN SLE LBR CIV GHA TGO BEN NGA CMR CAF GNQ GAB COG COD AGO NAM ZAF BWA ZWE ZMB MWI MOZ SWZ LSO MDG TZA BDI RWA UGA KEN ETH ERI DJI SOM SOL COM SYC MUS STP CPV TUR SYR LBN ISR PSX JOR IRQ IRN SAU YEM OMN ARE QAT BHR KWT'.split()),
    'southeast_asia_oceania': set('MMR THA LAO KHM VNM MYS SGP BRN IDN PHL TLS PNG AUS NZL'.split()),
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
    provinces = [(r.record['adm0_a3'], r.record['adm1_code'], shape(r.shape.__geo_interface__).buffer(0))
                 for r in reader.iterShapeRecords()]
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
        piece_countries = []
        anchor_countries = preset.get('anchor_countries')
        if anchor_countries:
            assert len(anchor_countries) == len(points)
        selected_provinces = set(preset.get('source_provinces', []))
        for country, province_id, province in provinces:
            if selected_provinces and province_id not in selected_provinces:
                continue
            if key in COUNTRIES and country not in COUNTRIES[key]:
                continue
            if province.intersects(frame):
                # Keep original topology until after dissolving province boundaries.
                g = transform(project, province.intersection(frame))
                clipped = [p for p in polygons(g) if p.area > .0001]
                pieces.extend(clipped)
                piece_countries.extend([country] * len(clipped))
        # Assign each anchor its nearest province, including tiny offshore/costal offsets.
        homes = [min((j for j in range(len(pieces)) if not anchor_countries
                      or piece_countries[j] == anchor_countries[i]),
                     key=lambda j: pieces[j].distance(p)) for i, p in enumerate(points)]
        assigned = [[] for _ in points]
        for j, piece in enumerate(pieces):
            residents = [i for i in generated_ids if homes[i] == j]
            if not residents:
                center = piece.representative_point()
                eligible = [i for i in generated_ids if not anchor_countries
                            or anchor_countries[i] == piece_countries[j]]
                residents = [min(eligible, key=lambda i: center.distance(points[i]))]
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
