// Lo que se cuenta de una partida (tanda 492): los MOMENTOS que merece la
// pena volver a ver y los NÚMEROS de cada jugador.
//
// PINGU, de la lista de ideas: «marcas en el deslizador para cada KO,
// premio y ataque gordo, y un botón de "siguiente KO"» y «la carrera de
// premios turno a turno, el daño total de cada uno, las cartas más jugadas
// y quién robó más». Todo sale de lo que ya hay: los eventos del registro
// (registro.js) y las fotos de la mesa (estado.js). Sin DOM: se prueba en
// Node.

const esEnergia = (n) => /^energ[ií]a\b|\benergy$/i.test(String(n || ''))

// El golpe que merece marca aunque no tumbe a nadie. 200 es lo que hace un
// ex de los gordos de un solo ataque; lo que tumba ya va como KO.
export const GOLPE_GORDO = 200

// En qué turno cae cada evento (0 = la preparación).
function turnos(eventos) {
  let t = 0
  return eventos.map((e) => (e.tipo === 'turno' ? ++t : t))
}

const otro = (orden, j) => orden.find((n) => n !== j)

// Los momentos, en orden. Cada uno: { foto, turno, tipo, ... }.
//   · 'ko': uno o varios Pokémon que caen JUNTOS (el doble KO de Picado
//     Fantasma es un momento, no dos), con el ataque que los tumbó si lo
//     hubo —la foto es la del GOLPE: se ve venir y luego caer— y los
//     premios que se cogen por ellos.
//   · 'golpe': un ataque de GOLPE_GORDO o más que no tumba a nadie.
//   · 'fin': quién gana y por qué.
export function momentosDe(lectura, fotos) {
  const ev = lectura?.eventos || []
  const orden = fotos?.[0]?.orden || lectura?.jugadores || []
  const t = turnos(ev)
  const out = []
  const causantes = new Set()
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i]
    if (e.tipo === 'ko') {
      // Los KO seguidos (con los descartes de lo que llevaban entre medias)
      // son el mismo momento.
      const caidos = []
      let j = i
      while (j < ev.length && ['ko', 'descartarTodoDe', 'descartarDe'].includes(ev[j].tipo)) {
        if (ev[j].tipo === 'ko') caidos.push({ pokemon: ev[j].pokemon, jugador: ev[j].jugador })
        j++
      }
      // Los premios que se cogen por ellos: lo siguiente, antes de que pase
      // otra cosa de peso.
      let premios = null
      for (let k = j; k < ev.length && !['turno', 'ataque', 'ko'].includes(ev[k].tipo); k++) {
        if (ev[k].tipo === 'premio') {
          premios = { jugador: ev[k].jugador, n: ev[k].n }
          break
        }
      }
      // El golpe que los tumbó: el último ataque de este mismo turno, si no
      // ha tumbado ya a otro antes.
      let golpe = null
      for (let k = i - 1; k >= 0 && t[k] === t[i] && ev[k].tipo !== 'ko'; k--) {
        if (ev[k].tipo === 'ataque') {
          golpe = k
          break
        }
      }
      if (golpe != null) causantes.add(golpe)
      const g = golpe != null ? ev[golpe] : null
      out.push({
        foto: (golpe ?? i) + 1,
        turno: t[i],
        tipo: 'ko',
        victima: caidos[0].jugador,
        jugador: g?.jugador || premios?.jugador || otro(orden, caidos[0].jugador),
        caidos: caidos.map((c) => c.pokemon),
        danio: g?.danio || null,
        ataque: g?.ataque || null,
        premios,
      })
      i = j - 1
    }
  }
  ev.forEach((e, i) => {
    if (e.tipo === 'ataque' && e.danio >= GOLPE_GORDO && !causantes.has(i)) {
      out.push({ foto: i + 1, turno: t[i], tipo: 'golpe', jugador: e.jugador, victima: e.deQuien, danio: e.danio, ataque: e.ataque, pokemon: e.pokemon, objetivo: e.objetivo })
    }
    if (e.tipo === 'fin') out.push({ foto: i + 1, turno: t[i], tipo: 'fin', jugador: e.ganador, porque: e.porque || null })
  })
  return out.sort((a, b) => a.foto - b.foto)
}

// El siguiente KO DESPUÉS de la foto `i` (o null).
export const siguienteKo = (momentos, i) => momentos.find((m) => m.tipo === 'ko' && m.foto > i) || null

