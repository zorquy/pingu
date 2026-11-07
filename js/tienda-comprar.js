// COMPRAR (tanda 1091; rápido desde la 1255, el Mostrador). PINGU: «tú buscas
// el nombre o el código… te sale la carta en japonés y en occidental. Si le
// das al Pikachu ex del Ascended Heroes te saldrían los idiomas en que ha
// salido… gradeada o no… el estado… a cuánto lo valoras y a cuánto lo
// compras… se guarda en el stock, pero aún no está en venta».
//
// Tres pasos en la misma hoja:
//   1. Buscar: occidental, japonés y sellado a la vez, cada uno con su chapa.
//   2. La carta: los idiomas de SU set (911), sin gradear (estado) o gradeada
//      (casa y nota), la versión si hay más de una, lo que vale en Cardmarket
//      (orientativo), «Vale» (vacío es lo de Cardmarket) y «Pagas» (un tanto
//      por ciento de lo que vale, que se recuerda, o lo que escribas).
//   3. Terminar: la compra entera, un total redondo si se quiere, a quién y
//      cómo le pagas. «Comprada» mete cada línea en el stock con su coste y su
//      valor, POR PONER A LA VENTA (`tienda_comprar`, 1255): oculta hasta que
//      la tienda la publica desde el Stock. La hoja se queda abierta para el
//      siguiente, con Deshacer y el recibo.
//
// EL CAMBIO (1266) es esta hoja en otro modo (`modo = 'cambio'`): sus líneas
// son «Te da» (lo que CUENTA cada una es un tanto por ciento de lo que vale,
// con el suyo propio, 60–90 % y 80 de partida), y debajo va «Le das», lo que
// sale de tu stock (js/tienda-cambio.js, como en Vender). La cuenta es
// `cuentaDeCambio`, el pago de la diferencia es de venta si te paga y de compra
// si le pagas, y «Hacer el cambio» lo cierra todo a la vez (`tienda_cambio`).
// Las líneas se quedan al pasar de Comprar a Cambio: el cliente que venía a
// vender y se encapricha de una carta no tiene que volver a empezar.
//
// Entra por `import()` desde js/tienda-mostrador.js, «+ Añadir» del Stock y
// Ventas → Compras.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { IDIOMAS, ESTADOS, euros, valorDe, valorGradeado, precioDeFila, idiomasParaAnadirEn, versionesDelIdioma } from './cardmarket.js'
import { banderaHtml } from './precio-vista.js'
import { CASAS_A_ELEGIR, chapaDeGradeoHtml } from './gradeo-elegir.js'
import { chapaDeEstadoHtml } from './estado-chapa.js'
import { notasDeCasa } from './mi-coleccion/gradeo.js'
import { idiomasDeSetSinEsperar, reglasDeVersiones, sinReglas } from './idiomas-de-set.js'
import { variantesDeCarta, nombreDeVariante } from './mi-coleccion/variantes.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { buscarComoEnCartas } from './buscar-cartas.js'
import { buscarProductos } from './productos-valor.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'
import { PAGOS_COMPRA, PAGOS_VENTA, PCTS_CAMBIO, PCT_CAMBIO, pagasPorPct, repartirTotal, cuentaDeCambio, textoDeCambio, precioCobrado } from './tiendas-puro.js'
import { modoHtml, pagosHtml, recordado, recordar, abrirVenderRapido } from './tienda-mostrador.js'
import { recargarSiDesajuste } from './error-log.js'

const COLUMNAS = COLUMNAS_CARTA_DE_SET.replace('tcg_sets(tcg_online_code,serie_id,release_date)', 'tcg_sets(name,name_en,tcg_online_code,serie_id,release_date,oculto)')
const OCCIDENTALES = ['es', 'en', 'fr', 'de', 'it', 'pt'].map((id) => IDIOMAS.find((i) => i.id === id))
const PCTS = [50, 60, 70, 80]
const CLAVE_PCT = 'pd-tienda-compra-pct'
const CLAVE_PAGO = 'pd-tienda-pago-compra'
// El Cambio (1266): su tanto por ciento, aparte; el pago de lo que te paga es
// el de Vender (la misma llave) y el de lo que le pagas, el de Comprar.
const CLAVE_PCT_CAMBIO = 'pd-tienda-cambio-pct'
const CLAVE_PAGO_VENTA = 'pd-tienda-pago-venta'
const CLAVE_DONDE = 'pd-tienda-donde'
const claveIdioma = (market) => `pd-tienda-compra-idioma-${market}`
const POR_TANDA = 8
const $ = (sel) => dialogo?.querySelector(sel)
let dialogo = null
let lineas = []
// La carta que se está tasando (paso 2), aún fuera de la compra.
let actual = null
let paso = 'buscar'
let pct = 60
let pago = 'efectivo'
let modo = 'comprar'
let pagoVenta = 'efectivo'
// «Le das» (js/tienda-cambio.js): llega por `import()` la primera vez.
let leDas = null
let leDasPedido = null
// El signo de la diferencia con el que se pintaron los botones de pago.
let signoPintado = null
let sinPago = false
let alComprar = null
let siguiente = 0
const encontrados = new Map()

function pctRecordado(clave = CLAVE_PCT, porDefecto = 60) {
  try {
    const crudo = localStorage.getItem(clave)
    const v = Number(crudo)
    return crudo != null && crudo !== '' && v >= 0 && v <= 200 ? v : porDefecto
  } catch {
    return porDefecto
  }
}
const enCambio = () => modo === 'cambio'
const pctsDelModo = () => (enCambio() ? PCTS_CAMBIO : PCTS)
// «Pagas» en una compra; en un cambio no pagas: la carta CUENTA.
const rotuloPagas = () => (enCambio() ? 'Cuenta' : 'Pagas')

