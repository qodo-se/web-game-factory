function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Constants ─────────────────────────────────────────────────────────────────

// ── Fantasy RTS map rendering ──────────────────────────────────────────────────
// Approach: per-terrain saturated palette (Warcraft II era aesthetic) with fBm
// procedural texture, sandy coastal strip between land and ocean, and dark navy
// ocean with wave texture.  No hillshading — terrain color carries all the info.

// Base and shadow colors per terrain type [R,G,B] — Age of Empires II palette
const TERRAIN_BASE = {
    coast:   [152, 212, 100],   // light coastal grass (bright, near-shore)
    plains:  [ 96, 160,  52],   // classic AoE2 medium-green grassland
    city:    [100, 164,  56],   // developed plains
    forest:  [ 48, 104,  24],   // AoE2 forest green (canopy lit top)
    hills:   [132, 108,  64],   // warm grey-stone highland
    desert:  [204, 176, 100],   // AoE2 sandy dunes — warm gold
};
const TERRAIN_DARK = {          // shadow / dense-cover variant (lower noise → this)
    coast:   [112, 168,  72],
    plains:  [ 60, 116,  30],
    city:    [ 68, 124,  36],
    forest:  [ 20,  56,  10],   // deep forest shadow — nearly black-green
    hills:   [ 84,  64,  32],   // rocky shadow crevice
    desert:  [168, 140,  68],
};
const SAND_COLOR = [204, 180, 112]; // AoE2-style warm sandy beach

// Owner tint: [R,G,B, alpha] — political overlay; strong enough to be unambiguous
const OWNER_TINT = {
    player_1: [55, 105, 200, 0.42],
    player_2: [200,  55,  55, 0.42],
    rogue:    [108, 103, 112, 0.06],
};

const SEA_FACTOR = 1.45;

const MAP_W = 1000, MAP_H = 650;
const PAD = 0.15; // normalised padding on each side of the bounding box

