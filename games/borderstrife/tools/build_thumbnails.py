"""Generate lightweight SVG map previews from the shipped campaign geometry.

Run from the repository root: python -m games.borderstrife.tools.build_thumbnails
Requires Shapely only at build time; no map download is needed in the browser.
"""
from html import escape
import base64
from io import BytesIO
import json
from pathlib import Path
from shapely.geometry import Polygon
from games.borderstrife.engine.presets import PRESETS

ROOT = Path(__file__).resolve().parents[1]
COLORS = dict(city='#d6bb78', plains='#9caa78', hills='#9c8c70',
              desert='#c5ad7e', forest='#647f65', coast='#8eb4a4')


def build():
    target = ROOT / 'ui/maps/thumbnails'
    target.mkdir(exist_ok=True)
    for key, preset in PRESETS.items():
        asset=preset.get('map_asset_id',key)
        data = json.loads((ROOT / f'ui/maps/{asset}.json').read_text())
        width = min(280, 164 * data['aspect'])
        height = width / data['aspect']
        left, top = (300-width)/2, (180-height)/2
        parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 180">',
                 f'<title>{escape(preset["name"])}</title>',
                 '<rect width="300" height="180" rx="6" fill="#14232e"/>']
        if data.get('terrain'):
            from PIL import Image
            thumb=Image.open(ROOT/'ui/maps'/data['terrain']['image'])
            thumb.thumbnail((420,260))
            payload=BytesIO();thumb.save(payload,format='WEBP',quality=85)
            encoded=base64.b64encode(payload.getvalue()).decode()
            parts.append(f'<image x="{left}" y="{top}" width="{width}" height="{height}" href="data:image/webp;base64,{encoded}"/>')
        for region in ([] if data.get('terrain') else data['regions']):
            paths = []
            for rings in region['polygons']:
                polygon = Polygon(rings[0], rings[1:]).simplify(.0012, preserve_topology=True)
                if polygon.is_empty:
                    continue
                for ring in [polygon.exterior, *polygon.interiors]:
                    paths.append('M' + 'L'.join(f'{left+x*width:.2f},{top+y*height:.2f}' for x,y in ring.coords) + 'Z')
            color = COLORS[preset['regions'][region['id']][1]]
            parts.append(f'<path d="{"".join(paths)}" fill="{color}" fill-rule="evenodd" stroke="#253d3d" stroke-width=".45" stroke-linejoin="round"/>')
        if data.get('category') == 'historical':
            for line in ([] if data.get('terrain') else data.get('roads', [])):
                d='M'+'L'.join(f'{left+x*width:.2f},{top+y*height:.2f}' for x,y in line)
                parts.append(f'<path d="{d}" fill="none" stroke="#ede0b3" stroke-width="1.4" stroke-dasharray="3 2"/>')
            for rid in preset['battle']['objectives']:
                x,y=data['regions'][rid]['center'];x=left+x*width;y=top+y*height
                parts.append(f'<path d="M{x:.2f},{y-4:.2f}l4,4 -4,4 -4,-4Z" fill="#ffe09a" stroke="#5b4622" stroke-width=".8"/>')
        parts.append('</svg>')
        (target / f'{asset}.svg').write_text('\n'.join(parts)+'\n')


if __name__ == '__main__':
    build()
