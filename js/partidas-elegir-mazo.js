// «Tu mazo» en los formularios de /mis-partidas (tanda 1070): uno de tus
// mazos GUARDADOS del constructor, o escrito a mano como siempre.
//
// Ibai: «al guardar tus partidas/torneos jugados, que puedas seleccionar
// algún mazo de tu constructor para elegir que has jugado con uno de ellos,
// en vez de añadir a mano tu mazo (esto podría sumar para las estadísticas)»
// y «que puedas ponerte un mazo predeterminado para que cuando los añadas no
// lo tengas que seleccionar».
//
// Con un mazo guardado no se escribe nada: el arquetipo (lo que agrupa la
// matriz con las partidas de torneo) se DEDUCE de la lista, y se dice cuál
// («Cuenta como Dragapult ex»), con «Cambiar» por si la deducción no es la
// que tú dirías. Si la lista no tiene Pokémon de los que deducirlo, se pide a
// mano. Al editar, el arquetipo que la fila YA tiene se respeta tal cual: que
// la partida cambie de casilla en la matriz por haberla abierto es justo lo
// que no puede pasar (251).
//
// El formulario lo pone la página (mis-partidas.html, para que no salte al
// abrirse); esto le da vida. Lo puro va exportado para probarlo en Node.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

const FORMATOS = { standard: 'Estándar', expanded: 'Expandido', libre: 'Libre' }
// Lo que eligió la última vez cada formulario: quien apunta a mano no tiene
// por qué ver sus mazos guardados delante cada vez.
const CLAVE_ORIGEN = 'pokedoc-partidas-origen-mazo'

// ── Lo puro ──

// ¿Lo elegido es tu mazo predeterminado? Un mazo guardado se compara por su
// id; uno escrito a mano, por su clave de arquetipo.
export function coincideConPredeterminado(valor, predet) {
  if (!valor || !predet) return false
  if (predet.user_deck_id) return valor.guardado === predet.user_deck_id
  return !valor.guardado && Boolean(predet.mi_mazo) && valor.clave === predet.mi_mazo
}

// Qué hacer con el predeterminado al guardar: ponerlo (marcado y no lo era),
// quitarlo (desmarcado y lo era) o nada.
export function cambioDePredeterminado({ marcado, valor, predet }) {
  const es = coincideConPredeterminado(valor, predet)
  if (marcado && !es && valor?.clave) return 'poner'
  if (!marcado && es) return 'quitar'
  return null
}

// La fila de `match_log_ajustes` de un mazo elegido.
export function filaDePredeterminado(valor) {
  return {
    user_deck_id: valor?.guardado || null,
    mi_mazo: valor?.clave || null,
    mi_mazo_nombre: valor?.clave ? valor.nombre || null : null,
  }
}

// Los mazos en el orden en que se enseñan: el predeterminado primero, y los
// demás como llegan (el último que tocaste, arriba). Con la fila que ya
// tiene la partida aunque no esté entre los tuyos (472).
export function mazosParaElegir(mazos, { predet = null, actual = null } = {}) {
  const lista = (mazos || []).map((m) => ({ id: m.id, nombre: m.name || 'Mazo sin nombre', formato: m.format || null, cartas: m.cards || [] }))
  if (actual && !lista.some((m) => m.id === actual)) lista.push({ id: actual, nombre: 'Un mazo que ya no está en tu lista', formato: null, cartas: [], perdido: true })
  const p = predet?.user_deck_id
  return p ? [...lista.filter((m) => m.id === p), ...lista.filter((m) => m.id !== p)] : lista
}

// Con qué se abre un formulario NUEVO: tu predeterminado si lo hay; si no,
// lo de la última vez; si no, tus mazos guardados si tienes alguno.
export function origenInicial({ hayMazos, recordado = null, predet = null }) {
  if (!hayMazos) return 'mano'
  if (predet?.user_deck_id) return 'guardado'
  if (predet?.mi_mazo) return 'mano'
  return recordado === 'mano' ? 'mano' : 'guardado'
}

