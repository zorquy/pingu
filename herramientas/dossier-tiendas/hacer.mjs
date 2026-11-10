// Saca el PDF del dossier de tiendas (1281): copia dossier.html al sitio
// servido (sync-forum.sh + serve en 8892), con las capturas en
// /dossier-capturas/ (capturas.mjs + convertir.mjs) y las cartas en
// /carrusel-arte/, y lo imprime en A4 con Chromium.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { copyFileSync } from 'node:fs'
const SITIO = process.env.PD_SITIO || '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/test-forum'
const SALIDA = process.argv[2] || '/tmp/pokedoc-para-tiendas.pdf'
copyFileSync(new URL('./dossier.html', import.meta.url), `${SITIO}/dossier-tiendas.html`)
const b = await chromium.launch()
const p = await b.newPage()
p.on('pageerror', (e) => console.log('ERROR', e.message))
await p.goto('http://localhost:8892/dossier-tiendas.html')
await p.waitForFunction(() => window.__listo, null, { timeout: 30000 })
await p.pdf({ path: SALIDA, format: 'A4', printBackground: true, preferCSSPageSize: true })
if (process.argv[3]) { await p.setViewportSize({ width: 794, height: 1123 }); await p.screenshot({ path: process.argv[3], fullPage: true }) }
await b.close()
console.log('PDF', SALIDA)
