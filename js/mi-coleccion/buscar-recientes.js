// ANTES DE ESCRIBIR EN BUSCAR (1217, la maqueta de «La web como la portada»):
// lo último que abriste desde aquí, en una tira de fotos, y los sets de ahora
// en baldosas con su logo. Lo último vive en tu navegador (`pd-buscar-
// recientes`, ocho como mucho): es tuyo y de este aparato, no de la base.
import { escapeHtml } from '../html.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { nombreDeCarta } from '../catalogo-series.js'
import { urlDeLogo } from '../carta-ruta.js'

const CLAVE = 'pd-buscar-recientes'
const TOPE = 8
// Lo justo para volver a pintar la foto sin pedir nada.
const CAMPOS = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_tcggo,image_scrydex'.split(',')

export function leerRecientes() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '[]').filter((c) => c?.id) } catch { return [] }
}
export function apuntarReciente(c) {
  if (!c?.id) return
  const fila = Object.fromEntries(CAMPOS.filter((k) => c[k] != null).map((k) => [k, c[k]]))
  if (c.tcg_sets) fila.tcg_sets = { tcg_online_code: c.tcg_sets.tcg_online_code || null, serie_id: c.tcg_sets.serie_id || null, name: c.tcg_sets.name || null }
  const lista = [fila, ...leerRecientes().filter((x) => x.id !== c.id)].slice(0, TOPE)
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)) } catch { /* sin memoria, sin «lo último» */ }
}

export function recientesHtml(lista = leerRecientes()) {
  if (!lista.length) return ''
  return `<section class="mc-antes-bloque" aria-label="Lo último que buscaste">
    <h3 class="mc-antes-titulo">Lo último que buscaste</h3>
    <div class="mc-antes-tira">${lista.map((c) => {
      const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
      const codigo = [c.tcg_sets?.tcg_online_code, c.local_id].filter(Boolean).join(' ')
      return `<button type="button" class="mc-antes-carta" data-sugerencia="${escapeHtml(nombreDeCarta(c) || c.name || '')}">
        <span class="mc-antes-foto">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
        <b>${escapeHtml(nombreDeCarta(c) || c.name || '')}</b>${codigo ? `<small>${escapeHtml(codigo)}</small>` : ''}
      </button>`
    }).join('')}</div>
  </section>`
}

// Los cuatro sets más nuevos que ya han salido, con su logo.
export function setsDeAhoraHtml(sets = [], mercado = 'WEST', hoy = new Date().toISOString().slice(0, 10)) {
  const lista = sets
    .filter((s) => (s.market || 'WEST') === mercado && s.release_date && !s.oculto)
    .sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)))
  const salidos = lista.filter((s) => s.release_date <= hoy).slice(0, 3)
  const proximo = lista.filter((s) => s.release_date > hoy).slice(-1)
  const cuatro = [...proximo, ...salidos].slice(0, 4)
  if (!cuatro.length) return ''
  return `<section class="mc-antes-bloque" aria-label="Los sets de ahora">
    <h3 class="mc-antes-titulo">Los sets de ahora</h3>
    <div class="mc-antes-sets">${cuatro.map((s) => {
      const logo = s.logo_tcggo || s.logo_scrydex || (s.logo_path ? urlDeLogo(s.logo_path, s.market || 'WEST') : '')
      const sub = s.release_date > hoy ? `sale el ${new Date(`${s.release_date}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : s.card_count_official ? `${s.card_count_official} cartas` : ''
      return `<a class="mc-antes-set" href="/mi-coleccion?ver=album&set=${encodeURIComponent(s.id)}&catalogo=${encodeURIComponent(s.market || 'WEST')}">
        <span class="mc-antes-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" onerror="this.remove()" />` : escapeHtml(s.tcg_online_code || '')}</span>
        <span><b>${escapeHtml(s.name || s.id)}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</span>
      </a>`
    }).join('')}</div>
  </section>`
}
