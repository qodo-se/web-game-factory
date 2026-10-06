const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const calls=[];
const context=vm.createContext({AbortController,DOMException,structuredClone,localStorage:{getItem:()=>null},fetch:(url,options)=>new Promise((resolve,reject)=>{
 calls.push({url,resolve:value=>resolve({ok:true,json:async()=>value}),reject});
 options.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));
})});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/js/api.js'),'utf8')+';globalThis.client=api;globalThis.starts=startingChoicesCache;globalThis.threats=threatCache;',context);
(async()=>{
 const {client,starts,threats}=context;
 const choices=[{id:null,name:'Recommended',regions:['A'],army:100}];
 let a=client.getStarts('india','v1'),b=client.getStarts('india','v1');assert.equal(calls.length,1);calls.at(-1).resolve(choices);
 const first=await a,second=await b;first[0].regions.length=0;assert.equal(second[0].regions.length,1);await client.getStarts('india','v1');assert.equal(calls.length,1);
 a=client.getStarts('india','v2');calls.at(-1).resolve(choices);await a;assert.equal(calls.length,2);
 a=client.getStarts('broken','v1');calls.at(-1).reject(Error('offline'));await assert.rejects(a);
 a=client.getStarts('broken','v1');calls.at(-1).resolve([]);await assert.rejects(a);
 a=client.getStarts('broken','v1');calls.at(-1).resolve(choices);await a;
 a=client.getPresets();calls.at(-1).resolve([]);await a;assert.equal(starts.entries.size,0);
 for(let i=0;i<40;i++){a=client.getStarts(String(i),'v1');calls.at(-1).resolve(choices);await a;}assert.equal(starts.entries.size,32);
 const state={turn:1},moves=[{from_region_id:1,to_region_id:2}];const before=calls.length;
 const controller=new AbortController();a=client.threats('g',moves,controller.signal,state).catch(e=>e.name);b=client.threats('g',[{...moves[0],standing_id:'ignored'}],undefined,state);
 assert.ok(calls.at(-1).url.endsWith('/threats'));assert.equal(calls.length,before+1);controller.abort();calls.at(-1).resolve({turn:1,entries:[],warnings:[]});assert.equal(await a,'AbortError');await b;
 await client.threats('g',moves,undefined,state);assert.equal(calls.length,before+1);
 a=client.threats('g',[],undefined,state);calls.at(-1).resolve({turn:1,entries:[],warnings:[]});await a;
 await client.threats('g',moves,undefined,state);assert.equal(calls.length,before+2);
 a=client.threats('g',moves,undefined,{turn:1});calls.at(-1).resolve({turn:1});await a;assert.equal(calls.length,before+3);
 a=client.threats('other',moves,undefined,state);calls.at(-1).resolve({turn:1});await a;assert.equal(calls.length,before+4);
 threats.clear();a=client.threats('g',moves,undefined,state);calls.at(-1).reject(Error('offline'));await assert.rejects(a);assert.equal(threats.entries.size,0);
 a=client.threats('g',moves,undefined,state);calls.at(-1).resolve({turn:2});await assert.rejects(a);assert.equal(threats.entries.size,0);
 for(let i=0;i<40;i++){a=client.threats('g',[{from_region_id:i,to_region_id:i+1}],undefined,state);calls.at(-1).resolve({turn:1});await a;}
 assert.equal(threats.entries.size,32);threats.clear();assert.equal(threats.entries.size,0);
 console.log('PASS: bounded starting-choice/threat caches, request sharing, version/catalog/snapshot/campaign invalidation, isolated choice data, normalized orders, cancellation and retry');
})().catch(e=>{console.error(e);process.exitCode=1});