// ── Per-preset sea points ─────────────────────────────────────────────────────
// Virtual Voronoi centres that always render as ocean, carving geographically
// correct water bodies.  Coordinates are in the same raw [x,y] space as r.x/r.y.
const SEA_POINTS_BY_PRESET = {
    // ── Mediterranean ──────────────────────────────────────────────────────────
    // Coordinates matched to actual preset region positions (x=W→E, y=N→S).
    // Region bounding box: x 0.02–0.92, y 0.28–0.92, max_edge_distance 0.22.
    mediterranean: [
        // Strait of Gibraltar + western Mediterranean
        [0.07, 0.66],  // Strait of Gibraltar (Hispalis 0.07,0.60 ↔ Mauretania 0.08,0.72)
        [0.13, 0.66],  // Alboran Sea
        [0.20, 0.63],  // Balearic Sea (between Carthago Nova and Numidia)
        [0.25, 0.60],  // Western Mediterranean north basin
        // Gulf of Lyon / Ligurian Sea
        [0.24, 0.50],  // Gulf of Lyon (south of Gallia Narbonensis 0.23,0.40)
        [0.29, 0.46],  // Ligurian Sea (between Liguria 0.32,0.37 and Corsica 0.31,0.52)
        // Tyrrhenian Sea (west of Italian peninsula)
        [0.36, 0.54],  // Tyrrhenian north (west of Rome 0.37,0.43)
        [0.39, 0.60],  // Tyrrhenian south (west of Campania 0.42,0.48)
        // Sicilian Channel
        [0.36, 0.68],  // Sicilian Channel (Sicily 0.40,0.63 ↔ Carthage 0.33,0.63)
        // Libya Sea
        [0.47, 0.76],  // Libya Sea (between Libya 0.42,0.80 and Ionian)
        // Adriatic Sea — narrow strip east of Italian peninsula
        [0.45, 0.42],  // Adriatic north (Cisalpine 0.36,0.32 ↔ Illyria 0.48,0.40)
        [0.46, 0.49],  // Adriatic centre (Campania 0.42,0.48 ↔ Illyria 0.48,0.40)
        [0.48, 0.56],  // Adriatic south (Calabria 0.43,0.58 ↔ Macedonia 0.54,0.47)
        // Ionian Sea
        [0.51, 0.64],  // Ionian west (Calabria/Sicily ↔ Athens 0.56,0.58)
        [0.56, 0.68],  // Ionian east (towards Crete 0.59,0.70)
        // Bosphorus / Aegean
        [0.65, 0.46],  // Bosphorus/Dardanelles (Thrace 0.63,0.42 ↔ Bithynia 0.68,0.50)
        [0.61, 0.52],  // Aegean north
        [0.63, 0.58],  // Aegean south (Athens 0.56,0.58 ↔ Lydia 0.64,0.58)
        // Eastern Mediterranean — Levantine Basin
        [0.65, 0.72],  // East Med (between Crete 0.59,0.70 and Alexandria 0.68,0.82)
        [0.70, 0.75],  // Levantine Basin (Cyprus 0.73,0.68 ↔ Phoenicia 0.76,0.72)
        // Black Sea — north of Thrace / Pontus
        [0.67, 0.33],  // Black Sea west (north of Thrace 0.63,0.42)
        [0.76, 0.30],  // Black Sea central (north of Pontus 0.78,0.45)
        [0.84, 0.35],  // Black Sea east (north of Armenia 0.90,0.50)
    ],

    // ── Europe ─────────────────────────────────────────────────────────────────
    // Coordinates matched to actual preset region positions (x=W→E, y=N→S).
    // Region bounding box: x 0.04–0.82, y 0.08–0.78, max_edge_distance 0.18.
    europe: [
        // Atlantic — west coast of Iberia
        [0.02, 0.73],  // Atlantic off Lisbon (0.04,0.72)
        [0.03, 0.58],  // Atlantic off northern Iberia
        // Bay of Biscay
        [0.07, 0.52],  // Bay of Biscay (Brittany 0.14,0.38 ↔ Castile 0.12,0.65)
        // Irish Sea
        [0.11, 0.23],  // Irish Sea (Ireland 0.08,0.22 ↔ England 0.18,0.25)
        // English Channel
        [0.19, 0.30],  // Western Channel (England 0.18,0.25 ↔ Normandy 0.20,0.33)
        [0.25, 0.29],  // Eastern Channel (↔ Flanders 0.30,0.30)
        // North Sea
        [0.26, 0.22],  // Southern North Sea (England/Scotland ↔ Denmark 0.40,0.20)
        [0.30, 0.15],  // Central North Sea
        [0.34, 0.12],  // Northern North Sea (off Norway 0.37,0.08)
        // Norwegian Sea
        [0.14, 0.07],  // Norwegian Sea (north of Scotland 0.17,0.15)
        // Baltic Sea
        [0.45, 0.16],  // Western Baltic (Denmark 0.40,0.20 ↔ Pomerania 0.48,0.22)
        [0.54, 0.12],  // Baltic central (Sweden 0.48,0.10 ↔ Lithuania 0.60,0.22)
        [0.62, 0.09],  // Gulf of Finland (Finland 0.58,0.08 ↔ Latvia 0.62,0.14)
        // Mediterranean — Ligurian / Gulf of Genoa
        [0.32, 0.67],  // Gulf of Genoa (south of Provence 0.32,0.62)
        // Tyrrhenian Sea
        [0.37, 0.74],  // Tyrrhenian north (west of Rome 0.40,0.68)
        [0.41, 0.82],  // Tyrrhenian south (Naples 0.44,0.75 ↔ Sicily 0.44,0.85)
        // Adriatic
        [0.47, 0.65],  // Adriatic (Croatia 0.48,0.58 ↔ east Italian coast)
        // Ionian
        [0.52, 0.84],  // Ionian Sea (Greece 0.55,0.78 ↔ Sicily 0.44,0.85)
        // Aegean
        [0.58, 0.76],  // Aegean (Greece 0.55,0.78 ↔ Bulgaria 0.58,0.65)
        // Turkish Straits / Sea of Marmara
        [0.64, 0.76],  // Sea of Marmara (Constantinople 0.62,0.75 ↔ Anatolia 0.70,0.78)
        // Black Sea
        [0.64, 0.68],  // Black Sea west (Wallachia 0.60,0.58 ↔ Crimea 0.70,0.62)
        [0.72, 0.65],  // Black Sea east (south of Crimea 0.70,0.62)
    ],

    // ── Western Europe ─────────────────────────────────────────────────────────
    // Coordinates matched to actual preset region positions (x=W→E, y=N→S).
    // Region bounding box: x 0.06–0.60, y 0.05–0.96, max_edge_distance 0.20.
    western_europe: [
        // Atlantic — west of Iberian Peninsula
        [0.02, 0.88],  // Atlantic off Lisbon (0.06,0.88)
        [0.04, 0.76],  // Atlantic off Castile (0.16,0.80)
        // Bay of Biscay
        [0.10, 0.62],  // Bay of Biscay south (Aquitaine 0.26,0.62 ↔ Navarre 0.22,0.64)
        [0.12, 0.52],  // Bay of Biscay north (Brittany 0.20,0.48)
        // Irish Sea / Celtic Sea
        [0.14, 0.33],  // Irish Sea (Ireland 0.12,0.30 ↔ Wales 0.20,0.32)
        // English Channel
        [0.24, 0.35],  // Western Channel (England 0.28,0.25 ↔ Normandy 0.28,0.42)
        [0.34, 0.34],  // Eastern Channel / Dover Strait (↔ Flanders 0.38,0.38)
        // North Sea
        [0.36, 0.26],  // Southern North Sea (Holland 0.40,0.30 ↔ England 0.28,0.25)
        [0.40, 0.20],  // North Sea central (Denmark 0.46,0.20 ↔ Jorvik 0.28,0.15)
        // Norwegian Sea
        [0.22, 0.06],  // Norwegian Sea west (Scotland 0.25,0.05 ↔ Norway 0.42,0.08)
        [0.34, 0.06],  // Norwegian Sea east (off Norway)
        // Baltic Sea
        [0.50, 0.16],  // Western Baltic (Denmark 0.46,0.20 ↔ Sweden 0.54,0.10)
        [0.58, 0.14],  // Baltic central / Pomeranian (Sweden ↔ Pomerania 0.58,0.22)
        // Mediterranean — Gulf of Lyon / Ligurian
        [0.36, 0.76],  // Gulf of Lyon (south of Provence 0.40,0.72)
        // Tyrrhenian Sea
        [0.44, 0.84],  // Tyrrhenian (Rome 0.48,0.80 ↔ Naples 0.52,0.88)
        [0.47, 0.93],  // Sicilian Channel (Sicily 0.50,0.96)
        // Adriatic Sea
        [0.52, 0.74],  // Adriatic north (Venice 0.54,0.62 ↔ Tuscany 0.46,0.70)
        [0.56, 0.80],  // Adriatic south (Croatia 0.58,0.68 ↔ Naples 0.52,0.88)
    ],

    // ── Eastern Europe ─────────────────────────────────────────────────────────
    // Coordinates matched to actual preset region positions (x=W→E, y=N→S).
    // Region bounding box: x 0.05–0.82, y 0.05–0.82, max_edge_distance 0.22.
    eastern_europe: [
        // Baltic Sea — north of Pomerania, Prussia, Latvia, Estonia (minY=0.05)
        [0.06, 0.06],  // Baltic west (off Prussia 0.05,0.22 ↔ Pomerania 0.12,0.15)
        [0.20, 0.03],  // Baltic central (between Pomerania 0.12,0.15 ↔ Latvia 0.28,0.12)
        [0.32, -0.02], // Gulf of Finland (north of Estonia 0.30,0.05 — outside box)
        // Black Sea — south of Wallachia, Bulgaria, Crimea, Don Steppe
        [0.36, 0.90],  // Black Sea northwest (south of Wallachia 0.35,0.75 ↔ Bulgaria 0.38,0.82)
        [0.50, 0.90],  // Black Sea central (south of Crimea 0.52,0.80)
        [0.62, 0.84],  // Black Sea east (south of Don Steppe 0.62,0.72)
        // Sea of Azov
        [0.58, 0.77],  // Sea of Azov (Crimea 0.52,0.80 ↔ Don Steppe 0.62,0.72)
        // Caspian Sea — east of Astrakhan
        [0.88, 0.80],  // Caspian west (east of Astrakhan 0.82,0.82)
        [0.90, 0.62],  // Caspian north (east of Volga 0.80,0.52)
    ],

    // ── Middle East ────────────────────────────────────────────────────────────
    // Coordinates matched to actual preset region positions (x=W→E, y=N→S).
    // Region bounding box: x 0.05–0.88, y 0.08–0.90, max_edge_distance 0.22.
    middle_east: [
        // Aegean Sea — west of Constantinople and Lydia
        [0.02, 0.10],   // Aegean north (west of Constantinople 0.18,0.10)
        [0.02, 0.20],   // Aegean south (west of Lydia 0.22,0.18)
        // Eastern Mediterranean — west of Levant and Egypt
        [0.00, 0.38],   // Eastern Med (west of Cyrenaica 0.05,0.40 ↔ Phoenicia 0.22,0.42)
        [0.00, 0.52],   // Eastern Med south (west of Alexandria 0.05,0.55)
        // Black Sea — north of Pontus, Constantinople, Armenia
        [0.22, 0.04],  // Black Sea west (north of Constantinople 0.18,0.10)
        [0.40, 0.04],  // Black Sea east (north of Pontus 0.40,0.12 ↔ Armenia 0.48,0.15)
        // Red Sea — between Egypt/Sinai and Arabian Peninsula
        [0.14, 0.66],  // Red Sea north / Gulf of Suez (Sinai 0.18,0.62 ↔ Nile Delta 0.08,0.65)
        [0.18, 0.80],  // Red Sea central (Hejaz 0.28,0.72 ↔ Upper Egypt coast)
        [0.22, 0.90],  // Red Sea south / Gulf of Aden (Yemen 0.30,0.90)
        // Persian Gulf — between Arabia and Persia
        [0.52, 0.65],  // Persian Gulf north (Basra 0.56,0.62 ↔ Gulf Coast 0.52,0.72)
        [0.52, 0.75],  // Persian Gulf central (Gulf Coast 0.52,0.72 ↔ Oman 0.48,0.80)
        [0.48, 0.86],  // Strait of Hormuz / Gulf of Oman (south of Oman 0.48,0.80)
        // Arabian Sea
        [0.34, 0.93],  // Arabian Sea (south of Yemen 0.30,0.90)
        [0.45, 0.93],  // Arabian Sea (south of Oman 0.48,0.80)
        // Caspian Sea — east of Caucasus / Hyrcania
        [0.68, 0.12],  // Caspian north (east of Georgia 0.52,0.08 ↔ Azerbaijan 0.58,0.15)
        [0.70, 0.24],  // Caspian south (east of Hyrcania 0.68,0.22)
    ],

    // ── Central Asia ───────────────────────────────────────────────────────────
    // Coordinates matched to actual preset region positions (x=W→E, y=N→S).
    // Region bounding box: x 0.04–0.92, y 0.05–0.85, max_edge_distance 0.22.
    // Mostly landlocked; Caspian on the western fringe, Aral Sea inland.
    central_asia: [
        // Caspian Sea — west of Astrakhan and Caspian Steppe
        [0.01, 0.20],  // Caspian north (west of Astrakhan 0.04,0.22)
        [0.01, 0.38],  // Caspian south (west of Caspian Steppe 0.08,0.38)
        // Aral Sea — west of Aral Shore
        [0.06, 0.34],  // Aral Sea (west of Aral Shore 0.12,0.35)
    ],

    // ── Indian Subcontinent ────────────────────────────────────────────────────
    // Coordinates matched to actual preset region positions (x=W→E, y=N→S).
    // Region bounding box: x 0.02–0.70, y 0.05–0.98, max_edge_distance 0.20.
    india: [
        // Arabian Sea — west coast (sea points sit between canvas edge and coastal land)
        [-0.05, 0.22],  // Arabian Sea NW (off Balochistan 0.02,0.22 / Sindh 0.10,0.28)
        [-0.03, 0.38],  // Arabian Sea north (off Gujarat 0.12,0.42)
        [0.00, 0.52],   // Arabian Sea central (off Gujarat/Malwa coast)
        [0.04, 0.66],   // Arabian Sea south (off Konkan 0.20,0.65)
        [0.06, 0.80],   // Arabian Sea south (off Kerala 0.22,0.90)
        // Bay of Bengal — east coast (sea points between coastal land and canvas right edge)
        [0.82, 0.20],   // Bay of Bengal north (east of Bengal 0.60,0.25 / Manipur 0.70,0.22)
        [0.80, 0.36],   // Bay of Bengal (east of Arakan 0.68,0.32 / Orissa 0.55,0.38)
        [0.78, 0.52],   // Bay of Bengal central (east of Kalinga 0.55,0.55)
        [0.74, 0.68],   // Bay of Bengal south (east of Andhra 0.48,0.68)
        [0.68, 0.80],   // Bay of Bengal (east of Coromandel 0.45,0.82)
        // Indian Ocean — south of the peninsula tip
        [0.20, 1.08],   // Indian Ocean SW (south of Kerala 0.22,0.90)
        [0.38, 1.10],   // Indian Ocean south (south of Madurai/Sri Lanka)
        [0.55, 1.06],   // Indian Ocean SE (east of Coromandel)
        // Palk Strait / Gulf of Mannar
        [0.44, 0.94],   // Palk Strait (Sri Lanka 0.42,0.98 ↔ Madurai 0.38,0.92)
    ],

    // ── Southeast Asia ─────────────────────────────────────────────────────────
    // Coordinates matched to actual preset region positions (x=W→E, y=N→S).
    // Region bounding box: x 0.02–0.68, y 0.08–0.92, max_edge_distance 0.20.
    // Westernmost land: Arakan 0.02,0.15. Easternmost: Maluku 0.68,0.65.
    southeast_asia: [
        // Bay of Bengal — left of Arakan (westernmost land at 0.02)
        [-0.04, 0.15],  // Bay of Bengal (west of Arakan 0.02,0.15)
        [-0.01, 0.28],  // Andaman Sea north (west of Irrawaddy Delta 0.10,0.22)
        [0.04, 0.42],   // Andaman Sea south (off Kedah 0.22,0.45)
        // Gulf of Thailand — inland sea between mainland and Malay Peninsula
        [0.28, 0.44],   // Gulf of Thailand (Gulf of Siam 0.28,0.35 ↔ Kedah 0.22,0.45)
        [0.34, 0.52],   // Gulf of Thailand south (Mekong Delta ↔ Malacca 0.26,0.55)
        // South China Sea — right of the eastern coast
        [0.72, 0.12],   // South China Sea north (east of Hanoi 0.38,0.12 / Luzon 0.60,0.25)
        [0.72, 0.28],   // South China Sea central (Hue/Champa ↔ Philippines)
        [0.72, 0.42],   // South China Sea south (Saigon ↔ Visayas 0.62,0.38)
        // Strait of Malacca
        [0.18, 0.62],   // Strait of Malacca (Malacca 0.26,0.55 ↔ Aceh 0.12,0.68)
        // Java Sea
        [0.32, 0.78],   // Java Sea west (Palembang 0.30,0.72 ↔ Sunda 0.32,0.88)
        [0.40, 0.80],   // Java Sea east (Majapahit 0.38,0.85 ↔ Kalimantan 0.48,0.78)
        // Sulu Sea — between Borneo and Philippines
        [0.54, 0.54],   // Sulu Sea (Brunei 0.48,0.68 ↔ Mindanao 0.65,0.48)
        // Flores / Banda Sea
        [0.54, 0.80],   // Flores Sea (Bali 0.50,0.90 ↔ Kalimantan / Sulawesi 0.58,0.62)
        [0.64, 0.74],   // Banda / Maluku Sea (Sulawesi 0.58,0.62 ↔ Maluku 0.68,0.65)
        // Philippine Sea — right of Philippines
        [0.76, 0.30],   // Philippine Sea (east of Luzon 0.60,0.25 / Visayas 0.62,0.38)
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
let campaignHistory = [];
let forecastSequence = 0;
let forecastTimer, forecastController;
let randomTerrainCache;

// ── Scale helpers ─────────────────────────────────────────────────────────────

function computeScale(regions) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of Object.values(regions)) {
        if (r.x < minX) minX = r.x; if (r.x > maxX) maxX = r.x;
        if (r.y < minY) minY = r.y; if (r.y > maxY) maxY = r.y;
    }
    return { minX, minY, rangeX: maxX - minX || 1, rangeY: maxY - minY || 1 };
}

