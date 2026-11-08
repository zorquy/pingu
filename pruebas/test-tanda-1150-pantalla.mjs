// Tanda 1150 — de «Cuatro pantallas más»:
//   C3 · el perfil a lo ancho en el PC; desde la 1270, en dos columnas.
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
  // Desde la 1273 (PINGU eligió la «A · Cabecera ancha»): quién es A LO ANCHO,
  // las losas debajo, y las pestañas con una columna de 340 a la derecha
  // (cambios y seguidores), quieta al bajar.
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const hero = r('#profileHero'), tabs = r('#profileTabs'), losas = r('#profileStats'), lado = r('.perfil-lado')
    return { heroW: Math.round(hero.width), losasW: Math.round(losas.width), heroL: Math.round(hero.left), tabsL: Math.round(tabs.left), tabsR: Math.round(tabs.right), ladoL: Math.round(lado.left), ladoW: Math.round(lado.width), losasDebajo: losas.top >= hero.bottom - 1, tabsDebajo: tabs.top >= losas.bottom - 1, pegada: getComputedStyle(document.querySelector('.perfil-lado')).position }
  })
  check(`${ruta}: quién es, a lo ancho de la columna, con las losas debajo`, m.heroW === m.losasW && m.heroW > 1000 && m.losasDebajo, JSON.stringify(m))
  check('  …las pestañas debajo, y a su derecha la columna de 340', m.tabsDebajo && m.tabsL === m.heroL && m.ladoL > m.tabsR && m.ladoW === 340, JSON.stringify(m))
  check('  …que se queda quieta al bajar', m.pegada === 'sticky', m.pegada)
  check('  …sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/perfil.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  check('en el móvil, el perfil sigue en columna (sin desbordar)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && getComputedStyle(document.querySelector('.perfil-rejilla')).display !== 'grid'))
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
