// Tanda 776 — el visor que iOS no devuelve al cerrar el teclado (y la 1127:
// tres señales de que hubo teclado, no solo soltar un campo).
//
// PINGU, en la app instalada del iPhone y ya con la 775 puesta: la burbuja
// de abajo y la flecha de «volver arriba» a media pantalla, en Torneos y en
// Gente, las dos unos 340 px por encima de su sitio (lo que mide el
// teclado). Es el fallo de iOS en modo instalado: al irse el teclado, el
// visor se queda movido respecto a la página (offsetTop sin volver a 0) o la
// página se queda más corta. Se mide y lo fijo se mueve lo que falta.
//
// Lo que se mira: la función pura (los dos casos, y lo que NO debe mover:
// teclado fuera, zoom, Safari sin instalar), las reglas, y en el navegador
// —con un visor de mentira que dice lo que dice el iPhone— que la burbuja y
// la flecha vuelven abajo, y que sin iOS no se toca nada.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const { desfaseDelVisor } = await import(`${RAIZ}/js/barra-movil.js`)

console.log('── 1. La cuenta ──')
const v = (offsetTop, height, scale = 1) => ({ offsetTop, height, scale })
let r = desfaseDelVisor({ alto: 844, visor: v(0, 844), maximo: 844, instalada: true })
check('todo en su sitio: no mueve nada', r.arriba === 0 && r.abajo === 0, JSON.stringify(r))
r = desfaseDelVisor({ alto: 844, visor: v(340, 844), maximo: 844, instalada: true })
check('visor movido 340 (offsetTop sin volver a 0): arriba y abajo 340', r.arriba === 340 && r.abajo === 340, JSON.stringify(r))
r = desfaseDelVisor({ alto: 504, visor: v(0, 504), maximo: 844, instalada: true })
check('página encogida 340 en la app instalada: abajo 340, arriba 0', r.arriba === 0 && r.abajo === 340, JSON.stringify(r))
r = desfaseDelVisor({ alto: 504, visor: v(0, 504), maximo: 844, instalada: false })
check('  …en Safari sin instalar, no (sus barras cambian el alto de verdad)', r.abajo === 0, JSON.stringify(r))
r = desfaseDelVisor({ alto: 844, visor: v(340, 504), maximo: 844, instalada: true, escribiendo: true })
check('con el teclado fuera no se mueve nada', r.arriba === 0 && r.abajo === 0, JSON.stringify(r))
r = desfaseDelVisor({ alto: 844, visor: v(200, 400, 2), maximo: 844, instalada: true })
check('con zoom tampoco', r.arriba === 0 && r.abajo === 0, JSON.stringify(r))
r = desfaseDelVisor({ alto: 844, visor: null, maximo: 844, instalada: true })
check('sin visualViewport, nada', r.arriba === 0 && r.abajo === 0, JSON.stringify(r))

console.log('── 2. Las reglas ──')
const css = readFileSync(`${RAIZ}/css/movil.css`, 'utf8')
// Solo su bloque: lo que venga detrás (la 780) es de otra tanda.
const bloque = css.slice(css.indexOf('/* 776:'), css.indexOf('/* 780') > 0 ? css.indexOf('/* 780') : undefined)
for (const sel of ['.bm,', '.bm-burbuja,', '.mc-pestanias,', '.volver-arriba,', '.carta-acciones,']) {
  check(`${sel.replace(',', '')} se baja con --ios-abajo`, bloque.includes(`html.ios-desfase ${sel}`) || bloque.includes(sel), sel)
}
check('con `translate` y no `transform` (no pisa el de las barras que se apartan)', /translate: 0 var\(--ios-abajo\);/.test(bloque) && !/transform:/.test(bloque))
check('la barra de arriba va con --ios-arriba', /\.navbar,[\s\S]*?translate: 0 var\(--ios-arriba\);/.test(bloque))

