/*
============================================================
 PokeMisteryRL — DB_ITEMS
 Versione: 1.0
 ------------------------------------------------------------
 DATABASE PURO DEGLI OGGETTI.

 Questo file contiene SOLO i dati degli oggetti.
 La logica degli effetti è gestita da:
 ITEM_SYSTEM_REGION_GITHUB.js

 Struttura:
 {
   id,
   nome,
   effetto,
   rarita,
   tipo,
   ...campi tecnici opzionali
 }
============================================================
*/

window.PokeMisteryRL_Items = window.PokeMisteryRL_Items || {};

window.PokeMisteryRL_Items.DB_ITEMS = {

  /* ==========================================================
     01. OGGETTI SPECIALI
     ========================================================== */

  bitorzolello: {
    id: "bitorzolello",
    nome: "Bitorzolello (Rocky Helmet)",
    immagine: "./img/items/rockyhelmet.png",
    effetto: "Chi usa una mossa a contatto perde 1/6 dei PS massimi.",
    rarita: null,
    tipo: "reazione"
  },

  avanzi: {
    id: "avanzi",
    nome: "Avanzi (Leftovers)",
    immagine: "./img/items/leftovers.png",
    effetto: "A fine turno recupera 1/16 dei PS massimi.",
    rarita: null,
    tipo: "cura"
  },

  evolcondensa: {
    id: "evolcondensa",
    nome: "Evolcondensa (Eviolite)",
    immagine: "./img/items/eviolite.png",
    effetto: "Se può evolversi: Difesa ×1,5.",
    rarita: null,
    tipo: "statistica"
  },

  vulneropolizza: {
    id: "vulneropolizza",
    nome: "Vulneropolizza (Weakness Policy)",
    immagine: "./img/items/weaknesspolicy.png",
    effetto: "Dopo un colpo superefficace: Attacco +2 livelli.",
    rarita: null,
    tipo: "sinergia"
  },

  palla_fumo: {
    id: "palla_fumo",
    nome: "Palla Fumo (Smoke Ball)",
    immagine: "./img/items/smokeball.png",
    effetto: "Permette sempre di fuggire dagli incontri selvatici.",
    rarita: null,
    tipo: "evasione"
  },

  assorbisfera: {
    id: "assorbisfera",
    nome: "Assorbisfera (Life Orb)",
    immagine: "./img/items/lifeorb.png",
    effetto: "Mosse dannose ×1,3; chi attacca perde 1/10 dei PS massimi.",
    rarita: null,
    tipo: "potenziamento"
  },


  /* ==========================================================
     02. POTENZIATORI DI TIPO
     ========================================================== */

  carbonella: {
    id: "carbonella",
    nome: "Carbonella",
    immagine: "./img/items/charcoal.png",
    effetto: "DMG [FIRE] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "fuoco",
    bonus_danno: 0.20
  },

  acqua_magica: {
    id: "acqua_magica",
    nome: "Acqua Magica",
    immagine: "./img/items/mysticwater.png",
    effetto: "DMG [WATER] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "acqua",
    bonus_danno: 0.20
  },

  miracolseme: {
    id: "miracolseme",
    nome: "Miracolseme",
    immagine: "./img/items/miracleseed.png",
    effetto: "DMG [GRASS] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "erba",
    bonus_danno: 0.20
  },

  magnete: {
    id: "magnete",
    nome: "Magnete",
    immagine: "./img/items/magnet.png",
    effetto: "DMG [ELECTRIC] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "elettro",
    bonus_danno: 0.20
  },

  gelomai: {
    id: "gelomai",
    nome: "Gelomai",
    immagine: "./img/items/never-meltice.png",
    effetto: "DMG [ICE] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "ghiaccio",
    bonus_danno: 0.20
  },

  soffice_sabbia: {
    id: "soffice_sabbia",
    nome: "Soffice Sabbia",
    immagine: "./img/items/softsand.png",
    effetto: "DMG [GROUND] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "terra",
    bonus_danno: 0.20
  },

  cinturanera: {
    id: "cinturanera",
    nome: "Cinturanera",
    immagine: "./img/items/blackbelt.png",
    effetto: "DMG [FIGHTING] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "lotta",
    bonus_danno: 0.20
  },

  beccaffilato: {
    id: "beccaffilato",
    nome: "Beccaffilato",
    immagine: "./img/items/sharpbeak.png",
    effetto: "DMG [FLYING] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "volante",
    bonus_danno: 0.20
  },

  cucchiaiorto: {
    id: "cucchiaiorto",
    nome: "Cucchiaiorto",
    immagine: "./img/items/twistedspoon.png",
    effetto: "DMG [PSYCHIC] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "psico",
    bonus_danno: 0.20
  },

  argentovivo: {
    id: "argentovivo",
    nome: "Argentovivo",
    immagine: "./img/items/silverpowder.png",
    effetto: "DMG [BUG] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "coleottero",
    bonus_danno: 0.20
  },

  pietradura: {
    id: "pietradura",
    nome: "Pietradura",
    immagine: "./img/items/hardstone.png",
    effetto: "DMG [ROCK] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "roccia",
    bonus_danno: 0.20
  },

  spettrotarga: {
    id: "spettrotarga",
    nome: "Spettrotarga",
    immagine: "./img/items/spelltag.png",
    effetto: "DMG [GHOST] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "spettro",
    bonus_danno: 0.20
  },

  dente_di_drago: {
    id: "dente_di_drago",
    nome: "Dente di Drago",
    immagine: "./img/items/dragonfang.png",
    effetto: "DMG [DRAGON] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "drago",
    bonus_danno: 0.20
  },

  occhialineri: {
    id: "occhialineri",
    nome: "Occhialineri",
    immagine: "./img/items/blackglasses.png",
    effetto: "DMG [DARK] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "buio",
    bonus_danno: 0.20
  },

  metalcoperta: {
    id: "metalcoperta",
    nome: "Metalcoperta",
    immagine: "./img/items/metalcoat.png",
    effetto: "DMG [STEEL] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "acciaio",
    bonus_danno: 0.20
  },

  velenaculeo: {
    id: "velenoCuleo",
    nome: "Velenaculeo",
    immagine: "./img/items/poisonbarb.png",
    effetto: "DMG [POISON] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "veleno",
    bonus_danno: 0.20
  },

  fiocco_rosa: {
    id: "fiocco_rosa",
    nome: "Piuma Folletto",
    immagine: "./img/items/fairyfeather.png",
    effetto: "Danno mosse FOLLETTO ×1,20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "folletto",
    bonus_danno: 0.20
  },

  sciarpaseta: {
    id: "sciarpaseta",
    nome: "Sciarpaseta",
    immagine: "./img/items/silkscarf.png",
    effetto: "DMG [NORMAL] ×1.20.",
    rarita: null,
    tipo: "potenziamento_tipo",
    tipo_mossa: "normale",
    bonus_danno: 0.20
  },


  /* ==========================================================
     03. OGGETTI DI CURA / UTILITÀ
     ========================================================== */

  pozione: {
    id: "pozione",
    nome: "Pozione",
    immagine: "./img/items/potion.png",
    effetto: "Cura 20 PS.",
    rarita: "comune",
    tipo: "cura",
    cura_hp:20
  },

  super_pozione: {
    id: "super_pozione",
    nome: "Super Pozione",
    immagine: "./img/items/superpotion.png",
    effetto: "Cura 50 PS.",
    rarita: "non_comune",
    tipo: "cura",
    cura_hp:50
  },

  iper_pozione: {
    id: "iper_pozione",
    nome: "Iper Pozione",
    immagine: "./img/items/hyperpotion.png",
    effetto: "Cura 120 PS.",
    rarita: "rara",
    tipo: "cura",
    cura_hp:120
  },

  max_pozione: { id:"max_pozione", nome:"Pozione Max", immagine:"./img/items/maxpotion.png", effetto:"Cura completamente gli HP.", rarita:"epica", tipo:"cura", cura_hp:"max" },
  ripristino_totale: { id:"ripristino_totale", nome:"Ripristino Totale", immagine:"./img/items/fullrestore.png", effetto:"Cura completamente gli HP e gli status.", rarita:"epica", tipo:"cura", cura_hp:"max", cura_status:true },
  revive: { id:"revive", nome:"Rivitalizzante", immagine:"./img/items/revive.png", effetto:"Rianima con il 50% degli HP.", rarita:"rara", tipo:"cura", revive_hp:.5 },
  max_revive: { id:"max_revive", nome:"Revitalizzante Max", immagine:"./img/items/maxrevive.png", effetto:"Rianima con tutti gli HP.", rarita:"epica", tipo:"cura", revive_hp:1 },
  erba_rivitalizzante: { id:"erba_rivitalizzante", nome:"Erba Rivitalizzante", immagine:"./img/items/revivalherb.png", effetto:"Rianima con tutti gli HP.", rarita:"rara", tipo:"cura", revive_hp:1 },
  cenere_sacra: { id:"cenere_sacra", nome:"Cenere Sacra", immagine:"./img/items/sacredash.png", effetto:"Rianima con tutti gli HP e cura gli status.", rarita:"leggendaria", tipo:"cura", revive_hp:1, cura_status:true },
  acqua_fresca: { id:"acqua_fresca", nome:"Acqua Fresca", immagine:"./img/items/freshwater.png", effetto:"Cura 30 HP.", rarita:"comune", tipo:"cura", cura_hp:30 },
  soda_pop: { id:"soda_pop", nome:"Soda Pop", immagine:"./img/items/sodapop.png", effetto:"Cura 60 HP.", rarita:"non_comune", tipo:"cura", cura_hp:60 },
  limonata: { id:"limonata", nome:"Limonata", immagine:"./img/items/lemonade.png", effetto:"Cura 70 PS.", rarita:"rara", tipo:"cura", cura_hp:70 },
  latte_moomoo: { id:"latte_moomoo", nome:"Latte Moomoo", immagine:"./img/items/moomoomilk.png", effetto:"Cura 100 PS.", rarita:"non_comune", tipo:"cura", cura_hp:100 },
  caramella_furia: { id:"caramella_furia", nome:"Iramella", immagine:"./img/items/ragecandybar.png", effetto:"Cura 20 PS.", rarita:"comune", tipo:"cura", cura_hp:20 },
  biscotto_lava: { id:"biscotto_lava", nome:"Lavottino", immagine:"./img/items/lavacookie.png", effetto:"Cura gli status.", rarita:"non_comune", tipo:"cura", cura_status:true },
  torta_antica: { id:"torta_antica", nome:"Dolce Chateau", immagine:"./img/items/oldgateau.png", effetto:"Cura gli status.", rarita:"non_comune", tipo:"cura", cura_status:true },
  cono_castelia: { id:"cono_castelia", nome:"Conostropoli", immagine:"./img/items/casteliacone.png", effetto:"Cura gli status.", rarita:"non_comune", tipo:"cura", cura_status:true },

  caramella_rara: {
    id: "caramella_rara",
    nome: "Caramella Rara",
    effetto: "SELECTED POKÉMON LV +1.",
    rarita: "rara",
    tipo: "crescita"
  },

  amuleto: {
    id: "amuleto",
    nome: "Amuleto",
    immagine: "./img/items/amuletcoin.png",
    effetto: "Raddoppia il denaro vinto se il possessore partecipa alla lotta.",
    rarita: "epica",
    tipo: "bonus"
  },

};

