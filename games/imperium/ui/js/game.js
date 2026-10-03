// ── Constants ─────────────────────────────────────────────────────────────────

const TERRAIN_FILL = {
    city:   '#6b4e18',
    plains: '#2d5e2a',
    hills:  '#5a4230',
    desert: '#8a7128',
    forest: '#1a4520',
    coast:  '#1a3e6a',
};

const OWNER_STROKE = {
    player_1: '#4a90d4',
    player_2: '#d44a4a',
    rogue:    '#505062',
};

const TERRAIN_LABEL = {
    city:   '★',
    plains: '',
    hills:  '',
    desert: '',
    forest: '',
    coast:  '',
};

const MAP_W = 1000, MAP_H = 650;
const PAD_X = 75,   PAD_Y = 55;
const REGION_R = 22;

// ── State ─────────────────────────────────────────────────────────────────────

let gameId       = null;
let state        = null;     // full game state from API
let validMoves   = {};       // { regionId: [neighborIds] }
let selectedFrom = null;     // currently selected from-region id (number)
let pendingMoves = [];       // [{from_region_id, to_region_id}]
let resolving    = false;
let scaleCache   = null;     // bounding-box scale, computed once per state load

// ── SVG helpers ───────────────────────────────────────────────────────────────

function el(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
}

function computeScale(regions) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of Object.values(regions)) {
        if (r.x < minX) minX = r.x;
        if (r.x > maxX) maxX = r.x;
        if (r.y < minY) minY = r.y;
        if (r.y > maxY) maxY = r.y;
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    return { minX, minY, rangeX, rangeY };
}

function toSVG(rx, ry) {
    const s = scaleCache;
    return {
        x: ((rx - s.minX) / s.rangeX) * (MAP_W - 2 * PAD_X) + PAD_X,
        y: ((ry - s.minY) / s.rangeY) * (MAP_H - 2 * PAD_Y) + PAD_Y,
    };
}

// ── Map rendering ─────────────────────────────────────────────────────────────

function renderMap() {
    const regions = state.regions;
    scaleCache = computeScale(regions);

    const gEdges   = document.getElementById('g-edges');
    const gArrows  = document.getElementById('g-arrows');
    const gRegions = document.getElementById('g-regions');

    gEdges.innerHTML   = '';
    gArrows.innerHTML  = '';
    gRegions.innerHTML = '';

    drawEdges(gEdges, regions);
    drawRegions(gRegions, regions);
    drawArrows(gArrows, regions);
}

function drawEdges(parent, regions) {
    const seen = new Set();
    for (const [rid, r] of Object.entries(regions)) {
        const p1 = toSVG(r.x, r.y);
        for (const nid of r.neighbors) {
            const key = Math.min(+rid, nid) + '-' + Math.max(+rid, nid);
            if (seen.has(key)) continue;
            seen.add(key);
            const n = regions[nid];
            if (!n) continue;
            const p2 = toSVG(n.x, n.y);
            parent.appendChild(el('line', {
                x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
                stroke: '#252540',
                'stroke-width': 1.5,
            }));
        }
    }
}

