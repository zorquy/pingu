// LA PORTADA «HOY» (744, J5 de la lista de propuestas). Para quien tiene
// cuenta, la portada era una pila de bloques —bienvenida, primeros pasos,
// reto, torneo, foro, lanzamiento…— y lo de HOY había que ir a buscarlo
// bajando. Ahora, debajo del saludo con tu racha, un bloque con lo que
// cambia cada día: lo que vale tu colección con su línea de 30 días y
// cuatro fichas —el reto, tu próximo torneo, el próximo lanzamiento y las
// respuestas en tus hilos—. Lo de debajo sigue igual: es el detalle.
//
// Entra por `import()` desde home.js y solo con sesión, con su hoja: la
// portada tiene 0,4 KB de presupuesto y esto no los toca (la 704).
//
// Cada ficha se pinta con lo que haya y dice «no se sabe» con un guion, no
// con un cero (la 319): si una consulta falla, la ficha se queda, sin
// cifra inventada.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { euros } from './cardmarket.js'
import { hojaInyectada } from './hoja.js'

const DIA = 86_400_000
const hoyISO = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 10)

// El cambio de los últimos 30 días, solo si el histórico los cubre (la
// 653: con tres fotos no se afirma un mes). Puro.
export function cambioDelMes(filas, ahora = Date.now()) {
  const dias = (filas || []).filter((f) => Number.isFinite(Number(f.valor)) && /^\d{4}-\d{2}-\d{2}/.test(String(f.dia))).sort((a, b) => String(a.dia).localeCompare(String(b.dia)))
  if (dias.length < 2) return null
  const corte = hoyISO(ahora - 30 * DIA)
  const antes = [...dias].reverse().find((f) => String(f.dia) <= corte)
  if (!antes) return null
  const ultimo = Number(dias[dias.length - 1].valor)
  const cambio = ultimo - Number(antes.valor)
  return { cambio, pct: Number(antes.valor) > 0 ? (cambio / Number(antes.valor)) * 100 : null }
}

// La línea del valor: un trazo de 120×32 con los últimos puntos. Puro.
export function chispaSvg(filas, { ancho = 120, alto = 32 } = {}) {
  const v = (filas || []).map((f) => Number(f.valor)).filter(Number.isFinite)
  if (v.length < 2) return ''
  const min = Math.min(...v)
  const max = Math.max(...v)
  const y = (x) => (max === min ? alto / 2 : alto - 2 - ((x - min) / (max - min)) * (alto - 4))
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * ancho).toFixed(1)},${y(x).toFixed(1)}`).join(' ')
  return `<svg class="hoy-chispa" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" aria-hidden="true" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`
}

