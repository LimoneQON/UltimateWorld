export const MAP_SIZE = 20; 
export const TILE_SIZE = 300;
export const INV_SIZE = 20; // 9 hotbar + 11 eq
export const T_WALL = 1, T_FLOOR = 0, T_EXIT = 3, T_PORTAL = 4;

export const ITEM_DB = {
    'wood': { sym: '🪵', name: 'Drewno' },
    'steel': { sym: '⛓️', name: 'Stal' },
    'fire': { sym: '🔥', name: 'Ogień' },
    'pot': { sym: '🧪', name: 'Mikstura HP', use: (p)=>{ p.hp=Math.min(p.maxHp, p.hp+50); window.logMsg("Leczysz 50 HP.","log-heal"); } },
    'bomb': { sym: '💣', name: 'Bomba' }
};

export const WEAPONS = [ 
    {name: "Pięści", sym: "👊", dmg: 5}, 
    {name: "Stalowy Miecz", sym: "🗡️", dmg: 15}, 
    {name: "Topór", sym: "🪓", dmg: 35}, 
    {name: "Kij Maga", sym: "🪄", dmg: 60} 
];

export const ARMORS = [ {name: "Szmaty", def: 0}, {name: "Żelazna Zbroja", def: 15}, {name: "Mithril", def: 40} ];
export const BELTS = [ {name: "Brak", cap: 5}, {name: "Skórzany Pas", cap: 15}, {name: "Pas Tytanów", cap: 50} ];

export const RECIPES = [
    {name: "Skórzany Pas (Max Stack x15)", req: {wood: 5}, action: (p)=>{ p.belt = BELTS[1]; window.logMsg("Masz lepszy pas!"); }},
    {name: "Stalowy Miecz (+15 Dmg)", req: {steel: 3, wood: 1}, action: (p)=>{ p.weapon = WEAPONS[1]; window.updateWeaponView(); window.logMsg("Wykuto Miecz!"); }},
    {name: "Topór (+35 Dmg)", req: {steel: 10, fire: 5}, action: (p)=>{ p.weapon = WEAPONS[2]; window.updateWeaponView(); window.logMsg("Wykuto Topór!"); }},
    {name: "Żelazna Zbroja (+15 Def)", req: {steel: 8}, action: (p)=>{ p.armor = ARMORS[1]; window.logMsg("Wykuto Zbroję!"); }},
    {name: "Mikstura Leczenia", req: {wood: 2}, action: (p)=>{ window.addToInventory('pot', 1); window.logMsg("Uwarzono Miksturę!"); }},
    {name: "Bomba Obszarowa", req: {fire: 2, steel: 1}, action: (p)=>{ window.addToInventory('bomb', 1); window.logMsg("Zbudowano Bombę!"); }}
];

export const MOBS = [ {n: "Wilk", s: "🐺", hp: 30, d: 8}, {n: "Goblin", s: "👺", hp: 40, d: 12}, {n: "Demon", s: "👿", hp: 100, d: 25} ];
