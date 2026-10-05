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
import { resolverLineas, cargarSets, cartasPorIds, misMazos } from './constructor/datos.js'
import { imagenDeEnergiaBasica, esEnergiaBasica, letraDeEnergia, plano, codificarMazo, leerLista } from './constructor/nucleo.js'
import { mazoConLista, sinVerEnLaFoto, premiosCogidos, probabilidadDeRobar } from './repeticiones/lista.js'
import { leerRegistro } from './repeticiones/registro.js'
import { usosPorCarta, usosDe, impresionQueCasa, masJugadas, esLaImpresion } from './repeticiones/impresion.js'
import { momentosDe, numerosDe, siguienteKo } from './repeticiones/numeros.js'
import { pintarCarrera } from './repeticiones/carrera.js'
import { cartasVistas, listaParaArquetipo, entradasDelConstructor, totalVisto } from './repeticiones/mazos.js'
import { mazosDeLaPosicion, colocarPosicion, sePuedeJugarDesde } from './repeticiones/posicion.js'
import { fotos as sacarFotos, indiceDeTurnos, arriba } from './repeticiones/estado.js'
import { ICONOS_REPETICION as ICONO } from './repeticiones/iconos.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import * as datos from './repeticiones/datos.js'
import { empaquetar, desempaquetar, esEnlaceDeRepeticion } from './repeticiones/enlace.js'
import { acortar, leerCorto, esIdCorto, enlaceCorto as enlaceCortoDe } from './enlace-corto.js'

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
  // Los momentos que merece la pena volver a ver y los números de la
  // partida (repeticiones/numeros.js).
  momentos: [],
  numeros: null,
  // Lo que se vio del mazo de cada uno y su arquetipo (repeticiones/
  // mazos.js): { [jugador]: { vistas, arq, entradas } }, o null mientras
  // no se sabe.
  mazos: null,
  // Las notas del dueño, ya puestas en su jugada: [{ fila, texto, foto }].
  notas: [],
  // La lista entera de uno de los dos (tanda 519): { jugador, nombre,
  // entradas, idDe, fuera }, o null.
  lista: null,
  codigoDeSet: () => null,
  // La resolución de las cartas de esta partida (la promesa): «Juega desde
  // aquí» la espera, porque el laboratorio sin cartas no sabe jugar.
  resolviendo: null,
  // Cada lectura nueva sube el número: lo que llegue tarde de la anterior
  // (las imágenes que se resuelven por detrás) no pinta encima.
  vez: 0,
  cacheHtml: new WeakMap(),
  // El texto pegado (lo que se guarda o se comparte) y de dónde ha salido
  // la partida: null si se ha pegado, o { id, titulo, mia, compartida,
  // notas, mazos } si es una guardada (tuya, o de alguien que la ha
  // compartido).
  texto: '',
  origen: null,
  sesion: null,
}

// ════════════════════════════════════════════════════════════════════
// Las cartas: del nombre del registro a su imagen
// ════════════════════════════════════════════════════════════════════

const cartaDe = (nombre) => R.cartas.get(plano(nombre)) || null
// Los mazos para montar la mesa de una jugada («Jugar desde aquí» y los
// caminos de la 554): con la lista de uno asociada, su mazo es la lista
// ENTERA — lo que no se vio sale de ella y no como «Carta sin ver» (tanda
// 519).
const mazosParaLaMesa = (orden, vistas) => orden.map((n) => (R.lista?.jugador === n ? mazoConLista(R.lista.entradas, vistas[n], cartaDe) : mazosDeLaPosicion(vistas[n], cartaDe)))
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
  const resueltos = []
  for (let k = 0; k < pendientes.length; k += 6) {
    const tanda = pendientes.slice(k, k + 6)
    tanda.forEach((n) => R.pedidas.add(plano(n)))
    try {
      const { resueltas } = await resolverLineas(tanda.map((nombre) => ({ n: 1, nombre })))
      for (const r of resueltas) {
        R.cartas.set(plano(r.linea.nombre), r.carta)
        resueltos.push(r.linea.nombre)
      }
    } catch {
      /* esa tanda se queda con el nombre: la mesa se entiende igual */
    }
    if (vez !== R.vez) return
    rehacerFotos()
  }
  // La impresión que llevan los mazos de verdad, ANTES de afinar por lo
  // que se le ve hacer: así lo de abajo comprueba esa y no la más nueva.
  if (await preferirLasDelMeta(resueltos, vez)) rehacerFotos()
  if (vez !== R.vez) return
  const porAfinar = resueltos.filter((n) => usosDe(R.usos, n).size && R.cartas.get(plano(n))).map((n) => [n, R.cartas.get(plano(n))])
  // Con las cartas encontradas, los mazos se leen bien: el tipo de cada
  // una y su nombre inglés, que es con el que se cruza el arquetipo.
  pintarMazos()
  // El afinado va por detrás y sin esperarlo: quien espera a que las
  // cartas estén (Juega desde aquí) no tiene por qué esperar también a
  // esto, que son peticiones de una en una.
  afinarTodas(porAfinar, vez)
}

// De cada Pokémon resuelto por su nombre, la impresión que más mazos del
// meta llevan (repeticiones/impresion.js, `masJugadas`), si no es ya la
// elegida. Una consulta para todos, y una más para traer las que cambian.
async function preferirLasDelMeta(nombres, vez) {
  const pokemon = nombres.map((n) => [n, R.cartas.get(plano(n))]).filter(([, c]) => c && c.category === 'Pokemon' && c.name)
  if (!pokemon.length) return false
  let mejor
  try {
    mejor = masJugadas(await datos.impresionesDelMeta(pokemon.map(([, c]) => c.name)))
  } catch {
    return false
  }
  const lineas = []
  for (const [nombre, c] of pokemon) {
    const buena = mejor.get(plano(c.name))
    if (!buena || esLaImpresion(R.codigoDeSet?.(c.set_id), c.local_id, buena)) continue
    lineas.push({ n: 1, nombre, set: buena.set, numero: buena.numero })
  }
  if (!lineas.length || vez !== R.vez) return false
  let cambia = false
  try {
    const { resueltas } = await resolverLineas(lineas)
    if (vez !== R.vez) return false
    for (const r of resueltas) {
      if (!r.exacta) continue
      R.cartas.set(plano(r.linea.nombre), r.carta)
      cambia = true
    }
  } catch {
    /* sin ella se queda la que había */
  }
  return cambia
}

async function afinarTodas(porAfinar, vez) {
  // Y después, con la mesa ya pintada, la impresión que de verdad se jugó
  // (tanda 481): de una en una, que son peticiones a un catálogo gratuito.
  let afinada = false
  for (const [nombre, carta] of porAfinar) {
    if (vez !== R.vez) return
    if (await afinarImpresion(nombre, carta, vez)) {
      rehacerFotos()
      afinada = true
    }
  }
  if (afinada && vez === R.vez) pintarMazos()
}

// Con los PS a mano cambian las fotos (un KO que el registro no escribe se
// deduce de la vida): se rehacen, que es barato.
function rehacerFotos() {
  R.fotos = sacarFotos(R.lectura, { psDe })
  // Y con ellas los números y los momentos: un KO que solo se deduce de la
  // vida no estaba cuando se contaron al cargar, y la tabla decía «0
  // noqueados» con el Pokémon ya en el descarte.
  R.momentos = momentosDe(R.lectura, R.fotos)
  R.numeros = numerosDe(R.lectura, R.fotos)
  R.cacheHtml = new WeakMap()
  pintarMomentos()
  pintarNumeros()
  pintar()
}

// «Greninja ex» puede ser el teracristal o el de 30th Celebration: si lo
// que atacó no es de la elegida, se busca la que sí (impresion.js) y se
// trae por su colección y su número, como una línea con código.
async function afinarImpresion(nombre, carta, vez) {
  // El registro en inglés empieza por «Setup»; el de TCG Live en español, por
  // «Preparación».
  const idioma = /^\s*Setup\s*$/m.test(R.texto) ? 'en' : 'es'
  const buena = await impresionQueCasa(nombre, usosDe(R.usos, nombre), carta, { idioma })
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
  pintarNota()
  pintarProbabilidades()
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
  }, esperaDe(foto()) / R.velocidad + esperaDeNota(notaDe(R.i)))
}

// Una nota se queda en pantalla lo que se tarda en LEERLA, y eso no va más
// deprisa a 4×: lo que corre es la partida, no quien lee. 25 letras por
// segundo, con un mínimo y un tope.
const esperaDeNota = (n) => (n ? Math.min(8000, 1500 + n.texto.length * 40) : 0)

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
  const ko = document.querySelector('[data-accion="siguienteKo"]')
  if (ko) ko.disabled = !siguienteKo(R.momentos, R.i)
  const jugar = document.querySelector('[data-accion="jugar"]')
  if (jugar && !jugar.dataset.abriendo) {
    const se = sePuedeJugarDesde(R.lectura, R.fotos, R.i)
    jugar.disabled = !se
    jugar.title = se ? 'Abre el laboratorio con la mesa de esta jugada, para probar otra línea' : 'En la preparación y al final no hay partida que seguir'
  }
  const caminos = document.querySelector('[data-accion="caminos"]')
  if (caminos) {
    const se = sePuedeJugarDesde(R.lectura, R.fotos, R.i)
    caminos.disabled = !se
    caminos.title = se ? 'Los caminos que tenía quien juega para traer una carta, con su probabilidad' : 'En la preparación y al final no hay jugada que mirar'
  }
  const puzle = document.querySelector('[data-accion="puzle"]')
  if (puzle) puzle.classList.toggle('hidden', !puedeAnotar() || !sePuedeJugarDesde(R.lectura, R.fotos, R.i))
  const nota = document.querySelector('[data-accion="nota"]')
  if (nota) {
    nota.classList.toggle('hidden', !puedeAnotar())
    nota.textContent = notaDe(Math.max(1, R.i)) ? 'Cambiar la nota' : 'Añadir una nota aquí'
  }
  const lista = $('repMomentosLista')
  lista.querySelector('[aria-current]')?.removeAttribute('aria-current')
  lista.querySelector(`[data-foto="${R.i}"]`)?.setAttribute('aria-current', 'step')
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

// ════════════════════════════════════════════════════════════════════
// Los momentos y los números (tanda 492)
// ════════════════════════════════════════════════════════════════════

const premiosTexto = (n) => `${n} ${n === 1 ? 'premio' : 'premios'}`
const PORQUE = { premios: 'por premios', rendicion: 'por rendición' }

function textoDeMomento(m) {
  if (m.tipo === 'ko') {
    const caidos = m.caidos.length > 1 ? `${m.caidos.slice(0, -1).join(', ')} y ${m.caidos.at(-1)}` : m.caidos[0]
    const como = m.ataque ? `${m.ataque}, ${m.danio}` : ''
    const premios = m.premios ? `${m.premios.jugador} coge ${premiosTexto(m.premios.n)}` : ''
    return { que: `KO de ${caidos}`, detalle: [como, premios].filter(Boolean).join(' · ') }
  }
  if (m.tipo === 'golpe') return { que: `Golpe de ${m.danio}`, detalle: `${m.ataque} de ${m.pokemon}` }
  if (m.tipo === 'nota') return { que: 'Nota', detalle: m.texto }
  return { que: 'Final', detalle: `Gana ${m.jugador}${m.porque ? ` ${PORQUE[m.porque] || ''}` : ''}`.trim() }
}

// La tira de momentos, y sus marcas sobre el deslizador. Cada momento es
// un botón (`data-foto`, como las líneas del registro); las marcas son su
// dibujo y van `aria-hidden`: lo que se pulsa es la tira.
function pintarMomentos() {
  // Las notas del dueño son momentos también (tanda 495): las ha puesto
  // alguien para que se vuelva a ellas.
  const ms = [...R.momentos, ...R.notas.map((n) => ({ foto: n.foto, turno: turnoDe(n.foto), tipo: 'nota', texto: n.texto }))].sort((a, b) => a.foto - b.foto)
  const ultimo = Math.max(1, R.fotos.length - 1)
  // La cabecera de la tira se queda siempre (lleva «Juega desde aquí» y
  // las notas); la lista, solo si hay algo que poner.
  $('repMomentos').classList.remove('hidden')
  $('repMomentosLista').classList.toggle('hidden', !ms.length)
  $('repMomentosLista').innerHTML = ms
    .map((m) => {
      const { que, detalle } = textoDeMomento(m)
      // De quién es: el que PIERDE el Pokémon en un KO, el que pega en un
      // golpe, el que gana al final. Con su nombre, no solo su color. Una
      // nota no es de ninguno de los dos.
      const quien = m.tipo === 'ko' ? m.victima : m.tipo === 'nota' ? null : m.jugador
      return `<li><button type="button" class="rep-momento" data-foto="${m.foto}" data-tipo="${m.tipo}"><span class="rep-momento-turno">${m.turno ? `Turno ${m.turno}` : 'Preparación'}${quien ? ` ${chapaJugador(quien, true)}` : ''}</span> <span class="rep-momento-que">${m.tipo === 'nota' ? `${ICONO.nota(14)} ` : ''}${escapeHtml(que)}</span>${detalle ? ` <span class="rep-momento-detalle">${escapeHtml(detalle)}</span>` : ''}</button></li>`
    })
    .join('')
  $('repMarcas').innerHTML = ms.map((m) => `<span class="rep-marca" data-tipo="${m.tipo}" style="--p: ${(m.foto / ultimo).toFixed(4)}"></span>`).join('')
}

function irAlSiguienteKo() {
  const m = siguienteKo(R.momentos, R.i)
  if (!m) return
  parar()
  ir(m.foto)
}

