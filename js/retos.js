// Retos diarios (tanda 569; rehecho en la 835 y compacto desde la 989,
// «Retos, más limpios»): el menú de los seis juegos con el estado de HOY de
// cada uno en una línea, lo de hoy en una píldora, la barra del día perfecto
// y, plegado, tu historial (la liga de la semana, «Hoy en PokeDoc», tus
// logros y tus últimos 60 días), que se pide al abrirlo. El porqué, en
// SCHEMA.md.
import { escapeHtml, getSession } from './app.js'
import { icons } from './icons.js'
import { supabase } from './supabase.js'
import { hoyISO } from './reto-diario.js'
import { RETOS, XP_DIA_PERFECTO, resumenLocal, resumenDeBase } from './retos-xp.js'
import { misNumeros } from './retos-datos.js'
import { hastaManana } from './retos-ui.js'
import { getAllAchievements } from './gamification.js'

const $ = (id) => document.getElementById(id)
const hoy = hoyISO()
const ID_ESTADO = { carta: 'rtCartaEstado', caro: 'rtMasCaroEstado', silueta: 'rtSiluetaEstado', ordena: 'rtOrdenaEstado', expansion: 'rtExpansionEstado', parejas: 'rtParejasEstado' }
// «Nuevo» en la baldosa de un reto hasta este día (la primera semana).
const NUEVO_HASTA = { parejas: '2026-10-30' }
// Los tipos de logro que son de los retos (los de la migración retos-xp).
const TIPOS_DE_RETOS = ['retos_racha', 'retos_perfectos', 'carta_primera', 'carta_aciertos', 'caro_perfectos', 'retos_jugados']
const COLOR_DE_RAREZA = { bronze: 'var(--rarity-bronze)', silver: 'var(--rarity-silver)', gold: 'var(--rarity-gold)', platinum: 'var(--rarity-platinum)' }

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

const leer = (clave) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') } catch { return null } }

// El estado de hoy de un juego: de la base si hay cuenta (y migración), si
// no del navegador.
function resumenDe(juego, numeros) {
  const reto = RETOS.find((r) => r.juego === juego)
  return resumenDeBase(juego, numeros?.hoy?.[juego]) || resumenLocal(juego, reto?.local ? leer(reto.local) : null, hoy)
}

// Una baldosa: el sello del dibujo y UNA línea. Sin jugar, lo que da; a
// medias, cómo va; hecho, cómo te fue y lo que te dio.
function pintarJuego(juego, r) {
  const caja = $(ID_ESTADO[juego])
  const reto = RETOS.find((x) => x.juego === juego)
  if (!caja || !reto) return
  const sello = $(`rtSello-${juego}`)
  if (sello) {
    sello.classList.toggle('hidden', !r?.hecho && !r?.empezado)
    sello.classList.toggle('ok', Boolean(r?.hecho))
    sello.innerHTML = r?.hecho ? `${icons.checkCircle(12)} Hecho` : `${icons.clock(12)} A medias`
  }
  caja.classList.toggle('hecho', Boolean(r?.hecho))
  caja.innerHTML = r?.hecho
    ? `${icons.checkCircle(14)} ${escapeHtml(r.texto)}${r.xp ? `<span class="rt-estado-xp"> · +${r.xp} XP</span>` : ''}`
    : r?.empezado
      ? `A medias · ${escapeHtml(r.texto)}`
      : escapeHtml(reto.chips.join(' · '))
}

// La píldora de arriba y la barra del día perfecto.
let pararCuenta = () => {}
function pintarDia(hechos, numeros, session) {
  const total = RETOS.length
  const partes = [`<span id="rtHechos">${hechos}/${total} <span class="cab-largo">hoy</span></span>`]
  if (numeros) partes.push(`<span class="rt-xp">${icons.zap(14)} +${numeros.xpHoy || 0} XP</span>`)
  if (numeros?.racha >= 1) partes.push(`<span class="rt-fuego">${icons.flame(14)} ${numeros.racha} ${numeros.racha === 1 ? 'día' : 'días'}</span>`)
  $('rtDia').innerHTML = partes.join('')
  const p = $('rtPerfecto')
  p.classList.toggle('hecho', hechos >= total)
  $('rtBarraDia').style.width = `${Math.round((hechos / total) * 100)}%`
  const falta = total - hechos
  const conCuenta = session ? '' : ' <a href="/auth.html?registro=1&amp;volver=/retos">Crea tu cuenta</a> y cada reto da XP.'
  const pintar = () => {
    const cuenta = `los de mañana salen en <b>${hastaManana()}</b>`
    $('rtPerfectoTexto').innerHTML = hechos >= total
      ? `¡Día perfecto!${session ? ` +${XP_DIA_PERFECTO} XP extra` : ''} · ${cuenta}${conCuenta}`
      : `Día perfecto: ${falta === 1 ? 'te falta uno' : `te faltan ${falta}`} (+${XP_DIA_PERFECTO} XP) · ${cuenta}${conCuenta}`
  }
  pararCuenta()
  pintar()
  const t = setInterval(pintar, 1000)
  pararCuenta = () => clearInterval(t)
}

