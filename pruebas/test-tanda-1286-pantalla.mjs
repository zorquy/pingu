// Tanda 1286 — LA NAVIDAD: la decoración (22 dic–6 ene) y el regalo de
// Delibird (25 dic–4 ene).
//
//   1. Lo puro: qué días es Navidad, cuándo toca el regalo y su llave.
//   2. La cabecera: `data-temporada="navidad"` y su hoja esos días (y no el 21
//      ni el 7), con tu tema; «Quitar la decoración» la quita; un navegador
//      automático no la ve salvo con ?temporada=navidad. Halloween, igual.
//   3. Inicio el 26: acento rojo en los dos temas, gorro, guirnalda y nieve
//      DETRÁS (lo que se pulsa sigue debajo del dedo); con «menos movimiento»
//      la nieve se para.
//   4. El regalo: sale una vez, «Abrir» enseña una carta con su enlace,
//      «Luego» no lo gasta; el 23 no sale; una tienda no lo ve.
//   5. Ajustes → Apariencia: el interruptor de la decoración.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. Lo puro ──')
const f = await import(`${RAIZ}/js/fiestas-puro.js`)
const d = (s) => new Date(s)
check('Navidad del 22 de diciembre al 6 de enero', [f.esNavidad(d('2026-12-21T12:00')), f.esNavidad(d('2026-12-22T12:00')), f.esNavidad(d('2027-01-06T12:00')), f.esNavidad(d('2027-01-07T12:00'))].join() === 'false,true,true,false')
check('el regalo, del 25 al 4 (hora de España)', [f.regaloToca(d('2026-12-24T12:00:00+01:00')), f.regaloToca(d('2026-12-24T23:30:00Z')), f.regaloToca(d('2027-01-04T12:00:00+01:00')), f.regaloToca(d('2027-01-05T12:00:00+01:00'))].join() === 'false,true,true,false')
check('la llave es de la temporada: el 2 de enero sigue siendo la de 2026', f.claveDeRegalo(d('2026-12-26T12:00:00+01:00')) === 'pd-navidad-regalo-2026' && f.claveDeRegalo(d('2027-01-02T12:00:00+01:00')) === 'pd-navidad-regalo-2026')
check('una carta para regalar, solo de las que tienen foto', f.cartaDeRegalo([{ id: 'a' }, { id: 'b', image_path: 'x' }], 0.1)?.id === 'b' && f.cartaDeRegalo([{ id: 'a' }]) === null)
check('las fiestas con decoración incluyen Halloween y Navidad', f.FIESTAS_CON_DECORACION.includes('halloween') && f.FIESTAS_CON_DECORACION.includes('navidad'))

const browser = await chromium.launch()
const NOMBRES = f.REGALOS.map(([n]) => n)
const CARTAS = NOMBRES.map((n, i) => ({ id: `sv2-${i + 10}`, market: 'WEST', name: n, name_es: n, local_id: String(i + 10), set_id: 'sv2', image_path: `sv/sv2/${i + 10}` }))
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#9ed2ee"/></svg>'
async function abrir({ ruta = '/', fecha = '2026-12-26', humano = true, tema = 'light', movil = false, regalo = false, tienda = false, sin = false, reducir = false, sesion = tienda ? 'user-2' : 'user-1' } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', reducedMotion: reducir ? 'reduce' : 'no-preference' } : { viewport: { width: 1280, height: 860 }, locale: 'es-ES', reducedMotion: reducir ? 'reduce' : 'no-preference' })
  await ctx.route(/jsdelivr|githubusercontent|assets\.tcgdex|limitless|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.clock.setFixedTime(new Date(`${fecha}T12:00:00+01:00`))
  await page.addInitScript(({ humano, sesion, CARTAS, regalo, tema, tienda, sin }) => {
    if (sesion) window.__FAKE_SESSION__ = sesion
    if (tienda) { window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Prueba', username: 'prueba' }; window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao' }], tienda_stock: [] } }
    if (humano) Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_ADVIENTO__ = []
    try {
      if (sessionStorage.getItem('pd-prueba-puesto')) return
      sessionStorage.setItem('pd-prueba-puesto', '1')
      localStorage.setItem('pokedoc-theme', tema)
      localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
      localStorage.setItem('pokedoc-push-no', JSON.stringify({ en: Date.now(), veces: 2 }))
      for (const s of ['inicio', 'aprender', 'cartas', 'comunidad', 'jugar']) localStorage.setItem(`pd-bienvenida-${s}`, '1')
      if (!regalo) localStorage.setItem('pd-navidad-regalo-2026', '1')
      if (sin) localStorage.setItem('pd-sin-navidad', '1')
    } catch {}
  }, { humano, sesion, CARTAS, regalo, tema, tienda, sin })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  const alPintar = await page.evaluate(() => ({ t: document.documentElement.dataset.temporada || null, theme: document.documentElement.dataset.theme || null, hoja: !!document.querySelector('link[href="/css/navidad.css"]') }))
  await page.waitForTimeout(2300)
  return { ctx, page, errores, alPintar }
}

