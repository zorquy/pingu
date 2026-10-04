// El laboratorio de pruebas del constructor (tanda 384): la pantalla.
//
// Se baja SOLO al abrirlo (constructor.js lo importa con `import()`): el
// motor, los efectos y esto suman bastante y quien solo monta un mazo no
// los necesita. Su hoja, css/laboratorio.css, sí la carga /constructor
// desde el principio — el barrido de la tanda 299 sigue los `import()`
// dinámicos, y una clase pintada desde aquí sin su hoja cargada es una
// pantalla sin estilo.
//
// Todo el juego vive en partida.js (reglas) y efectos.js (cartas); aquí
// solo se pinta y se escucha. Las elecciones que piden las cartas («elige
// 2 cartas», «¿a quién?») son ventanas que devuelven una promesa: ese es
// el `ui` que recibe el motor.
//
// Desde la tanda 456, dos maneras de jugar (PINGU, con tcgmasters.net de
// referencia): contra el MUÑECO de siempre, que no juega y mide tu daño,
// o TÚ CONTRA TI con dos mazos, cada uno con su mano, sus premios y su
// banca, y la mesa girando para enseñar abajo al que le toca. Y una forma
// de jugar más directa: un clic hace lo obvio (un básico baja, una
// energía o una evolución con un solo sitio posible se pone; con varios,
// se iluminan los Pokémon que valen y eliges tocando uno), el clic
// derecho o mantener pulsado enseña la carta, y el «⋯» abre todo lo demás.
import { escapeHtml } from '../html.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { cardImageUrl } from '../tcgdex.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { canonizarCarta } from '../carta-detalle.js'
import { resumen as resumenDelMeta, listasDestacadas } from '../meta/datos.js'
import { detallesDeJuego, misMazos, cartasPorIds, resolverLineas } from './datos.js'
import { claveDeNombre, nombreVisible, imagenDeEnergiaBasica, esEnergiaBasica, letraDeCartaDeEnergia, seccionesDelMazo, leerLista, esBasico } from './nucleo.js'
import {
  Partida, Mesa, Cancelado, oddsDelMazo, probabilidadDeGrupo, contextoDeProbabilidad, PLANTILLAS_RIVAL, crearRival, nuevoManiqui,
  esPokemon, esEnergia, esPartidario, esBasicoEnJuego, costeEnLetras, danioImpreso, NOMBRE_DE_LETRA,
  unidadesDeEnergia, premiosQueDa, ponerEstado, claveDeEfecto,
} from './partida.js'
import { EFECTOS, textoDeCarta, estaAutomatizada } from './efectos.js'
import { resultadoDeCaminosHtml } from './caminos-html.js'
import { rasgosDeCarta } from './textos.js'

const PREFS = 'pokedoc-laboratorio'
const PULSACION_LARGA = 500 // ms para «mantener pulsado = ver la carta»

// ── El estado de la pantalla ──
const L = {
  raiz: null,
  // El jugador que tiene que hacer algo AHORA. Contra el muñeco es la
  // partida; con mesa, el que prepara o el que juega su turno.
  partida: null,
  mesa: null,
  // El mazo del constructor (el que se prueba contra el muñeco), y los
  // dos de la mesa: el 0 sale de serie del constructor; el 1 es el del
  // otro jugador. { nombre, entradas, odds }
  mazoConstructor: null,
  mazos: [null, null],
  // «Nueva partida» trabaja sobre un BORRADOR (mazos y opciones) que solo
  // pasa a la mesa al repartir.
  borrador: null,
  firma: '',
  codigoDeSet: () => null,
  userId: null,
  opciones: { modo: 'muneco', primero: 'azar', empieza: 'azar', estricta: true, rival: 'ex', banca: 2, mazo2: null },
  // El panel de probabilidades: null = lo que toque por el ancho.
  panelAbierto: null,
  panelPestania: 'ahora',
  rivalAbierto: false,
  nRobos: 3,
  seleccion: new Set(),
  // «¿Cómo la encuentro?» (tanda 554): la carta elegida y lo último que se
  // calculó, con la firma de la mesa en la que se calculó.
  caminos: { clave: null, nombre: '', resultado: null, calculando: false, firma: '', de: null },
  ocupado: false,
  cacheHtml: new WeakMap(),
  focoPrevio: null,
  nuevas: new Set(),
  // Apuntar: una carta de la mano esperando a que elijas su Pokémon.
  apuntar: null,
  // Elegir en la mesa (tanda 594): lo que un efecto pregunta y se contesta
  // tocando las cartas de la mesa, sin ventana. Ver `elegirEnLaMesa`.
  elegir: null,
  anuncio: '',
  ignorarClic: false,
}

const $ = (sel) => L.raiz.querySelector(sel)
const conMesa = () => !!L.mesa
const mazoDe = (partida) => (L.mesa ? L.mazos[L.mesa.indice(partida)] : L.mazoConstructor) || L.mazoConstructor
const anchoGrande = () => window.matchMedia('(min-width: 1100px)').matches
const panelVisible = () => (L.panelAbierto == null ? anchoGrande() : L.panelAbierto)

function leerPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null')
    if (p && typeof p === 'object') {
      Object.assign(L.opciones, p.opciones || {})
      if (typeof p.panelAbierto === 'boolean') L.panelAbierto = p.panelAbierto
      else if (typeof p.probAbierta === 'boolean' && p.probAbierta) L.panelAbierto = true
      if (['ahora', 'mazo', 'registro', 'caminos'].includes(p.panelPestania)) L.panelPestania = p.panelPestania
      if (Number.isInteger(p.nRobos)) L.nRobos = Math.max(1, Math.min(20, p.nRobos))
    }
  } catch {}
}
function guardarPrefs() {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ opciones: L.opciones, panelAbierto: L.panelAbierto, panelPestania: L.panelPestania, nRobos: L.nRobos }))
  } catch {}
}

// ════════════════════════════════════════════════════════════════════
// Abrir
// ════════════════════════════════════════════════════════════════════
//
// `entradas`: el mazo tal cual lo tiene el constructor. Aquí se engorda
// con lo que el buscador no pide (ataques, habilidades, retirada) — una
// sola consulta por los identificadores del mazo.
export async function abrirLaboratorio({ entradas, nombre = '', codigoDeSet = () => null, userId = null }) {
  leerPrefs()
  L.codigoDeSet = codigoDeSet
  L.userId = userId
  montar()
  L.focoPrevio = document.activeElement
  L.raiz.hidden = false
  document.documentElement.classList.add('lab-abierto')
  $('#labTitulo').focus()
  // Cerrar para mirar el mazo y volver no tira la partida: si el mazo es
  // el mismo, se sigue donde estaba. Para empezar otra, «Nueva partida».
  const firma = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')
  const sigue = L.mesa ? !L.mesa.terminada : L.partida && L.partida.s.fase !== 'fin'
  if (L.partida && L.firma === firma && sigue) {
    L.cacheHtml = new WeakMap()
    pintar()
    return
  }
  L.firma = firma
  $('#labCuerpo').innerHTML = '<p class="lab-cargando">Preparando la mesa…</p>'
  const preparadas = await prepararEntradas(entradas).catch(() => entradas.map((e) => ({ ...e })))
  L.mazoConstructor = { nombre: nombre || 'Tu mazo', entradas: preparadas, odds: oddsDelMazo(preparadas), mismo: true }
  // El mazo ha cambiado (si no, se habría seguido la partida): el jugador
  // 1 vuelve a ser él, y un jugador 2 que era «el mismo» se va con el
  // anterior.
  L.mazos[0] = L.mazoConstructor
  if (L.mazos[1]?.mismo) L.mazos[1] = null
  L.seleccion = new Set()
  $('#labCuerpo').innerHTML = cuerpoHtml()
  if (L.opciones.modo === 'mesa' && !L.mazos[1]) await recuperarMazo2()
  nuevaPartida()
}

// Abrir el laboratorio con una partida YA EMPEZADA (tanda 497): la de una
// repetición, en la jugada que se estaba mirando («Juega desde aquí»). Es
// «tú contra ti» con los dos mazos de la partida; quien llama trae los
// mazos y la función que pone cada carta en su sitio (`colocar(mesa)`,
// repeticiones/posicion.js): el laboratorio no sabe leer registros, solo
// jugar. Devuelve lo que `colocar` cuente.
export async function abrirLaboratorioEnPosicion({ mazos, nombres, colocar, aviso = '', codigoDeSet = () => null, userId = null }) {
  leerPrefs()
  L.codigoDeSet = codigoDeSet
  L.userId = userId
  montar()
  L.focoPrevio = document.activeElement
  L.raiz.hidden = false
  document.documentElement.classList.add('lab-abierto')
  $('#labTitulo').focus()
  $('#labCuerpo').innerHTML = '<p class="lab-cargando">Preparando la mesa…</p>'
  const preparadas = await Promise.all(mazos.map((m) => prepararEntradas(m.entradas).catch(() => m.entradas.map((e) => ({ ...e })))))
  L.mazos = mazos.map((m, i) => ({ nombre: m.nombre, entradas: preparadas[i], odds: oddsDelMazo(preparadas[i]), mismo: false }))
  L.mazoConstructor = L.mazos[0]
  // Una firma que no es la de ningún mazo del constructor: abrir luego el
  // laboratorio desde allí empieza de cero, en vez de seguir ESTA partida
  // con el mazo equivocado.
  L.firma = 'repeticion'
  L.seleccion = new Set()
  L.ocupado = false
  L.nuevas = new Set()
  L.apuntar = null
  L.elegir = null
  L.cacheHtml = new WeakMap()
  $('#labCuerpo').innerHTML = cuerpoHtml()
  const semilla = (Math.random() * 2 ** 32) >>> 0
  L.mesa = new Mesa({ mazos: L.mazos.map((m) => m.entradas), nombres, efectos: EFECTOS, semilla, empieza: 0, estricta: L.opciones.estricta })
  const resumen = colocar(L.mesa)
  const texto = typeof aviso === 'function' ? aviso(resumen) : aviso
  if (texto) L.mesa.log(null, texto)
  L.partida = L.mesa.actual
  L.anuncio = `Turno de ${L.partida.nombreJugador}`
  pintar()
  // La jugada de un KO llega con sus premios por coger y, a veces, con
  // alguien sin activo. La mesa lo resuelve ya, como después de cualquier
  // jugada (y se puede deshacer): así se empieza desde una mesa en regla.
  if (L.mesa.m.pendientes.length || L.mesa.jugadores.some((j) => !j.s.activo && j.s.banca.length)) await hacer(async () => {})
  return resumen
}

// Abrir una posición que llega por un enlace (tanda 515): con mesa, por el
// mismo camino que la de una repetición; contra el muñeco, su partida tal
// cual. `posicion` es la de posicion-compartida.js ya con sus cartas.
export async function abrirPosicionCompartida({ posicion, codigoDeSet = () => null, userId = null }) {
  const aviso = 'Posición que te han pasado con un enlace: se sigue jugando desde aquí.'
  if (posicion.tipo === 'mesa') {
    return abrirLaboratorioEnPosicion({ mazos: posicion.mazos, nombres: posicion.nombres, colocar: (mesa) => mesa.restaurar(structuredClone(posicion.estado)), aviso, codigoDeSet, userId })
  }
  leerPrefs()
  L.codigoDeSet = codigoDeSet
  L.userId = userId
  montar()
  L.focoPrevio = document.activeElement
  L.raiz.hidden = false
  document.documentElement.classList.add('lab-abierto')
  $('#labTitulo').focus()
  $('#labCuerpo').innerHTML = '<p class="lab-cargando">Preparando la mesa…</p>'
  const [m] = posicion.mazos
  const preparadas = await prepararEntradas(m.entradas).catch(() => m.entradas.map((e) => ({ ...e })))
  L.mazoConstructor = { nombre: m.nombre || 'Mazo', entradas: preparadas, odds: oddsDelMazo(preparadas), mismo: true }
  L.mazos = [L.mazoConstructor, null]
  // La firma no se toca: el enlace solo se lee al cargar la página, así que
  // aún no hay ninguna que pudiera confundirse con la de este mazo.
  L.mesa = null
  L.seleccion = new Set()
  L.ocupado = false
  L.nuevas = new Set()
  L.apuntar = null
  L.elegir = null
  L.cacheHtml = new WeakMap()
  $('#labCuerpo').innerHTML = cuerpoHtml()
  L.partida = new Partida({ entradas: preparadas, efectos: EFECTOS, semilla: 1, estricta: posicion.estado.estricta !== false })
  L.partida.s = structuredClone(posicion.estado)
  L.partida.log(aviso)
  pintar()
}

// ── Compartir la posición (tanda 515) ──
function posicionActual() {
  if (L.mesa) {
    const [a, b] = L.mesa.jugadores
    // Sin el registro de TCG Live (tanda 592): pesaría en el enlace, y una
    // posición abierta a medias no se puede reproducir desde el principio.
    return { tipo: 'mesa', nombres: [a.nombreJugador, b.nombreJugador], mazos: L.mazos, estado: structuredClone({ a: a.s, b: b.s, m: { ...L.mesa.m, diario: [] } }) }
  }
  return { tipo: 'muneco', mazos: [L.mazoConstructor], estado: structuredClone(L.partida.s) }
}

async function dialogoCompartir() {
  if (!L.partida || L.ocupado) return
  const posicion = posicionActual()
  const caja = abrirDialogo(
    `<h3 id="labDialogoTitulo">Compartir esta posición</h3>
     <div class="lab-dialogo-cuerpo"><p class="subtext" id="labCompartirNota">Preparando el enlace…</p></div>
     <div class="lab-dialogo-botones"><button type="button" class="btn-secondary lab-btn" data-dlg="cancelar">Cerrar</button></div>`
  )
  const vez = vezDialogo
  caja.onclick = async (e) => {
    const b = e.target.closest('[data-dlg]')
    if (!b) return
    if (b.dataset.dlg === 'cancelar') return cerrarDialogo()
    const url = caja.querySelector('#labEnlace')?.value
    if (!url) return
    if (b.dataset.dlg === 'copiar') {
      try {
        await navigator.clipboard.writeText(url)
        showToast('Enlace copiado.', 'success')
      } catch {
        // Sin permiso para el portapapeles, se deja seleccionado.
        caja.querySelector('#labEnlace').select()
        showToast('Cópialo con Ctrl+C: ya está seleccionado.')
      }
    }
    if (b.dataset.dlg === 'nativo') navigator.share({ title: 'Una posición del laboratorio de PokeDoc', url }).catch(() => {})
  }
  let url
  let corto = false
  try {
    const { empaquetarPosicion } = await import('./posicion-compartida.js')
    const carga = await empaquetarPosicion(posicion)
    url = `${location.origin}/constructor#${carga}`
    // Corto (tanda 591): la mesa, comprimida, se guarda en PokeDoc y el
    // enlace lleva ocho letras. Si no se puede, el largo de siempre.
    try {
      const { acortar, enlaceCorto } = await import('../enlace-corto.js')
      url = enlaceCorto('posicion', await acortar('posicion', carga))
      corto = true
    } catch {
      /* el largo, que funciona igual */
    }
  } catch (err) {
    const nota = caja.querySelector('#labCompartirNota')
    if (nota && sigueElDialogo(vez)) nota.textContent = `No se ha podido hacer el enlace: ${err.message}`
    return
  }
  const cuerpo = caja.querySelector('.lab-dialogo-cuerpo')
  if (!cuerpo || !sigueElDialogo(vez)) return
  // Lo que se lleva el enlace, dicho entero: con tu mano y tu mazo EN SU
  // ORDEN, quien lo abra roba lo mismo que robarías tú.
  const quien = L.mesa ? 'los dos mazos y las dos manos' : 'tu mazo, tu mano y el muñeco'
  const donde = corto
    ? 'La mesa se guarda en PokeDoc (sin ningún dato tuyo) para que el enlace quepa en un mensaje.'
    : `El enlace lleva la mesa dentro; no se guarda en ningún sitio.${url.length > 2000 ? ` Es largo (${url.length.toLocaleString('es-ES')} caracteres): en Discord no cabe en un mensaje.` : ''}`
  cuerpo.innerHTML = `
    <p class="subtext">Quien lo abra sigue jugando desde aquí, con ${quien} tal cual están ahora, y el mazo en su orden: robará lo mismo que robarías tú. ${donde}</p>
    <div class="lab-enlace">
      <label class="sr-only" for="labEnlace">Enlace de la posición</label>
      <input type="text" id="labEnlace" readonly value="${escapeHtml(url)}" />
      <button type="button" class="btn-primary lab-btn" data-dlg="copiar">${icons.link(16)} Copiar</button>
    </div>
    ${navigator.share ? `<button type="button" class="btn-secondary lab-btn" data-dlg="nativo">${icons.share(16)} Compartir en…</button>` : ''}`
}

function cerrar() {
  if (!L.raiz) return
  cerrarMenu()
  L.apuntar = null
  // Lo que se podía cancelar, se cancela (el motor deshace la jugada). Lo
  // obligatorio se queda esperando: al volver, la barra sigue ahí.
  if (L.elegir && !L.elegir.sinCancelar) cancelarElegir()
  L.raiz.hidden = true
  document.documentElement.classList.remove('lab-abierto')
  L.focoPrevio?.focus?.()
}

// Engordar un mazo con lo que juega (ataques, habilidades, debilidad…) y
// dejar sus cartas en la forma canónica que entiende el motor.
async function prepararEntradas(entradas) {
  const ids = [...new Set(entradas.map((e) => e.carta.id))]
  const detalles = await detallesDeJuego(ids).catch(() => new Map())
  return entradas.map((e) => ({ n: e.n, carta: canonizarCarta({ ...e.carta, ...(detalles.get(e.carta.id) || {}) }) }))
}

// ════════════════════════════════════════════════════════════════════
// El esqueleto
// ════════════════════════════════════════════════════════════════════

function montar() {
  if (L.raiz) return
  const raiz = document.createElement('div')
  raiz.className = 'lab'
  raiz.id = 'laboratorio'
  raiz.hidden = true
  raiz.setAttribute('role', 'dialog')
  raiz.setAttribute('aria-modal', 'true')
  // Para poder devolverle el foco cuando se cierra un menú y no hay a
  // dónde volver (tanda 423). Sin esto el foco se queda en el `body`, y
  // como el oyente de Escape vive AQUÍ, deja de llegarle: el laboratorio
  // se quedaba sin poder cerrarse con el teclado.
  raiz.tabIndex = -1
  raiz.setAttribute('aria-labelledby', 'labTitulo')
  raiz.innerHTML = `
    <header class="lab-barra">
      <div class="lab-titulo">
        <h2 id="labTitulo" tabindex="-1">Laboratorio</h2>
        <span class="lab-nombre" id="labNombre"></span>
      </div>
      <div class="lab-modos" role="radiogroup" aria-label="Contra quién juegas">
        <button type="button" class="lab-modo" role="radio" data-modo="muneco" aria-checked="true">${icons.target(16)}<span>Contra el muñeco</span></button>
        <button type="button" class="lab-modo" role="radio" data-modo="mesa" aria-checked="false">${icons.users(16)}<span>Tú contra ti</span></button>
      </div>
      <p class="lab-turno" id="labTurno" aria-live="polite"></p>
      <div class="lab-barra-botones">
        <button type="button" class="btn-secondary lab-btn" data-accion="deshacer" title="Deshacer (Ctrl+Z)">${icons.refreshCw(16)}<span class="lab-btn-texto">Deshacer</span></button>
        <button type="button" class="btn-secondary lab-btn" data-accion="nueva" title="Nueva partida">${icons.cards(16)}<span class="lab-btn-texto">Nueva partida</span></button>
        <button type="button" class="btn-secondary lab-btn lab-btn-panel" data-accion="panel" aria-pressed="false" aria-controls="labPanel" title="Probabilidades (P)">${icons.barChart(16)}<span class="lab-btn-texto">Probabilidades</span></button>
        <button type="button" class="btn-secondary lab-btn" data-accion="compartir" title="Compartir esta posición">${icons.share(16)}<span class="lab-btn-texto">Compartir</span></button>
      </div>
      <button type="button" class="lab-cerrar lab-cerrar-lab" data-accion="cerrar" aria-label="Cerrar el laboratorio">×</button>
    </header>
    <div class="lab-cuerpo" id="labCuerpo"></div>
    <div class="lab-menu hidden" id="labMenu" role="menu" tabindex="-1"></div>
    <div class="lab-velo hidden" id="labVelo">
      <div class="lab-dialogo" id="labDialogo" role="dialog" aria-modal="true" aria-labelledby="labDialogoTitulo" tabindex="-1"></div>
    </div>`
  document.body.appendChild(raiz)
  L.raiz = raiz
  enganchar()
}

