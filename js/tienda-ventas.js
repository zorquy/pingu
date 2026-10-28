// /tienda → Ventas (tanda 1072): lo vendido, con lo que dejó. El periodo
// (hoy, 7 días, el mes, el año o todo), dónde se vendió y una búsqueda; las
// sumas de arriba son las de TODO lo filtrado (las hace la base,
// `tienda_ventas_lista`), no solo de lo que se ve. Cada venta se deshace
// (vuelve al stock) y la lista se exporta en CSV.
//
// Desde la 1088 (PINGU: «sin pisos de botones»), arriba una fila: el
// periodo y dónde en dos desplegables, la búsqueda y exportar; y una venta se
// toca para abrir su hoja, con el recibo y deshacer.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { euros } from './cardmarket.js'
import { nombreDeSet } from './catalogo-series.js'
import { DONDE_VENTA, PERIODOS, rangoDePeriodo, csvDeVentas } from './tiendas-puro.js'
import { detalleDeLinea } from './tienda-vender.js'

const POR_PAGINA = 100
const est = { periodo: 'mes', donde: [], q: '', filas: [], total: 0, pedido: 0, dato: null }
const sets = new Map()
let caja = null
let perfil = null
const $ = (sel) => caja.querySelector(sel)
const nombreSet = (id) => sets.get(id) || id
const NOMBRE_DONDE = Object.fromEntries(DONDE_VENTA)

function filtros() {
  const f = { ...rangoDePeriodo(est.periodo) }
  if (!f.desde) delete f.desde
  if (!f.hasta) delete f.hasta
  if (est.donde.length) f.donde = est.donde
  if (est.q) f.q = est.q
  return f
}

async function completarSets(filas) {
  const faltan = [...new Set(filas.map((f) => f.set_id).filter((id) => id && !sets.has(id)))]
  if (!faltan.length) return
  const { data } = await supabase.from('tcg_sets').select('id,name,name_en,market').in('id', faltan)
  for (const s of data || []) sets.set(s.id, nombreDeSet(s) || s.id)
}

async function pedir({ mas = false } = {}) {
  const yo = ++est.pedido
  const { data, error } = await supabase.rpc('tienda_ventas_lista', { p_filtros: filtros(), p_desde: mas ? est.filas.length : 0, p_cuantas: POR_PAGINA })
  if (yo !== est.pedido) return
  if (error || !data) {
    const sin = ['PGRST202', '42883'].includes(error?.code) || /Could not find/i.test(error?.message || '')
    $('.tdvt-lista').innerHTML = `<p class="tdvt-vacio">${sin ? 'Falta un paso en la base para apuntar ventas (la migración 1072).' : 'No se han podido traer tus ventas. Recarga la página.'}</p>`
    $('.tdvt-cifras').innerHTML = ''
    return
  }
  await completarSets(data.filas || [])
  if (yo !== est.pedido) return
  est.dato = data
  est.total = data.total
  est.filas = mas ? [...est.filas, ...(data.filas || [])] : data.filas || []
  pintar()
}

// «Hoy», «Ayer» o «mar 21 oct»: el día de la venta, en la hora de quien mira.
export function rotuloDeDia(fecha, ahora = new Date()) {
  const d = new Date(fecha)
  const sinHora = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((sinHora(ahora) - sinHora(d)) / 864e5)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== ahora.getFullYear() ? { year: 'numeric' } : {}) })
}

function filaHtml(f) {
  const beneficio = f.coste == null ? null : Math.round((Number(f.precio) - Number(f.coste)) * f.unidades * 100) / 100
  const hora = new Date(f.vendida_el).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `<li><button type="button" class="tdvt-fila" data-venta="${escapeHtml(f.id)}" aria-label="${escapeHtml(f.nombre || 'Producto')}: la venta, el recibo y deshacer">
    <span class="tdvt-hora">${hora}</span>
    <span class="tdvt-que"><strong>${escapeHtml(f.nombre || f.card_id || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(f, nombreSet))} · ${escapeHtml(NOMBRE_DONDE[f.donde] || f.donde)}</small></span>
    <span class="tdvt-uds">${f.unidades > 1 ? `${f.unidades} × ${euros(f.precio)}` : ''}</span>
    <span class="tdvt-importe"><b>${euros(Number(f.precio) * f.unidades)}</b>${beneficio == null ? '<small class="tdvt-sin">sin coste</small>' : `<small class="${beneficio < 0 ? 'tdvt-rojo' : 'tdvt-verde'}">${beneficio > 0 ? '+' : ''}${euros(beneficio)}</small>`}</span>
    <span class="tdvt-ir" aria-hidden="true">${icons.chevronRight(16)}</span>
  </button></li>`
}