console.log('\n── 2. La cabecera ──')
for (const [fecha, espera] of [['2026-12-21', null], ['2026-12-22', 'navidad'], ['2027-01-06', 'navidad'], ['2027-01-07', null]]) {
  const { ctx, alPintar } = await abrir({ fecha, ruta: '/foro' })
  check(`el ${fecha}: ${espera || 'sin fiesta'}`, alPintar.t === espera && alPintar.hoja === !!espera, JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ tema: 'light', ruta: '/foro' })
  check('con tus colores: el tema claro no se toca', alPintar.theme !== 'dark', JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ sin: true, ruta: '/foro' })
  check('«Quitar la decoración» (pd-sin-navidad) la quita', alPintar.t === null && !alPintar.hoja, JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ humano: false, ruta: '/foro' })
  check('un navegador automático no la ve', alPintar.t === null)
  await ctx.close()
  const b = await abrir({ humano: false, ruta: '/foro?temporada=navidad', fecha: '2026-11-12' })
  check('  …salvo con ?temporada=navidad', b.alPintar.t === 'navidad' && b.alPintar.hoja)
  await b.ctx.close()
  const h = await abrir({ fecha: '2026-10-31', ruta: '/foro' })
  check('Halloween sigue igual (de noche)', h.alPintar.t === 'halloween' && h.alPintar.theme === 'dark', JSON.stringify(h.alPintar))
  await h.ctx.close()
}

console.log('\n── 3. Inicio el 26 ──')
const deco = (page) => page.evaluate(() => {
  const r = document.documentElement
  const cs = getComputedStyle(r)
  const nieve = getComputedStyle(r, '::before')
  const logo = document.querySelector('.navbar .nav-logo')
  const gorro = logo ? getComputedStyle(logo, '::after') : null
  const guirnalda = getComputedStyle(document.querySelector('.navbar'), '::after')
  // Lo que se pulsa sigue debajo del dedo: la nieve va detrás.
  const tapados = [...document.querySelectorAll('main a, main button')].filter((el) => {
    const b = el.getBoundingClientRect()
    if (b.width < 4 || b.height < 4 || b.top < 80 || b.bottom > innerHeight - 100 || getComputedStyle(el).visibility === 'hidden') return false
    const x = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
    return x && !el.contains(x) && !x.contains(el) && x === document.documentElement
  }).length
  return {
    acento: cs.getPropertyValue('--acento').trim(),
    nieve: { pos: nieve.position, z: nieve.zIndex, eventos: nieve.pointerEvents, anima: nieve.animationName },
    gorro: gorro && gorro.content !== 'none' && gorro.backgroundImage.includes('svg'),
    guirnalda: guirnalda.content !== 'none' && guirnalda.pointerEvents === 'none',
    boton: getComputedStyle(document.querySelector('.btn-primary') || document.body).backgroundColor,
    tapados,
  }
})
{
  const { ctx, page, errores } = await abrir({})
  const x = await deco(page)
  check('acento rojo en el claro', x.acento === '#c62f3a', x.acento)
  check('la nieve va detrás y no se pulsa', x.nieve.pos === 'fixed' && x.nieve.z === '-1' && x.nieve.eventos === 'none' && x.nieve.anima === 'navidad-nieve', JSON.stringify(x.nieve))
  check('gorro en la «P» y guirnalda bajo la barra', x.gorro && x.guirnalda)
  check('lo que se pulsa no lo tapa nada', x.tapados === 0, x.tapados)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ tema: 'dark', movil: true })
  const x = await deco(page)
  check('acento rojo claro en el oscuro (móvil)', x.acento === '#e0525c', x.acento)
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ reducir: true })
  const x = await deco(page)
  check('con «menos movimiento» la nieve se para', x.nieve.anima === 'none', x.nieve.anima)
  await ctx.close()
}

