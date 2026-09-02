// El ciclo de ronda de un torneo (SPEC §6 de TrainerArena, portado):
// generar pareos, iniciar, check-in, reportes con confirmación del rival,
// resolución a mano del organizador y cierre. Sin colas ni WebSockets:
// los relojes automáticos llegan con la función programada (tanda 206) y
// el refresco es por sondeo — decisiones fijadas en CLAUDE.md.
//
// torneo.js monta este módulo con montarCiclo(ctx) en cada recarga.
import { faltaLaRpc } from './comun.js'
import { supabase } from '../supabase.js'
import { escapeHtml } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import {
  activePlayersForRound,
  pairRound1,
  pairSwissRound,
  pairKey,
  ManualPairingRequired,
  computeStandings,
  reconcileReports,
  resolutionWinnerSide,
  seedTopCut,
  advanceTopCut,
} from './motor.js'
import { pintarDecklistVisual, chapaArquetipoHtml, rellenarChapasArquetipo } from './cartas-decklist.js'
import { arquetipoDeMazo } from './arquetipos.js'
import { botonesExportarHtml, engancharExportar } from './decklist-export.js'

let ctx = null // { torneo, session, perfil, inscripciones, recargarFicha }
let rondas = []
let partidas = []
let reportes = []
let resultados = []
let historial = []
let reloj = null
let rondaVista = null // qué ronda se está mirando en «Mesas» (null = la viva)
// Los arquetipos (tanda 230): userId → {id, nombre, iconos, curado}.
// Se deducen de las decklists que la base nos deja leer, así que existen
// exactamente cuando pueden verse las listas — ni antes, ni por otro
// camino.
let arquetipos = new Map()
let catalogoArquetipos = null // el catálogo curado, una vez por página

const $ = (id) => document.getElementById(id)
// Quién mira. Puede ser NULL: desde la tanda 229 la ficha se abre
// también sin cuenta (modo escaparate). Sin identidad no hay «tu
// partida» ni reportes — solo mesas, rondas y clasificación.
const miId = () => ctx.session?.user?.id ?? null
const TERMINALES = new Set(['finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both'])

const ahora = () => new Date().toISOString()

function nombreDe(userId) {
  const i = ctx.inscripciones.find((x) => x.user_id === userId)
  return i?.perfil?.username || 'Alguien'
}

function numeroDeRonda(roundId) {
  return rondas.find((r) => r.id === roundId)?.round_number ?? null
}

function resultadoDe(matchId) {
  return resultados.find((r) => r.match_id === matchId) || null
}

// El desenlace de una mesa terminal, con el resultado ya resuelto.
function outcomeDe(m) {
  if (m.status === 'finished') return resultadoDe(m.id)?.result || 'draw'
  if (m.status === 'bye') return 'bye'
  return m.status
}

// ── Cargar el estado del ciclo ──

async function cargarCiclo() {
  const { data: filas } = await supabase
    .from('rounds')
    .select('*')
    .eq('tournament_id', ctx.torneo.id)
    .order('round_number', { ascending: true })
  rondas = filas || []

  const idsRondas = rondas.map((r) => r.id)
  partidas = []
  reportes = []
  resultados = []
  if (idsRondas.length) {
    const { data: mesas } = await supabase.from('tournament_matches').select('*').in('round_id', idsRondas)
    partidas = mesas || []
  }
  const idsPartidas = partidas.map((m) => m.id)
  if (idsPartidas.length) {
    const [{ data: reps }, { data: ress }] = await Promise.all([
      supabase.from('match_reports').select('*').in('match_id', idsPartidas),
      supabase.from('match_results').select('*').in('match_id', idsPartidas),
    ])
    reportes = reps || []
    resultados = ress || []
  }
  // OJO: el historial de cruces (pairing_history) NO se pide aquí.
  // Solo lo usa el pareo suizo, que es un botón del organizador, y
  // pedirlo en cada refresco era una consulta cada diez segundos para
  // todo el que mirase la ficha. Se carga en cargarHistorial(), justo
  // antes de parear.

  // Y lo que se acaba de cargar se deja a mano del módulo de jueces,
  // que necesita las mismas rondas y las mismas mesas: montarJueces()
  // corre después de este, así que las lee de aquí en vez de volver a
  // pedirlas a la base. Dos consultas menos por refresco.
  ctx.ciclo = { rondas, partidas }

  await cargarArquetipos()
  await conciliarPendientes()
}

// ── Los arquetipos de la mesa (tanda 230) ──
//
// Se deducen de las decklists LEGIBLES. Cuando no pueden verse las
// listas no se pide nada y el mapa se queda vacío: sin chapas, que es lo
// correcto — enseñar a qué juega alguien a mitad de un torneo de lista
// cerrada es regalarle la partida a su rival.
//
// Ojo con el coste: esto NO puede pedirse en cada refresco (la ficha se
// repinta sola cada pocos segundos). Las listas se sellan al empezar la
// ronda 1 y ya no cambian, así que se piden UNA vez y solo se vuelven a
// pedir si aparece alguien de quien no sabemos nada.
async function cargarArquetipos() {
  if (!puedenVerseLasListas()) {
    arquetipos = new Map()
    return
  }
  if (catalogoArquetipos === null) {
    const { data } = await supabase.from('tcg_archetypes').select('*').eq('activo', true)
    catalogoArquetipos = data || []
  }

  // Quien es juez u organizador ya tiene las listas cargadas por la
  // ficha: no se vuelven a pedir (ver el recorte de consultas de la 229).
  let listas = ctx.decklistsTorneo
  if (!listas) {
    const faltan = ctx.inscripciones.some((i) => i.status !== 'waitlisted' && !arquetipos.has(i.user_id))
    if (!faltan) return
    const { data } = await supabase
      .from('tournament_decklists')
      .select('user_id, parsed_cards')
      .eq('tournament_id', ctx.torneo.id)
    listas = data || []
  }

  const nuevo = new Map()
  for (const d of listas) {
    if (!d?.parsed_cards) continue
    nuevo.set(d.user_id, arquetipoDeMazo(d.parsed_cards, catalogoArquetipos))
  }
  arquetipos = nuevo
}

// La chapa de un jugador, si la hay. El «sin catalogar» solo se le marca
// a quien puede hacer algo al respecto: al organizador y a los jueces.
function chapaDe(userId) {
  const arq = arquetipos.get(userId)
  if (!arq) return ''
  return chapaArquetipoHtml(arq, { marcar: Boolean(ctx.perfil?.is_admin || ctx.esJuez) })
}

// El historial de cruces, bajo demanda. Sin él, pairSwissRound repetiría
// emparejamientos ya jugados: no es opcional, es que no hace falta hasta
// el momento de parear.
async function cargarHistorial() {
  const { data } = await supabase
    .from('pairing_history')
    .select('player_low_id, player_high_id')
    .eq('tournament_id', ctx.torneo.id)
  historial = data || []
}

// El snapshot inmutable que pide el motor (SPEC §5.1): jugadores con su
// baja y solo las partidas terminales, con el resultado resuelto.
function montarSnapshot(numeroRonda) {
  return {
    pairingSeed: ctx.torneo.pairing_seed,
    currentRoundNumber: numeroRonda,
    players: ctx.inscripciones.map((i) => ({
      id: i.user_id,
      dropped: i.status === 'dropped',
      droppedAfterRoundNumber: i.dropped_after_round_id ? numeroDeRonda(i.dropped_after_round_id) : null,
    })),
    matches: partidas
      .filter((m) => TERMINALES.has(m.status))
      .map((m) => ({
        roundNumber: numeroDeRonda(m.round_id),
        tableNumber: m.table_number,
        playerAId: m.player_a_id,
        playerBId: m.player_b_id,
        outcome: outcomeDe(m),
        finishedAt: m.finished_at,
      })),
  }
}

function historialSet() {
  return new Set(historial.map((h) => `${h.player_low_id}:${h.player_high_id}`))
}

// La ronda viva (pending o active); las cerradas solo cuentan puntos.
function rondaActual() {
  return rondas.find((r) => r.status !== 'finished') || null
}

// ── Generar pareos (SPEC §6.1) y aplicar el plan ──

async function crearMesa(rondaId, mesa, aId, bId, { bracket = null, conHistorial = true } = {}) {
  await supabase.from('tournament_matches').insert({
    round_id: rondaId,
    table_number: mesa,
    player_a_id: aId,
    player_b_id: bId,
    status: 'pending',
    is_bye: false,
    bracket_position: bracket,
  })
  // El histórico solo cuenta para el suizo (el cut cruza por siembra).
  // En el pareo manual el admin puede repetir un cruce a sabiendas: el
  // UNIQUE del histórico lo rechaza en silencio, porque ya consta.
  if (!conHistorial) return
  const [low, high] = aId < bId ? [aId, bId] : [bId, aId]
  await supabase.from('pairing_history').insert({
    tournament_id: ctx.torneo.id,
    player_low_id: low,
    player_high_id: high,
    round_id: rondaId,
  })
}

// El bye es terminal desde que nace: mesa cerrada y resultado apuntado.
async function crearBye(rondaId, mesa, jugadorId, { bracket = null } = {}) {
  const { data: fila } = await supabase
    .from('tournament_matches')
    .insert({
      round_id: rondaId,
      table_number: mesa,
      player_a_id: jugadorId,
      player_b_id: null,
      status: 'bye',
      is_bye: true,
      finished_at: ahora(),
      bracket_position: bracket,
    })
    .select('id')
    .single()
  if (fila) {
    await supabase.from('match_results').insert({ match_id: fila.id, result: 'bye', winner_id: jugadorId, resolved_by: null })
  }
}

