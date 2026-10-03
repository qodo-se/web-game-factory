// Imperium API client
// In production, nginx proxies /api/* to the backend service.
// For local dev, set API base in browser console:
//   localStorage.setItem('IMPERIUM_API_BASE', 'http://localhost:8080')
const API_BASE = localStorage.getItem('IMPERIUM_API_BASE') || '';

async function _req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    let res;
    try {
        res = await fetch(API_BASE + path, opts);
    } catch (e) {
        throw new Error('Cannot reach the game server. Is it running?');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Server error ${res.status}`);
    }
    return res.json();
}

const api = {
    getPresets:    ()          => _req('GET',  '/api/imperium/presets'),
    newGame:       (body)      => _req('POST', '/api/imperium/games', body),
    getGame:       (id)        => _req('GET',  `/api/imperium/games/${id}`),
    getValidMoves: (id)        => _req('GET',  `/api/imperium/games/${id}/valid-moves`),
    submitTurn:    (id, moves) => _req('POST', `/api/imperium/games/${id}/turn`, { moves }),
};
