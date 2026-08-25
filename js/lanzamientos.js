// El calendario de lanzamientos: los próximos sets con cuenta atrás y
// los recién salidos. Los datos viven en site_settings (clave
// `lanzamientos`, valor { sets: [{ nombre, fecha, imagen, notas }] }) y
// se editan desde el /admin — una lista corta mantenida a mano, sin
// depender de ninguna fuente externa.
//
// Las fechas son AAAA-MM-DD y se comparan como texto contra el día de
// hoy en UTC (como todas las fechas de la casa): comparar strings
// funciona porque el formato ordena solo.
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { icons } from './icons.js'

export function diasHasta(fecha, hoy = new Date().toISOString().slice(0, 10)) {
  const ms = Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)
  return Math.round(ms / 86400_000)
}

export function cuentaAtras(dias) {
  if (dias === 0) return '¡Sale hoy!'
  if (dias === 1) return 'Sale mañana'
  return `Faltan ${dias} días`
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function fechaBonita(fecha) {
  const [a, m, d] = String(fecha).split('-').map(Number)
  if (!a || !m || !d) return fecha
  return `${d} de ${MESES[m - 1]} de ${a}`
}

// Los sets guardados, ya ordenados por fecha y partidos en futuros y
// pasados. Sin tabla, sin datos o con un valor con mala forma: vacío.
export async function cargarSets() {
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'lanzamientos').maybeSingle()
    const sets = (data?.value?.sets || []).filter((s) => s && s.nombre && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha || ''))
    sets.sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    const hoy = new Date().toISOString().slice(0, 10)
    return {
      proximos: sets.filter((s) => s.fecha >= hoy),
      pasados: sets.filter((s) => s.fecha < hoy).reverse(),
    }
  } catch {
    return { proximos: [], pasados: [] }
  }
}

function tarjetaHtml(s, futuro) {
  const dias = diasHasta(s.fecha)
  return `
    <div class="lanzamiento-tarjeta ${futuro ? '' : 'lanzamiento-pasado'}">
      ${s.imagen ? `<img class="lanzamiento-logo" src="${escapeHtml(s.imagen)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : `<span class="lanzamiento-logo lanzamiento-logo-hueco">${icons.cards(22)}</span>`}
      <div class="lanzamiento-texto">
        <strong>${escapeHtml(s.nombre)}</strong>
        <span class="subtext">${fechaBonita(s.fecha)}${s.notas ? ` · ${escapeHtml(s.notas)}` : ''}</span>
      </div>
      ${futuro ? `<span class="lanzamiento-cuenta">${cuentaAtras(dias)}</span>` : ''}
    </div>`
}

async function init() {
  const destacadoEl = document.getElementById('proximoDestacado')
  if (!destacadoEl) return
  const { proximos, pasados } = await cargarSets()

  if (!proximos.length && !pasados.length) {
    document.getElementById('lanzamientosVacio').classList.remove('hidden')
    return
  }

  if (proximos.length) {
    const [primero, ...resto] = proximos
    destacadoEl.innerHTML = `
      <div class="lanzamiento-destacado">
        ${primero.imagen ? `<img class="lanzamiento-logo-grande" src="${escapeHtml(primero.imagen)}" alt="" decoding="async" referrerpolicy="no-referrer" />` : ''}
        <div>
          <span class="eyebrow">El siguiente set</span>
          <h2>${escapeHtml(primero.nombre)}</h2>
          <p class="subtext">${fechaBonita(primero.fecha)}${primero.notas ? ` · ${escapeHtml(primero.notas)}` : ''}</p>
        </div>
        <span class="lanzamiento-cuenta lanzamiento-cuenta-grande">${cuentaAtras(diasHasta(primero.fecha))}</span>
      </div>`
    destacadoEl.classList.remove('hidden')

    if (resto.length) {
      document.getElementById('listaProximos').innerHTML = resto.map((s) => tarjetaHtml(s, true)).join('')
      document.getElementById('seccionProximos').classList.remove('hidden')
    }
  }

  if (pasados.length) {
    // Los recién salidos: los últimos 6, que es lo que aún interesa.
    document.getElementById('listaPasados').innerHTML = pasados.slice(0, 6).map((s) => tarjetaHtml(s, false)).join('')
    document.getElementById('seccionPasados').classList.remove('hidden')
  }
}

init()
