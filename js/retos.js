// Retos diarios (tanda 569; rehecho en la 835 con la maqueta que aprobó
// PINGU): el menú de los seis juegos, con el estado de HOY de cada uno, «Tu
// día», el día perfecto, tus logros de retos y tus últimos 60 días. El
// porqué, en SCHEMA.md.
import { escapeHtml, getSession } from './app.js'
import { icons } from './icons.js'
import { supabase } from './supabase.js'
import { yaJugadoHoy, diasJugados, hoyISO, PREGUNTAS_POR_RETO } from './reto-diario.js'
import { rachaDeDias, numeroDelDia } from './reto-compartir.js'
import { numeroDelDia as numeroDelDiaCarta } from './carta-del-dia.js'
import { numeroDelDia as numeroDelDiaMasCaro } from './mas-caro.js'
import { numeroDelDia as numeroDelDiaNuevos } from './quien-es.js'
import { RETOS, XP_DIA_PERFECTO, resumenLocal, resumenDeBase } from './retos-xp.js'
import { misNumeros } from './retos-datos.js'
import { cuentaAtras } from './retos-ui.js'
import { getAllAchievements } from './gamification.js'

const $ = (id) => document.getElementById(id)
const hoy = hoyISO()
const ID_ESTADO = { carta: 'rtCartaEstado', caro: 'rtMasCaroEstado', silueta: 'rtSiluetaEstado', ordena: 'rtOrdenaEstado', expansion: 'rtExpansionEstado' }
const NUMERO = { carta: () => `Carta #${numeroDelDiaCarta(hoy)}`, caro: () => `Reto #${numeroDelDiaMasCaro(hoy)}`, silueta: () => `Reto #${numeroDelDiaNuevos(hoy)}`, ordena: () => `Reto #${numeroDelDiaNuevos(hoy)}`, expansion: () => `Reto #${numeroDelDiaNuevos(hoy)}` }
// Los tipos de logro que son de los retos (los de la migración retos-xp).
const TIPOS_DE_RETOS = ['retos_racha', 'retos_perfectos', 'carta_primera', 'carta_aciertos', 'caro_perfectos', 'retos_jugados']
const COLOR_DE_RAREZA = { bronze: 'var(--rarity-bronze)', silver: 'var(--rarity-silver)', gold: 'var(--rarity-gold)', platinum: 'var(--rarity-platinum)' }

// Los cinco puntos del reto, como en la portada: acertados y no, para que
// quien no ha jugado vea la forma del reto antes de pulsar.
function puntosHtml(aciertos, total) {
  let html = ''
  for (let i = 0; i < total; i++) html += `<span class="rt-punto${i < aciertos ? ' acertado' : ''}"></span>`
  return `<span class="rt-puntos" aria-hidden="true">${html}</span>`
}

// TUS ÚLTIMOS 60 DÍAS (787, PA6): un cuadrito por día, el más viejo el
// primero y una columna por semana. `dias` es la lista de días jugados (lo
// de antes) o, desde la 835, { día: cuántos retos }, que da el tono. Puro,
// para poder probarlo.
export function calendarioHtml(dias, hoyDia, n = 60, { cifras = null } = {}) {
  const cuantos = Array.isArray(dias) ? Object.fromEntries(dias.map((d) => [d, 1])) : dias || {}
  const [y, m, d] = hoyDia.split('-').map(Number)
  const celdas = []
  let jugados = 0
  for (let i = n - 1; i >= 0; i--) {
    const dia = new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10)
    const k = Number(cuantos[dia]) || 0
    if (k) jugados++
    const tono = k >= 5 ? ' jugado n3' : k >= 3 ? ' jugado n2' : k ? ' jugado' : ''
    celdas.push(`<i class="rt-dia${tono}${i === 0 ? ' hoy' : ''}" title="${dia}"${k ? ` data-retos="${k}"` : ''}></i>`)
  }
  const datos = cifras
    ? `<div class="rt-cifras">${cifras.map(([v, t]) => `<div class="rt-cifra"><b>${v}</b><small>${escapeHtml(t)}</small></div>`).join('')}</div>`
    : `<p class="subtext">${jugados} ${jugados === 1 ? 'día jugado' : 'días jugados'}</p>`
  return `<h2>Tus últimos ${n} días</h2>
    <div class="rt-calendario-caja">
      <div>
        <div class="rt-dias" role="img" aria-label="${jugados} de ${n} días jugados">${celdas.join('')}</div>
        <p class="rt-leyenda">Ninguno <i class="rt-ley"></i><i class="rt-ley jugado"></i><i class="rt-ley jugado n2"></i><i class="rt-ley jugado n3"></i> Todos</p>
      </div>
      ${datos}
    </div>`
}

