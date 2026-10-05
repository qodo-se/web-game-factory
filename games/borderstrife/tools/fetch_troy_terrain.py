"""Pin Troy's alternate Mapzen/Skadi HGT source, avoiding void Terrarium tiles.

Explicit network step: python -m games.borderstrife.tools.fetch_troy_terrain
Only the clipped source is committed. Downloads are cached in the system temp dir.
"""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import numpy as np
from scipy.ndimage import map_coordinates
from .collection_sources import MAPS


def fetch():
    bounds=next(m['bounds'] for m in MAPS if m['id']=='troy_troad')
    w,s,e,n=bounds;width=640;height=round(width/((e-w)*np.cos(np.radians((n+s)/2))/(n-s)))
    xx,yy=np.meshgrid(np.linspace(w,e,width),np.linspace(n,s,height))
    elevation=np.zeros((height,width),dtype='float32');sources=[]
    for lat in [39,40]:
        tile=f'N{lat}E026';url=f'https://s3.amazonaws.com/elevation-tiles-prod/skadi/N{lat}/{tile}.hgt.gz'
        path=Path(tempfile.gettempdir())/(tile+'.hgt.gz')
        if not path.exists():subprocess.run(['curl','--fail','--location','--retry','2','--max-time','60','--silent','--show-error',url,'-o',str(path)],check=True)
        raw=gzip.decompress(path.read_bytes());dim=round(np.sqrt(len(raw)/2));grid=np.frombuffer(raw,dtype='>i2').reshape(dim,dim)
        mask=(yy>=lat)&(yy<lat+1)
        elevation[mask]=map_coordinates(grid.astype('float32'),[(lat+1-yy[mask])*(dim-1),(xx[mask]-26)*(dim-1)],order=1,mode='nearest')
        sources.append(dict(url=url,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),grid_size=dim))
    assert np.all(np.isfinite(elevation)) and np.min(elevation)>-300,'Alternate DEM still has voids'
    root=Path(__file__).with_name('battle_sources')
    np.savez_compressed(root/'troy_troad-reviewed-elevation.npz',elevation=elevation,bounds=bounds)
    (root/'troy_troad-reviewed-sources.json').write_text(json.dumps(dict(dataset='Mapzen elevation tiles: Skadi HGT',bounds=bounds,tiles=sources),indent=2)+'\n')
    print('Troy alternate DEM pinned:',elevation.shape,'range',float(elevation.min()),float(elevation.max()))

if __name__=='__main__':fetch()
