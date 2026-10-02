// /repeticiones (tanda 462): pegas el registro de una partida de JCC
// Pokémon Live y se reproduce sola, jugada a jugada.
//
// PINGU: «un apartado para ver repeticiones, que te peguen el log de una
// partida de Pokémon TCG Live en español y que se reproduzca sola la
// partida». Tres piezas, cada una en su fichero:
//   · repeticiones/registro.js lee el texto y saca EVENTOS;
//   · repeticiones/estado.js los aplica y saca una FOTO de la mesa por
//     evento (así ir hacia atrás es mirar la foto de antes, no deshacer);
//   · y esto, que pinta la foto que toca y la va pasando.
//
// La mesa es la del laboratorio (css/laboratorio.css, las clases `lab-`):
// mismo tapete, mismas cartas, mismo pie con la vida. Una partida que se
// juega allí y una que se mira aquí tienen que verse igual.
//
// Lo que el registro no dice no se inventa: la mano del rival es una
// cuenta, y los PS de una carta salen de la impresión que mejor case con
// su nombre (el registro no dice cuál era). Por eso la vida se pinta solo
// cuando se sabe, y el daño —que sí viene en el registro— siempre.
import { escapeHtml } from './html.js'
import { cardImageUrl } from './tcgdex.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { resolverLineas, cargarSets } from './constructor/datos.js'
import { imagenDeEnergiaBasica, esEnergiaBasica, letraDeEnergia, plano } from './constructor/nucleo.js'
import { leerRegistro } from './repeticiones/registro.js'
import { fotos as sacarFotos, indiceDeTurnos, arriba } from './repeticiones/estado.js'
import { ICONOS_REPETICION as ICONO } from './repeticiones/iconos.js'
import { icons } from './icons.js'

const $ = (id) => document.getElementById(id)
const menosMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const R = {
  lectura: null,
  fotos: [],
  turnos: [],
  i: 0,
  jugando: false,
  velocidad: 1,
  temporizador: null,
  // De qué lado se mira: el jugador que va ABAJO.
  abajo: null,
  // Nombre de carta (plano) → la fila del catálogo que mejor le casa.
  cartas: new Map(),
  pedidas: new Set(),
  codigoDeSet: () => null,
  // Cada lectura nueva sube el número: lo que llegue tarde de la anterior
  // (las imágenes que se resuelven por detrás) no pinta encima.
  vez: 0,
  cacheHtml: new WeakMap(),
}

// ════════════════════════════════════════════════════════════════════
// Las cartas: del nombre del registro a su imagen
// ════════════════════════════════════════════════════════════════════

const cartaDe = (nombre) => R.cartas.get(plano(nombre)) || null
const psDe = (nombre) => Number(cartaDe(nombre)?.hp) || null

