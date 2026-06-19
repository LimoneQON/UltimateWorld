import { ITEM_DB, WEAPONS, ARMORS, BELTS, RECIPES, MOBS, HEROES, NPC_POOL, MAP_SIZE, INV_SIZE } from './data.js';
import { render3D, drawMinimap } from './engine.js';

let map = [], entities = [], logs = [];
let state = 'MENU', difficulty = 1;
let currentLevel = 1, currentEnemy = null;
let keys = {w:false, a:false, s:false, d:false};

let player = {
    x: 1.5, y: 1.5, angle: 0, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66, 
    hp: 100, maxHp: 100, coins: 0, baseDmg: 5, baseArmor: 0, name: "", cls: "",
    weapon: WEAPONS[0], armor: ARMORS[0], belt: BELTS[0], inventory: new Array(INV_SIZE).fill(null), selectedSlot: 0
};

const gameCanvas = document.getElementById('gameCanvas'); const ctx = gameCanvas.getContext('2d');
const miniCanvas = document.getElementById('minimap'); const mCtx = miniCanvas.getContext('2d');

let peer = null, conn = null, isMultiplayer = false, isHost = false, otherPlayer = {x:0, y:0};

window.logMsg = function(msg, type='log-new') { logs.unshift(`<span class="${type}">• ${msg}</span><br>`); if(logs.length > 7) logs.pop(); document.getElementById('log-box').innerHTML = logs.join(''); }

const STORAGE_KEY = 'fo_fps_ultimate';
let currentUser = null;
function getAccs() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e) { return {}; } }
function saveAccs(accs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(accs)); }

document.getElementById('btn-register').addEventListener('click', () => {
    let u = document.getElementById('acc-username').value.trim(); let p = document.getElementById('acc-password').value.trim();
    if(u.length < 3) { alert("Login za krótki!"); return; }
    let accs = getAccs(); if(accs[u]) { alert("Konto istnieje!"); return; }
    accs[u] = { password: p, saveGame: null }; saveAccs(accs); alert("Konto utworzone!"); document.getElementById('btn-login').click();
});
document.getElementById('btn-login').addEventListener('click', () => {
    let u = document.getElementById('acc-username').value.trim(); let p = document.getElementById('acc-password').value.trim();
    let accs = getAccs();
    if(accs[u] && accs[u].password === p) { currentUser = u; document.getElementById('login-screen').style.display = 'none'; document.getElementById('main-menu').style.display = 'flex'; document.getElementById('logged-user-name').innerText = currentUser; } 
    else { alert("Błędny login/hasło!"); }
});
document.getElementById('btn-logout').addEventListener('click', () => location.reload());

document.getElementById('btn-save-game').addEventListener('click', () => {
    if(!currentUser || isMultiplayer) return;
    let accs = getAccs(); accs[currentUser].saveGame = { player, map, entities, currentLevel, logs }; saveAccs(accs); window.logMsg(`💾 Zapisano grę!`, "log-epic");
});

document.getElementById('btn-load').addEventListener('click', () => {
    if(!currentUser) return;
    let accs = getAccs(); let s = accs[currentUser].saveGame;
    if(!s) { alert(`Brak zapisu!`); return; }
    player = s.player; map = s.map; entities = s.entities; currentLevel = s.currentLevel; logs = s.logs || [];
    isMultiplayer = false; document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-view').style.display = 'block';
    document.getElementById('weapon-view').innerText = player.weapon.sym; updateHUD(); updateInventoryUI();
    state = 'EXPLORE'; requestAnimationFrame(gameLoop); window.logMsg(`💾 Wczytano grę.`, "log-epic");
});