// ── La pantalla ──
//
// caja: el bloque `[data-elegir-mazo]` del formulario, con dentro
//   [data-origenes] (Mis mazos / A mano), [data-guardados] (las baldosas),
//   [data-cuenta-como], [data-mano] (los dos selectores), [data-pista] y
//   [data-predet] (la casilla).
// o: {
//   nombre:       'suelta' | 'torneo' (para recordar el origen de cada uno)
//   mano:         () => { clave, nombre } | null (lo de los dos selectores)
//   ponerMano:    (clave, nombre) => void (los rellena, o los vacía sin nombre)
//   mazos:        () => tus mazos guardados
//   deducir:      (id) => Promise<{ clave, nombre } | null>
//   preparar:     () => Promise (pide de una vez las cartas de todos)
//   spritesHtml:  (nombre, clave) => html
//   enlazar:      () => boolean (la base tiene dónde guardar el mazo guardado)
//   predet:       () => fila de ajustes | null
//   conPredet:    () => boolean (la base tiene dónde guardarlo)
// }
export function montarElegirMazo(caja, o) {
  const $ = (sel) => caja.querySelector(sel)
  const origenes = $('[data-origenes]')
  const guardados = $('[data-guardados]')
  const cuentaComo = $('[data-cuenta-como]')
  const mano = $('[data-mano]')
  const pista = $('[data-pista]')
  const predetCaja = $('[data-predet]')
  const casilla = predetCaja?.querySelector('input')

  let origen = 'mano'
  let elegido = null // id del mazo guardado
  let arq = null // { clave, nombre } del guardado: deducido o el de la fila
  let deduciendo = null // la promesa de la deducción en curso
  let turno = 0
  let cambiando = false // «Cambiar»: el arquetipo del guardado, a mano
  let actualDeFila = null // el mazo guardado que la fila ya tenía (472)
  const deducidos = new Map() // id → { clave, nombre } | null, para las baldosas

  const recordado = () => {
    try {
      return localStorage.getItem(`${CLAVE_ORIGEN}-${o.nombre}`)
    } catch {
      return null
    }
  }
  const recordar = (v) => {
    try {
      localStorage.setItem(`${CLAVE_ORIGEN}-${o.nombre}`, v)
    } catch {
      /* sin almacenamiento, la próxima vez se abre con lo de por defecto */
    }
  }
  const ofrecerGuardados = () => o.enlazar() && (o.mazos().length > 0 || Boolean(actualDeFila))

  function baldosaHtml(m) {
    const a = deducidos.get(m.id)
    const esPredet = o.predet()?.user_deck_id === m.id
    const sprites = a ? o.spritesHtml(a.nombre, a.clave) : ''
    const sub = [a?.nombre || (deducidos.has(m.id) && !m.perdido ? 'Sin arquetipo' : ''), FORMATOS[m.formato] || ''].filter(Boolean).join(' · ')
    return `<button type="button" role="radio" class="partidas-guardado" data-mazo="${escapeHtml(m.id)}" aria-checked="${m.id === elegido}">
        <span class="partidas-guardado-sprites">${sprites || '<span class="partidas-sprite-hueco"></span>'}</span>
        <span class="partidas-guardado-texto"><b>${escapeHtml(m.nombre)}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</span>
        ${esPredet ? `<span class="partidas-guardado-predet" title="Tu mazo predeterminado">${icons.star(14)}<span class="sr-only"> Predeterminado</span></span>` : ''}
      </button>`
  }

  function pintarGuardados() {
    const lista = mazosParaElegir(o.mazos(), { predet: o.predet(), actual: actualDeFila })
    guardados.innerHTML = lista.map(baldosaHtml).join('')
  }

  // «Cuenta como …»: lo que se va a apuntar, que es lo que agrupa la matriz.
  function pintarCuentaComo() {
    const ver = origen === 'guardado' && elegido
    cuentaComo.classList.toggle('hidden', !ver)
    if (!ver) return
    if (deduciendo && !arq) {
      cuentaComo.innerHTML = '<span class="subtext">Mirando a qué juega esa lista…</span>'
      return
    }
    if (!arq) {
      cuentaComo.innerHTML = '<span class="subtext">No sabemos a qué juega esa lista (no tiene Pokémon que conozcamos): dinos cuál.</span>'
      return
    }
    cuentaComo.innerHTML = `<span class="subtext">Cuenta como</span> ${o.spritesHtml(arq.nombre, arq.clave)}<b>${escapeHtml(arq.nombre)}</b>
      ${cambiando ? '' : '<button type="button" class="link-btn" data-cambiar-arq>Cambiar</button>'}`
  }

  function pintarPredet() {
    if (!predetCaja) return
    predetCaja.classList.toggle('hidden', !o.conPredet())
    // Sigue a lo elegido… salvo que la hayas tocado tú: entonces manda tu toque.
    if (casilla && !casilla.dataset.tocada) casilla.checked = coincideConPredeterminado(valorSincrono(), o.predet())
  }

  function pintar() {
    const ofrece = ofrecerGuardados()
    if (!ofrece) origen = 'mano'
    origenes.classList.toggle('hidden', !ofrece)
    for (const b of origenes.querySelectorAll('[data-origen]')) b.setAttribute('aria-checked', String(b.dataset.origen === origen))
    guardados.classList.toggle('hidden', origen !== 'guardado')
    // A mano: los selectores. Con un guardado, solo para «Cambiar» o si la
    // lista no dice a qué juega.
    const verMano = origen === 'mano' || (Boolean(elegido) && (cambiando || (!arq && !deduciendo)))
    mano.classList.toggle('hidden', !verMano)
    // Tienes la base al día y ningún mazo guardado: dónde se guardan.
    pista?.classList.toggle('hidden', !(o.enlazar() && !o.mazos().length && !actualDeFila))
    pintarCuentaComo()
    pintarPredet()
  }

  // Elegir un mazo guardado. `fijo` es el arquetipo que la fila ya tiene (al
  // editar) o el del predeterminado cuando la lista no deja deducirlo: se
  // respeta y no se deduce otra vez.
  function elegir(id, fijo = null) {
    elegido = id
    cambiando = false
    arq = fijo
    deduciendo = null
    const mio = ++turno
    if (!fijo && id) {
      deduciendo = o.deducir(id)
      deduciendo
        .then((a) => {
          if (mio !== turno) return
          deducidos.set(id, a)
          arq = a
          deduciendo = null
          // La lista no dice a qué juega: los selectores se abren vacíos.
          if (!a) o.ponerMano(null, null)
          pintarGuardados()
          pintar()
        })
        .catch(() => {
          if (mio !== turno) return
          deduciendo = null
          pintar()
        })
    }
    for (const b of guardados.querySelectorAll('[data-mazo]')) b.setAttribute('aria-checked', String(b.dataset.mazo === id))
    pintar()
  }

  function ponerOrigen(v, { guardar = true } = {}) {
    origen = v
    if (guardar) recordar(v)
    if (v === 'mano') {
      elegido = null
      arq = null
      cambiando = false
      ++turno
    }
    pintarGuardados()
    pintar()
  }

  // Las baldosas, con sus sprites en cuanto se sepan: las cartas de todos
  // los mazos se piden de una vez.
  async function deducirTodos() {
    await o.preparar?.().catch(() => {})
    const lista = o.mazos()
    await Promise.all(
      lista.map(async (m) => {
        if (deducidos.has(m.id)) return
        deducidos.set(m.id, await o.deducir(m.id).catch(() => null))
      })
    )
    if (origen === 'guardado') pintarGuardados()
  }

  origenes.addEventListener('click', (e) => {
    const b = e.target.closest('[data-origen]')
    if (!b || b.dataset.origen === origen) return
    ponerOrigen(b.dataset.origen)
  })
  guardados.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mazo]')
    if (!b || b.dataset.mazo === elegido) return
    elegir(b.dataset.mazo)
  })
  // Las flechas mueven la elección, como en un grupo de radios.
  guardados.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
    const botones = [...guardados.querySelectorAll('[data-mazo]')]
    const i = botones.indexOf(document.activeElement)
    if (i < 0) return
    e.preventDefault()
    const sig = botones[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + botones.length) % botones.length]
    sig.focus()
    elegir(sig.dataset.mazo)
  })
  cuentaComo.addEventListener('click', (e) => {
    if (!e.target.closest('[data-cambiar-arq]')) return
    cambiando = true
    if (arq) o.ponerMano(arq.clave, arq.nombre)
    pintar()
    mano.querySelector('input')?.focus()
  })
  casilla?.addEventListener('change', () => {
    casilla.dataset.tocada = '1'
  })

  // Lo que hay elegido AHORA, sin esperar a la deducción (para la casilla).
  function valorSincrono() {
    if (origen === 'guardado' && elegido) {
      const a = (cambiando || !arq ? o.mano() : null) || arq
      return { guardado: elegido, clave: a?.clave || null, nombre: a?.nombre || null }
    }
    const m = o.mano()
    return m ? { guardado: null, clave: m.clave, nombre: m.nombre } : null
  }

  return {
    // Abrir el formulario: con lo que la fila ya tiene (editar) o, si es
    // nuevo, con tu predeterminado.
    abrir({ guardado = null, clave = null, nombre = null, nuevo = false } = {}) {
      actualDeFila = guardado && !o.mazos().some((m) => m.id === guardado) ? guardado : null
      if (casilla) delete casilla.dataset.tocada
      if (!nuevo) {
        if (guardado && o.enlazar()) {
          origen = 'guardado'
          pintarGuardados()
          elegir(guardado, clave ? { clave, nombre } : null)
        } else {
          origen = 'mano'
          elegido = null
          arq = null
          o.ponerMano(clave, nombre)
          pintarGuardados()
          pintar()
        }
      } else {
        const predet = o.conPredet() ? o.predet() : null
        const deFila = predet?.user_deck_id && o.mazos().some((m) => m.id === predet.user_deck_id)
        origen = origenInicial({ hayMazos: ofrecerGuardados(), recordado: recordado(), predet: deFila ? predet : predet?.mi_mazo ? { mi_mazo: predet.mi_mazo } : null })
        o.ponerMano(null, null)
        pintarGuardados()
        if (origen === 'guardado' && deFila) elegir(predet.user_deck_id)
        else {
          elegido = null
          arq = null
          if (origen === 'mano' && predet?.mi_mazo) o.ponerMano(predet.mi_mazo, predet.mi_mazo_nombre)
          pintar()
        }
      }
      if (ofrecerGuardados()) deducirTodos()
    },
    // Lo elegido para guardar: espera a la deducción si va por medio.
    async valor() {
      if (origen === 'guardado' && elegido && deduciendo) await deduciendo.catch(() => null)
      const v = valorSincrono()
      if (origen === 'guardado' && elegido && !v?.clave) return { error: 'Dinos a qué juega ese mazo: su lista no lo dice.' }
      if (!v?.clave) return { error: null }
      return v
    },
    // Si al guardar hay que poner o quitar el predeterminado.
    cambioDePredeterminado() {
      if (!casilla || !o.conPredet() || predetCaja.classList.contains('hidden')) return null
      return cambioDePredeterminado({ marcado: casilla.checked, valor: valorSincrono(), predet: o.predet() })
    },
    // Los selectores avisan al cambiar (la casilla sigue a lo elegido).
    alCambiarMano() {
      if (origen === 'guardado' && !cambiando && arq) return
      pintarPredet()
    },
    repintar() {
      pintarGuardados()
      pintar()
    },
    origen: () => origen,
  }
}