function imagenHtml(nombre, calidad = 'low') {
  const c = cartaDe(nombre)
  let cadena = []
  // La energía básica tiene dibujo aunque el catálogo no haya contestado
  // todavía: se sabe cuál es por el nombre.
  const basica = c ? esEnergiaBasica(c) && !c.image_path : esEnergiaBasica({ name: nombre })
  if (basica) {
    const e = imagenDeEnergiaBasica(c || { name: nombre }, calidad === 'high' ? 'LG' : 'SM')
    if (e) cadena = [e.url, e.respaldo].filter(Boolean)
  } else if (c) {
    cadena = cadenaDeEscaneo(c, R.codigoDeSet(c.set_id), calidad, cardImageUrl)
  }
  const attrs = atributosDeEscaneo(cadena)
  // El nombre va DEBAJO de la imagen: si no carga ninguna, se queda el
  // nombre (tanda 321: un respaldo nunca termina en «nada»).
  return `<span class="lab-sin-imagen">${escapeHtml(nombre)}</span>${attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" />` : ''}`
}

// Los nombres de todas las cartas que salen en la partida, en el orden
// en que aparecen: las del principio se resuelven primero.
function nombresDe(lectura) {
  const vistos = new Map()
  const pon = (n) => {
    if (n && n !== '?' && !vistos.has(plano(n))) vistos.set(plano(n), n)
  }
  for (const e of lectura.eventos) {
    for (const campo of ['carta', 'a', 'de', 'pokemon', 'objetivo', 'sube', 'baja']) pon(e[campo])
    for (const c of e.cartas || []) pon(c)
  }
  return [...vistos.values()]
}

// De seis en seis (lo mismo que hace el constructor con una lista sin
// códigos), repintando tras cada tanda: la mesa se va llenando de dibujos
// mientras se juega, en vez de esperar a la última carta.
async function resolverCartas(nombres, vez) {
  try {
    const { codigoDeId } = await cargarSets()
    R.codigoDeSet = (id) => codigoDeId.get(id) || null
  } catch {
    /* sin códigos se pinta igual: la cadena de escaneo tiene más sitios */
  }
  const pendientes = nombres.filter((n) => !R.cartas.has(plano(n)) && !R.pedidas.has(plano(n)))
  for (let k = 0; k < pendientes.length; k += 6) {
    const tanda = pendientes.slice(k, k + 6)
    tanda.forEach((n) => R.pedidas.add(plano(n)))
    try {
      const { resueltas } = await resolverLineas(tanda.map((nombre) => ({ n: 1, nombre })))
      for (const r of resueltas) R.cartas.set(plano(r.linea.nombre), r.carta)
    } catch {
      /* esa tanda se queda con el nombre: la mesa se entiende igual */
    }
    if (vez !== R.vez) return
    // Con los PS a mano cambian las fotos (un KO que el registro no
    // escribe se deduce de la vida): se rehacen, que es barato.
    R.fotos = sacarFotos(R.lectura, { psDe })
    R.cacheHtml = new WeakMap()
    pintar()
  }
}

// ════════════════════════════════════════════════════════════════════
// La mesa
// ════════════════════════════════════════════════════════════════════

const foto = () => R.fotos[R.i]
// El color de cada jugador sigue a la PERSONA, no al sitio: al girar la
// mesa, Rojo sigue siendo azul.
const colorDe = (nombre) => (nombre === R.fotos[0]?.protagonista ? 0 : 1)
const chapaJugador = (nombre, mini = false) => `<span class="lab-jugador${mini ? ' lab-jugador-mini' : ''}" data-j="${colorDe(nombre)}">${escapeHtml(nombre)}</span>`
const elOtro = (nombre) => R.fotos[0].orden.find((n) => n !== nombre)

function poner(el, html) {
  if (!el || R.cacheHtml.get(el) === html) return
  R.cacheHtml.set(el, html)
  el.innerHTML = html
}

const vidaHtml = (pct, titulo) => `<div class="lab-ps" data-vida="${pct <= 25 ? 'baja' : pct <= 50 ? 'media' : 'alta'}" title="${titulo}"><span style="--pct: ${pct}%"></span></div>`

// La energía unida, como en el laboratorio: un punto con la letra de su
// tipo. De una especial no se sabe qué da, así que va como incolora y con
// el borde a rayas; su nombre, en el `title`.
function energiaHtml(nombre) {
  const basica = esEnergiaBasica(cartaDe(nombre) || { name: nombre })
  const letra = letraDeEnergia(nombre) || 'C'
  return `<span class="lab-energia${basica ? '' : ' lab-energia-especial'}" data-tipo="${letra}" title="${escapeHtml(nombre)}">${letra}</span>`
}

// Lo que la jugada de ahora ilumina en este Pokémon.
function focoEn(slot) {
  const f = foto().foco
  if (!f) return { clase: '', extra: '' }
  if (f.tipo === 'ataque' && f.objetivo === slot.id && f.danio) return { clase: ' rep-golpe', extra: `<span class="rep-golpe-num" aria-hidden="true">−${f.danio}</span>` }
  if (f.tipo === 'danio' && f.slot === slot.id) return { clase: ' rep-golpe', extra: `<span class="rep-golpe-num" aria-hidden="true">−${f.danio}</span>` }
  if (f.slot === slot.id || f.slots?.includes(slot.id)) return { clase: ' rep-foco', extra: '' }
  return { clase: '', extra: '' }
}

function slotHtml(slot, { activo = false, dueno }) {
  const nombre = arriba(slot)
  const ps = psDe(nombre)
  const vida = ps ? Math.max(0, ps - slot.danio) : null
  const pct = ps ? Math.round((vida / ps) * 100) : null
  const { clase, extra } = focoEn(slot)
  const energias = slot.energias.map(energiaHtml).join('')
  const herramienta = slot.herramienta ? `<span class="lab-chapa lab-chapa-herramienta" title="${escapeHtml(slot.herramienta)}">${escapeHtml(slot.herramienta)}</span>` : ''
  const evo = slot.cartas.length > 1 ? `<span class="lab-chapa" title="${escapeHtml(slot.cartas.join(' → '))}">evol. ${slot.cartas.length - 1}</span>` : ''
  const etiqueta = `${escapeHtml(nombre)} de ${escapeHtml(dueno)}${activo ? ', activo' : ''}: ${ps ? `${vida} de ${ps} PS` : `${slot.danio} de daño`}${slot.energias.length ? `, ${slot.energias.length} ${slot.energias.length === 1 ? 'energía' : 'energías'}` : ''}. Ver sus cartas`
  const vidaBloque = ps ? `${vidaHtml(pct, `${vida} / ${ps} PS`)}<p class="lab-ps-texto">${vida}/${ps}</p>` : slot.danio ? `<p class="lab-ps-texto rep-solo-danio">${slot.danio} de daño</p>` : ''
  return `
    <div class="lab-slot${activo ? ' lab-slot-activo' : ''}${ps && slot.danio >= ps ? ' lab-slot-caido' : ''}${clase}" data-slot="${slot.id}">
      <button type="button" class="lab-carta lab-slot-carta" data-ver-slot="${slot.id}" aria-label="${etiqueta}">${imagenHtml(nombre)}${slot.danio ? `<span class="lab-danio" aria-hidden="true">${slot.danio}</span>` : ''}${extra}</button>
      <div class="lab-slot-pie">
        ${vidaBloque}
        ${energias ? `<div class="lab-energias">${energias}</div>` : ''}
        ${herramienta || evo ? `<div class="lab-chapas">${herramienta}${evo}</div>` : ''}
      </div>
    </div>`
}

const dorso = () => '<span class="lab-dorso" aria-hidden="true"></span>'

function premiosHtml(p, nombre) {
  const s = foto()
  const f = s.foco
  if (!s.turno) return `<div class="lab-premios" aria-hidden="true">${'<span class="lab-hueco lab-hueco-premio"></span>'.repeat(6)}</div>`
  const brilla = f?.tipo === 'premio' && f.jugador === nombre ? ' rep-foco-zona' : ''
  const n = p.premios
  return `<div class="lab-premios${brilla}" role="img" aria-label="${n} ${n === 1 ? 'premio' : 'premios'} por coger">${Array.from({ length: n }, () => `<span class="lab-carta lab-carta-dorso">${dorso()}</span>`).join('')}</div><p class="lab-cuenta-mini">${n} ${n === 1 ? 'premio' : 'premios'}</p>`
}

function pilasHtml(p, nombre, { abajo }) {
  const f = foto().foco
  const roba = f?.jugador === nombre && (f.tipo === 'robar' || f.tipo === 'alMazo' || f.tipo === 'barajar')
  const descarta = f?.jugador === nombre && (f.tipo === 'descarta' || f.tipo === 'ko')
  const ultima = p.descarte.at(-1)
  const mano = abajo
    ? ''
    : `<div class="lab-pila lab-pila-mano${f?.jugador === nombre && f.tipo === 'robar' ? ' rep-foco-zona' : ''}" role="img" aria-label="${p.mano} ${p.mano === 1 ? 'carta' : 'cartas'} en la mano"><span class="lab-abanico" aria-hidden="true">${Array.from({ length: Math.min(p.mano, 5) }, dorso).join('')}</span><span class="lab-pila-texto"><strong>${p.mano}</strong> en la mano</span></div>`
  return `
    <div class="lab-pila${roba ? ' rep-foco-zona' : ''}" data-pila="mazo" role="img" aria-label="Mazo de ${escapeHtml(nombre)}: ${p.mazo} cartas">${dorso()}<span class="lab-pila-texto"><strong>${p.mazo}</strong> en el mazo</span></div>
    <button type="button" class="lab-pila${descarta ? ' rep-foco-zona' : ''}" data-ver-descarte="${escapeHtml(nombre)}" aria-label="Descarte de ${escapeHtml(nombre)}: ${p.descarte.length} cartas. Verlas">${ultima ? `<span class="lab-pila-cara">${imagenHtml(ultima)}</span>` : '<span class="lab-pila-vacia" aria-hidden="true"></span>'}<span class="lab-pila-texto"><strong>${p.descarte.length}</strong> en el descarte</span></button>
    ${mano}`
}

function ladoHtml(nombre, { abajo }) {
  const s = foto()
  const p = s.jugadores[nombre]
  const turno = s.deQuien === nombre && !s.fin ? '<span class="lab-lado-turno">Su turno</span>' : ''
  const gana = s.fin?.ganador === nombre ? '<span class="lab-lado-turno">Gana</span>' : ''
  const huecos = Math.max(0, 5 - p.banca.length)
  const activo = p.activo ? slotHtml(p.activo, { activo: true, dueno: nombre }) : `<div class="lab-hueco lab-hueco-activo"><p>${s.turno ? 'Sin activo' : 'Aún no ha salido nadie'}</p></div>`
  const banca = p.banca.map((x) => slotHtml(x, { dueno: nombre })).join('') + '<div class="lab-hueco" aria-hidden="true"></div>'.repeat(huecos)
  return `
    <div class="lab-lado-cab">${chapaJugador(nombre)}${turno}${gana}</div>
    <div class="lab-zona lab-zona-premios">${premiosHtml(p, nombre)}</div>
    <div class="lab-zona lab-zona-activo">${activo}</div>
    <div class="lab-zona lab-zona-banca">${banca}</div>
    <div class="lab-zona lab-zona-pilas">${pilasHtml(p, nombre, { abajo })}</div>`
}

// La mano del jugador de abajo. Del protagonista del registro se conocen
// casi todas (las roba con nombre); del otro, solo las que enseña. Lo que
// no se conoce va boca abajo: el número es exacto, las caras no.
function manoHtml(nombre) {
  const s = foto()
  const p = s.jugadores[nombre]
  const f = s.foco
  const conocidas = p.manoConocida.slice(0, p.mano)
  const tapadas = Math.max(0, p.mano - conocidas.length)
  const nuevas = f?.tipo === 'robar' && f.jugador === nombre ? (f.cartas?.length || 0) : 0
  const caras = conocidas
    .map((c, k) => `<button type="button" class="lab-carta rep-mano-carta${k >= conocidas.length - nuevas ? ' lab-nueva' : ''}" data-ver-mano="${k}" aria-label="${escapeHtml(c)}${k >= conocidas.length - nuevas ? ' (nueva)' : ''}">${imagenHtml(c)}</button>`)
    .join('')
  const dorsos = Array.from({ length: tapadas }, () => `<span class="lab-carta lab-carta-dorso rep-mano-carta">${dorso()}</span>`).join('')
  return `
    <p class="lab-rotulo rep-mano-rotulo">Mano de ${chapaJugador(nombre, true)} <strong>${p.mano}</strong>${tapadas && conocidas.length ? ` <span class="rep-mano-nota">(${tapadas} sin ver)</span>` : ''}</p>
    <div class="rep-mano" role="group" aria-label="Cartas en la mano">${caras || dorsos ? `${caras}${dorsos}` : '<p class="lab-vacio">Sin cartas</p>'}</div>`
}

// La jugada de ahora, en grande, en el centro del tapete: la carta que se
// juega, el ataque y su daño, la moneda, el KO…
function focoHtml(s) {
  const f = s.foco
  if (!f) return ''
  const carta = (nombre, extra = '') => `<span class="lab-carta rep-foco-carta${extra}" aria-hidden="true">${imagenHtml(nombre)}</span>`
  const quien = f.jugador ? chapaJugador(f.jugador, true) : ''
  switch (f.tipo) {
    case 'jugar':
      return `${carta(f.carta)}<p class="rep-foco-texto">${quien}${f.estadio ? 'pone el estadio' : 'juega'}</p>`
    case 'habilidad': {
      const slot = [...(s.jugadores[f.jugador]?.banca || []), s.jugadores[f.jugador]?.activo].find((x) => x?.id === f.slot)
      return `${carta(slot ? arriba(slot) : f.carta)}<p class="rep-foco-texto">${f.que ? escapeHtml(f.que) : 'Habilidad'}</p>`
    }
    case 'ataque':
      return `<p class="rep-foco-ataque"><span class="rep-foco-que">${escapeHtml(f.que || 'Ataque')}</span>${f.danio ? `<strong class="rep-foco-danio">${f.danio}</strong>` : ''}</p>`
    case 'ko':
      return `${carta(f.carta, ' rep-foco-ko')}<p class="rep-foco-texto rep-foco-alerta">Fuera de combate</p>`
    case 'moneda':
      return `<span class="rep-moneda" data-cara="${f.cara ? 'si' : 'no'}" aria-hidden="true">${f.cara ? 'C' : 'X'}</span><p class="rep-foco-texto">${f.cara ? 'Cara' : 'Cruz'}</p>`
    case 'premio':
      return `<p class="rep-foco-ataque"><span class="rep-foco-que">${quien}coge</span><strong class="rep-foco-danio">${f.n}</strong></p><p class="rep-foco-texto">${f.n === 1 ? 'premio' : 'premios'}</p>`
    case 'fin':
      return `<span class="rep-copa" aria-hidden="true">${icons.trophy(28)}</span><p class="rep-foco-texto">Gana ${quien}</p>`
    default:
      return ''
  }
}

// La línea del registro, con los nombres de los jugadores en su color.
// Se busca sobre el texto CRUDO y se escapa lo de entre medias: buscar
// sobre el HTML ya montado casaba un nombre como «jugador» dentro de la
// clase `lab-jugador` de la chapa anterior.
function lineaHtml(s) {
  const t = s.linea || ''
  if (!t) return s.turno ? '' : 'La partida está a punto de empezar.'
  const nombres = [...s.orden].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])(${nombres.join('|')})(?![\\p{L}\\p{N}_])`, 'gu')
  let out = ''
  let desde = 0
  for (const m of t.matchAll(re)) {
    const ini = m.index + m[1].length
    out += escapeHtml(t.slice(desde, ini)) + chapaJugador(m[2], true)
    desde = ini + m[2].length
  }
  return out + escapeHtml(t.slice(desde))
}

