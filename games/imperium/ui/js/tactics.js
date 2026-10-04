// Planning and reporting layers: no terrain repaint required.
const orderHistory = {
    undoStack: [], redoStack: [],
    copy: moves => moves.map(m=>({...m})),
    record(next) {
        if(resolving || gameOver || JSON.stringify(next)===JSON.stringify(pendingMoves))return;
        this.undoStack.push(this.copy(pendingMoves));
        if(this.undoStack.length>100)this.undoStack.shift();
        this.redoStack=[];
        pendingMoves=this.copy(next);
    },
    restore(redo=false) {
        if(resolving || gameOver)return;
        const source=redo?this.redoStack:this.undoStack;
        const destination=redo?this.undoStack:this.redoStack;
        if(!source.length)return;
        destination.push(this.copy(pendingMoves));pendingMoves=source.pop();
        this.changed(redo?'Order redone.':'Order undone.');
    },
    changed(message) {
        planning.clearDrag();
        selectedFrom=null;clearRegionInfo();lastHoverId=null;
        renderMap();updateMovesList();updateMoveHint();
        document.getElementById('order-status').textContent=message;
    },
    reset() { this.undoStack=[];this.redoStack=[];this.updateButtons(); },
    updateButtons() {
        const locked=resolving||gameOver||!state;
        document.getElementById('undo-order').disabled=locked||!this.undoStack.length;
        document.getElementById('redo-order').disabled=locked||!this.redoStack.length;
        document.getElementById('clear-orders').disabled=locked||!pendingMoves.length;
    },
    init() {
        document.getElementById('undo-order').addEventListener('click',()=>this.restore());
        document.getElementById('redo-order').addEventListener('click',()=>this.restore(true));
        document.getElementById('clear-orders').addEventListener('click',()=>{
            if(resolving||gameOver||!pendingMoves.length)return;
            this.record([]);this.changed('Orders cleared. Undo restores the plan.');
        });
        document.addEventListener('keydown',event=>{
            if(!(event.ctrlKey||event.metaKey)||event.altKey||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
            const key=event.key.toLowerCase();
            if(key!=='z'&&key!=='y')return;
            event.preventDefault();this.restore(key==='y'||event.shiftKey);
        });
    }
};

const strategicView = {
    mode:'ownership', key:null, paths:null,
    init() {
        document.getElementById('map-mode').addEventListener('change',event=>{
            this.mode=event.target.value;
            if(state)renderMap();
        });
    },
    render() {
        const group=document.getElementById('g-strategy');
        const legend=document.getElementById('map-mode-legend');
        legend.hidden=this.mode==='ownership';
        const paths=atlas.data?atlas.geometry.svgPaths:randomTerrainCache?.paths;
        const regions=Object.values(state.regions);
        const key=JSON.stringify([this.mode,...regions.map(r=>[r.id,r.army,r.pop_rate,r.owner])]);
        if(key===this.key && paths===this.paths)return;
        this.key=key;this.paths=paths;
        if(this.mode==='ownership'||!paths){group.replaceChildren();return;}
        const value=r=>this.mode==='army'?r.army:r.pop_rate;
        const maximum=Math.max(1,...regions.map(value));
        legend.textContent=this.mode==='army'?`Troops now: 0–${maximum}. Darker purple = stronger armies. Counter rims show ownership.`:`Recruits per turn: 0–${maximum}. Darker teal = faster growth. Includes supply penalties and neutral militia; counters show +recruits.`;
        const fragment=document.createDocumentFragment();
        for(const feature of paths) {
            const r=state.regions[feature.id];
            const attrs={d:feature.d,fill:`hsl(${this.mode==='army'?275:170} 42% ${80-48*value(r)/maximum}%)`,
                'fill-opacity':.87,'fill-rule':'evenodd',stroke:atlas.data?{player_1:'#3f83de',player_2:'#dc685c',rogue:'#606353'}[r.owner]:'none',
                'stroke-width':1.4,'vector-effect':'non-scaling-stroke'};
            if(!atlas.data)attrs.transform=`scale(${MAP_W/randomTerrainCache.data.cw} ${MAP_H/randomTerrainCache.data.ch})`;
            fragment.appendChild(svgEl('path',attrs));
        }
        group.replaceChildren(fragment);
    }
};

const battleReports = {
    name: id => state.regions[id]?.name || 'Unknown region',
    link(id,label) { return `<button type="button" class="region-link" data-focus-region="${Number(id)}">${escHtml(label||this.name(id))}</button>`; },
    init() {
        document.getElementById('side-panel').addEventListener('click',event=>{
            const target=event.target.closest('[data-focus-region]');
            if(!target||resolving)return;
            this.focus(Number(target.dataset.focusRegion));
        });
    },
    focus(id) {
        const r=state.regions[id];if(!r)return;
        mapCamera.zoom=Math.max(2,mapCamera.zoom);
        mapCamera.x=mapCamera.viewport.clientWidth/2-normX(r.x)*mapCamera.viewport.clientWidth*mapCamera.zoom;
        mapCamera.y=mapCamera.viewport.clientHeight/2-normY(r.y)*mapCamera.viewport.clientHeight*mapCamera.zoom;
        mapCamera.apply();renderMap();updateRegionInfo(id);
    },
    battle(c) {
        const involved=c.attacker_owner==='player_1'||c.defender_owner==='player_1';
        const success=c.attacker_owner==='player_1'?c.attacker_won:!c.attacker_won;
        const heading=c.attacker_owner==='player_1'?'Your attack':c.defender_owner==='player_1'?'Defense of your region':'Rival attack';
        const d=c.battle_details;
        const detail=d && Number.isFinite(d.win_probability)?`<details class="battle-explanation"><summary>Why this result?</summary>
            <p>${c.attacker_army} attacking troops → ${d.effective_attack.toFixed(1)} effective strength.<br>${c.defender_army} defenders → ${d.effective_defense.toFixed(1)} effective strength.</p>
            <p>${escHtml(capitalise(d.terrain||'terrain'))} defense ×${(d.terrain_multiplier??1).toFixed(2)}${d.defender_supplied===false?' · Isolated defense ×0.85':''}.</p>
            <ul>${(d.sources||[]).map(source=>`<li>${this.link(source.region_id)}: ${source.army} troops${source.supplied===false?' · isolated attack ×0.75':''} · ${escHtml(source.crossing)} approach${source.crossing_multiplier>1?` ÷${source.crossing_multiplier.toFixed(2)} strength`:''}</li>`).join('')}</ul>
            <p>${c.defender_army===0?'Unopposed capture: the defenders had already left.':`Attack had ${(d.win_probability*100).toFixed(1)}% victory odds. Random roll: ${(d.roll*100).toFixed(1)}%, ${d.roll<d.win_probability?'below':'above or equal to'} the victory threshold.${(c.attacker_won&&d.win_probability<.5)||(!c.attacker_won&&d.win_probability>.5)?' The less likely outcome occurred.':''}`}</p>
            <small>Recorded at the battle, after recruitment and movement. Other battles in the same turn can change who defends.</small>
            </details>`:'<p class="battle-note">This older battle has no recorded modifier breakdown.</p>';
        const losses=Number.isFinite(c.attacker_survivors)&&Number.isFinite(c.defender_survivors)?`<p>Attacker losses: ${c.attacker_army-c.attacker_survivors} · Defender losses: ${c.defender_army-c.defender_survivors}</p>`:'';
        return `<div class="log-entry"><span class="log-outcome ${involved?(success?'won':'lost'):''}">${heading}: ${c.attacker_won?'region captured':'attack repelled'}</span>
            <p>${this.link(c.attacker_region_id)} → ${this.link(c.defender_region_id)}</p>
            <p>${c.survivors} hold the region.</p>${losses}
            ${c.retreated?`<p>${c.retreated} retreated to ${this.link(c.retreat_region_id)}.</p>`:''}${detail}</div>`;
    },
    summarize(summary) {
        const ownership=new Map();
        const battles=summary.combat_results||[];
        for(const c of battles) {
            if(!c.attacker_won||!c.attacker_owner||!c.defender_owner)continue;
            const change=ownership.get(c.defender_region_id)||{before:c.defender_owner,after:c.defender_owner};
            change.after=c.attacker_owner;ownership.set(c.defender_region_id,change);
        }
        const gained=[],lost=[];
        for(const [id,change] of ownership) {
            if(change.before!=='player_1'&&change.after==='player_1')gained.push(id);
            if(change.before==='player_1'&&change.after!=='player_1')lost.push(id);
        }
        let casualties=0,known=true;
        for(const c of battles) {
            if(!c.attacker_owner||!c.defender_owner){known=false;continue;}
            if(c.attacker_owner==='player_1') {
                if(Number.isFinite(c.attacker_survivors))casualties+=c.attacker_army-c.attacker_survivors;else known=false;
            }
            if(c.defender_owner==='player_1') {
                if(Number.isFinite(c.defender_survivors))casualties+=c.defender_army-c.defender_survivors;else known=false;
            }
        }
        return {gained,lost,casualties:known?casualties:null,known};
    },
    recap(summary) {
        const box=document.getElementById('turn-recap');box.classList.remove('hidden');
        const data=this.summarize(summary);
        const fought=[...new Set((summary.combat_results||[]).filter(c=>c.attacker_owner==='player_1'||c.defender_owner==='player_1').map(c=>c.defender_region_id))];
        box.innerHTML=`<div class="panel-label">Turn ${summary.turn} recap</div>
            <p>${data.known?`<strong>${data.gained.length}</strong> gained · <strong>${data.lost.length}</strong> lost · <strong>${data.casualties}</strong> casualties`:'Detailed totals unavailable for this older turn.'}</p>
            ${data.gained.length?`<p>Gained: ${data.gained.map(id=>this.link(id)).join(', ')}</p>`:''}
            ${data.lost.length?`<p>Lost: ${data.lost.map(id=>this.link(id)).join(', ')}</p>`:''}
            ${fought.length?`<p>Battles: ${fought.map(id=>this.link(id)).join(', ')}</p>`:'<small>No battles involving your armies.</small>'}
            <small>Changes are measured across the whole turn. Casualties include routed troops unable to retreat.</small>`;
    }
};
