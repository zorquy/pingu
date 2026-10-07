// Tanda 742 — en el móvil, las migas de pan se vuelven un ANTETÍTULO (lo que
// quedaba de la V3 de la lista de propuestas, elegidas por PINGU).
//
// Lo que se mira, en un iPhone: en la ficha de una carta y en un tema del
// foro, de las migas queda UN paso —el sitio de arriba—, en versalitas y
// encima del título, que se pulsa con el dedo (44) y lleva allí; en el
// índice del foro, donde el único paso sería «Inicio», no queda nada; y
// en el escritorio las migas siguen enteras. En el HTML siguen todas
// (para Google), solo cambia lo que se ve.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
  window.__FAKE_CARTAS__ = [{ id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Charizard', name_es: 'Charizard', image_path: 'x/1', tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }]
  window.__FAKE_FOROS__ = [{ id: 'b1', slug: 'general', name: 'General', description: 'De todo', position: 0 }]
  window.__FAKE_TEMAS__ = [{ id: 't1', board_id: 'b1', title: 'Mazos de Ceruledge', author_id: 'user-1', created_at: '2026-10-01T10:00:00Z', last_post_at: '2026-10-01T10:00:00Z', reply_count: 0 }]
}
async function abrir(ruta, opciones = { ...devices['iPhone 13'] }) {
  const ctx = await browser.newContext({ locale: 'es-ES', ...opciones })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const migas = (page, sel) => page.evaluate((s) => {
  const m = document.querySelector(s)
  if (!m) return null
  const vistos = [...m.children].filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0)
  const h1 = document.querySelector('h1')
  const a = vistos[0]
  return { visto: getComputedStyle(m).display !== 'none', pasos: m.children.length, vistos: vistos.map((c) => c.textContent.trim()), mayus: getComputedStyle(m).textTransform, alto: a ? Math.round(a.getBoundingClientRect().height) : 0, // La caja de 44 baja por el margen negativo: se compara por arriba.
    encima: h1 && a ? a.getBoundingClientRect().top < h1.getBoundingClientRect().top : null, href: a?.getAttribute('href') }
}, sel)

console.log('── 1. La ficha de una carta ──')
{
  const { page, ctx, errores } = await abrir('/carta.html?id=xy5-1')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await migas(page, '.carta-migas')
  check('queda un paso, la colección, en versalitas', m?.visto && JSON.stringify(m.vistos) === JSON.stringify(['Duelos Primigenios']) && m.mayus === 'uppercase', JSON.stringify(m))
  check('  …encima del título y de 44 para el dedo', m?.encima && m.alto >= 44, JSON.stringify(m))
  check('  …y en el HTML siguen todos los pasos (Google)', m?.pasos >= 5, JSON.stringify(m))
  await ctx.close()
}

console.log('── 2. El foro ──')
{
  const a = await abrir('/foro.html')
  const m = await migas(a.page, '.foro-migas')
  check('en el índice, donde solo habría «Inicio», no sale nada', m && !m.visto, JSON.stringify(m))
  await a.ctx.close()
  const b = await abrir('/tema/t1')
  const t = await migas(b.page, '.foro-migas')
  check('en un tema, el foro de arriba como antetítulo', t?.visto && t.vistos.length === 1 && t.vistos[0] !== 'Inicio' && t.vistos[0] !== 'Mazos de Ceruledge', JSON.stringify(t))
  check('  …sin errores', b.errores.length === 0, b.errores.join(' | '))
  await b.ctx.close()
}

console.log('── 3. En el escritorio, enteras ──')
{
  const { page, ctx } = await abrir('/carta.html?id=xy5-1', { viewport: { width: 1280, height: 900 } })
  const m = await migas(page, '.carta-migas')
  check('Inicio › Cartas › la colección', m?.visto && m.vistos.length >= 5 && m.vistos[0] === 'Inicio' && m.mayus === 'none', JSON.stringify(m))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
