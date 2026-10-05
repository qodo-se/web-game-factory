"""Build the 22-map expansion from pinned Natural Earth and DEM sources.

python -m games.borderstrife.tools.build_collections /path/to/provinces.zip /path/to/rivers.zip
python -m games.borderstrife.tools.build_collections --fetch-terrain
No network, GIS or raster dependencies are needed by the game at runtime.
"""
import copy
import json
import math
from pathlib import Path
import sys
import numpy as np
import shapefile
from PIL import Image, ImageDraw, ImageFilter
from shapely import coverage_simplify
from shapely.geometry import Polygon, Point, LineString, MultiPoint, box, shape
from shapely.ops import transform, unary_union
from .collection_sources import MAPS
from .build_maps import half_plane, polygons
from .build_compact_maps import connected
from .build_strategy_maps import lines
from games.borderstrife.engine.presets.starts import kingdom_layout

ROOT=Path(__file__).resolve().parents[1]
SOURCES=Path(__file__).with_name('battle_sources')
RECOMMENDED = {
    'rome_carthage': ('Rome','Carthage'), 'crusader_states': ('Jerusalem','Damascus'),
    'civil_war_east': ('Washington','Richmond'), 'sengoku_japan': ('Owari','Kai'),
    'epic_lanka': ('Northern Landing',"Ravana's Court"),
    'kurukshetra': ('Pandava Standard','Kaurava Standard'), 'troy_troad': ('Troy Citadel','Ship Camp East'),
    'emberfall': ('Sunward Keep','Ashen Crown'), 'constantinople': ('Hagia Sophia quarter','Western camps'),
    'chittorgarh': ('Rana Kumbha precinct','Northern town'), 'malta': ('Birgu','Mdina'),
}


def recommended_layout(m, raw, adjacency):
    seat=next((i for i,r in enumerate(raw) if r[1]=='city'),0)
    if m['id'] not in RECOMMENDED:
        friendly,enemy,rival=kingdom_layout(raw,adjacency,seat)
        return seat,rival,friendly,enemy
    names=[r[0] for r in raw]
    seat,rival=[names.index(name) for name in RECOMMENDED[m['id']]]
    def grow(start,excluded):
        owned={start}
        while len(owned)<3:
            frontier={b for a in owned for b in adjacency[a]}-owned-excluded
            if not frontier:break
            owned.add(min(frontier))
        return owned
    friendly=grow(seat,{rival});enemy=grow(rival,friendly)
    return seat,rival,friendly,enemy


def frame_for(m):
    w,s,e,n=m['bounds'];cos=math.cos(math.radians((s+n)/2)) if m['kind']!='fantasy' else 1
    return (e-w)*cos/(n-s)


def normalize(m,x,y):
    w,s,e,n=m['bounds'];return ((x-w)/(e-w),(n-y)/(n-s))


def geography(m,provinces):
    """Assign real administrative pieces to anchors; split only shared home provinces."""
    w,s,e,n=m['bounds'];frame=box(w,s,e,n);aspect=frame_for(m)
    project=lambda x,y,z=None:((x-w)/(e-w)*aspect,(n-y)/(n-s))
    points=[Point(*project(site[2],site[3])) for site in m['sites']]
    pieces=[]
    countries=set(m['countries'])
    for country,geom in provinces:
        if country not in countries or not geom.intersects(frame):continue
        pieces.extend(p for p in polygons(transform(project,geom.intersection(frame))) if p.area>1e-8)
    assert pieces,m['id']
    homes=[min(range(len(pieces)),key=lambda j:pieces[j].distance(p)) for p in points]
    assigned=[[] for _ in points]
    for j,piece in enumerate(pieces):
        residents=[i for i,h in enumerate(homes) if h==j]
        if not residents:residents=[min(range(len(points)),key=lambda i:piece.representative_point().distance(points[i]))]
        for i in residents:
            cell=piece
            for other in residents:
                if i!=other:cell=cell.intersection(half_plane(points[i],points[other]))
            assigned[i].append(cell)
    cells=[unary_union(p).buffer(0) for p in assigned]
    cells=list(coverage_simplify(cells,min(.0015,aspect*.001)))
    for i,cell in enumerate(cells):
        assert not cell.is_empty,(m['id'],i)
        if not cell.covers(points[i]):points[i]=max(polygons(cell),key=lambda p:p.area).representative_point()
    return cells,points


