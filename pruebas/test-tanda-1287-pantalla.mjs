// Tanda 1287 — LOS INOCENTES: el 28 de diciembre, todo Ditto.
//
//   1. Lo puro: qué dirección es de un Pokémon (sprite o dibujo) y cuál es su
//      Ditto; una carta NO lo es.
//   2. La cabecera: `data-fiesta="inocentes"` el 28 (con la Navidad puesta) y
//      su hoja; el 27 no; `pd-sin-inocentes` la quita (la Navidad sigue); una
//      tienda no la ve.
//   3. La web: la marca dice «PokeDitto», los sprites que hay y los que llegan
//      se vuelven Ditto, las cartas no; tocar un Ditto la primera vez cuenta la
//      broma y no navega, la segunda sí.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. Lo puro ──')
const f = await import(`${RAIZ}/js/fiestas-puro.js`)
check('un sprite de Limitless → el Ditto de Limitless', f.dittoDe('https://r2.limitlesstcg.net/pokemon/gen9/gardevoir.png') === f.DITTO.sprite)
check('un dibujo oficial de PokeAPI → el dibujo de Ditto', f.dittoDe('https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/225.png') === f.DITTO.arte && f.dittoDe('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png') === f.DITTO.arte)
check('un sprite de PokeAPI → el de Ditto', f.dittoDe('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png') === f.DITTO.pixel)
check('nuestra /sprite también', f.dittoDe('/sprite/charizard') === f.DITTO.sprite && f.dittoDe('https://pokedoc.es/sprite/mew') === f.DITTO.sprite)
check('una carta NO (TCGdex, escaneo de Limitless, TCGGO, /escaneo)', ['https://assets.tcgdex.net/en/sv/sv2/10/low.webp', 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/PAL/PAL_010_R_EN.png', 'https://images.tcggo.com/x.png', '/escaneo/PAL/10'].every((u) => f.dittoDe(u) === null))
check('y un Ditto ya no se cambia', Object.values(f.DITTO).every((u) => f.dittoDe(u) === null))

const browser = await chromium.launch()
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="40" fill="#9b7ad1"/></svg>'
async function abrir({ ruta = '/foro', fecha = '2026-12-28', sin = false, tienda = false, sesion = tienda ? 'user-2' : 'user-1' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES' })
  await ctx.route(/jsdelivr|githubusercontent|limitless|tcgdex|tcggo/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: SVG }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.clock.setFixedTime(new Date(`${fecha}T12:00:00+01:00`))
  await page.addInitScript(({ sesion, sin, tienda }) => {
    window.__FAKE_SESSION__ = sesion
    if (tienda) { window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Prueba', username: 'prueba' }; window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2' }], tienda_stock: [] } }
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    try {
      if (sessionStorage.getItem('pd-prueba-puesto')) return
      sessionStorage.setItem('pd-prueba-puesto', '1')
      localStorage.setItem('pokedoc-theme', 'light')
      localStorage.setItem('pd-navidad-regalo-2026', '1')
      for (const s of ['inicio', 'aprender', 'cartas', 'comunidad', 'jugar']) localStorage.setItem(`pd-bienvenida-${s}`, '1')
      if (sin) localStorage.setItem('pd-sin-inocentes', '1')
    } catch {}
    // Un sprite que ya está en la página al cargar.
    document.addEventListener('DOMContentLoaded', () => document.body.insertAdjacentHTML('beforeend', '<a id="pruebaEnlace" href="/meta"><img id="spriteViejo" src="https://r2.limitlesstcg.net/pokemon/gen9/gardevoir.png" alt="" width="48" height="48"></a>'))
  }, { sesion, sin, tienda })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  const alPintar = await page.evaluate(() => ({ t: document.documentElement.dataset.temporada || null, f: document.documentElement.dataset.fiesta || null, hoja: !!document.querySelector('link[href="/css/inocentes.css"]') }))
  await page.waitForTimeout(2300)
  return { ctx, page, errores, alPintar }
}

console.log('\n── 2. La cabecera ──')
{
  const a = await abrir({})
  check('el 28: Inocentes, con la Navidad puesta y su hoja', a.alPintar.f === 'inocentes' && a.alPintar.t === 'navidad' && a.alPintar.hoja, JSON.stringify(a.alPintar))
  await a.ctx.close()
  const b = await abrir({ fecha: '2026-12-27' })
  check('el 27, no', b.alPintar.f === null && b.alPintar.t === 'navidad' && !b.alPintar.hoja, JSON.stringify(b.alPintar))
  await b.ctx.close()
  const c = await abrir({ sin: true })
  check('pd-sin-inocentes la quita (la Navidad sigue)', c.alPintar.f === null && c.alPintar.t === 'navidad', JSON.stringify(c.alPintar))
  await c.ctx.close()
}

console.log('\n── 3. La web ──')
{
  const { ctx, page, errores } = await abrir({})
  const marca = await page.evaluate(() => {
    const s = document.querySelector('.navbar .nav-logo span')
    return s ? getComputedStyle(s, '::before').content : null
  })
  check('la marca dice «PokeDitto»', marca === '"Ditto"', marca)
  const viejo = await page.evaluate(() => document.getElementById('spriteViejo')?.getAttribute('src'))
  check('el sprite que ya estaba es Ditto', viejo === f.DITTO.sprite, viejo)
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div id="llegan"><img id="arte" src="https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/6.png" alt=""><img id="carta" src="https://assets.tcgdex.net/en/sv/sv2/10/low.webp" alt=""></div>'))
  await page.waitForTimeout(300)
  const llegan = await page.evaluate(() => ({ arte: document.getElementById('arte').getAttribute('src'), carta: document.getElementById('carta').getAttribute('src') }))
  check('lo que llega después, también; la carta no', llegan.arte === f.DITTO.arte && /tcgdex/.test(llegan.carta), JSON.stringify(llegan))
  await page.evaluate(() => { document.getElementById('spriteViejo').src = 'https://r2.limitlesstcg.net/pokemon/gen9/mew.png' })
  await page.waitForTimeout(200)
  check('un sprite que cambia de dirección vuelve a ser Ditto', (await page.evaluate(() => document.getElementById('spriteViejo').getAttribute('src'))) === f.DITTO.sprite)
  const primero = await page.evaluate(() => {
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.getElementById('spriteViejo').dispatchEvent(ev)
    return ev.defaultPrevented
  })
  await page.waitForTimeout(200)
  const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '))
  check('tocar un Ditto: «¡Inocente!» y no navega', primero && /¡Inocente!/.test(toast), JSON.stringify({ primero, toast }))
  const segundo = await page.evaluate(() => {
    const a = document.getElementById('pruebaEnlace')
    let llega = false
    a.addEventListener('click', (e) => { llega = true; e.preventDefault() }, { once: true })
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.getElementById('spriteViejo').dispatchEvent(ev)
    return { llega }
  })
  check('  …la segunda vez, el Ditto lleva a donde llevaba', segundo.llega, JSON.stringify(segundo))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ tienda: true, ruta: '/tienda' })
  const r = await page.evaluate(() => ({ f: document.documentElement.dataset.fiesta || null, src: document.getElementById('spriteViejo')?.getAttribute('src') }))
  check('una tienda no ve la broma', r.f === null && /gardevoir/.test(r.src || ''), JSON.stringify(r))
  await ctx.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
