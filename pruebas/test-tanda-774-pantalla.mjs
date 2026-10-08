// Tanda 774 — «Apoyar PokeDoc» en la lateral, encima de tu cuenta.
//
// PINGU: que salga del menú del perfil y esté «justo encima del clic del
// perfil», como una categoría más, siempre a la vista en el PC; con la
// barra plegada, solo la taza; y que sea un ENLACE a ko-fi.com/pokedoc.
// Lo que se mira: que está con y sin cuenta, encima de la tarjeta de tu
// cuenta, enlazando a Ko-fi en pestaña nueva; plegada, solo el icono (con su
// nombre para quien no ve); que la hoja «Tú» no lo repite donde hay lateral
// y sí lo lleva en el móvil; y que el enlace viejo no queda en ninguna parte.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''
const KOFI = 'https://ko-fi.com/pokedoc'

const browser = await chromium.launch()
async function abrir(ruta, { sesion = true, plegada = false, movil = false, alto = 900 } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1440, height: alto } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(([s, p]) => {
    window.__FAKE_SESSION__ = s ? 'user-1' : 'none'
    try { if (p) localStorage.setItem('pokedoc-lateral-plegada', '1') } catch {}
  }, [sesion, plegada])
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}

console.log('── 1. En la lateral, encima de tu cuenta ──')
{
  const { ctx, page, errores } = await abrir('/index.html')
  const a = await page.$eval('.lat-apoyar', (a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel, texto: a.innerText.replace(/\s+/g, ' ').trim(), alto: Math.round(a.getBoundingClientRect().height), abajo: Math.round(a.getBoundingClientRect().bottom), visible: a.getBoundingClientRect().width > 0 }))
  check('es un enlace a Ko-fi, en pestaña nueva', a.href === KOFI && a.target === '_blank' && /noopener/.test(a.rel), JSON.stringify(a))
  check('  …«Apoyar PokeDoc · Un café en Ko-fi», de 44', a.visible && a.texto === 'Apoyar PokeDoc Un café en Ko-fi' && a.alto >= 44, JSON.stringify(a))
  const yo = await page.$eval('.lat-yo', (y) => Math.round(y.getBoundingClientRect().top))
  check('  …justo encima de tu cuenta', (await page.$eval('.lat-apoyar', (a) => a.nextElementSibling?.classList.contains('lat-yo'))) && yo > a.abajo && yo - a.abajo <= 24, `${a.abajo} → ${yo}`)
  check('  …pegado abajo, como la cuenta', a.abajo > 700, String(a.abajo))
  if (CAPS) await page.screenshot({ path: `${CAPS}/774-lateral.png`, clip: { x: 0, y: 600, width: 260, height: 300 } })
  // En el PC la hoja se abre desde la tarjeta de abajo (la 748).
  await page.click('.lat-yo')
  await page.waitForTimeout(900)
  check('  …la hoja «Tú» se abre', (await page.$$eval('#navUserDropdown .tu-lista a', (as) => as.length)) > 3)
  check('la hoja «Tú» ya no lo repite aquí', (await page.$$eval('#navUserDropdown .tu-apoyar', (as) => as.filter((x) => x.getBoundingClientRect().height > 0).length)) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/index.html', { sesion: false })
  check('sin cuenta también está', (await page.$eval('.lat-apoyar', (a) => a.getBoundingClientRect().height)) >= 44)
  await ctx.close()
}

console.log('── 2. Con la barra plegada, la taza ──')
{
  const { ctx, page, errores } = await abrir('/index.html', { plegada: true })
  const a = await page.$eval('.lat-apoyar', (a) => ({ texto: a.innerText.trim(), w: Math.round(a.getBoundingClientRect().width), svg: !!a.querySelector('svg'), title: a.title }))
  check('solo el icono, con su nombre en el título', a.texto === '' && a.svg && /Apoyar PokeDoc/.test(a.title) && a.w <= 64, JSON.stringify(a))
  if (CAPS) await page.screenshot({ path: `${CAPS}/774-plegada.png`, clip: { x: 0, y: 600, width: 120, height: 300 } })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2b. En una pantalla bajita, dentro de la fila de tu cuenta ──')
{
  const { ctx, page, errores } = await abrir('/repeticiones', { alto: 560 })
  const r = await page.evaluate(() => {
    const l = document.querySelector('.lat')
    const a = document.querySelector('.lat-apoyar').getBoundingClientRect()
    const y = document.querySelector('.lat-yo').getBoundingClientRect()
    const encima = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2)?.closest('a, button')
    return { cabe: l.scrollHeight <= l.clientHeight + 1, prieta: l.classList.contains('lat-prieta'), dentro: a.top >= y.top - 1 && a.bottom <= y.bottom + 1, pulsa: encima?.className }
  })
  check('cabe entera: la taza va dentro de la fila de la cuenta', r.prieta && r.cabe && r.dentro, JSON.stringify(r))
  check('  …y lo que se pulsa ahí es Ko-fi, no la cuenta', r.pulsa === 'lat-apoyar', JSON.stringify(r))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. En el móvil, en la hoja «Tú» ──')
{
  const { ctx, page, errores } = await abrir('/index.html', { movil: true })
  check('sin lateral, no se ve en la página', (await page.$$eval('.lat-apoyar', (as) => as.filter((x) => x.getBoundingClientRect().height > 0).length)) === 0)
  await page.click('#navUserBtn')
  await page.waitForTimeout(900)
  const t = await page.$eval('#navUserDropdown .tu-apoyar', (a) => ({ href: a.getAttribute('href'), alto: a.getBoundingClientRect().height }))
  check('  …y sí en la hoja «Tú», al nuevo Ko-fi', t.href === KOFI && t.alto >= 44, JSON.stringify(t))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. El enlace viejo, en ninguna parte ──')
{
  const viejos = []
  const mirar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git'].includes(e.name)) continue
      const ruta = `${dir}/${e.name}`
      if (e.isDirectory()) { if (['js', 'css', 'netlify'].includes(e.name) || dir !== RAIZ) mirar(ruta); continue }
      if (!/\.(html|js|mjs|css)$/.test(e.name)) continue
      if (/ko-fi\.com\/pingucollects/.test(readFileSync(ruta, 'utf8'))) viejos.push(ruta.replace(`${RAIZ}/`, ''))
    }
  }
  mirar(RAIZ)
  check('ningún fichero de la web lleva ko-fi.com/pingucollects', viejos.length === 0, viejos.join(', '))
  const lateral = readFileSync(`${RAIZ}/js/barra-lateral.js`, 'utf8')
  const tu = readFileSync(`${RAIZ}/js/menu-tu.js`, 'utf8')
  check('el enlace vive en UN sitio: la lateral lo define y la hoja «Tú» lo importa', /export const KOFI = 'https:\/\/ko-fi\.com\/pokedoc'/.test(lateral) && /import \{ KOFI, DIBUJOS \} from '\.\/barra-lateral\.js'/.test(tu) && !/ko-fi\.com/.test(tu))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
