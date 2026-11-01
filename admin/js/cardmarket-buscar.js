// «Buscar en Cardmarket» junto al «Id de producto en Cardmarket» de una
// carta en /admin (tanda 1159). PINGU tenía el enlace de la carta y no el
// número; esto busca por nombre en el catálogo abierto de Cardmarket
// (función `cardmarket-buscar`) y pone el id elegido en la caja: se guarda
// con «Guardar», como todo lo demás de la ficha.
//
// Cardmarket no dice en su catálogo el nombre de la expansión, así que
// cada resultado lleva «Ver en Cardmarket» (su página, para comprobar) y
// su precio; y las de la misma expansión que las hermanas que ya tienen
// id salen primero, marcadas.
// html.js y no app.js, y Supabase al buscar: así lo que pinta se prueba en
// Node sin navegador.
import { escapeHtml } from '../../js/html.js'

const euros = (v) => (v == null ? '' : `${v.toFixed(2).replace('.', ',')} €`)

export function precioCorto(p) {
  if (!p) return 'sin precio'
  const normal = p.low ?? p.trend
  const holo = p.lowHolo ?? p.trendHolo
  return [normal != null ? `desde ${euros(normal)}` : '', holo != null ? `holo ${euros(holo)}` : ''].filter(Boolean).join(' · ') || 'sin precio'
}

export function resultadosHtml(r, actual = null) {
  if (!r?.ok) return `<p class="admin-note">${escapeHtml(r?.error || 'No ha contestado.')}</p>`
  if (!r.resultados.length) return '<p class="admin-note">Ninguna carta de Cardmarket se llama así. Prueba con el nombre en inglés, sin «ex» ni números.</p>'
  const mas = r.total > r.resultados.length ? ` Salen las ${r.resultados.length} primeras: afina con un ataque («charmander ember»).` : ''
  const cerca = r.expansionesCerca?.length ? ' Las marcadas son de la misma expansión de Cardmarket que otras cartas de este set.' : ''
  return `<p class="admin-note">${r.total} ${r.total === 1 ? 'carta casa' : 'cartas casan'}.${mas}${cerca}</p>
    <ul class="cmb-lista">${r.resultados.map((x) => `
      <li class="cmb-fila${x.misma ? ' cmb-misma' : ''}${Number(actual) === x.idProduct ? ' cmb-puesta' : ''}">
        <span class="cmb-que"><strong>${escapeHtml(x.nombre)}</strong>${x.ataques.length ? ` <small>${escapeHtml(x.ataques.join(' · '))}</small>` : ''}
          <small class="cmb-meta">${x.misma ? '<b>misma expansión</b> · ' : ''}id ${x.idProduct} · expansión ${escapeHtml(String(x.idExpansion ?? '?'))} · ${escapeHtml(precioCorto(x.precio))}</small></span>
        <a class="btn-secondary btn-small" href="${escapeHtml(x.enlace)}" target="_blank" rel="noopener">Ver ↗</a>
        <button type="button" class="btn-primary btn-small" data-cmb-usar="${x.idProduct}">${Number(actual) === x.idProduct ? 'Puesta' : 'Usar'}</button>
      </li>`).join('')}</ul>`
}

// Monta el botón y la caja debajo del campo. `nombre`: con lo que empieza
// la búsqueda (el inglés de la carta); `cerca`: los ids de las hermanas.
export function montarBuscadorCardmarket(input, { nombre = '', cerca = [] } = {}) {
  const label = input?.closest('label')
  if (!label || label.nextElementSibling?.classList.contains('cmb')) return
  const caja = document.createElement('div')
  caja.className = 'cmb'
  caja.innerHTML = `<button type="button" class="btn-secondary btn-small cmb-abrir">Buscar en Cardmarket</button>
    <div class="cmb-panel" hidden>
      <form class="cmb-form"><input type="search" class="cmb-q" value="${escapeHtml(nombre)}" aria-label="Nombre de la carta en Cardmarket" placeholder="Nombre en inglés"><button class="btn-secondary btn-small">Buscar</button></form>
      <div class="cmb-res" aria-live="polite"></div>
    </div>`
  label.after(caja)
  const panel = caja.querySelector('.cmb-panel')
  const res = caja.querySelector('.cmb-res')
  const q = caja.querySelector('.cmb-q')
  let ultimo = null

  async function buscar() {
    const texto = q.value.trim()
    if (!texto) return
    res.innerHTML = '<p class="admin-note">Buscando en el catálogo de Cardmarket… (la primera vez tarda unos segundos)</p>'
    try {
      const { supabase } = await import('../../js/supabase.js')
      const { data: { session } = {} } = await supabase.auth.getSession()
      const url = `/.netlify/functions/cardmarket-buscar?q=${encodeURIComponent(texto)}${cerca.length ? `&cerca=${cerca.join(',')}` : ''}`
      const r = await fetch(url, { headers: { authorization: `Bearer ${session?.access_token || ''}` } })
      ultimo = await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))
    } catch (e) {
      ultimo = { ok: false, error: String(e?.message || e).slice(0, 140) }
    }
    res.innerHTML = resultadosHtml(ultimo, input.value)
  }

  caja.querySelector('.cmb-abrir').addEventListener('click', () => {
    panel.hidden = !panel.hidden
    if (!panel.hidden && !ultimo && q.value.trim()) void buscar()
    if (!panel.hidden) q.focus()
  })
  caja.querySelector('.cmb-form').addEventListener('submit', (e) => { e.preventDefault(); void buscar() })
  res.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmb-usar]')
    if (!b) return
    input.value = b.dataset.cmbUsar
    input.dispatchEvent(new Event('input', { bubbles: true }))
    res.innerHTML = resultadosHtml(ultimo, input.value)
  })
}
