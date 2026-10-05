"""Dissolve existing territories into smaller, versioned campaign collections.

Run: python -m games.borderstrife.tools.build_compact_maps
Uses only bundled geometry (Shapely is a build dependency). Original assets are
immutable: older saved games continue to load their original maps and routes.
"""
import copy
import json
import math
from pathlib import Path
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from games.borderstrife.engine.presets import SOURCE_PRESETS

ROOT = Path(__file__).resolve().parents[1]
TARGETS = dict(mediterranean=24, europe=28, americas=28, africa_middle_east=28,
               central_asia=30, india=30, southeast_asia_oceania=28,
               balochistan_borderlands_expanded=30)
# Never overwrite geometry used by existing campaigns when regrouping regions.
ASSET_VERSIONS = {'india': 'compact_v2', 'central_asia': 'compact_v2'}
KEEP_NAMES = {'Kashyap Meer', 'Dwarka', 'Ahom', 'Balochistan', 'Lanka'}


def connected(n, edges, subset=None):
    wanted=set(range(n)) if subset is None else set(subset)
    if not wanted:return True
    seen={min(wanted)};todo=list(seen)
    while todo:
        a=todo.pop()
        for x,y in edges:
            b=y if x==a else x if y==a else None
            if b in wanted and b not in seen:seen.add(b);todo.append(b)
    return seen==wanted


