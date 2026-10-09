// El arte de un torneo sin imagen (tanda 796, SI4): los tres mazos que más
// se juegan, en fila, sobre el degradado de siempre. Arte que sale de los
// datos, sin pedirle una foto a nadie. Una consulta para la página entera
// (`meta_resumen`, la de /meta), y si falla o no hay meta, el degradado solo.
import { supabase } from '../supabase.js'
import { urlDeIcono } from '../meta/nucleo.js'
import { CDN_SPRITES, cadenaDeRespaldos, SALTO_DE_RESPALDO } from './sprites-pokemon.js'

// Puro: los iconos de los N mazos de más cuota, uno por mazo y sin repetir.
export function iconosDelMeta(filas, n = 3) {
  const vistos = new Set()
  return [...(filas || [])]
    .sort((a, b) => Number(b.cuota || 0) - Number(a.cuota || 0))
    .map((f) => (f.iconos || [])[0])
    .filter((i) => i && !vistos.has(i) && vistos.add(i))
    .slice(0, n)
}

export function spritesHtml(iconos) {
  return iconos.map((i) => {
    const url = urlDeIcono(i, CDN_SPRITES)
    if (!url) return ''
    const cadena = cadenaDeRespaldos(url)
    return `<img class="torneo-arte-sprite" src="${url}" alt="" width="56" height="56" loading="lazy"${cadena.length ? ` data-respaldos="${cadena.join(' ')}"` : ''} onerror="${SALTO_DE_RESPALDO}" />`
  }).join('')
}

let pedido = null
export async function ponerArteDelMeta(raiz = document) {
  const artes = [...raiz.querySelectorAll('.torneo-arte:not(.con-meta)')].filter((a) => !a.querySelector('.torneo-arte-imagen'))
  if (!artes.length) return 0
  pedido ||= supabase.rpc('meta_resumen', { p_dias: 30, p_fuente: null }).then(({ data, error }) => (error ? [] : data || []), () => [])
  const iconos = iconosDelMeta(await pedido)
  if (!iconos.length) return 0
  const html = `<span class="torneo-arte-meta" aria-hidden="true">${spritesHtml(iconos)}</span>`
  for (const a of artes) {
    a.classList.add('con-meta')
    a.insertAdjacentHTML('beforeend', html)
  }
  return artes.length
}
