// Tanda 890 — el vigilante de sprites (888) solo cuenta lo que está A LA VISTA.
//
// PINGU: «en VSTAR Universe, a partir del Voltorb de Hisui la miniatura no
// carga, pero cuando la clicas sí». Las cartas de la rejilla van con
// `loading="lazy"`: las de abajo no han empezado a cargar, nunca
// «terminan», y el vigilante de la 888 les quemaba un respaldo cada cuatro
// segundos hasta el último (404 → `onerror` → se quita). Desde la 890 el
// reloj solo corre mientras la imagen está en pantalla.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } })
const p = await ctx.newPage()
const pedidas = []
// La primera fuente (una CDN cualquiera) se queda colgada; la segunda contesta.
await p.route(/cdn-colgada\.test/, (r) => { pedidas.push(r.request().url()) })
await p.route(/cdn-buena\.test/, (r) => { pedidas.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) })
await p.goto(`${BASE}/meta.html`, { waitUntil: 'domcontentloaded' })
await p.evaluate(async () => {
  await import('/js/torneos/sprites-pokemon.js')
  // Una rejilla como la de una expansión: cartas diferidas, la última diez pantallas más abajo.
  document.body.insertAdjacentHTML('afterbegin', `<div id="rejilla" style="position:relative;z-index:9;background:#fff">
    <img id="arriba" src="https://cdn-colgada.test/arriba.png" data-respaldos="https://cdn-buena.test/arriba.png" width="40" height="40" alt="" loading="lazy" onerror="">
    <div style="height:7000px"></div>
    <img id="abajo" src="https://cdn-colgada.test/abajo.png" data-respaldos="https://cdn-buena.test/abajo.png" width="40" height="40" alt="" loading="lazy" onerror="">
  </div>`)
  window.scrollTo(0, 0)
})
await p.waitForTimeout(6500)
const src = (id) => p.evaluate((i) => document.getElementById(i).src, id)
check('la de ARRIBA (a la vista, colgada) salta al respaldo', /cdn-buena\.test\/arriba/.test(await src('arriba')), await src('arriba'))
check('la de ABAJO (fuera de la pantalla, sin empezar) NO se toca', /cdn-colgada\.test\/abajo/.test(await src('abajo')), await src('abajo'))
check('…y no se ha pedido su respaldo', !pedidas.some((u) => /abajo/.test(u) && /buena/.test(u)), pedidas.join(' | '))
await p.evaluate(() => document.getElementById('abajo').scrollIntoView())
await p.waitForTimeout(6500)
check('al bajar hasta ella, la colgada salta al respaldo y carga', /cdn-buena\.test\/abajo/.test(await src('abajo')) && await p.evaluate(() => { const i = document.getElementById('abajo'); return i.complete && i.naturalWidth > 0 }), await src('abajo'))
await b.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
