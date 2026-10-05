"""Build atlas_v4 presentation assets from immutable reviewed maps.

python -m games.borderstrife.tools.build_polished_maps /path/to/provinces.zip
No network access. Old map versions and scenario rules are retained.
"""
import copy
import json
import math
from pathlib import Path
import sys
import numpy as np
import shapefile
from PIL import Image, ImageDraw, ImageEnhance
from scipy.ndimage import distance_transform_edt, gaussian_filter
from shapely import segmentize, set_precision
from shapely.geometry import Polygon, Point, box, shape
from shapely.ops import unary_union, transform, nearest_points
from .map_partition import pieces
from .map_details import WATERS

ROOT = Path(__file__).resolve().parents[1]
GRID_MAPS = {'panipat_1526', 'cannae_216', 'naseby_1645', 'kurukshetra'}


def rings(geometry):
    geometry=set_precision(geometry,1e-6,mode='valid_output')
    return [[[[round(x, 6), round(y, 6)] for x, y in ring.coords]
             for ring in [p.exterior, *p.interiors]] for p in pieces(geometry) if p.area>1e-10]


def geometry(feature):
    return unary_union([Polygon(p[0], p[1:]) for p in feature['polygons']])


def mask_for(land, size):
    mask = Image.new('L', size)
    draw = ImageDraw.Draw(mask)
    for p in pieces(land):
        draw.polygon([(x*size[0], y*size[1]) for x, y in p.exterior.coords], fill=255)
        for hole in p.interiors:
            draw.polygon([(x*size[0], y*size[1]) for x, y in hole.coords], fill=0)
    return mask


def smooth_shore(cells, tolerance=.007):
    land = unary_union(cells)
    smooth = land.simplify(tolerance,preserve_topology=True).buffer(.009, quad_segs=8).buffer(-.018, quad_segs=8).buffer(.009, quad_segs=8).intersection(box(0,0,1,1))
    contacts=unary_union([a.boundary.intersection(b.boundary) for i,a in enumerate(cells) for b in cells[:i]])
    smooth=smooth.union(contacts.buffer(.00004).intersection(land))
    result = [c.intersection(smooth) for c in cells]
    # Assign shoreline repairs locally. Giving a whole connected coastal ribbon
    # to one region would create spurious long-distance land connections.
    remaining=smooth.difference(unary_union(result))
    for i,c in enumerate(cells):
        extension=remaining.intersection(c.buffer(.02))
        result[i]=result[i].union(extension);remaining=remaining.difference(extension)
    assert remaining.area<1e-8,'Unassigned shoreline repair'
    return result


def soften_sectors(cells):
    def warp(x, y):
        x, y = np.asarray(x), np.asarray(y)
        edge = np.sin(np.pi*x)*np.sin(np.pi*y)
        return x+.019*edge*np.sin(7*y+2*x), y+.015*edge*np.sin(9*x-3*y)
    return [transform(warp, segmentize(c, .006)) for c in cells]


