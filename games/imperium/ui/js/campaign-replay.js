// Historical positions are isolated from the final save and never submit orders.
const campaignReplay = {
    active:false, loading:false, frames:null, index:0, playing:false,
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
    },
    async enter() {
        if(!gameOver||resolving||this.active||this.loading)return;
        this.loading=true;
        for(const id of ['replay-campaign','open-campaign-replay']) {
            document.getElementById(id).disabled=true;
            document.getElementById(id).textContent='Loading replay…';
        }
        try {
            const data=this.frames?{frames:this.frames,complete:this.complete}:await api.getReplay(gameId);
            this.frames=data.frames;this.complete=data.complete;
            this.finalState=structuredClone(state);this.finalValidMoves=validMoves;
            this.savedThreats=document.getElementById('show-threats').checked;
            this.savedSidebar=sessionStorage.getItem('imperium-sidebar-section');
            this.active=true;selectedFrom=null;pendingMoves=[];validMoves={};
            document.getElementById('show-threats').checked=false;
            document.getElementById('show-threats').disabled=true;
            document.getElementById('gameover-overlay').classList.add('hidden');
            document.getElementById('campaign-replay-controls').hidden=false;
            document.getElementById('campaign-replay-slider').max=this.frames.length-1;
            document.getElementById('campaign-replay-slider').disabled=this.frames.length<2;
            document.getElementById('campaign-replay-note').textContent=this.complete?'Read-only replay · Your completed campaign stays saved.':`Older history is incomplete. Replay starts after turn ${this.frames[0].turn-1}; earlier positions are unavailable.`;
            sidebar.open('battles');this.show(0);
        } catch(error) { alert(`Could not load campaign replay: ${error.message}`); }
        finally {
            this.loading=false;
            for(const id of ['replay-campaign','open-campaign-replay']) {
                document.getElementById(id).disabled=this.active;
                document.getElementById(id).textContent='Replay campaign';
            }
        }
    },
    show(index) {
        if(!this.active)return;
        this.index=Math.max(0,Math.min(this.frames.length-1,index));
        const frame=this.frames[this.index];
        state={...this.finalState,...frame,regions:Object.fromEntries(Object.entries(this.finalState.regions).map(([id,r])=>[id,{...r,...frame.regions[id]}]))};
        clearRegionInfo();lastHoverId=null;
        updateTopBar();renderMap();updateMovesList();
        document.getElementById('move-hint').textContent='Campaign replay — use the slider or arrow buttons to explore turns.';
        document.getElementById('campaign-replay-slider').value=this.index;
        const label=frame.turn===1?'Starting position':`After turn ${frame.turn-1}`;
        document.getElementById('campaign-replay-caption').textContent=`${label} · ${this.index+1}/${this.frames.length}`;
        document.getElementById('campaign-replay-slider').setAttribute('aria-valuetext',label);
        document.getElementById('campaign-replay-prev').disabled=this.index===0;
        document.getElementById('campaign-replay-next').disabled=this.index===this.frames.length-1;
        document.getElementById('campaign-replay-play').disabled=this.frames.length<2;
        const report=campaignHistory.find(entry=>entry.turn===frame.turn-1);
        if(report)showCombatLog(report);
        else {
            document.getElementById('log-turn').textContent=frame.turn===1?'Start':'—';
            document.getElementById('turn-recap').innerHTML='<p class="sidebar-empty">'+(frame.turn===1?'Starting position. No turns have resolved yet.':'No report is available for this position.')+'</p>';
            document.getElementById('combat-log').replaceChildren();
        }
        document.getElementById('sidebar-battles-body').scrollTop=0;
    },
    pause() {
        this.playing=false;clearTimeout(this.timer);
        document.getElementById('campaign-replay-play').textContent='Play';
        document.getElementById('campaign-replay-play').setAttribute('aria-pressed','false');
    },
    play() {
        if(!this.active||this.frames.length<2)return;
        if(this.index===this.frames.length-1)this.show(0);
        this.playing=true;
        document.getElementById('campaign-replay-play').textContent='Pause';
        document.getElementById('campaign-replay-play').setAttribute('aria-pressed','true');
        const advance=()=>{
            if(!this.active||!this.playing)return;
            this.show(this.index+1);
            if(this.index===this.frames.length-1)this.pause();
            else this.timer=setTimeout(advance,1000);
        };
        this.timer=setTimeout(advance,1000);
    },
    exit() {
        if(!this.active)return;
        this.pause();cancelAnimationFrame(this.seekFrame);this.seekFrame=null;
        this.active=false;state=this.finalState;validMoves=this.finalValidMoves;
        for(const id of ['replay-campaign','open-campaign-replay'])document.getElementById(id).disabled=false;
        document.getElementById('campaign-replay-controls').hidden=true;
        document.getElementById('show-threats').disabled=false;
        document.getElementById('show-threats').checked=this.savedThreats;
        clearRegionInfo();lastHoverId=null;updateTopBar();renderMap();updateMovesList();updateMoveHint();
        if(campaignHistory.length)showCombatLog(campaignHistory[campaignHistory.length-1]);
        sidebar.open(this.savedSidebar||null);
    }
};
