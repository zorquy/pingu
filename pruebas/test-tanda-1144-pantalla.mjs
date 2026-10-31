// Tanda 1144 — «Lo que se ha quedado viejo», el resto: V3, el glosario como
// un diccionario (cada término abierto, el ejemplo en cita, los otros nombres
// en una línea; en el PC dos columnas y las letras en un índice a la
// derecha); V5, la pestaña Foro del perfil con las cifras en chapas y las
// listas como las del foro; V4, «Entrar» con su panel en el PC y su abanico
// en el móvil, y la bienvenida con la mascota y lo que hay.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const b = await chromium.launch()

console.log('── 1. Glosario en el móvil ──')
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/glosario`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const d = await page.evaluate(() => {
    const t = document.getElementById('banca')
    return {
      n: document.querySelectorAll('article.glosario-termino').length,
      details: document.querySelectorAll('details.glosario-termino').length,
      def: t?.querySelector('.glosario-def')?.getBoundingClientRect().height > 0,
      ejemplo: getComputedStyle(t?.querySelector('.glosa-ejemplo')).borderLeftWidth,
      otros: t?.querySelector('.glosario-otros')?.textContent.trim(),
      en: t?.querySelector('.glosario-en')?.textContent,
      ancho: document.documentElement.scrollWidth <= innerWidth + 1,
    }
  })
  check('cada término abierto, sin tocar (artículos, no <details>)', d.n >= 30 && d.details === 0 && d.def, JSON.stringify(d))
  check('  …con el inglés al lado y el ejemplo en una cita', d.en === 'Bench' && d.ejemplo === '2px', JSON.stringify(d))
  check('  …y los otros nombres en una línea, sin repetir', /^También: /.test(d.otros || '') ? !/Bench|Banca,/i.test(d.otros.replace('También: ', '').split(', ').filter((x) => /^(banca|bench)$/i.test(x)).join()) : d.otros === undefined, d.otros)
  check('nada se sale de lado', d.ancho)
  await page.fill('#glosarioBuscar', 'premio')
  await page.waitForTimeout(200)
  // Lo que se VE, no el atributo: el `display: grid` del término le ganaba a `hidden`.
  const v = await page.$$eval('.glosario-termino', (as) => as.filter((a) => a.getBoundingClientRect().height > 0).length)
  check('buscar sigue filtrando (y lo que no casa no se ve)', v >= 1 && v < 10, v)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: '/tmp/1144-glosario-movil.png' })
  await ctx.close()
}

console.log('── 2. Glosario en el PC ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/glosario`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const d = await page.evaluate(() => {
    const lista = document.getElementById('glosarioLista').getBoundingClientRect()
    const letras = document.getElementById('glosarioLetras').getBoundingClientRect()
    return { columnas: getComputedStyle(document.getElementById('glosarioLista')).columnCount, derecha: letras.left >= lista.right - 1, vertical: letras.height > letras.width, ancho: document.documentElement.scrollWidth <= innerWidth + 1 }
  })
  check('dos columnas de diccionario', d.columnas === '2', JSON.stringify(d))
  check('las letras, en un índice vertical a la derecha', d.derecha && d.vertical, JSON.stringify(d))
  await page.locator('.glosario-letras a', { hasText: /^E$/ }).click()
  await page.waitForTimeout(600)
  const actual = await page.$eval('.glosario-letras a.glosario-letra-actual', (a) => a.textContent).catch(() => null)
  check('  …marcando la letra en la que estás (tocar la E lleva a la E y la marca)', actual === 'E', actual)
  const pegado = await page.evaluate(() => { const r = document.getElementById('glosarioLetras').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight })
  check('  …y se queda a la vista al bajar', pegado)
  await page.screenshot({ path: '/tmp/1144-glosario-pc.png' })
  await ctx.close()
}

console.log('── 3. Perfil, pestaña Foro ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/usuario.html?u=Misty&ver=foro`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.locator('[data-tab="foro"], button', { hasText: /^Foro/ }).first().click().catch(() => {})
  await page.waitForTimeout(1200)
  const d = await page.evaluate(() => ({
    chapas: [...document.querySelectorAll('.foro-act-cifra')].map((c) => c.textContent.trim()),
    mayus: [...document.querySelectorAll('.foro-act-numeros span')].some((s) => getComputedStyle(s).textTransform === 'uppercase'),
    caja: getComputedStyle(document.querySelector('.foro-act-lista') || document.body).borderTopWidth,
    vacio: document.querySelectorAll('#foroActividad .empty-state').length,
  }))
  check('las cifras en chapas, con su palabra en singular o plural', d.chapas.length >= 3 && d.chapas.includes('1 mensaje') && d.chapas.includes('1 tema abierto'), JSON.stringify(d.chapas))
  check('  …sin rótulos en mayúsculas', !d.mayus)
  check('las listas en su caja, como en el foro', d.caja === '1px', d.caja)
  check('lo vacío en una línea, sin el dibujo grande', d.vacio === 0, d.vacio)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: '/tmp/1144-perfil-foro.png' })
  await ctx.close()
}

console.log('── 4. Entrar y bienvenida ──')
{
  const ctx = await contexto(b, false, 'none')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/auth.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const d = await page.evaluate(() => {
    const a = document.querySelector('.auth-arte').getBoundingClientRect()
    const c = document.querySelector('.auth-box').getBoundingClientRect()
    return { visible: a.width > 0, juntas: Math.abs(a.right - c.left) <= 1, alto: Math.abs(a.height - c.height) <= 1, ventajas: document.querySelectorAll('.auth-arte-lista li').length, abanico: getComputedStyle(document.querySelector('.pd-abanico')).display }
  })
  check('PC: el panel de lo que tienes, pegado a la caja y de su misma altura', d.visible && d.juntas && d.alto && d.ventajas === 4, JSON.stringify(d))
  check('  …y sin el abanico (es del móvil)', d.abanico === 'none')
  await page.screenshot({ path: '/tmp/1144-auth-pc.png' })
  await ctx.close()
}
{
  const ctx = await contexto(b, true, 'none')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/auth.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const d = await page.evaluate(() => ({ arte: getComputedStyle(document.querySelector('.auth-arte')).display, abanico: document.querySelector('.pd-abanico').getBoundingClientRect().height, cartas: document.querySelectorAll('.pd-abanico span').length, ancho: document.documentElement.scrollWidth <= innerWidth + 1 }))
  check('móvil: el abanico de tres cartas encima del formulario', d.arte === 'none' && d.abanico > 60 && d.cartas === 3, JSON.stringify(d))
  check('  …sin salirse de lado', d.ancho)
  await page.screenshot({ path: '/tmp/1144-auth-movil.png' })
  await ctx.close()
}
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/onboarding.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const d = await page.evaluate(() => ({ mascota: document.querySelector('#onbStep1 .onb-mascota')?.getBoundingClientRect().height > 40, hay: [...document.querySelectorAll('#onbStep1 .onb-hay li')].map((l) => l.textContent) }))
  check('bienvenida: la mascota y lo que hay en PokeDoc', d.mascota && d.hay.length === 3, JSON.stringify(d))
  await page.screenshot({ path: '/tmp/1144-bienvenida.png' })
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
