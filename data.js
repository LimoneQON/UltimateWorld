export const MAP_SIZE = 24; 
export const INV_SIZE = 20;

export const ITEM_DB = {
    'wood': { sym: '🪵', name: 'Drewno' },
    'steel': { sym: '⛓️', name: 'Stal' },
    'fire': { sym: '🔥', name: 'Ogień' },
    'pot': { sym: '🧪', name: 'Mikstura HP', use: true },
    'bomb': { sym: '💣', name: 'Bomba', use: false }
};

export const WEAPONS = [ {name: "Pięści", sym: "👊", dmg: 5}, {name: "Miecz", sym: "🗡️", dmg: 15}, {name: "Topór", sym: "🪓", dmg: 35}, {name: "Kij Maga", sym: "🪄", dmg: 60} ];
export const ARMORS = [ {name: "Szmaty", def: 0}, {name: "Zbroja", def: 15}, {name: "Mithril", def: 40} ];
export const BELTS = [ {name: "Brak", cap: 5}, {name: "Pas", cap: 15}, {name: "Pas Tytanów", cap: 50} ];

export const MOBS = [ {n: "Wilk", s: "🐺", hp: 30, d: 8}, {n: "Goblin", s: "👺", hp: 40, d: 12}, {n: "Demon", s: "👿", hp: 100, d: 25} ];

export const RECIPES = [
    {name: "Skórzany Pas (Max Stack x15)", req: {wood: 5}, type: 'belt'},
    {name: "Miecz (+15 Dmg)", req: {steel: 3, wood: 1}, type: 'wep', val: 1},
    {name: "Topór (+35 Dmg)", req: {steel: 10, fire: 5}, type: 'wep', val: 2},
    {name: "Zbroja (+15 Def)", req: {steel: 8}, type: 'arm', val: 1},
    {name: "Mikstura Leczenia", req: {wood: 1}, type: 'item', id: 'pot'},
    {name: "Bomba", req: {fire: 2, steel: 1}, type: 'item', id: 'bomb'}
];
