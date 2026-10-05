const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const base=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
const legacy=JSON.parse(execFileSync(path.join(root,'.venv/bin/python'),['-c',`
import json
from games.imperium.engine.presets import SOURCE_PRESETS
from games.imperium.engine.presets.loader import load_preset
from games.imperium.engine.game_engine import GameEngine
from games.imperium.engine.replay import snapshot
from games.imperium.api import store
result=[]
for key in ['india','balochistan_borderlands_expanded','waterloo']:
 e=GameEngine(load_preset(SOURCE_PRESETS[key]));before=snapshot(e.state)
 e.state.turn=2;e.state.game_over=True;e.state.winner='player_1'
 e.history=[dict(turn=1,replay_before=before,combat_results=[])]
 result.append(dict(id=store.create(e),map=key,count=len(e.state.regions)))
print(json.dumps(result))
`],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const catalog=await page.evaluate(()=>api.getPresets());
  for(const preset of catalog.filter(p=>p.category==='world')) {
   assert.ok(preset.region_count>=24&&preset.region_count<=30);
   const result=await page.evaluate(id=>api.newGame({mode:'preset',preset_id:id}),preset.id);
   await page.evaluate(result=>{sessionStorage.setItem('gameId',result.game_id);sessionStorage.setItem('presetId',result.state.preset_id);sessionStorage.setItem('mapAssetId',result.state.map_asset_id);},result);
   await page.goto(base+'/game.html');await page.locator('#load-screen').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>atlas.data.id),preset.map_asset_id);
   assert.ok(await page.evaluate(()=>Object.values(state.regions).every(r=>r.neighbors.length>0)));
   await page.screenshot({path:`/tmp/compact-${preset.id}.png`});
  }
  for(const fixture of legacy) {
   await page.evaluate(f=>{sessionStorage.setItem('gameId',f.id);sessionStorage.setItem('presetId',f.map);sessionStorage.removeItem('mapAssetId');},fixture);
   await page.goto(base+'/game.html');await page.locator('#load-screen').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>atlas.data.id),fixture.map);
   assert.equal(await page.evaluate(()=>Object.keys(state.regions).length),fixture.count);
   await page.click('#replay-campaign');await page.waitForFunction(()=>campaignReplay.active);
   assert.equal(await page.evaluate(()=>campaignReplay.frames.length),2);
   await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>campaignReplay.index),1);
  }
  assert.deepEqual(errors,[]);
  console.log('All eight compact regional maps render; original regional and historical saves and replays remain compatible.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
