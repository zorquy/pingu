// /meta?ver=torneos: la lista de «Por torneo» (tanda 1421). Cada torneo en
// una fila: la fecha, el nombre con su chapa y cuántos jugaron, quién ganó y
// con qué, y el Top 8 en mazos. Entra por `import()` desde meta.js: quien
// solo mira el ranking no lo baja.
import { escapeHtml } from '../html.js'
import { iconoHtml, iconosHtml } from './pintar.js'
import { entero } from './nucleo.js'
import { listaDeTorneos, topsDe, arquetiposDe } from './torneos-datos.js'
import { topPorTorneo, rutaDeTorneo, chapaDeTorneo, nombreDeJugador, TOP } from './torneos-nucleo.js'

const MES = new Intl.DateTimeFormat('es-ES', { month: 'short' })

function fechaHtml(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '<span class="mt-fecha"></span>'
  return `<span class="mt-fecha"><b>${d.getDate()}</b><small>${escapeHtml(MES.format(d).replace('.', ''))}</small></span>`
}

export function chapaHtml(t) {
  const c = chapaDeTorneo(t)
  return `<span class="mt-chapa mt-chapa-${c.clase}">${escapeHtml(c.texto)}</span>`
}

function campeonHtml(fila, arqs) {
  if (!fila) return '<span class="mt-campeon mt-campeon-vacio">Sin clasificación todavía</span>'
  const a = arqs.get(fila.arquetipo)
  const quien = [nombreDeJugador(fila), fila.pais].filter(Boolean).join(' · ')
  return `
    <span class="mt-campeon">
      ${iconosHtml(a?.iconos)}
      <span class="mt-campeon-texto">
        <small>Campeón</small>
        <b>${escapeHtml(a?.nombre || fila.arquetipo)}</b>
        ${quien ? `<em>${escapeHtml(quien)}</em>` : ''}
      </span>
    </span>`
}

function topHtml(filas, arqs) {
  if (!filas?.length) return '<span class="mt-top"></span>'
  const mini = filas.slice(0, TOP).map((f) => {
    const a = arqs.get(f.arquetipo)
    const icono = (a?.iconos || [])[0]
    return `<span class="mt-mini" title="${escapeHtml(`${f.puesto}.º · ${a?.nombre || f.arquetipo}`)}">${icono ? iconoHtml(icono) : ''}</span>`
  }).join('')
  return `<span class="mt-top"><small>Top ${Math.min(filas.length, TOP)}</small><span class="mt-minis">${mini}</span></span>`
}

export function filaDeTorneoHtml(t, top, arqs, consulta = '') {
  const campeon = (top || []).find((f) => Number(f.puesto) === 1)
  return `
    <li class="mt-fila${t.fuente === 'oficial' ? ' mt-fila-oficial' : ''}">
      <a class="mt-enlace" href="${escapeHtml(rutaDeTorneo(t.id) + consulta)}">
        ${fechaHtml(t.fecha)}
        <span class="mt-nombre">
          <strong>${escapeHtml(t.nombre)}</strong>
          <span class="mt-sub">${chapaHtml(t)}<span>${entero(t.jugadores)} ${Number(t.jugadores) === 1 ? 'jugador' : 'jugadores'}</span></span>
        </span>
        ${campeonHtml(campeon, arqs)}
        ${topHtml(top, arqs)}
      </a>
    </li>`
}

// Pinta la lista en `caja` y lleva sus páginas. Devuelve una función para
// cancelarla (otro filtro pulsado antes de que llegue).
export function montarListaDeTorneos(caja, { dias, fuente }) {
  let vivo = true
  let desde = 0
  const consulta = (() => {
    const q = new URLSearchParams()
    if (dias !== 14) q.set('dias', String(dias))
    if (fuente) q.set('fuente', fuente)
    return q.toString() ? `?${q}` : ''
  })()
  caja.innerHTML = '<ol class="mt-lista" aria-busy="true">' + '<li class="esq-meta" aria-hidden="true"><span class="esq-linea"></span></li>'.repeat(5) + '</ol><div class="mt-pie"></div>'
  const lista = caja.querySelector('.mt-lista')
  const pie = caja.querySelector('.mt-pie')

  async function pagina() {
    const { torneos, hayMas } = await listaDeTorneos({ dias, fuente, desde })
    if (!vivo) return
    const filas = await topsDe(torneos.map((t) => t.id))
    if (!vivo) return
    const arqs = await arquetiposDe(filas.map((f) => f.arquetipo))
    if (!vivo) return
    const tops = topPorTorneo(filas)
    if (!desde) lista.innerHTML = ''
    lista.removeAttribute('aria-busy')
    if (!desde && !torneos.length) {
      lista.innerHTML = `<li class="mt-vacio">${fuente === 'pokedoc'
        ? 'No hay torneos de PokeDoc terminados en este periodo. <a href="/torneos.html">Mira los próximos</a>.'
        : `No hubo ${fuente === 'oficial' ? 'torneos oficiales' : fuente === 'online' ? 'torneos online' : 'torneos'} en estos ${dias} días. Prueba con un periodo más largo.`}</li>`
    }
    lista.insertAdjacentHTML('beforeend', torneos.map((t) => filaDeTorneoHtml(t, tops.get(t.id), arqs, consulta)).join(''))
    desde += torneos.length
    pie.innerHTML = hayMas ? '<button type="button" class="btn-secondary mt-mas">Ver más torneos</button>' : ''
  }

  pie.addEventListener('click', async (e) => {
    const b = e.target.closest('.mt-mas')
    if (!b) return
    b.disabled = true
    b.textContent = 'Cargando…'
    try {
      await pagina()
    } catch (err) {
      b.disabled = false
      b.textContent = 'Ver más torneos'
      pie.insertAdjacentHTML('beforeend', `<p class="meta-aviso">${escapeHtml(err.message)}</p>`)
    }
  })

  pagina().catch((err) => {
    if (!vivo) return
    lista.removeAttribute('aria-busy')
    lista.innerHTML = `<li class="mt-vacio">${escapeHtml(err.message)} <button type="button" class="link-btn" data-reintentar>Reintentar</button></li>`
    lista.querySelector('[data-reintentar]')?.addEventListener('click', () => { desde = 0; pagina().catch(() => {}) })
  })
  return () => { vivo = false }
}
