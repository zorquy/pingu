// Tanda 1289 — LOS REYES: el 5 y el 6 de enero, «Los Reyes Magos han pasado
// por PokeDoc» con las tres cartas de tu «La quiero» que menos cuestan hoy.
//
//   1. Lo puro: las más baratas (una vez cada carta, sin las que no tienen
//      precio) y la llave por año.
//   2. La cabecera: `data-fiesta="reyes"` y su hoja el 5 y el 6 (la Navidad
//      sigue el 6), no el 4 ni el 7; la corona en la «P».
//   3. El pop-up: tus tres más baratas en el idioma que las quieres, con su
//      enlace y «Ver en el Mercado»; una vez; con la lista vacía, a La quiero;
//      sin cuenta y a una tienda, nada.
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
{
  const r = f.masBaratas([{ card_id: 'a', valor: 5 }, { card_id: 'b', valor: 0.5 }, { card_id: 'a', valor: 2 }, { card_id: 'c', valor: null }, { card_id: 'd', valor: 9 }, { card_id: 'e', valor: 1 }])
  check('las tres más baratas, una vez cada una y sin las que no tienen precio', r.map((x) => `${x.card_id}:${x.valor}`).join() === 'b:0.5,e:1,a:2', JSON.stringify(r))
  check('sin nada con precio, ninguna', f.masBaratas([{ card_id: 'x', valor: 0 }]).length === 0)
  check('la llave es por año', f.claveDeReyes(new Date('2027-01-06T12:00:00+01:00')) === 'pd-reyes-2027')
  check('Reyes está en la decoración que apaga Ajustes', f.FIESTAS_CON_DECORACION.includes('reyes'))
}

const browser = await chromium.launch()
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#9ed2ee"/></svg>'
const DESEOS = [
  { id: 'd1', user_id: 'user-1', card_id: 'c1', market: 'WEST', idioma: 'es' },
  { id: 'd2', user_id: 'user-1', card_id: 'c2', market: 'WEST', idioma: 'es' },
  { id: 'd3', user_id: 'user-1', card_id: 'c3', market: 'WEST', idioma: 'en' },
  { id: 'd4', user_id: 'user-1', card_id: 'c4', market: 'WEST', idioma: 'es' },
  { id: 'd5', user_id: 'user-1', card_id: 'c5', market: 'WEST', idioma: 'es' },
]
// c3 la quiere en inglés: su precio es el inglés (1,00), no el español (0,10).
const PRECIOS = [
  { card_id: 'c1', cm_low_es: 12 }, { card_id: 'c2', cm_low_es: 3.5 }, { card_id: 'c3', cm_low_es: 0.1, cm_low_en: 1 },
  { card_id: 'c4', cm_low_es: 0.8 }, { card_id: 'c5' },
]
const CARTAS = ['Pikachu', 'Eevee', 'Snorlax', 'Mew', 'Lapras'].map((n, i) => ({ id: `c${i + 1}`, market: 'WEST', name: n, name_es: n, local_id: String(i + 1), set_id: 'sv2', image_path: `sv/sv2/${i + 1}` }))
async function abrir({ ruta = '/foro', fecha = '2027-01-06', sesion = 'user-1', deseos = DESEOS, tienda = false, visto = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES' })
  await ctx.route(/jsdelivr|githubusercontent|assets\.tcgdex|limitless|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.clock.setFixedTime(new Date(`${fecha}T12:00:00+01:00`))
  await page.addInitScript(({ sesion, deseos, PRECIOS, CARTAS, tienda, visto }) => {
    window.__FAKE_SESSION__ = sesion
    if (tienda) { window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Prueba', username: 'prueba' }; window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2' }], tienda_stock: [] } }
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    window.__FAKE_DESEOS__ = deseos
    window.__FAKE_PRECIOS__ = PRECIOS
    window.__FAKE_CARTAS__ = CARTAS
    try {
      if (sessionStorage.getItem('pd-prueba-puesto')) return
      sessionStorage.setItem('pd-prueba-puesto', '1')
      localStorage.setItem('pokedoc-theme', 'light')
      for (const s of ['inicio', 'aprender', 'cartas', 'comunidad', 'jugar']) localStorage.setItem(`pd-bienvenida-${s}`, '1')
      if (visto) localStorage.setItem('pd-reyes-2027', '1')
    } catch {}
  }, { sesion, deseos, PRECIOS, CARTAS, tienda, visto })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  const alPintar = await page.evaluate(() => ({ f: document.documentElement.dataset.fiesta || null, t: document.documentElement.dataset.temporada || null, hoja: !!document.querySelector('link[href="/css/reyes.css"]') }))
  await page.waitForTimeout(3000)
  return { ctx, page, errores, alPintar }
}
const pop = (page) => page.evaluate(() => {
  const p = document.querySelector('.reyes-pop')
  return {
    abierto: !!p?.open,
    titulo: p?.querySelector('h2')?.textContent || '',
    cartas: [...(p?.querySelectorAll('.reyes-carta') || [])].map((a) => `${a.querySelector('b').textContent}:${a.querySelector('small').textContent.replace(/\s/g, ' ')}:${a.getAttribute('href')}`),
    botones: [...(p?.querySelectorAll('.reyes-botones a') || [])].map((a) => a.getAttribute('href')),
  }
})

console.log('\n── 2. La cabecera ──')
for (const [fecha, f, t] of [['2027-01-04', null, 'navidad'], ['2027-01-05', 'reyes', 'navidad'], ['2027-01-06', 'reyes', 'navidad'], ['2027-01-07', null, null]]) {
  const { ctx, alPintar } = await abrir({ fecha, visto: true })
  check(`${fecha}: ${f || 'sin Reyes'}`, alPintar.f === f && alPintar.t === t && alPintar.hoja === !!f, JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ visto: true })
  const corona = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.navbar .nav-logo'), '::after'); return s.content !== 'none' && /f4c542/.test(decodeURIComponent(s.backgroundImage)) })
  check('la corona en la «P»', corona)
  await ctx.close()
}

console.log('\n── 3. El pop-up ──')
{
  const { ctx, page, errores } = await abrir({})
  const a = await pop(page)
  check('sale «Los Reyes Magos han pasado por PokeDoc»', a.abierto && /Reyes Magos/.test(a.titulo), JSON.stringify(a))
  check('tus tres más baratas, en el idioma que las quieres (Mew 0,80, Snorlax 1,00 en inglés, Eevee 3,50)', a.cartas.length === 3 && /^Mew:desde 0,80 €:\/carta\//.test(a.cartas[0]) && /^Snorlax:desde 1,00 €/.test(a.cartas[1]) && /^Eevee:desde 3,50 €/.test(a.cartas[2]), a.cartas.join(' | '))
  check('«Ver en el Mercado»', a.botones.includes('/mi-coleccion?ver=mercado'), a.botones.join())
  check('se apunta: una vez por persona y año', (await page.evaluate(() => localStorage.getItem('pd-reyes-2027'))) === '1')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('  …al volver, ya no sale', !(await pop(page)).abierto)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ deseos: [] })
  const a = await pop(page)
  check('con «La quiero» vacía, te lleva a apuntar', a.abierto && a.cartas.length === 0 && a.botones.includes('/mi-coleccion?ver=quiero'), JSON.stringify(a))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ sesion: 'none' })
  check('sin cuenta, nada', !(await pop(page)).abierto)
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ tienda: true, sesion: 'user-2', ruta: '/tienda' })
  check('una tienda, nada', !(await pop(page)).abierto)
  await ctx.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