// Lo que vale una línea: lo escrito en «Vale» o, vacío, lo de Cardmarket.
const valeDe = (l) => (l.vale != null && Number.isFinite(l.vale) ? l.vale : l.cm ?? null)
const r2 = (x) => Math.round(x * 100) / 100

function montar() {
  if (dialogo) return dialogo
  hojaInyectada('css/tienda-vender.css')
  hojaInyectada('css/tienda-mostrador.css')
  hojaInyectada('css/cardmarket.css')
  dialogo = document.createElement('dialog')
  dialogo.className = 'tdv tdc tdm-hoja tdm-hoja-comprar'
  dialogo.setAttribute('aria-labelledby', 'tdcTitulo')
  dialogo.innerHTML = `
    <div class="tdv-caja">
      <header class="tdv-cab tdm-cab"><h2 id="tdcTitulo" class="sr-only">Comprar</h2><span id="tdcModo">${modoHtml('comprar')}</span><button type="button" class="tdv-cerrar" data-tdc="cerrar" aria-label="Cerrar">&times;</button></header>
      <div class="tdv-cuerpo">
        <div class="tdc-paso" data-paso-de="buscar">
          <div class="tdm-busca-caja"><input type="search" class="tdv-busca tdm-busca" id="tdcBusca" placeholder="Busca la carta o el producto: nombre o número" aria-label="Busca la carta o el producto" autocomplete="off" /></div>
          <button type="button" class="tdc-volver tdx-volver" data-tdc="terminar" hidden>‹ Volver al cambio</button>
          <p class="tdc-pista" id="tdcPista">Busca en las cartas occidentales, las japonesas y el sellado a la vez.</p>
          <ul class="tdv-resultados tdc-resultados" id="tdcResultados" hidden></ul>
        </div>
        <div class="tdc-paso" data-paso-de="carta" id="tdcFicha" hidden></div>
        <div class="tdc-paso" data-paso-de="terminar" hidden>
          <div class="tdx-teda">
            <div class="tdx-lado-cab" data-solo-cambio hidden><h3 class="tdx-lado-titulo">Te da</h3><span>entra a «Por poner a la venta»</span></div>
            <ul class="tdv-lineas" id="tdcLineas"></ul>
            <button type="button" class="btn-secondary tdc-otra" data-tdc="buscar" id="tdcOtra">+ Añadir otra</button>
            <div class="tdc-pct" role="group" aria-label="Lo que pagas de lo que vale" id="tdcPcts"></div>
            <label class="tdm-total" id="tdcTotalCaja"><span id="tdcTotalTexto">O todo junto por</span><span><input type="number" inputmode="decimal" min="0" step="0.01" data-total placeholder="—" /> €</span></label>
          </div>
          <section class="tdx-ledas" id="tdcLeDas" data-solo-cambio hidden aria-label="Le das"></section>
          <label class="tdc-campo"><span id="tdcClienteTxt">A quién se las compras (opcional)</span><input type="text" maxlength="80" data-cliente placeholder="Un nombre o un @usuario" /></label>
          <div id="tdcPago"></div>
          <div class="tdv-cuenta tdm-suma" id="tdcCuenta"></div>
        </div>
      </div>
      <footer class="tdv-pie"><p class="tdv-error" id="tdcError" role="alert"></p><button type="button" class="btn-primary tdv-vendida tdm-boton-vender" id="tdcBoton" disabled>Terminar</button></footer>
    </div>`
  document.body.appendChild(dialogo)

  let espera = null
  $('#tdcBusca').addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(buscar, 260)
  })
  dialogo.addEventListener('click', alPulsar)
  dialogo.addEventListener('input', alEscribir)
  return dialogo
}

function alPulsar(e) {
  const t = e.target
  if (t === dialogo || t.closest('[data-tdc="cerrar"]')) return dialogo.close()
  if (t.closest('[data-modo="vender"]')) {
    dialogo.close()
    return abrirVenderRapido()
  }
  const m = t.closest('[data-modo="comprar"], [data-modo="cambio"]')
  if (m) return ponerModo(m.dataset.modo)
  if (t.closest('[data-tdc="buscar"]')) return irA('buscar')
  if (t.closest('[data-tdc="terminar"]')) return irA('terminar')
  const res = t.closest('[data-encontrado]')
  if (res) return tasar(encontrados.get(res.dataset.encontrado))
  if (t.closest('#tdcBoton')) {
    if (paso === 'buscar') return irA('terminar')
    if (paso === 'carta') return meterActual()
    return enCambio() ? hacerCambio() : comprar()
  }
  const p = t.closest('[data-pago]')
  if (p) {
    // En un cambio en el que te paga, el pago es de venta (su llave).
    if (enCambio() && signoPintado === 'te-paga') {
      pagoVenta = p.dataset.pago
      recordar(CLAVE_PAGO_VENTA, pagoVenta)
    } else {
      pago = p.dataset.pago
      recordar(CLAVE_PAGO, pago)
    }
    return pintarPago()
  }
  // ── La carta (paso 2) ──
  if (paso === 'carta' && actual) {
    const idi = t.closest('[data-idioma]')
    if (idi) {
      actual.idioma = idi.dataset.idioma
      recordar(claveIdioma(actual.market), actual.idioma)
      actual.versiones = versionesDe(actual)
      if (!actual.versiones.some((v) => v.id === actual.variante)) actual.variante = actual.versiones[0]?.id || 'normal'
      return recalcular(actual) || pintarFicha()
    }
    const raw = t.closest('[data-raw]')
    if (raw) {
      actual.gradeo = raw.dataset.raw === 'gradeada' ? actual.ultimoGradeo || `${CASAS_A_ELEGIR[0].id} 10` : null
      if (actual.gradeo) actual.ultimoGradeo = actual.gradeo
      return recalcular(actual) || pintarFicha()
    }
    const est = t.closest('[data-estado-elige]')
    if (est) {
      actual.estado = est.dataset.estadoElige
      return pintarFicha()
    }
    const casa = t.closest('[data-casa-elige]')
    if (casa) {
      const notas = notasDeCasa(casa.dataset.casaElige)
      const notaAntes = String(actual.gradeo || '').split(' ').slice(1).join(' ')
      actual.gradeo = `${casa.dataset.casaElige} ${notas.includes(notaAntes) ? notaAntes : notas.includes('10') ? '10' : notas[0]}`
      actual.ultimoGradeo = actual.gradeo
      return recalcular(actual) || pintarFicha()
    }
    const nota = t.closest('[data-nota-elige]')
    if (nota) {
      actual.gradeo = `${actual.gradeo.split(' ')[0]} ${nota.dataset.notaElige}`
      actual.ultimoGradeo = actual.gradeo
      return recalcular(actual) || pintarFicha()
    }
    const ver = t.closest('[data-version-elige]')
    if (ver) {
      actual.variante = ver.dataset.versionElige
      return recalcular(actual) || pintarFicha()
    }
  }
  const pc = t.closest('[data-pct]')
  if (pc) return ponerPct(Number(pc.dataset.pct))
  const pasito = t.closest('[data-paso]')
  if (pasito) {
    const l = paso === 'carta' ? actual : lineaDe(pasito)
    l.unidades = Math.min(99999, Math.max(1, l.unidades + Number(pasito.dataset.paso)))
    if (paso === 'carta') return pintarFicha()
    return repartirSiHayTotal() || pintarLineas()
  }
  const quitar = t.closest('[data-quitar]')
  if (quitar) {
    lineas = lineas.filter((x) => x !== lineaDe(quitar))
    if (!lineas.length && !enCambio()) return irA('buscar')
    return repartirSiHayTotal() || pintarLineas()
  }
}

