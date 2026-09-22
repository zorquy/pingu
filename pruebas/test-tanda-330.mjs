// Tanda 330 — el catálogo en español, y qué es una era.
//
// PINGU: «los ataques salen en inglés, why?» y «McDonald's Collection yo
// lo tiraría para abajo».
//
// Lo del inglés no era un descuido: el catálogo occidental se importa en
// INGLÉS a propósito. Pero eso era una decisión sobre el LISTADO, donde
// lo único que hay es el nombre. El texto de los ataques viene en la
// petición POR CARTA, que hacemos igual — pedirla en español no cuesta
// ni una petición más, cuesta pedirla en otro idioma.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import {
  IDIOMAS_DE_FICHA,
  detalleEnEspanol,
  urlDeCartaEnIdioma,
} from '/home/user/pingu/netlify/lib/carta-detalle.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const ES = { name: 'Exeggcute', category: 'Pokemon', hp: 60, types: ['Grass'],
  attacks: [{ name: 'Hipnosis', cost: ['Colorless'], effect: 'Tu rival queda Dormido.' }] }
const EN = { name: 'Exeggcute', category: 'Pokemon', hp: 60, types: ['Grass'],
  attacks: [{ name: 'Hypnosis', cost: ['Colorless'], effect: 'Now Asleep.' }] }

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Español primero, inglés si no hay ──')
{
  check('el orden está declarado', IDIOMAS_DE_FICHA.join(',') === 'es,en', IDIOMAS_DE_FICHA.join(','))
  check('la URL lleva el idioma dentro', urlDeCartaEnIdioma('sv5-36', 'es').includes('/es/cards/'))
  check('…y el identificador escapado', urlDeCartaEnIdioma('a b', 'es').includes('a%20b'))

  const pedidas = []
  const traducida = await detalleEnEspanol('x', async (u) => {
    pedidas.push(u.includes('/es/') ? 'es' : 'en')
    return u.includes('/es/') ? ES : EN
  })
  check('una carta traducida viene en español', traducida.idioma === 'es')
  check('…con el ataque traducido', traducida.fila.attacks[0].name === 'Hipnosis', traducida.fila.attacks[0].name)
  // Y NO se pide el inglés de más: son 23.000 cartas, una petición de
  // sobra por carta es media jornada de la API de otra gente.
  check('…y no se pide el inglés para nada', pedidas.join(',') === 'es', pedidas.join(','))

  // Las anteriores a 2011 no están traducidas y TCGdex devuelve 404.
  const sinTraducir = await detalleEnEspanol('x', async (u) => (u.includes('/es/') ? null : EN))
  check('una sin traducir cae al inglés', sinTraducir.idioma === 'en')
  check('…y trae la ficha igual', sinTraducir.fila.attacks[0].name === 'Hypnosis')
  check('si no hay ninguna de las dos, no se inventa nada',
    (await detalleEnEspanol('x', async () => null)) === null)

  // El NOMBRE también viene traducido y es lo primero que se lee.
  check('el nombre traducido se devuelve aparte', traducida.nombre === 'Exeggcute')
  const conNombre = await detalleEnEspanol('x', async () => ({ ...ES, name: 'Huevos' }))
  check('…y es el del idioma que vino', conNombre.nombre === 'Huevos', conNombre.nombre)
  // Pero nunca se pisa con vacío: dejaría la carta sin nombre y sin
  // forma de buscarla.
  const sinNombre = await detalleEnEspanol('x', async () => ({ ...ES, name: '  ' }))
  check('un nombre vacío NO se devuelve', sinNombre.nombre === null, String(sinNombre.nombre))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La tarea apunta en qué idioma lo consiguió ──')
{
  // Sin eso, una carta traducida y una que no lo está son
  // indistinguibles, y reintentarlo dentro de un año —cuando la
  // comunidad haya traducido más— costaría reengordar las 23.000.
  const tarea = readFileSync(`${RAIZ}/netlify/functions/cartas-detalle.mjs`, 'utf8')
  check('se guarda el idioma en la fila', /detalle_lang: encontrado\.idioma/.test(tarea))
  check('y se vuelven a pasar las que no lo tienen',
    /detalle_lang\.is\.null/.test(tarea), 'las engordadas antes de la 330 no se reintentarían')
  // Esto comprobaba que el nombre traducido se escribiera en `name`
  // «solo si vino de verdad». La condición estaba bien; el DESTINO
  // estaba mal, y la prueba lo bendijo: `name` es la clave con la que se
  // cruzan el agregado de torneos, el resolutor de decklists y la huella
  // de las reimpresiones. Desde la tanda 335 el traducido va a `name_es`
  // y `name` no se toca — y eso es lo que se comprueba ahora.
  check('el nombre traducido va a su columna y solo si vino de verdad',
    /if \(encontrado\.nombre && encontrado\.idioma !== 'en'\) detalle\.name_es = encontrado\.nombre/.test(tarea))
  check('…y no encima de la clave', !/\bdetalle\.name\s*=[^=]/.test(tarea),
    tarea.match(/.*detalle\.name\s*=[^=].*/)?.[0])

  // Y la columna, en su migración.
  const sql = readFileSync(`${RAIZ}/supabase-migration-cartas-espanol.sql`, 'utf8')
  check('la migración crea la columna', /add column if not exists detalle_lang/.test(sql))
  check('…y el índice del engorde la mira', /detalle_lang is null/.test(sql))

  // Dos peticiones por carta en el peor caso, así que caben menos por
  // pasada: una función programada de Netlify se mata a los 30 segundos.
  const porPasada = Number((tarea.match(/const POR_PASADA = (\d+)/) || [])[1])
  check('la tanda por pasada baja al pedir dos idiomas', porPasada > 0 && porPasada <= 30, String(porPasada))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Qué es una era y qué no ──')
{
  // El orden por «el set más nuevo de cada serie» dejaba McDonald's
  // entre Escarlata y Púrpura y Espada y Escudo, porque McDonald's saca
  // promos todos los años.
  //
  // La regla NO es una lista de nombres a mano —eso se queda viejo el
  // día que salga la siguiente promo, la lección de la 323— sino el
  // TAMAÑO: una expansión pasa de las cien cartas y una colección de
  // promos no llega a treinta.
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [
      { id: 'meg', name: 'Mega Evolución', market: 'WEST', serie_name: 'Mega Evolución',
        card_count_official: 188, release_date: '2025-09-26' },
      // Más NUEVO que dos eras, y aun así tiene que irse abajo.
      { id: 'mcd', name: "McDonald's 2025", market: 'WEST', serie_name: "McDonald's Collection",
        card_count_official: 15, release_date: '2025-08-01' },
      { id: 'sv8', name: 'Surging Sparks', market: 'WEST', serie_name: 'Escarlata y Púrpura',
        card_count_official: 252, release_date: '2024-11-08' },
      // OJO con el orden: el set más NUEVO de Espada y Escudo es
      // pequeño y el grande es más viejo. Así «el primero» y «el más
      // grande» dejan de ser el mismo, que es lo que hace falta para
      // que se note si alguien mira solo el primero. Con un set por
      // serie, el rigor no veía la diferencia.
      { id: 'swshp', name: 'SWSH Promos', market: 'WEST', serie_name: 'Espada y Escudo',
        card_count_official: 30, release_date: '2022-06-01' },
      { id: 'swsh3', name: 'Darkness Ablaze', market: 'WEST', serie_name: 'Espada y Escudo',
        card_count_official: 189, release_date: '2020-08-14' },
      { id: 'raro', name: 'Promo suelto', market: 'WEST', serie_name: null,
        card_count_official: 7, release_date: '2019-01-01' },
    ]
  })
  await page.goto(`${BASE}/cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  check('sin errores', errores.length === 0, errores.join(' | '))

  const orden = await page.locator('.serie-titulo').allTextContents()
  check('las eras van primero y de la más nueva a la más vieja',
    orden.slice(0, 3).join('|') === 'Mega Evolución|Escarlata y Púrpura|Espada y Escudo', orden.join(' → '))
  check('McDonald\'s baja, aunque su set sea más nuevo que dos eras',
    orden.indexOf("McDonald's Collection") > orden.indexOf('Espada y Escudo'), orden.join(' → '))
  check('y lo que no tiene serie va al final del todo',
    orden[orden.length - 1] === 'Sin clasificar', orden.join(' → '))

  const menores = await page.locator('.serie-menor .serie-titulo').allTextContents()
  check('las que no son era se marcan como tales',
    menores.length === 2 && menores.includes("McDonald's Collection"), menores.join(', '))
  await page.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
