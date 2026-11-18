// Tanda 1396 — a la mascota no se le corta la gorra (PINGU: «se le corta el
// gorro a la mascota, por arriba, siempre»). La cámara de js/mascota.js
// pegaba la gorra al borde de arriba del lienzo incluso en reposo, y al
// saltar o saludar se salía. Ahora:
//   · en reposo y en los gestos sin efectos (saludar, triste, guiño, risa,
//     enfado, mareado, toque, lanzar) queda AIRE sobre la gorra (≥ 6 % del
//     lienzo en el peor fotograma);
//   · en «sorpresa», que lanza la gorra al aire, la gorra no llega a salirse
//     (el confeti, las zetas y los corazones sí pueden irse por arriba: vuelan);
//   · ningún antepasado del lienzo lo recorta por arriba (overflow) en Inicio,
//     la 404 ni Entrar, en PC y en el móvil.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })

// 1) Aire sobre la gorra, gesto a gesto (el peor de 40 fotogramas).
{
  const ctx = await contexto(b, false, 'user-1')
  const p = await ctx.newPage()
  await p.goto(BASE + '/404.html', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  const GESTOS = ['reposo', 'saludar', 'triste', 'guino', 'risa', 'enfado', 'mareado', 'toque', 'lanzar', 'sorpresa']
  await p.evaluate((G) => {
    const c = document.createElement('div')
    c.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;position:relative;z-index:9999'
    for (const g of G) { const s = document.createElement('span'); s.className = 'mascota-3d prueba-1396'; s.dataset.mascota = g; s.dataset.sinGlobo = ''; s.style.cssText = 'width:120px;height:120px;display:block'; c.appendChild(s) }
    document.body.prepend(c)
  }, GESTOS)
  const peor = {}
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(150)
    const r = await p.evaluate(() => [...document.querySelectorAll('.prueba-1396')].map((h) => {
      const c = h.querySelector('.mascota-lienzo')
      if (!c || !c.width) return [h.dataset.mascota, null]
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      // En «sorpresa» sale además un «!» rojo encima: ahí se mira solo la gorra
      // (azul: mucho más azul que rojo y que verde).
      const gorra = h.dataset.mascota === 'sorpresa'
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4
        if (d[i + 3] > 20 && (!gorra || (d[i + 2] > d[i] + 50 && d[i + 2] > d[i + 1] + 30))) return [h.dataset.mascota, y / c.height]
      }
      return [h.dataset.mascota, null]
    }))
    for (const [g, v] of r) if (v != null) peor[g] = Math.min(peor[g] ?? 1, v)
  }
  for (const g of GESTOS) {
    const v = peor[g]
    if (g === 'sorpresa') check(`«${g}»: la gorra lanzada no se sale del lienzo`, v != null && v > 0, v != null ? (v * 100).toFixed(1) + ' %' : 'sin pintar')
    else check(`«${g}»: aire sobre la gorra (≥ 6 %)`, v != null && v >= 0.06, v != null ? (v * 100).toFixed(1) + ' %' : 'sin pintar')
  }
  await ctx.close()
}

// 2) Ningún contenedor la recorta por arriba.
for (const movil of [false, true]) {
  for (const url of ['/', '/404.html', '/auth.html']) {
    const ctx = await contexto(b, movil, url === '/auth.html' ? null : 'user-1')
    const p = await ctx.newPage()
    await p.goto(BASE + url, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.mascota-lista', { timeout: 15000 }).catch(() => {})
    const cortes = await p.evaluate(() => [...document.querySelectorAll('.mascota-lista .mascota-lienzo')].filter((c) => c.getClientRects().length).map((c) => {
      const rc = c.getBoundingClientRect()
      let peor = 0
      for (let a = c.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a)
        if (s.overflowY === 'visible' && s.overflowX === 'visible' && s.clipPath === 'none') continue
        peor = Math.max(peor, a.getBoundingClientRect().top - rc.top)
      }
      return Math.round(peor)
    }))
    if (cortes.length) check(`${movil ? 'móvil' : 'PC'} ${url}: nada recorta el lienzo por arriba`, cortes.every((x) => x <= 0), cortes.join(', '))
    await ctx.close()
  }
}

await b.close()
console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo bien')
process.exit(fails ? 1 : 0)
