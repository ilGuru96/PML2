/* Oggetti: inventario, effetti passivi e statistiche effettive.
   Modulo indipendente da mappa/HUD/scene. */
(() => {
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
const itemTypeAliases = {fire:"fuoco",water:"acqua",grass:"erba",electric:"elettro",ice:"ghiaccio",fighting:"lotta",ground:"terra",flying:"volante",psychic:"psico",bug:"coleottero",rock:"roccia",ghost:"spettro",dragon:"drago",dark:"buio",steel:"acciaio",fairy:"folletto",normal:"normale",poison:"veleno"};
const normalizeItemType = type => itemTypeAliases[String(type || "").trim().toLowerCase()] || String(type || "").trim().toLowerCase();
const resolveGameItem = entry => {
  const db = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
  const id = String(entry?.id || entry || "").toLowerCase();
  const normalizedId = id === "velenoculeo" ? "velenaculeo" : id;
  return db[normalizedId] || Object.values(db).find(item => String(item?.id || "").toLowerCase() === normalizedId) || entry || null;
};
const getPokemonItemEffects = (pokemon, skill = null) => {
  const held = getHeldItemsForPokemon(pokemon).map(resolveGameItem).filter(Boolean);
  const ids = held.map(item => String(item?.id || "").toLowerCase());
  const moveType = normalizeItemType(skill?.type || skill?.tipo || pokemon?.tipi?.[0] || "normale");
  const evioliteActive = ids.includes("evolcondensa") && !!getPokemon(pokemon?.id)?.evoluzione;
  const weaknessActive = Math.max(1, Number(pokemon?.__weaknessBoost) || 1);
  const typePowerBonus = held.reduce((total, item) => item?.tipo === "potenziamento_tipo" && normalizeItemType(item?.tipo_mossa) === moveType ? total + Math.max(0, Number(item?.bonus_danno) || 0) : total, 0);
  const lifeOrbActive = ids.includes("assorbisfera");
  return { held, ids, moveType, evioliteActive, weaknessActive, typePowerBonus, lifeOrbActive, atkMultiplier:weaknessActive, satkMultiplier:weaknessActive, difMultiplier:evioliteActive ? 1.5 : 1, sdefMultiplier:evioliteActive ? 1.5 : 1, movePowerMultiplier:(lifeOrbActive ? 1.3 : 1) * (1 + typePowerBonus) };
};
const getEffectivePokemonStats = (pokemon, skill = null) => {
  const stats = pokemon?.stats || {}, effects = getPokemonItemEffects(pokemon, skill);
  return { effects, hp:Math.max(1,Math.round(Number(stats.hp) || Number(pokemon?.maxHp) || 1)), atk:Math.max(1,Math.floor((Number(stats.atk) || 1) * effects.atkMultiplier)), satk:Math.max(1,Math.floor((Number(stats.satk) || 1) * effects.satkMultiplier)), dif:Math.max(1,Math.floor((Number(stats.dif) || 1) * effects.difMultiplier)), sdef:Math.max(1,Math.floor((Number(stats.sdef) || 1) * effects.sdefMultiplier)), spd:Math.max(1,Math.floor(Number(stats.spd) || 1)) };
};
const returnPokemonHeldItemsToBag = pokemon => {
  const held = getHeldItemsForPokemon(pokemon);
  if(!held.length) return 0;
  PKM_RUN.items ||= [];
  held.forEach(removed => {
    const id = String(removed?.id || removed), existing = PKM_RUN.items.find(entry => String(entry?.id || entry) === id);
    if(existing) existing.qty = Math.max(0, Number(existing.qty) || 0) + 1;
    else PKM_RUN.items.push({id, qty:1, nome:removed?.nome, immagine:removed?.immagine || "", icon:removed?.icon});
  });
  pokemon.heldItems = [];
  return held.length;
};
window.PokeMisteryRL.ItemEffects = { normalizeItemType, resolveGameItem, getPokemonItemEffects, getEffectivePokemonStats };
})();
