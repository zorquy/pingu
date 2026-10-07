// Tanda 346 — la dirección, el título repetido, el orden y los filtros.
//
// PINGU, de un tirón: el 30 aniversario partido en dos, el slug que
// seguía diciendo ME05, el nombre del set escrito dos veces (logo +
// título), las promos que tienen que abrir cada era, y «como guardamos
// todos los datos, podemos usar todos los filtros necesarios».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { rutaDeColeccion, filtroDeColeccion } from '/home/user/pingu/js/carta-ruta.js'
import { cabeceraDeColeccion } from '/home/user/pingu/js/carta-nucleo.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

// Los sets de mentira: una era con sus promos, sus energías y su
// expansión, y el 30 aniversario partido en dos series como lo tiene
// TCGdex.
const SETS = [
  { id: 'me05', name: 'Pitch Black', market: 'WEST', serie_id: 'me', serie_name: 'Mega Evolution',
    tcg_online_code: 'PBL', release_date: '2026-09-26', card_count_official: 190, logo_path: 'me/me05/logo' },
  { id: 'me01', name: 'Mega Evolution', market: 'WEST', serie_id: 'me', serie_name: 'Mega Evolution',
    tcg_online_code: 'MEG', release_date: '2026-03-13', card_count_official: 180 },
  { id: 'mep', name: 'MEP Black Star Promos', market: 'WEST', serie_id: 'me', serie_name: 'Mega Evolution',
    tcg_online_code: 'MEP', release_date: '2026-02-01', card_count_official: 40 },
  { id: 'mee', name: 'Mega Evolution Energy', market: 'WEST', serie_id: 'me', serie_name: 'Mega Evolution',
    tcg_online_code: 'MEE', release_date: '2026-02-20', card_count_official: 10 },
  // Serie `me` las dos: así las trae el catálogo de TCGGO (646), y la
  // estantería agrupa por `serie_id`.
  { id: '30th', name: '30th Celebration', market: 'WEST', serie_id: 'me', serie_name: 'Mega Evolution',
    tcg_online_code: '30C', release_date: '2026-08-01', card_count_official: 160 },
  { id: '30th-c', name: '30th Classic Collection', market: 'WEST', serie_id: 'me', serie_name: 'Mega Evolution',
    release_date: '2026-08-01', card_count_official: 30 },
]

const CARTAS = [
  { id: 'me05-1', set_id: 'me05', market: 'WEST', local_id: '001', name: 'Charizard ex', name_es: 'Charizard ex',
    image_path: 'x/1', types: ['Fire'] },
  { id: 'me05-2', set_id: 'me05', market: 'WEST', local_id: '002', name: 'Blastoise', name_es: 'Blastoise',
    image_path: 'x/2', types: ['Water'] },
  { id: 'me05-3', set_id: 'me05', market: 'WEST', local_id: '003', name: 'Magikarp', name_es: 'Magikarp',
    image_path: 'x/3', types: ['Water'] },
  // Sin engordar: no tiene tipo, y no es «de ningún tipo».
  { id: 'me05-4', set_id: 'me05', market: 'WEST', local_id: '004', name: 'Rare Candy', name_es: 'Caramelo Raro',
    image_path: 'x/4', types: null },
  // Las dos mitades del 30 aniversario, que son UN set.
  { id: '30th-1', set_id: '30th', market: 'WEST', local_id: '001', name: 'Pikachu', name_es: 'Pikachu',
    image_path: 'x/5', types: ['Lightning'] },
  { id: '30th-2', set_id: '30th', market: 'WEST', local_id: '002', name: 'Mew', name_es: 'Mew',
    image_path: 'x/6', types: ['Psychic'] },
  // La otra mitad empieza otra vez por el 001, que es lo que mezclaba
  // las dos listas.
  { id: '30th-c-1', set_id: '30th-c', market: 'WEST', local_id: '001', name: 'Charizard', name_es: 'Charizard',
    image_path: 'x/7', types: ['Fire'] },
  { id: '30th-c-2', set_id: '30th-c', market: 'WEST', local_id: '002', name: 'Venusaur', name_es: 'Venusaur',
    image_path: 'x/8', types: ['Grass'] },
]

