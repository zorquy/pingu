// «¿De qué expansión es?» en pantalla (tanda 835). Lo puro vive en
// js/que-expansion.js; las cinco rondas, en netlify/functions/que-expansion.mjs.
import { escapeHtml } from './html.js'
import { getSession } from './app.js'
import { icons } from './icons.js'
import { nombreDeCarta, nombreDeSet, logosDePago } from './catalogo-series.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { urlDeLogo } from './carta-ruta.js'
import { RONDAS, numeroDelDia, textoParaCompartir, ENLACE } from './que-expansion.js'
import { xpDe, mejorQue } from './retos-xp.js'
import { guardarResultado, estadisticas, misNumeros, traerPartidaDeHoy } from './retos-datos.js'
import { premiosHtml, cuentaAtras } from './retos-ui.js'
import { siguienteReto, hechoHoy, siguienteRetoHtml } from './retos-siguiente.js'
import { rachaDeDias } from './reto-compartir.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pokedoc-que-expansion'
const CLAVE_DIAS = 'pokedoc-que-expansion-jugados'

let dia = null
let rondas = []
// La expansión que elegiste en cada ronda (su id).
let estado = { dia: null, elegidas: [] }
let sesion = null
let guardado = null
let pasando = false

const leer = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? defecto } catch { return defecto } }
const escribir = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)) } catch {} }
const ronda = () => estado.elegidas.length
const terminado = () => ronda() >= RONDAS
const tira = () => estado.elegidas.map((id, i) => id === rondas[i]?.carta?.set_id)
const diasJugados = () => { const d = leer(CLAVE_DIAS, []); return Array.isArray(d) ? d : [] }

const fotoHtml = (c) => {
  const a = atributosDeEscaneo(cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null, 'high'))
  return a ? `<img ${a} alt="Carta de la ronda" width="245" height="342" loading="eager" />` : ''
}

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
  $('qxCarta').innerHTML = fotoHtml(r.carta)
  const elegida = estado.elegidas[i]
  $('qxOpciones').innerHTML = r.opciones.map((s) => {
    const clase = elegida ? (s.id === r.carta.set_id ? ' acierto' : s.id === elegida ? ' fallo' : '') : ''
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
    <p class="subtext" style="margin:0" id="qxGente">Reto #${numeroDelDia(dia)}</p>
    <ol class="qx-repaso">${rondas.map((r, i) => `<li class="${t[i] ? 'si' : ''}"><span class="qx-mini">${fotoHtml(r.carta)}</span><span>${t[i] ? icons.checkCircle(14) : icons.xCircle(14)} ${escapeHtml(nombreDeSet(r.carta.tcg_sets) || r.carta.set_id)}</span></li>`).join('')}</ol>
    <div id="qxPremios"></div>
    <div class="rj-botones">
      <button type="button" class="btn-secondary" id="qxCompartir">${icons.share(16)} Compartir</button>
      <span class="rj-cuenta" id="qxCuenta"></span>
    </div>
    <div class="rj-adonde">${siguienteRetoHtml(siguienteReto('expansion', hechoHoy(dia)), { dia })}</div>`
  f.classList.remove('hidden')
  $('qxCompartir').addEventListener('click', compartir)
  cuentaAtras($('qxCuenta'), 'Cinco más en')
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
  $('qxSub').textContent = `Reto #${numeroDelDia(dia)} · ${terminado() ? 'resuelto' : `carta ${ronda() + 1} de ${RONDAS}`}`
}

async function guardar() {
  if (!terminado() || estado.guardado) return
  const r = await guardarResultado('expansion', dia, { aciertos: tira().filter(Boolean).length, total: RONDAS, tira: tira() }).catch(() => ({ error: true }))
  if (r && (r.nuevo === true || r.nuevo === false)) { estado.guardado = true; escribir(CLAVE, estado); guardado = r } else if (r?.sinCuenta) guardado = r
  pintarPremios()
}

function elegir(setId) {
  if (terminado() || pasando) return
  const i = ronda()
  estado.elegidas.push(setId)
  // Los aciertos, también en lo guardado: el menú de /retos los lee sin
  // tener las rondas.
  estado.tira = tira()
  escribir(CLAVE, estado)
  if (terminado()) {
    const d = diasJugados()
    if (!d.includes(dia)) escribir(CLAVE_DIAS, [...d, dia].slice(-400))
  }
  const bien = setId === rondas[i].carta.set_id
  pintarRonda(i)
  pintarPasos()
  const v = $('qxVeredicto')
  v.className = `qx-veredicto${bien ? '' : ' mal'}`
  v.innerHTML = bien ? `${icons.checkCircle(22)} ¡Bien!${sesion ? ' +4 XP' : ''}` : `${icons.xCircle(22)} Era ${escapeHtml(nombreDeSet(rondas[i].carta.tcg_sets) || rondas[i].carta.set_id)}`
  pasando = true
  setTimeout(() => {
    pasando = false
    v.classList.add('hidden')
    pintarTodo()
    if (terminado()) guardar()
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
    detalle: `Reto #${numeroDelDia(dia)}`,
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

async function init() {
  let r
  try {
    const res = await fetch('/.netlify/functions/que-expansion', { headers: { accept: 'application/json' } })
    r = await res.json()
    if (!res.ok || r.error) throw new Error(r.error || `HTTP ${res.status}`)
  } catch {
    sinTablero('Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  dia = r.dia
  rondas = (r.rondas || []).slice(0, RONDAS)
  if (rondas.length < RONDAS) { sinTablero('Hoy no hay cartas para este reto. Vuelve mañana.'); return }
  // Si hoy ya lo jugaste en otro aparato, la partida baja de la base (841).
  await traerPartidaDeHoy('expansion', dia).catch(() => false)
  const g = leer(CLAVE, null)
  estado = g && g.dia === dia && Array.isArray(g.elegidas) ? g : { dia, elegidas: [] }
  sesion = await getSession().catch(() => null)
  pintarTodo()
  $('qxOpciones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]')
    if (b && !b.disabled) elegir(b.dataset.set)
  })
  if (sesion && terminado()) {
    if (!estado.guardado) guardar()
    else misNumeros(1).then((n) => { if (n?.hoy?.expansion) { guardado = { nuevo: false, xp: n.hoy.expansion.xp }; pintarPremios() } }).catch(() => {})
  }
}

init()