function cuerpoHtml() {
  return `
    <div class="lab-mesa" id="labMesa">
      <div class="lab-tapete" id="labTapete">
        <section class="lab-lado lab-lado-rival" id="labLadoRival" aria-label="El rival"></section>
        <section class="lab-centro-mesa" id="labCentro" aria-label="La mesa"></section>
        <section class="lab-lado lab-lado-propio" id="labLadoPropio" aria-label="Tu lado de la mesa"></section>
        <div class="lab-apuntar hidden" id="labApuntar" role="status"></div>
        <div class="lab-cambio" id="labCambio" aria-hidden="true" hidden></div>
      </div>
      <section class="lab-mano-zona" aria-labelledby="labManoTitulo">
        <div class="lab-mano-cab">
          <h3 class="lab-rotulo" id="labManoTitulo">Tu mano</h3>
          <p class="lab-ayuda">Clic: jugar · Clic derecho o mantener: ver la carta · <span class="lab-ayuda-icono" aria-hidden="true">${icons.moreHorizontal(14)}</span>: todo lo demás</p>
        </div>
        <div class="lab-mano" id="labMano"></div>
      </section>
    </div>
    <aside class="lab-panel" id="labPanel" aria-labelledby="labPanelTitulo"></aside>
    <button type="button" class="lab-panel-pestana" id="labPanelPestana" data-accion="panel" aria-controls="labPanel" aria-expanded="false">${icons.barChart(16)}<span>Probabilidades</span></button>
    <div class="lab-fin hidden" id="labFin" role="status"></div>`
}

// Solo se toca el DOM si el HTML de la zona ha cambiado: repintar todo
// tras cada clic haría parpadear las imágenes.
function poner(el, html) {
  if (!el) return
  if (L.cacheHtml.get(el) === html) return
  L.cacheHtml.set(el, html)
  el.innerHTML = html
}

// ════════════════════════════════════════════════════════════════════
// La partida
// ════════════════════════════════════════════════════════════════════

function nuevaPartida() {
  // Por si una ventana se quedó sin contestar a medias de una jugada: la
  // partida nueva no puede heredar la mesa «ocupada».
  L.ocupado = false
  L.nuevas = new Set()
  L.apuntar = null
  L.elegir = null
  L.anuncio = ''
  L.cacheHtml = new WeakMap()
  const o = L.opciones
  const semilla = (Math.random() * 2 ** 32) >>> 0
  if (o.modo === 'mesa' && L.mazos[1]) {
    L.mesa = new Mesa({
      mazos: [L.mazos[0].entradas, L.mazos[1].entradas],
      nombres: ['Jugador 1', 'Jugador 2'],
      efectos: EFECTOS,
      semilla,
      empieza: o.empieza === 'azar' ? 'azar' : Number(o.empieza) === 1 ? 1 : 0,
      estricta: o.estricta,
    })
    L.mesa.repartir()
    L.partida = L.mesa.actual
  } else {
    L.mesa = null
    if (o.modo === 'mesa') o.modo = 'muneco'
    const primero = o.primero === 'azar' ? Math.random() < 0.5 : o.primero === 'primero'
    L.partida = new Partida({ entradas: L.mazoConstructor.entradas, efectos: EFECTOS, semilla, vaPrimero: primero, estricta: o.estricta, rival: { plantilla: o.rival, banca: o.banca } })
    L.partida.repartir()
  }
  pintar()
}

// Ejecutar una acción del jugador: con su foto para deshacer, y con los
// errores contados en un aviso y no en la consola.
async function hacer(fn) {
  if (L.ocupado || !L.partida) return
  L.ocupado = true
  cerrarMenu()
  const foco = marcaDelFoco()
  L.apuntar = null
  const quien = L.partida
  const otro = L.mesa ? quien.oponente : null
  const antes = new Set(quien.s.mano)
  const antesOtro = otro ? new Set(otro.s.mano) : null
  try {
    if (L.mesa) await L.mesa.accion(fn, ui)
    else await L.partida.accion(fn)
    // Lo que acaba de llegar a la mano se marca hasta la siguiente
    // acción: después de robar 6 con Lillie, saber CUÁLES son las nuevas
    // es lo primero que se mira. Con mesa, si el turno ha pasado, las
    // nuevas son las del otro (su robo del turno).
    const ahora = L.mesa ? L.mesa.actual : L.partida
    const previa = ahora === quien ? antes : antesOtro || antes
    L.nuevas = new Set(ahora.s.mano.filter((u) => !previa.has(u)))
    if (L.mesa && ahora !== quien && !L.mesa.terminada) {
      L.anuncio = L.mesa.fase === 'preparacion' ? `Prepara ${ahora.nombreJugador}` : `Turno de ${ahora.nombreJugador}`
      mostrarCambio(ahora, L.anuncio)
    }
  } catch (err) {
    if (err?.cancelado) {
      // Cancelar una elección deja todo como estaba: no hay nada que decir.
    } else if (err?.noSePuede) {
      showToast(err.message, 'error')
    } else {
      console.error(err)
      showToast(`Algo ha fallado: ${err?.message || err}`, 'error')
    }
  } finally {
    L.ocupado = false
    pintar()
    devolverFoco(foco)
  }
}

// El aviso del cambio de turno, en el centro del tapete. Se esconde con
// un temporizador y no al acabar la animación: con «menos movimiento» la
// animación no corre y `animationend` no llegaría nunca (tanda 313).
let temporizadorCambio = null
function mostrarCambio(partida, texto) {
  const el = $('#labCambio')
  if (!el) return
  clearTimeout(temporizadorCambio)
  el.dataset.j = String(L.mesa.indice(partida))
  el.textContent = texto
  el.hidden = false
  // Si el anterior sigue a la vista, la animación vuelve a empezar.
  el.style.animation = 'none'
  void el.offsetWidth
  el.style.animation = ''
  temporizadorCambio = setTimeout(() => (el.hidden = true), 1300)
}

function deshacer() {
  if (L.ocupado) return
  const ok = L.mesa ? L.mesa.deshacer() : L.partida?.deshacer()
  if (!ok) return
  L.apuntar = null
  cerrarMenu()
  const foco = marcaDelFoco()
  pintar()
  devolverFoco(foco)
}

// ── El foco ──
//
// Cada jugada repinta la mesa, y el botón que tenía el foco se sustituye
// por uno nuevo: el foco se caía al `body`, y con él el teclado (Escape,
// Ctrl+Z, «v», «p»). Se apunta QUÉ era —su carta, su Pokémon, su botón—
// y se le devuelve a su equivalente después de pintar.
const ATRIBUTOS_DE_FOCO = ['data-uid', 'data-slot-carta', 'data-rival-carta', 'data-mas', 'data-premio', 'data-accion', 'data-modo', 'data-primero', 'data-empieza', 'data-panel-pestania', 'data-marca', 'data-robos', 'data-rival-ajuste', 'data-caminos']
function marcaDelFoco() {
  const a = document.activeElement
  if (!L.raiz || !a || a === L.raiz || !L.raiz.contains(a)) return null
  if (a.dataset.pila) return `[data-pila="${a.dataset.pila}"][data-de="${a.dataset.de}"]`
  for (const at of ATRIBUTOS_DE_FOCO) if (a.hasAttribute(at)) return `[${at}="${CSS.escape(a.getAttribute(at))}"]`
  return a.id ? `#${CSS.escape(a.id)}` : null
}
function devolverFoco(marca, el = null) {
  if (!L.raiz || L.raiz.hidden) return
  const a = document.activeElement
  if (a && a !== document.body && a.isConnected && L.raiz.contains(a)) return
  const destino = (el?.isConnected && L.raiz.contains(el) ? el : null) || (marca && L.raiz.querySelector(marca)) || L.raiz
  destino.focus({ preventScroll: true })
}

// ════════════════════════════════════════════════════════════════════
// Pintar
// ════════════════════════════════════════════════════════════════════

function pintar() {
  if (L.mesa) L.partida = L.mesa.actual
  const p = L.partida
  if (!p || !$('#labMesa')) return
  pintarBarra()
  pintarRival()
  pintarCentro()
  pintarPropio()
  pintarMano()
  pintarPanel()
  pintarFin()
  pintarApuntar()
}

function pintarBarra() {
  const p = L.partida
  const s = p.s
  const m = L.mesa
  $('#labNombre').textContent = m ? `${L.mazos[0].nombre} contra ${L.mazos[1].nombre}` : L.mazoConstructor?.nombre || ''
  for (const b of L.raiz.querySelectorAll('[data-modo]')) b.setAttribute('aria-checked', String(b.dataset.modo === (m ? 'mesa' : 'muneco')))
  let t = ''
  if (m) {
    if (m.fase === 'preparacion') t = `Preparación · ${p.nombreJugador}`
    else if (m.fase === 'juego') t = `Turno ${m.m.turnoGlobal} · ${p.nombreJugador}${s.vaPrimero && s.turno === 1 ? ' (va primero)' : ''}`
    else if (m.fase === 'fin') t = 'Partida terminada'
  } else if (s.fase === 'preparacion') t = `Preparación · vas ${s.vaPrimero ? 'primero' : 'segundo'}`
  else if (s.fase === 'turno') t = `Tu turno ${s.turno} · vas ${s.vaPrimero ? 'primero' : 'segundo'}`
  else if (s.fase === 'fin') t = 'Partida terminada'
  $('#labTurno').textContent = L.anuncio && m?.fase !== 'fin' ? `${t} — ${L.anuncio === `Turno de ${p.nombreJugador}` || L.anuncio === `Prepara ${p.nombreJugador}` ? 'te toca' : L.anuncio}` : t
  L.anuncio = ''
  const d = $('[data-accion="deshacer"]')
  if (d) d.disabled = !(m ? m.puedeDeshacer : p.puedeDeshacer)
  const abierto = panelVisible()
  $('.lab-btn-panel')?.setAttribute('aria-pressed', String(abierto))
}

// ── Las cartas ──