def land_outline(m,provinces):
    w,s,e,n=m['bounds'];frame=box(w,s,e,n)
    return unary_union([g.intersection(frame) for country,g in provinces
                        if country in set(m['countries']) and g.intersects(frame)])


def landscape(m):
    """Authored land cover around scenario anchors; intentionally not surveyed detail."""
    woods=[];forts=[]
    for i,(name,kind,x,y) in enumerate(m['sites']):
        x,y=normalize(m,x,y)
        if kind=='forest':
            rng=np.random.default_rng(sum(map(ord,m['id']))+i)
            ring=[(x+math.cos(a)*r,y+math.sin(a)*r*.75) for a,r in zip(np.linspace(0,2*math.pi,18,endpoint=False),rng.uniform(.045,.085,18))]
            woods.append(list(Polygon(ring).intersection(box(0,0,1,1)).exterior.coords))
        if kind=='city':forts.append(i)
    streams=[]
    # Schematic historical watercourses; exact ancient courses are not asserted.
    if m['id']=='antietam_1862':streams=[('Antietam Creek (reconstructed)',[(.75,0),(.83,.18),(.73,.37),(.81,.54),(.67,.72),(.68,1)])]
    elif m['id']=='austerlitz_1805':streams=[('Goldbach (reconstructed)',[(.25,.22),(.30,.45),(.23,.65),(.30,.98)])]
    elif m['id']=='cannae_216':streams=[('Aufidus (interpreted course)',[(0,.12),(.22,.23),(.48,.16),(.67,.24),(1,.14)])]
    elif m['id']=='troy_troad':streams=[('Scamander (interpreted course)',[(.40,1),(.34,.78),(.38,.56),(.30,.28),(.25,0)])]
    # Sparse paths joining settlement anchors; illustrative, not a modern road layer.
    positions=[normalize(m,m['sites'][i][2],m['sites'][i][3]) for i in forts]
    paths=[]
    if positions:
        used={0}
        while len(used)<len(positions):
            a,b=min(((a,b) for a in used for b in range(len(positions)) if b not in used),
                    key=lambda ab:math.dist(positions[ab[0]],positions[ab[1]]))
            paths.append([positions[a],positions[b]]);used.add(b)
    return dict(woods=woods,orchards=[],streams=streams,paths=paths,forts=forts,field_size=100,contour_interval=10)


def topography(m,provinces):
    from .battle_terrain import build_terrain
    aspect=frame_for(m)
    battle=copy.deepcopy(m)
    battle['sites']=[(*site,0,50) for site in m['sites']]
    if m.get('countries'):
        battle['land_geometry']=land_outline(m,provinces)
    points=[(normalize(m,s[2],s[3])[0]*aspect,normalize(m,s[2],s[3])[1]) for s in m['sites']]
    cells,terrain,contours,cover=build_terrain(battle,aspect,points,landscape_override=landscape(m))
    # Watershed can move a coastal seed to the nearest land pixel. Pin the visible marker to its sector.
    centers=[Point(p) if cell.covers(Point(p)) else max(polygons(cell),key=lambda g:g.area).representative_point() for p,cell in zip(points,cells)]
    return cells,centers,dict(terrain=terrain,contours=contours,rivers=[dict(name=n,points=p) for n,p in cover['streams']],roads=cover['paths'])


