// Tanda 1096 — «Lo último» en el lateral del índice del foro (PINGU, con el
// foro de WAH de ejemplo; eligió la A de la propuesta).
//
// Lo que se mira:
//   · en el PC, la franja de «Lo que se está hablando» no se ve y arriba del
//     lateral sale «Lo último»: un tema por fila (aunque tenga varios
//     mensajes), el más nuevo primero, con quién · cuándo · en qué foro;
//   · solo temas del foro: un comentario de noticia no entra (sí en la franja);
//   · lo no leído lleva el punto y va a lo nuevo (?nuevo=1); lo leído y lo
//     tuyo, no;
//   · el título parte en dos líneas como mucho (la 1096 pisó primero una
//     clase vieja con `nowrap` y salía cortado en una);
//   · sin cuenta, sale igual y sin puntos;
//   · en el móvil, la franja sigue y el lateral no sale.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const LARGO = 'CONCURSO: Tu carta favorita y su historia, cuéntanos por qué es la tuya y gana la caja de Funko Pop de los iniciales'
const MUNDO = {
  __FAKE_SECCIONES__: [{ name: 'General' }],
  __FAKE_FOROS__: [
    { id: 'foro-1', slug: 'dudas', name: 'Dudas de reglas', section_id: 'seccion-1' },
    { id: 'foro-2', slug: 'mercado', name: 'Mercadillo', section_id: 'seccion-1', position: 1 },
  ],
  __FAKE_TEMAS__: [
    { id: 'tema-1', board_id: 'foro-1', title: LARGO, author_id: 'user-1', post_count: 3, last_post_at: hace(5), last_post_author_id: 'user-2' },
    { id: 'tema-2', board_id: 'foro-2', title: 'Cambio Charizard', author_id: 'user-1', post_count: 2, last_post_at: hace(60), last_post_author_id: 'user-1' },
    { id: 'tema-3', board_id: 'foro-1', title: 'Duda con Boss', author_id: 'user-3', post_count: 1, last_post_at: hace(120), last_post_author_id: 'user-3' },
    { id: 'tema-4', board_id: 'foro-2', title: 'Lo mío', author_id: 'admin-1', post_count: 1, last_post_at: hace(200), last_post_author_id: 'admin-1' },
  ],
  __FAKE_MENSAJES__: [
    { id: 'msg-1', thread_id: 'tema-1', author_id: 'user-1', body_html: '<p>a</p>', created_at: hace(30) },
    { id: 'msg-2', thread_id: 'tema-1', author_id: 'user-3', body_html: '<p>b</p>', created_at: hace(20) },
    { id: 'msg-3', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>c</p>', created_at: hace(5) },
    { id: 'msg-4', thread_id: 'tema-2', author_id: 'admin-1', body_html: '<p>d</p>', created_at: hace(90) },
    { id: 'msg-5', thread_id: 'tema-2', author_id: 'user-1', body_html: '<p>e</p>', created_at: hace(60) },
    { id: 'msg-6', thread_id: 'tema-3', author_id: 'user-3', body_html: '<p>f</p>', created_at: hace(120) },
    { id: 'msg-7', thread_id: 'tema-4', author_id: 'admin-1', body_html: '<p>g</p>', created_at: hace(200) },
  ],
  // tema-2 leído después de su último mensaje; tema-1 y tema-3, no.
  __FAKE_LECTURAS__: [{ thread_id: 'tema-2', user_id: 'admin-1', last_read_at: hace(1) }],
  // Una noticia con un comentario de hace un minuto: el más nuevo de todos.
  __FAKE_FILAS__: {
    guides: [{ id: 'g1', kind: 'news', title: 'Noticia comentada', slug: 'noticia-comentada', published_at: hace(600), status: 'published' }],
    guide_comments: [{ id: 'c1', guide_id: 'g1', author_id: 'user-3', created_at: hace(1), body: 'hola' }],
  },
}

const browser = await chromium.launch()
async function abrir({ sesion = 'admin-1', movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(([s, m]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(m)) window[k] = v
  }, [sesion, MUNDO])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/foro`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const leer = (page) => page.evaluate(() => {
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0
  const panel = document.querySelector('#foroLateral .foro-lou')
  return {
    franja: vis(document.querySelector('.foro-calientes')),
    franjaNoticia: [...document.querySelectorAll('.foro-caliente-titulo')].some((a) => a.textContent.includes('Noticia comentada')),
    lateral: vis(document.getElementById('foroLateral')),
    primero: panel ? panel === document.getElementById('foroLateral').firstElementChild : false,
    titulo: panel?.querySelector('h3')?.textContent.trim(),
    filas: [...document.querySelectorAll('.foro-lou-fila')].map((f) => {
      const a = f.querySelector('.foro-lou-titulo')
      const lh = parseFloat(getComputedStyle(a).lineHeight)
      return { t: a.textContent.replace('Sin leer: ', '').trim(), href: a.getAttribute('href'), punto: !!f.querySelector('.foro-conv-punto'), meta: f.querySelector('small').textContent.replace(/\s+/g, ' ').trim(), lineas: Math.round(a.getBoundingClientRect().height / lh), avatar: !!f.querySelector('a[href*="/usuario/"], .mini-avatar, [class*="avatar"]') }
    }),
  }
})

console.log('── 1. En el PC, con cuenta ──')
{
  const { page, ctx, errores } = await abrir()
  const r = await leer(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la franja de arriba no se ve', !r.franja)
  check('«Lo último» va arriba del lateral', r.lateral && r.primero && r.titulo === 'Lo último', JSON.stringify(r))
  check('un tema por fila, el más nuevo primero, y sin la noticia', JSON.stringify(r.filas.map((f) => f.t)) === JSON.stringify([LARGO, 'Cambio Charizard', 'Duda con Boss', 'Lo mío']), JSON.stringify(r.filas.map((f) => f.t)))
  const [f1, f2, f3, f4] = r.filas
  check('quién · cuándo · en qué foro', f1?.meta === 'Misty · hace 5 min · Dudas de reglas' && f2?.meta.endsWith('Mercadillo'), JSON.stringify(r.filas.map((f) => f.meta)))
  check('con el avatar de quien escribió', r.filas.every((f) => f.avatar))
  check('lo no leído con punto y a lo nuevo', f1?.punto && f1.href === '/tema/tema-1?nuevo=1' && f3?.punto && f3.href.endsWith('?nuevo=1'), JSON.stringify([f1, f3]))
  check('lo leído y lo tuyo, sin punto y al tema', !f2?.punto && f2.href === '/tema/tema-2' && !f4?.punto && f4.href === '/tema/tema-4', JSON.stringify([f2, f4]))
  check('el título largo parte en dos líneas (ni una ni tres)', f1?.lineas === 2, JSON.stringify(f1))
  check('los números siguen debajo', await page.$$eval('#foroLateral .foro-panel', (ps) => ps.length >= 2 && ps.slice(1).some((p) => /El foro en números/.test(p.textContent))))
  await ctx.close()
}

console.log('── 2. Sin cuenta ──')
{
  const { page, ctx, errores } = await abrir({ sesion: 'none' })
  const r = await leer(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('sale «Lo último», sin puntos y sin ?nuevo', r.filas.length === 4 && !r.filas.some((f) => f.punto || f.href.includes('nuevo')), JSON.stringify(r.filas))
  await ctx.close()
}

console.log('── 3. En el móvil ──')
{
  const { page, ctx, errores } = await abrir({ movil: true })
  const r = await leer(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la franja se queda (y con la noticia, como antes)', r.franja && r.franjaNoticia, JSON.stringify({ franja: r.franja, noticia: r.franjaNoticia }))
  check('el lateral no sale', !r.lateral)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
