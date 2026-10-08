// LO QUE SALE CON LA PRÓXIMA EXPANSIÓN (762, Z1 de la ronda 3): sus
// productos —sobres, cajas, ETB…— con su foto, el tipo y el mínimo en
// España, debajo de «El siguiente set». Llega por `import()` después de
// pintar el calendario, y sin productos (o sin la migración) no se pinta
// nada: el calendario no depende de esto.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { nombreDeTipo, precioDeProducto, esPreventa, TIPOS } from './productos.js'

const euros = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
// Primero lo que se compra más: cajas y ETB delante, sobres sueltos detrás.
const ORDEN = new Map(TIPOS.map((t, i) => [t.id, i]))

export async function montarProductos(siguiente, doc = document) {
  if (!siguiente?.tcggo) return
  const { data, error } = await supabase
    .from('tcg_products')
    .select('id,name,tipo,image,cm_lowest,cm_lowest_eu,cm_lowest_es,cm_avg30,release_date')
    .eq('episode_id', siguiente.tcggo)
    .limit(60)
  if (error || !data?.length) return
  const lista = [...data].sort((a, b) => (ORDEN.get(a.tipo) ?? 99) - (ORDEN.get(b.tipo) ?? 99) || String(a.name).localeCompare(String(b.name)))
  const caja = doc.createElement('section')
  caja.className = 'lanz-productos'
  caja.id = 'lanzProductos'
  caja.innerHTML = `<h2 class="section-title">Lo que sale con ${escapeHtml(siguiente.nombre)}</h2>
    <div class="lanz-productos-lista">${lista.map((f) => {
      const p = precioDeProducto(f)
      return `<article class="lanz-producto">
        <span class="lanz-producto-foto">${f.image ? `<img src="${escapeHtml(f.image)}" alt="" width="160" height="160" loading="lazy" onerror="this.remove()" />` : ''}</span>
        <span class="lanz-producto-tipo">${escapeHtml(nombreDeTipo(f.tipo))}${esPreventa(f) ? ' · preventa' : ''}</span>
        <b class="lanz-producto-nombre">${escapeHtml(f.name)}</b>
        <span class="lanz-producto-precio">${p ? `${escapeHtml(euros(p.valor))} <small>mín. ${escapeHtml(p.donde)}</small>` : '<small>Sin precio todavía</small>'}</span>
      </article>`
    }).join('')}</div>
    <p class="subtext"><a href="/mi-coleccion?ver=productos">Apúntalos en tu colección</a></p>`
  doc.getElementById('lanzProductos')?.remove()
  doc.getElementById('proximoDestacado')?.after(caja)
}