// La hoja de una venta (1088): todo su ticket (las líneas que se vendieron
// juntas), con el recibo y deshacer, que es de todo el ticket.
function abrirVenta(id) {
  const f = est.filas.find((x) => x.id === id)
  if (!f) return
  const lineas = est.filas.filter((x) => x.ticket === f.ticket)
  const total = lineas.reduce((n, l) => n + Number(l.precio) * l.unidades, 0)
  const conCoste = lineas.filter((l) => l.coste != null)
  const beneficio = conCoste.length ? conCoste.reduce((n, l) => n + (Number(l.precio) - Number(l.coste)) * l.unidades, 0) : null
  const fecha = new Date(f.vendida_el)
  let d = document.getElementById('tdvtHoja')
  if (!d) {
    d = document.createElement('dialog')
    d.id = 'tdvtHoja'
    d.className = 'tdvt-hoja'
    document.body.appendChild(d)
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-tdvt-cerrar]')) d.close() })
  }
  d.innerHTML = `
    <div class="tdvt-hoja-caja">
      <header class="tdvt-hoja-cab"><h2>${escapeHtml(lineas.length > 1 ? `${lineas.length} cartas` : f.nombre || 'Producto')} · ${euros(total)}</h2><button type="button" class="tds-cerrar" data-tdvt-cerrar aria-label="Cerrar">×</button></header>
      <p class="tdvt-hoja-cuando">${escapeHtml(rotuloDeDia(f.vendida_el))}, ${fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ${escapeHtml(NOMBRE_DONDE[f.donde] || f.donde)}${beneficio == null ? '' : ` · <span class="${beneficio < 0 ? 'tdvt-rojo' : 'tdvt-verde'}">${beneficio > 0 ? '+' : ''}${euros(beneficio)}</span>`}</p>
      <ul class="tdvt-hoja-lineas">${lineas.map((l) => `<li><span><strong>${escapeHtml(l.nombre || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(l, nombreSet))}</small></span><b>${l.unidades > 1 ? `${l.unidades} × ` : ''}${euros(l.precio)}</b></li>`).join('')}</ul>
      <div class="tdvt-hoja-botones">
        <button type="button" class="btn-primary" data-recibo="${escapeHtml(f.ticket)}">${icons.receipt(18)}<span>Recibo</span></button>
        <button type="button" class="btn-secondary tdvt-deshacer" data-deshacer="${escapeHtml(f.ticket)}">Deshacer la venta</button>
      </div>
    </div>`
  d.onclick = (e) => {
    const r = e.target.closest('[data-recibo]')
    if (r) import('./tienda-recibo.js').then((m) => m.abrirRecibo(r.dataset.recibo)).catch(() => showToast('No se ha podido hacer el recibo.', 'error'))
    const x = e.target.closest('[data-deshacer]')
    if (x) deshacer(x).then((hecho) => { if (hecho) d.close() })
  }
  d.showModal()
}

function pintar() {
  const s = est.dato?.sumas || {}
  const margen = s.coste > 0 ? Math.round((s.beneficio / s.coste) * 100) : null
  $('.tdvt-cifras').innerHTML = `
    <div class="tdvt-cifra"><small>Vendido</small><b>${euros(s.importe || 0)}</b><span>${est.dato?.tickets || 0} ${est.dato?.tickets === 1 ? 'venta' : 'ventas'}</span></div>
    <div class="tdvt-cifra"><small>Beneficio</small><b class="${s.beneficio < 0 ? 'tdvt-rojo' : ''}">${s.importe_con_coste > 0 ? `${s.beneficio > 0 ? '+' : ''}${euros(s.beneficio)}` : '—'}</b><span>${s.sin_coste ? `${s.sin_coste} sin coste, fuera de la cuenta` : 'sobre lo que pagaste'}</span></div>
    <div class="tdvt-cifra"><small>Margen</small><b>${margen == null ? '—' : `${margen} %`}</b><span>sobre lo pagado</span></div>
    <div class="tdvt-cifra"><small>Unidades</small><b>${s.unidades || 0}</b><span>${Object.entries(est.dato?.por_donde || {}).sort((a, b) => b[1] - a[1]).map(([d, v]) => `${NOMBRE_DONDE[d] || d} ${euros(v)}`).join(' · ') || '&nbsp;'}</span></div>`
  if (!est.filas.length) {
    $('.tdvt-lista').innerHTML = est.q || est.donde.length
      ? '<p class="tdvt-vacio">Ninguna venta cumple estos filtros.</p>'
      : `<div class="tdvt-vacio"><p>Aún no hay ventas ${est.periodo === 'todo' ? '' : 'en este periodo'}.</p><button type="button" class="btn-primary" data-tdvt="vender">Vender</button></div>`
    return
  }
  // Agrupadas por día: cada día con lo que se vendió.
  const dias = []
  for (const f of est.filas) {
    const r = rotuloDeDia(f.vendida_el)
    if (dias.at(-1)?.r !== r) dias.push({ r, filas: [] })
    dias.at(-1).filas.push(f)
  }
  $('.tdvt-lista').innerHTML = dias.map((d) => `<section class="tdvt-dia"><h3>${escapeHtml(d.r)}</h3><ul>${d.filas.map(filaHtml).join('')}</ul></section>`).join('') +
    (est.filas.length < est.total ? `<button type="button" class="btn-secondary tdvt-mas" data-tdvt="mas">Ver ${Math.min(POR_PAGINA, est.total - est.filas.length)} más</button>` : '')
}