const browser = await chromium.launch()
async function abrir(ruta) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, c]) => { window.__FAKE_SETS__ = s; window.__FAKE_CARTAS__ = c }, [SETS, CARTAS])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La dirección dice el código, no el identificador ──')
{
  check('con código, el código', rutaDeColeccion({ id: 'me05', tcg_online_code: 'PBL' }) === '/coleccion/pbl',
    rutaDeColeccion({ id: 'me05', tcg_online_code: 'PBL' }))
  check('sin código, el identificador de siempre',
    rutaDeColeccion({ id: '30thc' }) === '/coleccion/30thc')
  // Y quien resuelve prueba LAS DOS columnas: los enlaces viejos y los
  // que ya indexó Google llevan el identificador.
  check('el filtro pregunta por las dos', filtroDeColeccion('pbl') === 'id.eq.pbl,tcg_online_code.eq.PBL',
    filtroDeColeccion('pbl'))
  // Un `or=(…)` se parte por comas y paréntesis: lo que llega por la
  // barra no puede meter una condición de su cosecha.
  check('…y se limpia lo que llega',
    filtroDeColeccion('a),id.eq.b') === 'id.eq.aid.eq.b,tcg_online_code.eq.AID.EQ.B',
    filtroDeColeccion('a),id.eq.b'))
  // El mismo filtro en las dos mitades: si el borde resolviera de otra
  // manera, media dirección daría 404 solo para Google.
  check('el borde usa ESE filtro', /filtroDeColeccion\(clave\)/.test(leer('netlify/edge-functions/meta-social.js')))
  check('y el sitemap pide la columna',
    /select=id,serie_id,release_date,tcg_online_code/.test(leer('netlify/functions/sitemap.mjs')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El nombre, una vez ──')
{
  const con = cabeceraDeColeccion({ name: 'Pitch Black', logo_path: 'me/me05/logo' })
  const sin = cabeceraDeColeccion({ name: 'Classics Collection' })
  check('con logo, el título no se ve', /<h1 class="sr-only">/.test(con))
  check('…pero sigue estando', /Pitch Black<\/h1>/.test(con))
  check('…y el logo lleva el nombre', /alt="Pitch Black"/.test(con))
  check('sin logo, el título se ve', /<h1>Classics Collection<\/h1>/.test(sin))
  const css = leer('css/style.css').replace(/\/\*[\s\S]*?\*\//g, '')
  check('y «sr-only» esconde de verdad', /\.sr-only\s*\{[^}]*(clip|position: absolute)/.test(css))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El 30 aniversario es de Mega, y es UN set ──')
{
  const { page, errores } = await abrir('/cartas')
  check('sin errores', errores.length === 0, errores.join(' | '))
  // /cartas ES la estantería de Mi colección desde la 649 (misma página,
  // modo catálogo): tarjetas `.mc-set-tarjeta` agrupadas por era.
  const series = await page.locator('.mc-estanteria-titulo').allTextContents()
  // Lo primero que hice fue sacarlo a su propio grupo. PINGU: «30 aniv
  // es parte de megaevoluciones, no me lo separes».
  check('no hay un grupo del 30 aniversario', !series.some((t) => /30/.test(t)), series.join(' | '))
  const mega = page.locator('.mc-estanteria-titulo:has-text("Mega Evolution") + .mc-estanteria')
  const nombres = await mega.locator('.mc-set-nombre').allTextContents()
  // DOS filas, Celebration y luego Classic (tanda 536). La 347 las plegó en
  // una porque PINGU dijo «es el mismo set», y la 536 las volvió a separar
  // porque dijo lo contrario esa misma mañana: «el Classic debería ir
  // DESPUÉS del Celebration». Esta prueba se quedó afirmando lo de la 347
  // hasta que la suite entera la cazó en la 565 — un rojo que no se mira
  // se acumula.
  // Y desde la 646 vuelve a ser UNA (PINGU, con la API de TCGGO delante:
  // «el 30 es uno entero, con las clásicas dentro»). Manda lo último.
  check('el 30 aniversario es una fila (646)',
    nombres.filter((t) => /30th/i.test(t)).length === 1 && nombres.includes('30th Celebration'), nombres.join(' | '))
  // Y abajo las energías y las promos, en ese orden desde el final.
  check('las expansiones arriba, y abajo energías y promos',
    nombres.join(' | ') === 'Pitch Black | 30th Celebration | Mega Evolution | Mega Evolution Energy | MEP Black Star Promos',
    nombres.join(' | '))
  // La fila del 30 cuenta las de las dos mitades (646): 160 + 30. Desde la
  // 646 la cifra va en una casilla con su rótulo («Cartas» y el número).
  const cuantas = await mega.locator('.mc-set-tarjeta').filter({ hasText: '30th Celebration' }).first().locator('.mc-set-cuenta').textContent()
  check('y la fila del 30 cuenta las de las dos mitades', /190/.test(cuantas), cuantas)
  // La tarjeta abre la expansión AQUÍ (649), y cada hueco enlaza a la ficha.
  await mega.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  check('la tarjeta abre la expansión en la página, con sus cartas', (await page.locator('#mcAlbum .mc-bolsillo').count()) === 4, String(await page.locator('#mcAlbum .mc-bolsillo').count()))
  check('  …y cada hueco enlaza a su ficha', /^\/carta\//.test((await page.locator('#mcAlbum .mc-bolsillo-enlace').first().getAttribute('href')) || ''))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Los filtros ──')
{
  // Se entra por el CÓDIGO, que es lo nuevo.
  const { page, errores } = await abrir('/coleccion/pbl')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('se resuelve por el código', (await page.locator('.coleccion-carta').count()) === 4,
    String(await page.locator('.coleccion-carta').count()))
  const tipos = await page.locator('#filtroTipo option').allTextContents()
  check('el desplegable solo ofrece los tipos que HAY',
    tipos.join(',') === 'Todos los tipos,Fuego,Agua', tipos.join(','))
  await page.selectOption('#filtroTipo', 'Water')
  await page.waitForTimeout(200)
  check('filtra por tipo', (await page.locator('.coleccion-carta').count()) === 2,
    String(await page.locator('.coleccion-carta').count()))
  await page.selectOption('#filtroTipo', '')
  await page.fill('#filtroNombre', 'caramelo')
  await page.waitForTimeout(200)
  check('busca por el nombre en español', (await page.locator('.coleccion-carta').count()) === 1)
  await page.fill('#filtroNombre', 'zzz')
  await page.waitForTimeout(200)
  check('y dice cuando no queda ninguna',
    !(await page.locator('#coleccionVacia').getAttribute('class')).includes('hidden'))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Y por la dirección vieja se sigue llegando ──')
{
  const { page } = await abrir('/coleccion/me05')
  check('el identificador de siempre resuelve',
    (await page.locator('.coleccion-carta').count()) === 4)
  // Y la barra pasa a decir la buena: una página, una dirección.
  check('…y la barra se corrige sola',
    new URL(page.url()).pathname === '/coleccion/pbl', new URL(page.url()).pathname)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5b. Y las dos mitades del 30 aniversario, cada una la suya ──')
{
  const { page } = await abrir('/coleccion/30c')
  // Desde la 646 la página del Celebration lleva también las de la Classic
  // (es un set, como en la API), y primero las suyas.
  check('la página del Celebration enseña las de las dos mitades (646)',
    (await page.locator('.coleccion-carta').count()) === 4,
    String(await page.locator('.coleccion-carta').count()))
  const orden = await page.locator('.coleccion-carta-nombre').allTextContents()
  check('  …primero las suyas y después las de la Classic', orden.join(' | ') === 'Pikachu | Mew | Charizard | Venusaur' || orden.join(' | ') === 'Charizard | Venusaur | Pikachu | Mew', orden.join(' | '))
  await page.close()
  // Y la dirección de la Classic lleva a la del 30 (646): es un set solo, y
  // dos direcciones para él las dejan a las dos a medias.
  const { page: p2 } = await abrir('/coleccion/30th-c')
  check('la dirección de la Classic lleva a la página del 30 (646)',
    new URL(p2.url()).pathname === '/coleccion/30c', new URL(p2.url()).pathname)
  check('  …con las cuatro cartas', (await p2.locator('.coleccion-carta').count()) === 4, String(await p2.locator('.coleccion-carta').count()))
  await p2.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. El buscador de /cartas busca en todo el catálogo ──')
{
  // Desde la 649 es la pestaña Buscar de la estantería (los filtros por
  // tipo viven en su hoja de filtros, que prueba la 447).
  const { page } = await abrir('/cartas')
  await page.click('[data-pestania="buscar"]')
  await page.fill('#mcBuscarTodo', 'magikarp')
  await page.waitForTimeout(900)
  check('encuentra por el nombre', (await page.locator('.mc-resultado').count()) === 1, String(await page.locator('.mc-resultado').count()))
  await page.locator('.mc-resultado').first().click()
  await page.waitForTimeout(800)
  check('…y el resultado abre la ficha emergente', await page.locator('#mcEditor').evaluate((d) => d.open))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. La imagen que el listado de un set no trae ──')
{
  const { detalleDeCarta, imagePathFromUrl } = await import('/home/user/pingu/js/carta-detalle.js')
  check('la ficha de una carta la recupera',
    detalleDeCarta({ image: 'https://assets.tcgdex.net/en/me/30th-c/001' }).image_path === 'me/30th-c/001',
    detalleDeCarta({ image: 'https://assets.tcgdex.net/en/me/30th-c/001' }).image_path)
  // Y si no viene, la clave NI SE ESCRIBE: un null encima borraría la
  // que ya estaba bien.
  check('…y si no viene, no la toca', !('image_path' in detalleDeCarta({ name: 'X' })))
  check('sigue exportada donde estaba', imagePathFromUrl('https://x.net/en/a/b') === 'a/b')
  const tcgdex = readFileSync('/home/user/pingu/js/tcgdex.js', 'utf8')
  check('y tcgdex la importa en vez de copiarla',
    /import \{ imagePathFromUrl \} from '\.\/carta-detalle\.js'/.test(tcgdex) &&
    !/function imagePathFromUrl/.test(tcgdex))
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
