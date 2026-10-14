// Tus datos de Play! Pokémon (tanda 834): nombre y apellidos, Player ID y
// fecha de nacimiento, para que la decklist oficial del constructor se
// rellene sola. Viven en `user_play_pokemon`, que solo deja ver y tocar la
// fila propia (supabase-migration-play-pokemon.sql): los perfiles son
// públicos y esto no.
//
// Al leer se distingue lo que la casa distingue (tanda 319): 'falta' (la
// migración no está), 'error' (la base no contesta: no se sabe) y 'ok' con
// la fila, que puede ser {} si aún no has guardado nada.
import { supabase } from './supabase.js'
import { limpiarPlayerId } from './player-id.js'

export const MIGRACION_PLAY = 'supabase-migration-play-pokemon.sql'

// «Esa tabla no existe», venga como venga: 42P01 de Postgres o el
// PGRST205 de PostgREST («Could not find the table … in the schema cache»).
export function faltaLaTablaPlay(error) {
  return Boolean(error) && (error.code === '42P01' || error.code === 'PGRST205' || /user_play_pokemon/.test(error.message || ''))
}

export async function leerDatosPlay(userId) {
  if (!userId) return { estado: 'error', fila: null }
  const { data, error } = await supabase
    .from('user_play_pokemon')
    .select('player_id, player_name, birth_date')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { estado: faltaLaTablaPlay(error) ? 'falta' : 'error', fila: null }
  return { estado: 'ok', fila: data || {} }
}

// Guarda lo que se le pase (vacío = borrarlo de la fila). Devuelve el
// error tal cual, o null. Un Player ID que no son cifras no llega a la
// base: lo dice aquí, en español, antes que el CHECK en inglés.
export async function guardarDatosPlay(userId, { playerId = '', nombre = '', nacimiento = '' } = {}) {
  const id = String(playerId || '').trim()
  const limpio = id ? limpiarPlayerId(id) : null
  if (id && !limpio) return { message: 'El Player ID son solo cifras (como 1234567).' }
  const fila = {
    user_id: userId,
    player_id: limpio,
    player_name: String(nombre || '').trim().slice(0, 80) || null,
    birth_date: /^\d{4}-\d{2}-\d{2}$/.test(String(nacimiento || '')) ? nacimiento : null,
    updated_at: new Date().toISOString(),
  }
  // Con `.select()`: una escritura que la política rechaza puede volver sin
  // error y sin filas, y eso no es «guardado».
  const { data, error } = await supabase.from('user_play_pokemon').upsert(fila, { onConflict: 'user_id' }).select('user_id')
  if (error) return error
  return data?.length ? null : { message: 'La base no lo ha guardado.' }
}
