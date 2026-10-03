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
import { resolverLineas, cargarSets, cartasPorIds } from './constructor/datos.js'
import { imagenDeEnergiaBasica, esEnergiaBasica, letraDeEnergia, plano } from './constructor/nucleo.js'
import { leerRegistro } from './repeticiones/registro.js'
import { usosPorCarta, usosDe, impresionQueCasa } from './repeticiones/impresion.js'
import { fotos as sacarFotos, indiceDeTurnos, arriba } from './repeticiones/estado.js'
import { ICONOS_REPETICION as ICONO } from './repeticiones/iconos.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import * as datos from './repeticiones/datos.js'
import { empaquetar, desempaquetar, esEnlaceDeRepeticion } from './repeticiones/enlace.js'

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
  // Lo que se le ha visto hacer a cada carta (sus ataques y habilidades):
  // decide CUÁL de las que se llaman igual se jugó (repeticiones/impresion.js).
  usos: new Map(),
  codigoDeSet: () => null,
  // Cada lectura nueva sube el número: lo que llegue tarde de la anterior
  // (las imágenes que se resuelven por detrás) no pinta encima.
  vez: 0,
  cacheHtml: new WeakMap(),
  // El texto pegado (lo que se guarda o se comparte) y de dónde ha salido
  // la partida: null si se ha pegado, o { id, titulo, mia, compartida } si
  // es una guardada (tuya, o de alguien que la ha compartido).
  texto: '',
  origen: null,
  sesion: null,
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

// Las direcciones de una carta que se pueden PINTAR EN UN LIENZO (para el
// vídeo): Limitless por /escaneo, que la sirve desde pokedoc.es (tanda
// 413), y TCGdex, que ya trae el permiso. La cadena de la página (arriba)
// no vale: un lienzo con una imagen de otro dominio sin permiso ya no se
// puede grabar.
function fuentesDe(nombre) {
  const c = cartaDe(nombre)
  if (c ? esEnergiaBasica(c) : esEnergiaBasica({ name: nombre })) {
    const i = 'GRWLPFDM'.indexOf(letraDeEnergia(c?.name || nombre) || letraDeEnergia(c?.name_es) || '')
    if (i >= 0) return [`/escaneo/MEE/${9 + i}`, `https://images.pokemontcg.io/sve/${i + 1}.png`]
  }
  if (!c) return []
  const fuentes = []
  const codigo = R.codigoDeSet(c.set_id)
  if (codigo && c.local_id) fuentes.push(`/escaneo/${encodeURIComponent(codigo)}/${encodeURIComponent(String(c.local_id).replace(/^0+(?=\d)/, ''))}`)
  if (c.image_path) fuentes.push(cardImageUrl(c.image_path, 'low'))
  return fuentes
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
  const porAfinar = []
  for (let k = 0; k < pendientes.length; k += 6) {
    const tanda = pendientes.slice(k, k + 6)
    tanda.forEach((n) => R.pedidas.add(plano(n)))
    try {
      const { resueltas } = await resolverLineas(tanda.map((nombre) => ({ n: 1, nombre })))
      for (const r of resueltas) {
        R.cartas.set(plano(r.linea.nombre), r.carta)
        if (usosDe(R.usos, r.linea.nombre).size) porAfinar.push([r.linea.nombre, r.carta])
      }
    } catch {
      /* esa tanda se queda con el nombre: la mesa se entiende igual */
    }
    if (vez !== R.vez) return
    rehacerFotos()
  }
  // Y después, con la mesa ya pintada, la impresión que de verdad se jugó
  // (tanda 481): de una en una, que son peticiones a un catálogo gratuito.
  for (const [nombre, carta] of porAfinar) {
    if (vez !== R.vez) return
    if (await afinarImpresion(nombre, carta, vez)) rehacerFotos()
  }
}

// Con los PS a mano cambian las fotos (un KO que el registro no escribe se
// deduce de la vida): se rehacen, que es barato.
function rehacerFotos() {
  R.fotos = sacarFotos(R.lectura, { psDe })
  R.cacheHtml = new WeakMap()
  pintar()
}

