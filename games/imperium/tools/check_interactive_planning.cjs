// Run with local preview on port 3000 and Playwright installed.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
 await page.addInitScript(()=>localStorage.setItem('imperium-map-input-mode','mouse'));
        await page.goto(base); await page.locator('input[value="india"]').check();
 await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
 await page.locator('#start-btn').click();await page.waitForURL('**/game.html');
 await page.waitForFunction(()=>atlas.geometry);
 const pair=await page.evaluate(()=>{
   for(const [id,targets] of Object.entries(validMoves)) {
     const enemy=targets.find(t=>state.regions[t].owner!=='player_1');
     if(enemy!==undefined)return [+id,enemy];
   }
 });
 assert.ok(pair);
 const point=id=>page.evaluate(id=>{const r=state.regions[id],m=document.getElementById('map-svg').getScreenCTM(),p=new DOMPoint(toSVGX(r.x),toSVGY(r.y)).matrixTransform(m);return {x:p.x,y:p.y};},id);
 async function drag(from,to){const a=await point(from),b=await point(to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();}
 async function clickMove(from,to){const a=await point(from),b=await point(to);await page.mouse.click(a.x,a.y);await page.mouse.click(b.x,b.y);}
 // Dragging from an army never plans an order, including at the fully zoomed-out view.
 await drag(...pair);
 assert.equal(await page.evaluate(()=>pendingMoves.length),0);
 assert.equal(await page.evaluate(()=>selectedFrom),null);
 const cameraBefore=await page.evaluate(()=>[mapCamera.x,mapCamera.y]);
 await clickMove(...pair);
 assert.equal(await page.evaluate(()=>pendingMoves.length),1);
 assert.deepEqual(await page.evaluate(()=>[mapCamera.x,mapCamera.y]),cameraBefore);
 assert.match(await page.locator(`.troop-projection[data-region="${pair[0]}"]`).textContent(),/→ 0/);
 assert.match(await page.locator(`.troop-projection[data-region="${pair[1]}"]`).textContent(),/⚔/);
 // The interactive arrow must not block wheel/pinch or Shift-drag panning.
 const arrowPoint=()=>page.locator('.order-hit').evaluate(path=>{const a=path.getPointAtLength(path.getTotalLength()/2),p=new DOMPoint(a.x,a.y).matrixTransform(path.getScreenCTM());return {x:p.x,y:p.y};});
 let arrow=await arrowPoint(); await page.mouse.move(arrow.x,arrow.y);await page.mouse.wheel(0,-150);
 await page.waitForFunction(()=>mapCamera.zoom>1);
 await page.waitForTimeout(180);
 arrow=await arrowPoint();const beforeArrowPan=await page.evaluate(()=>[mapCamera.x,mapCamera.y]);
 await page.keyboard.down('Shift');await page.mouse.move(arrow.x,arrow.y);await page.mouse.down();
 await page.mouse.move(arrow.x-35,arrow.y-30,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');
 assert.notDeepEqual(await page.evaluate(()=>[mapCamera.x,mapCamera.y]),beforeArrowPan);
 assert.equal(await page.evaluate(()=>pendingMoves.length),1,'Panning from an arrow must not cancel it');
 // Touch drags on SVG orders share the same gesture surface too.
 arrow=await arrowPoint();const beforeTouch=await page.evaluate(()=>[mapCamera.x,mapCamera.y]);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:arrow.x,y:arrow.y}]});
 for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:arrow.x-step*5,y:arrow.y-step*4}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.notDeepEqual(await page.evaluate(()=>[mapCamera.x,mapCamera.y]),beforeTouch);
 assert.equal(await page.evaluate(()=>pendingMoves.length),1);
 await cdp.detach();
 await page.locator('#map-reset').click();
 // Cancel the actual curved arrow at its midpoint; ensure the click reaches it.
 const midpoint=await page.locator('.order-hit').evaluate(path=>{const p=path.getPointAtLength(path.getTotalLength()*.5),s=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());return {x:s.x,y:s.y};});
 await page.mouse.click(midpoint.x,midpoint.y);
 assert.equal(await page.evaluate(()=>pendingMoves.length),0);
 await page.keyboard.press('Control+z'); assert.equal(await page.evaluate(()=>pendingMoves.length),1);
 await page.keyboard.press('Control+z'); assert.equal(await page.evaluate(()=>pendingMoves.length),0);
 // Existing click controls and hover forecast.
 const a=await point(pair[0]),b=await point(pair[1]);
 await page.mouse.click(a.x,a.y);await page.mouse.move(b.x,b.y);
 await page.waitForFunction(()=>document.getElementById('planning-preview').textContent.includes('victory chance'));
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>selectedFrom),null);
 assert.equal(await page.locator('#planning-preview').isVisible(),false);
 // Escape during a gesture must not submit the order when the pointer releases.
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();
 assert.equal(await page.evaluate(()=>pendingMoves.length),0);
 // Invalid drops do not add an order.
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(5,80,{steps:8});await page.mouse.up();
 assert.equal(await page.evaluate(()=>pendingMoves.length),0);
 // Plain drag on an army pans when zoomed.
 await page.locator('#map-zoom-in').click(); await page.waitForTimeout(180);
 const start=await point(pair[0]);const old=await page.evaluate(()=>[mapCamera.x,mapCamera.y]);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x-40,start.y-35,{steps:8});await page.mouse.up();
 assert.notDeepEqual(await page.evaluate(()=>[mapCamera.x,mapCamera.y]),old);
 assert.equal(await page.evaluate(()=>pendingMoves.length),0);
 await page.locator('#map-reset').click();
 await drag(...pair);
 // At zoom, the clipped canvas extends behind the sidebar. Dropping there
 // must cancel even when a valid destination exists at those world coordinates.
 const outside=await page.evaluate(()=>{
   pendingMoves=[];selectedFrom=null;renderMap();
   const viewport=mapCamera.viewport.getBoundingClientRect();
   for(const [from,targets] of Object.entries(validMoves))for(const to of targets){
     mapCamera.zoom=3;const target=state.regions[to];
     mapCamera.x=viewport.width+70-toSVGX(target.x)*3;
     mapCamera.y=450-toSVGY(target.y)*3;mapCamera.apply();renderMap();
     const matrix=document.getElementById('map-svg').getScreenCTM();
     const a=new DOMPoint(toSVGX(state.regions[from].x),toSVGY(state.regions[from].y)).matrixTransform(matrix);
     const b=new DOMPoint(toSVGX(target.x),toSVGY(target.y)).matrixTransform(matrix);
     if(a.x>30&&a.x<viewport.right-30&&a.y>150&&a.y<850&&b.x>viewport.right+20&&b.x<1400&&b.y>150&&b.y<850)
       return {a:{x:a.x,y:a.y},b:{x:b.x,y:b.y}};
   }
 });
 assert.ok(outside,'Fixture includes a valid neighbor clipped behind the sidebar');
 await page.mouse.move(outside.a.x,outside.a.y);await page.mouse.down();
 await page.mouse.move(outside.b.x,outside.b.y,{steps:10});await page.mouse.up();
 assert.equal(await page.evaluate(()=>pendingMoves.length),0,'Off-map drop must not queue an order');
 assert.equal(await page.evaluate(()=>selectedFrom),null);
 await page.locator('#map-reset').click();
 // Combined attacks aggregate recruitment from each source, without changing live armies.
 const combined=await page.evaluate(()=>{
   pendingMoves=[]; selectedFrom=null;
   const entries=Object.entries(validMoves);
   for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
     const target=entries[i][1].find(t=>entries[j][1].includes(t)&&state.regions[t].owner!=='player_1');
     if(target===undefined)continue;
     const sources=[+entries[i][0],+entries[j][0]], before=JSON.stringify(state.regions);
     for(const source of sources){handleRegionClick(source);handleRegionClick(target);}
     return {target,expected:sources.reduce((sum,id)=>sum+state.regions[id].army+state.regions[id].pop_rate,0),unchanged:JSON.stringify(state.regions)===before};
   }
 });
 assert.ok(combined); assert.equal(combined.unchanged,true);
 assert.ok((await page.locator(`.troop-projection[data-region="${combined.target}"]`).textContent()).startsWith(`⚔ ${combined.expected}`));
 await page.screenshot({path:'/tmp/imperium-interactive-planning.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Click orders, army drag panning, arrow cancellation, wheel/touch/Shift-pan over arrows, off-map drops, undo, hover forecast, projections and Escape passed.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
