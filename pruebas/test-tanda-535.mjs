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

// Los sets del 30 aniversario, tal como los exportó PINGU del SQL Editor.
const ANIVERSARIO = [
  { id: '30th', name: '30th Celebration', serie_id: 'me', serie_name: 'Mega Evolution', release_date: '2026-09-16', card_count_total: 161 },
  { id: '30th-c', name: '30th Classic Collection', serie_id: 'me', serie_name: 'Mega Evolution', release_date: '2026-09-16', card_count_total: 30 },
  { id: 'me05', name: 'Pitch Black', serie_id: 'me', serie_name: 'Mega Evolution', release_date: '2026-07-17', card_count_total: 120 },
]

console.log('── 1. Sus identificadores de verdad casan por prefijo ──')
{
  check('«30th-c» va dentro de «30th»', padreDeColeccion('30th-c') === '30th', padreDeColeccion('30th-c'))
  check('  …y el padre no va dentro de nadie', padreDeColeccion('30th') === null)
}

console.log('── 2. En la estantería: una fila, no dos ──')
{
  const plegados = plegarHermanos(ANIVERSARIO.map((s) => ({ ...s })))
  const grupos = gruposDeEstanteria(plegados)
  const ids = grupos.flatMap((g) => g.sets.map((s) => s.id))
  check('el Classic ya no es una fila suelta', !ids.includes('30th-c'), JSON.stringify(ids))
  check('  …y el Celebration sigue', ids.includes('30th'), JSON.stringify(ids))
  const padre = plegados.find((s) => s.id === '30th')
  check('  …con las cartas de los dos', padre.card_count_total === 161 + 30, padre.card_count_total)
  // Y el orden de la era no se toca: lo más nuevo arriba.
  check('el 30 aniversario sale antes que Pitch Black', ids.indexOf('30th') < ids.indexOf('me05'), JSON.stringify(ids))
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
    unaVez.find((s) => s.id === '30th').card_count_total === otraVez.find((s) => s.id === '30th').card_count_total,
    `${unaVez.find((s) => s.id === '30th').card_count_total} / ${otraVez.find((s) => s.id === '30th').card_count_total}`)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
