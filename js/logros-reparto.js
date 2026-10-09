// «Lo tiene el 3 % de PokeDoc» (tanda 793, NU9): debajo de cada medalla,
// cuánta gente la tiene. Una llamada (`logros_reparto`); si la migración no
// está, no se pinta nada, que es mejor que un «0 %» que no es verdad.
import { supabase } from './supabase.js'

export function textoDeReparto(personas, total) {
  if (!total) return ''
  const p = (personas / total) * 100
  if (p === 0) return 'Nadie la tiene aún'
  if (p < 1) return 'La tiene menos del 1 %'
  return `La tiene el ${Math.round(p).toLocaleString('es-ES')} %`
}

export async function ponerReparto(grid) {
  if (!grid) return
  const { data, error } = await supabase.rpc('logros_reparto')
  if (error || !data?.length) return
  for (const f of data) {
    const tile = grid.querySelector(`[data-logro="${CSS.escape(f.id)}"]`)
    const texto = textoDeReparto(Number(f.personas), Number(f.total))
    if (tile && texto && !tile.querySelector('.logro-reparto')) tile.insertAdjacentHTML('beforeend', `<small class="logro-reparto">${texto}</small>`)
  }
}
