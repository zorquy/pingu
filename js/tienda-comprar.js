// COMPRAR A UN CLIENTE (tanda 1091). Alguien llega con un taco de cartas: la
// tienda las busca en TODO el catálogo (no en su stock), cada una sale con lo
// que vale en Cardmarket en su idioma y versión —orientativo, PINGU: «el
// precio de Cardmarket es orientativo»— y con lo que paga ella, un tanto por
// ciento que pone (se recuerda) o un total redondo que se reparte. «Comprada»
// mete cada línea en el stock con su coste de verdad (`tienda_comprar`, todo o
// nada), así que el beneficio de Ventas sale bien sin apuntar nada. Después,
// el recibo para quien las vende y Deshacer.
//
// Entra por `import()` desde /tienda (Vender ↔ Comprar, «+ Añadir» del Stock
// y Ventas → Compras). Usa la hoja de Vender (`css/tienda-vender.css`).
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { IDIOMAS, ESTADOS, euros, valorDe, precioDeFila, idiomasParaAnadirEn, versionesDelIdioma } from './cardmarket.js'
import { idiomasDeSetSinEsperar, reglasDeVersiones, sinReglas } from './idiomas-de-set.js'
import { variantesDeCarta, nombreDeVariante } from './mi-coleccion/variantes.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { buscarComoEnCartas } from './buscar-cartas.js'
import { buscarProductos } from './productos-valor.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'
import { pagoDeCompra, repartirTotal, cuentaDeCompra } from './tiendas-puro.js'

const COLUMNAS = COLUMNAS_CARTA_DE_SET.replace('tcg_sets(tcg_online_code,serie_id,release_date)', 'tcg_sets(name,name_en,tcg_online_code,serie_id,release_date,oculto)')
const OCCIDENTALES = ['es', 'en', 'fr', 'de', 'it', 'pt'].map((id) => IDIOMAS.find((i) => i.id === id))
const PCTS = [40, 50, 60, 70]
const CLAVE_PCT = 'pd-tienda-compra-pct'
const $ = (sel) => dialogo?.querySelector(sel)
let dialogo = null
let lineas = []
let pct = 50
let que = 'WEST'
let alComprar = null
let siguiente = 0
const encontrados = new Map()

function pctRecordado() {
  try {
    const crudo = localStorage.getItem(CLAVE_PCT)
    const v = Number(crudo)
    return crudo != null && crudo !== '' && v >= 0 && v <= 200 ? v : 50
  } catch {
    return 50
  }
}

