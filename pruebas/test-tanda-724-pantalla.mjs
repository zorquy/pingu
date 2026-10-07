// Tanda 724 — los atajos de teclado (D6) y la carta al pasar el ratón (D4),
// de la lista de propuestas, elegidas por PINGU.
//
// Lo que se mira: la regla de los atajos («G» y una letra va a su sección,
// la tecla sola no hace nada); que en el navegador «G» «F» lleve al foro,
// «T» cambie el tema, «?» enseñe la ayuda y que nada de eso salte mientras
// se escribe en un campo; y que posar el ratón en el NOMBRE de una carta
// enseñe su foto, su precio, su tendencia y si la tienes —y no en un enlace
// que ya es la foto—, y que se vaya al quitar el ratón.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { atajo, SECCIONES } = await import(`${RAIZ}/js/nav-search.js`).catch(() => ({}))

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. La regla de los atajos ──')
if (atajo) {
  check('«G» espera la segunda tecla', atajo('g')?.tipo === 'g')
  check('«G» «F»: al foro', JSON.stringify(atajo('f', true)) === JSON.stringify({ tipo: 'ir', a: '/foro.html' }))
  check('«G» y una letra que no es de nada: nada', atajo('z', true) === null)
  check('«F» sola no va a ningún sitio', atajo('f') === null)
  check('«/» busca y «?» es la ayuda', atajo('/')?.tipo === 'buscar' && atajo('?')?.tipo === 'ayuda')
  check('ocho secciones con su letra', Object.keys(SECCIONES).length === 8)
} else check('se puede importar nav-search.js sin navegador', false)

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_SETS__ = [{ id: 'base1', name: 'Set Básico', serie_id: 'base', market: 'WEST' }]
  window.__FAKE_CARTAS__ = [{ id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', image_path: 'base/base1/4', tcg_sets: { id: 'base1', name: 'Set Básico', serie_id: 'base' } }]
  window.__FAKE_PRECIOS__ = [{ card_id: 'base1-4', cm_low: 200, cm_trend: 220, checked_at: new Date().toISOString() }]
  window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'user-1', card_id: 'base1-4', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
}
async function abrir(ruta = '/index.html') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#e8564a"/></svg>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { page, ctx, errores }
}

console.log('── 2. Los atajos en el navegador ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const antes = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.keyboard.press('t')
  check('«T» cambia el tema', (await page.evaluate(() => document.documentElement.dataset.theme)) !== antes)
  await page.keyboard.press('Shift+?')
  await page.waitForTimeout(500)
  const ayuda = await page.evaluate(() => ({ open: !!document.getElementById('atajosAyuda')?.open, filas: document.querySelectorAll('#atajosAyuda tr').length, texto: document.getElementById('atajosAyuda')?.textContent || '' }))
  check('«?» enseña la ayuda, con los atajos y cómo ir a cada sección', ayuda.open && ayuda.filas >= 14 && /Ir a Foro/.test(ayuda.texto), JSON.stringify({ ...ayuda, texto: ayuda.texto.slice(0, 80) }))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  // Mientras se escribe, una «t» es una letra.
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'campo'; document.body.prepend(i) })
  await page.focus('#campo')
  const tema = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.keyboard.type('tg')
  await page.keyboard.press('f')
  await page.waitForTimeout(300)
  check('escribiendo en un campo no salta ninguno', (await page.inputValue('#campo')) === 'tgf' && (await page.evaluate(() => document.documentElement.dataset.theme)) === tema && /index\.html/.test(page.url()))
  await page.evaluate(() => document.activeElement.blur())
  await Promise.all([page.waitForURL(/foro\.html/, { timeout: 4000 }).catch(() => null), page.keyboard.press('g').then(() => page.keyboard.press('f'))])
  check('«G» «F» lleva al foro', /foro\.html/.test(page.url()), page.url())
  await ctx.close()
}

console.log('── 3. La carta al pasar el ratón ──')
{
  const { page, ctx, errores } = await abrir()
  await page.evaluate(() => {
    const p = document.createElement('p')
    p.style.cssText = 'position:fixed;top:120px;left:40px;z-index:9;background:#fff'
    p.innerHTML = 'Juega <a id="texto" href="/carta/charizard-base1-4">Charizard</a> y mira <a id="foto" href="/carta/charizard-base1-4"><img src="https://assets.tcgdex.net/en/base/base1/4/low.webp" width="40" height="56" alt=""></a>'
    document.body.appendChild(p)
  })
  await page.hover('#texto')
  await page.waitForTimeout(1200)
  const t = await page.evaluate(() => { const v = document.querySelector('.vista-carta'); return v ? { texto: v.textContent.replace(/\s+/g, ' ').trim(), img: !!v.querySelector('img'), borde: getComputedStyle(v).borderTopWidth } : null })
  check('posar el ratón en su nombre: la tarjeta, con su foto', t?.img && /Charizard/.test(t.texto) && /Set Básico · 4/.test(t.texto), JSON.stringify(t))
  check('  …su precio (el mínimo) y la tendencia', /Desde 200,00\s?€/.test(t?.texto) && /sube un 10 %/.test(t?.texto), t?.texto)
  check('  …y si la tienes', /La tienes \(2\)/.test(t?.texto), t?.texto)
  check('  …con su hoja (inyectada)', t?.borde === '1px')
  await page.mouse.move(900, 700)
  await page.waitForTimeout(500)
  check('quitar el ratón la quita', (await page.locator('.vista-carta').count()) === 0)
  await page.hover('#foto')
  await page.waitForTimeout(1000)
  check('en un enlace que ya ES la foto, no sale', (await page.locator('.vista-carta').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
