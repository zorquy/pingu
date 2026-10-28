// LA PESTAÑA «PRODUCTOS» DE MI COLECCIÓN (762, PR1 y PR2 de la ronda 3;
// rehecha en la 769).
//
// PINGU, en la 762: «una nueva pestaña en Mi colección que sea productos…
// la API se trae productos por expansiones». Y en la 769: «debería ser lo
// mismo que cuando buscas una expansión: que se te abran los productos por
// set, diferenciando entre occidental y japonés; y si clicas en la imagen o
// en el texto, que te abra igual que una carta, en un lateral en el PC y el
// pop-up en el móvil, con toda la info: el precio, el gráfico, el link
// directo a Cardmarket y TCGplayer».
//
// Así que son tres cosas, como Expansiones:
//   · LA ESTANTERÍA: arriba tus productos (por expansión), y debajo una
//     baldosa por expansión con productos —logo, fecha o «preventa», cuántos
//     hay y cuántos tienes—, del catálogo que elijas (Pokémon / Pokémon Japón).
//   · UNA EXPANSIÓN: su cabecera con el logo, los tipos y la rejilla.
//   · LA FICHA de un producto (`#mcProdFicha`): foto, lo que vale en cada
//     sitio, las medias, los botones a Cardmarket y TCGplayer, su gráfica
//     (la de las cartas, `js/carta-historial.js`, con la función
//     `tcggo-historial-producto`) y tu «+». Al lado en un PC ancho, en
//     ventana si no — la regla de la ficha de las cartas (la 740).
//
// Entra por `import()` al abrir la pestaña. Las tablas son de
// supabase-migration-productos.sql (y la 769) y las llena `tcggo-productos`;
// sin la migración la pestaña lo DICE («no se sabe»), no enseña «no hay».
import { supabase } from '../supabase.js'
import { hojaInyectada } from '../hoja.js'
import { escapeHtml } from '../html.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { marcaCardmarket } from '../cardmarket-marca.js'
import { banderaHtml } from '../precio-vista.js'
import { TIPOS, OTRO, nombreDeTipo, tipoDeProducto, precioDeProducto, esPreventa, valorDeProductos, preciosPorIdioma, enlaceCardmarketDeProducto, enlaceTcgplayerDeProducto, idiomasDeProducto, nombreDeIdioma, precioDeProductoEnIdioma, cuentaDelPack, porUnidad, relacionConPvp } from '../productos.js'
import { nombreDeSet } from '../catalogo-series.js'
import { misProductos, productosPorIds, buscarProductos } from '../productos-valor.js'
import { esStockDeTienda } from './datos.js'

const $ = (id) => document.getElementById(id)
// Con `*` (769): las columnas por país son de una migración que puede no
// estar todavía, y pedirlas por su nombre haría fallar la consulta ENTERA
// (la 624). Con `*` llega lo que haya.
export const COLUMNAS = '*'
const euros = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
// Al lado, como la ficha de una expansión (740): con ratón y sitio.
export const CONSULTA_AL_LADO = '(min-width: 1400px) and (pointer: fine)'

let ctx = null
// Tus líneas (969: una por producto e IDIOMA, como las copias de una carta);
// null = no se sabe (sin migración).
let mios = null
const copiasDe = (id) => (mios || []).filter((m) => m.product_id === id)
const cuantosDe = (id) => copiasDe(id).reduce((n, m) => n + (Number(m.cantidad) || 0), 0)
const CLAVE_IDIOMA = 'pokedoc-prod-idioma'
const tienesN = (n) => (esStockDeTienda() ? `${n} en stock` : `Tienes ${n}`)
let fichas = new Map() // product_id → fila de tcg_products
let cuentaPorEpisodio = null // episode_id → cuántos productos; null = sin migración
const cuentasPorCatalogo = new Map() // 'WEST' | 'JP' → su cuentaPorEpisodio (808)
let setsPorEpisodio = new Map() // episode_id → nuestro set (con su logo)
let episodio = null // la expansión abierta, o null en la estantería
let tipo = ''
let catalogo = null // 'WEST' | 'JP'; null = el de la página
let montado = false
let abiertoEnFicha = null
let primeraVez = true
let busqueda = '' // lo escrito en el buscador de la pestaña (968)
let busquedaVersion = 0
// Lo que TCGGO no cuelga de ninguna expansión nuestra (968): las latas de
// Mega Charizard X e Y van en su episodio «Pokémon». Una baldosa para todas.
export const ESPECIALES = 'especiales'
const episodiosSinSet = () => [...(cuentaPorEpisodio?.keys() || [])].filter((ep) => !setsPorEpisodio.has(ep))
const esEspecial = (ep) => ep === ESPECIALES

// ── La base ──
// La cuenta de lo tuyo vive en js/productos-valor.js (769): la usan también
// el Panel y la portada, que no pintan tarjetas.
export { misProductos, productosPorIds, valorParaElPanel } from '../productos-valor.js'

// ── Pintar ──
function precioHtml(f) {
  const p = precioDeProducto(f)
  if (!p) return '<span class="mc-prod-precio mc-prod-sin">Sin precio todavía</span>'
  return `<span class="mc-prod-precio">${escapeHtml(euros(p.valor))} <small>mín. ${escapeHtml(p.donde)}</small></span>`
}

// Lo que tienes, a la vista sobre la foto (766, PR1): ✓ si es uno, «×2» si
// son más. El − y el + de debajo siguen siendo el mando.
export function marcaDeTenerlo(cantidad) {
  const n = Number(cantidad) || 0
  if (n <= 0) return ''
  return `<span class="mc-prod-tengo" role="img" aria-label="${n === 1 ? 'Lo tienes' : `Tienes ${n}`}">${n === 1 ? '✓' : `×${n}`}</span>`
}

const fechaLarga = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
const hoyISO = () => new Date().toISOString().slice(0, 10)

function logoHtml(s, ancho = 120, alto = 48) {
  const logos = s && ctx?.logosDeSet ? ctx.logosDeSet(s) : []
  return logos.length ? `<img src="${escapeHtml(logos[0])}" alt="" width="${ancho}" height="${alto}" loading="lazy" onerror="this.remove()" />` : ''
}

// La cabecera de una expansión: su logo (si lo hay) y su nombre.
function cabezaDeSetHtml(s, extra = '') {
  if (!s) return ''
  return `<span class="mc-prod-set-logo">${logoHtml(s)}</span>
    <span class="mc-prod-set-texto"><b>${escapeHtml(nombreDeSet(s) || s.id)}</b>${extra ? `<small>${extra}</small>` : ''}</span>`
}

