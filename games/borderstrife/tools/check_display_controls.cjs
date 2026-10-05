const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.click('[data-category="historical"]');
  await page.locator('.battle-factions').first().waitFor();
  assert.match(await page.locator('.battle-location').first().textContent(),/Belgium/);
  assert.match(await page.locator('.battle-factions').first().textContent(),/French/);
  await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.click('#start-btn');await page.waitForURL('**/game.html');
  await page.locator('#load-screen').waitFor({state:'hidden'});
  const saved=await page.evaluate(async()=>JSON.stringify(await api.getGame(gameId)));
  assert.equal(await page.locator('#map-navigation-help').isVisible(),false);
  await page.click('#map-help-toggle');assert.equal(await page.locator('#map-navigation-help').isVisible(),true);
  await page.click('#map-help-toggle');
  await page.click('#sidebar-settings-toggle');
  await page.selectOption('#label-size','large');await page.check('#faction-shapes');
  assert.equal(await page.evaluate(()=>interfaceView.labelSize),13);
  assert.ok(await page.locator('rect.army-counter[data-owner="player_2"]').count()>0);
  await page.locator('#sidebar-resize').focus();await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#sidebar-resize').getAttribute('aria-valuenow'),'272');
  const handle=await page.locator('#sidebar-resize').boundingBox();
  await page.mouse.move(handle.x+3,handle.y+100);await page.mouse.down();await page.mouse.move(handle.x-50,handle.y+100);await page.mouse.up();
  assert.ok(Number(await page.locator('#sidebar-resize').getAttribute('aria-valuenow'))>300);
  await page.click('#map-fullscreen');await page.waitForFunction(()=>document.fullscreenElement||document.body.classList.contains('map-focus'));
  await page.click('#map-fullscreen');await page.waitForFunction(()=>!document.fullscreenElement&&!document.body.classList.contains('map-focus'));
  // Simulate a browser without native fullscreen support.
  await page.evaluate(()=>document.getElementById('map-container').requestFullscreen=undefined);
  await page.click('#map-fullscreen');assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('map-focus')),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('map-focus')),false);
  assert.equal(await page.evaluate(async()=>JSON.stringify(await api.getGame(gameId))),saved);
  await page.reload();await page.locator('#load-screen').waitFor({state:'hidden'});
  assert.equal(await page.locator('#label-size').inputValue(),'large');assert.equal(await page.locator('#faction-shapes').isChecked(),true);
  await page.screenshot({path:'/tmp/imperium-display-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.click('#map-help-toggle');
  assert.equal(await page.locator('#map-navigation-help').isVisible(),true);
  assert.equal(await page.locator('#sidebar-resize').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/tmp/imperium-display-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('Historical card metadata, controls help, label sizes, faction shapes, keyboard/drag resizing, fullscreen/fallback, persistence and mobile checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
