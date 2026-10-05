// Small transient overlays; pointer movement never repaints the terrain.
const planning = {
    source() { return standingOrders.editor?.path[0] ?? selectedFrom; },
    targets() {
        const source=this.source();
        if(source===null)return new Set();
        if(standingOrders.editor)return new Set(standingOrders.destinations(source));
        return new Set(validMoves[source]||[]);
    },
    allowed() { return state && !resolving && !gameOver && !campaignReplay.active; },
    regionAt(event) {
        const viewport = document.getElementById('map-container').getBoundingClientRect();
        if (event.clientX < viewport.left || event.clientX >= viewport.right ||
            event.clientY < viewport.top || event.clientY >= viewport.bottom) return -1;
        const box = document.getElementById('map-canvas').getBoundingClientRect();
        const x = (event.clientX-box.left)/box.width, y = (event.clientY-box.top)/box.height;
        return x<0 || y<0 || x>1 || y>1 ? -1 : findNearestRegionId(x,y);
    },
    clearEffects() {
        clearTimeout(this.pulseTimer);
        document.getElementById('g-planning').replaceChildren();
        document.getElementById('map-canvas').style.cursor='default';
    },
    hidePreview() { document.getElementById('planning-preview').hidden=true; },
    preview(id, text) {
        if (!this.allowed() || selectedFrom===null) return this.hidePreview();
        const box=document.getElementById('map-container').getBoundingClientRect();
        const matrix=document.getElementById('map-svg').getScreenCTM();
        const r=state.regions[id];
        const p=new DOMPoint(toSVGX(r.x),toSVGY(r.y)).matrixTransform(matrix);
        const card=document.getElementById('planning-preview');
        card.textContent=text; card.hidden=false;
        card.style.left=`${Math.max(8,Math.min(box.width-card.offsetWidth-8,p.x-box.left+28))}px`;
        card.style.top=`${Math.max(8,Math.min(box.height-card.offsetHeight-8,p.y-box.top+25))}px`;
    },
    pulse(id) {
        const r=state.regions[id];
        const ring=svgEl('circle',{cx:toSVGX(r.x),cy:toSVGY(r.y),r:28/mapCamera.zoom,
            fill:'none',stroke:'#ffe09a','stroke-width':3,'vector-effect':'non-scaling-stroke',class:'order-pulse'});
        document.getElementById('g-planning').replaceChildren(ring);
        clearTimeout(this.pulseTimer);
        this.pulseTimer=setTimeout(()=>ring.remove(),550);
        const arrow=document.querySelector(`.planned-arrow[data-to="${id}"]:last-child`);
        arrow?.classList.add('order-placed');
    },
    projections() {
        const results=new Map();
        if (!this.allowed()) return results;
        for (const move of pendingMoves) {
            const r=state.regions[move.from_region_id];
            results.set(r.id,{...(results.get(r.id)||{incoming:0}),outgoing:true});
            const target=results.get(move.to_region_id)||{incoming:0};
            target.incoming+=r.army+r.pop_rate;
            results.set(move.to_region_id,target);
        }
        return results;
    },
    init() {
        document.addEventListener('keydown',event=>{
            if(event.key!=='Escape' || event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
            if(!this.allowed())return;
            if(standingOrders.editor) {mapCamera.cancelGesture();standingOrders.stopEditing();return;}
            mapCamera.cancelGesture();
            this.clearEffects(); selectedFrom=null; clearRegionInfo(); lastHoverId=null;
            renderMap(); updateMoveHint();
        });
        document.getElementById('map-world').addEventListener('mouseleave',()=>{
            clearRegionInfo();lastHoverId=null;
        });
    }
};
