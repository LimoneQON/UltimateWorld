import { ITEM_DB, WEAPONS, HELMETS, CHESTS, PANTS, BOOTS, BELTS, RECIPES, MOBS, HEROES, NPC_POOL, PERKS, MAP_SIZE, INV_SIZE } from './data.js';
import { render3D, drawMinimap } from './engine.js';

let map = [], entities = [], logs = [];
let state = 'MENU', difficulty = 1;
let currentLevel = 1, currentSub = 1, selectedWorld = 'human';
let currentEnemy = null, is18Plus = false;
let keys = {w:false, a:false, s:false, d:false};

let player = {
    x: 1.5, y: 1.5, angle: 0, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66, 
    hp: 100, maxHp: 100, coins: 0, xp: 0, reqXp: 100, lvl: 1, baseDmg: 0, baseArmor: 0, name: "", cls: "",
    weapon: WEAPONS[0], helm: HELMETS[0], chest: CHESTS[0], pants: PANTS[0], boots: BOOTS[0], belt: BELTS[0], 
    inventory: new Array(INV_SIZE).fill(null), selectedSlot: 0, perks: [], activeEffects: []
};

const gameCanvas = document.getElementById('gameCanvas'); const ctx = gameCanvas.getContext('2d');
const miniCanvas = document.getElementById('minimap'); const mCtx = miniCanvas.getContext('2d');

window.logMsg = function(msg, type='log-new') { logs.unshift(`<span class="${type}">• ${msg}</span><br>`); if(logs.length > 7) logs.pop(); document.getElementById('log-box').innerHTML = logs.join(''); }

// GLOBALNE FUNKCJE OVERLAY
window.closeAllOverlays = function() { document.querySelectorAll('.overlay-ui').forEach(el=>el.style.display='none'); state='EXPLORE'; keys={w:false,a:false,s:false,d:false}; document.body.requestPointerLock(); };
window.openOverlay = function(id) { document.querySelectorAll('.overlay-ui').forEach(el=>el.style.display='none'); state='MENU'; document.getElementById(id).style.display='flex'; document.exitPointerLock(); };
window.closeDialog = function() { document.getElementById('dialog-overlay').style.display='none'; state='EXPLORE'; document.body.requestPointerLock(); };

const STORAGE_KEY = 'fo_v25_final'; let currentUser = null;
function getAccs() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e) { return {}; } }
function saveAccs(accs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(accs)); }

window.registerAccount = function() { let u = document.getElementById('acc-username').value.trim(); let p = document.getElementById('acc-password').value.trim(); if(u.length < 3) { alert("Login za krótki!"); return; } let accs = getAccs(); if(accs[u]) { alert("Konto istnieje!"); return; } accs[u] = { password: p, saveGame: null }; saveAccs(accs); alert("Utworzono konto!"); window.loginAccount(); };
window.loginAccount = function() { let u = document.getElementById('acc-username').value.trim(); let p = document.getElementById('acc-password').value.trim(); let accs = getAccs(); if(accs[u] && accs[u].password === p) { currentUser = u; document.getElementById('login-screen').style.display = 'none'; document.getElementById('main-menu').style.display = 'flex'; document.getElementById('logged-user-name').innerText = currentUser; } else { alert("Błędny login/hasło!"); } };
window.logoutAccount = function() { location.reload(); };

window.saveGame = function() { if(!currentUser) return; let accs = getAccs(); accs[currentUser].saveGame = { player, map, entities, currentLevel, currentSub, selectedWorld, is18Plus, logs }; saveAccs(accs); window.logMsg(`💾 Zapisano!`, "log-epic"); };
window.loadGame = function() { if(!currentUser) return; let accs = getAccs(); let s = accs[currentUser].saveGame; if(!s) { alert(`Brak zapisu!`); return; } player = s.player; map = s.map; entities = s.entities; currentLevel = s.currentLevel; currentSub = s.currentSub; selectedWorld = s.selectedWorld; is18Plus = s.is18Plus; logs = s.logs || []; document.getElementById('main-menu').style.display = 'none'; document.getElementById('game-view').style.display = 'block'; window.updateWeaponView(); window.updateHUD(); window.updateInventoryUI(); state = 'EXPLORE'; requestAnimationFrame(gameLoop); window.logMsg(`💾 Wczytano grę.`, "log-epic"); };