function imagenHtml(carta, calidad = 'low') {
  let cadena = []
  if (esEnergiaBasica(carta) && !carta.image_path) {
    const e = imagenDeEnergiaBasica(carta, calidad === 'high' ? 'LG' : 'SM')
    if (e) cadena = [e.url, e.respaldo].filter(Boolean)
  } else {
    cadena = cadenaDeEscaneo(carta, L.codigoDeSet(carta.set_id), calidad, cardImageUrl)
  }
  const attrs = atributosDeEscaneo(cadena)
  // El nombre va DEBAJO: si no carga ninguna imagen, se queda el nombre
  // (CLAUDE.md, tanda 321: un respaldo nunca termina en «nada»).
  return `<span class="lab-sin-imagen">${escapeHtml(nombreVisible(carta))}</span>${attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" />` : ''}`
}

function cartaHtml(uid, { extra = '', etiqueta = '', nueva = false, clase = '' } = {}) {
  const c = L.partida.carta(uid)
  const nombre = escapeHtml(nombreVisible(c))
  const auto = !estaAutomatizada(c) ? '<span class="lab-chapa lab-chapa-manual" title="Su efecto no está automatizado: se hace a mano">a mano</span>' : ''
  const el = marcaElegir(uid)
  return `<button type="button" class="lab-carta${clase}${el.clase}${nueva ? ' lab-nueva' : ''}" data-uid="${uid}" aria-label="${etiqueta || nombre}${nueva ? ' (nueva)' : ''}${el.etiqueta}"${extra}${el.attrs}>${imagenHtml(c)}${auto}${nueva ? '<span class="lab-chapa lab-chapa-nueva">nueva</span>' : ''}</button>`
}

// En la mesa, lo que se puede elegir ahora mismo (tanda 594): lleva
// `data-elegir` y su `aria-pressed`, y brilla. El resto se apaga.
function marcaElegir(id, tipo = null) {
  const e = L.elegir
  if (!e || (tipo && e.tipo !== tipo) || !e.valen.has(id)) return { clase: '', attrs: '', etiqueta: '' }
  return { clase: ' lab-a-elegir', attrs: ` data-elegir="${escapeHtml(id)}" aria-pressed="${e.sel.has(id)}"`, etiqueta: '. Tócala para elegirla' }
}

const dorsoHtml = (extra = '') => `<span class="lab-dorso"${extra} aria-hidden="true"></span>`

// La energía unida, como un punto con la letra de su tipo.
function energiaHtml(uid, portador, partida) {
  const c = partida.carta(uid)
  const unidades = unidadesDeEnergia(c, portador, partida)
  const letra = esEnergiaBasica(c) ? letraDeCartaDeEnergia(c) || 'C' : unidades[0]?.includes('*') ? '*' : unidades[0]?.[0] || 'C'
  const titulo = `${nombreVisible(c)}${unidades.length > 1 ? ` (da ${unidades.length})` : ''}`
  const el = marcaElegir(uid, 'cartas')
  if (el.clase) return `<button type="button" class="lab-energia${esEnergiaBasica(c) ? '' : ' lab-energia-especial'}${el.clase}" data-tipo="${letra}" title="${escapeHtml(titulo)}" aria-label="${escapeHtml(titulo)}${el.etiqueta}"${el.attrs}>${letra}${unidades.length > 1 ? `<sub>${unidades.length}</sub>` : ''}</button>`
  return `<span class="lab-energia${esEnergiaBasica(c) ? '' : ' lab-energia-especial'}" data-tipo="${letra}" title="${escapeHtml(titulo)}">${letra}${unidades.length > 1 ? `<sub>${unidades.length}</sub>` : ''}</span>`
}

const ESTADOS = { envenenado: 'Envenenado', quemado: 'Quemado', dormido: 'Dormido', paralizado: 'Paralizado', confundido: 'Confundido' }

// Lo que un ataque le ha dejado encima a un Pokémon para el turno que
// viene (tanda 462): que no pueda retirarse, que no pueda atacar, un
// escudo, sus ataques rebajados. Sin esto se jugaba a ciegas: el efecto
// estaba y no se veía. Cada chapa lleva en el `title` la carta que lo puso.
function efectosDeSlot(slot, partida) {
  const s = partida.s
  const op = partida.oponente
  const out = []
  const chapa = (texto, por) => out.push(`<span class="lab-chapa lab-chapa-efecto"${por ? ` title="${escapeHtml(por)}"` : ''}>${texto}</span>`)
  // ¿Sigue valiendo un efecto para el turno N de este jugador? Vale si
  // ese turno aún no ha llegado, o si es el que se está jugando.
  const vigente = (n, j = partida) => n != null && (n > j.s.turno || (n === j.s.turno && j.s.fase === 'turno'))
  if (vigente(slot.noRetirarHasta) && slot === s.activo) chapa('No se retira', 'Un ataque le impide retirarse en su turno')
  for (const b of [...(slot.bloqueos || []), ...(slot.bloqueo ? [slot.bloqueo] : [])]) {
    if (!vigente(b.turno)) continue
    const nombre = b.indice == null ? null : partida.cartaDe(slot)?.attacks?.[b.indice]?.name
    chapa(nombre ? `Sin ${escapeHtml(nombre)}` : 'No ataca', b.por || '')
  }
  if (slot.debil && vigente(slot.debil.turno)) chapa(`−${slot.debil.n} al atacar`, slot.debil.por || '')
  if (op) {
    for (const e of slot.escudos || []) {
      if (!vigente(e.turnoRival, op)) continue
      chapa(e.tipo === 'menos' ? `Escudo −${e.n}` : e.tipo === 'todoYEfectos' ? 'Intocable' : 'Escudo', e.por || '')
    }
    if (slot.marca && vigente(slot.marca.turno, op)) chapa(`Recibe +${slot.marca.n}`, slot.marca.por || '')
  }
  return out.join('')
}

// La barra de vida, con su nivel: verde, ámbar por debajo de la mitad y
// rojo en el último cuarto. El número va al lado (no es solo color).
const vidaHtml = (pct, titulo = '') => `<div class="lab-ps" data-vida="${pct <= 25 ? 'baja' : pct <= 50 ? 'media' : 'alta'}"${titulo ? ` title="${titulo}"` : ''}><span style="--pct: ${pct}%"></span></div>`

// Un Pokémon en juego. `rival`: es del otro jugador (se lee, no se juega).
function slotHtml(slot, partida, { activo = false, rival = false, bocaAbajo = false } = {}) {
  const c = partida.cartaDe(slot)
  if (bocaAbajo) {
    return `<div class="lab-slot${activo ? ' lab-slot-activo' : ''}"><span class="lab-carta lab-carta-dorso lab-slot-carta" role="img" aria-label="Pokémon boca abajo">${dorsoHtml()}</span></div>`
  }
  const ps = partida.psDe(slot)
  const vida = Math.max(0, ps - slot.danio)
  const pct = ps ? Math.round((vida / ps) * 100) : 100
  const energias = slot.energias.map((u) => energiaHtml(u, c, partida)).join('')
  const elH = slot.herramienta ? marcaElegir(slot.herramienta, 'cartas') : null
  const herramienta = !slot.herramienta
    ? ''
    : elH.clase
      ? `<button type="button" class="lab-chapa lab-chapa-herramienta${elH.clase}" title="${escapeHtml(partida.nombre(slot.herramienta))}" aria-label="${escapeHtml(partida.nombre(slot.herramienta))}${elH.etiqueta}"${elH.attrs}>${escapeHtml(partida.nombre(slot.herramienta))}</button>`
      : `<span class="lab-chapa lab-chapa-herramienta" title="${escapeHtml(partida.nombre(slot.herramienta))}">${escapeHtml(partida.nombre(slot.herramienta))}</span>`
  const estados = slot.estados.map((e) => `<span class="lab-chapa lab-chapa-estado">${ESTADOS[e] || e}</span>`).join('')
  const nuevo = partida.s.fase === 'turno' && slot.entroTurno === partida.s.turno ? '<span class="lab-chapa">nuevo</span>' : ''
  const efectos = efectosDeSlot(slot, partida)
  const evo = slot.cartas.length > 1 ? `<span class="lab-chapa" title="${escapeHtml(slot.cartas.slice(0, -1).map((u) => partida.nombre(u)).join(' → '))}">evol. ${slot.cartas.length - 1}</span>` : ''
  const apuntable = !rival && L.apuntar?.opciones?.[slot.id]
  const el = marcaElegir(slot.id, 'pokemon')
  const dato = rival ? `data-rival-carta="${slot.id}"` : `data-slot-carta="${slot.id}"`
  const etiqueta = `${escapeHtml(nombreVisible(c))}${activo ? ', activo' : ''}${rival ? ` de ${escapeHtml(partida.nombreJugador || 'el rival')}` : ''}: ${vida} de ${ps} PS${slot.energias.length ? `, ${slot.energias.length} ${slot.energias.length === 1 ? 'energía' : 'energías'}` : ''}${apuntable || el.clase ? '. Tócalo para elegirlo' : ''}`
  return `
    <div class="lab-slot${activo ? ' lab-slot-activo' : ''}${apuntable || el.clase ? ' lab-apuntable' : ''}${el.clase ? ' lab-slot-elegible' : ''}${slot.danio && vida <= 0 ? ' lab-slot-caido' : ''}" data-slot="${slot.id}">
      <button type="button" class="lab-carta lab-slot-carta${el.clase}" ${dato} aria-label="${etiqueta}"${el.attrs}>${imagenHtml(c)}${slot.danio ? `<span class="lab-danio" aria-hidden="true">${slot.danio}</span>` : ''}${estados ? `<span class="lab-slot-estados">${estados}</span>` : ''}</button>
      <div class="lab-slot-pie">
        ${vidaHtml(pct, `${vida} / ${ps} PS`)}
        <p class="lab-ps-texto">${vida}/${ps}</p>
        ${energias ? `<div class="lab-energias">${energias}</div>` : ''}
        ${herramienta || evo || nuevo || efectos ? `<div class="lab-chapas">${herramienta}${evo}${nuevo}${efectos}</div>` : ''}
      </div>
    </div>`
}

// Los premios: boca abajo (o boca arriba si los has visto).
function premiosHtml(partida, { rival = false } = {}) {
  const s = partida.s
  if (!s.premios.length && (s.fase === 'preparacion' || s.fase === 'mulligan')) {
    return `<div class="lab-premios" aria-hidden="true">${'<span class="lab-hueco lab-hueco-premio"></span>'.repeat(6)}</div><p class="lab-cuenta-mini lab-cuenta-prep">Se ponen al empezar</p>`
  }
  if (!s.premios.length) return '<p class="lab-vacio">Sin premios</p>'
  // Coger premios se hace tocándolos en la mesa (tanda 594), como en la
  // partida de verdad: boca abajo, a ciegas.
  if (L.elegir?.tipo === 'premios' && L.elegir.partida === partida) {
    return `<div class="lab-premios">${s.premios.map((u, i) => {
      const el = marcaElegir(u, 'premios')
      return s.premiosVistos[u] && !rival
        ? cartaHtml(u)
        : `<button type="button" class="lab-carta lab-carta-dorso${el.clase}" aria-label="Premio ${i + 1}, boca abajo${el.etiqueta}"${el.attrs}>${dorsoHtml()}</button>`
    }).join('')}</div><p class="lab-cuenta-mini">${s.premios.length} ${s.premios.length === 1 ? 'premio' : 'premios'}</p>`
  }
  if (rival) return `<div class="lab-premios" role="img" aria-label="${s.premios.length} premios">${s.premios.map(() => `<span class="lab-carta lab-carta-dorso">${dorsoHtml()}</span>`).join('')}</div><p class="lab-cuenta-mini">${s.premios.length} ${s.premios.length === 1 ? 'premio' : 'premios'}</p>`
  return `<div class="lab-premios">${s.premios.map((u, i) => (s.premiosVistos[u] ? cartaHtml(u, { extra: ' data-premio' }) : `<button type="button" class="lab-carta lab-carta-dorso" data-premio="${u}" aria-label="Premio ${i + 1}, boca abajo">${dorsoHtml()}</button>`)).join('')}</div><p class="lab-cuenta-mini">${s.premios.length} ${s.premios.length === 1 ? 'premio' : 'premios'}</p>`
}

// El mazo y el descarte. Los del rival se pueden mirar (su descarte es
// público), no tocar.
function pilasHtml(partida, { rival = false } = {}) {
  const s = partida.s
  const ctx = !rival && s.fase === 'turno' ? contextoDeProbabilidad(partida) : null
  const ultima = s.descarte.at(-1)
  const quien = rival ? 'rival' : 'propio'
  const mano = rival
    ? `<div class="lab-pila lab-pila-mano" role="img" aria-label="${s.mano.length} cartas en la mano"><span class="lab-abanico" aria-hidden="true">${Array.from({ length: Math.min(s.mano.length, 5) }, () => dorsoHtml()).join('')}</span><span class="lab-pila-texto"><strong>${s.mano.length}</strong> en la mano</span></div>`
    : ''
  return `
    <button type="button" class="lab-pila" data-pila="mazo" data-de="${quien}" aria-label="${rival ? 'Mazo del rival' : 'Tu mazo'}: ${s.mazo.length} cartas">${dorsoHtml()}<span class="lab-pila-texto"><strong>${s.mazo.length}</strong> en el mazo${ctx && ctx.t ? `<br><span class="lab-pila-sub">${ctx.t} ${ctx.t === 1 ? 'conocida' : 'conocidas'} arriba</span>` : ''}</span></button>
    <button type="button" class="lab-pila" data-pila="descarte" data-de="${quien}" aria-label="${rival ? 'Descarte del rival' : 'Tu descarte'}: ${s.descarte.length} cartas">${ultima ? `<span class="lab-pila-cara">${imagenHtml(partida.carta(ultima))}</span>` : '<span class="lab-pila-vacia" aria-hidden="true"></span>'}<span class="lab-pila-texto"><strong>${s.descarte.length}</strong> en el descarte</span></button>
    ${mano}`
}

// Un lado entero de la mesa. El de arriba (rival) va en espejo: su banca
// arriba y su activo pegado al centro, como si estuviera sentado enfrente.
function ladoHtml(partida, { rival = false } = {}) {
  const s = partida.s
  const m = L.mesa
  // Mientras se prepara, lo que ha colocado el otro está boca abajo.
  const tapado = rival && m?.fase === 'preparacion'
  const max = s.fase === 'preparacion' || s.fase === 'mulligan' ? 5 : partida.maxBanca
  const huecos = Math.max(0, max - s.banca.length)
  const activo = s.activo
    ? slotHtml(s.activo, partida, { activo: true, rival, bocaAbajo: tapado })
    : `<div class="lab-hueco lab-hueco-activo"><p>${rival ? 'Sin activo' : s.fase === 'preparacion' ? 'Toca un básico de tu mano para ponerlo aquí.' : 'Sin Pokémon activo.'}</p></div>`
  const banca = s.banca.map((x) => slotHtml(x, partida, { rival, bocaAbajo: tapado })).join('') + Array.from({ length: huecos }, () => '<div class="lab-hueco" aria-hidden="true"></div>').join('')
  const mazo = mazoDe(partida)
  const cab = m
    ? `<div class="lab-lado-cab"><span class="lab-jugador" data-j="${m.indice(partida)}">${escapeHtml(partida.nombreJugador)}</span><span class="lab-lado-mazo">${escapeHtml(mazo?.nombre || '')}</span>${m.fase === 'juego' && m.actual === partida ? '<span class="lab-lado-turno">Su turno</span>' : ''}${s.koUltimoTurnoRival && m.actual === partida ? '<span class="lab-chapa lab-chapa-alerta">Le dejaron KO el turno pasado</span>' : ''}</div>`
    : '<div class="lab-lado-cab"><span class="lab-jugador" data-j="0">Tú</span></div>'
  return `
    ${cab}
    <div class="lab-zona lab-zona-premios">${premiosHtml(partida, { rival })}</div>
    <div class="lab-zona lab-zona-activo">${activo}</div>
    <div class="lab-zona lab-zona-banca">${banca}</div>
    <div class="lab-zona lab-zona-pilas">${pilasHtml(partida, { rival })}</div>`
}

// ── El rival ──

function maniquiHtml(d, { activo = false } = {}) {
  const vida = Math.max(0, d.ps - d.danio)
  const pct = Math.round((vida / d.ps) * 100)
  const estados = (d.estados || []).map((e) => `<span class="lab-chapa lab-chapa-estado">${ESTADOS[e] || e}</span>`).join('')
  const el = marcaElegir(d.id, 'pokemon')
  // Un <div> que se pulsa: lleva su rol, su tabulación y su etiqueta, y
  // Intro/Espacio lo pulsan (alTeclear).
  const pulsable = el.clase ? ` role="button" tabindex="0" aria-label="${activo ? 'Activo' : 'Banca'} del muñeco: ${escapeHtml(d.nombre)}, ${vida} de ${d.ps} PS${el.etiqueta}"` : ''
  return `
    <div class="lab-maniqui${activo ? ' lab-maniqui-activo' : ''}${el.clase}" data-rival="${d.id}"${pulsable}${el.attrs}>
      <p class="lab-maniqui-puesto">${activo ? 'Activo' : 'Banca'}</p>
      <p class="lab-maniqui-nombre">${escapeHtml(d.nombre)}</p>
      <p class="lab-maniqui-vida"><strong>${vida}</strong> / ${d.ps} PS</p>
      ${vidaHtml(pct)}
      <div class="lab-chapas"><span class="lab-chapa">${d.premios} ${d.premios === 1 ? 'premio' : 'premios'}</span>${estados}</div>
    </div>`
}

function pintarRival() {
  const el = $('#labLadoRival')
  if (L.mesa) {
    el.classList.remove('lab-lado-muneco')
    el.setAttribute('aria-label', `Lado de ${L.partida.oponente.nombreJugador}`)
    return poner(el, ladoHtml(L.partida.oponente, { rival: true }))
  }
  el.classList.add('lab-lado-muneco')
  el.setAttribute('aria-label', 'Muñeco de prácticas')
  const r = L.partida.s.rival
  const plantillas = Object.values(PLANTILLAS_RIVAL)
    .map((t) => `<option value="${t.id}"${r.plantilla.id === t.id ? ' selected' : ''}>${t.nombre} (${t.ps} PS)</option>`)
    .join('')
  poner(
    el,
    `
    <div class="lab-lado-cab">
      <span class="lab-jugador" data-j="1">Muñeco de prácticas</span>
      <span class="lab-lado-mazo">No juega: mide tu daño</span>
      <button type="button" class="link-btn lab-rival-plegar" data-rival-ajuste="plegar" aria-expanded="${L.rivalAbierto ? 'true' : 'false'}" aria-controls="labRivalAjustes">${L.rivalAbierto ? 'Ocultar ajustes' : 'Ajustes'}</button>
    </div>
    <div class="lab-rival-ajustes${L.rivalAbierto ? ' abierto' : ''}" id="labRivalAjustes">
      <label class="lab-campo-mini">Muñeco
        <select data-rival-ajuste="plantilla">${plantillas}</select>
      </label>
      <div class="lab-contador" role="group" aria-label="Pokémon en la banca rival">
        <span>Banca</span>
        <button type="button" class="lab-mini" data-rival-ajuste="banca-" aria-label="Uno menos en la banca rival">−</button>
        <strong>${r.banca.length}</strong>
        <button type="button" class="lab-mini" data-rival-ajuste="banca+" aria-label="Uno más en la banca rival">+</button>
      </div>
      <div class="lab-contador" role="group" aria-label="Premios que le quedan al rival">
        <span>Premios</span>
        <button type="button" class="lab-mini" data-rival-ajuste="premios-" aria-label="Un premio menos para el rival">−</button>
        <strong>${r.premios}</strong>
        <button type="button" class="lab-mini" data-rival-ajuste="premios+" aria-label="Un premio más para el rival">+</button>
      </div>
      <button type="button" class="btn-secondary lab-btn" data-rival-ajuste="ataque">El muñeco te ataca…</button>
    </div>
    <div class="lab-rival-fila">
      ${r.activo ? maniquiHtml(r.activo, { activo: true }) : ''}
      ${r.banca.map((d) => maniquiHtml(d)).join('')}
    </div>`
  )
}

// ── El centro: el estadio, el turno y sus botones ──

function pintarCentro() {
  const p = L.partida
  const s = p.s
  const m = L.mesa
  const estadio = s.estadio ? cartaHtml(s.estadio, { extra: ' data-estadio', etiqueta: `Estadio: ${escapeHtml(p.nombre(s.estadio))}` }) : '<span class="lab-hueco lab-hueco-estadio" aria-hidden="true"></span>'
  const estadioBloque = `<div class="lab-estadio"><p class="lab-rotulo">Estadio</p>${estadio}${s.estadio ? '' : '<p class="lab-vacio">Ninguno</p>'}</div>`
  let medio = ''
  let botones = ''
  const fase = m ? m.fase : s.fase
  if (fase === 'preparacion') {
    const mull = s.mulligans
      ? `<p class="lab-aviso">${s.mulligans} ${s.mulligans === 1 ? 'mulligan' : 'mulligans'} antes de esta mano. <button type="button" class="link-btn" data-ver-mulligans>Verlas</button></p>`
      : ''
    // La moneda no es una opción más del grupo: es un botón que ELIGE una
    // de las dos (y por eso va fuera del `radiogroup`).
    const quien = m
      ? `<div class="lab-segmentos">
          <span class="lab-segmentos-rotulo" id="labRotuloEmpieza">Empieza</span>
          <span class="lab-segmentos-grupo" role="radiogroup" aria-labelledby="labRotuloEmpieza">
            ${[0, 1].map((i) => `<button type="button" class="lab-segmento" role="radio" data-empieza="${i}" aria-checked="${m.m.primero === i}">${escapeHtml(m.jugadores[i].nombreJugador)}</button>`).join('')}
          </span>
          <button type="button" class="lab-segmento" data-empieza="moneda">Moneda</button>
        </div>`
      : `<div class="lab-segmentos">
          <span class="lab-segmentos-rotulo" id="labRotuloVas">Vas</span>
          <span class="lab-segmentos-grupo" role="radiogroup" aria-labelledby="labRotuloVas">
            <button type="button" class="lab-segmento" role="radio" data-primero="primero" aria-checked="${s.vaPrimero}">Primero</button>
            <button type="button" class="lab-segmento" role="radio" data-primero="segundo" aria-checked="${!s.vaPrimero}">Segundo</button>
          </span>
          <button type="button" class="lab-segmento" data-primero="moneda">Moneda</button>
        </div>`
    medio = `${quien}${mull}<p class="lab-guia">${m ? `<strong>${escapeHtml(p.nombreJugador)}</strong>: toca` : 'Toca'} tus básicos para ponerlos (el primero va de activo, los demás a la banca).</p>`
    botones = `<button type="button" class="btn-secondary lab-btn" data-accion="auto">Colocar solo</button>
      <button type="button" class="btn-primary lab-btn" data-accion="empezar"${s.activo ? '' : ' disabled'}>${m ? (m.m.listos[1 - m.m.preparando] ? 'Listo: empezar' : `Listo: le toca a ${escapeHtml(p.oponente.nombreJugador)}`) : 'Empezar la partida'}</button>`
  } else if (s.fase === 'turno') {
    const f = s.flags
    const chip = (hecho, texto, pendiente) => `<span class="lab-estado${hecho ? ' lab-estado-hecho' : ''}">${hecho ? texto : pendiente}</span>`
    const primero = p.primerTurnoDelPrimero
    const ultimo = (m ? m.m.registro : s.registro).filter((x) => !/^── /.test(x.texto)).at(-1)
    medio = `
      <div class="lab-estados" aria-label="Lo que llevas este turno">
        ${chip(f.energia, 'Energía unida', 'Energía libre')}
        ${primero ? '<span class="lab-estado lab-estado-hecho">Sin partidario (turno 1)</span>' : chip(f.partidario, 'Partidario jugado', 'Partidario libre')}
        ${chip(f.estadio, 'Estadio jugado', 'Estadio libre')}
        ${chip(f.retirada, 'Ya se ha retirado', 'Retirada libre')}
        ${!m && s.koUltimoTurnoRival ? '<span class="lab-estado lab-estado-alerta">El rival te dejó KO un Pokémon el turno pasado</span>' : ''}
        ${vetosHtml(p)}
        ${!s.estricta ? '<span class="lab-estado lab-estado-alerta">Modo libre: sin reglas</span>' : ''}
      </div>
      ${ultimo ? `<p class="lab-ultimo">${escapeHtml(ultimo.texto)}</p>` : ''}`
    const estadioUso = s.estadio && EFECTOS.entrenadores[claveDeEfecto(p.carta(s.estadio))]?.estadio
    botones = `
      ${estadioUso ? `<button type="button" class="btn-secondary lab-btn" data-accion="estadio">${escapeHtml(estadioUso.nombre)}</button>` : ''}
      <button type="button" class="btn-secondary lab-btn" data-accion="atacar"${s.activo ? '' : ' disabled'}>Atacar…</button>
      <button type="button" class="btn-primary lab-btn lab-btn-turno" data-accion="pasar">Terminar el turno</button>`
  } else if (fase === 'fin') {
    medio = '<p class="lab-guia">Partida terminada.</p>'
    botones = '<button type="button" class="btn-primary lab-btn" data-accion="otra">Otra partida</button>'
  }
  poner(
    $('#labCentro'),
    `${estadioBloque}
     <div class="lab-centro-medio">${medio}</div>
     <div class="lab-centro-botones">${botones}</div>`
  )
}

// Lo que el otro te tiene prohibido ESTE turno, a la vista (tanda 462):
// Polen Picazón de Budew, el Grito de Scream Tail, Jellicent ex de activo…
function vetosHtml(p) {
  const out = []
  const chip = (texto, por) => out.push(`<span class="lab-estado lab-estado-alerta"${por ? ` title="${escapeHtml(por)}"` : ''}>${texto}</span>`)
  const v = (que) => p.vetado(que)
  if (v('objetos')) chip('Sin objetos este turno', v('objetos'))
  if (v('partidarios')) chip('Sin partidarios este turno', v('partidarios'))
  if (v('evolucionar')) chip('Sin evolucionar desde la mano', v('evolucionar'))
  const cierre = p.cierreDelRival()
  if (cierre.herramientas) chip('Sin objetos ni herramientas', `Mientras ${cierre.herramientas} siga de activo`)
  else if (cierre.objetos) chip('Sin objetos', `Mientras ${cierre.objetos} siga de activo`)
  if (cierre.aceSpec) chip('Sin AS TÁCTICO', `Lo impide ${cierre.aceSpec}`)
  return out.join('')
}

function pintarPropio() {
  const el = $('#labLadoPropio')
  el.setAttribute('aria-label', L.mesa ? `Lado de ${L.partida.nombreJugador} (le toca)` : 'Tu lado de la mesa')
  poner(el, ladoHtml(L.partida))
}

// La mano: cada carta con su «⋯» para todo lo demás. Las que se pueden
// jugar ahora mismo van marcadas: es lo primero que se busca en la mesa.
function pintarMano() {
  const p = L.partida
  const s = p.s
  $('#labManoTitulo').textContent = L.mesa ? `Mano de ${p.nombreJugador} (${s.mano.length})` : `Tu mano (${s.mano.length})`
  const jugable = (u) => (s.fase === 'preparacion' ? esPokemon(p.carta(u)) && esBasicoEnJuego(p.carta(u)) : p.opcionesDeMano(u).some((o) => !o.no))
  poner(
    $('#labMano'),
    s.mano.length
      ? s.mano
          .map((u) => {
            const j = s.fase === 'turno' || s.fase === 'preparacion' ? jugable(u) : false
            const nombre = escapeHtml(p.nombre(u))
            const apuntando = L.apuntar?.uid === u
            const elegible = L.elegir?.tipo === 'cartas' && L.elegir.valen.has(u)
            return `<div class="lab-mano-carta${j && !L.elegir ? ' lab-jugable' : ''}${apuntando ? ' lab-apuntando' : ''}${elegible ? ' lab-elegible-mano' : ''}">
              ${cartaHtml(u, { extra: ` data-mano${j ? '' : ' data-no-jugable'}`, nueva: L.nuevas?.has(u), etiqueta: `${nombre}${j ? '' : ' (ahora no se puede jugar)'}` })}
              <button type="button" class="lab-mas" data-mas="${u}" aria-label="Más opciones: ${nombre}" title="Más opciones">${icons.moreHorizontal(16)}</button>
            </div>`
          })
          .join('')
      : '<p class="lab-vacio">No hay cartas en la mano.</p>'
  )
}


function pintarApuntar() {
  const el = $('#labApuntar')
  if (!el) return
  const a = L.apuntar
  const e = L.elegir
  el.classList.toggle('hidden', !a && !e)
  el.classList.toggle('lab-elegir-barra', !!e)
  L.raiz.classList.toggle('lab-modo-apuntar', !!a)
  L.raiz.classList.toggle('lab-modo-elegir', !!e)
  // En la raíz va `data-eligiendo` y no `data-elegir`: ese es el de lo que
  // se toca, y un `closest('[data-elegir]')` acabaría en la raíz.
  if (e) L.raiz.dataset.eligiendo = e.tipo
  else delete L.raiz.dataset.eligiendo
  if (e) return poner(el, barraElegirHtml(e))
  if (!a) return poner(el, '')
  poner(el, `<span>${escapeHtml(a.texto)}</span><button type="button" class="btn-secondary lab-btn" data-accion="no-apuntar">Cancelar <kbd>Esc</kbd></button>`)
}

function pintarFin() {
  const el = $('#labFin')
  if (!el) return
  const m = L.mesa
  const s = L.partida.s
  if (m ? m.fase !== 'fin' || !m.m.resultado : s.fase !== 'fin' || !s.resultado) {
    el.classList.add('hidden')
    return
  }
  let titulo, texto, sub
  if (m) {
    const r = m.m.resultado
    titulo = r.tipo === 'sin-basicos' ? 'No se puede empezar' : `Gana ${escapeHtml(m.jugadores[r.ganador].nombreJugador)}`
    texto = escapeHtml(r.texto)
    sub = r.tipo === 'sin-basicos' ? '' : m.jugadores.map((j) => `${escapeHtml(j.nombreJugador)}: ${6 - j.s.premios.length} premios cogidos`).join(' · ') + ` · ${m.m.turnoGlobal} turnos`
  } else {
    const r = s.resultado
    titulo = r.tipo === 'victoria' ? '¡Victoria!' : r.tipo === 'sin-basicos' ? 'No se puede empezar' : 'Fin de la partida'
    texto = escapeHtml(r.texto)
    sub = `${s.mulligans ? `${s.mulligans} ${s.mulligans === 1 ? 'mulligan' : 'mulligans'} · ` : ''}${s.rival.caidos || 0} KO al rival · ${6 - s.premios.length} premios cogidos`
  }
  const puede = m ? m.puedeDeshacer : L.partida.puedeDeshacer
  // La copa, solo cuando alguien gana (no con «no se puede empezar»).
  const gana = m ? m.m.resultado?.tipo !== 'sin-basicos' && m.m.resultado?.ganador != null : s.resultado?.tipo === 'victoria'
  poner(
    el,
    `<div class="lab-fin-caja">
      ${gana ? `<span class="lab-fin-icono" aria-hidden="true">${icons.trophy(28)}</span>` : ''}
      <h3>${titulo}</h3>
      <p>${texto}</p>
      ${sub ? `<p class="subtext">${sub}</p>` : ''}
      <div class="lab-acciones-botones">
        <button type="button" class="btn-primary lab-btn" data-accion="otra">Otra partida</button>
        ${puede ? '<button type="button" class="btn-secondary lab-btn" data-accion="deshacer">Deshacer lo último</button>' : ''}
      </div>
      ${gana && m ? botonesDelRegistro() : ''}
    </div>`
  )
  el.classList.remove('hidden')
}

// ════════════════════════════════════════════════════════════════════
// El panel: probabilidades y registro
// ════════════════════════════════════════════════════════════════════
//
// PINGU: «la pestaña de probabilidades, que siempre tengas la opción de
// verla». En pantalla ancha va pegada a la derecha de la mesa; en una
// estrecha, una pestaña fija abajo la abre por encima.

const pct = (x) => (x == null || Number.isNaN(x) ? '—' : x >= 0.9995 ? '100 %' : x > 0 && x < 0.0005 ? '<0,1 %' : `${(x * 100).toFixed(x < 0.1 && x > 0 ? 1 : 0).replace('.', ',')} %`)
// El nivel de una probabilidad, para el color de su barra: de un vistazo
// se ve qué es casi seguro y qué es una lotería.
const nivel = (x) => (x == null ? 0 : x >= 0.75 ? 3 : x >= 0.4 ? 2 : x > 0 ? 1 : 0)
const barra = (x) => `<span class="lab-barra-prob" data-nivel="${nivel(x)}" aria-hidden="true"><span style="--pct: ${Math.round((x || 0) * 100)}%"></span></span>`

// Una fila por NOMBRE (las impresiones de una misma carta van juntas),
// en el orden de las secciones del constructor.
function gruposDelMazo(entradas) {
  const secc = seccionesDelMazo(entradas)
  const salida = []
  for (const [clave, titulo] of [['P', 'Pokémon'], ['T', 'Entrenadores'], ['X', 'Sin clasificar'], ['E', 'Energías']]) {
    const vistas = new Map()
    for (const e of secc[clave]) {
      const k = claveDeNombre(e.carta)
      if (!vistas.has(k)) vistas.set(k, { clave: k, carta: e.carta, n: 0 })
      vistas.get(k).n += e.n
    }
    if (vistas.size) salida.push({ titulo, grupos: [...vistas.values()] })
  }
  return salida
}

const GRUPOS_ESPECIALES = [
  { id: 'basicos', texto: 'Cualquier Pokémon básico', f: (c) => esPokemon(c) && esBasicoEnJuego(c) },
  { id: 'partidarios', texto: 'Cualquier Partidario', f: (c) => esPartidario(c) },
  { id: 'energias', texto: 'Cualquier Energía', f: (c) => esEnergia(c) },
]

function pintarPanel() {
  const el = $('#labPanel')
  const abierto = panelVisible()
  L.raiz.classList.toggle('lab-con-panel', abierto)
  const pestana = $('#labPanelPestana')
  pestana?.setAttribute('aria-expanded', String(abierto))
  pestana?.classList.toggle('hidden', abierto)
  if (!el) return
  el.classList.toggle('hidden', !abierto)
  if (!abierto) return
  const pest = L.panelPestania
  const p = L.partida
  const tab = (id, texto) => `<button type="button" role="tab" class="lab-pestania${pest === id ? ' activa' : ''}" aria-selected="${pest === id}" data-panel-pestania="${id}">${texto}</button>`
  const cab = `
    <div class="lab-panel-cab">
      <h3 id="labPanelTitulo">${pest === 'registro' ? 'Registro' : pest === 'caminos' ? `Encontrar una carta${L.mesa ? ` · ${escapeHtml(p.nombreJugador)}` : ''}` : `Probabilidades${L.mesa ? ` · ${escapeHtml(p.nombreJugador)}` : ''}`}</h3>
      <button type="button" class="lab-cerrar lab-panel-cerrar" data-accion="panel" aria-label="Cerrar el panel">×</button>
    </div>
    <div class="lab-pestanias" role="tablist" aria-label="Qué enseña el panel">
      ${tab('ahora', 'Esta partida')}${tab('caminos', 'Encontrar')}${tab('mazo', 'El mazo')}${tab('registro', 'Registro')}
    </div>`
  const cuerpo = pest === 'registro' ? registroHtml() : pest === 'mazo' ? tablaMazo() : pest === 'caminos' ? caminosHtml() : tablaAhora()
  poner(el, `${cab}<div class="lab-panel-cuerpo" id="labPanelCuerpo">${cuerpo}</div>`)
  if (pest === 'registro') {
    const lista = $('#labRegistro')
    if (lista) lista.scrollTop = lista.scrollHeight
  }
}

// Repintar el panel sin perder el foco del control que lo ha pedido.
function repintarPanel() {
  const foco = marcaDelFoco()
  pintarPanel()
  devolverFoco(foco)
}

// «Tú contra ti» (tanda 592): la partida escrita como la escribe TCG Live
// (constructor/diario.js), para copiarla o verla en /repeticiones.
function botonesDelRegistro() {
  // Solo de una partida ENTERA: una posición que viene de una repetición o de
  // un enlace empieza a medias, y su registro no se podría reproducir.
  if (L.mesa?.m.diario?.[0] !== 'Preparación') return ''
  return `<div class="lab-registro-live">
      <button type="button" class="btn-secondary lab-btn" data-accion="copiar-registro">${icons.alignLeft(16)} Copiar el registro</button>
      <button type="button" class="btn-secondary lab-btn" data-accion="ver-repeticion">${icons.eye(16)} Verla como repetición</button>
    </div>`
}

async function copiarRegistro() {
  const texto = L.mesa?.registroLive
  if (!texto) return
  try {
    await navigator.clipboard.writeText(texto)
    showToast('Registro copiado: pégalo en Repeticiones para verla jugada a jugada, o guárdalo.', 'success')
  } catch {
    // Sin portapapeles, en una ventana para copiarlo a mano.
    const caja = abrirDialogo(
      `<h3 id="labDialogoTitulo">El registro de la partida</h3>
      <div class="lab-dialogo-cuerpo">
        <label class="subtext" for="labRegistroLive">Selecciónalo y cópialo (Ctrl+C):</label>
        <textarea id="labRegistroLive" class="lab-registro-texto" rows="10" readonly spellcheck="false">${escapeHtml(texto)}</textarea>
      </div>
      <div class="lab-dialogo-botones"><button type="button" class="btn-secondary lab-btn" data-dlg="cancelar">Cerrar</button></div>`
    )
    caja.onclick = (e) => e.target.closest('[data-dlg="cancelar"]') && cerrarDialogo()
    caja.querySelector('#labRegistroLive')?.select()
  }
}

// A /repeticiones en otra pestaña, con la partida esperando (la misma clave
// que usa la propia página para «guardar sin cuenta»): se abre sola, y con
// sesión ofrece guardarla eligiendo quién eras.
function verComoRepeticion() {
  const texto = L.mesa?.registroLive
  if (!texto) return
  try {
    sessionStorage.setItem('pokedoc-repeticion-pendiente', texto)
  } catch {
    return copiarRegistro()
  }
  const w = window.open('/repeticiones', '_blank')
  if (!w) location.href = '/repeticiones'
}

function registroHtml() {
  const m = L.mesa
  const r = (m ? m.m.registro : L.partida.s.registro).slice(-160)
  const chapa = (j) => (m && j >= 0 ? `<span class="lab-jugador lab-jugador-mini" data-j="${j}">J${j + 1}</span>` : '')
  const linea = (x) => {
    if (/^── /.test(x.texto)) return `<li class="lab-registro-turno"><span>${escapeHtml(x.texto.replace(/^──\s*|\s*──$/g, ''))}</span></li>`
    return `<li>${chapa(x.j)}<span>${escapeHtml(x.texto)}</span></li>`
  }
  return `${m && m.fase !== 'mulligan' && m.fase !== 'preparacion' ? botonesDelRegistro() : ''}<ol class="lab-registro-lista" id="labRegistro">${r.map(linea).join('') || '<li>Aún no ha pasado nada.</li>'}</ol>`
}

function tablaAhora() {
  const p = L.partida
  const s = p.s
  if (s.fase === 'fin' && (s.resultado?.tipo === 'sin-basicos' || L.mesa?.m.resultado?.tipo === 'sin-basicos')) return '<p class="subtext">No hay partida.</p>'
  const ctx = contextoDeProbabilidad(p)
  const n = L.nRobos
  const sel = [...L.seleccion]
  const fila = (texto, f, { clase = '', check = '', pie = '' } = {}) => {
    const r = probabilidadDeGrupo(p, f, n, ctx)
    const apagada = r.quedan === 0
    const premios = r.premiosExactos != null ? `${r.premiosExactos}` : pct(r.todasPremiadas)
    return `<tr class="${clase}${apagada ? ' lab-fila-apagada' : ''}">
      <th scope="row">${check}<span class="lab-fila-nombre">${texto}</span>${pie}</th>
      <td class="lab-num">${r.quedan}</td>
      <td><span class="lab-num">${pct(r.siguiente)}</span>${barra(r.siguiente)}</td>
      <td><span class="lab-num">${pct(r.enN)}</span>${barra(r.enN)}</td>
      <td class="lab-num" title="${r.premiosExactos != null ? 'Sabes exactamente cuántas hay en los premios' : `Se esperan ${r.esperadasPremios.toFixed(2).replace('.', ',')} en los premios`}">${premios}</td>
    </tr>`
  }
  const enMano = (k) => s.mano.filter((u) => claveDeNombre(p.carta(u)) === k).length
  let filas = ''
  if (sel.length) {
    const set = new Set(sel)
    filas += fila(`<strong>Cualquiera de tus ${sel.length} marcadas</strong>`, (c) => set.has(claveDeNombre(c)), { clase: 'lab-fila-grupo lab-fila-marcadas' })
  }
  filas += GRUPOS_ESPECIALES.map((g) => fila(g.texto, g.f, { clase: 'lab-fila-grupo' })).join('')
  for (const seccion of gruposDelMazo(mazoDe(p).entradas)) {
    filas += `<tr class="lab-fila-seccion"><th colspan="5" scope="colgroup">${seccion.titulo}</th></tr>`
    for (const g of seccion.grupos) {
      const m = enMano(g.clave)
      filas += fila(escapeHtml(nombreVisible(g.carta)), (c) => claveDeNombre(c) === g.clave, {
        check: `<input type="checkbox" class="lab-marca" data-marca="${escapeHtml(g.clave)}"${L.seleccion.has(g.clave) ? ' checked' : ''} aria-label="Marcar ${escapeHtml(nombreVisible(g.carta))} para sumarla a «cualquiera de las marcadas»" />`,
        pie: `<span class="lab-fila-pie">${g.n} en la lista${m ? ` · ${m} en mano` : ''}</span>`,
      })
    }
  }
  const sabidas = ctx.conf.length + ctx.t + ctx.b
  const saber = ctx.S === 0 && ctx.Ph > 0 ? 'Ya has visto tu mazo entero: sabes qué hay en los premios.' : sabidas ? `Sabes ${sabidas} ${sabidas === 1 ? 'carta' : 'cartas'} del mazo (las viste y siguen dentro).` : 'Aún no has mirado el mazo: lo que no ves puede estar en él o en los premios.'
  return `
    <div class="lab-prob-resumen">
      <div class="lab-cifra"><span class="lab-cifra-valor">${ctx.D}</span><span class="lab-cifra-texto">en el mazo</span></div>
      <div class="lab-cifra"><span class="lab-cifra-valor">${ctx.Ph}</span><span class="lab-cifra-texto">premios boca abajo</span></div>
      <div class="lab-cifra"><span class="lab-cifra-valor">${s.fase === 'preparacion' || s.fase === 'mulligan' ? '—' : s.turno}</span><span class="lab-cifra-texto">${L.mesa ? 'su turno' : 'tu turno'}</span></div>
    </div>
    <p class="subtext lab-prob-saber">${saber}</p>
    <div class="lab-contador lab-robos" role="group" aria-label="Cuántos robos mirar">
      <span>Mirar los próximos</span>
      <button type="button" class="lab-mini" data-robos="-1" aria-label="Un robo menos">−</button>
      <strong>${n}</strong>
      <button type="button" class="lab-mini" data-robos="1" aria-label="Un robo más">+</button>
      <span>${n === 1 ? 'robo' : 'robos'}</span>
    </div>
    <div class="lab-tabla-caja">
      <table class="lab-tabla">
        <thead><tr><th scope="col">Carta</th><th scope="col" title="En el mazo o en los premios">Quedan</th><th scope="col">Próximo robo</th><th scope="col">En ${n} ${n === 1 ? 'robo' : 'robos'}</th>${ctx.S === 0 && ctx.Ph > 0 ? '<th scope="col" title="Ya has visto el mazo entero: sabes cuántas hay en los premios">En premios</th>' : '<th scope="col" title="Probabilidad de que TODAS las que quedan estén en los premios">Todas en premios</th>'}</tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <p class="subtext lab-prob-nota">Calculado con lo que <strong>tú</strong> sabes en la mesa, no con el orden real del mazo: lo que no has visto está repartido al azar entre el mazo y los premios boca abajo. Marca varias cartas para ver la probabilidad de robar cualquiera de ellas.</p>`
}

// ── «¿Cómo la encuentro?» (tanda 554) ──
//
// Eliges una carta y se juegan, en cientos de repartos de lo que no sabes,
// todos los caminos que tienes AHORA (constructor/caminos.js). El cálculo
// cambia el estado de la partida mientras dura cada tanda, así que la mesa
// queda `ocupada` hasta que acaba (lo de tocar está bloqueado).
const firmaDeMesa = (p) => JSON.stringify([p.s.turno, p.s.fase, p.s.mano, p.s.mazo.length, p.s.descarte.length, p.s.premios.length, p.enJuego.map((x) => [x.id, x.cartas.length]), p.s.flags.partidario, p.s.flags.usos])

function caminosHtml() {
  const p = L.partida
  if (!p || p.s.fase !== 'turno') return '<p class="subtext">Los caminos se buscan en tu turno, que es cuando puedes jugar cartas y usar habilidades.</p>'
  const secciones = gruposDelMazo(mazoDe(p).entradas)
  const todas = secciones.flatMap((x) => x.grupos)
  const elegida = todas.some((g) => g.clave === L.caminos.clave) ? L.caminos.clave : todas[0]?.clave
  const opciones = secciones
    .map((x) => `<optgroup label="${escapeHtml(x.titulo)}">${x.grupos.map((g) => `<option value="${escapeHtml(g.clave)}"${g.clave === elegida ? ' selected' : ''}>${escapeHtml(nombreVisible(g.carta))}</option>`).join('')}</optgroup>`)
    .join('')
  const c = L.caminos
  let resultado = ''
  if (c.calculando) resultado = `<p class="lab-caminos-calculando">Jugando los caminos con ${escapeHtml(c.nombre)}…</p>`
  else if (c.resultado && c.de === p && c.firma === firmaDeMesa(p)) resultado = resultadoDeCaminosHtml(c.resultado, c.nombre)
  else if (c.resultado) resultado = `<p class="lab-caminos-vacio">La mesa ha cambiado desde que buscaste ${escapeHtml(c.nombre)}: vuelve a buscar.</p>`
  return `
    <p class="subtext lab-caminos-intro">Elige la carta que quieres encontrar y te digo cada camino que tienes ahora —objetos, partidarios y habilidades— con la probabilidad de traerla.</p>
    <div class="lab-caminos-elegir">
      <label class="lab-caminos-campo"><span>La carta</span><select id="labCaminosCarta">${opciones}</select></label>
      <button type="button" class="btn-primary lab-btn" data-caminos${c.calculando ? ' disabled' : ''}>${icons.search(16)} Buscar caminos</button>
    </div>
    <div class="lab-caminos-resultado" role="status">${resultado}</div>`
}

async function buscarCaminosAhora() {
  const p = L.partida
  if (L.ocupado || !p || p.s.fase !== 'turno') return
  const clave = $('#labCaminosCarta')?.value || L.caminos.clave
  const grupo = gruposDelMazo(mazoDe(p).entradas)
    .flatMap((x) => x.grupos)
    .find((g) => g.clave === clave)
  if (!grupo) return
  L.ocupado = true
  L.caminos = { clave, nombre: nombreVisible(grupo.carta), resultado: null, calculando: true, firma: firmaDeMesa(p), de: p }
  repintarPanel()
  try {
    const { buscarCaminos } = await import('./caminos.js')
    const resultado = await buscarCaminos({
      partida: p,
      objetivo: (c) => claveDeNombre(c) === clave,
      muestras: 400,
      // Entre tanda y tanda la página respira (con el estado de verdad
      // puesto: el cálculo lo devuelve antes de ceder).
      ceder: () => new Promise((r) => setTimeout(r, 0)),
    })
    L.caminos = { ...L.caminos, resultado, calculando: false }
  } catch (err) {
    console.error(err)
    L.caminos = { ...L.caminos, calculando: false }
    showToast(`No se han podido calcular los caminos: ${err?.message || err}`, 'error')
  } finally {
    L.ocupado = false
    repintarPanel()
  }
}

function tablaMazo() {
  const mazo = mazoDe(L.partida)
  const o = mazo?.odds
  if (!o || o.total < 13) return '<p class="subtext">Hacen falta al menos 13 cartas.</p>'
  const filas = []
  for (const seccion of gruposDelMazo(mazo.entradas)) {
    filas.push(`<tr class="lab-fila-seccion"><th colspan="5" scope="colgroup">${seccion.titulo}</th></tr>`)
    for (const g of seccion.grupos) {
      const d = o.grupos.find((x) => x.clave === g.clave)
      if (!d) continue
      filas.push(`<tr>
        <th scope="row"><span class="lab-fila-nombre">${escapeHtml(nombreVisible(g.carta))}</span><span class="lab-fila-pie">${g.n} en la lista</span></th>
        <td><span class="lab-num">${pct(d.enMano)}</span>${barra(d.enMano)}</td>
        <td><span class="lab-num">${pct(d.turno2)}</span>${barra(d.turno2)}</td>
        <td><span class="lab-num">${pct(d.turno3)}</span>${barra(d.turno3)}</td>
        <td class="lab-num">${pct(d.todasPremiadas)}</td>
      </tr>`)
    }
  }
  return `
    ${L.mesa ? `<p class="lab-prob-de">${escapeHtml(mazo.nombre)}</p>` : ''}
    <div class="lab-cifras">
      <div class="lab-cifra"><span class="lab-cifra-valor">${pct(o.mulligan)}</span><span class="lab-cifra-texto">de mulligan (${o.basicos} ${o.basicos === 1 ? 'básico' : 'básicos'} en ${o.total})</span></div>
      <div class="lab-cifra"><span class="lab-cifra-valor">${pct(o.dosBasicos)}</span><span class="lab-cifra-texto">de las manos que juegas salen con 2 o más básicos</span></div>
      <div class="lab-cifra"><span class="lab-cifra-valor">${o.mediaMulligans.toFixed(2).replace('.', ',')}</span><span class="lab-cifra-texto">mulligans de media por partida</span></div>
    </div>
    <div class="lab-tabla-caja">
      <table class="lab-tabla">
        <thead><tr><th scope="col">Carta</th><th scope="col">En la mano inicial</th><th scope="col" title="Mano inicial + 2 robos">Para tu turno 2</th><th scope="col" title="Mano inicial + 3 robos">Para tu turno 3</th><th scope="col">Todas en premios</th></tr></thead>
        <tbody>${filas.join('')}</tbody>
      </table>
    </div>
    <p class="subtext lab-prob-nota">Exactas, no simuladas, y contando con el mulligan: la mano que juegas es la que tiene un básico. «Para tu turno N» es la mano inicial más un robo por turno (el que va primero también roba en su primer turno).</p>`
}

// ════════════════════════════════════════════════════════════════════
// Jugar con un clic (tanda 456)
// ════════════════════════════════════════════════════════════════════
//
// Tocar una carta de la mano hace LO OBVIO: lo que haría cualquiera que
// la juega en la mesa. Si solo se puede hacer una cosa, se hace; si la
// carta va sobre un Pokémon y vale para varios (una energía, una
// evolución, una herramienta), se iluminan los que valen y se elige
// tocando uno. Lo raro (descartarla a mano, ponerla encima del mazo…) va
// en el «⋯». Y si no se puede jugar, se dice por qué.

function accionPrincipalDeMano(uid, ancla) {
  const p = L.partida
  const s = p.s
  const c = p.carta(uid)
  if (s.fase === 'preparacion') {
    if (!esBasicoEnJuego(c) || !esPokemon(c)) return showToast('En la preparación solo se ponen Pokémon básicos.', 'error')
    return hacer(() => p.colocar(uid, s.activo ? 'banca' : 'activo'))
  }
  if (s.fase !== 'turno') return
  const ops = p.opcionesDeMano(uid)
  const valen = ops.filter((o) => !o.no)
  if (!valen.length) {
    const porque = ops.find((o) => o.no)?.no || 'Esta carta no se puede jugar así.'
    showToast(`${nombreVisible(c)}: ${porque}`, 'error')
    return
  }
  const conSitio = valen.filter((o) => o.slot)
  if (valen.length === 1 || !conSitio.length) return hacer(() => p.jugarDeMano(uid, valen[0], ui))
  // Varios Pokémon posibles: a elegir en la mesa.
  const verbo = valen[0].id === 'evolucionar' ? `¿Qué Pokémon evoluciona a ${nombreVisible(c)}?` : valen[0].id === 'energia' ? `¿A quién unes ${nombreVisible(c)}?` : `¿A quién le pones ${nombreVisible(c)}?`
  L.apuntar = { uid, opciones: Object.fromEntries(conSitio.map((o) => [o.slot, o])), texto: `${verbo} Toca uno de los que brillan.`, ancla }
  pintar()
  // El foco, al primero que vale: con teclado también se elige. Y a la
  // vista en el centro: en el móvil la banca suele quedar por debajo.
  const primero = $(`.lab-apuntable [data-slot-carta]`)
  primero?.focus({ preventScroll: true })
  primero?.scrollIntoView({ block: 'center', inline: 'nearest' })
}

function cancelarApuntar() {
  if (!L.apuntar) return false
  const uid = L.apuntar.uid
  L.apuntar = null
  pintar()
  L.raiz.querySelector(`[data-mano][data-uid="${uid}"]`)?.focus()
  return true
}

// ════════════════════════════════════════════════════════════════════
// Menús de acción
// ════════════════════════════════════════════════════════════════════
//
// Un solo menú flotante que se abre junto a lo que se ha tocado. Cada
// opción que no se puede lleva su porqué debajo: «no puedes» sin decir
// por qué obliga a sabérse las reglas de memoria.

function abrirMenu(ancla, titulo, opciones) {
  const menu = $('#labMenu')
  menu.innerHTML = `
    <p class="lab-menu-titulo">${titulo}</p>
    ${opciones
      .map(
        (o, i) =>
          o.separador
            ? '<hr class="lab-menu-separador" />'
            : `<button type="button" role="menuitem" class="lab-menu-op${o.peligro ? ' lab-menu-peligro' : ''}" data-op="${i}"${o.no ? ' aria-disabled="true"' : ''}>
                <span>${o.texto}</span>${o.detalle ? `<span class="lab-menu-detalle">${o.detalle}</span>` : ''}${o.no ? `<span class="lab-menu-no">${escapeHtml(o.no)}</span>` : ''}
              </button>`
      )
      .join('')}`
  menu._opciones = opciones
  menu.classList.remove('hidden')
  // Junto al elemento, sin salirse de la pantalla. En el móvil va abajo,
  // como una hoja (lo pone el CSS).
  const r = ancla.getBoundingClientRect()
  const ancho = Math.min(320, window.innerWidth - 16)
  menu.style.setProperty('--x', `${Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8))}px`)
  const abajo = r.bottom + 8
  const alto = menu.offsetHeight
  menu.style.setProperty('--y', `${abajo + alto > window.innerHeight - 8 ? Math.max(8, r.top - alto - 8) : abajo}px`)
  // De dónde salió, para devolverle el foco al cerrar.
  menu._ancla = ancla
  // Si TODAS las opciones están vetadas no hay ninguna que enfocar, y
  // entonces el foco se queda donde estuviera —que tras repintar la mano
  // es el `body`— (tanda 423). Con el foco fuera del laboratorio, el
  // Escape no le llega: el menú se cerraba y el siguiente Escape no hacía
  // nada. Un menú abierto se queda SIEMPRE con el foco, aunque no haya
  // nada que pulsar: si no, no se puede ni leer con el teclado.
  const primera = menu.querySelector('[data-op]:not([aria-disabled])')
  ;(primera || menu).focus()
}

function cerrarMenu() {
  const menu = L.raiz && $('#labMenu')
  if (!menu || menu.classList.contains('hidden')) return
  menu.classList.add('hidden')
  // Y el foco vuelve a la carta desde la que se abrió. Si esa carta ya no
  // está —la mano se repinta en cada jugada— vuelve al laboratorio, que
  // es quien escucha el teclado.
  const ancla = menu._ancla
  menu._ancla = null
  if (menu.contains(document.activeElement) || document.activeElement === document.body) {
    if (ancla?.isConnected) ancla.focus()
    else L.raiz?.focus()
  }
}

function menuDeMano(uid, ancla) {
  const p = L.partida
  const c = p.carta(uid)
  const ops = p.opcionesDeMano(uid).map((o) => ({
    texto: escapeHtml(o.texto),
    no: o.no,
    accion: () => hacer(() => p.jugarDeMano(uid, o, ui)),
  }))
  const texto = textoDeCarta(c)
  if (ops.length) ops.push({ separador: true })
  ops.push({ texto: 'Ver la carta', accion: () => verCarta(c) })
  ops.push({ texto: 'Descartar', detalle: 'a mano, sin reglas', accion: () => hacer(() => p.moverCarta(uid, 'descarte')) })
  ops.push({ texto: 'Poner encima del mazo', detalle: 'a mano', accion: () => hacer(() => p.moverCarta(uid, 'arriba')) })
  ops.push({ texto: 'Barajar en el mazo', detalle: 'a mano', accion: () => hacer(() => p.moverCarta(uid, 'mazo')) })
  abrirMenu(ancla, `${escapeHtml(nombreVisible(c))}${texto ? `<span class="lab-menu-texto">${conSimbolos(texto)}</span>` : ''}`, ops)
}

function menuDeSlot(id, ancla) {
  const p = L.partida
  const s = p.s
  const slot = p.slot(id)
  if (!slot) return
  const c = p.cartaDe(slot)
  const ops = []
  if (s.fase === 'preparacion') {
    ops.push({ texto: 'Devolver a la mano', accion: () => hacer(() => p.descolocar(id)) })
  } else if (s.fase === 'turno') {
    if (slot === s.activo) {
      for (const at of p.ataquesDe(slot)) {
        const coste = p.costeDeAtaque(slot, at.ataque, at.prestado ? at.de : null)
        ops.push({
          texto: `Atacar: ${escapeHtml(at.ataque.name)}${at.ataque.damage ? ` · ${escapeHtml(String(at.ataque.damage))}` : ''}${at.prestado ? ` (de ${escapeHtml(nombreVisible(p.cartaDe(at.de)))})` : ''}`,
          detalle: costeHtml(coste),
          no: p.motivoNoAtacar(slot, at.ataque, at.prestado ? at.de : null),
          accion: () => hacer(() => p.atacar(slot, at.i, ui, { prestadoDe: at.prestado ? at.de.id : null })),
        })
      }
      ops.push({
        texto: 'Atacar a mano…',
        detalle: 'di tú el daño (para ataques que el catálogo aún no tiene)',
        no: s.estricta && p.primerTurnoDelPrimero ? 'Quien va primero no puede atacar en su primer turno.' : null,
        accion: () => hacer(async () => p.ataqueManual(ui, await ui.numero({ titulo: '¿Cuánto daño hace al activo rival?', min: 0, max: 990, paso: 10, valor: 100 }))),
      })
      ops.push({ texto: `Retirarse (coste ${p.costeDeRetirada(slot)})`, no: p.motivoNoRetirar(), accion: () => hacer(() => p.retirar(ui)) })
    }
    const hab = Array.isArray(c.abilities) && c.abilities[0]
    const def = p.habilidadDe(slot)
    // Las que actúan solas (defensas, cierres…) se leen del texto: no se
    // usan con un botón, y no son «a mano» (tanda 462).
    const pasiva = !def && rasgosDeCarta(c).length > 0
    if (hab || def) {
      ops.push({
        texto: `Habilidad: ${escapeHtml(hab?.name || def?.nombre || '')}`,
        detalle: def || pasiva ? '' : 'no automatizada: hazla a mano',
        no: p.motivoNoHabilidad(slot),
        accion: () => hacer(() => p.usarHabilidad(slot, ui)),
      })
    }
    if (slot !== s.activo) ops.push({ texto: 'Pasar al puesto activo', detalle: 'a mano, sin reglas', accion: () => hacer(() => p.cambiarActivo(slot)) })
  }
  ops.push({ separador: true })
  ops.push({ texto: 'Ver la carta', accion: () => verCarta(c, slot, p) })
  if (s.fase === 'turno') {
    ops.push({ texto: 'Poner o quitar daño…', detalle: 'a mano', accion: () => hacer(() => ajustarDanio(slot)) })
    ops.push({ texto: 'Estado especial…', detalle: 'a mano', accion: () => hacer(() => ajustarEstado(slot)) })
    if (!L.mesa) ops.push({ texto: 'Simular KO del rival', detalle: 'como si te lo hubiera dejado KO en su último turno', peligro: true, accion: () => hacer(() => koDelRival(slot)) })
    ops.push({ texto: 'Devolver a la mano', detalle: 'con todo lo unido', accion: () => hacer(() => devolverSlot(slot)) })
  }
  abrirMenu(ancla, escapeHtml(nombreVisible(c)), ops)
}

function costeHtml(coste) {
  if (!coste.length) return 'sin coste'
  return coste.map((l) => `<span class="lab-energia" data-tipo="${l}" title="${NOMBRE_DE_LETRA[l] || l}">${l}</span>`).join('')
}

async function ajustarDanio(slot) {
  // Sin escapar aquí: la ventana ya escapa el título («N&#39;s Zoroark»).
  const n = await ui.numero({ titulo: `Daño en ${nombreVisible(L.partida.cartaDe(slot))}`, texto: 'El total de daño que tiene (de 10 en 10).', min: 0, max: 990, paso: 10, valor: slot.danio })
  slot.danio = n
  L.partida.log(`${nombreVisible(L.partida.cartaDe(slot))} queda con ${n} de daño (a mano).`)
  L.partida.retirarKOPropios()
  await L.partida.reponerActivo(ui)
}

async function ajustarEstado(slot) {
  const op = await ui.opcion({ titulo: 'Estado especial', opciones: [{ id: 'nada', texto: 'Quitar todos' }, ...Object.entries(ESTADOS).map(([id, texto]) => ({ id, texto }))] })
  if (op === 'nada') slot.estados = []
  else ponerEstado(slot, op, L.partida.s.turno)
}

async function koDelRival(slot) {
  L.partida.koPropio(slot, { delRival: true, texto: 'ataque del rival (simulado)' })
  await L.partida.reponerActivo(ui)
}

async function devolverSlot(slot) {
  const p = L.partida
  p.s.mano.push(...p.cartasDelSlot(slot))
  p.quitarDelJuego(slot)
  p.log(`${nombreVisible(p.carta(slot.cartas[0]))} y lo unido vuelven a la mano (a mano).`)
  await p.reponerActivo(ui)
}

function menuDeMazo(ancla) {
  const p = L.partida
  const ops = [
    { texto: 'Robar una carta', detalle: 'a mano, fuera del robo del turno', accion: () => hacer(() => p.robar(1, { motivo: 'A mano' })) },
    { texto: 'Buscar en el mazo…', detalle: 'coger cualquier carta, a mano', accion: () => hacer(() => buscarAMano()) },
    { texto: 'Mirar las de arriba…', accion: () => hacer(() => mirarArribaAMano()) },
    { texto: 'Barajar', accion: () => hacer(() => (p.barajar(), p.log('Baraja el mazo.'))) },
  ]
  abrirMenu(ancla, `${L.mesa ? `Mazo de ${escapeHtml(p.nombreJugador)}` : 'Tu mazo'} · ${p.s.mazo.length}`, ops)
}

async function buscarAMano() {
  const p = L.partida
  const destino = await ui.opcion({ titulo: '¿Adónde van las que cojas?', opciones: [{ id: 'mano', texto: 'A la mano' }, { id: 'banca', texto: 'A la banca (solo básicos)' }, { id: 'descarte', texto: 'Al descarte' }] })
  await p.buscarEnMazo(ui, {
    titulo: 'Buscar en el mazo (a mano)',
    filtro: destino === 'banca' ? (c) => esPokemon(c) && esBasicoEnJuego(c) : () => true,
    max: destino === 'banca' ? Math.max(0, p.huecosBanca) : 60,
    destino,
  })
}

async function mirarArribaAMano() {
  const p = L.partida
  const n = await ui.numero({ titulo: '¿Cuántas miras?', min: 1, max: Math.max(1, p.s.mazo.length), valor: Math.min(7, p.s.mazo.length) })
  const vistas = p.mirarArriba(n)
  const el = await ui.cartas({ titulo: `Las ${vistas.length} de arriba, en orden: coge las que quieras`, opciones: vistas, min: 0, max: vistas.length, zona: 'mazo', enOrden: true })
  for (const u of el) {
    p.sacarDelMazo(u)
    p.s.mano.push(u)
  }
  if (el.length) p.log(`A la mano desde arriba: ${el.map((u) => p.nombre(u)).join(', ')}.`)
  if (await ui.confirmar({ titulo: 'Y las demás…', texto: '¿Barajas el mazo? (Si no, se quedan arriba, en el mismo orden.)', si: 'Barajar', no: 'Dejarlas' })) p.barajar()
}

function menuDeDescarte(ancla, partida = L.partida, { rival = false } = {}) {
  const p = partida
  const ops = [{ texto: `Ver el descarte (${p.s.descarte.length})`, no: p.s.descarte.length ? null : 'Está vacío.', accion: () => verZona('descarte', p) }]
  if (!rival) ops.push({ texto: 'Recuperar cartas…', detalle: 'a la mano, a mano', no: p.s.descarte.length ? null : 'Está vacío.', accion: () => hacer(() => recuperarAMano()) })
  abrirMenu(ancla, rival ? `Descarte de ${escapeHtml(p.nombreJugador)}` : L.mesa ? `Descarte de ${escapeHtml(p.nombreJugador)}` : 'Tu descarte', ops)
}

async function recuperarAMano() {
  const p = L.partida
  const el = await ui.cartas({ titulo: 'Del descarte a la mano (a mano)', opciones: [...p.s.descarte], min: 0, max: p.s.descarte.length, zona: 'descarte' })
  p.desdeDescarte(el, 'mano')
}

function menuDePremio(uid, ancla) {
  const p = L.partida
  const s = p.s
  const ops = [
    { texto: 'Coger este premio', detalle: 'a mano (al dejar KO al rival se coge solo)', no: s.fase === 'turno' ? null : 'Ahora no.', accion: () => hacer(() => { s.premios = s.premios.filter((u) => u !== uid); delete s.premiosVistos[uid]; s.mano.push(uid); p.log(`Coge un premio: ${p.nombre(uid)}.`) }) },
    { texto: 'Darles la vuelta a todos', detalle: 'es trampa: desde ahí las probabilidades saben qué hay', accion: () => hacer(() => { for (const u of s.premios) s.premiosVistos[u] = true; p.log('Mira sus premios (trampa).') }) },
  ]
  abrirMenu(ancla, 'Premio', ops)
}

function menuDeAtaque(ancla) {
  const p = L.partida
  if (!p.s.activo) return
  menuDeSlot(p.s.activo.id, ancla)
}

function menuDeEstadio(ancla) {
  const p = L.partida
  const s = p.s
  const c = p.carta(s.estadio)
  const def = EFECTOS.entrenadores[claveDeEfecto(c)]?.estadio
  const clave = `estadio:${claveDeEfecto(c)}`
  const ops = []
  if (def && s.fase === 'turno') {
    const r = def.puede?.(p)
    ops.push({
      texto: escapeHtml(def.nombre),
      no: s.flags.usos[clave] ? 'Ya lo has usado este turno.' : r && r !== true ? r : null,
      accion: () =>
        hacer(async () => {
          s.flags.usos[clave] = 1
          await def.usar(p, ui)
        }),
    })
  }
  ops.push({ texto: 'Ver la carta', accion: () => verCarta(c) })
  ops.push({ texto: 'Descartar el estadio', detalle: 'a mano', accion: () => hacer(() => { p.quitarEstadio(); p.log('Descarta el estadio (a mano).') }) })
  abrirMenu(ancla, escapeHtml(nombreVisible(c)), ops)
}

function menuDelRival(ancla) {
  const p = L.partida
  const ops = [
    {
      texto: 'Hacer daño a tu activo…',
      no: p.s.activo ? null : 'No tienes activo.',
      accion: () =>
        hacer(async () => {
          const n = await ui.numero({ titulo: '¿Cuánto daño te hace?', min: 10, max: 990, paso: 10, valor: 100 })
          const a = p.s.activo
          p.ponerDanio(a, n, { motivo: 'ataque del rival (simulado)' })
          // Casco de la Suerte: robar 2 al recibir daño de un ataque.
          if (p.herramientaActiva(a, 'lucky helmet')) p.robar(2, { motivo: 'Casco de la Suerte' })
          if (a.danio >= p.psDe(a)) {
            p.koPropio(a, { delRival: true, texto: 'ataque del rival (simulado)' })
            await p.reponerActivo(ui)
          }
        }),
    },
    { texto: 'Dejarte KO un Pokémon…', accion: () => hacer(async () => { const [id] = await ui.pokemon({ titulo: '¿Cuál te deja KO?', opciones: p.enJuego.map((x) => x.id), min: 1, max: 1 }); await koDelRival(p.slot(id)) }) },
  ]
  abrirMenu(ancla, 'El muñeco te ataca (simulado)', ops)
}

// ════════════════════════════════════════════════════════════════════
// Ventanas: el `ui` del motor
// ════════════════════════════════════════════════════════════════════
//
// Cada una devuelve una promesa. Cerrar sin elegir rechaza con
// `Cancelado`, y el motor deshace lo que la carta llevara hecho.

let cierreDialogo = null
// Una ventana que HAY que contestar (coger premios, quién sube de activo):
// cerrarla con Escape o tocando fuera dejaba la jugada esperando una
// respuesta que no llegaba nunca, y la mesa entera bloqueada.
let dialogoObligatorio = false
// De dónde se abrió, para devolverle el foco al cerrar.
let focoAntesDelDialogo = null

// Cada ventana es una VEZ: lo que llega tarde (el enlace de compartir)
// mira si su ventana sigue abierta antes de escribir, para no pisar otra.
let vezDialogo = 0
const sigueElDialogo = (vez) => vez === vezDialogo && !$('#labVelo').classList.contains('hidden')

function abrirDialogo(html, { alCerrar, ancho = '', obligatorio = false } = {}) {
  vezDialogo++
  cerrarMenu()
  const velo = $('#labVelo')
  const caja = $('#labDialogo')
  // Una ventana que sustituye a otra hereda su origen.
  if (velo.classList.contains('hidden')) focoAntesDelDialogo = { el: document.activeElement, marca: marcaDelFoco() }
  caja.className = `lab-dialogo${ancho ? ` lab-dialogo-${ancho}` : ''}`
  caja.innerHTML = html
  caja.onclick = null
  caja.onchange = null
  caja.oninput = null
  velo.classList.remove('hidden')
  cierreDialogo = alCerrar || null
  dialogoObligatorio = obligatorio
  requestAnimationFrame(() => (caja.querySelector('[autofocus], .lab-dialogo-cuerpo button, button') || caja).focus?.())
  return caja
}

function cerrarDialogo() {
  $('#labVelo').classList.add('hidden')
  $('#labDialogo').innerHTML = ''
  cierreDialogo = null
  dialogoObligatorio = false
  const antes = focoAntesDelDialogo
  focoAntesDelDialogo = null
  devolverFoco(antes?.marca, antes?.el)
}

function cancelarDialogo() {
  if (dialogoObligatorio) {
    $('#labDialogo').focus()
    return
  }
  const f = cierreDialogo
  cerrarDialogo()
  f?.()
}

function botonesDialogo({ ok = 'Confirmar', cancelar = true, okDes = false } = {}) {
  return `<div class="lab-dialogo-botones">
    ${cancelar ? '<button type="button" class="btn-secondary lab-btn" data-dlg="cancelar">Cancelar</button>' : ''}
    <button type="button" class="btn-primary lab-btn" data-dlg="ok"${okDes ? ' disabled' : ''}>${ok}</button>
  </div>`
}

// Ordenar para enseñar: al buscar en el mazo NO se enseña en su orden
// real (sería enseñar lo que vas a robar). Primero las que valen, por
// sección y nombre.
function ordenar(uids, elegibles) {
  const p = L.partida
  const peso = (c) => (esPokemon(c) ? 0 : esEnergia(c) ? 2 : 1)
  return [...uids].sort((a, b) => {
    const ea = elegibles.has(a) ? 0 : 1
    const eb = elegibles.has(b) ? 0 : 1
    const ca = p.carta(a)
    const cb = p.carta(b)
    return ea - eb || peso(ca) - peso(cb) || nombreVisible(ca).localeCompare(nombreVisible(cb), 'es')
  })
}

// Dónde está un Pokémon por su id: en cualquiera de los dos lados, o en
// el muñeco.
function buscarSlot(id) {
  const jugadores = L.mesa ? L.mesa.jugadores : [L.partida]
  for (const j of jugadores) {
    const slot = j.slot(id)
    if (slot) return { slot, partida: j }
  }
  if (!L.mesa) {
    const r = L.partida.s.rival
    const d = [r.activo, ...r.banca].find((x) => x?.id === id)
    if (d) return { dummy: d, rival: r }
  }
  return null
}

// ════════════════════════════════════════════════════════════════════
// Elegir en la mesa, sin ventana (tanda 594)
// ════════════════════════════════════════════════════════════════════
//
// PINGU: «muchas veces salen modales todo el rato… que ese chequeo sea
// simplemente resaltando las cartas que tienes que elegir o descartar. Para
// búsquedas sí está bien». Lo que se elige y YA ESTÁ EN LA MESA —cartas de
// tu mano, energías y herramientas unidas, un Pokémon, los premios— se
// elige tocándolo ahí: brilla lo que vale, se apaga lo demás, y una barra
// abajo dice qué se pide, cuántas llevas y deja confirmar o cancelar. Lo
// que no está a la vista (el mazo, el descarte, la mano del otro) sigue en
// una ventana: para enseñarlo hay que sacarlo de algún sitio.

// ¿Se ve en la mesa? La mano del que juega, lo unido a cualquier Pokémon
// en juego (de los dos lados, con mesa) y el estadio.
function seVeEnLaMesa(uid) {
  const p = L.partida
  if (p.s.mano.includes(uid) || p.s.estadio === uid) return true
  const lados = L.mesa ? [p, p.oponente] : [p]
  return lados.some((j) => j.enJuego.some((sl) => sl.energias.includes(uid) || sl.herramienta === uid))
}

function elegirEnLaMesa(cfg) {
  return new Promise((resolve, reject) => {
    cerrarMenu()
    L.apuntar = null
    L.elegir = { sel: new Set(), min: 0, max: 1, validar: null, sinCancelar: false, ...cfg, resolve, reject }
    pintar()
    // Lo primero que se puede tocar, a la vista y con el foco.
    requestAnimationFrame(() => {
      const primero = L.raiz.querySelector('[data-elegir]') || L.raiz.querySelector('#labApuntar button')
      primero?.scrollIntoView?.({ block: 'nearest' })
      primero?.focus({ preventScroll: true })
    })
  })
}

function errorDeElegir(e) {
  const n = e.sel.size
  return n < e.min || !e.validar ? '' : e.validar([...e.sel]) || ''
}
function puedeAcabarElegir(e) {
  const n = e.sel.size
  return n >= e.min && n <= e.max && !errorDeElegir(e)
}
// Tocar ya es elegir cuando no hay nada que pensar: un Pokémon entre
// varios, o los premios (boca abajo, como en la mesa de verdad).
const elegirAlTocar = (e) => (e.tipo === 'pokemon' && e.min === 1 && e.max === 1) || e.tipo === 'premios'

function barraElegirHtml(e) {
  const n = e.sel.size
  const err = errorDeElegir(e)
  const cuenta =
    e.tipo === 'confirmar'
      ? ''
      : e.tipo === 'premios'
        ? `Toca ${e.max === 1 ? 'uno' : `${e.max}`}: están boca abajo`
        : e.max === 1 && e.min <= 1
          ? n ? '1 elegida' : e.min ? 'Toca 1' : 'Toca 1 o ninguna'
          : `${n} de ${e.max}${e.min && e.min < e.max ? ` · mínimo ${e.min}` : ''}`
  const botones =
    e.tipo === 'confirmar'
      ? `<button type="button" class="btn-secondary lab-btn" data-elegir-accion="no">${escapeHtml(e.no || 'No')}</button>
         <button type="button" class="btn-primary lab-btn" data-elegir-accion="si">${escapeHtml(e.si || 'Sí')}</button>`
      : `${e.sinCancelar ? '' : '<button type="button" class="btn-secondary lab-btn" data-elegir-accion="cancelar">Cancelar <kbd>Esc</kbd></button>'}
         ${elegirAlTocar(e) ? '' : `<button type="button" class="btn-primary lab-btn" data-elegir-accion="ok"${puedeAcabarElegir(e) ? '' : ' disabled'}>Confirmar</button>`}`
  return `<div class="lab-elegir-texto">
      <strong class="lab-elegir-titulo">${escapeHtml(e.titulo || '')}</strong>
      ${e.texto ? `<span class="lab-elegir-sub">${escapeHtml(e.texto)}</span>` : ''}
      ${cuenta ? `<span class="lab-elegir-cuenta">${cuenta}</span>` : ''}
      ${err ? `<span class="lab-elegir-error" role="alert">${escapeHtml(err)}</span>` : ''}
    </div>
    <div class="lab-elegir-botones">${botones}</div>`
}

function acabarElegir(valor) {
  const e = L.elegir
  if (!e) return
  L.elegir = null
  pintar()
  e.resolve(valor)
}

// Devuelve true si había algo que cancelar (para Escape).
function cancelarElegir() {
  const e = L.elegir
  if (!e) return false
  if (e.tipo === 'confirmar') return acabarElegir(false), true
  // Lo obligatorio no se cancela: la barra se queda (y Escape no cierra
  // el laboratorio con una jugada a medias).
  if (e.sinCancelar) return true
  L.elegir = null
  pintar()
  e.reject(new Cancelado())
  return true
}

function tocarElegir(id) {
  const e = L.elegir
  if (!e?.valen.has(id)) return
  if (e.sel.has(id)) e.sel.delete(id)
  else {
    if (e.max === 1) e.sel.clear()
    if (e.sel.size < e.max) e.sel.add(id)
  }
  if (elegirAlTocar(e) && e.sel.size === e.max) return acabarElegir(e.tipo === 'premios' ? [...e.sel] : [id])
  pintar()
  L.raiz.querySelector(`[data-elegir="${CSS.escape(id)}"]`)?.focus({ preventScroll: true })
}

function accionElegir(que) {
  const e = L.elegir
  if (!e) return
  if (que === 'si') return acabarElegir(true)
  if (que === 'no') return acabarElegir(false)
  if (que === 'cancelar') return cancelarElegir()
  if (que === 'ok' && puedeAcabarElegir(e)) acabarElegir(e.tipo === 'cartas' ? e.orden.filter((x) => e.sel.has(x)) : [...e.sel])
}

// Lo que pregunta el motor: en la mesa cuando se puede, en una ventana
// cuando no.
const ui = {
  cartas(o) {
    // Un solo criterio: que TODAS las que valen estén a la vista. El mazo,
    // el descarte o la mano del otro no lo están, y eso ya las manda a la
    // ventana sin mirar la zona (mirarla también sería una segunda guarda
    // que tapa a la primera y ninguna prueba podría ver).
    const valen = o.elegibles || o.opciones
    if (!valen.length || !valen.every(seVeEnLaMesa)) return ventana.cartas(o)
    return elegirEnLaMesa({ tipo: 'cartas', titulo: o.titulo, texto: o.texto || '', valen: new Set(valen), orden: o.opciones, min: Math.min(o.min ?? 0, valen.length), max: o.max ?? 1, validar: o.validar || null, sinCancelar: !!o.sinCancelar })
  },
  pokemon(o) {
    // Mientras se prepara, el lado del otro está boca abajo: no se puede
    // tocar lo que no se ve.
    const enLaMesa = L.mesa?.fase !== 'preparacion' && o.opciones.length > 0 && o.opciones.every((id) => buscarSlot(id))
    if (!enLaMesa) return ventana.pokemon(o)
    return elegirEnLaMesa({ tipo: 'pokemon', titulo: o.titulo, texto: o.texto || '', valen: new Set(o.opciones), min: o.min ?? 1, max: o.max ?? 1, sinCancelar: !!o.sinCancelar })
  },
  confirmar(o) {
    return elegirEnLaMesa({ tipo: 'confirmar', titulo: o.titulo, texto: o.texto || '', si: o.si || 'Sí', no: o.no || 'No', valen: new Set() })
  },
  premios(o) {
    const p = o.partida || L.partida
    const seVen = p === L.partida || (L.mesa && p === L.partida.oponente)
    if (!seVen) return ventana.premios(o)
    return elegirEnLaMesa({ tipo: 'premios', titulo: o.titulo, valen: new Set(p.s.premios), min: o.n, max: o.n, sinCancelar: true, partida: p })
  },
  opcion: (o) => ventana.opcion(o),
  numero: (o) => ventana.numero(o),
  repartir: (o) => ventana.repartir(o),
}

// Las ventanas: para lo que no está en la mesa (y para lo que no es elegir
// cartas: un número, un reparto, una lista de opciones).
const ventana = {
  cartas({ titulo, texto = '', opciones, elegibles = null, min = 0, max = 1, validar = null, zona = '', enOrden = false, sinCancelar = false }) {
    return new Promise((resolve, reject) => {
      const p = L.partida
      const valen = new Set(elegibles || opciones)
      const lista = enOrden || zona !== 'mazo' ? opciones : ordenar(opciones, valen)
      const sel = new Set()
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         ${texto ? `<p class="subtext">${escapeHtml(texto)}</p>` : ''}
         <p class="lab-dialogo-cuenta" aria-live="polite"></p>
         <div class="lab-dialogo-cuerpo"><div class="lab-rejilla-cartas">
           ${lista.map((u) => `<button type="button" class="lab-carta lab-elegible${valen.has(u) ? '' : ' lab-no-vale'}" data-elige="${u}" aria-pressed="false"${valen.has(u) ? '' : ' disabled'} aria-label="${escapeHtml(p.nombre(u))}">${imagenHtml(p.carta(u))}</button>`).join('') || '<p class="subtext">No hay cartas.</p>'}
         </div></div>
         <p class="lab-dialogo-error" role="alert"></p>
         ${botonesDialogo({ cancelar: !sinCancelar })}`,
        { alCerrar: sinCancelar ? null : () => reject(new Cancelado()), obligatorio: sinCancelar }
      )
      const repasar = () => {
        const n = sel.size
        caja.querySelector('.lab-dialogo-cuenta').textContent = max === 1 && min <= 1 ? (n ? '1 elegida' : min ? 'Elige 1' : 'Elige 1 o ninguna') : `${n} de ${max} como mucho${min ? ` (mínimo ${min})` : ''}`
        const err = n < min ? '' : validar ? validar([...sel]) || '' : ''
        caja.querySelector('.lab-dialogo-error').textContent = err
        caja.querySelector('[data-dlg="ok"]').disabled = n < min || n > max || !!err
      }
      caja.onclick = (e) => {
        const b = e.target.closest('[data-elige]')
        if (b && !b.disabled) {
          const u = b.dataset.elige
          if (sel.has(u)) sel.delete(u)
          else {
            if (max === 1) {
              sel.clear()
              caja.querySelectorAll('[data-elige][aria-pressed="true"]').forEach((x) => x.setAttribute('aria-pressed', 'false'))
            }
            if (sel.size < max) sel.add(u)
          }
          b.setAttribute('aria-pressed', String(sel.has(u)))
          repasar()
          return
        }
        const d = e.target.closest('[data-dlg]')
        if (!d) return
        if (d.dataset.dlg === 'cancelar') return cancelarDialogo()
        if (d.dataset.dlg === 'ok') {
          const out = lista.filter((u) => sel.has(u))
          cerrarDialogo()
          resolve(out)
        }
      }
      repasar()
    })
  },

  pokemon({ titulo, texto = '', opciones, min = 1, max = 1, sinCancelar = false }) {
    return new Promise((resolve, reject) => {
      const sel = new Set()
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         ${texto ? `<p class="subtext">${escapeHtml(texto)}</p>` : ''}
         <div class="lab-dialogo-cuerpo"><div class="lab-rejilla-pokemon">
           ${opciones
             .map((id) => {
               const e = buscarSlot(id)
               if (e?.slot) {
                 const { slot, partida } = e
                 const c = partida.cartaDe(slot)
                 const ajeno = L.mesa && partida !== L.partida
                 const de = L.mesa ? ` · ${escapeHtml(partida.nombreJugador)}` : ''
                 return `<button type="button" class="lab-elegible lab-elegible-pokemon${ajeno ? ' lab-elegible-rival' : ''}" data-elige="${id}" aria-pressed="false">${imagenHtml(c)}<span class="lab-elegible-nombre">${escapeHtml(nombreVisible(c))}${slot === partida.s.activo ? ' (activo)' : ''}${de}</span><span class="subtext">${Math.max(0, partida.psDe(slot) - slot.danio)}/${partida.psDe(slot)} PS</span></button>`
               }
               const d = e?.dummy
               if (d) return `<button type="button" class="lab-elegible lab-elegible-pokemon lab-elegible-rival" data-elige="${id}" aria-pressed="false"><span class="lab-elegible-nombre">${d === e.rival.activo ? 'Activo rival' : 'Banca rival'}: ${escapeHtml(d.nombre)}</span><span class="subtext">${Math.max(0, d.ps - d.danio)}/${d.ps} PS</span></button>`
               return ''
             })
             .join('')}
         </div></div>
         ${botonesDialogo({ cancelar: !sinCancelar, okDes: min > 0 })}`,
        { alCerrar: sinCancelar ? null : () => reject(new Cancelado()), obligatorio: sinCancelar }
      )
      caja.onclick = (e) => {
        const b = e.target.closest('[data-elige]')
        if (b) {
          const id = b.dataset.elige
          if (sel.has(id)) sel.delete(id)
          else {
            if (max === 1) {
              sel.clear()
              caja.querySelectorAll('[data-elige][aria-pressed="true"]').forEach((x) => x.setAttribute('aria-pressed', 'false'))
            }
            if (sel.size < max) sel.add(id)
          }
          b.setAttribute('aria-pressed', String(sel.has(id)))
          caja.querySelector('[data-dlg="ok"]').disabled = sel.size < min
          // Con una sola elección, tocar ya es elegir.
          if (max === 1 && min === 1 && sel.size === 1) {
            cerrarDialogo()
            resolve([id])
          }
          return
        }
        const d = e.target.closest('[data-dlg]')
        if (!d) return
        if (d.dataset.dlg === 'cancelar') return cancelarDialogo()
        cerrarDialogo()
        resolve([...sel])
      }
    })
  },

  confirmar({ titulo, texto = '', si = 'Sí', no = 'No' }) {
    return new Promise((resolve) => {
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         <p>${escapeHtml(texto)}</p>
         <div class="lab-dialogo-botones">
           <button type="button" class="btn-secondary lab-btn" data-dlg="no">${escapeHtml(no)}</button>
           <button type="button" class="btn-primary lab-btn" data-dlg="si" autofocus>${escapeHtml(si)}</button>
         </div>`,
        { alCerrar: () => resolve(false) }
      )
      caja.onclick = (e) => {
        const d = e.target.closest('[data-dlg]')
        if (!d) return
        cerrarDialogo()
        resolve(d.dataset.dlg === 'si')
      }
    })
  },

  opcion({ titulo, texto = '', opciones }) {
    return new Promise((resolve, reject) => {
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         ${texto ? `<p class="subtext">${escapeHtml(texto)}</p>` : ''}
         <div class="lab-dialogo-cuerpo"><div class="lab-opciones">
           ${opciones.map((o) => `<button type="button" class="btn-secondary lab-btn lab-opcion" data-opcion="${escapeHtml(o.id)}"${o.no ? ' disabled' : ''}>${escapeHtml(o.texto)}${o.no ? `<span class="lab-menu-no">${escapeHtml(o.no)}</span>` : ''}</button>`).join('')}
         </div></div>
         <div class="lab-dialogo-botones"><button type="button" class="btn-secondary lab-btn" data-dlg="cancelar">Cancelar</button></div>`,
        { alCerrar: () => reject(new Cancelado()) }
      )
      caja.onclick = (e) => {
        const b = e.target.closest('[data-opcion]')
        if (b && !b.disabled) {
          cerrarDialogo()
          return resolve(b.dataset.opcion)
        }
        if (e.target.closest('[data-dlg="cancelar"]')) cancelarDialogo()
      }
    })
  },

  numero({ titulo, texto = '', min = 0, max = 999, paso = 1, valor = 0 }) {
    return new Promise((resolve, reject) => {
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         ${texto ? `<p class="subtext">${escapeHtml(texto)}</p>` : ''}
         <div class="lab-contador lab-numero">
           <button type="button" class="lab-mini" data-paso="-1" aria-label="Menos">−</button>
           <input type="number" inputmode="numeric" min="${min}" max="${max}" step="${paso}" value="${valor}" aria-label="${escapeHtml(titulo)}" autofocus />
           <button type="button" class="lab-mini" data-paso="1" aria-label="Más">+</button>
         </div>
         ${botonesDialogo()}`,
        { alCerrar: () => reject(new Cancelado()) }
      )
      const input = caja.querySelector('input')
      const leer = () => Math.max(min, Math.min(max, Math.round((Number(input.value) || 0) / paso) * paso))
      caja.onclick = (e) => {
        const b = e.target.closest('[data-paso]')
        if (b) {
          input.value = Math.max(min, Math.min(max, leer() + Number(b.dataset.paso) * paso))
          return
        }
        const d = e.target.closest('[data-dlg]')
        if (!d) return
        if (d.dataset.dlg === 'cancelar') return cancelarDialogo()
        const v = leer()
        cerrarDialogo()
        resolve(v)
      }
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const v = leer()
          cerrarDialogo()
          resolve(v)
        }
      }
    })
  },

  repartir({ titulo, total, opciones }) {
    return new Promise((resolve, reject) => {
      const reparto = Object.fromEntries(opciones.map((id) => [id, 0]))
      const datos = (id) => {
        const e = buscarSlot(id)
        if (e?.slot) {
          const ps = e.partida.psDe(e.slot)
          return { donde: e.slot === e.partida.s.activo ? 'Activo' : 'Banca', nombre: nombreVisible(e.partida.cartaDe(e.slot)), vida: Math.max(0, ps - e.slot.danio) }
        }
        if (e?.dummy) return { donde: e.dummy === e.rival.activo ? 'Activo' : 'Banca', nombre: e.dummy.nombre, vida: Math.max(0, e.dummy.ps - e.dummy.danio) }
        return { donde: '', nombre: id, vida: 0 }
      }
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         <p class="lab-dialogo-cuenta" aria-live="polite"></p>
         <div class="lab-dialogo-cuerpo"><div class="lab-reparto">
           ${opciones
             .map((id) => {
               const d = datos(id)
               return `<div class="lab-reparto-fila"><span>${d.donde}: ${escapeHtml(d.nombre)} <span class="subtext">(${d.vida} PS)</span></span>
                 <span class="lab-contador"><button type="button" class="lab-mini" data-rep="${id}" data-d="-1" aria-label="Uno menos">−</button><strong data-rep-n="${id}">0</strong><button type="button" class="lab-mini" data-rep="${id}" data-d="1" aria-label="Uno más">+</button></span></div>`
             })
             .join('')}
         </div></div>
         ${botonesDialogo({ okDes: true })}`,
        { alCerrar: () => reject(new Cancelado()) }
      )
      const repasar = () => {
        const usados = Object.values(reparto).reduce((a, b) => a + b, 0)
        caja.querySelector('.lab-dialogo-cuenta').textContent = `${usados} de ${total} repartidos`
        caja.querySelector('[data-dlg="ok"]').disabled = usados !== total
        for (const id of opciones) caja.querySelector(`[data-rep-n="${id}"]`).textContent = reparto[id]
      }
      caja.onclick = (e) => {
        const b = e.target.closest('[data-rep]')
        if (b) {
          const usados = Object.values(reparto).reduce((a, x) => a + x, 0)
          const d = Number(b.dataset.d)
          if (d > 0 && usados >= total) return
          reparto[b.dataset.rep] = Math.max(0, reparto[b.dataset.rep] + d)
          return repasar()
        }
        const d = e.target.closest('[data-dlg]')
        if (!d) return
        if (d.dataset.dlg === 'cancelar') return cancelarDialogo()
        cerrarDialogo()
        resolve(reparto)
      }
      repasar()
    })
  },

  // Coger premios: boca abajo, se eligen «a ciegas» (como en la mesa).
  // Con mesa, `partida` dice de quién son: puede ser el otro jugador (el
  // que coge porque le han dejado KO un Pokémon a su rival).
  premios({ titulo, n, partida = null }) {
    return new Promise((resolve) => {
      const p = partida || L.partida
      const s = p.s
      const sel = new Set()
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         <p class="subtext">Toca ${n === 1 ? 'el que quieras' : `${n} premios`}: están boca abajo.</p>
         <div class="lab-dialogo-cuerpo"><div class="lab-rejilla-cartas lab-rejilla-premios">
           ${s.premios.map((u, i) => (s.premiosVistos[u] ? `<button type="button" class="lab-carta lab-elegible" data-elige="${u}" aria-pressed="false" aria-label="${escapeHtml(p.nombre(u))}">${imagenHtml(p.carta(u))}</button>` : `<button type="button" class="lab-carta lab-elegible lab-carta-dorso" data-elige="${u}" aria-pressed="false" aria-label="Premio ${i + 1}">${dorsoHtml()}</button>`)).join('')}
         </div></div>
         ${botonesDialogo({ cancelar: false, okDes: true })}`,
        { obligatorio: true }
      )
      caja.onclick = (e) => {
        const b = e.target.closest('[data-elige]')
        if (b) {
          const u = b.dataset.elige
          if (sel.has(u)) sel.delete(u)
          else if (sel.size < n) sel.add(u)
          b.setAttribute('aria-pressed', String(sel.has(u)))
          caja.querySelector('[data-dlg="ok"]').disabled = sel.size !== n
          return
        }
        if (e.target.closest('[data-dlg="ok"]')) {
          cerrarDialogo()
          resolve([...sel])
        }
      }
    })
  },
}