function drawRegions(parent, regions) {
    const committedFrom = new Set(pendingMoves.map(m => m.from_region_id));
    const validTargets  = selectedFrom !== null
        ? new Set(validMoves[selectedFrom] || [])
        : new Set();

    for (const r of Object.values(regions)) {
        const { x, y } = toSVG(r.x, r.y);
        const isSelected   = selectedFrom === r.id;
        const isTarget     = validTargets.has(r.id);
        const isCommitted  = committedFrom.has(r.id);
        const isSelectable = validMoves[r.id] !== undefined && !committedFrom.has(r.id);
        const stroke       = OWNER_STROKE[r.owner];

        const g = el('g', {
            'class': [
                'region',
                r.owner,
                isSelectable ? 'selectable' : '',
                isTarget     ? 'valid-target' : '',
            ].filter(Boolean).join(' '),
            'data-id': r.id,
        });

        // Selected glow ring
        if (isSelected) {
            g.appendChild(el('circle', {
                cx: x, cy: y, r: REGION_R + 10,
                fill: 'none',
                stroke: stroke,
                'stroke-width': 1.5,
                opacity: 0.5,
                filter: 'url(#glow-p1)',
            }));
        }

        // Valid target dashed ring
        if (isTarget) {
            g.appendChild(el('circle', {
                cx: x, cy: y, r: REGION_R + 8,
                fill: 'none',
                stroke: '#d4a840',
                'stroke-width': 1.5,
                opacity: 0.8,
                'stroke-dasharray': '5 3',
            }));
        }

        // Capital outer ring
        if (r.is_capital) {
            g.appendChild(el('circle', {
                cx: x, cy: y, r: REGION_R + 4,
                fill: 'none',
                stroke: stroke,
                'stroke-width': 1,
                opacity: 0.5,
            }));
        }

        // Main region circle
        g.appendChild(el('circle', {
            cx: x, cy: y, r: REGION_R,
            fill: TERRAIN_FILL[r.terrain],
            stroke: stroke,
            'stroke-width': isSelected ? 3 : 2,
            opacity: isCommitted ? 0.45 : 1,
        }));

        // Capital indicator (small gold dot above)
        if (r.is_capital) {
            g.appendChild(el('circle', {
                cx: x, cy: y - REGION_R - 7,
                r: 3.5,
                fill: '#d4a840',
            }));
        }

        // Army count
        const armyTxt = el('text', {
            x, y: y + 1,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            fill: isCommitted ? '#666' : '#ffffff',
            'font-size': r.army >= 100 ? '9' : '11',
            'font-weight': 'bold',
            'pointer-events': 'none',
            'font-family': 'Arial, sans-serif',
        });
        armyTxt.textContent = r.army;
        g.appendChild(armyTxt);

        // Region name (below)
        const nameTxt = el('text', {
            x, y: y + REGION_R + 11,
            'text-anchor': 'middle',
            fill: isSelected ? '#e8e0d0' : '#8888a8',
            'font-size': '7.5',
            'pointer-events': 'none',
            'font-family': 'Georgia, serif',
        });
        nameTxt.textContent = r.name;
        g.appendChild(nameTxt);

        g.addEventListener('click', () => handleRegionClick(r.id));
        g.addEventListener('mouseenter', () => updateRegionInfo(r.id));
        g.addEventListener('mouseleave', () => {
            if (selectedFrom === null) clearRegionInfo();
        });

        parent.appendChild(g);
    }
}

function drawArrows(parent, regions) {
    for (const mv of pendingMoves) {
        const from = regions[mv.from_region_id];
        const to   = regions[mv.to_region_id];
        if (!from || !to) continue;

        const p1 = toSVG(from.x, from.y);
        const p2 = toSVG(to.x, to.y);
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len, ny = dy / len;
        const gap = REGION_R + 3;
        const sx = p1.x + nx * gap, sy = p1.y + ny * gap;
        const ex = p2.x - nx * (gap + 8), ey = p2.y - ny * (gap + 8);

        parent.appendChild(el('line', {
            x1: sx, y1: sy, x2: ex, y2: ey,
            stroke: '#d4a840',
            'stroke-width': 2,
            'stroke-dasharray': '7 4',
            'marker-end': 'url(#arr-gold)',
            opacity: 0.9,
        }));
    }
}

// ── Interaction ───────────────────────────────────────────────────────────────

function handleRegionClick(id) {
    if (resolving) return;

    const r = state.regions[id];
    const committedFromIds = new Set(pendingMoves.map(m => m.from_region_id));

    if (selectedFrom !== null) {
        // Something is selected — try to add a move
        if (id === selectedFrom) {
            // Click same region → deselect
            selectedFrom = null;
            renderMap();
            updateMoveHint();
            return;
        }

        const targets = validMoves[selectedFrom] || [];
        if (targets.includes(id)) {
            pendingMoves.push({ from_region_id: selectedFrom, to_region_id: id });
            selectedFrom = null;
            renderMap();
            updateMovesList();
            updateMoveHint();
            return;
        }

        // Clicked a different own region → switch selection
        if (r.owner === 'player_1' && validMoves[id] !== undefined && !committedFromIds.has(id)) {
            selectedFrom = id;
            renderMap();
            updateRegionInfo(id);
            updateMoveHint();
            return;
        }

        // Clicked somewhere invalid → deselect
        selectedFrom = null;
        renderMap();
        updateMoveHint();
        return;
    }

    // Nothing selected
    if (r.owner === 'player_1' && validMoves[id] !== undefined && !committedFromIds.has(id)) {
        selectedFrom = id;
        renderMap();
        updateRegionInfo(id);
        updateMoveHint();
    } else {
        updateRegionInfo(id);
    }
}

