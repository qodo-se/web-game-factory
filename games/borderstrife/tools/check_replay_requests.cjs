// Deterministic delayed-network tests of the actual replay seek implementation.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const nodes=new Map();const calls=[];let live=0,peak=0;
const context=vm.createContext({
 api:{getReplay:(id,offset)=>new Promise((resolve,reject)=>{live++;peak=Math.max(peak,live);calls.push({offset,resolve:data=>{live--;resolve(data)},reject:error=>{live--;reject(error)}})})},gameId:'test',
 document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{setAttribute(){},replaceChildren(){},textContent:''});return nodes.get(id)}},
 updateTopBar(){},renderMap(){},updateMovesList(){},clearRegionInfo(){},showCombatLog(){},lastHoverId:null,campaignHistory:[],state:{},
 clearTimeout(){},setTimeout(){},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/js/campaign-replay.js'),'utf8')+';globalThis.r=campaignReplay;',context);
const page=offset=>({offset,total:1001,complete:true,frames:Array.from({length:Math.min(50,1001-offset)},(_,i)=>({turn:offset+i+1,regions:{0:{owner:'player_1',army:10}}})),history:[]});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const r=context.r;r.active=true;r.finalState={regions:{0:{id:0,name:'Origin'}}};r.storePage(page(0));
 const seeks=[];for(let i=1;i<=19;i++)seeks.push(r.show(i*50));
 await tick();assert.deepEqual(calls.map(c=>c.offset),[50,100]);assert.equal(r.queuedPage.offset,950);assert.equal(r.requests.size,2);
 calls[0].resolve(page(50));await tick();assert.deepEqual(calls.map(c=>c.offset),[50,100,950]);
 calls[2].resolve(page(950));await tick();assert.equal(r.index,950);
 calls[1].resolve(page(100));await Promise.all(seeks);await tick();assert.equal(r.index,950);assert.equal(peak,2);assert.equal(r.requests.size,0);
 // Previous position is fetched for a legacy movement at a page boundary.
 const boundary=r.show(500);await tick();const data=page(500);data.history=[{turn:500,movements:[[0,1,10]]}];calls.at(-1).resolve(data);await tick();assert.equal(calls.at(-1).offset,450);
 calls.at(-1).resolve(page(450));await boundary;assert.equal(r.index,500);assert.equal(r.movements()[0].owner,'player_1');
 // Failure frees capacity and allows retry of the same page.
 const failing=r.show(700);await tick();calls.at(-1).reject(Error('Offline'));await failing;await tick();assert.equal(r.requests.size,0);
 const retry=r.show(700);await tick();calls.at(-1).resolve(page(700));await retry;await tick();assert.equal(r.index,700);
 // Pause clears queued work; outstanding requests remain bounded and may finish.
 const a=r.show(200),b=r.show(250),c=r.show(300);await tick();const count=calls.length;
 r.pause();assert.equal(r.queuedPage,null);
 calls[count-2].resolve(page(200));calls[count-1].resolve(page(250));await Promise.all([a,b,c]);await tick();assert.equal(calls.length,count);assert.equal(r.index,700);
 // Re-entry may wait behind requests from the previous session. A visibility
 // pause while loading must not cancel the entry page.
 const oldA=r.fetchPage(50),oldB=r.fetchPage(100);await tick();
 r.pause();r.active=false;r.loading=true;r.seekTarget=0;
 const entry=r.fetchPage(0);r.pause();assert.equal(r.queuedPage.offset,0);
 const oldCount=calls.length;calls[oldCount-2].resolve(page(50));await tick();
 assert.equal(calls.at(-1).offset,0);calls.at(-1).resolve(page(0));calls[oldCount-1].resolve(page(100));
 await Promise.all([oldA,oldB,entry]);await tick();assert.ok(r.frames[0]);assert.equal(peak,2);
 console.log('PASS: at most two replay requests, latest-only queue, out-of-order completion, legacy boundary arrows, failure/retry and pause');
})().catch(error=>{console.error(error);process.exitCode=1});
