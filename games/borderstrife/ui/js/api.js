// BorderStrife API client. Legacy API routes and storage keys preserve compatibility.
// In production, nginx proxies /api/* to the backend service.
// For local dev, set API base in browser console:
//   localStorage.setItem('IMPERIUM_API_BASE', 'http://localhost:8080')
const API_BASE = localStorage.getItem('IMPERIUM_API_BASE') || '';

async function _req(method, path, body, signal) {
    const opts = { method, signal, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    let res;
    try {
        res = await fetch(API_BASE + path, opts);
    } catch (e) {
        if(e.name==='AbortError')throw e;
        throw new Error('Cannot reach the game server. Is it running?');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Server error ${res.status}`);
    }
    return res.json();
}

// A position is the current server snapshot object, not merely its turn number.
// Hover cancellation detaches a subscriber; other subscribers can reuse the request.
function createPositionCache(endpoint) { return {
    position: null, game: null, entries: new Map(), limit: 32,
    clear() {
        for (const entry of this.entries.values()) entry.controller.abort();
        this.entries.clear(); this.position = null; this.game = null;
    },
    get(id, position, moves, signal) {
        if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
        if (this.position !== position || this.game !== id) {
            this.clear(); this.position = position; this.game = id;
        }
        const orders = moves.map(m => ({from_region_id:m.from_region_id, to_region_id:m.to_region_id}));
        const key = JSON.stringify(orders);
        let entry = this.entries.get(key);
        if (!entry) {
            entry = {controller:new AbortController()};
            entry.promise = _req('POST', `/api/imperium/games/${id}/${endpoint}`, {moves:orders}, entry.controller.signal)
                .then(result => {
                    if (result.turn !== position.turn) throw new Error('Campaign changed. Reload to refresh analysis.');
                    return result;
                }).catch(error => {
                    if (this.entries.get(key) === entry) this.entries.delete(key);
                    throw error;
                });
            this.entries.set(key, entry);
            while (this.entries.size > this.limit) {
                const oldest = this.entries.keys().next().value;
                this.entries.get(oldest).controller.abort(); this.entries.delete(oldest);
            }
        }
        return new Promise((resolve, reject) => {
            const abort = () => reject(new DOMException('Aborted', 'AbortError'));
            signal?.addEventListener('abort', abort, {once:true});
            entry.promise.then(value => { if (!signal?.aborted) resolve(value); }, reject)
                .finally(() => signal?.removeEventListener('abort', abort));
        });
    },
}; }
const forecastCache=createPositionCache('forecast');
const threatCache=createPositionCache('threats');

// This cache lives only for the current catalog/page, never across deployments.
const startingChoicesCache={
    entries:new Map(), limit:32,
    clear(){this.entries.clear();},
    async get(id,version=''){
        const key=JSON.stringify([id,version]);
        let request=this.entries.get(key);
        if(!request){
            request=_req('GET',`/api/imperium/presets/${id}/starts`).then(choices=>{
                if(!Array.isArray(choices)||!choices.length)throw new Error('No starting kingdoms available. Choose another map.');
                return choices;
            }).catch(error=>{if(this.entries.get(key)===request)this.entries.delete(key);throw error;});
            this.entries.set(key,request);
            while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);
        }
        return structuredClone(await request);
    },
};

const api = {
    resign: (id, expected_turn) => _req('POST', `/api/imperium/games/${id}/resign`, {expected_turn}),
    offerDraw: (id, expected_turn) => _req('POST', `/api/imperium/games/${id}/draw`, {expected_turn}),
    getPresets: async () => {const catalog=await _req('GET','/api/imperium/presets');startingChoicesCache.clear();return catalog;},
    getStarts: (id,version) => startingChoicesCache.get(id,version),
    threats: (id, moves, signal, position) => position ? threatCache.get(id,position,moves,signal) : _req('POST', `/api/imperium/games/${id}/threats`, {moves}, signal),
    newGame:       (body)      => _req('POST', '/api/imperium/games', body),
    getReplay: (id, offset=0) => _req('GET', `/api/imperium/games/${id}/replay?offset=${offset}&limit=50`),
    getHistory: (id, before) => _req('GET', `/api/imperium/games/${id}/history?before_turn=${before}&limit=50`),
    getGame:       (id)        => _req('GET',  `/api/imperium/games/${id}?history_limit=20`),
    getValidMoves: (id)        => _req('GET',  `/api/imperium/games/${id}/valid-moves`),
    forecast: (id, moves, signal, position) => position ? forecastCache.get(id, position, moves, signal) : _req('POST', `/api/imperium/games/${id}/forecast`, { moves }, signal),
    submitTurn:    (id, moves, expected_turn, standing_orders) => _req('POST', `/api/imperium/games/${id}/turn`, { moves, expected_turn, standing_orders }),
};
