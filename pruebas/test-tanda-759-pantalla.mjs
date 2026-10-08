// Tanda 759 — Mis álbumes (AL1, AL2 y AL3 de la ronda 3; PINGU: «todo»).
//
// Viendo Holonook: una sola rejilla («Mi colección», los álbumes y
// «Empezar un álbum»), sin la sección de carpetas («quita la sección de
// carpetas, es mejor dejar solo álbumes»); al empezar, el TIPO primero:
// álbum de un set (eliges la expansión, entera o solo la numeración, y sale
// lleno y ordenado) o binder (nombre, bolsillos 2×2…4×4, 10/20/40 páginas y
// color). Lo que se mira: las baldosas de cada tipo con lo suyo (logo y
// barra; tapa y primeras cartas), los dos caminos del diálogo hasta la fila
// que se escribe en la base, que el binder abierto tenga sus bolsillos y sus
// páginas, que las carpetas que había pasen a binders con sus cartas (y se
// borren solo entonces), que «Mi colección» lleve a las cartas, y la forma
// pura de `formasDeSet` y `esDeLaNumeracion`.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { formasDeSet, esDeLaNumeracion, capacidad } from '/home/user/pingu/js/mi-coleccion/album-nuevo.js'
import { rejillaDe, archivadorHtml } from '/home/user/pingu/js/mi-coleccion/archivador.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''

console.log('── 1. Lo puro ──')
check('un set con secretas tiene dos formas; uno sin, una', JSON.stringify(formasDeSet({ card_count_total: 252, card_count_official: 191 })) === '[{"id":"entero","cartas":252},{"id":"oficial","cartas":191}]' && formasDeSet({ card_count_total: 102, card_count_official: 102 }).length === 1)
check('la numeración: número sin letras y dentro del oficial', esDeLaNumeracion({ local_id: '191' }, 191) && !esDeLaNumeracion({ local_id: '192' }, 191) && !esDeLaNumeracion({ local_id: 'TG05' }, 191) && !esDeLaNumeracion({ local_id: '0' }, 191))
check('bolsillos: 3×4 son doce; lo desconocido, nueve', rejillaDe('3x4').porPagina === 12 && rejillaDe('4x4').columnas === 4 && rejillaDe('raro').porPagina === 9 && capacidad('2x2', 10) === 40)
{
  const a = archivadorHtml({ lista: [1, 2, 3], porPagina: 16, columnas: 4, paginasMin: 20, pintarBolsillo: () => '<a class="mc-bolsillo"></a>' })
  check('el archivador de un binder: 20 páginas aunque solo haya tres cartas, y 16 bolsillos por hoja', a.paginas === 20 && (a.html.match(/class="mc-bolsillo[" ]/g) || []).length === 16 && /--cols:4/.test(a.html), a.paginas)
}
const sql = readFileSync(`${RAIZ}/supabase-migration-albumes-tipos.sql`, 'utf8')
check('la migración añade tipo, set, bolsillos, páginas y tapa, sin tablas temporales', ['tipo', 'set_id', 'set_market', 'set_modo', 'rejilla', 'paginas', 'tapa'].every((c) => new RegExp(`add column if not exists ${c} `).test(sql)) && !/temp(orary)? table/i.test(sql))

