// MOVIMIENTOS Y RANKING (tanda 1171, P1 y P2 de la propuesta del Panel).
//
// PINGU: «si le doy a las que más se mueven, que me enseñe los movimientos
// y que no me lleve a la colección a secas; lo mismo con lo demás». Los
// «Ver todas» del Panel abrían la pestaña Cartas —tus cartas por expansión
// y número— y lo que el bloque prometía no estaba en ninguna parte. Aquí
// viven las dos listas que prometen:
//
// · MOVIMIENTOS (`?ver=movimientos`): todas tus cartas con precio por lo
//   que se han movido en un periodo (los mismos 7D · 1M · 6M · 1A de la
//   gráfica), con Todas · Suben · Bajan y el orden por tanto por ciento o
//   por euros. Sale de la foto diaria del histórico (`historicoDeExtremos`)
//   y de `movidasDe`, el mismo cálculo que el bloque de tres filas.
// · RANKING (`?ver=ranking`): todas tus cartas con precio de la que más
//   vale a la que menos, con el puesto, cuántas tienes y qué parte de tu
//   colección es cada una (la raya acumula). Por copia (la mejor carta) o
//   por línea (dónde está el dinero).
// · AÑADIDAS (`?ver=anadidas`, tanda 1172, P3): tu colección por FECHA DE
//   ENTRADA, agrupada por días como /avisos (Hoy, Ayer, Esta semana, los
//   meses), con lo que pagaste en cada tramo. «Tus cartas» del Panel
//   enseñaba lo último que metiste y su Ver todas abría Cartas, que va por
//   expansión y número: la pregunta «¿qué añadí el otro día?» se perdía al
//   pulsar. Con `?sin=pagado`, solo las líneas sin lo pagado apuntado, cada
//   una con su campo a mano: la cuenta de «Lo que te costó» (428) solo vale
//   sobre las que lo tienen, y rellenarlo carta a carta desde la ficha era
//   lo que nadie hacía.
//
// Son vistas de Mi colección sin botón en el menú: se llega desde el Panel
// y se vuelve con «‹ Panel» (la miga de la 474, hecha botón en la 856).
// Entra por import() al abrirlas, como el Panel. El estado llega en `ctx`
// (getters: cambia mientras se usa) y cada fila es `a.mc-movida` con su
// `data-carta`, que el pop-up de la carta ya conoce (`engancharFicha`).
import { escapeHtml } from '../app.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { nombreDeSet } from '../catalogo-series.js'
import { euros, valorDeLinea, idiomaDe } from '../cardmarket.js'
import { banderaHtml } from '../precio-vista.js'
import { tramoDe } from '../avisos-grupos.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { abrirAviso } from '../avisos-precio.js'
import * as datos from './datos.js'
import { movidasDe } from './movidas.js'
import { migasHtml } from './migas.js'

const $ = (id) => document.getElementById(id)

// Los periodos, los de la gráfica del valor (464) menos «Todo»: un
// movimiento «desde siempre» no es un movimiento.
export const PERIODOS = [['7D', 7], ['1M', 30], ['6M', 182], ['1A', 365]]
const TOPE_CARTAS = 600
const DE_UNA_VEZ = 50

let ctx = null
// Lo elegido se recuerda en el navegador, como el rango de la gráfica: es
// gusto de quien mira, no un dato de la colección.
const recordar = (clave, valor) => { try { localStorage.setItem(clave, valor) } catch {} }
const recordado = (clave, vale, porDefecto) => { try { const v = localStorage.getItem(clave); return vale.includes(v) ? v : porDefecto } catch { return porDefecto } }
let periodo = recordado('mc-mov-periodo', PERIODOS.map((p) => p[0]), '1M')
let filtro = 'todas'
let orden = 'pct'
let modoRanking = recordado('mc-rank-modo', ['copia', 'linea'], 'copia')
let cuantas = DE_UNA_VEZ
// El histórico pedido por periodo, una vez por visita: cambiar de Suben a
// Bajan no vuelve a preguntar.
const pedidos = new Map()
let version = 0

// ── Lo puro: lo que se puede probar sin pantalla ──

