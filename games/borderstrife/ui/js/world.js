// Decorative vector layers stay independent of hit testing and army counters.
const world = {
    cache: null,
    render() {
        const group = document.getElementById('g-atmosphere');
        const enabled = document.getElementById('show-atmosphere').checked;
        group.style.display = enabled ? '' : 'none';
        if (!atlas.data || !enabled || this.cache === atlas.geometry) return;
        this.cache = atlas.geometry;
        if (atlas.data.category === 'historical'||atlas.data.inland_frame) { group.replaceChildren(); return; }
        const {w,h,idxMap} = atlas.geometry;
        // Place sparse waves wholly inside water using the existing hit grid.
        // No animated geographic masks or duplicated coastline geometry.
        const ocean = (x,y) => x>=0 && y>=0 && x<w && y<h && idxMap[Math.floor(y)*w+Math.floor(x)]===-1;
        const waves=[];
        for(let y=28;y<h;y+=70) for(let x=18;x<w-58;x+=115) {
            let clear=true;
            for(let dy=-7;dy<=7 && clear;dy+=2) for(let dx=-6;dx<=56;dx+=2) {
                if(!ocean(x+dx,y+dy)){clear=false;break;}
            }
            if(clear)waves.push(`M${x} ${y}q12-5 24 0t24 0`);
        }
        // Static river highlights are already painted into the terrain cache.
        group.innerHTML=`<path class="ocean-wave" d="${waves.join(' ')}" fill="none" stroke="#bfdcd4" stroke-width=".7" opacity=".18"/>`;

    },
    artwork(region) {
        const terrain = region.terrain;
        const scenes = {
            hills:'<path d="M0 90 65 17 120 90 174 31 240 100" fill="#53685b"/><path d="m43 43 22-26 24 32-23-10Z" fill="#bac4ad"/>',
            forest:'<g fill="#354e42"><path d="m25 94 22-65 22 65Zm45 0 26-78 26 78Zm62 0 20-61 20 61Zm38 0 24-76 24 76Z"/></g>',
            desert:'<path d="M0 84 Q55 25 120 82 T240 70V110H0" fill="#ba9d6a"/><path d="M0 100 Q120 53 240 94V110H0" fill="#8e784e"/>',
            coast:'<path d="M0 60H240V110H0" fill="#486d73"/><path d="M0 70Q85 60 120 110H0" fill="#a49c74"/><path d="M140 78h54m-35 14h59" stroke="#bbd0c5" fill="none"/>',
            city:'<path d="M35 94V62H60V43H85V66H112V32H133V63H165V47H188V75H211V100H35" fill="#747864"/><path d="M119 94V77h8v17m44 0V79h8v15" fill="#313d34"/>',
            plains:'<path d="M0 76Q65 42 130 76T240 74V110H0" fill="#82916a"/><path d="M0 99Q115 68 240 94V110H0" fill="#526b4d"/>'
        };
        return `<svg class="region-art" viewBox="0 0 240 110" aria-hidden="true"><rect width="240" height="110" fill="#a5b0a0"/><circle cx="191" cy="24" r="12" fill="#e0c993" opacity=".65"/>${scenes[terrain] || scenes.plains}<path d="M0 106H240" stroke="#d0b473" opacity=".5"/></svg>`;
    }
};

const threatView = {
    data: null, key: '', sequence: 0,
    refresh() {
        const enabled=document.getElementById('show-threats').checked;
        if(!enabled) {
            clearTimeout(this.timer);this.controller?.abort();++this.sequence;
            this.pendingKey=null;this.draw();return;
        }
        const key=JSON.stringify([state.turn,pendingMoves]);
        if(key===this.key&&this.data){this.draw();return;}
        if(key===this.pendingKey)return;
        clearTimeout(this.timer);this.controller?.abort();
        const sequence=++this.sequence;
        this.pendingKey=key;this.data=null;this.draw();
        const orders=pendingMoves.map(move=>({...move}));
        document.getElementById('threat-description').textContent='Checking exposed borders…';
        this.timer=setTimeout(async()=>{
            this.controller=new AbortController();
            try {
                const data=await api.threats(gameId,orders,this.controller.signal);
                if(sequence!==this.sequence||key!==JSON.stringify([state.turn,pendingMoves]))return;
                if(data.turn!==state.turn)throw new Error('Campaign changed. Reload to refresh threats.');
                this.data=data;this.key=key;this.draw();
            } catch(error) {
                if(error.name!=='AbortError'&&sequence===this.sequence)document.getElementById('threat-description').textContent=error.message;
            } finally {if(sequence===this.sequence)this.pendingKey=null;}
        },150);
    },
    draw() {
        const group = document.getElementById('g-threats');
        group.replaceChildren();
        const enabled = document.getElementById('show-threats').checked;
        const description = document.getElementById('threat-description');
        description.hidden = !enabled;
        if (!enabled || !this.data || this.key !== JSON.stringify([state.turn,pendingMoves])) return;
        description.textContent = this.data.entries.length ? 'Border risk: red high · amber medium · pale low. Assumes all adjacent enemy armies attack this region; includes your orders and recruits. These attacks cannot all happen at once.' : 'No regions border an enemy kingdom.';
        for (const entry of this.data.entries) {
            const r = state.regions[entry.region_id];
            const color = {high:'#ff7165',medium:'#e9b95e',low:'#b6cebb'}[entry.level];
            const ring = svgEl('circle',{cx:toSVGX(r.x),cy:toSVGY(r.y),r:26/mapCamera.zoom,fill:'none',stroke:color,'stroke-width':3,'stroke-dasharray':entry.level==='high'?'none':'5 4','vector-effect':'non-scaling-stroke'});
            const title = svgEl('title',{}); title.textContent = `${r.name}: ${Math.round(entry.risk*100)}% potential loss risk; ${entry.garrison} defenders after orders.`;
            ring.appendChild(title); group.appendChild(ring);
        }
    }
};
