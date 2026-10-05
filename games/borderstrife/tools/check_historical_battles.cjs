// Requires a local API/UI preview and Playwright. Creates only local test campaigns.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
const apiBase=process.env.IMPERIUM_TEST_API||base;
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(url=>localStorage.setItem('IMPERIUM_API_BASE',url),apiBase);
  await page.goto(base);
  await page.waitForFunction(()=>!document.querySelector('#start-btn').disabled);
  assert.equal(await page.locator('.map-card').count(),14);
  assert.match(await page.locator('#category-description').textContent(), /^14 regional theaters/);
  await page.getByRole('button',{name:'Historical Battles'}).click();
  await page.waitForFunction(()=>!document.querySelector('#start-btn').disabled);
  assert.equal(await page.locator('.map-card').count(),10);
  assert.match(await page.locator('#category-description').textContent(), /^10 focused battles/);
  assert.equal(await page.locator('#kingdom-select option').count(),2);
  assert.equal(await page.locator('#starting-label').textContent(),'Choose your side');
  for(const image of await page.locator('.map-card img').all())await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
  await page.screenshot({path:'/tmp/imperium-historical-gallery.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/tmp/imperium-historical-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  // A slow response from the previous category must never overwrite the new choice.
  let release;
  const held=new Promise(resolve=>{release=resolve;});
  await page.route('**/presets/hastings/starts',async route=>{await held;await route.continue();});
  await page.locator('input[value="hastings"]').check();
  await page.getByRole('button',{name:'Regional Maps'}).click();
  await page.waitForFunction(()=>!document.querySelector('#start-btn').disabled);
  const worldChoices=await page.locator('#kingdom-select').textContent();
  release();await page.waitForResponse(r=>r.url().endsWith('/hastings/starts'));
  assert.equal(await page.locator('#kingdom-select').textContent(),worldChoices);
  assert.ok(!(await page.locator('#battle-briefing').textContent()).includes('20 turns'));
  await page.unroute('**/presets/hastings/starts');
  for (const id of ['waterloo','sekigahara','hastings','hattin','gettysburg']) {
   for (const side of [0,1]) {
    await page.goto(base);
    await page.getByRole('button',{name:'Historical Battles'}).click();
    await page.locator(`input[value="${id}"]`).check();
    await page.waitForFunction(()=>!document.querySelector('#start-btn').disabled);
    await page.locator('#kingdom-select').selectOption({index:side});
    const faction=await page.locator('#kingdom-select option:checked').textContent();
    await page.getByRole('button',{name:'Begin Battle',exact:true}).click();
    await page.waitForURL('**/game.html');
    await page.waitForFunction(()=>typeof atlas!=='undefined'&&atlas.geometry&&typeof state!=='undefined'&&state?.battle);
    assert.equal(await page.locator('#p1-name').textContent(),faction);
    assert.equal(await page.locator('.battle-objective').count(),3);
    assert.equal(await page.evaluate(()=>atlas.data.id),id+'_atlas_v4');
    assert.ok(await page.evaluate(()=>atlas.terrainImage?.complete && atlas.terrainImage.naturalWidth>=1000));
    assert.ok(await page.evaluate(()=>atlas.data.contours.length>10 && atlas.data.rivers.length>0));
    assert.ok(await page.locator('#battle-terrain-notes').evaluate(el=>!el.hidden));
    assert.ok(await page.evaluate(()=>Object.values(state.regions).every(r=>r.pop_rate===0)));
    if(side===0)await page.screenshot({path:`/tmp/imperium-battle-${id}.png`,fullPage:true});
    if(id==='hattin'&&side===0) {
     await page.setViewportSize({width:390,height:844});
     await page.waitForFunction(()=>atlas.geometry.w===document.querySelector('#map-container').clientWidth);
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     assert.equal(await page.locator('#map-container').evaluate(el=>el.clientWidth),390);
     await page.screenshot({path:'/tmp/imperium-hattin-mobile-game.png'});
     await page.setViewportSize({width:1440,height:1000});
    }
    await page.locator('#end-turn-btn').click();
    await page.waitForFunction(()=>state.turn===2);
    await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state?.turn===2);
    assert.equal(await page.locator('#p1-name').textContent(),faction);
   }
  }
  // Complete the last local battle and verify its saved, read-only replay.
  const gameId=await page.evaluate(()=>sessionStorage.getItem('gameId'));
  let last=await (await page.request.get(`${apiBase}/api/imperium/games/${gameId}`)).json();
  while(!last.state.game_over) {
   const response=await page.request.post(`${apiBase}/api/imperium/games/${gameId}/turn`,{data:{moves:[],expected_turn:last.state.turn}});
   assert.equal(response.status(),200);last=await response.json();
  }
  assert.ok(last.state.turn<=21);
  await page.reload();await page.locator('#replay-campaign').click();
  await page.waitForFunction(()=>campaignReplay.active);
  assert.equal(await page.evaluate(()=>state.turn),1);
  assert.equal(await page.locator('.battle-objective').count(),3);
  await page.locator('#campaign-replay-exit').click();
  assert.equal(await page.evaluate(()=>state.game_over),true);
  assert.deepEqual(errors,[]);
  console.log('Categories, thumbnails, mobile, stale responses, both sides of all five battles, objectives, turn submission, saved reload, battle completion and replay passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
