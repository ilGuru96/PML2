(() => {
  "use strict";
  const runtime = window.PokeMisteryRLRuntime;
  const { $, sprite, msg, modal, closeModal } = runtime.helpers;
  const isTest2Mode = () => runtime.isTest2();
  const next = (...args) => window.next?.(...args);
  const fight = (...args) => window.PokeMisteryRL?.Battle?.fight?.(...args);
  const refreshBottomPanel = (...args) => window.refreshBottomPanel?.(...args);
  const getTypingBadge = type => window.PokeMisteryRL?.Types?.getTypingBadge?.(type) || type;
const shop = () => {

  if(!runtime.run){
    return;
  }
  if(isTest2Mode()){
    runtime.run.test2Scene = "bazar";
    runtime.run.test2SceneBuildingHidden ||= {};
    delete runtime.run.test2SceneBuildingHidden.bazar;
    refreshBottomPanel();
  }

  const db =
    window.PokeMisteryRL_Items?.DB_ITEMS ||
    window.DB_ITEMS ||
    null;

  const items =
    db && typeof db === "object"
      ? Object.values(db).filter(item => item && item.id)
      : [];

  if(!items.length){
    modal(`
      <div class="center">
        <h2>🛒 NEGOZIO</h2>
        <p>Il database oggetti non è ancora disponibile.</p>
        <button onclick="next('Negozio non disponibile')">
          CONTINUA
        </button>
      </div>
    `);
    return;
  }

  const rarityPrice = {
    comune: 50,
    non_comune: 100,
    rara: 175,
    epica: 300,
    leggendaria: 500
  };

  if(runtime.run.kecleonDefeated && (!Array.isArray(runtime.run.kecleonFreeOffers) || !runtime.run.kecleonFreeOffers.length)){
    if(isTest2Mode()){
      const bottom = $("bottomCampagna");
      const map = $("map");
      bottom?.querySelectorAll(".test2-shop-kecleon,.test2-kecleon-bubble").forEach(entry => entry.remove());
      if(map){
        map.className = "test2-shop-map";
        map.innerHTML = `<section class="test2-shop-panel test2-shop-empty-panel"><header><span>🏪 NEGOZIO</span><button type="button" class="test2-shop-close" aria-label="Esci dal negozio" onclick="next('Negozio vuoto')">×</button></header><small>SOLD OUT</small><div class="test2-shop-empty-copy"><b>SOLD OUT</b><span>Hai preso tutti gli oggetti rimasti.</span></div></section>`;
      }
      return;
    }
    modal(`<div class="center shop-box shop-empty"><div class="shop-header"><div class="shop-header-copy"><h2>🛒 NEGOZIO</h2><span>SOLD OUT</span></div><div class="shop-wallet">💰 <b>${Number(runtime.run.bits) || 0}</b></div></div><p>Hai preso tutti gli oggetti rimasti.</p><button type="button" onclick="next('Negozio vuoto')">ESCI</button></div>`);
    return;
  }

  // Gli scaffali sono persistenti per tutta la run: tornare dal dettaglio
  // non li rimescola. Soltanto uno slot acquistato viene rifornito.
  const savedOffers = Array.isArray(runtime.run.shopOffers) ? runtime.run.shopOffers : [];
  const offers = runtime.run.kecleonDefeated
    ? (Array.isArray(runtime.run.kecleonFreeOffers)
      ? runtime.run.kecleonFreeOffers.map(entry => ({ item: items.find(item => String(item.id) === String(entry.id)), price:0 })).filter(entry => entry.item)
      : [])
    : savedOffers.map(entry => ({ item: items.find(item => String(item.id) === String(entry.id)), price:Number(entry.price) || 0 })).filter(entry => entry.item);
  const shownIds = new Set(offers.map(entry => String(entry.item.id)));
  const pool = items.filter(item => !shownIds.has(String(item.id)));
  const theftAttempts = Math.max(
    0,
    Number(runtime.run.shopTheftAttempts ?? runtime.run.shopThefts) || 0
  );
  const kecleonWarning =
    theftAttempts <= 0 ? "Kecleon ti osserva..." :
    theftAttempts === 1 ? "Kecleon ti osserva...  ..." :
    theftAttempts === 2 ? "Kecleon ti osserva...  ... ..." :
    "Kecleon pare scocciato";

  while(!runtime.run.kecleonDefeated && pool.length && offers.length < 8){
    const index =
      Math.floor(Math.random() * pool.length);

    const item =
      pool.splice(index,1)[0];

    offers.push({
      item,
      price:
        rarityPrice[item.rarita] ??
        rarityPrice.comune
    });
  }

  if(!runtime.run.kecleonDefeated){
    runtime.run.shopOffers = offers.map(({item, price}) => ({ id:item.id, price }));
    runtime.run.lastShopOffers = runtime.run.shopOffers.map(entry => ({ ...entry }));
  }

  // Test2: Kecleon entra nella scena; gli scaffali sostituiscono la mappa.
  if(isTest2Mode()){
    const bottom = $("bottomCampagna");
    const map = $("map");
    if(bottom){
      // Il negozio non eredita mai personaggi o sprite della scena precedente.
      bottom.querySelectorAll(".test2-enemy-formation,.test2-toll-group,.test2-recruit-candidate,.test2-dojo-challenger,.test2-shop-kecleon,.test2-kecleon,.test2-kecleon-bubble").forEach(entry => entry.remove());
      if(!runtime.run.kecleonDefeated){
        bottom.insertAdjacentHTML("beforeend", `<img class="test2-shop-kecleon" src="${sprite("kecleon.png")}" alt="Kecleon">`);
        const warning = theftAttempts ? ["Ehi! Quello è mio!", "Ti sto osservando…", "Ultimo avvertimento!"][Math.min(2,theftAttempts - 1)] : "";
        if(warning) bottom.insertAdjacentHTML("beforeend", `<span class="test2-kecleon-bubble">${warning}</span>`);
      }
    }
    if(map){
      map.className = "test2-shop-map";
      map.innerHTML = `<section class="test2-shop-panel"><header><span>🏪 NEGOZIO</span><button type="button" class="test2-shop-close" aria-label="Esci dal negozio" onclick="next('Negozio visitato')">×</button></header><small>Scegli un oggetto</small><div class="test2-shop-grid">${offers.map(({item,price}) => `<button type="button" class="test2-shop-item" onclick="openShopItemDetail('${String(item.id).replace(/'/g,"\\'")}',${price})"><img src="${item.immagine || ""}" alt="${item.nome || item.id}"><b>${item.nome || item.id}</b><em>${runtime.run?.kecleonDefeated ? "GRATIS" : `💰 ${price}`}</em></button>`).join("")}</div></section>`;
    }
    return;
  }

  const abandonedShop = !!runtime.run.kecleonDefeated;
  modal(`
    <div class="center shop-box shop-rework">
      <div class="shop-stage">
        <header class="shop-header">
          <div class="shopkeeper-frame">${abandonedShop ? "" : `<img src="${sprite("kecleon.png")}" alt="Kecleon" class="shopkeeper-sprite shopkeeper-warning-${Math.min(3, theftAttempts)}">`}</div>
          <div class="shop-header-copy">
            <small class="shop-eyebrow">BOTTEGA DI KECLEON</small>
            <h2>NEGOZIO</h2>
            <span>${abandonedShop ? "Gli oggetti rimasti sono gratis." : kecleonWarning}</span>
          </div>
          <div class="shop-wallet"><small>PORTAFOGLIO</small><b>💰 ${Number(runtime.run.bits) || 0}</b></div>
        </header>

        <section class="shop-shelves">
          <div class="shop-shelves-title"><span>SCAFFALI</span><small>Seleziona un oggetto</small></div>
          <div class="shop-list">
        ${
          offers.map(({item,price}) => `
            <button type="button" class="shop-card" onclick="openShopItemDetail('${String(item.id).replace(/'/g,"\\'")}',${price})" aria-label="Dettagli ${item.nome || item.id}">
              <span class="shop-icon">
                ${item.immagine ? `<img src="${item.immagine}" alt="${item.nome || item.id}">` : (item.icon || "◈")}
              </span>
              <b class="shop-name">${item.nome || item.id}</b>
            </button>
          `).join("")
        }${!offers.length ? `<p class="shop-no-offers">Non è rimasto alcun oggetto.</p>` : ""}
          </div>
        </section>

        <button type="button" class="shop-leave" onclick="next('Negozio visitato')">ESCI DAL NEGOZIO</button>
      </div>
    </div>
  `);
};

