// Tanda 1299 — el perfil, lo recomendado de la propuesta «Vitrina y perfil»:
// V1, la vitrina de cristal (caja, luz, balda a lo ancho de cada fila, cartas
// centradas y placa con el nombre), en el Resumen y en Colección; B1, el «Ver»
// de cada bloque del Resumen es un botón en pastilla que dice adónde va; P1, las
// pestañas en una cápsula con iconos de color, que caben las siete en el PC.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const b = await chromium.launch()
async function abrir(ruta, movil) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.route(/assets\.tcgdex\.net|limitlesstcg|pokemontcg\.io/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  if (!movil) await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}
const vitrina = (page, sel) => page.evaluate((sel) => {
  const caja = document.querySelector(sel)
  if (!caja) return null
  const r = caja.getBoundingClientRect()
  const celdas = [...caja.querySelectorAll('.vitrina-rejilla > *')].map((c) => c.getBoundingClientRect())
  const primera = caja.querySelector('.vitrina-rejilla > *')
  const balda = primera ? getComputedStyle(primera, '::after') : null
  return {
    n: celdas.length,
    izq: Math.round(celdas[0]?.left - r.left), der: Math.round(r.right - celdas[Math.min(celdas.length, 6) - 1]?.right),
    filas: new Set(celdas.map((c) => Math.round(c.top))).size,
    balda: balda && balda.content !== 'none' && parseFloat(balda.width) >= r.width - 2,
    placa: caja.querySelector('.vitrina-placa')?.textContent,
    luz: getComputedStyle(caja, '::after').content !== 'none',
    brillo: /linear-gradient/.test(getComputedStyle(caja, '::before').backgroundImage),
  }
}, sel)

for (const movil of [false, true]) {
  console.log(`── Tu perfil, ${movil ? 'móvil' : 'PC'} ──`)
  const { ctx, page, errores } = await abrir('/perfil.html', movil)
  const v = await vitrina(page, '.pr-vitrina .vitrina-cristal')
  check('Resumen: la vitrina de cristal, con luz, brillo y la placa «Vitrina de Ash»', v && v.luz && v.brillo && /Vitrina de Ash/i.test(v.placa || ''), JSON.stringify(v))
  check('  …la balda a lo ancho de la vitrina', v?.balda, JSON.stringify(v))
  check('  …y las cartas centradas', v && Math.abs(v.izq - v.der) <= 3, JSON.stringify(v))
  const ver = await page.$$eval('.pr-ver', (bs) => bs.map((x) => ({ t: x.textContent.trim(), fondo: getComputedStyle(x).backgroundColor, radio: parseFloat(getComputedStyle(x).borderRadius), alto: x.getBoundingClientRect().height })))
  check('B1: los «Ver» son botones en pastilla con fondo', ver.length >= 3 && ver.every((x) => x.fondo !== 'rgba(0, 0, 0, 0)' && x.radio >= 16 && x.alto >= 36), JSON.stringify(ver))
  check('  …y dicen adónde llevan', ver.some((x) => x.t === 'Ver colección') && ver.some((x) => x.t === 'Todos los torneos') && ver.some((x) => /^Ver los \d+$/.test(x.t)), ver.map((x) => x.t).join(' | '))
  const p = await page.evaluate(() => {
    const t = document.getElementById('profileTabs')
    const bs = [...t.querySelectorAll('.tab-btn:not([hidden])')]
    const act = t.querySelector('.tab-btn.active')
    return { iconos: bs.every((x) => x.querySelector('.pest-ic svg')), cabe: t.scrollWidth <= t.clientWidth + 1, radio: parseFloat(getComputedStyle(t).borderRadius), fondoAct: getComputedStyle(act).backgroundColor, px: parseFloat(getComputedStyle(act).fontSize), n: bs.length }
  })
  check('P1: las pestañas en cápsula, cada una con su icono', p.iconos && p.radio >= 16 && p.fondoAct !== 'rgba(0, 0, 0, 0)' && p.px <= 15, JSON.stringify(p))
  if (!movil) check('  …y en el PC caben las siete sin deslizar', p.cabe && p.n === 7, JSON.stringify(p))
  await page.click('[data-ptab="vitrina"]')
  await page.waitForTimeout(800)
  const c = await vitrina(page, '#perfilVitrina .vitrina-cristal')
  check('Colección: la misma vitrina, con tus seis sitios', c && c.n === 6 && c.balda && /Vitrina de Ash/i.test(c.placa || ''), JSON.stringify(c))
  if (movil) check('  …en el móvil, dos baldas de tres', c?.filas === 2, JSON.stringify(c))
  else check('  …en el PC, una balda de seis', c?.filas === 1, JSON.stringify(c))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: `/tmp/1299-${movil ? 'movil' : 'pc'}.png` })
  await ctx.close()
}
console.log('── El perfil de otra persona ──')
{
  const { ctx, page, errores } = await abrir('/usuario/Misty', false)
  const v = await vitrina(page, '.pr-vitrina .vitrina-cristal')
  check('su vitrina (si tiene), de cristal y con su nombre en la placa', !v || /Vitrina de Misty/i.test(v.placa || ''), JSON.stringify(v))
  check('pestañas con iconos', await page.evaluate(() => [...document.querySelectorAll('#profileTabs .tab-btn:not([hidden])')].every((x) => x.querySelector('.pest-ic'))))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
