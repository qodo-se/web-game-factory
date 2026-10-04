// Bundled geographic preset maps. Random maps keep their procedural renderer.
const atlas = {
    data: null, layout: null, geometry: null,
    async load(id, regions) {
        if (!id) return;
        const response = await fetch(`maps/${encodeURIComponent(id)}.json`);
        if (!response.ok) throw new Error('Could not load preset geography. Please reload.');
        const data = await response.json();
        if (regions && (data.regions.length !== Object.keys(regions).length ||
            data.regions.some(f => regions[f.id]?.name !== f.name))) {
            throw new Error('This preset has changed. Start a new campaign to use the updated map.');
        }
        this.terrainImage = null;
        if (data.terrain?.image) {
            const terrainImage = new Image();
            terrainImage.src = `maps/${data.terrain.image}`;
            await terrainImage.decode();
            this.terrainImage = terrainImage;
        }
        this.data = data;
    },
    prepare(regions) {
        const canvas = document.getElementById('map-canvas');
        const w = canvas.clientWidth || 800, h = canvas.clientHeight || 550;
        if (this.geometry?.w === w && this.geometry?.h === h) {
            // New server snapshots still need cached display coordinates.
            for (const marker of this.markers) {
                const r = regions[marker.id];
                r.x=(marker.x-this.layout.left)/this.layout.width;
                r.y=(marker.y-this.layout.top)/this.layout.height;
            }
            return;
        }
        const pad = 34;
        const width = Math.min(Math.max(1, w - pad*2), Math.max(1, h - pad*2) * this.data.aspect);
        const height = width / this.data.aspect;
        this.layout = { w, h, width, height, left: (w-width)/2, top: (h-height)/2 };
        // Separate neighboring city counters in dense areas; keep their geographic
        // anchors visible with short leader lines when a counter has to move.
        this.markers = this.data.regions.map(f => ({ id:f.id,
            x:this.x(f.center[0])*w, y:this.y(f.center[1])*h }));
        for (let pass=0; pass<24; pass++) {
            for (let i=0; i<this.markers.length; i++) {
                for (let j=i+1; j<this.markers.length; j++) {
                    const a=this.markers[i], b=this.markers[j];
                    const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
                    if (d >= 32) continue;
                    const ux=d ? dx/d : 1, uy=d ? dy/d : 0, push=(32-d)/2;
                    a.x-=ux*push; a.y-=uy*push; b.x+=ux*push; b.y+=uy*push;
                }
            }
        }
        this.data.regions.forEach((feature,i) => {
            const r = regions[feature.id], marker=this.markers[i];
            if (!r || r.name !== feature.name) throw new Error('Preset geography does not match this game.');
            r.x=(marker.x-this.layout.left)/width;
            r.y=(marker.y-this.layout.top)/height;
        });
        document.getElementById('map-svg').setAttribute('viewBox', `0 0 ${w} ${h}`);
        if (this.geometry?.w === w && this.geometry?.h === h) return;
        const hitCanvas = document.createElement('canvas');
        hitCanvas.width = w; hitCanvas.height = h;
        const hit = hitCanvas.getContext('2d', { willReadFrequently: true });
        const paths = this.data.regions.map((feature, index) => {
            const path = new Path2D();
            for (const polygon of feature.polygons) {
                for (const ring of polygon) {
                    ring.forEach(([x,y], i) => {
                        const px = this.x(x)*w, py = this.y(y)*h;
                        if (i === 0) path.moveTo(px,py); else path.lineTo(px,py);
                    });
                    path.closePath();
                }
            }
            hit.fillStyle = `rgb(${index+1},0,0)`;
            hit.fill(path, 'evenodd');
            return path;
        });
        const pixels = hit.getImageData(0, 0, w, h).data;
        const idxMap = new Int16Array(w*h).fill(-1);
        for (let i=0; i<idxMap.length; i++) {
            if (pixels[i*4+3] === 255) idxMap[i] = pixels[i*4]-1;
        }
        const rivers = new Path2D();
        for(const river of this.data.rivers||[]) {
            river.points.forEach(([x,y],i)=>{
                if(i===0)rivers.moveTo(this.x(x)*w,this.y(y)*h);else rivers.lineTo(this.x(x)*w,this.y(y)*h);
            });
        }
        const linePath = lines => {
            const result = new Path2D();
            for (const line of lines || []) line.forEach(([x,y],i) => {
                if (i === 0) result.moveTo(this.x(x)*w,this.y(y)*h);
                else result.lineTo(this.x(x)*w,this.y(y)*h);
            });
            return result;
        };
        const roads = linePath(this.data.roads), ridges = linePath(this.data.ridges);
        const relief=paths.map((path,index)=>{
            const marks=new Path2D();
            const feature=this.data.regions[index];
            const coords=feature.polygons.flatMap(p=>p[0]);
            const xs=coords.map(p=>this.x(p[0])*w),ys=coords.map(p=>this.y(p[1])*h);
            for(let y=Math.min(...ys)+9;y<Math.max(...ys);y+=18){
                for(let x=Math.min(...xs)+9;x<Math.max(...xs);x+=22){
                    if(!hit.isPointInPath(path,x,y,'evenodd'))continue;
                    const offset=Math.sin(x*17+y*3)*4;
                    marks.moveTo(x-6,y+3);marks.lineTo(x+offset,y-6);marks.lineTo(x+7,y+3);
                    marks.moveTo(x+offset,y-6);marks.lineTo(x+2,y+3);
                }
            }
            return marks;
        });
        const land = new Path2D(); paths.forEach(path => land.addPath(path));
        const svgPaths=this.data.regions.map(feature=>({id:feature.id,d:feature.polygons.map(p=>p.map(r=>r.map(([x,y],i)=>`${i?'L':'M'}${this.x(x)*w},${this.y(y)*h}`).join(' ')+'Z').join(' ')).join(' ')}));
        this.geometry = { w, h, paths, idxMap, rivers, roads, ridges, relief, land, svgPaths };
        this.baseKey = null;
    },
    x(x) { const l = this.layout; return (l.left+x*l.width)/l.w; },
    y(y) { const l = this.layout; return (l.top+y*l.height)/l.h; },
    hit(nx, ny) {
        const g = this.geometry;
        if (!g || nx < 0 || ny < 0 || nx >= 1 || ny >= 1) return -1;
        // Army counters are explicit targets, including counters on narrow coasts.
        let nearest = -1, distance = (14/mapCamera.zoom)**2;
        for (const feature of this.markers) {
            const dx = nx*g.w-feature.x;
            const dy = ny*g.h-feature.y;
            if (dx*dx+dy*dy < distance) { distance=dx*dx+dy*dy; nearest=feature.id; }
        }
        if (nearest !== -1) return nearest;
        const index = g.idxMap[Math.floor(ny*g.h)*g.w+Math.floor(nx*g.w)];
        return index < 0 ? -1 : this.data.regions[index].id;
    },
    render(regions, selected, targets, committed) {
        const canvas = document.getElementById('map-canvas');
        const { w, h, idxMap } = this.geometry;
        // Bound the terrain backing store, including on Retina/4K displays. Labels
        // and selection outlines stay vector-sharp independently of the bitmap.
        const resolution = Math.min(3, Math.max(1, Math.ceil(mapCamera.zoom * (window.devicePixelRatio || 1))), Math.sqrt(4000000/(w*h)));
        const pixelWidth=Math.round(w*resolution), pixelHeight=Math.round(h*resolution);
        if(canvas.width!==pixelWidth || canvas.height!==pixelHeight) {
            canvas.width=pixelWidth; canvas.height=pixelHeight;
        }
        const key=JSON.stringify([pixelWidth,pixelHeight,...this.data.regions.map(f=>[regions[f.id].owner,regions[f.id].terrain])]);
        if(this.baseKey!==key) {
            this.paintBase(canvas.getContext('2d'),regions,pixelWidth/w,pixelHeight/h);
            this.baseKey=key;
        }
        renderTerrainEffects(this.geometry.svgPaths,selected,targets,committed);
        return {idxMap,cw:w,ch:h};
    },
    paintBase(ctx, regions, scaleX, scaleY) {
        const {w,h,paths,land}=this.geometry;
        ctx.setTransform(scaleX,0,0,scaleY,0,0);
        const ocean = ctx.createLinearGradient(0,0,0,h);
        ocean.addColorStop(0, this.data.category==='historical' ? '#303930' : '#263e49'); ocean.addColorStop(1, this.data.category==='historical' ? '#202c2b' : '#1c303a');
        ctx.fillStyle = ocean; ctx.fillRect(0,0,w,h);
        // Fine graticule, spaced in geographic degrees.
        const [west,south,east,north] = this.data.bounds;
        ctx.strokeStyle = 'rgba(171,194,199,0.09)'; ctx.lineWidth = .6;
        ctx.beginPath();
        for (let lon=Math.ceil(west/5)*5; lon<east; lon+=5) {
            const x=this.x((lon-west)/(east-west))*w;
            ctx.moveTo(x,this.y(0)*h); ctx.lineTo(x,this.y(1)*h);
        }
        for (let lat=Math.ceil(south/5)*5; lat<north; lat+=5) {
            const y=this.y((north-lat)/(north-south))*h;
            ctx.moveTo(this.x(0)*w,y); ctx.lineTo(this.x(1)*w,y);
        }
        ctx.stroke();
        ctx.textAlign='center';ctx.fillStyle='rgba(173,198,208,.48)';ctx.font='italic 13px Georgia, serif';
        if (!this.terrainImage) for(const label of this.data.water_labels||[])ctx.fillText(label.name,this.x(label.center[0])*w,this.y(label.center[1])*h);
        if (this.terrainImage) {
            const l=this.layout;
            ctx.drawImage(this.terrainImage,l.left,l.top,l.width,l.height);
        }
        const terrain = { plains:'#b4b49a', city:'#bab8a0', coast:'#bfc0a5',
            forest:'#899b85', hills:'#a9a393', desert:'#c8ba98' };
        this.data.regions.forEach((feature,i) => {
            const r = regions[feature.id], path = paths[i];
            if (!this.terrainImage) {
                ctx.fillStyle = terrain[r.terrain] || terrain.plains;
                ctx.fill(path, 'evenodd');
            }
            if(r.terrain==='hills' && this.data.category !== 'historical') {
                ctx.save();ctx.clip(path,'evenodd');
                ctx.strokeStyle='rgba(72,64,49,.19)';ctx.lineWidth=.65;
                ctx.stroke(this.geometry.relief[i]);ctx.restore();
            }
            if (r.owner !== 'rogue') {
                ctx.fillStyle = r.owner === 'player_1' ? 'rgba(65,106,143,.36)' : 'rgba(160,83,68,.34)';
                ctx.globalAlpha = this.terrainImage ? .28 : 1;
                ctx.fill(path, 'evenodd');
                ctx.globalAlpha = 1;
            }
            ctx.strokeStyle = r.owner==='player_1'?'#577792':r.owner==='player_2'?'#98695c':'rgba(40,49,44,.48)';
            ctx.lineWidth = this.terrainImage ? .7 : r.owner==='rogue'?.55:1.5; ctx.globalAlpha=this.terrainImage?.65:1; ctx.stroke(path);ctx.globalAlpha=1;
        });
        if (this.data.category === 'historical' && !this.terrainImage) {
            ctx.save(); ctx.clip(land,'evenodd');
            ctx.lineJoin='round'; ctx.lineCap='round';
            // Broad ridge shading, not surveyed contour elevations.
            ctx.strokeStyle='rgba(45,45,29,.13)';ctx.lineWidth=16;ctx.stroke(this.geometry.ridges);
            ctx.strokeStyle='rgba(235,226,182,.22)';ctx.lineWidth=5;ctx.stroke(this.geometry.ridges);
            ctx.strokeStyle='rgba(230,216,174,.85)';ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.stroke(this.geometry.roads);
            ctx.restore();
        }
        ctx.save();ctx.clip(land,'evenodd');ctx.strokeStyle='rgba(70,124,151,.66)';ctx.lineWidth=1;
        if (!this.terrainImage) ctx.stroke(this.geometry.rivers);ctx.restore();
        ctx.strokeStyle='rgba(245,240,223,.65)'; ctx.lineWidth=.8;
        this.data.regions.forEach((feature,i) => {
            const x=this.x(feature.center[0])*w, y=this.y(feature.center[1])*h;
            const marker=this.markers[i];
            if (Math.hypot(marker.x-x,marker.y-y)<6) return;
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(marker.x,marker.y); ctx.stroke();
            ctx.fillStyle='#f5f0df'; ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill();
        });
        if (this.terrainImage) {
            ctx.textAlign='center';ctx.fillStyle='rgba(224,231,220,.85)';ctx.font='italic 13px Georgia, serif';
            for (const label of this.data.water_labels||[]) ctx.fillText(label.name,this.x(label.center[0])*w,this.y(label.center[1])*h);
        }
        if (this.data.terrain) {
            const l=this.layout, meters=this.data.terrain.width_m;
            const distance=meters>10000?2000:meters>4000?1000:500;
            const length=distance/meters*l.width;
            ctx.strokeStyle='#e5dfc5';ctx.lineWidth=2;ctx.beginPath();
            ctx.moveTo(l.left+10,l.top+l.height-14);ctx.lineTo(l.left+10+length,l.top+l.height-14);ctx.stroke();
            ctx.fillStyle='#e5dfc5';ctx.font='10px Arial';ctx.textAlign='left';
            ctx.fillText(distance>=1000?`${distance/1000} km`:`${distance} m`,l.left+10,l.top+l.height-20);
        }
        ctx.fillStyle = '#a6b7bb'; ctx.font='10px Georgia, serif';
        ctx.fillText('N ↑', 16, 24);
        ctx.font='10px Arial, sans-serif';
        ctx.textAlign='right';
        ctx.fillText((this.data.terrain ? `Contours ${this.data.terrain.contour_interval} m · Elevation & sources in map settings` : this.data.attribution) || 'Natural Earth · Historical territories approximated', w-16, h-12);
    },
};