// La partida en números: la tabla de los dos, la carrera de premios (con
// su tabla debajo) y lo que más jugó cada uno.
function pintarNumeros() {
  const n = R.numeros
  const caja = $('repNumerosCuerpo')
  if (!n || !n.jugadores.length) return caja.replaceChildren()
  const [a, b] = n.jugadores
  const fila = (titulo, f) => `<tr><th scope="row">${titulo}</th><td>${f(n.por[a])}</td><td>${f(n.por[b])}</td></tr>`
  const golpe = (p) => (p.golpeMax ? `${p.golpeMax.danio} <span class="rep-numeros-nota">${escapeHtml(p.golpeMax.ataque)}</span>` : '—')
  const cabeza = `<thead><tr><th scope="col"><span class="sr-only">Dato</span></th><th scope="col">${chapaJugador(a)}</th><th scope="col">${chapaJugador(b)}</th></tr></thead>`
  const tabla = `<table class="rep-tabla rep-tabla-numeros">${cabeza}<tbody>
    ${fila('Daño hecho', (p) => p.danio)}
    ${fila('Golpe más fuerte', golpe)}
    ${fila('Pokémon noqueados', (p) => p.kos)}
    ${fila('Premios cogidos', (p) => p.premios)}
    ${fila('Cartas robadas', (p) => p.robadas)}
    ${fila('Entrenadores jugados', (p) => p.jugadas)}
    ${fila('Energías unidas', (p) => p.energias)}
    ${fila('Evoluciones', (p) => p.evoluciones)}
    ${fila('Retiradas', (p) => p.retiradas)}
  </tbody></table>`
  const carreraTabla = `<details class="rep-numeros-detalle"><summary>La carrera en tabla</summary><table class="rep-tabla">${cabeza.replace('<span class="sr-only">Dato</span>', 'Turno')}<tbody>${n.carrera
    .map((c) => `<tr><th scope="row">${c.turno ? `${c.turno}${c.de ? ` <span class="rep-numeros-nota">de ${escapeHtml(c.de)}</span>` : ''}` : 'Inicio'}</th><td>${c.premios[a]}</td><td>${c.premios[b]}</td></tr>`)
    .join('')}</tbody></table></details>`
  const lista = (nombre) => {
    const top = n.por[nombre].masJugadas.slice(0, 5)
    return `<div class="rep-numeros-lista"><h4>${chapaJugador(nombre)}</h4>${top.length ? `<ol>${top.map((x) => `<li><span>${escapeHtml(x.carta)}</span> <strong>×${x.veces}</strong></li>`).join('')}</ol>` : '<p class="rep-numeros-nota">No jugó ninguna carta de Entrenador.</p>'}</div>`
  }
  caja.innerHTML = `
    <div class="rep-numeros-rejilla">
      <div class="rep-numeros-bloque">${tabla}</div>
      <div class="rep-numeros-bloque">
        <h3 class="rep-numeros-sub">La carrera de premios</h3>
        <p class="rep-numeros-nota">Los premios que le quedan a cada uno al acabar cada turno.</p>
        <ul class="rep-carrera-leyenda">${n.jugadores.map((x) => `<li><span class="rep-carrera-clave" data-j="${colorDe(x)}" aria-hidden="true"></span>${chapaJugador(x)}</li>`).join('')}</ul>
        <div class="rep-carrera" id="repCarrera"></div>
        ${carreraTabla}
      </div>
      <div class="rep-numeros-bloque">
        <h3 class="rep-numeros-sub">Lo que más jugó cada uno</h3>
        <div class="rep-numeros-listas">${lista(a)}${lista(b)}</div>
      </div>
    </div>`
  pintarCarrera($('repCarrera'), n, {
    colorDe,
    alIr: (turno) => {
      const t = R.turnos[turno - 1]
      parar()
      ir(t ? t.foto : 0)
      $('repEscena').scrollIntoView({ block: 'start', behavior: menosMovimiento() ? 'auto' : 'smooth' })
    },
  })
}

// ════════════════════════════════════════════════════════════════════
// Los mazos, por lo que se vio (tanda 494)
// ════════════════════════════════════════════════════════════════════

// El catálogo de arquetipos y la Pokédex de los sprites son 25 KB que solo
// hacen falta con la partida ya puesta: se piden entonces, y una vez.
let modulosMazos = null
let mazosCargados = null
function cargarModulosDeMazos() {
  modulosMazos ||= Promise.all([import('./torneos/arquetipos.js'), import('./torneos/sprites-pokemon.js'), datos.catalogoDeArquetipos()])
    .then(([a, sp, catalogo]) => (mazosCargados = { ...a, ...sp, catalogo }))
    .catch((err) => {
      // Que la próxima partida lo vuelva a intentar.
      modulosMazos = null
      throw err
    })
  return modulosMazos
}

// Los minisprites de un arquetipo, como en /mis-partidas: los iconos del
// catálogo si lo es, y si no, las especies de su nombre. Si la imagen no
// llega, la cadena de respaldos (tanda 321) y al final se esconde.
function spritesDeArq(arq, clase = 'rep-sprite') {
  const m = mazosCargados
  if (!arq || !m) return ''
  let urls = (arq.iconos || []).map((i) => m.spriteDeCarta(i.nombre ?? i.name)).filter(Boolean)
  if (!urls.length) urls = m.dexesDeNombre(arq.nombre).slice(0, 2).map(m.urlDeSprite).filter(Boolean)
  return urls.map((u) => `<img class="${clase}" src="${escapeHtml(u)}" alt="" width="32" height="32" loading="lazy"${m.atributosDeRespaldo(u)} />`).join('')
}

async function pintarMazos() {
  if (!R.lectura) return
  const vez = R.vez
  const vistas = cartasVistas(R.fotos, cartaDe)
  try {
    await cargarModulosDeMazos()
  } catch {
    /* sin el catálogo el mazo se queda sin nombre: sus cartas, igual */
  }
  if (vez !== R.vez) return
  const m = mazosCargados
  R.mazos = Object.fromEntries(
    R.fotos[0].orden.map((n) => {
      const v = vistas[n] || []
      // Sin un solo Pokémon a la vista no hay de qué deducir un mazo:
      // «Sin identificar» lo dice con menos letras.
      const arq = m && v.some((x) => x.tipo === 'pokemon') ? m.arquetipoDeMazo(listaParaArquetipo(v, cartaDe, R.codigoDeSet), m.catalogo) : null
      return [n, { vistas: v, arq, entradas: entradasDelConstructor(v, cartaDe) }]
    })
  )
  pintarQuienes()
  pintarBloqueMazos()
  // Con las cartas ya encontradas cambia lo que se sabe de cada nombre: la
  // lista se vuelve a casar con lo visto.
  if (R.lista) ponerLista(R.lista.jugador, R.lista.nombre, R.lista.entradas)
  else await recuperarLista(vez)
}

// Los dos jugadores de la cabecera, con su mazo al lado en cuanto se sabe.
// En el orden de la mesa al abrirla: el del registro, abajo, primero.
function pintarQuienes() {
  const a = R.fotos[0].protagonista
  const b = elOtro(a)
  const mazo = (n) => {
    const arq = R.mazos?.[n]?.arq
    if (!arq) return ''
    return ` <span class="rep-mazo-mini" title="${escapeHtml(`Mazo de ${n}: ${arq.nombre}`)}">${spritesDeArq(arq, 'rep-sprite rep-sprite-mini')}<span class="rep-mazo-mini-nombre">${escapeHtml(arq.nombre)}</span></span>`
  }
  $('repQuienes').innerHTML = `${chapaJugador(a)}${mazo(a)} <span>contra</span> ${chapaJugador(b)}${mazo(b)}`
}

const SECCIONES = [
  ['pokemon', 'Pokémon'],
  ['entrenador', 'Entrenadores'],
  ['energia', 'Energías'],
]
const cartasTexto = (n) => `${n} ${n === 1 ? 'carta' : 'cartas'}`

function pintarBloqueMazos() {
  if (!R.mazos) return
  const a = R.fotos[0].protagonista
  $('repMazos').classList.remove('hidden')
  $('repMazosCuerpo').innerHTML = [a, elOtro(a)]
    .map((n) => {
      const { vistas, arq, entradas } = R.mazos[n]
      const total = totalVisto(vistas)
      const secciones = SECCIONES.map(([tipo, titulo]) => {
        const cartas = vistas.filter((v) => v.tipo === tipo)
        if (!cartas.length) return ''
        const suma = cartas.reduce((k, v) => k + v.copias, 0)
        return `<section class="rep-mazo-seccion"><h4>${titulo} <span class="rep-mazo-cuenta">${suma}</span></h4><ul>${cartas.map((v) => `<li><span class="rep-mazo-n">${v.copias}</span> <span>${escapeHtml(v.nombre)}</span></li>`).join('')}</ul></section>`
      }).join('')
      // Al constructor solo van las cartas encontradas en el catálogo: el
      // botón dice cuántas, que pueden ser menos que las vistas.
      const enConstructor = entradas.reduce((k, e) => k + e.n, 0)
      const enlace = entradas.length ? `/constructor?${new URLSearchParams({ l: codificarMazo(entradas), ...(arq ? { nombre: arq.nombre } : {}), de: 'repeticion' })}` : null
      return `<article class="rep-mazo">
        <header class="rep-mazo-cab">
          ${arq ? `<span class="rep-mazo-sprites">${spritesDeArq(arq)}</span>` : ''}
          <div class="rep-mazo-titulos">
            <h3 class="rep-mazo-nombre">${escapeHtml(arq?.nombre || 'Sin identificar')}</h3>
            <p class="rep-mazo-de">${chapaJugador(n, true)} <span>${total ? `se vieron ${total} de sus 60 cartas` : 'no enseñó ninguna carta'}</span></p>
          </div>
        </header>
        ${secciones ? `<div class="rep-mazo-secciones">${secciones}</div>` : ''}
        ${enlace ? `<a class="btn-secondary rep-mazo-abrir" href="${escapeHtml(enlace)}">Abrir en el constructor <span class="rep-mazo-nota">(${cartasTexto(enConstructor)})</span></a>` : ''}
        ${listaDelMazoHtml(n)}
      </article>`
    })
    .join('')
}

// Lo que se guarda en la base: el NOMBRE del mazo de cada uno, en el orden
// de los jugadores (`jugador_a` con `mazo_a`). Para etiquetar «Tus
// repeticiones» sin tener que traerse el registro.
const mazosParaGuardar = () => (R.mazos ? R.fotos[0].orden.map((n) => R.mazos[n]?.arq?.nombre || '') : null)

// ════════════════════════════════════════════════════════════════════
// Juega desde aquí (tanda 497)
// ════════════════════════════════════════════════════════════════════

// El laboratorio, «tú contra ti», con los dos mazos de la partida y la mesa
// de esta jugada (repeticiones/posicion.js). Se baja al pulsar: el motor y
// los efectos son mucho, y quien solo mira la repetición no los necesita.
async function jugarDesdeAqui() {
  const i = R.i
  if (!sePuedeJugarDesde(R.lectura, R.fotos, i)) return
  parar()
  const boton = document.querySelector('[data-accion="jugar"]')
  boton.disabled = true
  boton.dataset.abriendo = 'si'
  try {
    await R.resolviendo
    const orden = R.fotos[0].orden
    const mazos = mazosParaLaMesa(orden, cartasVistas(R.fotos, cartaDe))
    const { abrirLaboratorioEnPosicion } = await import('./constructor/laboratorio.js')
    await abrirLaboratorioEnPosicion({
      mazos: orden.map((n, k) => ({ nombre: R.mazos?.[n]?.arq ? `${n} (${R.mazos[n].arq.nombre})` : n, entradas: mazos[k].entradas })),
      nombres: orden,
      colocar: (mesa) => colocarPosicion(mesa, { lectura: R.lectura, fotos: R.fotos, i, idDe: Object.fromEntries(orden.map((n, k) => [n, mazos[k].idDe])), cartaDe }),
      aviso: (r) => `Partida cargada de una repetición: la jugada ${i}, en el turno ${r.turno} (de ${r.deQuien}).${r.sinVer ? ' Lo que no se vio en la partida sale como «Carta sin ver».' : ''}`,
      codigoDeSet: R.codigoDeSet,
      userId: R.sesion?.user?.id || null,
    })
  } catch (err) {
    showToast(`No se ha podido abrir el laboratorio: ${err.message}`, 'error')
  } finally {
    delete boton.dataset.abriendo
    pintarControles()
  }
}

// ════════════════════════════════════════════════════════════════════
// «¿Cómo encuentro una carta?» (tanda 554)
// ════════════════════════════════════════════════════════════════════
//
// El buscador de caminos del laboratorio (constructor/caminos.js) sobre la
// jugada que se mira: la misma mesa que «Jugar desde aquí», montada sin
// abrir el laboratorio. Solo para quien tiene el turno y solo si su mano
// se ve entera: con cartas de la mano sin ver, los caminos serían inventados.
const C = { mesa: null, quien: null, i: -1, secciones: [] }

function manoEnteraDe(f, quien) {
  const p = f?.jugadores?.[quien]
  return Boolean(p) && p.manoConocida.length >= p.mano
}

