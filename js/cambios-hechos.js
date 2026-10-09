// Confianza en los cambios (tanda 795, NU4): «Cambio hecho» entre dos
// personas que han hablado, y «todo bien» / «hubo un problema» después. Lo
// que se enseña de alguien es «12 cambios · todos bien»; los problemas solo
// los ve la moderación. Todo pasa por las funciones de
// supabase-migration-cambios-hechos.sql: sin ella, nada se pinta.
import { supabase } from './supabase.js'

export const FICHERO_MIGRACION = 'supabase-migration-cambios-hechos.sql'
const sinMigracion = (e) => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(e?.code) || /Could not find|does not exist/i.test(e?.message || '')

// Puro: el rótulo de confianza. Sin cambios, nada (un «0 cambios» no ayuda a
// nadie y señala a quien empieza).
export function textoDeConfianza(c) {
  const hechos = Number(c?.hechos) || 0, bien = Number(c?.bien) || 0
  if (!hechos) return ''
  const cuantos = hechos === 1 ? '1 cambio' : `${hechos.toLocaleString('es-ES')} cambios`
  if (bien >= hechos) return `${cuantos} · todos bien`
  if (!bien) return cuantos
  return `${cuantos} · ${bien} dijeron que fue bien`
}

export async function cambiosDe(userId) {
  const { data, error } = await supabase.rpc('cambios_de', { p_user: userId })
  if (error) return null
  return Array.isArray(data) ? data[0] || null : data
}

// Los cambios con UNA persona, para saber qué botón toca en la conversación.
export async function cambiosCon(yo, otro) {
  const [a, b] = [yo, otro].sort()
  const { data, error } = await supabase.from('trade_confirmations').select('*').eq('user_a', a).eq('user_b', b).order('created_at', { ascending: false }).limit(5)
  if (error) return sinMigracion(error) ? null : []
  return data || []
}

// Qué le toca hacer a `yo` con el último cambio con esa persona. Puro.
export function estadoDelCambio(filas, yo) {
  const f = (filas || [])[0]
  if (!f) return { paso: 'marcar' }
  const soyA = f.user_a === yo
  const mio = soyA ? f.hecho_a_at : f.hecho_b_at, suyo = soyA ? f.hecho_b_at : f.hecho_a_at
  const valoracion = soyA ? f.valoracion_a : f.valoracion_b
  if (mio && suyo) return valoracion ? { paso: 'hecho', fila: f, valoracion } : { paso: 'valorar', fila: f }
  if (mio) return { paso: 'esperando', fila: f }
  return { paso: suyo ? 'confirmar' : 'marcar', fila: f }
}

export async function marcarCambio(otro) {
  const { data, error } = await supabase.rpc('cambio_marcar', { p_otro: otro })
  if (error) throw new Error(sinMigracion(error) ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message)
  return data
}

export async function valorarCambio(id, valor, nota = null) {
  const { error } = await supabase.rpc('cambio_valorar', { p_id: id, p_valor: valor, p_nota: nota })
  if (error) throw new Error(sinMigracion(error) ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message)
}
