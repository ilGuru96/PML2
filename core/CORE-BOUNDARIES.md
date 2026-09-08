# Confini del core

`core.js` conserva soltanto ciò che deve coordinare il gioco: stato della run, database Pokémon, mappa, progressione, battaglia e bootstrap.

## Già fuori dal core

- `data/modes.js`: modalità di gioco.
- `data/config.js`: configurazione condivisa, inclusa la sorgente degli sprite.
- `data/test2-map-profile.js`: struttura e distribuzione nodi della mappa Test2.
- `data/items.js` e `systems/items/item-effects.js`: catalogo e effetti oggetti.
- `systems/level-system.js` e `systems/skill-system.js`: calcoli di livello e mosse.
- `systems/ui/backpack-policy.js`: quando lo zaino è utilizzabile.
- `features/boss-waves.js`: composizione delle ondate boss.
- `features/type-cards.js`: ricompense carte tipo e relativo raccoglitore.
- `features/guide-ui.js`: menu e pagine della guida.
- `features/shop.js`: assortimento, dettagli, acquisto e furto da Kecleon.

## Prossime estrazioni, nell'ordine sicuro

1. Rifugio e Dojo: flussi di cura, reroll e premio.
2. Team ed evoluzioni.

Battaglia, mappa e progressione restano nel core finché le API del Runtime non coprono tutte le loro dipendenze: sono il cuore del flusso e separarli ora sarebbe rischioso.

## Regola per ogni nuovo modulo

Un modulo non deve leggere variabili locali di `core.js`. Usa `window.PokeMisteryRL.Runtime`, riceve parametri espliciti oppure espone una piccola API su `window.PokeMisteryRL`.
