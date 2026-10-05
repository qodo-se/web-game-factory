// All 35 maps: browser rendering, hit targets, turn/reload, fit/reset and mobile.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.IMPERIUM_TEST_URL||'http://127.0.0.1:3013';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local preview required');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[],missing=[],timings=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push([r.status(),r.url()]);});
  await page.goto(base);await page.locator('#start-btn').waitFor();
  assert.equal(await page.locator('[data-category="legends"]').textContent(),'Epics');
  const catalog=await page.evaluate(()=>api.getPresets());assert.equal(catalog.length,35);
  for(const p of catalog){
   const created=await page.evaluate(id=>api.newGame({mode:'preset',preset_id:id}),p.id);
   await page.evaluate(r=>{sessionStorage.setItem('gameId',r.game_id);sessionStorage.setItem('presetId',r.state.preset_id);sessionStorage.setItem('mapAssetId',r.state.map_asset_id);},created);
   await page.goto(base+'/game.html');await page.locator('#load-screen').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>atlas.data.id),p.id+'_atlas_v3');
   assert.deepEqual(await page.evaluate(()=>atlas.markers.filter(m=>atlas.hit(m.x/atlas.geometry.w,m.y/atlas.geometry.h)!==m.id).map(m=>m.id)),[],p.id+' marker hit targets');
   await page.screenshot({path:'/tmp/reviewed-'+p.id+'.png'});
   await page.locator('#map-fit-regions').click();assert.ok(await page.evaluate(()=>mapCamera.zoom>=1&&mapCamera.zoom<=2.5));
   await page.locator('#map-reset').click();assert.equal(await page.evaluate(()=>mapCamera.zoom),1);
   const ms=await page.evaluate(()=>{const before=performance.now();for(let i=0;i<10;i++)renderMap();return (performance.now()-before)/10;});timings.push({id:p.id,cachedRenderMs:Math.round(ms*10)/10});
   await page.locator('#end-turn-btn').click();await page.waitForFunction(()=>state.turn===2&&!resolving);
   await page.reload();await page.locator('#load-screen').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>state.turn),2);
   if(['india','malta','troy_troad','emberfall'].includes(p.id)){
    await page.locator('#sidebar-settings-toggle').click();await page.locator('#map-theme').selectOption('dark');
    await page.screenshot({path:'/tmp/reviewed-'+p.id+'-dark.png'});
    await page.locator('#map-theme').selectOption('light');
    await page.setViewportSize({width:320,height:900});
    await page.waitForFunction(()=>atlas.geometry.w===document.getElementById('map-canvas').clientWidth);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const box=await page.locator('.map-navigation').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=321,p.id+' mobile controls');
    await page.screenshot({path:'/tmp/reviewed-'+p.id+'-mobile.png'});
    await page.setViewportSize({width:1440,height:1000});
   }
   console.log(p.id,'render / hit targets / fit / turn / reload passed');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync('/tmp/reviewed-render-timings.json',JSON.stringify(timings,null,2));
  console.log('All 35 reviewed maps passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