// La inscripción en dos pasos (tanda 219): apuntarse no basta — hay que
// entregar la decklist Y confirmar la participación. Al generar la R1,
// quien no completó ambos queda retirado SIN ronda jugada (ni mesa ni
// bye: directamente no juega el torneo). Se hace aquí y no antes para
// que cualquier rezagado tenga hasta el último minuto.
// Si la columna del paso 2 aún no existe (migración pendiente), no se
// echa a nadie: sin regla anunciada no hay castigo.
async function retirarNoConfirmados() {
  const activos = ctx.inscripciones.filter((i) => i.status === 'active')
  // La columna se busca en CUALQUIER inscripción (una fila recién
  // insertada por la app aún no la trae aunque la base ya la tenga).
  if (!activos.length || !ctx.inscripciones.some((i) => 'participation_confirmed_at' in i)) return []
  const { data: listas } = await supabase
    .from('tournament_decklists')
    .select('user_id')
    .eq('tournament_id', ctx.torneo.id)
  const conLista = new Set((listas || []).map((d) => d.user_id))
  const fuera = activos.filter((i) => !conLista.has(i.user_id) || !i.participation_confirmed_at)
  for (const i of fuera) {
    const { error } = await supabase
      .from('tournament_registrations')
      .update({ status: 'dropped', dropped_at: ahora(), dropped_after_round_id: null })
      .eq('id', i.id)
    // El estado local se parchea a mano: el snapshot que se monta justo
    // después ya no debe sentarlos.
    if (!error) i.status = 'dropped'
  }
  return fuera
}

async function generarPareos() {
  if (rondaActual()) {
    showToast('Ya hay una ronda en marcha: ciérrala antes de generar la siguiente.', 'error')
    return
  }
  const n = rondas.length + 1
  if (n > ctx.torneo.swiss_rounds) {
    showToast('Las suizas están completas. La siembra del top cut llega en la próxima tanda.', 'error')
    return
  }

  if (n === 1) {
    const fuera = await retirarNoConfirmados()
    if (fuera.length) {
      showToast(
        `Fuera de la R1 por no completar los dos pasos (decklist + confirmación): ${fuera
          .map((i) => nombreDe(i.user_id))
          .join(', ')}.`,
        'info'
      )
    }
    const sentables = ctx.inscripciones.filter((i) => i.status === 'active').length
    if (sentables < 2) {
      showToast('No quedan suficientes jugadores confirmados para parear la primera ronda.', 'error')
      await ctx.recargarFicha()
      return
    }
  }

  const snapshot = montarSnapshot(n)
  // El historial solo se pide aquí, y solo si de verdad se va a usar:
  // la ronda 1 no tiene cruces previos que respetar.
  if (n > 1) await cargarHistorial()
  let plan
  let sinParear = []
  try {
    plan = n === 1 ? pairRound1(snapshot) : pairSwissRound({ snapshot, roundNumber: n, history: historialSet() })
  } catch (e) {
    if (!(e instanceof ManualPairingRequired)) throw e
    // Se aplican los parciales y el resto se parea a mano (SPEC §6.2).
    plan = { pairings: e.partialPairings, byePlayerId: e.byePlayerId }
    sinParear = e.unpairedPlayerIds
  }

  const { data: ronda, error } = await supabase
    .from('rounds')
    .insert({ tournament_id: ctx.torneo.id, round_number: n, phase: 'swiss', status: 'pending' })
    .select('id')
    .single()
  if (error || !ronda) {
    showToast('No se ha podido crear la ronda: ' + (error?.message || 'inténtalo otra vez'), 'error')
    return
  }

  for (const p of plan.pairings) await crearMesa(ronda.id, p.tableNumber, p.playerAId, p.playerBId)
  if (plan.byePlayerId) await crearBye(ronda.id, plan.pairings.length + 1, plan.byePlayerId)

  showToast(
    sinParear.length
      ? `Pareo incompleto: quedan ${sinParear.length} jugadores por sentar a mano.`
      : `Pareos de la ronda ${n} generados.`,
    sinParear.length ? 'error' : 'success'
  )
  // La R1 puede haber retirado inscritos (los dos pasos): ficha entera,
  // que la caja de Inscritos también les cambie la cara sin esperar al
  // refresco de los 10 s.
  if (n === 1) {
    await ctx.recargarFicha()
    return
  }
  await recargarCiclo()
  pintarCiclo()
}

// ── Iniciar la ronda (SPEC §6.3) ──

async function iniciarRonda(ronda) {
  // Solo en el suizo: en el cut los eliminados no tienen mesa a posta.
  if (ronda.phase === 'swiss' && sinMesa(ronda).length) {
    showToast('Aún quedan jugadores sin mesa: complétalo en el pareo manual.', 'error')
    return
  }
  const empieza = ahora()
  const cierra =
    ronda.phase === 'swiss' ? new Date(Date.now() + ctx.torneo.round_time_minutes * 60000).toISOString() : null
  await supabase
    .from('rounds')
    .update({ status: 'active', started_at: empieza, ends_at: cierra })
    .eq('id', ronda.id)
  await supabase.from('tournament_matches').update({ status: 'active' }).eq('round_id', ronda.id).eq('status', 'pending')
  await supabase
    .from('tournaments')
    .update({ status: 'in_progress', current_round_id: ronda.id })
    .eq('id', ctx.torneo.id)
  ctx.torneo.status = 'in_progress'
  ctx.torneo.current_round_id = ronda.id

  // La R1 sella TODAS las decklists del torneo (SPEC §6.3): a partir de
  // aquí solo entran las tardías, que se sellan solas al guardarse.
  if (ronda.round_number === 1) {
    const { data: sinSellar } = await supabase
      .from('tournament_decklists')
      .select('id')
      .eq('tournament_id', ctx.torneo.id)
      .is('locked_at', null)
    for (const d of sinSellar || []) {
      await supabase.from('tournament_decklists').update({ locked_at: empieza }).eq('id', d.id)
    }
  }

  showToast(`Ronda ${ronda.round_number} en marcha. ${ctx.torneo.round_time_minutes} minutos.`, 'success')
  await ctx.recargarFicha()
}

// ── Cerrar la ronda (SPEC §6.8) ──

async function cerrarRonda(ronda) {
  const mesas = partidas.filter((m) => m.round_id === ronda.id)
  const vivas = mesas.filter((m) => !TERMINALES.has(m.status))
  if (vivas.length) {
    showToast(`Quedan ${vivas.length} mesas sin resultado: resuélvelas antes de cerrar.`, 'error')
    return
  }
  // En el cut no existe el empate (SPEC §6.8): alguien tiene que pasar.
  if (ronda.phase === 'top_cut' && mesas.some((m) => outcomeDe(m) === 'draw')) {
    showToast('En el top cut no puede haber empates: resuelve esa mesa con un ganador.', 'error')
    return
  }
  await supabase.from('rounds').update({ status: 'finished', closed_at: ahora() }).eq('id', ronda.id)

  if (ronda.phase === 'top_cut') {
    await avanzarBracket(ronda)
  } else if (ronda.round_number >= ctx.torneo.swiss_rounds) {
    if (ctx.torneo.top_cut_size === 0) {
      await terminarTorneo('¡Torneo terminado! La clasificación de abajo es la final.')
    } else {
      await sembrarTopCut()
    }
  } else {
    showToast(`Ronda ${ronda.round_number} cerrada.`, 'success')
  }
  await ctx.recargarFicha()
}

async function terminarTorneo(mensaje) {
  await supabase.from('tournaments').update({ status: 'finished' }).eq('id', ctx.torneo.id)
  ctx.torneo.status = 'finished'
  showToast(mensaje, 'success')
}

// ── Deshacer la última ronda (pedido de Ibai, 2026-09-02) ──
//
// Para cuando se generó la siguiente ronda sin querer o hay que
// corregir algo de la actual: borra la ronda ENTERA. Es UN solo DELETE
// a `rounds` — mesas, reportes, resultados, historial de cruces y
// chats de mesa cuelgan con `on delete cascade`, y `current_round_id`
// es `on delete set null`: la base lo limpia todo o no toca nada.
//
// Solo la ÚLTIMA ronda a propósito: quitar una del medio dejaría los
// pareos de las siguientes apoyados en resultados que ya no existen.
// Lo que NO deshace: los avisos ya enviados (push/correo de «tu ronda
// ha empezado») y los retirados de la R1 por los dos pasos, que siguen
// retirados — no se distinguen de quien se retiró él solo.
async function deshacerRonda() {
  const ultima = rondas[rondas.length - 1]
  if (!ultima) return
  const mesas = partidas.filter((m) => m.round_id === ultima.id)
  const conResultado = mesas.filter((m) => TERMINALES.has(m.status)).length
  const aviso =
    ultima.status === 'pending'
      ? `Vas a deshacer los pareos de la ronda ${ultima.round_number}. Podrás volver a generarlos cuando quieras.`
      : `Vas a borrar la ronda ${ultima.round_number} ENTERA: sus ${mesas.length} mesas${
          conResultado ? ` (${conResultado} con resultado)` : ''
        } y sus reportes se pierden y no se pueden recuperar. ¿Seguro?`
  if (!window.confirm(aviso)) return

  // El .select() no es un adorno: un DELETE que la RLS rechaza NO da
  // error — vuelve sin filas y sin tocar nada (aviso de CLAUDE.md).
  // Así se distingue «deshecho» de «la base no ha borrado nada».
  const { data, error } = await supabase.from('rounds').delete().eq('id', ultima.id).select('id')
  if (error || !data?.length) {
    showToast('No se ha podido deshacer la ronda: ' + (error?.message || 'la base no la ha borrado'), 'error')
    return
  }

  // Deshacer la R1 devuelve el torneo a «inscripciones cerradas», y si
  // la ronda llegó a iniciarse, des-sella las decklists (las selló
  // iniciarRonda; sin R1 en marcha la gente debe poder retocarlas).
  if (rondas.length === 1) {
    if (ultima.started_at) {
      await supabase.from('tournament_decklists').update({ locked_at: null }).eq('tournament_id', ctx.torneo.id)
    }
    await supabase.from('tournaments').update({ status: 'registration_closed' }).eq('id', ctx.torneo.id)
    ctx.torneo.status = 'registration_closed'
  }
  showToast(
    ultima.status === 'pending' ? `Pareos de la ronda ${ultima.round_number} deshechos.` : `Ronda ${ultima.round_number} borrada.`,
    'success'
  )
  await ctx.recargarFicha()
}

