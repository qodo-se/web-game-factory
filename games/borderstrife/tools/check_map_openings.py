"""Reproducible AI-vs-AI smoke playtests; not a claim of human win-rate balance."""
import json
from pathlib import Path
from games.borderstrife.engine.presets import PRESETS
from games.borderstrife.engine.presets.loader import load_preset
from games.borderstrife.engine.ai import decide_actions
from games.borderstrife.engine.turn_resolver import resolve_turn
from games.borderstrife.engine.strategy import growth, supplied_regions


def check():
    rows=[]
    for key,preset in PRESETS.items():
        start=load_preset(preset)
        power=[sum(r.army for r in start.owned_regions(p.id)) for p in start.players]
        recruitment=[sum(growth(r,supplied_regions(start)) for r in start.owned_regions(p.id)) for p in start.players]
        results={'player_1':0,'player_2':0,'unfinished':0}
        turns=[]
        for seed in range(8):
            state=load_preset(preset)
            for turn in range(20 if 'battle' in preset else 60):
                resolve_turn(state,decide_actions(state,'player_1',seed=seed*997+turn*2),decide_actions(state,'player_2',seed=seed*997+turn*2+1),seed=seed*997+turn)
                assert all(r.army>=0 for r in state.regions.values()),key
                if state.game_over:break
            if 'battle' in preset:assert state.game_over,(key,'battle failed turn cap')
            results[state.winner if state.game_over else 'unfinished']+=1;turns.append(state.turn)
        row=dict(id=key,initial_armies=power,initial_growth=recruitment,ai_runs=8,results=results,turns=turns)
        rows.append(row);print(key,power,results,flush=True)
    Path('games/borderstrife/tools/opening-playtest-report.json').write_text(json.dumps(rows,indent=2)+'\n')

if __name__=='__main__':check()