function normX(rx) { if (atlas.data) return atlas.x(rx); return (rx - scaleCache.minX) / scaleCache.rangeX * (1 - 2*PAD) + PAD; }
function normY(ry) { if (atlas.data) return atlas.y(ry); return (ry - scaleCache.minY) / scaleCache.rangeY * (1 - 2*PAD) + PAD; }
function toSVGX(rx) { return normX(rx) * (atlas.data ? atlas.layout.w : MAP_W); }
function toSVGY(ry) { return normY(ry) * (atlas.data ? atlas.layout.h : MAP_H); }
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

// Procedural terrain texture — fantasy RTS aesthetic.
// Returns [R,G,B] from terrain type and normalised screen position.
// Uses higher-frequency noise (scale 13/26) for clearly visible texture blobs.
function _terrainPx(terrain, nx, ny) {
    const n1 = _fbm(nx * 13.0,        ny * 13.0);
    const n2 = _fbm(nx * 26.0 + 3.7,  ny * 26.0 + 8.3);

    const base = TERRAIN_BASE[terrain] || TERRAIN_BASE.plains;
    const dark = TERRAIN_DARK[terrain] || TERRAIN_DARK.plains;

    if (terrain === 'forest') {
        // AoE2 forest: dark canopy mass with bright tree-top blobs on a dark base
        if (n2 < 0.34) return [10, 38,  6];   // deep under-canopy shadow
        if (n1 < 0.50) return [26, 72, 14];   // dense canopy interior
        if (n1 < 0.70) return [44, 100, 26];  // mid canopy
        const t = (n1 - 0.70) / 0.30;
        return [dark[0] + (base[0]-dark[0])*t|0,
                dark[1] + (base[1]-dark[1])*t|0,
                dark[2] + (base[2]-dark[2])*t|0];
    }

    if (terrain === 'hills') {
        // AoE2 rocky highland: warm stone with deep crevice shadows and pale lit peaks
        if (n1 < 0.18) return [28, 22, 12];   // deep shadow crevice
        if (n2 < 0.26) return [48, 38, 20];   // secondary crack
        if (n1 < 0.46) return [84, 68, 38];   // stone face
        if (n1 > 0.78) return [180, 160, 108];// bright sunlit peak
        const t = (n1 - 0.46) / 0.32;
        return [dark[0] + (base[0]-dark[0])*t|0,
                dark[1] + (base[1]-dark[1])*t|0,
                dark[2] + (base[2]-dark[2])*t|0];
    }

    if (terrain === 'desert') {
        // Sandy dunes — warm golden gradient with fine grain
        const n3 = _fbm(nx * 18.0 + 5.0, ny * 18.0 + 5.0);
        const t = n1 * 0.5 + n3 * 0.5;
        return [base[0] - (base[0]-dark[0])*t|0,
                base[1] - (base[1]-dark[1])*t|0,
                base[2] - (base[2]-dark[2])*t|0];
    }

    // coast / plains / city — smooth green variation
    const t = n1 * 0.60 + n2 * 0.40;
    return [dark[0] + (base[0]-dark[0])*(1-t)|0,
            dark[1] + (base[1]-dark[1])*(1-t)|0,
            dark[2] + (base[2]-dark[2])*(1-t)|0];
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

    const terrainKey=JSON.stringify([cw,ch,interfaceView.darkMap,...Object.values(state.regions).map(r=>[r.id,r.x,r.y,r.owner,r.terrain,r.neighbors])]);
    if(randomTerrainCache?.key===terrainKey) {
        renderTerrainEffects(randomTerrainCache.paths,planning.source(),planning.targets(),new Set(pendingMoves.map(m=>m.from_region_id)),`scale(${MAP_W/cw} ${MAP_H/ch})`,false);
        return randomTerrainCache.data;
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

    // ── Pass 1: Voronoi assignment ────────────────────────────────────────────
    // hMap[px]:  land → 0;  sea → negative depth [-1, 0)
    // tMap[px]:  land → region index;  sea → -1
    const hMap  = new Float32Array(W * H);
    const tMap  = new Int32Array(W * H).fill(-1);
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
                const depth = Math.min(1.0, Math.sqrt(dl) / 0.16);
                hMap[pixIdx] = -(0.05 + depth * 0.95);
            } else {
                idxMap[pixIdx] = b1;
                tMap[pixIdx]   = b1;
                // hMap stays 0 (land marker)
            }
        }
    }

    // ── Pass 1.5: Pixel-accurate distance-to-sea (4-directional 1-D DT) ──────
    // seaDist[px] = distance in pixels to nearest sea pixel.
    // Used for the coastal sand strip — works regardless of sea-centre placement.
    const BIG = W + H;
    const seaDist = new Float32Array(W * H).fill(BIG);
    for (let i = 0; i < W * H; i++) if (hMap[i] < 0) seaDist[i] = 0;
    for (let py = 0; py < H; py++) {
        for (let px = 1; px < W; px++) {
            const i = py*W+px; if (seaDist[i-1]+1 < seaDist[i]) seaDist[i] = seaDist[i-1]+1;
        }
        for (let px = W-2; px >= 0; px--) {
            const i = py*W+px; if (seaDist[i+1]+1 < seaDist[i]) seaDist[i] = seaDist[i+1]+1;
        }
    }
    for (let px = 0; px < W; px++) {
        for (let py = 1; py < H; py++) {
            const i = py*W+px; if (seaDist[(py-1)*W+px]+1 < seaDist[i]) seaDist[i] = seaDist[(py-1)*W+px]+1;
        }
        for (let py = H-2; py >= 0; py--) {
            const i = py*W+px; if (seaDist[(py+1)*W+px]+1 < seaDist[i]) seaDist[i] = seaDist[(py+1)*W+px]+1;
        }
    }

    // ── Pass 2: Fantasy RTS terrain color + coastal sand + owner tint ────────
    const SAND_W = 34; // sand strip width in pixels (pixel-accurate via seaDist)

    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const pixIdx = py * W + px;
            const i4     = pixIdx * 4;
            const h      = hMap[pixIdx];
            const nx     = px / W, ny = py / H;

            if (h < 0) {
                // ── Sea: AoE2 azure blue with wave sparkle ────────────────────
                const wave    = _fbm(nx * 4.0,       ny * 6.0)        * 0.60 +
                                _fbm(nx * 10 + 7.3,  ny * 8  + 4.1)   * 0.40;
                const sparkle = _fbm(nx * 24 + 1.3,  ny * 20 + 3.7);
                const depth   = Math.min(1, (-h - 0.05) / 0.95);
                pxs[i4]   = clamp( 52 + wave * 32 + sparkle *  6 - depth * 16 | 0, 0, 255);
                pxs[i4+1] = clamp(120 + wave * 26 + sparkle *  5 - depth * 34 | 0, 0, 255);
                pxs[i4+2] = clamp(196 + wave * 16 + sparkle *  4 - depth * 56 | 0, 0, 255);
                pxs[i4+3] = 255;

            } else {
                // ── Land: per-terrain procedural texture ──────────────────────
                const ri  = tMap[pixIdx];
                const r   = regions[ri];
                const terrain = r.terrain || 'plains';

                const [tr, tg, tb] = _terrainPx(terrain, nx, ny);

                // Coastal sand strip — pixel-accurate distance to nearest sea pixel
                const distSea = seaDist[pixIdx];
                const sRaw = distSea < SAND_W ? (1 - distSea / SAND_W) : 0;
                const sst  = sRaw * sRaw * (3 - 2 * sRaw);
                let R = tr + (SAND_COLOR[0] - tr) * sst | 0;
                let G = tg + (SAND_COLOR[1] - tg) * sst | 0;
                let B = tb + (SAND_COLOR[2] - tb) * sst | 0;

                // Owner tint
                const tint = OWNER_TINT[r.owner] || OWNER_TINT.rogue;
                const ta   = tint[3];
                if (ta > 0) {
                    R = clamp(R, 0, 255) * (1 - ta) + tint[0] * ta | 0;
                    G = clamp(G, 0, 255) * (1 - ta) + tint[1] * ta | 0;
                    B = clamp(B, 0, 255) * (1 - ta) + tint[2] * ta | 0;
                }

                pxs[i4]   = clamp(R, 0, 255);
                pxs[i4+1] = clamp(G, 0, 255);
                pxs[i4+2] = clamp(B, 0, 255);
                pxs[i4+3] = 255;
            }
        }
    }

    // ── Pass 3: Thick ownership borders (distance-transform) ─────────────────
    // Step 3a — mark cross-owner boundary source pixels
    const BORDER_W = 7;
    const BORDER_COLORS = {
        player_1: [55, 130, 230],
        player_2: [220,  55,  55],
        rogue:    [110,  95,  68],
    };
    const bDist = new Float32Array(W * H).fill(W + H);

    for (let py = 1; py < H - 1; py++) {
        for (let px = 1; px < W - 1; px++) {
            const me = idxMap[py * W + px];
            if (me === -1) continue;
            const oMe = regions[me].owner;
            const nbN = idxMap[(py-1)*W+px], nbS = idxMap[(py+1)*W+px];
            const nbW = idxMap[py*W+px-1],   nbE = idxMap[py*W+px+1];
            let crossOwner = false;
            for (const nb of [nbN, nbS, nbW, nbE]) {
                if (nb === -1) { crossOwner = true; break; }      // land touches sea
                if (nb !== me && regions[nb].owner !== oMe) { crossOwner = true; break; }
            }
            if (crossOwner) bDist[py * W + px] = 0;
        }
    }

    // Step 3b — 4-directional 1D distance transform from boundary source pixels
    for (let py = 0; py < H; py++)
        for (let px = 1; px < W; px++) {
            const i = py * W + px;
            if (bDist[i - 1] + 1 < bDist[i]) bDist[i] = bDist[i - 1] + 1;
        }
    for (let py = 0; py < H; py++)
        for (let px = W - 2; px >= 0; px--) {
            const i = py * W + px;
            if (bDist[i + 1] + 1 < bDist[i]) bDist[i] = bDist[i + 1] + 1;
        }
    for (let px = 0; px < W; px++)
        for (let py = 1; py < H; py++) {
            const i = py * W + px;
            if (bDist[i - W] + 1 < bDist[i]) bDist[i] = bDist[i - W] + 1;
        }
    for (let px = 0; px < W; px++)
        for (let py = H - 2; py >= 0; py--) {
            const i = py * W + px;
            if (bDist[i + W] + 1 < bDist[i]) bDist[i] = bDist[i + W] + 1;
        }

    // Step 3c — paint thick colored ownership rings + thin dark region borders
    for (let py = 1; py < H - 1; py++) {
        for (let px = 1; px < W - 1; px++) {
            const me = idxMap[py * W + px];
            if (me === -1) continue;
            const i4 = (py * W + px) * 4;
            const dist = bDist[py * W + px];

            if (dist < BORDER_W) {
                // Thick colored border: owner color blended in strongly near boundary
                const t = dist / BORDER_W;               // 0 at boundary, 1 at edge
                const alpha = (1 - t * t) * 0.92;        // smooth falloff
                const bc = BORDER_COLORS[regions[me].owner] || BORDER_COLORS.rogue;
                pxs[i4]   = pxs[i4]   + (bc[0] - pxs[i4])   * alpha | 0;
                pxs[i4+1] = pxs[i4+1] + (bc[1] - pxs[i4+1]) * alpha | 0;
                pxs[i4+2] = pxs[i4+2] + (bc[2] - pxs[i4+2]) * alpha | 0;
            } else {
                // Thin 1px dark line at same-owner region boundaries
                const oMe = regions[me].owner;
                const nbN = idxMap[(py-1)*W+px], nbS = idxMap[(py+1)*W+px];
                const nbW = idxMap[py*W+px-1],   nbE = idxMap[py*W+px+1];
                let sameBorder = false;
                for (const nb of [nbN, nbS, nbW, nbE]) {
                    if (nb !== -1 && nb !== me && regions[nb].owner === oMe) {
                        sameBorder = true; break;
                    }
                }
                if (sameBorder) {
                    pxs[i4] = pxs[i4]*0.5|0; pxs[i4+1] = pxs[i4+1]*0.5|0;
                    pxs[i4+2] = pxs[i4+2]*0.5|0;
                }
            }
        }
    }

    ctx.putImageData(img, 0, 0);
    if(interfaceView.darkMap) {ctx.fillStyle='rgba(8,18,24,.56)';ctx.fillRect(0,0,W,H);}

    // Vignette — subtle framing, keep bright AoE2 feel
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.90);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Return idxMap so the SVG overlay can detect which adjacent pairs cross sea
    // Run-length paths reuse exact Voronoi hits for lightweight selection tint.
    const spans=regions.map(()=>[]);
    for(let y=0;y<H;y++) for(let x=0;x<W;) {
        const index=idxMap[y*W+x],start=x;
        while(x<W && idxMap[y*W+x]===index)x++;
        if(index>=0)spans[index].push(`M${start} ${y}h${x-start}v1h${start-x}Z`);
    }
    const paths=regions.map((r,i)=>({id:r.id,d:spans[i].join('')}));
    const data={idxMap,cw:W,ch:H};
    randomTerrainCache={key:terrainKey,paths,data};
    renderTerrainEffects(paths,planning.source(),planning.targets(),new Set(pendingMoves.map(m=>m.from_region_id)),`scale(${MAP_W/cw} ${MAP_H/ch})`,false);
    return data;
}

