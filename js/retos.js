// Retos diarios (tanda 569): el índice de los minijuegos, con el estado de
// HOY de cada uno. El porqué, en SCHEMA.md.
import { escapeHtml, getSession } from './app.js'
import { icons } from './icons.js'
import { yaJugadoHoy, diasJugados, hoyISO, PREGUNTAS_POR_RETO } from './reto-diario.js'
import { rachaDeDias, numeroDelDia } from './reto-compartir.js'

const $ = (id) => document.getElementById(id)

// Los cinco puntos del reto, como en la portada: acertados y no, para que
// quien no ha jugado vea la forma del reto antes de pulsar.
function puntosHtml(aciertos, total) {
  let html = ''
  for (let i = 0; i < total; i++) html += `<span class="rt-punto${i < aciertos ? ' acertado' : ''}"></span>`
  return `<span class="rt-puntos" aria-hidden="true">${html}</span>`
}

async function pintarHoy() {
  const caja = $('rtHoyEstado')
  if (!caja) return
  const numero = numeroDelDia(hoyISO())
  const session = await getSession()
  // Sin cuenta también se enseña: es la mecánica más enganchosa de la
  // web, y el clic lleva al registro.
  if (!session) {
    caja.innerHTML = `
      <p class="rt-reto-num">Reto #${numero}</p>
      ${puntosHtml(0, PREGUNTAS_POR_RETO)}
      <a class="btn-primary" href="/auth.html?registro=1&volver=/reto">Crear cuenta y jugar →</a>`
    return
  }
  const [jugado, dias] = await Promise.all([yaJugadoHoy(session.user.id), diasJugados(session.user.id)])
  const racha = rachaDeDias(dias, hoyISO())
  const rachaHtml = racha >= 2 ? `<span class="rt-chip rt-chip-racha">${icons.flame(14)} ${racha} días seguidos</span>` : ''
  caja.innerHTML = jugado
    ? `
      <p class="rt-reto-num">Reto #${numero} · <strong>${jugado.correct} de ${jugado.total}</strong></p>
      ${puntosHtml(jugado.correct, jugado.total)}
      ${rachaHtml}
      <p class="subtext">Ya está el de hoy. Mañana hay cinco preguntas nuevas.</p>
      <a class="btn-secondary" href="/usuarios.html">Ver la liga de la semana →</a>`
    : `
      <p class="rt-reto-num">Reto #${numero}</p>
      ${puntosHtml(0, PREGUNTAS_POR_RETO)}
      ${rachaHtml}
      <a class="btn-primary" href="/reto">Jugar el reto de hoy →</a>`
}

pintarHoy().catch(() => {
  const caja = $('rtHoyEstado')
  if (caja) caja.innerHTML = `<a class="btn-primary" href="/reto">Jugar el reto de hoy →</a>`
})