// Las líneas con precio, de más a menos valor, hasta el tope: a las que se
// les pide histórico. `valorDe(linea)` es el valor de la LÍNEA entera.
export function lineasConPrecio(lineas, valorDe, tope = TOPE_CARTAS) {
  return (lineas || [])
    .map((l) => ({ l, v: valorDe(l) || 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, tope)
    .map((x) => x.l)
}

// El resumen de un periodo: cuántas suben, cuántas bajan y cuánto se ha
// movido el total, contando las copias de cada línea.
export function resumenDeMovidas(movidas, lineas) {
  const copiasDe = (m) => (lineas || []).filter((l) => l.card_id === m.carta?.id && (l.idioma || 'es') === m.idioma).reduce((n, l) => n + (Number(l.cantidad) || 1), 0) || 1
  let suben = 0, bajan = 0, total = 0
  for (const m of movidas || []) {
    if (m.cambio > 0) suben++
    else if (m.cambio < 0) bajan++
    total += m.cambio * copiasDe(m)
  }
  return { suben, bajan, total: Math.round(total * 100) / 100 }
}

// Las movidas filtradas y ordenadas como se piden.
export function ordenarMovidas(movidas, { filtro = 'todas', orden = 'pct' } = {}) {
  const lista = (movidas || []).filter((m) => (filtro === 'suben' ? m.cambio > 0 : filtro === 'bajan' ? m.cambio < 0 : true))
  const peso = orden === 'eur' ? (m) => Math.abs(m.cambio) : (m) => Math.abs(m.pct ?? 0)
  return lista.sort((a, b) => peso(b) - peso(a) || Math.abs(b.cambio) - Math.abs(a.cambio))
}

// El ranking: una fila por carta (por `clave`), con lo que vale una copia,
// cuántas tienes, lo que vale la línea entera y qué parte de todo es.
// `modo`: 'copia' ordena por lo que vale UNA; 'linea', por copias × valor.
export function rankingDe(lineas, { clave, valorDe, busca, modo = 'copia' }) {
  const porCarta = new Map()
  let total = 0
  for (const l of lineas || []) {
    const v = valorDe(l)
    if (!(v > 0)) continue
    const copias = Number(l.cantidad) || 1
    const unidad = v / copias
    total += v
    const k = clave(l)
    const fila = porCarta.get(k) || { linea: l, unidad: 0, copias: 0, total: 0, idiomas: new Set() }
    if (unidad > fila.unidad) { fila.unidad = unidad; fila.linea = l }
    fila.copias += copias
    fila.total += v
    fila.idiomas.add(l.idioma || 'es')
    porCarta.set(k, fila)
  }
  const filas = [...porCarta.values()].sort((a, b) => (modo === 'linea' ? b.total - a.total : b.unidad - a.unidad) || b.total - a.total)
  let acumulado = 0
  return {
    total,
    filas: filas.map((f, i) => {
      acumulado += f.total
      return { puesto: i + 1, carta: busca(f.linea), linea: f.linea, unidad: f.unidad, copias: f.copias, total: f.total, idiomas: [...f.idiomas], parte: total ? (f.total / total) * 100 : 0, acumulado: total ? (acumulado / total) * 100 : 0 }
    }),
  }
}

// ── La pantalla ──

export function montar(c) { ctx = c }

export async function abrir(c, vista) {
  ctx = c
  cuantas = DE_UNA_VEZ
  if (vista === 'ranking') return pintarRanking()
  if (vista === 'anadidas') return pintarAnadidas()
  return pintarMovimientos()
}

const setDe = (c) => nombreDeSet(c.tcg_sets?.name ? c.tcg_sets : (ctx.todosLosSets || []).find((x) => x.id === c.set_id) || c.tcg_sets) || c.set_id || ''
const n = (x) => Number(x).toLocaleString('es-ES', { useGrouping: 'always' })
const pctTxt = (p) => `${Math.abs(Math.round(p))} %`

// La fila de una carta que se mueve: la del bloque del Panel (663) y, con
// `larga`, además las copias y el precio de antes.
export function filaDeMovidaHtml(m, { nombre, larga = false }) {
  const c = m.carta
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const signo = m.cambio > 0 ? '+' : '−'
  const pct = m.pct === null ? `${signo}${euros(Math.abs(m.cambio))}` : `${signo}${pctTxt(m.pct)}`
  // En la lista larga, el precio de antes va en su `span`: en un teléfono
  // estrecho se esconde y el nombre no se queda sin sitio.
  const detalle = larga ? `${escapeHtml(`${signo}${euros(Math.abs(m.cambio))}${m.pct === null ? '' : ` · ${signo}${pctTxt(m.pct)}`}`)}<span class="mc-movida-antes"> · antes ${escapeHtml(euros(m.antes))}</span>` : escapeHtml(pct)
  const copias = larga && m.copias ? ` · ${m.copias === 1 ? '1 copia' : `${m.copias} copias`}` : ''
  // En la lista larga, la campanita (1173, P6): una alerta de precio desde
  // aquí, que lo que se mueve es justo lo que se quiere vigilar. Fuera del
  // enlace: un botón no puede ir dentro de otro.
  const campana = larga ? `<button type="button" class="mc-movida-campana" data-alerta-de="${escapeHtml(c.id)}" data-market="${escapeHtml(c.market || 'WEST')}" data-idioma="${escapeHtml(m.idioma || 'es')}" data-precio="${m.ahora}" aria-label="${escapeHtml(`Avísame de ${nombre}`)}" title="Avísame">${icons.bell(16)}</button>` : ''
  return `<li${larga ? ' class="mc-anadida"' : ''}><a class="mc-movida ${m.cambio > 0 ? 'sube' : 'baja'}" href="${escapeHtml(rutaDeCarta(c))}" data-carta="${escapeHtml(c.id)}" aria-label="${escapeHtml(`${nombre}: ${pct} en el periodo, de ${euros(m.antes)} a ${euros(m.ahora)}`)}">
    <span class="mc-movida-foto">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
    <span class="mc-movida-nombre"><b>${escapeHtml(nombre)}</b><small>${escapeHtml(setDe(c))}${larga ? ` ${banderaHtml(m.idioma || 'es')}` : ''}${escapeHtml(copias)}</small></span>
    <span class="mc-movida-precio"><b>${escapeHtml(euros(m.ahora))}</b><small>${detalle}</small></span>
  </a>${campana}</li>`
}

// La cabecera de una vista del Panel: la miga de volver, el título y los
// mandos en una fila. La usan también las Estadísticas (panel.js).
export const cabeceraDeVistaHtml = (titulo, mandos = '') => `<div class="mc-vista-cab">
    ${migasHtml([{ texto: 'Panel', id: 'mcVistaVolver' }])}
    <h2 class="mc-subtitulo mc-vista-titulo">${escapeHtml(titulo)}</h2>
    ${mandos}
  </div>`
const cabeceraHtml = cabeceraDeVistaHtml

const seg = (grupo, id, texto, activo, cuenta = null) => `<button type="button" data-${grupo}="${id}" aria-pressed="${activo ? 'true' : 'false'}">${escapeHtml(texto)}${cuenta == null ? '' : ` <small>${n(cuenta)}</small>`}</button>`

export function engancharVolver(panel, c = ctx) {
  panel.querySelector('#mcVistaVolver')?.addEventListener('click', () => c.cambiarPestania('resumen'))
}

// ── Añadidas (1172) ──

// Las líneas por fecha de entrada, de la más nueva a la más vieja, en
// tramos de días. `sinPagado` deja solo las que no tienen lo pagado.
export function tramosDeAnadidas(lineas, { ahora = Date.now(), sinPagado = false } = {}) {
  const orden = [...(lineas || [])]
    .filter((l) => !sinPagado || !(Number(l.precio_compra) > 0))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  const tramos = []
  for (const l of orden) {
    const nombre = l.created_at ? tramoDe(l.created_at, ahora, { meses: true }) : 'Sin fecha'
    let t = tramos[tramos.length - 1]
    if (!t || t.nombre !== nombre) { t = { nombre, lineas: [], copias: 0, pagado: 0, sinApuntar: 0 }; tramos.push(t) }
    const copias = Number(l.cantidad) || 1
    t.lineas.push(l)
    t.copias += copias
    if (Number(l.precio_compra) > 0) t.pagado += Number(l.precio_compra) * copias
    else t.sinApuntar += 1
  }
  return tramos
}

let sinPagado = false
async function pintarAnadidas() {
  const panel = $('mcPanelAnadidas')
  if (!panel || !ctx.esMia) return
  const [ls, , busca] = ctx.pTodo()
  sinPagado = new URLSearchParams(location.search).get('sin') === 'pagado'
  const sinApuntar = ls.filter((l) => !(Number(l.precio_compra) > 0)).length
  const modos = `<div class="mc-seg mc-seg-sueltas mc-vista-modos" role="group" aria-label="Cuáles">${seg('sin', 'todas', 'Todas', !sinPagado, ls.length)}${seg('sin', 'pagado', 'Sin apuntar lo pagado', sinPagado, sinApuntar)}</div>`
  if (!panel.dataset.montado) {
    panel.innerHTML = `${cabeceraHtml('Añadidas', modos)}
      <p class="mc-vista-resumen" id="mcAnadResumen"></p>
      <div id="mcAnadLista"></div>`
    panel.dataset.montado = '1'
    engancharVolver(panel)
    panel.addEventListener('click', (e) => {
      const m = e.target.closest('[data-sin]')
      if (m) {
        const url = new URL(location.href)
        if (m.dataset.sin === 'pagado') url.searchParams.set('sin', 'pagado')
        else url.searchParams.delete('sin')
        history.replaceState(null, '', url)
        cuantas = DE_UNA_VEZ
        void pintarAnadidas()
        return
      }
      if (e.target.closest('[data-mas]')) { cuantas += DE_UNA_VEZ; void pintarAnadidas() }
    })
    // Lo pagado, a mano y guardado al salir del campo (896: se apunta ya y
    // se deshace si la base dice que no).
    panel.addEventListener('change', (e) => {
      const campo = e.target.closest('input[data-pagado-de]')
      if (campo) void guardarPagado(campo)
    })
  } else {
    panel.querySelector('.mc-vista-modos').outerHTML = modos
  }
  const tramos = tramosDeAnadidas(ls, { sinPagado })
  const lista = $('mcAnadLista')
  const total = tramos.reduce((n2, t) => n2 + t.lineas.length, 0)
  $('mcAnadResumen').innerHTML = sinPagado
    ? (total ? `<b>${n(total)}</b> ${total === 1 ? 'línea sin lo que pagaste' : 'líneas sin lo que pagaste'}: apúntalo aquí y entran en «Lo que te costó».` : 'Todas tus cartas tienen apuntado lo que pagaste.')
    : (total ? `<b>${n(total)}</b> ${total === 1 ? 'línea' : 'líneas'}, de la última que añadiste a la primera.` : '')
  if (!total) {
    lista.innerHTML = `<p class="empty-state">${sinPagado ? 'No queda ninguna por apuntar.' : 'Todavía no has añadido ninguna carta.'}</p>`
    return
  }
  let quedan = cuantas
  const trozos = []
  for (const t of tramos) {
    if (quedan <= 0) break
    const filas = t.lineas.slice(0, quedan)
    quedan -= filas.length
    trozos.push(`<h3 class="mc-vista-tramo">${escapeHtml(t.nombre)}<small>${n(t.copias)} ${t.copias === 1 ? 'carta' : 'cartas'}${t.pagado ? ` · ${escapeHtml(euros(t.pagado))}` : ''}${t.sinApuntar && !sinPagado ? ` · ${n(t.sinApuntar)} sin apuntar` : ''}</small></h3>
      <ul class="mc-movidas mc-anadidas">${filas.map((l) => filaDeAnadidaHtml(l, busca(l))).join('')}</ul>`)
  }
  lista.innerHTML = trozos.join('') + (total > cuantas ? `<p class="mc-vista-mas"><button type="button" class="btn-secondary" data-mas>Ver ${n(Math.min(DE_UNA_VEZ, total - cuantas))} más</button></p>` : '')
}

function filaDeAnadidaHtml(l, c) {
  const escaneo = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : ''
  const nombre = c ? ctx.nombreDe(c) : 'Carta'
  const copias = Number(l.cantidad) || 1
  const pagado = Number(l.precio_compra) > 0 ? Number(l.precio_compra) : null
  const dato = pagado !== null
    ? `<b>+${n(copias)}</b><small>pagaste ${escapeHtml(euros(pagado))}${copias > 1 ? ' por copia' : ''}</small>`
    : `<b>+${n(copias)}</b><label class="mc-anadida-pagado"><span class="sr-only">Lo que pagaste por ${escapeHtml(nombre)} (€)</span><input type="text" inputmode="decimal" placeholder="Pagaste (€)" data-pagado-de="${escapeHtml(l.id)}" /></label>`
  return `<li class="mc-anadida"><a class="mc-movida" href="${escapeHtml(c ? rutaDeCarta(c) : '#')}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(nombre)}">
    <span class="mc-movida-foto">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
    <span class="mc-movida-nombre"><b>${escapeHtml(nombre)}</b><small>${c ? escapeHtml(setDe(c)) : ''} ${banderaHtml(l.idioma || 'es')} ${escapeHtml(idiomaDe(l.idioma || 'es').nombre || '')}</small></span>
  </a><span class="mc-movida-precio mc-anadida-dato">${dato}</span></li>`
}

async function guardarPagado(campo) {
  const id = campo.dataset.pagadoDe
  const valor = Number(String(campo.value).replace(',', '.'))
  if (!(valor > 0)) { campo.value = ''; return }
  campo.disabled = true
  try {
    const nueva = await datos.actualizar(id, { precio_compra: Math.round(valor * 100) / 100 })
    ctx.cambiarLinea(id, nueva)
    showToast('Apuntado')
    // Se repinta entero: cambia la cuenta del tramo y, filtrando, la fila se va.
    void pintarAnadidas()
  } catch (err) {
    campo.disabled = false
    showToast(err?.message || 'No se ha podido guardar', 'error')
  }
}

async function pintarMovimientos() {
  const panel = $('mcPanelMovimientos')
  if (!panel || !ctx.esMia) return
  const v = ++version
  const [ls, , busca] = ctx.pTodo()
  const conPrecio = lineasConPrecio(ls, (l) => valorDeLinea(l, ctx.precioDe(l)))
  const periodos = `<div class="mc-valor-rangos mc-vista-periodos" role="group" aria-label="Periodo">${PERIODOS.map(([id]) => `<button type="button" class="mc-valor-rango${id === periodo ? ' activo' : ''}" data-periodo="${id}" aria-pressed="${id === periodo}">${id}</button>`).join('')}</div>`
  if (!panel.dataset.montado) {
    panel.innerHTML = `${cabeceraHtml('Movimientos', periodos)}
      <div class="mc-vista-mandos" id="mcMovMandos"></div>
      <p class="mc-vista-resumen" id="mcMovResumen" aria-live="polite"></p>
      <div id="mcMovLista"></div>`
    panel.dataset.montado = '1'
    engancharVolver(panel)
    panel.addEventListener('click', (e) => {
      const p = e.target.closest('[data-periodo]')
      if (p) { periodo = p.dataset.periodo; recordar('mc-mov-periodo', periodo); cuantas = DE_UNA_VEZ; void pintarMovimientos(); return }
      const f = e.target.closest('[data-filtro]')
      if (f) { filtro = f.dataset.filtro; cuantas = DE_UNA_VEZ; pintarListaDeMovidas(); return }
      const o = e.target.closest('[data-orden]')
      if (o) { orden = o.dataset.orden; pintarListaDeMovidas(); return }
      if (e.target.closest('[data-mas]')) { cuantas += DE_UNA_VEZ; pintarListaDeMovidas(); return }
      const campana = e.target.closest('[data-alerta-de]')
      if (campana) abrirAviso({ cardId: campana.dataset.alertaDe, market: campana.dataset.market, idioma: campana.dataset.idioma, precio: Number(campana.dataset.precio) || null })
    })
  } else {
    panel.querySelector('.mc-vista-periodos').outerHTML = periodos
  }
  const lista = $('mcMovLista')
  if (!conPrecio.length) {
    $('mcMovMandos').innerHTML = ''
    $('mcMovResumen').textContent = ''
    lista.innerHTML = '<p class="empty-state">Todavía no sabemos el precio de ninguna de tus cartas, así que no hay movimientos que enseñar.</p>'
    return
  }
  if (!pedidos.has(periodo)) {
    lista.innerHTML = `<ul class="mc-movidas" aria-hidden="true">${'<li class="mc-movida"><span class="skeleton mc-movida-foto"></span><span class="skeleton mc-movida-esq"></span></li>'.repeat(5)}</ul>`
    const dias = PERIODOS.find((p) => p[0] === periodo)[1]
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
    try {
      const filas = await datos.historicoDeExtremos(conPrecio.map((l) => l.card_id), desde)
      const movidas = movidasDe(conPrecio, filas, busca)
      for (const m of movidas) m.copias = conPrecio.filter((l) => l.card_id === m.carta.id && (l.idioma || 'es') === m.idioma).reduce((s, l) => s + (Number(l.cantidad) || 1), 0)
      pedidos.set(periodo, { movidas, resumen: resumenDeMovidas(movidas, conPrecio) })
    } catch (err) {
      if (v !== version) return
      lista.innerHTML = `<p class="empty-state">No se ha podido leer el histórico de precios: ${escapeHtml(err?.message || 'inténtalo en un momento')}.</p>`
      return
    }
  }
  if (v !== version || ctx.pestania !== 'movimientos') return
  pintarListaDeMovidas()
}

function pintarListaDeMovidas() {
  const lo = pedidos.get(periodo)
  const lista = $('mcMovLista')
  if (!lo || !lista) return
  const { movidas, resumen } = lo
  const nombreP = { '7D': 'esta semana', '1M': 'este mes', '6M': 'en seis meses', '1A': 'este año' }[periodo]
  $('mcMovMandos').innerHTML = `<div class="mc-seg mc-seg-sueltas" role="group" aria-label="Cuáles">${seg('filtro', 'todas', 'Todas', filtro === 'todas', movidas.length)}${seg('filtro', 'suben', 'Suben', filtro === 'suben', resumen.suben)}${seg('filtro', 'bajan', 'Bajan', filtro === 'bajan', resumen.bajan)}</div>
    <div class="mc-seg mc-seg-sueltas" role="group" aria-label="Orden">${seg('orden', 'pct', 'Por %', orden === 'pct')}${seg('orden', 'eur', 'Por €', orden === 'eur')}</div>`
  const signo = resumen.total > 0 ? '+' : resumen.total < 0 ? '−' : ''
  $('mcMovResumen').innerHTML = movidas.length
    ? `<b class="${resumen.total > 0 ? 'mc-gana' : resumen.total < 0 ? 'mc-pierde' : ''}">${signo}${escapeHtml(euros(Math.abs(resumen.total)))}</b> ${escapeHtml(nombreP)} en lo que tienes · <b>${n(resumen.suben)}</b> ${resumen.suben === 1 ? 'sube' : 'suben'} · <b>${n(resumen.bajan)}</b> ${resumen.bajan === 1 ? 'baja' : 'bajan'}`
    : ''
  const visibles = ordenarMovidas(movidas, { filtro, orden })
  if (!visibles.length) {
    lista.innerHTML = `<p class="empty-state">${movidas.length ? `Ninguna de tus cartas ${filtro === 'suben' ? 'sube' : 'baja'} ${nombreP}.` : `Nada se ha movido ${nombreP}, o el histórico de precios no llega tan atrás.`}</p>`
    return
  }
  const tramo = visibles.slice(0, cuantas)
  lista.innerHTML = `<ul class="mc-movidas">${tramo.map((m) => filaDeMovidaHtml(m, { nombre: ctx.nombreDe(m.carta), larga: true })).join('')}</ul>
    ${visibles.length > cuantas ? `<p class="mc-vista-mas"><button type="button" class="btn-secondary" data-mas>Ver ${n(Math.min(DE_UNA_VEZ, visibles.length - cuantas))} más</button></p>` : ''}`
}

function pintarRanking() {
  const panel = $('mcPanelRanking')
  if (!panel || !ctx.esMia) return
  const [ls, clave, busca] = ctx.pTodo()
  const modos = `<div class="mc-seg mc-seg-sueltas mc-vista-modos" role="group" aria-label="Por qué ordenar">${seg('modo', 'copia', 'Por copia', modoRanking === 'copia')}${seg('modo', 'linea', 'Por línea', modoRanking === 'linea')}</div>`
  if (!panel.dataset.montado) {
    panel.innerHTML = `${cabeceraHtml('Las que más valen', modos)}
      <p class="mc-vista-resumen" id="mcRankResumen"></p>
      <div id="mcRankLista"></div>`
    panel.dataset.montado = '1'
    engancharVolver(panel)
    panel.addEventListener('click', (e) => {
      const m = e.target.closest('[data-modo]')
      if (m) { modoRanking = m.dataset.modo; recordar('mc-rank-modo', modoRanking); cuantas = DE_UNA_VEZ; pintarRanking(); return }
      if (e.target.closest('[data-mas]')) { cuantas += DE_UNA_VEZ; pintarRanking() }
    })
  } else {
    panel.querySelector('.mc-vista-modos').outerHTML = modos
  }
  const r = rankingDe(ls, { clave, busca, valorDe: (l) => valorDeLinea(l, ctx.precioDe(l)), modo: modoRanking })
  const lista = $('mcRankLista')
  if (!r.filas.length) {
    $('mcRankResumen').textContent = ''
    lista.innerHTML = '<p class="empty-state">Todavía no sabemos el precio de ninguna de tus cartas.</p>'
    return
  }
  const cinco = r.filas[Math.min(4, r.filas.length - 1)]
  $('mcRankResumen').innerHTML = `<b>${n(r.filas.length)}</b> ${r.filas.length === 1 ? 'carta con precio' : 'cartas con precio'}, <b>${escapeHtml(euros(r.total))}</b> en total${r.filas.length > 1 ? ` · ${r.filas.length >= 5 ? 'las cinco primeras' : `las ${r.filas.length} primeras`} son el <b>${escapeHtml(pctTxt(cinco.acumulado))}</b>` : ''}${modoRanking === 'copia' ? ' · por lo que vale UNA copia' : ' · por lo que vale cada línea entera'}`
  const tramo = r.filas.slice(0, cuantas)
  lista.innerHTML = `<ol class="mc-movidas mc-ranking">${tramo.map((f) => {
    const c = f.carta
    if (!c) return ''
    const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
    const nombre = ctx.nombreDe(c)
    const cifra = modoRanking === 'linea' ? f.total : f.unidad
    return `<li><a class="mc-movida" href="${escapeHtml(rutaDeCarta(c))}" data-carta="${escapeHtml(c.id)}" aria-label="${escapeHtml(`${f.puesto}. ${nombre}: ${euros(cifra)}, el ${pctTxt(f.parte)} de tu colección`)}">
      <span class="mc-rank-puesto${f.puesto <= 3 ? ' mc-rank-podio' : ''}">${f.puesto}</span>
      <span class="mc-movida-foto">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
      <span class="mc-movida-nombre"><b>${escapeHtml(nombre)}</b><small>${escapeHtml(setDe(c))} ${f.idiomas.slice(0, 2).map(banderaHtml).join('')} · ×${n(f.copias)}</small><span class="mc-rank-acum" aria-hidden="true"><i style="width:${Math.max(1, Math.min(100, f.acumulado)).toFixed(1)}%"></i></span></span>
      <span class="mc-movida-precio"><b>${escapeHtml(euros(cifra))}</b><small>${f.puesto > 1 ? `${escapeHtml(pctTxt(f.parte))} · acum. ${escapeHtml(pctTxt(f.acumulado))}` : `${escapeHtml(pctTxt(f.parte))} de todo`}</small></span>
    </a></li>`
  }).join('')}</ol>
    ${r.filas.length > cuantas ? `<p class="mc-vista-mas"><button type="button" class="btn-secondary" data-mas>Ver ${n(Math.min(DE_UNA_VEZ, r.filas.length - cuantas))} más</button></p>` : ''}`
}
