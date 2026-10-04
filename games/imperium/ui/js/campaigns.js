// Game IDs are private resume links, held in this browser rather than a public
// server-side listing. Full game state and history are saved on the server.
const campaigns = {
    key: `imperium-campaigns:${API_BASE || location.origin}`,
    list() {
        try { const value=JSON.parse(localStorage.getItem(this.key)||'[]'); return Array.isArray(value)?value:[]; }
        catch { return []; }
    },
    remember(id, state) {
        const saved={id,name:state.campaign_name||'Campaign',preset:state.preset_id||'',turn:state.turn,
            finished:state.game_over,updated:new Date().toISOString()};
        const entries=[saved,...this.list().filter(item=>item.id!==id)].slice(0,50);
        try { localStorage.setItem(this.key,JSON.stringify(entries)); } catch { /* Server save still succeeded. */ }
    },
    async render() {
        const section=document.getElementById('saved-campaigns');
        if (!section) return;
        const list=this.list(); section.hidden=!list.length;
        const container=document.getElementById('campaign-list');container.replaceChildren();
        for (const item of list) {
            const button=document.createElement('button');button.type='button';button.className='saved-campaign';
            const title=document.createElement('strong');title.textContent=item.name;
            const detail=document.createElement('span');detail.textContent=`Turn ${item.turn} · ${item.finished?'Review campaign':'Resume'}`;
            button.append(title,detail);
            button.addEventListener('click',async()=>{
                button.disabled=true;
                try {
                    const data=await api.getGame(item.id);
                    sessionStorage.setItem('gameId',item.id);
                    sessionStorage.setItem('presetId',data.state.preset_id||'');
                    location.href='game.html';
                } catch(error) { detail.textContent=error.message;button.disabled=false; }
            });
            container.append(button);
        }
    },
};
