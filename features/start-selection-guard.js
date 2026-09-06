/* Protezione UI esterna per la scelta iniziale.
   Il core valida ID e stato; qui vengono bloccati fondale e click residui. */
(function(){
  "use strict";
  if(window.__startSelectionBackdropGuard) return;
  window.__startSelectionBackdropGuard = true;
  const blockOutsideChoice = event => {
    const phase = window.PKM_RUN?.startSelection?.phase;
    if(phase !== "starter" && phase !== "companions") return;
    const map = document.getElementById("map");
    const expected = phase === "starter" ? "test2-starter-choice-map" : "test2-companion-choice-map";
    if(!map?.classList.contains(expected)) return;
    const button = event.target instanceof Element ? event.target.closest("button[data-start-choice]") : null;
    if(button?.dataset.startChoice === phase) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  // window in cattura precede document e qualsiasi handler globale del gioco.
  // Protegge l'intera sequenza del tap, non soltanto l'evento click finale.
  ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click"]
    .forEach(type => window.addEventListener(type, blockOutsideChoice, true));

  // La selezione è bloccante: render, resize o altri eventi non possono
  // sostituire la schermata. Rimane finché non viene scelta una carta valida.
  let restoreQueued = false;
  const restoreChoiceIfNeeded = () => {
    restoreQueued = false;
    const run = window.PKM_RUN;
    const phase = run?.startSelection?.phase;
    if(phase !== "starter" && phase !== "companions") return;

    const map = document.getElementById("map");
    const expected = phase === "starter" ? "test2-starter-choice-map" : "test2-companion-choice-map";
    const selector = phase === "starter" ? 'button[data-start-choice="starter"]' : 'button[data-start-choice="companions"]';
    const previewPresent = phase !== "starter" || !!document.getElementById("test2StarterPreview");
    if(map?.classList.contains(expected) && map.querySelector(selector) && previewPresent) return;

    const progress = window.PokeMisteryRL?.Progress;
    if(phase === "starter"){
      progress?.openStartingStarterChoice?.();
      return;
    }
    const node = (run.map || []).flat().find(entry => entry.id === run.startSelection.nodeId);
    if(node) progress?.openStartingPartnerChoice?.(node);
  };
  const requestRestore = () => {
    if(restoreQueued) return;
    restoreQueued = true;
    setTimeout(restoreChoiceIfNeeded, 0);
  };
  new MutationObserver(requestRestore).observe(document.documentElement, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:["class"]
  });
  window.addEventListener("resize", requestRestore);
})();
