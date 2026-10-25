// Tanda 1010 — escribir una guía se ve, y la portada «Hoy» dice lo que es.
//
// PINGU: «la gente nueva no sabe que se puede escribir guías… el botón solo
// está en el perfil». Lo que se mira:
//   1. Lo puro: la ficha del lanzamiento con el logo (y su nombre de respaldo)
//      y la del foro con los temas que sigues (uno lleva a ese tema).
//   2. La portada con cuenta: la franja del calendario de la lateral es ahora
//      «Escribe una guía» (el lanzamiento ya está en las fichas), la ficha del
//      lanzamiento enseña el logo y la del foro cuenta SOLO los temas que
//      sigues con un mensaje de otro que no has visto (no los avisos).
//   3. Sin cuenta, la franja sigue siendo el calendario.
//   4. /aprender lleva «Escribir una guía» a la derecha del título, y sin
//      cuenta el editor manda a entrar y vuelve a él (`volver`).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const { fichasHtml } = await import(`${RAIZ}/js/hoy.js`)

let fallos = 0
const check = (nombre, ok, info = '') => {
  console.log(`${ok ? '✓' : '✗'} ${nombre}${ok || !info ? '' : `  → ${String(info).slice(0, 300)}`}`)
  if (!ok) fallos++
}
const n = (s) => String(s || '').replace(/\s+/g, ' ').trim()

