// «¿Quién es ese Pokémon?» en pantalla (tanda 835). Lo puro —el Pokémon del
// día, las opciones y el texto— vive en js/quien-es.js; la XP, en
// js/retos-xp.js y en la base.
import { escapeHtml } from './html.js'
import { getSession } from './app.js'
import { icons } from './icons.js'
import { POKEMON_POR_DEX } from './torneos/sprites-pokemon.js'
import { hoyISO } from './reto-diario.js'
import { INTENTOS, numeroDelDia, urlsDelDibujo, textoParaCompartir, ENLACE } from './quien-es.js'
import { xpDe, xpSiAciertasSilueta } from './retos-xp.js'
import { estadisticas, misNumeros } from './retos-datos.js'
import { partida } from './reto-arbitro.js'
import { traerRetoConFotos } from './reto-fotos.js'
import { showToast } from './toast.js'
import { premiosHtml, cuentaAtras, genteHtml, salidasHtml, avisoLibreHtml } from './retos-ui.js'
import { hechoHoy } from './retos-siguiente.js'
import { rachaDeDias } from './reto-compartir.js'
import { libreDeDireccion, claveLibre } from './retos-libre.js'

const $ = (id) => document.getElementById(id)
// Una partida libre (988, `?libre=N`) se juega como otro día y en su propia
// llave: no toca la de hoy, ni la racha, ni la base.
const libre = libreDeDireccion(location.search)
const hoy = hoyISO()
const CLAVE = claveLibre('pokedoc-quien-es', libre)
const CLAVE_DIAS = 'pokedoc-quien-es-acertados'

// El Pokémon del día ya no sale de la fecha en la página (1268): lo elige el
// servidor con su semilla secreta y lo sabe la base. La página tiene las
// cuatro opciones y la silueta (negra y borrosa, hecha en el servidor); el
// número de la buena llega al acabar.
let dia = null
let opciones = []
let foto = null
let buena = null
let arbitro = null
let jugando = false
const nombre = (dex) => POKEMON_POR_DEX[dex - 1] || `#${dex}`
let estado = { dia: null, elegidos: [], acertada: false }
let sesion = null
let guardado = null

const leer = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? defecto } catch { return defecto } }
const escribir = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)) } catch {} }

const fallos = () => (estado.acertada ? estado.elegidos.slice(0, -1) : estado.elegidos)
const terminado = () => Boolean(estado.terminada) || estado.acertada || fallos().length >= INTENTOS

// Lo que contesta la base, a la pantalla (y al navegador, para «Mi día»).
function aplicar(r) {
  const e = r?.estado || {}
  estado = { dia, elegidos: e.elegidos || [], acertada: Boolean(e.acertada), terminada: Boolean(e.terminada) }
  if (e.foto) foto = e.foto
  if (e.buena) buena = Number(e.buena)
  if (r?.guardado) guardado = r.guardado
  escribir(CLAVE, estado)
}
const diasAcertados = () => { const d = leer(CLAVE_DIAS, []); return Array.isArray(d) ? d : [] }

function pintarDibujo() {
  const img = $('qeDibujo')
  const urls = terminado() && buena ? urlsDelDibujo(buena) : foto ? [foto] : []
  if (urls.length && img.dataset.puesto !== urls[0]) {
    img.dataset.puesto = urls[0]
    // La siguiente silueta se carga antes de cambiarla: sin parpadeo.
    const antes = new Image()
    antes.onload = antes.onerror = () => {
      let i = 0
      img.onerror = () => { i++; if (i < urls.length) img.src = urls[i] }
      img.src = urls[0]
    }
    antes.src = urls[0]
  }
  $('qeEscena').classList.toggle('revelado', terminado())
  // 991: borroso en el primer intento y más claro con cada fallo.
  $('qeEscena').dataset.intento = String(Math.min(INTENTOS, fallos().length + 1))
  img.alt = terminado() ? nombre(buena) : 'La silueta del Pokémon del día'
}

function pintarOpciones() {
  $('qeOpciones').innerHTML = opciones.map((dex) => {
    const elegido = estado.elegidos.includes(dex)
    const clase = dex === buena && terminado() ? ' acierto' : elegido ? ' fallo' : ''
    return `<button type="button" class="qe-opcion${clase}" data-dex="${dex}"${elegido || terminado() ? ' disabled' : ''}>${escapeHtml(nombre(dex))}</button>`
  }).join('')
}

function pintarBote() {
  const b = $('qeBote')
  b.classList.toggle('hidden', terminado() || Boolean(libre))
  b.innerHTML = `${icons.zap(14)} ${sesion ? 'Ahora vale' : 'Con cuenta, ahora vale'} +${xpSiAciertasSilueta(fallos().length)} XP`
}

