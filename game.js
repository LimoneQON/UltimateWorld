// === BAZY DANYCH ===
const ITEM_DB = {
    'wood': { sym: '🪵', name: 'Drewno' },
    'steel': { sym: '⛓️', name: 'Stal' },
    'fire': { sym: '🔥', name: 'Ogień' },
    'magic': { sym: '✨', name: 'Magia' },
    'pot': { sym: '🧪', name: 'Mikstura (Leczy 50HP)', use: p => { p.hp=Math.min(p.maxHp, p.hp+50); logMsg("Leczysz się.","log-heal"); } },
    'bomb': { sym: '💣', name: 'Bomba (100 Dmg)' },
    'key': { sym: '🔑', name: 'Klucz (Brązowe Drzwi)' }
};

const WORLDS = {
    human: { title: "Ludzkie Królestwa", tex: 'tex-human', mobs: [ {n: "Wilk", s: "🐺", hp: 30, d: 8}, {n: "Goblin", s: "👺", hp: 40, d: 12} ] },
    elf: { title: "Świat Elfów", tex: 'tex-elf', mobs: [ {n: "Strażnik", s: "🧝", hp: 45, d: 10}, {n: "Wróżka", s: "🧚", hp: 20, d: 15} ] },
    dwarf: { title: "Krasnoludy", tex: 'tex-dwarf', mobs: [ {n: "Krasnolud", s: "🧔", hp: 60, d: 15}, {n: "Golem", s: "🗿", hp: 120, d: 25} ] },
    homunculus: { title: "Laboratoria", tex: 'tex-human', mobs: [ {n: "Zmutowany Szczur", s: "🐀", hp: 35, d: 15} ] }
};

// === STAN GRY ===
const TILE_SIZE = 300;
const MAP_SIZE = 16;
const T_WALL = 1, T_FLOOR = 0, T_DOOR = 2, T_EXIT = 3, T_PORTAL = 4, T_MEGA_PORTAL = 5;
const DIRS = [ {dx: 0, dz: -1}, {dx: 1, dz: 0}, {dx: 0, dz: 1}, {dx: -1, dz: 0} ];

let map = [], entities = [], logs = [];
let state = 'MENU', difficulty = 1, currentLevel = 1, selectedWorld = 'human';
let currentEnemy = null, monsterInterval = null;

let player = {
    x: 1, z: 1, dir: 1, angle: 90, hp: 100, maxHp: 100, dmg: 10,
    inventory: new Array(29).fill(null), // 9 Hotbar + 20 Plecak
    selectedSlot: 0
};

// Lokalny zapis kont
window.loginAccount = () => { document.getElementById('login-screen').style.display = 'none'; document.getElementById('main-menu').style.display = 'flex'; };
window.registerAccount = () => { alert("Zarejestrowano pomyślnie. Zaloguj się."); };

// --- LOGIKA MINECRAFTOWEGO EKWIPUNKU ---
function addToInventory(id, amount) {
    let maxStack = 10; let remaining = amount;
    // 1. Szukaj otwartego stacka
    for(let i=0; i<player.inventory.length; i++) {
        if(player.inventory[i] && player.inventory[i].id === id && player.inventory[i].count < maxStack) {
            let space = maxStack - player.inventory[i].count;
            if(remaining <= space) { player.inventory[i].count += remaining; updateInventoryUI(); return true; }
            else { player.inventory[i].count = maxStack; remaining -= space; }
        }
    }
    // 2. Szukaj pustego slota
    for(let i=0; i<player.inventory.length; i++) {
        if(!player.inventory[i]) {
            player.inventory[i] = {id: id, count: remaining}; updateInventoryUI(); return true;
        }
    }
    logMsg("Brak miejsca w plecaku!", "log-dmg"); return false;
}

function removeFromInventory(id, amount) {
    for(let i = player.inventory.length - 1; i >= 0; i--) {
        if(player.inventory[i] && player.inventory[i].id === id) {
            if(player.inventory[i].count >= amount) {
                player.inventory[i].count -= amount;
                if(player.inventory[i].count === 0) player.inventory[i] = null;
                updateInventoryUI(); return true;
            }
        }
    }
    return false;
}

function updateInventoryUI() {
    let hotbarHTML = ''; let mainHTML = '';
    for(let i=0; i<player.inventory.length; i++) {
        let item = player.inventory[i];
        let sym = item ? ITEM_DB[item.id].sym : '';
        let cnt = item ? `<div class="inv-count">${item.count}</div>` : '';
        let html = `<div class="inv-slot ${i === player.selectedSlot ? 'active' : ''}" onclick="window.selectSlot(${i})">${sym}${cnt}</div>`;
        if(i < 9) hotbarHTML += html; else mainHTML += html;
    }
    document.getElementById('inv-hotbar').innerHTML = hotbarHTML;
    document.getElementById('inv-grid-main').innerHTML = mainHTML;
}

