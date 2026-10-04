// Small transient overlays; pointer movement never repaints the terrain.
const planning = {
    drag: null, frame: 0, target: null,
    allowed() { return state && !resolving && !gameOver && !campaignReplay.active; },
    regionAt(event) {
        const viewport = document.getElementById('map-container').getBoundingClientRect();
        if (event.clientX < viewport.left || event.clientX >= viewport.right ||
            event.clientY < viewport.top || event.clientY >= viewport.bottom) return -1;
        const box = document.getElementById('map-canvas').getBoundingClientRect();
        const x = (event.clientX-box.left)/box.width, y = (event.clientY-box.top)/box.height;
        return x<0 || y<0 || x>1 || y>1 ? -1 : findNearestRegionId(x,y);
    },
    sourceAt(event) {
        if (!this.allowed() || event.button !== 0 || event.shiftKey) return null;
        const id = this.regionAt(event), r = state.regions[id];
        return r?.owner==='player_1' && validMoves[id]?.length && !pendingMoves.some(m=>m.from_region_id===id) ? id : null;
    },
    begin(id) {
        if (!this.allowed()) return;
        this.drag={from:id}; selectedFrom=id;
        clearRegionInfo(); lastHoverId=null;
        renderMap(); updateMoveHint();
    },
    move(event) {
        if (!this.drag) return;
        this.point={clientX:event.clientX,clientY:event.clientY};
        if (this.frame) return;
        this.frame=requestAnimationFrame(()=>{ this.frame=0; this.drawDrag(); });
    },
    drawDrag() {
        if (!this.drag || !this.allowed()) return;
        const id=this.regionAt(this.point), valid=(validMoves[this.drag.from]||[]).includes(id);
        if (id!==this.target) {
            this.target=id;
            if (valid) updateRegionInfo(id); else clearRegionInfo();
        }
        const matrix=document.getElementById('map-svg').getScreenCTM();
        const from=state.regions[this.drag.from];
        const a=new DOMPoint(toSVGX(from.x),toSVGY(from.y)).matrixTransform(matrix);
        const inv=matrix.inverse();
        const start=new DOMPoint(a.x,a.y).matrixTransform(inv);
        const end=new DOMPoint(this.point.clientX,this.point.clientY).matrixTransform(inv);
        document.getElementById('g-planning').replaceChildren(svgEl('path',{
            d:`M${start.x} ${start.y} L${end.x} ${end.y}`,fill:'none',
            stroke:valid?'#ffe09a':'#e18d78','stroke-width':3,'stroke-dasharray':'6 5',
            'vector-effect':'non-scaling-stroke'}));
        document.getElementById('map-canvas').style.cursor=valid?'crosshair':'not-allowed';
    },
    finish(event, cancelled=false) {
        if (!this.drag) return;
        const from=this.drag.from, to=this.regionAt(event);
        this.clearDrag();
        if (!cancelled && this.allowed() && (validMoves[from]||[]).includes(to)) {
            selectedFrom=from; handleRegionClick(to);
        } else {
            selectedFrom=null; clearRegionInfo(); renderMap(); updateMoveHint();
        }
    },
    clearDrag() {
        this.drag=null; this.target=null; cancelAnimationFrame(this.frame); this.frame=0;
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
            this.clearDrag(); selectedFrom=null; clearRegionInfo(); lastHoverId=null;
            renderMap(); updateMoveHint();
        });
        document.getElementById('map-canvas').addEventListener('mouseleave',()=>{
            if(!this.drag){clearRegionInfo();lastHoverId=null;}
        });
    }
};
