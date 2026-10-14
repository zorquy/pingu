// «Ordena por precio» en pantalla (tanda 835). Lo puro vive en
// js/ordena-precio.js; las cuatro cartas, en netlify/functions/ordena-precio.mjs.
//
// Se tocan en orden (1, 2, 3, 4). Al comprobar, las que están en su sitio se
// quedan fijas en verde y el resto se vuelve a ordenar: tres intentos.
import { escapeHtml } from './html.js'
import { getSession } from './app.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { nombreDeCarta } from './catalogo-series.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { euros } from './cardmarket.js'
import { CARTAS, INTENTOS, numeroDelDia, ordenBueno, enSuSitio, textoParaCompartir } from './ordena-precio.js'
import { xpDe, xpSiAciertasOrdena } from './retos-xp.js'
import { guardarResultado, estadisticas, misNumeros, traerPartidaDeHoy } from './retos-datos.js'
import { premiosHtml, cuentaAtras, genteHtml } from './retos-ui.js'
import { rachaDeDias } from './reto-compartir.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pokedoc-ordena-precio'
const CLAVE_DIAS = 'pokedoc-ordena-precio-acertados'

let dia = null
let cartas = []
let porId = new Map()
let estado = { dia: null, intentos: [], acertada: false }
// Lo que llevas puesto en este intento: un id por posición, o null.
let puestos = Array(CARTAS).fill(null)
let sesion = null
let guardado = null

const leer = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? defecto } catch { return defecto } }
const escribir = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)) } catch {} }
const terminado = () => estado.acertada || estado.intentos.length >= INTENTOS
const diasAcertados = () => { const d = leer(CLAVE_DIAS, []); return Array.isArray(d) ? d : [] }

// Las posiciones que el último intento acertó: se quedan puestas.
function fijas() {
  const ultimo = estado.intentos.at(-1)
  if (!ultimo) return Array(CARTAS).fill(null)
  const bien = enSuSitio(ultimo, cartas)
  return ultimo.map((id, i) => (bien[i] ? id : null))
}

function empezarIntento() {
  puestos = fijas()
}

const fotoHtml = (c) => {
  const a = atributosDeEscaneo(cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null))
  return a ? `<img ${a} alt="" width="245" height="342" loading="lazy" />` : ''
}

function pintarCartas() {
  const fija = fijas()
  const lista = terminado() ? ordenBueno(cartas).map((id) => porId.get(id)) : cartas
  $('opCartas').innerHTML = lista.map((c) => {
    const pos = terminado() ? ordenBueno(cartas).indexOf(c.id) : puestos.indexOf(c.id)
    // Al acabar se enseñan en su orden bueno y con precio: verdes si las
    // ordenaste tú, sin marca si no (ese orden ya no es el tuyo).
    const esFija = terminado() ? estado.acertada : fija.includes(c.id)
    const clase = esFija ? ' fija' : ''
    return `<button type="button" class="op-carta${clase}" data-id="${escapeHtml(c.id)}"${terminado() || esFija ? ' disabled' : ''} aria-label="${escapeHtml(nombreDeCarta(c))}${pos >= 0 ? `, en el puesto ${pos + 1}` : ''}">
      <span class="op-foto">${fotoHtml(c)}</span>
      ${pos >= 0 ? `<span class="op-numero">${pos + 1}</span>` : ''}
      <span class="op-nombre">${escapeHtml(nombreDeCarta(c))}</span>
      ${terminado() ? `<span class="op-precio">${euros(c.precio)}</span>` : ''}
    </button>`
  }).join('')
  $('opComprobar').disabled = puestos.some((x) => !x)
}

function pintarIntentos() {
  $('opIntentos').innerHTML = estado.intentos.map((o, n) => {
    const bien = enSuSitio(o, cartas)
    return `<li class="op-intento"><b>${n + 1}.º</b><span class="op-intento-mini">${o.map((id, i) => `<span class="${bien[i] ? 'si' : ''}">${fotoHtml(porId.get(id) || {})}</span>`).join('')}</span><span>${bien.filter(Boolean).length} de ${CARTAS} en su sitio</span></li>`
  }).join('')
}

