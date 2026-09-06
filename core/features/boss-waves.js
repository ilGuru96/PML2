/*
 * Boss a ondate
 *
 * Questa feature contiene i dati e la presentazione di Boss 1 e Boss 2.
 * Il core le richiama tramite l'API qui sotto senza conoscere specie,
 * composizione delle ondate o scena di evoluzione.
 */
(function(){
  "use strict";

  const names = pokemon => String(pokemon?.nome || "").toLowerCase();
  const larvae = db => Object.values(db || {}).filter(pokemon => ["weedle", "caterpie"].includes(names(pokemon)));
  const byName = (db, name) => Object.values(db || {}).find(pokemon => names(pokemon) === name);

  const API = {
    ids: Object.freeze({first:"boss1", second:"boss2"}),
    isWaveBoss: type => type === "boss1" || type === "boss2",
    isBossType: type => type === "boss" || type === "boss1" || type === "boss2",
    isFinalBoss: type => type === "boss" || type === "boss1",
    nodeIcon: type => (type === "boss1" || type === "boss2") ? "👹" : null,
    waveSize: type => type === "boss2" ? 4 : 2,

    buildPreviews(db, type, preview){
      if(type === "boss1"){
        const pool = larvae(db);
        return pool.length ? Array.from({length:6}, (_, index) => preview(pool[index % pool.length])) : [];
      }
      if(type === "boss2"){
        const sequence = [
          "weedle", "caterpie", "weedle", "caterpie", "weedle", "caterpie",
          "kakuna", "metapod", "kakuna", "metapod", "kakuna", "metapod"
        ].map(name => byName(db, name)).filter(Boolean);
        return sequence.length === 12 ? sequence.map(preview) : [];
      }
      return [];
    },

    splitWaves(type, previews){
      if(!this.isWaveBoss(type)) return {active:previews, pending:[], size:0};
      const size = this.waveSize(type);
      return {
        active: previews.slice(0, size),
        pending: [previews.slice(size, size * 2), previews.slice(size * 2, size * 3)],
        size
      };
    },

    open(node, context){
      if(!context.isTest2Mode()) return context.startFight();
      const run = context.run();
      run.test2Scene = "tunnel";
      context.refreshBottom();
      const previews = node?.enemyPreviews || [];
      const isBoss2 = node?.type === "boss2";
      const pool = larvae(context.db());
      const group = isBoss2
        ? Array.from({length:12}, (_, index) => pool[index % pool.length])
        : (previews.length ? Array.from({length:12}, (_, index) => previews[index % previews.length]) : Array.from({length:12}, (_, index) => pool[index % pool.length]));
      const displayNames = [...new Set(previews.map(pokemon => pokemon?.nome).filter(Boolean))].join(" + ") || "Pokémon selvatici";
      const bottom = context.$("bottomCampagna");
      bottom?.querySelectorAll(".test2-boss1-group").forEach(element => element.remove());
      bottom?.insertAdjacentHTML("beforeend", `<div class="test2-boss1-group">${group.map(pokemon => `<img src="${context.sprite(pokemon.immagine)}" alt="${pokemon.nome}">`).join("")}</div>`);
      if(isBoss2 && bottom){
        const evolved = previews.slice(6);
        setTimeout(() => {
          if(!bottom.isConnected || !bottom.querySelector(".test2-boss1-group")) return;
          [...bottom.querySelectorAll(".test2-boss1-group img")].slice(6, 12).forEach((image, index) => {
            const pokemon = evolved[index];
            if(!pokemon) return;
            image.classList.add("is-evolving");
            image.src = context.sprite(pokemon.immagine);
            image.alt = pokemon.nome;
          });
          bottom.insertAdjacentHTML("beforeend", `<div class="test2-evolution-flash test2-scene-evolution">EVOLUZIONE!</div>`);
        }, 900);
      }
      const map = context.$("map");
      if(map){
        map.className = "test2-boss-intro-map";
        map.innerHTML = `<section class="test2-boss-intro"><header><small>PIANO ${run.floor || 1}</small></header><h2>Guardiano del percorso</h2><p>Un gruppo di Pokémon blocca la strada.</p><div class="test2-boss-intro-details"><article><small>AVVERSARI</small><b>${displayNames}</b></article></div><button type="button" onclick="startWaveBossChallenge()">⚔ INIZIA LA SFIDA</button></section>`;
      }
      context.release();
    },

    start(context){
      context.$("bottomCampagna")?.querySelectorAll(".test2-boss1-group").forEach(element => element.remove());
      const map = context.$("map");
      if(map){ map.className = ""; map.replaceChildren(); }
      context.renderMap();
      context.startFight();
      return true;
    }
  };

  window.PokeMisteryRL_BossWaves = API;
})();
