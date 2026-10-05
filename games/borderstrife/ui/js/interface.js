// Local presentation preferences, independent of campaign state and orders.
const interfaceView = {
    labelSize:10, factionShapes:false, darkMap:false,
    read(key,fallback) { try{return localStorage.getItem(`imperium-ui-${key}`)||fallback;}catch{return fallback;} },
    save(key,value) { try{localStorage.setItem(`imperium-ui-${key}`,String(value));}catch{} },
    icon(name) {
        const paths={
            expand:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
            help:'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01',
            map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
            troops:'M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3',
            report:'M6 3h12v18H6ZM9 8h6M9 12h6M9 16h4',
            history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
            terrain:'m2 20 7-15 5 10 3-6 5 11ZM6 12l3 2 3-2',
        };
        const svg=svgEl('svg',{viewBox:'0 0 24 24',class:'ui-icon','aria-hidden':'true',focusable:'false',fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round'});
        svg.append(svgEl('path',{d:paths[name]}));return svg;
    },
    init() {
        for(const [id,icon] of Object.entries({'map-fullscreen':'expand','map-help-toggle':'help','sidebar-settings-toggle':'map','sidebar-orders-toggle':'troops','sidebar-battles-toggle':'report','sidebar-timeline-toggle':'history','sidebar-rules-toggle':'terrain'}))document.getElementById(id).prepend(this.icon(icon));
        const sizes={small:9,medium:10,large:13},labels=document.getElementById('label-size');
        labels.value=Object.hasOwn(sizes,this.read('labels','medium'))?this.read('labels','medium'):'medium';
        this.labelSize=sizes[labels.value];
        labels.addEventListener('change',()=>{this.labelSize=sizes[labels.value];this.save('labels',labels.value);if(state)renderMap();});
        const shapes=document.getElementById('faction-shapes');
        shapes.checked=this.read('shapes','false')==='true';
        const updateShapes=()=>{this.factionShapes=shapes.checked;document.getElementById('faction-shape-key').hidden=!shapes.checked;document.body.classList.toggle('faction-shapes',shapes.checked);};
        updateShapes();shapes.addEventListener('change',()=>{updateShapes();this.save('shapes',shapes.checked);if(state)renderMap();});
        const help=document.getElementById('map-help-toggle');
        help.addEventListener('click',()=>{const open=help.getAttribute('aria-expanded')!=='true';help.setAttribute('aria-expanded',String(open));document.getElementById('map-navigation-help').hidden=!open;});
        this.initTheme();this.initFullscreen();this.initResize();this.initTurnShortcut();
    },
    initTurnShortcut() {
        const button=document.getElementById('end-turn-btn');
        document.addEventListener('keydown',event=>{
            if(event.key!=='Enter'||!event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return;
            if(event.defaultPrevented)return;
            const target=event.target;
            if(target.isContentEditable||target.closest('input,textarea,select,[role="textbox"]'))return;
            if(target.closest('button,a,summary,[role="button"]')&&target!==button)return;
            if(event.repeat||event.isComposing) {if(target===button)event.preventDefault();return;}
            if(!state||resolving||gameOver||campaignReplay.active||button.disabled||button.closest('[inert]'))return;
            event.preventDefault();
            button.click();
        });
    },
    initTheme() {
        const select=document.getElementById('map-theme');
        const media=matchMedia('(prefers-color-scheme: dark)');
        const saved=this.read('map-theme','system');
        select.value=['system','light','dark'].includes(saved)?saved:'system';
        const update=()=>{
            const dark=select.value==='dark'||(select.value==='system'&&media.matches);
            document.getElementById('map-container').dataset.theme=dark?'dark':'light';
            if(this.darkMap===dark)return;
            this.darkMap=dark;
            if(state)renderMap();
        };
        select.addEventListener('change',()=>{this.save('map-theme',select.value);update();});
        media.addEventListener('change',update);
        update();
    },
    initFullscreen() {
        const map=document.getElementById('map-container'),button=document.getElementById('map-fullscreen');
        const update=()=>{
            const active=document.fullscreenElement===map||document.body.classList.contains('map-focus');
            button.setAttribute('aria-pressed',String(active));button.replaceChildren(this.icon('expand'),document.createTextNode(active?'Exit fullscreen':'Fullscreen'));
        };
        button.addEventListener('click',async()=>{
            if(document.fullscreenElement===map) { await document.exitFullscreen().catch(()=>{}); }
            else if(document.body.classList.contains('map-focus'))document.body.classList.remove('map-focus');
            else {
                try { if(!map.requestFullscreen)throw new Error('Unavailable');await map.requestFullscreen(); }
                catch { document.body.classList.add('map-focus'); }
            }
            update();
        });
        document.addEventListener('fullscreenchange',update);
        document.addEventListener('keydown',event=>{
            if(event.key==='Escape'&&document.body.classList.contains('map-focus')) {document.body.classList.remove('map-focus');update();button.focus();}
        });
    },
    initResize() {
        const handle=document.getElementById('sidebar-resize');
        let width=Number(this.read('sidebar-width','256'));
        if(!Number.isFinite(width))width=256;
        const apply=value=>{
            width=Math.max(220,Math.min(420,value));
            document.documentElement.style.setProperty('--sidebar-width',`${width}px`);
            handle.setAttribute('aria-valuenow',String(Math.round(width)));
        };
        apply(width);
        let pointer=null;
        handle.addEventListener('pointerdown',event=>{
            if(event.button!==0)return;
            event.preventDefault();pointer=event.pointerId;handle.setPointerCapture(pointer);
            document.body.classList.add('resizing-sidebar');
        });
        handle.addEventListener('pointermove',event=>{if(event.pointerId===pointer)apply(innerWidth-event.clientX);});
        const finish=()=>{if(pointer===null)return;pointer=null;document.body.classList.remove('resizing-sidebar');this.save('sidebar-width',width);};
        handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
        handle.addEventListener('keydown',event=>{
            const value=event.key==='ArrowLeft'?width+16:event.key==='ArrowRight'?width-16:event.key==='Home'?220:event.key==='End'?420:null;
            if(value===null)return;event.preventDefault();apply(value);this.save('sidebar-width',width);
        });
        handle.addEventListener('dblclick',()=>{apply(256);this.save('sidebar-width',width);});
    }
};
