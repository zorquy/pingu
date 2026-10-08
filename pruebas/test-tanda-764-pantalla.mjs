// Tanda 764 — extras de los álbumes (Z2, Z4, Z5 y Z6 de la ronda 3).
//
//   · Z6: un álbum de set con UNA CASILLA POR VERSIÓN —el «master set»—:
//     cada versión con su chapa, y se tiene si tienes ESA versión;
//   · Z4: la portada de un binder, una carta, elegida en «Ordenar y quitar»
//     y grande en su baldosa;
//   · Z5: la lista del álbum como imagen para imprimir (número, nombre y
//     casilla, lo tuyo marcado), con lo puro probado sin lienzo;
//   · Z2: el enlace público se comparte, y quien lo abre ve de quién es.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { bolsillosPorVersion, tengoElBolsillo } from '/home/user/pingu/js/mi-coleccion/albumes.js'
import { textosDeChecklist, columnasDeChecklist } from '/home/user/pingu/js/mi-coleccion/imagen-checklist.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''

console.log('── 1. Lo puro ──')
{
  const b = bolsillosPorVersion([
    { id: 'a', variants: { normal: true, reverse: true } },
    { id: 'b', variants: { holo: true } },
    { id: 'c' },
  ])
  check('una casilla por versión; con una sola, o sin saber, una', JSON.stringify(b) === '[{"id":"a","v":"normal"},{"id":"a","v":"reverse"},{"id":"b"},{"id":"c"}]', JSON.stringify(b))
  const lineas = [{ card_id: 'a', variante: 'reverse' }, { card_id: 'b' }]
  check('se tiene la casilla si tienes ESA versión', !tengoElBolsillo({ id: 'a', v: 'normal' }, lineas) && tengoElBolsillo({ id: 'a', v: 'reverse' }, lineas) && tengoElBolsillo({ id: 'b' }, lineas) && tengoElBolsillo({ id: 'b', v: 'normal' }, lineas))
  const t = textosDeChecklist({ nombre: 'Chispas Fulgurantes', cartas: Array.from({ length: 10 }, (_, i) => ({ numero: String(i + 1), nombre: `C${i + 1}`, tengo: i < 3 })) })
  check('la lista: título, cuántas tienes y por columnas', t.titulo === 'Chispas Fulgurantes' && t.sub === 'tienes 3 de 10 · 30 %' && t.columnas === 2 && t.filas === 5 && t.lineas[5].col === 1 && t.lineas[5].fil === 0, JSON.stringify({ sub: t.sub, c: t.columnas, f: t.filas, l5: t.lineas[5] }))
  check('  …más columnas y más alto con más cartas', columnasDeChecklist(40) === 2 && columnasDeChecklist(100) === 3 && columnasDeChecklist(250) === 4 && textosDeChecklist({ cartas: Array.from({ length: 250 }, () => ({})) }).alto > 1900)
  check('  …y su fichero', t.fichero === 'pokedoc-checklist-chispas-fulgurantes.png', t.fichero)
  const sql = readFileSync(`${RAIZ}/supabase-migration-albumes-portada.sql`, 'utf8')
  check('la migración de la portada: una columna, sin tablas temporales', /add column if not exists portada text/.test(sql) && !/temp(orary)? table/i.test(sql))
}

const browser = await chromium.launch()
const CARTAS = [
  { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Uno', name_es: 'Uno', image_path: 'x/1', rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true } },
  { id: 'sv8-2', market: 'WEST', set_id: 'sv8', local_id: '2', name: 'Dos', name_es: 'Dos', image_path: 'x/2', rarity: 'Rare', category: 'Pokemon', variants: { holo: true } },
  { id: 'sv8-3', market: 'WEST', set_id: 'sv8', local_id: '3', name: 'Tres', name_es: 'Tres', image_path: 'x/3', rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true } },
]
async function abrir(ruta, { sesion = 'admin-1', albumes = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', permissions: ['clipboard-read', 'clipboard-write'] })
  await ctx.addInitScript(({ CARTAS, sesion, albumes }) => {
    window.__FAKE_SESSION__ = sesion
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 3, card_count_total: 3 }]
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [
      { id: 'l1', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'reverse', created_at: '2026-10-01T10:00:00Z' },
      { id: 'l2', user_id: 'admin-1', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' },
    ]
    window.__FAKE_ALBUMES__ = albumes
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'ana' }]
  }, { CARTAS, sesion, albumes })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}