// El − y el + de UNA línea, con la bandera de su idioma (969).
function mandoDeLineaHtml(f, m, { conNombre = false } = {}) {
  const idioma = m.idioma || ''
  const n = Number(m.cantidad) || 0
  const nombre = idioma ? ` en ${nombreDeIdioma(idioma).toLowerCase()}` : ''
  const rotulo = idioma ? (conNombre ? `<span class="mc-prodf-idioma">${banderaHtml(idioma)}${escapeHtml(nombreDeIdioma(idioma))}</span>` : banderaHtml(idioma)) : ''
  return `<span class="mc-prod-mando"${idioma ? ` data-idioma-linea="${escapeHtml(idioma)}"` : ''}>${rotulo}<button type="button" class="mc-prod-boton" data-prod-menos="${f.id}" data-idioma="${escapeHtml(idioma)}" aria-label="Quitar uno de ${escapeHtml(f.name)}${nombre}">−</button><b class="mc-prod-cuantos" aria-label="Tienes ${n}${nombre}">×${n}</b><button type="button" class="mc-prod-boton" data-prod-mas="${f.id}" data-idioma="${escapeHtml(idioma)}" aria-label="Añadir otro de ${escapeHtml(f.name)}${nombre}">+</button></span>`
}

// Sin copias, «+ Añadir» (que pregunta el idioma); con las de un idioma, su
// − y su +; con varios idiomas, «Tus copias» abre la ficha, donde va cada uno.
function mandoHtml(f, copias = copiasDe(f.id)) {
  if (!copias.length) return `<span class="mc-prod-mando"><button type="button" class="mc-prod-anadir" data-prod-anadir="${f.id}" aria-label="Añadir ${escapeHtml(f.name)} a tu colección">+ Añadir</button></span>`
  if (copias.length === 1) return mandoDeLineaHtml(f, copias[0])
  const n = copias.reduce((t, m) => t + (Number(m.cantidad) || 0), 0)
  return `<span class="mc-prod-mando"><button type="button" class="mc-prod-anadir" data-prod-ficha="${f.id}" aria-label="Tus copias de ${escapeHtml(f.name)}: ${n}">Tus copias · ${n}</button></span>`
}

// La foto y el nombre ABREN la ficha (769): son un botón, el «+» va aparte.
export function tarjetaDeProductoHtml(f, cantidad = cuantosDe(f.id), { conMando = true } = {}) {
  const media = f.cm_avg30 != null ? `<span class="mc-prod-media">Media 30 días: ${escapeHtml(euros(f.cm_avg30))}</span>` : ''
  return `<article class="mc-prod${cantidad ? ' tengo' : ''}" data-prod="${f.id}">
    <button type="button" class="mc-prod-abrir" data-prod-ficha="${f.id}" aria-label="Ver la ficha de ${escapeHtml(f.name)}">
      <span class="mc-prod-foto">${f.image ? `<img src="${escapeHtml(f.image)}" alt="" width="240" height="240" loading="lazy" onerror="this.remove()" />` : ''}${marcaDeTenerlo(cantidad)}</span>
      <span class="mc-prod-chapas"><span class="mc-prod-tipo">${escapeHtml(nombreDeTipo(f.tipo))}</span>${esPreventa(f) ? '<span class="mc-prod-preventa">Preventa</span>' : ''}</span>
      <b class="mc-prod-nombre">${escapeHtml(f.name)}</b>
      ${precioHtml(f)}
      ${media}
    </button>
    ${conMando ? mandoHtml(f) : ''}
  </article>`
}

function pintarTuyos() {
  const caja = $('mcProdTuyos')
  if (!caja) return
  // En una tienda (1076, PINGU: «que no aparezcan arriba, no tiene mucho
  // sentido»): lo suyo vive en el Stock. Aquí, una franja que lo cuenta y
  // lleva allí; la estantería de debajo dice «N en stock» en cada expansión.
  if (esStockDeTienda()) {
    const n = (mios || []).reduce((t, m) => t + (Number(m.cantidad) || 0), 0)
    caja.innerHTML = n
      ? `<a class="mc-prod-enstock" href="/tienda?ver=stock&filtro=sellado">${icons.package(20)}<span><b>${n} ${n === 1 ? 'producto sellado' : 'productos sellados'}</b> en tu stock</span><span class="mc-prod-enstock-ir">Ver en el stock</span></a>`
      : ''
    return
  }
  if (mios === null) {
    caja.innerHTML = '<p class="mc-nota">Los productos todavía no están activados en la base. En cuanto lo estén, aquí verás los tuyos y lo que valen.</p>'
    return
  }
  const lista = mios.filter((m) => fichas.has(m.product_id) && mercadoDe(fichas.get(m.product_id)) === catalogoActual())
  if (!lista.length) {
    // Sin el «Todavía no tienes productos…» (1038, PINGU: «las letras y el
    // título los quitaría»): la estantería de debajo ya lleva su «+ Añadir».
    caja.innerHTML = ''
    return
  }
  const v = valorDeProductos(lista, fichas)
  caja.innerHTML = `<div class="mc-prod-cabecera">
      <h2 class="mc-subtitulo">Tus productos</h2>
      <p class="mc-prod-valor"><b>${escapeHtml(euros(v.total))}</b> · ${v.unidades} ${v.unidades === 1 ? 'producto' : 'productos'}${v.sinPrecio ? ` · ${v.sinPrecio} sin precio` : ''}</p>
    </div>
    ${gruposDeTuyos(lista).map((g) => `${g.set ? `<div class="mc-prod-set">${cabezaDeSetHtml(g.set)}</div>` : g.especial ? `<div class="mc-prod-set">${cabezaDeEspecialesHtml()}</div>` : ''}<div class="mc-prod-rejilla">${[...new Set(g.lista.map((m) => m.product_id))].map((id) => tarjetaDeProductoHtml(fichas.get(id))).join('')}</div>`).join('')}`
}

// Tus productos, por expansión (766, PR1): la más nueva primero.
function gruposDeTuyos(lista) {
  const grupos = new Map()
  for (const m of lista) {
    const f = fichas.get(m.product_id)
    // Un producto del OTRO catálogo no es de un set de este (808).
    const ep = setsPorEpisodio.has(Number(f?.episode_id)) ? Number(f.episode_id) : ESPECIALES
    if (!grupos.has(ep)) grupos.set(ep, { set: setsPorEpisodio.get(ep) || null, especial: esEspecial(ep), lista: [] })
    grupos.get(ep).lista.push(m)
  }
  // Los especiales, detrás de las expansiones.
  return [...grupos.values()].sort((a, b) => (a.set ? 0 : 1) - (b.set ? 0 : 1) || String(b.set?.release_date || '').localeCompare(String(a.set?.release_date || '')))
}

// Cuántos de los tuyos son de una expansión (para su baldosa).
function tuyosDe(ep) {
  let n = 0
  for (const m of mios || []) {
    const f = fichas.get(m.product_id)
    if (f && mercadoDe(f) === catalogoActual() && Number(f.episode_id) === Number(ep)) n += Number(m.cantidad) || 0
  }
  return n
}

