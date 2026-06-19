import { ITEM_DB, WEAPONS, ARMORS, BELTS, RECIPES, MOBS, MAP_SIZE, INV_SIZE, T_WALL, T_FLOOR, T_EXIT, T_PORTAL } from './data.js';
import { buildCSS3D, updateCamera, drawMinimap } from './engine.js';

// --- STAN GRY ---
let map = [], entities = [], logs = [];
let state = 'MENU', difficulty = 1;
let currentLevel = 1, currentEnemy = null;
let keys = {w:false, a:false, s:false, d:false};

let player = {
    x: 1.5, z: 1.5, rot: 0,
    hp: 100, maxHp: 100, coins: 0, baseDmg: 0, baseArmor: 0,
    weapon: WEAPONS[0], armor: ARMORS[0], belt: BELTS[0],
    inventory: new Array(INV_SIZE).fill(null), selectedSlot: 0
};

// --- FUNKCJE POMOCNICZE ---
window.logMsg = function(msg, type='log-new') { logs.unshift(`<span class="${type}">• ${msg}</span><br>`); if(logs.length > 7) logs.pop(); document.getElementById('log-box').innerHTML = logs.join(''); };

// WAŻNE: Funkcja gasząca WSZYSTKIE nakładki (Naprawia buga z zablokowaniem u Kowala)
window.closeAllOverlays = function() {
    document.querySelectorAll('.overlay-ui').forEach(el => el.style.display = 'none');
    state = 'EXPLORE'; keys={w:false,a:false,s:false,d:false};
};

window.openOverlay = function(id) { 
    window.closeAllOverlays();
    state = 'MENU'; 
    document.getElementById(id).style.display = 'flex'; 
};

// --- SYSTEM KONT ---
const STORAGE_KEY = 'fo_fps_v3'; 
window.currentUser = null;

window.getAccounts = function() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e) { return {}; } };
window.saveAccounts = function(accs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(accs)); };

window.registerAccount = function() {
    let u = document.getElementById('acc-username').value.trim(); let p = document.getElementById('acc-password').value.trim();
    if(u.length < 3) { alert("Login za krótki!"); return; }
    let accs = window.getAccounts(); if(accs[u]) { alert("Konto istnieje!"); return; }
    accs[u] = { password: p, saveGame: null }; window.saveAccounts(accs); 
    alert("Konto utworzone!"); window.loginAccount();
};

window.loginAccount = function() {
    let u = document.getElementById('acc-username').value.trim(); let p = document.getElementById('acc-password').value.trim();
    let accs = window.getAccounts();
    if(accs[u] && accs[u].password === p) {
        window.currentUser = u;
        document.getElementById('login-screen').style.display = 'none'; document.getElementById('main-menu').style.display = 'flex';
        document.getElementById('logged-user-name').innerText = window.currentUser;
    } else { alert("Błędny login/hasło!"); }
};

window.logoutAccount = function() { window.currentUser = null; location.reload(); };

window.saveGame = function() {
    if(!window.currentUser) return;
    let accs = window.getAccounts(); accs[window.currentUser].saveGame = { player, map, entities, currentLevel, logs }; window.saveAccounts(accs);
    window.logMsg(`💾 Zapisano grę!`, "log-epic");
};

window.loadGame = function() {
    if(!window.currentUser) return;
    let accs = window.getAccounts(); let s = accs[window.currentUser].saveGame;
    if(!s) { alert(`Brak zapisu!`); return; }
    player = s.player; map = s.map; entities = s.entities; currentLevel = s.currentLevel; logs = s.logs || [];
    document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-view').style.display = 'block';
    window.updateWeaponView(); buildCSS3D(map, entities, player); state = 'EXPLORE'; requestAnimationFrame(gameLoop);
    window.logMsg(`💾 Wczytano grę.`, "log-epic");
};

