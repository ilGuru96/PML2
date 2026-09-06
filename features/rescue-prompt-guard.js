/* Mantiene visibile la richiesta di soccorso fino a una decisione esplicita. */
(function(){
  "use strict";
  if(window.__rescuePromptGuardInstalled) return;
  window.__rescuePromptGuardInstalled = true;

  let queued = false;
  const restore = () => {
    queued = false;
    const run = window.PKM_RUN;
    if(!run?.hiddenRescuePrompt) return;
    const map = document.getElementById("map");
    if(map?.classList.contains("test2-rescue-prompt-map") && map.querySelector(".test2-rescue-prompt-panel")) return;
    window.PokeMisteryRL?.Progress?.openHiddenPassage?.();
  };
  const queueRestore = () => {
    if(queued) return;
    queued = true;
    setTimeout(restore, 0);
  };
  new MutationObserver(queueRestore).observe(document.documentElement, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:["class"]
  });
  window.addEventListener("resize", queueRestore);
})();