// ── La estantería (769) ──
function baldosaHtml(ep, s) {
  const n = cuentaPorEpisodio?.get(ep) || 0
  const tengo = tuyosDe(ep)
  const preventa = s.release_date && String(s.release_date) > hoyISO()
  return `<button type="button" class="mc-prod-baldosa" data-prod-set="${ep}" aria-label="${escapeHtml(`${nombreDeSet(s) || s.id}: ${n} productos`)}">
    <span class="mc-prod-baldosa-logo">${logoHtml(s, 160, 64) || `<b>${escapeHtml(nombreDeSet(s) || s.id)}</b>`}</span>
    <span class="mc-prod-baldosa-texto"><b>${escapeHtml(nombreDeSet(s) || s.id)}</b><small>${escapeHtml([preventa ? `Sale el ${fechaLarga(s.release_date)}` : fechaLarga(s.release_date), `${n} ${n === 1 ? 'producto' : 'productos'}`].filter(Boolean).join(' · '))}</small></span>
    ${preventa ? '<span class="mc-prod-preventa">Preventa</span>' : ''}
    ${tengo ? `<span class="mc-prod-baldosa-tuyos">${tienesN(tengo)}</span>` : ''}
  </button>`
}

// La de los productos especiales (968): la primera, para que se encuentre
// (Sergio buscó las latas y no las vio), con su icono en vez de un logo.
function baldosaEspecialesHtml() {
  const eps = episodiosSinSet()
  if (!eps.length) return ''
  const n = eps.reduce((t, ep) => t + (cuentaPorEpisodio.get(ep) || 0), 0)
  const tengo = eps.reduce((t, ep) => t + tuyosDe(ep), 0)
  return `<button type="button" class="mc-prod-baldosa mc-prod-baldosa-especial" data-prod-set="${ESPECIALES}" aria-label="${escapeHtml(`Productos especiales: ${n} productos`)}">
    <span class="mc-prod-baldosa-logo" aria-hidden="true">${icons.package(40)}</span>
    <span class="mc-prod-baldosa-texto"><b>Productos especiales</b><small>${escapeHtml(`De ninguna expansión: latas, colecciones… · ${n} ${n === 1 ? 'producto' : 'productos'}`)}</small></span>
    ${tengo ? `<span class="mc-prod-baldosa-tuyos">${tienesN(tengo)}</span>` : ''}
  </button>`
}

function cabezaDeEspecialesHtml(extra = 'De ninguna expansión: latas, colecciones…') {
  return `<span class="mc-prod-set-logo mc-prod-especial-icono" aria-hidden="true">${icons.package(32)}</span>
    <span class="mc-prod-set-texto"><b>Productos especiales</b>${extra ? `<small>${escapeHtml(extra)}</small>` : ''}</span>`
}

function pintarEstante() {
  $('mcProdEstante')?.classList.toggle('hidden', episodio != null)
  $('mcProdSetVista')?.classList.toggle('hidden', episodio == null)
  pintarCatalogoBotones()
  const caja = $('mcProdSets')
  if (!caja) return
  if (cuentaPorEpisodio === null) {
    caja.innerHTML = '<p class="empty-state">Los productos todavía no están activados en la base.</p>'
    return
  }
  const lista = [...setsPorEpisodio.entries()].filter(([ep]) => cuentaPorEpisodio.has(ep)).sort((a, b) => String(b[1].release_date || '').localeCompare(String(a[1].release_date || '')))
  const especiales = baldosaEspecialesHtml()
  caja.innerHTML = lista.length || especiales
    ? especiales + lista.map(([ep, s]) => baldosaHtml(ep, s)).join('')
    : `<p class="empty-state">Todavía no hay productos de las expansiones de ${catalogoActual() === 'JP' ? 'Pokémon Japón' : 'este catálogo'}.</p>`
}

function pintarCatalogoBotones() {
  for (const b of document.querySelectorAll('[data-prod-mercado]')) b.setAttribute('aria-pressed', String(b.dataset.prodMercado === catalogoActual()))
}
const catalogoActual = () => catalogo || (ctx?.mercado === 'JP' ? 'JP' : 'WEST')

// ── Una expansión ──
async function pintarCatalogo() {
  pintarEstante()
  const caja = $('mcProdRejilla')
  if (!caja || episodio == null) return
  caja.innerHTML = '<div class="skeleton" style="height:240px"></div>'
  const { data, error } = esEspecial(episodio)
    ? await productosDeEpisodios(supabase, episodiosSinSet(), catalogoActual())
    : await productosDeExpansion(supabase, episodio, catalogoActual())
  if (error) {
    caja.innerHTML = '<p class="empty-state">No se han podido leer los productos. Prueba otra vez en un rato.</p>'
    return
  }
  for (const f of data || []) fichas.set(f.id, f)
  const hay = new Set((data || []).map((f) => f.tipo || OTRO.id))
  const chips = [{ id: '', nombre: 'Todo' }, ...TIPOS, OTRO].filter((t) => t.id === '' || hay.has(t.id))
  if (tipo && !hay.has(tipo)) tipo = ''
  $('mcProdTipos').innerHTML = chips.map((t) => `<button type="button" class="chip-filtro${t.id === tipo ? ' activa' : ''}" data-prod-tipo="${t.id}" aria-pressed="${t.id === tipo}">${escapeHtml(t.nombre)}</button>`).join('') + botonSeleccionarHtml()
  const lista = (data || []).filter((f) => !tipo || (f.tipo || OTRO.id) === tipo)
  const cabeza = $('mcProdSetCabeza')
  const s = setsPorEpisodio.get(Number(episodio))
  if (cabeza && esEspecial(episodio)) {
    const n = (data || []).length
    cabeza.innerHTML = cabezaDeEspecialesHtml(`De ninguna expansión: latas, colecciones… · ${n} ${n === 1 ? 'producto' : 'productos'}`)
    cabeza.classList.remove('hidden')
  } else if (cabeza) {
    const preventa = s?.release_date && String(s.release_date) > hoyISO()
    cabeza.innerHTML = cabezaDeSetHtml(s, [preventa ? `Sale el ${fechaLarga(s.release_date)} · preventa` : fechaLarga(s?.release_date), `${(data || []).length} ${(data || []).length === 1 ? 'producto' : 'productos'}`].filter(Boolean).join(' · '))
    cabeza.classList.toggle('hidden', !s)
  }
  caja.innerHTML = lista.length
    ? lista.map((f) => tarjetaDeProductoHtml(f, cuantosDe(f.id), { conMando: mios !== null })).join('')
    : '<p class="empty-state">Todavía no hay productos de esta expansión.</p>'
  pintarMarcados()
}

