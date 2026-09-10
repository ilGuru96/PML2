/* Touch drag condiviso per zaino e formazione Test2.
   Mantiene qui la gestione puntatore, mentre il core conserva soltanto le
   regole di gioco (equipaggiamento e posizionamento). */
(() => {
  const state = { scene:null, formation:null };
  const targetsAt = (x, y, selector) => (document.elementsFromPoint?.(x, y) || [document.elementFromPoint(x, y)])
    .map(node => node?.closest?.(selector)).find(Boolean) || null;
  const clear = (selector, className) => document.querySelectorAll(`${selector}.${className}`).forEach(node => node.classList.remove(className));
  const isDrag = (drag, event) => drag?.dragging || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 8;

  const sceneTarget = (x, y) => {
    const target = targetsAt(x, y, "[data-scene-item-target]");
    clear("[data-scene-item-target]", "scene-item-drop-target");
    target?.classList.add("scene-item-drop-target");
    return target;
  };
  const formationTarget = (x, y) => {
    const target = targetsAt(x, y, "[data-formation-position]");
    clear("[data-formation-position]", "test2-formation-drop-target");
    target?.classList.add("test2-formation-drop-target");
    return target;
  };
  const resetScene = () => { state.scene = null; clear("[data-scene-item-target]", "scene-item-drop-target"); };
  const resetFormation = () => { state.formation = null; clear("[data-formation-position]", "test2-formation-drop-target"); };

  window.PokeMisteryRL ||= {};
  window.PokeMisteryRL.MobileDragControls = {
    startScene(event, itemId){
      if(event.pointerType === "mouse") return;
      state.scene = {itemId, pointerId:event.pointerId, x:event.clientX, y:event.clientY, dragging:false};
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    },
    moveScene(event){
      const drag = state.scene;
      if(!drag || drag.pointerId !== event.pointerId) return;
      if(!isDrag(drag, event)) return;
      drag.dragging = true;
      event.preventDefault();
      sceneTarget(event.clientX, event.clientY);
    },
    endScene(event){
      const drag = state.scene;
      if(!drag || drag.pointerId !== event.pointerId) return false;
      const target = sceneTarget(event.clientX, event.clientY);
      resetScene();
      if(!drag.dragging || !target) return false;
      event.preventDefault();
      return window.PokeMisteryRL.UI?.applyTest2BackpackItem?.(drag.itemId, Number(target.dataset.sceneItemTarget)) || false;
    },
    cancelScene(event){ if(state.scene?.pointerId === event.pointerId) resetScene(); },
    startFormation(event, source){
      if(event.pointerType === "mouse") return;
      state.formation = {source:Number(source), pointerId:event.pointerId, x:event.clientX, y:event.clientY, dragging:false};
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    },
    moveFormation(event){
      const drag = state.formation;
      if(!drag || drag.pointerId !== event.pointerId) return;
      if(!isDrag(drag, event)) return;
      drag.dragging = true;
      event.preventDefault();
      formationTarget(event.clientX, event.clientY);
    },
    endFormation(event){
      const drag = state.formation;
      if(!drag || drag.pointerId !== event.pointerId) return false;
      const target = formationTarget(event.clientX, event.clientY);
      resetFormation();
      if(!drag.dragging || !target) return false;
      event.preventDefault();
      return window.PokeMisteryRL.UI?.placeTest2FormationFromSource?.(drag.source, Number(target.dataset.formationPosition)) || false;
    },
    cancelFormation(event){ if(state.formation?.pointerId === event.pointerId) resetFormation(); }
  };

  document.addEventListener("pointermove", event => {
    window.PokeMisteryRL.MobileDragControls.moveScene(event);
    window.PokeMisteryRL.MobileDragControls.moveFormation(event);
  }, {passive:false});
  document.addEventListener("pointerup", event => {
    window.PokeMisteryRL.MobileDragControls.endScene(event);
    window.PokeMisteryRL.MobileDragControls.endFormation(event);
  }, {passive:false});
  document.addEventListener("pointercancel", event => {
    window.PokeMisteryRL.MobileDragControls.cancelScene(event);
    window.PokeMisteryRL.MobileDragControls.cancelFormation(event);
  }, {passive:true});
})();
