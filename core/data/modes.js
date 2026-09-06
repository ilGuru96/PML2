/* Configurazione ridotta: resta soltanto la campagna Test2. */
window.PokeMisteryRL_Modes = window.PokeMisteryRL_Modes || {};

const TEST2_FLOORS = [
  { piano:1, nome:"Sentiero Verde", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Oddish","Bellsprout","Pidgey","Zubat"], bossPair:["Ivysaur","Pidgeotto"] },
  { piano:2, nome:"Ruscello Muschioso", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Poliwag","Tentacool","Nidorino","Pidgeotto"], bossPair:["Gloom","Weepinbell"] },
  { piano:3, nome:"Palude Azzurra", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Psyduck","Krabby","Horsea","Golbat"], bossPair:["Golbat","Vileplume"] },
  { piano:4, nome:"Radure Tossiche", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Paras","Venonat","Staryu","Fearow"], bossPair:["Venomoth","Fearow"] },
  { piano:5, nome:"Lago Silente", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Shellder","Goldeen","Tentacool","Gloom"], bossPair:["Tentacruel","Wartortle"] },
  { piano:6, nome:"Giardino dei Veleni", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Weepinbell","Arbok","Golbat","Seel"], bossPair:["Victreebel","Golbat"] },
  { piano:7, nome:"Rive Ventose", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Golduck","Dewgong","Pidgeotto","Venomoth"], bossPair:["Dewgong","Venomoth"] },
  { piano:8, nome:"Bosco di Nebbia", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Starmie","Cloyster","Pidgeot","Vileplume"], boss:["Gyarados"] },
  { piano:9, nome:"Selva Antica", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Tangela","Victreebel","Tentacruel","Pidgeot"], bossPair:["Venusaur","Tentacruel"] },
  { piano:10, nome:"Santuario delle Quattro Correnti", categoria:"bosco", livelli:{min:1,max:1}, wilds:["Blastoise","Venusaur","Gyarados","Pidgeot"], bossAlternatives:[["Venusaur","Blastoise"],["Gyarados"]], finale:true }
];

window.PokeMisteryRL_Modes.DB_MODES = {
  test2: { id:"test2", nome:"Test2", descrizione:"Campagna sperimentale.", tipo:"campagna", famiglia:"test2", max_piani:TEST2_FLOORS.length, piani:TEST2_FLOORS }
};
window.PokeMisteryRL_Modes.get = function(modeId){
  return String(modeId || "").trim().toLowerCase() === "test2" ? window.PokeMisteryRL_Modes.DB_MODES.test2 : null;
};
window.PokeMisteryRL_Modes.getFloor = function(modeId, floor){
  return window.PokeMisteryRL_Modes.get(modeId)?.piani?.find(entry => Number(entry.piano) === Number(floor)) || null;
};
window.PokeMisteryRL_Modes.getFloorBackground = function(){ return null; };
window.DB_MODES = window.PokeMisteryRL_Modes.DB_MODES;
