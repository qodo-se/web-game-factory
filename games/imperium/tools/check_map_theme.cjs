const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.IMPERIUM_TEST_URL||'http://localhost:3000';
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light',reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const brightness=()=>page.evaluate(()=>{
   const c=document.getElementById('map-canvas'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let sum=0,n=0;for(let i=0;i<pixels.length;i+=400){sum+=pixels[i]+pixels[i+1]+pixels[i+2];n+=3;}return sum/n;
  });
  for(const preset of ['india','waterloo']) {
   await page.goto(base);await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
   if(preset==='waterloo')await page.click('[data-category="historical"]');
   await page.locator(`input[value="${preset}"]`).check();
   await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);await page.click('#start-btn');
   await page.waitForURL('**/game.html');await page.locator('#load-screen').waitFor({state:'hidden'});
   await page.evaluate(()=>sidebar.open('settings'));
   await page.selectOption('#map-theme','system');await page.emulateMedia({colorScheme:'light'});
   await page.waitForFunction(()=>!interfaceView.darkMap);
   const light=await brightness();
   const saved=await page.evaluate(async()=>JSON.stringify(await api.getGame(gameId)));
   await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>interfaceView.darkMap);
   assert.ok(await brightness()<light*.8);
   await page.screenshot({path:`/tmp/imperium-dark-${preset}.png`});
   await page.selectOption('#map-theme','light');assert.equal(await page.evaluate(()=>interfaceView.darkMap),false);
   await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});
   assert.equal(await page.evaluate(()=>interfaceView.darkMap),false);
   await page.selectOption('#map-theme','dark');await page.emulateMedia({colorScheme:'light'});
   await page.reload();await page.locator('#load-screen').waitFor({state:'hidden'});
   assert.equal(await page.locator('#map-theme').inputValue(),'dark');assert.equal(await page.evaluate(()=>interfaceView.darkMap),true);
   assert.equal(await page.evaluate(async()=>JSON.stringify(await api.getGame(gameId))),saved);
  }
  assert.deepEqual(errors,[]);
  console.log('Regional and historical dark terrain, live system preference, explicit overrides, persistence and unchanged saved campaigns passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
