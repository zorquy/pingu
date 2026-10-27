// La línea «Expansión · número» de una baldosa (1061): el nombre se recorta
// y el número se queda entero, que es lo que distingue dos impresiones.
import { escapeHtml } from '../app.js'
import { nombreDeSet } from '../catalogo-series.js'

export function lineaDeSetHtml(c) {
  const set = nombreDeSet(c?.tcg_sets)
  const num = c?.local_id
  if (!set || !num) return `<span class="mc-merc-set">${escapeHtml(set || num || '')}</span>`
  return `<span class="mc-merc-set"><span class="mc-merc-set-n">${escapeHtml(set)}</span><span class="mc-merc-set-num"> · ${escapeHtml(num)}</span></span>`
}
