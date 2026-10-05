// Browser regression check. Requires Playwright + Chromium, and a static server
// at IMPERIUM_TEST_URL (default: python3 -m http.server 8765 from repo root).
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json, runpy
from pathlib import Path
out={}
for file in Path('games/borderstrife/engine/presets').glob('*.py'):
 if file.stem in ('loader','__init__','starts'): continue
 p=runpy.run_path(str(file))['PRESET']
 regions={}
 for i,(name,terrain,x,y) in enumerate(p['regions']):
  owner='player_1' if i in [p['player1_capital'],*p['player1_extra_starts']] else 'rogue'
  regions[i]=dict(id=i,name=name,terrain=terrain,x=x,y=y,owner=owner,army=20,
   is_capital=i==p['player1_capital'],neighbors=[(i+1)%len(p['regions'])],pop_rate=2,defense_bonus=1)
 out[p['id']]=dict(state=dict(regions=regions,turn=1,rogue_regions=len(regions)-3,
  player_1=dict(name='You',regions=3,total_army=60,capital=p['player1_capital']),
  player_2=dict(name='AI',regions=3,total_army=60,capital=p['player2_capital'])))
print(json.dumps(out))
`], {cwd:root}));

(async () => {
    const browser = await chromium.launch({headless:true});
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', async d => { errors.push(d.message()); await d.dismiss(); });
        let current;
        await page.route('**/api/imperium/games/**', route => route.fulfill({json:
            route.request().url().endsWith('valid-moves')
                ? Object.fromEntries(Object.values(fixtures[current].state.regions)
                    .filter(r => r.owner === 'player_1').map(r => [r.id, r.neighbors]))
                : fixtures[current],
        }));
        const base = process.env.IMPERIUM_TEST_URL || 'http://localhost:8765/games/borderstrife/ui';
        // Establish same-origin storage without invoking the welcome page's API.
        await page.goto(`${base}/maps/europe.json`);
        for (const key of Object.keys(fixtures)) {
            current = key;
            await page.evaluate(key => {
                sessionStorage.setItem('gameId', 'test'); sessionStorage.setItem('presetId', key);
            }, key);
            await page.goto(`${base}/game.html`);
            await page.waitForFunction(() => atlas.geometry);
            for (const viewport of [{width:1440,height:1000}, {width:1024,height:768}, {width:800,height:900}]) {
                await page.setViewportSize(viewport);
                await page.waitForFunction(() => atlas.layout.w === document.getElementById('map-canvas').clientWidth);
                const result = await page.evaluate(() => ({
                    misses:Object.values(state.regions).filter(r => findNearestRegionId(normX(r.x),normY(r.y)) !== r.id).map(r => r.name),
                    sea:findNearestRegionId(0,0),
                    aspect:atlas.layout.width/atlas.layout.height,
                    expectedAspect:atlas.data.aspect,
                }));
                assert.deepEqual(result.misses, [], `${key}: marker hit areas`);
                assert.equal(result.sea, -1);
                assert.ok(Math.abs(result.aspect-result.expectedAspect) < 1e-8);
            }
            const clickRegion = async id => {
                const point = await page.evaluate(id => {
                    const r=state.regions[id], rect=document.getElementById('map-canvas').getBoundingClientRect();
                    return {x:rect.left+normX(r.x)*rect.width,y:rect.top+normY(r.y)*rect.height};
                }, id);
                await page.mouse.click(point.x, point.y);
            };
            const from = fixtures[key].state.player_1.capital;
            const to = fixtures[key].state.regions[from].neighbors[0];
            await clickRegion(from);
            assert.equal(await page.evaluate(() => selectedFrom), from);
            await clickRegion(to);
            assert.equal(await page.evaluate(() => pendingMoves.length), 1);
            await page.evaluate(()=>sidebar.open('orders'));
            await page.locator('.move-remove').click();
            assert.equal(await page.evaluate(() => pendingMoves.length), 0);
            // A fresh turn replaces state coordinates with engine coordinates.
            await page.evaluate(fixture => { state=fixture.state; renderMap(); }, fixtures[key]);
            await clickRegion(from);
            assert.equal(await page.evaluate(() => selectedFrom), from);
            console.log(`${key}: resizing, hit areas, movement, cancellation, state replacement passed`);
        }
        // Old campaigns must fail with a useful message before rendering new geometry.
        const mismatch = await page.evaluate(async fixture => {
            delete fixture.state.regions[36];
            try { await atlas.load('india', fixture.state.regions); return ''; }
            catch (error) { return error.message; }
        }, fixtures.india);
        assert.match(mismatch, /Start a new campaign/);
        await page.evaluate(() => sessionStorage.removeItem('presetId'));
        await page.goto(`${base}/game.html`);
        await page.waitForFunction(() => state && scaleCache);
        assert.equal(await page.evaluate(() => atlas.data), null);
        assert.equal(await page.locator('#g-labels > g').count(), Object.keys(fixtures[current].state.regions).length);
        assert.deepEqual(errors, []);
        console.log('Procedural renderer fallback passed; no browser errors.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode=1; });
