// La partida de la mesa escrita como la escribe JCC Pokémon Live (tanda 592).
//
// PINGU: «estaría muy bien poder copiar el log de una partida que juegues
// tú contra ti mismo: que al final te deje copiar el log de eso para
// guardar la repetición».
//
// El registro del laboratorio es para leerlo en la mesa («Unes Energía
// Psíquica a Dreepy.»); /repeticiones lee el de TCG Live («Rojo ha unido
// Energía Psíquica Básica al Dreepy en la Banca.»). Este módulo escribe el
// segundo, y lo escribe con las frases que entiende repeticiones/registro.js
// —que es la prueba: lo que sale de aquí se lee entero, sin «líneas sin
// entender», y la mesa de la repetición acaba igual que la del laboratorio.
//
// Cómo: la mesa hace una FOTO de dónde está cada carta al empezar cada
// jugada, y al acabarla compara (`lineasDeLaJugada`). Lo que se ha movido
// sale de la comparación —así un efecto nuevo queda contado sin tocar este
// fichero—; lo que la comparación no puede saber (qué carta se JUGÓ, qué
// ataque, cuánto daño hizo a uno que ya no está) lo apunta el motor al
// pasar (`cabeceras` y `golpes`).
//
// Las manos de los dos se escriben enteras: en «tú contra ti» las dos son
// tuyas, y así la repetición se ve con las dos manos boca arriba.
//
// Sin DOM: se prueba en Node.
import { nombreVisible, esEnergiaBasica } from './nucleo.js'

// ── Los nombres ──

