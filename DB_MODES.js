/* Configurazione ridotta: resta soltanto la campagna Test2. */
window.PokeMisteryRL_Modes = window.PokeMisteryRL_Modes || {};

const TEST2_FLOORS = [
  { piano:1, nome:"Bosco Smeraldo", categoria:"bosco", livelli:{min:5,max:5}, bossLevel:11, wilds:["Rattata","Pidgey"], bossRule:"counterStarter" },
  { piano:2, nome:"Bosco Profondo", categoria:"bosco", livelli:{min:17,max:17}, bossLevel:23, wildFilter:{typesAny:["erba"],stage:1}, bossPair:["Butterfree","Beedrill"] },
  { piano:3, nome:"Monte Luna", categoria:"grotta", livelli:{min:29,max:29}, bossLevel:35, wildFilter:{typesAny:["terra","roccia"],include:["Zubat","Clefairy"]}, bossPair:["Kabuto","Omanyte"] },
  { piano:4, nome:"Centrale Elettrica", categoria:"torre", livelli:{min:41,max:41}, bossLevel:47, wildFilter:{typesAny:["elettro"]}, bossAlternatives:[["Voltorb","Electrode"],["Zapdos"]] },
  { piano:5, nome:"MN Anna", categoria:"acqua", livelli:{min:53,max:53}, bossLevel:59, wildFilter:{typesAny:["acqua"]}, boss:["Kingler"] },
  { piano:6, nome:"Torre Pokémon", categoria:"torre", livelli:{min:65,max:65}, bossLevel:71, wildFilter:{typesAny:["spettro"]}, bossPair:["Marowak","Cubone"] },
  { piano:7, nome:"Zona Safari", categoria:"safari", livelli:{min:77,max:77}, bossLevel:83, wilds:["Chansey","Kangaskhan","Scyther","Tauros"], bossPair:["Dragonair","Dratini"] },
  { piano:8, nome:"Isole Spuma", categoria:"grotta", livelli:{min:89,max:89}, bossLevel:95, wildFilter:{typesAny:["roccia","terra","acqua"]}, bossPair:["Tentacruel","Tentacool"] },
  { piano:9, nome:"Villa Pokémon", categoria:"torre", livelli:{min:101,max:101}, bossLevel:107, wildFilter:{typesAny:["fuoco"]}, bossRule:"dittoMew" },
  { piano:10, nome:"Via Vittoria", categoria:"grotta", livelli:{min:113,max:113}, bossLevel:119, wildFilter:{stage:3}, bossRule:"discardedStartersOrMoltres", finale:true }
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