// --- WYBÓR KLASY I MULTIPLAYER ---
window.gameMode = 'single'; window.mpRoomId = '';
window.openCharSelect = function(mode) {
    window.gameMode = mode;
    if(mode === 'join') { window.mpRoomId = document.getElementById('join-id').value; if(!window.mpRoomId) { alert("Podaj ID Hosta!"); return; } }
    difficulty = parseInt(document.getElementById('diff-selector').value);
    document.getElementById('main-menu').style.display = 'none'; document.getElementById('char-select-screen').style.display = 'flex';
};

window.selectHero = function(idx) {
    let h = HEROES[idx]; player.name = h.name; player.cls = h.cls; player.maxHp = h.hp; player.hp = h.hp; player.baseDmg = h.dmg; player.inventory.fill(null); addToInventory('pot', 2);
    document.getElementById('char-select-screen').style.display = 'none';
    if(window.gameMode === 'single') { isMultiplayer = false; startGameInit(); } 
    else if (window.gameMode === 'host') {
        isMultiplayer = true; isHost = true; document.getElementById('loading-screen').style.display = 'flex';
        peer = new Peer(); peer.on('open', id => { document.getElementById('mp-room-id').innerText = id; });
        peer.on('connection', c => { conn = c; setupMpEvents(); document.getElementById('loading-screen').style.display = 'none'; startGameInit(); syncMapToClient(); });
    } else if (window.gameMode === 'join') {
        isMultiplayer = true; isHost = false; document.getElementById('loading-screen').style.display = 'flex'; document.getElementById('mp-room-id').innerText = "Łączenie...";
        peer = new Peer(); peer.on('open', () => { conn = peer.connect(window.mpRoomId); conn.on('open', () => { setupMpEvents(); document.getElementById('loading-screen').style.display = 'none'; startGameInit(); }); });
    }
};

function setupMpEvents() {
    conn.on('data', data => {
        if(data.type === 'sync_map') { map = data.map; entities = data.entities; currentLevel = data.lvl; player.x = data.sx; player.y = data.sy; window.logMsg("Mapa zsynchronizowana.", "log-epic"); }
        if(data.type === 'move') { otherPlayer.x = data.x; otherPlayer.y = data.y; }
        if(data.type === 'loot') { let idx = entities.findIndex(e => e.x === data.x && e.y === data.y); if(idx !== -1) entities.splice(idx, 1); }
    });
}
function broadcastMove() { if(isMultiplayer && conn && conn.open) conn.send({type: 'move', x: player.x, y: player.y}); }
function syncMapToClient() { if(isHost && isMultiplayer && conn && conn.open) conn.send({type: 'sync_map', map: map, entities: entities, lvl: currentLevel, sx: player.x, sy: player.y}); }

// --- EKWIPUNEK ---
function getInvCount(id) { return player.inventory.filter(i => i && i.id === id).reduce((sum, i) => sum + i.count, 0); }
function removeInv(id, amount) { let rem = amount; for(let i = 19; i >= 0; i--) { if(player.inventory[i] && player.inventory[i].id === id) { if(player.inventory[i].count >= rem) { player.inventory[i].count -= rem; if(player.inventory[i].count === 0) player.inventory[i] = null; updateInventoryUI(); return true; } else { rem -= player.inventory[i].count; player.inventory[i] = null; } } } return false; }
function addToInventory(id, amount) { let maxStack = player.belt.cap; let rem = amount; for(let i=0; i<20; i++) { if(player.inventory[i] && player.inventory[i].id === id && player.inventory[i].count < maxStack) { let space = maxStack - player.inventory[i].count; if(rem <= space) { player.inventory[i].count += rem; updateInventoryUI(); return true; } else { player.inventory[i].count = maxStack; rem -= space; } } } for(let i=0; i<20; i++) { if(!player.inventory[i]) { if(rem <= maxStack) { player.inventory[i] = {id: id, count: rem}; updateInventoryUI(); return true; } else { player.inventory[i] = {id: id, count: maxStack}; rem -= maxStack; } } } window.logMsg("Plecak pełny!", "log-dmg"); return false; }
function updateInventoryUI() {
    let hotbarHTML = ''; let mainHTML = '';
    for(let i=0; i<20; i++) {
        let item = player.inventory[i]; let sym = item ? ITEM_DB[item.id].sym : ''; let cnt = item ? `<div class="inv-count">${item.count}</div>` : '';
        let html = `<div class="inv-slot ${i === player.selectedSlot ? 'active' : ''}" data-idx="${i}">${sym}${cnt}</div>`;
        if(i < 9) hotbarHTML += html; else mainHTML += html;
    }
    document.getElementById('inv-hotbar').innerHTML = hotbarHTML; document.getElementById('inv-grid-main').innerHTML = mainHTML;
    document.querySelectorAll('.inv-slot').forEach(el => el.addEventListener('click', function() {
        player.selectedSlot = parseInt(this.getAttribute('data-idx')); let item = player.inventory[player.selectedSlot];
        if(item && ITEM_DB[item.id].use) { ITEM_DB[item.id].use(player); item.count--; if(item.count <= 0) player.inventory[player.selectedSlot] = null; } 
        updateInventoryUI(); updateHUD();
    }));
}

