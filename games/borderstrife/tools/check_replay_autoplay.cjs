// Deterministic async race regression; no live server required.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const timers=new Map();let next=0,finish;
const sandbox={document:{getElementById:()=>({textContent:'',setAttribute(){}})},
 setTimeout:fn=>{timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id)};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/js/campaign-replay.js'),'utf8')+';globalThis.replay=campaignReplay;',sandbox);
(async()=>{
 const replay=sandbox.replay;replay.active=true;replay.frames=[{},undefined,{}];
 replay.show=()=>new Promise(resolve=>{finish=()=>{replay.index=1;resolve()}});
 await replay.play();const advance=timers.get(next);timers.delete(next);
 const pending=advance();replay.pause();await replay.play();finish();await pending;
 assert.equal(timers.size,1,'An old playback generation must not schedule a second timer');
 replay.pause();assert.equal(timers.size,0);
 // Restarting from the end must not resume after the user pauses its seek.
 replay.index=2;const restarting=replay.play();replay.pause();finish();await restarting;
 assert.equal(replay.playing,false);assert.equal(timers.size,0);
 console.log('Pause/resume during page load and cancellation during restart passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
