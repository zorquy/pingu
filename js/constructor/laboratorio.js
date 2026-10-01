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
import { escapeHtml } from '../html.js'
import { showToast } from '../toast.js'
import { cardImageUrl } from '../tcgdex.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { canonizarCarta } from '../carta-detalle.js'
import { detallesDeJuego } from './datos.js'
import { claveDeNombre, nombreVisible, imagenDeEnergiaBasica, esEnergiaBasica, letraDeCartaDeEnergia, seccionesDelMazo } from './nucleo.js'
import {
  Partida, Cancelado, oddsDelMazo, probabilidadDeGrupo, contextoDeProbabilidad, PLANTILLAS_RIVAL, crearRival, nuevoManiqui,
  esPokemon, esEnergia, esPartidario, esBasicoEnJuego, costeEnLetras, danioImpreso, NOMBRE_DE_LETRA,
  unidadesDeEnergia, premiosQueDa, ponerEstado, claveDeEfecto,
} from './partida.js'
import { EFECTOS, textoDeCarta, estaAutomatizada } from './efectos.js'

const PREFS = 'pokedoc-laboratorio'

// ── El estado de la pantalla ──
const L = {
  raiz: null,
  partida: null,
  entradas: [],
  nombre: '',
  codigoDeSet: () => null,
  opciones: { primero: 'azar', estricta: true, rival: 'ex', banca: 2 },
  probAbierta: false,
  // En el móvil los ajustes del rival van plegados: ocupaban media
  // pantalla antes de llegar a la mesa.
  rivalAbierto: false,
  probPestania: 'ahora',
  nRobos: 3,
  seleccion: new Set(),
  ocupado: false,
  cacheHtml: new WeakMap(),
  odds: null,
  focoPrevio: null,
}

const $ = (sel) => L.raiz.querySelector(sel)

function leerPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null')
    if (p && typeof p === 'object') {
      Object.assign(L.opciones, p.opciones || {})
      L.probAbierta = !!p.probAbierta
      if (Number.isInteger(p.nRobos)) L.nRobos = Math.max(1, Math.min(20, p.nRobos))
    }
  } catch {}
}
function guardarPrefs() {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ opciones: L.opciones, probAbierta: L.probAbierta, nRobos: L.nRobos }))
  } catch {}
}

// ════════════════════════════════════════════════════════════════════
// Abrir
// ════════════════════════════════════════════════════════════════════
//
// `entradas`: el mazo tal cual lo tiene el constructor. Aquí se engorda
// con lo que el buscador no pide (ataques, habilidades, retirada) — una
// sola consulta por los identificadores del mazo.
export async function abrirLaboratorio({ entradas, nombre = '', codigoDeSet = () => null }) {
  leerPrefs()
  L.nombre = nombre
  L.codigoDeSet = codigoDeSet
  montar()
  L.focoPrevio = document.activeElement
  L.raiz.hidden = false
  document.documentElement.classList.add('lab-abierto')
  $('#labNombre').textContent = nombre || 'Mazo sin nombre'
  $('#labTitulo').focus()
  // Cerrar para mirar el mazo y volver no tira la partida: si el mazo es
  // el mismo, se sigue donde estaba. Para empezar otra, «Nueva partida».
  const firma = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')
  if (L.partida && L.firma === firma && L.partida.s.fase !== 'fin') {
    L.cacheHtml = new WeakMap()
    pintar()
    return
  }
  L.firma = firma
  $('#labCuerpo').innerHTML = '<p class="lab-cargando">Preparando la mesa…</p>'
  try {
    const ids = [...new Set(entradas.map((e) => e.carta.id))]
    const detalles = await detallesDeJuego(ids).catch(() => new Map())
    L.entradas = entradas.map((e) => ({ n: e.n, carta: canonizarCarta({ ...e.carta, ...(detalles.get(e.carta.id) || {}) }) }))
  } catch {
    L.entradas = entradas.map((e) => ({ ...e }))
  }
  L.odds = oddsDelMazo(L.entradas)
  L.seleccion = new Set()
  $('#labCuerpo').innerHTML = cuerpoHtml()
  nuevaPartida()
}

