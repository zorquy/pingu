// Nombres sin tildes, sin mayúsculas y sin dobles espacios.
//
// Vivía dentro de `js/torneos/arquetipos.js`, y sale aquí en la tanda
// 325 por la misma razón por la que `escapeHtml` salió de `app.js`: la
// ficha de una carta necesita esta función para preguntar por
// `tcg_card_play`, y arrastrar `arquetipos.js` entero le metería la
// Pokédex de 1.025 especies a una página que no pinta ni un sprite.
//
// `arquetipos.js` la reexporta, así que los ficheros que ya la
// importaban de allí siguen funcionando igual.
//
// Y una copia NO valía: la clave de `tcg_card_play` se calcula aquí y
// se calcula en la función que rellena la tabla. Si las dos versiones
// se separaran, la ficha preguntaría por una clave que no existe y el
// bloque de torneos desaparecería sin dar error en ninguna parte.
export function normalizarNombre(nombre) {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