// ── SVG overlay (labels, rings, arrows) ──────────────────────────────────────

function svgEl(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
}

// Shared bounds keep counters, selection rings and arrow clearance consistent.
function counterMetrics(region) {
    const text=String(strategicView.mode==='recruitment'?`+${region.pop_rate}`:region.army);
    const radius=Math.max(14,Math.min(25,text.length*3.2+4));
    const shape=interfaceView.factionShapes?region.owner:'player_1';
    const outer=shape==='player_2'?radius*Math.SQRT2:shape==='rogue'?radius+3:radius;
    return {text,radius,shape,outer};
}

// Construct planned arrows in screen pixels so gaps/head sizes remain stable
// under camera zoom and non-uniform SVG scaling on random maps.
function plannedMoveArrow(from, to, matrix, movement=null, repeating=false) {
    const color=movement?({player_1:'#75baff',player_2:'#ff9085',rogue:'#d2cbb6'}[movement.owner]||'#ffe09a'):repeating?'#75baff':'#ffe09a';
    const a = new DOMPoint(toSVGX(from.x), toSVGY(from.y)).matrixTransform(matrix);
    const b = new DOMPoint(toSVGX(to.x), toSVGY(to.y)).matrixTransform(matrix);
    const dx=b.x-a.x, dy=b.y-a.y, distance=Math.hypot(dx,dy);
    if (distance < .001) return null;
    const ux=dx/distance, uy=dy/distance;
    // Nearby counters need a detour; trimming a short straight segment at both
    // ends would either reverse it or bury its head underneath the destination.
    const screenScale=Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d))/mapCamera.zoom;
    const fromGap=counterMetrics(from).outer*screenScale+3;
    const toGap=counterMetrics(to).outer*screenScale+5;
    const bend=distance<2*(fromGap+toGap)?2*Math.max(fromGap,toGap)+24:movement?20:0;
    const control={x:(a.x+b.x)/2-uy*bend, y:(a.y+b.y)/2+ux*bend};
    const startLength=Math.hypot(control.x-a.x,control.y-a.y);
    const endLength=Math.hypot(b.x-control.x,b.y-control.y);
    const startGap=Math.min(fromGap,startLength*.8), endGap=Math.min(toGap,endLength*.8);
    const start={x:a.x+(control.x-a.x)*startGap/startLength,
                 y:a.y+(control.y-a.y)*startGap/startLength};
    const tx=(b.x-control.x)/endLength, ty=(b.y-control.y)/endLength;
    const tip={x:b.x-tx*endGap,y:b.y-ty*endGap};
    const headLength=Math.min(12,(endLength-endGap)*.65);
    const halfWidth=Math.min(5.5,headLength*.55);
    const base={x:tip.x-tx*headLength,y:tip.y-ty*headLength};
    const inverse=matrix.inverse();
    const point=p=>new DOMPoint(p.x,p.y).matrixTransform(inverse);
    const [s,c,t,h,left,right]=[start,control,tip,base,
        {x:base.x-ty*halfWidth,y:base.y+tx*halfWidth},
        {x:base.x+ty*halfWidth,y:base.y-tx*halfWidth}].map(point);
    const group=svgEl('g',{'data-from':from.id,'data-to':to.id,'class':movement?'replay-arrow':repeating?'planned-arrow repeat-arrow':'planned-arrow'});
    const title=svgEl('title');title.textContent=`${from.name} → ${to.name}`+(movement?` · ${movement.army} troops${movement.type==='retreat'?' (retreat)':''}`:repeating?' · Repeats every turn · Click arrow to pause · Right-click source to manage':' · One-time movement');group.append(title);
    if(movement) {group.setAttribute('tabindex','0');group.setAttribute('role','img');group.setAttribute('aria-label',title.textContent);}
    const path=`M ${s.x} ${s.y} Q ${c.x} ${c.y} ${h.x} ${h.y}`;
    let cancelOrder;
    if(!movement) {
    const hit=svgEl('path',{d:`M ${s.x} ${s.y} Q ${c.x} ${c.y} ${t.x} ${t.y}`,
        fill:'none',stroke:'transparent','stroke-width':18,'stroke-linecap':'round',
        'vector-effect':'non-scaling-stroke',class:'order-hit',tabindex:0,role:'button',
        'aria-label':`${repeating?'Pause repeat reinforcement':'Cancel one-time movement'}: ${from.name} to ${to.name}`});
    const cancel=cancelOrder=event=>{
        event.preventDefault();event.stopPropagation();
        // While choosing a destination, an existing arrow must not steal the order.
        if (event.type === 'click' && (selectedFrom !== null || standingOrders.editor)) handleRegionClick(planning.regionAt(event));
        else removePendingMove(from.id);
    };
    hit.addEventListener('click',cancel);
    hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')cancel(event);});
    group.append(hit);
    }
    for (const [stroke,width] of [['#182730',7],[color,3.5]]) {
        group.append(svgEl('path',{d:path,fill:'none',stroke,'stroke-width':width,
            'stroke-dasharray':movement?.type==='retreat'?'6 5':'none',
            'stroke-linecap':'round','vector-effect':'non-scaling-stroke','class':'planned-arrow-shaft'}));
    }
    group.append(svgEl('polygon',{points:`${t.x},${t.y} ${left.x},${left.y} ${right.x},${right.y}`,
        fill:color,stroke:'#182730','stroke-width':1.5,'stroke-linejoin':'round',
        'vector-effect':'non-scaling-stroke','class':'planned-arrow-head'}));
    if(repeating&&!movement) {
        // The badge stays circular and the same size under zoom and stretched maps.
        const center=point({x:start.x*.25+control.x*.5+base.x*.25,
                            y:start.y*.25+control.y*.5+base.y*.25});
        const badge=svgEl('g',{class:'repeat-arrow-badge',
            transform:`matrix(${inverse.a} ${inverse.b} ${inverse.c} ${inverse.d} ${center.x} ${center.y})`,
            'aria-hidden':'true'});
        badge.append(svgEl('circle',{r:11,fill:'#182730',stroke:color,'stroke-width':1.5}));
        // Draw the repeat symbol directly: font glyphs vary across browsers and
        // can sit below the center even with SVG baseline alignment.
        badge.append(svgEl('path',{
            d:'M-6 0V-2Q-6-4-4-4H6M3-7L6-4 3-1 M6 0V2Q6 4 4 4H-6M-3 1L-6 4-3 7',
            fill:'none',stroke:color,'stroke-width':1.6,
            'stroke-linecap':'round','stroke-linejoin':'round'}));
        badge.addEventListener('click',cancelOrder);
        group.append(badge);
    }
    return group;
}

