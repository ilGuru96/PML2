(() => {
  "use strict";
  const runtime = window.PokeMisteryRLRuntime;
  const modal = html => runtime?.helpers?.modal?.(html);
  const copy = window.PokeMisteryRL_GuideCopy || { it:{} };
  const text = key => copy.it?.[key] || key;
  const sections = Object.freeze({ basics:["start","levels"], combat:["targeting","turns","moves"], team:["formation","health","items"], route:["nodes","shelter","shop","events"] });
  const icons = Object.freeze({ basics:"✦", combat:"⚔", team:"◈", route:"⌘" });
  const categories = Object.freeze(["basics", "combat", "team", "route"]);
  const backButton = action => `<button type="button" class="guide-back" onclick="${action}">${text("back")}</button>`;
  const targetVisual = `<div class="guide-target-visual" aria-label="Schema priorità bersagli"><div class="guide-allies"><i>C1</i><i>C2</i><i>C3</i></div><b>VS</b><div class="guide-enemies"><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i></div></div><ol class="guide-priority"><li><span>C3</span>I nemici colpiscono prima la colonna più a destra.</li><li><span>C2</span>Quando C3 è KO, la priorità passa alla colonna centrale.</li><li><span>C1</span>Quando C2 è KO, resta la colonna sinistra.</li><li><span>→</span>La posizione nella formazione decide il bersaglio.</li></ol>`;
  const nodeVisual = `<ul class="guide-priority guide-node-list"><li><span>⚔</span><b>Fight</b><small>KO normali = +1 livello.</small></li><li><span>♥</span><b>Rifugio</b><small>Cura e cambio tipo mossa.</small></li><li><span>🏪</span><b>Shop</b><small>Oggetti e scaffali persistenti.</small></li><li><span>🥋</span><b>Dojo</b><small>Potenzia una mossa.</small></li><li><span>?</span><b>Evento</b><small>Scelta, aiuto o ricompensa.</small></li><li><span>👹</span><b>Boss</b><small>Chiude il piano.</small></li></ul>`;
  const openGuidePage = (category, page) => {
    const visual = page === "targeting" ? targetVisual : page === "nodes" ? nodeVisual : "";
    modal(`<section class="center guide-panel guide-detail"><header><span>${icons[category] || "✦"} ${text(category)}</span><h2>${text(`${page}Title`)}</h2></header><div class="guide-copy">${visual}<p>${text(`${page}Text`)}</p></div>${backButton(`openGuideCategory('${category}')`)}</section>`);
  };
  const openGuideCategory = category => {
    const pages = sections[category] || [];
    modal(`<section class="center guide-panel guide-category"><header><span>${icons[category] || "✦"} ${text("guide")}</span><h2>${text(category)}</h2></header><div class="guide-page-list">${pages.map((page, index) => `<button type="button" onclick="openGuidePage('${category}','${page}')"><i>${String(index + 1).padStart(2, "0")}</i><span><b>${text(page)}</b><small>${text(`${page}Title`)}</small></span><em>›</em></button>`).join("")}</div>${backButton("openGuideMenu()")}</section>`);
  };
  const openGuideMenu = () => modal(`<section class="center guide-panel guide-home"><header><span>✦ ${text("guide")}</span><h2>${text("choose")}</h2></header><div class="guide-category-list">${categories.map(category => `<button type="button" onclick="openGuideCategory('${category}')"><i>${icons[category]}</i><span><b>${text(category)}</b><small>${text(`${category}Hint`)}</small></span><em>›</em></button>`).join("")}</div>${backButton("openHomeMenu()")}</section>`);
  const api = { openGuideMenu, openGuideCategory, openGuidePage, showBattleGuide:openGuideMenu };
  Object.assign(window.PokeMisteryRL?.Run || {}, api);
  Object.assign(window, api);
  window.PokeMisteryRL.Guides = { sections, icons, categories };
})();
