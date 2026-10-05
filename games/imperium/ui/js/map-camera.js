// Shared camera for the terrain canvas and SVG labels/arrows. Coordinates in
// game.js remain in map space; the canvas bounding rect supplies the inverse
// transform for selection. Controls and panels stay outside the moving layer.
const mapCamera = {
    zoom: 1, x: 0, y: 0, maxZoom: 5, dragging: false,
    init(onSettle) {
        this.viewport = document.getElementById('map-container');
        this.world = document.getElementById('map-world');
        // Terrain and interactive SVG orders share one gesture surface.
        const surface = this.world;
        this.onSettle = onSettle;
        const inputMode = document.getElementById('map-input-mode');
        this.inputMode = /Mac/.test(navigator.platform) ? 'touchpad' : 'mouse';
        try {
            const saved = localStorage.getItem('imperium-map-input-mode');
            if (saved === 'mouse' || saved === 'touchpad') this.inputMode = saved;
        } catch { /* Defaults remain usable when storage is unavailable. */ }
        const updateInputMode = () => {
            inputMode.value = this.inputMode;
            document.getElementById('map-navigation-help').textContent = this.inputMode === 'touchpad'
                ? 'Two-finger scroll to pan · Pinch or +/− to zoom · Drag anywhere to pan · Click source, then destination to move · Right-click or hold for orders · Esc to cancel'
                : 'Scroll to zoom · Drag anywhere to pan · Click or tap source, then destination to move · Right-click or hold for orders · Esc to cancel';
        };
        inputMode.addEventListener('change', () => {
            this.inputMode = inputMode.value;
            try { localStorage.setItem('imperium-map-input-mode', this.inputMode); } catch {}
            updateInputMode();
        });
        updateInputMode();
        let pointer = null, suppressClick = false;
        this.cancelGesture = () => {
            if (!pointer) return;
            const id = pointer.id;
            pointer = null;
            suppressClick = true;
            this.dragging = false;
            this.viewport.classList.remove('is-panning');
            if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
        };
        surface.addEventListener('wheel', e => {
            e.preventDefault();
            if (this.gestureActive) return;
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.viewport.clientHeight : 1;
            if (this.inputMode === 'touchpad' && !e.ctrlKey) {
                this.pan(-e.deltaX * unit, -e.deltaY * unit);
            } else if (e.shiftKey && !e.ctrlKey) {
                this.pan(-((e.deltaX || e.deltaY) * unit), e.deltaX ? -e.deltaY * unit : 0);
            } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
                this.pan(-e.deltaX * unit, -e.deltaY * unit);
            } else {
                const rect = this.viewport.getBoundingClientRect();
                const delta = Math.max(-250, Math.min(250, e.deltaY * unit));
                this.zoomAt(this.zoom * Math.exp(-delta * (e.ctrlKey ? .01 : .002)),
                    e.clientX - rect.left, e.clientY - rect.top);
            }
        }, { passive: false });
        // Safari exposes pinch as GestureEvent rather than ctrl+wheel.
        surface.addEventListener('gesturestart', e => {
            e.preventDefault();
            this.cancelGesture();
            this.gestureActive = true;
            this.gestureZoom = this.zoom;
        }, { passive: false });
        const pinch = e => {
            if (!this.gestureActive) return;
            e.preventDefault();
            if (Number.isFinite(e.scale) && e.scale > 0) {
                const rect = this.viewport.getBoundingClientRect();
                const x = Number.isFinite(e.clientX) ? e.clientX - rect.left : rect.width / 2;
                const y = Number.isFinite(e.clientY) ? e.clientY - rect.top : rect.height / 2;
                this.zoomAt(this.gestureZoom * e.scale, x, y);
            }
        };
        surface.addEventListener('gesturechange', pinch, { passive: false });
        surface.addEventListener('gestureend', e => { pinch(e); this.gestureActive = false; }, { passive: false });
        surface.addEventListener('pointerdown', e => {
            if (pointer || (e.button !== 0 && e.button !== 1)) return;
            suppressClick = false;
            pointer = { id:e.pointerId, startX:e.clientX, startY:e.clientY,
                x:e.clientX, y:e.clientY };
            if (e.button === 1) e.preventDefault();
        });
        surface.addEventListener('pointermove', e => {
            if (!pointer || e.pointerId !== pointer.id) return;
            if (!this.dragging && Math.hypot(e.clientX-pointer.startX, e.clientY-pointer.startY) > 5) {
                this.dragging = true;
                surface.setPointerCapture(e.pointerId);
                this.viewport.classList.add('is-panning');
            }
            if (this.dragging) {
                this.pan(e.clientX-pointer.x, e.clientY-pointer.y);
            }
            pointer.x=e.clientX; pointer.y=e.clientY;
        });
        const finish = e => {
            if (!pointer || e.pointerId !== pointer.id) return;
            suppressClick = this.dragging || e.type === 'pointercancel';
            pointer = null;
            this.dragging = false;
            this.viewport.classList.remove('is-panning');
            if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId);
        };
        window.addEventListener('pointerup', finish);
        surface.addEventListener('pointercancel', finish);
        // Touch starts with implicit capture on the canvas. Its loss during
        // transfer to the shared surface must not cancel the active gesture.
        surface.addEventListener('lostpointercapture', e => {
            if (e.target === surface) finish(e);
        });
        surface.addEventListener('click', e => {
            if (!suppressClick) return;
            suppressClick = false;
            e.preventDefault(); e.stopImmediatePropagation();
        }, true);
        surface.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
        document.getElementById('map-zoom-in').addEventListener('click', () => this.zoomCenter(1.3));
        document.getElementById('map-zoom-out').addEventListener('click', () => this.zoomCenter(1/1.3));
        document.getElementById('map-reset').addEventListener('click', () => this.reset());
        this.viewport.addEventListener('keydown', e => {
            if (e.target !== this.viewport || e.ctrlKey || e.metaKey || e.altKey) return;
            const panKeys = { ArrowLeft:[60,0], ArrowRight:[-60,0], ArrowUp:[0,60], ArrowDown:[0,-60] };
            if (e.key === '+' || e.key === '=') this.zoomCenter(1.3);
            else if (e.key === '-') this.zoomCenter(1/1.3);
            else if (e.key === '0' || e.key === 'Home') this.reset();
            else if (panKeys[e.key]) this.pan(...panKeys[e.key]);
            else return;
            e.preventDefault();
        });
        let width = this.viewport.clientWidth, height = this.viewport.clientHeight;
        let pixelRatio = window.devicePixelRatio;
        const resize = () => {
            cancelAnimationFrame(this.resizeFrame);
            this.resizeFrame = requestAnimationFrame(() => {
                const nextWidth = this.viewport.clientWidth, nextHeight = this.viewport.clientHeight;
                if (!nextWidth || !nextHeight) return;
                if (width === nextWidth && height === nextHeight && pixelRatio === window.devicePixelRatio) return;
                if (width && height) { this.x *= nextWidth / width; this.y *= nextHeight / height; }
                width = nextWidth; height = nextHeight; pixelRatio = window.devicePixelRatio;
                this.apply();
                this.onSettle();
            });
        };
        this.resizeObserver = new ResizeObserver(resize);
        this.resizeObserver.observe(this.viewport);
        window.addEventListener('resize', resize);
        this.apply();
    },
    zoomAt(value, px, py) {
        const next = Math.max(1, Math.min(this.maxZoom, value));
        const ratio = next / this.zoom;
        this.x = px - (px-this.x)*ratio;
        this.y = py - (py-this.y)*ratio;
        this.zoom = next;
        this.apply();
        // Keep gestures on the compositor; sharpen the atlas after they settle.
        clearTimeout(this.settleTimer);
        this.settleTimer=setTimeout(() => this.onSettle(), 140);
    },
    zoomCenter(factor) {
        this.zoomAt(this.zoom*factor, this.viewport.clientWidth/2, this.viewport.clientHeight/2);
    },
    pan(dx, dy) { this.x+=dx; this.y+=dy; this.apply(); },
    reset() {
        this.x=0; this.y=0; this.zoom=1; this.apply();
        clearTimeout(this.settleTimer);
        this.onSettle();
    },
    apply() {
        planning.hidePreview();
        mapOrders.position();
        const w=this.viewport.clientWidth, h=this.viewport.clientHeight;
        this.x=Math.max(w*(1-this.zoom), Math.min(0,this.x));
        this.y=Math.max(h*(1-this.zoom), Math.min(0,this.y));
        this.world.style.transform=`translate(${this.x}px, ${this.y}px) scale(${this.zoom})`;
        document.getElementById('map-zoom-level').textContent=`${Math.round(this.zoom*100)}%`;
        document.getElementById('map-zoom-out').disabled=this.zoom <= 1;
        document.getElementById('map-zoom-in').disabled=this.zoom >= this.maxZoom;
    },
};