def fantasy(m):
    """Original coast, mountain spine and watershed sectors; no measured elevations."""
    from scipy.ndimage import gaussian_filter
    from skimage.segmentation import watershed
    from rasterio.features import rasterize,shapes
    from rasterio.transform import from_bounds
    aspect=frame_for(m);h=320;w=round(h*aspect)
    coast=Polygon([(0.04,.22),(.13,.09),(.25,.12),(.33,.03),(.49,.10),(.62,.03),(.72,.12),(.87,.09),(.97,.25),(.93,.40),(.97,.55),(.91,.68),(.95,.81),(.83,.87),(.73,.80),(.67,.87),(.56,.84),(.49,.96),(.35,.96),(.29,.84),(.16,.83),(.18,.71),(.05,.64),(.10,.49),(.03,.36)])
    if m.get('asset_id'):
        # Rounded headlands and coves, preserving the original world's silhouette.
        coast=coast.buffer(.018,resolution=8).buffer(-.027,resolution=8).buffer(.009,resolution=8)
        # Small coves and irregular headlands along the original silhouette.
        boundary=coast.exterior;ring=[]
        for t in np.linspace(0,1,560,endpoint=False):
            p=boundary.interpolate(t,normalized=True);prev=boundary.interpolate((t-.001)%1,normalized=True);nxt=boundary.interpolate((t+.001)%1,normalized=True)
            dx,dy=nxt.x-prev.x,nxt.y-prev.y;length=max(1e-8,math.hypot(dx,dy))
            amount=.0035*(math.sin(t*197)+.5*math.sin(t*431))
            ring.append((p.x-dy/length*amount,p.y+dx/length*amount))
        coast=Polygon(ring).buffer(0)
    coast=coast.difference(Point(.55,.48).buffer(.044,resolution=12))
    transform_grid=from_bounds(0,0,aspect,1,w,h)
    scaled=transform(lambda x,y:(x*aspect,1-y),coast)
    mask=rasterize([(scaled,1)],out_shape=(h,w),transform=transform_grid).astype(bool)
    yy,xx=np.mgrid[:h,:w];xx=xx/w;yy=yy/h
    rng=np.random.default_rng(7841)
    relief=gaussian_filter(rng.random((h,w)),5)*.3
    relief+=np.exp(-((xx-(.55+.08*np.sin(yy*9)))**2/.0025))*0.9
    relief+=np.exp(-((xx-.87)**2+(yy-.38)**2)/.007)*1.4
    markers=np.zeros((h,w),dtype=np.int32)
    points=[]
    for i,s in enumerate(m['sites']):
        x,y=normalize(m,s[2],s[3]);point=Point(x,y)
        if not coast.covers(point):
            from shapely.ops import nearest_points
            point=nearest_points(coast.buffer(-.008),point)[0];x,y=point.coords[0]
        markers[min(h-1,int(y*h)),min(w-1,int(x*w))]=i+1;points.append(Point(x*aspect,y))
    labels=watershed(np.hypot(*np.gradient(relief)),markers,mask=mask,compactness=.0002)
    cells=[None]*len(points)
    for geo,value in shapes(labels.astype('int16'),mask=labels>0,transform=transform_grid):
        cell=transform(lambda x,y:(x,1-y),shape(geo));i=int(value)-1
        cells[i]=cell if cells[i] is None else cells[i].union(cell)
    cells=list(coverage_simplify(cells,.004))
    width=1200;height=round(width/aspect)
    palette={'forest':(56,85,65),'hills':(136,128,112),'plains':(159,163,117),'city':(176,163,120),'coast':(130,159,147),'desert':(137,106,88)}
    rgb=np.zeros((h,w,3));rgb[:]=[39,70,86]
    for i,s in enumerate(m['sites']):rgb[labels==i+1]=palette[s[1]]
    if m.get('asset_id'):
        # Continuous biomes, independent of ownership sectors: woods and ash
        # blend into neighboring valleys instead of stopping at polygon edges.
        rgb[mask]=[158,166,119]
        woods=np.zeros((h,w))
        for s in m['sites']:
            if s[1]=='forest':
                fx,fy=normalize(m,s[2],s[3]);woods=np.maximum(woods,np.exp(-((xx-fx)**2/.010+(yy-fy)**2/.016)))
        woods=np.clip(woods*.95,0,.95)
        ash=np.exp(-((xx-.87)**2/.018+(yy-.40)**2/.030))*.8
        rock=np.clip((relief-.35)*.8,0,.8)
        for factor,color in [(woods,[51,86,57]),(rock,[152,144,121]),(ash,[108,91,79])]:
            rgb[mask]=rgb[mask]*(1-factor[mask,None])+np.array(color)*factor[mask,None]
    sy,sx=np.gradient(relief);shade=np.clip(.90-sx*12-sy*12,.60,1.15)
    rgb[mask]*=shade[mask,None]
    # Blend the illustrated land colors across sector boundaries. Ownership is
    # rendered separately by the game; the background should read as a landscape.
    blurred=np.stack([gaussian_filter(rgb[:,:,c],4) for c in range(3)],axis=2)
    rgb[mask]=blurred[mask]
    background=Image.fromarray(np.clip(rgb,0,255).astype('uint8')).resize((width,height),Image.Resampling.BICUBIC)
    draw=ImageDraw.Draw(background,'RGBA')
    for _ in range(2200):
        x=int(rng.integers(w));y=int(rng.integers(h));i=int(labels[y,x])-1
        if i<0:continue
        px=x/w*width;py=y/h*height;kind=m['sites'][i][1]
        if (woods[y,x]>.30 if m.get('asset_id') else kind=='forest'):draw.ellipse((px-3,py-4,px+3,py+4),fill=(24,60,43,130))
        if kind=='hills':draw.line([(px-5,py+4),(px,py-6),(px+5,py+4)],fill=(72,67,61,120),width=1)
    rivers=[dict(name='Alder River',points=[(.39,.19),(.36,.31),(.42,.47),(.41,.59),(.47,.73),(.56,.84)])]
    for r in rivers:draw.line([(x*width,y*height) for x,y in r['points']],fill=(104,159,174,245),width=5)
    # Volcanic landmark in the eastern realm.
    x=.84*width;y=.34*height
    if not m.get('asset_id'):draw.polygon([(x-17,y+14),(x,y-20),(x+17,y+14)],fill=(49,41,43,255),outline=(221,109,53,240))
    image=f'terrain/{m.get("asset_id", "emberfall_v1")}.webp';(ROOT/'ui/maps/terrain').mkdir(exist_ok=True)
    background.save(ROOT/'ui/maps'/image,quality=88)
    return cells,points,dict(terrain=dict(image=image,illustrated=True,source='Original BorderStrife artwork',note='Original fictional geography and illustrated relief. No real-world scale or measured elevations.'),rivers=rivers,water_labels=[dict(name='Glasswater',center=[.55,.48])])


