# Runtime condiviso

I sistemi esterni devono usare `window.PokeMisteryRL.Runtime` invece delle variabili locali di `core.js`.

- `runtime.run`: stato vivo della run, leggibile e scrivibile.
- `runtime.busy`: blocco input della run.
- `runtime.helpers`: DOM, sprite, messaggi, modali e helper comuni.
- `runtime.getMap()` / `runtime.getBottom()`: superfici della run.
- `runtime.isTest2()`: modalità corrente.
- `runtime.invoke(nome, ...argomenti)`: invoca un'azione pubblica del core.

I moduli si caricano dopo `core.js` e possono aggiungere le proprie API a `window.PokeMisteryRL`.

La guida è il primo esempio completo: `features/guide-ui.js` usa soltanto il Runtime, la copia in `texts.js` e le funzioni pubbliche della run.

Vedi anche `CORE-BOUNDARIES.md` per l'ordine delle prossime estrazioni.