def terrain_image(key, atlas, old_land, land, asset):
    original = Image.open(ROOT/'ui/maps'/atlas['terrain']['image']).convert('RGB')
    if key == 'emberfall':
        w,h = 1440,round(1440/atlas['aspect'])
        yy,xx = np.mgrid[:h,:w];x=xx/w;y=yy/h
        rng=np.random.default_rng(481)
        noise=gaussian_filter(rng.random((h,w)),14)
        ridge=np.exp(-((x-(.52+.065*np.sin(y*9)))**2)/.0018)
        ridges=ridge*.22
        for py,power in [(.12,.6),(.24,.8),(.34,.65),(.47,.9),(.60,.65),(.71,.8)]:
            px=.52+.065*np.sin(py*9)
            ridges+=np.exp(-((x-px)**2/.0009+(y-py)**2/.0025))*power
        volcano=np.exp(-((x-.84)**2+(y-.34)**2)/.003)
        height=ridges+volcano*1.1+noise*.12
        sy,sx=np.gradient(height)
        shade=np.clip(.96-sx*19-sy*15,.66,1.20)
        rgb=np.empty((h,w,3));rgb[:]=[168,168,122]
        forest=np.maximum(np.exp(-((x-.29)**2/.010+(y-.32)**2/.025)),np.exp(-((x-.85)**2/.010+(y-.80)**2/.013)))
        for strength,color in [(np.clip(forest*.95,0,.95),[56,90,59]),(np.clip(ridge*.65,0,.7),[147,137,113]),(np.exp(-((x-.86)**2/.03+(y-.36)**2/.045))*.8,[113,89,72])]:
            rgb=rgb*(1-strength[...,None])+np.array(color)*strength[...,None]
        rgb*=shade[...,None];rgb+=rng.normal(0,.8,(h,w,1))
        original=Image.fromarray(np.clip(rgb,0,255).astype('uint8'))
        draw=ImageDraw.Draw(original,'RGBA')
        for _ in range(8500):
            px=int(rng.integers(w));py=int(rng.integers(h))
            if rng.random()>forest[py,px]*.65:continue
            size=int(rng.integers(2,4))
            draw.ellipse((px-size,py-size*1.5,px+size,py+size),fill=(34,65,41,150))
            draw.arc((px-size,py-size*1.5,px+size,py+size),190,290,fill=(163,180,108,130),width=1)
        # Continuous, gently curved river; painted separately from region lines.
        river=atlas['rivers'][0]['points'];coords=[]
        for a,b in zip(river,river[1:]):
            for t in np.linspace(0,1,30,endpoint=False):
                coords.append(((a[0]+(b[0]-a[0])*t+.004*math.sin(t*math.pi))*w,(a[1]+(b[1]-a[1])*t)*h))
        coords.append((river[-1][0]*w,river[-1][1]*h))
        draw.line(coords,fill=(51,85,83,220),width=7,joint='curve')
        draw.line(coords,fill=(129,182,183,245),width=3,joint='curve')
    else:
        original=ImageEnhance.Contrast(original).enhance(1.08)
        if key=='troy_troad':
            # Fill subpixel shoreline repairs from nearest existing land color.
            old=np.asarray(mask_for(old_land,original.size))>0
            nearest=distance_transform_edt(~old,return_distances=False,return_indices=True)
            rgb=np.asarray(original).copy();rgb[~old]=rgb[nearest[0][~old],nearest[1][~old]]
            original=Image.fromarray(rgb)
    # A transparent coast avoids the visible rectangular sea-color seam.
    original=original.convert('RGBA');original.putalpha(mask_for(land,original.size))
    image=f'terrain/{asset}.webp';original.save(ROOT/'ui/maps'/image,quality=91,method=6)
    atlas['terrain']['image']=image


