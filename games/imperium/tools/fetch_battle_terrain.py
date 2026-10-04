"""Fetch and pin terrain sources; run explicitly, never during normal builds.

python -m games.imperium.tools.fetch_battle_terrain
Source rasters are Mapzen Terrain Tiles (EU-DEM / SRTM / Environment Agency).
Curl uses the host trust store. Clipped sources and source manifests are committed.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
from games.imperium.engine.presets.battles import BATTLES

ROOT = Path(__file__).resolve().parent/'battle_sources'
CACHE = Path(tempfile.gettempdir())/'imperium-elevation-tiles'


def tile_xy(lon,lat,z):
    return ((lon+180)/360*2**z,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)


def tile(key):
    z,x,y=key
    CACHE.mkdir(exist_ok=True)
    path=CACHE/f'{z}-{x}-{y}.png';headers=path.with_suffix('.headers')
    url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
    if not path.exists():
        temp=path.with_suffix('.download')
        subprocess.run(['curl','--fail','--location','--retry','2','--max-time','45','--silent','--show-error','-D',str(headers),'-o',str(temp),url],check=True)
        Image.open(temp).verify();temp.replace(path)
    rgb=np.asarray(Image.open(path),dtype=float)
    elevation=rgb[:,:,0]*256+rgb[:,:,1]+rgb[:,:,2]/256-32768
    metadata={k.strip().lower():v.strip() for line in headers.read_text().splitlines() if ':' in line for k,v in [line.split(':',1)]}
    return key,elevation,dict(url=url,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                              sources=metadata.get('x-amz-meta-x-imagery-sources',''),last_modified=metadata.get('last-modified',''))


def fetch(only=None):
    ROOT.mkdir(exist_ok=True)
    for battle in BATTLES:
        if only and battle['id'] != only: continue
        west,south,east,north=battle['bounds'];z=14
        x0,y0=tile_xy(west,north,z);x1,y1=tile_xy(east,south,z)
        keys=[(z,x,y) for y in range(int(y0),int(y1)+1) for x in range(int(x0),int(x1)+1)]
        raster=np.zeros(((int(y1)-int(y0)+1)*256,(int(x1)-int(x0)+1)*256))
        manifest=[]
        with ThreadPoolExecutor(max_workers=4) as pool:
            for (_,x,y),array,meta in pool.map(tile,keys):
                raster[(y-int(y0))*256:(y-int(y0)+1)*256,(x-int(x0))*256:(x-int(x0)+1)*256]=array
                manifest.append(meta)
        aspect=(east-west)*math.cos(math.radians((north+south)/2))/(north-south)
        width=640;height=round(width/aspect)
        xs=np.linspace(west,east,width);ys=np.linspace(north,south,height)
        xx=(xs+180)/360*2**z*256-int(x0)*256-.5
        yy=(1-np.arcsinh(np.tan(np.radians(ys)))/np.pi)/2*2**z*256-int(y0)*256-.5
        gridx,gridy=np.meshgrid(xx,yy)
        clipped=map_coordinates(raster,[gridy,gridx],order=1,mode='nearest').astype('float32')
        np.savez_compressed(ROOT/f'{battle["id"]}-elevation.npz',elevation=clipped,bounds=battle['bounds'])
        (ROOT/f'{battle["id"]}-sources.json').write_text(json.dumps(dict(dataset='Mapzen Terrain Tiles',bounds=battle['bounds'],zoom=z,tiles=manifest),indent=2)+'\n')
        print(battle['id'],clipped.shape,round(float(clipped.min())),round(float(clipped.max())),len(keys),'tiles',flush=True)


if __name__ == '__main__':
    import sys
    fetch(sys.argv[1] if len(sys.argv) > 1 else None)
