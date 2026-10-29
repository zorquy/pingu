// VENDER (tanda 1072): apuntar una venta en tres toques. Se busca en el
// stock (solo lo que tiene unidades), el precio sale puesto con el de la
// línea (el de su oferta mientras dure, 1082), se elige dónde (Mostrador,
// Cardmarket, Evento u Otro) y «Vendida» resta las unidades y apunta la
// venta con lo que costó (`tienda_vender`, todo o nada). Después, Deshacer.
//
// Entra por `import()` desde /tienda (el botón Vender de arriba, el de la
// barra del móvil, la ficha de una línea y «Seleccionar» del stock).
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { euros } from './cardmarket.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { nombreDeSet } from './catalogo-series.js'
import { DONDE_VENTA, cuentaDeVenta, precioQueCuenta, ofertaDe } from './tiendas-puro.js'

const CLAVE_DONDE = 'pd-tienda-donde'
const $ = (sel) => dialogo?.querySelector(sel)
let dialogo = null
let lineas = []
let donde = 'mostrador'
let alVender = null
const sets = new Map()

function dondeRecordado() {
  try { return localStorage.getItem(CLAVE_DONDE) || 'mostrador' } catch { return 'mostrador' }
}

// «151 · 199 · ES · NM · Reverse holo» (o «Sellado · EN»).
export function detalleDeLinea(f, nombreSet = (id) => id || '') {
  if (f.product_id) return ['Sellado', String(f.idioma || '').toUpperCase()].filter(Boolean).join(' · ')
  return [
    f.set_id ? nombreSet(f.set_id) : '', f.numero, String(f.idioma || '').toUpperCase(), f.estado,
    f.variante && f.variante !== 'normal' ? nombreDeVariante(f.variante) : '', f.gradeo || '',
  ].filter(Boolean).join(' · ')
}

async function completarSets(filas) {
  const faltan = [...new Set(filas.map((f) => f.set_id).filter((id) => id && !sets.has(id)))]
  if (!faltan.length) return
  const { data } = await supabase.from('tcg_sets').select('id,name,name_en,market').in('id', faltan)
  for (const s of data || []) sets.set(s.id, nombreDeSet(s) || s.id)
}
const nombreSet = (id) => sets.get(id) || id

