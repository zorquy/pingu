// Tanda 649 en pantalla — /cartas es Mi colección en modo catálogo.
//
// PINGU: «a mí me gusta más el apartado de colecciones porque es más
// pequeño, tiene más información y cuando clicas en una carta te sale el
// pop-up y desde ahí puedes ir a la ficha». Así que el catálogo público
// pasa a ser esa pantalla: la estantería con TODAS las expansiones, la
// expansión por dentro y la ficha emergente — sin cuenta también, y con
// cuenta enseñando tu progreso. Mi colección CONSERVA su pestaña de
// Expansiones (se pensó quitarla y PINGU paró: «creo que es muy
// importante»), y el «Ver todas» del Panel abre esa pestaña con TODAS,
// quitando «solo las empezadas» si estaba puesto.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { generarCartas } from '/home/user/pingu/generar-cartas.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 0. cartas.html es lo que sale del generador, byte a byte ──')
{
  // Dos copias de 1.400 líneas se separan sin que nadie lo vea; por eso
  // la única forma de escribir cartas.html es el guion, y esto lo vigila.
  check('cartas.html == generarCartas(mi-coleccion.html)', generarCartas(leer('mi-coleccion.html')) === leer('cartas.html'),
    'ejecuta `node generar-cartas.mjs`')
  const cartas = leer('cartas.html')
  check('  …indexable, con su descripción y su canónica', !/name="robots"/.test(cartas) && /<meta name="description"/.test(cartas) && /rel="canonical" href="https:\/\/pokedoc\.es\/cartas\.html"/.test(cartas))
  check('  …empieza por el doctype', cartas.startsWith('<!DOCTYPE html>\n'))
  check('  …y en modo catálogo', /<body data-modo="catalogo">/.test(cartas))
  check('  …con dos pestañas: Expansiones y Buscar', /data-pestania="album"[^>]*>[^<]*<span class="mc-menu-texto">Expansiones/.test(cartas) && /data-pestania="buscar"/.test(cartas) && !/data-pestania="resumen"/.test(cartas) && !/data-pestania="cambios"/.test(cartas))
  const mc = leer('mi-coleccion.html')
  check('Mi colección sigue en noindex y conserva su pestaña de Expansiones',
    /name="robots" content="noindex"/.test(mc) && /<button[^>]*data-pestania="album"[^>]*aria-controls="mcPanelAlbum"/.test(mc))
  check('  …y el JavaScript viejo de /cartas ya no existe', !existe('js/cartas.js') && !/\.serie-fila|\.cartas-buscador/.test(leer('css/carta.css')))
}
function existe(f) {
  try { readFileSync(`${RAIZ}/${f}`); return true } catch { return false }
}

const browser = await chromium.launch()
const SETS = [
  { id: 'me02', name: '30th Celebration', name_en: '30th Celebration', serie_id: 'me', serie_name_en: 'Mega Evolution', market: 'WEST', release_date: '2026-09-16', card_count_official: 92, card_count_total: 92, tcg_online_code: '30C', tcggo_id: 431 },
  { id: 'me05', name: 'Pitch Black', name_en: 'Pitch Black', serie_id: 'me', serie_name_en: 'Mega Evolution', market: 'WEST', release_date: '2026-07-17', card_count_official: 120, card_count_total: 120, tcg_online_code: 'PBL', tcggo_id: 415 },
  { id: 'sv8', name: 'Chispas Fulgurantes', name_en: 'Surging Sparks', serie_id: 'sv', serie_name_en: 'Scarlet & Violet', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252, tcg_online_code: 'SSP', tcggo_id: 300 },
]
const CARTAS = [
  { id: 'me02-1', market: 'WEST', set_id: 'me02', local_id: '1', name: 'Mew', name_es: 'Mew', image_path: 'x/1', category: 'Pokemon', variants: { normal: true } },
  { id: 'me02-2', market: 'WEST', set_id: 'me02', local_id: '2', name: 'Pikachu', name_es: 'Pikachu', image_path: 'x/2', category: 'Pokemon', variants: { normal: true } },
  { id: 'me05-1', market: 'WEST', set_id: 'me05', local_id: '1', name: 'Tropius', name_es: 'Tropius', image_path: 'x/3', category: 'Pokemon', variants: { normal: true } },
]
const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion
  window.__FAKE_SETS__ = window.__S
  window.__FAKE_CARTAS__ = window.__C
  window.__FAKE_COLECCION__ = sesion === 'none' ? [] : [{ id: 'l1', card_id: 'me02-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
  window.__FAKE_SET_VALOR__ = [
    { set_id: 'me02', market: 'WEST', dia: '2026-09-29', valor_cm: 12000 },
    { set_id: 'me02', market: 'WEST', dia: '2026-10-05', valor_cm: 11133.72 },
  ]
}
const cartaFalsa = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" rx="12" fill="#c9a227"/></svg>`
  return { status: 200, contentType: 'image/svg+xml', body: svg }
}
async function abrir(ruta, { sesion = 'none', ancho = 1200 } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))
  await page.addInitScript(([s, c]) => { window.__S = s; window.__C = c }, [SETS, CARTAS])
  await page.addInitScript(semilla, { sesion })
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill(cartaFalsa()))
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

