"""Connected cartographic sectors. GIS is used only while building assets."""
import math
import numpy as np
from scipy.ndimage import distance_transform_edt, gaussian_filter, label
from skimage.segmentation import watershed
from rasterio.features import rasterize, shapes
from rasterio.transform import from_bounds
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union, transform
from shapely import coverage_simplify, STRtree


def pieces(geometry):
    if geometry.geom_type == 'Polygon':return [geometry]
    return [p for g in getattr(geometry,'geoms',[]) for p in pieces(g)]


def _partition_landmass(land, centers, aspect, relief=None, width=900, compactness=.03):
    """Grow sectors on land, never across water; retain the exact outer coastline.

    Islands without a named anchor are assigned whole, not split between distant
    mainland regions. This prevents tiny island fragments creating phantom edges.
    """
    h=max(220,round(width/aspect));w=width
    affine=from_bounds(0,1,aspect,0,w,h)
    mask=rasterize([(land,1)],out_shape=(h,w),transform=affine).astype(bool)
    nearest=distance_transform_edt(~mask,return_distances=False,return_indices=True)
    markers=np.zeros((h,w),dtype='int32')
    for i,p in enumerate(centers):
        row,col=max(0,min(h-1,int(p.y*h))),max(0,min(w-1,int(p.x/aspect*w)))
        row,col=nearest[:,row,col]
        if markers[row,col]:
            options=np.argwhere(mask & (markers==0));row,col=options[np.argmin(np.sum((options-[row,col])**2,axis=1))]
        markers[row,col]=i+1
    # A gentle, continuous cost avoids rigid rectangles without invented obstacles.
    if relief is None:
        yy,xx=np.mgrid[:h,:w];xx=xx/w*aspect;yy=yy/h
        cost=(np.sin(xx*29+yy*7)+np.cos(yy*23-xx*5))*.15+.4
    else:
        from scipy.ndimage import zoom
        z=zoom(relief,(h/relief.shape[0],w/relief.shape[1]),order=1)
        cost=np.hypot(*np.gradient(gaussian_filter(z,1)))
        cost/=max(.01,np.percentile(cost,90))
    labels=watershed(cost,markers,mask=mask,compactness=compactness)
    # Attach unseeded islands as a whole to their closest region anchor.
    comps,count=label(mask & (labels==0))
    for idx in range(1,count+1):
        rows,cols=np.where(comps==idx);point=Point(float(cols.mean()/w*aspect),float(rows.mean()/h))
        owner=min(range(len(centers)),key=lambda i:point.distance(centers[i]))
        labels[comps==idx]=owner+1
    collected=[[] for _ in centers]
    for geo,value in shapes(labels.astype('int16'),mask=labels>0,transform=affine):collected[int(value)-1].append(shape(geo))
    # Extend raster edges half a pixel before clipping, with non-overlapping cells
    # obtained by assigning the remaining thin coastal slivers separately.
    cells=[unary_union(p).intersection(land).buffer(0) for p in collected]
    missing=land.difference(unary_union(cells))
    tree=STRtree(cells);additions=[[] for _ in centers]
    for p in pieces(missing):
        candidates=[int(i) for i in tree.query(p.buffer(1e-8))]
        owner=max(candidates,key=lambda i:cells[i].boundary.intersection(p.boundary).length) if candidates else min(range(len(centers)),key=lambda i:p.distance(centers[i]))
        additions[owner].append(p)
    cells=[unary_union([c,*extra]).buffer(0) if extra else c for c,extra in zip(cells,additions)]
    cells=list(coverage_simplify(cells,.0012,simplify_boundary=False))
    return cells