// Los textos traen la energía como «{P}» (así la escriben Limitless y
// TCG Live). Se pinta con el mismo punto de color que las energías unidas.
function conSimbolos(texto) {
  return escapeHtml(texto).replace(/\{([GRWLPFDMCNY])\}/g, (m, l) => `<span class="lab-energia" data-tipo="${l}" title="${NOMBRE_DE_LETRA[l] || l}">${l}</span>`)
}

// ── Ver una carta en grande, con su texto ──
function verCarta(c, slot = null, partida = L.partida) {
  const p = partida || L.partida
  const texto = textoDeCarta(c)
  const ataques = Array.isArray(c.attacks) ? c.attacks : []
  const habs = Array.isArray(c.abilities) ? c.abilities : []
  const bloques = []
  if (esPokemon(c)) {
    const debil = (Array.isArray(c.weaknesses) ? c.weaknesses : []).map((w) => `debilidad ${escapeHtml(NOMBRE_DE_LETRA[letraDeTipoTexto(w.type)] || w.type || '')} ${escapeHtml(String(w.value || '×2'))}`)
    const resis = (Array.isArray(c.resistances) ? c.resistances : []).map((r) => `resistencia ${escapeHtml(NOMBRE_DE_LETRA[letraDeTipoTexto(r.type)] || r.type || '')} ${escapeHtml(String(r.value || '−30'))}`)
    bloques.push(`<p class="subtext">${[c.stage === 'Basic' ? 'Básico' : c.stage === 'Stage1' ? 'Fase 1' : c.stage === 'Stage2' ? 'Fase 2' : c.stage, c.hp ? `${c.hp} PS` : null, c.evolve_from ? `evoluciona de ${escapeHtml(c.evolve_from)}` : null, Number.isFinite(c.retreat) ? `retirada ${c.retreat}` : null, `${premiosQueDa(c)} ${premiosQueDa(c) === 1 ? 'premio' : 'premios'}`, ...debil, ...resis].filter(Boolean).join(' · ')}</p>`)
    for (const h of habs) {
      const auto = p?.efectos?.habilidades?.[claveDeEfecto(c)]
      bloques.push(`<div class="lab-texto-bloque"><p><strong>Habilidad: ${escapeHtml(h.name || '')}</strong> ${auto ? '<span class="lab-chapa">automática</span>' : '<span class="lab-chapa lab-chapa-manual">a mano</span>'}</p>${h.effect ? `<p>${conSimbolos(h.effect)}</p>` : ''}</div>`)
    }
    for (const a of ataques) {
      const def = p?.defDeAtaque(c, a)
      const { signo } = danioImpreso(a)
      const auto = def ? '<span class="lab-chapa">automático</span>' : a.effect && !signo ? '<span class="lab-chapa lab-chapa-manual">texto a mano</span>' : ''
      bloques.push(`<div class="lab-texto-bloque"><p>${costeHtml(costeEnLetras(a))} <strong>${escapeHtml(a.name || '')}</strong> ${a.damage ? `<strong>${escapeHtml(String(a.damage))}</strong>` : ''} ${auto}</p>${a.effect ? `<p>${conSimbolos(a.effect)}</p>` : ''}</div>`)
    }
    if (!habs.length && !ataques.length) bloques.push('<p class="subtext">El catálogo aún no tiene los ataques de esta carta.</p>')
  } else if (texto) {
    bloques.push(`<div class="lab-texto-bloque"><p>${conSimbolos(texto)}</p></div>`)
  } else if (!esEnergiaBasica(c)) {
    bloques.push('<p class="subtext">Su efecto no está automatizado en el laboratorio: juégala y hazlo a mano con las herramientas (tocar el mazo, el descarte o un Pokémon).</p>')
  }
  const caja = abrirDialogo(
    `<div class="lab-ver">
      <div class="lab-ver-img">${imagenHtml(c, 'high')}</div>
      <div class="lab-ver-texto">
        <h3 id="labDialogoTitulo">${escapeHtml(nombreVisible(c))}</h3>
        ${bloques.join('')}
        ${slot ? `<p class="subtext">${slot.danio ? `Daño: ${slot.danio}. ` : ''}${slot.cartas.length > 1 ? `Debajo: ${slot.cartas.slice(0, -1).map((u) => escapeHtml(p.nombre(u))).join(', ')}. ` : ''}${slot.energias.length ? `Energías: ${slot.energias.map((u) => escapeHtml(p.nombre(u))).join(', ')}. ` : ''}${slot.herramienta ? `Herramienta: ${escapeHtml(p.nombre(slot.herramienta))}.` : ''}</p>` : ''}
      </div>
    </div>
    <div class="lab-dialogo-botones"><button type="button" class="btn-primary lab-btn" data-dlg="ok">Cerrar</button></div>`
  )
  caja.onclick = (e) => {
    if (e.target.closest('[data-dlg]')) cerrarDialogo()
  }
}

