// Historical positions are isolated from the final save and never submit orders.
const campaignReplay = {
    active:false, loading:false, frames:null, index:0, playing:false,
    requests:new Map(), reports:new Map(), seekSequence:0, playbackGeneration:0,
    storePage(data) {
        if(!this.frames)this.frames=new Array(data.total??data.frames.length);
        data.frames.forEach((frame,i)=>{this.frames[(data.offset??0)+i]=frame;});
        for(const entry of data.history||[])this.reports.set(entry.turn,entry);
        this.complete=data.complete;
    },
    async fetchPage(index) {
        const offset=Math.floor(index/50)*50;
        if(!this.requests.has(offset)){
            const request=api.getReplay(gameId,offset).then(data=>this.storePage(data)).finally(()=>this.requests.delete(offset));
            this.requests.set(offset,request);
        }
        await this.requests.get(offset);
    },
    init() {
        for(const id of ['replay-campaign','open-campaign-replay'])document.getElementById(id).addEventListener('click',()=>this.enter());
        document.getElementById('campaign-replay-exit').addEventListener('click',()=>this.exit());
        document.getElementById('campaign-replay-prev').addEventListener('click',()=>{this.pause();this.show(this.index-1);});
        document.getElementById('campaign-replay-next').addEventListener('click',()=>{this.pause();this.show(this.index+1);});
        document.getElementById('campaign-replay-play').addEventListener('click',()=>this.playing?this.pause():this.play());
        document.getElementById('campaign-replay-slider').addEventListener('input',event=>{
            this.pause();this.seekIndex=Number(event.target.value);
            if(this.seekFrame)return;
            this.seekFrame=requestAnimationFrame(()=>{this.seekFrame=null;this.show(this.seekIndex);});
        });
        document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
        document.addEventListener('keydown',event=>{
            if(!this.active||event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
            if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
            const target=event.target;
            if(target.getAttribute('role')==='separator')return;
            if(target.id!=='campaign-replay-slider'&&(target.isContentEditable||target.closest('input,textarea,select')))return;
            event.preventDefault();event.stopPropagation();
            this.pause();cancelAnimationFrame(this.seekFrame);this.seekFrame=null;
            this.show(this.index+(event.key==='ArrowRight'?1:-1));
        },true);
    },
    async enter() {
        if(!gameOver||resolving||this.active||this.loading)return;
        this.loading=true;
        for(const id of ['replay-campaign','open-campaign-replay']) {
            document.getElementById(id).disabled=true;
            document.getElementById(id).textContent='Loading replay…';
        }
        try {
            if(!this.frames)await this.fetchPage(0);
            this.finalState=structuredClone(state);this.finalValidMoves=validMoves;
            this.savedThreats=document.getElementById('show-threats').checked;
            this.savedSidebar=sessionStorage.getItem('imperium-sidebar-section');
            this.active=true;document.body.classList.add('is-campaign-replay');selectedFrom=null;pendingMoves=[];validMoves={};
            document.getElementById('show-threats').checked=false;
            document.getElementById('show-threats').disabled=true;
            document.getElementById('gameover-overlay').classList.add('hidden');
            document.getElementById('campaign-replay-controls').hidden=false;
            document.getElementById('campaign-replay-slider').max=this.frames.length-1;
            document.getElementById('campaign-replay-slider').disabled=this.frames.length<2;
            document.getElementById('campaign-replay-note').textContent=this.complete?'Read-only replay · Your completed campaign stays saved.':`Older history is incomplete. Replay starts after turn ${this.frames[0].turn-1}; earlier positions are unavailable.`;
            sidebar.open('battles');await this.show(0);
        } catch(error) { alert(`Could not load campaign replay: ${error.message}`); }
        finally {
            this.loading=false;
            for(const id of ['replay-campaign','open-campaign-replay']) {
                document.getElementById(id).disabled=this.active;
                document.getElementById(id).textContent='Replay campaign';
            }
        }
    },
    movements() {
        if(!this.active)return [];
        const report=this.reports.get(this.frames[this.index].turn-1) || campaignHistory.find(entry=>entry.turn===this.frames[this.index].turn-1);
        if(!report)return [];
        const events=(report.events||[]).filter(event=>event.type==='movement'||event.type==='retreat');
        if(events.length)return events;
        const before=this.frames[this.index-1];
        return (report.movements||[]).map(move=>{
            const [from,to,army]=Array.isArray(move)?move:[move.from,move.to,move.army];
            return {from,to,army,owner:before?.regions[from]?.owner,type:'movement'};
        });
    },
    async show(index) {
        if(!this.active)return;
        index=Math.max(0,Math.min(this.frames.length-1,index));
        const sequence=++this.seekSequence;
        if(!this.frames[index]) {
            document.getElementById('campaign-replay-caption').textContent='Loading turns…';
            try {await this.fetchPage(index);}
            catch(error){if(sequence===this.seekSequence){this.pause();document.getElementById('campaign-replay-caption').textContent=error.message;}return;}
            if(!this.active||sequence!==this.seekSequence)return;
        }
        this.index=index;
        const frame=this.frames[this.index];
        state={...this.finalState,...frame,regions:Object.fromEntries(Object.entries(this.finalState.regions).map(([id,r])=>[id,{...r,...frame.regions[id]}]))};
        clearRegionInfo();lastHoverId=null;
        updateTopBar();renderMap();updateMovesList();
        document.getElementById('move-hint').textContent='Replay: ← / → to step. Arrows show this turn’s moves in faction colors; dashed arrows show retreats.';
        document.getElementById('campaign-replay-slider').value=this.index;
        const label=frame.turn===1?'Starting position':`After turn ${frame.turn-1}`;
        document.getElementById('campaign-replay-caption').textContent=`${label} · ${this.index+1}/${this.frames.length}`;
        document.getElementById('campaign-replay-slider').setAttribute('aria-valuetext',label);
        document.getElementById('campaign-replay-prev').disabled=this.index===0;
        document.getElementById('campaign-replay-next').disabled=this.index===this.frames.length-1;
        document.getElementById('campaign-replay-play').disabled=this.frames.length<2;
        const report=this.reports.get(frame.turn-1)||campaignHistory.find(entry=>entry.turn===frame.turn-1);
        if(report)showCombatLog(report);
        else {
            document.getElementById('log-turn').textContent=frame.turn===1?'Start':'—';
            document.getElementById('turn-recap').innerHTML='<p class="sidebar-empty">'+(frame.turn===1?'Starting position. No turns have resolved yet.':'No report is available for this position.')+'</p>';
            document.getElementById('combat-log').replaceChildren();
            document.getElementById('turn-movements').replaceChildren();
        }
        document.getElementById('sidebar-battles-body').scrollTop=0;
    },
    pause() {
        ++this.playbackGeneration;++this.seekSequence;
        this.playing=false;clearTimeout(this.timer);
        document.getElementById('campaign-replay-play').textContent='Play';
        document.getElementById('campaign-replay-play').setAttribute('aria-pressed','false');
    },
    async play() {
        if(!this.active||this.frames.length<2)return;
        const generation=++this.playbackGeneration;
        clearTimeout(this.timer);
        if(this.index===this.frames.length-1)await this.show(0);
        if(!this.active||generation!==this.playbackGeneration)return;
        this.playing=true;
        document.getElementById('campaign-replay-play').textContent='Pause';
        document.getElementById('campaign-replay-play').setAttribute('aria-pressed','true');
        const advance=async()=>{
            if(!this.active||!this.playing||generation!==this.playbackGeneration)return;
            await this.show(this.index+1);
            if(!this.active||!this.playing||generation!==this.playbackGeneration)return;
            if(this.index===this.frames.length-1)this.pause();
            else this.timer=setTimeout(advance,1000);
        };
        this.timer=setTimeout(advance,1000);
    },
    exit() {
        if(!this.active)return;
        this.pause();cancelAnimationFrame(this.seekFrame);this.seekFrame=null;
        ++this.seekSequence;this.active=false;document.body.classList.remove('is-campaign-replay');state=this.finalState;validMoves=this.finalValidMoves;
        for(const id of ['replay-campaign','open-campaign-replay'])document.getElementById(id).disabled=false;
        document.getElementById('campaign-replay-controls').hidden=true;
        document.getElementById('show-threats').disabled=false;
        document.getElementById('show-threats').checked=this.savedThreats;
        clearRegionInfo();lastHoverId=null;updateTopBar();renderMap();updateMovesList();updateMoveHint();
        if(campaignHistory.length)showCombatLog(campaignHistory[campaignHistory.length-1]);
        sidebar.open(this.savedSidebar||null);
    }
};
