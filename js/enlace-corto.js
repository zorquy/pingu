// Enlaces cortos (tanda 591): `pokedoc.es/rep/<id>` y `pokedoc.es/lab/<id>`.
//
// PINGU: «los enlaces, hacerlos muchísimo más cortos». Una repetición sin
// cuenta y una posición del laboratorio llevaban la partida entera dentro
// del enlace (3.000–6.000 caracteres). Ahora esa misma carga —la de detrás
// del `#`, ya comprimida aquí— se guarda en la base (supabase-migration-
// enlaces-cortos.sql) y el enlace lleva ocho letras. La base no la abre:
// guarda y devuelve el texto tal cual.
//
// Si la base no puede (sin la migración, un tope, sin red), quien llama
// hace el enlace largo de siempre, que sigue funcionando igual.
import { supabase } from './supabase.js'

export const FICHERO_ENLACES = 'supabase-migration-enlaces-cortos.sql'

// El id de un enlace corto: ocho letras de un alfabeto sin las que se
// confunden (ni 0/o ni 1/l/i). Una repetición GUARDADA es otra cosa: diez
// cifras hexadecimales, y va por /rep/ igual.
export const esIdCorto = (id) => /^[a-z2-9]{8}$/.test(String(id || ''))

// La dirección corta: /rep/ para las repeticiones (guardadas o no) y /lab/
// para las posiciones. Las dos son redirecciones de netlify.toml.
export const enlaceCorto = (tipo, id, origen = location.origin) => `${origen}/${tipo === 'posicion' ? 'lab' : 'rep'}/${encodeURIComponent(id)}`

const faltaLaMigracion = (error) =>
  ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code) || /could not find the function|does not exist|schema cache/i.test(error?.message || '')

// `tipo`: 'repeticion' | 'posicion'; `carga`: lo de detrás del `#`.
export async function acortar(tipo, carga) {
  const { data, error } = await supabase.rpc('enlace_corto_crear', { p_tipo: tipo, p_carga: String(carga || '').replace(/^#/, '') })
  if (error) throw Object.assign(new Error(faltaLaMigracion(error) ? `Los enlaces cortos aún no están: falta poner ${FICHERO_ENLACES} en la base.` : error.message || 'No se ha podido acortar.'), { falta: faltaLaMigracion(error) })
  if (!esIdCorto(data)) throw new Error('La base no ha devuelto un enlace.')
  return data
}

// { tipo, carga }, o null si ese enlace no existe. Si no se ha podido
// PREGUNTAR, lanza: son dos cosas distintas que decirle a quien lo abre.
export async function leerCorto(id) {
  if (!esIdCorto(id)) return null
  const { data, error } = await supabase.rpc('enlace_corto_leer', { p_id: id })
  if (error) throw Object.assign(new Error(faltaLaMigracion(error) ? `Los enlaces cortos aún no están: falta poner ${FICHERO_ENLACES} en la base.` : 'No se ha podido abrir el enlace: prueba otra vez en un momento.'), { falta: faltaLaMigracion(error) })
  const fila = Array.isArray(data) ? data[0] : data
  return fila?.tipo && fila?.carga ? { tipo: fila.tipo, carga: fila.carga } : null
}
