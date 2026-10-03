// «Juega desde aquí» (tanda 497): la mesa de una repetición, en la jugada
// que se está mirando, convertida en una partida del laboratorio.
//
// PINGU, de la lista de ideas: «un botón "Juega desde aquí" que abre el
// laboratorio con la mesa tal cual está en ese momento, para probar otra
// línea». El laboratorio ya sabe jugar «tú contra ti» con dos mazos
// (tanda 456); lo que hace falta es SENTARLO en una posición a medias en
// vez de repartir. Dos piezas, sin DOM y sin el motor (se prueban en Node):
//
//   · mazosDeLaPosicion: el mazo de cada uno. Es lo que se le VIO en la
//     partida (mazos.js) y, hasta las 60, «Cartas sin ver»: lo que no salió
//     no se inventa. Así el mazo, los premios y la mano del rival tienen
//     las cartas que tienen que tener, y robar una de las que no se vieron
//     dice exactamente eso.
//   · colocarPosicion: con la Mesa ya creada sobre esos mazos, cada carta a
//     su sitio —activo, banca con lo que lleva unido, descarte, estadio,
//     la mano que se conoce— y lo que queda, barajado, a los premios, a la
//     mano que no se conoce y al mazo. Más lo que el turno ya ha gastado:
//     si ya se unió la energía de la mano o se jugó el partidario, el
//     laboratorio no deja hacerlo otra vez.
import { plano } from '../constructor/nucleo.js'

// La carta que hace de «no se sabe»: ni Pokémon, ni Entrenador, ni Energía
// (el motor no le ofrece nada que hacer), con su nombre a la vista.
export const SIN_VER = Object.freeze({ id: 'sin-ver', name: 'Unseen card', name_es: 'Carta sin ver', category: 'Sin ver' })

// Una carta que se vio y el catálogo no encontró: con su nombre y el tipo
// que se sabe por la partida (si estuvo en juego, es un Pokémon).
function cartaSuelta(nombre, tipo) {
  const category = tipo === 'pokemon' ? 'Pokemon' : tipo === 'energia' ? 'Energy' : 'Trainer'
  return { id: `suelta:${plano(nombre)}`, name: nombre, name_es: nombre, category }
}

// { entradas: [{ carta, n }], idDe(nombre) } para cada jugador. `vistas`
// es lo de mazos.js (`cartasVistas`) de ESE jugador.
export function mazosDeLaPosicion(vistas, cartaDe = () => null) {
  const porId = new Map()
  const idPorNombre = new Map()
  for (const v of vistas || []) {
    const carta = cartaDe(v.nombre) || cartaSuelta(v.nombre, v.tipo)
    idPorNombre.set(plano(v.nombre), carta.id)
    const ya = porId.get(carta.id)
    if (ya) ya.n += v.copias
    else porId.set(carta.id, { carta, n: v.copias })
  }
  const entradas = [...porId.values()]
  const vistas60 = entradas.reduce((k, e) => k + e.n, 0)
  if (vistas60 < 60) entradas.push({ carta: SIN_VER, n: 60 - vistas60 })
  return { entradas, idDe: (nombre) => idPorNombre.get(plano(nombre)) ?? null }
}

const esEnergiaPorNombre = (n) => /^energ[ií]a\b|\benergy$/i.test(String(n || ''))

// Lo que el turno en curso ya ha gastado, leído del registro desde que
// empezó hasta la jugada que se mira. Solo lo que el jugador hace a mano
// (una línea suelta, no la de debajo de una carta): una energía que une
// una habilidad no gasta la de la mano.
export function gastadoEnElTurno(eventos, hasta, jugador, cartaDe = () => null) {
  const flags = { energia: false, partidario: false, estadio: false, retirada: false, atacado: false }
  let inicio = 0
  for (let k = Math.min(hasta, eventos.length) - 1; k >= 0; k--) {
    if (eventos[k].tipo === 'turno') {
      inicio = k
      break
    }
  }
  for (let k = inicio; k < Math.min(hasta, eventos.length); k++) {
    const e = eventos[k]
    if (e.jugador !== jugador || e.sub) continue
    const c = cartaDe(e.carta)
    const cat = plano(c?.category)
    if (e.tipo === 'unir' && (cat.startsWith('energ') || (!c && esEnergiaPorNombre(e.carta)))) flags.energia = true
    if (e.tipo === 'jugar' && ['supporter', 'partidario'].includes(plano(c?.trainer_type))) flags.partidario = true
    if (e.tipo === 'estadio') flags.estadio = true
    if (e.tipo === 'retirar') flags.retirada = true
    if (e.tipo === 'ataque') flags.atacado = true
  }
  return { flags, inicio }
}

