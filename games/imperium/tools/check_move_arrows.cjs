// Live browser regression for short arrows, reverse orders, zoom and resizing.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('IMPERIUM_API_BASE','http://127.0.0.1:8080'));
  await page.goto('http://localhost:3000');
  await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
  await page.locator('#preset-select').selectOption('india');await page.locator('#start-btn').click();
  await page.waitForFunction(()=>typeof atlas!=='undefined'&&atlas.geometry);
  for(const viewport of [{width:1440,height:1000},{width:1024,height:768},{width:800,height:900}]){
   await page.setViewportSize(viewport);
   await page.waitForFunction(()=>atlas.layout.w===document.getElementById('map-canvas').clientWidth);
   for(const zoom of [1,2,5]){
    const results=await page.evaluate(zoom=>{
     mapCamera.zoomAt(zoom,300,300);renderMap();
     pendingMoves=Object.values(state.regions).flatMap(r=>r.neighbors.map(to=>({from_region_id:r.id,to_region_id:to})));
     renderMap();
     const matrix=document.getElementById('map-svg').getScreenCTM();
     const screen=p=>new DOMPoint(p.x,p.y).matrixTransform(matrix);
     const failures=[];
     for(const arrow of document.querySelectorAll('.planned-arrow')){
      const from=state.regions[arrow.dataset.from],to=state.regions[arrow.dataset.to];
      const a=screen({x:toSVGX(from.x),y:toSVGY(from.y)}),b=screen({x:toSVGX(to.x),y:toSVGY(to.y)});
      const points=arrow.querySelector('polygon').points;
      const tip=screen(points.getItem(0)),left=screen(points.getItem(1)),right=screen(points.getItem(2));
      const base={x:(left.x+right.x)/2,y:(left.y+right.y)/2};
      if((tip.x-base.x)*(b.x-a.x)+(tip.y-base.y)*(b.y-a.y)<=0)failures.push([from.name,to.name,'reversed']);
      if(Math.hypot(tip.x-b.x,tip.y-b.y)>Math.hypot(base.x-b.x,base.y-b.y))failures.push([from.name,to.name,'head points away']);
      if(![tip.x,tip.y,base.x,base.y].every(Number.isFinite))failures.push(['invalid geometry']);
     }
     return {failures,count:document.querySelectorAll('.planned-arrow').length,expected:pendingMoves.length};
    },zoom);
    assert.deepEqual(results.failures,[]);assert.equal(results.count,results.expected);
   }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{mapCamera.reset();pendingMoves=[{from_region_id:5,to_region_id:6},{from_region_id:6,to_region_id:7}];renderMap();});
  await page.screenshot({path:'/tmp/imperium-planned-arrows.png'});
  // Random-map SVGs have a nonuniform viewBox scale; screen-space direction
  // and arrowhead geometry must remain correct there too.
  await page.evaluate(async()=>{
   const data=await api.newGame({mode:'random',map_size:'small'});
   sessionStorage.setItem('gameId',data.game_id);sessionStorage.removeItem('presetId');
  });
  await page.goto('http://localhost:3000/game.html');
  await page.waitForFunction(()=>state&&scaleCache);
  assert.equal(await page.evaluate(()=>atlas.data),null);
  const randomCheck=await page.evaluate(()=>{
   mapCamera.zoomAt(3,300,300);
   pendingMoves=Object.values(state.regions).flatMap(r=>r.neighbors.map(to=>({from_region_id:r.id,to_region_id:to})));renderMap();
   const matrix=document.getElementById('map-svg').getScreenCTM();
   for(const g of document.querySelectorAll('.planned-arrow')){
    const from=state.regions[g.dataset.from],to=state.regions[g.dataset.to];
    const a=new DOMPoint(toSVGX(from.x),toSVGY(from.y)).matrixTransform(matrix);
    const b=new DOMPoint(toSVGX(to.x),toSVGY(to.y)).matrixTransform(matrix);
    const p=g.querySelector('polygon').points;
    const tip=new DOMPoint(p[0].x,p[0].y).matrixTransform(matrix);
    const base=new DOMPoint((p[1].x+p[2].x)/2,(p[1].y+p[2].y)/2).matrixTransform(matrix);
    if((tip.x-base.x)*(b.x-a.x)+(tip.y-base.y)*(b.y-a.y)<=0)return false;
   }
   return true;
  });
  assert.ok(randomCheck);assert.deepEqual(errors,[]);
  console.log('Arrow direction passed for every India route in both directions at 3 sizes × 3 zoom levels, plus nonuniformly scaled random maps.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
