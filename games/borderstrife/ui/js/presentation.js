const presentation = {
    muted: localStorage.getItem('imperium-muted') !== 'false',
    skip: false,
    speed: 'fast',
    init() {
        const speed=document.getElementById('turn-speed');
        const saved=interfaceView.read('turn-speed','fast');
        this.speed=['fast','normal','instant'].includes(saved)?saved:'fast';
        speed.value=this.speed;
        speed.addEventListener('change',()=>{this.speed=speed.value;interfaceView.save('turn-speed',this.speed);});
        const sound=document.getElementById('sound-toggle');
        const update=()=>{sound.textContent=this.muted?'Sound off':'Sound on';sound.setAttribute('aria-pressed',String(!this.muted));};
        update();sound.addEventListener('click',()=>{this.muted=!this.muted;localStorage.setItem('imperium-muted',String(this.muted));update();this.tone('move');});
        document.getElementById('skip-replay').addEventListener('click',()=>{this.skip=true;});
    },
    tone(kind) {
        if(this.muted) return;
        try {
            const Context=window.AudioContext||window.webkitAudioContext;
            if(!Context)return;
            this.audio ||= new Context();this.audio.resume().catch(()=>{});
            const oscillator=this.audio.createOscillator(), gain=this.audio.createGain(), now=this.audio.currentTime;
            oscillator.type=kind==='battle'?'triangle':'sine';
            oscillator.frequency.setValueAtTime(kind==='battle'?140:440,now);
            oscillator.frequency.exponentialRampToValueAtTime(kind==='battle'?65:620,now+.12);
            gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.01);
            gain.gain.exponentialRampToValueAtTime(.0001,now+.18);
            oscillator.connect(gain);gain.connect(this.audio.destination);oscillator.start();oscillator.stop(now+.2);
            oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
        }catch{/* Audio availability never blocks a turn. */}
    },
    circles(entries) {
        const layer=document.getElementById('g-replay');
        entries.forEach((attrs,index)=>{
            let node=layer.children[index];
            if(!node){node=svgEl('circle',{});layer.append(node);}
            svgLayers.attributes(node,attrs);
        });
        while(layer.children.length>entries.length)layer.lastChild.remove();
    },
    async animate(duration, draw) {
        const start=performance.now();
        while(!this.skip && !document.hidden) {
            const progress=Math.min(1,(performance.now()-start)/duration);draw(progress);
            if(progress===1)return;
            await new Promise(resolve=>setTimeout(resolve,16));
        }
    },
    async replay(result) {
        if(this.speed==='instant' || matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden)return;
        const fast=this.speed==='fast';
        this.skip=false;
        const controls=document.getElementById('replay-controls'), caption=document.getElementById('replay-caption');
        const layer=document.getElementById('g-replay');
        controls.hidden=false;
        try {
            const events=result.events||[];
            const movements=events.filter(e=>e.type==='movement');
            const battles=events.filter(e=>e.type==='battle');
            const retreats=events.filter(e=>e.type==='retreat');
            for(const [label,orders] of [['Armies advancing',movements],['Armies retreating',retreats]]) {
                if(label==='Armies retreating' || !orders.length)continue;
                caption.textContent=label;this.tone('move');
                await this.animate(fast?180:850,t=>{
                    const circles=[];
                    for(const e of orders){
                        const a=state.regions[e.from],b=state.regions[e.to];if(!a||!b)continue;
                        const x=toSVGX(a.x)+(toSVGX(b.x)-toSVGX(a.x))*t;
                        const y=toSVGY(a.y)+(toSVGY(b.y)-toSVGY(a.y))*t;
                        circles.push({cx:x,cy:y,r:5,fill:e.owner==='player_1'?'#87b7e4':'#e6a18e',stroke:'#f3e4bd','stroke-width':1});
                    }
                    this.circles(circles);
                });
            }
            layer.replaceChildren();
            if(fast && battles.length && !this.skip) {
                caption.textContent=`${battles.length} battle${battles.length===1?'':'s'} resolved`;
                this.tone('battle');
                for(const e of battles){const r=state.regions[e.to];if(e.won)r.owner=e.owner;r.army=e.army;}
                renderMap();
                await this.animate(320,t=>{
                    this.circles(battles.map(e=>{const r=state.regions[e.to];return {
                        cx:toSVGX(r.x),cy:toSVGY(r.y),r:18+t*18,fill:'none',
                        stroke:e.won?'#eed18a':'#b7c5c8','stroke-width':2,opacity:1-t};}));
                });
            }
            for(const e of fast?[]:battles){
                if(this.skip)break;
                const r=state.regions[e.to];
                caption.textContent=`${r.name}: ${e.won?'captured':'held'} · losses ${e.attacker_losses} / ${e.defender_losses}`;
                this.tone('battle');
                if(e.won)r.owner=e.owner;r.army=e.army;renderMap();
                await this.animate(Math.max(140,Math.min(500,4000/Math.max(1,battles.length))),t=>{
                    this.circles([{cx:toSVGX(r.x),cy:toSVGY(r.y),r:18+t*18,
                        fill:'none',stroke:e.won?'#eed18a':'#b7c5c8','stroke-width':2,opacity:1-t}]);
                });
            }
            if(retreats.length && !this.skip){
                caption.textContent='Survivors returning to friendly territory';
                await this.animate(fast?140:600,t=>{
                    this.circles(retreats.map(e=>{
                        const a=state.regions[e.from],b=state.regions[e.to];
                        return {cx:toSVGX(a.x)+(toSVGX(b.x)-toSVGX(a.x))*t,
                            cy:toSVGY(a.y)+(toSVGY(b.y)-toSVGY(a.y))*t,r:4,fill:'#d7c398'};
                    }));
                });
            }
        } finally {layer.replaceChildren();controls.hidden=true;}
    },
};