console.log('── 1. Lo puro ──')
{
  const AHORA = Date.parse('2026-10-25T12:00:00Z')
  const conLogo = fichasHtml({ lanzamiento: { nombre: 'Delta Reign', fecha: '2026-11-06', logo: 'https://images.tcggo.com/dr.png' } }, AHORA)
  check('el lanzamiento con logo: la imagen en el sitio del nombre, con el nombre de respaldo', /class="hoy-ficha-logo"><img src="https:\/\/images\.tcggo\.com\/dr\.png" alt="Delta Reign"/.test(conLogo) && /onerror="this\.replaceWith\(this\.alt\)"/.test(conLogo) && !/<span>Delta Reign<\/span>/.test(conLogo), conLogo)
  check('  …y sin logo, el nombre', /<span>Delta Reign<\/span>/.test(fichasHtml({ lanzamiento: { nombre: 'Delta Reign', fecha: '2026-11-06' } }, AHORA)))
  const uno = fichasHtml({ hilos: { cuenta: 1, uno: 'tema-9', titulo: 'Mi tema' } }, AHORA)
  check('un tema con novedades lleva a ese tema y dice cuál', /href="\/tema\/tema-9"/.test(uno) && /<b>1 sin leer<\/b><span>Mi tema<\/span>/.test(uno), uno)
  const varios = fichasHtml({ hilos: { cuenta: 3, uno: 'tema-9', titulo: 'Mi tema' } }, AHORA)
  check('  …y varios, al foro', /href="\/foro\.html"[^>]*aria-label="Tus temas: 3 sin leer: en los temas que sigues/.test(varios), varios)
}

const browser = await chromium.launch()
async function abrir(ruta, sesion, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(({ sesion, extra }) => {
    window.__FAKE_SESSION__ = sesion
    const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
    window.__FAKE_SETS__ = [{ id: 'dr', name: 'Delta Reign', serie_id: 'me', market: 'WEST', logo_tcggo: 'https://images.tcggo.com/dr.png', release_date: new Date(Date.now() + 12 * 86400e3).toISOString().slice(0, 10) }]
    // Cuatro temas: A sigue y tiene un mensaje de otro sin ver; B sigue y ya
    // lo leyó; C sigue y lo último es suyo; D no lo sigue.
    window.__FAKE_TEMAS__ = [
      { id: 'tema-a', title: 'Tema A', last_post_at: hace(30), last_post_author_id: 'otro-1' },
      { id: 'tema-b', title: 'Tema B', last_post_at: hace(90), last_post_author_id: 'otro-1' },
      { id: 'tema-c', title: 'Tema C', last_post_at: hace(10), last_post_author_id: 'user-1' },
      { id: 'tema-d', title: 'Tema D', last_post_at: hace(5), last_post_author_id: 'otro-1' },
    ]
    window.__FAKE_SUSCRIPCIONES__ = ['tema-a', 'tema-b', 'tema-c'].map((t) => ({ thread_id: t, user_id: 'user-1' }))
    window.__FAKE_LECTURAS__ = [{ thread_id: 'tema-a', user_id: 'user-1', last_read_at: hace(120) }, { thread_id: 'tema-b', user_id: 'user-1', last_read_at: hace(60) }]
    // Avisos de respuesta sin leer: ya no cuentan (eran los de la campana).
    window.__FAKE_NOTIFICACIONES__ = [1, 2, 3].map((i) => ({ recipient_id: 'user-1', type: 'forum_reply', title: 'Te han respondido', link: `/tema/${i}` }))
    Object.assign(window, extra)
  }, { sesion, extra })
  await ctx.route(/images\.tcggo\.com|assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" fill="#b08a2a"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}

console.log('── 2. La portada con cuenta ──')
{
  const { page, ctx, errores } = await abrir('/index.html', 'user-1')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const franja = page.locator('#lanzamientoPortada')
  check('la franja de la lateral invita a escribir una guía y lleva al editor', /Escribe una guía/.test(n(await franja.innerText())) && (await franja.getAttribute('href')) === '/editor-guia.html' && (await franja.locator('img').count()) === 0, n(await franja.innerText()))
  const fichas = await page.$$eval('#hoyPortada .hoy-ficha', (as) => as.map((a) => ({ t: a.innerText.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), logo: a.querySelector('.hoy-ficha-logo img')?.getAttribute('src') || '', alto: a.querySelector('.hoy-ficha-logo img')?.getBoundingClientRect().height || 0 })))
  const lanz = fichas.find((f) => f.href === '/lanzamientos.html')
  check('la ficha del lanzamiento enseña el logo del set, a 32 px', lanz?.logo === 'https://images.tcggo.com/dr.png' && Math.round(lanz.alto) === 32 && /^Sale/.test(lanz.t), JSON.stringify(lanz))
  const foro = fichas.find((f) => /tema|foro|Nada nuevo/i.test(f.t))
  check('la del foro cuenta solo el tema que sigues con algo de otro sin ver, y lleva a él', foro?.t === "1 sin leer Tema A" && foro.href === '/tema/tema-a', JSON.stringify(foro))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/index.html', 'user-1', { __FAKE_LECTURAS__: [{ thread_id: 'tema-a', user_id: 'user-1', last_read_at: new Date().toISOString() }, { thread_id: 'tema-b', user_id: 'user-1', last_read_at: new Date().toISOString() }] })
  const t = n(await page.locator('#hoyPortada').innerText())
  check('  …y con todo leído, «Nada nuevo» (aunque haya avisos sin leer)', /Nada nuevo en los temas que sigues/.test(t), t)
  await ctx.close()
}

console.log('── 3. Sin cuenta ──')
{
  const { page, ctx, errores } = await abrir('/index.html', 'none')
  const franja = page.locator('#lanzamientoPortada')
  check('la franja sigue siendo el calendario', /Faltan 12 días · ver el calendario/.test(n(await franja.innerText())) && (await franja.getAttribute('href')) === '/lanzamientos.html' && errores.length === 0, n(await franja.innerText()) + errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Aprender ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html', 'user-1')
  const boton = page.locator('.ap-cab a.btn-primary', { hasText: 'Escribir una guía' })
  const caja = await boton.boundingBox()
  const titulo = await page.locator('.ap-cab h1').boundingBox()
  check('«Escribir una guía» junto al título, a la derecha, y lleva al editor', (await boton.count()) === 1 && (await boton.getAttribute('href')) === '/editor-guia.html' && caja && titulo && caja.x > titulo.x + titulo.width && Math.abs(caja.y + caja.height / 2 - (titulo.y + titulo.height / 2)) < 16 && caja.height >= 40, JSON.stringify({ caja, titulo }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/editor-guia.html', 'none')
  check('sin cuenta, el editor manda a entrar y de vuelta a él', /\/auth\.html\?volver=%2Feditor-guia\.html$/.test(page.url()), page.url())
  await ctx.close()
}

await browser.close()
console.log(fallos ? `\n${fallos} fallos` : '\nTodo en verde')
process.exit(fallos ? 1 : 0)
