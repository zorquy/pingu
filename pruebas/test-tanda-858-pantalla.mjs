// Tanda 858 — la barra pegada del móvil en lo que se lee largo: la guía
// (con lo que queda de lectura), el tema del foro (los mensajes) y el
// torneo (el estado). Es la pieza de la expansión (856), compartida
// (`js/barra-pegada.js`, con su hoja inyectada): sale cuando la cabecera se
// va por arriba y se esconde al volver. En el PC no existe.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const { loQueQueda, fraccionDe } = await import(`${RAIZ}/js/barra-pegada.js`).catch(() => ({}))
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Las cuentas, sin navegador ──')
{
  check('5 min y nada leído: «5 min más»', loQueQueda(5, 0) === '5 min más')
  check('5 min y la mitad: «3 min más»; a un minuto, «1 min más»; al final, «Leída»', loQueQueda(5, 0.5) === '3 min más' && loQueQueda(5, 0.85) === '1 min más' && loQueQueda(5, 1) === 'Leída')
  check('fuera de rango no se desmadra', loQueQueda(5, -1) === '5 min más' && loQueQueda(5, 7) === 'Leída')
  // Un cuerpo de 1000 que empieza arriba del todo, con un visor de 800: se
  // recorren 200. A 100 de desplazamiento, la mitad; a 200, el final.
  const cuerpo = (scrollY) => ({ getBoundingClientRect: () => ({ top: -scrollY, height: 1000 }) })
  check('la fracción: 0 al empezar, la mitad a media bajada, 1 al final', fraccionDe(cuerpo(0), 800, 0) === 0 && Math.abs(fraccionDe(cuerpo(100), 800, 100) - 0.5) < 0.001 && fraccionDe(cuerpo(200), 800, 200) === 1, [0, 100, 200].map((y) => fraccionDe(cuerpo(y), 800, y)).join())
  check('  …y un cuerpo que cabe entero está leído', fraccionDe({ getBoundingClientRect: () => ({ top: 100, height: 300 }) }, 800, 0) === 1)
}

const browser = await chromium.launch()
// El cuerpo de una guía son BLOQUES (`reference_blocks`), como en test-ficha-guia.
const parrafos = Array.from({ length: 40 }, (_, i) => ({ type: 'paragraph', text: `Párrafo ${i + 1} de la guía, con texto suficiente para que haya que bajar y bajar por el móvil hasta el final, y un poco más para que ocupe.` }))
const semilla = (parrafos) => {
  window.__FAKE_SESSION__ = 'user-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  window.__FAKE_CATEGORIAS__ = [{ id: 'cat-mazos', name: 'Mazos', slug: 'mazos' }]
  window.__FAKE_GUIAS__ = [{ slug: 'larga', title: 'Una guía larga de verdad', description: 'Para bajar', published_at: '2026-10-01T10:00:00Z', reference_blocks: parrafos, category_id: 'cat-mazos' }]
  window.__FAKE_FOROS__ = [{ id: 'foro-1', name: 'General', slug: 'general', description: 'De todo' }]
  window.__FAKE_TEMAS__ = [{ id: 'tema-1', board_id: 'foro-1', title: '¿Charizard o Dragapult?', author_id: 'user-2', created_at: '2026-10-14T10:00:00Z', post_count: 12 }]
  window.__FAKE_MENSAJES__ = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, thread_id: 'tema-1', author_id: i % 2 ? 'user-2' : 'user-1', body_html: `<p>Mensaje ${i + 1}, con lo suyo para ocupar sitio en la pantalla del teléfono.</p>`, created_at: `2026-10-14T1${i % 9}:00:00Z` }))
  window.__FAKE_TORNEOS__ = [{ slug: 'copa', name: 'Copa Medida', status: 'in_progress', max_players: 32, swiss_rounds: 5 }]
  window.__FAKE_INSCRIPCIONES__ = Array.from({ length: 16 }, (_, i) => ({ id: `i-${i}`, tournament_id: 'torneo-1', user_id: `user-${(i % 3) + 1}`, status: 'active', tcg_live_username: `TCG_${i}` }))
}
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, parrafos)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { page, ctx, errores }
}
const barra = (page) => page.evaluate(() => {
  const b = document.getElementById('barraPegada')
  if (!b) return null
  const r = b.getBoundingClientRect()
  const cs = getComputedStyle(b)
  const v = b.querySelector('.barra-pegada-volver')
  const rv = v?.getBoundingClientRect()
  const p = b.querySelector('.barra-pegada-progreso i')
  return { visible: cs.display !== 'none' && r.height > 0, top: Math.round(r.top), titulo: b.querySelector('.barra-pegada-titulo')?.textContent, cifra: b.querySelector('.barra-pegada-cifra')?.textContent, href: v?.getAttribute('href'), volver: rv ? [Math.round(rv.width), Math.round(rv.height)] : null, progreso: p ? Math.round(parseFloat(p.style.width) || 0) : null }
})
const bajar = async (page, y) => { await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await page.waitForTimeout(600) }

console.log('── 2. La guía, en el iPhone ──')
{
  const { page, ctx, errores } = await abrir('/guia.html?slug=larga')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la hoja de la barra se inyecta', await page.evaluate(() => !!document.querySelector('link[href*="barra-pegada.css"]')))
  check('arriba del todo no hay barra', !(await barra(page))?.visible, JSON.stringify(await barra(page)))
  await bajar(page, 1200)
  let b = await barra(page)
  check('al bajar sale: la flecha (44×44) a las guías de su tema, el título y «N min más»', b?.visible && b.top <= 60 && b.volver?.[0] >= 44 && b.volver?.[1] >= 44 && /slug=mazos/.test(b.href || '') && b.titulo === 'Una guía larga de verdad' && /min más/.test(b.cifra || ''), JSON.stringify(b))
  check('  …con la línea de lo leído avanzada', b?.progreso > 0 && b.progreso < 100, String(b?.progreso))
  await bajar(page, 100000)
  b = await barra(page)
  check('al final, «Leída» y la línea entera', b?.cifra === 'Leída' && b.progreso === 100, JSON.stringify(b))
  await bajar(page, 0)
  check('al volver arriba, se esconde', !(await barra(page))?.visible)
  await ctx.close()
}

console.log('── 3. El tema del foro ──')
{
  const { page, ctx, errores } = await abrir('/tema.html?t=tema-1')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await bajar(page, 1500)
  const b = await barra(page)
  check('la flecha al foro, el título y «12 mensajes»', b?.visible && /foro\.html/.test(b.href || '') && b.titulo === '¿Charizard o Dragapult?' && b.cifra === '12 mensajes', JSON.stringify(b))
  await ctx.close()
}

console.log('── 4. El torneo ──')
{
  const { page, ctx, errores } = await abrir('/torneo.html?slug=copa')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await bajar(page, 1500)
  const b = await barra(page)
  check('la flecha a los torneos, el nombre y el estado', b?.visible && b.href === '/torneos.html' && b.titulo === 'Copa Medida' && b.cifra === 'En juego', JSON.stringify(b))
  await ctx.close()
}

console.log('── 5. En el PC, nada ──')
{
  const { page, ctx } = await abrir('/guia.html?slug=larga', { movil: false })
  await bajar(page, 1500)
  check('ni barra ni hoja: el ordenador no la baja', !(await page.evaluate(() => document.getElementById('barraPegada') || document.querySelector('link[href*="barra-pegada.css"]'))))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
