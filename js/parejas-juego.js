// «Parejas» en pantalla (tanda 989). Lo puro —la mesa, la XP, el texto— vive
// en js/parejas.js; las seis cartas, en netlify/functions/parejas.mjs.
//
// Doce cartas boca abajo. Se vuelven dos: si son la misma se quedan, y si no,
// se vuelven a tapar al rato. Un movimiento es cada par de cartas vueltas.
//
// Desde la 1268 la página NO sabe dónde está cada carta: la mesa se baraja
// por partida en la base (`retos_jugar`) y cada carta que vuelves la dice
// ella. Hasta la 1267 la mesa salía de la fecha y las doce caras estaban en
// la página, tapadas solo con CSS.
import { escapeHtml } from './html.js'
import { getSession } from './app.js'
import { icons } from './icons.js'
import { nombreDeCarta } from './catalogo-series.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { rutaDeCarta } from './carta-ruta.js'
import { hoyISO } from './reto-diario.js'
import { PAREJAS, numeroDelDia, xpQueQueda, xpDeMovimientos, textoParaCompartir, ENLACE } from './parejas.js'
import { estadisticas, misNumeros } from './retos-datos.js'
import { partida } from './reto-arbitro.js'
import { showToast } from './toast.js'
import { premiosHtml, cuentaAtras, salidasHtml, avisoLibreHtml } from './retos-ui.js'
import { hechoHoy } from './retos-siguiente.js'
import { rachaDeDias } from './reto-compartir.js'
import { libreDeDireccion, claveLibre } from './retos-libre.js'
import { traerRetoConFotos, TEXTO_SIN_FOTO } from './reto-fotos.js'

const $ = (id) => document.getElementById(id)
// Una partida libre (988, `?libre=N`): otra mesa, en su propia llave, sin XP,
// sin racha y sin compartir.
const libre = libreDeDireccion(location.search)
const hoy = hoyISO()
const CLAVE = claveLibre('pokedoc-parejas', libre)
const CLAVE_DIAS = 'pokedoc-parejas-jugados'
// Lo que tarda en taparse una pareja que no lo es: lo justo para verla.
const ESPERA = 900

let dia = null
let cartas = []
const HUECOS = PAREJAS * 2
let estado = { dia: null, movimientos: 0, hechas: [], tira: [] }
// Lo que se sabe de la mesa: qué carta hay en cada hueco ya visto (los de
// las parejas hechas y los que están vueltos ahora mismo).
let vistas = {}
// Los huecos vueltos ahora mismo.
let abiertas = []
let arbitro = null
let bloqueado = false
let sesion = null
let guardado = null

const leer = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? defecto } catch { return defecto } }
const escribir = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)) } catch {} }
const terminado = () => Boolean(estado.terminada) || (estado.hechas || []).length >= PAREJAS

// Lo que contesta la base, a la pantalla (y al navegador, para «Mi día»).
function aplicar(r) {
  const e = r?.estado || {}
  estado = { dia, movimientos: e.movimientos || 0, hechas: e.hechas || [], tira: e.tira || [], terminada: Boolean(e.terminada) }
  vistas = { ...vistas, ...(e.descubiertas || {}) }
  if (e.abierta) { vistas[e.abierta.hueco] = e.abierta.carta; abiertas = [e.abierta.hueco] }
  if (r?.guardado) guardado = r.guardado
  escribir(CLAVE, estado)
}
const diasJugados = () => { const d = leer(CLAVE_DIAS, []); return Array.isArray(d) ? d : [] }

function fotoHtml(c, carga = 'eager') {
  const a = atributosDeEscaneo(cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null))
  return a ? `<img ${a} alt="" width="245" height="342" loading="${carga}" draggable="false" />` : ''
}

// Una carta tapada no lleva su cara en la página (1268): solo la que se ve.
function pintarMesa() {
  $('paMesa').innerHTML = Array.from({ length: HUECOS }, (_, k) => {
    const i = vistas[k]
    const hecha = i != null && estado.hechas.includes(i)
    const vuelta = i != null && (hecha || abiertas.includes(k))
    return `<button type="button" class="pa-carta${vuelta ? ' vuelta' : ''}${hecha ? ' hecha' : ''}" data-hueco="${k}"${hecha || terminado() ? ' disabled' : ''} aria-label="${vuelta ? escapeHtml(nombreDeCarta(cartas[i])) : `Carta ${k + 1}, boca abajo`}">
      <span class="pa-dorso" aria-hidden="true"></span>
      <span class="pa-cara">${vuelta ? fotoHtml(cartas[i]) : ''}</span>
    </button>`
  }).join('')
}

