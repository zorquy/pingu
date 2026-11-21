// Saca los PNG del carrusel de «Sugerir» y «Ordenar» (1407): copia la página y
// las fotos al sitio servido y guarda cada lienzo en la carpeta dada.
//   node hacer.mjs <salida>   (PD_SITIO = la copia servida; PD_BASE su dirección;
//   PD_ARTE = las ilustraciones de TCGdex y las dos capturas)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { copyFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs'
const SITIO = process.env.PD_SITIO || '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/test-forum5'
const BASE = process.env.PD_BASE || 'http://localhost:8896'
const SALIDA = process.argv[2] || '/tmp/carrusel-armonia'
mkdirSync(SALIDA, { recursive: true })
copyFileSync(new URL('./carrusel.html', import.meta.url), `${SITIO}/carrusel-armonia.html`)
cpSync(process.env.PD_ARTE || '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/carrusel-armonia/arte', `${SITIO}/carrusel-arte`, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage()
p.on('pageerror', (e) => console.log('ERROR', e.message))
await p.goto(`${BASE}/carrusel-armonia.html`)
await p.waitForFunction(() => window.__carrusel, null, { timeout: 60000 })
console.log('paleta', await p.evaluate(() => window.__paleta), 'orden', await p.evaluate(() => window.__orden))
const r = await p.evaluate(() => window.__carrusel)
for (const [n, d] of Object.entries(r)) { writeFileSync(`${SALIDA}/${n}.png`, Buffer.from(d.split(',')[1], 'base64')); console.log(n) }
await b.close()
