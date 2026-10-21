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

// LAS VERSIONES QUE NO SALIERON EN UN IDIOMA (956): idioma → versiones, de
// `tcg_version_idioma` (lo pone el admin). Sin la tabla —la migración aún no
// está— o sin red, un mapa vacío: «no se sabe» es «se ofrecen todas», como
// antes.
const noSalieronEnMemoria = new Map()
export function versionesQueNoSalieron(setId, market = 'WEST', { cliente = supabase } = {}) {
  if (!setId) return Promise.resolve(new Map())
  const clave = `${market}|${setId}`
  if (!noSalieronEnMemoria.has(clave)) {
    noSalieronEnMemoria.set(clave, Promise.resolve()
      .then(() => cliente.from('tcg_version_idioma').select('variante,idioma').eq('set_id', setId).eq('market', market).eq('hay', false))
      .then(({ data, error }) => {
        const mapa = new Map()
        if (error) return mapa
        for (const f of data || []) {
          if (!mapa.has(f.idioma)) mapa.set(f.idioma, new Set())
          mapa.get(f.idioma).add(f.variante)
        }
        return mapa
      })
      .catch(() => new Map()))
  }
  return noSalieronEnMemoria.get(clave)
}