function centroHtml(s) {
  const estadio = s.estadio
    ? `<button type="button" class="lab-carta" data-ver-estadio aria-label="Estadio: ${escapeHtml(s.estadio.carta)}. Verlo">${imagenHtml(s.estadio.carta)}</button>`
    : '<span class="lab-hueco lab-hueco-estadio" aria-hidden="true"></span>'
  const turno = s.turno ? `Turno ${s.turno} · ${chapaJugador(s.deQuien, true)}` : 'Preparación'
  const foco = focoHtml(s)
  return `
    <div class="lab-estadio"><p class="lab-rotulo">Estadio</p>${estadio}</div>
    <div class="lab-centro-medio">
      <p class="rep-turno">${turno}</p>
      <p class="rep-linea">${lineaHtml(s)}</p>
    </div>
    <div class="lab-centro-botones rep-destacado" data-tipo="${s.foco?.tipo || ''}">${foco}</div>`
}

function pintar() {
  const s = foto()
  if (!s) return
  const abajo = R.abajo
  const arribaJ = elOtro(abajo)
  const ladoA = $('repLadoArriba')
  const ladoB = $('repLadoAbajo')
  ladoA.setAttribute('aria-label', `Lado de ${arribaJ}`)
  ladoB.setAttribute('aria-label', `Lado de ${abajo}`)
  poner(ladoA, ladoHtml(arribaJ, { abajo: false }))
  poner($('repCentro'), centroHtml(s))
  poner(ladoB, ladoHtml(abajo, { abajo: true }))
  poner($('repMano'), manoHtml(abajo))
  pintarControles()
  marcarLinea()
}