function montar() {
  if (dialogo) return dialogo
  hojaInyectada('css/tienda-vender.css')
  dialogo = document.createElement('dialog')
  dialogo.className = 'tdv tdc'
  dialogo.setAttribute('aria-labelledby', 'tdcTitulo')
  dialogo.innerHTML = `
    <div class="tdv-caja">
      <header class="tdv-cab"><h2 id="tdcTitulo">Comprar</h2><span class="tdc-cab-der"><button type="button" class="link-btn" data-tdc="vender">Vender</button><button type="button" class="tdv-cerrar" data-tdc="cerrar" aria-label="Cerrar">&times;</button></span></header>
      <div class="tdv-cuerpo">
        <div class="tdc-busca-fila">
          <div class="tdv-donde" role="group" aria-label="Qué buscas">
            <button type="button" class="tdv-chip" data-que="WEST" aria-pressed="true">Cartas</button>
            <button type="button" class="tdv-chip" data-que="JP" aria-pressed="false">Japón</button>
            <button type="button" class="tdv-chip" data-que="sellado" aria-pressed="false">Sellado</button>
          </div>
          <input type="search" class="tdv-busca" id="tdcBusca" placeholder="Busca en el catálogo: nombre, número…" aria-label="Busca en el catálogo" autocomplete="off" />
        </div>
        <ul class="tdv-resultados" id="tdcResultados" hidden></ul>
        <ul class="tdv-lineas" id="tdcLineas"></ul>
        <div class="tdc-pct" role="group" aria-label="Lo que pagas de lo que vale en Cardmarket">
          <span>Pagas el</span>
          ${PCTS.map((v) => `<button type="button" class="tdv-chip" data-pct="${v}" aria-pressed="false">${v} %</button>`).join('')}
          <label class="tdc-otro"><span class="sr-only">Otro tanto por ciento</span><input type="number" inputmode="numeric" min="0" max="200" step="1" data-pct-otro placeholder="Otro" /> %</label>
        </div>
        <label class="tdc-campo">O un total redondo<span class="tdc-total-caja"><input type="number" inputmode="decimal" min="0" step="0.01" data-total placeholder="40" /> €</span></label>
        <label class="tdc-campo">A quién se las compras (opcional)<input type="text" maxlength="80" data-cliente placeholder="Un nombre o un @usuario" /></label>
        <div class="tdv-cuenta" id="tdcCuenta"></div>
      </div>
      <footer class="tdv-pie"><p class="tdv-error" id="tdcError" role="alert"></p><button type="button" class="btn-primary tdv-vendida" id="tdcComprada" disabled>Comprada</button></footer>
    </div>`
  document.body.appendChild(dialogo)

  let espera = null
  $('#tdcBusca').addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(buscar, 260)
  })
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo || e.target.closest('[data-tdc="cerrar"]')) return dialogo.close()
    if (e.target.closest('[data-tdc="vender"]')) {
      dialogo.close()
      return document.dispatchEvent(new CustomEvent('pokedoc:tienda-vender'))
    }
    const q = e.target.closest('[data-que]')
    if (q) {
      que = q.dataset.que
      for (const b of dialogo.querySelectorAll('[data-que]')) b.setAttribute('aria-pressed', String(b === q))
      return buscar()
    }
    const res = e.target.closest('[data-encontrado]')
    if (res) {
      anadir(encontrados.get(res.dataset.encontrado))
      $('#tdcBusca').value = ''
      $('#tdcResultados').hidden = true
      $('#tdcBusca').focus()
      return
    }
    const p = e.target.closest('[data-pct]')
    if (p) {
      ponerPct(Number(p.dataset.pct))
      $('[data-pct-otro]').value = ''
      return
    }
    const paso = e.target.closest('[data-paso]')
    if (paso) {
      const l = lineaDe(paso)
      l.unidades = Math.min(99999, Math.max(1, l.unidades + Number(paso.dataset.paso)))
      return repartirSiHayTotal() || pintarLineas()
    }
    const quitar = e.target.closest('[data-quitar]')
    if (quitar) {
      const l = lineaDe(quitar)
      lineas = lineas.filter((x) => x !== l)
      return repartirSiHayTotal() || pintarLineas()
    }
    if (e.target.closest('#tdcComprada')) comprar()
  })
  dialogo.addEventListener('change', (e) => {
    const campo = e.target.closest('[data-campo]')
    if (!campo) return
    const l = lineaDe(campo)
    l[campo.dataset.campo] = campo.value
    if (campo.dataset.campo === 'idioma') l.versiones = versionesDe(l)
    if (!l.versiones.some((v) => v.id === l.variante)) l.variante = l.versiones[0]?.id || 'normal'
    l.cm = cmDe(l)
    if (!l.tocado) l.pagas = pagoDeCompra(l.cm, pct)
    repartirSiHayTotal() || pintarLineas()
  })
  dialogo.addEventListener('input', (e) => {
    if (e.target.matches('[data-pagas]')) {
      const l = lineaDe(e.target)
      l.pagas = e.target.value === '' ? null : Number(String(e.target.value).replace(',', '.'))
      l.tocado = true
      $('[data-total]').value = ''
      return pintarCuenta()
    }
    if (e.target.matches('[data-pct-otro]')) {
      const v = Number(e.target.value)
      if (e.target.value !== '' && v >= 0 && v <= 200) ponerPct(v)
      return
    }
    // Un total borrado vuelve al tanto por ciento.
    if (e.target.matches('[data-total]')) {
      if (!repartirSiHayTotal() && e.target.value === '') ponerPct(pct)
    }
  })
  return dialogo
}

const lineaDe = (el) => lineas.find((l) => l.clave === el.closest('[data-linea]').dataset.linea)

