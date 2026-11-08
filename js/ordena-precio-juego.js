// «Ordena por precio» en pantalla (tanda 835). Lo puro vive en
// js/ordena-precio.js; las cuatro cartas, en netlify/functions/ordena-precio.mjs.
//
// Se tocan en orden (1, 2, 3, 4). Al comprobar, las que están en su sitio se
// quedan fijas en verde y el resto se vuelve a ordenar: tres intentos.
//
// Desde la 1268 los precios no están en la página: cada carta va con una
// llave que no dice nada (a, b, c, d), cada orden lo corrige la base
// (`retos_jugar`) y los precios llegan al acabar.
import { escapeHtml } from './html.js'
import { getSession } from './app.js'
import { icons } from './icons.js'
import { nombreDeCarta } from './catalogo-series.js'
import { euros } from './cardmarket.js'
import { CARTAS, INTENTOS, numeroDelDia, ordenBueno, textoParaCompartir, ENLACE } from './ordena-precio.js'
import { xpDe, xpSiAciertasOrdena } from './retos-xp.js'
import { estadisticas, misNumeros } from './retos-datos.js'
import { partida } from './reto-arbitro.js'
import { showToast } from './toast.js'
import { premiosHtml, cuentaAtras, genteHtml, salidasHtml, avisoLibreHtml } from './retos-ui.js'
import { hechoHoy } from './retos-siguiente.js'
import { rachaDeDias } from './reto-compartir.js'
import { libreDeDireccion, claveLibre } from './retos-libre.js'
import { hoyISO } from './reto-diario.js'
import { traerRetoConFotos, TEXTO_SIN_FOTO } from './reto-fotos.js'

const $ = (id) => document.getElementById(id)
// Una partida libre (988, `?libre=N`): otras cuatro, en su propia llave, sin
// XP, sin racha y sin compartir.
const libre = libreDeDireccion(location.search)
const hoy = hoyISO()
const CLAVE = claveLibre('pokedoc-ordena-precio', libre)
const CLAVE_DIAS = 'pokedoc-ordena-precio-acertados'

let dia = null
let cartas = []
let porId = new Map()
let estado = { dia: null, intentos: [], acertada: false }
// Lo que dijo la base de cada intento (cuáles están en su sitio) y, al
// acabar, los precios.
let bienes = []
let precios = null
let arbitro = null
let jugando = false
// Lo que llevas puesto en este intento: un id por posición, o null.
let puestos = Array(CARTAS).fill(null)
let sesion = null
let guardado = null

const leer = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? defecto } catch { return defecto } }
const escribir = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)) } catch {} }
const terminado = () => Boolean(estado.terminada) || estado.acertada || estado.intentos.length >= INTENTOS
// Con los precios (al acabar), cada carta con el suyo.
const conPrecio = () => cartas.map((c) => ({ ...c, precio: precios?.[c.id] ?? null }))

// Lo que contesta la base, a la pantalla (y al navegador, para «Mi día»).
function aplicar(r) {
  const e = r?.estado || {}
  estado = { dia, intentos: e.intentos || [], acertada: Boolean(e.acertada), terminada: Boolean(e.terminada) }
  bienes = e.bien || []
  precios = e.precios || null
  if (r?.guardado) guardado = r.guardado
  escribir(CLAVE, estado)
}
const diasAcertados = () => { const d = leer(CLAVE_DIAS, []); return Array.isArray(d) ? d : [] }

// Las posiciones que el último intento acertó: se quedan puestas.
function fijas() {
  const ultimo = estado.intentos.at(-1)
  if (!ultimo) return Array(CARTAS).fill(null)
  const bien = bienes.at(-1) || []
  return ultimo.map((id, i) => (bien[i] ? id : null))
}

function empezarIntento() {
  puestos = fijas()
}

// La foto llega por /reto-foto (1268): su dirección no dice qué carta es.
const fotoHtml = (c) => (c?.foto ? `<img src="${escapeHtml(c.foto)}" alt="" width="245" height="342" loading="lazy" />` : '')

