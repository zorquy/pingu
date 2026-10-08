// LA PESTAÑA «PRODUCTOS» DE MI COLECCIÓN (762, PR1 y PR2 de la ronda 3).
//
// PINGU: «yo metería una nueva pestaña en Mi colección que sea productos…
// la API se trae productos por expansiones; lo agregaría a Mi colección
// porque puedes agregar desde ahí». Arriba, TUS productos con lo que valen;
// debajo, el catálogo de una expansión (las que están por salir también:
// preventa) con su foto, el mínimo en España, la media de 30 días, el tipo
// y el «+» (o «×N» con su − y su +).
//
// Entra por `import()` al abrir la pestaña. Las tablas son de
// supabase-migration-productos.sql y las llena `tcggo-productos`; sin la
// migración la pestaña lo DICE («no se sabe»), no enseña «no hay» (la 510).
import { supabase } from '../supabase.js'
import { escapeHtml } from '../html.js'
import { showToast } from '../toast.js'
import { TIPOS, OTRO, nombreDeTipo, precioDeProducto, esPreventa, valorDeProductos } from '../productos.js'
import { nombreDeSet } from '../catalogo-series.js'

const $ = (id) => document.getElementById(id)
export const COLUMNAS = 'id,episode_id,lang,name,tipo,image,cardmarket_id,tcggo_url,cm_lowest,cm_lowest_eu,cm_lowest_es,cm_avg30,release_date'
const euros = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

let ctx = null
let mios = null // Map product_id → { id, product_id, cantidad }; null = no se sabe
let fichas = new Map() // product_id → fila de tcg_products
let episodiosConProductos = null
let episodio = null
let tipo = ''
let montado = false

// ── La base ──
export async function misProductos(userId) {
  if (!userId) return []
  const { data, error } = await supabase.from('user_products').select('id,product_id,cantidad,pagado').eq('user_id', userId)
  if (error) return null
  return data || []
}
export async function productosPorIds(ids) {
  const unicos = [...new Set(ids)].filter((x) => x != null)
  const mapa = new Map()
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await supabase.from('tcg_products').select(COLUMNAS).in('id', unicos.slice(i, i + 150))
    if (error) throw error
    for (const f of data || []) mapa.set(f.id, f)
  }
  return mapa
}

// Lo de tus productos para el Panel (PR2): lo que valen, aparte de las
// cartas. `null` si no se sabe (sin migración o sin sesión).
export async function valorParaElPanel(userId) {
  const lista = await misProductos(userId)
  if (!lista?.length) return lista ? { total: 0, sinPrecio: 0, unidades: 0 } : null
  const porId = await productosPorIds(lista.map((m) => m.product_id)).catch(() => null)
  if (!porId) return null
  return valorDeProductos(lista, porId)
}

// ── Pintar ──
function precioHtml(f) {
  const p = precioDeProducto(f)
  if (!p) return '<span class="mc-prod-precio mc-prod-sin">Sin precio todavía</span>'
  return `<span class="mc-prod-precio">${escapeHtml(euros(p.valor))} <small>mín. ${escapeHtml(p.donde)}</small></span>`
}

export function tarjetaDeProductoHtml(f, cantidad = 0, { conMando = true } = {}) {
  const media = f.cm_avg30 != null ? `<span class="mc-prod-media">Media 30 días: ${escapeHtml(euros(f.cm_avg30))}</span>` : ''
  const mando = !conMando
    ? ''
    : cantidad
      ? `<span class="mc-prod-mando"><button type="button" class="mc-prod-boton" data-prod-menos="${f.id}" aria-label="Quitar uno de ${escapeHtml(f.name)}">−</button><b class="mc-prod-cuantos" aria-label="Tienes ${cantidad}">×${cantidad}</b><button type="button" class="mc-prod-boton" data-prod-mas="${f.id}" aria-label="Añadir otro de ${escapeHtml(f.name)}">+</button></span>`
      : `<span class="mc-prod-mando"><button type="button" class="mc-prod-anadir" data-prod-mas="${f.id}" aria-label="Añadir ${escapeHtml(f.name)} a tu colección">+ Añadir</button></span>`
  return `<article class="mc-prod${cantidad ? ' tengo' : ''}" data-prod="${f.id}">
    <span class="mc-prod-foto">${f.image ? `<img src="${escapeHtml(f.image)}" alt="" width="240" height="240" loading="lazy" onerror="this.remove()" />` : ''}</span>
    <span class="mc-prod-chapas"><span class="mc-prod-tipo">${escapeHtml(nombreDeTipo(f.tipo))}</span>${esPreventa(f) ? '<span class="mc-prod-preventa">Preventa</span>' : ''}</span>
    <b class="mc-prod-nombre">${escapeHtml(f.name)}</b>
    ${precioHtml(f)}
    ${media}
    ${mando}
  </article>`
}

