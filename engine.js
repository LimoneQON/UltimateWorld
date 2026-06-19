import { MAP_SIZE, TILE_SIZE, T_WALL, T_FLOOR, T_EXIT, T_PORTAL } from './data.js';

export function createBlock(x, z, cls, html, container) {
    const faces = [ { rx: 0, ry: 0, tz: TILE_SIZE/2 }, { rx: 0, ry: 180, tz: TILE_SIZE/2 }, { rx: 0, ry: 90, tz: TILE_SIZE/2 }, { rx: 0, ry: -90, tz: TILE_SIZE/2 } ];
    faces.forEach(f => {
        let face = document.createElement('div'); face.className = cls; if(html) face.innerHTML = html;
        face.style.transform = `translate3d(${x*TILE_SIZE}px, 0, ${z*TILE_SIZE}px) rotateY(${f.ry}deg) translateZ(${f.tz}px)`;
        container.appendChild(face);
    });
}

export function buildCSS3D(map, entities, player) {
    let worldContent = document.getElementById('world-content'); 
    worldContent.innerHTML = ''; // Czyścimy tylko ściany! Podłoga jest w nadrzędnym DIVie!

    // Render Distance (Culling) - generuje tylko blisko gracza
    const RD = 5;
    for(let z = Math.max(0, Math.floor(player.z) - RD); z <= Math.min(MAP_SIZE-1, Math.floor(player.z) + RD); z++) {
        for(let x = Math.max(0, Math.floor(player.x) - RD); x <= Math.min(MAP_SIZE-1, Math.floor(player.x) + RD); x++) {
            let t = map[z][x];
            if(t !== T_FLOOR) {
                let cls = `wall tex-human`; let html = "";
                if(t === T_PORTAL) { cls += ' tex-portal'; html = "<div class='wall-text'>PORTAL</div>"; }
                if(t === T_EXIT) { cls += ' tex-exit'; html = "<div class='wall-text'>WYJŚCIE</div>"; }
                createBlock(x, z, cls, html, worldContent);
            }
        }
    }

    entities.forEach((e, idx) => {
        if(Math.abs(e.x - player.x) <= RD && Math.abs(e.z - player.z) <= RD) {
            let s = document.createElement('div'); s.className = 'sprite'; s.innerHTML = e.sym; s.id = `ent_${idx}`;
            s.style.transform = `translate3d(${e.x*TILE_SIZE}px, 0, ${e.z*TILE_SIZE}px) rotateY(${-player.rot}deg)`;
            worldContent.appendChild(s);
        }
    });

    updateCamera(player);
}

export function updateCamera(player) {
    let px = player.x * TILE_SIZE; let pz = player.z * TILE_SIZE;
    document.getElementById('camera').style.transform = `translateZ(100px) rotateY(${-player.rot}deg)`;
    document.getElementById('world').style.transform = `translate3d(${-px}px, 0, ${-pz}px)`;
    
    document.querySelectorAll('.sprite').forEach(s => {
        let coords = s.style.transform.match(/translate3d\((.*?)px, 0px, (.*?)px\)/);
        if(coords) s.style.transform = `translate3d(${coords[1]}px, 0, ${coords[2]}px) rotateY(${player.rot}deg)`;
    });
}

export function drawMinimap(map, entities, player) {
    const canvas = document.getElementById('minimap'); if(!canvas) return;
    const mCtx = canvas.getContext('2d'); const TS = canvas.width / MAP_SIZE;
    
    mCtx.fillStyle = '#0a0a0f'; mCtx.fillRect(0, 0, canvas.width, canvas.height);
    for(let z=0; z<MAP_SIZE; z++) {
        for(let x=0; x<MAP_SIZE; x++) {
            if(map[z][x] === T_FLOOR) mCtx.fillStyle = '#334'; else if(map[z][x]===T_EXIT) mCtx.fillStyle='#aaa'; else if(map[z][x]===T_PORTAL) mCtx.fillStyle='#0ff'; else continue;
            mCtx.fillRect(x*TS, z*TS, TS+1, TS+1);
        }
    }
    entities.forEach(e => { mCtx.fillStyle = e.isEnemy ? '#f33' : '#fc0'; mCtx.fillRect(e.x*TS-1, e.z*TS-1, 4, 4); });
    
    mCtx.save(); mCtx.translate(player.x * TS + TS/2, player.z * TS + TS/2); mCtx.rotate(player.dir * Math.PI/2); 
    mCtx.fillStyle = '#5f5'; mCtx.beginPath(); mCtx.moveTo(0, -TS/2); mCtx.lineTo(TS/2, TS/2); mCtx.lineTo(-TS/2, TS/2); mCtx.fill(); mCtx.restore();
}