console.log('── 3. En el navegador, con un visor como el del iPhone ──')
const b = await chromium.launch()
const fingir = ({ offsetTop, height, ios }) => {
  if (ios) {
    const sup = CSS.supports.bind(CSS)
    CSS.supports = (a, c) => (a === '-webkit-touch-callout' ? true : c === undefined ? sup(a) : sup(a, c))
    Object.defineProperty(navigator, 'standalone', { value: true })
  }
  const t = new EventTarget()
  window.__OT = offsetTop
  Object.defineProperty(t, 'offsetTop', { get: () => window.__OT })
  Object.defineProperty(t, 'height', { get: () => window.__H ?? (height === 'alto' ? innerHeight : height) })
  Object.defineProperty(t, 'scale', { get: () => 1 })
  Object.defineProperty(window, 'visualViewport', { value: t })
}
// Desde la 1089c el desfase solo cuenta después del teclado: `teclado` suelta
// un campo (como al cerrarlo) y `vuelve` pone el visor en su sitio después.
async function mirar({ ios, offsetTop, teclado = true, vuelve = false, como = 'soltar' }) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' })
  await ctx.addInitScript(fingir, { offsetTop, height: 'alto', ios })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/torneos.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.bm-burbuja', { timeout: 8000 })
  await p.waitForTimeout(600)
  if (teclado) {
    // `soltar`: entra y sale de un campo. `borrar` (1127): el campo se borra
    // con el foco dentro, como el chat de una partida al repintarse, y en
    // Safari no hay `focusout`. `encoger` (1127): solo el visor encogiendo lo
    // que un teclado y volviendo, sin ningún evento de foco.
    await p.evaluate((como) => {
      if (como === 'encoger') {
        window.__H = innerHeight - 300; window.visualViewport.dispatchEvent(new Event('resize'))
        return new Promise((ok) => setTimeout(() => { window.__H = undefined; window.visualViewport.dispatchEvent(new Event('resize')); ok() }, 100))
      }
      const i = document.createElement('input'); document.body.appendChild(i); i.focus()
      if (como === 'soltar') i.blur()
      else { const quieto = (e) => e.stopImmediatePropagation(); document.addEventListener('focusout', quieto, true); i.remove(); setTimeout(() => document.removeEventListener('focusout', quieto, true), 0) }
      if (como === 'soltar') i.remove()
    }, como)
    await p.waitForTimeout(1000)
    await p.evaluate(() => window.visualViewport.dispatchEvent(new Event('scroll')))
    await p.waitForTimeout(200)
  }
  if (vuelve) {
    await p.evaluate(() => { window.__OT = 0; window.visualViewport.dispatchEvent(new Event('scroll')) })
    await p.waitForTimeout(300)
  }
  const out = await p.evaluate(() => ({
    clase: document.documentElement.classList.contains('ios-desfase'),
    abajo: getComputedStyle(document.documentElement).getPropertyValue('--ios-abajo'),
    translate: getComputedStyle(document.querySelector('.bm-burbuja')).translate,
    bm: getComputedStyle(document.querySelector('.bm')).translate,
  }))
  await ctx.close()
  return out
}
r = await mirar({ ios: true, offsetTop: 340 })
check('iOS con el visor movido 340: se marca el desfase', r.clase && r.abajo.trim() === '340px', JSON.stringify(r))
check('  …y la burbuja baja 340', /340px/.test(r.translate), r.translate)
check('  …y la barra de abajo también', /340px/.test(r.bm), r.bm)
r = await mirar({ ios: true, offsetTop: 340, como: 'borrar' })
check('el campo se borra con el foco dentro (sin focusout): también baja (1127)', r.clase && /340px/.test(r.bm), JSON.stringify(r))
r = await mirar({ ios: true, offsetTop: 340, como: 'encoger' })
check('el visor encoge lo que un teclado, sin eventos de foco: también baja (1127)', r.clase && /340px/.test(r.bm), JSON.stringify(r))
r = await mirar({ ios: true, offsetTop: 340, vuelve: true })
check('  …y cuando el visor vuelve a su sitio, se quita (1089c)', !r.clase && !/340/.test(r.bm), JSON.stringify(r))
r = await mirar({ ios: true, offsetTop: 340, teclado: false })
check('sin teclado, un visor movido al hacer scroll no mueve nada: la barra de arriba no baja a media pantalla (1089c)', !r.clase && !/340/.test(r.bm), JSON.stringify(r))
r = await mirar({ ios: true, offsetTop: 0 })
check('iOS con el visor bien: no se toca nada', !r.clase && !/340/.test(r.translate), JSON.stringify(r))
r = await mirar({ ios: false, offsetTop: 340 })
check('sin iOS no se toca aunque el visor diga lo mismo', !r.clase, JSON.stringify(r))
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
