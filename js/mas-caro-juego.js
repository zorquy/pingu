// «¿Más caro o más barato?» en pantalla (tanda 583; rehecho en la 835 con
// la maqueta que aprobó PINGU). Lo puro —el día, qué acierta, el texto que
// se comparte— vive en js/mas-caro.js; la XP, en js/retos-xp.js y en la base.
//
// La partida se guarda en el navegador: se juega sin cuenta. Con cuenta,
// al acabar se manda el resultado a `retos_guardar`, que da la XP.
import { escapeHtml } from './html.js'
import { getSession } from './app.js'
import { icons } from './icons.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { euros } from './cardmarket.js'
import { RONDAS, numeroDelDia, acierta, textoParaCompartir, rachaDeDias, ENLACE } from './mas-caro.js'
import { xpDe, xpDelSiguienteCaro, mejorQue } from './retos-xp.js'
import { guardarResultado, estadisticas, misNumeros, traerPartidaDeHoy } from './retos-datos.js'
import { premiosHtml, cuentaAtras, salidasHtml, avisoLibreHtml } from './retos-ui.js'
import { hechoHoy } from './retos-siguiente.js'
import { libreDeDireccion, claveLibre } from './retos-libre.js'
import { hoyISO } from './reto-diario.js'
import { traerRetoConFotos, TEXTO_SIN_FOTO } from './reto-fotos.js'

const $ = (id) => document.getElementById(id)
// Una partida libre (988, `?libre=N`): otras seis, en su propia llave, sin
// XP, sin racha y sin compartir.
const libre = libreDeDireccion(location.search)
const hoy = hoyISO()
const CLAVE = claveLibre('pokedoc-mas-caro', libre)
const CLAVE_DIAS = 'pokedoc-mas-caro-jugados'

let dia = null
let cartas = []
let estado = { dia: null, respuestas: [] } // respuestas: true/false por ronda
let destapando = false
let sesion = null
let guardado = null
let pararCuenta = () => {}
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function cargarEstado() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (g && g.dia === dia && Array.isArray(g.respuestas)) estado = g
    else estado = { dia, respuestas: [] }
  } catch {
    estado = { dia, respuestas: [] }
  }
}

function guardarEstado() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado))
  } catch {}
}

function diasJugados() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_DIAS) || '[]')
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

function apuntarDia() {
  if (libre) return
  const d = diasJugados()
  if (!d.includes(dia)) d.push(dia)
  try {
    localStorage.setItem(CLAVE_DIAS, JSON.stringify(d.slice(-400)))
  } catch {}
}

const ronda = () => estado.respuestas.length
const terminado = () => ronda() >= RONDAS

function pintarCarta(caja, carta, { precio = null, veredicto = null } = {}) {
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(carta, carta?.tcg_sets?.tcg_online_code || null))
  caja.querySelector('.mcr-foto').innerHTML = escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''
  caja.querySelector('.mcr-nombre').textContent = nombreDeCarta(carta)
  caja.querySelector('.mcr-set').textContent = `${nombreDeSet(carta?.tcg_sets) || carta?.set_id || ''}${carta?.local_id ? ` · ${carta.local_id}` : ''}`
  const p = caja.querySelector('.mcr-precio')
  p.classList.toggle('oculto', precio === null)
  p.textContent = precio === null ? '¿?' : euros(precio)
  caja.classList.toggle('bien', veredicto === true)
  caja.classList.toggle('mal', veredicto === false)
}

// El precio de B sube contando hasta el de verdad (835). Con «menos
// movimiento», de golpe.
function contarHasta(el, precio, ms = 700) {
  if (sinMovimiento()) { el.textContent = euros(precio); return }
  const t0 = performance.now()
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms)
    el.textContent = euros(precio * (1 - (1 - k) ** 3))
    if (k < 1) requestAnimationFrame(paso)
  }
  requestAnimationFrame(paso)
}

function pintarTira() {
  $('mcrTira').innerHTML = Array.from({ length: RONDAS }, (_, i) => {
    const r = estado.respuestas[i]
    const clase = r === true ? 'rj-paso bien si' : r === false ? 'rj-paso mal no' : i === ronda() && !terminado() ? 'rj-paso ahora' : 'rj-paso'
    const dentro = r === true ? icons.checkCircle(18) : r === false ? icons.xCircle(18) : String(i + 1)
    return `<li class="${clase}" aria-label="${r === true ? 'acierto' : r === false ? 'fallo' : 'pendiente'}">${dentro}</li>`
  }).join('')
  // La racha dentro del reto: desde el tercer acierto seguido, el doble.
  const combo = $('mcrCombo')
  const doble = !terminado() && xpDelSiguienteCaro(estado.respuestas) === 6
  combo.classList.toggle('hidden', !doble)
  combo.innerHTML = doble ? `${icons.flame(14)} Racha ×2 · esta vale doble` : ''
}

