"""Geographic plausibility and retained-save checks for the reviewed collection."""
import json
from pathlib import Path
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from games.borderstrife.engine.presets import PRESETS
from games.borderstrife.engine.presets.loader import load_preset
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.replay import snapshot,campaign_states
from games.borderstrife.api.store import _encode,_decode

ROOT=Path(__file__).resolve().parents[1]


def check():
    from .map_partition import repair_fragments
    # Regression: a split, unanchored island must not create a mainland road.
    island=box(.35,.7,.55,.8)
    broken=[unary_union([box(0,0,.2,.3),box(.35,.7,.45,.8)]),
            unary_union([box(.8,0,1,.3),box(.45,.7,.55,.8)])]
    fixed=repair_fragments(broken,[Point(.1,.1),Point(.9,.1)])
    assert sum(c.covers(island) for c in fixed)==1
    assert fixed[0].boundary.intersection(fixed[1].boundary).length==0
    # The alternate Troy source contains measured samples across the old void.
    import numpy as np
    dem=np.load(ROOT/'tools/battle_sources/troy_troad-reviewed-elevation.npz')['elevation']
    assert np.all(np.isfinite(dem)) and dem.min()>-300
    count=0
    for key,p in PRESETS.items():
        assert p['map_asset_id'].endswith('_atlas_v3'),key
        a=json.loads((ROOT/f'ui/maps/{p["map_asset_id"]}.json').read_text());s=load_preset(p)
        geoms=[];primary=[]
        for r in a['regions']:
            cells=[Polygon(q[0],q[1:]).buffer(0) for q in r['polygons']]
            assert cells and all(c.is_valid and c.area>0 for c in cells),(key,r['name'],'geometry')
            geoms.append(unary_union(cells))
            anchor=Point(r['center'])
            primary.append(next((c for c in cells if c.buffer(1e-6).covers(anchor)),max(cells,key=lambda c:c.area)))
            assert geoms[-1].buffer(1e-6).covers(anchor),(key,r['name'],'marker off territory')
        for pair,kind in s.routes.items():
            i,j=map(int,pair.split(':'))
            if kind!='sea':
                assert primary[i].distance(primary[j])<=1e-5,(key,p['regions'][i][0],p['regions'][j][0],'detached pieces create land route')
            count+=1
        assert max(len(r.neighbors) for r in s.regions.values())<=7,(key,'over-connected hub')
        for player in s.players:
            owned={r.id for r in s.owned_regions(player.id)};seen={player.capital_region_id};todo=list(seen)
            while todo:
                for n in s.regions[todo.pop()].neighbors:
                    if n in owned and n not in seen:seen.add(n);todo.append(n)
            assert seen==owned,(key,'disconnected starting kingdom')
        if key=='antietam_1862':
            creek=LineString(a['rivers'][0]['points'])
            for name in ['Upper bridge approach','Middle bridge approach','Burnside Bridge']:
                r=next(r for r in a['regions'] if r['name']==name)
                assert creek.distance(Point(r['center']))<.025,(name,'bridge detached from creek')
        if key=='troy_troad':
            assert a['terrain']['coastline_mask']
            assert any(g.covers(Point(.6,.27)) for g in geoms),'DEM void stripe erased inland Troy'
    # Every pre-review preset still loads its original map and replay geometry.
    for source in ['compact.json','expansion.json']:
        for key,p in json.loads((ROOT/'engine/presets'/source).read_text()).items():
            e=GameEngine(load_preset(p));before=snapshot(e.state);e.state.turn=2
            e.history=[dict(turn=1,replay_before=before)]
            restored=_decode(_encode(e));a=json.loads((ROOT/f'ui/maps/{restored.state.map_asset_id}.json').read_text())
            assert [r.name for r in restored.state.regions.values()]==[r['name'] for r in a['regions']]
            assert [s.turn for s in campaign_states(restored)]==[1,2]
            assert restored.state.routes==e.state.routes
    print(f'{len(PRESETS)} reviewed maps; {count} routes; all pre-review saves/replays passed.')

if __name__=='__main__':check()
