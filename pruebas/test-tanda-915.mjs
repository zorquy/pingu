// Tanda 915 — la ficha de una carta, como el Dex del móvil.
//
// PINGU, con las capturas de Dex delante: «la vista que tienen en el móvil sí
// me gusta… tú despliegas lo de las variantes y te saca con un check las que
// tienes», y «es muy importante enseñar los precios por idioma». Y a las
// preguntas de la propuesta, que lo resolviera yo: idiomas del set (los que
// nadie vende, en gris), TCGplayer al final, el «+» suma una igual con
// Deshacer, y «Quién la tiene» de todos, los que sigues primero.
//
// Lo que se mira:
//   0. La migración de «Quién la tiene», contra PostgreSQL.
//   1. Móvil: la carta arriba y el nombre DEBAJO; la fila de la versión abre
//      la lista con su check; «− Tienes N +» suma con Deshacer, resta, y
//      Deshacer deja lo de antes; «Tienes N» abre tus copias y «Añadir otra
//      copia» la hoja de siempre.
//   2. Los precios: una tarjeta por idioma del set, la de tu copia la primera,
//      los que nadie vende en gris, TCGplayer la última; cada una a Cardmarket
//      con su idioma.
//   3. Una que no tienes: el botón grande de añadir, sin «−».
//   4. Quién la tiene: los que sigues primero, «la da», y de una colección
//      privada solo lo que da; sin la migración, el bloque no sale y no hay error.
//   5. Atributos en filas; el ilustrador y la expansión llevan a su sitio.
//   6. Ordenador: dos columnas, los atributos en dos, las flechas arriba.
import { readFileSync } from 'node:fs'
import { spawnSync, execFileSync } from 'node:child_process'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const PRUEBAS = new URL('.', import.meta.url).pathname
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 0. La migración, contra PostgreSQL ──')
{
  const PSQL = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
  const hay = spawnSync('psql', [...PSQL, '-At', '-c', 'select 1'], { encoding: 'utf8' })
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    execFileSync('psql', [...PSQL, '-c', 'drop database if exists pd915'], { encoding: 'utf8' })
    execFileSync('psql', [...PSQL, '-c', 'create database pd915'], { encoding: 'utf8' })
    const db = [...PSQL, '-d', 'pd915']
    execFileSync('psql', [...db, '-f', `${PRUEBAS}sql-tanda-915.sql`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const migrar = () => spawnSync('psql', [...db, '-f', `${RAIZ}/supabase-migration-915-quien-la-tiene.sql`], { encoding: 'utf8' })
    const r1 = migrar()
    check('la migración pasa', r1.status === 0, r1.stderr.slice(0, 300))
    check('  …y dos veces', migrar().status === 0)
    const q = (sql, yo = null) => execFileSync('psql', [...db, '-At', '-c', `${yo ? `set request.jwt.claim.sub = '${yo}'; ` : ''}${sql}`], { encoding: 'utf8' }).trim()
    const YO = '00000000-0000-0000-0000-000000000001'
    const como = q(`select string_agg(username || ':' || copias || ':' || da || ':' || sigues, ' ' order by n) from (select *, row_number() over () n from public.coleccion_quien_la_tiene_todos('sv8-238')) x`, YO)
    check('a la que sigo primero, luego los que la dan, luego quien más tiene', como === 'ana:1:0:true caro:1:1:false fede:1:1:false beto:5:0:false', como)
    check('  …de una colección privada, solo las que da (caro tiene 3, da 1)', /caro:1:1/.test(como))
    check('  …ni yo, ni quien no la da con la colección privada, ni un baneado', !/yo:|dani:|eva:/.test(como), como)
    check('  …y el total, para «y N más»', q(`select distinct total from public.coleccion_quien_la_tiene_todos('sv8-238')`, YO) === '4')
    check('el tope se respeta', q(`select count(*) from public.coleccion_quien_la_tiene_todos('sv8-238', 2)`, YO) === '2')
    check('sin cuenta también se ve (anon puede preguntarla)', q(`select has_function_privilege('anon', 'public.coleccion_quien_la_tiene_todos(text, int)', 'execute')`) === 't')
  }
}

// ── La web ──
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }]
const carta = (n, nombre, extra = {}) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, image_path: `sv/sv8/${n}`, rarity: 'Special Illustration Rare', category: 'Pokemon', types: ['Lightning'], dex_ids: [25], illustrator: 'Mitsuhiro Arita', variants: { normal: true, reverse: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', release_date: '2024-11-08', card_count_official: 191 }, ...extra })
const CARTAS = [carta(238, 'Pikachu ex'), carta(239, 'Raichu')]
const PRECIOS = [{ card_id: 'sv8-238', cm_id_product: 777, cm_low: 20, cm_low_es: 28.8, cm_low_en: 24.5, cm_low_it: 27.4, tp_market_eur: 31.2, checked_at: '2026-10-19T10:00:00Z' }]
const PERFILES = [
  { id: 'admin-1', username: 'pingu' },
  { id: 'u-ana', username: 'ana', coleccion_publica: true },
  { id: 'u-beto', username: 'beto', coleccion_publica: true },
  { id: 'u-caro', username: 'caro', coleccion_publica: false },
]
const COLECCION = [
  { id: 'l1', user_id: 'admin-1', card_id: 'sv8-238', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 2, created_at: '2026-10-01T10:00:00Z' },
  { id: 'o1', user_id: 'u-ana', card_id: 'sv8-238', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 0, created_at: '2026-10-01T10:00:00Z' },
  { id: 'o2', user_id: 'u-beto', card_id: 'sv8-238', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'normal', cantidad: 4, cambio: 0, created_at: '2026-10-01T10:00:00Z' },
  { id: 'o3', user_id: 'u-caro', card_id: 'sv8-238', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'normal', cantidad: 3, cambio: 1, created_at: '2026-10-01T10:00:00Z' },
]
const browser = await chromium.launch()
async function abrir({ movil = true, sinQuien = false } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_PRECIOS__ = d.PRECIOS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_SEGUIDOS__ = [{ follower_id: 'admin-1', following_id: 'u-ana' }]
    window.__FAKE_DESEOS__ = []
    window.__FAKE_IDIOMAS_SET__ = { sv8: ['de', 'en', 'es', 'fr', 'it'] }
    if (d.sinQuien) window.__SIN_QUIEN_915__ = true
  }, { SETS, CARTAS, PRECIOS, COLECCION, PERFILES, sinQuien })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" rx="24" fill="#f59e0b"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { ctx, page, errores }
}
const abrirFicha = async (page, id) => {
  await page.locator(`#mcAlbum [data-carta="${id}"]`).first().click()
  await page.waitForTimeout(1300)
}
const tienes = (page) => page.locator('#mcEdTienes').innerText().then(limpio)

