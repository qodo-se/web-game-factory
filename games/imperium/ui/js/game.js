// ── Constants ─────────────────────────────────────────────────────────────────

// ── Geographic map rendering ──────────────────────────────────────────────────
// Approach: elevation field driven by terrain type + fractal noise → hypsometric
// coloring (green lowlands → tan uplands → brown mountains, like a physical atlas)
// + NW-sun hillshading from height gradient. No flat Voronoi blobs.

// Terrain elevation base value and noise amplitude (0..1 scale)
const TERRAIN_HEIGHT = {
    coast: 0.10, plains: 0.26, city: 0.22, forest: 0.44, hills: 0.73, desert: 0.38,
};
const TERRAIN_NOISE_AMP = {
    coast: 0.06, plains: 0.10, city: 0.07, forest: 0.12, hills: 0.16, desert: 0.09,
};

// Owner tint: [R,G,B, alpha] — very subtle so terrain remains the dominant visual
const OWNER_TINT = {
    player_1: [55, 105, 200, 0.30],
    player_2: [200,  55,  55, 0.30],
    rogue:    [108, 103, 112, 0.08],
};

const SEA_FACTOR = 1.45;

const MAP_W = 1000, MAP_H = 650;
const PAD = 0.08; // normalised padding on each side of the bounding box

