const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
const base=process.env.IMPERIUM_TEST_API||'http://127.0.0.1:8080';
const fixture=JSON.parse(execFileSync(path.join(root,'.venv/bin/python'),['-c',`
import json
from dataclasses import asdict
from games.borderstrife.api import store
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import Owner,Move,TurnActions
from games.borderstrife.engine.replay import snapshot
engine=GameEngine.from_preset('india',player2_is_ai=False)
seat=engine.state.players[0].capital_region_id
target=engine.state.regions[seat].neighbors[0]
for region in engine.state.regions.values():
    region.owner=Owner.PLAYER_1
    region.army=500
engine.state.regions[seat].army=10000
engine.state.regions[target].owner=Owner.PLAYER_2
engine.state.regions[target].army=1
start=snapshot(engine.state)
for turn in range(1,4):
    before=snapshot(engine.state)
    engine.submit_actions('player_1',TurnActions('player_1',[Move(seat,target)] if turn==3 else []))
    engine.submit_actions('player_2',TurnActions('player_2',[]))
    report=engine.resolve_turn(seed=10)
    engine.history.append({**asdict(report),'replay_before':before})
assert engine.state.game_over
normal=store.create(engine)
for entry in engine.history: entry.pop('replay_before')
legacy=store.create(engine)
engine.history=[{'turn':3,'combat_results':[]}]
partial=store.create(engine)
print(json.dumps(dict(normal=normal,legacy=legacy,partial=partial,start=start,target=target)))
`],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const writes=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/games/'))writes.push(r.url())});
  await page.addInitScript(base=>localStorage.setItem('IMPERIUM_API_BASE',base),base);
  await page.goto(ui+'/maps/india.json');
  const load=async id=>{
   await page.evaluate(id=>{sessionStorage.setItem('gameId',id);sessionStorage.setItem('presetId','india')},id);
   await page.goto(ui+'/game.html');await page.waitForFunction(()=>typeof state!=='undefined'&&state?.game_over&&gameOver);
  };
  await load(fixture.normal);
  const saved=await page.evaluate(()=>api.getGame(gameId));
  await page.click('#replay-campaign');
  await page.waitForFunction(()=>campaignReplay.active&&campaignReplay.frames.length===4);
  assert.equal(await page.locator('#campaign-replay-caption').textContent(),'Starting position · 1/4');
  assert.equal(await page.locator('.replay-arrow').count(),0);
  const regions=await page.evaluate(()=>Object.fromEntries(Object.values(state.regions).map(r=>[r.id,[r.owner,r.army]])));
  assert.deepEqual(regions,fixture.start.regions);
  assert.equal(await page.locator('#end-turn-btn').isDisabled(),true);
  assert.equal(await page.locator('#show-threats').isDisabled(),true);
  await page.evaluate(()=>handleRegionClick(state.player_1.capital));
  assert.equal(await page.evaluate(()=>pendingMoves.length),0);
  await page.locator('#map-container').focus();
  const camera=await page.evaluate(()=>({x:mapCamera.x,y:mapCamera.y}));
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>campaignReplay.index),0);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>campaignReplay.index),1);
  assert.deepEqual(await page.evaluate(()=>({x:mapCamera.x,y:mapCamera.y})),camera);
  await page.locator('#campaign-replay-slider').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>campaignReplay.index),2);
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>campaignReplay.index),3);
  await page.evaluate(()=>campaignReplay.play());
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>campaignReplay.playing),false);
  assert.equal(await page.evaluate(()=>campaignReplay.index),1);
  await page.keyboard.press('ArrowLeft');
  await page.click('#campaign-replay-next');
  assert.match(await page.locator('#campaign-replay-caption').textContent(),/After turn 1/);
  await page.click('#campaign-replay-prev');
  assert.equal(await page.locator('#campaign-replay-prev').isDisabled(),true);
  await page.locator('#campaign-replay-slider').fill('3');
  await page.waitForFunction(()=>campaignReplay.index===3);
  assert.equal(await page.evaluate(id=>state.regions[id].owner,fixture.target),'player_1');
  assert.equal(await page.locator('.replay-arrow').count(),1);
  assert.equal(await page.locator('.replay-arrow').getAttribute('data-to'),String(fixture.target));
  assert.match(await page.locator('.replay-arrow title').textContent(),/troops/);
  assert.equal(await page.locator('.replay-arrow .order-hit').count(),0);
  const arrowHit=await page.locator('.replay-arrow path').first().evaluate(path=>{
   const p=path.getPointAtLength(path.getTotalLength()/2);
   const screen=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());
   return !!document.elementFromPoint(screen.x,screen.y)?.closest('.replay-arrow');
  });
  assert.equal(arrowHit,true);
  await page.locator('.replay-arrow').focus();
  assert.match(await page.locator('.replay-arrow').getAttribute('aria-label'),/troops/);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('.replay-arrow').count(),0);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.replay-arrow').count(),1);
  await page.click('#campaign-replay-play');
  await page.waitForFunction(()=>campaignReplay.index===1);
  await page.click('#campaign-replay-play');
  const paused=await page.evaluate(()=>campaignReplay.index);await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(()=>campaignReplay.index),paused);
  await page.click('#campaign-replay-play');await page.waitForFunction(()=>campaignReplay.index===3&&!campaignReplay.playing);
  await page.screenshot({path:'/tmp/imperium-campaign-replay.png'});
  await page.setViewportSize({width:390,height:844});
  const replayLayout=await page.locator('#campaign-replay-controls').evaluate(el=>{
   const box=el.getBoundingClientRect(),map=el.parentElement.getBoundingClientRect();
   return {fits:box.left>=map.left&&box.right<=map.right&&box.top>=map.top&&box.bottom<=map.bottom};
  });
  assert.equal(replayLayout.fits,true);
  await page.screenshot({path:'/tmp/imperium-replay-mobile.png'});
  await page.setViewportSize({width:1500,height:1000});
  await page.click('#campaign-replay-exit');assert.equal(await page.locator('#campaign-replay-controls').isVisible(),false);
  assert.equal(await page.locator('.replay-arrow').count(),0);
  assert.equal(await page.evaluate(()=>state.turn),4);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>state.turn),4);
  assert.deepEqual(await page.evaluate(()=>api.getGame(gameId)),saved);
  await page.evaluate(()=>sidebar.open('settings'));await page.click('#open-campaign-replay');
  await page.waitForFunction(()=>campaignReplay.active);await page.reload();
  await page.waitForFunction(()=>typeof state!=='undefined'&&state?.game_over);
  assert.equal(await page.evaluate(()=>state.turn),4);
  await load(fixture.legacy);await page.click('#replay-campaign');
  await page.waitForFunction(()=>campaignReplay.active);
  assert.equal(await page.evaluate(()=>campaignReplay.frames.length),4);
  assert.equal(await page.evaluate(()=>campaignReplay.complete),true);
  await load(fixture.partial);await page.click('#replay-campaign');
  await page.waitForFunction(()=>campaignReplay.active);
  assert.match(await page.locator('#campaign-replay-note').textContent(),/incomplete/);
  assert.equal(await page.locator('#campaign-replay-play').isDisabled(),true);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('Post-game entry, exact starting armies, previous/next/scrub/play/pause/end, read-only saves, exit/re-entry/reload, legacy reconstruction and incomplete-history states passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
