import { WEAPONS, ARMORS, WORLDS, PERKS, DIRS } from './data.js';
import { draw3D } from './engine.js';

// Global State
let player = {}, MATS = { wood: 0, steel: 0, magic: 0, fire: 0 };
let map = [], entities = [], logs = [];
let state = 'EXPLORE', currentLevel = 1, currentBiomeIndex = 0, selectedWorld = 'human';
let currentUser = null, is18Plus = false, diffMult = 1.0;
let isMultiplayer = false, isHost = false, conn = null, otherPlayer = null;
let currentEnemy = null;

const canvas = document.getElementById('view3d'); const ctx = canvas.getContext('2d');
const MAP_SIZE = 24; const T_WALL = 1, T_FLOOR = 0, T_DOOR = 2, T_EXIT = 3, T_PORTAL = 4, T_MEGA_PORTAL = 5;

// API Eksportowane do HTML (onClick events)
window.loginAccount = () => { currentUser = document.getElementById('acc-username').value; document.getElementById('login-screen').style.display = 'none'; document.getElementById('main-menu').style.display = 'flex'; };
window.registerAccount = () => { alert("Zarejestrowano pomyślnie. Zaloguj się!"); };
window.openCharSelection = (mode) => { window.mpMode = mode; document.getElementById('main-menu').style.display='none'; document.getElementById('char-select').style.display='flex'; };

window.selectHero = (name, cls, baseHp, baseDmg) => {
    player = { name: name, class: cls, hp: baseHp, maxHp: baseHp, lvl: 1, coins: 0, keys: 0, levelCost: 20, baseDmg: baseDmg, baseArmor: 0, weapon: WEAPONS[0], armor: ARMORS[0], inv: { pots: 2, teles: 1, bombs: 1, vodka: 0, drugs: 0, ovaries: 0 }, effects: [], companion: null, alimony: false, activePerkIds: [], perksList: [] };
    document.getElementById('char-select').style.display = 'none';
    startGameFlow();
};

function startGameFlow() {
    is18Plus = document.getElementById('mode-18plus').checked;
    document.getElementById('game-wrapper').style.display = 'flex';
    document.getElementById('ui-worldname').innerText = WORLDS[selectedWorld].title;
    logMsg("Witaj " + player.name + "! Zaczynamy przygodę.");
    generateLevel(); updateAll();
}

function generateLevel() {
    map = []; entities = [];
    for(let y=0; y<MAP_SIZE; y++) { map[y] = []; for(let x=0; x<MAP_SIZE; x++) map[y][x] = T_WALL; }
    player.x = Math.floor(MAP_SIZE/2); player.y = Math.floor(MAP_SIZE/2); player.dir = 0; map[player.y][player.x] = T_FLOOR;
    
    let floorCount = 0;
    while(floorCount < 180) {
        let d = Math.floor(Math.random()*4);
        if(d===0 && player.y>2) player.y--; else if(d===1 && player.y<MAP_SIZE-3) player.y++;
        else if(d===2 && player.x>2) player.x--; else if(d===3 && player.x<MAP_SIZE-3) player.x++;
        if(map[player.y][player.x] === T_WALL) { map[player.y][player.x] = T_FLOOR; floorCount++; }
    }
    
    // Reset pozycji startowej gracza po generowaniu
    player.x = Math.floor(MAP_SIZE/2); player.y = Math.floor(MAP_SIZE/2);
    
    currentBiomeIndex = Math.floor(Math.random() * WORLDS[selectedWorld].biomes.length);
    placeEntity('🧪', 2, {type: 'pot'}); placeEntity('👺', 5, {isEnemy: true, name: "Potwór", hp: 50, maxHp: 50, dmg: 10, drops:[{type:'coin', val:10}]});
    // Możesz tu łatwo dodać pętle generującą konkretne obiekty z `data.js`
}

function getEmptyFloor() {
    while(true) { let x = Math.floor(Math.random()*MAP_SIZE); let y = Math.floor(Math.random()*MAP_SIZE); if(map[y][x] === T_FLOOR) return {x, y}; }
}
function placeEntity(sym, count, data) { for(let i=0; i<count; i++) { let p = getEmptyFloor(); entities.push({x: p.x, y: p.y, symbol: sym, ...data}); } }

window.movePlayer = (moveType) => {
    if(state !== 'EXPLORE') return;
    if(moveType === 'LEFT') player.dir = (player.dir + 3) % 4; if(moveType === 'RIGHT') player.dir = (player.dir + 1) % 4;
    if(moveType === 'FORWARD' || moveType === 'BACK') {
        let vec = DIRS[player.dir]; let sign = moveType === 'FORWARD' ? 1 : -1;
        let nx = player.x + vec.dx * sign; let ny = player.y + vec.dy * sign;
        if(map[ny][nx] !== T_WALL) {
            player.x = nx; player.y = ny;
            let entIdx = entities.findIndex(e => e.x === nx && e.y === ny);
            if(entIdx !== -1) {
                let e = entities[entIdx];
                if(!e.isEnemy) { player.inv.pots++; logMsg("Zebrałeś przedmiot!"); entities.splice(entIdx, 1); }
                else { currentEnemy = e; state = 'COMBAT'; document.getElementById('combat-screen').style.display = 'flex'; }
            }
        }
    }
    updateAll();
};

window.combatAction = (action) => {
    if(action === 'Zwykly') { currentEnemy.hp -= player.baseDmg + player.weapon.dmg; }
    if(currentEnemy.hp <= 0) {
        logMsg("Pokonałeś wroga!"); state = 'EXPLORE'; document.getElementById('combat-screen').style.display = 'none';
        entities.splice(entities.findIndex(e => e === currentEnemy), 1); currentEnemy = null;
    } else { player.hp -= currentEnemy.dmg; if(player.hp <= 0) alert("Zginąłeś!"); }
    updateAll();
};

function logMsg(msg) { logs.unshift(`<div>${msg}</div>`); if(logs.length > 5) logs.pop(); document.getElementById('log').innerHTML = logs.join(''); }
function updateAll() { 
    if(state === 'EXPLORE') draw3D(ctx, player, map, entities, selectedWorld, currentBiomeIndex, null, isMultiplayer, otherPlayer); 
    document.getElementById('ui-hp').innerText = player.hp;
}

// Dodanie sterowania klawiaturą
window.addEventListener('keydown', (e) => {
    let k = e.key.toLowerCase();
    if(state === 'EXPLORE') {
        if(k === 'w' || e.code === 'ArrowUp') window.movePlayer('FORWARD');
        if(k === 's' || e.code === 'ArrowDown') window.movePlayer('BACK');
        if(k === 'a' || e.code === 'ArrowLeft') window.movePlayer('LEFT');
        if(k === 'd' || e.code === 'ArrowRight') window.movePlayer('RIGHT');
    } 
});
