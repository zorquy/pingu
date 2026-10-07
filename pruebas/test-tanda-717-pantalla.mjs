// Tanda 717 — la barra de arriba, limpia, y la hoja «Tú» (N1 y N8 de la
// lista de propuestas, elegidas por PINGU).
//
// Lo que se mira: que en un iPhone la barra de arriba sea el logo, una
// pastilla de búsqueda que lleva a buscar y el avatar (los cuatro iconos
// siguen en la página, sin verse: sus chapas cuentan); que el avatar lleve
// la suma de mensajes y avisos sin leer; que tocarlo abra el desplegable
// de siempre COMO HOJA desde abajo, con un velo detrás, y con avisos,
// mensajes y tema arriba; que el tema cambie desde ahí; que el velo cierre;
// y que el escritorio no cambie.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { sumaDeAvisos } from '/home/user/pingu/js/barra-movil.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 1. La suma de las chapas ──')
check('2 y 3 son 5; sin nada, nada; con un «9+», «9+»; más de 9, «9+»', sumaDeAvisos(['2', '3']) === '5' && sumaDeAvisos(['0', '']) === '' && sumaDeAvisos(['1', '9+']) === '9+' && sumaDeAvisos(['6', '7']) === '9+')

const browser = await chromium.launch()
async function abrir({ movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, ctx, errores }
}
const seVe = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0 }, sel)

console.log('── 2. En un iPhone: la barra de arriba ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la pastilla de búsqueda se ve, se lee y lleva a buscar', (await seVe(page, '.bm-pastilla')) && /Busca cartas, guías, gente/.test(limpio(await page.locator('.bm-pastilla').innerText())) && (await page.getAttribute('.bm-pastilla', 'href')) === '/buscar.html')
  check('  …y mide 44 de alto', (await page.$eval('.bm-pastilla', (a) => a.getBoundingClientRect().height)) >= 44)
  check('los iconos de buscar, tema, mensajes y avisos no se ven…', !(await seVe(page, '#navSearchBtn')) && !(await seVe(page, '#navThemeToggle')) && !(await seVe(page, '#navMsgBtn')) && !(await seVe(page, '#navBellBtn')))
  check('  …pero siguen en la página (sus chapas cuentan)', (await page.locator('#navMsgBadge').count()) === 1 && (await page.locator('#navBellBadge').count()) === 1)
  await page.evaluate(() => { const m = document.getElementById('navMsgBadge'), b = document.getElementById('navBellBadge'); m.textContent = '2'; m.classList.remove('hidden'); b.textContent = '3'; b.classList.remove('hidden') })
  await page.waitForTimeout(300)
  check('el avatar lleva la suma de lo sin leer (2 mensajes + 3 avisos = 5)', limpio(await page.locator('#navUserBtn .bm-punto').innerText().catch(() => '')) === '5' && /5 sin leer/.test(await page.getAttribute('#navUserBtn', 'aria-label')))
  console.log('── 3. La hoja «Tú» ──')
  await page.click('#navUserBtn')
  await page.waitForTimeout(700)
  const hoja = await page.$eval('#navUserDropdown', (d) => { const r = d.getBoundingClientRect(); return { pos: getComputedStyle(d).position, bottom: Math.round(r.bottom), vh: innerHeight, left: Math.round(r.left), w: Math.round(r.width), vw: innerWidth } })
  check('tocar el avatar abre la hoja: pegada abajo y a lo ancho', hoja.pos === 'fixed' && Math.abs(hoja.bottom - hoja.vh) <= 1 && hoja.left === 0 && hoja.w === hoja.vw, JSON.stringify(hoja))
  check('  …con el velo detrás', await seVe(page, '.bm-velo'))
  const filas = limpio(await page.locator('#navUserDropdown .bm-tu-filas').innerText())
  check('arriba: avisos (3), mensajes (2) y el tema', /Avisos\s*3/.test(filas) && /Mensajes\s*2/.test(filas) && /Tema oscuro/.test(filas), filas)
  check('y debajo, los enlaces de siempre (perfil, guardados, cerrar sesión)', (await page.locator('#navUserDropdown a[href="/perfil.html"]').count()) === 1 && (await page.locator('#navUserSignOut').count()) === 1)
  await page.click('#navUserDropdown [data-tu="tema"]')
  await page.waitForTimeout(300)
  check('el tema cambia desde la hoja, y la fila se rotula al revés', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && /Tema claro/.test(limpio(await page.locator('#navUserDropdown .bm-tu-filas').innerText())))
  // La forma del fallo: la fila tocada se repintaba antes de que su clic
  // llegara al documento, y el menú lo contaba como «pulsado fuera».
  check('  …y la hoja SIGUE abierta', !(await page.$eval('#navUserDropdown', (d) => d.classList.contains('hidden'))) && (await seVe(page, '#navUserDropdown')))
  await page.click('#navUserDropdown [data-tu="avisos"]')
  await page.waitForTimeout(700)
  check('«Avisos» despliega la lista de la campana DENTRO de la hoja', (await page.evaluate(() => { const d = document.getElementById('navBellDropdown'); return !!d && !!d.closest('#navUserDropdown') && !d.classList.contains('hidden') })) && (await seVe(page, '#navBellDropdown')) && !(await page.$eval('#navUserDropdown', (d) => d.classList.contains('hidden'))))
  await page.mouse.click(195, 60)
  await page.waitForTimeout(400)
  check('pulsar fuera (en el velo) cierra la hoja', (await page.$eval('#navUserDropdown', (d) => d.classList.contains('hidden'))) && !(await seVe(page, '.bm-velo')))
  await ctx.close()
}

console.log('── 4. En el escritorio, como siempre ──')
{
  const { page, ctx, errores } = await abrir({ movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('sin pastilla, y los iconos de siempre a la vista', (await page.locator('.bm-pastilla').count()) === 0 && (await seVe(page, '#navSearchBtn')) && (await seVe(page, '#navThemeToggle')))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