function alEscribir(e) {
  const t = e.target
  const num = (v) => (v === '' ? null : Number(String(v).replace(',', '.')))
  if (t.matches('[data-vale], [data-pagas]')) {
    const l = paso === 'carta' ? actual : lineaDe(t)
    if (t.matches('[data-vale]')) {
      l.vale = num(t.value)
      // Pagas sigue al tanto por ciento mientras no se haya escrito a mano.
      if (!l.tocado) {
        l.pagas = pagasPorPct(valeDe(l), pct)
        const pagas = t.closest('.tdc-precios, .tdv-linea')?.querySelector('[data-pagas]')
        if (pagas) pagas.value = l.pagas ?? ''
      }
    } else {
      l.pagas = num(t.value)
      l.tocado = true
    }
    if (paso === 'terminar') {
      $('[data-total]').value = ''
      pintarPct()
      return pintarCuenta()
    }
    return pintarCuentaDeFicha()
  }
  // Un total borrado vuelve al tanto por ciento.
  if (t.matches('[data-total]') && !repartirSiHayTotal() && t.value === '') ponerPct(pct)
}

const lineaDe = (el) => lineas.find((l) => l.clave === el.closest('[data-linea]')?.dataset.linea)

function irA(cual) {
  paso = cual
  for (const s of dialogo.querySelectorAll('[data-paso-de]')) s.hidden = s.dataset.pasoDe !== cual
  $('#tdcError').textContent = ''
  if (cual === 'buscar') {
    actual = null
    $('#tdcBusca').focus()
  }
  if (cual === 'terminar') pintarLineas()
  pintarBoton()
}

// Comprar ⇄ Cambio, en la misma hoja y con las mismas líneas.
function ponerModo(nuevo) {
  if (nuevo !== 'comprar' && nuevo !== 'cambio') return
  const cambia = nuevo !== modo
  modo = nuevo
  pct = enCambio() ? pctRecordado(CLAVE_PCT_CAMBIO, PCT_CAMBIO) : pctRecordado()
  $('#tdcModo').innerHTML = modoHtml(modo)
  $('#tdcTitulo').textContent = enCambio() ? 'Cambio' : 'Comprar'
  dialogo.classList.toggle('tdm-hoja-cambio', enCambio())
  for (const el of dialogo.querySelectorAll('[data-solo-cambio]')) el.hidden = !enCambio()
  $('.tdx-volver').hidden = !enCambio()
  $('#tdcOtra').textContent = enCambio() ? '+ Añadir carta suya' : '+ Añadir otra'
  $('#tdcTotalTexto').textContent = enCambio() ? 'O lo suyo, todo junto por' : 'O todo junto por'
  $('#tdcClienteTxt').textContent = enCambio() ? 'Con quién (opcional)' : 'A quién se las compras (opcional)'
  $('#tdcPista').textContent = enCambio()
    ? 'Busca la carta que te da: occidental, japonesa o sellado.'
    : 'Busca en las cartas occidentales, las japonesas y el sellado a la vez.'
  $('.tdc-pct').setAttribute('aria-label', enCambio() ? 'Lo que cuenta de lo que vale' : 'Lo que pagas de lo que vale')
  if (cambia) {
    // Lo que no se ha escrito a mano sigue al tanto por ciento del modo.
    $('[data-total]').value = ''
    for (const l of [...lineas, ...(actual ? [actual] : [])]) if (!l.tocado) l.pagas = pagasPorPct(valeDe(l), pct)
  }
  signoPintado = null
  if (enCambio()) cargarLeDas()
  pintarChipsDePct()
  pintarPago()
  if (paso === 'carta' && actual) return pintarFicha()
  // El cambio se ve entero (los dos lados) aunque aún no haya nada suyo.
  if (enCambio() && paso === 'buscar' && !$('#tdcBusca').value.trim()) return irA('terminar')
  if (paso === 'terminar') return pintarLineas()
  pintarBoton()
}

