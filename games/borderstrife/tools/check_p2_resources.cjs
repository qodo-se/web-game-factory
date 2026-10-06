const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
const fixture=JSON.parse(execFileSync(path.join(root,'.venv/bin/python'),['-c',`
import json
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.api.routes import _serialize_state
engine=GameEngine.from_preset('india')
engine.state.turn=2001
print(json.dumps(dict(game_id='resource-fixture',state=_serialize_state(engine),valid_moves=engine.get_valid_moves('player_1'),history=[dict(turn=i,events=[],combat_results=[],movements=[]) for i in range(1981,2001)],history_more=True)))
`],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
(async()=>{
 const browser=await chromium.launch();
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let reads=0,fail=false;
 await page.route('**/api/imperium/games/resource-fixture*',route=>{
  reads++;return route.fulfill(fail?{status:404,json:{detail:'Game not found or expired.'}}:{json:fixture});
 });
 await page.goto(ui);
 await page.evaluate(f=>{campaigns.remember(f.game_id,f.state);campaigns.render();},fixture);
 await page.click('#resume-game-tab');await page.locator('.saved-campaign').first().click();
 await page.waitForFunction(()=>typeof state!=='undefined'&&!!state&&!document.getElementById('main').inert,{},{timeout:10000}).catch(async e=>{throw Error((await page.locator('#load-message').textContent())+' '+errors.join('; '))});
 assert.equal(reads,1);
 const result=await page.evaluate(async()=>{
  const check=(ok,msg)=>{if(!ok)throw Error(msg)};
  api.getHistory=async(id,before)=>({history:Array.from({length:Math.min(50,before-1)},(_,i)=>({turn:Math.max(1,before-50)+i,events:[]})),more:before>51});
  state.draw_offers=[{turn:30,accepted:false,message:'<unsafe>'},{turn:2501,accepted:false,message:'Current offer'}];
  for(let turn=2001;turn<=2500;turn++){appendCampaignReport({turn,events:[]});state.turn=turn+1;}
  renderTimeline();check(campaignHistory.length===100,'Live history unbounded');
  const row=document.querySelector('[data-key="2500:turn"]');renderTimeline();check(row===document.querySelector('[data-key="2500:turn"]'),'Existing row replaced');
  const seen=new Set(campaignHistory.map(e=>e.turn));
  while(historyMore){await loadOlderHistory();for(const e of campaignHistory)seen.add(e.turn);check(campaignHistory.length<=100,'Paged history unbounded');check(document.getElementById('timeline-list').children.length<=122,'Timeline DOM unbounded');}
  check(seen.size===2500,'Missing older turns');check(historyBrowsingOlder,'Missing latest navigation');
  check(document.getElementById('timeline-list').textContent.includes('<unsafe>'),'Draw text missing');
  check(!document.querySelector('#timeline-list unsafe'),'Unsafe markup');
  await loadOlderHistory(true);check(!historyBrowsingOlder,'Latest navigation failed');check(campaignHistory.at(-1).turn===2500,'Latest report missing');
  check(document.getElementById('timeline-list').textContent.includes('Current offer'),'Current draw hidden');
  await loadOlderHistory();await loadOlderHistory();
  appendCampaignReport({turn:2501,events:[]});state.turn=2502;renderTimeline();check(!historyBrowsingOlder&&campaignHistory.length===1,'Turn while browsing history');
  await loadOlderHistory();check(campaignHistory.at(-2).turn===2500,'Gap after turn while browsing');
  const history=JSON.stringify(campaignHistory);let finish;
  api.getHistory=()=>new Promise(resolve=>{finish=resolve});
  const request=loadOlderHistory();state.turn++;finish({history:[{turn:1}],more:false});await request;
  check(JSON.stringify(campaignHistory)===history,'Stale history response applied');
  api.getHistory=async()=>{throw Error('Network unavailable')};await loadOlderHistory();check(!historyLoading,'Failure leaves loading locked');
  historyBrowsingOlder=true;state.draw_available_turn=30;
  api.offerDraw=async()=>({state:{...state,draw_offers:[{turn:state.turn,accepted:false,message:'Declined test offer'}]}});
  await drawOffers.offer();
  check(!historyBrowsingOlder&&document.getElementById('timeline-list').textContent.includes('Declined test offer'),'Offer response hidden after browsing old turns');
  historyBrowsingOlder=true;window.confirm=()=>true;
  api.resign=async()=>({state:{...state,game_over:true,winner:'player_2',resigned:true}});
  await drawOffers.offer(true);
  check(document.getElementById('timeline-list').textContent.includes('Resigned'),'Resignation hidden after browsing old turns');
  return {seen:seen.size,retained:campaignHistory.length,nodes:document.getElementById('timeline-list').children.length};
 });
 // An expired save now reaches the game screen's existing error/retry flow.
 fail=true;await page.reload();await page.locator('#retry-game').waitFor({state:'visible'});
 assert.match(await page.locator('#load-message').textContent(),/expired/);
 fail=false;await page.click('#retry-game');await page.waitForFunction(()=>typeof state!=='undefined'&&!!state&&!document.getElementById('main').inert);
 assert.deepEqual(errors,[]);console.log('PASS: one resume fetch, bounded 2,500-turn history, incremental rows, all older turns, draw text, latest navigation, new-turn and request races, error/retry',result);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