function pintarMarcador() {
  $('paMovimientos').textContent = String(estado.movimientos)
  $('paHechas').textContent = `${estado.hechas.length}/${PAREJAS}`
  const b = $('paBote')
  b.classList.toggle('hidden', terminado() || Boolean(libre))
  b.innerHTML = `${icons.zap(14)} ${sesion ? 'Ahora vale' : 'Con cuenta, ahora vale'} +${xpQueQueda(estado.movimientos, estado.hechas.length)} XP`
  $('paSub').textContent = `${libre ? 'Partida libre' : `Reto #${numeroDelDia(dia)}`} · ${terminado() ? 'resuelto' : 'da la vuelta a dos cartas: si son la misma, se quedan'}`
}

function pintarFinal() {
  const f = $('paFinal')
  if (!terminado()) { f.classList.add('hidden'); return }
  const m = estado.movimientos
  f.className = 'pa-final rj-final'
  f.innerHTML = `
    <p class="rj-final-titulo">¡Hecho en ${m} movimientos!</p>
    <p class="subtext" style="margin:0">${m <= PAREJAS ? 'Sin fallar ni una' : `${m - PAREJAS} de más`} · toca una carta para ver su ficha<span id="paGente"></span></p>
    <ul class="pa-repaso" aria-label="Las seis cartas">${cartas.map((c) => `<li><a href="${escapeHtml(rutaDeCarta(c))}" title="${escapeHtml(nombreDeCarta(c))}">${fotoHtml(c, 'lazy')}<span>${escapeHtml(nombreDeCarta(c))}</span></a></li>`).join('')}</ul>
    <div id="paPremios"></div>
    ${salidasHtml({ juego: 'parejas', ruta: '/parejas', dia: hoy, libre, compartirId: 'paCompartir', cuentaId: 'paCuenta' })}`
  f.classList.remove('hidden')
  $('paCompartir')?.addEventListener('click', compartir)
  cuentaAtras($('paCuenta'), 'Mañana, otras:')
  // La partida de «Jugar otra vez» se pide ya, por detrás: al tocar, sus
  // cartas salen de la caché del navegador en vez de esperar a elegirlas.
  const otra = Number(new URL(f.querySelector('.rj-otra')?.href || location.href).searchParams.get('libre'))
  if (otra) pedirCartas(otra).catch(() => {})
  if (libre) return
  pintarPremios()
  // La media de la gente, en movimientos: es lo que se compara.
  estadisticas('parejas', dia).then((s) => {
    const n = Object.entries(s?.porIntentos || {}).reduce((t, [k, v]) => [t[0] + Number(k) * Number(v), t[1] + Number(v)], [0, 0])
    if (n[1] >= 5 && $('paGente')) $('paGente').textContent = ` · hoy la gente lo ha hecho en ${(n[0] / n[1]).toLocaleString('es-ES', { maximumFractionDigits: 1 })} de media`
  }).catch(() => {})
}

function pintarPremios() {
  const caja = $('paPremios')
  if (!caja) return
  caja.innerHTML = premiosHtml(guardado || (sesion ? null : { sinCuenta: true }), {
    posible: xpDeMovimientos(estado.movimientos),
    volver: '/parejas',
    racha: rachaDeDias(diasJugados(), dia),
  })
}

function pintarTodo() {
  pintarMesa()
  pintarMarcador()
  pintarFinal()
}

// Mientras la base contesta la primera de dos, la segunda que se toca espera
// en cola (un toque rápido no se pierde).
let enVuelo = false
let enCola = null

