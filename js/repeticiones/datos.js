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
const COLUMNAS_LISTA = 'id,titulo,jugador_a,jugador_b,ganador,turnos,compartida,created_at'

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
export async function guardar({ registro, titulo = null, jugadores = null, ganador = null, turnos = null, compartida = null }) {
  const { data, error } = await supabase.rpc('repeticiones_guardar', {
    p_registro: registro,
    p_titulo: titulo,
    p_jugadores: jugadores,
    p_ganador: ganador,
    p_turnos: turnos,
    p_compartida: compartida,
  })
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
  const { data, error } = await supabase
    .from('replays')
    .select(COLUMNAS_LISTA)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw traducir(error)
  return data || []
}

// Cambiar una fila TUYA. Un update que la política rechaza no da error:
// no toca nada y vuelve como si hubiera ido bien (CLAUDE.md). Por eso se
// pide la fila de vuelta y, si no viene, se dice.
async function cambiar(id, cambios) {
  const { data, error } = await supabase.from('replays').update(cambios).eq('id', id).select('id,titulo,compartida')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido cambiar: ¿es tuya y sigue existiendo?')
  return data[0]
}

export const compartir = (id, si = true) => cambiar(id, { compartida: Boolean(si) })
export const renombrar = (id, titulo) => cambiar(id, { titulo: String(titulo || '').trim().slice(0, 120) || 'Repetición' })

export async function borrar(id) {
  const { data, error } = await supabase.from('replays').delete().eq('id', id).select('id')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido borrar: ¿es tuya y sigue existiendo?')
}

// El enlace corto de una guardada.
export const enlaceCorto = (id, origen = location.origin) => `${origen}/repeticiones?r=${encodeURIComponent(id)}`
