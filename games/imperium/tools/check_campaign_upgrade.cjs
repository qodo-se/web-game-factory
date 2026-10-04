// End-to-end checks against local UI/API, including resume and lost-response recovery.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
const base=process.env.IMPERIUM_TEST_API||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1000}});
  const errors=[];const dialogs=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});
  await page.addInitScript(base=>localStorage.setItem('IMPERIUM_API_BASE',base),base);
  await page.goto(ui);await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.locator('#campaign-name').fill('The Northern Road');
  await page.locator('input[value="india"]').check();await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);await page.locator('#start-btn').click();
  await page.waitForFunction(()=>typeof atlas!=='undefined'&&atlas.geometry);
  assert.equal(await page.locator('#campaign-title').textContent(),'The Northern Road');
  const initial=await page.evaluate(()=>({id:gameId,turn:state.turn,from:state.player_1.capital,
   to:validMoves[state.player_1.capital].find(id=>state.regions[id].owner!=='player_1')}));
  const point=async id=>page.evaluate(id=>{const r=state.regions[id],rect=document.getElementById('map-canvas').getBoundingClientRect();return {x:rect.left+normX(r.x)*rect.width,y:rect.top+normY(r.y)*rect.height}},id);
  let p=await point(initial.from);await page.mouse.click(p.x,p.y);p=await point(initial.to);await page.mouse.move(p.x,p.y);
  await page.waitForFunction(()=>document.getElementById('battle-forecast').textContent.includes('estimated victory'));
  assert.match(await page.locator('#battle-forecast').textContent(),/Assumes defenders stay/);
  await page.click('#sidebar-settings-toggle');
  await page.locator('#show-supply').check();
  await page.screenshot({path:'/tmp/imperium-upgrade-forecast.png'});
  await page.mouse.click(p.x,p.y);
  await page.locator('#sound-toggle').click();
  assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'),'true');
  await page.locator('#end-turn-btn').click();
  await page.locator('#replay-controls').waitFor({state:'visible'});
  assert.ok(await page.locator('#end-turn-btn').isDisabled());
  await page.locator('#skip-replay').click();
  await page.waitForFunction(()=>state.turn===2&&!resolving);
  assert.equal(await page.locator('#save-status').textContent(),'Saved');
  assert.match(await page.locator('#timeline-list').textContent(),/Turn 1/);
  const stale=await page.evaluate(async({base,id})=>{
   const res=await fetch(`${base}/api/imperium/games/${id}/turn`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({moves:[],expected_turn:1})});return res.status;
  },{base,id:initial.id});assert.equal(stale,409);
  await page.locator('#abandon-btn').click();await page.waitForURL('**/index.html');
  await page.locator('.saved-campaign',{hasText:'The Northern Road'}).click();
  await page.waitForFunction(()=>typeof state!=='undefined'&&state?.turn===2);
  assert.equal(await page.evaluate(()=>gameId),initial.id);
  assert.match(await page.locator('#timeline-list').textContent(),/Turn 1/);
  assert.equal(await page.locator('#sound-toggle').textContent(),'Sound on');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#end-turn-btn').click();
  await page.waitForFunction(()=>state.turn===3&&!resolving);
  assert.equal(await page.locator('#replay-controls').isVisible(),false);

  // Commit at the real server, then lose the response. Recovery must load turn 4,
  // rather than allowing the same order to be resolved a second time.
  await page.route('**/games/*/turn',async route=>{await route.fetch();await route.abort('failed')},{times:1});
  await page.locator('#end-turn-btn').click();
  await page.waitForFunction(()=>state.turn===4&&!resolving);
  assert.equal(await page.evaluate(()=>pendingMoves.length),0);
  assert.equal(await page.evaluate(()=>campaignHistory.length),3);
  assert.equal(dialogs.length,1);
  assert.match(dialogs[0],/Cannot reach/);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/imperium-upgrade-campaign.png'});
  console.log('Live campaign checks passed: forecasts, supply overlay, replay/skip, reduced motion, sound, atomic turns, resume, timeline, and lost-response recovery.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
