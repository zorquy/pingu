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
import { arquetipoDeMazo, claveDeArquetipo, dexesDeNombre } from './torneos/arquetipos.js'
import { artePokemonHtml } from './arte-pokemon.js'

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

// Tres cifras arriba (1271, como la maqueta): cuántos ha jugado, su mejor
// puesto y cuántos podios. Puro: lo prueba node.
export function cifrasDeTorneosHtml(jugados, userId) {
  let mejor = null
  let podios = 0
  for (const t of jugados) {
    const p = t.champion_id === userId ? 0 : Array.isArray(t.podium) ? t.podium.indexOf(userId) : -1
    if (p >= 0) {
      podios++
      if (mejor === null || p < mejor) mejor = p
    }
  }
  const cifra = (valor, texto) => `<div><b>${valor}</b><small>${texto}</small></div>`
  return `<div class="perfil-tres-cifras">${cifra(jugados.length, jugados.length === 1 ? 'torneo' : 'torneos')}${cifra(mejor === null ? '—' : `${mejor + 1}.º`, 'mejor puesto')}${cifra(podios, podios === 1 ? 'podio' : 'podios')}</div>`
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
      .select('id, slug, name, status, start_at, champion_id, podium, format, swiss_rounds, rounds_per_matchday, matchday_dates, pairing_seed')
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
  // La vitrina (1395, «Torneos en modo juego»): las cifras, las medallas y el
  // mazo de torneo en el panel de juego; debajo, la lista de siempre.
  const vitrina = jugados.length
    ? `<section class="perfil-vitrina" aria-label="Vitrina de torneos">
        <span class="perfil-vitrina-brillo" aria-hidden="true"></span>
        <small class="perfil-vitrina-kick">VITRINA DE TORNEOS</small>
        ${cifrasDeTorneosHtml(jugados, userId)}${palmaresHtml(definiciones, logros, userId, jugados)}
        <div class="perfil-vitrina-mazo" data-mazo-de-torneo hidden></div>
      </section>`
    : ''
  caja.innerHTML = vitrina + (lista || vacio(propia))
  if (jugados.length) void pintarMazoDeTorneo(caja.querySelector('[data-mazo-de-torneo]'), userId, jugados, propia)
  // Tu temporada en cada liga (1323): por su cuenta, detrás de lo de arriba.
  const ligas = (torneos || []).filter((t) => t.format === 'league' && estadoInscripcion.get(t.id) !== 'dropped')
  if (ligas.length) import('./perfil-liga.js').then((m) => m.pintarLigasDe(supabase, caja, { userId, torneos: ligas })).catch(() => {})
}

// El mazo de torneo (1395, D4 de «Jugar con cara de juego»): el que más ha
// llevado en torneos de PokeDoc YA TERMINADOS, sacado de sus listas — nunca
// de las partidas sueltas, que se apuntan a mano. Las listas de un torneo
// terminado las ve cualquiera (230); las de uno en juego, no, y no se piden.
// Puro: lo prueba node.
export function mazoMasJugado(listas, catalogo = []) {
  const cuenta = new Map()
  for (const l of listas || []) {
    if (!l?.parsed_cards) continue
    const arq = arquetipoDeMazo(l.parsed_cards, catalogo)
    if (!arq?.iconos?.length && !arq?.id) continue
    const clave = claveDeArquetipo(arq)
    const x = cuenta.get(clave) || { nombre: arq.nombre, iconos: arq.iconos, veces: 0 }
    x.veces++
    cuenta.set(clave, x)
  }
  return [...cuenta.values()].sort((a, b) => b.veces - a.veces)[0] || null
}

async function pintarMazoDeTorneo(hueco, userId, jugados, propia) {
  if (!hueco) return
  try {
    const [{ data: listas }, { data: catalogo }] = await Promise.all([
      supabase.from('tournament_decklists').select('tournament_id, parsed_cards').eq('user_id', userId).in('tournament_id', jugados.map((t) => t.id)),
      supabase.from('tcg_archetypes').select('*').eq('activo', true),
    ])
    const mazo = mazoMasJugado(listas, catalogo || [])
    if (!mazo) return
    const dex = dexesDeNombre(mazo.iconos?.[0]?.nombre || mazo.nombre)[0]
    hueco.innerHTML = `${dex ? artePokemonHtml(dex, 'perfil-vitrina-arte') : ''}
      <span><small>${propia ? 'TU MAZO DE TORNEO' : 'SU MAZO DE TORNEO'}</small><b>${escapeHtml(mazo.nombre)}</b><em>${mazo.veces} ${mazo.veces === 1 ? 'torneo' : 'torneos'}</em></span>`
    hueco.hidden = false
  } catch {}
}