// ── Top cut: siembra al cerrar la última suiza y avance «fold» (SPEC §7) ──

async function crearRondaDeCut(pareos) {
  const { data: ronda, error } = await supabase
    .from('rounds')
    .insert({ tournament_id: ctx.torneo.id, round_number: rondas.length + 1, phase: 'top_cut', status: 'pending' })
    .select('id')
    .single()
  if (error || !ronda) {
    showToast('No se ha podido crear la ronda del cut: ' + (error?.message || 'inténtalo otra vez'), 'error')
    return
  }
  for (const p of pareos) {
    if (p.isBye) await crearBye(ronda.id, p.bracketPosition, p.playerAId, { bracket: p.bracketPosition })
    else await crearMesa(ronda.id, p.bracketPosition, p.playerAId, p.playerBId, { bracket: p.bracketPosition, conHistorial: false })
  }
}

async function sembrarTopCut() {
  // Ranking final sin los retirados; tamaño efectivo = mayor potencia
  // de 2 que quepa. Con menos de 2 vivos, el torneo acaba aquí.
  const clasificacion = computeStandings(montarSnapshot(rondas.length))
  const vivos = clasificacion.filter(
    (e) => ctx.inscripciones.find((i) => i.user_id === e.playerId)?.status === 'active'
  )
  const siembra = seedTopCut(vivos.map((e) => e.playerId), ctx.torneo.top_cut_size)
  if (!siembra) {
    await terminarTorneo('Sin jugadores suficientes para el cut: el torneo termina con las suizas.')
    return
  }
  await crearRondaDeCut(siembra)
  showToast(`Suizas completas: top ${siembra.length * 2} sembrado. Inicia la ronda cuando estén listos.`, 'success')
}

async function avanzarBracket(rondaCerrada) {
  const cerradas = partidas
    .filter((m) => m.round_id === rondaCerrada.id)
    .map((m) => ({
      bracketPosition: m.bracket_position,
      playerAId: m.player_a_id,
      playerBId: m.player_b_id,
      outcome: outcomeDe(m),
    }))
  const paso = advanceTopCut(cerradas)
  if (paso.finished) {
    await terminarTorneo(
      paso.championId ? `¡Torneo terminado! El campeón es ${nombreDe(paso.championId)}.` : '¡Torneo terminado!'
    )
    return
  }
  await crearRondaDeCut(paso.pairings)
  showToast('Bracket avanzado: siguiente ronda del cut lista.', 'success')
}

// El campeón se deduce, no se guarda: con top cut es quien deja la
// final cerrada (misma cuenta que advanceTopCut con K=1); en un torneo
// solo de suizas, el primero de la clasificación que no se retiró.
function campeonDelTorneo() {
  if (ctx.torneo.status !== 'finished' || !rondas.length) return null
  const ultima = rondas[rondas.length - 1]
  if (ultima.phase !== 'top_cut') {
    const tabla = computeStandings(montarSnapshot(rondas.length))
    const primero = tabla.find(
      (e) => ctx.inscripciones.find((i) => i.user_id === e.playerId)?.status === 'active'
    )
    return primero?.playerId ?? null
  }
  const cerradas = partidas
    .filter((m) => m.round_id === ultima.id)
    .map((m) => ({ bracketPosition: m.bracket_position, playerAId: m.player_a_id, playerBId: m.player_b_id, outcome: outcomeDe(m) }))
  const paso = advanceTopCut(cerradas)
  return paso.finished ? paso.championId : null
}

// ── Check-in y reportes (SPEC §6.4 y §6.5) ──

async function marcarListo(partida) {
  const soyA = partida.player_a_id === miId()
  const columna = soyA ? 'check_in_a_at' : 'check_in_b_at'
  if (partida[columna]) return
  // Por la RPC: con la sección abierta, `tournament_matches` es de
  // escritura solo-admin y un update directo del jugador no tocaría
  // nada — sin dar error. La RPC además solo deja escribir TU columna
  // de check-in, no el resto de la fila.
  const res = await supabase.rpc('torneos_checkin', { p_partida: partida.id })
  if (faltaLaRpc(res.error)) {
    await supabase.from('tournament_matches').update({ [columna]: ahora() }).eq('id', partida.id)
  } else if (res.error) {
    showToast('No se ha podido marcar listo: ' + res.error.message, 'error')
    return
  }
  await recargarCiclo()
  pintarCiclo()
}

async function reportar(partida, resultado) {
  // Lectura fresca: el rival puede haber reportado desde su sesión.
  const { data: previos } = await supabase.from('match_reports').select('*').eq('match_id', partida.id)
  const lista = previos || []
  const mio = lista.find((r) => r.reporter_id === miId())
  if (mio) {
    showToast(
      mio.result === resultado ? 'Ese resultado ya estaba reportado.' : 'Ya reportaste un resultado distinto: llama al organizador.',
      mio.result === resultado ? 'info' : 'error'
    )
    return
  }
  // Por la RPC: reporta, concilia con lo del rival y cierra la mesa, todo
  // en el servidor y con la fila bajo candado. Desde el navegador eran
  // tres escrituras seguidas, y dos rivales reportando a la vez podían
  // pisarse. Además `match_reports` es de escritura solo por RPC con la
  // sección abierta.
  const res = await supabase.rpc('torneos_reportar', { p_partida: partida.id, p_resultado: resultado })
  if (!faltaLaRpc(res.error)) {
    if (res.error) {
      const texto = String(res.error.message || '')
      showToast(texto.length < 120 ? texto : 'No se ha podido reportar.', 'error')
      return
    }
    const AVISOS = {
      esperando: ['Reportado. Falta que tu rival lo confirme.', 'success'],
      conciliado: ['Resultado confirmado por los dos.', 'success'],
      disputa: ['Los reportes no coinciden: la mesa queda en disputa.', 'error'],
      repetido: ['Ese resultado ya estaba reportado.', 'info'],
    }
    const [texto, tono] = AVISOS[res.data] || ['Reportado.', 'success']
    showToast(texto, tono)
    await ctx.recargarFicha()
    return
  }

  const { error } = await supabase
    .from('match_reports')
    .insert({ match_id: partida.id, reporter_id: miId(), result: resultado, reported_at: ahora() })
  if (error) {
    showToast('No se ha podido reportar: ' + error.message, 'error')
    return
  }

  const delRival = lista.find((r) => r.reporter_id !== miId())
  if (!delRival) {
    await supabase.from('tournament_matches').update({ status: 'awaiting_confirmation' }).eq('id', partida.id)
    showToast('Reportado. Falta que tu rival lo confirme.', 'success')
  } else {
    const soyA = partida.player_a_id === miId()
    await conciliar(partida, soyA ? resultado : delRival.result, soyA ? delRival.result : resultado)
  }
  // Ficha entera: una disputa nueva tiene que asomar también en la cola
  // del juez, que pinta otro módulo.
  await ctx.recargarFicha()
}

// La conciliación del segundo reporte (SPEC §6.5): win+loss y draw+draw
// casan; lo demás deja la mesa en disputa para el organizador o un juez.
async function conciliar(partida, reporteA, reporteB) {
  const casan = reconcileReports(reporteA, reporteB)
  if (!casan) {
    await supabase.from('tournament_matches').update({ status: 'disputed' }).eq('id', partida.id)
    showToast('Los reportes no coinciden: la mesa queda en disputa.', 'error')
    return null
  }
  await supabase
    .from('tournament_matches')
    .update({ status: 'finished', finished_at: ahora() })
    .eq('id', partida.id)
  const resultado = {
    match_id: partida.id,
    result: casan.result,
    winner_id: casan.winnerSide === 'a' ? partida.player_a_id : casan.winnerSide === 'b' ? partida.player_b_id : null,
    resolved_by: null,
  }
  await supabase.from('match_results').insert(resultado)
  return resultado
}

// Si los dos reportes ya están (el rival reportó desde su sesión), la
// mesa se concilia aquí al refrescar: en el original lo hacía el
// servidor con el segundo reporte; sin servidor, lo hace el primer
// cliente que la ve completa (el UNIQUE de match_results corta el doble).
async function conciliarPendientes() {
  for (const m of partidas.filter((x) => x.status === 'awaiting_confirmation')) {
    const deA = reportes.find((r) => r.match_id === m.id && r.reporter_id === m.player_a_id)
    const deB = reportes.find((r) => r.match_id === m.id && r.reporter_id === m.player_b_id)
    if (deA && deB && !resultadoDe(m.id)) {
      const resultado = await conciliar(m, deA.result, deB.result)
      // El estado local se parchea a mano para no releerlo todo: lo que
      // se acaba de escribir es exactamente esto.
      if (resultado) {
        m.status = 'finished'
        m.finished_at = ahora()
        resultados.push(resultado)
      } else {
        m.status = 'disputed'
      }
    }
  }
}

