// Tanda 767 — correcciones de PINGU sobre la 765-766.
//
//   · «Añadir carta» se llevaba todo el menú: Buscar vuelve a ser su pestaña,
//     y un bolsillo vacío la abre en modo ELEGIR (con su franja y Cancelar).
//   · El buscador del álbum solo miraba el catálogo occidental: ahora es
//     Buscar, que deja elegir el japonés, y la carta guarda su catálogo.
//   · En el álbum, lo mismo que en Expansiones: ✓ o «×2», el «+» y la ficha.
//   · En el menú del PC, sin la fila «Mi colección»: las partes cuelgan de
//     Cartas directamente.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 6, card_count_total: 6, logo_tcggo: 'https://images.tcggo.com/logo-sv8.png' },
  { id: 'SV1a', name: 'トリプレットビート', name_en: 'Triplet Beat', serie_id: 'sv', market: 'JP', release_date: '2023-03-10', card_count_official: 73, card_count_total: 73 },
]
const CARTAS = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } })),
  { id: 'SV1a-1', market: 'JP', set_id: 'SV1a', local_id: '001', name: 'フシギダネ', name_en: 'Bulbasaur', image_path: 'sv/sv1a/001', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
]
const ALBUMES = [
  { id: 'alb-set', user_id: 'admin-1', nombre: 'Chispas Fulgurantes', tipo: 'set', set_id: 'sv8', set_market: 'WEST', set_modo: 'entero', rejilla: '3x3', cartas: CARTAS.slice(0, 6).map((c) => ({ id: c.id })), updated_at: '2026-10-05T10:00:00Z' },
  { id: 'alb-bin', user_id: 'admin-1', nombre: 'Mis favoritas', tipo: 'binder', rejilla: '2x2', paginas: 10, tapa: 'verde', cartas: [{ id: 'sv8-2' }], updated_at: '2026-10-04T10:00:00Z' },
]
const browser = await chromium.launch()
async function abrir(ruta, { ancho = 1280 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [
      { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
      { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' },
    ]
    window.__FAKE_ALBUMES__ = ALBUMES
  }, { SETS, CARTAS, ALBUMES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { ctx, page, errores }
}
const visible = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return !!e && !e.classList.contains('hidden') && e.getBoundingClientRect().height > 0 }, sel)
const guardado = (page, id) => page.evaluate((id) => (window.__TABLAS__.user_albums.find((a) => a.id === id)?.cartas || []).map((c) => `${c.id || '·'}${c.m ? `@${c.m}` : ''}`).join(), id)

console.log('── 1. Buscar es otra vez una pestaña ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html')
  check('en el menú, «Buscar» con su pestaña', (await page.locator('#mcMenu [data-pestania="buscar"]').count()) === 1 && (await page.locator('[data-abrir-anadir]').count()) === 0)
  await page.click('#mcMenu [data-pestania="buscar"]')
  await page.waitForTimeout(500)
  const v = await page.evaluate(() => ({ pos: getComputedStyle(document.getElementById('mcPanelBuscar')).position, panel: document.getElementById('mcPanelResumen').classList.contains('hidden'), menu: document.getElementById('mcMenu').getBoundingClientRect().height > 0, nav: document.querySelector('.navbar, nav.nav, header')?.getBoundingClientRect().height > 0 }))
  check('se abre como pestaña: sin taparlo todo, con el menú y la barra a la vista', v.pos !== 'fixed' && v.panel && v.menu && v.nav, JSON.stringify(v))
  check('  …sin la franja de elegir', !(await visible(page, '#mcEligiendo')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. El menú del PC, sin «Mi colección» ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album', { ancho: 1440 })
  const lat = await page.evaluate(() => {
    const cajon = document.querySelector('.lat .lat-cajon.lat-abierto')
    return { menu: !!cajon?.querySelector('.lat-menu-sitio > #mcMenu'), fila: [...(cajon?.querySelectorAll('.lat-paginas > li > a') || [])].map((a) => a.textContent.trim()), partes: [...(cajon?.querySelectorAll('#mcMenu > button') || [])].map((b) => b.innerText.trim()) }
  })
  check('el cajón de Cartas ES el menú: sin la fila «Mi colección» encima', lat.menu && lat.fila.length === 0 && lat.partes.join() === 'Panel,Expansiones,Pokédex,Álbumes,Productos,Deseos y cambios,Buscar', JSON.stringify(lat))
  if (CAPS) await page.screenshot({ path: `${CAPS}/767-lateral.png`, clip: { x: 0, y: 0, width: 400, height: 700 } })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/lanzamientos.html', { ancho: 1440 })
  const enlaces = await page.$$eval('.lat .lat-paginas a[href^="/mi-coleccion"]', (as) => as.map((a) => a.textContent.trim()))
  check('fuera de Mi colección, las mismas partes como enlaces (con Buscar)', enlaces.join() === 'Panel,Expansiones,Pokédex,Álbumes,Productos,Deseos y cambios,Buscar', JSON.stringify(enlaces))
  await ctx.close()
}

console.log('── 3. Un álbum de set, como Expansiones ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-set')
  await page.waitForSelector('#mcAlbArchivador .mc-bolsillo', { timeout: 8000 }).catch(() => {})
  const b = await page.$$eval('#mcAlbArchivador a.mc-bolsillo', (as) => as.map((a) => `${a.dataset.carta}:${a.querySelector('.mc-tengo-marca')?.textContent || ''}:${a.querySelector('.mc-mas[data-anadir]') ? '+' : ''}`))
  check('lo que tienes con ✓ (una) o «×2», y cada carta con su «+»', b.includes('sv8-1:✓:+') && b.includes('sv8-2:×2:+') && b.includes('sv8-3::+'), JSON.stringify(b))
  if (CAPS) await page.screenshot({ path: `${CAPS}/767-album.png` })
  await page.click('#mcAlbArchivador a.mc-bolsillo[data-carta="sv8-3"] .mc-mas')
  await page.waitForTimeout(600)
  check('el «+» abre la hoja de añadir de esa carta', await page.evaluate(() => !!document.getElementById('mcAnadirDialogo')?.open && /Chispa 3/.test(document.getElementById('mcAnadirDialogo').textContent)))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.click('#mcAlbArchivador a.mc-bolsillo[data-carta="sv8-4"] .mc-bolsillo-num')
  await page.waitForTimeout(900)
  check('tocar la carta abre su ficha aquí, sin irse de la página', /mi-coleccion/.test(page.url()) && (await page.evaluate(() => !!document.getElementById('mcEditor')?.open)), page.url())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Un bolsillo vacío elige con Buscar ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin')
  await page.waitForSelector('#mcAlbArchivador [data-hueco]', { timeout: 8000 }).catch(() => {})
  await page.click('#mcAlbArchivador [data-hueco="1"]')
  await page.waitForTimeout(500)
  check('se abre Buscar con la franja: para qué bolsillo de qué álbum', (await visible(page, '#mcPanelBuscar')) && (await visible(page, '#mcEligiendo')) && (await page.textContent('#mcEligiendoTexto')) === 'Elige la carta del bolsillo 2 de «Mis favoritas»' && (await page.getAttribute('#mcMenu [data-pestania="buscar"]', 'aria-selected')) === 'true')
  if (CAPS) await page.screenshot({ path: `${CAPS}/767-elegir.png` })
  await page.click('#mcEligiendoCancelar')
  await page.waitForTimeout(500)
  check('«Cancelar» vuelve al álbum, que sigue abierto', (await visible(page, '#mcAlbumesDetalle')) && new URL(page.url()).searchParams.get('album') === 'alb-bin' && !(await visible(page, '#mcPanelBuscar')), page.url())
  await page.click('#mcAlbArchivador [data-hueco="1"]')
  await page.waitForTimeout(400)
  await page.fill('#mcBuscarTodo', 'chispa 5')
  await page.waitForTimeout(1100)
  await page.click('#mcBuscarResultados [data-carta="sv8-5"]')
  await page.waitForTimeout(900)
  check('la carta va a ese bolsillo y vuelves al álbum', (await guardado(page, 'alb-bin')) === 'sv8-2,sv8-5' && (await visible(page, '#mcAlbumesDetalle')) && !(await visible(page, '#mcEligiendo')), await guardado(page, 'alb-bin'))
  check('  …sin abrir la ficha', !(await page.evaluate(() => document.getElementById('mcEditor')?.open)))

  console.log('── 5. «Añadir cartas» del álbum: Buscar, también en japonés ──')
  check('el buscador de nombre del álbum se fue: ahora es un botón', (await page.locator('#mcAlbBuscar').count()) === 0 && (await page.locator('#mcAlbBuscarAbrir').count()) === 1)
  await page.click('#mcAlbBuscarAbrir')
  await page.waitForTimeout(500)
  check('abre Buscar para el álbum', (await page.textContent('#mcEligiendoTexto')) === 'Elige una carta para «Mis favoritas»')
  await page.selectOption('#mcBuscarBarra .mc-mercado', 'ja')
  await page.waitForTimeout(1500)
  check('  …con el catálogo japonés a mano', (await visible(page, '#mcEligiendo')) && (await page.inputValue('#mcBuscarBarra .mc-mercado')) === 'ja')
  await page.fill('#mcBuscarTodo', 'bulbasaur')
  await page.waitForTimeout(1200)
  await page.click('#mcBuscarResultados [data-carta="SV1a-1"]')
  await page.waitForTimeout(900)
  check('la japonesa va al primer bolsillo libre, con su catálogo apuntado', (await guardado(page, 'alb-bin')) === 'sv8-2,sv8-5,SV1a-1@JP', await guardado(page, 'alb-bin'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
