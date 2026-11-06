// VENDER (tanda 1072; rápido desde la 1254, el Mostrador). PINGU: «buscas tu
// producto que tienes en venta, te va a marcar a qué precio lo estás vendiendo…
// precio de venta 250, lo he vendido por 240… si no lo relleno, se va a quedar
// en 250 automático, que aparezca el mismo valor pero en gris».
//
// Se busca SOLO en el stock (lo que tiene unidades; no lo que está por poner a
// la venta, 1255, ni lo reservado, que ya no tiene unidades). Cada línea lleva
// «Tu precio» (el de su oferta mientras dure, 1082) y «Vendido por», vacío con
// ese precio en gris: vacío es venderla a su precio. Debajo, cómo te paga
// (efectivo, tarjeta, Bizum o PayPal) y, plegado, dónde (se recuerdan los dos).
// «Vendida» resta las unidades y apunta la venta (`tienda_vender`, todo o nada;
// la base guarda el precio de lista para saber lo rebajado). La hoja se queda
// abierta y vacía para el siguiente cliente, con Deshacer y Recibo.
//
// Entra por `import()` desde js/tienda-mostrador.js (el botón del centro, el
// de arriba, Escanear), la ficha de una línea, «Seleccionar» del stock y
// «Vender esta carta» de un mensaje.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { euros } from './cardmarket.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { nombreDeSet } from './catalogo-series.js'
import { chapaDeEstadoHtml } from './estado-chapa.js'
import { chapaDeGradeoHtml } from './gradeo-elegir.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'
import { DONDE_VENTA, PAGOS_VENTA, precioQueCuenta, ofertaDe, pareceSku, cuentaDeMostrador, precioCobrado, repartirTotal } from './tiendas-puro.js'
import { modoHtml, pagosHtml, recordado, recordar, abrirComprarRapido } from './tienda-mostrador.js'

const CLAVE_DONDE = 'pd-tienda-donde'
const CLAVE_PAGO = 'pd-tienda-pago-venta'
const $ = (sel) => dialogo?.querySelector(sel)
let dialogo = null
let lineas = []
let donde = 'mostrador'
let pago = 'efectivo'
let alVender = null
let porPoner = new Set()
// Sin la migración 1254 no hay forma de pago: se deja de preguntar.
let sinPago = false
const sets = new Map()

// «151 · 199 · ES · NM · Reverse holo» (o «Sellado · EN»).
export function detalleDeLinea(f, nombreSet = (id) => id || '') {
  if (f.product_id) return ['Sellado', String(f.idioma || '').toUpperCase()].filter(Boolean).join(' · ')
  return [
    f.set_id ? nombreSet(f.set_id) : '', f.numero, String(f.idioma || '').toUpperCase(), f.estado,
    f.variante && f.variante !== 'normal' ? nombreDeVariante(f.variante) : '', f.gradeo || '',
  ].filter(Boolean).join(' · ')
}

// Lo mismo, con las chapas de la web (idioma, estado o casa y nota) delante.
function chapasHtml(f) {
  if (f.product_id) return `<span class="tdm-idi">${escapeHtml(String(f.idioma || '').toUpperCase())}</span><span>Sellado</span>`
  return `<span class="tdm-idi">${escapeHtml(String(f.idioma || '').toUpperCase())}</span>${f.gradeo ? chapaDeGradeoHtml(f.gradeo) : chapaDeEstadoHtml(f.estado)}<span>${escapeHtml([f.set_id ? nombreSet(f.set_id) : '', f.numero, f.variante && f.variante !== 'normal' ? nombreDeVariante(f.variante) : ''].filter(Boolean).join(' · '))}</span>`
}

