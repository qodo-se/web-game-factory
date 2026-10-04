// Requires the local API and UI servers; all created campaigns stay local.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.IMPERIUM_TEST_URL || 'http://localhost:8766';
const apiBase = process.env.IMPERIUM_TEST_API || 'http://localhost:8091';
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(url => localStorage.setItem('IMPERIUM_API_BASE', url), apiBase);
        await page.goto(base);
        await page.waitForFunction(() => !document.getElementById('start-btn').disabled);
        assert.equal(await page.locator('.map-card').count(), 8);
        assert.equal(await page.locator('#random-options, #preset-select, .mode-tabs').count(), 0);
        await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
        await page.screenshot({ path: '/tmp/imperium-gallery-desktop.png', fullPage: true });
        // An older, slower preview must not overwrite a newer selection.
        let release;
        const held = new Promise(resolve => { release = resolve; });
        await page.route('**/presets/americas/starts', async route => { await held; await route.continue(); });
        await page.locator('input[value="americas"]').check();
        assert.equal(await page.locator('#start-btn').isDisabled(), true);
        await page.locator('input[value="africa_middle_east"]').check();
        await page.waitForFunction(() => !document.getElementById('start-btn').disabled);
        const kingdom = await page.locator('#kingdom-select').textContent();
        release();
        await page.waitForResponse(r => r.url().endsWith('/americas/starts'));
        assert.equal(await page.locator('#kingdom-select').textContent(), kingdom);
        await page.unroute('**/presets/americas/starts');
        await page.setViewportSize({width:390,height:844});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({path:'/tmp/imperium-gallery-mobile.png',fullPage:true});
        // Create each new campaign, check the real renderer and submit a turn.
        for (const id of ['americas','africa_middle_east','southeast_asia_oceania','balochistan_borderlands_expanded']) {
            await page.goto(base);
            await page.locator(`input[value="${id}"]`).check();
            await page.waitForFunction(() => !document.getElementById('start-btn').disabled);
            await page.locator('#start-btn').click();
            await page.waitForURL('**/game.html');
            await page.waitForFunction(() => typeof atlas !== 'undefined' && atlas.geometry);
            assert.equal(await page.evaluate(() => atlas.data.id), id);
            if (id === 'balochistan_borderlands_expanded') {
                const names = await page.evaluate(() => Object.values(state.regions).map(r => r.name));
                for (const name of ['Zahedan', 'Saravan', 'Chabahar', 'Quetta', 'Kandahar', 'Karachi', 'Hyderabad', 'Lahore', 'Multan', 'Balkh', 'Kunduz', 'Badakhshan', 'Wakhan']) assert.ok(names.includes(name));
                for (const name of ['Gilgit', 'Baltistan']) assert.ok(!names.includes(name));
            }
            const gameId = await page.evaluate(() => sessionStorage.getItem('gameId'));
            const turn = await page.request.post(`${apiBase}/api/imperium/games/${gameId}/turn`, {data:{moves:[],expected_turn:1}});
            assert.equal(turn.status(),200);
            if (id === 'balochistan_borderlands_expanded') {
                await page.reload();
                await page.waitForFunction(() => typeof state !== 'undefined' && state?.turn === 2 && atlas.geometry);
                assert.equal(await page.evaluate(() => atlas.data.id), id);
            }
            await page.setViewportSize({width:1440,height:1000});
            await page.waitForFunction(() => atlas.layout.w === document.getElementById('map-canvas').clientWidth);
            await page.screenshot({path:`/tmp/imperium-${id}.png`,fullPage:true});
        }
        const rejected = await page.request.post(`${apiBase}/api/imperium/games`,{data:{mode:'random'}});
        assert.equal(rejected.status(),422);
        // Website may deploy before the API: no historical category in an old catalog.
        await page.route('**/api/imperium/presets', async route => {
            const response = await route.fetch();
            const catalog = await response.json();
            await route.fulfill({json:catalog.filter(p=>p.category==='world').map(({category,battle,...p})=>p)});
        });
        await page.goto(base);
        await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
        let releasePreview;
        const waitingPreview = new Promise(resolve=>{releasePreview=resolve;});
        await page.route('**/presets/americas/starts',async route=>{await waitingPreview;await route.continue();});
        await page.locator('input[value="americas"]').check();
        await page.getByRole('button',{name:'Historical Battles'}).click();
        assert.ok(await page.locator('#start-btn').isDisabled());
        releasePreview();
        await page.waitForResponse(r=>r.url().endsWith('/americas/starts'));
        assert.ok(await page.locator('#start-btn').isDisabled());
        assert.ok(await page.locator('#kingdom-select').isDisabled());
        assert.equal(await page.locator('.map-card').count(),0);
        assert.match(await page.locator('#map-grid').textContent(),/No maps available/);
        await page.getByRole('button',{name:'World Campaigns'}).click();
        await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
        assert.deepEqual(errors,[]);
        console.log('Gallery, mobile layout, stale preview, new campaigns, maps and turns passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