// El cambio de turno, un momento en el centro del tapete (el mismo cartel
// que el laboratorio). Se quita con un temporizador y no al acabar la
// animación: con «menos movimiento» la animación no corre y `animationend`
// no llegaría nunca (CLAUDE.md, tanda 313).
function cartelDeTurno(nombre) {
  document.querySelectorAll('.rep-tapete .lab-cambio').forEach((x) => x.remove())
  const el = document.createElement('p')
  el.className = 'lab-cambio'
  el.dataset.j = String(colorDe(nombre))
  el.setAttribute('aria-hidden', 'true')
  el.textContent = `Turno de ${nombre}`
  $('repTapete').append(el)
  setTimeout(() => el.remove(), Math.max(600, 1200 / R.velocidad))
}

// ════════════════════════════════════════════════════════════════════
// El reproductor
// ════════════════════════════════════════════════════════════════════

// Cuánto se queda cada jugada en pantalla (a velocidad 1): lo que cambia
// la partida, más; lo que es contar cartas, menos.
const ESPERA = { turno: 1400, ataque: 1800, ko: 1800, jugar: 1200, habilidad: 1100, moneda: 1300, premio: 1300, entra: 850, sube: 900, evoluciona: 1000, unir: 800, retirar: 900, robar: 650, descarta: 700, danio: 1000 }
const esperaDe = (s) => (s.foco ? ESPERA[s.foco.tipo] || 700 : 600)