function pintarBote() {
  const b = $('opBote')
  b.classList.toggle('hidden', terminado())
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
    <div class="rj-botones">
      <button type="button" class="btn-primary" id="opCompartir">${icons.share(16)} Compartir</button>
      <span class="rj-cuenta" id="opCuenta"></span>
    </div>`
  f.classList.remove('hidden')
  $('opCompartir').addEventListener('click', compartir)
  cuentaAtras($('opCuenta'), 'Otras cuatro en')
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
  const pista = ultimo ? ` · ${enSuSitio(ultimo, cartas).filter(Boolean).length} de ${CARTAS} en su sitio; las verdes se quedan` : ' · toca de la más barata a la más cara'
  $('opSub').textContent = `Reto #${numeroDelDia(dia)} · ${terminado() ? 'resuelto' : `intento ${estado.intentos.length + 1} de ${INTENTOS}${pista}`}`
}

function tocar(id) {
  if (terminado() || fijas().includes(id)) return
  const ya = puestos.indexOf(id)
  if (ya >= 0) puestos[ya] = null
  else {
    const libre = puestos.indexOf(null)
    if (libre >= 0) puestos[libre] = id
  }
  pintarCartas()
}

async function guardar() {
  if (!terminado() || estado.guardado) return
  const r = await guardarResultado('ordena', dia, { aciertos: estado.acertada ? 1 : 0, total: 1, intentos: estado.intentos.length, acertada: estado.acertada }).catch(() => ({ error: true }))
  if (r && (r.nuevo === true || r.nuevo === false)) { estado.guardado = true; escribir(CLAVE, estado); guardado = r } else if (r?.sinCuenta) guardado = r
  pintarPremios()
}

function comprobar() {
  if (terminado() || puestos.some((x) => !x)) return
  estado.intentos.push([...puestos])
  if (enSuSitio(puestos, cartas).every(Boolean)) {
    estado.acertada = true
    const d = diasAcertados()
    if (!d.includes(dia)) escribir(CLAVE_DIAS, [...d, dia].slice(-400))
  }
  escribir(CLAVE, estado)
  empezarIntento()
  pintarTodo()
  if (terminado()) guardar()
}

async function compartir() {
  const texto = textoParaCompartir({ dia, intentos: estado.intentos, cartas, acertada: estado.acertada })
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return }
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

function sinTablero(texto) {
  document.querySelector('.op-tablero')?.classList.add('hidden')
  $('opBote').classList.add('hidden')
  $('opSub').insertAdjacentHTML('afterend', `<p class="empty-state">${texto}<br><a class="btn-primary" href="/retos">Ver los otros retos</a></p>`)
  $('opSub').classList.add('hidden')
}

async function init() {
  let r
  try {
    const res = await fetch('/.netlify/functions/ordena-precio', { headers: { accept: 'application/json' } })
    r = await res.json()
    if (!res.ok || r.error) throw new Error(r.error || `HTTP ${res.status}`)
  } catch {
    sinTablero('Hoy no se han podido traer las cartas. Vuelve en un rato.')
    return
  }
  dia = r.dia
  cartas = (r.cartas || []).slice(0, CARTAS)
  if (cartas.length < CARTAS) { sinTablero('Hoy no hay cartas suficientes con precio. Vuelve mañana.'); return }
  porId = new Map(cartas.map((c) => [c.id, c]))
  // Si hoy ya lo jugaste en otro aparato, la partida baja de la base (841).
  await traerPartidaDeHoy('ordena', dia).catch(() => false)
  const g = leer(CLAVE, null)
  estado = g && g.dia === dia && Array.isArray(g.intentos) ? g : { dia, intentos: [], acertada: false }
  sesion = await getSession().catch(() => null)
  empezarIntento()
  pintarTodo()
  $('opCartas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]')
    if (b && !b.disabled) tocar(b.dataset.id)
  })
  $('opComprobar').addEventListener('click', comprobar)
  $('opLimpiar').addEventListener('click', () => { empezarIntento(); pintarCartas() })
  if (sesion && terminado()) {
    if (!estado.guardado) guardar()
    else misNumeros(1).then((n) => { if (n?.hoy?.ordena) { guardado = { nuevo: false, xp: n.hoy.ordena.xp }; pintarPremios() } }).catch(() => {})
  }
}

init()
