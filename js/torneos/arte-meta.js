// El arte de un torneo sin imagen (tanda 796, SI4): los tres mazos que más
// se juegan, en fila, sobre el degradado de siempre. Arte que sale de los
// datos, sin pedirle una foto a nadie. Una consulta para la página entera
// (`meta_resumen`, la de /meta), y si falla o no hay meta, el degradado solo.
import { supabase } from '../supabase.js'
import { urlDeIcono } from '../meta/nucleo.js'
import { CDN_SPRITES, cadenaDeRespaldos, SALTO_DE_RESPALDO, spriteDeCarta } from './sprites-pokemon.js'
import { deducirIconos } from './arquetipos.js'

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

// EL MAZO DEL CAMPEÓN en un torneo terminado (1216, la propuesta del repaso:
// «los sprites de sus dos mazos más jugados, o del campeón si terminó»). Su
// lista se ve cuando el torneo ha terminado (la política de siempre, 230), y
// los dos Pokémon salen de la propia lista (`deducirIconos`), sin guardar el
// arquetipo en ninguna parte. Una consulta para todos los terminados; lo que
// no tenga lista se queda con los del meta.
export function urlsDelCampeon(parsed) {
  return deducirIconos(parsed).map((i) => spriteDeCarta(i.nombre)).filter(Boolean)
}
export async function ponerArteDeCampeones(raiz = document, torneos = []) {
  const terminados = torneos.filter((t) => t.status === 'finished' && t.champion_id && !t.image_url)
  if (!terminados.length) return 0
  const { data, error } = await supabase.from('tournament_decklists').select('tournament_id, user_id, parsed_cards').in('tournament_id', terminados.map((t) => t.id))
  if (error || !data?.length) return 0
  let n = 0
  for (const t of terminados) {
    const lista = data.find((d) => d.tournament_id === t.id && d.user_id === t.champion_id)
    const urls = lista ? urlsDelCampeon(lista.parsed_cards) : []
    const arte = raiz.querySelector(`.torneo-arte[data-torneo="${CSS.escape(String(t.id))}"]`)
    if (!arte || !urls.length) continue
    arte.querySelector('.torneo-arte-meta')?.remove()
    arte.classList.add('con-meta', 'con-campeon')
    const imgs = urls.map((url) => {
      const cadena = cadenaDeRespaldos(url)
      return `<img class="torneo-arte-sprite" src="${url}" alt="" width="56" height="56" loading="lazy"${cadena.length ? ` data-respaldos="${cadena.join(' ')}"` : ''} onerror="${SALTO_DE_RESPALDO}" />`
    }).join('')
    arte.insertAdjacentHTML('beforeend', `<span class="torneo-arte-meta" aria-hidden="true" title="El mazo del campeón">${imgs}</span>`)
    n++
  }
  return n
}