// Los nombres de los sets y, a la vez, lo que hace falta para la FOTO de cada
// línea (PINGU: «para reconocerlo visualmente, igual que en comprar»): la
// carta del catálogo (por su mercado) o el producto.
async function completarSets(filas) {
  const faltan = [...new Set(filas.map((f) => f.set_id).filter((id) => id && !sets.has(id)))]
  const nombres = async () => {
    if (!faltan.length) return
    const { data } = await supabase.from('tcg_sets').select('id,name,name_en,market').in('id', faltan)
    for (const s of data || []) sets.set(s.id, nombreDeSet(s) || s.id)
  }
  await Promise.all([nombres().catch(() => {}), completarFotos(filas).catch(() => {})])
}
const cartas = new Map()
const productos = new Map()
const claveCarta = (f) => `${f.market === 'JP' ? 'JP' : 'WEST'}|${f.card_id}`
async function completarFotos(filas) {
  const porMercado = { WEST: [], JP: [] }
  for (const f of filas) if (f.card_id && !cartas.has(claveCarta(f))) porMercado[f.market === 'JP' ? 'JP' : 'WEST'].push(f.card_id)
  const prods = [...new Set(filas.filter((f) => f.product_id && !productos.has(String(f.product_id))).map((f) => f.product_id))]
  const deMercado = async (market, ids) => {
    const { data } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA_DE_SET).eq('market', market).in('id', [...new Set(ids)].slice(0, 150))
    for (const c of data || []) cartas.set(`${market}|${c.id}`, c)
  }
  const deProductos = async () => {
    const { data } = await supabase.from('tcg_products').select('id,image').in('id', prods)
    for (const p of data || []) productos.set(String(p.id), p)
  }
  await Promise.all([
    ...Object.entries(porMercado).filter(([, ids]) => ids.length).map(([m, ids]) => deMercado(m, ids)),
    prods.length ? deProductos() : null,
  ])
}
// En su caja: si ninguna foto contesta, queda el hueco con su forma (la 441).
function fotoHtml(f) {
  if (f.product_id) {
    const p = productos.get(String(f.product_id))
    return `<span class="tdc-foto tdc-foto-producto">${p?.image ? `<img src="${escapeHtml(p.image)}" alt="" width="40" height="40" loading="lazy" onerror="this.remove()" />` : ''}</span>`
  }
  const c = cartas.get(claveCarta(f))
  const attrs = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : null
  return `<span class="tdc-foto">${attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" />` : ''}</span>`
}
const nombreSet = (id) => sets.get(id) || id

// Lo comprado y aún por poner a la venta (1255) no se vende: sin la migración
// la columna no existe y no hay ninguna (no es un fallo).
async function cargarPorPoner() {
  const { data, error } = await supabase.from('tienda_stock').select('id').eq('por_poner', true).limit(1000)
  porPoner = new Set(error ? [] : (data || []).map((f) => f.id))
}

function montar() {
  if (dialogo) return dialogo
  hojaInyectada('css/tienda-vender.css')
  hojaInyectada('css/tienda-mostrador.css')
  dialogo = document.createElement('dialog')
  dialogo.className = 'tdv tdm-hoja tdm-hoja-vender'
  dialogo.setAttribute('aria-labelledby', 'tdvTitulo')
  dialogo.innerHTML = `
    <div class="tdv-caja">
      <header class="tdv-cab tdm-cab"><h2 id="tdvTitulo" class="sr-only">Vender</h2>${modoHtml('vender')}<button type="button" class="tdv-cerrar" data-tdv="cerrar" aria-label="Cerrar">&times;</button></header>
      <div class="tdv-cuerpo">
        <div class="tdm-busca-caja"><input type="search" class="tdv-busca tdm-busca" id="tdvBusca" placeholder="Busca en tu stock o escanea la etiqueta" aria-label="Busca en tu stock o escanea la etiqueta" autocomplete="off" /></div>
        <ul class="tdv-resultados" id="tdvResultados" hidden></ul>
        <ul class="tdv-lineas" id="tdvLineas"></ul>
        <label class="tdm-total" id="tdvTotalCaja" hidden>Todo junto por<span><input type="number" inputmode="decimal" min="0" step="0.01" data-total placeholder="—" /> €</span></label>
        <div id="tdvPago"></div>
        <div class="tdv-cuenta tdm-suma" id="tdvCuenta"></div>
        <label class="tdm-donde">Vendido en <select data-donde aria-label="Dónde se vende">${DONDE_VENTA.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
      </div>
      <footer class="tdv-pie"><p class="tdv-error" id="tdvError" role="alert"></p><button type="button" class="btn-primary tdv-vendida tdm-boton-vender" id="tdvVendida" disabled>Vendida</button></footer>
    </div>`
  document.body.appendChild(dialogo)

  let espera = null
  let pedido = 0
  $('#tdvBusca').addEventListener('input', (e) => {
    clearTimeout(espera)
    const q = e.target.value.trim()
    if (!q) {
      $('#tdvResultados').hidden = true
      return
    }
    espera = setTimeout(async () => {
      const yo = ++pedido
      const { data, error } = await supabase.rpc('tienda_stock_lista', { p_filtros: { q, unidades: ['una', 'varias'] }, p_orden: 'nombre', p_desde: 0, p_cuantas: 30 })
      if (yo !== pedido) return
      const caja = $('#tdvResultados')
      caja.hidden = false
      if (error || !data) {
        caja.innerHTML = '<li class="tdv-nada">No se ha podido buscar. Inténtalo de nuevo.</li>'
        return
      }
      const filas = (data.filas || []).filter((f) => !porPoner.has(f.id))
      await completarSets(filas)
      if (yo !== pedido) return
      caja.innerHTML = filas.length
        ? filas.map((f) => `<li><button type="button" class="tdv-resultado tdm-resultado tdm-res-foto" data-fila='${escapeHtml(JSON.stringify(f))}'>${fotoHtml(f)}<span class="tdm-res-que"><strong>${escapeHtml(f.nombre || f.card_id || 'Producto')}</strong><small class="tdm-chapas">${chapasHtml(f)} · ${f.unidades} ${f.unidades === 1 ? 'ud.' : 'uds.'}</small></span><span class="tdv-res-der">${precioQueCuenta(f) != null ? `<b>${euros(precioQueCuenta(f))}</b><small>${ofertaDe(f) ? 'de oferta' : 'tu precio'}</small>` : '<small>Sin precio</small>'}</span></button></li>`).join('')
        : `<li class="tdv-nada">Nada con unidades en tu stock que case con «${escapeHtml(q)}».</li>`
    }, 200)
  })

  // Un lector de códigos (1253) escribe el SKU de la etiqueta y un Intro: la
  // línea entra en la venta sin elegirla (y otra vez, otra unidad).
  $('#tdvBusca').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !pareceSku(e.target.value)) return
    e.preventDefault()
    clearTimeout(espera)
    pedido++
    const sku = e.target.value.trim().toUpperCase()
    e.target.value = ''
    $('#tdvResultados').hidden = true
    anadirPorSku(sku)
  })

  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo || e.target.closest('[data-tdv="cerrar"]')) return dialogo.close()
    // Comprar es la otra mitad del mostrador.
    const modo = e.target.closest('[data-modo="comprar"]')
    if (modo) {
      dialogo.close()
      return abrirComprarRapido()
    }
    const res = e.target.closest('.tdv-resultado')
    if (res) {
      anadir(JSON.parse(res.dataset.fila))
      $('#tdvBusca').value = ''
      $('#tdvResultados').hidden = true
      $('#tdvBusca').focus()
      return
    }
    const p = e.target.closest('[data-pago]')
    if (p) {
      pago = p.dataset.pago
      recordar(CLAVE_PAGO, pago)
      return pintarPago()
    }
    const paso = e.target.closest('[data-paso]')
    if (paso) {
      const l = lineaDe(paso)
      l.vender = Math.min(l.unidades, Math.max(1, l.vender + Number(paso.dataset.paso)))
      return repartirSiHayTotal() || pintarLineas()
    }
    const quitar = e.target.closest('[data-quitar]')
    if (quitar) {
      lineas = lineas.filter((x) => x !== lineaDe(quitar))
      return repartirSiHayTotal() || pintarLineas()
    }
    if (e.target.closest('#tdvVendida')) vender()
  })
  dialogo.addEventListener('input', (e) => {
    if (e.target.matches('[data-precio]')) {
      const l = lineaDe(e.target)
      l.cobrar = e.target.value === '' ? null : Number(String(e.target.value).replace(',', '.'))
      $('[data-total]').value = ''
      return pintarCuenta()
    }
    if (e.target.matches('[data-total]')) {
      // Un total borrado vuelve a «a su precio».
      if (!repartirSiHayTotal() && e.target.value === '') {
        for (const l of lineas) l.cobrar = null
        pintarLineas()
      }
    }
  })
  dialogo.addEventListener('change', (e) => {
    if (!e.target.matches('[data-donde]')) return
    donde = e.target.value
    recordar(CLAVE_DONDE, donde)
  })
  return dialogo
}

const lineaDe = (el) => lineas.find((x) => x.id === el.closest('[data-linea]').dataset.linea)

// «Las dos por 280»: el total se reparte según el precio de cada una.
function repartirSiHayTotal() {
  const t = $('[data-total]')?.value
  if (t == null || t === '' || !(Number(t) >= 0) || lineas.length < 2) return false
  const r = repartirTotal(lineas.map((l) => ({ unidades: l.vender, cm: l.lista })), Number(t))
  lineas.forEach((l, i) => { l.cobrar = r[i] })
  pintarLineas()
  return true
}

// Por SKU: la primera línea con unidades que aún no va entera en la venta.
// La fila completa (precio, oferta, coste) sale de la lista del stock, la
// misma que da el buscador.
async function anadirPorSku(sku) {
  const r = await supabase.rpc('tienda_sku_buscar', { p_tienda: null, p_sku: sku })
  if (r.error) return showToast(/tienda_sku_buscar|schema cache|does not exist/i.test(r.error.message || '') ? 'Para vender por SKU falta un paso en la base (la migración 1253).' : 'No se ha podido buscar ese SKU.', 'error')
  const libre = (r.data || []).find((f) => f.unidades > 0 && !porPoner.has(f.id) && (lineas.find((l) => l.id === f.id)?.vender || 0) < f.unidades)
  if (!libre) return showToast((r.data || []).length ? `No te quedan más de ${sku}.` : `Nada en tu stock con el SKU ${sku}.`, 'info')
  const { data } = await supabase.rpc('tienda_stock_lista', { p_filtros: { q: libre.nombre || '', unidades: ['una', 'varias'] }, p_orden: 'nombre', p_desde: 0, p_cuantas: 100 })
  const f = (data?.filas || []).find((x) => x.id === libre.id)
  if (!f) return showToast('No se ha podido añadir esa carta. Búscala por su nombre.', 'error')
  await completarSets([f])
  anadir(f)
  $('#tdvBusca').focus()
}

const nueva = (f) => ({ ...f, vender: 1, lista: precioQueCuenta(f), cobrar: null })

function anadir(f) {
  const ya = lineas.find((x) => x.id === f.id)
  if (ya) ya.vender = Math.min(ya.unidades, ya.vender + 1)
  else lineas.push(nueva(f))
  repartirSiHayTotal() || pintarLineas()
}

function pintarPago() {
  $('#tdvPago').innerHTML = sinPago ? '' : pagosHtml(PAGOS_VENTA, pago, 'Te paga con')
}

const dinero = (n) => (n == null ? '' : Number(n).toFixed(2))

function pintarLineas() {
  const caja = $('#tdvLineas')
  caja.innerHTML = lineas.length
    ? lineas.map((l) => `<li class="tdv-linea tdm-linea" data-linea="${escapeHtml(l.id)}">
        <div class="tdm-linea-cab">${fotoHtml(l)}<div class="tdv-linea-que"><strong>${escapeHtml(l.nombre || l.card_id || 'Producto')}</strong><small class="tdm-chapas">${chapasHtml(l)} · te ${l.unidades === 1 ? 'queda 1' : `quedan ${l.unidades}`}</small></div><button type="button" class="tdv-quitar" data-quitar aria-label="Quitar ${escapeHtml(l.nombre || '')}">&times;</button></div>
        <div class="tdm-dos-campos">
          <span class="tdm-campo tdm-campo-fijo"><span>Tu precio</span><b>${l.lista != null ? euros(l.lista) : '—'}</b></span>
          <label class="tdm-campo"><span>Vendido por</span><span class="tdm-input"><input type="number" inputmode="decimal" min="0" step="0.01" data-precio value="${dinero(l.cobrar)}" placeholder="${l.lista != null ? dinero(l.lista).replace('.', ',') : 'Precio'}" /> €</span></label>
        </div>
        ${l.unidades > 1 ? `<div class="tdm-uds"><span>Unidades</span><span class="tdv-paso" role="group" aria-label="Unidades"><button type="button" data-paso="-1" aria-label="Una menos" ${l.vender <= 1 ? 'disabled' : ''}>−</button><b aria-live="polite">${l.vender}</b><button type="button" data-paso="1" aria-label="Una más" ${l.vender >= l.unidades ? 'disabled' : ''}>+</button></span></div>` : ''}
        <small class="tdv-coste">${l.coste != null ? `Te costó ${euros(l.coste)}` : 'Sin coste: no se sabrá lo que ganas'}</small>
      </li>`).join('')
    : '<li class="tdv-nada">Busca una carta de tu stock (o escanea su etiqueta) para venderla.</li>'
  $('#tdvTotalCaja').hidden = lineas.length < 2
  pintarCuenta()
}

function pintarCuenta() {
  const c = cuentaDeMostrador(lineas)
  const falta = lineas.some((l) => precioCobrado(l) == null || precioCobrado(l) < 0)
  $('#tdvCuenta').innerHTML = lineas.length
    ? `<div><span>A tu precio</span><b>${euros(c.aTuPrecio)}</b></div>
       ${c.rebaja > 0 ? `<div><span>Rebaja</span><b class="tdv-rojo">−${euros(c.rebaja)}</b></div>` : ''}
       <div class="tdm-suma-grande"><span>Cobras</span><b>${euros(c.cobras)}</b></div>
       ${c.beneficio != null ? `<div><span>Ganas</span><b class="${c.beneficio < 0 ? 'tdv-rojo' : 'tdv-verde'}">${c.beneficio > 0 ? '+' : ''}${euros(c.beneficio)}</b></div>` : ''}`
    : ''
  $('#tdvVendida').disabled = !lineas.length || falta
  $('#tdvVendida').textContent = lineas.length ? `Vendida · ${euros(c.cobras)}` : 'Vendida'
  $('#tdvError').textContent = falta ? 'Una carta no tiene precio: escribe en «Vendido por».' : ''
}

const sinFuncion = (error) => ['PGRST202', '42883'].includes(error?.code) || /Could not find|does not exist/i.test(error?.message || '')

async function vender() {
  const boton = $('#tdvVendida')
  boton.disabled = true
  const pedidas = lineas.map((l) => ({ stock_id: l.id, unidades: l.vender, precio: precioCobrado(l) }))
  let { data, error } = sinPago ? { error: { code: 'PGRST202' } } : await supabase.rpc('tienda_vender', { p_lineas: pedidas, p_donde: donde, p_pago: pago })
  // Sin la 1254 no hay forma de pago: se vende como antes.
  if (error && sinFuncion(error)) {
    ;({ data, error } = await supabase.rpc('tienda_vender', { p_lineas: pedidas, p_donde: donde }))
    if (!error) {
      sinPago = true
      pintarPago()
    }
  }
  if (error || !data?.ticket) {
    boton.disabled = false
    $('#tdvError').textContent = sinFuncion(error) ? 'Falta un paso en la base para vender (la migración 1072).' : error?.message || 'No se ha podido apuntar la venta.'
    return
  }
  const vendidas = lineas
  // La hoja se queda abierta y vacía: el siguiente cliente ya está delante.
  lineas = []
  $('[data-total]').value = ''
  pintarLineas()
  $('#tdvBusca').focus()
  alVender?.(data)
  const unidades = vendidas.reduce((n, l) => n + l.vender, 0)
  const como = data.pago ? ` · ${PAGOS_VENTA.find(([v]) => v === data.pago)?.[1].toLowerCase()}` : ''
  showToast(`Vendida${unidades > 1 ? `s ${unidades}` : ''} · ${euros(data.total)}${como}`, 'success', {
    acciones: [
      { texto: 'Deshacer', alPulsar: () => deshacerVenta(data.ticket).then(() => alVender?.(null), () => {}) },
      // El recibo para quien compra (1084).
      { texto: 'Recibo', alPulsar: () => import('./tienda-recibo.js').then((m) => m.abrirRecibo(data.ticket)).catch(() => showToast('No se ha podido hacer el recibo.', 'error')) },
    ],
  })
}

// Deshacer una venta: vuelve todo al stock (la venta se borra).
export async function deshacerVenta(ticket) {
  const { data, error } = await supabase.rpc('tienda_deshacer_venta', { p_ticket: ticket })
  if (error) {
    showToast(error.message || 'No se ha podido deshacer.', 'error')
    throw error
  }
  showToast(data?.devueltas ? 'Deshecha: las unidades vuelven a tu stock.' : 'Deshecha.', 'success')
  return data
}

// `filas`: líneas del stock ya elegidas (de la ficha o de «Seleccionar»).
// `escanear`: desde «Escanear etiqueta», el cursor espera al lector.
export function abrirVender({ filas = [], alTerminar = null, escanear = false } = {}) {
  montar()
  alVender = alTerminar
  donde = recordado(CLAVE_DONDE, DONDE_VENTA.map(([v]) => v), 'mostrador')
  pago = recordado(CLAVE_PAGO, PAGOS_VENTA.map(([v]) => v), 'efectivo')
  lineas = []
  for (const f of filas) if (f.unidades > 0) lineas.push(nueva(f))
  $('[data-donde]').value = donde
  $('[data-total]').value = ''
  completarSets(lineas).then(() => pintarLineas())
  pintarPago()
  pintarLineas()
  cargarPorPoner().catch(() => {})
  const busca = $('#tdvBusca')
  busca.value = ''
  busca.placeholder = escanear ? 'Escanea la etiqueta…' : 'Busca en tu stock o escanea la etiqueta'
  $('#tdvResultados').hidden = true
  if (!dialogo.open) dialogo.showModal()
  if (!lineas.length) busca.focus()
}