console.log('\n── 1. Móvil: la carta arriba, la versión, «− Tienes N +» ──')
{
  const { ctx, page, errores } = await abrir()
  await abrirFicha(page, 'sv8-238')
  const foto = await page.locator('#mcEdFoto').boundingBox()
  const titulo = await page.locator('#mcEditorTitulo').boundingBox()
  check('la carta arriba y el nombre debajo, centrado (como Dex)', titulo.y >= foto.y + foto.height - 1 && (await page.locator('#mcEditorTitulo').evaluate((h) => getComputedStyle(h.parentElement).textAlign)) === 'center', JSON.stringify({ foto: Math.round(foto.y + foto.height), titulo: Math.round(titulo.y) }))
  // Desde la 920, «un poquito más pequeña» (PINGU): 264 px como mucho.
  check('  …la carta, grande pero sin pasarse: entre el 55 % del ancho y 264 px', foto.width >= 390 * 0.55 && foto.width <= 264, String(foto.width))
  check('el corazón y compartir, arriba', (await page.locator('#mcEdQuiero').isVisible()) && (await page.locator('#mcEdCompartir').isVisible()))
  check('la versión en su fila: Normal', limpio(await page.locator('#mcEdVersionNombre').innerText()) === 'Normal')
  await page.click('#mcEdVersion')
  await page.waitForTimeout(200)
  const versiones = await page.$$eval('#mcEdVersiones .mc-version', (bs) => bs.map((b) => `${b.dataset.version}|${b.querySelector('small').textContent}|${b.querySelector('.mc-version-check').classList.contains('si')}|${b.querySelector('.mc-version-precio').textContent.trim()}`))
  check('al tocarla, las dos versiones: la normal con su check y su precio, la reverse sin cifra inventada', versiones.map(limpio).join(' ; ') === 'normal|Tienes 2|true|28,80 € ; reverse|No la tienes|false|', versiones.join(' ; '))
  await page.click('#mcEdVersiones [data-version="reverse"]')
  await page.waitForTimeout(600)
  check('  …y tocar una que no tienes abre la hoja de añadir con esa versión', await page.locator('#mcAnadirDialogo').evaluate((d) => d.open))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('«Tienes 2» y el «+» y el «−» a la vista', (await tienes(page)) === 'Tienes 2' && (await page.locator('#mcEdMenos').isVisible()) && (await page.locator('#mcEdMas').isVisible()))
  const altos = await page.$$eval('#mcEdMenos, #mcEdEditar, #mcEdMas', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)))
  check('  …de 56 px, para el dedo', altos.every((h) => h >= 44), altos.join())
  await page.click('#mcEdMas')
  await page.waitForTimeout(900)
  check('el «+» suma una igual: «Tienes 3», sin abrir ninguna hoja', (await tienes(page)) === 'Tienes 3' && !(await page.locator('#mcAnadirDialogo').evaluate((d) => d.open)), await tienes(page))
  const aviso = page.locator('.mc-aviso-deshacer, [class*="deshacer"]').filter({ hasText: 'una más' })
  check('  …y lo dice con Deshacer', (await aviso.count()) >= 1)
  await aviso.first().getByRole('button', { name: /Deshacer/ }).click()
  await page.waitForTimeout(1000)
  check('  …Deshacer deja las dos de antes', (await tienes(page)) === 'Tienes 2', await tienes(page))
  await page.click('#mcEdMenos')
  await page.waitForTimeout(900)
  check('el «−» quita una: «Tienes 1»', (await tienes(page)) === 'Tienes 1', await tienes(page))
  page.once('dialog', (d) => d.dismiss())
  await page.click('#mcEdMenos')
  await page.waitForTimeout(800)
  check('  …y la última pregunta antes de quitarla (y si dices que no, se queda)', (await tienes(page)) === 'Tienes 1', await tienes(page))
  await page.click('#mcEdEditar')
  await page.waitForTimeout(300)
  check('«Tienes N» abre tus copias, con sus campos', (await page.locator('#mcEdCopiaBloque').isVisible()) && (await page.locator('#mcEdIdioma').isVisible()))
  await page.click('#mcEdAnadirOtra')
  await page.waitForTimeout(600)
  check('  …y «Añadir otra copia» abre la hoja de siempre, con el idioma a elegir', (await page.locator('#mcAnadirDialogo').evaluate((d) => d.open)) && (await page.locator('#mcAdIdiomas .mc-idioma-chip').count()) >= 3)
  check('sin desplazamiento de lado a lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2. Los precios, una tarjeta por idioma ──')
{
  const { ctx, page, errores } = await abrir()
  await abrirFicha(page, 'sv8-238')
  await page.waitForTimeout(600)
  const tarjetas = await page.$$eval('#mcEdPrecioBloque .pv-tarjeta', (ts) => ts.map((t) => t.innerText.replace(/\s+/g, ' ').trim()))
  check('la de tu copia la primera, en español', /^ES tu copia 28,80 €/.test(tarjetas[0] || ''), tarjetas[0])
  check('  …luego los idiomas del set, con los que nadie vende en gris («sin precio»)', tarjetas.slice(1, 5).join(' | ') === 'EN 24,50 € Inglés | DE sin precio Alemán | FR sin precio Francés | IT 27,40 € Italiano', tarjetas.slice(1, 5).join(' | '))
  check('  …y TCGplayer la última', /^TCGplayer 31,20 €/.test(tarjetas[tarjetas.length - 1] || ''), tarjetas[tarjetas.length - 1])
  check('  …la de tu copia, en el azul fijo', (await page.locator('.pv-tarjeta-tuya').evaluate((t) => getComputedStyle(t).backgroundColor)) === 'rgb(30, 81, 117)')
  const enlaces = await page.$$eval('#mcEdPrecioBloque a.pv-tarjeta:not(.pv-tarjeta-tcg)', (as) => as.map((a) => new URL(a.href).searchParams.get('language')))
  check('cada tarjeta abre Cardmarket con su idioma', enlaces.join() === '4,1,3,2,5', enlaces.join())
  check('«Avísame si baja», debajo del precio', await page.locator('#mcEdPrecioSeccion #mcEdAviso').isVisible())
  check('se acabó la tabla de Cardmarket', (await page.locator('#mcEditor .pv-tabla').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Una que no tienes ──')
{
  const { ctx, page } = await abrir()
  await abrirFicha(page, 'sv8-239')
  check('el botón grande «Añadir a mi colección», sin «−» ni «Tienes»', limpio(await page.locator('#mcEdMas').innerText()) === '+ Añadir a mi colección' && !(await page.locator('#mcEdMenos').isVisible()) && !(await page.locator('#mcEdEditar').isVisible()))
  await page.click('#mcEdMas')
  await page.waitForTimeout(600)
  check('  …que abre la hoja de añadir', await page.locator('#mcAnadirDialogo').evaluate((d) => d.open))
  await ctx.close()
}

console.log('\n── 4. Quién la tiene ──')
{
  const { ctx, page, errores } = await abrir()
  await abrirFicha(page, 'sv8-238')
  await page.waitForTimeout(500)
  const gente = await page.$$eval('#mcEdQuien .mc-quien-persona', (as) => as.map((a) => [a.querySelector('.mc-quien-nombre'), ...a.querySelectorAll('.mc-quien-abajo > span')].map((x) => x.textContent.trim()).join(' ')))
  check('a la que sigues la primera, luego la que la da, luego quien más tiene', gente.join(' | ') === 'ana ×1 la sigues | caro ×1 la da | beto ×4', gente.join(' | '))
  check('  …la que la da lleva a sus cambios', /\/usuario\/caro\?ver=cambios$/.test(await page.locator('#mcEdQuien .mc-quien-persona').nth(1).getAttribute('href')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir({ sinQuien: true })
  await abrirFicha(page, 'sv8-238')
  await page.waitForTimeout(500)
  check('sin la migración, el bloque no sale y no hay error', !(await page.locator('#mcEdQuienBloque').isVisible()) && errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. Atributos en filas ──')
{
  const { ctx, page } = await abrir()
  await abrirFicha(page, 'sv8-238')
  const filas = await page.$$eval('#mcEdTabla .mc-atrib', (fs) => fs.map((f) => `${f.tagName}:${f.querySelector('small').textContent}=${f.querySelector('b').textContent}`))
  check('ilustrador, salida, expansión con número, rareza, tipo, categoría y Pokédex', filas.join(' | ') === 'A:Ilustrador=Mitsuhiro Arita | DIV:Salió=8 de noviembre de 2024 | A:Expansión=Chispas Fulgurantes · 238/191 | DIV:Rareza=Rara Ilustración Especial | DIV:Tipo de energía=Rayo | DIV:Categoría=Pokémon | DIV:N.º nacional=25', filas.join(' | '))
  check('  …el ilustrador lleva a sus cartas', /ver=buscar&q=Mitsuhiro\+Arita/.test(await page.locator('#mcEdTabla a.mc-atrib').first().getAttribute('href')))
  await ctx.close()
}

console.log('\n── 6. Ordenador ──')
{
  const { ctx, page, errores } = await abrir({ movil: false })
  await abrirFicha(page, 'sv8-238')
  const foto = await page.locator('#mcEdFoto').boundingBox()
  const titulo = await page.locator('#mcEditorTitulo').boundingBox()
  check('dos columnas: la carta a la izquierda y la ficha a su lado', titulo.x >= foto.x + foto.width && Math.abs(titulo.y - foto.y) < 120, JSON.stringify({ foto, titulo }))
  const cols = await page.$$eval('#mcEdTabla .mc-atrib', (fs) => new Set(fs.map((f) => Math.round(f.getBoundingClientRect().left))).size)
  check('  …los atributos en dos columnas', cols === 2, String(cols))
  check('  …y las flechas para pasar de carta, arriba', await page.locator('#mcEdSiguiente').isVisible())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 7. Lo estático ──')
{
  const mc = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  check('la ficha usa las tarjetas por idioma, no el bloque viejo', /tarjetasDePrecio\(/.test(mc) && !/bloqueDePrecio/.test(mc))
  check('cartas.html lleva la ficha nueva (generado)', /id="mcEdVersion"/.test(readFileSync(`${RAIZ}/cartas.html`, 'utf8')))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
