// Las consultas de «Por torneo» (tandas 1421 y 1422). Directas a las tablas
// del meta, que lee todo el mundo (políticas `meta_torneos_leer` y
// `meta_resultados_leer`): sin migración.
import { supabase } from '../supabase.js'
import { POR_PAGINA, TOP, desdeDePeriodo } from './torneos-nucleo.js'

const COLUMNAS_TORNEO = 'id,nombre,fecha,jugadores,clasificados,con_lista,fuente,tipo,enlace'
// La clasificación, sin la lista (pesa: se pide al abrirla, de una en una).
const COLUMNAS_FILA = 'torneo_id,jugador,arquetipo,puesto,victorias,derrotas,empates,nombre_jugador,pais'
// PostgREST corta en 1.000 filas por respuesta: un regional trae casi 2.000.
const TRAMO = 1000

function fallo(error) {
  return new Error(error?.message ? `No se han podido leer los torneos: ${error.message}` : 'No se han podido leer los torneos.')
}

// Los torneos del periodo, del más reciente al más viejo (a igualdad de día,
// el más grande primero). Se pide uno de más para saber si hay otra página.
export async function listaDeTorneos({ dias, fuente = null, desde = 0 }) {
  let q = supabase.from('meta_torneos').select(COLUMNAS_TORNEO).gte('fecha', desdeDePeriodo(dias))
  if (fuente) q = q.eq('fuente', fuente)
  const { data, error } = await q.order('fecha', { ascending: false }).order('jugadores', { ascending: false }).range(desde, desde + POR_PAGINA)
  if (error) throw fallo(error)
  const filas = data || []
  return { torneos: filas.slice(0, POR_PAGINA), hayMas: filas.length > POR_PAGINA }
}

// El Top de cada torneo de la página: una consulta para todos.
export async function topsDe(ids) {
  if (!ids.length) return []
  const { data, error } = await supabase.from('meta_resultados').select(COLUMNAS_FILA).in('torneo_id', ids).lte('puesto', TOP).order('puesto', { ascending: true })
  if (error) throw fallo(error)
  return data || []
}

// El nombre y los iconos de cada mazo que sale.
export async function arquetiposDe(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return new Map()
  const { data, error } = await supabase.from('meta_arquetipos').select('id,nombre,iconos').in('id', unicos)
  if (error) throw fallo(error)
  return new Map((data || []).map((a) => [a.id, a]))
}

export async function torneoPorId(id) {
  const { data, error } = await supabase.from('meta_torneos').select(COLUMNAS_TORNEO).eq('id', id).maybeSingle()
  if (error) throw fallo(error)
  return data
}

// La clasificación entera, por tramos. Las filas sin puesto, al final.
export async function clasificacionDe(id) {
  const fuera = []
  for (let desde = 0; desde < 20_000; desde += TRAMO) {
    const { data, error } = await supabase.from('meta_resultados').select(COLUMNAS_FILA).eq('torneo_id', id).order('puesto', { ascending: true, nullsFirst: false }).range(desde, desde + TRAMO - 1)
    if (error) throw fallo(error)
    fuera.push(...(data || []))
    if ((data || []).length < TRAMO) break
  }
  return fuera
}

// Quiénes tienen lista guardada (solo los de arriba: 32 de un oficial, 64 de
// uno de PokeDoc). Sin la lista: solo el id del jugador.
export async function conListaDe(id) {
  const { data, error } = await supabase.from('meta_resultados').select('jugador').eq('torneo_id', id).not('lista', 'is', null)
  if (error) return new Set()
  return new Set((data || []).map((f) => f.jugador))
}

// La lista de un jugador, al abrirla.
export async function listaDe(torneoId, jugador) {
  const { data, error } = await supabase.from('meta_resultados').select('lista,enlace').eq('torneo_id', torneoId).eq('jugador', jugador).maybeSingle()
  if (error) throw fallo(error)
  return data
}