window.selectSlot = (idx) => {
    player.selectedSlot = idx;
    let item = player.inventory[idx];
    if(item && ITEM_DB[item.id].use) {
        ITEM_DB[item.id].use(player);
        item.count--; if(item.count <= 0) player.inventory[idx] = null;
    }
    updateInventoryUI(); document.getElementById('ui-hp').innerText = player.hp;
};

// --- SILNIK GRY ---
window.startGameSingle = () => {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-view').style.display = 'block';
    state = 'EXPLORE';
    difficulty = parseInt(document.getElementById('diff-selector').value);
    
    player.inventory.fill(null);
    addToInventory('pot', 3); addToInventory('bomb', 1);

    generateLevel();
    
    if(difficulty > 1) {
        monsterInterval = setInterval(() => {
            if(state === 'EXPLORE') { moveMonsters(); buildCSS3D(); drawMinimap(); }
        }, difficulty === 3 ? 800 : 1500);
    }
};

function generateLevel() {
    map = []; entities = [];
    for(let y=0; y<MAP_SIZE; y++) { map[y] = []; for(let x=0; x<MAP_SIZE; x++) map[y][x] = T_WALL; }
    player.x = Math.floor(MAP_SIZE/2); player.z = Math.floor(MAP_SIZE/2); map[player.z][player.x] = T_FLOOR;

    let floorCount = 0;
    while(floorCount < 100) {
        let d = Math.floor(Math.random()*4);
        if(d===0 && player.z>2) player.z--; else if(d===1 && player.z<MAP_SIZE-3) player.z++;
        else if(d===2 && player.x>2) player.x--; else if(d===3 && player.x<MAP_SIZE-3) player.x++;
        if(map[player.z][player.x] === T_WALL) { map[player.z][player.x] = T_FLOOR; floorCount++; }
    }
    
    player.x = Math.floor(MAP_SIZE/2); player.z = Math.floor(MAP_SIZE/2); player.dir = 0; player.angle = 0;
    
    // Generowanie obiektów
    let empty = () => { while(true) { let x=Math.floor(Math.random()*MAP_SIZE), z=Math.floor(Math.random()*MAP_SIZE); if(map[z][x]===T_FLOOR) return {x,z}; } };
    
    let ex = empty(); map[ex.z][ex.x] = T_EXIT;
    let pm = empty(); map[pm.z][pm.x] = T_MEGA_PORTAL;

    for(let i=0; i<3; i++) { let p=empty(); entities.push({x:p.x, z:p.z, sym: '🧪', id: 'pot'}); }
    for(let i=0; i<2; i++) { let p=empty(); entities.push({x:p.x, z:p.z, sym: '🔑', id: 'key'}); }
    for(let i=0; i<5; i++) { let p=empty(); entities.push({x:p.x, z:p.z, sym: '🪵', id: 'wood'}); }
    for(let i=0; i<5; i++) {
        let p = empty(); let mob = WORLDS[selectedWorld].mobs[Math.floor(Math.random()*2)];
        entities.push({x:p.x, z:p.z, sym: mob.s, isEnemy: true, name: mob.n, hp: mob.hp, maxHp: mob.hp, dmg: mob.d});
    }

    document.getElementById('ui-dlvl').innerText = currentLevel;
    document.getElementById('ui-worldname').innerText = WORLDS[selectedWorld].title;
    buildCSS3D(); drawMinimap(); updateInventoryUI();
}