function startGameInit() {
    document.getElementById('game-view').style.display = 'block'; document.getElementById('weapon-view').innerText = player.weapon.sym; 
    if(!isMultiplayer || isHost) generateLevel();
    updateHUD(); updateInventoryUI(); state = 'EXPLORE'; requestAnimationFrame(gameLoop); document.getElementById('pointer-lock-info').style.display = 'block';
}

function generateLevel() {
    map = []; entities = [];
    for(let y=0; y<MAP_SIZE; y++) { map[y] = []; for(let x=0; x<MAP_SIZE; x++) map[y][x] = 1; }
    player.x = Math.floor(MAP_SIZE/2) + 0.5; player.y = Math.floor(MAP_SIZE/2) + 0.5; map[Math.floor(player.y)][Math.floor(player.x)] = 0;

    let floorCount = 0; let cx = Math.floor(player.x), cy = Math.floor(player.y);
    while(floorCount < 150) {
        let d = Math.floor(Math.random()*4);
        if(d===0 && cy>2) cy--; else if(d===1 && cy<MAP_SIZE-3) cy++; else if(d===2 && cx>2) cx--; else if(d===3 && cx<MAP_SIZE-3) cx++;
        if(map[cy][cx] === 1) { map[cy][cx] = 0; floorCount++; }
    }
    let empty = () => { while(true) { let x=Math.floor(Math.random()*MAP_SIZE), y=Math.floor(Math.random()*MAP_SIZE); if(map[y][x]===0 && (x!==Math.floor(player.x)||y!==Math.floor(player.y))) return {x,y}; } };
    let ex = empty(); map[ex.y][ex.x] = 3;
    
    for(let i=0; i<4; i++) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '🧪', id: 'pot'}); }
    for(let i=0; i<6; i++) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '🪵', id: 'wood'}); }
    for(let i=0; i<4; i++) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '⛓️', id: 'steel'}); }
    for(let i=0; i<5+currentLevel; i++) { let p = empty(); let mob = MOBS[Math.floor(Math.random()*MOBS.length)]; entities.push({x:p.x+0.5, y:p.y+0.5, sym: mob.s, isEnemy: true, name: mob.n, hp: mob.hp, maxHp: mob.hp, dmg: mob.d}); }

    // Dodanie NPC (Fabuła!)
    if(Math.random() < 0.5) {
        let p = empty(); let npc = NPC_POOL[Math.floor(Math.random()*NPC_POOL.length)];
        entities.push({x: p.x+0.5, y: p.y+0.5, sym: npc.s, isNPC: true, name: npc.n, text: npc.text});
    }
}

