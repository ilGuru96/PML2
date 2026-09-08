/* Punto d'ingresso unico per i click della mappa. */
window.PokeMisteryRL ||= {};
window.PokeMisteryRL.NodeFlow = (() => {
  const getRun = () => window.PokeMisteryRL.Runtime?.run || null;
  const isCurrentOpenNode = node =>
    node?.row === getRun()?.row &&
    node?.col === getRun()?.col &&
    !node?.done;

  const canSelect = node => !!node && !getRun()?.dead && (node.ok === true || isCurrentOpenNode(node));

  const select = node => {
    if(!canSelect(node)) return false;
    return window.PokeMisteryRL.Progress?.pick?.(node) ?? false;
  };

  return { canSelect, select };
})();