// --- EKWIPUNEK MINECRAFT ---
window.getInvCount = function(id) { return player.inventory.filter(i => i && i.id === id).reduce((sum, i) => sum + i.count, 0); };
window.removeInv = function(id, amount) {
    let rem = amount;
    for(let i = player.inventory.length - 1; i >= 0; i--) {
        if(player.inventory[i] && player.inventory[i].id === id) {
            if(player.inventory[i].count >= rem) { player.inventory[i].count -= rem; if(player.inventory[i].count === 0) player.inventory[i] = null; window.updateInventoryUI(); return true; } 
            else { rem -= player.inventory[i].count; player.inventory[i] = null; }
        }
    } return false;
};
window.addToInventory = function(id, amount) {
    let maxStack = player.belt.cap; let rem = amount;
    for(let i=0; i<INV_SIZE; i++) {
        if(player.inventory[i] && player.inventory[i].id === id && player.inventory[i].count < maxStack) {
            let space = maxStack - player.inventory[i].count;
            if(rem <= space) { player.inventory[i].count += rem; window.updateInventoryUI(); return true; } else { player.inventory[i].count = maxStack; rem -= space; }
        }
    }
    for(let i=0; i<INV_SIZE; i++) {
        if(!player.inventory[i]) {
            if(rem <= maxStack) { player.inventory[i] = {id: id, count: rem}; window.updateInventoryUI(); return true; } else { player.inventory[i] = {id: id, count: maxStack}; rem -= maxStack; }
        }
    }
    window.logMsg("Plecak pełny!", "log-dmg"); return false;
};
window.updateInventoryUI = function() {
    let hotbarHTML = ''; let mainHTML = '';
    for(let i=0; i<INV_SIZE; i++) {
        let item = player.inventory[i]; let sym = item ? ITEM_DB[item.id].sym : ''; let cnt = item ? `<div class="inv-count">${item.count}</div>` : '';
        let html = `<div class="inv-slot ${i === player.selectedSlot ? 'active' : ''}" onclick="window.selectSlot(${i})">${sym}${cnt}</div>`;
        if(i < 9) hotbarHTML += html; else mainHTML += html;
    }
    document.getElementById('inv-hotbar').innerHTML = hotbarHTML; document.getElementById('inv-grid-main').innerHTML = mainHTML;
};
window.selectSlot = function(idx) {
    player.selectedSlot = idx; let item = player.inventory[idx];
    if(item && ITEM_DB[item.id].use) { ITEM_DB[item.id].use(player); item.count--; if(item.count <= 0) player.inventory[idx] = null; } 
    window.updateInventoryUI(); window.updateHUD();
};

// --- SILNIK I GENEROWANIE ---
window.updateWeaponView = function() { document.getElementById('weapon-view').innerText = player.weapon.sym; };
window.startGameSingle = function() {
    document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-view').style.display = 'block';
    difficulty = parseInt(document.getElementById('diff-selector').value);
    player.hp = 100; player.inventory.fill(null); window.addToInventory('pot', 2); window.updateWeaponView(); window.generateLevel(); state = 'EXPLORE'; requestAnimationFrame(gameLoop);
};
window.generateLevel = function() {
    map = []; entities = [];
    for(let z=0; z<MAP_SIZE; z++) { map[z] = []; for(let x=0; x<MAP_SIZE; x++) map[z][x] = T_WALL; }
    let cx = Math.floor(MAP_SIZE/2), cz = Math.floor(MAP_SIZE/2); map[cz][cx] = T_FLOOR; player.x = cx + 0.5; player.z = cz + 0.5; player.rot = 0;

    let floorCount = 0;
    while(floorCount < 150) {
        let d = Math.floor(Math.random()*4);
        if(d===0 && cz>2) cz--; else if(d===1 && cz<MAP_SIZE-3) cz++; else if(d===2 && cx>2) cx--; else if(d===3 && cx<MAP_SIZE-3) cx++;
        if(map[cz][cx] === T_WALL) { map[cz][cx] = T_FLOOR; floorCount++; }
    }
    let empty = () => { while(true) { let x=Math.floor(Math.random()*MAP_SIZE), z=Math.floor(Math.random()*MAP_SIZE); if(map[z][x]===T_FLOOR && (x!==Math.floor(player.x)||z!==Math.floor(player.z))) return {x,z}; } };
    let ex = empty(); map[ex.z][ex.x] = T_EXIT;
    for(let i=0; i<4; i++) { let p=empty(); entities.push({x:p.x+0.5, z:p.z+0.5, sym: '🧪', id: 'pot'}); }
    for(let i=0; i<6; i++) { let p=empty(); entities.push({x:p.x+0.5, z:p.z+0.5, sym: '🪵', id: 'wood'}); }
    for(let i=0; i<4; i++) { let p=empty(); entities.push({x:p.x+0.5, z:p.z+0.5, sym: '⛓️', id: 'steel'}); }
    for(let i=0; i<5+currentLevel; i++) { let p = empty(); let mob = MOBS[Math.floor(Math.random()*MOBS.length)]; entities.push({x:p.x+0.5, z:p.z+0.5, sym: mob.s, isEnemy: true, name: mob.n, hp: mob.hp, maxHp: mob.hp, dmg: mob.d}); }

    buildCSS3D(map, entities, player); window.updateInventoryUI();
};

