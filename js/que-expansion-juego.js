// «¿De qué expansión es?» en pantalla (tanda 835). Lo puro vive en
// js/que-expansion.js; las cinco rondas, en netlify/functions/que-expansion.mjs.
//
// Desde la 1268 la página no sabe la buena: la mesa trae la foto de cada
// ronda (sin dirección que diga el set) y sus cuatro opciones, y cada
// respuesta la corrige la base (`retos_jugar`), que dice cuál era.
import { escapeHtml } from './html.js'
import { getSession, getProfile } from './app.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { nombreDeCarta, nombreDeSet, logosDePago } from './catalogo-series.js'
import { urlDeLogo } from './carta-ruta.js'
import { RONDAS, numeroDelDia, textoParaCompartir, ENLACE } from './que-expansion.js'
import { xpDe, mejorQue } from './retos-xp.js'
import { estadisticas, misNumeros } from './retos-datos.js'
import { partida } from './reto-arbitro.js'
import { premiosHtml, cuentaAtras, salidasHtml, avisoLibreHtml } from './retos-ui.js'
import { hechoHoy } from './retos-siguiente.js'
import { rachaDeDias } from './reto-compartir.js'
import { libreDeDireccion, claveLibre } from './retos-libre.js'
import { hoyISO } from './reto-diario.js'
import { traerRetoConFotos, TEXTO_SIN_FOTO } from './reto-fotos.js'

const $ = (id) => document.getElementById(id)
// Una partida libre (988, `?libre=N`): otras cinco, en su propia llave, sin
// XP, sin racha y sin compartir.
const libre = libreDeDireccion(location.search)
const hoy = hoyISO()
const CLAVE = claveLibre('pokedoc-que-expansion', libre)
const CLAVE_DIAS = 'pokedoc-que-expansion-jugados'

let dia = null
let rondas = []
// La expansión que elegiste en cada ronda (su id).
let estado = { dia: null, elegidas: [], tira: [] }
// Las buenas de las rondas ya contestadas (las dice la base al contestar).
let buenas = []
let arbitro = null
let sesion = null
let guardado = null
let pasando = false

const leer = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? defecto } catch { return defecto } }
const escribir = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)) } catch {} }
const ronda = () => estado.elegidas.length
const terminado = () => ronda() >= RONDAS
// La buena de cada ronda la dice la base al contestarla (1268): es la
// expansión en la que se VE la carta (976).
const nombreBueno = (i) => nombreDeSet(rondas[i]?.opciones?.find((s) => s.id === buenas[i])) || buenas[i] || ''
const tira = () => (estado.tira || []).map(Boolean)

// Lo que contesta la base, a la pantalla (y al navegador, para «Mi día»).
function aplicar(r) {
  const e = r?.estado || {}
  estado = { dia, elegidas: e.elegidas || [], tira: e.tira || [] }
  buenas = e.buenas || []
  if (r?.guardado) guardado = r.guardado
  escribir(CLAVE, estado)
}
const diasJugados = () => { const d = leer(CLAVE_DIAS, []); return Array.isArray(d) ? d : [] }

// La foto llega por /reto-foto (1268): su dirección no dice de qué set es.
const fotoHtml = (r) => (r?.foto ? `<img src="${escapeHtml(r.foto)}" alt="Carta de la ronda" width="245" height="342" loading="eager" draggable="false" />` : '')

// El logo, con su cadena de respaldos (TCGdex y luego los de pago).
function logoHtml(s) {
  const cadena = [s?.logo_path ? urlDeLogo(s.logo_path) : null, ...logosDePago(s)].filter(Boolean)
  if (!cadena.length) return ''
  const [primera, ...resto] = cadena
  const salto = "var r=(this.dataset.respaldos||'').split(' ').filter(Boolean);if(r.length){this.src=r.shift();this.dataset.respaldos=r.join(' ')}else{this.remove()}"
  return `<img src="${escapeHtml(primera)}"${resto.length ? ` data-respaldos="${escapeHtml(resto.join(' '))}"` : ''} onerror="${salto}" alt="" width="96" height="48" loading="lazy" />`
}

function pintarPasos() {
  const t = tira()
  $('qxPasos').innerHTML = Array.from({ length: RONDAS }, (_, i) => {
    const r = t[i]
    const clase = r === true ? 'rj-paso si' : r === false ? 'rj-paso no' : i === ronda() && !terminado() ? 'rj-paso ahora' : 'rj-paso'
    return `<li class="${clase}">${r === true ? icons.checkCircle(18) : r === false ? icons.xCircle(18) : i + 1}</li>`
  }).join('')
}