function ponerPct(v) {
  pct = v
  try { localStorage.setItem(CLAVE_PCT, String(v)) } catch {}
  $('[data-total]').value = ''
  for (const l of lineas) {
    l.tocado = false
    l.pagas = pagoDeCompra(l.cm, pct)
  }
  pintarPct()
  pintarLineas()
}

function pintarPct() {
  for (const b of dialogo.querySelectorAll('[data-pct]')) b.setAttribute('aria-pressed', String(Number(b.dataset.pct) === pct && !$('[data-total]').value))
}

// Un total redondo manda sobre el tanto por ciento mientras esté escrito.
function repartirSiHayTotal() {
  const t = $('[data-total]').value
  if (t === '' || !(Number(t) >= 0) || !lineas.length) return false
  const r = repartirTotal(lineas, Number(t))
  lineas.forEach((l, i) => { l.pagas = r[i]; l.tocado = true })
  pintarPct()
  pintarLineas()
  return true
}

async function buscar() {
  const q = $('#tdcBusca').value.trim()
  const caja = $('#tdcResultados')
  const yo = ++siguiente
  if (q.length < 2) {
    caja.hidden = true
    return
  }
  caja.hidden = false
  caja.innerHTML = '<li class="tdv-nada">Buscando…</li>'
  try {
    let filas = []
    if (que === 'sellado') {
      const r = await buscarProductos(q, { limite: 20 })
      if (r.error) throw r.error
      filas = (r.data || []).map((p) => ({ clave: `p${p.id}`, producto: p }))
    } else {
      const { lista } = await buscarComoEnCartas(q, 20, { columnas: COLUMNAS, market: que })
      filas = lista.map((c) => ({ clave: `c${c.market || que}:${c.id}`, carta: c }))
    }
    if (yo !== siguiente) return
    for (const f of filas) encontrados.set(f.clave, f)
    caja.innerHTML = filas.length
      ? filas.map((f) => `<li><button type="button" class="tdv-resultado" data-encontrado="${escapeHtml(f.clave)}"><span><strong>${escapeHtml(f.carta ? nombreDeCarta(f.carta) : f.producto.name)}</strong><small>${escapeHtml(f.carta ? `${nombreDeSet(f.carta.tcg_sets) || f.carta.set_id} · ${f.carta.local_id || ''}` : `Sellado${f.producto.lang ? ` · ${String(f.producto.lang).toUpperCase()}` : ''}`)}</small></span><span class="tdv-res-der"><small>Añadir</small></span></button></li>`).join('')
      : `<li class="tdv-nada">Nada en el catálogo con «${escapeHtml(q)}».</li>`
  } catch (e) {
    if (yo === siguiente) caja.innerHTML = `<li class="tdv-nada">No se ha podido buscar: ${escapeHtml(e?.message || 'sin motivo')}.</li>`
  }
}

// Las versiones que existen en ese idioma (922, 956): lo mismo que al añadir.
function versionesDe(l) {
  if (!l.carta || !l.todas.length) return [{ id: 'normal', nombre: nombreDeVariante('normal') }]
  const vs = versionesDelIdioma(l.todas, l.reglas, l.idioma, l.carta.id).versiones
  return vs.length ? vs : [{ id: 'normal', nombre: nombreDeVariante('normal') }]
}

// Lo que vale en Cardmarket: el mínimo de SU idioma y su versión (la 900);
// un producto, el suyo.
function cmDe(l) {
  if (l.producto) return Number(l.producto.cm_lowest_es ?? l.producto.cm_lowest_eu ?? l.producto.cm_lowest) || null
  if (!l.filaPrecio) return null
  return valorDe(precioDeFila(l.filaPrecio, { variante: l.variante }), l.idioma) || null
}