// ── Per-preset sea points ─────────────────────────────────────────────────────
// Virtual Voronoi centres that always render as ocean, carving geographically
// correct water bodies.  Coordinates are in the same raw [x,y] space as r.x/r.y.
const SEA_POINTS_BY_PRESET = {
    // ── Mediterranean ──────────────────────────────────────────────────────────
    // The sea is the protagonist. 21 points carve out every named body of water.
    mediterranean: [
        // Western Mediterranean (Alboran / Balearic)
        [0.09, 0.66],  // Alboran Sea — mouth of the Med
        [0.15, 0.63],  // Balearic Sea (between Hispania and Numidia)
        [0.21, 0.61],  // Western Mediterranean centre
        // Ligurian Sea — south of Gaul, north of Corsica
        [0.25, 0.47],  // Gulf of Lion
        [0.30, 0.45],  // Ligurian Sea
        // Tyrrhenian Sea — between Italy, Sardinia, Sicily
        [0.35, 0.53],  // Tyrrhenian north
        [0.39, 0.57],  // Tyrrhenian south
        // Sicilian Channel and Libya Sea
        [0.36, 0.70],  // Sicilian Channel west
        [0.44, 0.71],  // Sicilian Channel east
        [0.49, 0.77],  // Libya Sea (east of Sicily)
        // Adriatic Sea — between Italy and Illyria
        [0.45, 0.43],  // Adriatic north
        [0.47, 0.52],  // Adriatic south
        // Ionian Sea — south of Greece, east of Calabria
        [0.50, 0.63],  // Ionian west
        [0.54, 0.67],  // Ionian east
        // Aegean Sea — between Macedonia and Asia Minor
        [0.59, 0.50],  // Aegean north
        [0.63, 0.56],  // Aegean south
        // Eastern Mediterranean — Levantine Basin
        [0.65, 0.71],  // East Med (between Crete and Alexandria)
        [0.70, 0.75],  // Levantine Basin (between Crete and Phoenicia)
        // Black Sea — north of Bithynia / Pontus
        [0.68, 0.36],  // Black Sea west
        [0.75, 0.33],  // Black Sea central
        [0.82, 0.36],  // Black Sea east (north of Pontus)
    ],

    // ── Europe ─────────────────────────────────────────────────────────────────
    // Atlantic seaboard, British Isles seas, Baltic, and Mediterranean south.
    europe: [
        // North Atlantic and Norwegian Sea
        [0.06, 0.16],  // Norwegian Sea
        [0.07, 0.26],  // Atlantic west of Ireland
        [0.06, 0.48],  // Bay of Biscay
        [0.06, 0.62],  // Iberian Atlantic
        // Irish Sea and English Channel
        [0.12, 0.26],  // Irish Sea
        [0.18, 0.31],  // English Channel
        // North Sea
        [0.25, 0.22],  // Southern North Sea
        [0.30, 0.18],  // North Sea central
        [0.36, 0.14],  // North Sea north (off Denmark)
        // Baltic Sea
        [0.44, 0.16],  // Western Baltic (Kattegat / Øresund)
        [0.50, 0.14],  // Baltic central
        [0.56, 0.12],  // Gulf of Finland (east Baltic)
        // Mediterranean south
        [0.36, 0.74],  // Ligurian / Gulf of Genoa
        [0.44, 0.72],  // Tyrrhenian Sea
        [0.48, 0.82],  // Adriatic and southern Italy coast
        [0.52, 0.76],  // Ionian Sea
        [0.56, 0.72],  // Eastern Mediterranean / Aegean
        // Black Sea
        [0.65, 0.66],  // Black Sea west (south of Wallachia, north of Constantinople)
        [0.70, 0.64],  // Black Sea east (south of Crimea)
    ],

    // ── Western Europe ─────────────────────────────────────────────────────────
    // Strong Atlantic presence; full British Isles sea geometry; Baltic; Med south.
    western_europe: [
        // Atlantic — Iberian coast
        [0.03, 0.88],  // Atlantic off Portugal (Lisbon)
        [0.04, 0.76],  // Atlantic off northern Spain
        [0.04, 0.64],  // Cantabrian Sea
        // Bay of Biscay
        [0.08, 0.56],  // Bay of Biscay south
        [0.09, 0.46],  // Bay of Biscay north
        [0.10, 0.40],  // Breton offshore
        // Irish Sea
        [0.15, 0.30],  // Irish Sea
        // English Channel
        [0.22, 0.35],  // Western Channel
        [0.28, 0.32],  // Eastern Channel (Dover Strait)
        // North Sea
        [0.34, 0.24],  // Southern North Sea
        [0.38, 0.20],  // North Sea central
        [0.44, 0.22],  // North Sea north-east (off Denmark)
        // Baltic
        [0.48, 0.16],  // Western Baltic
        [0.54, 0.14],  // Baltic central
        // Mediterranean south
        [0.42, 0.82],  // Tyrrhenian Sea
        [0.46, 0.90],  // Straits of Messina / south Sicily
        [0.52, 0.76],  // Adriatic
    ],

    // ── Eastern Europe ─────────────────────────────────────────────────────────
    // Baltic in the north; Black Sea and Azov in the south; Caspian in the east.
    eastern_europe: [
        // Baltic Sea
        [0.08, 0.09],  // Baltic (off Pomerania / Prussia)
        [0.18, 0.07],  // Baltic central
        [0.30, 0.07],  // Gulf of Finland (off Estonia)
        // Black Sea
        [0.42, 0.84],  // Black Sea northwest (south of Moldavia / Wallachia)
        [0.52, 0.86],  // Black Sea central (south of Crimea)
        [0.60, 0.80],  // Black Sea east (off Don Steppe)
        // Sea of Azov
        [0.57, 0.77],  // Sea of Azov (between Crimea and Don Steppe)
        // Caspian Sea
        [0.86, 0.76],  // Caspian Sea (east of Astrakhan)
        [0.86, 0.60],  // Caspian north
    ],

    // ── Middle East ────────────────────────────────────────────────────────────
    // Mediterranean west, Black Sea north, Red Sea, Persian Gulf, Caspian east.
    middle_east: [
        // Eastern Mediterranean / Aegean
        [0.05, 0.14],  // Aegean north (west of Constantinople)
        [0.05, 0.30],  // Eastern Mediterranean
        [0.04, 0.46],  // East Med south (off Alexandria coast)
        // Black Sea (north of Pontus and Constantinople)
        [0.24, 0.05],  // Black Sea west
        [0.38, 0.05],  // Black Sea east (north of Pontus)
        // Red Sea — between Egypt / Sinai and Arabia
        [0.12, 0.68],  // Red Sea north (Gulf of Aqaba / Suez area)
        [0.16, 0.80],  // Red Sea central
        [0.20, 0.88],  // Red Sea south (Bab-el-Mandeb / Gulf of Aden)
        // Persian Gulf
        [0.52, 0.67],  // Persian Gulf north (Basra approach)
        [0.53, 0.76],  // Persian Gulf central
        [0.48, 0.84],  // Persian Gulf south (Strait of Hormuz)
        // Arabian Sea
        [0.36, 0.92],  // Arabian Sea (off Yemen)
        [0.44, 0.92],  // Arabian Sea (off Oman)
        // Caspian Sea
        [0.70, 0.12],  // Caspian north (south of Caucasus)
        [0.72, 0.24],  // Caspian south
    ],

    // ── Central Asia ───────────────────────────────────────────────────────────
    // Mostly landlocked; Caspian western fringe and Aral Sea.
    central_asia: [
        [0.01, 0.28],  // Caspian Sea north (west of Astrakhan)
        [0.01, 0.44],  // Caspian Sea south
        [0.07, 0.28],  // Aral Sea (north of Aral Shore)
    ],

    // ── Indian Subcontinent ────────────────────────────────────────────────────
    // Arabian Sea on the west, Bay of Bengal on the east, Indian Ocean south.
    india: [
        // Arabian Sea — western coast of India
        [0.01, 0.36],  // Arabian Sea north (off Sindh / Balochistan)
        [0.02, 0.52],  // Arabian Sea central (off Gujarat)
        [0.04, 0.68],  // Arabian Sea south (off Konkan / Goa)
        [0.07, 0.84],  // Arabian Sea (off Kerala)
        // Bay of Bengal — eastern coast
        [0.65, 0.28],  // Bay of Bengal north (between Bengal and Arakan)
        [0.62, 0.44],  // Bay of Bengal central
        [0.60, 0.60],  // Bay of Bengal south (off Kalinga)
        [0.56, 0.74],  // Bay of Bengal (off Andhra / Coromandel)
        // Indian Ocean — southern tip
        [0.22, 0.97],  // Indian Ocean southwest (off Kerala)
        [0.40, 0.98],  // Indian Ocean south (of Sri Lanka)
        [0.53, 0.96],  // Indian Ocean southeast (off Coromandel)
        // Palk Strait / Gulf of Mannar
        [0.44, 0.94],  // Palk Strait (between Sri Lanka and Madurai)
    ],

    // ── Southeast Asia ─────────────────────────────────────────────────────────
    // Andaman Sea, South China Sea, Malacca Strait, Java Sea, Banda Sea, Sulu Sea.
    southeast_asia: [
        // Andaman Sea
        [0.09, 0.30],  // Andaman Sea north
        [0.13, 0.44],  // Andaman Sea south
        // Gulf of Thailand
        [0.30, 0.44],  // Gulf of Thailand north
        [0.34, 0.52],  // Gulf of Thailand south
        // South China Sea
        [0.50, 0.18],  // South China Sea north (off northern Vietnam)
        [0.52, 0.30],  // South China Sea central
        [0.54, 0.42],  // South China Sea south
        // Strait of Malacca
        [0.18, 0.64],  // Strait of Malacca
        // Java Sea
        [0.32, 0.78],  // Java Sea west
        [0.40, 0.80],  // Java Sea east
        // Sulu Sea (between Borneo and Philippines)
        [0.54, 0.52],  // Sulu Sea
        // Banda / Flores Sea
        [0.54, 0.78],  // Banda Sea west
        [0.62, 0.74],  // Banda Sea east / Maluku Sea
        // Philippine Sea
        [0.66, 0.32],  // Philippine Sea (east of Luzon)
    ],
};

