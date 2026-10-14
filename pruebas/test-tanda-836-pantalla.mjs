// Tandas 836–840 — la parte «Jugar» rehecha: /mazos con portada, estado,
// récord y lo que falta; el constructor con cabecera, «⋯» y barra abajo en
// el móvil; /mis-partidas con resumen y filtros plegados; /torneos más
// compacto; y los títulos de página con la misma letra.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Puro ──')
const N = await import(`${RAIZ}/js/mazos-nucleo.js`)
check('menos de 60: lo que falta, sin hablar de legal', N.estadoDelMazo(52, [], 'standard').texto === 'Faltan 8 para 60')
check('  …más de 60: lo que sobra', N.estadoDelMazo(62, [], 'standard').texto === 'Sobran 2')
check('  …60 con avisos: «revisar»; 60 limpio: «legal»', N.estadoDelMazo(60, [{}], 'standard').clase === 'mal' && N.estadoDelMazo(60, [], 'standard').texto === '60/60 · legal' && N.estadoDelMazo(60, [], 'libre').texto === '60/60')
check('el récord lleva empates solo si los hay', N.textoDeRecord({ win: 7, loss: 3, draw: 1 }) === '7-3-1' && N.textoDeRecord({ win: 2, loss: 1, draw: 0 }) === '2-1')
const recs = new Map([['b', { win: 3, loss: 1, draw: 0 }]])
check('primero el más jugado, luego el último tocado', N.ordenarMazos([{ id: 'a', updated_at: '2026-10-02' }, { id: 'b', updated_at: '2026-01-01' }, { id: 'c', updated_at: '2026-10-05' }], recs).map((m) => m.id).join() === 'b,c,a')
const P = (types, n) => ({ carta: { category: 'Pokemon', types }, n })
check('el color: el de la portada si es Pokémon; si no, el del que más copias tiene', N.tipoDelMazo([P(['Water'], 2), P(['Fire'], 4)], { category: 'Trainer' }) === 'Fire' && N.tipoDelMazo([P(['Fire'], 4)], { category: 'Pokemon', types: ['Psychic'] }) === 'Psychic')
check('el reparto cuenta copias por clase', JSON.stringify(N.reparto([P(['Fire'], 4), { carta: { category: 'Trainer' }, n: 30 }, { carta: { category: 'Energy' }, n: 10 }])) === '{"P":4,"T":30,"E":10}')

const c = (id, name, category, extra = {}) => ({ id, set_id: id.split('-')[0], market: 'WEST', local_id: id.split('-')[1], name, name_es: name, name_key: name.toLowerCase(), name_search: name.toLowerCase(), category, regulation_mark: 'H', image_path: `x/${id}`, ...extra })
const CARTAS = [
  c('ll1-15', 'Gengar', 'Pokemon', { types: ['Psychic'], stage: 'Basic', hp: 130 }),
  c('gym2-99', 'Psyduck', 'Pokemon', { types: ['Water'], stage: 'Basic', hp: 50 }),
  c('base1-82', 'Full Heal', 'Trainer', { trainer_type: 'Item' }),
  c('sve-5', 'Basic Psychic Energy', 'Energy', { energy_type: 'Normal', regulation_mark: null }),
]
const MAZOS = [
  { id: 'mazo-1', user_id: 'user-1', name: 'Gengar', format: 'standard', cards: [{ id: 'll1-15', n: 4 }, { id: 'base1-82', n: 4 }, { id: 'sve-5', n: 52 }], cover_card: 'll1-15', is_public: true },
  { id: 'mazo-2', user_id: 'user-1', name: 'Psyduck', format: 'standard', cards: [{ id: 'gym2-99', n: 4 }, { id: 'base1-82', n: 4 }], cover_card: 'gym2-99' },
]
const PARTIDAS = [...Array(7).fill('win'), ...Array(3).fill('loss'), 'draw'].map((r, i) => ({ user_id: 'user-1', resultado: r, user_deck_id: 'mazo-2', mi_mazo: 'd:psyduck', mi_mazo_nombre: 'Psyduck', rival_mazo: 'd:charizard', rival_mazo_nombre: 'Charizard ex', jugada_el: '2026-10-1' + (i % 9) }))
const SEM = { __FAKE_CARTAS__: CARTAS, __FAKE_MAZOS__: MAZOS, __FAKE_PARTIDAS__: PARTIDAS, __FAKE_PRECIOS__: [{ card_id: 'll1-15', cm_low: 12.5 }], __FAKE_COLECCION__: [{ user_id: 'user-1', card_id: 'gym2-99', cantidad: 4 }, { user_id: 'user-1', card_id: 'base1-82', cantidad: 9 }] }

