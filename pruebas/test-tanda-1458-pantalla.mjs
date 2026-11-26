// Tanda 1458 — La ventana del código de dos pasos, en el centro (un usuario:
// «tanto en PC como en móvil, el campo para poner el código sale siempre
// como arriba en una esquina»). Se abre la ventana de verdad
// (js/doble-factor.js, `pedirCodigo`) y se mide dónde queda.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const browser = await chromium.launch()
for (const [nombre, opt] of [['PC', { viewport: { width: 1280, height: 800 } }], ['Móvil', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  const page = await browser.newPage(opt)
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.evaluate(async () => {
    const m = await import('/js/doble-factor.js')
    m.pedirCodigo({ auth: { mfa: { challengeAndVerify: async () => ({ error: null }) } } }, { factorId: 'f1' })
  })
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => {
    const d = document.querySelector('dialog.df-dialogo[open]')
    if (!d) return null
    const b = d.getBoundingClientRect()
    return { izq: Math.round(b.left), der: Math.round(innerWidth - b.right), arriba: Math.round(b.top), abajo: Math.round(innerHeight - b.bottom), ancho: Math.round(b.width) }
  })
  check(`${nombre}: la ventana se abre`, Boolean(r))
  check(`${nombre}: centrada de lado (no pegada a la izquierda)`, r && Math.abs(r.izq - r.der) <= 2 && r.izq >= 16, JSON.stringify(r))
  check(`${nombre}: centrada de alto (no arriba del todo)`, r && Math.abs(r.arriba - r.abajo) <= 2 && r.arriba > 40, JSON.stringify(r))
  check(`${nombre}: sin errores`, !errores.length, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
