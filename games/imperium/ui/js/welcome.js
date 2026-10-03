(async function () {
    const form       = document.getElementById('new-game-form');
    const startBtn   = document.getElementById('start-btn');
    const errorMsg   = document.getElementById('error-msg');
    const presetSel  = document.getElementById('preset-select');
    const presetDesc = document.getElementById('preset-desc');
    const presetOpts = document.getElementById('preset-options');
    const randomOpts = document.getElementById('random-options');
    const tabs       = document.querySelectorAll('.mode-tabs .tab');

    let mode = 'preset';
    let presetsData = [];

    // ── Mode tabs ────────────────────────────────────────────────────────────
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            mode = tab.dataset.mode;
            if (mode === 'preset') {
                presetOpts.classList.remove('hidden');
                randomOpts.classList.add('hidden');
            } else {
                presetOpts.classList.add('hidden');
                randomOpts.classList.remove('hidden');
            }
        });
    });

    // ── Load presets ─────────────────────────────────────────────────────────
    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    }

    function updateDesc() {
        const selected = presetsData.find(p => p.id === presetSel.value);
        presetDesc.textContent = selected ? selected.description : '';
    }

    presetSel.addEventListener('change', updateDesc);

    // ── Form submit — registered before async load so early clicks are caught ─
    startBtn.disabled = true;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (startBtn.disabled) return;
        errorMsg.classList.add('hidden');

        const playerName = document.getElementById('player-name').value.trim() || 'Consul';
        startBtn.disabled = true;
        startBtn.textContent = 'Marshalling forces…';

        const body = { player_name: playerName, mode };
        if (mode === 'preset') {
            body.preset_id = presetSel.value;
        } else {
            body.map_size = document.querySelector('input[name="map-size"]:checked').value;
        }

        try {
            const result = await api.newGame(body);
            sessionStorage.setItem('gameId', result.game_id);
            sessionStorage.setItem('playerName', playerName);
            sessionStorage.setItem('presetId', mode === 'preset' ? body.preset_id : '');
            window.location.href = 'game.html';
        } catch (e) {
            showError(e.message);
            startBtn.disabled = false;
            startBtn.textContent = 'Begin Campaign';
        }
    });

    // ── Load presets (after handler is registered) ────────────────────────────
    try {
        presetsData = await api.getPresets();
        presetSel.innerHTML = presetsData
            .map(p => `<option value="${p.id}">${p.name} (${p.region_count} regions)</option>`)
            .join('');
        updateDesc();
        startBtn.disabled = false;
    } catch (e) {
        presetSel.innerHTML = '<option value="">Failed to load</option>';
        showError(e.message);
    }
})();
