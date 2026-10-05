// Existing random campaigns remain supported, but cannot be created through the
// public API. Exercise their renderer with a deterministic saved-state fixture.
const {execFileSync}=require('node:child_process');
const path=require('node:path');
module.exports=async page=>{
    const root=path.resolve(__dirname,'../../..');
    const fixture=JSON.parse(execFileSync(process.env.PYTHON||path.join(root,'.venv/bin/python'),['-c',`
import json
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import MapSize
from games.borderstrife.api.routes import _serialize_state
engine=GameEngine.new_game(map_size=MapSize.SMALL, seed=42)
print(json.dumps(dict(game_id='legacy-random',state=_serialize_state(engine),history=[],valid_moves=engine.get_valid_moves('player_1'))))
`],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
    await page.route('**/api/imperium/games/legacy-random{,/**}',route=>route.fulfill({json:
        route.request().url().endsWith('/valid-moves')?fixture.valid_moves:fixture}));
    await page.evaluate(()=>{sessionStorage.setItem('gameId','legacy-random');sessionStorage.removeItem('presetId');});
};