function pintarPar() {
  const i = Math.min(ronda(), RONDAS - 1)
  const a = cartas[i]
  const b = cartas[i + 1]
  if (!a || !b) return
  pintarCarta($('mcrA'), a, { precio: a.precio })
  pintarCarta($('mcrB'), b, terminado() ? { precio: b.precio, veredicto: estado.respuestas[RONDAS - 1] } : {})
  $('mcrDiferencia').innerHTML = terminado() ? diferenciaHtml(a.precio, b.precio) : ''
}

function diferenciaHtml(pa, pb) {
  const d = Number(pb) - Number(pa)
  if (!Number.isFinite(d) || d === 0) return ''
  return d > 0
    ? `${icons.trendingUp(16)} ${euros(d)} más`
    : `<span style="display:inline-flex;transform:scaleY(-1)">${icons.trendingUp(16)}</span> ${euros(-d)} menos`
}

function pintarFinal() {
  const final = $('mcrFinal')
  if (!terminado()) {
    final.classList.add('hidden')
    $('mcrAcciones').classList.remove('hidden')
    return
  }
  $('mcrAcciones').classList.add('hidden')
  $('mcrVeredicto').classList.add('hidden')
  const aciertos = estado.respuestas.filter(Boolean).length
  const rondas = estado.respuestas.map((bien, i) => {
    const a = cartas[i]
    const b = cartas[i + 1]
    const signo = Number(b?.precio) > Number(a?.precio) ? '&lt;' : '&gt;'
    return `<li class="mcr-ronda"><span class="${bien ? 'ok' : 'mal'}" aria-label="${bien ? 'acierto' : 'fallo'}">${bien ? icons.checkCircle(18) : icons.xCircle(18)}</span><span>${escapeHtml(nombreDeCarta(a))}<em>${euros(a?.precio)}</em></span><b aria-hidden="true">${signo}</b><span>${escapeHtml(nombreDeCarta(b))}<em>${euros(b?.precio)}</em></span></li>`
  }).join('')
  final.innerHTML = `
    <div class="mcr-final-cab">
      <small>${libre ? 'Partida libre' : `Reto #${numeroDelDia(dia)}`}</small>
      <p class="mcr-final-titulo">${aciertos === RONDAS ? '¡Las cinco!' : `${aciertos} de ${RONDAS}`}</p>
      <ol class="rj-pasos mcr-tira" aria-hidden="true">${estado.respuestas.map((b) => `<li class="rj-paso ${b ? 'si' : 'no'}">${b ? icons.checkCircle(18) : icons.xCircle(18)}</li>`).join('')}</ol>
      <p class="subtext" id="mcrGente" style="margin:0;color:inherit"></p>
      <div id="mcrPremios"></div>
      ${salidasHtml({ juego: 'caro', ruta: '/mas-caro', dia: hoy, libre, compartirId: 'mcrCompartir', cuentaId: 'mcrCuenta' })}
    </div>
    <ol class="mcr-rondas" aria-label="Las cinco rondas">${rondas}</ol>`
  final.classList.remove('hidden')
  $('mcrCompartir')?.addEventListener('click', compartir)
  pararCuenta()
  pararCuenta = cuentaAtras($('mcrCuenta'), 'Mañana, otras:')
  if (libre) return
  pintarPremios()
  estadisticas('caro', dia).then((s) => {
    const m = mejorQue(s?.porAciertos, aciertos)
    if (m != null && $('mcrGente')) $('mcrGente').textContent = `Mejor que el ${m} % de la gente de hoy`
  }).catch(() => {})
}

function pintarPremios() {
  const caja = $('mcrPremios')
  if (!caja) return
  caja.innerHTML = premiosHtml(guardado || (sesion ? null : { sinCuenta: true }), {
    posible: xpDe('caro', { tira: estado.respuestas }),
    volver: '/mas-caro',
    racha: rachaDeDias(diasJugados(), dia),
  })
}

async function guardar() {
  if (libre || !terminado() || estado.guardado) return
  const r = await guardarResultado('caro', dia, {
    aciertos: estado.respuestas.filter(Boolean).length,
    total: RONDAS,
    tira: estado.respuestas,
  }).catch(() => ({ error: true }))
  if (r && (r.nuevo === true || r.nuevo === false)) {
    estado.guardado = true
    guardarEstado()
    guardado = r
  } else if (r?.sinCuenta) guardado = r
  pintarPremios()
}

function pintarTodo() {
  pintarPar()
  pintarTira()
  pintarFinal()
  $('mcrSub').textContent = `${libre ? 'Partida libre' : `Reto #${numeroDelDia(dia)}`} · ${terminado() ? 'resuelto' : `pregunta ${ronda() + 1} de ${RONDAS}`}`
}

function textoDeHoy() {
  return textoParaCompartir({ dia, tira: estado.respuestas, rachaDias: rachaDeDias(diasJugados(), dia) })
}

// La hoja de compartir (871): texto e imagen (historia y apaisada) con
// vista previa. Se arma al pulsar, que la racha llega después de guardar.
async function compartir() {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  await abrirHojaCompartir({ titulo: '¿Más caro o más barato?', texto: textoDeHoy(), imagen: imagenDelResultado, nombre: `mas-caro-${numeroDelDia(dia)}` })
}

async function imagenDelResultado(formato) {
  const { pintarResultadoReto } = await import('./reto-imagen.js')
  const aciertos = estado.respuestas.filter(Boolean).length
  return pintarResultadoReto(document.createElement('canvas'), {
    titulo: '¿Más caro o más barato?',
    cuenta: `${aciertos}/${RONDAS}`,
    numero: numeroDelDia(dia),
    lema: '¿Qué carta vale más? Un reto cada día',
    tira: estado.respuestas,
    racha: rachaDeDias(diasJugados(), dia),
    enlace: ENLACE,
    formato,
  })
}

// Responder: el precio de B sube contando, la carta se ilumina, se dice lo
// que vale el acierto y un momento después B pasa a ser la A de la
// siguiente ronda.
function responder(respuesta) {
  if (terminado() || destapando) return
  const i = ronda()
  const a = cartas[i]
  const b = cartas[i + 1]
  const bien = acierta(a.precio, b.precio, respuesta)
  const vale = bien ? xpDelSiguienteCaro(estado.respuestas) : 0
  estado.respuestas.push(bien)
  guardarEstado()
  if (terminado()) apuntarDia()
  destapando = true
  pintarCarta($('mcrB'), b, { precio: b.precio, veredicto: bien })
  contarHasta($('mcrB').querySelector('.mcr-precio'), b.precio)
  $('mcrDiferencia').innerHTML = diferenciaHtml(a.precio, b.precio)
  const ver = $('mcrVeredicto')
  ver.className = `mcr-veredicto${bien ? '' : ' mal'}`
  const dice = Number(b.precio) > Number(a.precio) ? 'Vale más' : 'Vale menos'
  ver.innerHTML = `<b>${bien ? icons.checkCircle(24) : icons.xCircle(24)} ${bien ? `¡Bien! ${dice}` : `¡Vaya! ${dice}`}</b>${bien && !libre ? `<span class="rj-chip xp">${icons.zap(14)} +${vale} XP${vale === 6 ? ' (×2)' : ''}</span>` : ''}`
  pintarTira()
  // Con «menos movimiento» no hay pausa que esperar: se pasa ya.
  const pausa = sinMovimiento() ? 0 : 1500
  setTimeout(() => {
    destapando = false
    if (!terminado()) ver.classList.add('hidden')
    pintarTodo()
    if (terminado()) guardar()
  }, pausa)
}

// Sin cartas, ni marcos vacíos ni «?» (787, PA6): parecía roto. Se quita
// el tablero y queda un vacío que dice qué pasa y adónde ir.
function sinTablero(texto) {
  document.querySelector('.mcr-tablero')?.classList.add('hidden')
  document.querySelector('.mcr-progreso')?.classList.add('hidden')
  $('mcrAcciones').classList.add('hidden')
  $('mcrSub').insertAdjacentHTML('afterend', `<p class="empty-state">${texto}<br><a class="btn-primary" href="/retos">Ver los otros retos</a></p>`)
  $('mcrSub').classList.add('hidden')
}

async function init() {
  $('mcrIconoMas').innerHTML = icons.trendingUp(24)
  $('mcrIconoMenos').innerHTML = `<span style="display:inline-flex;transform:scaleY(-1)">${icons.trendingUp(24)}</span>`
  let r
  try {
    r = await traerRetoConFotos('mas-caro', { libre, cartasDe: (x) => x.cartas || [] })
  } catch (err) {
    sinTablero(err.sinFoto ? TEXTO_SIN_FOTO : 'Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  dia = r.dia
  cartas = r.cartas || []
  if (cartas.length < RONDAS + 1) {
    sinTablero('Hoy no hay cartas suficientes con precio. Vuelve mañana.')
    return
  }
  // Si hoy ya lo jugaste en otro aparato, la partida baja de la base (841).
  if (!libre) await traerPartidaDeHoy('caro', dia).catch(() => false)
  if (libre) $('mcrSub').insertAdjacentHTML('afterend', avisoLibreHtml(hechoHoy(hoy)('caro'), '/mas-caro'))
  cargarEstado()
  sesion = await getSession().catch(() => null)
  pintarTodo()
  if (sesion && terminado() && !libre) {
    if (!estado.guardado) guardar()
    else misNumeros(1).then((n) => { if (n?.hoy?.caro) { guardado = { nuevo: false, xp: n.hoy.caro.xp }; pintarPremios() } }).catch(() => {})
  }
  $('mcrAcciones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-respuesta]')
    if (b) responder(b.dataset.respuesta)
  })
}

init()
