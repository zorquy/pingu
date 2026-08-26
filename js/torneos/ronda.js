// El ciclo de ronda de un torneo (SPEC §6 de TrainerArena, portado):
// generar pareos, iniciar, check-in, reportes con confirmación del rival,
// resolución a mano del organizador y cierre. Sin colas ni WebSockets:
// los relojes automáticos llegan con la función programada (tanda 206) y
// el refresco es por sondeo — decisiones fijadas en CLAUDE.md.
//
// torneo.js monta este módulo con montarCiclo(ctx) en cada recarga.
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

let ctx = null // { torneo, session, perfil, inscripciones, recargarFicha }
let rondas = []
let partidas = []
let reportes = []
let resultados = []
let historial = []
let sondeo = null
let reloj = null
let rondaVista = null // qué ronda se está mirando en «Mesas» (null = la viva)

const $ = (id) => document.getElementById(id)
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
  const { data: hist } = await supabase
    .from('pairing_history')
    .select('player_low_id, player_high_id')
    .eq('tournament_id', ctx.torneo.id)
  historial = hist || []

  await conciliarPendientes()
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

  const snapshot = montarSnapshot(n)
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
  const soyA = partida.player_a_id === ctx.session.user.id
  const columna = soyA ? 'check_in_a_at' : 'check_in_b_at'
  if (partida[columna]) return
  await supabase.from('tournament_matches').update({ [columna]: ahora() }).eq('id', partida.id)
  await recargarCiclo()
  pintarCiclo()
}

async function reportar(partida, resultado) {
  // Lectura fresca: el rival puede haber reportado desde su sesión.
  const { data: previos } = await supabase.from('match_reports').select('*').eq('match_id', partida.id)
  const lista = previos || []
  const mio = lista.find((r) => r.reporter_id === ctx.session.user.id)
  if (mio) {
    showToast(
      mio.result === resultado ? 'Ese resultado ya estaba reportado.' : 'Ya reportaste un resultado distinto: llama al organizador.',
      mio.result === resultado ? 'info' : 'error'
    )
    return
  }
  const { error } = await supabase
    .from('match_reports')
    .insert({ match_id: partida.id, reporter_id: ctx.session.user.id, result: resultado, reported_at: ahora() })
  if (error) {
    showToast('No se ha podido reportar: ' + error.message, 'error')
    return
  }

  const delRival = lista.find((r) => r.reporter_id !== ctx.session.user.id)
  if (!delRival) {
    await supabase.from('tournament_matches').update({ status: 'awaiting_confirmation' }).eq('id', partida.id)
    showToast('Reportado. Falta que tu rival lo confirme.', 'success')
  } else {
    const soyA = partida.player_a_id === ctx.session.user.id
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
  await supabase.from('match_results').insert({
    match_id: partida.id,
    result: resultado,
    winner_id: lado === 'a' ? partida.player_a_id : lado === 'b' ? partida.player_b_id : null,
    resolved_by: ctx.session.user.id,
  })
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
  if (ronda.status !== 'pending' || !sueltos.length || !ctx.perfil.is_admin) {
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
  if (!marcador || ronda?.status !== 'active' || !ronda.started_at) return
  const cierreCheckin = new Date(ronda.started_at).getTime() + (ctx.torneo.checkin_minutes || 0) * 60000
  const fin = ronda.ends_at ? new Date(ronda.ends_at).getTime() : null

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
  }
  pintarReloj()
  reloj = setInterval(pintarReloj, 1000)
}

function pintarMesas(ronda) {
  const mesas = partidas.filter((m) => m.round_id === ronda.id).sort((a, b) => a.table_number - b.table_number)
  const filas = mesas
    .map((m) => {
      const terminal = TERMINALES.has(m.status)
      const estado = terminal
        ? `<span class="torneo-mesa-resultado">${escapeHtml(textoTerminal(m))}</span>`
        : `<span class="torneo-estado torneo-estado-${m.status === 'disputed' ? 'cerrado' : 'jugando'}">${ESTADOS_MESA[m.status]}</span>`
      const listoA = m.check_in_a_at ? ' ✓' : ''
      const listoB = m.check_in_b_at ? ' ✓' : ''
      const rival = m.player_b_id ? ` — ${escapeHtml(nombreDe(m.player_b_id))}${listoB}` : ' — bye'
      // El organizador puede resolver a mano cualquier mesa viva.
      const resolver =
        !terminal && (ctx.perfil.is_admin || ctx.esJuez) && ronda.status === 'active'
          ? `<span class="torneo-mesa-resolver">
              <select data-resolver="${m.id}">
                <option value="">Resolver…</option>
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
          ? `<div class="torneo-disputa-reportes">${reportes
              .filter((r) => r.match_id === m.id)
              .map(
                (r) =>
                  `<span class="torneo-reporte-carta"><strong>${escapeHtml(nombreDe(r.reporter_id))}</strong> reportó ${ETIQUETA_REPORTE[r.result] || r.result} a las ${hora(r.reported_at || r.created_at)}</span>`
              )
              .join('')}</div>`
          : ''
      return `
      <div class="torneo-mesa">
        <span class="torneo-mesa-numero">Mesa ${m.table_number}</span>
        <span class="torneo-mesa-jugadores">${escapeHtml(nombreDe(m.player_a_id))}${listoA}${rival}</span>
        ${estado}${resolver}${enfrentados}
      </div>`
    })
    .join('')
  return filas || '<p class="subtext">Sin mesas todavía.</p>'
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
  if (ctx.perfil.is_admin && ctx.torneo.status !== 'finished') {
    if (!actual && rondas.length < ctx.torneo.swiss_rounds) {
      admin = `<button class="btn-primary" id="btnGenerarPareos">Generar pareos de la ronda ${rondas.length + 1}</button>`
    } else if (actual?.status === 'pending') {
      admin = `<button class="btn-primary" id="btnIniciarRonda">Iniciar ronda ${actual.round_number}</button>`
    } else if (actual?.status === 'active') {
      admin = `<button class="btn-secondary" id="btnCerrarRonda">Cerrar ronda ${actual.round_number}</button>`
    }
  }
  $('rondasAdmin').innerHTML = `
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
      resolverPartida(partida, sel.value)
    })
  })
}