// El tipo de una debilidad viene en inglés canónico («Fire»).
const LETRA_DE_NOMBRE = { grass: 'G', fire: 'R', water: 'W', lightning: 'L', psychic: 'P', fighting: 'F', darkness: 'D', metal: 'M', colorless: 'C', dragon: 'N', fairy: 'Y' }
const letraDeTipoTexto = (t) => LETRA_DE_NOMBRE[String(t || '').toLowerCase()] || null

function verZona(zona, partida = L.partida) {
  const p = partida
  const lista = zona === 'descarte' ? [...p.s.descarte].reverse() : []
  const de = L.mesa ? `de ${escapeHtml(p.nombreJugador)}` : ''
  const caja = abrirDialogo(
    `<h3 id="labDialogoTitulo">${de ? `Descarte ${de}` : 'Tu descarte'} (${lista.length})</h3>
     <div class="lab-dialogo-cuerpo"><div class="lab-rejilla-cartas">${lista.map((u) => `<button type="button" class="lab-carta" data-ver="${u}" aria-label="${escapeHtml(p.nombre(u))}">${imagenHtml(p.carta(u))}</button>`).join('') || '<p class="subtext">Está vacío.</p>'}</div></div>
     <div class="lab-dialogo-botones"><button type="button" class="btn-primary lab-btn" data-dlg="ok">Cerrar</button></div>`
  )
  caja.onclick = (e) => {
    const v = e.target.closest('[data-ver]')
    if (v) return verCarta(p.carta(v.dataset.ver), null, p)
    if (e.target.closest('[data-dlg]')) cerrarDialogo()
  }
}

