// Lo que /repeticiones le pide a la base (tanda 480): guardar una
// repetición, abrirla con su enlace, las tuyas, compartir y borrar.
//
// Todo depende de supabase-migration-repeticiones.sql. Sin ella la página
// sigue funcionando (pegar, ver, el enlace que lleva la partida dentro y
// el vídeo); lo que no hay es guardar. Por eso cada error de «no existe»
// se traduce a uno que lo dice, en vez de un mensaje de PostgREST que no
// le sugiere a nadie qué hacer (la razón de js/schema-check.js).
import { supabase } from '../supabase.js'

export const FICHERO_MIGRACION = 'supabase-migration-repeticiones.sql'

// Las columnas de la lista: sin el registro, que son 10 o 20 KB por fila.
// Los mazos llegaron en la tanda 494: una base con la migración de ANTES no
// las tiene, y la lista no puede romperse por eso (se piden sin ellas).
const COLUMNAS_BASE = 'id,titulo,jugador_a,jugador_b,ganador,turnos,compartida,created_at'
const COLUMNAS_LISTA = `${COLUMNAS_BASE},mazo_a,mazo_b`
// Y si está publicada como partida de ejemplo (tanda 520), que es otra
// migración (supabase-migration-repeticiones-galeria.sql).
const COLUMNAS_GALERIA = `${COLUMNAS_LISTA},publica`
export const FICHERO_GALERIA = 'supabase-migration-repeticiones-galeria.sql'
export const SIN_GALERIA = `Publicar aún no está disponible: falta poner ${FICHERO_GALERIA} en la base.`

// La migración de antes: le falta una COLUMNA o un ARGUMENTO que vino
// después (42703 en Postgres, PGRST204 y PGRST202 en PostgREST).
export const migracionVieja = (error) => ['42703', 'PGRST204', 'PGRST202'].includes(error?.code) || /column .* does not exist|could not find the .* column/i.test(error?.message || '')
const DE_NUEVO = `Para esto hay que ejecutar otra vez ${FICHERO_MIGRACION} en la base (trae lo nuevo sin tocar lo que ya hay).`

function faltaLaMigracion(error) {
  if (!error) return false
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code)) return true
  return /could not find the (function|table)|does not exist|schema cache/i.test(error.message || '')
}

function traducir(error) {
  if (faltaLaMigracion(error)) {
    return Object.assign(new Error(`Guardar repeticiones aún no está disponible: falta poner ${FICHERO_MIGRACION} en la base.`), { falta: true })
  }
  return new Error(error?.message || 'No se ha podido hablar con la base.')
}

export async function sesionActual() {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session || null
  } catch {
    return null
  }
}

// Guardar (o volver a guardar la misma partida, que no la duplica).
// Devuelve { id, compartida, nueva }.
export async function guardar({ registro, titulo = null, jugadores = null, ganador = null, turnos = null, compartida = null, mazos = null }) {
  const args = {
    p_registro: registro,
    p_titulo: titulo,
    p_jugadores: jugadores,
    p_ganador: ganador,
    p_turnos: turnos,
    p_compartida: compartida,
  }
  let { data, error } = await supabase.rpc('repeticiones_guardar', mazos ? { ...args, p_mazos: mazos } : args)
  // Con la función de antes (sin `p_mazos`) se guarda igual, sin los mazos.
  if (error && mazos && error.code === 'PGRST202') ({ data, error } = await supabase.rpc('repeticiones_guardar', args))
  if (error) throw traducir(error)
  const fila = Array.isArray(data) ? data[0] : data
  if (!fila?.id) throw new Error('La base no ha devuelto la repetición guardada.')
  return fila
}

// Abrir una con su enlace: la tuya, o una compartida. null si no existe
// o ya no se comparte (para quien no es su dueño, son lo mismo).
export async function leer(id) {
  const { data, error } = await supabase.rpc('repeticiones_leer', { p_id: id })
  if (error) throw traducir(error)
  const fila = Array.isArray(data) ? data[0] : data
  return fila?.registro ? fila : null
}

export async function misRepeticiones(userId) {
  const pedir = (columnas) => supabase.from('replays').select(columnas).eq('user_id', userId).order('created_at', { ascending: false }).limit(500)
  let { data, error } = await pedir(COLUMNAS_GALERIA)
  if (error && migracionVieja(error)) ({ data, error } = await pedir(COLUMNAS_LISTA))
  if (error && migracionVieja(error)) ({ data, error } = await pedir(COLUMNAS_BASE))
  if (error) throw traducir(error)
  return data || []
}

