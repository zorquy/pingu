import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Repaso de interfaz en móvil de TODO el sitio, no solo torneos: por
// cada página y cada ancho, ¿se sale algo del vertical del teléfono?
const BASE = 'http://localhost:8892'
const ANCHOS = [320, 360, 390, 430]
const PAGINAS = [
  ['portada', '/'],
  ['foro', '/foro'],
  ['aprender', '/aprender'],
  ['buscar', '/buscar'],
  ['usuarios', '/usuarios'],
  ['perfil', '/perfil'],
  ['usuario', '/usuario?u=Ash'],
  ['guardados', '/guardados'],
  ['mensajes', '/mensajes'],
  ['lanzamientos', '/lanzamientos'],
  ['sobre', '/sobre'],
  ['torneos', '/torneos'],
  ['auth', '/auth'],
  ['404', '/no-existe-esta-pagina'],
]

const b = await chromium.launch()
let malas = 0
for (const ancho of ANCHOS) {
  console.log(`\n════════ ${ancho}px ════════`)
  for (const [nombre, ruta] of PAGINAS) {
    const page = await b.newPage({ viewport: { width: ancho, height: 800 } })
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 70)))
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    const d = await page.evaluate(() => {
      const doc = document.documentElement
      const ancho = doc.clientWidth
      const culpables = []
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || getComputedStyle(el).position === 'fixed') continue
        if (r.right > ancho + 1) {
          if (culpables.some((c) => c.el.contains(el))) continue
          const cad = []
          let n = el
          while (n && n !== document.body) {
            cad.unshift(`${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.className ? '.' + String(n.className).trim().split(/\s+/).join('.') : ''}`)
            n = n.parentElement
          }
          culpables.push({ el, txt: `${cad.slice(-3).join('>')} →${Math.round(r.right)}` })
        }
      }
      return { sw: doc.scrollWidth, ancho, culpables: culpables.slice(0, 3).map((c) => c.txt) }
    })
    const mal = d.sw > d.ancho + 1
    if (mal) malas++
    console.log(`  ${mal ? 'DESBORDA' : 'ok      '} ${nombre.padEnd(14)} ${mal ? `${d.sw}>${d.ancho} · ${d.culpables.join(' | ')}` : ''}${errores.length ? ' · ERR ' + errores[0] : ''}`)
    await page.close()
  }
}
await b.close()
console.log(malas ? `\n✘ ${malas} páginas desbordan` : '\n✔ ninguna página desborda')
