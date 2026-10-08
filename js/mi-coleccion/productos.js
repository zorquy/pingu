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
import { escapeHtml } from '../html.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { marcaCardmarket } from '../cardmarket-marca.js'
import { TIPOS, OTRO, nombreDeTipo, precioDeProducto, esPreventa, valorDeProductos, preciosPorSitio, enlaceCardmarketDeProducto, enlaceTcgplayerDeProducto } from '../productos.js'
import { nombreDeSet } from '../catalogo-series.js'
import { misProductos, productosPorIds } from '../productos-valor.js'

const $ = (id) => document.getElementById(id)
// Con `*` (769): las columnas por país son de una migración que puede no
// estar todavía, y pedirlas por su nombre haría fallar la consulta ENTERA
// (la 624). Con `*` llega lo que haya.
export const COLUMNAS = '*'
const euros = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
// Al lado, como la ficha de una expansión (740): con ratón y sitio.
export const CONSULTA_AL_LADO = '(min-width: 1400px) and (pointer: fine)'

let ctx = null
let mios = null // Map product_id → { id, product_id, cantidad }; null = no se sabe
let fichas = new Map() // product_id → fila de tcg_products
let cuentaPorEpisodio = null // episode_id → cuántos productos; null = sin migración
let setsPorEpisodio = new Map() // episode_id → nuestro set (con su logo)
let episodio = null // la expansión abierta, o null en la estantería
let tipo = ''
let catalogo = null // 'WEST' | 'JP'; null = el de la página
let montado = false
let abiertoEnFicha = null

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

function mandoHtml(f, cantidad) {
  return cantidad
    ? `<span class="mc-prod-mando"><button type="button" class="mc-prod-boton" data-prod-menos="${f.id}" aria-label="Quitar uno de ${escapeHtml(f.name)}">−</button><b class="mc-prod-cuantos" aria-label="Tienes ${cantidad}">×${cantidad}</b><button type="button" class="mc-prod-boton" data-prod-mas="${f.id}" aria-label="Añadir otro de ${escapeHtml(f.name)}">+</button></span>`
    : `<span class="mc-prod-mando"><button type="button" class="mc-prod-anadir" data-prod-mas="${f.id}" aria-label="Añadir ${escapeHtml(f.name)} a tu colección">+ Añadir</button></span>`
}

// La foto y el nombre ABREN la ficha (769): son un botón, el «+» va aparte.
export function tarjetaDeProductoHtml(f, cantidad = 0, { conMando = true } = {}) {
  const media = f.cm_avg30 != null ? `<span class="mc-prod-media">Media 30 días: ${escapeHtml(euros(f.cm_avg30))}</span>` : ''
  return `<article class="mc-prod${cantidad ? ' tengo' : ''}" data-prod="${f.id}">
    <button type="button" class="mc-prod-abrir" data-prod-ficha="${f.id}" aria-label="Ver la ficha de ${escapeHtml(f.name)}">
      <span class="mc-prod-foto">${f.image ? `<img src="${escapeHtml(f.image)}" alt="" width="240" height="240" loading="lazy" onerror="this.remove()" />` : ''}${marcaDeTenerlo(cantidad)}</span>
      <span class="mc-prod-chapas"><span class="mc-prod-tipo">${escapeHtml(nombreDeTipo(f.tipo))}</span>${esPreventa(f) ? '<span class="mc-prod-preventa">Preventa</span>' : ''}</span>
      <b class="mc-prod-nombre">${escapeHtml(f.name)}</b>
      ${precioHtml(f)}
      ${media}
    </button>
    ${conMando ? mandoHtml(f, cantidad) : ''}
  </article>`
}

function pintarTuyos() {
  const caja = $('mcProdTuyos')
  if (!caja) return
  if (mios === null) {
    caja.innerHTML = '<p class="mc-nota">Los productos todavía no están activados en la base. En cuanto lo estén, aquí verás los tuyos y lo que valen.</p>'
    return
  }
  const lista = [...mios.values()].filter((m) => fichas.has(m.product_id) && setsPorEpisodio.has(Number(fichas.get(m.product_id).episode_id)))
  if (!lista.length) {
    caja.innerHTML = mios.size ? '' : '<p class="mc-nota">Todavía no tienes productos. Abre una expansión de abajo y toca «+ Añadir» en los que tengas.</p>'
    return
  }
  const v = valorDeProductos(lista, fichas)
  caja.innerHTML = `<div class="mc-prod-cabecera">
      <h2 class="mc-subtitulo">Tus productos</h2>
      <p class="mc-prod-valor"><b>${escapeHtml(euros(v.total))}</b> · ${v.unidades} ${v.unidades === 1 ? 'producto' : 'productos'}${v.sinPrecio ? ` · ${v.sinPrecio} sin precio` : ''}</p>
    </div>
    ${gruposDeTuyos(lista).map((g) => `${g.set ? `<div class="mc-prod-set">${cabezaDeSetHtml(g.set)}</div>` : ''}<div class="mc-prod-rejilla">${g.lista.map((m) => tarjetaDeProductoHtml(fichas.get(m.product_id), m.cantidad)).join('')}</div>`).join('')}`
}

