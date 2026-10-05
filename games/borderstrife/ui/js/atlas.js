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
        this.geometry = null;
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
        const pad = w<600?24:34;
        const topInset=w<600?96:62;
        const availableHeight=Math.max(1,h-topInset-28);
        const width = Math.min(Math.max(1,w-pad*2),availableHeight*this.data.aspect);
        const height = width / this.data.aspect;
        this.layout = {w,h,width,height,left:(w-width)/2,top:topInset+(availableHeight-height)/2};
        const markerGap=w<600?36:44;
        // Separate neighboring city counters in dense areas; keep their geographic
        // anchors visible with short leader lines when a counter has to move.
        const landmarkIds=new Set((this.data.annotations||[]).filter(a=>a.center&&['fort','gate','bridge','banner','farm','palace','camp','town'].includes(a.kind)).map(a=>a.name));
        this.markers = this.data.regions.map(f => ({ id:f.id,
            x:this.x(f.center[0])*w, y:this.y(f.center[1])*h+(this.data.presentation_version>=4&&landmarkIds.has(f.name)?16:0) }));
        for (let pass=0; pass<24; pass++) {
            for (let i=0; i<this.markers.length; i++) {
                for (let j=i+1; j<this.markers.length; j++) {
                    const a=this.markers[i], b=this.markers[j];
                    const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
                    if (d >= markerGap) continue;
                    const ux=d ? dx/d : 1, uy=d ? dy/d : 0, push=(markerGap-d)/2;
                    a.x-=ux*push; a.y-=uy*push; b.x+=ux*push; b.y+=uy*push;
                }
            }
            for(const m of this.markers){m.x=Math.max(24,Math.min(w-24,m.x));m.y=Math.max(topInset+20,Math.min(h-40,m.y));}
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
        const contextLand=new Path2D();
        for(const polygon of this.data.context_land||[])for(const ring of polygon){
            ring.forEach(([x,y],i)=>i?contextLand.lineTo(this.x(x)*w,this.y(y)*h):contextLand.moveTo(this.x(x)*w,this.y(y)*h));contextLand.closePath();
        }
        if(this.data.context_land?.length){
            hit.clearRect(0,0,w,h);hit.fillStyle='#fff';hit.fill(contextLand,'evenodd');
            const contextPixels=hit.getImageData(0,0,w,h).data;
            // Negative IDs stay non-interactive; -2 also excludes decorative waves.
            for(let i=0;i<idxMap.length;i++)if(idxMap[i]===-1&&contextPixels[i*4+3]>0)idxMap[i]=-2;
        }
        const svgPaths=this.data.regions.map(feature=>({id:feature.id,d:feature.polygons.map(p=>p.map(r=>r.map(([x,y],i)=>`${i?'L':'M'}${this.x(x)*w},${this.y(y)*h}`).join(' ')+'Z').join(' ')).join(' ')}));
        this.geometry = { w, h, paths, idxMap, rivers, roads, ridges, relief, land, contextLand, svgPaths };
        this.baseKey = null;
    },
    x(x) { const l = this.layout; return (l.left+x*l.width)/l.w; },
    y(y) { const l = this.layout; return (l.top+y*l.height)/l.h; },
    hit(nx, ny) {
        const g = this.geometry;
        if (!g || nx < 0 || ny < 0 || nx >= 1 || ny >= 1) return -1;
        // Army counters are explicit targets, including counters on narrow coasts.
        let nearest = -1, distance = Math.max(18,22/mapCamera.zoom)**2;
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
        const key=JSON.stringify([pixelWidth,pixelHeight,interfaceView.factionShapes,interfaceView.darkMap,...this.data.regions.map(f=>[regions[f.id].owner,regions[f.id].terrain])]);
        if(this.baseKey!==key) {
            this.paintBase(canvas.getContext('2d'),regions,pixelWidth/w,pixelHeight/h);
            this.baseKey=key;
        }
        renderTerrainEffects(this.geometry.svgPaths,selected,targets,committed);
        return {idxMap,cw:w,ch:h};
    },
    paintAnnotations(ctx) {
        if(this.data.presentation_version>=4){cartography.landmarks(ctx,this);return;}
        const {w,h,land}=this.geometry;
        const dark=interfaceView.darkMap;
        const ink=dark?'#b7b19b':'#625b45',light=dark?'#a6aa94':'#e1d7b7';
        const project=p=>[this.x(p[0])*w,this.y(p[1])*h];
        ctx.save();ctx.clip(land,'evenodd');ctx.lineCap='round';ctx.lineJoin='round';
        for(const item of this.data.annotations||[]) {
            const points=(item.points||[]).map(project);
            ctx.setLineDash([]);ctx.globalAlpha=.85;
            if(points.length>1) {
                ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
                if(item.kind==='ridge') {
                    ctx.strokeStyle=dark?'rgba(8,12,13,.35)':'rgba(63,55,37,.15)';ctx.lineWidth=14;ctx.stroke();
                    ctx.strokeStyle=ink;ctx.lineWidth=.8;
                    for(let i=1;i<points.length;i++) {
                        const [x,y]=points[i-1],[tx,ty]=points[i];const length=Math.hypot(tx-x,ty-y);
                        for(let d=5;d<length;d+=12) {
                            const px=x+(tx-x)*d/length,py=y+(ty-y)*d/length;
                            const height=5+2*Math.sin(d*.4+i);
                            ctx.beginPath();ctx.moveTo(px-5,py+3);ctx.lineTo(px,py-height);ctx.lineTo(px+6,py+3);ctx.stroke();
                            ctx.strokeStyle=light;ctx.beginPath();ctx.moveTo(px,py-height);ctx.lineTo(px+2,py+2);ctx.stroke();ctx.strokeStyle=ink;
                        }
                    }
                } else {
                    const wall=item.kind==='wall',wagons=item.kind==='wagons';
                    ctx.strokeStyle=wall?'#554936':item.kind==='hedge'?'#40513a':ink;
                    ctx.lineWidth=wall?5:wagons?3:2;
                    ctx.setLineDash(item.kind==='front'?[6,5]:item.kind==='trail'?[3,4]:[]);ctx.stroke();
                    if(wall){ctx.lineWidth=2;ctx.strokeStyle=light;ctx.stroke();}
                    if(wall||wagons)for(let i=1;i<points.length;i++) {
                        const [x,y]=points[i-1],[tx,ty]=points[i];const length=Math.hypot(tx-x,ty-y);
                        for(let d=0;d<length;d+=wall?17:12) {const px=x+(tx-x)*d/length,py=y+(ty-y)*d/length;ctx.fillStyle=light;ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.fillRect(px-3,py-3,6,6);ctx.strokeRect(px-3,py-3,6,6);}
                    }
                }
            }
            if(!item.center)continue;
            let [x,y]=project(item.center);y-=25;
            ctx.setLineDash([]);ctx.strokeStyle=ink;ctx.fillStyle=light;ctx.lineWidth=1.5;
            if(item.kind==='banner') {
                ctx.beginPath();ctx.moveTo(x-10,y+6);ctx.lineTo(x-10,y-14);ctx.stroke();
                ctx.fillStyle='#ae694a';ctx.beginPath();ctx.moveTo(x-10,y-14);ctx.lineTo(x+9,y-11);ctx.lineTo(x-10,y-5);ctx.closePath();ctx.fill();ctx.stroke();
            } else if(item.kind==='ships'||item.kind==='port') {
                ctx.beginPath();ctx.moveTo(x-12,y);ctx.quadraticCurveTo(x,y+14,x+12,y);ctx.closePath();ctx.fill();ctx.stroke();
                ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x,y-16);ctx.lineTo(x+9,y-3);ctx.closePath();ctx.fill();ctx.stroke();
            } else if(item.kind==='bridge') {
                // Bridge location stays at the anchor; offset artwork avoids the counter.
                ctx.strokeStyle=light;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x-12,y+3);ctx.lineTo(x+12,y-3);ctx.stroke();
                ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-13,y);ctx.lineTo(x+11,y-6);ctx.moveTo(x-11,y+6);ctx.lineTo(x+13,y);ctx.stroke();
            } else if(item.kind==='spring') {
                ctx.strokeStyle='#85c9d8';ctx.beginPath();ctx.ellipse(x,y,9,5,0,0,Math.PI*2);ctx.stroke();
            } else if(item.kind==='grove') {
                ctx.fillStyle='#446048';for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(x-12+i*6,y+7);ctx.lineTo(x-9+i*6,y-8-i%2*5);ctx.lineTo(x-6+i*6,y+7);ctx.closePath();ctx.fill();ctx.stroke();}
            } else if(item.kind==='volcano'||item.kind==='peaks') {
                ctx.fillStyle=item.kind==='volcano'?'#4f4140':ink;ctx.beginPath();ctx.moveTo(x-18,y+14);ctx.lineTo(x-4,y-11);ctx.lineTo(x+4,y-9);ctx.lineTo(x+19,y+14);ctx.closePath();ctx.fill();ctx.stroke();
                if(item.kind==='volcano'){ctx.strokeStyle='#d88655';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-4,y-11);ctx.lineTo(x+3,y-7);ctx.lineTo(x+7,y+4);ctx.stroke();}
            } else {
                const fort=item.kind==='fort'||item.kind==='gate';
                ctx.fillRect(x-11,y-8,22,16);ctx.strokeRect(x-11,y-8,22,16);
                ctx.fillStyle=ink;
                if(fort)for(const dx of [-11,7])for(const dy of [-8,4])ctx.fillRect(x+dx,y+dy,5,5);
                else {ctx.beginPath();ctx.moveTo(x-14,y-7);ctx.lineTo(x,y-16);ctx.lineTo(x+14,y-7);ctx.closePath();ctx.fill();}
            }
        }
        ctx.restore();
    },
    paintBase(ctx, regions, scaleX, scaleY) {
        const {w,h,paths,land}=this.geometry;
        const dark=interfaceView.darkMap;
        ctx.setTransform(scaleX,0,0,scaleY,0,0);
        const ocean = ctx.createLinearGradient(0,0,0,h);
        ocean.addColorStop(0,dark?'#14252e':this.data.category==='historical'?'#303930':'#263e49'); ocean.addColorStop(1,dark?'#0c1921':this.data.category==='historical'?'#202c2b':'#1c303a');
        ctx.fillStyle = ocean; ctx.fillRect(0,0,w,h);
        if(this.data.inland_frame){ctx.fillStyle=dark?'#202c27':'#485244';ctx.fillRect(0,0,w,h);}
        if(this.data.presentation_version>=4)cartography.context(ctx,this);
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
            ctx.save();
            ctx.drawImage(this.terrainImage,l.left,l.top,l.width,l.height);
            if(dark) {
                if(this.data.presentation_version>=4)ctx.clip(land,'evenodd');
                ctx.fillStyle='rgba(8,18,24,.56)';ctx.fillRect(l.left,l.top,l.width,l.height);
            }
            ctx.restore();
        }
        const factionPatterns={};
        const terrain = dark ? {plains:'#35443f',city:'#414b48',coast:'#3c504e',forest:'#283e35',hills:'#45453e',desert:'#504b3c'} : { plains:'#b4b49a', city:'#bab8a0', coast:'#bfc0a5',
            forest:'#899b85', hills:'#a9a393', desert:'#c8ba98' };
        this.data.regions.forEach((feature,i) => {
            const r = regions[feature.id], path = paths[i];
            if (!this.terrainImage) {
                ctx.fillStyle = terrain[r.terrain] || terrain.plains;
                ctx.fill(path, 'evenodd');
            }
            if(r.terrain==='hills' && this.data.category !== 'historical' && !this.terrainImage && !this.data.presentation_version) {
                ctx.save();ctx.clip(path,'evenodd');
                ctx.strokeStyle=dark?'rgba(198,200,174,.18)':'rgba(72,64,49,.19)';ctx.lineWidth=.65;
                ctx.stroke(this.geometry.relief[i]);ctx.restore();
            }
            if (r.owner !== 'rogue') {
                // A single alpha keeps ownership visible over terrain imagery.
                ctx.fillStyle = r.owner === 'player_1'
                    ? (dark?'rgba(47,139,224,.55)':'rgba(35,121,218,.55)')
                    : (dark?'rgba(231,111,70,.55)':'rgba(217,86,48,.55)');
                ctx.fill(path, 'evenodd');
                ctx.globalAlpha = 1;
            }
            if(interfaceView.factionShapes) {
                if(!factionPatterns[r.owner]) {
                const tile=document.createElement('canvas');tile.width=tile.height=12;
                const ink=tile.getContext('2d');ink.strokeStyle=dark?'rgba(216,223,212,.22)':'rgba(20,32,35,.23)';ink.fillStyle=dark?'rgba(216,223,212,.25)':'rgba(20,32,35,.25)';ink.lineWidth=1;
                if(r.owner==='rogue') {ink.beginPath();ink.arc(6,6,1,0,Math.PI*2);ink.fill();}
                else {ink.beginPath();if(r.owner==='player_1'){ink.moveTo(0,12);ink.lineTo(12,0);}else{ink.moveTo(0,6);ink.lineTo(12,6);}ink.stroke();}
                factionPatterns[r.owner]=ctx.createPattern(tile,'repeat');
                }
                ctx.fillStyle=factionPatterns[r.owner];ctx.fill(path,'evenodd');
            }
            ctx.strokeStyle = r.owner==='player_1'?(dark?'#7fa4bd':'#577792'):r.owner==='player_2'?(dark?'#c38e7c':'#98695c'):(dark?'rgba(191,206,191,.48)':'rgba(40,49,44,.48)');
            ctx.lineWidth = this.terrainImage ? .85 : r.owner==='rogue'?.7:1.4; ctx.globalAlpha=this.terrainImage?.68:1; ctx.stroke(path);ctx.globalAlpha=1;
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
        if(this.data.presentation_version>=4)cartography.terrain(ctx,this,regions);
        ctx.save();ctx.clip(land,'evenodd');ctx.strokeStyle=dark?'rgba(115,174,184,.8)':'rgba(63,115,137,.85)';ctx.lineWidth=1.5;
        if (!this.terrainImage) ctx.stroke(this.geometry.rivers);ctx.restore();
        // Inset borders give both factions their own edge on a shared frontier.
        this.data.regions.forEach((feature,i)=>{
            const owner=regions[feature.id].owner;
            if(owner==='rogue')return;
            ctx.save();ctx.clip(paths[i],'evenodd');
            ctx.lineJoin='round';ctx.strokeStyle=dark?'#10202b':'#26323c';
            ctx.lineWidth=6;ctx.stroke(paths[i]);
            ctx.strokeStyle=owner==='player_1'?'#7bc7ff':'#ffb089';
            ctx.lineWidth=3.5;ctx.stroke(paths[i]);ctx.restore();
        });
        this.paintAnnotations(ctx);
        if(this.data.context_land?.length){
            ctx.save();ctx.strokeStyle=dark?'rgba(211,202,159,.6)':'rgba(66,66,46,.55)';ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.stroke(land);ctx.restore();
        }
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
        if (this.data.terrain && !this.data.terrain.illustrated) {
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
        ctx.fillText((this.data.terrain && !this.data.terrain.illustrated ? `Contours ${this.data.terrain.contour_interval} m · Elevation & sources in map settings` : this.data.attribution) || 'Natural Earth · Historical territories approximated', w-16, h-12);
    },
};
