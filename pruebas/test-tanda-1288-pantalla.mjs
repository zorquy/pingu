// Tanda 1288 — NOCHEVIEJA: la tarjeta de Inicio con los fuegos y la cuenta
// atrás, «¡Feliz 2027!» a las 00:00 de España y «Tu 2026 en PokeDoc».
//
//   1. Lo puro: la cuenta (hora de España), el año que se resume, las
//      diapositivas (sin cifras a cero) y el resumen.
//   2. La cabecera: `data-fiesta="nochevieja"` el 31 y el 1, no el 30.
//   3. Inicio el 31: la tarjeta en su sitio reservado, el reloj que corre y,
//      a las 00:00, «¡Feliz 2027!»; en el móvil, encima del saludo.
//   4. Las historias: tus cifras del año, tu primera carta, pasar y volver, y
//      «Compartir mi 2026» con la hoja de siempre. Con «menos movimiento» no
//      pasan solas.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. Lo puro ──')
const p = await import(`${RAIZ}/js/nochevieja-puro.js`)
const d = (s) => new Date(s)
check('el 31 a las 21:00 de España quedan 03:00:00 para 2027', JSON.stringify(p.cuentaAtras(d('2026-12-31T21:00:00+01:00'))) === JSON.stringify({ feliz: false, anio: 2027, quedan: 3 * 3600 * 1000, texto: '03:00:00' }))
check('la hora es la de España: las 23:30 UTC del 31 ya es 2027', p.cuentaAtras(d('2026-12-31T23:30:00Z')).feliz === true && p.cuentaAtras(d('2026-12-31T23:30:00Z')).anio === 2027)
check('el año que se resume: el 31 y el 1, 2026', p.anioDelResumen(d('2026-12-31T12:00:00+01:00')) === 2026 && p.anioDelResumen(d('2027-01-01T12:00:00+01:00')) === 2026)
{
  const lleno = p.diapositivas({ nombre: 'Ash', cartas: 1588, primera: { id: 'x', name: 'Pikachu' }, mejorRacha: 12, retos: 80, mensajes: 30, guias: 4, logros: 9 }, 2026)
  check('con todo: portada, cartas, primera, racha, foro y final', lleno.map((x) => x.tipo).join() === 'portada,cifra,carta,cifra,cifra,final' && lleno[1].cifra === '1.588' && /12/.test(lleno[3].cifra) && /4 guías leídas/.test(lleno[4].texto), JSON.stringify(lleno.map((x) => x.cifra || x.tipo)))
  const vacio = p.diapositivas({ cartas: 0, mejorRacha: 0, mensajes: 0, guias: 0, logros: 0 }, 2026)
  check('sin nada: solo la portada y el final (una cifra a cero no se enseña)', vacio.map((x) => x.tipo).join() === 'portada,final' && vacio[1].cifras.length === 0)
  check('el final dice ¡Feliz 2027!', lleno.at(-1).titulo === '¡Feliz 2027!')
}

