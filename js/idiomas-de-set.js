// EN QUÉ IDIOMAS SALIÓ UN SET (911). Plasma Blast no salió en español y la
// hoja de añadir lo ofrecía; una japonesa se vende también en coreano y en
// chino y solo dejaba el japonés. Lo contesta la base (`idiomas_de_set`,
// supabase-migration-911-idiomas-de-set.sql): los idiomas con anuncios en
// Cardmarket y los de la ficha de TCGdex, sumados.
//
// Devuelve la lista o `null` si no se sabe —sin la migración, sin red, un
// set del que no hay nada—, y quien la usa ofrece entonces todos
// (`acotarIdiomas`). Se pregunta una vez por set y página.
import { supabase } from './supabase.js'
import { sinReglas, reglasDeFilas } from './cardmarket.js'

export { sinReglas }

const enMemoria = new Map()

export function idiomasDeSet(setId, market = 'WEST', { cliente = supabase } = {}) {
  if (!setId) return Promise.resolve(null)
  const clave = `${market}|${setId}`
  if (!enMemoria.has(clave)) {
    enMemoria.set(clave, Promise.resolve()
      .then(() => cliente.rpc('idiomas_de_set', { p_set: setId, p_market: market }))
      .then(({ data, error }) => (error || !Array.isArray(data) || !data.length ? null : data))
      .catch(() => null))
  }
  return enMemoria.get(clave)
}

// Lo mismo, pero sin hacer esperar más de `ms`: una ventana que pregunta el
// idioma no se queda parada por esto; si tarda, se ofrecen todos.
export function idiomasDeSetSinEsperar(setId, market = 'WEST', ms = 1500) {
  return Promise.race([idiomasDeSet(setId, market), new Promise((ok) => setTimeout(() => ok(null), ms))])
}

// LAS VERSIONES DE CADA IDIOMA (956 y 958), de `tcg_version_idioma` (lo pone
// el admin): `set` es idioma → las que no salieron en el set, y `cartas`,
// carta → idioma → versión → sí o no, lo de una carta suelta (el Duskull SH2).
// Se pide `*` y no `card_id`: antes de la 958 la columna no existe y nombrarla
// tumbaría la consulta entera (la 624). Sin la tabla o sin red, vacío: «no se
// sabe» es «se ofrecen todas», como antes.
const reglasEnMemoria = new Map()
export function reglasDeVersiones(setId, market = 'WEST', { cliente = supabase } = {}) {
  if (!setId) return Promise.resolve(sinReglas())
  const clave = `${market}|${setId}`
  if (!reglasEnMemoria.has(clave)) {
    reglasEnMemoria.set(clave, Promise.resolve()
      .then(() => cliente.from('tcg_version_idioma').select('*').eq('set_id', setId).eq('market', market))
      .then(({ data, error }) => (error ? sinReglas() : reglasDeFilas(data)))
      .catch(() => sinReglas()))
  }
  return reglasEnMemoria.get(clave)
}
export const hayReglas = (r) => Boolean(r?.set?.size || r?.cartas?.size)
