// Tanda 339 — la marca de regulación es del SET, no de la carta.
//
// PINGU, sobre el Mew ex de 30th Celebration: «sí que lleva marca de
// regulación, llevan la marca J… no podemos dejar la marca vacía».
//
// TCGdex no trae `regulationMark` para las cartas del set `30th` —se vio
// en las filas ya engordadas: `detalle_at` puesto, sin error, y la
// columna a null—, y el engorde solo la escribe SI VIENE. Así que la
// ficha decía «No es legal en Estándar» de una carta que sí lo es, que
// es peor que no decir nada.
//
// Lo que hace que se pueda arreglar sin inventar: TODAS las cartas de un
// set llevan la misma marca. Es propiedad del set.
import { readFileSync } from 'node:fs'
import { marcaHeredada } from '/home/user/pingu/netlify/lib/carta-detalle.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

// Un catálogo de mentira con la forma del de verdad: las marcas
// empiezan en 2020, y el set nuevo llega sin ninguna.
const SETS = [
  { id: 'viejo', market: 'WEST', release_date: '2016-02-03', regulation_mark: null },
  { id: 'swsh1', market: 'WEST', release_date: '2020-02-07', regulation_mark: 'D' },
  { id: 'sv3', market: 'WEST', release_date: '2023-08-11', regulation_mark: 'G' },
  { id: 'sv8', market: 'WEST', release_date: '2024-11-08', regulation_mark: 'H' },
  { id: 'nuevo', market: 'WEST', release_date: '2026-09-16', regulation_mark: null },
]

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Un set nuevo sin marca hereda la del anterior ──')
{
  check('el set nuevo hereda', marcaHeredada(SETS[4], SETS) === 'H', marcaHeredada(SETS[4], SETS))
  // Y no la del MÁS nuevo a secas, sino la del anterior por fecha: si
  // cogiera cualquiera, un set de 2020 heredaría la de 2026.
  const enMedio = { id: 'x', market: 'WEST', release_date: '2023-10-01', regulation_mark: null }
  check('y el de en medio hereda la de SU época, no la última',
    marcaHeredada(enMedio, SETS) === 'G', marcaHeredada(enMedio, SETS))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Y lo que NO se toca ──')
{
  check('un set que ya tiene marca se deja en paz',
    marcaHeredada(SETS[2], SETS) === null)
  // La puesta a mano manda sobre cualquier deducción: la escribió quien
  // tenía la carta delante.
  check('una marca puesta a mano no se pisa',
    marcaHeredada({ id: 'y', market: 'WEST', release_date: '2026-09-16', regulation_mark: null,
      regulation_mark_origen: 'mano' }, SETS) === null)
  // LO IMPORTANTE: antes de que las marcas existieran, el null NO es un
  // hueco — es la verdad, y esas cartas no son legales en Estándar.
  // Rellenarlas sería el fallo contrario y mucho peor: daría por legal
  // media colección de 2016.
  check('un set anterior a que existieran las marcas se queda sin ella',
    marcaHeredada(SETS[0], SETS) === null, marcaHeredada(SETS[0], SETS))
  check('…y el suelo sale de los datos, no de una fecha escrita a mano',
    marcaHeredada({ id: 'z', market: 'WEST', release_date: '2019-01-01', regulation_mark: null }, SETS) === null)
  // Sin fecha no se puede deducir nada.
  check('sin fecha de salida, no se deduce', marcaHeredada({ id: 'w', market: 'WEST' }, SETS) === null)
  check('sin catálogo tampoco', marcaHeredada(SETS[4], []) === null)
  check('y sin set, ni se intenta', marcaHeredada(null, SETS) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La migración arregla lo de hoy ──')
{
  const sql = leer('supabase-migration-marcas-por-set.sql')
  check('añade la marca al set', /add column if not exists regulation_mark text/.test(sql))
  check('…y de dónde sale', /add column if not exists regulation_mark_origen text/.test(sql))
  // Fase 1: no adivina, le pregunta a las cartas del propio set.
  check('primero se lo pregunta a las cartas del set', /regulation_mark_origen = 'cartas'/.test(sql))
  check('…y coge la más repetida, no la primera', /order by count\(\*\) desc/.test(sql))
  // Fase 2: deduce, y solo a partir de que las marcas existen.
  check('después deduce por fecha', /regulation_mark_origen = 'fecha'/.test(sql))
  check('…con el suelo sacado de los datos', /min\(release_date\) as desde/.test(sql))
  // Fase 3: lo que un humano ha comprobado manda.
  check('y lo comprobado a mano manda', /regulation_mark_origen = 'mano'/.test(sql))
  check('…con el 30th en J, que es lo que vio PINGU',
    /set regulation_mark = 'J'[\s\S]{0,120}id = '30th'/.test(sql))
  // Y lo que no puede hacer: pisar lo que TCGdex sí dijo de una carta.
  check('a las cartas solo se les escribe donde está vacía',
    /and c\.regulation_mark is null/.test(sql))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Y los sets que vengan, solos ──')
{
  // Si esto no estuviera, habría que repetir la migración a mano con
  // cada set nuevo — y nadie se acuerda de eso.
  const tarea = leer('netlify/functions/cartas-detalle.mjs')
  check('la tarea pone la marca de los sets que llegan sin ella', /marcaHeredada\(/.test(tarea))
  check('…y se la escribe también a sus cartas',
    /tcg_cards\?set_id=eq[^`]*regulation_mark=is\.null/.test(tarea))
  check('…solo donde está vacía', /regulation_mark=is\.null/.test(tarea))
  // Y la carta recién engordada que venga sin marca, con la de su set.
  check('una carta nueva sin marca coge la de su set',
    /if \(!detalle\.regulation_mark\)[\s\S]{0,200}detalle\.regulation_mark = delSet/.test(tarea))
  // Y la vuelta atrás: sin la migración puesta, la columna no existe y
  // pedirla devuelve 400 —no null— y tumbaría el engorde entero.
  check('sin la migración puesta, la tarea sigue engordando',
    /regulation_mark[\s\S]{0,400}\.catch\(\(\) =>[\s\S]{0,400}\.catch\(\(\) =>/.test(tarea))
  check('…y la fase se queda apagada', /s\.regulation_mark === null/.test(tarea))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