const browser = await chromium.launch()
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#9ed2ee"/></svg>'
const COLECCION = [
  { id: 'c1', user_id: 'user-1', card_id: 'sv2-10', market: 'WEST', cantidad: 3, created_at: '2026-02-03T10:00:00Z' },
  { id: 'c2', user_id: 'user-1', card_id: 'sv2-11', market: 'WEST', cantidad: 2, created_at: '2026-06-03T10:00:00Z' },
  { id: 'c3', user_id: 'user-1', card_id: 'sv2-12', market: 'WEST', cantidad: 5, created_at: '2025-12-20T10:00:00Z' },
]
const CARTAS = [{ id: 'sv2-10', market: 'WEST', name: 'Lapras', name_es: 'Lapras', local_id: '10', set_id: 'sv2', image_path: 'sv/sv2/10' }]
async function abrir({ ruta = '/', cuando = '2026-12-31T20:59:55+01:00', movil = false, reducir = false, correr = false } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 860 } }), locale: 'es-ES', reducedMotion: reducir ? 'reduce' : 'no-preference' })
  await ctx.route(/jsdelivr|githubusercontent|assets\.tcgdex|limitless|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: SVG }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  if (correr) await page.clock.install({ time: new Date(cuando) })
  else await page.clock.setFixedTime(new Date(cuando))
  await page.addInitScript(({ COLECCION, CARTAS }) => {
    window.__FAKE_SESSION__ = 'user-1'
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    window.__FAKE_COLECCION__ = COLECCION
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_ADVIENTO__ = []
    window.__FAKE_RETOS_NUMEROS__ = { mejorRacha: 12, jugados: 80, diasPerfectos: 3, dias: {} }
    window.__FAKE_MENSAJES__ = [{ id: 'm1', author_id: 'user-1', thread_id: 't1', created_at: '2026-05-01T10:00:00Z' }, { id: 'm2', author_id: 'user-1', thread_id: 't1', created_at: '2026-07-01T10:00:00Z' }]
    try {
      localStorage.setItem('pokedoc-theme', 'light')
      localStorage.setItem('pd-navidad-regalo-2026', '1')
      localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
      localStorage.setItem('pokedoc-push-no', JSON.stringify({ en: Date.now(), veces: 2 }))
      for (const s of ['inicio', 'aprender', 'cartas', 'comunidad', 'jugar']) localStorage.setItem(`pd-bienvenida-${s}`, '1')
    } catch {}
  }, { COLECCION, CARTAS })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  const alPintar = await page.evaluate(() => {
    const c = document.getElementById('nochevieja')
    return { f: document.documentElement.dataset.fiesta || null, alto: c ? Math.round(c.getBoundingClientRect().height) : 0 }
  })
  if (correr) {
    // Con el reloj falso hay que hacerlo avanzar hasta que la tarjeta pinte.
    for (let i = 0; i < 20; i++) {
      await page.clock.runFor(250)
      await page.waitForTimeout(50)
      if (await page.evaluate(() => !!document.querySelector('#nochevieja [data-nv-reloj], #nochevieja .nv-feliz'))) break
    }
  } else await page.waitForTimeout(2300)
  return { ctx, page, errores, alPintar }
}

console.log('\n── 2. La cabecera ──')
for (const [cuando, espera] of [['2026-12-30T12:00:00+01:00', null], ['2026-12-31T12:00:00+01:00', 'nochevieja'], ['2027-01-01T12:00:00+01:00', 'nochevieja'], ['2027-01-02T12:00:00+01:00', null]]) {
  const { ctx, alPintar } = await abrir({ ruta: '/foro', cuando })
  check(`${cuando.slice(0, 10)}: ${espera || 'nada'}`, alPintar.f === espera, JSON.stringify(alPintar))
  await ctx.close()
}

console.log('\n── 3. Inicio ──')
const tarjeta = (page) => page.evaluate(() => {
  const c = document.getElementById('nochevieja')
  const r = c.getBoundingClientRect()
  return { visible: getComputedStyle(c).display !== 'none', alto: Math.round(r.height), top: Math.round(r.top), reloj: c.querySelector('[data-nv-reloj]')?.textContent || '', feliz: c.querySelector('.nv-feliz')?.textContent || '', boton: c.querySelector('[data-nv-ver]')?.textContent || '', saludo: Math.round(document.querySelector('#bienvenidaSeccion h1, #bienvenidaSeccion h2, .bienvenida-saludo')?.getBoundingClientRect().top ?? -1) }
})
{
  const { ctx, page, errores, alPintar } = await abrir({ correr: true })
  check('el sitio está reservado desde el primer pintado', alPintar.alto >= 132, alPintar.alto)
  const a = await tarjeta(page)
  check('la tarjeta con la cuenta atrás y «Ver tu 2026»', a.visible && /^03:00:\d\d$/.test(a.reloj) && a.boton === 'Ver tu 2026', JSON.stringify(a))
  check('  …sin saltar al llenarse', Math.abs(a.alto - alPintar.alto) <= 4, `${alPintar.alto} → ${a.alto}`)
  await page.clock.runFor(3000)
  const b = await tarjeta(page)
  check('el reloj corre', b.reloj && b.reloj !== a.reloj, `${a.reloj} → ${b.reloj}`)
  await page.clock.runFor(3 * 3600 * 1000 + 6000)
  const c = await tarjeta(page)
  check('a las 00:00 de España: «¡Feliz 2027!»', c.feliz === '¡Feliz 2027!' && !c.reloj, JSON.stringify(c))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ movil: true })
  const a = await tarjeta(page)
  check('en el móvil va encima del saludo y en la primera pantalla', a.visible && (a.saludo < 0 || a.top < a.saludo) && a.top < 400, JSON.stringify(a))
  await ctx.close()
}