const leer = (clave) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') } catch { return null } }

// El estado de hoy de un juego: de la base si hay cuenta (y migración), si
// no del navegador.
function resumenDe(juego, numeros) {
  const reto = RETOS.find((r) => r.juego === juego)
  return resumenDeBase(juego, numeros?.hoy?.[juego]) || resumenLocal(juego, reto?.local ? leer(reto.local) : null, hoy)
}

function pintarJuego(juego, r) {
  const caja = $(ID_ESTADO[juego])
  const reto = RETOS.find((x) => x.juego === juego)
  if (!caja || !reto) return
  const sello = $(`rtSello-${juego}`)
  if (sello) {
    sello.classList.toggle('hidden', !r?.hecho && !r?.empezado)
    sello.classList.toggle('ok', Boolean(r?.hecho))
    sello.innerHTML = r?.hecho ? `${icons.checkCircle(14)} Hecho` : `${icons.clock(14)} A medias`
  }
  if (r?.hecho) {
    caja.innerHTML = `<span class="rt-hecho">${icons.checkCircle(18)} ${escapeHtml(r.texto)}${r.xp ? ` <small class="subtext">· +${r.xp} XP</small>` : ''}</span><a class="btn-secondary" href="${reto.ruta}">Resultado</a>`
  } else if (r?.empezado) {
    caja.innerHTML = `<span class="subtext">${escapeHtml(r.texto)}</span><a class="btn-primary" href="${reto.ruta}">Seguir →</a>`
  } else {
    caja.innerHTML = `<p class="rt-reto-num">${NUMERO[juego]()}</p><a class="btn-primary" href="${reto.ruta}">Jugar →</a>`
  }
}

// El de preguntas, como siempre: su estado sale de `daily_challenge_results`.
async function pintarHoy(session) {
  const caja = $('rtHoyEstado')
  if (!caja) return { hecho: false }
  const numero = numeroDelDia(hoy)
  // Sin cuenta también se enseña: es la mecánica más enganchosa de la
  // web, y el clic lleva al registro.
  if (!session) {
    caja.innerHTML = `
      <p class="rt-reto-num">Reto #${numero}</p>
      ${puntosHtml(0, PREGUNTAS_POR_RETO)}
      <a class="btn-primary" href="/auth.html?registro=1&volver=/reto">Crear cuenta y jugar →</a>`
    return { hecho: false }
  }
  const [jugado, dias] = await Promise.all([yaJugadoHoy(session.user.id), diasJugados(session.user.id)])
  const racha = rachaDeDias(dias, hoy)
  const rachaHtml = racha >= 2 ? `<span class="rt-chip rt-chip-racha">${icons.flame(14)} ${racha} días seguidos</span>` : ''
  const sello = $('rtSello-reto')
  if (sello && jugado) { sello.classList.remove('hidden'); sello.classList.add('ok'); sello.innerHTML = `${icons.checkCircle(14)} Hecho` }
  caja.innerHTML = jugado
    ? `
      <p class="rt-reto-num">Reto #${numero} · <strong>${jugado.correct} de ${jugado.total}</strong></p>
      ${puntosHtml(jugado.correct, jugado.total)}
      ${rachaHtml}
      <a class="btn-secondary" href="/usuarios.html">Ver la liga de la semana →</a>`
    : `
      <p class="rt-reto-num">Reto #${numero}</p>
      ${puntosHtml(0, PREGUNTAS_POR_RETO)}
      ${rachaHtml}
      <a class="btn-primary" href="/reto">Jugar el reto de hoy →</a>`
  return { hecho: Boolean(jugado), dias }
}

function pintarDia(hechos, numeros, session) {
  const total = RETOS.length
  $('rtAnillo').style.setProperty('--hecho', String(Math.round((hechos / total) * 100)))
  $('rtAnillo').innerHTML = `<b>${hechos}<small>/${total}</small></b>`
  const partes = []
  if (numeros) partes.push(`<span class="rt-xp">${icons.zap(14)} +${numeros.xpHoy || 0} XP hoy</span>`)
  if (numeros?.racha >= 1) partes.push(`<span class="rt-fuego">${icons.flame(14)} ${numeros.racha} ${numeros.racha === 1 ? 'día' : 'días seguidos'}</span>`)
  if (!session) partes.push('<span><a href="/auth.html?registro=1&amp;volver=/retos">Crea tu cuenta</a> y cada reto da XP</span>')
  $('rtDiaFila').innerHTML = partes.join('')
  cuentaAtras($('rtCuenta'), 'Nuevos retos en')
  // El día perfecto.
  const p = $('rtPerfecto')
  p.classList.toggle('hecho', hechos >= total)
  $('rtPerfectoIcono').innerHTML = icons.crown(22)
  $('rtPerfectoPasos').innerHTML = Array.from({ length: total }, (_, i) => `<i${i < hechos ? ' class="si"' : ''}></i>`).join('')
  const falta = total - hechos
  $('rtPerfectoTexto').innerHTML = hechos >= total
    ? `<b>¡Día perfecto!</b><br>Los seis retos de hoy${session ? `: +${XP_DIA_PERFECTO} XP extra` : ''}. Mañana, más.`
    : `<b>Día perfecto: ${falta === 1 ? 'te falta uno' : `te faltan ${falta}`}.</b><br>Completa los seis retos de hoy y llévate +${XP_DIA_PERFECTO} XP extra${session ? '' : ' (con cuenta)'}.`
}

