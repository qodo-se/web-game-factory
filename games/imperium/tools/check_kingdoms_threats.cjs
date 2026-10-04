const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
const base=process.env.IMPERIUM_TEST_API||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(base=>localStorage.setItem('IMPERIUM_API_BASE',base),base);
  await page.goto(ui);await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.locator('input[value="india"]').check();await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.waitForFunction(()=>!document.getElementById('kingdom-select').disabled);
  await page.selectOption('#kingdom-select','36');
  assert.match(await page.locator('#kingdom-preview').textContent(),/Kashyap Meer/);
  await page.click('#start-btn');
  await page.waitForFunction(()=>typeof state!=='undefined'&&state?.player_1.capital===36&&atlas.geometry);
  await page.evaluate(()=>updateRegionInfo(36));
  assert.equal(await page.locator('.region-art').count(),0);
  assert.ok(await page.locator('.ocean-wave').count());
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.ocean-wave').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.click('#sidebar-settings-toggle');
  await page.uncheck('#show-atmosphere');
  assert.equal(await page.locator('#g-atmosphere').evaluate(e=>getComputedStyle(e).display),'none');
  await page.check('#show-atmosphere');
  await page.check('#show-threats');
  await page.waitForFunction(()=>document.getElementById('threat-description').textContent.includes('No regions'));
  // A threatened border must remain visible without interrupting Next Turn.
  await page.route('**/games/*/threats',async route=>route.fulfill({json:{turn:1,entries:[{region_id:36,risk:1,garrison:0,level:'high',enemy_sources:[0]}],warnings:[{region_id:36,name:'Kashyap Meer',garrison:0,important:true}]}}));
  await page.evaluate(()=>{threatView.key='';return threatView.refresh()});
  assert.equal(await page.locator('#g-threats circle').count(),1);
  await page.click('#end-turn-btn');
  await page.waitForFunction(()=>state.turn===2&&!resolving);
  await page.unroute('**/games/*/threats');
  await page.evaluate(()=>{threatView.key='';return threatView.refresh()});
  await page.screenshot({path:'/tmp/imperium-kingdom-atmosphere.png'});
  assert.deepEqual(errors,[]);
  console.log('Kingdom selection, Kashyap Meer campaign, threat overlay, uninterrupted turn submission, compact region inspector, atmosphere toggle and reduced motion passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
