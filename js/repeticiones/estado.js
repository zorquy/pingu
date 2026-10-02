// La mesa de una repetición, jugada a jugada (tanda 462).
//
// De la lista de eventos (registro.js) a la lista de FOTOS de la mesa: una
// por evento, para poder ir adelante y atrás sin volver a calcular. Cada
// foto lleva también qué se acaba de mover (`foco`), que es lo que la
// pantalla ilumina.
//
// El registro no lo cuenta todo: del rival no se sabe qué roba, una
// energía unida «al Dreepy» no dice a CUÁL de los dos, y la frase de un KO
// en español no está garantizada. Las reglas de aquí son las de quien lo
// lee en voz alta: el primero que case, y si algo no cuadra (una carta que
// «se juega» y no estaba en la mano conocida), se resta igual y se sigue.
// La mesa no se para por un detalle que el registro no da.

const plano = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").trim()
const igual = (a, b) => plano(a) === plano(b)

let semilla = 0
const nuevoSlot = (carta) => ({ id: `s${++semilla}`, cartas: [carta], energias: [], herramienta: null, danio: 0, ko: false })
export const arriba = (slot) => slot?.cartas[slot.cartas.length - 1] || ''

function jugadorVacio(nombre) {
  return { nombre, activo: null, banca: [], mano: 0, manoConocida: [], mazo: 60, descarte: [], premios: 0, empieza: null }
}

export function estadoInicial(jugadores, { protagonista = null } = {}) {
  semilla = 0
  const j = {}
  for (const n of jugadores) j[n] = jugadorVacio(n)
  return { jugadores: j, orden: [...jugadores], protagonista: protagonista || jugadores[0], estadio: null, turno: 0, deQuien: null, fin: null, foco: null, linea: '' }
}

// De quién es la mano que el registro enseña: el que tiene la lista de su
// mano inicial («• Erin, Dunsparce…»). Va abajo, como en el juego.
export function protagonistaDe({ jugadores, eventos }) {
  const e = eventos.find((x) => x.tipo === 'manoInicial' && x.cartas?.length)
  return e?.jugador || jugadores[0]
}

// ── Piezas ──

const enJuego = (p) => [p.activo, ...p.banca].filter(Boolean)

// El Pokémon que se llama así: primero donde dice el registro, luego en
// cualquier sitio. Con dos iguales, el primero (el registro no distingue).
function buscar(p, nombre, donde = null) {
  const casa = (s) => s && igual(arriba(s), nombre)
  if (donde === 'activo' && casa(p.activo)) return p.activo
  if (donde === 'banca') {
    const b = p.banca.find(casa)
    if (b) return b
  }
  return casa(p.activo) ? p.activo : p.banca.find(casa) || null
}

function quitarDeMano(p, carta) {
  // Con la mano a cero según la cuenta, esa carta llegó por algo que el
  // registro no dijo (un robo de un efecto sin línea): sale del mazo, que
  // es lo que mantiene las 60 cartas en su sitio.
  if (p.mano <= 0) {
    p.mazo = Math.max(0, p.mazo - 1)
    return
  }
  p.mano -= 1
  const i = p.manoConocida.findIndex((c) => igual(c, carta))
  if (i >= 0) p.manoConocida.splice(i, 1)
  else if (p.manoConocida.length > p.mano) p.manoConocida.pop()
}
function aMano(p, cartas, n = cartas.length) {
  p.mano += n
  p.manoConocida.push(...cartas)
}
function quitarSlot(p, slot) {
  if (p.activo === slot) p.activo = null
  else p.banca = p.banca.filter((s) => s !== slot)
}
const cartasDe = (slot) => [...slot.cartas, ...slot.energias, ...(slot.herramienta ? [slot.herramienta] : [])]

// ¿Estas cartas son EXACTAMENTE un Pokémon en juego con todo lo suyo?
// (Dudunsparce: «ha puesto 3 cartas en su baraja: Dudunsparce, Energía
// Enriquecedora, Dunsparce» es él mismo volviendo al mazo.)
function slotQueSonEstas(p, cartas) {
  if (!cartas?.length) return null
  const clave = (l) => l.map(plano).sort().join('|')
  return enJuego(p).find((s) => clave(cartasDe(s)) === clave(cartas)) || null
}