// Cuántos turnos lleva cada jugador hasta la jugada `hasta`, quién empezó
// y de quién es el turno. `null` en la preparación: ahí no hay partida
// que seguir, la mesa ni siquiera está puesta.
export function turnosHasta(eventos, hasta) {
  const cuenta = {}
  let primero = null
  let deQuien = null
  let global = 0
  for (let k = 0; k < Math.min(hasta, eventos.length); k++) {
    const e = eventos[k]
    if (e.tipo !== 'turno') continue
    primero ??= e.jugador
    deQuien = e.jugador
    global += 1
    cuenta[e.jugador] = (cuenta[e.jugador] || 0) + 1
  }
  return deQuien ? { cuenta, primero, deQuien, global } : null
}

// Los premios que el registro va a coger ENSEGUIDA, sin que nadie haga
// nada antes: la foto de un KO llega antes que la línea de sus premios. Se
// le dejan a la mesa como pendientes, que es como los cobra el laboratorio
// cuando el KO pasa allí. Se para en la siguiente jugada de verdad, y en el
// siguiente KO (ese lo resuelve el propio motor por la vida, con sus
// premios: contarlos aquí también sería cobrarlos dos veces).
const PARA = new Set(['turno', 'ataque', 'ko', 'jugar', 'usar', 'unir', 'poner', 'evolucionar', 'retirar', 'estadio'])
export function premiosPendientes(eventos, desde) {
  const salida = []
  for (let k = desde; k < eventos.length && !PARA.has(eventos[k].tipo); k++) {
    if (eventos[k].tipo === 'premio' && eventos[k].n > 0) salida.push({ jugador: eventos[k].jugador, n: eventos[k].n })
  }
  return salida
}

// ¿Se puede jugar desde la foto `i`? Con la partida empezada y sin acabar.
export function sePuedeJugarDesde(lectura, fotos, i) {
  if (!lectura || !fotos?.[i] || fotos[i].fin) return false
  return Boolean(turnosHasta(lectura.eventos, i))
}

