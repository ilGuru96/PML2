/*
 * Contratto visivo Test2.
 * Qui vivono le coordinate e gli asset dello scenario: il core usa soltanto
 * questi dati, senza più possedere i valori di layout.
 */
window.PokeMisteryRL ||= {};
window.PokeMisteryRL.SceneLayout = {
  buildings: {
    dojo: { asset:"./img/scenes/forest-dojo.png", label:"Dojo", x:92, y:43, size:70, flip:false },
    bazar: { asset:"./img/scenes/forest-stall.png", label:"Bancarella", x:84, y:48, size:40, flip:true },
    campeggio: { asset:"./img/scenes/forest-refuge.png", label:"Rifugio", x:86, y:42, size:52, flip:true }
  },
  playerGrid: [
    [40, 50], [115, 50], [190, 50],
    [35, 125], [113, 122], [193, 129],
    [43, 201], [118, 198], [189, 205]
  ],
  enemyGridOffset: 10
};
