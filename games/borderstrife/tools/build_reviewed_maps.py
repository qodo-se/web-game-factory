"""Rebuild all 35 maps into immutable atlas_v3 assets after the map review.

python -m games.borderstrife.tools.build_reviewed_maps /path/to/provinces.zip [map_id]
Sources: bundled compact/expansion definitions, Natural Earth coastlines, pinned DEM.
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
from .map_details import WATERS, RIVERS, DEPLOYMENTS, START_GROUPS, annotations, local_landscape
from .collection_sources import MAPS
from .build_collections import routes_for, landscape, land_outline, fantasy
from .battle_terrain import build_terrain, clean_elevation
from .battle_sources.landscape import LANDSCAPES
from games.borderstrife.engine.presets.battles import BATTLES

ROOT=Path(__file__).resolve().parents[1]
NEW={m['id']:m for m in MAPS}
OLD={b['id']:b for b in BATTLES}
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
    config=dict(bounds=atlas['bounds'],kind='regional',sites=preset['regions'])
    # Enlarge the three administrative micro-enclaves by repartitioning only
    # nearby territory. All outer geographic boundaries remain unchanged.
    tiny={'crusader_states':'Beirut','civil_war_east':'Washington','nile_horn':'Harar'}
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


def new_start(preset,rules):
    raw=preset['regions'];adj=[set(rules['neighbors'][str(i)]) for i in range(len(raw))]
    a,b=preset['player1_capital'],preset['player2_capital']
    left,right=balanced_starts(raw,adj,(a,b))
    preset.update(player1_extra_starts=sorted(left-{a}),player2_extra_starts=sorted(right-{b}))
    from games.borderstrife.engine.models import TERRAIN_POP_RATE, TerrainType
    power=lambda group:sum(TERRAIN_POP_RATE[TerrainType(raw[i][1])] for i in group)
    ratio=power(left)/power(right)
    if not .8<=ratio<=1.25:
        # Regional defaults may choose better matched capitals. Named campaign
        # and epic opponents are preserved and their asymmetry is disclosed.
        if preset.get('category','world')=='world':
            options=[]
            for rival in range(len(raw)):
                if rival==a or rival in adj[a]:continue
                try:l,r=balanced_starts(raw,adj,(a,rival))
                except ValueError:continue
                score=abs(math.log(power(l)/power(r)))
                options.append((score,-Point(raw[a][2:]).distance(Point(raw[rival][2:])),rival,l,r))
            if options:
                _,_,b,left,right=min(options,key=lambda x:x[:3]);preset.update(player2_capital=b,player1_extra_starts=sorted(left-{a}),player2_extra_starts=sorted(right-{b}))
    if preset['id'] in START_GROUPS:
        names=[r[0] for r in raw]
        left,right=[{names.index(name) for name in group} for group in START_GROUPS[preset['id']]]
        preset.update(player1_extra_starts=sorted(left-{a}),player2_extra_starts=sorted(right-{b}))
    return power(left)*8,power(right)*8


def build(archive,only=None):
    provinces=[(r.record['adm0_a3'],shape(r.shape.__geo_interface__).buffer(0)) for r in shapefile.Reader(str(archive)).iterShapeRecords()]
    base=json.loads((ROOT/'engine/presets/compact.json').read_text())
    base.update(json.loads((ROOT/'engine/presets/expansion.json').read_text()))
    target=ROOT/'engine/presets/reviewed.json';out=json.loads(target.read_text()) if only and target.exists() else {}
    report_path=ROOT/'tools/reviewed-map-report.json'
    report=json.loads(report_path.read_text()) if only and report_path.exists() else []
    report=[row for row in report if row['id']!=only]
    for key,original in base.items():
        if only and key!=only:continue
        p=copy.deepcopy(original);a=json.loads((ROOT/f'ui/maps/{p["map_asset_id"]}.json').read_text())
        aspect=a['aspect'];asset=f'{key}_{VERSION}'
        if key=='epic_lanka':
            # The northern army has an established fortified staging camp.
            # City terrain provides its existing recruitment behavior.
            p['regions'][0][1]='city'
            p['description']+=' The Northern Landing is an established fortified camp.'
        points=[Point(r['center'][0]*aspect,r['center'][1]) for r in a['regions']]
        m=copy.deepcopy(NEW.get(key,OLD.get(key)))
        islocal=key in OLD or (m and m.get('kind')=='local')
        if islocal:
            if key in OLD:
                battle=m;cover=LANDSCAPES[key]
            else:
                battle=copy.deepcopy(m);battle['sites']=[(*s,0,50) for s in m['sites']];cover=landscape(m)
            battle['asset_id']=asset
            if key=='troy_troad':battle['elevation_id']='troy_troad-reviewed'
            if m.get('countries'):battle['land_geometry']=land_outline(m,provinces)
            cover=local_landscape(key,cover,a['bounds'])
            cells,terrain,contours,cover=build_terrain(battle,aspect,[(q.x,q.y) for q in points],landscape_override=cover)
            a.update(terrain=terrain,contours=contours,rivers=[dict(name=n,points=line) for n,line in cover['streams']],roads=cover['paths'])
        elif key=='emberfall':
            m['asset_id']=asset;cells,points,extras=fantasy(m);a.update(extras)
        else:
            cells=regional_cells(key,p,a,points)
        # Reduce excessive hubs by rebuilding boundaries, never deleting a
        # genuine neighbor route. Try stronger locality before accepting a layout.
        config=dict(bounds=a['bounds'],kind='fantasy' if key=='emberfall' else 'regional',sites=p['regions'])
        def complexity(shapes):
            degrees=[len(v) for v in routes_for(config,shapes,points,a.get('rivers',[]))['neighbors'].values()]
            return (max(degrees),sum(max(0,d-6) for d in degrees))
        best=complexity(cells)
        if best[0]>7:
            elevation=clean_elevation(battle)[0] if islocal else None
            for weight in [.15,.8,3]:
                candidate=partition(unary_union(cells),points,aspect,elevation,compactness=weight) if islocal or key=='emberfall' else regional_cells(key,p,a,points,weight)
                score=complexity(candidate)
                if score<best:cells,best=candidate,score
                if best[0]<=7:break
        if best[0]>7:
            # Move only a sector's growth seed; its named geographic anchor must
            # remain inside the resulting region. This alters boundary shape,
            # not the place location, and avoids thin artificial corridors.
            for attempt in range(32):
                graph=routes_for(config,cells,points,a.get('rivers',[]))['neighbors']
                hub=max(range(len(points)),key=lambda i:len(graph[str(i)]))
                radius=min(points[hub].distance(q) for i,q in enumerate(points) if i!=hub)
                angle=attempt*math.pi/4
                shift=radius*(.22+.10*(attempt//8))
                seeds=list(points);seeds[hub]=Point(points[hub].x+math.cos(angle)*shift,points[hub].y+math.sin(angle)*shift)
                candidate=partition(unary_union(cells),seeds,aspect,compactness=.8) if islocal or key=='emberfall' else regional_cells(key,p,a,seeds,.8)
                if not all(c.buffer(1e-6).covers(point) for c,point in zip(candidate,points)):continue
                score=complexity(candidate)
                if score<best:cells,best=candidate,score
                if best[0]<=7:break
        if best[0]>7 and islocal:
            # A few very close precinct anchors create unstable raster contacts.
            # Exact planar sectors avoid pixel-scale extra neighbors; the named
            # positions must still be contained and the terrain remains unchanged.
            rng=np.random.default_rng(739)
            for attempt in range(80):
                seeds=[]
                for i,q in enumerate(points):
                    radius=min(q.distance(other) for j,other in enumerate(points) if j!=i)
                    seeds.append(Point(q.x+rng.uniform(-.35,.35)*radius,q.y+rng.uniform(-.35,.35)*radius))
                land=unary_union(cells)
                candidate=[g.intersection(land) for g in voronoi_polygons(MultiPoint(seeds),extend_to=land.envelope,ordered=True).geoms]
                if not all(c.covers(point) for c,point in zip(candidate,points)):continue
                score=complexity(candidate)
                if score<best:cells,best=candidate,score
                if best[0]<=7:break
        if key!='india':cells=repair_fragments(cells,points)
        # Keep every named anchor on its own region, including coastal seeds.
        for i,c in enumerate(cells):
            if c is None or c.is_empty:raise ValueError((key,i,'empty region'))
            if not c.covers(points[i]):
                main=max(pieces(c),key=lambda g:g.area);points[i]=main.representative_point()
        # Quantize before deriving the runtime graph.
        cells=[transform(lambda x,y:(np.round(np.asarray(x)/aspect,6)*aspect,np.round(y,6)),c).buffer(0) for c in cells]
        for i,(cell,point) in enumerate(zip(cells,points)):
            center=[round(point.x/aspect,6),round(point.y,6)]
            a['regions'][i].update(center=center,polygons=[[[[round(x/aspect,6),round(y,6)] for x,y in ring.coords] for ring in [poly.exterior,*poly.interiors]] for poly in pieces(cell)])
            p['regions'][i][2:]=center
        west,south,east,north=a['bounds']
        norm=lambda pts:[[(x-west)/(east-west),(north-y)/(north-south)] for x,y in pts]
        for name,line in RIVERS.get(key,[]):a.setdefault('rivers',[]).append(dict(name=name+' · interpreted',points=norm(line)))
        if key in WATERS:a['water_labels']=[dict(name=name,center=norm([(x,y)])[0]) for name,x,y in WATERS[key] if west<=x<=east and south<=y<=north]
        sea=box(0,0,aspect,1).difference(unary_union(cells)).buffer(-.004)
        for label in a.get('water_labels',[]):
            point=Point(label['center'][0]*aspect,label['center'][1])
            if not sea.is_empty and not sea.covers(point):
                point=nearest_points(sea,point)[0];label['center']=[point.x/aspect,point.y]
        a['annotations']=annotations(key,a)
        config=dict(bounds=a['bounds'],kind='fantasy' if key=='emberfall' else 'regional',sites=p['regions'])
        rules=routes_for(config,cells,points,a.get('rivers',[]))
        p['map_asset_id']=asset;a['id']=asset
        if key in DEPLOYMENTS:
            owners,forces=DEPLOYMENTS[key]
            for i,site in enumerate(p['battle']['sites']):site[4:]=[owners[i],forces[i]]
            p['player1_extra_starts']=[i for i,s in enumerate(owners) if s==0 and i!=p['player1_capital']]
            p['player2_extra_starts']=[i for i,s in enumerate(owners) if s==1 and i!=p['player2_capital']]
            p['battle']['terrain_note']+=' Opening sectors and relative strengths are authored scenario interpretations, not an exact order of battle.'
        if 'battle' not in p:
            strength=new_start(p,rules)
            setting=p.setdefault('setting',{})
            setting.setdefault('note','Real coastlines; named gameplay territories use simplified geographic boundaries, not surveyed political borders.')
            setting['opening_note']=f'Recommended opening: {strength[0]} vs {strength[1]} troops. Territory growth and access also affect difficulty.'
            if not .8<=strength[0]/strength[1]<=1.25:setting['opening_note']+=' This is an intentionally asymmetric starting position; other starting regions are available.'
        elif key=='hattin':
            p['battle']['context']+=' An asymmetric scenario: the Crusader force begins outnumbered. Objective control matters; equal forces are not assumed.'
        if not islocal and key!='emberfall':
            p.setdefault('setting',{})['note']='Natural Earth coastlines and geographic boundaries, with connected gameplay sectors around named locations. Internal lines are simplified interpretations, not surveyed historical political borders.'
            if p.get('category')=='legends':p['setting']['note']='Literary-inspired place assignments, not archaeological evidence. '+p['setting']['note']
        if key in DEPLOYMENTS:p['setting']['terrain_note']=p['battle']['terrain_note']
        a['setting']=p.get('setting',a.get('setting',{}))
        a['review_version']=3
        for path,data in [(ROOT/f'ui/maps/{asset}.json',a),(ROOT/f'engine/presets/geography/{asset}.json',rules)]:path.write_text(json.dumps(data,separators=(',',':'))+'\n')
        out[key]=p
        row=dict(id=key,regions=len(cells),routes=len(rules['routes']),max_neighbors=max(map(len,rules['neighbors'].values())))
        report.append(row);print(row,flush=True)
    target.write_text(json.dumps(out,indent=2)+'\n')
    (ROOT/'tools/reviewed-map-report.json').write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':build(Path(sys.argv[1]),sys.argv[2] if len(sys.argv)>2 else None)