function pintarMiPartida() {
  const caja = $('torneoMiPartida')
  const actual = rondaActual()
  const mia = actual
    ? partidas.find(
        (m) => m.round_id === actual.id && (m.player_a_id === ctx.session.user.id || m.player_b_id === ctx.session.user.id)
      )
    : null
  if (!mia) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')

  const soyA = mia.player_a_id === ctx.session.user.id
  const rivalId = soyA ? mia.player_b_id : mia.player_a_id
  const rival = rivalId ? ctx.inscripciones.find((i) => i.user_id === rivalId) : null
  const miListo = soyA ? mia.check_in_a_at : mia.check_in_b_at
  const contenido = $('miPartidaContenido')

  if (mia.status === 'bye') {
    contenido.innerHTML = '<p>Tienes <strong>bye</strong> esta ronda: 3 puntos y a descansar.</p>'
    return
  }
  if (TERMINALES.has(mia.status)) {
    const r = resultadoDe(mia.id)
    const texto =
      r?.winner_id === ctx.session.user.id ? '¡Ganaste esta ronda!' : r?.result === 'draw' ? 'Empate.' : 'Esta ronda no cayó de tu lado.'
    contenido.innerHTML = `<p>Mesa ${mia.table_number} — ${texto}</p>`
    return
  }
  if (mia.status === 'disputed') {
    contenido.innerHTML = '<p>Los reportes no coinciden: lo revisará el organizador o un juez.</p>'
    return
  }
  if (mia.status === 'pending') {
    contenido.innerHTML = `<p>Mesa ${mia.table_number} contra <strong>${escapeHtml(rival?.perfil?.username || 'tu rival')}</strong>. La ronda aún no ha empezado.</p>`
    return
  }

  const miReporte = reportes.find((r) => r.match_id === mia.id && r.reporter_id === ctx.session.user.id)
  const botones = miReporte
    ? '<p class="subtext">Resultado reportado: falta que tu rival lo confirme (pulsa Actualizar si tarda).</p>'
    : `<div class="torneo-reportar">
        <button class="btn-primary" data-reporte="win">He ganado</button>
        <button class="btn-secondary" data-reporte="loss">He perdido</button>
        ${actual.phase === 'swiss' && ctx.torneo.swiss_bo === 3 ? '<button class="btn-secondary" data-reporte="draw">Empate</button>' : ''}
      </div>`
  contenido.innerHTML = `
    <p>Mesa ${mia.table_number} contra <strong>${escapeHtml(rival?.perfil?.username || 'tu rival')}</strong>
      (TCG Live: ${escapeHtml(rival?.tcg_live_username || '—')}).</p>
    ${miListo ? '<p class="subtext">✓ Listo. A jugar en TCG Live y a reportar aquí el resultado.</p>' : '<button class="btn-primary" id="btnListo">Estoy listo</button>'}
    ${botones}`
  if ($('btnListo')) $('btnListo').addEventListener('click', () => marcarListo(mia))
  contenido.querySelectorAll('[data-reporte]').forEach((b) => {
    b.addEventListener('click', () => reportar(mia, b.dataset.reporte))
  })
}

