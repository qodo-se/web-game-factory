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
   const download=page.waitForEvent('download');
   await page.locator(game.state.game_over?'#download-completed':'#download-campaign').click();
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
  // Planning reveals orders; resolved turns restore the report, including repeated turns.
  await page.evaluate(()=>{
   sidebar.open('battles');
   const source=Object.keys(validMoves).map(Number).find(id=>state.regions[id].owner==='player_1'&&validMoves[id].length);
   handleRegionClick(source);
  });
  assert.equal(await page.locator('#sidebar-orders-toggle').getAttribute('aria-expanded'),'true');
  await page.evaluate(()=>{sidebar.open('battles');standingOrders.start(null,selectedFrom);});
  assert.equal(await page.locator('#sidebar-orders-toggle').getAttribute('aria-expanded'),'true');
  await page.evaluate(()=>standingOrders.stopEditing());
  for(const width of [320,390,1280]) {
   await page.setViewportSize({width,height:844});
   const exit=await page.locator('#abandon-btn').boundingBox(),save=await page.locator('#download-campaign').boundingBox(),next=await page.locator('#end-turn-btn').boundingBox();
   assert.ok(exit.x+exit.width<=save.x&&save.x+save.width<=next.x);
   assert.ok(next.x+next.width<=width&&next.y+next.height<=844);
  }
  await page.evaluate(()=>setResolving(true));assert.ok(await page.locator('#download-campaign').isDisabled());await page.evaluate(()=>setResolving(false));
  await page.route('**/download',route=>route.fulfill({status:503,json:{detail:'Download unavailable. Try again.'}}));
  await page.click('#download-campaign');await page.waitForFunction(()=>document.getElementById('download-status').textContent.includes('unavailable'));
  assert.equal(await page.locator('#download-campaign').isDisabled(),false);await page.unroute('**/download');
  for(let turn=2;turn<=3;turn++) {
   await page.evaluate(()=>sidebar.open('orders'));
   await page.locator('#end-turn-btn').click();await page.waitForFunction(turn=>state.turn===turn&&!resolving,turn);
   assert.equal(await page.locator('#sidebar-battles-toggle').getAttribute('aria-expanded'),'true');
  }

  const original=await (await page.request.get(`${base}/api/imperium/games/${ongoing.game_id}?history_limit=1`)).json();assert.equal(original.state.turn,1);
  // Derive a completed regional fixture from a real resolved-turn download.
  // Restore validates and persists it through the same public save-file flow.
  const downloadResponse=await page.request.get(`${base}/api/imperium/games/${restored.id}/download`);
  const finishedFile=await downloadResponse.json();
  finishedFile.campaign.state.game_over=true;finishedFile.campaign.state.winner='player_1';
  for(const region of Object.values(finishedFile.campaign.state.regions))region.owner='player_1';
  const finish=await page.request.post(`${base}/api/imperium/games/restore`,{data:finishedFile});assert.ok(finish.ok());
  const completed=await finish.json();
  const replayFile=path.join(temp,'completed.borderstrife.json');await download(completed,replayFile);const replay=await restore(replayFile);
  assert.equal(replay.finished,true);await page.waitForFunction(()=>campaignReplay.active&&campaignReplay.index===0);
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>campaignReplay.index===1);
  await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>campaignReplay.index===0);
  // Resignation belongs to the saved campaign, even while viewing an early replay frame.
  const resignResponse=await page.request.post(`${base}/api/imperium/games/${restored.id}/resign`,{data:{expected_turn:3}});
  assert.ok(resignResponse.ok());const resigned=await resignResponse.json();
  await open({game_id:restored.id,state:resigned.state});
  await page.click('#replay-campaign');await page.waitForFunction(()=>campaignReplay.active&&state.turn===1);
  // Model a partially loaded journal and exercise the actual older-history request.
  await page.evaluate(()=>{campaignHistory=campaignHistory.slice(-1);historyMore=true;renderTimeline();sidebar.open('timeline');});
  await page.click('#history-more');await page.waitForFunction(()=>!historyLoading);
  assert.deepEqual(await page.evaluate(()=>campaignHistory.map(entry=>entry.turn)),[1,2]);
  assert.match(await page.locator('#timeline-list').textContent(),/Turn 3 · Resigned/);
  assert.doesNotMatch(await page.locator('#timeline-list').textContent(),/Turn 1 · Resigned/);
  await page.click('#campaign-replay-exit');
  assert.match(await page.locator('#timeline-list').textContent(),/Turn 3 · Resigned/);
  await page.goto(base);await page.click('#resume-game-tab');
  await page.locator('#restore-campaign').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await page.waitForFunction(()=>document.getElementById('restore-status').textContent.includes('not a valid'));
  assert.equal(await page.locator('#restore-campaign').isDisabled(),false);
  await page.setViewportSize({width:375,height:667});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);console.log('PASS: in-game and completed downloads, error recovery, planning/report panels, mobile action bar, restore, completed replay and keyboard controls');
 } finally {await browser.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
