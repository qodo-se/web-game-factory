"""Real DEM relief, reconstructed landscape and terrain-aware gameplay sectors.

All expensive raster and polygon work happens at build time. The browser loads
one compressed image and the already simplified geometry per battlefield.
"""
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, distance_transform_edt, zoom
from shapely import coverage_simplify, voronoi_polygons
from shapely.geometry import Polygon, MultiPoint, Point, LineString, box, shape
from shapely.ops import unary_union
from rasterio.features import shapes
from rasterio.transform import from_bounds
from skimage.segmentation import watershed
import contourpy
from .battle_sources.landscape import LANDSCAPES

ROOT=Path(__file__).resolve().parents[1]
SOURCES=Path(__file__).with_name('battle_sources')


def clean_elevation(battle):
    archive=np.load(SOURCES/f'{battle["id"]}-elevation.npz')
    assert np.allclose(archive['bounds'],battle['bounds'])
    elevation=archive['elevation'].copy()
    invalid=~np.isfinite(elevation) | (elevation < -300) | (elevation > 2000)
    repaired=int(invalid.sum())
    if repaired:
        nearest=distance_transform_edt(invalid,return_distances=False,return_indices=True)
        elevation[invalid]=elevation[tuple(nearest[:,invalid])]
    # Remove the post-1815 Lion's Mound from the historical rendering. Surrounding
    # terrain has also changed; this interpolation is not a recovered 1815 survey.
    if battle['id']=='waterloo':
        west,south,east,north=battle['bounds'];h,w=elevation.shape
        yy,xx=np.mgrid[:h,:w]
        mound=((xx/(w-1)*(east-west)+west-4.4059)*math.cos(math.radians(north))*111320)**2+((north-yy/(h-1)*(north-south)-50.6781)*111320)**2 < 140**2
        nearest=distance_transform_edt(mound,return_distances=False,return_indices=True)
        elevation[mound]=elevation[tuple(nearest[:,mound])]
    return gaussian_filter(elevation,1.1),repaired


