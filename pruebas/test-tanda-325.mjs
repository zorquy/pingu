// Tanda 325 — «en los torneos de PokeDoc».
//
// Es la fila que justifica el proyecto: el nombre, la foto y los ataques
// los tienen otras quince webs; cuántos mazos la llevan y de qué
// arquetipos, no.
//
// Y trae consigo la promesa más delicada de la casa. Los arquetipos NO
// se guardan a propósito: se deducen al pintarlos, y por eso la
// visibilidad no se puede equivocar. Aquí se guarda un AGREGADO, así que
// la promesa pasa a depender de una decisión concreta —leer las listas
// con la clave pública, no con la de servicio— y esta prueba es la que
// la vigila.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import {
  ARQUETIPOS_POR_CARTA,
  agregarJuego,
} from '/home/user/pingu/netlify/lib/juego-agregado.mjs'
import {
  MAZOS_MINIMOS,
  MAZOS_PARA_TENDENCIA,
  bloqueDeJuego,
  claveDeJuego,
  hayDatosDeJuego,
  hayMuestra,
  mediaDeCopias,
  mereceIndexarse,
  nucleoDeCarta,
} from '/home/user/pingu/js/carta-nucleo.js'
import { normalizarNombre } from '/home/user/pingu/js/normalizar.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

