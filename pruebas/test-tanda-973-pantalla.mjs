// Tanda 973 — las noticias no son guías: ni en el buscador ni en el aviso.
//
// PINGU: «las noticias siguen saliendo como si fuesen guías, cuando te dan
// un like dice alguien ha reaccionado a tu guía… en el buscador las
// noticias salen como guías, deberían estar aparte». El buscador pedía
// `guides` sin mirar `kind`, y el botón «Me ha servido» de una noticia
// avisaba con «A alguien le ha servido tu guía» y enlazaba a /guia/.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const noticia = { id: 'n-1', slug: 'sale-charizard', title: 'Sale el Charizard de la película', description: 'Resumen', kind: 'news', author_id: 'admin-1', review_status: 'published', published_at: '2026-10-20T10:00:00Z', blocks: [{ type: 'paragraph', text: 'Hola' }] }
const guia = { id: 'g-1', slug: 'guia-charizard', title: 'Cómo jugar Charizard ex', description: 'Lista y consejos', kind: 'guide', author_id: 'admin-1', review_status: 'published', published_at: '2026-10-01T10:00:00Z', blocks: [{ type: 'paragraph', text: 'Hola' }] }

const browser = await chromium.launch()
async function abrir(ruta, sesion = 'none') {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(([s, n, g]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_NOTICIAS__ = [n]
    window.__FAKE_GUIAS__ = [g]
    window.__FAKE_FILAS__ = { guide_helpful: [] }
  }, [sesion, noticia, guia])
  await page.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, errores }
}
const grupos = (page) => page.$$eval('#searchResults .bs-grupo', (gs) => gs.map((g) => ({
  titulo: g.querySelector('.bs-seccion')?.textContent.trim(),
  filas: [...g.querySelectorAll('.bs-fila')].map((a) => ({ href: a.getAttribute('href'), texto: a.textContent.replace(/\s+/g, ' ').trim() })),
})))

console.log('── 1. El buscador: Guías y Noticias, cada una en lo suyo ──')
{
  const { page, errores } = await abrir('/buscar.html?q=charizard')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const gs = await grupos(page)
  const g = gs.find((x) => x.titulo === 'Guías')
  const n = gs.find((x) => x.titulo === 'Noticias')
  check('en Guías solo la guía', g?.filas.length === 1 && g.filas[0].href === '/guia/guia-charizard', JSON.stringify(g))
  check('la noticia va en Noticias, con su dirección de noticia', n?.filas.length === 1 && n.filas[0].href === '/noticias/sale-charizard', JSON.stringify(n))
  check('  …y dice que es una noticia, con su día', /Noticia · 20 oct 2026/.test(n?.filas[0]?.texto || ''), n?.filas[0]?.texto)
  check('Noticias va detrás de Guías', gs.findIndex((x) => x.titulo === 'Noticias') === gs.findIndex((x) => x.titulo === 'Guías') + 1, JSON.stringify(gs.map((x) => x.titulo)))
  check('su chapa existe y dice 1', ((await page.textContent('#bsChips [data-grupo="noticias"]')) || '').replace(/\s/g, '') === 'Noticias1', await page.textContent('#bsChips [data-grupo="noticias"]'))
  await page.click('#bsChips [data-grupo="noticias"]')
  await page.waitForTimeout(1200)
  const solo = await grupos(page)
  check('con la chapa puesta, solo noticias', solo.length === 1 && solo[0].titulo === 'Noticias', JSON.stringify(solo.map((x) => x.titulo)))
  await page.close()
}

console.log('\n── 2. La paleta, igual ──')
{
  const { page } = await abrir('/')
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(400)
  await page.keyboard.type('charizard')
  await page.waitForTimeout(1800)
  const texto = (await page.textContent('#paletaLista').catch(() => '')) || ''
  check('la paleta tiene su bloque de Noticias con la noticia', /Noticias/i.test(texto) && /Sale el Charizard/.test(texto), texto.slice(0, 200))
  const href = await page.getAttribute('#paletaLista a[href="/noticias/sale-charizard"]', 'href').catch(() => null)
  check('  …que lleva a /noticias/', href === '/noticias/sale-charizard', href)
  await page.close()
}

console.log('\n── 3. En una noticia: «Me gusta», y el aviso habla de tu noticia ──')
{
  const { page, errores } = await abrir('/noticias/sale-charizard', 'user-2')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const boton = page.locator('#guideHelpful .helpful-btn')
  check('el botón dice «Me gusta»', ((await boton.textContent().catch(() => '')) || '').trim() === 'Me gusta', await boton.textContent().catch(() => ''))
  await boton.click()
  await page.waitForTimeout(800)
  check('  …al pulsarlo, «Te gusta» y la cuenta', ((await boton.textContent()) || '').trim() === 'Te gusta' && /A 1 persona le ha gustado/.test(await page.textContent('#guideHelpful')), await page.textContent('#guideHelpful'))
  const aviso = await page.evaluate(() => window.__TABLAS__.user_notifications.at(-1))
  check('el aviso dice «A alguien le ha gustado tu noticia»', aviso?.type === 'guide_helpful' && aviso.title === 'A alguien le ha gustado tu noticia' && aviso.recipient_id === 'admin-1', JSON.stringify(aviso))
  check('  …y lleva a /noticias/, no a /guia/', aviso?.link === '/noticias/sale-charizard', aviso?.link)
  check('sin «¿Te ha servido?» en una noticia', (await page.locator('#guideRating .sirve-boton').count()) === 0)
  await page.close()
}

console.log('\n── 4. En una guía sigue como estaba ──')
{
  const { page } = await abrir('/guia/guia-charizard', 'user-2')
  const boton = page.locator('#guideHelpful .helpful-btn')
  check('el botón dice «Me ha servido»', ((await boton.textContent().catch(() => '')) || '').trim() === 'Me ha servido')
  await boton.click()
  await page.waitForTimeout(800)
  const aviso = await page.evaluate(() => window.__TABLAS__.user_notifications.at(-1))
  check('  …y avisa «A alguien le ha servido tu guía» con su /guia/', aviso?.title === 'A alguien le ha servido tu guía' && aviso.link === '/guia/guia-charizard', JSON.stringify(aviso))
  await page.close()
}

console.log('\n── 5. Los avisos agrupados ──')
{
  const { agruparAvisos } = await import(`${RAIZ}/js/avisos-grupos.js`).catch(() => ({}))
  if (!agruparAvisos) {
    check('avisos-grupos exporta agruparAvisos', false)
  } else {
    const ahora = new Date('2026-10-22T12:00:00Z')
    const fila = (i, link) => ({ id: `a${i}`, type: 'guide_helpful', title: 'x', link, created_at: '2026-10-22T10:00:00Z', read_at: null })
    const tit = (link) => agruparAvisos([fila(1, link), fila(2, link), fila(3, link)], ahora).flatMap((t) => t.grupos)[0]?.titulo
    check('tres «me gusta» a una noticia: «les ha gustado tu noticia»', tit('/noticias/sale-charizard') === 'A 3 personas les ha gustado tu noticia', tit('/noticias/sale-charizard'))
    check('  …y a una guía, «les ha servido tu guía»', tit('/guia/guia-charizard') === 'A 3 personas les ha servido tu guía', tit('/guia/guia-charizard'))
  }
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
