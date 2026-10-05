// End-to-end portable saves: actual download, import, resume and completed replay.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const base=process.env.IMPERIUM_TEST_URL||'http://127.0.0.1:3000';
(async()=>{
 const browser=await chromium.launch();const temp=await fs.mkdtemp(path.join(os.tmpdir(),'borderstrife-backups-'));
 try {
  const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function create(preset){const response=await page.request.post(`${base}/api/imperium/games`,{data:{preset_id:preset}});assert.ok(response.ok());return response.json();}
  async function open(game){await page.goto(base);await page.evaluate(game=>{campaigns.remember(game.game_id,game.state);sessionStorage.setItem('gameId',game.game_id);},game);await page.goto(`${base}/game.html`);await page.waitForFunction(()=>!!state&&!document.getElementById('main').inert);}
  async function download(game,file){
   await open(game);
   if(game.state.game_over)await page.click('#review-campaign');
   await page.evaluate(()=>sidebar.open('campaign'));
   // Download is also available from Resume game, independently of sidebar state.
   await page.goto(base);await page.click('#resume-game-tab');
   const download=page.waitForEvent('download');
   await page.locator('.campaign-save-row').first().getByRole('button',{name:'Download save'}).click();
   await (await download).saveAs(file);
   const saved=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(saved.format,'borderstrife-save');
  }
  async function restore(file){
   await page.goto(base);await page.click('#resume-game-tab');await page.locator('#restore-campaign').setInputFiles(file);
   await page.waitForURL('**/game.html');await page.waitForFunction(()=>!!state&&!document.getElementById('main').inert);
   return page.evaluate(()=>({id:gameId,turn:state.turn,finished:gameOver,expiry:state.expires_at}));
  }
  const ongoing=await create('india');const file=path.join(temp,'ongoing.borderstrife.json');await download(ongoing,file);
  const restored=await restore(file);assert.notEqual(restored.id,ongoing.game_id);assert.equal(restored.turn,1);assert.equal(restored.finished,false);assert.ok(restored.expiry);
  await page.locator('#end-turn-btn').click();await page.waitForFunction(()=>state.turn===2&&!resolving);
  const original=await (await page.request.get(`${base}/api/imperium/games/${ongoing.game_id}?history_limit=1`)).json();assert.equal(original.state.turn,1);
  // A real historical battle reaches its turn limit without manual actions.
  const completed=await create('waterloo');
  while(!completed.state.game_over){const response=await page.request.post(`${base}/api/imperium/games/${completed.game_id}/turn`,{data:{moves:[],expected_turn:completed.state.turn}});assert.ok(response.ok());completed.state=(await response.json()).state;assert.ok(completed.state.turn<100);}
  const replayFile=path.join(temp,'completed.borderstrife.json');await download(completed,replayFile);const replay=await restore(replayFile);
  assert.equal(replay.finished,true);await page.waitForFunction(()=>campaignReplay.active&&campaignReplay.index===0);
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>campaignReplay.index===1);
  await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>campaignReplay.index===0);
  await page.goto(base);await page.click('#resume-game-tab');
  await page.locator('#restore-campaign').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await page.waitForFunction(()=>document.getElementById('restore-status').textContent.includes('not a valid'));
  assert.equal(await page.locator('#restore-campaign').isDisabled(),false);
  await page.setViewportSize({width:375,height:667});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);console.log('PASS: downloads, resumed game, unchanged original, completed replay, keyboard controls, invalid file and mobile layout');
 } finally {await browser.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
