// Pasa las capturas a JPEG (para el PDF) y WebP (para la web), con un ancho
// máximo, usando el lienzo de Chromium (aquí no hay sharp ni PIL).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const [ENT, SAL, TIPO = 'jpeg', ANCHO = '1600', CAL = '0.82'] = process.argv.slice(2)
mkdirSync(SAL, { recursive: true })
const b = await chromium.launch(); const p = await b.newPage()
for (const f of readdirSync(ENT).filter((f) => f.endsWith('.png'))) {
  const datos = 'data:image/png;base64,' + readFileSync(`${ENT}/${f}`).toString('base64')
  const out = await p.evaluate(async ([d, tipo, ancho, cal]) => {
    const i = new Image(); i.src = d; await i.decode()
    const w = Math.min(ancho, i.width), h = Math.round(i.height * w / i.width)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, w, h)
    return c.toDataURL('image/' + tipo, cal)
  }, [datos, TIPO, Number(ANCHO), Number(CAL)])
  const ext = TIPO === 'jpeg' ? 'jpg' : TIPO
  writeFileSync(`${SAL}/${f.replace('.png', '.' + ext)}`, Buffer.from(out.split(',')[1], 'base64'))
}
await b.close()