function pintarTuyos() {
  const caja = $('mcProdTuyos')
  if (!caja) return
  if (mios === null) {
    caja.innerHTML = '<p class="mc-nota">Los productos todavía no están activados en la base. En cuanto lo estén, aquí verás los tuyos y lo que valen.</p>'
    return
  }
  const lista = [...mios.values()].filter((m) => fichas.has(m.product_id))
  if (!lista.length) {
    caja.innerHTML = '<p class="mc-nota">Todavía no tienes productos. Elige una expansión abajo y toca «+ Añadir» en los que tengas.</p>'
    return
  }
  const v = valorDeProductos(lista, fichas)
  caja.innerHTML = `<div class="mc-prod-cabecera">
      <h2 class="mc-subtitulo">Tus productos</h2>
      <p class="mc-prod-valor"><b>${escapeHtml(euros(v.total))}</b> · ${v.unidades} ${v.unidades === 1 ? 'producto' : 'productos'}${v.sinPrecio ? ` · ${v.sinPrecio} sin precio` : ''}</p>
    </div>
    <div class="mc-prod-rejilla">${lista.map((m) => tarjetaDeProductoHtml(fichas.get(m.product_id), m.cantidad)).join('')}</div>`
}

async function pintarCatalogo() {
  const caja = $('mcProdRejilla')
  if (!caja || episodio == null) return
  caja.innerHTML = '<div class="skeleton" style="height:240px"></div>'
  const { data, error } = await supabase.from('tcg_products').select(COLUMNAS).eq('episode_id', episodio).order('name').limit(500)
  if (error) {
    caja.innerHTML = '<p class="empty-state">No se han podido leer los productos. Prueba otra vez en un rato.</p>'
    return
  }
  for (const f of data || []) fichas.set(f.id, f)
  const hay = new Set((data || []).map((f) => f.tipo || OTRO.id))
  const chips = [{ id: '', nombre: 'Todo' }, ...TIPOS, OTRO].filter((t) => t.id === '' || hay.has(t.id))
  if (tipo && !hay.has(tipo)) tipo = ''
  $('mcProdTipos').innerHTML = chips.map((t) => `<button type="button" class="chip-filtro${t.id === tipo ? ' activa' : ''}" data-prod-tipo="${t.id}" aria-pressed="${t.id === tipo}">${escapeHtml(t.nombre)}</button>`).join('')
  const lista = (data || []).filter((f) => !tipo || (f.tipo || OTRO.id) === tipo)
  caja.innerHTML = lista.length
    ? lista.map((f) => tarjetaDeProductoHtml(f, mios?.get(f.id)?.cantidad || 0, { conMando: mios !== null })).join('')
    : '<p class="empty-state">Todavía no hay productos de esta expansión.</p>'
}