function pintarFinal() {
  const f = $('qeFinal')
  if (!terminado() || !buena) { f.classList.add('hidden'); return }
  const n = fallos().length + 1
  f.className = `qe-final rj-final${estado.acertada ? '' : ' fallado'}`
  f.innerHTML = `
    <p class="rj-final-titulo">${estado.acertada ? `¡Es ${escapeHtml(nombre(buena))}!` : `Era ${escapeHtml(nombre(buena))}`}</p>
    <p class="subtext" style="margin:0">${estado.acertada ? `Acertado ${n === 1 ? 'a la primera' : `en ${n} intentos`}` : 'Esta vez no'} · n.º ${buena} de la Pokédex · <a href="/mi-coleccion?ver=pokedex&amp;dex=${buena}">sus cartas</a><span id="qeGente"></span></p>
    <div id="qePremios"></div>
    ${salidasHtml({ juego: 'silueta', ruta: '/quien-es', dia: hoy, libre, compartirId: 'qeCompartir', cuentaId: 'qeCuenta' })}`
  f.classList.remove('hidden')
  $('qeCompartir')?.addEventListener('click', compartir)
  cuentaAtras($('qeCuenta'), 'Mañana, otro:')
  if (libre) return
  pintarPremios()
  estadisticas('silueta', dia).then((s) => { const c = $('qeGente'); if (c) c.textContent = genteHtml(s, 'lo ha reconocido') }).catch(() => {})
}

function pintarPremios() {
  const caja = $('qePremios')
  if (!caja) return
  caja.innerHTML = premiosHtml(guardado || (sesion ? null : { sinCuenta: true }), {
    posible: xpDe('silueta', { acertada: estado.acertada, intentos: fallos().length + 1 }),
    volver: '/quien-es',
    racha: rachaDeDias(diasAcertados(), dia),
    rachaTexto: 'acertando seguidos',
  })
}

function pintarTodo() {
  pintarDibujo()
  pintarOpciones()
  pintarBote()
  pintarFinal()
  $('qeSub').textContent = `${libre ? 'Partida libre' : `Reto #${numeroDelDia(dia)}`} · ${terminado() ? 'resuelto' : fallos().length ? `intento ${fallos().length + 1} de ${INTENTOS}: ahora se ve mejor` : `intento 1 de ${INTENTOS}: borroso, y cada fallo lo aclara`}`
}

async function elegir(dex) {
  if (terminado() || jugando || estado.elegidos.includes(dex)) return
  jugando = true
  let r
  try {
    r = await arbitro.jugar({ dex })
  } catch (e) {
    jugando = false
    showToast(e.message || 'No se ha podido comprobar. Inténtalo de nuevo.', 'error')
    return
  }
  jugando = false
  aplicar(r)
  if (estado.acertada) {
    const d = diasAcertados()
    if (!libre && !d.includes(dia)) escribir(CLAVE_DIAS, [...d, dia].slice(-400))
  }
  pintarTodo()
}

// La hoja de compartir (871): el texto y la imagen, con el dibujo del
// Pokémon TAPADO y sin su nombre (924): quien la ve no ha jugado todavía.
async function compartir() {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const texto = textoParaCompartir({ dia, fallos: fallos(), acertada: estado.acertada })
  await abrirHojaCompartir({ titulo: '¿Quién es ese Pokémon?', texto, imagen: imagenDelResultado, nombre: `quien-es-${numeroDelDia(dia)}` })
}

async function imagenDelResultado(formato) {
  const [{ pintarResultadoReto }, { fotoParaElLienzo }] = await Promise.all([import('./reto-imagen.js'), import('./imagen-compartir.js')])
  const foto = await fotoParaElLienzo(urlsDelDibujo(buena))
  const n = fallos().length
  return pintarResultadoReto(document.createElement('canvas'), {
    titulo: '¿Quién es ese Pokémon?',
    cuenta: `${estado.acertada ? n + 1 : 'X'}/${INTENTOS}`,
    numero: numeroDelDia(dia),
    lema: 'Adivina el Pokémon por su silueta, cada día',
    tira: [...Array.from({ length: n }, () => false), ...(estado.acertada ? [true] : [])],
    racha: rachaDeDias(diasAcertados(), dia),
    enlace: ENLACE,
    foto,
    fotoNombre: '',
    fotoProporcion: 1,
    tapada: 'silueta',
    formato,
  })
}

async function init() {
  try {
    const r = await traerRetoConFotos('quien-es', { libre, cadenasDe: (x) => (x.foto ? [[x.foto]] : []) })
    if (!r.dia || !r.foto || !Array.isArray(r.opciones)) throw new Error('sin reto')
    dia = r.dia
    opciones = r.opciones
    foto = r.foto
    arbitro = partida('silueta', { dia, libre })
    aplicar(await arbitro.abrir())
  } catch (err) {
    $('qeSub').textContent = err.sinArbitro ? err.message : 'Hoy no se ha podido traer el reto. Vuelve en un rato.'
    return
  }
  sesion = await getSession().catch(() => null)
  if (libre) $('qeSub').insertAdjacentHTML('afterend', avisoLibreHtml(hechoHoy(hoy)('silueta'), '/quien-es'))
  pintarTodo()
  $('qeOpciones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dex]')
    if (b) elegir(Number(b.dataset.dex))
  })
  if (sesion && terminado() && !libre && !guardado) {
    misNumeros(1).then((n) => { if (n?.hoy?.silueta) { guardado = { nuevo: false, xp: n.hoy.silueta.xp }; pintarPremios() } }).catch(() => {})
  }
}

init()