// ── Un evento ──
//
// Devuelve la foto siguiente, sin tocar la de antes (se guardan todas para
// poder ir hacia atrás).
//
// `psDe(nombre)`, si se sabe, dice los PS de una carta: con él, un Pokémon
// con más daño que vida que deja su puesto cae aunque la línea del KO no
// se haya entendido (la forma exacta en español no está garantizada).
export function aplicar(estado, e, { psDe = null } = {}) {
  const s = structuredClone(estado)
  s.linea = e.linea || ''
  s.foco = null
  const p = e.jugador ? s.jugadores[e.jugador] : null
  switch (e.tipo) {
    case 'manoInicial':
      p.mano = e.n
      p.mazo = 60 - e.n
      p.manoConocida = [...(e.cartas || [])]
      s.foco = { tipo: 'robar', jugador: e.jugador }
      break
    case 'mulligan':
      p.mano = 0
      p.manoConocida = []
      p.mazo = 60
      break
    case 'decide':
      p.empieza = e.primero
      break
    case 'poner': {
      const slot = nuevoSlot(e.carta)
      if (e.donde === 'activo' && !p.activo) p.activo = slot
      else p.banca.push(slot)
      quitarDeMano(p, e.carta)
      s.foco = { tipo: 'entra', jugador: e.jugador, slot: slot.id }
      break
    }
    case 'turno':
      // Los premios se ponen al empezar la partida (después de los activos).
      for (const j of Object.values(s.jugadores)) {
        if (!j.premios && !j.premiosPuestos) {
          j.premios = 6
          j.premiosPuestos = true
          j.mazo = Math.max(0, j.mazo - 6)
        }
      }
      s.turno += 1
      s.deQuien = e.jugador
      s.caido = null
      s.retirado = null
      s.subio = null
      s.foco = { tipo: 'turno', jugador: e.jugador }
      break
    case 'finTurno':
      s.foco = { tipo: 'turno', jugador: e.jugador }
      break
    case 'robar': {
      const n = e.cartas?.length || e.n || 1
      p.mazo = Math.max(0, p.mazo - n)
      aMano(p, e.cartas || [], n)
      s.foco = { tipo: 'robar', jugador: e.jugador, cartas: e.cartas }
      break
    }
    case 'aBanca': {
      const cartas = e.cartas || []
      const n = cartas.length || e.n || 1
      p.mazo = Math.max(0, p.mazo - n)
      const ids = []
      for (let i = 0; i < n; i++) {
        const slot = nuevoSlot(cartas[i] || '?')
        if (!p.activo) p.activo = slot
        else p.banca.push(slot)
        ids.push(slot.id)
      }
      s.foco = { tipo: 'entra', jugador: e.jugador, slots: ids }
      break
    }
    case 'jugar': {
      // «Ha jugado Dudunsparce» con un Dudunsparce EN JUEGO es su
      // habilidad (así lo escribe el juego): no sale de la mano.
      const enMesa = buscar(p, e.carta)
      if (enMesa) {
        s.foco = { tipo: 'habilidad', jugador: e.jugador, slot: enMesa.id, carta: e.carta }
        break
      }
      quitarDeMano(p, e.carta)
      p.descarte.push(e.carta)
      s.foco = { tipo: 'jugar', jugador: e.jugador, carta: e.carta }
      break
    }
    case 'estadio':
      if (s.estadio) s.jugadores[s.estadio.dueno]?.descarte.push(s.estadio.carta)
      s.estadio = { carta: e.carta, dueno: e.jugador }
      quitarDeMano(p, e.carta)
      s.foco = { tipo: 'jugar', jugador: e.jugador, carta: e.carta, estadio: true }
      break
    case 'unir': {
      const energia = /^energ|energy$/i.test(e.carta)
      // Una herramienta, con dos que se llaman igual, al que no lleva otra:
      // nadie puede llevar dos.
      const libre = !energia && enJuego(p).find((x) => igual(arriba(x), e.a) && !x.herramienta && (e.donde !== 'activo' || x === p.activo) && (e.donde !== 'banca' || x !== p.activo))
      const slot = libre || buscar(p, e.a, e.donde)
      if (!slot) break
      // En una sublínea («- X ha unido…» bajo el ataque de otro, como el
      // Pequeño Cambio de Elgyem) la energía se MUEVE desde otro Pokémon
      // de ese jugador; si no la tiene ninguno, sale de la mano.
      let deOtro = null
      if (e.sub) deOtro = enJuego(p).find((x) => x !== slot && x.energias.some((c) => igual(c, e.carta)))
      if (deOtro) deOtro.energias.splice(deOtro.energias.findIndex((c) => igual(c, e.carta)), 1)
      else if (!e.sub || p.manoConocida.some((c) => igual(c, e.carta))) quitarDeMano(p, e.carta)
      // Si no, la trae un efecto desde el mazo (Generador Eléctrico…).
      else p.mazo = Math.max(0, p.mazo - 1)
      if (energia || slot.herramienta) slot.energias.push(e.carta)
      else slot.herramienta = e.carta
      s.foco = { tipo: 'unir', jugador: e.jugador, slot: slot.id, carta: e.carta }
      break
    }
    case 'evolucionar': {
      const slot = buscar(p, e.de, e.donde)
      if (!slot) break
      slot.cartas.push(e.a)
      quitarDeMano(p, e.a)
      s.foco = { tipo: 'evoluciona', jugador: e.jugador, slot: slot.id, carta: e.a }
      break
    }
    case 'usar': {
      const slot = buscar(p, e.pokemon)
      s.foco = { tipo: 'habilidad', jugador: e.jugador, slot: slot?.id, que: e.que, carta: e.pokemon }
      break
    }
    case 'ataque': {
      const at = buscar(p, e.pokemon, 'activo')
      const q = s.jugadores[e.deQuien]
      const obj = q ? buscar(q, e.objetivo, 'activo') : null
      if (obj) obj.danio += e.danio
      s.foco = { tipo: 'ataque', jugador: e.jugador, slot: at?.id, objetivo: obj?.id, deQuien: e.deQuien, danio: e.danio, que: e.ataque }
      break
    }
    case 'contadores': {
      const q = s.jugadores[e.deQuien]
      const obj = q ? buscar(q, e.pokemon) : null
      if (obj) obj.danio += e.n * 10
      s.foco = { tipo: 'danio', jugador: e.deQuien, slot: obj?.id, danio: e.n * 10 }
      break
    }
    case 'retirar': {
      const slot = p.activo
      if (slot) {
        p.activo = null
        p.banca.push(slot)
        // Las energías que paga van en las sublíneas siguientes y nombran
        // al Pokémon por su nombre: si hay dos iguales, es ESTE.
        s.retirado = slot.id
      }
      s.foco = { tipo: 'retirar', jugador: e.jugador, slot: slot?.id }
      break
    }
    case 'pasaActivo': {
      // Con dos que se llaman igual, el que sube no es el que se acaba de
      // retirar (si no, la retirada no habría servido de nada).
      const casa = (x) => igual(arriba(x), e.pokemon)
      // «X se ha intercambiado con Y y pasa a ser el Pokémon Activo» va
      // SIEMPRE seguida de «X pasa a estar en el Puesto Activo»: es la misma
      // jugada contada dos veces. Con un gemelo en la banca, la segunda los
      // volvía a cambiar.
      if (p.activo && p.activo.id === s.subio && casa(p.activo)) {
        s.subio = null
        s.foco = { tipo: 'sube', jugador: e.jugador, slot: p.activo.id }
        break
      }
      const nuevo = p.banca.find((x) => casa(x) && x.id !== s.retirado) || p.banca.find(casa)
      if (!nuevo) break
      const viejo = p.activo
      p.banca = p.banca.filter((x) => x !== nuevo)
      if (viejo) {
        // El que se queda sin puesto: si había caído, al descarte; si no,
        // a la banca (un cambio que el registro no cuenta aparte).
        const ps = psDe?.(arriba(viejo))
        if (!viejo.ko && ps && viejo.danio >= ps) viejo.ko = true
        if (viejo.ko) p.descarte.push(...cartasDe(viejo))
        else p.banca.push(viejo)
      }
      p.activo = nuevo
      s.foco = { tipo: 'sube', jugador: e.jugador, slot: nuevo.id }
      break
    }
    case 'intercambio': {
      const sube = p.banca.find((x) => igual(arriba(x), e.sube))
      if (!sube) break
      const baja = p.activo
      p.banca = p.banca.filter((x) => x !== sube)
      if (baja) p.banca.push(baja)
      p.activo = sube
      s.subio = sube.id
      s.foco = { tipo: 'sube', jugador: e.jugador, slot: sube.id }
      break
    }
    case 'ko': {
      const slot = buscar(p, e.pokemon, 'activo')
      if (!slot) break
      slot.ko = true
      // Fuera ya: el que sube lo dirá la línea siguiente.
      quitarSlot(p, slot)
      p.descarte.push(...cartasDe(slot))
      s.caido = { jugador: e.jugador, nombre: arriba(slot) }
      s.foco = { tipo: 'ko', jugador: e.jugador, carta: arriba(slot), cartas: cartasDe(slot) }
      break
    }
    case 'descartarTodoDe': {
      // «3 cards were discarded from X's Raikou V» justo después de su KO
      // habla del que acaba de caer, que ya está en el descarte. Buscarlo
      // en la mesa encontraba a su GEMELO de la banca y lo tiraba también.
      if (s.caido && s.caido.jugador === e.jugador && igual(s.caido.nombre, e.pokemon)) {
        s.caido = null
        break
      }
      const slot = buscar(p, e.pokemon)
      if (!slot) break
      quitarSlot(p, slot)
      p.descarte.push(...cartasDe(slot))
      break
    }
    case 'premio':
      p.premios = Math.max(0, p.premios - e.n)
      aMano(p, e.cartas || [], e.n)
      // En inglés, el nombre de cada premio va en una línea aparte («X was
      // added to Y's hand»): esas no suman otra vez.
      p.premiosPorNombrar = e.n
      s.foco = { tipo: 'premio', jugador: e.jugador, n: e.n }
      break
    case 'llegaAMano': {
      const cartas = e.cartas || []
      if (p.premiosPorNombrar > 0) {
        p.premiosPorNombrar -= 1
        p.manoConocida.push(...cartas)
        break
      }
      // Si no es un premio, sale del descarte cuando está ahí (Camilla
      // Nocturna…), y si no, del mazo.
      for (const c of cartas.length ? cartas : ['']) {
        const i = c ? p.descarte.findIndex((x) => igual(x, c)) : -1
        if (i >= 0) p.descarte.splice(i, 1)
        else p.mazo = Math.max(0, p.mazo - 1)
      }
      aMano(p, cartas, Math.max(1, cartas.length))
      s.foco = { tipo: 'robar', jugador: e.jugador, cartas }
      break
    }
    case 'descartarDe': {
      // De los que se llaman así, el que TIENE esa carta (y si acaba de
      // retirarse uno, ese).
      const tiene = (x) => igual(arriba(x), e.pokemon) && (x.energias.some((c) => igual(c, e.carta)) || igual(x.herramienta, e.carta))
      const slot = enJuego(p).find((x) => x.id === s.retirado && tiene(x)) || enJuego(p).find(tiene)
      if (!slot) break
      const i = slot.energias.findIndex((c) => igual(c, e.carta))
      if (i >= 0) slot.energias.splice(i, 1)
      else if (slot.herramienta && igual(slot.herramienta, e.carta)) slot.herramienta = null
      else break
      p.descarte.push(e.carta)
      s.foco = { tipo: 'descarta', jugador: e.jugador, slot: slot.id }
      break
    }
    case 'descartar': {
      const cartas = e.cartas || []
      const n = cartas.length || e.n || 1
      for (let i = 0; i < n; i++) quitarDeMano(p, cartas[i] || '')
      p.descarte.push(...cartas)
      s.foco = { tipo: 'descarta', jugador: e.jugador }
      break
    }
    case 'alMazo': {
      // ¿Es un Pokémon en juego volviendo al mazo con lo suyo?
      const slot = slotQueSonEstas(p, e.cartas)
      if (slot) {
        quitarSlot(p, slot)
        p.mazo += cartasDe(slot).length
        s.foco = { tipo: 'alMazo', jugador: e.jugador }
        break
      }
      const n = e.n == null ? p.mano : e.n
      for (let i = 0; i < n; i++) quitarDeMano(p, (e.cartas || [])[i] || '')
      p.mazo += n
      s.foco = { tipo: 'alMazo', jugador: e.jugador }
      break
    }
    case 'barajar':
      s.foco = { tipo: 'barajar', jugador: e.jugador }
      break
    case 'moneda':
      s.foco = { tipo: 'moneda', jugador: e.jugador, cara: e.cara }
      break
    case 'activar':
      s.foco = { tipo: 'jugar', carta: e.carta, jugador: s.deQuien }
      break
    case 'fin':
      s.fin = { ganador: e.ganador, porque: e.porque || null }
      s.foco = { tipo: 'fin', jugador: e.ganador }
      break
    default:
      break
  }
  return s
}

// Todas las fotos: la de antes de empezar y una por evento.
export function fotos(lectura, ctx = {}) {
  const protagonista = protagonistaDe(lectura)
  let s = estadoInicial(lectura.jugadores, { protagonista })
  const out = [s]
  for (const e of lectura.eventos) {
    s = aplicar(s, e, ctx)
    out.push(s)
  }
  return out
}

// Los turnos, para saltar: en qué foto empieza cada uno.
export function indiceDeTurnos(lectura) {
  const out = []
  lectura.eventos.forEach((e, i) => {
    if (e.tipo === 'turno') out.push({ foto: i + 1, jugador: e.jugador, n: out.length + 1 })
  })
  return out
}
