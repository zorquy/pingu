// Genera las siete tarjetas sociales de los retos (872), 1200×630, en
// assets/social/. Se dibujan desde HTML con las fuentes de la casa.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { RETOS } from '/home/user/pingu/js/retos-xp.js'

const RAIZ = '/home/user/pingu'
mkdirSync(`${RAIZ}/assets/social`, { recursive: true })

const TARJETAS = [
  { fichero: 'reto-retos', arriba: 'PokeDoc · retos diarios', titulo: 'Seis retos al día', texto: 'Los mismos para todo el mundo. Juega, comparte tu día y vuelve mañana.', enlace: 'pokedoc.es/retos', tira: [1, 1, 0, 1, 1, 1] },
  ...RETOS.map((r) => ({
    fichero: `reto-${r.juego}`,
    arriba: 'PokeDoc · reto diario',
    titulo: r.titulo,
    texto: r.texto,
    enlace: `pokedoc.es${r.ruta}`,
    tira: { reto: [1, 0, 1, 1, 1], carta: [0, 0, 1, 1], caro: [1, 1, 0, 1, 1], silueta: [0, 1], ordena: [1, 0, 1, 1], expansion: [1, 1, 1, 0, 1] }[r.juego],
  })),
]

const html = (t) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
@font-face { font-family: Fredoka; src: url(http://localhost:8892/assets/fonts/fredoka-variable-latin.woff2) format('woff2'); font-weight: 300 700; }
@font-face { font-family: Inter; src: url(http://localhost:8892/assets/fonts/inter-variable-latin.woff2) format('woff2'); font-weight: 100 900; }
html, body { margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: linear-gradient(180deg, #1e5175 0%, #0d1b2a 100%); color: #fff; font-family: Inter, sans-serif; display: grid; grid-template-rows: auto 1fr auto; padding: 64px 80px; box-sizing: border-box; }
.arriba { font: 700 30px Fredoka, sans-serif; letter-spacing: .01em; }
.medio { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 48px; }
h1 { margin: 0 0 20px; font: 700 76px/1.05 Fredoka, sans-serif; }
p { margin: 0; font: 500 32px/1.35 Inter, sans-serif; color: rgba(255,255,255,.85); max-width: 720px; }
.tira { display: grid; gap: 14px; grid-auto-flow: column; }
.tira i { width: 64px; height: 64px; border-radius: 14px; background: #2e9e5b; }
.tira i.no { background: #d64545; }
.abajo { display: flex; justify-content: space-between; align-items: center; font: 700 30px Inter, sans-serif; color: rgba(255,255,255,.9); }
.pill { padding: 10px 22px; border-radius: 999px; background: rgba(255,255,255,.14); font: 600 26px Inter, sans-serif; }
</style></head><body>
<div class="arriba">${t.arriba}</div>
<div class="medio"><div><h1>${t.titulo}</h1><p>${t.texto}</p></div>
<div class="tira">${t.tira.map((v) => `<i${v ? '' : ' class="no"'}></i>`).join('')}</div></div>
<div class="abajo"><span>${t.enlace}</span><span class="pill">Gratis · sin instalar nada</span></div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
for (const t of TARJETAS) {
  await page.goto('http://localhost:8892/retos.html', { waitUntil: 'domcontentloaded' }); await page.setContent(html(t), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${RAIZ}/assets/social/${t.fichero}.png`, type: 'png' })
  console.log('ok', t.fichero)
}
await browser.close()