// ── Resolución a mano del organizador (SPEC §6.7) ──

async function resolverPartida(partida, resultado) {
  const lado = resolutionWinnerSide(resultado)
  await supabase
    .from('tournament_matches')
    .update({ status: resultado.startsWith('forfeit') ? resultado : 'finished', finished_at: ahora() })
    .eq('id', partida.id)
  // upsert y no insert: CORREGIR una mesa ya resuelta pisa su fila de
  // match_results (match_id es UNIQUE) en vez de chocar con ella. Para
  // una mesa nueva se comporta como el insert de siempre.
  await supabase.from('match_results').upsert(
    {
      match_id: partida.id,
      result: resultado,
      winner_id: lado === 'a' ? partida.player_a_id : lado === 'b' ? partida.player_b_id : null,
      resolved_by: miId(),
    },
    { onConflict: 'match_id' }
  )
  // Si el torneo ya estaba terminado, el podio congelado deja de valer
  // con el resultado nuevo: se descongela y sellarResultado lo vuelve a
  // escribir recalculado en la próxima carga. El anuncio del foro ya
  // publicado no se retira — eso queda en manos del organizador.
  if (ctx.torneo.status === 'finished' && TERMINALES.has(partida.status)) {
    await supabase.from('tournaments').update({ champion_id: null, podium: null }).eq('id', ctx.torneo.id)
    ctx.torneo.champion_id = null
    ctx.torneo.podium = null
  }
  showToast('Mesa resuelta.', 'success')
  await ctx.recargarFicha()
}

// ── Pareo manual (SPEC §6.2) ──

