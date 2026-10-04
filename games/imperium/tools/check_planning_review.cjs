// Qodo review regressions. Run against the local combined UI/API preview.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(process.env.IMPERIUM_TEST_API)await page.addInitScript(base=>localStorage.setItem('IMPERIUM_API_BASE',base),process.env.IMPERIUM_TEST_API);
  await page.goto(process.env.IMPERIUM_TEST_URL||'http://localhost:3000');
  await page.locator('input[value="india"]').check();
  await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.locator('#start-btn').click();await page.waitForFunction(()=>typeof atlas!=='undefined'&&atlas.geometry);
  const plan=await page.evaluate(()=>{
   const entries=Object.entries(validMoves);
   for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const target=entries[i][1].find(t=>entries[j][1].includes(t)&&state.regions[t].owner!=='player_1');
    if(target!==undefined)return {from:+entries[i][0],second:+entries[j][0],to:target};
   }
  });
  assert.ok(plan);
  const point=id=>page.evaluate(id=>{const r=state.regions[id],p=new DOMPoint(toSVGX(r.x),toSVGY(r.y)).matrixTransform(document.getElementById('map-svg').getScreenCTM());return {x:p.x,y:p.y};},id);
  const reset=()=>page.evaluate(()=>{pendingMoves=[];selectedFrom=null;lastHoverId=null;planning.clearEffects();clearRegionInfo();mapCamera.reset();renderMap();});
  const queue=()=>page.evaluate(({from,to})=>{handleRegionClick(from);handleRegionClick(to);},plan);
  // Escape before the threshold must invalidate both later movement and release-click.
  for(const moveAfterEscape of [false,true]){
   await reset();const a=await point(plan.from),b=await point(plan.to);
   await page.mouse.move(a.x,a.y);await page.mouse.down();await page.keyboard.press('Escape');
   if(moveAfterEscape)await page.mouse.move(b.x,b.y,{steps:10});
   await page.mouse.up();
   assert.equal(await page.evaluate(()=>pendingMoves.length),0);
   assert.equal(await page.evaluate(()=>selectedFrom),null);
  }
  // The visible arrowhead is clickable at different zoom levels.
  for(const zoom of [1,2]){
   await reset();await queue();
   await page.evaluate(({id,zoom})=>{const r=state.regions[id];mapCamera.zoomAt(zoom,toSVGX(r.x),toSVGY(r.y));renderMap();}, {id:plan.to,zoom});
   const tip=await page.locator('.planned-arrow-head').evaluate(poly=>{
    const [t,l,r]=[0,1,2].map(i=>poly.points.getItem(i));
    const p=new DOMPoint(t.x*.9+(l.x+r.x)*.05,t.y*.9+(l.y+r.y)*.05).matrixTransform(poly.getScreenCTM());return {x:p.x,y:p.y};
   });
   await page.mouse.click(tip.x,tip.y);
   assert.equal(await page.evaluate(()=>pendingMoves.length),0,'Arrowhead cancels an order');
  }
  // Forecasts and destination clicks work through an existing arrow hit target.
  await reset();await queue();await page.evaluate(id=>handleRegionClick(id),plan.second);
  const destination=await page.locator('.order-hit').evaluate((path,target)=>{
   const matrix=path.getScreenCTM();
   for(let t=1;t>=.5;t-=.02){const q=path.getPointAtLength(path.getTotalLength()*t),p=new DOMPoint(q.x,q.y).matrixTransform(matrix);
    if(planning.regionAt({clientX:p.x,clientY:p.y})===target)return {x:p.x,y:p.y};}
  },plan.to);
  assert.ok(destination);
  await page.mouse.move(destination.x,destination.y);
  await page.waitForFunction(()=>!document.getElementById('planning-preview').hidden&&document.getElementById('planning-preview').textContent.includes('victory chance'));
  await page.mouse.click(destination.x,destination.y);
  assert.equal(await page.evaluate(()=>pendingMoves.length),2,'Destination click preserves the first order');
  // Native touch drags pan over both owned land and army counters.
  await reset();await page.evaluate(()=>{mapCamera.zoomAt(3,600,450);renderMap();});
  const land=await page.evaluate(()=>{
   const vp=mapCamera.viewport.getBoundingClientRect(),matrix=document.getElementById('map-svg').getScreenCTM();
   for(let y=vp.top+100;y<vp.bottom-100;y+=10)for(let x=vp.left+100;x<vp.right-100;x+=10){
    const id=planning.regionAt({clientX:x,clientY:y}),r=state.regions[id];
    if(r?.owner!=='player_1'||!validMoves[id]?.length)continue;
    const p=new DOMPoint(toSVGX(r.x),toSVGY(r.y)).matrixTransform(matrix);
    if(Math.hypot(p.x-x,p.y-y)>60)return {x,y};
   }
  });
  assert.ok(land);
  const cdp=await page.context().newCDPSession(page);
  const touchDrag=async(a,b)=>{
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
   for(let n=1;n<=10;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*n/10,y:a.y+(b.y-a.y)*n/10}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const before=await page.evaluate(()=>[mapCamera.x,mapCamera.y]);
  await touchDrag(land,{x:land.x-40,y:land.y-35});
  const after=await page.evaluate(()=>[mapCamera.x,mapCamera.y]);
  assert.ok(Math.abs(after[0]-(before[0]-40))<1&&Math.abs(after[1]-(before[1]-35))<1,'Touch pan follows the entire gesture');
  assert.equal(await page.evaluate(()=>pendingMoves.length),0);
  await reset();
  await page.evaluate(id=>{const r=state.regions[id];mapCamera.zoomAt(1.5,toSVGX(r.x),toSVGY(r.y));renderMap();},plan.from);
  const counter=await point(plan.from), beforeCounter=await page.evaluate(()=>[mapCamera.x,mapCamera.y]);
  await touchDrag(counter,{x:counter.x-30,y:counter.y-25});
  assert.notDeepEqual(await page.evaluate(()=>[mapCamera.x,mapCamera.y]),beforeCounter);
  assert.equal(await page.evaluate(()=>pendingMoves.length),0,'Touch counter drag only pans');
  assert.equal(await page.evaluate(()=>selectedFrom),null);
  await reset();
  for (const id of [plan.from,plan.to]) {
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await point(id)]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await page.waitForFunction(()=>pendingMoves.length===1);

  await cdp.detach();assert.deepEqual(errors,[]);
  console.log('Escape before drag, arrow tips, selection/forecast through arrows, touch land/counter panning and tap orders passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
