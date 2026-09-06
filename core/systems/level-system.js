/* PokeMisteryRL - extracted LEVEL SYSTEM region
 * SOURCE: current Point 0
 * Depends on: getStatsFromBST / getStage helpers already provided by Core.
 */


const PokeMisteryRL_LevelSystem = (() => {

    const CONFIG = {
        MIN_LEVEL: 1,
        STAT_GROWTH: 0.10, // era 0.20 - per infinito 0.10 è più stabile
        HP_GROWTH: 0.085,  // era 0.17
        STAGE_MULTIPLIER: { 1: 0.95, 2: 1.00, 3: 1.05 },
        LEVEL_REWARD_NORMAL: 1,
        LEVEL_REWARD_BOSS: 2
    };

    const DATA = new WeakMap();

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    function getStage(pokemon) {
        return clamp(Number(pokemon?.stage) || 1, 1, 3);
    }

    function ensureData(pokemon) {
        if (!pokemon || typeof pokemon !== "object") return null;
        let data = DATA.get(pokemon);
        if (!data) {
            const level = Math.max(CONFIG.MIN_LEVEL, Number(pokemon.level) || 1);
            data = { level, baseStatsRandom: null, initialized: false };
            DATA.set(pokemon, data);
        }
        return data;
    }

    function saveBaseStats(pokemon) {
        const data = ensureData(pokemon);
        if (!data) return null;
        if (data.baseStatsRandom) return data.baseStatsRandom;
        if (!pokemon.stats) return null;

        // Se il CORE ha le stat pure non randomizzate, usa quelle
        const source = pokemon.baseStats || pokemon.stats;

        data.baseStatsRandom = {
            hp: Number(source.hp) || 1,
            atk: Number(source.atk) || 1,
            satk: Number(source.satk) || 1,
            dif: Number(source.dif) || 1,
            sdef: Number(source.sdef) || 1,
            spd: Number(source.spd) || 1
        };
        return data.baseStatsRandom;
    }

    function getLevel(pokemon) {
        const data = ensureData(pokemon);
        if (!data) return 1;
        const coreLevel = Number(pokemon.level);
        if (Number.isFinite(coreLevel) && coreLevel > data.level) {
            data.level = Math.max(CONFIG.MIN_LEVEL, coreLevel);
        } else {
            pokemon.level = data.level;
        }
        return data.level;
    }

    function setLevel(pokemon, level) {
        const data = ensureData(pokemon);
        if (!data) return false;
        data.level = Math.max(CONFIG.MIN_LEVEL, Number(level) || 1);
        pokemon.level = data.level;
        recalculateStats(pokemon);
        return true;
    }

    function getGrowthCurve(level) {
        level = Math.max(CONFIG.MIN_LEVEL, Number(level) || 1);
        return Math.pow(level - 1, 0.65); // 0 a LV1, infinita ma logaritmica
    }

    function getGrowthMultiplier(level, growth) {
        return 1 + (growth * getGrowthCurve(level));
    }

    function calculateStats(pokemon, level = null) {
        if (!pokemon) return null;
        const data = ensureData(pokemon);
        if (!data) return null;
        const base = saveBaseStats(pokemon);
        if (!base) return null;

        if (level === null) level = getLevel(pokemon);
        level = Math.max(CONFIG.MIN_LEVEL, Number(level) || 1);

        // La forma evolutiva è già inclusa nei valori PokéAPI della specie:
        // non applichiamo un secondo moltiplicatore allo stesso BST.
        const stageMul = pokemon.baseStats ? 1 : (CONFIG.STAGE_MULTIPLIER[getStage(pokemon)] || 1);
        const normalMul = getGrowthMultiplier(level, CONFIG.STAT_GROWTH);
        const hpMul = getGrowthMultiplier(level, CONFIG.HP_GROWTH);

        return {
            hp: Math.max(1, Math.round(base.hp * hpMul * stageMul)),
            atk: Math.max(1, Math.round(base.atk * normalMul * stageMul)),
            satk: Math.max(1, Math.round(base.satk * normalMul * stageMul)),
            dif: Math.max(1, Math.round(base.dif * normalMul * stageMul)),
            sdef: Math.max(1, Math.round(base.sdef * normalMul * stageMul)),
            spd: Math.max(1, Math.round(base.spd * normalMul * stageMul))
        };
    }

    function recalculateStats(pokemon) {
        if (!pokemon) return null;
        saveBaseStats(pokemon);
        const oldStats = pokemon.stats ? { ...pokemon.stats } : null;
        const oldMaxHP = Number(pokemon.maxHp) || 0;
        const oldHP = Number(pokemon.hp);

        const stats = calculateStats(pokemon);
        if (!stats) return null;

        pokemon.stats = stats;
        pokemon.maxHp = stats.hp;

        if (Number.isFinite(oldHP) && oldMaxHP > 0) {
            const ratio = clamp(oldHP / oldMaxHP, 0, 1);
            pokemon.hp = Math.round(pokemon.maxHp * ratio);
        } else {
            pokemon.hp = pokemon.maxHp;
        }

        return { oldStats, stats: { ...stats }, oldMaxHP, maxHp: pokemon.maxHp, hp: pokemon.hp };
    }

    function initialize(pokemon) {
        if (!pokemon) return false;
        const data = ensureData(pokemon);
        if (!data) return false;
        data.level = Math.max(CONFIG.MIN_LEVEL, Number(pokemon.level) || 1);
        pokemon.level = data.level;
        saveBaseStats(pokemon);
        recalculateStats(pokemon);
        data.initialized = true;
        return true;
    }

    function levelUp(pokemon, amount = 1) {
        const data = ensureData(pokemon);
        if (!data) return null;
        amount = Math.max(1, Math.floor(Number(amount) || 1));
        const oldLevel = data.level;
        data.level += amount;
        pokemon.level = data.level;
        recalculateStats(pokemon);
        if (data.level > oldLevel) {
            const coreMsg =
                window.PokeMisteryRL?.Helpers?.msg;

            if (typeof coreMsg === "function") {
                coreMsg(
                    `${pokemon.nome || "Pokémon"} è salito al LV ${data.level}!`
                );
            }
        }
        return { oldLevel, newLevel: data.level, gained: data.level - oldLevel };
    }

    function giveBattleLevel(pokemon, boss = false) {
        if (!pokemon) return null;
        const levels = boss ? CONFIG.LEVEL_REWARD_BOSS : CONFIG.LEVEL_REWARD_NORMAL;
        return levelUp(pokemon, levels);
    }

    function serialize(pokemon) {
        const data = DATA.get(pokemon);
        if (!data) return null;
        return {
            level: data.level,
            initialized: !!data.initialized,
            baseStatsRandom: data.baseStatsRandom ? { ...data.baseStatsRandom } : null
        };
    }

    function load(pokemon, saved) {
        if (!pokemon || !saved || typeof saved !== "object") return false;
        const data = {
            level: Math.max(CONFIG.MIN_LEVEL, Number(saved.level) || 1),
            initialized: !!saved.initialized,
            baseStatsRandom: saved.baseStatsRandom ? {
                hp: Number(saved.baseStatsRandom.hp) || 1,
                atk: Number(saved.baseStatsRandom.atk) || 1,
                satk: Number(saved.baseStatsRandom.satk) || 1,
                dif: Number(saved.baseStatsRandom.dif) || 1,
                sdef: Number(saved.baseStatsRandom.sdef) || 1,
                spd: Number(saved.baseStatsRandom.spd) || 1
            } : null
        };
        DATA.set(pokemon, data);
        pokemon.level = data.level;
        recalculateStats(pokemon);
        return true;
    }

function rebuildBaseStats(pokemon) {
    if (!pokemon) return false;

    const data = ensureData(pokemon);
    if (!data) return false;

    const statsFn =
        window.PokeMisteryRL?.Stats?.getStatsFromBST;

    if (typeof statsFn !== "function") {
        return false;
    }

    const liveBase =
        pokemon.baseStats ||
        window.PokeMisteryRL?.Database?.getPokemon?.(pokemon.id)?.baseStats ||
        null;
    const base =
        statsFn(pokemon.bst, getStage(pokemon), liveBase);
    if (liveBase) pokemon.baseStats = { ...liveBase };

    data.baseStatsRandom = {
        hp: Math.max(1, (Number(base.hp) || 1) + (Number(pokemon.rolls?.hp) || 0)),
        atk: Math.max(1, (Number(base.atk) || 1) + (Number(pokemon.rolls?.atk) || 0)),
        satk: Math.max(1, (Number(base.satk) || 1) + (Number(pokemon.rolls?.satk) || 0)),
        dif: Math.max(1, (Number(base.dif) || 1) + (Number(pokemon.rolls?.dif) || 0)),
        sdef: Math.max(1, (Number(base.sdef) || 1) + (Number(pokemon.rolls?.sdef) || 0)),
        spd: Math.max(1, (Number(base.spd) || 1) + (Number(pokemon.rolls?.spd) || 0))
    };

    recalculateStats(pokemon);
    return true;
}

    function setStage(pokemon, newStage) {
        if (!pokemon) return false;
        pokemon.stage = clamp(Number(newStage) || 1, 1, 3);
        recalculateStats(pokemon);
        return true;
    }

    function reset(pokemon) {
        const data = ensureData(pokemon);
        if (!data) return false;
        data.level = CONFIG.MIN_LEVEL;
        pokemon.level = CONFIG.MIN_LEVEL;
        recalculateStats(pokemon);
        return true;
    }

    function getData(pokemon) {
        const data = ensureData(pokemon);
        if (!data) return null;
        return {
            level: data.level,
            initialized: !!data.initialized,
            baseStatsRandom: data.baseStatsRandom ? { ...data.baseStatsRandom } : null
        };
    }

    return {
        CONFIG, initialize, getLevel, setLevel, getGrowthCurve,
        getGrowthMultiplier, calculateStats, recalculateStats,
        levelUp, giveBattleLevel, getData, serialize, load, setStage, reset, rebuildBaseStats,
    };
})();

window.PokeMisteryRL_LevelSystem =
    PokeMisteryRL_LevelSystem;
