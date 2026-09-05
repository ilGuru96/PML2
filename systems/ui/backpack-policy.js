/* Regole di accesso allo zaino: non conosce né modifica scene, HUD o mappa. */
(() => {
  const canOpen = (run, map) => {
    // Il flag precedente poteva restare bloccato dopo una ricompensa.
    // La fonte affidabile è lo stato vivo dell'evento: battaglia o azione occupata.
    if(run?.mode !== "test2" || run?.battle) return false;
    return !!map;
  };
  window.PokeMisteryRL.BackpackPolicy = { canOpen };
  // Il bottone usa un collegamento diretto al modulo UI: non dipende dal
  // vecchio toggle globale, che può essere sovrascritto da script legacy.
  const bindBackpackButton = () => {
    const button = document.getElementById("mapBackpackButton");
    if(!button) return;
    button.onclick = event => {
      event.preventDefault();
      window.PokeMisteryRL?.UI?.openTestBackpack?.();
    };
  };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindBackpackButton, {once:true});
  else bindBackpackButton();
})();
