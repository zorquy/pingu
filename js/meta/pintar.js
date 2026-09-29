// Lo que pintan las dos pantallas del meta (tanda 364): los iconos de
// un arquetipo y el selector de periodo. Sus clases viven en
// css/meta.css, que cargan las dos.
import { escapeHtml } from '../html.js'
import { CDN_SPRITES, cadenaDeRespaldos, SALTO_DE_RESPALDO } from '../torneos/sprites-pokemon.js'
import { urlDeIcono, especieBaseDeIcono, PERIODOS } from './nucleo.js'

// Un minisprite con su cadena de respaldos. Si el icono es una mega que
// la CDN aún no tiene, el primer peldaño es la especie base (se ve el
// Pokémon a secas, que para reconocer el mazo sirve igual); después, la
// cadena de siempre (tanda 321), y al final se esconde — nunca el icono
// roto del navegador.
export function iconoHtml(icono) {
  const url = urlDeIcono(icono, CDN_SPRITES)
  if (!url) return ''
  const base = especieBaseDeIcono(icono)
  const urlBase = base ? urlDeIcono(base, CDN_SPRITES) : null
  const cadena = urlBase ? [urlBase, ...cadenaDeRespaldos(urlBase)] : cadenaDeRespaldos(url)
  // Las URLs las montamos nosotros (letras, números, guiones): van sin
  // escapar sin peligro, como en atributosDeRespaldo.
  return `<img class="meta-icono" src="${url}" alt="" width="40" height="40" loading="lazy"${cadena.length ? ` data-respaldos="${cadena.join(' ')}"` : ''} onerror="${SALTO_DE_RESPALDO}" />`
}

export function iconosHtml(iconos, { grande = false } = {}) {
  const lista = (iconos || []).slice(0, 2)
  return `<span class="meta-iconos${grande ? ' meta-iconos-grandes' : ''}" aria-hidden="true">${lista.map(iconoHtml).join('')}</span>`
}

export function periodoHtml(activo) {
  return PERIODOS.map(
    (d) => `<button type="button" class="meta-periodo-btn${d === activo ? ' activo' : ''}" data-dias="${d}" aria-pressed="${d === activo}">${d} días</button>`
  ).join('')
}

// El periodo vive en la dirección (?dias=7) para que un enlace compartido
// enseñe lo mismo que veía quien lo mandó.
export function engancharPeriodo(caja, alCambiar) {
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dias]')
    if (!b) return
    const dias = Number(b.dataset.dias)
    for (const x of caja.querySelectorAll('[data-dias]')) {
      x.classList.toggle('activo', x === b)
      x.setAttribute('aria-pressed', String(x === b))
    }
    const url = new URL(location.href)
    url.searchParams.set('dias', String(dias))
    history.replaceState(null, '', url)
    alCambiar(dias)
  })
}

export function haceCuanto(iso) {
  if (!iso) return ''
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (!Number.isFinite(min)) return ''
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`
}

export function fechaCorta(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function avisoHtml(texto) {
  return `<p>${escapeHtml(texto)}</p>`
}
