// Retos diarios (tanda 569): el índice de los minijuegos, con el estado de
// HOY de cada uno. El porqué, en SCHEMA.md.
import { escapeHtml, getSession } from './app.js'
import { icons } from './icons.js'
import { yaJugadoHoy, diasJugados, hoyISO, PREGUNTAS_POR_RETO } from './reto-diario.js'
import { rachaDeDias, numeroDelDia } from './reto-compartir.js'
import { numeroDelDia as numeroDelDiaCarta, INTENTOS as INTENTOS_CARTA } from './carta-del-dia.js'
import { numeroDelDia as numeroDelDiaMasCaro, RONDAS } from './mas-caro.js'

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

// «¿Qué carta es?» guarda su partida en el navegador (se juega sin
// cuenta), así que su estado de hoy se lee de ahí: resuelto o no, y en
// cuántos intentos.
function pintarCartaDelDia() {
  const caja = $('rtCartaEstado')
  if (!caja) return
  let g = null
  try {
    g = JSON.parse(localStorage.getItem('pokedoc-carta-del-dia') || 'null')
  } catch {}
  const hoy = hoyISO()
  const numero = numeroDelDiaCarta(hoy)
  if (!g || g.dia !== hoy || !g.intentos?.length) {
    caja.innerHTML = `<p class="rt-reto-num">Carta #${numero}</p><a class="btn-primary" href="/carta-del-dia">Jugar →</a>`
    return
  }
  const acabada = g.acertada || g.intentos.length >= INTENTOS_CARTA
  caja.innerHTML = `
    <p class="rt-reto-num">Carta #${numero} · <strong>${g.acertada ? `acertada en ${g.intentos.length}` : acabada ? 'no acertada' : `${g.intentos.length} de ${INTENTOS_CARTA} intentos`}</strong></p>
    <a class="${acabada ? 'btn-secondary' : 'btn-primary'}" href="/carta-del-dia">${acabada ? 'Ver la carta →' : 'Seguir →'}</a>`
}
pintarCartaDelDia()

// «¿Más caro o más barato?» (tanda 583) también vive en el navegador.
function pintarMasCaro() {
  const caja = $('rtMasCaroEstado')
  if (!caja) return
  let g = null
  try {
    g = JSON.parse(localStorage.getItem('pokedoc-mas-caro') || 'null')
  } catch {}
  const hoy = hoyISO()
  const numero = numeroDelDiaMasCaro(hoy)
  if (!g || g.dia !== hoy || !g.respuestas?.length) {
    caja.innerHTML = `<p class="rt-reto-num">Reto #${numero}</p>${puntosHtml(0, RONDAS)}<a class="btn-primary" href="/mas-caro">Jugar →</a>`
    return
  }
  const aciertos = g.respuestas.filter(Boolean).length
  const acabado = g.respuestas.length >= RONDAS
  caja.innerHTML = `
    <p class="rt-reto-num">Reto #${numero} · <strong>${acabado ? `${aciertos} de ${RONDAS}` : `pregunta ${g.respuestas.length + 1} de ${RONDAS}`}</strong></p>
    ${puntosHtml(aciertos, RONDAS)}
    <a class="${acabado ? 'btn-secondary' : 'btn-primary'}" href="/mas-caro">${acabado ? 'Ver el resultado →' : 'Seguir →'}</a>`
}
pintarMasCaro()

pintarHoy().catch(() => {
  const caja = $('rtHoyEstado')
  if (caja) caja.innerHTML = `<a class="btn-primary" href="/reto">Jugar el reto de hoy →</a>`
})