// Un nombre de jugador de TCG Live es UNA palabra (registro.js parte las
// frases sabiendo eso): «Jugador 1» → «Jugador1».
export function nombresParaElRegistro(nombres) {
  const out = []
  nombres.forEach((n, i) => {
    let x = String(n || '').normalize('NFC').replace(/\s+/g, '').replace(/[.,!¡?¿'"]/g, '')
    if (!x || out.includes(x)) x = `Jugador${i + 1}`
    out.push(x)
  })
  return out
}

// El nombre de una carta como lo escribe TCG Live: las energías básicas
// llevan «Básica» detrás («Energía Psíquica Básica»).
export function nombreEnElRegistro(carta) {
  const n = nombreVisible(carta) || '?'
  if (esEnergiaBasica(carta) && /^Energía /i.test(n) && !/Básica$/i.test(n)) return `${n} Básica`
  return n
}

// ── La foto ──
//
// De cada jugador: dónde está cada carta suya (`donde`: uid → { z, slot, k })
// y cómo está cada Pokémon en juego. `z`: mano, mazo, descarte, premios,
// perdida, estadio o slot (con `k`: c = el Pokémon y lo de debajo, e =
// energía, h = herramienta).
export function fotoDeMesa(mesa) {
  return mesa.jugadores.map((p) => {
    const s = p.s
    const donde = new Map()
    const pon = (lista, z) => (lista || []).forEach((u) => donde.set(u, { z }))
    pon(s.mano, 'mano')
    pon(s.mazo, 'mazo')
    pon(s.descarte, 'descarte')
    pon(s.premios, 'premios')
    pon(s.perdida, 'perdida')
    pon(s.jugando, 'jugando')
    if (s.estadio && p.uidsPropios.has(s.estadio)) donde.set(s.estadio, { z: 'estadio' })
    const slots = new Map()
    for (const sl of [s.activo, ...s.banca].filter(Boolean)) {
      sl.cartas.forEach((u) => donde.set(u, { z: 'slot', slot: sl.id, k: 'c' }))
      sl.energias.forEach((u) => donde.set(u, { z: 'slot', slot: sl.id, k: 'e' }))
      if (sl.herramienta) donde.set(sl.herramienta, { z: 'slot', slot: sl.id, k: 'h' })
      slots.set(sl.id, { id: sl.id, cartas: [...sl.cartas], energias: [...sl.energias], herramienta: sl.herramienta, danio: sl.danio })
    }
    return { donde, slots, activo: s.activo?.id || null, mano: [...s.mano], mazo: [...s.mazo] }
  })
}

// ── La jugada ──
//
// `antes` y `despues`: fotos. `nombres`: los dos, ya en una palabra.
// `carta(uid)`: la carta. `cabeceras`: lo que el motor ha apuntado
// ({ k: 'jugar' | 'habilidad' | 'ataque' | 'retirar', i, … }). `golpes`:
// el daño que ha hecho ({ de, a, slot, uid, cantidad, contadores }).
// Devuelve las líneas, con «- » delante las que cuelgan de la de antes y
// «   • » las listas de cartas.
export function lineasDeLaJugada(antes, despues, { nombres, carta, cabeceras = [], golpes = [] }) {
  const nom = (u) => nombreEnElRegistro(carta(u))
  const lista = (us) => `   • ${us.map(nom).join(', ')}`
  const arribaDe = (sl) => sl?.cartas[sl.cartas.length - 1]
  const dondeSlot = (foto, id) => (foto.activo === id ? 'en el Puesto Activo' : 'en la Banca')
  // «al Dreepy en la Banca»: con el nombre del Pokémon tal como está AHORA.
  const pokemonDe = (foto, id) => nom(arribaDe(foto.slots.get(id)))

  const cabezas = []
  const primarias = []
  const subs = []
  const kos = []
  const premios = []
  const activos = []
  const usados = new Set() // las cartas que ya cuenta una cabecera

  // Las cabeceras, en el orden en que pasaron. `delAtaque`: el daño que ya
  // cuenta la línea del ataque, por Pokémon (no se vuelve a contar abajo).
  const yaGolpeado = new Set()
  const delAtaque = new Map()
  for (const c of cabeceras) {
    const J = nombres[c.i]
    if (c.k === 'jugar') {
      const d = despues[c.i].donde.get(c.uid)
      // Un estadio o una herramienta se cuentan con su propia frase.
      if (d?.z === 'estadio' || d?.z === 'slot') continue
      cabezas.push(`${J} ha jugado ${nom(c.uid)}.`)
      usados.add(c.uid)
    } else if (c.k === 'habilidad') {
      cabezas.push(`El ${nom(c.uid)} de ${J} ha usado ${c.nombre}.`)
    } else if (c.k === 'retirar') {
      cabezas.push(`${J} ha retirado a ${nom(c.uid)} a la Banca.`)
    } else if (c.k === 'ataque') {
      const O = 1 - c.i
      const alActivo = golpes.filter((g, n) => g.de === c.i && g.a === O && g.slot === c.objetivo && !g.contadores && !yaGolpeado.has(n))
      golpes.forEach((g, n) => alActivo.includes(g) && yaGolpeado.add(n))
      const danio = alActivo.reduce((t, g) => t + g.cantidad, 0)
      if (danio > 0) delAtaque.set(c.objetivo, (delAtaque.get(c.objetivo) || 0) + danio)
      const objetivo = alActivo[0]?.uid || (c.objetivoUid ?? null)
      if (danio > 0 && objetivo) cabezas.push(`El ${nom(c.uid)} de ${J} ha infligido ${danio} puntos de daño usando ${c.ataque} contra el ${nom(objetivo)} de ${nombres[O]}.`)
      else cabezas.push(`El ${nom(c.uid)} de ${J} ha usado ${c.ataque}.`)
    }
  }

  for (const i of [0, 1]) {
    const J = nombres[i]
    const A = antes[i]
    const D = despues[i]
    const robadas = []
    const recuperadas = []
    const descartadas = []
    const aMazo = []
    const aBanca = []
    const premiosCogidos = []
    for (const [u, d] of D.donde) {
      const a = A.donde.get(u)
      if (!a) continue
      const mismo = a.z === d.z && a.slot === d.slot && a.k === d.k
      if (mismo || usados.has(u)) continue
      const nuevoSlot = d.z === 'slot' && !A.slots.has(d.slot)
      if (d.z === 'mano') {
        if (a.z === 'mazo') robadas.push(u)
        else if (a.z === 'premios') premiosCogidos.push(u)
        else if (a.z === 'descarte') recuperadas.push(u)
        else if (a.z === 'slot' && !D.slots.has(a.slot)) continue // un Pokémon entero a la mano: abajo
        else recuperadas.push(u)
      } else if (d.z === 'descarte') {
        if (a.z === 'mano') descartadas.push(u)
        else if (a.z === 'slot' && D.slots.has(a.slot) && a.k !== 'c') subs.push(...conLugar(`Se ha descartado ${nom(u)} del ${pokemonDe(D, a.slot)} de ${J}.`, lugarEntre(ordenDe(D), D, a.slot, nom)))
        // Lo de un Pokémon que ha caído o se ha ido entero va con él.
      } else if (d.z === 'mazo') {
        if (a.z === 'mano') aMazo.push(u)
        else if (a.z === 'slot' && !D.slots.has(a.slot)) continue
        else if (a.z === 'descarte') aMazo.push(u)
      } else if (d.z === 'estadio' && a.z === 'mano') {
        primarias.push(`${J} ha puesto en juego la carta de Estadio ${nom(u)}.`)
      } else if (d.z === 'slot' && d.k === 'c') {
        if (nuevoSlot) {
          // El Pokémon de abajo del todo de un sitio nuevo: entra en juego.
          if (D.slots.get(d.slot).cartas[0] !== u) continue
          if (a.z === 'mano') primarias.push(`${J} ha puesto en juego a ${nom(u)} ${D.activo === d.slot ? 'en el Puesto Activo' : 'en la Banca'}.`)
          else aBanca.push(u)
        } else {
          const debajo = A.slots.get(d.slot)
          const linea = conLugar(`${J} ha hecho que el ${nom(arribaDe(debajo))} ${A.activo === d.slot ? 'del Puesto Activo' : 'en Banca'} evolucione a ${nom(u)}.`, lugarEntre(ordenDe(A), A, d.slot, nom))
          if (a.z === 'mano') primarias.push(...linea)
          else subs.push(...linea)
        }
      } else if (d.z === 'slot') {
        const linea = conLugar(`${J} ha unido ${nom(u)} al ${pokemonDe(D, d.slot)} ${dondeSlot(D, d.slot)}.`, lugarEntre(ordenDe(D), D, d.slot, nom))
        if (a.z === 'mano') primarias.push(...linea)
        else {
          // De dónde sale: la repetición, sin esto, la saca del descarte si
          // hay una igual ahí (Más PP de N) aunque viniera de la baraja.
          subs.push(...linea)
          if (a.z === 'mazo') subs.push('   ◦ de la baraja')
          else if (a.z === 'descarte') subs.push('   ◦ del descarte')
        }
      }
    }

    // Lo que vuelve de la mano a la baraja va ANTES de robar: si no, la
    // repetición metería en el mazo también lo que se acaba de robar (Lylia,
    // Juez, Iono: barajas la mano y robas).
    const delante = []
    const manoQueQueda = A.mano.filter((u) => !usados.has(u))
    if (aMazo.length && aMazo.every((u) => A.donde.get(u)?.z === 'mano')) {
      if (manoQueQueda.length && manoQueQueda.every((u) => aMazo.includes(u))) delante.push(`${J} ha barajado su mano con su baraja.`)
      else delante.push(`${J} ha puesto ${aMazo.length === 1 ? 'una carta' : `${aMazo.length} cartas`} en su baraja y ha barajado todas las cartas.`, lista(aMazo))
      aMazo.length = 0
    }
    // Lo que ha robado o le ha llegado del mazo a la mano.
    if (robadas.length) {
      if (robadas.length === 1) delante.push(`${J} ha robado ${nom(robadas[0])}.`)
      else delante.push(`${J} ha robado ${robadas.length} cartas.`, lista(robadas))
    }
    subs.unshift(...delante)
    if (descartadas.length) {
      if (descartadas.length === 1) subs.push(`${J} ha descartado ${nom(descartadas[0])}.`)
      else subs.push(`${J} ha descartado ${descartadas.length} cartas.`, lista(descartadas))
    }
    // Del descarte a la mano, una línea por carta: «ha movido Dreepy de J a
    // su mano» la lee la repetición como un Pokémon EN JUEGO que vuelve
    // entero si hay un Dreepy solo en la banca (Ciclón Levante).
    for (const u of recuperadas) subs.push(`Se ha añadido ${nom(u)} a la mano de ${J}.`)
    if (aBanca.length) {
      if (aBanca.length === 1) subs.push(`${J} ha robado ${nom(aBanca[0])} y lo ha puesto en juego en la Banca.`)
      else subs.push(`${J} ha robado ${aBanca.length} cartas y las ha puesto en juego en la Banca.`, lista(aBanca))
    }
    if (aMazo.length) {
      // Del descarte (o de varios sitios) a la baraja, con su lista.
      subs.push(`${J} ha puesto ${aMazo.length === 1 ? 'una carta' : `${aMazo.length} cartas`} en su baraja y ha barajado todas las cartas.`, lista(aMazo))
    } else if (barajada(A, D)) {
      subs.push(`${J} ha barajado su baraja.`)
    }

    // Los Pokémon que ya no están: fuera de combate (al descarte) o enteros
    // a la mano o a la baraja.
    for (const [id, sl] of A.slots) {
      if (D.slots.has(id)) continue
      const todas = [...sl.cartas, ...sl.energias, ...(sl.herramienta ? [sl.herramienta] : [])]
      const zona = D.donde.get(arribaDe(sl))?.z
      if (zona === 'descarte') kos.push(...conLugar(`¡El ${nom(arribaDe(sl))} de ${J} ha quedado Fuera de Combate!`, lugarEntre(ordenDe(A), A, id, nom)))
      else if (zona === 'mano') subs.push(`${J} ha movido ${todas.length} cartas de ${J} a su mano.`, lista(todas))
      else if (zona === 'mazo') subs.push(`${J} ha puesto ${todas.length} cartas en su baraja y ha barajado todas las cartas.`, lista(todas))
    }

    if (premiosCogidos.length) {
      premios.push(`${J} ha cogido ${premiosCogidos.length === 1 ? 'una carta' : `${premiosCogidos.length} cartas`} de Premio.`)
      for (const u of premiosCogidos) premios.push(`Se ha añadido ${nom(u)} a la mano de ${J}.`)
    }

    // Quién está de activo.
    if (A.activo && D.activo && A.activo !== D.activo && A.slots.has(D.activo)) {
      const sube = nom(arribaDe(D.slots.get(D.activo)))
      const retiro = cabeceras.some((c) => c.k === 'retirar' && c.i === i)
      // Contados como estarán en la repetición al leer la línea: sin los que
      // han caído, y el que se retira, al final de la banca.
      const vivos = ordenDe(A).filter((k) => D.slots.has(k))
      if (!D.slots.has(A.activo)) activos.push(...conLugar(`El ${sube} de ${J} pasa a estar en el Puesto Activo.`, lugarEntre(vivos, A, D.activo, nom)))
      else if (retiro) activos.push(...conLugar(`El ${sube} de ${J} pasa a estar en el Puesto Activo.`, lugarEntre([...vivos.filter((k) => k !== A.activo), A.activo], A, D.activo, nom)))
      else activos.push(...conLugar(`El ${sube} de ${J} se ha intercambiado con el ${nom(arribaDe(A.slots.get(A.activo)))} de ${J} y pasa a ser el Pokémon Activo.`, lugarEntre(vivos, A, D.activo, nom)))
    }
  }

  // El daño que no cuenta la línea del ataque (a la banca, contadores, el
  // Chequeo, el que se mueve de un Pokémon a otro) y lo que se cura: de la
  // comparación, Pokémon a Pokémon. Así cuenta también lo que un efecto
  // pone o quita sin pasar por el motor de daño.
  for (const i of [0, 1]) {
    const A = antes[i]
    const D = despues[i]
    for (const [id, sl] of D.slots) {
      const a = A.slots.get(id)
      if (!a) {
        // Uno que acaba de entrar y ya trae daño (Ruinas Arriesgadas).
        if (sl.danio > 0) subs.push(...conLugar(`El ${nom(arribaDe(sl))} de ${nombres[i]} ha recibido ${sl.danio} puntos de daño.`, lugarEntre(ordenDe(D), D, id, nom)))
        continue
      }
      const delta = sl.danio - a.danio - (delAtaque.get(id) || 0)
      if (delta > 0) subs.push(...conLugar(`El ${nom(arribaDe(sl))} de ${nombres[i]} ha recibido ${delta} puntos de daño.`, lugarEntre(ordenDe(D), D, id, nom)))
      else if (delta < 0) subs.push(...conLugar(`El ${nom(arribaDe(sl))} de ${nombres[i]} se ha curado ${-delta} puntos de daño.`, lugarEntre(ordenDe(D), D, id, nom)))
    }
  }

  // Colgar de la primera: lo que pasa por una carta o un ataque va con «- ».
  const hayPadre = cabezas.length || primarias.length
  const conGuion = (l) => (/^\s+[•◦]/.test(l) || !hayPadre ? l : `- ${l}`)
  // La habilidad de un Pokémon que acaba de ENTRAR o de evolucionar (Meowth
  // ex al bajarlo) va después de la línea que lo pone en juego.
  const recien = cabeceras.filter((c) => c.k === 'habilidad' && cambioDeSitio(antes[c.i], despues[c.i], c.uid)).map((c) => `El ${nom(c.uid)} de ${nombres[c.i]} ha usado ${c.nombre}.`)
  const primero = cabezas.filter((l) => !recien.includes(l))
  return [...primero, ...primarias, ...recien, ...subs.map(conGuion), ...kos, ...premios, ...activos]
}

// Con dos Pokémon que se llaman igual, CUÁL: el registro de TCG Live no lo
// dice («al Dreepy en la Banca»), y la repetición se quedaba con el primero.
// Detrás de la línea va «   ◦ lugar N»: el N-ésimo de los que se llaman así,
// contados como los cuenta la repetición (activo y luego la banca, en su
// orden). TCG Live no escribe nunca «◦», así que no choca con nada suyo.
function lugarEntre(orden, foto, id, nom) {
  const nombre = nom(foto.slots.get(id)?.cartas.at(-1))
  const iguales = orden.filter((k) => foto.slots.has(k) && nom(foto.slots.get(k).cartas.at(-1)) === nombre)
  return iguales.length > 1 ? iguales.indexOf(id) + 1 : 0
}
const ordenDe = (foto) => [...foto.slots.keys()]
const conLugar = (linea, n) => (n > 0 ? [linea, `   ◦ lugar ${n}`] : [linea])

// ¿Ha cambiado de sitio esta carta en la jugada?
function cambioDeSitio(A, D, u) {
  const a = A.donde.get(u)
  const d = D.donde.get(u)
  return Boolean(a && d && (a.z !== d.z || a.slot !== d.slot))
}

// ¿Se ha BARAJADO el mazo? No es lo mismo que cambiar de orden: mirar las
// de arriba y poner una debajo (Drakloak) mueve cartas al fondo sin barajar,
// y decir «ha barajado» ahí sería inventarse una jugada.
function barajada(A, D) {
  const quedan = new Set(D.mazo)
  const comunes = A.mazo.filter((u) => quedan.has(u))
  const ahora = D.mazo.filter((u) => A.donde.get(u)?.z === 'mazo')
  if (comunes.length < 2 || comunes.every((u, k) => u === ahora[k])) return false
  // Algunas al fondo (o arriba) y el resto en su orden: no es barajar.
  for (let k = 1; k <= Math.min(6, ahora.length - 1); k++) {
    const fondo = new Set(ahora.slice(ahora.length - k))
    const resto = comunes.filter((u) => !fondo.has(u))
    if (resto.every((u, i) => u === ahora[i])) return false
    const encima = new Set(ahora.slice(0, k))
    const resto2 = comunes.filter((u) => !encima.has(u))
    if (resto2.every((u, i) => u === ahora[k + i])) return false
  }
  return true
}

// ── La preparación ──
//
// La moneda, las manos (con los mulligans enseñados, como el juego) y quién
// empieza. Las cartas de más por los mulligans y lo que se pone en juego
// las escribe la mesa al hacerlas (Mesa.empezar).
export function lineasDePreparacion(mesa, nombres) {
  const nom = (u) => nombreEnElRegistro(mesa.cartas.get(u))
  const lista = (us) => `   • ${us.map(nom).join(', ')}`
  const primero = mesa.m.primero
  const out = ['Preparación']
  if (mesa.m.monedaInicial) {
    out.push(`${nombres[1 - primero]} ha elegido cara para el lanzamiento de moneda inicial.`)
    out.push(`${nombres[primero]} ha ganado el lanzamiento de moneda.`)
  }
  out.push(`${nombres[primero]} ha decidido empezar en primer lugar.`)
  mesa.jugadores.forEach((p, i) => {
    const J = nombres[i]
    for (const [k, mano] of (p.s.manosMulligan || []).entries()) {
      if (k === 0) out.push(`${J} ha robado 7 cartas de la mano inicial.`, '- 7 cartas robadas.', lista(mano))
      out.push(`${J} ha declarado un mulligan.`, `- Cartas mostradas por el mulligan número ${k + 1}`, lista(mano))
    }
    // La mano que robó: la de ahora y lo que ya ha puesto en juego.
    const colocadas = [p.s.activo, ...p.s.banca].filter(Boolean).flatMap((sl) => sl.cartas)
    out.push(`${J} ha robado 7 cartas de la mano inicial.`, '- 7 cartas robadas.', lista([...colocadas, ...p.s.mano]))
  })
  return out
}

// Lo que cada uno ha puesto en juego en la preparación.
export function lineasDeColocar(mesa, nombres) {
  const nom = (u) => nombreEnElRegistro(mesa.cartas.get(u))
  const out = []
  mesa.jugadores.forEach((p, i) => {
    if (p.s.activo) out.push(`${nombres[i]} ha puesto en juego a ${nom(p.s.activo.cartas[0])} en el Puesto Activo.`)
    for (const sl of p.s.banca) out.push(`${nombres[i]} ha puesto en juego a ${nom(sl.cartas[0])} en la Banca.`)
  })
  return out
}

// El final: TCG Live empieza por la razón y acaba con quién gana.
export function lineaDelFinal(mesa, nombres) {
  const r = mesa.m.resultado
  if (!r || r.ganador == null || r.ganador < 0) return null
  const G = nombres[r.ganador]
  const perdedor = mesa.jugadores[1 - r.ganador]
  if (!mesa.jugadores[r.ganador].s.premios.length) return `Todas las cartas de Premio cogidas. ${G} ha ganado.`
  if (!perdedor.enJuego.length) return `${nombres[1 - r.ganador]} no tiene Pokémon en juego. ${G} ha ganado.`
  if (!perdedor.s.mazo.length) return `${nombres[1 - r.ganador]} no puede robar ninguna carta. ${G} ha ganado.`
  return `La partida ha terminado. ${G} ha ganado.`
}