// Cambiar una fila TUYA. Un update que la política rechaza no da error:
// no toca nada y vuelve como si hubiera ido bien (CLAUDE.md). Por eso se
// pide la fila de vuelta y, si no viene, se dice.
async function cambiar(id, cambios) {
  const { data, error } = await supabase.from('replays').update(cambios).eq('id', id).select(`id,titulo,compartida${'notas' in cambios ? ',notas' : ''}`)
  if (error) throw migracionVieja(error) ? new Error(DE_NUEVO) : traducir(error)
  if (!data?.length) throw new Error('No se ha podido cambiar: ¿es tuya y sigue existiendo?')
  return data[0]
}

export const compartir = (id, si = true) => cambiar(id, { compartida: Boolean(si) })
export const renombrar = (id, titulo) => cambiar(id, { titulo: String(titulo || '').trim().slice(0, 120) || 'Repetición' })

// Las notas del dueño (tanda 495): [{ fila, texto }], ordenadas por la línea
// del registro a la que van (ver notasEnFotos en repeticiones.js).
export const guardarNotas = (id, notas) => cambiar(id, { notas })

// Publicar como partida de ejemplo, o quitarla (tanda 520): por función,
// nunca escribiendo en la tabla. `arquetipos`: los ids del catálogo de los
// mazos de la partida (los del meta).
export async function publicar(id, si, arquetipos = null) {
  const { error } = await supabase.rpc('repeticiones_publicar', { p_id: id, p_publica: Boolean(si), p_arquetipos: arquetipos })
  if (error) throw faltaLaMigracion(error) ? new Error(SIN_GALERIA) : new Error(error.message || 'No se ha podido publicar.')
}

// ¿Está puesta la migración de la galería? Se pregunta ANTES de guardar
// nada: publicar es guardar una copia y después publicarla, y sin la
// función la copia se quedaría en «Tus repeticiones» sin publicar. La
// columna y la función vienen en la misma migración, que es una sola
// transacción: si está la una, está la otra.
export async function galeriaPuesta() {
  const { error } = await supabase.from('replays').select('publica').limit(1)
  return !(error && migracionVieja(error))
}

// ── Los puzles «¿Qué jugarías?» (tanda 521) ──
//
// supabase-migration-repeticiones-puzles.sql. Se crean y se contestan por
// función; la buena y la explicación no se leen de la tabla, salen al
// contestar.
export const FICHERO_PUZLES = 'supabase-migration-repeticiones-puzles.sql'
const sinPuzles = (error) => (faltaLaMigracion(error) ? new Error(`Los puzles aún no están disponibles: falta poner ${FICHERO_PUZLES} en la base.`) : new Error(error.message || 'No se ha podido hablar con la base.'))

export async function crearPuzle({ repeticion, foto, pregunta, opciones, correcta, explicacion }) {
  const { data, error } = await supabase.rpc('puzles_crear', { p_repeticion: repeticion, p_foto: foto, p_pregunta: pregunta, p_opciones: opciones, p_correcta: correcta, p_explicacion: explicacion })
  if (error) throw sinPuzles(error)
  if (!data) throw new Error('La base no ha devuelto el puzle.')
  return data
}

// El puzle (sin su solución), o null si no existe o no se puede ver.
export async function leerPuzle(id) {
  const { data, error } = await supabase.from('replay_puzzles').select('id,replay_id,foto,pregunta,opciones').eq('id', id).limit(1)
  if (error) throw sinPuzles(error)
  return data?.[0] || null
}

export async function responderPuzle(id, opcion) {
  const { data, error } = await supabase.rpc('puzles_responder', { p_puzle: id, p_opcion: opcion })
  if (error) throw sinPuzles(error)
  const fila = Array.isArray(data) ? data[0] : data
  if (!fila) throw new Error('La base no ha devuelto la solución.')
  return fila
}

// Los recientes de todo el mundo; null sin la migración (la sección no sale).
export async function listaDePuzles(limite = 12) {
  const { data, error } = await supabase.rpc('puzles_lista', { p_limite: limite })
  if (error) return null
  return data || []
}

export async function borrar(id) {
  const { data, error } = await supabase.from('replays').delete().eq('id', id).select('id')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido borrar: ¿es tuya y sigue existiendo?')
}

// El catálogo de arquetipos, para ponerle nombre a lo que se vio de cada
// mazo (tanda 494). Lo lee cualquiera, con cuenta o sin ella; si no llega,
// el nombre sale deducido de las cartas, que es lo que hace el torneo.
export async function catalogoDeArquetipos() {
  try {
    const { data, error } = await supabase.from('tcg_archetypes').select('*').eq('activo', true)
    return error ? [] : data || []
  } catch {
    return []
  }
}

// El enlace corto de una guardada.
// Desde la 591, por /rep/<id> (una redirección de netlify.toml a
// /repeticiones?r=<id>): el mismo sitio con la mitad de letras.
export const enlaceCorto = (id, origen = location.origin) => `${origen}/rep/${encodeURIComponent(id)}`

