(() => {
  const TYPE_CHART = Object.freeze({
    normale:{}, fuoco:{erba:2,ghiaccio:2,coleottero:2,acciaio:2,fuoco:.5,acqua:.5,roccia:.5,drago:.5}, acqua:{fuoco:2,terra:2,roccia:2,acqua:.5,erba:.5,drago:.5}, erba:{acqua:2,terra:2,roccia:2,fuoco:.5,erba:.5,veleno:.5,volante:.5,coleottero:.5,drago:.5,acciaio:.5}, elettro:{acqua:2,volante:2,erba:.5,elettro:.5,drago:.5,terra:0}, ghiaccio:{erba:2,terra:2,volante:2,drago:2,fuoco:.5,acqua:.5,ghiaccio:.5,acciaio:.5}, lotta:{normale:2,ghiaccio:2,roccia:2,buio:2,acciaio:2,veleno:.5,volante:.5,psico:.5,coleottero:.5,folletto:.5,spettro:0}, veleno:{erba:2,folletto:2,veleno:.5,terra:.5,roccia:.5,spettro:.5,acciaio:0}, terra:{fuoco:2,elettro:2,veleno:2,roccia:2,acciaio:2,erba:.5,coleottero:.5,volante:0}, volante:{erba:2,lotta:2,coleottero:2,elettro:.5,roccia:.5,acciaio:.5}, psico:{lotta:2,veleno:2,psico:.5,acciaio:.5,buio:0}, coleottero:{erba:2,psico:2,buio:2,fuoco:.5,lotta:.5,volante:.5,spettro:.5,acciaio:.5,folletto:.5}, roccia:{fuoco:2,ghiaccio:2,volante:2,coleottero:2,lotta:.5,terra:.5,acciaio:.5}, spettro:{psico:2,spettro:2,buio:.5,normale:0}, drago:{drago:2,acciaio:.5,folletto:0}, buio:{psico:2,spettro:2,lotta:.5,buio:.5,folletto:.5}, acciaio:{ghiaccio:2,roccia:2,folletto:2,fuoco:.5,acqua:.5,elettro:.5,acciaio:.5}, folletto:{lotta:2,drago:2,buio:2,fuoco:.5,veleno:.5,acciaio:.5}
  });
  const getPokemonTypes = pokemon => !pokemon ? [] : Array.isArray(pokemon.tipi) ? pokemon.tipi.map(type => String(type).trim().toLowerCase()).filter(Boolean) : [];
  const getTypeMultiplier = (attackType, defendTypes) => {
    if(!attackType || !Array.isArray(defendTypes)) return 1;
    const chart = TYPE_CHART[String(attackType).trim().toLowerCase()];
    return chart ? defendTypes.reduce((multiplier, type) => multiplier * (chart[String(type).trim().toLowerCase()] ?? 1), 1) : 1;
  };
  const getMultLabel = multiplier => multiplier === 0 ? "INEFFICACE" : multiplier >= 2 ? "SUPEREFFICACE" : multiplier <= .5 ? "POCO EFFICACE" : "";
  const getTypingBadge = type => {
    const key = String(type || "").trim().toLowerCase();
    const colors = {normale:"#d2d2bdff",fuoco:"#F08030",acqua:"#6890F0",erba:"#78C850",elettro:"#F8D030",ghiaccio:"#98D8D8",lotta:"#C03028",veleno:"#A040A0",terra:"#E0C068",volante:"#A890F0",psico:"#F85888",coleottero:"#A8B820",roccia:"#B8A038",spettro:"#705898",drago:"#7038F8",buio:"#705848",acciaio:"#B8B8D0",folletto:"#EE99AC"};
    return key ? `<span class="type-badge type-${key}" style="background:${colors[key] || "#555"}">${key.toUpperCase()}</span>` : "";
  };
  window.PokeMisteryRL_Types = { TYPE_CHART, getPokemonTypes, getTypeMultiplier, getMultLabel, getTypingBadge };
})();
