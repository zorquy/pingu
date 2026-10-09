// Tanda 799 — en el PC, la píldora del menú de Mi colección (784) se salía
// de la lateral y tapaba «Aprender»: el menú iba con `position: static` y la
// píldora se colocaba contra otra caja. Va debajo de la pestaña activa.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const b = await chromium.launch()
for (const ver of ['albumes', 'expansiones', 'panel']) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(`${BASE}/mi-coleccion.html?ver=${ver}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => {
    const menu = document.querySelector('.lat .mc-pestanias')
    const pil = menu?.querySelector('.pildora')
    const a = menu?.querySelector('.mc-pestania.activa')
    if (!menu || !pil || !a) return { falta: { menu: !!menu, pil: !!pil, a: !!a } }
    const rp = pil.getBoundingClientRect(), ra = a.getBoundingClientRect()
    // Y el menú no se mueve de su sitio: con `relative`, el `top: 88px` del
    // menú pegajoso lo bajaba encima de los álbumes de la lateral.
    const alb = document.getElementById('mcLatAlbumes')?.getBoundingClientRect()
    return { solapa: alb ? Math.round(menu.getBoundingClientRect().bottom - alb.top) : null, dx: Math.round(rp.left - ra.left), dy: Math.round(rp.top - ra.top), dw: Math.round(rp.width - ra.width), fondo: getComputedStyle(pil).backgroundColor, suyo: getComputedStyle(a).backgroundColor }
  })
  check(`${ver}: la píldora va debajo de la pestaña activa`, r.dx === 0 && r.dy === 0 && r.dw === 0, JSON.stringify(r))
  check(`${ver}: el menú no se monta sobre lo que va detrás`, r.solapa === null || r.solapa <= 0, JSON.stringify(r))
  check(`${ver}: y con el mismo fondo que ella`, r.fondo && r.fondo === r.suyo, JSON.stringify(r))
  await p.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