async function pintarSelector() {
  const sel = $('mcProdSet')
  if (!sel) return false
  if (episodiosConProductos === null) {
    const { data, error } = await supabase.from('tcg_products').select('episode_id').limit(10000)
    if (error) {
      $('mcProdRejilla').innerHTML = '<p class="empty-state">Los productos todavía no están activados en la base.</p>'
      sel.classList.add('hidden')
      return false
    }
    episodiosConProductos = new Set((data || []).map((f) => f.episode_id))
  }
  // Una opción por expansión de TCGGO que tenga productos: la más nueva
  // arriba (las de preventa también), con el nombre de NUESTRO set.
  // Los sets se piden aquí y no con `ctx.sets()`: esa lista deja fuera los
  // ESCONDIDOS, y una expansión anunciada (la 756) está escondida hasta que
  // salen sus cartas — justo la de los productos en preventa.
  const { data: sets } = await supabase.from('tcg_sets').select('id,market,name,name_en,tcggo_id,release_date,card_count_total').eq('market', ctx.mercado).not('tcggo_id', 'is', null).limit(2000)
  const porEpisodio = new Map()
  for (const s of sets || []) {
    const id = Number(s.tcggo_id)
    if (!episodiosConProductos.has(id)) continue
    const ya = porEpisodio.get(id)
    if (!ya || Number(s.card_count_total || 0) > Number(ya.card_count_total || 0)) porEpisodio.set(id, s)
  }
  const opciones = [...porEpisodio.entries()].sort((a, b) => String(b[1].release_date || '').localeCompare(String(a[1].release_date || '')))
  if (!opciones.length) {
    sel.classList.add('hidden')
    $('mcProdRejilla').innerHTML = '<p class="empty-state">Todavía no hay productos de las expansiones de este catálogo.</p>'
    return false
  }
  if (episodio == null || !porEpisodio.has(episodio)) episodio = opciones[0][0]
  sel.classList.remove('hidden')
  sel.innerHTML = opciones.map(([id, s]) => `<option value="${id}"${id === episodio ? ' selected' : ''}>${escapeHtml(nombreDeSet(s) || s.id)}${s.release_date && String(s.release_date) > new Date().toISOString().slice(0, 10) ? ' (preventa)' : ''}</option>`).join('')
  return true
}

async function cambiarCantidad(id, paso) {
  if (!ctx.sesion) return showToast('Entra con tu cuenta para apuntar tus productos.', 'error')
  const ahora = mios?.get(id)
  const nueva = (ahora?.cantidad || 0) + paso
  try {
    if (nueva <= 0) {
      const { error } = await supabase.from('user_products').delete().eq('product_id', id).eq('user_id', ctx.sesion.user.id)
      if (error) throw error
      mios.delete(id)
    } else {
      // El upsert lleva TODA la fila que insertaría (la 526).
      const { data, error } = await supabase.from('user_products').upsert({ user_id: ctx.sesion.user.id, product_id: id, cantidad: nueva }, { onConflict: 'user_id,product_id' }).select('id,product_id,cantidad,pagado').single()
      if (error) throw error
      if (!data) throw new Error('No se ha podido guardar.')
      mios.set(id, data)
    }
  } catch (err) {
    return showToast(err.message || 'No se ha podido guardar.', 'error')
  }
  pintarTuyos()
  // Se repinta la tarjeta del catálogo que se ha tocado, sin volver a pedir.
  const f = fichas.get(id)
  const tarjeta = $('mcProdRejilla')?.querySelector(`[data-prod="${id}"]`)
  if (f && tarjeta) tarjeta.outerHTML = tarjetaDeProductoHtml(f, mios.get(id)?.cantidad || 0)
}

export async function abrir(contexto) {
  ctx = contexto
  if (!montado) {
    montado = true
    $('mcPanelProductos').addEventListener('click', (e) => {
      const mas = e.target.closest('[data-prod-mas]')
      if (mas) return void cambiarCantidad(Number(mas.dataset.prodMas), 1)
      const menos = e.target.closest('[data-prod-menos]')
      if (menos) return void cambiarCantidad(Number(menos.dataset.prodMenos), -1)
      const t = e.target.closest('[data-prod-tipo]')
      if (t) {
        tipo = t.dataset.prodTipo
        void pintarCatalogo()
      }
    })
    $('mcProdSet').addEventListener('change', (e) => {
      episodio = Number(e.target.value)
      tipo = ''
      void pintarCatalogo()
    })
  }
  const lista = ctx.sesion ? await misProductos(ctx.sesion.user.id) : []
  mios = lista ? new Map(lista.map((m) => [m.product_id, m])) : null
  if (mios?.size) {
    try {
      for (const [id, f] of await productosPorIds([...mios.keys()])) fichas.set(id, f)
    } catch { /* sin fichas, lo tuyo sale cuando lleguen */ }
  }
  pintarTuyos()
  if (await pintarSelector()) await pintarCatalogo()
}