// ── Seleccionar varios (1076) ──
//
// PINGU: «en los productos también debería tener» lo de seleccionar en bulk
// y darle a añadir. Como en las cartas (la 1057): «Seleccionar» en la fila de
// arriba, tocar marca, y abajo la barra de siempre (`.mc-sel`) con «Añadir»,
// que pregunta el idioma UNA vez para todos y suma uno de cada.
let marcados = null // Set de product_id, o null sin seleccionar
const botonSeleccionarHtml = () => (ctx?.sesion && mios !== null ? `<button type="button" class="mc-chip-mando mc-prod-seleccionar" data-prodsel-abrir aria-pressed="${Boolean(marcados)}">${icons.checkSquare?.(16) || ''}<span>Seleccionar</span></button>` : '')
function zonaVisible() {
  return episodio == null ? $('mcProdResultados') : $('mcProdRejilla')
}
function barraDeSeleccion() {
  let barra = $('mcProdSel')
  if (!barra) {
    barra = document.createElement('div')
    barra.id = 'mcProdSel'
    barra.className = 'mc-sel hidden'
    barra.innerHTML = `<div class="mc-sel-arriba">
        <button type="button" class="mc-sel-cerrar" data-prodsel-cerrar aria-label="Salir de la selección">✕</button>
        <p class="mc-sel-cuenta" role="status" aria-live="polite" data-prodsel-cuenta>Toca los productos</p>
        <button type="button" class="mc-sel-todas" data-prodsel-todas>Seleccionar todos</button>
      </div>
      <div class="mc-sel-abajo">
        <button type="button" class="mc-sel-accion" data-prodsel-anadir disabled><span class="mc-sel-mas" aria-hidden="true">+</span><span data-prodsel-texto>Añadir</span></button>
      </div>`
    $('mcPanelProductos').appendChild(barra)
  }
  return barra
}
function seleccionar(encender) {
  marcados = encender ? new Set() : null
  document.documentElement.classList.toggle('mc-seleccionando', Boolean(encender))
  for (const b of document.querySelectorAll('[data-prodsel-abrir]')) b.setAttribute('aria-pressed', String(Boolean(encender)))
  pintarMarcados()
}
function pintarMarcados() {
  const barra = marcados || $('mcProdSel') ? barraDeSeleccion() : null
  for (const t of document.querySelectorAll('#mcPanelProductos .mc-prod[data-prod]')) {
    const si = Boolean(marcados?.has(Number(t.dataset.prod)))
    t.classList.toggle('marcada', si)
    t.classList.toggle('marcando', Boolean(marcados))
  }
  if (!barra) return
  barra.classList.toggle('hidden', !marcados)
  const n = marcados?.size || 0
  barra.querySelector('[data-prodsel-cuenta]').textContent = n ? `${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}` : 'Toca los productos'
  barra.querySelector('[data-prodsel-texto]').textContent = esStockDeTienda() ? (n ? `${n} al stock` : 'Al stock') : n ? `Añadir ${n}` : 'Añadir'
  barra.querySelector('[data-prodsel-anadir]').disabled = !n
}
async function anadirMarcados() {
  const ids = [...(marcados || [])].filter((id) => fichas.has(id))
  if (!ids.length) return
  const idiomas = idiomasDeProducto(fichas.get(ids[0]))
  const sumar = async (idioma) => {
    for (const id of ids) {
      const valen = idiomasDeProducto(fichas.get(id))
      await cambiarCantidad(id, valen.includes(idioma) ? idioma : valen[0], 1)
    }
    seleccionar(false)
    showToast(`${ids.length === 1 ? 'Añadido 1 producto' : `Añadidos ${ids.length} productos`}${esStockDeTienda() ? ' a tu stock' : ''}.`, 'success')
  }
  if (idiomas.length === 1) return sumar(idiomas[0])
  preguntarIdioma(ids[0], { varios: ids.length, alElegir: sumar })
}

// Cuántos productos tiene cada expansión del catálogo (808). La cuenta la
// hace la base: pedir `episode_id` de toda la tabla volvía cortado a 1.000
// filas SIN error (el tope de Supabase), y solo salían las expansiones de
// esas filas — «hasta Stellar Crown, y hacia abajo hasta Evolutions».
export async function cuentaDeProductos(cliente, mercado) {
  const { data, error } = await cliente.rpc('productos_por_expansion', { p_market: mercado })
  if (!error) return new Map((data || []).map((f) => [Number(f.episode_id), Number(f.productos) || 0]))
  // Sin la migración de la 808: no hay `market`, todo es occidental, y se
  // cuenta a trozos de 1.000 para no quedarse con el primero.
  if (mercado !== 'WEST') return new Map()
  const cuenta = new Map()
  for (let desde = 0; desde < 100_000; desde += 1000) {
    const r = await cliente.from('tcg_products').select('episode_id').order('id').range(desde, desde + 999)
    if (r.error) return null
    for (const f of r.data || []) cuenta.set(Number(f.episode_id), (cuenta.get(Number(f.episode_id)) || 0) + 1)
    if ((r.data || []).length < 1000) break
  }
  return cuenta
}

// Los productos de una expansión de un catálogo: los ids de expansión de
// TCGGO del japonés son otros que los del occidental, y sin el `market` un
// japonés y un occidental con el mismo número se mezclarían.
export async function productosDeExpansion(cliente, ep, mercado, columnas = COLUMNAS) {
  const r = await cliente.from('tcg_products').select(columnas).eq('episode_id', ep).eq('market', mercado).order('name').limit(500)
  // 42703: la columna todavía no existe (falta la migración): lo de antes,
  // que era todo occidental.
  if (r.error && (r.error.code === '42703' || /market/.test(r.error.message || ''))) {
    if (mercado !== 'WEST') return { data: [], error: null }
    return cliente.from('tcg_products').select(columnas).eq('episode_id', ep).order('name').limit(500)
  }
  return r
}

// Los de varias expansiones de TCGGO a la vez (968: las que no son nuestras).
export async function productosDeEpisodios(cliente, eps, mercado, columnas = COLUMNAS) {
  if (!eps.length) return { data: [], error: null }
  return cliente.from('tcg_products').select(columnas).in('episode_id', eps).eq('market', mercado)
    .order('release_date', { ascending: false, nullsFirst: false }).order('name').limit(500)
}

const mercadoDe = (f) => f?.market || 'WEST'

async function cargarSets() {
  const cat = catalogoActual()
  if (!cuentasPorCatalogo.has(cat)) {
    const cuenta = await cuentaDeProductos(supabase, cat)
    if (cuenta === null) {
      cuentaPorEpisodio = null
      return false
    }
    cuentasPorCatalogo.set(cat, cuenta)
  }
  cuentaPorEpisodio = cuentasPorCatalogo.get(cat)
  // Los sets se piden aquí y no con `ctx.sets()`: esa lista deja fuera los
  // ESCONDIDOS, y una expansión anunciada (la 756) está escondida hasta que
  // salen sus cartas — justo la de los productos en preventa. Y por
  // catálogo (769): el occidental o el japonés, sin cambiar el de la página.
  const { data: sets } = await supabase.from('tcg_sets').select('id,market,name,name_en,tcggo_id,release_date,card_count_total,logo_path,logo_tcggo,logo_scrydex,symbol_scrydex').eq('market', catalogoActual()).not('tcggo_id', 'is', null).limit(2000)
  const porEpisodio = new Map()
  for (const s of sets || []) {
    const id = Number(s.tcggo_id)
    const ya = porEpisodio.get(id)
    if (!ya || Number(s.card_count_total || 0) > Number(ya.card_count_total || 0)) porEpisodio.set(id, s)
  }
  setsPorEpisodio = porEpisodio
  if (episodio != null && (esEspecial(episodio) ? !episodiosSinSet().length : !porEpisodio.has(Number(episodio)))) episodio = null
  return true
}

