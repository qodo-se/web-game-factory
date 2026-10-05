const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const base=process.env.IMPERIUM_TEST_URL||'http://127.0.0.1:3000';
const id=execFileSync(path.join(root,'.venv/bin/python'),['-c',`
from games.borderstrife.api import store
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.replay import snapshot
engine=GameEngine.from_preset('india')
for turn in range(1,121):
 engine.state.turn=turn
 engine.state.regions[0].army=turn
 engine.history.append({'turn':turn,'events':[],'combat_results':[],'replay_before':snapshot(engine.state)})
engine.state.turn=121
engine.state.game_over=True
engine.state.winner='player_1'
print(store.create(engine))
`],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'}).trim();
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.evaluate(id=>sessionStorage.setItem('gameId',id),id);
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto(`${base}/game.html`);await page.waitForFunction(()=>typeof state!=='undefined'&&state&&atlas.geometry);
 assert.equal(await page.evaluate(()=>campaignHistory.length),20);
 assert.ok(!requests.some(url=>url.includes('valid-moves')));
 await page.evaluate(()=>loadOlderHistory());assert.equal(await page.evaluate(()=>campaignHistory.length),70);
 await page.evaluate(()=>campaignReplay.enter());
 assert.equal(await page.evaluate(()=>campaignReplay.frames.filter(Boolean).length),50);
 for(const index of [49,50,99,100,120,0]) {
  await page.evaluate(index=>campaignReplay.show(index),index);
  const result=await page.evaluate(()=>({turn:state.turn,index:campaignReplay.index,army:state.regions[0].army}));
  assert.equal(result.index,index);assert.equal(result.turn,index+1);
  if(index<120)assert.equal(result.army,index+1);
 }
 await page.evaluate(()=>campaignReplay.exit());
 const threats=await page.evaluate(async()=>{
  document.getElementById('show-threats').checked=true;threatView.data=null;threatView.key='';
  const original=api.threats;let calls=0,aborts=0;
  api.threats=(id,orders,signal)=>new Promise((resolve,reject)=>{
   calls++;const timer=setTimeout(()=>resolve({turn:state.turn,entries:[]}),250);
   signal.addEventListener('abort',()=>{aborts++;clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))});
  });
  for(let i=0;i<10;i++)threatView.refresh();
  await new Promise(r=>setTimeout(r,180));const identical=calls;
  pendingMoves=[{from_region_id:0,to_region_id:1}];threatView.refresh();
  await new Promise(r=>setTimeout(r,450));
  const data=!!threatView.data;api.threats=original;return {identical,calls,aborts,data};
 });
 assert.deepEqual(threats,{identical:1,calls:2,aborts:1,data:true});
 assert.deepEqual(errors,[]);console.log('Recent history, older reports, replay page boundaries, indexed frames, request deduplication and cancellation passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