console.log('\n── 1. /cartas sin cuenta: todas las expansiones, la de Mi colección ──')
{
  const { page, errores } = await abrir('/cartas')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el título de la página es el del catálogo y se ve', limpio(await page.locator('main h1').innerText()) === 'Cartas de Pokémon TCG' && (await page.locator('main h1').isVisible()))
  check('  …y solo hay un h1', (await page.locator('h1').count()) === 1)
  check('la puerta de «entra para guardar tus cartas» NO sale', !(await page.locator('#mcEntrar').isVisible()))
  check('ni el avatar ni las cifras de perfil', !(await page.locator('#mcHeroAvatar').isVisible()) && !(await page.locator('#mcResumen').isVisible()))
  const pestanas = (await page.locator('#mcMenu .mc-pestania').allInnerTexts()).map(limpio)
  check('dos pestañas: Expansiones y Buscar', pestanas.join('|') === 'Expansiones|Buscar', pestanas.join('|'))
  const nombres = (await page.locator('.mc-set-tarjeta .mc-set-nombre').allInnerTexts()).map(limpio)
  check('las TRES expansiones, tengas o no (sin cuenta no tienes ninguna)', nombres.length === 3 && nombres.includes('Chispas Fulgurantes'), nombres.join(' | '))
  const treinta = page.locator('.mc-set-tarjeta').filter({ hasText: '30th Celebration' })
  const texto = limpio(await treinta.innerText())
  check('  …con lo que valen y cómo van', /11\.134 €/.test(texto) && /−7 %|-7 %/.test(texto), texto)
  check('«Solo las empezadas» no está: sin cuenta no hay nada empezado', !(await page.locator('#mcEstanteriaEmpezadas').isVisible()))
  check('la dirección se queda limpia (la pestaña por defecto no va en ella)', !page.url().includes('ver='), page.url())

  // Dentro de una expansión, y la ficha emergente.
  await treinta.first().click()
  await page.waitForTimeout(1500)
  check('abrir una expansión la abre AQUÍ, en la página', /[?&]set=me02/.test(page.url()) && (await page.locator('#mcAlbum .mc-bolsillo').count()) === 2, page.url())
  check('  …y la estrella de favorita no sale sin cuenta', !(await page.locator('#mcAlbumFavorito').isVisible()))
  await page.locator('#mcAlbum .mc-bolsillo-enlace').first().click()
  await page.waitForTimeout(900)
  const ficha = page.locator('#mcEditor')
  check('tocar una carta abre la ficha emergente', await ficha.evaluate((d) => d.open))
  check('  …que dice «entra» en vez de ofrecer añadir', (await page.locator('#mcEdEntrarBloque').isVisible()) && !(await page.locator('#mcEdAcciones').isVisible()) && !(await page.locator('#mcEdCopiaBloque').isVisible()))
  const volver = await page.locator('#mcEdEntrar').getAttribute('href')
  check('  …y el enlace de entrar vuelve a esta página con la expansión abierta', /^\/auth\.html\?volver=%2Fcartas%3Fset%3Dme02/.test(volver || ''), volver)
  check('  …con el camino a la ficha completa', /^\/carta\//.test((await page.locator('#mcEdFicha').getAttribute('href')) || ''))
  await page.close()
}

console.log('\n── 2. /cartas con cuenta: lo mismo, con tu progreso y tu copia ──')
{
  const { page, errores } = await abrir('/cartas', { sesion: 'admin-1' })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const nombres = (await page.locator('.mc-set-tarjeta .mc-set-nombre').allInnerTexts()).map(limpio)
  check('las tres expansiones también (no solo la empezada)', nombres.length === 3, nombres.join(' | '))
  const treinta = page.locator('.mc-set-tarjeta').filter({ hasText: '30th Celebration' })
  check('  …y la tuya enseña tu progreso: 1 de 92', /1 de 92/.test(limpio(await treinta.innerText())), limpio(await treinta.innerText()))
  check('«Solo las empezadas» sí está con cuenta', await page.locator('#mcEstanteriaEmpezadas').isVisible())
  check('el título sigue siendo el del catálogo, no «Mi colección»', limpio(await page.locator('main h1').innerText()) === 'Cartas de Pokémon TCG')
  await treinta.first().click()
  await page.waitForTimeout(1500)
  await page.locator('#mcAlbum .mc-bolsillo-enlace').first().click()
  await page.waitForTimeout(900)
  check('la ficha de tu carta enseña tu copia, no «entra»', (await page.locator('#mcEdCopiaBloque').isVisible()) && !(await page.locator('#mcEdEntrarBloque').isVisible()))
  await page.locator('#mcEdCerrar').click()
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(1).click()
  await page.waitForTimeout(900)
  check('  …y la de una que no tienes ofrece añadirla (el «+» bajo la carta, 650)', (await page.locator('#mcEdMas').isVisible()) && !(await page.locator('#mcEdCopiaBloque').isVisible()) && !(await page.locator('#mcEdEntrarBloque').isVisible()))
  await page.close()
}

console.log('\n── 3. Mi colección: Expansiones sigue en el menú, y «Ver todas» son TODAS ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html', { sesion: 'admin-1' })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const pestanas = (await page.locator('#mcMenu .mc-pestania').allInnerTexts()).map(limpio)
  check('el menú: Panel, Expansiones, Pokédex, Álbumes, Buscar', pestanas.join('|') === 'Panel|Expansiones|Pokédex|Álbumes|Buscar', pestanas.join('|'))
  // «Solo las empezadas» puesto de antes, y después «Ver todas»: tiene
  // que quitarse, que si no el Panel dice «ver todas» y la estantería
  // enseña una.
  await page.click('[data-pestania="album"]')
  await page.waitForTimeout(600)
  await page.click('#mcEstanteriaEmpezadas')
  await page.waitForTimeout(600)
  check('con «solo las empezadas» se ve una', (await page.locator('#mcEstanteriaRejilla .mc-set-tarjeta').count()) === 1)
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(600)
  const vistazo = page.locator('.mc-vistazo').filter({ has: page.locator('h2', { hasText: 'Expansiones' }) })
  await vistazo.locator('[data-ir-a="album"]').click()
  await page.waitForTimeout(800)
  check('«Ver todas» abre la estantería con las TRES', (await page.locator('#mcPanelAlbum').isVisible()) && (await page.locator('#mcEstanteriaRejilla .mc-set-tarjeta').count()) === 3, String(await page.locator('#mcEstanteriaRejilla .mc-set-tarjeta').count()))
  check('  …y el botón de «solo las empezadas» queda sin pulsar', (await page.locator('#mcEstanteriaEmpezadas').getAttribute('aria-pressed')) === 'false')
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(600)
  await vistazo.locator('[data-set="me02"]').first().click()
  await page.waitForTimeout(1500)
  check('una expansión del vistazo se abre aquí mismo, con tu progreso', (await page.locator('#mcPanelAlbum').isVisible()) && (await page.locator('#mcAlbum .mc-bolsillo').count()) === 2 && /1 de 2 cartas/.test(limpio(await page.locator('#mcPanelAlbum').innerText())))
  await page.close()
}

console.log('\n── 4. En el móvil ──')
{
  const { page, errores } = await abrir('/cartas', { ancho: 390 })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('sin desplazamiento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  check('el título cabe y se ve', await page.locator('main h1').isVisible())
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