function pintarCartas() {
  const fija = fijas()
  const bueno = terminado() && precios ? ordenBueno(conPrecio()) : null
  const lista = bueno ? bueno.map((id) => porId.get(id)) : cartas
  $('opCartas').innerHTML = lista.map((c) => {
    const pos = bueno ? bueno.indexOf(c.id) : puestos.indexOf(c.id)
    // Al acabar se enseñan en su orden bueno y con precio: verdes si las
    // ordenaste tú, sin marca si no (ese orden ya no es el tuyo).
    const esFija = terminado() ? estado.acertada : fija.includes(c.id)
    const clase = esFija ? ' fija' : ''
    return `<button type="button" class="op-carta${clase}" data-id="${escapeHtml(c.id)}"${terminado() || esFija ? ' disabled' : ''} aria-label="${escapeHtml(nombreDeCarta(c))}${pos >= 0 ? `, en el puesto ${pos + 1}` : ''}">
      <span class="op-foto">${fotoHtml(c)}</span>
      ${pos >= 0 ? `<span class="op-numero">${pos + 1}</span>` : ''}
      <span class="op-nombre">${escapeHtml(nombreDeCarta(c))}</span>
      ${bueno ? `<span class="op-precio">${euros(precios[c.id])}</span>` : ''}
    </button>`
  }).join('')
  $('opComprobar').disabled = puestos.some((x) => !x)
}

function pintarIntentos() {
  $('opIntentos').innerHTML = estado.intentos.map((o, n) => {
    const bien = bienes[n] || []
    return `<li class="op-intento"><b>${n + 1}.º</b><span class="op-intento-mini">${o.map((id, i) => `<span class="${bien[i] ? 'si' : ''}">${fotoHtml(porId.get(id) || {})}</span>`).join('')}</span><span>${bien.filter(Boolean).length} de ${CARTAS} en su sitio</span></li>`
  }).join('')
}

function pintarBote() {
  const b = $('opBote')
  b.classList.toggle('hidden', terminado() || Boolean(libre))
  b.innerHTML = `${icons.zap(14)} ${sesion ? 'Ahora vale' : 'Con cuenta, ahora vale'} +${xpSiAciertasOrdena(estado.intentos.length)} XP`
}

function pintarFinal() {
  const f = $('opFinal')
  $('opAcciones').classList.toggle('hidden', terminado())
  if (!terminado()) { f.classList.add('hidden'); return }
  const n = estado.intentos.length
  f.className = `op-final rj-final${estado.acertada ? '' : ' fallado'}`
  f.innerHTML = `
    <p class="rj-final-titulo">${estado.acertada ? (n === 1 ? '¡A la primera!' : `¡Ordenadas en ${n}!`) : 'Esta vez no'}</p>
    <p class="subtext" style="margin:0">De la más barata a la más cara, con su precio de hoy<span id="opGente"></span></p>
    <div id="opPremios"></div>
    ${salidasHtml({ juego: 'ordena', ruta: '/ordena-precio', dia: hoy, libre, compartirId: 'opCompartir', cuentaId: 'opCuenta' })}`
  f.classList.remove('hidden')
  $('opCompartir')?.addEventListener('click', compartir)
  cuentaAtras($('opCuenta'), 'Mañana, otras:')
  if (libre) return
  pintarPremios()
  estadisticas('ordena', dia).then((s) => { const c = $('opGente'); if (c) c.textContent = genteHtml(s, 'las ha ordenado') }).catch(() => {})
}

function pintarPremios() {
  const caja = $('opPremios')
  if (!caja) return
  caja.innerHTML = premiosHtml(guardado || (sesion ? null : { sinCuenta: true }), {
    posible: xpDe('ordena', { acertada: estado.acertada, intentos: estado.intentos.length }),
    volver: '/ordena-precio',
    racha: rachaDeDias(diasAcertados(), dia),
    rachaTexto: 'acertando seguidos',
  })
}

function pintarTodo() {
  pintarCartas()
  pintarIntentos()
  pintarBote()
  pintarFinal()
  // Tras un intento, lo que dice: las verdes se quedan.
  const ultimo = estado.intentos.at(-1)
  const pista = ultimo ? ` · ${(bienes.at(-1) || []).filter(Boolean).length} de ${CARTAS} en su sitio; las verdes se quedan` : ' · toca de la más barata a la más cara'
  $('opSub').textContent = `${libre ? 'Partida libre' : `Reto #${numeroDelDia(dia)}`} · ${terminado() ? 'resuelto' : `intento ${estado.intentos.length + 1} de ${INTENTOS}${pista}`}`
}

