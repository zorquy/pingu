// Lo que la gente busca, para el panel (tanda 848): el texto y cuántos
// resultados salieron, SIN usuario. Sirve para saber qué guías faltan y qué
// cartas o nombres no casan («busqué X y no salió nada»).
//
// Cada letra lanza una búsqueda, así que se apunta solo la que se queda
// quieta 2 s, de tres letras o más, y una vez por texto en esta pestaña.
import { supabase } from './supabase.js'
import { normalizeSearch } from './texto.js'
import { normalizePath } from './page-views.js'

const ya = new Set()
let reloj = null

export function textoParaApuntar(crudo) {
  const q = normalizeSearch(String(crudo || '')).replace(/\s+/g, ' ').trim().slice(0, 80)
  return q.length >= 3 ? q : null
}

export function apuntarBusqueda(crudo, resultados, { espera = 2000 } = {}) {
  clearTimeout(reloj)
  const q = textoParaApuntar(crudo)
  if (!q || ya.has(q)) return
  reloj = setTimeout(async () => {
    ya.add(q)
    try {
      await supabase.from('busquedas').insert({ q, resultados: Math.max(0, resultados | 0), donde: normalizePath(location.pathname).slice(0, 60) })
    } catch {
      // Sin la migración o sin red: no se apunta y no pasa nada más.
    }
  }, espera)
}