function pintarMandos() {
  $('[data-tdvt-periodo]').value = est.periodo
  $('[data-tdvt-donde]').value = est.donde[0] || ''
}

async function exportar() {
  const { data, error } = await supabase.rpc('tienda_ventas_lista', { p_filtros: filtros(), p_desde: 0, p_cuantas: 5000 })
  if (error || !data) return showToast('No se han podido exportar las ventas.', 'error')
  await completarSets(data.filas || [])
  const csv = csvDeVentas(data.filas || [], nombreSet)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `ventas-${perfil?.username || 'tienda'}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

// Deshacer pide un segundo toque: devuelve unidades al stock. Dice si se hizo.
let armado = null
async function deshacer(boton) {
  const texto = 'Deshacer la venta'
  if (armado !== boton) {
    armado = boton
    boton.classList.add('armado')
    boton.textContent = '¿Seguro? Vuelve al stock'
    setTimeout(() => { if (armado === boton) { boton.classList.remove('armado'); boton.textContent = texto; armado = null } }, 4000)
    return false
  }
  armado = null
  boton.disabled = true
  const { deshacerVenta } = await import('./tienda-vender.js')
  try {
    await deshacerVenta(boton.dataset.deshacer)
    document.dispatchEvent(new CustomEvent('pokedoc:tienda-vendida'))
    return true
  } catch {
    boton.disabled = false
    return false
  }
}

export function montarVentas(destino, { perfil: p }) {
  caja = destino
  perfil = p
  caja.innerHTML = `
    <div class="tdvt">
      <div class="tdvt-arriba">
        <select class="tdvt-select" data-tdvt-periodo aria-label="Periodo">${PERIODOS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
        <select class="tdvt-select" data-tdvt-donde aria-label="Dónde se vendió">${[['', 'Dónde: todo'], ...DONDE_VENTA].map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
        <input type="search" class="tdvt-busca" data-tdvt-q placeholder="Buscar en tus ventas…" aria-label="Buscar en tus ventas" />
        <button type="button" class="btn-secondary tdvt-icono" data-tdvt="lupa" aria-label="Buscar en tus ventas" aria-expanded="false">${icons.search(18)}</button>
        <button type="button" class="btn-secondary tdvt-icono" data-tdvt="exportar" aria-label="Exportar a CSV" title="Exportar a CSV">${icons.arrowDown(18)}</button>
      </div>
      <div class="tdvt-cifras"></div>
      <div class="tdvt-lista"><p class="tdvt-vacio">Cargando tus ventas…</p></div>
    </div>`
  caja.addEventListener('change', (e) => {
    if (e.target.matches('[data-tdvt-periodo]')) { est.periodo = e.target.value; return pedir() }
    if (e.target.matches('[data-tdvt-donde]')) { est.donde = e.target.value ? [e.target.value] : []; return pedir() }
  })
  caja.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-tdvt]')?.dataset.tdvt
    if (accion === 'mas') return pedir({ mas: true })
    if (accion === 'exportar') return exportar()
    if (accion === 'vender') return document.dispatchEvent(new CustomEvent('pokedoc:tienda-vender'))
    // En el móvil la búsqueda va plegada tras su lupa.
    if (accion === 'lupa') {
      const abierta = caja.querySelector('.tdvt').classList.toggle('con-busca')
      e.target.closest('[data-tdvt]').setAttribute('aria-expanded', String(abierta))
      if (abierta) $('[data-tdvt-q]').focus()
      return
    }
    const venta = e.target.closest('[data-venta]')
    if (venta) abrirVenta(venta.dataset.venta)
  })
  let espera = null
  caja.addEventListener('input', (e) => {
    if (!e.target.matches('[data-tdvt-q]')) return
    clearTimeout(espera)
    espera = setTimeout(() => { est.q = e.target.value.trim(); pedir() }, 250)
  })
  document.addEventListener('pokedoc:tienda-vendida', () => pedir())
  pintarMandos()
  pedir()
}