const openShopItemDetail = (itemId, price) => {
  const db = window.PokeMisteryRL_Items?.DB_ITEMS || window.DB_ITEMS || {};
  const item = db[itemId];
  if(!item) return false;
  const effect = item.tipo === "potenziamento_tipo"
    ? `DMG ${getTypingBadge(item.tipo_mossa)} <b>×${(1 + (Number(item.bonus_danno) || 0)).toFixed(2)}</b>`
    : (item.effetto || "Nessuna descrizione.");
  if(isTest2Mode()){
    const map = $("map");
    if(map){
      map.querySelector(".test2-shop-panel")?.classList.add("is-blurred");
      map.querySelector(".test2-shop-detail")?.remove();
      map.insertAdjacentHTML("beforeend", `<section class="test2-shop-detail"><div class="test2-shop-detail-main"><div class="test2-shop-detail-icon">${item.immagine ? `<img src="${item.immagine}" alt="${item.nome}">` : "◈"}</div><div class="test2-shop-detail-info"><span>OGGETTO</span><h2>${item.nome}</h2><p>${effect}</p><strong>${runtime.run?.kecleonDefeated ? "GRATIS" : `💰 ${price}`}</strong></div></div><div class="test2-shop-detail-actions"><button onclick="buyShopItem('${String(item.id).replace(/'/g,"\\'")}',${price})">${runtime.run?.kecleonDefeated ? "PRENDI" : "COMPRA"}</button>${runtime.run?.kecleonDefeated ? "" : `<button class="test2-shop-steal" onclick="stealShopItem('${String(item.id).replace(/'/g,"\\'")}')">RUBA</button>`}</div><button class="test2-shop-detail-back" onclick="shop()">← SCAFFALI</button></section>`);
    }
    return true;
  }
  modal(`<div class="center shop-item-modal"><small class="shop-item-kicker">DETTAGLI OGGETTO</small><div class="shop-item-modal-icon">${item.immagine ? `<img src="${item.immagine}" alt="${item.nome}">` : "◈"}</div><h2>${item.nome}</h2><p>${effect}</p><div class="shop-item-cost"><span>PREZZO</span><b>💰 ${price}</b></div><div class="shop-actions"><button type="button" onclick="buyShopItem('${String(item.id).replace(/'/g,"\\'")}',${price})">${runtime.run?.kecleonDefeated ? "PRENDI" : "COMPRA"}</button>${runtime.run?.kecleonDefeated ? "" : `<button type="button" class="shop-steal-btn" onclick="stealShopItem('${String(item.id).replace(/'/g,"\\'")}')">RUBA</button>`}</div><button type="button" onclick="shop()">← TORNA AGLI SCAFFALI</button></div>`);
  return true;
};
window.openShopItemDetail = openShopItemDetail;

