"""Build topographic battlefield maps and terrain-aware control sectors.

python -m games.borderstrife.tools.build_battle_maps
Build dependencies: requirements-battle-maps.txt. Uses pinned local source data.
Sector boundaries are game abstractions, NOT surveyed historical battle lines.
"""
import json
import math
from pathlib import Path
from shapely.geometry import LineString
from .battle_terrain import build_terrain
from games.borderstrife.engine.presets.battles import BATTLES

ROOT = Path(__file__).resolve().parents[1]



def build(only=None):
    for battle in BATTLES:
        if only and battle['id'] != only: continue
        west, south, east, north = battle['bounds']
        aspect = (east-west)*math.cos(math.radians((south+north)/2))/(north-south)
        def project(lon, lat):
            return ((lon-west)/(east-west)*aspect, (north-lat)/(north-south))
        points = [project(s[2],s[3]) for s in battle['sites']]
        cells,terrain,contours,landscape=build_terrain(battle,aspect,points)
        normalized = lambda p: [round(p[0]/aspect,6),round(p[1],6)]
        features=[]
        for i, (cell, site) in enumerate(zip(cells,battle['sites'])):
            assert cell.geom_type == 'Polygon' and cell.is_valid and cell.area > 0
            features.append(dict(id=i,name=site[0],center=normalized(points[i]),
                                 polygons=[[[normalized(p) for p in cell.exterior.coords], *[[normalized(p) for p in hole.coords] for hole in cell.interiors]]]))
        neighbors={str(i):[] for i in range(len(cells))}; routes={}
        for a, cell in enumerate(cells):
            for b in range(a+1,len(cells)):
                if cell.distance(cells[b]) < 1e-8 and cell.buffer(1e-8).intersection(cells[b]).length > .001:
                    neighbors[str(a)].append(b);neighbors[str(b)].append(a)
                    routes[f'{a}:{b}']='river' if any(LineString([points[a],points[b]]).intersects(LineString([(x*aspect,y) for x,y in line])) for _,line in landscape['streams']) else 'pass' if any(battle['sites'][i][1]=='hills' for i in (a,b)) else 'road'
        rules=dict(neighbors=neighbors,routes=routes,ports=[])
        data=dict(id=battle['id'],category='historical',bounds=battle['bounds'],aspect=aspect,
                  regions=features,rivers=[dict(name=name,points=line) for name,line in landscape['streams']],water_labels=[],terrain=terrain,contours=contours,
                  attribution='Terrain: Mapzen / EU-DEM / USGS · Historical landscape reconstructed',
                  roads=landscape['paths'],
                  ridges=[[normalized(points[i]) for i in line] for line in battle['ridges']])
        if 'shoreline' in battle:
            data['water_labels']=[dict(name='Lake Tiberias',center=[.91,.25])]
        for path, content in [(ROOT/f'ui/maps/{battle["id"]}.json', data),
                              (ROOT/f'engine/presets/geography/{battle["id"]}.json',rules)]:
            path.write_text(json.dumps(content,separators=(',',':'))+'\n')
        print(battle['id'],len(cells),'sectors',len(routes),'routes')


if __name__ == '__main__':
    import sys
    build(sys.argv[1] if len(sys.argv) > 1 else None)