// «hoy», «mañana», «en 3 días» o la fecha. Puro.
export function cuandoEs(fecha, ahora = Date.now()) {
  const d = Math.round((Date.parse(`${String(fecha).slice(0, 10)}T00:00:00Z`) - Date.parse(`${hoyISO(ahora)}T00:00:00Z`)) / DIA)
  if (!Number.isFinite(d)) return ''
  if (d <= 0) return 'hoy'
  if (d === 1) return 'mañana'
  if (d < 7) return `en ${d} días`
  return new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const ficha = ({ href, icono, rotulo, titular, sub, hecho = false }) => `
  <a class="hoy-ficha${hecho ? ' hoy-hecho' : ''}" href="${escapeHtml(href)}">
    <span class="hoy-ficha-icono" aria-hidden="true">${icons[icono]?.(18) || ''}</span>
    <span class="hoy-ficha-texto"><small>${escapeHtml(rotulo)}</small><b>${escapeHtml(titular)}</b>${sub ? `<span>${escapeHtml(sub)}</span>` : ''}</span>
  </a>`

// Las cuatro fichas, con lo que se sepa de cada una. Puro.
export function fichasHtml({ reto = null, torneo = null, lanzamiento = null, respuestas = null } = {}, ahora = Date.now()) {
  return [
    ficha(
      reto === null
        ? { href: '/retos', icono: 'zap', rotulo: 'Reto de hoy', titular: 'Cinco preguntas', sub: 'Juégalo en un minuto' }
        : reto
          ? { href: '/retos', icono: 'checkCircle', rotulo: 'Reto de hoy', titular: `Hecho: ${reto.correct ?? 0} de ${reto.total ?? 5}`, sub: 'Vuelve mañana', hecho: true }
          : { href: '/retos', icono: 'zap', rotulo: 'Reto de hoy', titular: 'Te toca jugar', sub: 'Cinco preguntas, un minuto' }
    ),
    ficha(
      torneo
        ? { href: `/torneo?slug=${encodeURIComponent(torneo.slug)}`, icono: 'trophy', rotulo: torneo.mio ? 'Tu próximo torneo' : 'Próximo torneo', titular: torneo.name, sub: cuandoEs(torneo.start_at, ahora) }
        : { href: '/torneos.html', icono: 'trophy', rotulo: 'Torneos', titular: 'Ninguno a la vista', sub: 'Mira el calendario' }
    ),
    ficha(
      lanzamiento
        ? { href: '/lanzamientos.html', icono: 'calendar', rotulo: 'Próximo lanzamiento', titular: lanzamiento.nombre, sub: `Sale ${cuandoEs(lanzamiento.fecha, ahora)}` }
        : { href: '/lanzamientos.html', icono: 'calendar', rotulo: 'Lanzamientos', titular: 'El calendario', sub: '' }
    ),
    ficha({
      href: '/foro.html',
      icono: 'messageSquare',
      rotulo: 'Tus hilos',
      titular: respuestas == null ? 'El foro' : respuestas ? `${respuestas} ${respuestas === 1 ? 'respuesta nueva' : 'respuestas nuevas'}` : 'Nada nuevo',
      sub: respuestas ? 'Sin leer' : '',
    }),
  ].join('')
}

// El valor de tu colección: la última foto, su línea y lo que se ha movido
// en 30 días. Sin fotos todavía, la tarjeta invita a Mi colección; sin la
// migración del histórico, no sale.
export function valorHtml(filas) {
  if (!filas) return ''
  if (!filas.length) {
    return `<a class="hoy-valor" href="/mi-coleccion"><small>Tu colección</small><b>Empieza a llevarla</b><span>Añade tus cartas y aquí verás lo que vale</span></a>`
  }
  const ultimo = filas[filas.length - 1]
  const mes = cambioDelMes(filas)
  const tono = mes ? (mes.cambio > 0 ? 'sube' : mes.cambio < 0 ? 'baja' : 'igual') : ''
  const signo = mes && mes.cambio > 0 ? '+' : mes && mes.cambio < 0 ? '−' : ''
  return `<a class="hoy-valor" href="/mi-coleccion">
    <small>Tu colección</small>
    <b>${escapeHtml(euros(Number(ultimo.valor)))}</b>
    ${mes ? `<span class="hoy-valor-mes ${tono}">${signo}${escapeHtml(euros(Math.abs(mes.cambio)))}${mes.pct != null ? ` (${signo}${Math.abs(Math.round(mes.pct))} %)` : ''} en 30 días</span>` : '<span>Todavía sin un mes de historia</span>'}
    ${chispaSvg(filas.slice(-30))}
  </a>`
}

async function intentar(fn) {
  try { return await fn() } catch { return undefined }
}

export async function montarHoy(session, { doc = document } = {}) {
  const seccion = doc.getElementById('bienvenidaSeccion')
  if (!session || !seccion || doc.getElementById('hoyPortada')) return null
  hojaInyectada('css/hoy.css')
  const uid = session.user.id
  const caja = doc.createElement('div')
  caja.className = 'hoy'
  caja.id = 'hoyPortada'
  caja.setAttribute('aria-label', 'Hoy')
  caja.innerHTML = `<h2 class="hoy-titulo">Hoy</h2><div class="hoy-rejilla"><div class="skeleton" style="height:96px"></div></div>`
  seccion.appendChild(caja)

  const hoy = hoyISO()
  const [valor, reto, mio, abierto, sets, respuestas] = await Promise.all([
    intentar(async () => {
      const { data, error } = await supabase.from('user_collection_value').select('dia,valor').eq('user_id', uid).gte('dia', hoyISO(Date.now() - 60 * DIA)).order('dia', { ascending: true })
      return error ? null : data || []
    }),
    intentar(async () => {
      const { data, error } = await supabase.from('daily_challenge_results').select('correct, total').eq('user_id', uid).eq('day', hoy).maybeSingle()
      return error ? null : data || false
    }),
    // Tu próximo torneo, en dos pasos y no con un embebido: tus
    // inscripciones y luego esos torneos, los que no han acabado.
    intentar(async () => {
      const { data: insc } = await supabase.from('tournament_registrations').select('tournament_id').eq('user_id', uid).eq('status', 'active')
      const ids = [...new Set((insc || []).map((r) => r.tournament_id).filter(Boolean))]
      if (!ids.length) return null
      const { data } = await supabase.from('tournaments').select('id, slug, name, start_at, status').in('id', ids).gte('start_at', new Date(Date.now() - 6 * 3600e3).toISOString()).order('start_at', { ascending: true })
      return (data || []).find((t) => t.status !== 'finished' && t.status !== 'cancelled') || null
    }),
    intentar(async () => {
      const { data } = await supabase.from('tournaments').select('id, slug, name, start_at').eq('status', 'registration_open').gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(1)
      return (data || [])[0] || null
    }),
    intentar(async () => {
      const { data } = await supabase.from('tcg_sets').select('name,name_en,release_date,oculto').eq('market', 'WEST').neq('serie_id', 'tcgp').gte('release_date', hoy).order('release_date').limit(3)
      return (data || []).filter((s) => !s.oculto && s.release_date)
    }),
    intentar(async () => {
      const { count, error } = await supabase.from('user_notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', uid).eq('type', 'forum_reply').is('read_at', null)
      return error ? null : count ?? null
    }),
  ])
  const torneo = mio ? { ...mio, mio: true } : abierto || null
  const lanzamiento = sets?.[0] ? { nombre: sets[0].name || sets[0].name_en, fecha: sets[0].release_date } : null
  caja.querySelector('.hoy-rejilla').innerHTML = valorHtml(valor ?? null) + fichasHtml({ reto: reto === undefined ? null : reto, torneo, lanzamiento, respuestas: respuestas ?? null })
  return caja
}