function ir(i, { anunciar = true } = {}) {
  const antes = R.i
  R.i = Math.max(0, Math.min(R.fotos.length - 1, i))
  const s = foto()
  pintar()
  // El cartel solo al AVANZAR una jugada: saltar a un turno con el
  // deslizador no es «empieza el turno», es mirar.
  if (s.foco?.tipo === 'turno' && R.i === antes + 1 && s.linea && /^Turn|^Turno/.test(s.linea)) cartelDeTurno(s.deQuien)
  if (anunciar) anunciarJugada(s)
}

function anunciarJugada(s) {
  const el = $('repAnuncio')
  // Reproduciéndose, solo lo gordo (el lector no da abasto con cuatro
  // líneas por segundo); paso a paso, cada línea.
  if (R.jugando && !['turno', 'ataque', 'ko', 'premio', 'fin'].includes(s.foco?.tipo)) return
  el.textContent = s.linea || (s.turno ? '' : 'Preparación')
}

function reproducir() {
  if (R.i >= R.fotos.length - 1) ir(0, { anunciar: false })
  R.jugando = true
  programar()
  pintarControles()
}

function parar() {
  R.jugando = false
  clearTimeout(R.temporizador)
  R.temporizador = null
  pintarControles()
}

function programar() {
  clearTimeout(R.temporizador)
  if (!R.jugando) return
  if (R.i >= R.fotos.length - 1) return parar()
  R.temporizador = setTimeout(() => {
    ir(R.i + 1)
    programar()
  }, esperaDe(foto()) / R.velocidad)
}

