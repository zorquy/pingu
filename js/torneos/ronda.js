// El ciclo de ronda de un torneo (SPEC §6 de TrainerArena, portado):
// generar pareos, iniciar, check-in, reportes con confirmación del rival,
// resolución a mano del organizador y cierre. Sin colas ni WebSockets:
// los relojes automáticos llegan con la función programada (tanda 206) y
// el refresco es por sondeo — decisiones fijadas en CLAUDE.md.
//
// torneo.js monta este módulo con montarCiclo(ctx) en cada recarga.
import { faltaLaRpc, avisoDeMigracion, puedeLlevar, colorDeNombre, premiosDeTorneo, quienSeLleva } from './comun.js'
import { supabase } from '../supabase.js'
import { pintarSiCambia } from './pintar.js'
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
  serieBo3,
  juegoAbierto,
  seedTopCut,
  advanceTopCut,
} from './motor.js'
import { pintarDecklistVisual, chapaArquetipoHtml, rellenarChapasArquetipo } from './cartas-decklist.js'
import { arquetipoDeMazo } from './arquetipos.js'
import { botonesExportarHtml, engancharExportar } from './decklist-export.js'
import { TERMINALES, progresoDeMesas } from './mesas.js'
import { cargarJornadas, quienesJuegan, jornadaCerrada, jornadaEmpezada, publicarListasJornada, cerrarJornada } from './jornadas.js'
import { guardarListaEnMisMazos, enlaceParaEntrar } from '../guardar-lista.js'
import { enlaceConstructor } from '../meta/nucleo.js'
import { agruparMeta, metaHtml, ordenFinal } from './meta-torneo.js'
import { adjuntarATorneo, quitarDeTorneo, repeticionesDePartidas, misRepeticiones, guardar as guardarRepeticion, adjuntarDeMesa, quitarDeMesa } from '../repeticiones/datos.js'
import { ICONOS_REPETICION } from '../repeticiones/iconos.js'

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
// Las repeticiones adjuntas a las mesas (tanda 496): { match_id, user_id,
// replay_id }. Las que la base deja ver: las de tus mesas, o todas si
// llevas o arbitras el torneo.
let repeticionesMesas = []
// Los premios ya dados (tanda 516): userId → fecha. null = la tabla aún no
// existe (falta la migración) y no se sabe; undefined = sin pedir todavía.
let entregasPremios

const $ = (id) => document.getElementById(id)
// Quién mira. Puede ser NULL: desde la tanda 229 la ficha se abre
// también sin cuenta (modo escaparate). Sin identidad no hay «tu
// partida» ni reportes — solo mesas, rondas y clasificación.
const miId = () => ctx.session?.user?.id ?? null
// Quién LLEVA este torneo: el equipo, o quien lo creó (tanda 296).
const mando = () => puedeLlevar(ctx.perfil, ctx.torneo, miId())

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
    // Los RESULTADOS los necesita todo el mundo: son la clasificación y
    // el marcador de cada mesa, que es lo que viene a ver un espectador.
    //
    // Los REPORTES no. Son el paso intermedio —«fulano ya ha dicho lo
    // suyo, falta el rival»— y solo le sirven a quien juega esa mesa, al
    // organizador y a los jueces, que son quienes pueden hacer algo con
    // ellos. Con la sección ya pública, pedirlos en cada refresco para
    // todo el que mire era una consulta cada diez segundos por persona
    // para pintar algo que esa persona no ve (tanda 255).
    const mi = miId()
    const necesitaReportes = Boolean(
      mando() || ctx.esJuez || (mi && partidas.some((m) => m.player_a_id === mi || m.player_b_id === mi))
    )
    // Las repeticiones de las mesas: las de los jugadores (tanda 496) solo
    // las ve quien juega, lleva o arbitra; las DE MESA que añade un juez
    // (tanda 555), cualquiera, así que se piden para todo el mundo — la
    // base decide qué filas devuelve a cada uno.
    const [{ data: reps }, { data: ress }, adjuntas] = await Promise.all([
      necesitaReportes
        ? supabase.from('match_reports').select('*').in('match_id', idsPartidas)
        : Promise.resolve({ data: [] }),
      supabase.from('match_results').select('*').in('match_id', idsPartidas),
      repeticionesDePartidas(idsPartidas),
    ])
    reportes = reps || []
    resultados = ress || []
    repeticionesMesas = adjuntas || []
  } else {
    repeticionesMesas = []
  }
  // OJO: el historial de cruces (pairing_history) NO se pide aquí.
  // Solo lo usa el pareo suizo, que es un botón del organizador, y
  // pedirlo en cada refresco era una consulta cada diez segundos para
  // todo el que mirase la ficha. Se carga en cargarHistorial(), justo
  // antes de parear.

  // Y lo que se acaba de cargar se deja a mano del módulo de jueces,
  // que necesita las mismas rondas y las mismas mesas: montarJueces()
  // corre después de este, así que las lee de aquí en vez de volver a
  // pedirlas a la base. Dos consultas menos por refresco. Los reportes
  // también (tanda 394): la caja de «Sin check-in» de los jueces los
  // necesita para no señalar a quien ya ha reportado — y a ellos solo se
  // les cargan si son jueces u organizador, que es justo quien la ve.
  ctx.ciclo = { rondas, partidas, reportes }

  // Una vez por página y no en cada refresco: solo cambian cuando quien
  // lleva el torneo marca una, y entonces se vuelven a pedir.
  if (entregasPremios === undefined && ctx.torneo.status === 'finished' && premiosDeTorneo(ctx.torneo).length) await cargarEntregas()

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
  return chapaArquetipoHtml(arq, { marcar: Boolean(mando() || ctx.esJuez) })
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

// En una liga, quién juega la jornada n: quien ha mandado su lista
// (tanda 635). NULL = no aplica (no es liga, no se ven las listas, o es
// una jornada en la que nadie mandó lista porque se jugó antes de que
// existieran — ahí juega quien jugaba, como siempre).
function juegaLaJornada(n) {
  const juegan = quienesJuegan(ctx.jornadas, n)
  return juegan && juegan.size ? juegan : null
}

