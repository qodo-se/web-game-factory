const drawOffers = {
    busy: false,
    init() {
        document.getElementById('offer-draw').addEventListener('click', () => this.offer());
        document.getElementById('resign-btn').addEventListener('click', () => this.offer(true));
    },
    update() {
        if (!state) return;
        document.getElementById('offer-draw').hidden = state.game_over || campaignReplay.active;
        const resign = document.getElementById('resign-btn');
        resign.hidden = state.game_over || campaignReplay.active;
        resign.disabled = resolving || this.busy || state.game_over;
        const available = state.draw_available_turn ?? 30;
        document.getElementById('offer-draw').disabled = resolving || this.busy || state.turn < available || state.game_over;
        const button = document.getElementById('offer-draw');
        button.title = state.turn < available ? `Offer a draw on turn ${available}.` : 'Offer a draw. Acceptance ends the campaign; no turn is consumed.';
        const status = document.getElementById('draw-offer-status');
        if (!this.busy) {
            status.textContent = !state.game_over && state.draw_offer_message && state.turn < available ? `Offer again on turn ${available}.` : '';
            status.hidden = !status.textContent || campaignReplay.active;
        }
    },
    async offer(resign = false) {
        if (resolving || gameOver || campaignReplay.active || this.busy || (!resign && state.turn < (state.draw_available_turn ?? 30))) return;
        if (resign && !window.confirm('Resign this campaign? Your opponent wins. You can still download and replay the game.')) return;
        this.busy = true;
        setResolving(true);
        // Keep consideration inline; the map stays visible and plans stay intact.
        document.getElementById('resolving-overlay').classList.add('hidden');
        const status = document.getElementById('draw-offer-status');
        sidebar.open('timeline');
        status.hidden = false;
        status.textContent = resign ? 'Saving resignation…' : 'The opponent is considering your offer…';
        let failure = '';
        try {
            const result = await (resign ? api.resign(gameId, state.turn) : api.offerDraw(gameId, state.turn));
            state = result.state;
        } catch (error) {
            failure = error.message;
            try {
                const latest = await api.getGame(gameId);
                if (latest.state.turn !== state.turn) { window.location.reload(); return; }
                state = latest.state;
            } catch (_) { /* Keep the board intact; retry reconciles with the saved offer. */ }
        } finally {
            this.busy = false;
            setResolving(false);
        }
        // Bring the response into view even when the player was reading old turns.
        ++historyVersion;
        if(historyBrowsingOlder){
            historyBrowsingOlder=false;campaignHistory=[];historyMore=state.turn>1;
            await loadOlderHistory(true);
        }
        campaigns.remember(gameId, state);
        updateTopBar();
        renderTimeline();
        sidebar.open('timeline');
        document.getElementById('sidebar-timeline-body').scrollTop = 0;
        if (state.game_over) {
            standingOrders.editor = null;
            standingOrders.load();
            try { localStorage.removeItem(standingOrders.key()); } catch (_) { /* Finished saves ignore drafts. */ }
            pendingMoves = [];
            selectedFrom = null;
            updateMovesList();
            renderMap();
            handleGameOver(state.winner);
        } else if (failure) {
            status.hidden = false;
            status.textContent = `${failure} ${status.textContent}`;
        }
    },
};