// --- PĘTLA GRY (FPS PŁYNNY RUCH) ---
let isMoving = false;
let lastRenderPos = {x:0, z:0};

function gameLoop() {
    if(state === 'EXPLORE') {
        let speed = 0.08; let rotSpeed = 3;
        if(keys.a) player.rot -= rotSpeed; if(keys.d) player.rot += rotSpeed;
        let nx = player.x, nz = player.z; let moved = false;
        
        if(keys.w) { nx += Math.sin(player.rot * Math.PI / 180) * speed; nz -= Math.cos(player.rot * Math.PI / 180) * speed; moved = true; }
        if(keys.s) { nx -= Math.sin(player.rot * Math.PI / 180) * speed; nz += Math.cos(player.rot * Math.PI / 180) * speed; moved = true; }

        let wep = document.getElementById('weapon-view');
        if(moved && !isMoving) { wep.classList.add('walking-bob'); isMoving = true; } else if(!moved && isMoving) { wep.classList.remove('walking-bob'); isMoving = false; }

        // Kolizja Płynna
        let margin = 0.2;
        if(map[Math.floor(player.z)][Math.floor(nx + (nx>player.x?margin:-margin))] === T_FLOOR) player.x = nx;
        if(map[Math.floor(nz + (nz>player.z?margin:-margin))][Math.floor(player.x)] === T_FLOOR) player.z = nz;

        let pxInt = Math.floor(player.x); let pzInt = Math.floor(player.z);
        if(map[pzInt][pxInt] === T_EXIT || map[pzInt][pxInt] === T_PORTAL) { currentLevel++; window.generateLevel(); }

        for(let i = entities.length - 1; i >= 0; i--) {
            let e = entities[i]; let dist = Math.sqrt((player.x - e.x)**2 + (player.z - e.z)**2);
            if(dist < 0.8) {
                if(!e.isEnemy) { if(window.addToInventory(e.id, 1)) { window.logMsg(`Zebrałeś: ${ITEM_DB[e.id].name}`); document.getElementById(`ent_${i}`).remove(); entities.splice(i, 1); } } 
                else { currentEnemy = e; window.openOverlay('combat-overlay'); document.getElementById('c-enemy-name').innerText = currentEnemy.name; window.updateCombatUI(); }
            }
            // Gonitwa potworów jeśli tryb Normalny (difficulty 2)
            if(difficulty === 2 && e.isEnemy && Math.random() < 0.02) {
                let dx = Math.sign(player.x - e.x)*0.1; let dz = Math.sign(player.z - e.z)*0.1;
                if(map[Math.floor(e.z)][Math.floor(e.x+dx)] === T_FLOOR) e.x += dx;
                if(map[Math.floor(e.z+dz)][Math.floor(e.x)] === T_FLOOR) e.z += dz;
            }
        }
        
        if(Math.floor(player.x) !== lastRenderPos.x || Math.floor(player.z) !== lastRenderPos.z) {
            buildCSS3D(map, entities, player); lastRenderPos.x = Math.floor(player.x); lastRenderPos.z = Math.floor(player.z);
        } else { updateCamera(player); }
        
        drawMinimap(map, entities, player);
    }
    requestAnimationFrame(gameLoop);
}