def build_terrain(battle,aspect,points):
    landscape=LANDSCAPES[battle['id']]
    elevation,repaired=clean_elevation(battle)
    h,w=elevation.shape
    west,south,east,north=battle['bounds']
    dx=(east-west)*math.cos(math.radians((south+north)/2))*111320/(w-1)
    dy=(north-south)*111320/(h-1)
    sy,sx=np.gradient(elevation,dy,dx)
    # Exaggerate only relief illumination on flatter sites, never elevation data.
    exaggeration=3 if battle['id'] in ('waterloo','hastings','gettysburg') else 1.6
    nx,ny=-sx*exaggeration,-sy*exaggeration
    norm=np.sqrt(nx*nx+ny*ny+1)
    shade=(nx*(-.5)+ny*(-.5)+.7071)/norm
    shade=np.clip(shade,.05,1)
    low,high=np.percentile(elevation,[2,98])
    relative=np.clip((elevation-low)/max(1,high-low),0,1)
    if battle['id']=='hattin':
        low_color=np.array([167,161,111]);high_color=np.array([204,183,132])
    else:
        low_color=np.array([159,176,126]);high_color=np.array([194,188,143])
    rgb=low_color[None,None,:]*(1-relative[:,:,None])+high_color[None,None,:]*relative[:,:,None]
    # Stable water surface of Lake Tiberias in the DEM gives a much more detailed
    # shoreline than the previous hand-drawn diagonal. Its medieval level varies.
    water=elevation < -210 if battle['id']=='hattin' else np.zeros_like(elevation,dtype=bool)
    rgb[water]=[92,139,149]
    width=1536;height=round(width/aspect)
    base=Image.fromarray(rgb.astype('uint8')).resize((width,height),Image.Resampling.BICUBIC)
    draw=ImageDraw.Draw(base,'RGBA')
    rng=np.random.default_rng(sum(map(ord,battle['id'])))
    def pixels(line):return [(round(x*width),round(y*height)) for x,y in line]
    wood_geoms=[Polygon(ring) for ring in landscape['woods']]
    woods=unary_union(wood_geoms)
    # Field boundaries are authored cartographic texture, not claimed cadastral
    # data: irregular, understated enclosures, clipped by woodland and water.
    step=landscape['field_size']
    field_points=[(x+rng.uniform(-step*.35,step*.35),y+rng.uniform(-step*.35,step*.35))
                  for y in range(-step,height+step,step) for x in range(-step,width+step,step)]
    fields=voronoi_polygons(MultiPoint(field_points)).geoms
    for field in fields:
        field=field.intersection(box(0,0,width,height))
        if field.is_empty or field.geom_type!='Polygon':continue
        cx,cy=field.centroid.coords[0]
        if woods.contains(Point(cx/width,cy/height)) or water[min(h-1,int(cy/height*h)),min(w-1,int(cx/width*w))]:continue
        color=[(192,178,122,38),(116,135,86,28),(225,204,144,30),(154,162,107,18)][int(rng.integers(4))]
        draw.polygon(list(field.exterior.coords),fill=color,outline=(97,107,70,34))
        # Parallel crop rows stay inside individual field polygons.
        minx,miny,maxx,maxy=field.bounds
        for x in np.arange(minx,maxx,9):
            segment=LineString([(x,miny),(x+12,maxy)]).intersection(field)
            if segment.geom_type=='LineString' and not segment.is_empty:
                draw.line(list(segment.coords),fill=(103,107,65,17),width=1)
    for ring in landscape['woods']:
        draw.polygon(pixels(ring),fill=(55,90,62,135))
    for ring in landscape['orchards']:
        draw.polygon(pixels(ring),fill=(82,117,70,100),outline=(61,82,42,130))
    # Canopy detail within reconstructed wooded areas, deterministic at rebuild.
    wood_mask=Image.new('L',(width,height));md=ImageDraw.Draw(wood_mask)
    for ring in landscape['woods']:md.polygon(pixels(ring),fill=255)
    mask=np.asarray(wood_mask)
    for y in range(4,height,8):
        for x in range(4,width,8):
            if not mask[y,x]:continue
            x+=int(rng.integers(-3,4));y2=y+int(rng.integers(-3,4));r=int(rng.integers(3,7))
            draw.ellipse((x-r,y2-r,x+r,y2+r),fill=(40,72,42,int(rng.integers(35,90))))
            draw.arc((x-r,y2-r,x+r,y2+r),185,290,fill=(180,191,123,65),width=1)
    for ring in landscape['orchards']:
        poly=Polygon(pixels(ring));minx,miny,maxx,maxy=poly.bounds
        for y in range(int(miny),int(maxy),12):
            for x in range(int(minx),int(maxx),12):
                if poly.contains(Point(x,y)):draw.ellipse((x-2,y-2,x+2,y+2),fill=(42,82,42,165))
    # Shade the landscape continuously across control-sector boundaries.
    illumination=np.asarray(Image.fromarray(shade.astype('float32'),'F').resize((width,height),Image.Resampling.BICUBIC))
    arr=np.asarray(base,dtype=float)
    arr*=np.clip(.63+illumination*.50,.63,1.13)[:,:,None]
    grain=rng.normal(0,1.1,(height,width,1))
    base=Image.fromarray(np.clip(arr+grain,0,255).astype('uint8'))
    draw=ImageDraw.Draw(base,'RGBA')
    # Contours are derived from the measured elevations, not decorative rings.
    contours=[];interval=landscape['contour_interval']
    generator=contourpy.contour_generator(x=np.linspace(0,1,w),y=np.linspace(0,1,h),z=elevation)
    for level in range(math.ceil(float(elevation.min())/interval)*interval,math.ceil(float(elevation.max())/interval)*interval,interval):
        if level < -210:continue
        for line in generator.lines(level):
            geom=LineString(line).simplify(.0006)
            if geom.length<.035:continue
            coords=[[round(x,5),round(y,5)] for x,y in geom.coords]
            major=level%(interval*5)==0
            contours.append(dict(elevation=level,major=major,points=coords))
            draw.line(pixels(coords),fill=(74,73,49,95 if major else 44),width=2 if major else 1)
    # Watercourses are landscape reconstructions and named accordingly in metadata.
    for name,line in landscape['streams']:
        draw.line(pixels(line),fill=(66,106,99,120),width=9)
        draw.line(pixels(line),fill=(92,146,164,240),width=4)
        draw.line(pixels(line),fill=(177,201,192,175),width=1)
    for line in landscape['paths']:
        draw.line(pixels(line),fill=(86,73,49,170),width=7)
        draw.line(pixels(line),fill=(218,200,150,235),width=4)
    for rid in landscape['forts']:
        x,y=points[rid];cx=round(x/aspect*width);cy=round(y*height)
        # Small original ground-plan symbols, not modern building footprints.
        draw.rectangle((cx-11,cy-9,cx+11,cy+9),fill=(211,193,151,245),outline=(74,65,48,245),width=2)
        for a,b,c,d in [(cx-13,cy-12,cx+13,cy-7),(cx-13,cy+7,cx+13,cy+12),(cx-13,cy-7,cx-8,cy+7)]:
            draw.rectangle((a,b,c,d),fill=(115,86,62,255),outline=(62,57,46,255))
    output=ROOT/'ui/maps/terrain';output.mkdir(exist_ok=True)
    base.save(output/f'{battle["id"]}.webp',quality=88,method=6)

    # Seeded watershed: ridges and waterways influence sector boundaries. Seeds
    # remain the stable region IDs; every sector is connected to its own anchor.
    gh=round(320/aspect);gw=320
    grid=zoom(elevation,(gh/h,gw/w),order=1)
    gradient=np.hypot(*np.gradient(gaussian_filter(grid,1)))
    cost=gradient/max(.1,float(np.percentile(gradient,90)))
    markers=np.zeros((gh,gw),dtype=np.int32)
    for rid,(x,y) in enumerate(points):markers[min(gh-1,int(y*gh)),min(gw-1,int(x/aspect*gw))]=rid+1
    landmask=zoom((~water).astype(float),(gh/h,gw/w),order=0)>.5
    assert all(landmask[min(gh-1,int(y*gh)),min(gw-1,int(x/aspect*gw))] for x,y in points),'Anchor lies in water'
    labels=watershed(cost,markers,mask=landmask,compactness=.045,connectivity=1)
    transform=from_bounds(0,0,aspect,1,gw,gh)
    # rasterio rows increase down, while its north-up affine flips Y. Convert back.
    from shapely.ops import transform as transform_geom
    cells=[None]*len(points)
    for geo,value in shapes(labels.astype('int16'),mask=labels>0,transform=transform):
        poly=transform_geom(lambda x,y:(x,1-y),shape(geo))
        rid=int(value)-1
        cells[rid]=poly if cells[rid] is None else cells[rid].union(poly)
    cells=list(coverage_simplify(cells,.004,simplify_boundary=True))
    # Runtime source note links explain modern DEM vs reconstructed period detail.
    metadata=dict(image=f'terrain/{battle["id"]}.webp',min_elevation=round(float(elevation.min())),max_elevation=round(float(elevation.max())),
                  contour_interval=interval,width_m=round((east-west)*math.cos(math.radians((south+north)/2))*111320),
                  repaired_samples=repaired,source='Mapzen Terrain Tiles',
                  elevations=[round(float(elevation[min(h-1,int(y*h)),min(w-1,int(x/aspect*w))])) for x,y in points],
                  note='Modern elevation baseline; reconstructed historical land cover, paths and watercourses. Control sectors follow terrain but remain gameplay boundaries.')
    return cells,metadata,contours,landscape