const b = await chromium.launch()
async function abrir(ruta, { sem = SEM, movil = false, sesion = 'user-1' } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  await ctx.route(/^https:\/\/.*\.(png|webp|jpg)(\?.*)?$/i, (r) => r.fulfill({ status: 404, body: '' }))
  await ctx.addInitScript(([s, se]) => { window.__FAKE_SESSION__ = se; Object.assign(window, s) }, [sem, sesion])
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(2200)
  return { page, errores, ctx }
}

console.log('── 2. /mazos ──')
{
  const { page, errores, ctx } = await abrir('/mazos')
  const ids = await page.$$eval('.cm-mazo-tarjeta', (xs) => xs.map((x) => x.dataset.id))
  check('el que más juegas va primero', ids.join() === 'mazo-2,mazo-1', ids.join())
  check('  …y la cuenta lo dice', /el que más juegas va primero/.test(await page.textContent('#mzCuenta')))
  const t2 = page.locator('.cm-mazo-tarjeta[data-id="mazo-2"]')
  check('el récord de sus partidas apuntadas con ese mazo', /7-3-1 en tus partidas/.test(await t2.innerText()))
  check('  …lo que falta para 60', /Faltan 52 para 60/.test(await t2.innerText()))
  check('  …el color de su tipo', (await t2.getAttribute('data-tipo')) === 'Water')
  check('  …y la barra de Pokémon, Entrenadores y Energías', (await t2.locator('.mz-barra i').count()) === 3 && /4 Pokémon/.test(await t2.innerText()))
  check('lo que te falta sale solo: con todo, «Lo tienes entero»', /Lo tienes entero/.test(await t2.locator('[data-coste-caja]').innerText()), await t2.locator('[data-coste-caja]').innerText())
  const t1 = page.locator('.cm-mazo-tarjeta[data-id="mazo-1"]')
  check('  …y si no, cuántas y cuánto', /Faltan 4 · 50/.test(await t1.locator('[data-coste-caja]').innerText()), await t1.locator('[data-coste-caja]').innerText())
  check('  …y un mazo de 60 sin problemas dice «legal»', /60\/60 · legal/.test(await t1.innerText()), await t1.innerText())
  check('Portada, Duplicar y Borrar van dentro de «⋯»', !(await t1.locator('[data-portada]').isVisible()))
  await t1.locator('.cm-mazo-mas summary').click()
  check('  …que se abre', await t1.locator('[data-portada]').isVisible() && await t1.locator('[data-borrar]').isVisible())
  await page.mouse.click(5, 5)
  check('  …y se cierra al tocar fuera', !(await t1.locator('[data-portada]').isVisible()))
  check('«Importar lista» abre el constructor con la ventana de importar', (await page.getAttribute('#mzImportar', 'href')) === '/constructor?nuevo=1&importar=1')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { page, errores, ctx } = await abrir('/mazos', { sem: { ...SEM, __FAKE_MAZOS__: [] } })
  check('sin mazos: «Monta tu primer mazo» con tres caminos', await page.isVisible('#mzVacio') && (await page.locator('.mz-camino').count()) === 3)
  check('  …que llevan a empezar, a importar y al meta', (await page.$$eval('.mz-camino', (xs) => xs.map((x) => x.getAttribute('href')))).join() === '/constructor?nuevo=1,/constructor?nuevo=1&importar=1,/meta')
  check('  …y el abanico de tres cartas', (await page.locator('.mz-abanico-carta').count()) === 3)
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. El constructor ──')
{
  const { page, errores, ctx } = await abrir('/constructor?mazo=mazo-1')
  check('la cabecera lleva el anillo y el nombre', (await page.locator('#cmHero #cmTotal').count()) === 1 && (await page.locator('#cmHero #cmNombre').inputValue()) === 'Gengar')
  check('  …el color del Pokémon con más copias', (await page.getAttribute('#cmHero', 'data-tipo')) === 'Psychic')
  check('  …y sus chapas: formato y público', (await page.textContent('#cmChapaFormato')) === 'Estándar' && (await page.textContent('#cmChapaPublico')) === 'Público')
  check('el formato vive en «⋯»', !(await page.isVisible('#cmFormato')) && (await page.locator('#cmMenuHerramientas #cmFormato').count()) === 1)
  await page.click('#cmBtnHerramientas')
  await page.locator('#cmMenuHerramientas [data-valor="expanded"]').click().catch(() => {})
  await page.waitForTimeout(200)
  check('  …y tocar el formato no cierra el menú', await page.isVisible('#cmMenuHerramientas'))
  check('  …y lo cambia en la chapa', (await page.textContent('#cmChapaFormato')) === 'Expandido', await page.textContent('#cmChapaFormato'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { page, errores, ctx } = await abrir('/constructor?mazo=mazo-1', { movil: true })
  const acc = await page.$eval('#cmAcciones', (n) => ({ pos: getComputedStyle(n).position, bottom: getComputedStyle(n).bottom }))
  check('móvil: las acciones van pegadas abajo, encima de la burbuja', acc.pos === 'sticky' && parseFloat(acc.bottom) >= 150, JSON.stringify(acc))
  check('  …con «Añadir cartas»', await page.isVisible('#cmAnadirMovil'))
  const fila = await page.$eval('#cmMazo .cm-cartas', (n) => getComputedStyle(n).gridTemplateColumns.split(' ').length)
  check('  …y tres cartas por fila (el − y el + debajo)', fila === 3, fila)
  const mini = await page.$eval('#cmMazo .cm-mini', (n) => n.getBoundingClientRect())
  check('  …que miden 44', mini.width >= 44 && mini.height >= 44)
  check('  …sin salirse por el lado', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/constructor?nuevo=1&importar=1')
  check('?importar=1 abre «Importar una lista»', await page.isVisible('#cmModalImportar'))
  await ctx.close()
}

console.log('── 4. Mis partidas ──')
{
  const { page, errores, ctx } = await abrir('/mis-partidas')
  check('arriba, el resumen de todo lo jugado', await page.isVisible('#partidasHero') && /68 %/.test(await page.textContent('#partidasHero')) && /7-3-1/.test(await page.textContent('#partidasHero')), await page.textContent('#partidasHero'))
  check('  …con tu mazo más jugado', /Psyduck/.test(await page.textContent('#partidasHero')))
  check('los filtros de torneos, plegados tras «Filtrar»', !(await page.isVisible('#torneoBuscar')))
  await page.click('#torneoFiltrar')
  check('  …que los abre', await page.isVisible('#torneoBuscar') && (await page.getAttribute('#torneoFiltrar', 'aria-expanded')) === 'true')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Torneos y títulos ──')
{
  const T = [{ id: 't-1', slug: 'p', name: 'Pachanga', status: 'registration_open', start_at: new Date(Date.now() + 2 * 86400e3).toISOString(), max_players: 32, swiss_rounds: 4, admin_id: 'admin-1' }]
  const { page, errores, ctx } = await abrir('/torneos', { sem: { __FAKE_TORNEOS__: T } })
  check('arriba solo «Crear torneo» (Mis partidas y el constructor están en Jugar)', (await page.locator('.torneos-heroe-acciones > *').count()) === 1)
  const t = page.locator('.torneo-tarjeta').first()
  check('una tarjeta sin imagen lleva la franja corta', /torneo-tarjeta-sin-imagen/.test(await t.getAttribute('class')) && (await t.locator('.torneo-arte').evaluate((n) => n.getBoundingClientRect().height)) <= 64)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
for (const ruta of ['/aprender', '/mis-partidas', '/torneos', '/mazos', '/retos']) {
  const { page, ctx } = await abrir(ruta)
  const w = await page.$eval('h1', (h) => getComputedStyle(h).fontWeight)
  check(`${ruta}: el título con la letra de la cabecera común (600)`, w === '600', w)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
