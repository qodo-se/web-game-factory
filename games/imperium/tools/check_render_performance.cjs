// Live browser checks for cache correctness and a repeatable rendering benchmark.
// NODE_PATH=<playwright installation>/node_modules node games/imperium/tools/check_render_performance.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
const base=process.env.IMPERIUM_TEST_API||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(base=>localStorage.setItem('IMPERIUM_API_BASE',base),base);
  await page.goto(ui);
  for(const preset of ['india','europe','southeast_asia_oceania']) {
   const result=await page.evaluate(async preset=>{
    const result=await api.newGame(preset?{mode:'preset',preset_id:preset}:{mode:'random',map_size:'large'});
    sessionStorage.setItem('gameId',result.game_id);sessionStorage.setItem('presetId',preset||'');
    return result;
   },preset);
   await page.goto(`${ui}/game.html`);
   await page.waitForFunction(()=>typeof state!=='undefined'&&state&&document.querySelector('#g-labels [data-id]'));
   const stats=await page.evaluate(async()=>{
    const geometry=atlas.geometry, initialCache=randomTerrainCache;
    const originalPaint=atlas.paintBase;let paints=0;
    atlas.paintBase=function(...args){paints++;return originalPaint.apply(this,args)};
    const capital=state.player_1.capital;
    const start=performance.now();
    for(let i=0;i<30;i++) {
     selectedFrom=i%2?capital:null;renderMap();
     await new Promise(requestAnimationFrame);
    }
    const perFrame=(performance.now()-start)/30;
    const noGeometryRebuild=atlas.data?geometry===atlas.geometry:initialCache===randomTerrainCache;
    const noTerrainRepaint=paints===0;
    const canvas=document.getElementById('map-canvas');
    const pixelCount=canvas.width*canvas.height;
    // Fresh server snapshots need the same repelled counter positions.
    const coordinates=Object.values(state.regions).map(r=>[r.x,r.y]);
    state=JSON.parse(JSON.stringify(state));renderMap();
    const sameCoordinates=JSON.stringify(coordinates)===JSON.stringify(Object.values(state.regions).map(r=>[r.x,r.y]));
    // Ownership changes must invalidate the bitmap; army growth must not.
    state.regions[capital].army++;renderMap();
    const growthReused=atlas.data?paints===0:randomTerrainCache===initialCache;
    state.regions[capital].owner='rogue';renderMap();
    const ownershipRepaint=atlas.data?paints===1:randomTerrainCache!==initialCache;
    atlas.paintBase=originalPaint;
    return {perFrame,noGeometryRebuild,noTerrainRepaint,pixelCount,sameCoordinates,growthReused,ownershipRepaint,
     masks:document.querySelectorAll('#g-atmosphere mask').length};
   });
   assert.equal(stats.noGeometryRebuild,true);
   assert.equal(stats.noTerrainRepaint,true);
   assert.equal(stats.sameCoordinates,true);
   assert.equal(stats.growthReused,true);
   assert.equal(stats.ownershipRepaint,true);
   assert.equal(stats.masks,0);
   assert.ok(stats.pixelCount<4010000);
   console.log(preset||'random',stats);
   // The next iteration uses api.newGame from the loaded game page.
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
