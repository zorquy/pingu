// Tanda 775 — sin transición entre páginas en Safari de Apple.
//
// PINGU, con una captura del iPhone: la burbuja de abajo «se rompe y flota»
// a media pantalla, en Productos y «en más apartados de la web». En Chromium
// no pasa. Lo que tienen en común es la transición entre páginas de la 753
// (`@view-transition` + la barra de abajo y la de arriba con nombre): tras
// una, Safari deja lo `position: fixed` pegado al DOCUMENTO y se mueve con
// la página. Se apaga solo ahí (`-webkit-touch-callout` es del iPhone y el
// iPad; `font: -apple-system-body`, de Safari en el Mac), y en los demás
// navegadores sigue.
//
// Lo que se mira: que la regla existe, que va DESPUÉS de las que la ponen
// (con @view-transition gana la última), que apaga los dos nombres, y que en
// Chromium la transición sigue puesta (la condición no casa).
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const css = readFileSync(`${RAIZ}/css/style.css`, 'utf8')

console.log('── 1. La regla ──')
const guarda = css.match(/@supports \(-webkit-touch-callout: none\) or \(font: -apple-system-body\) \{([\s\S]*?)\n\}/)
check('existe, con las dos condiciones de Safari', Boolean(guarda))
check('  …apaga la transición entre páginas', /@view-transition \{ navigation: none; \}/.test(guarda?.[1] || ''))
check('  …y los nombres de las dos barras', /\.bm, \.navbar \{ view-transition-name: none; \}/.test(guarda?.[1] || ''))
const ultimaAuto = css.lastIndexOf('navigation: auto')
check('  …y va DESPUÉS de las que la encienden (gana la última)', guarda && css.indexOf(guarda[0]) > ultimaAuto, `${css.indexOf(guarda?.[0] || '')} > ${ultimaAuto}`)

console.log('── 2. En Chromium sigue ──')
{
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  const n = await p.$eval('.bm', (e) => getComputedStyle(e).viewTransitionName)
  check('la barra de abajo conserva su nombre (la condición no casa en Chromium)', n === 'barra-abajo', n)
  const casa = await p.evaluate(() => CSS.supports('(-webkit-touch-callout: none) or (font: -apple-system-body)'))
  check('  …porque Chromium no cumple ninguna de las dos', casa === false, String(casa))
  await b.close()
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