// Sentar la Mesa del laboratorio en la foto `i`. `mesa.jugadores[k]` juega
// con el mazo de `orden[k]`, y `idDe` dice, por jugador, de qué carta del
// mazo es cada nombre del registro: { [jugador]: idDe } (el de
// `mazosDeLaPosicion`). Devuelve un resumen para contarlo: { turno,
// deQuien, sinVer, pendientes }.
export function colocarPosicion(mesa, { lectura, fotos, i, idDe, cartaDe = () => null }) {
  const s = fotos[i]
  const orden = fotos[0].orden
  const t = turnosHasta(lectura.eventos, i)
  if (!t) throw new Error('La partida aún no ha empezado en esa jugada.')
  const { flags, inicio } = gastadoEnElTurno(lectura.eventos, i, t.deQuien, cartaDe)
  // La foto de cuando empezó el turno: lo que no estaba en juego entonces
  // ha entrado este turno (y no puede evolucionar), y lo que tenía menos
  // cartas encima ha evolucionado ya.
  const alEmpezar = fotos[inicio + 1] || fotos[0]
  const actual = orden.indexOf(t.deQuien)
  const primero = orden.indexOf(t.primero)
  let sinVer = 0
  let estadio = null

  mesa.jugadores.forEach((partida, k) => {
    const nombre = orden[k]
    const p = s.jugadores[nombre]
    const turno = t.cuenta[nombre] || 0
    const st = partida.estadoInicial({ semilla: partida.s.semilla, vaPrimero: k === primero, estricta: partida.s.estricta, rival: null })
    partida.s = st
    st.turno = turno
    st.fase = k === actual ? 'turno' : 'espera'
    if (k === actual) Object.assign(st.flags, flags)

    // Los uids de cada carta, para irlos gastando.
    const libres = new Map()
    for (const uid of partida.uidsPropios) {
      const id = partida.carta(uid)?.id
      if (!libres.has(id)) libres.set(id, [])
      libres.get(id).push(uid)
    }
    let extra = 0
    const tomar = (nombreCarta) => {
      const id = idDe[nombre](nombreCarta)
      const lista = libres.get(id)
      if (lista?.length) return lista.shift()
      // Más copias a la vez de las que se contaron (el registro dice algo
      // que no cuadra): se pone otra de esa misma carta, que es lo que la
      // mesa enseñaba, antes que una «sin ver» donde había un Pokémon.
      const muestra = [...partida.cartas.entries()].find(([u, c]) => partida.uidsPropios.has(u) && c?.id === id)?.[1]
      const carta = muestra || cartaDe(nombreCarta) || cartaSuelta(nombreCarta, 'entrenador')
      const uid = `${partida.prefijo}x${++extra}`
      partida.cartas.set(uid, carta)
      partida.uidsPropios.add(uid)
      return uid
    }
    const antes = alEmpezar.jugadores[nombre]
    const antesPorId = new Map([antes?.activo, ...(antes?.banca || [])].filter(Boolean).map((x) => [x.id, x]))
    const slot = (x) => {
      if (!x) return null
      const viejo = antesPorId.get(x.id)
      return {
        id: `${partida.prefijo}p${++st.seq}`,
        cartas: x.cartas.map(tomar),
        energias: x.energias.map(tomar),
        herramienta: x.herramienta ? tomar(x.herramienta) : null,
        danio: x.danio || 0,
        estados: [],
        // Solo cuenta en el turno de quien juega: al otro le llega su
        // turno siguiente con todo ya «de antes».
        entroTurno: k === actual && !viejo ? turno : 0,
        evolucionoTurno: k === actual && viejo && viejo.cartas.length < x.cartas.length ? turno : -1,
      }
    }
    st.activo = slot(p.activo)
    st.banca = p.banca.map(slot)
    st.descarte = p.descarte.map(tomar)
    const conocida = p.manoConocida.slice(0, p.mano).map(tomar)
    if (s.estadio?.dueno === nombre) estadio = tomar(s.estadio.carta)
    // Lo que queda, barajado con el azar de la partida (así la misma
    // semilla da la misma mesa): premios, la mano que no se conoce, mazo.
    const ocultas = [...libres.values()].flat()
    for (let a = ocultas.length - 1; a > 0; a--) {
      const b = Math.floor(partida.azar() * (a + 1))
      ;[ocultas[a], ocultas[b]] = [ocultas[b], ocultas[a]]
    }
    st.premios = ocultas.splice(0, Math.max(0, p.premios))
    st.mano = [...conocida, ...ocultas.splice(0, Math.max(0, p.mano - conocida.length))]
    st.mazo = ocultas
    st.conocimiento = { arriba: 0, abajo: 0, confirmados: {} }
    sinVer += [...st.mano, ...st.premios, ...st.mazo].filter((u) => partida.carta(u)?.id === SIN_VER.id).length
  })
  for (const partida of mesa.jugadores) partida.s.estadio = estadio

  const pendientes = premiosPendientes(lectura.eventos, i).map((x) => ({ j: orden.indexOf(x.jugador), n: x.n })).filter((x) => x.j >= 0)
  Object.assign(mesa.m, {
    fase: 'juego',
    primero,
    turnoDe: actual,
    preparando: primero,
    listos: [true, true],
    turnoGlobal: t.global,
    pendientes,
    resultado: null,
    monedaInicial: false,
  })
  mesa.historia = []
  return { turno: t.global, deQuien: t.deQuien, sinVer, pendientes: pendientes.length }
}
