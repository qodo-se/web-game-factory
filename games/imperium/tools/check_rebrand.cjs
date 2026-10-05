// Run against a local nginx preview of website/nginx.conf, backed by the local API.
// BORDERSTRIFE_TEST_URL=http://127.0.0.1:3011 node games/imperium/tools/check_rebrand.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.BORDERSTRIFE_TEST_URL||'http://127.0.0.1:3011';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use a local preview only.');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [old,next] of [
   ['/imperium','/borderstrife/'],
   ['/imperium/','/borderstrife/'],
   ['/imperium/game.html?campaign=abc&turn=3','/borderstrife/game.html?campaign=abc&turn=3'],
   ['/imperium/maps/india.json','/borderstrife/maps/india.json'],
   ['/borderstrife?resume=yes','/borderstrife/?resume=yes'],
  ]){
   const r=await page.request.get(base+old,{maxRedirects:0});
   assert.equal(r.status(),308,old);
   assert.equal(new URL(r.headers().location,base).href,base+next);
  }
  assert.equal((await page.request.get(base+'/borderstrife/missing.js')).status(),404);
  for(const asset of ['favicon.svg','social-card.png','maps/india.json'])
   assert.equal((await page.request.get(base+'/borderstrife/'+asset)).status(),200,asset);
  await page.goto(base);
  await page.getByRole('link',{name:/BorderStrife/}).click();
  assert.equal(await page.title(),'BorderStrife — Turn-Based Conquest');
  const response=await page.request.post(base+'/api/imperium/games',{data:{preset_id:'india',campaign_name:'Pre-rebrand campaign'}});
  assert.equal(response.ok(),true);
  const data=await response.json();
  const id=data.game_id;
  assert.ok(id);
  // Seed the original browser keys: the rename must not orphan existing saves or preferences.
  await page.evaluate(({id,state})=>{
   localStorage.setItem(`imperium-campaigns:${location.origin}`,JSON.stringify([{id,name:'Pre-rebrand campaign',turn:state.turn,finished:false}]));
   localStorage.setItem('imperium-ui-labels','large');
   localStorage.setItem('imperium-map-input-mode','touchpad');
  },{id,state:data.state});
  await page.goto(base+'/imperium/');
  assert.equal(new URL(page.url()).pathname,'/borderstrife/');
  await page.getByRole('button',{name:/Pre-rebrand campaign/}).click();
  await page.waitForFunction(()=>typeof state!=='undefined'&&state&&!document.getElementById('load-screen').offsetHeight);
  assert.equal(await page.locator('.game-title').textContent(),'BorderStrife');
  assert.equal(await page.locator('#label-size').inputValue(),'large');
  assert.equal(await page.evaluate(()=>gameId),id);
  assert.equal(await page.evaluate(()=>mapCamera.inputMode),'touchpad');
  await page.locator('#end-turn-btn').click();
  await page.waitForFunction(()=>state.turn===2&&!resolving);
  await page.goto(base+'/imperium/game.html?resume=legacy#map');
  await page.waitForFunction(()=>typeof state!=='undefined'&&state?.turn===2);
  assert.equal(new URL(page.url()).hash,'#map');
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:900});
   await page.goto(base+'/borderstrife/');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}px`);
   await page.screenshot({path:`/tmp/borderstrife-${width}.png`});
  }
  assert.deepEqual(errors,[]);
  console.log('Rebrand checks passed: redirects, assets, legacy saves/preferences, turns, and responsive branding.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
