/* Regola pura: il core decide l'apertura, questa funzione non altera la UI. */
(() => {
  const canOpen = (run, map) => {
    if(run?.mode !== "test2" || run?.battle || run?.test2BackpackAvailable !== true) return false;
    if(!map?.classList.contains("test2-horizontal-map")) return false;
    if(!run?.map?.some(row => row?.some(node => node?.ok === true && !node?.done))) return false;
    // Protegge anche l'istante di transizione in cui l'arena è ancora visibile.
    return !document.querySelector("#bottomContainer .test2-fight-bottom, #bottomContainer #battleFinal, #bottomContainer .bf-field");
  };
  window.PokeMisteryRL.BackpackPolicy = { canOpen };
})();
