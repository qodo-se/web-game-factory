"""Add real rivers and build gameplay routes from the bundled territory geometry.

Usage: python build_strategy_maps.py /path/to/ne_10m_rivers_lake_centerlines.zip
Requires Shapely and pyshp. River data: Natural Earth 5.0.0, public domain.
"""
import json
from pathlib import Path
import runpy
import sys

import shapefile
from shapely.geometry import Polygon, LineString, Point, shape, box
from shapely.ops import unary_union, transform

ROOT = Path(__file__).resolve().parents[1]
SEAS = {
    'balochistan_borderlands_expanded': [('Arabian Sea',64,24)],
    'balochistan_borderlands': [('Arabian Sea',64,24.7)],
    'pakistan_afghanistan': [('Arabian Sea',65,23.7)],
    'americas': [('Pacific Ocean',-133,-8),('Atlantic Ocean',-42,25),('Caribbean Sea',-74,15)],
    'africa_middle_east': [('Atlantic Ocean',-10,-15),('Indian Ocean',57,-12),('Arabian Sea',60,16)],
    'southeast_asia_oceania': [('Indian Ocean',106,-25),('Pacific Ocean',166,5),('Tasman Sea',163,-36)],
    'india': [('Arabian Sea',66,16),('Bay of Bengal',88,13)],
    'mediterranean': [('Mediterranean Sea',18,34),('Black Sea',34,43)],
    'europe': [('Atlantic Ocean',-9,49),('North Sea',3,57),('Black Sea',34,43)],
    'western_europe': [('Atlantic Ocean',-8,46),('North Sea',3,57)],
    'eastern_europe': [('Black Sea',33,43),('Baltic Sea',19,57)],
    'middle_east': [('Arabian Sea',63,18),('Caspian Sea',51,41)],
    'central_asia': [('Caspian Sea',51,41)],
    'southeast_asia': [('South China Sea',114,14),('Java Sea',112,-5),('Bay of Bengal',92,12)],
}


def lines(g):
    if g.geom_type == 'LineString':
        yield g
    elif hasattr(g,'geoms'):
        for child in g.geoms:
            yield from lines(child)


def build(archive, only=None):
    rivers=[]
    for item in shapefile.Reader(str(archive)).iterShapeRecords():
        p=item.record.as_dict()
        if p.get('scalerank',99) <= 5:
            rivers.append((p.get('name_en') or p.get('name') or 'River',shape(item.shape.__geo_interface__)))
    folder=ROOT/'engine/presets/geography';folder.mkdir(exist_ok=True)
    for path in sorted((ROOT/'ui/maps').glob('*.json')):
        data=json.loads(path.read_text());key=data['id']
        if only and key != only: continue
        # Only source maps have Python preset definitions. Versioned/generated
        # assets belong to their dedicated builders, regardless of suffix.
        preset_path=ROOT/'engine/presets'/f'{key}.py'
        if not preset_path.is_file(): continue
        preset=runpy.run_path(str(preset_path))['PRESET']
        west,south,east,north=data['bounds']
        project=lambda x,y:((x-west)/(east-west),(north-y)/(north-south))
        territories=[unary_union([Polygon(p[0],p[1:]).buffer(0) for p in r['polygons']]).buffer(0) for r in data['regions']]
        centers=[Point(r['center']) for r in data['regions']]
        land=unary_union(territories)
        river_lines=[];waterways=[]
        frame=box(west,south,east,north)
        for name,g in rivers:
            if not g.intersects(frame):continue
            for segment in lines(transform(project,g.intersection(frame)).simplify(.0008)):
                river_lines.append(segment)
                waterways.append({'name':name,'points':[[round(x,6),round(y,6)] for x,y in segment.coords]})
        river_geometry=unary_union(river_lines)
        edges=set()
        for a in range(len(territories)):
            for b in range(a+1,len(territories)):
                if territories[a].distance(territories[b]) < .00001 and territories[a].buffer(.00001).intersection(territories[b]).length > .002:
                    edges.add((a,b))
        edges.update(tuple(sorted(e)) for e in preset.get('extra_edges',[]))
        if key=='india':
            edges={e for e in edges if 36 not in e}|{(0,36),(1,36)}
        # Islands without an authored sea lane get the shortest link to another
        # component. Each such endpoint becomes a port, keeping every region playable.
        while True:
            groups=[];left=set(range(len(centers)))
            while left:
                seen={min(left)};queue=list(seen)
                while queue:
                    node=queue.pop()
                    for a,b in edges:
                        nb=b if a==node else a if b==node else None
                        if nb is not None and nb not in seen:seen.add(nb);queue.append(nb)
                groups.append(seen);left-=seen
            if len(groups)==1:break
            a,b=min(((a,b) for a in groups[0] for b in set.union(*groups[1:]) if not (key=='india' and 36 in (a,b))),
                    key=lambda e:centers[e[0]].distance(centers[e[1]]))
            edges.add(tuple(sorted((a,b))))
        routes={};ports=set();neighbors={str(i):[] for i in range(len(centers))}
        for a,b in sorted(edges):
            line=LineString([centers[a],centers[b]])
            gap=territories[a].distance(territories[b])
            if gap > .00001 and line.difference(land.buffer(.00005)).length > line.length*.08:
                kind='sea';ports.update((a,b))
            elif line.intersects(river_geometry):kind='river'
            elif any(preset['regions'][i][1]=='hills' for i in (a,b)):kind='pass'
            else:kind='road'
            routes[f'{a}:{b}']=kind
            neighbors[str(a)].append(b);neighbors[str(b)].append(a)
        rules={'neighbors':neighbors,'routes':routes,'ports':sorted(ports)}
        (folder/f'{key}.json').write_text(json.dumps(rules,separators=(',',':'))+'\n')
        data['rivers']=waterways
        data['water_labels']=[{'name':name,'center':project(lon,lat)} for name,lon,lat in SEAS.get(key,[])]
        path.write_text(json.dumps(data,separators=(',',':'))+'\n')
        print(key,len(routes),'routes,',len(waterways),'river segments')


if __name__=='__main__':build(Path(sys.argv[1]), sys.argv[2] if len(sys.argv)>2 else None)