function verMulligans() {
  const p = L.partida
  const caja = abrirDialogo(
    `<h3 id="labDialogoTitulo">Manos sin básico</h3>
     <p class="subtext">Se enseñan al rival, se barajan y se roba otra. Por cada una, el rival puede robar una carta de más.</p>
     <div class="lab-dialogo-cuerpo">${p.s.manosMulligan.map((m, i) => `<p class="lab-rotulo">Mulligan ${i + 1}</p><div class="lab-rejilla-cartas lab-rejilla-mini">${m.map((u) => `<span class="lab-carta">${imagenHtml(p.carta(u))}</span>`).join('')}</div>`).join('')}</div>
     <div class="lab-dialogo-botones"><button type="button" class="btn-primary lab-btn" data-dlg="ok">Cerrar</button></div>`
  )
  caja.onclick = (e) => {
    if (e.target.closest('[data-dlg]')) cerrarDialogo()
  }
}

// ════════════════════════════════════════════════════════════════════
// Nueva partida, y elegir los mazos (tanda 456)
// ════════════════════════════════════════════════════════════════════

function dialogoNueva(modo = L.opciones.modo, { seguir = false } = {}) {
  // Un BORRADOR hasta «Repartir»: cambiar un mazo o una opción y luego
  // cancelar no puede tocar la partida que está en juego (las
  // probabilidades del que juega ya salían del mazo nuevo, con el viejo
  // en la mano).
  if (!seguir || !L.borrador) L.borrador = { mazos: [...L.mazos], mazo2: L.opciones.mazo2, opciones: { ...L.opciones, modo } }
  const b = L.borrador
  const o = b.opciones
  const filaMazo = (i) => {
    const m = b.mazos[i]
    const n = m ? m.entradas.reduce((t, e) => t + e.n, 0) : 0
    return `<div class="lab-mazo-fila">
      <span class="lab-jugador" data-j="${i}">Jugador ${i + 1}</span>
      <span class="lab-mazo-nombre">${m ? `<strong>${escapeHtml(m.nombre)}</strong><span class="lab-mazo-cuenta">${n} cartas</span>` : '<span class="lab-mazo-cuenta">Sin elegir</span>'}</span>
      <button type="button" class="btn-secondary lab-btn" data-cambiar-mazo="${i}">${m ? 'Cambiar' : 'Elegir'}</button>
    </div>`
  }
  const caja = abrirDialogo(
    `<h3 id="labDialogoTitulo">Nueva partida</h3>
     <div class="lab-dialogo-cuerpo">
       <fieldset class="lab-opciones-partida lab-elige-modo">
         <legend>¿Contra quién?</legend>
         <label class="lab-tarjeta-modo"><input type="radio" name="labModo" value="muneco"${o.modo !== 'mesa' ? ' checked' : ''} /><span><strong>El muñeco de prácticas</strong><span class="subtext">No juega: mides tu daño, tus robos y tus probabilidades.</span></span></label>
         <label class="lab-tarjeta-modo"><input type="radio" name="labModo" value="mesa"${o.modo === 'mesa' ? ' checked' : ''} /><span><strong>Tú contra ti</strong><span class="subtext">Dos mazos, una mano y unos premios cada uno, y la mesa gira para enseñar abajo al que le toca.</span></span></label>
       </fieldset>
       <div class="lab-solo-modo" data-solo="mesa">
         <div class="lab-mazos-elegir">${filaMazo(0)}${filaMazo(1)}</div>
         <fieldset class="lab-opciones-partida">
           <legend>¿Quién empieza?</legend>
           ${[['azar', 'Moneda'], ['0', 'Jugador 1'], ['1', 'Jugador 2']].map(([v, t]) => `<label class="lab-radio"><input type="radio" name="labEmpieza" value="${v}"${String(o.empieza) === v ? ' checked' : ''} /> ${t}</label>`).join('')}
         </fieldset>
       </div>
       <div class="lab-solo-modo" data-solo="muneco">
         <fieldset class="lab-opciones-partida">
           <legend>¿Quién empieza?</legend>
           ${[['azar', 'Moneda'], ['primero', 'Voy primero'], ['segundo', 'Voy segundo']].map(([v, t]) => `<label class="lab-radio"><input type="radio" name="labPrimero" value="${v}"${o.primero === v ? ' checked' : ''} /> ${t}</label>`).join('')}
         </fieldset>
       </div>
       <label class="lab-radio"><input type="checkbox" id="labEstricta"${o.estricta ? ' checked' : ''} /> Reglas de verdad (una energía y un partidario por turno, sin evolucionar el primer turno…)</label>
       <p class="subtext">Sin ellas es un tapete libre: puedes hacer cualquier cosa para montar una situación.</p>
     </div>
     <p class="lab-dialogo-error" role="alert"></p>
     ${botonesDialogo({ ok: 'Repartir' })}`,
    { ancho: 'medio', alCerrar: () => (L.borrador = null) }
  )
  const elegido = () => caja.querySelector('input[name="labModo"]:checked')?.value || 'muneco'
  const repasar = () => {
    const m = elegido()
    caja.querySelectorAll('[data-solo]').forEach((el) => el.classList.toggle('hidden', el.dataset.solo !== m))
    caja.querySelector('.lab-dialogo-error').textContent = m === 'mesa' && !b.mazos[1] ? 'Elige el mazo del jugador 2.' : ''
    caja.querySelector('[data-dlg="ok"]').disabled = m === 'mesa' && !b.mazos[1]
  }
  const leerOpciones = () => {
    o.modo = elegido()
    o.primero = caja.querySelector('input[name="labPrimero"]:checked')?.value || o.primero
    o.empieza = caja.querySelector('input[name="labEmpieza"]:checked')?.value || o.empieza
    o.estricta = caja.querySelector('#labEstricta').checked
  }
  caja.onchange = repasar
  caja.onclick = (e) => {
    const cambiar = e.target.closest('[data-cambiar-mazo]')
    if (cambiar) {
      leerOpciones()
      return elegirMazo(Number(cambiar.dataset.cambiarMazo))
    }
    const d = e.target.closest('[data-dlg]')
    if (!d) return
    if (d.dataset.dlg === 'cancelar') return cancelarDialogo()
    leerOpciones()
    if (o.modo === 'mesa' && !b.mazos[1]) return
    // Repartir: ahora sí, el borrador pasa a la mesa.
    L.mazos = [...b.mazos]
    L.opciones = { ...o }
    L.opciones.mazo2 = b.mazo2
    L.borrador = null
    guardarPrefs()
    cerrarDialogo()
    nuevaPartida()
  }
  repasar()
}

