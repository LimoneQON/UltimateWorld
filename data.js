export const MAP_SIZE = 24; 
export const INV_SIZE = 20;

export const ITEM_DB = {
    'wood': { sym: '🪵', name: 'Drewno' },
    'steel': { sym: '⛓️', name: 'Stal' },
    'fire': { sym: '🔥', name: 'Ogień' },
    'pot': { sym: '🧪', name: 'Mikstura HP', use: true },
    'bomb': { sym: '💣', name: 'Bomba', use: false }
};

export const HEROES = [
    {name: "Michał Kutas", cls: "Wojownik", hp: 150, dmg: 15},
    {name: "Dżon Pinat", cls: "Mag", hp: 60, dmg: 35},
    {name: "Gibki Gibek", cls: "Łotr", hp: 90, dmg: 25},
    {name: "Paskalito", cls: "Łucznik", hp: 80, dmg: 30}
];

export const WEAPONS = [ {name: "Pięści", sym: "👊", dmg: 0}, {name: "Miecz", sym: "🗡️", dmg: 15}, {name: "Topór", sym: "🪓", dmg: 35}, {name: "Kij Maga", sym: "🪄", dmg: 60} ];
export const ARMORS = [ {name: "Szmaty", def: 0}, {name: "Zbroja", def: 15}, {name: "Mithril", def: 40} ];
export const BELTS = [ {name: "Brak", cap: 5}, {name: "Pas", cap: 15}, {name: "Pas Tytanów", cap: 50} ];

export const MOBS = [ {n: "Wilk", s: "🐺", hp: 30, d: 8}, {n: "Goblin", s: "👺", hp: 40, d: 12}, {n: "Demon", s: "👿", hp: 100, d: 25} ];

export const NPC_POOL = [
    {n: "Piotr 'Ciepły'", s: "🧔", text: "Uważaj! Rzymianie-Żydzi to tylko uśpieni Administratorzy symulacji! Znajdź kod źródłowy na dnie!"},
    {n: "Gotka Oliwia 'Tom'", s: "🧛‍♀️", text: "Myślisz, że stąd uciekniesz? Homunkulusy z laboratoriów to błędy systemu zżerające pamięć RAM."},
    {n: "Bułka Zulczyk", s: "🍞", text: "Cześć podróżniku. Wiesz, że kiedy dojdziesz na dno, czeka nas Format Dysku? Zrób zapasy."},
    {n: "Tajemniczy Błąd", s: "👁️", text: "Aby zatrzymać symulację, połącz magię z technologią... Zmiażdż Homunkulusa."}
];

export const RECIPES = [
    {name: "Skórzany Pas (Max Stack x15)", req: {wood: 5}, type: 'belt'},
    {name: "Miecz (+15 Dmg)", req: {steel: 3, wood: 1}, type: 'wep', val: 1},
    {name: "Topór (+35 Dmg)", req: {steel: 10, fire: 5}, type: 'wep', val: 2},
    {name: "Zbroja (+15 Def)", req: {steel: 8}, type: 'arm', val: 1},
    {name: "Mikstura Leczenia", req: {wood: 1}, type: 'item', id: 'pot'},
    {name: "Bomba", req: {fire: 2, steel: 1}, type: 'item', id: 'bomb'}
];
