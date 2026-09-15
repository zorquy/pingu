import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const PAGINAS = ['/index.html', '/aprender', '/foro', '/usuarios', '/torneos', '/perfil', '/mis-partidas', '/noticias', '/lanzamientos', '/comunidad']
for (const ruta of PAGINAS) {
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } })
  await p.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  await p.goto(`http://localhost:8892${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  const r = await p.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    main: document.querySelectorAll('main, [role="main"]').length,
    nav: document.querySelectorAll('nav').length,
    saltoContenido: !!document.querySelector('a[href="#main"], a[href^="#"].skip, .skip-link'),
    imgSinAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
    imgSinTam: [...document.querySelectorAll('img')].filter((i) => !i.getAttribute('width') && !i.style.aspectRatio).length,
    botonesSinNombre: [...document.querySelectorAll('button')].filter((n) => n.offsetParent && !n.textContent.trim() && !n.getAttribute('aria-label') && !n.getAttribute('title')).length,
    camposSinEtiqueta: [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((n) => n.offsetParent && !n.labels?.length && !n.getAttribute('aria-label') && !n.getAttribute('placeholder')).length,
  }))
  console.log(ruta.padEnd(16), JSON.stringify(r))
  await p.close()
}
await b.close()