window.openCharSelect = function() { difficulty = parseInt(document.getElementById('diff-selector').value); is18Plus = document.getElementById('mode-18plus').checked; document.getElementById('main-menu').style.display = 'none'; document.getElementById('char-select-screen').style.display = 'flex'; };

window.selectHero = function(idx) { 
    let h = HEROES[idx]; player.name = h.name; player.cls = h.cls; player.maxHp = h.hp; player.hp = h.hp; player.baseDmg = h.dmg; player.inventory.fill(null); window.addToInventory('pot', 2); 
    document.getElementById('char-select-screen').style.display = 'none'; 
    document.getElementById('game-view').style.display = 'block'; window.updateWeaponView(); generateLevel(); window.updateHUD(); window.updateInventoryUI(); state = 'EXPLORE'; requestAnimationFrame(gameLoop); document.body.requestPointerLock(); 
};

// --- EKWIPUNEK ---
window.getInvCount = function(id) { return player.inventory.filter(i => i && i.id === id).reduce((sum, i) => sum + i.count, 0); }
window.removeInv = function(id, amount) { let rem = amount; for(let i = 19; i >= 0; i--) { if(player.inventory[i] && player.inventory[i].id === id) { if(player.inventory[i].count >= rem) { player.inventory[i].count -= rem; if(player.inventory[i].count === 0) player.inventory[i] = null; window.updateInventoryUI(); return true; } else { rem -= player.inventory[i].count; player.inventory[i] = null; } } } return false; }
window.addToInventory = function(id, amount) { let maxStack = player.belt.cap; let rem = amount; for(let i=0; i<20; i++) { if(player.inventory[i] && player.inventory[i].id === id && player.inventory[i].count < maxStack) { let space = maxStack - player.inventory[i].count; if(rem <= space) { player.inventory[i].count += rem; window.updateInventoryUI(); return true; } else { player.inventory[i].count = maxStack; rem -= space; } } } for(let i=0; i<20; i++) { if(!player.inventory[i]) { if(rem <= maxStack) { player.inventory[i] = {id: id, count: rem}; window.updateInventoryUI(); return true; } else { player.inventory[i] = {id: id, count: maxStack}; rem -= maxStack; } } } window.logMsg("Plecak pełny!", "log-dmg"); return false; }
window.updateInventoryUI = function() {
    let hotbarHTML = ''; let mainHTML = '';
    for(let i=0; i<20; i++) {
        let item = player.inventory[i]; let sym = item ? ITEM_DB[item.id].sym : ''; let cnt = item ? `<div class="inv-count">${item.count}</div>` : '';
        let html = `<div class="inv-slot ${i === player.selectedSlot ? 'active' : ''}" data-idx="${i}">${sym}${cnt}</div>`;
        if(i < 9) hotbarHTML += html; else mainHTML += html;
    }
    document.getElementById('inv-hotbar').innerHTML = hotbarHTML; document.getElementById('inv-grid-main').innerHTML = mainHTML;
    document.querySelectorAll('.inv-slot').forEach(el => el.addEventListener('click', function() {
        player.selectedSlot = parseInt(this.getAttribute('data-idx')); let item = player.inventory[player.selectedSlot];
        if(item && ITEM_DB[item.id].use) { 
            if(item.id === 'vodka') { player.hp = Math.min(player.maxHp, player.hp+100); player.activeEffects.push('Pijany'); window.logMsg("Pijesz Wódkę (+100 HP)!", "log-epic"); }
            else if(item.id === 'drug') { player.activeEffects.push('Haj'); window.logMsg("Bierzesz Fisstech (+Dmg)!", "log-epic"); }
            else { ITEM_DB[item.id].use(player); }
            item.count--; if(item.count <= 0) player.inventory[player.selectedSlot] = null; 
        } 
        window.updateInventoryUI(); window.updateHUD();
    }));
}