// El turno en el que cae la foto i (0 = la preparación).
function turnoDe(i) {
  let n = 0
  for (const t of R.turnos) if (t.foto <= i) n = t.n
  return n
}

function saltarTurno(delta) {
  parar()
  const actual = turnoDe(R.i)
  if (delta < 0) {
    // Hacia atrás: al principio de ESTE turno, y si ya estás en él, al
    // del anterior (como el «anterior» de cualquier reproductor).
    const este = R.turnos.find((t) => t.n === actual)
    const destino = este && R.i > este.foto ? este : R.turnos.find((t) => t.n === actual - 1)
    ir(destino ? destino.foto : 0)
  } else {
    const sig = R.turnos.find((t) => t.n === actual + 1)
    ir(sig ? sig.foto : R.fotos.length - 1)
  }
}

function pintarControles() {
  const btn = document.querySelector('[data-accion="reproducir"]')
  if (btn) {
    btn.innerHTML = R.jugando ? ICONO.pausa(22) : ICONO.reproducir(22)
    btn.setAttribute('aria-label', R.jugando ? 'Pausa' : R.i >= R.fotos.length - 1 ? 'Volver a verla' : 'Reproducir')
    btn.title = `${btn.getAttribute('aria-label')} (Espacio)`
  }
  const ultimo = R.fotos.length - 1
  const deslizador = $('repProgreso')
  deslizador.max = String(ultimo)
  deslizador.value = String(R.i)
  const t = turnoDe(R.i)
  const texto = `${t ? `Turno ${t}` : 'Preparación'} · jugada ${R.i} de ${ultimo}`
  deslizador.setAttribute('aria-valuetext', texto)
  $('repCuenta').textContent = texto
  document.querySelector('[data-accion="anterior"]').disabled = R.i <= 0
  document.querySelector('[data-accion="turnoAnterior"]').disabled = R.i <= 0
  document.querySelector('[data-accion="siguiente"]').disabled = R.i >= ultimo
  document.querySelector('[data-accion="turnoSiguiente"]').disabled = R.i >= ultimo
}

// ════════════════════════════════════════════════════════════════════
// El registro, al lado
// ════════════════════════════════════════════════════════════════════

function pintarRegistro() {
  const { eventos } = R.lectura
  const bloques = []
  let actual = { titulo: 'Preparación', items: [] }
  eventos.forEach((e, k) => {
    if (e.tipo === 'turno') {
      bloques.push(actual)
      const n = bloques.length
      actual = { titulo: `Turno ${n} · ${chapaJugador(e.jugador, true)}`, items: [] }
    }
    const sinLeer = e.tipo === 'texto'
    actual.items.push(
      `<li><button type="button" class="rep-paso${e.sub ? ' rep-paso-sub' : ''}${sinLeer ? ' rep-paso-sin-leer' : ''}" data-foto="${k + 1}"${sinLeer ? ' title="Esta línea no se ha entendido: sale aquí, pero no mueve la mesa"' : ''}>${escapeHtml(e.linea)}</button></li>`
    )
  })
  bloques.push(actual)
  $('repLineas').innerHTML = bloques
    .filter((b) => b.items.length)
    .map((b) => `<section class="rep-bloque"><h3 class="rep-bloque-titulo">${b.titulo}</h3><ol>${b.items.join('')}</ol></section>`)
    .join('')
}

function marcarLinea() {
  const caja = $('repLineas')
  caja.querySelector('[aria-current]')?.removeAttribute('aria-current')
  const el = caja.querySelector(`[data-foto="${R.i}"]`)
  if (!el) {
    caja.scrollTop = 0
    return
  }
  el.setAttribute('aria-current', 'step')
  // Dentro de SU caja y no con scrollIntoView, que movería la página
  // entera mientras alguien lee otra cosa.
  const arribaCaja = caja.getBoundingClientRect().top
  const arribaEl = el.getBoundingClientRect().top
  const destino = caja.scrollTop + (arribaEl - arribaCaja) - caja.clientHeight / 2
  caja.scrollTo({ top: Math.max(0, destino), behavior: menosMovimiento() || R.velocidad > 2 ? 'auto' : 'smooth' })
}

