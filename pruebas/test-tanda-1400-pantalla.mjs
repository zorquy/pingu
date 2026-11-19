// Tanda 1400 — el «⋯» de un mensaje del foro se cierra (PINGU: «cuando estoy
// en el apartado de editar, esta pestaña no se cierra y entorpece»):
//   · al pulsar Editar el menú se va y el editor queda a la vista;
//   · tocar fuera lo cierra; Esc lo cierra y devuelve el foco al «⋯»;
//   · abrir el «⋯» de otro mensaje cierra el primero.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
for (const movil of [false, true]) {
  console.log(`── ${movil ? 'Móvil' : 'PC'} ──`)
  const ctx = await contexto(b, movil, 'user-1')
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/tema/tema-1`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('details.foro-mas', { timeout: 10000 }).catch(() => {})
  const abiertos = () => p.evaluate(() => document.querySelectorAll('details.foro-mas[open]').length)
  // El «⋯» de un mensaje mío (con Editar).
  const mio = p.locator('details.foro-mas:has([data-editar])').first()
  await mio.locator('summary').click()
  check('el «⋯» se abre', (await abiertos()) === 1)
  await mio.locator('[data-editar]').click()
  await p.waitForTimeout(400)
  const r = await p.evaluate(() => ({ abiertos: document.querySelectorAll('details.foro-mas[open]').length, editor: !!document.querySelector('.foro-mensaje [contenteditable="true"], .foro-mensaje textarea, .foro-editar, [data-editando]') }))
  check('al pulsar Editar el menú se cierra y sale el editor', r.abiertos === 0 && r.editor, JSON.stringify(r))
  await p.goto(`${BASE}/tema/tema-1`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('details.foro-mas', { timeout: 10000 }).catch(() => {})
  const todos = p.locator('details.foro-mas')
  await todos.first().locator('summary').click()
  await p.mouse.click(5, 300)
  check('tocar fuera lo cierra', (await abiertos()) === 0)
  await todos.first().locator('summary').click()
  await p.keyboard.press('Escape')
  const foco = await p.evaluate(() => document.activeElement?.closest('details.foro-mas') != null && document.activeElement.tagName === 'SUMMARY')
  check('Esc lo cierra y el foco vuelve al «⋯»', (await abiertos()) === 0 && foco)
  if ((await todos.count()) > 1) {
    await todos.nth(0).locator('summary').click()
    await todos.nth(1).locator('summary').click()
    const cual = await p.evaluate(() => [...document.querySelectorAll('details.foro-mas')].map((d) => d.open))
    check('abrir otro cierra el primero', cual.filter(Boolean).length === 1 && cual[1], JSON.stringify(cual))
  }
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo bien')
process.exit(fails ? 1 : 0)