// --- RENDEROWANIE CSS 3D ---
function buildCSS3D() {
    let world = document.getElementById('world');
    world.innerHTML = ''; // Czyścimy stary świat
    let texClass = WORLDS[selectedWorld].tex;

    for(let z=0; z<MAP_SIZE; z++) {
        for(let x=0; x<MAP_SIZE; x++) {
            if(map[z][x] !== T_FLOOR) {
                // Tylko renderuj ściany obok pustych pół dla optymalizacji
                let isWall = map[z][x] === T_WALL;
                let c = document.createElement('div');
                c.className = `wall ${isWall ? texClass : ''}`;
                if(map[z][x] === T_PORTAL) c.classList.add('tex-portal');
                if(map[z][x] === T_MEGA_PORTAL) { c.classList.add('tex-portal'); c.innerHTML = "<h1 style='color:#fff; text-align:center; line-height:300px;'>WYMIAR</h1>"; }
                if(map[z][x] === T_EXIT) { c.classList.add('tex-exit'); c.innerHTML = "WYJŚCIE"; }
                if(map[z][x] === T_DOOR) c.classList.add('tex-door');
                
                // Rotacja frontu kostki tak by patrzyła na gracza (uproszczenie)
                c.style.transform = `translate3d(${x*TILE_SIZE}px, 0, ${z*TILE_SIZE}px) rotateY(0deg) translateZ(${TILE_SIZE/2}px)`;
                world.appendChild(c);
            }
        }
    }

    // Dodanie potworów i itemów jako Billboardy (płaskie sprite'y patrzące w kamerę)
    entities.forEach(e => {
        let s = document.createElement('div');
        s.className = 'sprite';
        s.innerHTML = e.sym;
        // Obracamy billboard zawsze o -player.angle, żeby patrzył na kamerę
        s.style.transform = `translate3d(${e.x*TILE_SIZE}px, 0, ${e.z*TILE_SIZE}px) rotateY(${player.angle}deg)`;
        world.appendChild(s);
    });

    updateCamera();
}

function updateCamera() {
    // Obracamy cały świat wokół kamery
    let px = player.x * TILE_SIZE;
    let pz = player.z * TILE_SIZE;
    let rot = player.angle;
    // Kamera CSS 3D "Wiedźmin effect" - gładkie przejścia realizowane przez CSS `transition`
    document.getElementById('world').style.transform = `translateZ(400px) rotateY(${-rot}deg) translate3d(${-px}px, 0, ${-pz}px)`;
}

function drawMinimap() {
    mCtx.fillStyle = '#0a0a0f'; mCtx.fillRect(0, 0, minimap.width, minimap.height);
    for(let z=0; z<MAP_SIZE; z++) {
        for(let x=0; x<MAP_SIZE; x++) {
            if(map[z][x] === T_FLOOR) mCtx.fillStyle = '#334'; else if(map[z][x]===T_EXIT) mCtx.fillStyle='#aaa'; else if(map[z][x]===T_MEGA_PORTAL) mCtx.fillStyle='#0ff'; else continue;
            mCtx.fillRect(x*TILE_SIZE/MAP_SIZE, z*TILE_SIZE/MAP_SIZE, TILE_SIZE/MAP_SIZE+0.5, TILE_SIZE/MAP_SIZE+0.5);
        }
    }
    entities.forEach(e => { mCtx.fillStyle = e.isEnemy ? '#f33' : '#da0'; mCtx.fillRect(e.x*TILE_SIZE/MAP_SIZE, e.z*TILE_SIZE/MAP_SIZE, 3, 3); });
    
    // Gracz
    mCtx.save(); mCtx.translate(player.x * TILE_SIZE/MAP_SIZE + 2, player.z * TILE_SIZE/MAP_SIZE + 2); mCtx.rotate(player.dir * Math.PI/2); 
    mCtx.fillStyle = '#5f5'; mCtx.beginPath(); mCtx.moveTo(0, -3); mCtx.lineTo(3, 3); mCtx.lineTo(-3, 3); mCtx.fill(); mCtx.restore();
}

// --- RUCH I INTERAKCJA ---
function moveMonsters() {
    entities.forEach(e => {
        if(e.isEnemy) { 
            let dx = Math.sign(player.x - e.x); let dz = Math.sign(player.z - e.z);
            if(Math.random()>0.5 && dx!==0 && map[e.z][e.x+dx]===T_FLOOR && !(e.x+dx===player.x && e.z===player.z)) e.x += dx;
            else if(dz!==0 && map[e.z+dz][e.x]===T_FLOOR && !(e.x===player.x && e.z+dz===player.z)) e.z += dz;
            
            // Kolizja w czasie rzeczywistym
            if(e.x === player.x && e.z === player.z) {
                currentEnemy = e; state = 'COMBAT'; document.getElementById('combat-overlay').style.display = 'flex';
                document.getElementById('c-enemy-name').innerText = currentEnemy.name;
                document.getElementById('enemy-sprite').innerText = currentEnemy.sym;
            }
        }
    });
}

function logMsg(msg, type='log-new') { logs.unshift(`<span class="${type}">• ${msg}</span><br>`); if(logs.length > 5) logs.pop(); document.getElementById('log').innerHTML = logs.join(''); }