const buyShopItem = (itemId, price) => {

  if(!runtime.run){
    return false;
  }

  const db =
    window.PokeMisteryRL_Items ||
    null;

  const item =
    db?.get?.(itemId) ||
    window.DB_ITEMS?.[itemId] ||
    null;

  if(!item){
    msg("Oggetto non disponibile.");
    return false;
  }

  const cost =
    Math.max(0, Math.floor(Number(price) || 0));

  const money =
    Math.max(0, Math.floor(Number(runtime.run.bits) || 0));

  if(money < cost){
    msg(`Servono ${cost} 💰.`);
    return false;
  }

  if(!Array.isArray(runtime.run.items)){
    runtime.run.items = [];
  }

  const existing =
    runtime.run.items.find(
      entry =>
        entry &&
        String(entry.id) === String(item.id)
    );

  if(existing){
    existing.qty =
      Math.max(0, Number(existing.qty) || 0) + 1;
  }else{
    runtime.run.items.push({
      id: item.id,
      qty: 1
    });
  }

  runtime.run.bits =
    money - cost;

  if(runtime.run.kecleonDefeated && cost === 0 && Array.isArray(runtime.run.kecleonFreeOffers)){
    runtime.run.kecleonFreeOffers = runtime.run.kecleonFreeOffers.filter(entry => String(entry.id) !== String(item.id));
    if(!runtime.run.kecleonFreeOffers.length) runtime.run.kecleonFreeShopOpen = false;
  }else if(!runtime.run.kecleonDefeated && Array.isArray(runtime.run.shopOffers)){
    // Rimuove soltanto lo slot comprato: shop() lo riempirà con un nuovo item.
    const slot = runtime.run.shopOffers.findIndex(entry => String(entry?.id) === String(item.id));
    if(slot >= 0) runtime.run.shopOffers.splice(slot, 1);
  }

  refreshBottomPanel();

  msg(`🛒 ${item.nome} acquistato!`);

  shop();

  return true;
};

