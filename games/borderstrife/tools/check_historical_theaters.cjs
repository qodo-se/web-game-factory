// Run only against a disposable local database, never the user's campaigns.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://127.0.0.1:3001';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local preview required');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const catalog=(await page.evaluate(()=>api.getPresets())).filter(p=>p.category==='historical');
  assert.equal(catalog.length,5);
  for(const [index,preset] of catalog.entries()) {
   await page.setViewportSize(index===catalog.length-1?{width:390,height:844}:{width:1440,height:1000});
   await page.goto(base);await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
   assert.equal(await page.locator('.map-card').count(),16);
   await page.locator(`input[value="${preset.id}"]`).check();
   await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
   if(index===catalog.length-1)await page.locator('#continue-setup').click();
   assert.equal(await page.locator('#selected-map-title').textContent(),preset.name);
   assert.match(await page.locator('#map-briefing').textContent(),/not historical deployments/);
   await page.locator('#start-btn').click();await page.waitForURL('**/game.html');
   await page.locator('#load-screen').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>atlas.data.id),preset.map_asset_id);
   assert.deepEqual(await page.evaluate(()=>atlas.markers.filter(m=>atlas.hit(m.x/atlas.geometry.w,m.y/atlas.geometry.h)!==m.id).map(m=>m.id)),[]);
   await page.screenshot({path:`/tmp/historical-${preset.id}.png`});
   await page.locator('#end-turn-btn').click();await page.waitForFunction(()=>state.turn===2&&!resolving);
   await page.reload();await page.locator('#load-screen').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>state.turn),2);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   console.log(preset.id,'gallery / briefing / create / render / hit / turn / reload passed');
  }
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
