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
const BASE = 'http://localhost:8892'
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
  { id: '30th', name: '30th Celebration', market: 'WEST', serie_id: '30th', serie_name: '30th Celebration',
    tcg_online_code: '30C', release_date: '2026-08-01', card_count_official: 160 },
  { id: '30thc', name: 'Classics Collection', market: 'WEST', serie_id: '30thc', serie_name: '30th Classics',
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
console.log('\n── 3. Las promos abren la era, y el 30 aniversario es UNO ──')
{
  const { page, errores } = await abrir('/cartas')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const series = await page.locator('.serie-titulo').allTextContents()
  check('el 30 aniversario no sale partido en dos',
    series.filter((t) => /30/.test(t)).length === 1, series.join(' | '))
  const mega = page.locator('.serie').filter({ hasText: 'Mega Evolution' }).first()
  const nombres = await mega.locator('.serie-nombre').allTextContents()
  check('promos primero, energías después y luego los sets',
    nombres.join(' | ') === 'MEP Black Star Promos | Mega Evolution Energy | Pitch Black | Mega Evolution',
    nombres.join(' | '))
  // Y el enlace de la fila ya lleva el código.
  const href = await mega.locator('.serie-fila').nth(2).getAttribute('href')
  check('la fila enlaza al código', href === '/coleccion/pbl', href)
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
console.log('\n── 6. El buscador de /cartas filtra por tipo ──')
{
  const { page } = await abrir('/cartas')
  const opciones = await page.locator('#buscarTipo option').count()
  check('hay desplegable de tipos', opciones > 5, String(opciones))
  await page.selectOption('#buscarTipo', 'Water')
  await page.waitForTimeout(600)
  check('un tipo SOLO ya es una búsqueda',
    (await page.locator('#resultados .coleccion-carta').count()) === 2,
    String(await page.locator('#resultados .coleccion-carta').count()))
  check('…y las colecciones se apartan',
    (await page.locator('#seccionColecciones').getAttribute('class')).includes('hidden'))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