// ── State ─────────────────────────────────────────────────────────────────────

let gameId       = null;
let state        = null;
let validMoves   = {};
let selectedFrom = null;
let pendingMoves = [];
let resolving    = false;
let gameOver     = false;
let scaleCache   = null;
let lastHoverId  = null;

// ── Scale helpers ─────────────────────────────────────────────────────────────

function computeScale(regions) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of Object.values(regions)) {
        if (r.x < minX) minX = r.x; if (r.x > maxX) maxX = r.x;
        if (r.y < minY) minY = r.y; if (r.y > maxY) maxY = r.y;
    }
    return { minX, minY, rangeX: maxX - minX || 1, rangeY: maxY - minY || 1 };
}

function normX(rx) { return (rx - scaleCache.minX) / scaleCache.rangeX * (1 - 2*PAD) + PAD; }
function normY(ry) { return (ry - scaleCache.minY) / scaleCache.rangeY * (1 - 2*PAD) + PAD; }
function toSVGX(rx) { return normX(rx) * MAP_W; }
function toSVGY(ry) { return normY(ry) * MAP_H; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// ── Fractal noise helpers ─────────────────────────────────────────────────────

function _h2(x, y) {
    // Integer hash → float [0,1)
    let n = (x * 374761393 + y * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function _vn(x, y) {
    // Smoothstep-interpolated value noise
    const ix = x | 0, iy = y | 0;
    const fx = x - ix, fy = y - iy;
    const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    return _h2(ix,iy)*(1-ux)*(1-uy) + _h2(ix+1,iy)*ux*(1-uy) +
           _h2(ix,iy+1)*(1-ux)*uy   + _h2(ix+1,iy+1)*ux*uy;
}
function _fbm(x, y) {
    // 4-octave fBm, output ≈ [0,1]
    return (_vn(x,y)*0.500 + _vn(x*2.1+3.7,y*2.1+1.3)*0.250 +
            _vn(x*4.3+7.1,y*4.3+5.9)*0.125 + _vn(x*8.7+11.3,y*8.7+9.1)*0.0625)
           / 0.9375;
}

// Hypsometric color: elevation h [0..1] → physical-atlas RGB
// Mirrors classic atlas palettes: coastal green → lowland green → tan upland → brown mountain
function _elevColor(h, terrain) {
    if (terrain === 'desert') {
        // Warm sandy/ochre throughout; shifts to ruddy brown at height
        const t = Math.min(1, h / 0.8);
        return [228 - 52*t | 0, 210 - 62*t | 0, 168 - 70*t | 0];
    }
    if (terrain === 'forest') {
        // Darker muted greens; more saturated than grassland
        if (h < 0.35) return [135, 175, 110];
        if (h < 0.55) return [118, 158,  92];
        if (h < 0.72) return [138, 152,  98];
        return [155, 140, 95];
    }
    // Standard hypsometric — lowland greens fade into upland tans and mountain browns
    const stops = [
        [0.00, [200, 230, 180]],
        [0.14, [182, 212, 158]],
        [0.26, [165, 196, 135]],
        [0.38, [178, 190, 128]],
        [0.50, [196, 180, 122]],
        [0.61, [188, 162, 105]],
        [0.72, [172, 142,  88]],
        [0.83, [155, 124,  74]],
        [1.00, [138, 110,  62]],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
        const [h0, c0] = stops[i], [h1, c1] = stops[i + 1];
        if (h <= h1) {
            const t = (h - h0) / (h1 - h0);
            return [c0[0]+(c1[0]-c0[0])*t|0, c0[1]+(c1[1]-c0[1])*t|0, c0[2]+(c1[2]-c0[2])*t|0];
        }
    }
    return stops[stops.length - 1][1];
}

// ── Canvas Voronoi rendering ──────────────────────────────────────────────────

function renderCanvas() {
    const canvas = document.getElementById('map-canvas');
    const cw = canvas.clientWidth  || 800;
    const ch = canvas.clientHeight || 550;
    if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width  = cw;
        canvas.height = ch;
    }

    const ctx = canvas.getContext('2d');
    const W = cw, H = ch;
    const img = ctx.createImageData(W, H);
    const pxs = img.data;
    // -1 = sea, >=0 = index into regions[]
    const idxMap = new Int32Array(W * H).fill(-1);

    const regions = Object.values(state.regions);
    const N = regions.length;

    // Per-preset sea points: virtual Voronoi centres that always render as ocean
    const presetId  = sessionStorage.getItem('presetId') || '';
    const rawSeaPts = SEA_POINTS_BY_PRESET[presetId] || [];
    const SP = rawSeaPts.length;

    // Typed-array centres for inner-loop speed (land regions first, then sea points)
    const ncx = new Float32Array(N + SP);
    const ncy = new Float32Array(N + SP);
    for (let i = 0; i < N; i++) {
        ncx[i] = normX(regions[i].x);
        ncy[i] = normY(regions[i].y);
    }
    for (let s = 0; s < SP; s++) {
        ncx[N + s] = normX(rawSeaPts[s][0]);
        ncy[N + s] = normY(rawSeaPts[s][1]);
    }

    // Adjacency matrix (flat Uint8Array, row-major)
    // adj[i*N+j] = 1 means regions[i] and regions[j] share a game edge
    const idToIdx = {};
    for (let i = 0; i < N; i++) idToIdx[regions[i].id] = i;
    const adj = new Uint8Array(N * N);
    for (let i = 0; i < N; i++) {
        adj[i * N + i] = 1;
        for (const nid of regions[i].neighbors) {
            const j = idToIdx[nid];
            if (j !== undefined) { adj[i*N+j] = 1; adj[j*N+i] = 1; }
        }
    }

    // Per-region selection / commitment state
    const committedFrom = new Set(pendingMoves.map(m => m.from_region_id));
    const validTargets  = selectedFrom !== null ? new Set(validMoves[selectedFrom] || []) : new Set();
    const effect = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
        const r = regions[i];
        if      (r.id === selectedFrom)   effect[i] = 1;
        else if (validTargets.has(r.id))  effect[i] = 2;
        else if (committedFrom.has(r.id)) effect[i] = 3;
    }

    // ── Pass 1: Voronoi + elevation field ─────────────────────────────────────
    // hMap[px]: land → elevation [0,1]; sea → negative depth value [-1, 0)
    const hMap  = new Float32Array(W * H);
    const tMap  = new Uint8Array(W * H);   // terrain index per pixel (land only)
    const NOISE_SCALE = 5.5;               // noise world-space frequency
    const M = N + SP;

    for (let py = 0; py < H; py++) {
        const ny = py / H;
        for (let px = 0; px < W; px++) {
            const nx = px / W;

            let d1 = Infinity, d2 = Infinity, b1 = 0, b2 = 1, dl = Infinity;
            for (let j = 0; j < M; j++) {
                const dx = nx - ncx[j], dy = ny - ncy[j];
                const d  = dx*dx + dy*dy;
                if (d < d1)      { d2 = d1; b2 = b1; d1 = d; b1 = j; }
                else if (d < d2) { d2 = d;  b2 = j; }
                if (j < N && d < dl) dl = d;
            }

            const pixIdx  = py * W + px;
            const b2IsSea = b2 >= N;
            const isSea   = b1 >= N || (d2 < d1 * SEA_FACTOR && (b2IsSea || !adj[b1*N+b2]));

            if (isSea) {
                // Encode sea depth as negative: -1 = deep, -ε = coastal
                const depth = Math.min(1.0, Math.sqrt(dl) / 0.16);
                hMap[pixIdx] = -(0.05 + depth * 0.95);
            } else {
                idxMap[pixIdx] = b1;
                const t1  = regions[b1].terrain || 'plains';
                const hb1 = TERRAIN_HEIGHT[t1]    || 0.26;
                const ha1 = TERRAIN_NOISE_AMP[t1] || 0.10;
                // fBm noise centered at 0: fbm ≈ [0,1] → shift by -0.5 for ±variation
                const noise1 = (_fbm(nx * NOISE_SCALE + 17.3, ny * NOISE_SCALE + 5.7) - 0.5) * 2;
                let h = hb1 + ha1 * noise1;

                // Smooth blend toward second region at boundaries
                if (b2 < N) {
                    const t2   = regions[b2].terrain || 'plains';
                    const hb2  = TERRAIN_HEIGHT[t2]    || 0.26;
                    const ha2  = TERRAIN_NOISE_AMP[t2] || 0.10;
                    const noise2 = noise1; // same position → coherent noise
                    const h2   = hb2 + ha2 * noise2;
                    // centrality: 1 at cell centre, 0 at boundary
                    const cen  = (d2 - d1) / (d1 + d2);
                    const bt   = 1 - cen;                       // 0=centre, 1=boundary
                    const sbt  = bt * bt * (3 - 2 * bt);        // smoothstep
                    h = h * (1 - sbt * 0.55) + h2 * (sbt * 0.55);
                }

                hMap[pixIdx] = Math.max(0, Math.min(1, h));
                tMap[pixIdx] = b1; // store region index for terrain type lookup
            }
        }
    }

    // ── Pass 2: Hillshading + hypsometric color + owner tint ─────────────────
    // Light from NW at ~45° elevation: direction (-1,-1,1)/√3
    const LX = -0.5774, LY = -0.5774, LZ = 0.5774;
    const EXAGGERATION = 12; // height exaggeration for normal computation

    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const pixIdx = py * W + px;
            const i4     = pixIdx * 4;
            const h      = hMap[pixIdx];

            if (h < 0) {
                // ── Sea ──────────────────────────────────────────────────────
                const depth = Math.min(1, (-h - 0.05) / 0.95);
                // Coastal shelf [120,182,222] → deep ocean [20,55,130]
                const sr = 120 - 100 * depth | 0;
                const sg = 182 - 127 * depth | 0;
                const sb = 222 -  92 * depth | 0;
                // Subtle ripple texture from fine noise
                const rip = (((px * 7 + py * 13) ^ (py >> 2)) & 7) - 3;
                pxs[i4]   = clamp(sr + rip, 0, 255);
                pxs[i4+1] = clamp(sg + rip, 0, 255);
                pxs[i4+2] = clamp(sb + rip, 0, 255);
                pxs[i4+3] = 255;

            } else {
                // ── Land ─────────────────────────────────────────────────────
                // Finite-difference surface normal for hillshading
                // Clamp sea neighbours to 0 (sea level) so coasts shade naturally
                const hL = px > 0     ? Math.max(0, hMap[pixIdx - 1])     : h;
                const hR = px < W - 1 ? Math.max(0, hMap[pixIdx + 1])     : h;
                const hU = py > 0     ? Math.max(0, hMap[pixIdx - W])     : h;
                const hD = py < H - 1 ? Math.max(0, hMap[pixIdx + W])     : h;

                const sx = (hR - hL) * EXAGGERATION;  // east-west slope
                const sy = (hD - hU) * EXAGGERATION;  // north-south slope (y down)
                const nLen = Math.sqrt(sx*sx + sy*sy + 1);
                const nx2  = -sx / nLen, ny2 = -sy / nLen, nz = 1 / nLen;

                // Lambert shading + ambient floor
                const shade = Math.max(0.22, LX*nx2 + LY*ny2 + LZ*nz);

                const b1 = tMap[pixIdx];
                const r  = regions[b1];
                const terrain = r.terrain || 'plains';

                // Hypsometric color at this elevation
                const [tr, tg, tb] = _elevColor(h, terrain);

                let R = tr * shade | 0;
                let G = tg * shade | 0;
                let B = tb * shade | 0;

                // Effect modifiers (selection, targets, committed)
                const eff = effect[b1];
                if      (eff === 1) { R = clamp(R + 55, 0, 255); G = clamp(G + 45, 0, 255); B = clamp(B + 15, 0, 255); }
                else if (eff === 2) { R = clamp(R + 40, 0, 255); G = clamp(G + 28, 0, 255); B = clamp(B - 15, 0, 255); }
                else if (eff === 3) { R = R * 0.40 | 0; G = G * 0.40 | 0; B = B * 0.40 | 0; }

                // Owner tint (thin political color over the geographic terrain)
                const tint = OWNER_TINT[r.owner] || OWNER_TINT.rogue;
                const ta   = tint[3];
                R = clamp(R, 0, 255) * (1 - ta) + tint[0] * ta | 0;
                G = clamp(G, 0, 255) * (1 - ta) + tint[1] * ta | 0;
                B = clamp(B, 0, 255) * (1 - ta) + tint[2] * ta | 0;

                pxs[i4]   = clamp(R, 0, 255);
                pxs[i4+1] = clamp(G, 0, 255);
                pxs[i4+2] = clamp(B, 0, 255);
                pxs[i4+3] = 255;
            }
        }
    }

    // ── Pass 3: Political borders ─────────────────────────────────────────────
    for (let py = 1; py < H - 1; py++) {
        for (let px = 1; px < W - 1; px++) {
            const me = idxMap[py * W + px];
            if (me === -1) continue;
            const nbN = idxMap[(py-1)*W+px], nbS = idxMap[(py+1)*W+px];
            const nbW = idxMap[py*W+px-1],   nbE = idxMap[py*W+px+1];
            let isBorder = false, isHostile = false;
            for (const nb of [nbN, nbS, nbW, nbE]) {
                if (nb === -1 || nb === me) continue;
                isBorder = true;
                const o1 = regions[me].owner, o2 = regions[nb].owner;
                if ((o1 === 'player_1') !== (o2 === 'player_1') &&
                    o1 !== 'rogue' && o2 !== 'rogue') isHostile = true;
            }
            if (isBorder) {
                const i4 = (py * W + px) * 4;
                if (isHostile) { pxs[i4]=225; pxs[i4+1]=210; pxs[i4+2]=145; pxs[i4+3]=255; }
                else           { pxs[i4]=22;  pxs[i4+1]=16;  pxs[i4+2]=12;  pxs[i4+3]=255; }
            }
        }
    }

    ctx.putImageData(img, 0, 0);

    // Vignette — frames the map, gives cartographic depth
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.20, W/2, H/2, H*0.84);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.50)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Return idxMap so the SVG overlay can detect which adjacent pairs cross sea
    return { idxMap, cw: W, ch: H };
}

