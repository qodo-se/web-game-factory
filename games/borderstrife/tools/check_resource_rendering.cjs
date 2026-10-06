const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ui=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
(async()=>{
 const browser=await chromium.launch();
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const preset of ['viking_conquests','india','japan_korea','greco_persian']){
  await page.goto(ui);
  await page.evaluate(async preset=>{const g=await api.newGame({preset_id:preset});sessionStorage.setItem('gameId',g.game_id);},preset);
  await page.goto(ui+'/game.html');await page.waitForFunction(()=>!!state&&!document.getElementById('main').inert);
  const result=await page.evaluate(()=>{
   renderMap();const labels=[...document.querySelector('#g-labels').children];
   const observer=new MutationObserver(()=>{});observer.observe(document.querySelector('#map-svg'),{childList:true,subtree:true});
   selectedFrom=Number(Object.keys(validMoves)[0]);const t=performance.now();renderMap();const ms=performance.now()-t;
   const mutations=observer.takeRecords();observer.disconnect();
   const retained=labels.every(n=>n.parentNode===document.querySelector('#g-labels'));
   // Compare the final presentation with the original replace-every-layer path.
   const ids=['g-labels','g-connections','g-terrain-effects'];
   const canonical=n=>n.nodeType===3?n.nodeValue:[n.nodeName,[...n.attributes].map(a=>[a.name,a.value]).sort(),[...n.childNodes].map(canonical)];
   const before=ids.map(id=>canonical(document.getElementById(id)));
   const sync=svgLayers.sync;svgLayers.sync=(parent,children)=>parent.replaceChildren(...children);renderMap();svgLayers.sync=sync;
   const after=ids.map(id=>canonical(document.getElementById(id)));
   return {retained,same:JSON.stringify(before)===JSON.stringify(after),ms,added:mutations.reduce((n,m)=>n+m.addedNodes.length,0),removed:mutations.reduce((n,m)=>n+m.removedNodes.length,0),relief:atlas.geometry.relief?.length};
  });
  assert.equal(result.relief,0);assert.ok(result.retained);assert.ok(result.same);console.log(preset,result);
  await page.evaluate(()=>{const version=atlas.data.presentation_version;delete atlas.data.presentation_version;atlas.geometry=null;atlas.prepare(state.regions);if(atlas.geometry.relief.length!==atlas.geometry.paths.length)throw Error('Legacy relief missing');atlas.data.presentation_version=version;atlas.geometry=null;atlas.prepare(state.regions);});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: SVG label identity, exact presentation parity, map selection rendering, no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