window.shop = shop;
window.buyShopItem = buyShopItem;

const stealShopItem = (itemId) => {
  if(!runtime.run) return false;
  const attempts = Math.max(
    0,
    Number(runtime.run.shopTheftAttempts ?? runtime.run.shopThefts) || 0
  );
  // Il quarto tentativo chiama immediatamente Kecleon alla lotta.
  if(attempts >= 3){
    runtime.run.shopTheftAttempts = attempts + 1;
    runtime.run.afterBattleNodeType = "shop";
    if(isTest2Mode()){
      const map = $("map");
      if(map){
        map.querySelector(".test2-shop-detail")?.remove();
        map.querySelector(".test2-shop-panel")?.classList.remove("is-blurred");
        map.classList.add("test2-shop-locked");
        map.querySelector(".test2-shop-lock-overlay")?.remove();
        map.insertAdjacentHTML("beforeend", `<section class="test2-shop-lock-overlay"><span>⚠ NEGOZIO BLOCCATO</span><h2>Kecleon ti affronta!</h2><p>Gli scaffali resteranno chiusi fino alla fine dello scontro.</p></section>`);
      }
    }
    closeModal();
    runtime.busy = 1;
    fight(false);
    return true;
  }

  const db = window.PokeMisteryRL_Items || null;
  const item = db?.get?.(itemId) || window.DB_ITEMS?.[itemId] || null;
  if(!item){ msg("Oggetto non disponibile."); return false; }
  const successChance = [1, .75, .50][attempts] ?? 0;
  runtime.run.shopTheftAttempts = attempts + 1;
  if(Math.random() > successChance){
    msg(`🚨 Kecleon ti ferma: non riesci a rubare ${item.nome}.`);
    shop();
    return false;
  }
  if(!Array.isArray(runtime.run.items)) runtime.run.items = [];
  const existing = runtime.run.items.find(entry => entry && String(entry.id) === String(item.id));
  if(existing) existing.qty = Math.max(0, Number(existing.qty) || 0) + 1;
  else runtime.run.items.push({ id:item.id, qty:1 });
  if(!runtime.run.kecleonDefeated && Array.isArray(runtime.run.shopOffers)){
    const slot = runtime.run.shopOffers.findIndex(entry => String(entry?.id) === String(item.id));
    if(slot >= 0) runtime.run.shopOffers.splice(slot, 1);
  }
  refreshBottomPanel();
  msg(`🕵️ Hai rubato ${item.nome}!`);
  shop();
  return true;
};

window.stealShopItem = stealShopItem;
window.PokeMisteryRL.Shop = { open: window.shop, details: window.openShopItemDetail, buy: window.buyShopItem, steal: window.stealShopItem };
})();