function cerrar() {
  if (!L.raiz) return
  cerrarMenu()
  L.raiz.hidden = true
  document.documentElement.classList.remove('lab-abierto')
  L.focoPrevio?.focus?.()
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
  // dónde volver (tanda 422). Sin esto el foco se queda en el `body`, y
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
      <p class="lab-turno" id="labTurno" aria-live="polite"></p>
      <div class="lab-barra-botones">
        <button type="button" class="btn-secondary lab-btn" data-accion="nueva">Nueva partida</button>
        <button type="button" class="btn-secondary lab-btn" data-accion="deshacer" title="Deshacer (Ctrl+Z)">Deshacer</button>
        <button type="button" class="btn-secondary lab-btn lab-btn-prob" data-accion="prob" aria-pressed="false" aria-controls="labProb">Probabilidades</button>
      </div>
      <button type="button" class="lab-cerrar lab-cerrar-lab" data-accion="cerrar" aria-label="Cerrar el laboratorio">×</button>
    </header>
    <div class="lab-cuerpo" id="labCuerpo"></div>
    <div class="lab-menu hidden" id="labMenu" role="menu" tabindex="-1"></div>
    <div class="lab-velo hidden" id="labVelo">
      <div class="lab-dialogo" id="labDialogo" role="dialog" aria-modal="true" aria-labelledby="labDialogoTitulo"></div>
    </div>`
  document.body.appendChild(raiz)
  L.raiz = raiz
  enganchar()
}

function cuerpoHtml() {
  return `
    <div class="lab-mesa" id="labMesa">
      <section class="lab-rival" id="labRival" aria-label="Rival de prácticas"></section>
      <section class="lab-campo" aria-label="Tu lado de la mesa">
        <div class="lab-lado lab-lado-izq">
          <div class="lab-zona">
            <p class="lab-rotulo">Premios</p>
            <div class="lab-premios" id="labPremios"></div>
          </div>
          <div class="lab-zona">
            <p class="lab-rotulo">Estadio</p>
            <div class="lab-estadio" id="labEstadio"></div>
          </div>
        </div>
        <div class="lab-centro">
          <div class="lab-activo" id="labActivo"></div>
          <div class="lab-banca" id="labBanca"></div>
        </div>
        <div class="lab-lado lab-lado-der">
          <button type="button" class="lab-pila" id="labMazo" data-pila="mazo"></button>
          <button type="button" class="lab-pila" id="labDescarte" data-pila="descarte"></button>
        </div>
      </section>
      <section class="lab-acciones" id="labAcciones" aria-label="Tu turno"></section>
      <section class="lab-mano-zona" aria-labelledby="labManoTitulo">
        <h3 class="lab-rotulo" id="labManoTitulo">Tu mano</h3>
        <div class="lab-mano" id="labMano"></div>
      </section>
      <details class="lab-registro" id="labRegistroCaja" open>
        <summary>Registro de la partida</summary>
        <ol class="lab-registro-lista" id="labRegistro"></ol>
      </details>
    </div>
    <aside class="lab-prob hidden" id="labProb" aria-labelledby="labProbTitulo"></aside>
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
  L.nuevas = new Set()
  const o = L.opciones
  const primero = o.primero === 'azar' ? Math.random() < 0.5 : o.primero === 'primero'
  L.partida = new Partida({
    entradas: L.entradas,
    efectos: EFECTOS,
    semilla: (Math.random() * 2 ** 32) >>> 0,
    vaPrimero: primero,
    estricta: o.estricta,
    rival: { plantilla: o.rival, banca: o.banca },
  })
  L.partida.repartir()
  L.cacheHtml = new WeakMap()
  pintar()
}

// Ejecutar una acción del jugador: con su foto para deshacer, y con los
// errores contados en un aviso y no en la consola.
async function hacer(fn) {
  if (L.ocupado || !L.partida) return
  L.ocupado = true
  cerrarMenu()
  const antes = new Set(L.partida.s.mano)
  try {
    await L.partida.accion(fn)
    // Lo que acaba de llegar a la mano se marca hasta la siguiente
    // acción: después de robar 6 con Lillie, saber CUÁLES son las nuevas
    // es lo primero que se mira.
    L.nuevas = new Set(L.partida.s.mano.filter((u) => !antes.has(u)))
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
  }
}

// ════════════════════════════════════════════════════════════════════
// Pintar
// ════════════════════════════════════════════════════════════════════

function pintar() {
  const p = L.partida
  if (!p || !$('#labMesa')) return
  pintarTurno()
  pintarRival()
  pintarCampo()
  pintarAcciones()
  pintarMano()
  pintarRegistro()
  pintarProb()
  pintarFin()
  const d = $('[data-accion="deshacer"]')
  if (d) d.disabled = !p.puedeDeshacer
}

