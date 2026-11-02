// Tanda 1182 — la barra de un álbum: pastillas como las de una expansión, un
// botón que da la vuelta Todas → Tengo → Faltan, «En color / En gris» a la
// vista, «Ocultar iconos» dentro del ⋯ y «Personalizar» fuera (PINGU). Gris e
// iconos van con el álbum (`estilo`, o el navegador sin la columna) y en el PC
// el álbum se encoge para caber en el alto de la pantalla.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let FOTOS = []
const browser = await chromium.launch()
const N = 30
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, logo_tcggo: 'https://images.tcggo.com/logo-sv8.png' }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
// Un binder de 3×3 y 6 páginas: 14 cartas, con huecos, y una de portada.
const EN_BINDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null, 12, 13, 14, null, 16]
const ALBUMES = [
  { id: 'alb-bin', user_id: 'admin-1', nombre: 'BW/XY', descripcion: 'Las Full Art', tipo: 'binder', rejilla: '3x3', paginas: 6, tapa: 'azul', portada: 'sv8-4', is_public: false, cartas: EN_BINDER.map((n) => (n ? { id: `sv8-${n}` } : {})), updated_at: '2026-10-05T10:00:00Z' },
  { id: 'alb-set', user_id: 'admin-1', estilo: { color: 'verde' }, nombre: 'Chispas Fulgurantes', tipo: 'set', set_id: 'sv8', set_market: 'WEST', set_modo: 'entero', rejilla: '3x3', cartas: CARTAS.map((c) => ({ id: c.id })), updated_at: '2026-10-04T10:00:00Z' },
]
const COLECCION = [1, 2, 4, 5, 7, 12].map((n, i) => ({ id: `l${n}`, card_id: `sv8-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-10-0${(i % 8) + 1}T10:00:00Z` }))

async function abrir(url, { movil = false, ancho = 1280, alto = 1000, vistaAlbum = null } = {}) {
  // Sin service worker: lo que él pide no pasa por `route` (897) y las fotos
  // de mentira no llegarían.
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' } : { viewport: { width: ancho, height: alto }, locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES, COLECCION, vistaAlbum }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = COLECCION
    window.__FAKE_ALBUMES__ = ALBUMES
    window.__FAKE_DESEOS__ = [{ id: 'd1', user_id: 'admin-1', card_id: 'sv8-3', idioma: null, created_at: '2026-10-01T10:00:00Z' }]
    try { localStorage.setItem('pokedoc-theme', 'dark'); if (vistaAlbum) localStorage.setItem('mc-album-vista', vistaAlbum) } catch {}
  }, { SETS, CARTAS, ALBUMES, COLECCION, vistaAlbum })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => {
    const url = r.request().url()
    if (/logo/.test(url)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' })
    const n = Number((url.match(/sv8\/(\d+)/) || [])[1] || 0)
    if (FOTOS.length) return r.fulfill({ status: 200, contentType: 'image/jpeg', body: FOTOS[n % FOTOS.length] })
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' })
  })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbArchivador .mc-hoja, .mc-exp-archivador .mc-hoja', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page, errores }
}


const fila = (page, id) => page.evaluate((id) => window.__TABLAS__.user_albums.find((x) => x.id === id)?.estilo ?? null, id)
const estado = (page) => page.evaluate(() => {
  const a = document.getElementById('mcAlbArchivador')
  const vis = (s) => [...a.querySelectorAll(s)].filter((x) => getComputedStyle(x).display !== 'none' && x.getBoundingClientRect().width > 0).length
  const faltaImg = a.querySelector('.mc-bolsillo:not(.tengo) img')
  return {
    gris: a.classList.contains('mc-alb-gris'), sinIconos: a.classList.contains('mc-alb-sin-iconos'),
    filtroFalta: faltaImg ? getComputedStyle(faltaImg).filter : null,
    checks: vis('.mc-tengo-marca'), mas: vis('.mc-mas'),
    que: document.getElementById('mcAlbQueTexto').textContent.trim(), cuenta: document.getElementById('mcAlbQueCuenta').textContent.trim(),
    grisTexto: document.getElementById('mcAlbGrisTexto').textContent.trim(), grisPulsado: document.getElementById('mcAlbGris').getAttribute('aria-pressed'),
    iconosTexto: document.getElementById('mcAlbIconosTexto').textContent.trim(),
    bolsillos: a.querySelectorAll('.mc-bolsillo[data-carta]').length,
  }
})