// El snapshot inmutable que pide el motor (SPEC §5.1): jugadores con su
// baja y solo las partidas terminales, con el resultado resuelto.
function montarSnapshot(numeroRonda) {
  const juegan = juegaLaJornada(numeroRonda)
  return {
    pairingSeed: ctx.torneo.pairing_seed,
    currentRoundNumber: numeroRonda,
    players: ctx.inscripciones.map((i) => {
      // Quien no tiene lista para ESTA jornada (tanda 635) va al motor
      // como retirado justo antes de ella: no se le sienta en esta y en
      // la siguiente vuelve si manda lista, porque cada snapshot se monta
      // para UNA ronda. El motor no se toca (es TrainerArena 1:1).
      if (juegan && i.status !== 'dropped' && !juegan.has(i.user_id)) {
        return { id: i.user_id, dropped: true, droppedAfterRoundNumber: numeroRonda - 1 }
      }
      return {
        id: i.user_id,
        dropped: i.status === 'dropped',
        droppedAfterRoundNumber: i.dropped_after_round_id ? numeroDeRonda(i.dropped_after_round_id) : null,
      }
    }),
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
  const retirados = []
  for (const i of fuera) {
    // El `.select('id')` no es de adorno: un UPDATE que la política
    // rechaza NO da error, devuelve CERO filas. Sin mirar cuántas
    // volvieron, aquí se daba por retirado a alguien que sigue activo en
    // la base — y la ronda se pareaba sin él. Divergir así es peor que
    // fallar: no se ve hasta que alguien pregunta por qué no juega.
    const { data, error } = await supabase
      .from('tournament_registrations')
      .update({ status: 'dropped', dropped_at: ahora(), dropped_after_round_id: null })
      .eq('id', i.id)
      .select('id')
    if (error || !data?.length) continue
    // El estado local se parchea a mano: el snapshot que se monta justo
    // después ya no debe sentarlos.
    i.status = 'dropped'
    retirados.push(i)
  }
  return retirados
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

  // En una liga, quién juega esta jornada se lee AHORA y no del último
  // refresco: alguien puede haber mandado su lista hace cinco segundos
  // (tanda 635). Y la jornada tiene que estar CERRADA: emparejar con las
  // inscripciones abiertas dejaría fuera al que la manda después.
  const porJornadas = ctx.torneo.format === 'league' && Boolean(ctx.jornadas)
  let juegan = null
  if (porJornadas) {
    const frescas = await cargarJornadas(ctx.torneo, { userId: ctx.session?.user?.id || null, todas: true })
    if (frescas) ctx.jornadas = frescas
    if (!jornadaCerrada(ctx.jornadas, n)) {
      showToast(`Cierra antes las inscripciones de la jornada ${n}: hasta entonces se pueden mandar listas.`, 'error')
      return
    }
    juegan = quienesJuegan(ctx.jornadas, n) || new Set()
    const sentables = ctx.inscripciones.filter((i) => i.status === 'active' && juegan.has(i.user_id)).length
    if (sentables < 2) {
      showToast(
        `No hay con quién emparejar la jornada ${n}: ${sentables === 1 ? 'solo un jugador ha mandado' : 'nadie ha mandado'} su lista.`,
        'error'
      )
      return
    }
  }

  // Los dos pasos de la R1 no van en una liga por jornadas: ahí jugar ES
  // mandar la lista de la jornada, y quien no la manda no se retira.
  if (n === 1 && !porJornadas) {
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
  // La lista de esta jornada pasa a ser «la» lista de cada uno: la que
  // ven el rival, los jueces y el meta, con la regla de visibilidad de
  // siempre (tanda 635). Antes no, para no enseñar una lista futura.
  if (porJornadas) {
    const error = await publicarListasJornada(ctx.torneo.id, n)
    if (error) showToast(`Pareos hechos, pero las listas de la jornada ${n} no se han podido publicar: ${error.message}`, 'error')
  }

  // Un cruce repetido que nadie sabe que se repite sí sería un problema:
  // se canta, y con los nombres, porque es lo que el juez tiene que poder
  // explicarle a la mesa si alguien pregunta (tanda 290).
  const repes = plan.repetidos || []
  showToast(
    sinParear.length
      ? `Pareo incompleto: quedan ${sinParear.length} jugadores por sentar a mano.`
      : repes.length
        ? `Ronda ${n} pareada, pero ${repes.length === 1 ? 'una mesa repite cruce' : `${repes.length} mesas repiten cruce`}: ${repes
            .map((m) => `mesa ${m.tableNumber} (${nombreDe(m.playerAId)} vs ${nombreDe(m.playerBId)})`)
            .join(', ')}. No había forma de evitarlo sin dejar a nadie sin sentar.`
        : juegan
          ? `Pareos de la jornada ${n} generados: juegan ${juegan.size} con su lista.`
          : `Pareos de la ronda ${n} generados.`,
    sinParear.length || repes.length ? 'error' : 'success'
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

// ── El podio se congela AQUÍ (tanda 388) ──
//
// Antes lo sellaba `sellarResultado()` en torneo.js, y solo cuando
// alguien CON MANDO volvía a abrir la ficha del torneo. Pero el
// organizador acaba el torneo desde la vista de rondas: si no vuelve a
// entrar en la ficha —y no tiene por qué—, el podio se quedaba sin
// congelar para siempre. Y de ahí cuelga media sección:
//
//   · El palmarés de los perfiles lee `podium`.
//   · El anuncio del resultado en el hilo del foro (desde la 217).
//   · Y desde la 387, el XP de los torneos: el barredor solo reparte
//     cuando el podio está sellado, porque es la única fuente de quién
//     quedó dónde. Sin sellar no reparte NADA, y el registro dice que
//     todo va bien.
//
// El podio es un hecho en el momento en que se cierra la última mesa, y
// justo aquí está calculado: `podioDelTorneo()` vive en este mismo
// módulo. Sellarlo al terminar quita la dependencia de que alguien pase
// por la página.
//
// `sellarResultado()` se queda como red: si esto falló (se cayó la red
// entre el update y el sello), la siguiente visita del organizador lo
// arregla. Lo que ya no hace es ser el ÚNICO camino.
async function terminarTorneo(mensaje) {
  await supabase.from('tournaments').update({ status: 'finished' }).eq('id', ctx.torneo.id)
  // El orden importa: `podioDelTorneo()` devuelve vacío si el torneo no
  // está en `finished`, así que el estado se pone en ctx ANTES de
  // preguntar por el podio.
  ctx.torneo.status = 'finished'

  const podio = podioDelTorneo()
  if (podio.length) {
    const cambios = { champion_id: podio[0], podium: podio }
    const { error } = await supabase.from('tournaments').update(cambios).eq('id', ctx.torneo.id)
    // Si no se puede sellar, el torneo YA está terminado y eso es lo que
    // importa: no se deshace nada ni se molesta a nadie con un error. La
    // ficha lo volverá a intentar.
    if (!error) Object.assign(ctx.torneo, cambios)
  }
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
    // Antes aquí se hacía el update a pelo. No escribía nada —la tabla es
    // de admins— y encima no daba error: el jugador se quedaba sin
    // check-in creyendo que lo tenía (tanda 293).
    showToast(avisoDeMigracion('supabase-migration-torneos-publico.sql'), 'error')
    return
  }
  if (res.error) {
    showToast('No se ha podido marcar listo: ' + res.error.message, 'error')
    return
  }
  await recargarCiclo()
  pintarCiclo()
}

// ── El mejor de tres, partida a partida (tanda 291) ──
//
// De los reportes en crudo salen dos cosas: lo que he dicho YO de cada
// partida (aunque el rival no haya contestado) y lo que ya está
// CONFIRMADO por los dos. El resultado de la serie no se guarda: se
// deduce de lo confirmado, que es lo que hace que no pueda
// desincronizarse.
function juegosDeMesa(partida) {
  const suyos = reportes.filter((r) => r.match_id === partida.id)
  const nDe = (r) => r.game_number ?? 0
  const mios = {}
  for (const r of suyos) if (r.reporter_id === miId()) mios[nDe(r)] = r.result

  const confirmados = {}
  for (const n of [1, 2, 3]) {
    const a = suyos.find((r) => nDe(r) === n && r.reporter_id === partida.player_a_id)
    const b = suyos.find((r) => nDe(r) === n && r.reporter_id === partida.player_b_id)
    if (!a || !b) continue
    const casan = reconcileReports(a.result, b.result)
    if (casan) confirmados[n] = casan.result
  }
  return { mios, confirmados }
}

// Un resultado de partida, contado desde MI lado.
// Cómo fue una partida desde mi lado, en una palabra que vale como
// clase de CSS. Va aparte del texto a propósito: pintar la casilla de
// verde o rojo mirando la FRASE («¿pone "ganaste"?») se rompe el día que
// alguien cambie el texto, y no se nota hasta que está en producción.
function comoFue(resultado, soyA) {
  if (resultado === 'draw') return 'tablas'
  return (resultado === 'a_wins') === soyA ? 'ganada' : 'perdida'
}

function comoMeFue(resultado, soyA) {
  return { ganada: 'La ganaste', perdida: 'La perdiste', tablas: 'Tablas' }[comoFue(resultado, soyA)]
}

const NOMBRE_DE_REPORTE = { win: 'Victoria', loss: 'Derrota', draw: 'Tablas' }

function filaDeJuego(partida, n, { mios, confirmados }, soyA) {
  const abierta = juegoAbierto(confirmados, n)
  const serie = serieBo3(confirmados)
  let cuerpo
  if (confirmados[n]) {
    cuerpo = `<span class="torneo-bo3-cerrada">${comoMeFue(confirmados[n], soyA)}</span>`
  } else if (mios[n]) {
    // Tu parte puesta y el rival sin contestar: se puede cambiar, que no
    // es deshacer nada — es enmendarlo antes de que valga.
    cuerpo = `<span class="torneo-bo3-esperando">Has dicho <strong>${NOMBRE_DE_REPORTE[mios[n]] || mios[n]}</strong> · falta tu rival</span>
      <button class="btn-outline torneo-bo3-quitar" data-quitar="${n}">Cambiar</button>`
  } else if (abierta) {
    cuerpo = `<div class="torneo-reportar">
        <button class="torneo-boton-resultado victoria" data-reporte="win" data-juego="${n}">Victoria</button>
        <button class="torneo-boton-resultado derrota" data-reporte="loss" data-juego="${n}">Derrota</button>
        <button class="torneo-boton-resultado empate" data-reporte="draw" data-juego="${n}">Tablas</button>
      </div>`
  } else if (serie.decidida) {
    // Lo que pidió PINGU: ganadas dos, la tercera no se juega y no se
    // puede votar.
    cuerpo = '<span class="torneo-bo3-nojuega">No se juega</span>'
  } else {
    cuerpo = '<span class="torneo-bo3-nojuega">Pendiente</span>'
  }
  // La casilla dice por el COLOR cómo fue, no solo por el texto: verde
  // la ganada, roja la perdida, con filo navy la que toca marcar. En un
  // BO3 eso es lo que se mira de reojo mientras se juega.
  const clase = confirmados[n] ? `cerrada ${comoFue(confirmados[n], soyA)}` : abierta ? 'activa' : ''
  return `<div class="torneo-bo3-juego ${clase}"><span class="torneo-bo3-n">${n}.ª partida</span>${cuerpo}</div>`
}

function panelBo3(partida, soyA) {
  const estado = juegosDeMesa(partida)
  const serie = serieBo3(estado.confirmados)
  const mias = soyA ? serie.ganadasA : serie.ganadasB
  const suyas = soyA ? serie.ganadasB : serie.ganadasA
  const marcador = serie.decidida
    ? `Serie terminada: ${mias}-${suyas}.`
    : `Vas ${mias}-${suyas}. Marca cada partida en cuanto acabe.`
  return `<div class="torneo-bo3-cab">
      <h4 class="torneo-mesas-titulo">Resultado, partida a partida</h4>
      <span class="torneo-chapa torneo-chapa-neutra">${escapeHtml(marcador.split('.')[0])}</span>
    </div>
    <div class="torneo-bo3">${[1, 2, 3].map((n) => filaDeJuego(partida, n, estado, soyA)).join('')}</div>`
}

async function desreportar(partida, juego) {
  const res = await supabase.rpc('torneos_desreportar', { p_partida: partida.id, p_juego: juego })
  if (faltaLaRpc(res.error)) {
    showToast('Falta ejecutar supabase-migration-torneos-bo3.sql en Supabase.', 'error')
    return
  }
  if (res.error) {
    const texto = String(res.error.message || '')
    showToast(texto.length < 120 ? texto : 'No se ha podido quitar el reporte.', 'error')
    return
  }
  await ctx.recargarFicha()
}

async function reportar(partida, resultado, juego = 0) {
  // Lectura fresca: el rival puede haber reportado desde su sesión.
  const { data: previos } = await supabase.from('match_reports').select('*').eq('match_id', partida.id)
  const lista = (previos || []).filter((r) => (r.game_number ?? 0) === juego)
  const mio = lista.find((r) => r.reporter_id === miId())
  // Con el rival ya pronunciado, un reporte distinto es una disputa y lo
  // dice la RPC. Sin él, cambiar el propio parte es legítimo: se deja
  // pasar a la RPC, que es quien sabe si el rival ha contestado.
  if (mio && (mio.result === resultado || lista.some((r) => r.reporter_id !== miId()))) {
    showToast(
      mio.result === resultado ? 'Ese resultado ya estaba reportado.' : 'Ya reportaste un resultado distinto: llama al organizador.',
      mio.result === resultado ? 'info' : 'error'
    )
    return false
  }
  // Por la RPC: reporta, concilia con lo del rival y cierra la mesa, todo
  // en el servidor y con la fila bajo candado. Desde el navegador eran
  // tres escrituras seguidas, y dos rivales reportando a la vez podían
  // pisarse. Además `match_reports` es de escritura solo por RPC con la
  // sección abierta.
  const res = await supabase.rpc('torneos_reportar', { p_partida: partida.id, p_resultado: resultado, p_juego: juego })
  if (faltaLaRpc(res.error)) {
    // `match_reports` solo se escribe por RPC desde la apertura (tanda
    // 252): el camino viejo de aquí abajo no apuntaba nada y lo hacía EN
    // SILENCIO, con un «Reportado» en verde. Se dice lo que falta.
    showToast(avisoDeMigracion('supabase-migration-torneos-bo3.sql'), 'error')
    return false
  }
  if (res.error) {
    const texto = String(res.error.message || '')
    showToast(texto.length < 120 ? texto : 'No se ha podido reportar.', 'error')
    return false
  }

  const AVISOS = {
    esperando: ['Reportado. Falta que tu rival lo confirme.', 'success'],
    conciliado: ['Resultado confirmado por los dos.', 'success'],
    juego: ['Partida confirmada por los dos. La serie sigue.', 'success'],
    corregido: ['Cambiado. Falta que tu rival lo confirme.', 'success'],
    disputa: ['Los reportes no coinciden: la mesa queda en disputa.', 'error'],
    repetido: ['Ese resultado ya estaba reportado.', 'info'],
  }
  const [texto, tono] = AVISOS[res.data] || ['Reportado.', 'success']
  showToast(texto, tono)
  // Ficha entera: una disputa nueva tiene que asomar también en la cola
  // del juez, que pinta otro módulo.
  await ctx.recargarFicha()
  return true
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
  // Un JUEZ que no lleva el torneo va por su función (tanda 394). Las
  // tablas solo las escribe quien manda (torneos_mando), así que su
  // update de abajo no tocaba nada SIN DAR ERROR y aquí salía «Mesa
  // resuelta» en verde: el resolutor lleva enseñándose a los jueces
  // desde la tanda 207 y no les ha funcionado nunca.
  if (!mando()) {
    const { error } = await supabase.rpc('torneos_resolver_como_juez', { p_partida: partida.id, p_resultado: resultado })
    if (error) {
      showToast(
        faltaLaRpc(error) ? avisoDeMigracion('supabase-migration-torneos-jueces.sql') : error.message || 'No se ha podido resolver la mesa.',
        'error'
      )
      return false
    }
    showToast('Mesa resuelta.', 'success')
    await ctx.recargarFicha()
    return true
  }
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
  if (ronda.status !== 'pending' || !sueltos.length || !mando()) {
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

// ── La barra viva (tanda 298) ──
//
// Mientras se juega, lo único que importa es cuánto queda, contra quién
// juegas y qué falta por hacer. Eso estaba a media pantalla de scroll,
// dentro de «Tu partida», entre cajas del mismo color. Ahora va pegado
// arriba y no se pierde.
//
// Quien solo mira —sin cuenta, o inscrito pero sin mesa— también la ve:
// para él es el marcador de la ronda, sin la parte de «tu partida».
function pintarBarraViva(ronda) {
  const caja = $('torneoBarraViva')
  if (!caja) return
  const yo = miId()
  const mia = yo
    ? partidas.find((m) => m.round_id === ronda.id && (m.player_a_id === yo || m.player_b_id === yo))
    : null
  const fase = ronda.phase === 'top_cut' ? 'Top cut' : 'Ronda suiza'
  const total = ctx.torneo.swiss_rounds || 0
  const rotulo = `${fase} ${ronda.round_number}${ronda.phase === 'top_cut' || !total ? '' : ` de ${total}`}`

  let titular = 'Ronda en marcha'
  let der = ''
  if (mia && mia.status === 'bye') {
    titular = 'Tienes bye esta ronda'
  } else if (mia) {
    const soyA = mia.player_a_id === yo
    const rivalId = soyA ? mia.player_b_id : mia.player_a_id
    titular = `Tu partida contra ${nombreDe(rivalId)}`
    const miListo = soyA ? mia.check_in_a_at : mia.check_in_b_at
    const rivalListo = soyA ? mia.check_in_b_at : mia.check_in_a_at
    // Lo que FALTA, y solo eso: si ya has hecho check-in y tu rival
    // también, la barra no tiene nada que pedirte.
    if (!miListo) der = '<span class="torneo-viva-pide">Te falta el check-in</span>'
    else if (!rivalListo) der = `<span class="torneo-viva-espera">${escapeHtml(nombreDe(rivalId))} aún no ha hecho check-in</span>`
    der += '<a class="btn-primary torneo-viva-boton" href="#torneoMiPartida">Ir a tu mesa</a>'
  }

  // El contador de mesas (tanda 394): «4/7 mesas han terminado», para
  // todo el mundo — también para quien juega, que en cuanto acaba la
  // suya lo único que quiere saber es cuánto falta para la siguiente.
  // Se pone al día solo: la ficha se refresca con cada cambio de una
  // mesa (tiempo real, con el sondeo detrás) y esto se repinta con ella.
  const progreso = progresoDeMesas(partidas.filter((m) => m.round_id === ronda.id))
  if (!mia) titular = progreso.todas ? 'Todas las mesas han terminado' : 'Ronda en marcha'
  const mesasHtml = contadorDeMesasHtml(progreso)

  const html = `${rotulo}|${titular}|${der}|${mesasHtml}`
  caja.classList.remove('hidden')
  // MIENTRAS JUEGAS, LA RONDA PRIMERO (748, J2): la cabecera se queda en el
  // nombre y lo de inscribirse —formato, plazas, calendario— se aparta,
  // para que tu mesa salga en la primera pantalla y no dos más abajo.
  document.documentElement.classList.toggle('torneo-jugando', Boolean(mia && mia.status !== 'bye'))
  if (yaEstaPintado('barraViva', html)) return
  $('torneoVivaRotulo').textContent = rotulo
  $('torneoVivaTitular').textContent = titular
  $('torneoVivaDer').innerHTML = der
  const contador = $('torneoVivaMesas')
  if (contador) {
    contador.innerHTML = mesasHtml
    contador.classList.toggle('hidden', !mesasHtml)
  }
  // El anillo se monta una vez; el tictac solo le cambia la cifra y la
  // vuelta. Repintarlo cada segundo sería rehacer un SVG por segundo.
  const anillo = $('torneoVivaAnillo')
  if (anillo && !anillo.querySelector('b')) anillo.innerHTML = '<b>–:––</b>'
}

// El contador de mesas, el mismo en la barra viva y en la pestaña de
// rondas. La cifra va a la vista y la frase entera para el lector de
// pantalla: «4/7» leído en voz alta es «cuatro barra siete».
function contadorDeMesasHtml({ terminadas, total, todas }) {
  if (!total) return ''
  const parte = Math.round((terminadas / total) * 100)
  return `<span class="torneo-mesas-cuenta${todas ? ' completa' : ''}" aria-hidden="true">
      <span class="torneo-mesas-cifra"><b>${terminadas}</b>/${total}</span>
      <span class="torneo-mesas-rotulo">mesas terminadas</span>
      <span class="torneo-mesas-barra"><span style="--parte: ${parte}%"></span></span>
    </span>
    <span class="sr-only">${terminadas} de ${total} mesas han terminado</span>`
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
    // congelado en la cabecera con el torneo ya cerrado. Y la barra
    // viva (tanda 298) se va con él: una barra vacía pegada arriba
    // ocuparía sitio sin decir nada.
    marcador.classList.add('hidden')
    $('torneoBarraViva')?.classList.add('hidden')
    document.documentElement.classList.remove('torneo-jugando')
    return
  }
  pintarBarraViva(ronda)
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
    const grande = $('cuentaGrande')
    if (grande && textoRonda !== null) {
      grande.textContent = textoRonda
      grande.classList.toggle('agotandose', seAgota)
    }
    const chip = $('cuentaCheckin')
    if (chip) {
      chip.innerHTML = ya < cierreCheckin ? `Check-in: <strong>${textoCuenta(cierreCheckin - ya)}</strong>` : ''
      chip.classList.toggle('hidden', ya >= cierreCheckin)
    }
    // El anillo de la barra viva (tanda 298): el mismo tiempo, pero
    // dibujado. Se vacía según avanza la ronda, así que de un vistazo
    // se sabe si queda mucho sin leer los números.
    const anillo = $('torneoVivaAnillo')
    if (anillo && textoRonda !== null) {
      const total = ronda.started_at && fin ? fin - new Date(ronda.started_at).getTime() : 0
      const queda = total > 0 ? Math.max(0, Math.min(1, (fin - ya) / total)) : 0
      anillo.style.setProperty('--vuelta', String(queda))
      anillo.classList.toggle('agotandose', seAgota)
      const cifra = anillo.querySelector('b')
      if (cifra) cifra.textContent = textoRonda
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
  const puedeResolver = (mando() || ctx.esJuez) && ronda.status === 'active'
  // Corregir (pedido de Ibai, 2026-09-02): el organizador puede CAMBIAR
  // el resultado de una mesa ya cerrada, pero solo en la ÚLTIMA ronda —
  // tocar una anterior dejaría los pareos posteriores apoyados en
  // resultados que ya no cuentan (para eso está deshacerRonda). Solo el
  // admin, no los jueces: pisar un resultado firme es del organizador.
  const esUltima = rondas.length > 0 && ronda.id === rondas[rondas.length - 1].id
  const puedeCorregir = Boolean(mando()) && esUltima && ctx.torneo.status !== 'cancelled'
  const yo = miId()
  const filas = mesas
    .map((m) => {
      const terminal = TERMINALES.has(m.status)
      const esMia = Boolean(yo && (m.player_a_id === yo || m.player_b_id === yo))
      const res = resultadoDe(m.id)
      // Quién ganó, para poner su nombre en negrita: es lo primero que
      // se busca al mirar una mesa cerrada.
      const ganaA = terminal && (res?.winner_id === m.player_a_id || m.status === 'bye' || m.status === 'forfeit_b')
      const ganaB = terminal && res?.winner_id === m.player_b_id
      const lado = (id, gana, listo, derecha) =>
        id
          ? `<span class="torneo-mesa-lado ${gana ? 'gana' : ''} ${derecha ? 'der' : ''}">
              <span class="torneo-mesa-cara" style="background:${colorDeNombre(nombreDe(id))}">${escapeHtml(nombreDe(id).slice(0, 1).toUpperCase())}</span>
              <span class="torneo-mesa-jugador">${escapeHtml(nombreDe(id))}${yo === id ? ' <em>(tú)</em>' : ''}</span>
              ${chapaDe(id)}
              ${listo ? '<span class="torneo-mesa-listo" title="Check-in hecho">✓</span>' : ''}
            </span>`
          : '<span class="torneo-mesa-lado der"><span class="torneo-mesa-bye">BYE</span></span>'
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
          ? `<div class="torneo-disputa-reportes">${reportes
              .filter((r) => r.match_id === m.id)
              .map(
                (r) =>
                  `<span class="torneo-reporte-carta"><strong>${escapeHtml(nombreDe(r.reporter_id))}</strong> reportó ${ETIQUETA_REPORTE[r.result] || r.result} a las ${hora(r.reported_at || r.created_at)}</span>`
              )
              .join('')}</div>`
          : ''
      return `
      <div class="torneo-mesa ${esMia ? 'mia' : ''}">
        <span class="torneo-mesa-num">${m.table_number}</span>
        ${lado(m.player_a_id, ganaA, m.check_in_a_at, false)}
        <span class="torneo-mesa-centro">${chapaDeMesa(m)}</span>
        ${lado(m.player_b_id, ganaB, m.check_in_b_at, true)}
        ${resolver}
        ${enfrentados}
        ${repeticionesDeMesaHtml(m, { enRondas: true })}
      </div>`
    })
    .join('')
  // Se cambia la tabla por una LISTA de enfrentamientos (tanda 298). Una
  // tabla de cuatro columnas obliga a leer las cabeceras para saber qué
  // es cada cosa; aquí la forma lo dice sola: número, uno, resultado,
  // otro. Y en el móvil ya no hace falta convertirla en tarjetas con
  // `data-etiqueta`, porque nunca fue una tabla.
  return `<div class="torneo-mesas">${filas}</div>`
}

// Las inscripciones de cada jornada, para quien lleva la liga (tanda
// 635): cuántos han mandado lista y el botón de cerrarla o reabrirla.
// Cada jornada se cierra por separado: la liga sigue admitiendo listas
// (y gente nueva) para las demás.
function jornadasAdminHtml() {
  if (ctx.torneo.format !== 'league' || !ctx.jornadas || !mando() || ['finished', 'cancelled'].includes(ctx.torneo.status)) return ''
  const activos = ctx.inscripciones.filter((i) => i.status === 'active')
  const fechas = Array.isArray(ctx.torneo.matchday_dates) ? ctx.torneo.matchday_dates : []
  const filas = []
  for (let n = 1; n <= (ctx.torneo.swiss_rounds || 0); n++) {
    if (jornadaEmpezada(ctx.jornadas, n)) continue
    const juegan = quienesJuegan(ctx.jornadas, n) || new Set()
    const con = activos.filter((i) => juegan.has(i.user_id))
    const cerrada = jornadaCerrada(ctx.jornadas, n)
    const fecha = fechas[n - 1] ? ` · ${escapeHtml(fechaCorta(fechas[n - 1]))}` : ''
    filas.push(`<li class="torneo-jornadas-admin-fila">
        <span><strong>Jornada ${n}</strong>${fecha}</span>
        <span class="torneo-chapa ${cerrada ? 'torneo-chapa-neutra' : 'torneo-chapa-exito'}">${cerrada ? 'Cerrada' : 'Abierta'}</span>
        <span class="subtext">${con.length} de ${activos.length} con lista</span>
        <button type="button" class="btn-secondary torneo-jornada-cerrar" data-jornada="${n}" data-cerrar="${cerrada ? 'no' : 'si'}">${cerrada ? 'Reabrir' : 'Cerrar inscripciones'}</button>
      </li>`)
  }
  if (!filas.length) return ''
  return `<div class="torneo-jornadas-admin" id="torneoJornadasAdmin">
      <p class="torneo-jornadas-admin-titulo"><strong>Inscripciones por jornada</strong></p>
      <p class="subtext">Cada jugador juega una jornada mandando su lista para ella. Al cerrar una jornada ya nadie puede mandar ni cambiar su lista de esa jornada; las demás siguen abiertas. Para emparejarla, ciérrala.</p>
      <ul class="torneo-jornadas-admin-lista">${filas.join('')}</ul>
    </div>`
}

// Quién juega la jornada que toca, debajo del botón de emparejarla.
function avisoDeJornada(n) {
  const juegan = quienesJuegan(ctx.jornadas, n)
  if (!juegan) return ''
  const activos = ctx.inscripciones.filter((i) => i.status === 'active')
  const con = activos.filter((i) => juegan.has(i.user_id)).map((i) => escapeHtml(nombreDe(i.user_id)))
  const sin = activos.filter((i) => !juegan.has(i.user_id)).map((i) => escapeHtml(nombreDe(i.user_id)))
  return `<p class="subtext torneo-aviso-jornada">Juegan la jornada ${n} (${con.length}): <strong>${con.join(', ') || 'nadie'}</strong>.${
    sin.length ? ` Sin lista, no la juegan: ${sin.join(', ')}.` : ''
  }</p>`
}

async function alternarJornada(boton) {
  const n = Number(boton.dataset.jornada)
  const cerrar = boton.dataset.cerrar === 'si'
  boton.disabled = true
  const error = await cerrarJornada(ctx.torneo.id, n, cerrar)
  if (error) {
    boton.disabled = false
    showToast(`No se ha podido ${cerrar ? 'cerrar' : 'reabrir'} la jornada ${n}: ${error.message}`, 'error')
    return
  }
  showToast(
    cerrar
      ? `Inscripciones de la jornada ${n} cerradas. Ya puedes emparejarla cuando toque.`
      : `Jornada ${n} reabierta: se pueden volver a mandar listas.`,
    'success'
  )
  await ctx.recargarFicha()
}

function pintarRondas() {
  const caja = $('torneoRondasCaja')
  // Una liga por jornadas se lleva desde aquí desde que abre inscripciones:
  // cada jornada se cierra por separado (tanda 635).
  const ligaPorJornadas = ctx.torneo.format === 'league' && Boolean(ctx.jornadas) && mando() && ctx.torneo.status === 'registration_open'
  const arrancado = ['registration_closed', 'in_progress', 'finished'].includes(ctx.torneo.status) || rondas.length > 0 || ligaPorJornadas
  if (!arrancado) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')

  const actual = rondaActual()
  let admin = ''
  // Lo que va DEBAJO de los botones (tanda 635): quién juega la jornada
  // y las inscripciones de cada una. Fuera de la fila de botones, que es
  // flexible y no es sitio para un párrafo.
  let adminAvisos = ''
  if (mando() && ctx.torneo.status !== 'finished') {
    if (!actual && rondas.length < ctx.torneo.swiss_rounds) {
      const n = rondas.length + 1
      if (ctx.torneo.format === 'league' && ctx.jornadas) {
        if (jornadaCerrada(ctx.jornadas, n)) {
          admin = `<button class="btn-primary" id="btnGenerarPareos">Generar pareos de la jornada ${n}</button>`
          adminAvisos = avisoDeJornada(n)
        } else {
          adminAvisos = `<p class="subtext torneo-aviso-jornada">Para emparejar la jornada ${n}, cierra antes sus inscripciones.</p>`
        }
      } else {
        admin = `<button class="btn-primary" id="btnGenerarPareos">Generar pareos de la ${ctx.torneo.format === 'league' ? 'jornada' : 'ronda'} ${n}</button>`
      }
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
  // El reloj GIGANTE de esta pestaña se va (tanda 298). Con la barra
  // viva pegada arriba, que ya lleva el anillo, aquí había tres relojes
  // a la vez diciendo lo mismo. El que queda es el de la línea de
  // tiempo, dentro del paso que se está jugando — que además dice DÓNDE
  // está ese tiempo, cosa que un número suelto no hacía.
  //
  // La LÍNEA DE TIEMPO del torneo (tanda 298): un paso por ronda
  // prevista, más el top cut si lo hay. De un vistazo se ve por dónde va
  // todo, no solo el número de la ronda de turno — que es lo único que
  // decía la línea de texto de antes.
  // Un paso de la línea. Una ronda viva CON límite enseña su cuenta
  // atrás; una sin límite (el top cut se juega a acabar) lo dice.
  const pasoDe = (rotulo, r) => ({
    rotulo,
    estado: !r ? 'Por jugar' : r.status === 'active' ? (r.ends_at ? '–:––' : 'Sin límite') : r.status === 'finished' ? 'Terminada' : 'Pareada',
    clase: !r ? '' : r.status === 'active' ? 'viva' : r.status === 'finished' ? 'fin' : 'lista',
    reloj: Boolean(r && r.status === 'active' && r.ends_at),
  })
  const previstas = ctx.torneo.swiss_rounds || 0
  const pasos = []
  for (let n = 1; n <= previstas; n++) {
    pasos.push(pasoDe(`Ronda ${n}`, rondas.find((x) => x.phase !== 'top_cut' && x.round_number === n)))
  }
  for (const r of rondas.filter((x) => x.phase === 'top_cut')) pasos.push(pasoDe(`Top cut R${r.round_number}`, r))
  if (ctx.torneo.top_cut_size && !rondas.some((r) => r.phase === 'top_cut')) {
    pasos.push({ rotulo: `Top ${ctx.torneo.top_cut_size}`, estado: 'Por jugar', clase: '' })
  }
  const linea = pasos.length
    ? `<div class="torneo-linea">${pasos
        .map(
          (p) =>
            `<div class="torneo-paso ${p.clase}"><span class="torneo-paso-r">${escapeHtml(p.rotulo)}</span>` +
            // El paso que se juega lleva el RELOJ dentro: lo rellena el
            // tictac de arrancarReloj, igual que hacía el reloj gigante.
            `<span class="torneo-paso-e"${p.reloj ? ' id="cuentaGrande" role="timer" aria-label="Tiempo restante de la ronda"' : ''}>${escapeHtml(p.estado)}</span></div>`
        )
        .join('')}</div>
      <span class="torneo-cuenta-checkin hidden" id="cuentaCheckin"></span>`
    : ''
  // Esta caja es la cabecera del panel de rondas: el reloj grande, el
  // aviso de check-in y los botones del organizador. Rehacerla en cada
  // refresco movía TODO lo que hay debajo — «Tu partida» incluida — y es
  // media explicación de los clics perdidos (tanda 259).
  const htmlRondas = `
    ${linea}
    <div class="torneo-rondas-cabecera">
      <span class="torneo-rondas-botones">${admin}<button class="btn-secondary" id="btnActualizarCiclo">Actualizar</button></span>
    </div>${adminAvisos}${jornadasAdminHtml()}`
  if (!pintarSiCambia($('rondasAdmin'), htmlRondas)) return pintarRondasResto(actual)
  // Actualizar refresca la ficha ENTERA (ciclo, chats y cola de jueces):
  // es el botón de «a ver si mi rival ya ha hecho algo».
  $('btnActualizarCiclo').addEventListener('click', () => ctx.recargarFicha())
  if ($('btnGenerarPareos')) $('btnGenerarPareos').addEventListener('click', generarPareos)
  $('torneoJornadasAdmin')?.addEventListener('click', (e) => {
    const boton = e.target.closest('.torneo-jornada-cerrar')
    if (boton) void alternarJornada(boton)
  })
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

  pintarRondasResto(actual)
}

// Lo que va DEBAJO de la cabecera de rondas. Vive aparte para poder
// pintarlo aunque la cabecera no haya cambiado (ver pintarRondas).
function pintarRondasResto(actual) {
  const caja = $('torneoRondasCaja')
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
  // Igual que «Tu partida»: la tabla de mesas se vuelve a montar con cada
  // evento en vivo del torneo, y ahí dentro están los botones del juez.
  // Si sale el mismo HTML, no se toca (y así los escuchas de abajo tampoco
  // hacen falta: sus botones siguen siendo los mismos nodos de antes).
  // Con la ronda en juego, el contador de mesas va al lado del título
  // (tanda 394): es la pestaña a la que mira el organizador para saber
  // si ya puede cerrar.
  const contador =
    paraMesas?.status === 'active' ? contadorDeMesasHtml(progresoDeMesas(partidas.filter((m) => m.round_id === paraMesas.id))) : ''
  const htmlMesas = paraMesas
    ? `<div class="torneo-mesas-cabecera"><h4 class="torneo-mesas-titulo">${paraMesas.phase === 'top_cut' ? 'Top cut — mesas' : `Mesas de la ronda ${paraMesas.round_number}`}${paraMesas.status === 'finished' ? ' (cerrada)' : ''}</h4>${contador ? `<div class="torneo-mesas-progreso">${contador}</div>` : ''}</div>${pestanas}${pintarMesas(paraMesas)}`
    : ''
  // El reloj se rearma SIEMPRE, antes de la guarda: se apaga y se vuelve
  // a poner en cada pasada, y saltárselo lo dejaría parado.
  arrancarReloj(actual)
  if (yaEstaPintado('mesas', htmlMesas)) return
  $('mesasContenido').innerHTML = htmlMesas
  document.querySelectorAll('[data-ver-ronda]').forEach((b) =>
    b.addEventListener('click', () => {
      rondaVista = b.dataset.verRonda
      pintarRondas()
    })
  )

  engancharRepeticiones($('mesasContenido'))
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
      // Si no se pudo (un juez sin la migración, o la base dijo que no),
      // el desplegable vuelve a «Resolver…»: dejarlo con la opción
      // elegida haría creer que la mesa está resuelta.
      void resolverPartida(partida, sel.value).then((ok) => {
        if (ok === false) sel.value = ''
      })
    })
  })
  void rellenarChapasArquetipo(caja)
}

// ── Quién se lleva cada premio (tanda 516) ──
//
// Los premios que apuntó quien organiza (tanda 352), cruzados con la
// clasificación FINAL —con corte, manda el corte—: cada premio con quién
// se lo lleva. Y quien lleva el torneo apunta a quién se lo ha dado ya, que
// es lo que pregunta el que ganó y lo que se olvida en un torneo de treinta.
async function cargarEntregas() {
  const { data, error } = await supabase.from('tournament_prize_deliveries').select('user_id,delivered_at').eq('tournament_id', ctx.torneo.id)
  entregasPremios = error ? null : new Map((data || []).map((f) => [f.user_id, f.delivered_at]))
}

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

function repartoDePremiosHtml() {
  if (ctx.torneo.status !== 'finished') return ''
  const premios = premiosDeTorneo(ctx.torneo)
  if (!premios.length) return ''
  const reparto = quienSeLleva(premios, clasificacionFinal().map((e) => e.playerId))
  const lleva = mando()
  const persona = (id) => {
    const dado = entregasPremios?.get(id)
    let estado = ''
    if (entregasPremios && dado) {
      estado = `<span class="torneo-premio-dado">${icons.checkCircle(14)} Dado el ${fechaCorta(dado)}</span>${
        lleva ? ` <button type="button" class="link-btn" data-premio-dado="${escapeHtml(id)}" data-si="0">Deshacer</button>` : ''
      }`
    } else if (entregasPremios && lleva) {
      estado = `<button type="button" class="link-btn" data-premio-dado="${escapeHtml(id)}" data-si="1">Marcar como dado</button>`
    } else if (entregasPremios) {
      estado = '<span class="subtext">Pendiente</span>'
    }
    return `<li class="${id === miId() ? 'torneo-fila-yo' : ''}"><span>${escapeHtml(nombreDe(id))}</span> ${estado}</li>`
  }
  const filas = reparto
    .map((p) => {
      let quienes
      if (!p.jugadores) quienes = '<p class="subtext">Lo reparte quien organiza: no sale de la clasificación.</p>'
      else if (p.todos) quienes = `<p class="subtext">Para los ${p.jugadores.length} participantes.</p>`
      else if (!p.jugadores.length) quienes = '<p class="subtext">Nadie llegó a ese puesto.</p>'
      else quienes = `<ul class="torneo-reparto-quien">${p.jugadores.map(persona).join('')}</ul>`
      return `<li class="torneo-reparto-premio">
          <div><span class="torneo-premio-puesto">${escapeHtml(p.puesto)}</span> <span class="torneo-premio-que">${escapeHtml(p.premio)}</span></div>
          ${quienes}
        </li>`
    })
    .join('')
  const falta = entregasPremios === null && lleva ? `<p class="subtext">${escapeHtml(avisoDeMigracion('supabase-migration-torneos-premios-entrega.sql'))}</p>` : ''
  return `<section class="torneo-reparto" aria-labelledby="torneoRepartoTitulo">
      <h3 class="torneo-mesas-titulo" id="torneoRepartoTitulo">${icons.trophy(16)} Quién se lleva cada premio</h3>
      <ul class="torneo-reparto-lista">${filas}</ul>
      <p class="subtext">Los premios los da quien organiza el torneo. PokeDoc no cobra ni paga nada.</p>
      ${falta}
    </section>`
}

async function marcarPremioDado(boton) {
  boton.disabled = true
  const { error } = await supabase.rpc('torneos_premio_entregado', { p_torneo: ctx.torneo.id, p_usuario: boton.dataset.premioDado, p_entregado: boton.dataset.si === '1' })
  if (error) {
    showToast(faltaLaRpc(error) ? avisoDeMigracion('supabase-migration-torneos-premios-entrega.sql') : error.message || 'No se ha podido apuntar.', 'error')
    boton.disabled = false
    return
  }
  await cargarEntregas()
  pintarClasificacion()
}

// ── La repetición de una partida (tanda 496) ──
//
// Un jugador adjunta la repetición de SU partida, guardada antes en
// /repeticiones (hasta tres: un BO3). La ven los dos jugadores, quien lleva
// el torneo y sus jueces, y para ellos es lo que pasó de verdad cuando los
// reportes no casan. Quién la ve lo decide la base, no este `if`.
const sinMayusculas = (x) => String(x || '').trim().toLowerCase()

// `enRondas`: la tabla de «Rondas», que es donde un juez añade la de mesa
// (en «Tu partida» solo se enlaza: el mismo formulario dos veces en la
// página serían dos campos con el mismo id).
function repeticionesDeMesaHtml(m, { enRondas = false } = {}) {
  const yo = miId()
  const esMia = Boolean(yo && (m.player_a_id === yo || m.player_b_id === yo))
  const todas = repeticionesMesas.filter((r) => r.match_id === m.id)
  const reps = todas.filter((r) => !r.publica)
  // Una mesa pendiente o un bye no tienen partida que ver.
  const hayPartida = m.status !== 'pending' && m.status !== 'bye' && m.player_a_id && m.player_b_id
  const mias = reps.filter((r) => r.user_id === yo).length
  const puedeAdjuntar = esMia && hayPartida && mias < 3
  const deMesa = deMesaHtml(m, todas.filter((r) => r.publica), hayPartida && enRondas)
  if (!reps.length && !puedeAdjuntar) return deMesa
  const enlaces = reps.map((r) => {
    const delMismo = reps.filter((x) => x.user_id === r.user_id)
    const n = delMismo.length > 1 ? ` (${delMismo.indexOf(r) + 1})` : ''
    const texto = r.user_id === yo ? `Tu repetición${n}` : `Repetición de ${nombreDe(r.user_id)}${n}`
    return `<span class="torneo-rep"><a href="/repeticiones?r=${encodeURIComponent(r.replay_id)}">${ICONOS_REPETICION.reproducir(14)} ${escapeHtml(texto)}</a>${
      r.user_id === yo ? ` <button type="button" class="link-btn" data-quitar-rep="${m.id}" data-rep="${escapeHtml(r.replay_id)}">Quitar</button>` : ''
    }</span>`
  })
  const adjuntar = puedeAdjuntar
    ? `<button type="button" class="link-btn" data-adjuntar-rep="${m.id}">${mias ? 'Adjuntar otra repetición' : 'Adjuntar la repetición'}</button>`
    : ''
  return `${deMesa}<div class="torneo-mesa-reps">${enlaces.join('')}${adjuntar}</div>`
}

// ── La repetición DE MESA (tanda 555) ──
//
// La añade un juez —o quien lleva el torneo— con el registro que le pasa
// un jugador, y la ve todo el mundo en «Rondas». No es obligatoria: una
// mesa puede tener una, hasta tres (un BO3), o ninguna. El formulario vive
// fuera del DOM por lo mismo que el registro de «Tu partida»: la tabla de
// mesas se repinta con cada evento del torneo, y lo pegado no se pierde.
let formDeMesa = null // { matchId, texto, aviso }

function deMesaHtml(m, publicas, hayPartida) {
  const juez = Boolean(mando() || ctx.esJuez)
  const puedeAnadir = juez && hayPartida && publicas.length < 3 && !repeticionesMesas.sinDeMesa
  const enlaces = publicas.map(
    (r, k) =>
      `<span class="torneo-rep torneo-rep-mesa"><a href="/repeticiones?r=${encodeURIComponent(r.replay_id)}">${ICONOS_REPETICION.reproducir(14)} ${publicas.length > 1 ? `Repetición de la mesa (${k + 1})` : 'Repetición de la mesa'}</a>${
        juez ? ` <button type="button" class="link-btn" data-quitar-de-mesa="${m.id}" data-rep="${escapeHtml(r.replay_id)}">Quitar</button>` : ''
      }</span>`
  )
  let formulario = ''
  if (puedeAnadir && formDeMesa?.matchId === m.id) {
    formulario = `<div class="torneo-rep-form">
        <label class="sr-only" for="torneoDeMesaTexto">Registro de TCG Live de la mesa ${m.table_number}</label>
        <textarea id="torneoDeMesaTexto" class="torneo-registro-texto" rows="4" spellcheck="false" placeholder="Pega aquí el registro de TCG Live que te ha pasado un jugador de la mesa ${m.table_number}…"></textarea>
        ${formDeMesa.aviso ? `<p class="torneo-rep-aviso" role="alert">${escapeHtml(formDeMesa.aviso)}</p>` : ''}
        <div class="torneo-rep-form-botones">
          <button type="button" class="btn-primary" data-guardar-de-mesa="${m.id}">${formDeMesa.aviso ? 'Añadirla igual' : 'Añadir a la mesa'}</button>
          <button type="button" class="link-btn" data-cancelar-de-mesa>Cancelar</button>
        </div>
        <p class="subtext">La verá todo el mundo en «Rondas», con la mesa.</p>
      </div>`
  } else if (puedeAnadir) {
    formulario = `<button type="button" class="link-btn" data-anadir-de-mesa="${m.id}">${publicas.length ? 'Añadir otra repetición de la mesa' : 'Añadir la repetición de la mesa'}</button>`
  }
  if (!enlaces.length && !formulario) return ''
  return `<div class="torneo-mesa-reps torneo-mesa-reps-publicas">${enlaces.join('')}${formulario}</div>`
}

async function guardarDeMesa(boton) {
  const m = partidas.find((x) => x.id === boton.dataset.guardarDeMesa)
  const texto = document.getElementById('torneoDeMesaTexto')?.value || formDeMesa?.texto || ''
  if (!m || !texto.trim()) return showToast('Pega primero el registro de la partida.', 'error')
  formDeMesa = { ...formDeMesa, texto }
  boton.disabled = true
  try {
    const { leerRegistro } = await import('../repeticiones/registro.js')
    const lectura = leerRegistro(texto)
    if (lectura.error) throw new Error(lectura.error)
    // ¿Es la partida de ESTA mesa? Los nombres del registro contra los de
    // TCG Live de la inscripción. Si no casan, se avisa una vez: puede ser
    // que alguien se inscribiera sin poner su nombre de TCG Live.
    const deLaMesa = [m.player_a_id, m.player_b_id].map((id) => String(ctx.inscripciones.find((i) => i.user_id === id)?.tcg_live_username || '').trim())
    const casan = lectura.jugadores.slice(0, 2).every((j) => deLaMesa.some((x) => sinMayusculas(x) === sinMayusculas(j)))
    if (!casan && !formDeMesa.aviso) {
      formDeMesa = {
        ...formDeMesa,
        aviso: `Los jugadores del registro (${lectura.jugadores.slice(0, 2).join(' y ')}) no son los nombres de TCG Live de esta mesa (${deLaMesa.map((x) => x || 'sin nombre de TCG Live').join(' y ')}). ¿Es la partida de la mesa ${m.table_number}?`,
      }
      boton.disabled = false
      pintarRondas()
      return
    }
    const ronda = rondas.find((r) => r.id === m.round_id)
    const yaHay = repeticionesMesas.filter((r) => r.match_id === m.id && r.publica).length
    const titulo = [ctx.torneo.name, ronda ? `Ronda ${ronda.round_number}` : '', `Mesa ${m.table_number}`, yaHay ? `${yaHay + 1}.ª partida` : '']
      .filter(Boolean)
      .join(' · ')
      .slice(0, 120)
    const fin = finDelRegistro(lectura)
    const fila = await guardarRepeticion({
      registro: texto,
      titulo,
      jugadores: lectura.jugadores.slice(0, 2),
      ganador: fin?.ganador || null,
      turnos: lectura.eventos.filter((e) => e.tipo === 'turno').length,
      compartida: true,
    })
    await adjuntarDeMesa(m.id, fila.id)
    formDeMesa = null
    showToast(`Repetición añadida a la mesa ${m.table_number}: la ve todo el mundo en «Rondas».`, 'success')
    await ctx.recargarFicha()
  } catch (err) {
    showToast(err.message || 'No se ha podido añadir.', 'error')
    boton.disabled = false
  }
}

async function quitarDeLaMesa(boton) {
  boton.disabled = true
  try {
    await quitarDeMesa(boton.dataset.quitarDeMesa, boton.dataset.rep)
    showToast('Quitada de la mesa. La repetición sigue en tus repeticiones.', 'success')
    await ctx.recargarFicha()
  } catch (err) {
    showToast(err.message, 'error')
    boton.disabled = false
  }
}

function engancharRepeticiones(caja) {
  caja.querySelectorAll('[data-adjuntar-rep]').forEach((b) => b.addEventListener('click', () => elegirRepeticion(b)))
  caja.querySelectorAll('[data-quitar-rep]').forEach((b) => b.addEventListener('click', () => quitarRepeticion(b)))
  // Las de mesa (tanda 555).
  caja.querySelectorAll('[data-anadir-de-mesa]').forEach((b) =>
    b.addEventListener('click', () => {
      formDeMesa = { matchId: b.dataset.anadirDeMesa, texto: '', aviso: '' }
      pintarRondas()
      document.getElementById('torneoDeMesaTexto')?.focus()
    })
  )
  caja.querySelectorAll('[data-cancelar-de-mesa]').forEach((b) =>
    b.addEventListener('click', () => {
      formDeMesa = null
      pintarRondas()
    })
  )
  caja.querySelectorAll('[data-guardar-de-mesa]').forEach((b) => b.addEventListener('click', () => guardarDeMesa(b)))
  caja.querySelectorAll('[data-quitar-de-mesa]').forEach((b) => b.addEventListener('click', () => quitarDeLaMesa(b)))
  // Lo pegado se guarda fuera del DOM (y vuelve a su sitio si la tabla se
  // repinta: el HTML no lo lleva, para no repintar en cada tecla).
  const area = caja.querySelector('#torneoDeMesaTexto')
  if (area && formDeMesa) {
    area.value = formDeMesa.texto || ''
    area.addEventListener('input', () => {
      formDeMesa.texto = area.value
      // Otro registro: el aviso de antes ya no es de este.
      if (formDeMesa.aviso) {
        formDeMesa.aviso = ''
        caja.querySelector('.torneo-rep-aviso')?.remove()
        const b = caja.querySelector('[data-guardar-de-mesa]')
        if (b) b.textContent = 'Añadir a la mesa'
        // El DOM ya no es el HTML de la última pasada: sin olvidar su
        // firma, el mismo aviso otra vez se creería pintado y no saldría.
        olvidarPintado('mesas')
      }
    })
  }
}

// El botón se vuelve un desplegable con TUS repeticiones guardadas, las
// que se jugaron contra tu rival (por su nombre de TCG Live) primero.
async function elegirRepeticion(boton) {
  const matchId = boton.dataset.adjuntarRep
  const m = partidas.find((x) => x.id === matchId)
  if (!m) return
  boton.disabled = true
  let guardadas
  try {
    guardadas = await misRepeticiones(miId())
  } catch (err) {
    showToast(err.message, 'error')
    boton.disabled = false
    return
  }
  const yaPuestas = new Set(repeticionesMesas.filter((r) => r.match_id === matchId).map((r) => r.replay_id))
  const rivalId = m.player_a_id === miId() ? m.player_b_id : m.player_a_id
  const tcgRival = sinMayusculas(ctx.inscripciones.find((i) => i.user_id === rivalId)?.tcg_live_username)
  const contraRival = (r) => Boolean(tcgRival) && [r.jugador_a, r.jugador_b].some((j) => sinMayusculas(j) === tcgRival)
  // `sort` es estable: dentro de cada grupo sigue el orden de la base, de
  // la más nueva a la más vieja.
  const lista = guardadas.filter((r) => !yaPuestas.has(r.id)).sort((a, b) => contraRival(b) - contraRival(a))
  if (!lista.length) {
    const aviso = document.createElement('span')
    aviso.className = 'subtext'
    aviso.innerHTML = 'No tienes ninguna repetición guardada que adjuntar. <a href="/repeticiones">Guarda la de esta partida</a> y vuelve.'
    boton.replaceWith(aviso)
    return
  }
  const sel = document.createElement('select')
  sel.className = 'torneo-rep-elegir'
  sel.setAttribute('aria-label', 'Elige la repetición de esta partida')
  sel.innerHTML = `<option value="">Elige una de tus repeticiones…</option>${lista
    .map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.titulo)}${contraRival(r) ? ' — contra tu rival' : ''}</option>`)
    .join('')}`
  boton.replaceWith(sel)
  sel.focus()
  sel.addEventListener('change', async () => {
    if (!sel.value) return
    sel.disabled = true
    try {
      await adjuntarATorneo(matchId, sel.value)
      showToast('Adjuntada. La ven tu rival y quien lleva o arbitra el torneo, y queda compartida: la abre cualquiera con su enlace.', 'success')
      await ctx.recargarFicha()
    } catch (err) {
      showToast(err.message, 'error')
      sel.disabled = false
    }
  })
}

async function quitarRepeticion(boton) {
  boton.disabled = true
  try {
    await quitarDeTorneo(boton.dataset.quitarRep, boton.dataset.rep)
    showToast('Quitada de la mesa. Sigue en «Tus repeticiones».', 'success')
    await ctx.recargarFicha()
  } catch (err) {
    showToast(err.message, 'error')
    boton.disabled = false
  }
}

// ── Reportar con el registro de TCG Live (tanda 512) ──
//
// Al acabar, TCG Live ya sabe quién ganó: lo dice la última línea del
// registro. Pegarlo aquí sirve para dos cosas a la vez: proponer el
// resultado (que confirmas TÚ: el botón no se pulsa solo) y dejar la
// repetición adjunta a la mesa, que es lo que mira un juez si los reportes
// no casan. Quién eras en el registro sale de tu nombre de TCG Live en la
// inscripción; si no casa, se pregunta.
//
// El estado vive fuera del DOM porque «Tu partida» se repinta entera cuando
// cambia algo (el rival hace check-in, reporta…), y perder el registro
// pegado a mitad de leerlo sería tirar el trabajo de alguien.
let registroMesa = null // { matchId, texto, abierto, lectura, yo, adjuntar }

// El ganador del «fin» es siempre uno de los dos: el lector solo reconoce
// la frase con uno de sus nombres dentro (registro.js).
const finDelRegistro = (lectura) => lectura?.eventos?.findLast((e) => e.tipo === 'fin') || null

// Qué partida se reportaría: la única abierta (en un BO3, la siguiente sin
// jugar) y solo si no la has reportado ya. null = nada que reportar.
function juegoPorReportar(mia, bo) {
  if (bo !== 3) {
    const ya = reportes.some((r) => r.match_id === mia.id && r.reporter_id === miId() && (r.game_number ?? 0) === 0)
    return ya ? null : 0
  }
  const { mios, confirmados } = juegosDeMesa(mia)
  const n = serieBo3(confirmados).siguiente
  return n && juegoAbierto(confirmados, n) && !mios[n] ? n : null
}

const puedoAdjuntarA = (m) => repeticionesMesas.filter((r) => r.match_id === m.id && r.user_id === miId()).length < 3

function registroHtml(juego, adjuntable) {
  if (juego === null && !adjuntable) return ''
  const titulo = juego === null ? 'Adjuntar el registro de TCG Live' : 'Reportar con el registro de TCG Live'
  return `<details class="torneo-registro" id="torneoRegistro">
      <summary>${titulo}</summary>
      <p class="subtext">Copia el registro de la partida en TCG Live y pégalo aquí. Lo leemos en tu navegador y te decimos quién ganó según el registro; el resultado lo confirmas tú.</p>
      <label class="sr-only" for="torneoRegistroTexto">Registro de la partida</label>
      <textarea id="torneoRegistroTexto" class="torneo-registro-texto" rows="4" spellcheck="false" placeholder="Pega aquí el registro de la partida…"></textarea>
      <button type="button" class="btn-secondary torneo-registro-leer" data-leer-registro>Leer el registro</button>
      <div class="torneo-registro-veredicto" id="torneoRegistroVeredicto" role="status"></div>
    </details>`
}

// Quién eras tú en el registro: tu nombre de TCG Live; si no está, el que
// NO es tu rival. Si no casa ninguno de los dos, null y se pregunta.
function quienEresEnElRegistro(lectura, mia) {
  if (registroMesa?.yo && lectura.jugadores.includes(registroMesa.yo)) return registroMesa.yo
  const tcgDe = (id) => sinMayusculas(ctx.inscripciones.find((i) => i.user_id === id)?.tcg_live_username)
  const rivalId = mia.player_a_id === miId() ? mia.player_b_id : mia.player_a_id
  const [mio, suyo] = [tcgDe(miId()), tcgDe(rivalId)]
  const yo = mio && lectura.jugadores.find((j) => sinMayusculas(j) === mio)
  if (yo) return yo
  const el = suyo && lectura.jugadores.find((j) => sinMayusculas(j) === suyo)
  return el ? lectura.jugadores.find((j) => j !== el) : null
}

function veredictoHtml(mia, juego, adjuntable, bo) {
  const lectura = registroMesa?.lectura
  if (!lectura) return ''
  if (lectura.error) return `<p class="torneo-registro-aviso">${escapeHtml(lectura.error)}</p>`
  const [a, b] = lectura.jugadores
  const yo = quienEresEnElRegistro(lectura, mia)
  if (!yo) {
    const mio = ctx.inscripciones.find((i) => i.user_id === miId())?.tcg_live_username
    const porque = mio
      ? `ninguno es «${escapeHtml(mio)}», el nombre de TCG Live de tu inscripción`
      : 'tu inscripción no tiene nombre de TCG Live para saberlo'
    return `<p>En el registro juegan <strong>${escapeHtml(a)}</strong> y <strong>${escapeHtml(b)}</strong>, y ${porque}. ¿Cuál de los dos eras tú?</p>
      <div class="torneo-registro-botones">
        <button type="button" class="btn-outline" data-registro-yo="${escapeHtml(a)}">${escapeHtml(a)}</button>
        <button type="button" class="btn-outline" data-registro-yo="${escapeHtml(b)}">${escapeHtml(b)}</button>
      </div>`
  }
  const rivalEnLog = yo === a ? b : a
  const rivalId = mia.player_a_id === miId() ? mia.player_b_id : mia.player_a_id
  const suTcg = ctx.inscripciones.find((i) => i.user_id === rivalId)?.tcg_live_username
  // No bloquea —puede haberse cambiado el nombre—, pero lo dice: es la
  // forma de pegar por error el registro de OTRA partida.
  const otraMesa =
    suTcg && sinMayusculas(suTcg) !== sinMayusculas(rivalEnLog)
      ? `<p class="torneo-registro-aviso">Ojo: tu rival en esta mesa es «${escapeHtml(suTcg)}» en TCG Live, y en el registro juegas contra «${escapeHtml(rivalEnLog)}». ¿Es el registro de esta partida?</p>`
      : ''
  const fin = finDelRegistro(lectura)
  const turnos = lectura.eventos.filter((e) => e.tipo === 'turno').length
  const enTurnos = turnos ? `, en ${turnos} ${turnos === 1 ? 'turno' : 'turnos'}` : ''
  const como = { premios: ' por premios', rendicion: ' por rendición' }[fin?.porque] || ''
  const gane = fin?.ganador === yo
  const frase = fin
    ? `<p>Según el registro, <strong>${gane ? 'ganaste tú' : 'ganó tu rival'}</strong>${como}${enTurnos}. En el registro eras <strong>${escapeHtml(yo)}</strong>${
        registroMesa.yo ? '' : ` <button type="button" class="link-btn" data-registro-yo="${escapeHtml(rivalEnLog)}">No, era ${escapeHtml(rivalEnLog)}</button>`
      }.</p>`
    : `<p class="torneo-registro-aviso">El registro no dice quién ganó: ¿está entero? ${juego === null ? '' : 'El resultado márcalo con los botones de arriba; '}la repetición sí se puede adjuntar.</p>`
  const reporta = fin && juego !== null
  if (!reporta && !adjuntable) return `${otraMesa}${frase}`
  const casilla =
    adjuntable && reporta
      ? `<label class="torneo-registro-casilla"><input type="checkbox" id="torneoRegistroAdjuntar"${registroMesa.adjuntar ? ' checked' : ''}> Guardar la repetición y adjuntarla a la mesa</label>`
      : ''
  const etiqueta = reporta
    ? `Reportar ${gane ? 'Victoria' : 'Derrota'}${bo === 3 ? ` en la ${juego}.ª partida` : ''}`
    : 'Guardar y adjuntar la repetición'
  const quienLaVe = adjuntable
    ? '<p class="subtext">Una vez adjunta, la ven tu rival y quien lleva o arbitra el torneo, y queda compartida: la abre cualquiera con su enlace.</p>'
    : ''
  return `${otraMesa}${frase}${casilla}${quienLaVe}
    <button type="button" class="btn-primary torneo-registro-confirmar" data-registro-confirmar>${etiqueta}</button>`
}

function engancharRegistro(caja, mia, juego, adjuntable, bo) {
  const det = caja.querySelector('#torneoRegistro')
  if (!det) return
  if (registroMesa?.matchId !== mia.id) registroMesa = { matchId: mia.id, texto: '', abierto: false, lectura: null, yo: null, adjuntar: true }
  const area = det.querySelector('#torneoRegistroTexto')
  const veredicto = det.querySelector('#torneoRegistroVeredicto')
  const repintar = () => {
    veredicto.innerHTML = veredictoHtml(mia, juego, adjuntable, bo)
  }
  det.open = registroMesa.abierto
  area.value = registroMesa.texto
  repintar()
  det.addEventListener('toggle', () => {
    registroMesa.abierto = det.open
  })
  area.addEventListener('input', () => {
    registroMesa.texto = area.value
    // Lo leído era de OTRO texto: proponer su resultado sería mentir.
    if (registroMesa.lectura) {
      registroMesa.lectura = null
      registroMesa.yo = null
      repintar()
    }
  })
  det.querySelector('[data-leer-registro]').addEventListener('click', async (ev) => {
    const boton = ev.currentTarget
    if (!area.value.trim()) {
      area.focus()
      return
    }
    boton.disabled = true
    try {
      // Bajo demanda: el lector de registros no lo necesita quien solo mira.
      const { leerRegistro } = await import('../repeticiones/registro.js')
      registroMesa.texto = area.value
      registroMesa.lectura = leerRegistro(area.value)
      registroMesa.yo = null
      repintar()
    } catch (err) {
      showToast(err.message || 'No se ha podido leer el registro.', 'error')
    } finally {
      boton.disabled = false
    }
  })
  veredicto.addEventListener('change', (ev) => {
    if (ev.target.id === 'torneoRegistroAdjuntar') registroMesa.adjuntar = ev.target.checked
  })
  veredicto.addEventListener('click', (ev) => {
    const yo = ev.target.closest('[data-registro-yo]')
    if (yo) {
      registroMesa.yo = yo.dataset.registroYo
      repintar()
      return
    }
    const ok = ev.target.closest('[data-registro-confirmar]')
    if (ok) void confirmarRegistro(mia, juego, adjuntable, ok)
  })
}

async function confirmarRegistro(mia, juego, adjuntable, boton) {
  const { lectura, texto } = registroMesa
  const yo = quienEresEnElRegistro(lectura, mia)
  const fin = finDelRegistro(lectura)
  const reporta = Boolean(fin && yo && juego !== null)
  const adjuntar = adjuntable && (!reporta || registroMesa.adjuntar)
  boton.disabled = true
  // Primero la repetición y luego el reporte: si los reportes no casan, la
  // mesa entra en disputa, y es justo entonces cuando el juez la necesita
  // puesta. Si adjuntar falla, el reporte sigue: es lo que se vino a hacer.
  let fallo = null
  if (adjuntar) {
    try {
      const actual = rondas.find((r) => r.id === mia.round_id)
      const titulo = [ctx.torneo.name, actual ? `Ronda ${actual.round_number}` : '', `Mesa ${mia.table_number}`, juego ? `${juego}.ª partida` : '']
        .filter(Boolean)
        .join(' · ')
        .slice(0, 120)
      const fila = await guardarRepeticion({
        registro: texto,
        titulo,
        jugadores: lectura.jugadores.slice(0, 2),
        ganador: fin?.ganador || null,
        turnos: lectura.eventos.filter((e) => e.tipo === 'turno').length,
      })
      await adjuntarATorneo(mia.id, fila.id)
    } catch (err) {
      fallo = err.message || 'No se ha podido adjuntar.'
    }
  }
  if (fallo && !reporta) {
    showToast(fallo, 'error')
    boton.disabled = false
    return
  }
  // Se suelta ANTES de reportar porque reportar repinta la ficha, y lo
  // repintado tiene que nacer vacío; si el reporte no entra, se recupera.
  const pegado = registroMesa
  registroMesa = null
  if (reporta) {
    if (!(await reportar(mia, fin.ganador === yo ? 'win' : 'loss', juego))) {
      registroMesa = pegado
      boton.disabled = false
    }
  } else {
    showToast('Adjuntada a la mesa.', 'success')
    await ctx.recargarFicha()
  }
  if (fallo) showToast(`El resultado va, pero la repetición no se ha adjuntado: ${fallo}`, 'error')
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
    olvidarPintado('miPartida')
    return
  }
  caja.classList.remove('hidden')

  const soyA = mia.player_a_id === miId()
  const rivalId = soyA ? mia.player_b_id : mia.player_a_id
  const rival = rivalId ? ctx.inscripciones.find((i) => i.user_id === rivalId) : null
  const miListo = soyA ? mia.check_in_a_at : mia.check_in_b_at
  const contenido = $('miPartidaContenido')

  if (mia.status === 'bye') {
    const html = '<p class="torneo-partida-nota">Tienes <strong>bye</strong> esta ronda: 3 puntos y a descansar.</p>'
    if (!yaEstaPintado('miPartida', html)) contenido.innerHTML = html
    return
  }
  if (TERMINALES.has(mia.status)) {
    const r = resultadoDe(mia.id)
    const texto =
      r?.winner_id === miId() ? '¡Ganaste esta ronda!' : r?.result === 'draw' ? 'Empate.' : 'Esta ronda no cayó de tu lado.'
    const html = `<p class="torneo-partida-nota">Mesa ${mia.table_number} — ${texto}</p>${repeticionesDeMesaHtml(mia)}`
    if (!yaEstaPintado('miPartida', html)) {
      contenido.innerHTML = html
      engancharRepeticiones(contenido)
    }
    return
  }
  if (mia.status === 'disputed') {
    // Con la repetición delante, el juez ve lo que pasó en vez de dos
    // palabras contra dos palabras: aquí es donde más sirve adjuntarla.
    const html = `<p class="torneo-partida-nota">Los reportes no coinciden: lo revisará el organizador o un juez. Si guardaste la repetición, adjúntala: la verán.</p>${repeticionesDeMesaHtml(mia)}`
    if (!yaEstaPintado('miPartida', html)) {
      contenido.innerHTML = html
      engancharRepeticiones(contenido)
    }
    return
  }
  // El TABLERO (tanda 298): tú a un lado, tu rival al otro y el marcador
  // en medio. Antes era una columna de párrafos —contexto, «vs rival»,
  // TCG Live, reloj, check-in, botones— todos del mismo peso, y en un
  // BO3 había que echar la cuenta de cabeza para saber por dónde ibas.
  const bo = actual.phase === 'top_cut' ? ctx.torneo.top_cut_bo : ctx.torneo.swiss_bo
  const cabecera = `
    <div class="torneo-mesa-cab">
      <span class="torneo-mesa-cab-t">Mesa ${mia.table_number}</span>
      <span class="torneo-chapa torneo-chapa-neutra">${actual.phase === 'top_cut' ? 'Top cut' : 'Ronda suiza'} ${actual.round_number}</span>
      <span class="torneo-chapa torneo-chapa-neutra">${bo === 3 ? 'Al mejor de 3' : 'A una partida'}</span>
      <span class="torneo-mesa-cab-tcg">TCG Live: <strong>${escapeHtml(rival?.tcg_live_username || '—')}</strong></span>
    </div>`

  if (mia.status === 'pending') {
    const html = `${cabecera}<p class="subtext torneo-partida-nota">La ronda aún no ha empezado.</p>`
    if (yaEstaPintado('miPartida', html)) return
    contenido.innerHTML = html
    void rellenarChapasArquetipo(contenido)
    return
  }

  const rivalListo = soyA ? mia.check_in_b_at : mia.check_in_a_at
  // El reloj gigante se fue a la barra viva (tanda 298), que va pegada
  // arriba y no se pierde con el scroll. Aquí solo queda el aviso del
  // top cut, que no es un reloj sino lo contrario: que no lo hay.
  const reloj =
    actual.status !== 'active' && actual.phase === 'top_cut'
      ? '<p class="torneo-cuenta-etiqueta torneo-partida-nota">Sin límite de tiempo — se juega a acabar.</p>'
      : ''

  // El check-in va DENTRO del duelo, bajo cada jugador: es un estado de
  // esa persona, no una tabla aparte. El aviso de la ventana sigue
  // suelto, porque afecta a los dos.
  const faltaCheckin = actual.status === 'active' && (!miListo || !rivalListo)
  const serie = bo === 3 ? serieBo3(juegosDeMesa(mia).confirmados) : null
  const mias = serie ? (soyA ? serie.ganadasA : serie.ganadasB) : 0
  const suyas = serie ? (soyA ? serie.ganadasB : serie.ganadasA) : 0
  const jugador = (nombre, sub, listo, inicial, color) => `
    <div class="torneo-duelo-jugador">
      <span class="torneo-duelo-cara" style="background:${color}">${escapeHtml(inicial)}</span>
      <span class="torneo-duelo-nombre">${escapeHtml(nombre)}</span>
      <span class="torneo-duelo-sub">${sub}</span>
      <span class="torneo-duelo-checkin ${listo ? 'lista' : ''}">${listo ? '✓ Check-in hecho' : 'Check-in pendiente'}</span>
    </div>`
  const miNombre = ctx.inscripciones.find((i) => i.user_id === miId())?.perfil?.username || 'Tú'
  const rivalNombre = rival?.perfil?.username || 'Rival'
  const checkin = `
    <div class="torneo-duelo">
      ${jugador('Tú', escapeHtml(miNombre), miListo, miNombre.slice(0, 1), colorDeNombre(miNombre))}
      <div class="torneo-duelo-medio">
        ${
          serie
            ? `<div class="torneo-duelo-marcador"><b class="${mias > suyas ? 'gana' : ''}">${mias}</b><i>—</i><b class="${suyas > mias ? 'gana' : ''}">${suyas}</b></div>
               <span class="torneo-duelo-vs">AL MEJOR DE 3</span>`
            : '<span class="torneo-duelo-vs">VS</span>'
        }
      </div>
      ${jugador(rivalNombre, chapaDe(rivalId) || `<span class="subtext">${escapeHtml(rival?.tcg_live_username || '—')}</span>`, rivalListo, rivalNombre.slice(0, 1), colorDeNombre(rivalNombre))}
    </div>
    ${
      faltaCheckin
        ? `<p class="torneo-checkin-aviso hidden" id="avisoCheckin">Quedan <strong id="cuentaCheckinPartida">–:––</strong> de check-in — quien no lo haga pierde la ronda.</p>`
        : ''
    }
    ${miListo ? '' : '<button class="btn-primary torneo-boton-checkin" id="btnCheckin">Hacer check-in</button>'}`

  // Al mejor de tres, cada partida se marca por separado (tanda 291):
  // jugando un BO3 lo que la gente tiene delante es la partida que acaba
  // de terminar, no el resultado final echando la cuenta de cabeza.
  const miReporte = reportes.find((r) => r.match_id === mia.id && r.reporter_id === miId() && (r.game_number ?? 0) === 0)
  const botones =
    bo === 3
      ? panelBo3(mia, soyA)
      : miReporte
        ? '<p class="subtext">Resultado reportado: falta que tu rival lo confirme (pulsa Actualizar si tarda).</p>'
        : `<h4 class="torneo-mesas-titulo">Reportar resultado</h4>
      <div class="torneo-reportar">
        <button class="torneo-boton-resultado victoria" data-reporte="win">Victoria</button>
        <button class="torneo-boton-resultado derrota" data-reporte="loss">Derrota</button>
      </div>`
  // Aquí es donde más duele repintar de más: debajo están los botones de
  // Victoria y Derrota. Si el HTML es el mismo, no se toca nada.
  const juego = juegoPorReportar(mia, bo)
  const adjuntable = puedoAdjuntarA(mia)
  const html = `${cabecera}${reloj}${checkin}${botones}${registroHtml(juego, adjuntable)}${repeticionesDeMesaHtml(mia)}`
  if (yaEstaPintado('miPartida', html)) return
  contenido.innerHTML = html
  engancharRepeticiones(contenido)
  engancharRegistro(contenido, mia, juego, adjuntable, bo)
  void rellenarChapasArquetipo(contenido)
  if ($('btnCheckin')) $('btnCheckin').addEventListener('click', () => marcarListo(mia))
  contenido.querySelectorAll('[data-reporte]').forEach((b) => {
    b.addEventListener('click', () => reportar(mia, b.dataset.reporte, Number(b.dataset.juego || 0)))
  })
  contenido.querySelectorAll('[data-quitar]').forEach((b) => {
    b.addEventListener('click', () => desreportar(mia, Number(b.dataset.quitar)))
  })
}

// ── La clasificación por jornada y las listas de los rivales (tanda 219) ──
// En una LIGA, además de la general, cada jornada tiene su propia tabla:
// los mismos puntos y desempates, pero contando solo las mesas de esa
// ronda. Y si el organizador activó «listas a la vista», cada fila lleva
// un «Ver lista» que abre la decklist del rival — solo con el torneo ya
// en juego, que las listas se sellan al arrancar la R1.
let vistaClasificacion = 'general' // 'general' o el número de una jornada
let listaRivalAbierta = null // user_id de la lista abierta en su ventana (tanda 394)
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

// ── La lista de un jugador, en una VENTANA (tanda 394) ──
//
// PINGU: «que las listas de los jugadores se abran en otra ventana y no
// abajo, porque si no, no se ven». Se desplegaban DEBAJO de la
// clasificación: con dieciséis filas, el «Ver lista» del primero la
// abría a una pantalla de distancia y parecía que el botón no hacía
// nada. Ahora sale encima de todo, como el historial de partidas: el
// mismo patrón modal-overlay/modal-box, colgado del body para que el
// repintado de la tabla cada diez segundos no se la lleve por delante.
let focoAntesDeLista = null

function modalLista() {
  let overlay = document.getElementById('torneoListaModal')
  if (overlay) return overlay
  overlay = document.createElement('div')
  overlay.id = 'torneoListaModal'
  overlay.className = 'modal-overlay hidden torneo-lista-modal'
  overlay.innerHTML = `<div class="modal-box modal-box-wide" role="dialog" aria-modal="true" aria-labelledby="torneoListaTitulo">
    <div id="torneoListaContenido"></div>
  </div>`
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarLista()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) cerrarLista()
  })
  document.body.appendChild(overlay)
  return overlay
}

function cerrarLista() {
  listaRivalAbierta = null
  document.getElementById('torneoListaModal')?.classList.add('hidden')
  // El foco vuelve al «Ver lista» que la abrió: si no, quien va con
  // teclado acaba al principio de la página.
  if (focoAntesDeLista?.isConnected) focoAntesDeLista.focus()
  focoAntesDeLista = null
}

async function abrirListaRival(userId) {
  if (!listasRivales.has(userId)) {
    const { data } = await supabase
      .from('tournament_decklists')
      .select('*')
      .eq('tournament_id', ctx.torneo.id)
      .eq('user_id', userId)
      .maybeSingle()
    listasRivales.set(userId, data || null)
  }
  // Mientras llegaba, se ha pedido OTRA (o se ha cerrado): esta ya no.
  if (listaRivalAbierta !== userId) return
  const lista = listasRivales.get(userId)
  if (!lista) {
    listaRivalAbierta = null
    showToast('Ese jugador no tiene lista entregada.', 'info')
    return
  }
  const p = lista.parsed_cards || {}
  // Dónde quedó, que es lo que se pregunta quien abre la lista de otro.
  const puesto = clasificacionFinal().findIndex((e) => e.playerId === userId)
  const overlay = modalLista()
  const contenido = overlay.querySelector('#torneoListaContenido')
  contenido.innerHTML = `
    <div class="torneo-lista-cabecera">
      <div class="torneo-lista-quien">
        <h3 id="torneoListaTitulo">Lista de ${escapeHtml(nombreDe(userId))}</h3>${chapaDe(userId)}
        <span class="subtext">${puesto >= 0 ? `${puesto + 1}.º · ` : ''}${p.total ?? '?'} cartas · ${escapeHtml(ctx.torneo.name)}</span>
      </div>
      <button type="button" class="modal-close" id="btnCerrarListaRival" aria-label="Cerrar">×</button>
    </div>
    <div class="torneo-lista-acciones">
      <button type="button" class="btn-primary" id="btnGuardarListaRival">Guardar en mis mazos</button>
      <a class="btn-secondary" href="${escapeHtml(enlaceConstructor(comoListaDeMeta(p), nombreDeLaCopia(userId)))}">Abrir en el constructor</a>
      ${botonesExportarHtml()}
    </div>
    <div class="torneo-decklist-visual" id="listaRivalCartas"></div>
    <details class="torneo-lista-texto">
      <summary>Ver como texto</summary>
      <pre class="torneo-decklist-cruda">${escapeHtml(lista.raw_text || '')}</pre>
    </details>`
  overlay.classList.remove('hidden')
  // Arriba del todo cada vez: la caja recuerda el scroll de la lista de
  // antes, y abrir la de otro a media altura parecería otra cosa.
  overlay.querySelector('.modal-box').scrollTop = 0
  overlay.querySelector('#btnCerrarListaRival').addEventListener('click', cerrarLista)
  overlay.querySelector('#btnCerrarListaRival').focus()
  engancharExportar(contenido, { nombre: nombreDe(userId), rawText: lista.raw_text, parsed: p })
  overlay.querySelector('#btnGuardarListaRival').addEventListener('click', (e) => guardarListaRival(e.currentTarget, p, userId))
  void rellenarChapasArquetipo(overlay)
  if (p.pokemon || p.trainer || p.energy) await pintarDecklistVisual(contenido.querySelector('#listaRivalCartas'), p)
}

// ── Guardarse la lista de otro (tanda 413) ──
//
// PINGU: «que tú siempre te puedas guardar el mazo que quieras». Desde la
// ventana de la lista, a «Mis mazos» de un toque —como mazo privado— o al
// constructor para tocarlo antes.
const nombreDeLaCopia = (userId) => {
  const arq = arquetipos.get(userId)
  return `${arq?.nombre ? `${arq.nombre} — ` : ''}${nombreDe(userId)}`.slice(0, 80)
}

// La decklist de torneo ({ quantity }) con la forma de una lista de /meta
// ({ count }), que es la que sabe convertir en enlace del constructor.
const comoListaDeMeta = (p) =>
  Object.fromEntries(['pokemon', 'trainer', 'energy'].map((s) => [s, (p?.[s] || []).map((l) => ({ ...l, count: l.quantity }))]))

async function guardarListaRival(boton, parsed, userId) {
  boton.disabled = true
  try {
    const r = await guardarListaEnMisMazos({ lista: parsed, nombre: nombreDeLaCopia(userId) })
    if (r.entrar) {
      location.href = enlaceParaEntrar()
      return
    }
    showToast(r.faltan ? `Guardado en tus mazos. Faltan ${r.faltan} cartas que no están en el catálogo: complétalo en el constructor.` : 'Guardado en tus mazos.', 'success')
    boton.outerHTML = `<a class="btn-primary" href="/constructor?mazo=${encodeURIComponent(r.mazo.id)}">Abrir mi copia</a>`
  } catch (err) {
    showToast(err.message || 'No se ha podido guardar.', 'error')
    boton.disabled = false
  }
}

// ── Cómo vas (721, J2) ──
//
// En la pestaña Jugar, debajo de tu mesa: tu fila de la clasificación,
// la del que va primero y las de al lado, con un «…» donde se salta. Lo
// que se viene a mirar entre ronda y ronda es «¿dónde estoy?», y eso
// estaba en otra pestaña, en una tabla de dieciséis filas iguales. Sale
// de la MISMA cuenta que la tabla (`computeStandings`): dos sitios que
// calcularan la posición podrían no estar de acuerdo.
export function filasAlrededor(tabla, yo) {
  const i = tabla.findIndex((e) => e.playerId === yo)
  if (i < 0) return []
  const quiero = [...new Set([0, i - 1, i, i + 1])].filter((k) => k >= 0 && k < tabla.length).sort((a, b) => a - b)
  return quiero.map((k, j) => ({ pos: k + 1, e: tabla[k], yo: k === i, salto: j > 0 && k - quiero[j - 1] > 1 }))
}

function pintarComoVas() {
  const caja = $('torneoComoVas')
  if (!caja) return
  const yo = miId()
  const hayPuntos = partidas.some((m) => TERMINALES.has(m.status))
  const filas = yo && hayPuntos ? filasAlrededor(computeStandings(montarSnapshot(rondas.length)), yo) : []
  caja.classList.toggle('hidden', !filas.length)
  if (!filas.length) return olvidarPintado('comoVas')
  const html = `<ol class="torneo-como-vas">${filas
    .map((f) => `${f.salto ? '<li class="torneo-como-vas-salto" aria-hidden="true">…</li>' : ''}
      <li class="${f.yo ? 'torneo-fila-yo' : ''}"${f.yo ? ' aria-current="true"' : ''}>
        <span class="torneo-pos${f.pos <= 3 ? ` torneo-pos-${f.pos}` : ''}">${f.pos}</span>
        <span class="torneo-como-vas-nombre">${f.yo ? 'Tú' : escapeHtml(nombreDe(f.e.playerId))}</span>
        <span class="torneo-como-vas-vde">${f.e.wins}-${f.e.losses}-${f.e.draws}</span>
        <strong>${f.e.matchPoints} pts</strong>
      </li>`)
    .join('')}</ol>
    <button type="button" class="link-btn" data-ir-pestana="clasificacion">Ver la clasificación entera</button>`
  if (yaEstaPintado('comoVas', html)) return
  $('comoVasContenido').innerHTML = html
  $('comoVasContenido').querySelector('[data-ir-pestana]')?.addEventListener('click', () => {
    document.querySelector('#torneoPestanas [data-pestana="clasificacion"]')?.click()
    window.scrollTo({ top: 0, behavior: 'instant' })
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
      // El puesto como MEDALLA en los tres primeros, y tu fila marcada
      // (tanda 298): en una tabla de dieciséis filas iguales, lo primero
      // que busca cualquiera es dónde está él y quién va ganando.
      const medalla = i < 3 ? ` torneo-pos-${i + 1}` : ''
      return `
      <tr class="${e.playerId === miId() ? 'torneo-fila-yo' : ''}">
        <td><span class="torneo-pos${medalla}">${i + 1}</span></td>
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
  const htmlClasif = `
    ${banner}
    ${general ? repartoDePremiosHtml() : ''}
    ${general ? bracketHtml() : ''}
    ${chips}
    ${general ? '' : `<p class="subtext">Solo cuentan las mesas de la jornada ${vistaClasificacion}.</p>`}
    <div class="torneo-clasificacion-tabla">
      <table>
        <thead><tr><th>#</th><th>Jugador</th>${verTcgLive ? '<th>TCG Live</th>' : ''}<th>Puntos</th><th>V-D-E</th><th>OWP</th><th>OOWP</th>${verListas ? '<th></th>' : ''}</tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
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

  // La tabla entera se rehace en cada refresco. Si no ha cambiado nada,
  // no se toca: repintarla con la página desplazada da un salto y, si
  // alguien tenía abierta la lista de un rival, se le cerraba sola.
  if (yaEstaPintado('clasificacion', htmlClasif)) return
  $('clasificacionContenido').innerHTML = htmlClasif

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
      focoAntesDeLista = b
      void abrirListaRival(listaRivalAbierta)
    })
  )
  // El historial de un jugador: pulsar su nombre abre el modal. Vive
  // colgado del body, así que el repintado de la tabla no lo toca.
  document.querySelectorAll('[data-historial]').forEach((b) =>
    b.addEventListener('click', () => abrirHistorialJugador(b.dataset.historial))
  )
  document.querySelectorAll('[data-premio-dado]').forEach((b) => b.addEventListener('click', () => marcarPremioDado(b)))
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

// ── No repintar lo que no ha cambiado (tanda 258) ──
//
// La ficha se refresca sola cada 10 s, Y ADEMÁS con cada evento en vivo
// (mensajes de chat, reportes, resultados de CUALQUIER mesa). Con un
// torneo de verdad en marcha eso son varios repintados por segundo, y
// cada uno tira el HTML de «Tu partida» y lo vuelve a poner: la pantalla
// parpadea y, lo grave, los botones de Victoria/Derrota desaparecen y
// vuelven bajo el dedo — se pulsa uno y el clic se pierde, o cae en el
// que no era.
//
// La mayoría de esos repintados producen EXACTAMENTE el mismo HTML. Así
// que se guarda lo último que se pintó en cada caja y, si sale igual, no
// se toca el DOM: sin tocarlo no hay parpadeo, los botones no se mueven
// y los escuchas siguen enganchados donde estaban.
//
// Se compara el HTML que se va a PINTAR, no el que hay en la caja: hay
// piezas que se rellenan después (los sprites de los arquetipos), y
// leyendo el DOM de vuelta nunca coincidiría nada.
const ultimoPintado = new Map()

function yaEstaPintado(clave, html) {
  if (ultimoPintado.get(clave) === html) return true
  ultimoPintado.set(clave, html)
  return false
}

// Al salir de una caja por un camino que no pinta (mesa sin encontrar,
// panel escondido) hay que olvidar su firma: si no, al volver a ese
// mismo contenido se creería ya pintado y la caja se quedaría vacía.
function olvidarPintado(clave) {
  ultimoPintado.delete(clave)
}

// ── El meta del torneo (tanda 413) ──
//
// La pestaña «Meta»: qué mazos se jugaron, cuánto, y quién jugó cada uno
// en el orden en que quedó. Sale de los arquetipos que ya se deducen para
// las chapas, así que existe exactamente cuando las listas pueden verse.
let metaAbierto = null // la clave del arquetipo que se está mirando
let metaEnganchado = false

// Dónde quedó cada uno de verdad: con corte, manda el corte.
function clasificacionFinal() {
  const campeon = ctx.torneo.status === 'finished' ? podioDelTorneo()[0] ?? null : null
  return ordenFinal(computeStandings(montarSnapshot(rondas.length)), { rondas, partidas, campeon })
}

function pintarMeta() {
  const caja = $('torneoMetaCaja')
  if (!caja) return
  if (!puedenVerseLasListas() || !arquetipos.size) {
    caja.classList.add('hidden')
    olvidarPintado('meta')
    return
  }
  caja.classList.remove('hidden')
  const meta = agruparMeta(arquetipos, clasificacionFinal())
  // El arquetipo que se miraba puede desaparecer (llega una lista nueva
  // y lo recataloga): entonces se vuelve a la vista general.
  if (metaAbierto && !meta.arquetipos.some((g) => g.clave === metaAbierto)) metaAbierto = null
  const marcar = Boolean(mando() || ctx.esJuez)
  const html = metaHtml(meta, metaAbierto, {
    chapa: (arq) => chapaArquetipoHtml(arq, { marcar }),
    nombreDe,
    enJuego: ctx.torneo.status !== 'finished',
    exportar: ctx.torneo.status === 'finished' && Boolean(mando()),
  })
  const contenido = $('metaContenido')
  if (!metaEnganchado) {
    metaEnganchado = true
    // UNA escucha en la caja, que no se repinta: los botones de dentro
    // sí, cada vez que cambia algo.
    contenido.addEventListener('click', (e) => {
      const fila = e.target.closest('[data-meta-arquetipo]')
      const volver = e.target.closest('[data-meta-volver]')
      const ver = e.target.closest('[data-meta-lista]')
      const imagen = e.target.closest('[data-meta-imagen]')
      if (imagen) {
        void descargarMetaComoImagen(imagen)
      } else if (fila) {
        metaAbierto = fila.dataset.metaArquetipo
        pintarMeta()
        contenido.querySelector('[data-meta-volver]')?.focus()
      } else if (volver) {
        const desde = metaAbierto
        metaAbierto = null
        pintarMeta()
        // El foco vuelve al mazo del que se venía, no al principio.
        ;[...contenido.querySelectorAll('[data-meta-arquetipo]')].find((b) => b.dataset.metaArquetipo === desde)?.focus()
      } else if (ver) {
        listaRivalAbierta = ver.dataset.metaLista
        focoAntesDeLista = ver
        void abrirListaRival(listaRivalAbierta)
      }
    })
  }
  if (yaEstaPintado('meta', html)) return
  contenido.innerHTML = html
  void rellenarChapasArquetipo(contenido)
}

// La imagen del meta para compartir (tanda 425). Su módulo dibuja a mano
// en un canvas y no lo necesita nadie más que quien la pide, así que se
// baja al pulsar. Los datos son los mismos que pinta la pestaña: el meta
// agrupado y la clasificación final, con el corte mandando.
// Apagado mientras se monta: tarda lo que tarden en llegar los sprites, y
// un segundo toque bajaría la imagen dos veces.
async function descargarMetaComoImagen(boton) {
  boton.disabled = true
  try {
    const { descargarImagenMeta } = await import('./meta-imagen.js')
    const tabla = clasificacionFinal()
    await descargarImagenMeta({
      torneo: {
        nombre: ctx.torneo.name,
        fecha: ctx.torneo.start_at,
        rondas: rondas.filter((r) => r.phase !== 'top_cut').length,
        corte: ctx.torneo.top_cut_size || 0,
        liga: ctx.torneo.format === 'league',
      },
      meta: agruparMeta(arquetipos, tabla),
      jugadores: tabla.length,
      top: tabla.slice(0, 4).map((e) => {
        const arq = arquetipos.get(e.playerId) || null
        return { nombre: nombreDe(e.playerId), mazo: arq?.nombre || null, arq }
      }),
    })
  } catch {
    showToast('No se ha podido montar la imagen.', 'error')
  } finally {
    boton.disabled = false
  }
}

function pintarCiclo() {
  pintarRondas()
  pintarMiPartida()
  pintarClasificacion()
  pintarComoVas()
  pintarMeta()
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
