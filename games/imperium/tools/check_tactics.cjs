const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
const base=process.env.IMPERIUM_TEST_API||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(base=>localStorage.setItem('IMPERIUM_API_BASE',base),base);
  await page.goto(ui);await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.locator('input[value="india"]').check();await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);await page.click('#start-btn');
  await page.waitForFunction(()=>typeof atlas!=='undefined'&&atlas.geometry);
  const plan=async()=>page.evaluate(()=>{const from=state.player_1.capital;const to=validMoves[from].find(id=>state.regions[id].owner!=='player_1');handleRegionClick(from);handleRegionClick(to);return {from,to}});
  await page.evaluate(()=>sidebar.open('orders'));
  const move=await plan();assert.equal(await page.evaluate(()=>pendingMoves.length),1);
  await page.click('#undo-order');assert.equal(await page.evaluate(()=>pendingMoves.length),0);
  await page.click('#redo-order');assert.equal(await page.evaluate(()=>pendingMoves.length),1);
  await page.click('#clear-orders');assert.equal(await page.evaluate(()=>pendingMoves.length),0);
  await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>pendingMoves.length),1);
  await page.click('.move-remove');assert.equal(await page.evaluate(()=>pendingMoves.length),0);
  await page.click('#undo-order');assert.equal(await page.evaluate(()=>pendingMoves.length),1);
  await page.click('#undo-order');await plan();
  assert.equal(await page.locator('#redo-order').isDisabled(),true);
  const cache=await page.evaluate(()=>{window.paintCount=0;const original=atlas.paintBase;atlas.paintBase=function(...args){window.paintCount++;return original.apply(this,args)};return atlas.baseKey});
  await page.click('#sidebar-settings-toggle');
  await page.selectOption('#map-mode','army');
  assert.equal(await page.locator('#g-strategy path').count(),37);
  assert.match(await page.locator('#map-mode-legend').textContent(),/Troops now/);
  await page.selectOption('#map-mode','recruitment');
  assert.match(await page.locator('#map-mode-legend').textContent(),/supply penalties/);
  assert.ok(await page.locator('#g-labels').textContent().then(t=>t.includes('+12')));
  await page.selectOption('#map-mode','ownership');assert.equal(await page.locator('#g-strategy path').count(),0);
  assert.equal(await page.evaluate(()=>window.paintCount),0);
  assert.equal(await page.evaluate(()=>atlas.baseKey),cache);
  await page.click('#end-turn-btn');await page.waitForFunction(()=>state.turn===2&&!resolving);
  assert.equal(await page.locator('#undo-order').isDisabled(),true);
  assert.equal(await page.locator('#redo-order').isDisabled(),true);
  assert.match(await page.locator('#turn-recap').textContent(),/gained.*lost.*casualties/i);
  assert.equal(await page.locator('#sidebar-battles-toggle').getAttribute('aria-expanded'),'true');
  await page.locator('.battle-explanation summary').first().click();
  assert.match(await page.locator('.battle-explanation').first().textContent(),/effective strength/);
  assert.match(await page.locator('.battle-explanation').first().textContent(),/Random roll|Unopposed/);
  await page.locator('#turn-recap [data-focus-region]').first().click();
  assert.ok(await page.evaluate(()=>mapCamera.zoom>=2));
  await page.screenshot({path:'/tmp/imperium-tactics.png'});
  const recap=await page.evaluate(()=>battleReports.summarize({combat_results:[
   {defender_region_id:1,attacker_owner:'player_2',defender_owner:'player_1',attacker_won:true,attacker_army:20,defender_army:10,attacker_survivors:15,defender_survivors:3},
   {defender_region_id:1,attacker_owner:'player_1',defender_owner:'player_2',attacker_won:true,attacker_army:20,defender_army:15,attacker_survivors:17,defender_survivors:2},
   {defender_region_id:2,attacker_owner:'player_1',defender_owner:'rogue',attacker_won:true,attacker_army:20,defender_army:10,attacker_survivors:16,defender_survivors:3}
  ]}));
  assert.deepEqual(recap,{gained:[2],lost:[],casualties:14,known:true});
  assert.match(await page.evaluate(()=>battleReports.battle({attacker_region_id:0,defender_region_id:1,attacker_won:true,survivors:10})),/older battle/);
  await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state?.turn===2);
  assert.match(await page.locator('#turn-recap').textContent(),/casualties/i);
  assert.ok(await page.locator('.battle-explanation').count());
  assert.deepEqual(errors,[]);
  console.log('Undo/redo/clear/keyboard, redo invalidation, cached strategy modes, battle details, net recap/casualties, region focus, legacy reports and saved report reload passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