function cargarLeDas() {
  if (leDas || leDasPedido) return leDasPedido
  leDasPedido = import('./tienda-cambio.js').then((m) => {
    leDas = m.montarLeDas($('#tdcLeDas'), () => pintarCuenta())
    pintarCuenta()
  }).catch((e) => {
    leDasPedido = null
    if (!recargarSiDesajuste(e)) $('#tdcLeDas').innerHTML = '<p class="tdv-nada">No se ha podido abrir lo que le das. Recarga la página.</p>'
  })
  return leDasPedido
}

function pintarChipsDePct() {
  $('#tdcPcts').innerHTML = `<span>${enCambio() ? 'Cuenta el' : 'Pagas el'}</span>${pctsDelModo().map((v) => `<button type="button" class="tdv-chip" data-pct="${v}" aria-pressed="false">${v} %</button>`).join('')}`
  pintarPct()
}

function pintarBoton() {
  const b = $('#tdcBoton')
  const total = lineas.reduce((s, l) => s + (Number(l.pagas) || 0) * l.unidades, 0)
  const unidades = lineas.reduce((s, l) => s + l.unidades, 0)
  if (paso === 'buscar') {
    b.disabled = !lineas.length && !enCambio()
    b.textContent = enCambio()
      ? (lineas.length ? `Ver el cambio · ${unidades} ${unidades === 1 ? 'carta' : 'cartas'} · ${euros(r2(total))}` : 'Ver el cambio')
      : lineas.length ? `Terminar · ${unidades} ${unidades === 1 ? 'carta' : 'cartas'} · ${euros(r2(total))}` : 'Busca lo que te traen'
  } else if (paso === 'carta') {
    const falta = !actual || actual.pagas == null || !Number.isFinite(actual.pagas) || actual.pagas < 0
    b.disabled = falta
    b.textContent = falta
      ? enCambio() ? 'Pon lo que cuenta' : 'Pon lo que pagas'
      : `${enCambio() ? 'Añadir al cambio' : 'Añadir a la compra'} · ${euros(r2(actual.pagas * actual.unidades))}`
  } else if (enCambio()) {
    const c = cuentaDeCambio(lineas, leDas?.lineas() || [])
    b.disabled = !c.listo
    b.textContent = c.listo ? `Hacer el cambio · ${textoDeCambio(c.diferencia, euros)}` : 'Hacer el cambio'
    $('#tdcError').textContent = !lineas.length && !(leDas?.lineas() || []).length ? ''
      : !lineas.length ? 'Añade lo que te da.'
        : !(leDas?.lineas() || []).length ? 'Añade lo que le das de tu stock.'
          : c.falta ? 'Pon la cifra de cada línea.' : ''
  } else {
    const falta = lineas.some((l) => l.pagas == null || !Number.isFinite(l.pagas) || l.pagas < 0)
    b.disabled = !lineas.length || falta
    b.textContent = `Comprada · ${euros(r2(total))}`
    $('#tdcError').textContent = falta ? 'Pon lo que pagas en cada línea.' : ''
  }
}

function ponerPct(v) {
  pct = v
  recordar(enCambio() ? CLAVE_PCT_CAMBIO : CLAVE_PCT, String(v))
  if (paso === 'carta' && actual) {
    actual.tocado = false
    actual.pagas = pagasPorPct(valeDe(actual), pct)
    return pintarFicha()
  }
  if (dialogo.querySelector('[data-total]')) $('[data-total]').value = ''
  for (const l of lineas) {
    l.tocado = false
    l.pagas = pagasPorPct(valeDe(l), pct)
  }
  pintarPct()
  pintarLineas()
}

function pintarPct() {
  const conTotal = !!$('[data-total]')?.value
  for (const b of dialogo.querySelectorAll('[data-paso-de="terminar"] [data-pct]')) b.setAttribute('aria-pressed', String(Number(b.dataset.pct) === pct && !conTotal && !lineas.some((l) => l.tocado)))
}

// Un total redondo manda sobre el tanto por ciento mientras esté escrito: se
// reparte según lo que vale cada una.
function repartirSiHayTotal() {
  const t = $('[data-total]')?.value
  if (paso !== 'terminar' || t == null || t === '' || !(Number(t) >= 0) || !lineas.length) return false
  const r = repartirTotal(lineas.map((l) => ({ unidades: l.unidades, cm: valeDe(l) })), Number(t))
  lineas.forEach((l, i) => { l.pagas = r[i]; l.tocado = true })
  pintarPct()
  pintarLineas()
  return true
}

// ── 1. Buscar ──
const CHAPA_CATALOGO = { WEST: ['occ', 'Occidental'], JP: ['jp', 'Japón'], sellado: ['sel', 'Sellado'] }
const chapaDe = (que) => `<span class="tdc-cat tdc-cat-${CHAPA_CATALOGO[que][0]}">${CHAPA_CATALOGO[que][1]}</span>`

