// «¿Quién es ese Pokémon?» en pantalla (tanda 835). Lo puro —el Pokémon del
// día, las opciones y el texto— vive en js/quien-es.js; la XP, en
// js/retos-xp.js y en la base.
import { escapeHtml } from './html.js'
import { getSession } from './app.js'
import { icons } from './icons.js'
import { POKEMON_POR_DEX } from './torneos/sprites-pokemon.js'
import { hoyISO } from './reto-diario.js'
import { INTENTOS, numeroDelDia, pokemonDelDia, opcionesDelDia, urlsDelDibujo, textoParaCompartir, ENLACE } from './quien-es.js'
import { xpDe, xpSiAciertasSilueta } from './retos-xp.js'
import { guardarResultado, estadisticas, misNumeros, traerPartidaDeHoy } from './retos-datos.js'
import { premiosHtml, cuentaAtras, genteHtml } from './retos-ui.js'
import { siguienteReto, hechoHoy, siguienteRetoHtml } from './retos-siguiente.js'
import { rachaDeDias } from './reto-compartir.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pokedoc-quien-es'
const CLAVE_DIAS = 'pokedoc-quien-es-acertados'

const dia = hoyISO()
const buena = pokemonDelDia(dia)
const opciones = opcionesDelDia(dia)
const nombre = (dex) => POKEMON_POR_DEX[dex - 1] || `#${dex}`
let estado = { dia, elegidos: [], acertada: false }
let sesion = null
let guardado = null

const leer = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? defecto } catch { return defecto } }
const escribir = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)) } catch {} }

function cargarEstado() {
  const g = leer(CLAVE, null)
  if (g && g.dia === dia && Array.isArray(g.elegidos)) estado = g
}
const fallos = () => estado.elegidos.filter((d) => d !== buena)
const terminado = () => estado.acertada || fallos().length >= INTENTOS
const diasAcertados = () => { const d = leer(CLAVE_DIAS, []); return Array.isArray(d) ? d : [] }

function pintarDibujo() {
  const img = $('qeDibujo')
  if (!img.dataset.puesto) {
    img.dataset.puesto = '1'
    const urls = urlsDelDibujo(buena)
    let i = 0
    img.onerror = () => { i++; if (i < urls.length) img.src = urls[i] }
    img.src = urls[0]
  }
  $('qeEscena').classList.toggle('revelado', terminado())
  img.alt = terminado() ? nombre(buena) : 'La silueta del Pokémon del día'
}

function pintarOpciones() {
  $('qeOpciones').innerHTML = opciones.map((dex) => {
    const elegido = estado.elegidos.includes(dex)
    const clase = dex === buena && (estado.acertada || terminado()) ? ' acierto' : elegido ? ' fallo' : ''
    return `<button type="button" class="qe-opcion${clase}" data-dex="${dex}"${elegido || terminado() ? ' disabled' : ''}>${escapeHtml(nombre(dex))}</button>`
  }).join('')
}

function pintarBote() {
  const b = $('qeBote')
  b.classList.toggle('hidden', terminado())
  b.innerHTML = `${icons.zap(14)} ${sesion ? 'Ahora vale' : 'Con cuenta, ahora vale'} +${xpSiAciertasSilueta(fallos().length)} XP`
}

function pintarFinal() {
  const f = $('qeFinal')
  if (!terminado()) { f.classList.add('hidden'); return }
  const n = fallos().length + 1
  f.className = `qe-final rj-final${estado.acertada ? '' : ' fallado'}`
  f.innerHTML = `
    <p class="rj-final-titulo">${estado.acertada ? `¡Es ${escapeHtml(nombre(buena))}!` : `Era ${escapeHtml(nombre(buena))}`}</p>
    <p class="subtext" style="margin:0">${estado.acertada ? `Acertado ${n === 1 ? 'a la primera' : `en ${n} intentos`}` : 'Esta vez no'} · n.º ${buena} de la Pokédex<span id="qeGente"></span></p>
    <div id="qePremios"></div>
    <div class="rj-botones">
      <button type="button" class="btn-secondary" id="qeCompartir">${icons.share(16)} Compartir</button>
      <a class="btn-secondary" href="/mi-coleccion?ver=pokedex&amp;dex=${buena}">Sus cartas</a>
      <span class="rj-cuenta" id="qeCuenta"></span>
    </div>
    <div class="rj-adonde">${siguienteRetoHtml(siguienteReto('silueta', hechoHoy(dia)), { dia })}</div>`
  f.classList.remove('hidden')
  $('qeCompartir').addEventListener('click', compartir)
  cuentaAtras($('qeCuenta'), 'El siguiente en')
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
  $('qeSub').textContent = `Reto #${numeroDelDia(dia)} · ${terminado() ? 'resuelto' : `intento ${fallos().length + 1} de ${INTENTOS}`}`
}

async function guardar() {
  if (!terminado() || estado.guardado) return
  const r = await guardarResultado('silueta', dia, { aciertos: estado.acertada ? 1 : 0, total: 1, intentos: fallos().length + (estado.acertada ? 1 : 0), acertada: estado.acertada }).catch(() => ({ error: true }))
  if (r && (r.nuevo === true || r.nuevo === false)) { estado.guardado = true; escribir(CLAVE, estado); guardado = r } else if (r?.sinCuenta) guardado = r
  pintarPremios()
}

function elegir(dex) {
  if (terminado() || estado.elegidos.includes(dex)) return
  estado.elegidos.push(dex)
  if (dex === buena) {
    estado.acertada = true
    const d = diasAcertados()
    if (!d.includes(dia)) escribir(CLAVE_DIAS, [...d, dia].slice(-400))
  }
  escribir(CLAVE, estado)
  pintarTodo()
  if (terminado()) guardar()
}

// La hoja de compartir (871): el texto y, desde aquí, también la imagen,
// con el dibujo del Pokémon ya destapado (no desvela nada: se comparte al
// acabar).
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
    detalle: `Reto #${numeroDelDia(dia)} · ${nombre(buena)}`,
    tira: [...Array.from({ length: n }, () => false), ...(estado.acertada ? [true] : [])],
    racha: rachaDeDias(diasAcertados(), dia),
    enlace: ENLACE,
    foto,
    fotoNombre: '',
    fotoProporcion: 1,
    formato,
  })
}

async function init() {
  // Si hoy ya lo jugaste en otro aparato, la partida baja de la base (841).
  await traerPartidaDeHoy('silueta', dia).catch(() => false)
  cargarEstado()
  sesion = await getSession().catch(() => null)
  pintarTodo()
  $('qeOpciones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dex]')
    if (b) elegir(Number(b.dataset.dex))
  })
  if (sesion && terminado()) {
    if (!estado.guardado) guardar()
    else misNumeros(1).then((n) => { if (n?.hoy?.silueta) { guardado = { nuevo: false, xp: n.hoy.silueta.xp }; pintarPremios() } }).catch(() => {})
  }
}

init()
