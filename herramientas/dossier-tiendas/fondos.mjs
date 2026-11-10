// Los fondos de degradado del dossier, pintados una vez en JPEG: como CSS,
// Chromium los mete en el PDF como patrones con máscara de 200 KB por página.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
const SAL = process.argv[2]; mkdirSync(SAL, { recursive: true })
const b = await chromium.launch(); const p = await b.newPage()
for (const [n, w, h, cx, cy, r, a, paradas] of [
  ['banda', 1900, 560, 0.92, 0.3, 700, 0.55, [[0, '#1e5175'], [1, '#163d59']]],
  ['portada', 1240, 1754, 0.85, 0.42, 900, 0.40, [[0, '#1e5175'], [0.58, '#0f2c40'], [1, '#0b1219']]],
]) {
  const url = await p.evaluate(([w, h, cx, cy, r, a, paradas]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')
    const g = x.createLinearGradient(0, 0, w * 0.5, h); for (const [o, col] of paradas) g.addColorStop(o, col)
    x.fillStyle = g; x.fillRect(0, 0, w, h)
    const rg = x.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, r); rg.addColorStop(0, `rgba(60,200,192,${a})`); rg.addColorStop(1, 'rgba(60,200,192,0)')
    x.fillStyle = rg; x.fillRect(0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.86)
  }, [w, h, cx, cy, r, a, paradas])
  writeFileSync(`${SAL}/${n}.jpg`, Buffer.from(url.split(',')[1], 'base64'))
}
await b.close()
