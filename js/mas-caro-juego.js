// «¿Más caro o más barato?» en pantalla (tanda 583). Lo puro —el día, qué
// acierta, el texto que se comparte— vive en js/mas-caro.js.
//
// La partida se guarda en el navegador, como «¿Qué carta es?»: se juega
// sin cuenta, y lo que vale compartir es el resultado, no guardarlo.
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { euros } from './cardmarket.js'
import { RONDAS, numeroDelDia, acierta, textoParaCompartir, rachaDeDias, ENLACE } from './mas-caro.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pokedoc-mas-caro'
const CLAVE_DIAS = 'pokedoc-mas-caro-jugados'

let dia = null
let cartas = []
let estado = { dia: null, respuestas: [] } // respuestas: true/false por ronda
let destapando = false

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
  caja.querySelector('.mcr-precio').textContent = precio === null ? '¿?' : euros(precio)
  caja.classList.toggle('bien', veredicto === true)
  caja.classList.toggle('mal', veredicto === false)
}

function pintarTira() {
  $('mcrTira').innerHTML = Array.from({ length: RONDAS }, (_, i) => {
    const r = estado.respuestas[i]
    return `<li class="${r === true ? 'bien' : r === false ? 'mal' : ''}" aria-label="${r === true ? 'acierto' : r === false ? 'fallo' : 'pendiente'}"></li>`
  }).join('')
}

function pintarPar() {
  const i = Math.min(ronda(), RONDAS - 1)
  const a = cartas[i]
  const b = cartas[i + 1]
  if (!a || !b) return
  pintarCarta($('mcrA'), a, { precio: a.precio })
  pintarCarta($('mcrB'), b, terminado() ? { precio: b.precio, veredicto: estado.respuestas[RONDAS - 1] } : {})
}

function pintarFinal() {
  const final = $('mcrFinal')
  if (!terminado()) {
    final.classList.add('hidden')
    $('mcrAcciones').classList.remove('hidden')
    return
  }
  $('mcrAcciones').classList.add('hidden')
  const aciertos = estado.respuestas.filter(Boolean).length
  const racha = rachaDeDias(diasJugados(), dia)
  final.innerHTML = `
    <p class="mcr-final-titulo">${aciertos === RONDAS ? '¡Las cinco!' : `${aciertos} de ${RONDAS}`}</p>
    <p class="subtext">${racha >= 2 ? `${racha} días seguidos · ` : ''}Mañana hay otras seis cartas.</p>
    <div class="mcr-final-botones">
      <button type="button" class="btn-primary" id="mcrCompartir">Compartir el resultado</button>
      <button type="button" class="btn-secondary" id="mcrImagen">Compartir como imagen</button>
    </div>
    <canvas id="mcrLienzo" class="hidden" width="1080" height="1350" aria-hidden="true"></canvas>`
  final.classList.remove('hidden')
  $('mcrCompartir').addEventListener('click', compartirTexto)
  $('mcrImagen').addEventListener('click', compartirImagen)
}

function pintarTodo() {
  pintarPar()
  pintarTira()
  pintarFinal()
  $('mcrSub').textContent = `Reto #${numeroDelDia(dia)} · ${terminado() ? 'resuelto' : `pregunta ${ronda() + 1} de ${RONDAS}`}`
}

function textoDeHoy() {
  return textoParaCompartir({ dia, tira: estado.respuestas, rachaDias: rachaDeDias(diasJugados(), dia) })
}

async function compartirTexto() {
  const texto = textoDeHoy()
  try {
    if (navigator.share) {
      await navigator.share({ text: texto })
      return
    }
  } catch (err) {
    if (err?.name === 'AbortError') return
  }
  try {
    await navigator.clipboard.writeText(texto)
    showToast('Resultado copiado. ¡Pégalo donde quieras presumir!', 'success')
  } catch {
    showToast('No se ha podido copiar el resultado.')
  }
}

async function compartirImagen() {
  const [{ pintarResultadoReto }, { compartirLienzo }] = await Promise.all([import('./reto-imagen.js'), import('./imagen-compartir.js')])
  const aciertos = estado.respuestas.filter(Boolean).length
  const lienzo = pintarResultadoReto($('mcrLienzo'), {
    titulo: '¿Más caro o más barato?',
    cuenta: `${aciertos}/${RONDAS}`,
    detalle: `Reto #${numeroDelDia(dia)}`,
    tira: estado.respuestas,
    racha: rachaDeDias(diasJugados(), dia),
    enlace: ENLACE,
  })
  await compartirLienzo(lienzo, { nombreFichero: `mas-caro-${numeroDelDia(dia)}.png`, texto: textoDeHoy() })
}

// Responder: se destapa el precio de B con el veredicto, y un momento
// después B pasa a ser la A de la siguiente pregunta.
function responder(respuesta) {
  if (terminado() || destapando) return
  const i = ronda()
  const a = cartas[i]
  const b = cartas[i + 1]
  const bien = acierta(a.precio, b.precio, respuesta)
  estado.respuestas.push(bien)
  guardarEstado()
  if (terminado()) apuntarDia()
  destapando = true
  pintarCarta($('mcrB'), b, { precio: b.precio, veredicto: bien })
  pintarTira()
  // Con «menos movimiento» no hay pausa que esperar: se pasa ya.
  const pausa = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900
  setTimeout(() => {
    destapando = false
    pintarTodo()
  }, pausa)
}

// Sin cartas, ni marcos vacíos ni «¿?» (787, PA6): parecía roto. Se quita
// el tablero y queda un vacío que dice qué pasa y adónde ir.
function sinTablero(texto) {
  document.querySelector('.mcr-tablero')?.classList.add('hidden')
  $('mcrAcciones').classList.add('hidden')
  $('mcrSub').insertAdjacentHTML('afterend', `<p class="empty-state">${texto}<br><a class="btn-primary" href="/retos">Ver los otros retos</a></p>`)
  $('mcrSub').classList.add('hidden')
}

async function init() {
  let r
  try {
    const res = await fetch('/.netlify/functions/mas-caro', { headers: { accept: 'application/json' } })
    r = await res.json()
    if (!res.ok || r.error) throw new Error(r.error || `HTTP ${res.status}`)
  } catch (err) {
    sinTablero('Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  dia = r.dia
  cartas = r.cartas || []
  if (cartas.length < RONDAS + 1) {
    sinTablero('Hoy no hay cartas suficientes con precio. Vuelve mañana.')
    return
  }
  cargarEstado()
  pintarTodo()
  $('mcrAcciones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-respuesta]')
    if (b) responder(b.dataset.respuesta)
  })
}

init()