const browser = await chromium.launch()
const SETS = [
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 6, card_count_total: 8, logo_tcggo: 'https://images.tcggo.com/logo-sv8.png' },
  { id: 'sv7', name: 'Corona Astral', serie_id: 'sv', market: 'WEST', release_date: '2024-09-13', card_count_official: 4, card_count_total: 4 },
]
const CARTAS = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1).padStart(3, '0'), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `sv7-${i + 1}`, market: 'WEST', set_id: 'sv7', local_id: String(i + 1), name: `Corona ${i + 1}`, name_es: `Corona ${i + 1}`, image_path: `sv/sv7/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } })),
]
async function abrir({ movil = false, albumes = [], carpetas = [], carpetaCartas = [], ruta = '/mi-coleccion.html?ver=carpetas', tema = 'light' } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: tema } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', colorScheme: tema })
  await ctx.addInitScript(({ SETS, CARTAS, albumes, carpetas, carpetaCartas }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [
      { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
      { id: 'l2', card_id: 'sv8-7', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' },
      { id: 'l3', card_id: 'sv7-2', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-03T10:00:00Z' },
    ]
    window.__FAKE_ALBUMES__ = albumes
    window.__FAKE_CARPETAS__ = carpetas
    window.__FAKE_CARPETA_CARTAS__ = carpetaCartas
  }, { SETS, CARTAS, albumes, carpetas, carpetaCartas })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /logo/.test(r.request().url()) ? '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbumesRejilla .mc-albt', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page, errores }
}
const baldosas = (page) => page.$$eval('#mcAlbumesRejilla .mc-albt', (bs) => bs.map((b) => ({ clase: [...b.classList].find((c) => c.startsWith('mc-albt-')) || '', nombre: b.querySelector('.mc-albt-nombre')?.textContent.trim(), pie: b.querySelector('.mc-albt-pie')?.textContent.trim(), barra: b.querySelector('.mc-barra i')?.getAttribute('style') || null, logo: !!b.querySelector('.mc-albt-logo img'), cartas: b.querySelectorAll('.mc-albt-hojita img, .mc-albt-abanico img').length, tapa: b.querySelector('.mc-albt-tapa')?.dataset.tapa || null, fondo: getComputedStyle(b.querySelector('.mc-albt-tapa')).backgroundColor, alto: Math.round(b.getBoundingClientRect().height) })))
const tabla = (page, t) => page.evaluate((t) => window.__TABLAS__?.[t] || [], t)

console.log('── 2. La rejilla, con un álbum de set y un binder ──')
{
  const { ctx, page, errores } = await abrir({ albumes: [
    { id: 'alb-set', user_id: 'admin-1', nombre: 'Chispas Fulgurantes', tipo: 'set', set_id: 'sv8', set_market: 'WEST', set_modo: 'entero', rejilla: '3x3', cartas: CARTAS.slice(0, 8).map((c) => ({ id: c.id })), updated_at: '2026-10-05T10:00:00Z' },
    { id: 'alb-bin', user_id: 'admin-1', nombre: 'Mis favoritas', tipo: 'binder', rejilla: '4x4', paginas: 20, tapa: 'rojo', cartas: [{ id: 'sv7-2' }, { id: 'sv8-3' }], updated_at: '2026-10-04T10:00:00Z' },
  ] })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await baldosas(page)
  check('en orden: Mi colección, los álbumes y «Empezar un álbum» al final', b.map((x) => x.clase).join() === 'mc-albt-coleccion,mc-albt-set,mc-albt-binder,mc-albt-nuevo', JSON.stringify(b.map((x) => x.clase)))
  check('Mi colección: tus cartas distintas, con las últimas en abanico', b[0].pie === '3 cartas' && b[0].cartas === 3, JSON.stringify(b[0]))
  check('el de un set: su logo, «Tienes 2 de 8» y la barra', b[1].logo && b[1].pie === 'Tienes 2 de 8' && /--ancho:25%/.test(b[1].barra), JSON.stringify(b[1]))
  check('el binder: su tapa roja, sus primeras cartas y su forma', b[2].tapa === 'rojo' && b[2].cartas === 2 && /4×4, 20 págs/.test(b[2].pie) && /tienes 1/.test(b[2].pie) && b[2].fondo !== 'rgba(0, 0, 0, 0)', JSON.stringify(b[2]))
  check('no queda la sección de carpetas ni su botón', (await page.locator('#mcCarpetaNueva, #mcCarpetasMandos').count()) === 0 && (await page.textContent('#mcCarpetasPanel')).trim() === '')
  check('el título es «Mis álbumes»', /Mis álbumes/.test(await page.textContent('#mcBloqueAlbumes .mc-subtitulo')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/759-rejilla.png`, fullPage: false })
  await page.click('[data-alb-coleccion]')
  await page.waitForTimeout(600)
  check('«Mi colección» lleva a tus cartas', /ver=cartas/.test(page.url()) && (await page.isVisible('#mcPanelCartas')), page.url())
  await ctx.close()
}