// ════════════════════════════════════════════════════════════════════
// Ver cartas en grande
// ════════════════════════════════════════════════════════════════════

function verCartas(titulo, nombres, { vacio = 'No hay ninguna.' } = {}) {
  const d = $('repVer')
  $('repVerTitulo').textContent = titulo
  $('repVerCartas').innerHTML = nombres.length
    ? nombres.map((n) => `<figure class="rep-ver-carta"><span class="lab-carta">${imagenHtml(n, 'high')}</span><figcaption>${escapeHtml(n)}</figcaption></figure>`).join('')
    : `<p class="rep-ver-vacio">${vacio}</p>`
  if (!d.open) d.showModal()
}

function buscarSlot(id) {
  for (const p of Object.values(foto().jugadores)) {
    for (const x of [p.activo, ...p.banca]) if (x?.id === id) return { slot: x, dueno: p.nombre }
  }
  return null
}

// ════════════════════════════════════════════════════════════════════
// Cargar una partida
// ════════════════════════════════════════════════════════════════════

const CLAVE_VELOCIDAD = 'pokedoc-repeticion-velocidad'

function mostrarError(texto) {
  const el = $('repError')
  el.textContent = texto
  el.classList.toggle('hidden', !texto)
}

function cargar(texto) {
  mostrarError('')
  if (!String(texto || '').trim()) return mostrarError('Pega primero el registro de una partida.')
  const lectura = leerRegistro(texto)
  if (lectura.error) return mostrarError(lectura.error)
  if (lectura.eventos.length < 3) return mostrarError('Esto tiene muy pocas jugadas para ser una partida. ¿Has copiado el registro entero?')
  parar()
  R.vez += 1
  R.lectura = lectura
  R.fotos = sacarFotos(lectura, { psDe })
  R.turnos = indiceDeTurnos(lectura)
  R.abajo = R.fotos[0].protagonista
  R.i = 0
  R.cacheHtml = new WeakMap()

  const [a, b] = [R.abajo, elOtro(R.abajo)]
  $('repQuienes').innerHTML = `${chapaJugador(a)} <span>contra</span> ${chapaJugador(b)}`
  $('repResumen').textContent = `${R.turnos.length} ${R.turnos.length === 1 ? 'turno' : 'turnos'} · ${lectura.eventos.length} jugadas`
  const sinLeer = lectura.sinLeer.length
  $('repSinLeer').textContent = sinLeer ? `${sinLeer} ${sinLeer === 1 ? 'línea no se ha entendido' : 'líneas no se han entendido'}: ${sinLeer === 1 ? 'sale' : 'salen'} en el registro, pero no ${sinLeer === 1 ? 'mueve' : 'mueven'} la mesa.` : ''
  $('repSinLeer').classList.toggle('hidden', !sinLeer)

  $('repPegar').classList.add('hidden')
  $('repSala').classList.remove('hidden')
  pintarRegistro()
  ir(0, { anunciar: false })
  $('repAnuncio').textContent = `Repetición de ${a} contra ${b}, ${R.turnos.length} turnos.`
  // A la MESA, no a la cabecera: en un portátil, mesa y controles caben
  // justos debajo de la barra de arriba, y la cabecera queda a un gesto.
  $('repEscena').scrollIntoView({ block: 'start', behavior: menosMovimiento() ? 'auto' : 'smooth' })
  document.querySelector('[data-accion="reproducir"]')?.focus({ preventScroll: true })
  // Se reproduce sola: es lo que se ha pedido.
  reproducir()
  resolverCartas(nombresDe(lectura), R.vez)
}

async function cargarEjemplo() {
  const boton = $('repEjemplo')
  boton.disabled = true
  try {
    const { EJEMPLO } = await import('./repeticiones/ejemplo.js')
    $('repTexto').value = EJEMPLO
    cargar(EJEMPLO)
  } catch {
    mostrarError('No se ha podido cargar el ejemplo. Prueba otra vez.')
  } finally {
    boton.disabled = false
  }
}

function volverAPegar() {
  parar()
  $('repSala').classList.add('hidden')
  $('repPegar').classList.remove('hidden')
  $('repTexto').focus()
}

// ════════════════════════════════════════════════════════════════════
// Arranque
// ════════════════════════════════════════════════════════════════════

