export const WEAPONS = [ {name: "Pięści", dmg: 0, rar: 1}, {name: "Skarpety na ręce", dmg: 1, rar: 1}, {name: "Sztylet", dmg: 3, rar: 1}, {name: "Drewniana Pałka", dmg: 5, rar: 1}, {name: "Stalowy Miecz", dmg: 12, rar: 2}, {name: "Elficki Łuk", dmg: 25, rar: 3}, {name: "Ognisty Miecz", dmg: 35, rar: 3}, {name: "Krasnoludzki Topór", dmg: 45, rar: 4}, {name: "Młot Tytanów", dmg: 130, rar: 4}, {name: "Ostrze Nieskończoności", dmg: 200, rar: 4} ];
export const ARMORS = [ {name: "Szmaty", def: 0, rar: 1}, {name: "Skórzana Kurta", def: 3, rar: 1}, {name: "Żelazny Pancerz", def: 12, rar: 2}, {name: "Zbroja Maga", def: 18, rar: 3}, {name: "Pancerz Golema", def: 35, rar: 4}, {name: "Mithrilowa Zbroja", def: 75, rar: 4}, {name: "Aura Niewidzialności", def: 200, rar: 4} ];

export const WORLDS = {
    human: { title: "Ludzkie Królestwa", biomes: [ {name: "🌲 MROCZNY LAS", wall: '#1b3311', floor: '#0f1f09', door: '#4a2f1d', exitText: "SCHODY"}, {name: "🧱 ZAPOMNIANE LOCHY", wall: '#2a2a35', floor: '#1a1a22', door: '#3a2218', exitText: "WROTA"} ], mobs: [ {n: "Zły Wilk", s: "🐺", hp: 30, d: 8}, {n: "Goblin", s: "👺", hp: 40, d: 12}, {n: "Demon", s: "👿", hp: 120, d: 30} ] },
    elf: { title: "Świat Elfów", biomes: [ {name: "✨ KRYSZTAŁOWY LAS", wall: '#113333', floor: '#0a1a1a', door: '#338888', exitText: "MOST"} ], mobs: [ {n: "Strażnik Lasu", s: "🧝", hp: 45, d: 10}, {n: "Golem Światła", s: "🧿", hp: 90, d: 20} ] },
    dwarf: { title: "Podziemia Krasnoludów", biomes: [ {name: "🌋 KUŹNIA MAGMY", wall: '#441100', floor: '#220800', door: '#ff5500', exitText: "WROTA"} ], mobs: [ {n: "Krasnolud", s: "🧔", hp: 60, d: 12}, {n: "Żywiołak Magmy", s: "🔥", hp: 100, d: 35} ] },
    homunculus: { title: "Przeklęte Laboratoria", biomes: [ {name: "☣️ KANAŁY MUTANTÓW", wall: '#2a3a1a', floor: '#1a2a0a', door: '#445522', exitText: "RURA"} ], mobs: [ {n: "Pełzacz", s: "🐛", hp: 50, d: 18}, {n: "Homunkulus", s: "👁️", hp: 160, d: 40} ] }
};

export const PERKS = [
    {id: 'brute', name: 'Siłacz', desc: '+15 Ataku na stałe', onTake: (p) => p.baseDmg += 15},
    {id: 'vitality', name: 'Witalność', desc: '+50 Max HP', onTake: (p) => { p.maxHp += 50; p.hp += 50; }},
    {id: 'sapper', name: 'Saper', desc: 'Dostajesz 5 bomb. Bomby x2', onTake: (p) => p.inv.bombs += 5},
    {id: 'hacker', name: 'Haker', desc: 'Możliwość integracji kodu świata', onTake: (p) => {}},
    {id: 'boss_slayer', name: 'Pogromca Bossów', desc: '2x Dmg Bossom', onTake: (p)=>{}},
    {id: 'regen', name: 'Regeneracja', desc: '+2 HP co krok na mapie', onTake: (p)=>{}}
];

export const DIRS = [ {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0} ];
