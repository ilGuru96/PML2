/* Optional feature: end-of-floor type cards. Not used by the core run. */
(function(){
  "use strict";
  const cards = {
    fuoco:["Braci Vive","+10% danno Fuoco","+20% danno e bruciatura"], acqua:["Marea Salva","Cura 4% HP","Cura 8% HP"], erba:["Radici Profonde","Cura 2% HP","Cura 4% HP"], elettro:["Scossa Paralizzante","Stordisce","Fa perdere il turno"], normale:["Colpo Jolly","+10% danno","+20% danno"], volante:["Passo di Vento","+10% evasione","+25% evasione"], veleno:["Tossina Persistente","Applica veleno","Si diffonde al KO"], terra:["Fango Frenante","Applica SPD ↓","Rallenta del 40%"], roccia:["Corazza di Pietra","-8% danni","-15% danni e riflesso"], lotta:["Ritmo da Combattimento","Terzo colpo +30%","Terzo colpo +70%"], psico:["Mente Accelerata","15% doppio colpo","30% doppio colpo"], buio:["Colpo di Grazia","+25% sotto 50% HP","+60% sotto 50% HP"], spettro:["Ritorsione Oscura","Riflette 10%","Riflette 25% e maledice"], acciaio:["Guardia Ferrea","-10% danni","-20% danni e scudo"], ghiaccio:["Morso Gelido","Rallenta","+15% danni ai rallentati"], drago:["Soffio Travolgente","25% al nemico dietro","50% al nemico dietro"], folletto:["Luce Curativa","Cure +20%","Cure +40%"], coleottero:["Sciame di Riserva","Clone verde 30% HP","Clone verde 70% HP"]
  };
  const run = () => window.PKM_RUN;
  const level = type => run()?.mode === "test2" ? Math.min(10, Number(run()?.typeCards?.[type]) || 0) : 0;
  const has = (type, min = 1) => level(type) >= min;
  const badge = type => window.PokeMisteryRL?.Types?.getTypingBadge?.(type) || type;
  const collector = () => Object.entries(run()?.typeCards || {}).filter(([, value]) => value > 0).map(([type, value]) => `<div class="type-card-collector-entry" title="${cards[type]?.[0] || type} · LIV ${Math.min(10,value)}">${badge(type)}<b>×${Math.min(10,value)}</b></div>`).join("") || "<small>Nessuna carta raccolta</small>";
  const draw = () => Object.keys(cards).sort(() => Math.random() - .5).slice(0,3);
  const show = () => {
    if(run()?.mode !== "test2") return false;
    const choices = draw();
    window.PokeMisteryRL?.Helpers?.modal?.(`<div class="center floor-upgrade-modal"><span>FINE PIANO</span><h2>Scegli una carta</h2><div class="floor-collector"><b>RACCOGLITORE CARTE</b><div>${collector()}</div></div><div class="floor-upgrade-cards">${choices.map(type => { const card = cards[type]; const nextLevel = Math.min(10, level(type) + 1); return `<button type="button" class="floor-upgrade-card ${type}" onclick="chooseTypeCard('${type}')"><strong>${badge(type)}</strong><b>${card[0]}</b><small>LIV ${nextLevel} · ${nextLevel === 1 ? card[1] : card[2]}</small></button>`; }).join("")}</div><div class="type-card-choice-actions"><button type="button" onclick="rerollTypeCards()">↻ REROLL</button><button type="button" onclick="skipTypeCards()">SALTA</button></div></div>`);
    return true;
  };
  const choose = type => {
    if(!cards[type] || run()?.mode !== "test2") return false;
    run().typeCards ||= {}; run().typeCards[type] = Math.min(10, level(type) + 1);
    window.PokeMisteryRL?.UI?.refreshBottomPanel?.();
    window.PokeMisteryRL?.Progress?.next?.(`${cards[type][0]} · LIV ${level(type)} acquisita.`);
    return true;
  };
  const openCollector = () => window.PokeMisteryRL?.Helpers?.modal?.(`<div class="center floor-upgrade-modal collector-view"><span>BONUS DELLA RUN</span><h2>Carte raccolte</h2><div class="floor-collector"><div>${collector()}</div></div><button type="button" onclick="PokeMisteryRL.Helpers.closeModal()">CHIUDI</button></div>`);
  window.PokeMisteryRL ||= {}; window.PokeMisteryRL.TypeCards = {cards, level, has, show, choose, openCollector};
  window.chooseTypeCard = choose; window.rerollTypeCards = show; window.skipTypeCards = () => window.PokeMisteryRL?.Progress?.next?.("Nessuna carta scelta."); window.openFloorUpgradeCollector = openCollector;
})();
