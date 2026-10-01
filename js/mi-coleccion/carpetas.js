// Las carpetas de tu colección (tanda 402).
//
// PINGU, enseñando Dex: «carpetas, y dentro de las carpetas otras
// subcarpetas, para ordenar tu colección por carpetas o lo que quieras
// hacer, listas distintas o lo que sea».
//
// Este módulo hace dos cosas y las separa a propósito: las CONSULTAS
// (que tocan la red) y el ÁRBOL (que es puro y se prueba en Node). El
// árbol es donde está la lógica de verdad: ordenar, anidar y decidir qué
// carpetas puede tener de madre una carpeta sin montar un ciclo.

import { supabase } from '../supabase.js'
import { traducir } from './datos.js'
import { escapeHtml } from '../html.js'

const COLUMNAS = 'id,parent_id,nombre,emoji,color,orden,created_at'

// ── Las consultas ──

export async function listarCarpetas() {
  const { data, error } = await supabase.from('collection_folders').select(COLUMNAS).order('orden').order('created_at')
  if (error) {
    // Sin la migración no hay carpetas, pero el resto de la página no
    // tiene por qué enterarse: se devuelve vacío y la pestaña lo dice.
    if (traducir(error).sinMigracion) return null
    throw traducir(error)
  }
  return data || []
}

export async function resumenDeCarpetas() {
  const { data, error } = await supabase.rpc('carpetas_resumen')
  if (error) {
    if (traducir(error).sinMigracion) return new Map()
    throw traducir(error)
  }
  return new Map((data || []).map((f) => [f.folder_id, { cartas: Number(f.cartas) || 0, copias: Number(f.copias) || 0 }]))
}

export async function crearCarpeta(userId, { nombre, parent_id = null, emoji = null, color = null }) {
  const { data, error } = await supabase
    .from('collection_folders')
    .insert({ user_id: userId, nombre: String(nombre).trim().slice(0, 60), parent_id, emoji, color })
    .select(COLUMNAS)
    .single()
  if (error) throw traducir(error)
  return data
}

export async function renombrarCarpeta(id, cambios) {
  const { data, error } = await supabase.from('collection_folders').update(cambios).eq('id', id).select(COLUMNAS).single()
  if (error) throw traducir(error)
  return data
}

// Borrar una carpeta se lleva sus HIJAS (cascada de la base), pero no las
// cartas: una carta vive en tu colección, no en la carpeta. Quien borra
// «Vintage» no quiere quedarse sin sus cartas vintage.
export async function borrarCarpeta(id) {
  const { error } = await supabase.from('collection_folders').delete().eq('id', id)
  if (error) throw traducir(error)
}

export async function carpetasDeLinea(lineId) {
  const { data, error } = await supabase.from('collection_folder_cards').select('folder_id').eq('line_id', lineId)
  if (error) {
    if (traducir(error).sinMigracion) return []
    throw traducir(error)
  }
  return (data || []).map((f) => f.folder_id)
}

export async function meterEnCarpeta(folderId, lineId) {
  const { error } = await supabase.from('collection_folder_cards').insert({ folder_id: folderId, line_id: lineId })
  // Meterla dos veces no es un error que haya que gritar: ya está dentro,
  // que es lo que querías.
  if (error && error.code !== '23505') throw traducir(error)
}

export async function sacarDeCarpeta(folderId, lineId) {
  const { error } = await supabase.from('collection_folder_cards').delete().eq('folder_id', folderId).eq('line_id', lineId)
  if (error) throw traducir(error)
}

export async function lineasDeCarpeta(folderId) {
  const { data, error } = await supabase.from('collection_folder_cards').select('line_id').eq('folder_id', folderId)
  if (error) {
    if (traducir(error).sinMigracion) return []
    throw traducir(error)
  }
  return (data || []).map((f) => f.line_id)
}

// ── El árbol (puro) ──