function sinMesa(ronda) {
  const sentados = new Set(
    partidas.filter((m) => m.round_id === ronda.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
  )
  return activePlayersForRound(montarSnapshot(ronda.round_number).players, ronda.round_number)
    .map((p) => p.id)
    .filter((id) => !sentados.has(id))
}

function pintarPareoManual(ronda) {
  const caja = $('pareoManual')
  if (ronda.phase === 'top_cut') {
    caja.innerHTML = ''
    return
  }
  const sueltos = sinMesa(ronda)
  if (ronda.status !== 'pending' || !sueltos.length || !ctx.perfil?.is_admin) {
    caja.innerHTML = ''
    return
  }
  const opciones = sueltos.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(nombreDe(id))}</option>`).join('')
  caja.innerHTML = `
    <div class="torneo-pareo-manual">
      <p><strong>Pareo manual</strong> — el automático no pudo sentar a ${sueltos.length} jugadores sin repetir cruces. Elige tú las mesas:</p>
      <div class="torneo-pareo-manual-fila">
        <select id="manualA">${opciones}</select>
        <span>contra</span>
        <select id="manualB">${opciones}</select>
        <button class="btn-secondary" id="btnMesaManual">Crear mesa</button>
        <button class="btn-secondary" id="btnByeManual">Dar bye al primero</button>
      </div>
    </div>`
  $('btnMesaManual').addEventListener('click', async () => {
    const a = $('manualA').value
    const b = $('manualB').value
    if (a === b) {
      showToast('Elige dos jugadores distintos.', 'error')
      return
    }
    const mesas = partidas.filter((m) => m.round_id === ronda.id).length
    await crearMesa(ronda.id, mesas + 1, a, b)
    await recargarCiclo()
    pintarCiclo()
  })
  $('btnByeManual').addEventListener('click', async () => {
    const mesas = partidas.filter((m) => m.round_id === ronda.id).length
    await crearBye(ronda.id, mesas + 1, $('manualA').value)
    await recargarCiclo()
    pintarCiclo()
  })
}

// ── Pintar: rondas, mesas, tu partida y clasificación ──

function textoTerminal(m) {
  if (m.status === 'bye') return `Bye para ${nombreDe(m.player_a_id)}`
  if (m.status === 'forfeit_a') return `Incomparecencia: gana ${nombreDe(m.player_b_id)}`
  if (m.status === 'forfeit_b') return `Incomparecencia: gana ${nombreDe(m.player_a_id)}`
  if (m.status === 'forfeit_both') return 'Doble incomparecencia'
  const r = resultadoDe(m.id)
  if (!r) return 'Terminada'
  if (r.result === 'draw') return 'Empate'
  return `Gana ${nombreDe(r.winner_id)}`
}

const ESTADOS_MESA = {
  pending: 'Sin empezar',
  active: 'En juego',
  awaiting_confirmation: 'Esperando confirmación',
  disputed: 'En disputa',
}

const ETIQUETA_REPORTE = { win: 'victoria', loss: 'derrota', draw: 'empate' }

function hora(iso) {
  return iso ? new Date(iso).toLocaleTimeString('es-ES') : '—'
}

// ── El reloj de la ronda (SPEC §11, sin server_now) ──
// El reloj del navegador es ORIENTATIVO: las expiraciones de verdad las
// aplica el barredor por minuto en el servidor. Aquí solo se pinta.
function textoCuenta(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function arrancarReloj(ronda) {
  if (reloj) {
    clearInterval(reloj)
    reloj = null
  }
  const marcador = $('torneoReloj')
  if (!marcador) return
  if (ronda?.status !== 'active' || !ronda.started_at) {
    // Sin ronda viva no hay reloj: si no, el último texto se queda
    // congelado en la cabecera con el torneo ya cerrado.
    marcador.classList.add('hidden')
    return
  }
  const cierreCheckin = new Date(ronda.started_at).getTime() + (ctx.torneo.checkin_minutes || 0) * 60000
  const fin = ronda.ends_at ? new Date(ronda.ends_at).getTime() : null

  // El mismo tictac alimenta los tres marcadores: el discreto de la
  // cabecera, el GIGANTE de la pestaña Rondas (la pantalla «ronda
  // actual» del original) y el de «Tu partida».
  const pintarReloj = () => {
    const ya = Date.now()
    const trozos = []
    if (ya < cierreCheckin) trozos.push(`Check-in ${textoCuenta(cierreCheckin - ya)}`)
    if (fin) {
      trozos.push(ya < fin ? `Ronda ${textoCuenta(fin - ya)}` : 'Tiempo cumplido')
      marcador.classList.toggle('torneo-reloj-rojo', fin - ya < 120000)
    }
    marcador.textContent = trozos.join(' · ')
    marcador.classList.toggle('hidden', trozos.length === 0)

    const textoRonda = fin ? (ya < fin ? textoCuenta(fin - ya) : '0:00') : null
    const seAgota = fin !== null && fin - ya < 120000
    for (const id of ['cuentaGrande', 'cuentaPartida']) {
      const hueco = $(id)
      if (hueco && textoRonda !== null) {
        hueco.textContent = textoRonda
        hueco.classList.toggle('agotandose', seAgota)
      }
    }
    const chip = $('cuentaCheckin')
    if (chip) {
      chip.innerHTML = ya < cierreCheckin ? `Check-in: <strong>${textoCuenta(cierreCheckin - ya)}</strong>` : ''
      chip.classList.toggle('hidden', ya >= cierreCheckin)
    }
    // El aviso de «Tu partida»: la ventana de check-in con su cuenta.
    const aviso = $('avisoCheckin')
    if (aviso) {
      aviso.classList.toggle('hidden', ya >= cierreCheckin)
      const cuenta = $('cuentaCheckinPartida')
      if (cuenta && ya < cierreCheckin) cuenta.textContent = textoCuenta(cierreCheckin - ya)
    }
  }
  pintarReloj()
  reloj = setInterval(pintarReloj, 1000)
}

// La chapa de estado/resultado de una mesa, como los badges del original:
// verde para lo cerrado con ganador, ámbar para disputas y esperas,
// neutra para lo demás.
function chapaDeMesa(m) {
  if (TERMINALES.has(m.status)) {
    const clase = m.status === 'forfeit_both' || outcomeDe(m) === 'draw' ? 'torneo-chapa-neutra' : 'torneo-chapa-exito'
    return `<span class="torneo-chapa ${clase}">${escapeHtml(textoTerminal(m))}</span>`
  }
  const clase =
    m.status === 'disputed' || m.status === 'awaiting_confirmation'
      ? 'torneo-chapa-aviso'
      : m.status === 'active'
        ? 'torneo-chapa-marca'
        : 'torneo-chapa-neutra'
  return `<span class="torneo-chapa ${clase}">${ESTADOS_MESA[m.status]}</span>`
}

function pintarMesas(ronda) {
  const mesas = partidas.filter((m) => m.round_id === ronda.id).sort((a, b) => a.table_number - b.table_number)
  if (!mesas.length) return '<p class="subtext">Sin mesas todavía.</p>'
  const puedeResolver = (ctx.perfil?.is_admin || ctx.esJuez) && ronda.status === 'active'
  // Corregir (pedido de Ibai, 2026-09-02): el organizador puede CAMBIAR
  // el resultado de una mesa ya cerrada, pero solo en la ÚLTIMA ronda —
  // tocar una anterior dejaría los pareos posteriores apoyados en
  // resultados que ya no cuentan (para eso está deshacerRonda). Solo el
  // admin, no los jueces: pisar un resultado firme es del organizador.
  const esUltima = rondas.length > 0 && ronda.id === rondas[rondas.length - 1].id
  const puedeCorregir = Boolean(ctx.perfil?.is_admin) && esUltima && ctx.torneo.status !== 'cancelled'
  const conAcciones = puedeResolver || puedeCorregir
  const filas = mesas
    .map((m) => {
      const terminal = TERMINALES.has(m.status)
      const listoA = m.check_in_a_at ? ' <span class="torneo-mesa-listo" title="Check-in hecho">✓</span>' : ''
      const listoB = m.check_in_b_at ? ' <span class="torneo-mesa-listo" title="Check-in hecho">✓</span>' : ''
      const jugadorB = m.player_b_id
        ? `<span class="torneo-mesa-jugador">${escapeHtml(nombreDe(m.player_b_id))}</span>${chapaDe(m.player_b_id)}${listoB}`
        : '<span class="torneo-mesa-bye">BYE</span>'
      // El organizador (o un juez) puede resolver a mano cualquier mesa
      // viva; y el organizador, CORREGIR una ya cerrada de la última
      // ronda (un bye no: no hay resultado que cambiar, solo jugador).
      const resolver =
        (puedeResolver && !terminal) || (puedeCorregir && terminal && m.status !== 'bye')
          ? `<span class="torneo-mesa-resolver">
              <select data-resolver="${m.id}">
                <option value="">${terminal ? 'Corregir…' : 'Resolver…'}</option>
                <option value="a_wins">Gana ${escapeHtml(nombreDe(m.player_a_id))}</option>
                <option value="b_wins">Gana ${escapeHtml(nombreDe(m.player_b_id))}</option>
                ${ronda.phase === 'top_cut' ? '' : '<option value="draw">Empate</option>'}
                <option value="forfeit_a">No se presenta ${escapeHtml(nombreDe(m.player_a_id))}</option>
                <option value="forfeit_b">No se presenta ${escapeHtml(nombreDe(m.player_b_id))}</option>
                <option value="forfeit_both">No se presenta nadie</option>
              </select>
            </span>`
          : ''
      // En una disputa, quien resuelve ve los dos reportes con su hora
      // (la pantalla /juez/disputa del original, aquí bajo la mesa).
      const enfrentados =
        m.status === 'disputed'
          ? `<tr><td></td><td colspan="${conAcciones ? 4 : 3}"><div class="torneo-disputa-reportes">${reportes
              .filter((r) => r.match_id === m.id)
              .map(
                (r) =>
                  `<span class="torneo-reporte-carta"><strong>${escapeHtml(nombreDe(r.reporter_id))}</strong> reportó ${ETIQUETA_REPORTE[r.result] || r.result} a las ${hora(r.reported_at || r.created_at)}</span>`
              )
              .join('')}</div></td></tr>`
          : ''
      // El data-etiqueta es para el MÓVIL: ahí la tabla se convierte en
      // tarjetas apiladas (css/torneos.css) y cada dato necesita decir
      // qué es, porque las cabeceras de la tabla ya no se ven.
      return `
      <tr>
        <td class="torneo-mesa-num" data-etiqueta="Mesa">${m.table_number}</td>
        <td data-etiqueta="Jugador A"><span class="torneo-mesa-jugador">${escapeHtml(nombreDe(m.player_a_id))}</span>${chapaDe(m.player_a_id)}${listoA}</td>
        <td data-etiqueta="Jugador B">${jugadorB}</td>
        <td data-etiqueta="Resultado">${chapaDeMesa(m)}</td>
        ${conAcciones ? `<td data-etiqueta="Resolver">${resolver}</td>` : ''}
      </tr>${enfrentados}`
    })
    .join('')
  return `
  <div class="torneo-mesas-tabla">
    <table>
      <thead><tr><th>Mesa</th><th>Jugador A</th><th>Jugador B</th><th>Resultado</th>${conAcciones ? '<th></th>' : ''}</tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </div>`
}

function pintarRondas() {
  const caja = $('torneoRondasCaja')
  const arrancado = ['registration_closed', 'in_progress', 'finished'].includes(ctx.torneo.status) || rondas.length > 0
  if (!arrancado) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')

  const actual = rondaActual()
  let admin = ''
  if (ctx.perfil?.is_admin && ctx.torneo.status !== 'finished') {
    if (!actual && rondas.length < ctx.torneo.swiss_rounds) {
      admin = `<button class="btn-primary" id="btnGenerarPareos">Generar pareos de la ronda ${rondas.length + 1}</button>`
    } else if (actual?.status === 'pending') {
      admin = `<button class="btn-primary" id="btnIniciarRonda">Iniciar ronda ${actual.round_number}</button>`
    } else if (actual?.status === 'active') {
      admin = `<button class="btn-secondary" id="btnCerrarRonda">Cerrar ronda ${actual.round_number}</button>`
    } else if (!actual && rondas.length && ctx.torneo.status === 'in_progress') {
      // Todas las rondas cerradas y sin camino adelante: el estado en
      // el que te deja DESHACER una ronda del cut (o la siembra) tras
      // corregir algo. El ciclo normal nunca pasa por aquí — cerrar la
      // última suiza siembra el cut en el mismo acto —, así que estos
      // botones son el «continuar» de esa vuelta atrás, con los mismos
      // pasos que dio cerrarRonda en su día.
      const ultima = rondas[rondas.length - 1]
      if (ultima.phase === 'top_cut') {
        admin = `<button class="btn-primary" id="btnContinuarBracket">Continuar el bracket</button>`
      } else if (ctx.torneo.top_cut_size > 0) {
        admin = `<button class="btn-primary" id="btnSembrarCut">Sembrar el top cut</button>`
      } else {
        admin = `<button class="btn-primary" id="btnTerminarTorneo">Terminar el torneo</button>`
      }
    }
    // Deshacer la última ronda (pedido de Ibai, 2026-09-02): al lado
    // del paso normal del ciclo, siempre que haya algo que deshacer.
    if (rondas.length) {
      const ultima = rondas[rondas.length - 1]
      admin += `<button class="btn-secondary torneo-deshacer" id="btnDeshacerRonda">Deshacer ${
        ultima.status === 'pending' ? `los pareos (R${ultima.round_number})` : `la ronda ${ultima.round_number}`
      }</button>`
    }
  }
  // El reloj protagonista, como la pantalla «ronda actual» del original:
  // con ronda viva, la cuenta atrás preside la pestaña (en el cut, el
  // recordatorio de que se juega a acabar). Lo alimenta arrancarReloj.
  const hero =
    actual?.status === 'active'
      ? `<div class="torneo-ronda-hero">
          <p class="torneo-ronda-hero-contexto">${actual.phase === 'top_cut' ? `Top cut — ronda ${actual.round_number}` : `Ronda suiza ${actual.round_number} de ${ctx.torneo.swiss_rounds}`} · En curso</p>
          ${
            actual.ends_at
              ? `<div class="torneo-cuenta-grande" id="cuentaGrande" role="timer" aria-label="Tiempo restante de la ronda">–:––</div>
                 <p class="torneo-cuenta-etiqueta">Tiempo restante</p>`
              : `<div class="torneo-cuenta-grande">Sin límite</div>
                 <p class="torneo-cuenta-etiqueta">El top cut se juega a acabar.</p>`
          }
          <span class="torneo-cuenta-checkin hidden" id="cuentaCheckin"></span>
        </div>`
      : ''
  $('rondasAdmin').innerHTML = `
    ${hero}
    <div class="torneo-rondas-cabecera">
      <span class="subtext">${rondas.length ? (rondas[rondas.length - 1].phase === 'top_cut' ? `Top cut — ronda ${rondas[rondas.length - 1].round_number}` : `Ronda ${rondas[rondas.length - 1].round_number} de ${ctx.torneo.swiss_rounds} suizas`) : `Sin rondas aún (${ctx.torneo.swiss_rounds} suizas previstas)`}</span>
      <span class="torneo-rondas-botones">${admin}<button class="btn-secondary" id="btnActualizarCiclo">Actualizar</button></span>
    </div>`
  // Actualizar refresca la ficha ENTERA (ciclo, chats y cola de jueces):
  // es el botón de «a ver si mi rival ya ha hecho algo».
  $('btnActualizarCiclo').addEventListener('click', () => ctx.recargarFicha())
  if ($('btnGenerarPareos')) $('btnGenerarPareos').addEventListener('click', generarPareos)
  if ($('btnIniciarRonda')) $('btnIniciarRonda').addEventListener('click', () => iniciarRonda(actual))
  if ($('btnCerrarRonda')) $('btnCerrarRonda').addEventListener('click', () => cerrarRonda(actual))
  if ($('btnDeshacerRonda')) $('btnDeshacerRonda').addEventListener('click', deshacerRonda)
  // Los tres «continuar» de la vuelta atrás: repiten el paso que dio
  // cerrarRonda en su día, ahora con los resultados ya corregidos.
  if ($('btnContinuarBracket'))
    $('btnContinuarBracket').addEventListener('click', async () => {
      await avanzarBracket(rondas[rondas.length - 1])
      await ctx.recargarFicha()
    })
  if ($('btnSembrarCut'))
    $('btnSembrarCut').addEventListener('click', async () => {
      await sembrarTopCut()
      await ctx.recargarFicha()
    })
  if ($('btnTerminarTorneo'))
    $('btnTerminarTorneo').addEventListener('click', async () => {
      await terminarTorneo('¡Torneo terminado! La clasificación de abajo es la final.')
      await ctx.recargarFicha()
    })

  if (actual) pintarPareoManual(actual)
  else $('pareoManual').innerHTML = ''

  // El historial: cualquier ronda pasada se puede repasar (los /pareos
  // /ronda/:n del original, aquí como pestañitas). Sin elegir, la viva.
  const elegida = rondas.find((r) => r.id === rondaVista) || null
  const paraMesas = elegida || actual || rondas[rondas.length - 1]
  const pestanas =
    rondas.length > 1
      ? `<div class="torneo-rondas-chips">${rondas
          .map(
            (r) =>
              `<button class="torneo-ronda-chip ${paraMesas?.id === r.id ? 'activa' : ''}" data-ver-ronda="${r.id}">${r.phase === 'top_cut' ? `Cut R${r.round_number}` : `R${r.round_number}`}</button>`
          )
          .join('')}</div>`
      : ''
  $('mesasContenido').innerHTML = paraMesas
    ? `<h4 class="torneo-mesas-titulo">${paraMesas.phase === 'top_cut' ? 'Top cut — mesas' : `Mesas de la ronda ${paraMesas.round_number}`}${paraMesas.status === 'finished' ? ' (cerrada)' : ''}</h4>${pestanas}${pintarMesas(paraMesas)}`
    : ''
  document.querySelectorAll('[data-ver-ronda]').forEach((b) =>
    b.addEventListener('click', () => {
      rondaVista = b.dataset.verRonda
      pintarRondas()
    })
  )
  arrancarReloj(actual)

  document.querySelectorAll('[data-resolver]').forEach((sel) => {
    sel.addEventListener('change', () => {
      if (!sel.value) return
      const partida = partidas.find((m) => m.id === sel.dataset.resolver)
      // Corregir una mesa ya firme pide confirmación: un select se
      // cambia con un mal toque y esto pisa un resultado de verdad.
      if (
        TERMINALES.has(partida.status) &&
        !window.confirm(`Vas a CAMBIAR el resultado ya cerrado de la mesa ${partida.table_number}. ¿Seguro?`)
      ) {
        sel.value = ''
        return
      }
      resolverPartida(partida, sel.value)
    })
  })
  void rellenarChapasArquetipo(caja)
}

function pintarMiPartida() {
  const caja = $('torneoMiPartida')
  const actual = rondaActual()
  // El `yo &&` NO es un adorno: sin sesión miId() es null, y una mesa
  // con bye tiene player_b_id a null — sin este guardia, «Tu partida»
  // le saldría a cualquier visitante con la mesa del bye dentro.
  const yo = miId()
  const mia = yo && actual
    ? partidas.find((m) => m.round_id === actual.id && (m.player_a_id === yo || m.player_b_id === yo))
    : null
  if (!mia) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')

  const soyA = mia.player_a_id === miId()
  const rivalId = soyA ? mia.player_b_id : mia.player_a_id
  const rival = rivalId ? ctx.inscripciones.find((i) => i.user_id === rivalId) : null
  const miListo = soyA ? mia.check_in_a_at : mia.check_in_b_at
  const contenido = $('miPartidaContenido')

  if (mia.status === 'bye') {
    contenido.innerHTML = '<p class="torneo-partida-nota">Tienes <strong>bye</strong> esta ronda: 3 puntos y a descansar.</p>'
    return
  }
  if (TERMINALES.has(mia.status)) {
    const r = resultadoDe(mia.id)
    const texto =
      r?.winner_id === miId() ? '¡Ganaste esta ronda!' : r?.result === 'draw' ? 'Empate.' : 'Esta ronda no cayó de tu lado.'
    contenido.innerHTML = `<p class="torneo-partida-nota">Mesa ${mia.table_number} — ${texto}</p>`
    return
  }
  if (mia.status === 'disputed') {
    contenido.innerHTML = '<p class="torneo-partida-nota">Los reportes no coinciden: lo revisará el organizador o un juez.</p>'
    return
  }
  // La cabecera al estilo «match actual» del original: contexto en
  // mayúsculas, el «vs rival» grande y el reloj de la ronda debajo.
  const bo = actual.phase === 'top_cut' ? ctx.torneo.top_cut_bo : ctx.torneo.swiss_bo
  const cabecera = `
    <p class="torneo-partida-contexto">${actual.phase === 'top_cut' ? 'Top cut' : 'Ronda suiza'} ${actual.round_number} · Mesa ${mia.table_number} · BO${bo}</p>
    <p class="torneo-partida-rival">vs ${escapeHtml(rival?.perfil?.username || 'tu rival')}${chapaDe(rivalId)}</p>
    <p class="torneo-partida-rival-tcg">En TCG Live: <strong>${escapeHtml(rival?.tcg_live_username || '—')}</strong></p>`

  if (mia.status === 'pending') {
    contenido.innerHTML = `${cabecera}<p class="subtext torneo-partida-nota">La ronda aún no ha empezado.</p>`
    void rellenarChapasArquetipo(contenido)
    return
  }

  const rivalListo = soyA ? mia.check_in_b_at : mia.check_in_a_at
  const reloj =
    actual.status === 'active' && actual.ends_at
      ? '<div class="torneo-partida-cuenta" id="cuentaPartida" role="timer" aria-label="Tiempo restante de la ronda">–:––</div><p class="torneo-cuenta-etiqueta">tiempo restante de ronda</p>'
      : actual.phase === 'top_cut'
        ? '<p class="torneo-cuenta-etiqueta torneo-partida-nota">Sin límite de tiempo — se juega a acabar.</p>'
        : ''

  // El check-in a dos columnas (Tú / Rival), como el original — con el
  // aviso claro de la ventana: hay N minutos y quien no lo haga pierde.
  const faltaCheckin = actual.status === 'active' && (!miListo || !rivalListo)
  const checkin = `
    <div class="torneo-checkin-rejilla">
      <div class="torneo-checkin-celda ${miListo ? 'lista' : ''}">
        <strong>Tú</strong>
        <span class="torneo-checkin-estado">${miListo ? '✓ Check-in hecho' : 'Check-in pendiente'}</span>
      </div>
      <div class="torneo-checkin-celda ${rivalListo ? 'lista' : ''}">
        <strong>${escapeHtml(rival?.perfil?.username || 'Rival')}</strong>
        <span class="torneo-checkin-estado">${rivalListo ? '✓ Check-in hecho' : 'Check-in pendiente'}</span>
      </div>
    </div>
    ${
      faltaCheckin
        ? `<p class="torneo-checkin-aviso hidden" id="avisoCheckin">Quedan <strong id="cuentaCheckinPartida">–:––</strong> de check-in — quien no lo haga pierde la ronda.</p>`
        : ''
    }
    ${miListo ? '' : '<button class="btn-primary torneo-boton-checkin" id="btnCheckin">Hacer check-in</button>'}`

  const miReporte = reportes.find((r) => r.match_id === mia.id && r.reporter_id === miId())
  const botones = miReporte
    ? '<p class="subtext">Resultado reportado: falta que tu rival lo confirme (pulsa Actualizar si tarda).</p>'
    : `<h4 class="torneo-mesas-titulo">Reportar resultado</h4>
      <div class="torneo-reportar">
        <button class="torneo-boton-resultado victoria" data-reporte="win">Victoria</button>
        <button class="torneo-boton-resultado derrota" data-reporte="loss">Derrota</button>
        ${actual.phase === 'swiss' && ctx.torneo.swiss_bo === 3 ? '<button class="torneo-boton-resultado empate" data-reporte="draw">Empate</button>' : ''}
      </div>`
  contenido.innerHTML = `${cabecera}${reloj}${checkin}${botones}`
  void rellenarChapasArquetipo(contenido)
  if ($('btnCheckin')) $('btnCheckin').addEventListener('click', () => marcarListo(mia))
  contenido.querySelectorAll('[data-reporte]').forEach((b) => {
    b.addEventListener('click', () => reportar(mia, b.dataset.reporte))
  })
}

// ── La clasificación por jornada y las listas de los rivales (tanda 219) ──
// En una LIGA, además de la general, cada jornada tiene su propia tabla:
// los mismos puntos y desempates, pero contando solo las mesas de esa
// ronda. Y si el organizador activó «listas a la vista», cada fila lleva
// un «Ver lista» que abre la decklist del rival — solo con el torneo ya
// en juego, que las listas se sellan al arrancar la R1.
let vistaClasificacion = 'general' // 'general' o el número de una jornada
let listaRivalAbierta = null // user_id de la decklist desplegada bajo la tabla
let historialAbierto = null // user_id del historial de partidas desplegado
const listasRivales = new Map() // user_id → fila de tournament_decklists (o null)

// ── El historial de un jugador (tandas 237-238, pedido por Ibai) ──
//
// Pulsar un nombre en la clasificación abre un MODAL centrado con SUS
// partidas del torneo: ronda a ronda, contra quién jugó y con qué mazo
// — la ficha del jugador que uno mira en Limitless al acabar un
// torneo. Los resultados son los mismos que ya enseña la pestaña de
// rondas; los MAZOS de los rivales salen solo cuando las listas pueden
// verse (chapaDe devuelve vacío si no), así que no se filtra nada.

// El resultado de una mesa DESDE el lado de un jugador.
function resultadoParaJugadorEn(m, userId) {
  if (m.status === 'bye') return { texto: 'Bye', clase: 'gana' }
  const o = outcomeDe(m)
  const soyA = m.player_a_id === userId
  if (o === 'draw') return { texto: 'E', clase: 'empata' }
  if (o === 'forfeit_both') return { texto: 'D', clase: 'pierde' }
  const gana = o === 'a_wins' || o === 'forfeit_b' ? soyA : !soyA
  return gana ? { texto: 'V', clase: 'gana' } : { texto: 'D', clase: 'pierde' }
}

// El modal, creado una sola vez y colgado del body: así el repintado de
// la clasificación (cada 10 s) no se lo lleva por delante mientras se
// está mirando. Es el patrón modal-overlay/modal-box de components.css,
// el mismo de los modales del perfil.
function modalHistorial() {
  let overlay = document.getElementById('torneoHistorialModal')
  if (overlay) return overlay
  overlay = document.createElement('div')
  overlay.id = 'torneoHistorialModal'
  overlay.className = 'modal-overlay hidden torneo-historial-modal'
  overlay.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="Partidas del jugador">
    <div id="torneoHistorialContenido"></div>
  </div>`
  // Se cierra pulsando fuera de la caja o con Escape, como se espera de
  // cualquier modal.
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarHistorial()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) cerrarHistorial()
  })
  document.body.appendChild(overlay)
  return overlay
}

