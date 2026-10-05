// Drafts share the ordinary order history. The server commits them with a turn.
const standingOrders = {
    orders: [], editor: null, draftError: false,
    clone: value => JSON.parse(JSON.stringify(value)),
    manual: () => pendingMoves.filter(m=>!m.standing_id),
    key: () => `imperium-plan:${gameId}`,
    load(restoreDraft=false) {
        this.orders=this.clone(state.standing_orders||[]);this.editor=null;
        if(restoreDraft && !state.game_over)try {
            const draft=JSON.parse(localStorage.getItem(this.key()));
            if(draft?.turn===state.turn && Array.isArray(draft.orders) && Array.isArray(draft.moves)) {
                this.orders=draft.orders;pendingMoves=draft.moves;
            }
        } catch { /* Storage may be unavailable. Server orders still work. */ }
        const bySource=new Map();
        for(const order of this.orders.filter(o=>o.kind==='reinforce')) {
            const previous=bySource.get(order.path[0]);
            if(!previous||previous.paused||!order.paused)bySource.set(order.path[0],order);
        }
        this.orders=[...bySource.values()];
        this.sync();
    },
    saveDraft(committed=false) {
        if(!state)return;
        let failed=false;
        try {localStorage.setItem(this.key(),JSON.stringify({turn:state.turn,orders:this.orders,moves:this.manual()}));}
        catch {failed=true;}
        // A failed cache write after a committed turn cannot lose server data.
        this.draftError=failed&&!committed;
        document.getElementById('draft-save-warning').hidden=!this.draftError;
        document.getElementById('save-status').textContent=this.draftError?'Orders not saved':committed?'Saved':'Draft saved in this browser';
    },
    reason(order, used) {
        const [a,b]=order.path, from=state.regions[a], to=state.regions[b];
        if(used.has(a))return 'Another move takes priority at the source.';
        if(from?.owner!=='player_1')return 'The source is no longer yours.';
        if(!from.neighbors.includes(b))return 'This route is no longer connected.';
        if(to?.owner!=='player_1')return 'The next region is no longer friendly.';
        return '';
    },
    sync() {
        pendingMoves=this.manual();
        if(state.game_over)return;
        const used=new Set(pendingMoves.map(m=>m.from_region_id));
        for(const order of this.orders) {
            if(order.paused||this.reason(order,used))continue;
            pendingMoves.push({from_region_id:order.path[0],to_region_id:order.path[1],standing_id:order.id});
            used.add(order.path[0]);
        }
    },
    change(orders, moves=this.manual(), message='Standing orders updated.') {
        if(!planning.allowed())return;
        orderHistory.recordPlan(moves,orders);this.editor=null;
        orderHistory.changed(message);
    },
    toggle(id) {
        const orders=this.clone(this.orders), order=orders.find(o=>o.id===id);
        if(!order)return;
        order.paused=!order.paused;delete order.reason;
        this.change(orders, this.manual(),order.paused?'Standing order paused.':'Standing order resumed.');
    },
    cancel(id) {this.change(this.orders.filter(o=>o.id!==id));},
    start(id=null, source=null) {
        if(!planning.allowed())return;
        const order=this.orders.find(o=>o.id===id);
        this.editor={id,kind:'reinforce',path:order?[order.path[0]]:source!==null?[source]:[]};
        mapOrders.close();selectedFrom=null;planning.hidePreview();this.render();renderMap();updateMoveHint();
    },
    destinations(source) {
        const region=state?.regions[source];
        if(region?.owner!=='player_1')return [];
        return region.neighbors.filter(id=>state.regions[id]?.owner==='player_1');
    },
    pick(id) {
        if(!this.editor)return false;
        const path=this.editor.path,region=state.regions[id];
        if(!region)return true;
        if(!path.length) {
            if(region.owner!=='player_1')return this.message('Choose one of your regions as the source.');
            path.push(id);
        } else {
            if(!this.destinations(path[0]).includes(id))return this.message('Choose a neighboring friendly region for repeat reinforcements.');
            path.splice(1,path.length-1,id);
            this.place();planning.pulse(id);return true;
        }
        this.render();renderMap();updateMoveHint();return true;
    },
    message(text) {document.getElementById('standing-message').textContent=text;return true;},
    place() {
        if(!planning.allowed()||!this.editor||this.editor.path.length<2)return;
        const {id,kind,path}=this.editor;
        const orders=this.clone(this.orders).filter(o=>o.id!==id&&o.path[0]!==path[0]);
        orders.push({id:id||crypto.randomUUID(),kind,path:[...path],paused:false});
        this.change(orders,this.manual().filter(m=>m.from_region_id!==path[0]),'Repeat reinforcement placed. Undo reverses it; Next Turn sends troops.');
    },
    stopEditing() {this.editor=null;this.render();renderMap();updateMoveHint();},
    render() {
        const box=document.getElementById('standing-orders');
        if(!box)return;
        box.hidden=gameOver||campaignReplay.active||state?.game_over;
        if(box.hidden){document.getElementById('map-order-composer').hidden=true;mapOrders.close();return;}
        const names=path=>path.map(id=>escHtml(state.regions[id]?.name||'Unknown region')).join(' → ');
        const used=new Set(this.manual().map(m=>m.from_region_id));
        box.innerHTML=`<p class="standing-help">Right-click or long-press a region on the map to issue standing orders.</p>
            ${this.orders.map(order=>{
                const reason=order.paused?(order.reason||'Paused by you.'):this.reason(order,used);
                if(!order.paused&&!reason)used.add(order.path[0]);
                return `<article class="standing-card"><strong>↻ Repeat · ${escHtml(state.regions[order.path.at(-1)]?.name)}</strong>
                    <p>${names(order.path)}</p><small>${reason?escHtml(reason):'Repeats every turn'}</small>
                    <div class="order-tools"><button data-standing-action="toggle" data-order-id="${escHtml(order.id)}">${order.paused?'Resume':'Pause'}</button><button data-standing-action="edit" data-order-id="${escHtml(order.id)}">Edit on map</button><button data-standing-action="cancel" data-order-id="${escHtml(order.id)}">Cancel</button></div></article>`;
            }).join('')}`;
        for(const button of box.querySelectorAll('[data-standing-action]')) {
            button.disabled=resolving;
            button.onclick=()=>{const {standingAction:action,orderId:id}=button.dataset;action==='toggle'?this.toggle(id):action==='edit'?this.start(id):this.cancel(id);};
        }
        const panel=document.getElementById('map-order-composer');
        panel.hidden=!this.editor;
        if(this.editor) {
            const {path,kind}=this.editor;
            panel.innerHTML=`<strong>↻ Repeat reinforcement</strong>
                <p>${names(path)}</p><p>${path.length<2?(this.destinations(path[0]).length?'Tap a highlighted friendly neighbor.':'No friendly neighbors available. Cancel and choose another source.'):'Send the whole army every turn. Tap another friendly neighbor to change the destination.'}</p>
                <small>Moves the whole army, including recruits and arrivals. Next Turn advances it.</small>
                <div id="standing-message" role="status"></div>
                <div class="order-tools"><button id="standing-discard">Cancel</button></div>`;
            document.getElementById('standing-discard').onclick=()=>this.stopEditing();
        }
    },
};
