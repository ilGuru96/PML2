/* Mosse live: nessun catalogo locale. Ogni dato arriva da PokeAPI. */
const PokeMisteryRL_SkillSystem = (() => {
  const API = "https://pokeapi.co/api/v2";
  const typeNames = {
    normal:"normale", fire:"fuoco", water:"acqua", electric:"elettro",
    grass:"erba", ice:"ghiaccio", fighting:"lotta", poison:"veleno",
    ground:"terra", flying:"volante", psychic:"psico", bug:"coleottero",
    rock:"roccia", ghost:"spettro", dragon:"drago", dark:"buio",
    steel:"acciaio", fairy:"folletto"
  };
  const cache = new Map();
  const moveLevel = power => power <= 60 ? 1 : power <= 85 ? 2 : 3;
  const normalize = (data, level) => {
    const damageClass = data.damage_class?.name === "special" ? "special" : "physical";
    return {
      id:data.name, nome:data.name.replace(/-/g," ").replace(/\b\w/g, c => c.toUpperCase()),
      name:data.name.replace(/-/g," ").replace(/\b\w/g, c => c.toUpperCase()),
      pwr:Number(data.power) || 1, power:Number(data.power) || 1,
      type:typeNames[data.type?.name] || data.type?.name || "normale",
      damageClass,
      categoria: damageClass === "special" ? "speciale" : "fisica",
      skillLevel:level || moveLevel(Number(data.power) || 1)
    };
  };
  const fetchMove = async url => {
    if(cache.has(url)) return cache.get(url);
    const response = await fetch(url);
    if(!response.ok) return null;
    const data = await response.json();
    cache.set(url, data);
    return data;
  };
  const loadMoves = async pokemon => {
    if(!pokemon || pokemon.__apiMovesReady) return pokemon?.__apiMoves || [];
    if(pokemon.__apiMovesLoading) return pokemon.__apiMovesLoading;
    pokemon.__apiMovesLoading = (async () => {
      const base = PokeMisteryRL.Database?.getPokemon?.(pokemon.id);
      const choices = (base?.apiMoves || []).slice().sort(() => Math.random() - .5).slice(0, 28);
      const results = await Promise.all(choices.map(entry => fetchMove(entry.move?.url)));
      const moves = results.filter(move => Number(move?.power) > 0).map(move => normalize(move));
      pokemon.__apiMoves = moves;
      pokemon.__apiMovesReady = true;
      delete pokemon.__apiMovesLoading;
      return moves;
    })().catch(() => {
      pokemon.__apiMoves = [];
      pokemon.__apiMovesReady = true;
      delete pokemon.__apiMovesLoading;
      return [];
    });
    return pokemon.__apiMovesLoading;
  };
  const getSkill = (pokemon, level = 1) => {
    const pool = (pokemon?.__apiMoves || []).filter(move => Number(move.skillLevel) === Number(level));
    if(!pool.length){ loadMoves(pokemon).then(() => assignSkills(pokemon)); return null; }
    return {...pool[Math.floor(Math.random() * pool.length)]};
  };
  const assignSkills = pokemon => {
    if(!pokemon) return [];
    const existing = Array.isArray(pokemon.skills) ? pokemon.skills : [];
    const current = existing.find(move => Number(move.skillLevel) === 1);
    const skill = current || getSkill(pokemon, 1);
    pokemon.skills = skill ? [skill] : existing;
    return pokemon.skills;
  };
  const learnSkill = (pokemon, level) => {
    const skill = getSkill(pokemon, level);
    if(!skill) return null;
    pokemon.skills = [skill];
    pokemon.sk = Number(level) || 1;
    return skill;
  };
  const getPokemonSkill = (pokemon, level) =>
    (pokemon?.skills || []).find(skill => Number(skill.skillLevel) === Number(level)) || null;
  const getActiveSkill = pokemon => getPokemonSkill(pokemon, Number(pokemon?.sk) || 1);
  return { getSkill, assignSkills, learnSkill, getPokemonSkill, getActiveSkill, loadMoves };
})();
window.PokeMisteryRL_SkillSystem = PokeMisteryRL_SkillSystem;
