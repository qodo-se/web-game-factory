// Run against a local preview with a disposable 350+ turn campaign ID.
// IMPERIUM_TEST_URL=http://127.0.0.1:3000 IMPERIUM_TEST_GAME=<id> node .../check_long_campaign.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://127.0.0.1:3000';
const id=process.env.IMPERIUM_TEST_GAME;
if(!id)throw Error('Provide a disposable long campaign via IMPERIUM_TEST_GAME');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let serverTiming='';
  page.on('response',r=>{if(r.url().endsWith('/turn'))serverTiming=r.headers()['server-timing']||''});
  await page.goto(base);
  await page.evaluate(id=>sessionStorage.setItem('gameId',id),id);
  await page.goto(`${base}/game.html`);
  await page.waitForFunction(()=>typeof state!=='undefined'&&state&&atlas.geometry);
  const stats=await page.evaluate(async()=>{
   const startTurn=state.turn;
   const original=api.getValidMoves;let extraRequests=0;
   api.getValidMoves=(...args)=>{extraRequests++;return original(...args)};
   const start=performance.now();await endTurn();
   const actualTurnMs=performance.now()-start;
   api.getValidMoves=original;
   const stats={startTurn,endTurn:state.turn,extraRequests,actualTurnMs,history:campaignHistory.length,historyMore};
   const events=Object.keys(state.regions).slice(0,8).map(to=>({type:'battle',to:+to,owner:state.regions[to].owner==='player_1'?'player_2':'player_1',won:true,army:20,attacker_losses:10,defender_losses:10}));
   const originalPaint=atlas.paintBase;let paints=0;
   atlas.paintBase=function(...args){paints++;return originalPaint.apply(this,args)};
   const before=JSON.stringify(state);
   for(const speed of ['normal','fast','instant']){
    state=JSON.parse(before);renderMap();paints=0;presentation.speed=speed;
    const start=performance.now();await presentation.replay({events});
    stats[speed]={ms:performance.now()-start,paints};
   }
   atlas.paintBase=originalPaint;state=JSON.parse(before);renderMap();
   const select=document.getElementById('turn-speed');select.value='instant';select.dispatchEvent(new Event('change'));
   return stats;
  });
  assert.match(serverTiming,/load;dur=.*resolve;dur=.*save;dur=/);
  stats.serverTiming=serverTiming;
  assert.ok(stats.startTurn>300);assert.equal(stats.endTurn,stats.startTurn+1);
  assert.equal(stats.extraRequests,0);assert.equal(stats.history,21);assert.equal(stats.historyMore,true);
  assert.equal(stats.fast.paints,1);assert.equal(stats.instant.paints,0);
  assert.ok(stats.fast.ms<stats.normal.ms/2);assert.ok(stats.instant.ms<100);
  await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state&&atlas.geometry);
  assert.equal(await page.evaluate(()=>presentation.speed),'instant');
  assert.deepEqual(errors,[]);console.log(JSON.stringify(stats,null,2));
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
