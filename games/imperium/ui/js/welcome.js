(async function () {
    const form = document.getElementById('new-game-form');
    const startBtn = document.getElementById('start-btn');
    const errorMsg = document.getElementById('error-msg');
    const grid = document.getElementById('map-grid');
    const description = document.getElementById('preset-desc');
    const kingdom = document.getElementById('kingdom-select');
    const preview = document.getElementById('kingdom-preview');
    let historical = false;
    let selected = '', starts = [], sequence = 0, ready = false, submitting = false;
    campaigns.render();

    function updateControls() {
        form.querySelectorAll('input, select, button').forEach(el => { el.disabled = submitting; });
        kingdom.disabled = submitting || !ready;
        startBtn.disabled = submitting || !ready;
    }
    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
    }
    function previewKingdom() {
        const choice = starts.find(c => String(c.id ?? '') === kingdom.value);
        preview.textContent = choice ? (historical
            ? `${choice.army} army strength · ${choice.regions.length} sectors · No recruitment. ${choice.difficulty} — based on starting strength only.`
            : `${choice.regions.join(' · ')}. ${choice.army} troops · +${choice.growth} recruits/turn. Rival seat: ${choice.rival}. ${choice.difficulty} — based on starting army strength, not a victory prediction.`) : '';
    }
    kingdom.addEventListener('change', previewKingdom);
    async function chooseMap(preset) {
        if (submitting) return;
        selected = preset.id;
        historical = preset.category === 'historical';
        document.getElementById('starting-label').textContent = historical ? 'Choose your side' : 'Starting kingdom';
        startBtn.textContent = historical ? 'Begin Battle' : 'Begin Campaign';
        const briefing = document.getElementById('battle-briefing');
        briefing.hidden = !historical;
        briefing.replaceChildren();
        if (preset.battle) {
            const intro = document.createElement('p');
            intro.textContent = `${preset.battle.date} · ${preset.battle.commanders.join(' vs ')}`;
            const rules = document.createElement('p');
            rules.textContent = '20 turns · Fixed forces · 3 objectives. Eliminate the opposing army, or hold more objectives at the end. Ties: remaining strength, then the historical defender.';
            const details = document.createElement('details');
            const summary = document.createElement('summary'); summary.textContent = 'Historical context & sources';
            const context = document.createElement('p'); context.textContent = preset.battle.context;
            const note = document.createElement('p'); note.textContent = 'Measured elevation with reconstructed historical woodland, fields and routes. Sector boundaries and army strengths are designed for play.';
            details.append(summary, context, note);
            for (const [name, url] of preset.battle.sources) {
                if (!url.startsWith('https://')) continue;
                const link = document.createElement('a');link.textContent = name;link.href = url;link.target = '_blank';link.rel = 'noopener noreferrer';
                details.append(link);
            }
            const terrainLink=document.createElement('a');terrainLink.href='maps/battle-sources.html';terrainLink.target='_blank';terrainLink.rel='noopener';terrainLink.textContent='Terrain data & reconstruction notes';details.append(terrainLink);
            briefing.append(intro, rules, details);
        }
        description.textContent = preset.description;
        errorMsg.classList.add('hidden');
        const request = ++sequence;
        ready = false;
        kingdom.replaceChildren(new Option(historical ? 'Loading sides…' : 'Loading kingdoms…', ''));
        preview.textContent = '';
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
            window.location.href = 'game.html';
        } catch (error) {
            showError(error.message);
            submitting = false;
            updateControls();
            startBtn.textContent = historical ? 'Begin Battle' : 'Begin Campaign';
        }
    });
    try {
        const presets = await api.getPresets();
        if (!presets.length) throw new Error('No maps available. Please reload to try again.');
        function showCategory(category, preferred) {
        const visible = presets.filter(p => (p.category || 'world') === category);
        const active = preferred || visible[0];
        document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
        document.getElementById('category-description').textContent = category === 'historical' ? `${visible.length} focused ${visible.length === 1 ? 'battle' : 'battles'}. Choose either side and change the outcome.` : `${visible.length} ${visible.length === 1 ? 'theater' : 'theaters'} for an open-ended campaign of conquest.`;
        if (!active) {
            ++sequence; // Ignore any start preview still loading from the previous category.
            selected = ''; starts = []; ready = false;
            historical = category === 'historical';
            startBtn.textContent = historical ? 'Begin Battle' : 'Begin Campaign';
            document.getElementById('starting-label').textContent = historical ? 'Choose your side' : 'Starting kingdom';
            document.getElementById('battle-briefing').hidden = true;
            document.getElementById('battle-briefing').replaceChildren();
            description.textContent = ''; preview.textContent = '';
            errorMsg.classList.add('hidden');
            kingdom.replaceChildren(new Option('No maps available', ''));
            grid.textContent = 'No maps available in this category yet. Choose another category or reload.';
            grid.setAttribute('aria-busy', 'false');
            updateControls();
            return;
        }
        grid.replaceChildren(...visible.map(preset => {
            const card = document.createElement('label');
            card.className = 'map-card';
            const radio = document.createElement('input');
            radio.type = 'radio'; radio.name = 'preset'; radio.value = preset.id;
            radio.checked = preset.id === active.id;
            radio.addEventListener('change', () => { if (radio.checked) chooseMap(preset); });
            const image = document.createElement('img');
            image.src = `maps/thumbnails/${encodeURIComponent(preset.id)}.svg`;
            image.alt = ''; image.width = 300; image.height = 180;
            const title = document.createElement('strong'); title.textContent = preset.name;
            const detail = document.createElement('span'); detail.textContent = `${preset.region_count} ${preset.category === 'historical' ? 'sectors · 20 turns' : 'regions'}`;
            card.append(radio, image, title, detail);
            return card;
        }));
        grid.setAttribute('aria-busy', 'false');
        return chooseMap(active);
        }
        document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
            if (submitting || button.getAttribute('aria-pressed') === 'true') return;
            showCategory(button.dataset.category);
        }));
        await showCategory('world');
    } catch (error) {
        grid.textContent = 'Maps unavailable. Please reload to try again.';
        grid.setAttribute('aria-busy', 'false');
        showError(error.message);
    }
})();