window.movePlayer = (moveType) => {
    if(state !== 'EXPLORE') return;
    if(moveType === 'LEFT') { player.dir = (player.dir + 3) % 4; player.angle -= 90; }
    if(moveType === 'RIGHT') { player.dir = (player.dir + 1) % 4; player.angle += 90; }
    
    if(moveType === 'FORWARD' || moveType === 'BACK') {
        let vec = DIRS[player.dir]; let sign = moveType === 'FORWARD' ? 1 : -1;
        let nx = player.x + vec.dx * sign; let nz = player.z + vec.dz * sign;
        
        let t = map[nz][nx];
        if(t !== T_WALL && t !== T_DOOR) {
            if(t === T_EXIT) { currentLevel++; generateLevel(); return; }
            if(t === T_MEGA_PORTAL) { document.getElementById('portal-overlay').style.display = 'flex'; state = 'PORTAL'; return; }
            
            player.x = nx; player.z = nz;
            
            let entIdx = entities.findIndex(e => e.x === nx && e.z === nz);
            if(entIdx !== -1) {
                let e = entities[entIdx];
                if(!e.isEnemy) {
                    if(addToInventory(e.id, 1)) { logMsg(`Zebrałeś: ${ITEM_DB[e.id].name}`, "log-new"); entities.splice(entIdx, 1); }
                } else {
                    currentEnemy = e; state = 'COMBAT'; document.getElementById('combat-overlay').style.display = 'flex';
                    document.getElementById('c-enemy-name').innerText = currentEnemy.name; document.getElementById('enemy-sprite').innerText = currentEnemy.sym;
                }
            }
        }
    }
    buildCSS3D(); drawMinimap(); // BuildCSS potrzebny żeby przesunąć billboardy
}

// Obsługa Klawiatury (Hotbar i Poruszanie)
window.addEventListener('keydown', (e) => {
    if(state === 'EXPLORE') {
        let k = e.key.toLowerCase();
        if(k === 'w' || e.code === 'ArrowUp') movePlayer('FORWARD');
        if(k === 's' || e.code === 'ArrowDown') movePlayer('BACK');
        if(k === 'a' || e.code === 'ArrowLeft') movePlayer('LEFT');
        if(k === 'd' || e.code === 'ArrowRight') movePlayer('RIGHT');
        if(k === 'e') { state = 'INV'; document.getElementById('inventory-overlay').style.display = 'flex'; updateInventoryUI(); }
        
        // Klawisze numeryczne do Hotbara
        if(!isNaN(k) && k > 0 && k <= 9) { window.selectSlot(k - 1); }
    } else if(e.key.toLowerCase() === 'e' && state === 'INV') {
        state = 'EXPLORE'; document.getElementById('inventory-overlay').style.display = 'none';
    }
});

// --- WALKA ---
window.combatAction = (action) => {
    let dmg = player.dmg;
    if(action === 'Zwykly') { currentEnemy.hp -= dmg; logMsg(`Zadajesz ${dmg} obr.`); }
    if(action === 'Silny') { if(Math.random()<0.5) { currentEnemy.hp -= dmg*2; logMsg(`KRYTYK! ${dmg*2} obr!`, "log-epic"); } else logMsg("Pudło!", "log-dmg"); }
    if(action === 'Bomba') { if(removeFromInventory('bomb', 1)) { currentEnemy.hp -= 100; logMsg("BUM! 100 obr!"); } else logMsg("Brak bomb!"); }
    if(action === 'Mikstura') { if(removeFromInventory('pot', 1)) { player.hp += 50; logMsg("Leczysz się."); } }
    if(action === 'Ucieczka') { if(Math.random()<0.5) { state='EXPLORE'; document.getElementById('combat-overlay').style.display='none'; return; } else logMsg("Ucieczka nieudana!"); }

    if(currentEnemy.hp <= 0) {
        logMsg("Pokonano wroga!", "log-heal");
        entities.splice(entities.findIndex(e => e === currentEnemy), 1);
        state = 'EXPLORE'; document.getElementById('combat-overlay').style.display = 'none'; currentEnemy = null; buildCSS3D(); drawMinimap(); return;
    }

    player.hp -= currentEnemy.dmg; logMsg(`Otrzymujesz ${currentEnemy.dmg} obr!`, "log-dmg");
    document.getElementById('c-enemy-hp-bar').style.width = Math.max(0, (currentEnemy.hp / currentEnemy.maxHp) * 100) + '%'; 
    document.getElementById('c-player-hp-bar').style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%'; 
    document.getElementById('c-player-hp-text').innerText = player.hp;
    document.getElementById('ui-hp').innerText = player.hp;

    if(player.hp <= 0) { alert("ZGINĄŁEŚ! GRA SKOŃCZONA."); location.reload(); }
};

window.travelToWorld = (w) => { selectedWorld = w; currentLevel++; document.getElementById('portal-overlay').style.display='none'; state='EXPLORE'; generateLevel(); }
</script>
</body>
</html>