function pintarClasificacion() {
  const caja = $('torneoClasificacionCaja')
  const hayPuntos = partidas.some((m) => TERMINALES.has(m.status))
  if (!hayPuntos) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')
  const tabla = computeStandings(montarSnapshot(rondas.length))
  const corte = ctx.torneo.top_cut_size || 0
  const filas = tabla
    .map((e, i) => {
      const insc = ctx.inscripciones.find((x) => x.user_id === e.playerId)
      const retirado = insc?.status === 'dropped' ? ' <span class="torneo-retirado">(retirado)</span>' : ''
      // Como en el original: mientras hay corte configurado, las plazas
      // que clasifican van marcadas.
      const dentro =
        corte > 0 && i + 1 <= corte && insc?.status !== 'dropped'
          ? ` <span class="torneo-marca-top">Top ${corte}</span>`
          : ''
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(nombreDe(e.playerId))}${retirado}${dentro}</td>
        <td class="subtext">${escapeHtml(insc?.tcg_live_username || '—')}</td>
        <td><strong>${e.matchPoints}</strong></td>
        <td>${e.wins}-${e.losses}-${e.draws}${e.byesReceived ? ` (+${e.byesReceived} bye)` : ''}</td>
        <td>${(e.owp * 100).toFixed(2)} %</td>
        <td>${(e.oowp * 100).toFixed(2)} %</td>
      </tr>`
    })
    .join('')
  const campeon = campeonDelTorneo()
  const banner = campeon
    ? `<div class="torneo-campeon">${icons.trophy(20)} Campeón del torneo: <strong>${escapeHtml(nombreDe(campeon))}</strong></div>`
    : ''
  $('clasificacionContenido').innerHTML = `
    ${banner}
    ${bracketHtml()}
    <div class="torneo-clasificacion-tabla">
      <table>
        <thead><tr><th>#</th><th>Jugador</th><th>TCG Live</th><th>Puntos</th><th>V-D-E</th><th>OWP</th><th>OOWP</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    ${corte > 0 && !rondas.some((r) => r.phase === 'top_cut') ? `<p class="subtext torneo-nota-corte">Las plazas marcadas con «Top ${corte}» clasifican al corte.</p>` : ''}`
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

  // Sondeo suave mientras hay ronda viva: los reportes del rival llegan
  // de otra sesión y aquí no hay WebSockets a propósito.
  const viva = rondaActual()
  if (viva && !sondeo) {
    sondeo = setInterval(async () => {
      if (document.hidden) return
      await recargarCiclo()
      pintarCiclo()
    }, 10000)
  } else if (!viva && sondeo) {
    clearInterval(sondeo)
    sondeo = null
  }
}

export async function recargarCiclo() {
  await cargarCiclo()
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