function cerrarHistorial() {
  historialAbierto = null
  document.getElementById('torneoHistorialModal')?.classList.add('hidden')
}

function abrirHistorialJugador(userId) {
  const mias = partidas
    .filter((m) => TERMINALES.has(m.status) && (m.player_a_id === userId || m.player_b_id === userId))
    .sort((a, b) => (numeroDeRonda(a.round_id) ?? 0) - (numeroDeRonda(b.round_id) ?? 0))
  if (!mias.length) {
    showToast('Ese jugador no tiene partidas cerradas todavía.', 'info')
    return
  }
  let v = 0
  let d = 0
  let e = 0
  const filas = mias
    .map((m) => {
      const r = resultadoParaJugadorEn(m, userId)
      if (r.clase === 'gana') v++
      else if (r.clase === 'pierde') d++
      else e++
      const n = numeroDeRonda(m.round_id)
      const esCut = rondas.find((x) => x.id === m.round_id)?.phase === 'top_cut'
      const rival = m.player_a_id === userId ? m.player_b_id : m.player_a_id
      const contra =
        m.status === 'bye' || !rival
          ? '<span class="torneo-historial-rival subtext">Bye — sin rival</span>'
          : `<span class="torneo-historial-rival">vs <strong>${escapeHtml(nombreDe(rival))}</strong>${chapaDe(rival)}</span>`
      return `<li>
        <span class="torneo-historial-ronda">${esCut ? 'Cut·' : ''}R${n ?? '?'}</span>
        <span class="torneo-historial-res torneo-historial-${r.clase}">${r.texto}</span>
        ${contra}
      </li>`
    })
    .join('')
  historialAbierto = userId
  const overlay = modalHistorial()
  overlay.querySelector('#torneoHistorialContenido').innerHTML = `
    <div class="torneo-historial-cabecera">
      <div class="torneo-historial-quien">
        <strong>${escapeHtml(nombreDe(userId))}</strong>${chapaDe(userId)}
        <span class="torneo-historial-record">${v}-${d}${e ? `-${e}` : ''}</span>
      </div>
      <button type="button" class="modal-close" id="btnCerrarHistorial" aria-label="Cerrar">×</button>
    </div>
    <p class="subtext torneo-historial-torneo">${escapeHtml(ctx.torneo.name)}</p>
    <ol class="torneo-historial-lista">${filas}</ol>`
  overlay.classList.remove('hidden')
  overlay.querySelector('#btnCerrarHistorial').addEventListener('click', cerrarHistorial)
  // Las chapas de los mazos llegan después, como en la tabla.
  void rellenarChapasArquetipo(overlay)
}

