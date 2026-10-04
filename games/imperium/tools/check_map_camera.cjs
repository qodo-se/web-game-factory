// Live integration check: run the local UI and API first. Requires Playwright.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const ui = process.env.IMPERIUM_TEST_URL || 'http://localhost:3000';
const apiBase = process.env.IMPERIUM_TEST_API || 'http://127.0.0.1:8080';

(async () => {
    const browser = await chromium.launch({headless:true});
    try {
        const page = await browser.newPage({viewport:{width:1440,height:1000}});
        const errors=[];
        page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', async d => { errors.push(d.message()); await d.dismiss(); });
        await page.addInitScript(base => localStorage.setItem('IMPERIUM_API_BASE',base),apiBase);
        await page.goto(ui);
        await page.waitForFunction(() => !document.getElementById('start-btn').disabled);
        await page.locator('input[value="india"]').check();await page.waitForFunction(()=>!document.getElementById('start-btn').disabled);
        await page.locator('#start-btn').click();
        await page.waitForURL('**/game.html');
        await page.waitForFunction(() => atlas.geometry);
        const camera = () => page.evaluate(() => ({zoom:mapCamera.zoom,x:mapCamera.x,y:mapCamera.y}));
        const marker = id => page.evaluate(id => {
            const r=state.regions[id], rect=document.getElementById('map-canvas').getBoundingClientRect();
            return {x:rect.left+normX(r.x)*rect.width,y:rect.top+normY(r.y)*rect.height};
        },id);
        const from=await page.evaluate(() => state.player_1.capital);
        const to=await page.evaluate(from => validMoves[from][0],from);
        const start=await marker(from);
        const sidebar=await page.locator('#side-panel').boundingBox();
        const controls=await page.locator('.map-navigation').boundingBox();
        await page.mouse.move(start.x,start.y);
        await page.mouse.wheel(0,-240);
        await page.waitForFunction(() => mapCamera.zoom > 1.5);
        const after=await marker(from);
        assert.ok(Math.hypot(start.x-after.x,start.y-after.y)<1,'Zoom stays anchored at cursor');
        assert.deepEqual(await page.locator('#side-panel').boundingBox(),sidebar);
        assert.deepEqual(await page.locator('.map-navigation').boundingBox(),controls);
        await page.waitForFunction(() => document.getElementById('map-canvas').width > atlas.layout.w);

        // Shift-drag on an owned counter pans without planning an order.
        await page.keyboard.down('Shift');
        await page.mouse.move(after.x,after.y); await page.mouse.down();
        await page.mouse.move(after.x+70,after.y+45,{steps:10}); await page.mouse.up();
        await page.keyboard.up('Shift');
        assert.equal(await page.evaluate(() => selectedFrom),null);
        assert.equal(await page.evaluate(() => pendingMoves.length),0);
        assert.ok((await camera()).x > -500);
        let point=await marker(from); await page.mouse.click(point.x,point.y);
        assert.equal(await page.evaluate(() => selectedFrom),from);
        point=await marker(to); await page.mouse.click(point.x,point.y);
        assert.equal(await page.evaluate(() => pendingMoves.length),1);
        assert.equal(await page.locator('#g-arrows .planned-arrow').count(),1);
        await page.evaluate(()=>sidebar.open('orders'));
            await page.locator('.move-remove').click();
        assert.equal(await page.evaluate(() => pendingMoves.length),0);

        // Trackpad pinch is exposed as ctrl+wheel by desktop browsers.
        const beforePinch=await camera();
        await page.locator('#map-canvas').dispatchEvent('wheel',{
            clientX:start.x,clientY:start.y,deltaY:-30,ctrlKey:true,bubbles:true,cancelable:true,
        });
        assert.ok((await camera()).zoom > beforePinch.zoom);
        const beforePan=await camera();
        await page.locator('#map-canvas').dispatchEvent('wheel',{
            deltaY:40,shiftKey:true,bubbles:true,cancelable:true,
        });
        assert.equal((await camera()).zoom,beforePan.zoom);
        assert.ok((await camera()).x < beforePan.x);
        const beforeTurn=await camera();
        await page.locator('#end-turn-btn').click();
        await page.waitForFunction(() => state.turn === 2 && !resolving);
        assert.deepEqual(await camera(),beforeTurn,'Turn changes preserve camera');
        await page.screenshot({path:'/tmp/imperium-map-zoom.png'});

        await page.locator('#map-container').focus();
        await page.keyboard.press('ArrowRight');
        assert.ok((await camera()).x < beforeTurn.x);
        await page.keyboard.press('0');
        assert.deepEqual(await camera(),{zoom:1,x:0,y:0});
        assert.ok(await page.locator('#map-zoom-out').isDisabled());
        for(let i=0;i<10;i++) await page.locator('#map-zoom-in').click({force:true});
        assert.equal((await camera()).zoom,5);
        assert.ok(await page.locator('#map-zoom-in').isDisabled());
        await page.setViewportSize({width:1024,height:768});
        await page.waitForFunction(() => atlas.layout.w === document.getElementById('map-canvas').clientWidth);
        assert.ok(await page.evaluate(() => mapCamera.x<=0 && mapCamera.y<=0 &&
            mapCamera.x>=mapCamera.viewport.clientWidth*(1-mapCamera.zoom) &&
            mapCamera.y>=mapCamera.viewport.clientHeight*(1-mapCamera.zoom)));
        await page.locator('#map-reset').click();
        assert.deepEqual(await camera(),{zoom:1,x:0,y:0});

        // Random maps share the same camera and inverse hit coordinates.
        await require('./legacy_random_fixture.cjs')(page);
        await page.goto(`${ui}/game.html`);
        await page.waitForFunction(() => state && scaleCache);
        await page.locator('#map-zoom-in').click();
        const randomCapital=await page.evaluate(() => state.player_1.capital);
        point=await marker(randomCapital); await page.mouse.click(point.x,point.y);
        assert.equal(await page.evaluate(() => selectedFrom),randomCapital);
        assert.deepEqual(errors,[]);
        console.log('Live camera checks passed: cursor anchoring, drag vs click, transformed selection/moves, pinch, pan, turn persistence, reset, limits, resize, random maps.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
