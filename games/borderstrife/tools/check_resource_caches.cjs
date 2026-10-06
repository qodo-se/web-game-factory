// Deterministic regression tests for request sharing, invalidation and bounded replay storage.
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../ui/js',name),'utf8');
(async()=>{
 const calls=[];
 const context=vm.createContext({AbortController,DOMException,localStorage:{getItem:()=>null},fetch:(url,opts)=>new Promise((resolve,reject)=>{
  calls.push({url,opts,resolve:value=>resolve({ok:true,json:async()=>value}),reject});
  opts.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));
 })});
 vm.runInContext(source('api.js')+';globalThis.cache=forecastCache;',context);
 const c=context.cache,position={turn:1},orders=[{from_region_id:'a',to_region_id:'b'}];
 const abort=new AbortController();
 const a=c.get('g',position,orders,abort.signal).catch(e=>e.name);
 const b=c.get('g',position,orders);
 assert.equal(calls.length,1);abort.abort();calls[0].resolve({turn:1});
 assert.equal(await a,'AbortError');await b;await c.get('g',position,orders);
 assert.equal(calls.length,1);
 let p=c.get('g',position,[]);calls.at(-1).resolve({turn:1});await p;
 await c.get('g',position,orders);assert.equal(calls.length,2); // undo reuses identical orders
 p=c.get('g',{turn:1},orders);calls.at(-1).resolve({turn:1});await p;assert.equal(calls.length,3);
 const next={turn:2};p=c.get('g',next,orders).catch(e=>e.message);calls.at(-1).resolve({turn:1});
 assert.match(await p,/Campaign changed/);assert.equal(c.entries.size,0);
 p=c.get('g',next,orders);calls.at(-1).resolve({turn:2});await p;
 const stale=c.get('g',next,[]).catch(e=>e.name);
 p=c.get('other',next,orders);calls.at(-1).resolve({turn:2});await p;assert.equal(await stale,'AbortError');
 c.clear();p=c.get('g',next,orders).catch(e=>e.message);calls.at(-1).reject(Error('offline'));await p;
 assert.equal(c.entries.size,0);
 p=c.get('g',next,orders);calls.at(-1).resolve({turn:2});await p;
 for(let i=0;i<40;i++){p=c.get('g',next,[{from_region_id:'a',to_region_id:String(i)}]);calls.at(-1).resolve({turn:2});await p;}
 assert.equal(c.entries.size,32);
 const controller=new AbortController();controller.abort();const count=calls.length;
 await assert.rejects(c.get('g',next,orders,controller.signal),{name:'AbortError'});assert.equal(calls.length,count);
 c.clear();assert.equal(c.entries.size,0);
 const replayContext=vm.createContext({});vm.runInContext(source('campaign-replay.js')+';globalThis.replay=campaignReplay;',replayContext);
 const r=replayContext.replay;
 const page=offset=>({offset,total:1001,complete:true,frames:Array.from({length:Math.min(50,1001-offset)},(_,i)=>({turn:offset+i+1})),history:Array.from({length:50},(_,i)=>({turn:offset+i}))});
 for(let offset=0;offset<1001;offset+=50){r.seekTarget=offset;r.storePage(page(offset));r.index=offset;assert.ok(r.pages.size<=3);assert.ok(Object.keys(r.frames).length<=150);assert.ok(r.reports.size<=150);}
 assert.equal(r.frames.length,1001);assert.equal(r.frames[0],undefined);
 r.seekTarget=500;r.storePage(page(500));r.storePage(page(450));r.storePage(page(200));
 assert.ok(r.frames[500]);assert.ok(r.frames[499]);assert.ok(r.frames[1000]);assert.equal(r.frames[200],undefined);
 r.seekTarget=0;r.storePage(page(0));assert.ok(r.frames[0]);assert.ok(r.pages.size<=3);
 console.log('PASS: forecast deduplication, undo, invalidation, cancellation, retry, capacity; 1,001-frame replay eviction and seek pinning');
})().catch(e=>{console.error(e);process.exitCode=1;});