function pintarRonda(revelar = null) {
  const i = revelar ?? Math.min(ronda(), RONDAS - 1)
  const r = rondas[i]
  $('qxCarta').innerHTML = fotoHtml(r)
  const elegida = estado.elegidas[i]
  $('qxOpciones').innerHTML = r.opciones.map((s) => {
    const clase = elegida ? (s.id === buenas[i] ? ' acierto' : s.id === elegida ? ' fallo' : '') : ''
    const ano = String(s.release_date || '').slice(0, 4)
    return `<button type="button" class="qx-opcion${clase}" data-set="${escapeHtml(s.id)}"${elegida ? ' disabled' : ''}><span class="qx-logo">${logoHtml(s)}</span><span><b>${escapeHtml(nombreDeSet(s) || s.id)}</b>${ano ? `<small>${ano}</small>` : ''}</span>${clase === ' acierto' ? icons.checkCircle(22) : clase === ' fallo' ? icons.xCircle(22) : ''}</button>`
  }).join('')
}

function pintarFinal() {
  const f = $('qxFinal')
  document.querySelector('.qx-lado').classList.toggle('hidden', terminado())
  $('qxCarta').classList.toggle('hidden', terminado())
  if (!terminado()) { f.classList.add('hidden'); return }
  const t = tira()
  const aciertos = t.filter(Boolean).length
  f.className = `qx-final rj-final${aciertos >= 3 ? '' : ' fallado'}`
  f.innerHTML = `
    <p class="rj-final-titulo">${aciertos === RONDAS ? '¡Las cinco!' : `${aciertos} de ${RONDAS}`}</p>
    <p class="subtext" style="margin:0" id="qxGente">${libre ? 'Partida libre' : `Reto #${numeroDelDia(dia)}`}</p>
    <ol class="qx-repaso">${rondas.map((r, i) => `<li class="${t[i] ? 'si' : ''}"><span class="qx-mini">${fotoHtml(r)}</span><span>${t[i] ? icons.checkCircle(14) : icons.xCircle(14)} ${escapeHtml(nombreBueno(i))}</span></li>`).join('')}</ol>
    <div id="qxPremios"></div>
    ${salidasHtml({ juego: 'expansion', ruta: '/que-expansion', dia: hoy, libre, compartirId: 'qxCompartir', cuentaId: 'qxCuenta' })}`
  f.classList.remove('hidden')
  $('qxCompartir')?.addEventListener('click', compartir)
  cuentaAtras($('qxCuenta'), 'Mañana, otras:')
  if (libre) return
  pintarPremios()
  estadisticas('expansion', dia).then((s) => {
    const m = mejorQue(s?.porAciertos, aciertos)
    if (m != null && $('qxGente')) $('qxGente').textContent = `Reto #${numeroDelDia(dia)} · mejor que el ${m} % de la gente de hoy`
  }).catch(() => {})
}

function pintarPremios() {
  const caja = $('qxPremios')
  if (!caja) return
  caja.innerHTML = premiosHtml(guardado || (sesion ? null : { sinCuenta: true }), {
    posible: xpDe('expansion', { aciertos: tira().filter(Boolean).length }),
    volver: '/que-expansion',
    racha: rachaDeDias(diasJugados(), dia),
  })
}

function pintarTodo() {
  pintarPasos()
  if (!terminado()) pintarRonda()
  pintarFinal()
  $('qxSub').textContent = `${libre ? 'Partida libre' : `Reto #${numeroDelDia(dia)}`} · ${terminado() ? 'resuelto' : `carta ${ronda() + 1} de ${RONDAS}`}`
}

