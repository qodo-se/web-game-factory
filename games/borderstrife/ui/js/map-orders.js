// Map-local commands. A hold becomes a menu only if it never becomes a pan.
const mapOrders = {
    region:null, hold:null,
    init() {
        this.menu=document.getElementById('map-order-menu');
        const surface=document.getElementById('map-world');
        surface.addEventListener('contextmenu',event=>{
            if(!planning.allowed())return;
            event.preventDefault();this.clearHold();mapCamera.cancelGesture();
            this.open(planning.regionAt(event));
        });
        surface.addEventListener('pointerdown',event=>{
            const alreadyHolding=!!this.hold;
            this.clearHold();
            if(alreadyHolding||!event.isPrimary||event.button!==0||!planning.allowed())return;
            const id=planning.regionAt(event);
            this.hold={id:event.pointerId,x:event.clientX,y:event.clientY};
            this.timer=setTimeout(()=>{
                this.clearHold();
                if(!planning.allowed()||mapCamera.dragging)return;
                mapCamera.cancelGesture();this.open(id);
            },550);
        });
        surface.addEventListener('pointermove',event=>{
            if(this.hold && (event.pointerId!==this.hold.id||Math.hypot(event.clientX-this.hold.x,event.clientY-this.hold.y)>5))this.clearHold();
        });
        for(const name of ['pointerup','pointercancel','blur'])window.addEventListener(name,()=>this.clearHold());
        for(const name of ['wheel','gesturestart'])surface.addEventListener(name,()=>{this.clearHold();this.close();},{passive:true});
        document.addEventListener('pointerdown',event=>{
            if(!event.target.closest('#map-order-menu'))this.close();
        },true);
        document.addEventListener('keydown',event=>{
            if(event.key==='Escape')this.clearHold();
            if(event.key==='Escape'&&!this.menu.hidden){event.preventDefault();this.close();mapCamera.viewport.focus();}
            if((event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)&&selectedFrom!==null&&planning.allowed()) {
                event.preventDefault();this.open(selectedFrom);
            }
        });
    },
    clearHold() {clearTimeout(this.timer);this.hold=null;},
    close() {if(this.menu)this.menu.hidden=true;this.region=null;},
    open(id) {
        const region=state?.regions[id];
        if(!planning.allowed()||!region)return this.close();
        const orders=standingOrders.orders.filter(o=>o.path[0]===id);
        if(region.owner!=='player_1'&&!orders.length)return this.close();
        this.region=id;selectedFrom=null;planning.hidePreview();renderMap();
        this.menu.innerHTML=`<strong>${escHtml(region.name)}</strong><button class="map-order-close" aria-label="Close orders">×</button>
            ${region.owner==='player_1'?'<button data-map-order="move">→ Move once <small>Choose a neighboring region</small></button><button data-map-order="reinforce">↻ Repeat reinforcement <small>Send troops to a friendly neighbor each turn</small></button>':''}
            ${orders.map((o,i)=>`<div class="map-existing-order"><small>Repeat → ${escHtml(state.regions[o.path.at(-1)].name)}${o.paused?' · Paused':''}</small><div class="order-tools"><button data-existing="${i}" data-action="toggle">${o.paused?'Resume':'Pause'}</button><button data-existing="${i}" data-action="edit">Edit</button><button data-existing="${i}" data-action="cancel">Cancel</button></div></div>`).join('')}`;
        this.menu.hidden=false;this.position();
        this.menu.querySelector('.map-order-close').onclick=()=>this.close();
        for(const button of this.menu.querySelectorAll('[data-map-order]'))button.onclick=()=>{
            const kind=button.dataset.mapOrder;this.close();
            if(kind==='move') {
                sidebar.open('orders');standingOrders.editor=null;standingOrders.render();selectedFrom=id;renderMap();updateMoveHint();
            } else standingOrders.start(null,id);
        };
        for(const button of this.menu.querySelectorAll('[data-existing]'))button.onclick=()=>{
            const order=orders[Number(button.dataset.existing)],action=button.dataset.action;
            this.close();action==='edit'?standingOrders.start(order.id):action==='toggle'?standingOrders.toggle(order.id):standingOrders.cancel(order.id);
        };
        this.menu.querySelector('[data-map-order], [data-existing],button').focus({preventScroll:true});
    },
    position() {
        if(this.region===null||!this.menu||this.menu.hidden)return;
        const r=state.regions[this.region],viewport=mapCamera.viewport.getBoundingClientRect();
        const point=new DOMPoint(toSVGX(r.x),toSVGY(r.y)).matrixTransform(document.getElementById('map-svg').getScreenCTM());
        this.menu.style.left=`${Math.max(8,Math.min(viewport.width-this.menu.offsetWidth-8,point.x-viewport.left+22))}px`;
        this.menu.style.top=`${Math.max(8,Math.min(viewport.height-this.menu.offsetHeight-8,point.y-viewport.top-25))}px`;
    }
};
