import { miResultado, porcentaje, construirMatriz, resumen } from '/home/user/pingu/js/matriz-partidas.js'

// Tanda 230: la matriz de enfrentamientos. Módulo sin DOM ni red, así
// que se prueba entero aquí: la cuenta es lo único que puede estar mal.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El resultado desde MI lado ──')
{
  // Lo que esto evita: una mesa se guarda como «gana A», que no dice
  // nada hasta saber de qué lado estabas. Confundirlo invierte la
  // matriz entera y no lo notaría nadie.
  check('gana A y yo era A → victoria', miResultado('a_wins', true) === 'win')
  check('gana A y yo era B → derrota', miResultado('a_wins', false) === 'loss')
  check('gana B y yo era B → victoria', miResultado('b_wins', false) === 'win')
  check('empate es empate desde los dos lados', miResultado('draw', true) === 'draw' && miResultado('draw', false) === 'draw')
  check('no se presenta A: pierde A', miResultado('forfeit_a', true) === 'loss' && miResultado('forfeit_a', false) === 'win')
  check('no se presentan los dos: pierden los dos', miResultado('forfeit_both', true) === 'loss')
  check('un estado que no es resultado no cuenta', miResultado('active', true) === null)
  // El bye tiene DOS guardias: mis-partidas.js lo filtra antes de
  // llegar aquí, y aquí tampoco se sabe qué es. Cada uno tapa la rotura
  // del otro, así que hay que probar este por separado o no lo vigila
  // nadie — y un bye contado como victoria infla el porcentaje de todo
  // el mundo sin que se note en el número de partidas.
  check('un bye NO es una victoria', miResultado('bye', true) === null)
  check('ni desde el otro lado', miResultado('bye', false) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El porcentaje ──')
{
  check('3 de 4 son 75%', porcentaje({ ganadas: 3, perdidas: 1, empatadas: 0, total: 4 }) === 0.75)
  // El empate vale media victoria, como en el juego real: contarlo como
  // derrota castigaría de más a quien juega mazos de control.
  check('un empate vale media', porcentaje({ ganadas: 1, perdidas: 0, empatadas: 1, total: 2 }) === 0.75)
  // «No he jugado» y «he perdido todas» NO son lo mismo.
  check('sin partidas es null, no 0', porcentaje({ ganadas: 0, perdidas: 0, empatadas: 0, total: 0 }) === null)
  check('todas perdidas sí es 0', porcentaje({ ganadas: 0, perdidas: 3, empatadas: 0, total: 3 }) === 0)
  check('sin casilla, null', porcentaje(null) === null)
}

// ═════════════════════════════════════════════════════════════════════
const P = (mio, rival, resultado, n = 1) =>
  Array.from({ length: n }, () => ({
    mio: `a:${mio}`, mioNombre: mio, rival: `a:${rival}`, rivalNombre: rival, resultado,
  }))

console.log('\n── 3. La matriz ──')
{
  const partidas = [
    ...P('pult', 'gard', 'win', 4),
    ...P('pult', 'gard', 'loss', 1),
    ...P('pult', 'bolt', 'loss', 6),
    ...P('pult', 'bolt', 'win', 1),
    ...P('gard', 'bolt', 'win', 2),
  ]
  const m = construirMatriz(partidas)
  check('una fila por mazo mío', m.filas.length === 2, String(m.filas.length))
  check('la fila más jugada, primero', m.filas[0].nombre === 'pult', m.filas[0].nombre)
  const contraGard = m.filas[0].contra.get('a:gard')
  check('4-1 contra Gardevoir', contraGard.ganadas === 4 && contraGard.perdidas === 1, JSON.stringify(contraGard))
  check('1-6 contra Raging Bolt', m.filas[0].contra.get('a:bolt').perdidas === 6)
  check('el total de la fila suma las dos', m.filas[0].total.total === 12, String(m.filas[0].total.total))

  // Las columnas se ordenan por lo que MÁS te cruzas, que es lo que
  // hace útil la tabla: si salen alfabéticas, lo importante se pierde.
  //
  // OJO con los nombres del ejemplo: si el más cruzado es además el
  // primero alfabéticamente, esta comprobación no distingue las dos
  // ordenaciones y no prueba nada. «zard» va el último por nombre y el
  // primero por partidas, que es justo lo que hace falta.
  const conZard = construirMatriz([
    ...P('pult', 'zard', 'win', 9),
    ...P('pult', 'aggron', 'loss', 2),
  ])
  check('la columna más cruzada va primera, no la alfabética',
    conZard.columnas[0].clave === 'a:zard',
    JSON.stringify(conZard.columnas.map((c) => c.clave)))
}

console.log('\n── 4. Lo que NO puede pasar ──')
{
  check('sin partidas, matriz vacía sin reventar', construirMatriz([]).filas.length === 0)
  check('ni con null', construirMatriz(null).filas.length === 0)
  // Una partida a medio apuntar no puede colarse y descuadrar la cuenta.
  const sucia = construirMatriz([{ mio: 'a:x', rival: null, resultado: 'win' }, ...P('x', 'y', 'win')])
  check('una partida sin rival se descarta', sucia.filas[0].total.total === 1, String(sucia.filas[0].total.total))

  // Renombrar un arquetipo NO puede partir el histórico: agrupa la
  // clave, no el nombre.
  const renombrado = construirMatriz([
    { mio: 'a:pult', mioNombre: 'Dragapult', rival: 'a:g', rivalNombre: 'Gardevoir', resultado: 'win' },
    { mio: 'a:pult', mioNombre: 'Pult Noir', rival: 'a:g', rivalNombre: 'Gardevoir', resultado: 'loss' },
  ])
  check('un cambio de nombre no parte la fila', renombrado.filas.length === 1)
  check('y se lee con el nombre nuevo', renombrado.filas[0].nombre === 'Pult Noir', renombrado.filas[0].nombre)
}

console.log('\n── 5. El resumen de arriba ──')
{
  const m = construirMatriz([
    ...P('pult', 'gard', 'win', 4),
    ...P('pult', 'gard', 'loss', 1),
    ...P('pult', 'bolt', 'loss', 6),
    ...P('pult', 'bolt', 'win', 1),
  ])
  const r = resumen(m)
  check('cuenta todas las partidas', r.total.total === 12, String(r.total.total))
  check('y los mazos', r.mazos === 1)
  check('el mejor enfrentamiento', r.mejor?.rival === 'gard', JSON.stringify(r.mejor?.rival))
  check('y el peor', r.peor?.rival === 'bolt', JSON.stringify(r.peor?.rival))

  // Esto es lo que evita gritar «¡0% contra Charizard!» con UNA partida.
  const conRuido = construirMatriz([...P('pult', 'gard', 'win', 5), ...P('pult', 'zard', 'loss', 1)])
  const r2 = resumen(conRuido, 3)
  check('un enfrentamiento de 1 partida no manda', r2.peor === null || r2.peor.rival !== 'zard', JSON.stringify(r2.peor))
  const r3 = resumen(conRuido, 1)
  check('salvo que se baje el mínimo a propósito', r3.peor?.rival === 'zard', JSON.stringify(r3.peor))
}

console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