function pintarTurno() {
  const p = L.partida
  const s = p.s
  let t = ''
  if (s.fase === 'preparacion') t = `Preparación · vas ${s.vaPrimero ? 'primero' : 'segundo'}`
  else if (s.fase === 'turno') t = `Tu turno ${s.turno} · vas ${s.vaPrimero ? 'primero' : 'segundo'}`
  else if (s.fase === 'fin') t = 'Partida terminada'
  $('#labTurno').textContent = t
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

function cartaHtml(uid, { extra = '', etiqueta = '', nueva = false } = {}) {
  const c = L.partida.carta(uid)
  const nombre = escapeHtml(nombreVisible(c))
  const auto = !estaAutomatizada(c) ? '<span class="lab-chapa lab-chapa-manual" title="Su efecto no está automatizado: se hace a mano">a mano</span>' : ''
  return `<button type="button" class="lab-carta${nueva ? ' lab-nueva' : ''}" data-uid="${uid}" aria-label="${etiqueta || nombre}${nueva ? ' (nueva)' : ''}"${extra}>${imagenHtml(c)}${auto}${nueva ? '<span class="lab-chapa lab-chapa-nueva">nueva</span>' : ''}</button>`
}

const dorsoHtml = (extra = '') => `<span class="lab-dorso"${extra} aria-hidden="true"></span>`

// La energía unida, como un punto con la letra de su tipo.
function energiaHtml(uid, portador) {
  const c = L.partida.carta(uid)
  const unidades = unidadesDeEnergia(c, portador, L.partida)
  const letra = esEnergiaBasica(c) ? letraDeCartaDeEnergia(c) || 'C' : unidades[0]?.includes('*') ? '*' : unidades[0]?.[0] || 'C'
  const titulo = `${nombreVisible(c)}${unidades.length > 1 ? ` (da ${unidades.length})` : ''}`
  return `<span class="lab-energia${esEnergiaBasica(c) ? '' : ' lab-energia-especial'}" data-tipo="${letra}" title="${escapeHtml(titulo)}">${letra}${unidades.length > 1 ? `<sub>${unidades.length}</sub>` : ''}</span>`
}

const ESTADOS = { envenenado: 'Envenenado', quemado: 'Quemado', dormido: 'Dormido', paralizado: 'Paralizado', confundido: 'Confundido' }

function slotHtml(slot, { activo = false } = {}) {
  const p = L.partida
  const c = p.cartaDe(slot)
  const ps = p.psDe(slot)
  const vida = Math.max(0, ps - slot.danio)
  const pct = ps ? Math.round((vida / ps) * 100) : 100
  const energias = slot.energias.map((u) => energiaHtml(u, c)).join('')
  const herramienta = slot.herramienta ? `<span class="lab-chapa" title="${escapeHtml(p.nombre(slot.herramienta))}">${escapeHtml(p.nombre(slot.herramienta))}</span>` : ''
  const estados = slot.estados.map((e) => `<span class="lab-chapa lab-chapa-estado">${ESTADOS[e] || e}</span>`).join('')
  const nuevo = p.s.fase === 'turno' && slot.entroTurno === p.s.turno ? '<span class="lab-chapa">nuevo</span>' : ''
  const evo = slot.cartas.length > 1 ? `<span class="lab-chapa" title="${escapeHtml(slot.cartas.slice(0, -1).map((u) => p.nombre(u)).join(' → '))}">evol. ${slot.cartas.length - 1}</span>` : ''
  return `
    <div class="lab-slot${activo ? ' lab-slot-activo' : ''}" data-slot="${slot.id}">
      <button type="button" class="lab-carta lab-slot-carta" data-slot-carta="${slot.id}" aria-label="${escapeHtml(nombreVisible(c))}${activo ? ', activo' : ''}: ${vida} de ${ps} PS">${imagenHtml(c)}${slot.danio ? `<span class="lab-danio">${slot.danio}</span>` : ''}</button>
      <div class="lab-slot-info">
        <div class="lab-ps" title="${vida} / ${ps} PS"><span style="--pct: ${pct}%"></span></div>
        <p class="lab-ps-texto">${vida}/${ps} PS</p>
        ${energias ? `<div class="lab-energias">${energias}</div>` : ''}
        <div class="lab-chapas">${herramienta}${evo}${estados}${nuevo}</div>
      </div>
    </div>`
}

// ── El rival ──

function maniquiHtml(d, { activo = false } = {}) {
  const vida = Math.max(0, d.ps - d.danio)
  const pct = Math.round((vida / d.ps) * 100)
  const estados = (d.estados || []).map((e) => `<span class="lab-chapa lab-chapa-estado">${ESTADOS[e] || e}</span>`).join('')
  return `
    <div class="lab-maniqui${activo ? ' lab-maniqui-activo' : ''}" data-rival="${d.id}">
      <p class="lab-maniqui-nombre">${activo ? 'Activo · ' : ''}${escapeHtml(d.nombre)}</p>
      <div class="lab-ps"><span style="--pct: ${pct}%"></span></div>
      <p class="lab-ps-texto">${vida}/${d.ps} PS · ${d.premios} ${d.premios === 1 ? 'premio' : 'premios'}</p>
      ${estados ? `<div class="lab-chapas">${estados}</div>` : ''}
    </div>`
}

function pintarRival() {
  const r = L.partida.s.rival
  const plantillas = Object.values(PLANTILLAS_RIVAL)
    .map((t) => `<option value="${t.id}"${r.plantilla.id === t.id ? ' selected' : ''}>${t.nombre} (${t.ps} PS)</option>`)
    .join('')
  poner(
    $('#labRival'),
    `
    <div class="lab-rival-cab">
      <h3 class="lab-rotulo">Rival de prácticas <span class="subtext">(no juega: mide tu daño)</span></h3>
      <button type="button" class="link-btn lab-rival-plegar" data-rival-ajuste="plegar" aria-expanded="${L.rivalAbierto ? 'true' : 'false'}" aria-controls="labRivalAjustes">${L.rivalAbierto ? 'Ocultar ajustes' : 'Ajustes'}</button>
      <div class="lab-rival-ajustes${L.rivalAbierto ? ' abierto' : ''}" id="labRivalAjustes">
        <label class="lab-campo-mini">Maniquí
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
        <button type="button" class="btn-secondary lab-btn" data-rival-ajuste="ataque">El rival te ataca…</button>
      </div>
    </div>
    <div class="lab-rival-fila">
      ${r.activo ? maniquiHtml(r.activo, { activo: true }) : ''}
      ${r.banca.map((d) => maniquiHtml(d)).join('')}
    </div>`
  )
}

// ── Tu lado ──

function pintarCampo() {
  const p = L.partida
  const s = p.s
  // Premios boca abajo (o boca arriba si los has visto).
  poner(
    $('#labPremios'),
    s.premios.length
      ? s.premios.map((u) => (s.premiosVistos[u] ? cartaHtml(u, { extra: ' data-premio' }) : `<button type="button" class="lab-carta lab-carta-dorso" data-premio="${u}" aria-label="Premio boca abajo">${dorsoHtml()}</button>`)).join('')
      : s.fase === 'preparacion'
        ? '<p class="subtext">Se ponen al empezar.</p>'
        : '<p class="subtext">No te quedan.</p>'
  )
  poner($('#labEstadio'), s.estadio ? cartaHtml(s.estadio, { extra: ' data-estadio' }) : '<p class="subtext">Ninguno</p>')
  poner(
    $('#labActivo'),
    s.activo
      ? slotHtml(s.activo, { activo: true })
      : `<div class="lab-hueco lab-hueco-activo"><p>${s.fase === 'preparacion' ? 'Elige tu Pokémon activo: toca un básico de tu mano.' : 'Sin Pokémon activo.'}</p></div>`
  )
  const huecos = Math.max(0, (s.fase === 'preparacion' ? 5 : p.maxBanca) - s.banca.length)
  poner($('#labBanca'), s.banca.map((x) => slotHtml(x)).join('') + Array.from({ length: huecos }, () => '<div class="lab-hueco" aria-hidden="true"></div>').join(''))
  const ctx = s.fase === 'turno' ? contextoDeProbabilidad(p) : null
  poner(
    $('#labMazo'),
    `${dorsoHtml()}<span class="lab-pila-texto"><strong>${s.mazo.length}</strong> en el mazo${ctx && ctx.t ? `<br><span class="subtext">${ctx.t} ${ctx.t === 1 ? 'conocida' : 'conocidas'} arriba</span>` : ''}</span>`
  )
  const ultima = s.descarte.at(-1)
  poner($('#labDescarte'), `${ultima ? `<span class="lab-pila-cara">${imagenHtml(p.carta(ultima))}</span>` : '<span class="lab-pila-vacia" aria-hidden="true"></span>'}<span class="lab-pila-texto"><strong>${s.descarte.length}</strong> en el descarte</span>`)
}

function pintarAcciones() {
  const p = L.partida
  const s = p.s
  let html = ''
  if (s.fase === 'preparacion') {
    const mull = s.mulligans
      ? `<p class="lab-aviso">${s.mulligans} ${s.mulligans === 1 ? 'mulligan' : 'mulligans'} antes de esta mano (sin básicos). <button type="button" class="link-btn" data-ver-mulligans>Verlas</button></p>`
      : ''
    html = `
      ${mull}
      <p class="lab-guia">Toca los básicos de tu mano para ponerlos de activo o en la banca. Luego, empieza: se ponen los 6 premios y robas tu primera carta.</p>
      <div class="lab-acciones-botones">
        <button type="button" class="btn-primary lab-btn" data-accion="empezar"${s.activo ? '' : ' disabled'}>Empezar la partida</button>
        <button type="button" class="btn-secondary lab-btn" data-accion="auto">Colocar automáticamente</button>
      </div>`
  } else if (s.fase === 'turno') {
    const f = s.flags
    const chip = (hecho, texto, pendiente) => `<span class="lab-estado${hecho ? ' lab-estado-hecho' : ''}">${hecho ? texto : pendiente}</span>`
    const primero = p.primerTurnoDelPrimero
    html = `
      <div class="lab-estados" aria-label="Lo que llevas este turno">
        ${chip(f.energia, 'Energía unida', 'Energía por unir')}
        ${primero ? '<span class="lab-estado lab-estado-hecho">Sin partidario (turno 1)</span>' : chip(f.partidario, 'Partidario jugado', 'Partidario libre')}
        ${chip(f.estadio, 'Estadio jugado', 'Estadio libre')}
        ${chip(f.retirada, 'Ya te has retirado', 'Retirada libre')}
        ${s.koUltimoTurnoRival ? '<span class="lab-estado lab-estado-alerta">El rival te dejó KO un Pokémon el turno pasado</span>' : ''}
        ${!s.estricta ? '<span class="lab-estado lab-estado-alerta">Modo libre: sin reglas</span>' : ''}
      </div>
      <div class="lab-acciones-botones">
        <button type="button" class="btn-secondary lab-btn" data-accion="atacar"${s.activo ? '' : ' disabled'}>Atacar…</button>
        ${s.estadio && EFECTOS.entrenadores[claveDeEfecto(p.carta(s.estadio))]?.estadio ? `<button type="button" class="btn-secondary lab-btn" data-accion="estadio">${escapeHtml(EFECTOS.entrenadores[claveDeEfecto(p.carta(s.estadio))].estadio.nombre)}</button>` : ''}
        <button type="button" class="btn-primary lab-btn" data-accion="pasar">Terminar el turno</button>
      </div>`
  }
  poner($('#labAcciones'), html)
}


function pintarMano() {
  const p = L.partida
  const s = p.s
  $('#labManoTitulo').textContent = `Tu mano (${s.mano.length})`
  poner($('#labMano'), s.mano.length ? s.mano.map((u) => cartaHtml(u, { extra: ' data-mano', nueva: L.nuevas?.has(u) })).join('') : '<p class="subtext">No tienes cartas en la mano.</p>')
}

function pintarRegistro() {
  const r = L.partida.s.registro
  const ultimas = r.slice(-60)
  poner(
    $('#labRegistro'),
    ultimas.map((x) => `<li${/^── /.test(x.texto) ? ' class="lab-registro-turno"' : ''}>${escapeHtml(x.texto)}</li>`).join('')
  )
  const lista = $('#labRegistro')
  if (lista) lista.scrollTop = lista.scrollHeight
}

function pintarFin() {
  const s = L.partida.s
  const el = $('#labFin')
  if (!el) return
  if (s.fase !== 'fin' || !s.resultado) {
    el.classList.add('hidden')
    return
  }
  const r = s.resultado
  const titulo = r.tipo === 'victoria' ? '¡Victoria!' : r.tipo === 'sin-basicos' ? 'No se puede empezar' : 'Fin de la partida'
  poner(
    el,
    `<div class="lab-fin-caja">
      <h3>${titulo}</h3>
      <p>${escapeHtml(r.texto)}</p>
      <p class="subtext">${s.mulligans ? `${s.mulligans} ${s.mulligans === 1 ? 'mulligan' : 'mulligans'} · ` : ''}${s.rival.caidos || 0} ${s.rival.caidos === 1 ? 'KO' : 'KO'} al rival · ${6 - s.premios.length} premios cogidos</p>
      <div class="lab-acciones-botones">
        <button type="button" class="btn-primary lab-btn" data-accion="otra">Otra partida</button>
        ${L.partida.puedeDeshacer ? '<button type="button" class="btn-secondary lab-btn" data-accion="deshacer">Deshacer lo último</button>' : ''}
      </div>
    </div>`
  )
  el.classList.remove('hidden')
}

// ════════════════════════════════════════════════════════════════════
// La tabla de probabilidades
// ════════════════════════════════════════════════════════════════════

const pct = (x) => (x == null || Number.isNaN(x) ? '—' : x >= 0.9995 ? '100 %' : x > 0 && x < 0.0005 ? '<0,1 %' : `${(x * 100).toFixed(x < 0.1 && x > 0 ? 1 : 0).replace('.', ',')} %`)
const barra = (x) => `<span class="lab-barra-prob" aria-hidden="true"><span style="--pct: ${Math.round((x || 0) * 100)}%"></span></span>`

// Una fila por NOMBRE (las impresiones de una misma carta van juntas),
// en el orden de las secciones del constructor.
function gruposDelMazo() {
  const secc = seccionesDelMazo(L.entradas)
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

function pintarProb() {
  const el = $('#labProb')
  const boton = $('[data-accion="prob"]')
  boton?.setAttribute('aria-pressed', String(L.probAbierta))
  L.raiz.classList.toggle('lab-con-prob', L.probAbierta)
  if (!el) return
  el.classList.toggle('hidden', !L.probAbierta)
  if (!L.probAbierta) return
  const pest = L.probPestania
  const cab = `
    <div class="lab-prob-cab">
      <h3 id="labProbTitulo">Probabilidades</h3>
      <button type="button" class="lab-cerrar lab-prob-cerrar" data-accion="prob" aria-label="Cerrar las probabilidades">×</button>
    </div>
    <div class="lab-pestanias" role="tablist" aria-label="Qué probabilidades">
      <button type="button" role="tab" class="lab-pestania${pest === 'ahora' ? ' activa' : ''}" aria-selected="${pest === 'ahora'}" data-prob-pestania="ahora">En esta partida</button>
      <button type="button" role="tab" class="lab-pestania${pest === 'mazo' ? ' activa' : ''}" aria-selected="${pest === 'mazo'}" data-prob-pestania="mazo">Del mazo, antes de robar</button>
    </div>`
  poner(el, cab + (pest === 'ahora' ? tablaAhora() : tablaMazo()))
}

function tablaAhora() {
  const p = L.partida
  const s = p.s
  if (s.fase === 'fin' && s.resultado?.tipo === 'sin-basicos') return '<p class="subtext">No hay partida.</p>'
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
    filas += fila(`<strong>Cualquiera de tus ${sel.length} marcadas</strong>`, (c) => set.has(claveDeNombre(c)), { clase: 'lab-fila-grupo' })
  }
  filas += GRUPOS_ESPECIALES.map((g) => fila(g.texto, g.f, { clase: 'lab-fila-grupo' })).join('')
  for (const seccion of gruposDelMazo()) {
    filas += `<tr class="lab-fila-seccion"><th colspan="5" scope="colgroup">${seccion.titulo}</th></tr>`
    for (const g of seccion.grupos) {
      const m = enMano(g.clave)
      filas += fila(escapeHtml(nombreVisible(g.carta)), (c) => claveDeNombre(c) === g.clave, {
        check: `<input type="checkbox" class="lab-marca" data-marca="${escapeHtml(g.clave)}"${L.seleccion.has(g.clave) ? ' checked' : ''} aria-label="Marcar ${escapeHtml(nombreVisible(g.carta))} para sumarla a «cualquiera de las marcadas»" />`,
        pie: `<span class="lab-fila-pie">${g.n} en la lista${m ? ` · ${m} en mano` : ''}</span>`,
      })
    }
  }
  const saber = ctx.S === 0 && ctx.Ph > 0 ? 'Ya has visto tu mazo entero: sabes qué hay en los premios.' : ctx.conf.length || ctx.t || ctx.b ? `Sabes ${ctx.conf.length + ctx.t + ctx.b} ${ctx.conf.length + ctx.t + ctx.b === 1 ? 'carta' : 'cartas'} del mazo (las viste y siguen dentro).` : 'Aún no has mirado el mazo: lo que no ves puede estar en él o en los premios.'
  return `
    <p class="lab-prob-resumen">${s.fase === 'preparacion' ? 'Antes de empezar' : `Turno ${s.turno}`} · mazo ${ctx.D} · premios boca abajo ${ctx.Ph}</p>
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
        <thead><tr><th scope="col">Carta</th><th scope="col" title="En el mazo o en los premios">Quedan</th><th scope="col">Próximo robo</th><th scope="col">En ${n} ${n === 1 ? 'robo' : 'robos'}</th>${ctx.S === 0 && ctx.Ph > 0 ? '<th scope="col" title="Ya has visto el mazo entero: sabes cuántas hay en los premios">En premios</th>' : '<th scope="col" title="Probabilidad de que TODAS las que quedan estén en los premios">Todas premiadas</th>'}</tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <p class="subtext lab-prob-nota">Calculado con lo que <strong>tú</strong> sabes en la mesa, no con el orden real del mazo: lo que no has visto está repartido al azar entre el mazo y los premios boca abajo. Marca varias cartas para ver la probabilidad de robar cualquiera de ellas.</p>`
}

function tablaMazo() {
  const o = L.odds
  if (!o || o.total < 13) return '<p class="subtext">Hacen falta al menos 13 cartas.</p>'
  const filas = []
  for (const seccion of gruposDelMazo()) {
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
    <div class="lab-cifras">
      <div class="lab-cifra"><span class="lab-cifra-valor">${pct(o.mulligan)}</span><span class="lab-cifra-texto">de mulligan (${o.basicos} ${o.basicos === 1 ? 'básico' : 'básicos'} en ${o.total})</span></div>
      <div class="lab-cifra"><span class="lab-cifra-valor">${pct(o.dosBasicos)}</span><span class="lab-cifra-texto">de las manos que juegas salen con 2 o más básicos</span></div>
      <div class="lab-cifra"><span class="lab-cifra-valor">${o.mediaMulligans.toFixed(2).replace('.', ',')}</span><span class="lab-cifra-texto">mulligans de media por partida</span></div>
    </div>
    <div class="lab-tabla-caja">
      <table class="lab-tabla">
        <thead><tr><th scope="col">Carta</th><th scope="col">En la mano inicial</th><th scope="col" title="Mano inicial + 2 robos">Para tu turno 2</th><th scope="col" title="Mano inicial + 3 robos">Para tu turno 3</th><th scope="col">Todas premiadas</th></tr></thead>
        <tbody>${filas.join('')}</tbody>
      </table>
    </div>
    <p class="subtext lab-prob-nota">Exactas, no simuladas, y contando con el mulligan: la mano que juegas es la que tiene un básico. «Para tu turno N» es la mano inicial más un robo por turno (el que va primero también roba en su primer turno).</p>`
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
  // es el `body`— (tanda 422). Con el foco fuera del laboratorio, el
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
  ops.push({ separador: true })
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
  } else {
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
    if (hab || def) {
      ops.push({
        texto: `Habilidad: ${escapeHtml(hab?.name || def?.nombre || '')}`,
        detalle: def ? '' : 'no automatizada: hazla a mano',
        no: p.motivoNoHabilidad(slot),
        accion: () => hacer(() => p.usarHabilidad(slot, ui)),
      })
    }
    if (slot !== s.activo) ops.push({ texto: 'Pasar al puesto activo', detalle: 'a mano, sin reglas', accion: () => hacer(() => p.cambiarActivo(slot)) })
  }
  ops.push({ separador: true })
  ops.push({ texto: 'Ver la carta', accion: () => verCarta(c, slot) })
  if (s.fase === 'turno') {
    ops.push({ texto: 'Poner o quitar daño…', detalle: 'a mano', accion: () => hacer(() => ajustarDanio(slot)) })
    ops.push({ texto: 'Estado especial…', detalle: 'a mano', accion: () => hacer(() => ajustarEstado(slot)) })
    ops.push({ texto: 'Simular KO del rival', detalle: 'como si te lo hubiera dejado KO en su último turno', peligro: true, accion: () => hacer(() => koDelRival(slot)) })
    ops.push({ texto: 'Devolver a la mano', detalle: 'con todo lo unido', accion: () => hacer(() => devolverSlot(slot)) })
  }
  abrirMenu(ancla, escapeHtml(nombreVisible(c)), ops)
}

function costeHtml(coste) {
  if (!coste.length) return 'sin coste'
  return coste.map((l) => `<span class="lab-energia" data-tipo="${l}" title="${NOMBRE_DE_LETRA[l] || l}">${l}</span>`).join('')
}

async function ajustarDanio(slot) {
  const n = await ui.numero({ titulo: `Daño en ${escapeHtml(nombreVisible(L.partida.cartaDe(slot)))}`, texto: 'El total de daño que tiene (de 10 en 10).', min: 0, max: 990, paso: 10, valor: slot.danio })
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
  p.log(`${nombreVisible(p.carta(slot.cartas[0]))} y lo unido vuelven a tu mano (a mano).`)
  await p.reponerActivo(ui)
}

function menuDeMazo(ancla) {
  const p = L.partida
  const ops = [
    { texto: 'Robar una carta', detalle: 'a mano, fuera del robo del turno', accion: () => hacer(() => p.robar(1, { motivo: 'A mano' })) },
    { texto: 'Buscar en el mazo…', detalle: 'coger cualquier carta, a mano', accion: () => hacer(() => buscarAMano()) },
    { texto: 'Mirar las de arriba…', accion: () => hacer(() => mirarArribaAMano()) },
    { texto: 'Barajar', accion: () => hacer(() => (p.barajar(), p.log('Barajas el mazo.'))) },
  ]
  abrirMenu(ancla, `Tu mazo · ${p.s.mazo.length}`, ops)
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

function menuDeDescarte(ancla) {
  const p = L.partida
  const ops = [
    { texto: `Ver el descarte (${p.s.descarte.length})`, no: p.s.descarte.length ? null : 'Está vacío.', accion: () => verZona('descarte') },
    { texto: 'Recuperar cartas…', detalle: 'a la mano, a mano', no: p.s.descarte.length ? null : 'Está vacío.', accion: () => hacer(() => recuperarAMano()) },
  ]
  abrirMenu(ancla, 'Tu descarte', ops)
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
    { texto: 'Coger este premio', detalle: 'a mano (al dejar KO al rival se coge solo)', no: s.fase === 'turno' ? null : 'Ahora no.', accion: () => hacer(() => { s.premios = s.premios.filter((u) => u !== uid); delete s.premiosVistos[uid]; s.mano.push(uid); p.log(`Coges un premio: ${p.nombre(uid)}.`) }) },
    { texto: 'Darles la vuelta a todos', detalle: 'es trampa: desde ahí las probabilidades saben qué hay', accion: () => hacer(() => { for (const u of s.premios) s.premiosVistos[u] = true; p.log('Miras tus premios (trampa).') }) },
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
  if (def) {
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
  ops.push({ texto: 'Descartar el estadio', detalle: 'a mano', accion: () => hacer(() => { s.descarte.push(s.estadio); s.estadio = null; p.log('Descartas el estadio (a mano).') }) })
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
  abrirMenu(ancla, 'El rival te ataca (simulado)', ops)
}

// ════════════════════════════════════════════════════════════════════
// Ventanas: el `ui` del motor
// ════════════════════════════════════════════════════════════════════
//
// Cada una devuelve una promesa. Cerrar sin elegir rechaza con
// `Cancelado`, y el motor deshace lo que la carta llevara hecho.

let cierreDialogo = null

function abrirDialogo(html, { alCerrar } = {}) {
  cerrarMenu()
  const velo = $('#labVelo')
  const caja = $('#labDialogo')
  caja.innerHTML = html
  velo.classList.remove('hidden')
  cierreDialogo = alCerrar || null
  requestAnimationFrame(() => (caja.querySelector('[autofocus], .lab-dialogo-cuerpo button, button') || caja).focus?.())
  return caja
}

function cerrarDialogo() {
  $('#labVelo').classList.add('hidden')
  $('#labDialogo').innerHTML = ''
  cierreDialogo = null
}

function cancelarDialogo() {
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

const ui = {
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
        { alCerrar: sinCancelar ? null : () => reject(new Cancelado()) }
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
      const p = L.partida
      const r = p.s.rival
      const dummies = [r.activo, ...r.banca].filter(Boolean)
      const sel = new Set()
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         ${texto ? `<p class="subtext">${escapeHtml(texto)}</p>` : ''}
         <div class="lab-dialogo-cuerpo"><div class="lab-rejilla-pokemon">
           ${opciones
             .map((id) => {
               const slot = p.slot(id)
               if (slot) {
                 const c = p.cartaDe(slot)
                 return `<button type="button" class="lab-elegible lab-elegible-pokemon" data-elige="${id}" aria-pressed="false">${imagenHtml(c)}<span class="lab-elegible-nombre">${escapeHtml(nombreVisible(c))}${slot === p.s.activo ? ' (activo)' : ''}</span><span class="subtext">${Math.max(0, p.psDe(slot) - slot.danio)}/${p.psDe(slot)} PS</span></button>`
               }
               const d = dummies.find((x) => x.id === id)
               if (d) return `<button type="button" class="lab-elegible lab-elegible-pokemon lab-elegible-rival" data-elige="${id}" aria-pressed="false"><span class="lab-elegible-nombre">${d === r.activo ? 'Activo rival' : 'Banca rival'}: ${escapeHtml(d.nombre)}</span><span class="subtext">${Math.max(0, d.ps - d.danio)}/${d.ps} PS</span></button>`
               return ''
             })
             .join('')}
         </div></div>
         ${botonesDialogo({ cancelar: !sinCancelar, okDes: min > 0 })}`,
        { alCerrar: sinCancelar ? null : () => reject(new Cancelado()) }
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
      const p = L.partida
      const r = p.s.rival
      const dummies = [r.activo, ...r.banca].filter(Boolean)
      const reparto = Object.fromEntries(opciones.map((id) => [id, 0]))
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         <p class="lab-dialogo-cuenta" aria-live="polite"></p>
         <div class="lab-dialogo-cuerpo"><div class="lab-reparto">
           ${opciones
             .map((id) => {
               const d = dummies.find((x) => x.id === id)
               return `<div class="lab-reparto-fila"><span>${d === r.activo ? 'Activo' : 'Banca'}: ${escapeHtml(d?.nombre || id)} <span class="subtext">(${Math.max(0, d.ps - d.danio)} PS)</span></span>
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
  premios({ titulo, n }) {
    return new Promise((resolve) => {
      const p = L.partida
      const s = p.s
      const sel = new Set()
      const caja = abrirDialogo(
        `<h3 id="labDialogoTitulo">${escapeHtml(titulo)}</h3>
         <p class="subtext">Toca ${n === 1 ? 'el que quieras' : `${n} premios`}: están boca abajo.</p>
         <div class="lab-dialogo-cuerpo"><div class="lab-rejilla-cartas lab-rejilla-premios">
           ${s.premios.map((u, i) => (s.premiosVistos[u] ? `<button type="button" class="lab-carta lab-elegible" data-elige="${u}" aria-pressed="false" aria-label="${escapeHtml(p.nombre(u))}">${imagenHtml(p.carta(u))}</button>` : `<button type="button" class="lab-carta lab-elegible lab-carta-dorso" data-elige="${u}" aria-pressed="false" aria-label="Premio ${i + 1}">${dorsoHtml()}</button>`)).join('')}
         </div></div>
         ${botonesDialogo({ cancelar: false, okDes: true })}`
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
function verCarta(c, slot = null) {
  const p = L.partida
  const texto = textoDeCarta(c)
  const ataques = Array.isArray(c.attacks) ? c.attacks : []
  const habs = Array.isArray(c.abilities) ? c.abilities : []
  const bloques = []
  if (esPokemon(c)) {
    bloques.push(`<p class="subtext">${[c.stage === 'Basic' ? 'Básico' : c.stage === 'Stage1' ? 'Fase 1' : c.stage === 'Stage2' ? 'Fase 2' : c.stage, c.hp ? `${c.hp} PS` : null, c.evolve_from ? `evoluciona de ${escapeHtml(c.evolve_from)}` : null, Number.isFinite(c.retreat) ? `retirada ${c.retreat}` : null, `${premiosQueDa(c)} ${premiosQueDa(c) === 1 ? 'premio' : 'premios'}`].filter(Boolean).join(' · ')}</p>`)
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
        ${slot ? `<p class="subtext">${slot.cartas.length > 1 ? `Debajo: ${slot.cartas.slice(0, -1).map((u) => escapeHtml(p.nombre(u))).join(', ')}. ` : ''}${slot.energias.length ? `Energías: ${slot.energias.map((u) => escapeHtml(p.nombre(u))).join(', ')}.` : ''}</p>` : ''}
      </div>
    </div>
    <div class="lab-dialogo-botones"><button type="button" class="btn-primary lab-btn" data-dlg="ok">Cerrar</button></div>`
  )
  caja.onclick = (e) => {
    if (e.target.closest('[data-dlg]')) cerrarDialogo()
  }
}

function verZona(zona) {
  const p = L.partida
  const lista = zona === 'descarte' ? [...p.s.descarte].reverse() : []
  const caja = abrirDialogo(
    `<h3 id="labDialogoTitulo">Tu descarte (${lista.length})</h3>
     <div class="lab-dialogo-cuerpo"><div class="lab-rejilla-cartas">${lista.map((u) => `<button type="button" class="lab-carta" data-ver="${u}" aria-label="${escapeHtml(p.nombre(u))}">${imagenHtml(p.carta(u))}</button>`).join('')}</div></div>
     <div class="lab-dialogo-botones"><button type="button" class="btn-primary lab-btn" data-dlg="ok">Cerrar</button></div>`
  )
  caja.onclick = (e) => {
    const v = e.target.closest('[data-ver]')
    if (v) return verCarta(p.carta(v.dataset.ver))
    if (e.target.closest('[data-dlg]')) cerrarDialogo()
  }
}

function verMulligans() {
  const p = L.partida
  const caja = abrirDialogo(
    `<h3 id="labDialogoTitulo">Manos sin básico</h3>
     <p class="subtext">Se enseñan al rival, se barajan y se roba otra. Por cada una, tu rival puede robar una carta de más.</p>
     <div class="lab-dialogo-cuerpo">${p.s.manosMulligan.map((m, i) => `<p class="lab-rotulo">Mulligan ${i + 1}</p><div class="lab-rejilla-cartas lab-rejilla-mini">${m.map((u) => `<span class="lab-carta">${imagenHtml(p.carta(u))}</span>`).join('')}</div>`).join('')}</div>
     <div class="lab-dialogo-botones"><button type="button" class="btn-primary lab-btn" data-dlg="ok">Cerrar</button></div>`
  )
  caja.onclick = (e) => {
    if (e.target.closest('[data-dlg]')) cerrarDialogo()
  }
}

// ── Nueva partida: con qué opciones ──
function dialogoNueva() {
  const o = L.opciones
  const caja = abrirDialogo(
    `<h3 id="labDialogoTitulo">Nueva partida</h3>
     <fieldset class="lab-opciones-partida">
       <legend>¿Quién empieza?</legend>
       ${[['azar', 'Al azar (moneda)'], ['primero', 'Voy primero'], ['segundo', 'Voy segundo']].map(([v, t]) => `<label class="lab-radio"><input type="radio" name="labPrimero" value="${v}"${o.primero === v ? ' checked' : ''} /> ${t}</label>`).join('')}
     </fieldset>
     <label class="lab-radio"><input type="checkbox" id="labEstricta"${o.estricta ? ' checked' : ''} /> Reglas de verdad (una energía y un partidario por turno, sin evolucionar el primer turno…)</label>
     <p class="subtext">Sin ellas es un tapete libre: puedes hacer cualquier cosa para montar una situación.</p>
     ${botonesDialogo({ ok: 'Repartir' })}`
  )
  caja.onclick = (e) => {
    const d = e.target.closest('[data-dlg]')
    if (!d) return
    if (d.dataset.dlg === 'cancelar') return cerrarDialogo()
    o.primero = caja.querySelector('input[name="labPrimero"]:checked')?.value || 'azar'
    o.estricta = caja.querySelector('#labEstricta').checked
    guardarPrefs()
    cerrarDialogo()
    nuevaPartida()
  }
}

// ── Colocar solo: el básico con más PS delante y el resto a la banca ──
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

function enganchar() {
  const raiz = L.raiz
  raiz.addEventListener('click', (e) => {
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

    const a = e.target.closest('[data-accion]')
    if (a && !a.disabled) return accionDeBarra(a.dataset.accion, a)
    if (L.ocupado || !L.partida) return
    const p = L.partida

    const mano = e.target.closest('[data-mano]')
    if (mano) {
      const uid = mano.dataset.uid
      // En la preparación, tocar un básico lo coloca sin menú: activo si
      // no hay, banca si ya lo hay. Es lo que se hace diez veces seguidas.
      if (p.s.fase === 'preparacion') {
        const c = p.carta(uid)
        if (!esBasicoEnJuego(c) || !esPokemon(c)) return showToast('En la preparación solo se ponen Pokémon básicos.', 'error')
        return hacer(() => p.colocar(uid, p.s.activo ? 'banca' : 'activo'))
      }
      return menuDeMano(uid, mano)
    }
    const slot = e.target.closest('[data-slot-carta]')
    if (slot) return menuDeSlot(slot.dataset.slotCarta, slot)
    const pila = e.target.closest('[data-pila]')
    if (pila) return pila.dataset.pila === 'mazo' ? menuDeMazo(pila) : menuDeDescarte(pila)
    const premio = e.target.closest('[data-premio]')
    if (premio) return menuDePremio(premio.dataset.premio || premio.dataset.uid, premio)
    if (e.target.closest('[data-estadio]')) return menuDeEstadio(e.target.closest('[data-estadio]'))
    if (e.target.closest('[data-ver-mulligans]')) return verMulligans()

    const aj = e.target.closest('[data-rival-ajuste]')
    if (aj && aj.tagName === 'BUTTON') return ajusteRival(aj.dataset.rivalAjuste, aj)

    const robos = e.target.closest('[data-robos]')
    if (robos) {
      L.nRobos = Math.max(1, Math.min(20, L.nRobos + Number(robos.dataset.robos)))
      guardarPrefs()
      return pintarProb()
    }
    const pest = e.target.closest('[data-prob-pestania]')
    if (pest) {
      L.probPestania = pest.dataset.probPestania
      return pintarProb()
    }
  })

  raiz.addEventListener('change', (e) => {
    const marca = e.target.closest('[data-marca]')
    if (marca) {
      if (marca.checked) L.seleccion.add(marca.dataset.marca)
      else L.seleccion.delete(marca.dataset.marca)
      return pintarProb()
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

  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#labVelo').classList.contains('hidden')) return cancelarDialogo()
      if (!$('#labMenu').classList.contains('hidden')) return cerrarMenu()
      return cerrar()
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
      e.preventDefault()
      accionDeBarra('deshacer')
    }
  })
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
      if (L.ocupado || !p?.deshacer()) return
      cerrarMenu()
      return pintar()
    case 'prob':
      L.probAbierta = !L.probAbierta
      guardarPrefs()
      return pintarProb()
    case 'empezar':
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
