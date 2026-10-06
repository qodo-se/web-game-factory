const {chromium,firefox}=require('playwright'),assert=require('node:assert/strict');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
(async()=>{const browser=await (process.env.BROWSER==='firefox'?firefox:chromium).launch();try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',message=>{if(message.type()==='error'&&message.text().includes('file:///'))errors.push(message.text());});
 let starts=0,threats=0;page.on('request',r=>{if(r.url().endsWith('/starts'))starts++;if(r.url().endsWith('/threats'))threats++;});
 // Simulate an obsolete cached script at the pre-release URL. New HTML must bypass it.
 let staleWorldRequests=0;
 await page.route(url=>url.pathname.endsWith('/js/world.js')&&!url.search,route=>{staleWorldRequests++;return route.fulfill({contentType:'text/javascript',body:'const threatView = {refresh(){},draw(){}};'});});
 await page.goto(ui);await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);starts=0;
 for(const id of ['india','europe','india','europe','india']){
  await page.locator(`input[value="${id}"]`).check();await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
 }
 assert.equal(starts,2);
 await page.click('#start-btn');await page.waitForURL('**/game.html');await page.waitForFunction(()=>typeof state!=='undefined'&&!!state&&!document.getElementById('main').inert);
 await page.evaluate(()=>{document.getElementById('show-threats').checked=true;threatView.refresh();});
 await page.waitForFunction(()=>threatView.data&&threatView.current());const original=await page.evaluate(()=>JSON.stringify(threatView.data));
 for(const moving of [true,false,true,false]){
  await page.evaluate(moving=>{const [source,targets]=Object.entries(validMoves)[0];pendingMoves=moving?[{from_region_id:+source,to_region_id:targets[0]}]:[];threatView.refresh();},moving);
  await page.waitForFunction(()=>threatView.data&&threatView.current());
 }
 assert.equal(threats,2);assert.equal(await page.evaluate(()=>JSON.stringify(threatView.data)),original);
 await page.evaluate(()=>{document.getElementById('show-threats').checked=false;threatView.refresh();document.getElementById('show-threats').checked=true;threatView.refresh();});
 await page.waitForFunction(()=>threatView.data&&threatView.current());assert.equal(threats,2);
 // Same turn but a new authoritative snapshot must invalidate both layers.
 await page.evaluate(()=>{state=structuredClone(state);threatView.refresh();});await page.waitForFunction(()=>threatView.data&&threatView.current());assert.equal(threats,3);
 await page.evaluate(()=>{setResolving(true);setResolving(false);});await page.waitForFunction(()=>threatView.data&&threatView.current());assert.equal(threats,4);
 await page.evaluate(()=>{campaignReplay.active=true;document.getElementById('show-threats').checked=false;threatView.refresh();});assert.equal(await page.locator('#g-threats circle').count(),0);
 await page.evaluate(()=>{campaignReplay.active=false;document.getElementById('show-threats').checked=true;state=structuredClone(state);threatView.refresh();});
 await page.waitForFunction(()=>threatView.data&&threatView.current());assert.equal(threats,5);
 await page.evaluate(()=>{presentation.speed='instant';document.activeElement?.blur();});
 await page.keyboard.press('Shift+Enter');
 await page.waitForFunction(()=>threatView.data?.turn===2&&threatView.current());assert.equal(threats,6);
 const afterTurn=await page.evaluate(()=>JSON.stringify(threatView.data));
 await page.route('**/games/*/threats',r=>r.fulfill({status:503,json:{detail:'Test threat failure'}}));
 await page.evaluate(()=>{threatCache.clear();threatView.invalidate();threatView.refresh();});
 await page.waitForFunction(()=>document.getElementById('threat-description').textContent==='Test threat failure');
 await page.unroute('**/games/*/threats');await page.evaluate(()=>threatView.refresh());
 await page.waitForFunction(()=>threatView.data&&threatView.current());assert.equal(await page.evaluate(()=>JSON.stringify(threatView.data)),afterTurn);
 assert.equal(staleWorldRequests,0,'HTML must bypass stale unversioned world.js');
 assert.deepEqual(errors,[]);console.log('PASS: five map selections use two requests; five plans use two threat requests; exact results, toggle reuse and snapshot/action/replay invalidation');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