function tocar(id) {
  if (terminado() || fijas().includes(id)) return
  const ya = puestos.indexOf(id)
  if (ya >= 0) puestos[ya] = null
  else {
    const hueco = puestos.indexOf(null)
    if (hueco >= 0) puestos[hueco] = id
  }
  pintarCartas()
}

async function comprobar() {
  if (terminado() || jugando || puestos.some((x) => !x)) return
  jugando = true
  $('opComprobar').disabled = true
  let r
  try {
    r = await arbitro.jugar({ orden: [...puestos] })
  } catch (e) {
    jugando = false
    $('opComprobar').disabled = false
    showToast(e.message || 'No se ha podido comprobar. Inténtalo de nuevo.', 'error')
    return
  }
  jugando = false
  aplicar(r)
  if (estado.acertada) {
    const d = diasAcertados()
    if (!libre && !d.includes(dia)) escribir(CLAVE_DIAS, [...d, dia].slice(-400))
  }
  empezarIntento()
  pintarTodo()
}

// La hoja de compartir (871): el texto y la imagen, con una fila de cuatro
// casillas por intento.
async function compartir() {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const texto = textoParaCompartir({ dia, intentos: estado.intentos, cartas: conPrecio(), acertada: estado.acertada })
  await abrirHojaCompartir({ titulo: 'Ordena por precio', texto, imagen: imagenDelResultado, nombre: `ordena-precio-${numeroDelDia(dia)}` })
}

async function imagenDelResultado(formato) {
  const { pintarResultadoReto } = await import('./reto-imagen.js')
  return pintarResultadoReto(document.createElement('canvas'), {
    titulo: 'Ordena por precio',
    cuenta: `${estado.acertada ? estado.intentos.length : 'X'}/${INTENTOS}`,
    numero: numeroDelDia(dia),
    lema: 'Ordena cartas por su precio, cada día',
    filas: estado.intentos.map((_, n) => bienes[n] || []),
    racha: rachaDeDias(diasAcertados(), dia),
    enlace: ENLACE,
    formato,
  })
}

function sinTablero(texto) {
  document.querySelector('.op-tablero')?.classList.add('hidden')
  $('opBote').classList.add('hidden')
  $('opSub').insertAdjacentHTML('afterend', `<p class="empty-state">${texto}<br><a class="btn-primary" href="/retos">Ver los otros retos</a></p>`)
  $('opSub').classList.add('hidden')
}

async function init() {
  let r
  try {
    r = await traerRetoConFotos('ordena-precio', { libre, cadenasDe: (x) => (x.cartas || []).map((c) => [c.foto]) })
  } catch (e) {
    sinTablero(e.sinFoto ? TEXTO_SIN_FOTO : 'Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  dia = r.dia
  cartas = (r.cartas || []).slice(0, CARTAS)
  if (cartas.length < CARTAS) { sinTablero('Hoy no hay cartas suficientes con precio. Vuelve mañana.'); return }
  porId = new Map(cartas.map((c) => [c.id, c]))
  try {
    arbitro = partida('ordena', { dia, libre })
    aplicar(await arbitro.abrir())
  } catch (e) {
    sinTablero(e.sinArbitro ? e.message : 'Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  if (libre) $('opSub').insertAdjacentHTML('afterend', avisoLibreHtml(hechoHoy(hoy)('ordena'), '/ordena-precio'))
  sesion = await getSession().catch(() => null)
  empezarIntento()
  pintarTodo()
  $('opCartas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]')
    if (b && !b.disabled) tocar(b.dataset.id)
  })
  $('opComprobar').addEventListener('click', comprobar)
  $('opLimpiar').addEventListener('click', () => { empezarIntento(); pintarCartas() })
  if (sesion && terminado() && !libre && !guardado) {
    misNumeros(1).then((n) => { if (n?.hoy?.ordena) { guardado = { nuevo: false, xp: n.hoy.ordena.xp }; pintarPremios() } }).catch(() => {})
  }
}

init()
