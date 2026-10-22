// Lo que decide las dos secciones de idiomas de un set en /admin (956), sin
// tocar la base ni el DOM: así se prueba en Node.
import { IDIOMAS, VARIANTES, versionesDelIdioma, reglasDeFilas } from '../../js/cardmarket.js'
import { variantesDeCarta } from '../../js/mi-coleccion/variantes.js'

// Cada idioma con su estado: `auto` (lo dicen Cardmarket o TCGdex), `quitado`
// (lo dicen, pero lo has quitado tú) o `puesto` (no lo dicen y lo has puesto
// tú), y lo que hace tocarlo (`hay` para la función: false quita, null deja
// de mandar lo de a mano). En el orden de `IDIOMAS`.
export function estadoDeIdiomas(calculados, mano) {
  const calc = new Set(calculados || [])
  const aMano = new Map((mano || []).map((f) => [f.idioma, f.hay]))
  const fuera = []
  for (const i of IDIOMAS) {
    const dicho = calc.has(i.id)
    const puesto = aMano.get(i.id)
    if (dicho && puesto === false) fuera.push({ ...i, estado: 'quitado', alTocar: null })
    else if (dicho) fuera.push({ ...i, estado: 'auto', alTocar: false })
    else if (puesto === true) fuera.push({ ...i, estado: 'puesto', alTocar: null })
  }
  return fuera
}

// Los que se pueden añadir: los que no salen en la fila (un quitado se
// devuelve tocándolo).
export function idiomasParaPoner(estado) {
  return IDIOMAS.filter((i) => !estado.some((e) => e.id === i.id))
}

// Las versiones que existen en el set: las de cada carta, juntas, en el
// orden en que aparecen. Y las que ya tengan algo puesto aunque ninguna carta
// las ofrezca hoy (para poder quitarlo).
export function versionesDelSet(cartas, filas = []) {
  const vistas = new Map()
  for (const c of cartas || []) for (const v of variantesDeCarta(c)) if (!vistas.has(v.nuestro)) vistas.set(v.nuestro, { id: v.nuestro, nombre: v.nombre })
  for (const f of filas || []) if (!vistas.has(f.variante)) vistas.set(f.variante, { id: f.variante, nombre: f.variante })
  return [...vistas.values()]
}

// ¿Salió esta versión en este idioma, en el set entero? Sin fila, sí (es lo
// de por defecto). Las filas de una carta (958) no cuentan aquí.
export function salio(filas, variante, idioma) {
  return !(filas || []).some((f) => !f.card_id && f.variante === variante && f.idioma === idioma && f.hay === false)
}

// UNA CARTA (958): sus versiones, más las de siempre que no trae (la Reverse
// del Duskull SH2 no está en TCGdex) y las que ya tengan algo puesto.
export function versionesDeUnaCarta(carta, filas = []) {
  const vistas = new Map(variantesDeCarta(carta).map((v) => [v.nuestro, { id: v.nuestro, nombre: v.nombre }]))
  for (const v of VARIANTES) if (v.id !== 'primera' && !vistas.has(v.id)) vistas.set(v.id, { id: v.id, nombre: v.nombre })
  for (const f of filas || []) if (f.card_id === carta?.id && !vistas.has(f.variante)) vistas.set(f.variante, { id: f.variante, nombre: f.variante })
  return [...vistas.values()]
}
// Lo que se ofrece de esa carta en un idioma: lo mismo que ve la hoja de añadir.
function seOfrece(carta, filas, variante, idioma) {
  const base = variantesDeCarta(carta).map((v) => ({ id: v.nuestro, nombre: v.nombre }))
  return versionesDelIdioma(base, reglasDeFilas(filas), idioma, carta.id).versiones.some((v) => v.id === variante)
}
// Cada casilla: si se ofrece, y si es por algo puesto en ESTA carta.
export function casillaDeCarta(carta, filas, variante, idioma) {
  const propia = (filas || []).find((f) => f.card_id === carta?.id && f.variante === variante && f.idioma === idioma)
  return { si: seOfrece(carta, filas, variante, idioma), propia: Boolean(propia) }
}
// Lo que se manda al tocarla (`hay` para la función): lo contrario de lo que
// se ve, o null si lo contrario es ya lo que darían el set y la carta sin esa
// fila (así no queda una fila que repite lo de por defecto).
export function alTocarCasilla(carta, filas, variante, idioma) {
  const quiero = !casillaDeCarta(carta, filas, variante, idioma).si
  const sin = (filas || []).filter((f) => !(f.card_id === carta?.id && f.variante === variante && f.idioma === idioma))
  return seOfrece(carta, sin, variante, idioma) === quiero ? null : quiero
}

export const AVISO_956 = 'Falta ejecutar supabase-migration-956-idiomas-y-versiones-a-mano.sql en el SQL Editor.'
