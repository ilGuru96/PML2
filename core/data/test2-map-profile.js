/* Profilo puro della mappa Test2: nessun accesso al DOM o allo stato della run. */
(() => {
  // Questo file viene caricato prima del core: prepara il namespace invece
  // di assumere che sia stato già creato da un altro modulo.
  window.PokeMisteryRL ||= {};
  const layout = Object.freeze([1, 2, 3, 3, 3, 3, 2, 1]);
  const buildNodeTypes = ({ floor = 1, random = Math.random } = {}) => {
    const choose = choices => choices[Math.floor(random() * choices.length)];
    const rows = layout.map(count => Array(count).fill("fight"));
    rows[0][0] = Number(floor) === 1 ? "free" : "shop";
    rows[1] = rows[1].map(() => choose(["fight", "event"]));
    rows[2] = rows[2].map(() => choose(["fight", "event", "skill"]));
    rows[3].fill("fight");
    rows[3][Math.floor(random() * rows[3].length)] = "shop";
    rows[4] = rows[4].map(() => choose(["fight", "event", "skill"]));
    rows[5] = rows[5].map(() => choose(["fight", "event"]));
    rows[6].fill("rifugio");
    rows[layout.length - 1][0] = "boss";
    return rows;
  };
  window.PokeMisteryRL.Test2MapProfile = { layout, buildNodeTypes };
})();
