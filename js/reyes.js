// LOS REYES (tanda 1289, PINGU eligió «Delibird el 25 y los Reyes el 6»). El
// 5 y el 6 de enero la cabecera pone `data-fiesta="reyes"` (y `css/reyes.css`:
// la corona en la «P»), y esto saca, una vez por persona y año, «Los Reyes
// Magos han pasado por PokeDoc»: las tres cartas de TU «La quiero» que menos
// cuestan hoy en Cardmarket, en el idioma que las quieres (`valorDe`, la regla
// de la ficha). No regalan nada inventado: sin precio no entra. Sin deseos,
// te invita a apuntarlos. Ni sin cuenta ni a una tienda.
import { supabase } from './supabase.js'
import { getSession, escapeHtml } from './app.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { rutaDeCarta } from './carta-ruta.js'
import { precioDeFila, valorDe } from './cardmarket.js'
import { masBaratas, claveDeReyes } from './fiestas-puro.js'
import { esTienda } from './navidad.js'

const euros = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const MERCADO = '/mi-coleccion?ver=mercado'
const LA_QUIERO = '/mi-coleccion?ver=quiero'

// Tus deseos con su precio de hoy, y las tres más baratas con su carta.
export async function regalosDeReyes(uid) {
  const { data: deseos, error } = await supabase.from('user_wants').select('card_id,market,idioma').eq('user_id', uid).limit(1000)
  if (error) throw error
  if (!deseos?.length) return []
  const ids = [...new Set(deseos.map((d) => d.card_id))]
  const precios = new Map()
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('tcg_card_prices').select('*').in('card_id', ids.slice(i, i + 150))
    for (const f of data || []) precios.set(`${f.card_id}|${f.market || 'WEST'}`, f)
  }
  const tres = masBaratas(deseos.map((d) => ({
    ...d,
    valor: valorDe(precioDeFila(precios.get(`${d.card_id}|${d.market || 'WEST'}`)), d.idioma || 'es'),
  })))
  if (!tres.length) return []
  const { data: cartas } = await supabase.from('tcg_cards')
    .select('id,market,name,name_es,local_id,set_id,image_path,image_tcggo,tcg_sets(name,serie_id,tcg_online_code)')
    .in('id', tres.map((t) => t.card_id))
  return tres.map((t) => ({ ...t, carta: (cartas || []).find((c) => c.id === t.card_id && (c.market || 'WEST') === (t.market || 'WEST')) || null }))
    .filter((t) => t.carta)
}

export function popHtml(regalos) {
  const coronas = `<span class="reyes-coronas" aria-hidden="true">${icons.crown(36)}${icons.crown(44)}${icons.crown(36)}</span>`
  if (!regalos.length) {
    return `<dialog class="reyes-pop" aria-labelledby="reyesTitulo">
      ${coronas}
      <h2 id="reyesTitulo">Los Reyes Magos han pasado por PokeDoc</h2>
      <p>…pero tu «La quiero» está vacía y no sabían qué traerte. Apunta lo que buscas y el año que viene acertarán.</p>
      <div class="reyes-botones"><button type="button" class="btn-secondary" data-reyes-cerrar>Cerrar</button><a class="btn-primary" href="${LA_QUIERO}">Ir a La quiero</a></div>
      <button type="button" class="reyes-quitar" data-fiesta-quitar="reyes">Quitar la decoración</button>
    </dialog>`
  }
  const cartas = regalos.map(({ carta, valor }) => {
    const escaneo = atributosDeEscaneo(cadenaDeEscaneo(carta))
    const nombre = carta.name_es || carta.name
    return `<a class="reyes-carta" href="${rutaDeCarta(carta)}">
        <span class="reyes-foto">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" decoding="async">` : ''}</span>
        <b>${escapeHtml(nombre)}</b>
        <small>desde ${euros(valor)}</small>
      </a>`
  }).join('')
  return `<dialog class="reyes-pop" aria-labelledby="reyesTitulo">
      ${coronas}
      <h2 id="reyesTitulo">Los Reyes Magos han pasado por PokeDoc</h2>
      <p>Te traen una carta de tu «La quiero»: ${regalos.length === 1 ? 'esta es la que menos cuesta' : `estas son las ${regalos.length === 2 ? 'dos' : 'tres'} que menos cuestan`} hoy en Cardmarket.</p>
      <div class="reyes-cartas">${cartas}</div>
      <div class="reyes-botones"><button type="button" class="btn-secondary" data-reyes-cerrar>Cerrar</button><a class="btn-primary" href="${MERCADO}">Ver en el Mercado</a></div>
      <button type="button" class="reyes-quitar" data-fiesta-quitar="reyes">Quitar la decoración</button>
    </dialog>`
}

function abrirPop(doc, win, regalos) {
  if (doc.querySelector('dialog:modal') || doc.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return false
  try { win.localStorage.setItem(claveDeReyes(), '1') } catch { return false }
  doc.body.insertAdjacentHTML('beforeend', popHtml(regalos))
  const pop = doc.body.lastElementChild
  pop.addEventListener('click', (e) => {
    if (e.target === pop || e.target.closest('[data-reyes-cerrar]')) pop.close()
  })
  pop.addEventListener('close', () => pop.remove())
  pop.showModal()
  return true
}

export async function montarReyes({ doc = document, win = window } = {}) {
  await hojaInyectada('css/reyes.css')
  // «Quitar la decoración» aunque la Navidad esté quitada (su manejador vive
  // en navidad.js).
  if (doc.documentElement.dataset.temporada !== 'navidad') {
    doc.addEventListener('click', (e) => {
      const f = e.target.closest?.('[data-fiesta-quitar]')?.dataset.fiestaQuitar
      if (!f) return
      try { win.localStorage.setItem(`pd-sin-${f}`, '1') } catch { /* solo esta visita */ }
      win.location.reload()
    })
  }
  const s = await getSession().catch(() => null)
  if (!s?.user?.id || await esTienda(doc)) return
  try { if (win.localStorage.getItem(claveDeReyes()) === '1') return } catch { return }
  let regalos
  try { regalos = await regalosDeReyes(s.user.id) } catch { return }
  const luego = () => win.setTimeout(() => abrirPop(doc, win, regalos), 900)
  if (doc.prerendering) doc.addEventListener('prerenderingchange', luego, { once: true })
  else luego()
}