async function dialogoCaminos() {
  const i = R.i
  if (!sePuedeJugarDesde(R.lectura, R.fotos, i)) return
  parar()
  const f = R.fotos[i]
  const quien = f.deQuien
  const cuerpo = abrirDialogo('¿Cómo encuentro una carta?', `<p class="rep-dialogo-texto">Preparando la mesa de la jugada ${i}…</p>`)
  const vez = vezDialogo
  if (!manoEnteraDe(f, quien)) {
    cuerpo.innerHTML = `<p class="rep-dialogo-texto">Juega ${chapaJugador(quien, true)}, y su mano no se ve entera en el registro (solo se ve la de quien lo copió): sin saber qué tiene, no hay caminos que calcular.</p>`
    return
  }
  try {
    await R.resolviendo
    const orden = R.fotos[0].orden
    const mazos = mazosParaLaMesa(orden, cartasVistas(R.fotos, cartaDe))
    const [{ Mesa }, { EFECTOS }, nucleo] = await Promise.all([import('./constructor/partida.js'), import('./constructor/efectos.js'), import('./constructor/nucleo.js')])
    if (!sigueLaVentana(vez)) return
    const mesa = new Mesa({ mazos: mazos.map((m) => m.entradas), nombres: orden, efectos: EFECTOS, semilla: 0x51e7 + i })
    colocarPosicion(mesa, { lectura: R.lectura, fotos: R.fotos, i, idDe: Object.fromEntries(orden.map((n, k) => [n, mazos[k].idDe])), cartaDe })
    const k = orden.indexOf(quien)
    // Las cartas del mazo de quien juega, por nombre (sin la «sin ver»).
    const grupos = new Map()
    for (const e of mazos[k].entradas) {
      if (e.carta?.id === 'sin-ver') continue
      const clave = nucleo.claveDeNombre(e.carta)
      if (!grupos.has(clave)) grupos.set(clave, { clave, nombre: nucleo.nombreVisible(e.carta) })
    }
    Object.assign(C, { mesa, quien, i, grupos: [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), claveDeNombre: nucleo.claveDeNombre })
    const sinLista = R.lista?.jugador !== quien
    cuerpo.innerHTML = `
      <p class="rep-dialogo-texto">Juega ${chapaJugador(quien, true)} en la jugada ${i}. Elige la carta y te digo cada camino que tenía para traerla —objetos, partidarios y habilidades— con su probabilidad.</p>
      ${
        sinLista
          ? `<p class="rep-dialogo-texto">Sin su lista entera, el mazo de ${escapeHtml(quien)} es lo que se vio en la partida: las copias que no llegaron a salir no cuentan, así que las cifras se quedan cortas. <button type="button" class="link-btn" data-dlg="caminos-lista" data-jugador="${escapeHtml(quien)}">Es mi lista: elegir el mazo entero</button></p>`
          : ''
      }
      <div class="lab-caminos-elegir">
        <label class="lab-caminos-campo"><span>La carta</span><select id="repCaminosCarta">${C.grupos.map((g) => `<option value="${escapeHtml(g.clave)}">${escapeHtml(g.nombre)}</option>`).join('')}</select></label>
        <button type="button" class="btn-primary" data-dlg="caminos">${icons.search(16)} Buscar caminos</button>
      </div>
      <div class="lab-caminos-resultado" id="repCaminosResultado" role="status"></div>`
  } catch (err) {
    if (sigueLaVentana(vez)) cuerpo.innerHTML = `<p class="rep-dialogo-texto">No se ha podido montar la mesa: ${escapeHtml(err.message)}</p>`
  }
}

async function calcularCaminos(boton) {
  const cuerpo = $('repDialogoCuerpo')
  const clave = cuerpo.querySelector('#repCaminosCarta')?.value
  const grupo = C.grupos?.find((g) => g.clave === clave)
  if (!C.mesa || !grupo) return
  const caja = cuerpo.querySelector('#repCaminosResultado')
  boton.disabled = true
  caja.innerHTML = `<p class="lab-caminos-calculando">Jugando los caminos con ${escapeHtml(grupo.nombre)}…</p>`
  try {
    const [{ buscarCaminos }, { resultadoDeCaminosHtml }] = await Promise.all([import('./constructor/caminos.js'), import('./constructor/caminos-html.js')])
    const r = await buscarCaminos({
      partida: C.mesa.actual,
      objetivo: (c) => C.claveDeNombre(c) === clave,
      muestras: 400,
      ceder: () => new Promise((ok) => setTimeout(ok, 0)),
    })
    if (caja.isConnected) caja.innerHTML = resultadoDeCaminosHtml(r, grupo.nombre)
  } catch (err) {
    if (caja.isConnected) caja.innerHTML = `<p class="lab-caminos-vacio">No se han podido calcular: ${escapeHtml(err.message)}</p>`
  } finally {
    boton.disabled = false
  }
}

// ════════════════════════════════════════════════════════════════════
// Las notas del dueño (tanda 495)
// ════════════════════════════════════════════════════════════════════

// Cada nota va anclada a una LÍNEA del registro (`fila`): aquí se pone en
// la jugada que sale de ella. Si un día el lector deja de leer esa línea,
// la nota cae en la jugada de antes en vez de perderse.
function notasEnFotos(notas) {
  const ev = R.lectura?.eventos || []
  return (Array.isArray(notas) ? notas : [])
    .filter((n) => Number.isInteger(n?.fila) && typeof n.texto === 'string' && n.texto.trim())
    .map((n) => {
      let k = -1
      for (let i = 0; i < ev.length && ev[i].fila <= n.fila; i++) k = i
      return { fila: n.fila, texto: n.texto, foto: Math.max(1, k + 1) }
    })
    .sort((x, y) => x.foto - y.foto)
}

const notaDe = (i) => R.notas.find((n) => n.foto === i) || null
// Las notas las pone el dueño. Una partida pegada también ofrece el botón:
// es la forma de enterarse de que existen (y lleva a guardarla).
const puedeAnotar = () => !R.origen || Boolean(R.origen.mia)

function pintarNota() {
  const n = notaDe(R.i)
  const caja = $('repNota')
  caja.classList.toggle('hidden', !n)
  $('repNotaTexto').textContent = n ? n.texto : ''
}

async function cambiarNota(i, texto) {
  const ev = R.lectura.eventos[i - 1]
  if (!ev) throw new Error('Esa jugada no existe.')
  const otras = R.notas.filter((n) => n.foto !== i).map(({ fila, texto: t }) => ({ fila, texto: t }))
  const nuevas = (texto ? [...otras, { fila: ev.fila, texto }] : otras).sort((x, y) => x.fila - y.fila)
  if (nuevas.length > 300) throw new Error('Caben 300 notas por repetición: borra alguna antes de añadir otra.')
  const fila = await datos.guardarNotas(R.origen.id, nuevas)
  R.origen = { ...R.origen, notas: Array.isArray(fila.notas) ? fila.notas : nuevas }
  R.notas = notasEnFotos(R.origen.notas)
  pintarMomentos()
  ir(i, { anunciar: false })
}

function dialogoNota() {
  parar()
  if (!R.origen?.mia) {
    abrirDialogo(
      'Añadir una nota',
      `<p class="rep-dialogo-texto">Las notas van con la repetición guardada, para que las vea también quien la abra con su enlace. Guárdala primero y luego añade las que quieras.</p>
      <div class="rep-dialogo-botones"><button type="button" class="btn-primary" data-dlg="guardar">Guardar la repetición</button></div>`
    )
    return
  }
  // En la preparación (antes de la primera jugada) la nota va a la primera.
  const i = Math.max(1, R.i)
  const actual = notaDe(i)
  const linea = R.lectura.eventos[i - 1]?.linea || ''
  const cuerpo = abrirDialogo(
    actual ? 'Tu nota en esta jugada' : 'Añadir una nota',
    `<form class="rep-form" id="repFormNota">
      <p class="rep-dialogo-texto">En la jugada ${i}: «${escapeHtml(linea)}»</p>
      <label class="rep-campo">Tu nota
        <textarea id="repNotaCampo" maxlength="500" rows="4" required>${escapeHtml(actual?.texto || '')}</textarea>
      </label>
      <p class="rep-dialogo-texto">${R.origen.compartida ? 'La verá también quien abra la repetición con su enlace.' : 'Si la compartes, la verá también quien abra la repetición con su enlace.'}</p>
      <div class="rep-dialogo-botones">
        <button type="submit" class="btn-primary">Guardar la nota</button>
        ${actual ? '<button type="button" class="btn-secondary" data-dlg="borrar-nota">Borrar la nota</button>' : ''}
      </div>
      <p class="rep-dialogo-estado" role="status"></p>
    </form>`
  )
  cuerpo.dataset.nota = String(i)
  const campo = cuerpo.querySelector('#repNotaCampo')
  campo.focus()
  cuerpo.querySelector('#repFormNota').addEventListener('submit', async (e) => {
    e.preventDefault()
    const texto = campo.value.trim()
    if (!texto) return estadoDialogo('Escribe algo, o pulsa «Borrar la nota».', 'error')
    const boton = e.target.querySelector('[type=submit]')
    boton.disabled = true
    estadoDialogo('Guardando…')
    try {
      await cambiarNota(i, texto)
      $('repDialogo').close()
      showToast('Nota guardada.', 'success')
    } catch (err) {
      estadoDialogo(err.message, 'error')
      boton.disabled = false
    }
  })
}

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
  R.momentos = momentosDe(lectura, R.fotos)
  R.numeros = numerosDe(lectura, R.fotos)
  R.mazos = null
  R.lista = null
  R.notas = notasEnFotos(origen?.notas)
  R.abajo = R.fotos[0].protagonista
  R.i = 0
  R.cacheHtml = new WeakMap()
  if (!conservarDireccion) ponerDireccion(origen?.id ? `/repeticiones?r=${encodeURIComponent(origen.id)}` : '/repeticiones')

  const [a, b] = [R.abajo, elOtro(R.abajo)]
  pintarQuienes()
  $('repMazos').classList.add('hidden')
  $('repResumen').textContent = `${R.turnos.length} ${R.turnos.length === 1 ? 'turno' : 'turnos'} · ${lectura.eventos.length} jugadas`
  const sinLeer = lectura.sinLeer.length
  $('repSinLeer').textContent = sinLeer ? `${sinLeer} ${sinLeer === 1 ? 'línea no se ha entendido' : 'líneas no se han entendido'}: ${sinLeer === 1 ? 'sale' : 'salen'} en el registro, pero no ${sinLeer === 1 ? 'mueve' : 'mueven'} la mesa.` : ''
  $('repSinLeer').classList.toggle('hidden', !sinLeer)
  pintarCabecera()

  $('repPegar').classList.add('hidden')
  $('repSala').classList.remove('hidden')
  pintarRegistro()
  pintarMomentos()
  pintarNumeros()
  pintarMazos()
  ir(0, { anunciar: false })
  $('repAnuncio').textContent = `Repetición de ${a} contra ${b}, ${R.turnos.length} turnos.`
  // A la MESA, no a la cabecera: en un portátil, mesa y controles caben
  // justos debajo de la barra de arriba, y la cabecera queda a un gesto.
  $('repEscena').scrollIntoView({ block: 'start', behavior: menosMovimiento() ? 'auto' : 'smooth' })
  document.querySelector('[data-accion="reproducir"]')?.focus({ preventScroll: true })
  // Se reproduce sola: es lo que se ha pedido.
  reproducir()
  R.resolviendo = resolverCartas(nombresDe(lectura), R.vez)
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

// Cada ventana que se abre es una VEZ nueva. Las que esperan algo (los
// mazos, la base, el vídeo) miran al volver si siguen siendo la que está
// abierta: si no, lo que traen es de otra, y escribirlo pisaría la de
// ahora (abrir «Guardar» mientras «¿Cómo encuentro…?» esperaba las cartas
// acababa con los caminos dentro de la ventana de guardar).
let vezDialogo = 0
const sigueLaVentana = (vez) => vez === vezDialogo && $('repDialogo').open

