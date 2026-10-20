// Tanda 911 — los idiomas en los que salió cada set, y el corazón de «La
// quiero» en la expansión.
//
// PINGU, con el Virizion-EX de Plasma Blast: al añadirla o al darle a «La
// quiero» salían todos los idiomas, y Plasma Blast salió en inglés, francés,
// alemán, italiano y portugués (no en español). En el japonés, al revés: una
// carta que Cardmarket vende en coreano y en chino solo se podía apuntar en
// japonés. Y: «cartas que tengo como "la quiero", además de estar en gris
// porque no las tengo, ¿no se podría meterles un corazón?».
//
// Lo que se mira:
//   1. `idiomas_de_set` contra PostgreSQL: los anuncios de Cardmarket y la
//      ficha de TCGdex sumados, el portugués de regalo donde no hay ficha, el
//      japonés con coreano y chino, y el coreano admitido en las dos tablas.
//   2. Lo puro: `acotarIdiomas` e `idiomasParaAnadirEn`.
//   3. En Mi colección: la hoja de añadir y «La quiero» de una de Plasma
//      Blast sin español; sin la migración, todos como antes; una japonesa
//      con coreano y chino.
//   4. /carta: su hoja de añadir, igual.
//   5. El corazón en las casillas de las que quieres y no tienes.
import { readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const PRUEBAS = new URL('.', import.meta.url).pathname
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. La migración, contra PostgreSQL ──')
{
  const PSQL = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
  const hay = spawnSync('psql', [...PSQL, '-At', '-c', 'select 1'], { encoding: 'utf8' })
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    execFileSync('psql', [...PSQL, '-c', 'drop database if exists pd911'], { encoding: 'utf8' })
    execFileSync('psql', [...PSQL, '-c', 'create database pd911'], { encoding: 'utf8' })
    const db = [...PSQL, '-d', 'pd911']
    execFileSync('psql', [...db, '-f', `${PRUEBAS}sql-tanda-911.sql`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const migrar = () => spawnSync('psql', [...db, '-f', `${RAIZ}/supabase-migration-911-idiomas-de-set.sql`], { encoding: 'utf8' })
    const r1 = migrar()
    check('la migración pasa', r1.status === 0, r1.stderr.slice(0, 300))
    check('  …y dos veces', migrar().status === 0)
    const q = (sql) => execFileSync('psql', [...db, '-At', '-c', sql], { encoding: 'utf8' }).trim()
    check('Plasma Blast: inglés, alemán, francés, italiano y portugués, sin español', q(`select public.idiomas_de_set('bw10')`) === '{de,en,fr,it,pt}', q(`select public.idiomas_de_set('bw10')`))
    check('  …un precio a 0 no cuenta como anuncio', !q(`select public.idiomas_de_set('bw10')`).includes('es'))
    check('Gym Heroes: la ficha dice solo inglés, los anuncios suman español y alemán (y sin portugués: la ficha no lo tiene)', q(`select public.idiomas_de_set('gym1')`) === '{de,en,es}', q(`select public.idiomas_de_set('gym1')`))
    check('un set que TCGdex no tiene lleva el portugués de regalo', q(`select public.idiomas_de_set('tcggo-9')`) === '{en,es,pt}', q(`select public.idiomas_de_set('tcggo-9')`))
    check('el japonés: japonés, coreano y chino, y sin portugués', q(`select public.idiomas_de_set('M6A', 'JP')`) === '{ja,ko,zh}', q(`select public.idiomas_de_set('M6A', 'JP')`))
    check('el mismo id en el otro catálogo no se mezcla', q(`select public.idiomas_de_set('M6A', 'WEST')`) === '{}')
    check('un set sin precios ni ficha: vacío («no se sabe», la web ofrece todos)', q(`select public.idiomas_de_set('vacio')`) === '{}')
    check('la ficha de TCGdex entra entera (los 220 y pico sets)', Number(q('select count(*) from public.tcg_set_idiomas')) > 200)
    const ko = spawnSync('psql', [...db, '-c', `insert into public.user_collection (idioma) values ('ko'); insert into public.user_wants (idioma) values ('ko')`], { encoding: 'utf8' })
    check('el coreano se puede guardar en la colección y en «La quiero»', ko.status === 0, ko.stderr.slice(0, 200))
    const mal = spawnSync('psql', [...db, '-c', `insert into public.user_collection (idioma) values ('xx')`], { encoding: 'utf8' })
    check('  …y lo que no es un idioma sigue fuera', mal.status !== 0)
    check('anon puede preguntarla', q(`select has_function_privilege('anon', 'public.idiomas_de_set(text, text)', 'execute')`) === 't')
  }
}

console.log('\n── 2. Lo puro ──')
{
  const { acotarIdiomas, idiomasParaAnadirEn, IDIOMAS } = await import(`${RAIZ}/js/cardmarket.js`)
  const ids = (l) => l.map((i) => i.id).join()
  const west = IDIOMAS.filter((i) => !['ko', 'zh'].includes(i.id))
  check('sin saber nada, todos', ids(acotarIdiomas(west, null)) === ids(west) && ids(acotarIdiomas(west, [])) === ids(west))
  check('Plasma Blast: fuera el español y el japonés', ids(acotarIdiomas(west, ['de', 'en', 'fr', 'it', 'pt'])) === 'en,fr,de,it,pt')
  check('«cualquiera» se queda', ids(acotarIdiomas([{ id: '' }, ...west], ['en'])) === ',en')
  check('si no quedara ninguno, la lista entera (una hoja sin idiomas no deja añadir)', ids(acotarIdiomas(west, ['ko'])) === ids(west))
  check('japonés sin saber: solo el japonés', ids(idiomasParaAnadirEn('JP', west, null)) === 'ja')
  check('japonés con su set: japonés, coreano y chino', ids(idiomasParaAnadirEn('JP', west, ['ja', 'ko', 'zh'])) === 'ja,ko,zh')
  check('  …y el japonés siempre, aunque solo haya anuncios en coreano', ids(idiomasParaAnadirEn('JP', west, ['ko'])) === 'ja,ko')
  check('occidental: los de la lista acotados', ids(idiomasParaAnadirEn('WEST', west, ['en', 'pt'])) === 'en,pt')
}

console.log('\n── 3. Mi colección: la hoja de añadir, «La quiero» y el corazón ──')
const SETS = [
  { id: 'bw10', name: 'Plasma Blast', serie_id: 'bw', market: 'WEST', release_date: '2013-08-14', card_count_official: 101 },
  { id: 'M6A', name: '30th Celebration (Japanese)', serie_id: 'm', market: 'JP', release_date: '2026-09-16', card_count_official: 100 },
]
const carta = (id, set, n, nombre, market = 'WEST') => ({ id, market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: SETS.find((s) => s.id === set).name, serie_id: SETS.find((s) => s.id === set).serie_id } })
const CARTAS = [carta('bw10-96', 'bw10', 96, 'Virizion-EX'), carta('bw10-1', 'bw10', 1, 'Tropius'), carta('bw10-2', 'bw10', 2, 'Shuckle'), carta('M6A-001', 'M6A', 1, 'Exeggcute', 'JP')]
// Tengo el Tropius; quiero el Virizion (no lo tengo) y el Tropius (sí).
const COLECCION = [{ id: 'l1', user_id: 'admin-1', card_id: 'bw10-1', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'normal', cantidad: 1, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' }]
const DESEOS = [{ id: 'd1', user_id: 'admin-1', card_id: 'bw10-96', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }, { id: 'd2', user_id: 'admin-1', card_id: 'bw10-1', idioma: 'fr', prioridad: 1, created_at: '2026-10-05T10:00:00Z' }]
const IDIOMAS_SET = { bw10: ['de', 'en', 'fr', 'it', 'pt'], M6A: ['ja', 'ko', 'zh'] }

const browser = await chromium.launch()
async function abrir({ idiomasSet = IDIOMAS_SET, deseos = DESEOS } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.deseos
    window.__FAKE_PERFILES__ = [{ id: 'admin-1', username: 'pingu' }]
    window.__FAKE_PRECIOS__ = []
    if (d.idiomasSet) window.__FAKE_IDIOMAS_SET__ = d.idiomasSet
  }, { SETS, CARTAS, COLECCION, deseos, idiomasSet })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
}
const chips = (page, sel) => page.$$eval(`${sel} .mc-idioma-chip`, (cs) => cs.map((c) => c.dataset.idioma).join())
const activo = (page, sel) => page.$eval(`${sel} .mc-idioma-chip.activo`, (c) => c.dataset.idioma).catch(() => '')

{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=bw10')
  await page.click('#mcAlbum .mc-mas[data-anadir="bw10-96"]')
  await page.waitForTimeout(700)
  check('Plasma Blast, añadir: inglés, francés, alemán, italiano y portugués', (await chips(page, '#mcAdIdiomas')) === 'en,fr,de,it,pt', await chips(page, '#mcAdIdiomas'))
  check('  …y queda uno elegido de los que hay', ['en', 'fr', 'de', 'it', 'pt'].includes(await activo(page, '#mcAdIdiomas')), await activo(page, '#mcAdIdiomas'))
  await page.click('#mcAdIdiomas .mc-idioma-chip[data-idioma="pt"]')
  check('  …tocar otro lo elige sin volver a sacar el español', (await activo(page, '#mcAdIdiomas')) === 'pt' && (await chips(page, '#mcAdIdiomas')) === 'en,fr,de,it,pt')
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(900)
  const guardada = await page.evaluate(() => window.__TABLAS__.user_collection.filter((l) => l.card_id === 'bw10-96').map((l) => l.idioma).join())
  check('  …y se guarda en portugués', guardada === 'pt', guardada)

  console.log('── el corazón ──')
  await ir(page, '/mi-coleccion.html?ver=album&set=bw10')
  const marcas = () => page.$$eval('#mcAlbum [data-carta]', (as) => as.map((a) => `${a.dataset.carta}:${a.querySelector('.mc-quiero-marca') ? 'q' : '-'}`).join())
  // Al recargar, la colección es la sembrada: la Virizion vuelve a faltar.
  check('las que tienes no llevan corazón aunque las quieras', (await marcas()).includes('bw10-1:-'), await marcas())
  check('  …y la que quieres y no tienes, sí', (await marcas()).includes('bw10-96:q'), await marcas())
  check('  …ni la que no quieres', (await marcas()).includes('bw10-2:-'))
  await page.locator('#mcAlbum [data-carta="bw10-2"]').first().click()
  await page.waitForTimeout(900)
  await page.click('#mcEdQuiero')
  await page.waitForTimeout(600)
  check('«La quiero» de Plasma Blast: cualquiera e inglés, francés, alemán, italiano y portugués', (await chips(page, '#iddChips')) === ',en,fr,de,it,pt', await chips(page, '#iddChips'))
  await page.click('#iddApuntar')
  await page.waitForTimeout(900)
  check('al ponerle el corazón en la ficha, sale en su casilla al momento', (await marcas()).includes('bw10-2:q'), await marcas())
  const etiqueta = await page.getAttribute('#mcAlbum [data-carta="bw10-2"]', 'aria-label')
  check('  …y su casilla lo dice en voz alta', /la quieres/.test(etiqueta || ''), etiqueta)
  const color = await page.$eval('#mcAlbum [data-carta="bw10-2"] .mc-quiero-marca', (m) => getComputedStyle(m).color)
  check('  …en rosa, y fuera del gris de la carta', color !== 'rgb(128, 128, 128)' && !/grayscale/.test(await page.$eval('#mcAlbum [data-carta="bw10-2"] .mc-quiero-marca', (m) => getComputedStyle(m).filter)), color)
  await page.click('#mcEdQuiero')
  await page.waitForTimeout(900)
  check('y al quitarlo, se va', (await marcas()).includes('bw10-2:-'), await marcas())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir({ deseos: [DESEOS[0]] })
  await ir(page, '/mi-coleccion.html?ver=album&set=bw10&vista=cuadricula')
  const hay = await page.$$eval('#mcAlbum [data-carta="bw10-96"] .mc-quiero-marca', (m) => m.length)
  check('una que quieres y no tienes lleva su corazón al abrir la expansión', hay === 1, String(hay))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir({ idiomasSet: null })
  await ir(page, '/mi-coleccion.html?ver=album&set=bw10')
  await page.click('#mcAlbum .mc-mas[data-anadir="bw10-96"]')
  await page.waitForTimeout(700)
  check('sin la migración: los de siempre, como antes', (await chips(page, '#mcAdIdiomas')) === 'es,en,fr,de,it,pt,ja', await chips(page, '#mcAdIdiomas'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=M6A&catalogo=JP')
  await page.click('#mcAlbum .mc-mas[data-anadir="M6A-001"]')
  await page.waitForTimeout(700)
  check('una japonesa: japonés, coreano y chino', (await chips(page, '#mcAdIdiomas')) === 'ja,ko,zh', await chips(page, '#mcAdIdiomas'))
  check('  …con el japonés elegido', (await activo(page, '#mcAdIdiomas')) === 'ja')
  await page.keyboard.press('Escape')
  await page.locator('#mcAlbum [data-carta="M6A-001"]').first().click()
  await page.waitForTimeout(900)
  await page.click('#mcEdQuiero')
  await page.waitForTimeout(600)
  check('«La quiero» de una japonesa: japonés, coreano y chino (sin «cualquiera»)', (await chips(page, '#iddChips')) === 'ja,ko,zh', await chips(page, '#iddChips'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 4. /carta ──')
{
  const { ctx, page, errores } = await abrir()
  await page.goto(`${BASE}/carta.html?id=bw10-96`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.click('#cmAnadir')
  await page.waitForTimeout(800)
  check('la hoja de añadir de /carta: sin español', (await chips(page, '#cmAdIdiomas')) === 'en,fr,de,it,pt', await chips(page, '#cmAdIdiomas'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
// Una japonesa no tiene /carta (es solo del catálogo occidental): su ficha
// es la de Mi colección, que es la que se mira arriba.

console.log('\n── 6. Lo estático ──')
{
  const mc = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  // celdaDeCuadriculaHtml se fue en la 927: la cuadrícula son los bolsillos.
  for (const f of ['bolsilloDeVariante', 'bolsilloHtml']) {
    const cuerpo = mc.slice(mc.indexOf(`function ${f}(`), mc.indexOf('\n}\n', mc.indexOf(`function ${f}(`)))
    check(`${f} pinta el corazón`, /quieroHtml\(c\.id, n\)/.test(cuerpo))
  }
  check('el doble y la web pasan por la misma pregunta (`idiomas_de_set`)', /rpc\('idiomas_de_set'/.test(readFileSync(`${RAIZ}/js/idiomas-de-set.js`, 'utf8')))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