// Qué impresión de cada Pokémon llevan los mazos del meta (repeticiones/
// impresion.js, `masJugadas`): las filas de los últimos `dias`. Si la
// tabla no está o falla, ninguna: se queda la que eligió el resolutor.
export async function impresionesDelMeta(nombres, { dias = 60 } = {}) {
  const lista = [...new Set((nombres || []).filter(Boolean))]
  if (!lista.length) return []
  const desde = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('meta_cartas_dia')
    .select('nombre,set_codigo,numero,mazos')
    .eq('seccion', 'pokemon')
    .in('nombre', lista)
    .gte('dia', desde)
    .order('mazos', { ascending: false })
    .limit(1000)
  return error ? [] : data || []
}

// ── Mis partidas (tanda 494) ──
//
// Guardar una repetición apunta la partida en /mis-partidas con su enlace.
// La tabla es la de siempre (supabase-migration-partidas.sql): cada uno
// escribe la suya. La columna `replay_id` y el índice que impide apuntar
// la misma repetición dos veces son de supabase-migration-repeticiones.sql.
export async function partidaApuntada(userId, replayId) {
  const { data, error } = await supabase.from('match_log').select('id,resultado,mi_mazo_nombre,rival_mazo_nombre').eq('user_id', userId).eq('replay_id', replayId).limit(1)
  if (error) return null
  return data?.[0] || null
}

export async function apuntarPartida(fila) {
  const { data, error } = await supabase.from('match_log').insert(fila).select('id')
  if (error?.code === '23505') return { ya: true }
  if (error) throw migracionVieja(error) ? new Error(DE_NUEVO) : new Error(error.message || 'No se ha podido apuntar la partida.')
  if (!data?.length) throw new Error('No se ha podido apuntar la partida.')
  return { id: data[0].id }
}

// ── Los torneos (tanda 496) ──
//
// Adjuntar la repetición de tu partida y quitarla: por función, nunca
// escribiendo en la tabla (un jugador no escribe en las tablas del torneo).
// Hasta tres por jugador y partida: lo que dura un BO3.
export async function adjuntarATorneo(partidaId, replayId) {
  const { error } = await supabase.rpc('torneos_adjuntar_repeticion', { p_partida: partidaId, p_repeticion: replayId })
  if (error) throw faltaLaMigracion(error) ? new Error(DE_NUEVO) : new Error(error.message || 'No se ha podido adjuntar.')
}

export async function quitarDeTorneo(partidaId, replayId) {
  const { error } = await supabase.rpc('torneos_quitar_repeticion', { p_partida: partidaId, p_repeticion: replayId })
  if (error) throw faltaLaMigracion(error) ? new Error(DE_NUEVO) : new Error(error.message || 'No se ha podido quitar.')
}

// Las repeticiones adjuntas a unas partidas: las que la base te deje ver
// (las de tus mesas, o todas si llevas o arbitras el torneo; y desde la
// tanda 555, las DE MESA que añade un juez, que ve cualquiera).
export const FICHERO_DE_MESA = 'supabase-migration-torneos-repeticiones-de-mesa.sql'
export async function repeticionesDePartidas(partidaIds) {
  if (!partidaIds?.length) return []
  const pedir = (cols) => supabase.from('tournament_match_replays').select(cols).in('match_id', partidaIds).order('created_at')
  let { data, error } = await pedir('match_id,user_id,replay_id,created_at,publica')
  // Sin la migración de la 555 no hay columna `publica`: las de antes son
  // todas de jugador, y la lista lo dice (`sinDeMesa`) para no ofrecer a
  // los jueces un botón que la base no tiene.
  if (error && migracionVieja(error)) {
    ;({ data, error } = await pedir('match_id,user_id,replay_id,created_at'))
    if (!error) return Object.assign((data || []).map((r) => ({ ...r, publica: false })), { sinDeMesa: true })
  }
  if (error) return []
  return data || []
}

// La de una MESA, por un juez o quien lleva el torneo (tanda 555).
export async function adjuntarDeMesa(partidaId, replayId) {
  const { error } = await supabase.rpc('torneos_juez_adjuntar_repeticion', { p_partida: partidaId, p_repeticion: replayId })
  if (error) throw faltaLaMigracion(error) ? new Error(`Para esto falta poner ${FICHERO_DE_MESA} en la base.`) : new Error(error.message || 'No se ha podido añadir.')
}
export async function quitarDeMesa(partidaId, replayId) {
  const { error } = await supabase.rpc('torneos_juez_quitar_repeticion', { p_partida: partidaId, p_repeticion: replayId })
  if (error) throw faltaLaMigracion(error) ? new Error(`Para esto falta poner ${FICHERO_DE_MESA} en la base.`) : new Error(error.message || 'No se ha podido quitar.')
}