def partition(land, centers, aspect, relief=None, width=900, compactness=.03):
    # Partition each exact connected landmass independently. A one-pixel strait
    # or a coast sliver must never let an island borrow a mainland region ID.
    masses=pieces(land)
    homes=[min(range(len(masses)),key=lambda j:masses[j].distance(p)) for p in centers]
    assigned=[[] for _ in centers]
    for j,mass in enumerate(masses):
        residents=[i for i,home in enumerate(homes) if home==j]
        if not residents:
            owner=min(range(len(centers)),key=lambda i:mass.distance(centers[i]))
            assigned[owner].append(mass)
        elif len(residents)==1:assigned[residents[0]].append(mass)
        else:
            cells=_partition_landmass(mass,[centers[i] for i in residents],aspect,relief,width,compactness)
            for i,c in zip(residents,cells):assigned[i].append(c)
    return [unary_union(c).buffer(0) for c in assigned]


def balanced_starts(raw, adjacency, seats):
    """Choose connected three-region starts with similar growth and frontier access."""
    from games.borderstrife.engine.models import TERRAIN_POP_RATE, TerrainType
    rates=[TERRAIN_POP_RATE[TerrainType(r[1])] for r in raw]
    def options(seat,excluded):
        sets={frozenset([seat])}
        for _ in range(2):
            sets={s|{n} for s in sets for n in set().union(*(adjacency[i] for i in s))-s-excluded}
        return sets
    a,b=seats; pairs=[]
    for left in options(a,{b}):
        for right in options(b,left):
            l=sum(rates[i] for i in left);r=sum(rates[i] for i in right)
            lf=len(set().union(*(adjacency[i] for i in left))-left-right)
            rf=len(set().union(*(adjacency[i] for i in right))-left-right)
            # Match both growth and initial strength (same terrain-based rule),
            # with a secondary preference for similar room to expand.
            score=abs(math.log(l/r))*20+abs(lf-rf)*.2-(l+r)*.005
            pairs.append((score,tuple(sorted(left)),tuple(sorted(right))))
    if not pairs:raise ValueError('Cannot create two disjoint three-region starts')
    _,left,right=min(pairs)
    return set(left),set(right)


def repair_fragments(cells, centers, protected=()):
    """Reassign unanchored fragments through real shared boundaries.

    Each labeled region keeps the component containing its geographic anchor.
    Disconnected coastal remnants grow from those components; whole unseeded
    islands remain attached to their nearest anchor and cannot create land edges.
    """
    import heapq
    polygons=[];old=[];roots={}
    for i,c in enumerate(cells):
        parts=pieces(c);primary=min(range(len(parts)),key=lambda j:parts[j].distance(centers[i]))
        for j,p in enumerate(parts):
            idx=len(polygons);polygons.append(p);old.append(i)
            if j==primary or i in protected:roots[idx]=i
    tree=STRtree(polygons);owned=dict(roots);queue=[]
    def push(idx,owner):
        if owner in protected:return
        for other in tree.query(polygons[idx].buffer(1e-7)):
            other=int(other)
            if other in owned or other==idx:continue
            shared=polygons[idx].boundary.intersection(polygons[other].boundary).length
            if shared>1e-8:heapq.heappush(queue,(-shared,other,owner))
    for idx,owner in roots.items():push(idx,owner)
    while queue:
        _,idx,owner=heapq.heappop(queue)
        if idx in owned:continue
        owned[idx]=owner;push(idx,owner)
    # An island can contain several old fragments but no capital/label anchor.
    # Assign that entire connected island once, rather than retaining its old
    # splits and accidentally joining two distant mainland territories.
    remaining=set(range(len(polygons)))-owned.keys()
    while remaining:
        first=remaining.pop();group={first};todo=[first]
        while todo:
            idx=todo.pop()
            for other in tree.query(polygons[idx].buffer(1e-7)):
                other=int(other)
                if other in remaining and polygons[idx].boundary.intersection(polygons[other].boundary).length>1e-8:
                    remaining.remove(other);group.add(other);todo.append(other)
        island=unary_union([polygons[i] for i in group])
        owner=min((i for i in range(len(centers)) if i not in protected),key=lambda i:island.distance(centers[i]))
        for idx in group:owned[idx]=owner
    result=[[] for _ in cells]
    for idx,p in enumerate(polygons):result[owned[idx]].append(p)
    return [unary_union(ps).buffer(0) for ps in result]
