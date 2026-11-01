// Tanda 1161 — en un monitor ancho (desde 1.800 px) las pantallas de cartas
// de Mi colección y /cartas pasan de 1.160 a 1.440 px (6 → 8 por fila); el
// Panel, el portátil y el móvil se quedan como estaban.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const mas = () => { const base = window.__FAKE_CARTAS__; const extra = []; for (let k = 1; k < 3; k++) base.forEach((c, i) => extra.push({ ...c, id: `sv08-${30 * k + i + 1}`, local_id: String(30 * k + i + 1) })); window.__FAKE_CARTAS__ = base.concat(extra) }
const b = await chromium.launch()
const medir = async (ruta, { w = 2200, movil = false } = {}) => {
  const ctx = await contexto(b, movil, 'user-1', mas)
  const p = await ctx.newPage()
  if (!movil) await p.setViewportSize({ width: w, height: 1100 })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  const r = await p.evaluate(() => {
    const main = document.querySelector('main.mc-pagina')
    const cartas = [...document.querySelectorAll('#mcAlbum [data-carta]')].filter((c) => c.offsetParent)
    const arriba = cartas.length ? Math.min(...cartas.map((c) => Math.round(c.getBoundingClientRect().top))) : null
    return { ancho: Math.round(main.getBoundingClientRect().width), porFila: cartas.filter((c) => Math.abs(Math.round(c.getBoundingClientRect().top) - arriba) < 4).length, sobra: document.documentElement.scrollWidth - innerWidth }
  })
  await ctx.close()
  return { ...r, errores }
}

console.log('── Una expansión ──')
const ancho = await medir('/mi-coleccion?ver=album&set=sv08')
check('a 2.200 px, la página mide 1.440', ancho.ancho === 1440, JSON.stringify(ancho))
check('  …y caben 8 cartas por fila', ancho.porFila === 8, ancho.porFila)
const portatil = await medir('/mi-coleccion?ver=album&set=sv08', { w: 1536 })
check('en un portátil (1.536 px) no cambia: 1.160 y 6 por fila', portatil.ancho === 1160 && portatil.porFila === 6, JSON.stringify(portatil))
const justo = await medir('/mi-coleccion?ver=album&set=sv08', { w: 1799 })
check('a 1.799 px todavía no', justo.ancho === 1160, justo.ancho)
const movil = await medir('/mi-coleccion?ver=album&set=sv08', { movil: true })
check('en el móvil, sin desbordar', movil.sobra <= 0 && movil.ancho <= 390, JSON.stringify(movil))

console.log('── Las demás ──')
const catalogo = await medir('/cartas?ver=album&set=sv08')
check('/cartas (catálogo) también, a 1.440', catalogo.ancho === 1440, JSON.stringify(catalogo))
const panel = await medir('/mi-coleccion?ver=resumen')
check('el Panel se queda en 1.160 (se lee)', panel.ancho === 1160, JSON.stringify(panel))
const estanteria = await medir('/mi-coleccion?ver=cartas')
check('la estantería de expansiones, a 1.440', estanteria.ancho === 1440, estanteria.ancho)
check('sin errores', [ancho, portatil, catalogo, panel].every((r) => !r.errores.length), [ancho, panel].map((r) => r.errores.join(' | ')).join(' · '))

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