function iniciar() {
  try {
    const v = Number(localStorage.getItem(CLAVE_VELOCIDAD))
    if ([0.5, 1, 2, 4].includes(v)) R.velocidad = v
  } catch {
    /* sin almacenamiento, a velocidad normal */
  }
  $('repVelocidad').value = String(R.velocidad)

  // Los iconos de los botones se ponen aquí: viven en un módulo, no en
  // el HTML, para no repetir el SVG en la página.
  for (const [accion, icono] of Object.entries({ turnoAnterior: 'turnoAnterior', anterior: 'anterior', siguiente: 'siguiente', turnoSiguiente: 'turnoSiguiente', reproducir: 'reproducir' })) {
    const b = document.querySelector(`[data-accion="${accion}"]`)
    if (b) b.innerHTML = ICONO[icono](accion === 'reproducir' ? 22 : 20)
  }

  $('repVer').addEventListener('click', (e) => {
    // Un clic en el velo (fuera de la caja) cierra.
    if (e.target === e.currentTarget || e.target.closest('[data-cerrar]')) $('repVer').close()
  })
  $('repFormulario').addEventListener('submit', (e) => {
    e.preventDefault()
    cargar($('repTexto').value)
  })
  $('repEjemplo').addEventListener('click', cargarEjemplo)

  $('repSala').addEventListener('click', (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion
    if (accion === 'reproducir') return R.jugando ? parar() : reproducir()
    if (accion === 'anterior') return parar(), ir(R.i - 1)
    if (accion === 'siguiente') return parar(), ir(R.i + 1)
    if (accion === 'turnoAnterior') return saltarTurno(-1)
    if (accion === 'turnoSiguiente') return saltarTurno(1)
    if (accion === 'otra') return volverAPegar()
    if (accion === 'girar') {
      R.abajo = elOtro(R.abajo)
      R.cacheHtml = new WeakMap()
      return pintar()
    }
    const paso = e.target.closest('[data-foto]')
    if (paso) return parar(), ir(Number(paso.dataset.foto))
    const slot = e.target.closest('[data-ver-slot]')
    if (slot) {
      const x = buscarSlot(slot.dataset.verSlot)
      if (x) verCartas(`${arriba(x.slot)} de ${x.dueno}`, [...x.slot.cartas, ...x.slot.energias, ...(x.slot.herramienta ? [x.slot.herramienta] : [])])
      return
    }
    const descarte = e.target.closest('[data-ver-descarte]')
    if (descarte) {
      const nombre = descarte.dataset.verDescarte
      return verCartas(`Descarte de ${nombre}`, [...foto().jugadores[nombre].descarte].reverse(), { vacio: 'El descarte está vacío.' })
    }
    if (e.target.closest('[data-ver-estadio]')) return verCartas('Estadio', [foto().estadio.carta])
    const mano = e.target.closest('[data-ver-mano]')
    if (mano) {
      const p = foto().jugadores[R.abajo]
      return verCartas(`Mano de ${R.abajo}`, p.manoConocida.slice(0, p.mano), { vacio: 'No se ve ninguna.' })
    }
  })

  $('repProgreso').addEventListener('input', (e) => {
    // El valor, ANTES de parar: parar repinta los controles y devuelve el
    // deslizador a la jugada de antes.
    const destino = Number(e.target.value)
    parar()
    ir(destino)
  })
  $('repVelocidad').addEventListener('change', (e) => {
    R.velocidad = Number(e.target.value) || 1
    try {
      localStorage.setItem(CLAVE_VELOCIDAD, String(R.velocidad))
    } catch {
      /* se queda para esta visita */
    }
    if (R.jugando) programar()
  })

  // El teclado, como en cualquier reproductor: espacio para parar y
  // seguir, flechas para ir de jugada en jugada (con mayúsculas, de turno
  // en turno). No dentro de un campo, que ahí las teclas son suyas.
  document.addEventListener('keydown', (e) => {
    if ($('repSala').classList.contains('hidden') || $('repVer').open) return
    if (e.target.closest('input, textarea, select, [contenteditable]') || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key === ' ' || e.key === 'k') {
      // Sobre un botón el espacio ya lo pulsa: no se hace dos veces.
      if (e.target.closest('button') && e.key === ' ') return
      e.preventDefault()
      return R.jugando ? parar() : reproducir()
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const d = e.key === 'ArrowRight' ? 1 : -1
      if (e.shiftKey) return saltarTurno(d)
      parar()
      return ir(R.i + d)
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      parar()
      return ir(e.key === 'Home' ? 0 : R.fotos.length - 1)
    }
  })

  // Con la pestaña escondida, quieto: si no, al volver ya ha acabado.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && R.jugando) parar()
  })

  if (new URLSearchParams(location.search).has('ejemplo')) cargarEjemplo()
}

iniciar()