function isSafeZone() { return currentSub === 1; }

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

    if(isSafeZone()) {
        window.logMsg("🌿 Wkraczasz do Safe Zone.", "log-heal"); document.getElementById('ui-safezone').style.display = 'inline';
        let pm = empty(); map[pm.y][pm.x] = 4;
        for(let i=0; i<3; i++) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '🪵', id: 'wood'}); }
        for(let i=0; i<2; i++) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '⛓️', id: 'steel'}); }
        let p = empty(); let npc = NPC_POOL[Math.floor(Math.random()*NPC_POOL.length)];
        entities.push({x: p.x+0.5, y: p.y+0.5, sym: npc.s, isNPC: true, name: npc.n, text: npc.text});
    } else {
        document.getElementById('ui-safezone').style.display = 'none';
        for(let i=0; i<4; i++) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '🧪', id: 'pot'}); }
        for(let i=0; i<3; i++) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '🪵', id: 'wood'}); }
        for(let i=0; i<2; i++) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '⛓️', id: 'steel'}); }
        
        let diffMult = (difficulty === 2) ? 1.5 : (difficulty === 3 ? 2.0 : 1.0);
        for(let i=0; i<4+currentLevel; i++) { let p = empty(); let mob = MOBS[Math.floor(Math.random()*MOBS.length)]; entities.push({x:p.x+0.5, y:p.y+0.5, sym: mob.s, isEnemy: true, name: mob.n, hp: mob.hp*diffMult, maxHp: mob.hp*diffMult, dmg: mob.d*diffMult, loot: mob.loot}); }
        
        if(is18Plus && Math.random()<0.5) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '💋', isNPC: true, isHooker: true, name: "Kurtyzana", text: "Szukasz pocieszenia podróżniku?"}); }
        if(is18Plus) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '🍺', id: 'vodka'}); }
        if(is18Plus) { let p=empty(); entities.push({x:p.x+0.5, y:p.y+0.5, sym: '💊', id: 'drug'}); }
    }
    window.updateHUD();
}

