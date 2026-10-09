// Tanda 786 — bloque 7 de «PokeDoc al detalle»: LO8 sin el puente de los
// torneos, LO1 el service worker sirve los ficheros al momento, MV8 el tema
// con ola, MV13 levantar al pasar el ratón, MV14 la Poké Ball de refrescar.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. Estático ──')
check('LO8: sin el reintento con los tres parámetros', !/tresDeAntes/.test(leer('js/torneos/torneo.js')))
const sw = leer('sw.js')
check('LO1: el service worker sirve /css, /js y /assets desde su caché', /\^\\\/\(css\|js\|assets\)\\\//.test(sw) && /e\.waitUntil\(revision/.test(sw))
check('  …y al primer cambio vacía la caché entera', /for \(const k of await cache\.keys\(\)\) await cache\.delete\(k\)/.test(sw))
check('  …con una versión que se sube a mano', /const ASSETS_VERSION = \d+/.test(sw))
check('MV8: el tema cambia con una ola', /startViewTransition\(cambiar\)/.test(leer('js/theme.js')) && /html\.ola-tema::view-transition-new\(root\)/.test(leer('css/style.css')))
check('MV14: la Poké Ball de refrescar', /bm-bola-aro/.test(leer('js/tirar-refrescar.js')) && /\.bm-bola-aro \{\s*stroke-dasharray: 1;/.test(leer('css/movil.css')))
check('MV13: los sets y las cartas se levantan con el ratón', /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.mc-set-tarjeta,/.test(leer('css/mi-coleccion.css')))

console.log('── 2. En el navegador ──')
const b = await chromium.launch()
{
  const ctx = await b.newContext()
  const p = await ctx.newPage()
  await p.goto(`${BASE}/aprender.html`, { waitUntil: 'load' })
  await p.evaluate(async () => { await navigator.serviceWorker.ready })
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(500)
  // Ya controlado: la segunda carga ha guardado los ficheros; la tercera los sirve de ahí.
  const respuestas = []
  p.on('response', (r) => { if (/\/css\/style\.css$/.test(r.url())) respuestas.push(r.fromServiceWorker()) })
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(500)
  const controlada = await p.evaluate(() => Boolean(navigator.serviceWorker.controller))
  check('LO1: la página está controlada por el service worker', controlada)
  check('  …y style.css llega desde él', respuestas.includes(true), JSON.stringify(respuestas))
  const enCache = await p.evaluate(async () => (await (await caches.open('pokedoc-ficheros-1')).keys()).map((r) => new URL(r.url).pathname))
  check('  …guardado en su caché, sin las páginas', enCache.includes('/css/style.css') && !enCache.some((x) => /\.html$/.test(x)), enCache.slice(0, 6).join(' '))
  await ctx.close()
}
{
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/aprender.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  const r = await p.evaluate(async () => {
    const { montarTirarRefrescar } = await import('/js/tirar-refrescar.js')
    const m = montarTirarRefrescar({ recargar: () => {} })
    return { bola: !!m.querySelector('svg .bm-bola-aro'), sinFlecha: !m.textContent.includes('↻') }
  })
  check('MV14: la marca de refrescar es una Poké Ball', r.bola && r.sinFlecha, JSON.stringify(r))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
