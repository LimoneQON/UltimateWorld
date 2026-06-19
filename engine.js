import { MAP_SIZE } from './data.js';

// Proceduralne Textury
const texCanvas = document.createElement('canvas');
texCanvas.width = 64 * 5; texCanvas.height = 64; // 5 tekstur obok siebie
const tCtx = texCanvas.getContext('2d');

function drawBrick(ctx, ox, color1, color2) {
    ctx.fillStyle = color1; ctx.fillRect(ox,0,64,64); ctx.fillStyle = color2;
    for(let i=0; i<64; i+=16) { ctx.fillRect(ox, i, 64, 2); for(let j=0; j<64; j+=16) ctx.fillRect(ox + j + (i%32===0?0:8), i, 2, 16); }
}
// 0: Human/Stone, 1: SafeZone/Moss, 2: Elf/Crystal, 3: Dwarf/Magma, 4: Flesh/Homunculus
drawBrick(tCtx, 0, '#444', '#222'); 
drawBrick(tCtx, 64, '#2a4', '#152');
drawBrick(tCtx, 128, '#135', '#0ff');
drawBrick(tCtx, 192, '#510', '#f50');
drawBrick(tCtx, 256, '#523', '#800');

export function render3D(ctx, map, entities, player, selectedWorld, isSafeZone) {
    const w = ctx.canvas.width; const h = ctx.canvas.height;
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h/2); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, h/2, w, h/2);

    let texOffset = 0;
    if(isSafeZone) texOffset = 64;
    else if(selectedWorld === 'elf') texOffset = 128;
    else if(selectedWorld === 'dwarf') texOffset = 192;
    else if(selectedWorld === 'homunculus') texOffset = 256;

    let zBuffer = new Array(w).fill(0);

    for(let x = 0; x < w; x++) {
        let cameraX = 2 * x / w - 1;
        let rayDirX = player.dirX + player.planeX * cameraX;
        let rayDirY = player.dirY + player.planeY * cameraX;

        let mapX = Math.floor(player.x); let mapY = Math.floor(player.y);
        let sideDistX, sideDistY;
        let deltaDistX = Math.abs(1 / rayDirX); let deltaDistY = Math.abs(1 / rayDirY);
        let perpWallDist; let stepX, stepY;
        let hit = 0, side = 0, hitType = 0;

        if(rayDirX < 0) { stepX = -1; sideDistX = (player.x - mapX) * deltaDistX; } else { stepX = 1; sideDistX = (mapX + 1.0 - player.x) * deltaDistX; }
        if(rayDirY < 0) { stepY = -1; sideDistY = (player.y - mapY) * deltaDistY; } else { stepY = 1; sideDistY = (mapY + 1.0 - player.y) * deltaDistY; }

        while(hit === 0) {
            if(sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; } else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
            if(map[mapY][mapX] > 0) { hit = 1; hitType = map[mapY][mapX]; }
        }

        if(side === 0) perpWallDist = (mapX - player.x + (1 - stepX) / 2) / rayDirX; else perpWallDist = (mapY - player.y + (1 - stepY) / 2) / rayDirY;

        zBuffer[x] = perpWallDist;
        let lineHeight = Math.floor(h / perpWallDist); let drawStart = -lineHeight / 2 + h / 2;
        
        let wallX; if(side === 0) wallX = player.y + perpWallDist * rayDirY; else wallX = player.x + perpWallDist * rayDirX;
        wallX -= Math.floor(wallX);
        let texX = Math.floor(wallX * 64);
        if(side === 0 && rayDirX > 0) texX = 64 - texX - 1; if(side === 1 && rayDirY < 0) texX = 64 - texX - 1;

        ctx.drawImage(texCanvas, texOffset + texX, 0, 1, 64, x, drawStart, 1, lineHeight);
        
        let shadow = (side === 1 ? 0.3 : 0.0) + Math.min(0.8, perpWallDist * 0.05);
        if(hitType === 3) ctx.fillStyle = `rgba(0, 255, 0, 0.4)`; else if(hitType === 4) ctx.fillStyle = `rgba(0, 255, 255, 0.4)`; else ctx.fillStyle = `rgba(0, 0, 0, ${shadow})`;
        ctx.fillRect(x, drawStart, 1, lineHeight);
    }

    let drawEntities = [...entities];

    drawEntities.sort((a,b) => ((player.x - b.x)**2 + (player.y - b.y)**2) - ((player.x - a.x)**2 + (player.y - a.y)**2)).forEach(e => {
        let spriteX = e.x - player.x; let spriteY = e.y - player.y;
        let invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
        let transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY);
        let transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY);

        if(transformY > 0.1) {
            let spriteScreenX = Math.floor((w / 2) * (1 + transformX / transformY));
            let spriteHeight = Math.abs(Math.floor(h / transformY));
            if(spriteScreenX > -spriteHeight/2 && spriteScreenX < w + spriteHeight/2 && transformY < zBuffer[spriteScreenX]) {
                ctx.font = `${spriteHeight * 0.8}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.shadowColor = e.isNPC ? 'rgba(0,255,255,0.8)' : (e.isEnemy ? 'rgba(255,0,0,0.5)' : 'rgba(0,0,0,0.8)'); ctx.shadowBlur = 10;
                ctx.fillText(e.sym, spriteScreenX, h/2); ctx.shadowBlur = 0; 
            }
        }
    });
}

export function drawMinimap(ctx, map, entities, player) {
    const W = ctx.canvas.width; const TS = W / MAP_SIZE;
    ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, W, W);
    for(let y=0; y<MAP_SIZE; y++) {
        for(let x=0; x<MAP_SIZE; x++) {
            if(map[y][x] === 0) ctx.fillStyle = '#334'; else if(map[y][x]===3) ctx.fillStyle='#0f0'; else if(map[y][x]===4) ctx.fillStyle='#0ff'; else continue;
            ctx.fillRect(x*TS, y*TS, TS+1, TS+1);
        }
    }
    entities.forEach(e => { ctx.fillStyle = e.isNPC ? '#0ff' : (e.isEnemy ? '#f33' : '#fc0'); ctx.fillRect(e.x*TS-1, e.y*TS-1, 4, 4); });

    ctx.fillStyle = '#5f5'; ctx.beginPath(); ctx.arc(player.x*TS, player.y*TS, 3, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(player.x*TS, player.y*TS); ctx.lineTo((player.x + player.dirX*2)*TS, (player.y + player.dirY*2)*TS); ctx.stroke();
}