// EN UNA TIENDA, LO SELLADO ES SU STOCK (1075): la misma pestaña apunta en
// `tienda_stock` (estado «sellado»), con la forma de una línea de
// `user_products` para que lo demás no cambie.
const productoDeStock = (f) => ({ id: f.id, product_id: Number(f.product_id), idioma: f.idioma, cantidad: f.unidades })
async function misProductosDeTienda(tiendaId) {
  const { data, error } = await supabase.from('tienda_stock').select('id,product_id,idioma,unidades').eq('tienda_id', tiendaId).not('product_id', 'is', null).gt('unidades', 0)
  if (error) return null
  return (data || []).map(productoDeStock)
}
async function cambiarEnStock(id, idioma, linea, nueva) {
  const tabla = () => supabase.from('tienda_stock')
  if (linea && nueva <= 0) {
    const { error } = await tabla().delete().eq('id', linea.id)
    if (error) throw error
    mios = mios.filter((m) => m !== linea)
    return
  }
  const f = fichas.get(id)
  const r = linea
    ? await tabla().update({ unidades: nueva }).eq('id', linea.id).select('id,product_id,idioma,unidades').single()
    : await tabla().insert({ product_id: id, estado: 'sellado', variante: 'normal', idioma: idioma || f?.lang || 'en', market: f?.market === 'JP' ? 'JP' : 'WEST', unidades: nueva }).select('id,product_id,idioma,unidades').single()
  if (r.error) throw r.error
  if (!r.data) throw new Error('No se ha podido guardar en tu stock.')
  mios = linea ? mios.map((m) => (m === linea ? productoDeStock(r.data) : m)) : [...mios, productoDeStock(r.data)]
}

// Uno más o uno menos de UNA línea: producto + idioma (969). La línea que
// ya existe se toca por su id (vale con y sin la migración); una nueva se
// inserta con su idioma, y sin la columna todavía, sin él.
async function cambiarCantidad(id, idioma, paso) {
  if (!ctx.sesion) return showToast('Entra con tu cuenta para apuntar tus productos.', 'error')
  const linea = copiasDe(id).find((m) => (m.idioma || '') === (idioma || ''))
  const nueva = (Number(linea?.cantidad) || 0) + paso
  const tabla = () => supabase.from('user_products')
  try {
    if (esStockDeTienda()) await cambiarEnStock(id, idioma, linea, nueva)
    else if (linea && nueva <= 0) {
      const { error } = await tabla().delete().eq('id', linea.id).eq('user_id', ctx.sesion.user.id)
      if (error) throw error
      mios = mios.filter((m) => m !== linea)
    } else if (linea) {
      const { data, error } = await tabla().update({ cantidad: nueva }).eq('id', linea.id).select('*').single()
      if (error) throw error
      mios = mios.map((m) => (m === linea ? data : m))
    } else if (nueva > 0) {
      let r = await tabla().insert({ user_id: ctx.sesion.user.id, product_id: id, idioma, cantidad: nueva }).select('*').single()
      // Sin la migración 969 no hay columna `idioma`: la línea de siempre.
      if (r.error && /idioma/.test(r.error.message || '') && ['42703', 'PGRST204'].includes(r.error.code)) {
        const sola = copiasDe(id)[0]
        r = sola
          ? await tabla().update({ cantidad: (Number(sola.cantidad) || 0) + paso }).eq('id', sola.id).select('*').single()
          : await tabla().insert({ user_id: ctx.sesion.user.id, product_id: id, cantidad: nueva }).select('*').single()
        if (!r.error && sola) mios = mios.filter((m) => m !== sola)
      }
      if (r.error) throw r.error
      if (!r.data) throw new Error('No se ha podido guardar.')
      mios = [...mios, r.data]
    }
  } catch (err) {
    return showToast(err.message || 'No se ha podido guardar.', 'error')
  }
  pintarTuyos()
  // Se repinta lo que se ha tocado, sin volver a pedir: la tarjeta del
  // catálogo y, si está abierta, su ficha.
  const f = fichas.get(id)
  if (f) for (const t of document.querySelectorAll(`#mcProdRejilla [data-prod="${id}"], #mcProdResultados [data-prod="${id}"]`)) t.outerHTML = tarjetaDeProductoHtml(f)
  if (marcados) pintarMarcados()
  if (abiertoEnFicha === id) pintarMandoDeFicha(f)
}

// ── ¿En qué idioma lo tienes? (969) ──
// Como al añadir una carta: se elige antes de apuntarlo. En el japonés solo
// hay uno, y no se pregunta. Se recuerda el último que elegiste.
function idiomaRecordado() {
  try { return localStorage.getItem(CLAVE_IDIOMA) || 'es' } catch { return 'es' }
}
function preguntarIdioma(id, { varios = 0, alElegir = null } = {}) {
  const f = fichas.get(id)
  if (!f) return
  if (!ctx.sesion) return showToast('Entra con tu cuenta para apuntar tus productos.', 'error')
  const idiomas = idiomasDeProducto(f)
  if (idiomas.length === 1) return void cambiarCantidad(id, idiomas[0], 1)
  let d = $('mcProdIdioma')
  if (!d) {
    d = document.createElement('dialog')
    d.id = 'mcProdIdioma'
    d.className = 'mc-prodi'
    d.setAttribute('aria-labelledby', 'mcProdIdiomaTitulo')
    document.body.appendChild(d)
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-prodi-idioma]')
      if (b) {
        try { localStorage.setItem(CLAVE_IDIOMA, b.dataset.prodiIdioma) } catch {}
        d.close()
        if (d.alElegir) return void d.alElegir(b.dataset.prodiIdioma)
        return void cambiarCantidad(Number(d.dataset.producto), b.dataset.prodiIdioma, 1)
      }
      if (e.target.closest('[data-prodi-cerrar]') || e.target === d) d.close()
    })
  }
  d.dataset.producto = String(id)
  d.alElegir = alElegir
  const ya = new Map(copiasDe(id).map((m) => [m.idioma || '', Number(m.cantidad) || 0]))
  const recordado = idiomaRecordado()
  d.innerHTML = `<div class="mc-prodi-caja">
      <h3 id="mcProdIdiomaTitulo">${varios > 1 ? '¿En qué idioma son?' : '¿En qué idioma lo tienes?'}</h3>
      <p class="mc-prodi-nombre">${varios > 1 ? `${varios} productos, uno de cada` : escapeHtml(f.name)}</p>
      <div class="mc-prodi-lista">${idiomas.map((idioma) => {
        const p = preciosPorIdioma(f).find((x) => x.id === idioma)
        const tienes = ya.get(idioma)
        return `<button type="button" class="mc-prodi-idioma${idioma === recordado ? ' recordado' : ''}" data-prodi-idioma="${idioma}">${banderaHtml(idioma)}<b>${escapeHtml(nombreDeIdioma(idioma))}</b><small>${[p ? euros(p.valor) : 'sin precio', tienes ? `tienes ${tienes}` : ''].filter(Boolean).map(escapeHtml).join(' · ')}</small></button>`
      }).join('')}</div>
      <button type="button" class="btn-secondary" data-prodi-cerrar>Cancelar</button>
    </div>`
  d.showModal()
  d.querySelector('.recordado')?.focus()
}

