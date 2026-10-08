// LO QUE VALEN TUS PRODUCTOS SELLADOS (769): la cuenta del Panel y de la
// portada (la 766, PR2), aparte de la pestaña. Vivía en
// js/mi-coleccion/productos.js, y la portada lo importaba desde allí: con él
// se traía el MOLDE de las tarjetas de producto, cuyas clases son de
// css/mi-coleccion.css, que la portada no carga (lo cantó la 299). Aquí no
// se pinta nada: se pide y se suma.
import { supabase } from './supabase.js'
import { valorDeProductos } from './productos.js'

export async function misProductos(userId) {
  if (!userId) return []
  const { data, error } = await supabase.from('user_products').select('id,product_id,cantidad,pagado').eq('user_id', userId)
  if (error) return null
  return data || []
}

// Con `*`: las columnas por país (769) son de una migración que puede no
// estar, y pedirlas por su nombre haría fallar la consulta ENTERA (la 624).
export async function productosPorIds(ids) {
  const unicos = [...new Set(ids)].filter((x) => x != null)
  const mapa = new Map()
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await supabase.from('tcg_products').select('*').in('id', unicos.slice(i, i + 150))
    if (error) throw error
    for (const f of data || []) mapa.set(f.id, f)
  }
  return mapa
}

// Lo que valen, aparte de las cartas. `null` si no se sabe (sin migración).
export async function valorParaElPanel(userId) {
  const lista = await misProductos(userId)
  if (!lista?.length) return lista ? { total: 0, sinPrecio: 0, unidades: 0 } : null
  const porId = await productosPorIds(lista.map((m) => m.product_id)).catch(() => null)
  if (!porId) return null
  return valorDeProductos(lista, porId)
}