// Los números de cada jugador y la carrera de premios.
export function numerosDe(lectura, fotos) {
  const ev = lectura?.eventos || []
  const orden = fotos?.[0]?.orden || lectura?.jugadores || []
  const t = turnos(ev)
  const por = {}
  for (const n of orden) por[n] = { danio: 0, golpeMax: null, kos: 0, premios: 0, robadas: 0, jugadas: 0, energias: 0, evoluciones: 0, retiradas: 0, cartas: new Map() }
  const sumaDanio = (j, d, extra = null) => {
    const p = por[j]
    if (!p || !d) return
    p.danio += d
    if (extra && (!p.golpeMax || d > p.golpeMax.danio)) p.golpeMax = { danio: d, ...extra }
  }
  const jugada = (j, carta) => {
    const p = por[j]
    if (!p || !carta) return
    p.jugadas += 1
    p.cartas.set(carta, (p.cartas.get(carta) || 0) + 1)
  }
  ev.forEach((e, i) => {
    const despues = fotos?.[i + 1]
    switch (e.tipo) {
      case 'ataque':
        sumaDanio(e.jugador, e.danio, { ataque: e.ataque, pokemon: e.pokemon, foto: i + 1, turno: t[i] })
        break
      case 'contadores':
        // `jugador` es SIEMPRE quien los pone (en las dos formas del
        // registro), aunque la línea le cambie el dueño al que los recibe.
        sumaDanio(e.jugador, e.n * 10)
        break
      case 'danio':
        // «El X de J ha recibido 120»: lo hace el que NO es J.
        sumaDanio(otro(orden, e.jugador), e.danio)
        break
      case 'ko': {
        const quien = otro(orden, e.jugador)
        if (por[quien]) por[quien].kos += 1
        break
      }
      case 'pasaActivo': {
        // Un KO que el registro no escribe y la mesa deduce de la vida
        // (estado.js): el activo de antes deja la mesa sin línea de KO.
        const viejo = fotos?.[i]?.jugadores[e.jugador]?.activo
        const queda = despues?.jugadores[e.jugador]
        if (viejo && queda && ![queda.activo, ...queda.banca].some((x) => x?.id === viejo.id)) {
          const quien = otro(orden, e.jugador)
          if (por[quien]) por[quien].kos += 1
        }
        break
      }
      case 'premio':
        if (por[e.jugador]) por[e.jugador].premios += e.n
        break
      case 'robar':
        if (por[e.jugador]) por[e.jugador].robadas += e.cartas?.length || e.n || 1
        break
      case 'jugar':
        // Usar el estadio o la habilidad de uno en juego no es JUGAR una
        // carta (estado.js lo distingue al aplicarlo).
        if (despues?.foco?.tipo === 'jugar' && !despues.foco.estadio) jugada(e.jugador, e.carta)
        break
      case 'estadio':
        jugada(e.jugador, e.carta)
        break
      case 'unir':
        if (esEnergia(e.carta) && por[e.jugador]) por[e.jugador].energias += 1
        break
      case 'evolucionar':
        if (por[e.jugador]) por[e.jugador].evoluciones += 1
        break
      case 'retirar':
        if (por[e.jugador]) por[e.jugador].retiradas += 1
        break
      default:
        break
    }
  })
  // Lo que más jugó cada uno, de más a menos (y por nombre si empatan).
  for (const n of orden) {
    por[n].masJugadas = [...por[n].cartas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([carta, veces]) => ({ carta, veces }))
    delete por[n].cartas
  }
  // La carrera: los premios que le QUEDAN a cada uno al acabar cada turno.
  // El punto 0 es el principio (seis cada uno).
  const carrera = [{ turno: 0, de: null, premios: Object.fromEntries(orden.map((n) => [n, 6])) }]
  const inicios = []
  ev.forEach((e, i) => e.tipo === 'turno' && inicios.push(i + 1))
  inicios.forEach((ini, k) => {
    const fin = k + 1 < inicios.length ? inicios[k + 1] - 1 : (fotos?.length || 1) - 1
    const s = fotos?.[fin]
    if (!s) return
    carrera.push({ turno: k + 1, de: s.deQuien, premios: Object.fromEntries(orden.map((n) => [n, s.jugadores[n]?.premios ?? 6])) })
  })
  return { jugadores: orden, por, carrera, turnos: inicios.length }
}