// ── SVG overlay (labels, rings, arrows) ──────────────────────────────────────

function svgEl(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
}

function renderOverlay(idxMap, cw, ch) {
    const gLabels = document.getElementById('g-labels');
    const gArrows = document.getElementById('g-arrows');
    const gConn   = document.getElementById('g-connections');
    gLabels.innerHTML = '';
    gArrows.innerHTML = '';
    gConn.innerHTML   = '';

    // ── Sea-crossing connection lines ─────────────────────────────────────────
    // For each pair of game-adjacent regions, sample pixels along the line
    // between them.  If any pixel is sea (idxMap == -1), the connection crosses
    // water — draw a dashed line so the player can see it's traversable.
    if (idxMap && cw > 0 && ch > 0) {
        const drawn = new Set();
        for (const r of Object.values(state.regions)) {
            const ax = normX(r.x) * cw;
            const ay = normY(r.y) * ch;
            for (const nid of r.neighbors) {
                const pairKey = r.id < nid ? `${r.id}:${nid}` : `${nid}:${r.id}`;
                if (drawn.has(pairKey)) continue;
                drawn.add(pairKey);
                const nb = state.regions[nid];
                if (!nb) continue;
                const bx = normX(nb.x) * cw;
                const by = normY(nb.y) * ch;
                // Sample 10 points along the connecting line
                let crossesSea = false;
                for (let t = 1; t < 10 && !crossesSea; t++) {
                    const frac = t / 10;
                    const px = Math.round(ax + (bx - ax) * frac);
                    const py = Math.round(ay + (by - ay) * frac);
                    if (px >= 0 && px < cw && py >= 0 && py < ch) {
                        if (idxMap[py * cw + px] === -1) crossesSea = true;
                    }
                }
                if (crossesSea) {
                    gConn.appendChild(svgEl('line', {
                        x1: toSVGX(r.x),  y1: toSVGY(r.y),
                        x2: toSVGX(nb.x), y2: toSVGY(nb.y),
                        stroke: '#c8a840',
                        'stroke-width': 1.2,
                        'stroke-dasharray': '4 6',
                        opacity: 0.45,
                    }));
                }
            }
        }
    }

    const regions = state.regions;
    const committedFrom = new Set(pendingMoves.map(m => m.from_region_id));
    const validTargets  = selectedFrom !== null
        ? new Set(validMoves[selectedFrom] || [])
        : new Set();

    for (const r of Object.values(regions)) {
        const x = toSVGX(r.x), y = toSVGY(r.y);
        const isSelected  = r.id === selectedFrom;
        const isTarget    = validTargets.has(r.id);
        const isCommitted = committedFrom.has(r.id);

        const g = svgEl('g', { 'data-id': r.id });

        // Selection ring — tight around the army circle
        if (isSelected) {
            g.appendChild(svgEl('circle', {
                cx: x, cy: y, r: 20,
                fill: 'none', stroke: 'rgba(255,255,255,0.85)',
                'stroke-width': 2.5,
            }));
        }

        // Valid-target ring — dashed gold, slightly larger
        if (isTarget) {
            g.appendChild(svgEl('circle', {
                cx: x, cy: y, r: 23,
                fill: 'none', stroke: '#d4a840',
                'stroke-width': 2, opacity: 0.9,
                'stroke-dasharray': '6 4',
            }));
        }

        // Capital indicator — small gold dot just above army circle
        if (r.is_capital) {
            g.appendChild(svgEl('circle', {
                cx: x, cy: y - 20, r: 3.5,
                fill: '#d4a840', stroke: 'rgba(0,0,0,0.5)', 'stroke-width': 1,
            }));
        }

        // Army count — centered on the region point
        const bgR = isCommitted ? 11 : 14;
        g.appendChild(svgEl('circle', {
            cx: x, cy: y, r: bgR,
            fill: 'rgba(0,0,0,0.60)',
        }));

        const armyEl = svgEl('text', {
            x, y: y + 1,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            fill: isCommitted ? 'rgba(255,255,255,0.28)' : '#ffffff',
            'font-size': r.army >= 100 ? '10' : '12',
            'font-weight': 'bold',
            'font-family': 'Arial, sans-serif',
            'pointer-events': 'none',
        });
        armyEl.textContent = r.army;
        g.appendChild(armyEl);

        // Region name — just below the army circle
        const nameEl = svgEl('text', {
            x, y: y + 24,
            'text-anchor': 'middle',
            fill: isSelected ? '#f0e8d0' : 'rgba(230,218,190,0.68)',
            'font-size': '8',
            'font-family': 'Georgia, serif',
            'pointer-events': 'none',
        });
        nameEl.textContent = r.name;
        g.appendChild(nameEl);

        gLabels.appendChild(g);
    }

    // Move arrows
    for (const mv of pendingMoves) {
        const from = regions[mv.from_region_id];
        const to   = regions[mv.to_region_id];
        if (!from || !to) continue;

        const x1 = toSVGX(from.x), y1 = toSVGY(from.y);
        const x2 = toSVGX(to.x),   y2 = toSVGY(to.y);
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const nx = dx/len, ny = dy/len;
        const GAP = 22;

        gArrows.appendChild(svgEl('line', {
            x1: x1 + nx*GAP, y1: y1 + ny*GAP,
            x2: x2 - nx*(GAP + 10), y2: y2 - ny*(GAP + 10),
            stroke: '#d4a840',
            'stroke-width': 2.5,
            'stroke-dasharray': '9 5',
            'marker-end': 'url(#arr-gold)',
            opacity: 0.95,
        }));
    }
}