function renderTerrainEffects(paths,selected,targets,committed,transform='',outlined=true) {
    const group=document.getElementById('g-terrain-effects');
    const fragment=document.createDocumentFragment();
    for(const feature of paths) {
        const active=feature.id===selected, target=targets.has(feature.id), moving=committed.has(feature.id);
        if(selected===null && !moving)continue;
        fragment.appendChild(svgEl('path',{d:feature.d,transform,'fill-rule':'evenodd',
            fill:!active && !target && selected!==null?'rgba(5,12,20,.32)':moving?'rgba(30,37,37,.2)':outlined?target?'rgba(230,190,70,.14)':'none':active?'rgba(255,230,130,.25)':'rgba(230,190,70,.2)',
            stroke:outlined && (active||target)?active?'#f6eacb':'#d4b772':'none',
            'stroke-width':active?2:1.5}));
    }
    group.replaceChildren(fragment);
}

function renderOverlay(idxMap, cw, ch) {
    // Read the transform before changing SVG nodes to avoid forced layout.
    const matrix=document.getElementById('map-svg').getScreenCTM();
    world.render();
    threatView.draw();
    const gLabels = document.createDocumentFragment();
    const gArrows = document.createDocumentFragment();
    const gConn = document.createDocumentFragment();

    // ── Sea-crossing connection lines ─────────────────────────────────────────
    // For each pair of game-adjacent regions, sample pixels along the line
    // between them.  If any pixel is sea (idxMap == -1), the connection crosses
    // water — draw a dashed line so the player can see it's traversable.
    if (!state.routes && idxMap && cw > 0 && ch > 0) {
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
    const showSupply = document.getElementById('show-supply')?.checked;
    for (const [key, kind] of Object.entries(state.routes || {})) {
        const [a,b]=key.split(':').map(Number), from=regions[a], to=regions[b];
        if(!from||!to)continue;
        const source=planning.source();
        const isSelected=(a===source||b===source)&&(!standingOrders.editor||planning.targets().has(a===source?b:a));
        const supply=showSupply && from.owner==='player_1' && to.owner==='player_1';
        if(!isSelected && !supply && kind!=='sea')continue;
        gConn.appendChild(svgEl('line',{x1:toSVGX(from.x),y1:toSVGY(from.y),x2:toSVGX(to.x),y2:toSVGY(to.y),
            stroke:supply?(from.supplied&&to.supplied?'#b0d4a5':'#df956c'):kind==='river'?'#8bbacb':kind==='pass'?'#d6c4a4':'#b1bdc1',
            'stroke-width':isSelected||supply?1.6:1,'stroke-dasharray':kind==='sea'?'4 6':kind==='pass'?'2 4':'none',
            opacity:isSelected||supply?.85:.48,'vector-effect':'non-scaling-stroke'}));
    }
    const committedFrom = new Set(pendingMoves.map(m => m.from_region_id));
    const validTargets = planning.targets();

    const occupiedLabels = atlas.data ? Object.values(regions).map(r => ({
        x:toSVGX(r.x)-18, y:toSVGY(r.y)-(r.is_capital?31:16), w:36, h:r.is_capital?47:32,
    })) : [];
    const labelMeasure=document.createElement('canvas').getContext('2d');
    labelMeasure.font=`600 ${interfaceView.labelSize}px Arial`;
    function labelPosition(x, y, name) {
        if (!atlas.data) return {x, y:y+24};
        const width=labelMeasure.measureText(name).width+6;
        const candidates=[[0,27],[0,-25],[width/2+24,4],[-width/2-24,4]];
        for(const radius of [42,57,74,94])for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0],[.8,.7],[-.8,.7],[.8,-.7],[-.8,-.7]])candidates.push([dx*(radius+width/3),dy*radius]);
        let best, leastOverlap=Infinity;
        for (const [dx,dy] of candidates) {
            const box={x:x+dx-width/2, y:y+dy-interfaceView.labelSize-3, w:width, h:interfaceView.labelSize+6};
            box.x=Math.max(8,Math.min(cw-box.w-8,box.x));
            box.y=Math.max(8,Math.min(ch-box.h-8,box.y));
            const overlap=occupiedLabels.reduce((sum,b) => sum+
                Math.max(0,Math.min(box.x+box.w,b.x+b.w)-Math.max(box.x,b.x))*
                Math.max(0,Math.min(box.y+box.h,b.y+b.h)-Math.max(box.y,b.y)), 0);
            if (overlap<leastOverlap) { best=box; leastOverlap=overlap; }
            if (!overlap) break;
        }
        occupiedLabels.push(best);
        return {x:best.x+width/2, y:best.y+interfaceView.labelSize+3};
    }

    const projections = planning.projections();
    for (const r of Object.values(regions)) {
        const x = toSVGX(r.x), y = toSVGY(r.y);
        const isSelected  = r.id === planning.source();
        const isTarget    = validTargets.has(r.id);
        const isCommitted = committedFrom.has(r.id);

        const g = svgEl('g', { 'data-id': r.id, class:r.id===lastHoverId?'region-hover':'',
            transform: `translate(${x} ${y}) scale(${1/mapCamera.zoom}) translate(${-x} ${-y})` });
        if (state.battle?.objectives.includes(r.id)) {
            g.appendChild(svgEl('path', {d:`M${x} ${y-22} L${x+22} ${y} L${x} ${y+22} L${x-22} ${y} Z`,
                fill:'none',stroke:'#ffe09a','stroke-width':2,class:'battle-objective'}));
        }
        if(r.terrain==='city') g.appendChild(svgEl('path',{
            d:`M${x-18} ${y+14}v-29h5v5h5v-5h5v5h6v-5h5v5h5v-5h5v29Z`,
            fill:'rgba(35,37,28,.45)',stroke:'#e1d5b7','stroke-width':1,opacity:.85}));
        if(r.port) {
            const port=svgEl('text',{x:x+19,y:y+4,fill:'#d6e7e8','font-size':14,'text-anchor':'middle'});
            port.textContent='⚓';g.appendChild(port);
        }
        if(r.supplied===false && r.owner==='player_1')g.appendChild(svgEl('circle',{cx:x,cy:y,r:18,
            fill:'none',stroke:'#e6a16a','stroke-dasharray':'3 3','stroke-width':1.5}));

        const metrics=counterMetrics(r);
        // Selection rings clear every counter shape and size.
        if (isSelected) {
            g.appendChild(svgEl('circle', {
                cx: x, cy: y, r: metrics.outer+6,
                fill: 'rgba(228,196,124,.12)', stroke: '#f2d99b',
                'stroke-width': 2.5,
            }));
        }

        // Valid-target ring — dashed gold, slightly larger
        if (isTarget) {
            g.appendChild(svgEl('circle', {
                cx: x, cy: y, r: metrics.outer+9,
                fill: 'none', stroke: '#d4a840',
                'stroke-width': 2, opacity: 0.9,
                'stroke-dasharray': '6 4',
            }));
        }

        const countText=metrics.text, bgR=metrics.radius;
        // Capital crown, with space reserved in label placement.
        if (r.is_capital) {
            g.appendChild(svgEl('path', {
                d:`M${x-8} ${y-19}l-2-8 6 4 4-7 4 7 6-4-2 8Z`,
                fill:'#e7c56e',stroke:'#40351d','stroke-width':1,transform:`translate(0 ${14-bgR})`,
            }));
        }

        // Army count — centered on the region point
        const shape=metrics.shape;
        const attrs={fill:'#172529',stroke:{player_1:'#8ebfe9',player_2:'#efa296',rogue:'#c3c6ad'}[r.owner],
            'stroke-width':1.5,class:'army-counter','data-owner':r.owner};
        const counter=shape==='player_2'?svgEl('rect',{...attrs,x:x-bgR,y:y-bgR,width:bgR*2,height:bgR*2,rx:3}):
            shape==='rogue'?svgEl('path',{...attrs,d:`M${x} ${y-bgR-3}L${x+bgR+3} ${y}L${x} ${y+bgR+3}L${x-bgR-3} ${y}Z`}):
            svgEl('circle',{...attrs,cx:x,cy:y,r:bgR});
        const counterTitle=svgEl('title');counterTitle.textContent=`${r.name}: ${countText} ${strategicView.mode==='recruitment'?'recruits per turn':'troops'} · ${r.owner==='player_1'?'Your army':r.owner==='player_2'?'Rival army':'Neutral army'}`;
        counter.append(counterTitle);g.append(counter);

        const armyEl = svgEl('text', {
            x, y: y + 1,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            fill: isCommitted ? '#b7c2c5' : '#ffffff',
            'font-size': r.army >= 100 ? '10' : '12',
            'font-weight': 'bold',
            'font-family': 'Arial, sans-serif',
            'pointer-events': 'none',
        });
        armyEl.textContent = countText;
        g.appendChild(armyEl);
        const projection=projections.get(r.id);
        if(projection) {
            const friendly=r.owner==='player_1';
            const value=friendly?(projection.outgoing?0:r.army+r.pop_rate)+projection.incoming:projection.incoming;
            const caption=friendly?`→ ${value}`:`⚔ ${value}`;
            const position=labelPosition(x,y,caption);
            const badge=svgEl('text',{x:position.x,y:position.y,'text-anchor':'middle',class:'troop-projection',
                'data-region':r.id});
            badge.textContent=caption;
            const title=svgEl('title'); title.textContent=friendly?'Projected garrison after recruitment and your orders, before enemy actions':'Combined planned attackers, including recruitment; battle outcome not predicted';
            badge.append(title);g.append(badge);
        }

        // Region name — just below the army circle
        const showName=cw>=600||mapCamera.zoom>=1.6||isSelected||isTarget||r.is_capital;
        if(showName) {
        const label = labelPosition(x, y, r.name);
        if(atlas.data && Math.hypot(label.x-x,label.y-y)>38)g.appendChild(svgEl('line',{
            x1:x,y1:y,x2:label.x,y2:label.y-5,stroke:'rgba(235,230,207,.5)',
            'stroke-width':.7,'vector-effect':'non-scaling-stroke','pointer-events':'none'}));
        const nameEl = svgEl('text', {
            x:label.x, y:label.y,
            'text-anchor': 'middle',
            fill: atlas.data ? '#f5f0df' : (isSelected ? '#f0e8d0' : 'rgba(230,218,190,0.68)'),
            stroke: atlas.data ? '#26332e' : 'none',
            'stroke-width': atlas.data ? 3 : 0,
            'paint-order': 'stroke',
            'vector-effect': 'non-scaling-stroke',
            'stroke-linejoin': 'round',
            'font-size': interfaceView.labelSize,
            'font-family': 'Arial, sans-serif',
            'font-weight': 600,
            'pointer-events': 'none',
        });
        nameEl.textContent = r.name;
        g.appendChild(nameEl);
        }

        gLabels.appendChild(g);
    }

    // The head always points at the destination, including short/reverse orders.
    if (matrix) for (const mv of pendingMoves) {
        const from=regions[mv.from_region_id], to=regions[mv.to_region_id];
        if (!from || !to) continue;
        const arrow=plannedMoveArrow(from,to,matrix,null,Boolean(mv.standing_id));
        if (arrow) gArrows.append(arrow);
    }
    if(matrix&&campaignReplay.active)for(const movement of campaignReplay.movements()) {
        const from=regions[movement.from],to=regions[movement.to];
        if(!from||!to)continue;
        const arrow=plannedMoveArrow(from,to,matrix,movement);
        if(arrow)gArrows.append(arrow);
    }
    document.getElementById('g-labels').replaceChildren(gLabels);
    document.getElementById('g-arrows').replaceChildren(gArrows);
    document.getElementById('g-connections').replaceChildren(gConn);
}