async function buscar() {
  const q = $('#tdcBusca').value.trim()
  const caja = $('#tdcResultados')
  const yo = ++siguiente
  if (q.length < 2) {
    caja.hidden = true
    $('#tdcPista').hidden = false
    return
  }
  $('#tdcPista').hidden = true
  caja.hidden = false
  caja.innerHTML = '<li class="tdv-nada">Buscando…</li>'
  // Los tres a la vez; uno que falle no tapa a los otros.
  const [west, jp, prods] = await Promise.all([
    buscarComoEnCartas(q, POR_TANDA, { columnas: COLUMNAS, market: 'WEST' }).then((r) => r.lista || [], () => null),
    buscarComoEnCartas(q, POR_TANDA, { columnas: COLUMNAS, market: 'JP' }).then((r) => r.lista || [], () => null),
    buscarProductos(q, { limite: POR_TANDA }).then((r) => (r.error ? null : r.data || []), () => null),
  ])
  if (yo !== siguiente) return
  const filas = [
    ...(west || []).map((c) => ({ clave: `cWEST:${c.id}`, que: 'WEST', carta: { ...c, market: c.market || 'WEST' } })),
    ...(jp || []).map((c) => ({ clave: `cJP:${c.id}`, que: 'JP', carta: { ...c, market: 'JP' } })),
    ...(prods || []).map((p) => ({ clave: `p${p.id}`, que: 'sellado', producto: p })),
  ]
  for (const f of filas) encontrados.set(f.clave, f)
  const fallo = [west, jp, prods].every((x) => x === null)
  caja.innerHTML = filas.length
    ? filas.map((f) => `<li><button type="button" class="tdv-resultado tdc-resultado" data-encontrado="${escapeHtml(f.clave)}">${fotoHtml(f)}<span class="tdc-res-que"><strong>${escapeHtml(f.carta ? nombreDeCarta(f.carta) : f.producto.name)}</strong><small class="tdm-chapas">${chapaDe(f.que)}<span>${escapeHtml(f.carta ? `${nombreDeSet(f.carta.tcg_sets) || f.carta.set_id} · ${f.carta.local_id || ''}` : String(f.producto.lang || '').toUpperCase())}</span></small></span></button></li>`).join('')
    : fallo
      ? '<li class="tdv-nada">No se ha podido buscar. Inténtalo de nuevo.</li>'
      : `<li class="tdv-nada">Nada en el catálogo con «${escapeHtml(q)}».</li>`
}

function fotoHtml(f, grande = false) {
  const cls = `tdc-foto${grande ? ' tdc-foto-grande' : ''}`
  if (f.producto) return `<span class="${cls} tdc-foto-producto">${f.producto.image ? `<img src="${escapeHtml(f.producto.image)}" alt="" width="40" height="40" loading="lazy" onerror="this.remove()" />` : ''}</span>`
  const attrs = atributosDeEscaneo(cadenaDeEscaneo(f.carta))
  return `<span class="${cls}">${attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" />` : ''}</span>`
}

// ── 2. La carta ──

// Las versiones que existen en ese idioma (922, 956): lo mismo que al añadir.
function versionesDe(l) {
  if (!l.carta || !l.todas.length) return [{ id: 'normal', nombre: nombreDeVariante('normal') }]
  const vs = versionesDelIdioma(l.todas, l.reglas, l.idioma, l.carta.id).versiones
  return vs.length ? vs : [{ id: 'normal', nombre: nombreDeVariante('normal') }]
}

// Lo que vale en Cardmarket: el mínimo de SU idioma y su versión (la 900); una
// gradeada, por su casa y nota (1234) si Cardmarket la tiene; un producto, el suyo.
function cmDe(l) {
  if (l.producto) return Number(l.producto.cm_lowest_es ?? l.producto.cm_lowest_eu ?? l.producto.cm_lowest) || null
  if (!l.filaPrecio) return null
  const pr = precioDeFila(l.filaPrecio, { variante: l.variante })
  return (l.gradeo ? valorGradeado(pr, l.gradeo) : null) || valorDe(pr, l.idioma) || null
}

// Cambiar el idioma, el gradeo o la versión cambia lo que vale.
function recalcular(l) {
  l.cm = cmDe(l)
  if (!l.tocado) l.pagas = pagasPorPct(valeDe(l), pct)
  return false
}

async function tasar(f) {
  if (!f) return
  const l = { clave: `${f.clave}#${Date.now()}`, que: f.que, unidades: 1, estado: f.producto ? 'sellado' : 'NM', gradeo: null, tocado: false, vale: null, todas: [], reglas: sinReglas(), filaPrecio: null }
  if (f.producto) {
    Object.assign(l, { producto: f.producto, market: f.producto.market === 'JP' ? 'JP' : 'WEST', idioma: f.producto.lang || 'en', variante: 'normal', idiomas: [], versiones: [] })
  } else {
    const market = f.carta.market || 'WEST'
    const base = market === 'JP' ? idiomasParaAnadirEn('JP', [], null) : OCCIDENTALES
    Object.assign(l, { carta: f.carta, market, idiomas: base, variante: 'normal' })
    l.idioma = recordado(claveIdioma(market), base.map((i) => i.id), market === 'JP' ? 'ja' : 'es')
  }
  actual = l
  recalcular(l)
  l.versiones = versionesDe(l)
  irA('carta')
  pintarFicha()
  if (!l.carta) return
  // Los idiomas del SET (911), las versiones y su precio, sin esperar a pintar.
  const [delSet, reglas, precio] = await Promise.all([
    idiomasDeSetSinEsperar(l.carta.set_id, l.market).catch(() => null),
    reglasDeVersiones(l.carta.set_id, l.market).catch(() => sinReglas()),
    supabase.from('tcg_card_prices').select('*').eq('card_id', l.carta.id).maybeSingle().then((r) => r.data || null, () => null),
  ])
  if (actual !== l) return
  l.idiomas = idiomasParaAnadirEn(l.market, l.market === 'JP' ? [] : OCCIDENTALES, delSet)
  if (!l.idiomas.some((i) => i.id === l.idioma)) l.idioma = l.idiomas[0]?.id || (l.market === 'JP' ? 'ja' : 'en')
  l.reglas = reglas
  l.todas = variantesDeCarta(l.carta).map((v) => ({ id: v.nuestro, nombre: v.nombre }))
  l.versiones = versionesDe(l)
  if (!l.versiones.some((v) => v.id === l.variante)) l.variante = l.versiones[0]?.id || 'normal'
  l.filaPrecio = precio
  recalcular(l)
  pintarFicha()
}

const dinero = (n) => (n == null || !Number.isFinite(n) ? '' : String(r2(n)))
const coma = (n) => dinero(n).replace('.', ',')

