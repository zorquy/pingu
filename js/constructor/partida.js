// El motor del laboratorio de pruebas (tanda 384): una partida de verdad
// —mulligan, activo y banca, turnos, energías, evoluciones, premios—
// contra un maniquí que no juega, y las probabilidades de robar cada
// carta en cada momento.
//
// Sin DOM y sin Supabase, igual que nucleo.js: así se prueba en Node, que
// es donde se ve si una regla está mal. En la pantalla una regla mal
// escrita no da error: deja jugar una carta que no se podía, o calcula
// un 40 % que es un 30.
//
// Los efectos de las cartas NO viven aquí (efectos.js): se inyectan al
// crear la partida. El motor pone las reglas y las piezas —robar,
// buscar, mover, dañar— y cada carta las combina.
//
// Y las elecciones tampoco: cuando una carta dice «elige», el motor se lo
// pregunta a un `ui` que le pasa quien llama. En la web es una ventana;
// en las pruebas, un guion. Por eso todo lo que elige es asíncrono.
import { plano, categoriaDe, esBasico, esEnergiaBasica, letraDeCartaDeEnergia, claveDeNombre, nombreVisible, subtipoDeEntrenador } from './nucleo.js'
import { INGLES_DE } from './nombres.js'

// ════════════════════════════════════════════════════════════════════
// Qué es cada carta, a efectos de jugarla
// ════════════════════════════════════════════════════════════════════

export const esPokemon = (c) => categoriaDe(c) === 'P'
export const esEntrenador = (c) => categoriaDe(c) === 'T'
export const esEnergia = (c) => categoriaDe(c) === 'E'
export const esPartidario = (c) => subtipoDeEntrenador(c) === 'partidario'
export const esObjeto = (c) => subtipoDeEntrenador(c) === 'objeto'
export const esHerramienta = (c) => subtipoDeEntrenador(c) === 'herramienta'
export const esEstadio = (c) => subtipoDeEntrenador(c) === 'estadio'