async function elegir(setId) {
  if (terminado() || pasando) return
  const i = ronda()
  pasando = true
  let r
  try {
    r = await arbitro.jugar({ set: setId })
  } catch (e) {
    pasando = false
    showToast(e.message || 'No se ha podido comprobar. Inténtalo de nuevo.', 'error')
    return
  }
  aplicar(r)
  if (terminado() && !libre) {
    const d = diasJugados()
    if (!d.includes(dia)) escribir(CLAVE_DIAS, [...d, dia].slice(-400))
  }
  const bien = Boolean(r.eco?.bien)
  pintarRonda(i)
  pintarPasos()
  const v = $('qxVeredicto')
  v.className = `qx-veredicto${bien ? '' : ' mal'}`
  v.innerHTML = bien ? `${icons.checkCircle(22)} ¡Bien!${sesion && !libre ? ' +4 XP' : ''}` : `${icons.xCircle(22)} Era ${escapeHtml(nombreBueno(i))}`
  setTimeout(() => {
    pasando = false
    v.classList.add('hidden')
    pintarTodo()
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 1400)
}

// La hoja de compartir (871): el texto y la imagen con la tira de cinco.
async function compartir() {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const texto = textoParaCompartir({ dia, tira: tira() })
  await abrirHojaCompartir({ titulo: '¿De qué expansión es?', texto, imagen: imagenDelResultado, nombre: `que-expansion-${numeroDelDia(dia)}` })
}

async function imagenDelResultado(formato) {
  const { pintarResultadoReto } = await import('./reto-imagen.js')
  const t = tira()
  return pintarResultadoReto(document.createElement('canvas'), {
    titulo: '¿De qué expansión es?',
    cuenta: `${t.filter(Boolean).length}/${RONDAS}`,
    numero: numeroDelDia(dia),
    lema: 'Adivina de qué expansión es cada carta',
    tira: t,
    racha: rachaDeDias(diasJugados(), dia),
    enlace: ENLACE,
    formato,
  })
}

function sinTablero(texto) {
  document.querySelector('.qx-tablero')?.classList.add('hidden')
  $('qxPasos').classList.add('hidden')
  $('qxSub').insertAdjacentHTML('afterend', `<p class="empty-state">${texto}<br><a class="btn-primary" href="/retos">Ver los otros retos</a></p>`)
  $('qxSub').classList.add('hidden')
}

// «Cambiar esta carta», solo para admins (1111b): por si una foto mala (un
// dorso que la fuente sirve como foto) se escapa a lo automático. Cambia la
// ronda para todo el mundo; pide una segunda pulsación.
async function ponerCambiarCarta() {
  const perfil = await getProfile(sesion.user.id).catch(() => null)
  if (!perfil?.is_admin) return
  $('qxVeredicto').insertAdjacentHTML('afterend', '<p class="subtext"><button type="button" class="link-btn" id="qxCambiar">Cambiar esta carta para todos (admin)</button></p>')
  const b = $('qxCambiar')
  b.addEventListener('click', async () => {
    if (terminado()) return
    if (!b.dataset.seguro) { b.dataset.seguro = '1'; b.textContent = 'Pulsa otra vez para cambiarla'; return }
    b.disabled = true
    try {
      const res = await fetch('/.netlify/functions/que-expansion', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${sesion.access_token}` }, body: JSON.stringify({ ronda: ronda() }) })
      const r = await res.json()
      if (!res.ok || r.error) throw new Error(r.error || `HTTP ${res.status}`)
      rondas = (r.rondas || []).slice(0, RONDAS)
      pintarTodo()
      showToast(r.sinFoto?.length ? 'No había otra carta con foto para cambiarla.' : 'Carta cambiada para todos.', r.sinFoto?.length ? 'error' : 'success')
    } catch (e) {
      showToast(`No se ha podido cambiar: ${e.message}`, 'error')
    } finally {
      delete b.dataset.seguro
      b.textContent = 'Cambiar esta carta para todos (admin)'
      b.disabled = false
    }
  })
}

async function init() {
  let r
  try {
    r = await traerRetoConFotos('que-expansion', { libre, cadenasDe: (x) => (x.rondas || []).map((ronda) => [ronda.foto]) })
  } catch (e) {
    sinTablero(e.sinFoto ? TEXTO_SIN_FOTO : 'Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  dia = r.dia
  rondas = (r.rondas || []).slice(0, RONDAS)
  if (rondas.length < RONDAS) { sinTablero('Hoy no hay cartas para este reto. Vuelve mañana.'); return }
  try {
    arbitro = partida('expansion', { dia, libre })
    aplicar(await arbitro.abrir())
  } catch (e) {
    sinTablero(e.sinArbitro ? e.message : 'Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  if (libre) $('qxSub').insertAdjacentHTML('afterend', avisoLibreHtml(hechoHoy(hoy)('expansion'), '/que-expansion'))
  sesion = await getSession().catch(() => null)
  pintarTodo()
  if (sesion && !libre) ponerCambiarCarta()
  $('qxOpciones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]')
    if (b && !b.disabled) elegir(b.dataset.set)
  })
  if (sesion && terminado() && !libre && !guardado) {
    misNumeros(1).then((n) => { if (n?.hoy?.expansion) { guardado = { nuevo: false, xp: n.hoy.expansion.xp }; pintarPremios() } }).catch(() => {})
  }
}

init()
