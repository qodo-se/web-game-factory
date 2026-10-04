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
        assert.equal(await page.locator('.map-card').count(), 7);
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
        for (const id of ['americas','africa_middle_east','southeast_asia_oceania']) {
            await page.goto(base);
            await page.locator(`input[value="${id}"]`).check();
            await page.waitForFunction(() => !document.getElementById('start-btn').disabled);
            await page.locator('#start-btn').click();
            await page.waitForURL('**/game.html');
            await page.waitForFunction(() => typeof atlas !== 'undefined' && atlas.geometry);
            assert.equal(await page.evaluate(() => atlas.data.id), id);
            const gameId = await page.evaluate(() => sessionStorage.getItem('gameId'));
            const turn = await page.request.post(`${apiBase}/api/imperium/games/${gameId}/turn`, {data:{moves:[],expected_turn:1}});
            assert.equal(turn.status(),200);
            await page.setViewportSize({width:1440,height:1000});
            await page.waitForFunction(() => atlas.layout.w === document.getElementById('map-canvas').clientWidth);
            await page.screenshot({path:`/tmp/imperium-${id}.png`,fullPage:true});
        }
        const rejected = await page.request.post(`${apiBase}/api/imperium/games`,{data:{mode:'random'}});
        assert.equal(rejected.status(),422);
        assert.deepEqual(errors,[]);
        console.log('Gallery, mobile layout, stale preview, new campaigns, maps and turns passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
