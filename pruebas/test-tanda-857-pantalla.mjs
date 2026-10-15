// Tanda 857 — una sola pieza de volver en todas las fichas.
//
// Había cinco formas de volver: el ‹ redondo de la carta, la miga en
// antetítulo (742), «← Todos los torneos» en 12 px, «RETOS DIARIOS» sin
// pulsar y nada (perfil ajeno, mazo del meta). Y dos fallos: la miga de la
// guía con un hueco («Inicio › › Título») y escondida en el móvil. Ahora
// todas llevan `.breadcrumb`: en el PC «Inicio › Sección › … › Esto», y en
// el móvil el botón «‹ Padre» de 44 px con flecha (el de la 856). La carta
// se queda con su ‹ redondo y el antetítulo.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  // La guía se enlaza con su tema por `category_id` (el doble lo resuelve así).
  window.__FAKE_CATEGORIAS__ = [{ id: 'cat-mazos', name: 'Mazos', slug: 'mazos' }]
  window.__FAKE_GUIAS__ = [
    { slug: 'guia-charizard', title: 'Cómo jugar Charizard ex', description: 'Lista y consejos', published_at: '2026-10-01T10:00:00Z', content: '<p>Un párrafo.</p>', category_id: 'cat-mazos' },
    { slug: 'sin-tema', title: 'Una guía sin tema', description: 'Sin categoría', published_at: '2026-10-01T10:00:00Z', content: '<p>Otro.</p>', category_id: null },
  ]
  window.__FAKE_TORNEOS__ = [{ slug: 'copa', name: 'Copa Medida', status: 'registration_open', max_players: 32, swiss_rounds: 5 }]
}
async function abrir(ruta, { movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores }
}
// Lo que se VE de las migas: los pasos visibles, el último enlace y su caja.
const migas = (page) => page.evaluate(() => {
  const m = document.querySelector('.breadcrumb')
  if (!m) return null
  const vistos = [...m.children].filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0)
  const a = [...m.querySelectorAll('a')].pop()
  const r = a?.getBoundingClientRect()
  const cs = a ? getComputedStyle(a) : null
  const antes = a ? getComputedStyle(a, '::before') : null
  const h1 = document.querySelector('h1')
  return { visible: getComputedStyle(m).display !== 'none', vistos: vistos.map((c) => c.textContent.trim()), vacios: [...m.querySelectorAll('a')].filter((x) => !x.textContent.trim()).length, texto: m.textContent.replace(/\s+/g, ' ').trim(), ultimo: a?.textContent.trim(), href: a?.getAttribute('href'), alto: r ? Math.round(r.height) : 0, borde: cs?.borderTopWidth, flecha: antes ? antes.borderLeftWidth : null, encima: h1 && r ? r.top < h1.getBoundingClientRect().top : null }
})

for (const movil of [false, true]) {
  console.log(`── ${movil ? 'iPhone' : 'PC'} ──`)
  {
    const { page, ctx, errores } = await abrir('/guia.html?slug=guia-charizard', { movil })
    check('guía: sin errores', errores.length === 0, errores.join(' | '))
    const m = await migas(page)
    if (movil) {
      check('guía: en el móvil queda el botón «‹ Mazos» (su tema), de 44 px, con borde y flecha, encima del título', m?.visible && JSON.stringify(m.vistos) === JSON.stringify(['Mazos']) && m.alto >= 44 && m.borde === '1px' && m.flecha === '2px' && m.encima, JSON.stringify(m))
    } else {
      check('guía: «Inicio › Guías › Mazos › Cómo jugar Charizard ex», sin huecos', m?.visible && m.vistos.join('|') === 'Inicio|›|Guías|›|Mazos|›|Cómo jugar Charizard ex' && m.vacios === 0, JSON.stringify(m))
    }
    check('  …y el tema lleva a su página', /slug=mazos/.test(m?.href || ''), String(m?.href))
    await ctx.close()
  }
  {
    const { page, ctx } = await abrir('/guia.html?slug=sin-tema', { movil })
    const m = await migas(page)
    check(`guía sin tema: ${movil ? '«‹ Guías»' : '«Inicio › Guías › Título»'}, sin el hueco de antes`, m && m.vacios === 0 && m.ultimo === 'Guías' && m.href === '/aprender' && (movil ? JSON.stringify(m.vistos) === JSON.stringify(['Guías']) : m.vistos.length === 5), JSON.stringify(m))
    await ctx.close()
  }
  {
    const { page, ctx } = await abrir('/torneo.html?slug=copa', { movil })
    const m = await migas(page)
    check(`torneo: ${movil ? '«‹ Torneos»' : '«Inicio › Torneos › Copa Medida»'}`, m && m.ultimo === 'Torneos' && (movil ? JSON.stringify(m.vistos) === JSON.stringify(['Torneos']) && m.alto >= 44 : /Copa Medida/.test(m.texto)), JSON.stringify(m))
    check('  …y ya no está el enlace suelto de antes', (await page.locator('.torneo-volver').count()) === 0)
    await ctx.close()
  }
  {
    const { page, ctx } = await abrir('/quien-es.html', { movil })
    const m = await migas(page)
    check(`reto: ${movil ? '«‹ Retos diarios», que se pulsa' : '«Inicio › Retos diarios»'}`, m && m.ultimo === 'Retos diarios' && m.href === '/retos' && (movil ? JSON.stringify(m.vistos) === JSON.stringify(['Retos diarios']) && m.alto >= 44 && m.borde === '1px' : m.vistos[0] === 'Inicio'), JSON.stringify(m))
    await ctx.close()
  }
  {
    const { page, ctx } = await abrir('/usuario.html?u=Ash', { movil })
    const m = await migas(page)
    check(`perfil ajeno: ${movil ? '«‹ Gente»' : '«Inicio › Gente › Ash»'}`, m && m.ultimo === 'Gente' && (movil ? JSON.stringify(m.vistos) === JSON.stringify(['Gente']) : /Ash$/.test(m.texto)), JSON.stringify(m))
    await ctx.close()
  }
  {
    // El mazo del meta pide `?a=<arquetipo>` y sin él se va a /meta; el
    // arquetipo real sale de Limitless, que aquí no está. Se mira que la
    // pieza va en su sitio, antes de la cabecera, en el HTML que se sirve.
    const { page, ctx } = await abrir('/mazo-meta.html?a=dragapult', { movil })
    const html = await page.evaluate(() => fetch('/mazo-meta.html').then((r) => r.text()))
    const i = html.indexOf('class="breadcrumb"')
    check('mazo del meta: «Inicio › Mazos del meta › …» en su sitio, antes de la cabecera', i > 0 && /href="\/meta">Mazos del meta/.test(html) && i < html.indexOf('id="mmNombre"'))
    await ctx.close()
  }
}

console.log('── La carta se queda como estaba ──')
{
  const { page, ctx } = await abrir('/carta.html?id=base1-4', { movil: true })
  const estilo = await page.evaluate(() => { const m = document.querySelector('.carta-migas'); return m ? getComputedStyle(m).textTransform : null })
  check('en el móvil, antetítulo en versalitas (la 742): la cabecera ya lleva su ‹', estilo === 'uppercase' || estilo === null, String(estilo))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