def routes_for(m,cells,points,rivers):
    aspect=frame_for(m);routes={};edges=set();n=len(cells)
    water=unary_union([LineString([(x*aspect,y) for x,y in r['points']]) for r in rivers if len(r['points'])>1])
    for a in range(n):
        for b in range(a+1,n):
            first,second=cells[a],cells[b]
            shared=first.boundary.intersection(second.boundary).length
            near=first.distance(second)<=1e-6 and first.buffer(1e-6).intersection(second).length>1e-5
            if shared<=1e-7 and not near:continue
            edge=(a,b);edges.add(edge)
            routes[f'{a}:{b}']='river' if LineString([points[a],points[b]]).intersects(water) else 'pass' if any(m['sites'][i][1]=='hills' for i in edge) else 'road'
    # Minimal sea bridges join disjoint islands. No arbitrary non-neighbor land shortcuts.
    ports=set()
    while not connected(n,edges):
        reached={0};todo=[0]
        while todo:
            a=todo.pop()
            for x,y in edges:
                b=y if x==a else x if y==a else None
                if b is not None and b not in reached:reached.add(b);todo.append(b)
        a,b=min(((a,b) for a in reached for b in range(n) if b not in reached),key=lambda ab:cells[ab[0]].distance(cells[ab[1]]))
        a,b=sorted((a,b));edges.add((a,b));routes[f'{a}:{b}']='sea';ports.update((a,b))
    neighbors={str(i):sorted(b if a==i else a for a,b in edges if i in (a,b)) for i in range(n)}
    return dict(neighbors=neighbors,routes=routes,ports=sorted(ports))


