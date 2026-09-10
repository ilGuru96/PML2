/* ============================================================
   PokeMisteryRL - CORE v8.1 MODULAR
   Puoi collassare ogni #region e/o spostarla in un file separato
   ============================================================ */

// Conserva i moduli caricati prima del core (layout, dati e feature).
const PokeMisteryRL = window.PokeMisteryRL || {};
window.PokeMisteryRL = PokeMisteryRL;
const BossWaves = window.PokeMisteryRL_BossWaves;
// #region 01 - CONFIGURAZIONE + GLOBALI
PokeMisteryRL.Config = window.PokeMisteryRL_Config;
if(!PokeMisteryRL.Config) throw new Error("Modulo configurazione non caricato");

// Stato globale condiviso
let PKM_RUN = null;
let busy = 0;
let timer = 0;
let mapResizeObserver = null;
let evoPromptShownFloor = -1;
const { SPRITE_BASE_URL } = PokeMisteryRL.Config;
// #endregion
// #region 02 - HELPER GENERALI
PokeMisteryRL.Helpers = (() => {
  const $ = id => document.getElementById(id);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const rand = arr => Array.isArray(arr) && arr.length? arr[Math.floor(Math.random() * arr.length)] : null;

  const sprite = (image) => {
    if (!image) return SPRITE_BASE_URL + "eevee.png";
    const v = String(image).trim();
    if (v.startsWith("http") || v.startsWith("data:")) return v;
    return SPRITE_BASE_URL + v;
  };
  const fmt = (n) => {
    n = Math.floor(Number(n) || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7? 0 : 1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4? 0 : 1) + "K";
    return n.toString();
  };
  const fmtIV = (v) =>!v? "" : v > 0? `+${v}` : `${v}`;
  // I dati di PokéAPI arrivano in minuscolo: nel gioco mostriamo sempre il
  // nome con l'iniziale maiuscola, senza alterare il resto della grafia.
  const pokemonName = value => {
    const name = String(value ?? "").trim();
    return name ? name.charAt(0).toLocaleUpperCase("it-IT") + name.slice(1) : "Pokémon";
  };
  const msg = (text) => {
    const el = $("eventLog");
    if (el) {
      el.textContent = text;
      clearTimeout(timer);
      timer = setTimeout(() => el.textContent = "", 2000);
    }

    const logEl = $("runLogContent");
    if (logEl && text) {
      const line = document.createElement("div");
      line.className = "run-log-line";
      line.textContent = text;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    }
  };
const modal = (html) => {
  const content = $("modalContent"), box = $("modal");
  if (!content || !box) return;
  content.innerHTML = html;
  box.classList.remove("hidden");
};

const closeModal = () => $("modal")?.classList.add("hidden");

// Test2 usa il Bottom Campagna come arena, senza aprire una finestra modale.
const showBattleSurface = (html) => {
  if(PKM_RUN?.mode === "test2"){
    const bottom = $("bottomContainer");
    if(bottom){
      const arena = PokeMisteryRL.UI?.buildTest2ArenaTemplate?.() || html;
      // Il fight è il Bottom Campagna stesso, senza una scena o un pannello aggiuntivo.
      bottom.innerHTML = arena;
      const floor = window.PokeMisteryRL_Modes?.getFloor?.(PKM_RUN.mode, PKM_RUN.floor);
      const forest = String(floor?.categoria || "").toLowerCase() === "bosco";
      const scene = forest
        ? "./img/prove-bosco/BoscoSmeraldo-Scenario.png"
        : "./img/prove-bosco/Grotta-Scenario.png";
      bottom.style.setProperty("background-image", `linear-gradient(rgba(5,10,21,.08),rgba(1,4,12,.32)),url(\"${scene}\")`, "important");
      bottom.style.setProperty("background-size", "cover", "important");
      bottom.style.setProperty("background-position", "center bottom", "important");
      bottom.style.setProperty("background-repeat", "no-repeat", "important");
      $("modal")?.classList.add("hidden");
      return true;
    }
  }
  modal(html);
  return false;
};

document.addEventListener("click", (e) => {
  const box = $("modal");

  if (!box || box.classList.contains("hidden")) return;

  if (e.target === box) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
});

const log = (text, cls = "") => {
  const el = $("blog");
  if (el) {
    el.innerHTML += `<div class="log-line ${cls}">${text}</div>`;
    el.scrollTop = el.scrollHeight;
  }

  const runLog = $("runLogContent");
  if (runLog && text) {
    const line = document.createElement("div");
    line.className = "run-log-line";
    line.textContent = String(text).replace(/<[^>]*>/g, "");
    runLog.appendChild(line);
    runLog.scrollTop = runLog.scrollHeight;
  }
};
  const ensureBoxStructure = () => {
    const gameBox = $("gameBox"), bottom = $("bottomContainer"), mapWrap = document.querySelector(".map-wrap");
    if (gameBox && bottom && mapWrap &&!gameBox.contains(bottom)) gameBox.appendChild(bottom);
  };
  return { $, clamp, rand, sprite, fmt, fmtIV, pokemonName, msg, modal, closeModal, showBattleSurface, log, ensureBoxStructure };
})();

const { $, clamp, rand, sprite, fmt, fmtIV, pokemonName, msg, modal, closeModal, showBattleSurface, log } = PokeMisteryRL.Helpers;

/* ============================================================
   RUNTIME CONDIVISO
   I moduli esterni usano questa superficie invece di catturare
   variabili locali del core. È il confine per Shop/Rifugio/Dojo/Boss.
   ============================================================ */
PokeMisteryRL.Runtime = (() => {
  const runtime = {
    helpers: { $, clamp, rand, sprite, fmt, fmtIV, msg, modal, closeModal, showBattleSurface, log },
    getMap: () => $("map"),
    getBottom: () => $("bottomCampagna"),
    getShell: () => document.querySelector(".adventure-shell"),
    isTest2: () => PKM_RUN?.mode === "test2",
    invoke: (name, ...args) => typeof window[name] === "function" ? window[name](...args) : false
  };

  Object.defineProperties(runtime, {
    run: {
      enumerable: true,
      get: () => PKM_RUN,
      set: value => { PKM_RUN = value || null; window.PKM_RUN = PKM_RUN; }
    },
    busy: {
      enumerable: true,
      get: () => busy,
      set: value => { busy = Number(value) || 0; }
    },
    timer: {
      enumerable: true,
      get: () => timer,
      set: value => { timer = value; }
    }
  });

  return runtime;
})();
window.PokeMisteryRLRuntime = PokeMisteryRL.Runtime;

let runLogOpen = false;
const toggleRunLog = () => {
  runLogOpen = !runLogOpen;
  const content = $("runLogContent");
  const arrow = $("runLogArrow");
  if(content) content.style.display = runLogOpen ? "block" : "none";
  if(arrow) arrow.textContent = runLogOpen ? "▲" : "▼";
};

// Il reclutamento vive in core/features/recruitment.js.
// #region 03 - TIPOLOGIE
PokeMisteryRL.Types = window.PokeMisteryRL_Types;
if(!PokeMisteryRL.Types) throw new Error("Modulo tipi non caricato");
const { getPokemonTypes, getTypeMultiplier, getMultLabel, getTypingBadge } = PokeMisteryRL.Types;
// #endregion
// #region 04 - DATABASE POKEMON - LOADER FIX PER DB_PKM SENZA.js
PokeMisteryRL.Database = (() => {
  const PKM_DB = {};
  const POKEAPI_BASE = "https://pokeapi.co/api/v2";
  const POKEAPI_CACHE_KEY = "pokeMisteryRL.pokeapi.all-species.v1";
  const italianType = {
    normal:"normale", fire:"fuoco", water:"acqua", electric:"elettro",
    grass:"erba", ice:"ghiaccio", fighting:"lotta", poison:"veleno",
    ground:"terra", flying:"volante", psychic:"psico", bug:"coleottero",
    rock:"roccia", ghost:"spettro", dragon:"drago", dark:"buio",
    steel:"acciaio", fairy:"folletto"
  };

  function normalizePokemonDatabase() {
    const source = window.PKM_ALL || window.DB_PKM || {};
    const flat = {};
    const addOne = (key, data) => {
      if (!data ||!data.id) return;
      flat[data.id] = {
        id: Number(data.id),
        nome: pokemonName(data.nome || data.name || key),
        immagine: sprite(data.immagine || data.image || (data.nome || "").toLowerCase() + ".png"),
        tipi: (data.tipi && data.tipi.length? data.tipi : data.types || []).map(t => String(t).toLowerCase()),
        stage: Number(data.stage || 1),
        bst: Number(data.bst || 300),
        evoluzione: data.evoluzione || data.evolution || null
      };
    };
    // se è { kanto: {1:{}} }
    if (source.kanto) {
      Object.entries(source.kanto).forEach(([k,v])=> addOne(k,v));
      if (source.johto) Object.entries(source.johto).forEach(([k,v])=> addOne(k,v));
    } else {
      Object.entries(source).forEach(([k,v])=> { if(v && v.id) addOne(k,v); });
    }
    return flat;
  }

  const buildPokemonDB = () => {
    const normalized = normalizePokemonDatabase();
    // Senza DB_PKM il catalogo è già stato costruito da PokeAPI: non va
    // svuotato all'avvio della run.
    if(Object.keys(normalized).length){
      Object.keys(PKM_DB).forEach(k => delete PKM_DB[k]);
      Object.assign(PKM_DB, normalized);
    }
    console.log("PKM_DB:", Object.keys(PKM_DB).length + " Pokémon caricati");
    return PKM_DB;
  };

  // I sei valori base arrivano direttamente dalla risposta /pokemon di
  // PokéAPI. La loro somma è il BST ufficiale della specie.
  const readApiBaseStats = data => {
    const values = Object.fromEntries((data?.stats || []).map(entry => [String(entry?.stat?.name || ""), Number(entry?.base_stat) || 1]));
    return {
      hp: values.hp || 1,
      atk: values.attack || 1,
      def: values.defense || 1,
      satk: values["special-attack"] || 1,
      sdef: values["special-defense"] || 1,
      spd: values.speed || 1
    };
  };

  const seedLivePokemon = data => {
    const id = Number(data?.id);
    if(!id) return null;
    const bst = (data.stats || []).reduce((sum, entry) => sum + (Number(entry?.base_stat) || 0), 0);
    PKM_DB[id] = {
      id,
      nome: pokemonName(data.name || `Pokémon ${id}`),
      immagine: data?.sprites?.front_default || "",
      tipi: (data.types || []).sort((a,b) => a.slot - b.slot).map(entry => italianType[entry?.type?.name] || entry?.type?.name).filter(Boolean),
      apiMoves: Array.isArray(data.moves) ? data.moves : [],
      stage: 1,
      bst: bst || 300,
      baseStats: readApiBaseStats(data),
      evoluzione: null,
      pokeapi: { id, name:data.name, updatedAt:Date.now() }
    };
    return PKM_DB[id];
  };

  const getPokemon = (id) => PKM_DB[Number(id)] || null;
  const getPokemonId = (value) => { var id=Number(value); return PKM_DB[id]? id : null; };

  // PokéAPI è la fonte live dei dati canonici. Il DB locale conserva soltanto
  // campi di design della run che l'API non conosce (stage ed evoluzioni).
  const applyLivePokemon = data => {
    const id = Number(data?.id);
    if(!id || !PKM_DB[id]) return null;
    const current = PKM_DB[id];
    const bst = (data.stats || []).reduce((sum, entry) => sum + (Number(entry?.base_stat) || 0), 0);
    PKM_DB[id] = {
      ...current,
      nome: pokemonName(current.nome || data.name || "Pokémon"),
      immagine: data?.sprites?.front_default || current.immagine,
      tipi: (data.types || []).sort((a,b) => a.slot - b.slot).map(entry => italianType[entry?.type?.name] || entry?.type?.name).filter(Boolean),
      apiMoves: Array.isArray(data.moves) ? data.moves : current.apiMoves || [],
      bst: bst || current.bst,
      baseStats: readApiBaseStats(data),
      pokeapi: { id, name:data.name, updatedAt:Date.now() }
    };
    // Le run già iniziate ricevono la distribuzione canonica appena la
    // risposta live è disponibile, mantenendo invariata la percentuale HP.
    if(PKM_RUN && !PKM_RUN.battle){
      [PKM_RUN.activePokemon, PKM_RUN.secondActive, ...(PKM_RUN.teamSlots || [])].filter(member => Number(member?.id) === id).forEach(member => {
        member.nome = PKM_DB[id].nome;
        member.baseStats = { ...PKM_DB[id].baseStats };
        PokeMisteryRL_LevelSystem?.rebuildBaseStats?.(member);
      });
    }
    return PKM_DB[id];
  };

  // PokeAPI espone le evoluzioni nella specie, non nel Pokémon. Ricaviamo
  // quindi stage, prossimo stadio e livello direttamente dalla catena live.
  const idFromApiUrl = value => Number(String(value || "").match(/\/(\d+)\/?$/)?.[1]) || 0;
  const findEvolutionNode = (node, speciesName, depth = 0) => {
    if(!node) return null;
    if(String(node.species?.name || "").toLowerCase() === String(speciesName || "").toLowerCase()){
      return { node, depth };
    }
    for(const child of node.evolves_to || []){
      const match = findEvolutionNode(child, speciesName, depth + 1);
      if(match) return match;
    }
    return null;
  };
  const applyLiveEvolution = (id, pokemonData, chain) => {
    const current = PKM_DB[Number(id)];
    const match = findEvolutionNode(chain?.chain, pokemonData?.species?.name || pokemonData?.name);
    if(!current || !match) return null;
    const next = match.node?.evolves_to?.[0] || null;
    const detail = next?.evolution_details?.[0] || {};
    const targetId = idFromApiUrl(next?.species?.url);
    PKM_DB[Number(id)] = {
      ...current,
      stage: Math.max(1, Math.min(3, Number(match.depth) + 1)),
      evoluzione: targetId ? {
        a: targetId,
        in: Math.max(1, Math.min(3, Number(match.depth) + 2)),
        lv: Number(detail.min_level) || 0
      } : null,
      pokeapi: { ...(current.pokeapi || {}), evolutionUpdatedAt: Date.now() }
    };
    return PKM_DB[Number(id)];
  };

  const loadLiveEvolution = async (id, pokemonData, cachedEvolution) => {
    try {
      const chain = cachedEvolution?.chain || await (async () => {
        const speciesResponse = await fetch(pokemonData?.species?.url || `${POKEAPI_BASE}/pokemon-species/${id}`);
        if(!speciesResponse.ok) return null;
        const species = await speciesResponse.json();
        const chainResponse = await fetch(species?.evolution_chain?.url);
        return chainResponse.ok ? chainResponse.json() : null;
      })();
      if(!chain) return null;
      applyLiveEvolution(id, pokemonData, chain);
      return { chain };
    } catch(_) {
      return null; // fallback locale se PokeAPI non è raggiungibile
    }
  };

  const readLiveCache = () => {
    try { return JSON.parse(localStorage.getItem(POKEAPI_CACHE_KEY) || "{}"); }
    catch(_) { return {}; }
  };
  const writeLiveCache = cache => {
    try { localStorage.setItem(POKEAPI_CACHE_KEY, JSON.stringify(cache)); }
    catch(_) { /* cache opzionale */ }
  };

  const loadPokeApiLiveDatabase = async () => {
    if(window.__pokeApiLoading || window.__pokeApiReady) return PKM_DB;
    if(!Object.keys(PKM_DB).length) return loadPokeApiInitialDatabase();
    window.__pokeApiLoading = true;
    const cache = readLiveCache();
    const ids = Object.keys(PKM_DB).map(Number).filter(id => id > 0 && id <= 151);
    let changed = false;
    for(let start = 0; start < ids.length; start += 6){
      const group = ids.slice(start, start + 6);
      await Promise.all(group.map(async id => {
        const cached = cache[id];
        if(cached?.data && Date.now() - Number(cached.savedAt || 0) < 1000 * 60 * 60 * 24 * 7){
          if(applyLivePokemon(cached.data)) changed = true;
          const evolution = await loadLiveEvolution(id, cached.data, cached.evolution);
          if(evolution) cache[id].evolution = evolution;
          return;
        }
        try {
          const response = await fetch(`${POKEAPI_BASE}/pokemon/${id}`);
          if(!response.ok) return;
          const data = await response.json();
          cache[id] = { savedAt:Date.now(), data };
          if(applyLivePokemon(data)) changed = true;
          const evolution = await loadLiveEvolution(id, data, null);
          if(evolution) cache[id].evolution = evolution;
        } catch(_) { /* il DB locale resta il fallback offline */ }
      }));
    }
    writeLiveCache(cache);
    window.__pokeApiLoading = false;
    window.__pokeApiReady = true;
    if(changed){
      window.dispatchEvent(new CustomEvent("pokeapi:ready"));
      if(PKM_RUN && !PKM_RUN.battle) PokeMisteryRL.UI?.render?.();
    }
    return PKM_DB;
  };

  // Catalogo iniziale, esclusivamente da PokeAPI. Non esiste più un DB
  // Pokémon locale o un CDN secondario: Test2 attende questi dati live.
  const loadPokeApiInitialDatabase = async () => {
    if(window.__pokeApiInitialPromise) return window.__pokeApiInitialPromise;
    window.__pokeApiInitialPromise = (async () => {
      window.__pokeApiLoading = true;
      const cache = readLiveCache();
      const ids = Array.from({ length:151 }, (_, index) => index + 1);
      for(let start = 0; start < ids.length; start += 6){
        const group = ids.slice(start, start + 6);
        await Promise.all(group.map(async id => {
          const cached = cache[id];
          let data = cached?.data || null;
          try {
            if(!data){
              const response = await fetch(`${POKEAPI_BASE}/pokemon/${id}`);
              if(!response.ok) return;
              data = await response.json();
              cache[id] = { savedAt:Date.now(), data };
            }
            seedLivePokemon(data);
            const evolution = await loadLiveEvolution(id, data, cached?.evolution);
            if(evolution) cache[id].evolution = evolution;
          } catch(_) { /* l'API è la sola fonte scelta per la modalità */ }
        }));
      }
      writeLiveCache(cache);
      window.__pokeApiLoading = false;
      window.__pokeApiReady = Object.keys(PKM_DB).length > 0;
      window.dispatchEvent(new CustomEvent("pokeapi:ready"));
      return PKM_DB;
    })();
    return window.__pokeApiInitialPromise;
  };

  // Catalogo completo delle specie PokéAPI. Il primo avvio mantiene il
  // caricamento rapido dei 151 iniziali; tutte le altre specie arrivano poi
  // in background, vengono salvate nella cache e diventano subito selezionabili
  // per starter, compagni e pool casuali della run successiva.
  const loadPokeApiCompleteDatabase = async () => {
    if(window.__pokeApiCompletePromise) return window.__pokeApiCompletePromise;
    window.__pokeApiCompletePromise = (async () => {
      const cache = readLiveCache();
      let catalog = [];
      try {
        const response = await fetch(`${POKEAPI_BASE}/pokemon-species?limit=100000`);
        if(!response.ok) return PKM_DB;
        const data = await response.json();
        catalog = Array.isArray(data?.results) ? data.results : [];
      } catch(_) { return PKM_DB; }

      let changed = false;
      for(let start = 0; start < catalog.length; start += 8){
        const group = catalog.slice(start, start + 8);
        await Promise.all(group.map(async species => {
          const id = idFromApiUrl(species?.url);
          if(!id) return;
          let data = cache[id]?.data || null;
          try {
            if(!data){
              const response = await fetch(`${POKEAPI_BASE}/pokemon/${encodeURIComponent(species.name)}`);
              if(!response.ok) return;
              data = await response.json();
              cache[id] = { savedAt:Date.now(), data };
            }
            if(!PKM_DB[id] && seedLivePokemon(data)) changed = true;
            else if(PKM_DB[id] && applyLivePokemon(data)) changed = true;
          } catch(_) { /* la cache e le specie già caricate restano valide */ }
        }));
        // Lascia respirare UI e rete mentre completa il catalogo una volta sola.
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      writeLiveCache(cache);
      window.__pokeApiCompleteReady = true;
      if(changed){
        window.dispatchEvent(new CustomEvent("pokeapi:catalog-ready"));
        if(PKM_RUN && !PKM_RUN.battle) PokeMisteryRL.UI?.render?.();
      }
      return PKM_DB;
    })();
    return window.__pokeApiCompletePromise;
  };

  const getPokeApiItem = async id => {
    const response = await fetch(`${POKEAPI_BASE}/item/${encodeURIComponent(String(id))}`);
    if(!response.ok) throw new Error("Oggetto PokéAPI non trovato");
    return response.json();
  };

  const getPokeApiMove = async id => {
    const response = await fetch(`${POKEAPI_BASE}/move/${encodeURIComponent(String(id))}`);
    if(!response.ok) throw new Error("Mossa PokéAPI non trovata");
    return response.json();
  };

  loadPokeApiInitialDatabase().then(() => loadPokeApiCompleteDatabase());

  return { PKM_DB, buildPokemonDB, getPokemon, getPokemonId, loadPokeApiInitialDatabase, loadPokeApiLiveDatabase, loadPokeApiCompleteDatabase, getPokeApiItem, getPokeApiMove };
})();

// Anche una run già in corso può contenere anteprime o avversari creati prima
// dell'arrivo del catalogo PokéAPI. Uniformiamo i soli record Pokémon (id
// numerico), senza toccare i nomi degli oggetti nello zaino.
const normalizeRunPokemonNames = () => {
  if(!PKM_RUN) return;
  const visited = new WeakSet();
  const visit = value => {
    if(!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if(typeof value.nome === "string" && Number.isFinite(Number(value.id))) value.nome = pokemonName(value.nome);
    Object.values(value).forEach(visit);
  };
  visit(PKM_RUN);
};

const { PKM_DB, buildPokemonDB, getPokemon, getPokemonId } = PokeMisteryRL.Database;
// #endregion
// #region 05 - STATISTICHE / ISTANZE
  PokeMisteryRL.Stats = (() => {
  const getStatsFromBST = (bst, stage=1, apiBaseStats=null) => {
    if(apiBaseStats && typeof apiBaseStats === "object"){
      // I valori PokéAPI preservano la distribuzione reale del BST: ad es.
      // un Pokémon difensivo non riceve più attacco artificiale dal totale.
      return {
        hp:Math.max(1,Math.round(apiBaseStats.hp || 1)),
        atk:Math.max(1,Math.round(apiBaseStats.atk || 1)),
        satk:Math.max(1,Math.round(apiBaseStats.satk || 1)),
        dif:Math.max(1,Math.round(apiBaseStats.def ?? apiBaseStats.dif ?? 1)),
        sdef:Math.max(1,Math.round(apiBaseStats.sdef || 1)),
        spd:Math.max(1,Math.round(apiBaseStats.spd || 1))
      };
    }
    bst = Math.max(1, Number(bst)||1);
    const factor = stage===1?0.92:stage===2?1:stage===3?1.05:1.08;
    const total = bst * factor;
    return { hp:Math.max(1,Math.floor(total*0.25)), atk:Math.max(1,Math.floor(total*0.15)), satk:Math.max(1,Math.floor(total*0.15)), dif:Math.max(1,Math.floor(total*0.15)), sdef:Math.max(1,Math.floor(total*0.15)), spd:Math.max(1,Math.floor(total*0.15)) };
  };
  const rollPokemonStats = () => {
    const between = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const profile = ["tank", "dps", "attacker", "balanced"][Math.floor(Math.random() * 4)];
    if(profile === "tank") return { profile, hp:between(22,42), atk:between(-8,4), satk:between(-5,5), dif:between(16,32), sdef:between(12,28), spd:between(-14,-4) };
    if(profile === "dps") return { profile, hp:between(-8,8), atk:between(14,28), satk:between(8,18), dif:between(-10,2), sdef:between(-8,5), spd:between(14,30) };
    if(profile === "attacker") return { profile, hp:between(8,24), atk:between(24,44), satk:between(4,14), dif:between(-8,6), sdef:between(-6,8), spd:between(-4,10) };
    return { profile, hp:between(10,28), atk:between(2,14), satk:between(2,12), dif:between(2,14), sdef:between(2,14), spd:between(2,14) };
  };
  const createPokemonInstance = (id) => {
    const base = getPokemon(id); if(!base) return null;
    const stats = getStatsFromBST(base.bst, base.stage, base.baseStats); const rolls = rollPokemonStats();
    const finalStats = { hp:Math.max(1,stats.hp+rolls.hp), atk:Math.max(1,stats.atk+rolls.atk), satk:Math.max(1,stats.satk+rolls.satk), dif:Math.max(1,stats.dif+rolls.dif), sdef:Math.max(1,stats.sdef+rolls.sdef), spd:Math.max(1,stats.spd+rolls.spd) };
    const pokemon = {
      id:base.id,
      nome:base.nome,
      immagine:base.immagine,
      tipi:[...base.tipi],
      stage:base.stage,
      bst:base.bst,
      baseStats:{...stats},
      stats:finalStats,
      rolls,
      crit:0,
      stun:0,
      eva:0,
      level:1,
      sk:1,
      fame:100,
      hp:finalStats.hp,
      maxHp:finalStats.hp
    };

    // Il SkillSystem viene definito più avanti nel file, ma questa
    // funzione viene eseguita solo dopo il caricamento completo del JS.
    if (
      typeof PokeMisteryRL_SkillSystem !== "undefined" &&
      typeof PokeMisteryRL_SkillSystem.assignSkills === "function"
    ) {
      PokeMisteryRL_SkillSystem.assignSkills(pokemon);
    }

    return pokemon;
  };
  const getActivePokemon = () => PKM_RUN?.activePokemon || null;
  const getFinalStats = () => { const p=getActivePokemon(); return p? {...p.stats} : {hp:0,atk:0,satk:0,dif:0,sdef:0,spd:0}; };
  const getD = () => { const p=getActivePokemon(); if(!p) return {nome:"-",immagine:"",typing:"Normale",stage:1}; return {nome:p.nome, immagine:p.immagine, typing:p.tipi.join("/"), stage:p.stage}; };
  return { getStatsFromBST, rollPokemonStats, createPokemonInstance, getActivePokemon, getFinalStats, getD };
})();
const { getStatsFromBST, createPokemonInstance, getActivePokemon, getFinalStats, getD } = PokeMisteryRL.Stats;
// #endregion
// #region 06 - LEVEL SYSTEM - AUTONOMO - FINAL

;

// #endregion
// #region 07 - STATO RUN
PokeMisteryRL.Run = (() => {
const createRunState = (starter) => ({
    mode:"torre",
    activePokemon:starter, // STARTER1 FISSO - NON SI TOCCA MAI
    secondActive: null, // STARTER2 - quello che combatte e si cambia
    originPokemon:starter.id,
    level:starter.level, sk:starter.sk,
    floor:1, row:0, col:0, hp:starter.hp, maxHp:starter.maxHp, fame:starter.fame, bits:9999,
    teamSlots:[null], map:[], battle:null, dead:false,
    inventory:[], eggs:[], incubator:{active:false, steps:0, total:0},
    heldItems:{s1:[],s2:[]},
    effects:{ enemyBuff:1, nextEnemyDebuff:1, bossDebuff:1, mirror:false, swapStats:false },
    typeCards:{}
  });
  const buildRunSkeleton = () => {
    clearTimeout(timer);
    if(mapResizeObserver){ mapResizeObserver.disconnect(); mapResizeObserver=null; }
    PKM_RUN=null; busy=0; evoPromptShownFloor=-1;
    $("modal")?.classList.add("hidden");
    if($("eventLog")) $("eventLog").textContent="";
    if($("mapSvg")) $("mapSvg").innerHTML="";
    if($("map")) $("map").innerHTML="";
    if($("bottomContainer")) $("bottomContainer").innerHTML = PokeMisteryRL.UI.buildBottomPanelTemplate();
  };
  const startPokemon = (pokemonId=null, modeName="torre") => {
    buildRunSkeleton(); buildPokemonDB();
    const available = Object.values(PKM_DB);
    if(!available.length){ console.error("Catalogo PokeAPI non pronto"); return; }
    const highBst = available.filter(pokemon => Number(pokemon.bst) >= 550);
    const openingPool = highBst.length ? highBst : available;
    // In Test2 lo starter è sempre scelto dal giocatore nella schermata
    // iniziale; il fallback mantiene Charmander se la scelta non arriva.
    const selectedId = modeName === "test2"
      ? (getPokemonId(pokemonId) ?? getPokemonId(4) ?? rand(available)?.id)
      : (getPokemonId(pokemonId) ?? rand(available)?.id);
    let starter = createPokemonInstance(selectedId); if(!starter) return;
    const modeData = window.PokeMisteryRL_Modes?.get?.(modeName);
    starter.level = modeName === "test2" ? 90 : 5;
    starter.sk = Math.max(1, Number(starter.sk) || 1);
    PKM_RUN = createRunState(starter); PKM_RUN.mode = modeName;
    window.PKM_RUN = PKM_RUN;
    if(modeName === "test2"){
      // La run inizia con il solo starter. Il primo nodo offre tre coppie
      // di compagni e completa S2/S3 dopo la scelta.
      PKM_RUN.secondActive = null;
      PKM_RUN.teamSlots = [null];
      PKM_RUN.starterChosen = false;
      PokeMisteryRL_LevelSystem?.rebuildBaseStats?.(starter);
      PokeMisteryRL_LevelSystem?.setLevel?.(starter, 90);
      starter.hp = starter.maxHp;
      // Una copia di ogni oggetto è disponibile nello zaino iniziale.
      const items = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
      PKM_RUN.items = Object.values(items).filter(item => item?.id).map(item => ({ id:item.id, qty:1 }));
      PKM_RUN.inventory = PKM_RUN.items;
    }
    $("menu")?.classList.add("hidden"); $("game")?.classList.remove("hidden");
    PokeMisteryRL.Map.buildMap(); PokeMisteryRL.UI.render();
    const rolls = Object.entries(starter.rolls).filter(([,v])=>v!==0).map(([k,v])=>`${k.toUpperCase()} ${fmtIV(v)}`).join(" ");
    msg(`${starter.nome} pronto! ${rolls}`);
  };
  const quickReset = () => { if(busy) return; startPokemon(PKM_RUN?.originPokemon, PKM_RUN?.mode||"torre"); };
  const openHomeMenu = () => {
    modal(`<section class="center home-menu"><span>MENU</span><h2>Cosa vuoi fare?</h2><div><button type="button" onclick="openGuideMenu()">GUIDA</button><button type="button" onclick="goMenu()">HOME</button></div><button type="button" onclick="closeModal()">ANNULLA</button></section>`);
  };
  const goMenu = () => { clearTimeout(timer); if(PKM_RUN?.battle) PKM_RUN.battle=null; $("modal")?.classList.add("hidden"); $("game")?.classList.add("hidden"); $("menu")?.classList.remove("hidden"); };
  return { createRunState, buildRunSkeleton, startPokemon, quickReset, openHomeMenu, goMenu };
})();

// Gli oggetti appartengono al Pokémon, non alla posizione Starter/Partner.
const pokemonForHeldSlot = slot => slot === "s1" ? PKM_RUN?.activePokemon : slot === "s2" ? PKM_RUN?.secondActive : null;
const normalizeHeldItems = value => Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
const migrateLegacyHeldItems = () => {
  if(!PKM_RUN || PKM_RUN.heldItemsMigrated) return;
  ["s1", "s2"].forEach(slot => {
    const pokemon = pokemonForHeldSlot(slot);
    if(pokemon && !Array.isArray(pokemon.heldItems)) pokemon.heldItems = normalizeHeldItems(PKM_RUN.heldItems?.[slot]);
  });
  PKM_RUN.heldItemsMigrated = true;
};
const getHeldItemsForPokemon = pokemon => {
  migrateLegacyHeldItems();
  if(!pokemon) return [];
  if(!Array.isArray(pokemon.heldItems)) pokemon.heldItems = [];
  return pokemon.heldItems;
};
const getHeldItemsForSlot = slot => getHeldItemsForPokemon(pokemonForHeldSlot(slot));
// Un solo punto di verità per gli oggetti: battaglia e scheda membro leggono
// gli stessi modificatori, evitando bonus solo visivi o solo di combattimento.
const itemTypeAliases = {fire:"fuoco",water:"acqua",grass:"erba",electric:"elettro",ice:"ghiaccio",fighting:"lotta",ground:"terra",flying:"volante",psychic:"psico",bug:"coleottero",rock:"roccia",ghost:"spettro",dragon:"drago",dark:"buio",steel:"acciaio",fairy:"folletto",normal:"normale",poison:"veleno"};
const normalizeItemType = type => itemTypeAliases[String(type || "").trim().toLowerCase()] || String(type || "").trim().toLowerCase();
const resolveGameItem = entry => {
  const db = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
  const id = String(entry?.id || entry || "").toLowerCase();
  // Compatibilità con la vecchia grafia dell'oggetto Velenaculeo.
  const normalizedId = id === "velenoculeo" ? "velenaculeo" : id;
  return db[normalizedId] || Object.values(db).find(item => String(item?.id || "").toLowerCase() === normalizedId) || entry || null;
};
const getPokemonItemEffects = (pokemon, skill = null) => {
  const external = window.PokeMisteryRL?.ItemEffects?.getPokemonItemEffects;
  if(external) return external(pokemon, skill);
  const held = getHeldItemsForPokemon(pokemon).map(resolveGameItem).filter(Boolean);
  const ids = held.map(item => String(item?.id || "").toLowerCase());
  const moveType = normalizeItemType(skill?.type || skill?.tipo || pokemon?.tipi?.[0] || "normale");
  const evioliteActive = ids.includes("evolcondensa") && !!getPokemon(pokemon?.id)?.evoluzione;
  const weaknessActive = Math.max(1, Number(pokemon?.__weaknessBoost) || 1);
  const typePowerBonus = held.reduce((total, item) => item?.tipo === "potenziamento_tipo" && normalizeItemType(item?.tipo_mossa) === moveType
    ? total + Math.max(0, Number(item?.bonus_danno) || 0) : total, 0);
  const lifeOrbActive = ids.includes("assorbisfera");
  return {
    held, ids, moveType, evioliteActive, weaknessActive, typePowerBonus, lifeOrbActive,
    atkMultiplier: weaknessActive,
    satkMultiplier: weaknessActive,
    difMultiplier: evioliteActive ? 1.5 : 1,
    sdefMultiplier: evioliteActive ? 1.5 : 1,
    // Assorbisfera e i potenziatori di tipo aumentano la potenza della mossa,
    // non le statistiche base del Pokémon.
    movePowerMultiplier: (lifeOrbActive ? 1.3 : 1) * (1 + typePowerBonus)
  };
};
const getEffectivePokemonStats = (pokemon, skill = null) => {
  const external = window.PokeMisteryRL?.ItemEffects?.getEffectivePokemonStats;
  if(external) return external(pokemon, skill);
  const stats = pokemon?.stats || {};
  const effects = getPokemonItemEffects(pokemon, skill);
  return {
    effects,
    hp: Math.max(1, Math.round(Number(stats.hp) || Number(pokemon?.maxHp) || 1)),
    atk: Math.max(1, Math.floor((Number(stats.atk) || 1) * effects.atkMultiplier)),
    satk: Math.max(1, Math.floor((Number(stats.satk) || 1) * effects.satkMultiplier)),
    dif: Math.max(1, Math.floor((Number(stats.dif) || 1) * effects.difMultiplier)),
    sdef: Math.max(1, Math.floor((Number(stats.sdef) || 1) * effects.sdefMultiplier)),
    spd: Math.max(1, Math.floor(Number(stats.spd) || 1))
  };
};
const returnPokemonHeldItemsToBag = pokemon => {
  const held = getHeldItemsForPokemon(pokemon);
  if(!held.length) return 0;
  PKM_RUN.items ||= [];
  held.forEach(removed => {
    const id = String(removed?.id || removed);
    const existing = PKM_RUN.items.find(entry => String(entry?.id || entry) === id);
    if(existing) existing.qty = Math.max(0, Number(existing.qty) || 0) + 1;
    else PKM_RUN.items.push({id, qty:1, nome:removed?.nome, immagine:removed?.immagine || "", icon:removed?.icon});
  });
  pokemon.heldItems = [];
  return held.length;
};

// Le due Campagne Test condividono il motore sperimentale, ma restano run separate.
function isTestCampaign(){
  return PKM_RUN?.mode === "test2";
}
function isTest2Mode(){ return PKM_RUN?.mode === "test2"; }

// Carte Test: ogni effetto vale solo per le mosse del typing indicato.
PokeMisteryRL.TypeCards = window.PokeMisteryRL_TypeCards;
if(!PokeMisteryRL.TypeCards) throw new Error("Modulo carte tipo non caricato");
window.chooseTypeCard = type => PokeMisteryRL.TypeCards?.choose?.(type);
window.rerollTypeCards = () => PokeMisteryRL.TypeCards?.show?.();
window.skipTypeCards = () => next("Nessuna carta scelta.");
window.openFloorUpgradeCollector = () => PokeMisteryRL.TypeCards?.openCollector?.();
// #endregion
// #region 08 - TEAM | 09 - CATTURA | 10 - EVOLUZIONI

;


PokeMisteryRL.TeamRoster = (() => {

  const getFreeSlot = () => {
    if(!PKM_RUN?.teamSlots) return -1;
    const limit = isTest2Mode() ? 1 : PKM_RUN.teamSlots.length;
    const index = PKM_RUN.teamSlots.slice(0, limit).findIndex(s => !s);
    return index;
  };

  const renderTeamSlots = () => {
    if(!PKM_RUN?.teamSlots) return;

    PKM_RUN.teamSlots.forEach((p, i) => {
      const el = $(`teamSlot${i}`);
      if(!el) return;

      if(!p){
        el.innerHTML = "+";
        el.classList.remove("filled");
        return;
      }

      el.classList.add("filled");
      el.innerHTML = `<img src="${sprite(p.immagine)}">`;
    });

    const s2 = $("starter2Slot");
    if(s2){
      const p2 = PKM_RUN.secondActive;
      if(!p2){
        s2.innerHTML = "+ PARTNER";
        s2.classList.remove("filled");
      }else{
        s2.innerHTML = `<img src="${sprite(p2.immagine)}">`;
        s2.classList.add("filled");
      }
    }

  };

  const swapToActive = () => {
    msg("Lo Starter è fisso: usa il Partner.");
  };

  const equipAsSecond = (i) => {

    if(!PKM_RUN){
      return false;
    }
    migrateLegacyHeldItems();

    const index =
      Number(i);

    if(
      !Number.isInteger(index) ||
      index < 0
    ){
      return false;
    }

    const team =
      PKM_RUN.teamSlots || [];

    const selected =
      team[index];

    if(!selected){
      return false;
    }

    const oldS2 =
      PKM_RUN.secondActive || null;

    /*
     * Cambio diretto:
     * riserva[index] <-> S2.
     */
    PKM_RUN.secondActive =
      selected;

    team[index] =
      oldS2;

    PKM_RUN.teamSlots =
      team;

    renderTeamSlots();

    if(PokeMisteryRL?.UI?.refreshBottomPanel){
      PokeMisteryRL.UI.refreshBottomPanel();
    }

    /*
     * Dopo la selezione chiudi automaticamente la schermata S2.
     * Non aprire anteprime o statistiche.
     */
    if(typeof closeTeamPreview === "function") closeTeamPreview();
    if(typeof closePokeInfo === "function") closePokeInfo();
    // La scelta iniziale di S2 usa il modal principale, non l'anteprima squadra.
    if(typeof closeModal === "function") closeModal();

    busy = 0;

    /*
     * NON aprire:
     * - openTeamPreview
     * - openPokeInfo
     * - openSecondPreview
     *
     * Il click serve solo a selezionare il nuovo S2.
     */
    return true;
  };


const unequipSecond = () => {
    if(!PKM_RUN?.secondActive) return;
    migrateLegacyHeldItems();

    const slot = getFreeSlot();
    if(slot < 0){
      msg("Squadra piena");
      return;
    }

    PKM_RUN.teamSlots[slot] = PKM_RUN.secondActive;
    PKM_RUN.secondActive = null;
    closeTeamPreview();
    render();
  };

  const releaseSecond = () => {
    if(!PKM_RUN) return;
    PKM_RUN.secondActive = null;
    closeTeamPreview();
    render();
  };

  const releasePoke = (i) => {
    if(!PKM_RUN?.teamSlots) return;
    PKM_RUN.teamSlots[i] = null;
    closeTeamPreview();
    renderTeamSlots();
    PokeMisteryRL.UI.refreshBottomPanel();
  };

  // Prepara il Pokémon sconfitto per il reclutamento.
  // La cattura è sempre al 100%: l'unica scelta del giocatore è ACCETTARE o RIFIUTARE.
  const captureDefeatedPokemon = (enemy) =>
    prepareRecruitment(enemy);

  const prepareRecruitment = (
    enemy
  ) => {

    if(!enemy || !PKM_RUN){
      return null;
    }

    /*
     * Crea una nuova istanza solo per mantenere i dati strutturali
     * del Pokémon (id, sprite, typing, ecc.).
     */
    const captured =
      createPokemonInstance(enemy.id);

    if(!captured){
      return null;
    }

    /*
     * LIVELLO:
     * usa il livello reale dell'incontro, non quello dello starter
     * e non un valore calcolato dopo la vittoria.
     */
    const encounterLevel =
      Math.max(
        1,
        Number(enemy.level) ||
        Number(PKM_RUN.floor) + 2
      );

    captured.level =
      encounterLevel;

    captured.id =
      enemy.id;

    captured.nome =
      enemy.nome;

    captured.immagine =
      enemy.immagine;

    captured.tipi =
      [...(enemy.tipi || captured.tipi || [])];

    captured.stage =
      enemy.stage ??
      captured.stage;

    captured.bst =
      enemy.bst ??
      captured.bst;

    // Il reclutato usa le proprie statistiche da giocatore al suo livello.
    // Non eredita i moltiplicatori temporanei degli avversari del piano.
    if(typeof PokeMisteryRL_LevelSystem !== "undefined" && typeof PokeMisteryRL_LevelSystem.rebuildBaseStats === "function"){
      PokeMisteryRL_LevelSystem.rebuildBaseStats(captured);
    }
    captured.hp = captured.maxHp;

    return captured;
  };

  // Inserisce il nuovo Pokémon nella prima posizione disponibile.
  // Ordine: 3 slot riserva -> S2 se ancora libero.

  const replacePokemon = (
    target,
    pokemon
  ) => {

    if(!PKM_RUN || !pokemon){
      return false;
    }

    if(target === "s2"){

      if(!PKM_RUN.secondActive){
        return false;
      }

      PKM_RUN.secondActive = pokemon;

      renderTeamSlots();
      PokeMisteryRL.UI.refreshBottomPanel();

      return true;
    }

    const index =
      Number(target);

    if(
      !Number.isInteger(index) ||
      index < 0 ||
      index >= 3
    ){
      return false;
    }

    if(!PKM_RUN.teamSlots?.[index]){
      return false;
    }

    PKM_RUN.teamSlots[index] = pokemon;

    renderTeamSlots();
    PokeMisteryRL.UI.refreshBottomPanel();

    return true;
  };


  const recruitPokemon = (pokemon) => {
    if(!pokemon || !PKM_RUN) return false;

    const slot = getFreeSlot();
    if(slot >= 0){
      PKM_RUN.teamSlots[slot] = pokemon;
      renderTeamSlots();
      PokeMisteryRL.UI.refreshBottomPanel();
      return true;
    }

    // FIX: quando i 3 slot riserva sono pieni ma S2 è vuoto,
    // il quinto Pokémon deve poter entrare come Starter 2.
    if(!PKM_RUN.secondActive){
      PKM_RUN.secondActive = pokemon;
      renderTeamSlots();
      PokeMisteryRL.UI.refreshBottomPanel();
      return true;
    }

    return false;
  };

  return {
    replacePokemon,
    getFreeSlot,
    renderTeamSlots,
    swapToActive,
    releasePoke,
    equipAsSecond,
    unequipSecond,
    releaseSecond,
    prepareRecruitment,
    captureDefeatedPokemon,
    recruitPokemon
  };

})();


PokeMisteryRL.Evo = (() => {

  const getEvolutionTarget = (
    id = getActivePokemon()?.id
  ) => {

    const p = getPokemon(id);

    if(!p) return null;

    const e = p.evoluzione;

    if(!e) return null;

    return getPokemonId(
      e.out ?? e.a ?? e.to
    );
  };


  const getSecondActive = () =>
    PKM_RUN?.secondActive || null;


  const getFixedStarter = () =>
    PKM_RUN?.activePokemon || null; // STARTER1


  const checkEvolutionCondition = (a = getActivePokemon()) => {

    if(!a) return false;

    const p = getPokemon(a.id);

    if(!p?.evoluzione) return false;

    const t = getEvolutionTarget(a.id);

    if(!t) return false;

    const req = Number(p.evoluzione.lv ?? 0);

    if(req > 0 && a.level < req)
      return false;

    return true;
  };


  const canEvolve = () => {

    if(!PKM_RUN)
      return false;

    return getEvolvablePokemon() !== null;
  };

  const getEvolvablePokemon = () => {
    const candidates = [
      { key:"s1", pokemon:PKM_RUN?.activePokemon },
      { key:"s2", pokemon:PKM_RUN?.secondActive },
      ...(PKM_RUN?.teamSlots || []).map((pokemon,index) => ({ key:`team-${index}`, pokemon }))
    ];

    return candidates.find(entry => {
      if(!entry.pokemon || !checkEvolutionCondition(entry.pokemon)) return false;
      return evoPromptShownFloor !== `${PKM_RUN.floor}:${entry.pokemon.id}`;
    }) || null;
  };


  const checkEvolve = () => {

    if(!canEvolve())
      return false;

    showEvolutionPrompt(getEvolvablePokemon());

    return true;
  };


  const showEvolutionPrompt = (candidate = getEvolvablePokemon()) => {

    const active = candidate?.pokemon;
    if(!active) return;

    const targetId = getEvolutionTarget(active.id);

    if(!targetId) return;

    const target = getPokemon(targetId);
    if(!target || !active) return;

    evoPromptShownFloor = `${PKM_RUN.floor}:${active.id}`;

    busy = 1;
    if(isTest2Mode()){
      PKM_RUN.test2EvolutionActive = true;
      const sceneSlot = candidate.key === "s1" ? 0 : candidate.key === "s2" ? 1 : Number(String(candidate.key).replace("team-", "")) + 2;
      document.querySelector(`#bottomCampagna [data-scene-item-target="${sceneSlot}"]`)?.classList.add("test2-is-evolving");
      const map = $("map");
      if(map){
        map.className = "test2-evolution-map";
        map.innerHTML = `<section class="test2-evolution-scene" aria-label="Evoluzione di ${active.nome}"><span>✦ EVOLUZIONE ✦</span><h2>${active.nome} si sta evolvendo...</h2><div class="test2-evolution-stage"><img class="test2-evolution-from" src="${sprite(active.immagine)}" alt="${active.nome}"><i>✦</i><img class="test2-evolution-to" src="${sprite(target.immagine)}" alt="${target.nome}"></div><small>LV ${active.level || 1} · ${active.nome} → ${target.nome}</small></section>`;
      }
      setTimeout(() => evolvePokemon(target.id, candidate.key), 350);
      return;
    }

    modal(`
      <div class="center evolution-modal">
        <div class="evolution-kicker">EVOLUZIONE DISPONIBILE</div>
        <h2>${active.nome} appare!</h2>

        <div class="evolution-stage" aria-label="${active.nome} evolve in ${target.nome}">
          <div class="evolution-form evolution-from">
            <img src="${sprite(active.immagine)}" alt="${active.nome}">
            <b>${active.nome}</b>
          </div>
          <div class="evolution-flash">✦</div>
          <div class="evolution-arrow">→</div>
          <div class="evolution-form evolution-to">
            <img src="${sprite(target.immagine)}" alt="${target.nome}">
            <b>${target.nome}</b>
          </div>
        </div>

        <p class="evolution-caption">${active.nome} si evolve in ${target.nome}...</p>
      </div>
    `);
    // L'evoluzione è obbligatoria: la scena parte automaticamente.
    setTimeout(() => evolvePokemon(target.id, candidate.key), 350);
  };


  const closeEvolutionPrompt = () => {

    closeModal();
    delete PKM_RUN?.test2EvolutionActive;
    document.querySelectorAll("#bottomCampagna .test2-is-evolving").forEach(element => element.classList.remove("test2-is-evolving"));

    busy = 0;

    PokeMisteryRL.UI.render();
  };


  const evolvePokemon = (newId, key = "s1") => {

    const active =
      key === "s1"
        ? PKM_RUN?.activePokemon
        : key === "s2"
          ? PKM_RUN?.secondActive
          : PKM_RUN?.teamSlots?.[Number(String(key).replace("team-", ""))];
    const old = getPokemon(active?.id);
    const target = getPokemon(newId);

    if(!active || !target)
      return;

    const box = document.querySelector(".evolution-modal, .test2-evolution-scene");
    if(box?.dataset.evolving === "true") return;
    if(box){
      box.dataset.evolving = "true";
      box.classList.add("is-evolving");
    }

    const completeEvolution = () => {

    active.id = target.id;
    active.nome = target.nome;
    active.immagine = target.immagine;
    active.tipi = [...target.tipi];
    active.stage = target.stage;
    active.bst = target.bst;

    // Le skill apprese restano con il Pokémon anche dopo l'evoluzione.
    // Se una vecchia run non ne possiede nessuna, assegniamo soltanto la base.
    if(
      (!Array.isArray(active.skills) || !active.skills.length) &&
      typeof PokeMisteryRL_SkillSystem !== "undefined" &&
      typeof PokeMisteryRL_SkillSystem.assignSkills === "function"
    ) PokeMisteryRL_SkillSystem.assignSkills(active);

    PokeMisteryRL_LevelSystem.rebuildBaseStats(active);

    active.hp = active.maxHp;

    if(isTest2Mode()){
      PokeMisteryRL.UI.refreshBottomPanel?.();
      document.querySelectorAll("#bottomCampagna .test2-is-evolving").forEach(element => element.classList.remove("test2-is-evolving"));
      const map = $("map");
      if(map){
        map.className = "test2-evolution-map";
        map.innerHTML = `<section class="test2-evolution-scene test2-evolution-complete" aria-label="Evoluzione completata"><span>✦ EVOLUZIONE COMPLETATA ✦</span><div class="test2-evolution-stage"><img src="${sprite(target.immagine)}" alt="${target.nome}"></div><h2>${old?.nome || "Pokémon"} è diventato ${target.nome}!</h2><button type="button" onclick="PokeMisteryRL.Evo.closeEvolutionPrompt()">CONTINUA</button></section>`;
      }
      msg(`◈ ${old?.nome||"Pokémon"} → ${target.nome} ◈`);
      return;
    }
    PokeMisteryRL.UI.render();
    msg(`◈ ${old?.nome||"Pokémon"} → ${target.nome} ◈`);
    busy = 0;
    modal(`
      <div class="center evolution-result">
        <span class="evolution-kicker">EVOLUZIONE COMPLETATA</span>
        <img src="${sprite(target.immagine)}" alt="${target.nome}">
        <h2>${old?.nome || "Pokémon"} si è evoluto in ${target.nome}!</h2>
        <button class="evolution-confirm" onclick="closeModal(); PokeMisteryRL.UI.render();">CONTINUA</button>
      </div>
    `);
    };

    // Lascia il tempo alla transizione visiva prima di sostituire i dati.
    setTimeout(completeEvolution, box ? 900 : 0);
  };


  return {
    getEvolutionTarget,
    canEvolve,
    checkEvolve,
    showEvolutionPrompt,
    closeEvolutionPrompt,
    evolvePokemon
  };

})();


/*
 * TEAM API
 * CORE 1 contiene ancora TeamRoster inline.
 * La regione Team estratta espone invece PokeMisteryRL.Team.
 * Per mantenere il CORE autonomo e compatibile con entrambe le forme,
 * il modulo Team viene costruito qui soltanto se non è già presente.
 */
PokeMisteryRL.Team = PokeMisteryRL.Team || (() => {

  const getCombinedTeam = () => {
    if (!PKM_RUN) return [];

    const team = [];

    if (PKM_RUN.activePokemon) {
      team.push(PKM_RUN.activePokemon);
    }

    if (PKM_RUN.secondActive) {
      team.push(PKM_RUN.secondActive);
    }

    if (Array.isArray(PKM_RUN.teamSlots)) {
      PKM_RUN.teamSlots.forEach(p => {
        if (p) team.push(p);
      });
    }

    return team;
  };

  const getTeamStats = () => {
    const team = getCombinedTeam();

    return team.reduce((stats, pokemon) => {
      if (!pokemon?.stats) return stats;

      stats.hp += Number(pokemon.stats.hp) || 0;
      stats.atk += Number(pokemon.stats.atk) || 0;
      stats.satk += Number(pokemon.stats.satk) || 0;
      stats.dif += Number(pokemon.stats.dif) || 0;
      stats.sdef += Number(pokemon.stats.sdef) || 0;
      stats.spd += Number(pokemon.stats.spd) || 0;

      return stats;
    }, {
      hp: 0,
      atk: 0,
      satk: 0,
      dif: 0,
      sdef: 0,
      spd: 0
    });
  };

  return {
    getCombinedTeam,
    getTeamStats
  };

})();

// Compatibilità con le vecchie chiamate globali: la funzione vive nel
// modulo Team, non nello scope esterno del core.
const getTeamStats = () => PokeMisteryRL.Team.getTeamStats();


const {
  getFreeSlot,
  renderTeamSlots,
  swapToActive,
  releasePoke,
  equipAsSecond,
  unequipSecond,
  releaseSecond,
  captureDefeatedPokemon
} = PokeMisteryRL.TeamRoster;


const {
  getEvolutionTarget,
  checkEvolve,
  evolvePokemon,
  closeEvolutionPrompt
} = PokeMisteryRL.Evo;


window.closeTeamPreview = () => {
  $("pokePreview")?.classList.add("hidden");
};


const fillPreview = (p, customHTML = "") => {

  $("ppSprite").src =
    typeof sprite === 'function'
      ? sprite(p.immagine)
      : p.immagine;

  $("ppName").textContent = p.nome;

  $("ppLevel").textContent =
    `LV ${p.level}`;

  $("ppTypes").innerHTML =
    (p.tipi || [])
      .map(getTypingBadge)
      .join('');

  const hpPerc =
    Math.floor((p.hp / p.maxHp) * 100);

  $("ppHpFill").style.width =
    hpPerc + "%";

  $("ppHpText").textContent =
    `${p.hp}/${p.maxHp}`;

  $("ppk").textContent =
    p.stats.atk;

  $("ppDef").textContent =
    p.stats.dif;

  $("ppSpd").textContent =
    p.stats.spd;

  // FIX SKILL DB:
  // assegna le skill al Pokémon la prima volta che viene
  // aperta la preview, senza rigenerarle alle aperture successive.
  if (
    p &&
    typeof PokeMisteryRL_SkillSystem !== "undefined" &&
    typeof PokeMisteryRL_SkillSystem.assignSkills === "function" &&
    (!Array.isArray(p.skills) || p.skills.length === 0)
  ) {
    PokeMisteryRL_SkillSystem.assignSkills(p);
  }

const skill =
  typeof PokeMisteryRL_SkillSystem !== "undefined"
    ? PokeMisteryRL_SkillSystem.getPokemonSkill(
        p,
        Number(p.sk) || 1
      )
    : null;

  const baseSkillPower = Number(skill?.pwr ?? skill?.power ?? 0);
  const skillType = normalizeItemType(skill?.type || skill?.tipo || p.tipi?.[0] || "normale");
  const effectiveStats = getEffectivePokemonStats(p, skill);
  const itemEffects = effectiveStats.effects;
  const showModifiedStat = (id, base, multiplier) => {
    const element = $(id);
    if(!element) return;
    const value = Math.max(1, Math.floor(Number(base) * multiplier));
    element.innerHTML = multiplier === 1
      ? String(base)
      : `<s>${base}</s> <strong class="pp-stat-boosted">${value}</strong>`;
  };
  showModifiedStat("ppk", p.stats.atk, itemEffects.atkMultiplier);
  showModifiedStat("ppDef", p.stats.dif, itemEffects.difMultiplier);
  const boostedSkillPower = Math.round(baseSkillPower * itemEffects.movePowerMultiplier);
  const skillPowerHTML = itemEffects.movePowerMultiplier !== 1 && baseSkillPower > 0
    ? `PWR <s>${baseSkillPower}</s> <b class="pp-skill-boosted-power">${boostedSkillPower}</b>`
    : `PWR ${skill?.pwr ?? skill?.power ?? "--"}`;

  $("ppCustomContent").innerHTML = `
    <div class="pp-skills">
      <div id="ppSkill" class="pp-skill-pill">
        <span class="pp-skill-type">${getTypingBadge(skillType)}</span>
        <span id="ppSkillName" class="pp-skill-name">${skill?.name || "--"}</span>

        <span id="ppSkillPower" class="pp-skill-power">
          ${skillPowerHTML}
        </span>
      </div>
    </div>

    ${customHTML}
  `;

  $("pokePreview").classList.remove("hidden");
};


// #endregion

/* ============================================================
   CORE UNIFICATO - CORE 1 + CORE 2
   Tutte le funzioni dei due CORE sono nello stesso scope.
   Nessun bridge di caricamento tra CORE 1 e CORE 2.
   ============================================================ */

// #region 11 - MAPPA | 11 - PROGRESSIONE
PokeMisteryRL.Map = (() => {
  const applyModeMapBackground = () => {
    const wrap = document.querySelector(".map-wrap");
    const shell = document.querySelector(".adventure-shell") || wrap;
    const bottom = $("bottomPanel");
    const modes = window.PokeMisteryRL_Modes;
    const floor = modes?.getFloor?.(PKM_RUN?.mode, PKM_RUN?.floor);
    // Ogni piano ha un set completo coerente: mappa, scena e icona nodo.
    const forest = String(floor?.categoria || "").toLowerCase() === "bosco";
    let background = forest
      ? "./img/prove-bosco/BoscoSmeraldo-Map-Orizzontale.png"
      : "./img/prove-bosco/Grotta-Scenario-Orizzontale.png";

    // La modalità Test usa gli scenari Camp: il sorteggio viene salvato
    // nella run, quindi lo sfondo non cambia a ogni ridisegno della mappa.
    if(isTest2Mode()){
      // Il fondale segue la categoria del piano, senza rigenerarsi a ogni redraw.
      background = forest
        ? "./img/prove-bosco/BoscoSmeraldo-Map-Orizzontale.png"
        : "./img/prove-bosco/Grotta-Scenario-Orizzontale.png";
    }else if(false && isTestCampaign()){
      const currentFloor = Number(PKM_RUN.floor) || 1;
      const maxFloor = Math.max(1, Number(modes?.get?.(PKM_RUN?.mode)?.piani?.length) || 1);
      PKM_RUN.testFloorBackgrounds ||= {};
      if(!PKM_RUN.testFloorBackgrounds[currentFloor]){
        if(currentFloor === 1){
          PKM_RUN.testFloorBackgrounds[currentFloor] = "./img/camp/dungeon_inizio.png";
        }else if(currentFloor >= maxFloor){
          const endings = [
            "./img/camp/dungeon_fine_ 1.png",
            "./img/camp/dungeon_fine_2.png",
            "./img/camp/dungeon_fine_3.png"
          ];
          PKM_RUN.testFloorBackgrounds[currentFloor] =
            endings[Math.floor(Math.random() * endings.length)];
        }else{
          const variant = 2 + Math.floor(Math.random() * 4);
          PKM_RUN.testFloorBackgrounds[currentFloor] = `./img/camp/dungeon_${variant}.png`;
        }
      }
      background = PKM_RUN.testFloorBackgrounds[currentFloor];
    }

    if(!shell) return;

    PKM_RUN.categoria = floor?.categoria || null;
    wrap.dataset.category = PKM_RUN.categoria || "";

    // In Test2 mappa e bottom sono box separati: lo scenario appartiene
    // esclusivamente al box mappa, non al contenitore dell'intera schermata.
    const backgroundTarget = isTest2Mode() && wrap ? wrap : shell;
    if(background){
      const backgroundValue = `url("${background}")`;
      if(isTest2Mode()){
        // Il foglio stile generale azzera .map-wrap con !important:
        // qui lo sfondo del piano deve prevalere solo nella sandbox Test2.
        backgroundTarget.style.setProperty("background-image", backgroundValue, "important");
        // La mappa deve essere sempre leggibile per intero: niente ritagli
        // laterali quando il box cambia proporzione tra mobile e desktop.
        backgroundTarget.style.setProperty("background-size", "contain", "important");
        backgroundTarget.style.setProperty("background-position", "center", "important");
        backgroundTarget.style.setProperty("background-repeat", "no-repeat", "important");
      }else{
        backgroundTarget.style.backgroundImage = backgroundValue;
        backgroundTarget.style.backgroundSize = "cover";
        backgroundTarget.style.backgroundPosition = "center";
      }
    }else{
      backgroundTarget.style.removeProperty("background-image");
      backgroundTarget.style.removeProperty("background-size");
      backgroundTarget.style.removeProperty("background-position");
      backgroundTarget.style.removeProperty("background-repeat");
    }
    if(isTest2Mode() && shell !== backgroundTarget){
      shell.style.removeProperty("background-image");
      shell.style.removeProperty("background-size");
      shell.style.removeProperty("background-position");
    }

    if(bottom){
      bottom.style.removeProperty("background-image");
      bottom.style.removeProperty("background-size");
      bottom.style.removeProperty("background-position");
    }
  };

  // Traduce le regole dichiarative della campagna nelle possibili anteprime
  // nemiche. I filtri delle aree Kanto restano sempre limitati al Pokédex Kanto.
  const getFloorCandidates = (floorData, isBoss, enemyStage) => {
    // PKM_DB è normalizzato dal CORE e non conserva il campo `regione`:
    // in questa campagna il database giocabile è quello Kanto, escluso
    // l'avversario speciale del negozio.
    const all = Object.values(PKM_DB).filter(p => Number(p.id) !== 10001);
    const byNames = names => {
      const wanted = new Set((names || []).map(name => String(name).toLowerCase()));
      return all.filter(p => wanted.has(String(p.nome || "").toLowerCase()));
    };

    if(isBoss){
      if(Array.isArray(floorData?.boss) && floorData.boss.length){
        return byNames(floorData.boss);
      }

      if(floorData?.bossRule === "counterStarter"){
        const starterTypes = getPokemonTypes(PKM_RUN?.activePokemon);
        const counters = all.filter(p =>
          ["Bulbasaur", "Charmander", "Squirtle"].includes(p.nome) &&
          getPokemonTypes(p).some(type => getTypeMultiplier(type, starterTypes) >= 2)
        );
        return counters.length ? counters : all.filter(p => Number(p.stage) === Number(enemyStage));
      }

      if(floorData?.bossRule === "dittoMew"){
        const roster = [PKM_RUN?.activePokemon, PKM_RUN?.secondActive, ...(PKM_RUN?.teamSlots || [])];
        const hasDitto = roster.some(p => String(p?.nome || "").toLowerCase() === "ditto");
        return byNames(hasDitto ? ["Mew"] : ["Arcanine", "Growlithe"]);
      }

      if(floorData?.bossRule === "electricPlantBoss"){
        // Zapdos occupa metà delle estrazioni; l'altra metà è divisa fra
        // Voltorb ed Electrode. Rimane sempre uno scontro 1 contro 1.
        const machineBosses = byNames(["Voltorb", "Electrode"]);
        const zapdos = byNames(["Zapdos"]);
        return [
          ...machineBosses,
          ...zapdos,
          ...zapdos
        ];
      }

      if(floorData?.bossRule === "discardedStartersOrMoltres"){
        const origin = Number(PKM_RUN?.originPokemon);
        const rivalFinals = {
          1: ["Charizard", "Blastoise"],
          4: ["Venusaur", "Blastoise"],
          7: ["Venusaur", "Charizard"]
        };
        const discarded = all.filter(p =>
          (rivalFinals[origin] || ["Venusaur", "Charizard", "Blastoise"]).includes(p.nome) || p.nome === "Moltres"
        );
        const rivals = discarded.filter(p => p.nome !== "Moltres");
        const moltres = discarded.filter(p => p.nome === "Moltres");
        // 50% uno degli starter scartati, 50% Moltres.
        return [...rivals, ...moltres, ...moltres];
      }

      return all.filter(p => Number(p.stage) === Number(enemyStage));
    }

    if(Array.isArray(floorData?.wilds) && floorData.wilds.length){
      return byNames(floorData.wilds);
    }

    const filter = floorData?.wildFilter;
    if(filter){
      const types = (filter.typesAny || []).map(t => String(t).toLowerCase());
      const included = filter.include || [];
      const matchesType = p => !types.length || getPokemonTypes(p).some(t => types.includes(t));
      const matchesStage = p => !filter.stage || Number(p.stage) === Number(filter.stage);
      const selected = all.filter(p =>
        (matchesType(p) && matchesStage(p)) || included.includes(p.nome)
      );
      if(selected.length) return selected;
    }

    return all.filter(p => Number(p.stage) === Number(enemyStage));
  };

  const getBossEncounter = (floorData, enemyStage) => {
    const allBosses = Object.values(PKM_DB).filter(p => Number(p.id) !== 10001);
    const byAllNames = names => {
      const wanted = new Set((names || []).map(name => String(name).toLowerCase()));
      return allBosses.filter(p => wanted.has(String(p.nome || "").toLowerCase()));
    };

    if(Array.isArray(floorData?.bossAlternatives) && floorData.bossAlternatives.length){
      const names = rand(floorData.bossAlternatives) || [];
      return byAllNames(names);
    }
    if(Array.isArray(floorData?.bossPair) && floorData.bossPair.length){
      return byAllNames(floorData.bossPair);
    }

    const candidates = getFloorCandidates(floorData, true, enemyStage)
      .filter((p, index, list) => list.findIndex(other => other.id === p.id) === index);
    const byNames = names => candidates.filter(p => names.includes(p.nome));
    if(floorData?.bossRule === "dittoMew"){
      // Mew è singolo; senza Ditto Arcanine e Growlithe combattono insieme.
      return candidates;
    }
    if(floorData?.bossRule === "discardedStartersOrMoltres"){
      const rivals = candidates.filter(p => p.nome !== "Moltres");
      const moltres = candidates.filter(p => p.nome === "Moltres");
      return Math.random() < .5 ? rivals : moltres;
    }
    return candidates.length ? [rand(candidates)] : [];
  };

  const buildMap = () => {
    applyModeMapBackground();
    const floorData =
      window.PokeMisteryRL_Modes?.getFloor?.(
        PKM_RUN?.mode,
        PKM_RUN?.floor
      ) || null;
    // Ogni riga ha un numero diverso di nodi rispetto alla successiva.
    // La struttura è fissa per evitare righe consecutive uguali.
    // Riga 0 = 1 nodo di partenza, con ESATTAMENTE 3 uscite verso la riga 1.
    // Test2 è un percorso in due tratte: 1/2/3/3 e poi 3/3/2/1.
    // Tutte le colonne da tre condividono le stesse tre altezze visive.
    const test2Profile = window.PokeMisteryRL?.Test2MapProfile;
    const layout = isTest2Mode()
      ? [...(test2Profile?.layout || [1, 2, 3, 3, 3, 3, 2, 1])]
      : [1, 3, 4, 5, 3, 2, 1];
    PKM_RUN.map = [];
    if(isTest2Mode()) PKM_RUN.test2MapPhase = 0;
    PKM_RUN.floorChallenges = {};
    PKM_RUN.floorChallengeDone = {};

    // Percorso core: otto righe fisse e scelte leggibili. Le feature esterne
    // possono aggiungere nodi propri, ma non alterano questa struttura base.
    const test2NodeTypes = isTest2Mode()
      ? (test2Profile?.buildNodeTypes?.({ floor: PKM_RUN?.floor }) || layout.map(count => Array(count).fill("fight")))
      : null;
    if(test2NodeTypes){
      // Fallback completo per build locali che non hanno ancora il profilo esterno.
      if(!test2Profile?.buildNodeTypes){
        const choose = choices => choices[Math.floor(Math.random() * choices.length)];
        test2NodeTypes[0][0] = Number(PKM_RUN.floor) === 1 ? "free" : "shop";
        test2NodeTypes[1] = test2NodeTypes[1].map(() => choose(["fight", "event"]));
        test2NodeTypes[2] = test2NodeTypes[2].map(() => choose(["fight", "event", "skill"]));
        test2NodeTypes[3].fill("fight");
        test2NodeTypes[3][Math.floor(Math.random() * test2NodeTypes[3].length)] = "shop";
        test2NodeTypes[4] = test2NodeTypes[4].map(() => choose(["fight", "event", "skill"]));
        test2NodeTypes[5] = test2NodeTypes[5].map(() => choose(["fight", "event"]));
        test2NodeTypes[6].fill("rifugio");
        test2NodeTypes[layout.length - 1][0] = "boss";
      }
      // Riga 2 (indice 1): scorciatoie di test per le nuove scene.
      // Sono subito raggiungibili dopo l'avvio e non alterano le altre righe.
      if(test2NodeTypes[1]?.length >= 2){
        test2NodeTypes[1][0] = "shop";
        test2NodeTypes[1][1] = "rifugio";
      }
    }
    // Le altre modalità mantengono la distribuzione precedente.
    const dojoCandidates = [];
    const shopNodeId = isTest2Mode() ? "" : "r3c2";
    for(let r = 1; r < layout.length - 2; r++){
      for(let c = 0; c < layout[r]; c++){
        if(`r${r}c${c}` !== shopNodeId) dojoCandidates.push(`r${r}c${c}`);
      }
    }
    const dojoNodes = new Set(
      dojoCandidates.sort(() => Math.random() - .5).slice(0, 2)
    );
    const eventNodes = new Set(
      dojoCandidates.filter(id => !dojoNodes.has(id)).sort(() => Math.random() - .5).slice(0, 2)
    );

    for (let r = 0; r < layout.length; r++) {
      const cols = layout[r];
      const row = [];

      for (let c = 0; c < cols; c++) {
        let type = "free";

        if(test2NodeTypes){
          type = test2NodeTypes[r]?.[c] || "fight";
        } else if (r === 0) {
          type = "free";
        } else if (r === layout.length - 1) {
          type = "boss";
        } else if (r === layout.length - 2) {
          type = "rifugio";
        } else if (`r${r}c${c}` === shopNodeId) {
          type = "shop";
        } else if (dojoNodes.has(`r${r}c${c}`)) {
          type = "skill";
        } else if (eventNodes.has(`r${r}c${c}`)) {
          type = "event";
        } else {
          type = "fight";
        }

        const node = {
          id: `r${r}c${c}`,
          row: r,
          col: c,
          type,
          ok: r === 0,
          done: false,
          kid: []
        };

        // Per ogni nodo fight/boss scegliamo subito il Pokémon da mostrare.
        // Usiamo solo PKM_DB, che è già disponibile nel CORE.
        if(type === "fight" || BossWaves.isBossType(type)){

          const enemyStage =
            BossWaves.isBossType(type)
              ? (PKM_RUN.floor < 3 ? 1 : PKM_RUN.floor < 6 ? 2 : 3)
              : (PKM_RUN.floor < 2 ? 1 : PKM_RUN.floor < 5 ? 2 : 3);

          const candidates = BossWaves.isBossType(type)
            ? getBossEncounter(floorData, enemyStage)
            : getFloorCandidates(floorData, false, enemyStage);

          const preview = p => ({ id:p.id, nome:p.nome, immagine:p.immagine, stage:Number(p.stage) });
          if(candidates.length){
            if(BossWaves.isBossType(type)){
              node.enemyPreview = preview(candidates[0]);
              node.enemyPreviews = candidates.map(preview);
            }else{
              node.enemyPreview = preview(rand(candidates));
            }
          }
          const wavePreviews = BossWaves.buildPreviews(PKM_DB, type, preview);
          if(wavePreviews.length){
            node.enemyPreviews = wavePreviews;
            node.enemyPreview = wavePreviews[0];
          }
        }

        // Il Rifugio è protetto da Chansey: la sua icona anticipa lo scontro.
        if(type === "rifugio"){
          const chansey = Object.values(PKM_DB).find(
            p => String(p.nome || "").toLowerCase() === "chansey"
          );
          if(chansey){
            node.enemyPreview = {
              id: chansey.id,
              nome: chansey.nome,
              immagine: chansey.immagine,
              stage: Number(chansey.stage)
            };
            PKM_RUN.floorChallenges.rifugio ||= { preview:node.enemyPreview };
            node.enemyPreview = PKM_RUN.floorChallenges.rifugio.preview;
          }
        }

        // Ogni negozio è custodito da Kecleon: preview e incontro sono fissi.
        if(type === "shop" && !PKM_RUN.kecleonDefeated){
          const kecleon = Object.values(PKM_DB).find(
            p => String(p.nome || "").toLowerCase() === "kecleonnegozio"
          );
          if(kecleon){
            node.enemyPreview = {
              id: kecleon.id,
              nome: kecleon.nome,
              immagine: kecleon.immagine,
              stage: Number(kecleon.stage)
            };
          }
        }

        if(type === "skill"){
          const enemyStage = PKM_RUN.floor < 2 ? 1 : PKM_RUN.floor < 5 ? 2 : 3;
          const fighters = Object.values(PKM_DB).filter(
            p => Number(p.stage) === enemyStage && (p.tipi || []).includes("lotta")
          );
          const chosen = rand(fighters.length ? fighters : Object.values(PKM_DB).filter(p => (p.tipi || []).includes("lotta")));
          if(chosen) node.enemyPreview = { id:chosen.id, nome:chosen.nome, immagine:chosen.immagine, stage:Number(chosen.stage) };
          if(node.enemyPreview){
            PKM_RUN.floorChallenges.skill ||= { preview:node.enemyPreview };
            node.enemyPreview = PKM_RUN.floorChallenges.skill.preview;
          }
        }

        // Eventi Avventura: un branco di Pokémon del bioma assale la squadra.
        // Il premio è sempre lo strumento che potenzia il tipo scelto.
        if(type === "event"){
          const itemDb = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
          const typeItems = Object.values(itemDb).filter(item => item?.tipo === "potenziamento_tipo");
          const wildPool = getFloorCandidates(floorData, false, 0);
          const availableTypes = [...new Set(wildPool.flatMap(p => p.tipi || []))]
            .filter(type => typeItems.some(item => String(item.tipo_mossa).toLowerCase() === String(type).toLowerCase()));
          const eventType = rand(availableTypes) || rand(typeItems)?.tipo_mossa || "normale";
          const groupPool = wildPool.filter(p => (p.tipi || []).includes(eventType));
          const fallbackPool = Object.values(PKM_DB).filter(p => p?.immagine && Number(p.stage) <= Math.max(1, Number(PKM_RUN.floor) || 1));
          const leader = rand(groupPool.length ? groupPool : (wildPool.length ? wildPool : fallbackPool));
          const groupSize = isTest2Mode() ? 2 + Math.floor(Math.random() * 2) : 2;
          const group = isTest2Mode() && leader ? Array.from({length:groupSize}, () => leader) : [...groupPool].sort(() => Math.random() - .5).slice(0, 2);
          const reward = typeItems.find(item => String(item.tipo_mossa).toLowerCase() === String(eventType).toLowerCase());
          node.eventType = eventType;
          // In Test2 questo evento è il Passaggio nascosto: un incontro
          // facoltativo di reclutamento, non il branco con pedaggio.
          if(isTest2Mode()) node.eventKind = Math.random() < .5 ? "toll" : "hidden-recruit";
          node.eventRewardId = reward?.id || null;
          node.toll = isTest2Mode() ? Math.max(60, 50 + Number(PKM_RUN.floor || 1) * 50) : 0;
          node.enemyPreviews = group.map(p => ({ id:p.id, nome:p.nome, immagine:p.immagine, stage:Number(p.stage) }));
          node.enemyPreview = node.enemyPreviews[0] || null;
        }

        row.push(node);
      }

      PKM_RUN.map.push(row);
    }

    // Collega le righe mantenendo l'ordine orizzontale: nessuna linea
    // può incrociarsi e ogni tratteggio corrisponde a una scelta reale.
    for (let r = 0; r < PKM_RUN.map.length - 1; r++) {
      const cur = PKM_RUN.map[r];
      const nxt = PKM_RUN.map[r + 1];

      cur.forEach((node) => {
        const choices = new Set();

        // Caso speciale: il primo nodo deve avere sempre tutte le uscite.
        if (r === 0) {
          for (let c = 0; c < nxt.length; c++) choices.add(c);
        } else {
          // Ogni nodo occupa una fascia della riga successiva. Le fasce
          // confinanti condividono soltanto il bordo, quindi non creano X.
          const start = Math.floor(node.col * nxt.length / cur.length);
          const end = Math.min(
            nxt.length - 1,
            Math.floor((node.col + 1) * nxt.length / cur.length)
          );

          for(let c = start; c <= end; c++) choices.add(c);
        }

        node.kid = [...choices];
      });
    }

    // La riga 1 deve presentare 3 scelte distinte e non duplicare mai lo stesso nodo.
    // I nodi sono identificati dalla loro colonna, quindi Set/kid garantisce l'unicità.
  };
  // Passaggio nascosto delle Campagne: una piccola deviazione fatta solo di combattimenti.
  const buildExtraPassageMap = () => {
    if(!PKM_RUN) return;
    applyModeMapBackground();
    const floorData = window.PokeMisteryRL_Modes?.getFloor?.(PKM_RUN.mode, PKM_RUN.floor) || null;
    const layout = [1, 2, 2, 1];
    const allPokemon = Object.values(PKM_DB).filter(Boolean);
    const findLine = start => {
      const line = [];
      let current = start;
      const seen = new Set();
      while(current && !seen.has(current.id)){
        line.push(current);
        seen.add(current.id);
        current = allPokemon.find(pokemon => Number(pokemon.id) === Number(current.evoluzione?.a));
      }
      return line;
    };
    const roots = allPokemon.filter(pokemon => !allPokemon.some(other => Number(other.evoluzione?.a) === Number(pokemon.id)));
    const mainCandidates = getFloorCandidates(floorData, false, 0);
    const eligibleLines = roots.map(findLine).filter(line => line.length >= 3 && line.some(pokemon => mainCandidates.some(candidate => Number(candidate.id) === Number(pokemon.id))));
    const line = rand(eligibleLines.length ? eligibleLines : roots.map(findLine).filter(entry => entry.length >= 3));
    const stages = line ? {
      1: line.find(pokemon => Number(pokemon.stage) === 1) || line[0],
      2: line.find(pokemon => Number(pokemon.stage) === 2) || line[1] || line[0],
      3: line.find(pokemon => Number(pokemon.stage) === 3) || line[line.length - 1]
    } : {};
    // Tre stadi sempre presenti: 1/1+2/1+2+2/2+3/3-boss.
    const stagePlan = [[1], [1,2], [2,2], [3]];
    PKM_RUN.map = layout.map((count, rowIndex) => Array.from({length:count}, (_, col) => {
      const stage = stagePlan[rowIndex][col];
      const chosen = stages[stage] || rand(mainCandidates);
      const rescuedFriend = rowIndex === layout.length - 1 ? PKM_RUN.hiddenRescue?.friend : null;
      return {
        id:`passage-r${rowIndex}c${col}`,
        row:rowIndex,
        col,
        type:"fight",
        rescueBoss:rowIndex === layout.length - 1,
        ok:rowIndex === 0,
        done:false,
        kid:[],
        enemyPreview:rescuedFriend || (chosen ? { id:chosen.id, nome:chosen.nome, immagine:chosen.immagine, stage:Number(chosen.stage) } : null),
        passageLine: line?.map(pokemon => pokemon.nome) || []
      };
    }));
    for(let rowIndex = 0; rowIndex < PKM_RUN.map.length - 1; rowIndex++){
      const current = PKM_RUN.map[rowIndex], nextRow = PKM_RUN.map[rowIndex + 1];
      current.forEach(node => {
        const first = Math.floor(node.col * nextRow.length / current.length);
        const last = Math.min(nextRow.length - 1, Math.floor((node.col + 1) * nextRow.length / current.length));
        node.kid = Array.from({length:last - first + 1}, (_, index) => first + index);
      });
    }
    PKM_RUN.row = 0;
    PKM_RUN.col = 0;
    PKM_RUN.lastDoneId = null;
  };
  const drawMapLines = () => {
    const svg=$("mapSvg"), map=$("map"); if(!svg||!map||!PKM_RUN?.map?.length) return; svg.innerHTML=""; const rect=svg.getBoundingClientRect(); svg.setAttribute("width",rect.width); svg.setAttribute("height",rect.height); svg.setAttribute("viewBox",`0 0 ${rect.width} ${rect.height}`);
    PKM_RUN.map.forEach(row=>{ row.forEach(node=>{ const from=$(`n-${node.id}`); if(!from)return; node.kid.forEach(childCol=>{ const child=PKM_RUN.map[node.row+1]?.find(i=>i.col===childCol); if(!child)return; const to=$(`n-${child.id}`); if(!to)return; const a=from.getBoundingClientRect(), b=to.getBoundingClientRect(); const cx1=a.left-rect.left+a.width/2, cy1=a.top-rect.top+a.height/2, cx2=b.left-rect.left+b.width/2, cy2=b.top-rect.top+b.height/2; const dx=cx2-cx1, dy=cy2-cy1, dist=Math.hypot(dx,dy); if(!dist)return; const nx=dx/dist, ny=dy/dist; const line=document.createElementNS("http://www.w3.org/2000/svg","line"); line.setAttribute("x1",cx1+nx*a.width/2); line.setAttribute("y1",cy1+ny*a.height/2); line.setAttribute("x2",cx2-nx*b.width/2); line.setAttribute("y2",cy2-ny*b.height/2); line.classList.add("map-line"); const travelled=node.done && child.done && child.parentId===node.id; const available=node.done && child.ok; line.classList.add(travelled?"done":available?"available":"locked"); svg.appendChild(line); }); }); });
  };
  return { buildMap, buildExtraPassageMap, drawMapLines, applyModeMapBackground };
})();
PokeMisteryRL.Progress = (() => {
  // Stato autoritativo della scelta iniziale: non si fida mai del DOM.
  const armStartSelection = (phase, offers, nodeId = null) => {
    if(!PKM_RUN) return null;
    const token = (Number(PKM_RUN.startSelection?.token) || 0) + 1;
    return PKM_RUN.startSelection = { phase, offers, nodeId, locked:false, token };
  };
  const isStartSelection = phase => {
    const selection = PKM_RUN?.startSelection;
    return !!selection && selection.phase === phase && !selection.locked;
  };
  const openStartingStarterChoice = () => {
    if(!isTest2Mode() || !PKM_RUN) return false;
    const map = $("map");
    if(!map) return false;
    if(!Array.isArray(PKM_RUN.startingStarterChoices)){
      const pool = Object.values(PKM_DB)
        // Solo forme realmente base: no evoluti (es. Kingler) e nessun
        // leggendario fuori dalla fascia naturale di uno starter.
        .filter(pokemon => Number(pokemon.stage) === 1)
        .filter(pokemon => Number(pokemon.bst) >= 250 && Number(pokemon.bst) <= 480)
        .sort(() => Math.random() - .5);
      PKM_RUN.startingStarterChoices = pool.slice(0, 5).map(pokemon => pokemon.id);
    }
    const choices = PKM_RUN.startingStarterChoices.map(id => PKM_DB[id]).filter(Boolean);
    map.className = "test2-starter-choice-map";
    map.removeAttribute("style");
    if(!choices.length) return false;
    armStartSelection("starter", choices.map(pokemon => Number(pokemon.id)));
    const bottom = $("bottomContainer");
    if(bottom){
      bottom.innerHTML = `<section id="test2StarterPreview" class="test2-starter-preview" aria-label="Candidati starter"><span class="test2-starter-scene-label">SQUADRA</span><nav class="test2-utility-bar" aria-label="Comandi run"><span class="test2-utility-money">💰 <b>${Number(PKM_RUN?.bits) || 0}</b></span><button type="button" onclick="openHomeMenu()" aria-label="Menu">☰</button><button type="button" onclick="quickReset()" aria-label="Ricomincia">↻</button><button type="button" onclick="toggleInventory()" aria-label="Zaino">🎒</button></nav><div>${choices.map(pokemon => `<article><span class="test2-starter-scene-top"><em>${(pokemon.tipi || []).map(getTypingBadge).join("")}</em><i><small>HP</small><u></u></i></span><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"><span class="test2-starter-scene-bottom"><b>${pokemon.nome}</b><small>LV 90</small></span></article>`).join("")}</div></section>`;
      bottom.style.setProperty("background-image", 'linear-gradient(rgba(5,10,21,.08),rgba(1,4,12,.32)),url("./img/prove-bosco/Grotta-Scenario.png")', "important");
      bottom.style.setProperty("background-size", "cover", "important");
      bottom.style.setProperty("background-position", "center bottom", "important");
      bottom.style.setProperty("background-repeat", "no-repeat", "important");
    }
    map.innerHTML = `<section class="test2-starter-choice-panel" aria-label="Scegli uno starter"><header><span>⭐ SCEGLI LO STARTER</span><small>Scegli uno dei cinque Pokémon della scena.</small></header><div>${choices.map(pokemon => `<button type="button" data-start-choice="starter" data-starter-id="${Number(pokemon.id)}" onclick="chooseCampaignStarter(${Number(pokemon.id)})"><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"></button>`).join("")}</div></section>`;
    return true;
  };
  const chooseStartingStarter = id => {
    if(!isTest2Mode() || !PKM_RUN) return false;
    const selectedId = Number(id);
    if(!isStartSelection("starter") || !PKM_RUN.startSelection.offers.includes(selectedId)) return false;
    PKM_RUN.startSelection.locked = true;
    const starter = createPokemonInstance(selectedId);
    if(!starter){ PKM_RUN.startSelection.locked = false; return false; }
    starter.level = 90;
    starter.sk = Math.max(1, Number(starter.sk) || 1);
    PokeMisteryRL_LevelSystem?.rebuildBaseStats?.(starter);
    PokeMisteryRL_LevelSystem?.setLevel?.(starter, 90);
    starter.hp = starter.maxHp;
    PKM_RUN.activePokemon = starter;
    // Finché non viene scelta la coppia iniziale lo teniamo come riferimento
    // della scena. Al primo nodo verrà spostato definitivamente in S3.
    PKM_RUN.pendingStarter = starter;
    PKM_RUN.teamSlots = [starter];
    PKM_RUN.originPokemon = starter.id;
    PKM_RUN.level = starter.level;
    PKM_RUN.hp = starter.hp;
    PKM_RUN.maxHp = starter.maxHp;
    PKM_RUN.starterChosen = true;
    PKM_RUN.startSelection = { phase:"awaiting-partners", offers:[], locked:true, token:PKM_RUN.startSelection.token };
    busy = 0;
    PokeMisteryRL.UI.refreshBottomPanel?.();
    const map = $("map");
    if(map){ map.className = ""; map.removeAttribute("style"); }
    PokeMisteryRL.UI.render();
    // La scena viene appena ricostruita: aggiorna ora la scheda con i valori
    // definitivi dello starter scelto, non al click del nodo successivo.
    PokeMisteryRL.UI.refreshBottomPanel?.();
    msg(`${starter.nome} è il tuo starter.`);
    return true;
  };
  const openStartingPartnerChoice = (node) => {
    if(!PKM_RUN || !node) return;
    if(!Array.isArray(node.startingPartnerPairs)){
      const candidates = Object.values(PKM_DB)
        .filter(p => Number(p.id) !== Number(PKM_RUN.activePokemon?.id))
        .filter(p => Number(p.bst) >= 400)
        .sort(() => Math.random() - .5);
      const fallback = Object.values(PKM_DB)
        .filter(p => Number(p.id) !== Number(PKM_RUN.activePokemon?.id))
        .sort(() => Math.random() - .5);
      const pool = candidates.length >= 6 ? candidates : fallback;
      node.startingPartnerPairs = Array.from({length:3}, (_, index) =>
        [pool[index * 2], pool[index * 2 + 1]].filter(Boolean).map(p => p.id)
      ).filter(pair => pair.length === 2);
    }
    const choices = node.startingPartnerPairs
      .map(pair => pair.map(id => PKM_DB[id]).filter(Boolean))
      .filter(pair => pair.length === 2);
    if(!choices.length) return false;
    armStartSelection("companions", choices.map(pair => pair.map(pokemon => Number(pokemon.id))), node.id);
    const choiceMarkup = `<section class="test2-companion-choice-panel"><span>⭐ SCEGLI I COMPAGNI</span><p>Scegli una coppia: entrambi entrano in squadra al livello 90.</p><div>${choices.map(pair => `<button type="button" data-start-choice="companions" data-first-id="${Number(pair[0].id)}" data-second-id="${Number(pair[1].id)}" onclick="chooseStartingPair(${Number(pair[0].id)},${Number(pair[1].id)})"><span><img src="${sprite(pair[0].immagine)}" alt="${pair[0].nome}"><img src="${sprite(pair[1].immagine)}" alt="${pair[1].nome}"></span><b>${pair[0].nome} + ${pair[1].nome}</b><small>LV 90 · LV 90</small></button>`).join("")}</div></section>`;
    if(isTest2Mode()){
      const map = $("map");
      if(map){
        map.className = "test2-companion-choice-map";
        map.removeAttribute("style");
        map.innerHTML = choiceMarkup;
        return;
      }
    }
    modal(`<div class="center starter-picker starting-s2-picker">${choiceMarkup}</div>`);
  };

  const chooseStartingPair = (firstId, secondId) => {
    if(!PKM_RUN) return false;
    const first = Number(firstId), second = Number(secondId);
    if(!isStartSelection("companions")) return false;
    const offered = PKM_RUN.startSelection.offers.some(pair => pair[0] === first && pair[1] === second);
    if(!offered) return false;
    PKM_RUN.startSelection.locked = true;
    const partners = [first, second].map(createPokemonInstance).filter(Boolean);
    if(partners.length !== 2){ PKM_RUN.startSelection.locked = false; return false; }
    partners.forEach(partner => {
      partner.level = 90;
      partner.sk = Math.max(1, Number(partner.sk) || 1);
      PokeMisteryRL_LevelSystem?.rebuildBaseStats?.(partner);
      PokeMisteryRL_LevelSystem?.setLevel?.(partner, 90);
      partner.hp = partner.maxHp;
      PokeMisteryRL_SkillSystem?.assignSkills?.(partner);
    });
    const starter = PKM_RUN.pendingStarter || PKM_RUN.activePokemon;
    PKM_RUN.activePokemon = partners[0];
    PKM_RUN.secondActive = partners[1];
    PKM_RUN.teamSlots = [starter];
    delete PKM_RUN.pendingStarter;
    delete PKM_RUN.startSelection;
    PokeMisteryRL.UI.refreshBottomPanel();
    next(`${partners[0].nome} e ${partners[1].nome} si uniscono alla squadra.`);
    return true;
  };

  const openShelterChallenge = () => {
    const chanseyBase = Object.values(PKM_DB).find(
      p => String(p.nome || "").toLowerCase() === "chansey"
    );
    const chansey = chanseyBase ? createPokemonInstance(chanseyBase.id) : null;
    if(!chansey){ rifugio(); return; }
    const level = 1;
    chansey.level = level;
    if(isTest2Mode()){
      // L'id della mappa si ripete ad ogni piano: includere il piano evita
      // che un Rifugio nei piani successivi venga scambiato per già curato.
      const nodeId = `${Number(PKM_RUN?.floor) || 1}:${PKM_RUN?.map?.[PKM_RUN?.row]?.[PKM_RUN?.col]?.id || "rifugio"}`;
      if(PKM_RUN.shelterArrivalNodeId !== nodeId){
        [PKM_RUN.activePokemon, PKM_RUN.secondActive, ...(PKM_RUN.teamSlots || [])].filter(Boolean).forEach(pokemon => {
          const maxHp = Math.max(1, Number(pokemon.maxHp) || 1);
          pokemon.hp = Math.min(maxHp, Math.max(0, Number(pokemon.hp) || 0) + Math.ceil(maxHp * .5));
        });
        PKM_RUN.shelterArrivalNodeId = nodeId;
      }
      PKM_RUN.test2SceneBuildingHidden ||= {};
      delete PKM_RUN.test2SceneBuildingHidden.campeggio;
      PKM_RUN.test2Scene = "campeggio";
      PokeMisteryRL.UI?.refreshBottomPanel?.();
      const bottom = $("bottomCampagna");
      bottom?.querySelectorAll(".test2-shelter-chansey").forEach(entry => entry.remove());
      if(bottom){
        bottom.insertAdjacentHTML("beforeend", `<div class="test2-shelter-chansey"><img src="${sprite(chansey.immagine)}" alt="Chansey"><em>LV ${level}</em></div>`);
      }
      const map = $("map");
      if(map){
        map.className = "test2-shelter-map";
        map.innerHTML = `<section class="test2-shelter-panel"><span>♥ RIFUGIO</span><h2>Punto di ristoro</h2><p>La squadra recupera il <b>50%</b> degli HP all'arrivo.</p><div class="test2-shelter-offer"><b>SFIDA DEL RIFUGIO · LV 1</b><small>Vinci e ricevi 2 oggetti curativi.</small></div><div><button type="button" onclick="acceptShelterChallenge()">⚔ ACCETTA SFIDA</button><button type="button" onclick="rejectShelterChallenge()">USA IL RIFUGIO</button></div></section>`;
      }
      busy = 0;
      return;
    }
    const stats = chansey.stats || {};
    const moves = (chansey.skills || []).map(move =>
      `<li><b>${move.nome || move.name || "Mossa"}</b><small>PWR ${move.pwr ?? move.power ?? "--"}</small></li>`
    ).join("") || "<li>Nessuna mossa disponibile</li>";
    modal(`
      <div class="center shelter-challenge">
        <div class="shelter-challenge-header">
          <img src="${sprite(chansey.immagine)}" alt="Chansey">
          <div><span>🏠 RIFUGIO</span><h2>La sfida di Chansey</h2><p>Vuole testare la tua squadra prima di aiutarti.</p></div>
        </div>
        <div class="shelter-challenge-card">
          <div class="shelter-challenge-identity"><b>Chansey</b><span>LV ${level} · NORMALE</span><small>HP ${chansey.hp}/${chansey.maxHp}</small></div>
          <div class="shelter-challenge-stats"><span><small>ATK</small><b>${stats.atk ?? 0}</b></span><span><small>SPA</small><b>${stats.satk ?? 0}</b></span><span><small>DEF</small><b>${stats.dif ?? 0}</b></span><span><small>SPD</small><b>${stats.spd ?? 0}</b></span></div>
          <div class="shelter-challenge-moves"><b>MOSSE</b><ul>${moves}</ul></div>
        </div>
        <div class="shelter-challenge-reward">✨ Vincendo, scegli un compagno che ottiene <b>+5 livelli</b>.</div>
        <div class="shelter-challenge-actions"><button type="button" onclick="acceptShelterChallenge()">⚔️ ACCETTA LA SFIDA</button><button type="button" onclick="rejectShelterChallenge()">VAI AL RIFUGIO</button></div>
      </div>
    `);
  };

  const acceptShelterChallenge = () => {
    if(!PKM_RUN) return false;
    PKM_RUN.floorChallengeDone ||= {};
    PKM_RUN.floorChallengeDone.rifugio = true;
    if(isTest2Mode()){
      $("bottomCampagna")?.classList.remove("test2-node-finish");
      PokeMisteryRL.UI.refreshBottomPanel();
      const map = $("map");
      if(map){
        map.className = "test2-shelter-map test2-shelter-fight-pending";
        const title = map.querySelector("h2");
        const text = map.querySelector("p");
        if(title) title.textContent = "Sfida in corso";
        if(text) text.textContent = "Attendi l'esito del combattimento.";
        map.querySelectorAll("button").forEach(button => { button.disabled = true; });
      }
    }
    fight(false);
    return true;
  };

  const rejectShelterChallenge = () => {
    if(isTest2Mode()){
      // Non c'è stata battaglia: annulla il ritorno automatico al Rifugio,
      // altrimenti il primo "RIFIUTA" della schermata reroll la ricreava.
      PKM_RUN.afterBattleNodeType = null;
      busy = 0;
      rifugio();
      return true;
    }
    next("Hai rinunciato alla sfida di Chansey.");
    return true;
  };

  const openSkillChallenge = (node) => {
    const enemy = node?.enemyPreview;
    // Test2: il dojo è una scena nello scenario superiore; la mappa in basso
    // diventa il pannello della sfida, come avviene già per il negozio.
    if(isTest2Mode()){
      PKM_RUN.test2SceneBuildingHidden ||= {};
      delete PKM_RUN.test2SceneBuildingHidden.dojo;
      PKM_RUN.test2Scene = "dojo";
      PokeMisteryRL.UI?.refreshBottomPanel?.();
      const bottom = $("bottomCampagna");
      if(bottom){
        bottom.classList.remove("test2-node-finish");
        bottom.querySelector(".test2-dojo-building")?.remove();
        bottom.querySelectorAll(".test2-dojo-challenger").forEach(entry => entry.remove());
        bottom.insertAdjacentHTML("beforeend", `
          <div class="test2-dojo-challenger">
            <span class="test2-dojo-versus">⚔ VS</span>
            <em class="test2-challenger-level">LV ${enemy?.level || 1}</em>
            <img src="${sprite(enemy?.immagine || "")}" alt="${enemy?.nome || "Sfidante"}">
          </div>
        `);
      }
      const map = $("map");
      if(map){
        map.className = "test2-dojo-map";
        map.innerHTML = `<div class="test2-dojo-hud test2-dojo-challenge-hud"><span>🥋 RICHIESTA DI SFIDA</span><div class="test2-dojo-challenge-body"><div><h2>Accetti la sfida?</h2><p>Affronta il Pokémon del Dojo e conquista un oggetto potenziatore.</p><small>🏆 PREMIO · OGGETTO TIPO</small></div></div><div class="test2-dojo-actions"><button type="button" onclick="acceptSkillChallenge()">⚔ ACCETTA</button><button type="button" onclick="rejectSkillChallenge()">RIFIUTA</button></div></div>`;
      }
      return;
    }
    modal(`
      <div class="center dojo-challenge">
        <div class="dojo-challenge-head"><span>🥋 DOJO</span><h2>Prova di combattimento</h2><p>Un maestro del Dojo mette alla prova la tua squadra.</p></div>
        <div class="dojo-opponent"><img src="${sprite(enemy?.immagine)}" alt="${enemy?.nome || "Avversario"}"><div><b>${enemy?.nome || "Avversario"}</b><span>TIPO LOTTA</span><small>Statistiche del piano corrente</small></div></div>
        <div class="dojo-reward">⚡ Vittoria: una riserva ottiene <b>+2 LIVELLI SKILL</b>.</div>
        <div class="dojo-actions"><button onclick="acceptSkillChallenge()">⚔️ ACCETTA LA PROVA</button><button onclick="rejectSkillChallenge()">ENTRA NEL DOJO</button></div>
      </div>
    `);
  };
  const acceptSkillChallenge = () => {
    PKM_RUN.floorChallengeDone ||= {};
    PKM_RUN.floorChallengeDone.skill = true;
    const map = $("map");
    if(map){
      map.className = "test2-dojo-map test2-dojo-fight-pending";
      map.innerHTML = `<div class="test2-dojo-hud test2-dojo-challenge-hud"><span>🥋 RICHIESTA DI SFIDA</span><div class="test2-dojo-challenge-body"><div><h2>Sfida accettata</h2><p>Il combattimento è in corso…</p><small>⚔ ATTENDI L'ESITO DELLA SFIDA</small></div></div><div class="test2-dojo-actions"><button type="button" disabled>SFIDA IN CORSO</button></div></div>`;
    }
    fight(false); return true;
  };
  const rejectSkillChallenge = () => { PokeMisteryRL.Effects?.skill?.(); return true; };
  const openBossPreparation = () => {
    // Il boss parte subito con la formazione già scelta nella scena.
    closeModal();
    fight(true);
  };
  const bossWaveContext = () => ({
    $,
    db: () => PKM_DB,
    run: () => PKM_RUN,
    sprite,
    isTest2Mode,
    refreshBottom: () => PokeMisteryRL.UI?.refreshBottomPanel?.(),
    renderMap: () => PokeMisteryRL.UI?.renderMap?.(),
    startFight: () => fight(true),
    release: () => { busy = 0; }
  });
  const openWaveBossChallenge = node => window.PokeMisteryRL_BossWaves?.open?.(node, bossWaveContext()) || fight(true);
  const startWaveBossChallenge = () => window.PokeMisteryRL_BossWaves?.start?.(bossWaveContext()) || fight(true);

  const isCampaignMode = () =>
    window.PokeMisteryRL_Modes?.get?.(PKM_RUN?.mode)?.famiglia === "campagne";

  const openHiddenPassage = () => {
    if(!PKM_RUN) return false;
    const floor = Math.max(1, Number(PKM_RUN.floor) || 1);
    const candidates = Object.values(PKM_DB).filter(pokemon => pokemon?.immagine && Number(pokemon.stage || 1) <= Math.min(3, Math.max(1, floor)));
    const previousRescue = PKM_RUN.hiddenRescue;
    const base = previousRescue?.requester || rand(candidates) || rand(Object.values(PKM_DB).filter(pokemon => pokemon?.immagine));
    if(!base) return declineHiddenPassage();
    const friend = previousRescue?.friend || rand(candidates.filter(pokemon => Number(pokemon.id) !== Number(base.id))) || base;
    PKM_RUN.hiddenRescue = {
      requester:{id:base.id,nome:base.nome,immagine:base.immagine},
      friend:{id:friend.id,nome:friend.nome,immagine:friend.immagine,stage:Number(friend.stage)}
    };
    if(isTest2Mode()){
      PKM_RUN.hiddenRescuePrompt = true;
      PKM_RUN.test2Scene = "tunnel";
      PokeMisteryRL.UI?.refreshBottomPanel?.();
      const bottom = $("bottomCampagna");
      bottom?.querySelectorAll(".test2-rescue-request-scene").forEach(entry => entry.remove());
      // Nella richiesta si vede solo chi chiede aiuto: l'amico è davvero
      // bloccato più avanti e compare soltanto nella scena premio.
      bottom?.insertAdjacentHTML("beforeend", `<div class="test2-rescue-request-scene"><img class="test2-rescue-requester" src="${sprite(base.immagine)}" alt="${base.nome}"></div>`);
      const map = $("map");
      if(map){
        map.className = "test2-rescue-prompt-map";
        map.innerHTML = `<section class="test2-rescue-prompt-panel"><span>❓ SOCCORSO</span><h2>${base.nome} chiede aiuto</h2><p>Il suo amico <b>${friend.nome}</b> è bloccato più avanti.</p><div><button type="button" onclick="enterHiddenPassage()">✓ AIUTA</button><button type="button" onclick="declineHiddenPassage()">PROSEGUI</button></div></section>`;
      }
      busy = 0;
      return true;
    }
    modal(`<div class="center hidden-passage-prompt hidden-passage-recruit"><span>❓ PASSAGGIO NASCOSTO</span><img src="${sprite(base.immagine)}" alt="${base.nome}"><h2>${base.nome} chiede soccorso</h2><p>Il suo amico <b>${friend.nome}</b> è bloccato più avanti. Vuoi attraversare il mini-dungeon per aiutarlo?</p><div><button type="button" onclick="enterHiddenPassage()">✓ ANDIAMO</button><button type="button" onclick="declineHiddenPassage()">PROSEGUI</button></div></div>`);
    return true;
  };

  const openTollEvent = node => {
    if(!isTest2Mode() || !node) return false;
    let group = Array.isArray(node.enemyPreviews) ? node.enemyPreviews.filter(Boolean) : [];
    if(!group.length){
      const fallback = rand(Object.values(PKM_DB).filter(p => p?.immagine));
      if(fallback){
        const amount = 2 + Math.floor(Math.random() * 2);
        group = Array.from({length:amount}, () => ({id:fallback.id,nome:fallback.nome,immagine:fallback.immagine,stage:Number(fallback.stage)}));
        node.enemyPreviews = group;
        node.enemyPreview = group[0];
        node.eventType = fallback.tipi?.[0] || "normale";
      }
    }
    const leader = group[0] || node.enemyPreview;
    const toll = Math.max(0, Number(node.toll) || 0);
    const bottom = $("bottomCampagna");
    if(bottom){
      bottom.querySelector(".test2-toll-group")?.remove();
      bottom.insertAdjacentHTML("beforeend", `<div class="test2-toll-group" aria-label="Branco di ${leader?.nome || "Pokémon"}"><div class="test2-toll-bubble">💰 ${toll}</div>${group.map((pokemon,index) => `<span class="test2-toll-level toll-level-${index}">LV ${pokemon?.level || 1}</span><img class="test2-toll-mon toll-mon-${index}" src="${sprite(pokemon?.immagine || leader?.immagine || "eevee.png")}" alt="${pokemon?.nome || leader?.nome || "Pokémon"}">`).join("")}</div>`);
    }
    const map = $("map");
    if(map){
      map.className = "test2-toll-map";
      map.innerHTML = `<section class="test2-toll-panel"><span>❗ PERCORSO BLOCCATO</span><h2>Un gruppo di ${leader?.nome || "Pokémon"} blocca il passaggio</h2><p>Il capo ${leader?.nome || "Pokémon"} chiede <b>💰 ${toll}</b> per lasciarti passare.</p><div><button type="button" ${Number(PKM_RUN?.bits || 0) < toll ? "disabled" : ""} onclick="PokeMisteryRL.Progress.payTollEvent()">PAGA · ${toll}</button><button type="button" onclick="PokeMisteryRL.Progress.refuseTollEvent()">RIFIUTA</button></div><small>Rifiutando affronterai ${group.length || 2} Pokémon uguali.</small></section>`;
    }
    return true;
  };
  const payTollEvent = () => {
    const node = PKM_RUN?.map?.[PKM_RUN?.row]?.[PKM_RUN?.col];
    const toll = Math.max(0, Number(node?.toll) || 0);
    if(!node || Number(PKM_RUN?.bits || 0) < toll) return false;
    PKM_RUN.bits -= toll;
    $("bottomCampagna")?.querySelector(".test2-toll-group")?.remove();
    PokeMisteryRL.UI?.refreshBottomPanel?.();
    next("Hai pagato il branco e prosegui.");
    return true;
  };
  const refuseTollEvent = () => {
    const map = $("map");
    if(map){ map.className = ""; map.innerHTML = ""; }
    $("bottomCampagna")?.querySelector(".test2-toll-group")?.remove();
    fight(false);
    return true;
  };

  const enterHiddenPassage = () => {
    if(!PKM_RUN) return false;
    if(isTest2Mode() && !PKM_RUN.hiddenRescuePrompt) return false;
    delete PKM_RUN.hiddenRescuePrompt;
    PKM_RUN.extraPassage = {
      returnMap: JSON.parse(JSON.stringify(PKM_RUN.map || [])),
      returnRow: PKM_RUN.row,
      returnCol: PKM_RUN.col,
      returnLastDoneId: PKM_RUN.lastDoneId
    };
    $("bottomCampagna")?.querySelectorAll(".test2-rescue-request-scene").forEach(entry => entry.remove());
    PokeMisteryRL.Map.buildExtraPassageMap();
    busy = 0;
    closeModal();
    PokeMisteryRL.UI.render();
    msg("Inizia il soccorso: raggiungi il boss alla fine del passaggio.");
    return true;
  };

  const declineHiddenPassage = () => {
    delete PKM_RUN?.hiddenRescuePrompt;
    $("bottomCampagna")?.querySelectorAll(".test2-rescue-request-scene").forEach(entry => entry.remove());
    busy = 0;
    next("Hai ignorato il passaggio nascosto.");
    return true;
  };

  const pick = (node) => {
    // Il renderer espone sia le uscite disponibili sia il nodo corrente.
    // Il corrente è necessario all'avvio e dopo i ritorni evento: non
    // deve venire scartato solo perché non porta più il flag `ok`.
    const isCurrentNode = node?.row === PKM_RUN?.row && node?.col === PKM_RUN?.col && !node?.done;
    if(busy || (!node?.ok && !isCurrentNode) || PKM_RUN?.dead) return;
    busy=1;
    // Lo zaino è una fase tra due nodi: dal click in poi l'evento possiede
    // entrambi i box e non può essere sovrapposto da schermate inventario.
    if(isTest2Mode()){
      PKM_RUN.test2BackpackAvailable = false;
      delete PKM_RUN.test2BackpackOpen;
      delete PKM_RUN.test2FormationEditing;
    }
    const real=PKM_RUN.map[node.row]?.[node.col];
    if(!real || (!real.ok && !isCurrentNode)){ busy=0; return; }
    if(PKM_RUN.lastDoneId && PKM_RUN.lastDoneId!==real.id){ real.parentId=PKM_RUN.lastDoneId; }
    PKM_RUN.lastDoneId=real.id;
    real.done=true; PKM_RUN.map.forEach(r=>r.forEach(n=>n.ok=false)); PKM_RUN.row=node.row; PKM_RUN.col=node.col;
    // La struttura entra nella scena nello stesso istante in cui viene scelto
    // il suo nodo. Non deve aspettare l'apertura del pannello in basso.
    if(isTest2Mode()){
      const sceneByNode = {skill:"dojo", shop:"bazar", rifugio:"campeggio"};
      const scene = sceneByNode[real.type];
      if(scene){
        PKM_RUN.test2SceneBuildingHidden ||= {};
        delete PKM_RUN.test2SceneBuildingHidden[scene];
        PKM_RUN.test2Scene = scene;
      }
    }
    // Ogni evento riparte dalla scena standard: S1 e S2 vengono sempre
    // ricreati nella loro formazione prima di mostrare l'HUD del nodo.
    if(isTest2Mode()) PokeMisteryRL.UI.refreshBottomPanel?.();
    PokeMisteryRL.UI.render();
    // Il nodo iniziale non è un fight: assegna subito il primo compagno S2.
    if(real.row === 0 && real.col === 0 && !PKM_RUN.secondActive){
      PokeMisteryRL.Progress?.openStartingPartnerChoice?.(real);
      return;
    }
    if(real.type === "rifugio"){
      if(PKM_RUN.floorChallengeDone?.rifugio){ busy = 0; rifugio(); return; }
      PKM_RUN.afterBattleNodeType = "rifugio";
      openShelterChallenge();
      return;
    }
    if(real.type === "skill"){
      if(PKM_RUN.floorChallengeDone?.skill){
        busy = 0;
        if(isTest2Mode()){ PokeMisteryRL.Effects?.skill?.(); return; }
        skill(); return;
      }
      // Test2 gestisce il Dojo interamente nei due box scena/mappa: non deve
      // richiamare la vecchia modale di potenziamento Skill al termine.
      if(!isTest2Mode()) PKM_RUN.afterBattleNodeType = "skill";
      openSkillChallenge(real);
      return;
    }
    // In Campagna il ? apre una deviazione opzionale; in Avventura resta l'imboscata.
    if(real.type === "event"){
      if(isTest2Mode()){
        if(real.eventKind === "toll") openTollEvent(real);
        else openHiddenPassage();
        return;
      }
      if(isCampaignMode()){
        openHiddenPassage();
        return;
      }
      typeof fight === "function" ? fight(false) : next();
      return;
    }
    // Il Negozio è visitabile subito; Kecleon combatte solo al quarto furto.
    if(real.type === "shop"){
      busy = 0;
      window.shop?.();
      return;
    }
    // Ogni nodo non-boss prevede un combattimento. Al termine viene aperto
    // l'effetto originale del nodo (negozio, skill, rifugio...), se presente.
    if(BossWaves.isWaveBoss(real.type)){
      openWaveBossChallenge(real);
      return;
    }
    if(real.type === "boss"){
      openBossPreparation();
      return;
    }
    if(real.type !== "fight") PKM_RUN.afterBattleNodeType = real.type;
    typeof fight === "function" ? fight(false) : next();
  };
  const next = (message="") => {
    if(isTest2Mode()){
      const bottom = $("bottomCampagna");
      bottom?.querySelector(".test2-dojo-challenger")?.remove();
      bottom?.querySelector(".test2-dojo-building")?.remove();
      bottom?.querySelector(".test2-toll-group")?.remove();
      bottom?.querySelector(".test2-event-item-scene")?.remove();
      bottom?.querySelector(".test2-event-reward-team")?.remove();
      bottom?.querySelector(".test2-rescue-request-scene")?.remove();
    }
    if(!PKM_RUN)return;
    const current=PKM_RUN.map[PKM_RUN.row]?.[PKM_RUN.col]; if(!current)return;
    // Gli avvertimenti di furto valgono solo durante la visita corrente.
    // Kecleon sconfitto resta invece assente fino alla fine della run.
    if(current.type === "shop" && !PKM_RUN.kecleonDefeated){
      PKM_RUN.shopTheftAttempts = 0;
      PKM_RUN.shopThefts = 0;
      // Gli scaffali restano fissi soltanto durante la visita corrente.
      // Uscendo, la prossima entrata genera un assortimento nuovo.
      delete PKM_RUN.shopOffers;
      delete PKM_RUN.lastShopOffers;
    }
    // Concluso il nodo, la scena torna neutra. Nessuna struttura può restare
    // appesa nella scelta del nodo seguente.
    if(isTest2Mode()){
      PKM_RUN.test2SceneBuildingHidden ||= {};
      const sceneByNode = {skill:"dojo", shop:"bazar", rifugio:"campeggio"};
      const scene = sceneByNode[current.type];
      if(scene) PKM_RUN.test2SceneBuildingHidden[scene] = true;
      PKM_RUN.test2Scene = "tunnel";
    }
    // Dopo la prima tratta 1/2/3/3, Test2 mantiene visibile la colonna 4
    // e mostra le sue uscite verso 3/3/2/1.
    const advanceTest2MapWindow = isTest2Mode() && Number(PKM_RUN.test2MapPhase) !== 1 && Number(PKM_RUN.row) === 3;
    // L'ultimo scontro del passaggio riporta esattamente al nodo ? di origine.
    if(PKM_RUN.extraPassage && current.row === PKM_RUN.map.length - 1 && current.done){
      const passage = PKM_RUN.extraPassage;
      const rescue = PKM_RUN.hiddenRescue;
      const rescueReward = 150;
      const rewardPool = Object.values(window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {}).filter(item => item?.id);
      const rescueItem = rand(rewardPool);
      PKM_RUN.bits = Number(PKM_RUN.bits || 0) + rescueReward;
      if(rescueItem){
        if(!Array.isArray(PKM_RUN.items)) PKM_RUN.items = [];
        const owned = PKM_RUN.items.find(entry => String(entry?.id || entry) === String(rescueItem.id));
        if(owned) owned.qty = Math.max(0, Number(owned.qty) || 0) + 1;
        else PKM_RUN.items.push({id:rescueItem.id,qty:1});
      }
      PKM_RUN.map = passage.returnMap;
      PKM_RUN.row = passage.returnRow;
      PKM_RUN.col = passage.returnCol;
      PKM_RUN.lastDoneId = passage.returnLastDoneId;
      delete PKM_RUN.extraPassage;
      delete PKM_RUN.hiddenRescue;
      next();
      if(isTest2Mode()){
        const bottom = $("bottomCampagna");
        const map = $("map");
        if(bottom){
          bottom.querySelector(".test2-rescue-reward-scene")?.remove();
          bottom.insertAdjacentHTML("beforeend", `<div class="test2-rescue-reward-scene"><img class="test2-rescue-mon rescue-mon-1" src="${sprite(rescue?.requester?.immagine)}" alt="${rescue?.requester?.nome || "Pokémon"}"><img class="test2-rescue-mon rescue-mon-2" src="${sprite(rescue?.friend?.immagine)}" alt="${rescue?.friend?.nome || "Pokémon"}">${rescueItem ? `<div class="test2-rescue-item"><img src="${rescueItem.immagine || ""}" alt="${rescueItem.nome}"><span>PREMIO</span></div>` : ""}</div>`);
        }
        if(map){
          map.className = "test2-rescue-reward-map";
          map.innerHTML = `<section class="test2-rescue-reward-panel"><span>✨ SOCCORSO RIUSCITO</span><h2>${rescue?.requester?.nome || "Il Pokémon"} e ${rescue?.friend?.nome || "il suo amico"} sono salvi!</h2><div class="test2-rescue-summary"><p><small>SOLDI</small><b>+${rescueReward}¥</b></p>${rescueItem ? `<p><small>OGGETTO OTTENUTO</small><span><img src="${rescueItem.immagine || ""}" alt="">${rescueItem.nome}</span></p>` : ""}</div><button type="button" onclick="closeHiddenRescueReward()">CONTINUA</button></section>`;
        }
      }
      return;
    }
    const afterBattleNodeType = PKM_RUN.afterBattleNodeType;
    if(afterBattleNodeType){
      PKM_RUN.afterBattleNodeType = null;
      busy = 0;
      closeModal();
      if(afterBattleNodeType === "rifugio"){ rifugio(); return; }
      if(afterBattleNodeType === "skill"){ skill(); return; }
      if(afterBattleNodeType === "shop"){ window.shop?.(); return; }
    }
    // Il guardiano finale della feature usa la stessa transizione del boss
    // classico, così la run non resta bloccata sulla mappa.
    if(BossWaves.isFinalBoss(current.type)){
      const currentMode = window.PokeMisteryRL_Modes?.get?.(PKM_RUN.mode);
      const finalFloor = Math.max(
        1,
        Number(currentMode?.max_piani) || Number(currentMode?.piani?.length) || 1
      );
      if(PKM_RUN.floor >= finalFloor){
        const roster = [PKM_RUN.activePokemon, PKM_RUN.secondActive, ...(PKM_RUN.teamSlots || [])].filter(Boolean);
        PKM_RUN.completed = true;
        busy = 0;
        modal(`<div class="center run-victory"><span>🏆 AVVENTURA COMPLETATA</span><h2>Hai conquistato Kanto!</h2><p>La tua squadra ha superato tutti i ${finalFloor} piani della modalità.</p><div class="run-victory-team">${roster.map(pokemon => `<div><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"><b>${pokemon.nome}</b><small>LV ${pokemon.level || 1}</small></div>`).join("")}</div><div class="run-victory-stats"><span>💰 ${PKM_RUN.bits || 0}</span><span>👥 ${roster.length} Pokémon</span></div><button type="button" onclick="quickReset()">NUOVA AVVENTURA</button><button type="button" class="run-victory-menu" onclick="goMenu()">TORNA ALLA HOME</button></div>`);
        return;
      }
      PKM_RUN.floor++;
      const a=getActivePokemon(); if(a){a.hp=a.maxHp; PKM_RUN.hp=a.maxHp;}
      PokeMisteryRL.Map.buildMap();
      // Dai piani successivi il primo nodo è il Negozio: deve restare
      // selezionabile, non essere saltato come il vecchio raccordo.
      const start = PKM_RUN.map?.[0]?.[0];
      const firstChoices = PKM_RUN.map?.[1] || [];
      if(start && isTest2Mode()){
        start.ok = true;
        PKM_RUN.row = 0;
        PKM_RUN.col = 0;
      }else if(start){
        start.done=true; start.ok=false; PKM_RUN.lastDoneId=start.id;
        start.kid.forEach(c => { if(firstChoices[c]) firstChoices[c].ok=true; });
        PKM_RUN.row=1;
        const first = firstChoices.find(n=>n.ok);
        PKM_RUN.col=first ? first.col : 0;
      }
    }
    else { PKM_RUN.map.forEach(r=>r.forEach(n=>n.ok=false)); const nextRow=PKM_RUN.map[PKM_RUN.row+1]; if(nextRow){ current.kid.forEach(c=>{ if(nextRow[c]) nextRow[c].ok=true; }); if(!nextRow.some(n=>n.ok)) nextRow.forEach(n=>n.ok=true); PKM_RUN.row++; const first=nextRow.find(n=>n.ok); if(first) PKM_RUN.col=first.col; } }
    if(advanceTest2MapWindow) PKM_RUN.test2MapPhase = 1;
    if(message) msg(message); closeModal(); busy=0;
    // Evento concluso: prima della prossima scelta il giocatore può riaprire
    // lo zaino, curare e riorganizzare l'equipaggiamento.
    if(isTest2Mode()) PKM_RUN.test2BackpackAvailable = true;
    // La marcia di fine nodo non deve sopravvivere alla conferma dei premi:
    // il nuovo tratto riparte con la formazione ferma alle coordinate di sinistra.
    document.getElementById("bottomCampagna")?.classList.remove("test2-node-finish");
    // Dopo premi, rifiuti o conclusione di un fight, la scena torna sempre
    // alla formazione con S1 e S2 nelle coordinate standard.
    if(isTest2Mode()) PokeMisteryRL.UI.refreshBottomPanel?.();
    // Qualunque evento può aver sostituito la mappa con dojo/negozio/premio.
    // Prima delle nuove scelte ripristiniamo il contenitore normale, che è
    // anche l'unico stato nel quale lo zaino può essere aperto.
    if(isTest2Mode()){
      const map = $("map");
      if(map) map.className = "";
    }
    PokeMisteryRL.UI.render();
    checkEvolve();
  };
  return { pick, next, openStartingStarterChoice, openStartingPartnerChoice, chooseStartingStarter, chooseStartingPair, acceptShelterChallenge, rejectShelterChallenge, acceptSkillChallenge, rejectSkillChallenge, openWaveBossChallenge, startWaveBossChallenge, openHiddenPassage, enterHiddenPassage, declineHiddenPassage, payTollEvent, refuseTollEvent };
})();
const { pick, next } = PokeMisteryRL.Progress;
window.chooseStartingStarter = PokeMisteryRL.Progress.chooseStartingStarter;
window.chooseStartingPair = PokeMisteryRL.Progress.chooseStartingPair;
window.acceptShelterChallenge = PokeMisteryRL.Progress.acceptShelterChallenge;
window.rejectShelterChallenge = PokeMisteryRL.Progress.rejectShelterChallenge;
window.startWaveBossChallenge = PokeMisteryRL.Progress.startWaveBossChallenge;
window.acceptSkillChallenge = PokeMisteryRL.Progress.acceptSkillChallenge;
window.rejectSkillChallenge = PokeMisteryRL.Progress.rejectSkillChallenge;
window.enterHiddenPassage = PokeMisteryRL.Progress.enterHiddenPassage;
window.declineHiddenPassage = PokeMisteryRL.Progress.declineHiddenPassage;
window.closeHiddenRescueReward = () => {
  $("bottomCampagna")?.querySelector(".test2-rescue-reward-scene")?.remove();
  const map = $("map");
  if(map){ map.className = ""; map.innerHTML = ""; }
  PokeMisteryRL.UI?.render?.();
};
window.payTollEvent = PokeMisteryRL.Progress.payTollEvent;
window.refuseTollEvent = PokeMisteryRL.Progress.refuseTollEvent;
// #endregion
// #region 12 - SKILL / RIFUGIO | 13 - SHOP / EVENTI / UI
PokeMisteryRL.Effects = (() => {
  const updateHPBar = () => {

    const a =
      getActivePokemon();

    if(!a){
      return;
    }

    const maxHp =
      Math.max(
        1,
        Number(a.maxHp) || 1
      );

    const hp =
      clamp(
        Number(a.hp) || 0,
        0,
        maxHp
      );

    const percent =
      hp / maxHp * 100;

    const bar =
      $("hpFillSide");

    if(bar){
      bar.style.width =
        percent + "%";
    }

    const text =
      $("hpTextSide");

    if(text){
      text.textContent =
        `HP ${hp}/${maxHp}`;
    }

  };
  const getSkillPreview = (
    pokemon,
    level
  ) => {

    if(!pokemon){
      return null;
    }

    const currentLevel =
      Number(pokemon.sk) || 1;

    /*
     * Skill attualmente equipaggiata:
     * usa sempre quella realmente salvata nel Pokémon.
     */
    if(
      Number(level) === currentLevel &&
      typeof PokeMisteryRL_SkillSystem !== "undefined" &&
      typeof PokeMisteryRL_SkillSystem.getActiveSkill === "function"
    ){
      return (
        PokeMisteryRL_SkillSystem.getActiveSkill(
          pokemon
        ) || null
      );
    }

    /*
     * Skill futura:
     * la memorizziamo solo sul Pokémon.
     * Nessuna modifica a PKM_RUN o alla procedura di start.
     */
    if(!Array.isArray(pokemon.__skillPreview)){
      pokemon.__skillPreview = [];
    }

    const cached =
      pokemon.__skillPreview.find(
        item =>
          Number(item.level) === Number(level)
      );

    if(cached){
      return cached.skill;
    }

    if(
      typeof PokeMisteryRL_SkillSystem === "undefined" ||
      typeof PokeMisteryRL_SkillSystem.getSkill !== "function"
    ){
      return null;
    }

    const skill =
      PokeMisteryRL_SkillSystem.getSkill(
        pokemon,
        Number(level)
      );

    if(!skill){
      return null;
    }

    pokemon.__skillPreview.push({
      level: Number(level),
      skill
    });

    return skill;
  };


  const upgradeSkillTarget = (
    target
  ) => {

    const pokemon =
      target === "s1" ? getActivePokemon()
      : target === "s2" ? PKM_RUN?.secondActive
      : target === "s3" ? PKM_RUN?.teamSlots?.[0]
      : null;

    if(!pokemon){
      msg(
        "Pokémon non disponibile."
      );
      return false;
    }

    const currentLevel =
      Number(pokemon.sk) || 1;

    if(currentLevel >= 3){
      msg(
        `${pokemon.nome}: SKILL MAX`
      );
      return false;
    }

    const nextLevel =
      currentLevel + 1;

    const selected =
      getSkillPreview(
        pokemon,
        nextLevel
      );

    if(!selected){
      msg(
        `Nessuna mossa LV ${nextLevel} disponibile.`
      );
      return false;
    }

    /*
     * Applica esattamente la skill visualizzata.
     */
    pokemon.skills = Array.isArray(pokemon.skills) ? pokemon.skills : [];
    pokemon.skills = pokemon.skills.filter(skill => Number(skill?.skillLevel) !== nextLevel);
    pokemon.skills.push(selected);

    pokemon.sk =
      nextLevel;

    if(target === "s1"){
      PKM_RUN.sk =
        pokemon.sk;
    }

    PokeMisteryRL.UI.refreshBottomPanel();

    msg(
      `${pokemon.nome}: ${selected.name || selected.nome}`
    );

    return true;
  };


  const upgradeSkill = () =>
    upgradeSkillTarget("s1");


  

const getCurrentSkillNode = () => {

  return (
    PKM_RUN?.map?.[PKM_RUN.row]?.[PKM_RUN.col] ||
    null
  );
};


const isSkillRerollAvailable = () => {

  const node =
    getCurrentSkillNode();

  return (
    node?.type === "skill" &&
    node.rerollUsed !== true
  );
};


const consumeSkillReroll = () => {

  const node =
    getCurrentSkillNode();

  if(
    node &&
    node.type === "skill"
  ){
    node.rerollUsed = true;
  }
};


const showSkillRerollResult = (
  pokemon,
  oldSkill,
  newSkill
) => {

  const oldName =
    oldSkill?.name ||
    oldSkill?.nome ||
    "--";

  const newName =
    newSkill?.name ||
    newSkill?.nome ||
    "--";

  const oldPower =
    oldSkill?.pwr ??
    oldSkill?.power ??
    "--";

  const newPower =
    newSkill?.pwr ??
    newSkill?.power ??
    "--";

  modal(`
    <div class="center skill-result-node">

      <h2>
        🔄 REROLL SKILL
      </h2>

      <p class="skill-node-subtitle">
        La skill di ${pokemon.nome} è cambiata.
      </p>

      <div class="skill-result-flow">

        <div class="skill-move-box skill-result-old">

          <small>
            PRIMA
          </small>

          <strong>
            ${oldName}
          </strong>

          <span>
            PWR ${oldPower}
          </span>

        </div>

        <div class="skill-arrow">
          →
        </div>

        <div class="skill-move-box skill-result-new">

          <small>
            DOPO
          </small>

          <strong>
            ${newName}
          </strong>

          <span>
            PWR ${newPower}
          </span>

        </div>

      </div>

      <button
        type="button"
        onclick="next()"
      >
        CONTINUA
      </button>

    </div>
  `);
};


const rerollSkillTarget = (
  target
) => {

  const pokemon =
    target === "s2"
      ? PKM_RUN?.secondActive
      : getActivePokemon();

  if(!pokemon){
    msg(
      target === "s2"
        ? "Partner non equipaggiato."
        : "Starter non disponibile."
    );
    return false;
  }

  const currentLevel =
    Number(pokemon.sk) || 1;

  /*
   * Un solo reroll per nodo Skill.
   */
  if(!isSkillRerollAvailable()){
    msg(
      "Reroll già usato in questo nodo Skill."
    );
    return false;
  }

  /*
   * Il reroll è disponibile solo a LV3.
   */
  if(currentLevel !== 3){
    msg(
      "Il reroll è disponibile solo a MOSSA LV3."
    );
    return false;
  }

  const COST =
    50;

  if(
    Number(PKM_RUN.bits) < COST
  ){
    msg(
      `Servono ${COST} monete.`
    );
    return false;
  }

  if(
    typeof PokeMisteryRL_SkillSystem === "undefined" ||
    typeof PokeMisteryRL_SkillSystem.getSkill !== "function"
  ){
    msg(
      "Skill System non disponibile."
    );
    return false;
  }

  const oldSkill =
    PokeMisteryRL_SkillSystem.getActiveSkill(
      pokemon
    );

  /*
   * Una sola estrazione della nuova skill LV3.
   */
  const newSkill =
    PokeMisteryRL_SkillSystem.getSkill(
      pokemon,
      currentLevel
    );

  if(!newSkill){
    msg(
      "Nessuna mossa LV3 disponibile."
    );
    return false;
  }

  /*
   * Applica prima la nuova skill e poi consuma il reroll.
   */
  pokemon.skills =
    [newSkill];

  pokemon.sk =
    currentLevel;

  PKM_RUN.bits =
    Math.max(
      0,
      Number(PKM_RUN.bits) - COST
    );

  consumeSkillReroll();

  /*
   * Elimina la preview precedente LV3,
   * così la prossima visita del sistema usa lo stato reale.
   */
  if(
    Array.isArray(pokemon.__skillPreview)
  ){
    pokemon.__skillPreview =
      pokemon.__skillPreview.filter(
        item =>
          Number(item.level) !== currentLevel
      );
  }

  PokeMisteryRL.UI.refreshBottomPanel();

  /*
   * Mostra il confronto prima di chiudere il nodo.
   * CONTINUA usa next(), esattamente come il potenziamento.
   */
  showSkillRerollResult(
    pokemon,
    oldSkill,
    newSkill
  );

  return true;
};


const buildSkillCard = (
  target,
  pokemon
) => {

  if(!pokemon){

    return `
      <div class="skill-choice-card skill-choice-empty">

        <div class="skill-choice-head">
          <b>${target}</b>
          <span>SLOT VUOTO</span>
        </div>

      </div>
    `;
  }

  const level =
    Number(pokemon.sk) || 1;

  const nextLevel =
    level + 1;

  const rerollAvailable =
    isSkillRerollAvailable();

  const currentSkill =
    getSkillPreview(
      pokemon,
      level
    );

  const nextSkill =
    level < 3
      ? getSkillPreview(
          pokemon,
          nextLevel
        )
      : null;

  const currentName =
    currentSkill?.name ||
    currentSkill?.nome ||
    "--";

  const nextName =
    nextSkill?.name ||
    nextSkill?.nome ||
    "MAX";

  const currentPower =
    currentSkill?.pwr ??
    currentSkill?.power ??
    "--";

  const nextPower =
    nextSkill?.pwr ??
    nextSkill?.power ??
    "--";

  const action =
    level === 3 && rerollAvailable
      ? `
          <button
            type="button"
            onclick="rerollSkillTarget('${target.toLowerCase()}')"
          >
            🔄 REROLL LV3 — 50 💰
          </button>
        `
      : level === 3
        ? `
            <button
              type="button"
              disabled
            >
              🔄 REROLL GIÀ USATO
            </button>
          `
      : nextSkill
        ? `
          <button
            type="button"
            onclick="upgradeSkillTarget('${target.toLowerCase()}'); next();"
          >
            ⭐ POTENZIA ${target}
          </button>
        `
        : `
          <button
            type="button"
            disabled
          >
            ⭐ MAX
          </button>
        `;

  return `
    <div class="skill-choice-card">

      <div class="skill-choice-head">

        <b>${target}</b>

        <span>
          ${pokemon.nome}
        </span>

        <em>
          MOSSA LV ${level}
        </em>

      </div>

      <div class="skill-choice-body">

        <div class="skill-choice-sprite">

          <img
            src="${sprite(pokemon.immagine)}"
            alt="${pokemon.nome}"
          >

        </div>

        <div class="skill-choice-moves">

          <div class="skill-move-box">

            <small>
              ATTUALE
            </small>

            <strong>
              ${currentName}
            </strong>

            <span>
              PWR ${currentPower}
            </span>

          </div>

          <div class="skill-arrow">
            →
          </div>

          <div class="skill-move-box skill-move-next">

            <small>
              ${level < 3 ? "DIVENTA" : "REROLL"}
            </small>

            <strong>
              ${
                level < 3
                  ? nextName
                  : "MOSSA LV3"
              }
            </strong>

            <span>
              ${
                level < 3
                  ? `PWR ${nextPower}`
                  : "50 💰"
              }
            </span>

          </div>

        </div>

      </div>

      ${action}

    </div>
  `;
};


  const buildTest2DojoSkillCard = (label, target, pokemon) => {
    if(!pokemon) return "";
    const level = Number(pokemon.sk) || 1;
    const current = getSkillPreview(pokemon, level) || {};
    const upcoming = level < 3 ? (getSkillPreview(pokemon, level + 1) || {}) : null;
    const currentName = current.name || current.nome || "--";
    const nextName = upcoming?.name || upcoming?.nome || "SKILL MAX";
    const currentPower = current.pwr ?? current.power ?? "--";
    const nextPower = upcoming ? (upcoming.pwr ?? upcoming.power ?? "--") : "";
    const action = upcoming ? `onclick="upgradeSkillTarget('${target}'); next();"` : "disabled";
    return `<button type="button" class="test2-dojo-skill-target" ${action}><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"><span>${label}</span><b>${pokemon.nome}</b><em>MOSSA LV ${level}</em><small>${currentName} <i>→</i> ${nextName}</small><strong>${upcoming ? `PWR ${currentPower} → ${nextPower}` : "MOSSA AL MASSIMO"}</strong></button>`;
  };

  const skill = () => {

    const s1 =
      PKM_RUN?.activePokemon || null;

    const s2 =
      PKM_RUN?.secondActive || null;

    const s3 =
      PKM_RUN?.teamSlots?.[0] || null;

    if(!s1){
      return;
    }

    const currentNode = PKM_RUN?.map?.[PKM_RUN?.row]?.[PKM_RUN?.col];
    const challenge = currentNode?.enemyPreview;
    const fought = !!PKM_RUN?.floorChallengeDone?.skill;

    if(isTest2Mode()){
      // La vittoria del Dojo torna alla scena standard prima di aggiungere lo
      // sfidante: S1 e S2 restano sempre nelle loro posizioni fisse.
      PokeMisteryRL.UI?.refreshBottomPanel?.();
      $("bottomCampagna")?.classList.remove("test2-node-finish");
      const map = $("map");
      if(!map) return;
      map.className = "test2-dojo-map";
      map.innerHTML = `<div class="test2-dojo-prize-panel test2-dojo-skill-choice"><span>🥋 PREMIO DEL DOJO</span><h2>Scegli chi potenziare</h2><p>Una Skill crescerà di livello.</p><section class="test2-dojo-skill-list">${buildTest2DojoSkillCard("S1", "s1", s1)}${buildTest2DojoSkillCard("S2", "s2", s2)}${buildTest2DojoSkillCard("S3", "s3", s3)}</section><button type="button" onclick="next('Dojo completato')">NON POTENZIARE</button></div>`;
      return;
    }

    modal(`
      <div class="center skill-node">
        <div class="node-challenge-banner ${fought ? "fought" : "idle"}">
          <img src="${sprite(challenge?.immagine)}" alt="${challenge?.nome || "Avversario del Dojo"}">
          <div><span>🥋 DOJO</span><h2>${challenge?.nome || "Maestro del Dojo"}</h2><small>${fought ? "Sfida affrontata" : "Sfida non affrontata"}</small></div>
        </div>
        <p class="skill-node-subtitle">Scegli quale Pokémon potenziare.</p>

        <div class="skill-choice-list">

          ${buildSkillCard("STARTER", s1)}

          ${buildSkillCard("PARTNER", s2)}

        </div>

        <button
          type="button"
          onclick="next()"
        >
          AVANTI
        </button>

      </div>
    `);
  };


  const shelterHealTarget = (target) => {
    if(!PKM_RUN) return false;
    const p =
      target === "s1"
        ? getActivePokemon()
        : target === "s2"
          ? PKM_RUN.secondActive
          : PKM_RUN.teamSlots?.[Number(target)];
    if(!p){ msg("Pokémon non disponibile."); return false; }
    if(Number(p.hp) <= 0){ msg("Questo Pokémon è esausto: usa RIANIMA."); return false; }
    p.hp = Number(p.maxHp) || 1;
    refreshBottomPanel();
    next(`${p.nome} recupera tutti i suoi HP.`);
    return true;
  };

  const shelterRevive = (target) => {
    const cost = 100;
    if(!PKM_RUN) return false;

    const pokemon =
      target === "s1"
        ? getActivePokemon()
        : target === "s2"
        ? PKM_RUN.secondActive
        : PKM_RUN.teamSlots?.[Number(target)];

    if(!pokemon || Number(pokemon.hp) > 0){
      msg("Questo Pokémon non è esausto.");
      return false;
    }
    if(Number(PKM_RUN.bits) < cost){
      msg(`Servono ${cost} 💰 per rianimare un Pokémon.`);
      return false;
    }

    PKM_RUN.bits -= cost;
    pokemon.hp = Math.max(1, Math.ceil((Number(pokemon.maxHp) || 1) * 0.5));
    refreshBottomPanel();
    next(`✨ ${pokemon.nome} è tornato in squadra con il 50% HP.`);
    return true;
  };

  const shelterRerollSkillType = (target) => {
    const pokemon = target === "s1" ? getActivePokemon() : target === "s2" ? PKM_RUN?.secondActive : PKM_RUN?.teamSlots?.[Number(target)];
    const currentNode = PKM_RUN?.map?.[PKM_RUN?.row]?.[PKM_RUN?.col];
    const nodeId = `${Number(PKM_RUN?.floor) || 1}:${currentNode?.id || "rifugio"}`;
    if(!pokemon) return false;
    if(PKM_RUN?.shelterMoveTypeChangeNodeId === nodeId){ msg("Hai già cambiato il tipo di una mossa in questo Rifugio."); return false; }
    const current = PokeMisteryRL_SkillSystem?.getActiveSkill?.(pokemon) || pokemon.skills?.[0];
    if(!current){ msg("Nessuna mossa disponibile per questo Pokémon."); return false; }
    const normalizeSkillType = value => String(Array.isArray(value) ? value[0] : value || "normale").split(/[\s,\/]+/)[0].trim().toLowerCase() || "normale";
    const oldType = normalizeSkillType(current.type);
    const candidates = (pokemon.__apiMoves || []).filter(move => Number(move.skillLevel) === Number(pokemon.sk || 1) && normalizeSkillType(move.type) !== oldType);
    if(!candidates.length){ msg("Nessun tipo alternativo disponibile per questa skill."); return false; }
    const nextSkill = {...rand(candidates)};
    pokemon.skills = [nextSkill];
    pokemon.__lastMoveTypeReroll = { from:oldType, to:normalizeSkillType(nextSkill.type), nodeId };
    PKM_RUN.shelterMoveTypeChangeNodeId = nodeId;
    PokeMisteryRL.UI.refreshBottomPanel();
    rifugio();
    return true;
  };

  const rifugio = () => {
    const currentNode = PKM_RUN?.map?.[PKM_RUN?.row]?.[PKM_RUN?.col];
    const challenge = currentNode?.enemyPreview;
    const fought = !!PKM_RUN?.floorChallengeDone?.rifugio;
    if(isTest2Mode()){
      PKM_RUN.test2Scene = "campeggio";
      PokeMisteryRL.UI?.refreshBottomPanel?.();
      const chansey = Object.values(PKM_DB).find(p => String(p.nome || "").toLowerCase() === "chansey");
      const bottom = $("bottomCampagna");
      bottom?.querySelectorAll(".test2-shelter-chansey").forEach(entry => entry.remove());
      const teamSlots = PKM_RUN?.teamSlots || [];
      const starter = getActivePokemon() || PKM_RUN?.activePokemon || teamSlots.find(Boolean);
      const partner = PKM_RUN?.secondActive || teamSlots.find(pokemon => pokemon && pokemon !== starter);
      const thirdIndex = teamSlots.findIndex(pokemon => pokemon && pokemon !== starter && pokemon !== partner);
      const members = [
        ["S1", starter, "s1"],
        ["S2", partner, "s2"],
        ["S3", thirdIndex >= 0 ? teamSlots[thirdIndex] : null, String(thirdIndex)]
      ].filter(([,pokemon]) => pokemon);
      const skillType = skill => String(Array.isArray(skill?.type) ? skill.type[0] : skill?.type || "normale").split(/[\s,\/]+/)[0].trim().toLowerCase() || "normale";
      const map = $("map");
      if(map){
        map.className = "test2-shelter-map";
        const shelterNodeId = `${Number(PKM_RUN?.floor) || 1}:${currentNode?.id || "rifugio"}`;
        const changeUsed = PKM_RUN?.shelterMoveTypeChangeNodeId === shelterNodeId;
        const rerollCards = members.length ? members.map(([,pokemon,key]) => { const move = PokeMisteryRL_SkillSystem?.getActiveSkill?.(pokemon) || pokemon.skills?.[0]; const reroll = pokemon.__lastMoveTypeReroll?.nodeId === shelterNodeId ? pokemon.__lastMoveTypeReroll : null; const currentType = reroll?.from || skillType(move); const receivedType = reroll?.to || null; return `<button type="button" class="test2-shelter-move-card ${reroll ? "changed" : ""}" ${changeUsed ? "disabled" : ""} onclick="shelterRerollSkillType('${key}')"><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"><b>${pokemon.nome}</b><span><small>TIPO ATTUALE</small><em>${getTypingBadge(currentType)}</em></span><span><small>TIPO RICEVUTO</small><em>${receivedType ? getTypingBadge(receivedType) : "—"}</em></span></button>`; }).join("") : `<span class="test2-shelter-empty">Nessun membro disponibile.</span>`;
        map.innerHTML = `<section class="test2-shelter-panel test2-shelter-move-panel"><span>♥ RIFUGIO</span><p>La squadra è stata curata del <b>50%</b> all'arrivo.</p><div class="test2-shelter-reroll"><b>CAMBIA TIPO MOSSA</b><small>Seleziona un Pokémon a cui cambiare il typing della mossa.</small><i>${changeUsed ? "Cambio usato in questo nodo" : "1 cambio gratuito per nodo"}</i></div><div class="test2-shelter-members">${rerollCards}</div><button type="button" class="test2-shelter-skip-reroll" onclick="next('Hai lasciato il Rifugio senza cambiare mossa.')">CONTINUA</button></section>`;
      }
      return;
    }
    const renderMember = (label, pokemon, key) => {
      if(!pokemon){
        return `
          <div class="shelter-member shelter-member-empty">
            <span class="shelter-member-label">${label}</span>
            <span>Nessun Pokémon</span>
          </div>`;
      }
      const hp = Math.max(0, Number(pokemon.hp) || 0);
      const maxHp = Math.max(1, Number(pokemon.maxHp) || 1);
      const percent = clamp(Math.round((hp / maxHp) * 100), 0, 100);
      const isFull = hp >= maxHp;
      const faintedClass = hp <= 0 ? " is-fainted is-revivable" : "";
      const selectableClass = hp > 0 && !isFull ? " is-healable" : "";
      const fullClass = isFull ? " is-full" : "";
      const status = hp <= 0 ? "FUORI LOTTA" : isFull ? "VITA PIENA" : `${percent}% HP · CLICCA PER CURARE`;
      const action = hp <= 0 ? `onclick="shelterRevive('${key}')"` : isFull ? "disabled" : `onclick="shelterHealTarget('${key}')"`;
      return `
        <button type="button" class="shelter-member${faintedClass}${selectableClass}${fullClass}" ${action}>
          <span class="shelter-member-label">${label}</span>
          <img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}" class="shelter-member-sprite">
          <div class="shelter-member-info">
            <b>${pokemon.nome}</b>
            <span class="shelter-hp-text">${hp} / ${maxHp} HP</span>
            <span class="shelter-member-status">${status}</span>
          </div>
          ${hp <= 0 ? `<span class="shelter-revive-cost">RIANIMA · 100 💰</span>` : ""}
          <div class="shelter-hp-track"><i style="width:${percent}%"></i></div>
        </button>`;
    };
    modal(`
      <div class="center shelter-node">
        <div class="node-challenge-banner ${fought ? "fought" : "idle"}">
          <img src="${sprite(challenge?.immagine)}" alt="${challenge?.nome || "Chansey"}">
          <div><span>🏠 RIFUGIO</span><h2>${challenge?.nome || "Chansey"}</h2><small>${fought ? "Sfida affrontata" : "Sfida non affrontata"}</small></div>
        </div>
        <p>Prenditi cura della squadra prima di proseguire.</p>
        <div class="shelter-roster" aria-label="Squadra al rifugio">
          ${renderMember("STARTER", getActivePokemon(), "s1")}
          ${renderMember("PARTNER", PKM_RUN?.secondActive, "s2")}
          ${(PKM_RUN?.teamSlots || []).map((pokemon, index) => renderMember(`SQUADRA ${index + 1}`, pokemon, String(index))).join("")}
        </div>
        <button onclick="next()">AVANTI</button>
      </div>
    `);
  };
  return { updateHPBar, upgradeSkill, upgradeSkillTarget, rerollSkillTarget, skill, rifugio, shelterHealTarget, shelterRevive, shelterRerollSkillType };
})();
const { updateHPBar, upgradeSkill, upgradeSkillTarget, rerollSkillTarget, skill, rifugio, shelterHealTarget, shelterRevive, shelterRerollSkillType } = PokeMisteryRL.Effects;
window.rerollSkillTarget = rerollSkillTarget;
window.upgradeSkillTarget = upgradeSkillTarget;
window.shelterHealTarget = shelterHealTarget;
window.shelterRevive = shelterRevive;
window.shelterRerollSkillType = shelterRerollSkillType;
// #endregion
// #region 14 - BATTAGLIA | 15 - HUD | 16 - GAMEOVER

PokeMisteryRL.Battle = (() => {

  // POKEMON NEMICI

  const getPokemonByStage = (s) =>
    Object.values(PKM_DB).filter(
      p => Number(p.stage) === Number(s) && Number(p.id) !== 10001
    );


  const getEnemyStage = (f, isBoss) =>
    isBoss
      ? (f < 3 ? 1 : f < 6 ? 2 : 3)
      : (f < 2 ? 1 : f < 5 ? 2 : 3);


  const getEnemyStats = (id) => {
    const p = PKM_DB[id];
    if (!p) {
      return {
        hp: 20,
        atk: 10,
        satk: 10,
        dif: 10,
        sdef: 10,
        spd: 10
      };
    }
    // Stessa base e stessi roll casuali di un Pokémon appena creato, senza
    // alcun moltiplicatore da piano o da boss: è davvero un avversario LV 1.
    const st = getStatsFromBST(p.bst, p.stage, p.baseStats);
    const rolls = PokeMisteryRL.Stats?.rollPokemonStats?.() || {};
    ["hp", "atk", "satk", "dif", "sdef", "spd"].forEach(key => {
      st[key] = Math.max(1, (Number(st[key]) || 1) + (Number(rolls[key]) || 0));
    });
    return st;
  };


  const createEnemy = (isBoss, preview = null) => {

    const currentNode =
      PKM_RUN?.map?.[PKM_RUN.row]?.[PKM_RUN.col] ||
      null;

    /*
     * IL NODO HA GIA' DECISO IL POKEMON DA MOSTRARE.
     * Il fight usa ESATTAMENTE quello sprite/quel Pokémon.
     */
    let base = null;

    const isShelterFight = currentNode?.type === "rifugio";
    const isShopFight = currentNode?.type === "shop";
    const isSkillFight = currentNode?.type === "skill";

    if(isShelterFight){
      base = Object.values(PKM_DB).find(
        p => String(p.nome || "").toLowerCase() === "chansey"
      ) || null;
    }

    if(isShopFight){
      base = Object.values(PKM_DB).find(
        p => String(p.nome || "").toLowerCase() === "kecleonnegozio"
      ) || null;
    }

    if(
      !base &&
      (preview || currentNode?.enemyPreview)?.id != null
    ){

      base =
        PKM_DB[(preview || currentNode.enemyPreview).id] ||
        Object.values(PKM_DB).find(
          p =>
            String(p.id) ===
            String((preview || currentNode.enemyPreview).id)
        ) ||
        null;
    }

    /*
     * Fallback di sicurezza: se il nodo non ha preview,
     * manteniamo la vecchia selezione casuale.
     */
    if(!base){

      const stage =
        getEnemyStage(
          PKM_RUN.floor,
          isBoss
        );

      const pool =
        getPokemonByStage(stage);

      if(!pool.length){
        return null;
      }

      base =
        rand(pool);
    }

    const stats =
      getEnemyStats(base.id);

    const floorLevels =
      window.PokeMisteryRL_Modes?.getFloor?.(
        PKM_RUN?.mode,
        PKM_RUN?.floor
      )?.livelli;

    const minLevel =
      Math.max(1, Number(floorLevels?.min) || Number(PKM_RUN.floor) + 2);
    const maxLevel =
      Math.max(minLevel, Number(floorLevels?.max) || minLevel);
    const companionLevel = Math.max(
      1,
      Number(PKM_RUN?.secondActive?.level) ||
      Number(PKM_RUN?.activePokemon?.level) ||
      minLevel
    );
    // Ogni avversario usa LV 1: fight, dojo, Kecleon, eventi e boss.
    const encounterLevel = 1;

    return {

      id: base.id,

      nome: base.nome,

      immagine: base.immagine,

      // Nel nodo Skill il combattente è scelto tra i Pokémon di tipo Lotta;
      // livello e statistiche restano quelli previsti dal piano.
      tipi: [...base.tipi],

      stage: base.stage,

      level: encounterLevel,

      hp: stats.hp,

      maxHp: stats.hp,

      stats,

      shelterFight: isShelterFight,

      shopFight: isShopFight,

      skillFight: isSkillFight
    };
  };


  // BATTAGLIA

  const fight = (isBoss = false) => {

    try {

      const starter1 =
        PKM_RUN?.activePokemon;

      const starter2 =
        PKM_RUN?.secondActive;


      // S1 È OBBLIGATORIO
      // S2 È FACOLTATIVO

      if (!starter1) {

        busy = 0;

        msg(
          "Serve uno Starter per combattere."
        );

        return;
      }


    const node = PKM_RUN?.map?.[PKM_RUN?.row]?.[PKM_RUN?.col];
    let previews = (isBoss || node?.type === "event") && Array.isArray(node?.enemyPreviews)
      ? node.enemyPreviews
      : [node?.enemyPreview].filter(Boolean);
    previews = [...previews];
    const waveBoss = BossWaves.isWaveBoss(node?.type);
    const wavePlan = BossWaves.splitWaves(node?.type, previews);
    const wavePreviews = wavePlan.pending;
    previews = wavePlan.active;

    // Il branco è monotipo per specie: lo sprite visto sul percorso coincide
    // sempre con ogni avversario del fight, senza rinforzi casuali diversi.
    if(isTestCampaign() && node?.type === "event" && previews[0]){
      const leader = previews[0];
      const groupSize = Math.max(2, Math.min(3, previews.length || 2));
      previews = Array.from({length:groupSize}, () => ({...leader}));
    }

      // In Test2 ogni combattimento, incluso il Dojo, è una squadra da 3 o 4
      // Pokémon. Sono istanze distinte, quindi ognuno mantiene i propri HP.
      // Test2 non dipende più dal registro delle vecchie modalità: usa il
      // controllo diretto della run, altrimenti il gruppo restava da uno.
      const campaignFight = isTestCampaign();
      const requiredEnemies = waveBoss ? wavePlan.size : campaignFight && node?.type !== "event"
        ? (Math.random() < .5 ? 3 : 4)
        : previews.length;
      if(campaignFight && previews.length < requiredEnemies){
        const candidates = Object.values(PKM_DB).filter(p =>
          p &&
          Number(p.id) !== 10001 &&
          Number(p.stage) === getEnemyStage(PKM_RUN.floor, isBoss)
        );
        const usedIds = new Set(previews.map(preview => Number(preview?.id)).filter(Boolean));
        while(previews.length < requiredEnemies){
          const availableCandidates = candidates.filter(candidate => !usedIds.has(Number(candidate.id)));
          const candidate =
            availableCandidates[Math.floor(Math.random() * availableCandidates.length)] ||
            candidates[Math.floor(Math.random() * candidates.length)] ||
            previews[0];
          if(!candidate){
            break;
          }
          usedIds.add(Number(candidate.id));
          previews.push({
            id: candidate.id,
            nome: candidate.nome,
            immagine: candidate.immagine,
            stage: candidate.stage
          });
        }
      }
      const enemies = (previews.length ? previews : [null])
        .map(preview => createEnemy(isBoss, preview))
        .filter(Boolean);
      const enemy = enemies[0] || null;



      if (!enemy) {

        busy = 0;

        next();

        return;
      }


      const startBattle = () => {
        PokeMisteryRL.Campaigns?.applyAllStats?.();
        PKM_RUN.battle = {
          enemy,
          enemies,
          hp: enemy.hp,
          maxHp: enemy.maxHp,
          stats: enemy.stats,
          boss: !!isBoss,
          turn: 0,
          phase: 0,
          shelterFight: !!enemy.shelterFight,
          shopFight: !!enemy.shopFight,
          skillFight: !!enemy.skillFight,
          eventFight: node?.type === "event",
          wavePreviews,
          waveBossKind: waveBoss ? node.type : null
        };
        (PokeMisteryRL.Campaigns?.startBattleEffects?.(PKM_RUN.battle) || []).forEach(log);
        showBattleSurface(PokeMisteryRL.UI.buildBattleTemplate(isBoss, PKM_RUN.floor));
        PokeMisteryRL.UI.updateBattleHP();
        log(
          isBoss ? `⚠️ ${enemies.map(p => p.nome).join(" + ")} BOSS!` : `⚔️ ${enemy.nome} selvatico!`,
          isBoss ? "boss" : ""
        );
        setTimeout(autoTurn, isTestCampaign() ? 420 : 700);
      };

      startBattle();


    } catch (e) {

      console.error(e);

      busy = 0;

      closeModal();

      next();
    }
  };


  // UTILITY BATTAGLIA

  const getStarter1 = () =>
    PKM_RUN?.activePokemon || null;


  const getStarter2 = () =>
    PKM_RUN?.secondActive || null;

  const getBattlePlayers = () => {
    const base = [getStarter1(), getStarter2()];
    if(isTest2Mode()) return [...base, PKM_RUN?.teamSlots?.[0]].filter(Boolean).slice(0, 3);
    return isTestCampaign()
      ? [...base, ...(PKM_RUN?.teamSlots || [])].filter(Boolean).slice(0, 4)
      : base.filter(Boolean);
  };

  const battlePlayerKey = pokemon => {
    if(!isTestCampaign()) return pokemon === getStarter2() ? "s2" : "s1";
    const index = getBattlePlayers().indexOf(pokemon);
    return index >= 0 ? `player-${index}` : "player-0";
  };
  const battleEnemyKey = pokemon => {
    const index = (PKM_RUN?.battle?.enemies || []).indexOf(pokemon);
    return index >= 0 ? `enemy-${index}` : "enemy-0";
  };


  const getAliveStarters = () => {

    return getBattlePlayers().filter(
      p =>
        p &&
        Number(p.hp) > 0
    );
  };

  // Bersaglio Test2: il nemico punta sempre la colonna più a destra che
  // contiene un alleato vivo. A parità di colonna, viene scelto il più avanti
  // nella riga; il KO sposta subito la priorità alla colonna precedente.
  const getTest2RightmostLivingTarget = (targets = getAliveStarters()) => {
    const defaults = {0:3, 1:4, 2:5};
    return [...targets]
      .map(pokemon => {
        const slot = getBattlePlayers().indexOf(pokemon);
        const position = clamp(Number(PKM_RUN?.test2ScenePositions?.[slot] ?? defaults[slot] ?? 0), 0, 8);
        return { pokemon, column: position % 3, row: Math.floor(position / 3) };
      })
      .sort((left, right) => right.column - left.column || right.row - left.row)[0]?.pokemon || null;
  };


  const isTeamDead = () => {
    // In Test2 il Pokémon scelto come starter è il cuore della run: se va KO,
    // la battaglia termina anche se i compagni sono ancora in piedi.
    if(isTest2Mode()){
      const starter = PKM_RUN?.pendingStarter || PKM_RUN?.teamSlots?.[0] || PKM_RUN?.activePokemon;
      return !starter || Number(starter.hp) <= 0;
    }
    return getAliveStarters().length === 0;
  };


  /*
   * I potenziatori di tipo usano tutti la stessa regola:
   * se l'oggetto equipaggiato corrisponde al tipo dell'attacco,
   * aumenta il danno del suo bonus_danno nel DB_ITEMS.
   */
  const getTypeItemDamageBonus = (attackType, holder = null) => {
    return getPokemonItemEffects(holder, {type:attackType}).typePowerBonus;
  };

  // Un KO premia soltanto chi ha inflitto il colpo finale. I boss non
  // assegnano livelli: la loro ricompensa resta separata dal progresso run.
  const grantLevelForKnockout = (attacker, defeated) => {
    const battle = PKM_RUN?.battle;
    if(!attacker || !defeated || battle?.boss || defeated.__koLevelGranted) return false;
    defeated.__koLevelGranted = true;
    const levelSystem = window.PokeMisteryRL_LevelSystem;
    if(!levelSystem?.setLevel) return false;
    levelSystem.setLevel(attacker, (Number(attacker.level) || 1) + 1);
    battle.koLevels ||= [];
    battle.koLevels.push(attacker.nome);
    PokeMisteryRL.UI?.refreshBottomPanel?.();
    log(`⭐ ${attacker.nome} sale al LIV ${attacker.level} per aver sconfitto ${defeated.nome}.`);
    return true;
  };


  // ATTACCO

  const attack = (
    attacker,
    target,
    targetIsEnemy = false,
    bonusStrike = false
    ) => {

    if (!attacker || !target) {
      return false;
    }


    if (Number(attacker.hp) <= 0) {
      return false;
    }


    if (
      !targetIsEnemy &&
      Number(target.hp) <= 0
    ) {
      return false;
    }


    // L'effetto visivo (e il calcolo) devono seguire il tipo della mossa
    // effettivamente usata, non solo il primo tipo del Pokémon.
    const activeSkill = typeof PokeMisteryRL_SkillSystem !== "undefined"
      ? PokeMisteryRL_SkillSystem.getPokemonSkill(attacker, Number(attacker.sk) || 1)
      : null;
    const isSpecialMove = String(activeSkill?.damageClass || activeSkill?.categoria || "").toLowerCase() === "special" || String(activeSkill?.categoria || "").toLowerCase() === "speciale";
    const movePower = Math.max(1, Number(activeSkill?.pwr ?? activeSkill?.power) || 50);
    const attackerEffectiveStats = getEffectivePokemonStats(attacker, activeSkill);
    const targetEffectiveStats = getEffectivePokemonStats(target);
    const attackerEffects = attackerEffectiveStats.effects;
    const targetEffects = targetEffectiveStats.effects;
    const attackPower = Number(isSpecialMove ? attackerEffectiveStats.satk : attackerEffectiveStats.atk);
    const targetDefense = Number(isSpecialMove ? targetEffectiveStats.sdef : targetEffectiveStats.dif) * (Number(target.__campaignDefDown) || 1);
    const attackTypeAliases = { fire:"fuoco", water:"acqua", grass:"erba", electric:"elettro", ice:"ghiaccio", fighting:"lotta", ground:"terra", flying:"volante", psychic:"psico", bug:"coleottero", rock:"roccia", ghost:"spettro", dragon:"drago", dark:"buio", steel:"acciaio", fairy:"folletto", normal:"normale", poison:"veleno" };
    let attackType = attackTypeAliases[String(activeSkill?.type || activeSkill?.tipo || attacker.tipi?.[0] || "normale").toLowerCase()] || String(activeSkill?.type || activeSkill?.tipo || attacker.tipi?.[0] || "normale").toLowerCase();
    const cardLevel = PokeMisteryRL.TypeCards?.level?.(attackType) || 0;
    const borrowedNormalType = targetIsEnemy
      ? PokeMisteryRL.Campaigns?.normalMoveType?.(attacker)
      : null;
    if(borrowedNormalType) attackType = borrowedNormalType;

    let mult =
      getTypeMultiplier(

        attackType,

        target.tipi || []
      );
    // Terra 3+: i Pokémon Volante non sono più immuni alle mosse Terra.
    if(
      targetIsEnemy &&
      PokeMisteryRL.Campaigns?.evolved?.("terra") &&
      attackType === "terra" &&
      (target.tipi || []).includes("volante") &&
      mult === 0
    ){
      mult = 1;
    }


    const base =
      Math.max(

        8,

        Math.floor(

          (attackPower * movePower) /

          (targetDefense + 30)

        ) + 5

      );


    const crit =
      Math.random() < (0.15 + (targetIsEnemy ? PokeMisteryRL.Campaigns?.critBonus?.() || 0 : 0));


    const itemBonus =
      targetIsEnemy
        ? getTypeItemDamageBonus(attackType, attacker)
        : 0;


    let dmg =
      Math.max(

        1,

        Math.floor(

          base *
          mult *
          attackerEffects.movePowerMultiplier *
          (crit ? 1.7 : 1)

        )

      );

    if(targetIsEnemy){
      // Notte Eterna è una regola di squadra, non del solo Pokémon Buio.
      dmg = Math.max(1, Math.floor(
        dmg * (PokeMisteryRL.Campaigns?.attackTypeMultiplier?.(attackType) || 1) *
        (target.__campaignFrozenTurns ? 1.5 : 1)
      ));
      // Esecuzione: finisce automaticamente i bersagli già in fin di vita.
      if(PokeMisteryRL.Campaigns?.level?.("buio") && Number(target.hp) / Math.max(1, Number(target.maxHp)) < .25){
        dmg = Math.max(1, Math.floor(dmg * 1.5));
      }
      // Spinta: una scarica più forte a cadenza regolare.
      if(PokeMisteryRL.Campaigns?.level?.("lotta") && !bonusStrike){
        attacker.__campaignPushes = (Number(attacker.__campaignPushes) || 0) + 1;
        const cadence = [0,5,4,3,3][PokeMisteryRL.Campaigns.level("lotta")] || 3;
        if(attacker.__campaignPushes % cadence === 0) dmg = Math.max(1, Math.floor(dmg * 1.65));
      }
      // Carte typing Test: il bonus è legato alla mossa effettivamente usata.
      if(cardLevel && ["fuoco", "normale"].includes(attackType)){
        dmg = Math.max(1, Math.floor(dmg * (1 + cardLevel * .10)));
      }
      if(cardLevel && attackType === "buio" && Number(target.hp) / Math.max(1, Number(target.maxHp)) < .50){
        dmg = Math.max(1, Math.floor(dmg * (1 + cardLevel * .25)));
      }
      if(cardLevel && attackType === "lotta" && !bonusStrike){
        attacker.__typeCardCombo = (Number(attacker.__typeCardCombo) || 0) + 1;
        if(attacker.__typeCardCombo % 3 === 0){
          dmg = Math.max(1, Math.floor(dmg * (1 + cardLevel * .30)));
          attacker.__typeCardComboHit = true;
        }
      }
    }


    // DANNO
    const targetWasAlive = Number(target.hp) > 0;

    if (targetIsEnemy) {

      const battle =
        PKM_RUN.battle;

      target.hp = clamp(target.hp - dmg, 0, target.maxHp);
      // I vecchi campi restano per il primo nemico e per compatibilità UI.
      if(target === battle.enemy){
        battle.hp = target.hp;
        battle.enemy.hp = target.hp;
      }

      if(targetWasAlive && Number(target.hp) <= 0){
        grantLevelForKnockout(attacker, target);
      }


    } else {

      target.hp =
        clamp(

          target.hp - dmg,

          0,

          target.maxHp

        );
    }

    if(targetIsEnemy && attackerEffects.lifeOrbActive){
      const recoil = Math.max(1, Math.ceil((Number(attacker.maxHp) || 1) * .10));
      attacker.hp = clamp(Number(attacker.hp) - recoil, 0, attacker.maxHp);
      log(`${attacker.nome} subisce ${recoil} danni da Assorbisfera.`);
    }
    if(targetIsEnemy && attackerEffects.ids.includes("avanzi")){
      const heal = Math.max(1, Math.ceil((Number(attacker.maxHp) || 1) / 16));
      attacker.hp = clamp(Number(attacker.hp) + heal, 0, attacker.maxHp);
      log(`${attacker.nome} recupera ${heal} HP con Avanzi.`);
    }
    if(targetIsEnemy && attacker.__weaknessBoost){
      delete attacker.__weaknessBoost;
    }
    if(targetIsEnemy){
      if(cardLevel && attackType === "fuoco" && cardLevel >= 2) target.__campaignBurned = true;
      if(cardLevel && attackType === "veleno"){
        target.__campaignPoisoned = true;
        target.__campaignPoison = Math.max(1, Math.ceil(Number(target.maxHp) * .04));
      }
      if(cardLevel && attackType === "elettro") target.__campaignStunTurns = 1;
      if(cardLevel && ["terra", "ghiaccio"].includes(attackType)) target.__campaignSlow = Math.min(.90, cardLevel * .10);
      if(cardLevel && attackType === "acqua"){
        const healing = Math.max(1, Math.ceil(Number(attacker.maxHp) * (.04 * cardLevel)));
        attacker.hp = Math.min(attacker.maxHp, Number(attacker.hp) + healing);
      }
      if(cardLevel && attackType === "erba"){
        const healing = Math.max(1, Math.ceil(Number(attacker.maxHp) * (.02 * cardLevel)));
        attacker.hp = Math.min(attacker.maxHp, Number(attacker.hp) + healing);
      }
      if(cardLevel && attackType === "drago" && !bonusStrike){
        const allEnemies = PKM_RUN?.battle?.enemies || [];
        const behind = allEnemies[allEnemies.indexOf(target) + 1];
        if(behind && Number(behind.hp) > 0){
          const behindWasAlive = Number(behind.hp) > 0;
          const splash = Math.max(1, Math.floor(dmg * Math.min(1, cardLevel * .25)));
          behind.hp = Math.max(0, Number(behind.hp) - splash);
          PokeMisteryRL.UI?.spawnDamage?.(allEnemies.indexOf(behind) === 1 ? "enemy2" : "enemy", splash, "normal", battlePlayerKey(attacker));
          if(behindWasAlive && Number(behind.hp) <= 0) grantLevelForKnockout(attacker, behind);
        }
      }
      (PokeMisteryRL.Campaigns?.playerHitEffects?.(attacker, target, attackType) || [])
        .forEach(log);
      if(Number(target.hp) > 0 && PokeMisteryRL.Campaigns?.level?.("elettro")){
        target.__campaignStunTurns = 1;
        log(`⚡ Primo Colpo: ${target.nome} è stordito.`);
      }
      const battleEnemies = (PKM_RUN?.battle?.enemies || []).filter(foe => foe && Number(foe.hp) > 0);
      // Assistenza Fuoco: una fiammella extra sullo stesso bersaglio.
      if(!bonusStrike && Number(target.hp) > 0 && Math.random() < (PokeMisteryRL.Campaigns?.tacticalChance?.("fuoco") || 0)){
        log(`🔥 Assistenza: ${attacker.nome} spara una fiammella extra!`);
        setTimeout(() => attack(attacker, target, true, true), isTestCampaign() ? 398 : 180);
      }
      // Assalto Volante: colpisce anche le retrovie senza sovrapporre i bersagli.
      if(!bonusStrike && PokeMisteryRL.Campaigns?.level?.("volante")){
        battleEnemies.filter(foe => foe !== target).slice(0, PokeMisteryRL.Campaigns.level("volante") >= 3 ? 2 : 1)
          .forEach((foe, index) => setTimeout(() => attack(attacker, foe, true, true), isTestCampaign() ? (575 + index * 332) : (260 + index * 150)));
      }
      // Soffio Linea Drago: metà danno al Pokémon subito dietro.
      if(!bonusStrike && PokeMisteryRL.Campaigns?.level?.("drago")){
        const allEnemies = PKM_RUN?.battle?.enemies || [];
        const behind = allEnemies[allEnemies.indexOf(target) + 1];
        if(behind && Number(behind.hp) > 0 && Math.random() < (PokeMisteryRL.Campaigns?.tacticalChance?.("drago") || 0)){
          const behindWasAlive = Number(behind.hp) > 0;
          const splash = Math.max(1, Math.floor(dmg * .5));
          behind.hp = Math.max(0, Number(behind.hp) - splash);
          PokeMisteryRL.UI?.spawnDamage?.(allEnemies.indexOf(behind) === 1 ? "enemy2" : "enemy", splash, "normal", battlePlayerKey(attacker));
          if(behindWasAlive && Number(behind.hp) <= 0) grantLevelForKnockout(attacker, behind);
          log(`🐉 Soffio Linea colpisce anche ${behind.nome} -${splash}`);
        }
      }
      // Copia Normale: chi agisce dietro ripete una volta l'attacco del fronte.
      const playerOrder = getBattlePlayers();
      if(!bonusStrike && PokeMisteryRL.Campaigns?.level?.("normale") && playerOrder.indexOf(attacker) > 0 &&
        PKM_RUN?.battle?.campaignCopyTurn !== PKM_RUN?.battle?.turn){
        PKM_RUN.battle.campaignCopyTurn = PKM_RUN.battle.turn;
        log(`◌ Copia: ${attacker.nome} replica l'attacco davanti a lui.`);
        setTimeout(() => attack(attacker, target, true, true), isTestCampaign() ? 508 : 230);
      }
      // Scia Veleno: la morte contamina i nemici adiacenti.
      if(Number(target.hp) <= 0 && PokeMisteryRL.Campaigns?.level?.("veleno")){
        const allEnemies = PKM_RUN?.battle?.enemies || [];
        const defeatedIndex = allEnemies.indexOf(target);
        [allEnemies[defeatedIndex - 1], allEnemies[defeatedIndex + 1]].filter(foe => foe && Number(foe.hp) > 0).forEach(foe => {
          foe.__campaignPoisoned = true;
          foe.__campaignPoison = Math.max(4, Math.ceil(Number(foe.maxHp) * [.02,.03,.04,.05,.06][PokeMisteryRL.Campaigns.level("veleno")]));
          log(`☠ Scia avvelena ${foe.nome}.`);
        });
      }
      if(!bonusStrike && Number(target.hp) > 0 && PokeMisteryRL.Campaigns?.psychicExtraAttack?.()){
        log(`◉ Mente Alveare: ${attacker.nome} colpisce di nuovo!`);
        setTimeout(() => {
          if(PKM_RUN?.battle && Number(attacker.hp) > 0 && Number(target.hp) > 0){
            attack(attacker, target, true, true);
          }
        }, 230);
      }
    }


    // LOG

    log(

      `${attacker.nome} usa Attacco! -${dmg}` +

      `${crit ? " CRIT!" : ""} ` +

      `${itemBonus > 0 ? ` OGGETTO +${Math.round(itemBonus * 100)}%` : ""}` +

      `${borrowedNormalType ? ` METRONOMO LIV 3: ${borrowedNormalType.toUpperCase()}` : ""}` +

      `${getMultLabel(mult)}`
    );


    // ANIMAZIONE

    const targetName = targetIsEnemy ? battleEnemyKey(target) : battlePlayerKey(target);

    PokeMisteryRL.UI.spawnTypeAttack(
      targetIsEnemy ? battlePlayerKey(attacker) : battleEnemyKey(attacker),
      targetName,
      attackType,
      dmg
    );


    PokeMisteryRL.UI.spawnDamage(

      targetName,

      dmg,

      crit
        ? "crit"
        : "normal",

      targetIsEnemy ? battlePlayerKey(attacker) : (attacker === PKM_RUN.battle?.enemies?.[1] ? "enemy2" : "enemy")
    );


    PokeMisteryRL.UI.hitShake(
      targetName
    );


    PokeMisteryRL.UI.updateBattleHP();


    return true;
  };


  // TURNO AUTOMATICO

  const handleDefeatedEnemies = () => {
    const battle = PKM_RUN?.battle;
    if(!battle) return;
    const nextWave = battle.wavePreviews?.shift?.();
    if(Array.isArray(nextWave) && nextWave.length){
      const enemies = nextWave.map(preview => createEnemy(true, preview)).filter(Boolean);
      if(enemies.length){
        battle.enemies = enemies;
        battle.enemy = enemies[0];
        battle.hp = enemies[0].hp;
        battle.maxHp = enemies[0].maxHp;
        battle.stats = enemies[0].stats;
        battle.enemySlots = [];
        battle.phase = 0;
        const wave = 3 - battle.wavePreviews.length;
        log(`ONDATA ${wave}/3: ${enemies.map(enemy => enemy.nome).join(" + ")}!`);
        showBattleSurface(PokeMisteryRL.UI.buildBattleTemplate(true, PKM_RUN.floor));
        PokeMisteryRL.UI.updateBattleHP();
        setTimeout(autoTurn, isTestCampaign() ? 420 : 650);
        return;
      }
    }
    win();
  };

  const autoTurn = () => {

    if (!PKM_RUN?.battle) {
      return;
    }


    const battle =
      PKM_RUN.battle;

    // La formazione viene aperta solo se il giocatore l'ha prenotata.
    if(isTestCampaign() && battle.phase === 0 && battle.formationRequested && !battle.formationPending){
      battle.formationRequested = false;
      battle.formationPending = true;
      showBattleSurface(PokeMisteryRL.UI.buildBattleTemplate(!!battle.boss, PKM_RUN.floor));
      PokeMisteryRL.UI.updateBattleHP();
      return;
    }
    if(isTestCampaign() && battle.formationPending) return;


    const s1 =
      getStarter1();

    const s2 =
      getStarter2();

    const enemy = battle.enemy;
    const enemies = Array.isArray(battle.enemies) && battle.enemies.length
      ? battle.enemies
      : [enemy];


    // CONTROLLO GAME OVER

    if (isTeamDead()) {

      gameover();

      return;
    }


    // CONTROLLO VITTORIA

    if (enemies.every(p => Number(p?.hp) <= 0)) {

      handleDefeatedEnemies();

      return;
    }


    // CREA LISTA DEGLI ATTACCANTI VIVI

    const attackers = [
      ...getAliveStarters(),
      ...enemies
    ].filter(
      p =>
        p &&
        Number(p.hp) > 0
    );


    // ORDINE PER SPD

    attackers.sort((a, b) => {
      const priority = pokemon => (
        getBattlePlayers().includes(pokemon) && PokeMisteryRL.Campaigns?.level?.("elettro")
          ? 100000 : 0
      );
      const effectiveSpeed = pokemon => Number(pokemon.stats?.spd ?? 0) * (1 - (Number(pokemon.__campaignSlow) || 0));
      return (priority(b) + effectiveSpeed(b)) - (priority(a) + effectiveSpeed(a));
    });


    // ESEGUI UN ATTACCO ALLA VOLTA

    const attacker =
      attackers[battle.phase];


    if (!attacker) {

      battle.phase = 0;

      battle.turn++;
      // Fine turno: prima i danni continui, poi lo stato viene valutato
      // prima di iniziare il turno seguente.
      (PokeMisteryRL.Campaigns?.roundEffects?.(battle) || []).forEach(log);
      PokeMisteryRL.UI.updateBattleHP();
      PokeMisteryRL.UI.refreshBottomPanel();
      if(!(battle.enemies || []).some(foe => Number(foe?.hp) > 0)){
        handleDefeatedEnemies();
        return;
      }
      (battle.enemies || []).filter(foe => Number(foe.__campaignFrozenTurns) > 0 && Number(foe.hp) > 0)
        .forEach(foe => log(`❄ ${foe.nome} resterà congelato al prossimo attacco.`));
      if(PokeMisteryRL.Campaigns?.endTurnHeal?.(battle)){
        PokeMisteryRL.UI.updateBattleHP();
        PokeMisteryRL.UI.refreshBottomPanel();
        log("Le sinergie curano la squadra.");
      }


      setTimeout(
        autoTurn,
        isTestCampaign() ? 420 : 900
      );

      return;
    }

    // Protezione finale: un KO non può mai eseguire un'azione, nemmeno se
    // un effetto continuo lo ha eliminato tra due passaggi del turno.
    if(Number(attacker.hp) <= 0){
      battle.phase++;
      setTimeout(autoTurn, 0);
      return;
    }

    // Evidenzia il combattente che sta per compiere l'azione corrente.
    document.querySelectorAll("#battleFinal .bf-sprite.is-attacking, #bottomCampagna .is-attacking").forEach(element => element.classList.remove("is-attacking"));
    const playerIndex = getBattlePlayers().indexOf(attacker);
    const enemyIndex = enemies.indexOf(attacker);
    const attackerElement = playerIndex >= 0
      ? document.querySelector(`[data-battle-player="${playerIndex}"]`)
      : (isTest2Mode()
        ? document.querySelector(`#bottomCampagna [data-battle-enemy="${enemyIndex}"]`)
        : document.querySelector(`#battleFinal .bf-sprite.enemy-${enemyIndex}`));
    attackerElement?.classList.add("is-attacking");


    // IL NEMICO ATTACCA

    if (enemies.includes(attacker)) {

      if(Number(attacker.__campaignStunTurns) > 0){
        attacker.__campaignStunTurns--;
        log(`⚡ ${attacker.nome} è stordito e perde il turno.`);
        battle.phase++;
        PokeMisteryRL.UI.updateBattleHP();
        setTimeout(autoTurn, isTestCampaign() ? 280 : 450);
        return;
      }

      if(Number(attacker.__campaignFrozenTurns) > 0){
        attacker.__campaignFrozenTurns--;
        log(`❄ ${attacker.nome} è congelato e salta il turno.`);
        battle.phase++;
        setTimeout(autoTurn, isTestCampaign() ? 280 : 450);
        return;
      }

      const targets =
        getAliveStarters();


      if (!targets.length) {

        gameover();

        return;
      }


      // In Test2 il bersaglio segue la formazione: colonna destra, poi
      // centrale, poi sinistra. Non c'è più alcuna scelta casuale.
      let target = isTest2Mode()
        ? getTest2RightmostLivingTarget(targets)
        : (isTestCampaign()
          ? targets[targets.length - 1]
          : (s2 && Number(s2.hp) > 0 ? s2 : (s1 && Number(s1.hp) > 0 ? s1 : null)));

      // Taunt Acciaio: se è presente, il nemico deve puntare il suo portatore.
      const taunter = targets.find(pokemon => (pokemon.tipi || []).includes("acciaio"));
      if(!isTest2Mode() && PokeMisteryRL.Campaigns?.level?.("acciaio") && taunter) target = taunter;


      if (!target) {

        gameover();

        return;
      }


      const enemySkill = typeof PokeMisteryRL_SkillSystem !== "undefined"
        ? PokeMisteryRL_SkillSystem.getPokemonSkill(attacker, Number(attacker.sk) || 1)
        : null;
      const enemySpecialMove = String(enemySkill?.damageClass || enemySkill?.categoria || "").toLowerCase() === "special" || String(enemySkill?.categoria || "").toLowerCase() === "speciale";
      const enemyMovePower = Math.max(1, Number(enemySkill?.pwr ?? enemySkill?.power) || 50);
      const enemyAttackType = normalizeItemType(enemySkill?.type || attacker.tipi?.[0] || "normale");
      const enemyEffectiveStats = getEffectivePokemonStats(attacker, enemySkill);
      const targetEffectiveStats = getEffectivePokemonStats(target);
      const eMult =
        getTypeMultiplier(
          enemyAttackType,
          target.tipi || []
        );
      const enemyOffense = Number(enemySpecialMove ? enemyEffectiveStats.satk : enemyEffectiveStats.atk);
      const targetResistance = Number(enemySpecialMove ? targetEffectiveStats.sdef : targetEffectiveStats.dif);
      const eBase =
        Math.max(
          5,
          Math.floor((enemyOffense * enemyMovePower) / (targetResistance + 30)) + 3
        );


      const eCrit =
        Math.random() < 0.15;

      let eDmg =
        Math.max(

          1,

          Math.floor(
            eBase * eMult * enemyEffectiveStats.effects.movePowerMultiplier * (eCrit ? 1.7 : 1)
          )

        );

      eDmg = Math.max(1, Math.floor(eDmg * (PokeMisteryRL.Campaigns?.damageTakenMultiplier?.(eCrit) || 1)));


      let evaded = false;
      if(Math.random() < (PokeMisteryRL.Campaigns?.enemyAccuracyPenalty?.() || 0) ||
        Math.random() < (PokeMisteryRL.Campaigns?.dodgeChance?.(enemyAttackType) || 0)){
        eDmg = 0;
        evaded = true;
        log(`${target.nome} evita il colpo!`);
      }
      if(PKM_RUN?.battle?.campaignRain && enemyAttackType === "fuoco"){
        eDmg = Math.max(1, Math.floor(eDmg * .70));
      }

      const targetHeldEntries = getHeldItemsForPokemon(target);
      const targetHeldIds = (Array.isArray(targetHeldEntries) ? targetHeldEntries : targetHeldEntries ? [targetHeldEntries] : []).map(x => x?.id || x);
      if(targetHeldIds.includes("palla_fumo") && Number(target.hp) / Math.max(1, Number(target.maxHp)) < .20 && Math.random() < .35){
        eDmg = 0;
        log(`${target.nome} evita il colpo con Palla Fumo!`);
      }

      if(eDmg > 0 && Number(target.__campaignShield) > 0){
        const absorbed = Math.min(eDmg, Number(target.__campaignShield));
        target.__campaignShield -= absorbed;
        eDmg -= absorbed;
        log(`⬟ Scudo assorbe ${absorbed} danni.`);
      }

      // Acqua: una sola Difesa Impenetrabile per battaglia, prima del KO.
      if(eDmg > 0 && PokeMisteryRL.Campaigns?.level?.("acqua") && !battle.campaignWaterShieldUsed &&
        Number(target.hp) - eDmg < Number(target.maxHp) * .20){
        const shield = Math.ceil(Number(target.maxHp) * [0,.35,.60,1,1][PokeMisteryRL.Campaigns.level("acqua")]);
        target.__campaignShield = shield;
        battle.campaignWaterShieldUsed = true;
        const absorbed = Math.min(eDmg, shield);
        target.__campaignShield -= absorbed;
        eDmg -= absorbed;
        log(`💧 Difesa Impenetrabile protegge ${target.nome}.`);
      }

      // Intangibile: i primi attacchi nemici attraversano la squadra.
      if(eDmg > 0 && Number(battle.campaignGhostDodges) > 0){
        battle.campaignGhostDodges--;
        eDmg = 0;
        evaded = true;
        log(`👻 Intangibile: ${target.nome} viene attraversato dal colpo.`);
      }

      // Sciame Coleottero: al primo KO imminente compare un clone verde protettivo.
      if(eDmg > 0 && PokeMisteryRL.Campaigns?.level?.("coleottero") && !battle.campaignBugCloneUsed &&
        Number(target.hp) - eDmg <= 0){
        const cloneHp = Math.ceil(Number(target.maxHp) * [0,.30,.60,1,1.5][PokeMisteryRL.Campaigns.level("coleottero")]);
        battle.campaignBugCloneUsed = true;
        const absorbed = Math.min(eDmg, cloneHp);
        target.__campaignCloneHp = Math.max(0, cloneHp - absorbed);
        eDmg -= absorbed;
        log(`🐛 Sciame: un clone verde protegge ${target.nome}.`);
      }
      if(eDmg > 0 && Number(target.__campaignCloneHp) > 0){
        const absorbed = Math.min(eDmg, Number(target.__campaignCloneHp));
        target.__campaignCloneHp -= absorbed;
        eDmg -= absorbed;
        log(`✺ Sciame assorbe ${absorbed} danni.`);
      }


      target.hp =
        clamp(

          target.hp - eDmg,

          0,

          target.maxHp

        );

      if(eDmg > 0 && PokeMisteryRL.Campaigns?.level?.("terra")){
        attacker.__campaignSlow = .40;
        log(`◆ Contatto: ${attacker.nome} rallentato del 40%.`);
      }


      // Mantieni PKM_RUN.hp compatibile
      if (target === s1) {

        PKM_RUN.hp =
          target.hp;
      }


      if(eDmg > 0 && PokeMisteryRL.Campaigns?.level?.("roccia") && Math.random() < [0,.08,.14,.20,.25][PokeMisteryRL.Campaigns.level("roccia")]){
        const rebound = Math.max(1, Math.floor(eDmg * .5));
        attacker.hp = Math.max(0, Number(attacker.hp) - rebound);
        log(`🪨 Rimbalzo restituisce ${rebound} danni.`);
      }

      // Il Partner sconfitto lascia cadere gli oggetti: tornano nello zaino.
      if(target !== s1 && Number(target.hp) <= 0){
        const returned = returnPokemonHeldItemsToBag(target);
        if(returned) log(`${target.nome} è KO: ${returned} oggett${returned === 1 ? "o" : "i"} torna${returned === 1 ? "" : "no"} nello zaino.`);
      }


      log(

        `${attacker.nome} colpisce ${target.nome} -${eDmg}${eCrit ? " CRIT!" : ""}`

      );

      if(eDmg > 0 && targetHeldIds.includes("bitorzolello")){
        const recoil = Math.max(1, Math.ceil((Number(attacker.maxHp) || 1) / 6));
        attacker.hp = clamp(Number(attacker.hp) - recoil, 0, attacker.maxHp);
        log(`${attacker.nome} subisce ${recoil} danni da Bitorzolello.`);
      }
      if(eDmg > 0 && targetHeldIds.includes("vulneropolizza") && eMult >= 2){
        target.__weaknessBoost = 2;
        log(`${target.nome} attiva Vulneropolizza: Attacco +2 livelli.`);
      }


      const targetName = battlePlayerKey(target);

      PokeMisteryRL.UI.spawnTypeAttack(
        battleEnemyKey(attacker),
        targetName,
        enemyAttackType,
        eDmg
      );


      PokeMisteryRL.UI.spawnDamage(

        targetName,

        eDmg,

        evaded ? "evade" : (eCrit ? "crit" : "normal"),

        battleEnemyKey(attacker)

      );


      PokeMisteryRL.UI.hitShake(
        targetName
      );


      PokeMisteryRL.UI.updateBattleHP();


      PokeMisteryRL.UI.refreshBottomPanel();


      // GAME OVER

      if (isTeamDead()) {

        setTimeout(
          gameover,
          isTestCampaign() ? 400 : 500
        );

        return;
      }
    }


    // ATTACCO S1 / S2

    else {

      if (enemies.every(p => Number(p?.hp) <= 0)) {

        handleDefeatedEnemies();

        return;
      }


      const livingEnemies = enemies.filter(p => Number(p?.hp) > 0);
      // Test2: priorità per gli slot fisici N1 → N2 → N3 → N4 → N5 → N6.
      // S3 punta il primo, S2 il secondo e S1 il terzo nemico disponibile.
      const slotPriority = [0, 2, 4, 1, 3, 5];
      const orderedEnemies = isTest2Mode()
        ? [...livingEnemies].sort((left, right) => {
            const leftIndex = enemies.indexOf(left);
            const rightIndex = enemies.indexOf(right);
            const leftSlot = Number(battle.enemySlots?.[leftIndex]);
            const rightSlot = Number(battle.enemySlots?.[rightIndex]);
            return (slotPriority.indexOf(leftSlot) + 10) % 10 - (slotPriority.indexOf(rightSlot) + 10) % 10;
          })
        : livingEnemies;
      const playerIndex = getBattlePlayers().indexOf(attacker);
      const targetRank = playerIndex === 2 ? 0 : playerIndex === 1 ? 1 : 2;
      const darkTargetsBack = !isTest2Mode() && PokeMisteryRL.Campaigns?.level?.("psico");
      attack(
        attacker,
        (isTest2Mode()
          ? (orderedEnemies[targetRank] || orderedEnemies[0])
          : (darkTargetsBack ? livingEnemies[livingEnemies.length - 1] : livingEnemies[0])) || enemy,
        true
      );


      if (enemies.every(p => Number(p?.hp) <= 0)) {

        setTimeout(
          handleDefeatedEnemies,
          isTestCampaign() ? 400 : 500
        );

        return;
      }
    }


    // PROSSIMO ATTACCANTE

    battle.phase++;


    setTimeout(
      autoTurn,
      isTestCampaign() ? 400 : 650
    );
  };


  // FUGA

  const flee = () => {

    if (
      !PKM_RUN?.battle ||
      PKM_RUN.battle.boss
    ) {
      return;
    }


    PKM_RUN.battle =
      null;


    busy = 0;


    next(
      "Fuga"
    );
  };


  const showShelterLevelReward = (reward) => {
    const itemDb = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
    const healingItems = Object.values(itemDb).filter(item => item?.id && String(item.tipo || "").toLowerCase() === "cura");
    const received = [rand(healingItems), rand(healingItems)].filter(Boolean);
    PKM_RUN.items ||= [];
    received.forEach(item => {
      const owned = PKM_RUN.items.find(entry => String(entry?.id || entry) === String(item.id));
      if(owned) owned.qty = Math.max(0, Number(owned.qty) || 0) + 1;
      else PKM_RUN.items.push({id:item.id, qty:1});
    });
    PKM_RUN.inventory = PKM_RUN.items;
    PokeMisteryRL.UI.refreshBottomPanel();
    if(isTest2Mode()){
      $("bottomCampagna")?.classList.remove("test2-node-finish");
      PokeMisteryRL.UI.refreshBottomPanel();
      const map = $("map");
      if(map){
        map.className = "test2-shelter-map";
        map.innerHTML = `<section class="test2-shelter-panel"><span>♥ SFIDA DEL RIFUGIO</span><h2>Chansey è stata sconfitta!</h2><p>Hai ricevuto <b>2 oggetti curativi</b>.</p><div class="test2-shelter-items">${received.map(item => `<article><img src="${item.immagine || ""}" alt="${item.nome}"><b>${item.nome}</b><small>Oggetto curativo</small></article>`).join("") || "<small>Ricompensa non disponibile.</small>"}</div><button type="button" onclick="next('Premio del Rifugio ottenuto')">CONTINUA</button></section>`;
      }
      return;
    }
    next(`Vittoria contro Chansey! Ricevi ${received.length} oggetti curativi.`);
  };

  const chooseShelterLevelReward = (key) => {
    const pokemon = PKM_RUN?.teamSlots?.[Number(key)];
    if(!pokemon) return false;
    PokeMisteryRL_LevelSystem.levelUp(pokemon, 5);
    PokeMisteryRL.UI.refreshBottomPanel();
    next(`${pokemon.nome} ottiene +5 livelli dalla sfida del Rifugio.`);
    return true;
  };

  const showSkillLevelReward = (reward) => {
    if(isTest2Mode()){
      PokeMisteryRL.UI?.refreshBottomPanel?.();
      $("bottomCampagna")?.classList.remove("test2-node-finish");
      const map = $("map");
      const opponent = PKM_RUN?.lastChallenge?.enemy;
      const bottom = $("bottomCampagna");
      if(bottom && opponent){
        bottom.querySelectorAll(".test2-dojo-challenger").forEach(entry => entry.remove());
        bottom.insertAdjacentHTML("beforeend", `<div class="test2-dojo-challenger"><span class="test2-dojo-versus">⚔ VS</span><em class="test2-challenger-level">LV ${opponent.level || 1}</em><img src="${sprite(opponent.immagine)}" alt="${opponent.nome}"></div>`);
        // Dopo il fight S1/S2 restano fermi nella formazione; l'effetto può
        // restare soltanto sullo sfidante sconfitto.
        bottom.querySelectorAll(".test2-dojo-challenger").forEach(entry => entry.classList.add("test2-dojo-victory-shake"));
      }
      if(!map) return;
      map.className = "test2-dojo-map";
      const targets = [["S1", PKM_RUN?.activePokemon, 0], ["S2", PKM_RUN?.secondActive, 1], ["S3", PKM_RUN?.teamSlots?.[0], 2]].filter(([,pokemon]) => pokemon);
      map.innerHTML = `<div class="test2-dojo-prize-panel test2-dojo-item-choice"><span>🥋 SFIDA DEL DOJO</span><h2>VITTORIA!</h2><p>+${reward} ¥ · Scegli chi riceve l'oggetto potenziatore.</p><div class="test2-dojo-item-targets">${targets.map(([label,pokemon,index]) => `<button type="button" onclick="PokeMisteryRL.Battle.chooseSkillLevelReward(${index})"><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"><span>${label}</span><b>${pokemon.nome}</b><small>${(pokemon.tipi || []).map(getTypingBadge).join("")}</small></button>`).join("")}</div></div>`;
      return;
    }
    next("Vittoria al Dojo!");
  };
  const continueDojoSkillReward = () => {
    PokeMisteryRL.Effects?.skill?.();
    return true;
  };
  const chooseSkillLevelReward = (index) => {
    const pokemon = [PKM_RUN?.activePokemon, PKM_RUN?.secondActive, ...(PKM_RUN?.teamSlots || [])].filter(Boolean).slice(0, 4)[Number(index)];
    if(!pokemon) return false;
    const types = [...new Set((pokemon.tipi || []).filter(Boolean))];
    if(types.length <= 1) return grantDojoTypeItem(pokemon, types[0] || "normale");
    const map = $("map");
    if(!map) return false;
    map.className = "test2-dojo-map";
    map.innerHTML = `<div class="test2-dojo-prize-panel test2-dojo-type-choice"><span>🥋 PREMIO DEL DOJO</span><h2>Scegli il tipo</h2><p>${pokemon.nome} può ricevere un solo potenziatore.</p><div class="test2-dojo-type-options">${types.map(type => `<button type="button" onclick="PokeMisteryRL.Battle.grantDojoTypeItem(${Number(index)},'${String(type).replace(/'/g,"\\'")}')">${getTypingBadge(type)}<b>${String(type).toUpperCase()}</b></button>`).join("")}</div></div>`;
    return true;
  };
  const grantDojoTypeItem = (indexOrPokemon, type) => {
    const pokemon = typeof indexOrPokemon === "object" ? indexOrPokemon : [PKM_RUN?.activePokemon, PKM_RUN?.secondActive, ...(PKM_RUN?.teamSlots || [])].filter(Boolean).slice(0, 4)[Number(indexOrPokemon)];
    const itemDb = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
    const item = Object.values(itemDb).find(entry => entry?.tipo === "potenziamento_tipo" && String(entry?.tipo_mossa || "").toLowerCase() === String(type || "").toLowerCase());
    if(!pokemon || !item) return false;
    PKM_RUN.items ||= [];
    const owned = PKM_RUN.items.find(entry => String(entry?.id || entry) === String(item.id));
    if(owned) owned.qty = Math.max(0, Number(owned.qty) || 0) + 1;
    else PKM_RUN.items.push({ id:item.id, qty:1 });
    PKM_RUN.inventory = PKM_RUN.items;
    PokeMisteryRL.UI.refreshBottomPanel();
    const map = $("map");
    if(map){
      map.className = "test2-dojo-map";
      map.innerHTML = `<div class="test2-dojo-prize-panel test2-dojo-item-win"><span>✨ PREMIO OTTENUTO</span>${item.immagine ? `<img src="${item.immagine}" alt="${item.nome}">` : "◈"}<h2>${item.nome}</h2><p>${pokemon.nome} ha scelto il potenziatore ${getTypingBadge(type)}.</p><button type="button" onclick="next('Premio del Dojo ottenuto')">CONTINUA</button></div>`;
    }
    return true;
  };

  // VITTORIA + RECLUTAMENTO
  const win = () => {
    if (!PKM_RUN?.battle) return;

    const battle = PKM_RUN.battle;
    const starter1 = PKM_RUN.activePokemon;
    const starter2 = PKM_RUN.secondActive;
    const baseReward = battle.boss ? 150 : 50;
    const amuletCoinActive = getBattlePlayers().some(pokemon =>
      getHeldItemsForPokemon(pokemon).some(entry => String(entry?.id || entry) === "amuleto")
    );
    const reward = baseReward * (amuletCoinActive ? 2 : 1);
    PKM_RUN.bits += reward;

    const defeated = battle.enemy;
    if(battle.shopFight){
      PKM_RUN.kecleonDefeated = true;
      PKM_RUN.kecleonFreeShopOpen = true;
      // L'assortimento al momento della sconfitta è definitivo per tutta la run.
      const frozenOffers = PKM_RUN.shopOffers?.length ? PKM_RUN.shopOffers : PKM_RUN.lastShopOffers;
      PKM_RUN.kecleonFreeOffers = (frozenOffers || []).map(entry => ({ id:entry.id }));
      PKM_RUN.kecleonAbandonedOffers = PKM_RUN.kecleonFreeOffers.map(entry => ({ ...entry }));
    }
    if(battle.shelterFight || battle.skillFight){
      const currentNode = PKM_RUN?.map?.[PKM_RUN?.row]?.[PKM_RUN?.col];
      PKM_RUN.lastChallenge = {
        nodeId: currentNode?.id || null,
        kind: battle.shelterFight ? "shelter" : "skill",
        enemy: defeated
      };
    }
    // Boss e incontri di servizio non sono reclutabili. Per non riempire
    // subito la squadra, il Piano 1 ha una chance più alta, i successivi una
    // chance moderata.
    const recruitmentChance = Number(PKM_RUN.floor) === 1 ? .70 : .35;
    const canRecruit = !battle.boss && !battle.shelterFight && !battle.shopFight && !battle.skillFight && !battle.eventFight;
    const recruited = canRecruit && Math.random() < recruitmentChance
      ? PokeMisteryRL.TeamRoster.prepareRecruitment(defeated)
      : null;

    // Chiudiamo lo stato di battaglia prima di mostrare la scelta.
    PKM_RUN.battle = null;
    busy = 0;
    PokeMisteryRL.UI.refreshBottomPanel();

    // Il nodo termina qui: in Test2 la formazione lascia il tratto andando
    // verso destra, quindi solo dopo vengono mostrati premi e scelte.
    const showNodeReward = (callback) => {
      if(!isTest2Mode()) return callback();
      const march = document.getElementById("bottomCampagna");
      if(!march) return callback();
      march.classList.add("test2-node-finish");
      setTimeout(callback, 1060);
    };
    showNodeReward(() => {
    if(battle.shelterFight){
      showShelterLevelReward(reward);
      return;
    }
    if(battle.skillFight){
      showSkillLevelReward(reward);
      return;
    }
    // La run core prosegue subito dopo un boss. Le carte boost restano una
    // feature opzionale esterna, ma non interrompono più il percorso.

    if(battle.eventFight){
      const currentNode = PKM_RUN?.map?.[PKM_RUN?.row]?.[PKM_RUN?.col];
      const itemDb = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
      const rewardPool = Object.values(itemDb).filter(item => item?.id);
      const item = rand(rewardPool);
      const eventBonus = 75;
      PKM_RUN.bits += eventBonus;
      if(item){
        if(!Array.isArray(PKM_RUN.items)) PKM_RUN.items = [];
        const owned = PKM_RUN.items.find(entry => String(entry?.id || entry) === String(item.id));
        if(owned) owned.qty = Math.max(0, Number(owned.qty) || 0) + 1;
        else PKM_RUN.items.push({id:item.id, qty:1});
      }
      PokeMisteryRL.UI.refreshBottomPanel();
      if(isTest2Mode()){
        const bottom = $("bottomCampagna");
        if(bottom && item){
          // Il fight ha appena terminato la marcia di uscita: conserva la
          // formazione dell'arena, ma rendila nuovamente visibile nel premio.
          bottom.classList.remove("test2-node-finish");
          bottom.querySelector(".test2-event-item-scene")?.remove();
          bottom.querySelector(".test2-event-reward-team")?.remove();
          // La formazione resta quella già presente nello scenario fight: non
          // duplicare S1/S2/S3 qui evita coordinate e dimensioni divergenti.
          bottom.insertAdjacentHTML("beforeend", `<div class="test2-event-item-scene"><img src="${item.immagine || ""}" alt="${item.nome}"><span>RICOMPENSA</span></div>`);
        }
        const map = $("map");
        if(map){
          map.className = "test2-event-reward-map";
          map.innerHTML = `<section class="test2-event-reward-panel"><span>✨ PASSAGGIO LIBERO</span><h2>Il passaggio è libero!</h2><p>Ricompensa: <b>+${reward + eventBonus}¥</b></p>${item ? `<div><b>${item.nome}</b><small>Oggetto casuale ottenuto</small></div>` : ""}<button type="button" onclick="next('Hai sconfitto il branco')">CONTINUA</button></section>`;
        }
        return;
      }
      modal(`<div class="center adventure-event-victory"><span>✨ PASSAGGIO LIBERO</span><h2>Il passaggio è libero!</h2><p>Ricompensa: +${reward + eventBonus}¥</p>${item ? `<div class="event-item-reward">${item.immagine ? `<img src="${item.immagine}" alt="">` : "◈"}<b>${item.nome}</b><small>Oggetto casuale ottenuto</small></div>` : ""}<button type="button" onclick="next('Hai sconfitto il branco')">CONTINUA</button></div>`);
      return;
    }

    if (recruited) {
      if (typeof window.showRecruitmentPrompt === "function") {
        window.showRecruitmentPrompt(recruited, reward, starter1, starter2);
      } else {
        console.error("Recruitment system non disponibile");
        modal(`
          <div class="center victory-box">
            <h2>VITTORIA!</h2>
            <p>+${reward}¥</p>
            <button type="button" onclick="window.next('Vittoria!')">CONTINUA</button>
          </div>
        `);
      }
      return;
    }

    const levelText = battle.boss
      ? "Nessun livello dai Boss"
      : (() => {
          const totals = new Map();
          (battle.koLevels || []).forEach(name => {
            const key = String(name || "Pokémon");
            totals.set(key, (totals.get(key) || 0) + 1);
          });
          return totals.size
            ? [...totals].map(([name, levels]) => `+${levels} LIV ${name}`).join(" · ")
            : "Nessun KO";
        })();
    if(isTest2Mode()){
      const map = $("map");
      if(map){
        map.className = "test2-event-reward-map";
        map.innerHTML = `<section class="test2-event-reward-panel"><span>✦ VITTORIA</span><h2>${battle.boss ? "Boss sconfitto!" : "Incontro completato!"}</h2><p>Ricompensa: <b>+${reward}¥</b></p><div><b>${levelText}</b><small>I livelli sono assegnati ai KO.</small></div><button type="button" onclick="next('Vittoria!')">CONTINUA</button></section>`;
        return;
      }
    }
    modal(`<div class="center battle-reward"><span>✦ VITTORIA</span><h2>${battle.boss ? "Boss sconfitto!" : "Incontro completato!"}</h2><p>Nessun Pokémon ha chiesto di unirsi alla squadra.</p><div class="battle-reward-grid"><div><small>DENARO</small><b>+${reward}¥</b></div><div><small>LIVELLI</small><b>${levelText}</b></div></div><button type="button" onclick="next('Vittoria!')">CONTINUA</button></div>`);
    });
  };

  // GAME OVER

  const gameover = () => {

    if (!PKM_RUN) {
      return;
    }


    PKM_RUN.battle =
      null;


    PKM_RUN.dead =
      true;


    busy = 0;


    const s1 =
      PKM_RUN.activePokemon;


    const s2 =
      PKM_RUN.secondActive;


    const s1Dead =
      !s1 ||
      Number(s1.hp) <= 0;


    const s2Dead =
      !s2 ||
      Number(s2.hp) <= 0;


    const deadNames = [

      s1Dead
        ? s1?.nome
        : null,

      s2Dead
        ? s2?.nome
        : null

    ].filter(Boolean);


    modal(`

      <div class="center battle-reward gameover-reward">
        <span>✦ GAME OVER</span>
        <h2>La squadra è esausta</h2>
        <p>${deadNames.length ? deadNames.join(" e ") : "I tuoi Pokémon"} non possono più proseguire.</p>
        <div class="battle-reward-grid">
          <div><small>PIANO RAGGIUNTO</small><b>${PKM_RUN.floor || 1}</b></div>
          <div><small>MONETE RACCOLTE</small><b>${Number(PKM_RUN.bits) || 0}¥</b></div>
        </div>
        <button type="button" onclick="location.reload()">RIPROVA</button>
      </div>

    `);
  };


  return {

    fight,

    autoTurn,

    flee,

    win,

    chooseShelterLevelReward,

    chooseSkillLevelReward,

    continueDojoSkillReward,

    grantDojoTypeItem,

    gameover

  };

})();

window.queueBattleFormationChange = (checked) => {
  const battle = PKM_RUN?.battle;
  if(!battle) return false;
  battle.formationRequested = !!checked;
  return true;
};

window.resumeBattleAfterFormation = () => {
  const battle = PKM_RUN?.battle;
  if(!battle?.formationPending) return false;
  battle.formationPending = false;
  battle.formationTurn = battle.turn;
  showBattleSurface(PokeMisteryRL.UI.buildBattleTemplate(!!battle.boss, PKM_RUN.floor));
  PokeMisteryRL.UI.updateBattleHP();
  setTimeout(() => PokeMisteryRL.Battle.autoTurn(), 120);
  return true;
};

// UI

PokeMisteryRL.UI = (() => {


  // BOTTOM PANEL

  let teamPreviewIndex = 0;
  let inventoryPage = 0;

  const getReserveTeam = () => {
    if(!PKM_RUN) return [];
    return (PKM_RUN.teamSlots || []).filter(Boolean);
  };

  const getRunInventory = () => {
    if(!PKM_RUN) return [];
    // Gli acquisti storicamente venivano salvati in `items`, mentre
    // la UI usa `inventory`: leggiamo quello popolato in entrambi i casi.
    const raw =
      Array.isArray(PKM_RUN.items) && PKM_RUN.items.length
        ? PKM_RUN.items
        : Array.isArray(PKM_RUN.inventory)
          ? PKM_RUN.inventory
          : [];
    return raw;
  };

  const getRunEggs = () => {
    if(!PKM_RUN) return [];
    const raw = Array.isArray(PKM_RUN.eggs)
      ? PKM_RUN.eggs
      : (Array.isArray(PKM_RUN.uova) ? PKM_RUN.uova : []);
    return raw;
  };

  const formatInventoryEntry = (item) => {
    if(item == null) return null;
    if(typeof item === "string") return { id:item, name:item, qty:1, icon:"📦" };
    if(typeof item === "number") return { id:null, name:"Oggetto", qty:item, icon:"📦" };
    const db = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
    const dbItem = db[item.id] || Object.values(db).find(x => String(x?.id) === String(item.id));
    const cleanName = value => String(value || "Oggetto").replace(/_/g, " ");
    return {
      id:item.id || null,
      name:cleanName(item.nome || item.name || dbItem?.nome || item.id),
      qty:Number(item.qty ?? item.quantity ?? item.quantita ?? 1) || 1,
      icon:item.icon || item.emoji || "📦",
      image:item.immagine || dbItem?.immagine || "",
      tipo:item.tipo || dbItem?.tipo || "",
      description:item.descrizione || item.description || item.effetto || item.effect || dbItem?.descrizione || dbItem?.description || dbItem?.effetto || dbItem?.effect || "Nessuna descrizione disponibile."
    };
  };

  const formatEggEntry = (egg) => {
    if(egg == null) return null;
    if(typeof egg === "string") return { name:egg, qty:1, icon:"🥚" };
    return {
      name:egg.nome || egg.name || egg.id || "Uovo",
      qty:Number(egg.qty ?? egg.quantity ?? egg.quantita ?? 1) || 1,
      icon:egg.icon || egg.emoji || "🥚"
    };
  };

  const refreshTeamViewer = () => {
    const box = $("teamViewer");
    const count = $("teamCount");
    const name = $("teamViewerName");
    const lv = $("teamViewerLevel");
    const img = $("teamViewerSprite");
    const prev = $("teamPrevBtn");
    const nextBtn = $("teamNextBtn");
    if(!box || !count || !name || !lv || !img) return;

    const team = getReserveTeam();
    if(!team.length){
      teamPreviewIndex = 0;
      count.textContent = "0/3";
      name.textContent = "Nessun Pokémon";
      lv.textContent = "";
      img.style.display = "none";
      if(prev) prev.disabled = true;
      if(nextBtn) nextBtn.disabled = true;
      return;
    }

    teamPreviewIndex = Math.max(0, Math.min(teamPreviewIndex, team.length - 1));
    const p = team[teamPreviewIndex];
    count.textContent = `${teamPreviewIndex + 1}/${team.length}`;
    name.textContent = p.nome || "Pokémon";
    lv.textContent = `LV ${PokeMisteryRL_LevelSystem.getLevel(p)}`;
    img.src = sprite(p.immagine);
    img.alt = p.nome || "Pokémon";
    img.style.display = "block";
    /*
     * I pulsanti devono essere gestiti direttamente qui, dopo ogni
     * refresh del Bottom. In questo modo un re-render non lascia
     * i vecchi handler o uno stato disabled errato.
     */
    const canRotate = team.length > 1;

    if(prev){
      prev.disabled = !canRotate;
      prev.style.pointerEvents = canRotate ? "auto" : "none";
      prev.onclick = canRotate
        ? function(e){
            e.preventDefault();
            e.stopPropagation();
            changeTeamPreview(-1);
          }
        : null;
    }

    if(nextBtn){
      nextBtn.disabled = !canRotate;
      nextBtn.style.pointerEvents = canRotate ? "auto" : "none";
      nextBtn.onclick = canRotate
        ? function(e){
            e.preventDefault();
            e.stopPropagation();
            changeTeamPreview(1);
          }
        : null;
    }
  };

  const changeTeamPreview = (delta) => {
    const team = getReserveTeam();

    if(!team.length){
      teamPreviewIndex = 0;
      refreshTeamViewer();
      return;
    }

    const step = Number(delta) || 0;

    teamPreviewIndex =
      (teamPreviewIndex + step + team.length) % team.length;

    refreshTeamViewer();
  };

  const showInventory = () => {
    if(isTestCampaign()){
      openTestBackpack();
      return;
    }
    inventoryPage = 0;
    const main = $("centerMainPanel");
    const inv = $("centerInventoryPanel");
    const bottom = $("bottomPanel");
    if(main) main.style.display = "none";
    if(inv) inv.style.display = "flex";
    if(bottom) bottom.classList.add("inventory-open");
    $("bottomContainer")?.classList.add("inventory-open");
    refreshInventoryPanel();
  };

  const hideInventory = () => {
    const main = $("centerMainPanel");
    const inv = $("centerInventoryPanel");
    const bottom = $("bottomPanel");
    if(inv) inv.style.display = "none";
    if(main) main.style.display = "flex";
    if(bottom) bottom.classList.remove("inventory-open");
    $("bottomContainer")?.classList.remove("inventory-open");
  };

  const toggleInventory = () => {
    if(isTest2Mode()){
      if($("map")?.classList.contains("test2-backpack-map")) closeTest2Backpack();
      else if(canOpenTest2Backpack()) openTestBackpack();
      else msg("Lo zaino è disponibile solo dopo la conclusione del nodo.");
      return false;
    }
    const inv = $("centerInventoryPanel");
    if(inv && inv.style.display !== "none" && inv.style.display !== "") hideInventory();
    else showInventory();
  };

  const refreshInventoryPanel = () => {
    const itemsEl = $("inventoryItems");
    if(!itemsEl) return;

    const items = getRunInventory()
      .map(formatInventoryEntry)
      .filter(item => item && Number(item.qty ?? 1) > 0);

    const perPage = 8;
    const pages = Math.max(1, Math.ceil(items.length / perPage));
    inventoryPage = Math.max(0, Math.min(inventoryPage, pages - 1));
    const visible = items.slice(inventoryPage * perPage, inventoryPage * perPage + perPage);
    itemsEl.innerHTML = items.length
      ? visible.map(x => `<button type="button" class="inventory-entry" onclick="openQuickItemDetail('${String(x.id).replace(/'/g,"\\'")}')">${x.image ? `<img class="inventory-image" src="${x.image}" alt="">` : `<span class="inventory-icon">${x.icon}</span>`}<span class="inventory-name">${x.name}</span><b>x${x.qty}</b></button>`).join("")
      : `<div class="inventory-empty">Inventario vuoto</div>`;
    const pager = $("inventoryPager");
    if(pager) pager.innerHTML = items.length > perPage ? `<button class="inventory-page-prev" aria-label="Pagina precedente" onclick="PokeMisteryRL.UI.changeInventoryPage(-1)" ${inventoryPage === 0 ? "disabled" : ""}>◀</button><button class="inventory-page-next" aria-label="Pagina successiva" onclick="PokeMisteryRL.UI.changeInventoryPage(1)" ${inventoryPage >= pages - 1 ? "disabled" : ""}>▶</button>` : "";

  };
  const changeInventoryPage = delta => { inventoryPage += Number(delta) || 0; refreshInventoryPanel(); };

  // Zaino Test: oggetti e formazione convivono nella stessa HUD e supportano il drag & drop.
  const testBackpackRoster = () => [PKM_RUN?.activePokemon, PKM_RUN?.secondActive, ...(PKM_RUN?.teamSlots || [])].filter(Boolean).slice(0,4);
  const hasTest2SelectableNode = () => !!PKM_RUN?.map?.some(row => row?.some(node => node?.ok === true && !node?.done));
  const isTest2SafeIntermission = () => {
    // `busy` è un timer di animazione e può restare valorizzato dopo un
    // render. Non deve mai contraddire un pulsante già abilitato.
    if(!isTest2Mode() || PKM_RUN?.battle || PKM_RUN?.test2BackpackAvailable !== true) return false;
    // L'unica pausa sicura è la mappa che mostra davvero almeno un nodo
    // scegliibile. Gli eventi azzerano sempre questi flag prima di aprirsi.
    if(!hasTest2SelectableNode()) return false;
    // Protegge anche i frame di transizione in cui il fight è già presente
    // nel DOM ma PKM_RUN.battle è appena stato resettato.
    return !document.querySelector("#bottomContainer .test2-fight-bottom, #bottomContainer #battleFinal, #bottomContainer .bf-field");
  };
  const canOpenTest2Backpack = () => {
    const map = $("map");
    const policy = window.PokeMisteryRL?.BackpackPolicy;
    if(!isTest2SafeIntermission()) return false;
    if(policy?.canOpen) return policy.canOpen(PKM_RUN, map);
    return !!map?.classList.contains("test2-horizontal-map");
  };
  const isUsableItem = item => ["cura","crescita","bonus","uovo"].includes(String(item?.tipo || "").toLowerCase()) && !["avanzi","amuleto"].includes(String(item?.id || ""));
  const isEquipableItem = item => !!item && !isUsableItem(item);
  const itemEffectLabel = (item, pokemon = null, skill = null) => {
    if(!item) return "Nessun effetto";
    const resolved = resolveGameItem(item);
    const effects = pokemon ? getPokemonItemEffects(pokemon, skill) : null;
    if(resolved?.tipo === "potenziamento_tipo") return `PWR ${String(resolved.tipo_mossa || "").toUpperCase()} +${Math.round((Number(resolved.bonus_danno) || 0) * 100)}%`;
    if(resolved?.id === "assorbisfera") return "PWR mosse +30% · rinculo 10% HP";
    if(resolved?.id === "evolcondensa") return effects?.evioliteActive ? "DIF e DIF. SP +50%" : "DIF e DIF. SP +50% se può evolversi";
    if(resolved?.id === "vulneropolizza") return effects?.weaknessActive > 1 ? "ATK e ATT. SP ×2 attivi" : "Dopo superefficace: ATK e ATT. SP ×2";
    if(resolved?.id === "avanzi") return "A fine turno: cura 1/16 HP";
    if(resolved?.id === "bitorzolello") return "Chi colpisce subisce 1/6 HP";
    if(resolved?.id === "palla_fumo") return "Fuga garantita dagli incontri";
    if(resolved?.id === "amuleto") return "Denaro vinto ×2";
    return resolved?.effetto || "Effetto attivo";
  };
  const itemUsageHint = item => isUsableItem(item) ? "Scegli un membro su cui usarlo" : "Trascina sul Pokémon o scegli il membro";
  let backpackItemHoldTimer = null;
  const cancelBackpackItemHold = () => {
    if(backpackItemHoldTimer) clearTimeout(backpackItemHoldTimer);
    backpackItemHoldTimer = null;
  };
  const showBackpackItemInfo = itemId => {
    const item = getRunInventory().map(formatInventoryEntry).find(entry => String(entry?.id) === String(itemId));
    if(!item) return false;
    const category = isEquipableItem(item) ? "OGGETTO EQUIPAGGIABILE" : "OGGETTO USABILE";
    modal(`<div class="center backpack-item-description"><div class="backpack-item-description-icon">${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<i>${item.icon}</i>`}</div><span>${category}</span><h2>${item.name}</h2><p>${item.description}</p><small>Disponibili: ×${item.qty}</small><button type="button" onclick="PokeMisteryRL.UI.openTestBackpack()">← TORNA ALLO ZAINO</button></div>`);
    return true;
  };
  const startBackpackItemHold = (event, itemId) => {
    if(event?.button != null && event.button !== 0) return;
    cancelBackpackItemHold();
    backpackItemHoldTimer = setTimeout(() => { backpackItemHoldTimer = null; showBackpackItemInfo(itemId); }, 520);
  };
  const equipItemToTestPokemon = (itemId, rosterIndex) => {
    if(isTest2Mode() && !isTest2BackpackSession()) return false;
    const holder = testBackpackRoster()[Number(rosterIndex)];
    const db = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
    const item = db[itemId] || Object.values(db).find(entry => String(entry?.id) === String(itemId));
    const inventory = Array.isArray(PKM_RUN?.items) && PKM_RUN.items.length ? PKM_RUN.items : (PKM_RUN?.inventory || []);
    const entry = inventory.find(value => String(value?.id || value) === String(itemId) && Number(value?.qty ?? 1) > 0);
    if(!holder || !item || !entry || !isEquipableItem(item)){ msg("Questo oggetto va usato, non equipaggiato."); return false; }
    // Nessun limite per tipo o per copie: ogni copia posseduta può essere equipaggiata.
    holder.heldItems = [...getHeldItemsForPokemon(holder), { id:item.id, nome:item.nome, immagine:item.immagine || "", icon:item.icon || "◈" }];
    entry.qty = Math.max(0, Number(entry.qty ?? 1) - 1);
    if(Number(entry.qty) <= 0) inventory.splice(inventory.indexOf(entry), 1);
    refreshBottomPanel();
    openTestBackpack();
    return true;
  };
  const isTest2BackpackSession = () => {
    const map = $("map");
    return !!(isTest2Mode() && PKM_RUN?.test2BackpackOpen && map?.classList.contains("test2-backpack-map"));
  };
  const renderTest2BackpackMap = (openedFromMap = false) => {
    const map = $("map");
    if(!map || !isTest2Mode()) return false;
    if(!openedFromMap && !isTest2BackpackSession() && !canOpenTest2Backpack()){ msg("Apri lo Zaino dalla mappa."); return false; }
    const items = getRunInventory().map(formatInventoryEntry).filter(item => item && Number(item.qty) > 0);
    const tab = PKM_RUN.test2BackpackTab === "usable" ? "usable" : "equipment";
    const pocket = tab === "equipment" ? items.filter(isEquipableItem) : items.filter(item => isUsableItem(item) && !isEquipableItem(item));
    map.className = "test2-backpack-map";
    map.dataset.test2BackpackOpen = "1";
    PKM_RUN.test2BackpackOpen = true;
    map.innerHTML = `<section class="test2-backpack-panel" aria-label="Zaino"><header class="test2-bag-header"><div class="test2-bag-title"><span>🎒 ZAINO</span><small>${tab === "equipment" ? "EQUIPAGGIAMENTI" : "OGGETTI USABILI"}</small></div><button type="button" class="test2-backpack-close" onclick="PokeMisteryRL.UI.closeTest2Backpack()" aria-label="Chiudi zaino">✕</button></header><nav class="test2-backpack-tabs" aria-label="Tasche"><button type="button" class="${tab === "equipment" ? "active" : ""}" onclick="PokeMisteryRL.UI.setTest2BackpackTab('equipment')">EQUIP</button><button type="button" class="${tab === "usable" ? "active" : ""}" onclick="PokeMisteryRL.UI.setTest2BackpackTab('usable')">USABILI</button></nav><div class="test2-backpack-grid">${pocket.length ? pocket.map(item => { const key = String(item.id).replace(/'/g,"\\'"); return `<button type="button" class="test2-backpack-tile ${tab}" draggable="true" ondragstart="PokeMisteryRL.UI.dragBackpackItem(event,'${key}')" onpointerdown="PokeMisteryRL.UI.startSceneBackpackTouch(event,'${key}')" onpointermove="PokeMisteryRL.UI.moveSceneBackpackTouch(event)" onpointerup="PokeMisteryRL.UI.endSceneBackpackTouch(event)" onpointercancel="PokeMisteryRL.UI.endSceneBackpackTouch(event)" onclick="PokeMisteryRL.UI.openTest2BackpackItemInfo('${key}')"><span class="test2-backpack-item-icon">${item.image ? `<img src="${item.image}" alt="">` : `<i>${item.icon}</i>`}</span><span class="test2-backpack-item-copy"><b>${item.name}</b><small>${itemEffectLabel(item)}</small></span><em>×${item.qty}</em></button>`; }).join("") : `<p class="test2-backpack-empty">Nessun oggetto in questa tasca.</p>`}</div></section>`;
    return true;
  };
  const setTest2BackpackTab = tab => {
    if(!isTest2Mode()) return;
    PKM_RUN.test2BackpackTab = tab === "usable" ? "usable" : "equipment";
    renderTest2BackpackMap();
  };
  const closeTest2Backpack = () => {
    if(!isTest2Mode()) return;
    delete PKM_RUN.test2BackpackTab;
    delete PKM_RUN.test2BackpackOpen;
    render();
  };
  const applyTest2BackpackItem = (itemId, index) => {
    if(isTest2Mode() && !isTest2BackpackSession()) return false;
    const item = getRunInventory().map(formatInventoryEntry).find(entry => String(entry?.id) === String(itemId));
    if(!item) return false;
    const success = isUsableItem(item)
      ? window.useTestBackpackItem?.(itemId, index)
      : equipItemToTestPokemon(itemId, index);
    if(success && isTest2Mode()){
      closeModal();
      // La scheda mostra subito i valori effettivi dopo qualunque oggetto.
      openTestBottomPokemon(index);
    }
    return success;
  };
  const openTest2BackpackItemInfo = itemId => {
    if(!isTest2Mode()) return showBackpackItemInfo(itemId);
    if(!isTest2BackpackSession() && !canOpenTest2Backpack()) return false;
    const item = getRunInventory().map(formatInventoryEntry).find(entry => String(entry?.id) === String(itemId));
    const team = testBackpackRoster().slice(0,3);
    if(!item || !team.length) return false;
    const map = $("map");
    if(!map) return false;
    const action = isUsableItem(item) ? "USA SU" : "EQUIPAGGIA A";
    const key = String(item.id).replace(/'/g,"\\'");
    const targetCards = team.map((pokemon,index) => {
      const skill = PokeMisteryRL_SkillSystem?.getActiveSkill?.(pokemon) || pokemon.skills?.[0] || null;
      const before = getEffectivePokemonStats(pokemon, skill);
      const projected = isUsableItem(item)
        ? before
        : getEffectivePokemonStats({...pokemon, heldItems:[...getHeldItemsForPokemon(pokemon), {id:item.id}]}, skill);
      const basePower = Math.round(Number(skill?.pwr ?? skill?.power) || 0);
      const beforePower = Math.round(basePower * before.effects.movePowerMultiplier);
      const projectedPower = Math.round(basePower * projected.effects.movePowerMultiplier);
      const changes = [["ATK",before.atk,projected.atk],["SPA",before.satk,projected.satk],["DIF",before.dif,projected.dif],["SDF",before.sdef,projected.sdef]].filter(([,value,next]) => value !== next);
      const impact = isUsableItem(item)
        ? itemEffectLabel(item, pokemon, skill)
        : projectedPower !== beforePower
          ? `PWR ${beforePower} → ${projectedPower}`
          : changes.length
            ? changes.map(([label,value,next]) => `${label} ${value}→${next}`).join(" · ")
            : item?.tipo === "potenziamento_tipo"
              ? `Nessun bonus: mossa ${String(skill?.type || skill?.tipo || "").toUpperCase() || "attiva"}`
              : itemEffectLabel(item, pokemon, skill);
      return `<button type="button" class="test2-item-target-choice" data-backpack-target="${index}" title="${impact}" ondragover="PokeMisteryRL.UI.highlightTest2BackpackTarget(event)" ondragenter="PokeMisteryRL.UI.highlightTest2BackpackTarget(event)" ondragleave="PokeMisteryRL.UI.clearTest2BackpackTarget(event)" ondrop="PokeMisteryRL.UI.dropBackpackItemToScene(event,${index})" onclick="PokeMisteryRL.UI.applyTest2BackpackItem('${key}',${index})"><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"><b>${pokemon.nome}</b><small>LIV ${pokemon.level || 1}</small></button>`;
    }).join("");
    map.className = "test2-backpack-map test2-backpack-info-map";
    map.innerHTML = `<section class="test2-item-info-v2"><header><button type="button" class="test2-backpack-back" onclick="PokeMisteryRL.UI.openTestBackpack()">← ZAINO</button><span>${isUsableItem(item) ? "USABILE" : "EQUIPAGGIABILE"}</span></header><section class="test2-item-v2-summary"><div class="test2-item-v2-icon" draggable="true" ondragstart="PokeMisteryRL.UI.dragBackpackItem(event,'${key}')" onpointerdown="PokeMisteryRL.UI.startTest2BackpackTouch(event,'${key}')" onpointermove="PokeMisteryRL.UI.moveTest2BackpackTouch(event)" onpointerup="PokeMisteryRL.UI.endTest2BackpackTouch(event)" onpointercancel="PokeMisteryRL.UI.endTest2BackpackTouch(event)">${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<i>${item.icon}</i>`}</div><div><small>×${item.qty} DISPONIBILI</small><h2>${item.name}</h2><p>${item.description || itemUsageHint(item)}</p><b>${itemEffectLabel(item)}</b></div></section><section class="test2-item-v2-targets" aria-label="${action}"><header><b>${action}</b><small>scegli un Pokémon</small></header><div>${targetCards}</div></section></section>`;
    return true;
  };
  const openTestBackpack = () => {
    if(isTest2Mode()){
      if(!isTest2BackpackSession() && !canOpenTest2Backpack()) return false;
      // Segna l'apertura prima del render: la schermata non deve dipendere
      // da un secondo controllo di stato tra click e costruzione del pannello.
      PKM_RUN.test2BackpackOpen = true;
      return renderTest2BackpackMap();
    }
    const items = getRunInventory().map(formatInventoryEntry).filter(item => item && Number(item.qty) > 0);
    const team = testBackpackRoster();
    const equipable = items.filter(isEquipableItem);
    const usable = items.filter(item => isUsableItem(item) && !isEquipableItem(item));
    const renderPocket = (title, pocket, className) => `<section class="test-backpack-pocket ${className}"><h3>${title}</h3><div class="test-backpack-items">${pocket.length ? pocket.map(item => { const key = String(item.id).replace(/'/g,"\\'"); return `<div class="test-backpack-item" ${isEquipableItem(item) ? `draggable="true" ondragstart="PokeMisteryRL.UI.dragBackpackItem(event,'${key}')"` : ""} onpointerdown="PokeMisteryRL.UI.startBackpackItemHold(event,'${key}')" onpointerup="PokeMisteryRL.UI.cancelBackpackItemHold()" onpointerleave="PokeMisteryRL.UI.cancelBackpackItemHold()" onpointercancel="PokeMisteryRL.UI.cancelBackpackItemHold()">${item.image ? `<img src="${item.image}" alt="">` : `<i>${item.icon}</i>`}<b>${item.name}</b><em>×${item.qty}</em></div>`; }).join("") : `<small class="test-backpack-empty">Nessun oggetto</small>`}</div></section>`;
    modal(`<div class="center test-backpack-modal"><header><span>🎒 ZAINO</span><small>TIENI PREMUTO UN OGGETTO PER LA DESCRIZIONE</small></header><div class="test-backpack-content"><div class="test-backpack-pockets">${renderPocket("EQUIPAGGIABILI",equipable,"equipment")}${renderPocket("USABILI",usable,"usable")}</div><section class="test-backpack-team">${team.map((pokemon,index) => `<button type="button" class="test-backpack-target" onclick="PokeMisteryRL.UI.openTestBottomPokemon(${index})" ondragover="PokeMisteryRL.UI.allowBackpackDrop(event)" ondrop="PokeMisteryRL.UI.dropBackpackItem(event,${index})"><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"><b>${pokemon.nome}</b><small>${getHeldItemsForPokemon(pokemon).length ? getHeldItemsForPokemon(pokemon).map(entry => entry.nome || entry.id).join(" · ") : "Apri tab"}</small></button>`).join("")}</section></div><button type="button" onclick="closeModal()">CHIUDI</button></div>`);
  };
  const openTestBackpackFromMap = () => {
    const map = $("map");
    if(!isTest2Mode() || !map?.classList.contains("test2-horizontal-map")) return false;
    PKM_RUN.test2BackpackOpen = true;
    return renderTest2BackpackMap(true);
  };
  const toggleTest2FormationFromMap = () => {
    const map = $("map");
    if(!isTest2Mode() || !map?.classList.contains("test2-horizontal-map")) return false;
    PKM_RUN.test2FormationEditing = true;
    return renderTest2FormationMap();
  };
  const dragBackpackItem = (event, itemId) => {
    event.dataTransfer?.setData("text/plain", itemId);
    event.dataTransfer?.setData("application/x-pokemistery-item", itemId);
    if(event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
  };
  const allowBackpackDrop = event => event.preventDefault();
  const dropBackpackItem = (event, index) => { event.preventDefault(); return equipItemToTestPokemon(event.dataTransfer.getData("text/plain"), index); };
  const dropBackpackItemToScene = (event, index) => {
    event.preventDefault();
    clearSceneBackpackTargets?.();
    const itemId = event.dataTransfer?.getData("application/x-pokemistery-item");
    if(!itemId) return dropTestBottomPokemon(event, index);
    const item = getRunInventory().map(formatInventoryEntry).find(entry => String(entry?.id) === String(itemId));
    if(!item) return false;
    return applyTest2BackpackItem(itemId, index);
  };
  let test2BackpackTouchItem = null;
  let test2BackpackTouchMoved = false;
  let test2BackpackTouchPointerId = null;
  const targetAtTest2BackpackPoint = (x, y) => document.elementFromPoint(x, y)?.closest?.("[data-backpack-target]") || null;
  const clearTest2BackpackTargets = () => document.querySelectorAll("[data-backpack-target].test2-backpack-drop-target").forEach(target => target.classList.remove("test2-backpack-drop-target"));
  const updateTest2BackpackTarget = (x, y) => {
    const target = targetAtTest2BackpackPoint(x, y);
    clearTest2BackpackTargets();
    target?.classList.add("test2-backpack-drop-target");
    return target;
  };
  const highlightTest2BackpackTarget = event => {
    event.preventDefault();
    clearTest2BackpackTargets();
    event.currentTarget?.classList.add("test2-backpack-drop-target");
  };
  const clearTest2BackpackTarget = event => event.currentTarget?.classList.remove("test2-backpack-drop-target");
  const startTest2BackpackTouch = (event, itemId) => {
    if(event.pointerType === "mouse") return;
    test2BackpackTouchItem = itemId;
    test2BackpackTouchMoved = false;
    test2BackpackTouchPointerId = event.pointerId;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  };
  const moveTest2BackpackTouch = event => {
    if(!test2BackpackTouchItem) return;
    test2BackpackTouchMoved = true;
    event.preventDefault();
    updateTest2BackpackTarget(event.clientX, event.clientY);
  };
  const endTest2BackpackTouch = event => {
    if(!test2BackpackTouchItem) return false;
    const itemId = test2BackpackTouchItem;
    const target = updateTest2BackpackTarget(event.clientX, event.clientY);
    test2BackpackTouchItem = null;
    test2BackpackTouchPointerId = null;
    clearTest2BackpackTargets();
    if(test2BackpackTouchMoved && target){
      event.preventDefault();
      return applyTest2BackpackItem(itemId, Number(target.dataset.backpackTarget));
    }
    return false;
  };
  let sceneBackpackTouchItem = null;
  let sceneBackpackTouchPointerId = null;
  let sceneBackpackTouchMoved = false;
  const clearSceneBackpackTargets = () => document.querySelectorAll("[data-scene-item-target].scene-item-drop-target").forEach(target => target.classList.remove("scene-item-drop-target"));
  const sceneBackpackTargetAt = (x, y) => (document.elementsFromPoint?.(x, y) || [document.elementFromPoint(x, y)]).map(node => node?.closest?.("[data-scene-item-target]")).find(Boolean) || null;
  const updateSceneBackpackTarget = (x, y) => {
    const target = sceneBackpackTargetAt(x, y);
    clearSceneBackpackTargets();
    target?.classList.add("scene-item-drop-target");
    return target;
  };
  const highlightSceneBackpackTarget = event => {
    event.preventDefault();
    clearSceneBackpackTargets();
    event.currentTarget?.classList.add("scene-item-drop-target");
  };
  const clearSceneBackpackTarget = event => event.currentTarget?.classList.remove("scene-item-drop-target");
  const startSceneBackpackTouch = (event, itemId) => {
    if(event.pointerType === "mouse") return;
    sceneBackpackTouchItem = itemId;
    sceneBackpackTouchPointerId = event.pointerId;
    sceneBackpackTouchMoved = { x:event.clientX, y:event.clientY, dragging:false };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  };
  const moveSceneBackpackTouch = event => {
    if(!sceneBackpackTouchItem) return;
    const start = sceneBackpackTouchMoved;
    if(!start?.dragging && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) return;
    if(start) start.dragging = true;
    event.preventDefault();
    updateSceneBackpackTarget(event.clientX, event.clientY);
  };
  const finishSceneBackpackTouch = event => {
    if(!sceneBackpackTouchItem) return false;
    const itemId = sceneBackpackTouchItem;
    const target = updateSceneBackpackTarget(event.clientX, event.clientY);
    const dragged = !!sceneBackpackTouchMoved?.dragging;
    sceneBackpackTouchItem = null;
    sceneBackpackTouchPointerId = null;
    sceneBackpackTouchMoved = false;
    clearSceneBackpackTargets();
    if(dragged && target){
      event.preventDefault();
      return applyTest2BackpackItem(itemId, Number(target.dataset.sceneItemTarget));
    }
    return false;
  };
  const endSceneBackpackTouch = event => finishSceneBackpackTouch(event);
  document.addEventListener("pointermove", event => {
    if(test2BackpackTouchItem && event.pointerId === test2BackpackTouchPointerId) updateTest2BackpackTarget(event.clientX, event.clientY);
    if(sceneBackpackTouchItem && event.pointerId === sceneBackpackTouchPointerId) moveSceneBackpackTouch(event);
  }, { passive:false });
  document.addEventListener("pointerup", event => {
    if(sceneBackpackTouchItem && event.pointerId === sceneBackpackTouchPointerId) finishSceneBackpackTouch(event);
  }, { passive:false });
  document.addEventListener("pointercancel", event => {
    if(sceneBackpackTouchItem && event.pointerId === sceneBackpackTouchPointerId){
      sceneBackpackTouchItem = null;
      sceneBackpackTouchPointerId = null;
      sceneBackpackTouchMoved = false;
      clearSceneBackpackTargets();
    }
  }, { passive:true });

  const buildTestBottomTemplate = () => `
    <div id="campaignTestBottom" class="campaign-test-bottom">
      <div id="campaignTestParty" class="campaign-test-party"></div>
      <div class="campaign-test-bottom-foot"><span>💰 <b id="campaignTestBits">0</b></span></div>
    </div>
  `;

  // Test2 has its own isolated Campaign bottom: no legacy HUD is reused here.
  const getTest2SceneForNode = node => {
    if(node?.type === "skill") return "dojo";
    if(node?.type === "shop") return "bazar";
    if(node?.type === "rifugio") return "campeggio";
    return "tunnel";
  };
  const getTest2BottomScene = () => PKM_RUN?.test2Scene || getTest2SceneForNode(PKM_RUN?.map?.[PKM_RUN?.row]?.[PKM_RUN?.col]);
  const fallbackTest2SceneBuildings = {
    dojo: { asset:"./img/scenes/forest-dojo.png", label:"Dojo", x:92, y:43, size:70, flip:false },
    bazar: { asset:"./img/scenes/forest-stall.png", label:"Bancarella", x:84, y:48, size:40, flip:false },
    campeggio: { asset:"./img/scenes/forest-refuge.png", label:"Rifugio", x:86, y:42, size:52, flip:false }
  };
  const test2SceneBuildings = PokeMisteryRL.SceneLayout?.buildings || fallbackTest2SceneBuildings;
  const getTest2SceneBuilding = scene => {
    const base = test2SceneBuildings[scene];
    if(!base) return null;
    if(PKM_RUN?.test2SceneBuildingHidden?.[scene]) return null;
    PKM_RUN.test2SceneBuildingLayout ||= {};
    const saved = PKM_RUN.test2SceneBuildingLayout[scene] || {};
    // Migrazione della prima prova: 101% nascondeva quasi tutto il PNG
    // trasparente. Questa è la posizione approvata, ampia ma leggibile.
    if(scene === "dojo" && saved.version !== 2){
      PKM_RUN.test2SceneBuildingLayout[scene] = {x:92, y:43, size:70, flip:false, version:2};
    }
    if(scene === "bazar" && saved.version !== 2){
      PKM_RUN.test2SceneBuildingLayout[scene] = {x:84, y:48, size:40, flip:true, version:2};
    }
    if(scene === "campeggio" && saved.version !== 2){
      PKM_RUN.test2SceneBuildingLayout[scene] = {x:86, y:42, size:52, flip:true, version:2};
    }
    return {...base, ...(PKM_RUN.test2SceneBuildingLayout[scene] || {})};
  };
  const renderTest2SceneBuilding = () => {
    const bottom = $("bottomCampagna");
    if(!bottom || bottom.classList.contains("test2-fight-bottom")) return false;
    const scene = getTest2BottomScene();
    const building = getTest2SceneBuilding(scene);
    bottom.querySelector(".test2-scene-building")?.remove();
    if(!building) return false;
    const editing = !!PKM_RUN?.test2SceneBuildingEditing;
    const element = document.createElement("div");
    element.className = `test2-scene-building ${editing ? "is-editing" : ""}`;
    element.dataset.sceneBuilding = scene;
    element.style.setProperty("--building-x", `${Number(building.x)}%`);
    element.style.setProperty("--building-y", `${Number(building.y)}%`);
    element.style.setProperty("--building-size", `${Number(building.size)}%`);
    element.innerHTML = `<img src="${building.asset}" alt="${building.label}">${editing ? `<span class="test2-building-label">${building.label}</span><button type="button" class="test2-building-drag" onpointerdown="PokeMisteryRL.UI.startTest2SceneBuildingEdit(event,'move')" aria-label="Sposta ${building.label}">✥</button><button type="button" class="test2-building-resize" onpointerdown="PokeMisteryRL.UI.startTest2SceneBuildingEdit(event,'resize')" aria-label="Ridimensiona ${building.label}">↘</button><button type="button" class="test2-building-flip" onclick="PokeMisteryRL.UI.flipTest2SceneBuilding()" aria-label="Specchia ${building.label}">⇄</button>` : ""}`;
    element.querySelector("img").style.transform = building.flip ? "scaleX(-1)" : "none";
    bottom.insertBefore(element, bottom.querySelector(".bottom-campagna-formation") || bottom.firstChild);
    if(PKM_RUN?.test2SceneBuildingEditing) decorateTest2ScenePngs();
    return true;
  };

  const bottomTypeBadges = (pokemon) => {
    const types = getPokemonTypes(pokemon).length
      ? getPokemonTypes(pokemon)
      : getPokemonTypes(PKM_DB?.[pokemon?.id]);
    return types.map(getTypingBadge)
    .join("");
  };

  const canEditTest2Formation = () => {
    return isTest2SafeIntermission();
  };
  const buildTest2UtilityBar = () => `
    <nav class="test2-utility-bar ${PKM_RUN?.test2UtilityExpanded ? "expanded" : ""}" aria-label="Comandi run">
      <span class="test2-utility-money" title="Soldi">💰 <b id="test2BitsReadout">${Number(PKM_RUN?.bits) || 0}</b></span>
      <button type="button" class="test2-utility-toggle" onclick="PokeMisteryRL.UI.toggleTest2UtilityBar()" aria-label="${PKM_RUN?.test2UtilityExpanded ? "Richiudi comandi" : "Apri comandi"}" aria-expanded="${PKM_RUN?.test2UtilityExpanded ? "true" : "false"}" title="${PKM_RUN?.test2UtilityExpanded ? "Richiudi" : "Altri comandi"}">${PKM_RUN?.test2UtilityExpanded ? "×" : "+"}</button>
      <div class="test2-utility-actions">
        <button type="button" onclick="openHomeMenu()" aria-label="Menu" title="Menu">☰</button>
        <button type="button" class="test2-reset" onclick="quickReset()" aria-label="Ricomincia" title="Ricomincia">↻</button>
        <button type="button" onclick="PokeMisteryRL.UI.toggleTest2SceneBuildingEditor()" aria-label="Modifica PNG scena" title="Sposta PNG nella scena">🏗</button>
      </div>
    </nav>
  `;

  const buildTest2FormationTemplate = () => {
    const scene = getTest2BottomScene();
    const starter = PKM_RUN?.pendingStarter || PKM_RUN?.teamSlots?.[0] || PKM_RUN?.activePokemon;
    return `
    <div id="bottomCampagna" class="bottom-campagna" data-scene="${scene}" aria-label="Starter">
      <span class="bottom-campagna-title">STARTER</span>
      <nav class="test2-formation-order test2-starter-order" aria-label="Starter scelto"><small>STARTER</small>${starter ? `<button type="button" class="formation-slot-s1" onclick="PokeMisteryRL.UI.openTestBottomPokemon(2)" title="${starter.nome} · LV ${starter.level || 1}"><img src="${sprite(starter.immagine)}" alt="${starter.nome}"><span>${starter.nome}</span><em>LV ${starter.level || 1}</em></button>` : ""}</nav>
      <div id="test2FormationLine" class="bottom-campagna-formation"></div>
      ${buildTest2UtilityBar()}
    </div>
  `;
  };

  const buildBottomPanelTemplate = () => `

  <div id="bottomPanel" class="bottom-v8">

    <div class="b8-left">
      <div id="starter1Box" class="b8-pokemon-slot" onclick="openStarterPreview()">
        <img id="sideSprite" src="" alt="Starter 1">
        <small id="s1HeldItem" class="held-item-badge" aria-label="Oggetto tenuto"></small>
      </div>

      <div id="starter2Slot" class="b8-pokemon-slot" onclick="openSecondPreview()">
        <span id="starter2Placeholder">+ PARTNER</span>
        <img id="starter2Sprite" src="" alt="Partner" style="display:none">
        <small id="s2HeldItem" class="held-item-badge" aria-label="Oggetto tenuto"></small>
      </div>
    </div>

    <div class="b8-center">
      <div id="centerMainPanel" class="b8-center-main">
      <div class="b8-top">
        <span id="sideName" class="b8-name">-</span>
        <span class="b8-lv">LV <b id="levelVal">1</b></span>
        <div id="sideTyping" class="b8-typing"></div>
      </div>

      <div class="b8-bars">
        <div class="b8-bar-row">
          <span class="b8-icon">❤️</span>
          <div class="b8-bar-bg"><div id="hpFillSide" class="b8-fill hp" style="width:0%"></div></div>
          <span id="hpTextSide" class="b8-value">HP 0/0</span>
        </div>
      </div>

      <div class="b8-stats">
        <span>ATK <b id="atkVal">0</b></span>
        <span>DEF <b id="defVal">0</b></span>
        <span>SPD <b id="spdVal">0</b></span>
      </div>

      <div id="s2HudSection" class="b8-s2-section" style="display:none">
        <div class="b8-s2-header">
          <span id="s2Name" class="b8-s2-name">Partner</span>
          <span id="s2Level" class="b8-s2-level">LV 1</span>
          <div id="s2Typing" class="b8-typing b8-s2-typing"></div>
        </div>
        <div class="b8-bars">
          <div class="b8-bar-row">
            <span class="b8-icon">❤️</span>
            <div class="b8-bar-bg"><div id="s2HpBar" class="b8-fill hp" style="width:0%"></div></div>
            <span id="s2HpTxt" class="b8-value">HP</span>
          </div>
        </div>
        <div class="b8-stats">
          <span>ATK <b id="s2AtkVal">0</b></span>
          <span>DEF <b id="s2DefVal">0</b></span>
          <span>SPD <b id="s2SpdVal">0</b></span>
        </div>
      </div>
      </div>

      <div id="centerInventoryPanel" class="b8-inventory-panel center-inventory-panel" style="display:none">
        <div class="b8-inventory-section">
          <b>OGGETTI</b>
          <div id="inventoryItems" class="inventory-list"></div>
          <div id="inventoryPager" class="inventory-pager"></div>
        </div>

      </div>

      <div
        id="quickItemSlots"
        class="b8-quick-items"
        aria-label="Oggetti rapidi"
      >
        ${Array.from({length:5},(_,i)=>`
          <div
            class="b8-quick-item empty"
            data-quick-item-slot="${i}"
          >
            <span class="quick-item-icon">+</span>
            <small></small>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="b8-right">

      <div id="rightMainPanel" class="b8-right-main">
        <div class="b8-money">
          <span class="b8-money-icon">💰</span>
          <b id="bits">0</b>
        </div>

        <div id="teamViewer" class="b8-team-viewer">
          <div class="b8-team-header">
            <span>SQUADRA</span>
            <b id="teamCount">0/3</b>
          </div>
          <div class="b8-team-image-wrap">
            <button id="teamPrevBtn" class="team-nav" onclick="changeTeamPreview(-1)">◀</button>
            <img id="teamViewerSprite" src="" alt="Squadra" style="display:none">
            <button id="teamNextBtn" class="team-nav" onclick="changeTeamPreview(1)">▶</button>
          </div>
          <div id="teamViewerName" class="b8-team-viewer-name">Nessun Pokémon</div>
          <small id="teamViewerLevel" class="b8-team-viewer-level"></small>
        </div>

      </div>

    </div>
  </div>

  `;

  const refreshBottomPanel = () => {

    if (!PKM_RUN) {
      return;
    }

    // Test2 usa una composizione invertita: arena in alto, mappa subito sotto.
    const shell = document.querySelector(".adventure-shell");
    const mapWrap = document.querySelector(".map-wrap");
    const bottom = $("bottomContainer");
    if(shell && mapWrap && bottom){
      if(isTest2Mode()){
        shell.classList.add("test2-layout");
        if(bottom.nextElementSibling !== mapWrap) shell.insertBefore(bottom, mapWrap);
      } else if(shell.classList.contains("test2-layout")){
        shell.classList.remove("test2-layout");
        if(mapWrap.nextElementSibling !== bottom) shell.appendChild(bottom);
      }
    }


    const p =
      getActivePokemon();


    if (!p) {
      return;
    }

    // Test2 sostituisce del tutto il bottom con una formazione da marcia.
    if(isTest2Mode()){
      // Durante lo scontro il bottom è l'arena: non va rimpiazzato dalla formazione.
      if(PKM_RUN.battle) return;
      if(!$('bottomCampagna') || $('bottomCampagna')?.classList.contains('test2-fight-bottom')){
        $('bottomContainer').innerHTML = buildTest2FormationTemplate();
      }
      const test2Bottom = $('bottomCampagna');
      const test2Scene = getTest2BottomScene();
      if(test2Bottom){
        // Terminato un nodo, l'arena non conserva avversari o elementi della
        // fight precedente: restano soltanto S1/S2 e le riserve nei loro box.
        test2Bottom.classList.remove('test2-fight-bottom');
        // Pulizia completa dopo ogni nodo: non lasciare sprite di nemici,
        // sfidanti o indicatori VS ereditati dalla scena precedente.
        test2Bottom.querySelectorAll('.test2-enemy-formation,.test2-enemy-sprite,.test2-dojo-challenger,.test2-dojo-reward-opponent,.test2-shop-kecleon,.test2-kecleon-bubble,.test2-fight-versus,.test2-shelter-chansey').forEach(entry => entry.remove());
        test2Bottom.dataset.scene = test2Scene;
        const floor = window.PokeMisteryRL_Modes?.getFloor?.(PKM_RUN.mode, PKM_RUN.floor);
        const forest = String(floor?.categoria || "").toLowerCase() === "bosco";
        const scene = forest
          ? "./img/prove-bosco/BoscoSmeraldo-Scenario.png"
          : "./img/prove-bosco/Grotta-Scenario.png";
        const sceneBackground = `linear-gradient(rgba(5,10,21,.08),rgba(1,4,12,.32)),url("${scene}")`;
        $("bottomContainer")?.style.setProperty("background-image", sceneBackground, "important");
        $("bottomContainer")?.style.setProperty("background-size", "cover", "important");
        $("bottomContainer")?.style.setProperty("background-position", "center bottom", "important");
        $("bottomContainer")?.style.setProperty("background-repeat", "no-repeat", "important");
        test2Bottom.style.setProperty("background-image", sceneBackground, "important");
        test2Bottom.style.setProperty("background-size", "cover", "important");
        test2Bottom.style.setProperty("background-position", "center bottom", "important");
        test2Bottom.style.setProperty("background-repeat", "no-repeat", "important");
        // Kecleon compare soltanto durante l'evento negozio, mai come
        // mini-sprite permanente nello scenario.
        test2Bottom.querySelector('.test2-kecleon')?.remove();
        renderTest2SceneBuilding();
      }
      const test2FloorReadout = $('test2FloorReadout');
      const test2BitsReadout = $('test2BitsReadout');
      if(test2FloorReadout) test2FloorReadout.textContent = PKM_RUN.extraPassage ? 'PASSAGGIO' : `PIANO ${PKM_RUN.floor || 1}`;
      if(test2BitsReadout) test2BitsReadout.textContent = Number(PKM_RUN.bits) || 0;
      // I pulsanti possono essere già nel DOM dopo la chiusura di un pannello:
      // sincronizzali a ogni refresh, senza aspettare di ricreare il bottom.
      const formationAvailable = canEditTest2Formation();
      const backpackAvailable = canOpenTest2Backpack();
      const formationButton = test2Bottom?.querySelector('[aria-label="Formazione"]');
      const backpackButton = test2Bottom?.querySelector('[aria-label="Zaino"]');
      if(formationButton){
        formationButton.disabled = !formationAvailable;
        formationButton.title = formationAvailable ? "Modifica formazione" : "La formazione si modifica tra due nodi";
      }
      if(backpackButton){
        backpackButton.disabled = !backpackAvailable;
        backpackButton.title = backpackAvailable ? "Apri zaino" : "Lo zaino è disponibile tra due nodi";
      }
      // I box superiori sono la fonte visiva dell'ordine: dopo ogni scambio
      // ricostruiscili con gli sprite effettivamente assegnati a S1/S2/S3.
      const formationOrder = test2Bottom?.querySelector('.test2-formation-order');
      const formation = $('test2FormationLine');
      // Prima della scelta iniziale la scena deve essere completamente vuota:
      // nessuno sprite o slot della squadra anticipa lo starter disponibile.
      if(!PKM_RUN.starterChosen){
        if(formationOrder) formationOrder.innerHTML = '<small>STARTER</small>';
        if(formation) formation.innerHTML = '';
        return;
      }
      if(formationOrder){
        const starter = PKM_RUN.pendingStarter || PKM_RUN.teamSlots?.[0] || PKM_RUN.activePokemon;
        formationOrder.innerHTML = `<small>STARTER</small>${starter ? `<button type="button" class="formation-slot-s1" onclick="PokeMisteryRL.UI.openTestBottomPokemon(2)" title="${starter.nome} · LV ${starter.level || 1}"><img src="${sprite(starter.immagine)}" alt="${starter.nome}"><span>${starter.nome}</span><em>LV ${starter.level || 1}</em></button>` : ""}`;
      }
      const slots = PKM_RUN.teamSlots || [];
      const roster = PKM_RUN.pendingStarter ? [
        { pokemon:slots[0], slotIndex:2, label:'STARTER' }
      ] : [
        { pokemon:slots[0], slotIndex:2, label:'COMP. 1' },
        { pokemon:slots[1], slotIndex:3, label:'COMP. 2' },
        { pokemon:PKM_RUN.activePokemon, slotIndex:0, label:'STARTER 1' },
        { pokemon:PKM_RUN.secondActive, slotIndex:1, label:'STARTER 2' },
        ...slots.slice(2, 7).map((pokemon, index) => ({ pokemon, slotIndex:index + 4, label:`TEST ${index + 5}` }))
      ];
      if(formation){
        const defaultPositions = {0:3, 1:4, 2:5};
        // Ripristina le coordinate che erano state alterate dalla prova del
        // layout 3+2, senza modificare gli spostamenti successivi dell'utente.
        if(PKM_RUN.test2SceneLayoutVersion === "three-two-v1"){
          PKM_RUN.test2ScenePositions = {...defaultPositions};
          delete PKM_RUN.test2SceneLayoutVersion;
        }
        PKM_RUN.test2ScenePositions ||= {...defaultPositions};
        const positionFor = slotIndex => clamp(Number(PKM_RUN.test2ScenePositions?.[slotIndex] ?? defaultPositions[slotIndex] ?? 4), 0, 8);
        formation.innerHTML = roster.map(({pokemon, slotIndex, label}, index) => {
          if(!pokemon) return '';
          const maxHp = Math.max(1, Number(pokemon.maxHp) || 1);
          const hp = clamp(Number(pokemon.hp) || 0, 0, maxHp);
          const hpPercent = Math.round(hp / maxHp * 100);
          const itemTargetIndex = testBackpackRoster().findIndex(entry => entry === pokemon);
          // Ogni Pokémon nel box scena è una destinazione valida per un oggetto.
          const isSceneMember = itemTargetIndex >= 0;
          return `<button type="button" class="bottom-campagna-member member-${index} test2-position-${positionFor(slotIndex)} ${isSceneMember ? 'starter' : 'ally'} ${hp <= 0 ? 'dead' : ''}" ${isSceneMember ? `data-scene-item-target="${itemTargetIndex}" ondragenter="PokeMisteryRL.UI.highlightSceneBackpackTarget(event)" ondragleave="PokeMisteryRL.UI.clearSceneBackpackTarget(event)"` : ""} onclick="PokeMisteryRL.UI.openTestBottomPokemon(${itemTargetIndex >= 0 ? itemTargetIndex : slotIndex})" title="${pokemon.nome}">
            <img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}">
            <span class="test2-scene-info"><b class="test2-scene-name">${pokemon.nome}</b><em class="test2-scene-level">LV ${pokemon.level || 1}</em><small class="test2-scene-move-level">MOSSA LV ${pokemon.sk || pokemon.skills?.[0]?.skillLevel || 1}</small><span class="bottom-campagna-types test2-scene-types" aria-label="Tipi di ${pokemon.nome}">${bottomTypeBadges(pokemon)}</span><i class="bottom-campagna-hp test2-scene-hp"><b style="width:${hpPercent}%"></b></i></span>
            <span class="sr-only">${label} · ${pokemon.nome} · ${hpPercent}% vita</span>
          </button>`;
        }).join('');
      }
      decorateTest2ScenePngs();
      return;
    }

    // Test/Campagne usa un bottom essenziale: soldi e cinque schede squadra.
    if(isTestCampaign()){
      if(!$("campaignTestBottom")){
        $("bottomContainer").innerHTML = buildTestBottomTemplate();
      }
      const roster = [PKM_RUN.activePokemon, PKM_RUN.secondActive, ...(PKM_RUN.teamSlots || [])].slice(0, 4);
      const money = $("campaignTestBits");
      if(money) money.textContent = PKM_RUN.bits ?? 0;
      const party = $("campaignTestParty");
      if(party){
        party.innerHTML = roster.map((pokemon, index) => {
          if(!pokemon) return `<div class="campaign-test-member empty"><span>SLOT ${index + 1}</span><b>Vuoto</b></div>`;
          const maxHp = Math.max(1, Number(pokemon.maxHp) || 1);
          const hp = clamp(Number(pokemon.hp) || 0, 0, maxHp);
          const hpPercent = Math.round(hp / maxHp * 100);
          return `<div class="campaign-test-member ${hp <= 0 ? "dead" : ""}" draggable="true" onclick="PokeMisteryRL.UI.openTestBottomPokemon(${index})" ondragstart="PokeMisteryRL.UI.dragTestBottomPokemon(event,${index})" ondragover="PokeMisteryRL.UI.allowTestBottomDrop(event)" ondrop="PokeMisteryRL.UI.dropTestBottomPokemon(event,${index})">
            <div class="campaign-test-sprite-box"><b>${pokemon.nome}</b><em>LV ${pokemon.level || 1}</em><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"><div class="campaign-test-hp" title="${hp}/${maxHp} HP"><i style="width:${hpPercent}%"></i></div><small>${hp}/${maxHp} HP</small></div>
            <div class="campaign-test-stats-box"><span class="campaign-test-stat-title">STATISTICHE</span><div class="campaign-test-member-stats"><span>ATK <i>${pokemon.stats?.atk || 0}</i></span><span>DEF <i>${pokemon.stats?.dif || 0}</i></span><span>SPD <i>${pokemon.stats?.spd || 0}</i></span></div></div>
          </div>`;
        }).join("");
      }
      return;
    }

    const sE =
      $("sideSprite");


    if (sE) {

      sE.src =
        sprite(
          p.immagine
        );
    }


    if ($("sideName")) {

      $("sideName").textContent =
        p.nome;
    }


    const level =
      PokeMisteryRL_LevelSystem.getLevel(
        p
      );


    if ($("levelVal")) {

      $("levelVal").textContent =
        level;
    }


    if ($("bits")) {

      $("bits").textContent =
        PKM_RUN.bits ?? 0;
    }

    const s1Items = getHeldItemsForSlot("s1"), s2Items = getHeldItemsForSlot("s2");
    const setHeldBadge = (id, items) => {
      const badge = $(id); if(!badge) return;
      const last = items[items.length - 1];
      const itemDb = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
      const item = last && (itemDb[last.id] || Object.values(itemDb).find(x => String(x?.id) === String(last.id)));
      const image = last?.immagine || item?.immagine || "";
      badge.innerHTML = items.length > 1
        ? `<b>+${items.length}</b>`
        : image ? `<img src="${image}" alt="${item?.nome || last?.nome || "Oggetto"}">`
        : (last?.icon || item?.icon || "◈");
      badge.title = items.map(x => x?.nome || itemDb[x?.id]?.nome || x?.id).join(", ");
    };
    setHeldBadge("s1HeldItem", s1Items);
    setHeldBadge("s2HeldItem", s2Items);


    if ($("atkVal")) {

      $("atkVal").textContent =
        p.stats?.atk ?? 0;
    }


    if ($("defVal")) {

      $("defVal").textContent =
        p.stats?.dif ?? 0;
    }


    if ($("spdVal")) {

      $("spdVal").textContent =
        p.stats?.spd ?? 0;
    }


    const s2 =
      PKM_RUN.secondActive;

    const s2Section =
      $("s2HudSection");

    if (s2Section) {

      if (s2) {

        s2Section.style.display =
          "block";

        if ($("s2Name")) {
          $("s2Name").textContent =
            s2.nome || "Partner";
        }

        if ($("s2Level")) {
          $("s2Level").textContent =
            `LV ${PokeMisteryRL_LevelSystem.getLevel(s2)}`;
        }

        if ($("s2Typing")) {
          $("s2Typing").innerHTML =
            (s2.tipi || [])
              .map(getTypingBadge)
              .join("");
        }

        const s2MaxHp =
          Math.max(
            1,
            Number(s2.maxHp) || 1
          );

        const s2Hp =
          clamp(
            Number(s2.hp) || 0,
            0,
            s2MaxHp
          );

        const s2Percent =
          clamp(
            s2Hp / s2MaxHp * 100,
            0,
            100
          );

        if ($("s2HpBar")) {
          $("s2HpBar").style.width =
            s2Percent + "%";
        }

        if ($("s2HpTxt")) {
          $("s2HpTxt").textContent =
            `${s2Hp}/${s2MaxHp}`;
        }

        if ($("s2AtkVal")) {
          $("s2AtkVal").textContent =
            s2.stats?.atk ?? 0;
        }

        if ($("s2DefVal")) {
          $("s2DefVal").textContent =
            s2.stats?.dif ?? 0;
        }

        if ($("s2SpdVal")) {
          $("s2SpdVal").textContent =
            s2.stats?.spd ?? 0;
        }

      } else {

        s2Section.style.display =
          "none";

      }
    }

    updateHPBar();


    if ($("sideTyping")) {

      $("sideTyping").innerHTML =

        (p.tipi || [])

          .map(
            getTypingBadge
          )

          .join("");
    }


    /*
     * OGGETTI RAPIDI — 5 slot del DB_ITEMS nel CENTER.
     * Mostriamo gli oggetti realmente presenti nella run.
     */

    /*
     * Dettaglio oggetto rapido.
     * Il click apre descrizione + pulsante EQUIPAGGIA.
     */
    if(!window.__quickItemDetailHandlers){

      window.__quickItemDetailHandlers = true;

      window.openQuickItemDetail = (
        itemId
      ) => {

        const db =
          window.PokeMisteryRL_Items?.DB_ITEMS ||
          window.DB_ITEMS ||
          null;

        const item =
          db && typeof db === "object"
            ? (
                db[itemId] ||
                Object.values(db).find(
                  x =>
                    x &&
                    String(x.id) ===
                    String(itemId)
                )
              )
            : null;

        if(!item){
          msg("Oggetto non disponibile.");
          return;
        }

        const name =
          item.nome ||
          item.name ||
          item.id ||
          "Oggetto";

        let description =
          item.descrizione ||
          item.description ||
          item.effetto ||
          item.effect ||
          "Nessuna descrizione disponibile.";

        // I potenziatori di tipo mostrano il badge, non il testo tecnico [FIRE].
        if(item.tipo === "potenziamento_tipo"){
          const multiplier = 1 + (Number(item.bonus_danno) || 0);
          description = `Danno mosse ${getTypingBadge(item.tipo_mossa)} ×${multiplier.toFixed(2)}`;
        }

        const rarity =
          item.rarita ||
          item.rarity ||
          "comune";
        const isConsumable = isUsableItem(item);
        const itemKey = String(item.id).replace(/'/g,"\\'");
        const targetCard = (slot, pokemon) => {
          const unavailable = !pokemon;
          const hp = pokemon ? `${Math.max(0, Number(pokemon.hp) || 0)}/${Math.max(0, Number(pokemon.maxHp) || 0)} HP` : "Non disponibile";
          const action = isConsumable ? "USA ORA" : "EQUIPAGGIA";
          return `<button type="button" class="item-target-card ${unavailable ? "is-unavailable" : ""}" ${unavailable ? "disabled" : ""} onclick="${isConsumable ? "useInventoryItem" : "equipHeldItem"}('${itemKey}','${slot}')">
            <span class="item-target-role">${slot.toUpperCase()}</span>
            <span class="item-target-sprite">${pokemon ? `<img src="${sprite(pokemon.immagine)}" alt="">` : "?"}</span>
            <strong>${pokemon?.nome || "Nessun Pokémon"}</strong>
            <small>LV ${pokemon?.level || "–"} · ${hp}</small>
            <em>${action}</em>
          </button>`;
        };

        modal(`
          <div class="center quick-item-detail item-action-modal">
            <header class="item-action-head">
              <div class="quick-item-detail-icon">${item.immagine ? `<img src="${item.immagine}" alt="${name}">` : (item.icon || "◈")}</div>
              <div><span>${isConsumable ? "USA OGGETTO" : "ASSEGNA OGGETTO"}</span><h2>${name}</h2><small>${rarity}</small></div>
            </header>
            <p class="quick-item-detail-description">${description}</p>
            <div class="item-action-label"><span>1</span>${isConsumable ? "SCEGLI SU CHI USARLO" : "SCEGLI CHI LO DEVE TENERE"}</div>
            <div class="item-target-grid">
              ${targetCard("s1", PKM_RUN?.activePokemon)}
              ${targetCard("s2", PKM_RUN?.secondActive)}
            </div>
            <button type="button" class="item-action-cancel" onclick="closeModal()">ANNULLA</button>
          </div>
        `);
      };

      window.equipQuickItem = (
        itemId
      ) => {

        if(!PKM_RUN){
          return false;
        }

        const db =
          window.PokeMisteryRL_Items?.DB_ITEMS ||
          window.DB_ITEMS ||
          null;

        const item =
          db && typeof db === "object"
            ? (
                db[itemId] ||
                Object.values(db).find(
                  x =>
                    x &&
                    String(x.id) ===
                    String(itemId)
                )
              )
            : null;

        if(!item){
          msg("Oggetto non disponibile.");
          return false;
        }

        const inventory =
          Array.isArray(PKM_RUN.items) && PKM_RUN.items.length
            ? PKM_RUN.items
            : Array.isArray(PKM_RUN.inventory)
              ? PKM_RUN.inventory
              : [];

        const owned = inventory.some(entry =>
          entry &&
          String(typeof entry === "object" ? entry.id : entry) ===
          String(item.id) &&
          Number(typeof entry === "object" ? (entry.qty ?? 1) : 1) > 0
        );

        if(!owned){
          msg("Devi prima ottenere questo oggetto nell'inventario.");
          return false;
        }

        if(!Array.isArray(PKM_RUN.activeItems)){
          PKM_RUN.activeItems = [];
        }

        const oldIndex = PKM_RUN.activeItems.findIndex(
          x => String(x?.id || x) === String(item.id)
        );

        if(oldIndex >= 0){
          PKM_RUN.activeItems.splice(oldIndex, 1);
          msg(`↩️ ${item.nome || item.name || item.id} rimosso dagli attivi.`);
        }else{
          if(PKM_RUN.activeItems.length >= 5){
            msg("Puoi avere al massimo 5 oggetti attivi.");
            return false;
          }

          PKM_RUN.activeItems.push({
            id:item.id,
            nome:item.nome || item.name || item.id,
            icon:item.icon || item.emoji || "📦"
          });
          msg(`⭐ ${item.nome || item.name || item.id} aggiunto agli attivi.`);
        }

        // Compatibilità con le parti della run che leggevano il vecchio nome.
        PKM_RUN.equippedItems = PKM_RUN.activeItems;

        refreshBottomPanel();

        closeModal();

        return true;
      };

      window.equipHeldItem = (itemId, slot) => {
        const db = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
        const item = db[itemId] || Object.values(db).find(x => String(x?.id) === String(itemId));
        const inventory = Array.isArray(PKM_RUN?.items) && PKM_RUN.items.length ? PKM_RUN.items : (PKM_RUN?.inventory || []);
        const inventoryEntry = inventory.find(entry => String(entry?.id || entry) === String(itemId) && Number(entry?.qty ?? 1) > 0);
        if(!item || !inventoryEntry || !["s1","s2"].includes(slot) || (slot === "s2" && !PKM_RUN?.secondActive)){
          msg("Oggetto o Pokémon non disponibile."); return false;
        }
        if(!isEquipableItem(item)){
          msg("Questo oggetto è un consumabile: usalo dallo zaino."); return false;
        }
        const holder = pokemonForHeldSlot(slot);
        const current = getHeldItemsForPokemon(holder);
        const icons = {bitorzolello:"🪖",avanzi:"🍱",evolcondensa:"💎",vulneropolizza:"🛡️",palla_fumo:"💨",assorbisfera:"🔴",caramella_rara:"🍬",amuleto:"📿"};
        holder.heldItems = [...current, { id:item.id, nome:item.nome, immagine:item.immagine || "", icon:item.icon || icons[item.id] || "◈" }];
        inventoryEntry.qty = Math.max(0, Number(inventoryEntry.qty ?? 1) - 1);
        if(Number(inventoryEntry.qty) <= 0){
          const index = inventory.indexOf(inventoryEntry);
          if(index >= 0) inventory.splice(index, 1);
        }
        refreshBottomPanel(); closeModal(); msg(`${item.nome} equipaggiato a ${slot === "s1" ? "Starter" : "Partner"}.`); return true;
      };

      window.removeHeldItem = (itemId, slot) => {
        if(!PKM_RUN || !["s1","s2"].includes(slot)) return false;
        const holder = pokemonForHeldSlot(slot);
        const current = getHeldItemsForPokemon(holder);
        const next = current.filter(entry => String(entry?.id || entry) !== String(itemId));
        if(next.length === current.length){ msg("Oggetto non equipaggiato."); return false; }
        const removed = current.find(entry => String(entry?.id || entry) === String(itemId));
        holder.heldItems = next;
        PKM_RUN.items ||= [];
        PKM_RUN.inventory ||= [];
        const bag = PKM_RUN.items.length || !PKM_RUN.inventory.length
          ? PKM_RUN.items
          : PKM_RUN.inventory;
        const entry = bag.find(x => String(x?.id || x) === String(itemId));
        if(entry) entry.qty = Math.max(0, Number(entry.qty ?? 0) + 1);
        else bag.push({id:itemId, qty:1, nome:removed?.nome, immagine:removed?.immagine || "", icon:removed?.icon});
        refreshBottomPanel();
        if(slot === "s1") window.openStarterPreview?.();
        else window.openSecondPreview?.();
        msg(`Oggetto rimosso da ${slot.toUpperCase()}.`); return true;
      };

      window.useInventoryItem = (itemId, slot) => {
        const db = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
        const item = db[itemId] || Object.values(db).find(x => String(x?.id) === String(itemId));
        const target = slot === "s1" ? PKM_RUN?.activePokemon : PKM_RUN?.secondActive;
        const inventory = Array.isArray(PKM_RUN?.items) && PKM_RUN.items.length ? PKM_RUN.items : (PKM_RUN?.inventory || []);
        const entry = inventory.find(x => String(x?.id || x) === String(itemId) && Number(x?.qty ?? 1) > 0);
        if(!item || !entry || !target){ msg("Oggetto o Pokémon non disponibile."); return false; }
        const clearStatus = () => ["__campaignPoisoned","__campaignBurned","__campaignFrozenTurns","__campaignStunTurns","__campaignSlow"].forEach(key => { delete target[key]; });
        if((item.revive_hp || itemId === "rivitalizzante") && Number(target.hp) > 0){ msg("Usalo su un Pokémon esausto."); return false; }
        if(itemId === "cenere_sacra"){
          [PKM_RUN?.activePokemon, PKM_RUN?.secondActive, ...(PKM_RUN?.teamSlots || [])].filter(Boolean).forEach(member => {
            member.hp = member.maxHp;
            ["__campaignPoisoned","__campaignBurned","__campaignFrozenTurns","__campaignStunTurns","__campaignSlow"].forEach(key => delete member[key]);
          });
        }else if(item.revive_hp){
          target.hp = Math.max(1, Math.ceil(target.maxHp * Number(item.revive_hp)));
          if(item.cura_status) clearStatus();
        }else if(item.cura_hp){
          const amount = item.cura_hp === "max" ? target.maxHp : Number(item.cura_hp);
          target.hp = Math.min(target.maxHp, Number(target.hp) + amount);
          if(item.cura_status) clearStatus();
        }else if(item.cura_status){
          clearStatus();
        }else if(itemId === "rivitalizzante") target.hp = Math.ceil(target.maxHp * .5);
        else if(itemId === "caramella_rara") PokeMisteryRL_LevelSystem.levelUp(target, 1);
        entry.qty = Math.max(0, Number(entry.qty ?? 1) - 1);
        if(Number(entry.qty) <= 0){
          const index = inventory.indexOf(entry);
          if(index >= 0) inventory.splice(index, 1);
        }
        refreshBottomPanel(); closeModal(); msg(`${item.nome} utilizzato.`); return true;
      };

    }


    const quickItemSlots =
      $("quickItemSlots");

    if(quickItemSlots){

      const inventory =
        Array.isArray(PKM_RUN.items) && PKM_RUN.items.length
          ? PKM_RUN.items
          : Array.isArray(PKM_RUN.inventory)
            ? PKM_RUN.inventory
            : [];

      const db =
        window.PokeMisteryRL_Items?.DB_ITEMS ||
        window.DB_ITEMS ||
        null;

      const getDbItem = (entry) => {

        if(!entry){
          return null;
        }

        const id =
          typeof entry === "object"
            ? entry.id
            : entry;

        if(
          db &&
          typeof db === "object"
        ){

          return (
            db[id] ||
            Object.values(db).find(
              item =>
                item &&
                String(item.id) ===
                String(id)
            ) ||
            null
          );

        }

        return null;
      };

      const activeItems =
        Array.isArray(PKM_RUN.activeItems)
          ? PKM_RUN.activeItems
          : [];

      const quickItems =
        activeItems
          .map(entry => {

            const item =
              getDbItem(entry);

            const qty =
              typeof entry === "object"
                ? Number(
                    entry.qty ??
                    entry.quantity ??
                    entry.quantita ??
                    1
                  ) || 1
                : 1;

            return {
              item,
              qty
            };

          })
          .filter(
            x =>
              x.item &&
              x.qty > 0
          )
          .slice(0,5);

      const slots =
        quickItemSlots.querySelectorAll(
          "[data-quick-item-slot]"
        );

      slots.forEach(
        (slot,index) => {

          const data =
            quickItems[index];

          if(!data){

            slot.classList.add("empty");

            slot.innerHTML =
              `<span class="quick-item-icon">+</span><small></small>`;

            slot.title =
              "Slot oggetto vuoto";

            return;
          }

          const item =
            data.item;

          slot.classList.remove("empty");

          slot.innerHTML = `
            <span class="quick-item-icon">
              ${item.icon || "◈"}
            </span>

            <small>
              x${data.qty}
            </small>
          `;

          slot.title =
            `${item.nome || item.name || item.id} x${data.qty}`;

        }
      );

    }


    renderTeamSlots();
    refreshTeamViewer();

    const inc = PKM_RUN?.incubator || PKM_RUN?.incubatore || {};
    const steps = Number(inc.steps ?? inc.passi ?? inc.remaining ?? inc.passirimanenti ?? 0) || 0;
    if($("incubatorSteps")) $("incubatorSteps").textContent = `Passi: ${steps}`;
    refreshInventoryPanel();
  };


  // MAPPA

  const render = () => {

    if (!PKM_RUN) {
      return;
    }

    normalizeRunPokemonNames();

    // Le scelte iniziali costruiscono già la loro scena e il loro box mappa.
    // Un render globale (per esempio al termine del caricamento dati) non deve
    // sostituirli per un frame con la mappa normale: era il flash visibile.
    const initialChoiceOpen = isTest2Mode() && ["starter", "companions"].includes(PKM_RUN.startSelection?.phase) && !PKM_RUN.startSelection?.locked;
    if(initialChoiceOpen) return;

    // Se la mappa sta mostrando nuove uscite, la scena precedente è ormai
    // chiusa: nessun lock residuo può rendere i nodi apparentemente attivi
    // ma non cliccabili.
    if(isTest2Mode() && !PKM_RUN.battle && PKM_RUN.map?.some(row => row?.some(node => node?.ok))){
      busy = 0;
    }

    const floorButton = $("mapFloorButton");
    if(floorButton) floorButton.textContent = PKM_RUN.extraPassage ? "PASSAGGIO" : `PIANO: ${PKM_RUN.floor || 1}`;
    const map =
      $("map");

    if (!map) {
      return;
    }

    // Formazione e zaino sostituiscono temporaneamente la mappa con una
    // superficie piena. Quando vengono chiusi il render normale deve prima
    // rimuovere quelle classi, altrimenti le loro regole CSS oscurano la
    // mappa pur avendo già ricreato i nodi.
    map.classList.remove("test2-formation-map", "test2-backpack-map");
    delete map.dataset.test2BackpackOpen;
    map.classList.toggle("test2-horizontal-map", isTest2Mode());
    const test2InitialTeamReady = isTest2Mode() && PKM_RUN?.starterChosen && !PKM_RUN?.startSelection && !!PKM_RUN?.activePokemon && !!PKM_RUN?.secondActive && !!PKM_RUN?.teamSlots?.[0];
    if(test2InitialTeamReady){
      map.style.removeProperty("--test2-map-shift");
      map.dataset.test2Phase = String(Number(PKM_RUN.test2MapPhase) || 0);
    } else {
      map.style.removeProperty("--test2-map-shift");
      delete map.dataset.test2Phase;
    }

    // Aggiorna i comandi soltanto dopo avere ristabilito lo stato della mappa:
    // così Zaino e Formazione leggono davvero "tra nodi", non il pannello
    // appena chiuso (Rifugio, Dojo, ricompensa o fight).
    refreshBottomPanel();

    map.replaceChildren();


    const icons = {

      free: "⬇️",

      fight: "⚔️",

      boss: "👹",

      meat: "🍖",

      skill: "📈",

      shop: "🏪",

      event: "❓",

      rifugio: "🏠"

    };


    // Coordinate esplicite della mappa orizzontale Test2: ogni riga del DB
    // corrisponde a una colonna sullo schermo, con inizio e boss al centro.
    const test2MapY = {
      1: [50],
      2: [36, 64],
      3: [20, 50, 80]
    };
    // La seconda schermata riparte dalla colonna 4 già conclusa e mostra
    // subito le uscite verso la 5: 3→3→3→2→boss.
    const secondTest2Screen = isTest2Mode() && Number(PKM_RUN.test2MapPhase) === 1;
    const test2MapX = secondTest2Screen ? [10, 30, 50, 70, 90] : [12, 37, 62, 87];
    const test2VisibleStart = secondTest2Screen ? 3 : 0;
    const rowsToRender = isTest2Mode()
      ? PKM_RUN.map.slice(test2VisibleStart, test2VisibleStart + (secondTest2Screen ? 5 : 4))
      : PKM_RUN.map;

    rowsToRender.forEach((row, visibleRowIndex) => {
      const rowIndex = Number(row?.[0]?.row) || 0;

      const rowEl =
        document.createElement(
          "div"
        );


      rowEl.className =
        "map-row";

      if(isTest2Mode()){
        // I nodi vengono posizionati direttamente rispetto alla mappa;
        // la riga non deve quindi avere una propria altezza.
        rowEl.style.setProperty("display", "contents", "important");
      }



      row.forEach(node => {

        let cn =
          "node " +
          node.type;

        if(node.type === "fight" || BossWaves.isBossType(node.type) || node.type === "event"){
        const category = String(PKM_RUN.categoria || "").toLowerCase();
          if(["bosco", "safari"].includes(category)) cn += " fight-bosco";
          else if(category === "acqua") cn += " fight-acqua";
          else if(category === "torre") cn += " fight-torre";
          else cn += " fight-grotta";
        }


        if (node.done) {

          cn += " done";

        } else if (

          node.row === PKM_RUN.row &&

          node.col === PKM_RUN.col

        ) {

          cn += " current";

        } else if (node.ok) {

          cn += " available";

        } else {

          cn += " locked";
        }


        const el =
          document.createElement(
            "div"
          );


        el.id =
          `n-${node.id}`;


        el.className =
          cn;

        if(isTest2Mode()){
          const top = test2MapY[row.length]?.[node.col] ?? 50;
          el.style.setProperty("position", "absolute", "important");
          el.style.setProperty("left", `${test2MapX[visibleRowIndex] ?? 50}%`, "important");
          el.style.setProperty("top", `${top}%`, "important");
          el.style.setProperty("transform", "translate(-50%, -50%)", "important");
        }


        /*
         * I nodi non attivi restano presenti come placeholder.
         * Soprattutto: NON ricevono pick(), così un click su un nodo
         * non raggiungibile non può bloccare la run.
         */
        const activeNode =
          node.ok === true ||
          (node.row === PKM_RUN.row && node.col === PKM_RUN.col);

        const isBattleNode =
          node.type === "fight" ||
          BossWaves.isBossType(node.type) ||
          node.type === "rifugio" ||
          node.type === "shop" ||
          node.type === "skill";

        // In Test i nodi fight e boss non mostrano icone né avversari.
        // Gli altri nodi conservano il proprio sprite.
        const hideTestBattlePreview =
          window.PokeMisteryRL_Modes?.get?.(PKM_RUN?.mode)?.famiglia === "campagne" &&
          (node.type === "fight" || BossWaves.isBossType(node.type));

        if(hideTestBattlePreview && (node.ok || node.done || activeNode)){
          el.textContent = "";
          el.onclick = () => pick(node);
        }else if(
          isBattleNode &&
          !hideTestBattlePreview &&
          !(node.type === "shop" && PKM_RUN.kecleonDefeated) &&
          node.enemyPreview &&
          node.enemyPreview.immagine &&
          (node.ok || node.done || activeNode)
        ){

          el.innerHTML = `
            <span class="map-enemy-preview-crop" aria-hidden="true">
              <img
                class="map-enemy-preview-final"
                src="${sprite(node.enemyPreview.immagine)}"
                alt="${node.enemyPreview.nome || "Nemico"}"
              >
              <em class="map-enemy-level">LV 1</em>
              ${node.enemyPreviews?.[1] ? `
                <img
                  class="map-enemy-preview-final map-enemy-preview-second"
                  src="${sprite(node.enemyPreviews[1].immagine)}"
                  alt="${node.enemyPreviews[1].nome || "Secondo boss"}"
                >
              ` : ""}
            </span>
          `;

          el.onclick =
            () => pick(node);

        }else if (activeNode || node.done) {

          el.textContent =
            icons[node.type] || BossWaves.nodeIcon(node.type) ||
            "❓";

          el.onclick =
            () => pick(node);

        } else {

          el.classList.add("map-placeholder");
          el.textContent = "•";
          el.onclick = null;
          el.removeAttribute("onclick");
          el.setAttribute("aria-hidden", "true");
          el.title = "Nodo non disponibile";

        }


        rowEl.appendChild(el);

      });


      map.appendChild(rowEl);

    });

    if(isTest2Mode()){
      const formationButton = document.createElement("button");
      formationButton.type = "button";
      formationButton.className = "test2-map-tool test2-map-formation";
      formationButton.setAttribute("aria-label", "Formazione");
      formationButton.title = "Formazione";
      formationButton.textContent = "◎";
      formationButton.onclick = () => PokeMisteryRL.UI.toggleTest2FormationFromMap();
      map.appendChild(formationButton);
      const backpackButton = document.createElement("button");
      backpackButton.type = "button";
      backpackButton.className = "test2-map-tool test2-map-backpack";
      backpackButton.setAttribute("aria-label", "Zaino");
      backpackButton.title = "Apri zaino";
      backpackButton.textContent = "🎒";
      backpackButton.onclick = () => PokeMisteryRL.UI.openTestBackpackFromMap();
      map.appendChild(backpackButton);
    }


    if (!mapResizeObserver) {

      mapResizeObserver =
        new ResizeObserver(

          () =>
            PokeMisteryRL.Map
              .drawMapLines()

        );

      mapResizeObserver.observe(
        map
      );
    }


    setTimeout(

      PokeMisteryRL.Map
        .drawMapLines,

      50

    );
  };


  // BATTLE HP

  const updateBattleHP = () => {

    if(!PKM_RUN?.battle){
      return;
    }

    const s1 =
      PKM_RUN.activePokemon;

    const s2 =
      PKM_RUN.secondActive;

    const battle =
      PKM_RUN.battle;

    const enemy =
      battle.enemy;


    const updateOne = (
      pokemon,
      hp,
      maxHp,
      barId,
      textId
    ) => {

      if(!pokemon){
        return;
      }

      const safeMax =
        Math.max(
          1,
          Number(maxHp) || 1
        );

      const safeHp =
        clamp(
          Number(hp) || 0,
          0,
          safeMax
        );

      const percent =
        safeHp / safeMax * 100;


      const bar =
        $(barId);

      if(bar){
        bar.style.width =
          `${percent}%`;
        bar.classList.toggle("shielded", Number(pokemon.__campaignShield) > 0);
      }


      const text =
        $(textId);

      if(text){
        text.textContent =
          `HP ${safeHp}/${safeMax}`;
      }

    };


    updateOne(
      s1,
      s1?.hp,
      s1?.maxHp,
      "battleS1HpBar",
      "battleS1HpTxt"
    );


    /*
     * S2: aggiorna direttamente il pannello del fight.
     * Non dipende dal pannello Bottom e non usa ID duplicati.
     */
    if(s2){

      const s2Max =
        Math.max(
          1,
          Number(s2.maxHp) || 1
        );

      const s2Current =
        clamp(
          Number(s2.hp) || 0,
          0,
          s2Max
        );

      const s2Percent =
        s2Current / s2Max * 100;

      const s2Bar =
        document.querySelector(
          "#battleFinal #battleS2HpBar"
        );

      if(s2Bar){
        s2Bar.style.width =
          `${s2Percent}%`;
      }

      const s2Text =
        document.querySelector(
          "#battleFinal #battleS2HpTxt"
        );

      if(s2Text){
        s2Text.textContent =
          `HP ${s2Current}/${s2Max}`;
      }

    }

    if(isTest2Mode()){
      // Le tre barre dell'arena usano l'indice reale del combattente:
      // S1=0, S2=1, S3=2.
      [PKM_RUN?.activePokemon, PKM_RUN?.secondActive, PKM_RUN?.teamSlots?.[0]]
        .forEach((pokemon, index) => {
        const bar = $(`test2ArenaPlayer${index}Hp`);
        if(!bar || !pokemon) return;
        const maxHp = Math.max(1, Number(pokemon.maxHp) || 1);
        const hp = clamp(Number(pokemon.hp) || 0, 0, maxHp);
        bar.style.width = `${hp / maxHp * 100}%`;
        document.querySelector(`[data-battle-player="${index}"]`)
          ?.classList.toggle("dead", hp <= 0);
      });
      (battle.enemies || []).forEach((foe, index) => {
        const maxHp = Math.max(1, Number(foe?.maxHp) || 1);
        const hp = clamp(Number(foe?.hp) || 0, 0, maxHp);
        const bar = $(`test2ArenaEnemy${index}Hp`);
        if(bar) bar.style.width = `${hp / maxHp * 100}%`;
        document.querySelector(`#bottomCampagna [data-battle-enemy="${index}"]`)
          ?.classList.toggle("dead", hp <= 0);
      });
    }

    // In Test la formazione completa resta sempre leggibile nella battle HUD.
    if(isTestCampaign()){
      (PKM_RUN.teamSlots || []).forEach((pokemon, index) => {
        updateOne(
          pokemon,
          pokemon?.hp,
          pokemon?.maxHp,
          `battleTeam${index}HpBar`,
          `battleTeam${index}HpTxt`
        );
        document.querySelector(`#battleFinal .bf-sprite.team-${index}`)
          ?.classList.toggle("dead", !!pokemon && Number(pokemon.hp) <= 0);
      });
    }


    const enemyGroup = Array.isArray(battle.enemies) && battle.enemies.length
      ? battle.enemies
      : [enemy].filter(Boolean);
    if(isTestCampaign()){
      // Nella modalità Test ogni avversario ha la propria barra, in alto.
      enemyGroup.forEach((foe, index) => {
        updateOne(foe, foe?.hp, foe?.maxHp, `battleEnemy${index}HpBar`, `battleEnemy${index}HpTxt`);
        document.querySelector(`#battleFinal .bf-sprite.enemy-${index}`)
          ?.classList.toggle("dead", Number(foe?.hp) <= 0);
      });
    } else {
      // Nelle altre modalità resta la barra condivisa della presentazione.
      const sharedHp = enemyGroup.reduce(
        (sum, foe) => sum + Math.max(0, Number(foe.hp) || 0), 0
      );
      const sharedMaxHp = enemyGroup.reduce(
        (sum, foe) => sum + Math.max(1, Number(foe.maxHp) || 1), 0
      );
      updateOne(enemy, sharedHp, sharedMaxHp, "battleEnemyHpBar", "battleEnemyHpTxt");
      const enemyBar = $("battleEnemyHpBar");
      if(enemyBar) enemyBar.classList.toggle("shielded", enemyGroup.some(foe => Number(foe.__campaignShield) > 0));
    }


    const s2Sprite =
      document.querySelector(
        "#battleFinal .bf-sprite.s2"
      );

    if(isTestCampaign()){
      [PKM_RUN.activePokemon, PKM_RUN.secondActive, ...(PKM_RUN.teamSlots || [])].filter(Boolean).slice(0, 4).forEach((pokemon, index) => {
        document.querySelector(`#battleFinal [data-battle-player="${index}"]`)
          ?.classList.toggle("dead", Number(pokemon.hp) <= 0);
      });
    }


    if(
      s2Sprite &&
      s2 &&
      Number(s2.hp) <= 0
    ){
      s2Sprite.classList.add(
        "dead"
      );
    }

    (battle.enemies || []).forEach((foe, index) => {
      const spriteEl = document.querySelectorAll("#battleFinal .bf-sprite.enemy")[index];
      spriteEl?.classList.toggle("dead", Number(foe.hp) <= 0);
    });

  };


  // BATTLE TEMPLATE

  const buildBattleTemplate =
    (isBoss, floor) => {

      const s1 = PKM_RUN?.activePokemon;
      const s2 = PKM_RUN?.secondActive;
      const battle = PKM_RUN?.battle;
      const enemy = battle?.enemy;

      if(!s1 || !enemy){
        return `
          <div id="battleFinal">
            <div class="center">
              <h2>BATTAGLIA NON DISPONIBILE</h2>
              <p>Lo Starter o il nemico non sono disponibili.</p>
            </div>
          </div>
        `;
      }

      const buildCard = (
        pokemon,
        cls,
        hpBarId,
        hpTextId,
        enemyCard = false
      ) => {

        if(!pokemon){
          return `
            <div class="bf-hp ${cls} empty">
              <div class="bf-name-row">
                <b>PARTNER</b>
              </div>
              <div class="bar">
                <div id="${hpBarId}" style="width:0%"></div>
              </div>
              <span id="${hpTextId}">HP 0/0</span>
            </div>
          `;
        }

        const hpValue = Number(pokemon.hp) || 0;

        const maxHpValue = Math.max(
          1,
          Number(
            pokemon.maxHp
          ) || 1
        );

        const hpPercent = clamp(
          hpValue / maxHpValue * 100,
          0,
          100
        );
        const statuses = [
          pokemon.__campaignPoisoned ? "☠ VELENO" : "",
          pokemon.__campaignBurned ? "🔥 BRUCIA" : "",
          Number(pokemon.__campaignFrozenTurns) > 0 ? "❄ GELO" : "",
          Number(pokemon.__campaignStunTurns) > 0 ? "⚡ ELETTRO" : "",
          Number(pokemon.__campaignShield) > 0 ? `⬟ ${pokemon.__campaignShield}` : "",
          Number(pokemon.__campaignCloneHp) > 0 ? `✺ ${pokemon.__campaignCloneHp}` : ""
        ].filter(Boolean);

        return `
          <div class="bf-hp ${cls}">

            <div class="bf-name-row">
              <b>${pokemon.nome}</b>
              ${statuses.length ? `<span class="bf-statuses">${statuses.map(status => `<i>${status}</i>`).join("")}</span>` : ""}
            </div>

            <div class="bar">
              <div
                id="${hpBarId}"
                style="width:${hpPercent}%"
              ></div>
            </div>

            <span
              id="${hpTextId}"
              class="bf-hp-text"
            >
              HP ${hpValue}/${maxHpValue}
            </span>

          </div>
        `;
      };

      const enemies = Array.isArray(battle?.enemies) && battle.enemies.length
        ? battle.enemies
        : [enemy];
      const enemyCard = enemies.length > 1
        ? {...enemy, nome: enemies.map(foe => foe.nome).join(" + ")}
        : enemy;
      const testBattle = isTestCampaign();
      // Test2 è sempre 2 vs X: solo S1 e S2 occupano posizioni sul campo.
      const testPlayers = [s1, s2];
      const beetleCloneSprite = testPlayers.find(pokemon => (pokemon?.tipi || []).includes("coleottero"))?.immagine || "";
      const statusParticles = pokemon => {
        const statuses = [
          pokemon?.__campaignPoisoned && "veleno",
          pokemon?.__campaignBurned && "bruciatura",
          Number(pokemon?.__campaignFrozenTurns) > 0 && "gelo",
          Number(pokemon?.__campaignStunTurns) > 0 && "stordimento",
          Number(pokemon?.__campaignShield) > 0 && "scudo",
          Number(pokemon?.__campaignCloneHp) > 0 && "clone",
          Number(pokemon?.__campaignSlow) > 0 && "rallentamento"
        ].filter(Boolean);
        return statuses.length ? `<span class="pokemon-status-particles">${statuses.map(status => `<img src="./img/status-particles/${status}.gif" alt="${status}">`).join("")}</span>` : "";
      };
      const statusClass = pokemon => [
        pokemon?.__campaignPoisoned && "status-poisoned",
        Number(pokemon?.__campaignStunTurns) > 0 && "status-stunned"
      ].filter(Boolean).join(" ");
      const battlePokemonImage = pokemon => `<img src="${sprite(pokemon?.immagine)}" alt="${pokemon?.nome || "Pokémon"}">`;

      return `
        <div id="battleFinal" class="${isBoss ? "boss-battle" : ""} ${enemies.length > 1 ? "boss-duo multi-enemy" : ""} ${isTestCampaign() ? "test-battle" : ""} ${battle?.formationPending ? "formation-open" : ""}">

          <div class="bf-top">
            ${testBattle ? `<div class="bf-enemy-hud">
              ${enemies.map((foe, index) => buildCard(foe, "red", `battleEnemy${index}HpBar`, `battleEnemy${index}HpTxt`, true)).join("")}
            </div>` : `<div class="bf-player-hud">
              ${testPlayers.map((pokemon, index) => {
                const barId = index === 0 ? "battleS1HpBar" : index === 1 ? "battleS2HpBar" : `battleTeam${index - 2}HpBar`;
                const textId = index === 0 ? "battleS1HpTxt" : index === 1 ? "battleS2HpTxt" : `battleTeam${index - 2}HpTxt`;
                return buildCard(pokemon, index === 1 ? "green" : "blue", barId, textId);
              }).join("")}
            </div>${buildCard(enemyCard, "red", "battleEnemyHpBar", "battleEnemyHpTxt", true)}`}

          </div>

          <div class="bf-field">
            ${testBattle ? `<div class="bf-versus" aria-label="Scontro ${testPlayers.filter(Boolean).length} contro ${enemies.length}"><b>${testPlayers.filter(Boolean).length}</b><span>VS</span><b>${enemies.length}</b></div><div class="bf-turn-control"><b>TURNO ${Math.max(1, Number(battle?.turn || 0) + 1)}</b><label><input type="checkbox" ${battle?.formationRequested ? "checked" : ""} onchange="queueBattleFormationChange(this.checked)"> CAMBIO FORMAZIONE</label></div>` : ""}
            ${testBattle && battle?.formationPending ? `<div class="bf-formation-panel"><b>FORMAZIONE</b><small>Trascina un Pokémon nello slot desiderato.</small></div>` : ""}

            ${testBattle ? `<div class="bf-player-squad">${testPlayers.map((pokemon, index) => pokemon ? `<div class="bf-sprite ${Number(pokemon.hp) <= 0 ? "dead" : ""} ${statusClass(pokemon)} ${index === 0 ? "s1" : index === 1 ? "s2" : `team-${index - 2}`} team-battle-sprite" data-battle-player="${index}" data-formation-slot="${testPlayers.length - index}" draggable="true" ondragstart="PokeMisteryRL.UI.dragTestBottomPokemon(event,${index})" ondragover="PokeMisteryRL.UI.allowTestBottomDrop(event)" ondrop="PokeMisteryRL.UI.dropTestBottomPokemon(event,${index})">${battlePokemonImage(pokemon)}${statusParticles(pokemon)}${Number(pokemon.__campaignCloneHp) > 0 && beetleCloneSprite ? `<img class="bf-beetle-clone" src="${sprite(beetleCloneSprite)}" alt="Clone Coleottero">` : ""}</div>` : "").join("")}</div>` : `<div class="bf-sprite s1">
              ${battlePokemonImage(s1)}
            </div>

            ${
              s2
                ? `
                  <div class="bf-sprite s2">
                    ${battlePokemonImage(s2)}
                  </div>
                `
                : `
                  <div class="bf-sprite s2 empty">
                    <div class="bf-empty-slot">PARTNER</div>
                  </div>
                `
            }`}

            <div class="bf-enemy-squad">
              ${enemies.map((foe, index) => `
                <div class="bf-sprite enemy enemy-${index} ${statusClass(foe)} ${Number(foe.hp) <= 0 ? "dead" : ""} ${index === 1 ? "enemy2" : ""}">
                  ${battlePokemonImage(foe)}
                  ${testBattle ? statusParticles(foe) : ""}
                </div>
              `).join("")}
            </div>

          </div>

          ${testBattle ? `<div class="bf-player-bottom"><div class="bf-player-hud">
            ${testPlayers.map((pokemon, index) => {
              const barId = index === 0 ? "battleS1HpBar" : index === 1 ? "battleS2HpBar" : `battleTeam${index - 2}HpBar`;
              const textId = index === 0 ? "battleS1HpTxt" : index === 1 ? "battleS2HpTxt" : `battleTeam${index - 2}HpTxt`;
              return buildCard(pokemon, index === 1 ? "green" : "blue", barId, textId);
            }).join("")}
          </div></div>` : ""}

          ${!testBattle ? `<div class="bf-logRow">

            <div
              class="bf-log"
              id="blog"
            ></div>

            <div class="bf-fleeBox">

              ${
                !isBoss
                  ? `
                    <button
                      class="btn-flee"
                      onclick="flee()"
                    >
                      🏃 FUGGI
                    </button>
                  `
                  : ""
              }

            </div>

          </div>` : ""}

        </div>
      `;
    };

  // Test2: il bottom rimane invariato e aggiunge solo gli avversari a destra.
  const buildTest2ArenaTemplate = () => {
    const battlePokemonImage = pokemon => `<img src="${sprite(pokemon?.immagine)}" alt="${pokemon?.nome || "Pokémon"}">`;
    const battle = PKM_RUN?.battle;
    const defaultFormationPositions = {0:3, 1:4, 2:5};
    PKM_RUN.test2ScenePositions ||= {...defaultFormationPositions};
    const formationPositionFor = formationSlot => clamp(Number(PKM_RUN.test2ScenePositions?.[formationSlot] ?? defaultFormationPositions[formationSlot] ?? 4), 0, 8);
    const players = [
      { pokemon:PKM_RUN?.activePokemon, playerIndex:0, slot:2, formationSlot:0 },
      { pokemon:PKM_RUN?.secondActive, playerIndex:1, slot:3, formationSlot:1 },
      { pokemon:PKM_RUN?.teamSlots?.[0], playerIndex:2, slot:0, formationSlot:2, spectator:true }
    ];
    const enemies = Array.isArray(battle?.enemies) && battle.enemies.length
      ? battle.enemies : [battle?.enemy].filter(Boolean);
    const pendingWaves = Array.isArray(battle?.wavePreviews)
      ? battle.wavePreviews.flat().filter(Boolean)
      : [];
    const previousSlots = Array.isArray(battle?.enemySlots) ? battle.enemySlots : [];
    const usedSlots = new Set();
    const enemySlots = enemies.map((_, index) => {
      const saved = Number(previousSlots[index]);
      if(Number.isInteger(saved) && saved >= 0 && saved < 6 && !usedSlots.has(saved)){
        usedSlots.add(saved);
        return saved;
      }
      const available = Array.from({length:6}, (_, slot) => slot).filter(slot => !usedSlots.has(slot));
      const selected = available[Math.floor(Math.random() * available.length)] ?? index;
      usedSlots.add(selected);
      return selected;
    });
    if(battle) battle.enemySlots = enemySlots;
    return `<div id="bottomCampagna" class="bottom-campagna test2-fight-bottom" data-scene="${getTest2BottomScene()}"><span class="test2-fight-versus" aria-label="Squadra contro avversari">VS</span><div class="bottom-campagna-formation">${players.map(({pokemon, playerIndex, slot, formationSlot}) => {
      if(!pokemon) return "";
      const maxHp = Math.max(1, Number(pokemon.maxHp) || 1);
      const hpPercent = clamp((Number(pokemon.hp) || 0) / maxHp * 100, 0, 100);
      const isSceneMember = slot === 0 || slot >= 2;
      const formationPosition = formationPositionFor(formationSlot);
      return `<div class="bottom-campagna-member member-${slot} test2-fight-position-${formationPosition} ${isSceneMember ? "starter" : "ally"} ${Number(pokemon.hp) <= 0 ? "dead" : ""}" data-battle-player="${playerIndex}" data-formation-position="${formationPosition}">${battlePokemonImage(pokemon)}<span class="test2-scene-info"><b class="test2-scene-name">${pokemon.nome}</b><em class="test2-scene-level">LV ${pokemon.level || 1}</em><small class="test2-scene-move-level">MOSSA LV ${pokemon.sk || pokemon.skills?.[0]?.skillLevel || 1}</small><span class="bottom-campagna-types test2-scene-types" aria-label="Tipi di ${pokemon.nome}">${bottomTypeBadges(pokemon)}</span><i class="bottom-campagna-hp test2-scene-hp"><b id="test2ArenaPlayer${playerIndex}Hp" style="width:${hpPercent}%"></b></i></span></div>`;
    }).join("")}</div><div class="test2-enemy-formation">${enemies.map((pokemon, index) => {
      const maxHp = Math.max(1, Number(pokemon.maxHp) || 1);
      const hpPercent = clamp((Number(pokemon.hp) || 0) / maxHp * 100, 0, 100);
      return `<div class="test2-enemy-sprite enemy-${index} enemy-slot-${enemySlots[index]} ${Number(pokemon.hp) <= 0 ? "dead" : ""}" data-battle-enemy="${index}">${battlePokemonImage(pokemon)}<span class="test2-scene-info test2-enemy-scene-info"><b class="test2-scene-name">${pokemon.nome}</b><em class="test2-scene-level">LV ${pokemon.level || 1}</em><small class="test2-scene-move-level">MOSSA LV ${pokemon.sk || pokemon.skills?.[0]?.skillLevel || 1}</small><span class="bottom-campagna-types test2-scene-types" aria-label="Tipi di ${pokemon.nome}">${bottomTypeBadges(pokemon)}</span><i class="bottom-campagna-hp test2-scene-hp"><b id="test2ArenaEnemy${index}Hp" style="width:${hpPercent}%"></b></i></span></div>`;
    }).join("")}</div>${pendingWaves.length ? `<div class="test2-wave-reserve" aria-label="Avversari in attesa">${pendingWaves.map(battlePokemonImage).join("")}</div>` : ""}${buildTest2UtilityBar()}</div>`;
  };

  const getBattleSpriteSelector = target => {
    const key = String(target);
    if(/^player-\d+$/.test(key)) return `[data-battle-player="${key.split("-")[1]}"]`;
    if(/^enemy-\d+$/.test(key)){
      const index = key.split("-")[1];
      return isTest2Mode() ? `[data-battle-enemy="${index}"]` : (Number(index) ? `.bf-sprite.enemy-${index}` : ".bf-sprite.enemy");
    }
    if(key === "enemy2") return isTest2Mode() ? `[data-battle-enemy="1"]` : ".bf-sprite.enemy2";
    if(key === "enemy") return isTest2Mode() ? `[data-battle-enemy="0"]` : ".bf-sprite.enemy";
    if(key === "s2") return isTest2Mode() ? `[data-battle-player="1"]` : ".bf-sprite.s2";
    return isTest2Mode() ? `[data-battle-player="0"]` : ".bf-sprite.s1";
  };

  const hitShake = (target) => {
    const selector = getBattleSpriteSelector(target);


    const w =
      document.querySelector(
        selector
      );


    if (!w) {
      return;
    }


    w.classList.remove(
      "hit"
    );


    void w.offsetWidth;


    w.classList.add(
      "hit"
    );
  };


  // DAMAGE NUMBERS

  const spawnTypeAttack = (source, target, type, damage = 0) => {
    // Nella modalità Test2 il campo di combattimento è il box scenario
    // (#bottomCampagna), non la vecchia arena #battleFinal.
    const field = document.querySelector("#battleFinal .bf-field") || (isTest2Mode() ? $("bottomCampagna") : null);
    if(!field) return;
    const positions = isTest2Mode()
      ? { s1:"13%", s2:"31%", "player-0":"13%", "player-1":"31%", "player-2":"13%", enemy:"72%", enemy2:"86%" }
      : { s1:"16%", s2:"43%", "player-0":"7%", "player-1":"19%", "player-2":"31%", "player-3":"43%", "player-4":"55%", enemy:"72%", enemy2:"88%" };
    const fx = document.createElement("span");
    const impactFrame = Number(damage) < 30 ? 4 : Number(damage) < 70 ? 5 : 6;
    fx.className = `battle-type-fx type-${String(type || "normale").toLowerCase()} impact-${impactFrame}`;
    const typeAliases = { fire:"fuoco", water:"acqua", grass:"erba", electric:"elettro", ice:"ghiaccio", fighting:"lotta", ground:"terra", flying:"volante", psychic:"psico", bug:"coleottero", rock:"roccia", ghost:"spettro", dragon:"drago", dark:"buio", steel:"acciaio", fairy:"folletto", normal:"normale", poison:"veleno" };
    const rawType = String(type || "normale").toLowerCase();
    const normalizedType = typeAliases[rawType] || rawType;
    // Animazione interamente in codice: nessun foglio sprite o PNG da caricare.
    fx.classList.add("code-attack");
    fx.innerHTML = `<i class="code-type-attack" aria-label="Attacco ${normalizedType}"><i class="code-type-core"></i><i class="code-type-accent"></i></i>`;
    fx.style.setProperty("--fx-start", positions[source] || "50%");
    fx.style.setProperty("--fx-end", positions[target] || "50%");
    const targetSelector = getBattleSpriteSelector(target);
    const targetSprite = field.querySelector(targetSelector);
    if(targetSprite){
      const fieldRect = field.getBoundingClientRect();
      const spriteRect = targetSprite.getBoundingClientRect();
      const x = (spriteRect.left - fieldRect.left + spriteRect.width / 2) / Math.max(1, fieldRect.width) * 100;
      const y = (spriteRect.top - fieldRect.top + spriteRect.height / 2) / Math.max(1, fieldRect.height) * 100;
      fx.style.setProperty("--fx-target-x", `${x}%`);
      fx.style.setProperty("--fx-target-y", `${y}%`);
    }
    const sourceSelector = getBattleSpriteSelector(source);
    const sourceSprite = field.querySelector(sourceSelector);
    if(sourceSprite){
      const fieldRect = field.getBoundingClientRect();
      const spriteRect = sourceSprite.getBoundingClientRect();
      const x = (spriteRect.left - fieldRect.left + spriteRect.width / 2) / Math.max(1, fieldRect.width) * 100;
      const y = (spriteRect.top - fieldRect.top + spriteRect.height / 2) / Math.max(1, fieldRect.height) * 100;
      fx.style.setProperty("--fx-start-x", `${x}%`);
      fx.style.setProperty("--fx-start-y", `${y}%`);
    }
    field.appendChild(fx);
    // I frame devono essere realmente leggibili: la vecchia durata mostrava
    // quasi esclusivamente l'ultimo pallino.
    setTimeout(() => fx.remove(), 500);
  };

  const spawnDamage =
    (
      target,
      value,
      type = "normal",
      source = "enemy"
    ) => {

      const selector = getBattleSpriteSelector(target);


      const w =
        document.querySelector(
          selector
        );


      if (!w) {
        return;
      }


      const el =
        document.createElement(
          "div"
        );


      el.className =
        `dmg-num ${target} ${type} by-${source}`;


      el.textContent =

        type === "evade"
          ? "EVA"
          : type === "heal"

          ? `+${fmt(value)}`

          : type === "crit"

            ? `${fmt(value)}!`

            : `-${fmt(value)}`;


      w.appendChild(el);


      setTimeout(

        () => el.remove(),

        900

      );
    };


  // INFO POKEMON

  const openPokeInfo = (index) => {

    const pokemon =

      index === -1

        ? getActivePokemon()

        : PKM_RUN?.teamSlots?.[index];


    if (!pokemon) {
      return;
    }


    if ($("pokeInfoSprite"))

      $("pokeInfoSprite").src =
        sprite(
          pokemon.immagine
        );


    if ($("pokeInfoName"))

      $("pokeInfoName").textContent =

        pokemon.nome +

        (
          index === -1
            ? " [STARTER]"
            : ""
        );


    if ($("pokeInfoTypes"))

      $("pokeInfoTypes").innerHTML =

        pokemon.tipi

          .map(
            getTypingBadge
          )

          .join("");


    if ($("piHp"))

      $("piHp").textContent =
        `${pokemon.hp}/${pokemon.maxHp}`;


    if ($("piAtk"))

      $("piAtk").textContent =
        pokemon.stats.atk;


    if ($("piAtkR"))

      $("piAtkR").textContent =

        pokemon.rolls?.atk

          ? `(${fmtIV(
              pokemon.rolls.atk
            )})`

          : "";


    if ($("piDef"))

      $("piDef").textContent =
        pokemon.stats.dif;


    if ($("piDefR"))

      $("piDefR").textContent =

        pokemon.rolls?.dif

          ? `(${fmtIV(
              pokemon.rolls.dif
            )})`

          : "";


    if ($("piSpd"))

      $("piSpd").textContent =
        pokemon.stats.spd;


    if ($("piSpdR"))

      $("piSpdR").textContent =

        pokemon.rolls?.spd

          ? `(${fmtIV(
              pokemon.rolls.spd
            )})`

          : "";


    if ($("piCrit"))

      $("piCrit").textContent =
        pokemon.crit ?? 0;


    if ($("piEva"))

      $("piEva").textContent =
        pokemon.eva ?? 0;


    if ($("piStun"))

      $("piStun").textContent =
        pokemon.stun ?? 0;


    const actions =
      $("pokeInfoActions");


    if (actions) {

      actions.innerHTML =

        index >= 0

          ? `

            <button
              class="danger"
              onclick="releasePoke(${index})"
            >
              Abbandona
            </button>

          `

          : `

            <small class="small">

              Starter attuale -

              LV ${
                PokeMisteryRL_LevelSystem
                  .getLevel(pokemon)
              }

            </small>

          `;
    }


    $("pokeInfo")
      ?.classList.remove(
        "hidden"
      );
  };


  const closePokeInfo = () =>
    $("pokeInfo")
      ?.classList.add(
        "hidden"
      );

  const testBottomSlots = () => [
    PKM_RUN?.activePokemon,
    PKM_RUN?.secondActive,
    PKM_RUN?.teamSlots?.[0],
    PKM_RUN?.teamSlots?.[1]
  ];

  const openTestBottomPokemon = index => {
    const pokemon = testBottomSlots()[Number(index)];
    if(!pokemon) return;
    const skill = PokeMisteryRL_SkillSystem?.getActiveSkill?.(pokemon) || pokemon.skills?.[0];
    const moveCategory = String(skill?.damageClass || skill?.categoria || "").toLowerCase() === "special" || String(skill?.categoria || "").toLowerCase() === "speciale" ? "SPECIALE" : "FISICA";
    const items = getHeldItemsForPokemon(pokemon);
    const stats = pokemon.stats || {};
    const activeType = normalizeItemType(skill?.type || skill?.tipo || pokemon.tipi?.[0] || "normale");
    const held = items.map(resolveGameItem);
    const effectiveStats = getEffectivePokemonStats(pokemon, skill);
    const effects = effectiveStats.effects;
    const currentHp = Math.max(0,Math.round(pokemon.hp || 0));
    const maxHp = Math.max(1,Math.round(pokemon.maxHp || stats.hp || 1));
    const statTiles = [["HP",`${currentHp}/${maxHp}`,null],["ATK",effectiveStats.atk,stats.atk],["DIF",effectiveStats.dif,stats.dif],["ATT. SP",effectiveStats.satk,stats.satk],["DIF. SP",effectiveStats.sdef,stats.sdef],["VEL",effectiveStats.spd,stats.spd]].map(([label,value,base]) => {
      const changed = base != null && Math.round(Number(base) || 0) !== Number(value);
      return `<div class="${changed ? "boosted" : ""}"><small>${label}</small><b>${changed ? `<s>${Math.round(base)}</s> → ${value}` : value}</b>${changed ? `<em>BONUS ATTIVO</em>` : ""}</div>`;
    }).join("");
    const equipment = held.length ? held.map((item,itemIndex) => {
      const raw = items[itemIndex] || item;
      const id = String(raw?.id || item?.id || raw).replace(/'/g,"\\'");
      const image = item?.immagine || raw?.immagine;
      const name = item?.nome || raw?.nome || raw?.name || raw?.id || "Oggetto";
      const effect = itemEffectLabel(item, pokemon, skill);
      const itemId = String(item?.id || raw?.id || "").toLowerCase();
      const matchesMoveType = item?.tipo !== "potenziamento_tipo" || normalizeItemType(item?.tipo_mossa) === activeType;
      const state = itemId === "evolcondensa"
        ? (effects.evioliteActive ? "ATTIVO · DIF +50%" : "INATTIVO · nessuna evoluzione")
        : itemId === "vulneropolizza"
          ? (effects.weaknessActive > 1 ? "ATTIVO · OFFESA ×2" : "IN ATTESA · dopo superefficace")
          : item?.tipo === "potenziamento_tipo"
            ? (matchesMoveType ? `ATTIVO · PWR +${Math.round((Number(item?.bonus_danno) || 0) * 100)}%` : `IN ATTESA · mossa ${String(item?.tipo_mossa || "").toUpperCase()}`)
            : itemId === "assorbisfera" ? "ATTIVO · PWR +30%" : "EFFETTO PASSIVO";
      return `<article class="test2-member-item ${state.startsWith("ATTIVO") ? "is-active" : ""}">${image ? `<img src="${image}" alt="">` : `<i>${raw?.icon || item?.icon || "◈"}</i>`}<div><b>${name}</b><small>${effect}</small><em>${state}</em></div><button type="button" onclick="removeTestHeldItem('${id}',${index})" aria-label="Rimuovi ${name}">×</button></article>`;
    }).join("") : `<p class="test2-member-empty">Nessun oggetto equipaggiato.</p>`;
    const basePower = Math.round(Number(skill?.pwr ?? skill?.power) || 0);
    const finalPower = Math.round(basePower * effects.movePowerMultiplier);
    const moveStatus = effects.movePowerMultiplier !== 1
      ? `PWR ${basePower} → ${finalPower} · BONUS +${Math.round((effects.movePowerMultiplier - 1) * 100)}%`
      : `PWR ${finalPower} · NESSUN BONUS DANNO`;
    const activeEffects = [
      effects.lifeOrbActive ? "Sfera Vita" : "",
      effects.typePowerBonus > 0 ? `Tipo ${activeType.toUpperCase()} +${Math.round(effects.typePowerBonus * 100)}%` : "",
      effects.evioliteActive ? "DIF/DIF.SP +50%" : "",
      effects.weaknessActive > 1 ? "Offesa ×2" : ""
    ].filter(Boolean);
    modal(`<section class="center test2-member-info"><header><div class="test2-member-portrait"><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"></div><div><span>SCHEDA POKÉMON</span><h2>${pokemon.nome}</h2><p>${(pokemon.tipi || []).map(getTypingBadge).join("")} · LIV ${pokemon.level || 1}</p></div><button type="button" onclick="closeModal()" aria-label="Chiudi">×</button></header><div class="test2-member-hp"><b style="width:${Math.round(currentHp / maxHp * 100)}%"></b><span>${currentHp} / ${maxHp} HP</span></div><section class="test2-member-stats">${statTiles}</section><section class="test2-member-move"><header><small>MOSSA ${moveCategory}</small><em>${moveStatus}</em></header><b>${getTypingBadge(activeType)} ${skill?.nome || skill?.name || "Nessuna mossa"}</b><p>${activeEffects.length ? activeEffects.map(effect => `<span>${effect}</span>`).join("") : "Nessun modificatore da equipaggiamento"}</p></section><section class="test2-member-equipment"><header><b>OGGETTI EQUIPAGGIATI</b><small>${held.length}/3</small></header>${equipment}</section><footer><button type="button" onclick="PokeMisteryRL.UI.openTestBackpack()">APRI ZAINO</button><button type="button" class="member-info-close" onclick="closeModal()">CHIUDI</button></footer></section>`);
  };
  window.removeTestHeldItem = (itemId, index) => {
    const pokemon = testBottomSlots()[Number(index)];
    if(!pokemon) return false;
    const held = getHeldItemsForPokemon(pokemon);
    const removed = held.find(item => String(item?.id || item) === String(itemId));
    if(!removed) return false;
    pokemon.heldItems = held.filter(item => item !== removed);
    PKM_RUN.items ||= [];
    const bagEntry = PKM_RUN.items.find(item => String(item?.id || item) === String(itemId));
    if(bagEntry) bagEntry.qty = Math.max(0, Number(bagEntry.qty || 0) + 1);
    else PKM_RUN.items.push({id:itemId, qty:1, nome:removed.nome, immagine:removed.immagine || "", icon:removed.icon || "◈"});
    refreshBottomPanel();
    openTestBottomPokemon(index);
    return true;
  };
  window.useTestBackpackItem = (itemId, index) => {
    if(isTest2Mode() && !isTest2BackpackSession()) return false;
    const pokemon = testBottomSlots()[Number(index)];
    const db = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
    const item = db[itemId];
    const inventory = getRunInventory();
    const entry = inventory.find(value => String(value?.id || value) === String(itemId) && Number(value?.qty ?? 1) > 0);
    if(!pokemon || !item || !entry || !isUsableItem(item)) return false;
    const clearStatus = () => ["__campaignPoisoned","__campaignBurned","__campaignFrozenTurns","__campaignStunTurns","__campaignSlow"].forEach(key => { delete pokemon[key]; });
    if((item.revive_hp || itemId === "rivitalizzante") && Number(pokemon.hp) > 0){ msg("Usalo su un Pokémon esausto."); return false; }
    if(itemId === "cenere_sacra") { [PKM_RUN?.activePokemon, PKM_RUN?.secondActive, ...(PKM_RUN?.teamSlots || [])].filter(Boolean).forEach(member => { member.hp = member.maxHp; ["__campaignPoisoned","__campaignBurned","__campaignFrozenTurns","__campaignStunTurns","__campaignSlow"].forEach(key => delete member[key]); }); }
    else if(item.revive_hp) { pokemon.hp = Math.max(1, Math.ceil(pokemon.maxHp * Number(item.revive_hp))); if(item.cura_status) clearStatus(); }
    else if(item.cura_hp) { pokemon.hp = Math.min(pokemon.maxHp, Number(pokemon.hp) + (item.cura_hp === "max" ? pokemon.maxHp : Number(item.cura_hp))); if(item.cura_status) clearStatus(); }
    else if(item.cura_status) clearStatus();
    else if(itemId === "rivitalizzante") pokemon.hp = Math.ceil(pokemon.maxHp * .5);
    else if(itemId === "caramella_rara") PokeMisteryRL_LevelSystem.levelUp(pokemon, 1);
    else return false;
    entry.qty = Math.max(0, Number(entry.qty ?? 1) - 1);
    if(!entry.qty) inventory.splice(inventory.indexOf(entry), 1);
    refreshBottomPanel();
    openTestBottomPokemon(index);
    return true;
  };

  const dragTestBottomPokemon = (event, index) => {
    if(PKM_RUN?.battle || !PKM_RUN?.test2FormationEditing){ event.preventDefault(); return; }
    event.dataTransfer?.setData("text/plain", String(index));
    event.dataTransfer.effectAllowed = "move";
  };
  const allowTestBottomDrop = event => event.preventDefault();
  const renderTest2FormationMap = () => {
    const map = $("map");
    if(!map || !PKM_RUN?.test2FormationEditing) return false;
    const defaults = {0:3, 1:4, 2:5};
    PKM_RUN.test2ScenePositions ||= {...defaults};
    const slots = testBottomSlots();
    const positionFor = index => clamp(Number(PKM_RUN.test2ScenePositions[index] ?? defaults[index] ?? 4), 0, 8);
    map.className = "test2-formation-map";
    const selected = Number(PKM_RUN.test2FormationEditorPick);
    map.innerHTML = `<section class="test2-formation-editor"><header><span>FORMAZIONE</span><small>Trascina un Pokémon nel box desiderato.</small><button type="button" onclick="PokeMisteryRL.UI.toggleTest2FormationEditor()" aria-label="Chiudi">×</button></header><div class="test2-formation-grid">${Array.from({length:9}, (_, position) => { const owner = slots.findIndex((pokemon, index) => pokemon && positionFor(index) === position); const pokemon = owner >= 0 ? slots[owner] : null; return `<div class="test2-formation-cell ${pokemon ? 'occupied' : ''}" data-formation-position="${position}" onclick="PokeMisteryRL.UI.placeTest2FormationSlot(${position})" ondragover="PokeMisteryRL.UI.allowTestBottomDrop(event)" ondrop="PokeMisteryRL.UI.dropTest2Placement(event,${position})">${pokemon ? `<button type="button" class="${selected === owner ? 'selected' : ''}" draggable="true" ondragstart="PokeMisteryRL.UI.dragTestBottomPokemon(event,${owner})" onpointerdown="PokeMisteryRL.UI.startTest2FormationTouch(event,${owner})" onpointermove="PokeMisteryRL.UI.moveTest2FormationTouch(event)" onpointerup="PokeMisteryRL.UI.endTest2FormationTouch(event)" onpointercancel="PokeMisteryRL.UI.cancelTest2FormationTouch(event)" onclick="event.stopPropagation();PokeMisteryRL.UI.selectTest2FormationPlacementSlot(${owner})" title="${pokemon.nome}"><img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}"><b>${pokemon.nome}</b></button>` : `<i>+</i>`}</div>`; }).join('')}</div></section>`;
    return true;
  };
  const toggleTest2FormationEditor = () => {
    if(!PKM_RUN || PKM_RUN.battle) return false;
    if(!PKM_RUN.test2FormationEditing && !canEditTest2Formation()) return false;
    PKM_RUN.test2FormationEditing = !PKM_RUN.test2FormationEditing;
    if(PKM_RUN.test2FormationEditing) renderTest2FormationMap();
    else PokeMisteryRL.UI.render();
    return PKM_RUN.test2FormationEditing;
  };
  const toggleTest2UtilityBar = () => {
    if(!PKM_RUN) return false;
    PKM_RUN.test2UtilityExpanded = !PKM_RUN.test2UtilityExpanded;
    const bar = document.querySelector(".test2-utility-bar");
    if(!bar) return PKM_RUN.test2UtilityExpanded;
    bar.classList.toggle("expanded", PKM_RUN.test2UtilityExpanded);
    const button = bar.querySelector(".test2-utility-toggle");
    if(button){
      button.textContent = PKM_RUN.test2UtilityExpanded ? "×" : "+";
      button.setAttribute("aria-expanded", String(!!PKM_RUN.test2UtilityExpanded));
      button.setAttribute("aria-label", PKM_RUN.test2UtilityExpanded ? "Richiudi comandi" : "Apri comandi");
      button.title = PKM_RUN.test2UtilityExpanded ? "Richiudi" : "Altri comandi";
    }
    return PKM_RUN.test2UtilityExpanded;
  };
  const decorateTest2ScenePngs = () => {
    const bottom = $("bottomCampagna");
    if(!bottom) return false;
    const scene = getTest2BottomScene();
    const editing = !!PKM_RUN?.test2SceneBuildingEditing;
    PKM_RUN.test2ScenePngLayout ||= {};
    const saved = PKM_RUN.test2ScenePngLayout[scene] ||= {};
    [...bottom.querySelectorAll("img")].forEach((image, index) => {
      if(image.closest(".test2-formation-order")) return;
      const key = image.closest(".test2-scene-building") ? "building" : `${image.closest(".bottom-campagna-member")?.className || "scene"}-${index}`;
      image.dataset.test2PngKey = key;
      const offset = saved[key] || {x:0,y:0};
      image.style.translate = `${Number(offset.x) || 0}px ${Number(offset.y) || 0}px`;
      image.classList.toggle("test2-png-editable", editing);
      image.onpointerdown = editing ? event => {
        if(event.target.closest("button")) return;
        if(image.closest(".test2-scene-building")) startTest2SceneBuildingEdit(event, "move");
        else startTest2GenericPngEdit(event);
      } : null;
    });
    return true;
  };
  const startTest2GenericPngEdit = event => {
    if(!PKM_RUN?.test2SceneBuildingEditing) return false;
    const image = event.currentTarget;
    const bottom = $("bottomCampagna");
    if(!image || !bottom) return false;
    event.preventDefault();
    event.stopPropagation();
    const scene = getTest2BottomScene();
    const key = image.dataset.test2PngKey;
    PKM_RUN.test2ScenePngLayout ||= {};
    const saved = PKM_RUN.test2ScenePngLayout[scene] ||= {};
    const original = {...(saved[key] || {x:0,y:0})};
    const start = {x:event.clientX, y:event.clientY};
    image.setPointerCapture?.(event.pointerId);
    const move = pointerEvent => {
      saved[key] = {x:Math.round(Number(original.x || 0) + pointerEvent.clientX - start.x), y:Math.round(Number(original.y || 0) + pointerEvent.clientY - start.y)};
      image.style.translate = `${saved[key].x}px ${saved[key].y}px`;
    };
    const end = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end, {once:true});
    document.addEventListener("pointercancel", end, {once:true});
    return true;
  };
  const toggleTest2SceneBuildingEditor = () => {
    if(!PKM_RUN || PKM_RUN.battle) return false;
    PKM_RUN.test2SceneBuildingEditing = !PKM_RUN.test2SceneBuildingEditing;
    renderTest2SceneBuilding();
    decorateTest2ScenePngs();
    return PKM_RUN.test2SceneBuildingEditing;
  };
  const startTest2SceneBuildingEdit = (event, mode) => {
    if(!PKM_RUN?.test2SceneBuildingEditing) return false;
    const buildingElement = event.currentTarget?.closest(".test2-scene-building");
    const scene = buildingElement?.dataset?.sceneBuilding;
    const surface = buildingElement?.closest("#bottomCampagna");
    const current = getTest2SceneBuilding(scene);
    if(!buildingElement || !surface || !current) return false;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = surface.getBoundingClientRect();
    const original = {x:Number(current.x), y:Number(current.y), size:Number(current.size)};
    buildingElement.setPointerCapture?.(event.pointerId);
    const move = pointerEvent => {
      const layout = PKM_RUN.test2SceneBuildingLayout[scene] ||= {};
      if(mode === "resize"){
        const delta = (pointerEvent.clientX - startX) / Math.max(1, rect.width) * 100;
        layout.size = clamp(original.size + delta, 18, 95);
      } else {
        layout.x = clamp(original.x + (pointerEvent.clientX - startX) / Math.max(1, rect.width) * 100, 0, 100);
        layout.y = clamp(original.y + (pointerEvent.clientY - startY) / Math.max(1, rect.height) * 100, 0, 100);
      }
      renderTest2SceneBuilding();
    };
    const end = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end, {once:true});
    document.addEventListener("pointercancel", end, {once:true});
    return true;
  };
  const flipTest2SceneBuilding = () => {
    const scene = getTest2BottomScene();
    const current = getTest2SceneBuilding(scene);
    if(!current) return false;
    PKM_RUN.test2SceneBuildingLayout[scene] ||= {};
    PKM_RUN.test2SceneBuildingLayout[scene].flip = !current.flip;
    renderTest2SceneBuilding();
    return PKM_RUN.test2SceneBuildingLayout[scene].flip;
  };
  const placeTest2FormationFromSource = (source, position) => {
    if(!PKM_RUN?.test2FormationEditing || PKM_RUN.battle || !canEditTest2Formation()) return false;
    source = Number(source);
    const slots = testBottomSlots();
    if(!Number.isInteger(source) || !slots[source]) return false;
    const defaults = {0:3, 1:4, 2:5};
    PKM_RUN.test2ScenePositions ||= {...defaults};
    const target = clamp(Number(position) || 0, 0, 8);
    const current = clamp(Number(PKM_RUN.test2ScenePositions[source] ?? defaults[source] ?? 4), 0, 8);
    const occupant = slots.findIndex((pokemon, index) => pokemon && index !== source && clamp(Number(PKM_RUN.test2ScenePositions[index] ?? defaults[index] ?? 4), 0, 8) === target);
    PKM_RUN.test2ScenePositions[source] = target;
    if(occupant >= 0) PKM_RUN.test2ScenePositions[occupant] = current;
    refreshBottomPanel();
    renderTest2FormationMap();
    return true;
  };
  const dropTest2Placement = (event, position) => {
    event.preventDefault();
    return placeTest2FormationFromSource(event.dataTransfer?.getData("text/plain"), position);
  };
  let test2FormationTouch = null;
  const formationCellAt = (x, y) => (document.elementsFromPoint?.(x, y) || [document.elementFromPoint(x, y)]).map(node => node?.closest?.("[data-formation-position]")).find(Boolean) || null;
  const clearTest2FormationTouchTarget = () => document.querySelectorAll("[data-formation-position].test2-formation-drop-target").forEach(cell => cell.classList.remove("test2-formation-drop-target"));
  const updateTest2FormationTouchTarget = (x, y) => {
    const cell = formationCellAt(x, y);
    clearTest2FormationTouchTarget();
    cell?.classList.add("test2-formation-drop-target");
    return cell;
  };
  const startTest2FormationTouch = (event, source) => {
    if(event.pointerType === "mouse" || !PKM_RUN?.test2FormationEditing) return;
    test2FormationTouch = {source:Number(source), pointerId:event.pointerId, x:event.clientX, y:event.clientY, dragging:false};
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  };
  const moveTest2FormationTouch = event => {
    const drag = test2FormationTouch;
    if(!drag || drag.pointerId !== event.pointerId) return;
    if(!drag.dragging && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    drag.dragging = true;
    event.preventDefault();
    updateTest2FormationTouchTarget(event.clientX, event.clientY);
  };
  const finishTest2FormationTouch = event => {
    const drag = test2FormationTouch;
    if(!drag || drag.pointerId !== event.pointerId) return false;
    const target = updateTest2FormationTouchTarget(event.clientX, event.clientY);
    test2FormationTouch = null;
    clearTest2FormationTouchTarget();
    if(drag.dragging && target){
      event.preventDefault();
      return placeTest2FormationFromSource(drag.source, Number(target.dataset.formationPosition));
    }
    return false;
  };
  const endTest2FormationTouch = event => finishTest2FormationTouch(event);
  const cancelTest2FormationTouch = event => {
    if(test2FormationTouch?.pointerId !== event.pointerId) return;
    test2FormationTouch = null;
    clearTest2FormationTouchTarget();
  };
  document.addEventListener("pointermove", event => { if(test2FormationTouch?.pointerId === event.pointerId) moveTest2FormationTouch(event); }, {passive:false});
  document.addEventListener("pointerup", event => { if(test2FormationTouch?.pointerId === event.pointerId) finishTest2FormationTouch(event); }, {passive:false});
  document.addEventListener("pointercancel", event => { if(test2FormationTouch?.pointerId === event.pointerId) cancelTest2FormationTouch(event); }, {passive:true});
  // Il drag HTML non è affidabile sui browser touch: questa coppia di
  // funzioni offre lo stesso spostamento con due tocchi (Pokémon → box).
  const selectTest2FormationPlacementSlot = index => {
    const source = Number(index);
    if(!PKM_RUN?.test2FormationEditing || !testBottomSlots()[source]) return false;
    PKM_RUN.test2FormationEditorPick = source;
    return renderTest2FormationMap();
  };
  const placeTest2FormationSlot = position => {
    const source = Number(PKM_RUN?.test2FormationEditorPick);
    if(!Number.isInteger(source)) return false;
    const slots = testBottomSlots();
    if(!slots[source]) return false;
    const defaults = {0:3, 1:4, 2:5};
    PKM_RUN.test2ScenePositions ||= {...defaults};
    const target = clamp(Number(position) || 0, 0, 8);
    const current = clamp(Number(PKM_RUN.test2ScenePositions[source] ?? defaults[source] ?? 4), 0, 8);
    const occupant = slots.findIndex((pokemon, index) => pokemon && index !== source && clamp(Number(PKM_RUN.test2ScenePositions[index] ?? defaults[index] ?? 4), 0, 8) === target);
    if(current !== target){
      PKM_RUN.test2ScenePositions[source] = target;
      if(occupant >= 0) PKM_RUN.test2ScenePositions[occupant] = current;
    }
    delete PKM_RUN.test2FormationEditorPick;
    refreshBottomPanel();
    return renderTest2FormationMap();
  };
  const dropTestBottomPokemon = (event, targetIndex) => {
    event.preventDefault();
    const sourceIndex = Number(event.dataTransfer?.getData("text/plain"));
    const target = Number(targetIndex);
    if(!Number.isInteger(sourceIndex) || sourceIndex === target || !PKM_RUN?.mode || !isTestCampaign()) return;
    const slots = testBottomSlots();
    if(!slots[sourceIndex]) return;
    const setSlot = (index, pokemon) => {
      if(index === 0) PKM_RUN.activePokemon = pokemon;
      else if(index === 1) PKM_RUN.secondActive = pokemon;
      else PKM_RUN.teamSlots[index - 2] = pokemon;
    };
    setSlot(sourceIndex, slots[target]);
    setSlot(target, slots[sourceIndex]);
    refreshBottomPanel();
    if(PKM_RUN?.battle){
      const resumeAfterDrop = !!PKM_RUN.battle.formationPending;
      showBattleSurface(PokeMisteryRL.UI.buildBattleTemplate(!!PKM_RUN.battle.boss, PKM_RUN.floor));
      PokeMisteryRL.UI.updateBattleHP();
      if(resumeAfterDrop) setTimeout(() => window.resumeBattleAfterFormation?.(), 80);
    }
  };

  const selectTest2FormationSlot = index => {
    if(!isTest2Mode() || !PKM_RUN) return false;
    const target = Number(index);
    const slots = testBottomSlots();
    if(!Number.isInteger(target) || target < 0 || target > 2 || !slots[target]) return false;
    const source = Number(PKM_RUN.test2FormationPick);
    if(!Number.isInteger(source)){
      PKM_RUN.test2FormationPick = target;
      refreshBottomPanel();
      return true;
    }
    if(source === target){
      delete PKM_RUN.test2FormationPick;
      refreshBottomPanel();
      return true;
    }
    const setSlot = (slot, pokemon) => {
      if(slot === 0) PKM_RUN.activePokemon = pokemon;
      else if(slot === 1) PKM_RUN.secondActive = pokemon;
      else PKM_RUN.teamSlots[slot - 2] = pokemon;
    };
    setSlot(source, slots[target]);
    setSlot(target, slots[source]);
    delete PKM_RUN.test2FormationPick;
    refreshBottomPanel();
    return true;
  };

  const dragTest2FormationSlot = (event, index) => {
    event.dataTransfer?.setData("application/x-pokemistery-formation", String(index));
    event.dataTransfer?.setData("text/plain", String(index));
    if(event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };
  const allowTest2FormationDrop = event => event.preventDefault();
  const dropTest2FormationSlot = (event, index) => {
    event.preventDefault();
    const source = Number(event.dataTransfer?.getData("application/x-pokemistery-formation") || event.dataTransfer?.getData("text/plain"));
    const target = Number(index);
    if(!Number.isInteger(source) || source === target) return false;
    delete PKM_RUN?.test2FormationPick;
    PKM_RUN.test2FormationPick = source;
    return selectTest2FormationSlot(target);
  };


  return {

    buildBottomPanelTemplate,

    refreshBottomPanel,

    render,

    updateBattleHP,

    buildBattleTemplate,

    buildTest2ArenaTemplate,

    hitShake,

    spawnTypeAttack,

    spawnDamage,

    showInventory,

    hideInventory,

    toggleInventory,

    refreshInventoryPanel,

    changeInventoryPage,

    openTestBackpack,
    openTestBackpackFromMap,
    toggleTest2FormationFromMap,
    closeTest2Backpack,
    setTest2BackpackTab,
    openTest2BackpackItemInfo,
    applyTest2BackpackItem,
    dragBackpackItem,
    allowBackpackDrop,
    dropBackpackItem,
    dropBackpackItemToScene,
    startTest2BackpackTouch,
    moveTest2BackpackTouch,
    endTest2BackpackTouch,
    highlightTest2BackpackTarget,
    clearTest2BackpackTarget,
    startSceneBackpackTouch,
    moveSceneBackpackTouch,
    endSceneBackpackTouch,
    highlightSceneBackpackTarget,
    clearSceneBackpackTarget,
    startBackpackItemHold,
    cancelBackpackItemHold,

    openPokeInfo,
    closePokeInfo,

    openTestBottomPokemon,
    selectTest2FormationSlot,
    dragTest2FormationSlot,
    allowTest2FormationDrop,
    dropTest2FormationSlot,
    dragTestBottomPokemon,
    allowTestBottomDrop,
    toggleTest2UtilityBar,
    toggleTest2SceneBuildingEditor,
    startTest2SceneBuildingEdit,
    startTest2GenericPngEdit,
    flipTest2SceneBuilding,
    toggleTest2FormationEditor,
    dropTest2Placement,
    startTest2FormationTouch,
    moveTest2FormationTouch,
    endTest2FormationTouch,
    cancelTest2FormationTouch,
    selectTest2FormationPlacementSlot,
    placeTest2FormationSlot,
    dropTestBottomPokemon

  };

})();


  
// Gli helper del reclutamento vivono nel relativo modulo.
// EXPORT

const {
  render,
  refreshBottomPanel,
  buildBottomPanelTemplate
} =
  PokeMisteryRL.UI;


const {
  fight,
  flee,
  gameover
} =
  PokeMisteryRL.Battle;


const openPokeInfo =
  PokeMisteryRL.UI.openPokeInfo;


const closePokeInfo =
  PokeMisteryRL.UI.closePokeInfo;


// #endregion
// #region 17 - EXPORT + 18 - AVVIO
const renderHeldEquipment = (pokemon, slot) => {
  const held = getHeldItemsForPokemon(pokemon);
  const db = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
  if(!held.length) return `<div class="preview-held-item"><b>EQUIPAGGIAMENTO</b><span>Nessun oggetto</span></div>`;
  const detail = entry => {
    const item = db[entry.id] || Object.values(db).find(x => String(x?.id) === String(entry.id)) || entry;
    const stats = pokemon.stats || {};
    let text = item.effetto || "Effetto attivo";
    if(item.id === "avanzi") text = `Cura <b>+${Math.max(1,Math.ceil((Number(pokemon.maxHp)||1)/16))} HP</b> a turno`;
    else if(item.id === "evolcondensa") text = getPokemon(pokemon.id)?.evoluzione ? `DIF +50%<br><span>Il Pokémon può ancora evolversi.</span>` : `Nessun effetto: il Pokémon è già allo stadio finale.`;
    else if(item.id === "assorbisfera") text = `ATK +30% · rinculo ${Math.max(1,Math.ceil((Number(pokemon.maxHp)||1)*.1))} HP<br><span>Il nuovo Attacco è nella tab del Pokémon.</span>`;
    else if(item.id === "bitorzolello") text = `Chi colpisce subisce <b>${Math.max(1,Math.ceil((Number(pokemon.maxHp)||1)/6))} HP</b>`;
    else if(item.id === "palla_fumo") text = `Permette sempre la fuga dagli incontri selvatici.`;
    else if(item.id === "vulneropolizza") text = `Colpo superefficace subito: <b>ATT +2 livelli</b>`;
    if(item.tipo === "potenziamento_tipo"){
      text = `Mosse ${getTypingBadge(item.tipo_mossa)}: <b>+${Math.round((Number(item.bonus_danno) || 0) * 100)}% danno</b><br><span>Il nuovo PWR è mostrato direttamente nella tab della mossa.</span>`;
    }
    const icon = item.immagine || entry.immagine
      ? `<img class="equipment-image" src="${item.immagine || entry.immagine}" alt="">`
      : `<span class="equipment-icon">${entry.icon || item.icon || "◈"}</span>`;
    return `<div class="equipment-row"><div>${icon}<b>${item.nome || entry.nome}</b><button type="button" onclick="window.removeHeldItem('${item.id || entry.id}','${slot}')">✕</button></div><small>${text}</small></div>`;
  };
  return `<div class="preview-held-item"><b>EQUIPAGGIAMENTO</b>${held.map(detail).join("")}</div>`;
};

window.openStarterPreview = () => {

  const p = PKM_RUN?.activePokemon;

  if(!p){
    msg("Nessuno Starter1 disponibile");
    return;
  }

  fillPreview(p, `
    ${renderHeldEquipment(p,"s1")}
    <p class="preview-subtle">Starter principale</p>
  `);
};

window.openSecondPreview = () => {

  if(!PKM_RUN) return;

  const s1 =
    PKM_RUN.activePokemon;

  const current =
    PKM_RUN.secondActive;

  if(!s1){
    msg("Nessuno Starter1 disponibile");
    return;
  }

  const team =
    (PKM_RUN.teamSlots || [])
      .map((p,i) => ({p,i}))
      .filter(
        x =>
          x.p &&
          x.p !== s1
      );

  let choices = `
    <div class="partner-choice-panel">
      <div class="partner-choice-title">
        ⭐ SCEGLI IL PARTNER
      </div>

      <div class="partner-choice-copy">
        Seleziona un Pokémon della squadra.
      </div>
  `;

  if(!team.length){
  }else{

    choices += `
      <div class="s2-choice-list">

        ${team.map(({p,i}) => {

          const isCurrent =
            current === p;

          const types =
            (p.tipi || [])
              .slice(0,2)
              .map(
                t =>
                  `<span class="type-badge type-${t}">${t}</span>`
              )
              .join("");

          return `
            <button
              type="button"
              class="s2-choice-card ${isCurrent ? "selected" : ""}"
              data-s2-index="${i}"
              onclick="PokeMisteryRL.TeamRoster.equipAsSecond(${i}); return false;"
            >

              <img
                src="${sprite(p.immagine)}"
                alt="${p.nome || "Pokémon"}"
              >

              <div class="s2-choice-info">

                <b>
                  ${p.nome || "Pokémon"}
                </b>

                <span>
                  LV ${p.level || 1}
                </span>

                <span>
                  HP ${p.hp ?? 0}/${p.maxHp ?? 0}
                </span>

                <span class="s2-choice-types">
                  ${types}
                </span>

              </div>

              ${
                isCurrent
                  ? `<strong class="s2-current">PARTNER</strong>`
                  : ""
              }

            </button>
          `;

        }).join("")}

      </div>
    `;
  }

  choices += `</div>`;

  if(current){

    choices += `
      <div class="partner-choice-actions">

        <button
          type="button"
          onclick="unequipSecond()"
        >
          ⬇️ Togli compagno
        </button>

        <button
          type="button"
          onclick="releaseSecond()"
          class="danger"
        >
          🗑️ Rilascia Partner
        </button>

      </div>
    `;
  }

  /*
   * La tab S2 mostra S2 sopra, non S1.
   * Se S2 non è ancora equipaggiato, mostriamo un placeholder
   * mantenendo la stessa struttura della tab S1.
   */
  if(current){

    fillPreview(
      current,
      `${renderHeldEquipment(current,"s2")}${choices}`
    );

  }else{

    /*
     * Nessun S2 equipaggiato:
     * niente anteprima vuota e niente S1 al posto di S2.
     * Mostriamo solo il box informativo + la lista dei Pokémon
     * disponibili come compagno.
     */
    if(!team.length) return;
    modal(`
      <div class="center s2-no-companion-modal">
        ${choices}

        <button
          type="button"
          class="s2-tab-close"
          onclick="closeModal(); busy=0; PokeMisteryRL.UI.render();"
          aria-label="Chiudi"
          title="Chiudi"
        >
          ✕
        </button>

      </div>
    `);

  }
};

window.openTeamPreview = (i) => {
  const p = PKM_RUN?.teamSlots?.[i];
  if (!p) return;

  // usa fillPreview se esiste, altrimenti fallback manuale
  if (typeof fillPreview === 'function') {
    fillPreview(p, `
      <p class="preview-meta">ID ${p.id} | ${(p.tipi||[]).join('/')} | LV ${p.level||1} | HP ${p.hp}/${p.maxHp}</p>
      <div class="pp-actions preview-actions">
        <button onclick="equipAsSecond(${i})">⭐ Imposta compagno</button>
        ${typeof equipToStarter === 'function'? `<button onclick="equipToStarter(0,${i})">➡️ Starter</button><button onclick="equipToStarter(1,${i})">➡️ Partner</button>` : ``}
        <button onclick="releasePoke(${i})">🗑️ Rilascia</button>
      </div>
    `);
  } else {
    // fallback vecchio se fillPreview non c'è
    document.getElementById('ppSprite').src = sprite(p.immagine);
    document.getElementById('ppName').textContent = p.nome;
    document.getElementById('ppLevel').textContent = `LV ${p.level||1}`;
    document.getElementById('ppHpText').textContent = `${p.hp}/${p.maxHp}`;
    document.getElementById('ppTypes').innerHTML = (p.tipi||[]).map(t=>`<span class="type-badge type-${t}">${t}</span>`).join('');
    document.getElementById('ppCustomContent').innerHTML = `
      <p class="preview-meta">ID ${p.id} | ${(p.tipi||[]).join('/')}</p>
      <div class="preview-actions">
        <button onclick="equipAsSecond(${i})">⭐ Equipaggia come Starter2</button>
        <button onclick="releasePoke(${i})">🗑️ Rilascia</button>
      </div>`;
    document.getElementById('pokePreview').classList.remove('hidden');
  }
};
window.PKM_RUN = PKM_RUN;
window.start = window.startPokemon = PokeMisteryRL.Run.startPokemon;
window.pick = pick; window.next = next; window.flee = flee;
window.quickReset = PokeMisteryRL.Run.quickReset;
window.goMenu = PokeMisteryRL.Run.goMenu;
window.openHomeMenu = PokeMisteryRL.Run.openHomeMenu;
window.skill = skill; window.rifugio = rifugio; window.upgradeSkill = upgradeSkill;
window.toggleRunLog = toggleRunLog;
window.showInventory = () => PokeMisteryRL.UI.showInventory();
window.hideInventory = () => PokeMisteryRL.UI.hideInventory();
window.toggleInventory = () => PokeMisteryRL.UI.toggleInventory();
window.changeTeamPreview = (d) => PokeMisteryRL.UI.changeTeamPreview(d);
// Negozio estratto in core/features/shop.js.

window.getPokemon = getPokemon; window.getActivePokemon = getActivePokemon;
window.getTeamStats = getTeamStats; window.PKM_DB = PKM_DB;
window.renderMap = render; window.refreshBottomPanel = refreshBottomPanel;
window.evolvePokemon = evolvePokemon; window.checkEvolve = checkEvolve;
window.openPokeInfo = openPokeInfo; window.closePokeInfo = closePokeInfo;
window.closeEvolutionPrompt = closeEvolutionPrompt;
window.releasePoke = releasePoke; window.swapToActive = swapToActive;

window.unequipSecond = unequipSecond;
window.releaseSecond = releaseSecond;
window.openSecondPreview = openSecondPreview;
document.addEventListener("DOMContentLoaded", () => {
  buildPokemonDB();
  // Non blocca la schermata iniziale: i dati canonici arrivano live da PokéAPI.
  PokeMisteryRL.Database.loadPokeApiLiveDatabase();
  $("menu")?.classList.remove("hidden");
  console.log(`PokeMisteryRL Core v8.1 - ${Object.keys(PKM_DB).length} Pokémon - MODULAR`);
});
// #endregion

;

  (function(){
  if(window.__bottomTeamInteractionFix) return;
  window.__bottomTeamInteractionFix=true;

  document.addEventListener("click",function(e){
    const el=e.target.closest("#bottomContainer [data-team-index],#bottomContainer .team-slot");
    if(!el) return;

    const i=Number(el.dataset.teamIndex ?? el.dataset.index);
    if(!Number.isInteger(i) || !window.PKM_RUN) return;

    const p=PKM_RUN.teamSlots?.[i];
    if(!p) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if(typeof PokeMisteryRL?.TeamRoster?.openTeamPreview==="function"){
      PokeMisteryRL.TeamRoster.openTeamPreview(i);
    }else if(typeof PokeMisteryRL?.UI?.openPokeInfo==="function"){
      PokeMisteryRL.UI.openPokeInfo(p,i);
    }
  },true);
})();

(function(){
  function getInventory(){
    const r=window.PKM_RUN||{};
    return r.inventory ?? r.items ?? {};
  }

  window.openBottomInventory=function(){
    const right=document.querySelector("#bottomContainer .b8-right") ||
                document.getElementById("bottomRightPanel");
    if(!right) return;

    let panel=document.getElementById("bottomInventoryPanel");
    if(!panel){
      panel=document.createElement("div");
      panel.id="bottomInventoryPanel";
      panel.className="bottom-inventory-panel";
      right.dataset.originalHtml=right.innerHTML;
      right.innerHTML="";
      right.appendChild(panel);
    }

    const items=getInventory();
    const entries=Array.isArray(items)
      ? items.map((x,i)=>({
          name:x?.nome||x?.name||`Oggetto ${i+1}`,
          qty:x?.quantita??x?.qty??1
        }))
      : Object.entries(items).map(([name,qty])=>({name,qty}));

    panel.innerHTML=`
      <div class="bip-head">
        <b>🎒 INVENTARIO</b>
        <button type="button" onclick="closeBottomInventory()">✕</button>
      </div>
      <div class="bip-title">OGGETTI</div>
      <div class="bip-list">
        ${entries.length
          ? entries.map(x=>`<div class="bip-row"><span>${x.name}</span><b>x${x.qty}</b></div>`).join("")
          : `<div class="bip-empty">Inventario vuoto</div>`}
      </div>
    `;
  }

  window.closeBottomInventory=function(){
    const right=document.querySelector("#bottomContainer .b8-right") ||
                document.getElementById("bottomRightPanel");
    if(!right || right.dataset.originalHtml===undefined) return;

    right.innerHTML=right.dataset.originalHtml;
    delete right.dataset.originalHtml;
  }

  document.addEventListener("click",function(e){
    const b=e.target.closest("#bottomContainer button");
    if(!b) return;
    const t=(b.textContent||"").toLowerCase();
    if(t.includes("inventario") || t.includes("🎒")){
      e.preventDefault();
      e.stopImmediatePropagation();
      openBottomInventory();
    }
  },true);
})();

(function(){
  if(window.__s2CompanionSlotFix) return;
  window.__s2CompanionSlotFix = true;

  document.addEventListener("click", function(e){
    var slot = e.target.closest ? e.target.closest("#starter2Slot") : null;
    if(!slot) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if(typeof window.openSecondPreview === "function"){
      window.openSecondPreview();
    }
  }, true);
})();

(function(){
  if(window.__modalOrderFix) return;
  window.__modalOrderFix=true;

  var stack=[];

  function isVisible(el){
    return el && !el.classList.contains("hidden") &&
      getComputedStyle(el).display !== "none";
  }

  function sync(){
    stack=stack.filter(isVisible);
    document.body.classList.toggle("modal-child-open", stack.length>1);
  }

  document.addEventListener("click",function(e){
    var modal=e.target.closest(".modal,.modal-box,#pokePreview,[role='dialog']");
    if(!modal || !isVisible(modal)) return;

    var close=e.target.closest(
      ".modal-close,[data-close],.close-btn,.close,.pp-close"
    );

    if(close && stack.length){
      var top=stack[stack.length-1];
      if(top!==modal){
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
  },true);

  var observer=new MutationObserver(function(){
    var visible=[].slice.call(document.querySelectorAll(
      ".modal,.modal-box,#pokePreview,[role='dialog']"
    )).filter(isVisible);

    visible.forEach(function(el){
      if(stack.indexOf(el)<0) stack.push(el);
    });

    stack=stack.filter(isVisible);
    sync();
  });

  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:["class","style","hidden"]});
})();

(function(){
  if(window.__strictModalLockFix) return;
  window.__strictModalLockFix=true;

  function visible(el){
    if(!el) return false;
    var cs=getComputedStyle(el);
    return !el.classList.contains("hidden") &&
           cs.display!=="none" &&
           cs.visibility!=="hidden";
  }

  function topModal(){
    var all=[].slice.call(document.querySelectorAll(
      "#modal,#pokePreview,.modal,[role='dialog']"
    ));
    var visibleOnes=all.filter(visible);
    return visibleOnes.length ? visibleOnes[visibleOnes.length-1] : null;
  }

  /*
   * BLOCCA COMPLETAMENTE il click sullo sfondo.
   * Prima il click poteva arrivare alla mappa e farla tornare visibile.
   */
  document.addEventListener("pointerdown",function(e){
    var top=topModal();
    if(!top) return;

    if(!top.contains(e.target)){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },true);

  document.addEventListener("click",function(e){
    var top=topModal();
    if(!top) return;

    /*
     * Qualsiasi click fuori dalla finestra più recente viene ignorato.
     * Non chiude la finestra e soprattutto non raggiunge la mappa.
     */
    if(!top.contains(e.target)){
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
  },true);

  /*
   * Escape non deve chiudere una finestra sottostante.
   * Se esiste una finestra aperta, agisce solo sulla più recente
   * attraverso il suo eventuale pulsante di chiusura.
   */
  document.addEventListener("keydown",function(e){
    if(e.key!=="Escape") return;

    var top=topModal();
    if(!top) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    var close=top.querySelector(
      ".modal-close,[data-close],.close-btn,.close,.pp-close"
    );

    if(close) close.click();
  },true);
})();

(function(){
  if(window.__absoluteModalBackdropBlock) return;
  window.__absoluteModalBackdropBlock=true;

  function blockBackdrop(e){
    var preview=document.getElementById("pokePreview");
    var modal=document.getElementById("modal");

    /*
     * #pokePreview è il backdrop fixed.
     * Un click sul backdrop NON deve mai chiudere la tab
     * e NON deve mai arrivare alla mappa.
     */
    if(preview && !preview.classList.contains("hidden") && e.target===preview){
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }

    /*
     * Stessa protezione per il modal principale.
     */
    if(modal && !modal.classList.contains("hidden") && e.target===modal){
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }
  }

  document.addEventListener("pointerdown",blockBackdrop,true);
  document.addEventListener("mousedown",blockBackdrop,true);
  document.addEventListener("mouseup",blockBackdrop,true);
  document.addEventListener("click",blockBackdrop,true);
  document.addEventListener("touchstart",blockBackdrop,true);
  document.addEventListener("touchend",blockBackdrop,true);

  /*
   * Se il gioco ha handler globali che reagiscono a pointer events,
   * il backdrop li intercetta direttamente.
   */
  function install(){
    var preview=document.getElementById("pokePreview");
    var modal=document.getElementById("modal");

    if(preview && !preview.__backdropLock){
      preview.__backdropLock=true;
      ["pointerdown","mousedown","mouseup","click","touchstart","touchend"]
        .forEach(function(type){
          preview.addEventListener(type,function(e){
            if(e.target===preview){
              e.preventDefault();
              e.stopImmediatePropagation();
            }
          },true);
        });
    }

    if(modal && !modal.__backdropLock){
      modal.__backdropLock=true;
      ["pointerdown","mousedown","mouseup","click","touchstart","touchend"]
        .forEach(function(type){
          modal.addEventListener(type,function(e){
            if(e.target===modal){
              e.preventDefault();
              e.stopImmediatePropagation();
            }
          },true);
        });
    }
  }

  install();

  new MutationObserver(install).observe(document.body,{
    childList:true,
    subtree:true
  });
})();

(function(){
  if(window.__s2DirectSwapCapture) return;
  window.__s2DirectSwapCapture = true;

  document.addEventListener("click", function(e){

    var card =
      e.target && e.target.closest
        ? e.target.closest(".s2-choice-card")
        : null;

    if(!card){
      return;
    }

    var index =
      card.getAttribute("data-s2-index");

    if(index === null){
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    if(typeof window.equipAsSecond === "function"){
      window.equipAsSecond(Number(index));
    }

  }, true);
})();

(function(){
  if(window.__quickItemClickHandler) return;
  window.__quickItemClickHandler = true;

  document.addEventListener("click",function(e){

    const slot =
      e.target.closest
        ? e.target.closest(
            "#quickItemSlots [data-quick-item-slot]"
          )
        : null;

    if(!slot){
      return;
    }

    const index =
      Number(
        slot.getAttribute(
          "data-quick-item-slot"
        )
      );

    const activeItems =
      Array.isArray(window.PKM_RUN?.activeItems)
        ? window.PKM_RUN.activeItems
        : [];

    const entries =
      activeItems
        .filter(Boolean)
        .slice(0,5);

    const entry =
      entries[index];

    if(!entry){
      return;
    }

    const itemId =
      typeof entry === "object"
        ? entry.id
        : entry;

    if(itemId == null){
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    if(typeof window.openQuickItemDetail === "function"){
      window.openQuickItemDetail(itemId);
    }

  },true);
})();



/* ============================================================
   GLOBAL WINDOW API - COMPLETE COMPATIBILITY EXPORTS
   ------------------------------------------------------------
   Esporta verso window le funzioni già definite dal CORE 2 e
   richieste dai markup generati dinamicamente / HTML.
   Non crea una seconda implementazione e non altera la logica.
   ============================================================ */
(function(){

  const api = {
    start: typeof startPokemon === "function"
      ? startPokemon
      : PokeMisteryRL?.Run?.startPokemon,

    startPokemon: typeof startPokemon === "function"
      ? startPokemon
      : PokeMisteryRL?.Run?.startPokemon,

    pick,
    next,
    flee,
    skill,
    rifugio,
    upgradeSkill,
    toggleRunLog,

    shop: window.shop,
    buyShopItem: window.buyShopItem,

    getPokemon,
    getActivePokemon,
    getTeamStats,
    renderMap: render,
    refreshBottomPanel,

    evolvePokemon,
    checkEvolve,
    closeEvolutionPrompt,

    openPokeInfo,
    closePokeInfo,

    releasePoke,
    swapToActive,
    equipAsSecond,
    unequipSecond,
    releaseSecond,

    openStarterPreview,
    openSecondPreview,
    openTeamPreview,

    quickReset: PokeMisteryRL?.Run?.quickReset,
    goMenu: PokeMisteryRL?.Run?.goMenu,

    openQuickItemDetail: window.openQuickItemDetail,
    equipQuickItem: window.equipQuickItem,

    openBottomInventory: window.openBottomInventory
  };

  Object.keys(api).forEach(function(name){
    if(typeof api[name] === "function"){
      window[name] = api[name];
    }
  });

  window.PKM_RUN = PKM_RUN;

})();