def build_one(key, source):
    data=json.loads((ROOT/f'ui/maps/{key}.json').read_text())
    old_rules=json.loads((ROOT/f'engine/presets/geography/{key}.json').read_text())
    original=[unary_union([Polygon(p[0],p[1:]).buffer(0) for p in r['polygons']]).buffer(0) for r in data['regions']]
    groups={i:{i} for i in range(len(original))};shapes=dict(enumerate(original))
    keep={source['player1_capital'],source['player2_capital']}|{i for i,r in enumerate(source['regions']) if r[0] in KEEP_NAMES}
    frozen={i for i,r in enumerate(source['regions']) if r[0]=='Kashyap Meer'}
    countries=source.get('anchor_countries')
    target=TARGETS.get(key,len(original))
    while len(groups)>target:
        options=[]
        for a in sorted(groups):
            for b in sorted(groups):
                if b<=a or (groups[a]|groups[b])&frozen:continue
                if len((groups[a]|groups[b])&keep)>1:continue
                if countries and {countries[i] for i in groups[a]}!={countries[i] for i in groups[b]}:continue
                if shapes[a].distance(shapes[b])>1e-5:continue
                border=shapes[a].buffer(1e-5).intersection(shapes[b]).length
                if border<.0001:continue
                area=shapes[a].area+shapes[b].area
                # Prefer modest, compact neighboring territories; never merge sea lanes.
                cost=area*(1+math.sqrt(area)/max(border,.001))*(1+.08*(len(groups[a])+len(groups[b])))
                options.append((cost,a,b))
        if not options:raise ValueError(f'{key}: cannot reach {target} without crossing water or protected borders')
        _,a,b=min(options);groups[a]|=groups.pop(b);shapes[a]=unary_union([shapes[a],shapes.pop(b)]).buffer(0)
    ordered=sorted(groups);mapping={old:new for new,a in enumerate(ordered) for old in groups[a]}
    reps=[];features=[];raw=[];merges=[]
    for new,a in enumerate(ordered):
        members=groups[a]
        rep=next(iter(members&keep)) if members&keep else max(members,key=lambda i:(original[i].area,-i))
        reps.append(rep);name,terrain,*_=source['regions'][rep]
        center=data['regions'][rep]['center']
        if not shapes[a].covers(Point(center)):center=list(shapes[a].representative_point().coords)[0]
        polygons=[shapes[a]] if shapes[a].geom_type=='Polygon' else list(shapes[a].geoms)
        features.append(dict(id=new,name=name,center=list(center),source_region_ids=sorted(members),
            polygons=[[[list(p) for p in polygon.exterior.coords], *[[list(p) for p in ring.coords] for ring in polygon.interiors]] for polygon in polygons]))
        raw.append([name,terrain,*center]);merges.append([source['regions'][i][0] for i in sorted(members)])
    # No territory may disappear when internal borders are dissolved.
    assert unary_union(original).symmetric_difference(unary_union(list(shapes.values()))).area < 1e-9
    centers=[Point(f['center']) for f in features];n=len(features)
    territories=[shapes[a] for a in ordered]
    rivers=unary_union([LineString(r['points']) for r in data.get('rivers',[]) if len(r['points'])>1])
    candidates={};edges=set()
    # Every shared land border is traversable. A point contact is not a border;
    # the small tolerance only bridges coordinate-rounding seams in the source.
    for a in range(n):
        for b in range(a+1,n):
            first,second=territories[a],territories[b]
            shared=first.boundary.intersection(second.boundary).length
            if shared<=1e-7 and not (first.distance(second)<=1e-6 and first.buffer(1e-6).intersection(second).length>1e-5):continue
            line=LineString([centers[a],centers[b]])
            kind='river' if line.intersects(rivers) else 'pass' if any(raw[i][1]=='hills' for i in (a,b)) else 'road'
            candidates[(a,b)]=kind;edges.add((a,b))
    land_edges=set(edges)
    # Retain only the original crossings needed to join separate land masses.
    for pair,kind in old_rules['routes'].items():
        a,b=(mapping[int(i)] for i in pair.split(':'))
        if a!=b:candidates.setdefault(tuple(sorted((a,b))),kind)
    components=[{i} for i in range(n)]
    def join(a,b):
        ga=next(g for g in components if a in g);gb=next(g for g in components if b in g)
        if ga is gb:return False
        ga.update(gb);components.remove(gb);return True
    for a,b in sorted(edges):join(a,b)
    rank=lambda edge:(candidates[edge]=='sea',centers[edge[0]].distance(centers[edge[1]])*data['aspect'],edge)
    for edge in sorted(candidates,key=rank):
        if join(*edge):edges.add(edge)
    if len(components)>1:raise ValueError(f'{key}: disconnected compact routes')
    assert connected(n,edges) and land_edges<=edges
    if source.get('battle'):
        for side in (0,1):
            subset={i for i,site in enumerate(source['battle']['sites']) if site[4]==side}
            assert connected(n,edges,subset),(key,'disconnected deployment',side)
    degree=[sum(i in edge for edge in edges) for i in range(n)]
    routes={f'{a}:{b}':candidates[(a,b)] for a,b in sorted(edges)}
    neighbors={str(i):sorted(b if a==i else a for a,b in edges if i in (a,b)) for i in range(n)}
    ports=sorted({i for edge in edges if candidates[edge]=='sea' for i in edge})
    asset=f"{key}_{ASSET_VERSIONS.get(key, 'compact')}";out=copy.deepcopy(source)
    out.update(map_asset_id=asset,regions=raw,player1_capital=mapping[source['player1_capital']],player2_capital=mapping[source['player2_capital']],extra_edges=[],removed_edges=[])
    if countries:out['anchor_countries']=[countries[i] for i in reps]
    if source.get('battle'):
        out['player1_extra_starts']=[mapping[i] for i in source['player1_extra_starts']]
        out['player2_extra_starts']=[mapping[i] for i in source['player2_extra_starts']]
    else:
        def start(seat,excluded):
            owned={seat}
            while len(owned)<3:
                frontier={b for a in owned for b in neighbors[str(a)]}-owned-excluded
                if not frontier:raise ValueError(f'{key}: starting kingdom too small')
                owned.add(min(frontier))
            return sorted(owned-{seat})
        out['player1_extra_starts']=start(out['player1_capital'],{out['player2_capital']})
        out['player2_extra_starts']=start(out['player2_capital'],{out['player1_capital'],*out['player1_extra_starts']})
    data.update(id=asset,regions=features)
    if not source.get('battle'):out['description']+=f' {n} larger regions with a focused network of routes.'
    (ROOT/f'ui/maps/{asset}.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
    (ROOT/f'engine/presets/geography/{asset}.json').write_text(json.dumps(dict(neighbors=neighbors,routes=routes,ports=ports),separators=(',',':'))+'\n')
    return out,dict(map=key,regions=n,old_regions=len(original),routes=len(edges),old_routes=len(old_rules['routes']),max_connections=max(degree),groups=merges)


def build():
    presets={};report=[]
    for key,source in SOURCE_PRESETS.items():
        presets[key],row=build_one(key,source);report.append(row)
        print(key,row['old_regions'],'→',row['regions'],'regions;',row['old_routes'],'→',row['routes'],'routes')
    (ROOT/'engine/presets/compact.json').write_text(json.dumps(presets,indent=2)+'\n')
    (ROOT/'tools/compact-map-report.json').write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':build()
