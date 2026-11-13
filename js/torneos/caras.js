// Las piezas con cara de los torneos (tanda 1347, la propuesta «Torneos con
// caras» de PINGU: «debería salir los avatares de cada uno para visualizarlo
// más fácil»). La misma cara en la clasificación, las mesas, los inscritos,
// el podio y el tablón: la foto si la hay y, si no, la inicial sobre el color
// de la casa (avatarStyle), como en el resto de la web.
import { escapeHtml, avatarStyle, getInitial } from '../app.js'

// `tam`: '' (30 px), 'p' (22), 'g' (44) o 'xg' (64).
export function caraHtml(perfil, nombre, tam = '') {
  const n = nombre || perfil?.username || '?'
  return `<span class="torneo-cara${tam ? ` torneo-cara-${tam}` : ''}" style="${avatarStyle(perfil || { username: n })}" aria-hidden="true">${
    perfil?.avatar_url ? '' : escapeHtml(getInitial(n))
  }</span>`
}

// La forma: los últimos resultados, del más viejo al más nuevo, en cuadritos
// (V verde, D rojo, E gris, B el bye). `letras` es una lista como ['V','D','V'].
const TITULO = { V: 'victoria', D: 'derrota', E: 'empate', B: 'bye' }
export function formaHtml(letras) {
  if (!letras?.length) return ''
  const dicho = letras.map((l) => TITULO[l] || l).join(', ')
  return `<span class="torneo-forma" title="Últimos resultados: ${escapeHtml(dicho)}"><span class="sr-only">Últimos resultados: ${escapeHtml(dicho)}</span>${letras
    .map((l) => `<i class="torneo-forma-${String(l).toLowerCase()}" aria-hidden="true">${escapeHtml(l)}</i>`)
    .join('')}</span>`
}

// La flecha de cuántos puestos ha subido o bajado desde la jornada (o la
// ronda) anterior. Sin dato, nada.
export function movimientoHtml(antes, ahora) {
  if (!antes || !ahora) return ''
  const d = antes - ahora
  if (!d) return '<span class="torneo-mov igual" title="Mismo puesto que antes" aria-hidden="true">=</span>'
  return `<span class="torneo-mov ${d > 0 ? 'sube' : 'baja'}" title="${d > 0 ? 'Sube' : 'Baja'} ${Math.abs(d)} ${Math.abs(d) === 1 ? 'puesto' : 'puestos'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>`
}

// «6 d 23 h», «3 h 12 min», «8 min»: lo que falta para una cita.
export function faltaPara(fecha, ahora = Date.now()) {
  const ms = Date.parse(fecha) - ahora
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.floor(ms / 60000)
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  if (d) return `${d} d ${h} h`
  if (h) return `${h} h ${min % 60} min`
  return `${Math.max(1, min)} min`
}