function jornadasConPuntos() {
  return rondas
    .filter((r) => r.phase === 'swiss' && partidas.some((m) => m.round_id === r.id && TERMINALES.has(m.status)))
    .map((r) => r.round_number)
}

// Cuándo se ven las listas de los demás — y con ellas los arquetipos,
// que se deducen de ellas (tanda 230).
//
// Dos casos, y la diferencia importa:
//
//   · LISTA ABIERTA (casilla del organizador): desde que empieza a
//     jugarse. Es parte del formato — todo el mundo sabe a qué juega
//     todo el mundo y se prepara en consecuencia.
//   · LISTA CERRADA (lo normal): al TERMINAR el torneo, y ni un minuto
//     antes. Enseñar el mazo del rival a mitad de torneo le regala la
//     partida; enseñarlo cuando ya no se juega nada es lo que hace que
//     el histórico y el registro de enfrentamientos sirvan para algo.
//
// Esto decide lo que se PINTA. Lo que de verdad impide leer la lista de
// otro es la política de la base, que dice lo mismo.
function puedenVerseLasListas() {
  // TRES modos desde la tanda 241 (antes era un booleano): el modo
  // nuevo manda y el booleano viejo hace de respaldo para torneos de
  // antes de la migración.
  const modo = ctx.torneo.decklist_visibility || (ctx.torneo.show_opponent_decklists ? 'en_juego' : 'al_terminar')
  if (modo === 'nunca') return false
  if (ctx.torneo.status === 'finished') return true
  return modo === 'en_juego' && ctx.torneo.status === 'in_progress'
}

async function abrirListaRival(userId) {
  const hueco = $('clasificacionListaRival')
  if (!hueco) return
  if (!listasRivales.has(userId)) {
    const { data } = await supabase
      .from('tournament_decklists')
      .select('*')
      .eq('tournament_id', ctx.torneo.id)
      .eq('user_id', userId)
      .maybeSingle()
    listasRivales.set(userId, data || null)
  }
  const lista = listasRivales.get(userId)
  if (!lista) {
    listaRivalAbierta = null
    hueco.innerHTML = ''
    showToast('Ese jugador no tiene lista entregada.', 'info')
    return
  }
  const p = lista.parsed_cards || {}
  hueco.innerHTML = `
    <div class="torneo-decklist-detalle torneo-lista-rival">
      <div class="torneo-decklist-fila">
        <span><strong>Lista de ${escapeHtml(nombreDe(userId))}</strong> — ${p.total ?? '?'} cartas</span>
        <button class="btn-secondary" id="btnCerrarListaRival">Cerrar</button>
      </div>
      ${botonesExportarHtml()}
      <div class="torneo-decklist-visual" id="listaRivalCartas"></div>
      <pre class="torneo-decklist-cruda">${escapeHtml(lista.raw_text || '')}</pre>
    </div>`
  $('btnCerrarListaRival').addEventListener('click', () => {
    listaRivalAbierta = null
    hueco.innerHTML = ''
  })
  engancharExportar(hueco, { nombre: nombreDe(userId), rawText: lista.raw_text, parsed: p })
  if (p.pokemon || p.trainer || p.energy) await pintarDecklistVisual($('listaRivalCartas'), p)
}