function pintarFicha() {
  const l = actual
  if (!l) return
  const nombre = l.carta ? nombreDeCarta(l.carta) : l.producto.name
  const detalle = l.carta ? `${nombreDeSet(l.carta.tcg_sets) || l.carta.set_id} · ${l.carta.local_id || ''}` : 'Sellado'
  const elige = (attr, valor, activo, html, etiqueta = '') => `<button type="button" class="tdc-elige-chip" ${attr}="${escapeHtml(valor)}" aria-pressed="${activo}"${etiqueta ? ` aria-label="${escapeHtml(etiqueta)}"` : ''}>${html}</button>`
  const casa = l.gradeo ? l.gradeo.split(' ')[0] : null
  const nota = l.gradeo ? l.gradeo.split(' ').slice(1).join(' ') : null
  $('#tdcFicha').innerHTML = `
    <button type="button" class="tdc-volver" data-tdc="buscar">‹ Buscar otra</button>
    <div class="tdc-ficha-top">${fotoHtml(l, true)}<div class="tdv-linea-que"><strong>${escapeHtml(nombre)}</strong><small class="tdm-chapas">${chapaDe(l.que)}<span>${escapeHtml(detalle)}</span></small></div></div>
    ${l.carta ? `
      <div><p class="tdm-etq">Idioma</p><div class="tdc-elige" role="group" aria-label="Idioma">${l.idiomas.map((i) => elige('data-idioma', i.id, i.id === l.idioma, `${banderaHtml(i.id)}<span>${escapeHtml(i.id.toUpperCase())}</span>`, i.nombre)).join('')}</div></div>
      <div><p class="tdm-etq">Cómo está</p>
        <div class="tdm-modo tdc-raw" role="group" aria-label="Gradeada o no"><button type="button" data-raw="cruda" aria-pressed="${!l.gradeo}">Sin gradear</button><button type="button" data-raw="gradeada" aria-pressed="${!!l.gradeo}">Gradeada</button></div>
        ${l.gradeo
          ? `<div class="tdc-elige tdc-casas" role="group" aria-label="Casa">${CASAS_A_ELEGIR.map((c) => elige('data-casa-elige', c.id, c.id === casa, chapaDeGradeoHtml(`${c.id} ${c.id === casa ? nota : '10'}`).replace(/<\/b> [^<]*<\/span>$/, '</b></span>'), c.nombre)).join('')}</div>
             <div class="tdc-elige tdc-notas" role="group" aria-label="Nota">${notasDeCasa(casa).map((n) => elige('data-nota-elige', n, n === nota, escapeHtml(n))).join('')}</div>`
          : `<div class="tdc-elige tdc-estados" role="group" aria-label="Estado">${ESTADOS.map((e) => elige('data-estado-elige', e.id, e.id === l.estado, chapaDeEstadoHtml(e.id))).join('')}</div>`}
      </div>
      ${l.versiones.length > 1 ? `<div><p class="tdm-etq">Versión</p><div class="tdc-elige" role="group" aria-label="Versión">${l.versiones.map((v) => elige('data-version-elige', v.id, v.id === l.variante, escapeHtml(v.nombre))).join('')}</div></div>` : ''}` : ''}
    <div class="tdc-precios">
      <div class="tdc-cm-fila"><span>Cardmarket${l.carta ? ` · ${escapeHtml(l.gradeo || `${l.idioma.toUpperCase()} · ${l.estado}`)}` : ''}</span><b>${l.cm ? euros(l.cm) : 'Sin precio'}</b></div>
      <div class="tdm-dos-campos">
        <label class="tdm-campo"><span>Vale</span><span class="tdm-input"><input type="number" inputmode="decimal" min="0" step="0.01" data-vale value="${dinero(l.vale)}" placeholder="${l.cm ? coma(l.cm) : 'Lo que vale'}" /> €</span></label>
        <label class="tdm-campo"><span>${rotuloPagas()}</span><span class="tdm-input tdc-pagas"><input type="number" inputmode="decimal" min="0" step="0.01" data-pagas value="${dinero(l.pagas)}" placeholder="${enCambio() ? 'Lo que cuenta' : 'Lo que pagas'}" /> €</span></label>
      </div>
      <div class="tdc-pcts" role="group" aria-label="${enCambio() ? 'Cuenta' : 'Pagas'} un tanto por ciento de lo que vale">${pctsDelModo().map((v) => `<button type="button" data-pct="${v}" aria-pressed="${v === pct && !l.tocado}">${v} %</button>`).join('')}</div>
      <p class="tdc-margen" id="tdcMargen"></p>
    </div>
    <div class="tdm-uds"><span>Unidades</span><span class="tdv-paso" role="group" aria-label="Unidades"><button type="button" data-paso="-1" aria-label="Una menos" ${l.unidades <= 1 ? 'disabled' : ''}>−</button><b aria-live="polite">${l.unidades}</b><button type="button" data-paso="1" aria-label="Una más">+</button></span></div>`
  pintarCuentaDeFicha()
}

// «Si la vendes por lo que vale, ganas X €»: solo con las dos cifras.
function pintarCuentaDeFicha() {
  const l = actual
  const caja = $('#tdcMargen')
  if (caja) {
    const vale = valeDe(l)
    const gana = vale != null && l.pagas != null && Number.isFinite(l.pagas) ? r2((vale - l.pagas) * l.unidades) : null
    caja.textContent = gana == null ? '' : `Si la vendes por lo que vale, ${gana >= 0 ? `ganas ${euros(gana)}` : `pierdes ${euros(-gana)}`}`
    caja.classList.toggle('tdv-rojo', gana != null && gana < 0)
  }
  for (const b of dialogo.querySelectorAll('[data-paso-de="carta"] [data-pct]')) b.setAttribute('aria-pressed', String(Number(b.dataset.pct) === pct && !l.tocado))
  pintarBoton()
}