console.log('── 1. La barra: pastillas como las de una expansión ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin')
  const b = await page.evaluate(() => {
    const ids = ['mcAlbBuscarAbrir', 'mcAlbQue', 'mcAlbGris', 'mcAlbSeleccionar', 'mcAlbAjustes']
    return {
      altos: ids.map((id) => Math.round(document.getElementById(id).getBoundingClientRect().height)),
      chips: ids.every((id) => document.getElementById(id).classList.contains('mc-chip-mando')),
      viejos: document.querySelectorAll('#mcAlbHerramientas .mc-alb-mando, #mcAlbHerramientas .btn-primary, #mcAlbHerramientas [data-filtro]').length,
      iconosEnMenu: !!document.querySelector('#mcAlbMenu #mcAlbIconos, .mc-menu #mcAlbIconos') || !!document.getElementById('mcAlbIconos')?.closest('[role=menu], .mc-menu, .mc-alb-menu'),
      personalizarFuera: !document.getElementById('mcAlbAjustes').closest('[role=menu], .mc-menu, .mc-alb-menu'),
    }
  })
  check('cinco pastillas de 36 px, sin botones grandes ni segmento Todas/Tengo/Faltan', b.chips && b.altos.every((h) => h === 36) && b.viejos === 0, JSON.stringify(b))
  check('«Ocultar iconos» va dentro del ⋯ y «Personalizar» fuera', b.iconosEnMenu && b.personalizarFuera, JSON.stringify(b))
  console.log('── 2. Un botón que da la vuelta Todas → Tengo → Faltan ──')
  const vueltas = []
  for (let i = 0; i < 4; i++) { const e = await estado(page); vueltas.push(`${e.que} ${e.cuenta}:${e.bolsillos}`); await page.click('#mcAlbQue'); await page.waitForTimeout(150) }
  check('cada toque cambia, con su cuenta, y vuelve al principio', vueltas.join(' | ') === 'Todas 14:14 | Tengo 6:6 | Faltan 8:8 | Todas 14:14', vueltas.join(' | '))
  console.log('── 3. Encaja en el alto de la pantalla ──')
  const caja = await page.evaluate(() => { const r = document.querySelector('#mcAlbumesDetalle .mc-archivador-caja').getBoundingClientRect(); return { abajo: Math.round(r.bottom + scrollY), ancho: Math.round(r.width), alto: innerHeight } })
  check('el álbum cabe entero en la pantalla del PC', caja.abajo <= caja.alto && caja.ancho >= 640, JSON.stringify(caja))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin', { ancho: 1440, alto: 720 })
  const caja = await page.evaluate(() => { const r = document.querySelector('#mcAlbumesDetalle .mc-archivador-caja').getBoundingClientRect(); return { abajo: Math.round(r.bottom + scrollY), ancho: Math.round(r.width), alto: innerHeight } })
  check('  …en una pantalla baja se encoge (sin bajar de 640)', caja.ancho >= 640 && (caja.abajo <= caja.alto || caja.ancho === 640), JSON.stringify(caja))
  await ctx.close()
}

console.log('── 4. Gris e iconos, guardados con el álbum ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-set')
  let e = await estado(page)
  check('de entrada, en color y con iconos', !e.gris && !e.sinIconos && e.filtroFalta === 'none' && e.checks > 0 && e.mas > 0 && e.grisTexto === 'En color' && e.grisPulsado === 'false', JSON.stringify(e))
  await page.click('#mcAlbGris'); await page.waitForTimeout(400)
  e = await estado(page)
  check('«En color» → «En gris»: lo que falta se apaga', e.gris && /grayscale/.test(e.filtroFalta) && e.grisTexto === 'En gris' && e.grisPulsado === 'true', JSON.stringify(e))
  check('  …y se guarda en el estilo del álbum, sin perder lo demás', JSON.stringify(await fila(page, 'alb-set')) === '{"color":"verde","gris":true}', JSON.stringify(await fila(page, 'alb-set')))
  await page.click('#mcAlbMenu > summary'); await page.waitForTimeout(200)
  await page.click('#mcAlbIconos'); await page.waitForTimeout(400)
  e = await estado(page)
  check('«Ocultar iconos» quita ✓ y «+», y el menú pasa a «Enseñar iconos»', e.sinIconos && e.checks === 0 && e.mas === 0 && e.iconosTexto === 'Enseñar iconos', JSON.stringify(e))
  check('  …guardado también', JSON.stringify(await fila(page, 'alb-set')) === '{"color":"verde","gris":true,"sinIconos":true}', JSON.stringify(await fila(page, 'alb-set')))
  await page.click('#mcAlbGris'); await page.waitForTimeout(300)
  await page.click('#mcAlbMenu > summary'); await page.waitForTimeout(200)
  await page.click('#mcAlbIconos'); await page.waitForTimeout(400)
  e = await estado(page)
  check('se deshace igual, y el estilo vuelve a como estaba', !e.gris && !e.sinIconos && e.checks > 0 && JSON.stringify(await fila(page, 'alb-set')) === '{"color":"verde"}', JSON.stringify(await fila(page, 'alb-set')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  // Sin la columna `estilo` (alb-bin no la trae) se recuerda en el navegador.
  const { ctx, page } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin')
  await page.click('#mcAlbGris'); await page.waitForTimeout(300)
  const guardado = await page.evaluate(() => localStorage.getItem('mc-alb-vista-alb-bin'))
  check('sin la columna, se recuerda en el navegador', guardado === '{"gris":true}', guardado)
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#mcAlbArchivador .mc-hoja'); await page.waitForTimeout(800)
  check('  …y sale igual al volver', (await estado(page)).gris)
  await ctx.close()
}

console.log('── 5. En el móvil, una fila ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin', { movil: true })
  const m = await page.evaluate(() => {
    const ids = ['mcAlbQue', 'mcAlbBuscarAbrir', 'mcAlbGris', 'mcAlbSeleccionar', 'mcAlbAjustes']
    const rs = ids.map((id) => document.getElementById(id).getBoundingClientRect())
    return { tops: rs.map((r) => Math.round(r.top)), derecha: Math.round(Math.max(...rs.map((r) => r.right))), ancho: innerWidth, orden: ids.slice().sort((a, b) => document.getElementById(a).getBoundingClientRect().left - document.getElementById(b).getBoundingClientRect().left).join(), dedo: rs.every((r) => r.height >= 36) }
  })
  check('todo cabe en una fila: lupa, ciclo, gris, seleccionar, personalizar', new Set(m.tops).size === 1 && m.derecha <= m.ancho && m.orden === 'mcAlbBuscarAbrir,mcAlbQue,mcAlbGris,mcAlbSeleccionar,mcAlbAjustes', JSON.stringify(m))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. Lo que ve otra persona no cambia ──')
{
  const { ctx, page } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-set')
  check('(la barra es de quien es el álbum)', await page.locator('#mcAlbHerramientas').isVisible())
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