/* Le icone non vengono più lette da file locali: arrivano live da PokeAPI. */
const POKEAPI_ITEM_IDS = {
  bitorzolello:"rocky-helmet", avanzi:"leftovers", evolcondensa:"eviolite",
  vulneropolizza:"weakness-policy", palla_fumo:"smoke-ball", assorbisfera:"life-orb",
  carbonella:"charcoal", acqua_magica:"mystic-water", miracolseme:"miracle-seed", magnete:"magnet",
  gelomai:"never-melt-ice", soffice_sabbia:"soft-sand", cinturanera:"black-belt", beccaffilato:"sharp-beak",
  cucchiaiorto:"twisted-spoon", argentovivo:"silver-powder", pietradura:"hard-stone", spettrotarga:"spell-tag",
  dente_di_drago:"dragon-fang", occhialineri:"black-glasses", metalcoperta:"metal-coat", velenaculeo:"poison-barb",
  fiocco_rosa:"fairy-feather", sciarpaseta:"silk-scarf", pozione:"potion", super_pozione:"super-potion",
  iper_pozione:"hyper-potion", max_pozione:"max-potion", ripristino_totale:"full-restore", revive:"revive",
  max_revive:"max-revive", erba_rivitalizzante:"revival-herb", cenere_sacra:"sacred-ash", acqua_fresca:"fresh-water",
  soda_pop:"soda-pop", limonata:"lemonade", latte_moomoo:"moo-moo-milk", caramella_furia:"rage-candy-bar",
  biscotto_lava:"lava-cookie", torta_antica:"old-gateau", cono_castelia:"casteliacone", caramella_rara:"rare-candy",
  amuleto:"amulet-coin"
};