const mazo = (torneo, extra = []) => ({
  tournament_id: torneo,
  parsed_cards: {
    pokemon: [
      { quantity: 3, name: 'Ceruledge ex', set: 'TWM', number: '36' },
      { quantity: 3, name: 'Charcadet', set: 'TWM', number: '32' },
      ...extra,
    ],
    trainer: [{ quantity: 4, name: 'Iono', set: 'PAL', number: '185' }],
    energy: [{ quantity: 8, name: 'Fire Energy' }],
  },
})
const DUSKNOIR = [{ quantity: 2, name: 'Dusknoir', set: 'SFA', number: '20' }]

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La cuenta ──')
{
  const r = agregarJuego([mazo('t1', DUSKNOIR), mazo('t1', DUSKNOIR), mazo('t2')])
  const por = (n) => r.find((f) => f.name_key === normalizarNombre(n))

  check('cuenta los mazos que llevan la carta', por('Ceruledge ex').decks === 3)
  check('…y sus copias, para poder sacar la media', por('Ceruledge ex').total_copies === 9)
  check('…y en cuántos torneos distintos ha salido', por('Ceruledge ex').tournaments === 2)
  check('una carta de solo dos mazos cuenta dos', por('Dusknoir').decks === 2)

  // Las energías básicas las lleva todo el mundo: saldrían siempre las
  // primeras en cualquier «lo más jugado» y no dirían nada de nadie.
  check('las energías no entran en la cuenta', !por('Fire Energy'), JSON.stringify(por('Fire Energy') || null))
  check('los objetos sí (un Martillo define un mazo)', por('Iono')?.decks === 3)

  // Dentro de UN mazo, dos reimpresiones de la misma carta son un mazo.
  const dosLineas = [{ tournament_id: 't9', parsed_cards: { pokemon: [], trainer: [
    { quantity: 2, name: 'Iono', set: 'PAL', number: '185' },
    { quantity: 2, name: 'Iono', set: 'PR', number: '80' }], energy: [] } }]
  const rr = agregarJuego(dosLineas)
  check('dos reimpresiones en un mazo son UN mazo', rr[0].decks === 1, JSON.stringify(rr[0]))
  check('…y sus copias se suman', rr[0].total_copies === 4, JSON.stringify(rr[0]))

  check('una lista rota no tumba la cuenta', agregarJuego([{ parsed_cards: null }, null]).length === 0)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El arquetipo se deduce con el MISMO código ──')
{
  const r = agregarJuego([mazo('t1', DUSKNOIR), mazo('t1', DUSKNOIR), mazo('t2')])
  const cer = r.find((f) => f.name_key === normalizarNombre('Ceruledge ex'))
  const nombres = cer.archetypes.map((a) => `${a.nombre}:${a.mazos}`)
  check('agrupa por arquetipo', nombres.includes('Ceruledge ex Dusknoir:2'), nombres.join(' | '))
  check('…y el otro también sale', nombres.includes('Ceruledge ex:1'), nombres.join(' | '))
  check('el de más mazos va primero', cer.archetypes[0].mazos >= cer.archetypes[1].mazos)
  check(`se guardan como mucho ${ARQUETIPOS_POR_CARTA}`, cer.archetypes.length <= ARQUETIPOS_POR_CARTA)

  // Un empate tiene que pintarse IGUAL dos veces seguidas, o parecería
  // que algo se mueve cuando no se mueve nada.
  const a = JSON.stringify(agregarJuego([mazo('t1', DUSKNOIR), mazo('t2')]))
  const b = JSON.stringify(agregarJuego([mazo('t1', DUSKNOIR), mazo('t2')]))
  check('dos cálculos iguales dan lo mismo', a === b)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La promesa de la visibilidad ──')
{
  // Los arquetipos no se guardan a propósito, para que ver el mazo de
  // alguien dependa SIEMPRE de la política de la base. Guardar un
  // agregado rompe eso si se calcula con la clave de servicio, que se
  // salta la RLS: bastaría un torneo con las listas en «nunca» para que
  // sus mazos acabaran en una página pública.
  const fuente = readFileSync(`${RAIZ}/netlify/functions/cartas-juego.mjs`, 'utf8')

  // Las decklists se leen con la PÚBLICA.
  const lectura = fuente.slice(fuente.indexOf('async function leerPublico'), fuente.indexOf('async function escribir'))
  check('las listas se leen con la clave pública', /CLAVE_PUBLICA/.test(lectura), lectura.slice(0, 120))
  check('…y no con la de servicio', !/SERVICE_ROLE|servicio\(/.test(lectura), lectura.slice(0, 200))

  // Y la de servicio solo aparece donde se ESCRIBE.
  const escritura = fuente.slice(fuente.indexOf('async function escribir'), fuente.indexOf('export default'))
  check('escribir sí usa la de servicio', /servicio\(clave\)/.test(escritura))
  check('la llamada a las decklists pasa por leerPublico',
    /leerPublico\(\s*`tournament_decklists/.test(fuente), 'alguien lee las listas por otro camino')

  // Y el agregado se REHACE entero, no se va sumando: una lista que deja
  // de ser pública tiene que dejar de contar.
  check('lo que ya no es visible se borra', /method: 'DELETE'[\s\S]{0,200}tcg_card_play|tcg_card_play\?updated_at=lt/.test(fuente))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Un número sin muestra no es un número ──')
{
  // REESCRITO EN LA 338. Antes el bloque no salía por debajo de tres
  // mazos, con el razonamiento de que «el 100 % la juega a 4 copias» no
  // dice nada. Eso sigue siendo cierto de la MEDIA — pero no del hecho:
  // que una carta se haya jugado en un torneo de PokeDoc es justo lo que
  // no tiene ninguna otra web, y esconderlo por no poder calcular una
  // media encima es tirar el dato bueno para proteger el malo.
  //
  // Ahora el bloque sale desde UN mazo y lo que cambia es lo que dice.
  check('el bloque sale desde un solo mazo', hayDatosDeJuego({ decks: 1 }))
  check('sin ningún mazo, no', !hayDatosDeJuego({ decks: 0 }))
  check('sin datos, tampoco', !hayDatosDeJuego(null))
  check('pero para hablar de tendencia hacen falta tres', MAZOS_PARA_TENDENCIA >= 3)
  check('…con dos no hay muestra', !hayMuestra({ decks: 2 }))
  check('…con tres sí', hayMuestra({ decks: 3 }))

  // Y lo que NO se hace nunca: pintar una media de una muestra de uno.
  const unaLista = bloqueDeJuego({ decks: 1, total_copies: 4, tournaments: 1, archetypes: [{ nombre: 'Ceruledge', mazos: 1 }] })
  check('con un mazo el bloque sale', /carta-juego/.test(unaLista))
  check('…y lo dice en singular', /Mazo que la lleva/.test(unaLista), unaLista.slice(0, 200))
  check('…sin media', !/Copias de media/.test(unaLista))
  check('…pero con las copias de verdad, que eso sí es un dato', /<dt>Copias<\/dt><dd>4</.test(unaLista))
  check('…sin «se juega sobre todo en», que con uno no es un sobre todo',
    !/Se juega sobre todo/.test(unaLista))
  check('…y avisando del tamaño de la muestra', /una sola lista/.test(unaLista), unaLista)

  // Con dos, lo mismo pero en plural.
  const dos = bloqueDeJuego({ decks: 2, total_copies: 7, tournaments: 1, archetypes: [{ nombre: 'A', mazos: 2 }] })
  check('con dos tampoco hay media', !/Copias de media/.test(dos))
  check('…y el aviso lo dice', /de 2 listas/.test(dos), dos)
  // Y las copias exactas SOLO con un mazo: con dos, un total de 7 no es
  // «7 copias» de nadie.
  check('…y no se enseña un total como si fueran copias de una lista', !/<dt>Copias<\/dt>/.test(dos))

  // La media se calcula al pintar: guardarla ya dividida haría imposible
  // recalcular nada.
  check('la media sale con coma', mediaDeCopias({ decks: 18, total_copies: 43 }) === '2,4',
    mediaDeCopias({ decks: 18, total_copies: 43 }))
  check('sin mazos no hay media', mediaDeCopias({ decks: 0, total_copies: 0 }) === null)

  // El tamaño de la muestra va A LA VISTA. Es la diferencia entre un
  // dato y una afirmación.
  const html = bloqueDeJuego({ decks: 18, total_copies: 43, tournaments: 4, archetypes: [{ nombre: 'A', mazos: 11 }] })
  check('el bloque dice sobre cuántos mazos habla', /18/.test(html))
  check('…y de dónde sale el número', /listas públicas/.test(html))
  check('…y lo que no cabe en los arquetipos sale como «Otros»', /Otros/.test(html) && />7</.test(html), html.slice(-400))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El listón para salir en Google sube ──')
{
  // En la 324 el listón era «está engordada», con la idea de que el
  // español ya era la diferencia. No lo era todavía: el texto de los
  // ataques viene del catálogo occidental, que es INGLÉS.
  const engordada = { detalle_at: 'x' }
  const jugada = { decks: 9 }
  check('engordada pero sin jugar: no', !mereceIndexarse(engordada, null))
  // Con el listón de la MUESTRA, no con el del bloque: desde la 338 son
  // dos números distintos, y este es el que decide qué ve Google. Con
  // `MAZOS_MINIMOS - 1` esto valía cero y pasaba de cualquier manera —
  // lo cantó el rigor.
  check('engordada y poco jugada: tampoco',
    !mereceIndexarse(engordada, { decks: MAZOS_PARA_TENDENCIA - 1 }))
  check('…aunque el bloque sí salga con esos mismos mazos',
    hayDatosDeJuego({ decks: MAZOS_PARA_TENDENCIA - 1 }))
  check('engordada y jugada: sí', mereceIndexarse(engordada, jugada))
  check('jugada pero sin engordar: no', !mereceIndexarse({}, jugada))
  // Y que la decisión esté en UN sitio: el borde no puede tener otra.
  const borde = readFileSync(`${RAIZ}/netlify/edge-functions/meta-social.js`, 'utf8')
  check('el borde no reimplementa el listón', /mereceIndexarse\(carta, play\)/.test(borde))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. La clave se calcula una vez ──')
{
  // `tcg_card_play` se indexa por el nombre normalizado. La ficha lo
  // calcula para preguntar y la tarea lo calcula para guardar: si las
  // dos versiones se separaran, la ficha preguntaría por una clave que
  // no existe y el bloque desaparecería SIN DAR ERROR.
  check('la ficha y el agregado usan la misma función',
    claveDeJuego({ name: 'Piedra Pómez' }) === normalizarNombre('Piedra Pómez'))
  check('…y normaliza de verdad', claveDeJuego({ name: '  Piedra   PÓMEZ ' }) === 'piedra pomez',
    claveDeJuego({ name: '  Piedra   PÓMEZ ' }))
  const agregado = readFileSync(`${RAIZ}/netlify/lib/juego-agregado.mjs`, 'utf8')
  check('el agregado la IMPORTA, no la copia', /import \{[^}]*normalizarNombre/.test(agregado))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. En la página ──')
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv5', name: 'Fuerzas Temporales', market: 'WEST', card_count_official: 162 }]
    window.__FAKE_CARTAS__ = [{ id: 'sv5-36', set_id: 'sv5', market: 'WEST', local_id: '36', name: 'Ceruledge ex',
      image_path: 'sv/sv5/36', category: 'Pokemon', hp: 270, types: ['Fire'], detalle_at: 'x' }]
    window.__FAKE_JUEGO__ = [{ name_key: 'ceruledge ex', name: 'Ceruledge ex', decks: 18, total_copies: 43,
      tournaments: 4, archetypes: [{ clave: 'd:a', nombre: 'Ceruledge / Dusknoir', mazos: 11 }] }]
    window.__FAKE_GUIAS__ = [{ id: 'g1', slug: 'energia', title: 'Cómo funciona la energía',
      search_content: 'hablando de Ceruledge ex', published_at: '2026-01-01' }]
    window.__FAKE_TEMAS__ = [{ id: 't1', title: '¿Merece la pena Ceruledge ex?' }]
  })
  await page.goto(`${BASE}/carta.html?id=sv5-36`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el bloque sale', (await page.locator('.carta-juego').count()) === 1)
  const cifras = limpio((await page.locator('.juego-cifras div').allTextContents()).join(' | '))
  check('con los mazos, la media y los torneos', /18/.test(cifras) && /2,4/.test(cifras) && /4/.test(cifras), cifras)
  check('y los arquetipos con su barra',
    (await page.locator('.juego-arqs li').count()) === 2, // el catalogado + «Otros»
    limpio((await page.locator('.juego-arqs li').allTextContents()).join(' | ')))

  // Las menciones: la otra mitad de «qué tiene esta página». Son
  // enlaces internos, que es lo que recorre Google.
  check('las menciones salen', !((await page.locator('#cartaMenciones').getAttribute('class')) || '').includes('hidden'))
  const men = (await page.locator('.carta-menciones a').allTextContents()).map(limpio)
  check('…la guía', men.some((t) => /Guía/.test(t)), men.join(' | '))
  check('…y el hilo del foro', men.some((t) => /Foro/.test(t)), men.join(' | '))
  await page.close()

  // Y sin datos de juego, la ficha se pinta igual: la migración la
  // ejecuta un humano y hasta entonces la tabla no existe.
  const p2 = await browser.newPage()
  const err2 = []
  p2.on('pageerror', (e) => err2.push(String(e).slice(0, 160)))
  await p2.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv5', name: 'Fuerzas Temporales', market: 'WEST' }]
    window.__FAKE_CARTAS__ = [{ id: 'sv5-36', set_id: 'sv5', market: 'WEST', local_id: '36', name: 'Ceruledge ex',
      image_path: 'sv/sv5/36', category: 'Pokemon', hp: 270, types: ['Fire'], detalle_at: 'x' }]
    window.__FAKE_JUEGO__ = []
  })
  await p2.goto(`${BASE}/carta.html?id=sv5-36`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2200)
  check('sin datos de juego la ficha va igual', limpio(await p2.locator('#cartaNucleo h1').textContent()) === 'Ceruledge ex')
  check('…y el bloque simplemente no está', (await p2.locator('.carta-juego').count()) === 0)
  check('…sin errores', err2.length === 0, err2.join(' | '))
  await p2.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
