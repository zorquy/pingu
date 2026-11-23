// Lo que el servidor ya sabe del color de las ilustraciones (tanda 1419):
// `tcg_card_colores`, que rellena la función `colores-cartas` con la foto
// grande y que el equipo corrige en /admin. Fuera de armonia.js porque esto
// habla con Supabase y aquél es puro (lo importan el servidor y las pruebas).
//
// Sin la migración 1419 la consulta falla: se devuelve un Map vacío y la web
// lee las fotos en el navegador, como antes. Nunca rompe la pantalla.
import { supabase } from '../supabase.js'

const TRAMO = 150
const clave = (c) => `${c.id}|${c.market || 'WEST'}`

async function pedir(cartas, columnas, filtro = null) {
  const out = []
  const porMercado = new Map()
  for (const c of cartas) {
    const m = c.market || 'WEST'
    if (!porMercado.has(m)) porMercado.set(m, [])
    porMercado.get(m).push(c.id)
  }
  for (const [market, ids] of porMercado) {
    for (let i = 0; i < ids.length; i += TRAMO) {
      let q = supabase.from('tcg_card_colores').select(columnas).eq('market', market).in('card_id', ids.slice(i, i + TRAMO))
      if (filtro) q = filtro(q)
      const { data, error } = await q
      if (error) return null
      out.push(...(data || []))
    }
  }
  return out
}

// Las huellas ya calculadas: Map id → huella (las que no tienen, fuera).
export async function huellasDelServidor(cartas) {
  const filas = await pedir(cartas || [], 'card_id,market,huella', (q) => q.not('huella', 'is', null))
  const quiero = new Set((cartas || []).map(clave))
  return new Map((filas || []).filter((f) => f.huella && quiero.has(`${f.card_id}|${f.market || 'WEST'}`)).map((f) => [f.card_id, f.huella]))
}

// Las correcciones del equipo: Map id → grupo. Se piden SIEMPRE (no se
// guardan en el navegador): una corrección nueva se ve la próxima vez.
export async function coloresDelEquipo(cartas) {
  const filas = await pedir(cartas || [], 'card_id,market,color_admin', (q) => q.not('color_admin', 'is', null))
  return new Map((filas || []).map((f) => [f.card_id, f.color_admin]))
}