console.log('── 2. Z6: un álbum de set, una casilla por versión ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas')
  await page.click('#mcAlbNuevoAbrir')
  await page.waitForTimeout(300)
  await page.click('[data-tipo="set"]')
  await page.waitForTimeout(500)
  await page.click('[data-set="sv8"]')
  await page.waitForTimeout(300)
  await page.check('#mcAlbNuevoPorVersion')
  await page.click('#mcAlbNuevoCrear')
  await page.waitForTimeout(1500)
  const fila = await page.evaluate(() => window.__TABLAS__.user_albums.at(-1))
  check('se guarda una casilla por versión', JSON.stringify(fila?.cartas) === '[{"id":"sv8-1","v":"normal"},{"id":"sv8-1","v":"reverse"},{"id":"sv8-2"},{"id":"sv8-3","v":"normal"},{"id":"sv8-3","v":"reverse"}]', JSON.stringify(fila?.cartas))
  const bols = await page.$$eval('#mcAlbArchivador .mc-bolsillo[data-indice]', (bs) => bs.map((b) => `${b.querySelector('.mc-tengo-version')?.textContent || '-'}${b.classList.contains('tengo') ? '✓' : ''}`))
  check('cada una con su chapa, y lo tuyo (la reverse del 1, la holo del 2) a color', bols.join() === 'Normal,Reverse✓,-✓,Normal,Reverse', JSON.stringify(bols))
  check('  …y la cuenta es por casillas: 2 de 5', /2 de 5/.test(await page.textContent('#mcAlbProgreso')), await page.textContent('#mcAlbProgreso'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Z4: la portada de un binder ──')
{
  const alb = { id: 'alb-b', user_id: 'admin-1', nombre: 'Mis favoritas', tipo: 'binder', rejilla: '3x3', paginas: 10, tapa: 'azul', portada: null, cartas: [{ id: 'sv8-1' }, { id: 'sv8-3' }], updated_at: '2026-10-05T10:00:00Z' }
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-b', { albumes: [alb] })
  await page.click('#mcAlbEditar')
  await page.waitForTimeout(300)
  check('en «Ordenar y quitar» cada carta lleva su ★ de portada (44 px)', (await page.locator('#mcAlbArchivador [data-portada]').count()) === 2 && (await page.$eval('#mcAlbArchivador [data-portada]', (b) => b.getBoundingClientRect().height)) >= 44)
  await page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="1"] [data-portada]').click()
  await page.waitForTimeout(900)
  check('pulsarla la pone de portada, y se guarda', (await page.evaluate(() => window.__TABLAS__.user_albums[0].portada)) === 'sv8-3' && (await page.getAttribute('#mcAlbArchivador .mc-bolsillo[data-indice="1"] [data-portada]', 'aria-pressed')) === 'true')
  await page.click('#mcAlbEditar')
  await page.click('#mcAlbVolver')
  await page.waitForTimeout(900)
  check('en la rejilla, el binder enseña SU portada en grande', (await page.locator('[data-album="alb-b"] .mc-albt-portada img').count()) === 1 && (await page.locator('[data-album="alb-b"] .mc-albt-hojita').count()) === 0)
  if (CAPS) await page.screenshot({ path: `${CAPS}/764-portada.png` })

  console.log('── 4. Z5: la lista para imprimir ──')
  await page.click('[data-album="alb-b"]')
  await page.waitForTimeout(900)
  const descarga = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.click('#mcAlbChecklist')
  const d = await descarga
  check('«Lista para imprimir» da la imagen', d && /^pokedoc-checklist-mis-favoritas\.png$/.test(d.suggestedFilename()), d?.suggestedFilename())

  console.log('── 5. Z2: el enlace público ──')
  await page.check('#mcAlbPublico')
  await page.waitForTimeout(700)
  await page.click('#mcAlbCopiar')
  await page.waitForTimeout(300)
  check('«Compartir enlace» deja el enlace del álbum', (await page.evaluate(() => navigator.clipboard.readText())).endsWith('/mi-coleccion?album=alb-b'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const alb = { id: 'alb-a', user_id: 'user-2', nombre: 'Las de Ana', tipo: 'binder', rejilla: '3x3', is_public: true, cartas: [{ id: 'sv8-1' }], updated_at: '2026-10-05T10:00:00Z' }
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?album=alb-a', { sesion: 'none', albumes: [alb] })
  check('quien lo abre ve de quién es', (await page.textContent('#mcTitulo')) === 'El álbum de @ana' && /Las de Ana — @ana/.test(await page.title()), `${await page.textContent('#mcTitulo')} · ${await page.title()}`)
  check('  …y el álbum, sin las herramientas', (await page.isVisible('#mcAlbArchivador .mc-bolsillo')) && !(await page.isVisible('#mcAlbHerramientas')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
