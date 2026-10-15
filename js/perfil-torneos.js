// La pestaña «Torneos» de una ficha de persona (867): el palmarés arriba
// —las medallas de torneo con su color de rareza y el resumen («4 torneos
// · 1 campeonato · a 3 de Veterano»)— y debajo en qué torneos está: jugando
// ahora, apuntado y jugados con su puesto. Era «Mis torneos» en tu perfil
// (236) y una fila de palmarés colgada de la cabecera en el de otro (262);
// desde la 867 es la misma pestaña para los dos, en este módulo. Se pinta la
// primera vez que se abre, como el foro: son tres consultas que la mayoría
// de las visitas no necesita.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { achievementIconHtml } from './app.js'
import { getAllAchievements } from './gamification.js'
import { esLogroDeTorneo, siguienteHito } from './torneos/palmares.js'

const vacio = (propia) =>
  propia
    ? `<p class="empty-state">Todavía no estás en ningún torneo. Pásate por <a href="/torneos.html">Jugar</a> para apuntarte al próximo.</p>`
    : `<p class="empty-state">Todavía no ha jugado ningún torneo.</p>`

// Las medallas de torneo se leen de sus logros y no se recalculan: la
// medalla la concede la ficha del torneo, y aquí solo se enseña lo que ya se
// ganó — así el perfil no puede decir una cosa y los trofeos otra.
function palmaresHtml(definiciones, logros, userId, jugados) {
  const suyos = new Set(logros || [])
  const medallas = definiciones.filter((d) => esLogroDeTorneo(d.id) && suyos.has(d.id))
  let campeonatos = 0
  let podios = 0
  for (const t of jugados) {
    const puesto = Array.isArray(t.podium) ? t.podium.indexOf(userId) : -1
    if (puesto === 0) campeonatos++
    else if (puesto > 0) podios++
  }
  const falta = siguienteHito({ jugados: jugados.length })
  const nombreHito = definiciones.find((d) => d.id === falta?.id)?.title
  const resumen = [
    // Corto a propósito: convive con las medallas, y «torneos» al lado de
    // un trofeo ya se entiende.
    `${jugados.length} ${jugados.length === 1 ? 'torneo' : 'torneos'}`,
    campeonatos ? `${campeonatos} ${campeonatos === 1 ? 'campeonato' : 'campeonatos'}` : '',
    podios ? `${podios} ${podios === 1 ? 'podio' : 'podios'}` : '',
    falta && nombreHito ? `a ${falta.faltan} de ${nombreHito}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const vitrina = medallas.length
    ? `<div class="palmares-vitrina">${medallas
        .map(
          (m) => `<span class="palmares-medalla rarity-${escapeHtml(m.rarity || 'bronze')}" title="${escapeHtml(m.title)} — ${escapeHtml(m.description || '')}" aria-label="${escapeHtml(m.title)}">${achievementIconHtml(m, 20)}</span>`
        )
        .join('')}</div>`
    : ''
  return `<div class="palmares-fila">${vitrina}<p class="subtext torneo-palmares">${escapeHtml(resumen)}</p></div>`
}

export async function pintarTorneosDe(caja, { userId, propia = false, logros = [] }) {
  if (!caja || !userId) return
  const { data: inscripciones, error } = await supabase.from('tournament_registrations').select('tournament_id, status').eq('user_id', userId)
  if (error || !inscripciones?.length) {
    caja.innerHTML = vacio(propia)
    return
  }
  const estadoInscripcion = new Map(inscripciones.map((i) => [i.tournament_id, i.status]))
  const [{ data: torneos }, definiciones] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, slug, name, status, start_at, champion_id, podium')
      .in('id', [...new Set(inscripciones.map((i) => i.tournament_id))])
      .order('start_at', { ascending: false }),
    getAllAchievements().catch(() => []),
  ])

  const jugando = []
  const apuntado = []
  const jugados = []
  for (const t of torneos || []) {
    const inscrito = estadoInscripcion.get(t.id)
    if (t.status === 'finished') jugados.push(t)
    // «Jugando ahora» es solo lo que se está jugando de verdad (tanda
    // 248). Un torneo con las inscripciones cerradas todavía no ha
    // empezado: sigues APUNTADO a él, aunque ya no se pueda entrar.
    else if (t.status === 'in_progress' && inscrito !== 'dropped') jugando.push(t)
    else if (['registration_open', 'registration_closed'].includes(t.status) && inscrito !== 'dropped') apuntado.push(t)
    // Cancelados y bajas: fuera. Un torneo que no se jugó no es
    // historial de nadie.
  }

  const fila = (t, detalle) => `
    <a class="mis-torneos-fila" href="/torneo?slug=${encodeURIComponent(t.slug)}">
      <span class="mis-torneos-nombre">${escapeHtml(t.name)}</span>
      <span class="subtext">${escapeHtml(String(t.start_at || '').slice(0, 10))}</span>
      ${detalle}
    </a>`
  const puestoDe = (t) => {
    if (t.champion_id === userId) return '<span class="mis-torneos-puesto oro">Campeón</span>'
    const p = Array.isArray(t.podium) ? t.podium.indexOf(userId) : -1
    if (p > 0) return `<span class="mis-torneos-puesto">${p + 1}º</span>`
    return '<span class="mis-torneos-puesto subtext">Jugado</span>'
  }
  const grupo = (titulo, filas) => (filas.length ? `<h3 class="mis-torneos-grupo">${titulo}</h3>${filas.join('')}` : '')

  const lista =
    grupo('Jugando ahora', jugando.map((t) => fila(t, '<span class="mis-torneos-puesto vivo">En juego</span>'))) +
    grupo(propia ? 'Apuntado' : 'Apuntado a', apuntado.map((t) => fila(t, `<span class="mis-torneos-puesto subtext">${estadoInscripcion.get(t.id) === 'waitlisted' ? 'En lista de espera' : 'Inscrito'}</span>`))) +
    grupo('Jugados', jugados.map((t) => fila(t, puestoDe(t))))
  caja.innerHTML = (jugados.length ? palmaresHtml(definiciones, logros, userId, jugados) : '') + (lista || vacio(propia))
}
