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

// ── Y la CLAVE con la que se cruza una carta (tanda 349) ──
//
// `normalizarNombre` quita tildes, mayúsculas y espacios de más. No
// tocaba los separadores, y ahí estaba el fallo: **TCGdex llama a las
// megas «Mega-Darkrai ex», con guion, y TCG Live las escribe «Mega
// Darkrai ex», con espacio**. Normalizados dan dos claves distintas, así
// que la fila de `tcg_card_play` existía y la ficha no la encontraba
// NUNCA — sin dar error, y para la era entera.
//
// El guion en el nombre de una carta no significa nada que un espacio no
// signifique (Ho-Oh, Porygon-Z, Mega-Gardevoir): como CLAVE, los dos son
// el mismo hueco. Se separa de `normalizarNombre` porque aquella la usan
// también la Pokédex y el buscador de especies, donde un guion sí puede
// ser parte de un identificador.
export function claveDeCarta(nombre) {
  return normalizarNombre(nombre)
    .replace(/[-–—_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
