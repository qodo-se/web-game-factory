// Local browser regression checks for touchpad gestures and saved control preference.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'}));
  await page.goto(base);
  await page.waitForFunction(()=>!document.querySelector('#start-btn').disabled);
  await page.locator('#start-btn').click();
  await page.waitForFunction(()=>typeof atlas!=='undefined'&&atlas.geometry);
  assert.equal(await page.evaluate(()=>mapCamera.inputMode),'touchpad');
  await page.locator('#map-zoom-in').click();await page.locator('#map-zoom-in').click();
  const camera=()=>page.evaluate(()=>({zoom:mapCamera.zoom,x:mapCamera.x,y:mapCamera.y}));
  const wheel=async data=>page.locator('#map-canvas').dispatchEvent('wheel',{clientX:450,clientY:350,bubbles:true,cancelable:true,...data});
  let before=await camera();
  await wheel({deltaY:35,deltaX:0});
  let after=await camera();assert.equal(after.zoom,before.zoom);assert.equal(after.y,before.y-35);
  before=after;await wheel({deltaX:20,deltaY:-15});after=await camera();
  assert.equal(after.zoom,before.zoom);assert.equal(after.x,before.x-20);assert.equal(after.y,before.y+15);
  assert.equal(await page.evaluate(()=>pendingMoves.length),0);
  before=after;await wheel({deltaY:-20,ctrlKey:true});assert.ok((await camera()).zoom>before.zoom);
  // Safari pinch scale is relative to gesturestart, not the previous change.
  const gesture=async(type,scale)=>page.evaluate(({type,scale})=>{
   const event=new Event(type,{bubbles:true,cancelable:true});
   Object.assign(event,{scale,clientX:450,clientY:350});
   document.getElementById('map-canvas').dispatchEvent(event);
   return event.defaultPrevented;
  },{type,scale});
  before=await camera();assert.ok(await gesture('gesturestart',1));
  assert.ok(await gesture('gesturechange',1.1));assert.ok(await gesture('gesturechange',1.2));
  assert.ok(Math.abs((await camera()).zoom-before.zoom*1.2)<1e-8);
  await gesture('gestureend',1.2);
  assert.equal(await page.evaluate(()=>mapCamera.gestureActive),false);
  await page.evaluate(()=>sidebar.open('settings'));
  await page.locator('#map-input-mode').selectOption('mouse');
  before=await camera();await wheel({deltaY:-30});assert.ok((await camera()).zoom>before.zoom);
  await page.reload();await page.waitForFunction(()=>typeof atlas!=='undefined'&&atlas.geometry);
  assert.equal(await page.evaluate(()=>mapCamera.inputMode),'mouse');
  await page.evaluate(()=>sidebar.open('settings'));
  await page.locator('#map-input-mode').selectOption('touchpad');
  await page.reload();await page.waitForFunction(()=>typeof atlas!=='undefined'&&atlas.geometry);
  assert.equal(await page.evaluate(()=>mapCamera.inputMode),'touchpad');
  assert.deepEqual(errors,[]);
  console.log('Mac default, vertical/diagonal pan, pinch wheel, Safari gesture scaling, mouse mode and saved preference passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