def build(archive, only=None):
    source=json.loads((ROOT/'engine/presets/reviewed.json').read_text())
    provinces=[shape(r.shape.__geo_interface__).buffer(0) for r in shapefile.Reader(str(archive)).iterShapeRecords()]
    target=ROOT/'engine/presets/polished.json'
    out=json.loads(target.read_text()) if only and target.exists() else {}
    for key,preset in source.items():
        if only and key!=only:continue
        p=copy.deepcopy(preset);old=p['map_asset_id'];asset=key+'_atlas_v4'
        a=json.loads((ROOT/f'ui/maps/{old}.json').read_text())
        cells=[geometry(r) for r in a['regions']];old_land=unary_union(cells)
        if key in GRID_MAPS:cells=soften_sectors(cells)
        if key in {'troy_troad','emberfall'}:cells=smooth_shore(cells,.001 if key=='emberfall' else .007)
        for r,c in zip(a['regions'],cells):
            assert c.is_valid and c.buffer(1e-6).covers(Point(r['center'])),(key,r['name'])
            r['polygons']=rings(c)
        cells=[geometry(r) for r in a['regions']];land=unary_union(cells)
        # Reject any accidental topology change: this is a cartographic pass.
        rules=json.loads((ROOT/f'engine/presets/geography/{old}.json').read_text())
        old_cells=[geometry(r) for r in json.loads((ROOT/f'ui/maps/{old}.json').read_text())['regions']]
        for i in range(len(cells)):
            for j in range(i):
                assert (cells[i].distance(cells[j])<1e-5)==(old_cells[i].distance(old_cells[j])<1e-5),(key,i,j,'adjacency changed')
        if key!='emberfall':
            west,south,east,north=a['bounds'];dx=east-west;dy=north-south
            pad=max(.4,1/a['aspect'])
            frame=box(max(-180,west-pad*dx),max(-90,south-.7*dy),min(180,east+pad*dx),min(90,north+.7*dy))
            surrounding=unary_union([g.intersection(frame) for g in provinces if g.intersects(frame)])
            surrounding=transform(lambda x,y:((np.asarray(x)-west)/dx,(north-np.asarray(y))/dy),surrounding).simplify(.0007,preserve_topology=True)
            # Region hit-testing never includes this non-playable context.
            # At battlefield scale the DEM coast is finer than Natural Earth.
            # Context must never paint across a measured harbor or lake.
            context=surrounding.difference(box(0,0,1,1)).union(land) if 'terrain' in a else surrounding
            a['context_land']=rings(context)
            a['inland_frame']=surrounding.intersection(box(0,0,1,1)).area>.995
            if 'terrain' not in a and key in WATERS:
                water=box(0,0,1,1).difference(surrounding)
                labels=[]
                for name,x,y in WATERS[key]:
                    if not west<=x<=east or not south<=y<=north:continue
                    point=Point((x-west)/dx,(north-y)/dy)
                    if water.is_empty or point.distance(water)>.04:continue
                    if not water.covers(point):point=nearest_points(water,point)[0]
                    labels.append(dict(name=name,center=list(point.coords[0])))
                a['water_labels']=labels
        a['presentation_version']=4
        a['label_columns']=key=='andes_pacific'
        a['cartography_note']='Land outside the outlined theater is context only. Landmarks and vegetation are illustrative.'
        extras={
            'crusader_states':{'fort':['Jerusalem','Acre','Krak Highlands','Antioch']},
            'civil_war_east':{'town':['Washington','Richmond','Gettysburg']},
            'epic_lanka':{'palace':["Ravana's Court"],'camp':['Northern Landing']},
            'emberfall':{'fort':['Sunward Keep','Stonewake Halls'],'town':['Dawnspire','Rivermeet']},
            'kurukshetra':{'chariot':['Chariot Ground West','Chariot Ground East']},
            'constantinople':{'palace':['Hagia Sophia quarter'],'port':['Galata','Golden Horn']},
        }
        positions={r['name']:r['center'] for r in a['regions']}
        for kind,names in extras.get(key,{}).items():
            for name in names:
                if name not in positions:continue
                a['annotations']=[item for item in a.get('annotations',[]) if not (item.get('name')==name and item.get('center'))]
                a['annotations'].append(dict(kind=kind,name=name,center=positions[name]))
        if 'terrain' in a:terrain_image(key,a,old_land,land,asset)
        a['id']=asset;p['map_asset_id']=asset
        if a.get('terrain'):
            p.setdefault('setting',{})['terrain_note']=a['terrain']['note']+' Landmark artwork is illustrative.'
        a['setting']=p.get('setting',{})
        for path,data in [(ROOT/f'ui/maps/{asset}.json',a),(ROOT/f'engine/presets/geography/{asset}.json',rules)]:
            path.write_text(json.dumps(data,separators=(',',':'))+'\n')
        out[key]=p
        print(key,flush=True)
    target.write_text(json.dumps(out,indent=2)+'\n')

if __name__=='__main__':build(Path(sys.argv[1]),sys.argv[2] if len(sys.argv)>2 else None)
