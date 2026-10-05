// Tanda 533 — los sets que son en realidad parte de otro.
//
// PINGU repasó el catálogo set por set y encontró cinco filas que no
// deberían existir por separado: la Radiant Collection (25 cartas) va
// dentro de Legendary Treasures; la Unown Collection, dentro de Unseen
// Forces; las «Yellow A Alternate», dentro de XY Black Star Promos; y «W
// Promotional» y el Ancient Mew —que TCGdex guarda en un cajón llamado
// «Miscellaneous Promos» con UNA carta— dentro de Wizards Black Star
// Promos.
//
// El mecanismo ya existía desde la 347 (el 30 aniversario), pero por
// PREFIJO, y aquí no vale: `rc` no empieza por `bw11`. Son parejas sueltas.
//
// Los identificadores salen del catálogo de verdad, que PINGU exportó del
// SQL Editor — no de mi memoria.
import { readFileSync } from 'node:fs'
import {
  padreDeColeccion, prefijoDeColeccion, idsDeColeccion, reglasQueNoCasan,
  COLECCIONES_JUNTAS,
} from '/home/user/pingu/js/catalogo-series.js'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// Un trozo del catálogo de verdad, con las cuentas que exportó PINGU.
const CATALOGO = [
  { id: 'miscp', name: 'Miscellaneous Promos', serie_name: 'Miscellaneous', release_date: '1996-01-01', card_count_total: 1 },
  { id: 'base1', name: 'Base Set', serie_name: 'Base', release_date: '1999-01-09', card_count_total: 102 },
  { id: 'basep', name: 'Wizards Black Star Promos', serie_name: 'Base', release_date: '1999-07-01', card_count_total: 53 },
  { id: 'wp', name: 'W Promotional', serie_name: 'Base', release_date: '1999-09-01', card_count_total: 7 },
  { id: 'ex10', name: 'Unseen Forces', serie_name: 'EX', release_date: '2005-08-22', card_count_total: 117 },
  { id: 'exu', name: 'Unseen Forces Unown Collection', serie_name: 'EX', release_date: '2005-08-22', card_count_total: 28 },
  { id: 'bw11', name: 'Legendary Treasures', serie_name: 'Black & White', release_date: '2013-11-06', card_count_total: 140 },
  { id: 'rc', name: 'Radiant Collection', serie_name: 'Black & White', release_date: '2013-11-06', card_count_total: 25 },
  { id: 'xyp', name: 'XY Black Star Promos', serie_name: 'XY', release_date: '2013-10-12', card_count_total: 216 },
  { id: 'xya', name: 'Yellow A Alternate', serie_name: 'XY', release_date: '2014-02-05', card_count_total: 6 },
  { id: 'pop1', name: 'POP Series 1', serie_name: 'POP', release_date: '2004-09-01', card_count_total: 17 },
  { id: 'np', name: 'Nintendo Black Star Promos', serie_name: 'POP', release_date: '2003-10-01', card_count_total: 40 },
]

console.log('── 1. Las cinco parejas ──')
{
  const esperadas = [['rc', 'bw11'], ['exu', 'ex10'], ['xya', 'xyp'], ['wp', 'basep'], ['miscp', 'basep']]
  for (const [hijo, padre] of esperadas) {
    check(`«${hijo}» va dentro de «${padre}»`, padreDeColeccion(hijo) === padre, padreDeColeccion(hijo))
  }
  // Y un set normal no se pliega en nadie.
  check('un set normal no tiene padre', padreDeColeccion('bw1') === null, padreDeColeccion('bw1'))
  check('ni el padre en sí mismo', padreDeColeccion('bw11') === null, padreDeColeccion('bw11'))
  // EL 30 ANIVERSARIO YA NO SE PLIEGA (tanda 536): PINGU lo pidió plegado
  // en la 347 y lo pidió separado esta mañana, y manda lo último. Queda
  // comprobado que NO se pliega, que es lo que ahora tiene que pasar.
  // Y en la 646 vuelve a ser UNO: PINGU, con la API de TCGGO delante («el 30
  // es uno entero, con las clásicas dentro»). Manda lo último.
  check('el Classic del 30 va dentro del 30 (646)', padreDeColeccion('30th-c') === '30th', padreDeColeccion('30th-c'))
  check('  …por una regla de prefijo, que es la que recoge la siguiente entrega', prefijoDeColeccion('30th') === '30th', prefijoDeColeccion('30th'))
}

