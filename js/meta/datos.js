// Las consultas de los mazos del meta (tanda 364). Todo son funciones de
// la base (supabase-migration-meta.sql): el ranking y la lista media se
// calculan al leer, no hay nada guardado que se pueda quedar viejo.
import { supabase } from '../supabase.js'
import { dexExacto } from '../torneos/sprites-pokemon.js'

export const FICHERO_MIGRACION = 'supabase-migration-meta.sql'

// PGRST202 (no existe la función) o 42P01 (no existe la tabla): la
// migración no se ha ejecutado. Se dice con el nombre del fichero, como
// hace el constructor — sin eso, la página diría «error» y nadie sabría
// qué falta.
function traducir(error) {
  if (!error) return null
  const sinMigracion = error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42P01' || /Could not find the function/i.test(error.message || '')
  const e = new Error(sinMigracion ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message || 'No se ha podido consultar.')
  e.sinMigracion = sinMigracion
  return e
}

async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args)
  if (error) throw traducir(error)
  return data || []
}

export const resumen = (dias, fuente = null) => rpc('meta_resumen', { p_dias: dias, p_fuente: fuente })

export async function totales(dias, fuente = null) {
  const filas = await rpc('meta_totales', { p_dias: dias, p_fuente: fuente })
  return filas[0] || { torneos: 0, jugadores: 0, desde: null, ultima_lectura: null }
}

export const listaMedia = (arquetipo, dias, fuente = null) => rpc('meta_lista_media', { p_arquetipo: arquetipo, p_dias: dias, p_fuente: fuente })

export const listasDestacadas = (arquetipo, dias, limite = 12, fuente = null) =>
  rpc('meta_listas', { p_arquetipo: arquetipo, p_dias: dias, p_limite: limite, p_fuente: fuente })

// El arquetipo por su id, aunque no haya salido en el periodo elegido
// (para poder decir «esta semana no se ha jugado» con su nombre).
export async function arquetipo(id) {
  const { data, error } = await supabase.from('meta_arquetipos').select('id,nombre,iconos,visto_at').eq('id', id).maybeSingle()
  if (error) throw traducir(error)
  return data
}

// ── Las guías ──
const COLUMNAS_GUIA = 'id,slug,title,description,category_id,blocks,level,estimated_mins,cover_image,guide_rarity,published_at,author_id'

export async function guiasDe(arquetipoId) {
  const { data, error } = await supabase
    .from('meta_guias')
    .select(`guide_id,added_by,created_at,guides(${COLUMNAS_GUIA})`)
    .eq('arquetipo', arquetipoId)
    .order('created_at', { ascending: true })
  if (error) throw traducir(error)
  // Un borrador vinculado (o una guía despublicada después) no llega:
  // la política de `guides` no deja verla, y el embebido vuelve a null.
  return (data || []).filter((f) => f.guides?.published_at)
}

// Las guías que esta persona puede vincular: las suyas publicadas, o
// todas las publicadas si es admin. Las noticias fuera: no son guías de
// un mazo (y `kind` puede no existir: vuelta atrás sin el filtro).
export async function guiasVinculables(userId, esAdmin) {
  const pedir = (conTipo) => {
    let q = supabase.from('guides').select(conTipo ? 'id,title,kind' : 'id,title').not('published_at', 'is', null).order('published_at', { ascending: false }).limit(esAdmin ? 300 : 100)
    if (!esAdmin) q = q.eq('author_id', userId)
    if (conTipo) q = q.or('kind.is.null,kind.neq.news')
    return q
  }
  let { data, error } = await pedir(true)
  if (error) ({ data, error } = await pedir(false))
  if (error) throw traducir(error)
  return data || []
}

export async function vincularGuia(arquetipoId, guideId) {
  const { error } = await supabase.from('meta_guias').insert({ arquetipo: arquetipoId, guide_id: guideId })
  if (error) {
    if (error.code === '23505') throw new Error('Esa guía ya está vinculada a este mazo.')
    if (error.code === '42501') throw new Error('Solo puedes vincular guías tuyas que ya estén publicadas.')
    throw traducir(error)
  }
}

export async function desvincularGuia(arquetipoId, guideId) {
  // Con `select`: un DELETE que la política rechaza NO da error, vuelve
  // vacío como si todo hubiera ido bien (CLAUDE.md, «Los torneos»). Sin
  // mirar lo borrado, el botón diría «quitada» y la guía seguiría ahí.
  const { data, error } = await supabase.from('meta_guias').delete().eq('arquetipo', arquetipoId).eq('guide_id', guideId).select('guide_id')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No puedes quitar esta guía: solo quien la vinculó, su autor o un admin.')
}

// Las partidas de ejemplo de un mazo (tanda 520): repeticiones que la gente
// ha publicado (supabase-migration-repeticiones-galeria.sql). Sin esa
// migración, null: la ficha no enseña la sección en vez de un error.
export async function partidasDeEjemplo(arquetipo, limite = 6) {
  const { data, error } = await supabase.rpc('repeticiones_publicas', { p_arquetipo: arquetipo, p_limite: limite })
  if (error) return null
  return data || []
}

// ── El tipo de un arquetipo (721, J3) ──
//
// Para teñir su barra de uso. Sale de las CARTAS y no de una lista: la
// especie del primer icono, y de las cartas de esa especie el tipo que
// más se repite (un Charizard es de Fuego aunque haya alguno de Oscuro).
// Una lista a mano de «este mazo es de este tipo» se quedaría vieja con
// el primer arquetipo nuevo (la 323).
export function dexDeIcono(icono) {
  const s = String(icono || '').toLowerCase()
  if (!s) return null
  return dexExacto(s.replace(/-/g, ' ')) ?? dexExacto(s.split('-')[0]) ?? null
}

export function tipoMasRepetido(cartas, dex) {
  const cuenta = new Map()
  for (const c of cartas || []) {
    const t = (c.types || [])[0]
    if (!t || !(c.dex_ids || []).includes(dex)) continue
    cuenta.set(t, (cuenta.get(t) || 0) + 1)
  }
  let mejor = null
  for (const [t, n] of cuenta) if (!mejor || n > mejor[1]) mejor = [t, n]
  return mejor?.[0] || null
}

export async function tiposDeArquetipos(filas) {
  const dexDe = new Map((filas || []).map((f) => [f.arquetipo, dexDeIcono((f.iconos || [])[0])]).filter(([, d]) => d))
  const dexes = [...new Set(dexDe.values())]
  if (!dexes.length) return new Map()
  const { data, error } = await supabase.from('tcg_cards').select('dex_ids, types').eq('market', 'WEST').overlaps('dex_ids', dexes).limit(4000)
  if (error) throw traducir(error)
  return new Map([...dexDe].map(([a, d]) => [a, tipoMasRepetido(data, d)]).filter(([, t]) => t))
}
