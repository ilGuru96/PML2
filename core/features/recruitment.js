(() => {
  "use strict";
  const runtime = window.PokeMisteryRLRuntime;
  const { $, sprite, msg, modal, closeModal } = runtime.helpers;
  const isTest2Mode = () => runtime.isTest2();
  const renderTeamSlots = (...args) => window.PokeMisteryRL?.TeamRoster?.renderTeamSlots?.(...args);
  const next = (...args) => window.next?.(...args);
/* ============================================================
   RECRUITMENT SYSTEM
   ============================================================
   Unificato direttamente nel CORE.
   CORE 2 chiama showRecruitmentPrompt() dopo una vittoria.
   Le funzioni sono esportate su window perché i pulsanti delle
   schermate generate dinamicamente usano onclick.
   ============================================================ */

window.showRecruitmentPrompt = (
  pokemon,
  reward,
  starter1,
  starter2
) => {

  if(!pokemon){
    return;
  }

  window._pendingRecruitment = {
    pokemon,
    reward,
    starter1,
    starter2
  };

  const freeSlot = isTest2Mode()
    ? (!runtime.run?.secondActive || !runtime.run?.teamSlots?.[0])
    : (runtime.run?.teamSlots || []).some(slot => !slot) || !runtime.run?.secondActive;

  // In Test2 il candidato è sempre mostrato nello scenario, anche a squadra
  // completa: sarà l'eventuale scelta successiva a chiedere chi sostituire.
  if(freeSlot || isTest2Mode()){

    // In Test2 il reclutamento è un evento della scena: il candidato appare
    // nell'arena e la mappa diventa temporaneamente la scelta del giocatore.
    if(isTest2Mode()){
      const bottom = $("bottomCampagna");
      const map = $("map");
      if(bottom){
        // L'evento inizia con la squadra ferma: non eredita la marcia del
        // nodo precedente, che altrimenti porta S1/S2 fuori dallo scenario.
        bottom.classList.remove("test2-node-finish");
        // La formazione standard resta visibile anche durante il reclutamento.
        bottom.classList.remove("test2-recruit-scene");
        bottom.querySelector(".test2-recruit-candidate")?.remove();
        bottom.querySelector(".test2-recruit-allies")?.remove();
        bottom.insertAdjacentHTML("beforeend", `
          <div class="test2-recruit-candidate" aria-label="${pokemon.nome}">
            <img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}">
          </div>
        `);
      }
      if(map){
        map.classList.add("test2-recruit-choice");
        map.innerHTML = `
          <div class="test2-recruit-choice-card">
            <span class="test2-recruit-eyebrow">INCONTRO SUL PERCORSO</span>
            <h2><b>${pokemon.nome}</b> vorrebbe partecipare alla tua squadra</h2>
            <p>Vuoi accoglierlo nel gruppo?</p>
            <div>
              <button type="button" class="test2-recruit-accept" onclick="window.acceptRecruitment()">✓ ACCETTA</button>
              <button type="button" class="test2-recruit-reject" onclick="window.rejectRecruitment()">RIFIUTA</button>
            </div>
          </div>
        `;
      }
      return;
    }

    modal(`
      <div class="center recruitment-offer">
        <span class="recruitment-kicker">✨ RECLUTAMENTO</span>
        <div class="recruitment-offer-main">
          <img src="${sprite(pokemon.immagine)}" alt="${pokemon.nome}">
          <div><h2>${pokemon.nome} vorrebbe unirsi a te!</h2><p>Vuole continuare l’avventura al fianco della tua squadra.</p></div>
        </div>
        <div class="recruitment-offer-reward">Ricompensa vittoria: <b>+${reward || 0}¥</b></div>
        <div class="recruitment-offer-actions"><button type="button" onclick="window.acceptRecruitment()">ACCETTA</button><button type="button" onclick="window.rejectRecruitment()">RIFIUTA</button></div>
      </div>
    `);

  }else{

    showFullTeamSwitch();

  }
};

window.compareRecruitment = (
  key
) => {

  const pending =
    window._pendingRecruitment;

  if(!pending){
    return false;
  }

  const options =
    getFullTeamSwitchOptions();

  const option =
    options.find(
      item =>
        String(item.key) ===
        String(key)
    );

  if(!option || !option.pokemon){
    return false;
  }

  window._pendingReplacement = {
    key:String(option.key),
    label:option.label,
    pokemon:option.pokemon
  };

  modal(`
    <div class="recruitment-box recruit-compare">

      <h2>
        🔄 CONFRONTA
      </h2>

      <div class="recruit-compare-grid">

        ${recruitCard(
          option.pokemon,
          option.label
        )}

        <div class="recruit-compare-arrow">
          →
        </div>

        ${recruitCard(
          pending.pokemon,
          "NUOVO POKÉMON"
        )}

      </div>

      <p class="recruit-compare-note">
        Il Pokémon a sinistra verrà sostituito
        da quello nuovo.
      </p>

      <div class="recruit-compare-actions">

        <button
          type="button"
          onclick="window.backRecruitmentSelection()"
        >
          INDIETRO
        </button>

        <button
          type="button"
          onclick="window.confirmRecruitReplacement()"
        >
          ✓ CONFERMA SOSTITUZIONE
        </button>

      </div>

    </div>
  `);

  return true;
};

window.backRecruitmentSelection = () => {

  if(!window._pendingRecruitment){
    return;
  }

  window._pendingReplacement = null;

  showFullTeamSwitch();
};

window.confirmRecruitReplacement = () => {

  const pending =
    window._pendingRecruitment;

  const replacement =
    window._pendingReplacement;

  if(!pending || !replacement){
    return false;
  }

  const pokemon =
    pending.pokemon;

  if(!pokemon){
    return false;
  }

  const key =
    String(replacement.key);

  let ok = false;

  if(key === "s2"){

    if(!runtime.run?.secondActive){
      return false;
    }

    runtime.run.secondActive =
      pokemon;

    ok = true;

  }else{

    const index =
      Number(key);

    if(
      !Number.isInteger(index) ||
      index < 0 ||
      index >= 3 ||
      !runtime.run?.teamSlots?.[index]
    ){
      return false;
    }

    runtime.run.teamSlots[index] =
      pokemon;

    ok = true;
  }

  if(!ok){
    msg(
      "Impossibile completare la sostituzione."
    );
    return false;
  }

  renderTeamSlots();
  PokeMisteryRL.UI.refreshBottomPanel();

  const oldName =
    replacement.pokemon?.nome ||
    "Pokémon";

  const newName =
    pokemon.nome ||
    "Pokémon";

  window._pendingRecruitment = null;
  window._pendingReplacement = null;
  window.next(`${newName} ha sostituito ${oldName}.`);

  return true;
};

window.confirmTest2RecruitReplacement = key => {
  const option = getFullTeamSwitchOptions().find(entry => String(entry.key) === String(key));
  if(!option?.pokemon) return false;
  window._pendingReplacement = {key:String(option.key), label:option.label, pokemon:option.pokemon};
  return window.confirmRecruitReplacement();
};

window.acceptRecruitment = () => {

  const pending =
    window._pendingRecruitment;

  if(!pending){
    return;
  }

  const test2TeamFull = isTest2Mode() && !!runtime.run?.activePokemon && !!runtime.run?.secondActive && !!runtime.run?.teamSlots?.[0];
  const added = test2TeamFull ? false : PokeMisteryRL.TeamRoster.recruitPokemon(pending.pokemon);

  if(!added){
    showFullTeamSwitch();
    return;
  }

  const name =
    pending.pokemon?.nome ||
    "Pokémon";

  window._pendingRecruitment = null;

  if(isTest2Mode()){
    window.finishTest2RecruitmentChoice(`${name} è entrato nella squadra.`);
    return;
  }
  PokeMisteryRL.UI.refreshBottomPanel();
  window.next(`${name} è entrato nella squadra.`);
};

window.rejectRecruitment = () => {

  const pending =
    window._pendingRecruitment;

  if(!pending){
    return;
  }

  window._pendingRecruitment = null;
  window._pendingReplacement = null;
  // Il rifiuto non interrompe più il flusso con una schermata separata.
  if(isTest2Mode()){
    window.finishTest2RecruitmentChoice("Vittoria!");
    return;
  }
  window.next("Vittoria!");
};

// Dopo la decisione, il candidato svanisce e S1/S2 attraversano il tratto.
window.finishTest2RecruitmentChoice = (message) => {
  const bottom = $("bottomCampagna");
  if(!bottom || !isTest2Mode()){
    window.next(message);
    return;
  }
  if(bottom.dataset.recruitLeaving === "1") return;
  bottom.dataset.recruitLeaving = "1";
  bottom.querySelector(".test2-recruit-candidate")?.remove();
  bottom.classList.add("test2-node-finish");
  setTimeout(() => window.next(message), 1060);
};


const recruitLevel = (p) =>
  Math.max(1, Number(p?.level) || 1);

const recruitSkill = (p) => {

  if(!p) return null;

  if(
    Array.isArray(p.skills) &&
    p.skills.length
  ){
    return p.skills[p.skills.length - 1];
  }

  return null;
};

const recruitCard = (
  pokemon,
  title
) => {

  if(!pokemon){
    return `
      <div class="recruit-empty">
        Nessun Pokémon
      </div>
    `;
  }

  const sk =
    recruitSkill(pokemon);

  return `
    <div class="recruit-card">

      <div class="recruit-card-title">
        ${title}
      </div>

      <div class="recruit-card-main">

        <div class="recruit-card-sprite">
          <img
            src="${sprite(pokemon.immagine)}"
            alt="${pokemon.nome || "Pokémon"}"
          >
        </div>

        <div class="recruit-card-info">

          <b class="recruit-name">
            ${pokemon.nome || "Pokémon"}
          </b>

          <span>
            LV ${recruitLevel(pokemon)}
          </span>

          <span>
            HP ${pokemon.hp ?? 0}/${pokemon.maxHp ?? 0}
          </span>

          <div class="recruit-skill">
            <small>SKILL</small>
            <b>
              ${
                sk?.name ||
                sk?.nome ||
                "--"
              }
            </b>
            <span>
              PWR ${
                sk?.pwr ??
                sk?.power ??
                "--"
              }
            </span>
          </div>

        </div>

      </div>

      <div class="recruit-stats">

        <div>
          <small>ATK</small>
          <b>${pokemon.stats?.atk ?? 0}</b>
        </div>

        <div>
          <small>DEF</small>
          <b>${pokemon.stats?.dif ?? 0}</b>
        </div>

        <div>
          <small>SPD</small>
          <b>${pokemon.stats?.spd ?? 0}</b>
        </div>

      </div>

    </div>
  `;
};

const getFullTeamSwitchOptions = () => {

  const options = [];

  if(runtime.run?.secondActive){

    options.push({
      key:"s2",
      label:"PARTNER",
      pokemon:runtime.run.secondActive
    });
  }

  (runtime.run?.teamSlots || [])
    .forEach(
      (pokemon,index) => {

        if(!pokemon) return;

        options.push({
          key:String(index),
          label:`RISERVA ${index + 1}`,
          pokemon
        });
      }
    );

  return options;
};

/* Chiusura sicura della schermata quando la squadra è piena.
   Non lascia stati di reclutamento sospesi e riporta la run alla mappa. */
window.cancelFullTeamRecruitment = () => {
  if(!window._pendingRecruitment){
    closeModal();
    runtime.busy = 0;
    PokeMisteryRL.UI.render();
    return true;
  }

  const name = window._pendingRecruitment.pokemon?.nome || "Pokémon";
  window._pendingRecruitment = null;
  window._pendingReplacement = null;
  closeModal();
  runtime.busy = 0;
  next(`${name} non è stato reclutato.`);
  return true;
};

const showFullTeamSwitch = () => {

  const pending =
    window._pendingRecruitment;

  if(!pending){
    return;
  }

  const options =
    getFullTeamSwitchOptions();

  if(isTest2Mode()){
    const map = $("map");
    if(map){
      map.className = "test2-recruit-choice";
      map.innerHTML = `<section class="test2-recruit-replace-card"><span>⭐ SQUADRA COMPLETA</span><h2>Chi vuoi sostituire?</h2><p>${pending.pokemon.nome} entrerà nella squadra al posto del Pokémon scelto.</p><div>${options.map(option => `<button type="button" onclick="window.confirmTest2RecruitReplacement('${option.key}')"><img src="${sprite(option.pokemon.immagine)}" alt="${option.pokemon.nome}"><span>${option.label}</span><b>${option.pokemon.nome}</b><small>SOSTITUISCI</small></button>`).join("")}</div><button type="button" class="test2-recruit-cancel" onclick="window.rejectRecruitment()">ANNULLA</button></section>`;
    }
    return;
  }

  modal(`
    <div class="recruitment-box recruit-full-team">

      <button
        type="button"
        class="recruit-close-x"
        onclick="window.cancelFullTeamRecruitment()"
      >
        ✕
      </button>

      <h2>
        ⭐ NUOVO POKÉMON
      </h2>

      ${recruitCard(
        pending.pokemon,
        "POKÉMON DA RECLUTARE"
      )}

      <div class="recruit-divider">
        SQUADRA PIENA — SCEGLI CHI SOSTITUIRE
      </div>

      <div class="recruit-options">

        ${
          options.length
            ? options.map(option => `
                <button
                  type="button"
                  class="recruit-option" data-recruit-key="${option.key}"
                  onclick="event.preventDefault(); event.stopPropagation(); window.compareRecruitment('${option.key}');"
                >

                  <img
                    src="${sprite(option.pokemon.immagine)}"
                    alt="${option.pokemon.nome || "Pokémon"}"
                  >

                  <span>
                    <b>
                      ${option.pokemon.nome || "Pokémon"}
                    </b>
                    <small>
                      ${option.label} · LV ${recruitLevel(option.pokemon)}
                    </small>
                  </span>

                  <strong>
                    SOSTITUISCI
                  </strong>

                </button>
              `).join("")
            : `
                <div class="recruit-empty">
                  Nessun Pokémon sostituibile.
                </div>
              `
        }

      </div>

    </div>
  `);
};


window.PokeMisteryRL.Recruitment = { show: window.showRecruitmentPrompt, accept: window.acceptRecruitment, reject: window.rejectRecruitment };
})();

