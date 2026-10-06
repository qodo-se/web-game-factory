(async function () {
    const form = document.getElementById('new-game-form');
    const startBtn = document.getElementById('start-btn');
    const errorMsg = document.getElementById('error-msg');
    const grid = document.getElementById('map-grid');
    const loadThumbnail=image=>{
        if(image?.dataset.src){image.src=image.dataset.src;delete image.dataset.src;}
    };
    const thumbnails=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
        for(const entry of entries)if(entry.isIntersecting){loadThumbnail(entry.target);thumbnails.unobserve(entry.target);}
    },{root:grid,rootMargin:'150px'});
    const description = document.getElementById('preset-desc');
    const kingdom = document.getElementById('kingdom-select');
    const preview = document.getElementById('kingdom-preview');
    const mobile = matchMedia('(max-width:760px)');
    const nextStep = document.getElementById('continue-setup');
    let catalog=[];
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
    const galleryResize=new ResizeObserver(()=>{document.querySelector('.map-scroll-hint').hidden=grid.scrollHeight<=grid.clientHeight;});
    galleryResize.observe(grid);

    function updateControls() {
        form.querySelectorAll('input, select, button').forEach(el => { el.disabled = submitting; });
        kingdom.disabled = submitting || !ready;
        startBtn.disabled = submitting || !ready;
        nextStep.disabled = submitting || !ready;
        for(const tab of tabs)tab.disabled=submitting;
    }
    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
        retry.hidden=false;
    }
    function previewKingdom() {
        const choice = starts.find(c => String(c.id ?? '') === kingdom.value);
        preview.textContent = choice ? `${choice.army} troops · +${choice.growth}/turn · ${choice.difficulty}` : '';
        document.getElementById('starting-details').textContent=choice
            ? `${choice.regions.join(' · ')}. Rival seat: ${choice.rival}. Difficulty reflects starting strength, not a victory prediction.` : '';
    }
    kingdom.addEventListener('change', previewKingdom);
    async function chooseMap(preset) {
        if (submitting) return;
        selected = preset.id;
        grid.querySelectorAll('input').forEach(input=>{input.checked=input.value===selected;});
        loadThumbnail(grid.querySelector('input:checked')?.closest('label').querySelector('img'));
        document.getElementById('selected-map-title').textContent=preset.name;
        document.getElementById('selected-map-summary').textContent=`${preset.region_count} regions · ${preset.category==='historical'?'Historical theater':'Open-ended conquest'}`;
        document.getElementById('mobile-selection').textContent=`Selected: ${preset.name}`;
        const thumbnail=document.getElementById('selected-map-preview');
        thumbnail.hidden=false;thumbnail.src=`maps/thumbnails/${encodeURIComponent(preset.map_asset_id||preset.id)}.svg`;
        document.getElementById('map-details').open=false;
        retry.hidden=true;
        retryAction=()=>chooseMap(preset);
        const briefing = document.getElementById('map-briefing');
        briefing.hidden = !preset.setting;
        briefing.replaceChildren();
        if (preset.setting) {
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
        kingdom.replaceChildren(new Option('Loading kingdoms…', ''));
        preview.textContent = '';document.getElementById('starting-details').textContent='';
        updateControls();
        try {
            const choices = await api.getStarts(selected,preset.map_asset_id||'');
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
            startBtn.textContent = 'Begin Campaign';
        }
    });
    function renderGallery() {
        const cards=catalog;
        thumbnails?.disconnect();
        grid.replaceChildren(...cards.map(preset=>{
            const card=document.createElement('label');card.className='map-card';
            const radio=document.createElement('input');radio.type='radio';radio.name='preset';radio.value=preset.id;
            radio.checked=preset.id===selected;
            radio.addEventListener('change',()=>{if(radio.checked)chooseMap(preset);});
            const image=document.createElement('img');
            image.dataset.src=`maps/thumbnails/${encodeURIComponent(preset.map_asset_id||preset.id)}.svg`;
            image.alt='';image.decoding='async';image.width=300;image.height=180;
            const title=document.createElement('strong');title.textContent=preset.name;
            const detail=document.createElement('span');detail.className='map-region-count';detail.textContent=preset.region_count;
            detail.title=`${preset.region_count} regions`;detail.setAttribute('aria-label',detail.title);
            const caption=document.createElement('div');caption.className='map-card-caption';caption.append(title,detail);
            card.append(radio,image,caption);
            if(thumbnails)thumbnails.observe(image);else loadThumbnail(image);
            return card;
        }));
        if(!cards.length)grid.textContent='No maps available. Please try again later.';
        grid.setAttribute('aria-busy','false');
        grid.scrollTop=0;
        document.querySelector('.map-scroll-hint').hidden=grid.scrollHeight<=grid.clientHeight;
        updateControls();
    }
    try {
        // Only offer theaters shipped in this website build, including when an
        // older API still advertises retired regional or historical maps.
        const available=new Set([
            'mediterranean','europe','americas','africa_middle_east','central_asia',
            'balochistan_borderlands_expanded','india','southeast_asia_oceania',
            'japan_korea','british_irish_isles','anatolia_caucasus',
            'crusader_levant','civil_war_eastern_theater','greco_persian',
            'viking_conquests','norman_england_1066',
        ]);
        catalog=(await api.getPresets()).filter(p=>available.has(p.id));
        if(!catalog.length)throw new Error('No maps available. Please reload to try again.');
        document.getElementById('map-gallery-description').textContent=`${catalog.length} maps · Open-ended conquest`;
        renderGallery();
        await chooseMap(catalog[0]);
    } catch(error) {
        grid.textContent='Maps unavailable. Please try again.';grid.setAttribute('aria-busy','false');
        showError(error.message);
    }
})();