function removePendingMove(fromId) {
    pendingMoves = pendingMoves.filter(m => m.from_region_id !== fromId);
    renderMap();
    updateMovesList();
    updateMoveHint();
}

// ── UI updates ────────────────────────────────────────────────────────────────

function updateTopBar() {
    document.getElementById('turn-num').textContent      = state.turn;
    document.getElementById('p1-name').textContent       = state.player_1.name;
    document.getElementById('p1-regions').textContent    = state.player_1.regions;
    document.getElementById('p1-army').textContent       = state.player_1.total_army;
    document.getElementById('p2-name').textContent       = state.player_2.name;
    document.getElementById('p2-regions').textContent    = state.player_2.regions;
    document.getElementById('p2-army').textContent       = state.player_2.total_army;
}

function updateRegionInfo(id) {
    const r = state.regions[id];
    if (!r) return;

    const ownerNames = { player_1: state.player_1.name, player_2: state.player_2.name, rogue: 'Neutral' };
    const ownerClasses = { player_1: 'p1-text', player_2: 'p2-text', rogue: 'rogue-text' };

    document.getElementById('region-info').innerHTML = `
        <div class="region-name">${r.name}${r.is_capital ? ' ★' : ''}</div>
        <div class="region-row"><span>Owner</span><span class="${ownerClasses[r.owner]}">${ownerNames[r.owner]}</span></div>
        <div class="region-row"><span>Terrain</span><span>${capitalise(r.terrain)}</span></div>
        <div class="region-row"><span>Army</span><span>${r.army}</span></div>
        <div class="region-row"><span>Growth</span><span>+${r.pop_rate}/turn</span></div>
        <div class="region-row"><span>Defense</span><span>×${r.defense_bonus.toFixed(2)}</span></div>
    `;
}

function clearRegionInfo() {
    document.getElementById('region-info').innerHTML =
        '<p class="no-selection">Click a region to inspect it.</p>';
}

function updateMovesList() {
    const list = document.getElementById('moves-list');

    if (pendingMoves.length === 0) {
        list.innerHTML = '<p class="no-moves-msg">No moves planned. Select one of your regions to order an advance.</p>';
        return;
    }

    list.innerHTML = pendingMoves.map(m => {
        const from = state.regions[m.from_region_id];
        const to   = state.regions[m.to_region_id];
        return `
            <div class="move-item">
                <span class="move-arrow">→</span>
                <span class="move-regions"><b>${from.name}</b> → ${to.name}</span>
                <button class="move-remove" onclick="removePendingMove(${m.from_region_id})" title="Cancel">×</button>
            </div>
        `;
    }).join('');
}

function updateMoveHint() {
    const hint = document.getElementById('move-hint');
    const committed = new Set(pendingMoves.map(m => m.from_region_id));
    const available = Object.keys(validMoves).filter(id => !committed.has(+id)).length;

    if (selectedFrom !== null) {
        const r = state.regions[selectedFrom];
        const targets = validMoves[selectedFrom] || [];
        hint.textContent = `${r.name} selected — choose a destination (${targets.length} options).`;
    } else if (pendingMoves.length > 0 && available === 0) {
        hint.textContent = `All moves planned. Click End Turn when ready.`;
    } else if (available > 0) {
        hint.textContent = `${available} region${available !== 1 ? 's' : ''} can still move. Click End Turn to pass remaining.`;
    } else {
        hint.textContent = `No moves available. Click End Turn.`;
    }
}

