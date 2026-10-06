// Portable files contain the last committed turn and its full replay history.
const campaignFiles = {
    limit: 16 * 1024 * 1024,
    expiry(value) {
        if (!value) return 'Download a save to keep this campaign.';
        const date = new Date(value);
        return `Server save expires ${date.toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'})}.`;
    },
    async download(id, button, status) {
        button.disabled = true;
        clearTimeout(status.hideTimer);
        status.hidden = false;
        status.textContent = 'Preparing download…';
        try {
            const response = await fetch(`${API_BASE}/api/imperium/games/${encodeURIComponent(id)}/download`);
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Could not download this campaign. Please try again.');
            }
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = `borderstrife-${id.slice(0,8)}.borderstrife.json`;
            document.body.append(link);link.click();link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            status.textContent = 'Save downloaded. Keep the file to restore this campaign later.';
        } catch (error) { status.textContent = error.message; }
        finally {
            button.disabled = false;
            if (status.id === 'download-status') status.hideTimer = setTimeout(() => { status.hidden = true; }, 10000);
        }
    },
    async restore(file, input, status) {
        if (!file) return;
        input.disabled = true;
        status.textContent = 'Checking and restoring save…';
        try {
            if (file.size > this.limit) throw new Error('Save files must be 16 MB or smaller.');
            const response = await fetch(`${API_BASE}/api/imperium/games/restore`, {
                method:'POST', headers:{'Content-Type':'application/json'}, body:file,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.detail || 'Could not restore this file. Please try again.');
            campaigns.remember(data.game_id, data.state);
            sessionStorage.setItem('gameId', data.game_id);
            sessionStorage.setItem('presetId', data.state.preset_id || '');
            sessionStorage.setItem('mapAssetId', data.state.map_asset_id || '');
            if (data.state.game_over) sessionStorage.setItem('restoredReplay', data.game_id);
            location.href = 'game.html';
        } catch (error) { status.textContent = error.message; }
        finally { input.disabled = false; input.value = ''; }
    },
    updateGameButtons() {
        for (const button of document.querySelectorAll('[data-campaign-download]')) button.disabled = resolving || !!this.gameDownloading;
    },
    initGame(id, state) {
        document.getElementById('campaign-expiry').textContent = this.expiry(state.expires_at);
        for (const button of document.querySelectorAll('[data-campaign-download]')) {
            button.addEventListener('click', async () => {
                if (resolving || this.gameDownloading) return;
                this.gameDownloading = true;
                this.updateGameButtons();
                const status = document.getElementById(button.id === 'download-completed' ? 'completed-download-status' : 'download-status');
                try { await this.download(id, button, status); }
                finally { this.gameDownloading = false; this.updateGameButtons(); }
            });
        }
    },
};
const restoreInput = document.getElementById('restore-campaign');
if (restoreInput) restoreInput.addEventListener('change', () => campaignFiles.restore(
    restoreInput.files[0], restoreInput, document.getElementById('restore-status')));