function renderMap() {
    if (!state) return;
    document.getElementById('map-world').classList.toggle('is-planning', planning.source() !== null);
    scaleCache = computeScale(state.regions);
    if (atlas.data) atlas.prepare(state.regions);
    const canvasData = atlas.data
        ? atlas.render(state.regions, planning.source(), planning.targets(),
            new Set(pendingMoves.map(m => m.from_region_id)))
        : renderCanvas();
    strategicView.render();
    renderOverlay(canvasData.idxMap, canvasData.cw, canvasData.ch);
}

// ── Canvas interaction ────────────────────────────────────────────────────────

function findNearestRegionId(nx, ny) {
    if (atlas.data) return atlas.hit(nx, ny);
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
        if (resolving || !state) return;
        const rect = canvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top)  / rect.height;
        handleRegionClick(findNearestRegionId(nx, ny));
    });

    document.getElementById('map-world').addEventListener('mouseleave',()=>{
        document.querySelector('#g-labels .region-hover')?.classList.remove('region-hover');
        lastHoverId=null;
    });
    let hoverFrame=0, latestPointer;
    document.getElementById('map-world').addEventListener('mousemove', e => {
        latestPointer={clientX:e.clientX,clientY:e.clientY};
        if(hoverFrame)return;
        hoverFrame=requestAnimationFrame(() => {
        hoverFrame=0;
        if (!state || resolving || mapCamera.dragging) return;
        const e=latestPointer;
        const rect = canvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top)  / rect.height;
        const rid = findNearestRegionId(nx, ny);

        if (rid !== lastHoverId) {
            document.querySelector('#g-labels .region-hover')?.classList.remove('region-hover');
            document.querySelector(`#g-labels [data-id="${rid}"]`)?.classList.add('region-hover');
            lastHoverId = rid;
            if (rid < 0) clearRegionInfo(); else updateRegionInfo(rid);
        }

        // Cursor hint
        const r = state.regions[rid];
        const committedFrom = new Set(pendingMoves.map(m => m.from_region_id));
        const validTargets = planning.targets();

        if (validTargets.has(rid)) {
            canvas.style.cursor = 'crosshair';
        } else if (standingOrders.editor) {
            canvas.style.cursor = 'not-allowed';
        } else if (r && r.owner === 'player_1' && validMoves[rid] && !committedFrom.has(rid)) {
            canvas.style.cursor = 'pointer';
        } else {
            canvas.style.cursor = 'default';
        }
        });
    });
}

// ── Game interaction ──────────────────────────────────────────────────────────