// Tus productos, por expansión (766, PR1): la más nueva primero.
function gruposDeTuyos(lista) {
  const grupos = new Map()
  for (const m of lista) {
    const ep = fichas.get(m.product_id)?.episode_id ?? null
    if (!grupos.has(ep)) grupos.set(ep, { set: setsPorEpisodio.get(Number(ep)) || null, lista: [] })
    grupos.get(ep).lista.push(m)
  }
  return [...grupos.values()].sort((a, b) => (a.set ? 0 : 1) - (b.set ? 0 : 1) || String(b.set?.release_date || '').localeCompare(String(a.set?.release_date || '')))
}

// Cuántos de los tuyos son de una expansión (para su baldosa).
function tuyosDe(ep) {
  let n = 0
  for (const m of mios?.values() || []) if (Number(fichas.get(m.product_id)?.episode_id) === Number(ep)) n += Number(m.cantidad) || 0
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
    ${tengo ? `<span class="mc-prod-baldosa-tuyos">Tienes ${tengo}</span>` : ''}
  </button>`
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
  caja.innerHTML = lista.length
    ? lista.map(([ep, s]) => baldosaHtml(ep, s)).join('')
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
  const cabeza = $('mcProdSetCabeza')
  const s = setsPorEpisodio.get(Number(episodio))
  if (cabeza) {
    const preventa = s?.release_date && String(s.release_date) > hoyISO()
    cabeza.innerHTML = cabezaDeSetHtml(s, [preventa ? `Sale el ${fechaLarga(s.release_date)} · preventa` : fechaLarga(s?.release_date), `${(data || []).length} ${(data || []).length === 1 ? 'producto' : 'productos'}`].filter(Boolean).join(' · '))
    cabeza.classList.toggle('hidden', !s)
  }
  caja.innerHTML = lista.length
    ? lista.map((f) => tarjetaDeProductoHtml(f, mios?.get(f.id)?.cantidad || 0, { conMando: mios !== null })).join('')
    : '<p class="empty-state">Todavía no hay productos de esta expansión.</p>'
}

async function cargarSets() {
  if (cuentaPorEpisodio === null) {
    const { data, error } = await supabase.from('tcg_products').select('episode_id').limit(10000)
    if (error) {
      cuentaPorEpisodio = null
      return false
    }
    cuentaPorEpisodio = new Map()
    for (const f of data || []) cuentaPorEpisodio.set(Number(f.episode_id), (cuentaPorEpisodio.get(Number(f.episode_id)) || 0) + 1)
  }
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
  if (episodio != null && !porEpisodio.has(Number(episodio))) episodio = null
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
  // Se repinta lo que se ha tocado, sin volver a pedir: la tarjeta del
  // catálogo y, si está abierta, su ficha.
  const f = fichas.get(id)
  const tarjeta = $('mcProdRejilla')?.querySelector(`[data-prod="${id}"]`)
  if (f && tarjeta) tarjeta.outerHTML = tarjetaDeProductoHtml(f, mios.get(id)?.cantidad || 0)
  if (abiertoEnFicha === id) pintarMandoDeFicha(f)
}

// ── La ficha de un producto (769) ──
function pintarMandoDeFicha(f) {
  const sitio = $('mcProdFichaMando')
  if (!sitio || !f) return
  const n = mios?.get(f.id)?.cantidad || 0
  sitio.innerHTML = mios === null ? '' : `${n ? `<p class="mc-prodf-tienes">${n === 1 ? 'Lo tienes' : `Tienes ${n}`}</p>` : ''}${mandoHtml(f, n)}`
}

export function fichaDeProductoHtml(f, s = null) {
  const p = precioDeProducto(f)
  const sitios = preciosPorSitio(f)
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
        <span class="mc-prod-chapas"><span class="mc-prod-tipo">${escapeHtml(nombreDeTipo(f.tipo))}</span>${esPreventa(f) ? '<span class="mc-prod-preventa">Preventa</span>' : ''}</span>
        ${s ? `<p class="mc-prodf-set">${logoHtml(s, 96, 40)}<span>${escapeHtml(nombreDeSet(s) || s.id)}${s.release_date ? ` · ${escapeHtml(fechaLarga(s.release_date))}` : ''}</span></p>` : ''}
        <p class="mc-prodf-precio">${p ? `<b>${escapeHtml(euros(p.valor))}</b> <small>mínimo en ${escapeHtml(p.donde)}</small>` : '<b class="mc-prod-sin">Sin precio todavía</b>'}</p>
        <div id="mcProdFichaMando" class="mc-prodf-mando"></div>
      </div>
    </div>
    <div class="pv">
      <div class="pv-fuente pv-cardmarket"><div class="pv-fuente-cab"><span class="pv-fuente-nombre">Cardmarket</span>${cm ? `<a class="btn-cardmarket pv-boton" href="${escapeHtml(cm)}" target="_blank" rel="noopener">${marcaCardmarket(18)}<span>Cardmarket</span></a>` : ''}</div>
        ${sitios.length || medias ? `<table class="pv-tabla"><thead><tr><th>Dónde</th><th>Mínimo</th></tr></thead><tbody>${sitios.map((x) => `<tr class="pv-fila${p && x.columna === `cm_lowest_${p.donde === 'España' ? 'es' : p.donde === 'Europa' ? 'eu' : ''}` ? ' pv-activa' : ''}"><td><span class="pv-fila-enlace">${escapeHtml(x.nombre)}</span></td><td class="pv-precio">${escapeHtml(euros(x.valor))}</td></tr>`).join('')}${medias}</tbody></table>` : '<p class="pv-pie">Todavía sin precios de Cardmarket.</p>'}
      </div>
      ${tp ? `<div class="pv-fuente pv-tcgplayer"><div class="pv-fuente-cab"><span class="pv-fuente-nombre">TCGplayer</span><a class="btn-tcgplayer pv-boton" href="${escapeHtml(tp)}" target="_blank" rel="noopener">${icons.zap(16)}<span>TCGplayer</span></a></div></div>` : ''}
      ${f.tcggo_url ? `<p class="pv-pie"><a href="${escapeHtml(f.tcggo_url)}" target="_blank" rel="noopener">Ver en TCGGO</a>, de donde salen los precios.</p>` : ''}
    </div>
    <div class="carta-historial hidden" id="mcProdHistorial"></div>`
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
  if (!montado) {
    montado = true
    const panel = $('mcPanelProductos')
    // El «+», el «−» y abrir la ficha: en la pestaña y en la propia ficha.
    // Devuelve si el clic era suyo.
    const clicEnProductos = (e) => {
      const mas = e.target.closest('[data-prod-mas]')
      if (mas) { void cambiarCantidad(Number(mas.dataset.prodMas), 1); return true }
      const menos = e.target.closest('[data-prod-menos]')
      if (menos) { void cambiarCantidad(Number(menos.dataset.prodMenos), -1); return true }
      const ficha = e.target.closest('[data-prod-ficha]')
      if (ficha) { abrirFicha(Number(ficha.dataset.prodFicha)); return true }
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
        episodio = Number(set.dataset.prodSet)
        tipo = ''
        window.scrollTo({ top: 0, behavior: 'instant' })
        return void pintarCatalogo()
      }
      if (e.target.closest('#mcProdVolver')) {
        episodio = null
        return pintarEstante()
      }
      const m = e.target.closest('[data-prod-mercado]')
      if (m && m.dataset.prodMercado !== catalogoActual()) {
        catalogo = m.dataset.prodMercado
        episodio = null
        void cargarSets().then(() => { pintarTuyos(); pintarEstante() })
      }
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
  const lista = ctx.sesion ? await misProductos(ctx.sesion.user.id) : []
  mios = lista ? new Map(lista.map((m) => [m.product_id, m])) : null
  if (mios?.size) {
    try {
      for (const [id, f] of await productosPorIds([...mios.keys()])) fichas.set(id, f)
    } catch { /* sin fichas, lo tuyo sale cuando lleguen */ }
  }
  await cargarSets()
  pintarTuyos()
  if (episodio != null) await pintarCatalogo()
  else pintarEstante()
}