// ── El buscador de la pestaña (968) ──
// Con algo escrito, la estantería se aparta y salen los productos del
// catálogo que se mira; vacío, vuelve. Lo que llega tarde de una búsqueda
// vieja no se pinta encima de la nueva (la 663).
async function pintarBusqueda() {
  const enBusqueda = busqueda.length >= 2
  $('mcProdBusqueda')?.classList.toggle('hidden', !enBusqueda)
  $('mcProdNormal')?.classList.toggle('hidden', enBusqueda)
  if (!enBusqueda) return
  const mia = ++busquedaVersion
  const caja = $('mcProdResultados')
  const cuenta = $('mcProdBusquedaCuenta')
  caja.classList.add('uv-actualizando')
  const { data, error } = await buscarProductos(busqueda, { mercado: catalogoActual(), limite: 60 })
  if (mia !== busquedaVersion) return
  caja.classList.remove('uv-actualizando')
  if (error) {
    cuenta.textContent = ''
    caja.innerHTML = '<p class="empty-state">No se ha podido buscar. Prueba otra vez en un rato.</p>'
    return
  }
  for (const f of data || []) fichas.set(f.id, f)
  const n = (data || []).length
  cuenta.innerHTML = n ? `<span>${escapeHtml(`${n >= 60 ? 'Los 60 primeros' : `${n} ${n === 1 ? 'producto' : 'productos'}`} con «${busqueda}»`)}</span>${botonSeleccionarHtml()}` : ''
  caja.innerHTML = n
    ? data.map((f) => tarjetaDeProductoHtml(f, cuantosDe(f.id), { conMando: mios !== null })).join('')
    : `<p class="empty-state">Ningún producto con «${escapeHtml(busqueda)}». Prueba con menos palabras o en inglés («tin», «box»).</p>`
  pintarMarcados()
}

// Lo que viene en la dirección, la primera vez (968): `producto` abre su
// ficha (desde el buscador de arriba) y `q` deja la búsqueda puesta.
async function deLaDireccion() {
  const params = new URLSearchParams(location.search)
  const q = (params.get('q') || '').trim()
  const id = Number(params.get('producto'))
  if (Number.isInteger(id) && id > 0) {
    let f = fichas.get(id)
    if (!f) {
      try { f = (await productosPorIds([id])).get(id) } catch { f = null }
    }
    if (f) {
      fichas.set(id, f)
      if (mercadoDe(f) !== catalogoActual()) {
        catalogo = mercadoDe(f)
        await cargarSets()
      }
      return () => abrirFicha(id)
    }
  }
  if (q && $('mcProdBuscar')) {
    $('mcProdBuscar').value = q
    busqueda = q
  }
  return null
}

// ── La ficha de un producto (769) ──
function pintarMandoDeFicha(f) {
  const sitio = $('mcProdFichaMando')
  if (!sitio || !f) return
  // En la ficha, cada idioma con su − y su +, y añadir en otro (969).
  const copias = copiasDe(f.id)
  const n = cuantosDe(f.id)
  sitio.innerHTML = mios === null
    ? ''
    : n
      ? `<p class="mc-prodf-tienes">${n === 1 ? 'Lo tienes' : `Tienes ${n}`}</p><div class="mc-prodf-copias">${copias.map((m) => mandoDeLineaHtml(f, m, { conNombre: true })).join('')}</div>${idiomasDeProducto(f).length > 1 ? `<button type="button" class="mc-prod-anadir mc-prodf-otro" data-prod-anadir="${f.id}">+ En otro idioma</button>` : ''}`
      : mandoHtml(f, [])
}

export function fichaDeProductoHtml(f, s = null) {
  const p = precioDeProducto(f)
  const idiomas = preciosPorIdioma(f)
  const cm = enlaceCardmarketDeProducto(f)
  const tp = enlaceTcgplayerDeProducto(f)
  const medias = [
    f.cm_avg7 != null ? `<tr class="pv-fila"><td><span class="pv-fila-enlace">Media de 7 días</span></td><td class="pv-precio">${escapeHtml(euros(f.cm_avg7))}</td></tr>` : '',
    f.cm_avg30 != null ? `<tr class="pv-fila"><td><span class="pv-fila-enlace">Media de 30 días</span></td><td class="pv-precio">${escapeHtml(euros(f.cm_avg30))}</td></tr>` : '',
    f.cm_disponibles != null ? `<tr class="pv-fila"><td><span class="pv-fila-enlace">A la venta ahora</span></td><td class="pv-precio">${Number(f.cm_disponibles).toLocaleString('es-ES')}</td></tr>` : '',
  ].join('')
  return `<div class="mc-prodf-arriba">
      <span class="mc-prodf-foto">${f.image ? `<img src="${escapeHtml(f.image)}" alt="" width="320" height="320" onerror="this.remove()" />` : ''}</span>
      <div class="mc-prodf-datos">
        <span class="mc-prod-chapas"><span class="mc-prod-tipo">${escapeHtml(nombreDeTipo(f.tipo))}</span>${esPreventa(f) ? '<span class="mc-prod-preventa">Preventa</span>' : ''}${pvpHtml(f, p)}</span>
        ${s ? `<p class="mc-prodf-set">${logoHtml(s, 96, 40)}<span>${escapeHtml(nombreDeSet(s) || s.id)}${s.release_date ? ` · ${escapeHtml(fechaLarga(s.release_date))}` : ''}</span></p>` : ''}
        <p class="mc-prodf-precio">${p ? `<b>${escapeHtml(euros(p.valor))}</b> <small>mínimo en ${escapeHtml(p.donde)}</small>` : '<b class="mc-prod-sin">Sin precio todavía</b>'}</p>
        <div id="mcProdFichaMando" class="mc-prodf-mando"></div>
      </div>
    </div>
    <div class="pv">
      <div class="pv-fuente pv-cardmarket"><div class="pv-fuente-cab"><span class="pv-fuente-nombre">Cardmarket</span>${cm ? `<a class="btn-cardmarket pv-boton" href="${escapeHtml(cm)}" target="_blank" rel="noopener">${marcaCardmarket(18)}<span>Cardmarket</span></a>` : ''}</div>
        ${idiomas.length || medias ? `<table class="pv-tabla"><thead><tr><th>Idioma</th><th>Mínimo</th></tr></thead><tbody>${idiomas.map((x) => `<tr class="pv-fila${p && x.id === p.idioma ? ' pv-activa' : ''}"><td><span class="pv-fila-enlace mc-prodf-idioma">${banderaHtml(x.id)}${escapeHtml(x.nombre)}</span></td><td class="pv-precio">${escapeHtml(euros(x.valor))}</td></tr>`).join('')}${medias}</tbody></table>` : '<p class="pv-pie">Todavía sin precios de Cardmarket.</p>'}
      </div>
      ${tp ? `<div class="pv-fuente pv-tcgplayer"><div class="pv-fuente-cab"><span class="pv-fuente-nombre">TCGplayer</span><a class="btn-tcgplayer pv-boton" href="${escapeHtml(tp)}" target="_blank" rel="noopener">${icons.zap(16)}<span>TCGplayer</span></a></div></div>` : ''}
      ${f.tcggo_url ? `<p class="pv-pie"><a href="${escapeHtml(f.tcggo_url)}" target="_blank" rel="noopener">Ver en TCGGO</a>, de donde salen los precios.</p>` : ''}
    </div>
    <div class="mc-prodc hidden" id="mcProdContenido"></div>
    <div class="carta-historial hidden" id="mcProdHistorial"></div>`
}