console.log('── 3. Empezar un álbum de un set ──')
{
  const { ctx, page, errores } = await abrir()
  await page.click('#mcAlbNuevoAbrir')
  await page.waitForTimeout(300)
  check('el diálogo pregunta primero el tipo', (await page.isVisible('#mcAlbNuevo')) && (await page.locator('#mcAlbNuevo [data-tipo]').count()) === 2 && !(await page.isVisible('#mcAlbNuevoPie')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/759-tipo.png` })
  await page.click('[data-tipo="set"]')
  await page.waitForTimeout(400)
  const filas = await page.$$eval('#mcAlbNuevoSets [data-set]', (bs) => bs.map((b) => b.textContent.replace(/\s+/g, ' ').trim()))
  check('las expansiones del catálogo, con su año, su cuenta y lo que tienes', filas.length === 2 && /Chispas Fulgurantes ?2024 · 8 cartas · tienes 2/.test(filas[0]), JSON.stringify(filas))
  check('  …y sin elegir no se puede crear', await page.isDisabled('#mcAlbNuevoCrear'))
  await page.fill('#mcAlbNuevoSetBuscar', 'corona')
  await page.waitForTimeout(400)
  check('el buscador filtra', (await page.locator('#mcAlbNuevoSets [data-set]').count()) === 1)
  await page.fill('#mcAlbNuevoSetBuscar', '')
  await page.waitForTimeout(400)
  await page.click('[data-set="sv8"]')
  await page.waitForTimeout(300)
  const modos = await page.$$eval('#mcAlbNuevoModo [data-modo]', (bs) => bs.map((b) => `${b.dataset.modo}:${b.getAttribute('aria-pressed')}:${b.textContent.replace(/\s+/g, ' ').trim()}`))
  check('con secretas: el set entero (8) o solo la numeración (6)', modos.length === 2 && /^entero:true:El set entero ?8 cartas/.test(modos[0]) && /^oficial:false:Solo la numeración ?6 cartas/.test(modos[1]), JSON.stringify(modos))
  await page.click('[data-modo="oficial"]')
  if (CAPS) await page.screenshot({ path: `${CAPS}/759-set.png` })
  await page.click('#mcAlbNuevoCrear')
  await page.waitForTimeout(1500)
  const fila = (await tabla(page, 'user_albums')).at(-1)
  check('se escribe un álbum de set, con el nombre del set y solo la numeración, en orden', fila?.tipo === 'set' && fila.set_id === 'sv8' && fila.set_market === 'WEST' && fila.set_modo === 'oficial' && fila.nombre === 'Chispas Fulgurantes' && fila.cartas.map((c) => c.id).join() === 'sv8-1,sv8-2,sv8-3,sv8-4,sv8-5,sv8-6', JSON.stringify(fila))
  check('  …y se abre, con lo tuyo a color', (await page.isVisible('#mcAlbumesDetalle')) && (await page.locator('#mcAlbArchivador .mc-bolsillo.tengo').count()) === 1, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Empezar un binder ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await page.click('#mcAlbNuevoAbrir')
  await page.waitForTimeout(300)
  await page.click('[data-tipo="binder"]')
  await page.waitForTimeout(300)
  const opciones = await page.evaluate(() => ({ rejillas: [...document.querySelectorAll('[data-rejilla]')].map((b) => b.dataset.rejilla + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')), paginas: [...document.querySelectorAll('[data-paginas]')].map((b) => b.dataset.paginas + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')), tapas: document.querySelectorAll('#mcAlbNuevoTapas [data-tapa]').length, cabe: document.getElementById('mcAlbNuevoCabe').textContent }))
  check('bolsillos 2×2, 3×3, 3×4 y 4×4; páginas 10, 20 y 40; ocho colores', opciones.rejillas.join() === '2x2,3x3*,3x4,4x4' && opciones.paginas.join() === '10,20*,40' && opciones.tapas === 8 && opciones.cabe === 'Caben 180 cartas.', JSON.stringify(opciones))
  await page.fill('#mcAlbNuevoNombre', 'Mis Pikachus')
  await page.click('[data-rejilla="3x4"]')
  await page.click('[data-paginas="10"]')
  await page.click('#mcAlbNuevoTapas [data-tapa="verde"]')
  await page.waitForTimeout(200)
  check('lo que cabe se cuenta al cambiarlo, y la vista toma el color', (await page.textContent('#mcAlbNuevoCabe')) === 'Caben 120 cartas.' && (await page.getAttribute('#mcAlbNuevoVista', 'data-tapa')) === 'verde')
  const toques = await page.$$eval('#mcAlbNuevo [data-tipo], #mcAlbNuevo [data-rejilla], #mcAlbNuevo [data-paginas], #mcAlbNuevo .mc-tapa, #mcAlbNuevoCerrar', (bs) => bs.filter((b) => b.offsetParent).map((b) => Math.round(Math.min(b.getBoundingClientRect().height, b.getBoundingClientRect().width))))
  check('  …todo lo que se toca mide 44', toques.every((n) => n >= 44), JSON.stringify(toques))
  if (CAPS) await page.screenshot({ path: `${CAPS}/759-binder.png` })
  await page.click('#mcAlbNuevoCrear')
  await page.waitForTimeout(1500)
  const fila = (await tabla(page, 'user_albums')).at(-1)
  check('se escribe un binder vacío con su forma y su color', fila?.tipo === 'binder' && fila.nombre === 'Mis Pikachus' && fila.rejilla === '3x4' && fila.paginas === 10 && fila.tapa === 'verde' && fila.cartas.length === 0, JSON.stringify(fila))
  const abierto = await page.evaluate(() => ({ cols: getComputedStyle(document.querySelector('#mcAlbArchivador .mc-hoja') || document.body).gridTemplateColumns.split(' ').length, bolsillos: document.querySelectorAll('#mcAlbArchivador .mc-hoja .mc-bolsillo').length, paginas: document.getElementById('mcAlbPaginas').textContent, tapa: document.querySelector('#mcAlbArchivador .mc-binder')?.dataset.tapa }))
  check('  …y se abre con tres columnas, doce bolsillos por hoja, sus diez páginas y su color', abierto.cols === 3 && abierto.bolsillos === 12 && /de 10$/.test(abierto.paginas) && abierto.tapa === 'verde', JSON.stringify(abierto))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Las carpetas que había pasan a binders ──')
{
  const { ctx, page, errores } = await abrir({
    carpetas: [
      { id: 'c-madre', user_id: 'admin-1', parent_id: null, nombre: 'Vintage', icono: 'folder', color: '#c04a7e', orden: 0, created_at: '2026-01-01T00:00:00Z' },
      { id: 'c-hija', user_id: 'admin-1', parent_id: 'c-madre', nombre: 'Base', icono: null, emoji: '⭐', orden: 0, created_at: '2026-01-02T00:00:00Z' },
    ],
    carpetaCartas: [
      { id: 'cc-1', user_id: 'admin-1', folder_id: 'c-madre', line_id: 'l3' },
      { id: 'cc-2', user_id: 'admin-1', folder_id: 'c-madre', line_id: 'l1' },
      { id: 'cc-3', user_id: 'admin-1', folder_id: 'c-hija', line_id: 'l2' },
    ],
  })
  await page.waitForTimeout(800)
  const albs = await tabla(page, 'user_albums')
  const porNombre = Object.fromEntries(albs.map((a) => [a.nombre, a]))
  check('cada carpeta es ahora un binder, la hija con el nombre de su madre delante', porNombre.Vintage?.tipo === 'binder' && porNombre['Vintage · Base']?.tipo === 'binder', JSON.stringify(albs.map((a) => a.nombre)))
  check('  …con sus cartas (una vez cada una, por set y número) y su adorno', porNombre.Vintage?.cartas.map((c) => c.id).join() === 'sv7-2,sv8-1' && porNombre['Vintage · Base']?.cartas.map((c) => c.id).join() === 'sv8-7' && porNombre.Vintage.color === '#c04a7e' && porNombre['Vintage · Base'].emoji === '⭐', JSON.stringify(albs))
  check('  …y las carpetas se borran solo después', (await tabla(page, 'collection_folders')).length === 0)
  const b = await baldosas(page)
  check('  …y salen en la rejilla como binders, sin carpetas encima', b.filter((x) => x.clase === 'mc-albt-binder').length === 2 && (await page.locator('#mcCarpetasPanel .mc-burbuja').count()) === 0, JSON.stringify(b.map((x) => x.nombre)))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. En oscuro y en el móvil ──')
{
  const { ctx, page } = await abrir({ movil: true, tema: 'dark', albumes: [
    { id: 'alb-set', user_id: 'admin-1', nombre: 'Chispas Fulgurantes', tipo: 'set', set_id: 'sv8', set_market: 'WEST', cartas: CARTAS.slice(0, 8).map((c) => ({ id: c.id })), updated_at: '2026-10-05T10:00:00Z' },
    { id: 'alb-bin', user_id: 'admin-1', nombre: 'Mis favoritas con un nombre largo', tipo: 'binder', rejilla: '3x3', paginas: 10, tapa: 'morado', cartas: [{ id: 'sv7-2' }], updated_at: '2026-10-04T10:00:00Z' },
  ] })
  const b = await baldosas(page)
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('dos columnas en el móvil, sin irse de ancho', ancho <= 1 && (await page.$$eval('#mcAlbumesRejilla .mc-albt', (bs) => new Set(bs.map((x) => Math.round(x.getBoundingClientRect().left))).size)) === 2, String(ancho))
  check('  …todas de la misma altura por fila', b[0].alto === b[1].alto && b[2].alto === b[3].alto, JSON.stringify(b.map((x) => x.alto)))
  if (CAPS) await page.screenshot({ path: `${CAPS}/759-movil-oscuro.png` })
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