// «Greninja ex» puede ser el teracristal o el de 30th Celebration: si lo
// que atacó no es de la elegida, se busca la que sí (impresion.js) y se
// trae por su colección y su número, como una línea con código.
async function afinarImpresion(nombre, carta, vez) {
  const buena = await impresionQueCasa(nombre, usosDe(R.usos, nombre), carta)
  if (!buena || vez !== R.vez) return false
  let nueva = null
  try {
    const { codigoDeId } = await cargarSets()
    const codigo = codigoDeId.get(buena.set)
    if (codigo) nueva = (await resolverLineas([{ n: 1, nombre, set: codigo, numero: buena.numero }])).resueltas.find((r) => r.exacta)?.carta || null
    if (!nueva) nueva = (await cartasPorIds([buena.id])).get(buena.id) || null
  } catch {
    return false
  }
  if (!nueva || vez !== R.vez) return false
  R.cartas.set(plano(nombre), nueva)
  return true
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
    case 'elige':
      return `<p class="rep-foco-ataque"><span class="rep-foco-que">${escapeHtml(f.que || '')}</span></p><p class="rep-foco-texto">${quien}elige</p>`
    case 'mostrar':
      return `<p class="rep-foco-texto">${quien}enseña su mano y roba otras 7</p>`
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
const ESPERA = { turno: 1400, ataque: 1800, ko: 1800, jugar: 1200, habilidad: 1100, moneda: 1300, premio: 1300, entra: 850, sube: 900, evoluciona: 1000, unir: 800, retirar: 900, robar: 650, descarta: 700, danio: 1000, elige: 1200, mostrar: 1400 }
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

// La dirección de la página, sin recargar: con una guardada, su enlace
// (así recargar la vuelve a abrir); con una pegada, la página a secas.
function ponerDireccion(url) {
  try {
    history.replaceState(null, '', url)
  } catch {
    /* sin historial (un iframe raro): la dirección se queda como está */
  }
}

function cargar(texto, { origen = null, conservarDireccion = false } = {}) {
  mostrarError('')
  if (!String(texto || '').trim()) return mostrarError('Pega primero el registro de una partida.')
  const lectura = leerRegistro(texto)
  if (lectura.error) return mostrarError(lectura.error)
  if (lectura.eventos.length < 3) return mostrarError('Esto tiene muy pocas jugadas para ser una partida. ¿Has copiado el registro entero?')
  parar()
  R.vez += 1
  R.texto = String(texto)
  R.origen = origen
  R.lectura = lectura
  // Las cartas se resuelven OTRA VEZ en cada partida: el mismo nombre
  // puede ser otra impresión en otra (un Greninja ex teracristal aquí, el
  // de 30th Celebration allí).
  R.cartas = new Map()
  R.pedidas = new Set()
  R.usos = usosPorCarta(lectura)
  R.fotos = sacarFotos(lectura, { psDe })
  R.turnos = indiceDeTurnos(lectura)
  R.abajo = R.fotos[0].protagonista
  R.i = 0
  R.cacheHtml = new WeakMap()
  if (!conservarDireccion) ponerDireccion(origen?.id ? `/repeticiones?r=${encodeURIComponent(origen.id)}` : '/repeticiones')

  const [a, b] = [R.abajo, elOtro(R.abajo)]
  $('repQuienes').innerHTML = `${chapaJugador(a)} <span>contra</span> ${chapaJugador(b)}`
  $('repResumen').textContent = `${R.turnos.length} ${R.turnos.length === 1 ? 'turno' : 'turnos'} · ${lectura.eventos.length} jugadas`
  const sinLeer = lectura.sinLeer.length
  $('repSinLeer').textContent = sinLeer ? `${sinLeer} ${sinLeer === 1 ? 'línea no se ha entendido' : 'líneas no se han entendido'}: ${sinLeer === 1 ? 'sale' : 'salen'} en el registro, pero no ${sinLeer === 1 ? 'mueve' : 'mueven'} la mesa.` : ''
  $('repSinLeer').classList.toggle('hidden', !sinLeer)
  pintarCabecera()

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
  return true
}

// El título de una guardada, si lo tiene, y el botón de guardar diciendo
// el ESTADO (tanda 473: un botón que dice lo que pasa, no lo que hará).
function pintarCabecera() {
  const o = R.origen
  const nombre = $('repNombre')
  nombre.classList.toggle('hidden', !o?.titulo)
  nombre.innerHTML = o?.titulo ? `${escapeHtml(o.titulo)}${o.compartida ? ` <span class="rep-chapa-compartida">${icons.link(14)} Compartida</span>` : ''}` : ''
  const guardar = document.querySelector('[data-accion="guardar"]')
  if (guardar) {
    const mia = Boolean(o?.mia)
    guardar.querySelector('.rep-btn-texto').textContent = mia ? 'Guardada' : 'Guardar'
    guardar.querySelector('.rep-btn-icono').innerHTML = mia ? icons.checkCircle(16) : icons.bookmark(16)
    guardar.classList.toggle('btn-primary', !mia)
    guardar.classList.toggle('btn-secondary', mia)
    guardar.setAttribute('aria-label', mia ? 'Guardada: cambiar el título' : 'Guardar la repetición')
  }
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

// Lo que se manda a la base con la partida: los jugadores, quién gana y
// los turnos van aparte para la lista y para la vista previa del enlace.
function resumenDeLaPartida() {
  const [a, b] = R.fotos[0].orden
  return { jugadores: [a, b], ganador: R.fotos.at(-1)?.fin?.ganador || null, turnos: R.turnos.length }
}
const tituloPorDefecto = () => `${R.abajo} contra ${elOtro(R.abajo)}`

// ════════════════════════════════════════════════════════════════════
// Las ventanas: guardar, compartir, el vídeo
// ════════════════════════════════════════════════════════════════════

function abrirDialogo(titulo, html) {
  $('repDialogoTitulo').textContent = titulo
  $('repDialogoCuerpo').innerHTML = html
  const d = $('repDialogo')
  if (!d.open) d.showModal()
  return $('repDialogoCuerpo')
}

const estadoDialogo = (texto, tipo = '') => {
  const el = $('repDialogoCuerpo').querySelector('.rep-dialogo-estado')
  if (!el) return
  el.textContent = texto
  el.dataset.tipo = tipo
}

// Antes de ir a entrar en la cuenta, la partida se queda en la pestaña:
// al volver se abre sola y con la ventana de guardar delante.
const CLAVE_PENDIENTE = 'pokedoc-repeticion-pendiente'
function guardarPendiente() {
  try {
    sessionStorage.setItem(CLAVE_PENDIENTE, R.texto)
  } catch {
    /* sin almacenamiento: al volver habrá que pegarla otra vez */
  }
}

const enlacesDeEntrar = () => `
  <div class="rep-dialogo-botones">
    <a class="btn-primary" href="/auth.html?volver=${encodeURIComponent('/repeticiones')}" data-pendiente>Entrar</a>
    <a class="btn-secondary" href="/auth.html?registro=1&volver=${encodeURIComponent('/repeticiones')}" data-pendiente>Crear una cuenta</a>
  </div>`

function dialogoGuardar() {
  if (!R.sesion) {
    abrirDialogo(
      'Guardar la repetición',
      `<p class="rep-dialogo-texto">Para guardar repeticiones hace falta una cuenta: así las tienes en «Tus repeticiones», como tus mazos, y desde cualquier sitio.</p>${enlacesDeEntrar()}`
    )
    return
  }
  const o = R.origen
  const mia = Boolean(o?.mia)
  const cuerpo = abrirDialogo(
    mia ? 'Tu repetición guardada' : 'Guardar la repetición',
    `<form class="rep-form" id="repFormGuardar">
      <label class="rep-campo">Título
        <input type="text" id="repTitulo" maxlength="120" required value="${escapeHtml(o?.titulo || tituloPorDefecto())}" />
      </label>
      <label class="rep-check">
        <input type="checkbox" id="repCompartirla"${o?.compartida && mia ? ' checked' : ''} />
        <span>Compartirla con un enlace (la abre cualquiera que lo tenga; nadie puede buscarla)</span>
      </label>
      <div class="rep-dialogo-botones">
        <button type="submit" class="btn-primary">${mia ? 'Guardar los cambios' : 'Guardar'}</button>
      </div>
      <p class="rep-dialogo-estado" role="status"></p>
    </form>`
  )
  cuerpo.querySelector('#repTitulo').select()
  cuerpo.querySelector('#repFormGuardar').addEventListener('submit', async (e) => {
    e.preventDefault()
    const boton = e.target.querySelector('[type=submit]')
    const titulo = cuerpo.querySelector('#repTitulo').value.trim() || tituloPorDefecto()
    const compartida = cuerpo.querySelector('#repCompartirla').checked
    boton.disabled = true
    estadoDialogo('Guardando…')
    try {
      let fila
      if (mia) {
        fila = await datos.renombrar(o.id, titulo)
        if (Boolean(o.compartida) !== compartida) fila = await datos.compartir(o.id, compartida)
        R.origen = { ...o, titulo: fila.titulo, compartida: fila.compartida }
      } else {
        fila = await datos.guardar({ registro: R.texto, titulo, ...resumenDeLaPartida(), compartida })
        R.origen = { id: fila.id, titulo, mia: true, compartida: fila.compartida }
      }
      ponerDireccion(`/repeticiones?r=${encodeURIComponent(R.origen.id)}`)
      pintarCabecera()
      $('repDialogo').close()
      showToast(mia ? 'Cambios guardados.' : 'Guardada en «Tus repeticiones».', 'success')
      cargarGuardadas()
    } catch (err) {
      estadoDialogo(err.message, 'error')
      boton.disabled = false
    }
  })
}

async function dialogoCompartir() {
  const cuerpo = abrirDialogo(
    'Compartir la repetición',
    `<p class="rep-dialogo-texto" id="repCompartirNota">Preparando el enlace…</p>
    <div class="rep-enlace hidden" id="repEnlaceCaja">
      <label class="sr-only" for="repEnlace">Enlace de la repetición</label>
      <input type="text" id="repEnlace" readonly />
      <button type="button" class="btn-primary" data-dlg="copiar">${icons.link(16)} Copiar</button>
    </div>
    <div class="rep-dialogo-botones" id="repCompartirMas"></div>
    <p class="rep-dialogo-estado" role="status"></p>`
  )
  const nota = cuerpo.querySelector('#repCompartirNota')
  const o = R.origen
  let url = null
  let texto = ''
  let mas = ''
  try {
    if (o?.id && !o.mia) {
      // La ha compartido otra persona: su mismo enlace.
      url = datos.enlaceCorto(o.id)
      texto = 'Es el enlace con el que te la han pasado: quien lo abra ve esta misma repetición.'
    } else if (R.sesion) {
      if (o?.mia) {
        if (!o.compartida) {
          R.origen = { ...o, compartida: (await datos.compartir(o.id, true)).compartida }
          cargarGuardadas()
        }
      } else {
        const fila = await datos.guardar({ registro: R.texto, titulo: tituloPorDefecto(), ...resumenDeLaPartida(), compartida: true })
        R.origen = { id: fila.id, titulo: o?.titulo || tituloPorDefecto(), mia: true, compartida: fila.compartida }
        cargarGuardadas()
      }
      url = datos.enlaceCorto(R.origen.id)
      ponerDireccion(`/repeticiones?r=${encodeURIComponent(R.origen.id)}`)
      pintarCabecera()
      texto = 'Está guardada en «Tus repeticiones» y compartida: la abre cualquiera que tenga el enlace (nadie puede buscarla).'
      mas = '<button type="button" class="link-btn" data-dlg="dejar">Dejar de compartirla</button>'
    }
  } catch (err) {
    // Sin la migración (o sin red), el enlace largo, que no necesita base.
    url = null
    texto = err.falta ? '' : `No se ha podido hacer el enlace corto (${err.message}). Este otro funciona igual: `
  }
  if (!url) {
    url = `${location.origin}/repeticiones#${await empaquetar(R.texto)}`
    texto += 'Este enlace lleva la partida DENTRO: no se guarda en ningún sitio, y quien lo abra la ve igual.'
    if (!R.sesion) {
      texto += ' Con una cuenta sale corto, y la tienes en «Tus repeticiones».'
      mas = enlacesDeEntrar()
    }
    if (url.length > 2000) texto += ` Es largo (${url.length.toLocaleString('es-ES')} caracteres): en Discord no cabe en un mensaje.`
  }
  nota.textContent = texto
  cuerpo.querySelector('#repEnlace').value = url
  cuerpo.querySelector('#repEnlaceCaja').classList.remove('hidden')
  if (navigator.share) mas = `<button type="button" class="btn-secondary" data-dlg="nativo">${icons.share(16)} Compartir en…</button>${mas}`
  cuerpo.querySelector('#repCompartirMas').innerHTML = mas
  cuerpo.dataset.url = url
}

async function copiarEnlace(url, boton = null) {
  try {
    await navigator.clipboard.writeText(url)
    showToast('Enlace copiado.', 'success')
    if (boton) {
      const antes = boton.innerHTML
      boton.innerHTML = `${icons.checkCircle(16)} Copiado`
      setTimeout(() => (boton.innerHTML = antes), 2000)
    }
  } catch {
    // Sin permiso para el portapapeles: se deja seleccionado para copiarlo
    // a mano.
    const campo = $('repEnlace')
    if (campo) {
      campo.focus()
      campo.select()
    }
    showToast('Cópialo a mano: ya está seleccionado.', 'info')
  }
}

// ── El vídeo ──

const formatoTiempo = (seg) => {
  const s = Math.round(seg)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const nombreDeFichero = () =>
  `repeticion-${plano(`${R.abajo}-contra-${elOtro(R.abajo)}`).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

let videoEnMarcha = null
async function dialogoVideo() {
  const cuerpo = abrirDialogo('Descargar en vídeo', '<p class="rep-dialogo-texto">Mirando qué sabe hacer tu navegador…</p>')
  const V = await import('./repeticiones/video.js')
  const codec = await V.codecDisponible()
  const grabadora = codec ? null : V.grabadoraDisponible()
  if (!codec && !grabadora) {
    cuerpo.innerHTML = '<p class="rep-dialogo-texto">Este navegador no sabe hacer vídeos. Prueba con Chrome, Edge o Safari al día.</p>'
    return
  }
  const duracion = (r) => V.lineaDeTiempo(R.fotos, esperaDe, r).reduce((t, x) => t + x.duracion, 0)
  const opcion = (r, nombre, marcada) =>
    `<label class="rep-ritmo-opcion"><input type="radio" name="repRitmo" value="${r}"${marcada ? ' checked' : ''} /><span><strong>${nombre}</strong> · ${formatoTiempo(duracion(r))}</span></label>`
  cuerpo.innerHTML = `
    <p class="rep-dialogo-texto">Se hace en tu navegador y se descarga en tu equipo: no se sube a ninguna parte.${
      codec
        ? ` Sale en MP4${codec.caja === 'avc1' ? ' (H.264, el que se ve en todas partes)' : ' (VP9)'} y tarda unos segundos.`
        : ` Este navegador lo graba en TIEMPO REAL: tarda lo que dure el vídeo, y mientras tanto no cambies de pestaña.${grabadora.extension === 'webm' ? ' Y solo sabe hacer WebM, no MP4.' : ''}`
    }</p>
    <fieldset class="rep-ritmo">
      <legend>Ritmo</legend>
      ${opcion(1, 'Normal', false)}${opcion(2, 'Rápido', true)}${opcion(4, 'Muy rápido', false)}
    </fieldset>
    <div class="rep-dialogo-botones"><button type="button" class="btn-primary" data-dlg="hacer-video">${ICONO.descargar(16)} Hacer el vídeo</button></div>
    <div class="rep-video-progreso hidden" id="repVideoProgreso">
      <div class="rep-barra-video" role="progressbar" aria-label="Haciendo el vídeo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
      <button type="button" class="btn-secondary" data-dlg="cancelar-video">Cancelar</button>
    </div>
    <p class="rep-dialogo-estado" role="status"></p>`
}

async function hacerVideo() {
  const cuerpo = $('repDialogoCuerpo')
  const ritmo = Number(cuerpo.querySelector('input[name="repRitmo"]:checked')?.value) || 2
  const progreso = cuerpo.querySelector('#repVideoProgreso')
  const barra = progreso.querySelector('[role="progressbar"]')
  cuerpo.querySelector('[data-dlg="hacer-video"]').disabled = true
  cuerpo.querySelectorAll('input[name="repRitmo"]').forEach((x) => (x.disabled = true))
  progreso.classList.remove('hidden')
  const senal = { cancelado: false }
  videoEnMarcha = senal
  parar()
  const V = await import('./repeticiones/video.js')
  try {
    const r = await V.hacerVideo({
      fotos: R.fotos,
      ritmo,
      senal,
      M: { abajo: R.abajo, psDe, letraDe: (n) => letraDeEnergia(n) || 'C', colorDe, fuentesDe, esperaDe },
      alAvanzar: (fase, x) => {
        const pct = Math.round((fase === 'imagenes' ? x * 0.1 : 0.1 + x * 0.9) * 100)
        barra.setAttribute('aria-valuenow', String(pct))
        barra.style.setProperty('--pct', `${pct}%`)
        estadoDialogo(fase === 'imagenes' ? 'Preparando las cartas…' : `Haciendo el vídeo… ${pct} %`)
      },
    })
    const url = URL.createObjectURL(r.blob)
    const fichero = `${nombreDeFichero()}.${r.extension}`
    const mb = (r.blob.size / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })
    progreso.classList.add('hidden')
    estadoDialogo('')
    cuerpo.querySelector('.rep-dialogo-botones').innerHTML = `<a class="btn-primary" href="${url}" download="${escapeHtml(fichero)}" data-dlg="descargar">${ICONO.descargar(16)} Descargar ${escapeHtml(fichero)} (${mb} MB)</a>`
    cuerpo.querySelector('[data-dlg="descargar"]').click()
    estadoDialogo('Listo: si no se ha descargado solo, pulsa el botón.', 'ok')
  } catch (err) {
    progreso.classList.add('hidden')
    cuerpo.querySelector('[data-dlg="hacer-video"]').disabled = false
    cuerpo.querySelectorAll('input[name="repRitmo"]').forEach((x) => (x.disabled = false))
    estadoDialogo(err.name === 'AbortError' ? 'Cancelado.' : `No se ha podido hacer el vídeo: ${err.message}`, err.name === 'AbortError' ? '' : 'error')
  } finally {
    videoEnMarcha = null
  }
}

// ════════════════════════════════════════════════════════════════════
// Tus repeticiones
// ════════════════════════════════════════════════════════════════════

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

async function cargarGuardadas() {
  const caja = $('repGuardadasCuerpo')
  if (!R.sesion) {
    caja.innerHTML = `<p class="rep-guardadas-vacio">Entra en tu cuenta para guardar tus repeticiones y tenerlas aquí, como tus mazos.</p>
      <a class="btn-secondary" href="/auth.html?volver=${encodeURIComponent('/repeticiones')}">Entrar</a>`
    return
  }
  caja.setAttribute('aria-busy', 'true')
  if (!caja.querySelector('.rep-lista')) caja.innerHTML = '<p class="rep-guardadas-vacio">Cargando tus repeticiones…</p>'
  try {
    const lista = await datos.misRepeticiones(R.sesion.user.id)
    caja.innerHTML = lista.length
      ? `<ul class="rep-lista">${lista.map(itemHtml).join('')}</ul>`
      : '<p class="rep-guardadas-vacio">Aún no has guardado ninguna. Abre una partida y pulsa «Guardar».</p>'
  } catch (err) {
    caja.innerHTML = `<p class="rep-guardadas-vacio">${escapeHtml(err.message)}</p>`
  } finally {
    caja.removeAttribute('aria-busy')
  }
}

function itemHtml(r) {
  const jug = [r.jugador_a, r.jugador_b].filter(Boolean)
  const sub = [jug.length === 2 ? `${jug[0]} contra ${jug[1]}` : '', r.turnos != null ? `${r.turnos} ${r.turnos === 1 ? 'turno' : 'turnos'}` : '', r.ganador ? `gana ${r.ganador}` : '', fechaCorta(r.created_at)].filter(Boolean).join(' · ')
  const id = escapeHtml(r.id)
  return `
    <li class="rep-item" data-id="${id}" data-titulo="${escapeHtml(r.titulo)}" data-compartida="${r.compartida ? 'si' : 'no'}">
      <button type="button" class="rep-item-abrir" data-abrir="${id}">
        <span class="rep-item-titulo">${escapeHtml(r.titulo)}</span>
        <span class="rep-item-sub">${escapeHtml(sub)}</span>
      </button>
      ${r.compartida ? `<span class="rep-chapa-compartida">${icons.link(14)} Compartida</span>` : ''}
      <div class="rep-item-acciones">
        <button type="button" class="link-btn" data-copiar="${id}">${r.compartida ? 'Copiar enlace' : 'Compartir'}</button>
        ${r.compartida ? `<button type="button" class="link-btn" data-privada="${id}">Dejar de compartir</button>` : ''}
        <button type="button" class="link-btn rep-item-borrar" data-borrar="${id}">Borrar</button>
      </div>
    </li>`
}

async function abrirGuardada(id) {
  mostrarError('')
  try {
    const fila = await datos.leer(id)
    if (!fila) {
      mostrarError('Esta repetición no existe o ya no se comparte.')
      volverAPegar()
      return
    }
    cargar(fila.registro, { origen: { id, titulo: fila.titulo, mia: Boolean(fila.mia), compartida: Boolean(fila.compartida) } })
  } catch (err) {
    mostrarError(err.falta ? 'Esta repetición no se puede abrir todavía: la parte de guardar no está puesta en la base.' : `No se ha podido abrir la repetición: ${err.message}`)
    volverAPegar()
  }
}

async function accionDeLista(e) {
  const b = e.target.closest('button')
  if (!b) return
  const id = b.dataset.abrir || b.dataset.copiar || b.dataset.privada || b.dataset.borrar
  if (!id) return
  try {
    if (b.dataset.abrir) return abrirGuardada(id)
    if (b.dataset.copiar) {
      const item = b.closest('.rep-item')
      if (item.dataset.compartida !== 'si') {
        await datos.compartir(id, true)
        if (R.origen?.id === id) {
          R.origen = { ...R.origen, compartida: true }
          pintarCabecera()
        }
        cargarGuardadas()
      }
      return copiarEnlace(datos.enlaceCorto(id))
    }
    if (b.dataset.privada) {
      await datos.compartir(id, false)
      if (R.origen?.id === id) {
        R.origen = { ...R.origen, compartida: false }
        pintarCabecera()
      }
      showToast('Ya no se comparte: el enlace deja de abrirla.', 'success')
      return cargarGuardadas()
    }
    if (b.dataset.borrar) {
      // Borrar es para siempre: se pide un segundo toque, sin ventanas
      // del navegador (bloquean la página).
      if (b.dataset.confirmar !== 'si') {
        b.dataset.confirmar = 'si'
        b.textContent = '¿Seguro? Toca otra vez'
        setTimeout(() => {
          if (b.isConnected) {
            delete b.dataset.confirmar
            b.textContent = 'Borrar'
          }
        }, 4000)
        return
      }
      await datos.borrar(id)
      if (R.origen?.id === id) {
        R.origen = null
        pintarCabecera()
        ponerDireccion('/repeticiones')
      }
      showToast('Repetición borrada.', 'success')
      return cargarGuardadas()
    }
  } catch (err) {
    showToast(err.message)
  }
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

  // Los iconos de los botones de la cabecera.
  const ICONOS_CAB = { guardar: icons.bookmark(16), compartir: icons.share(16), descargar: ICONO.descargar(16) }
  document.querySelectorAll('[data-icono]').forEach((el) => (el.innerHTML = ICONOS_CAB[el.dataset.icono] || ''))

  // La ventana de guardar, compartir y el vídeo.
  $('repDialogo').addEventListener('click', async (e) => {
    const d = $('repDialogo')
    if (e.target === d || e.target.closest('[data-cerrar]')) return d.close()
    if (e.target.closest('[data-pendiente]')) return guardarPendiente()
    const b = e.target.closest('[data-dlg]')
    if (!b) return
    const url = $('repDialogoCuerpo').dataset.url
    if (b.dataset.dlg === 'copiar') return copiarEnlace(url, b)
    if (b.dataset.dlg === 'nativo') {
      try {
        await navigator.share({ title: `Repetición: ${tituloPorDefecto()}`, text: 'Mira esta partida de Pokémon TCG Live, jugada a jugada:', url })
      } catch {
        /* cancelado por quien comparte: nada que decir */
      }
      return
    }
    if (b.dataset.dlg === 'dejar') {
      try {
        await datos.compartir(R.origen.id, false)
        R.origen = { ...R.origen, compartida: false }
        pintarCabecera()
        cargarGuardadas()
        d.close()
        showToast('Ya no se comparte: el enlace deja de abrirla.', 'success')
      } catch (err) {
        estadoDialogo(err.message, 'error')
      }
      return
    }
    if (b.dataset.dlg === 'hacer-video') return hacerVideo()
    if (b.dataset.dlg === 'cancelar-video' && videoEnMarcha) videoEnMarcha.cancelado = true
  })
  // Cerrar la ventana a mitad de un vídeo lo para: nadie espera que siga
  // trabajando algo que ya no ve.
  $('repDialogo').addEventListener('close', () => {
    if (videoEnMarcha) videoEnMarcha.cancelado = true
    delete $('repDialogoCuerpo').dataset.url
  })
  $('repGuardadas').addEventListener('click', accionDeLista)

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
    if (accion === 'guardar') return dialogoGuardar()
    if (accion === 'compartir') return dialogoCompartir()
    if (accion === 'video') return dialogoVideo()
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
    if ($('repSala').classList.contains('hidden') || $('repVer').open || $('repDialogo').open) return
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

  arrancar()
}

// Lo que dice la dirección: una guardada (?r=), una que viene en el
// enlace (#p=), una que se quedó esperando a que entraras, o el ejemplo.
async function arrancar() {
  R.sesion = await datos.sesionActual()
  cargarGuardadas()
  const q = new URLSearchParams(location.search)
  if (q.get('r')) {
    mostrarError('')
    $('repError').classList.add('hidden')
    return abrirGuardada(q.get('r'))
  }
  if (esEnlaceDeRepeticion(location.hash)) {
    const texto = await desempaquetar(location.hash)
    if (texto) return cargar(texto, { conservarDireccion: true })
    return mostrarError('El enlace de esta repetición está roto o incompleto: ¿se cortó al copiarlo?')
  }
  let pendiente = null
  try {
    pendiente = sessionStorage.getItem(CLAVE_PENDIENTE)
    sessionStorage.removeItem(CLAVE_PENDIENTE)
  } catch {
    /* sin almacenamiento, nada pendiente */
  }
  if (pendiente) {
    $('repTexto').value = pendiente
    if (cargar(pendiente) && R.sesion) dialogoGuardar()
    return
  }
  if (q.has('ejemplo')) cargarEjemplo()
}

iniciar()
