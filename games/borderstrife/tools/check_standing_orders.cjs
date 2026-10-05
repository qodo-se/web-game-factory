// Local-only integration check: API persistence + real browser planning controls.
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
(async()=>{
 const base=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
 if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use a local preview only.');
 const fixture=JSON.parse(execFileSync('.venv/bin/python',['-c',`
import json
from games.borderstrife.api import store
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import Owner
engine=GameEngine.from_preset('india')
s=engine.state
capital=s.get_player('player_2').capital_region_id
for r in s.regions.values():
    if r.id != capital:r.owner=Owner.PLAYER_1
path=next([a.id,b,c] for a in s.regions.values() if a.owner==Owner.PLAYER_1
          for b in a.neighbors if b!=capital for c in s.regions[b].neighbors if c not in (a.id,capital))
print(json.dumps({'id':store.create(engine),'path':path}))
`],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
 const browser=await chromium.launch();
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.evaluate(({id})=>{sessionStorage.setItem('gameId',id);sessionStorage.setItem('presetId','india');},fixture);
 await page.goto(`${base}/game.html`);
 await page.waitForFunction(()=>state&&document.getElementById('load-screen').hidden);
 const point=id=>page.evaluate(id=>{const r=state.regions[id],m=document.getElementById('map-svg').getScreenCTM(),p=new DOMPoint(toSVGX(r.x),toSVGY(r.y)).matrixTransform(m);return {x:p.x,y:p.y};},id);
 const clickRegion=async(id,button='left')=>{const p=await point(id);await page.mouse.click(p.x,p.y,{button});};
 await clickRegion(fixture.path[0],'right');
 assert.equal(await page.locator('[data-map-order="march"]').count(),0);
 await page.locator('[data-map-order="reinforce"]').click();
 const eligibility=await page.evaluate(()=>{
   const source=standingOrders.editor.path[0];
   const expected=state.regions[source].neighbors.filter(id=>state.regions[id].owner==='player_1').sort((a,b)=>a-b);
   const highlighted=[...document.querySelectorAll('#g-labels [data-id]')].filter(g=>g.querySelector('circle[stroke-dasharray="6 4"]')).map(g=>Number(g.dataset.id)).sort((a,b)=>a-b);
   const invalid=Object.values(state.regions).find(r=>r.owner==='player_1'&&r.id!==source&&!expected.includes(r.id)).id;
   handleRegionClick(invalid);
   return {expected,highlighted,path:standingOrders.editor.path,source,dimmed:!!document.querySelector('#g-terrain-effects path[fill="rgba(5,12,20,.32)"]')};
 });
 assert.deepEqual(eligibility.highlighted,eligibility.expected,'Only friendly neighbors get existing target rings');
 assert.deepEqual(eligibility.path,[eligibility.source],'Non-neighbor cannot be selected');
 assert.equal(eligibility.dimmed,true,'Other regions use the existing dimming mechanism');

 for(const id of fixture.path.slice(1,2))await clickRegion(id);
 assert.equal(await page.locator('#standing-confirm').count(),0);
 assert.equal(await page.evaluate(()=>standingOrders.editor),null,'Selecting a neighbor places the repeat order immediately');
 assert.equal(await page.locator('#map-order-composer').isVisible(),false);
 assert.equal(await page.evaluate(()=>pendingMoves.length),1);
 assert.equal(await page.locator('.standing-route').count(),0);
 assert.equal(await page.locator('.planned-arrow').count(),1);
 assert.equal(await page.locator('.repeat-arrow .planned-arrow-head').getAttribute('fill'),'#75baff');
 assert.equal(await page.locator('.repeat-arrow-badge path').count(),1);
 assert.equal(await page.locator('.repeat-arrow-badge text').count(),0);
 assert.match(await page.locator('.repeat-arrow > title').textContent(),/Repeats every turn/);
 const badgeSize=()=>page.locator('.repeat-arrow-badge').evaluate(el=>{const r=el.getBoundingClientRect();return [r.width,r.height];});
 const originalSize=await badgeSize();
 await page.evaluate(()=>{mapCamera.zoom=3;mapCamera.apply();renderMap();});
 const zoomSize=await badgeSize();
 assert.ok(zoomSize.every((size,i)=>Math.abs(size-originalSize[i])<.1),'Repeat badge keeps its screen size when zoomed');
 await page.locator('#map-reset').click();
 await page.screenshot({path:'/tmp/imperium-repeat-arrows.png'});
 await page.locator('.repeat-arrow-badge').click();
 assert.equal(await page.evaluate(()=>standingOrders.orders[0].paused),true,'Badge click pauses the repeat');
 await page.locator('#undo-order').click();
 await page.locator('#undo-order').click();
 assert.equal(await page.evaluate(()=>standingOrders.orders.length),0);
 await page.locator('#redo-order').click();
 assert.equal(await page.evaluate(()=>standingOrders.orders.length),1);
 await page.reload();await page.waitForFunction(()=>state&&document.getElementById('load-screen').hidden);
 assert.deepEqual(await page.evaluate(()=>standingOrders.orders[0].path),fixture.path.slice(0,2),'Browser drafts survive reload');
 await page.locator('[data-standing-action="toggle"]').click();
 assert.equal(await page.evaluate(()=>pendingMoves.length),0);
 await page.locator('[data-standing-action="toggle"]').click();
 assert.equal(await page.evaluate(()=>pendingMoves.length),1);
 // Manual move at the same source pauses a standing plan, and Undo restores both.
 await page.evaluate(([from,to])=>{handleRegionClick(from);handleRegionClick(to);},fixture.path);
 assert.equal(await page.evaluate(()=>standingOrders.orders[0].paused),true);
 assert.equal(await page.evaluate(()=>pendingMoves[0].standing_id),undefined);
 assert.equal(await page.locator('.planned-arrow-head').getAttribute('fill'),'#ffe09a');
 assert.equal(await page.locator('.repeat-arrow-badge').count(),0);
 await page.locator('#undo-order').click();
 assert.equal(await page.evaluate(()=>standingOrders.orders[0].paused),false);
 // Cancelling destination selection preserves the original order.
 await page.locator('[data-standing-action="edit"]').click();
 await page.locator('#end-turn-btn').click();
 assert.equal(await page.evaluate(()=>state.turn),1,'Choosing a destination does not end a turn');
 await page.locator('#standing-discard').click();
 await page.screenshot({path:'/tmp/imperium-standing-orders.png'});
 await page.locator('#end-turn-btn').click();
 await page.waitForFunction(()=>state.turn===2&&!resolving);
 assert.deepEqual(await page.evaluate(()=>standingOrders.orders[0].path),fixture.path.slice(0,2));
 await page.reload();await page.waitForFunction(()=>state&&document.getElementById('load-screen').hidden);
 assert.deepEqual(await page.evaluate(()=>standingOrders.orders[0].path),fixture.path.slice(0,2));
 // A recruiting source is empty after sending troops, but can still be overridden.
 assert.equal(await page.evaluate(([a])=>state.regions[a].army,fixture.path),0);
 await clickRegion(fixture.path[0],'right');
 await page.locator('[data-map-order="move"]').click();
 await clickRegion(fixture.path[1]);
 assert.equal(await page.evaluate(()=>standingOrders.orders[0].paused),true);
 assert.equal(await page.evaluate(()=>pendingMoves[0].standing_id),undefined);
 await page.evaluate(()=>sidebar.open('orders'));
 await page.locator('#undo-order').click();
 // Reissuing from one source never accumulates old paused plans or hits API limits.
 await page.evaluate(([a,b])=>{
   for(let i=0;i<101;i++){standingOrders.start(null,a);standingOrders.pick(b);}
 },fixture.path);
 assert.equal(await page.evaluate(()=>standingOrders.orders.length),1);
 await page.locator('#end-turn-btn').click();await page.waitForFunction(()=>state.turn===3&&!resolving);
 assert.equal(await page.evaluate(()=>standingOrders.orders.length),1);
 await page.evaluate(()=>{sidebar.open('orders');standingOrders.cancel(standingOrders.orders[0].id);});
 // Repeat is issued directly from the map, including by a long press.
 const p=await point(fixture.path[2]);
 await page.mouse.move(p.x,p.y);await page.mouse.down();
 await page.waitForTimeout(650);await page.mouse.up();
 await page.locator('[data-map-order="reinforce"]').click();
 await clickRegion(fixture.path[1]);
 assert.equal(await page.evaluate(()=>standingOrders.editor),null);
 await page.evaluate(()=>sidebar.open('orders'));
 assert.equal(await page.evaluate(()=>standingOrders.orders[0].kind),'reinforce');
 await page.locator('#clear-orders').click();assert.equal(await page.evaluate(()=>standingOrders.orders.length),0);
 await page.locator('#undo-order').click();assert.equal(await page.evaluate(()=>standingOrders.orders.length),1);
 await page.locator('[data-standing-action="cancel"]').click();
 assert.equal(await page.evaluate(()=>pendingMoves.length),0);
 // Narrow sidebar keeps every action reachable without horizontal overflow.
 await page.setViewportSize({width:850,height:700});
 assert.equal(await page.locator('#sidebar-orders-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 // Escape aborts the hold timer, both during normal planning and repeat selection.
 await page.setViewportSize({width:1440,height:1000});
 for(const editing of [false,true]) {
   if(editing)await page.evaluate(([a])=>standingOrders.start(null,a),fixture.path);
   const holdPoint=await point(fixture.path[1]);
   await page.mouse.move(holdPoint.x,holdPoint.y);await page.mouse.down();
   await page.keyboard.press('Escape');await page.waitForTimeout(650);await page.mouse.up();
   assert.equal(await page.locator('#map-order-menu').isVisible(),false,'Escape cancels the scheduled menu');
   assert.equal(await page.evaluate(()=>standingOrders.editor),null);
   assert.equal(await page.evaluate(()=>pendingMoves.length),0,'Release after Escape does not place an order');
 }
 // A moving touch is a pan, never a long press. A stationary touch opens orders.
 await page.setViewportSize({width:1440,height:1000});
 const touch=await page.context().newCDPSession(page);
 const p2=await point(fixture.path[2]);
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p2]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p2.x+30,y:p2.y+20}]});
 await page.waitForTimeout(650);
 assert.equal(await page.locator('#map-order-menu').isVisible(),false,'Panning cancels the hold');
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p2]});
 await page.waitForTimeout(650);
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await page.locator('#map-order-menu').isVisible(),true,'Touch hold opens region orders');
 assert.equal(await page.evaluate(()=>pendingMoves.length),0,'Releasing a hold never plans a move');
 await page.screenshot({path:'/tmp/imperium-map-orders.png'});
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#map-order-menu').isVisible(),false);
 await touch.detach();
 // Quota failures stay visible, survive other UI updates, and preserve the
 // in-memory plan when a failed turn request recovers the same server turn.
 await page.evaluate(([,to,from])=>{standingOrders.start(null,from);standingOrders.pick(to);},fixture.path);
 await page.locator('#end-turn-btn').click();await page.waitForFunction(()=>state.turn===4&&!resolving);
 const blockDraftWrites=()=>page.evaluate(()=>{
   window.originalStorageWrite=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){
     if(key.startsWith('imperium-plan:'))throw new DOMException('Storage full','QuotaExceededError');
     return window.originalStorageWrite.call(this,key,value);
   };
 });
 await blockDraftWrites();
 await page.evaluate(()=>{standingOrders.toggle(standingOrders.orders[0].id);updateMovesList();});
 assert.equal(await page.locator('#draft-save-warning').isVisible(),true);
 assert.equal(await page.locator('#save-status').textContent(),'Orders not saved');
 assert.match(await page.locator('#order-status').textContent(),/not saved/);
 page.on('dialog',dialog=>dialog.dismiss());
 await page.route('**/api/imperium/games/*/turn',route=>route.abort());
 await page.locator('#end-turn-btn').click();
 await page.waitForFunction(()=>!resolving);
 assert.equal(await page.evaluate(()=>standingOrders.orders[0].paused),true,'Failed submit must not restore an older active plan');
 assert.equal(await page.locator('#draft-save-warning').isVisible(),true);
 await page.unroute('**/api/imperium/games/*/turn');
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalStorageWrite;});
 await page.locator('#retry-draft-save').click();
 assert.equal(await page.locator('#draft-save-warning').isVisible(),false);
 assert.equal(await page.locator('#save-status').textContent(),'Draft saved in this browser');
 await page.reload();await page.waitForFunction(()=>state&&document.getElementById('load-screen').hidden);
 assert.equal(await page.evaluate(()=>standingOrders.orders[0].paused),true,'Retry persists the paused plan across reload');
 // Successful server commit clears the warning even if local caching still fails.
 await blockDraftWrites();
 await page.evaluate(()=>standingOrders.cancel(standingOrders.orders[0].id));
 assert.equal(await page.locator('#draft-save-warning').isVisible(),true);
 await page.locator('#end-turn-btn').click();await page.waitForFunction(()=>state.turn===5&&!resolving);
 assert.equal(await page.locator('#draft-save-warning').isVisible(),false);
 assert.equal(await page.locator('#save-status').textContent(),'Saved');
 await page.reload();await page.waitForFunction(()=>state&&document.getElementById('load-screen').hidden);
 assert.equal(await page.evaluate(()=>standingOrders.orders.length),0,'Server retains cancellation despite storage failure');

 assert.deepEqual(errors,[]);console.log('Map orders: right-click, mouse/touch long press, pan cancellation, repeat, manual override, undo/redo, edit/discard, reload, turn persistence, compact layout, storage failure/retry and failed-submit recovery passed.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