function abrirDialogo(titulo, html) {
  vezDialogo++
  $('repDialogoTitulo').textContent = titulo
  $('repDialogoCuerpo').innerHTML = html
  // Lo que escuchaba la ventana de antes (los turnos del vídeo) no es de esta.
  $('repDialogoCuerpo').onchange = null
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

// ¿Quién eres en esta partida? (tanda 494) El nombre de TCG Live se
// recuerda en este navegador: quien guarda partidas suele ser el mismo.
const CLAVE_YO = 'pokedoc-repeticion-yo'
function yoRecordado() {
  try {
    return localStorage.getItem(CLAVE_YO) || null
  } catch {
    return null
  }
}
function recordarYo(nombre) {
  try {
    localStorage.setItem(CLAVE_YO, nombre)
  } catch {
    /* sin almacenamiento: se pregunta la próxima vez */
  }
}

// Quién sale marcado: el nombre recordado si juega esta partida; si se
// recuerda OTRO, nadie (estás mirando la partida de alguien); y si no se
// recuerda ninguno, el del registro, que es quien lo copió.
function yoPorDefecto() {
  const jugadores = R.fotos[0].orden
  const recordado = yoRecordado()
  if (recordado && jugadores.includes(recordado)) return recordado
  return recordado ? '' : R.fotos[0].protagonista
}

const ganadorDeLaPartida = () => R.fotos.at(-1)?.fin?.ganador || null

// El resultado DESDE `yo` (tanda 553): el que dice el registro; si no lo
// dice —se cortó antes del final—, null, y se pregunta en la ventana. Un
// resultado inventado ensucia tus números, así que nunca se supone.
const resultadoDesde = (yo, ganador = ganadorDeLaPartida()) => (!yo || !ganador ? null : ganador === yo ? 'win' : 'loss')
const COMO_ACABO = { win: 'ganada', loss: 'perdida', draw: 'empate' }

// La fila de /mis-partidas, con las MISMAS claves de mazo que una partida
// de torneo (claveDeArquetipo), para que caigan en la misma casilla.
function partidaParaApuntar(yo, replayId, resultado = resultadoDesde(yo)) {
  const rival = elOtro(yo)
  const arqYo = R.mazos?.[yo]?.arq || null
  const arqRival = R.mazos?.[rival]?.arq || null
  const clave = (arq) => (arq && mazosCargados ? mazosCargados.claveDeArquetipo(arq) : 'sin-mazo')
  return {
    user_id: R.sesion.user.id,
    mi_mazo: clave(arqYo),
    rival_mazo: clave(arqRival),
    mi_mazo_nombre: arqYo?.nombre || 'Sin identificar',
    rival_mazo_nombre: arqRival?.nombre || 'Sin identificar',
    resultado,
    tipo: 'normal',
    donde: 'TCG Live',
    replay_id: replayId,
  }
}

function textoDeApuntar(yo, resultado) {
  if (!yo) return 'Apuntarla en tus partidas sueltas (antes, dinos cuál de los dos eres)'
  if (!resultado) return 'Apuntarla en tus partidas sueltas (antes, dinos cómo acabó)'
  const p = partidaParaApuntar(yo, null, resultado)
  return `Apuntarla en tus partidas sueltas de «Mis partidas» como ${COMO_ACABO[resultado]}: ${p.mi_mazo_nombre} contra ${p.rival_mazo_nombre}`
}

// ¿Quién eres? (tanda 553) Cada jugador con el mazo que se le vio y quién
// ganó: con eso delante se elige sin dudar, y es justo lo que se apunta.
function quienHtml(yo, ganador) {
  const opcion = (j) => {
    const arq = R.mazos?.[j]?.arq
    return `<label class="rep-ritmo-opcion rep-quien-opcion"><input type="radio" name="repYo" value="${escapeHtml(j)}"${j === yo ? ' checked' : ''} /> ${chapaJugador(j, true)} <span class="rep-quien-mazo">${escapeHtml(arq?.nombre || 'Mazo sin identificar')}</span>${j === ganador ? ` <span class="rep-quien-gana">${icons.trophy(14)} ganó</span>` : ''}</label>`
  }
  const comoAcabo = ganador
    ? ''
    : `<fieldset class="rep-ritmo" id="repResultado">
        <legend>El registro no dice quién ganó (¿se cortó antes del final?). ¿Cómo acabó para ti?</legend>
        ${[
          ['win', 'La gané'],
          ['loss', 'La perdí'],
          ['draw', 'Empate'],
        ]
          .map(([v, t]) => `<label class="rep-ritmo-opcion"><input type="radio" name="repResultado" value="${v}" /> ${t}</label>`)
          .join('')}
      </fieldset>`
  const resultado = resultadoDesde(yo, ganador)
  return `<fieldset class="rep-ritmo" id="repQuien">
      <legend>¿Cuál de los dos eres tú?</legend>
      ${R.fotos[0].orden.map(opcion).join('')}
      <label class="rep-ritmo-opcion"><input type="radio" name="repYo" value=""${yo ? '' : ' checked'} /> Ninguno: solo la estoy mirando</label>
    </fieldset>
    ${comoAcabo}
    <div id="repApuntarCaja">
      <label class="rep-check">
        <input type="checkbox" id="repApuntar"${yo && resultado ? ' checked' : ' disabled'} />
        <span id="repApuntarTexto">${escapeHtml(textoDeApuntar(yo, resultado))}</span>
      </label>
    </div>`
}

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
  const ganador = ganadorDeLaPartida()
  const yo = yoPorDefecto()
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
      <div id="repQuienCaja"><p class="rep-dialogo-texto">Mirando los mazos de cada uno…</p></div>
      <div class="rep-dialogo-botones">
        <button type="submit" class="btn-primary">${mia ? 'Guardar los cambios' : 'Guardar'}</button>
      </div>
      <p class="rep-dialogo-estado" role="status"></p>
    </form>`
  )
  cuerpo.querySelector('#repTitulo').select()
  // Lo que se apunta: quién eres y cómo acabó. El resultado sale del
  // registro, o de lo que se marque si el registro no lo dice.
  const elegidoAhora = () => cuerpo.querySelector('[name=repYo]:checked')?.value || ''
  const resultadoAhora = (elegido) => resultadoDesde(elegido, ganador) || (elegido ? cuerpo.querySelector('[name=repResultado]:checked')?.value || null : null)
  cuerpo.onchange = (e) => {
    if (e.target.name !== 'repYo' && e.target.name !== 'repResultado') return
    const caja = cuerpo.querySelector('#repApuntar')
    if (!caja) return
    const elegido = elegidoAhora()
    const resultado = resultadoAhora(elegido)
    const puede = Boolean(elegido && resultado)
    // Al quedar todo dicho se marca sola; sin poderse, se desmarca.
    if (puede && caja.disabled) caja.checked = true
    caja.disabled = !puede
    if (!puede) caja.checked = false
    cuerpo.querySelector('#repApuntarTexto').textContent = textoDeApuntar(elegido, resultado)
  }
  // Los mazos se deducen por detrás al abrir la partida: si aún no están,
  // se espera, porque son justo lo que se apunta (si no, «Sin identificar»).
  ;(R.mazos ? Promise.resolve() : pintarMazos())
    .catch(() => {})
    .then(async () => {
      const caja = cuerpo.querySelector('#repQuienCaja')
      if (!caja || !cuerpo.isConnected) return
      caja.innerHTML = quienHtml(yo, ganador)
      // Una guardada que ya se apuntó no se apunta otra vez (la base
      // tampoco lo dejaría): se dice, y con el enlace.
      if (!mia) return
      const ya = await datos.partidaApuntada(R.sesion.user.id, o.id).catch(() => false)
      if (!ya || !caja.isConnected) return
      caja.innerHTML = '<p class="rep-dialogo-texto">Ya está apuntada en tus partidas sueltas de <a href="/mis-partidas">Mis partidas</a>.</p>'
    })
  cuerpo.querySelector('#repFormGuardar').addEventListener('submit', async (e) => {
    e.preventDefault()
    const boton = e.target.querySelector('[type=submit]')
    const titulo = cuerpo.querySelector('#repTitulo').value.trim() || tituloPorDefecto()
    const compartida = cuerpo.querySelector('#repCompartirla').checked
    const elegido = elegidoAhora()
    const resultado = resultadoAhora(elegido)
    const apuntarla = Boolean(elegido && resultado) && Boolean(cuerpo.querySelector('#repApuntar')?.checked)
    boton.disabled = true
    estadoDialogo('Guardando…')
    try {
      let fila
      if (mia) {
        fila = await datos.renombrar(o.id, titulo)
        if (Boolean(o.compartida) !== compartida) fila = await datos.compartir(o.id, compartida)
        R.origen = { ...o, titulo: fila.titulo, compartida: fila.compartida }
        // Una guardada de antes de los mazos (tanda 494) los recibe al
        // guardar los cambios: es la misma partida, así que solo los añade.
        const mazos = mazosParaGuardar()
        if (!o.mazos?.some(Boolean) && mazos?.some(Boolean)) {
          datos
            .guardar({ registro: R.texto, mazos })
            .then(() => {
              R.origen = { ...R.origen, mazos }
              cargarGuardadas()
            })
            .catch(() => {})
        }
      } else {
        const mazos = mazosParaGuardar()
        fila = await datos.guardar({ registro: R.texto, titulo, ...resumenDeLaPartida(), compartida, mazos })
        R.origen = { id: fila.id, titulo, mia: true, compartida: fila.compartida, notas: [], mazos }
      }
      if (elegido) recordarYo(elegido)
      let aviso = mia ? 'Cambios guardados.' : 'Guardada en «Tus repeticiones».'
      let tipo = 'success'
      if (apuntarla) {
        try {
          const r = await datos.apuntarPartida(partidaParaApuntar(elegido, R.origen.id, resultado))
          aviso = r.ya ? `${aviso} La partida ya estaba en «Mis partidas».` : mia ? 'Cambios guardados y partida apuntada en «Mis partidas».' : 'Guardada y apuntada en tus partidas sueltas de «Mis partidas».'
        } catch (err) {
          aviso = `${aviso} Pero no se ha podido apuntar en «Mis partidas»: ${err.message}`
          tipo = 'error'
        }
      }
      ponerDireccion(`/repeticiones?r=${encodeURIComponent(R.origen.id)}`)
      pintarCabecera()
      // Ya guardada, el botón de las notas lleva a escribir una.
      pintarMomentos()
      pintarControles()
      $('repDialogo').close()
      showToast(aviso, tipo)
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
  const vez = vezDialogo
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
        const mazos = mazosParaGuardar()
        const fila = await datos.guardar({ registro: R.texto, titulo: tituloPorDefecto(), ...resumenDeLaPartida(), compartida: true, mazos })
        R.origen = { id: fila.id, titulo: o?.titulo || tituloPorDefecto(), mia: true, compartida: fila.compartida, notas: [], mazos }
        cargarGuardadas()
        pintarMomentos()
      }
      url = datos.enlaceCorto(R.origen.id)
      ponerDireccion(`/repeticiones?r=${encodeURIComponent(R.origen.id)}`)
      pintarCabecera()
      texto = 'Está guardada en «Tus repeticiones» y compartida: la abre cualquiera que tenga el enlace (nadie puede buscarla).'
      mas = '<button type="button" class="link-btn" data-dlg="dejar">Dejar de compartirla</button>'
    }
  } catch (err) {
    // Sin la migración (o sin red), el enlace corto sin guardar, o el largo.
    url = null
    texto = err.falta ? '' : `No se ha podido guardar para compartir (${err.message}). `
  }
  if (!url) {
    // Sin cuenta (tanda 591): la partida, comprimida, se guarda en PokeDoc
    // sin ningún dato de quien la manda, y el enlace lleva ocho letras. Si
    // eso no se puede, el largo de siempre, que no guarda nada en ningún
    // sitio. Y quien prefiere ese, lo tiene a un botón.
    const carga = await empaquetar(R.texto)
    const largo = `${location.origin}/repeticiones#${carga}`
    try {
      url = enlaceCortoDe('repeticion', await acortar('repeticion', carga))
      texto += 'Enlace corto: la partida se guarda en PokeDoc (sin ningún dato tuyo) para que quepa en un mensaje, y quien lo abra la ve igual.'
      mas = '<button type="button" class="link-btn" data-dlg="largo">Usar el enlace largo, con la partida dentro</button>'
      cuerpo.dataset.largo = largo
    } catch {
      url = largo
      texto += 'Este enlace lleva la partida DENTRO: no se guarda en ningún sitio, y quien lo abra la ve igual.'
      if (url.length > 2000) texto += ` Es largo (${url.length.toLocaleString('es-ES')} caracteres): en Discord no cabe en un mensaje.`
    }
    if (!R.sesion) {
      texto += ' Con una cuenta, además, la tienes en «Tus repeticiones».'
      mas += enlacesDeEntrar()
    }
  }
  if (!sigueLaVentana(vez)) return
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
    // a mano… si el campo con ESE enlace está a la vista. Desde la lista o
    // desde un puzle no lo está (o es el de otra ventana ya cerrada), y
    // decir «ya está seleccionado» sería mentira: entonces se enseña.
    const campo = [...document.querySelectorAll('#repEnlace, #repPuzleEnlace')].find((x) => x.value === url && x.getClientRects().length)
    if (campo) {
      campo.focus()
      campo.select()
      showToast('Cópialo a mano: ya está seleccionado.', 'info')
    } else showToast(`No se ha podido copiar solo. El enlace: ${url}`, 'info')
  }
}

// ── El vídeo ──

let urlVideo = null