function renderMap() {
    if (!state) return;
    scaleCache = computeScale(state.regions);
    const canvasData = renderCanvas();
    renderOverlay(canvasData.idxMap, canvasData.cw, canvasData.ch);
}

// ── Canvas interaction ────────────────────────────────────────────────────────

function findNearestRegionId(nx, ny) {
    let minDist = Infinity, nearestId = -1;
    for (const r of Object.values(state.regions)) {
        const dx = nx - normX(r.x), dy = ny - normY(r.y);
        const d = dx*dx + dy*dy;
        if (d < minDist) { minDist = d; nearestId = r.id; }
    }
    return nearestId;
}

function initCanvasEvents() {
    const canvas = document.getElementById('map-canvas');

    canvas.addEventListener('click', (e) => {
        if (resolving) return;
        const rect = canvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top)  / rect.height;
        handleRegionClick(findNearestRegionId(nx, ny));
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top)  / rect.height;
        const rid = findNearestRegionId(nx, ny);

        if (rid !== lastHoverId) {
            lastHoverId = rid;
            updateRegionInfo(rid);
        }

        // Cursor hint
        const r = state.regions[rid];
        const committedFrom = new Set(pendingMoves.map(m => m.from_region_id));
        const validTargets  = selectedFrom !== null
            ? new Set(validMoves[selectedFrom] || [])
            : new Set();

        if (validTargets.has(rid)) {
            canvas.style.cursor = 'crosshair';
        } else if (r.owner === 'player_1' && validMoves[rid] && !committedFrom.has(rid)) {
            canvas.style.cursor = 'pointer';
        } else {
            canvas.style.cursor = 'default';
        }
    });
}

