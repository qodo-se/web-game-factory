const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
const base=process.env.IMPERIUM_TEST_API||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.addInitScript(base=>localStorage.setItem('IMPERIUM_API_BASE',base),base);
  // Let a kingdom preview finish while campaign creation is still pending.
  let releaseStarts,releaseCreate,createCount=0;
  const startsGate=new Promise(resolve=>releaseStarts=resolve);
  const createGate=new Promise(resolve=>releaseCreate=resolve);
  await page.route('**/presets/*/starts',async route=>{await startsGate;await route.continue()},{times:1});
  await page.route('**/api/imperium/games',async route=>{
   createCount++;await createGate;
   await route.fulfill({status:503,json:{detail:'Temporary test outage'}});
  });
  await page.goto(ui);
  await page.waitForFunction(()=>document.querySelector('#preset-select option')?.value==='mediterranean');
  await page.click('[data-mode="random"]');await page.click('#start-btn');
  await page.waitForFunction(()=>document.getElementById('start-btn').textContent.includes('Marshalling'));
  releaseStarts();await page.waitForFunction(()=>document.getElementById('kingdom-preview').textContent.includes('troops'));
  assert.equal(await page.locator('#start-btn').isDisabled(),true);
  assert.equal(await page.locator('[data-mode="preset"]').isDisabled(),true);
  // Even synthetic events must not bypass the independent in-flight guard.
  await page.evaluate(()=>{
   document.querySelector('[data-mode="preset"]').dispatchEvent(new Event('click'));
   document.getElementById('new-game-form').requestSubmit();
  });
  assert.equal(createCount,1);
  releaseCreate();await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  assert.equal(createCount,1);
  assert.match(await page.locator('#error-msg').textContent(),/Temporary test outage/);
  await page.unroute('**/api/imperium/games');
  await page.click('[data-mode="preset"]');await page.click('#start-btn');
  await page.waitForFunction(()=>typeof state!=='undefined'&&state&&atlas.geometry);
  await page.evaluate(()=>{
   const sources=Object.keys(validMoves).map(Number).slice(0,2);
   for(const id of sources){handleRegionClick(id);handleRegionClick(validMoves[id][0]);}
   orderHistory.restore();sidebar.open('orders');
  });
  const plan=()=>page.evaluate(()=>({turn:state.turn,moves:pendingMoves,undo:orderHistory.undoStack,redo:orderHistory.redoStack}));
  const before=await plan();assert.equal(before.moves.length,1);assert.equal(before.redo.length,1);
  await page.route('**/games/*/turn',route=>route.abort('failed'),{times:1});
  await page.click('#end-turn-btn');
  await page.waitForFunction(()=>!resolving&&document.getElementById('save-status').textContent.includes('orders preserved'));
  assert.deepEqual(await plan(),before);
  assert.equal(await page.locator('#undo-order').isDisabled(),false);
  assert.equal(await page.locator('#redo-order').isDisabled(),false);
  await page.click('#redo-order');assert.equal(await page.evaluate(()=>pendingMoves.length),2);
  await page.click('#end-turn-btn');await page.waitForFunction(()=>state.turn===2&&!resolving);
  assert.equal(await page.evaluate(()=>pendingMoves.length),0);
  assert.equal(await page.evaluate(()=>orderHistory.undoStack.length+orderHistory.redoStack.length),0);
  assert.deepEqual(errors,[]);
  console.log('Creation stays locked across async previews and mode changes; failure permits retry. Uncommitted-turn recovery preserves orders and both history stacks; successful retry clears them.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
