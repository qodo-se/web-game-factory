// Game IDs are private resume links, held in this browser rather than a public
// server-side listing. Full game state and history are saved on the server.
const campaigns = {
    key: `imperium-campaigns:${API_BASE || location.origin}`,
    list() {
        try { const value=JSON.parse(localStorage.getItem(this.key)||'[]'); return Array.isArray(value)?value:[]; }
        catch { return []; }
    },
    remember(id, state) {
        const saved={id,name:state.campaign_name||'Campaign',preset:state.preset_id||'',asset:state.map_asset_id||state.preset_id||'',turn:state.turn,
            finished:state.game_over,winner:state.winner,expires:state.expires_at,updated:new Date().toISOString()};
        const entries=[saved,...this.list().filter(item=>item.id!==id)].slice(0,50);
        try { localStorage.setItem(this.key,JSON.stringify(entries)); } catch { /* Server save still succeeded. */ }
    },
    async render() {
        const section=document.getElementById('saved-campaigns');
        if (!section) return;
        const list=this.list();
        if(section.getAttribute('role')!=='tabpanel')section.hidden=!list.length;
        const container=document.getElementById('campaign-list');container.replaceChildren();
        if(!list.length){const empty=document.createElement('p');empty.className='sidebar-empty';empty.textContent='No campaigns saved in this browser yet. Choose New game to begin.';container.append(empty);}
        for (const item of list) {
            const button=document.createElement('button');button.type='button';button.className='saved-campaign';
            const title=document.createElement('strong');title.textContent=item.name;
            const detail=document.createElement('span');detail.textContent=`Turn ${item.turn} · ${item.winner==='draw'?'Draw · Review campaign':item.finished?'Review campaign':'Resume'}`;
            button.append(title,detail);
            button.addEventListener('click',async()=>{
                button.disabled=true;
                try {
                    sessionStorage.setItem('gameId',item.id);
                    sessionStorage.setItem('presetId',item.preset||'');
                    sessionStorage.setItem('mapAssetId',item.asset||item.preset||'');
                    location.href='game.html';
                } catch(error) { detail.textContent=error.message;button.disabled=false; }
            });
            const row=document.createElement('div');row.className='campaign-save-row';
            const expiry=document.createElement('small');expiry.textContent=campaignFiles.expiry(item.expires);
            const status=document.createElement('p');status.setAttribute('role','status');
            const download=document.createElement('button');download.type='button';download.className='btn-secondary';download.textContent='Download';
            download.addEventListener('click',()=>campaignFiles.download(item.id,download,status));
            if(item.expires && new Date(item.expires)<=new Date()) {
                button.disabled=true;download.disabled=true;
                detail.textContent=`Turn ${item.turn} · Expired`;
                expiry.textContent='Restore a downloaded save to play or replay this campaign.';
            }
            row.append(button,download,expiry,status);container.append(row);
        }
    },
};
