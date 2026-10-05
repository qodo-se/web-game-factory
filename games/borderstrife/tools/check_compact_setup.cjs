// Local setup UX checks, including real submissions and recovery from errors.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://127.0.0.1:3000';
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
 for(const [width,height] of [[1366,768],[1280,720],[375,667],[390,844],[320,568]]) {
  await page.setViewportSize({width,height});await page.goto(base);await ready();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const geometry=await page.evaluate(()=>{
   const gallery=document.getElementById('map-grid'),cards=[...gallery.querySelectorAll('.map-card')];
   const rows=[...new Set(cards.map(card=>card.offsetTop))];
   const third=cards.find(card=>card.offsetTop===rows[2]);
   return {top:document.querySelector('.welcome-card').getBoundingClientRect().top,
    thirdBottom:third.getBoundingClientRect().bottom,galleryBottom:gallery.getBoundingClientRect().bottom,
    scrolls:gallery.scrollHeight>gallery.clientHeight,count:cards.length};
  });
  assert.ok(geometry.top<=20,'Container is anchored at the top');
  assert.ok(geometry.thirdBottom<=geometry.galleryBottom,'Three complete rows fit inside the gallery');
  assert.ok(geometry.scrolls);assert.equal(geometry.count,14);
  assert.equal(await page.locator('#maps-next,#maps-prev').count(),0);
  const initialHeight=await page.locator('#map-grid').evaluate(el=>el.clientHeight);
  await page.click('[data-category="legends"]');await ready();
  assert.equal(await page.locator('#map-grid').evaluate(el=>el.clientHeight),initialHeight);
  await page.click('[data-category="world"]');await ready();
  await page.locator('.map-card input').last().scrollIntoViewIfNeeded();
  const choice=await page.locator('.map-card input').first().inputValue();await page.locator('.map-card input').first().check();await ready();
  if(width<=760)await page.locator('#continue-setup').click();
  const button=await page.locator('#start-btn').boundingBox();assert.ok(button.y+button.height<=height,`Begin stays visible at ${width}`);

  await page.locator('#resume-game-tab').click();assert.ok(await page.locator('#new-game-form').isHidden());
  assert.ok(await page.locator('#saved-campaigns').isVisible());
  await page.locator('#new-game-tab').click();assert.ok(await page.locator('#start-btn').isVisible());
  if(width<=760){await page.locator('#back-to-maps').click();assert.equal(await page.locator('.map-card input:checked').inputValue(),choice);}
 }
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
 await page.setViewportSize({width:375,height:667});await page.goto(base);await ready();await page.click('[data-category="historical"]');await ready();
 await page.click('#continue-setup');assert.ok(await page.locator('#battle-essentials').isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true,'Historical setup fits mobile');
 await page.selectOption('#kingdom-select',{index:1});await page.click('#start-btn');await page.waitForURL('**/game.html');
 await page.waitForFunction(()=>typeof state!=='undefined'&&state?.battle);assert.ok(await page.evaluate(()=>!!state.battle));
 assert.deepEqual(errors,[]);console.log('Top anchoring, three gallery rows, category stability, setup preservation, preview retry, campaign creation, resume, and mobile battle creation passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