// EL PVP (1026): el oficial de Europa y a cuánto está hoy de él. Es una
// chapa al lado del tipo; sin PVP no hay chapa, y sin precio de hoy solo el PVP.
function pvpHtml(f, p = precioDeProducto(f)) {
  if (f?.pvp_eur == null) return ''
  const rel = relacionConPvp(p?.valor, f.pvp_eur)
  return `<span class="mc-prod-pvp" title="Precio de venta recomendado en Europa">PVP ${escapeHtml(euros(f.pvp_eur))}${rel ? ` · ${escapeHtml(rel.texto)}` : ''}</span>`
}

// ── Qué lleva dentro y en qué viene (1026) ──
// Las dos lecturas de `tcg_product_contenido`: lo que cuelga de este producto
// y los productos de los que cuelga este. `null` = no se sabe (sin la
// migración, o la base no contesta): no se pinta nada, ni «no lleva nada».
async function contenidoDe(id) {
  const [dentro, padres] = await Promise.all([
    supabase.from('tcg_product_contenido').select('*').eq('product_id', id).order('cantidad', { ascending: false }).order('nombre').limit(200),
    supabase.from('tcg_product_contenido').select('*').eq('contenido_tipo', 'product').eq('contenido_id', id).limit(200),
  ])
  if (dentro.error || padres.error) return null
  return { dentro: dentro.data || [], padres: padres.data || [] }
}

const fotoHtml = (src, extra = '') => `<span class="mc-prodc-foto">${src ? `<img src="${escapeHtml(src)}" alt="" width="44" height="44" loading="lazy" onerror="this.remove()" />` : ''}${extra}</span>`

// «Qué lleva dentro»: una fila por cosa (las que son productos nuestros se
// abren), y la cuenta del pack contra lo suelto (`cuentaDelPack`).
function contenidoHtml(f, dentro) {
  if (!dentro.length) return ''
  const filas = dentro.map((c) => {
    const p = c.contenido_tipo === 'product' ? fichas.get(Number(c.contenido_id)) : null
    const precio = c.cm_lowest ?? c.tp_market
    const n = Math.max(1, Number(c.cantidad) || 1)
    const etiqueta = c.contenido_tipo === 'card' ? 'Carta' : nombreDeTipo(p?.tipo || tipoDeProducto(c.nombre))
    const dentroHtml = `${fotoHtml(c.image, `<b>×${n}</b>`)}<span class="mc-prodc-texto"><b>${escapeHtml(c.nombre)}</b><small>${escapeHtml(etiqueta)}${precio != null ? ` · ${escapeHtml(euros(precio))} cada uno` : ' · sin precio'}</small></span><span class="mc-prodc-eur">${precio != null ? escapeHtml(euros(precio * n)) : '—'}</span>`
    return p
      ? `<button type="button" class="mc-prodc-fila" data-prod-ficha="${p.id}" aria-label="Ver la ficha de ${escapeHtml(c.nombre)}">${dentroHtml}</button>`
      : `<div class="mc-prodc-fila">${dentroHtml}</div>`
  })
  const cuenta = cuentaDelPack(precioDeProducto(f)?.valor, dentro)
  let veredicto = ''
  if (cuenta?.veredicto === 'mejor') veredicto = `<span class="mc-prodc-veredicto bien">El pack sale ${escapeHtml(euros(cuenta.diferencia))} mejor que comprarlo suelto</span>`
  else if (cuenta?.veredicto === 'peor') veredicto = `<span class="mc-prodc-veredicto mal">Comprarlo suelto sale ${escapeHtml(euros(-cuenta.diferencia))} mejor que el pack</span>`
  else if (cuenta?.veredicto === 'igual') veredicto = '<span class="mc-prodc-veredicto">El pack y lo suelto, lo mismo</span>'
  else if (cuenta) veredicto = `<span class="mc-prodc-veredicto parcial">${cuenta.sinPrecio} ${cuenta.sinPrecio === 1 ? 'cosa' : 'cosas'} de dentro sin precio: la cuenta es orientativa</span>`
  const cuentaHtml = cuenta
    ? `<div class="mc-prodc-cuenta"><span>${cuenta.sinPrecio ? 'Lo de dentro con precio, suelto' : 'Todo lo de dentro, suelto'}</span><b>${escapeHtml(euros(cuenta.suelto))}</b><span>El pack hoy</span><b>${escapeHtml(euros(cuenta.pack))}</b>${veredicto}</div>`
    : ''
  return `<section class="mc-prodc-bloque"><h3>Qué lleva dentro</h3><div class="mc-prodc-lista">${filas.join('')}</div>${cuentaHtml}</section>`
}

// «Viene en»: los packs que llevan este producto, con lo que sale cada
// unidad dentro, los mejores primero; cinco a la vista y «Ver más».
const VIENE_EN_A_LA_VISTA = 5
function vieneEnHtml(f, padres) {
  const lista = padres
    .map((x) => ({ fila: x, p: fichas.get(Number(x.product_id)) }))
    .filter((x) => x.p)
    .map(({ fila, p }) => ({ fila, p, precio: precioDeProducto(p), unidad: porUnidad(precioDeProducto(p)?.valor, fila.cantidad) }))
    .sort((a, b) => (a.unidad ?? 1e9) - (b.unidad ?? 1e9) || String(a.p.name).localeCompare(String(b.p.name)))
  if (!lista.length) return ''
  const filas = lista.map(({ fila, p, precio, unidad }, i) => `<button type="button" class="mc-prodc-fila${i >= VIENE_EN_A_LA_VISTA ? ' mc-prodc-mas' : ''}" data-prod-ficha="${p.id}" aria-label="Ver la ficha de ${escapeHtml(p.name)}">
      ${fotoHtml(p.image)}<span class="mc-prodc-texto"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(`${fila.cantidad} dentro`)}${precio ? ` · ${escapeHtml(euros(precio.valor))}` : ''}</small></span><span class="mc-prodc-eur">${unidad != null ? `${escapeHtml(euros(unidad))}<small>cada uno</small>` : '—'}</span>
    </button>`)
  const mas = lista.length > VIENE_EN_A_LA_VISTA ? `<button type="button" class="btn-secondary mc-prodc-ver" data-prodc-ver>Ver ${lista.length - VIENE_EN_A_LA_VISTA} más</button>` : ''
  return `<section class="mc-prodc-bloque"><h3>Viene en</h3><div class="mc-prodc-lista">${filas.join('')}</div>${mas}<p class="mc-prodc-nota">Lo que sale cada uno cuenta solo las unidades de este producto: en un pack con más cosas es orientativo.</p></section>`
}

