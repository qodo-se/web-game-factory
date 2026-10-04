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
  await page.goto(ui);await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);await page.click('#start-btn');
  await page.waitForFunction(()=>typeof atlas!=='undefined'&&atlas.geometry);
  await page.evaluate(()=>updateRegionInfo(state.player_1.capital));
  const keys=['settings','orders','battles','timeline','rules'];
  assert.equal(await page.locator('.sidebar-section').count(),5);
  for(const height of [1000,700,550]) {
   await page.setViewportSize({width:1500,height});await page.waitForTimeout(200);
   for(const key of keys) {
    if(await page.locator(`#sidebar-${key}-toggle`).getAttribute('aria-expanded')!=='true')await page.click(`#sidebar-${key}-toggle`);
    assert.equal(await page.locator('.sidebar-toggle[aria-expanded="true"]').count(),1);
    assert.equal(await page.locator('.sidebar-body:visible').count(),1);
    assert.equal(await page.locator('#region-info-section').isVisible(),true);
    const layout=await page.evaluate(()=>{
     const panel=document.getElementById('side-panel');
     const sections=[...panel.children];
     const active=panel.querySelector('.is-expanded');
     return {available:panel.clientHeight-sections.filter(s=>s!==active).reduce((h,s)=>h+s.getBoundingClientRect().height,0),
      actual:active.getBoundingClientRect().height,scroll:panel.scrollHeight,height:panel.clientHeight};
    });
    assert.ok(Math.abs(layout.available-layout.actual)<2,JSON.stringify(layout));
    assert.ok(layout.scroll<=layout.height+1);
   }
  }
  await page.evaluate(()=>document.getElementById('timeline-list').innerHTML='<p>Turn history</p>'.repeat(100));
  await page.click('#sidebar-timeline-toggle');
  assert.ok(await page.locator('#sidebar-timeline-body').evaluate(e=>e.scrollHeight>e.clientHeight));
  await page.locator('#sidebar-timeline-body').evaluate(e=>e.scrollTop=500);
  assert.equal(await page.locator('#side-panel').evaluate(e=>e.scrollTop),0);
  await page.click('#sidebar-timeline-toggle');assert.equal(await page.locator('.sidebar-body:visible').count(),0);
  await page.locator('#sidebar-settings-toggle').focus();await page.keyboard.press('End');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'sidebar-rules-toggle');
  await page.keyboard.press('Enter');assert.equal(await page.locator('#sidebar-rules-toggle').getAttribute('aria-expanded'),'true');
  await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state);
  assert.equal(await page.locator('#sidebar-rules-toggle').getAttribute('aria-expanded'),'true');
  await page.evaluate(()=>updateRegionInfo(state.player_1.capital));
  await page.setViewportSize({width:1500,height:1000});await page.waitForTimeout(200);
  await page.screenshot({path:'/tmp/imperium-sidebar.png'});
  for (const size of [{width:390,height:844},{width:667,height:375}]) {
   await page.setViewportSize(size);
   await page.evaluate(()=>sidebar.open('settings'));
   await page.waitForFunction(()=>atlas.geometry.h===document.getElementById('map-container').clientHeight);
   const settings=page.locator('#sidebar-settings-body');
   assert.ok(await settings.evaluate(e=>e.clientHeight-28>=140), 'Mobile settings need room for usable controls');
   await page.locator('#map-mode').selectOption('army');
   await page.locator('#show-supply').check();
   assert.equal(await page.locator('#show-supply').isChecked(),true);
   await page.locator('#sidebar-rules-toggle').click();
   await page.waitForFunction(()=>atlas.geometry.h===document.getElementById('map-container').clientHeight);
   assert.equal(await page.locator('.sidebar-body:visible').count(),1);
   assert.ok(await page.locator('#sidebar-rules-body').evaluate(e=>e.clientHeight-28>=140));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);
  console.log('Pinned region and five collapsible sections, exclusive expansion, remaining-height layout at 3 heights, independent scrolling, all-collapsed state, keyboard controls and reload persistence passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