async function anadir(f) {
  if (!f) return
  const l = { clave: `${f.clave}#${Date.now()}`, unidades: 1, estado: f.producto ? 'sellado' : 'NM', tocado: false, todas: [], reglas: sinReglas(), filaPrecio: null }
  if (f.producto) {
    Object.assign(l, { producto: f.producto, market: f.producto.market === 'JP' ? 'JP' : 'WEST', idioma: f.producto.lang || 'en', variante: 'normal', idiomas: [], versiones: [] })
  } else {
    const c = f.carta
    const market = c.market || que
    Object.assign(l, { carta: c, market, idiomas: market === 'JP' ? idiomasParaAnadirEn('JP', [], null) : OCCIDENTALES, variante: 'normal' })
    l.idioma = market === 'JP' ? 'ja' : 'es'
  }
  lineas.push(l)
  l.cm = cmDe(l)
  l.pagas = pagoDeCompra(l.cm, pct)
  l.versiones = versionesDe(l)
  repartirSiHayTotal() || pintarLineas()
  if (!l.carta) return
  // Los idiomas del SET (911), las versiones y su precio, sin esperar a pintar.
  const [delSet, reglas, precio] = await Promise.all([
    idiomasDeSetSinEsperar(l.carta.set_id, l.market).catch(() => null),
    reglasDeVersiones(l.carta.set_id, l.market).catch(() => sinReglas()),
    supabase.from('tcg_card_prices').select('*').eq('card_id', l.carta.id).maybeSingle().then((r) => r.data || null, () => null),
  ])
  if (!lineas.includes(l)) return
  if (l.market !== 'JP') {
    l.idiomas = idiomasParaAnadirEn(l.market, OCCIDENTALES, delSet)
    if (!l.idiomas.some((i) => i.id === l.idioma)) l.idioma = l.idiomas[0]?.id || 'en'
  }
  l.reglas = reglas
  l.todas = variantesDeCarta(l.carta).map((v) => ({ id: v.nuestro, nombre: v.nombre }))
  l.versiones = versionesDe(l)
  if (!l.versiones.some((v) => v.id === l.variante)) l.variante = l.versiones[0]?.id || 'normal'
  l.filaPrecio = precio
  l.cm = cmDe(l)
  if (!l.tocado) l.pagas = pagoDeCompra(l.cm, pct)
  repartirSiHayTotal() || pintarLineas()
}