function meterActual() {
  if (!actual) return
  // Sin aviso: el botón de abajo ya dice cuántas van y cuánto («Terminar · …»).
  lineas.push(actual)
  actual = null
  $('#tdcBusca').value = ''
  $('#tdcResultados').hidden = true
  $('#tdcPista').hidden = false
  // En un cambio, de vuelta a ver los dos lados.
  irA(enCambio() ? 'terminar' : 'buscar')
}

// ── 3. Terminar ──
function chapasHtml(l) {
  if (l.producto) return `${chapaDe('sellado')}<span class="tdm-idi">${escapeHtml(String(l.idioma || '').toUpperCase())}</span>`
  return `${chapaDe(l.que)}<span class="tdm-idi">${banderaHtml(l.idioma)}${escapeHtml(l.idioma.toUpperCase())}</span>${l.gradeo ? chapaDeGradeoHtml(l.gradeo) : chapaDeEstadoHtml(l.estado)}${l.variante && l.variante !== 'normal' ? `<span>${escapeHtml(nombreDeVariante(l.variante))}</span>` : ''}`
}

function pintarLineas() {
  $('#tdcLineas').innerHTML = lineas.map((l) => {
    const nombre = l.carta ? nombreDeCarta(l.carta) : l.producto.name
    return `<li class="tdv-linea tdm-linea tdc-linea" data-linea="${escapeHtml(l.clave)}">
      <div class="tdm-linea-cab">${fotoHtml(l)}<div class="tdv-linea-que"><strong>${escapeHtml(nombre)}</strong><small class="tdm-chapas">${chapasHtml(l)}</small></div><button type="button" class="tdv-quitar" data-quitar aria-label="Quitar ${escapeHtml(nombre)}">&times;</button></div>
      <div class="tdm-dos-campos">
        <label class="tdm-campo"><span>Vale</span><span class="tdm-input"><input type="number" inputmode="decimal" min="0" step="0.01" data-vale value="${dinero(l.vale)}" placeholder="${l.cm ? coma(l.cm) : '—'}" /> €</span></label>
        <label class="tdm-campo"><span>${rotuloPagas()}</span><span class="tdm-input tdc-pagas"><input type="number" inputmode="decimal" min="0" step="0.01" data-pagas value="${dinero(l.pagas)}" placeholder="—" /> €</span></label>
      </div>
      <div class="tdm-uds"><span>Unidades</span><span class="tdv-paso" role="group" aria-label="Unidades"><button type="button" data-paso="-1" aria-label="Una menos" ${l.unidades <= 1 ? 'disabled' : ''}>−</button><b aria-live="polite">${l.unidades}</b><button type="button" data-paso="1" aria-label="Una más">+</button></span></div>
    </li>`
  }).join('') || (enCambio() ? '<li class="tdv-nada">Busca la carta que te da con «+ Añadir carta suya».</li>' : '')
  $('#tdcTotalCaja').hidden = lineas.length < 2
  pintarPct()
  pintarCuenta()
}

function pintarPago() {
  if (!enCambio()) {
    $('#tdcPago').innerHTML = sinPago ? '' : pagosHtml(PAGOS_COMPRA, pago, 'Le pagas con')
    return
  }
  // En un cambio, según quién paga la diferencia; en paz, nada que pagar.
  signoPintado = cuentaDeCambio(lineas, leDas?.lineas() || []).quien
  $('#tdcPago').innerHTML = signoPintado === 'te-paga'
    ? pagosHtml(PAGOS_VENTA, pagoVenta, 'Te paga con')
    : signoPintado === 'le-pagas' ? pagosHtml(PAGOS_COMPRA, pago, 'Le pagas con') : ''
}

function pintarCuenta() {
  if (enCambio()) return pintarCuentaDeCambio()
  let valen = 0
  let pagas = 0
  let sinValor = 0
  for (const l of lineas) {
    const v = valeDe(l)
    if (v == null) sinValor++
    else valen += v * l.unidades
    pagas += (Number(l.pagas) || 0) * l.unidades
  }
  valen = r2(valen)
  pagas = r2(pagas)
  $('#tdcCuenta').innerHTML = lineas.length
    ? `<div><span>Valen</span><b>${valen ? euros(valen) : '—'}${sinValor ? ` <small>(${sinValor} sin valor)</small>` : ''}</b></div>
       <div class="tdm-suma-grande"><span>Le pagas</span><b>${euros(pagas)}</b></div>
       ${valen && !sinValor ? `<div><span>Si las vendes por lo que valen</span><b class="${valen - pagas < 0 ? 'tdv-rojo' : 'tdv-verde'}">${valen - pagas > 0 ? '+' : ''}${euros(r2(valen - pagas))}</b></div>` : ''}`
    : ''
  pintarBoton()
}

// Lo suyo cuenta · lo tuyo · y en grande quién paga a quién.
function pintarCuentaDeCambio() {
  const das = leDas?.lineas() || []
  const c = cuentaDeCambio(lineas, das)
  if (c.quien !== signoPintado) pintarPago()
  $('#tdcCuenta').innerHTML = lineas.length || das.length
    ? `<div><span>Lo suyo cuenta</span><b>${euros(c.recibido)}</b></div>
       <div><span>Lo tuyo</span><b>${euros(c.entregado)}</b></div>
       <div class="tdm-suma-grande tdx-diferencia" data-quien="${c.quien}"><span>${c.quien === 'te-paga' ? 'Te paga' : c.quien === 'le-pagas' ? 'Le pagas' : 'Quedáis en paz'}</span><b>${c.quien === 'en-paz' ? '' : euros(Math.abs(c.diferencia))}</b></div>`
    : ''
  pintarBoton()
}

