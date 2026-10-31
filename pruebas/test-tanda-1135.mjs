// Tanda 1135 — el menú de abajo no se rompe aunque iOS se quede con el hueco
// del teclado (PINGU, con captura: la burbuja a media pantalla y la barra
// desaparecida). iOS a veces deja `env(safe-area-inset-bottom)` con el alto
// del teclado; la barra crecía hasta media pantalla y la burbuja, al
// esconderse la barra, se quedaba flotando ahí.
//
//   1. Ninguna hoja pide `env(safe-area-inset-bottom)` a pelo: todas pasan
//      por `--seguro-abajo`, que lleva tope (48 px), definido una vez.
//   2. En el navegador: con el hueco a 0 (lo normal) la barra mide lo de
//      siempre, y con un hueco «de teclado» (340 px, simulado sobre el
//      token) la barra no pasa de 72 + 48 ni la burbuja se despega de ella.
import { readFileSync, readdirSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. Las hojas ──')
const hojas = readdirSync(`${RAIZ}/css`).filter((f) => f.endsWith('.css'))
const crudas = []
let definiciones = 0
for (const f of hojas) {
  const s = readFileSync(`${RAIZ}/css/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of s.matchAll(/--seguro-abajo\s*:\s*([^;]+);/g)) {
    definiciones++
    check(`--seguro-abajo lleva tope (${f})`, /^min\(\s*env\(safe-area-inset-bottom[^)]*\)\s*,\s*(\d+)px\s*\)$/.test(m[1].trim()) && Number(m[1].match(/(\d+)px\s*\)$/)?.[1]) <= 48, m[1])
  }
  const sinToken = s.replace(/--seguro-abajo\s*:[^;]+;/g, '')
  if (/env\(\s*safe-area-inset-bottom/.test(sinToken)) crudas.push(f)
}
check('el token se define una vez', definiciones === 1, definiciones)
check('ninguna hoja pide el hueco de abajo a pelo', !crudas.length, crudas.join(', '))
const html = readdirSync(RAIZ).filter((f) => f.endsWith('.html')).filter((f) => /env\(\s*safe-area-inset-bottom/.test(readFileSync(`${RAIZ}/${f}`, 'utf8')))
check('ni una página en su HTML', !html.length, html.join(', '))

console.log('\n── 2. En el navegador ──')
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
await page.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
await page.goto(`${BASE}/noticias`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)
const medir = () => page.evaluate(() => {
  const bm = document.querySelector('.bm')?.getBoundingClientRect()
  const bu = document.querySelector('.bm-burbuja')?.getBoundingClientRect()
  return { alto: bm ? Math.round(bm.height) : 0, hueco: bm && bu ? Math.round(bm.top - bu.bottom) : null, burbuja: !!bu }
})
const normal = await medir()
check('la barra mide lo de siempre', normal.alto >= 60 && normal.alto <= 90, JSON.stringify(normal))
// Lo que hace iOS, sobre el token: el env() de dentro vale 340.
await page.addStyleTag({ content: ':root:root { --seguro-abajo: min(340px, 48px); }' })
await page.waitForTimeout(300)
const teclado = await medir()
check('con el hueco «de teclado», la barra no pasa de 72 + 48', teclado.alto <= 72 + 48 + 8, JSON.stringify(teclado))
if (normal.burbuja) check('  …y la burbuja sigue pegada a ella', teclado.hueco !== null && Math.abs(teclado.hueco - normal.hueco) <= 1, JSON.stringify({ normal, teclado }))
check('sin errores', !errores.length, errores.join(' | '))
await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
