// Las imágenes de /para-tiendas (1281), en WebP: [salida, origen, ancho, recorte x,y,w,h en fracción]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const C = process.argv[2], SAL = process.argv[3]
mkdirSync(SAL, { recursive: true })
const LISTA = [
  ['stock', 'pc-stock.png', 1280, [0, 0, 1, 1]],
  ['etiquetas', 'pc-etiquetas.png', 900, [0.2825, 0.032, 0.435, 0.937]],
  ['comprar', 'pc-comprar2.png', 900, [0.2825, 0.032, 0.435, 0.937]],
  ['caja', 'pc-caja.png', 900, [0.2825, 0.159, 0.435, 0.682]],
  ['anadir', 'pc-anadir.png', 1280, [0, 0, 1, 1]],
  ['movil-stock', 'm-stock.png', 600, [0, 0, 1, 1]],
  ['movil-mostrador', 'm-mostrador.png', 600, [0, 0, 1, 1]],
  ['movil-escaparate', 'm-escaparate.png', 600, [0, 0, 1, 1]],
  ['movil-carta', 'm-popup.png', 600, [0, 0, 1, 1]],
  ['movil-mercado', 'm-mercado.png', 600, [0, 0, 1, 1]],
  ['dossier', '../portada-01.png', 520, [0, 0, 1, 1]],
]
const b = await chromium.launch(); const p = await b.newPage()
for (const [n, f, ancho, [cx, cy, cw, ch]] of LISTA) {
  const d = 'data:image/png;base64,' + readFileSync(`${C}/${f}`).toString('base64')
  const r = await p.evaluate(async ([d, ancho, cx, cy, cw, ch]) => {
    const i = new Image(); i.src = d; await i.decode()
    const sx = i.width * cx, sy = i.height * cy, sw = i.width * cw, sh = i.height * ch
    const w = Math.min(ancho, Math.round(sw)), h = Math.round(sh * w / sw)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, sx, sy, sw, sh, 0, 0, w, h)
    return { url: c.toDataURL('image/webp', 0.8), w, h }
  }, [d, ancho, cx, cy, cw, ch])
  writeFileSync(`${SAL}/${n}.webp`, Buffer.from(r.url.split(',')[1], 'base64'))
  console.log(n, r.w, r.h)
}
await b.close()
