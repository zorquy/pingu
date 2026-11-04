// LOS SOBRES DEL CARTEL (762, Z1; desde la 1217 SOLO los sobres): la lista
// «Lo que sale con…» debajo del cartel se fue (PINGU: «ocupa demasiada
// pantalla»; los productos están en Colección → Productos). De los productos
// de la próxima expansión salen las dos fotos que van junto a la cuenta
// atrás. Llega por `import()`; sin productos, el cartel va sin sobres.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { TIPOS } from './productos.js'

// Primero lo que se compra más: cajas y ETB delante, sobres sueltos detrás.
const ORDEN = new Map(TIPOS.map((t, i) => [t.id, i]))

export async function montarProductos(siguiente, doc = document) {
  if (!siguiente?.tcggo) return
  const columnas = 'id,name,tipo,image,cm_lowest,cm_lowest_eu,cm_lowest_es,cm_avg30,release_date'
  const pedir = (conMercado) => {
    let q = supabase.from('tcg_products').select(columnas).eq('episode_id', siguiente.tcggo)
    if (conMercado) q = q.eq('market', siguiente.mercado || 'WEST')
    return q.limit(60)
  }
  // Por catálogo (808): el id de expansión japonés de TCGGO no es el
  // occidental. Sin la columna todavía, lo de antes, que era occidental.
  let { data, error } = await pedir(true)
  if (error && (error.code === '42703' || /market/.test(error.message || '')) && (siguiente.mercado || 'WEST') === 'WEST') ({ data, error } = await pedir(false))
  if (error || !data?.length) return
  const lista = [...data].sort((a, b) => (ORDEN.get(a.tipo) ?? 99) - (ORDEN.get(b.tipo) ?? 99) || String(a.name).localeCompare(String(b.name)))
  doc.getElementById('lanzProductos')?.remove()
  // Los sobres del set AL LADO de la cuenta atrás (1216, la propuesta del
  // repaso): dos fotos, primero un sobre y luego lo que más se compra.
  const dest = doc.querySelector('#proximoDestacado .lanzamiento-destacado')
  const conFoto = lista.filter((f) => f.image)
  const sobre = conFoto.find((f) => f.tipo === 'sobre')
  const dos = [...(sobre ? [sobre] : []), ...conFoto.filter((f) => f !== sobre)].slice(0, 2)
  if (dest && dos.length) {
    dest.querySelector('.lanz-dest-sobres')?.remove()
    const sobres = doc.createElement('span')
    sobres.className = 'lanz-dest-sobres'
    sobres.setAttribute('aria-hidden', 'true')
    sobres.innerHTML = dos.map((f) => `<img src="${escapeHtml(f.image)}" alt="" width="96" height="128" loading="lazy" onerror="this.remove()" />`).join('')
    dest.append(sobres)
  }
}