function pintarClasificacion() {
  const caja = $('torneoClasificacionCaja')
  const hayPuntos = partidas.some((m) => TERMINALES.has(m.status))
  if (!hayPuntos) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')

  // Las pestañitas de una liga: General + una por jornada con puntos.
  const jornadas = ctx.torneo.format === 'league' ? jornadasConPuntos() : []
  if (vistaClasificacion !== 'general' && !jornadas.includes(vistaClasificacion)) vistaClasificacion = 'general'
  const chips = jornadas.length
    ? `<div class="torneo-rondas-chips torneo-clasif-chips">
        <button class="torneo-ronda-chip ${vistaClasificacion === 'general' ? 'activa' : ''}" data-ver-clasif="general">General</button>
        ${jornadas
          .map(
            (n) =>
              `<button class="torneo-ronda-chip ${vistaClasificacion === n ? 'activa' : ''}" data-ver-clasif="${n}">Jornada ${n}</button>`
          )
          .join('')}
      </div>`
    : ''

  // La tabla de una jornada nace del MISMO snapshot, quedándose solo con
  // las mesas de esa ronda; y solo lista a quien jugó en ella.
  const general = vistaClasificacion === 'general'
  const snapshot = montarSnapshot(rondas.length)
  if (!general) snapshot.matches = snapshot.matches.filter((m) => m.roundNumber === vistaClasificacion)
  let tabla = computeStandings(snapshot)
  if (!general) tabla = tabla.filter((e) => e.gamesPlayed > 0)

  const verListas = puedenVerseLasListas()
  // El usuario de TCG Live solo para quien ha entrado. A un visitante
  // sin cuenta la base ni se lo manda (grant por columnas), así que la
  // columna se quita entera en vez de enseñar una fila de guiones.
  const verTcgLive = Boolean(miId())
  const corte = ctx.torneo.top_cut_size || 0
  const filas = tabla
    .map((e, i) => {
      const insc = ctx.inscripciones.find((x) => x.user_id === e.playerId)
      const retirado = insc?.status === 'dropped' ? ' <span class="torneo-retirado">(retirado)</span>' : ''
      // Como en el original: mientras hay corte configurado, las plazas
      // que clasifican van marcadas (solo tiene sentido en la general).
      const dentro =
        general && corte > 0 && i + 1 <= corte && insc?.status !== 'dropped'
          ? ` <span class="torneo-marca-top">Top ${corte}</span>`
          : ''
      const verLista = verListas
        ? `<td><button class="btn-secondary torneo-ver-lista" data-ver-lista="${escapeHtml(e.playerId)}">Ver lista</button></td>`
        : ''
      return `
      <tr>
        <td>${i + 1}</td>
        <td><button type="button" class="torneo-jugador-historial" data-historial="${escapeHtml(e.playerId)}"
          title="Ver sus partidas del torneo">${escapeHtml(nombreDe(e.playerId))}</button>${chapaDe(e.playerId)}${retirado}${dentro}</td>
        ${verTcgLive ? `<td class="subtext">${escapeHtml(insc?.tcg_live_username || '—')}</td>` : ''}
        <td><strong>${e.matchPoints}</strong></td>
        <td>${e.wins}-${e.losses}-${e.draws}${e.byesReceived ? ` (+${e.byesReceived} bye)` : ''}</td>
        <td>${(e.owp * 100).toFixed(2)} %</td>
        <td>${(e.oowp * 100).toFixed(2)} %</td>
        ${verLista}
      </tr>`
    })
    .join('')
  const campeon = campeonDelTorneo()
  // El podio del final (tanda 217): el campeón grande en el centro y a
  // los lados quienes le acompañaron. Sustituye a la línea de texto de
  // antes — un torneo se acaba con una foto, no con un aviso. En la
  // vista de una jornada no pinta nada: esa foto es de la general.
  const podio = podioDelTorneo()
  const PUESTOS = ['Campeón', 'Finalista', 'Semifinalista', 'Semifinalista']
  const banner = !general
    ? ''
    : podio.length
    ? `<div class="torneo-podio">
        ${podio
          .map(
            (id, i) => `
          <div class="torneo-podio-puesto torneo-podio-${i + 1}">
            <span class="torneo-podio-icono">${i === 0 ? icons.trophy(26) : icons.medal(20)}</span>
            <strong>${escapeHtml(nombreDe(id))}</strong>
            <span class="subtext">${PUESTOS[i]}</span>
          </div>`
          )
          .join('')}
      </div>`
    : campeon
      ? `<div class="torneo-campeon">${icons.trophy(20)} Campeón del torneo: <strong>${escapeHtml(nombreDe(campeon))}</strong></div>`
      : ''
  $('clasificacionContenido').innerHTML = `
    ${banner}
    ${general ? bracketHtml() : ''}
    ${chips}
    ${general ? '' : `<p class="subtext">Solo cuentan las mesas de la jornada ${vistaClasificacion}.</p>`}
    <div class="torneo-clasificacion-tabla">
      <table>
        <thead><tr><th>#</th><th>Jugador</th>${verTcgLive ? '<th>TCG Live</th>' : ''}<th>Puntos</th><th>V-D-E</th><th>OWP</th><th>OOWP</th>${verListas ? '<th></th>' : ''}</tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div id="clasificacionListaRival"></div>
    ${general && corte > 0 && !rondas.some((r) => r.phase === 'top_cut') ? `<p class="subtext torneo-nota-corte">Las plazas marcadas con «Top ${corte}» clasifican al corte.</p>` : ''}
    <details class="torneo-desempates">
      <summary>¿Cómo se desempata?</summary>
      <p>Con los mismos puntos, manda quién ha tenido rivales más duros —
      igual que en un torneo oficial:</p>
      <ol>
        <li><strong>Puntos</strong>: 3 por victoria, 1 por empate.</li>
        <li><strong>OWP</strong> — el porcentaje de victorias de TUS rivales.
        Si has ganado a gente que gana, subes.</li>
        <li><strong>OOWP</strong> — el de los rivales de tus rivales, para
        deshacer los empates que quedan.</li>
      </ol>
      <p class="subtext">Un jugador retirado sigue contando en el cálculo de
      quienes se enfrentaron a él, y los byes no cuentan como rival.</p>
    </details>`

  // Las pestañitas y los «Ver lista», recién pintados: se enganchan aquí.
  document.querySelectorAll('[data-ver-clasif]').forEach((b) =>
    b.addEventListener('click', () => {
      const valor = b.dataset.verClasif
      vistaClasificacion = valor === 'general' ? 'general' : Number(valor)
      pintarClasificacion()
    })
  )
  document.querySelectorAll('[data-ver-lista]').forEach((b) =>
    b.addEventListener('click', () => {
      listaRivalAbierta = b.dataset.verLista
      void abrirListaRival(listaRivalAbierta)
    })
  )
  // El historial de un jugador: pulsar su nombre abre el modal. Vive
  // colgado del body, así que el repintado de la tabla no lo toca.
  document.querySelectorAll('[data-historial]').forEach((b) =>
    b.addEventListener('click', () => abrirHistorialJugador(b.dataset.historial))
  )
  // El refresco de cada 10 s repinta la caja entera: si había una lista
  // de rival abierta, se vuelve a poner (la caché evita repedirla).
  if (listaRivalAbierta && verListas) void abrirListaRival(listaRivalAbierta)
  // Las cartas de las chapas llegan después: el HTML se construye de una
  // vez y resolverlas es ir a la base.
  void rellenarChapasArquetipo(caja)
}

// El bracket del cut como en su clasificación: una columna por ronda
// (Final / Semifinales / Cuartos / Top N), cada mesa con el ganador en
// negrita y los byes a la vista.
function etiquetaFaseCut(mesas) {
  if (mesas === 1) return 'Final'
  if (mesas === 2) return 'Semifinales'
  if (mesas === 4) return 'Cuartos'
  return `Top ${mesas * 2}`
}

function bracketHtml() {
  const rondasCut = rondas.filter((r) => r.phase === 'top_cut')
  if (!rondasCut.length) return ''
  const columnas = rondasCut
    .map((r) => {
      const mesas = partidas.filter((m) => m.round_id === r.id).sort((a, b) => a.bracket_position - b.bracket_position)
      const cajas = mesas
        .map((m) => {
          const ganador = m.status === 'bye' ? m.player_a_id : resultadoDe(m.id)?.winner_id ?? null
          const linea = (id, esBye) => {
            const texto = esBye ? 'BYE' : id ? escapeHtml(nombreDe(id)) : '—'
            return `<p class="${ganador !== null && ganador === id ? 'torneo-bracket-gana' : ''}">${texto}</p>`
          }
          return `<div class="torneo-bracket-mesa">${linea(m.player_a_id, false)}${linea(m.player_b_id, m.is_bye || !m.player_b_id)}</div>`
        })
        .join('')
      return `<div class="torneo-bracket-col"><h5>${etiquetaFaseCut(mesas.length)} (R${r.round_number})</h5>${cajas}</div>`
    })
    .join('')
  return `<div class="torneo-bracket">${columnas}</div>`
}

function pintarCiclo() {
  pintarRondas()
  pintarMiPartida()
  pintarClasificacion()
  ctx.alRepintar?.()

  // El sondeo ya no vive aquí: torneo.js refresca la ficha ENTERA cada
  // 10 s (inscripciones, mesas, chats y cola de jueces a la vez), que
  // era lo que faltaba para no depender del botón Actualizar.
}

export async function recargarCiclo() {
  await cargarCiclo()
}

// El PODIO (tanda 217): los cuatro primeros en orden, sacados del
// bracket del cut — campeón y finalista de la final, semifinalistas de
// la ronda anterior (los que perdieron). Sin cut (torneo solo de
// suizas) el podio son los cuatro primeros de la clasificación, que es
// exactamente como se reparten los premios de verdad.
export function podioDelTorneo() {
  if (ctx?.torneo?.status !== 'finished') return []
  const rondasCut = rondas.filter((r) => r.phase === 'top_cut').sort((a, b) => a.round_number - b.round_number)
  if (!rondasCut.length) {
    return computeStandings(montarSnapshot(rondas.length))
      .slice(0, 4)
      .map((e) => e.playerId)
  }
  const final = rondasCut[rondasCut.length - 1]
  const mesaFinal = partidas.filter((m) => m.round_id === final.id)[0]
  if (!mesaFinal) return []
  const campeon = mesaFinal.status === 'bye' ? mesaFinal.player_a_id : resultadoDe(mesaFinal.id)?.winner_id ?? null
  if (!campeon) return []
  const finalista = [mesaFinal.player_a_id, mesaFinal.player_b_id].find((j) => j && j !== campeon) ?? null
  // Los semifinalistas: quienes jugaron la ronda anterior del cut y no
  // llegaron a la final. Empatan en el tercer puesto (no se juega).
  const semis = rondasCut.length > 1
    ? partidas
        .filter((m) => m.round_id === rondasCut[rondasCut.length - 2].id)
        .flatMap((m) => [m.player_a_id, m.player_b_id])
        .filter((j) => j && j !== campeon && j !== finalista)
    : []
  return [campeon, finalista, ...semis].filter(Boolean).slice(0, 4)
}

// Lo que hace falta para repartir la gloria (tanda 208): quién es el
// campeón y quiénes pisaron el top cut. Solo con el torneo terminado.
export function resumenDeGloria() {
  if (ctx?.torneo?.status !== 'finished') return null
  const rondasDeCut = new Set(rondas.filter((r) => r.phase === 'top_cut').map((r) => r.id))
  const pisaronElCut = new Set(
    partidas
      .filter((m) => rondasDeCut.has(m.round_id))
      .flatMap((m) => [m.player_a_id, m.player_b_id])
      .filter(Boolean)
  )
  return { campeonId: campeonDelTorneo(), pisaronElCut }
}

// torneo.js llama a esto en cada recarga de la ficha, con el contexto
// fresco (torneo, sesión, perfil e inscripciones con perfil resuelto).
export async function montarCiclo(contexto) {
  ctx = contexto
  await cargarCiclo()
  pintarCiclo()
}
