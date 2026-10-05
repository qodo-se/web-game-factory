"""Build-time geographic regression: every shared border allows travel both ways.

Run with the map-build environment (Shapely); no GIS dependency at runtime.
"""
import json
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
from games.borderstrife.engine.presets import PRESETS
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import Move, Owner, TurnActions
from games.borderstrife.engine.turn_resolver import validate_actions

ROOT=Path(__file__).resolve().parents[1]

def check():
    total=0
    for key,preset in PRESETS.items():
        data=json.loads((ROOT/f'ui/maps/{preset["map_asset_id"]}.json').read_text())
        polygons=[unary_union([Polygon(p[0],p[1:]).buffer(0) for p in r['polygons']]) for r in data['regions']]
        engine=GameEngine.from_preset(key)
        for region in engine.state.regions.values():region.owner=Owner.PLAYER_1;region.army=100
        moves=engine.get_valid_moves('player_1')
        borders=0
        for a,first in enumerate(polygons):
            for b in range(a+1,len(polygons)):
                second=polygons[b]
                # Exact shared segments, plus six-decimal quantization seams.
                shared=first.boundary.intersection(second.boundary).length>1e-7
                near=first.distance(second)<=1e-6 and first.buffer(1e-6).intersection(second).length>1e-5
                if not(shared or near):continue
                assert b in moves[a] and a in moves[b],(key,a,b,'blocked land border')
                assert engine.state.routes[f'{a}:{b}']!='sea',(key,a,b,'land border marked sea')
                for source,target in [(a,b),(b,a)]:
                    validate_actions(engine.state,TurnActions('player_1',[Move(source,target)]))
                borders+=1
        total+=borders
        print(f'{key}: {borders} shared borders traversable in both directions')
    print(f'Validated {total} land borders across {len(PRESETS)} maps.')

if __name__=='__main__':check()
