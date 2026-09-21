// Tanda 326 — que lleguen.
//
// Una página que nadie enlaza y que no está en el sitemap existe para
// quien conoce la dirección y para nadie más. Esta tanda es la fontanería:
// el sitemap, el pie de las 25 páginas y el enlace que más vale del
// sitio —el nombre de una carta dentro de la lista de un mazo que acaba
// de ganar un torneo—.
//
// Y una regla por encima de todas: el sitemap NO puede ofrecer una
// dirección que la propia web sirve con `noindex`. Eso es pedirle a
// Google que gaste su presupuesto de rastreo en algo que luego le vas a
// decir que ignore.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'
import { rutaDeCarta, rutaDeColeccion } from '/home/user/pingu/js/carta-ruta.js'
import { mereceIndexarse } from '/home/user/pingu/js/carta-nucleo.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = 'http://localhost:8892'

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El sitemap ofrece el catálogo ──')
{
  // Se le pone una base falsa delante: la función solo habla con
  // Supabase por `fetch`, así que se contesta aquí y no hace falta ni
  // red ni base.
  const RESPUESTAS = {
    'tcg_sets?': [
      { id: 'sv5', release_date: '2024-03-22' },
      { id: 'sv4', release_date: null },
    ],
    'tcg_card_play?': [
      { name_key: 'ceruledge ex', decks: 18, updated_at: '2026-09-21T10:00:00Z' },
      { name_key: 'charcadet', decks: 12, updated_at: '2026-09-21T10:00:00Z' },
      { name_key: 'pikachu', decks: 9, updated_at: '2026-09-21T10:00:00Z' },
    ],
    'tcg_cards?': [
      // Engordada y jugada: entra.
      { id: 'sv5-36', name: 'Ceruledge ex', detalle_at: '2026-09-20T00:00:00Z' },
      // Jugada pero SIN engordar: no entra, porque la página se sirve
      // con `noindex`.
      { id: 'sv5-7', name: 'Charcadet', detalle_at: null },
      // Engordada, y su nombre no está en `tcg_card_play` con esa
      // grafía: no entra.
      { id: 'sv5-99', name: 'Raichu', detalle_at: '2026-09-20T00:00:00Z' },
    ],
    'guides?': [],
    'categories?': [],
    'forum_boards?': [],
    'forum_threads?': [],
  }
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    const ruta = String(url).split('/rest/v1/')[1] || ''
    const clave = Object.keys(RESPUESTAS).find((k) => ruta.startsWith(k))
    return { ok: true, json: async () => (clave ? RESPUESTAS[clave] : []) }
  }
  const { default: sitemap } = await import(`${RAIZ}/netlify/functions/sitemap.mjs`)
  const xml = await (await sitemap()).text()
  globalThis.fetch = original

  check('está el índice del catálogo', xml.includes('<loc>https://pokedoc.es/cartas</loc>'), '')
  check('están las colecciones', xml.includes(`<loc>https://pokedoc.es${rutaDeColeccion({ id: 'sv5' })}</loc>`))
  check('…también la que no tiene fecha', xml.includes(`<loc>https://pokedoc.es${rutaDeColeccion({ id: 'sv4' })}</loc>`))

  const ceruledge = rutaDeCarta({ id: 'sv5-36', name: 'Ceruledge ex' })
  check('está la carta engordada Y jugada', xml.includes(`<loc>https://pokedoc.es${ceruledge}</loc>`), ceruledge)
  // LA REGLA: lo que la web sirve con noindex no se ofrece aquí.
  check('NO está la que se sirve con noindex',
    !xml.includes(rutaDeCarta({ id: 'sv5-7', name: 'Charcadet' })),
    'el sitemap ofrece una página que la web marca noindex')
  check('NO está la que no juega nadie', !xml.includes(rutaDeCarta({ id: 'sv5-99', name: 'Raichu' })))
  check('el XML sigue estando bien formado', /^<\?xml/.test(xml) && /<\/urlset>\s*$/.test(xml))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Una sola opinión sobre quién se indexa ──')
{
  // Si el sitemap escribiera sus propias reglas, el día que suba el
  // listón seguiría ofreciendo lo de antes y nadie se enteraría.
  const fuente = readFileSync(`${RAIZ}/netlify/functions/sitemap.mjs`, 'utf8')
  check('el sitemap importa el listón, no lo reescribe',
    /import \{[^}]*mereceIndexarse[^}]*\} from '\.\.\/\.\.\/js\/carta-nucleo\.js'/.test(fuente))
  check('…y también la forma de las direcciones',
    /rutaDeCarta/.test(fuente) && /rutaDeColeccion/.test(fuente))
  check('no hay un segundo `detalle_at` decidiendo por su cuenta',
    !/detalle_at\s*(!==|===|\?)/.test(fuente), 'el sitemap decide por su cuenta quién está engordado')
  // Y la clave de juego se recalcula en JavaScript, no se confía en que
  // el `unaccent` de Postgres diga lo mismo que el nuestro.
  check('la clave de juego se recalcula aquí', /claveDeJuego\(c\)/.test(fuente))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El pie enlaza el catálogo ──')
{
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const conPie = paginas.filter((f) => /class="pie-rejilla"/.test(readFileSync(`${RAIZ}/${f}`, 'utf8')))
  // El nombre de clase, entero y entre comillas: buscar el trozo suelto
  // casaría también con `pie-rejilla-no` (la trampa de la 312).
  const sinEnlace = conPie.filter((f) => !/href="\/cartas"/.test(readFileSync(`${RAIZ}/${f}`, 'utf8')))
  check('las 25 páginas con pie enlazan a /cartas', conPie.length === 25 && sinEnlace.length === 0,
    `${conPie.length} con pie, sin enlace: ${sinEnlace.join(', ')}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La trampa del barrido: enlazar no es pintar ──')
{
  // La lista de un mazo solo necesita saber ADÓNDE enlaza una carta. Si
  // importara el molde entero, el barrido de CSS le colgaría a /torneo
  // todas las clases de css/carta.css, que esa página no carga — es
  // exactamente lo que le pasó a `.guide-card` con la portada.
  const ruta = readFileSync(`${RAIZ}/js/carta-ruta.js`, 'utf8')
  check('js/carta-ruta.js no pinta ni una etiqueta',
    !/class="|<div|<span|<img|<section/.test(ruta), 'hay HTML en el módulo de direcciones')
  const decklist = readFileSync(`${RAIZ}/js/torneos/cartas-decklist.js`, 'utf8')
  check('la lista de un mazo importa el módulo ligero',
    /from '\.\.\/carta-ruta\.js'/.test(decklist))
  check('…y NO el molde', !/from '\.\.\/carta-nucleo\.js'/.test(decklist))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El enlace desde la lista de un mazo ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv5', name: 'Fuerzas Temporales', market: 'WEST', tcg_online_code: 'TWM' }]
    window.__FAKE_CARTAS__ = [
      { id: 'sv5-36', set_id: 'sv5', market: 'WEST', local_id: '36', name: 'Ceruledge ex',
        image_path: 'sv/sv5/36', name_search: 'ceruledge ex', regulation_mark: 'H' },
    ]
  })
  await page.goto(`${BASE}/carta.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)

  // Se llama a la función DE VERDAD, no se mira el fichero: una prueba
  // que comprueba que se llama a algo no prueba lo que ese algo hace.
  const html = await page.evaluate(async () => {
    const { pintarDecklistVisual } = await import('/js/torneos/cartas-decklist.js')
    const caja = document.createElement('div')
    document.body.appendChild(caja)
    await pintarDecklistVisual(caja, {
      pokemon: [{ quantity: 3, name: 'Ceruledge ex', set: 'TWM', number: '36' }],
      trainer: [], energy: [],
    })
    return caja.innerHTML
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el nombre de la carta es un enlace', /torneo-carta-enlace/.test(html), html.slice(0, 300))
  check('…y apunta a su ficha', html.includes('/carta/ceruledge-ex-sv5-36'), html.slice(0, 400))

  // Y una carta que NO se resuelve se queda como texto: un enlace roto
  // es peor que ninguno.
  const html2 = await page.evaluate(async () => {
    const { pintarDecklistVisual } = await import('/js/torneos/cartas-decklist.js')
    const caja = document.createElement('div')
    document.body.appendChild(caja)
    await pintarDecklistVisual(caja, {
      pokemon: [{ quantity: 2, name: 'Carta Que No Existe', set: 'ZZZ', number: '999' }],
      trainer: [], energy: [],
    })
    return caja.innerHTML
  })
  check('la carta que no se resuelve no enlaza a ninguna parte',
    !/torneo-carta-enlace/.test(html2) && /Carta Que No Existe/.test(html2), html2.slice(0, 300))
  await browser.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
