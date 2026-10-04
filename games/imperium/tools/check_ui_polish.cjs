// Presentation and loading recovery checks; uses only local campaigns.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/imperium/presets',route=>route.fulfill({status:503,json:{detail:'Temporarily unavailable'}}));
  await page.goto(base);
  await page.locator('#retry-maps').waitFor({state:'visible'});
  await page.unroute('**/api/imperium/presets');
  await page.click('#retry-maps');
  await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.screenshot({path:'/tmp/imperium-polish-gallery.png',fullPage:true});
  await page.locator('input[value="india"]').check();
  await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.click('#start-btn');
  await page.waitForURL('**/game.html');
  await page.locator('#load-screen').waitFor({state:'hidden'});
  await page.evaluate(()=>{sidebar.open('orders');handleRegionClick(state.player_1.capital);});
  await page.screenshot({path:'/tmp/imperium-polish-game.png'});
  for(const width of [390,768,1440]) {
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/imperium-polish-mobile.png',fullPage:true});
  await page.route('**/api/imperium/games/*',route=>route.fulfill({status:503,json:{detail:'Temporarily unavailable'}}));
  await page.reload();
  await page.locator('#retry-game').waitFor({state:'visible'});
  assert.equal(await page.locator('#main').evaluate(el=>el.inert),true);
  await page.unroute('**/api/imperium/games/*');
  await page.click('#retry-game');
  await page.locator('#load-screen').waitFor({state:'hidden'});
  assert.equal(await page.locator('#main').evaluate(el=>el.inert),false);
  assert.deepEqual(errors,[]);
  console.log('Gallery retry, campaign retry, restored controls, responsive widths and presentation screenshots passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
