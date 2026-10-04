// Tanda 536 — tres correcciones de PINGU sobre lo que hice yo.
//
// 1. «Las POP Series tienen que ir en una era. Es como si fuese una era:
//    todas las expansiones de POP pueden ir juntas».
// 2. «He visto que me han sacado el Classic Collection del 30 aniversario,
//    ¿por qué?» — lo plegó la 347 porque él mismo dijo que eran el mismo
//    set, y esta mañana dijo lo contrario: que el Classic debe ir DESPUÉS
//    del Celebration. Manda lo último.
// 3. «¿Qué has hecho con las Trainer Gallery?» — las plegué dentro de su
//    set por mi cuenta en la 534, y nadie lo había pedido. Vuelven.
//
// LA LECCIÓN, que es la misma dos veces: **plegar una colección no es un
// detalle técnico, es una decisión de quien manda el catálogo**. Lo que yo
// puedo arreglar solo es un DUPLICADO —la misma colección dos veces con dos
// identificadores—, que eso no es una opinión.
import { readFileSync } from 'node:fs'
import {
  padreDeColeccion, esEraDeclarada, reglasQueNoCasan, SERIES_QUE_SON_ERA, esUnaEra,
} from '/home/user/pingu/js/catalogo-series.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Las POP son una ERA ──')
{
  const POP = [
    { id: 'np', name: 'Nintendo Black Star Promos', serie_name: 'POP', card_count_total: 40 },
    { id: 'pop1', name: 'POP Series 1', serie_name: 'POP', card_count_total: 17 },
    { id: 'pop9', name: 'POP Series 9', serie_name: 'POP', card_count_total: 17 },
  ]
  check('la serie está declarada', esEraDeclarada(POP[0]), JSON.stringify(SERIES_QUE_SON_ERA))
  check('y vale igual por `serie_id`', esEraDeclarada({ serie_id: 'pop' }))
  check('ES una era aunque ningún set llegue a 100 cartas', esUnaEra(POP) === true)
  // Y lo de siempre sigue: una era de verdad lo es por su tamaño.
  check('un set grande sigue haciendo era', esUnaEra([{ card_count_total: 160 }]) === true)
  check('y una colección suelta pequeña, no', esUnaEra([{ name: 'Jumbo', card_count_total: 12 }]) === false)
  // En la ESTANTERÍA salían al fondo por el nombre: «pop series» estaba en
  // la lista de nombres especiales y por eso no se agrupaban.
  const est = readFileSync('/home/user/pingu/js/mi-coleccion/estanteria.js', 'utf8')
  check('la estantería ya no las manda al fondo', !/\bpop series\b/i.test(est.split('NOMBRES_ESPECIALES')[1].split('\n')[1] || ''))
  check('  …pero los trainer kits y McDonald\'s siguen ahí', /trainer kit/.test(est) && /mcdonald/.test(est))
}

console.log('── 2. El 30 aniversario, otra vez dos filas ──')
{
  check('el Classic vuelve a ser su propia colección', padreDeColeccion('30th-c') === null, padreDeColeccion('30th-c'))
  check('  …y el Celebration sigue siendo la suya', padreDeColeccion('30th') === null)
  // Y salen en el orden que pidió —primero el Celebration— sin tocar nada:
  // misma fecha, y al desempatar por identificador `30th` va antes que
  // `30th-c`.
  check('«30th» ordena antes que «30th-c»', '30th'.localeCompare('30th-c') < 0)
}

console.log('── 3. Las Trainer Gallery vuelven, pero sin la copia ──')
{
  // Están DOS veces en TCGdex: dos identificadores, mismo nombre, misma
  // fecha, las mismas 30 cartas. Eso no es una opinión, es un duplicado.
  const pares = [['swsh9tg', 'swsh9.5tg'], ['swsh10tg', 'swsh10.5tg'], ['swsh11tg', 'swsh11.5tg'], ['swsh12tg', 'swsh12.5tg']]
  for (const [bueno, copia] of pares) {
    check(`«${bueno}» es una colección propia`, padreDeColeccion(bueno) === null, padreDeColeccion(bueno))
    check(`  …y «${copia}» es la copia`, padreDeColeccion(copia) === bueno, padreDeColeccion(copia))
  }
  // Y las otras cuatro que plegué por mi cuenta vuelven enteras.
  for (const id of ['sma', 'swsh4.5sv', 'swsh12.5gg', 'cel25cc']) {
    check(`«${id}» vuelve a ser su propia colección`, padreDeColeccion(id) === null, padreDeColeccion(id))
  }
}

console.log('── 4. Y las CINCO que PINGU sí pidió siguen plegadas ──')
{
  const suyas = [['rc', 'bw11'], ['exu', 'ex10'], ['xya', 'xyp'], ['wp', 'basep'], ['miscp', 'basep']]
  for (const [hijo, padre] of suyas) {
    check(`«${hijo}» sigue dentro de «${padre}»`, padreDeColeccion(hijo) === padre, padreDeColeccion(hijo))
  }
}

console.log('── 5. Y si una serie declarada se queda sin sets, se canta ──')
{
  const sinPop = reglasQueNoCasan([{ id: 'bw1', serie_name: 'Black & White' }])
  check('se avisa', sinPop.some((x) => /serie «pop»/.test(x)), JSON.stringify(sinPop.filter((x) => /serie/.test(x))))
  const conPop = reglasQueNoCasan([{ id: 'pop1', serie_name: 'POP' }])
  check('  …y con sets, no', !conPop.some((x) => /serie/.test(x)), JSON.stringify(conPop.filter((x) => /serie/.test(x))))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