function montar() {
  if (dialogo) return dialogo
  hojaInyectada('css/tienda-vender.css')
  dialogo = document.createElement('dialog')
  dialogo.className = 'tdv'
  dialogo.setAttribute('aria-labelledby', 'tdvTitulo')
  dialogo.innerHTML = `
    <div class="tdv-caja">
      <header class="tdv-cab"><h2 id="tdvTitulo">Vender</h2><span class="tdc-cab-der"><button type="button" class="link-btn" data-tdv="comprar">Comprar a un cliente</button><button type="button" class="tdv-cerrar" data-tdv="cerrar" aria-label="Cerrar">&times;</button></span></header>
      <div class="tdv-cuerpo">
        <input type="search" class="tdv-busca" id="tdvBusca" placeholder="Busca en tu stock…" aria-label="Busca en tu stock" autocomplete="off" />
        <ul class="tdv-resultados" id="tdvResultados" hidden></ul>
        <ul class="tdv-lineas" id="tdvLineas"></ul>
        <div class="tdv-donde" role="group" aria-label="Dónde se vende">${DONDE_VENTA.map(([v, t]) => `<button type="button" class="tdv-chip" data-donde="${v}" aria-pressed="false">${t}</button>`).join('')}</div>
        <div class="tdv-cuenta" id="tdvCuenta"></div>
      </div>
      <footer class="tdv-pie"><p class="tdv-error" id="tdvError" role="alert"></p><button type="button" class="btn-primary tdv-vendida" id="tdvVendida" disabled>Vendida</button></footer>
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
      const { data, error } = await supabase.rpc('tienda_stock_lista', { p_filtros: { q, unidades: ['una', 'varias'] }, p_orden: 'nombre', p_desde: 0, p_cuantas: 20 })
      if (yo !== pedido) return
      const caja = $('#tdvResultados')
      caja.hidden = false
      if (error || !data) {
        caja.innerHTML = '<li class="tdv-nada">No se ha podido buscar. Inténtalo de nuevo.</li>'
        return
      }
      await completarSets(data.filas || [])
      if (yo !== pedido) return
      caja.innerHTML = (data.filas || []).length
        ? data.filas.map((f) => `<li><button type="button" class="tdv-resultado" data-fila='${escapeHtml(JSON.stringify(f))}'><span><strong>${escapeHtml(f.nombre || f.card_id || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(f, nombreSet))}</small></span><span class="tdv-res-der">${precioQueCuenta(f) != null ? `<b>${ofertaDe(f) ? 'Oferta · ' : ''}${euros(precioQueCuenta(f))}</b>` : ''}<small>${f.unidades} ${f.unidades === 1 ? 'ud.' : 'uds.'}</small></span></button></li>`).join('')
        : `<li class="tdv-nada">Nada con unidades que case con «${escapeHtml(q)}».</li>`
    }, 220)
  })

  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo || e.target.closest('[data-tdv="cerrar"]')) return dialogo.close()
    // Comprar (1091) es la otra mitad del mostrador.
    if (e.target.closest('[data-tdv="comprar"]')) {
      dialogo.close()
      return document.dispatchEvent(new CustomEvent('pokedoc:tienda-comprar'))
    }
    const res = e.target.closest('.tdv-resultado')
    if (res) {
      anadir(JSON.parse(res.dataset.fila))
      $('#tdvBusca').value = ''
      $('#tdvResultados').hidden = true
      $('#tdvBusca').focus()
      return
    }
    const chip = e.target.closest('[data-donde]')
    if (chip) {
      donde = chip.dataset.donde
      try { localStorage.setItem(CLAVE_DONDE, donde) } catch {}
      return pintarDonde()
    }
    const paso = e.target.closest('[data-paso]')
    if (paso) {
      const l = lineas.find((x) => x.id === paso.closest('[data-linea]').dataset.linea)
      l.vender = Math.min(l.unidades, Math.max(1, l.vender + Number(paso.dataset.paso)))
      return pintarLineas()
    }
    const quitar = e.target.closest('[data-quitar]')
    if (quitar) {
      lineas = lineas.filter((x) => x.id !== quitar.closest('[data-linea]').dataset.linea)
      return pintarLineas()
    }
    if (e.target.closest('#tdvVendida')) vender()
  })
  dialogo.addEventListener('input', (e) => {
    if (!e.target.matches('[data-precio]')) return
    const l = lineas.find((x) => x.id === e.target.closest('[data-linea]').dataset.linea)
    l.cobrar = e.target.value === '' ? null : Number(String(e.target.value).replace(',', '.'))
    pintarCuenta()
  })
  return dialogo
}

function anadir(f) {
  const ya = lineas.find((x) => x.id === f.id)
  if (ya) ya.vender = Math.min(ya.unidades, ya.vender + 1)
  else lineas.push({ ...f, vender: 1, cobrar: precioQueCuenta(f) })
  pintarLineas()
}

function pintarDonde() {
  for (const b of dialogo.querySelectorAll('[data-donde]')) b.setAttribute('aria-pressed', String(b.dataset.donde === donde))
}

function pintarLineas() {
  const caja = $('#tdvLineas')
  caja.innerHTML = lineas.length
    ? lineas.map((l) => `<li class="tdv-linea" data-linea="${escapeHtml(l.id)}">
        <div class="tdv-linea-que"><strong>${escapeHtml(l.nombre || l.card_id || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(l, nombreSet))} · quedan ${l.unidades}</small></div>
        <div class="tdv-linea-mandos">
          <span class="tdv-paso" role="group" aria-label="Unidades"><button type="button" data-paso="-1" aria-label="Una menos" ${l.vender <= 1 ? 'disabled' : ''}>−</button><b aria-live="polite">${l.vender}</b><button type="button" data-paso="1" aria-label="Una más" ${l.vender >= l.unidades ? 'disabled' : ''}>+</button></span>
          <label class="tdv-precio"><span class="sr-only">Precio por unidad</span><input type="number" inputmode="decimal" min="0" step="0.01" data-precio value="${l.cobrar ?? ''}" placeholder="Precio" /> €</label>
          <button type="button" class="tdv-quitar" data-quitar aria-label="Quitar ${escapeHtml(l.nombre || '')}">&times;</button>
        </div>
        <small class="tdv-coste">${l.coste != null ? `Te costó ${euros(l.coste)}` : 'Sin coste: no se sabrá el beneficio'}</small>
      </li>`).join('')
    : '<li class="tdv-nada">Busca una carta de tu stock para venderla.</li>'
  pintarCuenta()
}

function pintarCuenta() {
  const c = cuentaDeVenta(lineas.map((l) => ({ unidades: l.vender, precio: l.cobrar, coste: l.coste })))
  const falta = lineas.some((l) => l.cobrar == null || !Number.isFinite(l.cobrar) || l.cobrar < 0)
  $('#tdvCuenta').innerHTML = lineas.length
    ? `<span><small>Total</small><b>${euros(c.importe)}</b></span>
       <span><small>Beneficio</small><b class="${c.beneficio < 0 ? 'tdv-rojo' : 'tdv-verde'}">${c.beneficio == null ? '—' : `${c.beneficio > 0 ? '+' : ''}${euros(c.beneficio)}`}</b>${c.margen != null ? `<small>${c.margen} %</small>` : ''}</span>`
    : ''
  $('#tdvVendida').disabled = !lineas.length || falta
  $('#tdvVendida').textContent = lineas.length ? `Vendida · ${euros(c.importe)}` : 'Vendida'
  $('#tdvError').textContent = falta ? 'Pon el precio de cada línea.' : ''
}

async function vender() {
  const boton = $('#tdvVendida')
  boton.disabled = true
  const pedidas = lineas.map((l) => ({ stock_id: l.id, unidades: l.vender, precio: l.cobrar }))
  const { data, error } = await supabase.rpc('tienda_vender', { p_lineas: pedidas, p_donde: donde })
  if (error || !data?.ticket) {
    boton.disabled = false
    const sin = ['PGRST202', '42883'].includes(error?.code) || /Could not find/i.test(error?.message || '')
    $('#tdvError').textContent = sin ? 'Falta un paso en la base para vender (la migración 1072).' : error?.message || 'No se ha podido apuntar la venta.'
    return
  }
  const vendidas = lineas
  lineas = []
  dialogo.close()
  alVender?.(data)
  const unidades = vendidas.reduce((n, l) => n + l.vender, 0)
  showToast(`Vendida${unidades > 1 ? `s ${unidades}` : ''} · ${euros(data.total)}${data.beneficio && data.lineas > data.sin_coste ? ` · ${data.beneficio > 0 ? '+' : ''}${euros(data.beneficio)}` : ''}`, 'success', {
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
export function abrirVender({ filas = [], alTerminar = null } = {}) {
  montar()
  alVender = alTerminar
  donde = dondeRecordado()
  lineas = []
  for (const f of filas) if (f.unidades > 0) lineas.push({ ...f, vender: 1, cobrar: precioQueCuenta(f) })
  completarSets(lineas).then(() => pintarLineas())
  pintarDonde()
  pintarLineas()
  $('#tdvBusca').value = ''
  $('#tdvResultados').hidden = true
  if (!dialogo.open) dialogo.showModal()
  if (!lineas.length) $('#tdvBusca').focus()
}
