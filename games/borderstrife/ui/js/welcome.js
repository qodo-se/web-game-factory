(async function () {
    const form = document.getElementById('new-game-form');
    const startBtn = document.getElementById('start-btn');
    const errorMsg = document.getElementById('error-msg');
    const grid = document.getElementById('map-grid');
    const description = document.getElementById('preset-desc');
    const kingdom = document.getElementById('kingdom-select');
    const preview = document.getElementById('kingdom-preview');
    const mobile = matchMedia('(max-width:760px)');
    const nextStep = document.getElementById('continue-setup');
    let catalog=[], visible=[];
    let historical = false;
    let retryAction=()=>location.reload();
    const retry=document.getElementById('retry-maps');
    retry.addEventListener('click',()=>retryAction());
    let selected = '', starts = [], sequence = 0, ready = false, submitting = false;
    campaigns.render();
    const tabs=[document.getElementById('new-game-tab'),document.getElementById('resume-game-tab')];
    function selectTab(tab) {
        if(submitting)return;
        for(const item of tabs){
            const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;
            document.getElementById(item.getAttribute('aria-controls')).hidden=!active;
        }
    }
    for(const [index,tab] of tabs.entries()){
        tab.addEventListener('click',()=>selectTab(tab));
        tab.addEventListener('keydown',event=>{
            if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||submitting)return;
            event.preventDefault();const target=tabs[event.key==='Home'?0:event.key==='End'?1:1-index];selectTab(target);target.focus();
        });
    }
    function showStep(step) {
        form.dataset.step=step;
        if(mobile.matches){
            (step==='setup'?document.getElementById('selected-map-title'):grid.querySelector('input:checked')||grid.querySelector('input')||grid).focus();
            window.scrollTo({top:0,behavior:'instant'});
        }
    }
    nextStep.addEventListener('click',()=>{if(ready&&!submitting)showStep('setup');});
    document.getElementById('back-to-maps').addEventListener('click',()=>showStep('maps'));
    mobile.addEventListener('change',()=>{document.querySelector('.map-scroll-hint').hidden=grid.scrollHeight<=grid.clientHeight;});

    function updateControls() {
        form.querySelectorAll('input, select, button').forEach(el => { el.disabled = submitting; });
        kingdom.disabled = submitting || !ready;
        startBtn.disabled = submitting || !ready;
        nextStep.disabled = submitting || !ready;
        for(const tab of tabs)tab.disabled=submitting;
        form.querySelectorAll('[data-category]').forEach(button=>{button.disabled=submitting||!catalog.length;});
    }
    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
        retry.hidden=false;
    }
    function previewKingdom() {
        const choice = starts.find(c => String(c.id ?? '') === kingdom.value);
        preview.textContent = choice ? (historical
            ? `${choice.army} troops · ${choice.regions.length} sectors · Fixed forces`
            : `${choice.army} troops · +${choice.growth}/turn · ${choice.difficulty}`) : '';
        document.getElementById('starting-details').textContent=choice ? (historical
            ? `${choice.difficulty} — based on starting strength only.`
            : `${choice.regions.join(' · ')}. Rival seat: ${choice.rival}. Difficulty reflects starting strength, not a victory prediction.`) : '';
    }
    kingdom.addEventListener('change', previewKingdom);
    async function chooseMap(preset) {
        if (submitting) return;
        selected = preset.id;
        grid.querySelectorAll('input').forEach(input=>{input.checked=input.value===selected;});
        document.getElementById('selected-map-title').textContent=preset.name;
        document.getElementById('selected-map-summary').textContent=`${preset.region_count} ${preset.battle?'sectors · Historical battle':'regions · Open-ended conquest'}`;
        document.getElementById('mobile-selection').textContent=`Selected: ${preset.name}`;
        const thumbnail=document.getElementById('selected-map-preview');
        thumbnail.hidden=false;thumbnail.src=`maps/thumbnails/${encodeURIComponent(preset.map_asset_id||preset.id)}.svg`;
        document.getElementById('map-details').open=false;
        const essentials=document.getElementById('battle-essentials');
        essentials.hidden=!preset.battle;
        essentials.textContent=preset.battle?'20 turns · Fixed forces · 3 objectives. Win by eliminating the rival or holding more objectives.':'';
        retry.hidden=true;
        retryAction=()=>chooseMap(preset);
        historical = !!preset.battle;
        nextStep.textContent=historical?'Next: choose your side':'Next: choose your kingdom';
        document.getElementById('starting-label').textContent = historical ? 'Choose your side' : 'Starting kingdom';
        startBtn.textContent = historical ? 'Begin Battle' : 'Begin Campaign';
        const briefing = document.getElementById('battle-briefing');
        briefing.hidden = !preset.battle && !preset.setting;
        briefing.replaceChildren();
        if (preset.battle) {
            const intro = document.createElement('p');
            intro.textContent = `${preset.battle.date} · ${preset.battle.commanders.join(' vs ')}`;
            const rules = document.createElement('p');
            rules.textContent = '20 turns · Fixed forces · 3 objectives. Eliminate the opposing army, or hold more objectives at the end. Ties: remaining strength, then the historical defender.';
            const details = document.createElement('details');
            const summary = document.createElement('summary'); summary.textContent = 'Historical context & sources';
            const context = document.createElement('p'); context.textContent = preset.battle.context;
            const note = document.createElement('p'); note.textContent = preset.setting?.terrain_note || 'Measured elevation with reconstructed historical woodland, fields and routes. Sector boundaries and army strengths are designed for play.';
            details.append(summary, context, note);
            for (const [name, url] of preset.battle.sources) {
                if (!url.startsWith('https://')) continue;
                const link = document.createElement('a');link.textContent = name;link.href = url;link.target = '_blank';link.rel = 'noopener noreferrer';
                details.append(link);
            }
            const terrainLink=document.createElement('a');terrainLink.href=preset.setting ? 'maps/collection-sources.html' : 'maps/battle-sources.html';terrainLink.target='_blank';terrainLink.rel='noopener';terrainLink.textContent='Terrain data & reconstruction notes';details.append(terrainLink);
            briefing.append(intro, rules, details);
        }
        if (preset.setting && !preset.battle) {
            const details=document.createElement('details');
            const summary=document.createElement('summary');summary.textContent='Setting & map sources';
            const note=document.createElement('p');note.textContent=[preset.setting.era,preset.setting.note,preset.setting.opening_note].filter(Boolean).join(' · ');
            details.append(summary,note);
            for(const [name,url] of preset.setting.sources||[]) {
                if(!url.startsWith('https://'))continue;
                const link=document.createElement('a');link.textContent=name;link.href=url;link.target='_blank';link.rel='noopener noreferrer';details.append(link);
            }
            const credits=document.createElement('a');credits.href='maps/collection-sources.html';credits.target='_blank';credits.rel='noopener';credits.textContent='Map interpretation & credits';details.append(credits);
            briefing.append(details);
        }
        description.textContent = preset.description;
        errorMsg.classList.add('hidden');
        const request = ++sequence;
        ready = false;
        kingdom.replaceChildren(new Option(historical ? 'Loading sides…' : 'Loading kingdoms…', ''));
        preview.textContent = '';document.getElementById('starting-details').textContent='';
        updateControls();
        try {
            const choices = await api.getStarts(selected);
            if (request !== sequence) return;
            if (!choices.length) throw new Error('No starting kingdoms available. Choose another map.');
            starts = choices;
            kingdom.replaceChildren(...choices.map(c => new Option(c.id === null ? `Recommended — ${c.name}` : c.name, c.id ?? '')));
            ready = true;
            previewKingdom();
        } catch (error) {
            if (request !== sequence) return;
            kingdom.replaceChildren(new Option('Kingdoms unavailable', ''));
            showError(error.message);
        } finally {
            if (request === sequence) updateControls();
        }
    }
    updateControls();
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (submitting || !ready) return;
        if(mobile.matches&&form.dataset.step==='maps'){showStep('setup');return;}
        const playerName = document.getElementById('player-name').value.trim() || 'Consul';
        const body = {
            player_name: playerName,
            campaign_name: document.getElementById('campaign-name').value.trim(),
            mode: 'preset', preset_id: selected,
            start_region_id: kingdom.value === '' ? null : Number(kingdom.value),
        };
        submitting = true;
        updateControls();
        errorMsg.classList.add('hidden');
        startBtn.textContent = 'Marshalling forces…';
        try {
            const result = await api.newGame(body);
            campaigns.remember(result.game_id, result.state);
            sessionStorage.setItem('gameId', result.game_id);
            sessionStorage.setItem('playerName', playerName);
            sessionStorage.setItem('presetId', body.preset_id);
            sessionStorage.setItem('mapAssetId',result.state.map_asset_id||body.preset_id);
            window.location.href = 'game.html';
        } catch (error) {
            showError('Could not begin the campaign. '+error.message+' You can try Begin again.');
            retry.hidden=true;
            submitting = false;
            updateControls();
            startBtn.textContent = historical ? 'Begin Battle' : 'Begin Campaign';
        }
    });
    function renderGallery() {
        const cards=visible;
        grid.replaceChildren(...cards.map(preset=>{
            const card=document.createElement('label');card.className='map-card';
            const radio=document.createElement('input');radio.type='radio';radio.name='preset';radio.value=preset.id;
            radio.checked=preset.id===selected;
            radio.addEventListener('change',()=>{if(radio.checked)chooseMap(preset);});
            const image=document.createElement('img');
            image.src=`maps/thumbnails/${encodeURIComponent(preset.map_asset_id||preset.id)}.svg`;
            image.alt='';image.decoding='async';image.width=300;image.height=180;
            const title=document.createElement('strong');title.textContent=preset.name;
            const detail=document.createElement('span');detail.textContent=`${preset.region_count} ${preset.battle?'sectors':'regions'}`;
            card.append(radio,image,title,detail);return card;
        }));
        if(!cards.length)grid.textContent='No maps available in this category. Choose another category.';
        grid.setAttribute('aria-busy','false');
        grid.scrollTop=0;
        document.querySelector('.map-scroll-hint').hidden=grid.scrollHeight<=grid.clientHeight;
        updateControls();
    }
    function showCategory(category) {
        visible=catalog.filter(p=>(p.category||'world')===category);
        document.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)));
        document.getElementById('category-description').textContent=`${visible.length} maps · ${{world:'Open-ended conquest',historical:'Focused battles with fixed forces',campaigns:'Campaigns through history',sieges:'Fortified cities and approaches',legends:'Worlds of epic and imagination'}[category]||'Choose your theater'}`;
        renderGallery();
        if(visible.length)return chooseMap(visible[0]);
        ++sequence;selected='';starts=[];ready=false;
        document.getElementById('selected-map-title').textContent='Choose another category';
        document.getElementById('selected-map-preview').hidden=true;
        document.getElementById('selected-map-summary').textContent='';
        document.getElementById('battle-essentials').hidden=true;
        document.getElementById('battle-briefing').replaceChildren();
        document.getElementById('mobile-selection').textContent='Choose your map';
        document.getElementById('starting-details').textContent='';
        description.textContent='';preview.textContent='';retry.hidden=true;errorMsg.classList.add('hidden');
        kingdom.replaceChildren(new Option('No starting options',''));updateControls();
    }
    document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
        if(!submitting&&button.getAttribute('aria-pressed')!=='true')showCategory(button.dataset.category);
    }));
    try {
        catalog=await api.getPresets();
        if(!catalog.length)throw new Error('No maps available. Please reload to try again.');
        await showCategory('world');
    } catch(error) {
        grid.textContent='Maps unavailable. Please try again.';grid.setAttribute('aria-busy','false');
        showError(error.message);
    }
})();