Object.values(window.PokeMisteryRL_Items.DB_ITEMS).forEach(item => { item.immagine = ""; });

window.PokeMisteryRL_Items.loadLiveIcons = async function(){
  const db = window.PokeMisteryRL_Items.DB_ITEMS;
  const cacheKey = "pokeMisteryRL.pokeapi.item-icons.v1";
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(cacheKey) || "{}"); } catch(_) { cache = {}; }
  const entries = Object.entries(POKEAPI_ITEM_IDS);
  for(let index = 0; index < entries.length; index += 6){
    await Promise.all(entries.slice(index, index + 6).map(async ([key, slug]) => {
      const item = db[key];
      if(!item) return;
      const saved = cache[slug];
      if(saved){ item.immagine = saved; return; }
      try {
        const response = await fetch(`https://pokeapi.co/api/v2/item/${slug}`);
        const data = response.ok ? await response.json() : null;
        const icon = data?.sprites?.default || "";
        if(icon){ cache[slug] = icon; item.immagine = icon; }
      } catch(_) { /* l'icona resta vuota finché PokeAPI non risponde */ }
    }));
  }
  try { localStorage.setItem(cacheKey, JSON.stringify(cache)); } catch(_) {}
  window.PokeMisteryRL?.UI?.refreshBottomPanel?.();
  return db;
};
window.PokeMisteryRL_Items.loadLiveIcons();