function showCombatLog(summary) {
    const section = document.getElementById('combat-log-section');
    const log     = document.getElementById('combat-log');
    const movesList = document.getElementById('moves-list');

    document.getElementById('log-turn').textContent = summary.turn;
    document.getElementById('panel-moves-label').textContent = 'Planned Moves';
    movesList.classList.add('hidden');
    section.classList.remove('hidden');
    log.classList.remove('hidden');

    if (summary.combat_results.length === 0) {
        log.innerHTML = '<div class="log-entry" style="color:#8888a8;font-style:italic;">No battles this turn.</div>';
        return;
    }

    log.innerHTML = summary.combat_results.map(c => {
        const fromR = state.regions[c.attacker_region_id];
        const toR   = state.regions[c.defender_region_id];
        const won   = c.attacker_won;
        return `
            <div class="log-entry">
                <span class="log-outcome ${won ? 'won' : 'lost'}">${won ? 'Victory' : 'Repelled'}</span>
                <br>${fromR ? fromR.name : '?'} → ${toR ? toR.name : '?'}
                <br><span style="color:#666880">${c.attacker_army} vs ${c.effective_defender_army} eff. · ${c.survivors} survivors</span>
            </div>
        `;
    }).join('');
}

function hideCombatLog() {
    document.getElementById('combat-log-section').classList.add('hidden');
    document.getElementById('combat-log').classList.add('hidden');
    document.getElementById('moves-list').classList.remove('hidden');
    document.getElementById('panel-moves-label').textContent = 'Planned Moves';
}

function setResolving(on) {
    resolving = on;
    document.getElementById('resolving-overlay').classList.toggle('hidden', !on);
    document.getElementById('end-turn-btn').disabled = on;
}

// ── Turn submission ───────────────────────────────────────────────────────────

async function endTurn() {
    if (resolving) return;

    setResolving(true);
    selectedFrom = null;

    try {
        const result = await api.submitTurn(gameId, pendingMoves);
        pendingMoves = [];

        // Update state
        state = result.state;
        // Patch state with player names from local state (API omits nothing here)
        updateTopBar();
        renderMap();

        if (result.game_over) {
            handleGameOver(result.winner);
            return;
        }

        // Fetch new valid moves
        const vm = await api.getValidMoves(gameId);
        // validMoves comes back as { "0": [...], "1": [...] } — convert keys to numbers
        validMoves = {};
        for (const [k, v] of Object.entries(vm)) {
            validMoves[+k] = v;
        }

        setResolving(false);
        showCombatLog(result);
        renderMap();
        updateMovesList();
        updateMoveHint();

    } catch (e) {
        setResolving(false);
        alert('Error: ' + e.message);
    }
}

function handleGameOver(winner) {
    const isVictory = winner === 'player_1';
    const overlay   = document.getElementById('gameover-overlay');
    const title     = document.getElementById('gameover-title');
    const subtitle  = document.getElementById('gameover-subtitle');

    title.textContent = isVictory ? 'VICTORY' : 'DEFEAT';
    title.style.color = isVictory ? '#d4a840' : '#d44a4a';
    subtitle.textContent = isVictory
        ? `${state.player_1.name} conquers all.`
        : `${state.player_2.name} prevails.`;

    overlay.classList.remove('hidden');
    setResolving(false);

    sessionStorage.setItem('winner', winner);
    sessionStorage.setItem('winnerName', isVictory ? state.player_1.name : state.player_2.name);
    sessionStorage.setItem('turns', state.turn);
    sessionStorage.setItem('p1regions', state.player_1.regions);
    sessionStorage.setItem('p2regions', state.player_2.regions);

    setTimeout(() => { window.location.href = 'summary.html'; }, 3500);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

async function init() {
    gameId = sessionStorage.getItem('gameId');
    if (!gameId) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('end-turn-btn').addEventListener('click', endTurn);

    try {
        const [gameData, vm] = await Promise.all([
            api.getGame(gameId),
            api.getValidMoves(gameId),
        ]);

        state = gameData.state;
        validMoves = {};
        for (const [k, v] of Object.entries(vm)) {
            validMoves[+k] = v;
        }

        updateTopBar();
        renderMap();
        updateMoveHint();

    } catch (e) {
        alert('Failed to load game: ' + e.message);
        window.location.href = 'index.html';
    }
}

init();