// Un nombre, normalizado para compararlo: sin tildes, en minúsculas, con
// el apóstrofo recto (el curvo llega de algún catálogo) y los guiones
// como espacios («Mega-Kangaskhan ex» y «Mega Kangaskhan ex» son la
// misma carta, y el espejo tiene de las dos).
export const normalizarNombre = (t) => plano(t).replace(/[’‘`´]/g, "'").replace(/[-‐‑]/g, ' ').replace(/\s+/g, ' ')

// La clave con la que se busca el efecto de una carta: su nombre INGLÉS,
// normalizado. Es el que no cambia entre reimpresiones. Y como la mitad
// del meta aún tiene el español en `name` (ver nombres.js), se traduce
// con la tabla antes de rendirse. (`name_es` no se mira: cuando `name`
// trae el inglés ya vale tal cual, y cuando trae el español es el mismo
// texto que `name_es`, así que mirarlo era red de repuesto de la línea
// de arriba y el rigor no la podía ver.)
export function claveDeEfecto(c) {
  const n = normalizarNombre(c?.name)
  if (INGLES_DE[n]) return INGLES_DE[n]
  return n
}

// 0 básico, 1 fase 1, 2 fase 2. Sin fase en el catálogo se deduce de
// `evolve_from`: una carta que evoluciona de algo no es básica, y es la
// forma de no bloquear una partida por un campo que aún no está.
export function faseDe(c) {
  if (!esPokemon(c)) return null
  const b = esBasico(c)
  if (b === true) return 0
  const s = plano(c.stage)
  if (/2/.test(s)) return 2
  if (/1/.test(s)) return 1
  return c.evolve_from ? 1 : 0
}
export const esBasicoEnJuego = (c) => faseDe(c) === 0
export const esEvolucion = (c) => (faseDe(c) ?? 0) > 0

// La «Regla» (Rule Box): ex, V, VMAX, VSTAR, GX, EX, Radiantes y
// Prisma. Por el nombre inglés, que es donde se ve.
// «ex» como palabra suelta y no solo al final: en español el dueño va
// detrás («Zoroark ex de N», «Mewtwo ex del Team Rocket»).
export function tieneRegla(c) {
  return [claveDeEfecto(c), normalizarNombre(c?.name)].some((n) => /(^|\s)(ex|v|vmax|vstar|v union|gx)(\s|$)/.test(n) || /^radiant /.test(n) || /(^|\s)radiante(\s|$)/.test(n) || /prism star|◇/.test(n))
}
export const esEx = (c) => [claveDeEfecto(c), normalizarNombre(c?.name)].some((n) => /(^|\s)ex(\s|$)/.test(n))
export const esMegaEx = (c) => [claveDeEfecto(c), normalizarNombre(c?.name)].some((n) => /^mega .*(^|\s)ex(\s|$)/.test(n))

// Cuántos premios da al quedar fuera de combate. Una Mega ex de la era
// actual da TRES (Mega Evolución, 2025); una ex o una V, dos.
export function premiosQueDa(c) {
  if (esMegaEx(c)) return 3
  const n = claveDeEfecto(c)
  if (/ vmax$| v union$/.test(n)) return 3
  if (tieneRegla(c) && !/^radiant /.test(n)) return 2
  return 1
}

// Los Pokémon Teracristal no se distinguen en el catálogo (TCGdex no lo
// guarda), así que van por nombre. Solo cuentan para cuatro cartas
// (Zona Cero, Noctowl, Trompeta de Cristal, Mina Nocturna) y la lista es
// corta y cerrada.
const TERA = new Set(['dragapult ex', 'teal mask ogerpon ex', 'wellspring mask ogerpon ex', 'hearthflame mask ogerpon ex', 'cornerstone mask ogerpon ex', 'greninja ex', 'terapagos ex', 'lapras ex', 'sylveon ex', 'galvantula ex', 'cinccino ex', 'hydrapple ex', 'archaludon ex'])
export const esTera = (c) => TERA.has(claveDeEfecto(c))

// Los tipos como letras de energía, que es como se escriben los costes.
const LETRA_DE_TIPO = { grass: 'G', fire: 'R', water: 'W', lightning: 'L', psychic: 'P', fighting: 'F', darkness: 'D', metal: 'M', colorless: 'C', dragon: 'N', fairy: 'Y' }
export const letraDeTipo = (t) => LETRA_DE_TIPO[plano(t)] || null
export const tiposDe = (c) => (Array.isArray(c?.types) ? c.types.map(letraDeTipo).filter(Boolean) : [])
export const esDeTipo = (c, letra) => tiposDe(c).includes(letra)
export const NOMBRE_DE_LETRA = { G: 'Planta', R: 'Fuego', W: 'Agua', L: 'Rayo', P: 'Psíquico', F: 'Lucha', D: 'Oscuro', M: 'Metal', C: 'Incolora', N: 'Dragón', Y: 'Hada' }

// «N's», «Team Rocket's», «Cynthia's»… en inglés van delante; en español,
// detrás («Zorua de N», «Petrel del Team Rocket»), y con otro nombre:
// Cintia, Paul, Roxy, Eco, Lylia, e-Nigma, Máximo.
const DUENO_EN_ESPANOL = {
  'team rocket': ['del team rocket'], n: ['de n'], cynthia: ['de cintia'], hop: ['de paul'], marnie: ['de roxy'],
  ethan: ['de eco'], lillie: ['de lylia'], iono: ['de e nigma'], steven: ['de maximo'], arven: ['de damian'],
}
export function esDe(c, dueno) {
  const d = normalizarNombre(dueno)
  if (claveDeEfecto(c).startsWith(`${d}'s `)) return true
  const n = normalizarNombre(c?.name)
  return (DUENO_EN_ESPANOL[d] || []).some((f) => n.endsWith(` ${f}`) || n.includes(` ${f} `))
}

// El nombre de la carta de la que evoluciona, en plano. Puede venir en
// inglés o en español (según de dónde se engordó la carta), así que se
// compara contra los DOS nombres del Pokémon en juego.
export function evolucionaDe(evo, base) {
  const de = plano(evo?.evolve_from)
  if (!de || !base) return false
  return de === plano(base.name) || (base.name_es && de === plano(base.name_es))
}

// ── La energía ──
//
// Una energía unida da «unidades», y cada unidad puede pagar ciertos
// tipos: una Fuego básica da una unidad que paga Fuego; una Prisma en un
// básico, una que paga cualquiera; la del Team Rocket, DOS que pagan
// Psíquica u Oscura. Pagar un coste es repartir unidades entre los
// símbolos, y eso es lo que hace `pagaCoste`.
const TODAS = ['*']
function unidadesEspeciales(nombre, portador, partida) {
  switch (nombre) {
    case 'telepathic psychic energy': return [['P']]
    case 'rocky fighting energy': return [['F']]
    case 'growing grass energy': return [['G']]
    case 'bubbly water energy': return [['W']]
    case 'voltaic lightning energy': return [['L']]
    case 'shadowy darkness energy': return [['D']]
    case "team rocket's energy": return esDe(portador, 'team rocket') ? [['P', 'D'], ['P', 'D']] : []
    case 'prism energy': return esBasicoEnJuego(portador) ? [TODAS] : [['C']]
    case 'legacy energy': return [TODAS]
    case 'neo upper energy': return faseDe(portador) === 2 ? [TODAS, TODAS] : [['C']]
    case 'ignition energy': return esEvolucion(portador) ? [['C'], ['C'], ['C']] : [['C']]
    case 'double turbo energy': return [['C'], ['C']]
    default: return [['C']]
  }
}

export function unidadesDeEnergia(carta, portador, partida = null) {
  if (esEnergiaBasica(carta)) {
    const letra = letraDeCartaDeEnergia(carta)
    if (!letra) return [['C']]
    // Meganium y su Crecimiento Salvaje: cada Planta básica da dos.
    if (letra === 'G' && partida?.hayHabilidadActiva('meganium')) return [['G'], ['G']]
    return [[letra]]
  }
  return unidadesEspeciales(claveDeEfecto(carta), portador, partida)
}

// ¿Estas unidades pagan este coste? Primero los símbolos de tipo, cada
// uno con una unidad distinta que lo cubra (se prueba por retroceso: son
// menos de diez), y lo que sobre, para los incoloros.
export function pagaCoste(coste, unidades) {
  const especificos = coste.filter((l) => l !== 'C')
  const incoloros = coste.length - especificos.length
  if (unidades.length < coste.length) return false
  const usadas = new Array(unidades.length).fill(false)
  const cubre = (u, l) => u.includes('*') || u.includes(l)
  const probar = (i) => {
    if (i === especificos.length) return unidades.length - especificos.length >= incoloros
    for (let j = 0; j < unidades.length; j++) {
      if (usadas[j] || !cubre(unidades[j], especificos[i])) continue
      usadas[j] = true
      if (probar(i + 1)) return true
      usadas[j] = false
    }
    return false
  }
  return probar(0)
}

// El coste de un ataque en letras. El espejo lo guarda canonizado en
// inglés («Fire», «Colorless»); un símbolo que no se entiende se toma
// por incoloro, que es el lado que no bloquea.
export const costeEnLetras = (ataque) => (Array.isArray(ataque?.cost) ? ataque.cost.map((t) => letraDeTipo(t) || 'C') : [])

// El daño impreso: «200», «30+», «60×». Devuelve el número y el signo.
export function danioImpreso(ataque) {
  const m = String(ataque?.damage ?? '').match(/(\d+)\s*([+×x*-]?)/)
  return m ? { base: Number(m[1]), signo: m[2] === 'x' || m[2] === '*' ? '×' : m[2] } : { base: 0, signo: '' }
}

// ════════════════════════════════════════════════════════════════════
// El azar, con semilla
// ════════════════════════════════════════════════════════════════════
//
// La semilla vive DENTRO del estado: así «Deshacer» devuelve también el
// azar, y robar otra vez tras deshacer da la misma carta. Un laboratorio
// en el que deshacer sirve para repetir el robo hasta que salga lo que
// quieres no mide nada.
export function siguienteAzar(s) {
  let t = (s.semilla = (s.semilla + 0x6d2b79f5) >>> 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ════════════════════════════════════════════════════════════════════
// Combinatoria
// ════════════════════════════════════════════════════════════════════
//
// Con logaritmos de factoriales: C(60, 30) ya no cabe exacto en un
// double y una resta de dos números enormes da basura sin avisar.
const LF = [0]
for (let i = 1; i <= 400; i++) LF[i] = LF[i - 1] + Math.log(i)
export function comb(n, k) {
  if (k < 0 || n < 0 || k > n) return 0
  return Math.exp(LF[n] - LF[k] - LF[n - k])
}
// P(H = h) con H hipergeométrica: h éxitos al sacar `m` de `N` con `K`.
export function hiper(N, K, m, h) {
  const d = comb(N, m)
  return d ? (comb(K, h) * comb(N - K, m - h)) / d : 0
}

// ════════════════════════════════════════════════════════════════════
// Las probabilidades ANTES de jugar (la tabla del mazo)
// ════════════════════════════════════════════════════════════════════
//
// Exactas, no simuladas. Y condicionadas a lo que de verdad pasa: la
// mano que juegas es la que TIENE un básico — las que no, se barajan
// (mulligan). Por eso «la tengo en la mano inicial» no es el 40 % de la
// hipergeométrica a secas para una carta de 4 copias: si esa carta no es
// básica, cada mano sin básico que se tira sube un poco sus opciones.
//
//   P(X en las primeras 7+k | hay básico en las 7)
//     = 1 − [P(sin X en 7+k) − P(sin básico ni X en 7) · P(sin X en k de las 53)] / P(hay básico)
//
// Si X es básica, «sin básico» ya implica «sin X», y el segundo término
// es P(sin básico) · P(sin X en k de las 53).
export function oddsDelMazo(entradas) {
  const N = entradas.reduce((s, e) => s + e.n, 0)
  const B = entradas.filter((e) => esBasicoEnJuego(e.carta)).reduce((s, e) => s + e.n, 0)
  if (N < 13) return { total: N, basicos: B, grupos: [] }
  const mano = 7
  const pSinBasico = comb(N - B, mano) / comb(N, mano)
  const pValida = 1 - pSinBasico
  const pUnBasico = (B * comb(N - B, mano - 1)) / comb(N, mano)
  // Tras una mano válida, las que se ven después salen de las N−7.
  const resto = N - mano

  const grupos = []
  const porClave = new Map()
  for (const e of entradas) {
    const k = claveDeNombre(e.carta)
    if (!porClave.has(k)) {
      const g = { clave: k, carta: e.carta, nombre: nombreVisible(e.carta), n: 0, basica: esBasicoEnJuego(e.carta) }
      porClave.set(k, g)
      grupos.push(g)
    }
    porClave.get(k).n += e.n
  }

  const calcula = (k, basica) => {
    const sinXni = basica ? pSinBasico : comb(N - B - k, mano) / comb(N, mano)
    const antesDe = (vistas) => {
      if (!pValida) return 0
      const sinX = comb(N - k, vistas) / comb(N, vistas)
      const extra = vistas - mano
      const sinXDespues = comb(resto - k, extra) / comb(resto, extra)
      return Math.max(0, Math.min(1, 1 - (sinX - sinXni * sinXDespues) / pValida))
    }
    // Todas en premios: ninguna en la mano (válida) y las k entre las 6
    // primeras de las 53 restantes.
    const sinXEnManoValida = pValida ? (comb(N - k, mano) / comb(N, mano) - sinXni) / pValida : 0
    // Los 6 premios son 6 cualesquiera de las `resto`: que caigan las k
    // dentro es C(6, k) / C(resto, k).
    const premiadas = k <= 6 ? sinXEnManoValida * (comb(6, k) / comb(resto, k)) : 0
    return { enMano: antesDe(mano), turno1: antesDe(mano + 1), turno2: antesDe(mano + 2), turno3: antesDe(mano + 3), todasPremiadas: premiadas }
  }
  for (const g of grupos) Object.assign(g, calcula(g.n, g.basica))

  return {
    total: N,
    basicos: B,
    mulligan: pSinBasico,
    mediaMulligans: pValida ? pSinBasico / pValida : Infinity,
    // De las manos que se JUEGAN: con dos o más básicos (banca en el
    // turno 1) y con uno solo.
    dosBasicos: pValida ? (pValida - pUnBasico) / pValida : 0,
    unBasico: pValida ? pUnBasico / pValida : 0,
    grupos,
  }
}

// ════════════════════════════════════════════════════════════════════
// La partida
// ════════════════════════════════════════════════════════════════════

export class Cancelado extends Error {
  constructor() {
    super('cancelado')
    this.cancelado = true
  }
}

// Un error que se enseña tal cual: «no puedes», con el porqué.
export class NoSePuede extends Error {
  constructor(msg) {
    super(msg)
    this.noSePuede = true
  }
}

const MAX_BANCA = 5

export class Partida {
  // `entradas`: el mazo del constructor ({ carta, n }).
  // `efectos`: la biblioteca (efectos.js). `semilla`: para repetir.
  //
  // Para jugar contra otro mazo (tanda 456) dos partidas se sientan en una
  // `Mesa`: cada una con su `prefijo` —los uids y los huecos de las dos no
  // pueden llamarse igual— y las `cartas` compartidas, para que cada lado
  // pueda leer las del otro (su activo, el estadio que ha puesto…).
  constructor({ entradas, efectos = {}, semilla = Date.now() >>> 0, vaPrimero = true, estricta = true, rival = null, prefijo = '', cartas = null, nombre = '' } = {}) {
    this.efectos = efectos
    this.prefijo = prefijo
    this.nombreJugador = nombre
    // Cada copia física es una carta con su uid; el estado solo guarda
    // uids, así se clona barato para deshacer.
    this.cartas = cartas || new Map()
    this.uidsPropios = new Set()
    let n = 0
    for (const e of entradas || []) {
      for (let i = 0; i < e.n; i++) {
        const uid = `${prefijo}c${++n}`
        this.cartas.set(uid, e.carta)
        this.uidsPropios.add(uid)
      }
    }
    // Con mesa: el otro jugador y la mesa. Sin ella, el maniquí.
    this.oponente = null
    this.mesa = null
    this.historia = []
    this.s = this.estadoInicial({ semilla, vaPrimero, estricta, rival })
  }

  estadoInicial({ semilla, vaPrimero, estricta, rival }) {
    return {
      semilla: semilla >>> 0,
      // mulligan → preparacion → turno ⇄ (rival) → fin. Con mesa, el que
      // no juega está en «espera» mientras el otro hace su turno.
      fase: 'mulligan',
      vaPrimero,
      estricta,
      turno: 0,
      mazo: [...this.uidsPropios],
      mano: [],
      premios: [],
      premiosVistos: {},
      descarte: [],
      perdida: [],
      estadio: null,
      activo: null,
      banca: [],
      jugando: [], // la carta que se está jugando, mientras dura su efecto
      mulligans: 0,
      manosMulligan: [],
      flags: this.flagsNuevas(),
      koUltimoTurnoRival: false,
      conocimiento: { arriba: 0, abajo: 0, confirmados: {} },
      rival: crearRival(rival || {}),
      registro: [],
      resultado: null,
      seq: 0,
    }
  }

  flagsNuevas() {
    return { energia: false, partidario: false, estadio: false, retirada: false, atacado: false, usos: {}, bonos: [], partidarioTR: false }
  }

  // ── Utilidades ──
  carta(uid) {
    return this.cartas.get(uid)
  }
  azar() {
    return siguienteAzar(this.s)
  }
  moneda() {
    const cara = this.azar() < 0.5
    this.log(`Moneda: ${cara ? 'cara' : 'cruz'}.`)
    return cara
  }
  log(texto) {
    // Con mesa, el registro es UNO para los dos: si no, «coges 2 premios»
    // y «tu activo cae» saldrían en dos listas sin orden entre sí.
    if (this.mesa) return this.mesa.log(this, texto)
    this.s.registro.push({ turno: this.s.turno, texto })
    if (this.s.registro.length > 400) this.s.registro.shift()
  }
  nombre(uid) {
    return nombreVisible(this.carta(uid))
  }

  // ── El rival ──
  //
  // Sin mesa es el maniquí, tal cual vive en el estado. Con mesa es el
  // OTRO jugador, visto con la misma forma que el maniquí ({activo, banca,
  // premios}) para que los efectos que ya miraban al maniquí —Boss, los
  // contadores de Dragapult, Pecharunt que cuenta premios…— valgan sin
  // reescribirlos. Los huecos son los de verdad (dañarlos daña al otro);
  // lo que el maniquí guarda y un Pokémon calcula (sus PS, si es ex, cuántos
  // premios da) se les apunta al pedir la vista, que es cuando hace falta.
  get rival() {
    const op = this.oponente
    if (!op) return this.s.rival
    const ver = (slot) => {
      if (!slot) return null
      const c = op.cartaDe(slot)
      slot.ps = op.psDe(slot)
      slot.ex = esEx(c)
      slot.nombre = nombreVisible(c)
      slot.premios = premiosQueDa(c)
      return slot
    }
    return { activo: ver(op.s.activo), banca: op.s.banca.map(ver), premios: op.s.premios.length, caidos: op.s.caidos || 0, real: true, partida: op }
  }

  // El turno «del rival» a efectos de cuándo se le quita una parálisis:
  // la cuenta es la SUYA, que no tiene por qué ir a la par con la tuya.
  get turnoDelRival() {
    return this.oponente ? this.oponente.s.turno : this.s.turno
  }

  // De quién es una carta: con mesa, un estadio o una herramienta pueden
  // ser del otro, y al descartarse van a SU descarte.
  duenoDe(uid) {
    return !this.oponente || this.uidsPropios.has(uid) ? this : this.oponente
  }
  alDescarteDeSuDueno(uids) {
    for (const u of uids) this.duenoDe(u).s.descarte.push(u)
  }

  // El estadio es de la mesa, no de un jugador: hay uno para los dos.
  ponerEstadio(uid) {
    const viejo = this.s.estadio
    if (viejo) {
      this.alDescarteDeSuDueno([viejo])
      this.log(`${this.nombre(viejo)} se va al descarte.`)
    }
    this.s.estadio = uid
    if (this.oponente) this.oponente.s.estadio = uid
  }
  quitarEstadio() {
    const viejo = this.s.estadio
    if (!viejo) return null
    this.alDescarteDeSuDueno([viejo])
    this.s.estadio = null
    if (this.oponente) this.oponente.s.estadio = null
    return viejo
  }

  // ── Deshacer ──
  //
  // Una foto del estado antes de cada acción. `structuredClone` copia
  // arrays y objetos planos, que es todo lo que hay en `s`.
  foto() {
    this.historia.push(structuredClone(this.s))
    if (this.historia.length > 80) this.historia.shift()
  }
  // Con mesa, deshacer es cosa de la mesa: una jugada toca a los DOS
  // (un Boss mueve el activo del otro), y volver atrás solo un lado
  // dejaría la partida en un sitio que no ha existido nunca.
  deshacer() {
    if (this.mesa) return this.mesa.deshacer()
    const antes = this.historia.pop()
    if (!antes) return false
    this.s = antes
    return true
  }
  get puedeDeshacer() {
    if (this.mesa) return this.mesa.puedeDeshacer
    return this.historia.length > 0
  }

  // Ejecuta una acción con su foto; si se cancela a mitad (el jugador
  // cierra la ventana de elegir) o no se puede, el estado vuelve a como
  // estaba. Así una carta que se juega a medias nunca deja la partida
  // en un sitio imposible.
  async accion(fn, ui = null) {
    if (this.mesa) return this.mesa.accion(fn, ui)
    this.foto()
    try {
      const r = await fn()
      this.comprobarFin()
      return r
    } catch (err) {
      this.s = this.historia.pop()
      throw err
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Las zonas
  // ════════════════════════════════════════════════════════════════

  // Todos los Pokémon en juego, el activo primero.
  get enJuego() {
    return [this.s.activo, ...this.s.banca].filter(Boolean)
  }
  slot(id) {
    return this.enJuego.find((p) => p.id === id) || null
  }
  cartaDe(slot) {
    return slot ? this.carta(slot.cartas[slot.cartas.length - 1]) : null
  }
  nuevoSlot(uid) {
    return { id: `${this.prefijo}p${++this.s.seq}`, cartas: [uid], energias: [], herramienta: null, danio: 0, estados: [], entroTurno: this.s.turno, evolucionoTurno: -1 }
  }
  get maxBanca() {
    // Zona Cero Profunda: con un Teracristal en juego, hasta 8.
    const est = this.s.estadio && claveDeEfecto(this.carta(this.s.estadio))
    if (est === 'area zero underdepths' && this.enJuego.some((p) => esTera(this.cartaDe(p)))) return 8
    return MAX_BANCA
  }
  get huecosBanca() {
    return this.maxBanca - this.s.banca.length
  }

  quitarDeMano(uid) {
    const i = this.s.mano.indexOf(uid)
    if (i < 0) throw new NoSePuede('Esa carta no está en tu mano.')
    this.s.mano.splice(i, 1)
  }

  // ── El mazo y lo que se sabe de él ──
  //
  // El conocimiento es lo que hace que la tabla sea la de TU partida y no
  // la de un mazo recién barajado:
  //   · `arriba`: las N primeras cartas del mazo, conocidas y en orden
  //     (lo que dejó Descifrador de Códigos, o lo que acabas de mirar).
  //   · `abajo`: las N últimas, conocidas (la que Drakloak manda abajo).
  //   · `confirmados`: cartas que SABES que están en el mazo pero no dónde
  //     (lo que viste al buscar y luego se barajó, tu mano tras Lillie).
  // Lo demás —el resto del mazo y los premios boca abajo— es lo que no
  // sabes, y se reparte al azar entre los dos sitios.
  get conocimiento() {
    return this.s.conocimiento
  }

  sacarDelMazo(uid) {
    const s = this.s
    const k = s.conocimiento
    const L = s.mazo.length
    const i = s.mazo.indexOf(uid)
    if (i < 0) return false
    s.mazo.splice(i, 1)
    if (i < k.arriba) k.arriba--
    else if (i >= L - k.abajo) k.abajo--
    delete k.confirmados[uid]
    return true
  }

  // Todo lo conocido pasa a «confirmado»: se sabe QUÉ hay, ya no DÓNDE.
  barajar() {
    const s = this.s
    const k = s.conocimiento
    const L = s.mazo.length
    for (let i = 0; i < L; i++) {
      if (i < k.arriba || i >= L - k.abajo) k.confirmados[s.mazo[i]] = true
    }
    k.arriba = 0
    k.abajo = 0
    for (let i = L - 1; i > 0; i--) {
      const j = Math.floor(this.azar() * (i + 1))
      ;[s.mazo[i], s.mazo[j]] = [s.mazo[j], s.mazo[i]]
    }
  }

  // Meter cartas en el mazo. Las que metes TÚ las conoces: al barajar
  // quedan confirmadas (tras Lillie sabes que tu mano vieja está dentro).
  alMazo(uids, donde = 'barajar') {
    const s = this.s
    const k = s.conocimiento
    if (!uids.length) return
    if (donde === 'arriba') {
      s.mazo.unshift(...uids)
      k.arriba += uids.length
    } else if (donde === 'abajo') {
      s.mazo.push(...uids)
      k.abajo += uids.length
    } else {
      s.mazo.push(...uids)
      for (const u of uids) k.confirmados[u] = true
      this.barajar()
    }
    this.normalizarConocimiento()
  }

  normalizarConocimiento() {
    const k = this.s.conocimiento
    const L = this.s.mazo.length
    k.arriba = Math.max(0, Math.min(k.arriba, L))
    k.abajo = Math.max(0, Math.min(k.abajo, L - k.arriba))
  }

  // Mirar el mazo entero (buscar): desde ese momento sabes qué hay en él
  // y, por eliminación, qué hay en los premios.
  verMazo() {
    const s = this.s
    const k = s.conocimiento
    const L = s.mazo.length
    for (let i = k.arriba; i < L - k.abajo; i++) k.confirmados[s.mazo[i]] = true
  }

  // Mirar las N de arriba: quedan conocidas y en su sitio.
  mirarArriba(n) {
    const vistas = this.s.mazo.slice(0, n)
    this.s.conocimiento.arriba = Math.max(this.s.conocimiento.arriba, vistas.length)
    this.normalizarConocimiento()
    return vistas
  }
  mirarAbajo(n) {
    const L = this.s.mazo.length
    const vistas = this.s.mazo.slice(Math.max(0, L - n))
    this.s.conocimiento.abajo = Math.max(this.s.conocimiento.abajo, vistas.length)
    this.normalizarConocimiento()
    return vistas
  }

  robar(n = 1, { motivo = '' } = {}) {
    const robadas = []
    for (let i = 0; i < n; i++) {
      if (!this.s.mazo.length) break
      const uid = this.s.mazo[0]
      this.sacarDelMazo(uid)
      this.s.mano.push(uid)
      robadas.push(uid)
    }
    if (robadas.length) this.log(`${motivo ? `${motivo}: ` : ''}robas ${robadas.length === 1 ? this.nombre(robadas[0]) : `${robadas.length} cartas`}.`)
    if (robadas.length < n) this.log('No quedan cartas en el mazo para robar más.')
    return robadas
  }

  robarHasta(n, opts) {
    const faltan = n - this.s.mano.length
    return faltan > 0 ? this.robar(faltan, opts) : []
  }

  descartar(uids) {
    for (const u of uids) {
      const i = this.s.mano.indexOf(u)
      if (i >= 0) this.s.mano.splice(i, 1)
      this.s.descarte.push(u)
    }
    if (uids.length) this.log(`Descartas ${uids.map((u) => this.nombre(u)).join(', ')}.`)
  }

  // De la mano al mazo, barajando (Lillie, Juez, Estampa Injusta…).
  manoAlMazo() {
    const mano = this.s.mano.splice(0)
    this.alMazo(mano, 'barajar')
    return mano.length
  }

  desdeDescarte(uids, destino = 'mano') {
    for (const u of uids) {
      const i = this.s.descarte.indexOf(u)
      if (i >= 0) this.s.descarte.splice(i, 1)
    }
    if (destino === 'mano') this.s.mano.push(...uids)
    else if (destino === 'mazo') this.alMazo(uids, 'barajar')
    if (uids.length) this.log(`${destino === 'mano' ? 'A la mano' : 'Al mazo'} desde el descarte: ${uids.map((u) => this.nombre(u)).join(', ')}.`)
  }

  // ════════════════════════════════════════════════════════════════
  // Empezar: mulligan y preparación
  // ════════════════════════════════════════════════════════════════

  // Baraja, roba 7 y repite mientras no haya un básico. Las manos sin
  // básico se guardan para enseñarlas: el jugador las VE (las enseña al
  // rival), y cuántas hubo es parte de lo que mide el laboratorio.
  repartir() {
    const s = this.s
    s.mulligans = 0
    s.manosMulligan = []
    s.conocimiento = { arriba: 0, abajo: 0, confirmados: {} }
    for (let intento = 0; intento < 60; intento++) {
      s.mazo.push(...s.mano.splice(0))
      this.barajar()
      s.conocimiento.confirmados = {}
      s.mano = s.mazo.splice(0, 7)
      if (s.mano.some((u) => esBasicoEnJuego(this.carta(u)))) break
      s.mulligans++
      s.manosMulligan.push([...s.mano])
    }
    if (!s.mano.some((u) => esBasicoEnJuego(this.carta(u)))) {
      s.fase = 'fin'
      s.resultado = { tipo: 'sin-basicos', texto: 'El mazo no tiene ningún Pokémon básico: no se puede empezar.' }
      return
    }
    s.fase = 'preparacion'
    this.log(s.mulligans ? `${s.mulligans} ${s.mulligans === 1 ? 'mulligan' : 'mulligans'}: tu rival robaría ${s.mulligans} ${s.mulligans === 1 ? 'carta' : 'cartas'} de más.` : 'Mano inicial con Pokémon básico.')
  }

  // En la preparación, los básicos se ponen boca abajo: activo y banca.
  colocar(uid, donde) {
    const s = this.s
    if (s.fase !== 'preparacion') throw new NoSePuede('Eso solo se hace al preparar la partida.')
    const c = this.carta(uid)
    if (!esBasicoEnJuego(c)) throw new NoSePuede('Solo puedes poner Pokémon básicos.')
    if (donde === 'activo') {
      this.quitarDeMano(uid)
      if (s.activo) s.mano.push(...s.activo.cartas)
      s.activo = this.nuevoSlot(uid)
    } else {
      if (s.banca.length >= MAX_BANCA) throw new NoSePuede('La banca ya está llena.')
      this.quitarDeMano(uid)
      s.banca.push(this.nuevoSlot(uid))
    }
  }

  // Devolver a la mano algo colocado en la preparación.
  descolocar(id) {
    const s = this.s
    if (s.fase !== 'preparacion') return
    if (s.activo?.id === id) {
      s.mano.push(...s.activo.cartas)
      s.activo = null
    } else {
      const i = s.banca.findIndex((p) => p.id === id)
      if (i >= 0) s.mano.push(...s.banca.splice(i, 1)[0].cartas)
    }
  }

  // Los premios salen de arriba del mazo, y empieza el turno 1. Con mesa
  // (`arrancar: false`) se ponen los premios y se espera: quien empieza lo
  // decide la mesa, cuando los dos están listos.
  empezar({ arrancar = true } = {}) {
    const s = this.s
    if (s.fase !== 'preparacion') return
    if (!s.activo) throw new NoSePuede('Elige primero tu Pokémon activo.')
    s.premios = s.mazo.splice(0, 6)
    s.premiosVistos = {}
    for (const p of this.enJuego) p.entroTurno = 0
    this.log(`${this.mesa ? 'Empieza' : 'Empiezas'} ${s.vaPrimero ? `PRIMERO: ${this.mesa ? 'su primer turno no puede' : 'este turno no puedes'} atacar ni jugar partidarios` : 'SEGUNDO'}. Seis premios boca abajo.`)
    if (!arrancar) {
      s.fase = 'espera'
      return
    }
    s.fase = 'turno'
    this.empezarTurno()
  }

  // Cambiar quién va primero mientras se prepara (tanda 456): el reparto
  // es el mismo, solo cambia el orden.
  ponerVaPrimero(primero) {
    if (this.s.fase !== 'preparacion' && this.s.fase !== 'mulligan') return
    this.s.vaPrimero = !!primero
  }

  // ════════════════════════════════════════════════════════════════
  // Los turnos
  // ════════════════════════════════════════════════════════════════

  // ¿Es el primer turno de la partida para el que va primero? Ese no
  // ataca ni juega partidarios. Nadie evoluciona en su primer turno.
  get primerTurnoDelPrimero() {
    return this.s.vaPrimero && this.s.turno === 1
  }
  get esMiPrimerTurno() {
    return this.s.turno === 1
  }

  empezarTurno() {
    const s = this.s
    s.turno++
    s.flags = this.flagsNuevas()
    if (this.mesa) this.mesa.nuevoTurno(this)
    this.log(this.mesa ? `── Turno ${this.mesa.m.turnoGlobal} · ${this.nombreJugador} (su turno ${s.turno}) ──` : `── Turno ${s.turno} ──`)
    if (!s.mazo.length) {
      this.terminar('derrota', this.mesa ? `${this.nombreJugador} no tiene cartas que robar al empezar su turno.` : 'No te quedan cartas que robar al empezar el turno.')
      return
    }
    this.robar(1, { motivo: 'Robo del turno' })
  }

  // Terminar el turno: lo que se va al final de TU turno, el Chequeo
  // Pokémon, el turno del maniquí (que no hace nada) y otro Chequeo.
  // El «KO en el último turno del rival» se borra aquí: ese dato vale
  // para el turno siguiente al del rival y nada más.
  terminarTurno() {
    const s = this.s
    if (s.fase !== 'turno') return
    this.finDeTurnoPropio()
    this.chequeo()
    if (s.fase === 'fin') return
    s.koUltimoTurnoRival = false
    this.log('Turno del rival: el maniquí no hace nada.')
    this.chequeo()
    if (s.fase === 'fin') return
    this.empezarTurno()
  }

  // Lo que se va al final de TU turno, antes del Chequeo.
  finDeTurnoPropio() {
    const s = this.s
    // La Energía Ignición se descarta al final de tu turno.
    for (const p of this.enJuego) {
      const fuera = p.energias.filter((u) => claveDeEfecto(this.carta(u)) === 'ignition energy')
      if (fuera.length) {
        p.energias = p.energias.filter((u) => !fuera.includes(u))
        s.descarte.push(...fuera)
        this.log(`La Energía Ignición de ${this.nombre(p.cartas.at(-1))} se descarta.`)
      }
    }
    // La parálisis se quita al final del turno siguiente del afectado.
    for (const p of this.enJuego) if (p.paralizadoEn != null && p.paralizadoEn < s.turno) quitarEstado(p, 'paralizado')
  }

  // El Chequeo Pokémon: veneno, quemadura, sueño y las habilidades que
  // actúan en él (Froslass).
  chequeo() {
    const s = this.s
    for (const p of this.enJuego) {
      if (p.estados.includes('envenenado')) this.ponerDanio(p, 10, { motivo: 'veneno' })
      if (p.estados.includes('quemado')) {
        this.ponerDanio(p, 20, { motivo: 'quemadura' })
        if (this.moneda()) quitarEstado(p, 'quemado')
      }
      if (p.estados.includes('dormido') && this.moneda()) quitarEstado(p, 'dormido')
    }
    // Froslass (Sudario Gélido): 1 contador a cada Pokémon con habilidad,
    // salvo a los Froslass. Solo si hay una Froslass tuya en juego.
    if (this.enJuego.some((p) => claveDeEfecto(this.cartaDe(p)) === 'froslass' && this.habilidadActiva(p))) {
      for (const p of this.enJuego) {
        const c = this.cartaDe(p)
        if (claveDeEfecto(c) !== 'froslass' && Array.isArray(c.abilities) && c.abilities.length) this.ponerDanio(p, 10, { motivo: 'Sudario Gélido' })
      }
    }
    this.retirarKOPropios()
    // El maniquí también sufre sus estados. (Con mesa no: el otro jugador
    // pasa su propio Chequeo, que es el de arriba.)
    if (this.oponente) return
    const r = s.rival.activo
    if (r?.estados?.includes('envenenado')) this.danioAlRival(r, 10, { motivo: 'veneno', contadores: true })
    if (r?.estados?.includes('quemado')) this.danioAlRival(r, 20, { motivo: 'quemadura', contadores: true })
  }

  terminar(tipo, texto) {
    this.s.fase = 'fin'
    this.s.resultado = { tipo, texto, turno: this.s.turno }
    this.log(texto)
  }

  comprobarFin() {
    const s = this.s
    if (s.fase === 'fin' || s.fase === 'mulligan' || s.fase === 'preparacion') return
    // Con mesa, «el rival ha cogido todos sus premios» solo vale cuando
    // el otro ya ha puesto los suyos: antes, cero premios es que no ha
    // empezado.
    const op = this.oponente
    const rivalJugando = !op || ['turno', 'espera', 'fin'].includes(op.s.fase)
    const quien = this.mesa ? this.nombreJugador : null
    if (!s.premios.length && s.resultado?.tipo !== 'victoria') this.terminar('victoria', quien ? `¡${quien} coge todos sus premios!` : `¡Has cogido todos tus premios en el turno ${s.turno}!`)
    else if (rivalJugando && this.rival.premios <= 0) this.terminar('derrota', quien ? `${op.nombreJugador} coge todos sus premios.` : 'El rival ha cogido todos sus premios.')
    else if (!s.activo && !s.banca.length) this.terminar('derrota', quien ? `${quien} se queda sin Pokémon en juego.` : 'Te has quedado sin Pokémon en juego.')
  }

  // ════════════════════════════════════════════════════════════════
  // Las reglas de lo que se puede jugar
  // ════════════════════════════════════════════════════════════════

  get enTurno() {
    return this.s.fase === 'turno'
  }

  // Con las reglas estrictas, un «no» se explica; en modo libre, pasa.
  regla(cumple, porque) {
    if (!cumple && this.s.estricta) throw new NoSePuede(porque)
  }

  // ¿Se puede evolucionar `slot` con la carta `uid` ahora mismo?
  motivoNoEvolucionar(uid, slot, { desdeMazo = false } = {}) {
    const evo = this.carta(uid)
    const base = this.cartaDe(slot)
    if (!evolucionaDe(evo, base)) return `${nombreVisible(evo)} no evoluciona de ${nombreVisible(base)}.`
    if (!this.s.estricta) return null
    if (this.esMiPrimerTurno && !desdeMazo) return 'Nadie puede evolucionar en su primer turno.'
    const bosque = this.s.estadio && claveDeEfecto(this.carta(this.s.estadio)) === 'forest of vitality' && esDeTipo(base, 'G') && esDeTipo(evo, 'G')
    if (slot.entroTurno === this.s.turno && !bosque) return 'Ese Pokémon ha entrado en juego este turno.'
    if (slot.evolucionoTurno === this.s.turno && !bosque) return 'Ese Pokémon ya ha evolucionado este turno.'
    return null
  }

  // La lista de lo que se puede hacer con una carta de la mano, con el
  // porqué de lo que no. Es lo que pinta el menú de la carta.
  opcionesDeMano(uid) {
    const s = this.s
    const c = this.carta(uid)
    const op = []
    if (s.fase === 'preparacion') {
      if (esBasicoEnJuego(c)) {
        op.push({ id: 'activo', texto: s.activo ? 'Cambiar por el activo' : 'Poner de activo' })
        op.push({ id: 'banca', texto: 'Poner en la banca', no: s.banca.length >= MAX_BANCA ? 'La banca está llena.' : null })
      }
      return op
    }
    if (!this.enTurno) return op
    if (esPokemon(c)) {
      if (esBasicoEnJuego(c)) {
        op.push({ id: 'banca', texto: 'Bajar a la banca', no: this.huecosBanca <= 0 ? 'La banca está llena.' : null })
      } else {
        const destinos = this.enJuego.filter((p) => evolucionaDe(c, this.cartaDe(p)))
        if (!destinos.length) op.push({ id: 'evolucionar', texto: 'Evolucionar', no: `No tienes en juego nada de lo que evolucione ${nombreVisible(c)}.` })
        for (const p of destinos) {
          const no = this.motivoNoEvolucionar(uid, p)
          op.push({ id: 'evolucionar', slot: p.id, texto: `Evolucionar ${nombreVisible(this.cartaDe(p))}${p === s.activo ? ' (activo)' : ''}`, no })
        }
      }
    } else if (esEnergia(c)) {
      for (const p of this.enJuego) {
        const no = s.estricta && s.flags.energia ? 'Ya has unido una energía de la mano este turno.' : this.motivoNoUnirEnergia(uid, p)
        op.push({ id: 'energia', slot: p.id, texto: `Unir a ${nombreVisible(this.cartaDe(p))}${p === s.activo ? ' (activo)' : ''}`, no })
      }
    } else if (esHerramienta(c)) {
      for (const p of this.enJuego) {
        op.push({ id: 'herramienta', slot: p.id, texto: `Unir a ${nombreVisible(this.cartaDe(p))}${p === s.activo ? ' (activo)' : ''}`, no: p.herramienta ? 'Ya lleva una herramienta.' : null })
      }
    } else if (esEntrenador(c)) {
      op.push({ id: 'jugar', texto: esEstadio(c) ? 'Poner en juego' : 'Jugar', no: this.motivoNoJugar(uid) })
    }
    return op
  }

  motivoNoUnirEnergia(uid, slot) {
    const c = this.carta(uid)
    if (claveDeEfecto(c) === "team rocket's energy" && !esDe(this.cartaDe(slot), 'team rocket')) return 'Solo se puede unir a un Pokémon del Team Rocket.'
    return null
  }

  motivoNoJugar(uid) {
    const s = this.s
    const c = this.carta(uid)
    const ef = this.efectoDe(c)
    if (s.estricta) {
      if (esPartidario(c)) {
        if (s.flags.partidario) return 'Ya has jugado un partidario este turno.'
        // Protón del Team Rocket y Carmín lo dicen en la carta: sí se
        // juegan en el primer turno del que va primero.
        if (this.primerTurnoDelPrimero && !ef?.primerTurno) return 'Quien va primero no juega partidarios en su primer turno.'
      }
      if (esEstadio(c)) {
        if (s.flags.estadio) return 'Ya has jugado un estadio este turno.'
        if (s.estadio && claveDeNombre(this.carta(s.estadio)) === claveDeNombre(c)) return 'Ese estadio ya está en juego.'
      }
      if (esObjeto(c) && s.flags.sinObjetos) return 'Este turno no puedes jugar objetos.'
    }
    if (ef?.puede) {
      const r = ef.puede(this, { uid, carta: c })
      if (r !== true && r) return r
    }
    return null
  }

  efectoDe(c) {
    return this.efectos?.entrenadores?.[claveDeEfecto(c)] || null
  }

  // ════════════════════════════════════════════════════════════════
  // Jugar cartas de la mano
  // ════════════════════════════════════════════════════════════════

  async jugarDeMano(uid, opcion, ui) {
    const s = this.s
    if (s.fase === 'preparacion') {
      this.colocar(uid, opcion.id === 'activo' ? 'activo' : 'banca')
      return
    }
    if (!this.enTurno) throw new NoSePuede('Ahora no es tu turno.')
    const c = this.carta(uid)
    if (opcion.id === 'banca') return this.bajarABanca(uid, ui)
    if (opcion.id === 'evolucionar') return this.evolucionar(uid, this.slot(opcion.slot), ui)
    if (opcion.id === 'energia') return this.unirEnergiaDeMano(uid, this.slot(opcion.slot), ui)
    if (opcion.id === 'herramienta') return this.unirHerramienta(uid, this.slot(opcion.slot))
    if (opcion.id === 'jugar') return this.jugarEntrenador(uid, ui)
    throw new NoSePuede(`No sé jugar ${nombreVisible(c)} así.`)
  }

  async bajarABanca(uid, ui, { desdeMano = true } = {}) {
    const c = this.carta(uid)
    this.regla(this.huecosBanca > 0, 'La banca está llena.')
    if (desdeMano) this.quitarDeMano(uid)
    else this.sacarDelMazo(uid)
    const p = this.nuevoSlot(uid)
    // Sin activo (se quedó fuera de combate y no quedaba banca), el
    // básico va directo al puesto activo.
    if (!this.s.activo) this.s.activo = p
    else this.s.banca.push(p)
    this.log(`${nombreVisible(c)} a la banca.`)
    this.alEntrarEnBanca(p)
    // Las habilidades de «cuando lo bajas de la mano a la banca».
    if (desdeMano) await this.habilidadAlBajar(p, ui)
    return p
  }

  // Ruinas Arriesgadas: 2 contadores al básico no-Oscuro que entra en la
  // banca durante tu turno (también por Poffin o Nido: «pone en la banca»).
  alEntrarEnBanca(p) {
    const est = this.s.estadio && claveDeEfecto(this.carta(this.s.estadio))
    const c = this.cartaDe(p)
    if (est === 'risky ruins' && this.enTurno && esBasicoEnJuego(c) && !esDeTipo(c, 'D') && p !== this.s.activo) {
      this.ponerDanio(p, 20, { motivo: 'Ruinas Arriesgadas' })
      this.retirarKOPropios()
    }
  }

  async habilidadAlBajar(p, ui) {
    const def = this.habilidadDe(p)
    if (!def || def.cuando !== 'bajar' || !this.habilidadActiva(p)) return
    const no = def.puede?.(this, p)
    if (no && no !== true) return
    if (await ui.confirmar({ titulo: def.nombre, texto: `¿Usar ${def.nombre}? ${def.texto}` })) {
      this.contarUso(def, p)
      await def.usar(this, ui, p)
    }
  }

  async evolucionar(uid, slot, ui, { desdeMazo = false, sinHabilidad = false } = {}) {
    if (!slot) throw new NoSePuede('Ese Pokémon ya no está en juego.')
    const no = this.motivoNoEvolucionar(uid, slot, { desdeMazo })
    if (no && (this.s.estricta || /no evoluciona/.test(no))) throw new NoSePuede(no)
    if (desdeMazo) this.sacarDelMazo(uid)
    else this.quitarDeMano(uid)
    const antes = this.cartaDe(slot)
    slot.cartas.push(uid)
    slot.evolucionoTurno = this.s.turno
    // Evolucionar cura los estados especiales.
    slot.estados = []
    this.log(`${nombreVisible(antes)} evoluciona a ${this.nombre(uid)}.`)
    if (!desdeMazo && !sinHabilidad) await this.habilidadAlEvolucionar(slot, ui)
  }

  async habilidadAlEvolucionar(p, ui) {
    const def = this.habilidadDe(p)
    if (!def || def.cuando !== 'evolucionar' || !this.habilidadActiva(p)) return
    const no = def.puede?.(this, p)
    if (no && no !== true) return
    if (await ui.confirmar({ titulo: def.nombre, texto: `¿Usar ${def.nombre}? ${def.texto}` })) {
      this.contarUso(def, p)
      await def.usar(this, ui, p)
    }
  }

  async unirEnergiaDeMano(uid, slot, ui) {
    const s = this.s
    this.regla(!s.flags.energia, 'Ya has unido una energía de la mano este turno.')
    const no = this.motivoNoUnirEnergia(uid, slot)
    if (no) throw new NoSePuede(no)
    this.quitarDeMano(uid)
    slot.energias.push(uid)
    s.flags.energia = true
    this.log(`Unes ${this.nombre(uid)} a ${nombreVisible(this.cartaDe(slot))}.`)
    // Las especiales que hacen algo al unirse DESDE LA MANO.
    const ef = this.efectos?.energias?.[claveDeEfecto(this.carta(uid))]
    if (ef?.alUnir) await ef.alUnir(this, ui, slot, uid)
  }

  // Unir una energía por un efecto (no cuenta como la del turno).
  unirEnergia(uid, slot, { desde = 'mazo' } = {}) {
    if (desde === 'mazo') this.sacarDelMazo(uid)
    else if (desde === 'descarte') this.s.descarte.splice(this.s.descarte.indexOf(uid), 1)
    else if (desde === 'mano') this.quitarDeMano(uid)
    slot.energias.push(uid)
    this.log(`${this.nombre(uid)} se une a ${nombreVisible(this.cartaDe(slot))}.`)
  }

  unirHerramienta(uid, slot) {
    if (!slot) throw new NoSePuede('Ese Pokémon ya no está en juego.')
    if (slot.herramienta) throw new NoSePuede('Ese Pokémon ya lleva una herramienta.')
    if (this.s.estricta && this.s.flags.sinObjetos) throw new NoSePuede('Este turno no puedes jugar objetos.')
    this.quitarDeMano(uid)
    slot.herramienta = uid
    this.log(`Unes ${this.nombre(uid)} a ${nombreVisible(this.cartaDe(slot))}.`)
  }

  async jugarEntrenador(uid, ui) {
    const s = this.s
    const c = this.carta(uid)
    const no = this.motivoNoJugar(uid)
    if (no) {
      // Lo que exige la propia carta («descarta 2») se respeta siempre;
      // lo de las reglas del turno, solo en modo estricto (motivoNoJugar
      // ya lo mira).
      throw new NoSePuede(no)
    }
    this.quitarDeMano(uid)
    const ef = this.efectoDe(c)
    const ctx = { uid, carta: c }
    this.log(`Juegas ${nombreVisible(c)}.`)
    if (esEstadio(c)) {
      // El que había se va al descarte de quien lo puso, que puede ser el
      // otro jugador.
      this.ponerEstadio(uid)
      s.flags.estadio = true
      if (ef?.alPoner) await ef.alPoner(this, ui, ctx)
      return
    }
    if (esPartidario(c)) {
      s.flags.partidario = true
      if (esDe(c, 'team rocket')) s.flags.partidarioTR = true
    }
    // Mientras dura el efecto la carta no está ni en la mano ni en el
    // descarte: Lillie baraja tu mano SIN ella, y Ultra Ball no puede
    // descartarse a sí misma.
    s.jugando.push(uid)
    if (ef?.usar) await ef.usar(this, ui, ctx)
    else this.log(`(El efecto de ${nombreVisible(c)} no está automatizado: hazlo a mano con las herramientas.)`)
    s.jugando = s.jugando.filter((u) => u !== uid)
    if (!ef?.seQueda) s.descarte.push(uid)
  }

  // ════════════════════════════════════════════════════════════════
  // Habilidades
  // ════════════════════════════════════════════════════════════════

  habilidadDe(slot) {
    const c = this.cartaDe(slot)
    const def = this.efectos?.habilidades?.[claveDeEfecto(c)]
    if (!def) return null
    // Solo en cartas de la era actual (o sin marca) y que TENGAN una
    // habilidad en el catálogo: un Pokémon viejo con el mismo nombre
    // puede tener otra, o ninguna.
    if (!modernaOSinMarca(c)) return null
    if (Array.isArray(c.abilities) && !c.abilities.length) return null
    return def
  }

  // La definición de un ataque automatizado, si la carta casa con la
  // firma (el daño impreso de cada ataque, ver `firmas` en efectos.js).
  defDeAtaque(c, ataque) {
    const nombre = claveDeEfecto(c)
    const defs = this.efectos?.ataques?.[nombre]
    if (!defs || !modernaOSinMarca(c)) return null
    const i = Array.isArray(c?.attacks) ? c.attacks.indexOf(ataque) : -1
    if (i < 0) return null
    const firma = this.efectos?.firmas?.[nombre]
    if (firma) {
      if (firma.length !== c.attacks.length) return null
      const impreso = (d) => String(d ?? '').replace(/[^0-9]/g, '')
      if (c.attacks.some((a, j) => impreso(a?.damage) !== firma[j])) return null
    }
    return defs[`#${i}`] || null
  }

  // ¿Funciona la habilidad de este Pokémon? La Atalaya del Team Rocket
  // apaga las de los Pokémon incoloros, y Psyduck las que se dejan KO a
  // sí mismos.
  habilidadActiva(slot) {
    const c = this.cartaDe(slot)
    const est = this.s.estadio && claveDeEfecto(this.carta(this.s.estadio))
    if (est === "team rocket's watchtower" && esDeTipo(c, 'C')) return false
    return true
  }

  hayHabilidadActiva(nombre) {
    return this.enJuego.some((p) => claveDeEfecto(this.cartaDe(p)) === nombre && this.habilidadActiva(p))
  }

  claveDeUso(def, slot) {
    // «Una vez durante tu turno» es por Pokémon; «no más de una X por
    // turno» es por nombre de habilidad, entre todos.
    return def.unaPorTurno ? `hab:${def.nombre}` : `hab:${slot.id}:${def.nombre}`
  }
  contarUso(def, slot) {
    const k = this.claveDeUso(def, slot)
    this.s.flags.usos[k] = (this.s.flags.usos[k] || 0) + 1
  }

  motivoNoHabilidad(slot) {
    const def = this.habilidadDe(slot)
    if (!def) return 'Esta habilidad no está automatizada.'
    if (!this.habilidadActiva(slot)) return 'Ahora mismo este Pokémon no tiene habilidades.'
    if (def.cuando === 'bajar' || def.cuando === 'evolucionar' || def.pasiva) return 'Se activa sola cuando toca.'
    if (!def.variasVeces && this.s.flags.usos[this.claveDeUso(def, slot)]) return 'Ya la has usado este turno.'
    if (def.soloActivo && slot !== this.s.activo) return 'Solo funciona en el puesto activo.'
    const r = def.puede?.(this, slot)
    if (r && r !== true) return r
    return null
  }

  async usarHabilidad(slot, ui) {
    const def = this.habilidadDe(slot)
    const no = this.motivoNoHabilidad(slot)
    if (no) throw new NoSePuede(no)
    this.log(`${nombreVisible(this.cartaDe(slot))} usa ${def.nombre}.`)
    this.contarUso(def, slot)
    await def.usar(this, ui, slot)
    this.retirarKOPropios()
  }

  // ════════════════════════════════════════════════════════════════
  // Retirada y cambios
  // ════════════════════════════════════════════════════════════════

  herramientaActiva(slot, nombre) {
    if (!slot?.herramienta) return false
    const est = this.s.estadio && claveDeEfecto(this.carta(this.s.estadio))
    if (est === 'jamming tower') return false
    return claveDeEfecto(this.carta(slot.herramienta)) === nombre
  }

  costeDeRetirada(slot) {
    const c = this.cartaDe(slot)
    let coste = Number.isFinite(c?.retreat) ? c.retreat : 1
    if (this.herramientaActiva(slot, 'air balloon')) coste -= 2
    if (esBasicoEnJuego(c) && this.hayHabilidadActiva('latias ex')) coste = 0
    const est = this.s.estadio && claveDeEfecto(this.carta(this.s.estadio))
    if (est === "n's castle" && esDe(c, 'n')) coste = 0
    return Math.max(0, coste)
  }

  unidadesDe(slot) {
    const portador = this.cartaDe(slot)
    return slot.energias.flatMap((u) => unidadesDeEnergia(this.carta(u), portador, this))
  }

  motivoNoRetirar() {
    const s = this.s
    if (!s.activo) return 'No tienes Pokémon activo.'
    if (!s.banca.length) return 'No tienes Pokémon en la banca.'
    if (!s.estricta) return null
    if (s.flags.retirada) return 'Ya te has retirado este turno.'
    if (s.activo.estados.some((e) => e === 'dormido' || e === 'paralizado')) return 'Un Pokémon dormido o paralizado no puede retirarse.'
    if (s.activo.noRetirarHasta >= s.turno) return 'Un efecto le impide retirarse este turno.'
    const coste = this.costeDeRetirada(s.activo)
    if (this.unidadesDe(s.activo).length < coste) return `Retirarse cuesta ${coste} ${coste === 1 ? 'energía' : 'energías'} y no las tiene.`
    return null
  }

  async retirar(ui) {
    const s = this.s
    const no = this.motivoNoRetirar()
    if (no) throw new NoSePuede(no)
    const coste = this.costeDeRetirada(s.activo)
    if (coste > 0 && s.activo.energias.length) {
      // Se elige qué energías pagan. Una que da dos cuenta por dos.
      const portador = this.cartaDe(s.activo)
      const vale = (u) => unidadesDeEnergia(this.carta(u), portador, this).length
      const suma = s.activo.energias.reduce((t, u) => t + vale(u), 0)
      let pagan = s.activo.energias
      if (suma > coste) {
        pagan = await ui.cartas({
          titulo: `Retirarse: descarta ${coste} ${coste === 1 ? 'energía' : 'energías'}`,
          opciones: s.activo.energias,
          min: 1,
          max: s.activo.energias.length,
          validar: (sel) => (sel.reduce((t, u) => t + vale(u), 0) >= coste ? null : `Faltan energías: el coste es ${coste}.`),
        })
      }
      s.activo.energias = s.activo.energias.filter((u) => !pagan.includes(u))
      s.descarte.push(...pagan)
    }
    const [nuevo] = await ui.pokemon({ titulo: '¿Quién pasa al puesto activo?', opciones: s.banca.map((p) => p.id), min: 1, max: 1 })
    this.cambiarActivo(this.slot(nuevo))
    s.flags.retirada = true
  }

  // Cambiar el activo por uno de la banca (retirada, Cambio, Kieran…).
  // Los estados especiales se van al pasar a la banca.
  cambiarActivo(slot) {
    const s = this.s
    if (!slot || slot === s.activo) return
    const i = s.banca.indexOf(slot)
    if (i < 0) return
    const viejo = s.activo
    s.banca.splice(i, 1)
    if (viejo) {
      viejo.estados = []
      s.banca.push(viejo)
    }
    s.activo = slot
    slot.subioTurno = s.turno
    this.log(`${nombreVisible(this.cartaDe(slot))} pasa al puesto activo.`)
  }

  async elegirYCambiar(ui, titulo = 'Elige el Pokémon de tu banca que pasa a activo') {
    if (!this.s.banca.length) return false
    const [id] = await ui.pokemon({ titulo, opciones: this.s.banca.map((p) => p.id), min: 1, max: 1 })
    this.cambiarActivo(this.slot(id))
    return true
  }

  // ════════════════════════════════════════════════════════════════
  // Daño y KO de TUS Pokémon
  // ════════════════════════════════════════════════════════════════

  psDe(slot) {
    const c = this.cartaDe(slot)
    let ps = Number(c?.hp) || 0
    if (this.herramientaActiva(slot, "hero's cape")) ps += 100
    if (this.herramientaActiva(slot, "cynthia's power weight") && esDe(c, 'cynthia')) ps += 70
    if (esDeTipo(c, 'G') && slot.energias.some((u) => claveDeEfecto(this.carta(u)) === 'growing grass energy')) ps += 20
    const est = this.s.estadio && claveDeEfecto(this.carta(this.s.estadio))
    if (est === 'lively stadium' && esBasicoEnJuego(c)) ps += 30
    if (est === 'gravity mountain' && faseDe(c) === 2) ps -= 30
    return ps
  }

  ponerDanio(slot, cantidad, { motivo = '' } = {}) {
    if (!slot || cantidad <= 0) return
    slot.danio += cantidad
    this.log(`${nombreVisible(this.cartaDe(slot))} recibe ${cantidad} de daño${motivo ? ` (${motivo})` : ''}.`)
  }

  curar(slot, cantidad) {
    if (!slot) return 0
    const antes = slot.danio
    slot.danio = Math.max(0, slot.danio - cantidad)
    if (antes !== slot.danio) this.log(`${nombreVisible(this.cartaDe(slot))} se cura ${antes - slot.danio}.`)
    return antes - slot.danio
  }

  // Todo lo que tiene un Pokémon (él, lo de debajo, energías, herramienta).
  cartasDelSlot(slot) {
    return [...slot.cartas, ...slot.energias, ...(slot.herramienta ? [slot.herramienta] : [])]
  }

  quitarDelJuego(slot) {
    const s = this.s
    if (s.activo === slot) s.activo = null
    else s.banca = s.banca.filter((p) => p !== slot)
  }

  // Un Pokémon tuyo queda fuera de combate: al descarte con todo, y el
  // rival coge premios. `delRival`: lo hizo el rival en su turno (lo que
  // miran Estampa Injusta, Fezandipiti y compañía).
  koPropio(slot, { delRival = false, texto = '' } = {}) {
    const s = this.s
    const c = this.cartaDe(slot)
    const premios = premiosQueDa(c)
    this.alDescarteDeSuDueno(this.cartasDelSlot(slot))
    this.quitarDelJuego(slot)
    s.caidos = (s.caidos || 0) + 1
    const op = this.oponente
    if (op) {
      // Con mesa, el otro coge premios DE VERDAD (cartas a su mano). Se
      // apuntan y los coge la mesa en cuanto puede preguntarle cuáles: esto
      // pasa en sitios que no esperan (el veneno del Chequeo, un
      // contador de Ruinas Arriesgadas).
      if (delRival || op.enTurno) s.koUltimoTurnoRival = true
      const n = Math.min(premios, op.s.premios.length)
      this.mesa?.premiosPendientes(op, n)
      this.log(`${nombreVisible(c)} de ${this.nombreJugador} queda fuera de combate${texto ? ` (${texto})` : ''}: ${op.nombreJugador} coge ${n} ${n === 1 ? 'premio' : 'premios'}.`)
      return
    }
    s.rival.premios = Math.max(0, s.rival.premios - premios)
    if (delRival) s.koUltimoTurnoRival = true
    this.log(`${nombreVisible(c)} queda fuera de combate${texto ? ` (${texto})` : ''}: el rival coge ${premios} ${premios === 1 ? 'premio' : 'premios'} (le quedan ${s.rival.premios}).`)
  }

  retirarKOPropios() {
    for (const p of this.enJuego) {
      if (p.danio >= this.psDe(p) && this.psDe(p) > 0) this.koPropio(p, { texto: 'daño' })
    }
    this.comprobarFin()
  }

  // Si el activo se ha ido, hay que subir uno de la banca.
  async reponerActivo(ui) {
    const s = this.s
    if (s.activo || !s.banca.length || s.fase === 'fin') return
    const titulo = this.mesa ? `${this.nombreJugador}: tu activo ha caído, elige quién sube` : 'Tu activo ha caído: elige quién sube'
    const [id] = await ui.pokemon({ titulo, opciones: s.banca.map((p) => p.id), min: 1, max: 1, sinCancelar: true, partida: this })
    const p = this.slot(id)
    s.banca = s.banca.filter((x) => x !== p)
    s.activo = p
    p.subioTurno = s.turno
    this.log(`${nombreVisible(this.cartaDe(p))} pasa al puesto activo.`)
  }

  // ════════════════════════════════════════════════════════════════
  // El maniquí rival
  // ════════════════════════════════════════════════════════════════

  danioAlRival(objetivo, cantidad, { motivo = '', contadores = false } = {}) {
    if (!objetivo || cantidad <= 0) return
    objetivo.danio += cantidad
    const r = this.rival
    const donde = this.oponente
      ? `${objetivo === r.activo ? 'activo' : 'Pokémon de la banca'} de ${this.oponente.nombreJugador} (${nombreVisible(this.oponente.cartaDe(objetivo))})`
      : objetivo === r.activo ? 'activo rival' : 'Pokémon de la banca rival'
    this.log(`${contadores ? `${cantidad / 10} ${cantidad === 10 ? 'contador' : 'contadores'} al` : `${cantidad} de daño al`} ${donde}${motivo ? ` (${motivo})` : ''}.`)
  }

  // Los KO del maniquí: se cogen premios (los elige el jugador, boca
  // abajo) y sube otro. El maniquí no se acaba nunca: si no le queda
  // banca, sale uno nuevo igual al primero.
  async resolverKORival(ui) {
    if (this.oponente) return this.resolverKOOponente(ui)
    const s = this.s
    const r = s.rival
    const caidos = [r.activo, ...r.banca].filter((d) => d && d.danio >= d.ps)
    for (const d of caidos) {
      // Un premio de más: Brezo (si ataca un Teracristal) o un ataque que
      // lo diga (Unown). Solo por el activo y solo en ese ataque.
      let extra = 0
      if (d === r.activo && s.flags.enAtaque) {
        const atacante = this.cartaDe(this.slot(s.flags.atacante))
        if (s.flags.briar && esTera(atacante)) extra++
        extra += s.flags.premioExtra || 0
      }
      const n = Math.min(d.premios + extra, s.premios.length)
      this.log(`El ${d === r.activo ? 'activo' : 'Pokémon de banca'} rival queda fuera de combate: coges ${n} ${n === 1 ? 'premio' : 'premios'}.`)
      if (d === r.activo) r.activo = null
      else r.banca = r.banca.filter((x) => x !== d)
      r.caidos = (r.caidos || 0) + 1
      await this.cogerPremios(n, ui)
    }
    if (!r.activo) {
      r.activo = r.banca.length ? r.banca.shift() : nuevoManiqui(r.plantilla, ++r.seq)
      r.activo.estados = []
    }
    this.comprobarFin()
  }

  // Con mesa: los Pokémon del otro que han caído. Se cogen los premios
  // (los elige quien ataca, boca abajo) y el otro sube un nuevo activo —en
  // ese orden, que es el del reglamento—.
  async resolverKOOponente(ui) {
    const s = this.s
    const op = this.oponente
    const caidos = op.enJuego.filter((d) => op.psDe(d) > 0 && d.danio >= op.psDe(d))
    for (const d of caidos) {
      let extra = 0
      if (d === op.s.activo && s.flags.enAtaque) {
        const atacante = this.cartaDe(this.slot(s.flags.atacante))
        if (s.flags.briar && esTera(atacante)) extra++
        extra += s.flags.premioExtra || 0
      }
      const c = op.cartaDe(d)
      const n = Math.min(premiosQueDa(c) + extra, s.premios.length)
      op.alDescarteDeSuDueno(op.cartasDelSlot(d))
      op.quitarDelJuego(d)
      op.s.caidos = (op.s.caidos || 0) + 1
      // Lo ha dejado KO quien juega ahora: para el otro, eso pasa «en el
      // último turno de su rival» (Estampa Injusta, Fezandipiti…).
      if (this.enTurno) op.s.koUltimoTurnoRival = true
      this.log(`${nombreVisible(c)} de ${op.nombreJugador} queda fuera de combate: ${this.nombreJugador} coge ${n} ${n === 1 ? 'premio' : 'premios'}.`)
      await this.cogerPremios(n, ui)
    }
    this.comprobarFin()
    op.comprobarFin()
    if (this.mesa) this.mesa.comprobarFin()
    if (!this.mesa?.terminada) await op.reponerActivo(ui)
  }

  async cogerPremios(n, ui) {
    const s = this.s
    if (n <= 0 || !s.premios.length) return
    let elegidos
    if (n >= s.premios.length) elegidos = [...s.premios]
    else elegidos = await ui.premios({ titulo: `${this.mesa ? `${this.nombreJugador}: c` : 'C'}oge ${n} ${n === 1 ? 'premio' : 'premios'}`, n, sinCancelar: true, partida: this })
    for (const u of elegidos) {
      s.premios = s.premios.filter((x) => x !== u)
      delete s.premiosVistos[u]
      s.mano.push(u)
    }
    this.log(`Premio: ${elegidos.map((u) => this.nombre(u)).join(', ')}.`)
  }

  // Boss / Captura: el rival sube un Pokémon de su banca.
  cambiarActivoRival(indiceBanca) {
    const op = this.oponente
    if (op) {
      const d = op.s.banca[indiceBanca]
      if (!d) return false
      op.cambiarActivo(d)
      return true
    }
    const r = this.s.rival
    const d = r.banca[indiceBanca]
    if (!d) return false
    r.banca.splice(indiceBanca, 1)
    if (r.activo) {
      r.activo.estados = []
      r.banca.push(r.activo)
    }
    r.activo = d
    this.log('El rival cambia de activo.')
    return true
  }

  // ════════════════════════════════════════════════════════════════
  // Atacar
  // ════════════════════════════════════════════════════════════════

  ataquesDe(slot) {
    const c = this.cartaDe(slot)
    const propios = (Array.isArray(c?.attacks) ? c.attacks : []).map((a, i) => ({ ataque: a, i, de: slot }))
    // Mew ex (Hélice de Memoria): usa los ataques de tu banca.
    if (slot === this.s.activo && claveDeEfecto(c) === 'mew ex' && this.habilidadActiva(slot)) {
      for (const b of this.s.banca) {
        const cb = this.cartaDe(b)
        ;(Array.isArray(cb?.attacks) ? cb.attacks : []).forEach((a, i) => propios.push({ ataque: a, i, de: b, prestado: true }))
      }
    }
    return propios
  }

  costeDeAtaque(slot, ataque, prestadoDe = null) {
    let coste = costeEnLetras(ataque)
    const c = this.cartaDe(prestadoDe || slot)
    const def = this.defDeAtaque(c, ataque)
    let menos = def?.rebaja ? def.rebaja(this, slot) : 0
    if (this.herramientaActiva(slot, "hop's choice band") && esDe(this.cartaDe(slot), 'hop')) menos += 1
    // Se quitan incoloros primero, que es lo que dicen todas estas cartas.
    for (let i = 0; i < menos; i++) {
      const j = coste.lastIndexOf('C')
      if (j >= 0) coste.splice(j, 1)
    }
    const est = this.s.estadio && claveDeEfecto(this.carta(this.s.estadio))
    if (est === 'nighttime mine' && esTera(this.cartaDe(slot))) coste = [...coste, 'C']
    return coste
  }

  motivoNoAtacar(slot, ataque, prestadoDe = null) {
    const s = this.s
    if (!this.enTurno) return 'Ahora no es tu turno.'
    if (slot !== s.activo) return 'Solo ataca el Pokémon activo.'
    if (!s.estricta) return null
    if (this.primerTurnoDelPrimero) return 'Quien va primero no puede atacar en su primer turno.'
    if (s.activo.estados.some((e) => e === 'dormido' || e === 'paralizado')) return 'Dormido o paralizado: no puede atacar.'
    const c = this.cartaDe(prestadoDe || slot)
    const b = slot.bloqueo
    if (b && b.turno === s.turno && !prestadoDe) {
      if (b.indice == null) return 'Este Pokémon no puede atacar este turno (lo dice su último ataque).'
      if (c.attacks?.indexOf(ataque) === b.indice) return 'No puede repetir este ataque este turno.'
    }
    const def = this.defDeAtaque(c, ataque)
    if (def?.puede) {
      const r = def.puede(this, slot)
      if (r && r !== true) return r
    }
    const coste = this.costeDeAtaque(slot, ataque, prestadoDe)
    if (!pagaCoste(coste, this.unidadesDe(slot))) return 'No tiene la energía que pide el ataque.'
    return null
  }

  // El daño contra el activo rival con todo lo que lo sube. El maniquí
  // no tiene debilidad ni resistencia: el laboratorio mide TU daño.
  bonosDeDanio(slot) {
    const s = this.s
    const c = this.cartaDe(slot)
    const rivalEx = this.rival.activo?.ex
    let extra = 0
    const razones = []
    const suma = (n, porque) => {
      extra += n
      razones.push(`+${n} ${porque}`)
    }
    if (this.herramientaActiva(slot, 'brave bangle') && !tieneRegla(c) && rivalEx) suma(30, 'Brazalete Valiente')
    if (this.herramientaActiva(slot, 'maximum belt') && rivalEx) suma(50, 'Cinturón Máximo')
    if (this.herramientaActiva(slot, "hop's choice band") && esDe(c, 'hop')) suma(30, 'Cinta Elegida de Paul')
    // Los bonos de turno (Cinturón Negro, Kieran…) se guardan por NOMBRE
    // y no como función: el estado se clona para deshacer, y
    // `structuredClone` no copia funciones.
    for (const b of s.flags.bonos) if (BONOS_DE_TURNO[b.clave]?.(this, slot)) suma(b.n, b.porque)
    const est = s.estadio && claveDeEfecto(this.carta(s.estadio))
    if (est === 'postwick' && esDe(c, 'hop')) suma(30, 'Pueblo Postwick')
    if (esDe(c, 'hop') && this.hayHabilidadActiva("hop's snorlax")) suma(30, 'Snorlax de Paul')
    if (esDe(c, 'cynthia') && this.hayHabilidadActiva("cynthia's roserade")) suma(30, 'Roserade de Cintia')
    if (esEvolucion(c) && esDeTipo(c, 'R') && this.hayHabilidadActiva('victini')) suma(10, 'Victini')
    if (esDeTipo(c, 'L') && slot.energias.some((u) => claveDeEfecto(this.carta(u)) === 'voltaic lightning energy')) suma(20, 'Energía Rayo Voltaica')
    return { extra, razones }
  }

  // La debilidad (×2, o «+N» en cartas viejas) y la resistencia (−30) del
  // activo del otro jugador frente a los tipos de quien ataca. Se aplican
  // después de los bonos, que es lo que dicen todas esas cartas («antes de
  // aplicar Debilidad y Resistencia»).
  debilidadYResistencia(atacante, objetivo, danio) {
    const op = this.oponente
    const def = op.cartaDe(objetivo)
    const tipos = tiposDe(this.cartaDe(atacante))
    const numero = (v, porDefecto) => {
      const n = Number(String(v ?? '').replace(/[^0-9]/g, ''))
      return Number.isFinite(n) && n > 0 ? n : porDefecto
    }
    let total = danio
    const razones = []
    for (const w of Array.isArray(def?.weaknesses) ? def.weaknesses : []) {
      if (!tipos.includes(letraDeTipo(w?.type))) continue
      if (/\+/.test(String(w.value ?? ''))) total += numero(w.value, 0)
      else total *= numero(w.value, 2)
      razones.push('debilidad')
    }
    for (const r of Array.isArray(def?.resistances) ? def.resistances : []) {
      if (!tipos.includes(letraDeTipo(r?.type))) continue
      total -= numero(r.value, 30)
      razones.push('resistencia')
    }
    return { total: Math.max(0, total), razones }
  }

  async atacar(slot, indice, ui, { prestadoDe = null } = {}) {
    const s = this.s
    const origen = prestadoDe ? this.slot(prestadoDe) : slot
    const c = this.cartaDe(origen)
    const ataque = c.attacks?.[indice]
    if (!ataque) throw new NoSePuede('Ese ataque no existe.')
    const no = this.motivoNoAtacar(slot, ataque, origen !== slot ? origen : null)
    if (no) throw new NoSePuede(no)
    // Confusión: moneda, y con cruz el ataque falla y te haces 30.
    if (slot.estados.includes('confundido') && !this.moneda()) {
      this.ponerDanio(slot, 30, { motivo: 'confusión' })
      this.log('La confusión hace que el ataque falle.')
      s.flags.atacado = true
      this.retirarKOPropios()
      return this.finDeAtaque(ui)
    }
    this.log(`${nombreVisible(this.cartaDe(slot))} ataca con ${ataque.name}.`)
    s.flags.atacante = slot.id
    s.flags.enAtaque = true
    const def = this.defDeAtaque(c, ataque)
    const { base, signo } = danioImpreso(ataque)
    let danio = base
    if (def?.usar) {
      const r = await def.usar(this, ui, slot, { base, ataque })
      if (typeof r === 'number') danio = r
      else if (r && typeof r === 'object') danio = r.danio ?? danio
    } else if (signo === '+' || signo === '×') {
      // Sin automatizar y con daño variable: que lo diga el jugador.
      danio = await ui.numero({ titulo: `${ataque.name}: ¿cuánto daño hace?`, texto: ataque.effect || '', min: 0, max: 990, paso: 10, valor: base })
    } else if (ataque.effect && !def) {
      this.log(`(El texto de ${ataque.name} no está automatizado: aplica lo que falte a mano.)`)
    }
    const objetivo = this.rival.activo
    if (danio > 0 && objetivo) {
      const { extra, razones } = this.bonosDeDanio(slot)
      // Contra otro jugador, la debilidad y la resistencia del Pokémon de
      // verdad (el maniquí no tiene: mide TU daño).
      const dr = this.oponente ? this.debilidadYResistencia(slot, objetivo, danio + extra) : { total: danio + extra, razones: [] }
      this.danioAlRival(objetivo, dr.total, { motivo: [...razones, ...dr.razones].join(', ') })
    }
    s.flags.atacado = true
    if (def?.despues) await def.despues(this, ui, slot)
    await this.resolverKORival(ui)
    s.flags.enAtaque = false
    this.retirarKOPropios()
    return this.finDeAtaque(ui)
  }

  // Un ataque «a mano»: para cartas cuyo texto el catálogo aún no tiene
  // (el engorde no ha pasado por ellas) o para probar un número. Cuenta
  // como atacar: mismas reglas de turno, y termina el turno.
  async ataqueManual(ui, danio) {
    const s = this.s
    if (!this.enTurno) throw new NoSePuede('Ahora no es tu turno.')
    if (!s.activo) throw new NoSePuede('No tienes Pokémon activo.')
    if (s.estricta && this.primerTurnoDelPrimero) throw new NoSePuede('Quien va primero no puede atacar en su primer turno.')
    this.log(`${nombreVisible(this.cartaDe(s.activo))} ataca (a mano) por ${danio}.`)
    s.flags.atacante = s.activo.id
    s.flags.enAtaque = true
    if (danio > 0 && this.rival.activo) this.danioAlRival(this.rival.activo, danio)
    s.flags.atacado = true
    await this.resolverKORival(ui)
    s.flags.enAtaque = false
    return this.finDeAtaque(ui)
  }

  async finDeAtaque(ui) {
    if (this.s.fase === 'fin') return
    // Atacar termina el turno.
    await this.pasarTurno(ui)
  }

  // El botón de terminar turno. Antes de acabar se repone el activo si
  // hace falta (un Pokémon puede caer por sus propios contadores).
  async pasarTurno(ui) {
    // Con mesa, terminar el turno es darle el turno al otro: lo hace ella.
    if (this.mesa) return this.mesa.pasarTurno(ui)
    const s = this.s
    if (s.fase !== 'turno') return
    await this.reponerActivo(ui)
    this.terminarTurno()
    await this.reponerActivo(ui)
    this.comprobarFin()
  }

  // ════════════════════════════════════════════════════════════════
  // Búsquedas: la pieza que más usan las cartas
  // ════════════════════════════════════════════════════════════════
  //
  // Enseña el mazo ENTERO (como en la mesa: miras todas y eliges las que
  // valen) con las que no cumplen apagadas. Mirar el mazo cuenta para lo
  // que sabes: desde aquí, los premios salen por eliminación.
  async buscarEnMazo(ui, { titulo, texto = '', filtro = () => true, min = 0, max = 1, validar = null, destino = 'mano', barajar = true } = {}) {
    this.verMazo()
    const elegibles = this.s.mazo.filter((u) => filtro(this.carta(u), u))
    const elegidas = await ui.cartas({ titulo, texto, opciones: [...this.s.mazo], elegibles, min: Math.min(min, elegibles.length), max, validar, zona: 'mazo' })
    const hechas = []
    for (const u of elegidas) {
      if (destino === 'mano') {
        this.sacarDelMazo(u)
        this.s.mano.push(u)
        hechas.push(u)
      } else if (destino === 'banca') {
        if (this.huecosBanca <= 0) break
        this.sacarDelMazo(u)
        const p = this.nuevoSlot(u)
        if (!this.s.activo) this.s.activo = p
        else this.s.banca.push(p)
        this.alEntrarEnBanca(p)
        hechas.push(u)
      } else if (destino === 'descarte') {
        this.sacarDelMazo(u)
        this.s.descarte.push(u)
        hechas.push(u)
      } else hechas.push(u)
    }
    if (hechas.length && destino !== 'nada') this.log(`${destino === 'banca' ? 'A la banca' : destino === 'descarte' ? 'Al descarte' : 'A la mano'} desde el mazo: ${hechas.map((u) => this.nombre(u)).join(', ')}.`)
    else if (!hechas.length) this.log('La búsqueda no coge nada.')
    if (barajar) this.barajar()
    this.retirarKOPropios()
    return hechas
  }

  // ════════════════════════════════════════════════════════════════
  // Las herramientas a mano (modo laboratorio)
  // ════════════════════════════════════════════════════════════════
  //
  // Para lo que no está automatizado —o para montar una situación—: mover
  // cualquier carta a cualquier sitio. No miran las reglas, a propósito.

  moverCarta(uid, destino) {
    const s = this.s
    const desde = this.dondeEsta(uid)
    if (!desde) return
    if (desde.zona === 'mazo') this.sacarDelMazo(uid)
    else if (desde.zona === 'mano') s.mano.splice(s.mano.indexOf(uid), 1)
    else if (desde.zona === 'descarte') s.descarte.splice(s.descarte.indexOf(uid), 1)
    else if (desde.zona === 'premios') {
      s.premios = s.premios.filter((u) => u !== uid)
      delete s.premiosVistos[uid]
    } else if (desde.zona === 'juego') {
      const p = desde.slot
      if (p.herramienta === uid) p.herramienta = null
      p.energias = p.energias.filter((u) => u !== uid)
      if (p.cartas.includes(uid)) {
        // Mover la carta de arriba de un Pokémon: con ella se va todo si
        // era la única; si no, «devolverla» es desevolucionar.
        p.cartas = p.cartas.filter((u) => u !== uid)
        if (!p.cartas.length) {
          s.descarte.push(...p.energias, ...(p.herramienta ? [p.herramienta] : []))
          this.quitarDelJuego(p)
        }
      }
    }
    if (destino === 'mano') s.mano.push(uid)
    else if (destino === 'descarte') s.descarte.push(uid)
    else if (destino === 'arriba') this.alMazo([uid], 'arriba')
    else if (destino === 'abajo') this.alMazo([uid], 'abajo')
    else if (destino === 'mazo') this.alMazo([uid], 'barajar')
    this.log(`${this.nombre(uid)} → ${{ mano: 'mano', descarte: 'descarte', arriba: 'arriba del mazo', abajo: 'abajo del mazo', mazo: 'mazo (barajando)' }[destino] || destino}.`)
  }

  dondeEsta(uid) {
    const s = this.s
    if (s.mazo.includes(uid)) return { zona: 'mazo' }
    if (s.mano.includes(uid)) return { zona: 'mano' }
    if (s.descarte.includes(uid)) return { zona: 'descarte' }
    if (s.premios.includes(uid)) return { zona: 'premios' }
    for (const p of this.enJuego) if (this.cartasDelSlot(p).includes(uid)) return { zona: 'juego', slot: p }
    return null
  }
}

// ── Auxiliares ──

// A quién le vale cada bono de turno. El maniquí rival solo sabe si es
// ex (no distingue una V): Kieran cuenta las dos, así que aquí basta.
const BONOS_DE_TURNO = {
  cinturon: (p) => !!p.rival.activo?.ex,
  kieran: (p) => !!p.rival.activo?.ex,
  premium: (p, slot) => esDeTipo(p.cartaDe(slot), 'F'),
  gladion: (p, slot) => !tieneRegla(p.cartaDe(slot)),
}

function quitarEstado(p, e) {
  p.estados = p.estados.filter((x) => x !== e)
  if (e === 'paralizado') p.paralizadoEn = null
}

export function ponerEstado(p, e, turno = 0) {
  // Dormido, confundido y paralizado se sustituyen entre sí; veneno y
  // quemadura se suman a lo que haya.
  const giro = ['dormido', 'confundido', 'paralizado']
  if (giro.includes(e)) p.estados = p.estados.filter((x) => !giro.includes(x))
  if (!p.estados.includes(e)) p.estados.push(e)
  if (e === 'paralizado') p.paralizadoEn = turno
}

// La era actual: marcas G en adelante, o sin marca (las colecciones más
// nuevas llegan sin ella hasta que se curan). Es la criba para no
// aplicarle a un Pokémon viejo la habilidad de su tocayo moderno.
const MARCAS_MODERNAS = new Set(['G', 'H', 'I', 'J', 'K', 'L'])
export function modernaOSinMarca(c) {
  return !c?.regulation_mark || MARCAS_MODERNAS.has(String(c.regulation_mark).toUpperCase())
}

// ── El maniquí ──
//
// Tres plantillas que cubren lo que se quiere medir: cuánto tardas en
// tumbar un básico, una ex o una Mega ex.
export const PLANTILLAS_RIVAL = {
  basico: { id: 'basico', nombre: 'Básico', ps: 120, premios: 1, ex: false },
  ex: { id: 'ex', nombre: 'Pokémon ex', ps: 230, premios: 2, ex: true },
  mega: { id: 'mega', nombre: 'Mega ex', ps: 340, premios: 3, ex: true },
}

export function nuevoManiqui(plantilla, seq = 0) {
  const p = PLANTILLAS_RIVAL[plantilla?.id] || plantilla || PLANTILLAS_RIVAL.ex
  return { id: `r${seq}`, nombre: p.nombre, ps: p.ps, premios: p.premios, ex: !!p.ex, danio: 0, estados: [] }
}

export function crearRival({ plantilla = 'ex', banca = 2 } = {}) {
  const p = PLANTILLAS_RIVAL[plantilla] || PLANTILLAS_RIVAL.ex
  const r = { plantilla: p, premios: 6, seq: 0, caidos: 0 }
  r.activo = nuevoManiqui(p, ++r.seq)
  r.banca = Array.from({ length: banca }, () => nuevoManiqui(p, ++r.seq))
  return r
}

// ════════════════════════════════════════════════════════════════════
// La mesa: tú contra ti, con dos mazos (tanda 456)
// ════════════════════════════════════════════════════════════════════
//
// PINGU: «poder jugar una partida en el laboratorio tú contra ti mismo con
// los 2 mazos que quieras», como tcgmasters.net. Dos `Partida` sentadas
// frente a frente: cada una es un jugador entero (mazo, mano, premios,
// banca, descarte, sus reglas de turno) y la otra es su rival de verdad.
// La mesa pone lo que es de los dos: de quién es el turno, el registro,
// el estadio (que es uno), y DESHACER, que tiene que volver atrás los dos
// lados a la vez.
//
// Las dos juegan con el mismo motor y los mismos efectos que contra el
// maniquí: el rival se ve con su forma (`Partida.rival`), así que una
// carta que ya sabía hacer daño al maniquí se lo hace al otro jugador.
export class Mesa {
  constructor({ mazos, nombres = ['Jugador 1', 'Jugador 2'], efectos = {}, semilla = Date.now() >>> 0, empieza = 'azar', estricta = true } = {}) {
    this.cartas = new Map()
    // La moneda de quién empieza sale de la semilla de la mesa: con la
    // misma semilla, la misma partida (las pruebas lo necesitan).
    const azar = { semilla: semilla >>> 0 }
    const primero = empieza === 'azar' ? (siguienteAzar(azar) < 0.5 ? 0 : 1) : empieza === 1 || empieza === 'b' ? 1 : 0
    this.jugadores = [0, 1].map(
      (i) =>
        new Partida({
          entradas: mazos[i],
          efectos,
          semilla: (Math.floor(siguienteAzar(azar) * 2 ** 32) >>> 0) || i + 1,
          vaPrimero: i === primero,
          estricta,
          prefijo: i ? 'b' : 'a',
          cartas: this.cartas,
          nombre: nombres[i] || `Jugador ${i + 1}`,
        })
    )
    const [a, b] = this.jugadores
    a.oponente = b
    b.oponente = a
    a.mesa = this
    b.mesa = this
    this.historia = []
    this.m = {
      fase: 'mulligan', // mulligan → preparacion → juego → fin
      primero,
      turnoDe: primero,
      preparando: primero,
      listos: [false, false],
      turnoGlobal: 0,
      registro: [],
      pendientes: [],
      resultado: null,
      monedaInicial: empieza === 'azar',
    }
    if (empieza === 'azar') this.log(null, `Moneda: empieza ${this.jugadores[primero].nombreJugador}.`)
  }

  // ── Lo que se ve desde fuera ──
  get fase() {
    return this.m.fase
  }
  get terminada() {
    return this.m.fase === 'fin'
  }
  // El jugador que tiene que hacer algo ahora: el que prepara su mesa o
  // el que juega su turno.
  get actual() {
    return this.jugadores[this.m.fase === 'preparacion' ? this.m.preparando : this.m.turnoDe]
  }
  indice(partida) {
    return this.jugadores.indexOf(partida)
  }

  log(partida, texto) {
    const j = partida ? this.indice(partida) : -1
    this.m.registro.push({ turno: this.m.turnoGlobal, j, texto })
    if (this.m.registro.length > 600) this.m.registro.shift()
  }

  nuevoTurno() {
    this.m.turnoGlobal++
  }

  // ── Deshacer: los dos lados y la mesa, juntos ──
  foto() {
    this.historia.push(structuredClone({ a: this.jugadores[0].s, b: this.jugadores[1].s, m: this.m }))
    if (this.historia.length > 80) this.historia.shift()
  }
  restaurar(f) {
    this.jugadores[0].s = f.a
    this.jugadores[1].s = f.b
    this.m = f.m
  }
  deshacer() {
    const antes = this.historia.pop()
    if (!antes) return false
    this.restaurar(antes)
    return true
  }
  get puedeDeshacer() {
    return this.historia.length > 0
  }

  // Una jugada, con su foto. Después de cada una se resuelve lo que haya
  // dejado pendiente: premios que coger por un KO que pasó donde no se
  // podía preguntar, y Pokémon del otro que hayan caído por un efecto que
  // no es un ataque (una habilidad que pone contadores).
  async accion(fn, ui) {
    this.foto()
    try {
      const r = await fn()
      await this.resolver(ui)
      return r
    } catch (err) {
      this.restaurar(this.historia.pop())
      throw err
    }
  }

  premiosPendientes(partida, n) {
    if (n > 0) this.m.pendientes.push({ j: this.indice(partida), n })
  }

  async resolver(ui) {
    if (this.m.fase !== 'juego') return this.comprobarFin()
    const j = this.actual
    const op = j.oponente
    if (op.enJuego.some((d) => op.psDe(d) > 0 && d.danio >= op.psDe(d))) await j.resolverKOOponente(ui)
    j.retirarKOPropios()
    while (this.m.pendientes.length && !this.terminada) {
      const { j: i, n } = this.m.pendientes.shift()
      await this.jugadores[i].cogerPremios(n, ui)
      this.comprobarFin()
    }
    this.comprobarFin()
    if (this.terminada) return
    // Quien se ha quedado sin activo sube uno: el otro en cuanto se
    // entera, y el que juega antes de seguir.
    await op.reponerActivo(ui)
    await j.reponerActivo(ui)
    this.comprobarFin()
  }

  // ── Empezar ──
  repartir() {
    for (const j of this.jugadores) j.repartir()
    const sin = this.jugadores.find((j) => j.s.fase === 'fin')
    if (sin) {
      this.m.fase = 'fin'
      this.m.resultado = { ganador: null, texto: `El mazo de ${sin.nombreJugador} no tiene ningún Pokémon básico: no se puede empezar.`, tipo: 'sin-basicos' }
      return
    }
    this.m.fase = 'preparacion'
    this.m.preparando = this.m.primero
    this.m.listos = [false, false]
  }

  // Cambiar quién empieza mientras se prepara.
  ponerPrimero(i) {
    if (this.m.fase !== 'preparacion' && this.m.fase !== 'mulligan') return
    this.m.primero = i
    this.m.turnoDe = i
    this.jugadores.forEach((j, k) => j.ponerVaPrimero(k === i))
    this.log(null, `Empieza ${this.jugadores[i].nombreJugador}.`)
  }
  lanzarMoneda() {
    const i = this.jugadores[0].azar() < 0.5 ? 0 : 1
    this.log(null, `Moneda: ${i === 0 ? 'cara' : 'cruz'}.`)
    this.ponerPrimero(i)
    return i
  }

  // El que prepara dice «listo»: pasa al otro, y con los dos, empieza.
  async listo(ui) {
    const j = this.actual
    if (this.m.fase !== 'preparacion') return
    if (!j.s.activo) throw new NoSePuede(`${j.nombreJugador}: elige primero tu Pokémon activo.`)
    this.m.listos[this.m.preparando] = true
    const otro = 1 - this.m.preparando
    if (!this.m.listos[otro]) {
      this.m.preparando = otro
      return
    }
    await this.empezar(ui)
  }

  async empezar(ui) {
    for (const j of this.jugadores) j.empezar({ arrancar: false })
    this.m.fase = 'juego'
    // Por cada mulligan del otro, puedes robar una carta de más (si
    // quieres: no es obligatorio).
    for (const j of this.jugadores) {
      const n = j.oponente.s.mulligans
      if (!n) continue
      const cuantas = ui?.numero ? await ui.numero({ titulo: `${j.nombreJugador}: ${j.oponente.nombreJugador} hizo ${n} ${n === 1 ? 'mulligan' : 'mulligans'}`, texto: '¿Cuántas cartas robas de más? (Hasta una por mulligan.)', min: 0, max: n, valor: n }) : n
      if (cuantas > 0) j.robar(cuantas, { motivo: 'Por los mulligans del rival' })
    }
    this.m.turnoDe = this.m.primero
    const p = this.jugadores[this.m.primero]
    p.s.fase = 'turno'
    p.empezarTurno()
    this.comprobarFin()
  }

  // ── Pasar el turno ──
  //
  // Lo de final de turno de quien acaba, el Chequeo Pokémon de LOS DOS
  // activos, los premios y activos que eso deje pendientes, y el turno
  // del otro (que roba; si no puede, pierde).
  async pasarTurno(ui) {
    if (this.m.fase !== 'juego') return
    const j = this.actual
    const op = j.oponente
    if (j.s.fase !== 'turno') return
    await j.reponerActivo(ui)
    j.finDeTurnoPropio()
    j.chequeo()
    op.chequeo()
    await this.resolverPendientes(ui)
    if (this.terminada) return
    await j.reponerActivo(ui)
    await op.reponerActivo(ui)
    this.comprobarFin()
    if (this.terminada) return
    j.s.koUltimoTurnoRival = false
    j.s.fase = 'espera'
    this.m.turnoDe = this.indice(op)
    op.s.fase = 'turno'
    op.empezarTurno()
    this.comprobarFin()
  }

  async resolverPendientes(ui) {
    while (this.m.pendientes.length && !this.terminada) {
      const { j: i, n } = this.m.pendientes.shift()
      await this.jugadores[i].cogerPremios(n, ui)
      this.comprobarFin()
    }
    this.comprobarFin()
  }

  // ── El final ──
  comprobarFin() {
    if (this.m.fase === 'fin' || this.m.fase === 'mulligan' || this.m.fase === 'preparacion') return
    for (const j of this.jugadores) j.comprobarFin()
    const acabado = this.jugadores.find((j) => j.s.fase === 'fin')
    if (!acabado) return
    const r = acabado.s.resultado || {}
    const ganador = r.tipo === 'victoria' ? acabado : acabado.oponente
    this.m.fase = 'fin'
    this.m.pendientes = []
    this.m.resultado = { ganador: this.indice(ganador), texto: r.texto || 'Fin de la partida.', turno: this.m.turnoGlobal }
    for (const j of this.jugadores) {
      if (j.s.fase !== 'fin') {
        j.s.fase = 'fin'
        j.s.resultado = { tipo: j === ganador ? 'victoria' : 'derrota', texto: r.texto, turno: j.s.turno }
      }
    }
    this.log(null, `Gana ${ganador.nombreJugador}. ${r.texto || ''}`.trim())
  }
}

// ════════════════════════════════════════════════════════════════════
// Las probabilidades EN VIVO
// ════════════════════════════════════════════════════════════════════
//
// Desde lo que TÚ sabes, no desde lo que sabe el ordenador. El programa
// conoce el orden del mazo, pero enseñarlo sería hacer trampa; lo que
// importa es lo que un jugador puede deducir en la mesa:
//
//   · Lo que no has visto (el resto del mazo y los premios boca abajo)
//     está repartido al azar: la carta de arriba es cualquiera de ellas.
//   · Lo que sabes que está en el mazo (lo viste al buscar, lo barajaste
//     tú) ya no puede estar en los premios.
//   · Lo que sabes dónde está (arriba, abajo) sale cuando sale.
//
// Con eso, «¿cuántas X hay en la parte del mazo que no conozco?» es una
// hipergeométrica: las X que no has visto (`kx`) se reparten entre los
// huecos del mazo sin identificar (`S`) y los premios boca abajo (`Ph`).
// Y robar n es sacar n de esa parte, después de las de arriba.
export function contextoDeProbabilidad(partida) {
  const s = partida.s
  const k = s.conocimiento
  const D = s.mazo.length
  const t = Math.min(k.arriba, D)
  const b = Math.min(k.abajo, D - t)
  const arriba = s.mazo.slice(0, t)
  const abajo = s.mazo.slice(D - b)
  const medio = s.mazo.slice(t, D - b)
  const conf = medio.filter((u) => k.confirmados[u])
  const sinConf = medio.filter((u) => !k.confirmados[u])
  const premiosOcultos = s.premios.filter((u) => !s.premiosVistos[u])
  const premiosVistos = s.premios.filter((u) => s.premiosVistos[u])
  return {
    D, t, b, arriba, abajo, conf, sinConf, premiosOcultos, premiosVistos,
    Dm: medio.length,
    S: sinConf.length,
    Ph: premiosOcultos.length,
    Uu: sinConf.length + premiosOcultos.length,
  }
}

export function probabilidadDeGrupo(partida, esDelGrupo, n, ctx = contextoDeProbabilidad(partida)) {
  const g = (u) => esDelGrupo(partida.carta(u), u)
  const { t, b, arriba, abajo, conf, sinConf, premiosOcultos, premiosVistos, Dm, S, Ph, Uu } = ctx
  const cuenta = (lista) => lista.reduce((s, u) => s + (g(u) ? 1 : 0), 0)
  const cm = cuenta(conf)
  const kx = cuenta(sinConf) + cuenta(premiosOcultos)
  const bx = cuenta(abajo)
  const tx = cuenta(arriba)
  const px = cuenta(premiosVistos)
  const quedan = cm + kx + bx + tx + px

  // P(ninguna en los próximos n robos).
  const ninguna = (n) => {
    if (n <= 0) return 1
    if (cuenta(arriba.slice(0, Math.min(n, t))) > 0) return 0
    const r = Math.min(Math.max(n - t, 0), Dm)
    const rb = Math.min(Math.max(n - t - Dm, 0), b)
    const pb = rb > 0 ? comb(b - bx, rb) / comb(b, rb) : 1
    if (r === 0) return pb
    let suma = 0
    for (let h = 0; h <= Math.min(kx, S); h++) {
      const ph = hiper(Uu, kx, S, h)
      if (ph) suma += (ph * comb(Dm - cm - h, r)) / comb(Dm, r)
    }
    return suma * pb
  }

  const enMazoSeguro = tx + bx + cm
  return {
    quedan,
    siguiente: ctx.D ? 1 - ninguna(1) : 0,
    enN: ctx.D ? 1 - ninguna(Math.min(n, ctx.D)) : 0,
    // Todas las que quedan, en los premios.
    todasPremiadas: quedan === 0 ? null : enMazoSeguro > 0 ? 0 : kx === 0 ? (px > 0 ? 1 : 0) : hiper(Uu, kx, S, 0),
    // Cuántas se esperan en los premios.
    esperadasPremios: px + (Uu ? (kx * Ph) / Uu : 0),
    // Si ya se sabe EXACTAMENTE (mazo visto entero).
    premiosExactos: S === 0 ? px + kx : null,
  }
}