const formatoTiempo = (seg) => {
  const s = Math.round(seg)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const nombreDeFichero = ({ formato = 'horizontal', tramo = null } = {}) =>
  `repeticion-${plano(`${R.abajo}-contra-${elOtro(R.abajo)}`).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}${formato === 'vertical' ? '-vertical' : ''}${tramo ? `-${tramo}` : ''}`

// El trozo del vídeo (tanda 493): de qué turno a qué turno, en fotos. «Desde
// el turno 6» es la foto en que empieza; «hasta el turno 8», la última
// antes de que empiece el 9 (o el final de la partida).
function tramoElegido(cuerpo) {
  const ultimo = R.fotos.length - 1
  const desde = Number(cuerpo.querySelector('#repDesde')?.value || 0)
  const hasta = Number(cuerpo.querySelector('#repHasta')?.value ?? R.turnos.length)
  const ini = desde === 0 ? 0 : R.turnos[desde - 1]?.foto ?? 0
  const fin = hasta >= R.turnos.length ? ultimo : (R.turnos[hasta]?.foto ?? ultimo + 1) - 1
  const entero = ini === 0 && fin === ultimo
  return { desde: ini, hasta: Math.max(ini, fin), nombre: entero ? null : desde === hasta ? `turno-${desde}` : `turnos-${desde}-${hasta}` }
}

let videoEnMarcha = null
async function dialogoVideo() {
  const cuerpo = abrirDialogo('Descargar en vídeo', '<p class="rep-dialogo-texto">Mirando qué sabe hacer tu navegador…</p>')
  const vez = vezDialogo
  let V
  let codec
  try {
    V = await import('./repeticiones/video.js')
    codec = await V.codecDisponible()
  } catch (err) {
    if (sigueLaVentana(vez)) cuerpo.innerHTML = `<p class="rep-dialogo-texto">No se ha podido preparar el vídeo: ${escapeHtml(err.message)}</p>`
    return
  }
  if (!sigueLaVentana(vez)) return
  const grabadora = codec ? null : V.grabadoraDisponible()
  if (!codec && !grabadora) {
    cuerpo.innerHTML = '<p class="rep-dialogo-texto">Este navegador no sabe hacer vídeos. Prueba con Chrome, Edge o Safari al día.</p>'
    return
  }
  // Lo que dura cada ritmo CON el trozo elegido (y con las notas, si van):
  // cambia al elegir otro.
  const duracion = (r) => {
    const { desde, hasta } = tramoElegido(cuerpo)
    const t = V.tramoDe(R.fotos, desde, hasta)
    // La casilla aún no existe mientras se pinta la ventana, y nace marcada.
    const casilla = cuerpo.querySelector('#repVideoNotas')
    const conNotas = casilla ? casilla.checked : R.notas.length > 0
    const extraDe = conNotas ? (k) => esperaDeNota(notaDe(t.desde + k)) : null
    return V.lineaDeTiempo(t.fotos, esperaDe, r, { cierre: t.cierre, extraDe }).reduce((x, y) => x + y.duracion, 0)
  }
  const opcion = (r, nombre, marcada) =>
    `<label class="rep-ritmo-opcion"><input type="radio" name="repRitmo" value="${r}"${marcada ? ' checked' : ''} /><span><strong>${nombre}</strong> · <span data-dura="${r}">${formatoTiempo(duracion(r))}</span></span></label>`
  const formato = (valor, nombre, detalle, marcada) =>
    `<label class="rep-ritmo-opcion"><input type="radio" name="repFormato" value="${valor}"${marcada ? ' checked' : ''} /><span><strong>${nombre}</strong> · ${detalle}</span></label>`
  // «Desde»: el principio o el turno en que empieza. «Hasta»: el turno en
  // que acaba, y el último es «el final».
  const T = R.turnos.length
  const turno = (k) => `Turno ${k} · ${escapeHtml(R.turnos[k - 1].jugador)}`
  const opcionesDesde = [`<option value="0" selected>El principio</option>`, ...R.turnos.map((_, k) => `<option value="${k + 1}">${turno(k + 1)}</option>`)].join('')
  const opcionesHasta = R.turnos.map((_, k) => (k + 1 === T ? `<option value="${T}" selected>El final (turno ${T})</option>` : `<option value="${k + 1}">${turno(k + 1)}</option>`)).join('')
  cuerpo.innerHTML = `
    <p class="rep-dialogo-texto">Se hace en tu navegador y se descarga en tu equipo: no se sube a ninguna parte.${
      codec
        ? ` Sale en MP4${codec.caja === 'avc1' ? ' (H.264, el que se ve en todas partes)' : ' (VP9)'} y tarda unos segundos.`
        : ` Este navegador lo graba en TIEMPO REAL: tarda lo que dure el vídeo, y mientras tanto no cambies de pestaña.${grabadora.extension === 'webm' ? ' Y solo sabe hacer WebM, no MP4.' : ''}`
    }</p>
    <fieldset class="rep-ritmo">
      <legend>Formato</legend>
      ${formato('horizontal', 'Horizontal', '16:9, para YouTube o un ordenador', true)}${formato('vertical', 'Vertical', '9:16, para TikTok, Reels y Shorts', false)}
    </fieldset>
    <fieldset class="rep-ritmo rep-tramo">
      <legend>Qué trozo</legend>
      <label class="rep-tramo-campo"><span>Desde</span><select id="repDesde">${opcionesDesde}</select></label>
      <label class="rep-tramo-campo"><span>Hasta</span><select id="repHasta">${opcionesHasta}</select></label>
    </fieldset>
    <fieldset class="rep-ritmo">
      <legend>En el vídeo, además</legend>
      <label class="rep-check"><input type="checkbox" id="repVideoBarra" checked /> <span>Una barra abajo con los turnos y los KO marcados</span></label>
      ${
        R.notas.length
          ? `<label class="rep-check"><input type="checkbox" id="repVideoNotas" checked /> <span>${R.notas.length === 1 ? 'La nota' : `Las ${R.notas.length} notas`} de la repetición, cada una el rato que se tarda en leerla</span></label>`
          : ''
      }
    </fieldset>
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
  // Un «hasta» antes del «desde» se corrige solo, y las duraciones se
  // vuelven a contar con el trozo nuevo.
  cuerpo.onchange = (e) => {
    const desde = cuerpo.querySelector('#repDesde')
    const hasta = cuerpo.querySelector('#repHasta')
    if (!desde || !hasta || !e.target.closest('#repDesde, #repHasta, #repVideoNotas')) return
    if (Number(hasta.value) < Number(desde.value)) {
      if (e.target === desde) hasta.value = desde.value === '0' ? '1' : desde.value
      else desde.value = hasta.value
    }
    cuerpo.querySelectorAll('[data-dura]').forEach((x) => (x.textContent = formatoTiempo(duracion(Number(x.dataset.dura)))))
  }
}

async function hacerVideo() {
  const cuerpo = $('repDialogoCuerpo')
  const ritmo = Number(cuerpo.querySelector('input[name="repRitmo"]:checked')?.value) || 2
  const formato = cuerpo.querySelector('input[name="repFormato"]:checked')?.value === 'vertical' ? 'vertical' : 'horizontal'
  const tramo = tramoElegido(cuerpo)
  const campos = cuerpo.querySelectorAll('input[name="repRitmo"], input[name="repFormato"], #repDesde, #repHasta, #repVideoBarra, #repVideoNotas')
  const conNotas = Boolean(cuerpo.querySelector('#repVideoNotas')?.checked)
  const conBarra = Boolean(cuerpo.querySelector('#repVideoBarra')?.checked)
  const progreso = cuerpo.querySelector('#repVideoProgreso')
  const barra = progreso.querySelector('[role="progressbar"]')
  cuerpo.querySelector('[data-dlg="hacer-video"]').disabled = true
  campos.forEach((x) => (x.disabled = true))
  progreso.classList.remove('hidden')
  const senal = { cancelado: false }
  videoEnMarcha = senal
  parar()
  try {
    // Dentro del try: si el módulo no llega, los controles vuelven y la
    // barra se va, en vez de quedarse todo desactivado.
    const V = await import('./repeticiones/video.js')
    const r = await V.hacerVideo({
      fotos: R.fotos,
      ritmo,
      senal,
      formato,
      desde: tramo.desde,
      hasta: tramo.hasta,
      M: { abajo: R.abajo, psDe, letraDe: (n) => letraDeEnergia(n) || 'C', colorDe, fuentesDe, esperaDe },
      // Al revés para que, si dos caen en la misma foto, gane la primera,
      // que es la que enseña el reproductor (notaDe).
      notas: conNotas ? new Map([...R.notas].reverse().map((n) => [n.foto, n.texto])) : null,
      esperaDeNota: (texto) => esperaDeNota({ texto }),
      barra: conBarra,
      alAvanzar: (fase, x) => {
        const pct = Math.round((fase === 'imagenes' ? x * 0.1 : 0.1 + x * 0.9) * 100)
        barra.setAttribute('aria-valuenow', String(pct))
        barra.style.setProperty('--pct', `${pct}%`)
        estadoDialogo(fase === 'imagenes' ? 'Preparando las cartas…' : `Haciendo el vídeo… ${pct} %`)
      },
    })
    // El vídeo anterior se suelta: son varios megas que, si no, se quedan
    // en memoria toda la visita.
    if (urlVideo) URL.revokeObjectURL(urlVideo)
    const url = (urlVideo = URL.createObjectURL(r.blob))
    const fichero = `${nombreDeFichero({ formato, tramo: tramo.nombre })}.${r.extension}`
    const mb = (r.blob.size / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })
    progreso.classList.add('hidden')
    estadoDialogo('')
    cuerpo.querySelector('.rep-dialogo-botones').innerHTML = `<a class="btn-primary" href="${url}" download="${escapeHtml(fichero)}" data-dlg="descargar">${ICONO.descargar(16)} Descargar ${escapeHtml(fichero)} (${mb} MB)</a>`
    cuerpo.querySelector('[data-dlg="descargar"]').click()
    estadoDialogo('Listo: si no se ha descargado solo, pulsa el botón.', 'ok')
  } catch (err) {
    progreso.classList.add('hidden')
    cuerpo.querySelector('[data-dlg="hacer-video"]').disabled = false
    campos.forEach((x) => (x.disabled = false))
    estadoDialogo(err.name === 'AbortError' ? 'Cancelado.' : `No se ha podido hacer el vídeo: ${err.message}`, err.name === 'AbortError' ? '' : 'error')
  } finally {
    videoEnMarcha = null
  }
}

// ════════════════════════════════════════════════════════════════════
// La imagen para redes (tanda 513)
// ════════════════════════════════════════════════════════════════════

// La que se ve en la ventana ahora: { url, blob, fichero }. Cada repintado
// sube `vez`, y lo que llega tarde de uno anterior no pisa al nuevo.
let imagenResumen = null
let vezImagen = 0
function soltarImagen() {
  if (imagenResumen) URL.revokeObjectURL(imagenResumen.url)
  imagenResumen = null
}

async function dialogoImagen() {
  const rival = elOtro(R.abajo)
  const cuerpo = abrirDialogo(
    'Imagen para redes',
    `<p class="rep-dialogo-texto">Quién ganó, con qué mazos, la carrera de premios y tres números de la partida, en 1080 × 1350: el tamaño de un post vertical de Instagram.</p>
    <img class="rep-resumen-vista" id="repResumenVista" width="1080" height="1350" loading="lazy" alt="Vista previa de la imagen" />
    <label class="rep-check">
      <input type="checkbox" id="repResumenEsconder" />
      <span>Esconder el nombre de ${chapaJugador(rival, true)} (sale como «Rival»)</span>
    </label>
    <div class="rep-dialogo-botones">
      <button type="button" class="btn-primary" data-dlg="bajar-imagen" disabled>${ICONO.descargar(16)} Descargar</button>
      <button type="button" class="btn-secondary hidden" data-dlg="compartir-imagen" disabled>${icons.share(16)} Compartir en…</button>
    </div>
    <p class="rep-dialogo-estado" role="status">Preparando la imagen…</p>`
  )
  const vezD = vezDialogo
  // Los mazos se deducen por detrás al abrir la partida: si la ventana llega
  // antes, se esperan, que «Mazo sin identificar» tiene que ser verdad.
  if (!R.mazos) await pintarMazos()
  if (!sigueLaVentana(vezD)) return
  const pintarla = async () => {
    const vez = ++vezImagen
    const botones = cuerpo.querySelectorAll('[data-dlg="bajar-imagen"], [data-dlg="compartir-imagen"]')
    botones.forEach((b) => (b.disabled = true))
    estadoDialogo('Preparando la imagen…')
    try {
      const m = await import('./repeticiones/resumen-imagen.js')
      const d = m.datosDelResumen({
        numeros: R.numeros,
        momentos: R.momentos,
        mazos: R.mazos,
        titulo: R.origen?.titulo || tituloPorDefecto(),
        izquierda: R.abajo,
        protagonista: R.fotos[0].protagonista,
        esconder: cuerpo.querySelector('#repResumenEsconder').checked ? rival : null,
      })
      if (!d) throw new Error('A esta partida le faltan los dos jugadores.')
      const blob = await m.blobDe(await m.dibujarResumen(d))
      if (vez !== vezImagen || !sigueLaVentana(vezD)) return
      soltarImagen()
      imagenResumen = { blob, url: URL.createObjectURL(blob), fichero: m.nombreDeFichero(d.titulo) }
      const vista = cuerpo.querySelector('#repResumenVista')
      vista.src = imagenResumen.url
      vista.alt = `Vista previa: ${d.ganador ? `gana ${d.ganador.nombre}` : 'sin ganador en el registro'}, ${d.jugadores.map((j) => `${j.nombre}${j.mazo ? ` con ${j.mazo}` : ''}`).join(' contra ')}.`
      const archivo = new File([blob], imagenResumen.fichero, { type: 'image/png' })
      const compartir = cuerpo.querySelector('[data-dlg="compartir-imagen"]')
      compartir.classList.toggle('hidden', !navigator.canShare?.({ files: [archivo] }))
      botones.forEach((b) => (b.disabled = false))
      estadoDialogo('')
    } catch (err) {
      if (vez === vezImagen && sigueLaVentana(vezD)) estadoDialogo(`No se ha podido hacer la imagen: ${err.message}`, 'error')
    }
  }
  cuerpo.onchange = (e) => {
    if (e.target.id === 'repResumenEsconder') void pintarla()
  }
  await pintarla()
}

function bajarImagen() {
  if (!imagenResumen) return
  const a = document.createElement('a')
  a.href = imagenResumen.url
  a.download = imagenResumen.fichero
  a.click()
}

async function compartirImagen() {
  if (!imagenResumen) return
  try {
    await navigator.share({ files: [new File([imagenResumen.blob], imagenResumen.fichero, { type: 'image/png' })], title: tituloPorDefecto() })
  } catch {
    /* cancelado por quien comparte: nada que decir */
  }
}

// ════════════════════════════════════════════════════════════════════
// Tu lista, asociada a la partida (tanda 519)
// ════════════════════════════════════════════════════════════════════
//
// El registro solo cuenta lo que pasa por la mesa. Con la lista entera de
// uno de los dos se sabe también lo que NO ha salido —lo que queda entre el
// mazo y los premios—, y con eso: qué probabilidad había de robar cada
// carta en cada jugada, qué salió de sus premios, y «Jugar desde aquí» con
// sus cartas de verdad en vez de «Carta sin ver».
//
// Se recuerda en ESTE navegador (por partida), sin tocar la base: la lista
// es tuya y la repetición puede ser de cualquiera.
const CLAVE_LISTAS = 'pokedoc-rep-listas'
const MAX_LISTAS = 60

// La partida: su id si está guardada; si no, una huella de su texto.
function claveDeLaPartida() {
  if (R.origen?.id) return `r:${R.origen.id}`
  let h = 2166136261
  for (let i = 0; i < R.texto.length; i++) h = Math.imul(h ^ R.texto.charCodeAt(i), 16777619) >>> 0
  return `t:${h.toString(36)}:${R.texto.length}`
}
function leerListas() {
  try {
    const x = JSON.parse(localStorage.getItem(CLAVE_LISTAS) || '{}')
    return x && typeof x === 'object' ? x : {}
  } catch {
    return {}
  }
}
function escribirListas(todas) {
  try {
    // Las más viejas fuera: esto no es un archivo, es una memoria corta.
    const claves = Object.keys(todas).sort((a, b) => (todas[a].cuando || 0) - (todas[b].cuando || 0))
    while (claves.length > MAX_LISTAS) delete todas[claves.shift()]
    localStorage.setItem(CLAVE_LISTAS, JSON.stringify(todas))
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
}

function ponerLista(jugador, nombre, entradas) {
  const vistas = R.mazos?.[jugador]?.vistas || cartasVistas(R.fotos, cartaDe)[jugador] || []
  R.lista = { jugador, nombre, ...mazoConLista(entradas, vistas, cartaDe), entradas }
  R.cacheHtml = new WeakMap()
  pintarBloqueMazos()
  pintar()
}

async function recuperarLista(vez) {
  const guardada = leerListas()[claveDeLaPartida()]
  if (!guardada || !R.fotos[0].orden.includes(guardada.jugador)) return
  try {
    const mapa = await cartasPorIds(guardada.cartas.map(([id]) => id))
    if (vez !== R.vez) return
    const entradas = guardada.cartas.filter(([id]) => mapa.get(id)).map(([id, n]) => ({ carta: mapa.get(id), n }))
    if (entradas.length) ponerLista(guardada.jugador, guardada.nombre, entradas)
  } catch {
    /* sin red, la partida se ve igual que sin lista */
  }
}

function quitarLista() {
  const todas = leerListas()
  delete todas[claveDeLaPartida()]
  escribirListas(todas)
  R.lista = null
  R.cacheHtml = new WeakMap()
  pintarBloqueMazos()
  pintar()
}

// Debajo del mazo de cada uno: el botón, o lo que dice su lista.
function listaDelMazoHtml(n) {
  const L = R.lista
  if (!L || L.jugador !== n) {
    return `<button type="button" class="link-btn rep-milista-boton" data-lista-de="${escapeHtml(n)}">${L ? `No, es la de ${escapeHtml(n)}: elegir su lista` : 'Es mi lista: elegir el mazo entero'}</button>`
  }
  const fuera = L.fuera.reduce((k, f) => k + f.copias, 0)
  const premios = premiosCogidos(R.lectura.eventos, n)
  const alFinal = sinVerEnLaFoto(L.entradas, R.fotos.at(-1), n)
  const lista = (cartas) => cartas.map((c) => `${c.n ?? ''}${c.n ? ' ' : ''}${escapeHtml(c.nombre)}`).join(', ')
  return `<div class="rep-milista">
      <p><strong>Con su lista: ${escapeHtml(L.nombre)}</strong> <button type="button" class="link-btn" data-lista-quitar>Quitar</button></p>
      ${fuera ? `<p class="rep-milista-aviso">${cartasTexto(fuera)} de la partida no ${fuera === 1 ? 'está' : 'están'} en esta lista (${escapeHtml(L.fuera.map((f) => f.nombre).join(', '))}): ¿es la lista de esta partida?</p>` : ''}
      <p><strong>De sus premios salieron:</strong> ${premios.cartas.length ? escapeHtml(premios.cartas.join(', ')) : 'nada que el registro enseñe'}${premios.ocultas ? ` (y ${premios.ocultas} sin nombre en el registro)` : ''}.</p>
      ${alFinal.total ? `<p><strong>Sin ver al acabar</strong> (en el mazo o en los premios que no cogió): ${lista(alFinal.cartas)}.</p>` : ''}
    </div>`
}

// En cada jugada, para quien tiene la lista: qué le queda sin ver y qué
// probabilidad tiene de robar cada cosa en su próximo robo.
const porciento = (x) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0).replace('.', ',')} %`
function pintarProbabilidades() {
  const caja = $('repProb')
  if (!caja) return
  const L = R.lista
  if (!L) {
    caja.classList.add('hidden')
    return
  }
  const { cartas, total } = sinVerEnLaFoto(L.entradas, foto(), L.jugador)
  caja.classList.remove('hidden')
  const fila = (c) => `<li><span class="rep-prob-nombre">${escapeHtml(c.nombre)}</span><span class="rep-prob-barra" aria-hidden="true"><span style="--pct: ${Math.round(probabilidadDeRobar(c.n, total) * 100)}%"></span></span><span class="rep-prob-cifra">${c.n} de ${total} · ${porciento(probabilidadDeRobar(c.n, total))}</span></li>`
  poner(
    caja,
    `<h3 class="rep-momentos-titulo">El mazo de ${escapeHtml(L.jugador)} en esta jugada</h3>
    ${
      total
        ? `<p class="rep-prob-texto">Le quedan ${cartasTexto(total)} sin ver, entre el mazo y los premios. Lo que puede salirle en su próximo robo:</p>
           <ol class="rep-prob-lista">${cartas.slice(0, 8).map(fila).join('')}</ol>
           ${cartas.length > 8 ? `<details class="rep-prob-mas"><summary>Las ${cartas.length - 8} demás</summary><ol class="rep-prob-lista">${cartas.slice(8).map(fila).join('')}</ol></details>` : ''}`
        : '<p class="rep-prob-texto">Ya ha salido toda su lista.</p>'
    }`
  )
}

async function dialogoLista(jugador) {
  const cuerpo = abrirDialogo(
    `La lista de ${jugador}`,
    `<p class="rep-dialogo-texto">Con su lista entera se ve lo que NO ha salido en la partida: la probabilidad de robar cada carta en cada jugada, qué salió de sus premios, y «Jugar desde aquí» con sus cartas en vez de «Carta sin ver». Se recuerda en este navegador.</p>
    <div id="repListaMios">${R.sesion ? '<p class="rep-dialogo-texto">Cargando tus mazos…</p>' : '<p class="rep-dialogo-texto">Entra en tu cuenta para elegir uno de tus mazos guardados, o pega la lista.</p>'}</div>
    <label class="rep-campo">O pega la lista (la de TCG Live, Limitless o PokeDoc)
      <textarea id="repListaTexto" rows="6" spellcheck="false" placeholder="Pokémon: 12&#10;4 Dreepy TWM 128&#10;…"></textarea>
    </label>
    <div class="rep-dialogo-botones"><button type="button" class="btn-primary" data-dlg="lista-texto">Usar esta lista</button></div>
    <p class="rep-dialogo-estado" role="status"></p>`
  )
  cuerpo.dataset.jugador = jugador
  if (!R.sesion) return
  try {
    const filas = await misMazos(R.sesion.user.id)
    cuerpo._mios = filas
    const caja = cuerpo.querySelector('#repListaMios')
    if (!caja) return
    caja.innerHTML = filas.length
      ? `<p class="rep-dialogo-texto">Tus mazos:</p><div class="rep-milista-mazos">${filas
          .map((f, k) => `<button type="button" class="btn-secondary rep-milista-mazo" data-dlg="lista-mio" data-k="${k}"><strong>${escapeHtml(f.name || 'Mazo sin nombre')}</strong> <span>${cartasTexto((f.cards || []).reduce((t, c) => t + (Number(c.n) || 0), 0))}</span></button>`)
          .join('')}</div>`
      : '<p class="rep-dialogo-texto">No tienes mazos guardados: pega la lista.</p>'
  } catch (err) {
    const caja = cuerpo.querySelector('#repListaMios')
    if (caja) caja.innerHTML = `<p class="rep-dialogo-texto">No se han podido cargar tus mazos: ${escapeHtml(err.message || 'error de red')}.</p>`
  }
}

async function usarLista(boton) {
  const cuerpo = $('repDialogoCuerpo')
  const jugador = cuerpo.dataset.jugador
  boton.disabled = true
  estadoDialogo('Buscando las cartas…')
  try {
    let nombre
    let entradas
    if (boton.dataset.dlg === 'lista-mio') {
      const f = cuerpo._mios[Number(boton.dataset.k)]
      nombre = f.name || 'Mazo sin nombre'
      const piezas = (f.cards || []).filter((c) => c?.id && c.n > 0)
      const mapa = await cartasPorIds(piezas.map((c) => c.id))
      entradas = piezas.filter((c) => mapa.get(c.id)).map((c) => ({ carta: mapa.get(c.id), n: c.n }))
    } else {
      const { lineas } = leerLista(cuerpo.querySelector('#repListaTexto').value)
      if (!lineas.length) throw new Error('No encuentro ninguna carta: cada línea empieza por la cantidad («4 Dreepy TWM 128»).')
      nombre = 'Lista pegada'
      const { resueltas } = await resolverLineas(lineas)
      entradas = resueltas.map((r) => ({ carta: r.carta, n: r.linea.n }))
    }
    const total = entradas.reduce((t, e) => t + e.n, 0)
    if (!total) throw new Error('No se ha encontrado ninguna de sus cartas en el catálogo.')
    if (total > 60) throw new Error(`Tiene ${total} cartas: un mazo son 60.`)
    const todas = leerListas()
    todas[claveDeLaPartida()] = { jugador, nombre, cartas: entradas.map((e) => [e.carta.id, e.n]), cuando: Date.now() }
    escribirListas(todas)
    ponerLista(jugador, nombre, entradas)
    $('repDialogo').close()
    showToast(total < 60 ? `Lista puesta (${total} cartas: lo que falta hasta 60 cuenta como «sin ver»).` : 'Lista puesta.', 'success')
  } catch (err) {
    estadoDialogo(err.message, 'error')
    boton.disabled = false
  }
}

// ════════════════════════════════════════════════════════════════════
// Publicar como partida de ejemplo (tanda 520)
// ════════════════════════════════════════════════════════════════════
//
// Sale en la ficha de su mazo en /meta (supabase-migration-repeticiones-
// galeria.sql). Se publica una COPIA con los nombres cambiados por Rojo y
// Azul (repeticiones/anonimizar.js): el rival no ha dicho que quiera salir
// en una galería. La casilla viene marcada; desmarcarla es decisión tuya.
let publicando = null // { anon, ids, nombres } de la ventana abierta

async function dialogoPublicar() {
  if (!R.sesion) {
    abrirDialogo('Publicar como partida de ejemplo', `<p class="rep-dialogo-texto">Para publicar una partida hace falta una cuenta.</p>${enlacesDeEntrar()}`)
    return
  }
  const cuerpo = abrirDialogo('Publicar como partida de ejemplo', '<p class="rep-dialogo-texto">Mirando sus mazos…</p>')
  const vez = vezDialogo
  if (!R.mazos) await pintarMazos()
  if (!sigueLaVentana(vez)) return
  const orden = R.fotos[0].orden
  const arqs = orden.map((n) => R.mazos?.[n]?.arq || null)
  // Solo los del catálogo tienen ficha en /meta: los que se deducen de las
  // cartas («Mega Greninja ex Dragapult ex») no tienen dónde salir.
  const delMeta = arqs.filter((a) => a?.id)
  if (!delMeta.length) {
    cuerpo.innerHTML = '<p class="rep-dialogo-texto">Ninguno de los dos mazos es de los del meta, así que no saldría en ninguna ficha de /meta. Se publican partidas de los mazos que salen allí.</p>'
    return
  }
  // Antes de guardar la copia: sin la migración se quedaría sin publicar.
  const puesta = await datos.galeriaPuesta()
  if (!sigueLaVentana(vez)) return
  if (!puesta) {
    cuerpo.innerHTML = `<p class="rep-dialogo-texto">${escapeHtml(datos.SIN_GALERIA)}</p>`
    return
  }
  const { anonimizar } = await import('./repeticiones/anonimizar.js')
  if (!sigueLaVentana(vez)) return
  const anon = anonimizar(R.texto, R.fotos[0].protagonista)
  publicando = { anon, ids: delMeta.map((a) => a.id), nombres: delMeta.map((a) => a.nombre) }
  const fichas = delMeta.map((a) => `<a href="/meta/${encodeURIComponent(a.id)}">${escapeHtml(a.nombre)}</a>`).join(' y en la de ')
  const notas = R.origen?.mia && R.notas.length ? ` Van también tus ${R.notas.length === 1 ? 'nota' : `${R.notas.length} notas`}.` : ''
  cuerpo.innerHTML = `
    <p class="rep-dialogo-texto">Saldrá en la ficha de ${fichas} en /meta, como partida de ejemplo, y la podrá abrir cualquiera.${notas}</p>
    <label class="rep-check">
      <input type="checkbox" id="repPublicarAnonima"${anon.error ? ' disabled' : ' checked'} />
      <span>Cambiar los nombres de los jugadores por Rojo y Azul (el rival no ha dicho que quiera salir en una galería)</span>
    </label>
    ${anon.error ? `<p class="rep-dialogo-texto">No se pueden cambiar los nombres: ${escapeHtml(anon.error)}</p>` : ''}
    <div class="rep-dialogo-botones"><button type="button" class="btn-primary" data-dlg="publicar">Publicar</button></div>
    <p class="rep-dialogo-estado" role="status"></p>`
}

async function publicar(boton) {
  const p = publicando
  if (!p) return
  const cuerpo = $('repDialogoCuerpo')
  const anonima = Boolean(cuerpo.querySelector('#repPublicarAnonima')?.checked)
  boton.disabled = true
  estadoDialogo('Publicando…')
  try {
    const orden = R.fotos[0].orden
    const nombre = (n) => (anonima ? p.anon.de[n] : n)
    const mazos = orden.map((n) => R.mazos?.[n]?.arq?.nombre || '')
    const ganador = ganadorDeLaPartida()
    // Sin cambiar los nombres, la «copia» de una repetición tuya ES la tuya
    // (la base no guarda dos veces el mismo texto): guardarla otra vez solo
    // le cambiaba el título. Se publica tal cual, con su título y sus notas.
    const propia = !anonima && R.origen?.mia && R.origen.id
    const fila = propia
      ? { id: R.origen.id }
      : await datos.guardar({
          registro: anonima ? p.anon.texto : R.texto,
          titulo: `${mazos[0] || nombre(orden[0])} contra ${mazos[1] || nombre(orden[1])}`.slice(0, 120),
          jugadores: orden.map(nombre),
          ganador: ganador ? nombre(ganador) : null,
          turnos: R.turnos.length,
          compartida: true,
          mazos,
        })
    // Las notas son de las líneas del registro, y cambiar los nombres no
    // cambia cuántas hay: valen en la copia… con los nombres cambiados
    // también en su texto, que el «Rojo y Azul» lo promete la casilla.
    if (!propia && R.origen?.mia && R.origen.notas?.length) {
      // Como palabra entera: el nombre «Ana» no se cambia dentro de «Banana».
      const palabra = (n) => new RegExp(`(?<![\\p{L}\\p{N}_])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'gu')
      const cambiar = (t) => (anonima ? Object.entries(p.anon.de).reduce((x, [real, alias]) => x.replace(palabra(real), alias), String(t ?? '')) : t)
      await datos.guardarNotas(fila.id, R.origen.notas.map((n) => ({ ...n, texto: cambiar(n.texto) })))
    }
    await datos.publicar(fila.id, true, p.ids)
    if (propia) R.origen = { ...R.origen, compartida: true }
    $('repDialogo').close()
    showToast(`Publicada: sale en la ficha de ${p.nombres.join(' y en la de ')} en /meta.`, 'success')
    cargarGuardadas()
  } catch (err) {
    estadoDialogo(err.message, 'error')
    boton.disabled = false
  }
}

// ════════════════════════════════════════════════════════════════════
// Puzles «¿Qué jugarías?» (tanda 521)
// ════════════════════════════════════════════════════════════════════
//
// Hacer uno: la jugada que se está mirando de una repetición TUYA. Abrir
// uno (/repeticiones?puzle=…): la mesa en esa jugada y nada de lo que viene
// después —ni el registro, ni los momentos, ni los números, ni las teclas—
// hasta que se contesta (supabase-migration-repeticiones-puzles.sql).
const P = { activo: false, puzle: null, respondido: false }

function dialogoPuzle() {
  parar()
  if (!R.sesion) {
    abrirDialogo('Hacer un puzle de esta jugada', `<p class="rep-dialogo-texto">Para hacer puzles hace falta una cuenta.</p>${enlacesDeEntrar()}`)
    return
  }
  if (!R.origen?.mia) {
    abrirDialogo(
      'Hacer un puzle de esta jugada',
      `<p class="rep-dialogo-texto">El puzle enseña la mesa de una repetición guardada: guarda antes la repetición y vuelve a esta jugada.</p>
      <div class="rep-dialogo-botones"><button type="button" class="btn-primary" data-dlg="guardar">Guardar la repetición</button></div>`
    )
    return
  }
  // Lo que pasó justo después, para tenerlo delante al escribir las opciones.
  const despues = R.fotos.slice(R.i + 1, R.i + 4).map((f) => f.linea).filter(Boolean)
  const opcion = (k) => `<div class="rep-puzle-opcion-campo">
      <input type="radio" name="repPuzleBuena" value="${k}" id="repPuzleBuena${k}"${k === 0 ? ' checked' : ''} aria-label="La opción ${k + 1} es la buena" />
      <input type="text" id="repPuzleOpcion${k}" maxlength="120" placeholder="Opción ${k + 1}${k > 1 ? ' (si quieres)' : ''}" aria-label="Opción ${k + 1}" />
    </div>`
  abrirDialogo(
    'Hacer un puzle de esta jugada',
    `<form class="rep-form" id="repFormPuzle">
      <p class="rep-dialogo-texto">Quien lo abra verá la mesa en esta jugada (y nada de lo que viene después), la pregunta y las opciones. Al elegir, le dirás cuál era la buena y por qué.</p>
      ${despues.length ? `<p class="rep-dialogo-texto"><strong>Lo que se jugó después:</strong> ${escapeHtml(despues.join(' · '))}</p>` : ''}
      <label class="rep-campo">La pregunta
        <input type="text" id="repPuzlePregunta" maxlength="200" value="¿Qué jugarías aquí?" />
      </label>
      <fieldset class="rep-ritmo">
        <legend>Las opciones (marca la buena)</legend>
        ${[0, 1, 2, 3].map(opcion).join('')}
      </fieldset>
      <label class="rep-campo">Por qué es la buena
        <textarea id="repPuzleExplicacion" maxlength="1000" rows="3"></textarea>
      </label>
      <div class="rep-dialogo-botones"><button type="button" class="btn-primary" data-dlg="crear-puzle">Hacer el puzle</button></div>
      <p class="rep-dialogo-estado" role="status"></p>
    </form>`
  )
}

async function crearPuzle(boton) {
  const cuerpo = $('repDialogoCuerpo')
  const campos = [0, 1, 2, 3].map((k) => cuerpo.querySelector(`#repPuzleOpcion${k}`).value.trim())
  const buena = Number(cuerpo.querySelector('input[name="repPuzleBuena"]:checked')?.value ?? 0)
  // Las vacías se quitan, y la buena se cuenta entre las que quedan.
  const opciones = campos.filter(Boolean)
  const correcta = campos.slice(0, buena).filter(Boolean).length
  const pregunta = cuerpo.querySelector('#repPuzlePregunta').value.trim()
  const explicacion = cuerpo.querySelector('#repPuzleExplicacion').value.trim()
  if (opciones.length < 2) return estadoDialogo('Hacen falta de 2 a 4 opciones.', 'error')
  if (!campos[buena]) return estadoDialogo('La que marcas como buena está vacía.', 'error')
  if (pregunta.length < 3) return estadoDialogo('Escribe la pregunta.', 'error')
  if (explicacion.length < 3) return estadoDialogo('Explica por qué es la buena: es lo que se aprende.', 'error')
  boton.disabled = true
  try {
    const id = await datos.crearPuzle({ repeticion: R.origen.id, foto: R.i, pregunta, opciones, correcta, explicacion })
    R.origen = { ...R.origen, compartida: true }
    pintarCabecera()
    cargarGuardadas()
    const url = `${location.origin}/repeticiones?puzle=${encodeURIComponent(id)}`
    cuerpo.innerHTML = `<p class="rep-dialogo-texto">Hecho. Este es su enlace: quien lo abra verá la mesa en esta jugada y tus opciones.</p>
      <div class="rep-enlace">
        <label class="sr-only" for="repPuzleEnlace">Enlace del puzle</label>
        <input type="text" id="repPuzleEnlace" readonly value="${escapeHtml(url)}" />
        <button type="button" class="btn-primary" data-dlg="copiar">${icons.link(16)} Copiar</button>
      </div>`
    cuerpo.dataset.url = url
  } catch (err) {
    estadoDialogo(err.message, 'error')
    boton.disabled = false
  }
}

async function abrirPuzle(id) {
  let puzle
  try {
    puzle = await datos.leerPuzle(id)
  } catch (err) {
    return mostrarError(err.message)
  }
  if (!puzle) return mostrarError('Este puzle no existe o ya no se comparte.')
  // Sin tocar la dirección: con «?r=» quien recargara (o copiara el enlace)
  // abriría la partida ENTERA, que es la solución del puzle.
  await abrirGuardada(puzle.replay_id, { conservarDireccion: true })
  if ($('repSala').classList.contains('hidden')) return
  P.activo = true
  P.puzle = puzle
  P.respondido = false
  document.documentElement.classList.add('rep-puzle')
  parar()
  ir(Math.min(puzle.foto, R.fotos.length - 1), { anunciar: false })
  pintarPuzle()
  $('repPuzle').querySelector('[data-opcion]')?.focus({ preventScroll: true })
}

function pintarPuzle(solucion = null) {
  const caja = $('repPuzle')
  const pz = P.puzle
  caja.classList.remove('hidden')
  if (!solucion) {
    caja.innerHTML = `<h2 class="rep-puzle-pregunta">${escapeHtml(pz.pregunta)}</h2>
      <p class="rep-dialogo-texto">Juega ${escapeHtml(foto().deQuien || '')}. Elige una:</p>
      <div class="rep-puzle-opciones">${pz.opciones.map((o, k) => `<button type="button" class="btn-secondary rep-puzle-opcion" data-opcion="${k}">${escapeHtml(o)}</button>`).join('')}</div>`
    return
  }
  const total = solucion.recuento.reduce((a, b) => a + b, 0)
  const acierto = solucion.elegida === solucion.correcta
  const fila = (o, k) => {
    const n = solucion.recuento[k] || 0
    const pctDe = total ? Math.round((n / total) * 100) : 0
    // Cuál es la buena y cuál elegiste tú, dicho con palabras (no solo con
    // la negrita, que en la lista no distinguía «la tuya» de las demás).
    const marcas = [k === solucion.correcta ? 'la buena' : '', k === solucion.elegida ? 'la tuya' : ''].filter(Boolean)
    return `<li class="${k === solucion.correcta ? 'rep-puzle-buena' : ''}${k === solucion.elegida ? ' rep-puzle-tuya' : ''}"><span>${escapeHtml(o)}${marcas.length ? ` <span class="rep-puzle-marca">(${marcas.join(' y ')})</span>` : ''}</span><span class="rep-prob-barra" aria-hidden="true"><span style="--pct: ${pctDe}%"></span></span><span class="rep-prob-cifra">${pctDe} %</span></li>`
  }
  caja.innerHTML = `<h2 class="rep-puzle-pregunta">${escapeHtml(pz.pregunta)}</h2>
    <div class="rep-puzle-solucion" role="status">
      <p class="rep-puzle-veredicto" data-acierto="${acierto ? 'si' : 'no'}"><strong>${acierto ? '¡Bien!' : `No: la buena era «${escapeHtml(pz.opciones[solucion.correcta])}».`}</strong></p>
      <p>${escapeHtml(solucion.explicacion)}</p>
      <p class="rep-dialogo-texto">Lo que eligió la gente (${total} ${total === 1 ? 'respuesta' : 'respuestas'}):</p>
      <ol class="rep-prob-lista rep-puzle-recuento">${pz.opciones.map(fila).join('')}</ol>
      <button type="button" class="btn-primary" data-accion="verComoSiguio">Ver cómo siguió</button>
    </div>`
}

async function responderPuzle(k) {
  if (P.respondido) return
  P.respondido = true
  $('repPuzle').querySelectorAll('[data-opcion]').forEach((b) => (b.disabled = true))
  try {
    const r = await datos.responderPuzle(P.puzle.id, k)
    pintarPuzle({ ...r, elegida: k })
    $('repPuzle').querySelector('[data-accion="verComoSiguio"]')?.focus({ preventScroll: true })
  } catch (err) {
    P.respondido = false
    $('repPuzle').querySelectorAll('[data-opcion]').forEach((b) => (b.disabled = false))
    showToast(err.message, 'error')
  }
}

function verComoSiguio() {
  document.documentElement.classList.remove('rep-puzle')
  P.activo = false
  $('repPuzle').classList.add('hidden')
  pintar()
  $('repEscena').scrollIntoView({ block: 'start', behavior: menosMovimiento() ? 'auto' : 'smooth' })
  reproducir()
}

// La lista de los recientes, encima de «Tus repeticiones»: la ve cualquiera.
async function cargarPuzles() {
  const filas = await datos.listaDePuzles(12)
  const caja = $('repPuzles')
  if (!filas || !filas.length) return caja.classList.add('hidden')
  caja.classList.remove('hidden')
  caja.querySelector('ol').innerHTML = filas
    .map((f) => {
      const sub = [f.autor ? `de ${f.autor}` : '', `${f.respuestas} ${f.respuestas === 1 ? 'respuesta' : 'respuestas'}`, f.respuestas ? `${Math.round((f.aciertos / f.respuestas) * 100)} % de aciertos` : ''].filter(Boolean).join(' · ')
      return `<li class="rep-puzle-item"><a href="/repeticiones?puzle=${encodeURIComponent(f.id)}">${escapeHtml(f.pregunta)}</a><span class="rep-item-sub">${escapeHtml(sub)}</span></li>`
    })
    .join('')
}

// ════════════════════════════════════════════════════════════════════
// El modo stream (tanda 517)
// ════════════════════════════════════════════════════════════════════
//
// PINGU, de la lista de ideas: «un modo para OBS: la mesa a pantalla
// completa, fondo plano y todo con el teclado». La mesa se queda SOLA,
// escalada a lo que mida la ventana (una captura de OBS es de 1920×1080,
// y la mesa de la página mide la mitad), sobre un fondo de un color: el de
// la mesa, o verde de croma para quitarlo en OBS. Los controles NO salen en
// la captura: la ayuda y el botón de salir asoman al mover el ratón y se
// van solos.
//
// Para OBS se abre con la dirección: /repeticiones?r=…&stream (y
// &fondo=verde), como «fuente de navegador».
const FONDOS_STREAM = ['mesa', 'verde']
const S = { activo: false, fondo: 'mesa', temporizador: null, observador: null }

function entrarStream({ fondo = S.fondo } = {}) {
  if ($('repSala').classList.contains('hidden')) return
  S.activo = true
  S.fondo = FONDOS_STREAM.includes(fondo) ? fondo : 'mesa'
  const html = document.documentElement
  html.classList.add('rep-stream')
  html.dataset.fondoStream = S.fondo
  let ayuda = $('repStreamAyuda')
  if (!ayuda) {
    ayuda = document.createElement('div')
    ayuda.id = 'repStreamAyuda'
    ayuda.className = 'rep-stream-ayuda'
    ayuda.setAttribute('role', 'region')
    ayuda.setAttribute('aria-label', 'Modo stream')
    $('repEscena').append(ayuda)
  }
  pintarAyudaStream()
  S.observador?.disconnect()
  if ('ResizeObserver' in window) {
    // La escena mide lo que la ventana (está fija a sus cuatro bordes) y el
    // tapete lo que lleva dentro: con los dos, cualquier cambio vuelve a
    // encajar la mesa, sin escuchar además la ventana.
    S.observador = new ResizeObserver(() => ajustarStream())
    S.observador.observe($('repTapete'))
    S.observador.observe($('repEscena'))
  }
  ajustarStream()
  verAyudaStream()
  // El foco, a la escena: si se queda en el botón que la abrió (debajo,
  // tapado), el Espacio lo pulsaría a él en vez de reproducir.
  const escena = $('repEscena')
  escena.tabIndex = -1
  escena.focus({ preventScroll: true })
}

function pintarAyudaStream() {
  const ayuda = $('repStreamAyuda')
  if (!ayuda) return
  const obs = R.origen?.id && R.origen.compartida ? `${location.origin}/repeticiones?r=${encodeURIComponent(R.origen.id)}&stream${S.fondo === 'verde' ? '&fondo=verde' : ''}` : ''
  ayuda.innerHTML = `
    <p><strong>Modo stream</strong> · Espacio: reproducir · ← →: jugada · Mayús + ← →: turno · N: siguiente KO · G: girar la mesa · B: fondo ${S.fondo === 'verde' ? 'de la mesa' : 'verde'} · F: pantalla completa · Esc: salir</p>
    ${obs ? `<p class="rep-stream-obs">En OBS, como fuente de navegador: <code>${escapeHtml(obs)}</code></p>` : ''}
    <button type="button" class="btn-secondary rep-stream-salir" data-accion="salirStream">Salir del modo stream</button>`
}

function salirStream() {
  if (!S.activo) return
  S.activo = false
  clearTimeout(S.temporizador)
  S.observador?.disconnect()
  S.observador = null
  const html = document.documentElement
  html.classList.remove('rep-stream', 'rep-stream-raton')
  delete html.dataset.fondoStream
  $('repStreamAyuda')?.remove()
  $('repEscena').removeAttribute('tabindex')
  const juego = document.querySelector('.rep-juego')
  for (const v of ['--k', '--x', '--y']) juego?.style.removeProperty(v)
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  document.querySelector('[data-accion="stream"]')?.focus({ preventScroll: true })
}

// La mesa a su tamaño de siempre, escalada entera a lo que quepa en la
// ventana y centrada. Se mide sin escalar: una transformación no cambia lo
// que mide la caja, así que la cuenta no se persigue a sí misma.
function ajustarStream() {
  if (!S.activo) return
  const juego = document.querySelector('.rep-juego')
  const w = juego.offsetWidth
  const h = juego.offsetHeight
  if (!w || !h) return
  const k = Math.min((innerWidth - 32) / w, (innerHeight - 32) / h)
  juego.style.setProperty('--k', String(k))
  juego.style.setProperty('--x', `${Math.round((innerWidth - w * k) / 2)}px`)
  juego.style.setProperty('--y', `${Math.round((innerHeight - h * k) / 2)}px`)
}

// La ayuda asoma al mover el ratón (o al pulsar una tecla) y se va sola a
// los tres segundos: lo que se captura es la mesa, no los controles. Con un
// temporizador y no con una animación (tanda 313).
function verAyudaStream() {
  if (!S.activo) return
  document.documentElement.classList.add('rep-stream-raton')
  clearTimeout(S.temporizador)
  // Con el foco dentro (alguien llegó con el teclado al botón) se queda
  // igual: lo dice la hoja con `:focus-within`.
  S.temporizador = setTimeout(() => document.documentElement.classList.remove('rep-stream-raton'), 3000)
}

function cambiarFondoStream() {
  S.fondo = S.fondo === 'verde' ? 'mesa' : 'verde'
  document.documentElement.dataset.fondoStream = S.fondo
  pintarAyudaStream()
  verAyudaStream()
}

function pantallaCompleta() {
  if (document.fullscreenElement) return document.exitFullscreen().catch(() => {})
  document.documentElement.requestFullscreen?.().catch(() => showToast('Este navegador no deja ponerla a pantalla completa.', 'error'))
}

function girarMesa() {
  R.abajo = elOtro(R.abajo)
  R.cacheHtml = new WeakMap()
  pintar()
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
  // El mazo de cada uno, en el orden de los jugadores (tanda 494). Las
  // guardadas de antes no lo tienen y no dicen nada.
  const mazos = r.mazo_a || r.mazo_b ? `<span class="rep-item-mazos">${escapeHtml(r.mazo_a || 'Sin identificar')} <span class="rep-item-contra">contra</span> ${escapeHtml(r.mazo_b || 'Sin identificar')}</span>` : ''
  return `
    <li class="rep-item" data-id="${id}" data-titulo="${escapeHtml(r.titulo)}" data-compartida="${r.compartida ? 'si' : 'no'}">
      <button type="button" class="rep-item-abrir" data-abrir="${id}">
        <span class="rep-item-titulo">${escapeHtml(r.titulo)}</span>
        ${mazos}
        <span class="rep-item-sub">${escapeHtml(sub)}</span>
      </button>
      ${r.compartida ? `<span class="rep-chapa-compartida">${icons.link(14)} Compartida</span>` : ''}
      ${r.publica && r.compartida ? `<span class="rep-chapa-compartida">${icons.users(14)} Publicada</span>` : ''}
      <div class="rep-item-acciones">
        <button type="button" class="link-btn" data-copiar="${id}">${r.compartida ? 'Copiar enlace' : 'Compartir'}</button>
        ${r.compartida ? `<button type="button" class="link-btn" data-privada="${id}">Dejar de compartir</button>` : ''}
        ${r.publica && r.compartida ? `<button type="button" class="link-btn" data-despublicar="${id}">Quitar de la galería</button>` : ''}
        <button type="button" class="link-btn rep-item-borrar" data-borrar="${id}">Borrar</button>
      </div>
    </li>`
}

async function abrirGuardada(id, { conservarDireccion = false } = {}) {
  mostrarError('')
  try {
    const fila = await datos.leer(id)
    if (!fila) {
      mostrarError('Esta repetición no existe o ya no se comparte.')
      volverAPegar()
      return
    }
    cargar(fila.registro, {
      origen: { id, titulo: fila.titulo, mia: Boolean(fila.mia), compartida: Boolean(fila.compartida), notas: fila.notas || [], mazos: [fila.mazo_a || null, fila.mazo_b || null] },
      conservarDireccion,
    })
  } catch (err) {
    mostrarError(err.falta ? 'Esta repetición no se puede abrir todavía: la parte de guardar no está puesta en la base.' : `No se ha podido abrir la repetición: ${err.message}`)
    volverAPegar()
  }
}

// Un enlace corto (tanda 591). Tres finales distintos y cada uno se dice:
// no se ha podido preguntar, no existe, o es de una POSICIÓN (que se abre
// en el laboratorio, que es lo suyo).
async function abrirCorto(id) {
  let fila
  try {
    fila = await leerCorto(id)
  } catch (err) {
    mostrarError(err.message)
    volverAPegar()
    return false
  }
  if (!fila) {
    mostrarError('Este enlace no existe: ¿se copió entero?')
    volverAPegar()
    return false
  }
  if (fila.tipo === 'posicion') {
    location.replace(`/laboratorio#${fila.carga}`)
    return false
  }
  const texto = await desempaquetar(fila.carga)
  if (!texto) {
    mostrarError('El enlace de esta repetición está roto o incompleto.')
    volverAPegar()
    return false
  }
  cargar(texto, { conservarDireccion: true })
  return true
}

async function accionDeLista(e) {
  const b = e.target.closest('button')
  if (!b) return
  const id = b.dataset.abrir || b.dataset.copiar || b.dataset.privada || b.dataset.borrar || b.dataset.despublicar
  if (!id) return
  try {
    if (b.dataset.abrir) return abrirGuardada(id)
    if (b.dataset.despublicar) {
      await datos.publicar(id, false)
      showToast('Quitada de la galería. Sigue compartida: su enlace se abre igual.', 'success')
      return cargarGuardadas()
    }
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
  document.querySelector('.rep-nota-icono').innerHTML = ICONO.nota(18)

  // La ventana de guardar, compartir y el vídeo.
  $('repDialogo').addEventListener('click', async (e) => {
    const d = $('repDialogo')
    if (e.target === d || e.target.closest('[data-cerrar]')) return d.close()
    if (e.target.closest('[data-pendiente]')) return guardarPendiente()
    const b = e.target.closest('[data-dlg]')
    if (!b) return
    const url = $('repDialogoCuerpo').dataset.url
    if (b.dataset.dlg === 'copiar') return copiarEnlace(url, b)
    if (b.dataset.dlg === 'largo') {
      // El de siempre, con la partida dentro. (El corto ya está hecho y no
      // se borra: por eso el botón no promete que no se guarde nada.)
      const cuerpo = $('repDialogoCuerpo')
      const largo = cuerpo.dataset.largo
      if (!largo) return
      cuerpo.dataset.url = largo
      cuerpo.querySelector('#repEnlace').value = largo
      cuerpo.querySelector('#repCompartirNota').textContent = `Este enlace lleva la partida DENTRO: no hace falta PokeDoc para guardarla, y quien lo abra la ve igual.${largo.length > 2000 ? ` Es largo (${largo.length.toLocaleString('es-ES')} caracteres): en Discord no cabe en un mensaje.` : ''}`
      b.remove()
      return
    }
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
    if (b.dataset.dlg === 'publicar') return publicar(b)
    if (b.dataset.dlg === 'crear-puzle') return crearPuzle(b)
    if (b.dataset.dlg === 'caminos') return calcularCaminos(b)
    if (b.dataset.dlg === 'caminos-lista') return dialogoLista(b.dataset.jugador)
    if (b.dataset.dlg === 'lista-mio' || b.dataset.dlg === 'lista-texto') return usarLista(b)
    if (b.dataset.dlg === 'bajar-imagen') return bajarImagen()
    if (b.dataset.dlg === 'compartir-imagen') return compartirImagen()
    if (b.dataset.dlg === 'guardar') return dialogoGuardar()
    if (b.dataset.dlg === 'borrar-nota') {
      b.disabled = true
      try {
        await cambiarNota(Number($('repDialogoCuerpo').dataset.nota), null)
        d.close()
        showToast('Nota borrada.', 'success')
      } catch (err) {
        estadoDialogo(err.message, 'error')
        b.disabled = false
      }
      return
    }
    if (b.dataset.dlg === 'cancelar-video' && videoEnMarcha) videoEnMarcha.cancelado = true
  })
  // Cerrar la ventana a mitad de un vídeo lo para: nadie espera que siga
  // trabajando algo que ya no ve.
  $('repDialogo').addEventListener('close', () => {
    if (videoEnMarcha) videoEnMarcha.cancelado = true
    soltarImagen()
    delete $('repDialogoCuerpo').dataset.url
    delete $('repDialogoCuerpo').dataset.nota
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
    if (accion === 'otra') {
      salirStream()
      document.documentElement.classList.remove('rep-puzle')
      P.activo = false
      $('repPuzle').classList.add('hidden')
      return volverAPegar()
    }
    if (accion === 'guardar') return dialogoGuardar()
    if (accion === 'compartir') return dialogoCompartir()
    if (accion === 'video') return dialogoVideo()
    if (accion === 'imagen') return dialogoImagen()
    if (accion === 'siguienteKo') return irAlSiguienteKo()
    if (accion === 'nota') return dialogoNota()
    if (accion === 'jugar') return jugarDesdeAqui()
    if (accion === 'caminos') return dialogoCaminos()
    if (accion === 'girar') return girarMesa()
    if (accion === 'stream') return entrarStream()
    if (accion === 'publicar') return dialogoPublicar()
    if (accion === 'puzle') return dialogoPuzle()
    if (accion === 'verComoSiguio') return verComoSiguio()
    const opcion = e.target.closest('[data-opcion]')
    if (opcion && P.activo) return responderPuzle(Number(opcion.dataset.opcion))
    if (accion === 'salirStream') return salirStream()
    const lista = e.target.closest('[data-lista-de]')
    if (lista) return dialogoLista(lista.dataset.listaDe)
    if (e.target.closest('[data-lista-quitar]')) return quitarLista()
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
    // Con el laboratorio encima, las teclas son suyas: la repetición que
    // queda debajo no se mueve.
    if (document.documentElement.classList.contains('lab-abierto')) return
    if (e.target.closest('input, textarea, select, [contenteditable]') || e.altKey || e.ctrlKey || e.metaKey) return
    // Mientras se piensa un puzle, la partida no se mueve: adelantarla sería
    // ver la solución.
    if (P.activo) return
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
    // Las del modo stream (tanda 517): también fuera de él, que siguiente
    // KO y girar la mesa valen siempre. Sin mayúsculas: con el bloqueo
    // puesto, «N» también es «n».
    const tecla = e.key.toLowerCase()
    if (tecla === 'n' && !e.shiftKey) return irAlSiguienteKo()
    if (tecla === 'g' && !e.shiftKey) return girarMesa()
    if (S.activo && tecla === 'b') return cambiarFondoStream()
    if (S.activo && tecla === 'f') return pantallaCompleta()
    if (S.activo && e.key === 'Escape') {
      e.preventDefault()
      return salirStream()
    }
  })
  // Lo que asoma la ayuda del modo stream: mover el ratón o tocar.
  for (const ev of ['mousemove', 'pointerdown', 'keydown']) document.addEventListener(ev, () => S.activo && verAyudaStream(), { passive: true })


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
  // `&stream` (tanda 517): se lee ANTES de abrir la partida, que al abrirla
  // la dirección se reescribe y se lo llevaría.
  const stream = q.has('stream') ? { fondo: q.get('fondo') === 'verde' ? 'verde' : 'mesa' } : null
  cargarPuzles()
  if (q.get('puzle')) return abrirPuzle(q.get('puzle'))
  if (q.get('r') && esIdCorto(q.get('r'))) {
    // Un enlace corto de los de sin cuenta (tanda 591): la carga es la de
    // detrás del `#` de siempre.
    mostrarError('')
    if (await abrirCorto(q.get('r')) && stream) entrarStream(stream)
    return
  }
  if (q.get('r')) {
    mostrarError('')
    $('repError').classList.add('hidden')
    await abrirGuardada(q.get('r'))
    if (stream) entrarStream(stream)
    return
  }
  if (esEnlaceDeRepeticion(location.hash)) {
    const texto = await desempaquetar(location.hash)
    if (texto) {
      cargar(texto, { conservarDireccion: true })
      if (stream) entrarStream(stream)
      return
    }
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
