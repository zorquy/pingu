// Lo que colecciona cada persona, en su tarjeta de Gente (789, PA11): las
// tres primeras cartas de su vitrina (752), en una tira. Una sola consulta
// para toda la lista y no una por persona; quien no tiene vitrina no lleva
// tira, y si algo falla la tarjeta se queda como estaba.
import { supabase } from './supabase.js'
import { cartasPorClaves, claveDeCarta } from './mi-coleccion/datos.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { escapeHtml } from './html.js'
import { nombreDeCarta } from './catalogo-series.js'
import { rutaDeCarta } from './carta-ruta.js'

export async function pintarVitrinasDeGente(grid) {
  const tarjetas = [...grid.querySelectorAll('.com-persona[data-user-id]')]
  const ids = tarjetas.map((t) => t.dataset.userId)
  if (!ids.length) return
  const { data, error } = await supabase.from('user_showcase').select('user_id, posicion, card_id, market').in('user_id', ids).order('posicion')
  if (error || !data?.length) return
  const porPersona = new Map()
  for (const f of data) {
    const lista = porPersona.get(f.user_id) || []
    if (lista.length < 3) lista.push(f)
    porPersona.set(f.user_id, lista)
  }
  const mapa = await cartasPorClaves([...porPersona.values()].flat()).catch(() => null)
  if (!mapa) return
  for (const t of tarjetas) {
    const cartas = (porPersona.get(t.dataset.userId) || []).map((f) => mapa.get(claveDeCarta(f.card_id, f.market))).filter(Boolean)
    if (!cartas.length || t.querySelector('.com-persona-vitrina')) continue
    t.insertAdjacentHTML('beforeend', `<span class="com-persona-vitrina">${cartas.map((c) => {
      const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
      return escaneo ? `<a href="${escapeHtml(rutaDeCarta(c))}" aria-label="${escapeHtml(nombreDeCarta(c) || 'Carta')}"><img ${escaneo} alt="" width="42" height="58" loading="lazy" /></a>` : ''
    }).join('')}</span>`)
  }
}