// Tus logros de retos, con su barra.
async function pintarLogros(numeros, session) {
  const caja = $('rtLogros')
  let logros = []
  try {
    logros = (await getAllAchievements()).filter((a) => TIPOS_DE_RETOS.includes(a.condition?.type))
  } catch {}
  if (!logros.length) return
  let tuyos = []
  if (session) {
    try {
      const { data } = await supabase.from('user_profiles').select('achievements').eq('id', session.user.id).single()
      tuyos = data?.achievements || []
    } catch {}
  }
  const valor = { retos_racha: numeros?.mejorRacha, retos_perfectos: numeros?.diasPerfectos, carta_primera: numeros?.cartaPrimera, carta_aciertos: numeros?.cartaAciertos, caro_perfectos: numeros?.caroPerfectos, retos_jugados: numeros?.jugados }
  caja.innerHTML = `<h2>Tus logros de retos</h2>
    <p class="subtext">${session ? 'Cada logro da su XP al conseguirlo.' : '<a href="/auth.html?registro=1&amp;volver=/retos">Crea tu cuenta</a> para conseguirlos.'}</p>
    <div class="rt-logros">${logros.map((a) => {
      const meta = Number(a.condition?.count) || 1
      const v = Math.min(meta, Number(valor[a.condition.type]) || 0)
      const hecho = tuyos.includes(a.id)
      const icono = icons[a.emoji] || icons.medal
      return `<div class="rt-logro${hecho ? ' hecho' : ''}" style="--chapa:${COLOR_DE_RAREZA[a.rarity] || 'var(--navy)'}"><span class="rt-medalla">${icono(22)}</span><b>${escapeHtml(a.title)}</b><small>${escapeHtml(a.description || '')}${hecho ? ' · conseguido' : session && meta > 1 ? ` · ${v} de ${meta}` : ''}</small><span class="rt-barra"><i style="width:${hecho ? 100 : Math.round((v / meta) * 100)}%"></i></span></div>`
    }).join('')}</div>`
  caja.classList.remove('hidden')
}

function pintarCalendario(numeros, diasReto) {
  const caja = $('rtCalendario')
  if (!caja) return
  if (numeros?.dias) {
    caja.innerHTML = calendarioHtml(numeros.dias, hoy, 60, { cifras: [[numeros.jugados || 0, 'retos jugados'], [numeros.mejorRacha || 0, 'tu mejor racha'], [numeros.diasPerfectos || 0, 'días perfectos']] })
  } else if (diasReto?.length) {
    // Sin la migración de la 835: los días del reto de preguntas, como antes.
    caja.innerHTML = calendarioHtml(diasReto, hoy)
  } else return
  caja.classList.remove('hidden')
}

async function arrancar() {
  // Lo del navegador se pinta YA (sin esperar a la base).
  for (const j of Object.keys(ID_ESTADO)) pintarJuego(j, resumenDe(j, null))
  const session = await getSession().catch(() => null)
  import('./retos-comunidad.js').then(({ pintarComunidad }) => pintarComunidad($('rtComunidad'), session)).catch(() => {})
  const [quiz, numeros] = await Promise.all([
    pintarHoy(session).catch(() => {
      const caja = $('rtHoyEstado')
      if (caja) caja.innerHTML = '<a class="btn-primary" href="/reto">Jugar el reto de hoy →</a>'
      return { hecho: false }
    }),
    session ? misNumeros(60).catch(() => null) : null,
  ])
  let hechos = quiz.hecho ? 1 : 0
  for (const j of Object.keys(ID_ESTADO)) {
    const r = resumenDe(j, numeros)
    pintarJuego(j, r)
    if (r?.hecho) hechos++
  }
  pintarDia(hechos, numeros, session)
  pintarCalendario(numeros, quiz.dias)
  pintarLogros(numeros, session).catch(() => {})
}

if (typeof document !== 'undefined' && $('rtLista')) arrancar()
