const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:375,height:667}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(ui);await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
 const initial=await page.locator('#map-grid img[src]').count();assert.ok(initial>0&&initial<16,`Loaded ${initial} thumbnails`);
 await page.evaluate(()=>{const g=document.getElementById('map-grid');g.scrollTop=g.scrollHeight;});
 await page.waitForFunction(()=>{const img=document.querySelector('#map-grid .map-card:last-child img');return img.complete&&img.naturalWidth>0});
 await page.locator('#map-grid .map-card:last-child input').check();
 await page.waitForFunction(()=>document.getElementById('selected-map-preview').complete&&document.getElementById('selected-map-preview').naturalWidth>0);
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(async()=>{const game=await api.newGame({preset_id:'india'});sessionStorage.setItem('gameId',game.game_id)});
 await page.goto(ui+'/game.html');await page.waitForFunction(()=>typeof state!=='undefined'&&!!state&&!document.getElementById('main').inert);
 const stats=await page.evaluate(async()=>{
  const check=(ok,message)=>{if(!ok)throw Error(message)};
  const prepare=atlas.prepare;let builds=0;
  atlas.prepare=function(...args){if(this.geometry?.w!==document.getElementById('map-canvas').clientWidth)builds++;return prepare.apply(this,args)};
  for(let width=260;width<=360;width+=5){document.documentElement.style.setProperty('--sidebar-width',width+'px');await new Promise(r=>setTimeout(r,25));}
  await new Promise(r=>setTimeout(r,350));
  check(builds<=2,`Resize rebuilt ${builds} times`);
  check(atlas.geometry.w===document.getElementById('map-canvas').clientWidth,'Resize did not settle');
  for(const marker of atlas.markers)check(atlas.hit(marker.x/atlas.geometry.w,marker.y/atlas.geometry.h)===marker.id,'Hit grid misaligned');
  atlas.prepare=prepare;
  const movements=Object.values(state.regions).map(r=>({type:'movement',from:r.id,to:r.neighbors[0],owner:r.owner}));
  let added=0;const layer=document.getElementById('g-replay');const observer=new MutationObserver(records=>{added+=records.reduce((n,r)=>n+r.addedNodes.length,0)});observer.observe(layer,{childList:true});
  presentation.speed='normal';await presentation.replay({events:movements});
  added+=observer.takeRecords().reduce((n,r)=>n+r.addedNodes.length,0);observer.disconnect();
  check(added===movements.length,`Animation allocated ${added} nodes`);check(!layer.children.length,'Animation leaked markers');
  const animate=presentation.animate;let frames=0;
  presentation.animate=async function(duration,draw){
   draw(0);const nodes=[...layer.children];draw(.5);
   check(nodes.every((n,i)=>layer.children[i]===n),'Animation replaced nodes within phase');
   for(const node of nodes){check(Number.isFinite(+node.getAttribute('cx'))&&Number.isFinite(+node.getAttribute('cy')),'Invalid marker coordinates');}
   draw(1);frames++;
  };
  const r=state.regions[0];const events=[...movements,{type:'battle',to:0,won:true,owner:r.owner,army:r.army,attacker_losses:0,defender_losses:0},{type:'retreat',from:0,to:r.neighbors[0]}];
  for(const speed of ['normal','fast']){presentation.speed=speed;await presentation.replay({events});}
  check(frames===6,'Missing animation phase');check(!layer.children.length,'Phase cleanup failed');
  presentation.animate=animate;
  presentation.speed='instant';await presentation.replay({events});check(!layer.children.length,'Instant animation drew markers');
  presentation.speed='normal';setTimeout(()=>{presentation.skip=true},30);await presentation.replay({events});check(!layer.children.length&&document.getElementById('replay-controls').hidden,'Skip cleanup failed');
  return {builds,added,phases:frames};
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.evaluate(async()=>{await presentation.replay({events:[{type:'movement',from:0,to:1}]});return document.getElementById('g-replay').children.length}),0);
 assert.deepEqual(errors,[]);console.log('PASS: deferred mobile thumbnails, scrolling/selection, bounded resizing, hit alignment, animation identity/phases/skip/reduced motion', {initialThumbnails:initial,...stats});
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
