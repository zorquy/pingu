// Tanda 1214 — lo común de la portada que faltaba (las cifras que cuentan, el
// brillo al pasar, lo vivo late y las cabeceras con icono de color).
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { partesDeCifra } from '/home/user/pingu/js/cifras-cuentan.js'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── 1. Lo puro ──')
check('«1.234» es 1234 con miles', JSON.stringify(partesDeCifra('1.234')) === JSON.stringify({ n: 1234, miles: true, resto: '' }))
check('«12+» lleva su «+»', partesDeCifra('12+')?.resto === '+' && partesDeCifra('12+')?.n === 12)
check('«—» y «12,5 €» no cuentan', partesDeCifra('—') === null && partesDeCifra('12,5 €') === null)

const b = await chromium.launch()
console.log('── 2. Gente: las cifras cuentan y acaban en su valor ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1280, height: 900 })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/usuarios`, { waitUntil: 'domcontentloaded' })
  // Se apunta lo que va saliendo en la cifra de miembros.
  await p.evaluate(() => {
    window.__vistos = []
    const b = document.getElementById('cifraMiembros')
    new MutationObserver(() => window.__vistos.push(b.textContent)).observe(b, { childList: true, characterData: true, subtree: true })
  })
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ final: document.getElementById('cifraMiembros').textContent, vistos: window.__vistos }))
  // Desde la 1220 una cifra sin otra de la que contar «se calcula»: sus
  // dígitos dan vueltas y se fijan en la buena.
  check('la cifra de miembros pasa por valores intermedios', r.vistos.length > 3 && r.vistos.some((v) => /^\d+$/.test(v) && v !== r.final) && r.final === '12', JSON.stringify(r).slice(0, 200))
  check('  …y acaba en su valor (12 en el doble)', r.final === '12' && r.final === r.vistos.at(-1), JSON.stringify(r).slice(0, 200))
  // En el doble nadie latió hace poco: se prueba con un avatar puesto a mano.
  const late = await p.evaluate(() => { const a = document.createElement('span'); a.className = 'avatar-conectado'; document.body.append(a); const n = getComputedStyle(a, '::after').animationName; a.remove(); return n })
  check('el punto de «en línea» late', late === 'seccion-late', late)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
console.log('── 3. Con «menos movimiento», la cifra sale ya puesta ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const p = await ctx.newPage()
  await p.emulateMedia({ reducedMotion: 'reduce' })
  await p.goto(`${BASE}/usuarios`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(() => {
    window.__vistos = []
    const b = document.getElementById('cifraMiembros')
    new MutationObserver(() => window.__vistos.push(b.textContent)).observe(b, { childList: true, characterData: true, subtree: true })
  })
  await p.waitForTimeout(2000)
  const vistos = await p.evaluate(() => window.__vistos)
  check('sin cuenta: un solo cambio, al valor', vistos.length <= 1, JSON.stringify(vistos))
  await ctx.close()
}
console.log('── 4. Las cabeceras de bloque con su icono ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const p = await ctx.newPage()
  await p.goto(`${BASE}/lanzamientos`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  // Desde la 1218 el icono va en el título de la página y «Lo que viene» y
  // «Ya en tiendas» son rótulos pequeños (la maqueta del cartel).
  const n = await p.$$eval('h1 .cab-bloque-ico svg, .section-title .cab-bloque-ico svg', (xs) => xs.length)
  check('Lanzamientos: el título con su icono', n >= 1, String(n))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
