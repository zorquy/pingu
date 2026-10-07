// Tanda 734 — la letra crece con la del sistema (X6 de la lista de
// propuestas, elegida por PINGU), para quien la tiene grande en el iPhone.
//
// Lo que se mira: que la escala esté en rem y que a tamaño normal mida lo
// MISMO que antes (11 a 34 px); que si la letra base del navegador crece
// —el ajuste de Chrome en Android, o el zoom de texto— el texto crezca con
// ella; y que el bloque de iOS esté (`-apple-system-body` es lo único a lo
// que Safari le aplica el tamaño del sistema) con su escala en
// diecisieteavos, para que a tamaño normal tampoco cambie nada allí.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const css = readFileSync(`${RAIZ}/css/style.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

console.log('── 1. La escala, en rem ──')
const raiz = css.slice(css.indexOf(':root {'))
const pasos = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']
check('los ocho pasos en rem', pasos.every((p) => new RegExp(`--t-${p}:\\s*[0-9.]+rem`).test(raiz)))
const ios = css.match(/@supports \(font: -apple-system-body\)[^{]*\{([\s\S]*?)\n\}/)
check('el bloque de iOS: la base del sistema y la escala en diecisieteavos', ios && /font: -apple-system-body/.test(ios[1]) && pasos.every((p) => new RegExp(`--t-${p}: calc\\(\\d+rem / 17\\)`).test(ios[1])), ios?.[1]?.slice(0, 120))

const browser = await chromium.launch()
const medir = async (base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  if (base) await page.addInitScript((b) => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${b}px` }) }, base)
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const t = await page.evaluate(() => {
    const p = document.createElement('p')
    document.body.appendChild(p)
    const out = {}
    for (const k of ['2xs', 'md', 'lg', '3xl']) { p.style.fontSize = `var(--t-${k})`; out[k] = parseFloat(getComputedStyle(p).fontSize) }
    return out
  })
  await page.close()
  return t
}
console.log('── 2. En el navegador ──')
const normal = await medir(null)
check('a tamaño normal, lo mismo que antes: 11, 14, 16 y 34 px', normal['2xs'] === 11 && normal.md === 14 && normal.lg === 16 && normal['3xl'] === 34, JSON.stringify(normal))
const grande = await medir(20)
check('con la letra base a 20 px, el texto normal pasa de 14 a 17,5', grande.md === 17.5 && grande['3xl'] === 42.5, JSON.stringify(grande))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