console.log('── 2. En la PÁGINA: la fila desaparece y las cartas se cuentan en el padre ──')
{
  // Esto vive en `js/cartas.js`, que necesita un DOM: se prueba donde se
  // usa. Una prueba que llamara a la función suelta no diría nada de la
  // pantalla (la lección de la 313).
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((sets) => { window.__FAKE_SETS__ = sets }, CATALOGO.map((s) => ({ ...s, market: 'WEST' })))
  await page.goto('http://localhost:8892/cartas.html', { waitUntil: 'networkidle' })
  const filas = await page.locator('.serie-fila .serie-nombre').allTextContents()
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  check('la Radiant Collection ya no es una fila', !filas.includes('Radiant Collection'), filas.join(' | '))
  check('ni la Unown Collection', !filas.some((t) => /Unown/.test(t)), filas.join(' | '))
  check('ni las Yellow A Alternate', !filas.some((t) => /Yellow A/.test(t)), filas.join(' | '))
  check('ni «W Promotional» ni el cajón de Miscellaneous',
    !filas.includes('W Promotional') && !filas.some((t) => /Miscellaneous/.test(t)), filas.join(' | '))
  // Y los padres SIGUEN estando: plegar no es esconder.
  check('Legendary Treasures sigue', filas.includes('Legendary Treasures'), filas.join(' | '))
  check('  …y Wizards Black Star Promos también', filas.includes('Wizards Black Star Promos'), filas.join(' | '))
  // Las cuentas suman las del hijo, que es lo que hace que la fila no
  // mienta: 140 + 25.
  const textoLT = await page.locator('.serie-fila', { hasText: 'Legendary Treasures' }).first().innerText()
  check('y la cuenta del padre incluye las del hijo', /165/.test(textoLT), textoLT.replace(/\n/g, ' '))

  // ── Las POP, que PINGU quería como colección propia y abajo ──
  const titulos = await page.locator('.serie h2, .serie h3').allTextContents()
  check('POP es un grupo propio', titulos.some((t) => /POP/i.test(t)), titulos.join(' | '))
  const iPop = titulos.findIndex((t) => /POP/i.test(t))
  const iEx = titulos.findIndex((t) => /^EX$/i.test(t.trim()))
  check('  …y va por debajo de las eras', iPop > iEx, JSON.stringify({ titulos, iPop, iEx }))
  await page.close()
  await browser.close()
}

console.log('── 3. La página del padre se lleva las cartas de los hijos ──')
{
  check('«basep» se lleva tres ids', JSON.stringify(idsDeColeccion('basep')) === '["basep","wp","miscp"]', JSON.stringify(idsDeColeccion('basep')))
  check('«bw11» se lleva dos', JSON.stringify(idsDeColeccion('bw11')) === '["bw11","rc"]', JSON.stringify(idsDeColeccion('bw11')))
  // VACÍO Y NO «[él mismo]»: así quien pregunta distingue una colección
  // plegada de un set normal sin mirar otra cosa.
  check('un set normal no se lleva ninguno', JSON.stringify(idsDeColeccion('bw1')) === '[]')
  check('y el del 30 aniversario tampoco, que va por prefijo', JSON.stringify(idsDeColeccion('30th')) === '[]')
  // Y la consulta tiene que usarlos: sin esto, la página del padre
  // enseñaría sus cartas y las del hijo se quedarían sin verse en ningún
  // sitio, porque su fila ya no existe.
  const col = readFileSync('/home/user/pingu/js/coleccion.js', 'utf8')
  check('la consulta usa la lista', /consulta\.in\('set_id', ids\)/.test(col))
}

console.log('── 4. Y una regla que se quede vieja se CANTA ──')
{
  // Una lista de identificadores a mano se queda vieja sin avisar: el set
  // vuelve a salir suelto y nadie se entera (la lección de la 323).
  // El fixture son doce sets, no el catálogo entero, así que las reglas de
  // los sets que no están AQUÍ se señalan y es correcto. Lo que se
  // comprueba es lo que importa: que de los que SÍ están no sobre ninguna.
  const sueltas = reglasQueNoCasan(CATALOGO)
  const deLosQueEstan = sueltas.filter((x) => CATALOGO.some((s) => x.includes(`«${s.id}»`)))
  check('ninguna regla sobra de los sets que sí están', deLosQueEstan.length === 0, JSON.stringify(deLosQueEstan))
  check('  …y las de los que no están sí se señalan', sueltas.some((x) => /swsh/.test(x)), JSON.stringify(sueltas.slice(0, 3)))
  const faltaUno = reglasQueNoCasan(CATALOGO.filter((s) => s.id !== 'rc'))
  check('si desaparece un hijo, se dice cuál', faltaUno.some((x) => /«rc»/.test(x)), JSON.stringify(faltaUno))
  // Y con un catálogo vacío no se canta nada: «no ha llegado nada» no es
  // «las reglas están mal» (tres estados, no dos).
  check('sin catálogo no se afirma nada', reglasQueNoCasan([]).length === 0)
  check('ni con null', reglasQueNoCasan(null).length === 0)
  // Que la lista no se quede sin padres: cada regla tiene que tener uno.
  check('todas las reglas tienen padre', COLECCIONES_JUNTAS.every((c) => !!c.padre))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