function handleRegionClick(id) {
    if (resolving || id < 0) return;
    if (gameOver) { updateRegionInfo(id); return; }

    if(standingOrders.pick(id))return;
    const r = state.regions[id];
    const committedFrom = new Set(pendingMoves.map(m => m.from_region_id));

    if (selectedFrom !== null) {
        if (id === selectedFrom) {
            selectedFrom = null;
            clearRegionInfo(); lastHoverId=null;
            renderMap(); updateMoveHint(); return;
        }

        const targets = validMoves[selectedFrom] || [];
        if (targets.includes(id)) {
            orderHistory.record([...pendingMoves.filter(m=>m.from_region_id!==selectedFrom),{ from_region_id: selectedFrom, to_region_id: id }]);
            selectedFrom = null;
            clearRegionInfo(); lastHoverId=null;
            renderMap(); planning.pulse(id); updateMovesList(); updateMoveHint(); return;
        }

        // Switch selection to another own region
        if (r.owner === 'player_1' && validMoves[id] && (!committedFrom.has(id)||pendingMoves.some(m=>m.from_region_id===id&&m.standing_id))) {
            selectedFrom = id;
            renderMap(); updateRegionInfo(id); updateMoveHint(); return;
        }

        selectedFrom = null;
        clearRegionInfo(); lastHoverId=null;
        renderMap(); updateMoveHint(); return;
    }

    if (r.owner === 'player_1' && validMoves[id] && (!committedFrom.has(id)||pendingMoves.some(m=>m.from_region_id===id&&m.standing_id))) {
        selectedFrom = id;
        renderMap(); updateRegionInfo(id); updateMoveHint();
    } else {
        updateRegionInfo(id);
    }
}

function removePendingMove(fromId) {
    if (resolving || gameOver) return;
    orderHistory.record(pendingMoves.filter(m => m.from_region_id !== fromId));
    selectedFrom=null; clearRegionInfo(); lastHoverId=null;
    renderMap(); updateMovesList(); updateMoveHint();
}

// ── UI updates ────────────────────────────────────────────────────────────────

function updateTopBar() {
    document.getElementById('turn-label').textContent = campaignReplay.active?'Replay':'Turn';
    document.getElementById('turn-num').textContent = campaignReplay.active?(state.turn===1?'Start':state.turn-1):state.turn;
    document.getElementById('p1-name').textContent    = state.battle?.factions.player_1 || state.player_1.name;
    document.getElementById('p1-regions').textContent = state.player_1.regions;
    document.getElementById('p1-army').textContent    = state.player_1.total_army;
    document.getElementById('p2-name').textContent    = state.battle?.factions.player_2 || state.player_2.name;
    document.getElementById('p2-regions').textContent = state.player_2.regions;
    document.getElementById('p2-army').textContent    = state.player_2.total_army;
    const battle = state.battle;
    document.getElementById('battle-status').hidden = !battle;
    const terrainNotes=document.getElementById('battle-terrain-notes');
    terrainNotes.hidden=!atlas.data?.terrain;
    if (atlas.data?.terrain) {
        const terrain=atlas.data.terrain;
        document.getElementById('battle-terrain-description').textContent = terrain.illustrated ? terrain.note : `${terrain.min_elevation} to ${terrain.max_elevation} m · ${terrain.contour_interval} m contours. ${terrain.note}`;
        const credits=terrainNotes.querySelector('a');
        credits.href=atlas.data.setting ? 'maps/collection-sources.html' : 'maps/battle-sources.html';
    }
    const supplyRules = document.getElementById('supply-rules');
    if (!supplyRules.dataset.campaignText) supplyRules.dataset.campaignText = supplyRules.textContent;
    supplyRules.textContent = battle ? 'Owned strongpoints and your headquarters supply connected friendly sectors. There is no recruitment. Isolated armies attack at 75% strength and defend at 85%.' : supplyRules.dataset.campaignText;
    if (battle) {
        const score = owner => battle.objectives.filter(id => state.regions[id].owner === owner).length;
        document.getElementById('battle-title').textContent = battle.name;
        document.getElementById('battle-progress').textContent = `${Math.min(state.turn, battle.turn_limit)}/${battle.turn_limit} turns · Objectives: you ${score('player_1')} — rival ${score('player_2')}`;
        document.getElementById('battle-status').title = `At the end of turn ${battle.turn_limit}, most objectives wins. Ties use army strength, then ${battle.factions[battle.defender]}. Eliminating the opposing army wins early. Crown markers are headquarters.`;
    }
}

function updateRegionInfo(id) {
    planning.hidePreview();
    clearTimeout(forecastTimer); forecastController?.abort();
    const sequence = ++forecastSequence;
    const r = state.regions[id];
    if (!r) return;
    const borderThreat = document.getElementById('show-threats').checked && threatView.key === JSON.stringify([state.turn,pendingMoves]) ? threatView.data?.entries.find(e => e.region_id === id) : null;
    const ownerNames  = { player_1: state.battle?.factions.player_1 || state.player_1.name, player_2: state.battle?.factions.player_2 || state.player_2.name, rogue: 'Neutral' };
    const ownerClass  = { player_1: 'p1-text', player_2: 'p2-text', rogue: 'rogue-text' };
    document.getElementById('region-info').innerHTML = `
        <div class="region-name">${escHtml(r.name)}${r.is_capital ? ' ★' : ''}${state.battle?.objectives.includes(r.id) ? ' · Objective' : ''}</div>
        <div class="region-meta"><span class="${ownerClass[r.owner]}">${escHtml(ownerNames[r.owner])}</span> · ${capitalise(r.terrain)}${atlas.data?.terrain?.elevations ? ` · ~${atlas.data.terrain.elevations[id]} m` : ''}${r.port?' · Port':''}</div>
        <div class="region-stats"><span><b>${r.army}</b> troops</span><span><b>+${r.pop_rate}</b>/turn</span><span><b>×${r.defense_bonus.toFixed(2)}</b> defense</span></div>
        <div class="region-meta ${r.supplied===false?'region-isolated':''}">${r.owner==='rogue'?'Local militia':r.supplied===false?'Isolated supply':'Supplied'}${borderThreat ? ` · <span title="Assumes adjacent enemies attack together; ${borderThreat.garrison} defenders after orders">${Math.round(borderThreat.risk*100)}% potential loss risk</span>` : ''}</div>
        <div id="battle-forecast"></div>
    `;
    if (selectedFrom !== null && (validMoves[selectedFrom]||[]).includes(id)) {
        const orders=[...pendingMoves.filter(m=>m.from_region_id!==selectedFrom),{from_region_id:selectedFrom,to_region_id:id}];
        const target=document.getElementById('battle-forecast');target.textContent='Calculating forecast…';
        planning.preview(id, `${r.name} · Calculating forecast…`);
        forecastTimer=setTimeout(()=>{
            forecastController=new AbortController();
            api.forecast(gameId,orders,forecastController.signal).then(result=>{
                if(sequence!==forecastSequence || result.turn!==state.turn)return;
                const f=result.forecasts.find(item=>item.target===id);if(!f)return;
                planning.preview(id, f.friendly?`${r.name} · +${f.army} reinforcements${state.battle ? '' : ' (includes recruits)'}`:`${r.name} · ${f.army} attackers · ${f.effective_defense} defense · ${Math.round(f.win_probability*100)}% victory chance. Includes ${state.battle ? '' : 'recruits and '}queued attacks; enemy orders may change this.`);
                target.innerHTML=f.friendly?`<p>Reinforce with <b>${f.army}</b> troops.</p>`:
                    `<p class="forecast-odds">${Math.round(f.win_probability*100)}% estimated victory</p>
                    <details class="forecast-details"><summary>Forecast details</summary><p>${f.army} troops · ${f.effective_attack} effective strength against ${f.effective_defense} defense</p>
                    <p>Losses if victorious: ${f.losses_on_win.join('–')}. Potential retreat survivors if defeated: ${f.retreat_survivors_on_loss.join('–')}.</p>
                    <p>Approach: ${f.crossings.map(escHtml).join(', ')}${f.isolated_sources.length?' · Isolated attackers':''}</p>
                    <small>Includes ${state.battle ? '' : 'recruits and '}combined planned attacks. Assumes defenders stay; enemy moves can change the outcome. Retreat requires a friendly destination.</small></details>`;
            }).catch(error=>{if(error.name!=='AbortError' && sequence===forecastSequence){target.textContent='Forecast unavailable. Hover again to retry.';planning.preview(id,'Forecast unavailable. Hover again to retry.');}});
        },120);
    }
}

function clearRegionInfo() {
    planning.hidePreview();
    clearTimeout(forecastTimer); forecastController?.abort();
    ++forecastSequence;
    document.getElementById('region-info').innerHTML =
        '<p class="no-selection">Hover a region to inspect it.</p>';
}

