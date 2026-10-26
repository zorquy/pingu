// Tanda 1031 — «Hacer un álbum» desde La quiero: un binder «Las que quiero»
// con las cartas de la lista (copia de hoy), que se abre para ordenarlo; y
// el mismo camino desde «Empezar un álbum» → «De La quiero».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const CARTAS = [1, 2, 3].map((n) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: ['Uno', 'Dos', 'Tres'][n - 1], name_es: ['Uno', 'Dos', 'Tres'][n - 1], image_path: `x/${n}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
const DESEOS = [
  { id: 'd1', user_id: 'admin-1', card_id: 'sv8-2', idioma: 'es', created_at: '2026-10-20T10:00:00Z' },
  { id: 'd2', user_id: 'admin-1', card_id: 'sv8-3', idioma: null, created_at: '2026-10-21T10:00:00Z' },
]
const b = await chromium.launch()
async function abrir(ruta, { deseos = DESEOS } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 3, card_count_total: 3 }]
    Object.assign(window, { __FAKE_CARTAS__: d.CARTAS, __FAKE_DESEOS__: d.deseos, __FAKE_ALBUMES__: [], __FAKE_PRECIOS__: [], __FAKE_COLECCION__: [{ id: 'l1', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }] })
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-onboarding', '1') } catch {}
  }, { CARTAS, deseos })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { ctx, page, errores }
}
const album = (page) => page.evaluate(() => ({
  pestania: document.querySelector('.mc-pestania.activa, [role="tab"][aria-selected="true"]')?.textContent.trim() || location.search,
  detalle: !document.getElementById('mcAlbumesDetalle')?.classList.contains('hidden'),
  titulo: document.getElementById('mcAlbTitulo')?.value,
  descripcion: document.getElementById('mcAlbDescripcion')?.value,
  bolsillos: [...document.querySelectorAll('#mcAlbArchivador .mc-bolsillo[data-carta]')].map((x) => x.dataset.carta),
  url: location.search,
  fila: (window.__TABLAS__?.user_albums || []).map((a) => ({ nombre: a.nombre, tipo: a.tipo, rejilla: a.rejilla, paginas: a.paginas, cartas: (a.cartas || []).map((c) => c.id) })),
}))

console.log('── 1. Desde La quiero ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const botones = await page.evaluate(() => [...document.querySelectorAll('.mc-quiero-botones button')].map((x) => x.innerText.trim()))
  check('los botones de arriba: Compartir lista, Imagen y Hacer un álbum', botones.join('|') === 'Compartir lista|Imagen|Hacer un álbum', botones.join('|'))
  await page.click('#mcQuieroAlbum')
  await page.waitForSelector('#mcAlbumesDetalle:not(.hidden)', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  const a = await album(page)
  check('se abre Álbumes con el binder «Las que quiero» creado, sus dos cartas en orden y la dirección con el álbum', a.detalle && a.titulo === 'Las que quiero' && a.bolsillos.join() === 'sv8-2,sv8-3' && /album=/.test(a.url), JSON.stringify(a))
  check('  …guardado como binder 3×3 de una página, con la fecha en la descripción', a.fila.length === 1 && a.fila[0].tipo === 'binder' && a.fila[0].rejilla === '3x3' && a.fila[0].paginas === 1 && a.fila[0].cartas.join() === 'sv8-2,sv8-3' && /Lo que buscaba el \d+ de \w+/.test(a.descripcion), JSON.stringify(a.fila))
  await ctx.close()
}

console.log('\n── 2. Desde «Empezar un álbum» → «De La quiero»; y con la lista vacía, se dice ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas')
  await page.waitForSelector('#mcAlbNuevoAbrir', { timeout: 8000 }).catch(() => {})
  await page.click('#mcAlbNuevoAbrir')
  await page.waitForTimeout(300)
  const tipos = await page.evaluate(() => [...document.querySelectorAll('#mcAlbNuevo [data-tipo]')].map((x) => `${x.dataset.tipo}:${x.querySelector('b')?.textContent}`))
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el tercer tipo es «De La quiero»', tipos.join('|') === 'set:Álbum de un set|binder:Binder personalizado|quiero:De La quiero', tipos.join('|'))
  await page.click('#mcAlbNuevo [data-tipo="quiero"]')
  await page.waitForSelector('#mcAlbumesDetalle:not(.hidden)', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  const a = await album(page)
  check('el diálogo se cierra y el binder se abre con las dos cartas', !(await page.evaluate(() => document.getElementById('mcAlbNuevo').open)) && a.detalle && a.titulo === 'Las que quiero' && a.bolsillos.length === 2, JSON.stringify(a))
  await ctx.close()
  const vacia = await abrir('/mi-coleccion.html?ver=carpetas', { deseos: [] })
  await vacia.page.click('#mcAlbNuevoAbrir')
  await vacia.page.waitForTimeout(300)
  await vacia.page.click('#mcAlbNuevo [data-tipo="quiero"]')
  await vacia.page.waitForTimeout(800)
  const v = await album(vacia.page)
  const aviso = await vacia.page.evaluate(() => document.querySelector('.toast, [role="status"], [role="alert"]')?.textContent || document.body.textContent.includes('La quiero está vacía'))
  check('con La quiero vacía no se crea nada y se dice', !v.detalle && v.fila.length === 0 && Boolean(aviso), JSON.stringify({ v, aviso }))
  await vacia.ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