// ── Game interaction ──────────────────────────────────────────────────────────

function handleRegionClick(id) {
    if (resolving || id < 0) return;

    const r = state.regions[id];
    const committedFrom = new Set(pendingMoves.map(m => m.from_region_id));

    if (selectedFrom !== null) {
        if (id === selectedFrom) {
            selectedFrom = null;
            renderMap(); updateMoveHint(); return;
        }

        const targets = validMoves[selectedFrom] || [];
        if (targets.includes(id)) {
            pendingMoves.push({ from_region_id: selectedFrom, to_region_id: id });
            selectedFrom = null;
            renderMap(); updateMovesList(); updateMoveHint(); return;
        }

        // Switch selection to another own region
        if (r.owner === 'player_1' && validMoves[id] && !committedFrom.has(id)) {
            selectedFrom = id;
            renderMap(); updateRegionInfo(id); updateMoveHint(); return;
        }

        selectedFrom = null;
        renderMap(); updateMoveHint(); return;
    }

    if (r.owner === 'player_1' && validMoves[id] && !committedFrom.has(id)) {
        selectedFrom = id;
        renderMap(); updateRegionInfo(id); updateMoveHint();
    } else {
        updateRegionInfo(id);
    }
}

function removePendingMove(fromId) {
    pendingMoves = pendingMoves.filter(m => m.from_region_id !== fromId);
    renderMap(); updateMovesList(); updateMoveHint();
}