// Elegir un mazo para un jugador: el del constructor, uno de los tuyos,
// una lista del meta o una pegada. Al acabar se vuelve a «Nueva partida»
// (al borrador: nada cambia en la mesa hasta repartir).
function elegirMazo(i) {
  const volver = () => dialogoNueva('mesa', { seguir: true })
  const caja = abrirDialogo(
    `<h3 id="labDialogoTitulo">Mazo del jugador ${i + 1}</h3>
     <div class="lab-pestanias" role="tablist" aria-label="De dónde sale el mazo">
       <button type="button" role="tab" class="lab-pestania activa" aria-selected="true" data-fuente="este">Este mazo</button>
       <button type="button" role="tab" class="lab-pestania" aria-selected="false" data-fuente="mios">Mis mazos</button>
       <button type="button" role="tab" class="lab-pestania" aria-selected="false" data-fuente="meta">Del meta</button>
       <button type="button" role="tab" class="lab-pestania" aria-selected="false" data-fuente="texto">Pegar lista</button>
     </div>
     <div class="lab-dialogo-cuerpo" id="labFuente"></div>
     <p class="lab-dialogo-error" role="alert"></p>
     <div class="lab-dialogo-botones"><button type="button" class="btn-secondary lab-btn" data-dlg="volver">Volver</button></div>`,
    { ancho: 'medio', alCerrar: volver }
  )
  const cuerpo = caja.querySelector('#labFuente')
  const error = caja.querySelector('.lab-dialogo-error')
  const lista = (filas) => `<div class="lab-lista-mazos">${filas.join('') || '<p class="subtext">No hay ninguno.</p>'}</div>`
  const pestanias = {
    este() {
      const m = L.mazoConstructor
      cuerpo.innerHTML = lista([`<button type="button" class="lab-mazo-opcion" data-usar="este"><strong>${escapeHtml(m.nombre)}</strong><span class="subtext">El que tienes en el constructor · ${m.entradas.reduce((t, e) => t + e.n, 0)} cartas</span></button>`])
    },
    async mios() {
      if (!L.userId) {
        cuerpo.innerHTML = '<p class="subtext">Entra en tu cuenta para ver tus mazos guardados.</p>'
        return
      }
      cuerpo.innerHTML = '<p class="subtext">Cargando tus mazos…</p>'
      try {
        const filas = await misMazos(L.userId)
        cuerpo._mios = filas
        cuerpo.innerHTML = lista(filas.map((f, k) => `<button type="button" class="lab-mazo-opcion" data-usar="mio" data-k="${k}"><strong>${escapeHtml(f.name || 'Mazo sin nombre')}</strong><span class="subtext">${(f.cards || []).reduce((t, c) => t + (Number(c.n) || 0), 0)} cartas</span></button>`))
      } catch (err) {
        cuerpo.innerHTML = `<p class="subtext">No se han podido cargar: ${escapeHtml(err.message || 'error de red')}.</p>`
      }
    },
    async meta() {
      cuerpo.innerHTML = '<p class="subtext">Cargando los mazos del meta…</p>'
      try {
        const filas = (await resumenDelMeta(30)).filter((f) => f.listas > 0).slice(0, 40)
        cuerpo.innerHTML = lista(filas.map((f) => `<button type="button" class="lab-mazo-opcion" data-usar="meta" data-arquetipo="${escapeHtml(f.arquetipo)}" data-nombre="${escapeHtml(f.nombre)}"><strong>${escapeHtml(f.nombre)}</strong><span class="subtext">${Number(f.cuota || 0).toFixed(1).replace('.', ',')} % del meta · se usa su lista más reciente con buen resultado</span></button>`))
      } catch (err) {
        cuerpo.innerHTML = `<p class="subtext">No se han podido cargar: ${escapeHtml(err.message || 'error de red')}.</p>`
      }
    },
    texto() {
      cuerpo.innerHTML = `<label class="lab-campo-texto">Pega una lista (la de TCG Live, Limitless o PokeDoc)
        <textarea id="labListaTexto" rows="10" placeholder="Pokémon: 12&#10;4 Dreepy TWM 128&#10;…"></textarea></label>
        <button type="button" class="btn-primary lab-btn" data-usar="texto">Usar esta lista</button>`
    },
  }
  const usar = async (fuente, b) => {
    error.textContent = ''
    const anterior = b.innerHTML
    b.disabled = true
    b.textContent = 'Preparando…'
    try {
      let nombre
      let entradas
      let sinResolver = []
      let recuerdo = { fuente: 'este' }
      if (fuente === 'este') {
        nombre = L.mazoConstructor.nombre
        entradas = L.mazoConstructor.entradas
      } else if (fuente === 'mio') {
        const f = cuerpo._mios[Number(b.dataset.k)]
        nombre = f.name || 'Mazo sin nombre'
        recuerdo = { fuente, id: f.id }
        ;({ entradas } = await entradasDeMazoGuardado(f))
      } else if (fuente === 'meta') {
        nombre = b.dataset.nombre
        recuerdo = { fuente, arquetipo: b.dataset.arquetipo, nombre }
        ;({ entradas, sinResolver } = await entradasDelMeta(b.dataset.arquetipo))
      } else {
        nombre = 'Lista pegada'
        const texto = caja.querySelector('#labListaTexto').value
        // Se guarda el texto: al volver a abrir, la mesa sale con ESTA
        // lista y no con «el mismo mazo» sin decir nada.
        recuerdo = { fuente: 'texto', texto: texto.slice(0, 20000) }
        ;({ entradas, sinResolver } = await entradasDeTexto(texto))
      }
      const total = entradas.reduce((t, e) => t + e.n, 0)
      if (total < 13) throw new Error(`solo ${total} cartas: hacen falta al menos 13`)
      if (!entradas.some((e) => esBasico(e.carta) !== false)) throw new Error('el mazo no tiene ningún Pokémon básico')
      const preparadas = fuente === 'este' ? entradas : await prepararEntradas(entradas)
      // Si mientras se preparaba se cerró la ventana (Escape), no se
      // vuelve a abrir nada por encima de lo que haya ahora.
      if (!cuerpo.isConnected || !L.borrador) return
      L.borrador.mazos[i] = { nombre, entradas: preparadas, odds: oddsDelMazo(preparadas), mismo: fuente === 'este' }
      if (i === 1) L.borrador.mazo2 = recuerdo
      if (sinResolver.length) showToast(`${sinResolver.length} ${sinResolver.length === 1 ? 'línea no se ha encontrado' : 'líneas no se han encontrado'}: el mazo tiene ${total} cartas.`, 'error')
      volver()
    } catch (err) {
      if (!cuerpo.isConnected) return
      error.textContent = `No se puede usar: ${err.message || 'error de red'}.`
      b.disabled = false
      b.innerHTML = anterior
    }
  }
  caja.onclick = (e) => {
    const t = e.target.closest('[data-fuente]')
    if (t) {
      caja.querySelectorAll('[data-fuente]').forEach((x) => {
        x.classList.toggle('activa', x === t)
        x.setAttribute('aria-selected', String(x === t))
      })
      error.textContent = ''
      return pestanias[t.dataset.fuente]()
    }
    const u = e.target.closest('[data-usar]')
    if (u && !u.disabled) return usar(u.dataset.usar, u)
    if (e.target.closest('[data-dlg="volver"]')) volver()
  }
  pestanias.este()
}

