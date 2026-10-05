// Cached, illustrative cartography. None of these shapes participate in game rules.
const cartography = {
    point(a,p) { return [a.x(p[0])*a.geometry.w,a.y(p[1])*a.geometry.h]; },
    random(seed) { return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}; },
    curve(ctx,points) {
        if(!points.length)return;
        ctx.beginPath();ctx.moveTo(...points[0]);
        for(let i=1;i<points.length-1;i++)ctx.quadraticCurveTo(...points[i],(points[i][0]+points[i+1][0])/2,(points[i][1]+points[i+1][1])/2);
        if(points.length>1)ctx.lineTo(...points[points.length-1]);
    },
    context(ctx,a) {
        if(!a.geometry.contextLand)return;
        ctx.save();ctx.fillStyle=interfaceView.darkMap?'#29332f':'#788171';
        ctx.fill(a.geometry.contextLand,'evenodd');
        ctx.strokeStyle=interfaceView.darkMap?'#4a5d56':'#9ca792';ctx.lineWidth=.8;ctx.stroke(a.geometry.contextLand);
        ctx.restore();
    },
    vegetation(ctx,x,y,radius,seed,forest=true) {
        const rng=this.random(seed),dark=interfaceView.darkMap;
        for(let i=0;i<(forest?48:18);i++) {
            const angle=rng()*Math.PI*2,r=Math.sqrt(rng())*radius;
            const px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r*.7,size=2+rng()*3;
            ctx.fillStyle=dark?'rgba(12,36,24,.36)':'rgba(50,82,47,.28)';
            ctx.beginPath();ctx.ellipse(px+1,py+2,size+1,size*.7,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=dark?'rgba(104,135,89,.38)':'rgba(93,122,68,.47)';
            ctx.beginPath();ctx.ellipse(px,py-1,size*.8,size,0,0,Math.PI*2);ctx.fill();
        }
    },
    terrain(ctx,a,regions) {
        const dark=interfaceView.darkMap,key=a.data.id.replace(/_atlas_v\d+$/,'');
        ctx.save();ctx.clip(a.geometry.land,'evenodd');
        if(!a.terrainImage) {
            // Terrain patches have soft visual transitions; ownership remains separate.
            a.data.regions.forEach((r,i)=>{
                const type=regions[r.id].terrain,[x,y]=this.point(a,r.center);
                ctx.save();ctx.clip(a.geometry.paths[i],'evenodd');
                if(type==='forest')this.vegetation(ctx,x,y,Math.min(80,a.layout.width*.065),i+118);
                if(type==='plains') {
                    const gradient=ctx.createRadialGradient(x,y,0,x,y,Math.max(20,a.layout.width*.10));
                    gradient.addColorStop(0,dark?'rgba(104,125,65,.10)':'rgba(214,208,143,.24)');gradient.addColorStop(1,'transparent');
                    ctx.fillStyle=gradient;ctx.fill(a.geometry.paths[i],'evenodd');
                }
                ctx.restore();
            });
        }
        if(key==='constantinople') {
            // A compact urban fabric inside the peninsula, not rectangular farm fields.
            const names=['Hagia Sophia quarter','Hippodrome','Acropolis','Central cistern','Forum','Studion','Golden Gate','Northern quarter','Blachernae'];
            for(const r of a.data.regions.filter(r=>names.some(n=>r.name.toLowerCase().includes(n.toLowerCase())))) {
                const [x,y]=this.point(a,r.center),rng=this.random(r.id+801);
                ctx.save();ctx.clip(a.geometry.paths[r.id],'evenodd');
                for(let i=0;i<85;i++) {
                    const px=x+(rng()-.5)*115,py=y+(rng()-.5)*100,w=3+rng()*8,h=3+rng()*6;
                    ctx.fillStyle=dark?'rgba(156,139,104,.32)':'rgba(128,104,77,.32)';ctx.fillRect(px+1,py+2,w,h);
                    ctx.fillStyle=dark?'rgba(187,164,119,.32)':'rgba(216,191,143,.72)';ctx.fillRect(px,py,w,h);
                }
                ctx.restore();
            }
        }
        if(key==='epic_lanka') {
            for(const r of a.data.regions.filter(r=>/forest|grove|highland/i.test(r.name))){const [x,y]=this.point(a,r.center);this.vegetation(ctx,x,y,40,r.id+777);}
        }
        ctx.restore();
    },
    ridge(ctx,points) {
        const dark=interfaceView.darkMap;
        this.curve(ctx,points);ctx.strokeStyle=dark?'rgba(7,16,13,.20)':'rgba(68,65,43,.09)';ctx.lineWidth=19;ctx.stroke();
        ctx.strokeStyle=dark?'rgba(190,183,140,.23)':'rgba(235,224,170,.42)';ctx.lineWidth=1.5;ctx.stroke();
        for(let i=1;i<points.length;i++) {
            const [x,y]=points[i-1],[tx,ty]=points[i],length=Math.hypot(tx-x,ty-y);
            if(length<1)continue;
            const nx=-(ty-y)/length,ny=(tx-x)/length;
            for(let d=7;d<length;d+=10) {
                const px=x+(tx-x)*d/length,py=y+(ty-y)*d/length,reach=8+7*(.5+.5*Math.sin(d*.23+i));
                for(const side of [-1,1]){
                    const offset=side>0?3:-2;
                    ctx.beginPath();ctx.moveTo(px+offset,py-2);
                    ctx.quadraticCurveTo(px+nx*reach*side*.3-2,py+ny*reach*side*.3-2,px+nx*reach*side,py+ny*reach*side);
                    ctx.strokeStyle=dark?'rgba(198,190,147,.32)':'rgba(86,79,55,.32)';ctx.lineWidth=.7;ctx.stroke();
                }
            }
        }
    },
    fort(ctx,x,y,scale,star=false) {
        const dark=interfaceView.darkMap;
        ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
        ctx.shadowColor='rgba(10,18,12,.3)';ctx.shadowBlur=3;ctx.shadowOffsetY=2;
        const points=star?Array.from({length:10},(_,i)=>{const t=i*Math.PI/5;return [Math.cos(t)*(i%2?14:25),Math.sin(t)*(i%2?14:25)];}):[[-23,-15],[18,-19],[25,12],[-17,21]];
        ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
        ctx.fillStyle=dark?'#74715b':'#c7b58a';ctx.strokeStyle=dark?'#d2c39a':'#5e563e';ctx.lineWidth=3;ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
        for(const [px,py] of points.filter((_,i)=>!star||i%2===0)){ctx.fillStyle=dark?'#c0af86':'#ece0b9';ctx.fillRect(px-3,py-3,6,6);ctx.strokeRect(px-3,py-3,6,6);}
        ctx.fillStyle=dark?'#b7a177':'#9e8262';ctx.fillRect(-8,-7,14,13);ctx.strokeRect(-8,-7,14,13);
        ctx.restore();
    },
    camp(ctx,x,y,epic) {
        const dark=interfaceView.darkMap;
        for(let row=0;row<2;row++)for(let col=0;col<3;col++) {
            const px=x+(col-1)*13,py=y+row*12;
            ctx.beginPath();ctx.moveTo(px-6,py+4);ctx.lineTo(px,py-6);ctx.lineTo(px+7,py+4);ctx.closePath();
            ctx.fillStyle=dark?'#b4a47c':'#e2d1a2';ctx.strokeStyle='#65563e';ctx.lineWidth=1;ctx.fill();ctx.stroke();
            ctx.beginPath();ctx.moveTo(px,py-5);ctx.lineTo(px,py+4);ctx.stroke();
        }
        ctx.strokeStyle=dark?'#d7c38e':'#604d32';ctx.beginPath();ctx.moveTo(x-25,y+11);ctx.lineTo(x-25,y-20);ctx.stroke();
        ctx.fillStyle=epic?'#c37c3e':'#a85140';ctx.beginPath();ctx.moveTo(x-25,y-20);ctx.lineTo(x-8,y-16);ctx.lineTo(x-25,y-10);ctx.closePath();ctx.fill();
    },
    landmarks(ctx,a) {
        const dark=interfaceView.darkMap,key=a.data.id.replace(/_atlas_v\d+$/,'');
        const ink=dark?'#c3b791':'#65553b',light=dark?'#ada381':'#e4d5ab';
        ctx.save();ctx.clip(a.geometry.land,'evenodd');ctx.lineCap='round';ctx.lineJoin='round';
        for(const item of a.data.annotations||[]) {
            const points=(item.points||[]).map(p=>this.point(a,p));
            ctx.setLineDash([]);
            if(points.length>1) {
                if(item.kind==='ridge'){this.ridge(ctx,points);continue;}
                this.curve(ctx,points);
                const wall=item.kind==='wall',wagons=item.kind==='wagons';
                ctx.strokeStyle=wall?'rgba(41,36,25,.45)':ink;ctx.lineWidth=wall?9:wagons?7:1.8;
                ctx.setLineDash(item.kind==='front'?[10,6]:item.kind==='trail'?[3,5]:[]);ctx.stroke();
                if(wall||wagons){ctx.strokeStyle=light;ctx.lineWidth=wall?4:3;ctx.stroke();}
                if(item.kind==='hedge'){ctx.strokeStyle=dark?'#789563':'#577249';ctx.lineWidth=5;ctx.stroke();}
                if(wall||wagons)for(let i=1;i<points.length;i++) {
                    const [x,y]=points[i-1],[tx,ty]=points[i],length=Math.hypot(tx-x,ty-y);
                    for(let d=0;d<length;d+=wall?23:18) {
                        const px=x+(tx-x)*d/length,py=y+(ty-y)*d/length;
                        ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(ty-y,tx-x));
                        ctx.fillStyle=light;ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.fillRect(-4,-4,8,8);ctx.strokeRect(-4,-4,8,8);
                        if(wagons){ctx.fillStyle=ink;ctx.fillRect(-3,-6,2,3);ctx.fillRect(2,3,2,3);}
                        ctx.restore();
                    }
                }
            }
            if(!item.center)continue;
            let [x,y]=this.point(a,item.center);
            // Counter positions are displaced independently; anchors stay geographic.
            const isBridge=item.kind==='bridge';
            if(!isBridge)y-=34;
            ctx.setLineDash([]);ctx.strokeStyle=ink;ctx.fillStyle=light;ctx.lineWidth=1.4;
            if(item.kind==='fort'||item.kind==='gate')this.fort(ctx,x,y,item.kind==='gate'?.60:1,key==='malta');
            else if(item.kind==='banner'||item.kind==='camp')this.camp(ctx,x,y,a.data.category==='legends');
            else if(item.kind==='palace') {
                this.fort(ctx,x,y,1.25);
                ctx.fillStyle=key==='epic_lanka'?'#b47742':light;
                ctx.beginPath();ctx.ellipse(x,y-12,13,14,0,Math.PI,Math.PI*2);ctx.fill();ctx.stroke();
                ctx.beginPath();ctx.moveTo(x,y-26);ctx.lineTo(x,y-35);ctx.stroke();
            } else if(item.kind==='chariot') {
                ctx.fillStyle=light;ctx.fillRect(x-12,y-10,24,12);ctx.strokeRect(x-12,y-10,24,12);
                for(const dx of [-12,12]){ctx.beginPath();ctx.arc(x+dx,y+4,7,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+dx-7,y+4);ctx.lineTo(x+dx+7,y+4);ctx.moveTo(x+dx,y-3);ctx.lineTo(x+dx,y+11);ctx.stroke();}
            }
            else if(item.kind==='ships'||item.kind==='port') {
                for(let i=-1;i<=1;i++) {
                    const px=x+i*18,py=y+Math.abs(i)*6;
                    ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(px-9,py);ctx.quadraticCurveTo(px,py+10,px+9,py);ctx.closePath();ctx.fill();
                    ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,py-19);ctx.lineTo(px+9,py-4);ctx.closePath();ctx.fill();ctx.stroke();
                }
            } else if(isBridge) {
                ctx.strokeStyle=ink;ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x-14,y+4);ctx.lineTo(x+14,y-4);ctx.stroke();
                ctx.strokeStyle=light;ctx.lineWidth=5;ctx.stroke();
            } else if(item.kind==='grove')this.vegetation(ctx,x,y,24,53);
            else if(item.kind==='spring'){ctx.strokeStyle='#95d6dc';ctx.beginPath();ctx.ellipse(x,y,12,6,0,0,Math.PI*2);ctx.stroke();}
            else if(item.kind==='volcano'||item.kind==='peaks') {
                ctx.beginPath();ctx.moveTo(x-29,y+21);ctx.lineTo(x-7,y-19);ctx.lineTo(x+5,y-18);ctx.lineTo(x+30,y+21);ctx.closePath();ctx.fillStyle=dark?'#746956':'#877454';ctx.fill();ctx.stroke();
                ctx.beginPath();ctx.moveTo(x-7,y-19);ctx.lineTo(x-3,y+17);ctx.lineTo(x-29,y+21);ctx.closePath();ctx.fillStyle=dark?'#aca180':'#cebf92';ctx.fill();
                if(item.kind==='volcano'){ctx.strokeStyle='#df914c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-6,y-19);ctx.lineTo(x+4,y-16);ctx.lineTo(x+12,y+7);ctx.stroke();}
            } else {
                for(const [dx,dy] of [[-10,0],[9,4],[0,-11]]) {
                    ctx.fillStyle=light;ctx.fillRect(x+dx-5,y+dy-3,11,8);ctx.strokeRect(x+dx-5,y+dy-3,11,8);
                    ctx.fillStyle=key==='epic_lanka'?'#b17852':'#8e6c4e';ctx.beginPath();ctx.moveTo(x+dx-7,y+dy-3);ctx.lineTo(x+dx,y+dy-10);ctx.lineTo(x+dx+7,y+dy-3);ctx.closePath();ctx.fill();
                }
            }
        }
        ctx.restore();
    },
};
