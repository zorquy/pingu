import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const lum = (c) => {
  const m = c.match(/[\d.]+/g); if (!m) return null
  const [r, g, bl, a = 1] = m.map(Number)
  if (a < 0.5) return null
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl)
}
for (const tema of ['dark', 'light']) {
  const flojos = new Map()
  for (const ruta of ['/index.html', '/aprender', '/foro', '/usuarios', '/torneos', '/perfil', '/mis-partidas', '/noticias']) {
    const p = await b.newPage({ viewport: { width: 1100, height: 900 } })
    await p.addInitScript((t) => { localStorage.setItem('pokedoc-theme', t); window.__FAKE_SESSION__ = 'user-1' }, tema)
    await p.goto(`http://localhost:8892${ruta}`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1800)
    const datos = await p.evaluate(() => {
      // El fondo de verdad: el primer antepasado que pinte algo. Y si lo
      // que pinta es un DEGRADADO, se coge su primera parada de color —
      // sin esto, el medidor pasaba de largo buscando un color sólido y
      // se iba hasta el blanco de la página, dando 1,06 de contraste en
      // el héroe del reto, que es texto blanco sobre azul oscuro.
      const fondoDe = (n) => {
        let e = n
        while (e) {
          const s = getComputedStyle(e)
          const img = s.backgroundImage
          if (img && img !== 'none') {
            const parada = img.match(/rgba?\([^)]*\)/)
            if (parada) return parada[0]
          }
          const c = s.backgroundColor
          if (c && !/rgba\(0, 0, 0, 0\)/.test(c)) return c
          e = e.parentElement
        }
        return 'rgb(255,255,255)'
      }
      return [...document.querySelectorAll('p, span, a, h1, h2, h3, li, button, td, small, strong')]
        .filter((n) => n.offsetParent !== null && n.textContent.trim().length > 2 && !n.querySelector('p,span,a,h1,h2,h3,li,button,td,small,strong'))
        .slice(0, 400)
        .map((n) => ({ col: getComputedStyle(n).color, fon: fondoDe(n), tam: parseFloat(getComputedStyle(n).fontSize), cl: n.tagName + '.' + (n.className || '').toString().slice(0, 22), txt: n.textContent.trim().slice(0, 22) }))
    })
    for (const d of datos) {
      const l1 = lum(d.col), l2 = lum(d.fon)
      if (l1 === null || l2 === null) continue
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const minimo = d.tam >= 18.66 ? 3 : 4.5
      if (ratio < minimo) flojos.set(d.cl + '|' + d.txt, `${ratio.toFixed(2)} (${d.tam}px) ${d.cl} «${d.txt}» en ${ruta}`)
    }
    await p.close()
  }
  console.log(`\n${tema.toUpperCase()}: ${flojos.size} textos por debajo del mínimo de contraste`)
  for (const v of [...flojos.values()].slice(0, 10)) console.log('  ', v)
}
await b.close()
