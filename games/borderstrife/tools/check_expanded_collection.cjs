// Local browser integration: every expansion map renders and survives a turn/reload.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://127.0.0.1:3013';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local preview required.');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)missing.push([r.status(),r.url()]);});
  await page.goto(base);
  await page.locator('#start-btn').waitFor({state:'visible'});
  const catalog=await page.evaluate(()=>api.getPresets());
  assert.equal(catalog.length,35);
  const counts={world:14,historical:10,campaigns:4,sieges:3,legends:4};
  for(const [category,count] of Object.entries(counts)){
   await page.locator(`[data-category="${category}"]`).click();
   await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
   assert.equal(await page.locator('.map-card').count(),count);
   if(category!=='world')assert.equal(await page.locator('#battle-briefing').isVisible(),true);
  }
  await page.locator('[data-category="historical"]').click();
  await page.locator('[data-category="legends"]').click();
  await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  assert.equal(await page.locator('#start-btn').textContent(),'Begin Campaign');
  assert.ok(!(await page.locator('#battle-briefing').textContent()).includes('20 turns'));
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`/tmp/borderstrife-collections-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  for(const preset of catalog.filter(p=>!['mediterranean','europe','americas','africa_middle_east','central_asia','india','southeast_asia_oceania','balochistan_borderlands_expanded','waterloo','sekigahara','hastings','hattin','gettysburg'].includes(p.id))){
   const result=await page.evaluate(id=>api.newGame({mode:'preset',preset_id:id}),preset.id);
   await page.evaluate(result=>{sessionStorage.setItem('gameId',result.game_id);sessionStorage.setItem('presetId',result.state.preset_id);sessionStorage.setItem('mapAssetId',result.state.map_asset_id);},result);
   await page.goto(base+'/game.html');
   await page.locator('#load-screen').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>Object.keys(state.regions).length),24,preset.id);
   assert.equal(await page.evaluate(()=>atlas.data.id),preset.map_asset_id);
   assert.equal(await page.evaluate(()=>!!state.battle),preset.category==='historical');
   assert.ok(await page.evaluate(()=>Object.values(state.regions).every(r=>r.neighbors.length)));
   await page.screenshot({path:`/tmp/collection-${preset.id}.png`});
   await page.locator('#end-turn-btn').click();
   await page.waitForFunction(()=>state.turn===2&&!resolving);
   await page.reload();await page.locator('#load-screen').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>state.turn),2);
   if(preset.id==='emberfall'){
    assert.ok(!(await page.locator('#battle-terrain-description').textContent()).includes('undefined'));
    assert.ok(!(await page.locator('#battle-terrain-description').textContent()).includes(' m ·'));
    await page.locator('#sidebar-settings-toggle').click();
    await page.locator('#map-theme').selectOption('dark');
    await page.screenshot({path:'/tmp/collection-emberfall-dark.png'});
   }
   console.log(preset.id,'render / turn / reload passed');
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(missing,[]);
  console.log('All 22 new maps and five categories passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
