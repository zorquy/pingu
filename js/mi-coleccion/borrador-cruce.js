// ── El mensaje que se escribe solo (887; antes en tablon.js) ──
//
// Sin pintado: lo importan el tablón de Cruces, el Mercado y el cruce del
// perfil (cruce-persona.js). Va aparte para que el barrido de la 299 no
// arrastre las clases del tablón a las páginas que solo quieren el texto.
import { idiomaDe, estadoDe, varianteDe } from '../cardmarket.js'
import { nombreDeCarta } from '../catalogo-series.js'

const nombreDe = (c) => nombreDeCarta(c) || '—'

// Lo que distingue una copia de otra, en una línea: «español · Near
// Mint · Reverse holo». La versión solo se dice si NO es la normal —
// decir «normal» en el 90 % de las filas es ruido.
export function senasDe(f) {
  const partes = [idiomaDe(f.idioma).nombre, estadoDe(f.estado).nombre]
  if (f.variante && f.variante !== 'normal') partes.push(varianteDe(f.variante).nombre)
  if (f.gradeo) partes.push(f.gradeo)
  return partes.join(' · ')
}


// El mensaje que se escribe solo. NO se envía: se deja escrito en la
// caja para que quien lo manda lo lea antes. Un botón que manda un
// mensaje a un desconocido sin enseñárselo es una forma rápida de
// quedar mal.
export function borradorDe(persona, cartas, direccion) {
  const lista = cartas.slice(0, 6).map((f) => `· ${nombreDe(f.carta)} (${senasDe(f)})`).join('\n')
  const mas = cartas.length > 6 ? `\n…y ${cartas.length - 6} más.` : ''
  const cabecera = direccion === 'tiene'
    ? 'He visto que das estas cartas y las estoy buscando:'
    : 'He visto que buscas estas cartas y las doy:'
  const cierre = persona.reciproco
    ? '\n\nY creo que nos encajan las dos listas, así que igual sale un cambio directo. ¿Te va bien?'
    : '\n\n¿Te interesa algo de lo mío? Te paso mi lista si quieres.'
  return `¡Hola! ${cabecera}\n\n${lista}${mas}${cierre}`
}

// El mensaje de un cruce: las dos listas en el mismo texto. Se deja
// escrito, no se manda (lo de siempre).
export function borradorDeCruce(teDa, leDas) {
  const linea = (f) => `· ${nombreDe(f.carta)} (${senasDe(f)})`
  const partes = ['¡Hola!']
  if (teDa.length) partes.push(`Das estas cartas que estoy buscando:\n${teDa.slice(0, 6).map(linea).join('\n')}${teDa.length > 6 ? `\n…y ${teDa.length - 6} más.` : ''}`)
  if (leDas.length) partes.push(`Y buscas estas, que tengo para cambio:\n${leDas.slice(0, 6).map(linea).join('\n')}${leDas.length > 6 ? `\n…y ${leDas.length - 6} más.` : ''}`)
  partes.push(teDa.length && leDas.length ? '¿Hacemos un cambio?' : '¿Te interesa algo de lo mío? Te paso mi lista si quieres.')
  return partes.join('\n\n')
}
