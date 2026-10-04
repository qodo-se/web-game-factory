(async function () {
    const form = document.getElementById('new-game-form');
    const startBtn = document.getElementById('start-btn');
    const errorMsg = document.getElementById('error-msg');
    const grid = document.getElementById('map-grid');
    const description = document.getElementById('preset-desc');
    const kingdom = document.getElementById('kingdom-select');
    const preview = document.getElementById('kingdom-preview');
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
        preview.textContent = choice ? `${choice.regions.join(' · ')}. ${choice.army} troops · +${choice.growth} recruits/turn. Rival seat: ${choice.rival}. ${choice.difficulty} — based on starting army strength, not a victory prediction.` : '';
    }
    kingdom.addEventListener('change', previewKingdom);
    async function chooseMap(preset) {
        if (submitting) return;
        selected = preset.id;
        description.textContent = preset.description;
        errorMsg.classList.add('hidden');
        const request = ++sequence;
        ready = false;
        kingdom.replaceChildren(new Option('Loading kingdoms…', ''));
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
            startBtn.textContent = 'Begin Campaign';
        }
    });
    try {
        const presets = await api.getPresets();
        if (!presets.length) throw new Error('No maps available. Please reload to try again.');
        grid.replaceChildren(...presets.map((preset, index) => {
            const card = document.createElement('label');
            card.className = 'map-card';
            const radio = document.createElement('input');
            radio.type = 'radio'; radio.name = 'preset'; radio.value = preset.id;
            radio.checked = index === 0;
            radio.addEventListener('change', () => { if (radio.checked) chooseMap(preset); });
            const image = document.createElement('img');
            image.src = `maps/thumbnails/${encodeURIComponent(preset.id)}.svg`;
            image.alt = ''; image.width = 300; image.height = 180;
            const title = document.createElement('strong'); title.textContent = preset.name;
            const detail = document.createElement('span'); detail.textContent = `${preset.region_count} regions`;
            card.append(radio, image, title, detail);
            return card;
        }));
        grid.setAttribute('aria-busy', 'false');
        await chooseMap(presets[0]);
    } catch (error) {
        grid.textContent = 'Maps unavailable. Please reload to try again.';
        grid.setAttribute('aria-busy', 'false');
        showError(error.message);
    }
})();
