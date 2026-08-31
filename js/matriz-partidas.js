// La matriz de enfrentamientos (tanda 230): «con Dragapult voy 4-1
// contra Gardevoir y 1-6 contra Raging Bolt».
//
// Sin DOM ni red a propósito, como motor.js o arquetipos.js: la cuenta
// es lo único que puede estar mal de verdad aquí, y así se prueba sola.
//
// ── DE DÓNDE SALEN LAS PARTIDAS ──
//
// De dos sitios que NO se guardan igual:
//
//   · Las jugadas EN POKEDOC salen de los torneos, y no se copian a
//     ninguna tabla — se leen de tournament_matches cada vez. Por eso
//     mejoran solas: el día que un admin cataloga un mazo que antes
//     salía deducido, el histórico entero se reagrupa.
//   · Las de FUERA (TCG Live, la tienda) las apunta cada uno en
//     match_log.
//
// Las dos llegan aquí con la misma forma, que es lo que permite
// sumarlas sin distinguirlas.

// El resultado desde MI lado. Una partida de torneo se guarda como
// «gana A» o «gana B», que no dice nada por sí solo: hay que saber de
// qué lado estabas.
export function miResultado(resultadoMesa, soyA) {
  if (resultadoMesa === 'draw') return 'draw'
  if (resultadoMesa === 'a_wins') return soyA ? 'win' : 'loss'
  if (resultadoMesa === 'b_wins') return soyA ? 'loss' : 'win'
  // Las incomparecencias cuentan como partida jugada: el resultado va al
  // casillero igual, porque a efectos de «cómo me fue» ganaste o
  // perdiste. El bye NO — ahí no hubo rival ni enfrentamiento.
  if (resultadoMesa === 'forfeit_a') return soyA ? 'loss' : 'win'
  if (resultadoMesa === 'forfeit_b') return soyA ? 'win' : 'loss'
  if (resultadoMesa === 'forfeit_both') return 'loss'
  return null
}

const VACIO = () => ({ ganadas: 0, perdidas: 0, empatadas: 0, total: 0 })

function sumar(casilla, resultado) {
  if (resultado === 'win') casilla.ganadas++
  else if (resultado === 'loss') casilla.perdidas++
  else if (resultado === 'draw') casilla.empatadas++
  else return
  casilla.total++
}

// El porcentaje de victorias. Los empates cuentan como MEDIA victoria,
// que es como se calcula en el juego real (un empate da la mitad de
// puntos que una victoria) — contarlos como derrota castigaría de más a
// quien juega mazos de control.
//
// Sin partidas devuelve null y no 0: «no he jugado» y «he perdido
// todas» no son lo mismo, y pintarlos igual es mentir.
export function porcentaje(casilla) {
  if (!casilla || !casilla.total) return null
  return (casilla.ganadas + casilla.empatadas * 0.5) / casilla.total
}

// El registro en crudo: cada partida es { mio, mioNombre, rival,
// rivalNombre, resultado, fecha, donde }. Devuelve la matriz agrupada.
export function construirMatriz(partidas) {
  const filas = new Map() // clave de mi mazo → { nombre, contra: Map, total }
  const nombresRival = new Map()

  for (const p of partidas || []) {
    if (!p?.mio || !p?.rival || !p?.resultado) continue
    if (!filas.has(p.mio)) filas.set(p.mio, { clave: p.mio, nombre: p.mioNombre || p.mio, contra: new Map(), total: VACIO() })
    const fila = filas.get(p.mio)
    // El nombre más reciente manda: si a un arquetipo le cambian el
    // nombre en el catálogo, el histórico se lee con el nombre nuevo.
    if (p.mioNombre) fila.nombre = p.mioNombre
    if (p.rivalNombre) nombresRival.set(p.rival, p.rivalNombre)

    if (!fila.contra.has(p.rival)) fila.contra.set(p.rival, VACIO())
    sumar(fila.contra.get(p.rival), p.resultado)
    sumar(fila.total, p.resultado)
  }

  // Las columnas: todos los mazos rivales vistos, los más jugados
  // primero. Es el orden que hace útil la tabla — lo que más te cruzas
  // es lo que más te importa.
  const vecesRival = new Map()
  for (const fila of filas.values()) {
    for (const [clave, c] of fila.contra) vecesRival.set(clave, (vecesRival.get(clave) || 0) + c.total)
  }
  const columnas = [...vecesRival.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([clave]) => ({ clave, nombre: nombresRival.get(clave) || clave }))

  return {
    filas: [...filas.values()].sort((a, b) => b.total.total - a.total.total || a.nombre.localeCompare(b.nombre)),
    columnas,
  }
}

// El resumen de arriba: cuántas partidas hay, cuántos mazos distintos, y
// los enfrentamientos donde mejor y peor se te da.
//
// `minimo` existe para no gritar «¡0% contra Charizard!» con UNA partida
// perdida. Con pocas partidas el porcentaje no dice nada, y una tabla
// que presume de datos que no tiene enseña a desconfiar de ella.
export function resumen(matriz, minimo = 3) {
  const total = VACIO()
  const enfrentamientos = []
  for (const fila of matriz.filas) {
    total.ganadas += fila.total.ganadas
    total.perdidas += fila.total.perdidas
    total.empatadas += fila.total.empatadas
    total.total += fila.total.total
    for (const [clave, casilla] of fila.contra) {
      if (casilla.total < minimo) continue
      enfrentamientos.push({
        mio: fila.nombre,
        rival: matriz.columnas.find((c) => c.clave === clave)?.nombre || clave,
        casilla,
        ratio: porcentaje(casilla),
      })
    }
  }
  enfrentamientos.sort((a, b) => b.ratio - a.ratio || b.casilla.total - a.casilla.total)
  return {
    total,
    mazos: matriz.filas.length,
    mejor: enfrentamientos[0] || null,
    peor: enfrentamientos.length > 1 ? enfrentamientos[enfrentamientos.length - 1] : null,
  }
}