async function entradasDeLineas(lineas) {
  const { resueltas, sinResolver } = await resolverLineas(lineas)
  return { entradas: resueltas.map((r) => ({ carta: r.carta, n: r.linea.n })), sinResolver }
}

// Las tres maneras de sacar un mazo que no es el del constructor, para
// elegirlo y para recuperarlo al volver a abrir.
async function entradasDeMazoGuardado(f) {
  const piezas = (f.cards || []).filter((c) => c?.id && c.n > 0)
  const mapa = await cartasPorIds(piezas.map((c) => c.id))
  return { entradas: piezas.filter((c) => mapa.get(c.id)).map((c) => ({ carta: mapa.get(c.id), n: c.n })), sinResolver: [] }
}
async function entradasDelMeta(arquetipo) {
  const [l] = await listasDestacadas(arquetipo, 30, 1)
  if (!l) throw new Error('ese mazo no tiene listas en los últimos 30 días')
  const lineas = ['pokemon', 'trainer', 'energy'].flatMap((sec) => (l.lista?.[sec] || []).map((x) => ({ n: Number(x.count), nombre: x.name || '', set: String(x.set || '').toUpperCase() || null, numero: String(x.number || '') || null, original: `${x.count} ${x.name} ${x.set || ''} ${x.number || ''}`.trim() })))
  return entradasDeLineas(lineas)
}
async function entradasDeTexto(texto) {
  const { lineas } = leerLista(texto)
  if (!lineas.length) throw new Error('no he encontrado ninguna carta: cada línea empieza por la cantidad («4 Dreepy TWM 128»)')
  return entradasDeLineas(lineas)
}

// Al volver a abrir en «tú contra ti», el mazo 2 de la última vez. Si no
// se puede (otra cuenta, sin red), el mismo mazo contra sí mismo: así la
// mesa sale igual, y se cambia en «Nueva partida».
async function recuperarMazo2() {
  const d = L.opciones.mazo2
  try {
    let nombre = null
    let entradas = null
    if (d?.fuente === 'mio' && L.userId) {
      const f = (await misMazos(L.userId)).find((x) => x.id === d.id)
      if (f) {
        nombre = f.name || 'Mazo sin nombre'
        ;({ entradas } = await entradasDeMazoGuardado(f))
      }
    } else if (d?.fuente === 'meta') {
      nombre = d.nombre || 'Mazo del meta'
      ;({ entradas } = await entradasDelMeta(d.arquetipo))
    } else if (d?.fuente === 'texto' && d.texto) {
      nombre = 'Lista pegada'
      ;({ entradas } = await entradasDeTexto(d.texto))
    }
    if (entradas && entradas.reduce((t, e) => t + e.n, 0) >= 13) {
      const listas = await prepararEntradas(entradas)
      if (listas.some((e) => esBasico(e.carta) !== false)) {
        L.mazos[1] = { nombre, entradas: listas, odds: oddsDelMazo(listas) }
        return
      }
    }
  } catch {}
  L.mazos[1] = { ...L.mazoConstructor, mismo: true }
}

// ── Colocar solo: el básico que menos cuesta retirar delante, y el resto
// a la banca ──
function colocarAuto() {
  const p = L.partida
  const basicos = p.s.mano.filter((u) => esPokemon(p.carta(u)) && esBasicoEnJuego(p.carta(u)))
  if (!basicos.length) return
  if (!p.s.activo) {
    // El que menos cuesta retirar y más aguanta: lo que suele querer
    // quien no se lo piensa.
    const mejor = [...basicos].sort((a, b) => (p.carta(a).retreat ?? 1) - (p.carta(b).retreat ?? 1) || (p.carta(b).hp || 0) - (p.carta(a).hp || 0))[0]
    p.colocar(mejor, 'activo')
  }
  for (const u of p.s.mano.filter((x) => esPokemon(p.carta(x)) && esBasicoEnJuego(p.carta(x)))) {
    if (p.s.banca.length >= 5) break
    p.colocar(u, 'banca')
  }
}

// ════════════════════════════════════════════════════════════════════
// Eventos
// ════════════════════════════════════════════════════════════════════

// Qué carta hay debajo de un elemento, para «verla»: de la mano, de un
// Pokémon en juego (tuyo o del otro), del estadio, de un premio vuelto…
function cartaBajo(el) {
  const p = L.partida
  const conUid = el.closest('[data-uid]')
  if (conUid) return { carta: p.carta(conUid.dataset.uid) }
  const mas = el.closest('[data-mas]')
  if (mas) return { carta: p.carta(mas.dataset.mas) }
  const propio = el.closest('[data-slot-carta]')
  if (propio) {
    const slot = p.slot(propio.dataset.slotCarta)
    return slot ? { carta: p.cartaDe(slot), slot, partida: p } : null
  }
  const ajeno = el.closest('[data-rival-carta]')
  if (ajeno && L.mesa) {
    const op = p.oponente
    const slot = op.slot(ajeno.dataset.rivalCarta)
    return slot ? { carta: op.cartaDe(slot), slot, partida: op } : null
  }
  return null
}

function verLoDeBajo(el) {
  const c = cartaBajo(el)
  if (!c?.carta) return false
  cerrarMenu()
  verCarta(c.carta, c.slot || null, c.partida || L.partida)
  return true
}

function enganchar() {
  const raiz = L.raiz
  raiz.addEventListener('click', (e) => {
    // Tras una pulsación larga (que ya ha enseñado la carta) el dedo
    // levantado no tiene que jugarla.
    if (L.ignorarClic) {
      L.ignorarClic = false
      e.preventDefault()
      return
    }
    const menu = $('#labMenu')
    // Una opción del menú.
    const op = e.target.closest('#labMenu [data-op]')
    if (op) {
      const o = menu._opciones?.[Number(op.dataset.op)]
      if (o && !o.no) {
        cerrarMenu()
        o.accion()
      }
      return
    }
    if (!e.target.closest('#labMenu')) cerrarMenu()
    if (e.target === $('#labVelo')) return cancelarDialogo()
    if (e.target.closest('#labVelo')) return

    // Eligiendo en la mesa: solo cuenta tocar lo que brilla y los botones
    // de la barra. Mirar el panel de probabilidades y cerrar el laboratorio
    // se puede (cerrar cancela lo que se pueda cancelar); lo demás no hace
    // nada, que la jugada está a medias.
    if (L.elegir) {
      const b = e.target.closest('[data-elegir]')
      if (b) return tocarElegir(b.dataset.elegir)
      const acc = e.target.closest('[data-elegir-accion]')
      if (acc) return acc.disabled ? undefined : accionElegir(acc.dataset.elegirAccion)
      if (!e.target.closest('[data-accion="panel"], [data-accion="cerrar"], [data-panel-pestania]')) return
    }

    const modo = e.target.closest('[data-modo]')
    if (modo) {
      const quiere = modo.dataset.modo
      if (quiere === (L.mesa ? 'mesa' : 'muneco')) return
      return dialogoNueva(quiere)
    }
    const a = e.target.closest('[data-accion]')
    if (a && !a.disabled) return accionDeBarra(a.dataset.accion, a)
    if (L.ocupado || !L.partida) return
    const p = L.partida

    // Apuntando: tocar uno de los que brillan termina la jugada; tocar
    // otra cosa de la mesa la cancela.
    if (L.apuntar) {
      const sl = e.target.closest('[data-slot-carta]')
      const o = sl && L.apuntar.opciones[sl.dataset.slotCarta]
      if (o) {
        const uid = L.apuntar.uid
        return hacer(() => p.jugarDeMano(uid, o, ui))
      }
      const otraMano = e.target.closest('[data-mano]')
      cancelarApuntar()
      if (!otraMano) return
    }

    const mas = e.target.closest('[data-mas]')
    if (mas) return menuDeMano(mas.dataset.mas, mas)
    const mano = e.target.closest('[data-mano]')
    if (mano) return accionPrincipalDeMano(mano.dataset.uid, mano)
    const slot = e.target.closest('[data-slot-carta]')
    if (slot) return menuDeSlot(slot.dataset.slotCarta, slot)
    if (e.target.closest('[data-rival-carta]')) return verLoDeBajo(e.target)
    const pila = e.target.closest('[data-pila]')
    if (pila) {
      const rival = pila.dataset.de === 'rival'
      if (pila.dataset.pila === 'descarte') return rival ? menuDeDescarte(pila, p.oponente, { rival: true }) : menuDeDescarte(pila)
      if (!rival) return menuDeMazo(pila)
      return showToast(`${p.oponente.nombreJugador} tiene ${p.oponente.s.mazo.length} cartas en el mazo.`)
    }
    const premio = e.target.closest('[data-premio]')
    if (premio) return menuDePremio(premio.dataset.premio || premio.dataset.uid, premio)
    if (e.target.closest('[data-estadio]')) return menuDeEstadio(e.target.closest('[data-estadio]'))
    if (e.target.closest('[data-ver-mulligans]')) return verMulligans()

    const primero = e.target.closest('[data-primero]')
    if (primero) {
      const v = primero.dataset.primero
      return hacer(() => {
        if (v === 'moneda') {
          const sale = p.azar() < 0.5
          p.log(`Moneda: ${sale ? 'cara, vas primero' : 'cruz, vas segundo'}.`)
          p.ponerVaPrimero(sale)
        } else p.ponerVaPrimero(v === 'primero')
        L.opciones.primero = v === 'moneda' ? 'azar' : v
        guardarPrefs()
      })
    }
    const empieza = e.target.closest('[data-empieza]')
    if (empieza && L.mesa) {
      const v = empieza.dataset.empieza
      return hacer(() => {
        if (v === 'moneda') L.mesa.lanzarMoneda()
        else L.mesa.ponerPrimero(Number(v))
        L.opciones.empieza = v === 'moneda' ? 'azar' : v
        guardarPrefs()
      })
    }

    const aj = e.target.closest('[data-rival-ajuste]')
    if (aj && aj.tagName === 'BUTTON') return ajusteRival(aj.dataset.rivalAjuste, aj)

    const robos = e.target.closest('[data-robos]')
    if (robos) {
      L.nRobos = Math.max(1, Math.min(20, L.nRobos + Number(robos.dataset.robos)))
      guardarPrefs()
      return repintarPanel()
    }
    if (e.target.closest('[data-caminos]')) return buscarCaminosAhora()
    const pest = e.target.closest('[data-panel-pestania]')
    if (pest) {
      L.panelPestania = pest.dataset.panelPestania
      guardarPrefs()
      return repintarPanel()
    }
  })

  // Clic derecho: ver la carta (y no el menú del navegador).
  raiz.addEventListener('contextmenu', (e) => {
    if (e.target.closest('#labVelo, #labMenu')) return
    if (verLoDeBajo(e.target)) e.preventDefault()
  })

  // Mantener pulsado (con el dedo): ver la carta.
  let pulsacion = null
  const soltar = () => {
    clearTimeout(pulsacion)
    pulsacion = null
  }
  raiz.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.target.closest('#labVelo, #labMenu')) return
    if (!cartaBajo(e.target)) return
    soltar()
    const x0 = e.clientX
    const y0 = e.clientY
    const el = e.target
    pulsacion = setTimeout(() => {
      pulsacion = null
      if (verLoDeBajo(el)) L.ignorarClic = true
    }, PULSACION_LARGA)
    const mover = (ev) => {
      if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) soltar()
    }
    raiz.addEventListener('pointermove', mover, { passive: true })
    const fin = () => {
      soltar()
      raiz.removeEventListener('pointermove', mover)
      // Si la pulsación larga ya enseñó la carta, el clic que viene
      // detrás se ignora; si no llega clic (el dedo se fue), que no se
      // quede la marca puesta para el siguiente.
      if (L.ignorarClic) setTimeout(() => (L.ignorarClic = false), 400)
    }
    raiz.addEventListener('pointerup', fin, { once: true })
    raiz.addEventListener('pointercancel', fin, { once: true })
  })

  raiz.addEventListener('change', (e) => {
    if (e.target.id === 'labCaminosCarta') {
      L.caminos.clave = e.target.value
      return
    }
    const marca = e.target.closest('[data-marca]')
    if (marca) {
      if (marca.checked) L.seleccion.add(marca.dataset.marca)
      else L.seleccion.delete(marca.dataset.marca)
      return repintarPanel()
    }
    const aj = e.target.closest('select[data-rival-ajuste="plantilla"]')
    if (aj) {
      L.opciones.rival = aj.value
      guardarPrefs()
      hacer(() => {
        const r = L.partida.s.rival
        const nuevo = crearRival({ plantilla: aj.value, banca: r.banca.length })
        nuevo.premios = r.premios
        nuevo.caidos = r.caidos
        L.partida.s.rival = nuevo
      })
    }
  })

  // El teclado, en la VENTANA y en captura: así sigue funcionando aunque
  // el foco se haya caído al `body`, y lo que el laboratorio usa no le
  // llega además al constructor de debajo (su Ctrl+Z deshacía también un
  // cambio del MAZO mientras se jugaba).
  window.addEventListener(
    'keydown',
    (e) => {
      if (!L.raiz || L.raiz.hidden) return
      if (alTeclear(e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    true
  )
}

// Devuelve true si la tecla era del laboratorio.
function alTeclear(e) {
  const velo = !$('#labVelo').classList.contains('hidden')
  const menu = !$('#labMenu').classList.contains('hidden')
  const foco = document.activeElement
  if (e.key === 'Escape') {
    if (velo) cancelarDialogo()
    else if (menu) cerrarMenu()
    else if (cancelarElegir()) {
      // nada más
    } else if (cancelarApuntar()) {
      // nada más
    } else if (panelVisible() && !anchoGrande()) {
      // El panel por encima de la mesa (pantalla estrecha) se cierra antes
      // que el laboratorio.
      accionDeBarra('panel')
    } else cerrar()
    return true
  }
  // El foco no sale del laboratorio (es una ventana modal), ni de la
  // ventana o el menú que haya abiertos encima.
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) return atraparTab(e, velo ? $('#labDialogo') : menu ? $('#labMenu') : L.raiz)
  const escribiendo = /input|textarea|select/i.test(foco?.tagName || '')
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z' && !escribiendo) {
    if (!velo) deshacer()
    return true
  }
  if (escribiendo || e.ctrlKey || e.metaKey || e.altKey) return false
  // Las flechas: por las opciones del menú, y por un grupo de opciones
  // («contra quién», «quién empieza»).
  if (menu) {
    if (!/^(ArrowDown|ArrowUp|Home|End)$/.test(e.key)) return false
    moverEnLista([...$('#labMenu').querySelectorAll('[data-op]')], e.key)
    return true
  }
  if (velo) return false
  // El muñeco que se elige es un <div role="button">: Intro y Espacio lo
  // pulsan, como a un botón de verdad.
  if (L.elegir && (e.key === 'Enter' || e.key === ' ') && foco?.matches?.('[data-elegir]:not(button)')) {
    tocarElegir(foco.dataset.elegir)
    return true
  }
  const radio = foco?.closest?.('[role="radio"]')
  if (radio && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
    moverEnLista([...radio.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]')], e.key)
    return true
  }
  // «v» enseña la carta enfocada (como el clic derecho; la tecla de menú
  // y Mayús+F10 lanzan ese mismo clic derecho). Lo demás de una carta de
  // la mano está en su «⋯», que es un botón más.
  if ((e.key === 'v' || e.key === 'V') && foco && L.raiz.contains(foco) && cartaBajo(foco)) {
    verLoDeBajo(foco)
    return true
  }
  // «p» abre y cierra el panel de probabilidades.
  if (e.key === 'p' || e.key === 'P') {
    accionDeBarra('panel')
    return true
  }
  return false
}

function moverEnLista(lista, tecla) {
  const n = lista.length
  if (!n) return
  const i = lista.indexOf(document.activeElement)
  const adelante = /Down|Right/.test(tecla)
  const j = tecla === 'Home' ? 0 : tecla === 'End' ? n - 1 : i < 0 ? (adelante ? 0 : n - 1) : adelante ? (i + 1) % n : (i - 1 + n) % n
  lista[j].focus()
}

function atraparTab(e, caja) {
  const visibles = [...caja.querySelectorAll('button, [href], input, select, textarea, [tabindex]')].filter((x) => !x.disabled && x.tabIndex >= 0 && x.getClientRects().length)
  const n = visibles.length
  if (!n) {
    caja.focus()
    return true
  }
  const i = visibles.indexOf(document.activeElement)
  let j
  if (i < 0) j = e.shiftKey ? n - 1 : 0
  else if (e.shiftKey && i === 0) j = n - 1
  else if (!e.shiftKey && i === n - 1) j = 0
  else return false // por dentro, sin dar la vuelta: lo hace el navegador
  visibles[j].focus()
  return true
}

function accionDeBarra(accion, boton) {
  const p = L.partida
  switch (accion) {
    case 'cerrar':
      return cerrar()
    case 'nueva':
      return dialogoNueva()
    case 'otra':
      return nuevaPartida()
    case 'deshacer':
      return deshacer()
    case 'compartir':
      return dialogoCompartir()
    case 'copiar-registro':
      return copiarRegistro()
    case 'ver-repeticion':
      return verComoRepeticion()
    case 'panel': {
      L.panelAbierto = !panelVisible()
      guardarPrefs()
      pintarPanel()
      pintarBarra()
      if (L.panelAbierto) $('#labPanel')?.querySelector('.lab-pestania.activa')?.focus()
      else {
        // La lengüeta solo se ve en ancho; si no, el botón de arriba (el
        // foco a algo escondido se caía al `body`).
        const pest = $('#labPanelPestana')
        ;(pest && pest.getClientRects().length ? pest : $('.lab-btn-panel'))?.focus()
      }
      return
    }
    case 'no-apuntar':
      return cancelarApuntar()
    case 'empezar':
      if (L.mesa) return hacer(() => L.mesa.listo(ui))
      return hacer(() => p.empezar())
    case 'auto':
      return hacer(() => colocarAuto())
    case 'pasar':
      return hacer(() => p.pasarTurno(ui))
    case 'atacar':
      return menuDeAtaque(boton)
    case 'estadio':
      return menuDeEstadio(boton)
  }
}

function ajusteRival(que, boton) {
  if (que === 'ataque') return menuDelRival(boton)
  if (que === 'plegar') {
    L.rivalAbierto = !L.rivalAbierto
    return pintarRival()
  }
  hacer(() => {
    const rv = L.partida.s.rival
    if (que === 'banca+' && rv.banca.length < 5) rv.banca.push(nuevoManiqui(rv.plantilla, ++rv.seq))
    if (que === 'banca-' && rv.banca.length) rv.banca.pop()
    if (que === 'premios+' && rv.premios < 6) rv.premios++
    if (que === 'premios-' && rv.premios > 1) rv.premios--
  })
}
