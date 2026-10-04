// Tanda 535 — la estantería no plegaba nada.
//
// PINGU: «el 30 Classic Collection no tiene logo y debería ir después del
// 30 Celebration». Y en /cartas ya salía plegado desde la 347 — con sus
// identificadores de verdad, `30th` y `30th-c`, que casan por prefijo—.
//
// Lo que estaba mirando era OTRA pantalla: la estantería de /mi-coleccion,
// que no plegaba nada. Las trece colecciones que son parte de otra salían
// sueltas, sin logo y con el progreso partido en dos barras.
//
// Y plegar ahí son DOS cosas: la fila se va, **y lo que tienes de ella se
// suma a la del padre**. Con solo lo primero, las cartas del hijo
// desaparecen del recuento y el álbum dice que tienes menos de las que
// tienes — sin dar ningún error.
import { readFileSync } from 'node:fs'
import { padreDeColeccion, plegarHermanos } from '/home/user/pingu/js/catalogo-series.js'
import { gruposDeEstanteria } from '/home/user/pingu/js/mi-coleccion/estanteria.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// EL EJEMPLO ERA EL 30 ANIVERSARIO Y YA NO LO ES (tanda 536): PINGU lo
// quiere en dos filas. Lo que esta tanda arregló —que la estantería
// PLIEGUE— sigue valiendo igual, así que el ejemplo pasa a ser uno de los
// cinco que él sí pidió: la Radiant Collection dentro de Legendary
// Treasures.
const ANIVERSARIO = [
  { id: 'bw11', name: 'Legendary Treasures', serie_id: 'bw', serie_name: 'Black & White', release_date: '2013-11-06', card_count_total: 140 },
  { id: 'rc', name: 'Radiant Collection', serie_id: 'bw', serie_name: 'Black & White', release_date: '2013-11-06', card_count_total: 25 },
  { id: 'me05', name: 'Pitch Black', serie_id: 'bw', serie_name: 'Black & White', release_date: '2013-08-14', card_count_total: 120 },
]

console.log('── 1. Sus identificadores de verdad casan por prefijo ──')
{
  check('«rc» va dentro de «bw11»', padreDeColeccion('rc') === 'bw11', padreDeColeccion('rc'))
  check('  …y el padre no va dentro de nadie', padreDeColeccion('bw11') === null)
  // Y el 30 aniversario, que era el ejemplo de esta prueba, ahora son dos
  // filas a propósito (tanda 536).
  check('el Classic del 30 NO se pliega', padreDeColeccion('30th-c') === null, padreDeColeccion('30th-c'))
}

console.log('── 2. En la estantería: una fila, no dos ──')
{
  const plegados = plegarHermanos(ANIVERSARIO.map((s) => ({ ...s })))
  const grupos = gruposDeEstanteria(plegados)
  const ids = grupos.flatMap((g) => g.sets.map((s) => s.id))
  check('la Radiant ya no es una fila suelta', !ids.includes('rc'), JSON.stringify(ids))
  check('  …y Legendary Treasures sigue', ids.includes('bw11'), JSON.stringify(ids))
  const padre = plegados.find((s) => s.id === 'bw11')
  check('  …con las cartas de los dos', padre.card_count_total === 140 + 25, padre.card_count_total)
  // Y el orden de la era no se toca: lo más nuevo arriba.
  check('Legendary Treasures sale antes que lo de agosto', ids.indexOf('bw11') < ids.indexOf('me05'), JSON.stringify(ids))
}

console.log('── 3. Y LO QUE TIENES SE SUMA, que es la otra mitad ──')
{
  // Se comprueba sobre el código de /mi-coleccion porque es donde vive el
  // recuento: una prueba que solo mirara el plegado diría que todo va bien
  // mientras el álbum enseña menos cartas de las que tienes.
  const mc = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  check('el recuento de la estantería pasa por el padre',
    /const suyo = padreDeColeccion\(s\) \|\| s\n\s+cuantas\.set\(suyo,/.test(mc))
  check('la estantería pliega antes de pintar',
    /plegarHermanos\(sets\.map\(\(s\) => \(\{ \.\.\.s \}\)\)\)/.test(mc))
  check('y el vistazo del panel también cuenta las del hijo',
    /\(padreDeColeccion\(c\.set_id\) \|\| c\.set_id\) === s\.id/.test(mc))
  // Y se pliega sobre una COPIA: `plegarHermanos` suma las cuentas en el
  // objeto del padre, así que plegar la misma lista dos veces las sumaría
  // dos veces. La estantería se repinta en cada filtro.
  const unaVez = plegarHermanos(ANIVERSARIO.map((s) => ({ ...s })))
  const otraVez = plegarHermanos(ANIVERSARIO.map((s) => ({ ...s })))
  check('plegar dos veces no suma dos veces',
    unaVez.find((s) => s.id === 'bw11').card_count_total === otraVez.find((s) => s.id === 'bw11').card_count_total,
    `${unaVez.find((s) => s.id === 'bw11').card_count_total} / ${otraVez.find((s) => s.id === 'bw11').card_count_total}`)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
