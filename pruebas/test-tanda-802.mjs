// Tanda 802 — PINGU: «el reto diario redirige a la página de aprender».
// /reto es una reescritura a curso.html?reto=hoy; la barra se queda en /reto
// sin la consulta, y desde la 780 un curso sin `slug` manda a /aprender.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`) }
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const b = await chromium.launch()
for (const ruta of ['/reto', '/curso.html?reto=hoy']) {
  const p = await b.newPage()
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  check(`${ruta} se queda en el reto (no va a /aprender)`, !/aprender/.test(p.url()), p.url())
  await p.close()
}
{
  const p = await b.newPage()
  await p.goto(`${BASE}/curso.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  check('un curso sin nada sigue yendo a /aprender', /aprender/.test(p.url()), p.url())
  await p.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