console.log('\n── 4. El regalo ──')
const pop = (page) => page.evaluate(() => {
  const p = document.querySelector('.navidad-pop')
  return { abierto: !!p?.open, titulo: p?.querySelector('h2:not([hidden])')?.textContent || '' }
})
{
  const { ctx, page, errores } = await abrir({ regalo: true })
  await page.waitForTimeout(800)
  const a = await pop(page)
  check('el 26 sale el pop-up de Delibird', a.abierto && /Delibird/.test(a.titulo), JSON.stringify(a))
  await page.click('[data-navidad-abrir]')
  await page.waitForSelector('[data-navidad-regalo]:not([hidden]) h2', { timeout: 5000 }).catch(() => {})
  const r = await page.evaluate(() => {
    const c = document.querySelector('[data-navidad-regalo]')
    return { nombre: c?.querySelector('h2')?.textContent || '', href: c?.querySelector('a.btn-primary')?.getAttribute('href') || '', foto: !!c?.querySelector('.navidad-carta img'), visto: localStorage.getItem('pd-navidad-regalo-2026') }
  })
  check('«Abrir el regalo» enseña una carta de invierno con su enlace', NOMBRES.includes(r.nombre) && /^\/carta\//.test(r.href) && r.foto, JSON.stringify(r))
  check('  …y lo apunta: una vez por persona', r.visto === '1')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  check('  …al volver, ya no sale', !(await pop(page)).abierto)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ regalo: true, movil: true })
  await page.waitForTimeout(800)
  await page.click('[data-navidad-luego]')
  const r = await page.evaluate(() => ({ visto: localStorage.getItem('pd-navidad-regalo-2026'), abierto: !!document.querySelector('.navidad-pop')?.open }))
  check('«Luego» lo cierra sin gastarlo', !r.abierto && r.visto === null, JSON.stringify(r))
  await ctx.close()
}
{
  const { ctx, page, alPintar } = await abrir({ regalo: true, fecha: '2026-12-23' })
  await page.waitForTimeout(800)
  check('el 23 hay decoración pero no regalo', alPintar.t === 'navidad' && !(await pop(page)).abierto)
  await ctx.close()
}
{
  const { ctx, page, alPintar } = await abrir({ regalo: true, tienda: true, ruta: '/tienda' })
  await page.waitForTimeout(800)
  { const pp = await pop(page); check('una tienda ve la decoración pero no el regalo', alPintar.t === 'navidad' && !pp.abierto, JSON.stringify({ alPintar, pp, url: page.url() })) }
  await ctx.close()
}

console.log('\n── 5. Ajustes ──')
{
  const { ctx, page, errores } = await abrir({ ruta: '/ajustes?ver=apariencia', fecha: '2026-11-12' })
  await page.waitForSelector('[data-interruptor="decoracion"]', { timeout: 5000 }).catch(() => {})
  const antes = await page.evaluate(() => document.querySelector('[data-interruptor="decoracion"]')?.checked)
  await page.evaluate(() => { const i = document.querySelector('[data-interruptor="decoracion"]'); i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true })) })
  const r = await page.evaluate(() => ({ h: localStorage.getItem('pd-sin-halloween'), n: localStorage.getItem('pd-sin-navidad') }))
  check('«Decoración de las fiestas» está encendida y apagarla quita todas', antes === true && r.h === '1' && r.n === '1', JSON.stringify({ antes, ...r }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