function fotoHtml(l) {
  if (l.producto) return `<span class="tdc-foto tdc-foto-producto">${l.producto.image ? `<img src="${escapeHtml(l.producto.image)}" alt="" width="40" height="40" loading="lazy" onerror="this.remove()" />` : ''}</span>`
  const attrs = atributosDeEscaneo(cadenaDeEscaneo(l.carta))
  return `<span class="tdc-foto">${attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" />` : ''}</span>`
}

const opciones = (lista, actual) => lista.map((o) => `<option value="${escapeHtml(o.id)}" ${o.id === actual ? 'selected' : ''}>${escapeHtml(o.nombre)}</option>`).join('')

function pintarLineas() {
  const caja = $('#tdcLineas')
  caja.innerHTML = lineas.length
    ? lineas.map((l) => {
        const nombre = l.carta ? nombreDeCarta(l.carta) : l.producto.name
        const detalle = l.carta ? `${nombreDeSet(l.carta.tcg_sets) || l.carta.set_id} · ${l.carta.local_id || ''}` : 'Sellado'
        return `<li class="tdv-linea tdc-linea" data-linea="${escapeHtml(l.clave)}">
          <div class="tdc-linea-cab">${fotoHtml(l)}<div class="tdv-linea-que"><strong>${escapeHtml(nombre)}</strong><small>${escapeHtml(detalle)}</small></div><button type="button" class="tdv-quitar" data-quitar aria-label="Quitar ${escapeHtml(nombre)}">&times;</button></div>
          ${l.carta ? `<div class="tdc-elige">
            <label><span class="sr-only">Idioma</span><select data-campo="idioma">${opciones(l.idiomas, l.idioma)}</select></label>
            <label><span class="sr-only">Estado</span><select data-campo="estado">${opciones(ESTADOS.map((e) => ({ id: e.id, nombre: e.id })), l.estado)}</select></label>
            ${l.versiones.length > 1 ? `<label><span class="sr-only">Versión</span><select data-campo="variante">${opciones(l.versiones, l.variante)}</select></label>` : ''}
          </div>` : ''}
          <div class="tdv-linea-mandos">
            <span class="tdv-paso" role="group" aria-label="Unidades"><button type="button" data-paso="-1" aria-label="Una menos" ${l.unidades <= 1 ? 'disabled' : ''}>−</button><b aria-live="polite">${l.unidades}</b><button type="button" data-paso="1" aria-label="Una más">+</button></span>
            <label class="tdv-precio"><span class="sr-only">Lo que pagas por unidad</span><input type="number" inputmode="decimal" min="0" step="0.01" data-pagas value="${l.pagas ?? ''}" placeholder="Pagas" /> €</label>
          </div>
          <small class="tdc-cm">${l.cm ? `Cardmarket ${euros(l.cm)} (orientativo)` : 'Sin precio de Cardmarket: pon tú lo que pagas'}</small>
        </li>`
      }).join('')
    : '<li class="tdv-nada">Busca en el catálogo las cartas que te traen.</li>'
  pintarCuenta()
}

function pintarCuenta() {
  const c = cuentaDeCompra(lineas)
  const falta = lineas.some((l) => l.pagas == null || !Number.isFinite(l.pagas) || l.pagas < 0)
  $('#tdcCuenta').innerHTML = lineas.length
    ? `<span><small>Le pagas</small><b>${euros(c.total)}</b></span>
       <span><small>Valen en Cardmarket</small><b class="tdc-cm-total">${c.cm ? euros(c.cm) : '—'}</b>${c.pct != null ? `<small>pagas el ${c.pct} % (orientativo)</small>` : ''}</span>`
    : ''
  $('#tdcComprada').disabled = !lineas.length || falta
  $('#tdcComprada').textContent = lineas.length ? `Comprada · ${euros(c.total)}` : 'Comprada'
  $('#tdcError').textContent = falta ? 'Pon lo que pagas en cada línea.' : ''
}

async function comprar() {
  const boton = $('#tdcComprada')
  boton.disabled = true
  const pedidas = lineas.map((l) => ({
    ...(l.carta ? { card_id: l.carta.id, idioma: l.idioma, estado: l.estado, variante: l.variante } : { product_id: Number(l.producto.id), idioma: l.idioma }),
    market: l.market,
    unidades: l.unidades,
    coste: l.pagas,
    cm: l.cm,
  }))
  const cliente = $('[data-cliente]').value.trim() || null
  const { data, error } = await supabase.rpc('tienda_comprar', { p_lineas: pedidas, p_cliente: cliente })
  if (error || !data?.ticket) {
    boton.disabled = false
    const sin = ['PGRST202', '42883'].includes(error?.code) || /Could not find/i.test(error?.message || '')
    $('#tdcError').textContent = sin ? 'Falta un paso en la base para comprar (la migración 1091).' : error?.message || 'No se ha podido apuntar la compra.'
    return
  }
  lineas = []
  dialogo.close()
  alComprar?.(data)
  showToast(`Comprada${data.unidades > 1 ? `s ${data.unidades}` : ''} · ${euros(Number(data.total))}. Ya están en tu stock.`, 'success', {
    acciones: [
      { texto: 'Deshacer', alPulsar: () => deshacerCompra(data.ticket).then(() => alComprar?.(null), () => {}) },
      { texto: 'Recibo', alPulsar: () => import('./tienda-recibo.js').then((m) => m.abrirRecibo(data.ticket, { compra: true })).catch(() => showToast('No se ha podido hacer el recibo.', 'error')) },
    ],
  })
}

// Deshacer una compra: lo comprado sale del stock (si no se ha vendido nada).
export async function deshacerCompra(ticket) {
  const { data, error } = await supabase.rpc('tienda_deshacer_compra', { p_ticket: ticket })
  if (error) {
    showToast(error.message || 'No se ha podido deshacer.', 'error')
    throw error
  }
  showToast('Deshecha: lo comprado sale de tu stock.', 'success')
  return data
}

export function abrirComprar({ alTerminar = null } = {}) {
  montar()
  alComprar = alTerminar
  pct = pctRecordado()
  lineas = []
  $('[data-total]').value = ''
  $('[data-cliente]').value = ''
  $('#tdcBusca').value = ''
  $('#tdcResultados').hidden = true
  pintarPct()
  pintarLineas()
  if (!dialogo.open) dialogo.showModal()
  $('#tdcBusca').focus()
}