document.getElementById('game-view').addEventListener('click', () => { if(state === 'EXPLORE') document.body.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { if(document.pointerLockElement === document.body) { document.getElementById('pointer-lock-info').style.display = 'none'; } else { if(state === 'EXPLORE') document.getElementById('pointer-lock-info').style.display = 'block'; } });

// MYSZKA - POPRAWIONA
document.addEventListener('mousemove', (e) => {
    if(document.pointerLockElement === document.body && state === 'EXPLORE') {
        player.angle -= e.movementX * 0.003; 
        player.dirX = Math.cos(player.angle); player.dirY = Math.sin(player.angle);
        player.planeX = -Math.sin(player.angle) * 0.66; player.planeY = Math.cos(player.angle) * 0.66;
    }
});

let isMoving = false; let lastTime = 0;
function gameLoop(time) {
    if(state === 'EXPLORE') {
        let dt = (time - lastTime) / 1000; lastTime = time; if(dt > 0.1) dt = 0.1; 
        let speed = 4.0 * dt; let moved = false; let nx = player.x, ny = player.y;
        
        if(keys.w) { nx += player.dirX * speed; ny += player.dirY * speed; moved = true; }
        if(keys.s) { nx -= player.dirX * speed; ny -= player.dirY * speed; moved = true; }
        if(keys.a) { nx -= player.planeX * speed; ny -= player.planeY * speed; moved = true; }
        if(keys.d) { nx += player.planeX * speed; ny += player.planeY * speed; moved = true; }

        let wep = document.getElementById('weapon-view');
        if(moved && !isMoving) { wep.classList.add('walking-bob'); isMoving = true; } else if(!moved && isMoving) { wep.classList.remove('walking-bob'); isMoving = false; }

        let margin = 0.2;
        if(map[Math.floor(player.y)][Math.floor(nx + (nx>player.x?margin:-margin))] === 0 || map[Math.floor(player.y)][Math.floor(nx + (nx>player.x?margin:-margin))] >= 3) player.x = nx;
        if(map[Math.floor(ny + (ny>player.y?margin:-margin))][Math.floor(player.x)] === 0 || map[Math.floor(ny + (ny>player.y?margin:-margin))][Math.floor(player.x)] >= 3) player.y = ny;

        let pxInt = Math.floor(player.x); let pyInt = Math.floor(player.y);
        
        if(map[pyInt][pxInt] === 3) { currentSub++; if(currentSub > 5) { currentSub=1; currentLevel++; } generateLevel(); }
        if(map[pyInt][pxInt] === 4) { window.openOverlay('portal-overlay'); player.x -= player.dirX * 0.5; player.y -= player.dirY * 0.5; }

        for(let i = entities.length - 1; i >= 0; i--) {
            let e = entities[i]; let dist = Math.sqrt((player.x - e.x)**2 + (player.y - e.y)**2);
            if(dist < 0.6) {
                if(e.isNPC) {
                    window.openOverlay('dialog-overlay');
                    document.getElementById('dialog-name').innerText = e.name; document.getElementById('dialog-text').innerText = `"${e.text}"`;
                    document.getElementById('dialog-actions').style.display = e.isHooker ? 'flex' : 'none';
                    player.x -= player.dirX * 0.5; player.y -= player.dirY * 0.5;
                }
                else if(!e.isEnemy) { if(window.addToInventory(e.id, 1)) { window.logMsg(`Zebrałeś: ${ITEM_DB[e.id].name}`); entities.splice(i, 1); } } 
                else { currentEnemy = e; window.openOverlay('combat-overlay'); document.getElementById('c-enemy-name').innerText = currentEnemy.name; window.updateCombatUI(); }
            }
            if(difficulty === 2 && e.isEnemy && Math.random() < 0.03) {
                let dx = Math.sign(player.x - e.x)*0.1; let dy = Math.sign(player.y - e.y)*0.1;
                if(map[Math.floor(e.y)][Math.floor(e.x+dx)] === 0) e.x += dx; if(map[Math.floor(e.y+dy)][Math.floor(e.x)] === 0) e.y += dy;
            }
        }
        render3D(ctx, map, entities, player, null, isSafeZone()); drawMinimap(mCtx, map, entities, player);
    }
    requestAnimationFrame(gameLoop);
}

window.payHooker = function() {
    if(player.coins >= 50) {
        player.coins -= 50; window.closeDialog();
        if(Math.random() < 0.5) { player.hp = player.maxHp; window.logMsg("Czysta Rozkosz. Odzyskujesz całe zdrowie!", "log-heal"); }
        else { player.maxHp -= 10; window.logMsg("Zaraziłeś się chorobą weneryczną! (-10 Max HP)", "log-dmg"); }
    } else alert("Brak 50 monet!");
};

window.levelUp = function() {
    if(player.xp >= player.reqXp) {
        player.xp -= player.reqXp; player.lvl++; player.reqXp = Math.floor(player.reqXp * 1.5);
        window.openOverlay('perk-overlay');
        let avail = PERKS.filter(p => !player.perks.includes(p.n)).sort(()=>0.5-Math.random()).slice(0,3);
        let html = ''; if(avail.length===0) html = "Masz już wszystko!";
        avail.forEach(p => { html += `<button class="btn green" style="height:100px;" onclick="window.takePerk('${p.id}')"><h3>${p.n}</h3><p style="font-size:11px;">${p.d}</p></button>`; });
        document.getElementById('perk-container').innerHTML = html; window.updateHUD();
    } else alert("Za mało XP!");
};
window.takePerk = function(id) {
    let perk = PERKS.find(p => p.id === id); perk.apply(player); player.perks.push(perk.n);
    window.closeAllOverlays(); window.logMsg("Zdobyto Perk: " + perk.n, "log-epic"); window.updateHUD();
};

window.updateWeaponView = function() { document.getElementById('weapon-view').innerText = player.weapon.sym; };
window.updateHUD = function() {
    document.getElementById('ui-class').innerText = player.cls; document.getElementById('ui-hp').innerText = Math.floor(player.hp); document.getElementById('ui-maxhp').innerText = player.maxHp;
    document.getElementById('ui-coins').innerText = player.coins; document.getElementById('ui-dlvl').innerText = `${currentLevel}-${currentSub}`; document.getElementById('ui-worldname').innerText = WORLDS[selectedWorld].title;
    document.getElementById('ch-lvl').innerText = player.lvl; document.getElementById('ch-xp').innerText = player.xp; document.getElementById('ch-req').innerText = player.reqXp;
    document.getElementById('ch-wep').innerText = player.weapon.name; document.getElementById('ch-helm').innerText = player.helm.name; document.getElementById('ch-arm').innerText = player.chest.name; document.getElementById('ch-pants').innerText = player.pants.name; document.getElementById('ch-boots').innerText = player.boots.name; document.getElementById('ch-belt').innerText = `${player.belt.name} (Max x${player.belt.cap})`; document.getElementById('ch-perks').innerText = player.perks.length > 0 ? player.perks.join(', ') : 'Brak';
    
    document.getElementById('ui-eq-helm').innerHTML = player.helm.sym; document.getElementById('ui-eq-chest').innerHTML = player.chest.sym; document.getElementById('ui-eq-pants').innerHTML = player.pants.sym; document.getElementById('ui-eq-boots').innerHTML = player.boots.sym; document.getElementById('ui-eq-wep').innerHTML = player.weapon.sym; document.getElementById('ui-eq-belt').innerHTML = player.belt.sym;
    
    let arm = player.baseArmor + player.helm.def + player.chest.def + player.pants.def + player.boots.def;
    let dmg = player.baseDmg + player.weapon.dmg + (player.activeEffects.includes('Haj') ? 20 : 0);
    document.getElementById('ch-def').innerText = arm; document.getElementById('ch-dmg').innerText = dmg;
}

window.openCrafting = function() {
    window.openOverlay('crafting-overlay'); let c = document.getElementById('craft-container'); c.innerHTML = '';
    RECIPES.forEach((r, idx) => { let reqStr = Object.entries(r.req).map(([k, v]) => `${ITEM_DB[k]?ITEM_DB[k].name:k}:${v}`).join(', '); c.innerHTML += `<div style="background:#8b8b8b; color:#111; padding:10px; border:2px solid #373737; font-weight:bold; cursor:pointer;" onclick="window.craft(${idx})"><b>${r.name}</b><br><span style="font-size:11px;">${reqStr}</span></div>`; });
};
window.craft = function(idx) {
    let r = RECIPES[idx]; let canCraft = true;
    for(let key in r.req) { if(window.getInvCount(key) < r.req[key]) canCraft = false; }
    if(canCraft) { 
        for(let key in r.req) window.removeInv(key, r.req[key]); 
        if(r.type === 'belt') player.belt = BELTS[r.val];
        if(r.type === 'wep') { player.weapon = WEAPONS[r.val]; window.updateWeaponView(); }
        if(r.type === 'helm') player.helm = HELMETS[r.val]; if(r.type === 'chest') player.chest = CHESTS[r.val];
        if(r.type === 'pants') player.pants = PANTS[r.val]; if(r.type === 'boots') player.boots = BOOTS[r.val];
        if(r.type === 'item') window.addToInventory(r.id, 1);
        window.logMsg("Wykuto przedmiot!"); window.updateHUD(); window.openCrafting();
    } else window.logMsg("Brak surowców!", "log-dmg");
};

window.travelToWorld = function(w) { selectedWorld = w; currentLevel++; currentSub = 1; window.closeAllOverlays(); window.logMsg("Portal przenosi cię!", "log-epic"); generateLevel(); };

window.updateCombatUI = function() { document.getElementById('c-enemy-hp-bar').style.width = Math.max(0, (currentEnemy.hp / currentEnemy.maxHp) * 100) + '%'; document.getElementById('c-player-hp-bar').style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%'; document.getElementById('c-player-hp-text').innerText = Math.floor(player.hp); }

window.combatAction = function(action) {
    let wep = document.getElementById('weapon-view'); wep.classList.add('attacking'); setTimeout(() => wep.classList.remove('attacking'), 200);
    let dmg = player.baseDmg + player.weapon.dmg + (player.activeEffects.includes('Haj') ? 20 : 0); 
    let arm = player.baseArmor + player.helm.def + player.chest.def + player.pants.def + player.boots.def;

    if(action === 'Zwykly') { currentEnemy.hp -= dmg; window.logMsg(`Zadajesz ${dmg} obr.`); }
    if(action === 'Silny') { if(Math.random()<0.5) { currentEnemy.hp -= dmg*2; window.logMsg(`KRYTYK! ${dmg*2} obr!`, "log-epic"); } else window.logMsg("Pudło!", "log-dmg"); }
    if(action === 'Bomba') { if(window.removeInv('bomb', 1)) { currentEnemy.hp -= 100; window.logMsg("BUM!"); } else return; }
    if(action === 'Mikstura') { if(window.removeInv('pot', 1)) { player.hp = Math.min(player.maxHp, player.hp+50); window.logMsg("Leczysz się."); } else return; }
    
    if(currentEnemy.hp <= 0) { 
        window.logMsg(`Zwycięstwo! +25 mon, +30 XP`, "log-heal"); player.coins += 25; player.xp += 30;
        if(currentEnemy.loot) window.addToInventory(currentEnemy.loot, 1);
        if(player.perks.includes("Wampiryzm")) player.hp = Math.min(player.maxHp, player.hp + 20);
        entities.splice(entities.indexOf(currentEnemy), 1); window.closeAllOverlays(); currentEnemy = null; window.updateHUD(); return; 
    }
    
    let enemyDmg = Math.max(1, (currentEnemy.dmg + Math.floor(Math.random()*5)) - arm); player.hp -= enemyDmg; window.logMsg(`Otrzymujesz ${enemyDmg} obr!`, "log-dmg"); 
    if(player.hp <= 0) { player.hp = 0; handleDeath(); } else { window.updateCombatUI(); window.updateHUD(); }
}

function handleDeath() {
    let loss = difficulty === 1 ? 0.25 : (difficulty === 2 ? 0.50 : 0.75);
    player.inventory.forEach((item, idx) => { if(item) { item.count = Math.floor(item.count * (1 - loss)); if(item.count <= 0) player.inventory[idx] = null; } });
    player.hp = player.maxHp; player.x = Math.floor(MAP_SIZE/2) + 0.5; player.y = Math.floor(MAP_SIZE/2) + 0.5;
    window.logMsg(`💀 ZGINĄŁEŚ! Tracisz ${loss*100}% plecaka.`, "log-dmg");
    window.updateInventoryUI(); window.updateHUD(); window.closeAllOverlays(); currentEnemy = null;
}

window.addEventListener('keydown', e => { 
    let k = e.key.toLowerCase(); if(keys.hasOwnProperty(k)) keys[k] = true; 
    if(k==='e' && state==='EXPLORE') { window.openOverlay('inventory-overlay'); window.updateInventoryUI(); window.updateHUD(); keys={w:false,a:false,s:false,d:false};}
    else if(k==='e' && state==='MENU') { window.closeAllOverlays(); }
    if(!isNaN(k) && k>0 && k<=9 && state==='EXPLORE') window.selectSlot(k-1);
});
window.addEventListener('keyup', e => { let k = e.key.toLowerCase(); if(keys.hasOwnProperty(k)) keys[k] = false; });
window.addEventListener('mousedown', () => { if(state === 'EXPLORE') { let wep = document.getElementById('weapon-view'); wep.classList.add('attacking'); setTimeout(() => wep.classList.remove('attacking'), 200); }});