// Llega después de pintar la ficha y no empuja nada mientras no haya nada
// (su hueco está escondido). Lo de una ficha vieja no se mete en la nueva
// (la 663). Los productos de dentro y los padres se piden para poder abrir
// su ficha desde la fila.
async function pintarContenido(f) {
  const caja = $('mcProdContenido')
  if (!caja || !f) return
  const r = await contenidoDe(f.id)
  if (abiertoEnFicha !== f.id || !r) return
  const faltan = [...r.dentro.filter((x) => x.contenido_tipo === 'product').map((x) => Number(x.contenido_id)), ...r.padres.map((x) => Number(x.product_id))].filter((id) => Number.isFinite(id) && !fichas.has(id))
  if (faltan.length) {
    try { for (const [id, p] of await productosPorIds(faltan)) fichas.set(id, p) } catch { /* sin fichas: las filas no se abren */ }
    if (abiertoEnFicha !== f.id) return
  }
  const html = contenidoHtml(f, r.dentro) + vieneEnHtml(f, r.padres)
  caja.innerHTML = html
  caja.classList.toggle('hidden', !html)
}

function abrirFicha(id) {
  const f = fichas.get(id)
  const d = $('mcProdFicha')
  if (!f || !d) return
  abiertoEnFicha = id
  const s = setsPorEpisodio.get(Number(f.episode_id)) || null
  $('mcProdFichaTitulo').textContent = f.name
  $('mcProdFichaCuerpo').innerHTML = fichaDeProductoHtml(f, s)
  pintarMandoDeFicha(f)
  void pintarContenido(f)
  const alLado = window.matchMedia(CONSULTA_AL_LADO).matches
  d.classList.toggle('mc-prodf-al-lado', alLado)
  if (!d.open) {
    if (alLado) d.show()
    else d.showModal()
  }
  // Su gráfica, la de las cartas; llega después y no empuja nada (su hueco
  // está escondido hasta que hay línea).
  const caja = $('mcProdHistorial')
  void import('../carta-historial.js')
    .then(({ montarHistorial }) => (abiertoEnFicha === id ? montarHistorial(caja, String(id), () => 'en', { url: `/.netlify/functions/tcggo-historial-producto?product=${encodeURIComponent(id)}` }) : null))
    .catch(() => null)
}

export async function abrir(contexto) {
  ctx = contexto
  // Su hoja, al abrir la pestaña (797, LO3): quien no la abre no la baja.
  await hojaInyectada('css/mi-coleccion-productos.css')
  if (!montado) {
    montado = true
    const panel = $('mcPanelProductos')
    // El «+», el «−» y abrir la ficha: en la pestaña y en la propia ficha.
    // Devuelve si el clic era suyo.
    const clicEnProductos = (e) => {
      // Seleccionando, tocar un producto lo marca (y no abre ni suma).
      if (marcados && e.target.closest('#mcPanelProductos .mc-prod[data-prod]')) {
        const id = Number(e.target.closest('.mc-prod').dataset.prod)
        if (marcados.has(id)) marcados.delete(id)
        else marcados.add(id)
        pintarMarcados()
        return true
      }
      if (e.target.closest('[data-prodsel-abrir]')) { seleccionar(!marcados); return true }
      if (e.target.closest('[data-prodsel-cerrar]')) { seleccionar(false); return true }
      if (e.target.closest('[data-prodsel-todas]')) {
        for (const t of zonaVisible()?.querySelectorAll('.mc-prod[data-prod]') || []) marcados?.add(Number(t.dataset.prod))
        pintarMarcados()
        return true
      }
      if (e.target.closest('[data-prodsel-anadir]')) { void anadirMarcados(); return true }
      const anadir = e.target.closest('[data-prod-anadir]')
      if (anadir) { preguntarIdioma(Number(anadir.dataset.prodAnadir)); return true }
      const mas = e.target.closest('[data-prod-mas]')
      if (mas) { void cambiarCantidad(Number(mas.dataset.prodMas), mas.dataset.idioma || '', 1); return true }
      const menos = e.target.closest('[data-prod-menos]')
      if (menos) { void cambiarCantidad(Number(menos.dataset.prodMenos), menos.dataset.idioma || '', -1); return true }
      const ficha = e.target.closest('[data-prod-ficha]')
      if (ficha) { abrirFicha(Number(ficha.dataset.prodFicha)); return true }
      // «Ver N más» de «Viene en» (1026): se despliega y el botón se va.
      const ver = e.target.closest('[data-prodc-ver]')
      if (ver) { ver.closest('.mc-prodc-bloque')?.classList.add('mc-prodc-abierto'); ver.remove(); return true }
      return false
    }
    panel.addEventListener('click', (e) => {
      if (clicEnProductos(e)) return
      const t = e.target.closest('[data-prod-tipo]')
      if (t) {
        tipo = t.dataset.prodTipo
        return void pintarCatalogo()
      }
      const set = e.target.closest('[data-prod-set]')
      if (set) {
        episodio = esEspecial(set.dataset.prodSet) ? ESPECIALES : Number(set.dataset.prodSet)
        tipo = ''
        window.scrollTo({ top: 0, behavior: 'instant' })
        return void pintarCatalogo()
      }
      if (e.target.closest('#mcProdVolver')) {
        episodio = null
        if (marcados) seleccionar(false)
        return pintarEstante()
      }
      const m = e.target.closest('[data-prod-mercado]')
      if (m && m.dataset.prodMercado !== catalogoActual()) {
        catalogo = m.dataset.prodMercado
        episodio = null
        void cargarSets().then(() => { pintarTuyos(); pintarEstante(); if (busqueda) void pintarBusqueda() })
      }
    })
    let espera = null
    $('mcProdBuscar')?.addEventListener('input', (e) => {
      clearTimeout(espera)
      espera = setTimeout(() => {
        busqueda = e.target.value.trim()
        void pintarBusqueda()
      }, 250)
    })
    const d = $('mcProdFicha')
    d?.addEventListener('click', (e) => {
      if (clicEnProductos(e)) return
      if (e.target.closest('#mcProdFichaCerrar')) return d.close()
      // Pulsar fuera de la ventana la cierra, como las demás de la pantalla.
      if (e.target === d && !d.classList.contains('mc-prodf-al-lado')) {
        const r = d.getBoundingClientRect()
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close()
      }
    })
    d?.addEventListener('close', () => { abiertoEnFicha = null })
    // Al lado no es modal: Escape la cierra igual.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && d?.open && d.classList.contains('mc-prodf-al-lado')) d.close()
    })
  }
  const lista = ctx.sesion ? await (esStockDeTienda() ? misProductosDeTienda : misProductos)(ctx.sesion.user.id) : []
  mios = lista ? [...lista] : null
  if (mios?.length) {
    try {
      for (const [id, f] of await productosPorIds(mios.map((m) => m.product_id))) fichas.set(id, f)
    } catch { /* sin fichas, lo tuyo sale cuando lleguen */ }
  }
  await cargarSets()
  const alFinal = primeraVez ? await deLaDireccion() : null
  primeraVez = false
  pintarTuyos()
  if (episodio != null) await pintarCatalogo()
  else pintarEstante()
  if (busqueda) await pintarBusqueda()
  alFinal?.()
}