// --- KOWAL I WALKA ---
window.updateHUD = function() {
    document.getElementById('ui-hp').innerText = Math.floor(player.hp); document.getElementById('ui-maxhp').innerText = player.maxHp;
    document.getElementById('ui-coins').innerText = player.coins; document.getElementById('ui-dlvl').innerText = currentLevel;
    document.getElementById('ch-wep').innerText = player.weapon.name; document.getElementById('ch-arm').innerText = player.armor.name; document.getElementById('ch-belt').innerText = `${player.belt.name} (Max x${player.belt.cap})`;
};
window.openCrafting = function() {
    window.openOverlay('crafting-overlay'); let c = document.getElementById('craft-container'); c.innerHTML = '';
    RECIPES.forEach((r, idx) => { let reqStr = Object.entries(r.req).map(([k, v]) => `${ITEM_DB[k].name}:${v}`).join(', '); c.innerHTML += `<div style="background:#8b8b8b; color:#111; padding:10px; border:2px solid #373737; font-weight:bold; cursor:pointer;" onclick="window.craft(${idx})"><b>${r.name}</b><br><span style="font-size:11px;">${reqStr}</span></div>`; });
};
window.craft = function(idx) {
    let r = RECIPES[idx]; let canCraft = true;
    for(let key in r.req) { if(window.getInvCount(key) < r.req[key]) canCraft = false; }
    if(canCraft) { for(let key in r.req) window.removeInv(key, r.req[key]); r.action(player); window.openCrafting(); window.updateHUD(); } else window.logMsg("Brak surowców!", "log-dmg");
};
window.updateCombatUI = function() { document.getElementById('c-enemy-hp-bar').style.width = Math.max(0, (currentEnemy.hp / currentEnemy.maxHp) * 100) + '%'; document.getElementById('c-player-hp-bar').style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%'; document.getElementById('c-player-hp-text').innerText = Math.floor(player.hp); };
window.combatAction = function(action) {
    let wep = document.getElementById('weapon-view'); wep.classList.add('attacking'); setTimeout(() => wep.classList.remove('attacking'), 200);
    let dmg = player.baseDmg + player.weapon.dmg; let arm = player.baseArmor + player.armor.def;
    if(action === 'Zwykly') { currentEnemy.hp -= dmg; window.logMsg(`Zadajesz ${dmg} obr.`); }
    if(action === 'Silny') { if(Math.random()<0.5) { currentEnemy.hp -= dmg*2; window.logMsg(`KRYTYK! ${dmg*2} obr!`, "log-epic"); } else window.logMsg("Pudło!", "log-dmg"); }
    if(action === 'Bomba') { if(window.removeInv('bomb', 1)) { currentEnemy.hp -= 100; window.logMsg("BUM! 100 obr!"); } else { window.logMsg("Brak bomb!"); return; } }
    if(action === 'Mikstura') { if(window.removeInv('pot', 1)) { player.hp = Math.min(player.maxHp, player.hp+50); window.logMsg("Leczysz się."); } else return; }
    
    if(currentEnemy.hp <= 0) { window.logMsg(`Zwycięstwo! +25 monet.`, "log-heal"); player.coins += 25; let el = document.getElementById(`ent_${entities.indexOf(currentEnemy)}`); if(el) el.remove(); entities.splice(entities.indexOf(currentEnemy), 1); window.closeAllOverlays(); currentEnemy = null; window.updateHUD(); return; }
    
    let enemyDmg = Math.max(1, (currentEnemy.dmg + Math.floor(Math.random()*5)) - arm); player.hp -= enemyDmg; window.logMsg(`Otrzymujesz ${enemyDmg} obr!`, "log-dmg"); 
    if(player.hp <= 0) { player.hp = 0; window.logMsg("💀 ZGINĄŁEŚ!"); alert("Zginąłeś!"); location.reload(); }
    window.updateCombatUI(); window.updateHUD();
};

// --- STEROWANIE ---
window.addEventListener('keydown', e => { 
    let k = e.key.toLowerCase(); if(keys.hasOwnProperty(k)) keys[k] = true; 
    if(k==='e' && state==='EXPLORE') { window.openOverlay('inventory-overlay'); window.updateInventoryUI(); window.updateHUD(); }
    else if(k==='e' && state==='MENU') { window.closeAllOverlays(); }
    if(!isNaN(k) && k>0 && k<=9 && state==='EXPLORE') window.selectSlot(k-1);
});
window.addEventListener('keyup', e => { let k = e.key.toLowerCase(); if(keys.hasOwnProperty(k)) keys[k] = false; });
window.addEventListener('mousedown', () => { if(state === 'EXPLORE') { let wep = document.getElementById('weapon-view'); wep.classList.add('attacking'); setTimeout(() => wep.classList.remove('attacking'), 200); }});