// De una lista plana a un árbol. Las huérfanas —una madre borrada a
// medias, un dato raro— se cuelgan de la raíz en vez de desaparecer: una
// carpeta que no se ve es una carpeta que no se puede recuperar.
export function arbolDeCarpetas(carpetas = []) {
  const porId = new Map(carpetas.map((c) => [c.id, { ...c, hijas: [] }]))
  const raiz = []
  for (const c of porId.values()) {
    const madre = c.parent_id ? porId.get(c.parent_id) : null
    if (madre) madre.hijas.push(c)
    else raiz.push(c)
  }
  const ordenar = (lista) => {
    lista.sort((a, b) => (a.orden || 0) - (b.orden || 0) || String(a.created_at).localeCompare(String(b.created_at)))
    for (const c of lista) ordenar(c.hijas)
  }
  ordenar(raiz)
  return raiz
}

// Qué carpetas puede tener de madre una carpeta: todas menos ella misma y
// menos sus descendientes. Si no, se monta un ciclo — la base lo
// rechazaría, pero ofrecerlo en un desplegable es ofrecer un error.
export function madresPosibles(carpetas, id) {
  if (!id) return carpetas
  const hijasDe = new Map()
  for (const c of carpetas) {
    if (!hijasDe.has(c.parent_id)) hijasDe.set(c.parent_id, [])
    hijasDe.get(c.parent_id).push(c.id)
  }
  const prohibidas = new Set([id])
  const pila = [id]
  while (pila.length) {
    for (const h of hijasDe.get(pila.pop()) || []) {
      if (prohibidas.has(h)) continue
      prohibidas.add(h)
      pila.push(h)
    }
  }
  return carpetas.filter((c) => !prohibidas.has(c.id))
}

// Cuántos niveles hondo está una carpeta, para pintar la sangría.
export function hondura(carpetas, id) {
  const porId = new Map(carpetas.map((c) => [c.id, c]))
  let n = 0
  let actual = porId.get(id)
  while (actual?.parent_id && n < 50) {
    actual = porId.get(actual.parent_id)
    n++
  }
  return n
}

// ── Pintar ──

export function tarjetaHtml(c, resumen) {
  const r = resumen.get(c.id) || { cartas: 0, copias: 0 }
  const hijas = c.hijas?.length || 0
  // Lo que se dice debajo: si tiene subcarpetas se dicen ELLAS, que es
  // lo que hay dentro; si no, las cartas. Decir «0 cartas» en una
  // carpeta que solo contiene carpetas es decir que está vacía cuando no
  // lo está.
  const pie = hijas
    ? `${hijas} ${hijas === 1 ? 'subcarpeta' : 'subcarpetas'}${r.cartas ? ` · ${r.cartas} cartas` : ''}`
    : `${r.cartas} ${r.cartas === 1 ? 'carta' : 'cartas'}`
  return `<article class="mc-carpeta" data-carpeta="${escapeHtml(c.id)}"${c.color ? ` style="--carpeta-color:${escapeHtml(c.color)}"` : ''}>
    <button type="button" class="mc-carpeta-abrir" data-abrir="${escapeHtml(c.id)}">
      <span class="mc-carpeta-icono" aria-hidden="true">${escapeHtml(c.emoji || '')}</span>
      <span class="mc-carpeta-nombre">${escapeHtml(c.nombre)}</span>
      <span class="mc-carpeta-pie">${escapeHtml(pie)}</span>
    </button>
    <button type="button" class="mc-carpeta-editar" data-editar-carpeta="${escapeHtml(c.id)}" aria-label="Opciones de ${escapeHtml(c.nombre)}">···</button>
  </article>`
}

export function rejillaHtml(arbol, resumen) {
  if (!arbol.length) {
    return '<p class="empty-state">Todavía no tienes carpetas. Crea una para ordenar tu colección como quieras: por serie, por lo que te falta, por lo que das.</p>'
  }
  return `<div class="mc-carpetas">${arbol.map((c) => tarjetaHtml(c, resumen)).join('')}</div>`
}
