// ── La lista de lo que te falta, para pegarla en un chat (tanda 430) ──
//
// Es la otra mitad de un intercambio. Desde la 374 el Panel dice lo que
// te SOBRA —«tienes 3 · te sobran 2»—, que es lo que puedes ofrecer; lo
// que te falta había que ir leyéndolo de la rejilla hueco por hueco.
//
// Sale como TEXTO y no como un enlace a propósito: lo que se hace con
// esto es pegarlo en un grupo de WhatsApp o en un mensaje del foro, y
// ahí un enlace obliga a la otra persona a salir a mirarlo.
//
// La lista es EXACTAMENTE lo que hay en pantalla y no tienes. Así se
// lleva bien con todo lo demás sin saber nada de ello: los filtros, el
// orden de la tanda 427 y el «separar variantes» ya han hecho su trabajo
// antes de llegar aquí.

// El nombre sale por la puerta de siempre (tanda 546): aquí había otra
// copia del «español o inglés» que no sabía del nombre occidental, y una
// lista para pegar en un chat con los kanji dentro no la puede usar nadie.
import { nombreDeCarta } from '../catalogo-series.js'

// Y si hay filtros puestos, el texto lo DICE. Sin eso, quien filtró por
// «ultra raras» pega una lista de cinco cartas y la otra persona entiende
// que le faltan cinco del set entero: una lista que miente sobre su
// propio alcance es peor que no tenerla.
export function textoDeLoQueFalta(faltan, { nombreDelSet, codigo, total, filtrando } = {}) {
  if (!faltan?.length) return ''
  const donde = `${nombreDelSet || 'esta colección'}${codigo ? ` (${codigo})` : ''}`
  const cuantas = faltan.length
  // Tres encabezados y no dos, porque hay tres situaciones:
  //
  //  · con filtros puestos NO se dice un total, y se avisa;
  //  · sin filtros, el total es el del SET, que es lo que significa algo
  //    para quien lo lee («me faltan 5 de las 108»);
  //  · y con las versiones separadas no se dice total NINGUNO: lo que hay
  //    en pantalla son huecos de versión y no cartas, así que cualquier
  //    número de ahí pide que se lo expliquen. `total` llega a null a
  //    propósito, que es distinto de que no se sepa.
  const cabecera = filtrando
    ? `Me faltan ${cuantas} de las que estoy mirando de ${donde} — tengo filtros puestos, así que no es la lista entera:`
    : total
      ? `Me faltan ${cuantas} de las ${total} de ${donde}:`
      : `Me faltan ${cuantas} de ${donde}:`
  return `${cabecera}\n${faltan.map(lineaDeCarta).join('\n')}`
}

// `· ` entre el número y el nombre y no un guion: un guion se confunde con
// los que llevan los nombres («Ho-Oh», «Porygon-Z»).
function lineaDeCarta(c) {
  const numero = c.local_id ? String(c.local_id) : '—'
  const nombre = nombreDeCarta(c) || 'Carta'
  // En «separar variantes» cada hueco es una VERSIÓN, así que decir solo
  // el número pediría la carta equivocada: quien te la busca no sabe si
  // quieres la normal o el reverse holo.
  const version = c.__variante?.nombre ? ` (${c.__variante.nombre})` : ''
  return `${numero} · ${nombre}${version}`
}