// ── UI updates ────────────────────────────────────────────────────────────────

function updateTopBar() {
    document.getElementById('turn-num').textContent   = state.turn;
    document.getElementById('p1-name').textContent    = state.player_1.name;
    document.getElementById('p1-regions').textContent = state.player_1.regions;
    document.getElementById('p1-army').textContent    = state.player_1.total_army;
    document.getElementById('p2-name').textContent    = state.player_2.name;
    document.getElementById('p2-regions').textContent = state.player_2.regions;
    document.getElementById('p2-army').textContent    = state.player_2.total_army;
}

function updateRegionInfo(id) {
    const r = state.regions[id];
    if (!r) return;
    const ownerNames  = { player_1: state.player_1.name, player_2: state.player_2.name, rogue: 'Neutral' };
    const ownerClass  = { player_1: 'p1-text', player_2: 'p2-text', rogue: 'rogue-text' };
    document.getElementById('region-info').innerHTML = `
        <div class="region-name">${r.name}${r.is_capital ? ' ★' : ''}</div>
        <div class="region-row"><span>Owner</span><span class="${ownerClass[r.owner]}">${ownerNames[r.owner]}</span></div>
        <div class="region-row"><span>Terrain</span><span>${capitalise(r.terrain)}</span></div>
        <div class="region-row"><span>Army</span><span>${r.army}</span></div>
        <div class="region-row"><span>Growth</span><span>+${r.pop_rate}/turn</span></div>
        <div class="region-row"><span>Defense</span><span>×${r.defense_bonus.toFixed(2)}</span></div>
    `;
}

