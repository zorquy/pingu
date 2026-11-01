// Tanda 1150 — de «Cuatro pantallas más»:
//   C3 · el perfil a lo ancho en el PC (cabecera de lado a lado, cifras a la
//        derecha, pestañas y vitrina con todo el ancho).
//   C4 · Mis mazos compactos: una fila por mazo en el móvil; en el PC, la
//        franja de foto más baja.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const b = await chromium.launch()

console.log('── 1. El perfil en el PC ──')
for (const ruta of ['/perfil.html', '/usuario/Misty']) {
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const main = r('main'), hero = r('#profileHero'), tabs = r('#profileTabs'), cifras = r('.perfil-cifras'), nombre = r('.profile-hero-info h1')
    return { main: main?.width, hero: hero?.width, tabsW: tabs?.width, tabsTop: tabs?.top, heroBottom: hero?.bottom, cifrasX: cifras?.left, nombreX: nombre?.left, cifrasY: cifras?.top, nombreY: nombre?.top }
  })
  check(`${ruta}: la cabecera ocupa todo el ancho`, m.hero > m.main * 0.9, JSON.stringify(m))
  check('  …las pestañas van DEBAJO y también a lo ancho', m.tabsTop >= m.heroBottom - 1 && m.tabsW > m.main * 0.9, JSON.stringify(m))
  check('  …y las cifras a la derecha del nombre, en la misma franja', m.cifrasX > m.nombreX + 300 && Math.abs(m.cifrasY - m.nombreY) < 120, JSON.stringify(m))
  check('  …sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/perfil.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  check('en el móvil, el perfil sigue en columna (sin desbordar)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && getComputedStyle(document.getElementById('profileHero')).display !== 'grid'))
  await ctx.close()
}

console.log('── 2. Mis mazos ──')
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mazos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.cm-mazo-tarjeta', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  const t = await page.$$eval('.cm-mazo-tarjeta', (ts) => ts.map((x) => ({ alto: Math.round(x.getBoundingClientRect().height), foto: Math.round(x.querySelector('.cm-mazo-portada').getBoundingClientRect().width), formato: getComputedStyle(x.querySelector('.mz-chip-formato')).display !== 'none', probar: !!x.querySelector('a[href^="/laboratorio"]') })))
  check('en el móvil, una fila por mazo (menos de 180 de alto) con la foto en pequeño', t.length && t.every((x) => x.alto < 180 && x.foto <= 72), JSON.stringify(t))
  check('  …el formato en una chapa y «Probar» a mano', t.every((x) => x.formato && x.probar), JSON.stringify(t))
  check('  …sin desbordar de lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await ctx.close()
}
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/mazos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.cm-mazo-tarjeta', { timeout: 8000 }).catch(() => {})
  const p = await page.$eval('.cm-mazo-portada', (e) => { const r = e.getBoundingClientRect(); return r.width / r.height })
  const cols = await page.$eval('#mzLista', (l) => getComputedStyle(l).gridTemplateColumns.split(' ').length)
  check('en el PC, tres por fila y la franja de foto baja (16:7)', cols >= 3 && Math.abs(p - 16 / 7) < 0.1, `${cols} columnas · ${p.toFixed(2)}`)
  check('  …y el formato sigue en la foto, no repetido en las chapas', !(await page.locator('.mz-chip-formato').first().isVisible()))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo verde')
process.exit(fails ? 1 : 0)
