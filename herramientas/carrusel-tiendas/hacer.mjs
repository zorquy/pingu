// Saca los PNG del carrusel de tiendas: copia la página al sitio servido
// (sync-forum.sh + serve en 8892) y guarda cada lienzo en la carpeta dada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { copyFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs'
const SITIO = process.env.PD_SITIO || '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/test-forum'
const SALIDA = process.argv[2] || '/tmp/carrusel-tiendas'
mkdirSync(SALIDA, { recursive: true })
copyFileSync(new URL('./carrusel.html', import.meta.url), `${SITIO}/carrusel-tiendas.html`)
// Los dibujos oficiales (PokeAPI/sprites, official-artwork), bajados antes con
// curl a PD_ARTE: el navegador de pruebas no sale a internet.
cpSync(process.env.PD_ARTE || '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/arte-pkm', `${SITIO}/carrusel-arte`, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage()
p.on('pageerror', (e) => console.log('ERROR', e.message))
await p.goto('http://localhost:8892/carrusel-tiendas.html')
await p.waitForFunction(() => window.__carrusel, null, { timeout: 30000 })
const r = await p.evaluate(() => window.__carrusel)
for (const [n, d] of Object.entries(r)) { writeFileSync(`${SALIDA}/${n}.png`, Buffer.from(d.split(',')[1], 'base64')); console.log(n) }
await b.close()