// La liga de la semana (989): la XP de los seis retos, de lunes a domingo
// (`portada_clasificacion`, la que enseña entera la portada).
async function pintarLiga(session) {
  const caja = $('rtLiga')
  if (!caja || !session) return
  const { data, error } = await supabase.rpc('portada_clasificacion', { p_periodo: 'semana' })
  if (error || !data) return
  const tu = data.tu
  const texto = tu?.puesto ? `Vas <b>${tu.puesto}.º</b> en la liga de la semana, con ${tu.xp} XP` : 'Esta semana todavía no puntúas en la liga: cada reto suma su XP'
  caja.innerHTML = `<p class="rt-liga"><span>${icons.trophy(16)} ${texto}.</span><a class="btn-secondary" href="/#clasificacion">Ver la clasificación</a></p>`
  caja.classList.remove('hidden')
}

function pintarCalendario(numeros) {
  const caja = $('rtCalendario')
  if (!caja || !numeros?.dias) return
  caja.innerHTML = calendarioHtml(numeros.dias, hoy, 60, { cifras: [[numeros.jugados || 0, 'retos jugados'], [numeros.mejorRacha || 0, 'tu mejor racha'], [numeros.diasPerfectos || 0, 'días perfectos']] })
  // «Compartir mi mes» (873): los últimos 30 días en un texto o una imagen.
  if (numeros.jugados) {
    caja.insertAdjacentHTML('beforeend', `<p class="rt-mes-compartir"><button type="button" class="btn-secondary rt-compartir-mes">${icons.share(14)} Compartir mi mes</button></p>`)
    caja.querySelector('.rt-compartir-mes')?.addEventListener('click', () => {
      import('./mi-dia-compartir.js').then(({ compartirMiMes }) => compartirMiMes({ hoy, numeros })).catch(() => {})
    })
  }
  caja.classList.remove('hidden')
}

// Lo plegado se pide al abrirlo, una vez.
function prepararHistorial(session, numeros) {
  const d = $('rtHistorial')
  if (!d) return
  let pedido = false
  const abrir = () => {
    if (!d.open || pedido) return
    pedido = true
    pintarLiga(session).catch(() => {})
    import('./retos-comunidad.js').then(({ pintarComunidad }) => pintarComunidad($('rtComunidad'), session)).catch(() => {})
    pintarLogros(numeros, session).catch(() => {})
    pintarCalendario(numeros)
  }
  d.addEventListener('toggle', abrir)
  abrir()
}

async function arrancar() {
  // Lo del navegador se pinta YA (sin esperar a la base).
  for (const j of Object.keys(ID_ESTADO)) pintarJuego(j, resumenDe(j, null))
  for (const [j, hasta] of Object.entries(NUEVO_HASTA)) {
    if (hoy <= hasta) document.querySelector(`#${ID_ESTADO[j].replace('Estado', '')} .rt-arte`)?.insertAdjacentHTML('afterbegin', '<span class="rt-nuevo">Nuevo</span>')
  }
  const session = await getSession().catch(() => null)
  const numeros = session ? await misNumeros(60).catch(() => null) : null
  let hechos = 0
  for (const j of Object.keys(ID_ESTADO)) {
    const r = resumenDe(j, numeros)
    pintarJuego(j, r)
    if (r?.hecho) hechos++
  }
  pintarDia(hechos, numeros, session)
  prepararHistorial(session, numeros)
}

if (typeof document !== 'undefined' && $('rtLista')) arrancar()