function updateMovesList() {
    standingOrders.render();
    orderHistory.updateButtons();
    threatView.refresh();
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
            <span class="move-regions"><b>${escHtml(from.name)}</b> → ${escHtml(to.name)}</span>
            ${m.standing_id?'<small>Auto</small>':''}
            <button class="move-remove" onclick="removePendingMove(${m.from_region_id})" title="${m.standing_id?'Pause standing order':'Cancel'}">×</button>
        </div>`;
    }).join('');
}

function updateMoveHint() {
    const hint = document.getElementById('move-hint');
    if(standingOrders.editor) {hint.textContent=`Repeat reinforcement: choose a highlighted friendly neighbor (${planning.targets().size} available). Escape cancels.`;return;}
    const committed = new Set(pendingMoves.map(m => m.from_region_id));
    const available = Object.keys(validMoves).filter(id => !committed.has(+id)).length;

    if (selectedFrom !== null) {
        const r = state.regions[selectedFrom];
        const targets = validMoves[selectedFrom] || [];
        hint.textContent = `${r.name} selected — choose a destination (${targets.length} options).`;
    } else if (available > 0) {
        hint.textContent = `${available} region${available !== 1 ? 's' : ''} can still move. Right-click or hold a region for repeat reinforcements.`;
    } else {
        hint.textContent = `All moves planned. Click Next Turn when ready.`;
    }
}

function showCombatLog(summary) {
    battleReports.recap(summary);
    document.getElementById('combat-log-section').classList.remove('hidden');
    document.getElementById('combat-log').classList.remove('hidden');
    document.getElementById('log-turn').textContent = summary.turn;

    const log = document.getElementById('combat-log');
    if (summary.combat_results.length === 0) {
        log.innerHTML = '<div class="log-entry" style="font-style:italic;color:#666880">No battles this turn.</div>';
        return;
    }
    log.innerHTML = summary.combat_results.map(c => battleReports.battle(c)).join('');
}

function setResolving(on) {
    resolving = on;
    if(on){mapOrders.clearHold();mapOrders.close();}
    document.getElementById('resolving-overlay').classList.toggle('hidden', !on);
    document.getElementById('end-turn-btn').disabled = on;
    document.getElementById('abandon-btn').disabled = on;
    orderHistory.updateButtons();
}

function abandon() {
    if (!resolving || document.getElementById('save-status').textContent.startsWith('Connection lost')) {
        sessionStorage.removeItem('gameId');
        sessionStorage.removeItem('presetId');
        window.location.href = 'index.html';
    }
}

// ── Turn submission ───────────────────────────────────────────────────────────

async function endTurn() {
    if (resolving || gameOver) return;
    if(standingOrders.editor) {standingOrders.message('Choose a highlighted neighbor or cancel reinforcement selection before ending the turn.');return;}
    const submittedTurn=state.turn;
    const submittedPlan=orderHistory.snapshot();
    setResolving(true);
    planning.clearEffects(); planning.hidePreview();
    selectedFrom = null;
    clearTimeout(forecastTimer); forecastController?.abort();
    ++forecastSequence;
    const status=document.getElementById('save-status');
    status.textContent='Resolving…';
    try {
        const result = await api.submitTurn(gameId, standingOrders.manual(), state.turn, standingOrders.orders);
        pendingMoves = [];
        orderHistory.reset();
        status.textContent='Saved';
        campaigns.remember(gameId,result.state);
        campaignHistory.push({...result,state:undefined});
        document.getElementById('resolving-overlay').classList.add('hidden');
        try { await presentation.replay(result); }
        finally { state=result.state; standingOrders.load();standingOrders.saveDraft(true);clearRegionInfo(); lastHoverId=null; }
        const vm=await api.getValidMoves(gameId);
        validMoves=Object.fromEntries(Object.entries(vm).map(([k,v])=>[+k,v]));
        setResolving(false);
        updateTopBar();renderMap();showCombatLog(result);renderTimeline();updateMovesList();updateMoveHint();
        sidebar.showTurnReport();
        if(result.game_over)handleGameOver(result.winner);
    } catch(error) {
        // A lost HTTP response may still have committed. Re-read before allowing
        // another order, so retries never silently resolve the same turn twice.
        try {
            const latest=await api.getGame(gameId);
            state=latest.state;campaignHistory=latest.history||[];pendingMoves=[];
            standingOrders.load();
            if(state.turn===submittedTurn)orderHistory.apply(submittedPlan);
            else standingOrders.saveDraft(true);
            orderHistory.reset();
            clearRegionInfo();lastHoverId=null;
            const vm=await api.getValidMoves(gameId);validMoves=vm;
            campaigns.remember(gameId,state);updateTopBar();renderMap();updateMovesList();renderTimeline();
            if(campaignHistory.length)showCombatLog(campaignHistory[campaignHistory.length-1]);
            if(state.turn>submittedTurn)sidebar.showTurnReport();
            if(!standingOrders.draftError)status.textContent=`Saved through turn ${state.turn-1}`;
            setResolving(false);updateMoveHint();
            if(state.game_over)handleGameOver(state.winner);
        } catch {
            status.textContent='Connection lost — reload to recover saved campaign';
            document.getElementById('resolving-overlay').classList.add('hidden');
            document.getElementById('abandon-btn').disabled=false;
            // Keep new turns blocked until the committed server state is known.
        }
        alert(error.message);
    }
}

function renderTimeline() {
    document.getElementById('timeline-list').innerHTML=campaignHistory.slice().reverse().map(entry=>{
        const captured=(entry.events||[]).filter(e=>e.type==='battle'&&e.won);
        const text=captured.length?captured.map(e=>`${e.owner==='player_1'?'You':'AI'} captured ${state.regions[e.to]?.name||'territory'}`).join(' · '):'Frontiers held';
        return `<p><b>Turn ${entry.turn}</b><br>${escHtml(text)}</p>`;
    }).join('')||'<p>Your campaign begins here.</p>';
}

function handleGameOver(winner) {
    const isVictory = winner === 'player_1';
    const overlay   = document.getElementById('gameover-overlay');
    const title     = document.getElementById('gameover-title');
    const subtitle  = document.getElementById('gameover-subtitle');

    title.textContent = isVictory ? 'VICTORY' : 'DEFEAT';
    title.style.color = isVictory ? '#dfc184' : '#efa296';
    subtitle.textContent = isVictory
        ? `${state.player_1.name} conquers all.`
        : `${state.player_2.name} prevails.`;
    if (state.battle) {
        const objectives = owner => state.battle.objectives.filter(id => state.regions[id].owner === owner).length;
        subtitle.textContent = `${state.battle.factions[winner]} wins. Objectives: ${objectives('player_1')}–${objectives('player_2')} · Your remaining strength: ${state.player_1.total_army}.`;
    }
    overlay.classList.remove('hidden');
    setResolving(false);

    // Game is done — kill Next Turn, repurpose Abandon
    gameOver = true;
    document.getElementById('open-campaign-replay').hidden=false;
    orderHistory.updateButtons();
    document.getElementById('end-turn-btn').disabled = true;
    document.getElementById('abandon-btn').textContent = 'Back to Menu';

    sessionStorage.setItem('winner', winner);
    sessionStorage.setItem('winnerName', isVictory ? state.player_1.name : state.player_2.name);
    sessionStorage.setItem('turns', state.turn);
    sessionStorage.setItem('p1regions', state.player_1.regions);
    sessionStorage.setItem('p2regions', state.player_2.regions);

    // Keep the final map and timeline available for review.
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

async function init() {
    gameId = sessionStorage.getItem('gameId');
    if (!gameId) { window.location.href = 'index.html'; return; }

    document.getElementById('end-turn-btn').addEventListener('click', endTurn);
    document.getElementById('retry-draft-save').addEventListener('click',()=>{if(!resolving)standingOrders.saveDraft();});
    document.getElementById('abandon-btn').addEventListener('click', abandon);
    sidebar.init();
    interfaceView.init();
    presentation.init();
    campaignReplay.init();
    orderHistory.init();
    strategicView.init();
    battleReports.init();
    document.getElementById('review-campaign').addEventListener('click',()=>document.getElementById('gameover-overlay').classList.add('hidden'));
    document.getElementById('show-supply').addEventListener('change', renderMap);
    document.getElementById('show-threats').addEventListener('change', () => threatView.refresh());
    document.getElementById('show-atmosphere').addEventListener('change', () => world.render());
    document.addEventListener('visibilitychange', () => document.body.classList.toggle('world-paused', document.hidden));
    mapCamera.init(() => { if (state) renderMap(); });
    mapOrders.init();
    initCanvasEvents();
    planning.init();

    const loadScreen=document.getElementById('load-screen');
    document.getElementById('retry-game').addEventListener('click',()=>location.reload());
    const preview=document.getElementById('load-preview');
    const preset=sessionStorage.getItem('mapAssetId')||sessionStorage.getItem('presetId');
    if(preset) { preview.src=`maps/thumbnails/${encodeURIComponent(preset)}.svg`;preview.hidden=false;preview.onerror=()=>{preview.hidden=true;}; }
    document.getElementById('main').inert=true;
    document.getElementById('bottom-bar').inert=true;
    try {
        const [gameData, vm] = await Promise.all([
            api.getGame(gameId),
            api.getValidMoves(gameId),
        ]);
        await atlas.load(gameData.state.map_asset_id ?? gameData.state.preset_id ?? (sessionStorage.getItem('presetId') || ''), gameData.state.regions);
        state = gameData.state;
        standingOrders.load(true);
        campaigns.remember(gameId,state);
        campaignHistory=gameData.history||[];
        document.getElementById('campaign-title').textContent=state.campaign_name||'Campaign';
        renderTimeline();
        if(campaignHistory.length)showCombatLog(campaignHistory[campaignHistory.length-1]);
        validMoves = {};
        for (const [k, v] of Object.entries(vm)) validMoves[+k] = v;

        updateTopBar();
        updateMovesList();
        renderMap();
        if(atlas.data?.review_version>=3 && atlas.data.aspect<.8)mapCamera.fitRegions();
        updateMoveHint();
        if(state.game_over)handleGameOver(state.winner);
        loadScreen.hidden=true;
        document.getElementById('main').inert=false;
        document.getElementById('bottom-bar').inert=false;

    } catch (e) {
        document.getElementById('load-title').textContent='Your campaign could not open';
        document.getElementById('load-message').textContent=e.message+' Your saved campaign has not been changed.';
        document.getElementById('load-actions').hidden=false;
        document.getElementById('retry-game').focus();
    }
}

init();