// --- POINTER LOCK (CELOWANIE MYSZKĄ) ---
document.getElementById('game-view').addEventListener('click', () => { if(state === 'EXPLORE') document.body.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { if(document.pointerLockElement === document.body) { document.getElementById('pointer-lock-info').style.display = 'none'; } else { if(state === 'EXPLORE') document.getElementById('pointer-lock-info').style.display = 'block'; } });
document.addEventListener('mousemove', (e) => {
    if(document.pointerLockElement === document.body && state === 'EXPLORE') {
        player.angle -= e.movementX * 0.003; // Zmieniono na Minus, dla prawidłowego obrotu lewo/prawo w Canvasie!
        player.dirX = Math.cos(player.angle); player.dirY = Math.sin(player.angle);
        player.planeX = -Math.sin(player.angle) * 0.66; player.planeY = Math.cos(player.angle) * 0.66;
    }
});

// --- PĘTLA GRY FPS ---
let isMoving = false; let lastTime = 0;
function gameLoop(time) {
    if(state === 'EXPLORE') {
        let dt = (time - lastTime) / 1000; lastTime = time; if(dt > 0.1) dt = 0.1; 
        let speed = 4.0 * dt; let moved = false; let nx = player.x, ny = player.y;
        
        // PRAWIDŁOWY STRAFING (A i D na boki!) - Używa wektora "plane"
        if(keys.w) { nx += player.dirX * speed; ny += player.dirY * speed; moved = true; }
        if(keys.s) { nx -= player.dirX * speed; ny -= player.dirY * speed; moved = true; }
        if(keys.a) { nx -= player.planeX * speed; ny -= player.planeY * speed; moved = true; }
        if(keys.d) { nx += player.planeX * speed; ny += player.planeY * speed; moved = true; }

        let wep = document.getElementById('weapon-view');
        if(moved && !isMoving) { wep.classList.add('walking-bob'); isMoving = true; } else if(!moved && isMoving) { wep.classList.remove('walking-bob'); isMoving = false; }

        let margin = 0.2;
        if(map[Math.floor(player.y)][Math.floor(nx + (nx>player.x?margin:-margin))] === 0) player.x = nx;
        if(map[Math.floor(ny + (ny>player.y?margin:-margin))][Math.floor(player.x)] === 0) player.y = ny;
        if(moved) broadcastMove();

        let pxInt = Math.floor(player.x); let pyInt = Math.floor(player.y);
        if(map[pyInt][pxInt] === 3) { currentLevel++; generateLevel(); if(isHost) syncMapToClient(); }

        for(let i = entities.length - 1; i >= 0; i--) {
            let e = entities[i]; let dist = Math.sqrt((player.x - e.x)**2 + (player.y - e.y)**2);
            if(dist < 0.6) {
                if(e.isNPC) {
                    document.exitPointerLock(); state = 'DIALOG';
                    document.getElementById('dialog-overlay').style.display = 'flex';
                    document.getElementById('dialog-name').innerText = e.name; document.getElementById('dialog-text').innerText = `"${e.text}"`;
                    player.x -= player.dirX * 0.5; player.y -= player.dirY * 0.5; // Odbij gracza by nie zablokował okna
                }
                else if(!e.isEnemy) { if(addToInventory(e.id, 1)) { window.logMsg(`Zebrałeś: ${ITEM_DB[e.id].name}`); entities.splice(i, 1); if(isMultiplayer) conn.send({type:'loot', x:e.x, y:e.y}); } } 
                else { 
                    currentEnemy = e; state = 'COMBAT'; document.exitPointerLock(); document.getElementById('combat-overlay').style.display = 'flex'; 
                    document.getElementById('c-enemy-name').innerText = currentEnemy.name; updateCombatUI(); 
                }
            }
            if(difficulty > 1 && e.isEnemy && Math.random() < 0.03) {
                let dx = Math.sign(player.x - e.x)*0.1; let dy = Math.sign(player.y - e.y)*0.1;
                if(map[Math.floor(e.y)][Math.floor(e.x+dx)] === 0) e.x += dx; if(map[Math.floor(e.y+dy)][Math.floor(e.x)] === 0) e.y += dy;
            }
        }
        render3D(ctx, map, entities, player, otherPlayer); drawMinimap(mCtx, map, entities, player, otherPlayer);
    }
    requestAnimationFrame(gameLoop);
}

// --- KARY ZA ŚMIERĆ (RESPAWN) ---
function handleDeath() {
    let loss = difficulty === 1 ? 0.25 : (difficulty === 2 ? 0.50 : 0.75);
    player.inventory.forEach((item, idx) => { if(item) { item.count = Math.floor(item.count * (1 - loss)); if(item.count <= 0) player.inventory[idx] = null; } });
    player.hp = player.maxHp; player.x = Math.floor(MAP_SIZE/2) + 0.5; player.y = Math.floor(MAP_SIZE/2) + 0.5;
    window.logMsg(`💀 ZGINĄŁEŚ! Odradzasz się i tracisz ${loss*100}% łupów z plecaka.`, "log-dmg");
    updateInventoryUI(); updateHUD();
    document.getElementById('combat-overlay').style.display = 'none'; state = 'EXPLORE'; currentEnemy = null; document.body.requestPointerLock();
}

// --- KOWAL I UI ---
function updateHUD() {
    document.getElementById('ui-class').innerText = player.cls; document.getElementById('ui-hp').innerText = Math.floor(player.hp); document.getElementById('ui-maxhp').innerText = player.maxHp;
    document.getElementById('ui-coins').innerText = player.coins; document.getElementById('ui-dlvl').innerText = currentLevel;
    document.getElementById('ch-wep').innerText = player.weapon.name; document.getElementById('ch-arm').innerText = player.armor.name; document.getElementById('ch-belt').innerText = `${player.belt.name} (Max x${player.belt.cap})`;
}

document.getElementById('btn-open-crafting').addEventListener('click', () => {
    document.getElementById('inventory-overlay').style.display = 'none'; document.getElementById('crafting-overlay').style.display = 'flex';
    let c = document.getElementById('craft-container'); c.innerHTML = '';
    RECIPES.forEach((r, idx) => {
        let reqStr = Object.entries(r.req).map(([k, v]) => `${ITEM_DB[k].name}:${v}`).join(', ');
        c.innerHTML += `<div style="background:#8b8b8b; color:#111; padding:10px; border:2px solid #373737; font-weight:bold; cursor:pointer;" data-idx="${idx}"><b>${r.name}</b><br><span style="font-size:11px;">${reqStr}</span></div>`;
    });
    c.querySelectorAll('div').forEach(el => el.addEventListener('click', function() {
        let r = RECIPES[this.getAttribute('data-idx')]; let canCraft = true;
        for(let key in r.req) { if(getInvCount(key) < r.req[key]) canCraft = false; }
        if(canCraft) { 
            for(let key in r.req) removeInv(key, r.req[key]); 
            if(r.type === 'belt') player.belt = BELTS[1];
            if(r.type === 'wep') { player.weapon = WEAPONS[r.val]; document.getElementById('weapon-view').innerText = player.weapon.sym; }
            if(r.type === 'arm') player.armor = ARMORS[r.val];
            if(r.type === 'item') addToInventory(r.id, 1);
            window.logMsg("Wykuto przedmiot!"); updateHUD();
        } else window.logMsg("Brak surowców!", "log-dmg");
    }));
});

document.getElementById('btn-close-inv').addEventListener('click', () => { state = 'EXPLORE'; document.getElementById('inventory-overlay').style.display = 'none'; document.body.requestPointerLock(); });
document.getElementById('btn-close-crafting').addEventListener('click', () => { document.getElementById('crafting-overlay').style.display = 'none'; document.getElementById('inventory-overlay').style.display = 'flex'; });
window.closeDialog = function() { document.getElementById('dialog-overlay').style.display = 'none'; state = 'EXPLORE'; document.body.requestPointerLock(); };

function updateCombatUI() { document.getElementById('c-enemy-hp-bar').style.width = Math.max(0, (currentEnemy.hp / currentEnemy.maxHp) * 100) + '%'; document.getElementById('c-player-hp-bar').style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%'; document.getElementById('c-player-hp-text').innerText = Math.floor(player.hp); }

window.combatAction = function(action) {
    let wep = document.getElementById('weapon-view'); wep.classList.add('attacking'); setTimeout(() => wep.classList.remove('attacking'), 200);
    let dmg = player.baseDmg + player.weapon.dmg; let arm = player.baseArmor + player.armor.def;
    if(action === 'Zwykly') { currentEnemy.hp -= dmg; window.logMsg(`Zadajesz ${dmg} obr.`); }
    if(action === 'Silny') { if(Math.random()<0.5) { currentEnemy.hp -= dmg*2; window.logMsg(`KRYTYK! ${dmg*2} obr!`, "log-epic"); } else window.logMsg("Pudło!", "log-dmg"); }
    if(action === 'Bomba') { if(removeInv('bomb', 1)) { currentEnemy.hp -= 100; window.logMsg("BUM! 100 obr!"); } else { window.logMsg("Brak bomb!"); return; } }
    if(action === 'Mikstura') { if(removeInv('pot', 1)) { player.hp = Math.min(player.maxHp, player.hp+50); window.logMsg("Leczysz się."); } else return; }
    
    if(currentEnemy.hp <= 0) { window.logMsg(`Zwycięstwo! +25 monet.`, "log-heal"); player.coins += 25; entities.splice(entities.indexOf(currentEnemy), 1); document.getElementById('combat-overlay').style.display = 'none'; state='EXPLORE'; currentEnemy = null; updateHUD(); document.body.requestPointerLock(); return; }
    
    let enemyDmg = Math.max(1, (currentEnemy.dmg + Math.floor(Math.random()*5)) - arm); player.hp -= enemyDmg; window.logMsg(`Otrzymujesz ${enemyDmg} obr!`, "log-dmg"); 
    if(player.hp <= 0) { player.hp = 0; handleDeath(); } else { updateCombatUI(); updateHUD(); }
}

document.getElementById('btn-combat-atk').addEventListener('click', () => window.combatAction('Zwykly'));
document.getElementById('btn-combat-str').addEventListener('click', () => window.combatAction('Silny'));
document.getElementById('btn-combat-heal').addEventListener('click', () => window.combatAction('Mikstura'));
document.getElementById('btn-combat-bomb').addEventListener('click', () => window.combatAction('Bomba'));

window.addEventListener('keydown', e => { 
    let k = e.key.toLowerCase(); if(keys.hasOwnProperty(k)) keys[k] = true; 
    if(k==='e' && state==='EXPLORE') { document.exitPointerLock(); state='MENU'; document.getElementById('inventory-overlay').style.display = 'flex'; updateInventoryUI(); updateHUD(); keys={w:false,a:false,s:false,d:false};}
    else if(k==='e' && state==='MENU') { document.querySelectorAll('.overlay-ui').forEach(el=>el.style.display='none'); state='EXPLORE'; keys={w:false,a:false,s:false,d:false}; document.body.requestPointerLock(); }
    else if(k==='e' && state==='DIALOG') { window.closeDialog(); }
    if(!isNaN(k) && k>0 && k<=9 && state==='EXPLORE') selectSlot(k-1);
});
window.addEventListener('keyup', e => { let k = e.key.toLowerCase(); if(keys.hasOwnProperty(k)) keys[k] = false; });
window.addEventListener('mousedown', () => { if(state === 'EXPLORE') { let wep = document.getElementById('weapon-view'); wep.classList.add('attacking'); setTimeout(() => wep.classList.remove('attacking'), 200); }});
