// Las consultas de «Mi colección» (tanda 365). Lo usan /mi-coleccion y
// el bloque de precio y colección de la ficha de una carta.
import { supabase } from '../supabase.js'
import { urlDePrecio, precioDe, precioDeFila, claveDeLinea } from '../cardmarket.js'

export const FICHERO_MIGRACION = 'supabase-migration-mi-coleccion.sql'

function traducir(error) {
  if (!error) return null
  const sin = ['PGRST202', 'PGRST205', '42P01', '42703'].includes(error.code) || /does not exist|Could not find/i.test(error.message || '')
  const e = new Error(sin ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message || 'No se ha podido consultar.')
  e.sinMigracion = sin
  return e
}

export const COLUMNAS_LINEA = 'id,user_id,card_id,market,idioma,estado,variante,cantidad,gradeo,valor_manual,precio_compra,notas,created_at,updated_at'

export async function lineasDe(userId) {
  const filas = []
  // Con paginación: una colección grande pasa de las 1.000 filas que
  // PostgREST devuelve de una vez, y cortar ahí sin avisar diría un valor
  // total más bajo del que es.
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from('user_collection')
      .select(COLUMNAS_LINEA)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(desde, desde + 999)
    if (error) throw traducir(error)
    filas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return filas
}

export async function lineasDeCarta(userId, cardId) {
  const { data, error } = await supabase.from('user_collection').select(COLUMNAS_LINEA).eq('user_id', userId).eq('card_id', cardId)
  if (error) throw traducir(error)
  return data || []
}

// Añadir: si ya hay una línea igual (misma carta, idioma, estado,
// versión y gradeo) se le suman copias en vez de crear otra. Dos filas
// iguales separadas solo harían la lista más larga.
export async function anadir(userId, linea) {
  const existentes = await lineasDeCarta(userId, linea.card_id)
  const igual = existentes.find((l) => claveDeLinea(l) === claveDeLinea(linea))
  if (igual) {
    return actualizar(igual.id, { cantidad: Math.min(999, igual.cantidad + (linea.cantidad || 1)) })
  }
  const { data, error } = await supabase.from('user_collection').insert({ market: 'WEST', ...linea }).select(COLUMNAS_LINEA).single()
  if (error) throw traducir(error)
  return data
}

export async function actualizar(id, cambios) {
  // Con `select`: una escritura que la política rechaza no da error,
  // vuelve vacía (CLAUDE.md). Sin mirar, «guardado» mentiría.
  const { data, error } = await supabase.from('user_collection').update(cambios).eq('id', id).select(COLUMNAS_LINEA)
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido guardar: esa línea no es tuya o ya no existe.')
  return data[0]
}

export async function borrar(id) {
  const { data, error } = await supabase.from('user_collection').delete().eq('id', id).select('id')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido borrar: esa línea no es tuya o ya no existe.')
}

// ── Las cartas del espejo ──
// `tcg_online_code` va aquí desde la tanda 370: es lo que necesita el
// segundo sitio donde buscar un escaneo cuando TCGdex no tiene el de esa
// carta (ver js/escaneo-carta.js).
const COLUMNAS_CARTA = 'id,set_id,local_id,name,name_es,image_path,rarity,category,tcg_sets(id,name,serie_id,release_date,card_count_official,card_count_total,logo_path,tcg_online_code)'

export async function cartasPorIds(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  const mapa = new Map()
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA).eq('market', 'WEST').in('id', unicos.slice(i, i + 150))
    if (error) throw traducir(error)
    for (const c of data || []) mapa.set(c.id, c)
  }
  return mapa
}

export async function cartasDeSet(setId) {
  const { data, error } = await supabase
    .from('tcg_cards')
    .select('id,set_id,local_id,name,name_es,image_path,rarity,tcg_sets(tcg_online_code)')
    .eq('market', 'WEST')
    .eq('set_id', setId)
    .limit(1000)
  if (error) throw traducir(error)
  return data || []
}

// ── Los precios ──

// Los guardados por la función programada, de una vez.
export async function preciosGuardados(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  const mapa = new Map()
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await supabase.from('tcg_card_prices').select('*').in('card_id', unicos.slice(i, i + 150))
    if (error) {
      if (traducir(error).sinMigracion) return mapa
      throw traducir(error)
    }
    for (const f of data || []) mapa.set(f.card_id, f)
  }
  return mapa
}

// Uno en el momento, a TCGdex. Con caché por visita: la ficha y el
// formulario de añadir preguntan por la misma carta.
const enVivo = new Map()
export function preciosEnVivo(cardId) {
  if (!enVivo.has(cardId)) {
    enVivo.set(
      cardId,
      fetch(urlDePrecio(cardId), { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((c) => (c ? { pricing: c.pricing || null, variants: c.variants || null } : null))
        .catch(() => null)
    )
  }
  return enVivo.get(cardId)
}

// El precio de una línea: el guardado si lo hay; si no, en vivo.
export function precioDeLinea(linea, guardados, vivos) {
  const reverse = linea.variante === 'reverse'
  const fila = guardados.get(linea.card_id)
  if (fila) return precioDeFila(fila, { reverse })
  const v = vivos.get(linea.card_id)
  return v ? precioDe(v.pricing, { reverse }) : null
}

// ── Perfil: colección pública o privada ──
export async function perfilPorUsuario(username) {
  const { data, error } = await supabase.from('user_profiles').select('id,username,display_name,coleccion_publica').eq('username', username).maybeSingle()
  if (error) throw traducir(error)
  return data
}

export async function ponerPublica(userId, publica) {
  const { data, error } = await supabase.from('user_profiles').update({ coleccion_publica: publica }).eq('id', userId).select('coleccion_publica')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido cambiar.')
  return data[0].coleccion_publica
}