def build(province_archive,river_archive,only=None):
    provinces=[(r.record['adm0_a3'],shape(r.shape.__geo_interface__).buffer(0)) for r in shapefile.Reader(str(province_archive)).iterShapeRecords()]
    river_source=[(r.record['name_en'] or r.record['name'] or 'River',shape(r.shape.__geo_interface__)) for r in shapefile.Reader(str(river_archive)).iterShapeRecords() if r.record['scalerank']<=5]
    target=ROOT/'engine/presets/expansion.json'
    presets=json.loads(target.read_text()) if target.exists() else {}
    for m in MAPS:
        if only and m['id']!=only:continue
        aspect=frame_for(m);extras={};rivers=[]
        if m['kind']=='regional':
            cells,points=geography(m,provinces)
            w,s,e,n=m['bounds'];frame=box(w,s,e,n)
            for name,g in river_source:
                if not g.intersects(frame):continue
                for segment in lines(transform(lambda x,y:normalize(m,x,y),g.intersection(frame)).simplify(.0007)):
                    rivers.append(dict(name=name,points=[[round(x,6),round(y,6)] for x,y in segment.coords]))
        elif m['kind']=='local':cells,points,extras=topography(m,provinces);rivers=extras.get('rivers',[])
        else:cells,points,extras=fantasy(m);rivers=extras.get('rivers',[])
        # Quantize before deriving routes, so the displayed borders and graph agree.
        cells=[transform(lambda x,y:(np.round(np.asarray(x)/aspect,6)*aspect,np.round(y,6)),c).buffer(0) for c in cells]
        features=[];raw=[]
        for i,(cell,point,site) in enumerate(zip(cells,points,m['sites'])):
            assert cell.is_valid and not cell.is_empty,(m['id'],i)
            if not cell.covers(point):point=max(polygons(cell),key=lambda g:g.area).representative_point();points[i]=point
            center=[round(point.x/aspect,6),round(point.y,6)]
            rings=[[[[round(x/aspect,6),round(y,6)] for x,y in ring.coords] for ring in [poly.exterior,*poly.interiors]] for poly in polygons(cell)]
            features.append(dict(id=i,name=site[0],center=center,polygons=rings))
            raw.append([site[0],site[1],*center])
        rules=routes_for(m,cells,points,rivers)
        adjacency=[set(rules['neighbors'][str(i)]) for i in range(len(raw))]
        seat,rival,friendly,enemy=recommended_layout(m,raw,adjacency)
        asset=m['id']+'_v1'
        note=('Modern coastlines and administrative geometry define gameplay regions; these are not exact historical political borders.' if m['kind']=='regional' else 'Measured modern elevation; historical land cover, paths and sector boundaries are reconstructed for play.')
        if m['category']=='legends':note=('Literary-inspired setting with imaginative place assignments, not archaeological evidence. '+note) if m['kind']!='fantasy' else 'Original fictional world, names and artwork; no real-world geography or measured elevation.'
        description=m['description']+' 24 regions.'
        preset=dict(id=m['id'],name=m['name'],category=m['category'],description=description,map_asset_id=asset,regions=raw,
                    player1_capital=seat,player2_capital=rival,player1_extra_starts=sorted(friendly-{seat}),player2_extra_starts=sorted(enemy-{rival}),
                    setting=dict(era=m.get('era',m.get('date','')),note=note,sources=[m['source']] if 'source' in m else [],terrain_note=note))
        if m['category']=='historical':
            caps=m['capitals'];axis=0 if m['axis']=='x' else 1
            # A two-source graph partition gives each side a connected opening deployment.
            owned={caps[0]:0,caps[1]:1};queues=[[caps[0]],[caps[1]]]
            while len(owned)<len(raw):
                for side in (0,1):
                    frontier=sorted({b for a in queues[side] for b in adjacency[a]}-owned.keys(),key=lambda i:(raw[i][2+axis]*(1 if side==0 else -1),i))
                    if frontier:owned[frontier[0]]=side;queues[side].append(frontier[0])
            battle=dict(id=m['id'],name=m['name'],bounds=m['bounds'],date=m['date'],sides=m['sides'],commanders=m['commanders'],
                        capitals=caps,objectives=m['objectives'],defender=m['defender'],sources=[m['source']],context=m['description'],terrain_note=note,
                        sites=[[*site,owned[i],80 if i in caps else 50 if site[1]=='city' else 40] for i,site in enumerate(m['sites'])],roads=[],ridges=[])
            preset.update(battle=battle,player1_capital=caps[0],player2_capital=caps[1],player1_extra_starts=sorted(set(queues[0])-{caps[0]}),player2_extra_starts=sorted(set(queues[1])-{caps[1]}))
        attribution='Natural Earth · Gameplay borders approximated'
        if m['kind']=='local':attribution='Mapzen terrain · Interpreted setting'
        if m['category']=='legends':attribution='Original fantasy artwork' if m['kind']=='fantasy' else 'Literary-inspired interpretation · Not historical evidence'
        atlas=dict(id=asset,category=m['category'],aspect=aspect,bounds=m['bounds'],regions=features,rivers=rivers,water_labels=[],attribution=attribution,**{k:v for k,v in extras.items() if k not in ('rivers','water_labels')})
        atlas['water_labels']=extras.get('water_labels',[])
        atlas['setting']=preset['setting']
        for path,data in [(ROOT/f'ui/maps/{asset}.json',atlas),(ROOT/f'engine/presets/geography/{asset}.json',rules)]:path.write_text(json.dumps(data,separators=(',',':'))+'\n')
        presets[m['id']]=preset
        print(m['id'],len(raw),'regions',len(rules['routes']),'routes',flush=True)
    target.write_text(json.dumps(presets,indent=2)+'\n')


if __name__=='__main__':
    if sys.argv[1]=='--fetch-terrain':
        from .fetch_battle_terrain import fetch
        local_maps=[m for m in MAPS if m['kind']=='local']
        fetch(battles=local_maps)
    else:build(Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3] if len(sys.argv)>3 else None)