console.log('\n── 4. Las historias ──')
{
  const { ctx, page, errores } = await abrir({ reducir: true })
  await page.click('[data-nv-ver]')
  await page.waitForSelector('.nv-diapo[data-tipo="portada"]', { timeout: 6000 }).catch(() => {})
  const pasos = []
  for (let i = 0; i < 8; i++) {
    const s = await page.evaluate(() => {
      const c = document.querySelector('[data-nv-diapo]')
      return { tipo: c?.dataset.tipo, texto: c?.textContent.replace(/\s+/g, ' ').trim().slice(0, 90), barras: document.querySelectorAll('[data-nv-barras] i').length }
    })
    pasos.push(s)
    if (s.tipo === 'final') break
    await page.click('[data-nv-alante]')
    await page.waitForTimeout(150)
  }
  const tipos = pasos.map((s) => s.tipo).join()
  check('portada, cartas, primera, racha, foro y final', tipos === 'portada,cifra,carta,cifra,cifra,final', tipos)
  check('las cifras son las tuyas de 2026 (5 cartas, no las de 2025)', /^5\s*cartas añadidas/.test(pasos[1]?.texto || ''), pasos[1]?.texto)
  check('tu primera carta del año', /Lapras/.test(pasos[2]?.texto || ''), pasos[2]?.texto)
  check('tu racha y tus mensajes', /^12\s*días/.test(pasos[3]?.texto || '') && /^2\s*mensajes en el foro/.test(pasos[4]?.texto || ''), `${pasos[3]?.texto} | ${pasos[4]?.texto}`)
  check('una barra por historia', pasos[0]?.barras === pasos.length, `${pasos[0]?.barras} de ${pasos.length}`)
  await page.click('[data-nv-atras]')
  check('tocar a la izquierda vuelve', (await page.evaluate(() => document.querySelector('[data-nv-diapo]').dataset.tipo)) === 'cifra')
  await page.click('[data-nv-alante]')
  await page.waitForTimeout(150)
  await page.click('[data-nv-compartir]')
  await page.waitForTimeout(2500)
  const hoja = await page.evaluate(() => ({ abierta: !!document.querySelector('dialog[open] canvas, dialog[open] img[src^="blob:"], dialog[open] img[src^="data:"]'), titulo: [...document.querySelectorAll('dialog[open]')].map((x) => x.textContent.replace(/\s+/g, ' ').slice(0, 200)).join(' | ') }))
  check('«Compartir mi 2026» abre la hoja con la imagen', hoja.abierta && /Compartir tu 2026/.test(hoja.titulo), JSON.stringify(hoja))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ correr: true })
  await page.click('[data-nv-ver]')
  await page.clock.runFor(1500)
  const antes = await page.evaluate(() => document.querySelector('[data-nv-diapo]')?.dataset.tipo)
  await page.clock.runFor(6500)
  const despues = await page.evaluate(() => document.querySelector('[data-nv-diapo]')?.dataset.tipo)
  check('pasan solas, como una historia', antes === 'portada' && despues === 'cifra', `${antes} → ${despues}`)
  await ctx.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