function clearRegionInfo() {
    document.getElementById('region-info').innerHTML =
        '<p class="no-selection">Hover a region to inspect it.</p>';
}

function updateMovesList() {
    const list = document.getElementById('moves-list');
    list.classList.remove('hidden');
    if (pendingMoves.length === 0) {
        list.innerHTML = '<p class="no-moves-msg">No moves planned. Click one of your regions to order an advance.</p>';
        return;
    }
    list.innerHTML = pendingMoves.map(m => {
        const from = state.regions[m.from_region_id];
        const to   = state.regions[m.to_region_id];
        return `<div class="move-item">
            <span class="move-arrow">→</span>
            <span class="move-regions"><b>${from.name}</b> → ${to.name}</span>
            <button class="move-remove" onclick="removePendingMove(${m.from_region_id})" title="Cancel">×</button>
        </div>`;
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
    } else if (available > 0) {
        hint.textContent = `${available} region${available !== 1 ? 's' : ''} can still move. Click Next Turn to pass remaining.`;
    } else {
        hint.textContent = `All moves planned. Click Next Turn when ready.`;
    }
}

function showCombatLog(summary) {
    document.getElementById('combat-log-section').classList.remove('hidden');
    document.getElementById('combat-log').classList.remove('hidden');
    document.getElementById('log-turn').textContent = summary.turn;

    const log = document.getElementById('combat-log');
    if (summary.combat_results.length === 0) {
        log.innerHTML = '<div class="log-entry" style="font-style:italic;color:#666880">No battles this turn.</div>';
        return;
    }
    log.innerHTML = summary.combat_results.map(c => {
        const fromR = state.regions[c.attacker_region_id];
        const toR   = state.regions[c.defender_region_id];
        return `<div class="log-entry">
            <span class="log-outcome ${c.attacker_won ? 'won' : 'lost'}">${c.attacker_won ? 'Victory' : 'Repelled'}</span>
            <br>${fromR ? fromR.name : '?'} → ${toR ? toR.name : '?'}
            <br><span style="color:#555578">${c.attacker_army} vs ${c.effective_defender_army} eff. · ${c.survivors} survivors</span>
        </div>`;
    }).join('');
}

function setResolving(on) {
    resolving = on;
    document.getElementById('resolving-overlay').classList.toggle('hidden', !on);
    document.getElementById('end-turn-btn').disabled = on;
    document.getElementById('abandon-btn').disabled = on;
}

function abandon() {
    if (gameOver || confirm('Abandon this campaign and return to the main menu?')) {
        sessionStorage.removeItem('gameId');
        sessionStorage.removeItem('presetId');
        window.location.href = 'index.html';
    }
}

// ── Turn submission ───────────────────────────────────────────────────────────

async function endTurn() {
    if (resolving) return;
    setResolving(true);
    selectedFrom = null;

    try {
        const result = await api.submitTurn(gameId, pendingMoves);
        pendingMoves = [];
        state = result.state;
        updateTopBar();

        if (result.game_over) {
            renderMap();
            handleGameOver(result.winner);
            return;
        }

        const vm = await api.getValidMoves(gameId);
        validMoves = {};
        for (const [k, v] of Object.entries(vm)) validMoves[+k] = v;

        setResolving(false);
        renderMap();
        showCombatLog(result);
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

    // Game is done — kill Next Turn, repurpose Abandon
    gameOver = true;
    document.getElementById('end-turn-btn').disabled = true;
    document.getElementById('abandon-btn').textContent = 'Back to Menu';

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
    if (!gameId) { window.location.href = 'index.html'; return; }

    document.getElementById('end-turn-btn').addEventListener('click', endTurn);
    document.getElementById('abandon-btn').addEventListener('click', abandon);
    initCanvasEvents();

    // Resize canvas when window resizes (re-render the Voronoi map)
    window.addEventListener('resize', () => { if (state) renderMap(); });

    try {
        const [gameData, vm] = await Promise.all([
            api.getGame(gameId),
            api.getValidMoves(gameId),
        ]);
        state = gameData.state;
        validMoves = {};
        for (const [k, v] of Object.entries(vm)) validMoves[+k] = v;

        updateTopBar();
        renderMap();
        updateMoveHint();

    } catch (e) {
        alert('Failed to load game: ' + e.message);
        window.location.href = 'index.html';
    }
}

init();