const sinFuncion = (error) => ['PGRST202', '42883'].includes(error?.code) || /Could not find|does not exist/i.test(error?.message || '')

// Las líneas como las pide `tienda_comprar` (y «te da» de `tienda_cambio`).
const lineasDeCompra = () => lineas.map((l) => ({
  ...(l.carta ? { card_id: l.carta.id, idioma: l.idioma, estado: l.gradeo ? 'NM' : l.estado, variante: l.variante, gradeo: l.gradeo || null } : { product_id: Number(l.producto.id), idioma: l.idioma }),
  market: l.market,
  unidades: l.unidades,
  coste: l.pagas,
  valorado: valeDe(l),
  cm: l.cm,
}))

async function comprar() {
  const boton = $('#tdcBoton')
  boton.disabled = true
  const pedidas = lineasDeCompra()
  const cliente = $('[data-cliente]').value.trim() || null
  let { data, error } = sinPago ? { error: { code: 'PGRST202' } } : await supabase.rpc('tienda_comprar', { p_lineas: pedidas, p_cliente: cliente, p_pago: pago })
  // Sin la 1255 no hay forma de pago ni «por poner a la venta»: se compra como
  // en la 1091 (entra a la venta, sin precio).
  if (error && sinFuncion(error)) {
    ;({ data, error } = await supabase.rpc('tienda_comprar', { p_lineas: pedidas, p_cliente: cliente }))
    if (!error) {
      sinPago = true
      pintarPago()
    }
  }
  if (error || !data?.ticket) {
    boton.disabled = false
    $('#tdcError').textContent = sinFuncion(error) ? 'Falta un paso en la base para comprar (la migración 1091).' : error?.message || 'No se ha podido apuntar la compra.'
    return
  }
  // La hoja se queda abierta y vacía para el siguiente.
  lineas = []
  $('[data-total]').value = ''
  $('[data-cliente]').value = ''
  $('#tdcBusca').value = ''
  $('#tdcResultados').hidden = true
  $('#tdcPista').hidden = false
  irA('buscar')
  alComprar?.(data)
  const porPoner = data.pago !== undefined
  showToast(`Comprada${data.unidades > 1 ? `s ${data.unidades}` : ''} · ${euros(Number(data.total))}. ${porPoner ? 'Te espera en «Por poner a la venta».' : 'Ya está en tu stock.'}`, 'success', {
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

// ── Hacer el cambio (1266) ──
async function hacerCambio() {
  const boton = $('#tdcBoton')
  const das = leDas?.lineas() || []
  const c = cuentaDeCambio(lineas, das)
  if (!c.listo) return pintarBoton()
  boton.disabled = true
  const { data, error } = await supabase.rpc('tienda_cambio', {
    p_te_da: lineasDeCompra(),
    p_le_das: das.map((l) => ({ stock_id: l.id, unidades: l.vender, precio: precioCobrado(l) })),
    p_pago: c.quien === 'te-paga' ? pagoVenta : c.quien === 'le-pagas' ? pago : null,
    p_cliente: $('[data-cliente]').value.trim() || null,
    p_donde: recordado(CLAVE_DONDE, ['mostrador', 'cardmarket', 'evento', 'otro'], 'mostrador'),
    p_pct: pct,
  })
  if (error || !data?.id) {
    boton.disabled = false
    $('#tdcError').textContent = sinFuncion(error) ? 'Para hacer cambios falta un paso en la base (la migración 1266).' : error?.message || 'No se ha podido hacer el cambio.'
    return
  }
  // Vacía y abierta para el siguiente, como Comprar y Vender.
  lineas = []
  leDas?.vaciar()
  $('[data-total]').value = ''
  $('[data-cliente]').value = ''
  irA('terminar')
  alComprar?.(data)
  showToast(`Cambio hecho · ${textoDeCambio(Number(data.diferencia), euros)}. Lo suyo te espera en «Por poner a la venta».`, 'success', {
    acciones: [
      { texto: 'Deshacer', alPulsar: () => deshacerCambio(data.id).then(() => alComprar?.(null), () => {}) },
      { texto: 'Recibo', alPulsar: () => import('./tienda-recibo.js').then((m) => m.abrirReciboDeCambio(data.id)).catch(() => showToast('No se ha podido hacer el recibo.', 'error')) },
    ],
  })
}

// Deshacer un cambio: las dos mitades a la vez (por su id o el ticket de una).
export async function deshacerCambio(id) {
  const { data, error } = await supabase.rpc('tienda_deshacer_cambio', { p_id: id })
  if (error) {
    showToast(error.message || 'No se ha podido deshacer.', 'error')
    throw error
  }
  showToast('Deshecho: tu carta vuelve al stock y la suya sale.', 'success')
  return data
}

// `modo`: 'comprar' (por defecto) o 'cambio'.
export function abrirComprar({ alTerminar = null, modo: pedido = 'comprar' } = {}) {
  montar()
  alComprar = alTerminar
  pago = recordado(CLAVE_PAGO, PAGOS_COMPRA.map(([v]) => v), 'efectivo')
  pagoVenta = recordado(CLAVE_PAGO_VENTA, PAGOS_VENTA.map(([v]) => v), 'efectivo')
  ponerModo(pedido === 'cambio' ? 'cambio' : 'comprar')
  // Una compra a medias se conserva al cerrar y volver (el cliente sigue ahí).
  if (!dialogo.open) dialogo.showModal()
  if (paso === 'carta' && !actual) paso = 'buscar'
  // Un cambio se abre viendo los dos lados; una compra, buscando.
  if (enCambio()) irA(paso === 'carta' ? 'carta' : 'terminar')
  else irA(lineas.length && paso === 'terminar' ? 'terminar' : paso === 'carta' ? 'carta' : 'buscar')
}