async function tocar(k) {
  if (enVuelo) { if (!abiertas.includes(k)) enCola = k; return }
  if (bloqueado || terminado() || abiertas.includes(k) || (vistas[k] != null && estado.hechas.includes(vistas[k]))) return
  bloqueado = true
  enVuelo = true
  let r
  try {
    r = await arbitro.jugar({ hueco: k })
  } catch (e) {
    bloqueado = false
    enVuelo = false
    enCola = null
    showToast(e.message || 'No se ha podido dar la vuelta. Inténtalo de nuevo.', 'error')
    return
  }
  enVuelo = false
  const eco = r.eco || {}
  vistas[k] = eco.carta
  if (eco.otro == null) {
    // La primera de dos: se queda vuelta esperando a la otra.
    aplicar(r)
    abiertas = [k]
    bloqueado = false
    pintarTodo()
    const cola = enCola
    enCola = null
    if (cola != null && cola !== k) tocar(cola)
    return
  }
  enCola = null
  vistas[eco.otro] = eco.otraCarta
  abiertas = [eco.otro, k]
  const yaAcabada = terminado()
  aplicar(r)
  if (eco.pareja) {
    abiertas = []
    bloqueado = false
    pintarTodo()
    if (terminado() && !yaAcabada && !libre) { const d = diasJugados(); if (!d.includes(dia)) escribir(CLAVE_DIAS, [...d, dia].slice(-400)) }
    return
  }
  // No es pareja: se ven las dos un momento y se tapan.
  pintarMesa()
  pintarMarcador()
  setTimeout(() => { abiertas = []; bloqueado = false; pintarMesa() }, ESPERA)
}

// La hoja de compartir: el texto con la tira (verde = pareja) y la imagen,
// sin las cartas: quien la ve todavía puede jugar las de hoy.
async function compartir() {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const texto = textoParaCompartir({ dia, movimientos: estado.movimientos, tira: estado.tira })
  await abrirHojaCompartir({ titulo: 'Parejas', texto, imagen: imagenDelResultado, nombre: `parejas-${numeroDelDia(dia)}` })
}

async function imagenDelResultado(formato) {
  const { pintarResultadoReto } = await import('./reto-imagen.js')
  const filas = []
  for (let i = 0; i < estado.tira.length; i += 8) filas.push(estado.tira.slice(i, i + 8))
  return pintarResultadoReto(document.createElement('canvas'), {
    titulo: 'Parejas',
    cuenta: `${estado.movimientos} mov.`,
    numero: numeroDelDia(dia),
    lema: 'Encuentra las seis parejas, cada día',
    filas: filas.slice(0, 4),
    racha: rachaDeDias(diasJugados(), dia),
    enlace: ENLACE,
    formato,
  })
}

function sinMesa(texto) {
  $('paMesa').classList.add('hidden')
  document.querySelector('.pa-marcador')?.classList.add('hidden')
  $('paSub').insertAdjacentHTML('afterend', `<p class="empty-state">${texto}<br><a class="btn-primary" href="/retos">Ver los otros retos</a></p>`)
  $('paSub').classList.add('hidden')
}


// Para pedir por detrás la partida de «Jugar otra vez» (sus fotos se
// comprueban al abrirla).
const pedirCartas = (n) => fetch(`/.netlify/functions/parejas?libre=${n}`, { headers: { accept: 'application/json' } })

async function init() {
  // La mesa ya sale tapada desde el HTML (990). La cuenta se pide a la vez.
  const cuenta = getSession().catch(() => null)
  let r
  try {
    r = await traerRetoConFotos('parejas', { libre, cartasDe: (x) => x.cartas || [] })
  } catch (e) {
    sinMesa(e.sinFoto ? TEXTO_SIN_FOTO : 'Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  dia = r.dia
  cartas = (r.cartas || []).slice(0, PAREJAS)
  if (cartas.length < PAREJAS) { sinMesa('Hoy no hay cartas para este reto. Vuelve mañana.'); return }
  // Las seis caras se cargan ya (no dicen dónde está cada una): al dar la
  // vuelta salen al momento.
  for (const c of cartas) { const u = cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null)[0]; if (u) new Image().src = u }
  try {
    arbitro = partida('parejas', { dia, libre })
    aplicar(await arbitro.abrir())
  } catch (e) {
    sinMesa(e.sinArbitro ? e.message : 'Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  sesion = await cuenta
  $('paMesa').removeAttribute('aria-busy')
  if (libre) $('paSub').insertAdjacentHTML('afterend', avisoLibreHtml(hechoHoy(hoy)('parejas'), '/parejas'))
  pintarTodo()
  $('paMesa').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hueco]')
    if (b && !b.disabled) tocar(Number(b.dataset.hueco))
  })
  if (sesion && terminado() && !libre && !guardado) {
    misNumeros(1).then((n) => { if (n?.hoy?.parejas) { guardado = { nuevo: false, xp: n.hoy.parejas.xp }; pintarPremios() } }).catch(() => {})
  }
}

init()
