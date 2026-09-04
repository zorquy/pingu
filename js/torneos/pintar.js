// Pintar SOLO lo que ha cambiado (tanda 259).
//
// La ficha de un torneo se refresca sola cada 10 s y, además, con cada
// evento en vivo del torneo: un mensaje de chat, un reporte, un
// resultado. Cada refresco volvía a montar TODAS las cajas —cabecera,
// pestañas, tu partida, el chat de la mesa, las mesas, la
// clasificación— aunque no hubiera cambiado ni una letra.
//
// Y eso, con la ronda en marcha, es lo que hacía imposible pulsar
// «Victoria»: los botones desaparecían y volvían varias veces por
// segundo, y las cajas de debajo (el chat, «Llamar al juez») se
// regeneraban con otra altura y movían todo lo de arriba justo cuando
// ibas a hacer clic.
//
// Aquí está el remedio, en cuatro líneas: se recuerda el HTML que se
// pintó en cada caja y, si el nuevo es idéntico, no se toca el DOM. Sin
// tocarlo no hay parpadeo, nada se mueve de sitio y los escuchas de
// eventos siguen enganchados a los mismos nodos.
//
// Se compara el HTML que se va a PINTAR, no el que hay dentro de la
// caja: hay piezas que se rellenan después de pintarlas (los sprites de
// los arquetipos, los mensajes del chat), así que leyendo el DOM de
// vuelta no coincidiría nunca y esto no serviría de nada.
//
// El registro va en un WeakMap por elemento y no en un diccionario de
// claves: así no hay nombres que inventar ni que mantener, y cuando una
// caja desaparece de la página su firma se va con ella.

const firmas = new WeakMap()

// Devuelve `true` si de verdad ha pintado (o sea: si algo cambió). Quien
// llama lo usa para saber si tiene que volver a enganchar los botones —
// si no se ha pintado, los de antes siguen ahí.
export function pintarSiCambia(el, html) {
  if (!el) return false
  if (firmas.get(el) === html) return false
  firmas.set(el, html)
  el.innerHTML = html
  return true
}

// Lo mismo para el texto suelto (un nombre, un contador): tocar
// `textContent` cuando ya dice lo mismo también cuenta como cambiar el
// DOM, y en una cabecera que se repinta cada segundo se nota.
export function textoSiCambia(el, texto) {
  if (!el) return false
  const nuevo = String(texto ?? '')
  if (el.textContent === nuevo) return false
  el.textContent = nuevo
  return true
}
