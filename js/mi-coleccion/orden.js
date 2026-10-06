// ── Cómo se ordena una expansión (tanda 427) ──
//
// Una expansión se mira de cuatro maneras según lo que vayas a hacer: por
// número cuando repasas el set en la mano, por nombre cuando buscas una,
// por rareza cuando miras lo que vale, y «lo que te falta» cuando vas a
// comprar o a cambiar. Hasta ahora solo había la primera.
//
// Va en su propio fichero y sin tocar el DOM para poder probarlo en Node:
// lo que decide el orden es aritmética, y la aritmética no necesita un
// navegador para equivocarse.

export const ORDENES = [
  { id: 'numero', nombre: 'Por número' },
  { id: 'nombre', nombre: 'Por nombre' },
  { id: 'rareza', nombre: 'Las más raras primero' },
  { id: 'falta', nombre: 'Lo que te falta primero' },
]

// El número impreso ordena «como en el álbum»: 2 antes que 10, los que
// llevan letras (TG12, SV045) detrás de los numéricos, y los que llevan
// BARRA («B/RGB», «R/RGB»: los Mew de la Classic del 30 aniversario) los
// últimos de todos, que es como los lista TCGGO (669). Antes «B/RGB» caía
// entre «AQ149» y «BKP041», en mitad del alfabeto.
function tramoDeNumero(id) {
  const s = String(id ?? '')
  if (/^\d+$/.test(s)) return 0
  if (s.includes('/')) return 2
  return 1
}
export function porNumero(a, b) {
  const na = parseInt(a.local_id, 10)
  const nb = parseInt(b.local_id, 10)
  const ea = tramoDeNumero(a.local_id)
  const eb = tramoDeNumero(b.local_id)
  return ea - eb || (ea === 0 && Number.isFinite(na) && Number.isFinite(nb) ? na - nb : 0) || String(a.local_id).localeCompare(String(b.local_id))
}

// La escala de rareza vive en js/rareza-escala.js desde la tanda 624: es
// la MISMA que decide qué impresión de una carta se enseña, y dos escalas
// para la misma pregunta acaban contestando cosas distintas. Se reexporta
// para que nada de lo que la importaba de aquí se entere.
import { rangoDeRareza, rangoDeCarta } from '../rareza-escala.js'
export { rangoDeRareza }

// Ordena SIN tocar la lista que le dan: `sort` muta, y `album.cartas` es
// la lista buena del set — ordenarla en el sitio dejaría el «por número»
// dependiendo de lo último que hubieras elegido.
export function ordenar(cartas, orden, { tengo, nombre } = {}) {
  const lista = [...cartas]
  const cuantas = (c) => (tengo ? Number(tengo(c.id)) || 0 : 0)
  const comoSeLlama = (c) => (nombre ? nombre(c) : c?.name || '')
  if (orden === 'nombre') {
    return lista.sort((a, b) => comoSeLlama(a).localeCompare(comoSeLlama(b), 'es') || porNumero(a, b))
  }
  if (orden === 'rareza') {
    return lista.sort((a, b) => {
      // De la CARTA y no de `rarity` (tanda 624): manda `rarity_en`, como en
      // los chips y el rótulo desde la 523.
      const ra = rangoDeCarta(a)
      const rb = rangoDeCarta(b)
      // Las que no se saben van SIEMPRE al final, se ordene como se
      // ordene: en «de más a menos», ponerlas arriba diría que son las más
      // raras del set, que es exactamente lo que no se sabe.
      if (ra === null && rb === null) return porNumero(a, b)
      if (ra === null) return 1
      if (rb === null) return -1
      return rb - ra || porNumero(a, b)
    })
  }
  if (orden === 'falta') {
    // Las que te faltan primero, y dentro de cada grupo por número: si no,
    // «lo que te falta» sería una lista desordenada de la que no se puede
    // ir leyendo números para buscarlos en una tienda.
    return lista.sort((a, b) => (cuantas(a) ? 1 : 0) - (cuantas(b) ? 1 : 0) || porNumero(a, b))
  }
  return lista.sort(porNumero)
}
