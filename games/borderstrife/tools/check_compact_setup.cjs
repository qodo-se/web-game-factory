// Local setup UX checks, including real submissions and recovery from errors.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://127.0.0.1:3000';
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[1024,600],[375,667],[390,844],[320,568]]) {
  await page.setViewportSize({width,height});await page.goto(base);await ready();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const geometry=await page.evaluate(()=>{
   const card=document.querySelector('.welcome-card').getBoundingClientRect(),gallery=document.getElementById('map-grid').getBoundingClientRect();
   return {top:card.top,left:card.left,width:card.width,height:card.height,galleryHeight:gallery.height,count:document.querySelectorAll('.map-card').length};
  });
  assert.equal(geometry.top,0);assert.equal(geometry.left,0);
  assert.equal(geometry.width,width);assert.equal(geometry.height,height);
  assert.ok(geometry.galleryHeight>100);assert.equal(geometry.count,16);
  assert.equal(await page.locator('[data-category],.map-categories,#maps-next,#maps-prev').count(),0);
  await page.locator('.map-card input').last().scrollIntoViewIfNeeded();
  const choice=await page.locator('.map-card input').first().inputValue();await page.locator('.map-card input').first().check();await ready();
  if(width<=760)await page.locator('#continue-setup').click();
  const button=await page.locator('#start-btn').boundingBox();assert.ok(button.y+button.height<=height,`Begin stays visible at ${width}`);

  await page.locator('#resume-game-tab').click();assert.ok(await page.locator('#new-game-form').isHidden());
  assert.ok(await page.locator('#saved-campaigns').isVisible());
  await page.locator('#new-game-tab').click();assert.ok(await page.locator('#start-btn').isVisible());
  if(width<=760){await page.locator('#back-to-maps').click();assert.equal(await page.locator('.map-card input:checked').inputValue(),choice);}
 }
 // Expanded setup stays inside its own scroll area; Begin never covers fields.
 for(const [width,height] of [[1440,900],[1280,720],[1024,600],[390,844]]) {
  await page.setViewportSize({width,height});await page.goto(base);await ready();
  await page.locator('input[value="greco_persian"]').check();await ready();
  if(width<=760)await page.click('#continue-setup');
  await page.locator('#map-details > summary').click();
  await page.locator('#map-briefing summary').click();
  await page.locator('#customize-names > summary').click();
  await page.locator('#campaign-name').scrollIntoViewIfNeeded();
  await page.locator('#campaign-name').click();
  await page.fill('#campaign-name','Expanded setup regression');
  const boxes=await page.evaluate(()=>{
   const panel=document.getElementById('preset-options'),input=document.getElementById('campaign-name');
   return {panel:panel.getBoundingClientRect().toJSON(),input:input.getBoundingClientRect().toJSON(),footer:document.querySelector('.setup-actions').getBoundingClientRect().toJSON(),scroll:scrollY,scrollable:panel.scrollHeight>panel.clientHeight};
  });
  assert.equal(boxes.scroll,0);assert.ok(boxes.scrollable);
  assert.ok(boxes.panel.bottom<=boxes.footer.top+.5);
  assert.ok(boxes.input.top>=boxes.panel.top&&boxes.input.bottom<=boxes.panel.bottom);
  assert.ok(await page.locator('#start-btn').isVisible());
 }
 // Simulate a website-first rollout against a catalog containing retired maps.
 await page.route('**/api/imperium/presets',async route=>{
  const response=await route.fetch(),current=await response.json();
  const retired=['andes_pacific','caribbean_central_america','nile_horn','napoleon_1805','waterloo'];
  await route.fulfill({json:[...current,...retired.map(id=>({id,name:id,category:id==='waterloo'?'historical':'world',region_count:24,map_asset_id:id+'_atlas_v4'}))]});
 });
 await page.goto(base);await ready();
 assert.equal(await page.locator('.map-card').count(),16);
 assert.equal(await page.locator('input[value="andes_pacific"],input[value="caribbean_central_america"],input[value="nile_horn"],input[value="napoleon_1805"],input[value="waterloo"]').count(),0);
 await page.unroute('**/api/imperium/presets');
 await page.setViewportSize({width:1280,height:720});await page.goto(base);await ready();
 // Start preview failures remain recoverable without losing the selected map.
 await page.route('**/presets/americas/starts',route=>route.fulfill({status:503,json:{detail:'Test failure'}}));
 await page.locator('input[value="americas"]').check();await page.locator('#retry-maps').waitFor({state:'visible'});
 assert.ok(await page.locator('#start-btn').isDisabled());await page.unroute('**/presets/americas/starts');
 await page.locator('#retry-maps').click();await ready();assert.equal(await page.locator('input:checked').inputValue(),'americas');
 await page.locator('#customize-names summary').click();await page.fill('#player-name','Setup tester');await page.fill('#campaign-name','Compact setup test');
 await page.locator('#customize-names summary').click();await page.click('#start-btn');await page.waitForURL('**/game.html');
 await page.waitForFunction(()=>typeof state!=='undefined'&&state&&atlas.geometry);
 assert.equal(await page.evaluate(()=>state.player_1.name),'Setup tester');assert.equal(await page.evaluate(()=>state.preset_id),'americas');
 const id=await page.evaluate(()=>sessionStorage.getItem('gameId'));
 await page.goto(base);await ready();await page.click('#resume-game-tab');await page.locator('.saved-campaign').first().click();await page.waitForURL('**/game.html');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('gameId')),id);
 await page.setViewportSize({width:375,height:667});await page.goto(base);await ready();
 await page.locator('input[value="japan_korea"]').check();await ready();await page.click('#continue-setup');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true,'Regional setup fits mobile');
 await page.selectOption('#kingdom-select',{index:1});await page.click('#start-btn');await page.waitForURL('**/game.html');
 await page.waitForFunction(()=>typeof state!=='undefined'&&state?.preset_id==='japan_korea');
 assert.deepEqual(errors,[]);console.log('Viewport filling, adaptive gallery, single gallery, setup preservation, preview retry, campaign creation, resume, and mobile regional creation passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