/* ============================================================
   API MINIMA DEL DATABASE
   ============================================================ */

window.PokeMisteryRL_Items.get = function(itemId){
  if(!itemId) return null;

  var key =
    String(itemId)
      .trim()
      .toLowerCase();

  return (
    window.PokeMisteryRL_Items.DB_ITEMS[key] ||
    null
  );
};

window.PokeMisteryRL_Items.getAll = function(){
  return Object.values(
    window.PokeMisteryRL_Items.DB_ITEMS
  );
};

window.PokeMisteryRL_Items.getByRarity = function(rarita){
  var rarity =
    String(rarita || "")
      .trim()
      .toLowerCase();

  return window.PokeMisteryRL_Items
    .getAll()
    .filter(function(item){
      return String(item.rarita || "")
        .toLowerCase() === rarity;
    });
};

window.PokeMisteryRL_Items.getByType = function(tipo){
  var type =
    String(tipo || "")
      .trim()
      .toLowerCase();

  return window.PokeMisteryRL_Items
    .getAll()
    .filter(function(item){
      return String(item.tipo || "")
        .toLowerCase() === type;
    });
};


/* ============================================================
   COMPATIBILITÀ
   ============================================================ */

window.DB_ITEMS =
  window.PokeMisteryRL_Items.DB_ITEMS;

console.log(
  "✅ DB_ITEMS caricato:",
  Object.keys(window.DB_ITEMS).length,
  "oggetti"
);
